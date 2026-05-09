#!/bin/bash

set -e
echo "🔍 CRITICAL TABLE COUNT VERIFICATION"
echo "==================================="

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

echo "🔍 Comparing record counts for critical tables..."
echo ""

# Critical tables to verify (most important ones)
critical_tables=(
    "tenants"
    "users"
    "user_tenants"
    "user_sessions_list"
    "user_behavior_simple"
    "inventory_items"
    "directory_settings_list"
    "directory_listings_list"
    "directory_photos"
    "directory_category"
    "directory_listing_categories"
    "directory_featured_listings_list"
    "organizations_list"
    "tenant_business_profiles_list"
    "tenant_payment_gateways"
    "subscription_tiers_list"
    "subscription_invoices"
    "subscription_payments"
    "platform_payment_config"
    "platform_fee_tiers"
    "platform_revenue_transactions"
    "permission_matrix_list"
    "permission_audit_logs_list"
    "scan_results_list"
    "scan_sessions_list"
    "square_integrations_list"
    "square_product_mappings_list"
    "square_sync_logs_list"
    "gbp_categories_list"
    "gbp_locations_list"
    "gbp_reviews_list"
    "google_business_profiles_list"
    "clover_inventory_list"
    "clover_sync_logs_list"
    "email_templates_list"
    "email_logs_list"
    "feed_jobs_list"
    "feed_templates_list"
)

echo "📋 Checking ${#critical_tables[@]} critical tables..."
echo ""

match_count=0
mismatch_count=0
missing_count=0

for table in "${critical_tables[@]}"; do
    # Check if table exists in both databases
    staging_exists=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table' AND table_type = 'BASE TABLE');" 2>/dev/null || echo "f")
    prod_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table' AND table_type = 'BASE TABLE');" 2>/dev/null || echo "f")
    
    if [ "$staging_exists" = "t" ] && [ "$prod_exists" = "t" ]; then
        # Get counts
        staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        production_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        
        if [ "$staging_count" = "$production_count" ]; then
            echo "   ✅ $table: $staging_count"
            match_count=$((match_count + 1))
        else
            echo "   ⚠️  $table: staging=$staging_count, production=$production_count"
            mismatch_count=$((mismatch_count + 1))
        fi
    elif [ "$staging_exists" = "f" ] && [ "$prod_exists" = "f" ]; then
        echo "   ℹ️  $table: not in either database"
    else
        echo "   ❌ $table: missing in one database (staging=$staging_exists, prod=$prod_exists)"
        missing_count=$((missing_count + 1))
    fi
done

echo ""
echo "📊 SUMMARY"
echo "=========="
echo "✅ Matching: $match_count"
echo "⚠️  Mismatched: $mismatch_count"
echo "❌ Missing: $missing_count"
echo "📊 Total checked: ${#critical_tables[@]}"

echo ""
echo "🎯 VERIFICATION COMPLETE!"
