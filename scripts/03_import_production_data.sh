#!/bin/bash

# Import Production Data Script
# Usage: ./03_import_production_data.sh

set -e

echo "🚀 Starting production data import..."

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

PRODUCTION_DB_URL="${PRODUCTION_DATABASE_URL}"
DATA_DIR="./migration_exports/data"

cd "$DATA_DIR"

echo "📋 Preparing database for import..."

# Set session to replica mode to disable foreign key constraints and triggers
psql "$PRODUCTION_DB_URL" -c "
SET session_replication_role = replica;
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

echo "📋 Restoring normal database operation..."

# Restore normal session mode to re-enable constraints and triggers
psql "$PRODUCTION_DB_URL" -c "
SET session_replication_role = DEFAULT;
"

echo "📋 Analyzing tables for performance..."

# Update table statistics
psql "$PRODUCTION_DB_URL" -c "
ANALYZE;
"

echo "✅ Data import complete!"
echo "🔍 Run validate_data_migration.sql to verify the migration"
