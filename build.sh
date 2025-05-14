#!/bin/bash
echo "Building application for production deployment..."

# Clear any previous build files
echo "Cleaning previous build..."
rm -rf dist/ public/

# Build the client-side code with Vite
echo "Building client-side code with Vite..."
npx vite build

# Build the server-side code with esbuild
echo "Building server-side code with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Ensure the public directory exists in dist
echo "Creating public directory structure..."
mkdir -p dist/public

# Copy client build to public directory
echo "Copying client build to public directory..."
cp -r public/* dist/public/ 2>/dev/null || echo "No client build files found in public directory"

echo "Build completed. Files are ready for deployment."