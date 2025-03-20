/**
 * Market Data Providers for Backtesting
 * 
 * This module defines the interface and implementations for different market data
 * providers used in backtesting strategies.
 */

import { ApiIntegration } from '@shared/schema';
import { AlpacaAPI } from './alpaca';
import { YahooFinanceAPI } from './yahoo';
import PolygonAPI from './polygon';

/**
 * Interface for market data providers
 */
export interface MarketDataProvider {
  /**
   * Get historical market data for a symbol
   * @param symbol The stock symbol
   * @param timeframe Timeframe string (e.g., '1D', '1H')
   * @param startDate Start date in ISO format
   * @param endDate End date in ISO format
   * @param limit Maximum number of bars to return
   */
  getHistoricalData(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    limit?: number
  ): Promise<{
    symbol: string;
    bars: Array<{
      t: string; // timestamp
      o: number; // open
      h: number; // high
      l: number; // low
      c: number; // close
      v: number; // volume
    }>;
    dataSource: string;
  }>;
  
  /**
   * Verifies the connection to the market data provider
   */
  verifyConnection(): Promise<{ isValid: boolean; message: string }>;
  
  /**
   * Provider name
   */
  readonly provider: string;
  
  /**
   * Whether the provider is valid (has valid credentials)
   */
  readonly isValid: boolean;
}

/**
 * Alpaca Market Data Provider
 */
export class AlpacaDataProvider implements MarketDataProvider {
  private alpaca: AlpacaAPI;
  public readonly provider = 'alpaca';
  
  constructor(integration?: ApiIntegration) {
    this.alpaca = new AlpacaAPI(integration);
  }
  
  get isValid(): boolean {
    return this.alpaca.isValid;
  }
  
  async verifyConnection(): Promise<{ isValid: boolean; message: string }> {
    return this.alpaca.verifyConnection();
  }
  
  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startDate: string, 
    endDate: string,
    limit = 1000
  ): Promise<{
    symbol: string;
    bars: Array<{
      t: string;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }>;
    dataSource: string;
  }> {
    try {
      const data = await this.alpaca.getMarketData(
        symbol, 
        timeframe, 
        limit,
        startDate, 
        endDate
      );
      
      if (!data || !data.bars || data.bars.length === 0) {
        throw new Error(`No data returned from Alpaca for ${symbol}`);
      }
      
      // Transform to our standard format
      return {
        symbol,
        bars: data.bars.map((bar: any) => ({
          t: new Date(bar.t).toISOString(),
          o: parseFloat(bar.o),
          h: parseFloat(bar.h),
          l: parseFloat(bar.l),
          c: parseFloat(bar.c),
          v: parseFloat(bar.v)
        })),
        dataSource: 'alpaca'
      };
    } catch (error) {
      console.error(`Error fetching data from Alpaca for ${symbol}:`, error);
      throw new Error(`Failed to fetch data from Alpaca: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Yahoo Finance Market Data Provider
 */
export class YahooDataProvider implements MarketDataProvider {
  private yahoo: YahooFinanceAPI;
  public readonly provider = 'yahoo';
  public readonly isValid = true; // Yahoo Finance doesn't require API keys
  
  constructor() {
    this.yahoo = new YahooFinanceAPI();
  }
  
  async verifyConnection(): Promise<{ isValid: boolean; message: string }> {
    return { isValid: true, message: 'Yahoo Finance API connection successful' };
  }
  
  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    limit = 1000
  ): Promise<{
    symbol: string;
    bars: Array<{
      t: string;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }>;
    dataSource: string;
  }> {
    // Convert to Yahoo's format
    const { period, interval } = timeframeToYahooParams(timeframe, startDate, endDate);
    
    try {
      const data = await this.yahoo.getHistoricalData(symbol, period, interval);
      
      if (!data || !data.bars || data.bars.length === 0) {
        throw new Error(`No data returned from Yahoo Finance for ${symbol}`);
      }
      
      return {
        symbol,
        bars: data.bars,
        dataSource: 'yahoo'
      };
    } catch (error) {
      console.error(`Error fetching data from Yahoo Finance for ${symbol}:`, error);
      throw new Error(`Failed to fetch data from Yahoo Finance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Polygon.io Market Data Provider
 */
export class PolygonDataProvider implements MarketDataProvider {
  private polygon: PolygonAPI;
  public readonly provider = 'polygon';
  
  constructor(integration?: ApiIntegration) {
    this.polygon = new PolygonAPI(integration);
  }
  
  get isValid(): boolean {
    return this.polygon.isValid;
  }
  
  async verifyConnection(): Promise<{ isValid: boolean; message: string }> {
    return this.polygon.verifyConnection();
  }
  
  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    limit = 1000
  ): Promise<{
    symbol: string;
    bars: Array<{
      t: string;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }>;
    dataSource: string;
  }> {
    try {
      console.log(`Fetching Polygon.io data for ${symbol} from ${startDate} to ${endDate}`);
      // Polygon API expects different parameters, so we need to pass them differently
      const data = await this.polygon.getHistoricalData(
        symbol, 
        timeframe, 
        limit
      );
      
      // The startDate and endDate are handled internally by the Polygon API implementation
      
      if (!data || !data.bars || data.bars.length === 0) {
        throw new Error(`No data returned from Polygon.io for ${symbol}`);
      }
      
      // Transform to our standard format
      return {
        symbol,
        bars: data.bars.map((bar: any) => ({
          t: new Date(bar.t).toISOString(),
          o: parseFloat(bar.o),
          h: parseFloat(bar.h),
          l: parseFloat(bar.l),
          c: parseFloat(bar.c),
          v: parseFloat(bar.v)
        })),
        dataSource: 'polygon'
      };
    } catch (error) {
      console.error(`Error fetching data from Polygon.io for ${symbol}:`, error);
      throw new Error(`Failed to fetch data from Polygon.io: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Factory function to create a market data provider instance based on the provider name
 * @param providerName The name of the provider to create
 * @param integration Optional API integration for providers that require authentication
 * @returns Market data provider instance
 */
export function createMarketDataProvider(
  providerName: 'alpaca' | 'yahoo' | 'polygon',
  integration?: ApiIntegration
): MarketDataProvider {
  const normalizedProviderName = providerName.toLowerCase().trim();
  
  if (normalizedProviderName === 'alpaca') {
    return new AlpacaDataProvider(integration);
  } else if (normalizedProviderName === 'yahoo') {
    return new YahooDataProvider();
  } else if (normalizedProviderName === 'polygon' || normalizedProviderName.includes('polygon.io')) {
    // For providers with possible name variations, log what we're doing
    if (integration) {
      console.log(`Creating Polygon.io provider with integration ID ${integration.id}`);
    } else {
      console.log(`Creating Polygon.io provider without integration`);
    }
    return new PolygonDataProvider(integration);
  } else {
    // Default to Yahoo as it doesn't require API keys
    console.warn(`Unknown provider: ${providerName}, using Yahoo Finance as fallback`);
    return new YahooDataProvider();
  }
}

/**
 * Convert our standard timeframe format to Alpaca's format
 * @param timeframe Our timeframe format (e.g., '1D', '1H')
 * @returns Alpaca timeframe format
 */
function timeframeToAlpacaTimeframe(timeframe: string): string {
  // Alpaca uses format like '1Day', '1Hour', etc.
  const match = timeframe.match(/(\d+)([DHMS])/i);
  if (!match) return '1Day'; // Default to daily
  
  const [, count, unit] = match;
  const unitMap: Record<string, string> = {
    'd': 'Day',
    'h': 'Hour',
    'm': 'Min',
    's': 'Sec'
  };
  
  return `${count}${unitMap[unit.toLowerCase()]}`;
}

/**
 * Convert our standard timeframe to Yahoo Finance parameters
 * @param timeframe Our timeframe format (e.g., '1D', '1H')
 * @param startDate Start date string
 * @param endDate End date string
 * @returns Yahoo Finance period and interval
 */
function timeframeToYahooParams(timeframe: string, startDate: string, endDate: string): { period: string, interval: string } {
  // Calculate the appropriate period and interval for Yahoo Finance
  const match = timeframe.match(/(\d+)([DHMS])/i);
  let interval = '1d'; // Default to daily
  
  if (match) {
    const [, count, unit] = match;
    
    switch (unit.toLowerCase()) {
      case 'd':
        interval = '1d';
        break;
      case 'h':
        interval = '1h';
        break;
      case 'm':
        interval = '5m'; // Yahoo's minimum for intraday
        break;
      default:
        interval = '1d';
    }
  }
  
  // For Yahoo, we just use max (we'll filter by date later)
  return { period: 'max', interval };
}