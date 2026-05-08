#!/bin/bash

set -e

echo "🚨 Fix Critical Data Gaps and Schema Issues"
echo "=========================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Fixing tenants table (highest priority)..."

# First, let's check the actual tenants schema
echo "🔍 Checking tenants schema in production:"
psql "$PRODUCTION_DATABASE_URL" -c "\d tenants"

echo ""
echo "📦 Replacing tenants table with staging data..."

# Drop and recreate tenants table from staging
psql "$PRODUCTION_DATABASE_URL" -c "
-- Drop the existing production tenants table
DROP TABLE IF EXISTS tenants CASCADE;

-- Disable constraints for import
SET session_replication_role = replica;
"

echo "✅ Production tenants table dropped"

# Export and import the complete tenants table from staging
echo "📦 Exporting tenants table from staging..."
pg_dump "$STAGING_DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --table=tenants \
  --file=tenants_schema.sql

echo "✅ Tenants schema exported"

# Import schema to production
echo "📦 Importing tenants schema to production..."
psql "$PRODUCTION_DATABASE_URL" -f tenants_schema.sql

echo "✅ Tenants schema imported"

# Export data from staging
echo "📦 Exporting tenants data from staging..."
psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM tenants) TO STDOUT WITH CSV HEADER" | \
psql "$PRODUCTION_DATABASE_URL" -c "COPY tenants FROM STDIN WITH CSV HEADER"

echo "✅ Tenants data imported"

# Reset sequences
echo "📦 Resetting tenants sequences..."
psql "$PRODUCTION_DATABASE_URL" -c "
-- Reset sequences if any exist
SELECT setval(pg_get_serial_sequence('tenants', 'id'), COALESCE(MAX(id)::integer, 1), MAX(id) IS NOT NULL) FROM tenants WHERE pg_get_serial_sequence('tenants', 'id') IS NOT NULL;

-- Re-enable constraints and triggers
SET session_replication_role = DEFAULT;

SELECT 'Tenants table replaced successfully!' as status;
"

# Clean up
rm -f tenants_schema.sql

echo ""
echo "📊 Verifying tenants data:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, name, slug, is_active FROM tenants ORDER BY created_at;"

echo ""
echo "📦 Now fixing inventory_items data gap..."

# Check inventory_items data
staging_inv=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items;" | tr -d ' ')
production_inv=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items;" | tr -d ' ')

echo "Staging inventory_items: $staging_inv rows"
echo "Production inventory_items: $production_inv rows"

if [ "$production_inv" -lt "$staging_inv" ]; then
  echo "🚨 Production missing inventory data - importing from staging..."
  
  # Export and import inventory data
  psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM inventory_items) TO STDOUT WITH CSV HEADER" | \
  psql "$PRODUCTION_DATABASE_URL" -c "COPY inventory_items FROM STDIN WITH CSV HEADER"
  
  echo "✅ Inventory items data imported"
fi

echo ""
echo "📦 Fixing user_tenants connections..."

# Check user_tenants data
staging_ut=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_tenants;" | tr -d ' ')
production_ut=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_tenants;" | tr -d ' ')

echo "Staging user_tenants: $staging_ut rows"
echo "Production user_tenants: $production_ut rows"

if [ "$production_ut" -lt "$staging_ut" ]; then
  echo "🚨 Production missing user-tenant connections - importing from staging..."
  
  # Export and import user_tenants data
  psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM user_tenants) TO STDOUT WITH CSV HEADER" | \
  psql "$PRODUCTION_DATABASE_URL" -c "COPY user_tenants FROM STDIN WITH CSV HEADER"
  
  echo "✅ User-tenant connections imported"
fi

echo ""
echo "✅ Critical Data Gaps Fixed!"
echo "============================"
echo ""
echo "🎯 What was fixed:"
echo "   - Tenants table completely replaced with staging data"
echo "   - Inventory items data imported if missing"
echo "   - User-tenant connections imported if missing"
echo ""
echo "🚀 Next Steps:"
echo "   1. Railway will automatically restart"
echo "   2. Test tenant-based functionality"
echo "   3. Verify user access to tenants"
echo ""
echo "🔍 Test the application:"
echo "   - Try logging into https://www.visibleshelf.com"
echo "   - Check if you can access tenant data"
echo "   - Verify inventory items are visible"
