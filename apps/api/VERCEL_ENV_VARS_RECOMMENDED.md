# Recommended Vercel Environment Variables

## Current Variables (Keep These)
✅ Already set - no changes needed:

```bash
DATABASE_URL=postgresql://postgres.pzxiurmwgkqhghxydazt:e64d93fe4e18b14@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require

DIRECT_URL=postgresql://postgres:e64d93fe4e18b14@db.pzxiurmwgkqhghxydazt.supabase.co:5432/postgres?sslmode=require

PRISMA_CLIENT_ENGINE_TYPE=binary

DATABASE_CONNECTION_TIMEOUT=10000
```

## Optional Performance Improvements

### 1. Increase Function Timeout (Recommended)
**Variable:** `VERCEL_FUNCTION_TIMEOUT`  
**Value:** `30`  
**Why:** Gives database retries more time to succeed (default is 10s)

### 2. Reduce Logging Overhead (Optional)
**Variable:** `PRISMA_LOG_LEVEL`  
**Value:** `error`  
**Why:** Only log errors in production, reduces noise

### 3. Connection Pool Size (Optional)
**Variable:** `PRISMA_CONNECTION_POOL_SIZE`  
**Value:** `1`  
**Why:** Explicitly set pool size (already in DATABASE_URL, but this is backup)

## Summary

**Required Action:** None - deploy and monitor  
**Optional Action:** Add the 3 variables above for extra reliability

## Test First

1. Deploy current changes (already pushed)
2. Monitor for 1-2 hours
3. If still seeing connection errors, add the optional variables
4. If errors persist after that, escalate to Prisma Accelerate

## Priority Order

1. **Now:** Deploy code changes (done ✅)
2. **If needed:** Add `VERCEL_FUNCTION_TIMEOUT=30`
3. **If still failing:** Consider Prisma Accelerate ($29/month)
