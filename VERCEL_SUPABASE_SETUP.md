# Vercel + Supabase Database Configuration

## Issue
Prisma migrations are failing with advisory lock timeout errors:
```
Error: P1002
Timed out trying to acquire a postgres advisory lock
```

## Root Cause
Supabase provides two types of database connections:

1. **Connection Pooler** (port 6543) - For application queries
   - Uses transaction pooling mode
   - Does NOT support advisory locks
   - Does NOT support prepared statements
   - ❌ Cannot be used for migrations

2. **Direct Connection** (port 5432) - For migrations and session mode
   - Direct connection to PostgreSQL
   - Supports advisory locks
   - Supports prepared statements
   - ✅ Required for Prisma migrations

## Solution
Configure **two separate environment variables** in Vercel:

### 1. DATABASE_URL (Connection Pooler)
Used for application queries at runtime.

**Format:**
```
postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Where to find:**
- Supabase Dashboard → Project Settings → Database
- Section: "Connection Pooling"
- Mode: "Transaction"
- Port: **6543**

### 2. DIRECT_URL (Direct Connection)
Used for Prisma migrations during build/deployment.

**Format:**
```
postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

**Where to find:**
- Supabase Dashboard → Project Settings → Database
- Section: "Connection String"
- Mode: "Session" or "Direct connection"
- Port: **5432**

**Important:** Remove `?pgbouncer=true` from the direct URL!

## Vercel Environment Variables Setup

### Step 1: Go to Vercel Dashboard
1. Open your project in Vercel
2. Go to Settings → Environment Variables

### Step 2: Add DATABASE_URL
```
Name: DATABASE_URL
Value: postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
Environments: ✓ Production ✓ Preview ✓ Development
```

### Step 3: Add DIRECT_URL
```
Name: DIRECT_URL
Value: postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
Environments: ✓ Production ✓ Preview ✓ Development
```

### Step 4: Redeploy
After adding both variables, trigger a new deployment:
- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"

## How It Works

### Prisma Schema Configuration
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooler for queries
  directUrl = env("DIRECT_URL")        // Direct for migrations
}
```

### During Deployment
1. **Build Phase:** Prisma uses `DIRECT_URL` to run migrations
   - Acquires advisory locks ✅
   - Creates/updates schema ✅
   - No timeout errors ✅

2. **Runtime Phase:** Application uses `DATABASE_URL` for queries
   - Connection pooling for efficiency ✅
   - Better performance under load ✅
   - Scales with traffic ✅

## Verification

### Check Environment Variables
In Vercel deployment logs, you should see:
```
DATABASE_URL: ✓ Set
DIRECT_URL: ✓ Set
```

### Successful Migration Output
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres"
39 migrations found in prisma/migrations
Applying migration `20251110_fix_product_condition_reserved_keyword`
Migration applied successfully ✓
```

### Failed Migration (Missing DIRECT_URL)
```
Error: P1002
Timed out trying to acquire a postgres advisory lock
```

## Troubleshooting

### Still Getting Timeout Errors?
1. Verify both URLs are correct
2. Check that DIRECT_URL uses port **5432** (not 6543)
3. Ensure DIRECT_URL does NOT have `?pgbouncer=true`
4. Check Supabase project is not paused
5. Verify database password is correct

### How to Get Connection Strings from Supabase
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click Settings (gear icon) → Database
4. Scroll to "Connection string" section
5. Copy both:
   - **Connection pooling** → DATABASE_URL
   - **Direct connection** → DIRECT_URL

### Port Reference
- **5432** = Direct connection (for migrations)
- **6543** = Connection pooler (for queries)

## References
- [Prisma + Supabase Guide](https://www.prisma.io/docs/guides/database/supabase)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma Advisory Locks](https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-monorepo)

## Summary
✅ Add `DIRECT_URL` environment variable to Vercel
✅ Use port 5432 for direct connection
✅ Use port 6543 for connection pooler
✅ Redeploy to apply changes
