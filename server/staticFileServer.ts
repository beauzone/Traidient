import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Handle import.meta in different environments
let __filename: string;
let __dirname: string;

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // Fallback for environments where import.meta is not available
  __dirname = path.resolve();
}

export function serveStaticFiles(app: express.Express) {
  // Try both possible build output directories for compatibility
  const possiblePaths = [
    path.resolve(__dirname, '..', 'dist', 'client'),  // Expected by deployment
    path.resolve(__dirname, '..', 'dist', 'public')   // Current Vite output
  ];
  
  let distPath: string | null = null;
  for (const testPath of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(testPath)) {
        distPath = testPath;
        console.log(`Using static files from: ${distPath}`);
        break;
      }
    } catch (e) {
      console.warn(`Could not check path ${testPath}: ${e}`);
    }
  }

  if (!distPath) {
    console.error(`Could not find build directory in any of: ${possiblePaths.join(', ')}`);
    distPath = possiblePaths[0]; // Fallback to expected path
  }

  app.use(express.static(distPath, {
    maxAge: '1d',
    index: 'index.html'
  }));

  // SPA fallback - skip API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath!, 'index.html'));
  });
}