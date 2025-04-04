import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import axios from 'axios';

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
  isSimulated?: boolean;
  dataSource?: string;
}

interface MarketDataState {
  [symbol: string]: MarketDataUpdate;
}

export function useMarketData() {
  const { user, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [marketData, setMarketData] = useState<MarketDataState>({});
  const [subscribedSymbols, setSubscribedSymbols] = useState<string[]>([]);
  const [marketStatus, setMarketStatus] = useState<{
    isMarketOpen: boolean;
    dataSource: string;
  }>({ isMarketOpen: false, dataSource: 'unknown' });
  const socketRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const { toast } = useToast();
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 3;

  // Fallback HTTP polling for market data when WebSockets aren't available
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    if (!isAuthenticated || !user || subscribedSymbols.length === 0) {
      return;
    }
    
    console.log('Starting fallback HTTP polling for market data');
    setUsingFallback(true);
    
    // Check market status using HTTP API
    const checkMarketStatus = async () => {
      try {
        const response = await axios.get('/api/market-data/status');
        if (response.data && response.data.status) {
          setMarketStatus({
            isMarketOpen: response.data.status.isMarketOpen,
            dataSource: response.data.status.dataSource || 'http-fallback'
          });
        }
      } catch (error) {
        console.error('Error fetching market status:', error);
      }
    };
    
    // Fetch quotes for subscribed symbols using HTTP API
    const fetchQuotes = async () => {
      if (subscribedSymbols.length === 0) return;
      
      try {
        // Batch requests for efficiency - fetch quotes for all symbols at once
        const symbols = [...subscribedSymbols].join(',');
        const response = await axios.get(`/api/market-data/quotes?symbols=${symbols}`);
        
        if (response.data && response.data.quotes && Array.isArray(response.data.quotes)) {
          setMarketData(prevData => {
            const newData = { ...prevData };
            
            response.data.quotes.forEach((quote: MarketDataUpdate) => {
              newData[quote.symbol] = {
                ...quote,
                dataSource: quote.dataSource || 'http-fallback'
              };
            });
            
            return newData;
          });
        }
        
        // Also update market status if available
        if (response.data && response.data.marketStatus) {
          setMarketStatus({
            isMarketOpen: response.data.marketStatus.isMarketOpen,
            dataSource: response.data.marketStatus.dataSource || 'http-fallback'
          });
        }
      } catch (error) {
        console.error('Error fetching quotes:', error);
      }
    };
    
    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      checkMarketStatus();
      fetchQuotes();
    }, 5000);
    
    // Initial fetch
    checkMarketStatus();
    fetchQuotes();
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, user, subscribedSymbols]);
  
  // Stop polling if WebSocket is working again
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('Stopping fallback HTTP polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setUsingFallback(false);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    const connectWebSocket = () => {
      try {
        // Track connection attempts
        connectionAttempts.current += 1;
        
        // Determine the correct WebSocket protocol based on the current page protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // Try multiple URL formats to avoid Replit networking issues
        // 1. Standard format without port
        const host = window.location.host.split(':')[0]; // Remove any port from host
        const wsUrl = `${protocol}//${host}/ws`;
        
        console.log(`Connecting to market data WebSocket at ${wsUrl} (attempt ${connectionAttempts.current})`);
        
        // Create WebSocket connection
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        socket.onopen = () => {
          console.log('WebSocket connection established');
          
          // Reset connection attempts on successful connection
          connectionAttempts.current = 0;
          
          // Stop the polling fallback if it's running
          stopPollingFallback();
          
          // Authenticate immediately upon connection
          socket.send(JSON.stringify({
            type: 'auth',
            userId: typeof user === 'object' && user ? (user as any).id : null
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
                setUsingFallback(false);
                
                // Always ensure SPY is included for market status updates
                const ensureDefaultSymbols = () => {
                  // Include SPY for market status by default
                  const symbolsToSubscribe = ['SPY'];
                  
                  // Add any previously subscribed symbols, avoiding duplicates
                  subscribedSymbols.forEach(symbol => {
                    if (!symbolsToSubscribe.includes(symbol)) {
                      symbolsToSubscribe.push(symbol);
                    }
                  });
                  
                  return symbolsToSubscribe;
                };
                
                // Subscribe to symbols
                const symbolsToSubscribe = ensureDefaultSymbols();
                socket.send(JSON.stringify({
                  type: 'subscribe',
                  symbols: symbolsToSubscribe
                }));
                break;
                
              case 'auth_error':
                console.error('WebSocket authentication failed:', message.message);
                // Only show toast once and then fall back to HTTP polling
                if (!usingFallback) {
                  toast({
                    title: 'Market Data Connection Issue',
                    description: 'Using delayed data due to connectivity issues',
                    variant: 'default'
                  });
                  startPollingFallback();
                }
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
                
                // Update market status if provided
                if (message.marketStatus) {
                  setMarketStatus({
                    isMarketOpen: message.marketStatus.isMarketOpen,
                    dataSource: message.marketStatus.dataSource
                  });
                }
                break;
                
              case 'error':
                console.error('WebSocket error:', message.message);
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
          
          // If we haven't already fallen back to HTTP polling, start it
          if (!usingFallback) {
            // Show a less alarming message to the user
            toast({
              title: 'Using Delayed Data',
              description: 'Real-time connection unavailable, using delayed data instead',
              variant: 'default'
            });
            
            startPollingFallback();
          }
        };
        
        socket.onclose = (event) => {
          console.log(`WebSocket connection closed: Code ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
          setConnected(false);
          
          // If we've exceeded the maximum retry attempts, fall back to HTTP polling
          if (connectionAttempts.current >= maxConnectionAttempts && !usingFallback) {
            console.log(`Maximum WebSocket connection attempts (${maxConnectionAttempts}) reached, falling back to HTTP polling`);
            startPollingFallback();
          }
        };
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
        
        // If we fail to even create a WebSocket, fall back to HTTP polling
        if (!usingFallback) {
          startPollingFallback();
        }
      }
    };
    
    // Attempt to connect via WebSocket
    connectWebSocket();
    
    // Cleanup function to close the WebSocket when the component unmounts
    return () => {
      if (socketRef.current && (
        socketRef.current.readyState === WebSocket.OPEN || 
        socketRef.current.readyState === WebSocket.CONNECTING
      )) {
        socketRef.current.close();
      }
      
      stopPollingFallback();
    };
  }, [user, isAuthenticated, startPollingFallback, stopPollingFallback, subscribedSymbols, usingFallback]);

  // Function to subscribe to market data for specific symbols
  const subscribeToSymbols = useCallback((symbols: string[]) => {
    setSubscribedSymbols(prev => {
      // Create a set of unique symbols by combining previous and new ones
      const uniqueSymbols = new Set([...prev, ...symbols]);
      
      // Always ensure SPY is included for market status
      uniqueSymbols.add('SPY');
      
      const finalSymbols = Array.from(uniqueSymbols);
      
      // If we're connected to WebSocket, send the subscribe message
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && connected) {
        socketRef.current.send(JSON.stringify({
          type: 'subscribe',
          symbols: finalSymbols
        }));
      }
      // Otherwise if we're using the fallback, update the symbols and restart polling
      else if (usingFallback) {
        // The effect will restart polling with the new symbols
        startPollingFallback();
      }
      
      return finalSymbols;
    });
  }, [connected, startPollingFallback, usingFallback]);

  // Function to unsubscribe from market data for specific symbols
  const unsubscribeFromSymbols = useCallback((symbols: string[]) => {
    // Ensure we don't unsubscribe from SPY, which we need for market status updates
    const symbolsToUnsubscribe = symbols.filter(s => s !== 'SPY');
    
    if (symbolsToUnsubscribe.length === 0) return;
    
    setSubscribedSymbols(prev => {
      const remaining = prev.filter(s => !symbolsToUnsubscribe.includes(s));
      
      // If we're connected to WebSocket, send the unsubscribe message
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && connected) {
        socketRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          symbols: symbolsToUnsubscribe
        }));
      }
      
      return remaining;
    });
  }, [connected]);

  // Add HTTP endpoints to manually fetch quotes for specific symbols
  const fetchQuote = useCallback(async (symbol: string) => {
    try {
      const response = await axios.get(`/api/market-data/quote/${symbol}`);
      if (response.data && response.data.quote) {
        setMarketData(prevData => ({
          ...prevData,
          [symbol]: {
            ...response.data.quote,
            dataSource: response.data.quote.dataSource || 'http-direct'
          }
        }));
        return response.data.quote;
      }
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }, []);

  return {
    connected: connected || usingFallback, // Consider "connected" if using either method
    usingRealtime: connected && !usingFallback,
    usingFallback,
    marketData,
    quotes: marketData, // Alias for marketData for easier access in components
    subscribedSymbols,
    marketStatus,
    subscribeToSymbols,
    unsubscribeFromSymbols,
    fetchQuote  // Direct fetch method
  };
}