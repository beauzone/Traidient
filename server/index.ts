import express, { type Request, Response, NextFunction, Router } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";
import cors from "cors";

// Export currentPort for other modules to reference
export let currentPort = 5000;

const app = express();

// Configure enhanced CORS to prevent "you have been blocked" issues with Replit
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In Replit environments, we need to be more permissive
    // Allow all origins in production for better compatibility
    callback(null, true);
    return;
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Access-Control-Request-Method', 
    'Access-Control-Request-Headers',
    'X-Auth-Token',
    'X-Api-Key',
    'Cache-Control',
    'Pragma',
    'Expires',
    'If-None-Match',
    'If-Modified-Since',
    'User-Agent',
    'Sec-Fetch-Site',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Dest',
    'Referer',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Auth-Token', 'ETag', 'Cache-Control'],
  maxAge: 86400, // 24 hours, prevents preflight caching issues
  preflightContinue: true // Let OPTIONS pass to next handler
};

// Apply CORS globally
app.use(cors(corsOptions));

// Additional middleware to handle CORS headers more explicitly
// This is especially important for Replit environments
app.use((req, res, next) => {
  // Get the origin from headers or default to '*'
  const origin = req.headers.origin || '*';
  
  // Set specific CORS headers for better compatibility
  res.header('Access-Control-Allow-Origin', origin);
  
  // Ensure credentials can be included
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Allow a broad set of headers to prevent blocking
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Token, ' +
    'Cache-Control, Pragma, Expires, X-Api-Key, Access-Control-Request-Method, ' +
    'Access-Control-Request-Headers, If-None-Match, If-Modified-Since, User-Agent, ' +
    'Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest, Referer, X-CSRF-Token');
  
  // Allow all common methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  
  // Expose headers that might be needed by the client
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, X-Auth-Token');
  
  // Set a generous max age to reduce preflight requests
  res.header('Access-Control-Max-Age', '86400');
  
  // Add additional security headers for Replit compatibility
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`Handling OPTIONS preflight request from origin: ${origin}`);
    return res.status(204).end();
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware specifically for Cloudflare's security
app.use((req, res, next) => {
  // Disable client hints to prevent Cloudflare blocking
  res.header('Accept-CH', '');
  
  // Add security headers expected by Cloudflare
  res.header('Cross-Origin-Embedder-Policy', 'require-corp');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  res.header('Cross-Origin-Resource-Policy', 'same-site');
  
  // Set strict transport security
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
});

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
