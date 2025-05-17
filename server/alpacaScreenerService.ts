/**
 * Alpaca Data Service for Stock Screeners
 * Provides high-quality market data for technical analysis
 */

import { AlpacaAPI } from './alpaca';
import { getDefaultScreenerSymbols } from './screenerDataService';

// Create an instance of AlpacaAPI for direct API access
const alpaca = new AlpacaAPI();

/**
 * Fetch historical price data for a list of symbols
 * This is crucial for technical indicator calculations
 * 
 * @param symbols Array of stock symbols to fetch data for
 * @param timeframe Timeframe for the data (1Day, 1Hour, etc.)
 * @param limit Number of bars to fetch
 * @returns Object with symbol keys and historical data
 */
export async function getAlpacaHistoricalData(
  symbols: string[], 
  timeframe: string = '1Day', 
  limit: number = 100
): Promise<Record<string, any>> {
  console.log(`AlpacaScreenerService: Fetching historical data for ${symbols.length} symbols`);
  
  // Initialize result object
  const result: Record<string, any> = {};
  
  // Check if we have valid credentials - Alpaca.isValid is a property, not a method
  if (!alpaca.isValid) {
    console.error("AlpacaScreenerService: Invalid Alpaca credentials - cannot fetch market data");
    throw new Error("Cannot fetch market data: Missing or invalid Alpaca API credentials");
  }

  // Process in small batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batchSymbols = symbols.slice(i, i + batchSize);
    
    for (const symbol of batchSymbols) {
      try {
        console.log(`AlpacaScreenerService: Fetching historical data for ${symbol}`);
        
        // Use the Alpaca API to get market data
        const marketData = await alpaca.getMarketData(
          symbol, 
          timeframe,
          limit,
          undefined,  // startDate - using default (will fetch enough data)
          undefined   // endDate - using default (up to latest)
        );
        
        // Process the bars if available
        if (marketData?.bars && marketData.bars.length > 0) {
          // Format the bars data for technical indicators
          const historicalData = marketData.bars.map((bar: any) => ({
            date: bar.t.split('T')[0], // Extract just the date part
            open: parseFloat(bar.o),
            high: parseFloat(bar.h),
            low: parseFloat(bar.l),
            close: parseFloat(bar.c),
            volume: parseInt(bar.v, 10),
            vw: bar.vw ? parseFloat(bar.vw) : 0
          }));
          
          // Get the latest quote for additional data
          let quote = null;
          try {
            const quoteData = await alpaca.getQuote(symbol);
            quote = quoteData.quote || null;
          } catch (e) {
            console.log(`Error getting quote for ${symbol}, using historical data only: ${e}`);
          }
          
          // Get the last bar for prices if quote fails
          const lastBar = historicalData[historicalData.length - 1];
          
          // Store both historical and current data
          result[symbol] = {
            // Current data
            price: (quote?.p || lastBar.close),
            volume: (quote?.s || lastBar.volume),
            company: symbol, // Alpaca doesn't provide company names
            
            // Historical data for technical indicators
            historical: historicalData,
            
            // Metadata
            hasHistoricalData: historicalData.length > 0 ? "True" : "False", // String format for Python compatibility
            dataPoints: historicalData.length,
            dataProvider: "alpaca",
            is_placeholder: "False" // Not using fallback data
          };
          
          console.log(`AlpacaScreenerService: Successfully added ${symbol} with ${historicalData.length} bars`);
        } else {
          console.log(`AlpacaScreenerService: No historical data available for ${symbol}`);
        }
      } catch (error) {
        console.error(`AlpacaScreenerService: Error fetching data for ${symbol}:`, error);
      }
    }
    
    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`AlpacaScreenerService: Fetched data for ${Object.keys(result).length} symbols`);
  
  return result;
}

/**
 * Get a comprehensive stock universe for screening
 * Includes a diverse set of stocks across sectors and cap sizes
 * 
 * @returns Array of stock symbols
 */
export function getExtendedStockUniverse(): string[] {
  // Use the existing function from screenerDataService
  return getDefaultScreenerSymbols();
}

/**
 * Get market data for a specific set of stocks and provide
 * properly formatted data for technical indicators
 * 
 * @param symbols Array of stock symbols to screen
 * @param days Number of days of historical data to fetch
 * @returns Formatted data for screener
 */
export async function getScreenerData(symbols: string[], days: number = 90): Promise<Record<string, any>> {
  // Calculate the appropriate limit based on desired days
  // Alpaca returns daily bars, so limit = days
  const limit = Math.max(days, 90); // Ensure at least 90 days of data for indicators
  
  // Fetch historical data using Alpaca
  return await getAlpacaHistoricalData(symbols, '1Day', limit);
}