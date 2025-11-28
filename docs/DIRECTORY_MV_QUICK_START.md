# Directory Materialized Views - Quick Start Guide

**Quick Reference:** Step-by-step execution guide  
**Full Plan:** See `DIRECTORY_MATERIALIZED_VIEWS_MIGRATION_PLAN.md`

---

## Prerequisites

- [ ] Access to Supabase SQL Editor
- [ ] `DATABASE_URL` environment variable set
- [ ] Git repository access
- [ ] Bash shell (for scripts)

---

## Phase 1: Baseline Testing (30 minutes)

### Step 1: Make scripts executable
```bash
cd apps/api
chmod +x scripts/*.sh
```

### Step 2: Capture baseline metrics
```bash
./scripts/capture-baseline.sh
```

**Expected Output:** `baseline-metrics-YYYYMMDD-HHMMSS.txt`

### Step 3: Commit baseline to git
```bash
git add baseline-metrics-*.txt
git commit -m "chore: capture directory performance baseline"
```

### Step 4: Create tracking tables
1. Open Supabase SQL Editor
2. Copy/paste: `apps/api/prisma/manual_migrations/00_migration_tracking.sql`
3. Execute
4. Verify:
```sql
SELECT * FROM manual_migrations;
SELECT * FROM directory_mv_refresh_log;
```

---

## Phase 2: Create Materialized Views (15 minutes)

### Step 1: Execute migration
1. Open Supabase SQL Editor
2. Copy/paste: `apps/api/prisma/manual_migrations/01_create_directory_materialized_views.sql`
3. Execute (takes ~30-60 seconds)

### Step 2: Verify creation
```sql
-- Check views exist
SELECT schemaname, matviewname, ispopulated 
FROM pg_matviews 
WHERE matviewname LIKE 'directory_%';

-- Check row counts
SELECT 
  'directory_category_listings_mv' as view_name,
  COUNT(*) as row_count
FROM directory_category_listings_mv
UNION ALL
SELECT 
  'directory_category_stats_mv' as view_name,
  COUNT(*) as row_count
FROM directory_category_stats_mv;
```

### Step 3: Test performance
```bash
./scripts/test-mv-performance.sh
```

**Expected:** 10-50x faster than baseline

---

## Phase 3: Create Triggers (15 minutes)

### Step 1: Execute migration
1. Open Supabase SQL Editor
2. Copy/paste: `apps/api/prisma/manual_migrations/02_create_directory_triggers.sql`
3. Execute

### Step 2: Verify triggers
```sql
SELECT 
  trigger_name,
  event_object_table,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%directory%'
ORDER BY event_object_table;
```

### Step 3: Test triggers
```bash
./scripts/test-triggers.sh
```

**Expected:** Triggers fire and refresh views within 30 seconds

---

## Phase 4: Update API (30 minutes)

### Step 1: Update directory routes

**File:** `apps/api/src/routes/directory-v2.ts`

**Change search query from:**
```typescript
const listingsQuery = `
  SELECT * FROM directory_listings_list
  WHERE (LOWER(primary_category) LIKE LOWER($${paramIndex}) 
         OR LOWER(secondary_categories::text) LIKE LOWER($${paramIndex}))
    AND is_published = true
    AND tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
  ORDER BY ${orderByClause}
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`;
```

**To:**
```typescript
const listingsQuery = `
  SELECT * FROM directory_category_listings_mv
  WHERE category_slug = $${paramIndex}
    AND tenant_exists = true
    AND is_active_location = true
    AND is_directory_visible = true
  ORDER BY ${orderByClause}
  LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
`;
```

### Step 2: Add category stats endpoint

```typescript
router.get('/categories/:slug/stats', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await getDirectPool().query(
      'SELECT * FROM directory_category_stats_mv WHERE category_slug = $1',
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'category_not_found' });
    }
    
    return res.json({ stats: result.rows[0] });
  } catch (error) {
    console.error('Category stats error:', error);
    return res.status(500).json({ error: 'stats_failed' });
  }
});
```

### Step 3: Test locally
```bash
# Start API
npm run dev

# Test category search
curl "http://localhost:4000/api/directory/search?category=frozen-foods"

# Test category stats
curl "http://localhost:4000/api/directory/categories/frozen-foods/stats"
```

---

## Phase 5: Deploy to Production

### Pre-Deployment Checklist
- [ ] All tests passing in development
- [ ] Performance improvements verified
- [ ] Triggers tested thoroughly
- [ ] API changes tested locally
- [ ] Team notified

### Staging Deployment

1. **Execute SQL migrations in staging Supabase:**
   - Run `01_create_directory_materialized_views.sql`
   - Run `02_create_directory_triggers.sql`

2. **Deploy API to staging:**
   ```bash
   git push origin staging
   ```

3. **Test staging:**
   ```bash
   curl "https://api-staging.visibleshelf.com/api/directory/search?category=frozen-foods"
   ```

4. **Monitor for 24 hours**

### Production Deployment

1. **Execute SQL migrations in production Supabase:**
   - Run `01_create_directory_materialized_views.sql`
   - Run `02_create_directory_triggers.sql`

2. **Deploy API to production:**
   ```bash
   git push origin main
   ```

3. **Verify performance:**
   ```bash
   curl "https://api.visibleshelf.com/api/directory/search?category=frozen-foods"
   ```

4. **Monitor refresh log:**
   ```sql
   SELECT 
     view_name,
     COUNT(*) as refresh_count,
     AVG(refresh_duration_ms) as avg_duration_ms
   FROM directory_mv_refresh_log
   WHERE refresh_started_at > NOW() - INTERVAL '24 hours'
   GROUP BY view_name;
   ```

---

## Monitoring Queries

### Check last refresh time
```sql
SELECT 
  view_name,
  MAX(refresh_completed_at) as last_refresh,
  NOW() - MAX(refresh_completed_at) as time_since_refresh
FROM directory_mv_refresh_log
WHERE status = 'completed'
GROUP BY view_name;
```

### Check refresh performance
```sql
SELECT 
  view_name,
  COUNT(*) as refresh_count,
  AVG(refresh_duration_ms) as avg_duration_ms,
  MAX(refresh_duration_ms) as max_duration_ms,
  MIN(refresh_duration_ms) as min_duration_ms
FROM directory_mv_refresh_log
WHERE refresh_started_at > NOW() - INTERVAL '24 hours'
  AND status = 'completed'
GROUP BY view_name;
```

### Alert if stale (>5 minutes)
```sql
SELECT 
  view_name,
  NOW() - MAX(refresh_completed_at) as time_since_refresh
FROM directory_mv_refresh_log
WHERE status = 'completed'
GROUP BY view_name
HAVING NOW() - MAX(refresh_completed_at) > INTERVAL '5 minutes';
```

---

## Rollback Plan

### If issues arise:

**Step 1: Revert API changes**
```bash
git revert <commit-hash>
git push origin main
```

**Step 2: Drop triggers (keep views)**
```sql
DROP TRIGGER IF EXISTS trigger_directory_listings_refresh ON directory_listings_list;
DROP TRIGGER IF EXISTS trigger_tenant_directory_refresh ON "Tenant";
DROP TRIGGER IF EXISTS trigger_business_profile_directory_refresh ON tenant_business_profiles_list;
DROP TRIGGER IF EXISTS trigger_inventory_directory_refresh ON inventory_items;
DROP TRIGGER IF EXISTS trigger_category_directory_refresh ON tenant_categories_list;
```

**Step 3: Drop views (if necessary)**
```sql
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings_mv CASCADE;
```

---

## Success Metrics

### Performance Targets
- ✅ Category page load: <50ms (from 200-500ms)
- ✅ Category stats: <5ms (from 300-800ms)
- ✅ Concurrent users: 500+ (from ~50)
- ✅ Database CPU: 60-80% reduction

### Verification
```bash
# Compare baseline vs current
diff baseline-metrics-*.txt <(./scripts/test-mv-performance.sh)
```

---

## Troubleshooting

### Views not refreshing
```sql
-- Check trigger status
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%directory%';

-- Check for errors
SELECT * FROM directory_mv_refresh_log 
WHERE status = 'failed' 
ORDER BY refresh_started_at DESC;
```

### Slow refresh times
```sql
-- Check view sizes
SELECT 
  matviewname,
  pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as size
FROM pg_matviews 
WHERE matviewname LIKE 'directory_%';

-- Check index sizes
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE tablename LIKE 'directory_%mv';
```

### Manual refresh
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats_mv;
```

---

## Files Reference

### SQL Migrations
- `00_migration_tracking.sql` - Tracking tables
- `01_create_directory_materialized_views.sql` - Views + indexes
- `02_create_directory_triggers.sql` - Triggers + functions

### Test Scripts
- `test-directory-performance.sh` - Baseline performance
- `capture-baseline.sh` - Full baseline metrics
- `test-mv-performance.sh` - MV performance
- `test-triggers.sh` - Trigger functionality

### Documentation
- `DIRECTORY_MATERIALIZED_VIEWS_MIGRATION_PLAN.md` - Full plan
- `DIRECTORY_MV_QUICK_START.md` - This file
