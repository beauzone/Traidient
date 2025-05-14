import express from 'express';
import path from 'path';
import fs from 'fs';
import { log } from './utils/logger';

export function serveStaticFiles(app: express.Express) {
  const distDir = path.join(__dirname, '..', 'dist');
  const publicDistDir = path.join(distDir, 'public');
  
  if (!fs.existsSync(publicDistDir)) {
    log(`Warning: Static files directory not found at ${publicDistDir}`);
    return;
  }
  
  // Serve static files from dist/public
  app.use(express.static(publicDistDir, {
    index: false, // Don't serve index.html for '/' - let the client router handle it
    maxAge: '1d' // Cache static assets for 1 day
  }));
  
  // Serve index.html for all routes to support client-side routing
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    const indexPath = path.join(publicDistDir, 'index.html');
    
    // Check if index.html exists
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      log(`Error: index.html not found at ${indexPath}`);
      res.status(500).send('Server configuration error - index.html not found');
    }
  });
  
  log(`Static files are being served from ${publicDistDir}`);
}