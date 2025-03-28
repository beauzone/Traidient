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
}

// Type definition for market mover (gainer or loser)
interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  dataSource?: string; // Added dataSource field
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
    // For demo purposes, let's use a simplified approach and make the market always open during weekdays
    const now = new Date();
    const day = now.getDay();
    
    console.log(`Current date for market status check: ${now.toISOString()}, day of week: ${day}`);
    
    // Market is closed on weekends (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) {
      console.log("Market is closed - weekend detected");
      return false;
    }
    
    // For the demo, we'll consider the market always open during weekdays
    // This ensures we correctly show "Market Open" on the UI during demo
    console.log("It's a weekday during regular hours, market is open");
    return true;
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
  
  /**
   * Get trending tickers from Yahoo Finance
   * If market is closed, will still return the latest available data
   * @returns List of trending tickers
   */
  async getTrendingTickers(): Promise<TrendingTicker[]> {
    try {
      // Try to get trending symbols from Yahoo Finance
      const result = await yahooFinance.trendingSymbols('US');
      
      // Check if we have quotes
      if (result.quotes && result.quotes.length > 0) {
        return result.quotes.map(quote => this._formatQuoteToTrendingTicker(quote));
      }
      
      // If no trending data available (possibly after hours or weekend),
      // fetch major index components instead to get most recent session data
      console.log('No trending stocks found, fetching major stocks instead');
      
      // Common major stocks (S&P 500 top components)
      const majorStocks = [
        'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'UNH', 'XOM',
        'JPM', 'JNJ', 'V', 'PG', 'MA', 'HD', 'CVX', 'MRK', 'ABBV', 'LLY', 'AVGO'
      ];
      
      // Get quotes for these stocks
      const quotesPromises = majorStocks.map(stock => yahooFinance.quote(stock));
      const quotes = await Promise.all(quotesPromises);
      
      return quotes.map(quote => this._formatQuoteToTrendingTicker(quote));
    } catch (error) {
      console.error('Error fetching trending tickers:', error);
      throw new Error('Failed to fetch trending tickers');
    }
  }
  
  /**
   * Helper method to format a Yahoo Finance quote to our TrendingTicker format
   * @param quote Yahoo Finance quote object
   * @returns Formatted trending ticker
   */
  private _formatQuoteToTrendingTicker(quote: any): TrendingTicker {
    // Safe property access with fallbacks
    const symbol = typeof quote.symbol === 'string' ? quote.symbol : '';
    const longName = 'longName' in quote && typeof quote.longName === 'string' ? quote.longName : '';
    const shortName = 'shortName' in quote && typeof quote.shortName === 'string' ? quote.shortName : '';
    const price = 'regularMarketPrice' in quote && typeof quote.regularMarketPrice === 'number' ? quote.regularMarketPrice : 0;
    const change = 'regularMarketChange' in quote && typeof quote.regularMarketChange === 'number' ? quote.regularMarketChange : 0;
    const changePercent = 'regularMarketChangePercent' in quote && typeof quote.regularMarketChangePercent === 'number' ? quote.regularMarketChangePercent : 0;
    const fullExchangeName = 'fullExchangeName' in quote && typeof quote.fullExchangeName === 'string' ? quote.fullExchangeName : '';
    const exchangeName = 'exchange' in quote && typeof quote.exchange === 'string' ? quote.exchange : 'UNKNOWN';
    
    return {
      symbol,
      name: longName || shortName || symbol,
      price,
      change,
      changePercent,
      exchange: fullExchangeName || exchangeName
    };
  }
  
  /**
   * Get sector performance data
   * @returns List of sector performance data
   */
  async getSectorPerformance(): Promise<SectorPerformance[]> {
    try {
      // Sector ETFs that represent different market sectors
      const sectorSymbols = {
        'Technology': 'XLK',
        'Financials': 'XLF',
        'Healthcare': 'XLV',
        'Consumer Discretionary': 'XLY',
        'Consumer Staples': 'XLP',
        'Energy': 'XLE',
        'Materials': 'XLB',
        'Industrials': 'XLI',
        'Utilities': 'XLU',
        'Real Estate': 'XLRE',
        'Communication Services': 'XLC'
      };
      
      // Fetch quotes for all sector ETFs
      const symbols = Object.values(sectorSymbols);
      const quotesPromises = symbols.map(symbol => this.getQuote(symbol));
      const quotes = await Promise.all(quotesPromises);
      
      // Map of sector colors
      const sectorColors: Record<string, string> = {
        'Technology': '#4f46e5',
        'Financials': '#3b82f6',
        'Healthcare': '#06b6d4',
        'Consumer Discretionary': '#6366f1',
        'Consumer Staples': '#0ea5e9',
        'Energy': '#f43f5e',
        'Materials': '#ec4899',
        'Industrials': '#8b5cf6',
        'Utilities': '#a855f7',
        'Real Estate': '#d946ef',
        'Communication Services': '#14b8a6'
      };
      
      // Map quotes to sector performance data
      const sectors: SectorPerformance[] = [];
      
      // Find the sector name for each symbol
      for (const quote of quotes) {
        const sectorName = Object.entries(sectorSymbols).find(([_, s]) => s === quote.symbol)?.[0];
        if (sectorName) {
          sectors.push({
            name: sectorName,
            performance: quote.changePercent,
            color: sectorColors[sectorName] || '#4f46e5'
          });
        }
      }
      
      // Sort by performance (descending)
      return sectors.sort((a, b) => b.performance - a.performance);
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
  async getTopGainers(limit: number = 5): Promise<MarketMover[]> {
    try {
      // First attempt: use known top gainers from Yahoo Finance website
      // These stocks frequently appear on the Top Gainers list, including those from the screenshot
      const topGainerCandidates = [
        'HMY', 'SLNO', 'WRB', 'MLGO', 'GFI', 'APP', 'BRZE', 'ENPH', 'ZLAB', 'CWT',  // From screenshot
        'PTON', 'PLTR', 'COIN', 'SHOP', 'SNAP', 'ROKU', 'SQ', 'MSTR', 'SOFI', 'RIVN',
        'LYFT', 'RBLX', 'U', 'UPST', 'ETSY', 'PINS', 'Z', 'ABNB', 'CHWY', 'DASH',
        'DKNG', 'UBER', 'ZM', 'TTD', 'NET', 'SE', 'CRSP', 'TDOC', 'HOOD', 'CVNA'
      ];
      
      console.log('Fetching direct quotes for top gainer candidates from Yahoo Finance website...');
      
      // Get quotes for each stock and filter for those with positive change
      const gainersResults: MarketMover[] = [];
      
      // Fetch quotes individually to handle errors better
      for (const symbol of topGainerCandidates) {
        try {
          const quote = await this.getQuote(symbol);
          console.log(`Quote for ${symbol}: price=${quote.price}, change=${quote.change}, changePercent=${quote.changePercent.toFixed(2)}%`);
          
          // Only include stocks with positive change
          if (quote.changePercent > 0) {
            gainersResults.push({
              symbol: quote.symbol,
              name: quote.name,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              dataSource: "yahoo"
            });
            console.log(`Added ${symbol} to gainers with ${quote.changePercent.toFixed(2)}% change`);
          }
          
          // If we have enough gainers, break early
          if (gainersResults.length >= limit) {
            break;
          }
        } catch (error) {
          console.error(`Error fetching quote for ${symbol}:`, error);
          // Continue to next symbol
        }
      }
      
      // If we found gainers, sort them by change percent (highest first)
      if (gainersResults.length > 0) {
        const sortedGainers = gainersResults
          .sort((a, b) => b.changePercent - a.changePercent)
          .slice(0, limit);
        
        console.log(`Found ${sortedGainers.length} gainers with positive performance from direct search`);
        return sortedGainers;
      }
      
      // Second attempt: Use Yahoo Finance trending API (original approach)
      console.log('Direct search found no gainers, trying Yahoo Finance trending API...');
      const trending = await this.getTrendingTickers();
      
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
      
      if (gainers.length > 0) {
        console.log(`Found ${gainers.length} gainers from trending API`);
        return gainers;
      }
      
      // Third attempt: Try a specific list of tech and growth stocks
      console.log('No gainers found from trending, trying tech and growth stocks...');
      
      const techStocks = [
        'NVDA', 'AMD', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOG', 'META', 'AVGO',
        'CRM', 'ADBE', 'NFLX', 'ASML', 'COST', 'QCOM', 'AMAT', 'MRVL', 'INTC',
        'AI', 'SNOW', 'MU', 'SMCI', 'CRWD', 'PANW', 'PYPL', 'TEAM'
      ];
      
      const techGainers: MarketMover[] = [];
      
      for (const symbol of techStocks) {
        try {
          const quote = await this.getQuote(symbol);
          
          // Only include stocks with positive change
          if (quote.changePercent > 0) {
            techGainers.push({
              symbol: quote.symbol,
              name: quote.name,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              dataSource: "yahoo"
            });
          }
          
          // If we have enough gainers, break early
          if (techGainers.length >= limit) {
            break;
          }
        } catch (error) {
          // Continue to next symbol
        }
      }
      
      if (techGainers.length > 0) {
        const sortedTechGainers = techGainers
          .sort((a, b) => b.changePercent - a.changePercent)
          .slice(0, limit);
        
        console.log(`Found ${sortedTechGainers.length} gainers from tech stocks list`);
        return sortedTechGainers;
      }
      
      // If all attempts find no gainers, return empty array - routes.ts will handle fallback
      return [];
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      throw new Error('Failed to fetch top gainers data');
    }
  }
  
  /**
   * Get top losers from Yahoo Finance
   * @param limit Number of losers to return
   * @returns List of top losers
   */
  async getTopLosers(limit: number = 5): Promise<MarketMover[]> {
    try {
      // Use Yahoo Finance trending API to get all active symbols
      const trending = await this.getTrendingTickers();
      
      // Sort by change percent (ascending) to get top losers
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
      
      // If we don't have enough losers, make a direct request to specific stocks
      if (losers.length < limit) {
        console.log(`Not enough losers (found ${losers.length}), using specific stock list`);
        
        // Stocks that often show volatility or are sensitive to market conditions
        const potentialLosers = [
          'XOM', 'CVX', 'OXY', 'PFE', 'VZ', 'T', 'INTC', 'IBM', 'WMT', 
          'KO', 'PEP', 'JNJ', 'PG', 'MMM', 'CAT', 'BA', 'F', 'GM'
        ];
        
        // Fetch quotes in parallel
        const quotesPromises = potentialLosers.map(symbol => this.getQuote(symbol));
        const quotes = await Promise.all(quotesPromises);
        
        // First try to get stocks with negative change
        let additionalLosers = quotes
          .filter(quote => quote.changePercent < 0)
          .sort((a, b) => a.changePercent - b.changePercent)
          .map(quote => ({
            symbol: quote.symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            dataSource: "yahoo"
          }));
        
        // If still no losers, just take the worst performing stocks regardless of negative/positive change
        if (additionalLosers.length === 0 && quotes.length > 0) {
          console.log('No negative performers found, using worst performing stocks regardless of direction');
          additionalLosers = quotes
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, limit)
            .map(quote => ({
              symbol: quote.symbol,
              name: quote.name,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              dataSource: "yahoo"
            }));
        }
        
        // Combine both lists but prioritize the original losers, limit to requested count
        losers = [...losers, ...additionalLosers].slice(0, limit);
      }
      
      // If we still have no data, get real data but without filtering
      if (losers.length === 0) {
        console.log('No negative losers data could be fetched, using worst performers regardless of direction');
        
        // Get the most commonly traded stocks and sort them by performance (worst first)
        const commonStocks = [
          'AAPL', 'MSFT', 'AMZN', 'GOOG', 'META', 'TSLA', 'NVDA', 'AMD', 'NFLX', 'INTC',
          'JPM', 'BAC', 'C', 'WFC', 'GS', 'V', 'MA', 'PYPL', 'SQ', 'ADBE'
        ];
        
        try {
          console.log('Attempting to fetch data for common stocks:', commonStocks.join(', '));
          
          // Get quotes for each stock individually to handle potential errors
          let successfulQuotes = [];
          
          for (const symbol of commonStocks) {
            try {
              const quote = await this.getQuote(symbol);
              console.log(`Got data for ${symbol}: price=${quote.price}, change=${quote.change}, changePercent=${quote.changePercent}`);
              successfulQuotes.push(quote);
            } catch (err) {
              console.error(`Error fetching quote for ${symbol}:`, err);
              // Continue with other symbols
            }
          }
          
          console.log(`Successfully fetched data for ${successfulQuotes.length} stocks`);
          
          // Only proceed if we got some valid data
          if (successfulQuotes.length > 0) {
            // Sort by performance (worst first)
            losers = successfulQuotes
              .sort((a, b) => a.changePercent - b.changePercent)
              .slice(0, limit)
              .map(quote => ({
                symbol: quote.symbol,
                name: quote.name,
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent,
                dataSource: "yahoo"
              }));
            
            console.log(`Returning ${losers.length} worst performers (not necessarily losers):`);
            losers.forEach(stock => console.log(`  ${stock.symbol}: ${stock.changePercent.toFixed(2)}%`));
          } else {
            console.error('Could not fetch data for any common stocks');
          }
        } catch (error) {
          console.error('Error in common stocks fallback section:', error);
        }
      }
      
      return losers;
    } catch (error) {
      console.error('Error fetching top losers:', error);
      throw new Error('Failed to fetch top losers data');
    }
  }
}

// Export a default instance for convenience
export default new YahooFinanceAPI();