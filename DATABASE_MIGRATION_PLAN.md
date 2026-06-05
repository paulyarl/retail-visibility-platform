# Database Migration Plan: Staging → Production
## Supabase Retail Visibility Platform

---

## 📋 Executive Summary

This document outlines a comprehensive phased migration plan to migrate all database objects, data, and configurations from the Staging Supabase environment to the Production Supabase environment.

**Migration Scope:**
- All tables and data
- Materialized views
- RLS policies
- Functions and triggers
- Indexes
- Storage buckets and files
- Auth configurations
- Database settings and extensions

---

## 🎯 Migration Strategy

### Phase 1: Preparation & Validation (Day 0-1)
### Phase 2: Schema Migration (Day 2)
### Phase 3: Data Migration (Day 3)
### Phase 4: Post-Migration Validation (Day 4)
### Phase 5: Cutover & Monitoring (Day 5)

---

## 📅 Detailed Migration Plan

### Phase 1: Preparation & Validation (Day 0-1)

#### 1.1 Environment Assessment
```bash
# Staging environment info
- Project ID: [Get from staging dashboard]
- Database URL: [Get from staging settings]
- Storage buckets: photos, [others]
- Auth providers: Email (magic links)
- Extensions: pg_stat_statements, pg_cron, etc.

# Production environment info  
- Project ID: [Get from production dashboard]
- Database URL: [Get from production settings]
- Current state: [Assess what exists]
```

#### 1.2 Backup Production
```sql
-- Create full production backup
CREATE DATABASE production_backup_template TEMPLATE production_db;
```

#### 1.3 Export Staging Schema
```bash
# Export schema structure
pg_dump --schema-only --no-owner --no-privileges \
  --file=staging_schema.sql \
  "$STAGING_DATABASE_URL"

# Export all objects (functions, triggers, views)
pg_dump --schema-only --no-owner --no-privileges \
  --include=everything \
  --file=staging_full_schema.sql \
  "$STAGING_DATABASE_URL"
```

#### 1.4 Generate Migration Scripts
```sql
-- Create migration validation script
-- This will be used to compare staging vs production
```

#### 1.5 Prepare Storage Migration
```bash
# List all storage buckets and files
supabase storage list --project-id=$STAGING_PROJECT_ID
# Document file counts and sizes
```

---

### Phase 2: Schema Migration (Day 2)

#### 2.1 Pre-Migration Checks
```sql
-- Check production database state
SELECT 
  schemaname,
  tablename,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog');

-- Check existing materialized views
SELECT matviewname, definition FROM pg_matviews;

-- Check existing functions
SELECT proname, prosrc FROM pg_proc WHERE pronamespace::regname != 'pg_catalog';
```

#### 2.2 Schema Migration Steps

**Step 1: Create Migration Script**
```sql
-- File: 01_schema_migration.sql

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- Drop existing tables (if any) - CAREFUL!
-- This will be executed only after confirming production is safe to wipe
-- DROP TABLE IF EXISTS public.table_name CASCADE;

-- Create tables from staging schema
-- [All CREATE TABLE statements from staging]

-- Recreate foreign key constraints
SET session_replication_role = DEFAULT;

-- Create indexes
-- [All CREATE INDEX statements]

-- Create functions
-- [All CREATE FUNCTION statements]

-- Create triggers
-- [All CREATE TRIGGER statements]
```

**Step 2: Materialized Views Migration**
```sql
-- File: 02_materialized_views.sql

-- Create materialized views
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_global_discovery AS
-- [Definition from staging];

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_storefront_products AS
-- [Definition from staging];

-- Refresh all materialized views
REFRESH MATERIALIZED VIEW mv_global_discovery;
REFRESH MATERIALIZED VIEW mv_storefront_products;
```

**Step 3: RLS Policies**
```sql
-- File: 03_rls_policies.sql

-- Enable RLS on tables
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
-- [Other tables]

-- Create policies
CREATE POLICY "Users can view own tenant items" ON public.inventory_items
  FOR SELECT USING (tenant_id = auth.uid());

-- [All other policies from staging]
```

#### 2.3 Execute Schema Migration
```bash
# Execute schema migration
psql "$PRODUCTION_DATABASE_URL" -f 01_schema_migration.sql
psql "$PRODUCTION_DATABASE_URL" -f 02_materialized_views.sql  
psql "$PRODUCTION_DATABASE_URL" -f 03_rls_policies.sql
```

---

### Phase 3: Data Migration (Day 3)

#### 3.1 Data Export Strategy
```bash
# Export data in chunks for large tables
pg_dump --data-only --no-owner --no-privileges \
  --exclude-table-data=audit_log \
  --exclude-table-data=barcode_lookup_log \
  --file=staging_data.sql \
  "$STAGING_DATABASE_URL"

# For very large tables, use CSV export
psql "$STAGING_DATABASE_URL" -c "\copy inventory_items TO 'inventory_items.csv' WITH CSV HEADER"
psql "$STAGING_DATABASE_URL" -c "\copy photo_assets TO 'photo_assets.csv' WITH CSV HEADER"
```

#### 3.2 Data Import Strategy
```sql
-- File: 04_data_migration.sql

-- Import data in dependency order
-- 1. Reference data (tenants, categories, etc.)
-- 2. Main data (inventory_items, users, etc.)  
-- 3. Dependent data (photo_assets, audit_log, etc.)

-- Disable constraints and triggers for faster import
SET session_replication_role = replica;
ALTER TABLE inventory_items DISABLE TRIGGER ALL;

-- Import data
\copy inventory_items FROM 'inventory_items.csv' WITH CSV HEADER

-- Re-enable constraints and triggers
SET session_replication_role = DEFAULT;
ALTER TABLE inventory_items ENABLE TRIGGER ALL;
```

#### 3.3 Storage Migration
```bash
# Migrate storage files
supabase storage migrate \
  --from-project=$STAGING_PROJECT_ID \
  --to-project=$PRODUCTION_PROJECT_ID \
  --bucket=photos

# Alternative: Manual sync using supabase CLI
supabase storage download --project-id=$STAGING_PROJECT_ID --bucket=photos ./staging_photos
supabase storage upload --project-id=$PRODUCTION_PROJECT_ID --bucket=photos ./staging_photos
```

---

### Phase 4: Post-Migration Validation (Day 4)

#### 4.1 Data Validation
```sql
-- Row count validation
SELECT 
  schemaname,
  tablename,
  n_tup_ins - n_tup_del AS row_count
FROM pg_stat_user_tables;

-- Data integrity checks
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN item_status = 'active' THEN 1 END) as active_items,
  COUNT(CASE WHEN has_variants = true THEN 1 END) as variant_items
FROM inventory_items;

-- Foreign key validation
SELECT COUNT(*) as orphaned_photos
FROM photo_assets pa
LEFT JOIN inventory_items ii ON pa.inventory_item_id = ii.id
WHERE ii.id IS NULL;
```

#### 4.2 Performance Validation
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM mv_global_discovery WHERE inventory_item_id = 'test-id';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes;
```

#### 4.3 Application Testing
```bash
# Test API endpoints
curl -X GET "https://api.yourapp.com/api/public/products/test-id"

# Test authentication flow
# Test file uploads
# Test all critical user journeys
```

---

### Phase 5: Cutover & Monitoring (Day 5)

#### 5.1 Final Cutover Checklist
- [ ] All data migrated successfully
- [ ] All indexes created and working
- [ ] All materialized views refreshed
- [ ] RLS policies active and correct
- [ ] Storage files migrated
- [ ] Auth configuration updated
- [ ] API endpoints responding correctly
- [ ] Frontend can connect to new production
- [ ] Monitoring and alerts configured

#### 5.2 DNS and Configuration Updates
```bash
# Update environment variables
DATABASE_URL=production_db_url
SUPABASE_URL=production_supabase_url
SUPABASE_ANON_KEY=production_anon_key
SUPABASE_SERVICE_ROLE_KEY=production_service_key
```

#### 5.3 Monitoring Setup
```sql
-- Set up monitoring queries
CREATE OR REPLACE VIEW monitoring.system_health AS
SELECT 
  'database_connections' as metric,
  COUNT(*) as value
FROM pg_stat_activity;

-- Monitor slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🚨 Rollback Plan

### Immediate Rollback (if critical issues found)
```bash
# 1. Point-in-time recovery (if within 7 days)
supabase db restore --timestamp="2024-01-01 12:00:00" --project-id=$PRODUCTION_PROJECT_ID

# 2. Restore from backup
supabase db restore --backup-id=backup_id --project-id=$PRODUCTION_PROJECT_ID
```

### Partial Rollback
```sql
-- Rollback specific tables if needed
TRUNCATE TABLE inventory_items CASCADE;
-- Restore from staging export
\copy inventory_items FROM 'inventory_items_backup.csv' WITH CSV HEADER
```

---

## 📊 Migration Scripts

### Pre-Migration Validation Script
```sql
-- File: pre_migration_validation.sql

-- Check staging database size
SELECT pg_size_pretty(pg_database_size('staging_db'));

-- Check table row counts
SELECT 
  schemaname,
  tablename,
  n_tup_ins - n_tup_del AS row_count
FROM pg_stat_user_tables
ORDER BY row_count DESC;

-- Check for large tables
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Post-Migration Validation Script
```sql
-- File: post_migration_validation.sql

-- Compare row counts with staging
-- This should be run on both environments and results compared

-- Check materialized view freshness
SELECT 
  matviewname,
  pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as size,
  last_refresh
FROM pg_matviews;

-- Verify RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public';
```

---

## ⚠️ Critical Considerations

### 1. Downtime Planning
- **Expected downtime:** 4-6 hours during migration
- **Best time:** Low-traffic period (e.g., Sunday 2AM-8AM EST)
- **Communication plan:** Notify users 48 hours in advance

### 2. Data Consistency
- **No writes to staging** during migration window
- **No writes to production** until cutover complete
- **Consider read-only mode** during migration

### 3. Performance Impact
- **Large tables:** inventory_items, photo_assets, audit_log
- **Migration speed:** ~1GB per hour (estimate)
- **Index rebuild:** May take 1-2 hours

### 4. Security
- **Protect API keys** during migration
- **Update all environment variables**
- **Verify RLS policies** before going live

---

## 📞 Emergency Contacts

- **Database Admin:** [Contact info]
- **Supabase Support:** [Contact info]
- **Application Team:** [Contact info]
- **DevOps Team:** [Contact info]

---

## 📈 Success Criteria

Migration is considered successful when:

1. ✅ All tables migrated with correct row counts
2. ✅ All indexes created and performing well
3. ✅ All materialized views refreshed and accessible
4. ✅ RLS policies working correctly
5. ✅ Storage files accessible
6. ✅ API endpoints responding correctly
7. ✅ Frontend fully functional
8. ✅ No data corruption or loss
9. ✅ Performance within acceptable ranges
10. ✅ Monitoring and alerts active

---

## 📝 Migration Timeline

| Day | Time (EST) | Activity | Owner |
|-----|------------|----------|-------|
| Day 0 | 9:00 AM | Environment assessment | DBA |
| Day 0 | 2:00 PM | Production backup | DBA |
| Day 1 | 10:00 AM | Export staging schema | DBA |
| Day 1 | 3:00 PM | Generate migration scripts | DBA |
| Day 2 | 12:00 AM | Schema migration start | DBA |
| Day 2 | 6:00 AM | Schema migration complete | DBA |
| Day 3 | 12:00 AM | Data migration start | DBA |
| Day 3 | 8:00 AM | Data migration complete | DBA |
| Day 4 | 9:00 AM | Validation testing | QA |
| Day 4 | 2:00 PM | Performance testing | QA |
| Day 5 | 12:00 AM | Final cutover | DevOps |
| Day 5 | 6:00 AM | Monitoring setup | DevOps |
| Day 5 | 9:00 AM | Go-live announcement | PM |

---

## 🔧 Tools and Commands

### Supabase CLI Commands
```bash
# List projects
supabase projects list

# Switch projects
supabase projects switch --project-id=$PROJECT_ID

# Database operations
supabase db dump --project-id=$PROJECT_ID --file=backup.sql
supabase db restore --project-id=$PROJECT_ID --file=backup.sql

# Storage operations
supabase storage list --project-id=$PROJECT_ID
supabase storage migrate --from-project=$FROM --to-project=$TO
```

### PostgreSQL Commands
```bash
# Connect to database
psql "$DATABASE_URL"

# Check database size
SELECT pg_size_pretty(pg_database_size('your_db'));

# Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query_start < now() - interval '1 hour';
```

---

## 📚 References

- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)
- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Prisma Migration Best Practices](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

*Last updated: January 2025*
*Version: 1.0*
