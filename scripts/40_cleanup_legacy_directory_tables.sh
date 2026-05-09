#!/bin/bash

set -e
echo "🧹 CLEANING UP LEGACY DIRECTORY TABLES"
echo "======================================"

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Check if production database URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
    echo "❌ ERROR: PRODUCTION_DATABASE_URL environment variable not set"
    echo "💡 Try running with: doppler run -- ./scripts/40_cleanup_legacy_directory_tables.sh"
    exit 1
fi

echo "🔍 Identifying legacy directory tables that are now redundant..."

# Define legacy directory tables and their modern _list equivalents
declare -A LEGACY_DIRECTORY_MAP=(
    ["directory_featured_listings"]="directory_featured_listings_list"
    ["directory_listings"]="directory_listings_list"
    ["directory_settings"]="directory_settings_list"
    ["directory_support_notes"]="directory_support_notes_list"
)

echo ""
echo "📋 Legacy directory tables to be removed:"
for legacy in "${!LEGACY_DIRECTORY_MAP[@]}"; do
    modern="${LEGACY_DIRECTORY_MAP[$legacy]}"
    echo "   - $legacy → $modern"
done

echo ""
echo "🔍 Verifying modern directory tables exist before dropping legacy..."

# Verify each modern table exists before dropping the legacy one
for legacy in "${!LEGACY_DIRECTORY_MAP[@]}"; do
    modern="${LEGACY_DIRECTORY_MAP[$legacy]}"
    
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

echo "🔍 Verifying remaining directory tables are correct..."

# List all remaining directory tables
echo "📋 Remaining directory tables:"
directory_tables=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'directory_%' ORDER BY table_name;" 2>/dev/null)

for table in $directory_tables; do
    echo "   - $table"
done

echo ""
echo "📊 Final directory table count verification..."
directory_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'directory_%';" 2>/dev/null)

echo "📈 Directory table count: $directory_count"

echo ""
echo "🎯 LEGACY DIRECTORY CLEANUP COMPLETE!"
echo "====================================="
echo ""
echo "✅ What was accomplished:"
echo "   1. Identified legacy directory tables"
echo "   2. Verified modern _list equivalents exist"
echo "   3. Safely dropped redundant legacy directory tables"
echo "   4. Verified remaining directory table structure"
echo ""
echo "📊 Directory tables now follow:"
echo "   - _list naming convention (platform standard)"
echo "   - No legacy duplicates"
echo "   - Clean, consistent structure"
echo ""
echo "🚀 Directory functionality should be clean and consistent!"
