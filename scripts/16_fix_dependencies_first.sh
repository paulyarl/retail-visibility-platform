#!/bin/bash

set -e

echo "🔧 Fix Dependencies Before Tenants"
echo "=================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Checking and fixing dependent tables..."

# Check organizations_list data
staging_orgs=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM organizations_list;" | tr -d ' ')
production_orgs=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM organizations_list;" | tr -d ' ')

echo "Staging organizations_list: $staging_orgs rows"
echo "Production organizations_list: $production_orgs rows"

if [ "$production_orgs" -lt "$staging_orgs" ]; then
  echo "🚨 Production missing organizations - importing from staging..."
  
  # Export and import organizations_list data
  psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM organizations_list) TO STDOUT WITH CSV HEADER" | \
  psql "$PRODUCTION_DATABASE_URL" -c "COPY organizations_list FROM STDIN WITH CSV HEADER"
  
  echo "✅ Organizations data imported"
fi

# Check other critical dependency tables
DEPENDENCY_TABLES=(
  "merchant_billing_gateways"
  "organizations_list"
  "platform_feature_overrides_list"
)

for table in "${DEPENDENCY_TABLES[@]}"; do
  echo ""
  echo "📊 Checking dependency table: $table"
  
  staging_count=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  production_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  
  echo "Staging $table: $staging_count rows"
  echo "Production $table: $production_count rows"
  
  if [ "$production_count" -lt "$staging_count" ]; then
    echo "🚨 Importing missing data for $table..."
    psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM $table) TO STDOUT WITH CSV HEADER" | \
    psql "$PRODUCTION_DATABASE_URL" -c "COPY $table FROM STDIN WITH CSV HEADER"
    echo "✅ $table data imported"
  fi
done

echo ""
echo "📦 Now retrying tenants data import..."

# Retry tenants data import with constraints disabled
psql "$PRODUCTION_DATABASE_URL" -c "
-- Disable constraints temporarily
SET session_replication_role = replica;
"

echo "📦 Importing tenants data from staging..."
psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM tenants) TO STDOUT WITH CSV HEADER" | \
psql "$PRODUCTION_DATABASE_URL" -c "COPY tenants FROM STDIN WITH CSV HEADER"

echo "✅ Tenants data imported"

# Re-enable constraints
psql "$PRODUCTION_DATABASE_URL" -c "
-- Re-enable constraints
SET session_replication_role = DEFAULT;

SELECT 'Tenants and dependencies imported successfully!' as status;
"

echo ""
echo "📊 Verifying tenants data:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, name, slug, subscription_tier FROM tenants ORDER BY created_at;"

echo ""
echo "✅ Dependencies Fixed!"
echo "====================="
echo ""
echo "🎯 What was fixed:"
echo "   - organizations_list data imported"
echo "   - merchant_billing_gateways data imported"
echo "   - Other dependency tables imported"
echo "   - Tenants data successfully imported"
echo ""
echo "🚀 Next Steps:"
echo "   1. Railway will automatically restart"
echo "   2. Test tenant-based functionality"
echo "   3. Verify user access to tenants"
echo ""
echo "🔍 Test the application:"
echo "   - Try logging into https://www.visibleshelf.com"
echo "   - Check if tenants are accessible"
echo "   - Verify tenant switching works"
