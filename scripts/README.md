# Database Migration Scripts

This directory contains scripts for migrating the Retail Visibility Platform database from Staging to Production in Supabase.

## 🚀 Migration Overview

The migration is divided into 5 phases:

1. **Preparation & Validation** - Export and analyze staging schema
2. **Schema Migration** - Migrate tables, views, functions, and policies
3. **Data Migration** - Migrate all data with integrity checks
4. **Storage Migration** - Migrate Supabase storage buckets and files
5. **Rollback Procedures** - Emergency rollback if needed

## 📋 Prerequisites

### Environment Setup with Doppler

The scripts are designed to work seamlessly with **Doppler** for secret management.

#### Step 1: Create Migration Config in Doppler
```bash
# STEP 1: Create config environment (environment must be prefix to config name)
doppler configs create local_migration --project "retail-visibility-platform" --environment "local"

# STEP 2: Enter the config environment
doppler setup
# Select environment [selected local_migration]

# STEP 3: Set all required secrets
doppler secrets set --config=local_migration --environment=local STAGING_PROJECT_ID="nbwsiobosqawrugnqddo"
doppler secrets set --config=local_migration --environment=local STAGING_DATABASE_URL="postgresql://postgres.nbwsiobosqawrugnqddo:2481RVP-Ascent@aws-1-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&pool_timeout=0"
doppler secrets set --config=local_migration --environment=local STAGING_SUPABASE_URL="https://nbwsiobosqawrugnqddo.supabase.co"
doppler secrets set --config=local_migration --environment=local STAGING_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3Npb2Jvc3Fhd3J1Z25xZGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwNDMzNSwiZXhwIjoyMDc2NDgwMzM1fQ.O97e2wssHjhdtXXkOclOQqBoX63FRbXtKfvHtFct0dA"

doppler secrets set --config=local_migration --environment=local PRODUCTION_PROJECT_ID="pzxiurmwgkqhghxydazt"
doppler secrets set --config=local_migration --environment=local PRODUCTION_DATABASE_URL="postgresql://postgres.pzxiurmwgkqhghxydazt:e64d93fe4e18b14@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"
doppler secrets set --config=local_migration --environment=local PRODUCTION_SUPABASE_URL="https://pzxiurmwgkqhghxydazt.supabase.co"
doppler secrets set --config=local_migration --environment=local PRODUCTION_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eGl1cm13Z2txaGdoeXlkYXp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUxOTY0MywiZXhwIjoyMDc3MDk1NjQzfQ.zH44BHpYNqp2lIvXFGkLSJ_EIamirJBJ99Rz-_kojds"
```

#### Step 2: Install Doppler CLI
```bash
# Install Doppler CLI
curl -L https://cli.doppler.com/install.sh | sh

# Authenticate
doppler login
```

#### Step 3: Run Scripts with Doppler
All scripts automatically detect and use Doppler:
```bash
# Scripts will automatically load environment variables from Doppler
./01_export_staging_schema.sh
./02_export_staging_data.sh
./03_import_production_data.sh
./04_migrate_storage.sh
./05_rollback_procedures.sh check
```

### Manual Environment Variables (Alternative)
If you prefer not to use Doppler, you can set environment variables manually:

```bash
# Staging Environment
export STAGING_PROJECT_ID="nbwsiobosqawrugnqddo"
export STAGING_DATABASE_URL="postgresql://postgres.nbwsiobosqawrugnqddo:2481RVP-Ascent@aws-1-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&pool_timeout=0"
export STAGING_SUPABASE_URL="https://nbwsiobosqawrugnqddo.supabase.co"
export STAGING_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3Npb2Jvc3Fhd3J1Z25xZGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwNDMzNSwiZXhwIjoyMDc2NDgwMzM1fQ.O97e2wssHjhdtXXkOclOQqBoX63FRbXtKfvHtFct0dA"

# Production Environment
export PRODUCTION_PROJECT_ID="pzxiurmwgkqhghxydazt"
export PRODUCTION_DATABASE_URL="postgresql://postgres.pzxiurmwgkqhghxydazt:e64d93fe4e18b14@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"
export PRODUCTION_SUPABASE_URL="https://pzxiurmwgkqhghxydazt.supabase.co"
export PRODUCTION_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eGl1cm13Z2txaGdoeXlkYXp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUxOTY0MywiZXhwIjoyMDc3MDk1NjQzfQ.zH44BHpYNqp2lIvXFGkLSJ_EIamirJBJ99Rz-_kojds"

# Migration Tracking
export MIGRATION_START_TIME="$(date --iso-8601=seconds)"
```

### Required Tools
- PostgreSQL client tools (`psql`, `pg_dump`)
- Supabase CLI
- `jq` for JSON processing
- `curl` for API calls

### Installation
```bash
# Install PostgreSQL client (required for pg_dump and psql)
# Windows: Download from https://www.postgresql.org/download/windows/
#   - Run the installer and include "Command Line Tools"
#   - Add PostgreSQL bin directory to PATH
#   - Example: C:\Program Files\PostgreSQL\16\bin

# Alternative Windows: Use Chocolatey
# choco install postgresql

# Install Supabase CLI
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.tar.gz | tar xz
# Move supabase.exe to a directory in your PATH

# Install jq (Windows)
# Using Chocolatey: choco install jq
# Or download from: https://github.com/stedolan/jq/releases

# Verify installation
pg_dump --version
psql --version
jq --version
```

## 📁 Script Descriptions

### 1. `01_export_staging_schema.sh`
**Purpose:** Export the complete database schema from staging
**Outputs:**
- `01_staging_schema.sql` - Tables and basic structure
- `02_staging_functions_triggers.sql` - Functions and triggers
- `03_staging_materialized_views.sql` - Materialized views
- `04_staging_rls_policies.sql` - Row Level Security policies
- `05_staging_indexes.sql` - Database indexes
- `staging_table_stats.csv` - Table statistics for validation
- `table_creation_order.txt` - Table dependency order

**Usage:**
```bash
./01_export_staging_schema.sh
```

### 2. `02_export_staging_data.sh`
**Purpose:** Export all data from staging tables
**Outputs:**
- CSV files for each table (chunked for large tables)
- `sequence_reset.sql` - Sequence values
- `validate_data_migration.sql` - Post-migration validation script
- `03_import_production_data.sh` - Corresponding import script

**Usage:**
```bash
./02_export_staging_data.sh
```

### 3. `03_import_production_data.sh` (Generated)
**Purpose:** Import exported data into production
**Generated by:** `02_export_staging_data.sh`

**Usage:**
```bash
./03_import_production_data.sh
```

### 4. `04_migrate_storage.sh`
**Purpose:** Migrate Supabase storage buckets and files
**Outputs:**
- Downloaded files in `./storage_migration/`
- `storage_migration_report.md` - Migration summary

**Usage:**
```bash
./04_migrate_storage.sh
```

### 5. `05_rollback_procedures.sh`
**Purpose:** Emergency rollback procedures
**Options:**
- `check` - Check rollback readiness
- `immediate` - Full immediate rollback
- `point_in_time` - Point-in-time recovery
- `backup` - Restore from manual backup
- `partial` - Rollback specific table

**Usage:**
```bash
./05_rollback_procedures.sh check
./05_rollback_procedures.sh immediate
./05_rollback_procedures.sh partial inventory_items
```

## 🚀 Migration Steps

### Phase 1: Preparation (Day 0-1)

1. **Set up environment**
   ```bash
   # Set all required environment variables
   source .env.migration
   ```

2. **Export staging schema**
   ```bash
   ./01_export_staging_schema.sh
   ```

3. **Review exported schema**
   ```bash
   # Check table creation order
   cat migration_exports/table_creation_order.txt
   
   # Review table statistics
   cat migration_exports/staging_table_stats.csv
   ```

4. **Create production backup**
   ```bash
   supabase db dump --project-id="$PRODUCTION_PROJECT_ID" \
                   --file="./backups/pre_migration_backup.sql"
   ```

### Phase 2: Schema Migration (Day 2)

1. **Apply schema to production**
   ```bash
   cd migration_exports
   psql "$PRODUCTION_DATABASE_URL" -f 01_staging_schema.sql
   psql "$PRODUCTION_DATABASE_URL" -f 02_staging_functions_triggers.sql
   psql "$PRODUCTION_DATABASE_URL" -f 03_staging_materialized_views.sql
   psql "$PRODUCTION_DATABASE_URL" -f 04_staging_rls_policies.sql
   psql "$PRODUCTION_DATABASE_URL" -f 05_staging_indexes.sql
   ```

2. **Verify schema migration**
   ```bash
   # Check table counts
   psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"
   
   # Check materialized views
   psql "$PRODUCTION_DATABASE_URL" -c "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';"
   ```

### Phase 3: Data Migration (Day 3)

1. **Export staging data**
   ```bash
   ./02_export_staging_data.sh
   ```

2. **Import to production**
   ```bash
   ./03_import_production_data.sh
   ```

3. **Validate data migration**
   ```bash
   cd migration_exports/data
   psql "$PRODUCTION_DATABASE_URL" -f validate_data_migration.sql
   ```

### Phase 4: Storage Migration (Day 4)

1. **Migrate storage files**
   ```bash
   ./04_migrate_storage.sh
   ```

2. **Review migration report**
   ```bash
   cat storage_migration/storage_migration_report.md
   ```

### Phase 5: Final Validation (Day 5)

1. **Comprehensive validation**
   ```bash
   # Row count validation
   psql "$PRODUCTION_DATABASE_URL" -c "
   SELECT 
     schemaname,
     tablename,
     n_tup_ins - n_tup_del AS row_count
   FROM pg_stat_user_tables
   ORDER BY row_count DESC;
   "
   
   # Performance validation
   psql "$PRODUCTION_DATABASE_URL" -c "
   SELECT 
     schemaname,
     tablename,
     seq_scan,
     idx_scan
   FROM pg_stat_user_tables
   WHERE seq_scan > 100 OR idx_scan > 100;
   "
   ```

2. **Application testing**
   ```bash
   # Test API endpoints
   curl -X GET "https://api.yourapp.com/api/public/products/test-id"
   
   # Test authentication
   # Test file uploads
   # Test critical user journeys
   ```

## ⚠️ Important Notes

### Downtime Planning
- **Expected downtime:** 4-6 hours total
- **Critical period:** Data migration (2-3 hours)
- **Best time:** Low-traffic period (e.g., Sunday 2AM-8AM EST)

### Large Tables
The following tables may require special attention:
- `inventory_items` - Core product data
- `photo_assets` - Image references
- `audit_log` - Historical data (can be excluded if needed)

### Storage Considerations
- Photos bucket may contain large files
- Consider bandwidth limitations
- Parallel uploads may be needed for large file counts

### Performance Impact
- Index rebuilding can take significant time
- Materialized view refresh may be resource-intensive
- Monitor database performance during migration

## 🚨 Emergency Procedures

### Immediate Rollback
```bash
# Check rollback readiness
./05_rollback_procedures.sh check

# Perform immediate rollback
./05_rollback_procedures.sh immediate
```

### Partial Rollback
```bash
# Rollback specific table
./05_rollback_procedures.sh partial inventory_items
```

### Point-in-Time Recovery
```bash
# Rollback to specific timestamp
./05_rollback_procedures.sh point_in_time "2025-01-01" "12:00:00"
```

## 📊 Monitoring

During migration, monitor:
- Database connection counts
- Query performance
- Storage usage
- Error rates
- Application response times

### Key Monitoring Queries
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Long-running queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Database size
SELECT pg_size_pretty(pg_database_size('postgres'));
```

## 📞 Support

For issues during migration:
1. Check this README first
2. Review the detailed migration plan: `DATABASE_MIGRATION_PLAN.md`
3. Check Supabase documentation
4. Contact your database administrator

## ✅ Success Criteria

Migration is successful when:
- All tables migrated with correct row counts
- All indexes created and working
- All materialized views refreshed
- All RLS policies active
- All storage files migrated
- API endpoints responding correctly
- Frontend fully functional
- No data corruption
- Performance within acceptable ranges

---

*Remember: Always test in a non-production environment first!*
*Have backups ready before starting any migration!*
