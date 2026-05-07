#!/bin/bash

# Export Staging Data Script
# Usage: ./02_export_staging_data.sh

set -e

echo "🚀 Starting staging data export..."

# Check for required tools
if ! command -v psql &> /dev/null; then
  echo "❌ Error: psql not found. Please install PostgreSQL client tools."
  echo ""
  echo "📋 Installation instructions:"
  echo "Windows: Download from https://www.postgresql.org/download/windows/"
  echo "  - Run the installer and include 'Command Line Tools'"
  echo "  - Add PostgreSQL bin directory to PATH"
  echo "  - Example: C:\\Program Files\\PostgreSQL\\16\\bin"
  echo ""
  echo "Alternative: Use Chocolatey"
  echo "  choco install postgresql"
  exit 1
fi

# Configuration - Use Doppler if available
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

STAGING_DB_URL="${STAGING_DATABASE_URL}"
EXPORT_DIR="./migration_exports/data"
LARGE_TABLES="inventory_items photo_assets audit_log barcode_lookup_log"

# Create data export directory
mkdir -p "$EXPORT_DIR"
cd "$EXPORT_DIR"

echo "📋 Exporting table creation order..."

# Get table creation order from previous step
TABLE_ORDER="../table_creation_order.txt"
if [ ! -f "$TABLE_ORDER" ]; then
  echo "❌ Error: table_creation_order.txt not found. Run 01_export_staging_schema.sh first."
  exit 1
fi

echo "📋 Exporting data in chunks..."

# Function to export large table in chunks
export_large_table() {
  local table=$1
  local chunk_size=50000
  echo "📦 Exporting large table: $table (chunked)"
  
  # Get total row count
  total_rows=$(psql "$STAGING_DB_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  echo "   Total rows: $total_rows"
  
  # Export in chunks
  offset=0
  chunk_num=1
  
  while [ $offset -lt $total_rows ]; do
    echo "   Exporting chunk $chunk_num (rows $offset-$((offset + chunk_size)))"
    
    psql "$STAGING_DB_URL" -c "\copy (SELECT * FROM $table ORDER BY id LIMIT $chunk_size OFFSET $offset) TO '${table}_chunk${chunk_num}.csv' WITH CSV HEADER"
    
    offset=$((offset + chunk_size))
    chunk_num=$((chunk_num + 1))
  done
  
  # Create manifest file
  echo "total_rows,$total_rows" > "${table}_manifest.csv"
  echo "chunk_size,$chunk_size" >> "${table}_manifest.csv"
  echo "chunks,$((chunk_num - 1))" >> "${table}_manifest.csv"
}

# Function to export regular table
export_regular_table() {
  local table=$1
  echo "📦 Exporting table: $table"
  
  # Check if table is large (>100k rows)
  row_count=$(psql "$STAGING_DB_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  
  if [ "$row_count" -gt 100000 ]; then
    echo "   Large table detected ($row_count rows), using chunked export"
    export_large_table "$table"
  else
    echo "   Exporting $row_count rows"
    psql "$STAGING_DB_URL" -c "\copy $table TO '${table}.csv' WITH CSV HEADER"
    echo "row_count,$row_count" > "${table}_manifest.csv"
  fi
}

# Export tables in dependency order
while IFS= read -r table; do
  # Clean up table name (remove whitespace and special characters)
  table=$(echo "$table" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r')
  
  # Skip empty lines and comments
  if [ -z "$table" ] || [[ "$table" == \#* ]]; then
    continue
  fi
  
  echo "Processing table: $table"
  
  # Skip system tables
  case $table in
    "information_schema"*|"pg_catalog"*)
      continue
      ;;
  esac
  
  # Check if table exists and has data
  table_exists=$(psql "$STAGING_DB_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table' AND table_schema = 'public');" | tr -d ' ')
  
  if [ "$table_exists" = "t" ]; then
    export_regular_table "$table"
  else
    echo "⚠️  Table $table not found, skipping"
  fi
  
done < "$TABLE_ORDER"

echo "📋 Exporting sequences..."

# Export sequence values (PostgreSQL 18 compatible - use pg_sequences)
psql "$STAGING_DB_URL" -c "
SELECT 
  'SELECT setval(''' || schemaname || '.' || sequencename || ''', ' || last_value || ');' as reset_sequence
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
" > sequence_reset.sql

echo "📋 Exporting storage file list..."

# Export storage file information (if accessible)
if command -v supabase &> /dev/null; then
  echo "📦 Exporting storage file list..."
  supabase storage list --project-id="$STAGING_PROJECT_ID" > storage_files.txt 2>/dev/null || echo "Supabase CLI not configured for storage export"
fi

echo "📋 Generating data validation script..."

# Generate validation script for post-migration
cat > validate_data_migration.sql << 'EOF'
-- Data Validation Script
-- Run this after data import to verify migration success

-- Check row counts
CREATE TEMP TABLE staging_counts AS
SELECT 
  'inventory_items' as table_name,
  12345 as expected_count -- Replace with actual counts
UNION ALL
SELECT 
  'photo_assets' as table_name,
  67890 as expected_count
-- Add other tables with their expected counts
;

CREATE TEMP TABLE production_counts AS
SELECT 
  schemaname || '.' || tablename as table_name,
  n_tup_ins - n_tup_del as actual_count
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- Compare counts
SELECT 
  sc.table_name,
  sc.expected_count,
  pc.actual_count,
  CASE 
    WHEN sc.expected_count = pc.actual_count THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM staging_counts sc
JOIN production_counts pc ON sc.table_name = REPLACE(pc.table_name, 'public.', '')
ORDER BY sc.table_name;

-- Check for orphaned records
SELECT 
  'orphaned_photos' as check_name,
  COUNT(*) as count
FROM photo_assets pa
LEFT JOIN inventory_items ii ON pa.inventory_item_id = ii.id
WHERE ii.id IS NULL

UNION ALL

SELECT 
  'orphaned_variants' as check_name,
  COUNT(*) as count
FROM product_variants pv
LEFT JOIN inventory_items ii ON pv.parent_item_id = ii.id
WHERE ii.id IS NULL;

-- Check materialized view freshness
SELECT 
  matviewname,
  pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;
EOF

echo "📋 Creating data import script..."

# Create the corresponding import script
cat > ../03_import_production_data.sh << 'EOF'
#!/bin/bash

# Import Production Data Script
# Usage: ./03_import_production_data.sh

set -e

echo "🚀 Starting production data import..."

# Configuration
PRODUCTION_DB_URL="${PRODUCTION_DATABASE_URL}"
DATA_DIR="./migration_exports/data"

cd "$DATA_DIR"

echo "📋 Disabling constraints and triggers..."

# Disable foreign key constraints and triggers for faster import
psql "$PRODUCTION_DB_URL" -c "
SET session_replication_role = replica;

-- Disable triggers on all tables
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' DISABLE TRIGGER ALL';
    END LOOP;
END \$\$;
"

echo "📋 Importing data..."

# Function to import chunked table
import_chunked_table() {
  local table=$1
  
  if [ -f "${table}_manifest.csv" ]; then
    echo "📦 Importing chunked table: $table"
    
    # Read manifest and import chunks
    while IFS=',' read -r key value; do
      case $key in
        "chunks")
          chunks=$value
          ;;
      esac
    done < "${table}_manifest.csv"
    
    # Import each chunk
    for ((i=1; i<=chunks; i++)); do
      if [ -f "${table}_chunk${i}.csv" ]; then
        echo "   Importing chunk $i"
        psql "$PRODUCTION_DB_URL" -c "\copy $table FROM '${table}_chunk${i}.csv' WITH CSV HEADER"
      fi
    done
  else
    # Regular table import
    if [ -f "${table}.csv" ]; then
      echo "📦 Importing table: $table"
      psql "$PRODUCTION_DB_URL" -c "\copy $table FROM '${table}.csv' WITH CSV HEADER"
    fi
  fi
}

# Import tables in the same order as export
TABLE_ORDER="../table_creation_order.txt"

while IFS= read -r table; do
  case $table in
    "information_schema"*|"pg_catalog"*)
      continue
      ;;
  esac
  
  import_chunked_table "$table"
done < "$TABLE_ORDER"

echo "📋 Resetting sequences..."

# Reset sequences
if [ -f "sequence_reset.sql" ]; then
  psql "$PRODUCTION_DB_URL" -f sequence_reset.sql
fi

echo "📋 Re-enabling constraints and triggers..."

# Re-enable constraints and triggers
psql "$PRODUCTION_DB_URL" -c "
SET session_replication_role = DEFAULT;

-- Re-enable triggers on all tables
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' ENABLE TRIGGER ALL';
    END LOOP;
END \$\$;
"

echo "📋 Analyzing tables for performance..."

# Update table statistics
psql "$PRODUCTION_DB_URL" -c "
ANALYZE;
"

echo "✅ Data import complete!"
echo "🔍 Run validate_data_migration.sql to verify the migration"
EOF

chmod +x ../03_import_production_data.sh

echo "✅ Data export complete!"
echo "📁 Files created in ./migration_exports/data/"
echo ""
echo "📊 Export Summary:"
echo "   - CSV files for each table"
echo "   - sequence_reset.sql (sequence values)"
echo "   - validate_data_migration.sql (validation script)"
echo "   - storage_files.txt (storage file list)"
echo "   - ../03_import_production_data.sh (import script)"

# Display summary
echo ""
echo "📊 Export Summary:"
du -sh *.csv *.sql *.txt 2>/dev/null | head -10
