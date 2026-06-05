#!/bin/bash

set -e
echo "🔄 SYNCING CRON JOBS FROM STAGING TO PRODUCTION"
echo "==============================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Check if production database URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
    echo "❌ ERROR: PRODUCTION_DATABASE_URL environment variable not set"
    exit 1
fi

echo "🔥 Strategy: Drop all production cron jobs and recreate from staging"
echo ""

# Step 1: Get all production cron jobs
echo "📥 Step 1: Getting production cron jobs..."
prod_jobs=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT jobname FROM cron.job ORDER BY jobid;" 2>/dev/null)

echo "📋 Production cron jobs to remove:"
echo "$prod_jobs" | while read -r job; do
    if [ -n "$job" ]; then
        echo "   - $job"
    fi
done

echo ""

# Step 2: Remove all production cron jobs
echo "🔥 Step 2: Removing all production cron jobs..."
echo "$prod_jobs" | while read -r job; do
    if [ -n "$job" ]; then
        echo "   🗑️  Removing $job..."
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT cron.unschedule('$job');" 2>/dev/null && echo "   ✅ Removed $job" || echo "   ⚠️  Could not remove $job"
    fi
done

echo ""

# Step 3: Get staging cron jobs
echo "📥 Step 3: Getting staging cron jobs..."
staging_jobs=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT jobname, schedule, command FROM cron.job ORDER BY jobid;" 2>/dev/null)

echo ""

# Step 4: Recreate cron jobs from staging
echo "📤 Step 4: Recreating cron jobs from staging..."

# Get full job details from staging
doppler run -- psql "$STAGING_DATABASE_URL" -tAc "
SELECT jobname, schedule, command
FROM cron.job
ORDER BY jobid;
" > /tmp/staging_cron_jobs.txt 2>/dev/null

# Read and create each job
created_count=0
failed_count=0

while IFS='|' read -r jobname schedule command; do
    if [ -n "$jobname" ] && [ -n "$schedule" ] && [ -n "$command" ]; then
        echo "   📥 Creating $jobname..."
        
        # Escape single quotes in command
        escaped_command=$(echo "$command" | sed "s/'/''/g")
        
        # Create the cron job
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT cron.schedule('$jobname', '$schedule', '$escaped_command');" 2>/dev/null && {
            echo "   ✅ Created $jobname"
            created_count=$((created_count + 1))
        } || {
            echo "   ❌ Failed to create $jobname"
            failed_count=$((failed_count + 1))
        }
    fi
done < /tmp/staging_cron_jobs.txt

# Clean up
rm -f /tmp/staging_cron_jobs.txt

echo ""

# Step 5: Verify
echo "📊 Step 5: Verifying cron jobs..."
prod_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM cron.job;" 2>/dev/null || echo "ERROR")
staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM cron.job;" 2>/dev/null || echo "ERROR")

echo "   - Staging: $staging_count jobs"
echo "   - Production: $prod_count jobs"

echo ""
echo "📊 SUMMARY"
echo "=========="
echo "✅ Created: $created_count jobs"
echo "❌ Failed: $failed_count jobs"
echo "📊 Production now has: $prod_count jobs (staging: $staging_count)"

echo ""
echo "🎯 CRON JOB SYNC COMPLETE!"
