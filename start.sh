
#!/bin/bash

# Set production environment
export NODE_ENV=production
export PORT=3000
export REPLIT_DISABLE_PACKAGE_LAYER=1

# Log startup info
echo "Starting server in production mode on port $PORT"

# Start the server
node dist/index.js
