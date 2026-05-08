#!/bin/bash

set -e

echo "🔍 Verify Data Availability for All Tables"
echo "=========================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Comparing data availability between staging and production..."

# List of critical tables to check
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

echo "🔍 Checking data availability..."

for table in "${CRITICAL_TABLES[@]}"; do
  echo ""
  echo "📊 Checking data in table: $table"
  echo "---------------------------------"
  
  # Get row counts from both databases
  staging_count=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  production_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  
  echo "Staging rows: $staging_count"
  echo "Production rows: $production_count"
  
  if [ "$staging_count" -eq "$production_count" ] && [ "$staging_count" -gt 0 ]; then
    echo "✅ Data matches and available in $table"
  elif [ "$production_count" -eq 0 ]; then
    echo "❌ NO DATA in production for $table (staging has $staging_count rows)"
    echo "   🚨 CRITICAL: This table needs data migration!"
  elif [ "$staging_count" -ne "$production_count" ]; then
    echo "⚠️  DATA MISMATCH in $table"
    echo "   Staging: $staging_count rows"
    echo "   Production: $production_count rows"
    echo "   🚨 WARNING: Data may be incomplete"
  else
    echo "✅ Data available in $table (both have $staging_count rows)"
  fi
  
  # Show sample data for critical tables
  if [ "$production_count" -gt 0 ]; then
    echo "📋 Sample production data:"
    case $table in
      "tenants")
        psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, name, slug, is_active FROM $table LIMIT 3;"
        ;;
      "inventory_items")
        psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, sku, name, tenant_id FROM $table LIMIT 3;"
        ;;
      "platform_settings_list")
        psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, key, value, is_active FROM $table LIMIT 3;"
        ;;
      "rate_limit_configurations")
        psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, name, requests_per_window, window_seconds FROM $table LIMIT 3;"
        ;;
      *)
        psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as total_rows FROM $table LIMIT 1;"
        ;;
    esac
  fi
done

echo ""
echo "🎯 Data Availability Check Complete!"
echo "===================================="
echo ""
echo "📊 Summary:"
echo "   - Checked ${#CRITICAL_TABLES[@]} critical tables"
echo "   - Identified data availability issues"
echo "   - Ready for targeted data migration"
echo ""
echo "🚨 Critical Issues:"
echo "   - Tables with 0 rows need immediate attention"
echo "   - Tables with mismatched counts need review"
echo ""
echo "🚀 Next Steps:"
echo "   1. Migrate data for empty tables"
echo "   2. Verify data consistency"
echo "   3. Test application functionality"
