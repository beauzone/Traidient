#!/bin/bash

# Set NODE_ENV to production during build
export NODE_ENV=production

# Clean and rebuild
rm -rf dist
npm run build