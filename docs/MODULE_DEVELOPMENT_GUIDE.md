# Module Development Guide

## Overview

This guide provides comprehensive instructions for developing modules that integrate seamlessly with our AI-powered trading platform. Our architecture follows modern full-stack patterns with TypeScript, React, and Express, emphasizing modularity and clean separation of concerns.

## Architecture Overview

### Stack Components
- **Frontend**: React with TypeScript, shadcn/ui components, TanStack Query for state management
- **Backend**: Express.js with TypeScript, Drizzle ORM for database operations
- **Database**: PostgreSQL with automated schema management
- **Authentication**: JWT-based with middleware protection
- **Real-time**: WebSocket connections for live data streaming

### Key Principles
1. **Type Safety**: All interfaces must be properly typed with TypeScript
2. **Data Integrity**: Only use authentic data from authorized API sources
3. **Modular Design**: Each module should be self-contained with clear interfaces
4. **Consistent Patterns**: Follow established patterns for database, API, and UI components

## Project Structure

```
├── client/src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Page-level components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and API clients
│   └── types/              # TypeScript type definitions
├── server/
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database interface and implementation
│   ├── services/           # Business logic services
│   └── providers/          # External API integrations
├── shared/
│   └── schema.ts           # Database schema and shared types
└── docs/                   # Documentation
```

## Database Schema Development

### 1. Define Schema in `shared/schema.ts`

Always start by defining your data model using Drizzle ORM:

```typescript
import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const myModuleTable = pgTable('my_module', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  configuration: jsonb('configuration'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Generate Zod schemas for validation
export const insertMyModuleSchema = createInsertSchema(myModuleTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// TypeScript types
export type MyModule = typeof myModuleTable.$inferSelect;
export type InsertMyModule = z.infer<typeof insertMyModuleSchema>;
```

### 2. Update Storage Interface

Add CRUD methods to `IStorage` interface in `server/storage.ts`:

```typescript
// Add to IStorage interface
getMyModule(id: number): Promise<MyModule | undefined>;
getMyModulesByUser(userId: number): Promise<MyModule[]>;
createMyModule(module: InsertMyModule): Promise<MyModule>;
updateMyModule(id: number, module: Partial<MyModule>): Promise<MyModule | undefined>;
deleteMyModule(id: number): Promise<boolean>;
```

### 3. Implement Storage Methods

Add implementations to `DatabaseStorage` class:

```typescript
async getMyModule(id: number): Promise<MyModule | undefined> {
  const result = await this.db.select().from(myModuleTable).where(eq(myModuleTable.id, id));
  return result[0];
}

async getMyModulesByUser(userId: number): Promise<MyModule[]> {
  return await this.db.select().from(myModuleTable).where(eq(myModuleTable.userId, userId));
}

async createMyModule(module: InsertMyModule): Promise<MyModule> {
  const result = await this.db.insert(myModuleTable).values(module).returning();
  return result[0];
}

async updateMyModule(id: number, moduleData: Partial<MyModule>): Promise<MyModule | undefined> {
  const result = await this.db.update(myModuleTable)
    .set({ ...moduleData, updatedAt: new Date() })
    .where(eq(myModuleTable.id, id))
    .returning();
  return result[0];
}

async deleteMyModule(id: number): Promise<boolean> {
  const result = await this.db.delete(myModuleTable).where(eq(myModuleTable.id, id));
  return result.rowCount > 0;
}
```

## API Route Development

### 1. Create Route Handlers in `server/routes.ts`

Follow the established pattern for authenticated routes:

```typescript
// GET /api/my-modules
app.get('/api/my-modules', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const modules = await storage.getMyModulesByUser(userId);
    res.json(modules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/my-modules
app.post('/api/my-modules', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Validate request body
    const validationResult = insertMyModuleSchema.safeParse({
      ...req.body,
      userId
    });

    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: validationResult.error.errors 
      });
    }

    const module = await storage.createMyModule(validationResult.data);
    res.status(201).json(module);
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/my-modules/:id
app.put('/api/my-modules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const moduleId = parseInt(req.params.id);

    if (!userId || isNaN(moduleId)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Verify ownership
    const existingModule = await storage.getMyModule(moduleId);
    if (!existingModule || existingModule.userId !== userId) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const updatedModule = await storage.updateMyModule(moduleId, req.body);
    res.json(updatedModule);
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/my-modules/:id
app.delete('/api/my-modules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const moduleId = parseInt(req.params.id);

    if (!userId || isNaN(moduleId)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Verify ownership
    const existingModule = await storage.getMyModule(moduleId);
    if (!existingModule || existingModule.userId !== userId) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const success = await storage.deleteMyModule(moduleId);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ message: 'Module not found' });
    }
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

## Frontend Component Development

### 1. Create Management Component

Follow established patterns using shadcn/ui components and TanStack Query:

```typescript
// client/src/components/my-module/MyModuleManager.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface MyModuleFormValues {
  name: string;
  configuration: any;
  isActive: boolean;
}

export function MyModuleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingModule, setEditingModule] = useState<any>(null);

  // Fetch modules
  const { data: modules = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/my-modules'],
    staleTime: 60000
  });

  // Form setup
  const form = useForm<MyModuleFormValues>({
    resolver: zodResolver(insertMyModuleSchema.extend({
      configuration: z.any().optional()
    })),
    defaultValues: {
      name: '',
      configuration: {},
      isActive: true
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: MyModuleFormValues) => 
      apiRequest('/api/my-modules', { method: 'POST' }, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-modules'] });
      toast({ title: 'Module created successfully' });
      form.reset();
    },
    onError: () => {
      toast({ 
        title: 'Error creating module', 
        variant: 'destructive' 
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MyModuleFormValues> }) =>
      apiRequest(`/api/my-modules/${id}`, { method: 'PUT' }, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-modules'] });
      toast({ title: 'Module updated successfully' });
      setEditingModule(null);
      form.reset();
    },
    onError: () => {
      toast({ 
        title: 'Error updating module', 
        variant: 'destructive' 
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/my-modules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-modules'] });
      toast({ title: 'Module deleted successfully' });
    },
    onError: () => {
      toast({ 
        title: 'Error deleting module', 
        variant: 'destructive' 
      });
    }
  });

  const onSubmit = (values: MyModuleFormValues) => {
    if (editingModule) {
      updateMutation.mutate({ id: editingModule.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingModule ? 'Edit Module' : 'Create New Module'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Module name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingModule ? 'Update' : 'Create'}
                </Button>
                {editingModule && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setEditingModule(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {module.name}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingModule(module);
                      form.reset(module);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(module.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Status: {module.isActive ? 'Active' : 'Inactive'}</p>
              <p>Created: {new Date(module.createdAt).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 2. Create Page Component

```typescript
// client/src/pages/my-modules.tsx
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { MyModuleManager } from '@/components/my-module/MyModuleManager';

export default function MyModulesPage() {
  return (
    <MainLayout title="My Modules">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Modules</h1>
          <p className="text-muted-foreground">
            Manage your custom modules and configurations
          </p>
        </div>
        <MyModuleManager />
      </div>
    </MainLayout>
  );
}
```

### 3. Register Page Route

Add to `client/src/App.tsx`:

```typescript
import MyModulesPage from './pages/my-modules';

// Add to the Route components
<Route path="/my-modules" component={MyModulesPage} />
```

## Modular Architecture Components

Our platform is built with a highly modular architecture that allows for easy extension and integration of new capabilities. Here are the key modular components:

### Market Data Provider Integration

Market data providers follow the `IMarketDataProvider` interface pattern. Each provider must implement standardized methods for quote retrieval, historical data, and symbol validation.

```typescript
// server/providers/MyDataProvider.ts
import { IMarketDataProvider, QuoteData, HistoricalData } from '../types/marketData';

export class MyDataProvider implements IMarketDataProvider {
  private apiKey: string;
  private config: {
    baseUrl: string;
    rateLimit: number;
    timeout: number;
  };
  
  constructor(apiKey: string, config?: Partial<typeof this.config>) {
    this.apiKey = apiKey;
    this.config = {
      baseUrl: 'https://api.provider.com',
      rateLimit: 100, // requests per minute
      timeout: 30000, // 30 seconds
      ...config
    };
  }

  async getQuote(symbol: string): Promise<QuoteData> {
    try {
      const response = await fetch(`${this.config.baseUrl}/quote/${symbol}`, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.config.timeout
      });

      if (!response.ok) {
        throw new Error(`Provider API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        symbol: data.symbol,
        price: parseFloat(data.price),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.changePercent),
        volume: parseInt(data.volume),
        marketCap: data.marketCap ? parseFloat(data.marketCap) : undefined,
        timestamp: new Date(data.timestamp),
        dataSource: 'MyProvider'
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw new Error(`Failed to fetch quote data for ${symbol}`);
    }
  }

  async getHistoricalData(symbol: string, period: string, timeframe: string): Promise<HistoricalData[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/historical/${symbol}?period=${period}&timeframe=${timeframe}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      const data = await response.json();
      return data.bars.map((bar: any) => ({
        timestamp: new Date(bar.timestamp),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseInt(bar.volume)
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      throw new Error(`Failed to fetch historical data for ${symbol}`);
    }
  }

  async isValidSymbol(symbol: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/search/${symbol}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Provider registration method
  static register(): void {
    // Register this provider in the system
    registerMarketDataProvider('MyProvider', MyDataProvider);
  }
}
```

### Broker Integration Framework

Broker integrations handle trading execution, account management, and position tracking. Each broker must implement standardized trading interfaces.

```typescript
// server/brokers/MyBrokerService.ts
import { IBrokerService, OrderRequest, OrderResponse, AccountInfo, Position } from '../types/trading';

export class MyBrokerService implements IBrokerService {
  private credentials: {
    apiKey: string;
    apiSecret: string;
    environment: 'paper' | 'live';
  };

  constructor(credentials: typeof this.credentials) {
    this.credentials = credentials;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    try {
      // Validate order parameters
      this.validateOrderRequest(order);

      const endpoint = this.credentials.environment === 'paper' 
        ? '/paper/orders' 
        : '/live/orders';

      const response = await this.makeAuthenticatedRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          symbol: order.symbol,
          qty: order.quantity,
          side: order.side.toLowerCase(),
          type: order.type.toLowerCase(),
          time_in_force: order.timeInForce || 'GTC',
          limit_price: order.limitPrice,
          stop_price: order.stopPrice
        })
      });

      return {
        orderId: response.id,
        status: response.status,
        symbol: response.symbol,
        quantity: parseInt(response.qty),
        side: response.side.toUpperCase(),
        type: response.type.toUpperCase(),
        submittedAt: new Date(response.submitted_at),
        filledAt: response.filled_at ? new Date(response.filled_at) : undefined,
        filledPrice: response.filled_avg_price ? parseFloat(response.filled_avg_price) : undefined
      };
    } catch (error) {
      console.error('Order placement error:', error);
      throw new Error(`Failed to place order: ${error.message}`);
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const response = await this.makeAuthenticatedRequest('/account');
      
      return {
        accountId: response.account_number,
        equity: parseFloat(response.equity),
        buyingPower: parseFloat(response.buying_power),
        daytradeCount: parseInt(response.daytrade_count),
        patternDayTrader: response.pattern_day_trader,
        tradingBlocked: response.trading_blocked,
        accountBlocked: response.account_blocked,
        currency: response.currency || 'USD'
      };
    } catch (error) {
      console.error('Account info error:', error);
      throw new Error(`Failed to fetch account info: ${error.message}`);
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const response = await this.makeAuthenticatedRequest('/positions');
      
      return response.map((pos: any) => ({
        symbol: pos.symbol,
        quantity: parseInt(pos.qty),
        side: parseInt(pos.qty) > 0 ? 'LONG' : 'SHORT',
        marketValue: parseFloat(pos.market_value),
        costBasis: parseFloat(pos.cost_basis),
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPercent: parseFloat(pos.unrealized_plpc),
        averageEntryPrice: parseFloat(pos.avg_entry_price)
      }));
    } catch (error) {
      console.error('Positions error:', error);
      throw new Error(`Failed to fetch positions: ${error.message}`);
    }
  }

  private async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}) {
    const url = `https://api.mybroker.com/v2${endpoint}`;
    const timestamp = Date.now().toString();
    
    // Create signature for authentication
    const signature = this.createSignature(timestamp, options.method || 'GET', endpoint);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'APCA-API-KEY-ID': this.credentials.apiKey,
        'APCA-API-SECRET-KEY': this.credentials.apiSecret,
        'APCA-API-TIMESTAMP': timestamp,
        'APCA-API-SIGNATURE': signature,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private createSignature(timestamp: string, method: string, endpoint: string): string {
    // Implement broker-specific signature creation
    // This varies by broker - some use HMAC-SHA256, others use different methods
    return 'signature_implementation_here';
  }

  private validateOrderRequest(order: OrderRequest): void {
    if (!order.symbol || !order.quantity || !order.side) {
      throw new Error('Missing required order parameters');
    }
    if (order.quantity <= 0) {
      throw new Error('Order quantity must be positive');
    }
    if (!['BUY', 'SELL'].includes(order.side)) {
      throw new Error('Order side must be BUY or SELL');
    }
  }
}
```

### Strategy Development Framework

Trading strategies follow a standardized interface that allows for backtesting, optimization, and live execution.

```typescript
// server/strategies/MyStrategy.ts
import { IStrategy, StrategyContext, StrategySignal, StrategyConfig } from '../types/strategy';

export class MyStrategy implements IStrategy {
  public readonly name = 'My Custom Strategy';
  public readonly description = 'A custom trading strategy implementation';
  public readonly version = '1.0.0';
  
  private config: StrategyConfig;
  private indicators: Map<string, any> = new Map();

  constructor(config: StrategyConfig) {
    this.config = {
      timeframe: '1H',
      symbols: [],
      parameters: {},
      riskManagement: {
        maxPositionSize: 0.05, // 5% of portfolio
        stopLoss: 0.02, // 2% stop loss
        takeProfit: 0.06, // 6% take profit
      },
      ...config
    };
  }

  async initialize(context: StrategyContext): Promise<void> {
    // Initialize indicators and strategy state
    this.indicators.set('sma_20', context.indicators.SMA(20));
    this.indicators.set('sma_50', context.indicators.SMA(50));
    this.indicators.set('rsi', context.indicators.RSI(14));
    
    console.log(`${this.name} initialized with symbols: ${this.config.symbols.join(', ')}`);
  }

  async onBar(context: StrategyContext): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];

    for (const symbol of this.config.symbols) {
      const bars = context.data.getBars(symbol, this.config.timeframe, 100);
      if (bars.length < 50) continue; // Need enough data

      // Calculate indicators
      const sma20 = this.indicators.get('sma_20').calculate(bars);
      const sma50 = this.indicators.get('sma_50').calculate(bars);
      const rsi = this.indicators.get('rsi').calculate(bars);

      const currentPrice = bars[bars.length - 1].close;
      const currentSMA20 = sma20[sma20.length - 1];
      const currentSMA50 = sma50[sma50.length - 1];
      const currentRSI = rsi[rsi.length - 1];

      // Entry conditions
      if (this.shouldBuy(currentPrice, currentSMA20, currentSMA50, currentRSI)) {
        signals.push({
          symbol,
          action: 'BUY',
          quantity: this.calculatePositionSize(context, symbol, currentPrice),
          price: currentPrice,
          stopLoss: currentPrice * (1 - this.config.riskManagement.stopLoss),
          takeProfit: currentPrice * (1 + this.config.riskManagement.takeProfit),
          reason: 'Golden cross with RSI oversold',
          confidence: this.calculateConfidence(currentRSI, currentSMA20, currentSMA50)
        });
      }

      // Exit conditions
      const position = context.portfolio.getPosition(symbol);
      if (position && this.shouldSell(currentPrice, currentSMA20, currentSMA50, currentRSI)) {
        signals.push({
          symbol,
          action: 'SELL',
          quantity: position.quantity,
          price: currentPrice,
          reason: 'Exit signal triggered',
          confidence: 0.8
        });
      }
    }

    return signals;
  }

  async onOrderFilled(context: StrategyContext, order: any): Promise<void> {
    console.log(`Order filled: ${order.symbol} ${order.side} ${order.quantity} @ ${order.filledPrice}`);
    
    // Update strategy state or risk management
    if (order.side === 'BUY') {
      // Log entry
      context.logger.log('ENTRY', {
        symbol: order.symbol,
        price: order.filledPrice,
        quantity: order.quantity,
        strategy: this.name
      });
    } else {
      // Log exit
      context.logger.log('EXIT', {
        symbol: order.symbol,
        price: order.filledPrice,
        quantity: order.quantity,
        strategy: this.name
      });
    }
  }

  private shouldBuy(price: number, sma20: number, sma50: number, rsi: number): boolean {
    return (
      sma20 > sma50 && // Golden cross
      price > sma20 && // Price above short MA
      rsi < 30 && // Oversold condition
      rsi > 25 // Not too oversold
    );
  }

  private shouldSell(price: number, sma20: number, sma50: number, rsi: number): boolean {
    return (
      sma20 < sma50 || // Death cross
      price < sma20 || // Price below short MA
      rsi > 70 // Overbought
    );
  }

  private calculatePositionSize(context: StrategyContext, symbol: string, price: number): number {
    const accountValue = context.portfolio.getTotalValue();
    const maxPositionValue = accountValue * this.config.riskManagement.maxPositionSize;
    return Math.floor(maxPositionValue / price);
  }

  private calculateConfidence(rsi: number, sma20: number, sma50: number): number {
    // Simple confidence calculation based on indicator alignment
    let confidence = 0.5;
    
    if (Math.abs(sma20 - sma50) / sma50 > 0.02) confidence += 0.2; // Strong trend
    if (rsi < 25 || rsi > 75) confidence += 0.1; // Extreme RSI
    
    return Math.min(confidence, 1.0);
  }

  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
```

### Screener Development Framework

Stock screeners allow for filtering and ranking securities based on various criteria.

```typescript
// server/screeners/MyScreener.ts
import { IScreener, ScreenerCriteria, ScreenerResult, MarketData } from '../types/screener';

export class MyScreener implements IScreener {
  public readonly name = 'Custom Technical Screener';
  public readonly description = 'Screens stocks based on technical indicators';
  
  async screen(criteria: ScreenerCriteria, universe: string[]): Promise<ScreenerResult[]> {
    const results: ScreenerResult[] = [];
    
    for (const symbol of universe) {
      try {
        const data = await this.getMarketData(symbol);
        const score = await this.calculateScore(data, criteria);
        
        if (score.meetsCriteria) {
          results.push({
            symbol,
            score: score.value,
            metrics: score.metrics,
            signals: score.signals,
            lastUpdated: new Date()
          });
        }
      } catch (error) {
        console.error(`Error screening ${symbol}:`, error);
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  private async calculateScore(data: MarketData, criteria: ScreenerCriteria): Promise<{
    value: number;
    meetsCriteria: boolean;
    metrics: Record<string, number>;
    signals: string[];
  }> {
    const metrics: Record<string, number> = {};
    const signals: string[] = [];
    let score = 0;

    // Technical Analysis
    if (data.bars.length >= 50) {
      // Moving averages
      const sma20 = this.calculateSMA(data.bars, 20);
      const sma50 = this.calculateSMA(data.bars, 50);
      const currentPrice = data.bars[data.bars.length - 1].close;

      metrics.sma20 = sma20;
      metrics.sma50 = sma50;
      metrics.priceVsSMA20 = (currentPrice - sma20) / sma20;

      // Score based on trend
      if (currentPrice > sma20 && sma20 > sma50) {
        score += 30;
        signals.push('Strong uptrend');
      }

      // Volume analysis
      const avgVolume = this.calculateAverageVolume(data.bars, 20);
      const currentVolume = data.bars[data.bars.length - 1].volume;
      metrics.volumeRatio = currentVolume / avgVolume;

      if (currentVolume > avgVolume * 1.5) {
        score += 20;
        signals.push('High volume');
      }

      // RSI
      const rsi = this.calculateRSI(data.bars, 14);
      metrics.rsi = rsi;

      if (rsi > 30 && rsi < 70) {
        score += 15;
        signals.push('Healthy RSI');
      }

      // Volatility
      const volatility = this.calculateVolatility(data.bars, 20);
      metrics.volatility = volatility;

      if (volatility > criteria.minVolatility && volatility < criteria.maxVolatility) {
        score += 10;
      }
    }

    // Fundamental criteria
    if (data.fundamentals) {
      if (data.fundamentals.marketCap > criteria.minMarketCap) {
        score += 10;
      }
      if (data.fundamentals.peRatio > 0 && data.fundamentals.peRatio < criteria.maxPE) {
        score += 5;
      }
      
      metrics.marketCap = data.fundamentals.marketCap;
      metrics.peRatio = data.fundamentals.peRatio;
    }

    const meetsCriteria = score >= criteria.minScore;

    return {
      value: score,
      meetsCriteria,
      metrics,
      signals
    };
  }

  private calculateSMA(bars: any[], period: number): number {
    if (bars.length < period) return 0;
    
    const prices = bars.slice(-period).map(bar => bar.close);
    return prices.reduce((sum, price) => sum + price, 0) / period;
  }

  private calculateAverageVolume(bars: any[], period: number): number {
    if (bars.length < period) return 0;
    
    const volumes = bars.slice(-period).map(bar => bar.volume);
    return volumes.reduce((sum, vol) => sum + vol, 0) / period;
  }

  private calculateRSI(bars: any[], period: number): number {
    if (bars.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = bars.length - period; i < bars.length; i++) {
      const change = bars[i].close - bars[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateVolatility(bars: any[], period: number): number {
    if (bars.length < period) return 0;

    const returns = [];
    for (let i = bars.length - period; i < bars.length - 1; i++) {
      returns.push((bars[i + 1].close - bars[i].close) / bars[i].close);
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private async getMarketData(symbol: string): Promise<MarketData> {
    // Fetch market data from registered providers
    // This would integrate with your market data provider system
    throw new Error('Implementation depends on your market data architecture');
  }
}
```

### Chart Integration Framework

Chart components provide visualization capabilities with support for multiple chart libraries and real-time updates.

```typescript
// client/src/components/charts/MyChartComponent.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartProps {
  symbol: string;
  timeframe: string;
  height?: number;
  indicators?: string[];
  overlays?: string[];
  onCrosshairMove?: (data: any) => void;
}

export function MyChartComponent({ 
  symbol, 
  timeframe, 
  height = 400, 
  indicators = [],
  overlays = [],
  onCrosshairMove 
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<any>(null);

  // Fetch historical data
  const { data: historicalData, isLoading } = useQuery({
    queryKey: ['/api/market-data/historical', symbol, timeframe],
    queryKey: [`/api/market-data/historical/${symbol}`, { timeframe }],
    staleTime: 60000 // 1 minute
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !historicalData) return;

    // Using lightweight-charts library
    const chartInstance = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        backgroundColor: 'transparent',
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: true,
        secondsVisible: false,
      },
      priceScale: {
        borderColor: '#4b5563',
      },
    });

    // Add candlestick series
    const candlestickSeries = chartInstance.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Add volume series
    const volumeSeries = chartInstance.addHistogramSeries({
      color: '#6b7280',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Set data
    const candleData = historicalData.bars.map((bar: any) => ({
      time: Math.floor(new Date(bar.timestamp).getTime() / 1000),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    const volumeData = historicalData.bars.map((bar: any) => ({
      time: Math.floor(new Date(bar.timestamp).getTime() / 1000),
      value: bar.volume,
      color: bar.close > bar.open ? '#10b981' : '#ef4444',
    }));

    candlestickSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    // Add indicators
    indicators.forEach(indicator => {
      addIndicator(chartInstance, indicator, historicalData.bars);
    });

    // Add overlays
    overlays.forEach(overlay => {
      addOverlay(chartInstance, overlay, historicalData.bars);
    });

    // Subscribe to crosshair move
    if (onCrosshairMove) {
      chartInstance.subscribeCrosshairMove((param: any) => {
        onCrosshairMove(param);
      });
    }

    setChart(chartInstance);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chartInstance.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.remove();
    };
  }, [historicalData, height, indicators, overlays]);

  // Real-time updates
  useEffect(() => {
    if (!chart || !symbol) return;

    const ws = new WebSocket(`ws://localhost:5000/market-data/${symbol}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Update the last candle or add new one
      const candlestickSeries = chart.getSeries()[0];
      candlestickSeries.update({
        time: Math.floor(new Date(data.timestamp).getTime() / 1000),
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
      });
    };

    return () => ws.close();
  }, [chart, symbol]);

  const addIndicator = (chartInstance: any, indicator: string, bars: any[]) => {
    switch (indicator) {
      case 'SMA20':
        const sma20Data = calculateSMA(bars, 20).map((value, index) => ({
          time: Math.floor(new Date(bars[index].timestamp).getTime() / 1000),
          value,
        }));
        
        const sma20Series = chartInstance.addLineSeries({
          color: '#3b82f6',
          lineWidth: 2,
        });
        sma20Series.setData(sma20Data);
        break;
        
      case 'RSI':
        // Add RSI in a separate pane
        const rsiData = calculateRSI(bars, 14).map((value, index) => ({
          time: Math.floor(new Date(bars[index].timestamp).getTime() / 1000),
          value,
        }));
        
        const rsiSeries = chartInstance.addLineSeries({
          color: '#f59e0b',
          lineWidth: 1,
          priceScaleId: 'rsi',
        });
        rsiSeries.setData(rsiData);
        break;
    }
  };

  const addOverlay = (chartInstance: any, overlay: string, bars: any[]) => {
    switch (overlay) {
      case 'support_resistance':
        // Add support and resistance lines
        const levels = calculateSupportResistance(bars);
        levels.forEach(level => {
          chartInstance.createPriceLine({
            price: level.price,
            color: level.type === 'support' ? '#10b981' : '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `${level.type.toUpperCase()}: ${level.price.toFixed(2)}`,
          });
        });
        break;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Chart...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse bg-muted h-96 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{symbol} - {timeframe}</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartContainerRef} style={{ height }} />
      </CardContent>
    </Card>
  );
}

// Helper functions for technical analysis
function calculateSMA(bars: any[], period: number): number[] {
  const sma = [];
  for (let i = period - 1; i < bars.length; i++) {
    const sum = bars.slice(i - period + 1, i + 1).reduce((total, bar) => total + bar.close, 0);
    sma.push(sum / period);
  }
  return sma;
}

function calculateRSI(bars: any[], period: number): number[] {
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    
    if (i <= period) {
      if (change > 0) gains += change;
      else losses += Math.abs(change);
      
      if (i === period) {
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    } else {
      const prevRSI = rsi[rsi.length - 1];
      const avgGain = ((gains / period) * (period - 1) + (change > 0 ? change : 0)) / period;
      const avgLoss = ((losses / period) * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
}

function calculateSupportResistance(bars: any[]): Array<{price: number, type: 'support' | 'resistance'}> {
  // Simplified support/resistance calculation
  const levels = [];
  const window = 20;
  
  for (let i = window; i < bars.length - window; i++) {
    const slice = bars.slice(i - window, i + window);
    const high = Math.max(...slice.map(bar => bar.high));
    const low = Math.min(...slice.map(bar => bar.low));
    
    if (bars[i].high === high) {
      levels.push({ price: high, type: 'resistance' as const });
    }
    if (bars[i].low === low) {
      levels.push({ price: low, type: 'support' as const });
    }
  }
  
  return levels;
}
```

### Integration Management System

The integration management system handles API integrations, credentials, and provider switching.

```typescript
// server/integrations/IntegrationManager.ts
export class IntegrationManager {
  private providers: Map<string, any> = new Map();
  private activeProviders: Map<string, string> = new Map(); // service -> provider

  registerProvider(service: string, providerName: string, providerClass: any): void {
    const key = `${service}:${providerName}`;
    this.providers.set(key, providerClass);
    
    console.log(`Registered ${providerName} for ${service} service`);
  }

  async createIntegration(userId: number, config: {
    provider: string;
    service: string;
    credentials: Record<string, any>;
    settings?: Record<string, any>;
  }): Promise<void> {
    const key = `${config.service}:${config.provider}`;
    const ProviderClass = this.providers.get(key);
    
    if (!ProviderClass) {
      throw new Error(`Provider ${config.provider} not found for ${config.service}`);
    }

    // Validate credentials by testing connection
    const instance = new ProviderClass(config.credentials);
    await this.validateProvider(instance, config.service);

    // Store in database
    await storage.createApiIntegration({
      userId,
      provider: config.provider,
      type: config.service,
      credentials: config.credentials,
      configuration: config.settings || {},
      isActive: true
    });

    // Set as active if no other provider is active for this service
    const userKey = `${userId}:${config.service}`;
    if (!this.activeProviders.has(userKey)) {
      this.activeProviders.set(userKey, config.provider);
    }
  }

  async getActiveProvider(userId: number, service: string): Promise<any> {
    const integration = await storage.getApiIntegrationByProviderAndUser(
      userId, 
      this.activeProviders.get(`${userId}:${service}`) || ''
    );

    if (!integration) {
      throw new Error(`No active integration found for ${service}`);
    }

    const key = `${service}:${integration.provider}`;
    const ProviderClass = this.providers.get(key);
    
    if (!ProviderClass) {
      throw new Error(`Provider class not found: ${integration.provider}`);
    }

    return new ProviderClass(integration.credentials);
  }

  private async validateProvider(instance: any, service: string): Promise<void> {
    switch (service) {
      case 'market-data':
        await instance.getQuote('AAPL'); // Test with a known symbol
        break;
      case 'broker':
        await instance.getAccountInfo(); // Test account access
        break;
      default:
        // Generic validation - check if instance has required methods
        if (typeof instance.healthCheck === 'function') {
          await instance.healthCheck();
        }
    }
  }
}

// Global instance
export const integrationManager = new IntegrationManager();
```

## Python Environment Integration

Our platform extensively uses Python for algorithmic trading, technical analysis, backtesting, and advanced data processing. The Python environment is seamlessly integrated with our Node.js backend through a robust execution framework.

### Python Environment Setup

The Python environment is automatically managed by our server initialization process:

```typescript
// server/pythonExecutionService.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class PythonExecutionService {
  private pythonPath: string;
  private pythonLibPath: string;
  private isInitialized: boolean = false;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.pythonLibPath = path.join(process.cwd(), '.pythonlibs');
  }

  async initialize(): Promise<void> {
    console.log('Initializing Python environment for screeners...');
    
    // Ensure Python libs directory exists
    if (!fs.existsSync(this.pythonLibPath)) {
      fs.mkdirSync(this.pythonLibPath, { recursive: true });
    }

    // Install required Python packages
    await this.installRequiredPackages();
    
    // Set Python path for imports
    process.env.PYTHONPATH = `${this.pythonLibPath}/lib/python3.11/site-packages:${process.env.PYTHONPATH || ''}`;
    
    this.isInitialized = true;
    console.log('Python environment initialization completed');
  }

  private async installRequiredPackages(): Promise<void> {
    const requiredPackages = [
      'pandas>=2.0.0',
      'numpy>=1.23.0',
      'pandas-ta>=0.3.14b0',
      'yfinance>=0.2.0',
      'scikit-learn>=1.3.0',
      'scipy>=1.10.0',
      'matplotlib>=3.7.0',
      'plotly>=5.15.0',
      'statsmodels>=0.14.0',
      'mplfinance>=0.12.0'
    ];

    for (const package of requiredPackages) {
      try {
        await this.installPackage(package);
      } catch (error) {
        console.error(`Failed to install ${package}:`, error);
      }
    }
  }

  private async installPackage(packageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Installing missing Python libraries: ${packageName.split('>=')[0]}`);
      
      const pip = spawn('pip', ['install', packageName, '--target', `${this.pythonLibPath}/lib/python3.11/site-packages`], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      pip.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[pip install] ${line}`);
          output += line + '\n';
        }
      });

      pip.stderr.on('data', (data) => {
        console.error(`[pip error] ${data.toString()}`);
      });

      pip.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pip install failed with code ${code}`));
        }
      });
    });
  }

  async executePythonScript(scriptPath: string, args: string[] = [], options: {
    timeout?: number;
    cwd?: string;
    env?: Record<string, string>;
  } = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.isInitialized) {
      throw new Error('Python environment not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 300000; // 5 minutes default
      const env = {
        ...process.env,
        PYTHONPATH: `${this.pythonLibPath}/lib/python3.11/site-packages:${process.env.PYTHONPATH || ''}`,
        ...options.env
      };

      const python = spawn(this.pythonPath, [scriptPath, ...args], {
        cwd: options.cwd || process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutHandler = setTimeout(() => {
        python.kill('SIGTERM');
        reject(new Error(`Python script execution timeout after ${timeout}ms`));
      }, timeout);

      python.on('close', (code) => {
        clearTimeout(timeoutHandler);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0
        });
      });

      python.on('error', (error) => {
        clearTimeout(timeoutHandler);
        reject(error);
      });
    });
  }

  async executePythonCode(code: string, args: Record<string, any> = {}): Promise<any> {
    const tempScript = path.join(this.pythonLibPath, `temp_${Date.now()}.py`);
    
    try {
      // Prepare the Python code with arguments
      const fullCode = `
import sys
import json
import os
sys.path.insert(0, '${this.pythonLibPath}/lib/python3.11/site-packages')

# Arguments passed from Node.js
args = ${JSON.stringify(args)}

# User code
${code}
`;

      fs.writeFileSync(tempScript, fullCode);
      
      const result = await this.executePythonScript(tempScript);
      
      if (result.exitCode !== 0) {
        throw new Error(`Python execution failed: ${result.stderr}`);
      }

      // Try to parse JSON output, fallback to string
      try {
        return JSON.parse(result.stdout);
      } catch {
        return result.stdout;
      }
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempScript)) {
        fs.unlinkSync(tempScript);
      }
    }
  }
}

export const pythonService = new PythonExecutionService();
```

### Python Module Development Patterns

Python modules should follow standardized patterns for integration with our Node.js backend:

#### 1. Screener Module Template

```python
# replit_agent/screeners/my_custom_screener.py
import pandas as pd
import numpy as np
import yfinance as yf
import pandas_ta as ta
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

class MyCustomScreener:
    """
    Custom stock screener implementation following platform standards.
    
    All screeners must implement:
    - screen_stocks() method returning standardized results
    - Error handling with proper JSON output
    - Configurable parameters through constructor
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = {
            'min_volume': 1000000,
            'min_price': 5.0,
            'max_price': 500.0,
            'min_market_cap': 1000000000,  # 1B
            'rsi_oversold': 30,
            'rsi_overbought': 70,
            'lookback_days': 252,
            **config
        }
        
        # Initialize data cache
        self.data_cache = {}
        
    def screen_stocks(self, tickers: List[str]) -> Dict[str, Any]:
        """
        Main screening method that must be implemented by all screeners.
        
        Args:
            tickers: List of stock symbols to screen
            
        Returns:
            Dict containing screening results in standardized format
        """
        try:
            results = []
            errors = []
            
            for ticker in tickers:
                try:
                    result = self._analyze_stock(ticker)
                    if result:
                        results.append(result)
                except Exception as e:
                    errors.append({
                        'ticker': ticker,
                        'error': str(e)
                    })
            
            # Sort results by score descending
            results.sort(key=lambda x: x.get('score', 0), reverse=True)
            
            return {
                'success': True,
                'results': results,
                'total_analyzed': len(tickers),
                'total_matches': len(results),
                'errors': errors,
                'timestamp': datetime.now().isoformat(),
                'screener': self.__class__.__name__
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'screener': self.__class__.__name__
            }
    
    def _analyze_stock(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Analyze individual stock and return results if it meets criteria.
        
        Args:
            ticker: Stock symbol to analyze
            
        Returns:
            Dict with analysis results or None if doesn't meet criteria
        """
        try:
            # Fetch data with caching
            data = self._get_stock_data(ticker)
            if data is None or len(data) < 50:
                return None
            
            # Calculate technical indicators
            indicators = self._calculate_indicators(data)
            
            # Apply screening criteria
            score = self._calculate_score(data, indicators)
            if score < 50:  # Minimum threshold
                return None
            
            # Get fundamental data
            fundamentals = self._get_fundamentals(ticker)
            
            # Apply fundamental filters
            if not self._passes_fundamental_filters(fundamentals):
                return None
            
            return {
                'symbol': ticker,
                'score': round(score, 2),
                'price': float(data['Close'].iloc[-1]),
                'volume': int(data['Volume'].iloc[-1]),
                'market_cap': fundamentals.get('market_cap', 0),
                'indicators': {
                    'rsi': round(indicators['rsi'], 2),
                    'sma_20': round(indicators['sma_20'], 2),
                    'sma_50': round(indicators['sma_50'], 2),
                    'volume_ratio': round(indicators['volume_ratio'], 2),
                    'price_change_1d': round(indicators['price_change_1d'], 2),
                    'price_change_5d': round(indicators['price_change_5d'], 2)
                },
                'signals': indicators['signals'],
                'fundamentals': fundamentals,
                'analysis_date': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error analyzing {ticker}: {str(e)}", file=sys.stderr)
            return None
    
    def _get_stock_data(self, ticker: str) -> Optional[pd.DataFrame]:
        """Fetch stock data with caching."""
        if ticker in self.data_cache:
            return self.data_cache[ticker]
        
        try:
            # Fetch data for the specified lookback period
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.config['lookback_days'])
            
            stock = yf.Ticker(ticker)
            data = stock.history(start=start_date, end=end_date)
            
            if data.empty:
                return None
            
            # Cache the data
            self.data_cache[ticker] = data
            return data
            
        except Exception as e:
            print(f"Error fetching data for {ticker}: {str(e)}", file=sys.stderr)
            return None
    
    def _calculate_indicators(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate technical indicators."""
        try:
            indicators = {}
            signals = []
            
            # Price-based indicators
            indicators['sma_20'] = data['Close'].rolling(window=20).mean().iloc[-1]
            indicators['sma_50'] = data['Close'].rolling(window=50).mean().iloc[-1]
            indicators['ema_12'] = data['Close'].ewm(span=12).mean().iloc[-1]
            indicators['ema_26'] = data['Close'].ewm(span=26).mean().iloc[-1]
            
            # RSI
            rsi_series = ta.rsi(data['Close'], length=14)
            indicators['rsi'] = rsi_series.iloc[-1] if not rsi_series.empty else 50
            
            # MACD
            macd = ta.macd(data['Close'])
            if not macd.empty:
                indicators['macd'] = macd['MACD_12_26_9'].iloc[-1]
                indicators['macd_signal'] = macd['MACDs_12_26_9'].iloc[-1]
                indicators['macd_histogram'] = macd['MACDh_12_26_9'].iloc[-1]
            
            # Volume analysis
            avg_volume_20 = data['Volume'].rolling(window=20).mean().iloc[-1]
            current_volume = data['Volume'].iloc[-1]
            indicators['volume_ratio'] = current_volume / avg_volume_20 if avg_volume_20 > 0 else 1
            
            # Price changes
            current_price = data['Close'].iloc[-1]
            indicators['price_change_1d'] = ((current_price - data['Close'].iloc[-2]) / data['Close'].iloc[-2]) * 100
            indicators['price_change_5d'] = ((current_price - data['Close'].iloc[-6]) / data['Close'].iloc[-6]) * 100
            
            # Generate signals based on indicators
            if indicators['rsi'] < self.config['rsi_oversold']:
                signals.append('RSI Oversold')
            elif indicators['rsi'] > self.config['rsi_overbought']:
                signals.append('RSI Overbought')
            
            if indicators['sma_20'] > indicators['sma_50']:
                signals.append('Golden Cross')
            elif indicators['sma_20'] < indicators['sma_50']:
                signals.append('Death Cross')
            
            if indicators['volume_ratio'] > 2.0:
                signals.append('High Volume')
            
            if 'macd' in indicators and 'macd_signal' in indicators:
                if indicators['macd'] > indicators['macd_signal']:
                    signals.append('MACD Bullish')
                else:
                    signals.append('MACD Bearish')
            
            indicators['signals'] = signals
            return indicators
            
        except Exception as e:
            print(f"Error calculating indicators: {str(e)}", file=sys.stderr)
            return {'signals': []}
    
    def _calculate_score(self, data: pd.DataFrame, indicators: Dict[str, Any]) -> float:
        """Calculate composite score for the stock."""
        score = 0.0
        
        try:
            # RSI scoring (higher score for moderate RSI)
            rsi = indicators.get('rsi', 50)
            if 40 <= rsi <= 60:
                score += 20
            elif 30 <= rsi <= 70:
                score += 10
            
            # Trend scoring (SMA crossover)
            if indicators.get('sma_20', 0) > indicators.get('sma_50', 0):
                score += 25
            
            # Volume scoring
            volume_ratio = indicators.get('volume_ratio', 1)
            if volume_ratio > 1.5:
                score += 15
            elif volume_ratio > 1.2:
                score += 10
            
            # Price momentum scoring
            price_change_5d = indicators.get('price_change_5d', 0)
            if 2 <= price_change_5d <= 15:
                score += 15
            elif price_change_5d > 15:
                score += 5  # Too much momentum might be risky
            
            # MACD scoring
            if 'macd' in indicators and 'macd_signal' in indicators:
                if indicators['macd'] > indicators['macd_signal']:
                    score += 10
            
            # Volatility consideration
            volatility = data['Close'].pct_change().std() * np.sqrt(252)
            if 0.2 <= volatility <= 0.6:  # Moderate volatility
                score += 10
            
            # Price filter
            current_price = data['Close'].iloc[-1]
            if self.config['min_price'] <= current_price <= self.config['max_price']:
                score += 5
            
            return max(0, min(100, score))  # Clamp between 0-100
            
        except Exception as e:
            print(f"Error calculating score: {str(e)}", file=sys.stderr)
            return 0.0
    
    def _get_fundamentals(self, ticker: str) -> Dict[str, Any]:
        """Get fundamental data for the stock."""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            return {
                'market_cap': info.get('marketCap', 0),
                'pe_ratio': info.get('trailingPE', 0),
                'forward_pe': info.get('forwardPE', 0),
                'price_to_book': info.get('priceToBook', 0),
                'debt_to_equity': info.get('debtToEquity', 0),
                'roe': info.get('returnOnEquity', 0),
                'revenue_growth': info.get('revenueGrowth', 0),
                'earnings_growth': info.get('earningsGrowth', 0),
                'sector': info.get('sector', 'Unknown'),
                'industry': info.get('industry', 'Unknown')
            }
            
        except Exception as e:
            print(f"Error fetching fundamentals for {ticker}: {str(e)}", file=sys.stderr)
            return {}
    
    def _passes_fundamental_filters(self, fundamentals: Dict[str, Any]) -> bool:
        """Apply fundamental filters."""
        try:
            # Market cap filter
            market_cap = fundamentals.get('market_cap', 0)
            if market_cap < self.config['min_market_cap']:
                return False
            
            # PE ratio filter (avoid extremely high or negative PE)
            pe_ratio = fundamentals.get('pe_ratio', 0)
            if pe_ratio < 0 or pe_ratio > 50:
                return False
            
            return True
            
        except Exception:
            return True  # If we can't get fundamentals, don't filter out

def main():
    """Main execution function called from Node.js."""
    try:
        # Get arguments from Node.js
        if len(sys.argv) > 1:
            config = json.loads(sys.argv[1])
        else:
            config = {}
        
        if len(sys.argv) > 2:
            tickers = json.loads(sys.argv[2])
        else:
            # Default ticker list for testing
            tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
        
        # Initialize and run screener
        screener = MyCustomScreener(config)
        results = screener.screen_stocks(tickers)
        
        # Output results as JSON for Node.js consumption
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

#### 2. Strategy Module Template

```python
# replit_agent/strategies/my_custom_strategy.py
import pandas as pd
import numpy as np
import yfinance as yf
import pandas_ta as ta
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

class MyCustomStrategy:
    """
    Custom trading strategy implementation.
    
    All strategies must implement:
    - generate_signals() method
    - backtest() method
    - Standardized signal format
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = {
            'timeframe': '1d',
            'lookback_days': 252,
            'risk_per_trade': 0.02,  # 2% risk per trade
            'max_positions': 5,
            'stop_loss': 0.05,       # 5% stop loss
            'take_profit': 0.15,     # 15% take profit
            'rsi_period': 14,
            'sma_short': 20,
            'sma_long': 50,
            **config
        }
        
        self.positions = {}
        self.trade_history = []
        
    def generate_signals(self, symbols: List[str], current_positions: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate trading signals for given symbols.
        
        Args:
            symbols: List of symbols to analyze
            current_positions: Current portfolio positions
            
        Returns:
            Dict containing signals and analysis
        """
        try:
            signals = []
            analysis = {}
            
            for symbol in symbols:
                try:
                    data = self._get_market_data(symbol)
                    if data is None or len(data) < max(self.config['sma_long'], self.config['rsi_period']):
                        continue
                    
                    # Calculate indicators
                    indicators = self._calculate_indicators(data)
                    
                    # Generate entry signals
                    entry_signal = self._check_entry_conditions(symbol, data, indicators, current_positions)
                    if entry_signal:
                        signals.append(entry_signal)
                    
                    # Generate exit signals
                    if symbol in current_positions:
                        exit_signal = self._check_exit_conditions(symbol, data, indicators, current_positions[symbol])
                        if exit_signal:
                            signals.append(exit_signal)
                    
                    # Store analysis for debugging
                    analysis[symbol] = {
                        'price': float(data['Close'].iloc[-1]),
                        'indicators': indicators,
                        'signals_generated': len([s for s in signals if s['symbol'] == symbol])
                    }
                    
                except Exception as e:
                    print(f"Error analyzing {symbol}: {str(e)}", file=sys.stderr)
                    continue
            
            return {
                'success': True,
                'signals': signals,
                'analysis': analysis,
                'timestamp': datetime.now().isoformat(),
                'strategy': self.__class__.__name__
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def backtest(self, symbols: List[str], start_date: str, end_date: str, initial_capital: float = 100000) -> Dict[str, Any]:
        """
        Backtest the strategy over historical data.
        
        Args:
            symbols: List of symbols to backtest
            start_date: Start date for backtest (YYYY-MM-DD)
            end_date: End date for backtest (YYYY-MM-DD)
            initial_capital: Initial capital for backtest
            
        Returns:
            Dict containing backtest results
        """
        try:
            # Initialize backtest state
            capital = initial_capital
            positions = {}
            trades = []
            daily_returns = []
            equity_curve = []
            
            # Get data for all symbols
            data_dict = {}
            for symbol in symbols:
                data = self._get_historical_data(symbol, start_date, end_date)
                if data is not None and len(data) > 0:
                    data_dict[symbol] = data
            
            if not data_dict:
                raise ValueError("No valid data found for backtesting")
            
            # Get all trading dates
            all_dates = set()
            for data in data_dict.values():
                all_dates.update(data.index)
            trading_dates = sorted(list(all_dates))
            
            # Run backtest day by day
            for date in trading_dates:
                daily_data = {}
                for symbol, data in data_dict.items():
                    if date in data.index:
                        daily_data[symbol] = data.loc[:date]
                
                if not daily_data:
                    continue
                
                # Generate signals for this date
                day_positions = {k: v for k, v in positions.items() if v['quantity'] > 0}
                signals_result = self._generate_backtest_signals(daily_data, day_positions)
                
                if signals_result['success']:
                    for signal in signals_result['signals']:
                        trade_result = self._execute_backtest_trade(
                            signal, capital, positions, date, daily_data
                        )
                        if trade_result:
                            trades.append(trade_result)
                            capital = trade_result['remaining_capital']
                
                # Calculate portfolio value
                portfolio_value = capital
                for symbol, position in positions.items():
                    if position['quantity'] > 0 and symbol in daily_data:
                        current_price = daily_data[symbol]['Close'].iloc[-1]
                        portfolio_value += position['quantity'] * current_price
                
                equity_curve.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'equity': portfolio_value,
                    'cash': capital
                })
                
                # Calculate daily return
                if len(equity_curve) > 1:
                    prev_equity = equity_curve[-2]['equity']
                    daily_return = (portfolio_value - prev_equity) / prev_equity
                    daily_returns.append(daily_return)
            
            # Calculate performance metrics
            performance = self._calculate_backtest_metrics(
                trades, daily_returns, initial_capital, equity_curve
            )
            
            return {
                'success': True,
                'performance': performance,
                'trades': trades,
                'equity_curve': equity_curve,
                'total_trades': len(trades),
                'symbols_traded': list(set([t['symbol'] for t in trades])),
                'backtest_period': {'start': start_date, 'end': end_date},
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _get_market_data(self, symbol: str) -> Optional[pd.DataFrame]:
        """Get recent market data for signal generation."""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.config['lookback_days'])
            
            stock = yf.Ticker(symbol)
            data = stock.history(start=start_date, end=end_date, interval=self.config['timeframe'])
            
            return data if not data.empty else None
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {str(e)}", file=sys.stderr)
            return None
    
    def _get_historical_data(self, symbol: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
        """Get historical data for backtesting."""
        try:
            stock = yf.Ticker(symbol)
            data = stock.history(start=start_date, end=end_date, interval=self.config['timeframe'])
            
            return data if not data.empty else None
            
        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {str(e)}", file=sys.stderr)
            return None
    
    def _calculate_indicators(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate technical indicators."""
        indicators = {}
        
        try:
            # Moving averages
            indicators['sma_short'] = data['Close'].rolling(window=self.config['sma_short']).mean().iloc[-1]
            indicators['sma_long'] = data['Close'].rolling(window=self.config['sma_long']).mean().iloc[-1]
            
            # RSI
            rsi_series = ta.rsi(data['Close'], length=self.config['rsi_period'])
            indicators['rsi'] = rsi_series.iloc[-1] if not rsi_series.empty else 50
            
            # MACD
            macd = ta.macd(data['Close'])
            if not macd.empty:
                indicators['macd'] = macd['MACD_12_26_9'].iloc[-1]
                indicators['macd_signal'] = macd['MACDs_12_26_9'].iloc[-1]
                indicators['macd_histogram'] = macd['MACDh_12_26_9'].iloc[-1]
            
            # Volume
            indicators['volume_sma'] = data['Volume'].rolling(window=20).mean().iloc[-1]
            indicators['volume_ratio'] = data['Volume'].iloc[-1] / indicators['volume_sma']
            
            # Volatility
            returns = data['Close'].pct_change().dropna()
            indicators['volatility'] = returns.std() * np.sqrt(252)  # Annualized
            
            # Price momentum
            indicators['price_change_5d'] = ((data['Close'].iloc[-1] - data['Close'].iloc[-6]) / data['Close'].iloc[-6]) * 100
            
            return indicators
            
        except Exception as e:
            print(f"Error calculating indicators: {str(e)}", file=sys.stderr)
            return {}
    
    def _check_entry_conditions(self, symbol: str, data: pd.DataFrame, indicators: Dict[str, Any], current_positions: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Check if entry conditions are met."""
        try:
            # Don't enter if already have position
            if symbol in current_positions:
                return None
            
            # Check if we're at max positions
            if len(current_positions) >= self.config['max_positions']:
                return None
            
            current_price = data['Close'].iloc[-1]
            
            # Entry conditions: Golden cross + RSI oversold recovery + volume confirmation
            golden_cross = indicators.get('sma_short', 0) > indicators.get('sma_long', 0)
            rsi_recovery = 35 <= indicators.get('rsi', 50) <= 65
            volume_confirmation = indicators.get('volume_ratio', 1) > 1.2
            macd_bullish = indicators.get('macd', 0) > indicators.get('macd_signal', 0)
            
            if golden_cross and rsi_recovery and volume_confirmation and macd_bullish:
                # Calculate position size based on risk
                stop_loss_price = current_price * (1 - self.config['stop_loss'])
                risk_per_share = current_price - stop_loss_price
                
                return {
                    'action': 'BUY',
                    'symbol': symbol,
                    'price': float(current_price),
                    'stop_loss': float(stop_loss_price),
                    'take_profit': float(current_price * (1 + self.config['take_profit'])),
                    'confidence': self._calculate_signal_confidence(indicators),
                    'reason': 'Golden cross with RSI recovery and volume confirmation',
                    'risk_per_share': float(risk_per_share),
                    'timestamp': datetime.now().isoformat()
                }
            
            return None
            
        except Exception as e:
            print(f"Error checking entry conditions for {symbol}: {str(e)}", file=sys.stderr)
            return None
    
    def _check_exit_conditions(self, symbol: str, data: pd.DataFrame, indicators: Dict[str, Any], position: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Check if exit conditions are met."""
        try:
            current_price = data['Close'].iloc[-1]
            entry_price = position.get('entry_price', current_price)
            
            # Calculate current P&L
            pnl_percent = ((current_price - entry_price) / entry_price) * 100
            
            # Exit conditions
            stop_loss_hit = current_price <= position.get('stop_loss', 0)
            take_profit_hit = current_price >= position.get('take_profit', float('inf'))
            death_cross = indicators.get('sma_short', 0) < indicators.get('sma_long', 0)
            rsi_overbought = indicators.get('rsi', 50) > 75
            
            exit_reason = None
            if stop_loss_hit:
                exit_reason = 'Stop loss triggered'
            elif take_profit_hit:
                exit_reason = 'Take profit triggered'
            elif death_cross and pnl_percent > 5:  # Only exit on death cross if profitable
                exit_reason = 'Death cross signal'
            elif rsi_overbought and pnl_percent > 10:
                exit_reason = 'RSI overbought exit'
            
            if exit_reason:
                return {
                    'action': 'SELL',
                    'symbol': symbol,
                    'price': float(current_price),
                    'quantity': position.get('quantity', 0),
                    'reason': exit_reason,
                    'pnl_percent': round(pnl_percent, 2),
                    'timestamp': datetime.now().isoformat()
                }
            
            return None
            
        except Exception as e:
            print(f"Error checking exit conditions for {symbol}: {str(e)}", file=sys.stderr)
            return None
    
    def _calculate_signal_confidence(self, indicators: Dict[str, Any]) -> float:
        """Calculate confidence score for signal."""
        confidence = 0.5  # Base confidence
        
        try:
            # RSI confidence
            rsi = indicators.get('rsi', 50)
            if 40 <= rsi <= 60:
                confidence += 0.2
            
            # Volume confidence
            volume_ratio = indicators.get('volume_ratio', 1)
            if volume_ratio > 1.5:
                confidence += 0.2
            elif volume_ratio > 1.2:
                confidence += 0.1
            
            # MACD confidence
            macd_histogram = indicators.get('macd_histogram', 0)
            if macd_histogram > 0:
                confidence += 0.1
            
            return min(1.0, confidence)
            
        except Exception:
            return 0.5

def main():
    """Main execution function called from Node.js."""
    try:
        # Parse command line arguments
        if len(sys.argv) < 2:
            raise ValueError("Missing operation argument")
        
        operation = sys.argv[1]
        
        if operation == 'generate_signals':
            config = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
            symbols = json.loads(sys.argv[3]) if len(sys.argv) > 3 else ['AAPL', 'MSFT']
            positions = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
            
            strategy = MyCustomStrategy(config)
            results = strategy.generate_signals(symbols, positions)
            
        elif operation == 'backtest':
            config = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
            symbols = json.loads(sys.argv[3]) if len(sys.argv) > 3 else ['AAPL', 'MSFT']
            start_date = sys.argv[4] if len(sys.argv) > 4 else '2023-01-01'
            end_date = sys.argv[5] if len(sys.argv) > 5 else '2024-01-01'
            initial_capital = float(sys.argv[6]) if len(sys.argv) > 6 else 100000
            
            strategy = MyCustomStrategy(config)
            results = strategy.backtest(symbols, start_date, end_date, initial_capital)
            
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### Node.js Integration Patterns

Here's how the Node.js backend integrates with Python modules:

```typescript
// server/services/PythonModuleService.ts
import { pythonService } from '../pythonExecutionService';
import path from 'path';

export class PythonModuleService {
  private modulesPath: string;

  constructor() {
    this.modulesPath = path.join(process.cwd(), 'replit_agent');
  }

  async executeScreener(screenerName: string, config: any, tickers: string[]): Promise<any> {
    const scriptPath = path.join(this.modulesPath, 'screeners', `${screenerName}.py`);
    
    const args = [
      JSON.stringify(config),
      JSON.stringify(tickers)
    ];

    try {
      const result = await pythonService.executePythonScript(scriptPath, args, {
        timeout: 300000, // 5 minutes
        env: {
          'PYTHONPATH': `${pythonService['pythonLibPath']}/lib/python3.11/site-packages`
        }
      });

      if (result.exitCode !== 0) {
        throw new Error(`Screener execution failed: ${result.stderr}`);
      }

      return JSON.parse(result.stdout);
    } catch (error) {
      console.error(`Error executing screener ${screenerName}:`, error);
      throw error;
    }
  }

  async executeStrategy(strategyName: string, operation: string, params: any): Promise<any> {
    const scriptPath = path.join(this.modulesPath, 'strategies', `${strategyName}.py`);
    
    const args = [operation, ...Object.values(params).map(p => JSON.stringify(p))];

    try {
      const result = await pythonService.executePythonScript(scriptPath, args, {
        timeout: 600000, // 10 minutes for backtests
        env: {
          'PYTHONPATH': `${pythonService['pythonLibPath']}/lib/python3.11/site-packages`
        }
      });

      if (result.exitCode !== 0) {
        throw new Error(`Strategy execution failed: ${result.stderr}`);
      }

      return JSON.parse(result.stdout);
    } catch (error) {
      console.error(`Error executing strategy ${strategyName}:`, error);
      throw error;
    }
  }

  async validatePythonModule(modulePath: string): Promise<boolean> {
    try {
      const result = await pythonService.executePythonScript(modulePath, ['--validate'], {
        timeout: 30000
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}

export const pythonModuleService = new PythonModuleService();
```

This comprehensive Python environment section provides complete guidance for developing Python modules that integrate seamlessly with our platform, including proper error handling, standardized interfaces, and robust Node.js integration patterns.

## Testing Guidelines

### 1. API Testing

Test your API endpoints using the existing patterns:

```typescript
// test/my-module.test.ts
import request from 'supertest';
import { app } from '../server';

describe('My Module API', () => {
  it('should create a module', async () => {
    const response = await request(app)
      .post('/api/my-modules')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: 'Test Module',
        isActive: true
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Module');
  });
});
```

### 2. Component Testing

Test React components using established patterns:

```typescript
// client/src/components/my-module/__tests__/MyModuleManager.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyModuleManager } from '../MyModuleManager';

describe('MyModuleManager', () => {
  it('renders module management interface', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MyModuleManager />
      </QueryClientProvider>
    );

    expect(screen.getByText('Create New Module')).toBeInTheDocument();
  });
});
```

## Security Guidelines

### 1. Authentication

Always protect sensitive routes with authentication middleware:

```typescript
app.get('/api/sensitive-data', authMiddleware, async (req: AuthRequest, res: Response) => {
  // Only authenticated users can access this
});
```

### 2. Input Validation

Use Zod schemas for all input validation:

```typescript
const requestSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  category: z.enum(['stocks', 'options', 'crypto'])
});

const validationResult = requestSchema.safeParse(req.body);
if (!validationResult.success) {
  return res.status(400).json({ errors: validationResult.error.errors });
}
```

### 3. Data Access Control

Always verify user ownership for resource access:

```typescript
// Verify user owns the resource
const resource = await storage.getResource(resourceId);
if (!resource || resource.userId !== req.user?.id) {
  return res.status(404).json({ message: 'Resource not found' });
}
```

## Performance Guidelines

### 1. Database Queries

Use efficient database queries with proper indexing:

```typescript
// Good: Use specific selects with conditions
const results = await db.select({
  id: table.id,
  name: table.name
}).from(table).where(eq(table.userId, userId));

// Avoid: Select all columns when not needed
const results = await db.select().from(table);
```

### 2. API Response Caching

Implement appropriate caching strategies:

```typescript
// Cache frequently accessed data
const { data: cachedData } = useQuery({
  queryKey: ['/api/market-data', symbol],
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000    // 10 minutes
});
```

### 3. Real-time Data

Use WebSocket connections for real-time updates:

```typescript
// client/src/hooks/useRealTimeData.ts
export function useRealTimeData(symbol: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5000/market-data/${symbol}`);
    
    ws.onmessage = (event) => {
      setData(JSON.parse(event.data));
    };

    return () => ws.close();
  }, [symbol]);

  return data;
}
```

## Deployment Considerations

### 1. Environment Variables

Use environment variables for configuration:

```typescript
const config = {
  apiKey: process.env.MY_API_KEY,
  apiSecret: process.env.MY_API_SECRET,
  environment: process.env.NODE_ENV || 'development'
};
```

### 2. Database Migrations

Use Drizzle's migration system:

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:push
```

### 3. Error Handling

Implement comprehensive error handling:

```typescript
try {
  const result = await externalAPI.call();
  return result;
} catch (error) {
  console.error('External API error:', error);
  throw new Error('Service temporarily unavailable');
}
```

## Integration Checklist

Before submitting a module, ensure:

- [ ] Database schema is properly defined in `shared/schema.ts`
- [ ] Storage interface methods are implemented
- [ ] API routes follow authentication and validation patterns
- [ ] Frontend components use established UI patterns
- [ ] All TypeScript types are properly defined
- [ ] Input validation uses Zod schemas
- [ ] Error handling is comprehensive
- [ ] Tests are written for critical functionality
- [ ] Documentation is updated
- [ ] Environment variables are documented

## Common Patterns Reference

### Error Response Format
```typescript
{
  message: string;
  errors?: ValidationError[];
  code?: string;
}
```

### Success Response Format
```typescript
{
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}
```

### Form Validation Pattern
```typescript
const schema = insertMyTableSchema.extend({
  customField: z.string().optional()
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { /* */ }
});
```

This guide ensures all modules follow consistent patterns and integrate seamlessly with the existing codebase. Refer to existing implementations in the codebase for additional examples and patterns.