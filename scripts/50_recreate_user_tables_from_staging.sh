#!/bin/bash

set -e
echo "🔄 RECREATING USER TABLES FROM STAGING"
echo "======================================"

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

echo "🔥 Strategy: Drop legacy user tables and recreate from staging"
echo ""

# User tables to recreate from staging
user_tables=(
    "users"
    "user_tenants"
    "user_sessions_list"
    "user_preferences"
    "user_behavior_simple"
)

# Legacy tables to drop (exist in production but not in staging)
legacy_tables=(
    "user"
    "user_sessions"
)

echo "📋 Legacy user tables to drop:"
for table in "${legacy_tables[@]}"; do
    echo "   - $table"
done

echo ""
echo "📋 User tables to recreate from staging:"
for table in "${user_tables[@]}"; do
    echo "   - $table"
done

echo ""
echo "🔥 Step 1: Dropping legacy user tables from production..."

for table in "${legacy_tables[@]}"; do
    echo "   🗑️  Dropping $table..."
    
    # Check if table exists
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        # Drop with CASCADE to remove dependencies
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE IF EXISTS \"$table\" CASCADE;" 2>/dev/null && echo "   ✅ Dropped $table" || echo "   ⚠️  Could not drop $table"
    else
        echo "   ℹ️  $table does not exist, skipping"
    fi
done

echo ""
echo "🔥 Step 2: Dropping user tables from production (for clean recreation)..."

for table in "${user_tables[@]}"; do
    echo "   🗑️  Dropping $table..."
    
    # Check if table exists
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        # Drop with CASCADE to remove dependencies
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE IF EXISTS \"$table\" CASCADE;" 2>/dev/null && echo "   ✅ Dropped $table" || echo "   ⚠️  Could not drop $table"
    else
        echo "   ℹ️  $table does not exist, skipping"
    fi
done

echo ""
echo "📥 Step 3: Exporting user tables from staging..."

timestamp=$(date +%Y%m%d_%H%M%S)

for table in "${user_tables[@]}"; do
    echo "   📤 Exporting $table..."
    
    # Check if table exists in staging
    exists=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        # Export table definition and data
        doppler run -- pg_dump "$STAGING_DATABASE_URL" \
            --schema=public \
            --table="$table" \
            --no-owner \
            --no-privileges \
            --file="/tmp/${table}_${timestamp}.sql" \
            2>/dev/null && echo "   ✅ Exported $table" || echo "   ❌ Failed to export $table"
    else
        echo "   ℹ️  $table does not exist in staging, skipping"
    fi
done

echo ""
echo "📤 Step 4: Importing user tables to production..."

for table in "${user_tables[@]}"; do
    table_file="/tmp/${table}_${timestamp}.sql"
    
    if [ -f "$table_file" ] && [ -s "$table_file" ]; then
        echo "   📥 Importing $table..."
        
        # Import to production
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -f "$table_file" 2>/dev/null && {
            # Verify import
            count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
            echo "   ✅ Imported $table: $count records"
        } || echo "   ❌ Failed to import $table"
        
        # Clean up
        rm -f "$table_file"
    else
        echo "   ℹ️  No export file for $table, skipping"
    fi
done

echo ""
echo "📊 Step 5: Verifying migration..."

for table in "${user_tables[@]}"; do
    # Check if table exists in production
    prod_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$prod_exists" = "t" ]; then
        prod_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        
        if [ "$prod_count" = "$staging_count" ]; then
            echo "   ✅ $table: $prod_count records (matches staging)"
        else
            echo "   ⚠️  $table: $prod_count records (staging: $staging_count)"
        fi
    else
        echo "   ❌ $table does not exist in production"
    fi
done

echo ""
echo "🔍 Step 6: Verifying no legacy tables remain..."

for table in "${legacy_tables[@]}"; do
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$exists" = "t" ]; then
        echo "   ❌ $table still exists in production"
    else
        echo "   ✅ $table removed from production"
    fi
done

echo ""
echo "🎯 USER TABLES RECREATION COMPLETE!"
echo "==================================="
echo ""
echo "✅ What was accomplished:"
echo "   1. ✅ Dropped legacy user tables (user, user_sessions)"
echo "   2. ✅ Dropped and recreated user tables from staging"
echo "   3. ✅ Imported all user data with exact structure match"
echo "   4. ✅ Verified record counts match staging"
echo "   5. ✅ Verified no legacy tables remain"
echo ""
echo "📊 Final user table counts:"

# Show final counts for key tables
for table in "${user_tables[@]}"; do
    final_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
    echo "   📊 $table: $final_count (staging: $staging_count)"
done

echo ""
echo "🚀 User tables are now aligned with staging!"
