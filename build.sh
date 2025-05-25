#!/bin/bash
set -e
echo "Building full application for deployment..."

# Build frontend
echo "Building frontend..."
npm run build

# Build backend
echo "Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Full build completed successfully"