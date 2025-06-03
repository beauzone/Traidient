
#!/bin/bash

# Production start script for Traidient.AI trading platform
echo "Starting Traidient.AI production server..."

# Set production environment
export NODE_ENV=production

# Add startup logging
echo "Environment: $NODE_ENV"
echo "Node.js version: $(node --version)"
echo "Process ID: $$"
echo "Working directory: $(pwd)"

# Verify required files exist
if [ ! -f "dist/index.js" ]; then
    echo "Error: dist/index.js not found. Build may have failed."
    exit 1
fi

echo "Starting server..."

# Start the compiled application with ESM support and better error handling
exec node --experimental-specifier-resolution=node --unhandled-rejections=strict dist/index.js
