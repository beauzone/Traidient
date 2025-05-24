
#!/bin/bash
# Set production environment
export NODE_ENV=production

# Log startup info
echo "Starting server in production mode"
echo "Current directory: $(pwd)"

# Start the server
node dist/index.js
