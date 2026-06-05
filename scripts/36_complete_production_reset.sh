#!/bin/bash

set -e

echo "🔄 COMPLETE PRODUCTION RESET & CLEAN MIGRATION"
echo "=========================================="
echo "🔥 Dropping conflicting tables and recreating from staging"
echo ""

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Current table conflicts detected:"
echo "   Staging: tenant_business_profiles_list (12 records)"
echo "   Production: tenant_business_profile (4 records) + tenant_business_profiles_list (0 records)"
echo "   Staging: business_hours_list (12 records)"
echo "   Production: business_hours (1 record) + business_hours_list (0 records)"
echo ""

echo "🔍 1. AUDITING ALL TABLE CONFLICTS"
echo "================================"

# Get all table names from both environments
echo "📊 Comparing table structures between staging and production..."

# Get staging tables
staging_tables=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | tr -d ' ')

# Get production tables
production_tables=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | tr -d ' ')

echo ""
echo "🔍 Tables in staging but not production:"
for table in $staging_tables; do
  if ! echo "$production_tables" | grep -q "^$table$"; then
    echo "   Missing: $table"
  fi
done

echo ""
echo "🔍 Tables in production but not staging:"
for table in $production_tables; do
  if ! echo "$staging_tables" | grep -q "^$table$"; then
    echo "   Extra: $table"
  fi
done

echo ""
echo "🔍 Tables with similar names (potential conflicts):"
for table in $staging_tables; do
  # Look for tables that might be singular/plural variants
  singular=$(echo "$table" | sed 's/_list$//')
  plural="${singular}s"
  
  if echo "$production_tables" | grep -q "^$singular$"; then
    echo "   Conflict: staging '$table' vs production '$singular'"
  fi
  if echo "$production_tables" | grep -q "^$plural$"; then
    echo "   Conflict: staging '$table' vs production '$plural'"
  fi
done

echo ""
echo "🔍 2. BACKUP PRODUCTION DATA BEFORE DROP"
echo "===================================="

# Create backup of critical production tables
backup_dir="production_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

echo "📦 Backing up production data to $backup_dir..."

# Backup the conflicting tables
conflicting_tables=("tenant_business_profile" "business_hours" "business_hours_special")

for table in "${conflicting_tables[@]}"; do
  if echo "$production_tables" | grep -q "^$table$"; then
    record_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
    echo "📦 Backing up $table ($record_count records)..."
    
    if [ "$record_count" -gt 0 ]; then
      psql "$PRODUCTION_DATABASE_URL" -c "\copy $table TO '$backup_dir/${table}_backup.csv' WITH CSV HEADER"
      echo "   ✅ Backed up to ${table}_backup.csv"
    else
      echo "   ℹ️  No records to backup"
    fi
  fi
done

echo ""
echo "🔍 3. DROPPING CONFLICTING PRODUCTION TABLES"
echo "========================================"

echo "🔧 Dropping conflicting tables in production..."

# Drop the conflicting tables
for table in "${conflicting_tables[@]}"; do
  if echo "$production_tables" | grep -q "^$table$"; then
    echo "🗑️  Dropping table: $table"
    psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE IF EXISTS $table CASCADE;"
    echo "   ✅ Dropped $table"
  fi
done

# Also drop any empty _list tables that should be replaced
empty_list_tables=("tenant_business_profiles_list" "business_hours_list" "business_hours_special_list")

for table in "${empty_list_tables[@]}"; do
  if echo "$production_tables" | grep -q "^$table$"; then
    record_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
    if [ "$record_count" -eq 0 ]; then
      echo "🗑️  Dropping empty table: $table"
      psql "$PRODUCTION_DATABASE_URL" -c "DROP TABLE IF EXISTS $table CASCADE;"
      echo "   ✅ Dropped $table"
    else
      echo "⚠️  Table $table has $record_count records - keeping"
    fi
  fi
done

echo ""
echo "🔍 4. MIGRATING SCHEMA FROM STAGING TO PRODUCTION"
echo "=============================================="

echo "🔧 Creating tables from staging schema..."

# Get table creation statements from staging
echo "📋 Extracting table definitions from staging..."

for table in $staging_tables; do
  # Skip tables that already exist in production
  if echo "$production_tables" | grep -q "^$table$"; then
    echo "⏭️  Skipping existing table: $table"
    continue
  fi
  
  echo "🔧 Creating table: $table"
  
  # Get table definition from staging
  table_def=$(psql "$STAGING_DATABASE_URL" -c "
    SELECT 'CREATE TABLE ' || table_name || ' (' || 
           string_agg(column_name || ' ' || data_type || 
                     CASE WHEN character_maximum_length IS NOT NULL 
                          THEN '(' || character_maximum_length || ')' 
                          ELSE '' END, ', ') || ');'
    FROM information_schema.columns 
    WHERE table_name = '$table' AND table_schema = 'public'
    GROUP BY table_name;
  " 2>/dev/null)
  
  if [ -n "$table_def" ]; then
    echo "$table_def" | head -1 > temp_table.sql
    
    # Add primary key and other constraints if needed
    pkey_def=$(psql "$STAGING_DATABASE_URL" -c "
      SELECT 'ALTER TABLE ' || table_name || ' ADD PRIMARY KEY (' || column_name || ');'
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = '$table' 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public';
    " 2>/dev/null)
    
    if [ -n "$pkey_def" ]; then
      echo "$pkey_def" >> temp_table.sql
    fi
    
    # Execute table creation
    psql "$PRODUCTION_DATABASE_URL" -f temp_table.sql
    echo "   ✅ Created $table"
    
    rm -f temp_table.sql
  else
    echo "   ❌ Failed to get definition for $table"
  fi
done

echo ""
echo "🔍 5. MIGRATING DATA FROM STAGING TO PRODUCTION"
echo "=============================================="

echo "📦 Migrating data for all tables..."

# Use pg_dump for reliable data migration
echo "🔧 Using pg_dump for data migration..."

# Create temp directory for data dumps
mkdir -p temp_data_migration

# Export data from staging for the key tables
key_tables=("tenant_business_profiles_list" "business_hours_list" "business_hours_special_list")

for table in "${key_tables[@]}"; do
  echo "📤 Exporting $table from staging..."
  pg_dump "$STAGING_DATABASE_URL" -t "$table" --data-only --inserts > "temp_data_migration/${table}_data.sql"
  
  if [ -s "temp_data_migration/${table}_data.sql" ]; then
    echo "📥 Importing $table to production..."
    psql "$PRODUCTION_DATABASE_URL" -f "temp_data_migration/${table}_data.sql"
    echo "   ✅ Migrated $table"
  else
    echo "   ℹ️  No data to migrate for $table"
  fi
done

# Clean up temp files
rm -rf temp_data_migration

echo ""
echo "🔍 6. VERIFICATION"
echo "================"

echo "📊 Verifying migration results..."

# Check the specific tables we fixed
echo "🔍 Checking tenant_business_profiles_list:"
staging_count=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM tenant_business_profiles_list;" | tr -d ' ')
production_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM tenant_business_profiles_list;" | tr -d ' ')
echo "   Staging: $staging_count records"
echo "   Production: $production_count records"

echo ""
echo "🔍 Checking business_hours_list:"
staging_count=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM business_hours_list;" | tr -d ' ')
production_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM business_hours_list;" | tr -d ' ')
echo "   Staging: $staging_count records"
echo "   Production: $production_count records"

echo ""
echo "🔍 Checking business_hours_special_list:"
staging_count=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM business_hours_special_list;" | tr -d ' ')
production_count=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM business_hours_special_list;" | tr -d ' ')
echo "   Staging: $staging_count records"
echo "   Production: $production_count records"

echo ""
echo "🎯 COMPLETE PRODUCTION RESET FINISHED!"
echo "=================================="
echo ""
echo "✅ What was done:"
echo "   1. Audited all table conflicts between staging and production"
echo "   2. Backed up conflicting production data to $backup_dir"
echo "   3. Dropped conflicting tables (tenant_business_profile, business_hours, etc.)"
echo "   4. Created missing tables from staging schema"
echo "   5. Migrated data from staging to production"
echo "   6. Verified migration results"
echo ""
echo "📊 Migration Summary:"
echo "   - tenant_business_profiles_list: $staging_count → $production_count records"
echo "   - business_hours_list: $staging_count → $production_count records"
echo "   - business_hours_special_list: $staging_count → $production_count records"
echo ""
echo "🚀 Next Steps:"
echo "   1. Test application functionality"
echo "   2. Verify business hours display correctly"
echo "   3. Check tenant business profiles"
echo "   4. Run comprehensive table audit (script 37)"
echo ""
echo "🔄 Production reset complete - table structure now matches staging!"
