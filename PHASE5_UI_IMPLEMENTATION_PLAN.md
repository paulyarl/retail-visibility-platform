# Phase 5 UI Implementation Plan
## Scope-Aware Discovery Interface for /shops Page

**Status:** Planning Complete - Ready for Implementation  
**Backend:** ✅ Phase 5A, 5B, 5C Complete  
**Timeline:** 3-4 days

---

## Overview

Enhance the existing `/shops` page to support the new Phase 5 scope-aware API endpoints:
- **Phase 5A:** Product category filtering
- **Phase 5B:** Shop category aggregation
- **Phase 5C:** Location-based filtering (city/state/zip + radius)

The implementation will add flexible filtering UI components that translate user selections into scope-aware API requests while maintaining the existing multi-bucket discovery experience.

---

## Current State Analysis

### Existing Components
- ✅ **Page:** `apps/web/src/app/shops/page.tsx` - Main shops discovery page
- ✅ **Hook:** `useShopsFeaturedBuckets` - Fetches multi-bucket data
- ✅ **Components:** `BucketSection`, `ProductBucket`, `ShopBucket` - Display buckets
- ✅ **UI:** Search, category dropdown, sort options, view mode toggle

### Current Limitations
- ❌ No location filtering (city/state/zip)
- ❌ No product category filtering
- ❌ No shop category filtering
- ❌ No radius-based "near me" search
- ❌ Category dropdown not connected to Phase 5B categories API
- ❌ No scope awareness in bucket fetching

---

## Implementation Phases

### **Phase 1: Scope Filter Component** (Day 1 - 6 hours)

Create a reusable `ScopeFilterBar` component that translates user selections into scope-aware query parameters.

**Component:** `apps/web/src/components/shops/ScopeFilterBar.tsx`

**Features:**
- **Scope Selector:** Global, Category, Location tabs
- **Category Filters:** Product categories + Shop categories (GBP)
- **Location Filters:** City, State, ZIP, Radius
- **URL Builder:** Converts selections to query parameters
- **State Management:** Manages filter state and applies to API calls

**Props Interface:**
```typescript
interface ScopeFilterBarProps {
  onScopeChange: (scope: ScopeParams) => void;
  initialScope?: ScopeParams;
  showLocationRadius?: boolean;
  showCategoryType?: boolean;
}

interface ScopeParams {
  scope: 'global' | 'category' | 'location';
  category?: {
    productName?: string;
    productSlug?: string;
    shopCategoryName?: string;
    shopCategoryId?: string;
    categoryType?: 'product' | 'shop' | 'both';
  };
  location?: {
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
  };
}
```

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Scope Tabs: [Global] [Category] [Location]                 │
├─────────────────────────────────────────────────────────────┤
│ Category Tab:                                                │
│   Filter Type: [Product Category ▼] [Shop Category ▼]      │
│   Select: [Electronics ▼]                                   │
├─────────────────────────────────────────────────────────────┤
│ Location Tab:                                                │
│   City: [________] State: [__] ZIP: [_____]                │
│   Radius: [25 miles ▼] [Use My Location]                   │
└─────────────────────────────────────────────────────────────┘
```

---

### **Phase 2: Scope-Aware Request Service** (Day 1 - 4 hours)

Create a service that builds scope-aware API URLs from filter parameters.

**Service:** `apps/web/src/services/scopeRequestBuilder.ts`

**Features:**
- Builds query strings for scope-aware endpoints
- Handles nested parameters (location[city], category[productName])
- Validates required parameters per scope
- Supports all bucket types (trending, sale, new, etc.)

**Methods:**
```typescript
class ScopeRequestBuilder {
  // Build URL for scope-aware product discovery
  buildProductUrl(bucketType: string, scope: ScopeParams): string;
  
  // Build URL for nearby shops
  buildNearbyShopsUrl(location: LocationParams): string;
  
  // Build URL for category aggregation
  buildCategoriesUrl(params?: { limit?: number; minProducts?: number }): string;
  
  // Validate scope parameters
  validateScope(scope: ScopeParams): { valid: boolean; errors: string[] };
}
```

**Example Usage:**
```typescript
const builder = new ScopeRequestBuilder();

// Category scope
const url1 = builder.buildProductUrl('trending', {
  scope: 'category',
  category: { productName: 'Electronics' }
});
// Result: /api/public/shops/category/trending?category[productName]=Electronics

// Location scope
const url2 = builder.buildProductUrl('sale', {
  scope: 'location',
  location: { city: 'Pittsburgh', state: 'PA' }
});
// Result: /api/public/shops/location/sale?location[city]=Pittsburgh&location[state]=PA
```

---

### **Phase 3: Update useShopsFeaturedBuckets Hook** (Day 2 - 4 hours)

Enhance the existing hook to support scope-aware requests.

**Hook:** `apps/web/src/hooks/shops/useShopsFeaturedBuckets.ts`

**Changes:**
```typescript
interface UseShopsFeaturedBucketsOptions {
  tenantId?: string;
  shopScope?: 'shop' | 'global';
  enabled?: boolean;
  // NEW: Scope parameters
  scope?: ScopeParams;
  // NEW: Bucket types to fetch (default: all)
  bucketTypes?: BucketType[];
}

// Add scope awareness to API calls
const buildBucketUrl = (bucketType: string, scope?: ScopeParams) => {
  if (!scope || scope.scope === 'global') {
    return `/api/public/shops/global/${bucketType}`;
  }
  
  const builder = new ScopeRequestBuilder();
  return builder.buildProductUrl(bucketType, scope);
};
```

**Backward Compatibility:**
- Default behavior unchanged (global scope)
- Existing pages continue to work
- Scope parameters are optional

**Dual-Mode Operation:**

The hook supports both **user-driven** and **context-driven** scope application:

1. **User-Driven (Explicit):** User interacts with `ScopeFilterBar` to change scope
2. **Context-Driven (Implicit):** Page/component automatically applies scope based on context

**Context-Driven Examples:**
```typescript
// Shop page - automatic shop scope
const { buckets } = useShopsFeaturedBuckets({
  tenantId: shopId,
  shopScope: 'shop' // Implicit from page context
});

// Category landing page - automatic category scope from URL
const { buckets } = useShopsFeaturedBuckets({
  scope: {
    scope: 'category',
    category: { productSlug: params.categorySlug }
  } // Implicit from URL params
});

// Near me page - automatic location scope from geolocation
const { location } = useGeolocation();
const { buckets } = useShopsFeaturedBuckets({
  scope: {
    scope: 'location',
    location: { latitude: location.lat, longitude: location.lng }
  } // Implicit from browser geolocation
});
```

---

## Scope Priority and Resolution

When both automated (context-driven) and user-driven scopes are present, the system follows this priority:

### Priority Order (Highest to Lowest)

1. **User-Selected Scope** (via ScopeFilterBar) - Always takes precedence
2. **URL Parameters** - Applied on page load, can be overridden by user
3. **Page Context** - Automatic scope based on page type (shop, category, location)
4. **Default Scope** - Global scope (fallback)

### Resolution Logic

```typescript
const resolveScopeParams = (
  userScope?: ScopeParams,      // From ScopeFilterBar
  urlScope?: ScopeParams,       // From URL params
  contextScope?: ScopeParams    // From page context
): ScopeParams => {
  // User selection always wins
  if (userScope) return userScope;
  
  // URL params second (for shareable links)
  if (urlScope) return urlScope;
  
  // Page context third (automatic scoping)
  if (contextScope) return contextScope;
  
  // Default to global
  return { scope: 'global' };
};
```

### Use Cases

**Use Case 1: Category Landing Page with User Override**
```typescript
// Page: /shops/categories/electronics
const contextScope = { scope: 'category', category: { productSlug: 'electronics' } };
const [userScope, setUserScope] = useState<ScopeParams>();

// Initially shows Electronics (context)
// User clicks Location tab → enters "Pittsburgh"
// Now shows Electronics in Pittsburgh (user override)

const effectiveScope = resolveScopeParams(userScope, undefined, contextScope);
```

**Use Case 2: Shared Link with Filters**
```typescript
// URL: /shops?scope=location&location[city]=Pittsburgh&location[state]=PA
const urlScope = parseScopeFromUrl(searchParams);

// Page loads with Pittsburgh filter applied
// User can still change to different location or category
```

**Use Case 3: Near Me Page**
```typescript
// Page: /shops/near-me
const { location } = useGeolocation();
const contextScope = {
  scope: 'location',
  location: { latitude: location.lat, longitude: location.lng, radius: 25 }
};

// Automatically shows products within 25 miles
// User can adjust radius or switch to different location
```

---

### **Phase 4: Integrate ScopeFilterBar into /shops Page** (Day 2 - 6 hours)

Add the scope filter UI to the existing shops page.

**Changes to:** `apps/web/src/app/shops/page.tsx`

**Integration Points:**
1. **Add ScopeFilterBar above search bar**
2. **Connect to useShopsFeaturedBuckets hook**
3. **Update URL with scope parameters**
4. **Show active filters as chips**
5. **Add "Clear Filters" button**

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Discover Shops                                          │
├─────────────────────────────────────────────────────────┤
│ [Scope Filter Bar Component]                            │
├─────────────────────────────────────────────────────────┤
│ Active Filters: [Electronics ×] [Pittsburgh, PA ×]     │
├─────────────────────────────────────────────────────────┤
│ [Search Bar] [Sort] [View Mode]                        │
├─────────────────────────────────────────────────────────┤
│ 🔥 Trending Products (in Electronics, Pittsburgh)      │
│ [Product Cards...]                                      │
└─────────────────────────────────────────────────────────┘
```

**State Management:**
```typescript
const [scopeParams, setScopeParams] = useState<ScopeParams>({
  scope: 'global'
});

const { buckets, loading, error } = useShopsFeaturedBuckets({
  tenantId: 'global',
  shopScope: 'global',
  scope: scopeParams,
  enabled: true
});

const handleScopeChange = (newScope: ScopeParams) => {
  setScopeParams(newScope);
  // Update URL with new scope parameters
  updateUrlParams(newScope);
};
```

---

### **Phase 5: Category Discovery Integration** (Day 3 - 4 hours)

Connect the category dropdown to the Phase 5B categories API.

**New Component:** `apps/web/src/components/shops/CategorySelector.tsx`

**Features:**
- Fetch categories from `/api/public/shops/categories`
- Show product count per category
- Support both product and shop categories
- Trending categories section
- Search/filter categories

**API Integration:**
```typescript
const fetchCategories = async () => {
  const res = await fetch('/api/public/shops/categories?limit=50&minProducts=3');
  const data = await res.json();
  
  // Group by category type
  const productCategories = data.data.filter(c => c.category_type === 'product');
  const shopCategories = data.data.filter(c => c.category_type === 'shop');
  
  return { productCategories, shopCategories };
};
```

**UI:**
```
┌─────────────────────────────────────────┐
│ Browse by Category                      │
├─────────────────────────────────────────┤
│ Product Categories:                     │
│   • Electronics (45 products)           │
│   • Home & Kitchen (32 products)        │
│   • Office Supplies (28 products)       │
├─────────────────────────────────────────┤
│ Shop Categories:                        │
│   • Grocery Store (2 shops)             │
│   • African Goods Store (1 shop)        │
└─────────────────────────────────────────┘
```

---

### **Phase 6: Location Search Enhancement** (Day 3 - 6 hours)

Add location-based filtering with "Near Me" functionality.

**New Component:** `apps/web/src/components/shops/LocationSearch.tsx`

**Features:**
- City/State/ZIP input fields
- Radius slider (5, 10, 25, 50, 100 miles)
- "Use My Location" button (browser geolocation)
- Nearby shops count indicator
- Map preview (optional - future enhancement)

**Geolocation Integration:**
```typescript
const useGeolocation = () => {
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => setError(error.message)
    );
  };
  
  return { location, error, getCurrentLocation };
};
```

**Nearby Shops API:**
```typescript
const fetchNearbyShops = async (location: LocationParams) => {
  const url = `/api/public/shops/nearby?latitude=${location.latitude}&longitude=${location.longitude}&radius=${location.radius || 25}`;
  const res = await fetch(url);
  return res.json();
};
```

---

### **Phase 7: URL State Management** (Day 4 - 4 hours)

Sync filter state with URL parameters for shareable links.

**Features:**
- Parse URL params on page load
- Update URL when filters change
- Support browser back/forward
- Generate shareable links

**Implementation:**
```typescript
import { useSearchParams, useRouter } from 'next/navigation';

const useScopeUrlState = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Parse URL params to ScopeParams
  const parseScopeFromUrl = (): ScopeParams => {
    const scope = searchParams.get('scope') || 'global';
    
    if (scope === 'category') {
      return {
        scope: 'category',
        category: {
          productName: searchParams.get('category[productName]') || undefined,
          shopCategoryName: searchParams.get('category[shopCategoryName]') || undefined,
        }
      };
    }
    
    if (scope === 'location') {
      return {
        scope: 'location',
        location: {
          city: searchParams.get('location[city]') || undefined,
          state: searchParams.get('location[state]') || undefined,
          zip: searchParams.get('location[zip]') || undefined,
          radius: parseInt(searchParams.get('location[radius]') || '25'),
        }
      };
    }
    
    return { scope: 'global' };
  };
  
  // Update URL with new scope params
  const updateUrl = (scope: ScopeParams) => {
    const params = new URLSearchParams();
    params.set('scope', scope.scope);
    
    if (scope.category) {
      Object.entries(scope.category).forEach(([key, value]) => {
        if (value) params.set(`category[${key}]`, value);
      });
    }
    
    if (scope.location) {
      Object.entries(scope.location).forEach(([key, value]) => {
        if (value !== undefined) params.set(`location[${key}]`, String(value));
      });
    }
    
    router.push(`/shops?${params.toString()}`);
  };
  
  return { parseScopeFromUrl, updateUrl };
};
```

---

### **Phase 8: Testing & Polish** (Day 4 - 4 hours)

**Testing Checklist:**
- ✅ Global scope (default behavior)
- ✅ Product category filtering
- ✅ Shop category filtering
- ✅ City/State/ZIP filtering
- ✅ Radius search with coordinates
- ✅ "Near Me" geolocation
- ✅ URL state persistence
- ✅ Browser back/forward navigation
- ✅ Mobile responsive design
- ✅ Loading states
- ✅ Error handling
- ✅ Empty states

**Polish Items:**
- Smooth transitions between scopes
- Loading skeletons for filtered results
- Clear visual feedback for active filters
- Helpful empty states with suggestions
- Performance optimization (debouncing, caching)

---

## Component Architecture

```
/shops page
├── ScopeFilterBar
│   ├── ScopeTabSelector (Global/Category/Location)
│   ├── CategorySelector
│   │   ├── ProductCategoryDropdown
│   │   └── ShopCategoryDropdown
│   └── LocationSearch
│       ├── AddressInputs (City/State/ZIP)
│       ├── RadiusSlider
│       └── GeolocationButton
├── ActiveFiltersChips
├── SearchBar (existing)
├── SortAndViewControls (existing)
└── BucketSections (existing)
    ├── ProductBucket (scope-aware)
    └── ShopBucket (scope-aware)
```

---

## API Endpoints Used

### Phase 5A: Category Scope
```
GET /api/public/shops/category/:bucketType
  ?category[productName]=Electronics
  ?category[shopCategoryName]=Grocery Store
```

### Phase 5B: Category Aggregation
```
GET /api/public/shops/categories
  ?limit=50
  ?minProducts=3
```

### Phase 5C: Location Scope
```
GET /api/public/shops/location/:bucketType
  ?location[city]=Pittsburgh
  ?location[state]=PA
  ?location[zip]=64134
  ?location[latitude]=40.37
  ?location[longitude]=-79.99
  ?location[radius]=25
```

### Nearby Shops
```
GET /api/public/shops/nearby
  ?latitude=40.37
  ?longitude=-79.99
  ?radius=25
  ?minProducts=3
```

---

## File Structure

```
apps/web/src/
├── components/shops/
│   ├── ScopeFilterBar.tsx          # NEW - Main filter component
│   ├── CategorySelector.tsx        # NEW - Category selection
│   ├── LocationSearch.tsx          # NEW - Location filtering
│   ├── ActiveFiltersChips.tsx      # NEW - Show active filters
│   ├── BucketSection.tsx           # EXISTING - Update for scope
│   └── ProductBucket.tsx           # EXISTING - Update for scope
├── hooks/shops/
│   ├── useShopsFeaturedBuckets.ts  # UPDATE - Add scope support
│   ├── useScopeUrlState.ts         # NEW - URL state management
│   └── useGeolocation.ts           # NEW - Browser geolocation
├── services/
│   └── scopeRequestBuilder.ts      # NEW - Build scope-aware URLs
├── types/
│   └── scope.ts                    # NEW - TypeScript interfaces
└── app/shops/
    └── page.tsx                    # UPDATE - Integrate components
```

---

## TypeScript Interfaces

```typescript
// types/scope.ts

export type ScopeType = 'global' | 'category' | 'location';
export type BucketType = 'trending' | 'new' | 'sale' | 'seasonal' | 'staff' | 'selection' | 'random';
export type CategoryType = 'product' | 'shop' | 'both';

export interface ScopeParams {
  scope: ScopeType;
  category?: CategoryParams;
  location?: LocationParams;
}

export interface CategoryParams {
  productName?: string;
  productSlug?: string;
  productId?: string;
  googleProductId?: string;
  shopCategoryName?: string;
  shopCategoryId?: string;
  shopGoogleCategoryId?: string;
  categoryType?: CategoryType;
}

export interface LocationParams {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface CategoryAggregation {
  category_name: string;
  category_slug: string;
  category_type: 'product' | 'shop';
  product_count: number;
  shop_count: number;
  avg_trending_score: number;
  products_in_stock: number;
}

export interface NearbyShop {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string | null;
  shop_category: string;
  tenant_city: string;
  tenant_state: string;
  tenant_zip: string;
  tenant_address: string;
  tenant_latitude: number;
  tenant_longitude: number;
  product_count: number;
  products_with_images: number;
  products_in_stock: number;
  avg_trending_score: number;
  distance_miles: number;
}
```

---

## User Experience Flow

### Browse by Category
1. User clicks "Category" tab in ScopeFilterBar
2. Selects "Product Category" or "Shop Category"
3. Chooses category from dropdown (e.g., "Electronics")
4. Page updates to show only products in that category
5. All buckets (trending, new, sale) filtered by category
6. URL updates: `/shops?scope=category&category[productName]=Electronics`

### Browse by Location
1. User clicks "Location" tab in ScopeFilterBar
2. Enters city/state or ZIP code
3. Adjusts radius slider (default 25 miles)
4. OR clicks "Use My Location" for geolocation
5. Page updates to show products from nearby shops
6. Nearby shops widget appears showing shop count
7. URL updates: `/shops?scope=location&location[city]=Pittsburgh&location[state]=PA&location[radius]=25`

### Share Filtered View
1. User applies filters (e.g., Electronics in Pittsburgh)
2. Copies URL from browser
3. Shares link with friend
4. Friend opens link and sees same filtered view
5. Filters automatically applied from URL parameters

---

## Performance Considerations

- **Debouncing:** Location input changes debounced (500ms)
- **Caching:** Category list cached for 1 hour
- **Lazy Loading:** Buckets load on scroll (below fold)
- **Optimistic UI:** Show loading state immediately on filter change
- **Error Recovery:** Graceful fallback to global scope on API errors

---

## Mobile Responsive Design

- **Scope Tabs:** Horizontal scroll on mobile
- **Filter Inputs:** Stack vertically on small screens
- **Active Filters:** Horizontal scroll chips
- **Radius Slider:** Touch-friendly on mobile
- **Geolocation:** Prominent "Near Me" button on mobile

---

## Future Enhancements (Post-MVP)

- **Map View:** Show shops on interactive map
- **Save Filters:** Save favorite filter combinations
- **Notifications:** Alert when new products match filters
- **Advanced Filters:** Price range, ratings, availability
- **Multi-Select:** Select multiple categories/locations
- **Recent Searches:** Show recent filter combinations

---

## Success Metrics

- **User Engagement:** Time on page, scroll depth
- **Filter Usage:** % of users using filters
- **Conversion:** Click-through rate to products
- **Performance:** Page load time < 2s
- **Error Rate:** < 1% API errors

---

## Implementation Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: ScopeFilterBar Component | 6 hours | Pending |
| Phase 2: Request Service | 4 hours | Pending |
| Phase 3: Update Hook | 4 hours | Pending |
| Phase 4: Page Integration | 6 hours | Pending |
| Phase 5: Category Discovery | 4 hours | Pending |
| Phase 6: Location Search | 6 hours | Pending |
| Phase 7: URL State | 4 hours | Pending |
| Phase 8: Testing & Polish | 4 hours | Pending |
| **Total** | **38 hours** (~5 days) | **0% Complete** |

---

## Dependencies

- ✅ Phase 5A, 5B, 5C backend APIs (Complete)
- ✅ Existing `/shops` page structure
- ✅ `useShopsFeaturedBuckets` hook
- ✅ `BucketSection` components
- ⏳ Browser Geolocation API (optional)
- ⏳ URL state management utilities

---

## Notes

- Maintain backward compatibility with existing page
- Default to global scope for existing users
- Progressive enhancement approach
- Mobile-first responsive design
- Accessible (WCAG 2.1 AA compliant)
- TypeScript strict mode
- Unit tests for request builder
- E2E tests for critical flows

---

**Status:** Ready for implementation. Backend APIs tested and working. UI components can be built incrementally without breaking existing functionality.
