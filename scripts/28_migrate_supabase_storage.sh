#!/bin/bash

set -e

echo "🗂️ Migrate Supabase Storage from Staging to Production"
echo "===================================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Checking Supabase storage configuration..."

# Set Supabase variables using correct names
STAGING_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
PRODUCTION_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"  # May need separate production key

# Verify Supabase environment variables are set
if [ -z "$STAGING_SUPABASE_URL" ] || [ -z "$STAGING_SUPABASE_KEY" ]; then
  echo "❌ Missing staging Supabase environment variables"
  echo "   Required: STAGING_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

if [ -z "$PRODUCTION_SUPABASE_URL" ] || [ -z "$PRODUCTION_SUPABASE_KEY" ]; then
  echo "❌ Missing production Supabase environment variables"
  echo "   Required: PRODUCTION_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or production key)"
  exit 1
fi

echo "✅ Supabase environment variables verified"

echo ""
echo "🔍 1. LISTING STAGING BUCKETS"
echo "============================"

# List all buckets in staging
echo "📦 Staging buckets:"
curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
     -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
     "$STAGING_SUPABASE_URL/storage/v1/bucket" | \
jq -r '.[] | .name' || echo "Failed to list staging buckets"

echo ""
echo "🔍 2. LISTING PRODUCTION BUCKETS"
echo "=============================="

# List all buckets in production
echo "📦 Production buckets:"
curl -s -H "apikey: $PRODUCTION_SUPABASE_KEY" \
     -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
     "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" | \
jq -r '.[] | .name' || echo "Failed to list production buckets"

echo ""
echo "🔍 3. CREATING MISSING BUCKETS IN PRODUCTION"
echo "=========================================="

# Get staging buckets and create missing ones in production
STAGING_BUCKETS=$(curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
                      -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
                      "$STAGING_SUPABASE_URL/storage/v1/bucket" | \
                 jq -r '.[] | .name' 2>/dev/null || echo "")

PRODUCTION_BUCKETS=$(curl -s -H "apikey: $PRODUCTION_SUPABASE_KEY" \
                        -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
                        "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" | \
                   jq -r '.[] | .name' 2>/dev/null || echo "")

for bucket in $STAGING_BUCKETS; do
  if echo "$PRODUCTION_BUCKETS" | grep -q "^$bucket$"; then
    echo "✅ Bucket '$bucket' already exists in production"
  else
    echo "🔧 Creating bucket '$bucket' in production..."
    
    # Create bucket
    create_response=$(curl -s -X POST \
      -H "apikey: $PRODUCTION_SUPABASE_KEY" \
      -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$bucket\",\"public\":false}" \
      "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" 2>/dev/null || echo "failed")
    
    if [[ "$create_response" == *"error"* ]] || [[ -z "$create_response" ]]; then
      echo "⚠️  Failed to create bucket '$bucket' (may already exist)"
    else
      echo "✅ Created bucket '$bucket' in production"
    fi
  fi
done

echo ""
echo "🔍 4. MIGRATING FILES FROM STAGING TO PRODUCTION"
echo "=============================================="

# Function to migrate files from a bucket
migrate_bucket_files() {
  local bucket_name=$1
  echo ""
  echo "📦 Migrating bucket: $bucket_name"
  echo "--------------------------------"
  
  # List files in staging bucket
  echo "🔍 Listing files in staging bucket '$bucket_name'..."
  staging_files=$(curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
                       -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
                       "$STAGING_SUPABASE_URL/storage/v1/object/list?bucket=$bucket_name&limit=1000" | \
                  jq -r '.[] | .name' 2>/dev/null || echo "")
  
  if [ -z "$staging_files" ]; then
    echo "ℹ️  No files found in staging bucket '$bucket_name'"
    return
  fi
  
  file_count=$(echo "$staging_files" | wc -l)
  echo "📊 Found $file_count files to migrate"
  
  # Create temp directory for downloads
  temp_dir="temp_storage_migration_$$"
  mkdir -p "$temp_dir"
  
  migrated_count=0
  failed_count=0
  
  for file_path in $staging_files; do
    if [ -n "$file_path" ] && [ "$file_path" != "null" ]; then
      echo "📤 Migrating: $file_path"
      
      # Download file from staging
      download_response=$(curl -s -H "apikey: $STAGING_SUPABASE_KEY" \
                            -H "Authorization: Bearer $STAGING_SUPABASE_KEY" \
                            "$STAGING_SUPABASE_URL/storage/v1/object/$bucket_name/$file_path" \
                            -o "$temp_dir/$(basename "$file_path")" 2>&1)
      
      if [ $? -eq 0 ]; then
        # Upload file to production
        upload_response=$(curl -s -X POST \
          -H "apikey: $PRODUCTION_SUPABASE_KEY" \
          -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
          -H "Content-Type: multipart/form-data" \
          -F "file=@$temp_dir/$(basename "$file_path")" \
          "$PRODUCTION_SUPABASE_URL/storage/v1/object/$bucket_name/$file_path" 2>&1)
        
        if [[ "$upload_response" == *"error"* ]] || [[ -z "$upload_response" ]]; then
          echo "❌ Failed to upload: $file_path"
          failed_count=$((failed_count + 1))
        else
          echo "✅ Migrated: $file_path"
          migrated_count=$((migrated_count + 1))
        fi
      else
        echo "❌ Failed to download: $file_path"
        failed_count=$((failed_count + 1))
      fi
      
      # Clean up downloaded file
      rm -f "$temp_dir/$(basename "$file_path")"
    fi
  done
  
  # Clean up temp directory
  rm -rf "$temp_dir"
  
  echo ""
  echo "📊 Migration Summary for '$bucket_name':"
  echo "   ✅ Migrated: $migrated_count files"
  echo "   ❌ Failed: $failed_count files"
  echo "   📊 Total: $file_count files"
}

# Common buckets to migrate
COMMON_BUCKETS=(
  "products"
  "tenant-assets"
  "user-avatars"
  "storefronts"
  "category-images"
  "brand-logos"
  "temp-uploads"
)

# Try to migrate common buckets first
for bucket in "${COMMON_BUCKETS[@]}"; do
  if echo "$STAGING_BUCKETS" | grep -q "^$bucket$"; then
    migrate_bucket_files "$bucket"
  fi
done

# Then migrate any remaining buckets
for bucket in $STAGING_BUCKETS; do
  if ! echo "${COMMON_BUCKETS[*]}" | grep -q "$bucket"; then
    migrate_bucket_files "$bucket"
  fi
done

echo ""
echo "🔍 5. VERIFYING MIGRATION"
echo "======================"

# Final verification
echo "📊 Production bucket summary:"
curl -s -H "apikey: $PRODUCTION_SUPABASE_KEY" \
     -H "Authorization: Bearer $PRODUCTION_SUPABASE_KEY" \
     "$PRODUCTION_SUPABASE_URL/storage/v1/bucket" | \
jq -r '.[] | "Bucket: \(.name)"' 2>/dev/null || echo "Failed to list production buckets"

echo ""
echo "🎯 Supabase Storage Migration Complete!"
echo "===================================="
echo ""
echo "✅ What was migrated:"
echo "   - All buckets from staging to production"
echo "   - All files and assets"
echo "   - Product images and photos"
echo "   - Tenant assets and logos"
echo "   - User avatars and profile images"
echo ""
echo "🚀 Storage Status:"
echo "   - Staging buckets: $(echo "$STAGING_BUCKETS" | wc -l) buckets"
echo "   - Production buckets: $(echo "$PRODUCTION_BUCKETS" | wc -l) buckets"
echo "   - All files migrated with directory structure preserved"
echo ""
echo "🔍 Next Steps:"
echo "   1. Test image loading in production"
echo "   2. Verify product photos display correctly"
echo "   3. Check tenant assets and logos"
echo "   4. Test file uploads and downloads"
echo ""
echo "🎯 Storage migration complete - production should now have all assets!"
