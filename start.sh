#!/bin/bash

# This script is used for the production deployment

# Set the environment to production
export NODE_ENV=production

# Use port 80 for production deployment to match Replit's external port mapping
export PORT=80

# Start the server
node dist/index.js