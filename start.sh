
#!/bin/bash

# Set production environment variables
export NODE_ENV=production
export PORT=5000
export REPLIT_DISABLE_PACKAGE_LAYER=1

# Start the server
exec node dist/index.js
