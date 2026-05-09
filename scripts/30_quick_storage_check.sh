#!/bin/bash

set -e

echo "⚡ Quick Storage Bucket Check"
echo "=========================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Set Supabase variables
STAGING_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
PRODUCTION_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo "📋 Quick bucket file counts..."

# Check staging buckets
echo ""
echo "🔍 STAGING BUCKETS:"
echo "=================="

buckets=("photos" "tenants" "brands" "product-cache")

for bucket in "${buckets[@]}"; do
  echo ""
  echo "📦 Bucket: $bucket"
  
  # Simple file count request
  response=$(curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
                   -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
                   "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=1" 2>/dev/null)
  
  # Check if response is valid JSON and has items
  if echo "$response" | jq -e '.[]' >/dev/null 2>&1; then
    count=$(echo "$response" | jq '. | length' 2>/dev/null || echo "0")
    echo "   Files: $count"
    
    if [ "$count" -gt 0 ]; then
      echo "   Sample: $(echo "$response" | jq -r '.[0].name' 2>/dev/null)"
    fi
  else
    echo "   Files: 0 (empty or error)"
  fi
done

echo ""
echo "🔍 PRODUCTION BUCKETS:"
echo "====================="

# Check production buckets
prod_response=$(curl -s -H "apikey: $PRODUCTION_SUPABASE_KEY" \
                     -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
                     "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" 2>/dev/null)

if echo "$prod_response" | jq -e '.[]' >/dev/null 2>&1; then
  prod_buckets=$(echo "$prod_response" | jq -r '.[] | .name' 2>/dev/null)
  
  for bucket in $prod_buckets; do
    echo ""
    echo "📦 Bucket: $bucket"
    
    # Simple file count request
    response=$(curl -s -H "apikey: $PRODUCTION_SUPABASE_KEY" \
                     -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
                     "$PRODUCTION_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=1" 2>/dev/null)
    
    # Check if response is valid JSON and has items
    if echo "$response" | jq -e '.[]' >/dev/null 2>&1; then
      count=$(echo "$response" | jq '. | length' 2>/dev/null || echo "0")
      echo "   Files: $count"
      
      if [ "$count" -gt 0 ]; then
        echo "   Sample: $(echo "$response" | jq -r '.[0].name' 2>/dev/null)"
      fi
    else
      echo "   Files: 0 (empty or error)"
    fi
  done
else
  echo "   No buckets or API error"
fi

echo ""
echo "🔍 DATABASE IMAGE CHECK:"
echo "======================"

# Check database for image URLs
image_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url IS NOT NULL AND image_url != '';" | tr -d ' ')
echo "Products with images: $image_count"

if [ "$image_count" -gt 0 ]; then
  echo ""
  echo "🖼️ Sample image URLs:"
  psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, name, image_url FROM inventory_items WHERE image_url IS NOT NULL AND image_url != '' LIMIT 3;"
fi

echo ""
echo "🎯 Quick Check Complete!"
echo "===================="
echo ""
echo "📊 Summary:"
echo "   - Staging buckets: 4 buckets"
echo "   - Production buckets: $(echo "$prod_response" | jq '. | length' 2>/dev/null || echo "0") buckets"
echo "   - Database images: $image_count products"
echo ""
echo "🚀 If buckets are empty but database has image URLs, images may be:"
echo "   - Stored externally (CDN, S3, etc.)"
echo "   - Using direct URLs in database"
echo "   - Not requiring Supabase storage migration"
