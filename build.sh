#!/bin/bash
set -e
echo "Installing dependencies..."
npm install --production=false
echo "Building frontend with optimizations..."
VITE_BUILD_TIMEOUT=600000 npm run build
echo "Build completed successfully"
ls -la dist/