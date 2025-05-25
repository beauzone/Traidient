#!/bin/bash

# Production start script for Traidient.AI trading platform
echo "Starting Traidient.AI production server..."

# Set production environment
export NODE_ENV=production

# Start the compiled application
node dist/index.js