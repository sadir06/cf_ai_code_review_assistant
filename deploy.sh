#!/bin/bash

# Deployment script for AI Code Review Assistant

echo "🚀 Starting deployment of AI Code Review Assistant..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI found and user is logged in"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Type check
echo "🔍 Running type check..."
npm run type-check

if [ $? -ne 0 ]; then
    echo "❌ Type check failed. Please fix TypeScript errors before deploying."
    exit 1
fi

echo "✅ Type check passed"

# Check if database exists, create if not
echo "🗄️ Setting up database..."
DB_EXISTS=$(wrangler d1 list | grep -c "code-review-db" || true)

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "Creating D1 database..."
    wrangler d1 create code-review-db
    echo "⚠️  Please update wrangler.toml with the new database ID"
    echo "⚠️  Then run: wrangler d1 migrations apply code-review-db"
    exit 1
else
    echo "✅ Database exists"
fi

# Run migrations
echo "🔄 Running database migrations..."
wrangler d1 migrations apply code-review-db

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed"
    exit 1
fi

echo "✅ Database migrations completed"

# Deploy Workers
echo "🚀 Deploying Cloudflare Workers..."
wrangler deploy

if [ $? -ne 0 ]; then
    echo "❌ Workers deployment failed"
    exit 1
fi

echo "✅ Workers deployed successfully"

# Deploy Pages (frontend)
echo "🌐 Deploying Cloudflare Pages..."
wrangler pages deploy src/pages

if [ $? -ne 0 ]; then
    echo "❌ Pages deployment failed"
    exit 1
fi

echo "✅ Pages deployed successfully"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your Pages domain in Cloudflare dashboard"
echo "2. Test the application with sample code"
echo "3. Submit your GitHub repository URL to Cloudflare"
echo ""
echo "🔗 Your application should now be live!"
