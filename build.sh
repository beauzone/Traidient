
#!/bin/bash
set -e
echo "Building application for production deployment..."

# Build frontend
echo "Building frontend..."
npm run build

# Build backend with ESM format
echo "Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=node18

echo "Production build completed successfully"
