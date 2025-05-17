/**
 * Interface for screener data providers
 */

export interface IScreenerDataProvider {
  /**
   * Provider name for display and reference
   */
  name: string;
  
  /**
   * Check if this provider is ready to use
   */
  isReady(): boolean;
  
  /**
   * Fetch historical and quote data for a list of symbols
   * @param symbols List of stock symbols to fetch data for
   * @param days Number of historical data days to retrieve
   */
  getDataForSymbols(symbols: string[], days?: number): Promise<Record<string, any>>;
  
  /**
   * Get a list of stock symbols that this provider can provide data for
   * Could be a fixed universe or dynamically determined
   */
  getAvailableSymbols(): string[];
}