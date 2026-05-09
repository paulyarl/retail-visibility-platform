#!/bin/bash

set -e

echo "🔍 Diagnose Supabase Storage Contents"
echo "===================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Set Supabase variables
STAGING_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
PRODUCTION_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo "📋 Environment Variables:"
echo "   Staging URL: $STAGING_SUPABASE_URL"
echo "   Production URL: $PRODUCTION_SUPABASE_URL"
echo "   Service Key: ${STAGING_SUPABASE_KEY:0:20}..."

echo ""
echo "🔍 1. DETAILED STAGING BUCKET ANALYSIS"
echo "===================================="

# Test staging API connection
echo "🔍 Testing staging API connection..."
staging_test=$(curl -s -w "%{http_code}" -H "apikey: $STAGING_SUPABASE_KEY" \
                    -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
                    "$STAGING_SUPABASE_URL/storage/v1/bucket" 2>/dev/null)

http_code="${staging_test: -3}"
response_body="${staging_test%???}"

echo "   HTTP Status: $http_code"
echo "   Response: $response_body"

if [ "$http_code" = "200" ]; then
  echo "✅ Staging API connection successful"
  
  # Parse buckets properly
  echo ""
  echo "📦 Staging buckets (detailed):"
  echo "$response_body" | jq -r '.[] | "Bucket: \(.name) | Public: \(.public // false) | Created: \(.created_at // "unknown")"' 2>/dev/null || {
    echo "⚠️  Failed to parse JSON, showing raw response:"
    echo "$response_body"
  }
  
  # Check each bucket for files
  echo ""
  echo "📁 Checking files in each staging bucket:"
  
  buckets=$(echo "$response_body" | jq -r '.[] | .name' 2>/dev/null || echo "")
  
  for bucket in $buckets; do
    if [ -n "$bucket" ] && [ "$bucket" != "null" ]; then
      echo ""
      echo "🔍 Bucket: $bucket"
      
      # List files in bucket
      files_response=$(curl -s -w "%{http_code}" \
        -H "apikey: $STAGING_SUPABASE_KEY" \
        -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
        "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=100" 2>/dev/null)
      
      files_http_code="${files_response: -3}"
      files_body="${files_response%???}"
      
      echo "   HTTP Status: $files_http_code"
      
      if [ "$files_http_code" = "200" ]; then
        file_count=$(echo "$files_body" | jq '. | length' 2>/dev/null || echo "0")
        echo "   Files found: $file_count"
        
        if [ "$file_count" -gt 0 ]; then
          echo "   Sample files:"
          echo "$files_body" | jq -r '.[:5] | .[] | "     - \(.name) (\(.size // 0) bytes)"' 2>/dev/null || echo "     Failed to list files"
        fi
      else
        echo "   Error: $files_body"
      fi
    fi
  done
  
else
  echo "❌ Staging API connection failed"
  echo "   Response: $response_body"
fi

echo ""
echo "🔍 2. DETAILED PRODUCTION BUCKET ANALYSIS"
echo "======================================="

# Test production API connection
echo "🔍 Testing production API connection..."
production_test=$(curl -s -w "%{http_code}" -H "apikey: $PRODUCTION_SUPABASE_KEY" \
                      -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
                      "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" 2>/dev/null)

prod_http_code="${production_test: -3}"
prod_response_body="${production_test%???}"

echo "   HTTP Status: $prod_http_code"
echo "   Response: $prod_response_body"

if [ "$prod_http_code" = "200" ]; then
  echo "✅ Production API connection successful"
  
  # Parse buckets properly
  echo ""
  echo "📦 Production buckets (detailed):"
  echo "$prod_response_body" | jq -r '.[] | "Bucket: \(.name) | Public: \(.public // false) | Created: \(.created_at // "unknown")"' 2>/dev/null || {
    echo "⚠️  Failed to parse JSON, showing raw response:"
    echo "$prod_response_body"
  }
  
else
  echo "❌ Production API connection failed"
  echo "   Response: $prod_response_body"
fi

echo ""
echo "🔍 3. CHECKING ALTERNATIVE STORAGE LOCATIONS"
echo "=========================================="

# Check if there are any image URLs in the database that might indicate storage usage
echo "🔍 Checking for image URLs in database..."

image_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url IS NOT NULL AND image_url != '';" | tr -d ' ')

echo "   Products with images: $image_count"

if [ "$image_count" -gt 0 ]; then
  echo ""
  echo "🖼️ Sample image URLs from database:"
  psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, name, LEFT(image_url, 100) as image_url_sample FROM inventory_items WHERE image_url IS NOT NULL AND image_url != '' LIMIT 5;"
fi

# Check photo_assets table if it exists
photo_table_exists=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'photo_assets');" | tr -d ' ')

if [ "$photo_table_exists" = "t" ]; then
  photo_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM photo_assets;" | tr -d ' ')
  echo "   Photo assets: $photo_count"
  
  if [ "$photo_count" -gt 0 ]; then
    echo ""
    echo "📸 Sample photo assets:"
    psql "$PRODUCTION_DATABASE_URL" -c "SELECT id, LEFT(url, 100) as url_sample FROM photo_assets LIMIT 3;"
  fi
fi

echo ""
echo "🎯 Storage Diagnosis Complete!"
echo "============================="
echo ""
echo "📊 Findings:"
echo "   - Staging API Status: $([ "$http_code" = "200" ] && echo "Connected" || echo "Failed")"
echo "   - Production API Status: $([ "$prod_http_code" = "200" ] && echo "Connected" || echo "Failed")"
echo "   - Database images: $image_count products"
echo "   - Photo assets: $([ "$photo_table_exists" = "t" ] && echo "$photo_count records" || echo "No table")"
echo ""
echo "🚀 Next Steps:"
echo "   1. If APIs are connected but buckets are empty, images may be stored elsewhere"
echo "   2. Check if images are stored via CDN or external service"
echo "   3. Verify image URLs in database point to working locations"
echo "   4. Consider if storage migration is actually needed"
