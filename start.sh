#!/bin/bash

# Set NODE_ENV to production
export NODE_ENV=production
export PORT=5000

# Ensure host binding for Replit deployment
export HOST=0.0.0.0

# Start the server
node dist/index.js