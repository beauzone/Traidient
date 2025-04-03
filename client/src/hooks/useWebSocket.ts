import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, type AuthUser } from './useAuth';

interface WebSocketOptions {
  onMessage?: (data: any) => void;
  autoReconnect?: boolean;
  includeAuthToken?: boolean;
  pingInterval?: number;
}

export const useWebSocket = (
  path: string, 
  options: WebSocketOptions = {}
): { 
  socket: WebSocket | null,
  send: (data: any) => void,
  connected: boolean,
  reconnect: () => void
} => {
  const { 
    autoReconnect = true, 
    onMessage, 
    includeAuthToken = true,
    pingInterval = 30000  // Default ping every 30 seconds to keep connection alive
  } = options;
  
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10; // Increased from 5 to 10
  const baseReconnectDelay = 1000;
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);

  // Add auth token to URL if needed and available
  const getWebSocketUrl = useCallback(() => {
    try {
      // In Replit, the WebSocket endpoint is on the same host/domain as the application
      // We need to properly form the WebSocket URL using protocol, host, and path
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Use the host directly without specifying a port
      // This lets the browser handle port resolution correctly in Replit environment
      const host = window.location.host;
      
      // Add a cache-busting parameter to avoid caching issues
      const cacheBuster = `_=${Date.now()}`;
      
      // Connect directly to the Express server's WebSocket endpoint
      // Note: path must match server's WebSocketServer configuration (path: '/ws')
      // Important: First query param uses ? while additional params use &
      let wsUrl = `${protocol}//${host}/ws?${cacheBuster}`;
      
      // Log the window.location object for debugging
      console.log('Current location:', {
        protocol: window.location.protocol,
        host: window.location.host, 
        hostname: window.location.hostname,
        port: window.location.port,
        origin: window.location.origin,
        href: window.location.href
      });
      
      // Include token parameters if required and available
      if (includeAuthToken && isAuthenticated && user) {
        // Append userId parameter for server-side validation
        wsUrl += `&userId=${user.id}`;
        
        // Also check for JWT token in localStorage as fallback
        const token = localStorage.getItem('token');
        if (token) {
          wsUrl += `&token=${encodeURIComponent(token)}`;
        }
      }
      
      console.log(`WebSocket URL constructed: ${wsUrl}`);
      return wsUrl;
    } catch (error) {
      console.error('Error building WebSocket URL:', error);
      // Fallback to a simple URL ensuring no port is specified
      // (let the browser determine the correct port based on host)
      return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    }
  }, [includeAuthToken, isAuthenticated, user]);

  // Function to send data through the WebSocket
  const send = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        // Convert data to JSON string if it's not already a string
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        socketRef.current.send(message);
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
      return false;
    }
  }, []);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    
    // Reset reconnect attempts to start fresh
    reconnectAttempts.current = 0;
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Schedule immediate reconnection
    setTimeout(connectWebSocket, 100);
  }, []);

  // Function to send ping to keep connection alive
  const sendPing = useCallback(() => {
    if (connected && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending ping to keep WebSocket connection alive');
      send({ type: 'ping', timestamp: Date.now() });
    } else if (connected && (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
      console.warn('WebSocket appears connected in state but socket is not open. Attempting reconnection.');
      reconnect();
    }
  }, [connected, send, reconnect]);

  // Initialize ping interval
  useEffect(() => {
    if (connected && pingInterval > 0) {
      pingIntervalRef.current = setInterval(sendPing, pingInterval);
    }
    
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [connected, pingInterval, sendPing]);

  // Create and connect the WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl();

      console.log(`Connecting to WebSocket at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      // Event listeners
      ws.addEventListener('open', () => {
        console.log('WebSocket connected successfully');
        reconnectAttempts.current = 0;
        setSocket(ws);
        setConnected(true);
        
        // Send an immediate ping to verify the connection works both ways
        send({ type: 'ping', timestamp: Date.now() });
        
        // Send an authentication message if needed
        if (isAuthenticated && user && includeAuthToken) {
          // We can send an explicit auth message to help server authenticate
          send({ type: 'auth', userId: user.id });
        }
      });

      ws.addEventListener('message', (event) => {
        try {
          // Handle pongs from the server to keep connection alive
          if (event.data === 'pong' || event.data === '{"type":"pong"}') {
            console.log('Received pong from server');
            return;
          }
          
          const data = JSON.parse(event.data);
          
          // Handle pong messages
          if (data.type === 'pong') {
            console.log('Received pong message from server');
            return;
          }
          
          // Call the onMessage callback if provided
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, event.data);
          // If it's not JSON, still call onMessage with the raw data
          if (onMessage) {
            onMessage(event.data);
          }
        }
      });

      ws.addEventListener('close', (event) => {
        const closeCodes = {
          1000: 'Normal Closure',
          1001: 'Going Away',
          1002: 'Protocol Error',
          1003: 'Unsupported Data',
          1005: 'No Status Received',
          1006: 'Abnormal Closure',
          1007: 'Invalid Frame Payload Data',
          1008: 'Policy Violation',
          1009: 'Message Too Big',
          1010: 'Mandatory Extension',
          1011: 'Internal Error',
          1012: 'Service Restart',
          1013: 'Try Again Later',
          1014: 'Bad Gateway',
          1015: 'TLS Handshake'
        };
        
        const reason = closeCodes[event.code as keyof typeof closeCodes] || 'Unknown';
        console.log(`WebSocket disconnected: Code ${event.code} (${reason}), Reason: ${event.reason || 'None provided'}`);
        
        setSocket(null);
        setConnected(false);
        socketRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(
            30000, // Cap at 30 seconds
            baseReconnectDelay * Math.pow(1.5, reconnectAttempts.current) + 
            Math.floor(Math.random() * 1000) // Add jitter
          );
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('Max reconnect attempts reached. WebSocket connection failed.');
          console.info('To retry connection, call the reconnect() function or refresh the page.');
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        // We don't need to handle reconnection here as the 'close' event will trigger after an error
      });
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      
      // If we can't even create the WebSocket, try again after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttempts.current++;
        connectWebSocket();
      }, 3000);
    }
  }, [getWebSocketUrl, isAuthenticated, user, includeAuthToken, send, onMessage, autoReconnect]);

  useEffect(() => {
    // Only connect if path is provided
    if (path) {
      connectWebSocket();
    }

    // Cleanup function
    return () => {
      if (socketRef.current && (
        socketRef.current.readyState === WebSocket.OPEN || 
        socketRef.current.readyState === WebSocket.CONNECTING
      )) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [path, connectWebSocket]);

  return { socket, send, connected, reconnect };
};