/**
 * Polygon.io API client for real-time and historical market data
 */

import axios from 'axios';
import { ApiIntegration } from '@shared/schema';

export default class PolygonAPI {
  private apiKey: string;
  private baseUrl: string = 'https://api.polygon.io';
  private isValid: boolean;
  private integrationId?: number;

  /**
   * Creates a new Polygon.io API client
   * @param integration Optional API integration details
   */
  constructor(integration?: ApiIntegration) {
    if (integration?.credentials?.apiKey) {
      this.apiKey = integration.credentials.apiKey;
      this.integrationId = integration.id;
      this.isValid = true;
    } else if (process.env.POLYGON_API_KEY) {
      this.apiKey = process.env.POLYGON_API_KEY;
      this.isValid = true;
    } else {
      this.apiKey = '';
      this.isValid = false;
      console.warn('Polygon API initialized without API key');
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
      const response = await axios.get(`${this.baseUrl}/v2/aggs/ticker/AAPL/prev`, {
        params: { apiKey: this.apiKey }
      });

      if (response.status === 200) {
        return { isValid: true, message: 'Connection successful' };
      } else {
        return { isValid: false, message: `API returned status code ${response.status}` };
      }
    } catch (error) {
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
      throw new Error('Polygon API not properly initialized with valid API key');
    }

    try {
      // Get the latest trade
      const quoteResponse = await axios.get(`${this.baseUrl}/v2/last/trade/${symbol}`, {
        params: { apiKey: this.apiKey }
      });

      // Also get the previous day's close to calculate change
      const prevResponse = await axios.get(`${this.baseUrl}/v2/aggs/ticker/${symbol}/prev`, {
        params: { apiKey: this.apiKey }
      });

      const quote = quoteResponse.data.results;
      const prevClose = prevResponse.data.results ? prevResponse.data.results.c : null;

      // Calculate price change
      const price = quote.p;
      const change = prevClose ? price - prevClose : 0;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;

      return {
        symbol: symbol,
        name: symbol, // Polygon doesn't provide company name in this endpoint
        price: price,
        change: change,
        changePercent: changePercent,
        volume: quote.s,
        timestamp: new Date(quote.t).toISOString(),
        dataSource: 'polygon'
      };
    } catch (error) {
      console.error('Polygon API quote error:', error);
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
      throw new Error('Polygon API not properly initialized with valid API key');
    }

    // Convert alpaca timeframes to polygon timeframes
    let multiplier = 1;
    let timespan = 'day';

    if (timeframe === '1D') {
      multiplier = 1;
      timespan = 'minute';
      limit = Math.min(limit, 1000); // Polygon limit
    } else if (timeframe === '5D') {
      multiplier = 5;
      timespan = 'minute';
      limit = Math.min(limit, 1000);
    } else if (timeframe === '1M') {
      multiplier = 1;
      timespan = 'day';
    } else if (timeframe === '3M') {
      multiplier = 1;
      timespan = 'day';
    } else if (timeframe === '1Y') {
      multiplier = 1;
      timespan = 'day';
    } else if (timeframe === '5Y') {
      multiplier = 1;
      timespan = 'week';
    }

    // Calculate from date based on timeframe
    const to = new Date();
    const from = new Date();

    if (timeframe === '1D') {
      from.setDate(from.getDate() - 1);
    } else if (timeframe === '5D') {
      from.setDate(from.getDate() - 5);
    } else if (timeframe === '1M') {
      from.setMonth(from.getMonth() - 1);
    } else if (timeframe === '3M') {
      from.setMonth(from.getMonth() - 3);
    } else if (timeframe === '1Y') {
      from.setFullYear(from.getFullYear() - 1);
    } else if (timeframe === '5Y') {
      from.setFullYear(from.getFullYear() - 5);
    }

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    try {
      const response = await axios.get(
        `${this.baseUrl}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}`, 
        {
          params: { 
            apiKey: this.apiKey,
            limit: limit
          }
        }
      );

      const results = response.data.results || [];

      // Format the response to match our expected format
      const bars = results.map((bar: any) => ({
        t: new Date(bar.t).toISOString(),
        o: bar.o,
        h: bar.h,
        l: bar.l,
        c: bar.c,
        v: bar.v
      }));

      return {
        symbol: symbol,
        bars: bars,
        isSimulated: false,
        dataSource: 'polygon'
      };
    } catch (error) {
      console.error('Polygon API historical data error:', error);
      throw error;
    }
  }

  /**
   * Checks if the US stock market is currently open
   * @returns Boolean indicating if the market is open
   */
  async isMarketOpen(): Promise<boolean> {
    if (!this.isValid) {
      throw new Error('Polygon API not properly initialized with valid API key');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/v1/marketstatus/now`, {
        params: { apiKey: this.apiKey }
      });

      return response.data.market === 'open';
    } catch (error) {
      console.error('Polygon API market status error:', error);
      // Default to basic time-based check if API fails
      return this.isMarketOpenByTime();
    }
  }

  /**
   * Fallback function to check if the market is open based on time
   * @returns Boolean indicating if the market is likely open
   */
  private isMarketOpenByTime(): boolean {
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