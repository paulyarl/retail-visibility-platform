# Run Storefront MV Migration Locally

**Issue:** `relation "storefront_products" does not exist`  
**Cause:** Migration run in staging, but not in local dev database  
**Solution:** Run the migration in your local database

---

## Quick Fix

### **Option 1: Supabase SQL Editor (Recommended)**

1. Open Supabase Dashboard (local project)
2. Go to SQL Editor
3. Copy and paste the entire contents of:
   ```
   apps/api/prisma/manual_migrations/09_create_storefront_products_mv.sql
   ```
4. Click "Run"
5. Verify success messages

---

### **Option 2: psql Command Line**

```bash
# Navigate to project root
cd apps/api

# Run migration
psql $DATABASE_URL -f prisma/manual_migrations/09_create_storefront_products_mv.sql
```

---

## Verification

After running the migration, verify it worked:

```bash
# Test health endpoint
curl http://localhost:4000/api/storefront/health

# Should return:
# {
#   "view": {
#     "matviewname": "storefront_products",
#     "ispopulated": true,
#     "size": "144 kB"
#   },
#   "status": "healthy"
# }
```

---

## Why This Happened

You ran the migration in **staging** (Supabase cloud), but your **local development** database is separate and doesn't have the migration yet.

**Solution:** Run the same migration in your local database.

---

## After Migration

Once the migration runs locally:

1. ✅ Storefront will load instantly
2. ✅ Category switching will be fast
3. ✅ No more "relation does not exist" errors

---

**Status:** Ready to run locally  
**Time:** 2 minutes  
**Risk:** None (safe migration)
