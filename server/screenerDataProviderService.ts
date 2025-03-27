/**
 * Screener Data Provider Service
 * 
 * This service provides a standardized API for Python screeners to access
 * market data from various providers (Alpaca, Yahoo Finance, Polygon, etc.)
 */
import { Request, Response } from 'express';
import { IMarketDataProvider, MarketDataProviderFactory } from './marketDataProviderInterface';
import { ApiIntegration } from '@shared/schema';

/**
 * Get market data for screener use
 * 
 * @param provider The market data provider name ('alpaca', 'yahoo', 'polygon', 'alphavantage', 'tiingo')
 * @param req The Express request object
 * @param symbols Array of stock symbols to get data for, or special string 'default', 'sp500', 'nasdaq100'
 * @param period The time period to get data for (e.g. '1d', '5d', '1mo', '3mo', '6mo', '1y')
 * @param interval The data interval (e.g. '1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo')
 * @returns An object with the market data for each requested symbol
 */
export async function getMarketData(
  provider: string,
  req: Request,
  symbols: string[] | string = 'default',
  period: string = '3mo',
  interval: string = '1d'
): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
  try {
    // Get the appropriate data provider
    const dataProvider = await getDataProvider(provider, req);
    
    if (!dataProvider) {
      return {
        success: false,
        error: `Failed to initialize ${provider} data provider`
      };
    }
    
    // If symbols is a special string (universe type), get the full list of symbols
    let symbolList: string[] = [];
    if (typeof symbols === 'string') {
      symbolList = await dataProvider.getStockUniverse(symbols);
    } else {
      symbolList = symbols;
    }
    
    // Get historical data for each symbol
    const data = await dataProvider.getHistoricalData(symbolList, period, interval);
    
    return {
      success: true,
      data
    };
  } catch (error: any) {
    console.error(`Error getting market data from ${provider}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred while getting market data'
    };
  }
}

/**
 * Get a list of available stock symbols from a provider
 * 
 * @param provider The market data provider name
 * @param req The Express request object
 * @param universeType The type of stock universe to get ('default', 'sp500', 'nasdaq100')
 * @returns An array of stock symbols
 */
export async function getStockUniverse(
  provider: string,
  req: Request,
  universeType: string = 'default'
): Promise<{ success: boolean; symbols?: string[]; error?: string }> {
  try {
    // Get the appropriate data provider
    const dataProvider = await getDataProvider(provider, req);
    
    if (!dataProvider) {
      return {
        success: false,
        error: `Failed to initialize ${provider} data provider`
      };
    }
    
    // Get the stock universe
    const symbols = await dataProvider.getStockUniverse(universeType);
    
    return {
      success: true,
      symbols
    };
  } catch (error: any) {
    console.error(`Error getting stock universe from ${provider}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred while getting stock universe'
    };
  }
}

/**
 * Check if the market is currently open
 * 
 * @param provider The market data provider name
 * @param req The Express request object
 * @returns Boolean indicating if the market is open
 */
export async function isMarketOpen(
  provider: string,
  req: Request
): Promise<{ success: boolean; isOpen?: boolean; error?: string }> {
  try {
    // Get the appropriate data provider
    const dataProvider = await getDataProvider(provider, req);
    
    if (!dataProvider) {
      return {
        success: false,
        error: `Failed to initialize ${provider} data provider`
      };
    }
    
    // Check if the market is open
    const isOpen = await dataProvider.isMarketOpen();
    
    return {
      success: true,
      isOpen
    };
  } catch (error: any) {
    console.error(`Error checking market status with ${provider}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred while checking market status'
    };
  }
}

/**
 * Helper function to initialize the appropriate data provider
 */
async function getDataProvider(provider: string, req: Request): Promise<IMarketDataProvider | null> {
  let integration: ApiIntegration | undefined;
  
  // Try to get user-specific API credentials
  if (req.user?.id) {
    try {
      // Get the user's API integration for this provider
      // This code assumes there's a function/service to get the user's API integrations
      // You would customize this based on your app's authentication and storage system
      const userId = req.user.id;
      
      // Example: Get from database
      // integration = await db.select().from(apiIntegrations).where(eq(apiIntegrations.userId, userId))
      //   .and(eq(apiIntegrations.provider, provider)).first();
      
      // Simplified: Check if the integration exists in session
      if (req.session?.userIntegrations) {
        integration = req.session.userIntegrations[provider];
      }
    } catch (err) {
      console.log(`No user-specific ${provider} integration found`);
    }
  }
  
  // Create the provider instance using the factory
  return MarketDataProviderFactory.createProvider(provider, integration);
}