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
  const distPath = path.resolve(__dirname, '..', 'dist', 'public');

  app.use(express.static(distPath, {
    maxAge: '1d',
    index: 'index.html'
  }));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}