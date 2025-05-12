/**
 * Market Data Service
 * Provides access to real-time and historical market data from various providers
 */

import yahooFinance from 'yahoo-finance2';
import { WebSocketServer, WebSocket } from 'ws';
import { MarketDataProviderFactory } from './marketDataProviderInterface';
import { YahooFinanceAPI } from './yahoo';

/**
 * Get real-time quote data for a single symbol
 */
export async function getQuote(symbol: string): Promise<any> {
  try {
    console.log(`Getting quote for ${symbol}`);
    const quote = await yahooFinance.quote(symbol);
    return quote;
  } catch (error) {
    console.error(`Error getting quote for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get real-time quote data for multiple symbols
 */
export async function getQuotes(symbols: string[]): Promise<Record<string, any>> {
  try {
    console.log(`Getting quotes for ${symbols.length} symbols`);
    const quotes: Record<string, any> = {};
    
    // Process symbols in small batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchQuotes = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const quote = await yahooFinance.quote(symbol);
            return { symbol, quote };
          } catch (error) {
            console.error(`Error getting quote for ${symbol}:`, error);
            return { symbol, quote: null };
          }
        })
      );
      
      // Add batch results to quotes object
      batchQuotes.forEach(({ symbol, quote }) => {
        if (quote) {
          quotes[symbol] = quote;
        }
      });
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return quotes;
  } catch (error) {
    console.error(`Error getting quotes:`, error);
    throw error;
  }
}

/**
 * Format market data for screeners
 * Converts Yahoo Finance quotes to a format suitable for screeners
 */
export function formatMarketDataForScreeners(quotes: Record<string, any>): Record<string, any> {
  const formattedData: Record<string, any> = {};
  
  Object.entries(quotes).forEach(([symbol, quote]) => {
    if (!quote) return;
    
    formattedData[symbol] = {
      price: quote.regularMarketPrice,
      volume: quote.regularMarketVolume,
      company: quote.shortName || quote.longName || symbol,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      previousClose: quote.regularMarketPreviousClose,
      marketCap: quote.marketCap,
      is_placeholder: false
    };
  });
  
  return formattedData;
}

// Helper function to determine if US stock market is open
// US market hours are 9:30 AM to 4:00 PM Eastern Time, Monday to Friday
function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  
  // Convert to ET timezone (UTC-4 for EDT, UTC-5 for EST)
  // Simplified implementation that assumes EDT (Mar-Nov)
  const isEDT = true; // Would need more complex logic for actual DST detection
  const hour = now.getUTCHours() - (isEDT ? 4 : 5);
  const minute = now.getUTCMinutes();
  
  // Convert to minutes since midnight
  const minutesSinceMidnight = hour * 60 + minute;
  
  // Market is closed on weekends (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;
  
  // Market hours 9:30 AM (570 minutes) to 4:00 PM (960 minutes) ET
  return minutesSinceMidnight >= 570 && minutesSinceMidnight < 960;
}

// Market data streaming clients
const clients = new Map<string, WebSocket>();
let streamInterval: NodeJS.Timeout | null = null;
const DEFAULT_STREAM_INTERVAL = 60000; // 1 minute by default

/**
 * Start the market data stream for connected clients
 */
export function startMarketDataStream(wss: WebSocketServer): void {
  console.log('Starting market data stream service');
  
  wss.on('connection', (ws: WebSocket) => {
    const clientId = Math.random().toString(36).substring(2, 15);
    clients.set(clientId, ws);
    
    console.log(`New client connected: ${clientId}, total clients: ${clients.size}`);
    
    // Send initial data to client
    sendMarketData(ws);
    
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`Client disconnected: ${clientId}, remaining clients: ${clients.size}`);
      
      // If no clients are connected, we can stop the interval
      if (clients.size === 0 && streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
        console.log('Market data stream stopped - no clients connected');
      }
    });
  });
  
  // Start the interval if it's not already running
  if (!streamInterval) {
    streamInterval = setInterval(broadcastMarketData, DEFAULT_STREAM_INTERVAL);
    console.log(`Market data stream started with interval of ${DEFAULT_STREAM_INTERVAL}ms`);
  }
}

/**
 * Stop the market data stream
 */
export function stopMarketDataStream(): void {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
    console.log('Market data stream stopped');
  }
  
  // Close all client connections
  Array.from(clients.entries()).forEach(([clientId, ws]) => {
    ws.close();
    clients.delete(clientId);
  });
}

/**
 * Send market data to a specific client
 */
async function sendMarketData(ws: WebSocket): Promise<void> {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    // Use Yahoo Finance as the default data provider
    const yahooProvider = new YahooFinanceAPI();
    
    // Default market symbols to track
    const symbols = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN'];
    
    // Fetch market data
    const quotes = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const quote = await yahooProvider.getQuote(symbol);
          return { symbol, data: quote };
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
          return { symbol, data: null };
        }
      })
    );
    
    // Format and send market data
    const marketData = quotes
      .filter(quote => quote.data !== null)
      .reduce((result, { symbol, data }) => {
        result[symbol] = data;
        return result;
      }, {} as Record<string, any>);
    
    // Current market status
    const isOpen = isMarketOpen();
    
    ws.send(JSON.stringify({
      type: 'marketData',
      data: marketData,
      timestamp: new Date().toISOString(),
      marketStatus: {
        isMarketOpen: isOpen,
        dataSource: 'yahoo'  // Explicitly set the data source
      }
    }));
  } catch (error) {
    console.error('Error sending market data:', error);
  }
}

/**
 * Broadcast market data to all connected clients
 */
async function broadcastMarketData(): Promise<void> {
  if (clients.size === 0) {
    return;
  }
  
  console.log(`Broadcasting market data to ${clients.size} clients`);
  
  const entries = Array.from(clients.entries());
  for (const [clientId, ws] of entries) {
    if (ws.readyState === WebSocket.OPEN) {
      await sendMarketData(ws);
    } else {
      // Clean up closed connections
      clients.delete(clientId);
    }
  }
}

/**
 * Get historical market data
 */
export async function getHistoricalMarketData(
  symbol: string,
  interval: string = '1d',
  range: string = '1mo'
): Promise<any> {
  try {
    console.log(`Getting historical market data for ${symbol}, interval=${interval}, range=${range}`);
    
    // Use the Yahoo Finance provider
    const yahooProvider = new YahooFinanceAPI();
    
    // Fetch historical data
    const data = await yahooProvider.getHistoricalData(symbol, {
      interval, 
      range
    });
    
    return data;
  } catch (error) {
    console.error(`Error getting historical market data for ${symbol}:`, error);
    throw error;
  }
}