#!/usr/bin/env node

/**
 * Deployment verification and fix script
 * Ensures frontend files are in the correct location for deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, 'dist', 'public');
const targetDir = path.resolve(__dirname, 'dist', 'client');
const serverFile = path.resolve(__dirname, 'dist', 'index.js');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return false;
  }
  
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
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
  return true;
}

function verifyDeployment() {
  console.log('🔍 Verifying deployment readiness...');
  
  const issues = [];
  const fixes = [];
  
  // Check if server build exists
  if (!fs.existsSync(serverFile)) {
    issues.push('Server build missing: dist/index.js not found');
    fixes.push('Run: npm run build');
  } else {
    console.log('✅ Server build found');
  }
  
  // Check if frontend files exist in expected location
  const expectedFrontendIndex = path.join(targetDir, 'index.html');
  if (!fs.existsSync(expectedFrontendIndex)) {
    issues.push('Frontend build missing: dist/client/index.html not found');
    
    // Try to fix by copying from dist/public
    if (fs.existsSync(sourceDir)) {
      console.log('📦 Copying frontend files to expected location...');
      const success = copyRecursive(sourceDir, targetDir);
      if (success && fs.existsSync(expectedFrontendIndex)) {
        fixes.push('✅ Frontend files copied to dist/client');
        console.log('✅ Frontend files successfully copied to dist/client');
      } else {
        fixes.push('❌ Failed to copy frontend files');
      }
    } else {
      fixes.push('Run: npm run build (frontend build is missing)');
    }
  } else {
    console.log('✅ Frontend files found in expected location');
  }
  
  // Check if static file server can find files
  const staticServerPaths = [
    path.resolve(__dirname, 'dist', 'client'),
    path.resolve(__dirname, 'dist', 'public')
  ];
  
  let staticFilesFound = false;
  for (const testPath of staticServerPaths) {
    if (fs.existsSync(path.join(testPath, 'index.html'))) {
      console.log(`✅ Static files accessible at: ${testPath}`);
      staticFilesFound = true;
      break;
    }
  }
  
  if (!staticFilesFound) {
    issues.push('No static files found in any expected location');
  }
  
  // Summary
  console.log('\n📋 Deployment Verification Summary:');
  if (issues.length === 0) {
    console.log('🎉 All deployment requirements met!');
    console.log('✅ Ready for deployment');
    return true;
  } else {
    console.log('⚠️  Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('\n🔧 Applied fixes:');
    fixes.forEach(fix => console.log(`  - ${fix}`));
    
    // Re-check after fixes
    const stillMissing = [];
    if (!fs.existsSync(serverFile)) {
      stillMissing.push('Server build still missing');
    }
    if (!fs.existsSync(expectedFrontendIndex)) {
      stillMissing.push('Frontend build still missing');
    }
    
    if (stillMissing.length === 0) {
      console.log('\n✅ All issues resolved - Ready for deployment');
      return true;
    } else {
      console.log('\n❌ Some issues remain:');
      stillMissing.forEach(issue => console.log(`  - ${issue}`));
      return false;
    }
  }
}

function main() {
  console.log('🚀 Deployment Verification and Fix Tool');
  console.log('=====================================');
  
  const isReady = verifyDeployment();
  
  if (isReady) {
    console.log('\n🎯 Deployment is ready!');
    process.exit(0);
  } else {
    console.log('\n❌ Deployment not ready. Please run the necessary build commands.');
    process.exit(1);
  }
}

main();