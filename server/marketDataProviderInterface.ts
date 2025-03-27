/**
 * Market Data Provider Interface
 * 
 * This file defines the interface for market data providers and a factory
 * to create them. It serves as an abstraction layer between the application
 * and various market data providers (Alpaca, Yahoo Finance, Polygon, etc.)
 */
import type { ApiIntegration } from '@shared/schema';
import { 
  AlpacaDataProviderAdapter,
  YahooFinanceDataProviderAdapter,
  PolygonDataProviderAdapter,
  AlphaVantageDataProviderAdapter,
  TiingoDataProviderAdapter
} from './marketDataProviderAdapters';

/**
 * Common interface for all market data providers
 */
export interface IMarketDataProvider {
  /**
   * Get historical market data for one or more symbols
   */
  getHistoricalData(
    symbols: string[], 
    period?: string, 
    interval?: string
  ): Promise<Record<string, any>>;
  
  /**
   * Get real-time quotes for one or more symbols
   */
  getQuote(symbol: string): Promise<any>;
  
  /**
   * Get a list of available stock symbols
   */
  getStockUniverse(universeType?: string): Promise<string[]>;
  
  /**
   * Check if the market is currently open
   */
  isMarketOpen(): Promise<boolean>;
  
  /**
   * Check if the provider is valid (has necessary API keys, etc.)
   */
  isValid(): boolean;
  
  /**
   * Get the name of the provider
   */
  getName(): string;
}

/**
 * Factory to create market data providers
 * This class uses the static factory method pattern to create provider instances
 */
export class MarketDataProviderFactory {
  /**
   * Create a market data provider instance
   * 
   * @param provider The provider name ('alpaca', 'yahoo', 'polygon', 'alphavantage', 'tiingo')
   * @param integration Optional API integration with credentials
   * @returns An instance of the requested market data provider
   */
  static createProvider(
    provider: string,
    integration?: ApiIntegration
  ): IMarketDataProvider | null {
    switch (provider.toLowerCase()) {
      case 'alpaca':
        return new AlpacaDataProviderAdapter(integration);
      case 'yahoo':
        return new YahooFinanceDataProviderAdapter();
      case 'polygon':
        return new PolygonDataProviderAdapter(integration);
      case 'alphavantage':
        return new AlphaVantageDataProviderAdapter(integration);
      case 'tiingo':
        return new TiingoDataProviderAdapter(integration);
      default:
        console.error(`Unknown market data provider: ${provider}`);
        return null;
    }
  }
}