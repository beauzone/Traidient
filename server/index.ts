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
  // Initialize Python environment for screeners (with production safeguards)
  try {
    const { initPythonEnvironment } = await import('./pythonExecutionService');
    log('Initializing Python environment for screeners...');
    
    // Use a timeout to prevent hanging during deployment
    const pythonInitTimeout = setTimeout(() => {
      log('Python initialization timed out after 10 seconds, continuing startup');
    }, 10000);
    
    try {
      await Promise.race([
        initPythonEnvironment().catch(e => {
          log(`Python initialization error caught: ${e instanceof Error ? e.message : String(e)}`);
          return null; // Prevent rejection from stopping server startup
        }),
        new Promise(resolve => setTimeout(() => {
          log('Python initialization timeout safety resolved');
          resolve(null);
        }, 8000))
      ]);
      log('Python environment initialization completed');
    } catch (err) {
      log(`Warning: Python environment initialization rejected: ${err instanceof Error ? err.message : String(err)}`);
      log('Continuing with limited Python functionality');
    } finally {
      clearTimeout(pythonInitTimeout);
    }
  } catch (error) {
    log(`Warning: Failed to import Python execution service: ${error instanceof Error ? error.message : String(error)}`);
    log('Continuing without Python screener functionality');
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

  // Use fixed port 5000 for deployment
  // Replit maps this to port 80 externally
  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`Server listening on port ${port}`);
  });
})();
