#!/usr/bin/env node

/**
 * Post-build script to ensure frontend files are in the expected location for deployment
 * This script copies built files from dist/public to dist/client if needed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, 'dist', 'public');
const targetDir = path.resolve(__dirname, 'dist', 'client');

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(
        path.join(src, file),
        path.join(dest, file)
      );
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function main() {
  console.log('Post-build: Ensuring frontend files are in the correct location...');
  
  // Check if source directory exists (Vite output)
  if (!fs.existsSync(sourceDir)) {
    console.log(`Source directory ${sourceDir} does not exist. Build may have failed.`);
    process.exit(1);
  }
  
  // Check if target directory already has files
  if (fs.existsSync(targetDir)) {
    console.log(`Target directory ${targetDir} already exists. Cleaning...`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  
  // Copy files from source to target
  console.log(`Copying files from ${sourceDir} to ${targetDir}...`);
  copyRecursive(sourceDir, targetDir);
  
  // Verify the copy was successful
  if (fs.existsSync(path.join(targetDir, 'index.html'))) {
    console.log('✅ Frontend files successfully copied to dist/client');
  } else {
    console.error('❌ Failed to copy frontend files - index.html not found in target directory');
    process.exit(1);
  }
  
  console.log('Post-build completed successfully.');
}

main();