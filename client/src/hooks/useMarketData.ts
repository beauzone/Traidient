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
  fetchTime?: string;
  delay?: number;
}

interface MarketDataState {
  [symbol: string]: MarketDataUpdate;
}

// Configuration for market data behavior
const MARKET_DATA_CONFIG = {
  // In a production environment, we would attempt WebSockets first
  // but for Replit, due to Cloudflare restrictions, we'll use HTTP polling
  useHttpPollingByDefault: true,
  
  // Maximum number of WebSocket connection attempts before falling back to HTTP
  maxWebSocketConnectionAttempts: 2,
  
  // Polling intervals (in milliseconds)
  pollingIntervals: {
    marketHours: 3000,      // 3 seconds during market hours
    extendedHours: 10000,   // 10 seconds during pre/post market
    overnight: 30000,       // 30 seconds overnight
    weekend: 60000          // 1 minute on weekends
  },
  
  // How many symbols to request in a single batch
  batchSize: 20,
  
  // Whether to show toasts for connectivity changes
  showConnectivityToasts: true
};

export function useMarketData() {
  const { user, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [marketData, setMarketData] = useState<MarketDataState>({});
  const [subscribedSymbols, setSubscribedSymbols] = useState<string[]>([]);
  const [marketStatus, setMarketStatus] = useState<{
    isMarketOpen: boolean;
    dataSource: string;
    lastUpdated?: string;
  }>({ isMarketOpen: false, dataSource: 'unknown' });
  
  // Reference to WebSocket connection
  const socketRef = useRef<WebSocket | null>(null);
  
  // Reference to HTTP polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if we're using the fallback HTTP polling method
  const [usingFallback, setUsingFallback] = useState(MARKET_DATA_CONFIG.useHttpPollingByDefault);
  
  // Track data freshness and status
  const [dataStatus, setDataStatus] = useState<{
    lastSuccessfulFetch: number;
    averageDelay: number;
    isStale: boolean;
  }>({
    lastSuccessfulFetch: 0,
    averageDelay: 0,
    isStale: false
  });
  
  // Toast notifications
  const { toast } = useToast();
  
  // Track WebSocket connection attempts
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = MARKET_DATA_CONFIG.maxWebSocketConnectionAttempts;

  // Enhanced adaptive HTTP polling for market data when WebSockets aren't available
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    if (!isAuthenticated || !user || subscribedSymbols.length === 0) {
      return;
    }
    
    console.log('Starting enhanced adaptive HTTP polling for market data');
    setUsingFallback(true);
    
    // Track polling performance metrics
    const pollingMetrics = {
      consecutiveErrors: 0,
      lastSuccessfulPoll: Date.now(),
      pollingInterval: 5000, // Default start: 5 seconds
      isReplitEnvironment: window.location.hostname.includes('replit') || 
                           window.location.hostname.includes('repl.co')
    };
    
    // Get adaptive polling interval based on market conditions, time of day, and network performance
    const getAdaptivePollingInterval = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Weekend polling behavior
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 30000 + (Math.random() * 10000); // 30-40 seconds on weekends
      }
      
      // Market hours (9:30 AM - 4:00 PM ET, approximated) - faster polling
      const isMarketHours = 
        (hour > 9 || (hour === 9 && minute >= 30)) && 
        hour < 16;
      
      if (isMarketHours) {
        // Faster polling during market hours
        return 5000 + (Math.random() * 2000); // 5-7 seconds
      }
      
      // Pre-market and after-hours - medium polling
      const isExtendedHours = 
        (hour >= 4 && hour < 9) || 
        (hour === 9 && minute < 30) || 
        (hour >= 16 && hour < 20);
      
      if (isExtendedHours) {
        return 10000 + (Math.random() * 5000); // 10-15 seconds
      }
      
      // Overnight - slowest polling
      return 30000 + (Math.random() * 15000); // 30-45 seconds
    };
    
    // Check market status using HTTP API with cache busting
    const checkMarketStatus = async () => {
      try {
        // Generate cache busting parameter
        const cacheBuster = Date.now();
        
        const response = await axios.get(`/api/market-data/status?_=${cacheBuster}`, {
          timeout: 10000, // 10 second timeout
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        
        if (response.data && response.data.status) {
          setMarketStatus({
            isMarketOpen: response.data.status.isMarketOpen,
            dataSource: response.data.status.dataSource || 'http-fallback'
          });
          
          // Reset consecutive errors counter on success
          pollingMetrics.consecutiveErrors = 0;
          pollingMetrics.lastSuccessfulPoll = Date.now();
        }
      } catch (error) {
        console.error('Error fetching market status:', error);
        pollingMetrics.consecutiveErrors++;
      }
    };
    
    // Enhanced fetch quotes with advanced error handling and recovery
    const fetchQuotes = async () => {
      if (subscribedSymbols.length === 0) return;
      
      try {
        // Batch requests for efficiency - fetch quotes for all symbols at once with cache busting
        const symbols = [...subscribedSymbols].join(',');
        const cacheBuster = Date.now();
        
        const response = await axios.get(
          `/api/market-data/quotes?symbols=${symbols}&_=${cacheBuster}`,
          {
            timeout: 10000, // 10 second timeout
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        );
        
        if (response.data && response.data.quotes && Array.isArray(response.data.quotes)) {
          setMarketData(prevData => {
            const newData = { ...prevData };
            
            response.data.quotes.forEach((quote: MarketDataUpdate) => {
              // Add additional metadata to track the data source and fetch time
              newData[quote.symbol] = {
                ...quote,
                dataSource: quote.dataSource || 'http-fallback',
                fetchTime: new Date().toISOString()
              };
            });
            
            return newData;
          });
          
          // Reset error tracking on successful request
          pollingMetrics.consecutiveErrors = 0;
          pollingMetrics.lastSuccessfulPoll = Date.now();
          
          // Also update market status if available
          if (response.data && response.data.marketStatus) {
            setMarketStatus({
              isMarketOpen: response.data.marketStatus.isMarketOpen,
              dataSource: response.data.marketStatus.dataSource || 'http-fallback'
            });
          }
        }
      } catch (error) {
        console.error('Error fetching quotes:', error);
        pollingMetrics.consecutiveErrors++;
        
        // Only show toast after multiple failures to avoid alert fatigue
        if (pollingMetrics.consecutiveErrors === 3) {
          toast({
            title: 'Market Data Delay',
            description: 'Market data updates may be delayed due to connection issues',
            variant: 'default'
          });
        }
      }
    };
    
    // Schedule next poll with adaptive interval
    const scheduleNextPoll = () => {
      // Adjust polling interval based on consecutive errors - implement exponential backoff
      if (pollingMetrics.consecutiveErrors > 3) {
        // Progressive backoff up to 1 minute max
        pollingMetrics.pollingInterval = Math.min(
          60000, 
          pollingMetrics.pollingInterval * 1.5
        );
        console.log(`Backing off polling to ${pollingMetrics.pollingInterval}ms due to ${pollingMetrics.consecutiveErrors} consecutive errors`);
      } else {
        // Normal adaptive interval based on market conditions
        pollingMetrics.pollingInterval = getAdaptivePollingInterval();
      }
      
      // Reset if it's been too long since last successful poll
      if (Date.now() - pollingMetrics.lastSuccessfulPoll > 120000) { // 2 minutes
        console.log('No successful polls for 2 minutes, resetting polling strategy');
        pollingMetrics.pollingInterval = 5000; // Reset to initial interval
      }
      
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Set the new interval
      pollingIntervalRef.current = setInterval(() => {
        console.log(`HTTP fallback poll executing (interval: ${pollingMetrics.pollingInterval}ms)`);
        checkMarketStatus();
        fetchQuotes();
        
        // Reschedule with adaptive interval for the next poll
        scheduleNextPoll();
      }, pollingMetrics.pollingInterval);
    };
    
    // Initial fetch immediately
    checkMarketStatus();
    fetchQuotes();
    
    // Then start the adaptive polling schedule
    scheduleNextPoll();
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, user, subscribedSymbols, toast]);
  
  // Stop polling if WebSocket is working again
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('Stopping fallback HTTP polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setUsingFallback(false);
    }
  }, []);

  // Initialize market data connection - prioritizing HTTP polling for Replit
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Helper function to ensure default symbols are included in subscription
    const ensureDefaultSymbols = () => {
      // Include SPY for market status tracking by default
      const symbolsToSubscribe = ['SPY'];
      
      // Add any previously subscribed symbols, avoiding duplicates
      subscribedSymbols.forEach(symbol => {
        if (!symbolsToSubscribe.includes(symbol)) {
          symbolsToSubscribe.push(symbol);
        }
      });
      
      return symbolsToSubscribe;
    };
    
    // Function for WebSocket connection (will be used as backup or in environments where it works)
    const connectWebSocket = () => {
      try {
        // Only attempt WebSocket if we're not already using HTTP polling successfully
        if (usingFallback) {
          console.log('Already using HTTP polling successfully, skipping WebSocket attempt');
          return;
        }
        
        // Track connection attempts
        connectionAttempts.current += 1;
        
        // Determine the correct WebSocket protocol based on the current page protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // Construct WebSocket URL with resilience for Replit's environment
        // Add a timestamp query parameter to avoid caching issues
        const timestamp = Date.now();
        const wsUrl = `${protocol}//${window.location.host}/ws?_=${timestamp}`;
        
        // Log detailed information about how we're constructing the WebSocket URL
        console.log('WebSocket connection details:', {
          protocol: window.location.protocol,
          wsProtocol: protocol,
          host: window.location.host,
          hostname: window.location.hostname,
          port: window.location.port,
          href: window.location.href,
          url: wsUrl,
          connectionAttempt: connectionAttempts.current
        });
        
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
                
                // Subscribe to symbols
                const symbolsToSubscribe = ensureDefaultSymbols();
                socket.send(JSON.stringify({
                  type: 'subscribe',
                  symbols: symbolsToSubscribe
                }));
                
                // Show a toast indicating real-time data is now active
                if (MARKET_DATA_CONFIG.showConnectivityToasts) {
                  toast({
                    title: 'Using Real-Time Data',
                    description: 'Connected to real-time market data stream',
                    variant: 'default'
                  });
                }
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
                    // Add fetch time for consistency with HTTP polling data
                    newData[update.symbol] = {
                      ...update,
                      fetchTime: new Date().toISOString(),
                      delay: 0 // WebSocket data is real-time, so delay is 0
                    };
                  });
                  
                  return newData;
                });
                
                // Update data status metrics
                setDataStatus(prev => ({
                  ...prev,
                  lastSuccessfulFetch: Date.now(),
                  averageDelay: 0, // WebSocket data is real-time
                  isStale: false
                }));
                
                // Update market status if provided
                if (message.marketStatus) {
                  setMarketStatus({
                    isMarketOpen: message.marketStatus.isMarketOpen,
                    dataSource: message.marketStatus.dataSource,
                    lastUpdated: new Date().toISOString()
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
              title: 'Using Market Data Updates',
              description: 'Connected to market data service',
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
    
    // If we're configured to use HTTP polling by default, start with that
    if (MARKET_DATA_CONFIG.useHttpPollingByDefault) {
      console.log('Starting with HTTP polling by default for Replit environment');
      startPollingFallback();
      
      // Optionally, attempt WebSocket as a backup after HTTP polling is established
      // This is disabled by default as we know it won't work in Replit
      // setTimeout(connectWebSocket, 5000);
    } else {
      // In non-Replit environments, we'd try WebSocket first
      connectWebSocket();
    }
    
    // Cleanup function to close connections when the component unmounts
    return () => {
      if (socketRef.current && (
        socketRef.current.readyState === WebSocket.OPEN || 
        socketRef.current.readyState === WebSocket.CONNECTING
      )) {
        socketRef.current.close();
      }
      
      stopPollingFallback();
    };
  }, [user, isAuthenticated, startPollingFallback, stopPollingFallback, subscribedSymbols, usingFallback, toast]);

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

  // Calculate data freshness metrics for better user feedback
  const calculateDataFreshness = useCallback(() => {
    // If we don't have any market data yet, data is considered stale
    if (Object.keys(marketData).length === 0) {
      return {
        lastUpdated: 'Never',
        staleness: 'unknown',
        averageDelay: 0,
        isStale: true
      };
    }
    
    // Calculate average fetch time across all symbols
    const now = Date.now();
    let totalDelay = 0;
    let totalQuotes = 0;
    let latestFetchTime = 0;
    
    Object.values(marketData).forEach(quote => {
      if (quote.fetchTime) {
        const fetchTimestamp = new Date(quote.fetchTime).getTime();
        totalDelay += (now - fetchTimestamp);
        latestFetchTime = Math.max(latestFetchTime, fetchTimestamp);
        totalQuotes++;
      }
    });
    
    const avgDelay = totalQuotes > 0 ? Math.round(totalDelay / totalQuotes / 1000) : 0;
    const staleness = now - latestFetchTime;
    
    // Determine if data is stale based on market conditions
    const isStale = staleness > 60000; // Consider data stale if older than 1 minute
    
    return {
      lastUpdated: latestFetchTime ? new Date(latestFetchTime).toLocaleTimeString() : 'Never',
      staleness: `${Math.round(staleness / 1000)}s ago`,
      averageDelay: avgDelay,
      isStale
    };
  }, [marketData]);
  
  // Get current data freshness metrics
  const dataFreshness = calculateDataFreshness();
  
  // Enhanced return object with more information about the connection and data status
  return {
    // Connection status
    connected: connected || usingFallback, // Consider "connected" if using either method
    usingRealtime: connected && !usingFallback,
    usingFallback,
    connectionType: connected ? 'realtime' : usingFallback ? 'http-polling' : 'disconnected',
    
    // Market data
    marketData,
    quotes: marketData, // Alias for marketData for easier access in components
    
    // Subscription information
    subscribedSymbols,
    
    // Data freshness metrics
    dataFreshness,
    
    // Market status information
    marketStatus,
    isMarketOpen: marketStatus.isMarketOpen,
    
    // Methods for managing market data
    subscribeToSymbols,
    unsubscribeFromSymbols,
    fetchQuote,  // Direct fetch method
    
    // User-friendly status message for UI display
    statusMessage: connected ? 
      'Connected to real-time market data' : 
      usingFallback ? 
        `Using market data updates (${Math.round(dataFreshness.averageDelay)}s delay)` : 
        'Disconnected from market data'
  };
}