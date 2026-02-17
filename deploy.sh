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

# Create Dockerfile for Node+Express serving
cat > Dockerfile <<'EOF'
FROM node:20-alpine
WORKDIR /app
RUN npm init -y && npm install express
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
EOF

# Copy server.js and rename dist content to public/
mkdir -p public
cp ../server.js .
# Move built files into public/
for f in *; do
  [ "$f" = "public" ] || [ "$f" = "server.js" ] || [ "$f" = "Dockerfile" ] || [ "$f" = ".git" ] || [ "$f" = "Procfile" ] || [ "$f" = ".static" ] || mv "$f" "public/" 2>/dev/null || true
done

# Commit and push
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M:%S')" --allow-empty
GIT_SSH_COMMAND="ssh -i $HOME/.ssh/openclaw_ed25519" git push dokku main --force

echo "Deployed to https://zooming.eliln.com"
