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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private apiIntegrations: Map<number, ApiIntegration>;
  private strategies: Map<number, Strategy>;
  private backtests: Map<number, Backtest>;
  private deployments: Map<number, Deployment>;
  private watchlistItems: Map<number, WatchlistItem>;
  
  private userIdCounter: number = 1;
  private apiIntegrationIdCounter: number = 1;
  private strategyIdCounter: number = 1;
  private backtestIdCounter: number = 1;
  private deploymentIdCounter: number = 1;
  private watchlistIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.apiIntegrations = new Map();
    this.strategies = new Map();
    this.backtests = new Map();
    this.deployments = new Map();
    this.watchlistItems = new Map();
    
    // Add some initial data
    this.initializeData();
  }

  private initializeData() {
    // This will be called when the storage is first created
    // to populate with some initial demo data
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: now,
      subscription: {
        tier: 'free',
        status: 'active',
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      settings: {
        theme: 'dark',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        defaultExchange: 'alpaca',
        defaultAssets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN']
      }
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // API Integration methods
  async getApiIntegration(id: number): Promise<ApiIntegration | undefined> {
    return this.apiIntegrations.get(id);
  }

  async getApiIntegrationsByUser(userId: number): Promise<ApiIntegration[]> {
    return Array.from(this.apiIntegrations.values()).filter(
      (integration) => integration.userId === userId
    );
  }

  async getApiIntegrationByProviderAndUser(userId: number, provider: string): Promise<ApiIntegration | undefined> {
    return Array.from(this.apiIntegrations.values()).find(
      (integration) => integration.userId === userId && integration.provider === provider
    );
  }

  async createApiIntegration(integration: InsertApiIntegration): Promise<ApiIntegration> {
    const id = this.apiIntegrationIdCounter++;
    const now = new Date();
    const newIntegration: ApiIntegration = {
      ...integration,
      id,
      lastUsed: now,
      lastStatus: 'ok'
    };
    this.apiIntegrations.set(id, newIntegration);
    return newIntegration;
  }

  async updateApiIntegration(id: number, integrationData: Partial<ApiIntegration>): Promise<ApiIntegration | undefined> {
    const integration = this.apiIntegrations.get(id);
    if (!integration) return undefined;

    const updatedIntegration = { ...integration, ...integrationData };
    this.apiIntegrations.set(id, updatedIntegration);
    return updatedIntegration;
  }

  async deleteApiIntegration(id: number): Promise<boolean> {
    return this.apiIntegrations.delete(id);
  }

  // Strategy methods
  async getStrategy(id: number): Promise<Strategy | undefined> {
    return this.strategies.get(id);
  }

  async getStrategiesByUser(userId: number): Promise<Strategy[]> {
    return Array.from(this.strategies.values()).filter(
      (strategy) => strategy.userId === userId
    );
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const id = this.strategyIdCounter++;
    const now = new Date();
    const newStrategy: Strategy = {
      ...strategy,
      id,
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
    };
    this.strategies.set(id, newStrategy);
    return newStrategy;
  }

  async updateStrategy(id: number, strategyData: Partial<Strategy>): Promise<Strategy | undefined> {
    const strategy = this.strategies.get(id);
    if (!strategy) return undefined;

    const now = new Date();
    const updatedStrategy = { 
      ...strategy, 
      ...strategyData,
      updatedAt: now
    };
    
    this.strategies.set(id, updatedStrategy);
    return updatedStrategy;
  }

  async deleteStrategy(id: number): Promise<boolean> {
    return this.strategies.delete(id);
  }

  // Backtest methods
  async getBacktest(id: number): Promise<Backtest | undefined> {
    return this.backtests.get(id);
  }

  async getBacktestsByStrategy(strategyId: number): Promise<Backtest[]> {
    return Array.from(this.backtests.values()).filter(
      (backtest) => backtest.strategyId === strategyId
    );
  }

  async getBacktestsByUser(userId: number): Promise<Backtest[]> {
    return Array.from(this.backtests.values()).filter(
      (backtest) => backtest.userId === userId
    );
  }

  async createBacktest(backtest: InsertBacktest): Promise<Backtest> {
    const id = this.backtestIdCounter++;
    const now = new Date();
    const newBacktest: Backtest = {
      ...backtest,
      id,
      status: 'queued',
      results: {},
      createdAt: now
    };
    this.backtests.set(id, newBacktest);
    return newBacktest;
  }

  async updateBacktest(id: number, backtestData: Partial<Backtest>): Promise<Backtest | undefined> {
    const backtest = this.backtests.get(id);
    if (!backtest) return undefined;

    const updatedBacktest = { ...backtest, ...backtestData };
    this.backtests.set(id, updatedBacktest);
    return updatedBacktest;
  }

  async deleteBacktest(id: number): Promise<boolean> {
    return this.backtests.delete(id);
  }

  // Deployment methods
  async getDeployment(id: number): Promise<Deployment | undefined> {
    return this.deployments.get(id);
  }

  async getDeploymentsByUser(userId: number): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).filter(
      (deployment) => deployment.userId === userId
    );
  }

  async getDeploymentsByStrategy(strategyId: number): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).filter(
      (deployment) => deployment.strategyId === strategyId
    );
  }

  async createDeployment(deployment: InsertDeployment): Promise<Deployment> {
    const id = this.deploymentIdCounter++;
    const now = new Date();
    const newDeployment: Deployment = {
      ...deployment,
      id,
      status: 'starting',
      runtime: {},
      performance: {},
      createdAt: now,
      updatedAt: now
    };
    this.deployments.set(id, newDeployment);
    return newDeployment;
  }

  async updateDeployment(id: number, deploymentData: Partial<Deployment>): Promise<Deployment | undefined> {
    const deployment = this.deployments.get(id);
    if (!deployment) return undefined;

    const now = new Date();
    const updatedDeployment = { 
      ...deployment, 
      ...deploymentData,
      updatedAt: now
    };
    this.deployments.set(id, updatedDeployment);
    return updatedDeployment;
  }

  async deleteDeployment(id: number): Promise<boolean> {
    return this.deployments.delete(id);
  }

  // Watchlist methods
  async getWatchlistItems(userId: number): Promise<WatchlistItem[]> {
    return Array.from(this.watchlistItems.values()).filter(
      (item) => item.userId === userId
    );
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = this.watchlistIdCounter++;
    const now = new Date();
    const newItem: WatchlistItem = {
      ...item,
      id,
      createdAt: now
    };
    this.watchlistItems.set(id, newItem);
    return newItem;
  }

  async removeFromWatchlist(id: number): Promise<boolean> {
    return this.watchlistItems.delete(id);
  }
}

export const storage = new MemStorage();
