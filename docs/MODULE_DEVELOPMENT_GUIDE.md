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

## Service Integration Patterns

### Market Data Providers

For market data integrations, implement the `IMarketDataProvider` interface:

```typescript
// server/providers/MyDataProvider.ts
import { IMarketDataProvider, QuoteData, HistoricalData } from '../types/marketData';

export class MyDataProvider implements IMarketDataProvider {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getQuote(symbol: string): Promise<QuoteData> {
    // Implementation for fetching real-time quotes
    const response = await fetch(`https://api.provider.com/quote/${symbol}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    
    const data = await response.json();
    
    return {
      symbol: data.symbol,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      volume: data.volume,
      timestamp: new Date(data.timestamp),
      dataSource: 'MyProvider'
    };
  }

  async getHistoricalData(symbol: string, period: string): Promise<HistoricalData[]> {
    // Implementation for historical data
  }

  async isValidSymbol(symbol: string): Promise<boolean> {
    // Implementation for symbol validation
  }
}
```

### Trading Execution Services

For trading integrations, follow the established broker interface pattern:

```typescript
// server/services/MyBrokerService.ts
export class MyBrokerService {
  private apiKey: string;
  private apiSecret: string;

  constructor(credentials: { apiKey: string; apiSecret: string }) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    // Implementation for order placement
    // Always validate credentials and handle errors properly
  }

  async getAccountInfo(): Promise<AccountInfo> {
    // Implementation for account data
  }

  async getPositions(): Promise<Position[]> {
    // Implementation for position data
  }
}
```

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