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

# Make sure public directory exists in both locations
echo "Setting up public directories..."
mkdir -p public
mkdir -p dist/public

# Run Vite build process again to ensure we have the latest files
echo "Rebuilding client files directly to public directory..."
npx vite build --outDir=dist/public

# Additional safety - copy any existing files from public to dist/public
echo "Copying any remaining client build files to dist/public..."
cp -r public/* dist/public/ 2>/dev/null || echo "No additional client build files found in public directory"

echo "Build completed. Files are ready for deployment."