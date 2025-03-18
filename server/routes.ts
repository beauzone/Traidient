import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStrategy, explainStrategy, optimizeStrategy } from "./openai";
import AlpacaAPI from "./alpaca";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { 
  insertUserSchema, 
  insertApiIntegrationSchema, 
  insertStrategySchema,
  insertBacktestSchema,
  insertDeploymentSchema,
  insertWatchlistSchema
} from "@shared/schema";
import { z } from "zod";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key-should-be-in-env-var";

// Helper for authentication
const authMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await storage.getUser(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// Type for requests with user
interface AuthRequest extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // AUTH ROUTES
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json({ 
        user: userWithoutPassword,
        token 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      // Validate input
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      // Don't send password in response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({ 
        user: userWithoutPassword,
        token 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error during login' });
    }
  });

  app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Error fetching user information' });
    }
  });

  // USER ROUTES
  app.put('/api/users/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Update user profile
      const updatedUser = await storage.updateUser(req.user.id, req.body);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Error updating user profile' });
    }
  });

  app.put('/api/users/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Update user settings
      const updatedUser = await storage.updateUser(req.user.id, {
        settings: req.body
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(updatedUser.settings);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ message: 'Error updating user settings' });
    }
  });

  // API INTEGRATION ROUTES
  app.get('/api/integrations', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const integrations = await storage.getApiIntegrationsByUser(req.user.id);
      res.json(integrations);
    } catch (error) {
      console.error('Get integrations error:', error);
      res.status(500).json({ message: 'Error fetching API integrations' });
    }
  });

  app.post('/api/integrations', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const validatedData = insertApiIntegrationSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      // Check if already have a primary integration for this provider
      if (validatedData.isPrimary) {
        const existingPrimary = await storage.getApiIntegrationByProviderAndUser(
          req.user.id,
          validatedData.provider
        );
        
        if (existingPrimary) {
          await storage.updateApiIntegration(existingPrimary.id, { isPrimary: false });
        }
      }
      
      const integration = await storage.createApiIntegration(validatedData);
      res.status(201).json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Create integration error:', error);
      res.status(500).json({ message: 'Error creating API integration' });
    }
  });

  app.put('/api/integrations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const integration = await storage.getApiIntegration(id);
      
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }
      
      if (integration.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your integration' });
      }
      
      // If setting as primary, unset other primaries for this provider
      if (req.body.isPrimary) {
        const existingPrimary = await storage.getApiIntegrationByProviderAndUser(
          req.user.id,
          integration.provider
        );
        
        if (existingPrimary && existingPrimary.id !== id) {
          await storage.updateApiIntegration(existingPrimary.id, { isPrimary: false });
        }
      }
      
      const updatedIntegration = await storage.updateApiIntegration(id, req.body);
      res.json(updatedIntegration);
    } catch (error) {
      console.error('Update integration error:', error);
      res.status(500).json({ message: 'Error updating API integration' });
    }
  });

  app.delete('/api/integrations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const integration = await storage.getApiIntegration(id);
      
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }
      
      if (integration.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your integration' });
      }
      
      await storage.deleteApiIntegration(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete integration error:', error);
      res.status(500).json({ message: 'Error deleting API integration' });
    }
  });

  // STRATEGY ROUTES
  app.get('/api/strategies', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const strategies = await storage.getStrategiesByUser(req.user.id);
      res.json(strategies);
    } catch (error) {
      console.error('Get strategies error:', error);
      res.status(500).json({ message: 'Error fetching strategies' });
    }
  });

  app.post('/api/strategies', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const validatedData = insertStrategySchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const strategy = await storage.createStrategy(validatedData);
      res.status(201).json(strategy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Create strategy error:', error);
      res.status(500).json({ message: 'Error creating strategy' });
    }
  });

  app.get('/api/strategies/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const strategy = await storage.getStrategy(id);
      
      if (!strategy) {
        return res.status(404).json({ message: 'Strategy not found' });
      }
      
      if (strategy.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your strategy' });
      }
      
      res.json(strategy);
    } catch (error) {
      console.error('Get strategy error:', error);
      res.status(500).json({ message: 'Error fetching strategy' });
    }
  });

  app.put('/api/strategies/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const strategy = await storage.getStrategy(id);
      
      if (!strategy) {
        return res.status(404).json({ message: 'Strategy not found' });
      }
      
      if (strategy.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your strategy' });
      }
      
      // If configuration changed, store as a new version
      if (req.body.configuration) {
        const versions = [...strategy.versions];
        versions.push({
          version: versions.length + 1,
          timestamp: new Date().toISOString(),
          changes: req.body.versionNotes || 'Updated strategy configuration',
          configuration: req.body.configuration
        });
        
        req.body.versions = versions;
      }
      
      const updatedStrategy = await storage.updateStrategy(id, req.body);
      res.json(updatedStrategy);
    } catch (error) {
      console.error('Update strategy error:', error);
      res.status(500).json({ message: 'Error updating strategy' });
    }
  });

  app.delete('/api/strategies/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const strategy = await storage.getStrategy(id);
      
      if (!strategy) {
        return res.status(404).json({ message: 'Strategy not found' });
      }
      
      if (strategy.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your strategy' });
      }
      
      await storage.deleteStrategy(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete strategy error:', error);
      res.status(500).json({ message: 'Error deleting strategy' });
    }
  });

  // BOT BUILDER ROUTES
  app.post('/api/bot-builder/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      const result = await generateStrategy(prompt);
      res.json(result);
    } catch (error) {
      console.error('Generate strategy error:', error);
      res.status(500).json({ message: 'Error generating strategy' });
    }
  });

  app.post('/api/bot-builder/explain', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { strategyCode } = req.body;
      if (!strategyCode) {
        return res.status(400).json({ message: 'Strategy code is required' });
      }
      
      const explanation = await explainStrategy(strategyCode);
      res.json({ explanation });
    } catch (error) {
      console.error('Explain strategy error:', error);
      res.status(500).json({ message: 'Error explaining strategy' });
    }
  });

  app.post('/api/bot-builder/optimize', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { strategyCode, backtestResults, optimizationGoal } = req.body;
      if (!strategyCode || !backtestResults || !optimizationGoal) {
        return res.status(400).json({ message: 'Strategy code, backtest results, and optimization goal are required' });
      }
      
      const result = await optimizeStrategy(strategyCode, backtestResults, optimizationGoal);
      res.json(result);
    } catch (error) {
      console.error('Optimize strategy error:', error);
      res.status(500).json({ message: 'Error optimizing strategy' });
    }
  });

  // BACKTEST ROUTES
  app.post('/api/backtests', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const validatedData = insertBacktestSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      // Verify user owns the strategy
      const strategy = await storage.getStrategy(validatedData.strategyId);
      if (!strategy || strategy.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your strategy' });
      }
      
      const backtest = await storage.createBacktest(validatedData);
      
      // Run the backtest (in a real system, this would be done asynchronously)
      // For the MVP, we're simulating it
      
      // Get API integration for backtest
      const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
      const alpacaAPI = new AlpacaAPI(alpacaIntegration);
      
      // Start running the backtest with a slight delay to simulate processing
      setTimeout(async () => {
        try {
          // Update status to running
          await storage.updateBacktest(backtest.id, { status: 'running' });
          
          // Run the backtest
          const results = await alpacaAPI.runBacktest(
            strategy.source.content,
            backtest.configuration
          );
          
          // Update with results
          await storage.updateBacktest(backtest.id, {
            status: 'completed',
            results,
            completedAt: new Date()
          });
          
          // Update strategy with backtest reference
          await storage.updateStrategy(strategy.id, {
            performance: {
              ...strategy.performance,
              lastBacktest: backtest.id
            }
          });
        } catch (error) {
          console.error('Backtest execution error:', error);
          await storage.updateBacktest(backtest.id, {
            status: 'failed',
            error: (error as Error).message,
            completedAt: new Date()
          });
        }
      }, 1000);
      
      res.status(202).json(backtest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Create backtest error:', error);
      res.status(500).json({ message: 'Error creating backtest' });
    }
  });

  app.get('/api/backtests/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const backtest = await storage.getBacktest(id);
      
      if (!backtest) {
        return res.status(404).json({ message: 'Backtest not found' });
      }
      
      if (backtest.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your backtest' });
      }
      
      res.json(backtest);
    } catch (error) {
      console.error('Get backtest error:', error);
      res.status(500).json({ message: 'Error fetching backtest' });
    }
  });
  
  app.put('/api/backtests/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const backtest = await storage.getBacktest(id);
      
      if (!backtest) {
        return res.status(404).json({ message: 'Backtest not found' });
      }
      
      if (backtest.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your backtest' });
      }
      
      // Only allow status updates for running or queued backtests
      if ((backtest.status !== 'running' && backtest.status !== 'queued') && req.body.status === 'cancelled') {
        return res.status(400).json({ message: 'Cannot cancel a backtest that is not running or queued' });
      }
      
      const updatedBacktest = await storage.updateBacktest(id, {
        ...req.body,
        // If cancelling, set completedAt
        ...(req.body.status === 'cancelled' ? { completedAt: new Date() } : {})
      });
      
      res.json(updatedBacktest);
    } catch (error) {
      console.error('Update backtest error:', error);
      res.status(500).json({ message: 'Error updating backtest' });
    }
  });

  app.get('/api/backtests', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const strategyId = req.query.strategyId ? parseInt(req.query.strategyId as string) : undefined;
      let backtests;
      
      if (strategyId) {
        // Verify user owns the strategy
        const strategy = await storage.getStrategy(strategyId);
        if (!strategy || strategy.userId !== req.user.id) {
          return res.status(403).json({ message: 'Forbidden: Not your strategy' });
        }
        
        backtests = await storage.getBacktestsByStrategy(strategyId);
      } else {
        backtests = await storage.getBacktestsByUser(req.user.id);
      }
      
      res.json(backtests);
    } catch (error) {
      console.error('Get backtests error:', error);
      res.status(500).json({ message: 'Error fetching backtests' });
    }
  });

  // DEPLOYMENT (LIVE TRADING) ROUTES
  app.post('/api/deployments', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const validatedData = insertDeploymentSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      // Verify user owns the strategy
      const strategy = await storage.getStrategy(validatedData.strategyId);
      if (!strategy || strategy.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your strategy' });
      }
      
      // Create the deployment
      const deployment = await storage.createDeployment(validatedData);
      
      // In a real implementation, this would start the trading bot
      // For the MVP, we'll just update the status after a delay
      setTimeout(async () => {
        await storage.updateDeployment(deployment.id, {
          status: 'running',
          runtime: {
            lastHeartbeat: new Date().toISOString(),
            uptime: 0,
            errors: []
          }
        });
        
        // Update strategy status
        await storage.updateStrategy(strategy.id, {
          status: 'active'
        });
      }, 2000);
      
      res.status(202).json(deployment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Create deployment error:', error);
      res.status(500).json({ message: 'Error creating deployment' });
    }
  });

  app.get('/api/deployments', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const strategyId = req.query.strategyId ? parseInt(req.query.strategyId as string) : undefined;
      let deployments;
      
      if (strategyId) {
        // Verify user owns the strategy
        const strategy = await storage.getStrategy(strategyId);
        if (!strategy || strategy.userId !== req.user.id) {
          return res.status(403).json({ message: 'Forbidden: Not your strategy' });
        }
        
        deployments = await storage.getDeploymentsByStrategy(strategyId);
      } else {
        deployments = await storage.getDeploymentsByUser(req.user.id);
      }
      
      res.json(deployments);
    } catch (error) {
      console.error('Get deployments error:', error);
      res.status(500).json({ message: 'Error fetching deployments' });
    }
  });

  app.get('/api/deployments/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const deployment = await storage.getDeployment(id);
      
      if (!deployment) {
        return res.status(404).json({ message: 'Deployment not found' });
      }
      
      if (deployment.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your deployment' });
      }
      
      res.json(deployment);
    } catch (error) {
      console.error('Get deployment error:', error);
      res.status(500).json({ message: 'Error fetching deployment' });
    }
  });

  app.put('/api/deployments/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const deployment = await storage.getDeployment(id);
      
      if (!deployment) {
        return res.status(404).json({ message: 'Deployment not found' });
      }
      
      if (deployment.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your deployment' });
      }
      
      // Handle special status changes
      if (req.body.status) {
        if (req.body.status === 'paused' && deployment.status === 'running') {
          // Pause the deployment
          // In a real implementation, this would pause the trading bot
        } else if (req.body.status === 'running' && deployment.status === 'paused') {
          // Resume the deployment
          // In a real implementation, this would resume the trading bot
        } else if (req.body.status === 'stopped') {
          // Stop the deployment
          // In a real implementation, this would stop the trading bot
          
          // Update strategy status if this was the only active deployment
          const strategy = await storage.getStrategy(deployment.strategyId);
          if (strategy) {
            const otherActiveDeployments = (await storage.getDeploymentsByStrategy(strategy.id))
              .filter(d => d.id !== id && ['running', 'paused'].includes(d.status));
            
            if (otherActiveDeployments.length === 0) {
              await storage.updateStrategy(strategy.id, {
                status: 'inactive'
              });
            }
          }
        }
      }
      
      const updatedDeployment = await storage.updateDeployment(id, req.body);
      res.json(updatedDeployment);
    } catch (error) {
      console.error('Update deployment error:', error);
      res.status(500).json({ message: 'Error updating deployment' });
    }
  });

  // MARKET DATA ROUTES
  app.get('/api/market-data/quote/:symbol', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { symbol } = req.params;
      if (!symbol) {
        return res.status(400).json({ message: 'Symbol is required' });
      }
      
      // Get API integration for market data
      const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
      const alpacaAPI = new AlpacaAPI(alpacaIntegration);
      
      // Get asset information
      const assetInfo = await alpacaAPI.getAssetInformation(symbol);
      
      res.json(assetInfo);
    } catch (error) {
      console.error('Get quote error:', error);
      res.status(500).json({ message: 'Error fetching quote' });
    }
  });

  app.get('/api/market-data/historical/:symbol', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { symbol } = req.params;
      const timeframe = (req.query.timeframe as string) || '1D';
      const limit = parseInt((req.query.limit as string) || '100');
      
      if (!symbol) {
        return res.status(400).json({ message: 'Symbol is required' });
      }
      
      // Get API integration for market data
      const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
      const alpacaAPI = new AlpacaAPI(alpacaIntegration);
      
      // Get historical data
      const historicalData = await alpacaAPI.getMarketData(symbol, timeframe, limit);
      
      res.json(historicalData);
    } catch (error) {
      console.error('Get historical data error:', error);
      res.status(500).json({ message: 'Error fetching historical data' });
    }
  });

  // WATCHLIST ROUTES
  app.get('/api/watchlist', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const watchlistItems = await storage.getWatchlistItems(req.user.id);
      res.json(watchlistItems);
    } catch (error) {
      console.error('Get watchlist error:', error);
      res.status(500).json({ message: 'Error fetching watchlist' });
    }
  });

  app.post('/api/watchlist', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const validatedData = insertWatchlistSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const watchlistItem = await storage.addToWatchlist(validatedData);
      res.status(201).json(watchlistItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Add to watchlist error:', error);
      res.status(500).json({ message: 'Error adding to watchlist' });
    }
  });

  app.delete('/api/watchlist/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      await storage.removeFromWatchlist(id);
      res.status(204).send();
    } catch (error) {
      console.error('Remove from watchlist error:', error);
      res.status(500).json({ message: 'Error removing from watchlist' });
    }
  });

  return httpServer;
}
