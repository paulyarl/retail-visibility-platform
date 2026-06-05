# Database Pool Centralization Migration

## Summary
Centralized `getDirectPool()` function to eliminate duplicate code across route files.

## New Utility
**File:** `src/utils/db-pool.ts`
- Exports: `getDirectPool()` and `closeDirectPool()`
- Handles SSL configuration for dev/prod
- Single source of truth for database connection pooling

## Files Already Updated
✅ `src/index.ts` - Main application file
✅ `src/routes/directory-tenant.ts` - Directory tenant routes

## Files That Need Migration

Replace the local `getDirectPool` implementation with:
```typescript
import { getDirectPool } from '../utils/db-pool';
```

And remove the local implementation (lines with `let directPool` and `const getDirectPool = () => {...}`)

### Route Files (7 files)
1. ✅ `src/routes/directory-tenant.ts` - DONE
2. ⏳ `src/routes/directory-mv.ts`
3. ⏳ `src/routes/gbp.ts`
4. ⏳ `src/routes/directory-v2.ts`
5. ⏳ `src/routes/storefront.ts`
6. ⏳ `src/routes/directory-categories.ts`
7. ⏳ `src/routes/admin/platform-categories.ts`

### Service Files (1 file)
8. ⏳ `src/services/store-type-directory.service.ts`

## Migration Pattern

### Before:
```typescript
import { Pool } from 'pg';

let directPool: Pool | null = null;

const getDirectPool = () => {
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';
  // ... 40+ lines of duplicate code ...
  return directPool;
};
```

### After:
```typescript
import { getDirectPool } from '../utils/db-pool';
```

## Benefits
- **Code Reduction:** ~50 lines removed per file × 9 files = ~450 lines eliminated
- **Maintainability:** Single place to update SSL/connection logic
- **Consistency:** Same behavior across all files
- **Testing:** Easier to mock for unit tests

## Testing Checklist
After migration, verify:
- [ ] Directory listings load correctly
- [ ] Materialized views refresh
- [ ] GBP category updates work
- [ ] Storefront queries work
- [ ] Platform category admin works
- [ ] No SSL connection errors in logs

## Rollback Plan
If issues arise, the old implementation is preserved in git history.
Each file can be reverted independently.
