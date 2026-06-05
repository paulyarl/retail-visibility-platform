# Product Variants Integration Guide

**Status:** ✅ Phase 1-5 Complete - Ready for Use  
**Date:** January 28, 2026

## Quick Start

Product variant support is now fully integrated into the platform. All backend APIs return computed variant fields, and UI components are ready to display variant information.

### For Product Cards

If you're working with product cards, simply import and use the variant components:

```tsx
import { VariantBadge, PriceRangeDisplay } from '@/components/variants';

// In your product card component
{product.has_variants && product.price_range ? (
  <>
    <PriceRangeDisplay priceRange={product.price_range} />
    <VariantBadge variantCount={product.variant_count || 0} />
  </>
) : (
  <span>${(product.priceCents / 100).toFixed(2)}</span>
)}
```

### For Product Detail Pages

Use the full variant selector and info card:

```tsx
import { VariantSelector, VariantInfoCard } from '@/components/variants';

// In your product page
{product.has_variants && (
  <div className="grid grid-cols-2 gap-4">
    <VariantSelector
      availableAttributes={product.available_attributes}
      variants={variants}
      onVariantSelect={setSelectedVariant}
    />
    <VariantInfoCard product={product} />
  </div>
)}
```

## Data Structure

### Backend Response

All product discovery APIs now return:

```typescript
{
  id: string;
  name: string;
  priceCents: number;
  // ... other product fields
  
  // Computed variant fields (from backend transformer)
  has_variants: boolean;
  variant_count: number;
  price_range?: {
    min_cents: number;
    max_cents: number;
    currency: string;
  };
  available_attributes?: {
    color: ['Red', 'Blue', 'Green'];
    size: ['S', 'M', 'L', 'XL'];
    material: ['Cotton', 'Polyester'];
  };
}
```

### Frontend Types

Import types from `@/types/variants`:

```typescript
import type { 
  ProductWithVariants, 
  PriceRange, 
  AvailableAttributes,
  MVVariant 
} from '@/types/variants';
```

## Component Reference

### VariantBadge

Shows variant count on product cards.

**Props:**
- `variantCount: number` - Number of variants
- `size?: 'sm' | 'default' | 'lg'` - Badge size
- `showIcon?: boolean` - Show package icon (default: true)

**Usage:**
```tsx
<VariantBadge variantCount={6} size="sm" />
```

### PriceRangeDisplay

Shows price range for products with variants.

**Props:**
- `priceRange: PriceRange` - Price range object
- `currency?: string` - Currency code (default: 'USD')
- `size?: 'sm' | 'default' | 'lg'` - Text size
- `showCurrency?: boolean` - Show currency code

**Usage:**
```tsx
<PriceRangeDisplay 
  priceRange={{ min_cents: 1999, max_cents: 2999 }} 
  size="lg"
/>
```

### VariantSelector

Dynamic attribute selector with smart filtering.

**Props:**
- `availableAttributes: AvailableAttributes` - Available options
- `variants: MVVariant[]` - Array of variants
- `onVariantSelect?: (variant: MVVariant | null) => void` - Callback
- `selectedAttributes?: VariantAttributes` - Initial selection

**Usage:**
```tsx
<VariantSelector
  availableAttributes={product.available_attributes}
  variants={variants}
  onVariantSelect={(variant) => {
    console.log('Selected:', variant);
  }}
/>
```

### VariantInfoCard

Comprehensive variant information display.

**Props:**
- `product: ProductWithVariants` - Product with variant data
- `showPriceRange?: boolean` - Show price range (default: true)
- `showAttributes?: boolean` - Show attributes (default: true)

**Usage:**
```tsx
<VariantInfoCard product={product} />
```

## Integration Checklist

### For New Product Card Components

- [ ] Import variant components
- [ ] Add variant fields to product interface
- [ ] Check `has_variants` before displaying variant info
- [ ] Use `PriceRangeDisplay` for parent products
- [ ] Add `VariantBadge` to show variant count
- [ ] Fallback to regular price if no variant data

### For Product Detail Pages

- [ ] Fetch variant data if needed
- [ ] Add `VariantSelector` for attribute selection
- [ ] Add `VariantInfoCard` for variant overview
- [ ] Handle variant selection in cart logic
- [ ] Update "Add to Cart" to use selected variant

### For Search/Filter Pages

- [ ] Ensure API calls include variant data
- [ ] Display variant badges on results
- [ ] Show price ranges for parent products
- [ ] Consider adding variant attribute filters

## API Endpoints

All these endpoints now return variant data:

**ShopsFeaturedService:**
- `GET /api/shops/:tenantId/trending` - Trending products
- `GET /api/shops/:tenantId/new` - New products
- `GET /api/shops/:tenantId/sale` - Sale products
- `GET /api/shops/:tenantId/seasonal` - Seasonal products
- `GET /api/shops/:tenantId/staff-picks` - Staff picks
- `GET /api/shops/:tenantId/selections` - Store selections

**ScopeRouter:**
- `GET /api/discovery/category/:categoryId` - Category products
- `GET /api/discovery/shop-category/:categoryId` - Shop category products
- `GET /api/discovery/both-categories` - Both categories products

## Backend Implementation

### Adding Variant JOINs to New Queries

If you're creating a new product discovery query:

1. **Add the JOIN:**
```sql
LEFT JOIN storefront_variants_mv sv ON your_table.inventory_item_id = sv.id
```

2. **Select variant fields:**
```sql
SELECT 
  your_table.*,
  sv.product_type,
  sv.parent_item_id,
  sv.variant_attributes,
  sv.variant_name,
  sv.variant_sort_order,
  sv.variant_is_active,
  sv.variant_group,
  sv.parent_product
FROM your_table
LEFT JOIN storefront_variants_mv sv ON your_table.inventory_item_id = sv.id
```

3. **Transform results:**
```typescript
import { transformProductsWithVariants, ProductWithVariants } from '../utils/variant-transformer';

const results = await prisma.$queryRawUnsafe(query, ...params) as ProductWithVariants[];
const transformedResults = transformProductsWithVariants(results);
return transformedResults;
```

## Testing

### Manual Testing Checklist

- [ ] Create a parent product with variants
- [ ] Verify variant data appears in API responses
- [ ] Check product cards show price range
- [ ] Verify variant badge displays count
- [ ] Test variant selector on product page
- [ ] Confirm variant selection updates cart
- [ ] Test on mobile devices
- [ ] Verify dark mode styling

### Test Products

Create test products with:
- Parent product with 3-6 variants
- Variants with different attributes (color, size)
- Variants with different prices
- Some variants out of stock

## Troubleshooting

### Variant data not showing

**Check:**
1. Does the product have `has_variants: true`?
2. Is `variant_count > 0`?
3. Does `price_range` exist?
4. Are you using the correct API endpoint?

### Price range showing same price

**Cause:** All variants have the same price.  
**Solution:** This is correct behavior. Component handles this gracefully.

### Variant selector not finding matches

**Check:**
1. Are all required attributes selected?
2. Is the variant active (`variant_is_active: true`)?
3. Do the attributes exactly match a variant?

### Components not importing

**Check:**
1. Path: `@/components/variants`
2. Named exports: `{ VariantBadge, PriceRangeDisplay }`
3. Types: `@/types/variants`

## Performance Considerations

### Caching

Variant data is computed once at the backend and cached with the product response. No additional queries needed.

### Optimization

- Variant transformations happen server-side
- Frontend receives pre-computed fields
- No N+1 query problems
- Efficient LEFT JOIN with indexed columns

### Best Practices

1. **Always check `has_variants`** before showing variant UI
2. **Use computed fields** - don't recalculate on frontend
3. **Fallback gracefully** - show regular price if no variant data
4. **Lazy load variants** - only fetch full variant list on product page
5. **Cache responses** - variant data doesn't change frequently

## Migration Guide

### Updating Existing Product Cards

**Before:**
```tsx
<span>${(product.priceCents / 100).toFixed(2)}</span>
```

**After:**
```tsx
{product.has_variants && product.price_range ? (
  <PriceRangeDisplay priceRange={product.price_range} />
) : (
  <span>${(product.priceCents / 100).toFixed(2)}</span>
)}
```

### Adding Variant Badge

**Add below price:**
```tsx
{product.has_variants && product.variant_count && (
  <VariantBadge variantCount={product.variant_count} size="sm" />
)}
```

## Examples

### SmartProductCard Integration

See `apps/web/src/components/products/SmartProductCard.tsx` for a complete example of variant integration across all card variants (featured, grid, list, compact).

### Key Patterns

**Conditional Display:**
```tsx
{product.has_variants && product.price_range ? (
  // Show variant info
) : (
  // Show regular info
)}
```

**Size Variants:**
```tsx
// Featured/Large cards
<PriceRangeDisplay priceRange={product.price_range} size="lg" />

// Grid cards
<PriceRangeDisplay priceRange={product.price_range} size="default" />

// Compact cards
<PriceRangeDisplay priceRange={product.price_range} size="sm" />
```

## Documentation

- **Component README:** `apps/web/src/components/variants/README.md`
- **Type Definitions:** `apps/web/src/types/variants.ts`
- **Backend Transformer:** `apps/api/src/utils/variant-transformer.ts`
- **Implementation Status:** `VARIANT_JOIN_IMPLEMENTATION_STATUS.md`

## Support

For questions or issues:
1. Check this guide first
2. Review component README
3. Examine SmartProductCard implementation
4. Check backend transformer logic

---

**Last Updated:** January 28, 2026  
**Version:** 1.0 - Phase 1-5 Complete
