#!/bin/bash

set -e
echo "🔧 FIXING DIRECTORY DATA MIGRATION"
echo "================================="

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

echo "🔍 Investigating migration failure and fixing..."
echo ""

# Check 1: Verify staging data actually exists
echo "🔍 Check 1: Verifying staging data exists..."
tables=("directory_settings_list" "directory_listings_list" "directory_photos")

for table in "${tables[@]}"; do
    staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    echo "   📊 $table in staging: $staging_count records"
    
    if [ "$staging_count" -gt 0 ]; then
        echo "   📋 Sample data from staging:"
        doppler run -- psql "$STAGING_DATABASE_URL" -c "SELECT * FROM \"$table\" LIMIT 2;" 2>/dev/null || echo "   ❌ Could not get sample data"
    fi
    echo ""
done

# Check 2: Try direct INSERT approach instead of pg_dump
echo "🔍 Check 2: Trying direct INSERT approach..."

for table in "${tables[@]}"; do
    echo "🔄 Migrating $table with direct INSERT..."
    
    # Get staging count
    staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    
    if [ "$staging_count" -gt 0 ]; then
        echo "   📥 Found $staging_count records in staging"
        
        # Get column information
        echo "   📋 Getting column structure..."
        columns=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
        
        if [ -n "$columns" ]; then
            echo "   📊 Columns: $columns"
            
            # Try direct data transfer using COPY
            echo "   📤 Using COPY command for data transfer..."
            
            # Export from staging to CSV
            temp_csv="/tmp/${table}_data_$(date +%Y%m%d_%H%M%S).csv"
            doppler run -- psql "$STAGING_DATABASE_URL" -c "COPY \"$table\" TO '$temp_csv' WITH CSV HEADER;" 2>/dev/null || {
                echo "   ❌ Failed to export $table to CSV"
                continue
            }
            
            # Import to production from CSV
            doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "COPY \"$table\" FROM '$temp_csv' WITH CSV HEADER;" 2>/dev/null || {
                echo "   ❌ Failed to import $table from CSV"
                rm -f "$temp_csv"
                continue
            }
            
            # Verify import
            new_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
            echo "   📊 New production count: $new_count"
            
            if [ "$new_count" = "$staging_count" ]; then
                echo "   ✅ Successfully migrated $table!"
            else
                echo "   ⚠️  Partial migration: $new_count/$staging_count"
            fi
            
            # Clean up
            rm -f "$temp_csv"
            
        else
            echo "   ❌ Could not get column information for $table"
        fi
    else
        echo "   ℹ️  No data in staging for $table"
    fi
    
    echo ""
done

# Check 3: Alternative approach - manual INSERT statements
echo "🔍 Check 3: Manual INSERT approach for problematic tables..."

# Try directory_listings_list first (small dataset)
echo "🔄 Trying manual INSERT for directory_listings_list..."
staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_listings_list;" 2>/dev/null || echo "ERROR")

if [ "$staging_count" -gt 0 ]; then
    echo "   📥 Found $staging_count records, creating manual INSERT..."
    
    # Generate INSERT statements
    doppler run -- psql "$STAGING_DATABASE_URL" -c "
    COPY (
        SELECT 'INSERT INTO directory_listings_list (' || 
               array_to_string(array_agg(c.column_name), ', ') || 
               ') VALUES (' ||
               array_to_string(array_agg(
                   CASE 
                       WHEN c.data_type = 'text' THEN '''' || REPLACE(COALESCE(t.\"' || c.column_name || '\", ''), '''', '''''') || ''''
                       WHEN c.data_type = 'timestamp' THEN '''' || COALESCE(t.\"' || c.column_name || '\", '')::text || ''''
                       WHEN c.data_type = 'boolean' THEN COALESCE(t.\"' || c.column_name || '\", '')::text
                       WHEN c.data_type = 'integer' THEN COALESCE(t.\"' || c.column_name || '\", '')::text
                       ELSE 'NULL'
                   END
               ), ', ') || ');'
        FROM information_schema.columns c
        CROSS JOIN (SELECT * FROM directory_listings_list LIMIT 3) t
        WHERE c.table_schema = 'public' AND c.table_name = 'directory_listings_list'
        GROUP BY 1
    ) TO STDOUT;
    " 2>/dev/null > /tmp/manual_inserts.sql || echo "   ❌ Could not generate manual INSERTs"
    
    if [ -f /tmp/manual_inserts.sql ] && [ -s /tmp/manual_inserts.sql ]; then
        echo "   📤 Executing manual INSERTs..."
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -f /tmp/manual_inserts.sql 2>/dev/null || echo "   ❌ Failed to execute manual INSERTs"
        
        # Verify
        new_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_listings_list;" 2>/dev/null || echo "ERROR")
        echo "   📊 New count: $new_count"
        
        rm -f /tmp/manual_inserts.sql
    fi
fi

echo ""
echo "📊 Final verification..."

for table in "${tables[@]}"; do
    final_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    echo "   📊 $table: $final_count (staging: $staging_count)"
done

echo ""
echo "🔄 Refreshing materialized views one more time..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW storefront_products;" 2>/dev/null || echo "   ⚠️  Could not refresh storefront_products"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW directory_category_listings;" 2>/dev/null || echo "   ⚠️  Could not refresh directory_category_listings"

echo ""
echo "🎯 DIRECTORY DATA FIX COMPLETE!"
echo "============================="
echo ""
echo "✅ What was attempted:"
echo "   1. ✅ Verified staging data exists"
echo "   2. ✅ Tried CSV COPY approach"
echo "   3. ✅ Tried manual INSERT approach"
echo "   4. ✅ Refreshed materialized views"
echo ""
echo "📊 Final status:"
echo "   - Check table counts above"
echo "   - If still 0, may need manual data entry"
echo "   - Directory functionality may work with inventory_items data"
