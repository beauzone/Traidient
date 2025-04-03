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
  watchlists,
  WatchlistItem,
  Watchlist,
  InsertWatchlistItem,
  InsertWatchlist,
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
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

export interface IStorage {
  // Session Management
  sessionStore: session.SessionStore;
  
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByReplitId(replitId: number): Promise<User | undefined>; // Get user by Replit ID for OpenID auth
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;

  // API Integrations
  getApiIntegration(id: number): Promise<ApiIntegration | undefined>;
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
  
  // Multiple Watchlists
  getWatchlist(id: number): Promise<Watchlist | undefined>;
  getWatchlistsByUser(userId: number): Promise<Watchlist[]>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  updateWatchlist(id: number, watchlist: Partial<Watchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: number): Promise<boolean>;
  getWatchlistItemsByWatchlistId(watchlistId: number): Promise<WatchlistItem[]>;
  
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
  // Session Store
  sessionStore: session.SessionStore;
  
  constructor() {
    // Initialize PostgreSQL session store
    const PostgresStore = connectPgSimple(session);
    this.sessionStore = new PostgresStore({
      conString: process.env.DATABASE_URL,
      schemaName: 'public', // Using the default schema
      tableName: 'sessions', // You can customize this table name
      createTableIfMissing: true,
    });
  }

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
  
  async getUserByReplitId(replitId: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.replitId, replitId));
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

  // API Integration methods
  async getApiIntegration(id: number): Promise<ApiIntegration | undefined> {
    const result = await db.select().from(apiIntegrations).where(eq(apiIntegrations.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getApiIntegrationsByUser(userId: number): Promise<ApiIntegration[]> {
    return await db.select().from(apiIntegrations).where(eq(apiIntegrations.userId, userId));
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
    // Find the default watchlist first
    const defaultWatchlists = await db
      .select()
      .from(watchlists)
      .where(and(
        eq(watchlists.userId, userId),
        eq(watchlists.isDefault, true)
      ));
    
    // If we have a default watchlist, get its items
    if (defaultWatchlists.length > 0) {
      return await db
        .select()
        .from(watchlist)
        .where(and(
          eq(watchlist.userId, userId),
          eq(watchlist.watchlistId, defaultWatchlists[0].id)
        ));
    }
    
    // If no default watchlist exists, try to get the first watchlist for this user
    const userWatchlists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(watchlists.displayOrder);
    
    if (userWatchlists.length > 0) {
      // Get items from the first watchlist
      return await db
        .select()
        .from(watchlist)
        .where(and(
          eq(watchlist.userId, userId),
          eq(watchlist.watchlistId, userWatchlists[0].id)
        ));
    }
    
    // If no watchlists at all, create a default one
    const [newWatchlist] = await db
      .insert(watchlists)
      .values({
        name: 'My Watchlist',
        userId,
        isDefault: true,
        displayOrder: 0
      })
      .returning();
    
    // Return empty array since the new watchlist has no items yet
    return [];
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    // If watchlistId is not provided, find or create a default watchlist
    if (!item.watchlistId) {
      // Find the default watchlist first
      const defaultWatchlists = await db
        .select()
        .from(watchlists)
        .where(and(
          eq(watchlists.userId, item.userId),
          eq(watchlists.isDefault, true)
        ));
      
      let watchlistId: number;
      
      // If we have a default watchlist, use it
      if (defaultWatchlists.length > 0) {
        watchlistId = defaultWatchlists[0].id;
      } else {
        // Otherwise, create a new default watchlist
        const [newWatchlist] = await db.insert(watchlists).values({
          userId: item.userId,
          name: 'My Watchlist',
          isDefault: true,
          displayOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        
        watchlistId = newWatchlist.id;
      }
      
      // Add the watchlistId to the item
      item = { ...item, watchlistId };
    }
    
    // Check if this symbol already exists in the watchlist to avoid duplicates
    const existingItems = await db
      .select()
      .from(watchlist)
      .where(and(
        eq(watchlist.watchlistId, item.watchlistId),
        eq(watchlist.symbol, item.symbol)
      ));
    
    // If the item already exists, just return it
    if (existingItems.length > 0) {
      return existingItems[0];
    }
    
    // Get highest display order to place item at the end
    const existingWatchlistItems = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.watchlistId, item.watchlistId));
    
    const highestOrder = existingWatchlistItems.length > 0
      ? Math.max(...existingWatchlistItems.map(i => i.displayOrder || 0))
      : -1;
    
    // Set display order if not already set
    if (item.displayOrder === undefined) {
      item = { ...item, displayOrder: highestOrder + 1 };
    }
    
    const [newItem] = await db.insert(watchlist).values({
      ...item,
      createdAt: new Date()
    }).returning();
    
    return newItem;
  }

  async removeFromWatchlist(id: number): Promise<boolean> {
    // First get the item to check that it exists
    const items = await db.select().from(watchlist).where(eq(watchlist.id, id));
    if (items.length === 0) {
      return false;
    }
    
    // Delete the watchlist item
    const result = await db.delete(watchlist).where(eq(watchlist.id, id));
    return result.count > 0;
  }
  
  // Multiple Watchlists methods
  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    const result = await db.select().from(watchlists).where(eq(watchlists.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getWatchlistsByUser(userId: number): Promise<Watchlist[]> {
    return await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.displayOrder));
  }
  
  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const now = new Date();
    
    // If this is the first watchlist or marked as default
    if (watchlist.isDefault) {
      // Set all other watchlists for this user to non-default
      await db.update(watchlists)
        .set({ isDefault: false })
        .where(and(
          eq(watchlists.userId, watchlist.userId),
          eq(watchlists.isDefault, true)
        ));
    }
    
    // Insert the new watchlist
    const [newWatchlist] = await db.insert(watchlists).values({
      ...watchlist,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return newWatchlist;
  }
  
  async updateWatchlist(id: number, watchlistData: Partial<Watchlist>): Promise<Watchlist | undefined> {
    const now = new Date();
    
    // If updating to make this default
    if (watchlistData.isDefault) {
      // Get the watchlist first to check the user ID
      const currentWatchlist = await this.getWatchlist(id);
      if (currentWatchlist) {
        // Set all other watchlists for this user to non-default
        await db.update(watchlists)
          .set({ isDefault: false })
          .where(and(
            eq(watchlists.userId, currentWatchlist.userId),
            eq(watchlists.isDefault, true),
            eq(watchlists.id, id).not() // Don't update the current one
          ));
      }
    }
    
    // Update the watchlist
    const [updatedWatchlist] = await db.update(watchlists)
      .set({
        ...watchlistData,
        updatedAt: now
      })
      .where(eq(watchlists.id, id))
      .returning();
    
    return updatedWatchlist;
  }
  
  async deleteWatchlist(id: number): Promise<boolean> {
    // First, get the watchlist to be deleted
    const watchlistToDelete = await this.getWatchlist(id);
    if (!watchlistToDelete) {
      return false;
    }
    
    // Delete all watchlist items associated with this watchlist
    await db.delete(watchlist).where(eq(watchlist.watchlistId, id));
    
    // Delete the watchlist itself
    const result = await db.delete(watchlists).where(eq(watchlists.id, id));
    
    // If this was the default watchlist, set another one as default if available
    if (watchlistToDelete.isDefault) {
      const remainingWatchlists = await this.getWatchlistsByUser(watchlistToDelete.userId);
      if (remainingWatchlists.length > 0) {
        await this.updateWatchlist(remainingWatchlists[0].id, { isDefault: true });
      }
    }
    
    return result.count > 0;
  }
  
  async getWatchlistItemsByWatchlistId(watchlistId: number): Promise<WatchlistItem[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.watchlistId, watchlistId));
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

  async getScreenersByUser(userId: number): Promise<Screener[]> {
    return await db.select().from(screeners).where(eq(screeners.userId, userId));
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

  async deleteScreener(id: number): Promise<boolean> {
    const result = await db.delete(screeners).where(eq(screeners.id, id));
    return result.count > 0;
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

  // Bot Instance methods
  async getBotInstance(id: number): Promise<BotInstance | undefined> {
    const result = await db.select().from(botInstances).where(eq(botInstances.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getBotInstancesByUser(userId: number): Promise<BotInstance[]> {
    return await db.select().from(botInstances).where(eq(botInstances.userId, userId));
  }

  async getBotInstancesByStrategy(strategyId: number): Promise<BotInstance[]> {
    return await db.select().from(botInstances).where(eq(botInstances.strategyId, strategyId));
  }

  async createBotInstance(botInstance: InsertBotInstance): Promise<BotInstance> {
    const now = new Date();
    const [newBotInstance] = await db.insert(botInstances).values({
      ...botInstance,
      status: botInstance.status || 'stopped',
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      lastErrorAt: null,
      lastError: null,
      metrics: botInstance.metrics || {},
      settings: botInstance.settings || {},
      schedule: botInstance.schedule || {}
    }).returning();
    return newBotInstance;
  }

  async updateBotInstance(id: number, botInstanceData: Partial<BotInstance>): Promise<BotInstance | undefined> {
    const now = new Date();
    const [updatedBotInstance] = await db.update(botInstances)
      .set({
        ...botInstanceData,
        updatedAt: now
      })
      .where(eq(botInstances.id, id))
      .returning();
    return updatedBotInstance;
  }

  async deleteBotInstance(id: number): Promise<boolean> {
    // First, delete any trades associated with the bot instance
    await db.delete(botTrades).where(eq(botTrades.botInstanceId, id));
    
    // Then delete the bot instance itself
    const result = await db.delete(botInstances).where(eq(botInstances.id, id));
    return result.count > 0;
  }

  // Bot Trade methods
  async getBotTrade(id: number): Promise<BotTrade | undefined> {
    const result = await db.select().from(botTrades).where(eq(botTrades.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getBotTradesByInstance(botInstanceId: number): Promise<BotTrade[]> {
    return await db.select().from(botTrades).where(eq(botTrades.botInstanceId, botInstanceId));
  }

  async getBotTradesByUser(userId: number): Promise<BotTrade[]> {
    // Join bot_trades and bot_instances to filter by userId
    const result = await db
      .select({
        trade: botTrades
      })
      .from(botTrades)
      .innerJoin(botInstances, eq(botTrades.botInstanceId, botInstances.id))
      .where(eq(botInstances.userId, userId));
    
    return result.map(r => r.trade);
  }

  async createBotTrade(trade: InsertBotTrade): Promise<BotTrade> {
    const now = new Date();
    const [newTrade] = await db.insert(botTrades).values({
      ...trade,
      createdAt: now,
      updatedAt: now,
      exitedAt: trade.exitedAt || null,
      metrics: trade.metrics || {},
      tags: trade.tags || []
    }).returning();
    return newTrade;
  }

  async updateBotTrade(id: number, tradeData: Partial<BotTrade>): Promise<BotTrade | undefined> {
    const now = new Date();
    const [updatedTrade] = await db.update(botTrades)
      .set({
        ...tradeData,
        updatedAt: now
      })
      .where(eq(botTrades.id, id))
      .returning();
    return updatedTrade;
  }

  async deleteBotTrade(id: number): Promise<boolean> {
    const result = await db.delete(botTrades).where(eq(botTrades.id, id));
    return result.count > 0;
  }

  // Market Conditions & Insights
  async getLatestMarketCondition(): Promise<MarketCondition | undefined> {
    const result = await db
      .select()
      .from(marketConditions)
      .orderBy(desc(marketConditions.timestamp))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async createMarketCondition(condition: Partial<MarketCondition>): Promise<MarketCondition> {
    const [newCondition] = await db.insert(marketConditions).values({
      ...condition,
      timestamp: condition.timestamp || new Date()
    }).returning();
    return newCondition;
  }

  async getLatestSymbolInsight(symbol: string): Promise<SymbolInsight | undefined> {
    const result = await db
      .select()
      .from(symbolInsights)
      .where(eq(symbolInsights.symbol, symbol))
      .orderBy(desc(symbolInsights.timestamp))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async createSymbolInsight(insight: Partial<SymbolInsight>): Promise<SymbolInsight> {
    const [newInsight] = await db.insert(symbolInsights).values({
      ...insight,
      timestamp: insight.timestamp || new Date()
    }).returning();
    return newInsight;
  }
}

export const storage = new DatabaseStorage();
