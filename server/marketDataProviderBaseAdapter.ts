/**
 * Market Data Provider Base Adapter
 * 
 * This file implements a base adapter class that all specific provider adapters inherit from
 * to conform to the enhanced IMarketDataProvider interface.
 * 
 * The base adapter provides default implementations for the new methods required by
 * the enhanced interface while allowing specific adapters to override as needed.
 */
import { 
  IMarketDataProvider, 
  AssetClass, 
  QuoteData, 
  PriceBar, 
  MarketDataParams, 
  PROVIDER_CAPABILITIES
} from './marketDataProviderInterface';
import type { ApiIntegration } from '@shared/schema';

/**
 * Base class for market data provider adapters with enhanced multi-asset and multi-exchange support
 */
export abstract class BaseMarketDataProviderAdapter implements IMarketDataProvider {
  protected provider: any;
  protected name: string;
  protected assetClass?: AssetClass;
  protected exchange?: string;
  protected apiIntegration?: ApiIntegration;
  
  constructor(name: string, apiIntegration?: ApiIntegration, assetClass?: AssetClass, exchange?: string) {
    this.name = name;
    this.assetClass = assetClass;
    this.exchange = exchange;
    this.apiIntegration = apiIntegration;
  }
  
  /**
   * Get historical market data for the given symbols
   * 
   * Legacy method to be overridden by provider-specific adapters
   */
  abstract getHistoricalData(symbols: string[], period?: string, interval?: string): Promise<Record<string, any>>;
  
  /**
   * Enhanced historical data method that uses MarketDataParams
   * By default, calls the legacy method but can be overridden by provider-specific adapters
   */
  async getHistoricalData(params: MarketDataParams): Promise<Record<string, PriceBar[]>> {
    // This method signature overload calls the legacy method and converts the result to the new format
    if ("symbols" in params) {
      const symbols = params.symbols;
      const period = params.period || '1mo';
      const interval = params.interval || '1d';
      
      try {
        // Call the legacy method (to be implemented by specific adapters)
        const legacyResult = await this.getHistoricalData(symbols, period, interval.toString());
        
        // Convert the legacy result to the new PriceBar[] format
        const result: Record<string, PriceBar[]> = {};
        
        for (const symbol in legacyResult) {
          if (legacyResult[symbol]) {
            // Here we just create a simple wrapper assuming the legacy data has the right format
            // Specific adapters should override this method to do proper conversion
            result[symbol] = legacyResult[symbol].map((bar: any) => ({
              timestamp: new Date(bar.t || bar.timestamp || bar.date),
              open: bar.o || bar.open,
              high: bar.h || bar.high,
              low: bar.l || bar.low,
              close: bar.c || bar.close,
              volume: bar.v || bar.volume || 0,
              vwap: bar.vw || bar.vwap,
              trades: bar.n || bar.trades
            }));
          }
        }
        
        return result;
      } catch (error) {
        console.error(`Error fetching historical data for ${params.symbols.join(',')}:`, error);
        return {};
      }
    }
    
    return {};
  }
  
  /**
   * Get a real-time quote for a symbol
   * 
   * Legacy method to be overridden by provider-specific adapters
   */
  abstract getQuote(symbol: string): Promise<any>;
  
  /**
   * Enhanced quote method with asset class and exchange specification
   * By default, calls the legacy method but can be overridden by provider-specific adapters
   */
  async getQuote(symbol: string, assetClass?: AssetClass, exchange?: string): Promise<QuoteData> {
    try {
      // Use the specified asset class and exchange, or fall back to the instance defaults
      const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
      const effectiveExchange = exchange || this.exchange;
      
      // Call the legacy getQuote method
      const quote = await this.getQuote(symbol);
      
      // Convert to standardized format
      return {
        symbol,
        price: quote.price || quote.lastPrice || quote.last || quote.c || quote.close || 0,
        change: quote.change || quote.priceChange || quote.net_change || 0,
        changePercent: quote.changePercent || quote.percentChange || quote.net_change_percentage || 0,
        bid: quote.bid || quote.bidPrice || 0,
        ask: quote.ask || quote.askPrice || 0,
        volume: quote.volume || quote.vol || 0,
        timestamp: new Date(quote.timestamp || quote.updated || Date.now()),
        exchange: effectiveExchange,
        assetClass: effectiveAssetClass,
        open: quote.open || quote.o || 0,
        high: quote.high || quote.h || 0,
        low: quote.low || quote.l || 0,
        previousClose: quote.previousClose || quote.prevClose || 0
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return {
        symbol,
        price: 0,
        timestamp: new Date(),
        assetClass: assetClass || this.assetClass || 'stocks',
        exchange: exchange || this.exchange
      };
    }
  }
  
  /**
   * Get multiple quotes at once
   * Default implementation calls getQuote for each symbol, but providers can optimize
   */
  async getQuotes(symbols: string[], assetClass?: AssetClass, exchange?: string): Promise<Record<string, QuoteData>> {
    const result: Record<string, QuoteData> = {};
    
    for (const symbol of symbols) {
      try {
        result[symbol] = await this.getQuote(symbol, assetClass, exchange);
      } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Get a list of available stock symbols
   * 
   * Legacy method to be overridden by provider-specific adapters
   */
  abstract getStockUniverse(universeType?: string): Promise<string[]>;
  
  /**
   * Enhanced symbol universe method with asset class and exchange specification
   * By default, calls the legacy method but can be overridden by provider-specific adapters
   */
  async getSymbolUniverse(assetClass?: AssetClass, exchange?: string, universeType?: string): Promise<string[]> {
    // Use the specified asset class, or fall back to the instance default
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    
    // For asset classes other than stocks, provide reasonable defaults
    if (effectiveAssetClass !== 'stocks') {
      if (effectiveAssetClass === 'crypto') {
        return ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK'];
      } else if (effectiveAssetClass === 'forex') {
        return ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CAD', 'USD/CHF', 'AUD/USD', 'NZD/USD'];
      } else if (effectiveAssetClass === 'futures') {
        return ['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', 'ZF'];
      } else if (effectiveAssetClass === 'options') {
        // Option symbols vary too much by provider to provide meaningful defaults
        return [];
      }
    }
    
    // For stocks, call the legacy method
    return this.getStockUniverse(universeType);
  }
  
  /**
   * Check if the market is currently open
   * 
   * Legacy method to be overridden by provider-specific adapters
   */
  abstract isMarketOpen(): Promise<boolean>;
  
  /**
   * Enhanced market open check with asset class and exchange specification
   * By default, calls the legacy method but can be overridden by provider-specific adapters
   */
  async isMarketOpen(assetClass?: AssetClass, exchange?: string): Promise<boolean> {
    // Use the specified asset class, or fall back to the instance default
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    
    // Some markets like crypto are always open
    if (effectiveAssetClass === 'crypto') {
      return true;
    }
    
    // For stocks and other traditional assets, call the legacy method
    return this.isMarketOpen();
  }
  
  /**
   * Get market hours info for planning trading sessions
   */
  async getMarketHours(assetClass?: AssetClass, exchange?: string): Promise<{
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
    timezone: string;
  }> {
    // Use the specified asset class, or fall back to the instance default
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    
    // Default implementation based on standard US market hours
    const now = new Date();
    const timezone = "America/New_York";
    
    if (effectiveAssetClass === 'crypto') {
      // Crypto markets are always open
      return {
        isOpen: true,
        timezone: "UTC"
      };
    } else {
      // Default to US stock market hours
      const isOpen = await this.isMarketOpen(effectiveAssetClass, exchange);
      
      // Calculate next open and close times based on standard market hours
      // This is a simplistic implementation; providers should override with actual market calendar data
      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      let nextOpen: Date | undefined;
      let nextClose: Date | undefined;
      
      // Simple calculation for next open (9:30 AM ET) and close (4:00 PM ET)
      // on the next trading day (Monday-Friday)
      
      // TODO: Implement actual logic based on market calendars
      
      return {
        isOpen,
        nextOpen,
        nextClose,
        timezone
      };
    }
  }
  
  /**
   * Check if the provider is valid (has necessary API keys, etc.)
   */
  isValid(): boolean {
    return !!this.provider;
  }
  
  /**
   * Get the name of the provider
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * Get available asset classes supported by this provider
   */
  getSupportedAssetClasses(): AssetClass[] {
    const capabilities = PROVIDER_CAPABILITIES[this.name.toLowerCase()];
    return capabilities ? capabilities.supportedAssetClasses : ['stocks'];
  }
  
  /**
   * Get available exchanges supported by this provider
   */
  getSupportedExchanges(): string[] {
    const capabilities = PROVIDER_CAPABILITIES[this.name.toLowerCase()];
    return capabilities ? capabilities.supportedExchanges : ['NASDAQ', 'NYSE'];
  }
  
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
  } {
    const capabilities = PROVIDER_CAPABILITIES[this.name.toLowerCase()];
    
    if (capabilities) {
      return {
        realtime: capabilities.realtime,
        historicalData: capabilities.historicalData,
        options: capabilities.options,
        futures: capabilities.futures,
        forex: capabilities.forex,
        crypto: capabilities.crypto,
        fundamentals: capabilities.fundamentals,
        news: capabilities.news
      };
    }
    
    // Default capabilities if none found
    return {
      realtime: false,
      historicalData: true,
      options: false,
      futures: false,
      forex: false,
      crypto: false,
      fundamentals: false,
      news: false
    };
  }
}