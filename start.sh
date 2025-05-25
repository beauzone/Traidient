
#!/bin/bash

# Set NODE_ENV to production
export NODE_ENV=production
export PORT=5000

# Start the server with proper host binding
node dist/index.js
