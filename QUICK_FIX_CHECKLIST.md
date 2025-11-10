# 🚨 Quick Fix Checklist - Migration Advisory Lock Error

## Problem
```
Error: P1002
Timed out trying to acquire a postgres advisory lock
```

## ✅ Solution (3 Steps)

### Step 1: Get Connection Strings from Supabase
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → Database
4. Copy **both** connection strings:

**Connection Pooling (Transaction mode):**
```
postgresql://postgres.[ref]:[pass]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
→ This is your `DATABASE_URL`

**Direct Connection (Session mode):**
```
postgresql://postgres.[ref]:[pass]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```
→ This is your `DIRECT_URL` (remove `?pgbouncer=true` if present)

### Step 2: Add to Vercel Environment Variables
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add **DATABASE_URL**:
   - Name: `DATABASE_URL`
   - Value: (pooler URL with port 6543)
   - Environments: ✓ Production ✓ Preview ✓ Development

3. Add **DIRECT_URL**:
   - Name: `DIRECT_URL`
   - Value: (direct URL with port 5432, NO pgbouncer param)
   - Environments: ✓ Production ✓ Preview ✓ Development

### Step 3: Redeploy
1. Vercel → Deployments
2. Click "..." on latest deployment
3. Click "Redeploy"
4. ✅ Migrations should now work!

## Key Differences

| Variable | Port | Purpose | Supports Migrations? |
|----------|------|---------|---------------------|
| DATABASE_URL | 6543 | App queries (pooled) | ❌ No |
| DIRECT_URL | 5432 | Migrations (direct) | ✅ Yes |

## Verification
After redeployment, check logs for:
```
✅ Prisma schema loaded from prisma/schema.prisma
✅ 39 migrations found in prisma/migrations
✅ Applying migration `20251110_fix_product_condition_reserved_keyword`
✅ Migration applied successfully
```

## Common Mistakes
- ❌ Using pooler URL (6543) for DIRECT_URL
- ❌ Including `?pgbouncer=true` in DIRECT_URL
- ❌ Only setting DATABASE_URL (missing DIRECT_URL)
- ❌ Forgetting to redeploy after adding variables

## Need Help?
See full documentation: `VERCEL_SUPABASE_SETUP.md`
