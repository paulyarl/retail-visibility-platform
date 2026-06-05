#!/bin/bash

set -e
echo "➕ ADDING MISSING CRON JOBS TO PRODUCTION"
echo "=========================================="

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

echo "🔥 Strategy: Add missing cron jobs from staging"
echo ""

# Get existing production job names
echo "📥 Getting existing production cron jobs..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT jobname FROM cron.job;" > /tmp/prod_jobs.txt 2>/dev/null

# Get staging jobs
echo "📥 Getting staging cron jobs..."
doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT jobname, schedule, command FROM cron.job ORDER BY jobid;" > /tmp/staging_jobs.txt 2>/dev/null

echo ""
echo "📊 Adding missing jobs..."

added_count=0
skipped_count=0
failed_count=0

while IFS='|' read -r jobname schedule command; do
    if [ -n "$jobname" ]; then
        # Check if job already exists in production
        if grep -q "^${jobname}$" /tmp/prod_jobs.txt 2>/dev/null; then
            echo "   ℹ️  $jobname already exists, skipping"
            skipped_count=$((skipped_count + 1))
        else
            echo "   ➕ Adding $jobname..."
            
            # Escape single quotes in command
            escaped_command=$(echo "$command" | sed "s/'/''/g")
            
            # Create the cron job
            if doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT cron.schedule('$jobname', '$schedule', '$escaped_command');" 2>/dev/null; then
                echo "   ✅ Added $jobname"
                added_count=$((added_count + 1))
            else
                echo "   ❌ Failed to add $jobname"
                failed_count=$((failed_count + 1))
            fi
        fi
    fi
done < /tmp/staging_jobs.txt

# Clean up
rm -f /tmp/prod_jobs.txt /tmp/staging_jobs.txt

echo ""
echo "📊 SUMMARY"
echo "=========="
echo "✅ Added: $added_count jobs"
echo "ℹ️  Skipped (already exist): $skipped_count jobs"
echo "❌ Failed: $failed_count jobs"

echo ""
echo "📊 Final counts:"
prod_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM cron.job;" 2>/dev/null || echo "ERROR")
staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM cron.job;" 2>/dev/null || echo "ERROR")

echo "   - Staging: $staging_count jobs"
echo "   - Production: $prod_count jobs"

echo ""
echo "🎯 CRON JOB SYNC COMPLETE!"
