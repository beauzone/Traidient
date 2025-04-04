import express, { type Request, Response, NextFunction, Router } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";

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
  log('Starting server with real market data support');
  
  try {
    // Set development auto-login mode for easier testing during transition
    if (app.get("env") === "development") {
      process.env.DEV_AUTO_LOGIN = 'true';
      log('Development auto-login mode: ENABLED');
    }
    
    // Import and call the routes setup function to create and configure the server
    const { registerRoutes } = await import('./routes');
    const httpServer = await registerRoutes(app);
    
    // Setup Vite development server
    if (app.get("env") === "development") {
      log('Setting up Vite for development...');
      await setupVite(app, httpServer);
    } else {
      log('Setting up static file serving for production...');
      serveStatic(app);
    }
    
    // Start the server
    httpServer.listen(5000, '0.0.0.0', () => {
      log('🚀 Server is running on port 5000 with real market data support');
      if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
        log('Alpaca API credentials found - using Alpaca as primary market data provider');
      } else {
        log('Alpaca API credentials not found - fallback providers will be used');
      }
      
      if (process.env.DEV_AUTO_LOGIN === 'true') {
        log('👤 Development auto-login enabled: A dev_user will be created/used automatically');
      }
    });
    
    return httpServer;
  } catch (error) {
    log(`Critical startup error: ${error}`);
    throw error;
  }
})();
