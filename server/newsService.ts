import axios from 'axios';
import yahooFinance from 'yahoo-finance2';

// Fetch real news articles from Yahoo Finance API
export const getNewsForSymbol = async (symbol: string, limit: number = 10): Promise<any[]> => {
  try {
    console.log(`Fetching real news for ${symbol} with limit ${limit}`);
    
    // Use Yahoo Finance API to get actual news
    try {
      // Get news from Yahoo Finance
      const result = await yahooFinance.search(symbol, {
        newsCount: limit,
        quotesCount: 0
      });
      
      if (result && result.news && result.news.length > 0) {
        // Transform Yahoo Finance news format to our standard format
        const articles = result.news.map(item => ({
          title: item.title,
          source: item.publisher,
          publishedAt: item.providerPublishTime ? new Date(Number(item.providerPublishTime) * 1000).toISOString() : new Date().toISOString(),
          url: item.link,
          summary: item.title, // Yahoo doesn't provide a separate summary, so we use the title here
          imageUrl: item.thumbnail?.resolutions[0]?.url || null
        }));
        
        console.log(`Successfully fetched ${articles.length} news items for ${symbol}`);
        return articles.slice(0, limit);
      } else {
        console.log(`No news found for ${symbol} from Yahoo Finance`);
      }
    } catch (yahooError) {
      console.error(`Error fetching news from Yahoo Finance API for ${symbol}:`, yahooError);
    }
    
    // Return empty array when no news is available
    return [];
  } catch (error) {
    console.error('Error in news service:', error);
    return [];
  }
};