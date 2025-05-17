/**
 * Alpaca Data Service for Stock Screeners
 * Provides high-quality market data for technical analysis
 */

import { AlpacaAPI } from './alpaca';
import { AlpacaDataProviderAdapter } from './alpacaDataProviderAdapter';

// Create an instance of AlpacaAPI for direct API access
const alpaca = new AlpacaAPI();

// Create an instance of the data provider adapter for additional functionality
const alpacaAdapter = new AlpacaDataProviderAdapter();

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
  
  // Check if we have valid credentials
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
        
        // Get the historical bars from Alpaca
        const period = '3mo'; // Equivalent to ~90 days for technical indicators
        const interval = '1d'; 

        // Try using the adapter first (more features)
        let historicalData = [];

        try {
          // Use the data provider adapter to get historical data
          const params = {
            symbols: [symbol],
            period: period,
            interval: interval,
            limit: limit,
            adjustForSplits: true,
            adjustForDividends: true
          };
          
          const adapterResult = await alpacaAdapter.getHistoricalData(params);
          
          if (adapterResult[symbol] && adapterResult[symbol].length > 0) {
            // Convert to our standardized format
            historicalData = adapterResult[symbol].map(bar => ({
              date: bar.timestamp.toISOString().split('T')[0],
              open: parseFloat(String(bar.open)),
              high: parseFloat(String(bar.high)),
              low: parseFloat(String(bar.low)),
              close: parseFloat(String(bar.close)),
              volume: parseInt(String(bar.volume), 10),
              vw: bar.vwap ? parseFloat(String(bar.vwap)) : 0
            }));
          }
        } catch (adapterError) {
          console.log(`Adapter failed for ${symbol}, trying direct API: ${adapterError}`);
          
          // Fallback to direct API call
          const marketData = await alpaca.getMarketData(symbol, timeframe, limit);
          
          if (marketData?.bars && marketData.bars.length > 0) {
            // Format the bars data
            historicalData = marketData.bars.map(bar => ({
              date: bar.t.split('T')[0], // Extract just the date part
              open: parseFloat(bar.o),
              high: parseFloat(bar.h),
              low: parseFloat(bar.l),
              close: parseFloat(bar.c),
              volume: parseInt(bar.v, 10),
              vw: bar.vw ? parseFloat(bar.vw) : 0
            }));
          }
        }
        
        // If we have historical data, add it to the result
        if (historicalData.length > 0) {
          // Get the latest quote for additional data
          let quote = null;
          try {
            quote = await alpaca.getQuote(symbol);
          } catch (e) {
            console.log(`Error getting quote for ${symbol}, using historical data only`);
          }
          
          // Get the last bar for prices if quote fails
          const lastBar = historicalData[historicalData.length - 1];
          
          // Store both historical and current data
          result[symbol] = {
            // Current data
            price: (quote?.last || lastBar.close),
            volume: (quote?.size || lastBar.volume),
            company: symbol, // Alpaca doesn't provide company names
            
            // Historical data for technical indicators
            historical: historicalData,
            
            // Metadata
            hasHistoricalData: "True", // String format for Python compatibility
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
  // Return a much larger set of symbols for screening
  return [
    // Major indices
    "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO",
    
    // Mega cap tech
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "NVDA", 
    
    // Large tech
    "AMD", "INTC", "CSCO", "IBM", "ORCL", "CRM", "ADBE", "PYPL", "NFLX", "UBER", "SHOP",
    
    // Semiconductors
    "TSM", "AVGO", "QCOM", "TXN", "MU", "AMAT", "KLAC", "LRCX", "MRVL", "ON", "ADI", "SMCI",
    
    // Financial
    "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "V", "MA", "BLK", "SCHW", "CME", "ICE",
    
    // Consumer
    "WMT", "TGT", "COST", "HD", "LOW", "MCD", "SBUX", "KO", "PEP", "DIS", "CMCSA", "NKE",
    
    // Healthcare
    "UNH", "JNJ", "PFE", "ABBV", "MRK", "BMY", "AMGN", "GILD", "MDT", "CVS", "LLY", "TMO",
    
    // Energy
    "XOM", "CVX", "COP", "EOG", "SLB", "PSX", "MPC", "OXY",
    
    // Industrial
    "BA", "GE", "MMM", "CAT", "DE", "LMT", "RTX", "HON", "UPS", "FDX", "URI",
    
    // Retail/eCommerce
    "LULU", "ETSY", "BABA", "JD", "MELI", "CHWY",
    
    // Communications
    "T", "VZ", "TMUS",
    
    // Media & Entertainment
    "NFLX", "DIS", "ROKU", "WBD", "PARA",
    
    // Social Media
    "META", "SNAP", "PINS", "TWTR",
    
    // Cloud/SaaS
    "CRM", "WDAY", "NOW", "TEAM", "ZS", "CRWD", "NET", "DDOG", "SNOW",
    
    // Utilities
    "NEE", "DUK", "SO", "D", "EXC",
    
    // Real Estate
    "AMT", "PLD", "SPG", "O", "WELL",
    
    // Transportation
    "DAL", "LUV", "UAL", "AAL", "FDX", "UPS", "UNP", "CSX",
    
    // Materials
    "FCX", "NEM", "SCCO", "NUE", "DOW", "DD"
  ];
}