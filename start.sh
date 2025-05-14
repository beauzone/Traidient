#!/bin/bash

# This script is used for the production deployment
echo "Starting application in production mode..."

# Set the environment to production
export NODE_ENV=production

# Use port 5000 for production deployment to match Replit's port forwarding configuration
export PORT=5000

# Disable package layer to ensure all dependencies are included
export REPLIT_DISABLE_PACKAGE_LAYER=1

# Display diagnostic information
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Server will listen on: http://0.0.0.0:$PORT"
echo "Checking for dist/index.js..."
if [ -f "dist/index.js" ]; then
  echo "√ dist/index.js found"
else
  echo "✗ ERROR: dist/index.js not found! Build may have failed."
  exit 1
fi

# Start the server
node dist/index.js