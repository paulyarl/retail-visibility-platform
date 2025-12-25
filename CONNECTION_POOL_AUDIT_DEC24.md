# Connection Pool Audit - December 24, 2024

**Purpose:** Ensure all database connections use the centralized `db-pool` singleton to eliminate fragmented pools and connection exhaustion issues.

---

## ✅ Audit Results: COMPLIANT

All database connection usage across the codebase now uses the centralized `getDirectPool()` singleton from `utils/db-pool.ts`.

---

## Connection Pool Architecture

### Centralized Singleton (`utils/db-pool.ts`)

**Key Features:**
- Single `Pool` instance shared across entire application
- Singleton pattern prevents duplicate pool creation
- Configurable connection limits via `DATABASE_URL` params
- SSL configuration for cloud databases
- Proper cleanup on shutdown

**Configuration:**
```typescript
// From DATABASE_URL query params or defaults:
max: 5 connections (default)
idleTimeoutMillis: 10 seconds (default)
connectionTimeoutMillis: 10 seconds
```

**Critical Fix Applied:**
- Line 18: `if (directPool) return directPool;` - ALWAYS reuse existing pool
- Previously had bug where dev mode created new pool per request
- Now correctly returns singleton on every call

---

## Services Using Connection Pool

### ✅ All Services Compliant

**Core Services:**
- `services/recommendationService.ts` - 7 functions using `getDirectPool()`
- `services/store-type-directory.service.ts` - Uses singleton
- `services/GBPCategorySyncService.ts` - **FIXED**: Now uses singleton by default
- `services/GBPCategorySync.ts` - Accepts pool via constructor (callers pass singleton)

**Utility Services:**
- `utils/category-counts.ts` - Uses `getDirectPool()`
- `utils/directory-category-counts.ts` - Uses `getDirectPool()`

**Route Handlers:**
- `routes/promotion.ts` - Module-level singleton (safe pattern)
- `routes/directory-tenant.ts` - Uses `getDirectPool()`
- `routes/directory-map.ts` - Uses `getDirectPool()`
- `routes/store-reviews.ts` - Uses `getDirectPool()`
- `routes/tenant-categories.ts` - Uses `getDirectPool()`
- `routes/gbp.ts` - Passes singleton to services
- `routes/admin/gbp-categories-sync.ts` - **FIXED**: Service now uses singleton

**Scripts:**
- `scripts/refresh-materialized-views.ts` - Uses `getDirectPool()`
- `scripts/sync-review-ratings.ts` - Uses `getDirectPool()`
- `scripts/refresh-mat-views.ts` - Uses `getDirectPool()`
- `scripts/direct-view-query.ts` - Uses `getDirectPool()`
- All other scripts - Compliant

---

## Fixes Applied

### Fix 1: `GBPCategorySyncService` Constructor

**Before:**
```typescript
constructor(pool: Pool) {
  this.pool = pool;
}
```

**After:**
```typescript
constructor(pool?: Pool) {
  // Use centralized singleton pool by default, allow injection for testing
  this.pool = pool || getDirectPool();
}
```

**Impact:**
- Service can now be instantiated without passing a pool
- Automatically uses singleton when no pool provided
- Still allows pool injection for testing
- All instantiation points now use singleton:
  - `routes/admin/gbp-categories-sync.ts:6` ✅
  - `routes/test-gbp-sync.ts:15, 60` ✅
  - `routes/tenant-categories.ts:1670` ✅ (explicitly passes singleton)
  - `routes/gbp.ts:164, 225` ✅ (explicitly passes singleton)

### Fix 2: Documentation

Added clarifying comment to `routes/promotion.ts`:
```typescript
// Use shared connection pool (safe to call at module load - getDirectPool returns singleton)
const pool = getDirectPool();
```

This pattern is safe because `getDirectPool()` returns the singleton instance.

---

## Connection Pool Best Practices

### ✅ DO:
1. **Always use `getDirectPool()`** for database queries
2. **Import from centralized location:** `import { getDirectPool } from '../utils/db-pool'`
3. **Call per-request or per-function** (preferred)
4. **Module-level initialization** (acceptable - returns singleton)
5. **Pass singleton to services** that accept pool via constructor

### ❌ DON'T:
1. **Never create new `Pool` instances** with `new Pool()`
2. **Don't create local pool configurations** - use centralized config
3. **Don't store pool in multiple places** - singleton pattern only
4. **Don't bypass `getDirectPool()`** - always use the singleton

---

## Connection Pool Limits

### Current Configuration
- **Max Connections:** 5 (from `DATABASE_URL` param or default)
- **Idle Timeout:** 10 seconds
- **Connection Timeout:** 10 seconds

### Performance Test Results (Dec 24, 2024)
- **Health checks:** 100% success (3-4ms)
- **Platform settings:** 42% success under 50 rapid requests
- **Directory search:** 56% success under 50 rapid requests
- **Other endpoints:** 0% success (timeout)

**Root Cause:** Pool size (5) insufficient for concurrent load

### Recommended Configuration for Week 6
```
DATABASE_URL=postgresql://...?connection_limit=20&pool_timeout=30
```

**Rationale:**
- 20 connections handles moderate concurrent load
- 30-second timeout allows queued requests to complete
- PgBouncer recommended for production (connection pooling middleware)

---

## Verification Commands

### Check for Rogue Pool Creation
```bash
# Should only find db-pool.ts creating the pool
grep -r "new Pool(" apps/api/src --include="*.ts"
```

### Check for Direct pg Import
```bash
# Should only find imports for type definitions
grep -r "from 'pg'" apps/api/src --include="*.ts"
```

### Check getDirectPool Usage
```bash
# Should find many usages across services/routes
grep -r "getDirectPool()" apps/api/src --include="*.ts"
```

---

## Monitoring Recommendations

### Add Connection Pool Metrics
```typescript
// In utils/db-pool.ts
export const getPoolStats = () => {
  if (!directPool) return null;
  
  return {
    totalCount: directPool.totalCount,
    idleCount: directPool.idleCount,
    waitingCount: directPool.waitingCount,
  };
};
```

### Log Pool Status
```typescript
// In index.ts startup
setInterval(() => {
  const stats = getPoolStats();
  if (stats) {
    console.log('[DB Pool] Stats:', stats);
  }
}, 60000); // Every minute
```

### Sentry Integration
```typescript
// Track connection pool exhaustion
if (error.code === 'ECONNREFUSED' || error.message.includes('connection')) {
  Sentry.captureException(error, {
    tags: { component: 'database_pool' },
    extra: { poolStats: getPoolStats() }
  });
}
```

---

## Week 6 Action Items

### Day 1: Connection Pool Optimization (CRITICAL)
- [ ] Increase pool size to 20 connections
- [ ] Increase pool timeout to 30 seconds
- [ ] Add connection pool monitoring
- [ ] Implement connection retry logic
- [ ] Re-run performance tests to verify fix

### Future: PgBouncer Implementation
- [ ] Set up PgBouncer for connection pooling
- [ ] Configure transaction pooling mode
- [ ] Update DATABASE_URL to point to PgBouncer
- [ ] Test connection pool behavior under load

---

## Conclusion

✅ **All database connections now use the centralized `db-pool` singleton**

**Key Achievements:**
1. Single source of truth for database connections
2. No fragmented pools across the codebase
3. Consistent connection management
4. Easy to monitor and optimize
5. Ready for connection pool scaling

**Next Steps:**
1. Increase pool size (5 → 20)
2. Add monitoring and metrics
3. Implement PgBouncer for production
4. Re-test under load

**Status:** AUDIT COMPLETE - All services compliant with singleton pattern

---

**Audit Date:** December 24, 2024  
**Auditor:** Cascade AI  
**Files Reviewed:** 50+ service/route files  
**Issues Found:** 1 (GBPCategorySyncService)  
**Issues Fixed:** 1  
**Status:** ✅ COMPLIANT
