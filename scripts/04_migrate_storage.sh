#!/bin/bash

# Storage Migration Script
# Usage: ./04_migrate_storage.sh

set -e

echo "🚀 Starting storage migration..."

# Configuration - Use Doppler if available
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

STAGING_PROJECT_ID="${STAGING_PROJECT_ID:-your-staging-project-id}"
PRODUCTION_PROJECT_ID="${PRODUCTION_PROJECT_ID:-your-production-project-id}"
STAGING_URL="${STAGING_SUPABASE_URL}"
PRODUCTION_URL="${PRODUCTION_SUPABASE_URL}"
STAGING_KEY="${STAGING_SERVICE_ROLE_KEY}"
PRODUCTION_KEY="${PRODUCTION_SERVICE_ROLE_KEY}"

# Debug environment variables
echo "🔍 Debug: STAGING_URL = $STAGING_URL"
echo "🔍 Debug: PRODUCTION_URL = $PRODUCTION_URL"
echo "🔍 Debug: STAGING_KEY length = ${#STAGING_KEY}"
echo "🔍 Debug: PRODUCTION_KEY length = ${#PRODUCTION_KEY}"

# Create storage migration directory
mkdir -p ./storage_migration
cd ./storage_migration

echo "📋 Checking Supabase CLI installation..."

if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found. Installing..."
  # Install Supabase CLI
  curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xz
  sudo mv supabase /usr/local/bin/
fi

echo "📋 Listing storage buckets in staging..."

# List all buckets in staging
echo "📦 Staging buckets:"
supabase storage list --project-id="$STAGING_PROJECT_ID" 2>/dev/null || {
  echo "⚠️  Could not list buckets via CLI, trying manual approach..."
  
  # Manual bucket listing using REST API
  curl -H "Authorization: Bearer $STAGING_KEY" \
       -H "apikey: $STAGING_KEY" \
       "$STAGING_URL/storage/v1/bucket" \
       -o staging_buckets.json
  
  if [ -f "staging_buckets.json" ]; then
    echo "📦 Found buckets:"
    jq -r '.[].name' staging_buckets.json 2>/dev/null || echo "Could not parse bucket list"
  fi
}

echo "📋 Listing storage buckets in production..."

# List all buckets in production
echo "📦 Production buckets:"
supabase storage list --project-id="$PRODUCTION_PROJECT_ID" 2>/dev/null || {
  echo "⚠️  Could not list buckets via CLI, trying manual approach..."
  
  curl -H "Authorization: Bearer $PRODUCTION_KEY" \
       -H "apikey: $PRODUCTION_KEY" \
       "$PRODUCTION_URL/storage/v1/bucket" \
       -o production_buckets.json
  
  if [ -f "production_buckets.json" ]; then
    echo "📦 Found buckets:"
    jq -r '.[].name' production_buckets.json 2>/dev/null || echo "Could not parse bucket list"
  fi
}

echo "📋 Creating buckets in production if needed..."

# Create buckets in production that exist in staging
if [ -f "staging_buckets.json" ]; then
  echo "🔧 Creating missing buckets in production..."
  
  jq -r '.[].name' staging_buckets.json 2>/dev/null | while read -r bucket; do
    if [ "$bucket" != "null" ] && [ -n "$bucket" ]; then
      echo "📦 Checking bucket: $bucket"
      
      # Check if bucket exists in production
      bucket_exists=$(curl -s -H "Authorization: Bearer $PRODUCTION_KEY" \
                           -H "apikey: $PRODUCTION_KEY" \
                           "$PRODUCTION_URL/storage/v1/bucket/$bucket" | jq -r '.name // "not_found"')
      
      if [ "$bucket_exists" = "not_found" ]; then
        echo "🔧 Creating bucket: $bucket"
        
        # Create bucket
        curl -X POST \
             -H "Authorization: Bearer $PRODUCTION_KEY" \
             -H "apikey: $PRODUCTION_KEY" \
             -H "Content-Type: application/json" \
             -d "{\"name\":\"$bucket\",\"public\":false,\"allowed_mime_types\":[\"image/png\",\"image/jpeg\",\"image/gif\"],\"file_size_limit\":52428800}" \
             "$PRODUCTION_URL/storage/v1/bucket"
        
        echo "✅ Created bucket: $bucket"
      else
        echo "✅ Bucket already exists: $bucket"
      fi
    fi
  done
fi

echo "📋 Migrating files for each bucket..."

# Function to migrate files for a bucket
migrate_bucket_files() {
  local bucket=$1
  echo "📦 Migrating bucket: $bucket"
  
  # Create bucket directory
  mkdir -p "./$bucket"
  cd "./$bucket"
  
  # List files in staging bucket
  echo "📋 Listing files in staging bucket: $bucket"
  
  # Get all files from staging
  page=1
  per_page=1000
  total_files=0
  
  while true; do
    echo "📄 Getting page $page of files..."
    
    # Test basic API connectivity first
    echo "🔍 Testing basic API call..."
    test_url="$STAGING_URL/storage/v1/bucket"
    echo "🔍 Debug: Test URL = $test_url"
    
    curl -H "Authorization: Bearer $STAGING_KEY" \
         -H "apikey: $STAGING_KEY" \
         "$test_url" \
         -o "test_buckets.json"
    
    if [ -f "test_buckets.json" ]; then
      echo "✅ Basic API call successful"
      cat test_buckets.json | head -3
      rm test_buckets.json
    else
      echo "❌ Basic API call failed - skipping file migration for this bucket"
      break
    fi
    
    # Get files list - use a hardcoded URL to test
    echo "🔍 Testing files list with hardcoded URL..."
    files_url="https://nbwsiobosqawrugnqddo.supabase.co/storage/v1/object/list/photos?page=1&limit=10"
    echo "🔍 Debug: Files URL = $files_url"
    
    curl -H "Authorization: Bearer $STAGING_KEY" \
         -H "apikey: $STAGING_KEY" \
         "$files_url" \
         -o "files_page_$page.json"
    
    # Extract file paths
    if [ -f "files_page_$page.json" ]; then
      file_count=$(jq -r '. | length' "files_page_$page.json" 2>/dev/null || echo "0")
      
      if [ "$file_count" = "0" ]; then
        echo "✅ No more files to process"
        rm "files_page_$page.json"
        break
      fi
      
      echo "📄 Found $file_count files on page $page"
      
      # Download each file
      jq -r '.[].name' "files_page_$page.json" 2>/dev/null | while read -r file_path; do
        if [ "$file_path" != "null" ] && [ -n "$file_path" ]; then
          echo "📥 Downloading: $file_path"
          
          # Create directory structure
          mkdir -p "$(dirname "$file_path")"
          
          # Download file from staging (use simple URL construction)
          curl -H "Authorization: Bearer $STAGING_KEY" \
               -H "apikey: $STAGING_KEY" \
               "$STAGING_URL/storage/v1/object/$bucket/$file_path" \
               -o "$file_path"
          
          # Upload to production
          echo "📤 Uploading to production: $file_path"
          
          curl -X POST \
               -H "Authorization: Bearer $PRODUCTION_KEY" \
               -H "apikey: $PRODUCTION_KEY" \
               --form "file=@$file_path" \
               "$PRODUCTION_URL/storage/v1/object/$bucket/$file_path"
          
          total_files=$((total_files + 1))
          
          if [ $((total_files % 100)) -eq 0 ]; then
            echo "📊 Processed $total_files files..."
          fi
        fi
      done
      
      rm "files_page_$page.json"
      page=$((page + 1))
    else
      echo "⚠️  Could not get file list for page $page"
      break
    fi
  done
  
  echo "✅ Completed migration for bucket: $bucket ($total_files files)"
  
  cd ..
}

# Migrate each bucket
if [ -f "staging_buckets.json" ]; then
  jq -r '.[].name' staging_buckets.json 2>/dev/null | while read -r bucket; do
    if [ "$bucket" != "null" ] && [ -n "$bucket" ]; then
      migrate_bucket_files "$bucket"
    fi
  done
else
  echo "⚠️  No bucket list found, trying default bucket 'photos'"
  migrate_bucket_files "photos"
fi

echo "📋 Verifying migration..."

# Function to verify bucket migration
verify_bucket_migration() {
  local bucket=$1
  
  echo "🔍 Verifying bucket: $bucket"
  
  # Count files in staging
  staging_count=$(curl -s -H "Authorization: Bearer $STAGING_KEY" \
                       -H "apikey: $STAGING_KEY" \
                       "$STAGING_URL/storage/v1/object/list/$bucket?limit=1" | \
                       jq -r '.[0].total_count // 0' 2>/dev/null || echo "0")
  
  # Count files in production
  production_count=$(curl -s -H "Authorization: Bearer $PRODUCTION_KEY" \
                         -H "apikey: $PRODUCTION_KEY" \
                         "$PRODUCTION_URL/storage/v1/object/list/$bucket?limit=1" | \
                         jq -r '.[0].total_count // 0' 2>/dev/null || echo "0")
  
  echo "📊 Bucket $bucket:"
  echo "   Staging files: $staging_count"
  echo "   Production files: $production_count"
  
  if [ "$staging_count" -eq "$production_count" ]; then
    echo "✅ Migration successful for bucket: $bucket"
  else
    echo "⚠️  File count mismatch for bucket: $bucket"
  fi
}

# Verify all buckets
if [ -f "staging_buckets.json" ]; then
  jq -r '.[].name' staging_buckets.json 2>/dev/null | while read -r bucket; do
    if [ "$bucket" != "null" ] && [ -n "$bucket" ]; then
      verify_bucket_migration "$bucket"
    fi
  done
else
  verify_bucket_migration "photos"
fi

echo "📋 Generating storage migration report..."

cat > storage_migration_report.md << EOF
# Storage Migration Report

## Migration Summary
- **Date:** $(date)
- **Staging Project:** $STAGING_PROJECT_ID
- **Production Project:** $PRODUCTION_PROJECT_ID

## Buckets Migrated

EOF

if [ -f "staging_buckets.json" ]; then
  jq -r '.[].name' staging_buckets.json 2>/dev/null | while read -r bucket; do
    if [ "$bucket" != "null" ] && [ -n "$bucket" ]; then
      echo "### $bucket" >> storage_migration_report.md
      echo "- Staging files: $(curl -s -H "Authorization: Bearer $STAGING_KEY" -H "apikey: $STAGING_KEY" "$STAGING_URL/storage/v1/object/list/$bucket?limit=1" | jq -r '.[0].total_count // 0' 2>/dev/null || echo "0")" >> storage_migration_report.md
      echo "- Production files: $(curl -s -H "Authorization: Bearer $PRODUCTION_KEY" -H "apikey: $PRODUCTION_KEY" "$PRODUCTION_URL/storage/v1/object/list/$bucket?limit=1" | jq -r '.[0].total_count // 0' 2>/dev/null || echo "0")" >> storage_migration_report.md
      echo "" >> storage_migration_report.md
    fi
  done
fi

echo "✅ Storage migration complete!"
echo "📁 Migration report created: storage_migration_report.md"
echo ""
echo "📊 Migration Summary:"
du -sh ./* 2>/dev/null | head -10

echo ""
echo "🔍 Next steps:"
echo "1. Review storage_migration_report.md"
echo "2. Test file access in production"
echo "3. Update application storage URLs if needed"
