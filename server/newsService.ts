import axios from 'axios';

// Fetch real news articles from Tiingo API
export const getNewsForSymbol = async (symbol: string, limit: number = 10): Promise<any[]> => {
  try {
    console.log(`Fetching real news for ${symbol} with limit ${limit} from Tiingo API`);
    
    // Use Tiingo API key from environment variables
    const tiingoApiKey = process.env.TIINGO_API_KEY;
    
    if (!tiingoApiKey) {
      console.error('Tiingo API key is missing. Please set the TIINGO_API_KEY environment variable.');
      return [];
    }
    
    // Make request to Tiingo News API
    const response = await axios.get(`https://api.tiingo.com/tiingo/news`, {
      params: {
        tickers: symbol,
        limit: limit,
        sortBy: 'publishedDate',
        source: '', // Include all sources
      },
      headers: {
        'Authorization': `Bearer ${tiingoApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Transform Tiingo news format to our standard format
      const articles = response.data.map(item => ({
        title: item.title,
        source: item.source,
        publishedAt: item.publishedDate || new Date().toISOString(),
        url: item.url,
        summary: item.description || item.title,
        imageUrl: null // Tiingo doesn't provide images directly
      }));
      
      console.log(`Successfully fetched ${articles.length} news items for ${symbol} from Tiingo`);
      return articles.slice(0, limit);
    } else {
      console.log(`No news found for ${symbol} from Tiingo API`);
      return [];
    }
  } catch (error) {
    console.error('Error in news service (Tiingo):', error);
    return [];
  }
};