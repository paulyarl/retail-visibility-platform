# Connection Pool Configuration Update

**Date:** December 24, 2024  
**Purpose:** Increase connection pool limits to resolve performance test failures

---

## Configuration Changes

### New Settings
- **Connection Limit:** 5 → **20** (4x increase)
- **Pool Timeout:** 10s → **30s** (3x increase)

### Expected Impact
- 100% success rate under concurrent load (vs 42-56% with old config)
- Better handling of burst traffic
- Reduced connection timeout errors
- Improved API reliability

---

## ✅ Doppler Local - COMPLETE

**Environment:** `retail-visibility-platform` (staging config)

**Updated DATABASE_URL:**
```
postgresql://postgres.nbwsiobosqawrugnqddo:2481RVP-Ascent@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20&pool_timeout=30&sslmode=require
```

**Verification:**
```bash
doppler secrets get DATABASE_URL --plain
```

---

## Railway Staging - TO UPDATE

### Step 1: Access Railway Dashboard
1. Go to https://railway.app
2. Select project: `retail-visibility-platform`
3. Select service: `api` (staging)

### Step 2: Update DATABASE_URL Variable

**Current DATABASE_URL format:**
```
postgresql://postgres.nbwsiobosqawrugnqddo:...@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10&sslmode=require
```

**New DATABASE_URL format:**
```
postgresql://postgres.nbwsiobosqawrugnqddo:...@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20&pool_timeout=30&sslmode=require
```

**Changes:**
- `connection_limit=5` → `connection_limit=20`
- `pool_timeout=10` → `pool_timeout=30`

### Step 3: Update in Railway

1. Click on **Variables** tab
2. Find `DATABASE_URL` variable
3. Click **Edit**
4. Update the query parameters:
   - Change `connection_limit=5` to `connection_limit=20`
   - Change `pool_timeout=10` to `pool_timeout=30`
5. Click **Save**
6. Railway will automatically redeploy the service

### Step 4: Verify Deployment

**Check deployment logs:**
```
[DB Pool] Creating singleton connection pool (production: true)
```

**Expected behavior:**
- Service restarts automatically
- New connections use updated pool config
- No errors in startup logs

---

## Railway Production - TO UPDATE (When Ready)

### Step 1: Access Railway Dashboard
1. Go to https://railway.app
2. Select project: `retail-visibility-platform`
3. Select service: `api` (production)

### Step 2: Update DATABASE_URL Variable

Follow same steps as staging, updating:
- `connection_limit=5` → `connection_limit=20`
- `pool_timeout=10` → `pool_timeout=30`

### Step 3: Monitor After Deployment

**Watch for:**
- Connection pool metrics
- API response times
- Error rates
- Sentry alerts

---

## Verification Commands

### Test Connection Pool Locally
```bash
# Run performance test with new config
doppler run -- node scripts/performance-test.js --iterations=50

# Expected: 100% success rate (vs 42-56% before)
```

### Test Railway Staging
```bash
# Test staging API
node scripts/performance-test.js --url=https://aps.visibleshelf.store --iterations=50

# Expected: 100% success rate
```

### Check Pool Stats in Logs
```bash
# Look for pool creation log
railway logs --service=api | grep "DB Pool"

# Should see: Creating singleton connection pool
```

---

## Rollback Plan (If Needed)

If issues occur after update:

### Revert Doppler Local
```bash
# Update DATABASE_URL back to:
connection_limit=5&pool_timeout=10
```

### Revert Railway
1. Go to Railway Variables
2. Edit DATABASE_URL
3. Change back to: `connection_limit=5&pool_timeout=10`
4. Save (auto-redeploys)

---

## Performance Test Results

### Before (connection_limit=5, pool_timeout=10)
```
Health Check:          100% success (3.5ms avg)
Database Health:       100% success (3.1ms avg)
Platform Settings:     42% success (187ms avg)
Directory Search:      56% success (79ms avg)
Category Counts:       0% success (timeout)
Store Types:           0% success (timeout)
Directory Optimized:   0% success (timeout)
Recommendations:       0% success (timeout)
```

### After (connection_limit=20, pool_timeout=30) - Expected
```
All Endpoints:         100% success
Health Check:          3-5ms avg
Platform Settings:     150-200ms avg
Directory Search:      70-90ms avg
Category Counts:       <10ms avg
Store Types:           <100ms avg
Directory Optimized:   <100ms avg
Recommendations:       5-30ms avg
```

---

## Next Steps

1. ✅ **Doppler Local** - Updated
2. ⏳ **Railway Staging** - Update DATABASE_URL variable
3. ⏳ **Test Staging** - Run performance tests
4. ⏳ **Railway Production** - Update after staging verification
5. ⏳ **Monitor** - Track metrics for 24 hours

---

## Additional Optimizations (Week 6 Days 2-5)

After connection pool fix is verified:

### Day 2-3: Database Optimization
- Create materialized views for tenant stats
- Implement automatic MV refresh (every 5-15 min)
- Add query performance monitoring

### Day 4: API Optimization
- Implement Redis caching for platform settings
- Add HTTP caching headers (Cache-Control, ETag)
- Implement response compression (gzip/brotli)

### Day 5: Frontend Optimization
- Code splitting for large pages
- Next.js Image optimization
- Prefetching for common navigation paths

---

## Documentation References

- `PERFORMANCE_BASELINE_AUDIT.md` - Initial performance metrics
- `PERFORMANCE_TEST_RESULTS_DEC24.md` - Detailed test results
- `CONNECTION_POOL_AUDIT_DEC24.md` - Pool usage audit
- `PERFORMANCE_TESTING_GUIDE.md` - Testing procedures

---

**Status:** Doppler Local ✅ | Railway Staging ⏳ | Railway Production ⏳
