
#!/bin/bash

# Production start script for Traidient.AI trading platform
echo "Starting Traidient.AI production server..."

# Set production environment
export NODE_ENV=production

# Start the compiled application with ESM support
node --experimental-specifier-resolution=node dist/index.js
