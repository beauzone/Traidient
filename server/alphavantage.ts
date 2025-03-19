/**
 * Alpha Vantage API client for market data
 */

import axios from 'axios';
import { ApiIntegration } from '@shared/schema';

export default class AlphaVantageAPI {
  private apiKey: string;
  private baseUrl: string = 'https://www.alphavantage.co/query';
  private isValid: boolean;
  private integrationId?: number;

  /**
   * Creates a new Alpha Vantage API client
   * @param integration Optional API integration details
   */
  constructor(integration?: ApiIntegration) {
    if (integration?.credentials?.apiKey) {
      this.apiKey = integration.credentials.apiKey;
      this.integrationId = integration.id;
      this.isValid = true;
    } else if (process.env.ALPHAVANTAGE_API_KEY) {
      this.apiKey = process.env.ALPHAVANTAGE_API_KEY;
      this.isValid = true;
    } else {
      this.apiKey = '';
      this.isValid = false;
      console.warn('Alpha Vantage API initialized without API key');
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
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: 'IBM',
          apikey: this.apiKey
        }
      });

      if (response.data && !response.data.Note && !response.data['Error Message']) {
        return { isValid: true, message: 'Connection successful' };
      } else if (response.data.Note) {
        return { isValid: false, message: response.data.Note };
      } else if (response.data['Error Message']) {
        return { isValid: false, message: response.data['Error Message'] };
      } else {
        return { isValid: false, message: 'Unknown API response' };
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
      throw new Error('Alpha Vantage API not properly initialized with valid API key');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: this.apiKey
        }
      });

      // Check for API errors
      if (response.data.Note) {
        throw new Error(response.data.Note);
      }
      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      const quote = response.data['Global Quote'];
      if (!quote || !quote['05. price']) {
        throw new Error('No quote data returned');
      }

      // Process the quote data
      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
      const volume = parseInt(quote['06. volume']);

      // Get company information (Alpha Vantage doesn't include company name in quote)
      const companyResponse = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol: symbol,
          apikey: this.apiKey
        }
      });

      const name = companyResponse.data.Name || symbol;

      return {
        symbol: symbol,
        name: name,
        price: price,
        change: change,
        changePercent: changePercent,
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        volume: volume,
        prevClose: parseFloat(quote['08. previous close']),
        lastTradingDay: quote['07. latest trading day'],
        dataSource: 'alphavantage'
      };
    } catch (error) {
      console.error('Alpha Vantage API quote error:', error);
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
      throw new Error('Alpha Vantage API not properly initialized with valid API key');
    }

    // Map timeframe to Alpha Vantage function and interval
    let functionName = 'TIME_SERIES_DAILY';
    let interval = 'daily';
    let outputSize = 'compact'; // compact returns the latest 100 data points

    if (timeframe === '1D') {
      functionName = 'TIME_SERIES_INTRADAY';
      interval = '5min';
      outputSize = 'full'; // We need full for intraday to get more data points
    } else if (timeframe === '5D') {
      functionName = 'TIME_SERIES_INTRADAY';
      interval = '15min';
      outputSize = 'full';
    } else if (timeframe === '1M') {
      functionName = 'TIME_SERIES_DAILY';
      interval = 'daily';
    } else if (timeframe === '3M') {
      functionName = 'TIME_SERIES_DAILY';
      interval = 'daily';
      outputSize = 'full';
    } else if (timeframe === '1Y') {
      functionName = 'TIME_SERIES_WEEKLY';
      interval = 'weekly';
    } else if (timeframe === '5Y') {
      functionName = 'TIME_SERIES_MONTHLY';
      interval = 'monthly';
    }

    try {
      const params: Record<string, string> = {
        function: functionName,
        symbol: symbol,
        apikey: this.apiKey,
        outputsize: outputSize
      };

      // Add interval for intraday
      if (functionName === 'TIME_SERIES_INTRADAY') {
        params.interval = interval;
      }

      const response = await axios.get(this.baseUrl, { params });

      // Check for API errors
      if (response.data.Note) {
        throw new Error(response.data.Note);
      }
      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      // Determine the time series key based on the function
      let timeSeriesKey = '';
      if (functionName === 'TIME_SERIES_INTRADAY') {
        timeSeriesKey = `Time Series (${interval})`;
      } else if (functionName === 'TIME_SERIES_DAILY') {
        timeSeriesKey = 'Time Series (Daily)';
      } else if (functionName === 'TIME_SERIES_WEEKLY') {
        timeSeriesKey = 'Weekly Time Series';
      } else if (functionName === 'TIME_SERIES_MONTHLY') {
        timeSeriesKey = 'Monthly Time Series';
      }

      const timeSeries = response.data[timeSeriesKey];
      if (!timeSeries) {
        throw new Error('No time series data returned');
      }

      // Convert time series to bars in our format
      const bars = Object.entries(timeSeries)
        .map(([timestamp, data]: [string, any]) => ({
          t: new Date(timestamp).toISOString(),
          o: parseFloat(data['1. open']),
          h: parseFloat(data['2. high']),
          l: parseFloat(data['3. low']),
          c: parseFloat(data['4. close']),
          v: parseInt(data['5. volume'])
        }))
        .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
        .slice(-limit);

      return {
        symbol: symbol,
        bars: bars,
        isSimulated: false,
        dataSource: 'alphavantage'
      };
    } catch (error) {
      console.error('Alpha Vantage API historical data error:', error);
      throw error;
    }
  }

  /**
   * Alpha Vantage doesn't provide a direct market status API, so we'll use a time-based check
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