import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  provider: text("provider").notNull(), // 'alpaca', 'polygon', 'openai', etc.
  type: text("type").notNull(), // 'exchange', 'data', 'ai'
  description: text("description"), // User-friendly name for the integration
  credentials: jsonb("credentials").$type<{
    apiKey: string;
    apiSecret?: string;
    additionalFields?: Record<string, string>;
  }>().notNull(),
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
  description: true,
  credentials: true,
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
