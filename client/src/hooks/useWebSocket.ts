import { useState, useEffect, useRef } from 'react';
import { useAuth, type AuthUser } from './useAuth';

interface WebSocketOptions {
  onMessage?: (data: any) => void;
  autoReconnect?: boolean;
  includeAuthToken?: boolean;
}

export const useWebSocket = (
  path: string, 
  options: WebSocketOptions = {}
): { 
  socket: WebSocket | null,
  send: (data: any) => void,
  connected: boolean
} => {
  const { autoReconnect = true, onMessage, includeAuthToken = true } = options;
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;
  const { user, isAuthenticated } = useAuth();

  // Add auth token to URL if needed and available
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Make sure we have the correct WebSocket path
    const wsPath = path.startsWith('/') ? path : `/${path}`;
    // Fix: Use correct URL format with host and ensure no double slashes
    let wsUrl = `${protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}${wsPath}`;
    
    // Include token parameters if required and available
    if (includeAuthToken && isAuthenticated && user) {
      // If user is authenticated with Replit Auth, cookies will handle auth
      // But we need to add a parameter to indicate this path should be authenticated
      // Append userId parameter for server-side validation
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl += `${separator}userId=${user.id}`;
      
      // Also check for JWT token in localStorage as fallback
      const token = localStorage.getItem('token');
      if (token) {
        wsUrl += `&token=${encodeURIComponent(token)}`;
      }
    }
    
    console.log(`WebSocket URL constructed: ${wsUrl}`);
    return wsUrl;
  };

  // Function to send data through the WebSocket
  const send = (data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        // Convert data to JSON string if it's not already a string
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        socket.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  };

  useEffect(() => {
    // Create and connect the WebSocket
    const connectWebSocket = () => {
      const wsUrl = getWebSocketUrl();

      console.log(`Connecting to WebSocket at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      // Event listeners
      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
        setSocket(ws);
        setConnected(true);
        
        // Send an authentication message if needed
        if (isAuthenticated && user && includeAuthToken) {
          // We can send an explicit auth message to help server authenticate
          send({ type: 'auth', userId: user.id });
        }
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
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
        console.log(`WebSocket disconnected: ${event.code}, reason: ${event.reason}`);
        setSocket(null);
        setConnected(false);

        // Attempt to reconnect with exponential backoff
        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('Max reconnect attempts reached. WebSocket connection failed.');
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        // We don't need to handle reconnection here as the 'close' event will trigger after an error
      });
    };

    // Only connect if path is provided
    if (path) {
      connectWebSocket();
    }

    // Cleanup function
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [path, user, isAuthenticated, includeAuthToken]); // Re-connect if authentication state changes

  return { socket, send, connected };
};