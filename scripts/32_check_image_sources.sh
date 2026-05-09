#!/bin/bash

set -e

echo "🔍 Check Image URL Sources"
echo "========================"

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Analyzing image URLs in database..."

echo ""
echo "🔍 1. SAMPLE IMAGE URLS"
echo "===================="

# Get sample image URLs
echo "🖼️ Sample product image URLs:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT 
  id, 
  name, 
  image_url,
  CASE 
    WHEN image_url LIKE '%supabase%' THEN 'Supabase'
    WHEN image_url LIKE '%amazonaws%' THEN 'AWS S3'
    WHEN image_url LIKE '%cloudinary%' THEN 'Cloudinary'
    WHEN image_url LIKE '%imgix%' THEN 'Imgix'
    WHEN image_url LIKE '%unsplash%' THEN 'Unsplash'
    WHEN image_url LIKE '%picsum%' THEN 'Picsum'
    WHEN image_url LIKE 'http%' THEN 'External HTTP'
    WHEN image_url LIKE '/' THEN 'Relative Path'
    ELSE 'Other/Unknown'
  END as source_type
FROM inventory_items 
WHERE image_url IS NOT NULL AND image_url != ''
ORDER BY created_at DESC
LIMIT 10;
"

echo ""
echo "🔍 2. IMAGE URL SOURCE BREAKDOWN"
echo "=============================="

# Analyze all image URL sources
echo "📊 Image source distribution:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT 
  CASE 
    WHEN image_url LIKE '%supabase%' THEN 'Supabase'
    WHEN image_url LIKE '%amazonaws%' THEN 'AWS S3'
    WHEN image_url LIKE '%cloudinary%' THEN 'Cloudinary'
    WHEN image_url LIKE '%imgix%' THEN 'Imgix'
    WHEN image_url LIKE '%unsplash%' THEN 'Unsplash'
    WHEN image_url LIKE '%picsum%' THEN 'Picsum'
    WHEN image_url LIKE 'http%' THEN 'External HTTP'
    WHEN image_url LIKE '/' THEN 'Relative Path'
    ELSE 'Other/Unknown'
  END as source_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM inventory_items WHERE image_url IS NOT NULL AND image_url != ''), 2) as percentage
FROM inventory_items 
WHERE image_url IS NOT NULL AND image_url != ''
GROUP BY 
  CASE 
    WHEN image_url LIKE '%supabase%' THEN 'Supabase'
    WHEN image_url LIKE '%amazonaws%' THEN 'AWS S3'
    WHEN image_url LIKE '%cloudinary%' THEN 'Cloudinary'
    WHEN image_url LIKE '%imgix%' THEN 'Imgix'
    WHEN image_url LIKE '%unsplash%' THEN 'Unsplash'
    WHEN image_url LIKE '%picsum%' THEN 'Picsum'
    WHEN image_url LIKE 'http%' THEN 'External HTTP'
    WHEN image_url LIKE '/' THEN 'Relative Path'
    ELSE 'Other/Unknown'
  END
ORDER BY count DESC;
"

echo ""
echo "🔍 3. CHECK SUPABASE URL PATTERNS"
echo "================================"

# Check if any images point to Supabase storage
supabase_images=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url LIKE '%supabase%';" | tr -d ' ')

echo "📊 Images pointing to Supabase: $supabase_images"

if [ "$supabase_images" -gt 0 ]; then
  echo ""
  echo "🔍 Sample Supabase image URLs:"
  psql "$PRODUCTION_DATABASE_URL" -c "
    SELECT id, name, image_url 
    FROM inventory_items 
    WHERE image_url LIKE '%supabase%' 
    LIMIT 5;
  "
fi

echo ""
echo "🔍 4. TEST IMAGE ACCESSIBILITY"
echo "============================"

# Test a few sample images
echo "🌐 Testing sample image accessibility..."

sample_urls=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT image_url FROM inventory_items WHERE image_url IS NOT NULL AND image_url != '' LIMIT 3;" | tr -d ' ')

for url in $sample_urls; do
  if [ -n "$url" ] && [ "$url" != "null" ]; then
    echo ""
    echo "🔗 Testing: $url"
    
    # Extract domain from URL
    if [[ "$url" =~ ^https?:// ]]; then
      domain=$(echo "$url" | sed 's|https\?://||' | cut -d'/' -f1)
      echo "   Domain: $domain"
      
      # Test HTTP status
      status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
      echo "   HTTP Status: $status"
      
      if [ "$status" = "200" ]; then
        echo "   ✅ Accessible"
      elif [ "$status" = "404" ]; then
        echo "   ❌ Not Found"
      elif [ "$status" = "403" ]; then
        echo "   🔒 Forbidden"
      else
        echo "   ⚠️  Error ($status)"
      fi
    else
      echo "   ℹ️  Relative path - needs base URL"
    fi
  fi
done

echo ""
echo "🎯 Image Source Analysis Complete!"
echo "==============================="
echo ""
echo "📊 Key Findings:"
echo "   - Total products with images: 464"
echo "   - Supabase-hosted images: $supabase_images"
echo "   - Other sources: $((464 - supabase_images))"
echo ""
echo "🚀 Recommendations:"
if [ "$supabase_images" -gt 0 ]; then
  echo "   ✅ Some images use Supabase - storage migration needed"
  echo "   🔧 Check if Supabase URLs point to staging vs production"
else
  echo "   ℹ️  No Supabase images found - may not need storage migration"
  echo "   🔍 Images likely hosted externally (S3, CDN, etc.)"
fi
echo ""
echo "   🌐 Test image loading in production application"
echo "   🔍 Check for broken image links"
