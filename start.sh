#!/bin/bash

# Set NODE_ENV to production
export NODE_ENV=production

# Use Replit's PORT or default to 5000
export PORT=${PORT:-5000}

# Ensure host binding for Replit deployment
export HOST=0.0.0.0

# Generate JWT secret if missing (for deployment)
if [ -z "$JWT_SECRET" ]; then
  export JWT_SECRET="deployment-jwt-secret-$(date +%s)"
fi

# Print startup info for debugging
echo "Starting server on HOST=$HOST PORT=$PORT"
echo "NODE_ENV=$NODE_ENV"

# Start the server
node dist/index.js