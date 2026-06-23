# Product Page Integration Plan

## Architectural Shift: Monolith → Micro Components

This plan transforms the product detail page from **monolithic layout files** that each contain all rendering logic inline, to **micro component sections** composed by thin layout wrappers, with a **mini compositor** (`ProductTypeSection`) that selects type-safe sub-components based on `productType`.

```
Product pipeline:
  layout > product type > type-safe components
  (layout composes sections, ProductTypeSection composes type-safe sub-components)
```

Companion to `STOREFRONT_TYPE_INTEGRATION_PLAN.md` (store pipeline). Both plans share the same capability system, store type model, and tier gating.

---

## Current State

### Three Product Layouts

| Layout | Key | File | Lines | Status |
|---|---|---|---|---|
| Classic | `classic` | `page.tsx` (inline) | ~140 JSX | Monolith — inline in page root |
| Showcase | `showcase` | `ProductShowcaseLayout.tsx` | 785 | Duplicates gallery, purchase panel, variants, trust bar |
| Quick Commerce | `quick-commerce` | `ProductQuickCommerceLayout.tsx` | 664 | Duplicates same with compact styling |

### Layout Resolution

Storefront layout determines product page layout via `PRODUCT_LAYOUT_MAP` (defined in `apps/web/src/app/products/[id]/layouts/types.ts`):

| Storefront Layout | Product Layout |
|---|---|
| `classic` | `classic` (inline in `page.tsx`) |
| `editorial` | `showcase` (`ProductShowcaseLayout`) |
| `immersive` | `quick-commerce` (`ProductQuickCommerceLayout`) |

`resolveProductLayout()` resolves the layout from `optFlags.storefrontLayout` or `?layout_preview` URL parameter.

### What's Already Shared

- `useProductDetailState` hook (16KB — centralizes all state logic: quantity, variants, cart, stock)
- `ProductBreadcrumb`, `ProductTrustBar`, `ProductDetailTabs`, `ProductImageLightbox`, `StickyPurchaseBar` (shared components in `layouts/shared/`)
- `ProductLayoutProps` interface (all three layouts receive the same props)
- `FeaturedTypeProducts` (already a mini compositor — groups by `featuredType`, renders type config + `SmartProductCard`)

### What's Duplicated

- Gallery rendering (lightbox, image grid, single image fallback, video player)
- Purchase panel (price display, variant selector, quantity controls, add-to-cart, buy now)
- Trust bar / breadcrumb
- Digital product section (download info, license type, access duration)
- Service product section (booking CTA, duration, service area) — **doesn't exist yet**
- Loading skeletons
- Post-product sections (featured products, business info, reviews, FAQ, recommendations, recently viewed) — inline in `page.tsx` for all layouts

### Current `page.tsx` Structure (1123 lines)

```
page.tsx (1123 lines)
  ├── Data fetching (getProduct, getShopData, getFeaturedProductsByType, etc.)
  ├── Merchant gate filtering (filterTypesByMerchantPreferences, etc.)
  ├── Layout resolution (resolveProductLayout)
  ├── Layout-dependent rendering:
  │   ├── showcase → <ProductShowcaseLayout {...layoutProps} />
  │   ├── quick-commerce → <ProductQuickCommerceLayout {...layoutProps} />
  │   └── classic → inline ~140 lines of JSX
  └── Shared post-product sections (inline, ~180 lines):
      ├── FeaturedTypeProducts
      ├── AvailableNearby
      ├── ProductBusinessInfoWrapper (or digital product block)
      ├── ProductRecommendations
      ├── FaqProductDisplay
      ├── PublicInquiryForm
      ├── ProductReviewsSection
      ├── LastViewed (recently viewed)
      └── StorefrontFooter
```

---

## Proposed Architecture

### Monolith → Micro Components

```
BEFORE: Monolith                              AFTER: Micro Components
─────────────────                             ──────────────────────
page.tsx (1123 lines)                         page.tsx (~200 lines)
  ├── classic layout inline                     ├── <ProductHeaderSection layoutVariant="classic" />
  ├── showcase delegates to 785-line file       ├── <ProductGallerySection layoutVariant="classic" />
  ├── quick-commerce delegates to 664-line      ├── <ProductPurchaseSection layoutVariant="classic" />
  └── shared sections inline                    ├── <ProductTypeSection productType={product.productType} layoutVariant="classic" />
                                                 ├── <FeaturedProductsSection />
                                                 ├── <ProductBusinessInfoSection />
                                                 ├── <ProductReviewsSection />
                                                 ├── <ProductFAQSection />
                                                 ├── <ProductRecommendationsSection />
                                                 └── <StorefrontFooter />

ProductShowcaseLayout.tsx (785 lines)         ProductShowcaseLayout.tsx (~150 lines)
  ├── gallery inline                             ├── <ProductHeaderSection layoutVariant="showcase" />
  ├── purchase panel inline                      ├── <ProductGallerySection layoutVariant="showcase" />
  ├── variants inline                            ├── <ProductPurchaseSection layoutVariant="showcase" />
  ├── trust bar inline                           └── <ProductTypeSection productType={product.productType} layoutVariant="showcase" />
  └── digital/service inline

ProductQuickCommerceLayout.tsx (664 lines)    ProductQuickCommerceLayout.tsx (~120 lines)
  ├── same duplicated                            ├── <ProductHeaderSection layoutVariant="quick-commerce" />
  └── with compact styling                       ├── <ProductGallerySection layoutVariant="quick-commerce" />
                                                 └── <ProductPurchaseSection layoutVariant="quick-commerce" />

3 files × ~850 lines avg                       3 files × ~150 lines + ~600 lines shared sections
= ~2550 lines, heavy duplication               = ~1050 lines, zero duplication
```

### Shared Product Page Sections

`apps/web/src/components/products/sections/`:

| Section | Responsibility | Props |
|---|---|---|
| `ProductHeaderSection` | Breadcrumb, trust bar, store link | `product`, `tenant`, `layoutVariant` |
| `ProductGallerySection` | Gallery, lightbox, video player | `product`, `gallery`, `layoutVariant` |
| `ProductPurchaseSection` | Price, variants, quantity, add-to-cart, buy now, fulfillment pane | `product`, `tenant`, `layoutVariant`, `storefrontType` |
| `ProductTypeSection` | **Mini compositor** — composes type-safe sub-components | `product`, `productType`, `layoutVariant`, `storefrontType` |
| `FeaturedProductsSection` | "You might also like", featured type products | `currentProductId`, `tenantId`, `featuredTypes`, `groupedProducts` |
| `ProductBusinessInfoSection` | Contact info, business description | `product`, `tenant`, `layoutVariant` |
| `ProductReviewsSection` | Reviews | `productId`, `tenantId`, `layoutVariant` |
| `ProductFAQSection` | FAQ accordion | `tenantId`, `faqFlags`, `layoutVariant` |
| `ProductRecommendationsSection` | Recommendations + recently viewed | `product`, `tenantId`, `layoutVariant` |

### ProductTypeSection — Mini Compositor

`ProductTypeSection` is a **mini compositor** (analogous to the layout itself), not a leaf component. It receives `productType` and composes the appropriate type-safe sub-components:

```tsx
function ProductTypeSection({ product, productType, layoutVariant, storefrontType }) {
  switch (productType) {
    case 'physical':
      return <>
        <StockStatusInfo product={product} layoutVariant={layoutVariant} />
        <ShippingInfo product={product} layoutVariant={layoutVariant} />
        <ConditionInfo product={product} layoutVariant={layoutVariant} />
      </>;
    case 'digital':
      return <>
        <DigitalDownloadInfo product={product} layoutVariant={layoutVariant} />
        <LicenseInfo product={product} layoutVariant={layoutVariant} />
        <AccessDurationInfo product={product} layoutVariant={layoutVariant} />
      </>;
    case 'service':
      return <>
        <ServiceBookingCTA product={product} layoutVariant={layoutVariant} />
        <ServiceDurationInfo product={product} layoutVariant={layoutVariant} />
        <ServiceAreaInfo product={product} layoutVariant={layoutVariant} />
      </>;
    case 'hybrid':
      return <>
        <StockStatusInfo product={product} layoutVariant={layoutVariant} />
        <DigitalDownloadInfo product={product} layoutVariant={layoutVariant} />
      </>;
  }
}
```

### Type-Safe Sub-Components

`apps/web/src/components/products/type-sections/`:

| Product Type | Sub-components |
|---|---|
| `physical` | `StockStatusInfo`, `ShippingInfo`, `ConditionInfo` |
| `digital` | `DigitalDownloadInfo`, `LicenseInfo`, `AccessDurationInfo` |
| `service` | `ServiceBookingCTA`, `ServiceDurationInfo`, `ServiceAreaInfo` (Phase 2) |
| `hybrid` | `StockStatusInfo` + `DigitalDownloadInfo` (composes both physical + digital) |

### Existing Precedent: `FeaturedTypeProducts`

The featured type system has already blazed this trail. `FeaturedTypeProducts` is already a mini compositor:

- Groups products by `featuredType` → type config registry → `SmartProductCard` (shared leaf)
- Merchant gate filtering happens at the page root before data reaches the component

`ProductTypeSection` follows the same pattern, different axis:
- `FeaturedTypeProducts`: groups by `featuredType` (marketing dimension — how to promote)
- `ProductTypeSection`: groups by `productType` (structural dimension — what to render)

### Success Criterion: Extensibility

Same as the storefront plan — success is measured by how little code changes when expanding:

- Adding **service booking** (e.g., Calendly integration) → only touches `ServiceBookingCTA` + capability key
- Adding **digital delivery** (e.g., Shopify digital downloads) → only touches `DigitalDownloadInfo` + capability key
- Adding **social share buttons** to product pages → only touches `ProductPurchaseSection` (reads `storefrontType` prop)
- Adding a **new product type** (e.g., `subscription`) → new sub-components + one case in `ProductTypeSection`
- Adding a **new product layout** → ~150-line composition file, not 800+ lines of duplicated logic

```
Adding Calendly booking to service products:

BEFORE (current monolith):                    AFTER (modular sections):
─────────────────────────                     ─────────────────────────
1. Add Calendly code to page.tsx (classic)    1. Add Calendly code to ServiceBookingCTA
2. Add Calendly code to ProductShowcaseLayout 2. Add capability key to tier system
3. Add Calendly code to ProductQuickCommerce  3. (done — gating is automatic)
4. Duplicate booking logic × 3
5. Pray no visual regressions

Changes: 3 files, ~300 lines                  Changes: 2 files, ~80 lines
```

---

## Phased Integration Plan

### Phase 0: Extract Shared Sections (Refactor)
**Priority**: P0 — Foundational refactor that establishes the composition pattern for the entire platform
**Estimated effort**: 5-7 days
**Depends on**: Nothing (this is the pattern precedent for all surfaces)

Extract inline rendering from all three product layouts into shared section components. This refactor is the **pattern precedent** — it establishes the monolith → micro components architecture that the storefront plan (Phase 1) will then apply at larger scale. The product page is the smaller surface (3 layouts vs 7), has more existing shared infrastructure (`useProductDetailState`, `layouts/shared/`, `FeaturedTypeProducts` as compositor precedent), and uses the simpler compositor (`ProductTypeSection` switches on 4 product types vs storefront's `resolveStorefrontSections()` mapping capabilities + merchant toggles + tier gates). Prove the pattern here first.

**Layout files to refactor:**
- `page.tsx` (1123 lines — classic inline + shared post-product sections)
- `ProductShowcaseLayout.tsx` (785 lines)
- `ProductQuickCommerceLayout.tsx` (664 lines)

**Tasks**:

#### 0A: Extract ProductHeaderSection
1. Create `apps/web/src/components/products/sections/ProductHeaderSection.tsx`
2. Extract breadcrumb + trust bar from all three layouts
3. Props: `product`, `tenant`, `layoutVariant`
4. `layoutVariant` controls: sticky bar (quick-commerce) vs inline (classic) vs hero-style (showcase)

#### 0B: Extract ProductGallerySection
1. Create `apps/web/src/components/products/sections/ProductGallerySection.tsx`
2. Extract gallery rendering from all three layouts:
   - Classic: inline gallery + lightbox in page.tsx
   - Showcase: sticky gallery + `ProductGallery` / `BasicProductGallery` in ProductShowcaseLayout
   - Quick-commerce: compact gallery in ProductQuickCommerceLayout
3. Props: `product`, `gallery`, `safeFeatures`, `layoutVariant`
4. Contains: `ProductGallery`, `BasicProductGallery`, `ProductImageLightbox`, `SafeImage` fallback
5. `layoutVariant` controls: sticky vs inline, grid vs carousel, aspect ratio

#### 0C: Extract ProductPurchaseSection
1. Create `apps/web/src/components/products/sections/ProductPurchaseSection.tsx`
2. Extract purchase panel from all three layouts:
   - Classic: inline price + variants + quantity + add-to-cart in page.tsx
   - Showcase: split-panel purchase panel in ProductShowcaseLayout
   - Quick-commerce: compact purchase panel in ProductQuickCommerceLayout
3. Props: `product`, `tenant`, `capabilityFlags`, `layoutVariant`, `storefrontType`
4. Contains: price display, variant selector, quantity controls, add-to-cart, buy now, fulfillment pane, `StickyPurchaseBar`
5. `layoutVariant` controls: split-panel vs stacked vs compact
6. `storefrontType` flows through for future social share buttons

#### 0D: Extract ProductTypeSection (mini compositor)
1. Create `apps/web/src/components/products/sections/ProductTypeSection.tsx`
2. Extract product-type-aware rendering from all three layouts
3. Currently only `digital` has explicit type-aware rendering (download info block in page.tsx)
4. Props: `product`, `productType`, `layoutVariant`, `storefrontType`
5. Create type-safe sub-components in `apps/web/src/components/products/type-sections/`:
   - `StockStatusInfo.tsx` — stock status, availability badge
   - `ShippingInfo.tsx` — shipping estimates, fulfillment info
   - `ConditionInfo.tsx` — product condition display
   - `DigitalDownloadInfo.tsx` — download info, delivery method
   - `LicenseInfo.tsx` — license type, terms
   - `AccessDurationInfo.tsx` — access duration, download limit
6. `ProductTypeSection` composes sub-components based on `productType` (see code above)

#### 0E: Extract shared post-product sections
1. Create `apps/web/src/components/products/sections/FeaturedProductsSection.tsx`
   - Wrap existing `FeaturedTypeProducts` — already a shared component
   - Add `layoutVariant` prop for spacing/width control
2. Create `apps/web/src/components/products/sections/ProductBusinessInfoSection.tsx`
   - Extract `ProductBusinessInfoWrapper` + digital product block from page.tsx
   - `layoutVariant` controls: max-width, padding
3. Create `apps/web/src/components/products/sections/ProductReviewsSection.tsx`
   - Extract reviews rendering from page.tsx
4. Create `apps/web/src/components/products/sections/ProductFAQSection.tsx`
   - Extract `FaqProductDisplay` from page.tsx
5. Create `apps/web/src/components/products/sections/ProductRecommendationsSection.tsx`
   - Extract `ProductRecommendations` + `AvailableNearby` + `LastViewed` from page.tsx

#### 0F: Refactor all three layouts to composition
1. Refactor `page.tsx` to composition:
   - Remove all inline section code
   - Import and render section components with `layoutVariant="classic"`
   - Keep data fetching, merchant gate filtering, layout resolution
   - Target: ~200 lines
2. Refactor `ProductShowcaseLayout.tsx` to composition:
   - Remove all inline section code
   - Import and render same section components with `layoutVariant="showcase"`
   - Keep showcase-specific chrome (split panel, sticky gallery)
   - Target: ~150 lines
3. Refactor `ProductQuickCommerceLayout.tsx` to composition:
   - Remove all inline section code
   - Import and render same section components with `layoutVariant="quick-commerce"`
   - Keep quick-commerce-specific chrome (compact layout, sticky purchase bar)
   - Target: ~120 lines

**Files to modify/create**:
- New: `apps/web/src/components/products/sections/ProductHeaderSection.tsx`
- New: `apps/web/src/components/products/sections/ProductGallerySection.tsx`
- New: `apps/web/src/components/products/sections/ProductPurchaseSection.tsx`
- New: `apps/web/src/components/products/sections/ProductTypeSection.tsx`
- New: `apps/web/src/components/products/sections/FeaturedProductsSection.tsx`
- New: `apps/web/src/components/products/sections/ProductBusinessInfoSection.tsx`
- New: `apps/web/src/components/products/sections/ProductReviewsSection.tsx`
- New: `apps/web/src/components/products/sections/ProductFAQSection.tsx`
- New: `apps/web/src/components/products/sections/ProductRecommendationsSection.tsx`
- New: `apps/web/src/components/products/type-sections/StockStatusInfo.tsx`
- New: `apps/web/src/components/products/type-sections/ShippingInfo.tsx`
- New: `apps/web/src/components/products/type-sections/ConditionInfo.tsx`
- New: `apps/web/src/components/products/type-sections/DigitalDownloadInfo.tsx`
- New: `apps/web/src/components/products/type-sections/LicenseInfo.tsx`
- New: `apps/web/src/components/products/type-sections/AccessDurationInfo.tsx`
- Modified: `apps/web/src/app/products/[id]/page.tsx` (refactored to composition)
- Modified: `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` (refactored to composition)
- Modified: `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` (refactored to composition)

**Acceptance criteria**:
- All three layout files are under 250 lines each (composition only, no inline sections)
- A physical product renders identically to before in all three layout variants (no visual regression)
- A digital product renders identically to before in all three layout variants (no visual regression)
- Section components are self-contained, accept `layoutVariant` prop, and render correctly in all three variants
- `ProductTypeSection` correctly composes type-safe sub-components based on `productType`
- TypeScript compiles with zero errors

---

### Phase 1: Service Product Type Section
**Priority**: P1
**Estimated effort**: 2-3 days (reduced — section architecture from Phase 0)
**Depends on**: Phase 0

Add service product type rendering to the product detail page. Service products need booking CTAs, duration display, and service area info — none of which exist today.

**Tasks**:

#### 1A: Create service type-safe sub-components
1. Create `apps/web/src/components/products/type-sections/ServiceBookingCTA.tsx`
   - Booking call-to-action (calendar widget placeholder, "Book Now" button)
   - Props: `product`, `layoutVariant`, `storefrontType`
   - `storefrontType='social'` → add social share buttons ("Share this service")
2. Create `apps/web/src/components/products/type-sections/ServiceDurationInfo.tsx`
   - Display service duration, session length, availability schedule
3. Create `apps/web/src/components/products/type-sections/ServiceAreaInfo.tsx`
   - Display service area, travel radius, on-site vs remote

#### 1B: Add service case to ProductTypeSection
1. Add `case 'service'` to `ProductTypeSection` compositor
2. Compose: `ServiceBookingCTA` + `ServiceDurationInfo` + `ServiceAreaInfo`

#### 1C: Update ProductPurchaseSection for service products
1. When `productType='service'`, purchase panel shows "Book Now" instead of "Add to Cart"
2. Quantity selector becomes session/time slot selector (if applicable)
3. Fulfillment pane shows service-specific info (scheduling, location)

**Files to modify/create**:
- New: `apps/web/src/components/products/type-sections/ServiceBookingCTA.tsx`
- New: `apps/web/src/components/products/type-sections/ServiceDurationInfo.tsx`
- New: `apps/web/src/components/products/type-sections/ServiceAreaInfo.tsx`
- Modified: `apps/web/src/components/products/sections/ProductTypeSection.tsx` (add service case)
- Modified: `apps/web/src/components/products/sections/ProductPurchaseSection.tsx` (service-aware purchase panel)

**Acceptance criteria**:
- A service product renders with booking CTA, duration info, and service area in all three layout variants
- The purchase panel shows "Book Now" for service products
- No regression for physical or digital products

---

### Phase 2: Social Behavior on Product Pages
**Priority**: P2
**Estimated effort**: 3-5 days
**Depends on**: Phase 0, Storefront plan Phase 3

Add social commerce behavior to product pages when `storefrontType='social'`. This is the product-page side of the social behavior overlay — the storefront side is covered in the storefront plan.

**Tasks**:

#### 2A: Social share buttons in ProductPurchaseSection
1. When `storefrontType='social'`, render social share buttons (TikTok, Instagram, Facebook, Pinterest)
2. Gated by `storefront_social` capability key (tier + merchant toggle)
3. `layoutVariant` controls button placement (inline vs floating vs sticky)

#### 2B: Social proof in ProductHeaderSection
1. When `storefrontType='social'`, render social proof badges (engagement metrics, view counts)
2. Gated by `storefrontOptions.showSocialProof` (defaults on for social type)

#### 2C: Shoppable content embeds
1. When `storefrontType='social'`, render shoppable TikTok/Instagram embeds in `ProductGallerySection`
2. Gated by social platform capability keys (`storefront_social_tiktok`, `storefront_social_instagram`, etc.)

#### 2D: Social-aware product recommendations
1. When `storefrontType='social'`, `ProductRecommendationsSection` prioritizes trending/viral products
2. Uses existing `FeaturedTypeProducts` with `trending` bucket type

**Files to modify**:
- Modified: `apps/web/src/components/products/sections/ProductPurchaseSection.tsx` (social share buttons)
- Modified: `apps/web/src/components/products/sections/ProductHeaderSection.tsx` (social proof badges)
- Modified: `apps/web/src/components/products/sections/ProductGallerySection.tsx` (shoppable embeds)
- Modified: `apps/web/src/components/products/sections/ProductRecommendationsSection.tsx` (social-aware recommendations)

**Acceptance criteria**:
- A product on a social storefront shows social share buttons in all three layout variants
- Social features are gated by capability — a non-social storefront doesn't show them
- An online storefront with `showSocialProof` enabled shows social proof badges
- No regression for non-social storefronts

---

### Phase 3: Hybrid Product Type Support
**Priority**: P2
**Estimated effort**: 2-3 days
**Depends on**: Phase 0, Phase 1

Add hybrid product type rendering. Hybrid products are both physical and digital (e.g., a physical book with a digital download companion).

**Tasks**:

#### 3A: Add hybrid case to ProductTypeSection
1. Add `case 'hybrid'` to `ProductTypeSection` compositor
2. Compose: `StockStatusInfo` + `ShippingInfo` + `DigitalDownloadInfo` (physical + digital sub-components)

#### 3B: Update ProductPurchaseSection for hybrid products
1. When `productType='hybrid'`, purchase panel shows both "Add to Cart" (physical) and "Download" (digital) options
2. Fulfillment pane shows both shipping info and download info

**Files to modify**:
- Modified: `apps/web/src/components/products/sections/ProductTypeSection.tsx` (add hybrid case)
- Modified: `apps/web/src/components/products/sections/ProductPurchaseSection.tsx` (hybrid-aware purchase panel)

**Acceptance criteria**:
- A hybrid product renders with both physical and digital info in all three layout variants
- The purchase panel shows both shipping and download options
- No regression for physical, digital, or service products

---

## Implementation Priority Order

| Phase | Priority | Effort | Dependency | Impact |
|-------|----------|--------|------------|--------|
| Phase 0: Section Extraction | P0 | 5-7 days | None | **Pattern precedent** — establishes composition architecture for all surfaces. 3 product layouts → shared sections + type-safe sub-components |
| Phase 1: Service Type | P1 | 2-3 days | Phase 0 | Completes service product type rendering |
| Phase 2: Social Behavior | P2 | 3-5 days | Phase 0, Storefront Phase 3 | Social commerce behavior on product pages |
| Phase 3: Hybrid Type | P2 | 2-3 days | Phase 0, Phase 1 | Completes hybrid product type rendering |

**Total estimated effort**: 12-18 days

**Execution order across both plans:**
```
1. Product Phase 0 (Section Extraction)      ← establishes the pattern (smaller surface, simpler compositor)
2. Storefront Phase 0 (DB Seeding)            ← can run in parallel (no dependency on product)
3. Storefront Phase 1 (Section Extraction)    ← applies proven pattern at scale (7 layouts)
4. Product Phase 1 (Service Type)             ← adds type-safe sub-components
5. Storefront Phase 2 (Service Section)       ← mirrors product page approach
6. Storefront Phase 3 (Social Type)           ← behavior overlay on storefront
7. Product Phase 2 (Social Behavior)          ← follows storefront social
8. Product Phase 3 (Hybrid Type)              ← completes product types
9. Storefront Phase 4 (Cross-Type Polish)     ← consistency across all surfaces
```

---

## Relationship to Existing Plans

- **Storefront Type Integration Plan** (docs/STOREFRONT_TYPE_INTEGRATION_PLAN.md): Companion plan covering the store pipeline (storefront + directory). This plan covers the product pipeline. Both share the same architectural shift (monolith → micro components), capability system, and tier gating. **This plan (Product Phase 0) is the pattern precedent** — it goes first because the product page is the smaller surface (3 layouts vs 7) with more existing shared infrastructure. Storefront Phase 1 then applies the proven pattern at larger scale. Phases are coordinated:
  - Product Phase 0 → Storefront Phase 1 (pattern established here, applied at scale there)
  - Storefront Phase 2 (service) + Product Phase 1 (service) — service type needs `ServiceSection` on storefront and `ServiceBookingCTA` on product page
  - Storefront Phase 3 (social) + Product Phase 2 (social) — social type needs `SocialProofSection` on storefront and social share buttons on product page

- **Social Commerce Integration Plan** (docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md): Phase 2 of this plan adds social behavior to product pages. The Social Commerce Integration Plan adds the actual social platform integrations (TikTok Shop, Meta Commerce, social pixels) that power the shoppable embeds and share buttons.

- **Product Page Layout System** (`apps/web/src/app/products/[id]/layouts/types.ts`): The existing `PRODUCT_LAYOUT_MAP` and `resolveProductLayout()` function are preserved. The refactor changes how layouts render internally, not how they're selected.

- **Featured Type System** (`apps/web/src/components/products/FeaturedTypeProducts.tsx`): Already a mini compositor. `ProductTypeSection` follows the same pattern — type config registry → shared leaf components. The difference is axis: featured types are a marketing dimension, product types are a structural dimension.
