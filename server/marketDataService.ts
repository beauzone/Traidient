/**
 * Market Data Service
 * Provides real-time and historical market data from multiple providers.
 */

import { WebSocket } from 'ws';
import { ApiIntegration } from '@shared/schema';
import { storage } from './storage';
import { AlpacaAPI } from './alpaca';
import { YahooFinanceAPI } from './yahoo';
import PolygonAPI from './polygon';
import AlphaVantageAPI from './alphavantage';
import TiingoAPI from './tiingo';

/**
 * Checks if a date is in Daylight Saving Time
 * This is a more accurate check for US DST rules
 */
function isDateInDST(date: Date): boolean {
  // DST in the US starts on the second Sunday in March
  // and ends on the first Sunday in November
  const year = date.getFullYear();
  const march = new Date(year, 2, 1); // March 1
  const november = new Date(year, 10, 1); // November 1
  
  // Find second Sunday in March
  const daysUntilSecondSundayInMarch = (14 - march.getDay()) % 7;
  const secondSundayInMarch = new Date(year, 2, 1 + daysUntilSecondSundayInMarch + 7);
  secondSundayInMarch.setHours(2); // DST starts at 2 AM local time
  
  // Find first Sunday in November
  const daysUntilFirstSundayInNov = (7 - november.getDay()) % 7;
  const firstSundayInNov = new Date(year, 10, 1 + daysUntilFirstSundayInNov);
  firstSundayInNov.setHours(2); // DST ends at 2 AM local time
  
  // Check if current date is in DST period
  const isDST = date >= secondSundayInMarch && date < firstSundayInNov;
  
  return isDST;
}

/**
 * Check if the US stock market is currently open
 * Normal market hours are 9:30 AM - 4:00 PM Eastern Time, Monday-Friday
 * @returns boolean indicating if the market is open
 */
export function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // Market is closed on weekends (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Convert to US Eastern Time (ET)
  const isDST = isDateInDST(now);
  const etOffset = isDST ? -4 : -5; // EDT is UTC-4, EST is UTC-5
  
  // Get timezone offset in minutes and convert to hours
  const tzOffsetHours = now.getTimezoneOffset() / 60; // Local timezone offset in hours
  
  // Get current hour in ET
  const etHour = (hour + 24 + etOffset + tzOffsetHours) % 24;
  
  // Regular market hours: 9:30 AM - 4:00 PM ET
  return (etHour > 9 || (etHour === 9 && minute >= 30)) && etHour < 16;
}

// Maps to store active simulation intervals by user and connection
const marketDataSimulations = new Map<number, Map<WebSocket, NodeJS.Timeout>>();

// Yahoo Finance instance (no API key needed)
const yahooFinance = new YahooFinanceAPI();

/**
 * Starts the market data streaming service for a WebSocket connection
 * Tries to use real data providers first, with fallback to simulation if needed
 * @param userId User ID for the connection
 * @param ws WebSocket connection
 * @param symbols Set of symbols to stream data for
 */
export function startMarketDataStream(userId: number, ws: WebSocket, symbols: Set<string>) {
  // Make sure we have a mapping for this user
  if (!marketDataSimulations.has(userId)) {
    marketDataSimulations.set(userId, new Map());
  }

  // Clear any existing interval for this connection
  const userSimulations = marketDataSimulations.get(userId);
  if (userSimulations?.has(ws)) {
    clearInterval(userSimulations.get(ws));
  }

  // Only start sending data if there are symbols to track
  if (symbols.size === 0) return;

  // Create price data cache for each symbol
  const priceData = new Map<string, {
    price: number;
    lastChange: number;
    volatility: number;
  }>();

  // Initialize price data with default values
  symbols.forEach(symbol => {
    const upperSymbol = symbol.toUpperCase();
    priceData.set(upperSymbol, {
      price: 100, // This will be replaced with actual data
      lastChange: 0,
      volatility: 0.0002
    });
  });

  // Set up interval to send price updates
  const interval = setInterval(async () => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      userSimulations?.delete(ws);
      return;
    }

    const updates: Array<{
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      timestamp: string;
      isSimulated: boolean;
      dataSource: string;
    }> = [];

    try {
      // Get user's data provider integrations
      const userIntegrations = await storage.getApiIntegrationsByUser(userId);

      // Get the most accurate market status information
      const isMarketOpen = isMarketCurrentlyOpen();
      
      // Initialize providers from environment variables if they exist
      let polygonAPI = null;
      let alphaVantageAPI = null; 
      let alpacaAPI = null;
      
      // Set up environment providers first if available
      if (process.env.POLYGON_API_KEY) {
        polygonAPI = new PolygonAPI({
          id: 0,
          provider: 'polygon',
          type: 'data',
          userId: 0,
          accountName: 'Default Polygon',
          description: 'Environment Polygon API',
          isActive: true,
          isPrimary: false,
          assetClasses: ['stocks'],
          exchanges: ['NASDAQ', 'NYSE'],
          accountMode: 'paper',
          providerUserId: null,
          providerAccountId: null,
          capabilities: {
            trading: false,
            marketData: true,
            accountData: false
          },
          lastStatus: 'ok',
          lastUsed: null,
          lastError: null,
          credentials: {
            apiKey: process.env.POLYGON_API_KEY
          }
        });
      }
      
      if (process.env.ALPHAVANTAGE_API_KEY) {
        alphaVantageAPI = new AlphaVantageAPI({
          id: 0,
          provider: 'alphavantage',
          type: 'data',
          userId: 0,
          accountName: 'Default AlphaVantage',
          description: 'Environment AlphaVantage API',
          isActive: true,
          isPrimary: false,
          assetClasses: ['stocks'],
          exchanges: ['NASDAQ', 'NYSE'],
          accountMode: 'paper',
          providerUserId: null,
          providerAccountId: null,
          capabilities: {
            trading: false,
            marketData: true,
            accountData: false
          },
          lastStatus: 'ok',
          lastUsed: null,
          lastError: null,
          credentials: {
            apiKey: process.env.ALPHAVANTAGE_API_KEY
          }
        });
      }
      
      // User-specific integrations (override environment if both exist)
      const polygonIntegration = userIntegrations.find(i => 
        i.provider === 'polygon' && i.type === 'data' && i.isActive);
      const alphaVantageIntegration = userIntegrations.find(i => 
        i.provider === 'alphavantage' && i.type === 'data' && i.isActive);
      const alpacaIntegration = userIntegrations.find(i => 
        i.provider === 'alpaca' && i.type === 'exchange' && i.isActive);

      // Initialize user-specific API clients if they exist
      if (polygonIntegration) {
        polygonAPI = new PolygonAPI(polygonIntegration);
      }
      
      if (alphaVantageIntegration) {
        alphaVantageAPI = new AlphaVantageAPI(alphaVantageIntegration);
      }
      
      if (alpacaIntegration) {
        alpacaAPI = new AlpacaAPI(alpacaIntegration);
      } else if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
        // Use environment variables if no user integration
        alpacaAPI = new AlpacaAPI();
      }

      // Log market status
      console.log(`Market status from app calculation: ${isMarketOpen ? 'OPEN' : 'CLOSED'}`);

      // Try to use available providers for market status
      try {
        let statusFromProvider = false;
        if (polygonAPI && polygonAPI.isValid) {
          statusFromProvider = await polygonAPI.isMarketOpen();
          console.log(`Market status from Polygon.io (for reference): ${statusFromProvider ? 'OPEN' : 'CLOSED'}`);
        } else if (alpacaAPI && alpacaAPI.isValid) {
          statusFromProvider = await alpacaAPI.isMarketOpen();
          console.log(`Market status from Alpaca (for reference): ${statusFromProvider ? 'OPEN' : 'CLOSED'}`);
        }
      } catch (error) {
        console.error('Error checking market status from providers (non-critical):', error);
      }

      // Process each symbol
      for (const symbol of Array.from(symbols)) {
        const upperSymbol = symbol.toUpperCase();
        let quoteData = null;
        let dataSource = "";

        // PRIORITY 1: Always try Yahoo Finance first regardless of market hours
        // Yahoo Finance is free, reliable, and doesn't have API limits
        try {
          quoteData = await yahooFinance.getQuote(upperSymbol);
          if (quoteData && quoteData.price) {
            dataSource = "yahoo";
            // Only log occasionally to reduce console spam
            if (Math.random() < 0.1) { // 10% of the time
              console.log(`Got Yahoo Finance data for ${upperSymbol}: ${quoteData.price}`);
            }
          }
        } catch (err) {
          console.log(`Yahoo Finance API error for ${upperSymbol}, trying next provider`);
        }

        // Only try real-time data providers if market is open and Yahoo failed
        if (!quoteData && isMarketOpen) {
          // PRIORITY 2: Try Polygon.io as secondary provider
          if (polygonAPI && polygonAPI.isValid) {
            try {
              const polygonData = await polygonAPI.getQuote(upperSymbol);
              if (polygonData && polygonData.price) {
                quoteData = polygonData;
                dataSource = "polygon";
                console.log(`Got real-time Polygon.io data for ${upperSymbol}: ${quoteData.price}`);
              }
            } catch (err) {
              console.log(`Polygon.io API error for ${upperSymbol}, trying next provider`);
            }
          }

          // PRIORITY 3: Try AlphaVantage as tertiary provider
          if (!quoteData && alphaVantageAPI) {
            try {
              const avData = await alphaVantageAPI.getQuote(upperSymbol);
              if (avData && avData.price) {
                quoteData = avData;
                dataSource = "alphavantage";
                console.log(`Got real-time AlphaVantage data for ${upperSymbol}: ${quoteData.price}`);
              }
            } catch (err) {
              console.log(`AlphaVantage API error for ${upperSymbol}, trying next provider`);
            }
          }
          
          // PRIORITY 4 (LAST RESORT): Try Alpaca only if all other providers failed
          // We want to minimize Alpaca calls to avoid API limits
          if (!quoteData && alpacaAPI && alpacaAPI.isValid) {
            try {
              const alpacaData = await alpacaAPI.getQuote(upperSymbol);
              if (alpacaData && alpacaData.quote && alpacaData.quote.ap) {
                quoteData = {
                  price: alpacaData.quote.ap,
                  change: 0, // Alpaca doesn't provide change directly
                  changePercent: 0 // Will need to be calculated separately
                };
                dataSource = "alpaca";
                console.log(`Got real-time Alpaca data for ${upperSymbol}: ${quoteData.price}`);
              }
            } catch (err) {
              console.log(`Alpaca API error for ${upperSymbol}, falling back to simulation`);
            }
          }
        }

        // Add the data to updates if we got it from any provider
        if (quoteData && quoteData.price) {
          // Update stored price data for future reference
          priceData.set(upperSymbol, {
            price: quoteData.price,
            lastChange: quoteData.change || 0,
            volatility: 0.0002
          });

          updates.push({
            symbol: upperSymbol,
            price: Number(quoteData.price.toFixed(2)),
            change: Number((quoteData.change || 0).toFixed(2)),
            changePercent: Number((quoteData.changePercent || 0).toFixed(2)),
            timestamp: new Date().toISOString(),
            isSimulated: false,
            dataSource: dataSource
          });
        } else {
          // Fall back to simulation if all providers failed
          const data = priceData.get(upperSymbol);
          if (!data) continue;

          // Simulate price movement with momentum
          const momentum = data.lastChange > 0 ? 0.6 : 0.4;
          const randomFactor = Math.random();
          const direction = randomFactor > momentum ? -1 : 1;
          const changeAmount = direction * data.price * data.volatility * Math.random();
          const oldPrice = data.price;
          data.price = Math.max(0.01, data.price + changeAmount);
          data.lastChange = changeAmount;
          const change = data.price - oldPrice;
          const changePercent = (change / oldPrice) * 100;

          updates.push({
            symbol: upperSymbol,
            price: Number(data.price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            timestamp: new Date().toISOString(),
            isSimulated: true,
            dataSource: (new Date().getDay() >= 1 && new Date().getDay() <= 5) ? "market-simulation" : "market-closed-simulation"
          });
        }
      }
    } catch (error) {
      console.error('Error updating market data:', error);
    }

    // Only send update if there are changes
    if (updates.length > 0) {
      // Check if market is open
      const marketOpen = isMarketCurrentlyOpen();
      
      // Get the primary data source being used and label it properly
      let primarySource = "yahoo";
      const realDataUpdate = updates.find(u => !u.isSimulated);
      if (realDataUpdate) {
        primarySource = realDataUpdate.dataSource;
      } else if (marketOpen) {
        primarySource = "market-simulation";
      }

      ws.send(JSON.stringify({
        type: 'market_data',
        data: updates,
        marketStatus: {
          isMarketOpen: marketOpen,
          dataSource: primarySource
        }
      }));
    }
  }, 1000); // Update every 1 second 

  // Store the interval reference
  userSimulations?.set(ws, interval);
}

/**
 * Stops the market data stream for a user's WebSocket connection
 * @param userId User ID
 * @param ws WebSocket connection to stop
 */
export function stopMarketDataStream(userId: number, ws: WebSocket): void {
  const userSimulations = marketDataSimulations.get(userId);
  if (userSimulations?.has(ws)) {
    clearInterval(userSimulations.get(ws));
    userSimulations.delete(ws);
  }
}

/**
 * Get historical market data for a symbol
 * Will try multiple providers in order of preference
 * @param userId User ID to get integrations for
 * @param symbol Stock symbol
 * @param timeframe Timeframe string (e.g., '1D', '1M')
 * @param limit Number of bars to return
 */
export async function getHistoricalMarketData(
  userId: number, 
  symbol: string, 
  timeframe: string = '1D', 
  limit: number = 100
): Promise<any> {
  try {
    // Get user's data provider integrations
    const userIntegrations = await storage.getApiIntegrationsByUser(userId);
    
    // Track all errors for better debugging
    const errors = [];
    
    // PRIORITY 1: Use Yahoo Finance as primary provider for historical data (free, no API key needed)
    try {
      console.log(`Attempting to get historical data for ${symbol} from Yahoo Finance`);
      const yahooProvider = new YahooFinanceAPI();
      const data = await yahooProvider.getHistoricalData(symbol, timeframe, String(limit));
      if (data && data.bars && data.bars.length > 0) {
        console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from Yahoo Finance`);
        return {
          ...data,
          dataSource: 'yahoo'
        };
      }
      console.log(`Yahoo Finance returned no data for ${symbol}`);
    } catch (yahooError) {
      console.error('Yahoo Finance API error:', yahooError);
      errors.push({ provider: 'yahoo', error: yahooError });
    }

    // PRIORITY 2: Try AlphaVantage (environment key)
    try {
      if (process.env.ALPHAVANTAGE_API_KEY) {
        console.log(`Attempting to get historical data for ${symbol} from AlphaVantage`);
        const alphaVantageAPI = new AlphaVantageAPI({
          id: 0,
          provider: 'alphavantage',
          type: 'data',
          userId: 0,
          accountName: 'Default AlphaVantage',
          description: 'Environment AlphaVantage API',
          isActive: true,
          isPrimary: false,
          assetClasses: ['stocks'],
          exchanges: ['NASDAQ', 'NYSE'],
          accountMode: 'paper',
          providerUserId: null,
          providerAccountId: null,
          capabilities: {
            trading: false,
            marketData: true,
            accountData: false
          },
          lastStatus: 'ok',
          lastUsed: null,
          lastError: null,
          credentials: {
            apiKey: process.env.ALPHAVANTAGE_API_KEY
          }
        });
        const data = await alphaVantageAPI.getHistoricalData(symbol, timeframe, limit);
        if (data && data.bars && data.bars.length > 0) {
          console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from AlphaVantage`);
          return {
            ...data, 
            dataSource: 'alphavantage'
          };
        }
        console.log(`AlphaVantage returned no data for ${symbol}`);
      }
    } catch (avError) {
      console.error('AlphaVantage API error:', avError);
      errors.push({ provider: 'alphavantage', error: avError });
    }

    // PRIORITY 3: Try Polygon (environment key)
    try {
      if (process.env.POLYGON_API_KEY) {
        console.log(`Attempting to get historical data for ${symbol} from Polygon`);
        const polygonAPI = new PolygonAPI({
          id: 0,
          provider: 'polygon',
          type: 'data',
          userId: 0,
          accountName: 'Default Polygon',
          description: 'Environment Polygon API',
          isActive: true,
          isPrimary: false,
          assetClasses: ['stocks'],
          exchanges: ['NASDAQ', 'NYSE'],
          accountMode: 'paper',
          providerUserId: null,
          providerAccountId: null,
          capabilities: {
            trading: false,
            marketData: true,
            accountData: false
          },
          lastStatus: 'ok',
          lastUsed: null,
          lastError: null,
          credentials: {
            apiKey: process.env.POLYGON_API_KEY
          }
        });
        const data = await polygonAPI.getHistoricalData(symbol, timeframe, limit);
        if (data && data.bars && data.bars.length > 0) {
          console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from Polygon`);
          return {
            ...data,
            dataSource: 'polygon'
          };
        }
        console.log(`Polygon returned no data for ${symbol}`);
      }
    } catch (polygonError) {
      console.error('Polygon API error:', polygonError);
      errors.push({ provider: 'polygon', error: polygonError });
    }
    
    // PRIORITY 4: Check for user-specific integrations
    
    // Try user's Polygon integration
    const polygonIntegration = userIntegrations.find(i => 
      i.provider === 'polygon' && i.type === 'data' && i.isActive);
    if (polygonIntegration) {
      try {
        console.log(`Attempting to get historical data for ${symbol} from user-specific Polygon integration`);
        const polygonAPI = new PolygonAPI(polygonIntegration);
        const data = await polygonAPI.getHistoricalData(symbol, timeframe, limit);
        if (data && data.bars && data.bars.length > 0) {
          console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from user Polygon integration`);
          return {
            ...data,
            dataSource: 'polygon-user'
          };
        }
      } catch (error) {
        console.error('User Polygon integration error:', error);
        errors.push({ provider: 'polygon-user', error });
      }
    }

    // Try user's AlphaVantage integration
    const alphaVantageIntegration = userIntegrations.find(i => 
      i.provider === 'alphavantage' && i.type === 'data' && i.isActive);
    if (alphaVantageIntegration) {
      try {
        console.log(`Attempting to get historical data for ${symbol} from user-specific AlphaVantage integration`);
        const alphaVantageAPI = new AlphaVantageAPI(alphaVantageIntegration);
        const data = await alphaVantageAPI.getHistoricalData(symbol, timeframe, limit);
        if (data && data.bars && data.bars.length > 0) {
          console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from user AlphaVantage integration`);
          return {
            ...data,
            dataSource: 'alphavantage-user'
          };
        }
      } catch (error) {
        console.error('User AlphaVantage integration error:', error);
        errors.push({ provider: 'alphavantage-user', error });
      }
    }

    // PRIORITY 5 (LAST RESORT): Try Alpaca only if previous methods failed
    // We want to minimize Alpaca usage for data to avoid hitting API limits
    const alpacaIntegration = userIntegrations.find(i => 
      i.provider === 'alpaca' && i.type === 'exchange' && i.isActive);
    if (alpacaIntegration) {
      try {
        console.log(`Attempting to get historical data for ${symbol} from Alpaca (last resort)`);
        const alpacaAPI = new AlpacaAPI(alpacaIntegration);
        const data = await alpacaAPI.getMarketData(symbol, timeframe, limit);
        if (data && data.bars && data.bars.length > 0) {
          console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from Alpaca`);
          return {
            ...data,
            dataSource: 'alpaca'
          };
        }
      } catch (error) {
        console.error('Alpaca integration error:', error);
        errors.push({ provider: 'alpaca', error });
      }
    } else if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
      try {
        console.log(`Attempting to get historical data for ${symbol} from environment Alpaca keys (last resort)`);
        const alpacaAPI = new AlpacaAPI();
        const data = await alpacaAPI.getMarketData(symbol, timeframe, limit);
        if (data && data.bars && data.bars.length > 0) {
          console.log(`Successfully retrieved ${data.bars.length} bars for ${symbol} from environment Alpaca`);
          return {
            ...data,
            dataSource: 'alpaca-env'
          };
        }
      } catch (error) {
        console.error('Environment Alpaca error:', error);
        errors.push({ provider: 'alpaca-env', error });
      }
    }

    // If we got here, all providers failed
    console.error(`All data providers failed for ${symbol}. Errors:`, errors);
    throw new Error(`Could not retrieve historical data for ${symbol} from any provider`);
  } catch (error) {
    console.error('Error getting historical market data:', error);
    throw error;
  }
}

/**
 * Helper to convert our timeframe format to Yahoo period format
 */
function timeframeToYahooPeriod(timeframe: string): string {
  switch (timeframe) {
    case '1D': return '1d';
    case '5D': return '5d';
    case '1M': return '1mo';
    case '3M': return '3mo';
    case '1Y': return '1y';
    case '5Y': return '5y';
    default: return '1mo';
  }
}

/**
 * Helper to convert our timeframe format to Yahoo interval format
 */
function timeframeToYahooInterval(timeframe: string): string {
  switch (timeframe) {
    case '1D': return '5m';   // 5-minute intervals for 1-day view
    case '5D': return '15m';  // 15-minute intervals for 5-day view
    case '1M': return '1d';   // Daily intervals for 1-month view
    case '3M': return '1d';   // Daily intervals for 3-month view
    case '1Y': return '1wk';  // Weekly intervals for 1-year view
    case '5Y': return '1mo';  // Monthly intervals for 5-year view
    default: return '1d';
  }
}

/**
 * Log detailed market data information for debugging purposes
 * @param message Log message
 * @param data Optional data to include in the log
 */
export function logMarketData(message: string, data?: any): void {
  console.log(`[MarketData] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}`);
}