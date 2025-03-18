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
  InsertWatchlistItem
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
}

import { db } from './db';
import { eq, and } from 'drizzle-orm';

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

  // API Integration methods
  async getApiIntegration(id: number): Promise<ApiIntegration | undefined> {
    const result = await db.select().from(apiIntegrations).where(eq(apiIntegrations.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getApiIntegrationsByUser(userId: number): Promise<ApiIntegration[]> {
    return await db.select().from(apiIntegrations).where(eq(apiIntegrations.userId, userId));
  }

  async getApiIntegrationByProviderAndUser(userId: number, provider: string): Promise<ApiIntegration | undefined> {
    const result = await db.select().from(apiIntegrations)
      .where(and(
        eq(apiIntegrations.userId, userId),
        eq(apiIntegrations.provider, provider)
      ));
    return result.length > 0 ? result[0] : undefined;
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
}

export const storage = new DatabaseStorage();
