#!/bin/bash
set -e

echo "Building app..."
npm run build

echo "Preparing deploy..."
cd dist

# Initialize git if not exists
if [ ! -d .git ]; then
    git init
    git remote add dokku dokku@local.eliln.com:zooming
fi

# Create .static marker for nginx buildpack
touch .static

# Copy nginx config for SPA routing if it exists
[ -f ../nginx.conf.sigil ] && cp ../nginx.conf.sigil .

# Commit and push
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M:%S')" --allow-empty
git push dokku main --force

echo "Deployed to https://zooming.eliln.com"
