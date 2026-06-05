# Product Variants Integration Plan
**Date:** January 27, 2026  
**Status:** 🚧 IN PROGRESS

---

## Overview

Integrate product variant data from `storefront_variants_mv` into the scope-aware product discovery pipeline, ensuring variant information flows through to product cards and pages across all scopes (global, category, location).

---

## Materialized View Analysis

### `storefront_variants_mv` Structure

**Key Fields:**
```sql
- id                    -- Product/variant ID
- tenant_id             -- Tenant identifier
- product_type          -- 'parent' | 'variant' | 'simple'
- parent_item_id        -- Parent product ID (for variants)
- variant_attributes    -- JSONB attributes (color, size, etc.)
- variant_name          -- Display name for variant
- variant_sort_order    -- Display order
- variant_is_active     -- Active status
- variant_group         -- JSON array of all variants for parent
- parent_product        -- JSON object with parent info
```

**Product Types:**
1. **'simple'** - Standalone product with no variants
2. **'parent'** - Product with variants (has variant_group)
3. **'variant'** - Individual variant (has parent_item_id)

**Variant Group Structure:**
```json
[
  {
    "id": "variant-id",
    "sku": "VARIANT-SKU",
    "variant_name": "Red - Large",
    "price_cents": 2999,
    "sale_price_cents": 2499,
    "stock": 10,
    "image_url": "https://...",
    "attributes": {
      "color": "Red",
      "size": "Large"
    },
    "sort_order": 1,
    "is_active": true,
    "is_on_sale": true,
    "discount_percentage": 16.67
  }
]
```

---

## Integration Strategy

### Phase 1: TypeScript Types
Create comprehensive type definitions for variant data.

**Files to Create/Update:**
- `apps/web/src/types/variants.ts` - New variant types
- `apps/web/src/types/product.ts` - Update product types

**Type Definitions:**
```typescript
export type ProductType = 'simple' | 'parent' | 'variant';

export interface VariantAttributes {
  [key: string]: string; // color, size, material, etc.
}

export interface ProductVariant {
  id: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  attributes: VariantAttributes;
  sort_order: number;
  is_active: boolean;
  is_on_sale: boolean;
  discount_percentage: number;
}

export interface ParentProduct {
  id: string;
  sku: string;
  name: string;
  has_variants: boolean;
}

export interface ProductWithVariants {
  id: string;
  tenant_id: string;
  product_type: ProductType;
  parent_item_id?: string;
  variant_attributes?: VariantAttributes;
  variant_name?: string;
  variant_sort_order?: number;
  variant_is_active?: boolean;
  variant_group?: ProductVariant[];
  parent_product?: ParentProduct;
  
  // Existing product fields
  sku: string;
  name: string;
  price_cents: number;
  // ... etc
}
```

### Phase 2: Backend Integration

**✅ SIMPLIFIED APPROACH - No MV Updates Needed!**

The `storefront_variants_mv` already exists with all variant data. We just need to **LEFT JOIN** it in our queries.

**Join Strategy:**
```sql
-- In ShopsFeaturedService queries
SELECT 
  mgd.*,
  sv.product_type,
  sv.parent_item_id,
  sv.variant_attributes,
  sv.variant_name,
  sv.variant_sort_order,
  sv.variant_is_active,
  sv.variant_group,
  sv.parent_product
FROM mv_global_discovery mgd
LEFT JOIN storefront_variants_mv sv ON mgd.inventory_item_id = sv.id
WHERE mgd.item_status = 'active' AND mgd.visibility = 'public'
```

**Benefits:**
- ✅ No MV schema changes needed
- ✅ No MV refresh required
- ✅ Instant availability
- ✅ Works with all existing MVs (global, category, location)

**Files to Update:**
- `apps/api/src/services/ShopsFeaturedService.ts` - Add LEFT JOIN to queries ✅ DONE
- `apps/api/src/routes/public-api.ts` - Transform variant data in responses

### Phase 3: API Response Transformation

**Current Response:**
```json
{
  "inventory_item_id": "sid-abc123",
  "name": "T-Shirt",
  "price_cents": 2999
}
```

**Enhanced Response with Variants:**
```json
{
  "inventory_item_id": "sid-abc123",
  "name": "T-Shirt",
  "price_cents": 2999,
  "product_type": "parent",
  "has_variants": true,
  "variant_count": 6,
  "price_range": {
    "min_cents": 2499,
    "max_cents": 3499
  },
  "variants": [
    {
      "id": "variant-1",
      "variant_name": "Red - Small",
      "price_cents": 2499,
      "stock": 5,
      "attributes": { "color": "Red", "size": "Small" }
    }
  ],
  "available_attributes": {
    "color": ["Red", "Blue", "Green"],
    "size": ["Small", "Medium", "Large"]
  }
}
```

### Phase 4: Frontend Components

#### A. Product Card Updates

**Display Logic:**
- **Simple Products:** Show as-is (current behavior)
- **Parent Products:** Show "X variants available" badge
- **Variants:** Show parent product link + variant name

**Visual Indicators:**
```tsx
{product.product_type === 'parent' && (
  <div className="variant-badge">
    {product.variant_count} variants available
  </div>
)}

{product.product_type === 'variant' && (
  <div className="variant-info">
    Variant: {product.variant_name}
  </div>
)}
```

**Price Display:**
```tsx
{product.product_type === 'parent' && product.price_range ? (
  <div className="price-range">
    ${(product.price_range.min_cents / 100).toFixed(2)} - 
    ${(product.price_range.max_cents / 100).toFixed(2)}
  </div>
) : (
  <div className="price">
    ${(product.price_cents / 100).toFixed(2)}
  </div>
)}
```

#### B. Product Page Updates

**Variant Selector Component:**
```tsx
<VariantSelector
  variants={product.variants}
  selectedVariant={selectedVariant}
  onVariantChange={handleVariantChange}
  availableAttributes={product.available_attributes}
/>
```

**Features:**
- Attribute dropdowns (Color, Size, etc.)
- Visual swatches for colors
- Stock indicators per variant
- Price updates on selection
- Image updates on selection
- "Out of Stock" disabled states

#### C. Bucket Section Updates

**Filter Parent/Variant Display:**
- Option 1: Show only parent products (hide variants)
- Option 2: Show all (group variants under parent)
- Option 3: Show variants as separate items

**Recommended:** Show only parent products in discovery, expand variants on product page.

### Phase 5: Scope-Aware Variant Filtering

**Category Scope:**
- Variants inherit parent's category
- Filter by parent product category

**Location Scope:**
- Variants inherit parent's location
- Filter by parent product location

**Global Scope:**
- Show all active variants/parents

---

## Implementation Checklist

### Backend
- [ ] Add variant fields to `mv_global_discovery`
- [ ] Add variant fields to `mv_category_discovery`
- [ ] Update `ShopsFeaturedService` to include variant data
- [ ] Transform variant data in API responses
- [ ] Add variant aggregation (price ranges, attribute lists)
- [ ] Test variant queries across all scopes

### Frontend Types
- [ ] Create `types/variants.ts`
- [ ] Update `types/product.ts` with variant fields
- [ ] Update `types/scope.ts` if needed

### Frontend Components
- [ ] Create `VariantBadge` component
- [ ] Create `VariantSelector` component
- [ ] Create `AttributeFilter` component (for variant attributes)
- [ ] Update `ProductCard` to show variant info
- [ ] Update `BucketSection` to handle variants
- [ ] Update product detail pages with variant selector

### Caching
- [ ] Update `ProductCache` to cache variant data
- [ ] Ensure variant data flows through UniversalSingleton
- [ ] Test cache invalidation for variant updates

### Testing
- [ ] Test simple products (no variants)
- [ ] Test parent products (with variants)
- [ ] Test variant products (individual variants)
- [ ] Test variant selection on product pages
- [ ] Test variant filtering in scopes
- [ ] Test variant stock updates
- [ ] Test variant price updates

---

## Data Flow

```
User visits /shops
    ↓
useShopsFeaturedBuckets() hook
    ↓
ProductCache.getInstance() [UniversalSingleton]
    ↓
API: /api/public/shops/discover/{bucket}?scope=...
    ↓
ShopsFeaturedService queries mv_global_discovery
    ↓
LEFT JOIN storefront_variants_mv
    ↓
Return products with variant data
    ↓
Transform response (add price_range, variant_count)
    ↓
Cache in ProductCache [UniversalSingleton]
    ↓
Display in BucketSection
    ↓
ProductCard shows variant badge/info
    ↓
User clicks product
    ↓
Product page shows VariantSelector
    ↓
User selects variant
    ↓
Update price, image, stock display
```

---

## UI/UX Considerations

### Product Cards
**Parent Products:**
- Show primary image
- Display price range
- Badge: "6 variants"
- Hover: Show variant preview

**Variant Products:**
- Show variant-specific image
- Display variant price
- Label: "Variant of [Parent]"
- Link to parent product

### Product Pages
**Parent Products:**
- Show all variants
- Attribute selectors (dropdowns/swatches)
- Update image on variant selection
- Update price on variant selection
- Show stock per variant
- "Add to Cart" uses selected variant

**Variant Products:**
- Show variant details
- Link to parent product
- Show other available variants
- Allow switching between variants

### Discovery/Filtering
**Bucket Display:**
- Show parent products only
- Indicate variant availability
- Clicking opens product page with variant selector

**Search Results:**
- Show parent products
- Optionally show matching variants
- Group variants under parent

---

## Performance Considerations

### Caching Strategy
- Cache parent products with full variant_group
- Cache individual variants separately
- TTL: 5 minutes (same as ProductCache)
- Invalidate on variant updates

### Query Optimization
- Use MV for fast variant lookups
- Aggregate variant data at query time
- Limit variant_group to active variants only
- Index on product_type, parent_item_id

### Response Size
- Limit variant_group to essential fields
- Paginate variants if > 20
- Lazy load variant images
- Compress variant attributes

---

## API Endpoint Examples

### Get Product with Variants
```
GET /api/public/shops/discover/trending?scope=global&limit=12
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "inventory_item_id": "sid-parent-1",
      "name": "Classic T-Shirt",
      "product_type": "parent",
      "has_variants": true,
      "variant_count": 6,
      "price_range": {
        "min_cents": 1999,
        "max_cents": 2499
      },
      "variants": [
        {
          "id": "sid-variant-1",
          "variant_name": "Red - Small",
          "price_cents": 1999,
          "stock": 10,
          "attributes": { "color": "Red", "size": "Small" }
        }
      ],
      "available_attributes": {
        "color": ["Red", "Blue", "Green"],
        "size": ["Small", "Medium", "Large"]
      }
    }
  ]
}
```

### Get Specific Variant
```
GET /api/items/sid-variant-1
```

**Response:**
```json
{
  "id": "sid-variant-1",
  "product_type": "variant",
  "variant_name": "Red - Small",
  "variant_attributes": { "color": "Red", "size": "Small" },
  "parent_product": {
    "id": "sid-parent-1",
    "name": "Classic T-Shirt",
    "has_variants": true
  },
  "price_cents": 1999,
  "stock": 10
}
```

---

## Migration Strategy

### Phase 1: Backend (Week 1)
1. Update MVs with variant fields
2. Update ShopsFeaturedService queries
3. Add variant data transformation
4. Test API responses

### Phase 2: Types & Cache (Week 1)
1. Create variant TypeScript types
2. Update ProductCache to handle variants
3. Test caching with variant data

### Phase 3: Display (Week 2)
1. Create variant components
2. Update product cards
3. Update product pages
4. Test across all scopes

### Phase 4: Polish (Week 2)
1. Add variant filtering
2. Optimize performance
3. Add analytics tracking
4. User testing

---

## Success Metrics

- ✅ Variant data flows through all scopes
- ✅ Product cards show variant indicators
- ✅ Product pages have working variant selectors
- ✅ Price/stock updates on variant selection
- ✅ Caching works with variant data
- ✅ No performance degradation
- ✅ Emergency bust mode works with variants

---

**Status:** Ready for implementation  
**Priority:** High (critical for product display completeness)  
**Estimated Effort:** 2 weeks
