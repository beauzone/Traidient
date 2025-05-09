/**
 * Screener Data Service - simplified data provider for stock screeners
 * Focused on reliable fetching of stock prices for screeners
 */

import yahooFinance from 'yahoo-finance2';

/**
 * Fetch market data for screeners - using a direct, reliable approach
 * @param symbols List of stock symbols to fetch data for
 * @returns An object mapping symbols to their data
 */
export async function getScreenerData(symbols: string[]): Promise<Record<string, any>> {
  console.log(`ScreenerDataService: Fetching data for ${symbols.length} symbols`);
  
  // Initialize result object
  const result: Record<string, any> = {};
  
  // Process in small batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batchSymbols = symbols.slice(i, i + batchSize);
    
    // Process each symbol in the batch
    for (const symbol of batchSymbols) {
      try {
        console.log(`ScreenerDataService: Getting quote for ${symbol}`);
        
        // Get quote from Yahoo Finance
        const quote = await yahooFinance.quote(symbol);
        
        if (quote) {
          // Create a data record with essential fields for screeners
          // IMPORTANT: Python uses 'False' (uppercase) while JS uses 'false' (lowercase)
          // Using string for boolean values to avoid Python/JS syntax conflicts
          result[symbol] = {
            price: quote.regularMarketPrice || quote.regularMarketPreviousClose || 0,
            volume: quote.regularMarketVolume || 0,
            company: quote.shortName || quote.longName || symbol,
            open: quote.regularMarketOpen || 0,
            high: quote.regularMarketDayHigh || 0,
            low: quote.regularMarketDayLow || 0,
            previousClose: quote.regularMarketPreviousClose || 0,
            marketCap: quote.marketCap || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            is_placeholder: "False" // Using string to avoid Python syntax errors
          };
          
          console.log(`ScreenerDataService: Successfully added ${symbol} with price $${result[symbol].price}`);
        } else {
          console.log(`ScreenerDataService: No data available for ${symbol}`);
        }
      } catch (error) {
        console.error(`ScreenerDataService: Error fetching data for ${symbol}:`, error);
      }
    }
    
    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`ScreenerDataService: Fetched data for ${Object.keys(result).length} symbols`);
  
  // If we couldn't get any data at all, explain the situation
  if (Object.keys(result).length === 0) {
    console.error(`ScreenerDataService: Failed to fetch any market data - this is a critical error!`);
    throw new Error("Failed to fetch any market data for screeners");
  }
  
  return result;
}

/**
 * Get a fixed list of symbols for testing screeners
 * Includes major indices, tech stocks, and other popular tickers
 */
export function getDefaultScreenerSymbols(): string[] {
  return [
    // Major indices
    "SPY", "QQQ", "DIA", "IWM",
    
    // Large tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA",
    
    // Various sectors
    "JPM", "BAC", "WMT", "PG", "JNJ", "PFE", "XOM", "BA", "DIS"
  ];
}