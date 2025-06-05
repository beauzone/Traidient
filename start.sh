#!/bin/bash

# ✅ Prevent accidental production run from the wrong branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "🚫 Server start aborted. You are on '$CURRENT_BRANCH', not 'main'."
  exit 1
fi

# Production start script for Traidient.AI trading platform
echo "Starting Traidient.AI production server..."

# Set production environment
export NODE_ENV=production

# Add startup logging
echo "Environment: $NODE_ENV"
echo "Node.js version: $(node --version)"
echo "Process ID: $$"
echo "Working directory: $(pwd)"

# Verify required files exist
if [ ! -f "dist/index.js" ]; then
    echo "Error: dist/index.js not found. Build may have failed."
    exit 1
fi

echo "Starting server..."

# Start the compiled application with ESM support and better error handling
exec node --experimental-specifier-resolution=node --unhandled-rejections=strict dist/index.js