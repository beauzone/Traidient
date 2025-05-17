/**
 * Enhanced Python Screener Service
 * Uses the multi-provider data service to fetch reliable market data
 * and Python for running technical analysis screeners.
 */

import { executeScreener } from './pythonExecutionService';
import { ScreenerDataService } from './screenerDataService';
import { storage } from './storage';

export class PythonScreenerService {
  private dataService: ScreenerDataService;
  
  /**
   * Initialize the Python screener service
   * @param dataService Optional ScreenerDataService instance
   */
  constructor(
    _unused?: any, // Keep for backward compatibility
    dataService?: ScreenerDataService
  ) {
    this.dataService = dataService || new ScreenerDataService();
  }
  
  /**
   * Run a screener with the provided code and symbols
   * @param code The Python screener code to execute
   * @param symbols The symbols to screen (optional, can be defined in code)
   * @param preferredProvider Preferred data provider to use
   * @returns The screener results
   */
  async runScreener(
    code: string,
    symbols: string[] = [],
    preferredProvider?: string
  ): Promise<any> {
    try {
      // Default symbols to use if none are provided
      const defaultSymbols = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD'
      ];
      
      // Use the provided symbols or fall back to defaults
      const symbolsToUse = symbols && symbols.length > 0 ? symbols : defaultSymbols;
      
      console.log(`Running screener on ${symbolsToUse.length} symbols using ${preferredProvider || 'default'} provider`);
      
      // Fetch market data using our enhanced multi-provider service
      // Use the dedicated screener data method which already handles standardization
      const marketData = await this.dataService.getScreenerData(
        symbolsToUse,
        90, // Use 90 days of data for reliable technical indicators
        preferredProvider
      );
      
      if (Object.keys(marketData).length === 0) {
        throw new Error('Failed to fetch market data from any provider');
      }
      
      // Log which provider was used
      const usedProvider = this.dataService.getLastUsedProvider() || 'Unknown';
      console.log(`Using market data from ${usedProvider} provider`);
      
      // Use the data directly as it's already standardized
      
      // Execute the Python code with the data
      const result = await executeScreener(code, marketData);
      
      // Add metadata about the screening
      const metadata = {
        timestamp: new Date().toISOString(),
        provider: usedProvider,
        symbolsRequested: symbolsToUse.length,
        symbolsRetrieved: Object.keys(marketData).length,
        missingSymbols: symbolsToUse.filter(s => !Object.keys(marketData).includes(s))
      };
      
      return {
        results: result,
        metadata
      };
    } catch (error) {
      console.error('Error running screener:', error);
      throw error;
    }
  }
  
  /**
   * Run a screener from the database by ID
   * @param screenerId The ID of the screen to run
   * @param preferredProvider Preferred data provider to use
   * @returns The screener results
   */
  async runScreenerById(screenerId: number, preferredProvider?: string): Promise<any> {
    try {
      // Fetch the screen from database
      const screen = await storage.getScreenById(screenerId);
      
      if (!screen) {
        throw new Error(`Screen with ID ${screenerId} not found`);
      }
      
      console.log(`Running screen "${screen.name}" (ID: ${screenerId})`);
      
      // Default list of popular symbols to use for screening
      const defaultSymbols = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 
        'INTC', 'JPM', 'V', 'MA', 'BAC', 'WMT', 'PG', 'KO', 'PEP', 'DIS', 
        'NFLX', 'CSCO', 'VZ', 'T', 'PFE', 'MRK', 'JNJ', 'UNH', 'HD', 'CVX',
        'XOM', 'CAT', 'BA', 'MMM', 'GE', 'F', 'GM', 'SPY', 'QQQ', 'IWM'
      ];
      
      // Use symbols from screen configuration if available, otherwise try extracting from code, 
      // or fall back to default symbols
      let symbols: string[] = [];
      
      // Check if screen has configuration with universe property
      if (screen.configuration && 
          typeof screen.configuration === 'object' && 
          screen.configuration.universe && 
          Array.isArray(screen.configuration.universe) && 
          screen.configuration.universe.length > 0) {
        console.log(`Using ${screen.configuration.universe.length} symbols from screen's configuration`);
        symbols = screen.configuration.universe;
      } else {
        try {
          const extractedSymbols = await this.extractSymbolsFromCode(screen.source?.content || '');
          if (extractedSymbols && extractedSymbols.length > 0) {
            console.log(`Found ${extractedSymbols.length} symbols in the screen code`);
            symbols = extractedSymbols;
          }
        } catch (error) {
          console.log('Error extracting symbols from code:', error);
        }
        
        // If no symbols found from universe or code, use default symbols
        if (symbols.length === 0) {
          console.log(`No symbols found in screen or code, using ${defaultSymbols.length} default symbols`);
          symbols = defaultSymbols;
        }
      }
      
      console.log(`Using ${symbols.length} symbols for screening: ${symbols.slice(0, 5).join(', ')}...`);
      
      // Run the screener with the provided source content (code)
      const content = screen.source?.content || '';
      console.log(`Screen content length: ${content.length} characters`);
      
      const result = await this.runScreener(content, symbols, preferredProvider);
      
      // Update the last run time
      await storage.updateScreenLastRun(screenerId);
      
      return result;
    } catch (error) {
      console.error(`Error running screen ID ${screenerId}:`, error);
      throw error;
    }
  }
  
  /**
   * Try to extract symbols from screener code
   * Looks for common patterns like tickers = ['AAPL', 'MSFT', ...]
   * @param code The Python code to analyze
   * @returns Array of extracted symbols
   */
  private async extractSymbolsFromCode(code: string): Promise<string[]> {
    // Look for common patterns in the code
    const tickersPattern = /tickers\s*=\s*\[([\s\S]*?)\]/;
    const symbolsPattern = /symbols\s*=\s*\[([\s\S]*?)\]/;
    const universePattern = /universe\s*=\s*\[([\s\S]*?)\]/;
    
    let match = tickersPattern.exec(code) || 
                symbolsPattern.exec(code) || 
                universePattern.exec(code);
    
    if (match && match[1]) {
      // Extract symbols from the matched array
      const symbolsText = match[1];
      
      // Split by commas and clean up each symbol
      return symbolsText
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(s => s.length > 0);
    }
    
    // If we couldn't extract symbols, fall back to a default universe
    return ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'];
  }
  
  /**
   * Get available data providers
   * @returns Array of provider names
   */
  getAvailableProviders(): string[] {
    return this.dataService.getAvailableProviders();
  }
  
  /**
   * Get all available symbols across all ready providers
   * @returns Array of symbols
   */
  getAllAvailableSymbols(): string[] {
    return this.dataService.getAllAvailableSymbols();
  }
  
  /**
   * Clear the data cache
   */
  clearCache(): void {
    this.dataService.clearCache();
  }
  
  /**
   * Get the provider that was used for the last data fetch
   * @returns The name of the last used provider or null if none used yet
   */
  getLastUsedProvider(): string | null {
    return this.dataService.getLastUsedProvider();
  }
  
  /**
   * Set the preferred order for data providers
   * @param providerOrder Array of provider names in preferred order
   * @returns Boolean indicating success or failure
   */
  setProviderOrder(providerOrder: string[]): boolean {
    return this.dataService.setProviderOrder(providerOrder);
  }
  
  /**
   * Check if a specific provider is ready for use
   * @param providerName The name of the provider to check
   * @returns Boolean indicating if the provider is ready
   */
  isProviderReady(providerName: string): boolean {
    return this.dataService.isProviderReady(providerName);
  }
  
  /**
   * Get the current provider order preference
   * @returns Array of provider names in preferred order
   */
  getProviderOrder(): string[] {
    return this.dataService.getProviderOrder();
  }
}

export default PythonScreenerService;