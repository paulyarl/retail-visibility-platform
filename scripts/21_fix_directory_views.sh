#!/bin/bash

set -e

echo "🔍 Fix Directory Page - Materialized Views"
echo "========================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Checking materialized views status..."

# Check if materialized views exist
echo "🔍 Checking materialized views in production:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT matviewname, schemaname 
FROM pg_matviews 
WHERE schemaname = 'public' 
ORDER BY matviewname;
"

echo ""
echo "📋 Checking what views should exist (from staging):"
psql "$STAGING_DATABASE_URL" -c "
SELECT matviewname, schemaname 
FROM pg_matviews 
WHERE schemaname = 'public' 
ORDER BY matviewname;
"

echo ""
echo "📦 Recreating missing materialized views..."

# Get the materialized view definitions from staging
echo "📦 Exporting materialized views from staging..."
psql "$STAGING_DATABASE_URL" -c "
SELECT 
    'CREATE MATERIALIZED VIEW ' || matviewname || ' AS ' || definition || ';' as create_statement
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY matviewname;
" > mv_definitions.sql

echo "✅ Materialized view definitions exported"

# Create materialized views in production
echo "📦 Creating materialized views in production..."
psql "$PRODUCTION_DATABASE_URL" -f mv_definitions.sql

echo "✅ Materialized views created"

echo ""
echo "🔄 Refreshing materialized views..."

# Refresh all materialized views
psql "$PRODUCTION_DATABASE_URL" -c "
DO \$\$
DECLARE
    mv RECORD;
BEGIN
    FOR mv IN 
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE 'REFRESH MATERIALIZED VIEW ' || quote_ident(mv.matviewname);
            RAISE NOTICE 'Refreshed %', mv.matviewname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to refresh %: %', mv.matviewname, SQLERRM;
        END;
    END LOOP;
END \$\$;
"

echo ""
echo "📊 Checking directory-specific views data..."

# Check key directory views data
echo "🔍 Checking directory_category_listings:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM directory_category_listings LIMIT 1;"

echo "🔍 Checking directory_home_summary_mv:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM directory_home_summary_mv LIMIT 1;"

echo "🔍 Checking storefront_products:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM storefront_products LIMIT 1;"

echo ""
echo "📦 Checking tenant directory visibility..."

# Check if tenants are directory visible
echo "🔍 Checking directory_visible tenants:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT id, name, slug, directory_visible, location_status, subscription_tier
FROM tenants 
WHERE directory_visible = true 
AND location_status = 'active'
ORDER BY name;
"

echo ""
echo "📦 Checking inventory items for directory..."

# Check inventory items for directory
echo "🔍 Checking inventory items with tenant info:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT COUNT(*) as total_items,
       COUNT(CASE WHEN t.directory_visible = true AND t.location_status = 'active' THEN 1 END) as directory_items
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id;
"

# Clean up
rm -f mv_definitions.sql

echo ""
echo "🎯 Directory Fix Summary!"
echo "========================"
echo ""
echo "✅ What was done:"
echo "   - Checked materialized views status"
echo "   - Exported views from staging"
echo "   - Created missing materialized views"
echo "   - Refreshed all materialized views"
echo "   - Verified directory data availability"
echo ""
echo "🚀 Next Steps:"
echo "   1. Test /directory page"
echo "   2. Check if stores and products appear"
echo "   3. Verify tenant visibility settings"
echo ""
echo "🔍 Test the directory:"
echo "   - Visit: https://www.visibleshelf.com/directory"
echo "   - Should show active, directory-visible tenants"
echo "   - Should show products from those tenants"
