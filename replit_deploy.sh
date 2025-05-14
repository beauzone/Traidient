#!/bin/bash
echo "Starting application for Replit deployment..."

# Set the environment to production
export NODE_ENV=production

# Set port to 5000 to match Replit's port forwarding configuration
export PORT=5000

# Disable package layer to ensure all dependencies are included
export REPLIT_DISABLE_PACKAGE_LAYER=1

# Display environment information
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Server starting at http://localhost:$PORT"

# Start the server
node dist/index.js