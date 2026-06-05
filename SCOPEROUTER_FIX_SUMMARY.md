# ScopeRouter UniversalSingleton Migration Fix

**Issue:** `TypeError: Cannot read properties of undefined (reading 'info')`  
**Root Cause:** When refactoring ScopeRouter to extend UniversalSingleton, we removed the manual `this.logger = logger` assignment but the code was still trying to use `this.logger.info()`, `this.logger.warn()`, and `this.logger.error()`.

**Date:** January 28, 2026  
**Status:** ✅ FIXED

---

## Problem Details

### Error Message
```
TypeError: Cannot read properties of undefined (reading 'info')
at ScopeRouter.handleGlobalScope (ScopeRouter.ts:316:17)
```

### Root Cause
When we refactored ScopeRouter to extend UniversalSingleton:

**Before:**
```typescript
private constructor() {
  this.logger = logger;  // Manual logger assignment
  // ...
}
```

**After:**
```typescript
private constructor() {
  super('ScopeRouter', { ... });  // UniversalSingleton handles logging
  // this.logger assignment removed
  // ...
}
```

But the code was still using:
```typescript
this.logger.info('...');
this.logger.warn('...');
this.logger.error('...');
```

Since `this.logger` was undefined, this caused runtime errors.

---

## Solution Applied

### Step 1: Replace All Logger Calls
Replaced all `this.logger` calls with UniversalSingleton logging methods:

| Before | After |
|--------|--------|
| `this.logger.info()` | `this.logInfo()` |
| `this.logger.warn()` | `this.logWarning()` |
| `this.logger.error()` | `this.logError()` |

### Step 2: Fix Error Object Handling
UniversalSingleton's `logError()` expects the error object directly, not wrapped in an object:

**Before:**
```typescript
this.logger.error('[SCOPE ROUTER] Error getting random product category', { 
  error: (error as Error).message 
});
```

**After:**
```typescript
this.logError('[SCOPE ROUTER] Error getting random product category', error);
```

### Step 3: Verify Constructor
Ensured the constructor properly calls `super()` without manual logger assignment:

```typescript
private constructor() {
  super('ScopeRouter', {
    enableCache: true,
    defaultTTL: 300,
    maxCacheSize: 1000,
    enableMetrics: true,
    enableLogging: true
  });
  
  this.shopsService = ShopsFeaturedService.getInstance();
  this.baseService = FeaturedProductsSingletonService.getInstance();
  this.prisma = new PrismaClient();
}
```

---

## Files Modified

**Single File:** `apps/api/src/services/ScopeRouter.ts`

**Changes Made:**
- ✅ Replaced 25+ `this.logger.info()` calls with `this.logInfo()`
- ✅ Replaced 5+ `this.logger.warn()` calls with `this.logWarning()`
- ✅ Replaced 5+ `this.logger.error()` calls with `this.logError()`
- ✅ Fixed error object passing for UniversalSingleton API
- ✅ Verified constructor is correct

---

## Testing

### Before Fix
```bash
[ScopeRouter] ERROR: Error in scope global, falling back to global
TypeError: Cannot read properties of undefined (reading 'info')
```

### After Fix
```bash
[ScopeRouter] Global scope: fetching trending from all tenants
[ScopeRouter] Cache hit for discovery
[ScopeRouter] MV shop category query returned 12 results
```

---

## Benefits of the Fix

1. **Eliminates Runtime Errors:** No more undefined logger errors
2. **Consistent Logging:** Uses UniversalSingleton's structured logging
3. **Better Error Tracking:** UniversalSingleton provides enhanced error logging
4. **Metrics Integration:** All logging is now tracked in metrics
5. **Cache Performance:** ScopeRouter caching works properly

---

## UniversalSingleton Logging API

The fix leverages UniversalSingleton's built-in logging methods:

### `this.logInfo(message, context?)`
- Logs informational messages
- Includes service name prefix automatically
- Tracks in metrics

### `this.logWarning(message, context?)`
- Logs warning messages
- Uses warning level for proper filtering
- Tracks in metrics

### `this.logError(message, error)`
- Logs error messages with full error object
- Includes stack traces and error details
- Tracks in error metrics

---

## Impact

**Immediate:**
- ✅ API endpoints working again
- ✅ No more TypeError exceptions
- ✅ ScopeRouter functioning properly

**Long-term:**
- ✅ Consistent logging across all singleton services
- ✅ Better observability and debugging
- ✅ Metrics integration for performance monitoring

---

## Related Documentation

- `SINGLETON_REFACTORING_SUMMARY.md` - UniversalSingleton architecture
- `PHASE_6_TESTING_GUIDE.md` - Testing procedures
- `VARIANT_JOIN_IMPLEMENTATION_STATUS.md` - Phase 1-5 implementation

---

**Status:** ✅ RESOLVED - ScopeRouter now properly extends UniversalSingleton with working logging
