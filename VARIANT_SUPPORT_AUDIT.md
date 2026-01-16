# Product Variants - Support Audit

## Current Status by Area

### ✅ 1. Item Details Page (Admin) - SUPPORTED
**Location:** `apps/web/src/app/t/[tenantId]/items/[itemId]/page.tsx`

**Current Support:**
- ✅ EditItemModal integration (opens from item details page)
- ✅ ProductVariants component in EditItemModal
- ✅ Full variant CRUD operations
- ✅ Variant list display with attributes
- ✅ SKU auto-generation
- ✅ Stock management per variant

**What Works:**
- Admin can create/edit/delete variants from item details page
- Variants show in EditItemModal when editing item
- All variant attributes are editable
- Stock synchronization with parent product

**Status:** ✅ FULLY SUPPORTED

---

### ❌ 2. Photo Assignment - NOT SUPPORTED
**Location:** `apps/web/src/components/items/ItemPhotoGallery.tsx`

**Current State:**
- Photos are assigned to parent product only
- No variant-specific photo assignment
- Photo gallery doesn't distinguish between variants

**Missing Features:**
- ❌ Assign photos to specific variants
- ❌ Show variant name when assigning photos
- ❌ Filter photos by variant
- ❌ Variant image_url field in database (exists but not used in UI)

**Impact:**
- All variants share the same parent product photos
- Cannot show different images for different variants (e.g., red vs blue shirt)

**Status:** ❌ NOT SUPPORTED - Needs Implementation

---

### ❌ 3. Product Page Photo Gallery (Customer) - PARTIAL
**Location:** Customer-facing product pages

**Current State:**
- Shows parent product photos only
- No variant-specific photo switching
- Gallery doesn't update when variant selected

**Missing Features:**
- ❌ Switch photos when variant selected
- ❌ Show variant-specific images in gallery
- ❌ Highlight which photo corresponds to selected variant

**Expected Behavior:**
- Customer selects "Blue" variant → Gallery shows blue product photos
- Customer selects "Red" variant → Gallery shows red product photos

**Status:** ❌ NOT SUPPORTED - Needs Implementation

---

### ❌ 4. Storefront Gallery View - NOT INTEGRATED
**Location:** `apps/web/src/components/storefront/ProductDisplay.tsx`

**Current State:**
- Gallery view shows products with AddToCartButton
- No VariantSelector integration
- No variant-specific pricing or stock display

**Missing Features:**
- ❌ VariantSelector in gallery view
- ❌ Variant-specific price display
- ❌ Variant-specific stock display
- ❌ Variant photo switching

**Status:** ❌ NOT INTEGRATED - ProductWithVariants component created but not integrated

---

## Summary

| Area | Status | Priority |
|------|--------|----------|
| Item Details Page (Admin) | ✅ Supported | - |
| Photo Assignment | ❌ Not Supported | HIGH |
| Product Page Gallery | ❌ Partial | HIGH |
| Storefront Gallery View | ❌ Not Integrated | MEDIUM |

---

## Required Implementations

### Priority 1: Photo Assignment for Variants

**Database Schema:**
- ✅ `product_variants.image_url` field exists
- Need to add variant_id to photo_assets table

**Migration Needed:**
```sql
-- Add variant support to photo_assets
ALTER TABLE photo_assets
ADD COLUMN IF NOT EXISTS variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create index for variant photo lookups
CREATE INDEX IF NOT EXISTS idx_photo_assets_variant_id 
ON photo_assets(variant_id) WHERE variant_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN photo_assets.variant_id IS 'Links photo to specific product variant';
```

**UI Changes Needed:**

1. **ItemPhotoGallery Component**
   - Add variant selector dropdown
   - Filter photos by selected variant
   - Allow assigning photos to variants
   - Show variant name on photo cards

2. **Photo Upload Flow**
   - Add "Assign to variant" option
   - Show variant dropdown when uploading
   - Allow bulk assignment to variants

**Implementation:**
```tsx
// In ItemPhotoGallery.tsx
const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
const [variants, setVariants] = useState<ProductVariant[]>([]);

// Fetch variants if item has them
useEffect(() => {
  if (item.has_variants) {
    fetchVariants(item.id).then(setVariants);
  }
}, [item.id, item.has_variants]);

// Filter photos by variant
const filteredPhotos = selectedVariant
  ? photos.filter(p => p.variant_id === selectedVariant)
  : photos.filter(p => !p.variant_id); // Show parent photos by default

// Variant selector UI
{item.has_variants && (
  <select onChange={(e) => setSelectedVariant(e.target.value)}>
    <option value="">Parent Product Photos</option>
    {variants.map(v => (
      <option key={v.id} value={v.id}>{v.variant_name}</option>
    ))}
  </select>
)}
```

---

### Priority 2: Product Page Photo Gallery Integration

**Files to Update:**
- Customer-facing product detail pages
- ProductWithVariants component

**Implementation:**
```tsx
// In ProductWithVariants.tsx
const [selectedVariantPhotos, setSelectedVariantPhotos] = useState<string[]>([]);

// When variant selected, fetch variant photos
useEffect(() => {
  if (selectedVariant?.image_url) {
    // Use variant-specific photo
    setSelectedVariantPhotos([selectedVariant.image_url]);
  } else if (selectedVariant?.id) {
    // Fetch photos assigned to this variant
    fetchVariantPhotos(selectedVariant.id).then(setSelectedVariantPhotos);
  } else {
    // Use parent product photos
    setSelectedVariantPhotos([product.imageUrl]);
  }
}, [selectedVariant]);

// Pass to photo gallery
<PhotoGallery photos={selectedVariantPhotos} />
```

---

### Priority 3: Storefront Gallery View Integration

**File:** `apps/web/src/components/storefront/ProductDisplay.tsx`

**Changes Needed:**
1. Import ProductWithVariants component
2. Replace AddToCartButton with ProductWithVariants in gallery view
3. Handle variant photo display in gallery mode

**Implementation:**
```tsx
// In ProductDisplay.tsx - Gallery View
{viewMode === 'gallery' && (
  <div className="product-card">
    <div className="product-image">
      {/* Show variant photo if selected, otherwise parent */}
      <Image src={currentPhoto} alt={product.name} />
    </div>
    
    <ProductWithVariants
      product={product}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
      defaultGatewayType={defaultGatewayType}
    />
  </div>
)}
```

---

## Implementation Plan

### Phase 1: Photo Assignment (Critical)
1. Create database migration for photo_assets.variant_id
2. Update Prisma schema with variant_id relation
3. Update ItemPhotoGallery component:
   - Add variant selector
   - Filter photos by variant
   - Allow photo assignment to variants
4. Update photo upload API to accept variant_id
5. Update photo assignment UI in admin

**Estimated Effort:** 4-6 hours

### Phase 2: Product Page Gallery (High Priority)
1. Update ProductWithVariants to handle photo switching
2. Fetch variant photos when variant selected
3. Update photo gallery to show variant-specific photos
4. Add smooth transitions between variant photos

**Estimated Effort:** 2-3 hours

### Phase 3: Storefront Integration (Medium Priority)
1. Replace AddToCartButton with ProductWithVariants in:
   - Grid view
   - List view
   - Gallery view
2. Test all view modes with variants
3. Ensure photo switching works in all views

**Estimated Effort:** 2-3 hours

---

## Testing Checklist

### Photo Assignment
- [ ] Upload photo and assign to specific variant
- [ ] View photos filtered by variant
- [ ] Reassign photo from one variant to another
- [ ] Delete variant-specific photo
- [ ] Verify parent photos still show when no variant selected

### Product Page Gallery
- [ ] Select variant → Gallery updates with variant photos
- [ ] Switch between variants → Photos update smoothly
- [ ] Fallback to parent photos if variant has no photos
- [ ] Multiple photos per variant display correctly

### Storefront Gallery View
- [ ] VariantSelector appears in gallery view
- [ ] Price updates when variant selected
- [ ] Stock updates when variant selected
- [ ] Photos update when variant selected
- [ ] Add to cart works with selected variant

---

## Business Impact

**Without Variant Photo Support:**
- ❌ Cannot show different colors of same product
- ❌ Customers can't see what they're buying
- ❌ Higher return rates (wrong color/style)
- ❌ Reduced conversion (unclear product appearance)

**With Variant Photo Support:**
- ✅ Clear visual representation of each variant
- ✅ Customers see exactly what they're buying
- ✅ Lower return rates
- ✅ Higher conversion rates
- ✅ Better customer experience

---

## Conclusion

**Current State:**
- ✅ Admin variant management: Fully functional
- ✅ Cart and orders: Fully functional
- ❌ Photo assignment: Not implemented
- ❌ Customer-facing displays: Partially implemented

**Critical Gap:**
Photo assignment for variants is the most critical missing piece. Without it, variants are functional but not visually distinguishable to customers.

**Recommendation:**
Implement photo assignment first (Phase 1), then integrate into customer-facing pages (Phases 2 & 3). This ensures variants are fully functional and visually complete.
