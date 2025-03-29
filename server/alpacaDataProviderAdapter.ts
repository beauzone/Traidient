/**
 * Alpaca Market Data Provider Adapter
 * 
 * This adapter implements the full IMarketDataProvider interface for Alpaca.
 * It supports both the legacy methods and the enhanced multi-asset, multi-exchange methods.
 */
import { AlpacaAPI } from './alpaca';
import { BaseMarketDataProviderAdapter } from './marketDataProviderBaseAdapter';
import { 
  AssetClass, 
  QuoteData, 
  PriceBar, 
  MarketDataParams 
} from './marketDataProviderInterface';
import type { ApiIntegration } from '@shared/schema';

/**
 * Alpaca market data provider adapter with enhanced multi-asset/multi-exchange support
 */
export class AlpacaDataProviderAdapter extends BaseMarketDataProviderAdapter {
  constructor(
    integration?: ApiIntegration, 
    assetClass?: AssetClass, 
    exchange?: string
  ) {
    super('alpaca', integration, assetClass, exchange);
    this.provider = new AlpacaAPI(integration);
  }
  
  /**
   * Legacy method implementation to get historical data
   */
  async getHistoricalData(symbols: string[], period: string = '1mo', interval: string = '1d'): Promise<Record<string, any>> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    const result: Record<string, any> = {};
    
    for (const symbol of symbols) {
      try {
        // Alpaca API provides getBars method for historical data
        const bars = await this.provider.getBars(symbol, period, interval);
        result[symbol] = bars;
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol} from Alpaca:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Enhanced historical data method implementation
   */
  async getHistoricalData(params: MarketDataParams): Promise<Record<string, PriceBar[]>> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    const result: Record<string, PriceBar[]> = {};
    const symbols = params.symbols;
    const period = params.period || '1mo';
    const interval = params.interval || '1d';
    const assetClass = params.assetClass || this.assetClass || 'stocks';
    const exchange = params.exchange || this.exchange;
    
    for (const symbol of symbols) {
      try {
        // Alpaca API provides getBars method for historical data
        // Enhance with asset class and exchange information
        const options = {
          assetClass,
          exchange,
          adjustForSplits: params.adjustForSplits !== false,
          adjustForDividends: params.adjustForDividends !== false,
          limit: params.limit || 1000,
          extendedHours: params.extendedHours || false
        };
        
        // For crypto, use different endpoint
        if (assetClass === 'crypto') {
          const bars = await this.provider.getCryptoBars(symbol, period, interval, options);
          result[symbol] = this.convertBarsToStandardFormat(bars);
        } else {
          const bars = await this.provider.getBars(symbol, period, interval, options);
          result[symbol] = this.convertBarsToStandardFormat(bars);
        }
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol} from Alpaca:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Convert Alpaca-specific bars to standardized PriceBar format
   */
  private convertBarsToStandardFormat(bars: any[]): PriceBar[] {
    return bars.map(bar => ({
      timestamp: new Date(bar.t),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      trades: bar.n
    }));
  }
  
  /**
   * Legacy method implementation to get quote
   */
  async getQuote(symbol: string): Promise<any> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    return this.provider.getQuote(symbol);
  }
  
  /**
   * Enhanced quote method implementation with asset class and exchange
   */
  async getQuote(symbol: string, assetClass?: AssetClass, exchange?: string): Promise<QuoteData> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    // Use the specified asset class and exchange, or fall back to the instance defaults
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    const effectiveExchange = exchange || this.exchange;
    
    try {
      let quote;
      
      // Use different endpoints based on asset class
      if (effectiveAssetClass === 'crypto') {
        quote = await this.provider.getCryptoQuote(symbol);
      } else {
        quote = await this.provider.getQuote(symbol);
      }
      
      // Convert to standardized QuoteData format
      return {
        symbol,
        price: quote.ap || quote.askprice || quote.last_price || quote.lastPrice || 0,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        bid: quote.bp || quote.bidprice || quote.bid || 0,
        ask: quote.ap || quote.askprice || quote.ask || 0,
        volume: quote.v || quote.volume || 0,
        timestamp: new Date(quote.t || quote.timestamp || Date.now()),
        exchange: effectiveExchange,
        assetClass: effectiveAssetClass,
        open: quote.o || quote.open || 0,
        high: quote.h || quote.high || 0,
        low: quote.l || quote.low || 0,
        previousClose: quote.pc || quote.prevClose || quote.previousClose || 0
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol} from Alpaca:`, error);
      return {
        symbol,
        price: 0,
        timestamp: new Date(),
        assetClass: effectiveAssetClass,
        exchange: effectiveExchange
      };
    }
  }
  
  /**
   * Get multiple quotes in a single request (more efficient)
   */
  async getQuotes(symbols: string[], assetClass?: AssetClass, exchange?: string): Promise<Record<string, QuoteData>> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    // Use the specified asset class and exchange, or fall back to the instance defaults
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    const effectiveExchange = exchange || this.exchange;
    
    try {
      const result: Record<string, QuoteData> = {};
      
      // Alpaca supports batch quotes
      let quotes;
      
      if (effectiveAssetClass === 'crypto') {
        quotes = await this.provider.getCryptoQuotes(symbols);
      } else {
        quotes = await this.provider.getQuotes(symbols);
      }
      
      // Convert each quote to standardized format
      for (const symbol in quotes) {
        const quote = quotes[symbol];
        result[symbol] = {
          symbol,
          price: quote.ap || quote.askprice || quote.last_price || quote.lastPrice || 0,
          change: quote.change || 0,
          changePercent: quote.changePercent || 0,
          bid: quote.bp || quote.bidprice || quote.bid || 0,
          ask: quote.ap || quote.askprice || quote.ask || 0,
          volume: quote.v || quote.volume || 0,
          timestamp: new Date(quote.t || quote.timestamp || Date.now()),
          exchange: effectiveExchange,
          assetClass: effectiveAssetClass,
          open: quote.o || quote.open || 0,
          high: quote.h || quote.high || 0,
          low: quote.l || quote.low || 0,
          previousClose: quote.pc || quote.prevClose || quote.previousClose || 0
        };
      }
      
      return result;
    } catch (error) {
      console.error(`Error fetching quotes for ${symbols.join(',')} from Alpaca:`, error);
      
      // Fall back to individual quotes
      return super.getQuotes(symbols, assetClass, exchange);
    }
  }
  
  /**
   * Legacy method implementation to get stock universe
   */
  async getStockUniverse(universeType: string = 'default'): Promise<string[]> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    try {
      // Get assets from Alpaca
      const assets = await this.provider.listAssets();
      
      // Filter based on universe type
      let filteredAssets = assets;
      
      if (universeType === 'sp500') {
        // This is a simplification; Alpaca doesn't directly provide S&P 500 constituents
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B', 'NVDA', 'JPM', 'JNJ',
          'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 'CRM', 'INTC'
        ];
      } else if (universeType === 'nasdaq100') {
        // This is a simplification; Alpaca doesn't directly provide NASDAQ-100 constituents
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'NFLX', 'ADBE', 'PYPL',
          'CMCSA', 'PEP', 'COST', 'INTC', 'CSCO', 'AVGO', 'TXN', 'QCOM', 'AMGN', 'AMD'
        ];
      }
      
      // Extract symbols
      return filteredAssets
        .filter(asset => asset.status === 'active' && asset.tradable)
        .map(asset => asset.symbol);
    } catch (error) {
      console.error('Error fetching stock universe from Alpaca:', error);
      return [];
    }
  }
  
  /**
   * Enhanced method to get symbol universe with asset class and exchange filters
   */
  async getSymbolUniverse(assetClass?: AssetClass, exchange?: string, universeType?: string): Promise<string[]> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    // Use the specified asset class and exchange, or fall back to the instance defaults
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    const effectiveExchange = exchange || this.exchange;
    
    try {
      // For crypto, return common crypto symbols
      if (effectiveAssetClass === 'crypto') {
        return await this.provider.listCryptoAssets();
      }
      
      // For specific universes, we'll use a pre-defined list
      if (universeType === 'sp500' || universeType === 'nasdaq100') {
        return this.getStockUniverse(universeType);
      }
      
      // Get assets from Alpaca with filters
      const assets = await this.provider.listAssets({
        status: 'active',
        assetClass: effectiveAssetClass,
        exchange: effectiveExchange
      });
      
      // Extract symbols
      return assets
        .filter(asset => asset.tradable)
        .map(asset => asset.symbol);
    } catch (error) {
      console.error(`Error fetching symbol universe from Alpaca (assetClass: ${effectiveAssetClass}, exchange: ${effectiveExchange}):`, error);
      
      // Fall back to basic universe
      if (effectiveAssetClass === 'crypto') {
        return ['BTC/USD', 'ETH/USD', 'SOL/USD', 'AVAX/USD', 'BNB/USD', 'ADA/USD'];
      }
      
      return super.getSymbolUniverse(assetClass, exchange, universeType);
    }
  }
  
  /**
   * Legacy method implementation to check if market is open
   */
  async isMarketOpen(): Promise<boolean> {
    if (!this.isValid()) {
      return false;
    }
    
    try {
      const clock = await this.provider.getClock();
      return clock.is_open;
    } catch (error) {
      console.error('Error checking market status with Alpaca:', error);
      return false;
    }
  }
  
  /**
   * Enhanced market open check with asset class and exchange specification
   */
  async isMarketOpen(assetClass?: AssetClass, exchange?: string): Promise<boolean> {
    // Use the specified asset class, or fall back to the instance default
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    
    // Crypto markets are always open
    if (effectiveAssetClass === 'crypto') {
      return true;
    }
    
    // For stocks and other traditional assets, use Alpaca's clock endpoint
    return this.isMarketOpen();
  }
  
  /**
   * Get market hours information for the specified asset class and exchange
   */
  async getMarketHours(assetClass?: AssetClass, exchange?: string): Promise<{
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
    timezone: string;
  }> {
    // Use the specified asset class, or fall back to the instance default
    const effectiveAssetClass = assetClass || this.assetClass || 'stocks';
    
    // For crypto, markets are always open
    if (effectiveAssetClass === 'crypto') {
      return {
        isOpen: true,
        timezone: "UTC"
      };
    }
    
    try {
      // Get market clock from Alpaca
      const clock = await this.provider.getClock();
      
      return {
        isOpen: clock.is_open,
        nextOpen: clock.next_open ? new Date(clock.next_open) : undefined,
        nextClose: clock.next_close ? new Date(clock.next_close) : undefined,
        timezone: "America/New_York" // Alpaca uses Eastern Time
      };
    } catch (error) {
      console.error('Error getting market hours from Alpaca:', error);
      
      // Fallback to base implementation
      return super.getMarketHours(assetClass, exchange);
    }
  }
}