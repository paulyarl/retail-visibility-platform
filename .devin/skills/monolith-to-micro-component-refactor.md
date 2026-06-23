---
description: How to refactor monolithic page layouts into micro-component sections using the Product Page Phase 0 refactor as the canonical pattern. Apply this to storefront layouts, directory pages, or any multi-variant page composition.
---

# Monolith → Micro-Component Refactor Pattern

Use this skill when refactoring a page that has **multiple layout variants** (e.g., classic, showcase, quick-commerce) with **duplicated rendering logic** into shared, composable micro-component sections. The Product Page Phase 0 refactor is the canonical reference.

## Canonical Reference

The product page refactor is the source of truth. Study these files before starting:

- **Plan doc:** `docs/PRODUCT_PAGE_INTEGRATION_PLAN.md`
- **Refactored layouts:** `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` (162 lines), `ProductQuickCommerceLayout.tsx` (211 lines)
- **Shared hook:** `apps/web/src/app/products/[id]/layouts/hooks/useProductLayoutState.ts`
- **Shared sections:** `apps/web/src/components/products/sections/` (gallery panel, purchase panel, bottom sections, skeleton, header, footer, reviews, FAQ, recommendations, inquiry, featured products, business info)
- **Type-safe sub-components:** `apps/web/src/components/products/type-sections/` (stock status, shipping, condition, digital download, license, access duration)
- **Mini compositor:** `apps/web/src/components/products/sections/ProductTypeSection.tsx`

## Core Principles

1. **Behavioral parity is non-negotiable.** The refactored page must render identically to the original. Same components, same order, same props, same conditional logic. Only the *location* of the JSX changes.
2. **Effective capability is the control plane.** Capability flags (`optFlags`, `productOptFlags`, `faqOptionsFlags`, `crmOptionsFlags`) drive all conditional rendering. Each micro-component receives only the flags it needs and gates itself independently.
3. **Layout files are thin composition layers.** They wire data from hooks to section components. No business logic, no inline JSX blocks. Target: under 250 lines.
4. **Section components are self-contained.** Each accepts typed props, handles its own conditional rendering, and is layout-variant-aware via a `layoutVariant` prop.
5. **Hooks centralize state and derived values.** A shared hook wraps the existing business logic hook and adds all duplicated local state (refs, handlers, derived display values).

## The 6-Step Refactor Process

### Step 1 — Audit the monolith

For each layout file, identify:
- **Duplicated blocks:** JSX that appears in multiple layouts with minor styling differences (gallery, purchase panel, trust bar, etc.)
- **Layout-unique blocks:** JSX that only appears in one layout (compact header, store info accordion, map section)
- **Shared logic:** State, refs, handlers, derived values that are copy-pasted across layouts
- **Post-page sections:** Components rendered after the main layout that are inline in the page root (reviews, FAQ, recommendations, footer, etc.)

Count lines. Set a target (e.g., 250 lines per layout file).

### Step 2 — Extract the shared layout hook

Create a hook that wraps the existing business logic hook and adds all duplicated local state:

```typescript
// Example: useProductLayoutState.ts
export function useProductLayoutState({ product, tenant, initialOptFlags, currentUrl, productOptFlags }) {
  const detailState = useProductDetailState({ product, tenant, initialOptFlags, currentUrl, productOptFlags });

  // Local UI state (duplicated across layouts)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const variantSelectorRef = useRef<HTMLDivElement>(null);

  // Derived display values (duplicated across layouts)
  const productTitle = product.title || product.name;
  const conditionLabel = /* ... */;
  const effectiveAvailability = /* ... */;
  const effectiveStock = /* ... */;
  const categoryName = /* ... */;

  // Handlers (duplicated across layouts)
  const handleGalleryImageClick = useCallback(/* ... */, []);
  const handleQuantityDecrement = useCallback(/* ... */, []);
  const handleQuantityIncrement = useCallback(/* ... */, []);
  const handleQuantityInput = useCallback(/* ... */, []);

  return {
    ...detailState,           // spread all base hook values
    lightboxOpen, setLightboxOpen, lightboxIndex,
    lightboxImages, cartButtonRef, variantSelectorRef,
    handleGalleryImageClick, maxQuantity,
    handleQuantityDecrement, handleQuantityIncrement, handleQuantityInput,
    scrollToVariantSelector,
    productTitle, conditionLabel, effectiveAvailability, effectiveStock,
    categoryName, categorySlug, storeLogoUrl,
  };
}
```

**Key:** The hook returns a single flat object. Layout files destructure it as `const s = useProductLayoutState(...)` and pass values to section components as props. This eliminates all duplicated state/handler/derived-value code.

### Step 3 — Extract shared section components

For each duplicated JSX block, create a section component in `components/[domain]/sections/`:

**Naming convention:** `[Domain][Section]Section.tsx` (e.g., `ProductGalleryPanel`, `ProductPurchasePanel`, `ProductBottomSections`)

**Props pattern:**
```typescript
interface ProductGalleryPanelProps {
  product: any;
  safeFeatures: any;
  videoPlayer?: React.ReactNode;
  onGalleryClick: (index: number) => void;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}
```

**Layout-variant awareness:** Use the `layoutVariant` prop to switch between styling variants:
```typescript
const isQuickCommerce = layoutVariant === 'quick-commerce';
const titleClass = isQuickCommerce
  ? 'text-2xl lg:text-3xl font-bold ...'
  : 'text-3xl lg:text-4xl font-bold ...';
```

**Conditional rendering:** Each section gates itself based on the capability flags it receives:
```typescript
{!showStatusPanel && (effectiveCanPurchase || commerceDisabled) && (
  <div ref={cartButtonRef} className={...}>
    {/* quantity + add to cart */}
  </div>
)}
```

### Step 4 — Extract post-page sections from the page root

The page root (`page.tsx`) often inline-renders sections after the layout component. Extract each into its own section component:

```
Before (inline in page.tsx):
  <ProductPageStatusWrapper>
    <FeaturedTypeProducts ... />
    <AvailableNearby ... />
    <ProductBusinessInfoWrapper ... />
    <ProductRecommendations ... />
    <FaqProductDisplay ... />
    <PublicInquiryForm ... />
    <ProductReviewsSection ... />
  </ProductPageStatusWrapper>
  <LastViewed ... />
  <StorefrontFooter ... />

After (each extracted to a section component):
  <ProductPageStatusWrapper>
    <FeaturedProductsSection ... />
    <ProductBusinessInfoSection ... />
    <ProductRecommendationsSection ... />
    <ProductFAQSection ... />
    <ProductInquirySection ... />
    <ProductReviewsSectionWrapper ... />
  </ProductPageStatusWrapper>
  <LastViewed ... />  {/* stays outside ProductPageStatusWrapper */}
  <ProductFooterSection ... />
```

**Critical:** Preserve the exact placement relative to wrapper components like `ProductPageStatusWrapper`. Components that need to render regardless of storefront status must stay *outside* the wrapper.

### Step 5 — Extract type-safe sub-components (if applicable)

If the domain has product/entity types that require different UI, create type-safe sub-components:

```
components/[domain]/type-sections/
  StockStatusInfo.tsx      — physical product stock info
  ShippingInfo.tsx         — physical product shipping info
  ConditionInfo.tsx        — condition badge (new/used/refurbished)
  DigitalDownloadInfo.tsx  — digital product download info
  LicenseInfo.tsx          — digital product license info
  AccessDurationInfo.tsx   — digital product access duration
```

**Mini compositor pattern:** Create a single component that selects the right sub-components based on entity type:
```typescript
// ProductTypeSection.tsx
export function ProductTypeSection({ product, productType, layoutVariant }) {
  switch (productType) {
    case 'physical': return <><StockStatusInfo ... /><ShippingInfo ... /><ConditionInfo ... /></>;
    case 'digital':  return <><DigitalDownloadInfo ... /><LicenseInfo ... /><AccessDurationInfo ... /></>;
    case 'hybrid':   return <>{/* both sets */}</>;
    default:         return null;
  }
}
```

### Step 6 — Rewrite layout files as thin composition layers

Replace each monolithic layout file with a thin composition:

```typescript
export function ProductShowcaseLayout({ product, tenant, videoPlayer, fulfillmentPane, ... }) {
  const s = useProductLayoutState({ product, tenant, initialOptFlags, currentUrl, productOptFlags });

  if (s.loading) return <ProductLayoutSkeleton layoutVariant="showcase" />;

  return (
    <div className="min-h-screen ...">
      <div className="max-w-7xl mx-auto ...">
        <ProductBreadcrumb {...} />
        <ProductTrustBar {...} />
        <div className="grid ...">
          <ProductGalleryPanel product={product} safeFeatures={s.safeFeatures} videoPlayer={videoPlayer} ... />
          <ProductPurchasePanel product={product} tenant={tenant} layoutVariant="showcase" ... />
        </div>
        <ProductBottomSections product={product} tenant={tenant} layoutVariant="showcase" ... />
      </div>
      <ProductImageLightbox {...} />
      <StickyPurchaseBar {...} />
    </div>
  );
}
```

**Layout-unique elements** (e.g., QuickCommerce's compact sticky header) stay inline in the layout file — they're not duplicated, so no extraction needed.

## Architectural Result

```
Control Plane (capability flags)
  ↓ passed as props
Page Root (server)
  ├── fetches capability flags via unifiedCapabilityService
  ├── renders <ProductHeaderSection />
  ├── renders layout (Showcase | QuickCommerce | Classic)
  │     └── useProductLayoutState hook
  │           ├── useProductDetailState (base business logic)
  │           └── local state + derived values + handlers
  │     └── composes:
  │           ├── ProductGalleryPanel
  │           ├── ProductPurchasePanel
  │           └── ProductBottomSections
  ├── renders post-product sections (inside ProductPageStatusWrapper)
  │     ├── FeaturedProductsSection
  │     ├── ProductBusinessInfoSection
  │     ├── ProductRecommendationsSection
  │     ├── ProductFAQSection
  │     ├── ProductInquirySection
  │     └── ProductReviewsSectionWrapper
  ├── renders LastViewed (outside ProductPageStatusWrapper)
  └── renders ProductFooterSection
```

## Type Safety Checklist

- [ ] All section component props have explicit interfaces
- [ ] `RefObject<HTMLDivElement | null>` for refs (not `RefObject<HTMLDivElement>`)
- [ ] `number | undefined` for optional numeric props (not `number`)
- [ ] `layoutVariant` is a union type, not a string
- [ ] Unused type imports removed from page root
- [ ] `pnpm checkweb` passes with zero errors

## Common Pitfalls

1. **Moving components inside wrappers they don't belong in.** `LastViewed` was accidentally moved inside `ProductPageStatusWrapper` during extraction. It must render even when the status panel is shown, so it stays *outside* the wrapper. Always verify wrapper boundaries.

2. **Hydration mismatches in QuickCommerce.** The QuickCommerce layout computes `isOnlineStore` and `showsLocation` from server-provided `productOptFlags` directly (not from the client hook) to avoid SSR/client divergence. Preserve this pattern when refactoring.

3. **Ref type strictness.** `useRef<HTMLDivElement>(null)` produces `RefObject<HTMLDivElement | null>`, not `RefObject<HTMLDivElement>`. Section component prop types must match.

4. **Unused imports after extraction.** When you move rendering logic to section components, the page root no longer needs imports for `publicFaqService`, `PublicFaqOptionsFlags`, `PublicCrmOptionsFlags`, etc. Clean these up to avoid warnings.

## Extending to New Domains

To apply this pattern to another domain (e.g., storefront layouts):

1. **Audit:** Identify duplicated blocks across storefront layout variants
2. **Hook:** Create `useStorefrontLayoutState` wrapping the existing storefront hook
3. **Sections:** Extract `StorefrontGalleryPanel`, `StorefrontProductGrid`, `StorefrontSidebar`, etc.
4. **Skeleton:** Create `StorefrontLayoutSkeleton` with layout-variant-aware loading states
5. **Rewrite:** Each storefront layout becomes a thin composition layer
6. **Type check:** Run `pnpm checkweb` — zero errors required

The product page refactor is the **pattern precedent**. Follow it exactly.
