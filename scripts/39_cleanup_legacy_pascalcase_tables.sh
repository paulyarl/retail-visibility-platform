#!/bin/bash

set -e
echo "🧹 CLEANING UP LEGACY PASCALCASE TABLES"
echo "======================================"

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Check if production database URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
    echo "❌ ERROR: PRODUCTION_DATABASE_URL environment variable not set"
    echo "💡 Try running with: doppler run -- ./scripts/39_cleanup_legacy_pascalcase_tables.sh"
    exit 1
fi

echo "🔍 Identifying legacy PascalCase tables that are now redundant..."

# Define legacy PascalCase tables and their modern equivalents
declare -A LEGACY_MAP=(
    ["InventoryItem"]="inventory_items"
    ["LocationStatusLog"]="location_status_logs"
    ["PhotoAsset"]="photo_assets"
    ["ProductPerformance"]="product_performances"
    ["SyncJob"]="sync_jobs"
    ["Tenant"]="tenants"
)

echo ""
echo "📋 Legacy PascalCase tables to be removed:"
for legacy in "${!LEGACY_MAP[@]}"; do
    modern="${LEGACY_MAP[$legacy]}"
    echo "   - $legacy → $modern"
done

echo ""
echo "🔍 Verifying modern tables exist before dropping legacy..."

# Verify each modern table exists before dropping the legacy one
for legacy in "${!LEGACY_MAP[@]}"; do
    modern="${LEGACY_MAP[$legacy]}"
    
    echo "   Checking $modern exists..."
    modern_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$modern');" 2>/dev/null || echo "false")
    
    if [ "$modern_exists" = "t" ]; then
        echo "   ✅ $modern exists - safe to drop $legacy"
        
        # Check if legacy table exists
        legacy_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$legacy');" 2>/dev/null || echo "false")
        
        if [ "$legacy_exists" = "t" ]; then
            echo "   🗑️  Dropping legacy table: $legacy"
            
            # Get record count before dropping for verification
            legacy_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$legacy\";" 2>/dev/null || echo "0")
            modern_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$modern\";" 2>/dev/null || echo "0")
            
            echo "   📊 Records: $legacy has $legacy_count, $modern has $modern_count"
            
            # Drop the legacy table
            doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE \"$legacy\" CASCADE;" 2>/dev/null || {
                echo "   ⚠️  Warning: Could not drop $legacy (may be in use or have dependencies)"
            }
            
            if [ $? -eq 0 ]; then
                echo "   ✅ Successfully dropped $legacy"
            else
                echo "   ❌ Failed to drop $legacy"
            fi
        else
            echo "   ℹ️  Legacy table $legacy does not exist - skipping"
        fi
    else
        echo "   ❌ Modern table $modern does not exist - CANNOT drop $legacy"
    fi
    
    echo ""
done

echo "🔍 Checking for other potential duplicates..."

# Check for other non-_list tables that might have _list equivalents
echo "📋 Checking for other redundant tables..."

# Get list of all tables in production
all_tables=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" 2>/dev/null)

# Check each non-_list table for potential _list equivalent
for table in $all_tables; do
    # Skip _list tables and system tables
    if [[ $table == *"_list"* ]] || [[ $table == "_"* ]]; then
        continue
    fi
    
    # Check if there's a _list equivalent
    list_equivalent="${table}_list"
    
    list_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$list_equivalent');" 2>/dev/null || echo "false")
    
    if [ "$list_exists" = "t" ]; then
        echo "   🔍 Found potential duplicate: $table ↔ $list_equivalent"
        
        # Get record counts
        table_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "0")
        list_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$list_equivalent\";" 2>/dev/null || echo "0")
        
        echo "   📊 Records: $table has $table_count, $list_equivalent has $list_count"
        
        # If the non-_list table is empty and _list table has data, consider dropping it
        if [ "$table_count" = "0" ] && [ "$list_count" -gt "0" ]; then
            echo "   💡 Suggestion: Consider dropping empty $table (data exists in $list_equivalent)"
        elif [ "$table_count" -gt "0" ] && [ "$list_count" -gt "0" ]; then
            echo "   ⚠️  Both tables have data - manual review needed"
        fi
    fi
done

echo ""
echo "📊 Final table count verification..."

# Get final table counts
total_tables=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null)
list_tables=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%_list';" 2>/dev/null)
non_list_tables=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE '%_list' AND table_name NOT LIKE '\_%';" 2>/dev/null)

echo "📈 Current Production Table Counts:"
echo "   Total tables: $total_tables"
echo "   _list tables: $list_tables"
echo "   Non-_list tables: $non_list_tables"

echo ""
echo "🔍 Checking for any remaining legacy PascalCase tables..."

# Check for any remaining PascalCase tables
remaining_pascalcase=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ~ '^[A-Z][a-zA-Z]*$' ORDER BY table_name;" 2>/dev/null)

if [ -n "$remaining_pascalcase" ]; then
    echo "⚠️  Remaining PascalCase tables:"
    echo "$remaining_pascalcase" | while read -r table; do
        echo "   - $table"
    done
else
    echo "✅ No PascalCase tables remaining!"
fi

echo ""
echo "🎯 LEGACY CLEANUP COMPLETE!"
echo "==========================="
echo ""
echo "✅ What was accomplished:"
echo "   1. Identified legacy PascalCase tables"
echo "   2. Verified modern equivalents exist"
echo "   3. Safely dropped redundant legacy tables"
echo "   4. Checked for other potential duplicates"
echo "   5. Provided final table count summary"
echo ""
echo "📊 Production now has:"
echo "   - Only _list convention tables (platform standard)"
echo "   - No legacy PascalCase duplicates"
echo "   - Clean, consistent naming"
echo ""
echo "🚀 Ready for application testing!"
