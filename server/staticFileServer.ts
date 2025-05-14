import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function serveStaticFiles(app: express.Express) {
  const distPath = path.resolve(__dirname, '..', 'dist', 'public');

  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  log('Static file serving configured');
}