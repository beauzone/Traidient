import type { Express, Request, Response } from "express";
import { Router } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateStrategy, explainStrategy, optimizeStrategy, generateScreen, explainScreen } from "./openai";
import { AlpacaAPI } from "./alpaca";
import { YahooFinanceAPI } from "./yahoo";
import PolygonAPI from "./polygon";
import AlphaVantageAPI from "./alphavantage";
import TiingoAPI from "./tiingo";
import { startMarketDataStream, stopMarketDataStream, getHistoricalMarketData } from "./marketDataService";
import { createMarketDataProvider } from './marketDataProviders';
import { runBacktest } from './backtestService';
import { MarketDataProviderFactory } from './marketDataProviderInterface';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { WebSocketServer, WebSocket } from 'ws';
import webhookRoutes from './routes/webhooks';
import botRoutes from './routes/bots';
import { snaptradeRoutes } from './routes/snaptradeRoutes';
import { watchlistRoutes } from './routes/watchlistRoutes';
import { 
  type AuthRequest, 
  createAuthHandler, 
  authMiddleware, 
  generateToken, 
  hashPassword, 
  comparePassword 
} from './middleware/auth';
// For Python script execution
import * as childProcess from 'child_process';
import { 
  insertUserSchema, 
  insertApiIntegrationSchema, 
  insertStrategySchema,
  insertBacktestSchema,
  insertDeploymentSchema,
  insertWatchlistSchema,
  insertAlertThresholdSchema,
  insertNotificationSchema,
  insertWebhookSchema,
  type ApiIntegration,
  type AlertThreshold,
  type Notification,
  type User,
  type InsertAlertThreshold,
  type Webhook,
  type InsertWebhook
} from "@shared/schema";

// Utility function to apply CORS headers to market data endpoints
function applyCorsHeaders(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

// Utility function to check market hours and set appropriate cache headers
function handleMarketDataCaching(req: Request, res: Response, endpoint: string) {
  // Check market hours to determine caching strategy
  const now = new Date();
  
  // Convert to Eastern Time
  const etOptions = { timeZone: 'America/New_York', hour12: false };
  const etDateString = now.toLocaleString('en-US', etOptions);
  const etDate = new Date(etDateString);
  
  // Get hours and minutes in Eastern Time
  const etHour = etDate.getHours();
  const etMinute = etDate.getMinutes();
  const dayOfWeek = now.getDay(); // Day of week doesn't change with timezone
  
  console.log(`Current date for market status check: ${now.toISOString()}, day of week: ${dayOfWeek}`);
  console.log(`Current time in Eastern: ${etHour}:${etMinute.toString().padStart(2, '0')} (EDT)`);
  console.log(`Market hours: 9:30 AM - 4:00 PM Eastern Time`);
  
  // Check if market is likely open (9:30 AM - 4:00 PM ET on weekdays)
  // Note: This is a simplified check and doesn't account for holidays
  const isLikelyMarketHours = 
    (dayOfWeek > 0 && dayOfWeek < 6) && // Monday to Friday
    ((etHour > 9 || (etHour === 9 && etMinute >= 30)) && etHour < 16);
  
  // Pre-market hours (4:00 AM - 9:30 AM ET on weekdays)
  const isPreMarketHours =
    (dayOfWeek > 0 && dayOfWeek < 6) && // Monday to Friday
    (etHour >= 4 && (etHour < 9 || (etHour === 9 && etMinute < 30)));
    
  // After-market hours (4:00 PM - 8:00 PM ET on weekdays)
  const isAfterMarketHours =
    (dayOfWeek > 0 && dayOfWeek < 6) && // Monday to Friday
    (etHour >= 16 && etHour < 20);
    
  console.log(`Market is ${isLikelyMarketHours ? 'OPEN' : 'CLOSED'} based on Eastern Time check`);
  
  // Apply CORS headers for cross-origin compatibility
  applyCorsHeaders(res);
  
  // On-demand/force refresh - never use cache
  if (req.query.forceRefresh === 'true') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    console.log(`Force refresh requested for ${endpoint}`);
    return { 
      isLikelyMarketHours,
      isPreMarketHours,
      isAfterMarketHours,
      isWeekend: (dayOfWeek === 0 || dayOfWeek === 6)
    };
  }
  
  // Set cache headers based on time of day and day of week
  if (isLikelyMarketHours) {
    // During market hours - short caching
    if (endpoint === 'single quote') {
      res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute during market hours
      console.log(`Market hours - using 1-minute cache for ${endpoint}`);
    } else if (endpoint === 'batch quotes') {
      res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute during market hours
      console.log(`Market hours - using 1-minute cache for ${endpoint}`);
    } else if (endpoint === 'historical') {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes during market hours
      console.log(`Market hours - using 5-minute cache for ${endpoint}`);
    } else if (endpoint === 'market status') {
      res.setHeader('Cache-Control', 'public, max-age=30'); // 30 seconds during market hours
      console.log(`Market hours - using 30-second cache for ${endpoint}`);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60'); // Default 1 minute during market hours
      console.log(`Market hours - using default 1-minute cache for ${endpoint}`);
    }
  } else if (isPreMarketHours) {
    // Pre-market hours - moderate caching, but more frequent than after-hours
    if (endpoint === 'single quote' || endpoint === 'batch quotes') {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes during pre-market
      console.log(`Pre-market hours - using 5-minute cache for ${endpoint}`);
    } else if (endpoint === 'historical') {
      res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes during pre-market
      console.log(`Pre-market hours - using 30-minute cache for ${endpoint}`);
    } else if (endpoint === 'market status') {
      res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute during pre-market
      console.log(`Pre-market hours - using 1-minute cache for ${endpoint}`);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300'); // Default 5 minutes during pre-market
      console.log(`Pre-market hours - using default 5-minute cache for ${endpoint}`);
    }
  } else if (isAfterMarketHours) {
    // After-market hours - moderate caching
    if (endpoint === 'single quote' || endpoint === 'batch quotes') {
      res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes after market hours
      console.log(`After-market hours - using 10-minute cache for ${endpoint}`);
    } else if (endpoint === 'historical') {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour after market hours
      console.log(`After-market hours - using 1-hour cache for ${endpoint}`);
    } else if (endpoint === 'market status') {
      res.setHeader('Cache-Control', 'public, max-age=180'); // 3 minutes after market hours
      console.log(`After-market hours - using 3-minute cache for ${endpoint}`);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=600'); // Default 10 minutes after market hours
      console.log(`After-market hours - using default 10-minute cache for ${endpoint}`);
    }
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend - extensive caching
    if (endpoint === 'single quote' || endpoint === 'batch quotes' || endpoint === 'historical') {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours on weekends
      console.log(`Weekend - using 24-hour cache for ${endpoint}`);
    } else if (endpoint === 'market status') {
      res.setHeader('Cache-Control', 'public, max-age=14400'); // 4 hours on weekends
      console.log(`Weekend - using 4-hour cache for ${endpoint}`);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=43200'); // Default 12 hours on weekends
      console.log(`Weekend - using default 12-hour cache for ${endpoint}`);
    }
  } else {
    // Off hours (overnight) - long caching
    if (endpoint === 'single quote' || endpoint === 'batch quotes') {
      res.setHeader('Cache-Control', 'public, max-age=7200'); // 2 hours overnight
      console.log(`Off hours - using 2-hour cache for ${endpoint}`);
    } else if (endpoint === 'historical') {
      res.setHeader('Cache-Control', 'public, max-age=14400'); // 4 hours overnight
      console.log(`Off hours - using 4-hour cache for ${endpoint}`);
    } else if (endpoint === 'market status') {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour overnight
      console.log(`Off hours - using 1-hour cache for ${endpoint}`);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=7200'); // Default 2 hours overnight
      console.log(`Off hours - using default 2-hour cache for ${endpoint}`);
    }
  }
  
  return { 
    isLikelyMarketHours,
    isPreMarketHours,
    isAfterMarketHours,
    isWeekend: (dayOfWeek === 0 || dayOfWeek === 6)
  };
}
import { processWebhook, generateWebhookToken } from "./webhookService";
import { evaluateAlertThreshold, createNotificationFromThreshold, processUserAlerts, type EvaluationContext } from "./notificationService";
import { sendVerificationCode, verifyPhoneNumber, isPhoneNumberVerified, sendAlertSMS } from "./twilio";
import { z } from "zod";

// Use provided JWT_SECRET or a default development secret
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-for-testing-only';

// We now use the imported authMiddleware

// Using AuthRequest from middleware/auth.ts

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication with Replit
  await setupAuth(app);
  
  // Special endpoint for dev mode auto-login
  app.get("/api/auth/dev-user", (req, res) => {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'production') {
      // Check for dev user through the auto-login mechanism
      const username = 'dev_user';
      
      storage.getUserByUsername(username)
        .then(user => {
          if (user) {
            // Return the user but omit sensitive fields
            const { password, ...safeUser } = user;
            res.json(safeUser);
          } else {
            res.status(404).json({ message: 'Dev user not found' });
          }
        })
        .catch(err => {
          console.error('Error in dev-user endpoint:', err);
          res.status(500).json({ message: 'Server error' });
        });
    } else {
      // Not available in production
      res.status(404).json({ message: 'Not found' });
    }
  });
  
  // Local authentication routes for development/testing
  app.post('/api/local/register', async (req: Request, res: Response) => {
    try {
      const { username, password, email, name } = req.body;
      
      // Basic validation
      if (!username || !password || !email) {
        return res.status(400).json({ message: 'Username, password, and email are required' });
      }
      
      // Check if the user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create the user
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        name: name || username
      });
      
      // Don't send the password back in the response
      const { password: _, ...userWithoutPassword } = newUser;
      
      // Generate JWT token
      const token = generateToken(newUser.id);
      
      res.status(201).json({ 
        message: 'User registered successfully',
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Error registering user' });
    }
  });
  
  app.post('/api/local/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      // Basic validation
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      // Find the user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Generate a token
      const token = generateToken(user.id);
      
      // Don't send the password back in the response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({ 
        message: 'Login successful',
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in' });
    }
  });
  
  // Get current user for JWT auth (parallel to Replit auth's /api/auth/user)
  app.get('/api/local/user', authMiddleware, (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    // Don't send the password back
    const { password, ...userWithoutPassword } = authReq.user;
    res.json(userWithoutPassword);
  });
  
  const httpServer = createServer(app);
  
  // Initialize WebSocket server with most basic configuration
  // Create it with just server and path to avoid any compatibility issues
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    perMessageDeflate: false, // Disable compression for Cloudflare compatibility
    clientTracking: true,     // Track clients for easier cleanup
    maxPayload: 1024 * 1024   // 1MB max message size for better stability
  });
  
  // Log WebSocketServer creation
  console.log('WebSocketServer initialized on path /ws with Cloudflare-compatible settings');
  
  // Initialize the Yahoo Finance API
  const yahooFinance = new YahooFinanceAPI();
  
  // Store active connections by user ID
  const marketDataConnections = new Map<number, Set<WebSocket>>();
  
  // Handle WebSocket connections for market data and watchlists  
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket client connected from:', req.socket.remoteAddress);
    let userId: number | null = null;
    let subscribedSymbols: Set<string> = new Set();
    let isAlive = true;
    let pingTimeout: NodeJS.Timeout | null = null;
    
    // Function to handle ping/pong for keeping connection alive
    const heartbeat = () => {
      isAlive = true;
      
      // Clear existing timeout if any
      if (pingTimeout) {
        clearTimeout(pingTimeout);
      }
      
      // Set a timeout to close the connection if no pong is received
      pingTimeout = setTimeout(() => {
        console.log('WebSocket connection timed out (no pong received)');
        isAlive = false;
        ws.terminate();
      }, 35000); // 35 second timeout (slightly longer than client's 30s ping interval)
    };
    
    // Start the heartbeat
    heartbeat();
    
    // Parse URL for authentication tokens/userId
    let tokenFromUrl: string | null = null;
    let userIdFromUrl: string | null = null;
    
    try {
      // Get the raw URL from the request
      const rawUrl = req.url || '';
      console.log('Incoming WebSocket connection URL:', rawUrl);
      
      // Handle URL parsing more safely - the URL could include query params directly
      const urlParts = rawUrl.split('?');
      if (urlParts.length > 1) {
        const queryString = urlParts[1];
        const searchParams = new URLSearchParams(queryString);
        
        tokenFromUrl = searchParams.get('token');
        userIdFromUrl = searchParams.get('userId');
        
        console.log('WebSocket URL params:', { 
          hasToken: !!tokenFromUrl, 
          hasUserId: !!userIdFromUrl,
          timestamp: searchParams.get('_') // Log cache buster
        });
      } else {
        console.log('No query parameters found in WebSocket URL');
      }
    } catch (urlParseError) {
      console.error('Error parsing WebSocket URL:', urlParseError);
    }
    
    // Attempt immediate authentication with URL parameters
    const authenticateFromUrlParams = async () => {
      const localTokenFromUrl = tokenFromUrl;
      const localUserIdFromUrl = userIdFromUrl;
      
      // Try token-based authentication first
      if (localTokenFromUrl) {
        try {
          const decoded = jwt.verify(localTokenFromUrl, JWT_SECRET) as { userId: number };
          const user = await storage.getUser(decoded.userId);
          
          if (user) {
            userId = user.id;
            return true;
          }
        } catch (error) {
          console.log('URL token authentication failed:', error);
        }
      }
      
      // Try userId-based authentication (relies on session cookie which is handled by Express)
      if (localUserIdFromUrl && !userId) {
        try {
          const userIdNum = Number(localUserIdFromUrl);
          if (!isNaN(userIdNum)) {
            const user = await storage.getUser(userIdNum);
            if (user) {
              userId = user.id;
              return true;
            }
          }
        } catch (error) {
          console.log('URL userId authentication failed:', error);
        }
      }
      
      return false;
    };
    
    // Try to authenticate immediately if URL params are provided
    authenticateFromUrlParams().then(success => {
      if (success) {
        // Store connection for this user
        if (!marketDataConnections.has(userId!)) {
          marketDataConnections.set(userId!, new Set());
        }
        marketDataConnections.get(userId!)?.add(ws);
        
        console.log(`WebSocket authenticated for user ${userId} via URL parameters`);
        
        // Send authentication success message
        ws.send(JSON.stringify({ 
          type: 'auth_success',
          message: 'Successfully authenticated via URL parameters'
        }));
      } else {
        console.log('URL authentication failed, waiting for explicit auth message');
      }
    });
    
    ws.on('message', async (message: string) => {
      try {
        // Reset the heartbeat timeout whenever we receive any message
        heartbeat();
        
        // Handle ping messages (both simple string and JSON formats)
        if (message.toString() === 'ping' || message.toString() === '{"type":"ping"}') {
          console.log('Received ping, sending pong');
          ws.send(message.toString() === 'ping' ? 'pong' : '{"type":"pong"}');
          return;
        }
        
        const data = JSON.parse(message.toString());
        
        // Handle ping/pong for keeping connection alive with more data
        if (data.type === 'ping') {
          console.log('Received ping with timestamp, sending pong');
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: data.timestamp,
            serverTime: Date.now()
          }));
          return;
        }
        
        // Handle authentication
        if (data.type === 'auth' || data.type === 'auth_backup') {
          try {
            console.log('WebSocket authentication attempt received:', { 
              type: data.type,
              hasToken: !!data.token,
              hasUserId: !!data.userId,
              timestamp: data.timestamp
            });
            
            let authenticatedUserId: number | null = null;
            const isDevelopment = process.env.NODE_ENV !== 'production';
            
            // In development, be more lenient with authentication
            if (isDevelopment && process.env.DEV_AUTO_LOGIN === 'true') {
              console.log('Development environment detected with auto-login enabled');
              
              // Try to find or create a dev user
              try {
                let devUser = await storage.getUserByUsername('dev_user');
                
                if (!devUser) {
                  console.log('Creating dev_user for WebSocket authentication');
                  devUser = await storage.createUser({
                    username: 'dev_user',
                    name: 'Development User',
                    password: 'password',
                    email: 'dev@example.com'
                  });
                }
                
                if (devUser) {
                  authenticatedUserId = devUser.id;
                  console.log(`Using dev_user (id: ${authenticatedUserId}) for WebSocket authentication`);
                }
              } catch (devUserError) {
                console.error('Error creating/finding dev user:', devUserError);
              }
            } else {
              // If a token is provided, verify it
              if (data.token) {
                try {
                  const decoded = jwt.verify(data.token, JWT_SECRET) as { userId: number };
                  const user = await storage.getUser(decoded.userId);
                  
                  if (user) {
                    authenticatedUserId = user.id;
                    console.log(`User authenticated via token: ${user.username} (id: ${user.id})`);
                  }
                } catch (tokenError) {
                  console.log('Token verification failed:', tokenError);
                }
              }
            }
            
            // If userId is provided directly (from client side auth) and we're still not authenticated
            if (!authenticatedUserId && data.userId) {
              try {
                const userIdNum = Number(data.userId);
                if (!isNaN(userIdNum)) {
                  const user = await storage.getUser(userIdNum);
                  if (user) {
                    authenticatedUserId = user.id;
                  }
                }
              } catch (userIdError) {
                console.log('User ID verification failed:', userIdError);
              }
            }
            
            // If neither method worked
            if (!authenticatedUserId) {
              ws.send(JSON.stringify({ 
                type: 'auth_error', 
                message: 'Authentication failed: Invalid credentials'
              }));
              return;
            }
            
            userId = authenticatedUserId;
            
            // Store connection for this user
            if (!marketDataConnections.has(userId)) {
              marketDataConnections.set(userId, new Set());
            }
            marketDataConnections.get(userId)?.add(ws);
            
            console.log(`WebSocket authenticated for user ${userId}`);
            
            ws.send(JSON.stringify({ 
              type: 'auth_success',
              message: 'Successfully authenticated'
            }));
          } catch (error) {
            console.error('WebSocket authentication error:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Authentication failed: Invalid token'
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
          
          // Start streaming market data using the new market data service
          startMarketDataStream(userId, ws, subscribedSymbols);
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
        // Future support for watchlist updates will be added here
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
      
      // Clear heartbeat timeout
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
      }
      
      // Remove connection from user's connections
      if (userId) {
        // Remove from market data connections
        if (marketDataConnections.has(userId)) {
          marketDataConnections.get(userId)?.delete(ws);
          
          // If no more connections for this user, remove the user entry
          if (marketDataConnections.get(userId)?.size === 0) {
            marketDataConnections.delete(userId);
          }
        }
        
        // Future: Handle watchlist subscription cleanup
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
  function startMarketDataStream(userId: number, ws: WebSocket, symbols: Set<string>) {
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
        // Process each update individually for better client-side handling
        updates.forEach(update => {
          ws.send(JSON.stringify({
            type: 'marketData',
            symbol: update.symbol,
            price: update.price,
            change: update.change,
            percentChange: update.changePercent,
            volume: Math.floor(100000 + Math.random() * 1000000), // Simulated volume
            timestamp: update.timestamp,
            isMarketOpen,
            dataSource: update.dataSource
          }));
        });
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

  app.get('/api/auth/me', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));

  // USER ROUTES
  app.put('/api/users/profile', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      
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
  }));

  app.put('/api/users/settings', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      
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
  }));

  // API INTEGRATION ROUTES
  app.get('/api/integrations', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const integrations = await storage.getApiIntegrationsByUser(userId);
      res.json(integrations);
    } catch (error) {
      console.error('Get integrations error:', error);
      res.status(500).json({ message: 'Error fetching API integrations' });
    }
  }));

  app.post('/api/integrations', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Create a base integration object with the request data
      const integrationData = {
        ...req.body,
        userId: req.user.id
      };
      
      // Check for duplicate integrations (same provider and API key)
      if (integrationData.credentials?.apiKey) {
        const existingIntegrations = await storage.getApiIntegrationsByUser(req.user.id);
        const existingIntegration = existingIntegrations.find(integration => 
          integration.provider === integrationData.provider && 
          integration.credentials?.apiKey === integrationData.credentials?.apiKey &&
          // For Alpaca, also check account type (paper vs live)
          (integrationData.provider !== 'alpaca' || 
            integration.credentials?.additionalFields?.accountType === integrationData.credentials?.additionalFields?.accountType)
        );
        
        if (existingIntegration) {
          return res.status(400).json({
            message: 'Duplicate integration',
            error: `An integration for ${integrationData.provider} with the same API key already exists. Each broker account can only be added once.`
          });
        }
      }
      
      // Validate API credentials before saving if this is an Alpaca integration
      if (integrationData.provider === 'alpaca') {
        try {
          // Create a temporary API client to validate credentials
          const alpacaAPI = new AlpacaAPI({
            id: 0, // Temporary ID since we haven't created the record yet
            userId: req.user.id,
            provider: 'alpaca',
            credentials: integrationData.credentials,
            isPrimary: integrationData.isPrimary || false,
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
          integrationData.lastStatus = 'ok';
          integrationData.lastUsed = new Date(); // Use Date object, not string
        } catch (validationError) {
          console.error('API validation error:', validationError);
          return res.status(400).json({ 
            message: 'API validation error',
            error: validationError instanceof Error ? validationError.message : String(validationError)
          });
        }
      }
      
      // Parse the data using the Zod schema
      const validatedData = insertApiIntegrationSchema.parse(integrationData);
      
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
  }));

  app.put('/api/integrations/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
      
      // Prepare update data
      const updateData = { ...req.body };
      
      // Check for duplicate integrations (same provider and API key) if the API key is being changed
      if (updateData.credentials?.apiKey && 
          updateData.credentials.apiKey !== integration.credentials?.apiKey) {
        
        const existingIntegrations = await storage.getApiIntegrationsByUser(req.user.id);
        const provider = updateData.provider || integration.provider;
        
        const existingIntegration = existingIntegrations.find(otherIntegration => 
          otherIntegration.id !== id && 
          otherIntegration.provider === provider && 
          otherIntegration.credentials?.apiKey === updateData.credentials?.apiKey &&
          // For Alpaca, also check account type (paper vs live)
          (provider !== 'alpaca' || 
            otherIntegration.credentials?.additionalFields?.accountType === 
            (updateData.credentials?.additionalFields?.accountType || 
             integration.credentials?.additionalFields?.accountType))
        );
        
        if (existingIntegration) {
          return res.status(400).json({
            message: 'Duplicate integration',
            error: `An integration for ${provider} with the same API key already exists. Each broker account can only be added once.`
          });
        }
      }
      
      // If API credentials are being updated and this is an Alpaca integration, validate them
      if (integration.provider === 'alpaca' && req.body.credentials) {
        try {
          // Create a temporary API client with the new credentials to validate
          const alpacaAPI = new AlpacaAPI({
            ...integration,
            credentials: {
              ...integration.credentials,
              ...req.body.credentials
            }
          });
          
          // Perform connection validation
          const validationResult = await alpacaAPI.verifyConnection();
          
          if (!validationResult.isValid) {
            return res.status(400).json({ 
              message: 'API validation failed',
              error: validationResult.message
            });
          }
          
          // Add validation status to the update
          updateData.lastStatus = 'ok';
          updateData.lastUsed = new Date(); // Use Date object, not string
        } catch (validationError) {
          console.error('API validation error:', validationError);
          return res.status(400).json({ 
            message: 'API validation error',
            error: validationError instanceof Error ? validationError.message : String(validationError)
          });
        }
      }
      
      // If setting as primary, unset other primaries for this provider
      if (updateData.isPrimary) {
        const existingPrimary = await storage.getApiIntegrationByProviderAndUser(
          req.user.id,
          integration.provider
        );
        
        if (existingPrimary && existingPrimary.id !== id) {
          await storage.updateApiIntegration(existingPrimary.id, { isPrimary: false });
        }
      }
      
      const updatedIntegration = await storage.updateApiIntegration(id, updateData);
      res.json(updatedIntegration);
    } catch (error) {
      console.error('Update integration error:', error);
      res.status(500).json({ message: 'Error updating API integration' });
    }
  }));

  app.delete('/api/integrations/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));

  // STRATEGY ROUTES
  app.get('/api/strategies', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const strategies = await storage.getStrategiesByUser(req.user.id);
      res.json(strategies);
    } catch (error) {
      console.error('Get strategies error:', error);
      res.status(500).json({ message: 'Error fetching strategies' });
    }
  }));

  app.post('/api/strategies', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));

  app.get('/api/strategies/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));

  app.put('/api/strategies/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));

  app.delete('/api/strategies/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const strategy = await storage.getStrategy(id);
      
      if (!strategy) {
        return res.status(404).json({ message: 'Strategy not found' });
      }
      
      if (strategy.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: Not your strategy' });
      }
      
      // Get related data for logging purposes
      const relatedBacktests = await storage.getBacktestsByStrategy(id);
      const relatedDeployments = await storage.getDeploymentsByStrategy(id);
      
      // Log what will be deleted
      console.log(`Deleting strategy ${id} with ${relatedBacktests.length} backtests and ${relatedDeployments.length} deployments`);
      
      // Delete strategy and related data
      const result = await storage.deleteStrategy(id);
      
      if (result) {
        console.log(`Successfully deleted strategy ${id} and all related data`);
        res.status(204).send();
      } else {
        console.error(`Failed to delete strategy ${id}`);
        res.status(500).json({ message: 'Error deleting strategy - operation returned false' });
      }
    } catch (error) {
      console.error('Delete strategy error:', error);
      // Provide a more helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Error deleting strategy',
        details: errorMessage
      });
    }
  }));

  // BOT BUILDER ROUTES
  app.post('/api/bot-builder/generate', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));

  app.post('/api/bot-builder/explain', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));

  app.post('/api/bot-builder/optimize', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
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
  }));
  
  // Screen Builder API routes
  app.post('/api/screen-builder/generate', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      const result = await generateScreen(prompt);
      
      // Format the response in the expected structure
      res.json({
        screenCode: result.screen,
        explanation: result.explanation,
        name: `Generated Screen - ${new Date().toLocaleDateString()}`,
        description: prompt.length > 100 ? `${prompt.substring(0, 100)}...` : prompt,
        configuration: {
          ...result.configuration,
          assets: result.configuration?.assets || []
        }
      });
    } catch (error) {
      console.error('Generate screen error:', error);
      res.status(500).json({ 
        message: `Failed to generate screen: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }));
  
  app.post('/api/screen-builder/explain', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: 'Code is required' });
      }
      
      const explanation = await explainScreen(code);
      res.json({ explanation });
    } catch (error) {
      console.error('Explain screen error:', error);
      res.status(500).json({ 
        message: `Failed to explain screen: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }));

  // WEBHOOK ROUTES

  // Process external webhook requests (no auth middleware)
  app.post('/api/external-webhook/:token', async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      const signature = req.headers['x-signature'] as string;
      const ip = req.ip || req.socket.remoteAddress || '';
      
      // Process the webhook
      const result = await processWebhook(token, req.body, ip, signature);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ 
        success: false,
        message: 'Internal server error processing webhook',
        error: String(error)
      });
    }
  });

  // BACKTEST ROUTES
  app.post('/api/backtests', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
      
      // Create the backtest in the database with status 'queued'
      const backtest = await storage.createBacktest(validatedData);
      
      // Immediately send a response to the client with the created backtest
      res.status(202).json(backtest);
      
      // Get API integration for backtest
      try {
        // Update status to running
        await storage.updateBacktest(backtest.id, { status: 'running' });
        console.log(`Backtest ${backtest.id} status set to running`);
        
        // Get the requested data provider from configuration or default to alpaca
        const dataProvider = backtest.configuration.dataProvider || 'alpaca';
        console.log(`Using ${dataProvider} data provider for backtest ${backtest.id}`);
        
        // Initialize progress
        await storage.updateBacktest(backtest.id, {
          progress: {
            percentComplete: 0,
            currentStep: 'Initializing',
            stepsCompleted: 0,
            totalSteps: 100,
            estimatedTimeRemaining: backtest.configuration.initialCapital > 100000 ? 30 : 15, // Initial estimate
            startedAt: new Date().toISOString(),
            processingSpeed: 0
          }
        });
        
        // Progress tracking function
        const updateProgress = async (progress: any) => {
          await storage.updateBacktest(backtest.id, { progress });
        };
        
        let results;
        
        // Get appropriate API integration based on provider
        if (dataProvider === 'alpaca') {
          const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
          const alpacaAPI = new AlpacaAPI(alpacaIntegration);
          
          // Run the backtest with alpaca data
          console.log(`Running backtest ${backtest.id} with Alpaca API`);
          results = await alpacaAPI.runBacktest(
            strategy.source.content,
            backtest.configuration,
            updateProgress
          );
        } else {
          try {
            // Get user's integration for polygon if selected
            let integration = undefined;
            if (dataProvider === 'polygon') {
              // Try with exact provider name first
              integration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'polygon');
              
              // If not found, try with variations (case insensitive, with spaces, etc)
              if (!integration) {
                const allIntegrations = await storage.getApiIntegrationsByUser(req.user.id);
                integration = allIntegrations.find(i => 
                  i.provider.toLowerCase().trim() === 'polygon' || 
                  i.provider.toLowerCase().includes('polygon.io'));
                
                if (integration) {
                  console.log(`Found Polygon.io integration with provider name: "${integration.provider}"`);
                }
              }
            } 
            // Yahoo doesn't need an integration
              
            // Create the appropriate market data provider
            const provider = createMarketDataProvider(dataProvider, integration);
            
            // Check if provider is valid
            if (!provider.isValid) {
              if (dataProvider === 'polygon') {
                throw new Error(`To use Polygon.io as a data provider, you need to add a valid Polygon.io API key in the Integrations page.`);
              } else {
                throw new Error(`Invalid market data provider: ${dataProvider}`);
              }
            }
            
            // Run the backtest with the selected provider
            console.log(`Running backtest ${backtest.id} with ${dataProvider} data provider`);
            results = await runBacktest(
              provider,
              strategy.source.content,
              backtest.configuration,
              updateProgress
            );
          } catch (error) {
            console.error(`Error with data provider ${dataProvider}:`, error);
            throw error; // Re-throw to be caught by the outer catch
          }
        }
        
        console.log(`Backtest ${backtest.id} completed, updating results`);
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
        console.log(`Backtest ${backtest.id} completed successfully`);
      } catch (error) {
        console.error('Backtest execution error:', error);
        await storage.updateBacktest(backtest.id, {
          status: 'failed',
          error: (error instanceof Error) ? error.message : 'Unknown error during backtest execution',
          completedAt: new Date()
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Create backtest error:', error);
      res.status(500).json({ message: 'Error creating backtest' });
    }
  }));

  app.get('/api/backtests/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));
  
  app.put('/api/backtests/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
      
      // For status updates to 'cancelled', only allow if backtest is running or queued
      if (req.body.status === 'cancelled' && (backtest.status !== 'running' && backtest.status !== 'queued')) {
        return res.status(400).json({ message: 'Cannot cancel a backtest that is not running or queued' });
      }
      
      // For renaming, ensure we're not modifying other fields for completed backtests
      let updateData = { ...req.body };
      
      // If backtest is completed/failed and only name is being changed, only update the name
      if ((backtest.status === 'completed' || backtest.status === 'failed') && req.body.name) {
        updateData = { name: req.body.name };
      }
      
      const updatedBacktest = await storage.updateBacktest(id, {
        ...updateData,
        // If cancelling, set completedAt
        ...(req.body.status === 'cancelled' ? { completedAt: new Date() } : {})
      });
      
      res.json(updatedBacktest);
    } catch (error) {
      console.error('Update backtest error:', error);
      res.status(500).json({ message: 'Error updating backtest' });
    }
  }));
  
  app.delete('/api/backtests/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
      
      // Delete the backtest
      const deleted = await storage.deleteBacktest(id);
      
      if (deleted) {
        res.status(204).end();
      } else {
        res.status(500).json({ message: 'Failed to delete backtest' });
      }
    } catch (error) {
      console.error('Delete backtest error:', error);
      res.status(500).json({ message: 'Error deleting backtest' });
    }
  }));

  app.get('/api/backtests', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));

  // DEPLOYMENT (LIVE TRADING) ROUTES
  app.post('/api/deployments', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));

  app.get('/api/deployments', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));

  app.get('/api/deployments/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));

  app.put('/api/deployments/:id', authMiddleware, createAuthHandler(async (req: AuthRequest, res: Response) => {
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
  }));

  // MARKET DATA ROUTES
  app.get('/api/market-data/quote/:symbol', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Use the utility function for market hours check and cache headers
      const { isLikelyMarketHours, isPreMarketHours, isAfterMarketHours, isWeekend } = handleMarketDataCaching(req, res, 'single quote');
      const { symbol } = req.params;
      if (!symbol) {
        return res.status(400).json({ message: 'Symbol is required' });
      }
      
      // Get the provider from query parameters, default to alpaca
      const providerParam = req.query.provider as string;
      // Store original provider name for user messages
      const originalProvider = providerParam || 'alpaca';
      // Convert to lowercase for consistency in the code
      const provider = originalProvider.toLowerCase();
      console.log(`Using provider: ${originalProvider} for quote data`);
      
      // Get all integrations for this user
      let integration;
      try {
        // Get all integrations
        const integrations = await storage.getApiIntegrationsByUser(req.user.id);
        // Find matching integration (case insensitive)
        integration = integrations.find(i => 
          i.provider.toLowerCase().trim() === provider.trim());
        
        if (integration) {
          console.log(`Using user's ${integration.provider} API integration`);
        } else {
          console.log(`No user-specific ${originalProvider} integration found, using environment variables`);
        }
      } catch (err: unknown) {
        console.log(`Error finding ${originalProvider} integration:`, err);
      }
      
      // Use the factory to create the appropriate provider
      const dataProvider = MarketDataProviderFactory.createProvider(provider, integration);
      
      if (!dataProvider || !dataProvider.isValid()) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid or unconfigured data provider: ${originalProvider}. Please add API credentials in Integrations.` 
        });
      }
      
      try {
        // Get quote data from the provider
        const quoteData = await dataProvider.getQuote(symbol);
        
        // Add the data source to the response
        quoteData.dataSource = originalProvider;
        
        res.json(quoteData);
        return;
      } catch (providerError) {
        console.error(`Error getting quote for ${symbol} from ${originalProvider}:`, providerError);
        
        // Try Yahoo Finance as a fallback for all providers except Yahoo itself
        if (provider !== 'yahoo') {
          try {
            console.log(`Falling back to Yahoo Finance for ${symbol}`);
            const yahooProvider = MarketDataProviderFactory.createProvider('yahoo');
            if (yahooProvider) {
              const yahooQuoteData = await yahooProvider.getQuote(symbol);
              yahooQuoteData.dataSource = 'yahoo';
              res.json(yahooQuoteData);
              return;
            }
          } catch (yahooError) {
            console.error(`Yahoo Finance fallback error for ${symbol}:`, yahooError);
          }
        }
        
        try {
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
        } catch (referenceError) {
          console.error('Reference data error:', referenceError);
          res.status(500).json({ message: 'Error creating quote data' });
        }
      }
    } catch (error) {
      console.error('Get quote error:', error);
      res.status(500).json({ message: 'Error fetching quote' });
    }
  });

  // Batch quotes endpoint for fallback polling
  app.get('/api/market-data/quotes', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Use the utility function for market hours check and cache headers
      const { isLikelyMarketHours, isPreMarketHours, isAfterMarketHours, isWeekend } = handleMarketDataCaching(req, res, 'batch quotes');
      
      const symbolsParam = req.query.symbols as string;
      if (!symbolsParam) {
        return res.status(400).json({ message: 'Symbols parameter is required' });
      }
      
      // Split the symbols parameter and create an array of symbols
      const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
      if (symbols.length === 0) {
        return res.status(400).json({ message: 'At least one symbol is required' });
      }
      
      // Get the provider from query parameters, default to alpaca
      const providerParam = req.query.provider as string;
      const originalProvider = providerParam || 'alpaca';
      const provider = originalProvider.toLowerCase();
      console.log(`Using provider: ${originalProvider} for batch quotes data`);
      
      // Get all integrations for this user
      let integration;
      
      // Try all available data providers in order of priority
      const quotes = [];
      const errors = [];
      let anySuccessful = false;
      
      // Track market status
      let marketStatus = {
        isMarketOpen: false,
        dataSource: 'unknown'
      };
      
      // Try Alpaca first (during market hours)
      const isMarketOpen = await yahooFinance.isMarketOpen();
      marketStatus.isMarketOpen = isMarketOpen;
      
      if (isMarketOpen && (provider === 'alpaca' || provider === 'any')) {
        try {
          // Get user's Alpaca integration if available
          const integrations = await storage.getApiIntegrationsByUser(req.user.id);
          const alpacaIntegration = integrations.find(i => i.provider.toLowerCase().trim() === 'alpaca');
          
          let alpacaAPI;
          if (alpacaIntegration) {
            alpacaAPI = new AlpacaAPI(alpacaIntegration);
            console.log(`Using user's ${alpacaIntegration.provider} API integration for batch quotes`);
          } else {
            // Fall back to environment variables
            alpacaAPI = new AlpacaAPI();
            console.log('Using environment variables for Alpaca API for batch quotes');
          }
          
          // Batch fetch quotes from Alpaca
          const batchQuotes = await alpacaAPI.getBatchQuotes(symbols);
          if (batchQuotes && batchQuotes.length > 0) {
            quotes.push(...batchQuotes);
            anySuccessful = true;
            marketStatus.dataSource = 'alpaca';
          }
        } catch (alpacaError) {
          console.error('Alpaca API error for batch quotes:', alpacaError);
          errors.push({ provider: 'alpaca', error: alpacaError.message });
        }
      }
      
      // Try Yahoo Finance next
      if ((!anySuccessful && (provider === 'yahoo' || provider === 'any')) || provider === 'yahoo') {
        try {
          console.log('Using Yahoo Finance API for batch quotes');
          const remainingSymbols = symbols.filter(symbol => !quotes.some(q => q.symbol === symbol));
          
          // Batch fetch quotes from Yahoo Finance
          const yahooQuotes = await yahooFinance.getBatchQuotes(remainingSymbols);
          if (yahooQuotes && yahooQuotes.length > 0) {
            quotes.push(...yahooQuotes);
            anySuccessful = true;
            marketStatus.dataSource = marketStatus.dataSource === 'unknown' ? 'yahoo' : marketStatus.dataSource;
          }
        } catch (yahooError) {
          console.error('Yahoo Finance API error for batch quotes:', yahooError);
          errors.push({ provider: 'yahoo', error: yahooError.message });
        }
      }
      
      // If we still don't have data, use reference data
      if (!anySuccessful) {
        try {
          console.log('Using reference data for batch quotes');
          
          // Define reference data for common stocks
          const referencePrices: Record<string, { price: number, name: string, exchange: string }> = {
            'SPY': { price: 503.10, name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE' },
            'QQQ': { price: 436.89, name: 'Invesco QQQ Trust', exchange: 'NASDAQ' },
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
          };
          
          const missingSymbols = symbols.filter(symbol => !quotes.some(q => q.symbol === symbol));
          
          missingSymbols.forEach(symbol => {
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
            
            quotes.push({
              symbol: upperSymbol,
              name: name,
              price: currentPrice,
              change: parseFloat(changeAmount.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              timestamp: new Date().toISOString(),
              isSimulated: true,
              dataSource: "http-fallback"
            });
          });
          
          marketStatus.dataSource = 'reference';
        } catch (referenceError) {
          console.error('Reference data error:', referenceError);
        }
      }
      
      // Send the response
      res.json({
        quotes,
        marketStatus,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Get batch quotes error:', error);
      res.status(500).json({ message: 'Error fetching batch quotes' });
    }
  });

  app.get('/api/market-data/historical/:symbol', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Use the utility function for market hours check and cache headers
      const { isLikelyMarketHours, isPreMarketHours, isAfterMarketHours, isWeekend } = handleMarketDataCaching(req, res, 'historical');
      
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
            // Get all integrations for the user
            const integrations = await storage.getApiIntegrationsByUser(req.user.id);
            // Find the Alpaca integration using case-insensitive matching
            const alpacaIntegration = integrations.find(i => 
              i.provider.toLowerCase().trim() === 'alpaca');
            
            if (alpacaIntegration) {
              alpacaAPI = new AlpacaAPI(alpacaIntegration);
              console.log(`Using user's ${alpacaIntegration.provider} API integration for historical data`);
            } else {
              throw new Error("No Alpaca integration found");
            }
          } catch (err: unknown) {
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
      
      // Directly fetch from the default watchlist endpoint
      try {
        console.log('Legacy /api/watchlist endpoint called - fetching default watchlist');
        
        // Get all user's watchlists
        const watchlists = await storage.getWatchlistsByUser(req.user.id);
        
        // If no watchlists exist, create a default one with the /api/watchlists/default endpoint
        if (watchlists.length === 0) {
          console.log('No watchlists found, redirecting to default watchlist creation');
          const defaultResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/watchlists/default`, {
            headers: {
              'Authorization': req.headers.authorization || '',
            },
          });
          
          if (defaultResponse.ok) {
            const defaultWatchlist = await defaultResponse.json();
            // Return the items from the default watchlist
            console.log(`Created default watchlist with ${defaultWatchlist.items?.length || 0} items`);
            return res.json(defaultWatchlist.items || []);
          } else {
            console.error('Error response from default watchlist creation:', await defaultResponse.text());
            return res.json([]);
          }
        }
        
        // Find the default watchlist or use the first one
        const defaultWatchlist = watchlists.find(w => w.isDefault) || watchlists[0];
        
        // Get items for this watchlist
        const items = await storage.getWatchlistItemsByWatchlistId(defaultWatchlist.id);
        console.log(`Found ${items.length} items in default/first watchlist (ID: ${defaultWatchlist.id})`);
        
        return res.json(items);
      } catch (error) {
        console.error('Error in legacy watchlist endpoint:', error);
        return res.json([]);
      }
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
      
      // First, check if we have a default watchlist
      try {
        // First, try to find the default watchlist for the user
        const getUserWatchlistsResponse = await fetch(`http://localhost:5000/api/watchlists`, {
          headers: {
            'Authorization': req.headers.authorization || '',
          },
        });
        
        let defaultWatchlistId: number;
        
        if (getUserWatchlistsResponse.ok) {
          const userWatchlists = await getUserWatchlistsResponse.json();
          // Look for a default watchlist
          const defaultWatchlist = userWatchlists.find((w: any) => w.isDefault);
          
          if (defaultWatchlist) {
            defaultWatchlistId = defaultWatchlist.id;
          } else if (userWatchlists.length > 0) {
            // If no default but watchlists exist, use the first one
            defaultWatchlistId = userWatchlists[0].id;
          } else {
            // No watchlists at all, create default
            throw new Error('No watchlists found');
          }
        } else {
          throw new Error('Failed to get user watchlists');
        }
        
        // Add the item to the selected watchlist
        const newItemResponse = await fetch(`http://localhost:5000/api/watchlists/${defaultWatchlistId}/items`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.authorization || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: validatedData.symbol,
            name: validatedData.name,
            type: validatedData.type,
            exchange: validatedData.exchange || 'NYSE'
          })
        });
        
        if (newItemResponse.ok) {
          const newItem = await newItemResponse.json();
          return res.status(201).json(newItem);
        } else {
          throw new Error('Failed to add item to watchlist');
        }
      } catch (error) {
        console.error('Error with multiple watchlists API:', error);
        // Fall back to legacy method if watchlist API fails
        const watchlistItem = await storage.addToWatchlist(validatedData);
        res.status(201).json(watchlistItem);
      }
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
  
  // Portfolio history endpoint
  app.get('/api/trading/portfolio/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { period = '1M', timeframe = '1D', accountId } = req.query;
      
      // Try to get API integration for trading
      try {
        let alpacaAPI;
        let historyData;
        let dataSource = "alpaca";
        
        // First try with the specified account or user integration
        try {
          // If accountId is provided, get that specific integration
          if (accountId) {
            try {
              const integration = await storage.getApiIntegration(parseInt(accountId as string, 10));
              if (integration && integration.provider === 'alpaca') {
                alpacaAPI = new AlpacaAPI(integration);
                console.log(`Using specific Alpaca API integration (ID: ${accountId}) for portfolio history`);
              } else {
                throw new Error(`No valid Alpaca integration found for ID: ${accountId}`);
              }
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              console.log(`Error getting specific integration: ${errorMessage}`);
              throw err;
            }
          } else {
            // Otherwise get the default one for the user
            try {
              // Get all integrations for the user
              const integrations = await storage.getApiIntegrationsByUser(req.user.id);
              // Find the Alpaca integration using case-insensitive matching
              const alpacaIntegration = integrations.find(i => 
                i.provider.toLowerCase().trim() === 'alpaca');
              
              if (alpacaIntegration) {
                alpacaAPI = new AlpacaAPI(alpacaIntegration);
                console.log(`Using user's ${alpacaIntegration.provider} API integration for portfolio history`);
              } else {
                throw new Error("No Alpaca integration found");
              }
            } catch (err) {
              console.log("No user-specific Alpaca integration found, using environment variables for portfolio history");
              alpacaAPI = new AlpacaAPI();
            }
          }
          
          // Get portfolio history from Alpaca
          historyData = await alpacaAPI.getPortfolioHistory(
            period as string, 
            timeframe as string
          );
          
          if (historyData.timestamp.length === 0) {
            // If we get no data points, consider it an error and try fallback
            throw new Error("No data points returned from Alpaca");
          }
          
          console.log(`Retrieved portfolio history with ${historyData.timestamp.length} data points from Alpaca`);
        } catch (alpacaError) {
          // If Alpaca fails, try Yahoo Finance for some basic data (won't have account-specific info)
          console.log("Alpaca API failed, trying Yahoo Finance as fallback");
          
          try {
            const yahooAPI = new YahooFinanceAPI();
            const spyData = await yahooAPI.getHistoricalData("SPY", period as string, "100");
            
            if (spyData && spyData.bars && spyData.bars.length > 0) {
              // Transform SPY data into portfolio history format
              const timestamps = spyData.bars.map((bar: any) => new Date(bar.timestamp).toISOString());
              const equity = spyData.bars.map((bar: any) => bar.close);
              
              // Calculate percent changes
              const changes = [];
              const pctChanges = [];
              const baseValue = equity[0];
              
              for (let i = 0; i < equity.length; i++) {
                changes.push(equity[i] - baseValue);
                pctChanges.push((equity[i] / baseValue - 1) * 100);
              }
              
              historyData = {
                timestamp: timestamps,
                equity: equity,
                profitLoss: changes,
                profitLossPct: pctChanges,
                baseValue: baseValue
              };
              
              dataSource = "yahoo-fallback";
              console.log(`Using S&P 500 data as a proxy for portfolio history with ${timestamps.length} data points`);
            } else {
              throw new Error("No fallback data available from Yahoo Finance");
            }
          } catch (yahooError) {
            console.error("Yahoo Finance fallback also failed:", yahooError);
            
            // Create minimal dummy data for UI
            const now = new Date();
            const timestamps = [];
            const equity = [];
            const profitLoss = [];
            const profitLossPct = [];
            
            // Generate some timestamps over the requested period
            const daysToInclude = period === '1D' ? 1 : 
                                 period === '5D' ? 5 : 
                                 period === '1M' ? 30 : 
                                 period === '3M' ? 90 : 
                                 period === '1Y' ? 365 : 180;
            
            for (let i = 0; i < daysToInclude; i++) {
              const date = new Date();
              date.setDate(now.getDate() - (daysToInclude - i));
              timestamps.push(date.toISOString());
              equity.push(0);
              profitLoss.push(0);
              profitLossPct.push(0);
            }
            
            historyData = {
              timestamp: timestamps,
              equity: equity,
              profitLoss: profitLoss,
              profitLossPct: profitLossPct,
              baseValue: 0
            };
            
            dataSource = "unavailable";
            console.log(`All data sources failed, returning empty data structure with ${timestamps.length} timestamps`);
          }
        }
        
        // Format the response for the frontend
        res.json({
          period,
          timeframe,
          timestamp: historyData.timestamp,
          equity: historyData.equity,
          profitLoss: historyData.profitLoss,
          profitLossPct: historyData.profitLossPct,
          baseValue: historyData.baseValue,
          dataSource: dataSource
        });
      } catch (error: unknown) {
        console.error('Error fetching portfolio history:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Return an empty dataset rather than an error
        const dummyData = {
          period,
          timeframe,
          timestamp: [],
          equity: [],
          profitLoss: [],
          profitLossPct: [],
          baseValue: 0,
          dataSource: "error",
          error: errorMessage
        };
        
        res.json(dummyData);
      }
    } catch (error) {
      console.error('Error in portfolio history API:', error);
      
      // Return an empty dataset with error info
      res.json({ 
        period: req.query.period || '1M',
        timeframe: req.query.timeframe || '1D',
        timestamp: [],
        equity: [],
        profitLoss: [],
        profitLossPct: [],
        baseValue: 0,
        dataSource: "error",
        error: 'Failed to process portfolio history request'
      });
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
          // Get all integrations for the user
          const integrations = await storage.getApiIntegrationsByUser(req.user.id);
          // Find the Alpaca integration using case-insensitive matching
          const alpacaIntegration = integrations.find(i => 
            i.provider.toLowerCase().trim() === 'alpaca');
          
          if (alpacaIntegration) {
            alpacaAPI = new AlpacaAPI(alpacaIntegration);
            console.log(`Using user's ${alpacaIntegration.provider} API integration for orders`);
          } else {
            throw new Error("No Alpaca integration found");
          }
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
      
      // Check for parameters
      const accountId = req.query.accountId as string;
      const positionStatus = req.query.status as string || 'open'; // Default to open positions
      const startDate = req.query.startDate as string || ''; // Optional start date in YYYY-MM-DD format
      const endDate = req.query.endDate as string || ''; // Optional end date in YYYY-MM-DD format
      
      // Try to get API integration for trading
      try {
        let alpacaAPI;
        
        // If accountId is specified, use that specific integration
        if (accountId) {
          try {
            // Get all user's integrations
            const integrations = await storage.getApiIntegrationsByUser(req.user.id);
            
            // Find the integration that corresponds to the requested account
            // For demo purposes, we can differentiate as follows:
            // Integration ID 11 - Nancy's account (no positions)
            // Integration ID 12 - Beau's account (has positions)
            let integration;
            
            if (accountId === '11') {
              integration = integrations.find(i => i.id === 11);
              console.log("Using Nancy's Alpaca integration (ID 11)");
              
              // Return empty positions for Nancy's account
              return res.json([]);
              
            } else if (accountId === '12') {
              integration = integrations.find(i => i.id === 12);
              console.log("Using Beau's Alpaca integration (ID 12)");
              alpacaAPI = new AlpacaAPI(integration);
            } else {
              // Default fallback
              const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
              alpacaAPI = new AlpacaAPI(alpacaIntegration);
              console.log("Using default Alpaca integration");
            }
          } catch (err) {
            console.log("Error finding specific account integration:", err);
            // Fallback to default
            const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
            alpacaAPI = new AlpacaAPI(alpacaIntegration);
          }
        } else {
          // No accountId specified, use default
          const alpacaIntegration = await storage.getApiIntegrationByProviderAndUser(req.user.id, 'alpaca');
          alpacaAPI = new AlpacaAPI(alpacaIntegration);
          console.log("Using user's Alpaca API integration for positions");
        }
        
        // Determine which positions to fetch based on the status
        let positions: any[] = [];
        
        if (positionStatus === 'closed') {
          // Fetch closed positions with a 90-day lookback by default
          const closedPositions = await alpacaAPI.getClosedPositions(startDate || undefined, endDate || undefined, 100);
          console.log(`Retrieved ${closedPositions.length} closed positions from Alpaca`);
          
          // Format closed positions for frontend
          positions = closedPositions.map((position: any) => ({
            symbol: position.symbol,
            assetName: position.symbol, // Alpaca doesn't provide name, just symbol
            quantity: parseFloat(position.qty),
            averageEntryPrice: parseFloat(position.avg_entry_price || 0),
            exitPrice: parseFloat(position.avg_exit_price || 0),
            costBasis: parseFloat(position.cost_basis || 0),
            realizedPnL: parseFloat(position.profit_loss || 0),
            realizedPnLPercent: (parseFloat(position.profit_loss || 0) / parseFloat(position.cost_basis || 1)) * 100,
            entryDate: position.entered_at,
            exitDate: position.closed_at,
            positionStatus: 'closed'
          }));
        } else if (positionStatus === 'all') {
          // Fetch both open and closed positions (with 90-day lookback for closed positions by default)
          const openPositions = await alpacaAPI.getPositions();
          const closedPositions = await alpacaAPI.getClosedPositions(startDate || undefined, endDate || undefined, 100);
          
          console.log(`Retrieved ${openPositions.length} open positions and ${closedPositions.length} closed positions from Alpaca`);
          
          // Format open positions for frontend
          const formattedOpenPositions = openPositions.map((position: any) => ({
            symbol: position.symbol,
            assetName: position.symbol, // Alpaca doesn't provide name, just symbol
            quantity: parseFloat(position.qty),
            averageEntryPrice: parseFloat(position.avg_entry_price || 0),
            marketValue: parseFloat(position.market_value || 0),
            costBasis: parseFloat(position.cost_basis || 0),
            unrealizedPnL: parseFloat(position.unrealized_pl || 0),
            unrealizedPnLPercent: parseFloat(position.unrealized_plpc || 0) * 100,
            currentPrice: parseFloat(position.current_price || 0),
            positionStatus: 'open'
          }));
          
          // Format closed positions for frontend
          const formattedClosedPositions = closedPositions.map((position: any) => ({
            symbol: position.symbol,
            assetName: position.symbol, // Alpaca doesn't provide name, just symbol
            quantity: parseFloat(position.qty),
            averageEntryPrice: parseFloat(position.avg_entry_price || 0),
            exitPrice: parseFloat(position.avg_exit_price || 0),
            costBasis: parseFloat(position.cost_basis || 0),
            realizedPnL: parseFloat(position.profit_loss || 0),
            realizedPnLPercent: (parseFloat(position.profit_loss || 0) / parseFloat(position.cost_basis || 1)) * 100,
            entryDate: position.entered_at,
            exitDate: position.closed_at,
            positionStatus: 'closed'
          }));
          
          positions = [...formattedOpenPositions, ...formattedClosedPositions];
        } else {
          // Default to open positions
          const openPositions = await alpacaAPI.getPositions();
          console.log(`Retrieved ${openPositions.length} open positions from Alpaca`);
          
          // Format open positions for frontend
          positions = openPositions.map((position: any) => ({
            symbol: position.symbol,
            assetName: position.symbol, // Alpaca doesn't provide name, just symbol
            quantity: parseFloat(position.qty),
            averageEntryPrice: parseFloat(position.avg_entry_price || 0),
            marketValue: parseFloat(position.market_value || 0),
            costBasis: parseFloat(position.cost_basis || 0),
            unrealizedPnL: parseFloat(position.unrealized_pl || 0),
            unrealizedPnLPercent: parseFloat(position.unrealized_plpc || 0) * 100,
            currentPrice: parseFloat(position.current_price || 0),
            positionStatus: 'open'
          }));
        }
        
        res.json(positions);
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
      // Try to get top gainers from Yahoo Finance (already includes dataSource field)
      // Changed limit from 5 to 10 as requested
      let gainers = await yahooFinance.getTopGainers(10);
      console.log('Fetched gainers:', gainers);
      
      // If we have no real data from Yahoo, use real reference data
      if (gainers.length === 0) {
        console.log('API did not return any gainers, using reference data');
        // These are real stock tickers with realistic values
        gainers = [
          { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 938.46, change: 13.76, changePercent: 1.49, dataSource: "reference" },
          { symbol: 'MRVL', name: 'Marvell Technology, Inc.', price: 72.35, change: 4.18, changePercent: 6.13, dataSource: "reference" },
          { symbol: 'PANW', name: 'Palo Alto Networks Inc', price: 311.78, change: 9.52, changePercent: 3.15, dataSource: "reference" },
          { symbol: 'AMD', name: 'Advanced Micro Devices Inc', price: 175.24, change: 4.83, changePercent: 2.83, dataSource: "reference" },
          { symbol: 'AVGO', name: 'Broadcom Inc', price: 1374.75, change: 25.93, changePercent: 1.92, dataSource: "reference" },
          { symbol: 'MSFT', name: 'Microsoft Corporation', price: 424.57, change: 5.83, changePercent: 1.39, dataSource: "reference" },
          { symbol: 'AAPL', name: 'Apple Inc.', price: 171.15, change: 2.25, changePercent: 1.33, dataSource: "reference" },
          { symbol: 'META', name: 'Meta Platforms Inc', price: 504.22, change: 6.34, changePercent: 1.27, dataSource: "reference" },
          { symbol: 'AMZN', name: 'Amazon.com Inc', price: 183.26, change: 2.14, changePercent: 1.18, dataSource: "reference" },
          { symbol: 'GOOG', name: 'Alphabet Inc', price: 164.32, change: 1.87, changePercent: 1.15, dataSource: "reference" }
        ];
      }
      
      res.json(gainers);
    } catch (error) {
      console.error('Yahoo Finance API error for top gainers:', error);
      
      // Return reference data in case of error
      const gainers = [
        { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 938.46, change: 13.76, changePercent: 1.49, dataSource: "reference" },
        { symbol: 'MRVL', name: 'Marvell Technology, Inc.', price: 72.35, change: 4.18, changePercent: 6.13, dataSource: "reference" },
        { symbol: 'PANW', name: 'Palo Alto Networks Inc', price: 311.78, change: 9.52, changePercent: 3.15, dataSource: "reference" },
        { symbol: 'AMD', name: 'Advanced Micro Devices Inc', price: 175.24, change: 4.83, changePercent: 2.83, dataSource: "reference" },
        { symbol: 'AVGO', name: 'Broadcom Inc', price: 1374.75, change: 25.93, changePercent: 1.92, dataSource: "reference" },
        { symbol: 'MSFT', name: 'Microsoft Corporation', price: 424.57, change: 5.83, changePercent: 1.39, dataSource: "reference" },
        { symbol: 'AAPL', name: 'Apple Inc.', price: 171.15, change: 2.25, changePercent: 1.33, dataSource: "reference" },
        { symbol: 'META', name: 'Meta Platforms Inc', price: 504.22, change: 6.34, changePercent: 1.27, dataSource: "reference" },
        { symbol: 'AMZN', name: 'Amazon.com Inc', price: 183.26, change: 2.14, changePercent: 1.18, dataSource: "reference" },
        { symbol: 'GOOG', name: 'Alphabet Inc', price: 164.32, change: 1.87, changePercent: 1.15, dataSource: "reference" }
      ];
      
      res.json(gainers);
    }
  });

  app.get('/api/market-data/losers', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // Try to get top losers from Yahoo Finance (already includes dataSource field)
      // Changed limit from 5 to 10 as requested
      let losers = await yahooFinance.getTopLosers(10);
      console.log('Fetched losers:', losers);
      
      // If we have no real data from Yahoo, use real reference data
      if (losers.length === 0) {
        console.log('API did not return any losers, using reference data');
        // These are real stock tickers with realistic values
        losers = [
          { symbol: 'INTC', name: 'Intel Corporation', price: 22.71, change: -0.91, changePercent: -3.84, dataSource: "reference" },
          { symbol: 'CAT', name: 'Caterpillar Inc.', price: 329.23, change: -10.07, changePercent: -2.97, dataSource: "reference" },
          { symbol: 'BA', name: 'The Boeing Company', price: 174.45, change: -4.66, changePercent: -2.60, dataSource: "reference" },
          { symbol: 'MMM', name: '3M Company', price: 144.74, change: -3.70, changePercent: -2.49, dataSource: "reference" },
          { symbol: 'F', name: 'Ford Motor Company', price: 9.67, change: -0.24, changePercent: -2.37, dataSource: "reference" },
          { symbol: 'OXY', name: 'Occidental Petroleum Corporation', price: 48.62, change: -0.89, changePercent: -1.80, dataSource: "reference" },
          { symbol: 'GM', name: 'General Motors Company', price: 46.51, change: -0.69, changePercent: -1.46, dataSource: "reference" },
          { symbol: 'IBM', name: 'International Business Machines Corp', price: 243.07, change: -3.14, changePercent: -1.28, dataSource: "reference" },
          { symbol: 'WMT', name: 'Walmart Inc.', price: 84.98, change: -0.66, changePercent: -0.77, dataSource: "reference" },
          { symbol: 'CVX', name: 'Chevron Corporation', price: 165.97, change: -0.69, changePercent: -0.41, dataSource: "reference" }
        ];
      }
      
      res.json(losers);
    } catch (error) {
      console.error('Yahoo Finance API error for top losers:', error);
      
      // Return reference data in case of error
      const losers = [
        { symbol: 'INTC', name: 'Intel Corporation', price: 22.71, change: -0.91, changePercent: -3.84, dataSource: "reference" },
        { symbol: 'CAT', name: 'Caterpillar Inc.', price: 329.23, change: -10.07, changePercent: -2.97, dataSource: "reference" },
        { symbol: 'BA', name: 'The Boeing Company', price: 174.45, change: -4.66, changePercent: -2.60, dataSource: "reference" },
        { symbol: 'MMM', name: '3M Company', price: 144.74, change: -3.70, changePercent: -2.49, dataSource: "reference" },
        { symbol: 'F', name: 'Ford Motor Company', price: 9.67, change: -0.24, changePercent: -2.37, dataSource: "reference" },
        { symbol: 'OXY', name: 'Occidental Petroleum Corporation', price: 48.62, change: -0.89, changePercent: -1.80, dataSource: "reference" },
        { symbol: 'GM', name: 'General Motors Company', price: 46.51, change: -0.69, changePercent: -1.46, dataSource: "reference" },
        { symbol: 'IBM', name: 'International Business Machines Corp', price: 243.07, change: -3.14, changePercent: -1.28, dataSource: "reference" },
        { symbol: 'WMT', name: 'Walmart Inc.', price: 84.98, change: -0.66, changePercent: -0.77, dataSource: "reference" },
        { symbol: 'CVX', name: 'Chevron Corporation', price: 165.97, change: -0.69, changePercent: -0.41, dataSource: "reference" }
      ];
      
      res.json(losers);
    }
  });

  // Alert Thresholds API Routes
  app.get('/api/alert-thresholds', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const thresholds = await storage.getAlertThresholdsByUser(req.user!.id);
      res.json(thresholds);
    } catch (error) {
      console.error('Error fetching alert thresholds:', error);
      res.status(500).json({ message: 'Error fetching alert thresholds' });
    }
  });

  app.get('/api/alert-thresholds/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const threshold = await storage.getAlertThreshold(Number(req.params.id));
      
      if (!threshold) {
        return res.status(404).json({ message: 'Alert threshold not found' });
      }
      
      // Check if the threshold belongs to the user
      if (threshold.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to access this alert threshold' });
      }
      
      res.json(threshold);
    } catch (error) {
      console.error('Error fetching alert threshold:', error);
      res.status(500).json({ message: 'Error fetching alert threshold' });
    }
  });

  app.post('/api/alert-thresholds', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertAlertThresholdSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      const threshold = await storage.createAlertThreshold(validatedData);
      res.status(201).json(threshold);
    } catch (error) {
      console.error('Error creating alert threshold:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid alert threshold data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error creating alert threshold' });
    }
  });

  app.put('/api/alert-thresholds/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const threshold = await storage.getAlertThreshold(id);
      
      if (!threshold) {
        return res.status(404).json({ message: 'Alert threshold not found' });
      }
      
      // Check if the threshold belongs to the user
      if (threshold.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to update this alert threshold' });
      }
      
      // Remove userId from update data (can't change owner)
      const { userId, ...updateData } = req.body;
      
      const updatedThreshold = await storage.updateAlertThreshold(id, updateData);
      res.json(updatedThreshold);
    } catch (error) {
      console.error('Error updating alert threshold:', error);
      res.status(500).json({ message: 'Error updating alert threshold' });
    }
  });

  app.delete('/api/alert-thresholds/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const threshold = await storage.getAlertThreshold(id);
      
      if (!threshold) {
        return res.status(404).json({ message: 'Alert threshold not found' });
      }
      
      // Check if the threshold belongs to the user
      if (threshold.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to delete this alert threshold' });
      }
      
      await storage.deleteAlertThreshold(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting alert threshold:', error);
      res.status(500).json({ message: 'Error deleting alert threshold' });
    }
  });

  // Notifications API Routes
  app.get('/api/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const isRead = req.query.isRead ? req.query.isRead === 'true' : undefined;
      
      const notifications = await storage.getNotificationsByUser(req.user!.id, {
        limit,
        offset,
        isRead
      });
      
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Error fetching notifications' });
    }
  });

  app.get('/api/notifications/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const notification = await storage.getNotification(Number(req.params.id));
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      // Check if the notification belongs to the user
      if (notification.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to access this notification' });
      }
      
      res.json(notification);
    } catch (error) {
      console.error('Error fetching notification:', error);
      res.status(500).json({ message: 'Error fetching notification' });
    }
  });

  app.put('/api/notifications/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const notification = await storage.getNotification(id);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      // Check if the notification belongs to the user
      if (notification.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to update this notification' });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Error marking notification as read' });
    }
  });

  app.put('/api/notifications/mark-all-read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead(req.user!.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Error marking all notifications as read' });
    }
  });

  app.delete('/api/notifications/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const notification = await storage.getNotification(id);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      // Check if the notification belongs to the user
      if (notification.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to delete this notification' });
      }
      
      await storage.deleteNotification(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ message: 'Error deleting notification' });
    }
  });

  // Market Data Provider API for Python Screeners
  
  // Get historical market data
  app.get('/api/market-data/historical', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Use the utility function for market hours check and cache headers
      const { isLikelyMarketHours, isPreMarketHours, isAfterMarketHours, isWeekend } = handleMarketDataCaching(req, res, 'historical');
      
      const symbols = req.query.symbols as string;
      const period = req.query.period as string || '3mo';
      const interval = req.query.interval as string || '1d';
      const provider = req.query.provider as string || 'yahoo';
      
      if (!symbols) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameter: symbols' 
        });
      }
      
      // Get the provider adapter
      let integration = undefined;
      
      // If provider is not yahoo (which doesn't need credentials), get the user's API integration
      if (provider !== 'yahoo') {
        try {
          integration = await storage.getApiIntegrationByProviderAndUser(req.user.id, provider);
        } catch (err) {
          console.log(`No user-specific ${provider} integration found`);
        }
      }
      
      // Use the static factory method to create the provider
      const dataProvider = MarketDataProviderFactory.createProvider(provider, integration);
      
      // Verify provider is valid
      if (!dataProvider || !dataProvider.isValid()) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid or unconfigured data provider: ${provider}. Please add API credentials in Integrations.` 
        });
      }
      
      // Get the historical data
      const symbolsList = symbols.split(',').map(s => s.trim());
      const data = await dataProvider.getHistoricalData(symbolsList, period, interval);
      
      // Format the response
      return res.status(200).json({
        success: true,
        data: {
          symbols: symbolsList,
          data,
          provider
        }
      });
      
    } catch (error) {
      console.error('Error fetching historical market data:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Get stock universe
  app.get('/api/market-data/universe', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Use the utility function for market hours check and cache headers
      const { isLikelyMarketHours, isPreMarketHours, isAfterMarketHours, isWeekend } = handleMarketDataCaching(req, res, 'stock universe');
      
      const universeType = req.query.universeType as string || 'default';
      const provider = req.query.provider as string || 'yahoo';
      
      // Get the provider adapter
      let integration = undefined;
      
      // If provider is not yahoo (which doesn't need credentials), get the user's API integration
      if (provider !== 'yahoo') {
        try {
          integration = await storage.getApiIntegrationByProviderAndUser(req.user.id, provider);
        } catch (err) {
          console.log(`No user-specific ${provider} integration found`);
        }
      }
      
      // Initialize the provider factory
      // Use the static factory method to create the provider
      const dataProvider = MarketDataProviderFactory.createProvider(provider, integration);
      // Verify provider is valid
      if (!dataProvider || !dataProvider.isValid()) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid or unconfigured data provider: ${provider}. Please add API credentials in Integrations.` 
        });
      }
      
      // Get the stock universe
      const symbols = await dataProvider.getStockUniverse(universeType);
      
      // Format the response
      return res.status(200).json({
        success: true,
        symbols,
        universeType,
        provider,
        marketStatus: {
          isRegularHours: isLikelyMarketHours,
          isPreMarketHours,
          isAfterMarketHours, 
          isWeekend
        }
      });
      
    } catch (error) {
      console.error('Error fetching stock universe:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Check market status
  app.get('/api/market-data/status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      // Use the utility function for market hours check and cache headers
      const { isLikelyMarketHours, isPreMarketHours, isAfterMarketHours, isWeekend } = handleMarketDataCaching(req, res, 'market status');
      
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const provider = req.query.provider as string || 'yahoo';
      
      // Get the provider adapter
      let integration = undefined;
      
      // If provider is not yahoo (which doesn't need credentials), get the user's API integration
      if (provider !== 'yahoo') {
        try {
          integration = await storage.getApiIntegrationByProviderAndUser(req.user.id, provider);
        } catch (err) {
          console.log(`No user-specific ${provider} integration found`);
        }
      }
      
      // Use the static factory method to create the provider
      const dataProvider = MarketDataProviderFactory.createProvider(provider, integration);
      if (!dataProvider || !dataProvider.isValid()) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid or unconfigured data provider: ${provider}. Please add API credentials in Integrations.` 
        });
      }
      
      // Check if market is open
      const isMarketOpen = await dataProvider.isMarketOpen();
      
      // Calculate next market open/close times
      // This is a simplified calculation and should be replaced with actual API data when available
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      let nextMarketOpen: Date | null = null;
      let nextMarketClose: Date | null = null;
      
      // Create a date object for today at 9:30 AM (market open)
      const marketOpenToday = new Date(now);
      marketOpenToday.setHours(9, 30, 0, 0);
      
      // Create a date object for today at 4:00 PM (market close)
      const marketCloseToday = new Date(now);
      marketCloseToday.setHours(16, 0, 0, 0);
      
      if (currentDay >= 1 && currentDay <= 5) { // Weekday
        if (now < marketOpenToday) {
          // Before market open today
          nextMarketOpen = marketOpenToday;
          nextMarketClose = marketCloseToday;
        } else if (now < marketCloseToday) {
          // During market hours
          nextMarketClose = marketCloseToday;
          
          // Next open is tomorrow, or Monday if today is Friday
          const nextOpenDay = new Date(now);
          if (currentDay === 5) { // Friday
            nextOpenDay.setDate(nextOpenDay.getDate() + 3); // Skip to Monday
          } else {
            nextOpenDay.setDate(nextOpenDay.getDate() + 1); // Next day
          }
          nextOpenDay.setHours(9, 30, 0, 0);
          nextMarketOpen = nextOpenDay;
        } else {
          // After market close today
          // Next open is tomorrow, or Monday if today is Friday
          const nextOpenDay = new Date(now);
          if (currentDay === 5) { // Friday
            nextOpenDay.setDate(nextOpenDay.getDate() + 3); // Skip to Monday
          } else {
            nextOpenDay.setDate(nextOpenDay.getDate() + 1); // Next day
          }
          nextOpenDay.setHours(9, 30, 0, 0);
          nextMarketOpen = nextOpenDay;
          
          // Next close is same day as next open
          const nextCloseDay = new Date(nextOpenDay);
          nextCloseDay.setHours(16, 0, 0, 0);
          nextMarketClose = nextCloseDay;
        }
      } else { // Weekend
        // Find next Monday
        const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay; // Sunday: 1 day, Saturday: 2 days
        const nextMonday = new Date(now);
        nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
        nextMonday.setHours(9, 30, 0, 0);
        nextMarketOpen = nextMonday;
        
        // Next close is same day
        const nextCloseDay = new Date(nextMonday);
        nextCloseDay.setHours(16, 0, 0, 0);
        nextMarketClose = nextCloseDay;
      }
      
      // Format the response
      return res.status(200).json({
        success: true,
        isMarketOpen,
        provider,
        marketStatus: {
          isRegularHours: isLikelyMarketHours,
          isPreMarketHours,
          isAfterMarketHours, 
          isWeekend,
          nextMarketOpen: nextMarketOpen?.toISOString(),
          nextMarketClose: nextMarketClose?.toISOString(),
          currentTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          exchangeTimezone: 'America/New_York' // NYSE/NASDAQ are in Eastern Time
        }
      });
      
    } catch (error) {
      console.error('Error checking market status:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Direct Screener Execution (bypasses template issues)
  app.post('/api/direct-screener', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Execute the minimal pure screener directly
      // Using the imported childProcess module from the top of the file
      const pythonProcess = childProcess.spawn('python3', ['./tmp/minimal_pure_screener.py']);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data: any) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: any) => {
        errorData += data.toString();
        console.error(`[Direct Python Error] ${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          try {
            // The script should output JSON
            const result = JSON.parse(outputData);
            res.status(200).json(result);
          } catch (error) {
            console.error('Failed to parse Python script output as JSON:', outputData);
            res.status(500).json({ error: 'Invalid output from Python script' });
          }
        } else {
          res.status(500).json({ error: `Python script exited with code ${code}: ${errorData}` });
        }
      });
      
      pythonProcess.on('error', (error: Error) => {
        res.status(500).json({ error: `Failed to execute Python script: ${error.message}` });
      });
      
    } catch (error) {
      console.error('Error executing direct screener:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Parameterized Screener Execution (bypasses template issues with strategy selection)
  app.post('/api/parameterized-screener', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get strategy from request body
      const { strategy = 'momentum' } = req.body;
      
      // Execute the parameterized screener with the specified strategy
      const pythonProcess = childProcess.spawn('python3', ['./tmp/parameterized_screener.py', strategy]);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data: any) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: any) => {
        errorData += data.toString();
        console.error(`[Parameterized Python Error] ${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          try {
            // The script should output JSON
            const result = JSON.parse(outputData);
            res.status(200).json(result);
          } catch (error) {
            console.error('Failed to parse Python script output as JSON:', outputData);
            res.status(500).json({ error: 'Invalid output from Python script' });
          }
        } else {
          res.status(500).json({ error: `Python script exited with code ${code}: ${errorData}` });
        }
      });
      
      pythonProcess.on('error', (error: Error) => {
        res.status(500).json({ error: `Failed to execute Python script: ${error.message}` });
      });
      
    } catch (error) {
      console.error('Error executing parameterized screener:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Screener endpoints
  app.get('/api/screeners', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const screeners = await storage.getScreenersByUser(userId);
      return res.status(200).json(screeners);
    } catch (error) {
      console.error('Error getting screeners:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/screeners/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const screener = await storage.getScreener(id);
      
      if (!screener) {
        return res.status(404).json({ message: 'Screener not found' });
      }
      
      // Check if the screener belongs to the requesting user
      if (screener.userId !== req.user?.id) {
        return res.status(403).json({ message: 'You do not have permission to access this screener' });
      }
      
      return res.status(200).json(screener);
    } catch (error) {
      console.error('Error getting screener:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/screeners', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const screenerData = req.body;
      
      // Validate required fields
      if (!screenerData.name || !screenerData.description || !screenerData.type || !screenerData.source || !screenerData.configuration) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Add the userId to the screener data
      const newScreener = await storage.createScreener({
        ...screenerData,
        userId
      });
      
      return res.status(201).json(newScreener);
    } catch (error) {
      console.error('Error creating screener:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.put('/api/screeners/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get the existing screener
      const existingScreener = await storage.getScreener(id);
      
      if (!existingScreener) {
        return res.status(404).json({ message: 'Screener not found' });
      }
      
      // Check if the screener belongs to the requesting user
      if (existingScreener.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to update this screener' });
      }
      
      // Update the screener with the new data
      const updatedScreener = await storage.updateScreener(id, req.body);
      
      return res.status(200).json(updatedScreener);
    } catch (error) {
      console.error('Error updating screener:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.delete('/api/screeners/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get the existing screener
      const existingScreener = await storage.getScreener(id);
      
      if (!existingScreener) {
        return res.status(404).json({ message: 'Screener not found' });
      }
      
      // Check if the screener belongs to the requesting user
      if (existingScreener.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to delete this screener' });
      }
      
      // Delete the screener
      const success = await storage.deleteScreener(id);
      
      if (success) {
        return res.status(200).json({ message: 'Screener deleted successfully' });
      } else {
        return res.status(500).json({ message: 'Failed to delete screener' });
      }
    } catch (error) {
      console.error('Error deleting screener:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/screeners/:id/run', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get the existing screener
      const existingScreener = await storage.getScreener(id);
      
      if (!existingScreener) {
        return res.status(404).json({ message: 'Screener not found' });
      }
      
      // Check if the screener belongs to the requesting user
      if (existingScreener.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to run this screener' });
      }
      
      // Run the screener
      const result = await storage.runScreener(id);
      
      if (result) {
        return res.status(200).json(result);
      } else {
        return res.status(500).json({ message: 'Failed to run screener' });
      }
    } catch (error) {
      console.error('Error running screener:', error);
      return res.status(500).json({ message: 'Internal server error', error: (error as Error).message });
    }
  });

  // Webhook routes are handled by the webhookRoutes router (registered above)

  // POST /api/webhooks is handled by the webhookRoutes router

  // The GET, PUT, and DELETE endpoints for /api/webhooks/:id are handled by the webhookRoutes router

  // Public webhook endpoint (no auth required)
  app.post('/api/webhook/:token', async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      const payload = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || '';
      const signature = req.headers['x-signature'] as string;
      
      const result = await processWebhook(token, payload, clientIp, signature);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ 
        success: false, 
        message: `Server error: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  });

  // User notification settings routes
  app.get('/api/users/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get all alert thresholds for the user to derive notification settings
      const alertThresholds = await storage.getAlertThresholdsByUser(req.user.id);
      
      // Get phone number from user settings
      const user = await storage.getUser(req.user.id);
      
      // Use type assertion to access settings properly
      const userSettings = user?.settings as {
        theme: 'dark' | 'light';
        notifications: {
          email: boolean;
          push: boolean;
          sms: boolean;
        };
        phoneNumber?: string;
        defaultExchange: string;
        defaultAssets: string[];
        backtestDataProvider: 'alpaca' | 'yahoo' | 'polygon';
      } | undefined;
      
      const phoneNumber = userSettings?.phoneNumber || '';
      
      // Create a map of alert type to settings
      const alertSettings: Record<string, {
        enabled: boolean;
        channels: {
          app: boolean;
          email: boolean;
          sms: boolean;
        };
      }> = {};
      
      // Default alert types
      const defaultAlertTypes = [
        'price', 'price_change_percent', 'volume', 
        'order_placed', 'order_filled', 'order_rejected', 
        'backtest_finished', 'strategy_performance', 'market_events'
      ];
      
      // Initialize defaults for all alert types
      for (const type of defaultAlertTypes) {
        alertSettings[type] = {
          enabled: true,
          channels: {
            app: true,
            email: userSettings?.notifications?.email || false,
            sms: userSettings?.notifications?.sms || false
          }
        };
      }
      
      // Override with any custom settings from alert thresholds
      for (const threshold of alertThresholds) {
        if (threshold.type in alertSettings) {
          alertSettings[threshold.type] = {
            enabled: threshold.enabled,
            channels: {
              app: threshold.notifications.channels.includes('app'),
              email: threshold.notifications.channels.includes('email'),
              sms: threshold.notifications.channels.includes('sms')
            }
          };
        }
      }
      
      // Global settings (enabled if any notification channel is enabled)
      const globalEnabled = userSettings?.notifications?.email || 
                          userSettings?.notifications?.push || 
                          userSettings?.notifications?.sms || 
                          true;
      
      res.json({
        globalEnabled,
        phoneNumber,
        alertSettings
      });
    } catch (error) {
      console.error('Get notification settings error:', error);
      res.status(500).json({ message: 'Error retrieving notification settings' });
    }
  });
  
  app.put('/api/users/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { globalEnabled, phoneNumber, alertSettings } = req.body;
      
      // Use type assertion to access settings properly
      const currentSettings = (req.user.settings || {}) as {
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
      };
      
      // Build up the notification settings object with proper typing
      const updatedSettings = {
        theme: 'dark' as 'dark' | 'light', // Set default values
        phoneNumber,
        defaultExchange: 'alpaca',
        defaultAssets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'], 
        backtestDataProvider: 'yahoo' as 'alpaca' | 'yahoo' | 'polygon', 
        notifications: {
          email: globalEnabled,
          push: globalEnabled,
          sms: globalEnabled
        },
        // Preserve phone verification data if it exists
        phoneVerification: currentSettings.phoneVerification
      };
      
      // Override with existing user settings if available
      if (currentSettings.theme) updatedSettings.theme = currentSettings.theme;
      if (currentSettings.defaultExchange) updatedSettings.defaultExchange = currentSettings.defaultExchange;
      if (currentSettings.defaultAssets) updatedSettings.defaultAssets = currentSettings.defaultAssets;
      if (currentSettings.backtestDataProvider) updatedSettings.backtestDataProvider = currentSettings.backtestDataProvider;
      
      // Update the user's global notification settings
      const userUpdateData: Partial<User> = {
        settings: updatedSettings
      };
      
      await storage.updateUser(req.user.id, userUpdateData);
      
      // Get existing alert thresholds for the user
      const existingThresholds = await storage.getAlertThresholdsByUser(req.user.id);
      const existingThresholdByType: Record<string, AlertThreshold> = {};
      
      for (const threshold of existingThresholds) {
        existingThresholdByType[threshold.type] = threshold;
      }
      
      // Update or create alert thresholds based on the new settings
      for (const [type, settings] of Object.entries(alertSettings)) {
        // Type assertion for TypeScript
        const typedSettings = settings as { enabled: boolean, channels: { app: boolean, email: boolean, sms: boolean } };
        const alertEnabled = typedSettings.enabled;
        const channels = [];
        
        if (typedSettings.channels.app) channels.push('app');
        if (typedSettings.channels.email) channels.push('email');
        if (typedSettings.channels.sms) channels.push('sms');
        
        const notificationSettings = {
          channels,
          severity: 'medium' as 'info' | 'low' | 'medium' | 'high' | 'critical', // Default severity with correct type
          throttle: {
            enabled: false
          }
        };
        
        if (existingThresholdByType[type]) {
          // Update existing threshold
          await storage.updateAlertThreshold(existingThresholdByType[type].id, {
            enabled: alertEnabled,
            notifications: notificationSettings
          });
        } else {
          // Create a new threshold for this alert type
          const newThreshold: InsertAlertThreshold = {
            userId: req.user.id,
            name: `${type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')} Alert`,
            type,
            enabled: alertEnabled,
            conditions: {},
            notifications: notificationSettings
          };
          
          await storage.createAlertThreshold(newThreshold);
        }
      }
      
      res.json({
        globalEnabled, 
        phoneNumber,
        alertSettings,
        message: 'Notification settings updated successfully'
      });
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(500).json({ message: 'Error updating notification settings' });
    }
  });

  // Phone verification routes
  
  // Send verification code
  app.post('/api/users/verify-phone/send', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      console.log("Received phone verification request");
      const userId = req.user?.id;
      if (!userId) {
        console.log("Unauthorized request - no user ID");
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { phoneNumber } = req.body;
      console.log(`Request data: userId=${userId}, phoneNumber=${phoneNumber}`);
      
      if (!phoneNumber) {
        console.log("No phone number provided");
        return res.status(400).json({ message: 'Phone number is required' });
      }
      
      // Basic phone number validation
      const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
      if (!phoneRegex.test(phoneNumber)) {
        console.log(`Invalid phone number format: ${phoneNumber}`);
        return res.status(400).json({ 
          message: 'Invalid phone number format. Please use international format (e.g., +12025550123)' 
        });
      }
      
      console.log(`Calling sendVerificationCode for user ${userId} and phone ${phoneNumber}`);
      // Send verification code
      const result = await sendVerificationCode(userId, phoneNumber);
      console.log(`Verification code send result:`, result);
      
      if (result.success) {
        console.log("Successfully sent verification code");
        res.status(200).json({ 
          message: result.message,
          success: true
        });
      } else {
        console.log("Failed to send verification code:", result.message);
        res.status(500).json({ 
          message: result.message,
          success: false
        });
      }
    } catch (error) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ 
        message: 'Server error while sending verification code',
        success: false
      });
    }
  });

  // Verify code
  app.post('/api/users/verify-phone/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: 'Verification code is required' });
      }
      
      // Verify the code
      const result = await verifyPhoneNumber(userId, code);
      
      res.status(result.success ? 200 : 400).json({ 
        message: result.message,
        verified: result.verified,
        success: result.success
      });
    } catch (error) {
      console.error("Error verifying phone number:", error);
      res.status(500).json({ 
        message: 'Server error while verifying phone number',
        success: false,
        verified: false
      });
    }
  });

  // Check verification status
  app.get('/api/users/verify-phone/status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const verified = await isPhoneNumberVerified(userId);
      
      res.status(200).json({ 
        verified
      });
    } catch (error) {
      console.error("Error checking phone verification status:", error);
      res.status(500).json({ 
        message: 'Server error while checking verification status',
        verified: false
      });
    }
  });

  // Register webhook routes
  app.use('/api/webhooks', webhookRoutes);
  
  // Register bot routes
  app.use('/api/bots', authMiddleware, botRoutes);
  
  // Register SnapTrade routes
  // Create a separate router for public SnapTrade endpoints
  const publicSnapTradeRoutes = Router();
  
  // Add the public routes to the public router
  // Add the brokerages route (available without login)
  publicSnapTradeRoutes.get('/brokerages', snaptradeRoutes.stack
    .find(layer => layer.route && layer.route.path === '/brokerages')!.handle);
  
  // Add the status route (available without login)
  publicSnapTradeRoutes.get('/status', snaptradeRoutes.stack
    .find(layer => layer.route && layer.route.path === '/status')!.handle);
  
  // Register public SnapTrade routes (without auth)
  app.use('/api/snaptrade', publicSnapTradeRoutes);
  
  // Register authenticated SnapTrade routes
  app.use('/api/snaptrade', authMiddleware, snaptradeRoutes);
  
  // Register watchlist routes (all are authenticated)
  app.use('/api/watchlists', authMiddleware, watchlistRoutes);
  
  // Process webhook triggers (public endpoint)
  app.post('/api/webhook-triggers/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const payload = req.body;
      const ip = req.ip || req.socket.remoteAddress || '';
      const signature = req.headers['x-signature'] as string || '';

      const result = await processWebhook(token, payload, ip, signature);
      
      if (result.success) {
        return res.status(200).json({ message: 'Webhook processed successfully', result: result.data });
      } else {
        return res.status(400).json({ message: 'Failed to process webhook', error: result.error });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ message: 'Error processing webhook', error: (error as Error).message });
    }
  });

  return httpServer;
}
