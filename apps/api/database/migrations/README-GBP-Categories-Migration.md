# GBP Categories Migration Guide

## Overview

This migration elevates GBP (Google Business Profile) categories from the `metadata` JSONB column to dedicated columns in the `tenants` table for better data integrity, performance, and maintainability.

## Migration Files

1. **`elevate_gbp_categories.sql`** - Main migration script
2. **`cleanup_gbp_categories_metadata.sql`** - Cleanup script (run after verification)
3. **`verify-gbp-categories-migration.ts`** - Verification script
4. **`update-gbp-services.ts`** - Service update script

## New Columns Added

```sql
gbp_primary_category_id        VARCHAR(255)    -- Primary category ID
gbp_primary_category_name      VARCHAR(255)    -- Primary category name
gbp_secondary_categories       JSONB           -- Secondary categories array
gbp_categories_sync_status     VARCHAR(50)     -- Sync status
gbp_categories_last_synced_at TIMESTAMPTZ     -- Last sync timestamp
```

## Migration Steps

### 1. Run the Main Migration

```bash
psql -d your_database -f database/migrations/elevate_gbp_categories.sql
```

This will:
- Add the new columns
- Create indexes
- Migrate existing data from metadata
- Add comments
- Show verification results

### 2. Update Prisma Schema

The schema has been updated with the new columns. Run:

```bash
npx prisma generate
```

### 3. Update Application Code

Run the service update script to update references from metadata to direct columns:

```bash
npx ts-node src/scripts/update-gbp-services.ts
```

This updates files like:
- `src/services/GBPBusinessInfoSync.ts`
- `src/services/GBPSyncTrackingService.ts`
- `src/routes/google-business-oauth.ts`
- `src/services/TenantService.ts`

### 4. Verify Migration

Run the verification script to ensure data integrity:

```bash
npx ts-node src/scripts/verify-gbp-categories-migration.ts
```

This checks:
- Total tenants with GBP data
- Successful migration counts
- Data integrity issues
- Sample data comparison

### 5. Test Updated Services

Test the updated services to ensure they work with the new columns:

```bash
# Test GBP sync
curl -X POST "http://localhost:4000/api/tenants/{tenantId}/google-business/sync"

# Test tenant profile
curl "http://localhost:4000/api/public/tenant/{tenantId}/profile"
```

### 6. Cleanup Metadata (Optional)

After verification, run the cleanup script:

```bash
psql -d your_database -f database/migrations/cleanup_gbp_categories_metadata.sql
```

This will:
- Create a backup of metadata
- Remove GBP categories from metadata
- Create a backward compatibility view
- Show final verification

## Data Mapping

### Before (in metadata)

```json
{
  "metadata": {
    "gbp_categories": {
      "primary": {
        "id": "gcid:african-grocery-store",
        "name": "African Grocery Store"
      },
      "secondary": [
        {
          "id": "gcid:african-goods-store",
          "name": "African Goods Store"
        }
      ],
      "sync_status": "synced",
      "last_synced_at": "2026-04-01T16:07:06.893Z"
    }
  }
}
```

### After (in dedicated columns)

```sql
gbp_primary_category_id = 'gcid:african-grocery-store'
gbp_primary_category_name = 'African Grocery Store'
gbp_secondary_categories = '[{"id": "gcid:african-goods-store", "name": "African Goods Store"}]'
gbp_categories_sync_status = 'synced'
gbp_categories_last_synced_at = '2026-04-01 16:07:06.893+00'
```

## Benefits

1. **Better Performance**: Direct column access is faster than JSONB path queries
2. **Data Integrity**: Proper typing and constraints
3. **Indexing**: Can create indexes on specific category fields
4. **Maintainability**: Clearer schema, easier to query
5. **Type Safety**: Better TypeScript support with Prisma

## Rollback Plan

If you need to rollback:

1. Restore from the `tenants_metadata_backup_gbp` table
2. Drop the new columns
3. Update services back to use metadata

```sql
-- Rollback SQL
UPDATE tenants t
SET metadata = t.metadata || gbp.gbp_categories_computed
FROM tenants_with_gbp_categories gbp
WHERE t.id = gbp.id;

ALTER TABLE tenants DROP COLUMN gbp_primary_category_id;
ALTER TABLE tenants DROP COLUMN gbp_primary_category_name;
ALTER TABLE tenants DROP COLUMN gbp_secondary_categories;
ALTER TABLE tenants DROP COLUMN gbp_categories_sync_status;
ALTER TABLE tenants DROP COLUMN gbp_categories_last_synced_at;
```

## Notes

- The migration is designed to be non-destructive
- Original metadata is preserved until cleanup
- A backward compatibility view is provided
- Consider adding the trigger to prevent future GBP data in metadata
- Test thoroughly before running cleanup script
