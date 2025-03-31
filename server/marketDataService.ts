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

      // Find available data providers
      const polygonIntegration = userIntegrations.find(i => 
        i.provider === 'polygon' && i.type === 'data' && i.isActive);
      const tiingoIntegration = userIntegrations.find(i => 
        i.provider === 'tiingo' && i.type === 'data' && i.isActive);
      const alpacaIntegration = userIntegrations.find(i => 
        i.provider === 'alpaca' && i.type === 'exchange' && i.isActive);

      // Initialize API clients with user's integrations
      const polygonAPI = polygonIntegration ? new PolygonAPI(polygonIntegration) : null;
      const tiingoAPI = tiingoIntegration ? new TiingoAPI(tiingoIntegration) : null;
      const alpacaAPI = alpacaIntegration ? new AlpacaAPI(alpacaIntegration) : null;


      // Get the most accurate market status information
      const isMarketOpen = isMarketCurrentlyOpen();
      console.log(`Market status: ${isMarketOpen ? 'OPEN' : 'CLOSED'}`);

      // Try to use available providers just for logging purposes, but don't change isMarketOpen
      try {
        let statusFromProvider = false;
        if (polygonAPI && polygonAPI.isValid) {
          statusFromProvider = await polygonAPI.isMarketOpen();
          console.log(`Market status from Polygon.io (for reference): ${statusFromProvider ? 'OPEN' : 'CLOSED'}`);
        } else if (alpacaAPI && alpacaAPI.isValid) {
          // Use Alpaca's market status API
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

        // Try each data provider in order of quality/reliability
        if (isMarketOpen) {
          // During market hours, try to get real-time data in priority order

          // First try Polygon.io (best quality real-time data)
          if (polygonAPI && polygonAPI.isValid) {
            try {
              quoteData = await polygonAPI.getQuote(upperSymbol);
              if (quoteData && quoteData.price) {
                dataSource = "polygon";
                console.log(`Got real Polygon.io data for ${upperSymbol}: ${quoteData.price}`);
              }
            } catch (err) {
              console.log(`Polygon.io API error for ${upperSymbol}, trying next provider`);
            }
          }

          // If Polygon failed, try Tiingo
          if (!quoteData && tiingoAPI && tiingoAPI.isValid) {
            try {
              quoteData = await tiingoAPI.getQuote(upperSymbol);
              if (quoteData && quoteData.price) {
                dataSource = "tiingo";
                console.log(`Got real Tiingo data for ${upperSymbol}: ${quoteData.price}`);
              }
            } catch (err) {
              console.log(`Tiingo API error for ${upperSymbol}, trying next provider`);
            }
          }
        }

        // If market is closed or all real-time providers failed, use Yahoo Finance
        if (!quoteData) {
          try {
            quoteData = await yahooFinance.getQuote(upperSymbol);
            if (quoteData && quoteData.price) {
              dataSource = "yahoo";
              console.log(`Got Yahoo Finance data for ${upperSymbol}: ${quoteData.price}`);
            }
          } catch (err) {
            console.log(`Yahoo Finance API error for ${upperSymbol}, falling back to simulation`);
          }
        }

        // Add the data to updates if we got it
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
          // Fall back to simulation for this symbol
          const data = priceData.get(upperSymbol);
          if (!data) continue;

          // Simulate price movement
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
      console.log(`Market status: ${marketOpen ? 'OPEN' : 'CLOSED'}`);

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

    // Try Yahoo Finance first for historical data
    try {
      const yahooProvider = new YahooFinanceAPI();
      const data = await yahooProvider.getHistoricalData(symbol, timeframe, String(limit));
      if (data && data.bars && data.bars.length > 0) {
        return {
          ...data,
          dataSource: 'yahoo'
        };
      }
    } catch (yahooError) {
      console.log('Yahoo Finance API error, falling back to Tiingo:', yahooError);
    }

    // Fallback to Tiingo
    const tiingoIntegration = userIntegrations.find(i => 
      i.provider === 'tiingo' && i.type === 'data' && i.isActive);

    if (tiingoIntegration) {
      const tiingoAPI = new TiingoAPI(tiingoIntegration);
      const data = await tiingoAPI.getHistoricalData(symbol, timeframe, limit);
      if (data && data.bars && data.bars.length > 0) {
        return {
          ...data,
          dataSource: 'tiingo'
        };
      }
    }


    //Fallback to Alpaca
    const alpacaIntegration = userIntegrations.find(i => 
      i.provider === 'alpaca' && i.type === 'exchange' && i.isActive);
    if (alpacaIntegration) {
      const alpacaAPI = new AlpacaAPI(alpacaIntegration);
      const data = await alpacaAPI.getMarketData(symbol, timeframe, limit);
      if (data && data.bars && data.bars.length > 0) {
        return {
          ...data,
          dataSource: 'alpaca'
        };
      }
    }

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