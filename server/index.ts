import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Export currentPort for other modules to reference
export let currentPort = 5000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  log('Starting server in minimal mode with WebSocket support');
  
  // Skip Python environment initialization completely
  log('Python initialization skipped for minimal server');

  try {
    // Create minimal HTTP server with WebSocket support
    const { createServer } = await import('http');
    const { WebSocketServer } = await import('ws');
    const httpServer = createServer(app);
    
    // Initialize a minimal WebSocket server for testing
    const wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws'
    });
    
    // Log WebSocketServer creation
    log('WebSocketServer initialized with minimal configuration');
    
    // Add basic WebSocket connection handling for testing
    wss.on('connection', (ws) => {
      log('WebSocket client connected');
      
      ws.on('message', (message) => {
        log(`Received WebSocket message: ${message}`);
        
        try {
          // Try to parse as JSON and echo back with a pong
          const data = JSON.parse(message.toString());
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: data.timestamp,
              serverTime: Date.now()
            }));
          } else if (data.type === 'auth') {
            // Mock successful authentication
            ws.send(JSON.stringify({
              type: 'auth_success',
              userId: data.userId,
              serverTime: Date.now()
            }));
          } else if (data.type === 'subscribe') {
            // Mock subscription response
            ws.send(JSON.stringify({
              type: 'subscription_success',
              channel: data.channel,
              symbol: data.symbol,
              serverTime: Date.now()
            }));
            
            // Send some sample data for subscribed symbol if applicable
            if (data.symbol) {
              // Send initial data
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'market_data',
                  symbol: data.symbol,
                  data: {
                    price: 185.25,
                    change: 2.75,
                    changePercent: 1.52,
                    volume: 25436789,
                    timestamp: Date.now()
                  }
                }));
              }, 500);
              
              // Send periodic updates
              const interval = setInterval(() => {
                if (ws.readyState === 1) { // OPEN
                  const randomChange = (Math.random() - 0.5) * 0.5;
                  ws.send(JSON.stringify({
                    type: 'market_data',
                    symbol: data.symbol,
                    data: {
                      price: 185.25 + randomChange,
                      change: 2.75 + randomChange,
                      changePercent: 1.52 + (randomChange / 185.25) * 100,
                      volume: 25436789 + Math.floor(Math.random() * 10000),
                      timestamp: Date.now()
                    }
                  }));
                } else {
                  clearInterval(interval);
                }
              }, 5000);
            }
          } else {
            // Echo back any other messages
            ws.send(JSON.stringify({
              type: 'echo',
              data: data,
              serverTime: Date.now()
            }));
          }
        } catch (error) {
          // If not JSON, just echo back the raw message
          ws.send(`Echo: ${message}`);
        }
      });
      
      ws.on('close', () => {
        log('WebSocket client disconnected');
      });
      
      ws.on('error', (error) => {
        log(`WebSocket error: ${error}`);
      });
      
      // Send a welcome message
      ws.send(JSON.stringify({ 
        type: 'welcome', 
        message: 'Connected to minimal WebSocket server',
        serverTime: Date.now()
      }));
    });
    
    // Add a minimal route for health check
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', message: 'Minimal server is running with WebSocket support' });
    });
    
    // Add minimal API endpoints for the Dashboard
    app.get('/api/auth/user', (_req, res) => {
      // Mock authenticated user
      res.json({ 
        id: 1,
        username: "testuser",
        email: "test@example.com",
        name: "Test User",
        role: "user"
      });
    });
    
    app.get('/api/trading/account', (_req, res) => {
      // Mock account data
      res.json([
        {
          id: 1,
          name: "Demo Trading Account",
          type: "Paper",
          broker: "Alpaca",
          status: "ACTIVE",
          balance: 10000,
          equity: 10200,
          portfolioValue: 10200,
          performance: 200,
          buyingPower: 20000
        }
      ]);
    });
    
    app.get('/api/trading/positions', (_req, res) => {
      // Mock positions data
      res.json([
        {
          symbol: "AAPL",
          quantity: 10,
          marketValue: 1800,
          averageEntryPrice: 170,
          currentPrice: 180,
          unrealizedPL: 100,
          unrealizedPLPercent: 5.88,
          isShort: false
        },
        {
          symbol: "MSFT",
          quantity: 5,
          marketValue: 2000,
          averageEntryPrice: 380,
          currentPrice: 400,
          unrealizedPL: 100,
          unrealizedPLPercent: 5.26,
          isShort: false
        }
      ]);
    });
    
    app.get('/api/trading/orders', (_req, res) => {
      // Mock orders data
      res.json([
        {
          id: "order1",
          symbol: "AAPL",
          side: "buy",
          quantity: 5,
          filledQuantity: 5,
          type: "market",
          status: "filled",
          createdAt: new Date().toISOString(),
          filledAt: new Date().toISOString(),
          price: 175
        }
      ]);
    });
    
    app.get('/api/trading/portfolio/history', (_req, res) => {
      // Mock portfolio history data
      const now = new Date();
      const history: {
        timestamp: string[];
        equity: number[];
      } = {
        timestamp: [],
        equity: []
      };
      
      // Generate 24 hourly data points
      for (let i = 0; i < 24; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        history.timestamp.unshift(date.toISOString());
        
        // Random value between 9800 and 10500
        const value = 10000 + Math.sin(i/3) * 500;
        history.equity.unshift(value);
      }
      
      res.json(history);
    });
    
    app.get('/api/strategies', (_req, res) => {
      // Mock strategies data
      res.json([
        {
          id: 1,
          name: "Demo MACD Strategy",
          createdAt: new Date().toISOString(),
          type: "Template",
          assets: ["AAPL", "MSFT", "GOOGL"],
          profitLoss: {
            value: "$250.00",
            percentage: "2.5%",
            isPositive: true
          },
          winRate: 62,
          status: "Running"
        },
        {
          id: 2,
          name: "AI-Generated Momentum Strategy",
          createdAt: new Date().toISOString(),
          type: "AI-Generated",
          assets: ["TSLA", "NVDA"],
          profitLoss: {
            value: "$120.00",
            percentage: "1.2%",
            isPositive: true
          },
          winRate: 58,
          status: "Paused"
        }
      ]);
    });
    
    app.get('/api/watchlists', (_req, res) => {
      // Mock watchlists data
      res.json([
        {
          id: 1,
          name: "Default",
          userId: 1,
          isDefault: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          name: "Tech Stocks",
          userId: 1,
          isDefault: false,
          createdAt: new Date().toISOString()
        }
      ]);
    });
    
    app.get('/api/watchlists/default', (_req, res) => {
      // Mock default watchlist items
      res.json([
        {
          id: 1,
          symbol: "AAPL",
          watchlistId: 1,
          notes: "Apple Inc.",
          addedAt: new Date().toISOString(),
          price: 180.5,
          change: 1.5,
          changePercent: 0.84
        },
        {
          id: 2,
          symbol: "MSFT",
          watchlistId: 1,
          notes: "Microsoft Corp.",
          addedAt: new Date().toISOString(),
          price: 401.2,
          change: 3.2,
          changePercent: 0.78
        },
        {
          id: 3,
          symbol: "GOOGL",
          watchlistId: 1,
          notes: "Alphabet Inc.",
          addedAt: new Date().toISOString(),
          price: 142.8,
          change: -1.2,
          changePercent: -0.83
        }
      ]);
    });
    
    app.get('/api/integrations', (_req, res) => {
      // Mock integrations data
      res.json([
        {
          id: 1,
          provider: "Alpaca",
          status: "connected",
          apiKeyId: "DEMO_API_KEY_ID",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    });
    
    app.get('/api/notifications', (_req, res) => {
      // Mock notifications data
      res.json([
        {
          id: 1,
          type: "system",
          message: "Welcome to the trading platform! 👋",
          isRead: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          type: "trade",
          message: "AAPL buy order filled: 5 shares @ $175.00",
          isRead: true,
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ]);
    });
    
    app.get('/api/users/verify-phone/status', (_req, res) => {
      // Mock phone verification status
      res.json({ verified: true });
    });
    
    // Add error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Setup Vite for UI
    if (app.get("env") === "development") {
      log('Setting up Vite for development...');
      await setupVite(app, httpServer);
    } else {
      log('Setting up static file serving for production...');
      serveStatic(app);
    }

    // Start the minimal server on port 5000
    httpServer.listen(5000, '0.0.0.0', () => {
      log('🚀 Minimal debug server is running on port 5000');
      log('Using mock data with enhanced WebSocket support for debugging');
      log('Note: Authentication is bypassed in minimal mode');
    });
    
    return httpServer;
  } catch (error) {
    log(`Critical startup error: ${error}`);
    throw error;
  }
})();
