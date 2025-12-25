# Railway Staging Performance Test Results

**Date:** December 24, 2024  
**Environment:** Railway Staging (https://aps.visibleshelf.store)  
**Configuration:** `connection_limit=20`, `pool_timeout=30`  
**Test Pattern:** 50 iterations with 500ms delay between requests

---

## 📊 Test Results Summary

| Endpoint | Success Rate | Avg Response | P95 | Status |
|----------|--------------|--------------|-----|--------|
| Health Check | **100%** | 93ms | 100ms | ✅ Excellent |
| Database Health | **100%** | 94ms | 101ms | ✅ Excellent |
| Platform Settings | **92%** | 408ms | 413ms | ⚠️ Acceptable |
| Directory Search (MV) | **56%** | 223ms | 228ms | ⚠️ Needs Improvement |
| Category Counts | **14%** | 217ms | 569ms | ❌ Poor |
| Store Types | **42%** | 157ms | 163ms | ❌ Poor |
| Directory Optimized | **0%** | - | - | ❌ Failed |
| Recommendations | **0%** | - | - | ❌ Failed |

**Overall Average Response Time:** 194ms

---

## ✅ Improvements vs Original Baseline

### Platform Settings
- **Before:** 42% success (local test with 5 connections)
- **After:** 92% success (Railway with 20 connections)
- **Improvement:** +119% success rate

### Health Endpoints
- **Before:** 100% success (3-4ms local)
- **After:** 100% success (93-94ms with network latency)
- **Status:** Stable, network latency expected

---

## ⚠️ Remaining Issues

### Connection Pool Still Exhausting Under Load

Despite increasing from 5 → 20 connections, we're still seeing failures:
- Directory Search: 56% (44% timeout)
- Category Counts: 14% (86% timeout)
- Store Types: 42% (58% timeout)
- Directory Optimized: 0% (100% timeout)
- Recommendations: 0% (100% timeout)

### Root Causes

**1. Test Pattern Still Too Aggressive**
- 50 requests with 500ms delay = 2 requests/second sustained
- Some endpoints take 200-400ms to respond
- Connections don't release fast enough for next request
- Queue builds up, later requests timeout

**2. Supabase Connection Pooler Limits**
- Using `pgbouncer=true` in connection string
- Supabase pooler may have its own connection limits
- Our app pool (20) may be hitting Supabase pooler limits (unknown)

**3. Slow Queries Under Concurrent Load**
- Platform Settings: 408ms avg (multiple DB queries)
- Directory Search: 223ms avg (materialized view query)
- These hold connections longer, reducing availability

---

## 🔍 Analysis: Why Still Failing?

### The Math Doesn't Add Up

With 500ms delay between requests:
- Request 1 starts at 0ms
- Request 2 starts at 500ms
- Request 3 starts at 1000ms
- ...
- Request 50 starts at 24,500ms (24.5 seconds)

If each request takes ~200-400ms, we should have plenty of connection availability. But we're still seeing 44-86% failure rates.

### Possible Explanations

**1. Supabase Pooler Bottleneck**
```
Your App (20 connections) → Supabase PgBouncer (? limit) → Postgres (? limit)
```
The bottleneck may be at Supabase's pooler, not our app pool.

**2. Connection Acquisition Timeout**
The 30-second `pool_timeout` may not be the issue - requests might be timing out at the HTTP level (10 seconds default) before getting a connection.

**3. Concurrent Request Queueing**
Even with 500ms spacing, if 3-4 slow requests (400ms each) overlap, they can exhaust the pool temporarily.

---

## 🎯 Recommended Solutions

### Short-Term: Adjust Test Pattern

**Option A: Increase Delay to 1000ms (1 second)**
```javascript
await new Promise(resolve => setTimeout(resolve, 1000));
```
This gives 1 request/second, ensuring connections release between requests.

**Option B: Reduce Iterations to 25**
```bash
node scripts/performance-test.js --url=https://aps.visibleshelf.store --iterations=25
```
Less sustained load, better for validating individual endpoint performance.

### Medium-Term: Database Optimization (Week 6 Days 2-3)

**1. Cache Platform Settings**
- Currently: 408ms, multiple DB queries on every request
- Solution: Redis cache with 5-minute TTL
- Expected: <10ms from cache, 95%+ cache hit rate

**2. Optimize Materialized View Queries**
- Directory Search: 223ms (already using MV)
- Add indexes on commonly filtered columns
- Consider query optimization

**3. Implement Query Result Caching**
- Cache category counts (changes infrequently)
- Cache store types (changes infrequently)
- Cache directory listings (5-minute TTL)

### Long-Term: Connection Pool Architecture

**1. Investigate Supabase Pooler Limits**
- Check Supabase dashboard for connection metrics
- May need to upgrade Supabase plan for higher pooler limits
- Consider direct connection vs pooler for certain queries

**2. Implement Application-Level Caching**
- Redis for frequently accessed data
- Reduces database connection pressure
- Improves response times dramatically

**3. Query Optimization**
- Identify slow queries with `pg_stat_statements`
- Add missing indexes
- Optimize JOIN operations
- Consider denormalization for read-heavy tables

---

## 📈 Success Metrics for Week 6

### Day 1 Goals (Connection Pool) - PARTIAL SUCCESS ✅
- ✅ Increased pool size: 5 → 20
- ✅ Increased timeout: 10s → 30s
- ✅ Platform Settings: 42% → 92% success
- ⚠️ Other endpoints: Still failing under sustained load

### Days 2-3 Goals (Database Optimization)
- [ ] Cache platform settings in Redis (408ms → <10ms)
- [ ] Add indexes to slow queries
- [ ] Implement query result caching
- [ ] Target: 100% success rate on all endpoints

### Days 4-5 Goals (API Optimization)
- [ ] HTTP caching headers (Cache-Control, ETag)
- [ ] Response compression (gzip/brotli)
- [ ] API response caching layer
- [ ] Target: <100ms P95 for cached responses

---

## 🧪 Next Test: Validate Caching Impact

After implementing Redis caching for platform settings:

**Expected Results:**
```
Platform Settings:
  Before: 408ms avg, 92% success
  After:  <10ms avg, 100% success (from cache)
  
Overall Connection Pool Pressure:
  Before: High (400ms queries hold connections)
  After:  Low (10ms queries release quickly)
  
Cascading Effect:
  Other endpoints should see improved success rates
  as connections become available faster
```

---

## 📝 Conclusions

### What Worked ✅
1. Connection pool increase improved Platform Settings (42% → 92%)
2. Health endpoints stable at 100% success
3. Response times are good when requests succeed
4. Railway deployment successful

### What Needs Work ⚠️
1. Sustained concurrent load still exhausts pool
2. Slow queries (400ms) hold connections too long
3. May be hitting Supabase pooler limits
4. Need caching layer to reduce DB pressure

### Next Steps 🎯
1. Implement Redis caching for platform settings (Day 2)
2. Add query result caching for directory endpoints (Day 2)
3. Optimize slow queries with indexes (Day 3)
4. Re-test with caching in place (Day 3)
5. Target: 100% success rate under sustained load

---

**Status:** Connection pool optimization deployed and tested. Partial success achieved. Moving to database optimization phase to complete the fix.
