/**
 * Market Data Provider Adapters for Screeners
 * 
 * This module implements adapters for various market data providers
 * to connect them to the screener system through a unified interface.
 * 
 * Using the Adapter Pattern to connect the existing market data providers
 * to the ScreenerMarketDataProvider interface.
 */

import { ApiIntegration } from '@shared/schema';
import { ScreenerMarketDataProvider } from './marketDataProviderInterface';
import { AlpacaAPI } from './alpaca';
import { YahooFinanceAPI } from './yahoo';
import AlphaVantageAPI from './alphavantage';
import PolygonAPI from './polygon';
import TiingoAPI from './tiingo';

/**
 * Helper function to convert DataFrame-like market data to standardized multiindex format expected by screeners
 */
function convertToScreenerFormat(data: any, provider: string): any {
  // This is a placeholder for actual conversion logic
  // In a real implementation, this would convert various provider formats to a standard DataFrame format
  
  // For now, we'll assume the data is already in the correct format
  return {
    ...data,
    provider
  };
}

/**
 * Alpaca Data Provider Adapter for Screeners
 */
export class AlpacaDataProviderAdapter implements ScreenerMarketDataProvider {
  private alpaca: AlpacaAPI;
  public readonly provider = 'alpaca';
  
  constructor(integration?: ApiIntegration) {
    this.alpaca = new AlpacaAPI(integration);
  }
  
  get isValid(): boolean {
    return this.alpaca.isValid;
  }
  
  async getHistoricalData(symbols: string | string[], period = '3mo', interval = '1d'): Promise<any> {
    try {
      // Convert to array if single symbol
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      
      // Convert period to date range
      const endDate = new Date().toISOString();
      let startDate: string;
      
      // Parse period string to determine start date
      if (period.endsWith('d')) {
        const days = parseInt(period.replace('d', ''));
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString();
      } else if (period.endsWith('mo')) {
        const months = parseInt(period.replace('mo', ''));
        const start = new Date();
        start.setMonth(start.getMonth() - months);
        startDate = start.toISOString();
      } else if (period.endsWith('y')) {
        const years = parseInt(period.replace('y', ''));
        const start = new Date();
        start.setFullYear(start.getFullYear() - years);
        startDate = start.toISOString();
      } else if (period === 'ytd') {
        const start = new Date();
        start.setMonth(0, 1);
        startDate = start.toISOString();
      } else {
        // Default to 3 months
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        startDate = start.toISOString();
      }
      
      // For multiple symbols, fetch data for each and combine
      const results: any = {};
      const barsBySymbol: any = {};
      
      // Limit batch size to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < symbolArray.length; i += batchSize) {
        const batch = symbolArray.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            // Get market data
            const data = await this.alpaca.getMarketData(
              symbol,
              interval,
              1000, // Reasonable default limit
              startDate,
              endDate
            );
            
            // Store the data
            if (data && data.bars && data.bars.length > 0) {
              barsBySymbol[symbol] = data.bars;
            }
          } catch (error) {
            console.error(`Error fetching Alpaca data for ${symbol}:`, error);
          }
        }));
        
        // Rate limiting - sleep between batches
        if (i + batchSize < symbolArray.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Format data for screeners (pandas-like multiindex DataFrame)
      const formattedData = {
        symbols: Object.keys(barsBySymbol),
        data: barsBySymbol,
        provider: this.provider
      };
      
      return formattedData;
    } catch (error) {
      console.error(`Error in AlpacaDataProviderAdapter.getHistoricalData:`, error);
      throw error;
    }
  }
  
  async calculateIndicators(data: any): Promise<any> {
    // This would be implemented in Python, but we expose the method for interface compatibility
    return {
      ...data,
      message: 'Indicators will be calculated in Python'
    };
  }
  
  async getStockUniverse(universeType = 'default'): Promise<string[]> {
    try {
      // For Alpaca, we'll use the account's watchlist or tradable assets
      // In a real implementation, we would have more sophisticated universe logic
      const assets = await this.alpaca.getAssets();
      
      // Filter based on universe type
      let symbols: string[] = [];
      
      if (universeType === 'default') {
        // Default to a reasonable set of tradable stocks
        symbols = assets.filter((asset: any) => 
          asset.status === 'active' && 
          asset.tradable && 
          asset.exchange !== 'OTC'
        ).map((asset: any) => asset.symbol);
        
        // Limit to reasonable number
        symbols = symbols.slice(0, 100);
      } else if (universeType === 'sp500') {
        // For S&P 500, we would need a separate data source
        // For now, just return a message that it's not implemented
        console.log("S&P 500 universe not directly available from Alpaca");
        return [];
      } else if (universeType === 'nasdaq100') {
        // Similar to S&P 500
        console.log("NASDAQ 100 universe not directly available from Alpaca");
        return [];
      }
      
      return symbols;
    } catch (error) {
      console.error(`Error getting stock universe from Alpaca:`, error);
      return [];
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    try {
      return await this.alpaca.isMarketOpen();
    } catch (error) {
      console.error(`Error checking if market is open from Alpaca:`, error);
      
      // Default to weekday check as fallback
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      
      // Simple check: market is open on weekdays between 9:30 and 16:00 ET
      return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
    }
  }
}

/**
 * Yahoo Finance Data Provider Adapter for Screeners
 */
export class YahooDataProviderAdapter implements ScreenerMarketDataProvider {
  private yahoo: YahooFinanceAPI;
  public readonly provider = 'yahoo';
  public readonly isValid = true; // Yahoo Finance doesn't require API keys
  
  constructor() {
    this.yahoo = new YahooFinanceAPI();
  }
  
  async getHistoricalData(symbols: string | string[], period = '3mo', interval = '1d'): Promise<any> {
    try {
      // Convert to array if single symbol
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      
      // For multiple symbols, fetch data for each and combine
      const results: any = {};
      const barsBySymbol: any = {};
      
      // Limit batch size to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < symbolArray.length; i += batchSize) {
        const batch = symbolArray.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            // Convert to Yahoo's format
            const { period: yahooPeriod, interval: yahooInterval } = this.convertToYahooParams(period, interval);
            
            // Get historical data
            const data = await this.yahoo.getHistoricalData(symbol, yahooPeriod, yahooInterval);
            
            // Store the data
            if (data && data.bars && data.bars.length > 0) {
              barsBySymbol[symbol] = data.bars;
            }
          } catch (error) {
            console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error);
          }
        }));
        
        // Rate limiting - sleep between batches
        if (i + batchSize < symbolArray.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Format data for screeners (pandas-like multiindex DataFrame)
      const formattedData = {
        symbols: Object.keys(barsBySymbol),
        data: barsBySymbol,
        provider: this.provider
      };
      
      return formattedData;
    } catch (error) {
      console.error(`Error in YahooDataProviderAdapter.getHistoricalData:`, error);
      throw error;
    }
  }
  
  private convertToYahooParams(period: string, interval: string): { period: string, interval: string } {
    // Yahoo Finance uses different period/interval format
    let yahooPeriod: string;
    let yahooInterval: string;
    
    // Convert interval
    if (interval === '1d') yahooInterval = '1d';
    else if (interval === '1h') yahooInterval = '1h';
    else if (interval === '1wk') yahooInterval = '1wk';
    else if (interval === '1mo') yahooInterval = '1mo';
    else yahooInterval = '1d'; // default
    
    // Convert period
    if (period === '1d') yahooPeriod = '1d';
    else if (period === '5d') yahooPeriod = '5d';
    else if (period === '1mo') yahooPeriod = '1mo';
    else if (period === '3mo') yahooPeriod = '3mo';
    else if (period === '6mo') yahooPeriod = '6mo';
    else if (period === '1y') yahooPeriod = '1y';
    else if (period === '2y') yahooPeriod = '2y';
    else if (period === '5y') yahooPeriod = '5y';
    else if (period === '10y') yahooPeriod = '10y';
    else if (period === 'ytd') yahooPeriod = 'ytd';
    else if (period === 'max') yahooPeriod = 'max';
    else yahooPeriod = '3mo'; // default
    
    return { period: yahooPeriod, interval: yahooInterval };
  }
  
  async calculateIndicators(data: any): Promise<any> {
    // This would be implemented in Python, but we expose the method for interface compatibility
    return {
      ...data,
      message: 'Indicators will be calculated in Python'
    };
  }
  
  async getStockUniverse(universeType = 'default'): Promise<string[]> {
    try {
      // For Yahoo Finance, we need to load predefined lists
      // In a real implementation, we would have more sophisticated universe logic
      
      // Define some common stock lists
      const defaultSymbols = [
        'AAPL', 'MSFT', 'AMZN', 'GOOG', 'META', 'TSLA', 'NVDA', 'JPM',
        'V', 'JNJ', 'WMT', 'MA', 'PG', 'HD', 'BAC', 'DIS', 'ADBE', 'CRM',
        'NFLX', 'INTC', 'VZ', 'KO', 'CSCO', 'PEP', 'CMCSA', 'ABT', 'MRK'
      ];
      
      if (universeType === 'default') {
        return defaultSymbols;
      } else if (universeType === 'sp500') {
        // We would need to fetch the S&P 500 list from an external source
        // For now, just return a message that it's not implemented
        console.log("S&P 500 universe needs to be fetched externally");
        return defaultSymbols;
      } else if (universeType === 'nasdaq100') {
        // Similar to S&P 500
        console.log("NASDAQ 100 universe needs to be fetched externally");
        return defaultSymbols;
      }
      
      return defaultSymbols;
    } catch (error) {
      console.error(`Error getting stock universe:`, error);
      return [];
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    try {
      // Yahoo Finance doesn't have a direct market status API
      // So we'll use a time-based check as a reasonable approximation
      
      // Get current date in US Eastern time
      const now = new Date();
      const day = now.getDay();
      
      // Check if it's a weekday (Monday-Friday)
      if (day === 0 || day === 6) {
        return false; // Weekend
      }
      
      // Convert to US Eastern Time (ET)
      const etOptions = { timeZone: 'America/New_York' };
      const etTimeStr = now.toLocaleTimeString('en-US', etOptions);
      const etTime = new Date(`1/1/1970 ${etTimeStr}`);
      
      const etHours = etTime.getHours();
      const etMinutes = etTime.getMinutes();
      const etTimeInMinutes = etHours * 60 + etMinutes;
      
      // Regular market hours: 9:30 AM - 4:00 PM ET
      const marketOpenInMinutes = 9 * 60 + 30;  // 9:30 AM
      const marketCloseInMinutes = 16 * 60;      // 4:00 PM
      
      return etTimeInMinutes >= marketOpenInMinutes && etTimeInMinutes < marketCloseInMinutes;
    } catch (error) {
      console.error(`Error checking if market is open:`, error);
      
      // Default to weekday check as fallback
      const now = new Date();
      const day = now.getDay();
      
      // Simple check: market is open on weekdays
      return day >= 1 && day <= 5;
    }
  }
}

/**
 * Polygon.io Data Provider Adapter for Screeners
 */
export class PolygonDataProviderAdapter implements ScreenerMarketDataProvider {
  private polygon: PolygonAPI;
  public readonly provider = 'polygon';
  
  constructor(integration?: ApiIntegration) {
    this.polygon = new PolygonAPI(integration);
  }
  
  get isValid(): boolean {
    return this.polygon.isValid;
  }
  
  async getHistoricalData(symbols: string | string[], period = '3mo', interval = '1d'): Promise<any> {
    try {
      // Convert to array if single symbol
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      
      // For multiple symbols, fetch data for each and combine
      const barsBySymbol: any = {};
      
      // Limit batch size to avoid rate limits
      const batchSize = 5; // Polygon has stricter rate limits
      for (let i = 0; i < symbolArray.length; i += batchSize) {
        const batch = symbolArray.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            // Polygon API expects different parameters
            const data = await this.polygon.getHistoricalData(symbol, interval, 1000);
            
            // Store the data
            if (data && data.bars && data.bars.length > 0) {
              barsBySymbol[symbol] = data.bars;
            }
          } catch (error) {
            console.error(`Error fetching Polygon.io data for ${symbol}:`, error);
          }
        }));
        
        // Rate limiting - sleep between batches (Polygon has stricter limits)
        if (i + batchSize < symbolArray.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Format data for screeners (pandas-like multiindex DataFrame)
      const formattedData = {
        symbols: Object.keys(barsBySymbol),
        data: barsBySymbol,
        provider: this.provider
      };
      
      return formattedData;
    } catch (error) {
      console.error(`Error in PolygonDataProviderAdapter.getHistoricalData:`, error);
      throw error;
    }
  }
  
  async calculateIndicators(data: any): Promise<any> {
    // This would be implemented in Python, but we expose the method for interface compatibility
    return {
      ...data,
      message: 'Indicators will be calculated in Python'
    };
  }
  
  async getStockUniverse(universeType = 'default'): Promise<string[]> {
    try {
      // For Polygon, we can query their stocks API
      const tickers = await this.polygon.getTickerList(universeType);
      return tickers;
    } catch (error) {
      console.error(`Error getting stock universe from Polygon:`, error);
      
      // Fallback to default list
      const defaultSymbols = [
        'AAPL', 'MSFT', 'AMZN', 'GOOG', 'META', 'TSLA', 'NVDA', 'JPM'
      ];
      return defaultSymbols;
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    try {
      return await this.polygon.isMarketOpen();
    } catch (error) {
      console.error(`Error checking if market is open from Polygon:`, error);
      
      // Default to weekday check as fallback
      const now = new Date();
      const day = now.getDay();
      
      // Simple check: market is open on weekdays
      return day >= 1 && day <= 5;
    }
  }
}

/**
 * Alpha Vantage Data Provider Adapter for Screeners
 */
export class AlphaVantageDataProviderAdapter implements ScreenerMarketDataProvider {
  private alphaVantage: AlphaVantageAPI;
  public readonly provider = 'alphavantage';
  
  constructor(integration?: ApiIntegration) {
    this.alphaVantage = new AlphaVantageAPI(integration);
  }
  
  get isValid(): boolean {
    return this.alphaVantage.isValid;
  }
  
  async getHistoricalData(symbols: string | string[], period = '3mo', interval = '1d'): Promise<any> {
    try {
      // Convert to array if single symbol
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      
      // For multiple symbols, fetch data for each and combine
      const barsBySymbol: any = {};
      
      // Alpha Vantage has strict rate limits (5 API calls per minute for free tier)
      // So we need to process symbols one by one with delays
      for (const symbol of symbolArray) {
        try {
          // AlphaVantage uses different parameters
          // For daily data
          const functionParam = interval === '1d' ? 'TIME_SERIES_DAILY' : 
                               interval === '1wk' ? 'TIME_SERIES_WEEKLY' : 
                               interval === '1mo' ? 'TIME_SERIES_MONTHLY' : 'TIME_SERIES_DAILY';
          
          const data = await this.alphaVantage.getTimeSeries(symbol, functionParam);
          
          // Store the data
          if (data && data.bars && data.bars.length > 0) {
            barsBySymbol[symbol] = data.bars;
          }
          
          // Delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 12000)); // 5 calls per minute = 12s between calls
        } catch (error) {
          console.error(`Error fetching Alpha Vantage data for ${symbol}:`, error);
        }
      }
      
      // Format data for screeners (pandas-like multiindex DataFrame)
      const formattedData = {
        symbols: Object.keys(barsBySymbol),
        data: barsBySymbol,
        provider: this.provider
      };
      
      return formattedData;
    } catch (error) {
      console.error(`Error in AlphaVantageDataProviderAdapter.getHistoricalData:`, error);
      throw error;
    }
  }
  
  async calculateIndicators(data: any): Promise<any> {
    // This would be implemented in Python, but we expose the method for interface compatibility
    return {
      ...data,
      message: 'Indicators will be calculated in Python'
    };
  }
  
  async getStockUniverse(universeType = 'default'): Promise<string[]> {
    // Alpha Vantage doesn't have a specific endpoint for stock universes
    // We'll return a default list
    
    // Define some common stock lists
    const defaultSymbols = [
      'AAPL', 'MSFT', 'AMZN', 'GOOG', 'META', 'TSLA', 'NVDA', 'JPM'
    ];
    
    if (universeType === 'default') {
      return defaultSymbols;
    } else {
      console.log(`${universeType} universe not available from Alpha Vantage`);
      return defaultSymbols;
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    // Alpha Vantage doesn't have a market status API
    // So we'll use a time-based check as a reasonable approximation
    
    // Default to weekday check as fallback
    const now = new Date();
    const day = now.getDay();
    
    // Simple check: market is open on weekdays
    return day >= 1 && day <= 5;
  }
}

/**
 * Tiingo Data Provider Adapter for Screeners
 */
export class TiingoDataProviderAdapter implements ScreenerMarketDataProvider {
  private tiingo: TiingoAPI;
  public readonly provider = 'tiingo';
  
  constructor(integration?: ApiIntegration) {
    this.tiingo = new TiingoAPI(integration);
  }
  
  get isValid(): boolean {
    return this.tiingo.isValid;
  }
  
  async getHistoricalData(symbols: string | string[], period = '3mo', interval = '1d'): Promise<any> {
    try {
      // Convert to array if single symbol
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      
      // For multiple symbols, fetch data for each and combine
      const barsBySymbol: any = {};
      
      // Limit batch size to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < symbolArray.length; i += batchSize) {
        const batch = symbolArray.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            // Get market data
            const data = await this.tiingo.getHistoricalData(symbol, interval);
            
            // Store the data
            if (data && data.bars && data.bars.length > 0) {
              barsBySymbol[symbol] = data.bars;
            }
          } catch (error) {
            console.error(`Error fetching Tiingo data for ${symbol}:`, error);
          }
        }));
        
        // Rate limiting - sleep between batches
        if (i + batchSize < symbolArray.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Format data for screeners (pandas-like multiindex DataFrame)
      const formattedData = {
        symbols: Object.keys(barsBySymbol),
        data: barsBySymbol,
        provider: this.provider
      };
      
      return formattedData;
    } catch (error) {
      console.error(`Error in TiingoDataProviderAdapter.getHistoricalData:`, error);
      throw error;
    }
  }
  
  async calculateIndicators(data: any): Promise<any> {
    // This would be implemented in Python, but we expose the method for interface compatibility
    return {
      ...data,
      message: 'Indicators will be calculated in Python'
    };
  }
  
  async getStockUniverse(universeType = 'default'): Promise<string[]> {
    try {
      // Tiingo has supported tickers endpoint
      const tickers = await this.tiingo.getSupportedTickers();
      
      // Limit to reasonable number based on universe type
      if (universeType === 'default') {
        return tickers.slice(0, 100);
      } else {
        console.log(`${universeType} universe not specifically supported by Tiingo`);
        return tickers.slice(0, 100);
      }
    } catch (error) {
      console.error(`Error getting stock universe from Tiingo:`, error);
      
      // Fallback to default list
      const defaultSymbols = [
        'AAPL', 'MSFT', 'AMZN', 'GOOG', 'META', 'TSLA', 'NVDA', 'JPM'
      ];
      return defaultSymbols;
    }
  }
  
  async isMarketOpen(): Promise<boolean> {
    // Tiingo doesn't have a market status API
    // So we'll use a time-based check as a reasonable approximation
    
    // Default to weekday check as fallback
    const now = new Date();
    const day = now.getDay();
    
    // Simple check: market is open on weekdays
    return day >= 1 && day <= 5;
  }
}