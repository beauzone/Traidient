/**
 * SnapTrade Service
 * 
 * This service handles all interactions with the SnapTrade API.
 * It provides methods for user registration, authorization, and data retrieval.
 */

import { db } from './db';
import { apiIntegrations, users, type SnapTradeConnectionInfo } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

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
   * Create a properly formatted API URL with clientId as a query parameter
   * @param path The API path to append to the endpoint
   * @param additionalParams Any additional query parameters to include
   * @returns A properly formatted URL
   */
  private createApiUrl(path: string, additionalParams: Record<string, string> = {}): string {
    // Start with the base endpoint and path
    const url = new URL(`${this.config.apiEndpoint}/${path}`);
    
    // Always add clientId as a query parameter
    url.searchParams.append('clientId', this.config.clientId);
    
    // Add any additional query parameters
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    return url.toString();
  }

  /**
   * Constructor
   * @param config The SnapTrade configuration
   */
  constructor(config: SnapTradeConfig) {
    this.config = config;
    // Based on SnapTrade API documentation, we need to format the Authorization header properly with Bearer prefix
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.consumerKey}`
    };
    
    // Log the header structure for debugging (without showing the full key)
    console.log('Using SnapTrade authorization headers with format:', {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.consumerKey ? `${this.config.consumerKey.substring(0, 5)}...` : 'Missing'}`
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
      
      // First, check if the user has SnapTrade credentials in the users table
      const [userWithCredentials] = await db.select()
        .from(users)
        .where(eq(users.id, userId));
      
      // Log whether the user exists and has credentials  
      console.log(`User record found: ${!!userWithCredentials}, Has snapTradeCredentials: ${!!(userWithCredentials?.snapTradeCredentials)}`);
      
      // Check if the user exists
      if (!userWithCredentials) {
        console.error(`User with ID ${userId} not found in database`);
        return false;
      }
        
      if (userWithCredentials?.snapTradeCredentials) {
        console.log(`Found SnapTrade credentials in user record for user ${userId}`);
        
        const credentials = userWithCredentials.snapTradeCredentials;
        this.snapTradeUserId = credentials.userId;
        this.userSecret = credentials.userSecret;
        
        console.log(`Credential details: userId exists: ${!!this.snapTradeUserId}, userSecret exists: ${!!this.userSecret}`);
        
        if (this.snapTradeUserId && this.userSecret) {
          console.log(`Successfully initialized SnapTrade with user ID: ${this.snapTradeUserId}`);
          return true;
        } else {
          console.error(`Invalid credentials for user ${userId}: missing userId or userSecret`);
        }
      } else {
        console.log(`No snapTradeCredentials found in user record ${userId}, attempting to register`);
      }
      
      // If no credentials in user record, look for an existing integration
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
        
        // Only store the credentials if we have valid ones
        if (this.snapTradeUserId && this.userSecret) {
          // Store the credentials in the user record for future use
          const stored = await this.storeUserCredentials(userId, this.snapTradeUserId, this.userSecret);
          if (stored) {
            console.log(`Successfully stored SnapTrade credentials for user ${userId}`);
          } else {
            console.warn(`Failed to store SnapTrade credentials for user ${userId}`);
          }
        } else {
          console.warn(`Cannot store SnapTrade credentials for user ${userId}: missing userId or userSecret`);
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
   * Store SnapTrade credentials in the user record
   * @param userId Our internal user ID
   * @param snapTradeUserId The SnapTrade user ID
   * @param userSecret The SnapTrade user secret
   */
  private async storeUserCredentials(userId: number, snapTradeUserId: string | null, userSecret: string | null): Promise<boolean> {
    try {
      // Validate inputs
      if (!snapTradeUserId || !userSecret) {
        console.error('Cannot store SnapTrade credentials: missing userId or userSecret');
        return false;
      }
      
      // Update the user record with SnapTrade credentials
      await db.update(users)
        .set({
          snapTradeCredentials: {
            userId: snapTradeUserId,
            userSecret: userSecret,
            isRegistered: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        })
        .where(eq(users.id, userId));
        
      console.log(`Stored SnapTrade credentials in user record for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error storing SnapTrade credentials:', error);
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
  async registerUser(userId: number): Promise<boolean> {
    try {
      // Check if API credentials are configured
      if (!this.isConfigured()) {
        console.error('Cannot register user: SnapTrade API credentials not properly configured');
        return false;
      }
      
      // Generate a unique ID for SnapTrade based on user ID
      // This ID needs to be unique and immutable per user (not using email)
      // As per SnapTrade documentation, userId should be unique and immutable
      const snapTradeUserId = `user-${userId}-${randomBytes(8).toString('hex')}`;
      
      // Based on the SnapTrade documentation example, we need to handle authentication
      // through headers and query parameters in a specific way
      // The endpoint should include clientId as a query parameter
      const url = this.createApiUrl('registerUser');
      
      // Output debugging information to console
      console.error('=============== SNAPTRADE DEBUGGING ===============');
      console.error(`Registering user with SnapTrade: ${snapTradeUserId}`);
      console.error(`Using API endpoint: ${url}`);
      console.error(`Client ID: ${this.config.clientId ? this.config.clientId.substring(0, 5) + '...' : 'MISSING'}`);
      console.error(`Consumer Key present: ${!!this.config.consumerKey}`);
      
      // Simple request body with just the userId as shown in documentation
      // Note: According to SnapTrade API docs, the parameter name is 'userId'
      const requestBody = {
        userId: snapTradeUserId
      };
      
      console.error('Registration request body:', JSON.stringify(requestBody));
      console.error('Headers being used:', JSON.stringify({
        ...this.defaultHeaders,
        'Authorization': `Bearer ${this.config.consumerKey ? 'CONSUMER_KEY_PRESENT' : 'MISSING'}`
      }));
      console.error('================================================');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(requestBody)
      });
      
      console.log(`Registration response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        let responseJson = null;
        
        try {
          // Try to parse as JSON first
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            responseJson = await response.json();
            responseText = JSON.stringify(responseJson);
            console.error('API Error Response:', responseJson);
          } else {
            responseText = await response.text();
            console.error('API Error Response (text):', responseText);
          }
        } catch (e) {
          responseText = 'Could not read response body';
          console.error('Failed to parse error response:', e);
        }
        
        throw new Error(`Error registering user with SnapTrade (${response.status}): ${responseText}`);
      }
      
      // Parse the response
      let data;
      try {
        data = await response.json();
        console.log('Registration response data received');
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
        throw new Error('Invalid JSON response from SnapTrade registration');
      }
      
      // Check response structure
      if (!data || typeof data !== 'object') {
        console.error('Unexpected response format:', data);
        throw new Error('Unexpected response format from SnapTrade');
      }
      
      console.log('Registration response structure:', Object.keys(data));
      
      if (!data.userSecret) {
        console.error('User secret missing from response:', data);
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
      
      // Store the credentials in the user record for future use
      await this.storeUserCredentials(userId, snapTradeUserId, data.userSecret);
      
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl('auth/authorizationUrl');
      console.log(`Generating SnapTrade authorization URL with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          userId: this.snapTradeUserId,
          userSecret: this.userSecret,
          redirectUri
        })
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error generating authorization URL (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl('auth/exchangeAuthorizationCode');
      console.log(`Exchanging authorization code with URL: ${url}`);
      
      const response = await fetch(url, {
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
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error exchanging authorization code (${response.status}): ${responseText}`);
      }
      
      // Successful connection
      console.log('Successfully exchanged authorization code with SnapTrade');
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl('connections');
      console.log(`Fetching SnapTrade connections with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error retrieving connections (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl(`connections/${connectionId}`);
      console.log(`Deleting SnapTrade connection ${connectionId} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error deleting connection (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl('accounts');
      console.log(`Fetching SnapTrade accounts with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error retrieving accounts (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl(`accounts/${accountId}/balances`);
      console.log(`Fetching SnapTrade account balances with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error retrieving account balances (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl(`accounts/${accountId}/positions`);
      console.log(`Fetching SnapTrade account positions with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error retrieving account positions (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl(`quotes/${encodeURIComponent(symbol)}`);
      console.log(`Fetching SnapTrade quote for symbol ${symbol} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error retrieving quote (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      // Add the search query parameter
      const url = this.createApiUrl('symbols/search', { q: query });
      console.log(`Searching SnapTrade symbols with query "${query}" and URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        }
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error searching symbols (${response.status}): ${responseText}`);
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
      
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl(`accounts/${accountId}/orders`);
      console.log(`Placing SnapTrade order for account ${accountId} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'userId': this.snapTradeUserId,
          'userSecret': this.userSecret
        },
        body: JSON.stringify(order)
      });
      
      if (!response.ok) {
        // Try to get response text for more details
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        throw new Error(`Error placing order (${response.status}): ${responseText}`);
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
      // Use the createApiUrl helper to ensure clientId is always included
      const url = this.createApiUrl('brokerages');
      console.log(`Fetching SnapTrade brokerages with URL: ${url}`);
      
      const response = await fetch(url, {
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
    
    // Add more debugging for the specific variables we need
    console.log('SNAPTRADE_CLIENT_ID exists:', !!process.env.SNAPTRADE_CLIENT_ID);
    console.log('SNAPTRADE_CONSUMER_KEY exists:', !!process.env.SNAPTRADE_CONSUMER_KEY);
    console.log('API Endpoint being used:', apiEndpoint);
    
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