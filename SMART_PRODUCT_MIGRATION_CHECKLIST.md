# SmartProductCard Migration Checklist

## 🎯 Mission: Platform-Wide Self-Aware Products

Replace all manual product displays with SmartProductCard for consistency, performance, and maintainability.

---

## ✅ Completed

### Core Components
- [x] **SmartProductCard** - Self-aware product component with 3 display variants
- [x] **TenantPaymentContext** - Performance optimization layer
- [x] **ProductDisplay** - Grid, list, and gallery views integrated

---

## 🔄 In Progress

### High Priority Components

#### 1. LastViewed Component
**File:** `apps/web/src/components/directory/LastViewed.tsx`  
**Lines:** 266-283 (Product display with manual AddToCartButton)  
**Current State:** Manual payment gateway checking + AddToCartButton  
**Target State:** SmartProductCard with compact variant

**Changes Needed:**
```typescript
// Replace lines 252-285
<SmartProductCard
  product={{
    id: productData.productId,
    sku: productData.productId,
    name: productData.productName,
    title: productData.productName,
    brand: productData.businessName,
    priceCents: Math.round((productData.productPrice || 0) * 100),
    stock: 999,
    imageUrl: productData.productImage,
    tenantId: productData.tenantId,
    availability: 'in_stock',
  }}
  tenantName={productData.businessName}
  tenantLogo={productData.tenantLogo}
  variant="compact"
  showCategory={false}
  showDescription={false}
/>
```

**Impact:**
- Eliminates manual `hasActivePaymentGateway` checking
- Removes SwisProductCard wrapper
- Consistent with other product displays
- Automatic variant support

---

#### 2. ProductRecommendations Component
**File:** `apps/web/src/components/products/ProductRecommendations.tsx`  
**Lines:** 59-112 (Manual product card rendering)  
**Current State:** Custom Link + Image + manual layout  
**Target State:** SmartProductCard with compact variant

**Changes Needed:**
```typescript
// Replace lines 59-112
<SmartProductCard
  key={product.id}
  product={{
    id: product.id,
    sku: product.id,
    name: product.name,
    title: product.title,
    brand: product.brand,
    priceCents: Math.round(product.price * 100),
    stock: 999,
    imageUrl: product.imageUrl,
    tenantId: tenantId,
    availability: 'in_stock',
  }}
  tenantName=""
  variant="compact"
  showCategory={false}
  showDescription={false}
  className="h-full"
/>
```

**Impact:**
- Automatic payment gateway checking
- Consistent styling with platform
- Variant support built-in
- Eliminates custom card layout

---

### Medium Priority Components

#### 3. Landing Page Product Displays
**File:** `apps/web/src/components/landing-page/TierBasedLandingPage.tsx`  
**Status:** Needs investigation  
**Likely Changes:** Replace demo product cards with SmartProductCard

#### 4. Directory Product Listings
**Files:** Multiple directory components  
**Status:** Needs investigation  
**Note:** May be store-focused, not product-focused

---

## 📋 Discovery Needed

### Components to Investigate

#### Search Results
- **ProductSearch.tsx** - Storefront product search
- May need SmartProductCard integration

#### Admin/Preview Components
- Product previews in admin panels
- Inventory management displays
- May benefit from SmartProductCard for consistency

#### Tenant Storefronts
- Individual tenant product pages
- Category pages
- May already be using ProductDisplay

---

## 🎨 Migration Pattern

### Standard Replacement

**Before:**
```typescript
<div className="product-card">
  <Image src={product.imageUrl} />
  <h3>{product.title}</h3>
  <PriceDisplay price={product.price} />
  {hasPaymentGateway && (
    product.has_variants ? (
      <ProductWithVariants product={product} />
    ) : (
      <AddToCartButton product={product} />
    )
  )}
</div>
```

**After:**
```typescript
<SmartProductCard
  product={product}
  variant="grid" // or "list" or "compact"
  showCategory={true}
  showDescription={true}
/>
```

### With Context Provider (Optimal)

**Before:**
```typescript
{products.map(product => (
  <CustomProductCard product={product} />
))}
```

**After:**
```typescript
<TenantPaymentProvider tenantId={tenantId}>
  {products.map(product => (
    <SmartProductCard product={product} variant="grid" />
  ))}
</TenantPaymentProvider>
```

---

## 🚀 Benefits Per Component

### LastViewed
- **Code Reduction:** ~30 lines → 15 lines
- **Performance:** Shared context with other components
- **Consistency:** Same look/feel as ProductDisplay
- **Maintenance:** Fix once, works everywhere

### ProductRecommendations
- **Code Reduction:** ~50 lines → 15 lines
- **Features:** Automatic variant support
- **Performance:** Payment gateway check built-in
- **UX:** Consistent purchase experience

---

## 📊 Progress Tracking

**Total Components Identified:** 5+  
**Completed:** 1 (ProductDisplay)  
**In Progress:** 2 (LastViewed, ProductRecommendations)  
**Pending Discovery:** 2+  

**Estimated Impact:**
- **Code Reduction:** 200+ lines eliminated
- **API Calls:** 90%+ reduction across platform
- **Consistency:** 100% uniform product displays
- **Maintenance:** Single source of truth

---

## 🎯 Next Steps

### Immediate Actions
1. ✅ Create this checklist
2. 🔄 Integrate LastViewed component
3. 🔄 Integrate ProductRecommendations component
4. ⏳ Discover and document remaining components
5. ⏳ Create final migration summary

### Testing Strategy
- Test each component after migration
- Verify payment gateway detection
- Check variant product handling
- Validate performance improvements
- Ensure mobile responsiveness

### Rollout Strategy
- Migrate high-traffic components first
- Monitor performance metrics
- Gather user feedback
- Document any issues
- Celebrate wins! 🎉

---

## 📝 Notes

### Component Data Requirements

SmartProductCard expects:
```typescript
{
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  tenantId: string;
  payment_gateway_type?: string;
  payment_gateway_id?: string;
  has_variants?: boolean;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  tenantCategory?: { id, name, slug };
}
```

### Common Transformations

**Price to Cents:**
```typescript
priceCents: Math.round(product.price * 100)
```

**Default Stock:**
```typescript
stock: product.stock || 999
```

**Default Availability:**
```typescript
availability: 'in_stock'
```

---

**Status:** 🚀 READY TO ROLL OUT

Let's make every product on the platform self-aware! 💙
