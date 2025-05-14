#!/bin/bash

# This script is used for the production deployment

# Set the environment to production
export NODE_ENV=production

# Use port 3000 for production deployment (this will be mapped to port 80 externally)
export PORT=3000

# Start the server
node dist/index.js