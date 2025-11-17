# Refresh Staging from Main - Simplified SQL Approach

**Date:** November 16, 2025  
**Method:** Git merge + Direct SQL migration via Supabase Editor

---

## 🎯 Overview

Since main has substantial changes compared to staging, we'll:
1. Backup staging database
2. Merge main into staging (code only)
3. Generate SQL migration script from Prisma
4. Apply SQL directly via Supabase SQL Editor
5. Verify everything works

---

## 🚀 Step-by-Step Execution

### Step 1: Backup Staging Database ⚠️ CRITICAL

**Option A: Export via pg_dump (Recommended for Free Plan)**

```powershell
# Get your staging DATABASE_URL from Vercel
# Vercel Dashboard → API Project → Settings → Environment Variables → DATABASE_URL

# Set the connection string
$env:PGPASSWORD = "your-password"

# Export schema and data
pg_dump "your-staging-database-url" > "staging_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Or if pg_dump is not installed, use Supabase SQL Editor:
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Run: SELECT * FROM pg_dump('public');
# 3. Copy output and save locally
```

**Option B: Quick Schema Export (Minimal Backup)**

In Supabase SQL Editor, run and save the output:
```sql
-- Export table definitions
SELECT 
  'CREATE TABLE ' || table_name || ' (' || 
  string_agg(column_name || ' ' || data_type, ', ') || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name;

-- Export row counts for verification
SELECT 
  schemaname, tablename, 
  (SELECT COUNT(*) FROM pg_class WHERE relname = tablename) as row_count
FROM pg_tables 
WHERE schemaname = 'public';
```

**Option C: Accept the Risk (Not Recommended)**

Since Supabase Free Plan has automatic daily backups, you can proceed knowing:
- ✅ Supabase backs up daily around midnight
- ⚠️ You can restore to yesterday's state if needed
- ⚠️ You'll lose today's changes if rollback is needed

**Choose your approach and proceed when ready.**

---

### Step 2: Merge Main into Staging (Code Only)

```powershell
# Fetch latest
git fetch origin

# Switch to staging
git checkout staging

# Pull latest staging
git pull origin staging

# Merge main into staging
git merge origin/main -m "Refresh staging from main - substantial updates"

# If conflicts occur:
# - Review each conflict carefully
# - Since we're refreshing from main, prefer main's code
# - Resolve conflicts: git add <file>
# - Complete merge: git commit

# Push to trigger Vercel deployments
git push origin staging
```

**This triggers:**
- ✅ Vercel API deployment (aps.visibleshelf.store)
- ✅ Vercel Web deployment (www.visibleshelf.store)

⚠️ **Note:** Deployments will happen but may fail until database is migrated (Step 4)

---

### Step 3: Generate SQL Migration Script

```powershell
# Navigate to API directory
cd apps/api

# Generate SQL for all pending migrations
npx prisma migrate diff `
  --from-schema-datamodel prisma/schema.prisma `
  --to-schema-datasource $env:DATABASE_URL `
  --script > migration_staging_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql

# OR generate from migration history
npx prisma migrate status

# If you see pending migrations, generate SQL from them:
npx prisma migrate deploy --dry-run > migration_staging.sql
```

**Alternative: Manual SQL from Migration Files**

If you know which migrations are new in main:

```powershell
# List all migrations
ls prisma/migrations

# Identify migrations not yet applied to staging
# Combine their SQL files into one script
```

---

### Step 4: Apply SQL via Supabase SQL Editor

**In Supabase Dashboard:**

1. Go to your **staging** project
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy the generated SQL from Step 3
5. Review the SQL carefully:
   - Check for `CREATE TABLE` statements
   - Check for `ALTER TABLE` statements
   - Check for `CREATE INDEX` statements
   - Verify no `DROP` statements that could lose data
6. Click **"Run"** to execute
7. Check for errors in the output panel

**Common SQL Operations to Expect:**
```sql
-- New tables
CREATE TABLE "GBPCategory" (...);
CREATE TABLE "ScanTemplate" (...);

-- New columns
ALTER TABLE "InventoryItem" ADD COLUMN "gbp_category_id" TEXT;

-- New indexes
CREATE INDEX "idx_tenant_id" ON "InventoryItem"("tenantId");

-- Update enums
ALTER TYPE "item_status" ADD VALUE 'trashed';
```

---

### Step 5: Verify Migration Success

**Check Migration Status:**

In Supabase SQL Editor, run:

```sql
-- Check if _prisma_migrations table exists and is updated
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 10;

-- Count tables
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public';

-- List all tables
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check for new tables (examples based on your migrations)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'GBPCategory'
) as gbp_category_exists;

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'ScanTemplate'
) as scan_template_exists;
```

---

### Step 6: Update Prisma Migration History

After applying SQL manually, you need to mark migrations as applied:

**Option A: Via Supabase SQL Editor (Recommended)**

```sql
-- Insert migration records for each migration you applied
-- Replace with your actual migration names from prisma/migrations folder

INSERT INTO _prisma_migrations (
  id, 
  checksum, 
  finished_at, 
  migration_name, 
  logs, 
  rolled_back_at, 
  started_at, 
  applied_steps_count
) VALUES (
  gen_random_uuid(),
  'checksum_placeholder',
  NOW(),
  '20251104_fix_enrichment_status_null',
  NULL,
  NULL,
  NOW(),
  1
);

-- Repeat for each migration applied
```

**Option B: Via Prisma Migrate Resolve**

```powershell
# Mark migrations as applied without running them
cd apps/api

# For each migration that was manually applied:
npx prisma migrate resolve --applied "20251104_fix_enrichment_status_null"
npx prisma migrate resolve --applied "20251104_fix_enrichment_column_names"
# ... etc
```

---

### Step 7: Verify Staging Environment

**Test API:**
```powershell
# Health check
curl https://aps.visibleshelf.store/health

# Expected: {"status":"ok"}

# Test a database query endpoint
curl https://aps.visibleshelf.store/api/tenants
```

**Test Web:**
```
1. Visit: https://www.visibleshelf.store
2. Test login flow
3. View tenants list
4. View items list
5. Try creating/editing an item
6. Check for console errors
```

**Check Vercel Logs:**
```powershell
# Install Vercel CLI if needed
npm install -g vercel

# Check API logs
vercel logs aps.visibleshelf.store

# Check Web logs  
vercel logs www.visibleshelf.store
```

---

## 🔄 Rollback Procedure (If Needed)

**If migration fails or causes issues:**

### Rollback Database:
1. Go to Supabase Dashboard → Staging Project
2. Navigate to **Database** → **Backups**
3. Find the backup from Step 1
4. Click **"Restore"**
5. Wait for completion (5-10 minutes)

### Rollback Code:
```powershell
# Reset staging branch
git checkout staging
git reset --hard origin/staging@{1}  # Go back one commit
git push origin staging --force

# This will trigger Vercel to redeploy previous version
```

---

## 📋 Pre-Execution Checklist

- [ ] Staging database backup created and verified
- [ ] You have access to Supabase SQL Editor
- [ ] You have identified which migrations are new in main
- [ ] You have 30-45 minutes to complete the process
- [ ] You understand the rollback procedure

---

## 🎯 Success Criteria

✅ Staging database backup created  
✅ Main merged into staging branch  
✅ SQL migration script generated  
✅ SQL applied successfully via Supabase Editor  
✅ Migration history updated in _prisma_migrations  
✅ Vercel deployments completed  
✅ API health check passes  
✅ Web app loads and functions correctly  
✅ No database errors in logs  

---

## 💡 Tips for SQL Migration

**Before Running SQL:**
1. **Review carefully** - Look for any DROP statements
2. **Test queries** - Run SELECT queries first to verify table structure
3. **Run in transaction** - Wrap in BEGIN/COMMIT for safety:
   ```sql
   BEGIN;
   -- Your migration SQL here
   COMMIT;
   -- Or ROLLBACK; if something looks wrong
   ```
4. **One section at a time** - Don't run all SQL at once, do it in chunks

**Common Issues:**
- **Enum values** - Can't remove enum values, only add
- **NOT NULL constraints** - May fail if existing data has nulls
- **Foreign keys** - Ensure referenced tables exist first
- **Unique constraints** - May fail if duplicate data exists

---

## 📞 Quick Reference

**Staging URLs:**
- API: https://aps.visibleshelf.store
- Web: https://www.visibleshelf.store

**Key Commands:**
```powershell
# Generate migration SQL
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource $env:DATABASE_URL --script

# Check migration status
npx prisma migrate status

# Mark migration as applied
npx prisma migrate resolve --applied "migration_name"
```

---

**Ready to start?** Begin with Step 1: Backup your staging database!

---

**Document Version:** 1.0  
**Created:** November 16, 2025  
**Method:** Direct SQL via Supabase Editor
