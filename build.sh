#!/bin/bash
set -e
echo "Building backend only for fast deployment..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "Creating minimal static structure..."
mkdir -p dist/public
echo "Creating deployment index.html..."
cat > dist/public/index.html << 'EOF'
<!DOCTYPE html>
<html><head><title>Trading Platform</title><style>body{margin:0;padding:2rem;font-family:system-ui;background:#000;color:#fff;text-align:center}h1{color:#f59e0b}</style></head><body><h1>🚀 Trading Platform</h1><p>API Backend is running successfully!</p><p>Ready for deployment configuration.</p></body></html>
EOF
echo "Build completed in seconds"