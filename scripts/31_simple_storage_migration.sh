#!/bin/bash

set -e

echo "📦 Simple Storage Migration"
echo "========================"

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Set Supabase variables
STAGING_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
PRODUCTION_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo "📋 Migrating files from staging to production..."

# Function to migrate a bucket
migrate_bucket() {
  local bucket=$1
  echo ""
  echo "📦 Migrating bucket: $bucket"
  echo "------------------------"
  
  # Get all files from staging bucket
  echo "🔍 Getting file list from staging..."
  files_response=$(curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
                        -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
                        "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket&limit=100" 2>/dev/null)
  
  if ! echo "$files_response" | jq -e '.[]' >/dev/null 2>&1; then
    echo "❌ No files or error in bucket: $bucket"
    return
  fi
  
  file_count=$(echo "$files_response" | jq '. | length' 2>/dev/null)
  echo "📊 Found $file_count files"
  
  # Create bucket in production if it doesn't exist
  echo "🔧 Ensuring bucket exists in production..."
  curl -s -X POST \
    -H "apikey: $PRODUCTION_SUPABASE_KEY" \
    -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$bucket\",\"public\":true}" \
    "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" >/dev/null 2>&1 || echo "Bucket may already exist"
  
  # Migrate each file
  migrated=0
  failed=0
  
  echo "$files_response" | jq -r '.[] | .name' | while read -r file_path; do
    if [ -n "$file_path" ] && [ "$file_path" != "null" ]; then
      echo "📤 Migrating: $file_path"
      
      # Download from staging
      temp_file="temp_$(basename "$file_path")"
      curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
           -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
           "$STAGING_SUPABASE_URL/storage/v1/object/$bucket/$file_path" \
           -o "$temp_file" 2>/dev/null
      
      if [ -f "$temp_file" ]; then
        # Upload to production
        upload_response=$(curl -s -X POST \
          -H "apikey: $PRODUCTION_SUPABASE_KEY" \
          -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
          -F "file=@$temp_file" \
          "$PRODUCTION_SUPABASE_URL/storage/v1/object/$bucket/$file_path" 2>/dev/null)
        
        if [[ "$upload_response" == *"error"* ]] || [[ -z "$upload_response" ]]; then
          echo "❌ Failed to upload: $file_path"
          failed=$((failed + 1))
        else
          echo "✅ Migrated: $file_path"
          migrated=$((migrated + 1))
        fi
        
        rm -f "$temp_file"
      else
        echo "❌ Failed to download: $file_path"
        failed=$((failed + 1))
      fi
    fi
  done
  
  echo "📊 Migration complete for $bucket"
}

# Migrate all buckets
buckets=("photos" "tenants" "brands" "product-cache")

for bucket in "${buckets[@]}"; do
  migrate_bucket "$bucket"
done

echo ""
echo "🎯 Migration Complete!"
echo "==================="
echo ""
echo "🔍 Verification:"
echo "📊 Database images: $(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE image_url IS NOT NULL AND image_url != '';" | tr -d ' ') products"
echo ""
echo "🚀 Test the application:"
echo "   - Check if images load properly"
echo "   - Test product photo display"
echo "   - Verify tenant logos and assets"
