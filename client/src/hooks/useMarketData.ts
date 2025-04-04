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
  
  // Polling intervals (in milliseconds) - using longer intervals to avoid Cloudflare blocking
  pollingIntervals: {
    marketHours: 60000,     // Exactly 1 minute during market hours (user requirement)
    extendedHours: 120000,  // 2 minutes during pre/post market (reduced frequency)
    overnight: 300000,      // 5 minutes overnight (minimal updates needed)
    weekend: 600000         // 10 minutes on weekends (minimal updates needed)
  },
  
  // Caching settings
  cache: {
    // How long to consider cached data fresh during market hours (in milliseconds)
    marketHoursFreshness: 90000,  // 1.5 minutes during market hours
    // How long to consider cached data fresh during non-market hours (in milliseconds)
    nonMarketHoursFreshness: 86400000, // 24 hours - extensive caching when market closed
    // Force a refresh after this many milliseconds even during non-market hours
    maxCacheAge: 86400000 * 2     // 48 hours maximum cache age before force refresh
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
    marketStatus?: {
      isRegularHours: boolean;
      isPreMarketHours: boolean;
      isAfterMarketHours: boolean;
      isWeekend: boolean;
      nextMarketOpen?: string;
      nextMarketClose?: string;
      currentTimezone?: string;
      exchangeTimezone?: string;
    }
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
      pollingInterval: 60000, // Default start: 1 minute (Cloudflare-friendly)
      isReplitEnvironment: window.location.hostname.includes('replit') || 
                           window.location.hostname.includes('repl.co')
    };
    
    // Get adaptive polling interval based on market conditions, time of day, and network performance
    // Implementation updated to follow user requirements for exact 1-minute polling during market hours
    // and less frequent polling with enhanced caching during non-market hours
    const getAdaptivePollingInterval = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Weekend polling behavior (minimal updates needed)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log('Weekend detected - using extended polling interval with caching');
        return MARKET_DATA_CONFIG.pollingIntervals.weekend;
      }
      
      // US Market hours are 9:30 AM - 4:00 PM ET, approximated in local time
      // During market hours, we want exactly 1-minute polling as per user requirement
      const isMarketHours = 
        (hour > 9 || (hour === 9 && minute >= 30)) && 
        hour < 16;
      
      if (isMarketHours) {
        console.log('Market hours detected - using exact 1-minute polling interval');
        // User requirement: exactly 1 minute polling during market hours
        return MARKET_DATA_CONFIG.pollingIntervals.marketHours;
      }
      
      // Pre-market and after-hours - reduced frequency compared to market hours
      const isExtendedHours = 
        (hour >= 4 && hour < 9) || 
        (hour === 9 && minute < 30) || 
        (hour >= 16 && hour < 20);
      
      if (isExtendedHours) {
        console.log('Extended hours detected - using extended hours polling interval');
        return MARKET_DATA_CONFIG.pollingIntervals.extendedHours;
      }
      
      // Overnight - minimal polling needed with enhanced caching
      console.log('Overnight hours detected - using overnight polling interval with maximum caching');
      return MARKET_DATA_CONFIG.pollingIntervals.overnight;
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
        
        // Debug output to see response format
        console.log('Market status API response:', response.data);
        
        // The API returns data directly, not under a 'status' property
        if (response.data && response.data.success) {
          setMarketStatus({
            isMarketOpen: response.data.isMarketOpen,
            dataSource: response.data.provider || 'http-fallback',
            marketStatus: response.data.marketStatus || {
              isRegularHours: false,
              isPreMarketHours: false,
              isAfterMarketHours: false,
              isWeekend: false,
              nextMarketOpen: undefined,
              nextMarketClose: undefined,
              currentTimezone: undefined,
              exchangeTimezone: undefined
            }
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
    
    // Enhanced fetch quotes with advanced error handling, recovery, and caching strategy
    // Implements proper caching during non-market hours as per user requirements
    const fetchQuotes = async (forceRefresh = false) => {
      if (subscribedSymbols.length === 0) return;
      
      try {
        // Prepare request parameters
        const symbols = [...subscribedSymbols].join(',');
        
        // Determine if we should use cache based on market status and time since last fetch
        // During market hours - always refresh as per 1-minute requirement
        // During non-market hours - leverage caching when appropriate
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Check if market is likely open (9:30 AM - 4:00 PM ET on weekdays)
        const isLikelyMarketHours = 
          (dayOfWeek > 0 && dayOfWeek < 6) && // Monday to Friday
          ((hour > 9 || (hour === 9 && minute >= 30)) && hour < 16);
        
        // Determine appropriate caching strategy
        let cachingStrategy = 'no-cache';
        let cacheMaxAge = 0;
        
        if (forceRefresh) {
          // On-demand/force refresh - never use cache
          cachingStrategy = 'no-cache';
          console.log('Forcing refresh of market data - bypassing cache');
        } else if (isLikelyMarketHours) {
          // During market hours - minimal caching (1-minute polling requirement)
          cachingStrategy = 'no-cache';
          console.log('Market hours - no caching, using 1-minute poll as required');
        } else if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Weekend - extensive caching (market definitely closed)
          cachingStrategy = 'public, max-age=86400'; // 24-hour cache
          cacheMaxAge = MARKET_DATA_CONFIG.cache.nonMarketHoursFreshness;
          console.log('Weekend detected - using extensive caching strategy');
        } else {
          // Weekday but outside market hours - moderate caching
          // But still cache-busting for regular poll updates
          cachingStrategy = 'public, max-age=3600'; // 1-hour cache
          cacheMaxAge = MARKET_DATA_CONFIG.cache.nonMarketHoursFreshness / 2;
          console.log('After hours - using moderate caching strategy');
        }
        
        // Include cache-buster parameter only during market hours or for forced refreshes
        // This allows the server/CDN to serve cached responses during non-market hours
        const cacheBuster = (isLikelyMarketHours || forceRefresh) ? `&_=${Date.now()}` : '';
        
        // Set appropriate headers based on caching strategy
        const headers: Record<string, string> = {
          'X-Requested-With': 'XMLHttpRequest'
        };
        
        // Only include cache control headers for non-cacheable requests
        if (cachingStrategy === 'no-cache') {
          headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          headers['Pragma'] = 'no-cache';
        }
        
        console.log(`Fetching quotes with caching strategy: ${cachingStrategy}`);
        
        const response = await axios.get(
          `/api/market-data/quotes?symbols=${symbols}${cacheBuster}`,
          {
            timeout: 10000, // 10 second timeout
            headers
          }
        );
        
        if (response.data && response.data.quotes && Array.isArray(response.data.quotes)) {
          const fetchTime = new Date().toISOString();
          
          setMarketData(prevData => {
            const newData = { ...prevData };
            
            response.data.quotes.forEach((quote: MarketDataUpdate) => {
              // Add additional metadata to track the data source and fetch time
              newData[quote.symbol] = {
                ...quote,
                dataSource: quote.dataSource || 'http-fallback',
                fetchTime,
                isSimulated: quote.isSimulated || false,
                delay: quote.delay || 0
              };
            });
            
            return newData;
          });
          
          // Reset error tracking on successful request
          pollingMetrics.consecutiveErrors = 0;
          pollingMetrics.lastSuccessfulPoll = Date.now();
          
          // Update data status to help UI show freshness information
          setDataStatus(prevStatus => ({
            ...prevStatus,
            lastSuccessfulFetch: Date.now(),
            isStale: false,
            averageDelay: response.data.quotes.reduce((acc: number, q: MarketDataUpdate) => 
              acc + (q.delay || 0), 0) / response.data.quotes.length
          }));
          
          // Also update market status if available
          if (response.data && response.data.marketStatus) {
            setMarketStatus({
              isMarketOpen: response.data.marketStatus.isMarketOpen,
              dataSource: response.data.marketStatus.dataSource || 'http-fallback',
              lastUpdated: fetchTime,
              marketStatus: response.data.marketStatus.marketStatus || {
                isRegularHours: false,
                isPreMarketHours: false,
                isAfterMarketHours: false,
                isWeekend: false,
                nextMarketOpen: response.data.marketStatus.nextMarketOpen,
                nextMarketClose: response.data.marketStatus.nextMarketClose,
                currentTimezone: response.data.marketStatus.currentTimezone,
                exchangeTimezone: response.data.marketStatus.exchangeTimezone
              }
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
        
        // Update data status to reflect staleness
        setDataStatus(prevStatus => ({
          ...prevStatus,
          isStale: true
        }));
      }
    };
    
    // Schedule next poll with adaptive interval
    const scheduleNextPoll = () => {
      // Adjust polling interval based on consecutive errors - implement exponential backoff
      if (pollingMetrics.consecutiveErrors > 3) {
        // Progressive backoff up to 3 minutes max (Cloudflare-friendly)
        pollingMetrics.pollingInterval = Math.min(
          180000, // 3 minutes maximum 
          pollingMetrics.pollingInterval * 1.5
        );
        console.log(`Backing off polling to ${pollingMetrics.pollingInterval}ms due to ${pollingMetrics.consecutiveErrors} consecutive errors`);
      } else {
        // Normal adaptive interval based on market conditions
        pollingMetrics.pollingInterval = getAdaptivePollingInterval();
      }
      
      // Reset if it's been too long since last successful poll
      if (Date.now() - pollingMetrics.lastSuccessfulPoll > 180000) { // 3 minutes
        console.log('No successful polls for 3 minutes, resetting polling strategy');
        pollingMetrics.pollingInterval = 60000; // Reset to initial interval (Cloudflare-friendly)
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
                    lastUpdated: new Date().toISOString(),
                    marketStatus: message.marketStatus.marketStatus || {
                      isRegularHours: false,
                      isPreMarketHours: false,
                      isAfterMarketHours: false,
                      isWeekend: false,
                      nextMarketOpen: message.marketStatus.nextMarketOpen,
                      nextMarketClose: message.marketStatus.nextMarketClose,
                      currentTimezone: message.marketStatus.currentTimezone,
                      exchangeTimezone: message.marketStatus.exchangeTimezone
                    }
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