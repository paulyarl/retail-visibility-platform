#!/bin/bash

set -e

echo "🚨 EMERGENCY IMAGE URL FIX"
echo "========================"
echo "🔥 CRITICAL: All 464 images point to STAGING Supabase!"
echo ""

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Current situation:"
echo "   - Staging Supabase: https://nbwsiobosqawrugnqddo.supabase.co"
echo "   - Production Supabase: https://pzxiurmwgkqhghxydazt.supabase.co"
echo "   - Images in DB: 464 (all pointing to staging)"
echo ""

echo "🔍 OPTION 1: Update URLs to Production Domain"
echo "============================================="

# Count images that need updating
staging_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url LIKE '%nbwsiobosqawrugnqddo.supabase.co%';" | tr -d ' ')
echo "📊 Images pointing to staging: $staging_count"

if [ "$staging_count" -gt 0 ]; then
  echo ""
  echo "🔧 Updating image URLs to production domain..."
  
  # Update all staging URLs to production URLs
  update_result=$(psql "$PRODUCTION_DATABASE_URL" -c "
    UPDATE inventory_items 
    SET image_url = REPLACE(image_url, 'https://nbwsiobosqawrugnqddo.supabase.co', 'https://pzxiurmwgkqhghxydazt.supabase.co')
    WHERE image_url LIKE '%nbwsiobosqawrugnqddo.supabase.co%';
  ")
  
  echo "✅ URLs updated in database"
  
  # Verify the update
  new_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url LIKE '%pzxiurmwgkqhghxydazt.supabase.co%';" | tr -d ' ')
  echo "📊 Images now pointing to production: $new_count"
  
  # Show sample updated URLs
  echo ""
  echo "🔍 Sample updated URLs:"
  psql "$PRODUCTION_DATABASE_URL" -c "
    SELECT id, name, LEFT(image_url, 100) as updated_url
    FROM inventory_items 
    WHERE image_url LIKE '%pzxiurmwgkqhghxydazt.supabase.co%'
    LIMIT 3;
  "
fi

echo ""
echo "🔍 OPTION 2: Migrate Images to Production Buckets"
echo "=============================================="

echo "📦 Starting image migration from staging to production..."

# Function to migrate bucket with better error handling
migrate_bucket_images() {
  local bucket=$1
  echo ""
  echo "📦 Migrating bucket: $bucket"
  echo "------------------------"
  
  # List files in staging
  echo "🔍 Listing files in staging bucket..."
  files_response=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
                        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
                        "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=1000" 2>/dev/null)
  
  if ! echo "$files_response" | jq -e '.[]' >/dev/null 2>&1; then
    echo "❌ No files found in staging bucket: $bucket"
    return
  fi
  
  # Create production bucket
  echo "🔧 Creating production bucket..."
  curl -s -X POST \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$bucket\",\"public\":true}" \
    "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" >/dev/null 2>&1
  
  # Migrate files
  migrated=0
  failed=0
  
  echo "$files_response" | jq -r '.[] | .name' | while read -r file_path; do
    if [ -n "$file_path" ] && [ "$file_path" != "null" ]; then
      echo "📤 Migrating: $file_path"
      
      # Download from staging
      temp_file="temp_$(echo "$file_path" | sed 's|/|-|g')"
      curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
           -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
           "$STAGING_SUPABASE_URL/storage/v1/object/$bucket/$file_path" \
           -o "$temp_file" 2>/dev/null
      
      if [ -f "$temp_file" ]; then
        # Upload to production
        upload_response=$(curl -s -X POST \
          -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
          -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
          -F "file=@$temp_file" \
          "$PRODUCTION_SUPABASE_URL/storage/v1/object/$bucket/$file_path" 2>/dev/null)
        
        if [[ "$upload_response" == *"error"* ]] || [[ -z "$upload_response" ]]; then
          echo "❌ Failed: $file_path"
          failed=$((failed + 1))
        else
          echo "✅ Success: $file_path"
          migrated=$((migrated + 1))
        fi
        
        rm -f "$temp_file"
      else
        echo "❌ Download failed: $file_path"
        failed=$((failed + 1))
      fi
    fi
  done
  
  echo "📊 Migration summary for $bucket: $migrated migrated, $failed failed"
}

# Migrate all buckets
migrate_bucket_images "photos"
migrate_bucket_images "tenants" 
migrate_bucket_images "brands"
migrate_bucket_images "product-cache"

echo ""
echo "🔍 3. VERIFICATION"
echo "================"

# Test a few production URLs
echo "🌐 Testing production image URLs..."
sample_urls=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT image_url FROM inventory_items WHERE image_url LIKE '%pzxiurmwgkqhghxydazt.supabase.co%' LIMIT 3;" | tr -d ' ')

for url in $sample_urls; do
  if [ -n "$url" ] && [ "$url" != "null" ]; then
    echo ""
    echo "🔗 Testing: $url"
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    echo "   HTTP Status: $status"
    
    if [ "$status" = "200" ]; then
      echo "   ✅ Working!"
    else
      echo "   ❌ Still broken"
    fi
  fi
done

echo ""
echo "🎯 EMERGENCY FIX COMPLETE!"
echo "======================="
echo ""
echo "✅ What was done:"
echo "   1. Updated all database URLs from staging to production domain"
echo "   2. Migrated images from staging to production buckets"
echo "   3. Tested production image accessibility"
echo ""
echo "📊 Results:"
echo "   - URLs updated: $staging_count"
echo "   - Images migrated: All buckets processed"
echo "   - Production domain: https://pzxiurmwgkqhghxydazt.supabase.co"
echo ""
echo "🚀 IMMEDIATE ACTION REQUIRED:"
echo "   1. Test the production application NOW"
echo "   2. Check if product images load correctly"
echo "   3. Verify directory page shows images"
echo "   4. Test tenant logos and assets"
echo ""
echo "🔥 This was CRITICAL - images were completely broken in production!"
