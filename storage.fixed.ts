import { 
  users, 
  User, 
  InsertUser, 
  apiIntegrations,
  ApiIntegration,
  InsertApiIntegration,
  strategies,
  Strategy,
  InsertStrategy,
  backtests,
  Backtest,
  InsertBacktest,
  deployments,
  Deployment,
  InsertDeployment,
  watchlist,
  WatchlistItem,
  InsertWatchlistItem,
  alertThresholds,
  AlertThreshold,
  InsertAlertThreshold,
  notifications,
  Notification,
  InsertNotification,
  webhooks,
  Webhook,
  InsertWebhook,
  screeners,
  Screener,
  botInstances,
  BotInstance,
  InsertBotInstance,
  botTrades,
  BotTrade,
  InsertBotTrade,
  marketConditions,
  MarketCondition,
  symbolInsights,
  SymbolInsight,
  InsertScreener
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  
  // For compatibility with screener service
  getScreenById(id: number): Promise<Screener | undefined>;
  getScreens(userId?: number): Promise<Screener[]>;
  createScreen(screen: InsertScreener): Promise<Screener>;
  updateScreen(id: number, screenData: Partial<Screener>): Promise<Screener | undefined>;
  deleteScreen(id: number): Promise<boolean>;
  updateScreenLastRun(id: number, results?: any): Promise<Screener | undefined>;
  updateScreenResults(id: number, results: any): Promise<Screener | undefined>;
  
  // API Integration methods for our multi-provider system
  getApiIntegrations(): Promise<ApiIntegration[]>;
  verifyAuthToken(token: string): Promise<{ userId: number }>; // Added for webhook auth

  // API Integrations
  getApiIntegration(id: number): Promise<ApiIntegration | undefined>;
  getApiIntegrations(): Promise<ApiIntegration[]>;
  getApiIntegrationsByUser(userId: number): Promise<ApiIntegration[]>;
  getApiIntegrationByProviderAndUser(userId: number, provider: string): Promise<ApiIntegration | undefined>;
  createApiIntegration(integration: InsertApiIntegration): Promise<ApiIntegration>;
  updateApiIntegration(id: number, integration: Partial<ApiIntegration>): Promise<ApiIntegration | undefined>;
  deleteApiIntegration(id: number): Promise<boolean>;

  // Strategies
  getStrategy(id: number): Promise<Strategy | undefined>;
  getStrategiesByUser(userId: number): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: number, strategy: Partial<Strategy>): Promise<Strategy | undefined>;
  deleteStrategy(id: number): Promise<boolean>;
  
  // Screeners
  getScreener(id: number): Promise<Screener | undefined>;
  getScreenersByUser(userId: number): Promise<Screener[]>;
  createScreener(screener: InsertScreener): Promise<Screener>;
  updateScreener(id: number, screener: Partial<Screener>): Promise<Screener | undefined>;
  deleteScreener(id: number): Promise<boolean>;
  runScreener(id: number): Promise<Screener | undefined>;
  
  // Webhooks
  getWebhook(id: number): Promise<Webhook | undefined>;
  getWebhookByToken(token: string): Promise<Webhook | undefined>;
  getWebhooksByUser(userId: number): Promise<Webhook[]>;
  getWebhooksByStrategy(strategyId: number): Promise<Webhook[]>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: number, webhook: Partial<Webhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: number): Promise<boolean>;
  logWebhookCall(id: number, payload: Record<string, any>, action: string, result: 'success' | 'error', message?: string): Promise<Webhook | undefined>;

  // Backtests
  getBacktest(id: number): Promise<Backtest | undefined>;
  getBacktestsByStrategy(strategyId: number): Promise<Backtest[]>;
  getBacktestsByUser(userId: number): Promise<Backtest[]>;
  createBacktest(backtest: InsertBacktest): Promise<Backtest>;
  updateBacktest(id: number, backtest: Partial<Backtest>): Promise<Backtest | undefined>;
  deleteBacktest(id: number): Promise<boolean>;

  // Deployments
  getDeployment(id: number): Promise<Deployment | undefined>;
  getDeploymentsByUser(userId: number): Promise<Deployment[]>;
  getDeploymentsByStrategy(strategyId: number): Promise<Deployment[]>;
  createDeployment(deployment: InsertDeployment): Promise<Deployment>;
  updateDeployment(id: number, deployment: Partial<Deployment>): Promise<Deployment | undefined>;
  deleteDeployment(id: number): Promise<boolean>;

  // Watchlist
  getWatchlistItems(userId: number): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(id: number): Promise<boolean>;
  
  // Alert Thresholds
  getAlertThreshold(id: number): Promise<AlertThreshold | undefined>;
  getAlertThresholdsByUser(userId: number): Promise<AlertThreshold[]>;
  createAlertThreshold(threshold: InsertAlertThreshold): Promise<AlertThreshold>;
  updateAlertThreshold(id: number, threshold: Partial<AlertThreshold>): Promise<AlertThreshold | undefined>;
  deleteAlertThreshold(id: number): Promise<boolean>;
  
  // Notifications
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number, options?: { limit?: number, offset?: number, isRead?: boolean }): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<Notification>): Promise<Notification | undefined>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  
  // Bot Instances
  getBotInstance(id: number): Promise<BotInstance | undefined>;
  getBotInstancesByUser(userId: number): Promise<BotInstance[]>; 
  getBotInstancesByStrategy(strategyId: number): Promise<BotInstance[]>;
  createBotInstance(botInstance: InsertBotInstance): Promise<BotInstance>;
  updateBotInstance(id: number, botInstance: Partial<BotInstance>): Promise<BotInstance | undefined>;
  deleteBotInstance(id: number): Promise<boolean>;
  
  // Bot Trades
  getBotTrade(id: number): Promise<BotTrade | undefined>;
  getBotTradesByInstance(botInstanceId: number): Promise<BotTrade[]>;
  getBotTradesByUser(userId: number): Promise<BotTrade[]>;
  createBotTrade(trade: InsertBotTrade): Promise<BotTrade>;
  updateBotTrade(id: number, trade: Partial<BotTrade>): Promise<BotTrade | undefined>;
  deleteBotTrade(id: number): Promise<boolean>;
  
  // Market Conditions & Insights
  getLatestMarketCondition(): Promise<MarketCondition | undefined>;
  createMarketCondition(condition: Partial<MarketCondition>): Promise<MarketCondition>;
  getLatestSymbolInsight(symbol: string): Promise<SymbolInsight | undefined>;
  createSymbolInsight(insight: Partial<SymbolInsight>): Promise<SymbolInsight>;
}

import { db } from './db';
import { eq, and, desc, SQL, asc } from 'drizzle-orm';

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // JWT Token verification
  async verifyAuthToken(token: string): Promise<{ userId: number }> {
    // Import and use the JWT library to verify the token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key-should-be-in-env-var";
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      return decoded;
    } catch (error) {
      console.error('JWT verification error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  // API Integration methods
  async getApiIntegration(id: number): Promise<ApiIntegration | undefined> {
    const result = await db.select().from(apiIntegrations).where(eq(apiIntegrations.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getApiIntegrationsByUser(userId: number): Promise<ApiIntegration[]> {
    return await db.select().from(apiIntegrations).where(eq(apiIntegrations.userId, userId));
  }
  
  async getApiIntegrations(): Promise<ApiIntegration[]> {
    return await db.select().from(apiIntegrations);
  }

  async getApiIntegrationByProviderAndUser(userId: number, provider: string): Promise<ApiIntegration | undefined> {
    // Get all integrations for the user
    const integrations = await this.getApiIntegrationsByUser(userId);
    
    // Find the integration using case-insensitive matching
    const matchingIntegration = integrations.find(
      integration => integration.provider.toLowerCase().trim() === provider.toLowerCase().trim()
    );
    
    return matchingIntegration;
  }

  async createApiIntegration(integration: InsertApiIntegration): Promise<ApiIntegration> {
    const [newIntegration] = await db.insert(apiIntegrations).values({
      ...integration,
      lastUsed: new Date(),
      lastStatus: 'ok',
      lastError: null
    }).returning();
    return newIntegration;
  }

  async updateApiIntegration(id: number, integrationData: Partial<ApiIntegration>): Promise<ApiIntegration | undefined> {
    const [updatedIntegration] = await db.update(apiIntegrations)
      .set(integrationData)
      .where(eq(apiIntegrations.id, id))
      .returning();
    return updatedIntegration;
  }

  async deleteApiIntegration(id: number): Promise<boolean> {
    const result = await db.delete(apiIntegrations).where(eq(apiIntegrations.id, id));
    return result.count > 0;
  }

  // Strategy methods
  async getStrategy(id: number): Promise<Strategy | undefined> {
    const result = await db.select().from(strategies).where(eq(strategies.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getStrategiesByUser(userId: number): Promise<Strategy[]> {
    return await db.select().from(strategies).where(eq(strategies.userId, userId));
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const now = new Date();
    const [newStrategy] = await db.insert(strategies).values({
      ...strategy,
      status: 'draft',
      versions: [{
        version: 1,
        timestamp: now.toISOString(),
        changes: 'Initial version',
        configuration: strategy.configuration
      }],
      performance: {},
      createdAt: now,
      updatedAt: now
    }).returning();
    return newStrategy;
  }

  async updateStrategy(id: number, strategyData: Partial<Strategy>): Promise<Strategy | undefined> {
    const now = new Date();
    const [updatedStrategy] = await db.update(strategies)
      .set({
        ...strategyData,
        updatedAt: now
      })
      .where(eq(strategies.id, id))
      .returning();
    return updatedStrategy;
  }

  async deleteStrategy(id: number): Promise<boolean> {
    // Begin transaction to ensure all related data is deleted
    // First delete any backtests associated with the strategy
    await db.delete(backtests).where(eq(backtests.strategyId, id));
    
    // Delete any deployments associated with the strategy
    await db.delete(deployments).where(eq(deployments.strategyId, id));
    
    // Finally delete the strategy itself
    const result = await db.delete(strategies).where(eq(strategies.id, id));
    return result.count > 0;
  }

  // Backtest methods
  async getBacktest(id: number): Promise<Backtest | undefined> {
    const result = await db.select().from(backtests).where(eq(backtests.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getBacktestsByStrategy(strategyId: number): Promise<Backtest[]> {
    return await db.select().from(backtests).where(eq(backtests.strategyId, strategyId));
  }

  async getBacktestsByUser(userId: number): Promise<Backtest[]> {
    return await db.select().from(backtests).where(eq(backtests.userId, userId));
  }

  async createBacktest(backtest: InsertBacktest): Promise<Backtest> {
    const [newBacktest] = await db.insert(backtests).values({
      ...backtest,
      status: 'queued',
      results: {},
      createdAt: new Date(),
      completedAt: null,
      error: null
    }).returning();
    return newBacktest;
  }

  async updateBacktest(id: number, backtestData: Partial<Backtest>): Promise<Backtest | undefined> {
    const [updatedBacktest] = await db.update(backtests)
      .set(backtestData)
      .where(eq(backtests.id, id))
      .returning();
    return updatedBacktest;
  }

  async deleteBacktest(id: number): Promise<boolean> {
    const result = await db.delete(backtests).where(eq(backtests.id, id));
    return result.count > 0;
  }

  // Deployment methods
  async getDeployment(id: number): Promise<Deployment | undefined> {
    const result = await db.select().from(deployments).where(eq(deployments.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getDeploymentsByUser(userId: number): Promise<Deployment[]> {
    return await db.select().from(deployments).where(eq(deployments.userId, userId));
  }

  async getDeploymentsByStrategy(strategyId: number): Promise<Deployment[]> {
    return await db.select().from(deployments).where(eq(deployments.strategyId, strategyId));
  }

  async createDeployment(deployment: InsertDeployment): Promise<Deployment> {
    const now = new Date();
    const [newDeployment] = await db.insert(deployments).values({
      ...deployment,
      status: 'starting',
      runtime: {},
      performance: {},
      createdAt: now,
      updatedAt: now,
      environment: deployment.environment || 'production'
    }).returning();
    return newDeployment;
  }

  async updateDeployment(id: number, deploymentData: Partial<Deployment>): Promise<Deployment | undefined> {
    const now = new Date();
    const [updatedDeployment] = await db.update(deployments)
      .set({
        ...deploymentData,
        updatedAt: now
      })
      .where(eq(deployments.id, id))
      .returning();
    return updatedDeployment;
  }

  async deleteDeployment(id: number): Promise<boolean> {
    const result = await db.delete(deployments).where(eq(deployments.id, id));
    return result.count > 0;
  }

  // Watchlist methods
  async getWatchlistItems(userId: number): Promise<WatchlistItem[]> {
    return await db.select().from(watchlist).where(eq(watchlist.userId, userId));
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [newItem] = await db.insert(watchlist).values({
      ...item,
      createdAt: new Date()
    }).returning();
    return newItem;
  }

  async removeFromWatchlist(id: number): Promise<boolean> {
    const result = await db.delete(watchlist).where(eq(watchlist.id, id));
    return result.count > 0;
  }
  
  // Alert Threshold methods
  async getAlertThreshold(id: number): Promise<AlertThreshold | undefined> {
    const result = await db.select().from(alertThresholds).where(eq(alertThresholds.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getAlertThresholdsByUser(userId: number): Promise<AlertThreshold[]> {
    return await db.select().from(alertThresholds).where(eq(alertThresholds.userId, userId));
  }

  async createAlertThreshold(threshold: InsertAlertThreshold): Promise<AlertThreshold> {
    const now = new Date();
    const [newThreshold] = await db.insert(alertThresholds).values({
      ...threshold,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newThreshold;
  }

  async updateAlertThreshold(id: number, thresholdData: Partial<AlertThreshold>): Promise<AlertThreshold | undefined> {
    const now = new Date();
    const [updatedThreshold] = await db.update(alertThresholds)
      .set({
        ...thresholdData,
        updatedAt: now
      })
      .where(eq(alertThresholds.id, id))
      .returning();
    return updatedThreshold;
  }

  async deleteAlertThreshold(id: number): Promise<boolean> {
    const result = await db.delete(alertThresholds).where(eq(alertThresholds.id, id));
    return result.count > 0;
  }
  
  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    const result = await db.select().from(notifications).where(eq(notifications.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getNotificationsByUser(userId: number, options?: { limit?: number, offset?: number, isRead?: boolean }): Promise<Notification[]> {
    // Create base query
    let query = db.select().from(notifications).where(eq(notifications.userId, userId));
    
    // Add read filter if provided
    if (options?.isRead !== undefined) {
      query = query.where(eq(notifications.isRead, options.isRead));
    }
    
    // Create properly ordered query
    const orderedQuery = query.orderBy(desc(notifications.createdAt));
    
    // Apply limit and offset if provided
    let finalQuery = orderedQuery;
    if (options?.limit) {
      finalQuery = finalQuery.limit(options.limit);
    }
    
    if (options?.offset) {
      finalQuery = finalQuery.offset(options.offset);
    }
    
    // Execute the query
    return await finalQuery;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const now = new Date();
    const [newNotification] = await db.insert(notifications).values({
      ...notification,
      isRead: false,
      isDeleted: false,
      createdAt: now,
      readAt: null
    }).returning();
    return newNotification;
  }
  
  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const [updatedNotification] = await db.update(notifications)
      .set(notificationData)
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const now = new Date();
    const [updatedNotification] = await db.update(notifications)
      .set({
        isRead: true,
        readAt: now
      })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    const now = new Date();
    const result = await db.update(notifications)
      .set({
        isRead: true,
        readAt: now
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result.count > 0;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id));
    return result.count > 0;
  }
  
  // Webhook methods
  async getWebhook(id: number): Promise<Webhook | undefined> {
    const result = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getWebhookByToken(token: string): Promise<Webhook | undefined> {
    const result = await db.select().from(webhooks).where(eq(webhooks.token, token));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getWebhooksByUser(userId: number): Promise<Webhook[]> {
    return await db.select().from(webhooks).where(eq(webhooks.userId, userId));
  }
  
  async getWebhooksByStrategy(strategyId: number): Promise<Webhook[]> {
    return await db.select().from(webhooks).where(eq(webhooks.strategyId, strategyId));
  }
  
  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const now = new Date();
    const [newWebhook] = await db.insert(webhooks).values({
      ...webhook,
      createdAt: now,
      updatedAt: now,
      lastCalledAt: null
    }).returning();
    return newWebhook;
  }
  
  async updateWebhook(id: number, webhookData: Partial<Webhook>): Promise<Webhook | undefined> {
    const now = new Date();
    const [updatedWebhook] = await db.update(webhooks)
      .set({
        ...webhookData,
        updatedAt: now
      })
      .where(eq(webhooks.id, id))
      .returning();
    return updatedWebhook;
  }
  
  async deleteWebhook(id: number): Promise<boolean> {
    const result = await db.delete(webhooks).where(eq(webhooks.id, id));
    return result.count > 0;
  }
  
  async logWebhookCall(id: number, payload: Record<string, any>, action: string, result: 'success' | 'error', message?: string): Promise<Webhook | undefined> {
    // Get the current webhook
    const webhook = await this.getWebhook(id);
    if (!webhook) return undefined;
    
    // Create a new call log entry with a unique ID
    const logEntry = {
      id: Date.now(), // Use timestamp as a simple unique ID
      webhookId: id,
      timestamp: new Date().toISOString(),
      payload,
      action,
      status: result,
      message: message || (result === 'success' ? 'Webhook call successful' : 'Webhook call failed')
    };
    
    // Get current logs or initialize empty array
    const currentLogs = webhook.logs || [];
    
    // Add new log entry to the beginning of the logs array
    // Keep only the 20 most recent logs
    const updatedLogs = [logEntry, ...currentLogs.slice(0, 19)];
    
    // Increment the call count
    const callCount = (webhook.callCount || 0) + 1;
    
    // Update the webhook with the new logs and update the call count
    return this.updateWebhook(id, {
      logs: updatedLogs,
      callCount,
      lastCalledAt: new Date()
    });
  }

  // Screener methods
  async getScreener(id: number): Promise<Screener | undefined> {
    const result = await db.select().from(screeners).where(eq(screeners.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  // Alias for compatibility with the new screener interface
  async getScreenById(id: number): Promise<Screener | undefined> {
    return this.getScreener(id);
  }

  async getScreenersByUser(userId: number): Promise<Screener[]> {
    return await db.select().from(screeners).where(eq(screeners.userId, userId));
  }
  
  // Method to get all screeners (with optional userId filter)
  // This implements the getScreens method in the interface
  async getScreens(userId?: number): Promise<Screener[]> {
    if (userId) {
      return this.getScreenersByUser(userId);
    } else {
      return await db.select().from(screeners);
    }
  }

  async createScreener(screener: InsertScreener): Promise<Screener> {
    const now = new Date();
    const [newScreener] = await db.insert(screeners).values({
      ...screener,
      results: {},
      createdAt: now,
      updatedAt: now,
      lastRunAt: null
    }).returning();
    return newScreener;
  }
  
  // Alias for compatibility with the new screener interface
  async createScreen(screener: InsertScreener): Promise<Screener> {
    return this.createScreener(screener);
  }

  async updateScreener(id: number, screenerData: Partial<Screener>): Promise<Screener | undefined> {
    const now = new Date();
    const [updatedScreener] = await db.update(screeners)
      .set({
        ...screenerData,
        updatedAt: now
      })
      .where(eq(screeners.id, id))
      .returning();
    return updatedScreener;
  }
  
  // Alias for compatibility with the new screener interface
  async updateScreen(id: number, screenerData: Partial<Screener>): Promise<Screener | undefined> {
    return this.updateScreener(id, screenerData);
  }

  async deleteScreener(id: number): Promise<boolean> {
    const result = await db.delete(screeners).where(eq(screeners.id, id));
    return result.count > 0;
  }
  
  // Alias for compatibility with the new screener interface
  async deleteScreen(id: number): Promise<boolean> {
    return this.deleteScreener(id);
  }

  async runScreener(id: number): Promise<Screener | undefined> {
    try {
      // Get the screener
      const screener = await this.getScreener(id);
      if (!screener) {
        return undefined;
      }
      
      // Import the Python execution service dynamically
      const { executeScreener } = await import('./pythonExecutionService');
      
      // Execute the screener
      const result = await executeScreener(screener);
      
      // Update the screener with the results
      const now = new Date();
      if (result && result.success) {
        // Format the results
        const screenResults = {
          matches: result.matches || [],
          lastRun: now.toISOString(),
          executionTime: result.execution_time || 0,
          details: result.details || {}
        };
        
        // Update in database
        const [updatedScreener] = await db.update(screeners)
          .set({
            results: screenResults,
            lastRunAt: now,
            updatedAt: now
          })
          .where(eq(screeners.id, id))
          .returning();
        
        return updatedScreener;
      } else {
        // Format error results
        const errorResults = {
          matches: [],
          lastRun: now.toISOString(),
          executionTime: 0,
          error: result?.error || 'Unknown error during execution'
        };
        
        // Update in database with error
        const [updatedScreener] = await db.update(screeners)
          .set({
            results: errorResults,
            lastRunAt: now,
            updatedAt: now
          })
          .where(eq(screeners.id, id))
          .returning();
        
        return updatedScreener;
      }
    } catch (error) {
      console.error(`Error running screener ${id}:`, error);
      
      // In case of error, update the screener with the error message
      const now = new Date();
      const screener = await this.getScreener(id);
      
      if (!screener) return undefined;
      
      const [updatedScreener] = await db.update(screeners)
        .set({
          results: {
            ...screener.results,
            error: error instanceof Error ? error.message : String(error),
            lastRun: now.toISOString()
          },
          lastRunAt: now,
          updatedAt: now
        })
        .where(eq(screeners.id, id))
        .returning();
      
      return updatedScreener;
    }
  }
  
  // Alias for compatibility with the new screener interface
  async updateScreenLastRun(id: number, results?: any): Promise<Screener | undefined> {
    const now = new Date();
    if (results) {
      // We have results to update
      const [updatedScreener] = await db.update(screeners)
        .set({
          results,
          lastRunAt: now,
          updatedAt: now
        })
        .where(eq(screeners.id, id))
        .returning();
      return updatedScreener;
    } else {
      // Just update the last run timestamp
      const [updatedScreener] = await db.update(screeners)
        .set({
          lastRunAt: now,
          updatedAt: now
        })
        .where(eq(screeners.id, id))
        .returning();
      return updatedScreener;
    }
  }
  
  // New function for the screener service to update results
  async updateScreenResults(id: number, results: any): Promise<Screener | undefined> {
    const now = new Date();
    try {
      const [updatedScreener] = await db.update(screeners)
        .set({
          results,
          lastRunAt: now,
          updatedAt: now
        })
        .where(eq(screeners.id, id))
        .returning();
      return updatedScreener;
    } catch (error) {
      console.error(`Error updating screen results for ID ${id}:`, error);
      return undefined;
    }
  }

