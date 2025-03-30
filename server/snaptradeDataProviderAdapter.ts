/**
 * SnapTrade Data Provider Adapter
 * 
 * This adapter integrates the SnapTrade service with our market data provider interface,
 * allowing it to be used as a data source for market data.
 */

import { type ApiIntegration, type SnapTradeConnectionInfo } from '@shared/schema';
import { IMarketDataProvider, AssetClass, MarketDataParams, QuoteData, PriceBar } from './marketDataProviderInterface';
import { snapTradeService } from './snaptradeService';

export class SnapTradeDataProviderAdapter implements IMarketDataProvider {
  private apiIntegration: ApiIntegration;
  private connections: SnapTradeConnectionInfo[] = [];
  private ready: boolean = false;
  private userId: number;

  /**
   * Constructor
   * @param apiIntegration The API integration to use
   */
  constructor(apiIntegration: ApiIntegration) {
    this.apiIntegration = apiIntegration;
    this.userId = apiIntegration.userId;
  }

  /**
   * Initialize the adapter with a user's credentials
   */
  async initialize(userId: number): Promise<boolean> {
    try {
      this.userId = userId;
      
      // Initialize the SnapTrade service for this user
      const initialized = await snapTradeService.initializeForUser(userId);
      
      if (!initialized) {
        console.error('Failed to initialize SnapTrade service');
        return false;
      }
      
      // Get the user's connections
      this.connections = await snapTradeService.getConnections();
      this.ready = this.connections.length > 0;
      
      return this.ready;
    } catch (error) {
      console.error('Error initializing SnapTradeDataProviderAdapter:', error);
      return false;
    }
  }

  /**
   * Get historical data for one or more symbols
   * This implementation converts the params object to separate parameters for compatibility
   */
  async getHistoricalData(
    params: MarketDataParams
  ): Promise<Record<string, PriceBar[]>> {
    try {
      if (!this.ready) {
        await this.initialize(this.userId);
        if (!this.ready) {
          throw new Error('SnapTrade adapter not ready');
        }
      }

      const symbols = params.symbols;
      const period = params.period || '1M'; // Default to 1 month
      const interval = params.interval || '1d'; // Default to daily
      
      // Initialize the result object
      const result: Record<string, PriceBar[]> = {};
      
      // For each symbol, get historical data
      for (const symbol of symbols) {
        // Call the SnapTrade API to get historical data
        // This is a placeholder - actual implementation would use the SnapTrade SDK
        // We'll just return an empty array for now
        result[symbol] = [];
      }
      
      return result;
    } catch (error) {
      console.error('Error getting historical data from SnapTrade:', error);
      return {};
    }
  }

  /**
   * Get a real-time quote for a symbol
   */
  async getQuote(symbol: string, assetClass?: AssetClass, exchange?: string): Promise<QuoteData> {
    try {
      if (!this.ready) {
        await this.initialize(this.userId);
        if (!this.ready) {
          throw new Error('SnapTrade adapter not ready');
        }
      }
      
      const quoteData = await snapTradeService.getQuote(symbol);
      
      if (!quoteData) {
        throw new Error(`No quote data found for ${symbol}`);
      }
      
      // Convert the SnapTrade quote to our standard format
      return {
        symbol,
        bid: quoteData.bid || 0,
        ask: quoteData.ask || 0,
        price: quoteData.last || 0,
        volume: quoteData.volume || 0,
        timestamp: new Date(quoteData.timestamp || Date.now()),
        change: quoteData.change || 0,
        changePercent: quoteData.changePercent || 0,
        open: quoteData.open || 0,
        high: quoteData.high || 0,
        low: quoteData.low || 0,
        previousClose: quoteData.previousClose || 0,
        assetClass: assetClass || 'stocks',
        exchange: exchange || ''
      };
    } catch (error) {
      console.error(`Error getting quote for ${symbol} from SnapTrade:`, error);
      // Return a default quote with error state
      return {
        symbol,
        bid: 0,
        ask: 0,
        price: 0,
        volume: 0,
        timestamp: new Date(),
        change: 0,
        changePercent: 0,
        open: 0,
        high: 0,
        low: 0,
        previousClose: 0,
        assetClass: assetClass || 'stocks',
        exchange: exchange || ''
      };
    }
  }

  /**
   * Get quotes for multiple symbols at once
   */
  async getQuotes(symbols: string[], assetClass?: AssetClass, exchange?: string): Promise<Record<string, QuoteData>> {
    try {
      if (!this.ready) {
        await this.initialize(this.userId);
        if (!this.ready) {
          throw new Error('SnapTrade adapter not ready');
        }
      }
      
      const result: Record<string, QuoteData> = {};
      
      // Get quotes for each symbol individually
      // This is not efficient, but SnapTrade doesn't have a batch quote endpoint
      for (const symbol of symbols) {
        result[symbol] = await this.getQuote(symbol, assetClass, exchange);
      }
      
      return result;
    } catch (error) {
      console.error('Error getting quotes from SnapTrade:', error);
      return {};
    }
  }

  /**
   * Get a list of available symbols
   */
  async getSymbolUniverse(assetClass?: AssetClass, exchange?: string, universeType?: string): Promise<string[]> {
    try {
      if (!this.ready) {
        await this.initialize(this.userId);
        if (!this.ready) {
          throw new Error('SnapTrade adapter not ready');
        }
      }
      
      // This is a placeholder - the actual implementation would use the SnapTrade SDK
      // to get a list of available symbols
      return [];
    } catch (error) {
      console.error('Error getting symbol universe from SnapTrade:', error);
      return [];
    }
  }

  /**
   * Get supported asset classes
   */
  getSupportedAssetClasses(): AssetClass[] {
    return ['stocks', 'etf', 'options'];
  }

  /**
   * Get supported exchanges
   */
  getSupportedExchanges(): string[] {
    return ['NYSE', 'NASDAQ', 'AMEX', 'TSX'];
  }

  /**
   * Check if a market is open
   */
  async isMarketOpen(assetClass?: AssetClass, exchange?: string): Promise<boolean> {
    try {
      // This is a placeholder - the actual implementation would use the SnapTrade SDK
      // to check if the market is open
      return true;
    } catch (error) {
      console.error('Error checking if market is open with SnapTrade:', error);
      return false;
    }
  }

  /**
   * Get market hours information
   */
  async getMarketHours(assetClass?: AssetClass, exchange?: string): Promise<{
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
    timezone: string;
  }> {
    try {
      // This is a placeholder - the actual implementation would use the SnapTrade SDK
      // to get market hours
      return {
        isOpen: true,
        nextOpen: new Date(),
        nextClose: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
        timezone: 'America/New_York' // Default timezone for US markets
      };
    } catch (error) {
      console.error('Error getting market hours from SnapTrade:', error);
      return { 
        isOpen: false,
        timezone: 'America/New_York'
      };
    }
  }

  /**
   * Check if the provider is valid
   */
  isValid(): boolean {
    return this.ready;
  }

  /**
   * Get the name of the provider
   */
  getName(): string {
    return 'SnapTrade';
  }

  /**
   * Get provider capabilities
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
    return {
      realtime: true,
      historicalData: true,
      options: true,
      futures: false,
      forex: false,
      crypto: false,
      fundamentals: false,
      news: false
    };
  }
}