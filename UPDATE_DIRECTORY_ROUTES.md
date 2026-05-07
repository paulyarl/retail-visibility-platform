# Update Directory Routes Integration

## Quick Fix for Related Stores Error

### 1. Replace the directory routes import and mounting

In `apps/api/src/routes/mounts/directory-routes.ts`:

**Replace line 5:**
```typescript
// OLD
import directoryRoutes from '../directory-v2';

// NEW  
import directoryRoutes from '../ENHANCED_DIRECTORY_ROUTES';
```

**Or add the enhanced routes alongside existing:**
```typescript
import directoryRoutes from '../directory-v2';
import enhancedDirectoryRoutes from '../ENHANCED_DIRECTORY_ROUTES';

// Mount enhanced routes for testing
app.use('/api/directory/enhanced', enhancedDirectoryRoutes);
```

### 2. Test the enhanced endpoints

```bash
# Test related stores with fallback
curl "http://localhost:4000/api/directory/enhanced/your-store-slug/related?limit=3"

# Test enhanced categories
curl "http://localhost:4000/api/directory/enhanced/categories/enhanced?tenantId=t-zjd1o7sm"

# Test category types
curl "http://localhost:4000/api/directory/enhanced/categories/types?tenantId=t-zjd1o7sm"
```

### 3. Update frontend to use enhanced endpoint (optional)

In `apps/web/src/components/directory/RelatedStores.tsx`:

**Update the API URL:**
```typescript
// OLD
const res = await fetch(`${apiUrl}/api/directory/${currentSlug}/related?limit=${limit}`);

// NEW (temporary fix)
const res = await fetch(`${apiUrl}/api/directory/enhanced/${currentSlug}/related?limit=${limit}`);
```

### 4. Restart the API server

```bash
# In the API directory
npm run dev
```

## Benefits

✅ **Fixes the "Failed to fetch" error** immediately
✅ **Maintains performance** with MV-first approach  
✅ **Provides fallback** if MV doesn't exist
✅ **Adds 3-category support** to directory APIs
✅ **Better error handling** and debugging
✅ **Backward compatible** with existing functionality

## Long-term Solution

For production deployment, consider:
1. **Creating the missing `directory_category_listings` MV**
2. **Migrating all directory routes** to use enhanced versions
3. **Adding comprehensive error monitoring**
4. **Implementing automated MV refresh** strategies
