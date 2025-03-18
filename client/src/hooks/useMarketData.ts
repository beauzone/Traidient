import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

interface MarketDataState {
  [symbol: string]: MarketDataUpdate;
}

export function useMarketData() {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [marketData, setMarketData] = useState<MarketDataState>({});
  const [subscribedSymbols, setSubscribedSymbols] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) return;

    // Determine the correct WebSocket protocol based on the current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Create WebSocket connection
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      
      // Authenticate immediately upon connection
      socket.send(JSON.stringify({
        type: 'auth',
        token
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'connection_established':
            console.log('Connected to market data service');
            break;
            
          case 'auth_success':
            console.log('WebSocket authentication successful');
            setConnected(true);
            
            // Re-subscribe to previously subscribed symbols
            if (subscribedSymbols.length > 0) {
              socket.send(JSON.stringify({
                type: 'subscribe',
                symbols: subscribedSymbols
              }));
            }
            break;
            
          case 'auth_error':
            console.error('WebSocket authentication failed:', message.message);
            toast({
              title: 'Authentication Error',
              description: 'Failed to authenticate with market data service',
              variant: 'destructive'
            });
            break;
            
          case 'subscribe_success':
            console.log(`Subscribed to ${message.symbols.join(', ')}`);
            setSubscribedSymbols(message.symbols);
            break;
            
          case 'unsubscribe_success':
            console.log(`Unsubscribed from symbols. Current subscriptions: ${message.symbols.join(', ')}`);
            setSubscribedSymbols(message.symbols);
            break;
            
          case 'market_data':
            // Update market data state
            setMarketData(prevData => {
              const newData = { ...prevData };
              
              message.data.forEach((update: MarketDataUpdate) => {
                newData[update.symbol] = update;
              });
              
              return newData;
            });
            break;
            
          case 'error':
            console.error('WebSocket error:', message.message);
            toast({
              title: 'Market Data Error',
              description: message.message,
              variant: 'destructive'
            });
            break;
            
          default:
            console.log('Unknown message type:', message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: 'Connection Error',
        description: 'Error connecting to market data service',
        variant: 'destructive'
      });
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
    };
    
    // Cleanup function to close the WebSocket when the component unmounts
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [token]);

  // Function to subscribe to market data for specific symbols
  const subscribeToSymbols = useCallback((symbols: string[]) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !connected) {
      toast({
        title: 'Connection Error',
        description: 'Not connected to market data service',
        variant: 'destructive'
      });
      return;
    }
    
    socketRef.current.send(JSON.stringify({
      type: 'subscribe',
      symbols
    }));
  }, [connected]);

  // Function to unsubscribe from market data for specific symbols
  const unsubscribeFromSymbols = useCallback((symbols: string[]) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !connected) {
      return;
    }
    
    socketRef.current.send(JSON.stringify({
      type: 'unsubscribe',
      symbols
    }));
  }, [connected]);

  return {
    connected,
    marketData,
    subscribedSymbols,
    subscribeToSymbols,
    unsubscribeFromSymbols
  };
}