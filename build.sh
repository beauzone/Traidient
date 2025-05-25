#!/bin/bash
set -e
echo "Installing all dependencies for build..."
npm ci
echo "Building frontend..."
npm run build
echo "Creating proper directory structure for deployment..."
mkdir -p dist/public
echo "Copying built frontend files to expected location..."
cp -r dist/* dist/public/ 2>/dev/null || true
echo "Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "Build completed successfully"
ls -la dist/
ls -la dist/public/