# Bug Fix: Tenant Creation Failure - ProductCondition Enum

## Issue
Tenant creation was failing in production with the error:
```
Invalid `prisma.tenant.create()` invocation:
The column `new` does not exist in the current database.
```

## Root Cause
The `ProductCondition` enum had a value `new` which is a **reserved keyword in PostgreSQL**. While the enum type was created successfully, PostgreSQL had issues using `new` as a default value in the `InventoryItem.condition` column.

### Problematic Code
```prisma
enum ProductCondition {
  new           // ❌ Reserved keyword!
  refurbished
  used
  
  @@map("product_condition")
}

model InventoryItem {
  // ...
  condition  ProductCondition?  @default(new)  // ❌ Fails!
}
```

## Solution
Renamed the enum value from `new` to `brand_new`:

### Fixed Code
```prisma
enum ProductCondition {
  brand_new     // ✅ Not a reserved keyword
  refurbished
  used
  
  @@map("product_condition")
}

model InventoryItem {
  // ...
  condition  ProductCondition?  @default(brand_new)  // ✅ Works!
}
```

## Files Changed
1. **apps/api/prisma/schema.prisma**
   - Updated `ProductCondition` enum
   - Updated `InventoryItem.condition` default value

2. **apps/api/prisma/migrations/20251110_fix_product_condition_reserved_keyword/migration.sql**
   - Adds `brand_new` enum value
   - Updates existing records from `new` to `brand_new`
   - Recreates enum type without `new` value

## Migration SQL
The migration performs these steps:
1. Add new `brand_new` enum value
2. Update all existing `InventoryItem` records
3. Create new enum type without `new`
4. Swap column to use new enum type
5. Drop old enum type
6. Rename new enum type to original name

## Deployment
- ✅ Committed to staging branch
- ✅ Pushed to GitHub
- ⏳ Vercel will auto-deploy and run migration
- ⏳ Test tenant creation after deployment

## Testing
After Vercel deployment completes:
1. Go to https://retail-visibility-platform-web-git-staging-paul-yarls-projects.vercel.app/tenants
2. Try creating a new tenant
3. Verify no errors occur
4. Check that tenant is created successfully

## Prevention
- Avoid using PostgreSQL reserved keywords as enum values
- Common reserved keywords to avoid: `new`, `old`, `user`, `table`, `select`, `insert`, `update`, `delete`, etc.
- Reference: https://www.postgresql.org/docs/current/sql-keywords-appendix.html

## Status
- **Fixed:** 2024-11-10
- **Deployed:** Pending Vercel deployment
- **Verified:** Pending testing after deployment
