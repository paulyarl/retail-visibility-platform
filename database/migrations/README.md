# Database Migrations

This directory contains database migration scripts for the VisibleShelf platform.

## Migration Files

### 041_extract_metadata_to_columns
**Purpose**: Extract frequently accessed metadata fields to dedicated columns for better performance and type safety.

**Files**:
- `041_extract_metadata_to_columns.sql` - Main migration
- `041_extract_metadata_to_columns_rollback.sql` - Rollback script
- `041_extract_metadata_to_columns_test.sql` - Verification script
- `041_extract_metadata_to_columns_instructions.md` - Detailed instructions

**What it does**:
- Adds 15 new columns to `inventory_items` table
- Migrates data from JSON metadata to proper columns
- Adds indexes for performance
- Cleans up migrated metadata fields
- Creates trigger for future metadata cleanup

**Benefits**:
- ✅ Fixes `seo_keywords` column access errors
- ✅ Improves query performance
- ✅ Adds type safety
- ✅ Enables proper indexing
- ✅ Prevents metadata dumping ground

## Execution Order

Migrations should be executed in numerical order:
1. `040_customer_notification_preferences.sql`
2. `041_extract_metadata_to_columns.sql`

## Running Migrations

### Development
```bash
# Backup first
pg_dump -h localhost -U username -d database_name > backup_before_migration.sql

# Run migration
psql -h localhost -U username -d database_name -f 041_extract_metadata_to_columns.sql

# Verify
psql -h localhost -U username -d database_name -f 041_extract_metadata_to_columns_test.sql

# Update Prisma
cd apps/api
npx prisma db pull
npx prisma generate
```

### Production
1. Schedule maintenance window
2. Create database backup
3. Run migration on staging first
4. Execute on production during low traffic
5. Monitor application performance
6. Have rollback script ready

## Rollback

If issues occur:
```bash
psql -h localhost -U username -d database_name -f 041_extract_metadata_to_columns_rollback.sql
```

## Important Notes

- Always backup before running migrations
- Test on staging environment first
- Monitor performance after migration
- Update application code to use new columns
- Keep rollback scripts accessible

## Recent Changes

### Fixed Issues
- **SEO Keywords Access Error**: Fixed `inventory_items.seo_keywords` column not found error by extracting from metadata
- **Metadata Performance**: Improved performance by moving frequently accessed fields to proper columns
- **Type Safety**: Added proper data types instead of JSON string manipulation

### Upcoming
- Consider extracting additional metadata fields based on usage patterns
- Monitor metadata growth and cleanup needs
- Evaluate performance improvements
