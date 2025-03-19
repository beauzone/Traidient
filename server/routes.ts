import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStrategy, explainStrategy, optimizeStrategy } from "./openai";
import AlpacaAPI from "./alpaca";
import { YahooFinanceAPI } from "./yahoo";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { WebSocketServer, WebSocket } from 'ws';
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
  
  // Initialize WebSocket server on a different path than Vite's HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Initialize the Yahoo Finance API
  const yahooFinance = new YahooFinanceAPI();
  
  // Store active connections by user ID
  const marketDataConnections = new Map<number, Set<WebSocket>>();
  
  // Handle WebSocket connections
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    let userId: number | null = null;
    let subscribedSymbols: Set<string> = new Set();
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication
        if (data.type === 'auth') {
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET) as { userId: number };
            const user = await storage.getUser(decoded.userId);
            
            if (!user) {
              ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
              return;
            }
            
            userId = user.id;
            
            // Store connection for this user
            if (!marketDataConnections.has(userId)) {
              marketDataConnections.set(userId, new Set());
            }
            marketDataConnections.get(userId)?.add(ws);
            
            ws.send(JSON.stringify({ 
              type: 'auth_success',
              message: 'Successfully authenticated'
            }));
          } catch (error) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Invalid authentication token'
            }));
          }
        }
        // Handle subscribing to market data
        else if (data.type === 'subscribe') {
          if (!userId) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'You must authenticate first'
            }));
            return;
          }
          
          const symbols = Array.isArray(data.symbols) ? data.symbols : [data.symbols];
          
          // Add symbols to subscription list
          symbols.forEach((symbol: string) => {
            subscribedSymbols.add(symbol.toUpperCase());
          });
          
          ws.send(JSON.stringify({ 
            type: 'subscribe_success',
            message: `Subscribed to ${symbols.join(', ')}`,
            symbols: Array.from(subscribedSymbols)
          }));
          
          // Start sending market data (in a real app, this would tap into a real data feed)
          // For demo purposes, we'll simulate price updates
          startMarketDataSimulation(userId, ws, subscribedSymbols);
        }
        // Handle unsubscribing from market data
        else if (data.type === 'unsubscribe') {
          if (!userId) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'You must authenticate first'
            }));
            return;
          }
          
          const symbols = Array.isArray(data.symbols) ? data.symbols : [data.symbols];
          
          // Remove symbols from subscription list
          symbols.forEach((symbol: string) => {
            subscribedSymbols.delete(symbol.toUpperCase());
          });
          
          ws.send(JSON.stringify({ 
            type: 'unsubscribe_success',
            message: `Unsubscribed from ${symbols.join(', ')}`,
            symbols: Array.from(subscribedSymbols)
          }));
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Error processing message'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      
      // Remove connection from user's connections
      if (userId && marketDataConnections.has(userId)) {
        marketDataConnections.get(userId)?.delete(ws);
        
        // If no more connections for this user, remove the user entry
        if (marketDataConnections.get(userId)?.size === 0) {
          marketDataConnections.delete(userId);
        }
      }
    });
    
    // Send an initial connection acknowledgment
    ws.send(JSON.stringify({ 
      type: 'connection_established',
      message: 'Connected to market data service'
    }));
  });
  
  // Maps to store active simulation intervals by user and connection
  const marketDataSimulations = new Map<number, Map<WebSocket, NodeJS.Timeout>>();
  
  // Function to start real/simulated market data updates
  function startMarketDataSimulation(userId: number, ws: WebSocket, symbols: Set<string>) {
    // Make sure we have a mapping for this user
    if (!marketDataSimulations.has(userId)) {
      marketDataSimulations.set(userId, new Map());
    }
    
    // Clear any existing interval for this connection
    const userSimulations = marketDataSimulations.get(userId);
    if (userSimulations?.has(ws)) {
      clearInterval(userSimulations.get(ws));
    }
    
    // Only start sending data if there are symbols to track
    if (symbols.size === 0) return;
    
    // First, check if the market is open
    const isMarketOpen = yahooFinance.isMarketOpen();
    
    // Create price simulation data for each symbol
    const priceData = new Map<string, {
      price: number;
      lastChange: number;
      volatility: number;
    }>();
    
    // Reference prices for common stocks (approximate as of March 2025)
    const referencePrices: Record<string, any> = {
      'AAPL': { price: 214.50, name: 'Apple Inc.', exchange: 'NASDAQ' },
      'MSFT': { price: 428.50, name: 'Microsoft Corporation', exchange: 'NASDAQ' },
      'GOOG': { price: 175.90, name: 'Alphabet Inc. Class C', exchange: 'NASDAQ' },
      'GOOGL': { price: 176.30, name: 'Alphabet Inc. Class A', exchange: 'NASDAQ' },
      'AMZN': { price: 178.30, name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
      'META': { price: 499.50, name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
      'TSLA': { price: 177.50, name: 'Tesla Inc.', exchange: 'NASDAQ' },
      'NVDA': { price: 924.70, name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
      'NFLX': { price: 626.80, name: 'Netflix Inc.', exchange: 'NASDAQ' },
      'AMD': { price: 172.40, name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ' },
      'INTC': { price: 42.80, name: 'Intel Corporation', exchange: 'NASDAQ' },
      'CSCO': { price: 48.70, name: 'Cisco Systems Inc.', exchange: 'NASDAQ' },
      'ORCL': { price: 126.30, name: 'Oracle Corporation', exchange: 'NYSE' },
      'IBM': { price: 173.00, name: 'International Business Machines', exchange: 'NYSE' },
      'PYPL': { price: 62.80, name: 'PayPal Holdings Inc.', exchange: 'NASDAQ' },
      'ADBE': { price: 511.50, name: 'Adobe Inc.', exchange: 'NASDAQ' },
      'CRM': { price: 295.50, name: 'Salesforce Inc.', exchange: 'NYSE' },
      'QCOM': { price: 167.00, name: 'Qualcomm Inc.', exchange: 'NASDAQ' },
      'AVGO': { price: 1361.00, name: 'Broadcom Inc.', exchange: 'NASDAQ' },
      'TXN': { price: 170.80, name: 'Texas Instruments Inc.', exchange: 'NASDAQ' },
      'PLTR': { price: 24.30, name: 'Palantir Technologies Inc.', exchange: 'NYSE' },
      'CRWD': { price: 322.00, name: 'CrowdStrike Holdings Inc.', exchange: 'NASDAQ' },
      'PANS': { price: 688.24, name: 'Palo Alto Networks Inc.', exchange: 'NASDAQ' },
      'NET': { price: 95.60, name: 'Cloudflare Inc.', exchange: 'NYSE' },
      'NOW': { price: 778.80, name: 'ServiceNow Inc.', exchange: 'NYSE' },
      'PATH': { price: 22.10, name: 'UiPath Inc.', exchange: 'NYSE' },
      'GLD': { price: 214.30, name: 'SPDR Gold Shares', exchange: 'NYSE' }
    };
    
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      // Get reference price or generate a random one
      const basePrice = referencePrices[upperSymbol]?.price || 100 + Math.random() * 900;
      
      // Add a slight random variation to the price (±0.5%)
      const variation = basePrice * 0.005 * (Math.random() * 2 - 1);
      
      priceData.set(upperSymbol, {
        price: basePrice + variation, // Add small random variation
        lastChange: 0,
        volatility: 0.0001 + Math.random() * 0.0004 // 0.01-0.05% volatility for more realistic moves
      });
    });
    
    // Set up interval to send price updates
    const interval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        userSimulations?.delete(ws);
        return;
      }
      
      const updates: Array<{
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
        timestamp: string;
        isSimulated: boolean;
        dataSource: string;
      }> = [];
      
      try {
        // For market hours: Try real Alpaca API, fall back to simulation if needed
        // For non-market hours: Use Yahoo Finance API for actual quotes
        if (isMarketOpen) {
          // During market hours - try to use real Alpaca API data first
          try {
            // Try to get user-specific API integration for market data, fallback to environment variables
            let alpacaAPI;
            try {
              const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(userId, 'alpaca');
              alpacaAPI = new AlpacaAPI(alpacaIntegration);
              console.log("Using user's Alpaca API integration for real-time data");
            } catch (err) {
              console.log("No user-specific Alpaca integration found, using environment variables for real-time data");
              alpacaAPI = new AlpacaAPI();
            }
            
            // Fetch real-time quotes from Alpaca for the first symbol
            // In a production app with Alpaca subscription, you'd use their websocket API for all symbols
            if (symbols.size > 0) {
              const firstSymbol = Array.from(symbols)[0];
              try {
                const quoteData = await alpacaAPI.getQuote(firstSymbol);
                const quote = quoteData.quote;
                
                // Calculate price change (simplified)
                const price = quote.ap || quote.bp || 0;
                if (price > 0) {
                  // We don't have previous close from Alpaca, so we'll use a small random change
                  const prevPrice = priceData.get(firstSymbol)?.price || price;
                  const change = price - prevPrice;
                  const changePercent = (change / prevPrice) * 100;
                  
                  updates.push({
                    symbol: firstSymbol,
                    price: Number(price.toFixed(2)),
                    change: Number(change.toFixed(2)),
                    changePercent: Number(changePercent.toFixed(2)),
                    timestamp: new Date().toISOString(),
                    isSimulated: false,
                    dataSource: "alpaca"
                  });
                  
                  // Update our stored price for next calculation
                  priceData.set(firstSymbol, {
                    price: price,
                    lastChange: change,
                    volatility: priceData.get(firstSymbol)?.volatility || 0.0002
                  });
                  
                  console.log(`Got real Alpaca data for ${firstSymbol}: ${price}`);
                }
              } catch (alpacaErr) {
                console.error(`Error fetching Alpaca quote for ${firstSymbol}:`, alpacaErr);
                // Fall through to simulation for this symbol
              }
            }
            
            // For remaining symbols or if Alpaca failed, use simulation
            symbols.forEach(symbol => {
              // Skip the first symbol if we already have data for it
              if (symbol === Array.from(symbols)[0] && updates.length > 0) return;
              
              const upperSymbol = symbol.toUpperCase();
              const data = priceData.get(upperSymbol);
              if (!data) return;
              
              // Simulate random price movement with momentum
              const momentum = data.lastChange > 0 ? 0.6 : 0.4; // Slight upward bias
              const randomFactor = Math.random();
              const direction = randomFactor > momentum ? -1 : 1;
              
              // Generate change amount based on volatility
              const changeAmount = direction * data.price * data.volatility * Math.random();
              
              // Update price
              const oldPrice = data.price;
              data.price = Math.max(0.01, data.price + changeAmount);
              data.lastChange = changeAmount;
              
              // Calculate change metrics
              const change = data.price - oldPrice;
              const changePercent = (change / oldPrice) * 100;
              
              updates.push({
                symbol: upperSymbol,
                price: Number(data.price.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                timestamp: new Date().toISOString(),
                isSimulated: true,
                dataSource: "alpaca-simulation"
              });
            });
          } catch (error) {
            console.error("Error in Alpaca market data processing:", error);
            
            // Fall back to full simulation if Alpaca API fails completely
            symbols.forEach(symbol => {
              const upperSymbol = symbol.toUpperCase();
              const data = priceData.get(upperSymbol);
              if (!data) return;
              
              // Standard simulation code
              const momentum = data.lastChange > 0 ? 0.6 : 0.4;
              const randomFactor = Math.random();
              const direction = randomFactor > momentum ? -1 : 1;
              const changeAmount = direction * data.price * data.volatility * Math.random();
              const oldPrice = data.price;
              data.price = Math.max(0.01, data.price + changeAmount);
              data.lastChange = changeAmount;
              const change = data.price - oldPrice;
              const changePercent = (change / oldPrice) * 100;
              
              updates.push({
                symbol: upperSymbol,
                price: Number(data.price.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                timestamp: new Date().toISOString(),
                isSimulated: true,
                dataSource: "alpaca-simulation-fallback"
              });
            });
          }
        } else {
          // Outside market hours - use Yahoo Finance for actual quotes
          // We'll fetch one symbol at a time to avoid rate limiting
          // In a production app, you might use a queue or batch processing
          const symbolsArray = Array.from(symbols);
          for (let i = 0; i < symbolsArray.length; i++) {
            const symbol = symbolsArray[i];
            try {
              const quote = await yahooFinance.getQuote(symbol);
              
              updates.push({
                symbol: quote.symbol,
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent,
                timestamp: new Date().toISOString(),
                isSimulated: false,
                dataSource: "yahoo"
              });
            } catch (err) {
              console.error(`Error fetching Yahoo quote for ${symbol}:`, err);
              
              // Fallback to reference data if Yahoo API fails
              const upperSymbol = symbol.toUpperCase();
              const refData = priceData.get(upperSymbol);
              
              if (refData) {
                updates.push({
                  symbol: upperSymbol,
                  price: Number(refData.price.toFixed(2)),
                  change: 0,
                  changePercent: 0,
                  timestamp: new Date().toISOString(),
                  isSimulated: true,
                  dataSource: "reference-data-fallback"
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error updating market data:', error);
      }
      
      // Only send update if there are changes
      if (updates.length > 0) {
        ws.send(JSON.stringify({
          type: 'market_data',
          data: updates,
          marketStatus: {
            isMarketOpen,
            dataSource: isMarketOpen ? "alpaca-simulation" : "yahoo"
          }
        }));
      }
    }, isMarketOpen ? 1000 : 5000); // Update every 1 second during market hours, every 5 seconds otherwise
    
    // Store the interval reference
    userSimulations?.set(ws, interval);
  }

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
      
      // Validate API credentials before saving if this is an Alpaca integration
      if (validatedData.provider === 'alpaca') {
        try {
          // Create a temporary API client to validate credentials
          const alpacaAPI = new AlpacaAPI({
            id: 0, // Temporary ID since we haven't created the record yet
            userId: req.user.id,
            provider: 'alpaca',
            credentials: validatedData.credentials,
            isPrimary: validatedData.isPrimary || false,
            isActive: true,
          } as ApiIntegration);
          
          // Perform connection validation
          const validationResult = await alpacaAPI.verifyConnection();
          
          if (!validationResult.isValid) {
            return res.status(400).json({ 
              message: 'API validation failed',
              error: validationResult.message
            });
          }
          
          // Add validation status to the record
          validatedData.lastStatus = 'ok';
          validatedData.lastUsed = new Date().toISOString();
        } catch (validationError) {
          console.error('API validation error:', validationError);
          return res.status(400).json({ 
            message: 'API validation error',
            error: validationError instanceof Error ? validationError.message : String(validationError)
          });
        }
      }
      
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
      
      // Check if market is open using our Yahoo Finance API
      const isMarketOpen = yahooFinance.isMarketOpen();
      
      if (isMarketOpen) {
        try {
          // If market is open, first try to get real-time data from Alpaca API
          // Try to get user-specific API integration for market data, fallback to environment variables
          let alpacaAPI;
          try {
            const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
            alpacaAPI = new AlpacaAPI(alpacaIntegration);
            console.log("Using user's Alpaca API integration");
          } catch (err) {
            console.log("No user-specific Alpaca integration found, using environment variables");
            alpacaAPI = new AlpacaAPI();
          }
          
          // Get asset information
          const assetInfo = await alpacaAPI.getAssetInformation(symbol);
          
          // Get the latest quote from Alpaca
          const quoteData = await alpacaAPI.getQuote(symbol);
          const quote = quoteData.quote;
          
          // Calculate price change from previous day (this is simplified)
          const price = quote.ap || quote.bp || 100; // Ask price or bid price
          const prevPrice = price * (1 - (Math.random() * 0.05 - 0.025)); // For demonstration
          const change = price - prevPrice;
          const changePercent = (change / prevPrice) * 100;
          
          const responseQuote = {
            symbol: symbol,
            name: assetInfo.name || symbol,
            price: price,
            change: change,
            changePercent: changePercent,
            open: price * (1 - Math.random() * 0.02),
            high: price * (1 + Math.random() * 0.02),
            low: price * (1 - Math.random() * 0.03),
            volume: Math.floor(Math.random() * 10000000),
            marketCap: Math.floor(Math.random() * 1000000000000),
            peRatio: 15 + Math.random() * 25,
            dividend: Math.random() * 3,
            eps: 5 + Math.random() * 15,
            exchange: assetInfo.exchange || "NASDAQ",
            isSimulated: false,
            dataSource: "alpaca"
          };
          
          res.json(responseQuote);
          return;
        } catch (alpacaError) {
          console.log(`Alpaca API error for ${symbol}, falling back to Yahoo Finance:`, alpacaError);
          // Fall through to Yahoo Finance if Alpaca fails
        }
      }
      
      try {
        // During non-market hours or if Alpaca fails, get data from Yahoo Finance
        console.log(`Using Yahoo Finance for ${symbol} during non-market hours or as fallback`);
        const quoteData = await yahooFinance.getQuote(symbol);
        res.json(quoteData);
        return;
      } catch (yahooError) {
        console.log(`Yahoo Finance API error for ${symbol}, falling back to simulation:`, yahooError);
        
        // Reference prices as a last resort fallback
        const referencePrices: Record<string, any> = {
          'AAPL': { price: 214.50, name: 'Apple Inc.', exchange: 'NASDAQ' },
          'MSFT': { price: 428.50, name: 'Microsoft Corporation', exchange: 'NASDAQ' },
          'GOOG': { price: 175.90, name: 'Alphabet Inc. Class C', exchange: 'NASDAQ' },
          'GOOGL': { price: 176.30, name: 'Alphabet Inc. Class A', exchange: 'NASDAQ' },
          'AMZN': { price: 178.30, name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
          'META': { price: 499.50, name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
          'TSLA': { price: 177.50, name: 'Tesla Inc.', exchange: 'NASDAQ' },
          'NVDA': { price: 924.70, name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
          'NFLX': { price: 626.80, name: 'Netflix Inc.', exchange: 'NASDAQ' },
          'AMD': { price: 172.40, name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ' },
          'INTC': { price: 42.80, name: 'Intel Corporation', exchange: 'NASDAQ' },
          'CSCO': { price: 48.70, name: 'Cisco Systems Inc.', exchange: 'NASDAQ' },
          'ORCL': { price: 126.30, name: 'Oracle Corporation', exchange: 'NYSE' },
          'IBM': { price: 173.00, name: 'International Business Machines', exchange: 'NYSE' },
          'PYPL': { price: 62.80, name: 'PayPal Holdings Inc.', exchange: 'NASDAQ' },
          'ADBE': { price: 511.50, name: 'Adobe Inc.', exchange: 'NASDAQ' },
          'CRM': { price: 295.50, name: 'Salesforce Inc.', exchange: 'NYSE' },
          'QCOM': { price: 167.00, name: 'Qualcomm Inc.', exchange: 'NASDAQ' },
          'AVGO': { price: 1361.00, name: 'Broadcom Inc.', exchange: 'NASDAQ' },
          'TXN': { price: 170.80, name: 'Texas Instruments Inc.', exchange: 'NASDAQ' },
          'PLTR': { price: 24.30, name: 'Palantir Technologies Inc.', exchange: 'NYSE' },
          'CRWD': { price: 322.00, name: 'CrowdStrike Holdings Inc.', exchange: 'NASDAQ' },
          'PANS': { price: 688.24, name: 'Palo Alto Networks Inc.', exchange: 'NASDAQ' }
        };
        
        // Fall back to reference data as a last resort
        const upperSymbol = symbol.toUpperCase();
        const refData = referencePrices[upperSymbol];
        const basePrice = refData?.price || 100 + Math.random() * 900;
        const name = refData?.name || symbol;
        const exchange = refData?.exchange || "NASDAQ";
        
        // Add a small random variation to the price (±1%)
        const priceVariation = basePrice * 0.01 * (Math.random() * 2 - 1);
        const currentPrice = basePrice + priceVariation;
        
        // Calculate a plausible daily change (±2%)
        const changeDirection = Math.random() > 0.5 ? 1 : -1;
        const changeAmount = basePrice * (Math.random() * 0.02) * changeDirection;
        const changePercent = (changeAmount / basePrice) * 100;
        
        const responseQuote = {
          symbol: upperSymbol,
          name: name,
          price: currentPrice,
          change: parseFloat(changeAmount.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          open: basePrice - basePrice * 0.005 * (Math.random() * 2 - 1),
          high: basePrice + basePrice * 0.01 * Math.random(),
          low: basePrice - basePrice * 0.01 * Math.random(),
          volume: Math.floor(Math.random() * 10000000),
          marketCap: Math.floor(basePrice * 1000000000 * (1 + Math.random())),
          peRatio: 15 + Math.random() * 25,
          dividend: Math.random() * 3,
          eps: 5 + Math.random() * 15,
          exchange: exchange,
          isSimulated: true,
          dataSource: "reference"
        };
        
        res.json(responseQuote);
      }
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
      
      // Check if market is open using our Yahoo Finance API
      const isMarketOpen = yahooFinance.isMarketOpen();
      
      if (isMarketOpen) {
        try {
          // During market hours, first try Alpaca API
          // Try to get user-specific API integration for market data, fallback to environment variables
          let alpacaAPI;
          try {
            const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
            alpacaAPI = new AlpacaAPI(alpacaIntegration);
            console.log("Using user's Alpaca API integration for historical data");
          } catch (err) {
            console.log("No user-specific Alpaca integration found, using environment variables for historical data");
            alpacaAPI = new AlpacaAPI();
          }
          
          // Get historical data from Alpaca during market hours
          const historicalData = await alpacaAPI.getMarketData(symbol, timeframe, limit);
          
          res.json({
            ...historicalData,
            isSimulated: false,
            dataSource: "alpaca"
          });
          return;
        } catch (alpacaError) {
          console.log(`Alpaca API error for historical ${symbol}, falling back to Yahoo Finance:`, alpacaError);
          // Fall through to Yahoo Finance if Alpaca fails
        }
      }
      
      try {
        // During non-market hours or if Alpaca fails, get data from Yahoo Finance
        console.log(`Using Yahoo Finance for historical ${symbol} during non-market hours or as fallback`);
        
        // Convert timeframe to Yahoo Finance period and interval
        let period = '1mo';
        let interval = '1d';
        
        // Map Alpaca timeframes to Yahoo Finance parameters
        if (timeframe === '1D') {
          period = '2d';
          interval = '5m';
        } else if (timeframe === '5D') {
          period = '5d';
          interval = '15m';
        } else if (timeframe === '1M') {
          period = '1mo';
          interval = '1d';
        } else if (timeframe === '3M') {
          period = '3mo';
          interval = '1d';
        } else if (timeframe === '1Y') {
          period = '1y';
          interval = '1d';
        } else if (timeframe === '5Y') {
          period = '5y';
          interval = '1wk';
        }
        
        const historicalData = await yahooFinance.getHistoricalData(symbol, period, interval);
        
        res.json({
          ...historicalData,
          dataSource: "yahoo"
        });
        return;
      } catch (yahooError) {
        console.log(`Yahoo Finance API error for historical ${symbol}, falling back to simulation:`, yahooError);
        
        // Generate realistic historical data as a last resort
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - 100); // 100 days of data
        
        // Reference prices for common stocks to get a realistic base price
        const referencePrices: Record<string, any> = {
          'AAPL': { price: 214.50 },
          'MSFT': { price: 428.50 },
          'GOOG': { price: 175.90 },
          'GOOGL': { price: 176.30 },
          'AMZN': { price: 178.30 },
          'META': { price: 499.50 },
          'TSLA': { price: 177.50 },
          'NVDA': { price: 924.70 },
          'NFLX': { price: 626.80 },
          'PLTR': { price: 24.30 },
          'CRWD': { price: 322.00 },
          'PANS': { price: 688.24 }
        };
        
        const endPrice = referencePrices[symbol.toUpperCase()]?.price || 100 + Math.random() * 900;
        
        // Generate a trend line with some randomness
        const trend = Math.random() > 0.5 ? 1 : -1; // Upward or downward trend
        const volatility = 0.01 + Math.random() * 0.02; // 1-3% daily volatility
        
        const bars = [];
        let currentPrice = endPrice * (1 - trend * 0.2); // Start ~20% away from current price
        
        for (let i = 0; i < limit; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          
          // Skip weekends
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          // Add some daily randomness while maintaining the overall trend
          const dailyChange = (trend * 0.002) + (volatility * (Math.random() * 2 - 1));
          currentPrice = currentPrice * (1 + dailyChange);
          
          // Ensure price is positive
          currentPrice = Math.max(0.01, currentPrice);
          
          // Calculate daily ranges
          const open = currentPrice * (1 + (Math.random() * 0.01 - 0.005));
          const high = Math.max(open, currentPrice) * (1 + Math.random() * 0.01);
          const low = Math.min(open, currentPrice) * (1 - Math.random() * 0.01);
          const close = currentPrice;
          const volume = Math.floor(1000000 + Math.random() * 10000000);
          
          bars.push({
            t: date.toISOString(),
            o: parseFloat(open.toFixed(2)),
            h: parseFloat(high.toFixed(2)),
            l: parseFloat(low.toFixed(2)),
            c: parseFloat(close.toFixed(2)),
            v: volume
          });
        }
        
        res.json({
          symbol: symbol.toUpperCase(),
          bars: bars,
          isSimulated: true,
          dataSource: "reference"
        });
      }
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

  // Additional market data endpoints
  app.get('/api/market-data/indices', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      try {
        // Get market indices data from Yahoo Finance
        // Major US market indices
        const indexSymbols = [
          '^GSPC',  // S&P 500
          '^DJI',   // Dow Jones Industrial Average
          '^IXIC',  // NASDAQ Composite
          '^RUT',   // Russell 2000
          '^VIX'    // Volatility Index
        ];
        
        // Fetch all quotes in parallel for better performance
        const quotesPromises = indexSymbols.map(symbol => yahooFinance.getQuote(symbol));
        const quotes = await Promise.all(quotesPromises);
        
        // Format the indices data for the frontend
        const indices = quotes.map(quote => ({
          name: quote.name,
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          dataSource: "yahoo"
        }));
        
        res.json(indices);
      } catch (error) {
        console.error('Yahoo Finance API error for market indices:', error);
        
        // Fallback to reference data if Yahoo Finance fails
        const indices = [
          {
            name: 'S&P 500',
            symbol: '^GSPC',
            price: 5427.25,
            change: 32.16,
            changePercent: 0.60,
            dataSource: "reference"
          },
          {
            name: 'Dow Jones',
            symbol: '^DJI',
            price: 38456.78,
            change: -105.43,
            changePercent: -0.27,
            dataSource: "reference"
          },
          {
            name: 'Nasdaq',
            symbol: '^IXIC',
            price: 18050.12,
            change: 130.27,
            changePercent: 0.73,
            dataSource: "reference"
          },
          {
            name: 'Russell 2000',
            symbol: '^RUT',
            price: 2187.43,
            change: 15.32,
            changePercent: 0.71,
            dataSource: "reference"
          },
          {
            name: 'Volatility Index',
            symbol: '^VIX',
            price: 22.34,
            change: -1.23,
            changePercent: -5.22,
            dataSource: "reference"
          }
        ];
        
        res.json(indices);
      }
    } catch (error) {
      console.error('Get indices error:', error);
      res.status(500).json({ message: 'Error fetching market indices' });
    }
  });

  app.get('/api/market-data/sectors', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      try {
        // Get sector performance data from Yahoo Finance
        const sectors = await yahooFinance.getSectorPerformance();
        
        // Add dataSource field to each sector
        const sectorsWithSource = sectors.map(sector => ({
          ...sector,
          dataSource: "yahoo"
        }));
        
        res.json(sectorsWithSource);
      } catch (error) {
        console.error('Yahoo Finance API error for sector performance:', error);
        
        // Fallback to reference data if Yahoo Finance fails
        const sectors = [
          { name: 'Technology', performance: 1.72, color: '#4f46e5', dataSource: "reference" },
          { name: 'Healthcare', performance: 0.83, color: '#06b6d4', dataSource: "reference" },
          { name: 'Financials', performance: 0.21, color: '#3b82f6', dataSource: "reference" },
          { name: 'Consumer Discretionary', performance: 0.95, color: '#6366f1', dataSource: "reference" },
          { name: 'Energy', performance: -1.25, color: '#f43f5e', dataSource: "reference" },
          { name: 'Materials', performance: -0.37, color: '#ec4899', dataSource: "reference" },
          { name: 'Industrials', performance: 0.42, color: '#8b5cf6', dataSource: "reference" },
          { name: 'Utilities', performance: -0.15, color: '#a855f7', dataSource: "reference" },
          { name: 'Real Estate', performance: 0.08, color: '#d946ef', dataSource: "reference" }
        ];
        
        res.json(sectors);
      }
    } catch (error) {
      console.error('Get sectors error:', error);
      res.status(500).json({ message: 'Error fetching sector performance' });
    }
  });

  // TRADING ROUTES
  app.get('/api/trading/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Try to get API integration for trading
      try {
        let alpacaAPI;
        try {
          const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
          alpacaAPI = new AlpacaAPI(alpacaIntegration);
          console.log("Using user's Alpaca API integration for orders");
        } catch (err) {
          console.log("No user-specific Alpaca integration found, using environment variables for orders");
          alpacaAPI = new AlpacaAPI();
        }
        
        // Get real orders from Alpaca
        const orders = await alpacaAPI.getOrders();
        console.log(`Retrieved ${orders.length} orders from Alpaca`);
        
        // Format for frontend
        const formattedOrders = orders.map((order: any) => ({
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: parseFloat(order.qty),
          filledQuantity: parseFloat(order.filled_qty || 0),
          limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
          stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          submittedBy: 'user', // Assumption - could add a flag in future for system orders
          strategyName: order.client_order_id || 'Manual Order' // Could use this field for strategy IDs
        }));
        
        res.json(formattedOrders);
      } catch (alpacaError) {
        console.error('Error fetching Alpaca orders:', alpacaError);
        // Return empty array instead of error for UI compatibility
        res.json([]);
      }
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ message: 'Error fetching orders' });
    }
  });
  
  app.get('/api/trading/positions', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Try to get API integration for trading
      try {
        let alpacaAPI;
        try {
          const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
          alpacaAPI = new AlpacaAPI(alpacaIntegration);
          console.log("Using user's Alpaca API integration for positions");
        } catch (err) {
          console.log("No user-specific Alpaca integration found, using environment variables for positions");
          alpacaAPI = new AlpacaAPI();
        }
        
        // Get real positions from Alpaca
        const positions = await alpacaAPI.getPositions();
        console.log(`Retrieved ${positions.length} positions from Alpaca`);
        
        // Format for frontend
        const formattedPositions = positions.map((position: any) => ({
          symbol: position.symbol,
          assetName: position.symbol, // Alpaca doesn't provide name, just symbol
          quantity: parseFloat(position.qty),
          averageEntryPrice: parseFloat(position.avg_entry_price || 0),
          marketValue: parseFloat(position.market_value || 0),
          costBasis: parseFloat(position.cost_basis || 0),
          unrealizedPnL: parseFloat(position.unrealized_pl || 0),
          unrealizedPnLPercent: parseFloat(position.unrealized_plpc || 0) * 100,
          currentPrice: parseFloat(position.current_price || 0)
        }));
        
        res.json(formattedPositions);
      } catch (alpacaError) {
        console.error('Error fetching Alpaca positions:', alpacaError);
        // Return empty array instead of error for UI compatibility
        res.json([]);
      }
    } catch (error) {
      console.error('Get positions error:', error);
      res.status(500).json({ message: 'Error fetching positions' });
    }
  });
  
  app.post('/api/trading/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { symbol, side, type, quantity, timeInForce, limitPrice, stopPrice } = req.body;
      
      if (!symbol || !side || !type || !quantity || !timeInForce) {
        return res.status(400).json({ 
          message: 'Missing required fields. Required: symbol, side, type, quantity, timeInForce' 
        });
      }
      
      // Try to get API integration for trading
      try {
        let alpacaAPI;
        try {
          const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
          alpacaAPI = new AlpacaAPI(alpacaIntegration);
          console.log("Using user's Alpaca API integration for order placement");
        } catch (err) {
          console.log("No user-specific Alpaca integration found, using environment variables for order placement");
          alpacaAPI = new AlpacaAPI();
        }
        
        // Format order parameters for Alpaca
        const orderParams: any = {
          symbol,
          qty: quantity.toString(),
          side,
          type,
          time_in_force: timeInForce
        };
        
        // Add limit price if provided and required
        if ((type === 'limit' || type === 'stop_limit') && limitPrice) {
          orderParams.limit_price = limitPrice.toString();
        }
        
        // Add stop price if provided and required
        if ((type === 'stop' || type === 'stop_limit') && stopPrice) {
          orderParams.stop_price = stopPrice.toString();
        }
        
        // Place the order
        const order = await alpacaAPI.placeOrder(orderParams);
        
        // Format for response
        const formattedOrder = {
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: parseFloat(order.qty),
          filledQuantity: parseFloat(order.filled_qty || 0),
          limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
          stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          submittedBy: 'user',
          strategyName: 'Manual Order'
        };
        
        res.status(201).json(formattedOrder);
      } catch (alpacaError) {
        console.error('Error placing Alpaca order:', alpacaError);
        const errorMessage = alpacaError instanceof Error 
          ? alpacaError.message 
          : String(alpacaError);
          
        res.status(400).json({ 
          message: 'Error placing order with Alpaca', 
          error: errorMessage
        });
      }
    } catch (error) {
      console.error('Place order error:', error);
      res.status(500).json({ message: 'Error placing order' });
    }
  });
  
  app.get('/api/trading/account', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get all user's integrations to build account list
      const integrations = await storage.getApiIntegrationsByUser(req.user.id);
      
      // Process all broker accounts
      const accounts = [];
      
      // Process Alpaca accounts
      const alpacaIntegrations = integrations.filter(i => i.provider === 'alpaca');
      
      if (alpacaIntegrations.length > 0) {
        // Process each Alpaca integration
        for (const integration of alpacaIntegrations) {
          try {
            // Create API client with integration credentials
            const alpacaAPI = new AlpacaAPI(integration);
            
            // Try to get live account data
            try {
              console.log("Using user's Alpaca API integration for account data");
              const account = await alpacaAPI.getAccount();
              
              // Format for frontend with account name
              const accountName: string = 
                integration.description || 
                integration.credentials?.additionalFields?.accountName || 
                `Alpaca ${integration.credentials?.additionalFields?.accountType === 'live' ? 'Live' : 'Paper'} Account ${accounts.length + 1}`;
                
              const formattedAccount: any = {
                id: integration.id,
                name: accountName,
                accountNumber: account.account_number,
                accountType: integration.credentials?.additionalFields?.accountType || 'paper',
                status: account.status,
                currency: account.currency,
                balance: parseFloat(account.cash),
                portfolioValue: parseFloat(account.portfolio_value),
                buyingPower: parseFloat(account.buying_power),
                daytradeCount: account.daytrade_count,
                equity: parseFloat(account.equity),
                isPDT: account.pattern_day_trader || account.trading_blocked,
                tradingBlocked: account.trading_blocked,
                provider: 'Alpaca',
                performance: parseFloat(account.equity) - parseFloat(account.last_equity)
              };
              
              accounts.push(formattedAccount);
            } catch (apiError) {
              const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
              console.error("Error fetching Alpaca account:", errorMessage);
              
              // Check for specific error types to provide clear guidance
              if (errorMessage.toLowerCase().includes('forbidden')) {
                console.error("Authentication failed - API keys may be invalid or expired.");
              } else if (errorMessage.toLowerCase().includes('timed out') || errorMessage.toLowerCase().includes('network')) {
                console.error("Network or timeout issue with Alpaca API - service may be down.");
              }
              
              // Still add the account with limited info
              const accountName: string = 
                integration.description || 
                integration.credentials?.additionalFields?.accountName || 
                `Alpaca ${integration.credentials?.additionalFields?.accountType === 'live' ? 'Live' : 'Paper'} Account ${accounts.length + 1}`;
              
              // Add basic account info without live data, but include error info
              accounts.push({
                id: integration.id,
                name: accountName,
                accountNumber: `ALP-${integration.id}`,
                accountType: integration.credentials?.additionalFields?.accountType || 'paper',
                balance: 0,
                provider: 'Alpaca',
                performance: 0,
                status: 'ERROR',
                error: errorMessage.toLowerCase().includes('forbidden') ? 
                  "Authentication failed - please check your API keys" : 
                  "Connection error - Alpaca API unavailable"
              });
            }
          } catch (err) {
            console.error("Failed to process Alpaca integration:", err);
          }
        }
      } else {
        // Try using environment variables if no user integrations
        try {
          console.log("No user-specific Alpaca integration found, using environment variables for account data");
          const alpacaAPI = new AlpacaAPI();
          const account = await alpacaAPI.getAccount();
          
          if (!account) {
            throw new Error("No account data received from Alpaca API using environment variables");
          }
          
          accounts.push({
            id: 0,
            name: "Default Alpaca Account",
            accountNumber: account.account_number || 'DEFAULT',
            accountType: 'paper',
            status: account.status || 'UNKNOWN',
            currency: account.currency || 'USD',
            balance: parseFloat(account.cash || '0'),
            portfolioValue: parseFloat(account.portfolio_value || '0'),
            buyingPower: parseFloat(account.buying_power || '0'),
            equity: parseFloat(account.equity || '0'),
            provider: 'Alpaca',
            performance: parseFloat(account.equity || '0') - parseFloat(account.last_equity || account.equity || '0')
          });
        } catch (envError) {
          const errorMessage = envError instanceof Error ? envError.message : String(envError);
          console.error("Error fetching account with environment variables:", errorMessage);
          
          // Check for specific error types
          if (errorMessage.toLowerCase().includes('forbidden')) {
            console.error("Authentication failed with environment variables - API keys may be invalid or missing");
            console.error("Please ensure ALPACA_API_KEY and ALPACA_API_SECRET environment variables are correctly set");
          }
        }
      }
      
      // Add other broker types here when implemented
      
      // If we have accounts, return them
      if (accounts.length > 0) {
        console.log("Processed accounts:", accounts);
        res.json(accounts);
      } else {
        // If no accounts could be processed, return an empty array with a message
        console.error("Failed to fetch account data - no valid accounts found");
        
        // Send an empty array but include helpful error information
        res.status(200).json([{
          id: 0,
          name: "Default Account (Unavailable)",
          accountNumber: "NONE",
          accountType: "unknown",
          balance: 0,
          equity: 0,
          provider: "unavailable",
          status: "ERROR",
          error: "No valid account credentials found. Please add a broker integration.",
          performance: 0
        }]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Get account error:', errorMessage);
      
      // Return a helpful message but with status 200 so the UI can display the error
      res.status(200).json([{
        id: 0,
        name: "Error: Account Unavailable",
        accountNumber: "ERROR",
        accountType: "unknown",
        balance: 0,
        equity: 0,
        provider: "error",
        status: "ERROR",
        error: "Error connecting to trading accounts. Please try again later.",
        performance: 0
      }]);
    }
  });

  app.get('/api/market-data/gainers', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      try {
        // Get top gainers from Yahoo Finance
        const gainers = await yahooFinance.getTopGainers(5);
        
        // Add dataSource field to each gainer
        const gainersWithSource = gainers.map(gainer => ({
          ...gainer,
          dataSource: "yahoo"
        }));
        
        res.json(gainersWithSource);
      } catch (error) {
        console.error('Yahoo Finance API error for top gainers:', error);
        
        // Fallback to reference data if Yahoo Finance fails
        const gainers = [
          { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 938.46, change: 13.76, changePercent: 1.49, dataSource: "reference" },
          { symbol: 'MRVL', name: 'Marvell Technology, Inc.', price: 72.35, change: 4.18, changePercent: 6.13, dataSource: "reference" },
          { symbol: 'PANW', name: 'Palo Alto Networks Inc', price: 311.78, change: 9.52, changePercent: 3.15, dataSource: "reference" },
          { symbol: 'AMD', name: 'Advanced Micro Devices Inc', price: 175.24, change: 4.83, changePercent: 2.83, dataSource: "reference" },
          { symbol: 'AVGO', name: 'Broadcom Inc', price: 1374.75, change: 25.93, changePercent: 1.92, dataSource: "reference" }
        ];
        
        res.json(gainers);
      }
    } catch (error) {
      console.error('Get gainers error:', error);
      res.status(500).json({ message: 'Error fetching top gainers' });
    }
  });

  app.get('/api/market-data/losers', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      try {
        // Get top losers from Yahoo Finance
        const losers = await yahooFinance.getTopLosers(5);
        
        // Add dataSource field to each loser
        const losersWithSource = losers.map(loser => ({
          ...loser,
          dataSource: "yahoo"
        }));
        
        res.json(losersWithSource);
      } catch (error) {
        console.error('Yahoo Finance API error for top losers:', error);
        
        // Fallback to reference data if Yahoo Finance fails
        const losers = [
          { symbol: 'CVX', name: 'Chevron Corporation', price: 155.61, change: -2.43, changePercent: -1.54, dataSource: "reference" },
          { symbol: 'XOM', name: 'Exxon Mobil Corporation', price: 113.65, change: -1.54, changePercent: -1.34, dataSource: "reference" },
          { symbol: 'WMT', name: 'Walmart Inc', price: 59.53, change: -0.75, changePercent: -1.24, dataSource: "reference" },
          { symbol: 'VZ', name: 'Verizon Communications Inc', price: 41.02, change: -0.48, changePercent: -1.16, dataSource: "reference" },
          { symbol: 'INTC', name: 'Intel Corporation', price: 41.93, change: -0.47, changePercent: -1.11, dataSource: "reference" }
        ];
        
        res.json(losers);
      }
    } catch (error) {
      console.error('Get losers error:', error);
      res.status(500).json({ message: 'Error fetching top losers' });
    }
  });

  return httpServer;
}
