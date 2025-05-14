import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function serveStaticFiles(app: express.Express) {
  const distPath = path.resolve(__dirname, '..', 'dist', 'public');

  app.use(express.static("dist/public", {
  maxAge: '1d',
  index: 'index.html',
  fallthrough: true
}));

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist/public' });
});

  log('Static file serving configured');
}