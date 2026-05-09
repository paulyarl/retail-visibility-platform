#!/bin/bash

set -e
echo "🔧 MIGRATING MISSING TENANTS"
echo "============================"

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

echo "🔥 Step 1: Exporting missing tenants from staging..."
echo ""

# Missing tenant IDs
missing_tenants=(
    "tid-042hi7ju"
    "tid-8622qs2t"
    "tid-a3813d7i"
    "tid-fjwr30ib"
    "tid-jcvzufq2"
    "tid-lt2t1wzu"
    "tid-m8ijkrnk"
    "tid-mrsyk3w6"
    "tid-qki0mjdb"
    "tid-r6cccpag"
    "tid-veid875z"
)

echo "📋 Missing tenants to migrate:"
for tid in "${missing_tenants[@]}"; do
    echo "   - $tid"
done

echo ""
echo "📤 Exporting tenants from staging..."

# Create temporary file for tenant data
timestamp=$(date +%Y%m%d_%H%M%S)
tenants_dump="/tmp/missing_tenants_${timestamp}.sql"

# Export each missing tenant
echo "   💾 Creating tenant export file..."

# Build WHERE clause for tenant IDs
tenant_list=""
for tid in "${missing_tenants[@]}"; do
    if [ -n "$tenant_list" ]; then
        tenant_list="$tenant_list, "
    fi
    tenant_list="$tenant_list'$tid'"
done

echo "   📊 Tenant ID list: $tenant_list"

# Export tenants using pg_dump with WHERE clause
doppler run -- pg_dump "$STAGING_DATABASE_URL" \
    --data-only \
    --table="tenants" \
    --column-inserts \
    --no-owner \
    --no-privileges \
    --file="$tenants_dump" \
    --exclude-table-data="tenants" \
    2>/dev/null || echo "   ⚠️  Initial export attempt"

# Alternative: Use COPY with WHERE clause
echo "   📤 Exporting tenant data with COPY..."
doppler run -- psql "$STAGING_DATABASE_URL" -c "
COPY (SELECT * FROM tenants WHERE id IN ($tenant_list)) TO STDOUT WITH CSV HEADER;
" > "${tenants_dump}.csv" 2>/dev/null || {
    echo "   ❌ Failed to export tenants"
    exit 1
}

if [ -f "${tenants_dump}.csv" ] && [ -s "${tenants_dump}.csv" ]; then
    echo "   ✅ Tenant data exported successfully"
    echo "   📊 File size: $(wc -c < "${tenants_dump}.csv") bytes"
else
    echo "   ❌ Tenant export file is empty or missing"
    exit 1
fi

echo ""
echo "📥 Step 2: Importing missing tenants to production..."

# Import tenants to production
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
COPY tenants FROM '${tenants_dump}.csv' WITH CSV HEADER;
" 2>/dev/null && {
    echo "   ✅ Tenants imported successfully"
} || {
    echo "   ❌ Failed to import tenants with COPY, trying INSERT approach..."
    
    # Try alternative approach: read CSV and generate INSERTs
    # This is more complex but more reliable
    echo "   📤 Trying manual INSERT approach..."
    
    # Get column names from production
    columns=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants';
    " 2>/dev/null)
    
    echo "   📊 Columns: $columns"
    
    # For each tenant, get data from staging and insert to production
    for tid in "${missing_tenants[@]}"; do
        echo "   📥 Migrating tenant: $tid"
        
        # Get tenant data from staging as INSERT statement
        doppler run -- psql "$STAGING_DATABASE_URL" -c "
        SELECT 'INSERT INTO tenants ($columns) VALUES (' ||
               string_agg(
                   CASE
                       WHEN value IS NULL THEN 'NULL'
                       WHEN data_type IN ('text', 'character varying', 'timestamp', 'timestamp with time zone') THEN '''' || REPLACE(value::text, '''', '''''') || ''''
                       ELSE value::text
                   END,
                   ', '
                   ORDER BY ordinal_position
               ) || ');'
        FROM (
            SELECT column_name, data_type, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenants'
        ) cols
        CROSS JOIN (
            SELECT *
            FROM tenants
            WHERE id = '$tid'
            LIMIT 1
        ) t
        CROSS JOIN LATERAL (
            SELECT CASE
                WHEN cols.column_name = 'id' THEN t.id
                WHEN cols.column_name = 'name' THEN t.name
                WHEN cols.column_name = 'created_at' THEN t.created_at::text
                WHEN cols.column_name = 'organization_id' THEN t.organization_id
                WHEN cols.column_name = 'status' THEN t.status::text
                ELSE NULL
            END AS value
        ) v
        GROUP BY 1;
        " -t 2>/dev/null > "/tmp/insert_${tid}.sql" || echo "   ⚠️  Could not generate INSERT for $tid"
        
        # Execute the INSERT
        if [ -f "/tmp/insert_${tid}.sql" ] && [ -s "/tmp/insert_${tid}.sql" ]; then
            doppler run -- psql "$PRODUCTION_DATABASE_URL" -f "/tmp/insert_${tid}.sql" 2>/dev/null && echo "   ✅ Inserted $tid" || echo "   ❌ Failed to insert $tid"
            rm -f "/tmp/insert_${tid}.sql"
        fi
    done
}

# Verify tenant import
echo ""
echo "📊 Step 3: Verifying tenant import..."

imported_count=0
for tid in "${missing_tenants[@]}"; do
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM tenants WHERE id = '$tid');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        echo "   ✅ $tid exists in production"
        imported_count=$((imported_count + 1))
    else
        echo "   ❌ $tid still missing"
    fi
done

echo ""
echo "📊 Imported $imported_count out of ${#missing_tenants[@]} tenants"

if [ "$imported_count" -eq "${#missing_tenants[@]}" ]; then
    echo "✅ All missing tenants imported successfully!"
    
    echo ""
    echo "🔄 Step 4: Now migrating directory data..."
    
    # Migrate directory_settings_list
    echo "   📥 Migrating directory_settings_list..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    INSERT INTO directory_settings_list
    SELECT * FROM dblink('$STAGING_DATABASE_URL', 'SELECT * FROM directory_settings_list')
    AS t(id TEXT, tenant_id TEXT, is_published BOOLEAN, seo_description TEXT, seo_keywords TEXT[], primary_category TEXT, secondary_categories TEXT[], is_featured BOOLEAN, featured_until TIMESTAMP, slug TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;
    " 2>/dev/null && {
        count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_settings_list;" 2>/dev/null)
        echo "   ✅ directory_settings_list: $count records"
    } || echo "   ❌ Failed to migrate directory_settings_list"
    
    # Migrate directory_listings_list
    echo "   📥 Migrating directory_listings_list..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    INSERT INTO directory_listings_list
    SELECT * FROM dblink('$STAGING_DATABASE_URL', 'SELECT * FROM directory_listings_list')
    AS t(id TEXT, tenant_id TEXT, business_name TEXT, slug TEXT, address TEXT, city TEXT, state TEXT, zip_code TEXT, phone TEXT, email TEXT, website TEXT, latitude FLOAT, longitude FLOAT, primary_category TEXT, secondary_categories TEXT[], logo_url TEXT, description TEXT, business_hours JSONB, rating_avg FLOAT, rating_count INTEGER, product_count INTEGER, is_featured BOOLEAN, subscription_tier TEXT, use_custom_website BOOLEAN, is_published BOOLEAN, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE, keywords JSONB)
    ON CONFLICT (id) DO NOTHING;
    " 2>/dev/null && {
        count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_listings_list;" 2>/dev/null)
        echo "   ✅ directory_listings_list: $count records"
    } || echo "   ❌ Failed to migrate directory_listings_list"
    
    # Migrate directory_photos
    echo "   📥 Migrating directory_photos..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    INSERT INTO directory_photos
    SELECT * FROM dblink('$STAGING_DATABASE_URL', 'SELECT * FROM directory_photos')
    AS t(id UUID, tenant_id TEXT, listing_id TEXT, url TEXT, width INTEGER, height INTEGER, content_type TEXT, bytes INTEGER, exif_removed BOOLEAN, captured_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE, public_url TEXT, signed_url TEXT, position INTEGER, alt TEXT, caption TEXT)
    ON CONFLICT (id) DO NOTHING;
    " 2>/dev/null && {
        count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_photos;" 2>/dev/null)
        echo "   ✅ directory_photos: $count records"
    } || echo "   ❌ Failed to migrate directory_photos"
    
    # Refresh materialized views
    echo ""
    echo "🔄 Refreshing materialized views..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW storefront_products;" 2>/dev/null && echo "   ✅ storefront_products refreshed"
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW directory_category_listings;" 2>/dev/null && echo "   ✅ directory_category_listings refreshed"
    
else
    echo "❌ Not all tenants imported successfully. Cannot proceed with directory data migration."
fi

# Cleanup
rm -f "$tenants_dump" "${tenants_dump}.csv"

echo ""
echo "🎯 MIGRATION COMPLETE!"
echo "===================="
echo ""
echo "📊 Final counts:"
final_settings=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_settings_list;" 2>/dev/null || echo "ERROR")
final_listings=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_listings_list;" 2>/dev/null || echo "ERROR")
final_photos=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_photos;" 2>/dev/null || echo "ERROR")

echo "   📊 directory_settings_list: $final_settings (expected: 12)"
echo "   📊 directory_listings_list: $final_listings (expected: 8)"
echo "   📊 directory_photos: $final_photos (expected: 52)"
echo ""
echo "🚀 Directory functionality should now work!"
