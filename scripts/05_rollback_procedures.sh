#!/bin/bash

# Rollback Procedures Script
# Usage: ./05_rollback_procedures.sh [rollback_type]

set -e

echo "🚀 Rollback Procedures for Database Migration"

ROLLBACK_TYPE="${1:-help}"

# Check for required tools
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI found"
else
  echo "⚠️  Warning: Supabase CLI not found. Some rollback features may not work."
fi

if command -v psql &> /dev/null; then
  echo "✅ PostgreSQL client tools found"
else
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

PRODUCTION_PROJECT_ID="${PRODUCTION_PROJECT_ID:-your-production-project-id}"
PRODUCTION_DB_URL="${PRODUCTION_DATABASE_URL}"

case $ROLLBACK_TYPE in
  "help"|"-h"|"--help")
    echo "Usage: $0 [rollback_type]"
    echo ""
    echo "Available rollback types:"
    echo "  immediate     - Immediate rollback to pre-migration state"
    echo "  partial      - Partial rollback of specific tables"
    echo "  point_in_time- Point-in-time recovery (if within 7 days)"
    echo "  backup       - Restore from manual backup"
    echo "  check        - Check rollback readiness"
    echo ""
    echo "Examples:"
    echo "  $0 check          # Check if rollback is possible"
    echo "  $0 immediate      # Immediate full rollback"
    echo "  $0 partial inventory_items  # Rollback specific table"
    echo ""
    exit 0
    ;;
    
  "check")
    echo "🔍 Checking rollback readiness..."
    
    echo "📋 Checking Supabase CLI installation..."
    if ! command -v supabase &> /dev/null; then
      echo "❌ Supabase CLI not found. Cannot perform rollback."
      exit 1
    fi
    
    echo "📋 Checking project access..."
    if ! supabase projects list | grep -q "$PRODUCTION_PROJECT_ID"; then
      echo "❌ Cannot access production project. Check credentials."
      exit 1
    fi
    
    echo "📋 Checking backup availability..."
    # List available backups
    supabase backups list --project-id="$PRODUCTION_PROJECT_ID" 2>/dev/null || {
      echo "⚠️  Cannot list backups via CLI"
    }
    
    echo "📋 Checking database connection..."
    if ! psql "$PRODUCTION_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
      echo "❌ Cannot connect to production database."
      exit 1
    fi
    
    echo "✅ Rollback readiness check passed!"
    echo ""
    echo "📊 Available rollback options:"
    echo "1. Point-in-time recovery (if within 7 days)"
    echo "2. Manual backup restore (if backup exists)"
    echo "3. Partial table rollback"
    ;;
    
  "immediate")
    echo "⚠️  WARNING: This will immediately rollback the entire database!"
    echo "This action cannot be undone."
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "❌ Rollback cancelled."
      exit 0
    fi
    
    echo "🔄 Starting immediate rollback..."
    
    # Create backup before rollback
    backup_name="pre_rollback_backup_$(date +%Y%m%d_%H%M%S)"
    echo "📋 Creating backup: $backup_name"
    
    supabase db dump --project-id="$PRODUCTION_PROJECT_ID" \
                    --file="./backups/${backup_name}.sql" \
                    --data-only \
                    --schema=public || {
      echo "⚠️  Could not create backup, proceeding with rollback..."
    }
    
    # Option 1: Try point-in-time recovery first
    echo "🔄 Attempting point-in-time recovery..."
    
    # Get the timestamp from migration start (you need to track this)
    migration_start_time="${MIGRATION_START_TIME:-$(date -d '1 hour ago' --iso-8601)}"
    
    echo "📅 Rolling back to: $migration_start_time"
    
    if supabase db restore --timestamp="$migration_start_time" \
                         --project-id="$PRODUCTION_PROJECT_ID" 2>/dev/null; then
      echo "✅ Point-in-time recovery successful!"
    else
      echo "⚠️  Point-in-time recovery failed, trying manual backup..."
      
      # Option 2: Restore from most recent backup
      latest_backup=$(supabase backups list --project-id="$PRODUCTION_PROJECT_ID" 2>/dev/null | \
                     grep -E "^[0-9]{4}-[0-9]{2}-[0-9]{2}" | sort -r | head -1 | awk '{print $1}')
      
      if [ -n "$latest_backup" ]; then
        echo "🔄 Restoring from backup: $latest_backup"
        
        if supabase db restore --backup-id="$latest_backup" \
                             --project-id="$PRODUCTION_PROJECT_ID"; then
          echo "✅ Backup restore successful!"
        else
          echo "❌ Backup restore failed!"
          echo "📋 Manual intervention required."
          exit 1
        fi
      else
        echo "❌ No suitable backup found for rollback!"
        echo "📋 Manual intervention required."
        exit 1
      fi
    fi
    
    echo "✅ Immediate rollback completed!"
    echo ""
    echo "🔍 Next steps:"
    echo "1. Verify database integrity"
    echo "2. Test application connectivity"
    echo "3. Monitor for any issues"
    ;;
    
  "point_in_time")
    echo "🔄 Point-in-time recovery..."
    
    if [ -z "$2" ]; then
      echo "❌ Timestamp required for point-in-time recovery"
      echo "Usage: $0 point_in_time YYYY-MM-DD HH:MM:SS"
      echo "Example: $0 point_in_time 2025-01-01 12:00:00"
      exit 1
    fi
    
    timestamp="$2 $3"
    echo "📅 Rolling back to: $timestamp"
    
    read -p "Are you sure you want to rollback to $timestamp? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "❌ Rollback cancelled."
      exit 0
    fi
    
    if supabase db restore --timestamp="$timestamp" \
                         --project-id="$PRODUCTION_PROJECT_ID"; then
      echo "✅ Point-in-time recovery successful!"
    else
      echo "❌ Point-in-time recovery failed!"
      exit 1
    fi
    ;;
    
  "backup")
    echo "🔄 Restore from manual backup..."
    
    if [ -z "$2" ]; then
      echo "❌ Backup file required"
      echo "Usage: $0 backup /path/to/backup.sql"
      echo ""
      echo "Available backups in ./backups/:"
      ls -la ./backups/*.sql 2>/dev/null || echo "No backup files found"
      exit 1
    fi
    
    backup_file="$2"
    
    if [ ! -f "$backup_file" ]; then
      echo "❌ Backup file not found: $backup_file"
      exit 1
    fi
    
    echo "📋 Restoring from backup: $backup_file"
    
    read -p "Are you sure you want to restore from $backup_file? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "❌ Rollback cancelled."
      exit 0
    fi
    
    if supabase db restore --file="$backup_file" \
                         --project-id="$PRODUCTION_PROJECT_ID"; then
      echo "✅ Backup restore successful!"
    else
      echo "❌ Backup restore failed!"
      exit 1
    fi
    ;;
    
  "partial")
    echo "🔄 Partial rollback..."
    
    if [ -z "$2" ]; then
      echo "❌ Table name required for partial rollback"
      echo "Usage: $0 partial table_name"
      echo ""
      echo "Available tables:"
      psql "$PRODUCTION_DB_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | \
        grep -v "tablename" | grep -v "^--" | grep -v "^$" | head -20
      exit 1
    fi
    
    table_name="$2"
    
    echo "📋 Rolling back table: $table_name"
    
    # Check if table exists
    table_exists=$(psql "$PRODUCTION_DB_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table_name' AND table_schema = 'public');" | tr -d ' ')
    
    if [ "$table_exists" != "t" ]; then
      echo "❌ Table not found: $table_name"
      exit 1
    fi
    
    # Check if we have a backup of this table
    backup_file="./backups/${table_name}_backup.csv"
    
    if [ ! -f "$backup_file" ]; then
      echo "❌ No backup found for table: $table_name"
      echo "Expected backup file: $backup_file"
      exit 1
    fi
    
    echo "📋 Restoring table: $table_name from backup"
    
    read -p "Are you sure you want to rollback table $table_name? This will delete all current data and restore from backup. (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo "❌ Rollback cancelled."
      exit 0
    fi
    
    # Create backup of current data before rollback
    current_backup="./backups/${table_name}_current_backup_$(date +%Y%m%d_%H%M%S).csv"
    echo "📋 Creating backup of current data: $current_backup"
    
    psql "$PRODUCTION_DB_URL" -c "\copy $table_name TO '$current_backup' WITH CSV HEADER"
    
    # Truncate table and restore from backup
    echo "🔄 Truncating table and restoring data..."
    
    psql "$PRODUCTION_DB_URL" -c "
    BEGIN;
    
    -- Disable triggers
    ALTER TABLE $table_name DISABLE TRIGGER ALL;
    
    -- Truncate table
    TRUNCATE TABLE $table_name CASCADE;
    
    -- Restore data
    \copy $table_name FROM '$backup_file' WITH CSV HEADER;
    
    -- Re-enable triggers
    ALTER TABLE $table_name ENABLE TRIGGER ALL;
    
    COMMIT;
    "
    
    echo "✅ Partial rollback completed for table: $table_name"
    echo "📋 Current data backed up to: $current_backup"
    ;;
    
  *)
    echo "❌ Unknown rollback type: $ROLLBACK_TYPE"
    echo "Use '$0 help' for available options"
    exit 1
    ;;
esac

echo ""
echo "🔍 Post-rollback verification:"
echo "1. Check row counts: psql '$PRODUCTION_DB_URL' -c 'SELECT schemaname, tablename, n_tup_ins - n_tup_del FROM pg_stat_user_tables;'"
echo "2. Check application connectivity"
echo "3. Monitor error logs"
echo "4. Verify critical functionality"
