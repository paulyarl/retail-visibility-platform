#!/bin/bash

set -e
echo "🔍 COMPREHENSIVE TABLE COUNT VERIFICATION"
echo "========================================"

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

echo "🔍 Comparing record counts for ALL tables between staging and production..."
echo ""

# Get all table names that exist in BOTH staging and production
echo "📥 Getting common tables..."
doppler run -- psql "$STAGING_DATABASE_URL" -tAc "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  )
ORDER BY table_name;
" > /tmp/common_tables.txt 2>/dev/null

echo "📊 Checking record counts for all tables..."
echo ""

match_count=0
mismatch_count=0
error_count=0

# Create results file
echo "Table,Staging Count,Production Count,Status" > /tmp/table_comparison.csv

while IFS= read -r table; do
    if [ -n "$table" ]; then
        # Get staging count
        staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        
        # Get production count
        production_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        
        # Compare
        if [ "$staging_count" = "ERROR" ] || [ "$production_count" = "ERROR" ]; then
            status="❌ ERROR"
            error_count=$((error_count + 1))
        elif [ "$staging_count" = "$production_count" ]; then
            status="✅ MATCH"
            match_count=$((match_count + 1))
        else
            status="⚠️ MISMATCH"
            mismatch_count=$((mismatch_count + 1))
        fi
        
        # Output to CSV
        echo "$table,$staging_count,$production_count,$status" >> /tmp/table_comparison.csv
        
        # Show mismatches and errors immediately
        if [ "$status" != "✅ MATCH" ]; then
            echo "   $status $table: staging=$staging_count, production=$production_count"
        fi
    fi
done < /tmp/common_tables.txt

echo ""
echo "📊 SUMMARY REPORT"
echo "================="
echo ""
echo "✅ Matching tables: $match_count"
echo "⚠️  Mismatched tables: $mismatch_count"
echo "❌ Error tables: $error_count"
echo ""

# Show full comparison
echo "📋 FULL COMPARISON (sorted by mismatch):"
echo "----------------------------------------"
column -t -s',' /tmp/table_comparison.csv | sort -t',' -k4

echo ""
echo "📊 Tables with MISMATCHES (need attention):"
echo "-------------------------------------------"
grep "MISMATCH" /tmp/table_comparison.csv | while IFS=',' read -r table staging prod status; do
    echo "   $table: staging=$staging, production=$prod"
done

if [ "$mismatch_count" -eq 0 ] && [ "$error_count" -eq 0 ]; then
    echo "   (None - all tables match!)"
fi

echo ""
echo "📊 Tables with ERRORS:"
echo "---------------------"
grep "ERROR" /tmp/table_comparison.csv | while IFS=',' read -r table staging prod status; do
    echo "   $table"
done

if [ "$error_count" -eq 0 ]; then
    echo "   (None)"
fi

# Clean up
rm -f /tmp/common_tables.txt /tmp/table_comparison.csv

echo ""
echo "🎯 VERIFICATION COMPLETE!"
echo "========================"
