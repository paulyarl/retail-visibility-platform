# Featured Types Migration Guide

## Overview
This migration expands the featured products system from 5 to 10 types, providing more flexibility for future platform growth while maintaining backward compatibility.

## Current State (Before Migration)
```sql
-- 5 total types
['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick']
```

## Future State (After Migration)
```sql
-- 10 total types
['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 
 'bestseller', 'clearance', 'trending', 'featured', 'recommended']
```

## New Types Added

### 1. `bestseller`
- **Purpose**: Top-selling products
- **Color**: amber
- **Max Products**: 8
- **Use Case**: Highlight best-performing products

### 2. `clearance`
- **Purpose**: Discounted clearance items
- **Color**: yellow
- **Max Products**: 5
- **Use Case**: End-of-season or liquidation items

### 3. `trending`
- **Purpose**: Currently trending products
- **Color**: pink
- **Max Products**: 7
- **Use Case**: Products with increasing popularity

### 4. `featured`
- **Purpose**: General featured products
- **Color**: indigo
- **Max Products**: 10
- **Use Case**: General purpose featuring

### 5. `recommended`
- **Purpose**: AI/customer recommended products
- **Color**: teal
- **Max Products**: 6
- **Use Case**: Personalized recommendations

## Migration Steps

### 1. Apply Database Migration
```bash
# Apply the migration
psql -d your_database -f apps/api/src/migrations/add_new_featured_types.sql
```

### 2. Update Frontend (Optional)
After the database migration is successful, uncomment the new types in the singleton:

```typescript
// In TenantFeaturedProductsSingleton.ts
// Uncomment this section after migration is applied
/*
{
  id: 'bestseller',
  name: 'Bestsellers',
  // ... other properties
},
// ... other new types
*/
```

### 3. Update UI Components
Update any UI components that need to handle the new types:
- Type selection buttons
- Badge styling (already configured)
- Filtering logic

### 4. Test Thoroughly
- Test adding products with new types
- Verify all existing functionality still works
- Check frontend-backend compatibility

## Rollback Plan

If issues arise, use the rollback migration:
```bash
# Rollback the migration
psql -d your_database -f apps/api/src/migrations/rollback_new_featured_types.sql
```

## Impact Analysis

### Database Impact
- ✅ No data loss (constraint only)
- ✅ Existing records remain valid
- ✅ No table structure changes
- ✅ Indexes remain effective

### Application Impact
- ✅ Backward compatible
- ✅ New types are opt-in
- ✅ Existing code continues to work
- ✅ No breaking changes

### Performance Impact
- ✅ Minimal (constraint check only)
- ✅ No query performance degradation
- ✅ Indexes unchanged

## Future Expansion

This migration pattern can be repeated for additional types:
1. Update database constraint
2. Add type definitions to singleton
3. Update UI components
4. Test thoroughly

## Migration Checklist

- [ ] Backup database before migration
- [ ] Apply database migration
- [ ] Verify constraint updated correctly
- [ ] Test existing functionality
- [ ] Uncomment frontend types (when ready)
- [ ] Update UI components
- [ ] End-to-end testing
- [ ] Document changes for team
- [ ] Monitor production after deployment

## Support

For questions or issues with this migration:
1. Check the constraint verification query output
2. Review application logs for type validation errors
3. Test with a staging environment first
4. Contact the database team if needed
