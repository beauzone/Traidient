import yahooFinance from 'yahoo-finance2';

// Type definition for Yahoo Finance quote
interface YahooQuote {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  trailingAnnualDividendYield?: number;
  epsTrailingTwelveMonths?: number;
  fullExchangeName?: string;
  exchange?: string;
}

// Type definition for historical data bar
interface HistoricalDataBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Type definition for formatted quote response
interface FormattedQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  dividend: number;
  eps: number;
  exchange: string;
  isSimulated: boolean;
  isYahooData: boolean;
  dataSource: string;
}

// Type definition for historical data response
interface HistoricalDataResponse {
  symbol: string;
  bars: {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }[];
  isSimulated: boolean;
  isYahooData: boolean;
  dataSource: string;
}

// Type definition for search result
interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

// Type definition for trending ticker
interface TrendingTicker {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  exchange: string;
}

/**
 * Yahoo Finance API service for retrieving stock data
 * This is useful for:
 * 1. Non-market hours when real-time data is not needed
 * 2. Historical data for backtesting
 * 3. Getting accurate reference prices
 */
export class YahooFinanceAPI {
  
  /**
   * Get the latest quote for a symbol
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @returns Stock quote data
   */
  async getQuote(symbol: string): Promise<FormattedQuote> {
    try {
      // Get quote snapshot from Yahoo Finance
      const result = await yahooFinance.quote(symbol) as YahooQuote;
      
      // Format the quote data to match our API format
      const formattedQuote: FormattedQuote = {
        symbol: result.symbol,
        name: result.longName || result.shortName || symbol,
        price: result.regularMarketPrice || 0,
        change: result.regularMarketChange || 0,
        changePercent: result.regularMarketChangePercent || 0,
        open: result.regularMarketOpen || 0,
        high: result.regularMarketDayHigh || 0,
        low: result.regularMarketDayLow || 0,
        volume: result.regularMarketVolume || 0,
        marketCap: result.marketCap || 0,
        peRatio: result.trailingPE || 0,
        dividend: result.trailingAnnualDividendYield || 0,
        eps: result.epsTrailingTwelveMonths || 0,
        exchange: result.fullExchangeName || result.exchange || "UNKNOWN",
        isSimulated: false,
        isYahooData: true,
        dataSource: "yahoo"
      };
      
      return formattedQuote;
    } catch (error) {
      console.error(`Error fetching Yahoo quote for ${symbol}:`, error);
      throw new Error(`Failed to fetch Yahoo Finance quote for ${symbol}`);
    }
  }
  
  /**
   * Get historical market data for a symbol
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @param period Period for historical data (e.g., '1d', '1mo', '1y')
   * @param interval Data interval (e.g., '1d', '1wk', '1mo')
   * @returns Historical market data
   */
  async getHistoricalData(symbol: string, period: string = '1mo', interval: string = '1d'): Promise<HistoricalDataResponse> {
    try {
      // Convert interval to a valid value for yahoo-finance2
      const validIntervals = ['1d', '1wk', '1mo'];
      const yahooInterval = validIntervals.includes(interval) ? 
        interval as '1d' | '1wk' | '1mo' : '1d';
      
      // Get historical data from Yahoo Finance
      const result = await yahooFinance.historical(symbol, {
        period1: this.getPeriodStartDate(period),
        period2: new Date(),
        interval: yahooInterval
      });
      
      // Format the data to match our API format
      const bars = result.map((bar: HistoricalDataBar) => ({
        t: bar.date.toISOString(),
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
        isYahooData: true,
        dataSource: "yahoo"
      };
    } catch (error) {
      console.error(`Error fetching Yahoo historical data for ${symbol}:`, error);
      throw new Error(`Failed to fetch Yahoo Finance historical data for ${symbol}`);
    }
  }
  
  /**
   * Get the start date for historical data based on the period
   * @param period Period string (e.g., '1d', '1mo', '1y')
   * @returns Date object for the start date
   */
  private getPeriodStartDate(period: string): Date {
    const today = new Date();
    const periodValue = parseInt(period.slice(0, -1));
    const periodUnit = period.slice(-1);
    
    switch (periodUnit) {
      case 'd':
        // Days
        const daysAgo = new Date(today);
        daysAgo.setDate(today.getDate() - periodValue);
        return daysAgo;
      case 'w':
        // Weeks
        const weeksAgo = new Date(today);
        weeksAgo.setDate(today.getDate() - (periodValue * 7));
        return weeksAgo;
      case 'm':
        // Months
        const monthsAgo = new Date(today);
        monthsAgo.setMonth(today.getMonth() - periodValue);
        return monthsAgo;
      case 'y':
        // Years
        const yearsAgo = new Date(today);
        yearsAgo.setFullYear(today.getFullYear() - periodValue);
        return yearsAgo;
      default:
        // Default to 1 month
        const defaultPeriod = new Date(today);
        defaultPeriod.setMonth(today.getMonth() - 1);
        return defaultPeriod;
    }
  }
  
  /**
   * Search for stocks by a query term
   * @param query Search query (e.g., 'Apple')
   * @returns List of matching stocks
   */
  async search(query: string): Promise<SearchResult[]> {
    try {
      // Search for stocks that match the query
      const result = await yahooFinance.search(query);
      
      // Format the search results
      return result.quotes.map(quote => {
        // Handle potentially undefined properties
        let symbol = "";
        if ('symbol' in quote && typeof quote.symbol === 'string') {
          symbol = quote.symbol;
        }
        
        let name = symbol;
        if ('longname' in quote && typeof quote.longname === 'string') {
          name = quote.longname;
        } else if ('shortname' in quote && typeof quote.shortname === 'string') {
          name = quote.shortname;
        }
        
        let exchange = "UNKNOWN";
        if ('exchange' in quote && typeof quote.exchange === 'string') {
          exchange = quote.exchange;
        }
        
        let type = "EQUITY";
        if ('quoteType' in quote && typeof quote.quoteType === 'string') {
          type = quote.quoteType;
        }
        
        return {
          symbol,
          name,
          exchange,
          type
        };
      });
    } catch (error) {
      console.error(`Error searching Yahoo Finance for ${query}:`, error);
      throw new Error(`Failed to search Yahoo Finance for ${query}`);
    }
  }
  
  /**
   * Check if the US market is currently open
   * @returns Boolean indicating if the market is open
   */
  isMarketOpen(): boolean {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Market is closed on weekends (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Convert current time to Eastern Time (ET) - this is a simplification
    // A proper implementation would use a timezone library
    // Assuming the server is in UTC, Eastern Time is UTC-4 or UTC-5 depending on daylight saving
    // For simplicity, we'll just subtract 4 hours (approximating ET during DST)
    const etHour = (hour - 4 + 24) % 24;
    
    // Regular market hours: 9:30 AM - 4:00 PM ET, Monday to Friday
    if (etHour < 9 || etHour > 16) {
      return false;
    }
    
    if (etHour === 9 && minute < 30) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get trending tickers from Yahoo Finance
   * @returns List of trending tickers
   */
  async getTrendingTickers(): Promise<TrendingTicker[]> {
    try {
      const result = await yahooFinance.trendingSymbols('US');
      
      return result.quotes.map(quote => {
        // Safe property access with fallbacks
        const symbol = typeof quote.symbol === 'string' ? quote.symbol : '';
        const longName = typeof quote.longName === 'string' ? quote.longName : '';
        const shortName = typeof quote.shortName === 'string' ? quote.shortName : '';
        const price = typeof quote.regularMarketPrice === 'number' ? quote.regularMarketPrice : 0;
        const change = typeof quote.regularMarketChange === 'number' ? quote.regularMarketChange : 0;
        const changePercent = typeof quote.regularMarketChangePercent === 'number' ? quote.regularMarketChangePercent : 0;
        const fullExchangeName = typeof quote.fullExchangeName === 'string' ? quote.fullExchangeName : '';
        const exchangeName = typeof quote.exchange === 'string' ? quote.exchange : 'UNKNOWN';
        
        return {
          symbol,
          name: longName || shortName || symbol,
          price,
          change,
          changePercent,
          exchange: fullExchangeName || exchangeName
        };
      });
    } catch (error) {
      console.error('Error fetching trending tickers:', error);
      throw new Error('Failed to fetch trending tickers');
    }
  }
}

// Export a default instance for convenience
export default new YahooFinanceAPI();