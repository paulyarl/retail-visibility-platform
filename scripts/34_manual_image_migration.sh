#!/bin/bash

set -e

echo "🚨 MANUAL IMAGE MIGRATION - URGENT"
echo "================================"
echo "🔥 All 464 images are broken - need immediate fix!"
echo ""

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Manual migration approach..."

# Function to manually migrate a bucket with simple curl commands
manual_migrate_bucket() {
  local bucket=$1
  echo ""
  echo "📦 Manual migration for bucket: $bucket"
  echo "--------------------------------------"
  
  # Step 1: Get file list using a simpler approach
  echo "🔍 Getting file list from staging..."
  staging_files=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
                        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
                        "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=1000" 2>/dev/null)
  
  # Check if we got valid JSON
  if echo "$staging_files" | python3 -m json.tool >/dev/null 2>&1; then
    echo "✅ Got valid JSON response"
    
    # Extract filenames using Python instead of jq
    echo "📤 Extracting filenames..."
    python3 -c "
import json
import sys
data = json.loads('$staging_files')
for item in data:
    if 'name' in item:
        print(item['name'])
" > temp_files.txt
    
    file_count=$(wc -l < temp_files.txt)
    echo "📊 Found $file_count files"
    
    if [ "$file_count" -gt 0 ]; then
      # Step 2: Create production bucket
      echo "🔧 Creating production bucket..."
      curl -s -X POST \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$bucket\",\"public\":true}" \
        "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" >/dev/null 2>&1
      
      # Step 3: Migrate each file
      migrated=0
      failed=0
      
      while IFS= read -r file_path; do
        if [ -n "$file_path" ]; then
          echo "📤 Migrating: $file_path"
          
          # Download from staging
          temp_file="temp_$(basename "$file_path")"
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
            
            if echo "$upload_response" | grep -q "error"; then
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
      done < temp_files.txt
      
      rm -f temp_files.txt
      
      echo "📊 Migration complete for $bucket:"
      echo "   ✅ Migrated: $migrated"
      echo "   ❌ Failed: $failed"
      echo "   📊 Total: $file_count"
    else
      echo "ℹ️  No files found in bucket: $bucket"
    fi
  else
    echo "❌ Invalid JSON response from staging API"
    echo "Response: $staging_files"
  fi
}

# Alternative: Use wget for file transfer if curl fails
alternative_migration() {
  local bucket=$1
  echo ""
  echo "🔄 Alternative migration for bucket: $bucket"
  echo "----------------------------------------"
  
  # Try a different approach - copy files directly
  echo "🔍 Trying direct file copy approach..."
  
  # Get just the first few files to test
  staging_files=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
                        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
                        "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=5" 2>/dev/null)
  
  echo "Testing with first 5 files..."
  echo "Response: $staging_files"
}

# Try manual migration for each bucket
echo "🚀 Starting manual migration..."

manual_migrate_bucket "photos"
manual_migrate_bucket "tenants"
manual_migrate_bucket "brands"
manual_migrate_bucket "product-cache"

echo ""
echo "🔍 ALTERNATIVE: Test if we can access staging images directly"
echo "======================================================="

# Test if we can access staging images (as fallback)
echo "🌐 Testing staging image access..."
test_url="https://nbwsiobosqawrugnqddo.supabase.co/storage/v1/object/public/photos/tid-m8ijkrnk/items/pid-ULCW-fu17jui0/primary-1778131640211-i7k7sz.png"

status=$(curl -s -o /dev/null -w "%{http_code}" "$test_url" 2>/dev/null || echo "000")
echo "🔗 Staging image test: $status"

if [ "$status" = "200" ]; then
  echo "✅ Staging images are accessible!"
  echo ""
  echo "🔄 TEMPORARY FIX OPTION:"
  echo "======================"
  echo "We could temporarily update URLs back to staging domain"
  echo "until we can properly migrate the images."
  echo ""
  echo "Would you like to:"
  echo "1. Revert URLs to staging (temporary fix)"
  echo "2. Continue with manual migration attempts"
  echo "3. Try a different migration approach"
else
  echo "❌ Even staging images are not accessible"
fi

echo ""
echo "🎯 Current Status Summary"
echo "======================"
echo "📊 Database URLs: 464 pointing to production"
echo "📊 Production buckets: Likely empty"
echo "📊 Image status: BROKEN (HTTP 400/000 errors)"
echo ""
echo "🚨 IMMEDIATE ACTION NEEDED:"
echo "   1. Manual image migration required"
echo "   2. Or temporary staging URL revert"
echo "   3. Test production application impact"
