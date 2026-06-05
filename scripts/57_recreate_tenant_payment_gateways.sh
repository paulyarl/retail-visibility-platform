#!/bin/bash

set -e
echo "🔄 RECREATING TENANT_PAYMENT_GATEWAYS FROM STAGING"
echo "================================================="

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

echo "🔥 Strategy: Drop and recreate tenant_payment_gateways from staging"
echo ""

# Step 1: Drop the table
echo "🔥 Step 1: Dropping tenant_payment_gateways from production..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE IF EXISTS tenant_payment_gateways CASCADE;" 2>/dev/null && echo "   ✅ Dropped" || echo "   ⚠️  Could not drop"

echo ""

# Step 2: Export from staging
echo "📥 Step 2: Exporting tenant_payment_gateways from staging..."
timestamp=$(date +%Y%m%d_%H%M%S)
dump_file="/tmp/tenant_payment_gateways_${timestamp}.sql"

doppler run -- pg_dump "$STAGING_DATABASE_URL" \
    --schema=public \
    --table="tenant_payment_gateways" \
    --no-owner \
    --no-privileges \
    --file="$dump_file" \
    2>/dev/null && echo "   ✅ Exported from staging" || {
        echo "   ❌ Failed to export"
        exit 1
    }

echo ""

# Step 3: Import to production
echo "📤 Step 3: Importing tenant_payment_gateways to production..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -f "$dump_file" 2>/dev/null && {
    count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")
    echo "   ✅ Imported: $count records"
} || {
    echo "   ❌ Failed to import"
    rm -f "$dump_file"
    exit 1
}

# Clean up
rm -f "$dump_file"

echo ""
echo "📊 Final verification:"
staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")
production_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")

echo "   - Staging: $staging_count records"
echo "   - Production: $production_count records"

if [ "$staging_count" = "$production_count" ]; then
    echo ""
    echo "✅ MIGRATION SUCCESSFUL - COUNTS MATCH!"
else
    echo ""
    echo "⚠️  Count mismatch"
fi

echo ""
echo "🎯 COMPLETE!"
