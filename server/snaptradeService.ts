/**
 * SnapTrade Service
 * 
 * This service handles all interactions with the SnapTrade API.
 * It provides methods for user registration, authorization, and data retrieval.
 */

import { db } from './db';
import { apiIntegrations, type SnapTradeConnectionInfo } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface SnapTradeConfig {
  clientId: string;
  consumerKey: string;
  apiEndpoint: string;
}

export class SnapTradeService {
  private config: SnapTradeConfig;
  private snapTradeUserId: string | null = null;
  private userSecret: string | null = null;
  private defaultHeaders: Record<string, string>;

  /**
   * Constructor
   * @param config The SnapTrade configuration
   */
  constructor(config: SnapTradeConfig) {
    this.config = config;
    // Based on our API tests, SnapTrade uses Authorization header with the Consumer Key
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': this.config.consumerKey
    };
    
    // Log the header structure for debugging (without showing the full key)
    console.log('Using SnapTrade authorization headers with format:', {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `${this.config.consumerKey ? `${this.config.consumerKey.substring(0, 5)}...` : 'Missing'}`
    });
  }

  /**
   * Initialize the service with a user ID from our system
   * @param userId The internal user ID
   */
  async initializeForUser(userId: number): Promise<boolean> {
    try {
      console.log(`Initializing SnapTrade for user ID: ${userId}`);
      
      // Make sure API credentials are configured
      if (!this.isConfigured()) {
        console.error('SnapTrade API credentials not properly configured');
        return false;
      }
      
      // Look for an existing integration
      const integration = await this.findUserIntegration(userId);
      
      if (integration) {
        console.log(`Found existing SnapTrade integration for user ${userId}`);
        
        // If found, extract the provider-specific user ID and secrets
        this.snapTradeUserId = integration.providerUserId || null;
        
        // Extract user secret from credentials
        if (integration.credentials && integration.credentials.userSecret) {
          this.userSecret = integration.credentials.userSecret;
        }
        
        const hasRequiredFields = !!this.snapTradeUserId && !!this.userSecret;
        if (!hasRequiredFields) {
          console.error(`Missing required SnapTrade fields for user ${userId}:`, {
            hasSnapTradeUserId: !!this.snapTradeUserId,
            hasUserSecret: !!this.userSecret
          });
          
          console.log(`Invalid SnapTrade integration detected for user ${userId}, re-registering...`);
          
          // Delete the invalid integration
          try {
            await this.deleteInvalidIntegration(userId, integration.id);
            console.log(`Deleted invalid SnapTrade integration for user ${userId}`);
          } catch (deleteError) {
            console.error(`Failed to delete invalid integration for user ${userId}:`, deleteError);
          }
          
          // Register a new user with SnapTrade
          return await this.registerUser(userId);
        }
        return true;
      } else {
        console.log(`No existing SnapTrade integration found for user ${userId}, registering new user`);
        // If not found, register the user with SnapTrade
        return await this.registerUser(userId);
      }
    } catch (error) {
      console.error('Error initializing SnapTrade for user:', error);
      // Add more context to the error
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
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
            eq(apiIntegrations.userId, userId),
            eq(apiIntegrations.id, integrationId)
          )
        );
      return true;
    } catch (error) {
      console.error('Error deleting invalid integration:', error);
      return false;
    }
  }

  /**
   * Register a new user with SnapTrade
   * @param userId Our internal user ID
   */
  private async registerUser(userId: number): Promise<boolean> {
    try {
      // Generate a unique ID for SnapTrade based on user ID and timestamp
      // This ID needs to be unique and immutable per user (not using email)
      const snapTradeUserId = `user-${userId}-${Date.now()}`;
      
      // Based on the SnapTrade documentation example, we need to handle authentication
      // through headers and query parameters in a specific way
      // The endpoint should include clientId as a query parameter
      const endpoint = `${this.config.apiEndpoint}/registerUser?clientId=${encodeURIComponent(this.config.clientId)}`;
      console.log(`Registering user with SnapTrade: ${snapTradeUserId}`);
      console.log(`Using API endpoint: ${endpoint}`);
      
      // Simple request body with just the userId as shown in documentation
      const requestBody = {
        userId: snapTradeUserId
      };
      
      console.log('Registration request body:', JSON.stringify(requestBody));
      
      // Based on our API testing, we must pass:
      // 1. clientId as a query parameter
      // 2. consumerKey in the Authorization header
      const specialHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': this.config.consumerKey
      };
      
      console.log('Using updated SnapTrade headers with format:', {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': this.config.consumerKey.substring(0, 5) + '...'
      });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: specialHeaders,
        body: JSON.stringify(requestBody)
      });
      
      console.log(`Registration response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error registering user with SnapTrade (${response.status}): ${responseText}`);
      }
      
      const data = await response.json();
      console.log('Registration response data received');
      
      if (!data.userSecret) {
        throw new Error('User secret not received from SnapTrade');
      }
      
      console.log(`Successfully registered user with SnapTrade, received userSecret`);
      
      // Save the integration
      await db.insert(apiIntegrations).values({
        userId,
        provider: 'snaptrade',
        type: 'brokerage',
        description: 'SnapTrade Integration',
        providerUserId: snapTradeUserId,
        credentials: {
          apiKey: this.config.clientId,
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
      
      this.snapTradeUserId = snapTradeUserId;
      this.userSecret = data.userSecret;
      
      return true;
    } catch (error) {
      console.error('Error registering user with SnapTrade:', error);
      await this.logApiError(userId, 'registerUser', error);
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/auth/authorizationUrl`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          userId: this.snapTradeUserId,
          userSecret: this.userSecret,
          redirectUri
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error generating authorization URL: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.authorizationUrl;
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/auth/exchangeAuthorizationCode`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          userId: this.snapTradeUserId,
          userSecret: this.userSecret,
          authorizationCode: code,
          brokerage
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error exchanging authorization code: ${response.statusText}`);
      }
      
      // Successful connection
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/connections`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error retrieving connections: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting connection: ${response.statusText}`);
      }
      
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/accounts`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error retrieving accounts: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/accounts/${accountId}/balances`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error retrieving account balances: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
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
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/accounts/${accountId}/positions`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error retrieving account positions: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting SnapTrade account positions:', error);
      return [];
    }
  }

  /**
   * Get quote data for a symbol
   * @param symbol The symbol to get a quote for
   */
  async getQuote(symbol: string): Promise<any> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/quotes/${encodeURIComponent(symbol)}`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error retrieving quote: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting SnapTrade quote:', error);
      return null;
    }
  }

  /**
   * Search for symbols
   * @param query The search query
   */
  async searchSymbols(query: string): Promise<any[]> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/symbols/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error searching symbols: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error searching SnapTrade symbols:', error);
      return [];
    }
  }

  /**
   * Place a trade order
   * @param accountId The account ID
   * @param order The order details
   */
  async placeOrder(accountId: string, order: any): Promise<any> {
    try {
      if (!this.snapTradeUserId || !this.userSecret) {
        throw new Error('SnapTrade service not initialized for user');
      }
      
      // Corrected the API endpoint path to match SnapTrade documentation
      const response = await fetch(`${this.config.apiEndpoint}/accounts/${accountId}/orders`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        },
        body: JSON.stringify(order)
      });
      
      if (!response.ok) {
        throw new Error(`Error placing order: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error placing SnapTrade order:', error);
      return null;
    }
  }

  /**
   * Check if the SnapTrade configuration is valid
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.consumerKey && this.config.apiEndpoint);
  }

  /**
   * Get all brokerages available for connection
   */
  async getBrokerages(): Promise<any[]> {
    try {
      // Based on the SnapTrade documentation, we need to include clientId as a query parameter
      const queryParams = `clientId=${encodeURIComponent(this.config.clientId)}`;
      // API endpoint with query parameter
      const response = await fetch(`${this.config.apiEndpoint}/brokerages?${queryParams}`, {
        method: 'GET',
        headers: this.defaultHeaders
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        throw new Error(`Error retrieving brokerages (${response.status}): ${responseText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting SnapTrade brokerages:', error);
      return [];
    }
  }

  /**
   * Create a SnapTrade service instance from environment variables
   */
  static createFromEnv(): SnapTradeService {
    const clientId = process.env.SNAPTRADE_CLIENT_ID || '';
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY || '';
    const apiEndpoint = process.env.SNAPTRADE_API_ENDPOINT || 'https://api.snaptrade.com/api/v1';
    
    // First log the environment variables keys available
    console.log('Environment variables available:', Object.keys(process.env)
      .filter(key => key.includes('SNAP') || key.includes('API') || key.includes('KEY'))
      .map(key => `${key}: ${key.includes('KEY') || key.includes('SECRET') ? '(sensitive)' : 'present'}`));
    
    // Log the SnapTrade-specific configuration
    console.log('Initializing SnapTrade service with config:', {
      clientId: clientId ? `${clientId.substring(0, 3)}...${clientId.length}chars` : 'MISSING',
      consumerKey: consumerKey ? `${consumerKey.substring(0, 3)}...${consumerKey.length}chars` : 'MISSING',
      apiEndpoint
    });
    
    // Clear warning if credentials are missing
    if (!clientId || !consumerKey) {
      console.error('SnapTrade credentials missing! The integration will not work without valid credentials.');
      console.error('Please ensure SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY environment variables are set.');
    }
    
    return new SnapTradeService({
      clientId,
      consumerKey,
      apiEndpoint
    });
  }

  /**
   * Log a SnapTrade API error to the database
   */
  private async logApiError(userId: number, method: string, error: any): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await db.insert(apiIntegrations).values({
        userId,
        provider: 'snaptrade',
        type: 'error_log',
        description: `SnapTrade API Error: ${method}`,
        credentials: {
          apiKey: 'error_log'
        },
        lastStatus: 'error',
        lastError: errorMessage
      });
    } catch (logError) {
      console.error('Failed to log SnapTrade API error:', logError);
    }
  }
}

// Export singleton instance
export const snapTradeService = SnapTradeService.createFromEnv();