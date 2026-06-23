# Storefront Type Integration Plan

## Architectural Shift: Monolith → Micro Components

This plan transforms the storefront from **monolithic layout files** that each contain all section logic inline, to **micro component sections** composed by thin layout wrappers.

```
BEFORE: Monolith                              AFTER: Micro Components
─────────────────                             ──────────────────────
StorefrontClientWrapper.tsx (1254 lines)      StorefrontClientWrapper.tsx (~150 lines)
  ├── header inline                             ├── <StorefrontHeader layoutVariant="classic" />
  ├── product grid inline                       ├── <ProductSection layoutVariant="classic" />
  ├── store info inline                         ├── <StoreInfoSection layoutVariant="classic" />
  ├── reviews inline                            ├── <ReviewsSection layoutVariant="classic" />
  ├── FAQ inline                                ├── <FAQSection layoutVariant="classic" />
  └── footer inline                             └── <StorefrontFooter layoutVariant="classic" />

StorefrontEditorialLayout.tsx (1103 lines)    StorefrontEditorialLayout.tsx (~200 lines)
  ├── same sections, duplicated                  ├── <StorefrontHeader layoutVariant="editorial" />
  ├── with editorial styling                     ├── <ProductSection layoutVariant="editorial" />
  └── no shared logic                            ├── <StoreInfoSection layoutVariant="editorial" />
                                                 └── ... same sections, different variant

7 layout files × ~1000 lines each              7 layout files × ~150-200 lines each
= ~7000 lines of duplicated logic              + ~500 lines of shared section components
                                               = ~1900 lines total, zero duplication
```

**What changes:**
- **Layout files** become thin composition layers — they import shared sections, pass `layoutVariant`, and add layout-specific chrome (hero banners, sticky bars, dark themes). No section logic.
- **Section components** are self-contained, reusable, and accept `layoutVariant` + `storefrontType` + capability flags. One component, seven layouts.
- **Capability gating** moves from scattered inline conditionals into a single `resolveStorefrontSections()` function. Tier + merchant gates flow through automatically.
- **Store type behavior** becomes a prop (`storefrontType='social'`), not a code path. Sections adjust their rendering emphasis based on the prop.

**What stays the same:**
- Visual appearance — each layout variant looks identical to before
- Data flow — same API calls, same product fetching, same filtering
- Capability system — same tier features, same merchant toggles, same resolver pipeline

**What becomes possible:**
- Adding a new store type integration (e.g., TikTok Shop) touches 1 section component + 1 capability key, not 7 layout files
- Adding a new layout variant (e.g., `premium` for storefront) means writing a ~150-line composition file, not copying 1000+ lines of section logic
- Adding a new product type section (e.g., `SubscriptionSection`) means creating one component and adding it to `resolveStorefrontSections()`, not editing 7 layouts

---

## Audit Summary

The platform defines a `StorefrontType` enum: `'online' | 'retail' | 'service' | 'both' | 'none'` across 6+ files in both API and web apps. A sixth type, `'social'`, was recently introduced conceptually but does not exist in the codebase.

### Current Integration Status

| Type | Enum | Feature Key Check | Settings Radio | DB Seed | Rendering Gates | Verdict |
|------|------|-------------------|----------------|---------|-----------------|---------|
| `retail` | Yes | Yes | Yes | No | 15+ JSX conditionals | Fully integrated |
| `online` | Yes | Yes | Yes | No | 2 conditionals (product pages only) | Partially integrated |
| `service` | Yes | Yes | Yes | No | 0 conditionals (dead variable) | Radio button only |
| `social` | No | No | No | No | 0 (type doesn't exist) | Not implemented |

### Key Findings

1. **`isServiceStore` is computed in 6 files but never used in any conditional rendering.** It's a dead variable — the type flows through the entire capability pipeline but produces zero platform behavior.

2. **`isOnlineStore` has only 2 rendering gates**, both in product detail pages (`ProductBusinessInfoWrapper` hides business info, `ProductQuickCommerceLayout` hides store info accordion). The main storefront page does not differentiate online stores from retail.

3. **`isRetailStore` dominates** with 15+ conditional gates across storefront, directory, product, and landing page surfaces — directory links, shops links, hours display, hours status badge, map, location, GBP category badges, catalog sidebar, storefront recommendations, quick links.

4. **No `storefront_online`, `storefront_retail`, `storefront_service`, or `storefront_social` feature keys are seeded in any SQL migration.** The `StorefrontTypeService.resolveFromFeatures()` checks for these keys, but without DB seeding, the resolver returns `type: 'none'` and `enabled: false`.

5. **`'social'` does not exist** in any type union, enum, feature key, UI option, or rendering logic. The Social Commerce Integration Plan (docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md) proposes social commerce capabilities (TikTok Shop, Meta Commerce) as additions to existing storefront types, not as a new storefront type.

### Capability Pipeline (All Types Share This Flow)

```
tier_features_list (storefront_types capability group)
  -> StorefrontTypeService.resolveStorefrontTypeState()
    -> StorefrontTypeResolver.resolveStorefrontType()
      -> EffectiveCapabilityResolver (effective.storefront)
        -> Frontend UnifiedCapabilityService.getStorefrontState()
          -> useStorefrontState() hook
            -> isRetailStore / isOnlineStore / isServiceStore
              -> JSX conditional rendering (the gap)
```

The pipeline is architecturally complete through the hook layer for `retail`, `online`, and `service`. The gap is in the final step: JSX conditional rendering that differentiates behavior by type.

---

## Platform Recommendations by Storefront Type

Each storefront type has distinct business semantics that should drive platform behavior:

### Retail Storefront
- **Business model**: Physical store, in-person sales, foot traffic
- **Key surfaces**: Business hours, store location, map, directory listing, GBP categories, in-store product catalog, customer reviews
- **Platform behavior**: Show hours/map/location prominently, enable directory listing, display GBP category badges, show catalog sidebar for in-store browsing, show storefront recommendations
- **Checkout**: In-person pickup, local inventory visibility
- **Analytics**: Foot traffic, store visits, hours views, map interactions

### Online Storefront
- **Business model**: E-commerce, digital storefront, shipping-based
- **Key surfaces**: Product catalog, cart/checkout, shipping policies, digital product delivery
- **Platform behavior**: Hide physical store info (hours, map, location), emphasize product catalog and checkout flow, show shipping/return policies prominently, enable online-only product discovery
- **Checkout**: Online payment, shipping calculation, digital delivery
- **Analytics**: Conversion rate, cart abandonment, online orders, shipping performance

### Service Storefront
- **Business model**: Service-based business (consulting, repair, salon, clinic, etc.)
- **Data model**: Services are `inventory_items` rows with `product_type = 'service'` — the platform already supports this. No separate "offerings" table needed. A service storefront shows service-type items from the same `inventory_items` table, rendered as offerings rather than shelf products.
- **Key surfaces**: Service offerings list (filtered `inventory_items` where `product_type = 'service'`), booking/appointment scheduling, service area, staff/provider profiles, testimonials
- **Platform behavior**: Filter catalog to `product_type = 'service'` items only, hide retail-specific UI (catalog sidebar, GBP categories, map/hours), render service items with booking CTA instead of add-to-cart, show service descriptions and pricing, display provider profiles
- **Checkout**: Appointment booking, service deposit, quote-based pricing
- **Analytics**: Booking rate, appointment no-shows, service revenue, provider performance
- **Existing infrastructure**: `product_type` enum includes `service` (schema.prisma:4949), `tenant_product_options_settings.product_service_enabled` defaults to `false` (schema.prisma:4010), settings UI has "Service Products" toggle (ProductOptionsSettingsClient.tsx:290-308), `SingleProductService` passes `productType` to frontend

### Social Storefront
- **Business model**: Social commerce — selling through TikTok Shop, Instagram Shopping, Facebook Shop
- **Key surfaces**: Social feed integration, shoppable posts, social proof/UGC, social share buttons, live shopping events
- **Platform behavior**: Emphasize social platform connectivity, show social proof (follower counts, engagement metrics), enable social sharing, display UGC galleries, support live shopping event embeds, sync product catalog to social platforms
- **Checkout**: Social platform native checkout (TikTok Shop in-app, Instagram Shopping checkout) + platform checkout fallback
- **Analytics**: Social referral traffic, social conversion rate, engagement metrics, cross-platform sales

---

## Public Surface Architecture

The platform has **three public surfaces**, each with multiple layout variants. All three surfaces share the same store type and product type capability model, but each has its own layout pipeline.

### Success Criterion: Extensibility

The success of this architecture is measured by **how little code changes when expanding a store type with a new integration**. For example, adding TikTok Shop integration to the `social` store type should require:

- **Zero changes** to layout composition layers (`StorefrontClientWrapper`, `StorefrontEditorialLayout`, `StorefrontImmersiveLayout`, directory layouts) — they already render `SocialProofSection` and pass `storefrontType='social'` to product sections
- **Zero changes** to `resolveStorefrontSections()` — section visibility is already capability-gated, not type-gated
- **Zero changes** to product-type sections (`ProductSection`, `ServiceSection`, etc.) — they already accept `storefrontType` and render social behavior
- **Minimal changes** to `SocialProofSection` — add TikTok platform badge, follower count source, shoppable feed embed
- **New integration code** — TikTok OAuth flow, catalog sync, order ingestion (covered by Social Commerce Integration Plan)
- **New capability key** — `storefront_social_tiktok` in the tier system, gated by tier + merchant toggle

The tier capability gating flows through automatically: a tier that doesn't include `storefront_social_tiktok` won't see TikTok features in `SocialProofSection`, regardless of store type. A tier that does include it will see TikTok features in any layout variant (classic, editorial, immersive) because all layouts render the same shared sections.

```
Adding TikTok Shop to social store type:

BEFORE (current monolith):                    AFTER (modular sections):
─────────────────────────                     ─────────────────────────
1. Add TikTok code to 3 storefront layouts    1. Add TikTok code to SocialProofSection
2. Add TikTok code to 4 directory layouts     2. Add capability key to tier system
3. Add conditionals per layout for gating     3. (done — gating is automatic)
4. Duplicate social proof logic × 7
5. Pray no visual regressions

Changes: 7 files, ~500 lines                  Changes: 2 files, ~100 lines
```

This principle applies to all future store type expansions:
- Adding **service booking** (e.g., Calendly integration) → only touches `ServiceSection` + capability key
- Adding **digital delivery** (e.g., Shopify digital downloads) → only touches `DigitalSection` + capability key
- Adding **retail POS sync** (e.g., Clover inventory) → only touches `ProductSection` + capability key
- Adding **social platform** (e.g., Pinterest Shopping) → only touches `SocialProofSection` + capability key

### Three Public Surfaces

| Surface | Route | Layouts | Layout Keys | Current Files |
|---|---|---|---|---|
| **Storefront** | `/tenant/[id]` | 3 | `classic`, `editorial`, `immersive` | `StorefrontClientWrapper`, `StorefrontEditorialLayout`, `StorefrontImmersiveLayout` |
| **Product** | `/products/[id]` | 3 | `classic`, `showcase`, `quick-commerce` | `TierBasedLandingPage` (inline), `ProductShowcaseLayout`, `ProductQuickCommerceLayout` |
| **Directory Entry** | `/directory/[slug]` | 4 | `classic`, `editorial`, `immersive`, `premium` | `DirectoryEntryClassicLayout`, `DirectoryEntryEditorialLayout`, `DirectoryEntryImmersiveLayout`, `DirectoryEntryPremiumLayout` |

### Two Rendering Pipelines

```
Store Pipeline (storefront + directory entry)
  layout > store type > product × n

  The store renders a COLLECTION of products.
  - Layout: classic | editorial | immersive (storefront) / + premium (directory)
  - Store type: retail | online | service | social | both
  - Products: all product types the merchant has enabled, filtered by product_type into sections

Product Pipeline (product detail page)
  layout > product type > product × 1

  The product page renders a SINGLE product.
  - Layout: classic | showcase | quick-commerce (derived from storefront layout via PRODUCT_LAYOUT_MAP)
  - Product type: physical | digital | service | hybrid
  - Product: one specific item, rendered with type-aware behavior
```

### Layout Mapping Between Surfaces

The storefront layout determines the product page layout via `PRODUCT_LAYOUT_MAP`:

| Storefront Layout | Product Layout | Directory Layout |
|---|---|---|
| `classic` | `classic` (TierBasedLandingPage) | `classic` |
| `editorial` | `showcase` (ProductShowcaseLayout) | `editorial` |
| `immersive` | `quick-commerce` (ProductQuickCommerceLayout) | `immersive` |
| — | — | `premium` (directory-only, no storefront/product equivalent) |

### Shared Dimensions Across All Surfaces

All three surfaces share the same capability model:

- **Store type** (`retail`, `online`, `service`, `social`, `both`) — sets default emphasis for behavior sections
- **Product type** (`physical`, `digital`, `service`, `hybrid`) — determines which product-type sections render and how individual product cards behave
- **Capability gates** (tier + merchant) — determine what's actually enabled, independent of store type

### Scope of This Plan

This plan covers the **store pipeline** (storefront + directory entry). The product pipeline already has its own layout system (`PRODUCT_LAYOUT_MAP`, `ProductShowcaseLayout`, `ProductQuickCommerceLayout`) and is affected by product-type awareness but is a separate rendering concern.

- **Storefront section extraction** (Phase 1) — refactor storefront layouts to shared sections
- **Directory entry alignment** — directory layouts should consume the same shared sections where applicable
- **Product page product-type awareness** (Phase 2) — product detail pages already receive `productType` and adjust rendering; this is extended for `service` type
- **Social behavior** (Phase 3) — social behavior overlay applies to storefront and product surfaces (social share buttons on product cards, social proof sections on storefront)

### Product Page: Same Shift Needed

The product detail page (`/products/[id]`) has the **same monolith problem** as the storefront:

```
Current product page structure:
  page.tsx (1123 lines)
    ├── Classic layout: inline in page.tsx (~140 lines of JSX)
    ├── Showcase layout: delegates to ProductShowcaseLayout.tsx (785 lines)
    ├── Quick-commerce layout: delegates to ProductQuickCommerceLayout.tsx (664 lines)
    └── Shared post-product sections: inline in page.tsx (~180 lines)
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

**What's duplicated across the 3 product layouts:**
- Gallery rendering (lightbox, image grid, single image fallback)
- Purchase panel (price, variants, quantity selector, add-to-cart, buy now)
- Trust bar / breadcrumb
- Variant selector
- Quantity controls
- Digital product section (download info, license type, access duration)
- Service product section (booking CTA, duration, service area) — **doesn't exist yet**
- Loading skeletons

**What's already shared:**
- `useProductDetailState` hook (16KB — centralizes all state logic)
- `ProductBreadcrumb`, `ProductTrustBar`, `ProductDetailTabs`, `ProductImageLightbox`, `StickyPurchaseBar` (shared components in `layouts/shared/`)

**Proposed product page shift (same pattern as storefront):**

The product page has the same composition hierarchy as the storefront, just nested one level deeper. The layout composes sections; `ProductTypeSection` is a **mini compositor** that composes type-safe sub-components based on `productType`:

```
Store pipeline:
  layout > store type > product × n
  (layout composes sections, store type sets behavior defaults)

Product pipeline:
  layout > product type > type-safe components
  (layout composes sections, ProductTypeSection composes type-safe sub-components)
```

```
BEFORE: Monolith                              AFTER: Micro Components
─────────────────                             ──────────────────────
page.tsx (1123 lines)                         page.tsx (~200 lines)
  ├── classic layout inline                     ├── <ProductHeader layoutVariant="classic" />
  ├── showcase delegates to 785-line file       ├── <ProductGallerySection layoutVariant="classic" />
  ├── quick-commerce delegates to 664-line      ├── <ProductPurchaseSection layoutVariant="classic" />
  └── shared sections inline                    ├── <ProductTypeSection productType="digital" layoutVariant="classic" />
                                                 │   ├── <DigitalDownloadInfo />
                                                 │   ├── <LicenseInfo />
                                                 │   └── <AccessDurationInfo />
                                                 ├── <FeaturedProductsSection />
                                                 ├── <ProductBusinessInfoSection />
                                                 ├── <ProductReviewsSection />
                                                 ├── <ProductFAQSection />
                                                 └── <StorefrontFooter />

ProductShowcaseLayout.tsx (785 lines)         ProductShowcaseLayout.tsx (~150 lines)
  ├── gallery inline                             ├── <ProductHeader layoutVariant="showcase" />
  ├── purchase panel inline                      ├── <ProductGallerySection layoutVariant="showcase" />
  ├── variants inline                            ├── <ProductPurchaseSection layoutVariant="showcase" />
  ├── trust bar inline                           └── <ProductTypeSection productType={product.productType} layoutVariant="showcase" />
  └── digital/service inline                         (mini compositor — same type-safe sub-components,
                                                      different layoutVariant styling)

ProductQuickCommerceLayout.tsx (664 lines)    ProductQuickCommerceLayout.tsx (~120 lines)
  ├── same duplicated                            ├── <ProductHeader layoutVariant="quick-commerce" />
  └── with compact styling                       ├── <ProductGallerySection layoutVariant="quick-commerce" />
                                                 └── <ProductPurchaseSection layoutVariant="quick-commerce" />
```

**Shared product page sections** (`apps/web/src/components/products/sections/`):
- `ProductHeaderSection` — breadcrumb, trust bar, store link
- `ProductGallerySection` — gallery, lightbox, video player
- `ProductPurchaseSection` — price, variants, quantity, add-to-cart, buy now, fulfillment pane
- `ProductTypeSection` — **mini compositor** (not a leaf component). Receives `productType` + `layoutVariant` and composes the appropriate type-safe sub-components:
- `FeaturedProductsSection` — "you might also like", featured type products
- `ProductBusinessInfoSection` — contact info, business description
- `ProductReviewsSection` — reviews
- `ProductFAQSection` — FAQ accordion
- `ProductRecommendationsSection` — recommendations + recently viewed

**Type-safe sub-components** (`apps/web/src/components/products/type-sections/`) — only render for their specific product type, composed by `ProductTypeSection`:

| Product Type | Sub-components |
|---|---|
| `physical` | `StockStatusInfo`, `ShippingInfo`, `ConditionInfo` |
| `digital` | `DigitalDownloadInfo`, `LicenseInfo`, `AccessDurationInfo` |
| `service` | `ServiceBookingCTA`, `ServiceDurationInfo`, `ServiceAreaInfo` (Phase 2) |
| `hybrid` | `StockStatusInfo` + `DigitalDownloadInfo` (composes both physical + digital) |

```tsx
// ProductTypeSection — mini compositor
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

**Why mini compositor, not a switch inside a monolith:**
- Each type-safe sub-component is independently testable
- Adding a new product type (e.g., `subscription`) means adding new sub-components + one case in the compositor — no existing component changes
- Adding a new integration (e.g., Calendly for service booking) means touching `ServiceBookingCTA` only — not the compositor, not the layout, not other type sections
- `layoutVariant` flows through to sub-components for visual styling, same as it flows through to sections from the layout
- `storefrontType` can also flow through for behavior (e.g., social share buttons in `ServiceBookingCTA` when `storefrontType='social'`)

**Existing precedent: `FeaturedTypeProducts`**

The featured type system has already blazed this trail. `FeaturedTypeProducts` (`apps/web/src/components/products/FeaturedTypeProducts.tsx`) is already a mini compositor:

- Groups products by `featuredType` (`sale`, `new_arrival`, `clearance`, `seasonal`, `staff_pick`, `bestseller`, `trending`, etc.)
- Each type has a typed config (icon, label, color, description) defined in a registry (`featuredTypeConfig`)
- Renders type-specific buckets with pill navigation
- Uses `SmartProductCard` as the shared leaf component across all types
- Merchant gate filtering happens at the page root (`filterGroupedProductsByMerchantPreferences`) before data reaches the component — the component itself doesn't gate, it just renders what it's given

This is the same pattern proposed for `ProductTypeSection`:
- `FeaturedTypeProducts`: groups by `featuredType` → type config → `SmartProductCard`
- `ProductTypeSection`: groups by `productType` → type config → type-safe sub-components

The difference is axis: featured types are a **marketing dimension** (how to promote), product types are a **structural dimension** (what to render). Both use the same compositor pattern.

**Key difference from storefront shift:**
- Product page renders a **single product** (`layout > product type > type-safe components`), not a collection
- `ProductTypeSection` is a mini compositor (analogous to the layout itself), not a leaf section
- Type-safe sub-components are leaf components (analogous to sections on the storefront)
- The `storefrontType` prop still flows through for behavior (e.g., social share buttons on the purchase panel)

**This shift is documented in a separate plan:** `docs/PRODUCT_PAGE_INTEGRATION_PLAN.md`

The storefront plan stays focused on the store pipeline (storefront + directory). The product page plan covers the product pipeline with the same architectural goals — monolith → micro components, capability-gated sections, type-safe sub-components composed by a mini compositor. Both plans share the same capability system, store type model, and tier gating.

---

## Storefront Section Architecture

### Problem

The storefront has **three layout variants** that each independently duplicate the same section logic:

| Layout | File | Lines | Status |
|---|---|---|---|
| Classic | `StorefrontClientWrapper.tsx` | 1254 | Monolith with inline sections |
| Editorial | `StorefrontEditorialLayout.tsx` | 1103 | Duplicates same sections with editorial styling |
| Immersive | `StorefrontImmersiveLayout.tsx` | 619 | Duplicates same sections with immersive styling |

All three:
- Import the same components (`EnhancedProductDisplay`, `FeaturedBucketsShowcase`, `ProductSearch`, etc.)
- Derive `isRetailStore`, `isOnlineStore`, `isServiceStore` from the same `useStorefrontState` hook
- Inline their own section rendering with `isRetailStore &&` conditionals
- Have their own StoreInfo, Reviews, FAQ, Recommendations sections with different visual chrome

Adding `service`, `social`, and `digital` behavior to all three layouts independently would triple the work and create drift. **The section components must be shared across all three layouts.**

### Solution: Shared Section Components

Extract each storefront section into a self-contained component. All three layout variants become thin composition layers that render the same sections with different visual styling.

```
Shared Section Components (apps/web/src/components/storefront/sections/)
  ├── StorefrontHeader     (shared — business name, logo, nav pills)
  │
  │   /* Product-type sections — gated by product_options, render for ANY storefront type */
  ├── ProductSection       (product_type='physical' — accepts storefrontType for behavior)
  ├── ServiceSection       (product_type='service' — accepts storefrontType for behavior)
  ├── DigitalSection       (product_type='digital' — accepts storefrontType for behavior)
  ├── HybridSection        (product_type='hybrid' — accepts storefrontType for behavior)
  │
  │   /* Behavior sections — gated by storefront_options (merchant + tier), defaults from storefront_type */
  ├── StoreInfoSection     (default: retail — hours, map, location; any type can enable)
  ├── SocialProofSection   (default: social — platform badges, follower counts, UGC; any type can enable)
  │
  │   /* Shared sections — rendered for all types */
  ├── ReviewsSection       (shared)
  ├── FAQSection           (shared)
  └── StorefrontFooter     (shared — already extracted at layouts/shared/StorefrontFooter.tsx)

Layout Variants (composition layers — consume shared sections)
  ├── StorefrontClientWrapper    (classic — composition only, ~150 lines)
  ├── StorefrontEditorialLayout  (editorial — composition + editorial styling, ~200 lines)
  └── StorefrontImmersiveLayout  (immersive — composition + immersive styling, ~150 lines)
```

**Three orthogonal dimensions:**
- **Product-type sections** (what to sell) — gated by `product_options` settings (merchant toggle + tier capability)
- **Behavior sections** (how to sell) — gated by `storefront_options` settings (merchant toggle + tier capability), with defaults from `storefront_type`
- **Layout variant** (how to display) — gated by `storefront_options.storefrontLayout` (merchant preference)

A `social` storefront defaults to social behavior but can show store info if the merchant enables it. An `online` storefront defaults to hiding store info but can show social proof if the merchant enables it. All types can render all product types.

### Layout-Aware Section Rendering

Each section accepts a `layoutVariant` prop that controls visual chrome (spacing, dividers, background, container width) without changing the content logic:

```tsx
interface StorefrontSectionProps {
  tenantId: string;
  tenant: TenantData;
  products: Product[];        // pre-filtered by product_type
  capabilityFlags: StorefrontOptionFlags;
  storefrontType: StorefrontTypeValue;  // behavior mode — affects how section renders
  layoutVariant: 'classic' | 'editorial' | 'immersive';  // visual styling
}
```

**What changes by layout variant:**
- Container width and padding (`max-w-7xl` vs full-width)
- Section spacing and dividers (gradient lines vs `SectionDivider` vs none)
- Background colors (white/neutral-50 alternating vs dark immersive)
- Header styling (hero banner vs sticky bar vs inline)
- Grid layout (sidebar + content vs full-width grid vs card carousel)

**What stays the same across variants:**
- Which sections render (gated by `resolveStorefrontSections()`)
- Product filtering by `product_type`
- Capability awareness (`isRetailStore`, `showServices`, etc.)
- Component composition (same sub-components used inside)

### Existing Shared Infrastructure

The layouts already share some infrastructure — this pattern should be extended:
- `useStorefrontState` hook (shared state derivation)
- `StorefrontLayoutProps` type (shared props interface)
- `StorefrontFooter` component (already extracted to `layouts/shared/StorefrontFooter.tsx`)
- `TrustSignalsBar`, `SectionDivider`, `StickySearchBar` (shared in `layouts/shared/`)

The section extraction follows the same pattern — move from `layouts/shared/` to `components/storefront/sections/` for sections that are shared across all three layout variants.

### Section Component Contract

Each section component follows the same interface:

```tsx
interface StorefrontSectionProps {
  tenantId: string;
  tenant: TenantData;
  products: Product[];        // pre-filtered by product_type
  capabilityFlags: StorefrontOptionFlags;
  storefrontType: StorefrontTypeValue;
}
```

Each section is:
- **Self-contained** — handles its own rendering, no external conditionals needed
- **Capability-aware** — receives capability flags, decides internally what to show
- **Layout-aware** — accepts `layoutVariant` prop to adjust visual chrome without changing content logic
- **Route-independent** — can be rendered at `/tenant/[id]` (root), `/tenant/[id]/products`, `/tenant/[id]/services`, etc.
- **Reusable across all three layout variants** — Classic, Editorial, and Immersive all consume the same section components

### Composition Layer

All three layout variants become thin orchestrators that render the same shared sections with different `layoutVariant` values:

```tsx
// StorefrontClientWrapper.tsx (classic — ~150 lines)
function StorefrontClientWrapper({ tenantId, tenant, products, ... }) {
  const sections = resolveStorefrontSections({ ... });

  return (
    <>
      <StorefrontHeader tenant={tenant} sections={sections} layoutVariant="classic" />

      {sections.showProducts && (
        <ProductSection tenantId={tenantId} products={physicalProducts} layoutVariant="classic" ... />
      )}
      {sections.showServices && (
        <ServiceSection tenantId={tenantId} products={serviceProducts} layoutVariant="classic" ... />
      )}
      {sections.showStoreInfo && (
        <StoreInfoSection tenantId={tenantId} tenant={tenant} layoutVariant="classic" ... />
      )}

      <ReviewsSection tenantId={tenantId} layoutVariant="classic" />
      <FAQSection tenantId={tenantId} layoutVariant="classic" />
      <StorefrontFooter tenant={tenant} sections={sections} />
    </>
  );
}

// StorefrontEditorialLayout.tsx (editorial — ~200 lines)
function StorefrontEditorialLayout({ tenantId, tenant, products, ... }) {
  const sections = resolveStorefrontSections({ ... });

  return (
    <>
      <StorefrontHeader tenant={tenant} sections={sections} layoutVariant="editorial" />

      {sections.showProducts && (
        <ProductSection tenantId={tenantId} products={physicalProducts} layoutVariant="editorial" ... />
      )}
      {sections.showServices && (
        <ServiceSection tenantId={tenantId} products={serviceProducts} layoutVariant="editorial" ... />
      )}
      {sections.showStoreInfo && (
        <StoreInfoSection tenantId={tenantId} tenant={tenant} layoutVariant="editorial" ... />
      )}

      <ReviewsSection tenantId={tenantId} layoutVariant="editorial" />
      <FAQSection tenantId={tenantId} layoutVariant="editorial" />
      <StorefrontFooter tenant={tenant} sections={sections} />
    </>
  );
}

// StorefrontImmersiveLayout.tsx (immersive — ~150 lines)
// Same pattern, layoutVariant="immersive"
```

The only difference between the three layout files is:
1. The `layoutVariant` prop passed to each section
2. Layout-specific chrome (hero banner for editorial, sticky bar for immersive, etc.)
3. Section ordering (if a layout wants services before products, for example)

The section components internally use `layoutVariant` to adjust their visual presentation.

### Section Resolution

A `resolveStorefrontSections()` function maps effective capabilities to section visibility.

**Key principle: all sections are gated by capability (merchant preference + tier), not by storefront type.**

The storefront type sets the **default emphasis** — what's prioritized and de-emphasized — but does not hard-gate any section. The merchant can enable any behavior on any storefront type if their tier allows it.

- **Product-type sections** (`ProductSection`, `ServiceSection`, `DigitalSection`, `HybridSection`) — gated by `product_options` settings (merchant toggle + tier capability). All storefront types can render all product types.
- **Behavior sections** (`StoreInfoSection`, `SocialProofSection`) — gated by `storefront_options` settings (merchant toggle + tier capability). All storefront types can render any behavior section if enabled.
- **Storefront type** sets defaults — `retail` defaults to showing store info, `social` defaults to showing social proof, `online` defaults to hiding store info — but the merchant can override.

```ts
function resolveStorefrontSections({ storefrontType, productOptions, storefrontOptions, tierCapabilities }) {
  const isRetail = storefrontType === 'retail' || storefrontType === 'both';
  const isOnline = storefrontType === 'online' || storefrontType === 'both';
  const isService = storefrontType === 'service' || storefrontType === 'both';
  const isSocial = storefrontType === 'social';

  return {
    // Product-type sections — gated by product_options (merchant toggle + tier capability)
    // ALL storefront types can render ALL product types
    showProducts: productOptions.product_physical_enabled,
    showServices: productOptions.product_service_enabled,
    showDigital:  productOptions.product_digital_enabled,
    showHybrid:   productOptions.product_hybrid_enabled,

    // Behavior sections — gated by storefront_options (merchant toggle + tier capability)
    // Storefront type sets the DEFAULT, merchant can override
    showStoreInfo: storefrontOptions.showStoreInfo ?? isRetail,        // default: retail shows, others hide
    showSocialProof: storefrontOptions.showSocialProof ?? isSocial,    // default: social shows, others hide
    showCatalogSidebar: storefrontOptions.showCatalogSidebar ?? isRetail,  // default: retail shows
    showDirectoryLinks: storefrontOptions.showDirectoryLinks ?? isRetail,  // default: retail shows
    showShippingPolicies: storefrontOptions.showShippingPolicies ?? isOnline,  // default: online shows

    // Shared sections (always on, unless explicitly disabled)
    showReviews: storefrontOptions.showReviews ?? true,
    showFAQ: storefrontOptions.showFAQ ?? true,
  };
}
```

### Storefront Type as Default Emphasis, Not Hard Gate

The storefront type (`retail`, `online`, `service`, `social`, `both`) sets the **default emphasis** — what's prioritized and what's de-emphasized. It does NOT hard-gate any section. The merchant can enable any behavior on any storefront type if their tier allows it.

All storefront types can render all product types (physical, digital, service, hybrid). All storefront types can render all behavior sections (store info, social proof, catalog sidebar, etc.). The storefront type just sets the starting point.

| Storefront Type | Default emphasis | Default de-emphasis | Can render product types | Can render behavior sections |
|---|---|---|---|---|
| `retail` | Store info, GBP categories, catalog sidebar, directory links | Social proof (unless enabled) | All — whatever merchant enables | All — whatever merchant enables |
| `online` | Shipping/return policies, online checkout | Store info (unless enabled), social proof (unless enabled) | All — whatever merchant enables | All — whatever merchant enables |
| `service` | Service offerings at root, booking CTAs | Store info (unless enabled), catalog sidebar (unless enabled) | All — whatever merchant enables | All — whatever merchant enables |
| `social` | Social proof, share buttons, platform badges, shoppable styling, UGC gallery | Store info (unless enabled) | All — whatever merchant enables | All — whatever merchant enables |
| `both` | Combined retail + online defaults | None | All — whatever merchant enables | All — whatever merchant enables |

**Key insight: `online` and `social` are similar**

Both are non-physical storefront types. The difference is focus, not capability:
- An `online` store emphasizes shipping/return policies and online checkout
- A `social` store emphasizes social proof, share buttons, and platform connectivity
- Both can render social widgets if the merchant enables them and the tier allows it
- Both can render store info if the merchant enables it (e.g., an online store with a warehouse location)
- Both can render any product type: physical, digital, service, hybrid

The capability pipeline (tier gate → merchant gate) determines what's actually enabled. The storefront type just sets the defaults.

**Example: An online store that also wants social proof**

```tsx
// resolveStorefrontSections returns:
// { showProducts: true, showDigital: true, showSocialProof: true, showStoreInfo: false, ... }
// ^ showSocialProof is true because merchant enabled it in storefront_options
// ^ showStoreInfo is false because default for 'online' is false and merchant didn't override

<StorefrontHeader layoutVariant="classic" storefrontType="online" />
{sections.showProducts && (
  <ProductSection products={physicalProducts} storefrontType="online" ... />
)}
{sections.showDigital && (
  <DigitalSection products={digitalProducts} storefrontType="online" ... />
)}
{sections.showSocialProof && (
  <SocialProofSection tenantId={tenantId} storefrontType="online" ... />
  // ^ rendered because merchant enabled it, even though type is 'online' not 'social'
)}
```

**Example: A social store that also shows store info**

```tsx
// resolveStorefrontSections returns:
// { showProducts: true, showServices: true, showSocialProof: true, showStoreInfo: true, ... }
// ^ showStoreInfo is true because merchant enabled it (maybe they have a salon location)

<StorefrontHeader layoutVariant="classic" storefrontType="social" />
{sections.showProducts && (
  <ProductSection products={physicalProducts} storefrontType="social" ... />
  // ^ renders with social share buttons, social proof badges
)}
{sections.showServices && (
  <ServiceSection products={serviceProducts} storefrontType="social" ... />
)}
{sections.showStoreInfo && (
  <StoreInfoSection tenantId={tenantId} storefrontType="social" ... />
  // ^ rendered because merchant enabled it, even though type is 'social' not 'retail'
)}
{sections.showSocialProof && (
  <SocialProofSection tenantId={tenantId} storefrontType="social" ... />
)}
```

Each product-type section accepts `storefrontType` and adjusts its rendering emphasis:
- `storefrontType === 'social'` → product cards emphasize social share buttons, social proof badges, shoppable styling
- `storefrontType === 'retail'` → product cards emphasize stock status, GBP categories, catalog navigation
- `storefrontType === 'online'` → product cards emphasize shipping info, digital delivery badges
- `storefrontType === 'service'` → service cards emphasize booking CTA, duration, service area

But these are emphasis differences, not exclusive behaviors — a `social` product card can still show stock status if the merchant wants it. The `storefrontType` prop sets the default card variant; `storefrontOptions` can override individual elements.

### Product Filtering

The root page fetches all `inventory_items` and filters by `product_type` before passing to sections:

```ts
const physicalProducts = products.filter(p => p.productType === 'physical');
const serviceProducts = products.filter(p => p.productType === 'service');
const digitalProducts = products.filter(p => p.productType === 'digital');
const hybridProducts = products.filter(p => p.productType === 'hybrid');
```

Alternatively, the API can accept a `product_type` filter param for server-side filtering (more efficient for large catalogs).

### Route Mapping

Each section can also be rendered independently at its own route:

| Route | Section rendered | Use case |
|---|---|---|
| `/tenant/[id]` | All enabled sections (composition) | Default storefront |
| `/tenant/[id]/products` | ProductSection only | Dedicated product catalog |
| `/tenant/[id]/services` | ServiceSection only | Dedicated service offerings |
| `/tenant/[id]/digital` | DigitalSection only | Dedicated digital products |

The existing `?products_only=true` param already proves this pattern. The `/services` and `/digital` routes follow the same approach.

### Benefits

- **No 1254-line monolith** — each section is a focused 100-200 line component
- **No scattered conditionals** — `isRetailStore &&` checks disappear, replaced by section composition
- **Type-safe extensibility** — adding a new product type means adding a new section, not editing a monolith
- **Layout-agnostic** — sections can be reused by Editorial, Immersive, or any future layout
- **Testable in isolation** — each section can be unit tested independently
- **Route-flexible** — sections can be rendered at dedicated routes or composed on the root page

---

## Phased Integration Plan

### Phase 0: Database Seeding (All Types)
**Priority**: P0 — Blocks all type-specific behavior
**Estimated effort**: 1-2 days
**Depends on**: Nothing

The capability pipeline cannot resolve any storefront type without feature keys seeded in `tier_features_list`. This is the foundational blocker.

**Tasks**:
1. Create SQL migration to seed `storefront_types` capability group with feature keys:
   - `storefront_online` (all tiers)
   - `storefront_retail` (all tiers)
   - `storefront_service` (all tiers — or tier-gated if desired)
   - `storefront_social` (mid+ tiers — social commerce is a premium capability)
   - `storefront_both_options` (mid+ tiers)
2. Verify `StorefrontTypeService.resolveFromFeatures()` correctly resolves types after seeding
3. Test that `EffectiveCapabilityResolver` returns the correct `effective.storefront.type` for each tier
4. Confirm the settings radio button in `StorefrontTypeOptionsSettingsClient` reflects the resolved type
5. Add `'social'` to the `StorefrontType` enum in all type definition files (API + web)

**Files to modify**:
- New: `database/migrations/0XX_storefront_type_feature_seeds.sql`
- Modified: `apps/api/src/services/StorefrontTypeService.ts` (add `'social'` to enum + resolveFromFeatures)
- Modified: `apps/web/src/services/CapabilityResolutionService.ts` (add `'social'` to type definitions)
- Modified: `apps/web/src/components/settings/StorefrontTypeOptionsSettingsClient.tsx` (add social radio button)

**Acceptance criteria**:
- A tenant on any tier resolves to a non-`none` storefront type when feature keys are present
- A tenant on a mid+ tier with `storefront_social` feature key can resolve to `'social'` type
- The settings page shows the correct selected radio button (including social where available)
- The public storefront page receives the correct `effectiveType` via `PublicStorefrontTypeService`
- The `'social'` type is accepted throughout the type system (enum, resolver, settings, public storefront)

---

### Phase 1: Storefront Section Extraction (Refactor)
**Priority**: P0 — Foundational refactor that all subsequent phases depend on
**Estimated effort**: 7-10 days (increased — 3 storefront + 4 directory layouts must be refactored)
**Depends on**: Phase 0, Product Page Plan Phase 0 (pattern precedent)

Extract the inline sections from all three layout variants into shared section components. This refactor is a prerequisite for Phase 2 (service), Phase 3 (social), and Phase 4 (online completion) because it establishes the composition architecture.

**Pattern precedent**: The product page plan (Phase 0) goes first — it establishes the monolith → micro components pattern on the smaller surface (3 layouts vs 7) with the simpler compositor (`ProductTypeSection` switches on 4 product types vs `resolveStorefrontSections()` mapping capabilities + merchant toggles + tier gates). This phase then applies the proven pattern at larger scale.

**Layout variants to refactor:**

Storefront (3 layouts):
- `StorefrontClientWrapper.tsx` (1254 lines — classic)
- `StorefrontEditorialLayout.tsx` (1103 lines — editorial)
- `StorefrontImmersiveLayout.tsx` (619 lines — immersive)

Directory entry (4 layouts):
- `DirectoryEntryClassicLayout.tsx` (22KB — classic)
- `DirectoryEntryEditorialLayout.tsx` (12KB — editorial)
- `DirectoryEntryImmersiveLayout.tsx` (12KB — immersive)
- `DirectoryEntryPremiumLayout.tsx` (12KB — premium, directory-only)

All currently duplicate the same section logic with different visual styling. The refactor extracts shared sections that accept a `layoutVariant` prop to adjust visual chrome. Directory layouts share most sections with storefront but also have directory-specific elements (related stores, directory actions).

**Tasks**:

#### 1A: Extract ProductSection (product_type='physical')
1. Create `apps/web/src/components/storefront/sections/ProductSection.tsx`
2. Extract product catalog rendering from all three layouts:
   - Classic: lines 836-992 (sidebar + grid)
   - Editorial: product collection section (full-width grid)
   - Immersive: product carousel/grid section
3. Props: `tenantId`, `products` (physical), `categories`, `search`, `pagination`, `capabilityFlags`, `storefrontType`, `layoutVariant`
4. Contains: ProductSearch, ProductCategorySidebar, CategoryMobileDropdown, EnhancedProductDisplay, FeaturedBucketsShowcase, TenantQRCode
5. `layoutVariant` controls: sidebar vs full-width, grid vs carousel, section spacing

#### 1B: Extract StoreInfoSection (retail — hours, map, location)
1. Create `apps/web/src/components/storefront/sections/StoreInfoSection.tsx`
2. Extract store info rendering from all three layouts:
   - Classic: lines 996-1098 (3-col grid: hours, map, contact)
   - Editorial: lines 845-935 (3-col grid with editorial styling)
   - Immersive: inline hours/map in sticky sidebar
3. Props: `tenantId`, `tenant`, `businessHours`, `mapLocation`, `contactInfo`, `capabilityFlags`, `layoutVariant`
4. Contains: BusinessHoursCollapsible, TenantMapSection, GoogleMapEmbed, ContactInformationCollapsible
5. This section is retail-specific — it self-gates on `storefrontType === 'retail' || 'both'`

#### 1C: Extract shared sections (Reviews, FAQ, Header)
1. Create `apps/web/src/components/storefront/sections/ReviewsSection.tsx`
   - Extract from Classic (lines 1155-1160), Editorial (lines 997-1006), Immersive (inline)
   - `layoutVariant` controls: max-width, background, padding
2. Create `apps/web/src/components/storefront/sections/FAQSection.tsx`
   - Extract from Classic (lines 1122-1153), Editorial, Immersive
3. Create `apps/web/src/components/storefront/sections/StorefrontHeader.tsx`
   - Extract header + nav pills from all three layouts
   - `layoutVariant` controls: hero banner (editorial) vs sticky bar (immersive) vs inline (classic)
4. Note: `StorefrontFooter` already exists at `layouts/shared/StorefrontFooter.tsx` — keep as-is

#### 1D: Create resolveStorefrontSections() and refactor storefront layouts
1. Create `apps/web/src/lib/storefront-sections.ts` with `resolveStorefrontSections()` function
2. Refactor `StorefrontClientWrapper.tsx` (classic) to composition:
   - Remove all inline section code
   - Import and render section components with `layoutVariant="classic"`
   - Filter products by `product_type` before passing to sections
   - Target: ~150 lines
3. Refactor `StorefrontEditorialLayout.tsx` (editorial) to composition:
   - Remove all inline section code
   - Import and render same section components with `layoutVariant="editorial"`
   - Keep editorial-specific chrome (hero banner, full-width sections, alternating backgrounds)
   - Target: ~200 lines
4. Refactor `StorefrontImmersiveLayout.tsx` (immersive) to composition:
   - Remove all inline section code
   - Import and render same section components with `layoutVariant="immersive"`
   - Keep immersive-specific chrome (sticky search bar, dark theme, card carousel)
   - Target: ~150 lines

#### 1E: Refactor directory entry layouts to consume shared sections
1. Refactor `DirectoryEntryClassicLayout.tsx` to composition using shared sections with `layoutVariant="classic"`
2. Refactor `DirectoryEntryEditorialLayout.tsx` with `layoutVariant="editorial"`
3. Refactor `DirectoryEntryImmersiveLayout.tsx` with `layoutVariant="immersive"`
4. Refactor `DirectoryEntryPremiumLayout.tsx` with `layoutVariant="premium"` (or keep as-is if sufficiently distinct)
5. Directory layouts share `StoreInfoSection`, `ReviewsSection`, `FAQSection` with storefront but also have directory-specific elements:
   - `DirectoryActions` (share, directions, save)
   - Related stores in directory
   - Directory-specific footer (`PoweredByFooter` vs `StorefrontFooter`)
6. These directory-specific elements can remain inline or be extracted as directory-specific sections

#### 1F: Online store behavior falls out naturally
With sections extracted, online store behavior is achieved by defaulting `showStoreInfo` to `false` for online-only stores. The `resolveStorefrontSections()` function handles this:
- `showStoreInfo: storefrontOptions.showStoreInfo ?? isRetail` — online stores default to hiding store info, but merchant can override
- No need to add `isOnlineStore &&` conditionals throughout the codebase
- All three layout variants automatically respect this — no per-layout conditionals needed
- An online store can still enable store info (e.g., warehouse location) via storefront_options

Also update:
- `useStorefrontState.ts` — derive section flags instead of individual `isRetailStore`/`isOnlineStore`/`isServiceStore` booleans
- Directory page (`directory/[slug]/page.tsx`) — use `resolveStorefrontSections()` for consistency

**Files to modify/create**:
- New: `apps/web/src/components/storefront/sections/ProductSection.tsx`
- New: `apps/web/src/components/storefront/sections/StoreInfoSection.tsx`
- New: `apps/web/src/components/storefront/sections/ReviewsSection.tsx`
- New: `apps/web/src/components/storefront/sections/FAQSection.tsx`
- New: `apps/web/src/components/storefront/sections/StorefrontHeader.tsx`
- New: `apps/web/src/lib/storefront-sections.ts` (resolveStorefrontSections)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` (classic — refactored to composition)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` (editorial — refactored to composition)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` (immersive — refactored to composition)
- Modified: `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryClassicLayout.tsx` (refactored to composition)
- Modified: `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryEditorialLayout.tsx` (refactored to composition)
- Modified: `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryImmersiveLayout.tsx` (refactored to composition)
- Modified: `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryPremiumLayout.tsx` (refactored or kept as-is)
- Modified: `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts`
- Modified: `apps/web/src/app/directory/[slug]/page.tsx`

**Acceptance criteria**:
- All storefront layout files are under 250 lines each (composition only, no inline sections)
- All directory layout files are under 250 lines each (composition + directory-specific elements only)
- A retail store renders identically to before in all storefront layout variants (no visual regression)
- A directory entry renders identically to before in all directory layout variants (no visual regression)
- An online store does not show StoreInfoSection in any storefront or directory layout variant (hours, map, location hidden by default)
- Section components are self-contained, accept `layoutVariant` prop, and render correctly in all variants
- `resolveStorefrontSections()` correctly maps capabilities to section visibility
- All storefront layout variants render the same sections — only visual chrome differs
- All directory layout variants render the same sections — only visual chrome differs
- TypeScript compiles with zero errors

---

### Phase 2: Service Storefront Section
**Priority**: P1
**Estimated effort**: 3-5 days (reduced — section architecture from Phase 1, no new data model)
**Depends on**: Phase 1

`isServiceStore` is computed in 6 files but has zero rendering gates. This is the largest gap — service stores currently render identically to retail stores.

**Key insight**: Services are already modeled as `inventory_items` with `product_type = 'service'`. The platform does not need a separate "offerings" table. A service storefront is a storefront that filters to `product_type = 'service'` items and renders them as service offerings (booking CTA, duration, no shipping) rather than shelf products (add to cart, stock, shipping).

**Existing infrastructure to leverage**:
- `product_type` enum includes `service` (schema.prisma:4949)
- `tenant_product_options_settings.product_service_enabled` toggle (schema.prisma:4010, defaults to `false`)
- Settings UI has "Service Products" toggle with description "Bookable services, appointments, and consultations" (ProductOptionsSettingsClient.tsx:290-308)
- `SingleProductService` already passes `productType` to frontend (SingleProductService.ts:391)
- `inventory_items` table has all fields needed: name, description, price, image_url, metadata (for duration, service area, etc.)

**Tasks**:

#### Storefront Routing Design

The storefront type determines what the main page shows and whether separate sections exist:

| Storefront Type | Root (`/tenant/[id]`) | Products | Services |
|---|---|---|---|
| `retail` | Product catalog (default) | Root page | Hidden |
| `online` | Product catalog (default) | Root page | Hidden |
| `service` | Service offerings (filtered `product_type='service'`) | Hidden | Root page |
| `both` | Combined view with sections | `/tenant/[id]` or `/tenant/[id]/products` | `/tenant/[id]/services` |
| `social` | Social-optimized catalog | Within social grid | Within social grid |

**Key design decisions**:
- **Service-explicit storefront** (`type='service'`): The root URL renders service offerings. No `/products` page. All `inventory_items` are filtered to `product_type='service'`.
- **Hybrid storefront** (`type='both'` with products + services enabled): The root page shows a combined view with a products section and a services section. Navigation links to `/tenant/[id]/products` and `/tenant/[id]/services` for dedicated views.
- **Existing `products_only` param pattern**: The storefront already supports `?products_only=true` for a catalog-only view. A parallel `?services_only=true` param or a `/services` route follows the same pattern.
- **No new database tables** — just URL routing + `product_type` filtering on existing `inventory_items` queries.

#### 2A: Create ServiceSection Component
1. Create `apps/web/src/components/storefront/sections/ServiceSection.tsx`
2. Follows the same section contract as ProductSection (from Phase 1)
3. Renders `inventory_items` where `product_type = 'service'` as service offering cards:
   - Service name, description, price
   - Duration (from `metadata.duration_minutes`)
   - Service area (from `metadata.service_area`)
   - Provider name (from `metadata.provider_name`)
   - "Book Service" CTA (links to `metadata.booking_url` or contact form)
4. No add-to-cart, no stock/quantity, no shipping info
5. Self-gates on `storefrontType === 'service' || 'both'` and `productOptions.product_service_enabled`

#### 2B: Service Offerings Route and Component
1. Create `/tenant/[id]/services` route (`apps/web/src/app/tenant/[id]/services/page.tsx`) — dedicated services page that fetches `inventory_items` where `product_type = 'service'`, rendered as service offerings
2. Create `ServiceOfferingsList` component — renders service items as cards (name, description, price, duration, booking CTA)
3. Reuse existing product fetching infrastructure (mv_storefront_discovery, StorefrontSingletonService) with a `product_type` filter parameter
4. For `both` type storefronts: add navigation links between `/products` (or root) and `/services` sections
5. No new API routes needed — existing public product endpoints already return `product_type`; frontend filters on it. Optionally add a `product_type` query param to the storefront products API for server-side filtering.

#### 2C: Service Storefront Settings
1. When `service` is selected in `StorefrontTypeOptionsSettingsClient`, auto-enable `product_service_enabled` in `tenant_product_options_settings` (or prompt merchant to enable it)
2. When `both` is selected and `product_service_enabled` is on, show both product and service sections in the storefront
3. Add service-specific storefront options to `StorefrontOptionsService` and `StorefrontOptionsResolver` (booking enabled, service area display)

#### 2D: Service Metadata Conventions
1. Define metadata fields for service items in `inventory_items.metadata`:
   - `duration_minutes`: Service duration (e.g., 60, 90, 120)
   - `service_area`: Geographic area served (text or geo)
   - `booking_url`: External booking link (Calendly, Acuity, etc.) — optional
   - `provider_name`: Staff member name — optional
   - `service_category`: Service classification (e.g., "Consulting", "Repair", "Wellness")
2. Document these conventions in the inventory wizard for service-type items

**Files to modify/create**:
- New: `apps/web/src/components/storefront/sections/ServiceSection.tsx` (the service section component)
- New: `apps/web/src/app/tenant/[id]/services/page.tsx` (dedicated services route)
- New: `apps/web/src/components/storefront/BookingCTA.tsx`
- Modified: `apps/web/src/lib/storefront-sections.ts` (add `showServices` to resolveStorefrontSections)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` (add ServiceSection to composition)
- Modified: `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` (service-aware item detail)
- Modified: `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` (service-aware item detail)
- Modified: `apps/web/src/app/t/[tenantId]/settings/storefront-type-options/StorefrontTypeOptionsSettingsClient.tsx`
- Modified: `apps/web/src/app/t/[tenantId]/items/[itemId]/page.tsx` (service-aware item detail rendering)
- Modified: `apps/web/src/components/inventory/wizards/steps/` (service metadata fields in wizard)
- Modified: `apps/web/src/services/StorefrontSingletonService.ts` (add `product_type` filter support)

**No new database tables needed** — services are `inventory_items` with `product_type = 'service'`.

**Acceptance criteria**:
- A service-type store renders service offerings at the root URL (filtered to `product_type = 'service'`)
- A service-type store does not show GBP categories, retail directory links, or retail catalog sidebar
- A `both` type store shows both products and services, with navigation between sections
- The `/tenant/[id]/services` route shows service offerings for `both` type stores
- Service offerings render as cards with name, description, price, duration, and "Book Service" CTA
- Product detail pages for `product_type = 'service'` items show "Book Service" instead of "Add to Cart", hide stock/shipping
- The inventory wizard shows service-specific metadata fields when `product_type = 'service'` is selected

---

### Phase 3: Social Storefront Type (Behavior Overlay)
**Priority**: P2
**Estimated effort**: 6-10 days (reduced — section architecture from Phase 1; social is a behavior overlay, not a new product type)
**Depends on**: Phase 1

`'social'` does not exist in the codebase. This phase introduces it as a first-class storefront type. Unlike `service` (which filters to service-type products), `social` is a **behavior overlay** — it renders whatever product types the merchant has enabled (physical, digital, service, hybrid) with social commerce characteristics.

Social commerce integrations (TikTok Shop, Meta Commerce, social pixels) are covered in the existing Social Commerce Integration Plan and are not duplicated here.

**Key distinction: social is NOT a product type**
- A `social` storefront can sell physical products, digital products, AND services
- The `social` type defaults to social behavior on top of product-type sections:
  - Social share buttons on product cards
  - Social proof badges (follower counts, engagement metrics)
  - Shoppable grid styling optimized for social browsing
  - Platform connectivity badges (connected TikTok/Instagram/Facebook)
  - UGC/social gallery section
- Product-type sections (`ProductSection`, `ServiceSection`, etc.) accept `storefrontType='social'` and adjust their rendering emphasis accordingly
- **Any storefront type can enable social behavior** via `storefront_options.showSocialProof` — an `online` store can show social proof if the merchant enables it and the tier allows it. The `social` type just defaults it on.

**Tasks**:

#### 3A: Type System Extension
1. Add `'social'` to all `StorefrontType` / `StorefrontTypeValue` type unions:
   - `apps/api/src/services/StorefrontTypeService.ts`
   - `apps/api/src/services/resolvers/types.ts`
   - `apps/api/src/services/resolvers/StorefrontTypeResolver.ts`
   - `apps/web/src/services/PublicStorefrontTypeService.ts`
2. Add `storefront_social` feature key to the SQL seed migration (from Phase 0)
3. Update `StorefrontTypeService.resolveFromFeatures()` to check for `storefront_social` feature key
4. Update `StorefrontTypeResolver` to handle `'social'` in type resolution logic
5. Add `'social'` option to `typeOptions` array in `StorefrontTypeOptionsSettingsClient.tsx` with appropriate icon (e.g., `Share2` or `Instagram` from lucide-react)

#### 3B: Social Behavior in Product-Type Sections
1. In `ProductSection`, `ServiceSection`, `DigitalSection`, `HybridSection` — accept `storefrontType` prop and add social behavior when `storefrontType === 'social'`:
   - Render `SocialShareButtons` on each product/service card
   - Show social proof badges (follower count, engagement) if data available from social integrations
   - Use `SocialShoppableGrid` layout variant (optimized for social browsing — wider cards, larger images, social-style overlays)
   - Hide retail-specific elements (GBP categories, catalog sidebar, stock status emphasis)
2. No new product-type sections needed — social reuses the same sections with different behavior

#### 3C: SocialProofSection Component
1. Create `apps/web/src/components/storefront/sections/SocialProofSection.tsx`
2. Follows the same section contract (accepts `layoutVariant`, `storefrontType`)
3. Contains:
   - `SocialPlatformBadges` — connected TikTok/Instagram/Facebook status indicators
   - `SocialProofMetrics` — follower counts, engagement metrics (data from social integrations)
   - `SocialGallery` — UGC/social content grid
4. Gated by `showSocialProof: storefrontOptions.showSocialProof ?? isSocial` in `resolveStorefrontSections()` — defaults on for `social` type, defaults off for others, but any type can enable it
5. Add to composition layer in all three layout variants

#### 3D: Social Storefront Settings
1. Extend `StorefrontTypeOptionsSettingsClient` with social-specific options when `social` is selected:
   - Connected social platforms display
   - Social feed embed toggle
   - UGC gallery toggle
   - Social share button toggle
2. Add social-specific storefront options to `StorefrontOptionsService` and `StorefrontOptionsResolver`

#### 3E: Social Share and Shoppable Components
1. Create `SocialShareButtons` component — share to TikTok/Instagram/Facebook/X (used inside product cards)
2. Create `SocialShoppableGrid` component — product grid variant optimized for social commerce browsing
3. These are sub-components used inside product-type sections when `storefrontType === 'social'`

**Files to modify/create**:
- `apps/api/src/services/StorefrontTypeService.ts`
- `apps/api/src/services/resolvers/types.ts`
- `apps/api/src/services/resolvers/StorefrontTypeResolver.ts`
- `apps/web/src/services/PublicStorefrontTypeService.ts`
- `apps/web/src/app/t/[tenantId]/settings/storefront-type-options/StorefrontTypeOptionsSettingsClient.tsx`
- Modified: `apps/web/src/components/storefront/sections/ProductSection.tsx` (add social behavior)
- Modified: `apps/web/src/components/storefront/sections/ServiceSection.tsx` (add social behavior)
- Modified: `apps/web/src/lib/storefront-sections.ts` (add `showSocialProof` to resolveStorefrontSections)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` (add SocialProofSection to composition)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` (add SocialProofSection)
- Modified: `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` (add SocialProofSection)
- Modified: `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts`
- New: `apps/web/src/components/storefront/sections/SocialProofSection.tsx`
- New: `apps/web/src/components/storefront/SocialShareButtons.tsx`
- New: `apps/web/src/components/storefront/SocialShoppableGrid.tsx`
- New: `apps/web/src/components/storefront/SocialPlatformBadges.tsx`

**Acceptance criteria**:
- `'social'` appears as a selectable option in the storefront type settings radio button list
- A social-type store renders physical products, digital products, AND services (whatever the merchant has enabled) with social behavior
- Product cards in a social storefront show social share buttons and social proof badges
- A social storefront shows `SocialProofSection` (platform badges, follower counts, UGC gallery)
- A social storefront does not show retail-specific features (map, hours, GBP categories, directory links) unless also configured as `both`
- The same `ProductSection` component renders differently for `storefrontType='retail'` vs `storefrontType='social'` — behavior is driven by the prop, not by separate components
- All three layout variants (classic, editorial, immersive) support the social storefront type
- The type flows correctly through the entire capability pipeline (feature key -> resolver -> effective capability -> frontend hook -> rendering)
- Social commerce integrations (TikTok Shop, Meta Commerce) connect to this storefront type as defined in SOCIAL_COMMERCE_INTEGRATION_PLAN.md

---

### Phase 4: Cross-Type Polish and Consistency
**Priority**: P2
**Estimated effort**: 3-5 days
**Depends on**: Phases 1, 2, 3

Ensure all types behave consistently across all rendering surfaces and edge cases are handled.

**Tasks**:
1. Audit all rendering surfaces for type-aware behavior:
   - Storefront page (StorefrontClientWrapper)
   - Editorial layout
   - Immersive layout
   - Directory page
   - Product detail pages (Showcase + QuickCommerce layouts)
   - Landing page (TierBasedLandingPage)
   - Product business info wrapper
2. Ensure `both` type correctly combines features from multiple types
3. Add type-specific analytics events (e.g., `storefront_type_viewed`, `service_menu_viewed`, `social_share_clicked`)
4. Add type-specific SEO metadata (e.g., service businesses get "Service" in page title, social stores get social platform meta tags)
5. Test all type combinations: `retail`, `online`, `service`, `social`, `both`, `none`
6. Document the storefront type behavior matrix in docs

**Acceptance criteria**:
- All 6 type values render correctly across all surfaces
- `both` type shows combined features without conflicts
- `none` type shows a minimal/placeholder storefront
- Analytics events fire correctly for each type
- SEO metadata is type-appropriate

---

## Type Combination Matrix

The `both` type currently means "retail + online". With the addition of `service` and `social`, the platform needs to decide how `both` behaves:

### Option A: `both` remains "retail + online" only
- Service and social are standalone types
- Tenants who are retail + service would need a new composite type or multi-select
- Simplest to implement, but limiting

### Option B: `both` becomes "all enabled types"
- `both` shows features from all types the tenant's tier allows
- More flexible, but may create confusing UX (e.g., showing product catalog + service menu + social gallery simultaneously)
- Requires careful UI layout to avoid clutter

### Option C: Multi-select replaces single `both`
- Replace radio buttons with checkboxes for enabled types
- `StorefrontType` becomes `StorefrontType[]` (array of selected types)
- Most flexible, but requires schema change and pipeline refactor
- Recommended for long-term scalability

**Recommendation**: Start with Option A for Phase 2 and 3 (simplest, no breaking changes). Plan for Option C as a future enhancement when tenants need combinations beyond retail + online.

---

## Implementation Priority Order

| Phase | Priority | Effort | Dependency | Impact |
|-------|----------|--------|------------|--------|
| Phase 0: DB Seeding | P0 | 1-2 days | None | Unblocks all type behavior |
| Phase 1: Section Extraction | P0 | 7-10 days | Phase 0, Product Phase 0 | Applies proven pattern at scale — 3 storefront + 4 directory layouts → shared sections |
| Phase 2: Service Section | P1 | 3-5 days | Phase 1, Product Phase 1 | Completes service type (no new tables, works in all 3 layouts) |
| Phase 3: Social Type (Behavior) | P2 | 6-10 days | Phase 1 | Social behavior overlay on any product type |
| Phase 4: Cross-Type Polish | P2 | 3-5 days | Phases 2-3, Product Phases 1-3 | Consistency and edge cases across all surfaces |

**Total estimated effort**: 20-32 days

---

## Relationship to Existing Plans

- **Product Page Integration Plan** (docs/PRODUCT_PAGE_INTEGRATION_PLAN.md): Companion plan covering the product pipeline (`layout > product type > type-safe components`). Same architectural shift (monolith → micro components), same capability system, same tier gating. **Product Phase 0 is the pattern precedent** — it goes first on the smaller surface (3 layouts vs 7) with the simpler compositor. Storefront Phase 1 then applies the proven pattern at larger scale. This plan covers the store pipeline (storefront + directory); that plan covers the product detail page. Phases are coordinated:
  - Product Phase 0 → Storefront Phase 1 (pattern established there, applied at scale here)
  - Storefront Phase 2 (service) + Product Phase 1 (service) — service type needs `ServiceSection` on storefront and `ServiceBookingCTA` on product page
  - Storefront Phase 3 (social) + Product Phase 2 (social) — social type needs `SocialProofSection` on storefront and social share buttons on product page

- **Social Commerce Integration Plan** (docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md): Phase 3 of this plan creates the `'social'` storefront type and rendering behavior. The Social Commerce Integration Plan adds the actual social platform integrations (TikTok Shop, Meta Commerce, social pixels) that connect to this type. They are complementary — this plan creates the type system and rendering; that plan adds the commerce capabilities.

- **Feature Flag Registry** (docs/feature-flags/registry.yaml): No existing feature flags for storefront types. Phase 0 should add `storefront_types` capability group entries to the tier system (not feature flags — these are tier capabilities, not feature flags).

- **Storefront Options System**: The existing `StorefrontOptionsService` and `StorefrontOptionsResolver` handle merchant-controlled display options (show hours, show map, etc.). Phases 1-3 should extend this system with type-specific options rather than creating a parallel system.
