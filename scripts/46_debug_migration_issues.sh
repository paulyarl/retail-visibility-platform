#!/bin/bash

set -e
echo "🔍 DEBUGGING MIGRATION ISSUES"
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

echo "🔍 Deep debugging of migration failures..."
echo ""

# Check 1: Table structure comparison
echo "🔍 Check 1: Comparing table structures between staging and production..."

tables=("directory_settings_list" "directory_listings_list" "directory_photos")

for table in "${tables[@]}"; do
    echo ""
    echo "📋 $table structure comparison:"
    
    echo "   Staging columns:"
    doppler run -- psql "$STAGING_DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;" 2>/dev/null || echo "   ❌ Could not get staging columns"
    
    echo "   Production columns:"
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;" 2>/dev/null || echo "   ❌ Could not get production columns"
    
    echo ""
done

# Check 2: Constraints and indexes
echo "🔍 Check 2: Checking constraints and indexes..."

for table in "${tables[@]}"; do
    echo ""
    echo "📋 $table constraints:"
    
    echo "   Staging constraints:"
    doppler run -- psql "$STAGING_DATABASE_URL" -c "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = '$table';" 2>/dev/null || echo "   ❌ Could not get staging constraints"
    
    echo "   Production constraints:"
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = '$table';" 2>/dev/null || echo "   ❌ Could not get production constraints"
    
    echo ""
done

# Check 3: Try simple INSERT with explicit columns
echo "🔍 Check 3: Trying simple INSERT with explicit columns..."

echo "🔄 Testing directory_settings_list with simple INSERT..."
echo "   Getting one record from staging..."
sample_record=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at FROM directory_settings_list LIMIT 1;" 2>/dev/null)

if [ -n "$sample_record" ]; then
    echo "   📊 Sample record found: $sample_record"
    
    # Try to insert this one record manually
    echo "   📤 Trying manual INSERT of one record..."
    
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    INSERT INTO directory_settings_list (id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at)
    SELECT id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at
    FROM (
        SELECT id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at
        FROM dblink('$STAGING_DATABASE_URL', 'SELECT id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at FROM directory_settings_list LIMIT 1')
        AS t(id TEXT, tenant_id TEXT, is_published BOOLEAN, seo_description TEXT, seo_keywords TEXT[], primary_category TEXT, secondary_categories TEXT[], is_featured BOOLEAN, featured_until TIMESTAMP, slug TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)
    ) subquery
    ON CONFLICT (id) DO NOTHING;
    " 2>/dev/null && {
        echo "   ✅ Manual INSERT successful!"
        
        # Check count
        new_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM directory_settings_list;" 2>/dev/null || echo "ERROR")
        echo "   📊 New count: $new_count"
    } || {
        echo "   ❌ Manual INSERT failed"
    }
else
    echo "   ❌ No sample record found"
fi

echo ""

# Check 4: Try dblink approach for all data
echo "🔍 Check 4: Trying dblink approach for full migration..."

for table in "${tables[@]}"; do
    echo "🔄 Migrating $table with dblink..."
    
    # Get staging count
    staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    
    if [ "$staging_count" -gt 0 ]; then
        echo "   📥 Found $staging_count records"
        
        case "$table" in
            "directory_settings_list")
                doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
                INSERT INTO directory_settings_list (id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at)
                SELECT id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at
                FROM dblink('$STAGING_DATABASE_URL', 'SELECT id, tenant_id, is_published, seo_description, seo_keywords, primary_category, secondary_categories, is_featured, featured_until, slug, created_at, updated_at FROM directory_settings_list')
                AS t(id TEXT, tenant_id TEXT, is_published BOOLEAN, seo_description TEXT, seo_keywords TEXT[], primary_category TEXT, secondary_categories TEXT[], is_featured BOOLEAN, featured_until TIMESTAMP, slug TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)
                ON CONFLICT (id) DO NOTHING;
                " 2>/dev/null && echo "   ✅ dblink migration successful for $table" || echo "   ❌ dblink migration failed for $table"
                ;;
            "directory_listings_list")
                doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
                INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, email, website, latitude, longitude, primary_category, secondary_categories, logo_url, description, business_hours, rating_avg, rating_count, product_count, is_featured, subscription_tier, use_custom_website, is_published, created_at, updated_at, keywords)
                SELECT id, tenant_id, business_name, slug, address, city, state, zip_code, phone, email, website, latitude, longitude, primary_category, secondary_categories, logo_url, description, business_hours, rating_avg, rating_count, product_count, is_featured, subscription_tier, use_custom_website, is_published, created_at, updated_at, keywords
                FROM dblink('$STAGING_DATABASE_URL', 'SELECT id, tenant_id, business_name, slug, address, city, state, zip_code, phone, email, website, latitude, longitude, primary_category, secondary_categories, logo_url, description, business_hours, rating_avg, rating_count, product_count, is_featured, subscription_tier, use_custom_website, is_published, created_at, updated_at, keywords FROM directory_listings_list')
                AS t(id TEXT, tenant_id TEXT, business_name TEXT, slug TEXT, address TEXT, city TEXT, state TEXT, zip_code TEXT, phone TEXT, email TEXT, website TEXT, latitude FLOAT, longitude FLOAT, primary_category TEXT, secondary_categories TEXT[], logo_url TEXT, description TEXT, business_hours JSONB, rating_avg FLOAT, rating_count INTEGER, product_count INTEGER, is_featured BOOLEAN, subscription_tier TEXT, use_custom_website BOOLEAN, is_published BOOLEAN, created_at TIMESTAMP, updated_at TIMESTAMP, keywords JSONB)
                ON CONFLICT (id) DO NOTHING;
                " 2>/dev/null && echo "   ✅ dblink migration successful for $table" || echo "   ❌ dblink migration failed for $table"
                ;;
            "directory_photos")
                doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
                INSERT INTO directory_photos (id, tenant_id, listing_id, url, width, height, content_type, bytes, exif_removed, captured_at, created_at, public_url, signed_url, position, alt, caption)
                SELECT id, tenant_id, listing_id, url, width, height, content_type, bytes, exif_removed, captured_at, created_at, public_url, signed_url, position, alt, caption
                FROM dblink('$STAGING_DATABASE_URL', 'SELECT id, tenant_id, listing_id, url, width, height, content_type, bytes, exif_removed, captured_at, created_at, public_url, signed_url, position, alt, caption FROM directory_photos')
                AS t(id UUID, tenant_id TEXT, listing_id TEXT, url TEXT, width INTEGER, height INTEGER, content_type TEXT, bytes INTEGER, exif_removed BOOLEAN, captured_at TIMESTAMP, created_at TIMESTAMP, public_url TEXT, signed_url TEXT, position INTEGER, alt TEXT, caption TEXT)
                ON CONFLICT (id) DO NOTHING;
                " 2>/dev/null && echo "   ✅ dblink migration successful for $table" || echo "   ❌ dblink migration failed for $table"
                ;;
        esac
        
        # Check result
        new_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        echo "   📊 New count: $new_count (expected: $staging_count)"
    fi
    
    echo ""
done

echo "📊 Final verification..."
for table in "${tables[@]}"; do
    final_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    echo "   📊 $table: $final_count (staging: $staging_count)"
done

echo ""
echo "🎯 DEBUGGING COMPLETE!"
echo "===================="
echo ""
echo "✅ What was checked:"
echo "   1. ✅ Table structure comparison"
echo "   2. ✅ Constraints and indexes"
echo "   3. ✅ Simple INSERT test"
echo "   4. ✅ dblink migration attempt"
echo ""
echo "📊 If counts still 0, the issue may be:"
echo "   - Permission problems"
echo "   - Constraint violations"
echo "   - Data type mismatches"
echo "   - Missing dependencies"
