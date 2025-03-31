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
  // Initialize Python environment for screeners
  try {
    const { initPythonEnvironment } = await import('./pythonExecutionService');
    log('Initializing Python environment for screeners...');
    await initPythonEnvironment();
    log('Python environment initialized successfully');
  } catch (error) {
    log(`Warning: Failed to initialize Python environment: ${error instanceof Error ? error.message : String(error)}`);
    log('Stock screeners requiring Python may not work properly');
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS try to serve the app on port 5000 first
  // this serves both the API and the client.
  // This is the port that Replit workflow system expects
  const preferredPort = 5000;
  const fallbackPort = 5001;
  
  // Try to listen on the preferred port first
  server.listen({
    port: preferredPort,
    host: "0.0.0.0",
    reusePort: true,
  })
  .on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      // Port 5000 is in use, try the fallback port
      log(`Port ${preferredPort} is already in use, trying fallback port ${fallbackPort}`);
      server.listen({
        port: fallbackPort,
        host: "0.0.0.0",
        reusePort: true,
      }, () => {
        log(`⚠️ Serving on fallback port ${fallbackPort}. Some features may not work as expected.`);
      });
    } else {
      // Some other error occurred
      log(`Failed to start server: ${err.message}`);
      throw err;
    }
  })
  .on('listening', () => {
    log(`Serving on preferred port ${preferredPort}`);
  });
})();
