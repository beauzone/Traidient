#!/bin/bash
set -e
echo "Installing production dependencies..."
npm ci --only=production
echo "Building backend only for deployment..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "Copying client files..."
mkdir -p dist/public
cp -r client/* dist/public/ 2>/dev/null || true
echo "Build completed successfully"
ls -la dist/