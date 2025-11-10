#!/bin/bash

# Deploy Staging to Vercel
# This script triggers a Vercel deployment for the staging branch

echo "🚀 Triggering Vercel deployment for staging..."

# Check if VERCEL_DEPLOY_HOOK_STAGING is set
if [ -z "$VERCEL_DEPLOY_HOOK_STAGING" ]; then
  echo "❌ Error: VERCEL_DEPLOY_HOOK_STAGING environment variable not set"
  echo ""
  echo "To set it up:"
  echo "1. Go to Vercel Dashboard → Your Project → Settings → Git"
  echo "2. Scroll to 'Deploy Hooks'"
  echo "3. Create a new hook for 'staging' branch"
  echo "4. Copy the URL and run:"
  echo "   export VERCEL_DEPLOY_HOOK_STAGING='<your-hook-url>'"
  exit 1
fi

# Trigger deployment
response=$(curl -X POST "$VERCEL_DEPLOY_HOOK_STAGING" -w "\n%{http_code}" -s)
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
  echo "✅ Deployment triggered successfully!"
  echo "📊 Check status at: https://vercel.com/dashboard"
else
  echo "❌ Deployment trigger failed with HTTP $http_code"
  echo "$response"
  exit 1
fi
