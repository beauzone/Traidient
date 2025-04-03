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
  
  // Use a more careful approach to kill processes on the port
  try {
    log(`Checking if port ${preferredPort} is in use...`);
    const { execSync } = await import('child_process');
    
    // Check if the port is in use
    try {
      // If this command succeeds, the port is in use
      const output = execSync(`lsof -i:${preferredPort} -P -n -t`, { encoding: 'utf-8' }).trim();
      
      if (output) {
        const pids = output.split('\n');
        log(`Port ${preferredPort} is in use by PID(s): ${pids.join(', ')}`);
        
        // Get more info about these processes
        for (const pid of pids) {
          try {
            const processInfo = execSync(`ps -p ${pid} -o pid,ppid,comm,args`, { encoding: 'utf-8' });
            log(`Process info: ${processInfo.trim()}`);
          } catch (err) {
            log(`Could not get info for PID ${pid}`);
          }
        }
        
        // Only attempt to kill if it's likely our own process
        const ownPid = process.pid;
        log(`Current process PID: ${ownPid}`);
        
        // Try to release the port, but be careful
        try {
          execSync(`lsof -i:${preferredPort} -P -n -t | xargs -r kill || true`);
          log(`Attempted to release port ${preferredPort} with normal kill`);
          
          // Check if it worked
          try {
            execSync(`lsof -i:${preferredPort} -P -n -t`, { stdio: 'pipe' });
            log(`Port ${preferredPort} is still in use, will use fallback port`);
          } catch {
            log(`Port ${preferredPort} is now available`);
          }
        } catch (killErr) {
          log(`Failed to kill processes: ${killErr}`);
        }
      } else {
        log(`Port ${preferredPort} is not in use`);
      }
    } catch (checkErr) {
      // If this command fails, the port is not in use (lsof returns non-zero exit code)
      log(`Port ${preferredPort} is available`);
    }
  } catch (e) {
    log(`Warning: Error checking port ${preferredPort}: ${e}`);
  }
  
  // Try to listen on the preferred port first
  server.listen({
    port: preferredPort,
    host: "0.0.0.0",
  })
  .on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      // Port 5000 is in use, try the fallback port
      log(`Port ${preferredPort} is already in use, trying fallback port ${fallbackPort}`);
      server.listen({
        port: fallbackPort,
        host: "0.0.0.0",
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
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : preferredPort;
    log(`🚀 Server is running on port ${port}`);
  });
})();
