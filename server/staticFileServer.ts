import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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