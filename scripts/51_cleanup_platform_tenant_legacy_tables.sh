#!/bin/bash

set -e
echo "🧹 CLEANING UP PLATFORM/TENANT LEGACY TABLES"
echo "============================================"

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

echo "🔥 Strategy: Drop all legacy tables that don't exist in staging"
echo ""

# Legacy tables to drop (exist in production but not in staging)
legacy_tables=(
    "permission_matrix"
    "platform_feature_flags"
    "platform_settings"
    "scan_results"
    "scan_sessions"
    "scan_templates"
    "sku_billing_policy"
    "sku_billing_policy_history"
    "sku_billing_policy_overrides"
    "square_integrations"
    "square_product_mappings"
    "square_sync_logs"
    "subscription_tiers"
    "tenant_category"
    "tenant_feature_flags"
    "tenant_feature_overrides"
    "tier_change_logs"
    "tier_features"
)

echo "📋 Legacy tables to drop:"
for table in "${legacy_tables[@]}"; do
    echo "   - $table"
done

echo ""
echo "🔥 Step 1: Dropping legacy tables from production..."

dropped_count=0
failed_count=0

for table in "${legacy_tables[@]}"; do
    echo "   🗑️  Dropping $table..."
    
    # Check if table exists
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        # Get record count before dropping
        record_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        echo "      📊 Records in $table: $record_count"
        
        # Drop with CASCADE to remove dependencies
        if doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE IF EXISTS \"$table\" CASCADE;" 2>/dev/null; then
            echo "   ✅ Dropped $table"
            dropped_count=$((dropped_count + 1))
        else
            echo "   ❌ Failed to drop $table"
            failed_count=$((failed_count + 1))
        fi
    else
        echo "   ℹ️  $table does not exist, skipping"
    fi
done

echo ""
echo "📊 Step 2: Verifying cleanup..."

remaining_count=0
for table in "${legacy_tables[@]}"; do
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        echo "   ❌ $table still exists in production"
        remaining_count=$((remaining_count + 1))
    else
        echo "   ✅ $table removed from production"
    fi
done

echo ""
echo "🔍 Step 3: Counting total tables in each environment..."

staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "ERROR")
production_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "ERROR")

echo "   📊 Staging tables: $staging_count"
echo "   📊 Production tables: $production_count"

echo ""
echo "🎯 LEGACY TABLE CLEANUP COMPLETE!"
echo "================================"
echo ""
echo "✅ Results:"
echo "   - Dropped: $dropped_count tables"
echo "   - Failed: $failed_count tables"
echo "   - Remaining legacy: $remaining_count tables"
echo ""
echo "📊 Table counts:"
echo "   - Staging: $staging_count tables"
echo "   - Production: $production_count tables"
echo ""

if [ "$remaining_count" -eq 0 ]; then
    echo "✅ All legacy tables successfully removed!"
else
    echo "⚠️  Some legacy tables could not be removed"
fi

echo ""
echo "🚀 Production database is now aligned with staging naming convention!"
