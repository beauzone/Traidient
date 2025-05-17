/**
 * Alpaca implementation of the screener data provider
 */

import { IScreenerDataProvider } from './IScreenerDataProvider';
import { AlpacaAPI } from '../alpaca';
import { storage } from '../storage';
import { ApiIntegration } from '@shared/schema';

export class AlpacaProvider implements IScreenerDataProvider {
  name = 'Alpaca';
  private alpaca: AlpacaAPI | null = null;
  private ready = false;
  
  // Define a manageable stock universe for reliable screening
  private symbols = [
    "SPY", "QQQ", "DIA", "IWM",
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", 
    "JPM", "BAC", "GS", 
    "WMT", "HD", "JNJ", "PG", 
    "XOM", "CVX", 
    "BA", "CAT", "MMM"
  ];

  constructor() {
    this.initializeAlpaca();
  }

  private async initializeAlpaca() {
    try {
      // First try to use integration from the database
      const integrations = await storage.getApiIntegrations();
      const alpacaIntegrations = integrations.filter((i: ApiIntegration) => i.provider === 'Alpaca');
      
      if (alpacaIntegrations && alpacaIntegrations.length > 0) {
        // Find the first active integration
        const integration = alpacaIntegrations.find((i: ApiIntegration) => i.isActive);
        if (integration) {
          this.alpaca = new AlpacaAPI(integration);
          this.ready = this.alpaca.isValid;
          console.log(`AlpacaProvider: Initialized with user's API key, valid: ${this.ready}`);
          return;
        }
      }
      
      // Fall back to environment variables
      if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
        const credentials = {
          apiKey: process.env.ALPACA_API_KEY,
          apiSecret: process.env.ALPACA_API_SECRET
        };
        this.alpaca = new AlpacaAPI({ credentials } as any);
        this.ready = this.alpaca.isValid;
        console.log(`AlpacaProvider: Initialized with environment variables, valid: ${this.ready}`);
        return;
      }
      
      console.warn('AlpacaProvider: No valid API credentials found');
      this.ready = false;
    } catch (error) {
      console.error('AlpacaProvider: Error initializing Alpaca API:', error);
      this.ready = false;
    }
  }

  /**
   * Returns whether this provider is ready to use
   */
  isReady(): boolean {
    return this.ready && !!this.alpaca;
  }

  /**
   * Get data for the provided symbols
   * @param symbols List of stock symbols to fetch data for
   * @param days Number of historical data days to retrieve (default 90)
   */
  async getDataForSymbols(symbols: string[], days: number = 90): Promise<Record<string, any>> {
    if (!this.isReady()) {
      throw new Error('Alpaca provider is not properly initialized with valid API key');
    }
    
    console.log(`AlpacaProvider: Fetching data for ${symbols.length} symbols`);
    
    // Initialize result object
    const result: Record<string, any> = {};
    
    // Use the smaller intersection of requested symbols and our supported symbols
    const filteredSymbols = symbols.filter(s => this.symbols.includes(s));
    
    try {
      // Fetch historical bars for all symbols
      const barsResponse = await this.alpaca!.getMultiBars(
        filteredSymbols, 
        days > 100 ? '1D' : 'day', 
        { limit: days }
      );
      
      // Convert to our expected format
      for (const symbol of filteredSymbols) {
        try {
          console.log(`AlpacaProvider: Processing data for ${symbol}`);
          
          // Get bars for this symbol
          const symbolBars = barsResponse[symbol];
          
          if (symbolBars && symbolBars.length > 0) {
            // Transform bars to consistent format
            const historicalData = symbolBars.map(bar => ({
              date: new Date(bar.t).toISOString().split('T')[0],
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              adjClose: bar.c // Alpaca doesn't provide adjusted close, so use regular close
            }));
            
            // Get latest quote
            const quote = await this.alpaca!.getQuote(symbol);
            
            result[symbol] = {
              // Current data
              price: quote?.price || historicalData[historicalData.length - 1].close || 0,
              volume: quote?.volume || historicalData[historicalData.length - 1].volume || 0,
              company: symbol, // Alpaca doesn't provide company name
              
              // Historical data for indicators
              historical: historicalData,
              
              // Additional indicator flags 
              hasHistoricalData: "True",
              dataPoints: historicalData.length,
              dataSource: "alpaca",
              is_placeholder: "False"
            };
            
            console.log(`AlpacaProvider: Successfully added ${symbol} with ${historicalData.length} historical bars`);
          } else {
            console.log(`AlpacaProvider: No historical data available for ${symbol}`);
          }
        } catch (error) {
          console.error(`AlpacaProvider: Error processing data for ${symbol}:`, error);
        }
      }
      
      console.log(`AlpacaProvider: Fetched data for ${Object.keys(result).length} symbols`);
      
    } catch (error) {
      console.error('AlpacaProvider: Error fetching multi-bar data:', error);
    }
    
    return result;
  }

  /**
   * Get the list of symbols this provider supports
   */
  getAvailableSymbols(): string[] {
    return this.symbols;
  }
}