#!/bin/bash

set -e

echo "🔍 Verify Schema Consistency for All Tables"
echo "=========================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Comparing critical tables between staging and production..."

# List of critical tables to check (excluding users - already fixed)
CRITICAL_TABLES=(
  "tenants"
  "inventory_items"
  "user_tenants"
  "platform_settings_list"
  "rate_limit_configurations"
  "platform_payment_config"
  "merchant_stripe_connections"
  "merchant_paypal_connections"
  "platform_feature_flags_list"
  "tenant_feature_flags_list"
  "platform_fee_tiers"
)

echo "🔍 Checking table schemas..."

for table in "${CRITICAL_TABLES[@]}"; do
  echo ""
  echo "📊 Checking table: $table"
  echo "------------------------"
  
  # Get column counts from both databases
  staging_cols=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '$table' AND table_schema = 'public';" | tr -d ' ')
  production_cols=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '$table' AND table_schema = 'public';" | tr -d ' ')
  
  echo "Staging columns: $staging_cols"
  echo "Production columns: $production_cols"
  
  if [ "$staging_cols" -ne "$production_cols" ]; then
    echo "⚠️  SCHEMA MISMATCH DETECTED for $table"
    echo "   Staging: $staging_cols columns"
    echo "   Production: $production_cols columns"
    
    # Get detailed column comparison
    echo ""
    echo "📋 Detailed column comparison for $table:"
    echo "Staging columns:"
    psql "$STAGING_DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '$table' AND table_schema = 'public' ORDER BY ordinal_position;"
    echo ""
    echo "Production columns:"
    psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '$table' AND table_schema = 'public' ORDER BY ordinal_position;"
    echo ""
  else
    echo "✅ Schema matches for $table"
  fi
done

echo ""
echo "🎯 Schema Verification Complete!"
echo "==============================="
echo ""
echo "📊 Summary:"
echo "   - Checked ${#CRITICAL_TABLES[@]} critical tables"
echo "   - Identified schema mismatches"
echo "   - Ready for targeted fixes"
echo ""
echo "🚀 Next Steps:"
echo "   1. Review mismatched tables above"
echo "   2. Run targeted table replacement scripts"
echo "   3. Test application functionality"
