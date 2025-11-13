# Supabase Connection String Guide

## Your Project
- Project ID: `pzxiurmwgkqhghxydazt`
- Status: ✅ Healthy (all services running)

## Get Correct Connection Strings

### Step 1: Go to Database Settings
1. Open Supabase Dashboard: https://supabase.com/dashboard/project/pzxiurmwgkqhghxydazt
2. Click **Settings** (gear icon in left sidebar)
3. Click **Database**
4. Scroll to **Connection String** section

### Step 2: Copy Connection Strings

You'll see two options:

#### Option A: Connection Pooling (Recommended for Vercel)
- Mode: **Transaction**
- Port: **6543**
- Format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

#### Option B: Direct Connection
- Port: **5432**
- Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### Step 3: Update Environment Variables

**For Vercel Production:**
```bash
# Use Connection Pooling for DATABASE_URL
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Use Direct Connection for DIRECT_URL
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**For Local Development (.env):**
```bash
# Can use either, but Direct Connection is simpler for local
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## Common Issues

### Issue 1: Wrong Hostname
❌ `aws-1-us-east-2.pooler.supabase.com` (incorrect)
✅ `aws-0-us-east-1.pooler.supabase.com` (correct)

### Issue 2: Wrong Password Format
- Password should NOT include `postgres.` prefix
- Copy exactly as shown in dashboard

### Issue 3: Missing Connection Parameters
For Vercel, add these to DATABASE_URL:
- `?pgbouncer=true`
- `&connection_limit=1`
- `&pool_timeout=0`

## Test Connection

After updating, test with:
```bash
node test-db-connection.js
```

Should see:
```
✅ Database connection successful!
✅ Found X users in database
✅ Found X tenants in database
```
