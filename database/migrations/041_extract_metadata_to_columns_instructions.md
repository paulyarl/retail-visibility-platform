# Migration 041: Extract Metadata to Columns

## Overview
This migration extracts frequently accessed metadata fields into dedicated database columns to improve performance, type safety, and prevent errors like the recent `seo_keywords` column issue.

## Files Created
- `041_extract_metadata_to_columns.sql` - Main migration script
- `041_extract_metadata_to_columns_rollback.sql` - Rollback script
- `041_extract_metadata_to_columns_test.sql` - Verification script
- `041_extract_metadata_to_columns_instructions.md` - This file

## What Gets Migrated

### SEO & Content Fields
- `seo_title` - TEXT
- `seo_description` - TEXT  
- `seo_keywords` - TEXT[]
- `enhanced_description` - TEXT
- `tags` - TEXT[]

### Media Fields
- `video_url` - TEXT
- `video_thumbnail` - TEXT

### Product Details
- `features` - TEXT[]
- `specifications` - JSONB

### E-commerce Configuration
- `allow_backorder` - BOOLEAN
- `track_inventory` - BOOLEAN
- `low_stock_threshold` - INTEGER

### Payment Configuration
- `payment_gateway_id` - TEXT
- `payment_gateway_type` - TEXT

## Execution Steps

### 1. Backup Database
```bash
pg_dump -h localhost -U username -d database_name > backup_before_041.sql
```

### 2. Run Migration
```bash
psql -h localhost -U username -d database_name -f 041_extract_metadata_to_columns.sql
```

### 3. Verify Migration
```bash
psql -h localhost -U username -d database_name -f 041_extract_metadata_to_columns_test.sql
```

### 4. Update Prisma Schema
After successful migration, update the Prisma schema:

```prisma
model inventory_items {
  // ... existing fields
  
  // SEO and content
  seo_title            String?
  seo_description      String?
  seo_keywords         String[]
  enhanced_description String?
  tags                 String[]
  
  // Media
  video_url            String?
  video_thumbnail      String?
  
  // Product details
  features             String[]
  specifications        Json?
  
  // E-commerce configuration
  allow_backorder      Boolean @default(false)
  track_inventory      Boolean @default(true)
  low_stock_threshold  Int     @default(5)
  
  // Payment configuration
  payment_gateway_id   String?
  payment_gateway_type String?
  
  // ... rest of fields
}
```

### 5. Regenerate Prisma Client
```bash
cd apps/api
npx prisma generate
```

### 6. Update Application Code

#### DiscoveryService.ts
Replace all `metadata->>'seo_keywords'` with direct column access:
```sql
-- Before
metadata->>'seo_keywords' as seo_keywords

-- After  
seo_keywords
```

#### Other Services
Update any code accessing migrated metadata fields to use direct column access instead of JSON extraction.

## Benefits

### Performance Improvements
- **Direct column access** vs JSON parsing
- **Proper indexing** on frequently searched fields
- **Reduced query complexity**

### Type Safety
- **Strong typing** vs JSON string manipulation
- **Validation** at database level
- **Prevents runtime errors**

### Maintainability
- **Clear schema** vs hidden JSON structure
- **Better documentation** through column comments
- **Easier debugging**

## Rollback Plan

If issues arise, use the rollback script:
```bash
psql -h localhost -U username -d database_name -f 041_extract_metadata_to_columns_rollback.sql
```

## Production Deployment

### Staging Testing
1. Run full migration on staging
2. Execute test suite
3. Verify performance improvements
4. Test rollback procedure

### Production Deployment
1. Schedule maintenance window
2. Create database backup
3. Run migration during low traffic
4. Monitor application performance
5. Have rollback script ready

### Post-Migration Monitoring
- Monitor query performance
- Check for any application errors
- Verify indexing is working
- Monitor memory usage

## Code Updates Required

### Files to Update
1. `apps/api/src/services/DiscoveryService.ts` - Remove JSON extraction
2. `apps/api/src/routes/public-api.ts` - Update queries
3. `apps/api/src/services/SingleProductService.ts` - Update field access
4. `apps/web/src/services/*` - Update frontend data handling
5. Any other service accessing metadata fields

### Example Code Changes

#### Before (Error-prone)
```typescript
// SQL
metadata->>'seo_keywords' as seo_keywords

// TypeScript
const keywords = product.metadata?.seo_keywords;
```

#### After (Type-safe)
```typescript
// SQL
seo_keywords

// TypeScript  
const keywords = product.seo_keywords;
```

## Validation Checklist

- [ ] Migration runs without errors
- [ ] All data migrated correctly
- [ ] Metadata cleanup works
- [ ] Indexes are created and used
- [ ] Application code updated
- [ ] Prisma schema updated
- [ ] Tests pass
- [ ] Performance improves
- [ ] Rollback script tested

## Troubleshooting

### Common Issues

**Data Type Mismatches**
```sql
-- Check for invalid data types
SELECT COUNT(*) FROM inventory_items 
WHERE jsonb_typeof(seo_keywords) != 'array' AND seo_keywords IS NOT NULL;
```

**Missing Indexes**
```sql
-- Verify indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'inventory_items' AND indexname LIKE 'idx_inventory_items_%';
```

**Performance Issues**
```sql
-- Check index usage
EXPLAIN ANALYZE SELECT * FROM inventory_items WHERE 'keyword' = ANY (tags);
```

### Support
If issues arise during migration:
1. Stop the migration
2. Check error logs
3. Use rollback script if needed
4. Contact database administrator

## Future Considerations

### Additional Fields to Consider
- `sale_price_cents` - Pricing information
- `variant_config` - Complex variant data
- `inventory_settings` - Advanced inventory rules

### Ongoing Maintenance
- Monitor metadata usage patterns
- Consider additional field extractions
- Keep metadata for truly flexible data
- Regular performance reviews
