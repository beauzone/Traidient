#!/bin/bash

# Exit on error
set -e

# Ensure Git repo is initialized
if [ ! -d .git ]; then
  git init
fi

# Ensure main branch exists and is pushed
git checkout -B main
git push -u origin main

# Create dev branch from main and push it
git checkout -b dev
git push -u origin dev

echo "✅ 'main' and 'dev' branches created and pushed to origin."
echo "👉 Suggested next steps:"
echo "  - Protect 'main' in GitHub (Settings > Branches > Add Rule)"
echo "  - Only merge into 'main' from PRs reviewed/tested from 'dev'"
