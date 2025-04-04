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
  log('Starting server in minimal mode for debugging');
  
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
      log('🚀 Minimal debugging server is running on port 5000');
      log('The server is running with minimal functionality for debugging');
      log('Most API endpoints are disabled to isolate startup issues');
    });
    
    return httpServer;
  } catch (error) {
    log(`Critical startup error: ${error}`);
    throw error;
  }
})();
