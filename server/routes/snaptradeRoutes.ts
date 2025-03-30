/**
 * SnapTrade Routes
 * 
 * These routes handle SnapTrade-specific functionality including user registration,
 * brokerage connections, and callback handling.
 */

import { Router, Request, Response } from 'express';
import { snapTradeSDKService } from '../snaptradeSDKService'; // Use the SDK service instead
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { extractUserId } from '../utils';

export const snaptradeRoutes = Router();

/**
 * Authentication middleware for SnapTrade routes
 */
const snaptradeAuthMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    console.log('SnapTrade auth middleware running');
    
    // Extract user ID from session or auth header
    const userId = extractUserId(req);
    
    if (!userId) {
      console.error('SnapTrade auth middleware - No user ID found in request');
      return res.status(401).json({ error: 'Unauthorized - User ID not found' });
    }
    
    console.log(`SnapTrade auth middleware - Found user ID: ${userId}`);
    
    // Check if SnapTrade service is configured
    if (!snapTradeSDKService.isConfigured()) {
      console.error('SnapTrade auth middleware - Service is not properly configured');
      return res.status(500).json({ error: 'SnapTrade service is not properly configured' });
    }
    
    // Add the userId to the request for the SnapTrade service to use
    (req as any).userId = userId;
    
    // Initialize SnapTrade service for this user (only when needed for certain operations)
    // This is a potentially expensive operation, so we'll leave it to individual route handlers
    // that need a fully initialized connection.
    
    console.log(`SnapTrade auth middleware - Successfully added user ID to request`);
    next();
  } catch (error) {
    console.error('Error in SnapTrade auth middleware:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    res.status(500).json({ error: 'Internal server error in SnapTrade auth middleware' });
  }
};

/**
 * Check if SnapTrade is configured
 * GET /api/snaptrade/status
 */
snaptradeRoutes.get('/status', async (_req: Request, res: Response) => {
  try {
    const isConfigured = snapTradeSDKService.isConfigured();
    
    res.json({
      configured: isConfigured
    });
  } catch (error) {
    console.error('Error checking SnapTrade configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Connect to SnapTrade (get authorization URL)
 * POST /api/snaptrade/connect
 */
snaptradeRoutes.post('/connect', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { redirectUri } = req.body;
    const userId = (req as any).userId;
    
    if (!redirectUri) {
      return res.status(400).json({ error: 'Missing redirectUri' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in request' });
    }
    
    // Check if we have a SnapTrade user record for this user
    console.log(`Checking SnapTrade credentials in database for user ${userId}`);
    
    // First make sure user exists in the database
    const [userRecord] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
      
    if (!userRecord) {
      console.error(`User record for user ${userId} not found in database`);
      return res.status(500).json({ error: 'User not found in database' });
    }
    
    console.log(`User record found for user ${userId}, checking for SnapTrade credentials`);
    console.log(`User has snapTradeCredentials: ${!!userRecord.snapTradeCredentials}`);
    
    // If user doesn't have SnapTrade credentials, create an empty object
    if (!userRecord.snapTradeCredentials) {
      console.log(`No SnapTrade credentials for user ${userId}, creating empty field...`);
      
      try {
        // Update user record with empty credentials to help initialize
        await db.update(users)
          .set({
            snapTradeCredentials: {
              userId: '',      // Will be populated during registration
              userSecret: '',  // Will be populated during registration
              isRegistered: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          })
          .where(eq(users.id, userId));
          
        console.log(`Created empty SnapTrade credentials for user ${userId}`);
      } catch (updateError) {
        console.error(`Failed to create empty SnapTrade credentials for user ${userId}:`, updateError);
      }
    }
    
    // Initialize SnapTrade for this user before generating the authorization URL
    console.log(`Initializing SnapTrade service for user ${userId} before connecting`);
    const initialized = await snapTradeSDKService.initializeForUser(userId);
    
    // Log environment availability for diagnostics
    console.log('SnapTrade environment variables availability:');
    console.log('- SNAPTRADE_CLIENT_ID exists:', !!process.env.SNAPTRADE_CLIENT_ID);
    console.log('- SNAPTRADE_CONSUMER_KEY exists:', !!process.env.SNAPTRADE_CONSUMER_KEY);
    
    if (!initialized) {
      console.error(`Failed to initialize SnapTrade service for user ${userId}, attempting direct registration`);
      
      // Instead of failing, try direct registration
      console.log(`Attempting direct registration for user ${userId}...`);
      const registered = await snapTradeSDKService.registerUser(userId);
      
      if (!registered) {
        console.error(`Failed to register SnapTrade service for user ${userId}`);
        
        // Check if credentials are present to give more specific error messages
        if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CONSUMER_KEY) {
          return res.status(500).json({ 
            error: 'Missing SnapTrade API credentials. Please ensure the SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY environment variables are set.' 
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to register with SnapTrade service. Please check server logs for more details.' 
        });
      }
      
      console.log(`Successfully registered user ${userId} with SnapTrade`);
    }
    
    // Now generate the authorization URL
    const authUrl = await snapTradeSDKService.generateAuthorizationUrl(redirectUri);
    
    if (!authUrl) {
      console.error(`Failed to generate authorization URL for user ${userId}`);
      return res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
    
    console.log(`Successfully generated authorization URL for user ${userId}: ${authUrl.substring(0, 50)}...`);
    
    res.json({
      redirectUrl: authUrl
    });
  } catch (error) {
    console.error('Error connecting to SnapTrade:', error);
    // Add more detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      
      // Return a more descriptive error to the client
      return res.status(500).json({ 
        error: 'Error connecting to SnapTrade service', 
        message: error.message,
        // Include environment status to help diagnose issues
        env: {
          clientIdPresent: !!process.env.SNAPTRADE_CLIENT_ID,
          consumerKeyPresent: !!process.env.SNAPTRADE_CONSUMER_KEY
        }
      });
    }
    
    // Generic error response
    res.status(500).json({ error: 'Internal server error connecting to SnapTrade' });
  }
});

/**
 * Handle SnapTrade callback after authorization
 * POST /api/snaptrade/callback
 */
snaptradeRoutes.post('/callback', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, brokerage } = req.body;
    const userId = (req as any).userId;
    
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in request' });
    }
    
    // Initialize SnapTrade for this user before handling callback
    console.log(`Initializing SnapTrade service for user ${userId} before handling callback`);
    const initialized = await snapTradeSDKService.initializeForUser(userId);
    
    if (!initialized) {
      console.error(`Failed to initialize SnapTrade service for user ${userId}`);
      return res.status(500).json({ error: 'Failed to initialize SnapTrade service' });
    }
    
    const success = await snapTradeSDKService.handleAuthorizationCallback(code, brokerage);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to complete authorization' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling SnapTrade callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all brokerage connections
 * GET /api/snaptrade/connections
 */
snaptradeRoutes.get('/connections', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in request' });
    }
    
    // Initialize SnapTrade for this user before getting connections
    console.log(`Initializing SnapTrade service for user ${userId} before fetching connections`);
    const initialized = await snapTradeSDKService.initializeForUser(userId);
    
    if (!initialized) {
      console.error(`Failed to initialize SnapTrade service for user ${userId}`);
      return res.status(500).json({ error: 'Failed to initialize SnapTrade service' });
    }
    
    const connections = await snapTradeSDKService.getConnections();
    
    res.json({
      connections
    });
  } catch (error) {
    console.error('Error getting SnapTrade connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a brokerage connection
 * DELETE /api/snaptrade/connections/:connectionId
 */
snaptradeRoutes.delete('/connections/:connectionId', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    
    if (!connectionId) {
      return res.status(400).json({ error: 'Missing connection ID' });
    }
    
    const success = await snapTradeSDKService.deleteConnection(connectionId);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete connection' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting SnapTrade connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all SnapTrade accounts
 * GET /api/snaptrade/accounts
 */
snaptradeRoutes.get('/accounts', snaptradeAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const accounts = await snapTradeSDKService.getAccounts();
    
    res.json({
      accounts
    });
  } catch (error) {
    console.error('Error getting SnapTrade accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get account balances
 * GET /api/snaptrade/accounts/:accountId/balances
 */
snaptradeRoutes.get('/accounts/:accountId/balances', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Missing account ID' });
    }
    
    const balances = await snapTradeSDKService.getAccountBalances(accountId);
    
    if (!balances) {
      return res.status(500).json({ error: 'Failed to get account balances' });
    }
    
    res.json({
      balances
    });
  } catch (error) {
    console.error('Error getting SnapTrade account balances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get account positions
 * GET /api/snaptrade/accounts/:accountId/positions
 */
snaptradeRoutes.get('/accounts/:accountId/positions', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Missing account ID' });
    }
    
    const positions = await snapTradeSDKService.getAccountPositions(accountId);
    
    res.json({
      positions
    });
  } catch (error) {
    console.error('Error getting SnapTrade account positions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get quote for a symbol
 * GET /api/snaptrade/quote/:symbol
 */
snaptradeRoutes.get('/quote/:symbol', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol' });
    }
    
    const quote = await snapTradeSDKService.getQuote(symbol);
    
    if (!quote) {
      return res.status(500).json({ error: 'Failed to get quote' });
    }
    
    res.json({
      quote
    });
  } catch (error) {
    console.error('Error getting SnapTrade quote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Place an order
 * POST /api/snaptrade/accounts/:accountId/orders
 */
snaptradeRoutes.post('/accounts/:accountId/orders', snaptradeAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const order = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Missing account ID' });
    }
    
    if (!order || !order.symbol || !order.quantity) {
      return res.status(400).json({ error: 'Missing order details' });
    }
    
    const result = await snapTradeSDKService.placeOrder(accountId, order);
    
    if (!result) {
      return res.status(500).json({ error: 'Failed to place order' });
    }
    
    res.json({
      order: result
    });
  } catch (error) {
    console.error('Error placing SnapTrade order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get available brokerages
 * GET /api/snaptrade/brokerages
 * This endpoint doesn't require full user authentication, but we need to check
 * if SnapTrade is properly configured
 */
snaptradeRoutes.get('/brokerages', async (_req: Request, res: Response) => {
  try {
    // Check if SnapTrade service is configured before making the API call
    if (!snapTradeSDKService.isConfigured()) {
      console.error('SnapTrade service is not properly configured');
      return res.status(503).json({ 
        error: 'SnapTrade service is not properly configured',
        message: 'The SnapTrade API credentials are missing or invalid'
      });
    }

    // Make the API call to get brokerages
    console.log('Making request to SnapTrade API for brokerages list');
    const brokerages = await snapTradeSDKService.getBrokerages();
    
    res.json({
      brokerages
    });
  } catch (error) {
    console.error('Error getting SnapTrade brokerages:', error);
    
    // Return a more specific error message based on the error
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing SnapTrade API credentials'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error retrieving brokerages'
    });
  }
});