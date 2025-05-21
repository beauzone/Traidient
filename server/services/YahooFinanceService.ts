/**
 * Yahoo Finance API Service
 * Handles direct interactions with Yahoo Finance API for market data
 */

import yahooFinance from 'yahoo-finance2';

export class YahooFinanceService {
  
  /**
   * Get comprehensive real-time quote data for a symbol
   * @param symbol The stock symbol to fetch quote data for
   * @returns Formatted quote data with key metrics
   */
  public async getQuote(symbol: string) {
    try {
      console.log(`YahooFinanceService: Fetching real-time data for ${symbol}`);
      
      // Get the basic quote data
      const quoteResult = await yahooFinance.quote(symbol);
      
      if (!quoteResult) {
        throw new Error(`No quote data returned for ${symbol}`);
      }
      
      // Get additional detailed data
      const summaryResult = await yahooFinance.quoteSummary(symbol, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'price']
      });
      
      // Format the data into a consistent structure for our frontend
      const formattedData = {
        symbol: symbol,
        name: quoteResult.shortName || quoteResult.longName || symbol,
        price: quoteResult.regularMarketPrice || 0,
        change: quoteResult.regularMarketChange || 0,
        changePercent: quoteResult.regularMarketChangePercent || 0,
        open: quoteResult.regularMarketOpen || 0,
        previousClose: quoteResult.regularMarketPreviousClose || 0,
        dayLow: quoteResult.regularMarketDayLow || 0,
        dayHigh: quoteResult.regularMarketDayHigh || 0,
        volume: quoteResult.regularMarketVolume || 0,
        avgVolume: summaryResult?.summaryDetail?.averageVolume || 0,
        marketCap: summaryResult?.summaryDetail?.marketCap 
          ? summaryResult.summaryDetail.marketCap // Keep the original full number
          : 0,
        pe: summaryResult?.summaryDetail?.trailingPE || 0,
        yearHigh: summaryResult?.summaryDetail?.fiftyTwoWeekHigh || 0,
        yearLow: summaryResult?.summaryDetail?.fiftyTwoWeekLow || 0,
        dataSource: "yahoo"
      };
      
      console.log(`YahooFinanceService: Successfully retrieved data for ${symbol}`);
      return formattedData;
    } catch (error) {
      console.error(`YahooFinanceService: Error fetching data for ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Get historical price data for a symbol
   * @param symbol The stock symbol to fetch historical data for
   * @param days Number of days of historical data to retrieve
   * @returns Array of historical price data points
   */
  public async getHistoricalData(symbol: string, days: number = 90) {
    try {
      // Calculate the start date based on the number of days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const historyResult = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: new Date(),
        interval: '1d'
      });
      
      // Format the historical data
      return historyResult.map(bar => ({
        date: bar.date.toISOString().split('T')[0],
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        adjClose: bar.adjClose
      }));
    } catch (error) {
      console.error(`YahooFinanceService: Error fetching historical data for ${symbol}:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
export const yahooFinanceService = new YahooFinanceService();