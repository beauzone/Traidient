
#!/bin/bash

# Set production environment
export NODE_ENV=production

# Clean up previous build
rm -rf dist

# Install dependencies if needed
npm install

# Build the application
npm run build

# Make start script executable
chmod +x ./start.sh

echo "Build completed successfully"
