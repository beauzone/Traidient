/**
 * Yahoo Finance implementation of the screener data provider
 */

import yahooFinance from 'yahoo-finance2';
import { IScreenerDataProvider } from './IScreenerDataProvider';

export class YahooFinanceProvider implements IScreenerDataProvider {
  name = 'Yahoo Finance';
  private ready = true;
  private symbols: string[];

  constructor() {
    // Define a smaller universe of reliable stocks for screening with Yahoo Finance
    this.symbols = [
      // Major indices
      "SPY", "QQQ", "DIA", 
      // Large tech
      "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", 
      // Other major stocks
      "XOM", "CVX", "JPM", "BAC", "JNJ", "WMT", "HD", "PG"
    ];
  }

  /**
   * Returns whether this provider is ready to use
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get data for the provided symbols
   * @param symbols List of stock symbols to fetch data for
   * @param days Number of historical data days to retrieve (default 90)
   */
  async getDataForSymbols(symbols: string[], days: number = 90): Promise<Record<string, any>> {
    console.log(`YahooFinanceProvider: Fetching data for ${symbols.length} symbols`);
    
    // Initialize result object
    const result: Record<string, any> = {};
    
    // Use the smaller intersection of requested symbols and our supported symbols
    const filteredSymbols = symbols.filter(s => this.symbols.includes(s));
    
    // Fetch in small batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < filteredSymbols.length; i += batchSize) {
      const batchSymbols = filteredSymbols.slice(i, i + batchSize);
      
      // Process each symbol in the batch
      for (const symbol of batchSymbols) {
        try {
          console.log(`YahooFinanceProvider: Getting historical data for ${symbol}`);
          
          // Get historical data from Yahoo Finance
          const historyResult = await yahooFinance.historical(symbol, {
            period1: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '1d'
          });
          
          if (historyResult && historyResult.length > 0) {
            // Store historical data in a format our screeners can use
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
              
              // Historical data in the format expected by pandas-ta
              historical: historicalData,
              
              // Additional indicator flags
              hasHistoricalData: "True", // String format for Python compatibility 
              dataPoints: historicalData.length,
              dataSource: "yahoo",
              is_placeholder: "False"
            };
            
            console.log(`YahooFinanceProvider: Successfully added ${symbol} with ${historicalData.length} historical bars`);
          } else {
            console.log(`YahooFinanceProvider: No historical data available for ${symbol}`);
          }
        } catch (error) {
          console.error(`YahooFinanceProvider: Error fetching data for ${symbol}:`, error);
        }
      }
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < filteredSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
      }
    }
    
    console.log(`YahooFinanceProvider: Fetched data for ${Object.keys(result).length} symbols`);
    
    return result;
  }

  /**
   * Get the list of symbols this provider supports
   */
  getAvailableSymbols(): string[] {
    return this.symbols;
  }
}