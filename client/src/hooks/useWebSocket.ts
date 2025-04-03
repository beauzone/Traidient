import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (path: string): WebSocket | null => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  useEffect(() => {
    // Create and connect the WebSocket
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Important: Do not add any port in the URL as the browser will use the same port as the page
      const host = window.location.host.split(':')[0]; // Get just the hostname without port
      const wsUrl = `${protocol}//${host}${path}`;

      console.log(`Connecting to WebSocket at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      // Event listeners
      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
        setSocket(ws);
      });

      ws.addEventListener('close', (event) => {
        console.log(`WebSocket disconnected: ${event.code}, reason: ${event.reason}`);
        setSocket(null);

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.error('Max reconnect attempts reached. WebSocket connection failed.');
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [path]);

  return socket;
};