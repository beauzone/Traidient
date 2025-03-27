/**
 * Screener Data Provider Service
 * 
 * This service provides data access for Python screeners through HTTP API endpoints.
 * It exposes the market data provider functionality for Python code to consume.
 */

import { Request, Response } from 'express';
import { MarketDataProviderFactory } from './marketDataProviderInterface';
import { storage } from './storage';

/**
 * Get historical market data for multiple symbols
 */
export async function getHistoricalMarketData(req: Request, res: Response) {
  try {
    // Extract parameters
    const { symbols, period = '3mo', interval = '1d', provider = 'yahoo' } = req.query;
    
    // Validate symbols
    if (!symbols) {
      return res.status(400).json({
        success: false,
        error: 'Symbols parameter is required'
      });
    }
    
    // Convert symbols to array
    const symbolArray = Array.isArray(symbols) 
      ? symbols as string[] 
      : (symbols as string).split(',').map(s => s.trim());
    
    if (symbolArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one symbol is required'
      });
    }
    
    // Get user ID from session
    const userId = req.session.userId;
    
    // If userId is available, try to get the user's integrations
    let integration = undefined;
    if (userId && provider !== 'yahoo') {
      const userIntegrations = await storage.getApiIntegrationsByUser(userId);
      integration = userIntegrations.find(i => 
        i.provider === provider && i.isActive &&
        (i.type === 'exchange' || i.type === 'data')
      );
    }
    
    // Get the data provider
    const dataProvider = MarketDataProviderFactory.getProvider(provider as string, integration);
    
    // Check if provider is valid
    if (!dataProvider.isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider configuration for ${provider}`
      });
    }
    
    // Fetch the data
    const data = await dataProvider.getHistoricalData(
      symbolArray,
      period as string,
      interval as string
    );
    
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getHistoricalMarketData:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get stock universe (list of symbols)
 */
export async function getStockUniverse(req: Request, res: Response) {
  try {
    // Extract parameters
    const { universeType = 'default', provider = 'yahoo' } = req.query;
    
    // Get user ID from session
    const userId = req.session.userId;
    
    // If userId is available, try to get the user's integrations
    let integration = undefined;
    if (userId && provider !== 'yahoo') {
      const userIntegrations = await storage.getApiIntegrationsByUser(userId);
      integration = userIntegrations.find(i => 
        i.provider === provider && i.isActive &&
        (i.type === 'exchange' || i.type === 'data')
      );
    }
    
    // Get the data provider
    const dataProvider = MarketDataProviderFactory.getProvider(provider as string, integration);
    
    // Check if provider is valid
    if (!dataProvider.isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider configuration for ${provider}`
      });
    }
    
    // Fetch the stock universe
    const symbols = await dataProvider.getStockUniverse(universeType as string);
    
    return res.json({
      success: true,
      universeType,
      provider: dataProvider.provider,
      symbols
    });
  } catch (error) {
    console.error('Error in getStockUniverse:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Check if market is open
 */
export async function checkMarketStatus(req: Request, res: Response) {
  try {
    // Extract parameters
    const { provider = 'yahoo' } = req.query;
    
    // Get user ID from session
    const userId = req.session.userId;
    
    // If userId is available, try to get the user's integrations
    let integration = undefined;
    if (userId && provider !== 'yahoo') {
      const userIntegrations = await storage.getApiIntegrationsByUser(userId);
      integration = userIntegrations.find(i => 
        i.provider === provider && i.isActive &&
        (i.type === 'exchange' || i.type === 'data')
      );
    }
    
    // Get the data provider
    const dataProvider = MarketDataProviderFactory.getProvider(provider as string, integration);
    
    // Check if provider is valid
    if (!dataProvider.isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider configuration for ${provider}`
      });
    }
    
    // Check if market is open
    const isMarketOpen = await dataProvider.isMarketOpen();
    
    return res.json({
      success: true,
      provider: dataProvider.provider,
      isMarketOpen
    });
  } catch (error) {
    console.error('Error in checkMarketStatus:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get available data providers
 */
export function getAvailableProviders(req: Request, res: Response) {
  try {
    const providers = MarketDataProviderFactory.getAvailableProviders();
    
    return res.json({
      success: true,
      providers
    });
  } catch (error) {
    console.error('Error in getAvailableProviders:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}