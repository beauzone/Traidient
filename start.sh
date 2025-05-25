#!/bin/bash

# Simple production startup
export NODE_ENV=production
export PORT=${PORT:-5000}
export HOST=${HOST:-0.0.0.0}

# Auto-generate JWT secret if missing
[ -z "$JWT_SECRET" ] && export JWT_SECRET="prod-secret-$(date +%s)"

echo "Starting production server..."
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOST: $HOST"

# Start the server directly
exec node dist/index.js