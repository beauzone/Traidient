#!/bin/bash

# This script is used for the production deployment

# Set the environment to production
export NODE_ENV=production

# Use port 5000 for production deployment to match Replit's port forwarding configuration
export PORT=5000

# Start the server
node dist/index.js