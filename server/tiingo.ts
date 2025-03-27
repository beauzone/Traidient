/**
 * Tiingo API client for market data
 */

import axios from 'axios';
import { ApiIntegration } from '@shared/schema';

export default class TiingoAPI {
  private apiKey: string;
  private restBaseUrl: string = 'https://api.tiingo.com';
  public isValid: boolean;
  private integrationId?: number;

  /**
   * Creates a new Tiingo API client
   * @param apiKeyOrIntegration Either an API key string or the full integration object
   */
  constructor(apiKeyOrIntegration?: string | ApiIntegration) {
    // If the parameter is a string, treat it as the API key
    if (typeof apiKeyOrIntegration === 'string') {
      this.apiKey = apiKeyOrIntegration;
      this.isValid = !!this.apiKey;
    } 
    // If it's an integration object, extract the API key
    else if (apiKeyOrIntegration?.credentials?.apiKey) {
      this.apiKey = apiKeyOrIntegration.credentials.apiKey;
      this.integrationId = apiKeyOrIntegration.id;
      this.isValid = true;
    } 
    // Fall back to environment variable
    else if (process.env.TIINGO_API_KEY) {
      this.apiKey = process.env.TIINGO_API_KEY;
      this.isValid = true;
    } 
    // If no API key is available, mark as invalid
    else {
      this.apiKey = '';
      this.isValid = false;
      console.warn('Tiingo API initialized without API key');
    }
  }

  /**
   * Verifies the API connection by attempting to fetch a simple data point
   * @returns Validation result
   */
  async verifyConnection(): Promise<{ isValid: boolean; message: string }> {
    if (!this.apiKey) {
      return { isValid: false, message: 'Missing API key' };
    }

    try {
      // Try to fetch a simple data point to verify the API key
      const response = await axios.get(`${this.restBaseUrl}/tiingo/daily/AAPL/prices`, {
        params: { token: this.apiKey }
      });

      if (response.status === 200 && Array.isArray(response.data)) {
        return { isValid: true, message: 'Connection successful' };
      } else {
        return { isValid: false, message: 'API returned unexpected data format' };
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return { isValid: false, message: 'Invalid API key' };
      }
      return {
        isValid: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Gets the latest quote for a symbol
   * @param symbol Stock symbol
   * @returns Quote data
   */
  async getQuote(symbol: string): Promise<any> {
    if (!this.isValid) {
      throw new Error('Tiingo API not properly initialized with valid API key');
    }

    try {
      // Get latest price data
      const priceResponse = await axios.get(`${this.restBaseUrl}/tiingo/daily/${symbol}/prices`, {
        params: {
          token: this.apiKey,
          startDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], // 2 days ago
          endDate: new Date().toISOString().split('T')[0], // today
          resampleFreq: 'daily'
        }
      });

      if (!priceResponse.data || !priceResponse.data.length) {
        throw new Error('No price data returned');
      }

      // Get ticker metadata
      const metaResponse = await axios.get(`${this.restBaseUrl}/tiingo/daily/${symbol}`, {
        params: { token: this.apiKey }
      });

      const latestPrice = priceResponse.data[priceResponse.data.length - 1];
      const prevPrice = priceResponse.data.length > 1 
        ? priceResponse.data[priceResponse.data.length - 2] 
        : { adjClose: latestPrice.adjClose };

      const price = latestPrice.adjClose;
      const change = price - prevPrice.adjClose;
      const changePercent = (change / prevPrice.adjClose) * 100;

      return {
        symbol: symbol,
        name: metaResponse.data.name || symbol,
        price: price,
        change: change,
        changePercent: changePercent,
        open: latestPrice.adjOpen,
        high: latestPrice.adjHigh,
        low: latestPrice.adjLow,
        volume: latestPrice.adjVolume,
        dataSource: 'tiingo'
      };
    } catch (error) {
      console.error('Tiingo API quote error:', error);
      throw error;
    }
  }

  /**
   * Gets historical market data for a symbol
   * @param symbol Stock symbol
   * @param timeframe Timeframe string (e.g., '1D', '1M')
   * @param limit Number of bars to return
   * @returns Historical market data
   */
  async getHistoricalData(symbol: string, timeframe: string = '1D', limit: number = 100): Promise<any> {
    if (!this.isValid) {
      throw new Error('Tiingo API not properly initialized with valid API key');
    }

    // Determine start date based on timeframe
    const endDate = new Date();
    let startDate = new Date();
    let resampleFreq = 'daily';

    if (timeframe === '1D') {
      // For 1D, we need intraday data
      return this.getIntradayData(symbol, limit);
    } else if (timeframe === '5D') {
      startDate.setDate(startDate.getDate() - 5);
      resampleFreq = 'hourly';
    } else if (timeframe === '1M') {
      startDate.setMonth(startDate.getMonth() - 1);
      resampleFreq = 'daily';
    } else if (timeframe === '3M') {
      startDate.setMonth(startDate.getMonth() - 3);
      resampleFreq = 'daily';
    } else if (timeframe === '1Y') {
      startDate.setFullYear(startDate.getFullYear() - 1);
      resampleFreq = 'daily';
    } else if (timeframe === '5Y') {
      startDate.setFullYear(startDate.getFullYear() - 5);
      resampleFreq = 'weekly';
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
      const response = await axios.get(`${this.restBaseUrl}/tiingo/daily/${symbol}/prices`, {
        params: {
          token: this.apiKey,
          startDate: startDateStr,
          endDate: endDateStr,
          resampleFreq: resampleFreq
        }
      });

      if (!response.data || !response.data.length) {
        throw new Error('No historical data returned');
      }

      // Convert to our bar format
      const bars = response.data
        .slice(-limit)
        .map((bar: any) => ({
          t: new Date(bar.date).toISOString(),
          o: bar.adjOpen,
          h: bar.adjHigh,
          l: bar.adjLow,
          c: bar.adjClose,
          v: bar.adjVolume
        }));

      return {
        symbol: symbol,
        bars: bars,
        isSimulated: false,
        dataSource: 'tiingo'
      };
    } catch (error) {
      console.error('Tiingo API historical data error:', error);
      throw error;
    }
  }

  /**
   * Gets intraday data for the last day
   * @param symbol Stock symbol
   * @param limit Number of bars to return
   * @returns Intraday historical data
   */
  private async getIntradayData(symbol: string, limit: number): Promise<any> {
    // Set date range for today
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDateStr = yesterday.toISOString();
    const endDateStr = today.toISOString();

    try {
      const response = await axios.get(`${this.restBaseUrl}/iex/${symbol}/prices`, {
        params: {
          token: this.apiKey,
          startDate: startDateStr,
          endDate: endDateStr,
          resampleFreq: '5min'
        }
      });

      if (!response.data || !response.data.length) {
        throw new Error('No intraday data returned');
      }

      // Convert to our bar format and limit the number of bars
      const bars = response.data
        .slice(-limit)
        .map((bar: any) => ({
          t: new Date(bar.date).toISOString(),
          o: bar.open,
          h: bar.high,
          l: bar.low,
          c: bar.close,
          v: bar.volume
        }));

      return {
        symbol: symbol,
        bars: bars,
        isSimulated: false,
        dataSource: 'tiingo'
      };
    } catch (error) {
      console.error('Tiingo API intraday data error:', error);
      throw error;
    }
  }

  /**
   * Checks if the US stock market is currently open
   * @returns Boolean indicating if the market is open
   */
  isMarketOpen(): boolean {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Get NY time by adding offset (UTC-4 or UTC-5 depending on daylight saving)
    const nyDate = new Date(now);
    // Approximate DST check (proper impl would use a timezone library)
    const isDST = this.isDateInDST(now);
    // EST is UTC-5, EDT is UTC-4
    const offset = isDST ? -4 : -5;
    nyDate.setHours(now.getHours() + offset + now.getTimezoneOffset() / 60);
    
    const nyHour = nyDate.getHours();
    const nyMinute = nyDate.getMinutes();
    
    // Market is closed on weekends (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Regular market hours are 9:30 AM - 4:00 PM Eastern Time
    // We'll return true if we're in those hours
    if ((nyHour > 9 || (nyHour === 9 && nyMinute >= 30)) && nyHour < 16) {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if a date is in Daylight Saving Time
   * This is a simplified check - a production system would use a more robust timezone library
   */
  private isDateInDST(date: Date): boolean {
    // DST in the US starts on the second Sunday in March
    // and ends on the first Sunday in November
    const year = date.getFullYear();
    const march = new Date(year, 2, 1); // March 1
    const november = new Date(year, 10, 1); // November 1
    
    // Find second Sunday in March
    const daysUntilSecondSundayInMarch = (14 - march.getDay()) % 7;
    const secondSundayInMarch = new Date(year, 2, 1 + daysUntilSecondSundayInMarch + 7);
    secondSundayInMarch.setHours(2); // DST starts at 2 AM local time
    
    // Find first Sunday in November
    const daysUntilFirstSundayInNov = (7 - november.getDay()) % 7;
    const firstSundayInNov = new Date(year, 10, 1 + daysUntilFirstSundayInNov);
    firstSundayInNov.setHours(2); // DST ends at 2 AM local time
    
    return date >= secondSundayInMarch && date < firstSundayInNov;
  }
}