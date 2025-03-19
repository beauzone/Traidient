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
    defaultExchange: string;
    defaultAssets: string[];
  }>().notNull().default({
    theme: 'dark',
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    defaultExchange: 'alpaca',
    defaultAssets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN']
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
});

// Strategies
export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'ai-generated', 'template', 'custom'
  status: text("status").notNull().default('draft'), // 'draft', 'active', 'inactive', 'error'
  source: jsonb("source").$type<{
    type: 'natural-language' | 'visual-builder' | 'code';
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
  status: text("status").notNull().default('queued'), // 'queued', 'running', 'completed', 'failed'
  configuration: jsonb("configuration").$type<{
    startDate: string;
    endDate: string;
    initialCapital: number;
    assets: string[];
    parameters: Record<string, any>;
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

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
