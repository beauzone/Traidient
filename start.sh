
#!/bin/bash

# Set production environment variables
export NODE_ENV=production
export PORT=5000

# Start the server
exec node dist/index.js
