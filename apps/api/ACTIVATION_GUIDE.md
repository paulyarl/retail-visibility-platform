# Category Directory Activation Guide

## 🎯 Quick Start

The category directory feature is **deployed but inactive**. Follow these steps to activate it.

---

## Step 1: Run SQL Migration

### Option A: Supabase SQL Editor (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of:
   ```
   apps/api/prisma/migrations/MANUAL_MIGRATION.sql
   ```
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. Wait for "Success. No rows returned" message

### Option B: Other SQL Editors (pgAdmin, DBeaver, etc.)

1. Connect to your PostgreSQL database
2. Open a new SQL query window
3. Copy and paste the migration SQL
4. Execute the query
5. Verify no errors

---

## Step 2: Verify Migration

Run this query to verify the migration worked:

```sql
-- Check new columns exist
SELECT 
  slug, 
  google_sync_enabled, 
  google_last_sync, 
  directory_visible 
FROM "Tenant" 
LIMIT 5;

-- Check materialized view exists
SELECT * FROM directory_category_stores LIMIT 10;
```

**Expected Results:**
- First query: Returns rows with new columns (may be NULL, that's OK)
- Second query: Returns category-store associations (may be empty if no data yet)

---

## Step 3: Regenerate Prisma Client

In your terminal, run:

```bash
cd apps/api
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client
```

This updates the TypeScript types to include the new fields.

---

## Step 4: Activate the Service

Replace the stub service with the full implementation:

### Windows:
```powershell
cd apps/api/src/services
Remove-Item category-directory.service.ts
Rename-Item category-directory.service.DISABLED.ts category-directory.service.ts
```

### Mac/Linux:
```bash
cd apps/api/src/services
rm category-directory.service.ts
mv category-directory.service.DISABLED.ts category-directory.service.ts
```

---

## Step 5: Restart Application

```bash
# Stop your dev server (Ctrl+C)
# Then restart:
npm run dev
```

Or if deployed, trigger a new deployment.

---

## Step 6: Test the Feature

### Test API Endpoints:

```bash
# Get all categories
curl http://localhost:4000/api/directory/categories

# Get stores by category (replace {categoryId} with actual ID)
curl http://localhost:4000/api/directory/categories/{categoryId}/stores
```

### Test UI:

1. Visit: `http://localhost:3000/directory`
2. You should see the category browser (if categories exist)
3. Click "View all categories"
4. Click a category to see stores

---

## 🔍 Troubleshooting

### Issue: "No categories showing"

**Cause:** No data in the materialized view yet.

**Solution:** You need stores with:
- `google_sync_enabled = true`
- `google_last_sync` within last 24 hours
- Active, public products
- Products assigned to categories

**Quick Fix for Testing:**
```sql
-- Enable Google sync for a test store
UPDATE "Tenant" 
SET 
  google_sync_enabled = true,
  google_last_sync = NOW(),
  directory_visible = true,
  slug = 'test-store'
WHERE id = 'your-tenant-id';

-- Refresh the view
SELECT refresh_directory_category_stores();
```

### Issue: "TypeScript errors after activation"

**Cause:** Prisma client not regenerated.

**Solution:**
```bash
cd apps/api
npx prisma generate
# Restart your dev server
```

### Issue: "Materialized view is empty"

**Cause:** No stores meet the criteria yet.

**Solution:** Check requirements:
```sql
-- See what's missing
SELECT 
  t.id,
  t.name,
  t.google_sync_enabled,
  t.google_last_sync,
  COUNT(ii.id) as product_count
FROM "Tenant" t
LEFT JOIN "InventoryItem" ii ON ii.tenant_id = t.id
WHERE t.google_sync_enabled = true
GROUP BY t.id, t.name, t.google_sync_enabled, t.google_last_sync;
```

---

## 📊 Monitoring

### Check View Freshness:

```sql
SELECT 
  category_name,
  COUNT(*) as store_count,
  MAX(last_product_update) as latest_update
FROM directory_category_stores
GROUP BY category_name
ORDER BY store_count DESC;
```

### Refresh Manually:

```sql
SELECT refresh_directory_category_stores();
```

### Set Up Auto-Refresh (Optional):

If you have `pg_cron` extension:

```sql
-- Refresh every 15 minutes
SELECT cron.schedule(
  'refresh-directory-categories', 
  '*/15 * * * *', 
  'SELECT refresh_directory_category_stores()'
);
```

---

## ✅ Success Checklist

- [ ] SQL migration ran without errors
- [ ] New columns exist in Tenant table
- [ ] Materialized view created successfully
- [ ] Prisma client regenerated
- [ ] Service file activated (stub replaced)
- [ ] Application restarted
- [ ] API endpoints return data
- [ ] UI shows categories
- [ ] Category navigation works

---

## 🎉 You're Done!

The category directory is now fully activated and functional!

### What You Can Do Now:

1. **Browse by Category** - Users can discover stores by product type
2. **Location Filtering** - Find nearby stores with specific products
3. **Verified Inventory** - Only shows stores actively syncing
4. **Hierarchical Navigation** - Drill down through category trees

### Next Steps:

- Populate store data with Google sync enabled
- Add product categories to inventory
- Monitor materialized view performance
- Set up automatic refresh schedule
- Add analytics tracking

---

## 📚 Additional Resources

- **Full Implementation:** `apps/api/src/services/category-directory.service.DISABLED.ts`
- **API Routes:** `apps/api/src/routes/directory-categories.ts`
- **UI Components:** `apps/web/src/components/directory/`
- **Schema Changes:** `apps/api/prisma/schema.prisma`

---

## 🆘 Need Help?

If you encounter issues:

1. Check the console logs for errors
2. Verify database connection
3. Ensure Prisma client is regenerated
4. Check that stores have required data
5. Refresh the materialized view manually

The feature is designed to gracefully handle empty data, so it's safe to activate even if you don't have category data yet!
