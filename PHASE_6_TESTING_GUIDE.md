# Phase 6: Variant Integration Testing & Optimization Guide

**Status:** Ready for Testing  
**Date:** January 28, 2026  
**Prerequisites:** Phase 1-5 Complete ✅

---

## Overview

Phase 6 focuses on comprehensive testing of the variant integration implemented in Phases 1-5, performance optimization, and production readiness verification.

### What Was Built (Phases 1-5)

**Backend:**
- ✅ 12 API queries updated with variant JOINs
- ✅ Materialized view `storefront_variants_mv` for performance
- ✅ Variant transformation utilities
- ✅ ScopeRouter with caching and retry logic
- ✅ Computed variant fields (has_variants, variant_count, price_range)

**Frontend:**
- ✅ 4 variant UI components (Badge, PriceRange, Selector, InfoCard)
- ✅ SmartProductCard integration (all 4 variants)
- ✅ Suspense boundaries for SSR
- ✅ UniversalSingleton caching in hooks

---

## Quick Start

### 1. Run Automated Tests

```bash
# Windows
phase6-test.bat

# The script will:
# - Check environment (API/Web servers)
# - Verify database schema
# - Test API endpoints
# - Measure performance
# - Generate test report
```

### 2. Manual Testing Checklist

#### Database Verification
```sql
-- Check materialized view
SELECT COUNT(*) FROM storefront_variants_mv;

-- Check variant data
SELECT 
    inventory_item_id,
    product_type,
    parent_item_id,
    variant_count
FROM storefront_variants_mv
WHERE product_type = 'parent'
LIMIT 10;
```

#### API Testing
```bash
# Test global scope
curl "http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=global&limit=5"

# Test category scope
curl "http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=category&category[productName]=Electronics&limit=5"

# Verify variant fields in response
# Look for: has_variants, variant_count, price_range, available_attributes
```

#### Frontend Testing
1. Navigate to http://localhost:3000/shops
2. Verify product cards show:
   - ✅ Variant badges (e.g., "3 variants")
   - ✅ Price ranges (e.g., "$10.00 - $25.00")
   - ✅ No console errors
3. Click on a product with variants
4. Verify VariantSelector component works
5. Check variant attributes display correctly

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cache Hit Rate | >70% | ScopeRouter metrics |
| API Response (cached) | <200ms | Performance tests |
| API Response (uncached) | <1s | Performance tests |
| Materialized View Refresh | <5s | Database monitoring |
| Frontend Bundle Impact | <50KB | Build analysis |

### Cache Performance Test

```bash
# Run 1: Cache miss (first request)
curl -w "@curl-format.txt" "http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=global&limit=12"

# Run 2-3: Cache hits (should be 80%+ faster)
curl -w "@curl-format.txt" "http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=global&limit=12"
```

Create `curl-format.txt`:
```
time_total: %{time_total}s
time_namelookup: %{time_namelookup}s
time_connect: %{time_connect}s
time_starttransfer: %{time_starttransfer}s
```

---

## Test Scenarios

### Scenario 1: Products with Variants

**Setup:**
```sql
-- Ensure you have products with variants in database
SELECT 
    p.inventory_item_id,
    p.name,
    COUNT(v.inventory_item_id) as variant_count
FROM inventory_items p
LEFT JOIN inventory_items v ON v.parent_item_id = p.inventory_item_id
WHERE p.product_type = 'parent'
GROUP BY p.inventory_item_id, p.name
HAVING COUNT(v.inventory_item_id) > 0;
```

**Expected Results:**
- Parent products show variant count badge
- Price range displays min-max prices
- Variant selector shows all available variants
- Selecting variant updates price and attributes

### Scenario 2: Products without Variants

**Expected Results:**
- No variant badge displayed
- Single price shown (not range)
- No variant selector
- Standard product display

### Scenario 3: Scope Filtering

**Test Cases:**
```bash
# Global scope - all shops
curl "http://localhost:4000/api/public/shops/discovery?scope=global&limit=10"

# Category scope - specific category
curl "http://localhost:4000/api/public/shops/discovery?scope=category&category[productName]=Electronics&limit=10"

# Location scope - specific location
curl "http://localhost:4000/api/public/shops/discovery?scope=location&location[city]=Seattle&location[state]=WA&limit=10"
```

**Expected Results:**
- All responses include variant fields
- Filtering works correctly
- Cache keys are unique per scope
- Performance is consistent

### Scenario 4: Cache Behavior

**Test:**
1. Clear cache: Restart API server
2. Make request (cache miss - slower)
3. Make same request (cache hit - faster)
4. Wait 6 minutes (TTL expired)
5. Make request again (cache miss)

**Expected Results:**
- Cache hits are 80%+ faster
- Cache expires after 5 minutes
- Metrics show hit/miss rates

---

## Optimization Checklist

### Database Optimizations

- [ ] **Materialized View Refresh Schedule**
  ```sql
  -- Set up automatic refresh (adjust frequency as needed)
  CREATE OR REPLACE FUNCTION refresh_storefront_variants_mv()
  RETURNS void AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_variants_mv;
  END;
  $$ LANGUAGE plpgsql;
  
  -- Schedule with pg_cron or external scheduler
  ```

- [ ] **Add Indexes for Common Queries**
  ```sql
  -- Index on parent_item_id for variant lookups
  CREATE INDEX IF NOT EXISTS idx_variants_parent_item 
  ON storefront_variants_mv(parent_item_id) 
  WHERE product_type = 'variant';
  
  -- Index on tenant_id for tenant-specific queries
  CREATE INDEX IF NOT EXISTS idx_variants_tenant 
  ON storefront_variants_mv(tenant_id);
  ```

- [ ] **Monitor Query Performance**
  ```sql
  -- Enable query logging for slow queries
  ALTER DATABASE your_db SET log_min_duration_statement = 1000;
  ```

### API Optimizations

- [ ] **ScopeRouter Caching** (✅ Implemented)
  - 5-minute TTL
  - 1000 entry max cache size
  - Automatic cleanup

- [ ] **Consider Redis for Distributed Caching**
  ```typescript
  // Future enhancement: Replace in-memory cache with Redis
  // Benefits: Shared cache across API instances, persistence
  ```

- [ ] **Rate Limiting** (Optional)
  ```typescript
  // Add rate limiting for public endpoints
  // Prevents abuse and ensures fair usage
  ```

### Frontend Optimizations

- [ ] **Component Memoization** (✅ Implemented)
  - VariantBadge uses React.memo
  - PriceRangeDisplay optimized

- [ ] **Lazy Loading**
  ```typescript
  // Consider lazy loading VariantSelector for better initial load
  const VariantSelector = lazy(() => import('./VariantSelector'));
  ```

- [ ] **Bundle Size Monitoring**
  ```bash
  # Check bundle impact
  pnpm build
  # Review .next/analyze/ for bundle size
  ```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Cache Performance**
   - Hit rate (target: >70%)
   - Miss rate
   - Eviction rate

2. **API Performance**
   - Response times (p50, p95, p99)
   - Error rates
   - Request volume

3. **Database Performance**
   - Materialized view freshness
   - Query execution times
   - Connection pool usage

4. **Frontend Performance**
   - Page load times
   - Component render times
   - Bundle size

### Recommended Alerts

```yaml
# Example alert configuration (adjust for your monitoring system)

alerts:
  - name: Low Cache Hit Rate
    condition: cache_hit_rate < 0.7
    severity: warning
    
  - name: High API Response Time
    condition: p95_response_time > 1000ms
    severity: warning
    
  - name: Materialized View Stale
    condition: mv_age > 1 hour
    severity: warning
    
  - name: High Error Rate
    condition: error_rate > 0.05
    severity: critical
```

---

## Troubleshooting

### Issue: Variant Fields Not Showing

**Symptoms:** API returns products but variant fields are null/missing

**Solutions:**
1. Check materialized view exists:
   ```sql
   SELECT * FROM pg_matviews WHERE matviewname = 'storefront_variants_mv';
   ```

2. Refresh materialized view:
   ```sql
   REFRESH MATERIALIZED VIEW storefront_variants_mv;
   ```

3. Verify variant data exists:
   ```sql
   SELECT COUNT(*) FROM storefront_variants_mv WHERE product_type = 'variant';
   ```

### Issue: Cache Not Working

**Symptoms:** All requests are slow, no cache hits

**Solutions:**
1. Check ScopeRouter initialization:
   ```typescript
   const router = ScopeRouter.getInstance();
   console.log(router.getMetrics()); // Should show cache stats
   ```

2. Verify cache TTL not too short
3. Check for cache key collisions
4. Review server logs for cache errors

### Issue: Frontend Components Not Rendering

**Symptoms:** Variant badges/price ranges not visible

**Solutions:**
1. Check browser console for errors
2. Verify component imports are correct
3. Check product data has variant fields:
   ```javascript
   console.log(product.has_variants, product.variant_count, product.price_range);
   ```

4. Verify Suspense boundaries are in place

### Issue: Slow Performance

**Symptoms:** API responses taking >2 seconds

**Solutions:**
1. Check database query performance:
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM storefront_variants_mv WHERE tenant_id = 'xxx';
   ```

2. Verify indexes exist
3. Check materialized view is populated
4. Review cache hit rates
5. Consider adding more specific indexes

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All Phase 6 tests passing
- [ ] Performance benchmarks met
- [ ] Database indexes created
- [ ] Materialized view refresh scheduled
- [ ] Monitoring alerts configured
- [ ] Documentation reviewed and updated

### Deployment Steps

1. **Database Migration**
   ```bash
   # Ensure materialized view exists
   cd apps/api
   pnpm prisma migrate deploy
   
   # Refresh materialized view
   psql -d your_db -c "REFRESH MATERIALIZED VIEW storefront_variants_mv;"
   ```

2. **API Deployment**
   ```bash
   cd apps/api
   pnpm build
   # Deploy to your hosting platform
   ```

3. **Web Deployment**
   ```bash
   cd apps/web
   pnpm build
   # Deploy to your hosting platform
   ```

4. **Post-Deployment Verification**
   - [ ] Health checks passing
   - [ ] Variant endpoints responding
   - [ ] Cache metrics being collected
   - [ ] No errors in logs
   - [ ] Frontend displaying variants correctly

### Rollback Plan

If issues occur:
1. Revert API deployment
2. Revert Web deployment
3. Database changes are backward compatible (no rollback needed)
4. Monitor for residual issues

---

## Success Criteria

Phase 6 is complete when:

- ✅ All automated tests pass
- ✅ Manual testing scenarios verified
- ✅ Performance benchmarks met
- ✅ No console errors or warnings
- ✅ Cache hit rate >70%
- ✅ API response times <1s (uncached), <200ms (cached)
- ✅ Frontend components render correctly
- ✅ Documentation complete
- ✅ Monitoring configured
- ✅ Production deployment successful

---

## Next Steps After Phase 6

1. **Monitor Production Performance**
   - Track cache hit rates
   - Monitor API response times
   - Watch for errors

2. **Gather User Feedback**
   - Variant selector usability
   - Price range clarity
   - Overall experience

3. **Iterate and Optimize**
   - Adjust cache TTLs based on usage
   - Add indexes for slow queries
   - Optimize frontend bundle size

4. **Future Enhancements**
   - Variant filtering in search
   - Variant-specific inventory tracking
   - Bulk variant operations
   - Advanced variant analytics

---

## Related Documentation

- **VARIANT_JOIN_IMPLEMENTATION_STATUS.md** - Phase 1-5 implementation details
- **VARIANT_INTEGRATION_GUIDE.md** - Developer integration guide
- **SINGLETON_REFACTORING_SUMMARY.md** - ScopeRouter architecture
- **phase6-test.bat** - Automated testing script
- **scripts/check-variant-mv.sql** - Database verification queries

---

## Support

For issues or questions:
1. Review troubleshooting section above
2. Check related documentation
3. Review server logs for errors
4. Test with sample data first

---

**Phase 6 Status:** Ready for Testing ✅  
**Last Updated:** January 28, 2026
