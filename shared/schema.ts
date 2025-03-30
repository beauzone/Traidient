import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real, varchar, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  subscription: jsonb("subscription").$type<{
    tier: 'free' | 'standard' | 'professional';
    status: 'active' | 'inactive' | 'trial';
    expiresAt: string;
  }>().notNull().default({
    tier: 'free',
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }),
  settings: jsonb("settings").$type<{
    theme: 'dark' | 'light';
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    phoneNumber?: string;
    phoneVerification?: {
      verified: boolean;
      verifiedAt?: string;
      code?: string;
      expiresAt?: string;
    };
    defaultExchange: string;
    defaultAssets: string[];
    backtestDataProvider: 'alpaca' | 'yahoo' | 'polygon';
  }>().notNull().default({
    theme: 'dark',
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    phoneNumber: '',
    defaultExchange: 'alpaca',
    defaultAssets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'],
    backtestDataProvider: 'yahoo'
  }),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
});

// API Integrations
export const apiIntegrations = pgTable("api_integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // 'alpaca', 'polygon', 'openai', 'binance', 'coinbase', 'interactive_brokers', 'snaptrade', etc.
  type: text("type").notNull(), // 'exchange', 'data', 'ai', 'brokerage'
  
  // Enhanced multi-asset classes support
  assetClasses: jsonb("asset_classes").$type<string[]>().default(['stocks']), // 'stocks', 'options', 'futures', 'forex', 'crypto', 'etf', etc.
  
  // Enhanced multi-exchange support
  exchanges: jsonb("exchanges").$type<string[]>().default(['NASDAQ']), // 'NASDAQ', 'NYSE', 'BINANCE', 'COINBASE', etc.
  asset_classes: jsonb("asset_classes").$type<string[]>().default(['stocks']), // 'stocks', 'options', 'futures', 'forex', 'crypto', etc.
  
  // Enhanced account information
  accountMode: text("account_mode").default('paper'), // 'paper', 'live'
  accountName: text("account_name"), // User-defined name for the account
  description: text("description"), // User-friendly name for the integration
  
  // External provider identifiers - for services like SnapTrade that have their own user IDs
  providerUserId: text("provider_user_id"), // ID of the user in the provider's system
  providerAccountId: text("provider_account_id"), // ID of the account in the provider's system
  
  // Enhanced credentials
  credentials: jsonb("credentials").$type<{
    apiKey: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    accountId?: string;
    userSecret?: string; // For SnapTrade
    additionalFields?: Record<string, string>;
  }>().notNull(),
  
  // Enhanced capabilities
  capabilities: jsonb("capabilities").$type<{
    trading: boolean;           // Can execute trades
    marketData: boolean;        // Can retrieve market data
    accountData: boolean;       // Can retrieve account info
    supportedRegions?: string[]; // US, EU, APAC, Global
    paperTrading?: boolean;     // Supports paper trading
    liveTrading?: boolean;      // Supports live trading
    supportsOptions?: boolean;  // Supports options trading
    supportsFutures?: boolean;  // Supports futures trading
    supportsForex?: boolean;    // Supports forex trading
    supportsCrypto?: boolean;   // Supports crypto trading
    marginTrading?: boolean;    // Supports margin trading
    shortSelling?: boolean;     // Supports short selling
    fractionalShares?: boolean; // Supports fractional shares
    extendedHours?: boolean;    // Supports extended hours trading
    advancedOrderTypes?: string[]; // Supported advanced order types
  }>().notNull().default({
    trading: true,
    marketData: true,
    accountData: true,
    paperTrading: true,
    liveTrading: true,
    supportsOptions: false,
    supportsFutures: false, 
    supportsForex: false,
    supportsCrypto: false
  }),
  
  isActive: boolean("is_active").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false),
  lastUsed: timestamp("last_used"),
  lastStatus: text("last_status").default('ok'),
  lastError: text("last_error"),
});

export const insertApiIntegrationSchema = createInsertSchema(apiIntegrations).pick({
  userId: true,
  provider: true,
  type: true,
  assetClasses: true,
  exchanges: true,
  accountMode: true,
  accountName: true,
  description: true,
  providerUserId: true,
  providerAccountId: true,
  credentials: true,
  capabilities: true,
  isActive: true,
  isPrimary: true,
  lastStatus: true,
  lastUsed: true,
  lastError: true,
});

// Strategies
export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'ai-generated', 'template', 'custom', 'tradingview'
  status: text("status").notNull().default('draft'), // 'draft', 'active', 'inactive', 'error'
  source: jsonb("source").$type<{
    type: 'natural-language' | 'visual-builder' | 'code' | 'tradingview-webhook';
    content: string;
  }>().notNull(),
  configuration: jsonb("configuration").$type<{
    assets: string[];
    parameters: Record<string, any>;
    riskControls: {
      maxPositionSize: number;
      stopLoss: number;
      takeProfit: number;
    };
    schedule: {
      isActive: boolean;
      timezone: string;
      activeDays: number[]; // 0-6 for days of week
      activeHours: {
        start: string; // HH:MM
        end: string; // HH:MM
      };
    };
  }>().notNull(),
  versions: jsonb("versions").$type<{
    version: number;
    timestamp: string;
    changes: string;
    configuration: any;
  }[]>().notNull().default([]),
  performance: jsonb("performance").$type<{
    lastBacktest?: number;
    liveStats?: {
      startDate: string;
      trades: number;
      winRate: number;
      profitLoss: number;
    };
  }>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStrategySchema = createInsertSchema(strategies).pick({
  userId: true,
  name: true,
  description: true,
  type: true,
  source: true,
  configuration: true,
});

// Backtests
export const backtests = pgTable("backtests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  name: text("name"), // Adding name field for backtest
  status: text("status").notNull().default('queued'), // 'queued', 'running', 'completed', 'failed', 'cancelled'
  progress: jsonb("progress").$type<{
    percentComplete: number;
    currentStep: string;
    stepsCompleted: number;
    totalSteps: number;
    estimatedTimeRemaining: number; // in seconds
    startedAt: string;
    processingSpeed: number; // data points per second
  }>().default({
    percentComplete: 0,
    currentStep: 'Initializing',
    stepsCompleted: 0,
    totalSteps: 100,
    estimatedTimeRemaining: 0,
    startedAt: '',
    processingSpeed: 0
  }),
  configuration: jsonb("configuration").$type<{
    startDate: string;
    endDate: string;
    initialCapital: number;
    assets: string[];
    parameters: Record<string, any>;
    dataProvider?: 'alpaca' | 'yahoo' | 'polygon';
  }>().notNull(),
  results: jsonb("results").$type<{
    summary?: {
      totalReturn: number;
      annualizedReturn: number;
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
      totalTrades: number;
    };
    trades?: {
      timestamp: string;
      type: 'buy' | 'sell';
      asset: string;
      quantity: number;
      price: number;
      value: number;
      fees: number;
    }[];
    equity?: {
      timestamp: string;
      value: number;
    }[];
    positions?: {
      timestamp: string;
      asset: string;
      quantity: number;
      value: number;
    }[];
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
});

export const insertBacktestSchema = createInsertSchema(backtests).pick({
  userId: true,
  strategyId: true,
  name: true,
  configuration: true,
});

// Deployments (Live Trading)
export const deployments = pgTable("deployments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  status: text("status").notNull().default('starting'), // 'starting', 'running', 'paused', 'stopped', 'error'
  environment: text("environment").notNull().default('paper'), // 'paper', 'live'
  exchange: text("exchange").notNull(),
  configuration: jsonb("configuration").$type<{
    capital: number;
    startDate: string;
    parameters: Record<string, any>;
  }>().notNull(),
  runtime: jsonb("runtime").$type<{
    lastHeartbeat?: string;
    uptime?: number;
    errors?: {
      timestamp: string;
      message: string;
      stackTrace: string;
    }[];
  }>().notNull().default({}),
  performance: jsonb("performance").$type<{
    currentValue?: number;
    profitLoss?: number;
    profitLossPercent?: number;
    trades?: number;
    winRate?: number;
  }>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeploymentSchema = createInsertSchema(deployments).pick({
  userId: true,
  strategyId: true,
  environment: true,
  exchange: true,
  configuration: true,
});

// Market Watchlist
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'stock', 'crypto', 'etf', etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).pick({
  userId: true,
  symbol: true,
  name: true,
  exchange: true,
  type: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ApiIntegration = typeof apiIntegrations.$inferSelect;
export type InsertApiIntegration = z.infer<typeof insertApiIntegrationSchema>;

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;

export type Backtest = typeof backtests.$inferSelect;
export type InsertBacktest = z.infer<typeof insertBacktestSchema>;

export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;

// Alert Threshold settings for users
export const alertThresholds = pgTable("alert_thresholds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'price', 'price_change_percent', 'volume', etc.
  enabled: boolean("enabled").notNull().default(true),
  
  // Conditions JSON blob
  conditions: jsonb("conditions").$type<{
    symbol?: string;
    strategyId?: number;
    deploymentId?: number;
    // For price alerts
    price?: number;
    priceDirection?: 'above' | 'below';
    // For percentage change alerts
    changePercent?: number;
    timeframe?: string; // '1d', '1h', etc.
    // For volume alerts
    volume?: number;
    // For P&L alerts
    profitLossAmount?: number;
    profitLossPercent?: number;
    // For technical indicator alerts 
    indicator?: {
      type: 'ma' | 'ema' | 'rsi' | 'macd' | 'bollinger';
      parameters: Record<string, any>;
      condition: string; // e.g., 'cross_above', 'cross_below', etc.
    };
    // For market event alerts
    eventType?: 'market_open' | 'market_close' | 'earnings' | 'economic_announcement';
    // Additional conditions
    filters?: Record<string, any>;
  }>().notNull(),
  
  // Notification settings
  notifications: jsonb("notifications").$type<{
    channels: string[]; // Array of channels: 'app', 'email', 'sms', 'push'
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    throttle?: {
      enabled: boolean;
      maxPerDay?: number;
      cooldownMinutes?: number;
    };
  }>().notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastTriggered: timestamp("last_triggered"),
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).pick({
  userId: true,
  name: true,
  type: true,
  enabled: true,
  conditions: true,
  notifications: true,
});

// Notifications history
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  thresholdId: integer("threshold_id").references(() => alertThresholds.id),
  
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'price', 'price_change_percent', etc.
  severity: varchar("severity", { length: 20 }).notNull(), // 'info', 'low', 'medium', 'high', 'critical'
  
  metadata: jsonb("metadata").$type<{
    symbol?: string;
    price?: number;
    changePercent?: number;
    volume?: number;
    strategyId?: number;
    deploymentId?: number;
    additionalInfo?: Record<string, any>;
  }>().notNull().default({}),
  
  deliveredChannels: jsonb("delivered_channels").$type<{
    channel: string;
    status: 'delivered' | 'failed';
    failureReason?: string;
    timestamp: string;
  }[]>().notNull().default([]),
  
  isRead: boolean("is_read").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  thresholdId: true,
  title: true,
  message: true,
  type: true,
  severity: true,
  metadata: true,
});

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;

export type AlertThreshold = typeof alertThresholds.$inferSelect;
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// SnapTrade Connections Info type
export interface SnapTradeConnectionInfo {
  id: string;
  brokerage: {
    id: string;
    name: string;
    logo?: string;
  };
  createdAt: string;
  status: string;
}

// TradingView Webhooks
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  strategyId: integer("strategy_id").references(() => strategies.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  token: varchar("token", { length: 64 }).notNull().unique(), // Unique token for webhook URL
  action: varchar("action", { length: 50 }).notNull(), // 'trade', 'cancel', 'status'
  isActive: boolean("is_active").notNull().default(true),
  callCount: integer("call_count").notNull().default(0),
  configuration: jsonb("configuration").$type<{
    integrationId?: number;
    securitySettings?: {
      useSignature: boolean;
      signatureSecret?: string;
      ipWhitelist?: string[];
    };
    allowShortSelling?: boolean;
    parameters?: Record<string, any>;
    positionSizing?: {
      type: 'fixed' | 'percentage' | 'risk-based';
      value: number; // shares, percentage, or risk amount
    };
  }>().notNull().default({
    securitySettings: {
      useSignature: false
    },
    allowShortSelling: false,
    parameters: {},
    positionSizing: {
      type: 'fixed',
      value: 100
    }
  }),
  logs: jsonb("logs").$type<{
    id: number;
    webhookId: number;
    timestamp: string;
    action: string;
    status: 'success' | 'error';
    message: string;
    payload?: Record<string, any>;
  }[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastCalledAt: timestamp("last_called_at"),
});

export const insertWebhookSchema = createInsertSchema(webhooks).pick({
  userId: true,
  strategyId: true,
  name: true,
  description: true,
  token: true,
  action: true,
  isActive: true,
  configuration: true,
});

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

// Stock Screeners
export const screeners = pgTable("screeners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'python', 'javascript', 'visual-builder', 'ai-generated'
  
  source: jsonb("source").$type<{
    type: 'code' | 'visual-builder' | 'natural-language';
    content: string; // Python/JavaScript code or visual builder config
    language: 'python' | 'javascript';
  }>().notNull(),
  
  configuration: jsonb("configuration").$type<{
    universe: string[]; // List of stocks to screen, or 'SP500', 'NASDAQ', etc.
    parameters: Record<string, any>; // Configurable parameters
    schedule?: {
      isActive: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
      runAt: string; // Time of day to run
      dayOfWeek?: number; // 0-6 for weekly
      dayOfMonth?: number; // 1-31 for monthly
    };
  }>().notNull(),
  
  results: jsonb("results").$type<{
    lastRun?: string;
    matchedSymbols?: string[];
    error?: string;
    metrics?: Record<string, any>[];
    performance?: {
      hitRate?: number;
      avgReturn?: number;
    };
  }>().notNull().default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastRunAt: timestamp("last_run_at"),
});

export const insertScreenerSchema = createInsertSchema(screeners).pick({
  userId: true,
  name: true,
  description: true,
  type: true,
  source: true,
  configuration: true,
});

export type Screener = typeof screeners.$inferSelect;
export type InsertScreener = z.infer<typeof insertScreenerSchema>;

// Bot Instances
export const botInstances = pgTable("bot_instances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  apiIntegrationId: integer("api_integration_id").notNull().references(() => apiIntegrations.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default('idle'), // 'idle', 'running', 'paused', 'error'
  type: varchar("type", { length: 20 }).notNull(), // 'strategy', 'webhook', 'ai-powered'
  
  // Multi-Exchange Trading Support
  exchange: varchar("exchange", { length: 50 }).notNull(),  // 'alpaca', 'binance', 'coinbase', 'interactive_brokers', etc.
  assetClass: varchar("asset_class", { length: 20 }).notNull().default('stocks'), // 'stocks', 'options', 'futures', 'forex', 'crypto', etc.
  
  // Trading Mode Configuration
  tradingMode: varchar("trading_mode", { length: 20 }).notNull().default('manual'), // 'manual', 'semi-auto', 'full-auto'
  symbols: jsonb("symbols").$type<string[]>().notNull().default([]),
  
  // Bot Configuration
  configuration: jsonb("configuration").$type<{
    capital: number;
    positionSizing: {
      type: 'fixed' | 'percentage' | 'risk-based' | 'volatility-based';
      value: number; // shares, percentage, risk amount, or volatility factor
      maxPositionSize?: number;
      maxPositionValue?: number;
    };
    entrySettings: {
      conditions: Record<string, any>;
      limitOrders?: boolean;
      limitPrice?: 'best_bid' | 'best_ask' | 'mid' | 'custom';
      customPriceOffset?: number;
    };
    exitSettings: {
      takeProfit?: number; // percentage or fixed amount
      stopLoss?: number; // percentage or fixed amount
      trailingStop?: boolean;
      trailingStopDistance?: number;
      timeBasedExit?: {
        enabled: boolean;
        maxHoldingPeriod?: number; // in hours
      };
    };
    riskManagement: {
      maxDrawdown?: number; // percentage
      maxDailyLoss?: number; // percentage or fixed amount
      maxPositionsCount?: number;
      maxSectorExposure?: number; // percentage
      correlationLimit?: number; // 0-1 value
    };
    hours: {
      enabled: boolean;
      timezone: string;
      schedule: {
        days: number[]; // 0-6 for days of week
        startTime: string; // HH:MM in 24h format
        endTime: string; // HH:MM in 24h format
      }[];
    };
    alerts: {
      performance?: boolean;
      errors?: boolean;
      trades?: boolean;
      statusChanges?: boolean;
    };
    // Enhanced multi-asset and multi-exchange settings
    assetSpecificSettings?: Record<string, {
      assetClass: string;
      exchange?: string;
      symbols?: string[];
      positionSizing?: {
        type: 'fixed' | 'percentage' | 'risk-based' | 'volatility-based';
        value: number;
      };
      takeProfit?: number;
      stopLoss?: number;
      trailingStop?: boolean;
      trailingStopDistance?: number;
    }>;
    // Auto-tagging system for trades
    autoTagging?: {
      enabled: boolean;
      rules: {
        name: string;
        tag: string;
        conditions: {
          field: string; // 'assetClass', 'exchange', 'symbol', 'tradingMode', 'timeOfDay', 'dayOfWeek', 'marketCondition'
          operator: string; // 'equals', 'contains', 'startsWith', 'endsWith', 'greaterThan', 'lessThan', 'in'
          value: any;
        }[];
      }[];
    };
  }>().notNull(),
  
  // Runtime data
  runtime: jsonb("runtime").$type<{
    lastHeartbeat?: string;
    startedAt?: string;
    pausedAt?: string;
    uptime?: number; // in seconds
    errors?: {
      timestamp: string;
      message: string;
      stackTrace?: string;
      resolved: boolean;
    }[];
    positions?: {
      symbol: string;
      quantity: number;
      entryPrice: number;
      currentPrice?: number;
      unrealizedPnl?: number;
      unrealizedPnlPercent?: number;
      entryTime: string;
      tags?: string[];
    }[];
    trades?: {
      id: string;
      symbol: string;
      side: 'buy' | 'sell';
      quantity: number;
      price: number;
      timestamp: string;
      fees?: number;
      pnl?: number;
      pnlPercent?: number;
      tags?: string[];
    }[];
  }>().notNull().default({}),
  
  // Performance metrics
  performance: jsonb("performance").$type<{
    startingCapital: number;
    currentValue?: number;
    profitLoss?: number;
    profitLossPercent?: number;
    totalTrades?: number;
    winningTrades?: number;
    losingTrades?: number;
    winRate?: number;
    averageWin?: number;
    averageLoss?: number;
    largestWin?: number;
    largestLoss?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    dailyReturns?: {
      date: string;
      return: number;
    }[];
  }>().notNull().default({
    startingCapital: 0
  }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at"),
});

export const insertBotInstanceSchema = createInsertSchema(botInstances).pick({
  userId: true,
  strategyId: true,
  apiIntegrationId: true,
  name: true,
  description: true,
  type: true,
  exchange: true,
  assetClass: true,
  tradingMode: true,
  symbols: true,
  configuration: true,
});

// Market Condition Analysis
export const marketConditions = pgTable("market_conditions", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Market assessment
  overallCondition: varchar("overall_condition", { length: 20 }).notNull(), // 'bullish', 'bearish', 'neutral', 'volatile'
  confidence: real("confidence").notNull(), // 0-1 value indicating confidence in assessment
  
  // Market indicators
  indicators: jsonb("indicators").$type<{
    vix?: number;
    marketBreadth?: {
      advanceDeclineRatio?: number;
      newHighsNewLows?: number;
      percentAboveSMA50?: number;
      percentAboveSMA200?: number;
    };
    sectorRotation?: {
      leadingSectors?: string[];
      laggingSectors?: string[];
    };
    technicalSummary?: {
      spy?: {
        rsi?: number;
        macdHistogram?: number;
        bollingerPosition?: number; // -1 to 1, where 0 is middle
      };
      qqq?: {
        rsi?: number;
        macdHistogram?: number;
        bollingerPosition?: number;
      };
    };
  }>().notNull().default({}),
  
  // Analysis
  insights: jsonb("insights").$type<{
    trend?: string;
    volatility?: string;
    tradingRecommendations?: string[];
    warnings?: string[];
    opportunities?: string[];
  }>().notNull().default({}),
  
  // AI assessment
  aiConfidenceScores: jsonb("ai_confidence_scores").$type<{
    bullish: number; // 0-1
    bearish: number; // 0-1
    neutral: number; // 0-1
    volatile: number; // 0-1
    summary: string;
  }>().notNull().default({
    bullish: 0,
    bearish: 0,
    neutral: 0.5,
    volatile: 0,
    summary: "Insufficient data"
  }),
});

// Symbol Insights (for AI-powered analysis)
export const symbolInsights = pgTable("symbol_insights", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Basic data
  price: real("price"),
  priceChange: real("price_change"),
  priceChangePercent: real("price_change_percent"),
  volume: real("volume"),
  
  // Technical indicators
  technicals: jsonb("technicals").$type<{
    rsi?: number;
    macd?: {
      macd?: number;
      signal?: number;
      histogram?: number;
    };
    bollingerBands?: {
      upper?: number;
      middle?: number;
      lower?: number;
      width?: number;
      percentB?: number;
    };
    movingAverages?: {
      sma20?: number;
      sma50?: number;
      sma200?: number;
      ema13?: number;
      ema26?: number;
    };
    supports?: number[];
    resistances?: number[];
    trendStrength?: number; // 0-1 value
  }>().notNull().default({}),
  
  // AI-generated insights
  insights: jsonb("insights").$type<{
    summary?: string;
    keyFactors?: string[];
    sentiment?: {
      overall: 'bullish' | 'bearish' | 'neutral';
      score: number; // -1 to 1
      shortTerm: 'bullish' | 'bearish' | 'neutral';
      mediumTerm: 'bullish' | 'bearish' | 'neutral';
      longTerm: 'bullish' | 'bearish' | 'neutral';
    };
    patterns?: {
      name: string;
      confidence: number;
      significance: string;
    }[];
    predictions?: {
      target?: number;
      timeframe?: string;
      confidence?: number;
      rationale?: string;
    };
  }>().notNull().default({}),
  
  // AI confidence signals
  confidenceSignals: jsonb("confidence_signals").$type<{
    signals: {
      name: string;
      score: number; // 0-1
      direction: 'buy' | 'sell' | 'hold';
      timeframe: 'short' | 'medium' | 'long';
      category: 'technical' | 'fundamental' | 'sentiment' | 'market';
    }[];
    aggregatedScore: number; // 0-1
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  }>().notNull().default({
    signals: [],
    aggregatedScore: 0.5,
    recommendation: 'hold'
  }),
  
  // Trade signals
  signals: jsonb("signals").$type<{
    entry?: {
      signal: 'buy' | 'sell';
      strength: number; // 0-1
      reasons: string[];
    };
    exit?: {
      signal: 'take_profit' | 'stop_loss' | 'trailing_stop' | 'time_based';
      strength: number; // 0-1
      reasons: string[];
    };
  }>().notNull().default({}),
});

// Bot Trading Activity
export const botTrades = pgTable("bot_trades", {
  id: serial("id").primaryKey(),
  botInstanceId: integer("bot_instance_id").notNull().references(() => botInstances.id),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  
  // Exchange and Asset information
  exchange: varchar("exchange", { length: 50 }).notNull(),  // 'alpaca', 'binance', etc.
  assetClass: varchar("asset_class", { length: 20 }).notNull().default('stocks'), // 'stocks', 'options', 'futures', 'forex', 'crypto', etc.
  assetType: varchar("asset_type", { length: 20 }), // For crypto: 'spot', 'perpetual', 'futures'; For stocks: 'common', 'preferred', 'etf', etc.
  
  // Trade details
  type: varchar("type", { length: 10 }).notNull(), // 'buy', 'sell'
  executionType: varchar("execution_type", { length: 20 }).notNull(), // 'market', 'limit', 'stop', 'stop_limit'
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  amount: real("amount").notNull(), // price * quantity
  fees: real("fees"),
  
  // Trade context
  tradingMode: varchar("trading_mode", { length: 20 }).notNull(), // 'manual', 'semi-auto', 'full-auto'
  strategy: varchar("strategy", { length: 100 }).notNull(),
  strategyVersion: varchar("strategy_version", { length: 20 }),
  signals: jsonb("signals").$type<{
    primary: string;
    secondary?: string[];
    confidence: number; // 0-1
    marketCondition?: string;
  }>().notNull(),
  
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  
  // Performance data
  profitLoss: real("profit_loss"),
  profitLossPercent: real("profit_loss_percent"),
  holdingPeriod: integer("holding_period"), // in minutes
  
  // Related trades
  entryTradeId: integer("entry_trade_id"),  // Self-reference handled in relations
  exitReason: varchar("exit_reason", { length: 50 }), // 'take_profit', 'stop_loss', 'manual', etc.
  
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBotTradeSchema = createInsertSchema(botTrades).pick({
  botInstanceId: true,
  userId: true,
  symbol: true,
  exchange: true,
  assetClass: true,
  assetType: true,
  type: true,
  executionType: true,
  quantity: true,
  price: true,
  amount: true,
  fees: true,
  tradingMode: true,
  strategy: true,
  strategyVersion: true,
  signals: true,
  tags: true,
  notes: true,
  profitLoss: true,
  profitLossPercent: true,
  holdingPeriod: true,
  entryTradeId: true,
  exitReason: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  apiIntegrations: many(apiIntegrations),
  strategies: many(strategies),
  backtests: many(backtests),
  deployments: many(deployments),
  watchlistItems: many(watchlist),
  alertThresholds: many(alertThresholds),
  notifications: many(notifications),
  webhooks: many(webhooks),
  screeners: many(screeners),
  botInstances: many(botInstances),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  user: one(users, {
    fields: [strategies.userId],
    references: [users.id],
  }),
  backtests: many(backtests),
  deployments: many(deployments),
  webhooks: many(webhooks),
  botInstances: many(botInstances),
}));

export const apiIntegrationsRelations = relations(apiIntegrations, ({ one, many }) => ({
  user: one(users, {
    fields: [apiIntegrations.userId],
    references: [users.id],
  }),
  botInstances: many(botInstances),
}));

export const backtestsRelations = relations(backtests, ({ one }) => ({
  user: one(users, {
    fields: [backtests.userId],
    references: [users.id],
  }),
  strategy: one(strategies, {
    fields: [backtests.strategyId],
    references: [strategies.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  user: one(users, {
    fields: [deployments.userId],
    references: [users.id],
  }),
  strategy: one(strategies, {
    fields: [deployments.strategyId],
    references: [strategies.id],
  }),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
}));

export const alertThresholdsRelations = relations(alertThresholds, ({ one, many }) => ({
  user: one(users, {
    fields: [alertThresholds.userId],
    references: [users.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  alertThreshold: one(alertThresholds, {
    fields: [notifications.thresholdId],
    references: [alertThresholds.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  user: one(users, {
    fields: [webhooks.userId],
    references: [users.id],
  }),
  strategy: one(strategies, {
    fields: [webhooks.strategyId],
    references: [strategies.id],
  }),
}));

export const screenersRelations = relations(screeners, ({ one }) => ({
  user: one(users, {
    fields: [screeners.userId],
    references: [users.id],
  }),
}));

export const botInstancesRelations = relations(botInstances, ({ one, many }) => ({
  user: one(users, {
    fields: [botInstances.userId],
    references: [users.id],
  }),
  strategy: one(strategies, {
    fields: [botInstances.strategyId],
    references: [strategies.id],
  }),
  apiIntegration: one(apiIntegrations, {
    fields: [botInstances.apiIntegrationId],
    references: [apiIntegrations.id],
  }),
  trades: many(botTrades),
}));

export const botTradesRelations = relations(botTrades, ({ one }) => ({
  botInstance: one(botInstances, {
    fields: [botTrades.botInstanceId],
    references: [botInstances.id],
  }),
  user: one(users, {
    fields: [botTrades.userId],
    references: [users.id],
  }),
  // Self-reference handled differently to avoid circular dependency
  entryTrade: one(botTrades, {
    fields: [botTrades.entryTradeId],
    references: [botTrades.id],
  }),
}));

// Type Exports
export type BotInstance = typeof botInstances.$inferSelect;
export type InsertBotInstance = z.infer<typeof insertBotInstanceSchema>;

export type MarketCondition = typeof marketConditions.$inferSelect;
export type SymbolInsight = typeof symbolInsights.$inferSelect;
export type BotTrade = typeof botTrades.$inferSelect;
export type InsertBotTrade = z.infer<typeof insertBotTradeSchema>;
