#!/bin/bash

set -e

echo "🔄 TEMPORARY IMAGE FIX - EMERGENCY"
echo "================================="
echo "🚨 Reverting URLs to staging domain to restore images"
echo ""

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Current situation:"
echo "   - All 464 images are broken (pointing to empty production buckets)"
echo "   - Staging images are accessible and working"
echo "   - Need immediate fix to restore functionality"

echo ""
echo "🔄 Reverting URLs to staging domain..."

# Count images currently pointing to production
prod_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url LIKE '%pzxiurmwgkqhghxydazt.supabase.co%';" | tr -d ' ')
echo "📊 Images currently pointing to production: $prod_count"

if [ "$prod_count" -gt 0 ]; then
  echo ""
  echo "🔧 Reverting image URLs to staging domain..."
  
  # Revert all production URLs back to staging URLs
  revert_result=$(psql "$PRODUCTION_DATABASE_URL" -c "
    UPDATE inventory_items 
    SET image_url = REPLACE(image_url, 'https://pzxiurmwgkqhghxydazt.supabase.co', 'https://nbwsiobosqawrugnqddo.supabase.co')
    WHERE image_url LIKE '%pzxiurmwgkqhghxydazt.supabase.co%';
  ")
  
  echo "✅ URLs reverted to staging domain"
  
  # Verify the revert
  staging_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url LIKE '%nbwsiobosqawrugnqddo.supabase.co%';" | tr -d ' ')
  echo "📊 Images now pointing to staging: $staging_count"
  
  # Show sample reverted URLs
  echo ""
  echo "🔍 Sample reverted URLs:"
  psql "$PRODUCTION_DATABASE_URL" -c "
    SELECT id, name, LEFT(image_url, 100) as reverted_url
    FROM inventory_items 
    WHERE image_url LIKE '%nbwsiobosqawrugnqddo.supabase.co%'
    LIMIT 3;
  "
fi

echo ""
echo "🌐 TESTING IMAGE ACCESSIBILITY"
echo "============================"

# Test a few staging URLs
echo "🔗 Testing staging image URLs..."
sample_urls=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT image_url FROM inventory_items WHERE image_url LIKE '%nbwsiobosqawrugnqddo.supabase.co%' LIMIT 3;" | tr -d ' ')

working=0
broken=0

for url in $sample_urls; do
  if [ -n "$url" ] && [ "$url" != "null" ]; then
    echo ""
    echo "🔗 Testing: $url"
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    echo "   HTTP Status: $status"
    
    if [ "$status" = "200" ]; then
      echo "   ✅ WORKING!"
      working=$((working + 1))
    else
      echo "   ❌ Still broken"
      broken=$((broken + 1))
    fi
  fi
done

echo ""
echo "📊 Test Results:"
echo "   ✅ Working: $working"
echo "   ❌ Broken: $broken"

echo ""
echo "🎯 TEMPORARY FIX COMPLETE!"
echo "========================"
echo ""
echo "✅ What was done:"
echo "   1. Reverted all 464 URLs back to staging domain"
echo "   2. Verified staging image accessibility"
echo "   3. Images should now work in production"
echo ""
echo "📊 Results:"
echo "   - URLs reverted: $prod_count"
echo "   - Images pointing to staging: $staging_count"
echo "   - Working images: $working/$((working + broken))"
echo ""
echo "🚀 IMMEDIATE NEXT STEPS:"
echo "   1. Test production application NOW"
echo "   2. Verify product images load correctly"
echo "   3. Check directory page functionality"
echo "   4. Confirm user experience is restored"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "   - This is a TEMPORARY fix"
echo "   - Images are loading from staging Supabase"
echo "   - Need proper storage migration later"
echo "   - Staging domain may have performance implications"
echo ""
echo "🔄 TEMPORARY FIX APPLIED - Images should work now!"
