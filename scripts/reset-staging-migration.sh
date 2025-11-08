#!/bin/bash
# Reset and redeploy tier system migration on staging

echo "🔄 Resetting failed tier system migration on staging..."

# Step 1: Run the SQL cleanup script
echo "📋 Step 1: Cleaning up failed migration..."
# You'll need to run reset-tier-migration.sql manually in your database
# Or use: psql $DATABASE_URL -f scripts/reset-tier-migration.sql

# Step 2: Mark migration as rolled back (if needed)
echo "📋 Step 2: Marking migration as rolled back..."
npx prisma migrate resolve --rolled-back 20251108_add_tier_management_system || echo "Migration not found in Prisma, continuing..."

# Step 3: Deploy migrations
echo "📋 Step 3: Deploying migrations..."
npx prisma migrate deploy

# Step 4: Verify
echo "📋 Step 4: Verifying deployment..."
npx prisma migrate status

echo "✅ Reset complete! Check the output above for any errors."
