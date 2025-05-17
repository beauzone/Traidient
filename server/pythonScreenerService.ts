/**
 * Enhanced Python Screener Service
 * Uses the multi-provider data service to fetch reliable market data
 * and Python for running technical analysis screeners.
 */

import PythonExecutionService from './PythonExecutionService';
import { ScreenerDataService } from './screenerDataService';
import { storage } from './storage';

export class PythonScreenerService {
  private pythonExecutor: PythonExecutionService;
  private dataService: ScreenerDataService;
  
  /**
   * Initialize the Python screener service
   * @param pythonExecutor Optional PythonExecutionService instance
   * @param dataService Optional ScreenerDataService instance
   */
  constructor(
    pythonExecutor?: PythonExecutionService,
    dataService?: ScreenerDataService
  ) {
    this.pythonExecutor = pythonExecutor || new PythonExecutionService();
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
    symbols?: string[],
    preferredProvider?: string
  ): Promise<any> {
    try {
      // Get the symbols to use
      const symbolsToUse = symbols || await this.extractSymbolsFromCode(code);
      
      if (!symbolsToUse || symbolsToUse.length === 0) {
        throw new Error('No symbols provided or found in screener code');
      }
      
      console.log(`Running screener on ${symbolsToUse.length} symbols using ${preferredProvider || 'default'} provider`);
      
      // Fetch market data using our enhanced multi-provider service
      const { data, provider, missingSymbols } = await this.dataService.getDataForSymbols(
        symbolsToUse,
        preferredProvider
      );
      
      if (Object.keys(data).length === 0) {
        throw new Error('Failed to fetch market data from any provider');
      }
      
      // Log which provider was used and any missing symbols
      console.log(`Using market data from ${provider} provider`);
      if (missingSymbols.length > 0) {
        console.log(`Could not fetch data for symbols: ${missingSymbols.join(', ')}`);
      }
      
      // Standardize the data format to ensure consistent column names
      const standardizedData = this.dataService.standardizeDataFormat(data);
      
      // Execute the Python code with the data
      const result = await this.pythonExecutor.executeScreener(code, standardizedData);
      
      // Add metadata about the screening
      const metadata = {
        timestamp: new Date().toISOString(),
        provider,
        symbolsRequested: symbolsToUse.length,
        symbolsRetrieved: Object.keys(data).length,
        missingSymbols
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
      
      // Extract any symbols from the screen configuration
      let symbols: string[] = [];
      
      // If the screen has a defined universe, use that
      if (screen.universe && Array.isArray(screen.universe)) {
        symbols = screen.universe;
      }
      
      // Run the screener
      const result = await this.runScreener(screen.code, symbols, preferredProvider);
      
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
}

export default PythonScreenerService;