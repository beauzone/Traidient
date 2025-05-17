/**
 * Tiingo implementation of the screener data provider
 */

import { IScreenerDataProvider } from './IScreenerDataProvider';
import TiingoAPI from '../tiingo';
import { storage } from '../storage';
import { ApiIntegration } from '@shared/schema';

export class TiingoProvider implements IScreenerDataProvider {
  name = 'Tiingo';
  private tiingo: TiingoAPI | null = null;
  private ready = false;
  
  // Define a manageable stock universe for reliable screening
  private symbols = [
    "SPY", "QQQ", "DIA", "IWM",
    "AAPL", "MSFT", "GOOG", "AMZN", "META", "TSLA", "NVDA", 
    "JPM", "BAC", "GS", 
    "WMT", "HD", "JNJ", "PG", 
    "XOM", "CVX", 
    "BA", "CAT", "MMM"
  ];

  constructor() {
    this.initializeTiingo();
  }

  private async initializeTiingo() {
    try {
      // First try to use integration from the database
      const integrations = await storage.getApiIntegrations();
      const tiingoIntegrations = integrations.filter((i: ApiIntegration) => i.provider === 'Tiingo');
      
      if (tiingoIntegrations && tiingoIntegrations.length > 0) {
        // Find the first active integration
        const integration = tiingoIntegrations.find((i: ApiIntegration) => i.isActive);
        if (integration) {
          this.tiingo = new TiingoAPI(integration);
          this.ready = this.tiingo.isValid;
          console.log(`TiingoProvider: Initialized with user's API key, valid: ${this.ready}`);
          return;
        }
      }
      
      // Fall back to environment variables
      if (process.env.TIINGO_API_KEY) {
        const credentials = {
          apiKey: process.env.TIINGO_API_KEY
        };
        this.tiingo = new TiingoAPI({ credentials } as any);
        this.ready = this.tiingo.isValid;
        console.log(`TiingoProvider: Initialized with environment variables, valid: ${this.ready}`);
        return;
      }
      
      console.warn('TiingoProvider: No valid API credentials found');
      this.ready = false;
    } catch (error) {
      console.error('TiingoProvider: Error initializing Tiingo API:', error);
      this.ready = false;
    }
  }

  /**
   * Returns whether this provider is ready to use
   */
  isReady(): boolean {
    return this.ready && !!this.tiingo;
  }

  /**
   * Get data for the provided symbols
   * @param symbols List of stock symbols to fetch data for
   * @param days Number of historical data days to retrieve (default 90)
   */
  async getDataForSymbols(symbols: string[], days: number = 90): Promise<Record<string, any>> {
    if (!this.isReady()) {
      throw new Error('Tiingo provider is not properly initialized with valid API key');
    }
    
    console.log(`TiingoProvider: Fetching data for ${symbols.length} symbols`);
    
    // Initialize result object
    const result: Record<string, any> = {};
    
    // Use the smaller intersection of requested symbols and our supported symbols
    const filteredSymbols = symbols.filter(s => this.symbols.includes(s));
    
    // Process symbols one by one (Tiingo doesn't have a multi-symbol endpoint)
    for (const symbol of filteredSymbols) {
      try {
        console.log(`TiingoProvider: Getting historical data for ${symbol}`);
        
        // Get historical data
        const timeframe = days <= 50 ? '1D' : 
                         days <= 200 ? '1M' : '1Y';
        const historicalData = await this.tiingo!.getHistoricalData(symbol, timeframe, days);
        
        if (historicalData && historicalData.bars && historicalData.bars.length > 0) {
          // Transform bars to the format our screeners expect
          const formattedBars = historicalData.bars.map(bar => ({
            date: new Date(bar.t).toISOString().split('T')[0],
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
            adjClose: bar.c // Tiingo may not provide adjusted close in all timeframes
          }));
          
          // Get latest quote
          const quote = await this.tiingo!.getQuote(symbol);
          
          result[symbol] = {
            // Current data
            price: quote?.price || formattedBars[formattedBars.length - 1].close || 0,
            volume: quote?.volume || formattedBars[formattedBars.length - 1].volume || 0,
            company: quote?.name || symbol,
            
            // Historical data in format expected by pandas-ta
            historical: formattedBars,
            
            // Additional indicator flags 
            hasHistoricalData: "True", 
            dataPoints: formattedBars.length,
            dataSource: "tiingo",
            is_placeholder: "False"
          };
          
          console.log(`TiingoProvider: Successfully added ${symbol} with ${formattedBars.length} historical bars`);
        } else {
          console.log(`TiingoProvider: No historical data available for ${symbol}`);
        }
        
        // Add a small delay between API calls to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`TiingoProvider: Error fetching data for ${symbol}:`, error);
      }
    }
    
    console.log(`TiingoProvider: Fetched data for ${Object.keys(result).length} symbols`);
    
    return result;
  }

  /**
   * Get the list of symbols this provider supports
   */
  getAvailableSymbols(): string[] {
    return this.symbols;
  }
}