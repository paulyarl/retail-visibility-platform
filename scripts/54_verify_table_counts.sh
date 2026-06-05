#!/bin/bash

set -e
echo "🔍 COMPREHENSIVE BASE TABLE COUNT VERIFICATION"
echo "============================================="

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

echo "🔍 Comparing record counts for BASE TABLES only (excluding views)..."
echo ""

# Get all BASE TABLE names from staging
echo "📥 Getting staging base tables..."
doppler run -- psql "$STAGING_DATABASE_URL" -tAc "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
" > /tmp/staging_tables.txt 2>/dev/null

# Get all BASE TABLE names from production
echo "📥 Getting production base tables..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
" > /tmp/production_tables.txt 2>/dev/null

# Find common tables (exist in both)
echo "📊 Finding common tables..."
comm -12 /tmp/staging_tables.txt /tmp/production_tables.txt > /tmp/common_tables.txt

total_tables=$(wc -l < /tmp/common_tables.txt | tr -d ' ')
echo "📊 Checking record counts for $total_tables common base tables..."
echo ""

match_count=0
mismatch_count=0

# Create results file
echo "Table,Staging,Production,Status" > /tmp/table_comparison.csv

while IFS= read -r table; do
    if [ -n "$table" ]; then
        # Get staging count
        staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        
        # Get production count
        production_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        
        # Compare
        if [ "$staging_count" = "$production_count" ]; then
            status="✅"
            match_count=$((match_count + 1))
            echo "   ✅ $table: $staging_count"
        else
            status="⚠️"
            mismatch_count=$((mismatch_count + 1))
            echo "   ⚠️  $table: staging=$staging_count, production=$production_count"
        fi
        
        # Output to CSV
        echo "$table,$staging_count,$production_count,$status" >> /tmp/table_comparison.csv
    fi
done < /tmp/common_tables.txt

echo ""
echo "📊 SUMMARY REPORT"
echo "================="
echo ""
echo "✅ Matching tables: $match_count"
echo "⚠️  Mismatched tables: $mismatch_count"
echo "📊 Total checked: $((match_count + mismatch_count))"
echo ""

if [ "$mismatch_count" -gt 0 ]; then
    echo "📊 Tables with MISMATCHES (need attention):"
    echo "-------------------------------------------"
    grep "⚠️" /tmp/table_comparison.csv | while IFS=',' read -r table staging prod status; do
        echo "   $table: staging=$staging, production=$prod"
    done
else
    echo "🎉 ALL TABLE COUNTS MATCH!"
fi

# Clean up
rm -f /tmp/staging_tables.txt /tmp/production_tables.txt /tmp/common_tables.txt /tmp/table_comparison.csv

echo ""
echo "🎯 VERIFICATION COMPLETE!"
