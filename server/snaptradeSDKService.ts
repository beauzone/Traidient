/**
 * SnapTrade SDK Service
 * 
 * This service uses the official SnapTrade TypeScript SDK to interact with the SnapTrade API.
 * It replaces our custom implementation to ensure proper API compatibility.
 */

import { Snaptrade } from 'snaptrade-typescript-sdk';
import { randomBytes } from 'crypto';
import { db } from './db';
import { apiIntegrations, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

// Define an error type for API errors
interface SnapTradeApiError {
  statusCode?: number;
  message: string;
  error?: any;
}

// Interface for connection information
export interface SnapTradeConnectionInfo {
  id: string;
  brokerage: {
    id: string;
    name: string;
    logo?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export class SnapTradeSDKService {
  private client: Snaptrade;
  private snapTradeUserId: string | null = null;
  private userSecret: string | null = null;

  /**
   * Constructor
   */
  constructor() {
    // Get environment variables
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;

    // Validate environment variables
    if (!clientId || !consumerKey) {
      console.error('Missing required SnapTrade environment variables');
      throw new Error('Missing required SnapTrade environment variables');
    }

    // Initialize the SDK client
    this.client = new Snaptrade({
      clientId,
      consumerKey
    });

    console.log('SnapTrade SDK service initialized with credentials');
  }

  /**
   * Initialize the service with a user ID from our system
   * @param userId The internal user ID
   * @returns True if initialization succeeded
   */
  async initializeForUser(userId: number): Promise<boolean> {
    try {
      console.log(`Initializing SnapTrade for user ID: ${userId}`);
      
      // Try to find the user
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        console.error(`User ${userId} not found`);
        return false;
      }

      console.log(`User record found: ${!!user}, Has snapTradeCredentials: ${!!user.snapTradeCredentials}`);

      // Check if user has SnapTrade credentials
      if (user.snapTradeCredentials) {
        console.log(`Found SnapTrade credentials in user record for user ${userId}`);
        
        // Get the userId and userSecret
        const { snapTradeUserId, userSecret } = user.snapTradeCredentials;
        
        // Debug
        console.log(`Credential details: userId exists: ${!!snapTradeUserId}, userSecret exists: ${!!userSecret}`);
        
        // Verify credentials are valid
        if (!snapTradeUserId || !userSecret) {
          console.log(`Invalid credentials for user ${userId}: missing userId or userSecret`);
        } else {
          // Set credentials
          this.snapTradeUserId = snapTradeUserId;
          this.userSecret = userSecret;
          return true;
        }
      }

      // If we got here, we need to check if there's an integration record
      const integration = await this.findUserIntegration(userId);
      if (integration) {
        console.log(`Found existing SnapTrade integration for user ${userId}`);
        
        // Validate that the credentials contain what we need
        const hasSnapTradeUserId = !!(integration.providerUserId);
        const hasUserSecret = !!(integration.credentials?.userSecret);
        
        console.log(`Missing required SnapTrade fields for user ${userId}: ${JSON.stringify({
          hasSnapTradeUserId,
          hasUserSecret
        })}`);
        
        // If missing required fields, delete the integration and create a new one
        if (!hasSnapTradeUserId || !hasUserSecret) {
          console.log(`Invalid SnapTrade integration detected for user ${userId}, re-registering...`);
          await this.deleteInvalidIntegration(userId, integration.id);
        } else {
          // Set credentials from integration
          this.snapTradeUserId = integration.providerUserId;
          this.userSecret = integration.credentials.userSecret;
          
          // Also update the user record
          await this.storeUserCredentials(userId, this.snapTradeUserId, this.userSecret);
          return true;
        }
      }

      // If we got here, we need to register the user
      console.log(`No existing SnapTrade credentials found for user ${userId}, registering...`);
      return await this.registerUser(userId);
    } catch (error) {
      console.error(`Error initializing SnapTrade service for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Register a new user with SnapTrade
   * @param userId Our internal user ID
   */
  async registerUser(userId: number): Promise<boolean> {
    try {
      // Generate a unique ID for SnapTrade based on user ID
      const snapTradeUserId = `user-${userId}-${randomBytes(8).toString('hex')}`;
      
      console.log(`Registering user with SnapTrade: ${snapTradeUserId}`);
      
      // Use the SDK to register the user
      const result = await this.client.authentication.registerSnapTradeUser({
        userId: snapTradeUserId
      });

      if (!result.data) {
        console.error('Registration failed - no data returned from API');
        return false;
      }

      const data = result.data;
      console.log('Registration successful, got user credentials');
      
      // Save the integration
      await db.insert(apiIntegrations).values({
        userId,
        provider: 'snaptrade',
        type: 'brokerage',
        description: 'SnapTrade Integration',
        providerUserId: snapTradeUserId,
        credentials: {
          apiKey: process.env.SNAPTRADE_CLIENT_ID!,
          userSecret: data.userSecret
        },
        capabilities: {
          trading: true,
          marketData: true,
          accountData: true,
          paperTrading: false,
          liveTrading: true
        }
      });
      
      console.log(`Saved SnapTrade integration to database for user ${userId}`);
      
      // Store the credentials in the user record for future use
      await this.storeUserCredentials(userId, snapTradeUserId, data.userSecret);
      
      // Set the credentials
      this.snapTradeUserId = snapTradeUserId;
      this.userSecret = data.userSecret;
      
      return true;
    } catch (error) {
      console.error('Error registering user with SnapTrade:', error);
      return false;
    }
  }

  /**
   * Store SnapTrade credentials in the user record
   * @param userId Our internal user ID
   * @param snapTradeUserId The SnapTrade user ID
   * @param userSecret The SnapTrade user secret
   */
  private async storeUserCredentials(userId: number, snapTradeUserId: string | null, userSecret: string | null): Promise<boolean> {
    try {
      // Update the user record with SnapTrade credentials
      await db.update(users)
        .set({
          snapTradeCredentials: {
            snapTradeUserId,
            userSecret
          }
        })
        .where(eq(users.id, userId));
      
      return true;
    } catch (error) {
      console.error(`Error storing SnapTrade credentials for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Delete an invalid integration
   * @param userId The user ID
   * @param integrationId The integration ID
   */
  private async deleteInvalidIntegration(userId: number, integrationId: number): Promise<boolean> {
    try {
      await db.delete(apiIntegrations)
        .where(
          and(
            eq(apiIntegrations.id, integrationId),
            eq(apiIntegrations.userId, userId)
          )
        );
      
      console.log(`Deleted invalid SnapTrade integration for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting invalid SnapTrade integration for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Find a user's SnapTrade integration
   * @param userId Our internal user ID
   */
  private async findUserIntegration(userId: number) {
    try {
      const [integration] = await db
        .select()
        .from(apiIntegrations)
        .where(
          and(
            eq(apiIntegrations.userId, userId),
            eq(apiIntegrations.provider, 'snaptrade')
          )
        );
      
      return integration;
    } catch (error) {
      console.error('Error finding SnapTrade integration:', error);
      return null;
    }
  }

  /**
   * Generate a redirect URL for connecting to a brokerage
   * @param redirectUri The URI to redirect back to after authorization
   */
  async generateAuthorizationUrl(redirectUri: string): Promise<string | null> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Generating SnapTrade authorization URL for user ${this.snapTradeUserId}`);
      
      // Use the SDK to generate the authorization URL
      const result = await this.client.authentication.listBrokerages();
      
      if (!result.data) {
        console.error('Failed to retrieve brokerages list');
        return null;
      }
      
      // Get the broker IDs from the first page
      const brokerages = result.data;
      
      // Additional debug info for brokerage selection
      console.log(`Found ${brokerages.length} available brokerages`);
      
      // Use the SDK to generate an authorization URL
      const authUrlResult = await this.client.authentication.generateAuthorizeUrl({
        userId: this.snapTradeUserId,
        userSecret: this.userSecret,
        redirectUri,
        broker: "ALL" // Allow user to select from all brokerages in the UI
      });
      
      if (!authUrlResult.data) {
        console.error('Failed to generate authorization URL');
        return null;
      }
      
      return authUrlResult.data.authorizeUrl;
    } catch (error) {
      console.error('Error generating SnapTrade authorization URL:', error);
      return null;
    }
  }

  /**
   * Handle the authorization callback from SnapTrade
   * @param code The authorization code
   * @param brokerage The brokerage identifier
   */
  async handleAuthorizationCallback(code: string, brokerage?: string): Promise<boolean> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Handling authorization callback for user ${this.snapTradeUserId}`);
      
      // Use the SDK to exchange the authorization code
      const result = await this.client.authentication.exchangeAuthorizationCodeForSession({
        userId: this.snapTradeUserId,
        userSecret: this.userSecret,
        code,
      });
      
      if (!result.data) {
        console.error('Failed to exchange authorization code');
        return false;
      }
      
      console.log('Successfully exchanged authorization code');
      return true;
    } catch (error) {
      console.error('Error handling SnapTrade callback:', error);
      return false;
    }
  }

  /**
   * Get all connections for the current user
   */
  async getConnections(): Promise<SnapTradeConnectionInfo[]> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Getting connections for user ${this.snapTradeUserId}`);
      
      // Use the SDK to get all connections
      const result = await this.client.connections.listUserConnections(
        this.snapTradeUserId,
        this.userSecret
      );
      
      if (!result.data) {
        console.error('Failed to retrieve connections');
        return [];
      }
      
      // Transform the data into our format
      return result.data.map(connection => ({
        id: connection.id || '',
        brokerage: {
          id: connection.brokerage?.id || '',
          name: connection.brokerage?.name || 'Unknown',
          logo: connection.brokerage?.logo_url || undefined
        },
        createdAt: connection.created_date || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting SnapTrade connections:', error);
      return [];
    }
  }

  /**
   * Delete a connection for the current user
   * @param connectionId The connection ID to delete
   */
  async deleteConnection(connectionId: string): Promise<boolean> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Deleting connection ${connectionId} for user ${this.snapTradeUserId}`);
      
      // Use the SDK to delete the connection
      await this.client.connections.removeUserConnection(
        this.snapTradeUserId,
        this.userSecret,
        connectionId
      );
      
      return true;
    } catch (error) {
      console.error('Error deleting SnapTrade connection:', error);
      return false;
    }
  }

  /**
   * Get all accounts for the current user
   */
  async getAccounts(): Promise<any[]> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Getting accounts for user ${this.snapTradeUserId}`);
      
      // Use the SDK to get all accounts
      const result = await this.client.accountInformation.listUserAccounts(
        this.snapTradeUserId,
        this.userSecret
      );
      
      if (!result.data) {
        console.error('Failed to retrieve accounts');
        return [];
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting SnapTrade accounts:', error);
      return [];
    }
  }

  /**
   * Get account balances
   * @param accountId The account ID
   */
  async getAccountBalances(accountId: string): Promise<any> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Getting balances for account ${accountId}`);
      
      // Use the SDK to get account balances
      const result = await this.client.accountInformation.getUserAccountBalance(
        this.snapTradeUserId,
        this.userSecret,
        accountId
      );
      
      if (!result.data) {
        console.error('Failed to retrieve account balances');
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting SnapTrade account balances:', error);
      return null;
    }
  }

  /**
   * Get account positions
   * @param accountId The account ID
   */
  async getAccountPositions(accountId: string): Promise<any[]> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Getting positions for account ${accountId}`);
      
      // Use the SDK to get account positions
      const result = await this.client.accountInformation.getUserAccountHoldings(
        this.snapTradeUserId,
        this.userSecret,
        accountId
      );
      
      if (!result.data) {
        console.error('Failed to retrieve account positions');
        return [];
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting SnapTrade account positions:', error);
      return [];
    }
  }

  /**
   * Get quote for a symbol
   * @param symbol The symbol to get a quote for
   */
  async getQuote(symbol: string): Promise<any> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Getting quote for symbol ${symbol}`);
      
      // Use the SDK to get a quote
      const result = await this.client.trading.getMarketQuote(
        this.snapTradeUserId,
        this.userSecret,
        { symbol, accountId: null } // accountId is optional
      );
      
      if (!result.data) {
        console.error('Failed to retrieve quote');
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting SnapTrade quote:', error);
      return null;
    }
  }

  /**
   * Place an order for the specified account
   * @param accountId The account ID
   * @param order The order details
   */
  async placeOrder(accountId: string, order: any): Promise<any> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      console.log(`Placing order in account ${accountId} for symbol ${order.symbol}`);
      
      // Use the SDK to place a simple order
      const result = await this.client.trading.placeSimpleOrder({
        userId: this.snapTradeUserId,
        userSecret: this.userSecret,
        accountId,
        instrument: {
          symbol: order.symbol,
          type: "EQUITY", // Default to EQUITY, could be enhanced to support other types
          id: order.symbolId // Optional, if available
        },
        action: order.side || (order.action === 'BUY' ? 'BUY' : 'SELL'), // Support multiple naming conventions
        limitPrice: order.limitPrice || undefined,
        stopPrice: order.stopPrice || undefined,
        timeInForce: order.timeInForce || "Day",
        quantity: order.quantity || 0,
        orderType: order.orderType || (order.limitPrice ? 'Limit' : 'Market')
      });
      
      if (!result.data) {
        console.error('Failed to place order');
        return null;
      }
      
      console.log(`Successfully placed order, order ID: ${result.data.id || 'Unknown'}`);
      return result.data;
    } catch (error) {
      console.error('Error placing SnapTrade order:', error);
      return null;
    }
  }

  /**
   * Check if the SnapTrade configuration is valid
   */
  isConfigured(): boolean {
    return !!process.env.SNAPTRADE_CLIENT_ID && !!process.env.SNAPTRADE_CONSUMER_KEY;
  }

  /**
   * Get all brokerages available for connection
   */
  async getBrokerages(): Promise<any[]> {
    try {
      console.log('Getting available brokerages');
      
      // Use the SDK to get all brokerages
      const result = await this.client.authentication.listBrokerages();
      
      if (!result.data) {
        console.error('Failed to retrieve brokerages');
        return [];
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting SnapTrade brokerages:', error);
      return [];
    }
  }
}

// Export a singleton instance
export const snapTradeSDKService = new SnapTradeSDKService();