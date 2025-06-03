
#!/bin/bash
set -e
echo "Building application for production deployment..."

# Add startup logging
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: ${NODE_ENV:-development}"

# Install dependencies if needed
echo "Installing production dependencies..."
npm ci

# Build frontend
echo "Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed"
    exit 1
fi

# Build backend with ESM format and better error handling
echo "Building backend..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --target=node18 \
  --sourcemap \
  --minify \
  --legal-comments=none

if [ $? -ne 0 ]; then
    echo "Backend build failed"
    exit 1
fi

# Verify build outputs exist
echo "Verifying build outputs..."
if [ ! -f "dist/index.js" ]; then
    echo "Backend build output missing: dist/index.js"
    exit 1
fi

if [ ! -d "dist/client" ]; then
    echo "Frontend build output missing: dist/client"
    exit 1
fi

echo "✓ Production build completed successfully"
echo "✓ Backend compiled to: dist/index.js"
echo "✓ Frontend built to: dist/client"
