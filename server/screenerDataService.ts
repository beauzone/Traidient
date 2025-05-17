/**
 * Enhanced Screener Data Service with multi-provider support
 * This service coordinates between multiple data providers and implements
 * fallback strategies when primary providers fail or hit rate limits.
 */

import { IScreenerDataProvider } from './providers/IScreenerDataProvider';
import { AlpacaProvider } from './providers/AlpacaProvider';
import { TiingoProvider } from './providers/TiingoProvider';
import { YahooFinanceProvider } from './providers/YahooFinanceProvider';

/**
 * Configuration options for the screener data service
 */
export interface ScreenerDataServiceOptions {
  /**
   * Preferred provider order (will try in sequence until one works)
   */
  providerOrder?: string[];
  
  /**
   * Whether to enable caching (default: true)
   */
  enableCaching?: boolean;
  
  /**
   * Cache TTL in milliseconds (default: 15 minutes)
   */
  cacheTtl?: number;
}

/**
 * Get a list of default stock symbols for screeners
 * @returns Array of default stock symbols
 */
export function getDefaultScreenerSymbols(): string[] {
  return [
    'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META',
    'TSLA', 'NVDA', 'JPM', 'V', 'JNJ',
    'PG', 'UNH', 'HD', 'BAC', 'MA',
    'DIS', 'PYPL', 'NFLX', 'ADBE', 'CRM',
    'INTC', 'VZ', 'T', 'PFE', 'MRK'
  ];
}

export class ScreenerDataService {
  private providers: Map<string, IScreenerDataProvider> = new Map();
  private dataCache: Map<string, { data: any, timestamp: number }> = new Map();
  private options: ScreenerDataServiceOptions;
  private defaultProviderOrder: string[] = ['Alpaca', 'Tiingo', 'Yahoo Finance'];
  private cacheEnabled: boolean = true;
  private cacheTtl: number = 15 * 60 * 1000; // 15 minutes by default

  /**
   * Initialize the screener data service
   * @param options Configuration options
   */
  constructor(options: ScreenerDataServiceOptions = {}) {
    this.options = options;
    
    // Configure caching
    this.cacheEnabled = options.enableCaching !== false;
    if (options.cacheTtl) {
      this.cacheTtl = options.cacheTtl;
    }
    
    // Initialize providers
    this.registerProviders();
  }

  /**
   * Register all available data providers
   */
  private registerProviders() {
    // Register the available providers
    const alpacaProvider = new AlpacaProvider();
    const tiingoProvider = new TiingoProvider();
    const yahooProvider = new YahooFinanceProvider();
    
    this.providers.set('Alpaca', alpacaProvider);
    this.providers.set('Tiingo', tiingoProvider);
    this.providers.set('Yahoo Finance', yahooProvider);
    
    console.log(`Registered ${this.providers.size} data providers for screener service`);
  }

  /**
   * Get a list of available providers
   * @returns Array of provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get a specific provider by name
   * @param name Provider name
   * @returns The provider instance or undefined if not found
   */
  getProvider(name: string): IScreenerDataProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a specific provider is ready
   * @param name Provider name
   * @returns Boolean indicating if the provider is available and ready
   */
  isProviderReady(name: string): boolean {
    const provider = this.providers.get(name);
    return provider ? provider.isReady() : false;
  }

  /**
   * Get data for the requested symbols
   * Attempts to use providers in order of preference until successful
   * @param symbols List of stock symbols to fetch data for
   * @param preferredProvider Optional preferred provider name
   * @param days Number of historical data days to retrieve
   * @returns Data for the requested symbols
   */
  async getDataForSymbols(
    symbols: string[],
    preferredProvider?: string,
    days: number = 90
  ): Promise<{
    data: Record<string, any>;
    provider: string;
    missingSymbols: string[];
  }> {
    if (!symbols || symbols.length === 0) {
      return { data: {}, provider: 'none', missingSymbols: [] };
    }
    
    // Normalize symbols to uppercase
    const normalizedSymbols = symbols.map(s => s.toUpperCase());
    
    // Check cache first if enabled
    if (this.cacheEnabled) {
      const cacheKey = `${normalizedSymbols.join(',')}_${days}`;
      const cachedItem = this.dataCache.get(cacheKey);
      
      if (cachedItem && (Date.now() - cachedItem.timestamp) < this.cacheTtl) {
        console.log(`Using cached data for ${normalizedSymbols.length} symbols`);
        return cachedItem.data;
      }
    }
    
    // Determine provider order
    let providerOrder = this.options.providerOrder || this.defaultProviderOrder;
    
    // If preferred provider is specified, try it first
    if (preferredProvider && this.providers.has(preferredProvider)) {
      providerOrder = [
        preferredProvider,
        ...providerOrder.filter(p => p !== preferredProvider)
      ];
    }
    
    // Try each provider in order
    let result: Record<string, any> = {};
    let successfulProvider = 'none';
    let missingSymbols = [...normalizedSymbols];
    
    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      
      if (!provider || !provider.isReady()) {
        console.log(`Provider ${providerName} not available or ready, skipping`);
        continue;
      }
      
      try {
        console.log(`Attempting to fetch data for ${missingSymbols.length} symbols from ${providerName}`);
        const providerData = await provider.getDataForSymbols(missingSymbols, days);
        const retrievedSymbols = Object.keys(providerData);
        
        // Merge with existing result
        result = { ...result, ...providerData };
        
        // Update missing symbols list
        missingSymbols = missingSymbols.filter(symbol => !retrievedSymbols.includes(symbol));
        
        // If we got some data, consider this provider successful
        if (retrievedSymbols.length > 0) {
          successfulProvider = providerName;
          console.log(`Successfully retrieved ${retrievedSymbols.length} symbols from ${providerName}`);
          
          // If all symbols retrieved, we're done
          if (missingSymbols.length === 0) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error fetching data from ${providerName}:`, error);
      }
    }
    
    // Cache the result if enabled and we found any data
    if (this.cacheEnabled && Object.keys(result).length > 0) {
      const cacheKey = `${normalizedSymbols.join(',')}_${days}`;
      const cacheData = { 
        data: { data: result, provider: successfulProvider, missingSymbols }, 
        timestamp: Date.now() 
      };
      this.dataCache.set(cacheKey, cacheData);
    }
    
    return { data: result, provider: successfulProvider, missingSymbols };
  }

  /**
   * Clear the data cache
   */
  clearCache(): void {
    this.dataCache.clear();
    console.log('Screener data cache cleared');
  }

  /**
   * Get all available symbols across all ready providers
   * @returns Array of symbols
   */
  getAllAvailableSymbols(): string[] {
    const allSymbols = new Set<string>();
    
    // Fixed issue with iterator by manually iterating
    this.providers.forEach(provider => {
      if (provider.isReady()) {
        provider.getAvailableSymbols().forEach((symbol: string) => allSymbols.add(symbol));
      }
    });
    
    return Array.from(allSymbols);
  }
  
  /**
   * Get screener data for the requested symbols
   * This is the main method to use when you need data for Python screeners
   * @param symbols List of stock symbols
   * @param days Number of days of historical data (default: 365)
   * @param preferredProvider Optional preferred data provider
   * @returns Standardized data for the screener
   */
  async getScreenerData(
    symbols: string[] = getDefaultScreenerSymbols(),
    days: number = 365,
    preferredProvider?: string
  ): Promise<Record<string, any>> {
    const data = await this.getDataForSymbols(symbols, preferredProvider, days);
    return this.standardizeDataFormat(data);
  }
  
  /**
   * Standardize column names in the data to ensure consistency
   * This ensures that no matter which provider was used, the column names
   * are consistent for technical analysis libraries
   * @param data The stock data to standardize
   * @returns Standardized data
   */
  standardizeDataFormat(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Process each symbol
    for (const [symbol, symbolData] of Object.entries(data)) {
      // If there's no historical data, skip this symbol
      if (!symbolData.historical || !Array.isArray(symbolData.historical)) {
        result[symbol] = symbolData;
        continue;
      }
      
      // Standardize column names in historical data
      const standardizedHistorical = symbolData.historical.map((bar: any) => {
        // Create a new bar with standardized column names
        const standardizedBar = { ...bar };
        
        // Handle various column name possibilities
        if ('Close' in bar && !('close' in bar)) {
          standardizedBar.close = bar.Close;
        }
        if ('Open' in bar && !('open' in bar)) {
          standardizedBar.open = bar.Open;
        }
        if ('High' in bar && !('high' in bar)) {
          standardizedBar.high = bar.High;
        }
        if ('Low' in bar && !('low' in bar)) {
          standardizedBar.low = bar.Low;
        }
        if ('Volume' in bar && !('volume' in bar)) {
          standardizedBar.volume = bar.Volume;
        }
        if ('AdjClose' in bar && !('adjClose' in bar)) {
          standardizedBar.adjClose = bar.AdjClose;
        }
        if ('Date' in bar && !('date' in bar)) {
          standardizedBar.date = bar.Date;
        }
        
        return standardizedBar;
      });
      
      // Update the historical data with standardized bars
      result[symbol] = {
        ...symbolData,
        historical: standardizedHistorical
      };
    }
    
    return result;
  }
}

export default ScreenerDataService;