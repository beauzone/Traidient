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
    
    // Make request to Tiingo News API - use token parameter instead of Authorization header
    const response = await axios.get(`https://api.tiingo.com/tiingo/news`, {
      params: {
        tickers: symbol,
        limit: limit,
        sortBy: 'publishedDate',
        token: tiingoApiKey // Add API key as token parameter
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Transform Tiingo news format to our standard format
      const articles = response.data.map(item => ({
        title: item.title,
        source: item.source || 'Tiingo',
        publishedAt: item.publishedDate || new Date().toISOString(),
        url: item.url,
        summary: item.description || item.title,
        // Extract first image URL from any images array, or use a default finance image
        imageUrl: 'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?q=80&w=500&auto=format&fit=crop' 
      }));
      
      console.log(`Successfully fetched ${articles.length} news items for ${symbol} from Tiingo`);
      return articles.slice(0, limit);
    } else {
      console.log(`No news found for ${symbol} from Tiingo API`);
      return [];
    }
  } catch (error) {
    console.error('Error in news service (Tiingo):', error);
    // Log more details about the error for debugging
    if (axios.isAxiosError(error)) {
      console.error('Tiingo API Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
    return [];
  }
};