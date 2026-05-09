#!/bin/bash

set -e
echo "🔧 MIGRATING TENANT_PAYMENT_GATEWAYS DATA"
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

echo "🔥 Migrating tenant_payment_gateways from staging to production..."
echo ""

# Check current state
echo "📊 Current state:"
staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")
production_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")

echo "   - Staging: $staging_count records"
echo "   - Production: $production_count records"
echo ""

if [ "$production_count" = "0" ] && [ "$staging_count" -gt 0 ]; then
    echo "📥 Exporting tenant_payment_gateways from staging..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    dump_file="/tmp/tenant_payment_gateways_${timestamp}.sql"
    
    # Export from staging
    doppler run -- pg_dump "$STAGING_DATABASE_URL" \
        --schema=public \
        --table="tenant_payment_gateways" \
        --no-owner \
        --no-privileges \
        --file="$dump_file" \
        2>/dev/null && echo "   ✅ Exported from staging" || {
            echo "   ❌ Failed to export from staging"
            exit 1
        }
    
    echo "📤 Importing tenant_payment_gateways to production..."
    
    # Import to production
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -f "$dump_file" 2>/dev/null && {
        # Verify import
        new_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")
        echo "   ✅ Imported to production: $new_count records"
        
        if [ "$new_count" = "$staging_count" ]; then
            echo "   ✅ Count matches staging!"
        else
            echo "   ⚠️  Count mismatch: expected $staging_count, got $new_count"
        fi
    } || {
        echo "   ❌ Failed to import to production"
        rm -f "$dump_file"
        exit 1
    }
    
    # Clean up
    rm -f "$dump_file"
    
else
    echo "ℹ️  No migration needed (production already has data or staging is empty)"
fi

echo ""
echo "📊 Final verification:"
final_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM tenant_payment_gateways;" 2>/dev/null || echo "ERROR")
echo "   - Production: $final_count records"
echo "   - Staging: $staging_count records"

if [ "$final_count" = "$staging_count" ]; then
    echo ""
    echo "✅ MIGRATION SUCCESSFUL!"
else
    echo ""
    echo "⚠️  Migration may have issues"
fi

echo ""
echo "🎯 COMPLETE!"
