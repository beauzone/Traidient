#!/bin/bash
# Set production environment
export NODE_ENV=production
export PORT=5000

# Log startup info
echo "Starting server in production mode"
echo "Current directory: $(pwd)"
echo "Port: $PORT"
echo "Contents of dist directory:"
ls -la dist/

# Start the server
node dist/index.js