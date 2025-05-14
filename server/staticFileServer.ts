import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The serveStatic function is required for deployment.
 * It provides a simple implementation to serve static files.
 */
export function serveStatic(app: Express) {
  const publicPath = path.join(__dirname, 'public');
  log(`Setting up static file serving from: ${publicPath}`);
  app.use(express.static(publicPath));
  
  // Serve index.html for client-side routes
  app.get(/^(?!\/api\/).+/, (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(500).send('Index file not found');
    }
  });
}

/**
 * Serves static files for production environment
 * This function is used as an alternative to the serveStatic function in vite.ts
 */
export function serveStaticFiles(app: Express) {
  // Check different possible build output directories
  const possibleDistPaths = [
    path.resolve(__dirname, "..", "public"),
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(__dirname, "..", "dist"),
    path.resolve(__dirname, "public"),
    path.resolve("public"),
    path.resolve("dist")
  ];

  let distPath: string | null = null;

  // Find first existing directory
  for (const dir of possibleDistPaths) {
    if (fs.existsSync(dir)) {
      log(`Found static files directory: ${dir}`);
      distPath = dir;
      break;
    }
  }

  if (!distPath) {
    log("Warning: Could not find static files directory. Static content may not be served correctly.");
    return;
  }

  // Index HTML path
  const indexHtmlPath = path.join(distPath, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    log(`Warning: index.html not found at ${indexHtmlPath}`);
  } else {
    log(`Found index.html at ${indexHtmlPath}`);
  }

  // Serve static files
  app.use(express.static(distPath));

  // Serve index.html for any non-API routes
  app.get(/^(?!\/api\/).+/, (req, res) => {
    if (fs.existsSync(indexHtmlPath)) {
      res.sendFile(indexHtmlPath);
    } else {
      res.status(500).send("Server configured for production but build files not found");
    }
  });
}