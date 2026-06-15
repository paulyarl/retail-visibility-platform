# Product Page Layout Enhancement Plan

## Merchant-Selectable Product Detail Layouts: Architecture & Design Specification

> **Version**: 1.0  
> **Date**: 2026-06-14  
> **Scope**: Customer-facing product detail page (`/products/[id]`)  
> **Companion**: [STOREFRONT_LAYOUT_ENHANCEMENT_PLAN.md](./STOREFRONT_LAYOUT_ENHANCEMENT_PLAN.md)  
> **Approach**: Preserve all existing components; introduce two new layout compositions; gate by tier + merchant preference; share layout selection with storefront

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Design Principles](#3-design-principles)
4. [Layout System Architecture](#4-layout-system-architecture)
5. [Layout A — Classic (Current)](#5-layout-a--classic-current)
6. [Layout B — Product Showcase](#6-layout-b--product-showcase)
7. [Layout C — Quick Commerce](#7-layout-c--quick-commerce)
8. [Shared Component Enhancements](#8-shared-component-enhancements)
9. [Mobile-First UX Patterns](#9-mobile-first-ux-patterns)
10. [Visual Polish & Design Token Additions](#10-visual-polish--design-token-additions)
11. [Tier & Capability Gating](#11-tier--capability-gating)
12. [Technical Implementation](#12-technical-implementation)
13. [Phased Rollout Plan](#13-phased-rollout-plan)
14. [File Manifest](#14-file-manifest)

---

## 1. Executive Summary

This plan introduces **merchant-selectable product detail page layouts** that work in concert with the storefront layout system. When a merchant selects a storefront layout (Classic, Editorial, or Immersive), the product page automatically adopts the corresponding product layout:

| Storefront Layout | Product Layout | Tier Availability | Design Philosophy |
|---|---|---|---|
| **Classic** | **Classic** (A) | All tiers (default) | Single-column card stack; current behavior preserved |
| **Editorial** | **Product Showcase** (B) | Growth+ | Split-panel with large gallery left, purchase panel right; storytelling emphasis |
| **Immersive** | **Quick Commerce** (C) | Pro+ | Dense, above-the-fold purchase flow; sticky cart; tabbed details |

**Key constraints:**
- Zero changes to existing `TierBasedLandingPage.tsx` (1,959 lines) or `page.tsx` (861 lines)
- All three layouts compose the **same component library** — no duplication
- Layout selection is inherited from the storefront layout preference (single merchant setting)
- Each product layout is a separate wrapper, selected at the `page.tsx` level

---

## 2. Current State Analysis

### 2.1 Current File Structure

```
apps/web/src/
├── app/products/[id]/
│   ├── page.tsx                        # Server component (861 lines) — data fetching, SEO, composition
│   └── not-found.tsx                   # 404 page (21 lines)
├── components/landing-page/
│   └── TierBasedLandingPage.tsx        # Client component (1,959 lines) — the product detail renderer
├── components/products/                 # 39 product-specific components
│   ├── ProductGallery.tsx              # Carousel with thumbnails (126 lines)
│   ├── BasicProductGallery.tsx         # Simpler gallery for lower tiers
│   ├── PriceDisplay.tsx                # Price with sale/savings (63 lines)
│   ├── AddToCartButton.tsx             # Multi-cart add/buy (290 lines)
│   ├── ProductVariantSelector.tsx      # Dynamic variant picker (458 lines)
│   ├── VariantPopupModal.tsx           # Variant quick-select modal (268 lines)
│   ├── ProductRecommendations.tsx      # "You might also like" (140 lines)
│   ├── ProductReviewsSection.tsx       # Review display wrapper (18 lines)
│   ├── LocationAvailabilitySection.tsx # Multi-location stock (435 lines)
│   ├── AvailableNearby.tsx             # Cross-tenant discovery (198 lines)
│   ├── ProductActions.tsx              # Share/Print/Like actions
│   ├── ProductBusinessInfoWrapper.tsx  # Business info collapsible
│   ├── FeaturedTypeProducts.tsx        # Featured products by type
│   ├── FeaturedTypeBadges.tsx          # Featured type badges
│   └── ... (25 more components)
└── services/                           # Data services used by page.tsx
```

### 2.2 Current Page Composition (Layout A)

The product page has **two layers of composition**:

**Layer 1: `page.tsx` (Server Component)** orchestrates the outer shell:

```
┌─────────────────────────────────────────────────────────┐
│ SEO META + STRUCTURED DATA (JSON-LD)                    │
│ ProductViewTracker                                       │
├─────────────────────────────────────────────────────────┤
│ STICKY HEADER                                           │
│  Store Logo + Store Name + Category                      │
│  DirectoryActions (desktop)                              │
│  Mobile Navigation Pills                                 │
├─────────────────────────────────────────────────────────┤
│ NON-PUBLIC ALERT (conditional)                          │
│  Draft/Archived/Private warning banner                   │
├─────────────────────────────────────────────────────────┤
│ TWO-COLUMN LAYOUT                                       │
│  ┌────────────────┬────────────────────────────────────┐│
│  │ SIDEBAR        │ MAIN CONTENT                       ││
│  │ (Desktop)      │                                    ││
│  │                │ TierBasedLandingPage                ││
│  │ Categories     │  (the entire product detail)       ││
│  │ QR Code        │                                    ││
│  │                │                                    ││
│  │ [Mobile:       │                                    ││
│  │  Dropdown]     │                                    ││
│  └────────────────┴────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ ProductPageStatusWrapper (gates below content)          │
│  ├── ProductBusinessInfoWrapper                         │
│  ├── FeaturedTypeProducts                               │
│  ├── AvailableNearby (conditional)                      │
│  ├── ProductRecommendations                             │
│  ├── FaqProductDisplay (conditional)                    │
│  ├── PublicInquiryForm (conditional)                    │
│  └── ProductReviewsSection                              │
├─────────────────────────────────────────────────────────┤
│ LastViewed                                              │
│ PoweredByFooter                                         │
└─────────────────────────────────────────────────────────┘
```

**Layer 2: `TierBasedLandingPage.tsx` (Client Component)** renders the product detail within a `max-w-4xl` single column:

```
┌──────────────────────────────────────────┐
│ PRODUCT GALLERY (full-width card)        │
│  ProductGallery or BasicProductGallery   │
│  or single image fallback                │
├──────────────────────────────────────────┤
│ FEATURED TYPE BADGES                     │
│  Jump links to featured sections         │
├──────────────────────────────────────────┤
│ PRODUCT ACTIONS                          │
│  Share, Print, Like, Hours, Location     │
├──────────────────────────────────────────┤
│ PRODUCT INFO CARD                        │
│  Title, Brand, Manufacturer, Condition   │
│  Category badge link                     │
│  ├── Availability Status                 │
│  ├── Product Type Badge                  │
│  ├── Standard Description                │
│  └── Marketing Description (tier-gated)  │
├──────────────────────────────────────────┤
│ ENRICHED DATA (conditional sections)     │
│  Ingredients, Nutrition, Allergens       │
├──────────────────────────────────────────┤
│ KEY FEATURES                             │
│  Checkmark list of features              │
├──────────────────────────────────────────┤
│ ENVIRONMENTAL INFO                       │
├──────────────────────────────────────────┤
│ PRODUCT SPECIFICATIONS                   │
│  Key-value definition list               │
├──────────────────────────────────────────┤
│ VARIANT SELECTOR                         │
│  Swatches / Buttons / Dropdown           │
├──────────────────────────────────────────┤
│ PRICE DISPLAY                            │
│  Price, sale price, savings badge        │
│  SKU number                              │
├──────────────────────────────────────────┤
│ ADD TO CART                              │
│  Quantity selector                       │
│  Add to Cart + Buy Now buttons           │
├──────────────────────────────────────────┤
│ PRODUCT IDENTIFIERS (UPC, GTIN, MPN)    │
├──────────────────────────────────────────┤
│ LOCATION AVAILABILITY                    │
│  Multi-location stock checker            │
├──────────────────────────────────────────┤
│ CUSTOM CTA (tier-gated)                  │
├──────────────────────────────────────────┤
│ QR CODE                                  │
├──────────────────────────────────────────┤
│ FULFILLMENT OPTIONS                      │
├──────────────────────────────────────────┤
│ BROWSE ALL PRODUCTS CTA                  │
└──────────────────────────────────────────┘
```

### 2.3 Current Pain Points

| Area | Issue | Impact |
|------|-------|--------|
| **Gallery / Purchase split** | Gallery and price/cart are separated by 6+ card sections; user must scroll past title, description, specs, variants to reach "Add to Cart" | Severe conversion friction; purchase action is ~3-4 scrolls below gallery |
| **Single-column only** | `max-w-4xl` single column on desktop wastes 40% of viewport width | Product images and purchase info can never be viewed simultaneously |
| **No sticky cart (mobile)** | Add to Cart button scrolls away; user must scroll back to buy | Lost impulse purchases on mobile |
| **Trust signals buried** | Reviews section is the last item before footer | Rating/review count should be visible within first viewport |
| **Variant → Price → Cart ordering** | Variants appear below specs/features instead of directly above price | User selects variant, then must scroll to see price impact |
| **Uniform card styling** | Every section is `bg-white rounded-lg shadow-sm p-6 mb-6` | No visual hierarchy; all sections feel equally important |
| **Description before cart** | Full description + marketing copy sit between gallery and purchase actions | Details should be available but not blocking the purchase path |
| **Monolithic component** | `TierBasedLandingPage.tsx` is 1,959 lines with inline QR logic, tier color palettes, and product rendering | Hard to maintain; new layout variants would require duplication |
| **Breadcrumb missing** | No breadcrumb trail (Store > Category > Product) | Users lose navigation context |
| **No image zoom** | Gallery has a "zoom" button that opens image in new window | Should be inline lightbox/modal with pinch-to-zoom on mobile |

---

## 3. Design Principles

Aligned with the [Storefront Layout Enhancement Plan](./STOREFRONT_LAYOUT_ENHANCEMENT_PLAN.md#3-design-principles). Additional product-page-specific principles:

### 3.1 Purchase Path Optimization
- **Above-the-fold purchase flow**: Gallery + Price + Cart visible without scrolling on desktop
- **3-click purchase**: View product → Select variant → Add to Cart (no intermediate scrolling)
- **Progressive detail disclosure**: Summary first; full specs on demand (tabs, accordions, expand)

### 3.2 Visual Hierarchy for Commerce
- **Primary zone**: Gallery + Price + Variant + Cart (60% of visual weight)
- **Secondary zone**: Description, Features, Specs (available on demand)
- **Tertiary zone**: Reviews, Recommendations, FAQ, Inquiry (below the fold)
- **Trust reinforcement**: Rating stars, stock count, and store badges near the purchase action

### 3.3 Cross-Device Purchase Consistency
- **Desktop**: Split-panel (gallery left, purchase right) or full-width with sticky sidebar
- **Tablet**: Stacked but compact; purchase area visible after minimal scroll
- **Mobile**: Sticky bottom bar with price + "Add to Cart"; full details on scroll

---

## 4. Layout System Architecture

### 4.1 Unified Layout Selection

The product page layout is **derived from the storefront layout preference** — merchants don't need a separate setting. One choice controls both pages:

```
Merchant selects "Editorial" storefront → Product page uses "Showcase" layout
Merchant selects "Immersive" storefront → Product page uses "Quick Commerce" layout
Merchant selects "Classic" storefront  → Product page uses "Classic" layout (default)
```

The mapping is defined as:

```typescript
const PRODUCT_LAYOUT_MAP = {
  classic: 'classic',
  editorial: 'showcase',
  immersive: 'quick-commerce',
} as const;
```

### 4.2 Layout Router in page.tsx

The same layout routing pattern as the storefront plan:

```
page.tsx (Server Component)
  ├── Fetch product, tenant, capabilities (existing)
  ├── Fetch storefrontLayout from storefront options (via optFlags)
  ├── Map to product layout
  └── Render:
      ├── 'classic'        → Current composition (existing, untouched)
      ├── 'showcase'       → ProductShowcaseLayout.tsx (NEW)
      └── 'quick-commerce' → ProductQuickCommerceLayout.tsx (NEW)
```

### 4.3 Component Extraction Strategy

Instead of duplicating `TierBasedLandingPage.tsx` (1,959 lines), we extract its **logic** into a shared hook and its **sections** into composable pieces:

```
TierBasedLandingPage.tsx (PRESERVED — Layout A only)
  ↓ extract logic into
useProductDetailState.ts (NEW — shared hook)
  ↓ consumed by
ProductShowcaseLayout.tsx     (Layout B — recomposes existing components)
ProductQuickCommerceLayout.tsx (Layout C — recomposes existing components)
```

The shared hook provides:
- Pricing calculations (current price, variant range, sale logic)
- Variant state management (selected variant, stock, availability)
- Feature flag resolution (tier features, commerce capability, payment gateway)
- Status panel logic (show/hide based on subscription)
- Branding resolution (logo, colors, display name)

### 4.4 New File Structure

```
apps/web/src/
├── app/products/[id]/
│   ├── page.tsx                              # MODIFIED: layout router switch added
│   ├── not-found.tsx                         # PRESERVED
│   ├── ProductShowcaseLayout.tsx             # NEW: Layout B
│   ├── ProductQuickCommerceLayout.tsx        # NEW: Layout C
│   └── layouts/
│       ├── shared/
│       │   ├── ProductBreadcrumb.tsx          # NEW: Store > Category > Product
│       │   ├── ProductTrustBar.tsx            # NEW: ★ 4.8 · 127 reviews · In Stock
│       │   ├── StickyPurchaseBar.tsx          # NEW: mobile sticky cart bar
│       │   ├── ProductDetailTabs.tsx          # NEW: tabbed description/specs/reviews
│       │   ├── ProductImageLightbox.tsx       # NEW: fullscreen image modal with zoom
│       │   └── QuickAddPanel.tsx              # NEW: compact purchase panel
│       └── hooks/
│           └── useProductDetailState.ts       # NEW: extracted shared logic
├── components/landing-page/
│   └── TierBasedLandingPage.tsx              # PRESERVED (Layout A, untouched)
└── components/products/                       # PRESERVED: all existing components
```

---

## 5. Layout A — Classic (Current)

### 5.1 Changes: None

`TierBasedLandingPage.tsx` and the current `page.tsx` composition are **preserved exactly as-is**. This remains the default for all tiers.

### 5.2 Optional Polish Pass (Non-Breaking)

| Enhancement | Current | Proposed | Impact |
|-------------|---------|----------|--------|
| Section spacing variation | Uniform `mb-6` | Alternate `mb-4` (minor) / `mb-8` (major sections) | Better rhythm |
| Card hover on interactive cards | No hover effects | `hover:shadow-md transition-shadow` on variant/cart cards | Clearer affordance |
| Gallery max height | `h-96` fixed | `h-96 lg:h-[32rem]` on desktop | Larger images on big screens |
| Add breadcrumb | None | Add `ProductBreadcrumb` above gallery (shared component) | Navigation context |

---

## 6. Layout B — Product Showcase

### 6.1 Design Philosophy

Inspired by premium e-commerce brands (Apple Store, Dyson, Allbirds). Prioritizes **large product imagery**, a clean purchase panel, and storytelling through progressive disclosure. Best for merchants with strong photography and products that benefit from visual presentation.

### 6.2 Visual Language

- **Layout**: Two-column split panel on desktop (55% gallery / 45% details)
- **Color**: Clean white canvas; accent color from store branding
- **Typography**: Generous sizing for title (`text-3xl lg:text-4xl`); relaxed body copy
- **Spacing**: Generous — `py-12 lg:py-16` between major sections
- **Cards**: Minimal borders; content differentiated by spacing, not containers
- **Images**: Large, immersive; lightbox on click; sticky on scroll (desktop)

### 6.3 Page Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ BREADCRUMB BAR                                                   │
│  Store Logo · Store Name > Category > Product Name               │
│  ★ 4.8 (127 reviews) · In Stock · Free Shipping (trust signals)│
├─────────────────────────────────────────────────────────────────┤
│ SPLIT PANEL (desktop: 2-col; mobile: stacked)                   │
│ ┌─────────────────────────┬─────────────────────────────────┐   │
│ │                         │                                 │   │
│ │   PRODUCT GALLERY       │   PURCHASE PANEL                │   │
│ │   (sticky on desktop)   │                                 │   │
│ │                         │   Featured Type Badges           │   │
│ │   Large main image      │   Product Title (large)          │   │
│ │   + thumbnail strip     │   Brand · Condition              │   │
│ │                         │   Category badge                 │   │
│ │   Click to open         │                                 │   │
│ │   lightbox              │   ── Price Display ──            │   │
│ │                         │   Sale badge + savings           │   │
│ │                         │                                 │   │
│ │                         │   ── Variant Selector ──         │   │
│ │                         │   Swatches / Buttons             │   │
│ │                         │                                 │   │
│ │                         │   ── Availability ──             │   │
│ │                         │   In Stock (24 units)            │   │
│ │                         │                                 │   │
│ │                         │   ── Quantity + Cart ──           │   │
│ │                         │   [−] 1 [+]                      │   │
│ │                         │   [Add to Cart] [Buy Now]        │   │
│ │                         │                                 │   │
│ │                         │   ── Quick Info ──               │   │
│ │                         │   SKU · Product Type             │   │
│ │                         │   Fulfillment Options            │   │
│ │                         │   QR Code (compact)              │   │
│ └─────────────────────────┴─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ PRODUCT DETAIL TABS (full-width, bg-white)                      │
│  [Description] [Specifications] [Features] [Nutrition/Allergens]│
│                                                                  │
│  Active tab content rendered below                               │
│  Uses: product.description, product.specifications,              │
│        product.features, product.ingredients, etc.               │
├─────────────────────────────────────────────────────────────────┤
│ PRODUCT ACTIONS BAR                                             │
│  Share · Print · Like · Store Hours · Location                   │
│  Uses: ProductActions component                                  │
├─────────────────────────────────────────────────────────────────┤
│ BUSINESS INFO (collapsible, bg-neutral-50)                      │
│  About the Store + Contact + Map                                 │
│  Uses: ProductBusinessInfoWrapper                                │
├─────────────────────────────────────────────────────────────────┤
│ FEATURED PRODUCTS (horizontal carousel)                         │
│  "More from this store" — FeaturedTypeProducts (carousel mode)  │
├─────────────────────────────────────────────────────────────────┤
│ AVAILABLE NEARBY (conditional)                                  │
│  Cross-tenant discovery — AvailableNearby                        │
├─────────────────────────────────────────────────────────────────┤
│ MULTI-LOCATION AVAILABILITY (conditional)                       │
│  LocationAvailabilitySection                                     │
├─────────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS (grid)                                          │
│  "You might also like" — ProductRecommendations                  │
├─────────────────────────────────────────────────────────────────┤
│ REVIEWS (full-width, bg-neutral-50)                             │
│  ProductReviewsSection with rating summary prominent             │
├─────────────────────────────────────────────────────────────────┤
│ FAQ + INQUIRY (side-by-side on desktop)                         │
│  FaqProductDisplay · PublicInquiryForm                            │
├─────────────────────────────────────────────────────────────────┤
│ RECENTLY VIEWED + FOOTER                                        │
│  LastViewed · PoweredByFooter                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Key Differences from Classic

| Aspect | Classic (A) | Showcase (B) |
|--------|-------------|---------------|
| **Gallery + Cart** | Sequential (scroll through 6+ sections) | Side-by-side on desktop; gallery sticky |
| **Layout** | Single column, `max-w-4xl` | Two-column split, `max-w-7xl` |
| **Variant → Price → Cart** | Separated by specs/features | Adjacent in purchase panel (no scrolling) |
| **Description/Specs** | Inline cards stacked vertically | Tabbed interface — one section visible at a time |
| **Trust signals** | Rating buried at bottom | Inline in breadcrumb bar + near purchase panel |
| **Image interaction** | Open in new window | Inline lightbox modal with zoom |
| **Mobile purchase** | Scroll to find cart button | Sticky bottom bar with price + Add to Cart |
| **Breadcrumb** | None | Full: Store > Category > Product |
| **Gallery size** | `h-96` (384px) | `h-[32rem]` (512px) on desktop, sticky on scroll |

### 6.5 Component Mapping

| Showcase Section | Existing Components Used |
|---|---|
| Breadcrumb Bar | NEW `ProductBreadcrumb` + `StoreRatingDisplay` (inline) from storefront plan |
| Gallery Panel | `ProductGallery` / `BasicProductGallery` + NEW `ProductImageLightbox` |
| Purchase Panel | `FeaturedTypeBadges`, `PriceDisplay`, `ProductVariantSelector`, `AddToCartButton`, `FulfillmentOptionsPane`, `TenantQRCode` |
| Detail Tabs | NEW `ProductDetailTabs` composing: `product.description`, `product.specifications`, `product.features`, enriched data sections |
| Actions Bar | `ProductActions` |
| Business Info | `ProductBusinessInfoWrapper` |
| Featured Products | `FeaturedTypeProducts` |
| Available Nearby | `AvailableNearby` |
| Location Availability | `LocationAvailabilitySection` |
| Recommendations | `ProductRecommendations` |
| Reviews | `ProductReviewsSection` |
| FAQ + Inquiry | `FaqProductDisplay`, `PublicInquiryForm` |
| Recently Viewed | `LastViewed` |

### 6.6 Desktop Split-Panel CSS Architecture

```css
/* Showcase layout — sticky gallery */
.showcase-split {
  display: grid;
  grid-template-columns: 1fr;  /* mobile: stacked */
  gap: 2rem;
}

@media (min-width: 1024px) {
  .showcase-split {
    grid-template-columns: 55fr 45fr;
    gap: 3rem;
    align-items: start;
  }

  .showcase-gallery {
    position: sticky;
    top: 5rem;  /* below header */
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
  }
}
```

---

## 7. Layout C — Quick Commerce

### 7.1 Design Philosophy

Inspired by high-velocity marketplaces (Amazon, Target, Walmart). Prioritizes **speed to cart** — every pixel above the fold is optimized for purchase. Details are compressed and expandable. Best for merchants with large catalogs where customers know what they want.

### 7.2 Visual Language

- **Layout**: Compact two-column on desktop; information-dense
- **Color**: High-contrast CTAs; green for availability; prominent "Add to Cart" button
- **Typography**: Compact — `text-sm` body, `text-2xl` price, `text-xl` title
- **Spacing**: Tight — `py-6 lg:py-8` between sections; minimal padding
- **Cards**: Bordered with clear section delineation; utility-focused
- **Images**: Medium-sized with thumbnail strip; swap on hover

### 7.3 Page Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ COMPACT HEADER BAR (sticky)                                     │
│  ← Back to Store | Store Name | 🔍 Search | 🛒 Cart(2)        │
│  Breadcrumb: Store > Category > Product                         │
├─────────────────────────────────────────────────────────────────┤
│ ABOVE-THE-FOLD PRODUCT SECTION (fits in viewport)              │
│ ┌─────────────────────────┬─────────────────────────────────┐   │
│ │                         │                                 │   │
│ │  COMPACT GALLERY        │  PRODUCT QUICK-BUY PANEL        │   │
│ │  (45% width)            │  (55% width)                    │   │
│ │                         │                                 │   │
│ │  Main image (medium)    │  Title (text-xl, 2 lines max)   │   │
│ │  Thumbnail strip below  │  Brand · ★ 4.8 (127) · SKU     │   │
│ │                         │  ✓ In Stock (24 units)          │   │
│ │                         │                                 │   │
│ │                         │  ━━ $49.99 ━━━━━━━━━━━━━━━━━━━  │   │
│ │                         │  Was $64.99 — Save 23%          │   │
│ │                         │                                 │   │
│ │                         │  [Color: ● ● ●] [Size: S M L]  │   │
│ │                         │                                 │   │
│ │                         │  [−] 1 [+]                      │   │
│ │                         │  ┌─────────────────────────────┐│   │
│ │                         │  │    🛒 ADD TO CART            ││   │
│ │                         │  └─────────────────────────────┘│   │
│ │                         │  [Buy Now]                      │   │
│ │                         │                                 │   │
│ │                         │  📦 Free pickup · 🚚 Ships 2d  │   │
│ └─────────────────────────┴─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ EXPANDABLE DETAIL ACCORDION (compact, bg-white)                │
│  ▶ Description        (collapsed by default)                    │
│  ▶ Specifications     (collapsed)                               │
│  ▶ Features           (collapsed)                               │
│  ▶ Ingredients/Nutrition (collapsed, if applicable)             │
│  ▶ Product Identifiers (collapsed)                              │
│  Each section uses existing data — just wrapped in accordion    │
├─────────────────────────────────────────────────────────────────┤
│ FEATURED TYPE BADGES (inline, compact)                         │
│  Horizontal scroll of badge pills                               │
├─────────────────────────────────────────────────────────────────┤
│ LOCATION AVAILABILITY (compact card)                           │
│  LocationAvailabilitySection (if applicable)                    │
├─────────────────────────────────────────────────────────────────┤
│ AVAILABLE NEARBY (compact card)                                │
│  AvailableNearby (if applicable)                                │
├─────────────────────────────────────────────────────────────────┤
│ FEATURED PRODUCTS (horizontal scroll)                          │
│  FeaturedTypeProducts in carousel mode                          │
├─────────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS (horizontal scroll)                            │
│  ProductRecommendations in compact card carousel                │
├─────────────────────────────────────────────────────────────────┤
│ REVIEWS (compact summary + expandable)                         │
│  Rating bar summary · "See all 127 reviews" expand             │
├─────────────────────────────────────────────────────────────────┤
│ FAQ + INQUIRY (collapsible sections)                           │
├─────────────────────────────────────────────────────────────────┤
│ RECENTLY VIEWED (horizontal scroll) + FOOTER                   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Key Differences from Classic

| Aspect | Classic (A) | Quick Commerce (C) |
|--------|-------------|---------------------|
| **Above-the-fold** | Gallery only; rest is below | Gallery + Title + Price + Variant + Cart all visible |
| **Layout** | Single column, `max-w-4xl` | Two-column compact, `max-w-7xl` |
| **Description/Specs** | Full cards, always expanded | Accordion — collapsed by default |
| **Cart button** | Buried below 6+ sections | Prominent, immediately visible; sticky on mobile |
| **Trust signals** | Rating at bottom of page | Stars + review count inline with title |
| **Fulfillment** | Full pane below QR code | Compact inline icons below cart button |
| **Recommendations** | Grid layout | Horizontal scroll carousel (compact cards) |
| **Reviews** | Full section always expanded | Compact summary with expand trigger |
| **Mobile** | Long scroll to purchase | Sticky bottom bar: Price + Add to Cart |
| **Overall feel** | Informational, browsing | Transactional, buy-focused |

### 7.5 Component Mapping

| Quick Commerce Section | Existing Components Used |
|---|---|
| Compact Header | Store logo, `ProductSearch` (icon trigger), `useMultiCart` cart badge |
| Breadcrumb | NEW `ProductBreadcrumb` |
| Compact Gallery | `ProductGallery` (constrained height) or `BasicProductGallery` |
| Quick-Buy Panel | `PriceDisplay`, `ProductVariantSelector`, `AddToCartButton`, `FulfillmentOptionsPane` (compact), `TenantQRCode` (compact) |
| Detail Accordion | NEW expandable wrapper around: description, specs, features, enriched data |
| Location | `LocationAvailabilitySection`, `AvailableNearby` |
| Featured Products | `FeaturedTypeProducts` (carousel) |
| Recommendations | `ProductRecommendations` (carousel) |
| Reviews | `ProductReviewsSection` (compact summary mode) |
| FAQ + Inquiry | `FaqProductDisplay`, `PublicInquiryForm` |
| Recently Viewed | `LastViewed` |

---

## 8. Shared Component Enhancements

These benefit **all three layouts** and can be implemented independently.

### 8.1 ProductBreadcrumb (NEW)

A navigation trail showing the path from store to product:

```
🏪 Store Name  >  📂 Category Name  >  📦 Product Title
```

```typescript
interface ProductBreadcrumbProps {
  storeName: string;
  storeSlug: string;
  tenantId: string;
  categoryName?: string;
  categorySlug?: string;
  productTitle: string;
  variant?: 'default' | 'compact';  // compact for Quick Commerce
}
```

- Links: Store → `/tenant/{id}`, Category → `/tenant/{id}?category={slug}`
- Truncates product title at 40 chars on mobile
- `compact` variant uses smaller text and no icons

### 8.2 ProductTrustBar (NEW)

A single-line trust reinforcement strip:

```
★ 4.8 (127 reviews) · ✓ In Stock (24 units) · 🚚 Free Shipping over $50
```

```typescript
interface ProductTrustBarProps {
  productId: string;
  tenantId: string;
  stock: number;
  availability: string;
  variant?: 'default' | 'compact' | 'inline';
}
```

- Fetches rating data from existing review APIs
- Shows stock from product data
- Fulfillment tagline from merchant settings (future enhancement)

### 8.3 StickyPurchaseBar (NEW)

A mobile-only sticky bottom bar that appears when the main Add to Cart button scrolls out of view:

```
┌────────────────────────────────────────────────┐
│  $49.99  ████████ ADD TO CART ████████  │
│  Was $64.99        [or tap for variants]       │
└────────────────────────────────────────────────┘
```

```typescript
interface StickyPurchaseBarProps {
  priceCents: number;
  salePriceCents?: number;
  availability: string;
  onAddToCart: () => void;
  onBuyNow: () => void;
  hasVariants: boolean;
  variantSelected: boolean;
  onSelectVariant: () => void;  // scroll to variant section
}
```

- Uses `IntersectionObserver` on the main cart button to toggle visibility
- Fixed bottom with `backdrop-filter: blur(8px)`
- Respects `prefers-reduced-motion` (no slide animation)
- If variants are required and none selected, button says "Select Options" and scrolls to variant section

### 8.4 ProductDetailTabs (NEW)

A tabbed interface for organizing product detail sections:

```typescript
interface ProductDetailTabsProps {
  product: {
    description?: string;
    marketingDescription?: string;
    specifications?: Record<string, any>;
    features?: string[];
    ingredients?: string;
    nutritionFacts?: any;
    allergens?: string[];
    dietaryInfo?: string[];
    environmentalInfo?: string[];
    dimensions?: any;
    weight?: any;
  };
  features: LandingPageFeatures;  // tier-gated features
  defaultTab?: string;
}
```

- Tabs: Description | Specifications | Features | Nutrition (conditional)
- Only renders tabs that have content
- Uses Mantine `Tabs` component (already a dependency) or Radix `Tabs`
- Mobile: Tabs scroll horizontally; or accordion variant for Quick Commerce

### 8.5 ProductImageLightbox (NEW)

A fullscreen image viewer triggered by clicking gallery images:

```typescript
interface ProductImageLightboxProps {
  images: Array<{ url: string; alt?: string; caption?: string }>;
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}
```

- Fullscreen modal with dark overlay
- Swipe left/right on mobile (touch events)
- Keyboard navigation (← → Esc)
- Pinch-to-zoom on mobile
- Counter: "3 / 8"
- Uses existing `@mantine/core` Modal or Radix Dialog

### 8.6 Existing Component Enhancements

#### ProductGallery — Lightbox Integration
```typescript
// New optional props:
interface ProductGalleryEnhancements {
  enableLightbox?: boolean;          // Open lightbox on image click
  stickyOnDesktop?: boolean;         // CSS sticky positioning
  maxHeight?: string;                // Override max height (e.g., 'h-[32rem]')
  thumbnailPosition?: 'bottom' | 'left';  // Thumbnail strip placement
}
```

#### AddToCartButton — Compact Variant
```typescript
// New optional prop:
interface AddToCartButtonEnhancements {
  variant?: 'default' | 'compact' | 'sticky';
  // compact: Single "Add to Cart" button, no "Buy Now"
  // sticky: Full-width for sticky bar use
}
```

#### PriceDisplay — Inline Variant
```typescript
// Enhancement to existing 'compact' variant:
// Add 'inline' variant for trust bar use:
// "$49.99" in a single inline span with no wrapping
```

#### ProductReviewsSection — Summary Mode
```typescript
// New optional prop:
interface ProductReviewsSectionEnhancements {
  variant?: 'full' | 'summary';
  // summary: Rating bar + 3 most recent reviews + "See all" button
  // full: Current behavior (default)
}
```

#### FeaturedTypeProducts — Carousel Mode
```typescript
// New optional prop:
interface FeaturedTypeProductsEnhancements {
  displayMode?: 'stacked' | 'carousel';
  // stacked: Current behavior (default)
  // carousel: Horizontal scroll for each type
}
```

---

## 9. Mobile-First UX Patterns

### 9.1 Mobile Layout Comparison

#### Classic (Mobile)
```
┌────────────────────────────────┐
│ Header (sticky)                │
├────────────────────────────────┤
│ Category Dropdown              │
│ QR Code                        │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │    GALLERY (full width)    │ │
│ │    h-96                    │ │
│ └────────────────────────────┘ │
│ Featured Badges                │
│ Product Actions                │
│ ┌────────────────────────────┐ │
│ │  Title + Brand + Condition │ │
│ │  Category Badge            │ │
│ │  Availability              │ │
│ │  Description               │ │
│ │  Marketing Desc            │ │
│ └────────────────────────────┘ │
│  ... (6+ more cards) ...       │
│ ┌────────────────────────────┐ │
│ │  Variant Selector          │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │  Price + Add to Cart       │ │
│ └────────────────────────────┘ │
│  ... (more sections below)     │
└────────────────────────────────┘
```

#### Showcase (Mobile)
```
┌────────────────────────────────┐
│ Breadcrumb + Trust Bar         │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │    GALLERY (full width)    │ │
│ │    h-80 + thumbnails       │ │
│ │    Tap → lightbox          │ │
│ └────────────────────────────┘ │
│                                │
│ Featured Badges                │
│ Title (text-2xl)               │
│ Brand · ★ 4.8 (127)           │
│ ✓ In Stock                     │
│                                │
│ $49.99 (Was $64.99 — 23% off) │
│                                │
│ [Color: ● ● ●] [Size ▾]      │
│                                │
│ [−] 1 [+]                      │
│ ┌────────────────────────────┐ │
│ │   🛒 ADD TO CART           │ │
│ └────────────────────────────┘ │
│ [Buy Now]                      │
│                                │
│ [Description] [Specs] [More]   │
│ Tab content...                 │
│                                │
│ Reviews · Recommendations      │
│ ... (remaining sections)       │
├────────────────────────────────┤
│ $49.99    [🛒 ADD TO CART]     │ ← Sticky bottom bar
└────────────────────────────────┘     (appears on scroll)
```

#### Quick Commerce (Mobile)
```
┌────────────────────────────────┐
│ ← Back | Store | 🔍 🛒(2)     │ ← Sticky header
├────────────────────────────────┤
│ Store > Category > Product     │ ← Breadcrumb
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │   GALLERY (compact)        │ │
│ │   h-64 + thumbnails        │ │
│ └────────────────────────────┘ │
│ Product Title (text-lg)        │
│ Brand · ★ 4.8 · SKU           │
│ ✓ In Stock (24 units)          │
│                                │
│ $49.99 Save 23%                │
│                                │
│ [● ● ●] [S M L]               │
│ [−] 1 [+]                      │
│ ┌────────────────────────────┐ │
│ │   🛒 ADD TO CART           │ │
│ └────────────────────────────┘ │
│ 📦 Free pickup · 🚚 Ships 2d  │
│                                │
│ ▶ Description                  │
│ ▶ Specifications               │
│ ▶ Features                     │
│                                │
│ ← Featured → (scroll)         │
│ ← Recommendations → (scroll)  │
│ Reviews summary                │
├────────────────────────────────┤
│ $49.99    [🛒 ADD TO CART]     │ ← Sticky bottom bar
└────────────────────────────────┘
```

### 9.2 Touch Interaction Patterns

| Interaction | Implementation |
|---|---|
| Image zoom | Tap gallery image → fullscreen lightbox with pinch-to-zoom |
| Variant selection | Swatch tap (color); button tap (size); dropdown for 5+ options |
| Quantity adjust | Tap +/− buttons (44px minimum); or tap number to type |
| Sticky bar purchase | Tap "Add to Cart" on sticky bar; if variants needed, scrolls to selector |
| Accordion expand | Tap section header to expand/collapse; smooth height animation |
| Carousel navigation | Swipe left/right; CSS scroll-snap; peek at next item |

### 9.3 Sticky Element Strategy

| Element | Classic (A) | Showcase (B) | Quick Commerce (C) |
|---------|-------------|---------------|---------------------|
| Header | Sticky | Not sticky (breadcrumb is static) | Sticky |
| Gallery | Static | Sticky on desktop (CSS sticky) | Static |
| Purchase bar (mobile) | None | Sticky bottom bar on scroll | Sticky bottom bar on scroll |
| Filter/sort | N/A | N/A | N/A |

---

## 10. Visual Polish & Design Token Additions

### 10.1 Product-Page-Specific Tokens

Add to `globals.css` alongside the storefront tokens:

```css
/* Product page layout tokens */
--product-gallery-height-sm: 20rem;    /* 320px - mobile */
--product-gallery-height-md: 24rem;    /* 384px - tablet */
--product-gallery-height-lg: 32rem;    /* 512px - desktop (showcase) */

--product-split-gallery: 55%;          /* gallery column width */
--product-split-details: 45%;          /* details column width */
--product-split-gap: 2rem;             /* gap between columns */

/* Purchase area emphasis */
--purchase-area-bg: linear-gradient(135deg, var(--color-green-50) 0%, var(--color-indigo-50) 100%);
--purchase-area-border: var(--color-green-200);
--purchase-area-radius: 0.75rem;

/* Sticky bar */
--sticky-bar-height: 4rem;
--sticky-bar-bg: rgba(255, 255, 255, 0.95);
--sticky-bar-bg-dark: rgba(23, 23, 23, 0.95);
--sticky-bar-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
--sticky-bar-backdrop: blur(8px);
```

### 10.2 Typography Scale (Product Page)

| Level | Classic (A) | Showcase (B) | Quick Commerce (C) |
|-------|-------------|---------------|---------------------|
| Title | `text-3xl font-bold` | `text-3xl lg:text-4xl font-bold tracking-tight` | `text-xl lg:text-2xl font-bold` |
| Brand | `text-sm text-neutral-600` | `text-base text-neutral-500` | `text-sm text-neutral-500` |
| Price | `text-2xl font-bold` (via PriceDisplay) | `text-3xl font-bold` | `text-2xl font-bold text-green-700` |
| Section heading | `text-xl font-semibold` | `text-lg font-medium` (tabs) | `text-sm font-semibold` (accordion) |
| Body | `text-neutral-700` | `text-neutral-700 leading-relaxed` | `text-sm text-neutral-600` |
| SKU/Meta | `text-sm text-neutral-500` | `text-sm text-neutral-400` | `text-xs text-neutral-400` |

---

## 11. Tier & Capability Gating

Product page layout is **derived from the storefront layout preference** — no additional capability key needed.

### 11.1 Resolution Chain

```
1. Merchant selects storefront layout via Settings → Storefront Options
2. Selection stored as `storefront_layout` in tenant settings
3. Product page.tsx fetches optFlags (already does this)
4. optFlags includes `storefrontLayout` field (added in storefront plan Phase 2)
5. Product page maps: classic → classic, editorial → showcase, immersive → quick-commerce
6. Renders the appropriate product layout wrapper
```

### 11.2 Tier Matrix (Same as Storefront)

| Layout | Free | Starter | Growth | Pro | Enterprise |
|---|---|---|---|---|---|
| Classic product page | Yes | Yes | Yes | Yes | Yes |
| Showcase product page | No | No | Yes | Yes | Yes |
| Quick Commerce product page | No | No | No | Yes | Yes |

---

## 12. Technical Implementation

### 12.1 page.tsx Modification

Minimal change — add a layout switch after the existing data fetching:

```typescript
// In page.tsx — near the end of the server function, before return

// Resolve product page layout from storefront preference
const storefrontLayout = optFlags?.storefrontLayout || 'classic';
const searchParams = /* from page props */;
const layoutPreview = searchParams?.layout_preview;

const PRODUCT_LAYOUT_MAP = {
  classic: 'classic',
  editorial: 'showcase', 
  immersive: 'quick-commerce',
} as const;

const effectiveLayout = layoutPreview 
  ? PRODUCT_LAYOUT_MAP[layoutPreview as keyof typeof PRODUCT_LAYOUT_MAP] || 'classic'
  : PRODUCT_LAYOUT_MAP[storefrontLayout as keyof typeof PRODUCT_LAYOUT_MAP] || 'classic';

// In the return statement, wrap in a layout switch:
switch (effectiveLayout) {
  case 'showcase':
    return (
      <ProductLikeProvider>
        <ProductShowcaseLayout
          product={product}
          tenant={tenantProfile}
          gallery={gallery}
          // ... same props currently passed to the composition
        />
      </ProductLikeProvider>
    );
  case 'quick-commerce':
    return (
      <ProductLikeProvider>
        <ProductQuickCommerceLayout
          product={product}
          tenant={tenantProfile}
          gallery={gallery}
          // ... same props
        />
      </ProductLikeProvider>
    );
  default:
    // Existing composition — completely untouched
    return (
      <ProductLikeProvider>
        {/* ... current JSX unchanged ... */}
      </ProductLikeProvider>
    );
}
```

### 12.2 Shared State Hook

Extract the ~200 lines of state/hook logic from `TierBasedLandingPage.tsx` into a reusable hook:

```typescript
// app/products/[id]/layouts/hooks/useProductDetailState.ts

export function useProductDetailState(props: ProductDetailStateProps) {
  // Pricing calculations
  const currentPrice = ...;
  const currentPriceCents = ...;
  const variantPriceRange = ...;
  const variantStockInfo = ...;

  // Variant state
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  // Commerce capability resolution
  const effectiveCanPurchase = ...;
  const effectiveGatewayType = ...;
  const commerceDisabled = ...;

  // Storefront capability flags
  const isRetailStore = ...;
  const showsLocation = ...;
  const showsHours = ...;

  // Status panel logic
  const showStatusPanel = ...;

  // Feature flags (tier-gated)
  const [features, setFeatures] = useState<LandingPageFeatures | null>(null);
  const safeFeatures = ...;

  // Branding
  const displayLogo = ...;
  const displayName = ...;

  return {
    // Pricing
    currentPrice, currentPriceCents, currentStock, currentSku, currentAvailability,
    variantPriceRange, variantStockInfo,
    // Variant
    selectedVariant, setSelectedVariant, quantity, setQuantity,
    hasVariants,
    // Commerce
    effectiveCanPurchase, effectiveGatewayType, commerceDisabled,
    // Capabilities
    isRetailStore, showsLocation, showsHours, showStatusPanel,
    // Features
    features, safeFeatures,
    // Branding
    displayLogo, displayName,
  };
}
```

### 12.3 Dynamic Imports (Performance)

```typescript
// app/products/[id]/page.tsx
import dynamic from 'next/dynamic';

const ProductShowcaseLayout = dynamic(
  () => import('./ProductShowcaseLayout'),
  { loading: () => <ProductDetailSkeleton /> }
);

const ProductQuickCommerceLayout = dynamic(
  () => import('./ProductQuickCommerceLayout'),
  { loading: () => <ProductDetailSkeleton /> }
);
```

### 12.4 Layout Props Interface

All layout wrappers share the same props:

```typescript
interface ProductLayoutProps {
  // Product data
  product: ProductData;
  productWithGallery: any;
  gallery: Array<{ url: string; alt: string; caption: string | null; position: number }>;

  // Tenant data
  tenantProfile: any;
  tenant: any;
  businessName: string;

  // Categories & navigation
  storefrontCategories: any;
  totalProducts: number;

  // Featured products
  merchantFilteredFeaturedTypes: string[];
  merchantFilteredGroupedProducts: Record<string, any[]>;
  bucketCounts?: Record<string, number>;

  // Capability flags
  optFlags: StorefrontOptionFlags | null;
  faqOptionsFlags: PublicFaqOptionsFlags | null;
  crmOptionsFlags: PublicCrmOptionsFlags | null;

  // Computed values
  currentUrl: string;
  isPubliclyAccessible: boolean;
  statusLabel: string;
  visibilityLabel: string;
  tenantInfoForStatus: any;
  structuredData: any;

  // Layout hint
  layoutVariant: 'classic' | 'showcase' | 'quick-commerce';
}
```

---

## 13. Phased Rollout Plan

### Phase 1 — Foundation (Week 1-2, concurrent with Storefront Phase 1)

| Task | Files | Risk |
|------|-------|------|
| Extract `useProductDetailState` hook from TierBasedLandingPage logic | `layouts/hooks/useProductDetailState.ts` | Medium — must replicate all state logic correctly |
| Verify TierBasedLandingPage still works identically (unchanged) | `TierBasedLandingPage.tsx` | Low |
| Create `ProductBreadcrumb` component | `layouts/shared/ProductBreadcrumb.tsx` | Low |
| Create `ProductTrustBar` component | `layouts/shared/ProductTrustBar.tsx` | Low |
| Create `StickyPurchaseBar` component | `layouts/shared/StickyPurchaseBar.tsx` | Medium |
| Create `ProductImageLightbox` component | `layouts/shared/ProductImageLightbox.tsx` | Medium |
| Create `ProductDetailTabs` component | `layouts/shared/ProductDetailTabs.tsx` | Medium |
| Define `ProductLayoutProps` interface | Shared types file | Low |
| Add product-page design tokens to `globals.css` | `globals.css` | Low |

**Validation**: Classic product page renders identically. New shared components render in isolation (no integration yet).

### Phase 2 — Backend Alignment (Week 2-3, concurrent with Storefront Phase 2)

No product-page-specific backend changes needed — the `storefrontLayout` field from the storefront plan is reused directly.

| Task | Files | Risk |
|------|-------|------|
| Verify `optFlags.storefrontLayout` is accessible in `page.tsx` | `page.tsx` | Low |
| Add `PRODUCT_LAYOUT_MAP` constant | `page.tsx` or shared config | Low |
| Add `?layout_preview` support for product page | `page.tsx` | Low |

### Phase 3 — Layout B: Product Showcase (Week 4-5, after Storefront Phase 3)

| Task | Files | Risk |
|------|-------|------|
| Create `ProductShowcaseLayout.tsx` | `ProductShowcaseLayout.tsx` | High — primary deliverable |
| Implement split-panel with sticky gallery (desktop) | Within showcase layout | Medium |
| Integrate `ProductBreadcrumb` | Within showcase layout | Low |
| Integrate `ProductTrustBar` | Within showcase layout | Low |
| Integrate `ProductDetailTabs` for description/specs/features | Within showcase layout | Medium |
| Integrate `ProductImageLightbox` on gallery click | Within showcase layout | Medium |
| Integrate `StickyPurchaseBar` for mobile | Within showcase layout | Medium |
| Add `enableLightbox` prop to `ProductGallery` | `ProductGallery.tsx` | Low |
| Add `stickyOnDesktop` prop to `ProductGallery` | `ProductGallery.tsx` | Low |
| Add layout router switch to `page.tsx` | `page.tsx` | Medium |
| Responsive testing (mobile, tablet, desktop) | — | Medium |
| Dark mode testing | — | Low |
| Accessibility audit | — | Medium |

**Validation**: Merchants on Growth+ using Editorial storefront see Showcase product page. Split-panel works on desktop. Sticky bar works on mobile. Classic product page is unaffected.

### Phase 4 — Layout C: Quick Commerce (Week 5-7, after Storefront Phase 4)

| Task | Files | Risk |
|------|-------|------|
| Create `ProductQuickCommerceLayout.tsx` | `ProductQuickCommerceLayout.tsx` | High — primary deliverable |
| Implement compact two-column above-the-fold layout | Within QC layout | Medium |
| Implement expandable accordion for detail sections | Within QC layout | Medium |
| Implement compact sticky header with back/search/cart | Within QC layout | Medium |
| Add `variant: 'compact'` to `AddToCartButton` | `AddToCartButton.tsx` | Low |
| Add `variant: 'summary'` to `ProductReviewsSection` | `ProductReviewsSection.tsx` | Low |
| Add `displayMode: 'carousel'` to `FeaturedTypeProducts` | `FeaturedTypeProducts.tsx` | Medium |
| Integrate `StickyPurchaseBar` for mobile | Within QC layout | Low (reuse from Phase 3) |
| Responsive testing | — | Medium |
| Dark mode testing | — | Low |
| Performance testing (above-the-fold metrics) | — | Medium |
| Accessibility audit | — | Medium |

**Validation**: Merchants on Pro+ using Immersive storefront see Quick Commerce product page. Purchase flow fits above-the-fold on desktop. Accordion details work smoothly.

### Phase 5 — Polish & Optimization (Week 7-8, concurrent with Storefront Phase 5)

| Task | Files | Risk |
|------|-------|------|
| Add scroll-triggered fade-in to all layouts | Shared utility | Low |
| Optimize dynamic imports and code splitting | Layout router | Low |
| Add product page layout analytics (time-to-cart, conversion) | Behavior tracking | Low |
| Performance audit: LCP for gallery, FID for variant selector | — | Medium |
| Optional: Classic layout breadcrumb addition | `page.tsx` | Low |
| Optional: Classic layout StickyPurchaseBar addition | `page.tsx` | Low |
| Documentation updates | `AGENTS.md` | Low |

---

## 14. File Manifest

### New Files

| File | Type | Phase | Description |
|------|------|-------|-------------|
| `app/products/[id]/ProductShowcaseLayout.tsx` | Client Component | 3 | Layout B wrapper |
| `app/products/[id]/ProductQuickCommerceLayout.tsx` | Client Component | 4 | Layout C wrapper |
| `app/products/[id]/layouts/shared/ProductBreadcrumb.tsx` | Component | 1 | Navigation breadcrumb |
| `app/products/[id]/layouts/shared/ProductTrustBar.tsx` | Component | 1 | Trust signals strip |
| `app/products/[id]/layouts/shared/StickyPurchaseBar.tsx` | Client Component | 1 | Mobile sticky cart bar |
| `app/products/[id]/layouts/shared/ProductDetailTabs.tsx` | Client Component | 1 | Tabbed detail sections |
| `app/products/[id]/layouts/shared/ProductImageLightbox.tsx` | Client Component | 1 | Fullscreen image viewer |
| `app/products/[id]/layouts/shared/QuickAddPanel.tsx` | Client Component | 3 | Compact purchase panel |
| `app/products/[id]/layouts/hooks/useProductDetailState.ts` | Hook | 1 | Extracted shared state logic |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `app/products/[id]/page.tsx` | 3 | Add layout router switch + preview param |
| `components/products/ProductGallery.tsx` | 3 | Add `enableLightbox`, `stickyOnDesktop`, `maxHeight` props |
| `components/products/AddToCartButton.tsx` | 4 | Add `variant: 'compact' \| 'sticky'` prop |
| `components/products/ProductReviewsSection.tsx` | 4 | Add `variant: 'summary'` prop |
| `components/products/FeaturedTypeProducts.tsx` | 4 | Add `displayMode: 'carousel'` prop |
| `components/products/PriceDisplay.tsx` | 3 | Add `variant: 'inline'` option |
| `app/globals.css` | 1 | Add product-page design tokens |

### Preserved (Untouched) Files

| File | Reason |
|------|--------|
| `components/landing-page/TierBasedLandingPage.tsx` | Layout A renderer — unchanged |
| `app/products/[id]/not-found.tsx` | No layout dependency |
| All 39 files in `components/products/` | Used as-is by all layouts (unless explicitly listed as modified) |

---

## Appendix A: Layout Comparison Matrix

| Feature | Classic (A) | Showcase (B) | Quick Commerce (C) |
|---------|:-----------:|:------------:|:------------------:|
| Gallery + Cart side-by-side | - | Yes (desktop) | Yes (desktop) |
| Sticky gallery (desktop) | - | Yes | - |
| Sticky purchase bar (mobile) | - | Yes | Yes |
| Sticky header | Yes | - | Yes |
| Breadcrumb navigation | - | Yes | Yes |
| Trust signals bar | - | Yes | Inline with title |
| Detail sections | Stacked cards | Tabbed | Accordion (collapsed) |
| Image lightbox | - | Yes | - |
| Purchase above-the-fold | - | Yes (desktop) | Yes (all viewports) |
| Grid density | Single column | Split panel | Compact split panel |
| Fulfillment display | Full pane | Compact in purchase panel | Inline icons |
| Recommendations | Grid | Grid | Horizontal carousel |
| Reviews | Full section | Full section | Compact summary |
| Best for | All products | Photography-rich products | Large catalog, fast purchase |

## Appendix B: Performance Budgets

| Metric | Target | Notes |
|--------|--------|-------|
| LCP (gallery image) | < 2.0s | Priority loading for hero image; use Next.js Image `priority` |
| FID (variant selector) | < 100ms | Hydration budget for interactive variant picker |
| CLS | < 0.1 | Sticky bar must reserve space; gallery dimensions must be known |
| Time to Interactive | < 3.0s | Dynamic imports keep layout code separate |
| Total JS per layout | < 120KB gzipped | Shared hook avoids logic duplication |
| Image optimization | WebP/AVIF, priority first image | Gallery images lazy-load after first |

## Appendix C: Accessibility Checklist (Per Layout)

- [ ] Gallery images have meaningful alt text (product title + image position)
- [ ] Lightbox has focus trap and Escape key handler
- [ ] Variant selector options have ARIA labels (e.g., "Color: Red, In Stock")
- [ ] Sticky purchase bar is announced by screen readers on appearance
- [ ] Tab/accordion navigation works with keyboard (Enter, Space, Arrow keys)
- [ ] Price display has `aria-label` with full price text
- [ ] Add to Cart button has loading state announced (`aria-busy`)
- [ ] Breadcrumb uses `<nav aria-label="Breadcrumb">` with `<ol>` structure
- [ ] All interactive elements have minimum 44x44px touch targets
- [ ] `prefers-reduced-motion` disables gallery transitions and sticky bar animation
- [ ] Color contrast ratios meet WCAG 2.1 AA on all price/availability indicators

---

*This plan is designed to be implemented after or concurrently with the Storefront Layout Enhancement Plan. Phase 1 (Foundation) can run in parallel with Storefront Phase 1. Phases 3-4 should follow their storefront counterparts to maintain consistent experience. The Classic layout is never at risk — it is the default fallback and is not modified during any phase.*
