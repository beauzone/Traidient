import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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
  // Skip Python initialization in production deployment
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { initPythonEnvironment } = await import('./pythonExecutionService');
      log('Initializing Python environment for screeners...');
      await initPythonEnvironment();
      log('Python environment initialization completed');
    } catch (error) {
      log(`Warning: Failed to initialize Python environment: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    log('Skipping Python initialization in production environment');
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error('Error:', err); // Log error instead of throwing
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    try {
      // Try the original serveStatic first
      serveStatic(app);
      log("Using built-in serveStatic for production");
    } catch (error) {
      // If that fails, use our custom implementation
      log(`Original serveStatic failed: ${error instanceof Error ? error.message : String(error)}`);
      log("Falling back to custom static file serving implementation");
      const { serveStaticFiles } = await import('./staticFileServer');
      serveStaticFiles(app);
    }
  }

  // Define port and host for deployment with GCE compatibility
  const port = parseInt(process.env.PORT || '5000');
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : (process.env.HOST || '0.0.0.0');

  log(`Initializing server startup...`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`Binding to host: ${host}, port: ${port}`);
  
  // Enhanced error handler for the server
  server.on('error', (err: any) => {
    console.error(`Server startup error: ${err.message}`, err);
    
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Attempting graceful restart...`);
      
      setTimeout(() => {
        try {
          server.close(() => {
            log(`Retrying server startup on ${host}:${port}...`);
            server.listen(port, host);
          });
        } catch (retryError) {
          console.error(`Failed to restart server: ${retryError}`);
          process.exit(1);
        }
      }, 2000);
    } else if (err.code === 'EACCES') {
      console.error(`Permission denied binding to port ${port}. Try a different port.`);
      process.exit(1);
    } else {
      console.error(`Unhandled server error: ${err.code || 'UNKNOWN'} - ${err.message}`);
      process.exit(1);
    }
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      log('Server closed successfully.');
      process.exit(0);
    });
    
    // Force exit after 30 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Forceful shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Start the server with proper host binding and startup verification
  server.listen(port, host, () => {
    log(`✓ Server successfully started on ${host}:${port}`);
    log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`✓ Process ID: ${process.pid}`);
    log(`✓ Health check available at: http://${host}:${port}/health`);
    log(`✓ Ready check available at: http://${host}:${port}/ready`);
    
    // Verify server is actually listening
    setTimeout(() => {
      const address = server.address();
      if (address) {
        log(`✓ Server verified listening on ${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);
      } else {
        console.error('Server address verification failed');
      }
    }, 1000);
  });

})();