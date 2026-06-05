# Map Feature Usage Guide

The map feature has been centralized into reusable utilities that can be used across the platform.

## Files Created

1. **`/lib/map-utils.ts`** - Server-side utility functions
   - `getTenantMapLocation(tenantId)` - Fetches map data for a tenant
   - `applyPrivacyMode()` - Applies privacy settings to coordinates

2. **`/components/tenant/TenantMapSection.tsx`** - Client component wrapper
   - Renders the map using MapCard
   - Handles null states automatically

## Usage Across Pages

### 1. Tenant Storefront Page (`/tenant/[id]`)
✅ **Already implemented**

```typescript
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation } from '@/lib/map-utils';

// In your data fetching function
const mapLocation = await getTenantMapLocation(tenantId);

// In your component
{mapLocation && (
  <TenantMapSection 
    location={mapLocation} 
    className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
  />
)}
```

### 2. Product Page (`/products/[id]`)
**To implement:**

```typescript
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation } from '@/lib/map-utils';

// In getProduct() function
const mapLocation = await getTenantMapLocation(product.tenantId);

// Return it with other data
return { product, tenant, mapLocation, ... };

// In the page component
{mapLocation && (
  <TenantMapSection 
    location={mapLocation} 
    className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
  />
)}
```

### 3. Tenant Settings Page (`/settings/tenant`)
**Already has MapCardSettings component** - This is for editing, not viewing.
The map preview is already handled by MapCardSettings component.

## Benefits

1. ✅ **No code duplication** - Single source of truth for map data fetching
2. ✅ **Consistent behavior** - Map displays the same way everywhere
3. ✅ **Privacy mode support** - Respects user's privacy settings
4. ✅ **Automatic null handling** - Component doesn't render if map is disabled
5. ✅ **Easy to maintain** - Update one place, affects all pages
6. ✅ **Type-safe** - Full TypeScript support with MapLocation interface

## Map Display Logic

The map will display if:
- ✅ `display_map` is `true` in business profile
- ✅ Coordinates (`latitude` and `longitude`) exist
- ✅ Address fields are complete

The map will NOT display if:
- ❌ Business owner disabled map in settings
- ❌ Coordinates are missing
- ❌ `getTenantMapLocation()` returns `null`

## Privacy Mode

- **Precise**: Shows exact coordinates
- **Neighborhood**: Rounds coordinates to ~100m precision (3 decimal places)

This is handled automatically by the utility functions.
