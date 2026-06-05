# Performance Testing Guide

Quick reference for running performance tests and interpreting results.

---

## Running Performance Tests

### Basic Usage
```bash
# Test all endpoints (10 iterations each)
node scripts/performance-test.js

# Test specific endpoint
node scripts/performance-test.js --endpoint=/api/directory/mv/search

# Run more iterations for better accuracy
node scripts/performance-test.js --iterations=50

# Test against staging/production
node scripts/performance-test.js --url=https://staging.yourapp.com
```

### Environment Variables
```bash
# Set base URL
export API_BASE_URL=http://localhost:4000

# Set default iterations
export ITERATIONS=20

# Run test
node scripts/performance-test.js
```

---

## Interpreting Results

### Response Time Metrics
- **Min/Max:** Range of response times observed
- **Avg:** Average response time across all requests
- **Median:** Middle value (50th percentile)
- **P90:** 90% of requests completed within this time
- **P95:** 95% of requests completed within this time
- **P99:** 99% of requests completed within this time

### Performance Targets
| Metric | Excellent | Good | Acceptable | Slow | Very Slow |
|--------|-----------|------|------------|------|-----------|
| Avg Response Time | <100ms | 100-300ms | 300-500ms | 500-1000ms | >1000ms |
| P95 Response Time | <200ms | 200-500ms | 500-1000ms | 1000-2000ms | >2000ms |
| Success Rate | 100% | >99% | >95% | >90% | <90% |

### Status Indicators
- ✅ **Excellent/Good:** No action needed
- ⚠️ **Acceptable/Slow:** Consider optimization
- ❌ **Very Slow:** Requires immediate optimization

---

## Common Performance Issues

### 1. High Response Times (>500ms)
**Possible Causes:**
- Complex database queries
- Missing indexes
- No caching
- N+1 query problems
- Large response payloads

**Solutions:**
- Add database indexes
- Implement caching (Redis)
- Use materialized views
- Optimize queries with EXPLAIN ANALYZE
- Paginate large result sets

### 2. High P95/P99 Times
**Possible Causes:**
- Cold start issues
- Occasional slow queries
- Database connection pool exhaustion
- Memory pressure

**Solutions:**
- Implement connection pooling
- Add query timeouts
- Monitor memory usage
- Implement circuit breakers

### 3. Low Success Rate (<95%)
**Possible Causes:**
- Server errors (500s)
- Timeouts
- Database connection issues
- Resource exhaustion

**Solutions:**
- Check server logs
- Increase timeouts
- Scale resources
- Implement retry logic

---

## Performance Testing Workflow

### 1. Establish Baseline
```bash
# Run baseline test
node scripts/performance-test.js --iterations=50 > baseline-results.txt

# Save baseline metrics
git add baseline-results.txt
git commit -m "Add performance baseline"
```

### 2. Make Optimizations
- Implement caching
- Add indexes
- Optimize queries
- etc.

### 3. Re-test and Compare
```bash
# Run test again
node scripts/performance-test.js --iterations=50 > optimized-results.txt

# Compare results
diff baseline-results.txt optimized-results.txt
```

### 4. Document Improvements
```markdown
## Optimization: Added Redis caching for platform settings

**Before:**
- Avg: 850ms
- P95: 1200ms

**After:**
- Avg: 15ms
- P95: 25ms

**Improvement:** 98% reduction in response time
```

---

## Advanced Testing

### Load Testing
For concurrent user testing, use tools like:
- **Apache Bench (ab):** Simple HTTP load testing
- **wrk:** Modern HTTP benchmarking tool
- **k6:** Developer-centric load testing

Example with Apache Bench:
```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:4000/api/directory/mv/search
```

### Database Query Profiling
```sql
-- Enable query timing
\timing

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM directory_listings_list
WHERE status = 'active'
LIMIT 20;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Frontend Performance
Use Chrome DevTools:
1. Open DevTools (F12)
2. Go to Performance tab
3. Record page load
4. Analyze:
   - Loading time
   - Scripting time
   - Rendering time
   - Painting time

---

## Continuous Monitoring

### Set Up Alerts
Monitor these metrics in production:
- API response time (P95 > 1000ms)
- Error rate (>1%)
- Database query time (P95 > 500ms)
- Memory usage (>80%)
- CPU usage (>70%)

### Regular Testing Schedule
- **Daily:** Quick smoke test (10 iterations)
- **Weekly:** Full performance test (50 iterations)
- **Before Release:** Comprehensive test (100 iterations)
- **After Optimization:** Immediate re-test

---

## Troubleshooting

### Test Script Fails
```bash
# Check if server is running
curl http://localhost:4000/health

# Check Node.js version
node --version  # Should be v18+

# Run with debug output
DEBUG=* node scripts/performance-test.js
```

### Inconsistent Results
- Run more iterations (--iterations=100)
- Ensure no other processes are running
- Test at consistent times
- Use dedicated test environment

### Timeout Errors
- Increase timeout in script (default: 10s)
- Check server logs for errors
- Verify database connectivity
- Monitor resource usage

---

## Best Practices

1. **Test in Isolation:** Stop other services during testing
2. **Consistent Environment:** Use same machine/network conditions
3. **Sufficient Iterations:** Minimum 10, preferably 50+
4. **Warmup Runs:** Script includes 2 warmup iterations
5. **Document Everything:** Save results and context
6. **Test Regularly:** Make it part of your workflow
7. **Compare Fairly:** Same conditions for before/after tests

---

## Quick Reference Commands

```bash
# Full test suite
node scripts/performance-test.js --iterations=50

# Single endpoint
node scripts/performance-test.js --endpoint=/api/directory/mv/search --iterations=100

# Production test
node scripts/performance-test.js --url=https://api.yourapp.com --iterations=20

# Save results
node scripts/performance-test.js > results-$(date +%Y%m%d).txt

# Compare with baseline
diff baseline-results.txt current-results.txt
```

---

**Last Updated:** December 24, 2024  
**Related Documents:**
- `PERFORMANCE_BASELINE_AUDIT.md` - Current baseline metrics
- `scripts/performance-test.js` - Testing script
