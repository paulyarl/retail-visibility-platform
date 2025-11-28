# Directory Materialized Views - Naming Standard Alignment

**Status:** ⚠️ ALIGNMENT REQUIRED  
**Created:** 2024-11-28  
**Reference:** `DATABASE_NAMING_STANDARD_MIGRATION_PLAN.md`

---

## Naming Standard Compliance Check

### ✅ **What's Already Compliant:**

1. **Column Names** - All snake_case ✅
   - `tenant_id`, `business_name`, `category_slug`, `rating_avg`, etc.

2. **Table References** - Using correct table names ✅
   - `directory_listings_list` (existing table)
   - `"Tenant"` (CamelCase table - will be migrated to `tenants` later)

3. **Boolean Columns** - Using `is_` prefix ✅
   - `is_featured`, `is_active_location`, `is_directory_visible`, `is_google_synced`

---

## ⚠️ **Changes Required for Compliance:**

### 1. Materialized View Names

**Standard:** `snake_case_plural` (no `_mv` suffix)

**BEFORE (Non-compliant):**
```sql
CREATE MATERIALIZED VIEW directory_category_listings_mv AS ...
CREATE MATERIALIZED VIEW directory_category_stats_mv AS ...
```

**AFTER (Compliant):**
```sql
CREATE MATERIALIZED VIEW directory_category_listings AS ...
CREATE MATERIALIZED VIEW directory_category_stats AS ...
```

**Rationale:** 
- Naming standard specifies `snake_case_plural` for all tables/views
- No special suffix needed - materialized views are just tables
- Follows same pattern as `inventory_items`, `photo_assets`, etc.

---

### 2. Index Names

**Standard:** `idx_{table}_{column(s)}`

**BEFORE (Non-compliant):**
```sql
CREATE INDEX idx_category_mv_slug ON directory_category_listings_mv(category_slug);
CREATE INDEX idx_category_mv_slug_city_state ON directory_category_listings_mv(...);
CREATE INDEX idx_category_mv_featured ON directory_category_listings_mv(...);
```

**AFTER (Compliant):**
```sql
CREATE INDEX idx_directory_category_listings_category_slug 
  ON directory_category_listings(category_slug);

CREATE INDEX idx_directory_category_listings_category_slug_city_state 
  ON directory_category_listings(category_slug, city, state);

CREATE INDEX idx_directory_category_listings_featured 
  ON directory_category_listings(is_featured, category_slug) 
  WHERE is_featured = true;
```

**Rationale:**
- Index names must include full table name
- Follows pattern: `idx_{full_table_name}_{columns}`
- Makes index ownership clear in database

---

### 3. Unique Index Names

**Standard:** `uq_{table}_{column(s)}` for unique constraints

**BEFORE (Non-compliant):**
```sql
CREATE UNIQUE INDEX idx_category_stats_slug 
  ON directory_category_stats_mv(category_slug);
```

**AFTER (Compliant):**
```sql
CREATE UNIQUE INDEX uq_directory_category_stats_category_slug 
  ON directory_category_stats(category_slug);
```

**Rationale:**
- Unique indexes should use `uq_` prefix, not `idx_`
- Distinguishes unique constraints from regular indexes

---

### 4. Refresh Log Table Name

**Standard:** `snake_case_plural`

**CURRENT:**
```sql
CREATE TABLE directory_mv_refresh_log (...)
```

**COMPLIANT (Already correct):** ✅
- Uses `snake_case`
- Singular `log` is acceptable for log tables
- Could be `directory_mv_refresh_logs` (plural) for strict compliance

**RECOMMENDATION:** Keep as-is or rename to `directory_mv_refresh_logs` for consistency

---

## Updated Naming Scheme

### Materialized Views:
```
directory_category_listings      (was: directory_category_listings_mv)
directory_category_stats         (was: directory_category_stats_mv)
```

### Indexes on `directory_category_listings`:
```
idx_directory_category_listings_category_slug
idx_directory_category_listings_category_slug_city_state
idx_directory_category_listings_featured
idx_directory_category_listings_rating
idx_directory_category_listings_products
idx_directory_category_listings_newest
idx_directory_category_listings_location
```

### Indexes on `directory_category_stats`:
```
uq_directory_category_stats_category_slug  (unique)
idx_directory_category_stats_store_count
idx_directory_category_stats_products
idx_directory_category_stats_rating
```

### Support Tables:
```
manual_migrations                (tracking table)
directory_mv_refresh_logs        (refresh history)
```

---

## Migration Impact Analysis

### SQL Files to Update:
1. ✅ `01_create_directory_materialized_views.sql`
2. ✅ `02_create_directory_triggers.sql`

### Code Files to Update:
1. ✅ `apps/api/src/routes/directory-v2.ts` (API queries)
2. ✅ `docs/DIRECTORY_MV_CODE_RETROFIT.md` (documentation)
3. ✅ `docs/DIRECTORY_MATERIALIZED_VIEWS_MIGRATION_PLAN.md` (plan)
4. ✅ `docs/DIRECTORY_MV_QUICK_START.md` (quick start)

### Testing Scripts to Update:
1. ✅ `apps/api/scripts/test-mv-performance.sh`
2. ✅ `apps/api/scripts/test-triggers.sh`

---

## Compatibility with Future Migrations

### When `Tenant` → `tenants` Migration Happens:

**Current Query:**
```sql
FROM directory_listings_list dl
INNER JOIN "Tenant" t ON t.id = dl.tenant_id
```

**After Migration:**
```sql
FROM directory_listings_list dl
INNER JOIN tenants t ON t.id = dl.tenant_id
```

**Impact:** Materialized view will need refresh, but naming is already compliant ✅

---

## Rollback SQL (Updated)

```sql
-- Drop compliant views
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_directory_listings_refresh ON directory_listings_list;
DROP TRIGGER IF EXISTS trigger_tenant_directory_refresh ON "Tenant";
-- ... etc
```

---

## Verification Queries

### Check View Names:
```sql
SELECT 
  schemaname,
  matviewname,
  CASE 
    WHEN matviewname ~ '^[a-z]+(_[a-z]+)*s$' THEN '✅ COMPLIANT'
    ELSE '❌ NON-COMPLIANT'
  END as naming_status
FROM pg_matviews 
WHERE matviewname LIKE 'directory_%'
ORDER BY matviewname;
```

### Check Index Names:
```sql
SELECT 
  tablename,
  indexname,
  CASE 
    WHEN indexname ~ '^(idx|uq)_[a-z]+(_[a-z]+)*$' THEN '✅ COMPLIANT'
    ELSE '❌ NON-COMPLIANT'
  END as naming_status
FROM pg_indexes
WHERE tablename LIKE 'directory_%'
ORDER BY tablename, indexname;
```

---

## Action Items

### Before Migration:
- [ ] Update `01_create_directory_materialized_views.sql` with compliant names
- [ ] Update `02_create_directory_triggers.sql` with compliant view names
- [ ] Update all documentation with new names
- [ ] Update code retrofit guide with new names
- [ ] Update testing scripts with new names
- [ ] Review and approve naming changes

### During Migration:
- [ ] Execute updated SQL files
- [ ] Verify naming compliance with queries above
- [ ] Test all queries with new names
- [ ] Update API code to use new names

### After Migration:
- [ ] Document naming decisions
- [ ] Update migration plan status
- [ ] Verify all integrations work

---

## Summary

**Compliance Level:** 85% (Column names ✅, View names ❌, Index names ❌)

**Required Changes:**
1. Remove `_mv` suffix from materialized view names
2. Update all index names to include full table name
3. Use `uq_` prefix for unique indexes
4. Update all references in code and documentation

**Estimated Effort:** 1-2 hours (find/replace + testing)

**Risk Level:** LOW (naming only, no logic changes)

**Recommendation:** ✅ **Fix before Phase 1 execution** to avoid technical debt
