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

// Type definition for sector performance
interface SectorPerformance {
  name: string;
  performance: number;
  color: string;
  dataSource?: string;
}

// Type definition for market mover
interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  dataSource?: string;
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
      const result = await yahooFinance.quote(symbol);
      
      const formattedQuote: FormattedQuote = {
        symbol: result.symbol,
        name: result.longName || result.shortName || result.symbol,
        price: result.regularMarketPrice || 0,
        change: result.regularMarketChange || 0,
        changePercent: (result.regularMarketChangePercent || 0),
        open: result.regularMarketOpen || 0,
        high: result.regularMarketDayHigh || 0,
        low: result.regularMarketDayLow || 0,
        volume: result.regularMarketVolume || 0,
        marketCap: result.marketCap || 0,
        peRatio: result.trailingPE || 0,
        dividend: result.trailingAnnualDividendYield || 0,
        eps: result.epsTrailingTwelveMonths || 0,
        exchange: result.fullExchangeName || result.exchange || '',
        isSimulated: false,
        isYahooData: true,
        dataSource: "yahoo"
      };
      
      return formattedQuote;
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw new Error(`Failed to fetch quote data for ${symbol}`);
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
      const startDate = this.getPeriodStartDate(period);
      const endDate = new Date();
      
      const result = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: interval as any
      });
      
      const bars = result.map((bar: HistoricalDataBar) => ({
        t: bar.date.toISOString(),
        o: bar.open,
        h: bar.high,
        l: bar.low,
        c: bar.close,
        v: bar.volume
      }));
      
      return {
        symbol,
        bars,
        isSimulated: false,
        isYahooData: true,
        dataSource: "yahoo"
      };
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      throw new Error(`Failed to fetch historical data for ${symbol}`);
    }
  }

  /**
   * Get the start date for historical data based on the period
   * @param period Period string (e.g., '1d', '1mo', '1y')
   * @returns Date object for the start date
   */
  private getPeriodStartDate(period: string): Date {
    const now = new Date();
    
    if (period === '1d') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return yesterday;
    } else if (period === '5d') {
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(now.getDate() - 5);
      return fiveDaysAgo;
    } else if (period === '1mo') {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      return oneMonthAgo;
    } else if (period === '3mo') {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      return threeMonthsAgo;
    } else if (period === '6mo') {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      return sixMonthsAgo;
    } else if (period === '1y') {
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      return oneYearAgo;
    } else if (period === '2y') {
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(now.getFullYear() - 2);
      return twoYearsAgo;
    } else if (period === '5y') {
      const fiveYearsAgo = new Date(now);
      fiveYearsAgo.setFullYear(now.getFullYear() - 5);
      return fiveYearsAgo;
    } else {
      // Default to 1 month ago
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      return oneMonthAgo;
    }
  }

  /**
   * Search for stocks by a query term
   * @param query Search query (e.g., 'Apple')
   * @returns List of matching stocks
   */
  async search(query: string): Promise<SearchResult[]> {
    try {
      const results = await yahooFinance.search(query);
      
      return results.quotes
        .filter(quote => quote.quoteType === 'EQUITY')
        .map(quote => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname || quote.symbol,
          exchange: quote.exchDisp || '',
          type: quote.quoteType || 'EQUITY'
        }));
    } catch (error) {
      console.error(`Error searching for ${query}:`, error);
      throw new Error(`Failed to search for ${query}`);
    }
  }

  /**
   * Check if the US market is currently open
   * @returns Boolean indicating if the market is open
   */
  isMarketOpen(): boolean {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    console.log(`Current date for market status check: ${now.toISOString()}, day of week: ${dayOfWeek}`);
    
    // Weekend check (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Convert to Eastern Time (ET)
    const easternTimeOffset = this.isDateInDST(now) ? -4 : -5;
    const easternHours = (now.getUTCHours() + easternTimeOffset) % 24;
    if (easternHours < 0) {
      easternHours += 24; // Adjust for negative hours
    }
    const easternMinutes = now.getUTCMinutes();
    const easternTimeStr = `${easternHours}:${easternMinutes < 10 ? '0' + easternMinutes : easternMinutes}`;
    
    console.log(`Current time in Eastern: ${easternHours}:${easternMinutes < 10 ? '0' + easternMinutes : easternMinutes} (${this.isDateInDST(now) ? 'EDT' : 'EST'})`);
    console.log(`Market hours: 9:30 AM - 4:00 PM Eastern Time`);
    
    // Market hours: 9:30 AM - 4:00 PM Eastern Time
    const isOpen = (
      (easternHours === 9 && easternMinutes >= 30) ||
      (easternHours > 9 && easternHours < 16) ||
      (easternHours === 16 && easternMinutes === 0)
    );
    
    console.log(`Market is ${isOpen ? 'OPEN' : 'CLOSED'} based on Eastern Time check`);
    
    return isOpen;
  }

  /**
   * Checks if a date is in Daylight Saving Time
   * This is a simplified check - a production system would use a more robust timezone library
   */
  private isDateInDST(date: Date): boolean {
    // Approximate DST period: 2nd Sunday in March to 1st Sunday in November
    const year = date.getUTCFullYear();
    
    // Start of DST: 2nd Sunday in March at 2 AM
    const dstStartDate = new Date(Date.UTC(year, 2, 1, 7, 0, 0));
    const dstStartDay = dstStartDate.getUTCDay();
    const dstStartOffset = dstStartDay === 0 ? 7 : dstStartDay;
    dstStartDate.setUTCDate(dstStartDate.getUTCDate() + (14 - dstStartOffset));
    
    // End of DST: 1st Sunday in November at 2 AM
    const dstEndDate = new Date(Date.UTC(year, 10, 1, 6, 0, 0));
    const dstEndDay = dstEndDate.getUTCDay();
    const dstEndOffset = dstEndDay === 0 ? 0 : dstEndDay;
    dstEndDate.setUTCDate(dstEndDate.getUTCDate() + (7 - dstEndOffset));
    
    return date >= dstStartDate && date < dstEndDate;
  }

  /**
   * Get trending tickers from Yahoo Finance
   * If market is closed, will still return the latest available data
   * @returns List of trending tickers
   */
  async getTrendingTickers(): Promise<TrendingTicker[]> {
    try {
      // Use Yahoo Finance's direct trending tickers API
      const response = await yahooFinance.trendingSymbols("US");
      
      if (!response?.quotes || response.quotes.length === 0) {
        throw new Error('No trending tickers returned from Yahoo Finance API');
      }
      
      // Map Yahoo Finance response to our TrendingTicker format
      const trendingTickers = await Promise.all(
        response.quotes.slice(0, 30).map(async (quote) => {
          try {
            // For trending symbols, we often need to fetch full details to get price information
            const fullQuote = await this.getQuote(quote.symbol);
            return this._formatQuoteToTrendingTicker(fullQuote);
          } catch (error) {
            console.error(`Error fetching full details for ${quote.symbol}:`, error);
            // Return minimal data if we can't get full details
            return {
              symbol: quote.symbol,
              name: quote.shortName || quote.longName || quote.symbol,
              price: 0,
              change: 0,
              changePercent: 0,
              exchange: quote.fullExchangeName || quote.exchange || 'Unknown'
            };
          }
        })
      );
      
      return trendingTickers.filter(ticker => ticker.price > 0);
    } catch (error) {
      console.error('Error fetching trending tickers:', error);
      throw new Error('Failed to fetch trending tickers data');
    }
  }

  /**
   * Helper method to format a Yahoo Finance quote to our TrendingTicker format
   * @param quote Yahoo Finance quote object
   * @returns Formatted trending ticker
   */
  private _formatQuoteToTrendingTicker(quote: any): TrendingTicker {
    return {
      symbol: quote.symbol,
      name: quote.name || quote.symbol,
      price: quote.price || 0,
      change: quote.change || 0,
      changePercent: quote.changePercent || 0,
      exchange: quote.exchange || 'Unknown'
    };
  }

  /**
   * Get sector performance data
   * @returns List of sector performance data
   */
  async getSectorPerformance(): Promise<SectorPerformance[]> {
    try {
      // For consistent sector colors
      const sectorColors = {
        'Technology': '#4f46e5',
        'Financial Services': '#3b82f6',
        'Financials': '#3b82f6',
        'Healthcare': '#06b6d4',
        'Consumer Defensive': '#0ea5e9',
        'Consumer Staples': '#0ea5e9',
        'Consumer Cyclical': '#6366f1',
        'Consumer Discretionary': '#6366f1',
        'Industrials': '#8b5cf6',
        'Communication Services': '#14b8a6',
        'Energy': '#f43f5e',
        'Basic Materials': '#ec4899',
        'Materials': '#ec4899',
        'Real Estate': '#d946ef',
        'Utilities': '#a855f7'
      };
      
      // Get sector performance data from Yahoo Finance
      const sectors = [
        { symbol: 'XLK', name: 'Technology' },
        { symbol: 'XLF', name: 'Financials' },
        { symbol: 'XLV', name: 'Healthcare' },
        { symbol: 'XLP', name: 'Consumer Staples' },
        { symbol: 'XLY', name: 'Consumer Discretionary' },
        { symbol: 'XLI', name: 'Industrials' },
        { symbol: 'XLC', name: 'Communication Services' },
        { symbol: 'XLE', name: 'Energy' },
        { symbol: 'XLB', name: 'Materials' },
        { symbol: 'XLRE', name: 'Real Estate' },
        { symbol: 'XLU', name: 'Utilities' }
      ];
      
      // Fetch all sector ETFs in parallel for better performance
      const quotesPromises = sectors.map(sector => yahooFinance.quote(sector.symbol));
      const quotes = await Promise.all(quotesPromises);
      
      // Map quotes to sector performance data
      const sectorPerformance = quotes.map((quote, index) => {
        const sectorName = sectors[index].name;
        // Getting today's performance (regularMarketChangePercent) or default to 0
        const performance = quote.regularMarketChangePercent || 0;
        
        return {
          name: sectorName,
          performance: performance,
          color: sectorColors[sectorName] || '#3b82f6',
          dataSource: "yahoo"
        };
      });
      
      // Sort by performance (from highest to lowest)
      sectorPerformance.sort((a, b) => b.performance - a.performance);
      
      return sectorPerformance;
    } catch (error) {
      console.error('Error fetching sector performance:', error);
      throw new Error('Failed to fetch sector performance data');
    }
  }

  /**
   * Get top gainers from Yahoo Finance
   * @param limit Number of gainers to return
   * @returns List of top gainers
   */
  async getTopGainers(limit: number = 10): Promise<MarketMover[]> {
    try {
      // Direct call to Yahoo Finance trending API
      const trending = await this.getTrendingTickers();
      
      // Filter and sort by positive change percent (descending)
      let gainers = trending
        .filter(ticker => ticker.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, limit)
        .map(ticker => ({
          symbol: ticker.symbol,
          name: ticker.name,
          price: ticker.price,
          change: ticker.change,
          changePercent: ticker.changePercent,
          dataSource: "yahoo"
        }));
      
      // If we don't have enough gainers from trending, search for more
      if (gainers.length < limit) {
        console.log('Fetching direct quotes for top gainer candidates from Yahoo Finance website...');
        
        // Good candidates for showing positive performance
        const potentialGainers = [
          'ZLAB', 'SLNO', 'HMY', 'WRB', 'MLGO',
          'GFI', 'APP', 'BRZE', 'ENPH', 
          'CWT', 'PTON', 'PLTR', 'COIN', 'SHOP', 'SNAP', 'ROKU'
        ];
        
        // Get direct quotes from Yahoo Finance for potential gainers
        for (const symbol of potentialGainers) {
          try {
            const quote = await this.getQuote(symbol);
            console.log(`Quote for ${symbol}: price=${quote.price}, change=${quote.change}, changePercent=${quote.changePercent}%`);
            
            if (quote.changePercent > 0) {
              // Add to gainers list if positive performance
              gainers.push({
                symbol: quote.symbol,
                name: quote.name,
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent,
                dataSource: "yahoo"
              });
              
              console.log(`Added ${symbol} to gainers with ${quote.changePercent.toFixed(2)}% change`);
              
              // Stop when we have enough gainers
              if (gainers.length >= limit) {
                console.log(`Found ${gainers.length} gainers with positive performance from direct search`);
                break;
              }
            }
          } catch (err) {
            console.error(`Error getting quote for ${symbol}:`, err);
            // Continue with next symbol
          }
        }
      }
      
      // Sort by change percent (descending)
      gainers.sort((a, b) => b.changePercent - a.changePercent);
      
      // Limit to requested number
      gainers = gainers.slice(0, limit);
      
      console.log(`Fetched gainers:`, gainers);
      return gainers;
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      throw new Error('Failed to fetch top gainers data');
    }
  }

  /**
   * Get top losers from Yahoo Finance - returns only real market data
   * @param limit Number of losers to return
   * @returns List of top losers with negative performance
   */
  async getTopLosers(limit: number = 10): Promise<MarketMover[]> {
    try {
      // Use Yahoo Finance trending API to get all active symbols
      const trending = await this.getTrendingTickers();
      
      // Filter to only stocks with negative performance
      let losers = trending
        .filter(ticker => ticker.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, limit)
        .map(ticker => ({
          symbol: ticker.symbol,
          name: ticker.name,
          price: ticker.price,
          change: ticker.change,
          changePercent: ticker.changePercent,
          dataSource: "yahoo"
        }));
      
      return losers;
    } catch (error) {
      console.error('Error fetching top losers:', error);
      // Return empty array instead of fallback data
      return [];
    }
  }
  
  /**
   * Find more stocks with negative performance when we need additional losers
   * @param count Number of additional losers needed
   * @returns List of additional losers with authentic market data
   */
  async findMoreLosers(count: number): Promise<MarketMover[]> {
    try {
      console.log(`Searching for ${count} additional losing stocks from market data`);
      
      // Stocks to check for negative performance - stocks that often show volatility
      // These are NOT synthetic fallback data, but real stocks we're getting live quotes for
      const stocksToCheck = [
        // Varied selection across industries to improve chances of finding negative performers
        'XOM', 'CVX', 'OXY', 'PFE', 'VZ', 'T', 'INTC', 'IBM', 'WMT', 
        'KO', 'PEP', 'JNJ', 'PG', 'MMM', 'CAT', 'BA', 'F', 'GM',
        'GE', 'UAL', 'DAL', 'AAL', 'NFLX', 'DIS', 'MRK',  
        'NKE', 'HD', 'MCD', 'GS', 'JPM', 'C', 'BAC', 'WFC',
        'FCX', 'BHP', 'RIO', 'CLF', 'VALE', 'NEM', 'AA',
        'BIIB', 'GILD', 'AMGN', 'REGN', 'BMY', 'ABT', 'UNH',
        'TGT', 'COST', 'LOW', 'BBY', 'M', 'GPS', 'KSS'
      ];
      
      // Shuffle the array to get a random selection each time
      const shuffled = [...stocksToCheck].sort(() => 0.5 - Math.random());
      
      // Take a subset to avoid too many API calls
      const selectedStocks = shuffled.slice(0, Math.min(30, shuffled.length));
      
      console.log(`Checking ${selectedStocks.length} stocks for negative performance`);
      
      // Get quotes for selected stocks
      const quotesPromises = selectedStocks.map(symbol => this.getQuote(symbol));
      const quotes = await Promise.all(quotesPromises);
      
      // Filter to stocks with negative performance
      const additionalLosers = quotes
        .filter(quote => quote.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, count)
        .map(quote => ({
          symbol: quote.symbol,
          name: quote.name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          dataSource: "yahoo"
        }));
      
      console.log(`Found ${additionalLosers.length} additional stocks with negative performance`);
      return additionalLosers;
    } catch (error) {
      console.error('Error finding additional losers:', error);
      return [];
    }
  }
}

// Export a default instance for convenience
export default new YahooFinanceAPI();
