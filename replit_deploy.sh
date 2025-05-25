#!/bin/bash
# Simple deployment script for Replit
set -e

echo "=== Replit Deployment Starting ==="

# Set production environment
export NODE_ENV=production
export PORT=${PORT:-5000}
export HOST=0.0.0.0

# Generate JWT secret if missing
if [ -z "$JWT_SECRET" ]; then
  export JWT_SECRET="replit-deploy-$(date +%s)"
fi

echo "Environment: NODE_ENV=$NODE_ENV"
echo "Port: $PORT"
echo "Host: $HOST"

# Build the application
echo "Building application..."
npm run build

# Build backend
echo "Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Starting Server ==="
# Start the application
node dist/index.js