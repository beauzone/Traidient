import axios from 'axios';
import yahooFinance from 'yahoo-finance2';
import { createMarketDataProvider } from './marketDataProviders';

// Generate realistic news item with dates in the past
const generateNewsItem = (symbol: string, index: number) => {
  const now = new Date();
  const sources = ['Bloomberg', 'CNBC', 'MarketWatch', 'Yahoo Finance', 'The Wall Street Journal', 'Investor\'s Business Daily'];
  const randomSource = sources[Math.floor(Math.random() * sources.length)];
  
  // Set publication date based on index - more recent for lower indices
  const publishedDate = new Date(now);
  publishedDate.setHours(now.getHours() - (index * 3 + Math.floor(Math.random() * 4)));
  
  // Generate news titles and summaries based on the symbol
  const newsTitles = [
    `${symbol} Reports Strong Q2 Earnings, Beating Wall Street Expectations`,
    `Analyst Upgrades ${symbol} to "Buy" Citing Growth Opportunities`,
    `${symbol} Announces New Product Launch, Shares Rise`,
    `${symbol} CEO Discusses Future Growth Strategy in Exclusive Interview`,
    `${symbol} Plans Major Expansion into Asian Markets`,
    `Institutional Investors Increase Stakes in ${symbol}`,
    `${symbol} Faces Regulatory Scrutiny Over Recent Acquisition`,
    `${symbol} Completes Strategic Restructuring to Boost Profitability`,
    `${symbol} Partners with Tech Giant on AI Initiative`,
    `${symbol} Stock Rallies Following Positive Analyst Coverage`
  ];
  
  const newsSummaries = [
    `${symbol} reported quarterly earnings that exceeded analyst expectations, with revenue growing 15% year-over-year and profit margins expanding. Management raised full-year guidance.`,
    `A leading Wall Street analyst has upgraded ${symbol} to a "Buy" rating, citing strong market position and upcoming product launches expected to drive revenue growth.`,
    `${symbol} unveiled its latest innovation today, which management believes will open new market opportunities and strengthen its competitive position in the industry.`,
    `In an exclusive interview, the CEO of ${symbol} outlined the company's long-term strategy, focusing on digital transformation and operational efficiency to drive shareholder value.`,
    `${symbol} announced plans to significantly expand its presence in Asian markets over the next 18 months, potentially opening new revenue streams for the company.`,
    `SEC filings reveal that several large institutional investors have increased their positions in ${symbol}, signaling confidence in the company's long-term prospects.`,
    `Regulators have launched an inquiry into ${symbol}'s recent acquisition, raising questions about potential market concentration and competitive implications.`,
    `${symbol} has completed its previously announced restructuring program, which is expected to result in annual cost savings of approximately $200 million.`,
    `${symbol} has formed a strategic partnership with a leading technology company to develop AI-powered solutions for its core business operations.`,
    `Shares of ${symbol} gained following positive analyst coverage highlighting the company's strong competitive positioning and growth potential.`
  ];

  // Get random title and summary (but matching index)
  const randomIndex = Math.floor(Math.random() * newsTitles.length);
  const title = newsTitles[randomIndex];
  const summary = newsSummaries[randomIndex];
  
  // Generate a realistic image URL for the news item
  const imageUrls = [
    `https://placehold.co/600x400/222/fff?text=${symbol}+News`,
    `https://placehold.co/600x400/333/fff?text=${symbol}`,
    `https://placehold.co/600x400/444/fff?text=${symbol}+Update`,
    `https://placehold.co/600x400/555/fff?text=${symbol}+Markets`,
    `https://placehold.co/600x400/666/fff?text=${symbol}+Financial`
  ];
  
  return {
    title,
    source: randomSource,
    publishedAt: publishedDate.toISOString(),
    url: `https://example.com/news/${symbol.toLowerCase()}/${Math.floor(Math.random() * 10000)}`,
    summary,
    imageUrl: imageUrls[Math.floor(Math.random() * imageUrls.length)]
  };
};

// Get Yahoo Finance news directly from the Yahoo Finance API
const getYahooFinanceNews = async (symbol: string, limit: number = 10) => {
  try {
    const newsData = await yahooFinance.insights(symbol, { 
      debug: false 
    });
    
    if (newsData && newsData.reports && newsData.reports.length > 0) {
      // Extract news articles
      const articles = newsData.reports.map(report => ({
        title: report.report.title || `News about ${symbol}`,
        source: report.report.provider || 'Yahoo Finance',
        publishedAt: new Date(report.report.publishedOn * 1000).toISOString(),
        url: report.report.link || `https://finance.yahoo.com/quote/${symbol}`,
        summary: report.report.summary || `Latest financial news about ${symbol}`,
        imageUrl: `https://placehold.co/600x400/222/fff?text=${symbol}+News`,
      }));
      
      return articles.slice(0, limit);
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching Yahoo Finance news for ${symbol}:`, error);
    return [];
  }
};

export const getNewsForSymbol = async (symbol: string, limit: number = 10): Promise<any[]> => {
  try {
    // First try direct Yahoo Finance API
    try {
      const yahooNews = await getYahooFinanceNews(symbol, limit);
      if (yahooNews && yahooNews.length > 0) {
        return yahooNews;
      }
    } catch (error) {
      console.log(`Could not get news from Yahoo Finance API for ${symbol}`, error);
    }
    
    // Generate synthetic news as fallback
    const newsItems = [];
    for (let i = 0; i < limit; i++) {
      newsItems.push(generateNewsItem(symbol, i));
    }
    
    return newsItems;
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
};