/**
 * Market Data Provider Interface
 * 
 * This file defines the interface for market data providers and a factory
 * to create them. It serves as an abstraction layer between the application
 * and various market data providers (Alpaca, Yahoo Finance, Polygon, etc.)
 * 
 * The enhanced interface now supports multi-asset and multi-exchange capabilities.
 */
import type { ApiIntegration } from '@shared/schema';
import { 
  AlpacaDataProviderAdapter,
  YahooFinanceDataProviderAdapter,
  PolygonDataProviderAdapter,
  AlphaVantageDataProviderAdapter,
  TiingoDataProviderAdapter
} from './marketDataProviderAdapters';
import { SnapTradeDataProviderAdapter } from './snaptradeDataProviderAdapter';

/**
 * Asset class types supported by market data providers
 */
export type AssetClass = 'stocks' | 'options' | 'futures' | 'forex' | 'crypto' | 'etf';

/**
 * Timeframe interval for historical data
 */
export type TimeInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d' | '1w' | '1mo';

/**
 * Market data request parameters with asset class and exchange support
 */
export interface MarketDataParams {
  symbols: string[];
  period?: string;
  interval?: TimeInterval;
  assetClass?: AssetClass;
  exchange?: string;
  limit?: number;
  adjustForSplits?: boolean;
  adjustForDividends?: boolean;
  extendedHours?: boolean;
  fields?: string[];
}

/**
 * Quote data interface for standardizing responses across providers
 */
export interface QuoteData {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  timestamp?: Date;
  exchange?: string;
  assetClass?: AssetClass;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
}

/**
 * Historical price bar interface
 */
export interface PriceBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

/**
 * Common interface for all market data providers
 * Enhanced to support multi-asset and multi-exchange capabilities
 */
export interface IMarketDataProvider {
  /**
   * Get historical market data for one or more symbols with enhanced parameters
   */
  getHistoricalData(
    params: MarketDataParams
  ): Promise<Record<string, PriceBar[]>>;
  
  /**
   * Get real-time quotes for one or more symbols with asset class specification
   */
  getQuote(symbol: string, assetClass?: AssetClass, exchange?: string): Promise<QuoteData>;
  
  /**
   * Get multiple quotes at once (more efficient for some providers)
   */
  getQuotes(symbols: string[], assetClass?: AssetClass, exchange?: string): Promise<Record<string, QuoteData>>;
  
  /**
   * Get a list of available symbols by asset class and exchange
   */
  getSymbolUniverse(assetClass?: AssetClass, exchange?: string, universeType?: string): Promise<string[]>;
  
  /**
   * Get available asset classes supported by this provider
   */
  getSupportedAssetClasses(): AssetClass[];
  
  /**
   * Get available exchanges supported by this provider
   */
  getSupportedExchanges(): string[];
  
  /**
   * Check if the specific market is currently open
   */
  isMarketOpen(assetClass?: AssetClass, exchange?: string): Promise<boolean>;
  
  /**
   * Get market hours info for planning trading sessions
   */
  getMarketHours(assetClass?: AssetClass, exchange?: string): Promise<{
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
    timezone: string;
  }>;
  
  /**
   * Check if the provider is valid (has necessary API keys, etc.)
   */
  isValid(): boolean;
  
  /**
   * Get the name of the provider
   */
  getName(): string;
  
  /**
   * Get provider capabilities (which features it supports)
   */
  getCapabilities(): {
    realtime: boolean;
    historicalData: boolean;
    options: boolean;
    futures: boolean;
    forex: boolean;
    crypto: boolean;
    fundamentals: boolean;
    news: boolean;
  };
}

/**
 * Provider capability configuration to determine which features each provider supports
 */
export interface ProviderCapabilities {
  realtime: boolean;
  historicalData: boolean;
  options: boolean;
  futures: boolean;
  forex: boolean;
  crypto: boolean;
  fundamentals: boolean;
  news: boolean;
  supportedAssetClasses: AssetClass[];
  supportedExchanges: string[];
}

/**
 * Provider capabilities map for each supported provider
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  'alpaca': {
    realtime: true,
    historicalData: true,
    options: false,
    futures: false,
    forex: false,
    crypto: true,
    fundamentals: false,
    news: true,
    supportedAssetClasses: ['stocks', 'crypto', 'etf'],
    supportedExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'BATS', 'IEX', 'CRYPTO']
  },
  'snaptrade': {
    realtime: true,
    historicalData: false,
    options: true,
    futures: false,
    forex: false,
    crypto: true,
    fundamentals: false,
    news: false,
    supportedAssetClasses: ['stocks', 'etf', 'options', 'crypto'],
    supportedExchanges: ['NYSE', 'NASDAQ', 'AMEX', 'TSX', 'TSXV', 'NEO', 'CSE', 'ARCA', 'BATS', 'IEX', 'CRYPTO']
  },
  'yahoo': {
    realtime: false,
    historicalData: true,
    options: true,
    futures: true,
    forex: true,
    crypto: true,
    fundamentals: true,
    news: true,
    supportedAssetClasses: ['stocks', 'options', 'futures', 'forex', 'crypto', 'etf'],
    supportedExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'BATS', 'TSXV', 'TSX', 'LSE', 'CRYPTO']
  },
  'polygon': {
    realtime: true,
    historicalData: true,
    options: true,
    futures: false,
    forex: true,
    crypto: true,
    fundamentals: true,
    news: true,
    supportedAssetClasses: ['stocks', 'options', 'forex', 'crypto', 'etf'],
    supportedExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'BATS', 'CRYPTO', 'FX']
  },
  'alphavantage': {
    realtime: false,
    historicalData: true,
    options: false,
    futures: false,
    forex: true,
    crypto: true,
    fundamentals: true,
    news: false,
    supportedAssetClasses: ['stocks', 'forex', 'crypto', 'etf'],
    supportedExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'TSX', 'CRYPTO', 'FX']
  },
  'tiingo': {
    realtime: true,
    historicalData: true,
    options: false,
    futures: false,
    forex: false,
    crypto: true,
    fundamentals: true,
    news: true,
    supportedAssetClasses: ['stocks', 'crypto', 'etf'],
    supportedExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'CRYPTO']
  }
};

/**
 * Factory to create market data providers
 * This class uses the static factory method pattern to create provider instances
 * Enhanced to support multi-asset and multi-exchange selection
 */
export class MarketDataProviderFactory {
  /**
   * Create a market data provider instance with asset class and exchange specification
   * 
   * @param provider The provider name ('alpaca', 'yahoo', 'polygon', 'alphavantage', 'tiingo')
   * @param integration Optional API integration with credentials
   * @param assetClass Optional specific asset class this provider will handle
   * @param exchange Optional specific exchange this provider will handle
   * @returns An instance of the requested market data provider
   */
  static createProvider(
    provider: string,
    integration?: ApiIntegration,
    assetClass?: AssetClass,
    exchange?: string
  ): IMarketDataProvider | null {
    // Normalize the provider name by lowercasing and removing trailing spaces and extensions like ".io"
    const normalizedProvider = provider.toLowerCase().trim().replace(/\.io\s*$/i, '');
    
    // If asset class or exchange is specified, check if the provider supports it
    if (assetClass && !this.providerSupportsAssetClass(normalizedProvider, assetClass)) {
      console.error(`Provider ${provider} does not support asset class ${assetClass}`);
      return null;
    }
    
    if (exchange && !this.providerSupportsExchange(normalizedProvider, exchange)) {
      console.error(`Provider ${provider} does not support exchange ${exchange}`);
      return null;
    }
    
    let providerInstance: IMarketDataProvider | null = null;
    
    switch (normalizedProvider) {
      case 'alpaca':
        providerInstance = new AlpacaDataProviderAdapter(integration, assetClass, exchange);
        break;
      case 'snaptrade':
        providerInstance = new SnapTradeDataProviderAdapter(integration, assetClass, exchange);
        break;
      case 'yahoo':
        providerInstance = new YahooFinanceDataProviderAdapter(assetClass, exchange);
        break;
      case 'polygon':
        providerInstance = new PolygonDataProviderAdapter(integration, assetClass, exchange);
        break;
      case 'alphavantage':
        providerInstance = new AlphaVantageDataProviderAdapter(integration, assetClass, exchange);
        break;
      case 'tiingo':
        providerInstance = new TiingoDataProviderAdapter(integration, assetClass, exchange);
        break;
      default:
        console.error(`Unknown market data provider: ${provider}`);
        return null;
    }
    
    return providerInstance;
  }
  
  /**
   * Check if a provider supports a specific asset class
   */
  static providerSupportsAssetClass(provider: string, assetClass: AssetClass): boolean {
    const capabilities = PROVIDER_CAPABILITIES[provider.toLowerCase()];
    if (!capabilities) return false;
    
    return capabilities.supportedAssetClasses.includes(assetClass);
  }
  
  /**
   * Check if a provider supports a specific exchange
   */
  static providerSupportsExchange(provider: string, exchange: string): boolean {
    const capabilities = PROVIDER_CAPABILITIES[provider.toLowerCase()];
    if (!capabilities) return false;
    
    // Normalize exchange name for comparison
    const normalizedExchange = exchange.toUpperCase().trim();
    return capabilities.supportedExchanges.includes(normalizedExchange);
  }
  
  /**
   * Get provider capabilities
   */
  static getProviderCapabilities(provider: string): ProviderCapabilities | null {
    const normalizedProvider = provider.toLowerCase().trim().replace(/\.io\s*$/i, '');
    return PROVIDER_CAPABILITIES[normalizedProvider] || null;
  }
  
  /**
   * Get all available providers with their capabilities
   */
  static getAvailableProviders(): { name: string, capabilities: ProviderCapabilities }[] {
    return Object.entries(PROVIDER_CAPABILITIES).map(([name, capabilities]) => ({
      name,
      capabilities
    }));
  }
}