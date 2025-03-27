/**
 * Market Data Provider Adapters
 * 
 * This file implements adapters for various market data providers
 * to conform to the IMarketDataProvider interface.
 */
import { AlpacaAPI } from './alpaca';
import { YahooFinanceAPI } from './yahoo';
import PolygonAPI from './polygon';
import AlphaVantageAPI from './alphavantage';
import TiingoAPI from './tiingo';
import type { ApiIntegration } from '@shared/schema';
import { IMarketDataProvider } from './marketDataProviderInterface';

/**
 * Base class for market data provider adapters
 */
export abstract class BaseMarketDataProviderAdapter implements IMarketDataProvider {
  protected provider: any;
  protected name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  abstract getHistoricalData(symbols: string[], period?: string, interval?: string): Promise<Record<string, any>>;
  abstract getQuote(symbol: string): Promise<any>;
  abstract getStockUniverse(universeType?: string): Promise<string[]>;
  abstract isMarketOpen(): Promise<boolean>;
  
  isValid(): boolean {
    return !!this.provider;
  }
  
  getName(): string {
    return this.name;
  }
}

/**
 * Alpaca market data provider adapter
 */
export class AlpacaDataProviderAdapter extends BaseMarketDataProviderAdapter {
  constructor(integration?: ApiIntegration) {
    super('alpaca');
    this.provider = new AlpacaAPI(integration);
  }
  
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
  
  async getQuote(symbol: string): Promise<any> {
    if (!this.isValid()) {
      throw new Error('Alpaca API is not properly configured');
    }
    
    return this.provider.getQuote(symbol);
  }
  
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
}

/**
 * Yahoo Finance market data provider adapter
 */
export class YahooFinanceDataProviderAdapter extends BaseMarketDataProviderAdapter {
  constructor() {
    super('yahoo');
    this.provider = new YahooFinanceAPI();
  }
  
  async getHistoricalData(symbols: string[], period: string = '1mo', interval: string = '1d'): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    
    for (const symbol of symbols) {
      try {
        const history = await this.provider.getHistoricalData(symbol, period, interval);
        result[symbol] = history;
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol} from Yahoo Finance:`, error);
      }
    }
    
    return result;
  }
  
  async getQuote(symbol: string): Promise<any> {
    return this.provider.getQuote(symbol);
  }
  
  async getStockUniverse(universeType: string = 'default'): Promise<string[]> {
    if (universeType === 'sp500') {
      return this.provider.getSP500Symbols();
    } else if (universeType === 'nasdaq100') {
      return this.provider.getNASDAQ100Symbols();
    } else {
      return this.provider.getDefaultSymbols();
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    return this.provider.isMarketOpen();
  }
  
  isValid(): boolean {
    return true; // Yahoo Finance doesn't require authentication
  }
}

/**
 * Polygon market data provider adapter
 */
export class PolygonDataProviderAdapter extends BaseMarketDataProviderAdapter {
  constructor(integration?: ApiIntegration) {
    super('polygon');
    
    if (integration?.credentials?.apiKey) {
      // Pass the entire integration object, not just the API key
      this.provider = new PolygonAPI(integration);
    } else if (process.env.POLYGON_API_KEY) {
      this.provider = new PolygonAPI(process.env.POLYGON_API_KEY);
    } else {
      console.error('Polygon API key not found');
      this.provider = null;
    }
  }
  
  async getHistoricalData(symbols: string[], period: string = '1mo', interval: string = '1d'): Promise<Record<string, any>> {
    if (!this.isValid()) {
      throw new Error('Polygon API is not properly configured');
    }
    
    const result: Record<string, any> = {};
    
    // Convert period to start/end dates
    const now = new Date();
    let startDate = new Date();
    
    if (period.endsWith('d')) {
      const days = parseInt(period);
      startDate.setDate(now.getDate() - days);
    } else if (period.endsWith('mo')) {
      const months = parseInt(period);
      startDate.setMonth(now.getMonth() - months);
    } else if (period.endsWith('y')) {
      const years = parseInt(period);
      startDate.setFullYear(now.getFullYear() - years);
    }
    
    // Format dates
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = now.toISOString().split('T')[0];
    
    // Convert interval to Polygon timespan
    let timespan = 'day';
    if (interval === '1h') timespan = 'hour';
    else if (interval === '1m') timespan = 'minute';
    
    for (const symbol of symbols) {
      try {
        const data = await this.provider.getAggregates(
          symbol,
          timespan,
          formattedStartDate,
          formattedEndDate
        );
        
        result[symbol] = data;
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol} from Polygon:`, error);
      }
    }
    
    return result;
  }
  
  async getQuote(symbol: string): Promise<any> {
    if (!this.isValid()) {
      throw new Error('Polygon API is not properly configured');
    }
    
    return this.provider.getQuote(symbol);
  }
  
  async getStockUniverse(universeType: string = 'default'): Promise<string[]> {
    if (!this.isValid()) {
      throw new Error('Polygon API is not properly configured');
    }
    
    try {
      // For specific universes, we'll use a pre-defined list
      if (universeType === 'sp500') {
        // Return a subset of S&P 500 symbols (for demo purposes)
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B', 'NVDA', 'JPM', 'JNJ',
          'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 'CRM', 'INTC'
        ];
      } else if (universeType === 'nasdaq100') {
        // Return a subset of NASDAQ-100 symbols (for demo purposes)
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'NFLX', 'ADBE', 'PYPL',
          'CMCSA', 'PEP', 'COST', 'INTC', 'CSCO', 'AVGO', 'TXN', 'QCOM', 'AMGN', 'AMD'
        ];
      } else {
        // Return commonly used stock symbols
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT',
          'PG', 'MA', 'DIS', 'NFLX', 'INTC', 'VZ', 'CSCO', 'KO', 'PEP', 'MRK'
        ];
      }
    } catch (error) {
      console.error('Error fetching stock universe from Polygon:', error);
      return [];
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    if (!this.isValid()) {
      return false;
    }
    
    try {
      const marketStatus = await this.provider.getMarketStatus();
      return marketStatus.market === 'open';
    } catch (error) {
      console.error('Error checking market status with Polygon:', error);
      return false;
    }
  }
}

/**
 * Alpha Vantage market data provider adapter
 */
export class AlphaVantageDataProviderAdapter extends BaseMarketDataProviderAdapter {
  constructor(integration?: ApiIntegration) {
    super('alphavantage');
    
    if (integration?.credentials?.apiKey) {
      this.provider = new AlphaVantageAPI(integration.credentials.apiKey);
    } else if (process.env.ALPHAVANTAGE_API_KEY) {
      this.provider = new AlphaVantageAPI(process.env.ALPHAVANTAGE_API_KEY);
    } else {
      console.error('Alpha Vantage API key not found');
      this.provider = null;
    }
  }
  
  async getHistoricalData(symbols: string[], period: string = '1mo', interval: string = '1d'): Promise<Record<string, any>> {
    if (!this.isValid()) {
      throw new Error('Alpha Vantage API is not properly configured');
    }
    
    const result: Record<string, any> = {};
    
    // Convert interval to Alpha Vantage format
    let avInterval = 'daily';
    if (interval === '1h') avInterval = '60min';
    else if (interval === '1m') avInterval = '1min';
    else if (interval === '1d') avInterval = 'daily';
    else if (interval === '1wk') avInterval = 'weekly';
    else if (interval === '1mo') avInterval = 'monthly';
    
    for (const symbol of symbols) {
      try {
        const data = await this.provider.getTimeSeriesData(symbol, avInterval);
        result[symbol] = data;
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol} from Alpha Vantage:`, error);
      }
    }
    
    return result;
  }
  
  async getQuote(symbol: string): Promise<any> {
    if (!this.isValid()) {
      throw new Error('Alpha Vantage API is not properly configured');
    }
    
    return this.provider.getQuote(symbol);
  }
  
  async getStockUniverse(universeType: string = 'default'): Promise<string[]> {
    // Alpha Vantage doesn't provide stock universe lists
    // Return default lists based on universe type
    if (universeType === 'sp500') {
      return [
        'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B', 'NVDA', 'JPM', 'JNJ',
        'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 'CRM', 'INTC'
      ];
    } else if (universeType === 'nasdaq100') {
      return [
        'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'NFLX', 'ADBE', 'PYPL',
        'CMCSA', 'PEP', 'COST', 'INTC', 'CSCO', 'AVGO', 'TXN', 'QCOM', 'AMGN', 'AMD'
      ];
    } else {
      return [
        'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT',
        'PG', 'MA', 'DIS', 'NFLX', 'INTC', 'VZ', 'CSCO', 'KO', 'PEP', 'MRK'
      ];
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    // Alpha Vantage doesn't provide a market status endpoint
    // Use a simple time-based check
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // US markets are open Monday-Friday, 9:30 AM - 4:00 PM Eastern Time
    if (day >= 1 && day <= 5) {
      const totalMinutes = hour * 60 + minute;
      const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
      const marketCloseMinutes = 16 * 60; // 4:00 PM
      
      return totalMinutes >= marketOpenMinutes && totalMinutes < marketCloseMinutes;
    }
    
    return false;
  }
}

/**
 * Tiingo market data provider adapter
 */
export class TiingoDataProviderAdapter extends BaseMarketDataProviderAdapter {
  constructor(integration?: ApiIntegration) {
    super('tiingo');
    
    if (integration?.credentials?.apiKey) {
      this.provider = new TiingoAPI(integration.credentials.apiKey);
    } else if (process.env.TIINGO_API_KEY) {
      this.provider = new TiingoAPI(process.env.TIINGO_API_KEY);
    } else {
      console.error('Tiingo API key not found');
      this.provider = null;
    }
  }
  
  async getHistoricalData(symbols: string[], period: string = '1mo', interval: string = '1d'): Promise<Record<string, any>> {
    if (!this.isValid()) {
      throw new Error('Tiingo API is not properly configured');
    }
    
    const result: Record<string, any> = {};
    
    // Convert period to start/end dates
    const now = new Date();
    let startDate = new Date();
    
    if (period.endsWith('d')) {
      const days = parseInt(period);
      startDate.setDate(now.getDate() - days);
    } else if (period.endsWith('mo')) {
      const months = parseInt(period);
      startDate.setMonth(now.getMonth() - months);
    } else if (period.endsWith('y')) {
      const years = parseInt(period);
      startDate.setFullYear(now.getFullYear() - years);
    }
    
    // Format dates
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = now.toISOString().split('T')[0];
    
    // Convert interval to Tiingo format
    let resampleFreq = 'daily';
    if (interval === '1h') resampleFreq = 'hourly';
    else if (interval === '1d') resampleFreq = 'daily';
    
    for (const symbol of symbols) {
      try {
        const data = await this.provider.getHistoricalData(
          symbol,
          formattedStartDate,
          formattedEndDate,
          resampleFreq
        );
        
        result[symbol] = data;
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol} from Tiingo:`, error);
      }
    }
    
    return result;
  }
  
  async getQuote(symbol: string): Promise<any> {
    if (!this.isValid()) {
      throw new Error('Tiingo API is not properly configured');
    }
    
    return this.provider.getQuote(symbol);
  }
  
  async getStockUniverse(universeType: string = 'default'): Promise<string[]> {
    if (!this.isValid()) {
      throw new Error('Tiingo API is not properly configured');
    }
    
    try {
      // For specific universes, we'll use predefined lists
      if (universeType === 'sp500') {
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B', 'NVDA', 'JPM', 'JNJ',
          'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 'CRM', 'INTC'
        ];
      } else if (universeType === 'nasdaq100') {
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'NFLX', 'ADBE', 'PYPL',
          'CMCSA', 'PEP', 'COST', 'INTC', 'CSCO', 'AVGO', 'TXN', 'QCOM', 'AMGN', 'AMD'
        ];
      } else {
        return [
          'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT',
          'PG', 'MA', 'DIS', 'NFLX', 'INTC', 'VZ', 'CSCO', 'KO', 'PEP', 'MRK'
        ];
      }
    } catch (error) {
      console.error('Error fetching stock universe from Tiingo:', error);
      return [];
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    // Tiingo doesn't provide a market status endpoint
    // Use a simple time-based check
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // US markets are open Monday-Friday, 9:30 AM - 4:00 PM Eastern Time
    if (day >= 1 && day <= 5) {
      const totalMinutes = hour * 60 + minute;
      const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
      const marketCloseMinutes = 16 * 60; // 4:00 PM
      
      return totalMinutes >= marketOpenMinutes && totalMinutes < marketCloseMinutes;
    }
    
    return false;
  }
}