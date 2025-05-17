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
export async function getScreenerData(symbols: string[], days: number = 90): Promise<Record<string, any>> {
  console.log(`ScreenerDataService: Fetching data for ${symbols.length} symbols`);
  
  // Initialize result object
  const result: Record<string, any> = {};
  
  // Get historical data directly - this is crucial for technical indicators
  // Process in small batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batchSymbols = symbols.slice(i, i + batchSize);
    
    // Process each symbol in the batch
    for (const symbol of batchSymbols) {
      try {
        console.log(`ScreenerDataService: Getting historical data for ${symbol}`);
        
        // Get historical data from Yahoo Finance - critical for technical indicators
        const historyResult = await yahooFinance.historical(symbol, {
          period1: new Date(Date.now() - days * 24 * 60 * 60 * 1000), // Use the specified number of days
          period2: new Date(),
          interval: '1d'
        });
        
        if (historyResult && historyResult.length > 0) {
          // Store the historical data in a format that our screeners can use
          const historicalData = historyResult.map(bar => ({
            date: bar.date.toISOString().split('T')[0],
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            adjClose: bar.adjClose
          }));
          
          // Also fetch the current quote for additional data
          let quote;
          try {
            quote = await yahooFinance.quote(symbol);
          } catch (e) {
            console.log(`Error getting quote for ${symbol}, using historical data only`);
          }
          
          // Store both historical and current data
          result[symbol] = {
            // Current data from quote (if available)
            price: quote?.regularMarketPrice || historicalData[historicalData.length - 1].close || 0,
            volume: quote?.regularMarketVolume || historicalData[historicalData.length - 1].volume || 0,
            company: quote?.shortName || quote?.longName || symbol,
            marketCap: quote?.marketCap || 0,
            
            // Historical data in the format expected by pandas-ta for indicator calculations
            historical: historicalData,
            
            // Additional indicator flags to help Python know what data format we have
            hasHistoricalData: "True", // String format for Python compatibility 
            dataPoints: historicalData.length,
            is_placeholder: "False" // Not using fallback data
          };
          
          console.log(`ScreenerDataService: Successfully added ${symbol} with ${historicalData.length} historical bars`);
        } else {
          console.log(`ScreenerDataService: No historical data available for ${symbol}`);
        }
      } catch (error) {
        console.error(`ScreenerDataService: Error fetching data for ${symbol}:`, error);
      }
    }
    
    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 250)); // Longer delay to avoid rate limits
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
  // Define a much larger universe of stocks for screening
  return [
    // Major indices
    "SPY", "QQQ", "DIA", "IWM",
    
    // Large tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC", "CSCO", "IBM", "ORCL", "CRM", "ADBE", "PYPL", "NFLX",
    
    // Financial
    "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "V", "MA", "BLK", "SCHW",
    
    // Consumer
    "WMT", "TGT", "COST", "HD", "LOW", "MCD", "SBUX", "KO", "PEP", "PG", "JNJ", "NKE", "LULU", "DIS", "CMCSA",
    
    // Healthcare
    "UNH", "PFE", "JNJ", "ABBV", "MRK", "BMY", "AMGN", "GILD", "MDT", "CVS",
    
    // Energy
    "XOM", "CVX", "COP", "EOG", "SLB", "PSX", "MPC",
    
    // Industrial
    "BA", "GE", "MMM", "CAT", "DE", "LMT", "RTX", "HON", "UPS", "FDX",
    
    // Other popular stocks
    "BABA", "SHOP", "SQ", "ZM", "ROKU", "UBER", "LYFT", "ABNB", "DASH", "RBLX",
    
    // Semiconductors
    "TSM", "AVGO", "QCOM", "TXN", "MU", "AMAT", "KLAC", "LRCX",
    
    // Utilities/Telecom
    "T", "VZ", "NEE", "DUK", "SO", "D", "EXC"
  ];
}