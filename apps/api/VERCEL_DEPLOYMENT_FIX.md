# Vercel Deployment Fix for Database Connection

## Issue
Prisma can't connect to Supabase in production even after updating environment variables.

## Root Cause
1. Vercel caches Prisma client between deployments
2. Environment variables might not be properly loaded
3. Connection pooling settings need adjustment

## Solution Steps

### Step 1: Clear Vercel Cache
1. Go to Vercel Dashboard → Your API Project
2. Go to **Settings** → **General**
3. Scroll to **Build & Development Settings**
4. Click **Clear Cache**

### Step 2: Verify Environment Variables
Go to **Settings** → **Environment Variables** and ensure these are set for **Production**:

```
DATABASE_URL
postgresql://postgres:e64d93fe4e18b14@db.pzxiurmwgkqhghxydazt.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require

DIRECT_URL
postgresql://postgres:e64d93fe4e18b14@db.pzxiurmwgkqhghxydazt.supabase.co:5432/postgres?sslmode=require
```

### Step 3: Add Connection Timeout Settings
Add these additional environment variables:

```
PRISMA_CLIENT_ENGINE_TYPE=binary
DATABASE_CONNECTION_TIMEOUT=10000
```

### Step 4: Force Redeploy
1. Go to **Deployments** tab
2. Find latest deployment
3. Click **⋯** (three dots)
4. Click **Redeploy**
5. ✅ Check **"Use existing Build Cache"** = OFF (unchecked)
6. Click **Redeploy**

### Step 5: Monitor Deployment Logs
Watch the build logs for:
- ✅ `prisma generate` runs successfully
- ✅ No connection errors during build
- ✅ TypeScript compilation succeeds

## Alternative: Try Session Mode Instead of Transaction Mode

If the above doesn't work, try changing DATABASE_URL to use session mode:

```
DATABASE_URL
postgresql://postgres.pzxiurmwgkqhghxydazt:e64d93fe4e18b14@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

Note: This uses the pooler hostname with port 5432 (session mode).

## Verify After Deployment

Check the deployment logs for:
```
✅ Database connection successful
✅ Platform settings loaded
✅ API server started on port 4000
```

## If Still Failing

1. Check Supabase project isn't paused
2. Verify connection string in Supabase dashboard matches exactly
3. Try direct connection (port 5432) without pooling
4. Contact Vercel support if issue persists
