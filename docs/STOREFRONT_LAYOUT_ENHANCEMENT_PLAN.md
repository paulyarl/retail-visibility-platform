# Storefront Layout Enhancement Plan

## Merchant-Selectable Layouts: Architecture & Design Specification

> **Version**: 1.0  
> **Date**: 2026-06-14  
> **Scope**: Customer-facing storefront (`/tenant/[id]`) and product display  
> **Approach**: Preserve all existing components; introduce two new layout compositions; gate by tier + merchant preference

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Design Principles](#3-design-principles)
4. [Layout System Architecture](#4-layout-system-architecture)
5. [Layout A — Classic (Current)](#5-layout-a--classic-current)
6. [Layout B — Modern Editorial](#6-layout-b--modern-editorial)
7. [Layout C — Immersive Commerce](#7-layout-c--immersive-commerce)
8. [Shared Component Enhancements](#8-shared-component-enhancements)
9. [Mobile-First UX Patterns](#9-mobile-first-ux-patterns)
10. [Visual Polish & Design Token Additions](#10-visual-polish--design-token-additions)
11. [Tier & Capability Gating](#11-tier--capability-gating)
12. [Merchant Settings UI](#12-merchant-settings-ui)
13. [Technical Implementation](#13-technical-implementation)
14. [Phased Rollout Plan](#14-phased-rollout-plan)
15. [File Manifest](#15-file-manifest)

---

## 1. Executive Summary

This plan introduces a **merchant-selectable storefront layout system** that allows each tenant to choose from up to three layout variants based on their subscription tier:

| Layout | Name | Tier Availability | Design Philosophy |
|--------|------|-------------------|-------------------|
| **A** | Classic | All tiers (default) | Current layout, preserved as-is with minor polish |
| **B** | Modern Editorial | Growth+ tiers | Content-forward, storytelling emphasis, editorial spacing |
| **C** | Immersive Commerce | Pro+ tiers | Conversion-optimized, product-first, minimal friction |

**Key constraints:**
- Zero breaking changes to existing components
- All three layouts compose the **same component library** — no component duplication
- Layout selection is a new storefront option, resolved through the existing capability pipeline
- Each layout is a separate wrapper file, selected by a layout router at the page level

---

## 2. Current State Analysis

### 2.1 Current File Structure

```
apps/web/src/
├── app/tenant/[id]/
│   ├── page.tsx                        # Server component (data fetching + metadata)
│   ├── StorefrontClientWrapper.tsx      # Client wrapper (1,226 lines — monolithic)
│   └── StorefrontClient.tsx            # StorefrontRecommendations export
├── components/storefront/              # 16 storefront-specific components
├── components/products/                # 12 product display components
├── services/PublicStorefrontOptionsService.ts  # Capability flags
└── utils/storefrontOptions.ts          # Option type metadata
```

### 2.2 Current Page Composition (Layout A)

The current `StorefrontClientWrapper.tsx` renders sections in this order:

```
┌─────────────────────────────────────────────────┐
│ HEADER                                          │
│  Logo + Store Name + Category                   │
│  Navigation Pills (Directory, Shop, Hours, Cart)│
│  Category Badges (GBP)                          │
│  Hours Status Badge + Directory Actions         │
│  Mobile Navigation (horizontal scroll)          │
├─────────────────────────────────────────────────┤
│ ABOUT SECTION                                   │
│  2-col: Description + Social | Rating Display   │
├─────────────────────────────────────────────────┤
│ FEATURED JUMP NAV                               │
│  Horizontal pill buttons → scroll to sections   │
├─────────────────────────────────────────────────┤
│ STATUS PANEL (conditional)                      │
├─────────────────────────────────────────────────┤
│ PRODUCT CATALOG (primary content)               │
│  Search Bar                                     │
│  Sidebar + Grid (desktop) / Dropdown + Grid     │
│  Pagination                                     │
├─────────────────────────────────────────────────┤
│ FEATURED BUCKETS SHOWCASE                       │
│  Multiple featured product sections             │
├─────────────────────────────────────────────────┤
│ STORE INFORMATION                               │
│  3-col: Hours | Contact | Map & Location        │
│  Fulfillment Options                            │
├─────────────────────────────────────────────────┤
│ ADVANCED CATALOG NAV                            │
│  CollapsibleCatalogSidebar                      │
├─────────────────────────────────────────────────┤
│ FAQ SECTION (conditional)                       │
├─────────────────────────────────────────────────┤
│ INQUIRY FORM (conditional)                      │
├─────────────────────────────────────────────────┤
│ REVIEWS SECTION                                 │
├─────────────────────────────────────────────────┤
│ RECOMMENDATIONS                                 │
├─────────────────────────────────────────────────┤
│ RECENTLY VIEWED                                 │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
│  Quick Links + Platform Branding                │
└─────────────────────────────────────────────────┘
```

### 2.3 Current Pain Points

| Area | Issue | Impact |
|------|-------|--------|
| **Information hierarchy** | "About" section with social links sits above the product catalog | Products (the primary draw) are pushed below the fold |
| **Visual density** | Header packs logo, name, pills, badges, status, and actions into tight vertical space | Feels cluttered; competing visual weight |
| **Section separation** | Only gradient divider lines between major sections | Sections blur together on long scroll |
| **Whitespace** | Consistent `py-8` / `py-12` throughout | Monotonous rhythm; no visual breathing hierarchy |
| **Mobile navigation** | Horizontal scroll pills for all nav | Pills overflow and lack clear affordance on small screens |
| **Trust signals** | Rating display is buried in the About section | Should be near the header for immediate credibility |
| **Conversion path** | No prominent CTA above the fold | Cart is a small pill; no "Shop Now" or featured product spotlight |
| **Footer** | Minimal; only quick links + branding | Missed opportunity for cross-sell, newsletter, policy links |

---

## 3. Design Principles

All three layouts follow these shared principles:

### 3.1 Visual Polish & Spacing
- **Typographic hierarchy**: 5-level scale (hero, section, subsection, body, caption) with consistent ratios
- **Whitespace rhythm**: Alternating `py-12` / `py-16` / `py-20` sections with visual "breathers"
- **Card elevation system**: Three tiers — flat (borders), raised (shadow-sm), elevated (shadow-md + hover lift)
- **Section differentiation**: Alternating bg tones (`white` / `neutral-50` / `neutral-100`) to create visual lanes
- **Micro-interactions**: Subtle hover transforms (`scale-[1.02]`), fade-in on scroll (Intersection Observer), smooth transitions (`duration-300`)

### 3.2 Information Architecture
- **F-pattern scanning**: Key content anchored top-left; secondary actions top-right
- **Trust signals early**: Ratings, reviews count, verified badges within the first viewport
- **Products above the fold**: Featured/hero products visible without scrolling
- **Progressive disclosure**: Store details (hours, map, contact) collapsed or below-the-fold; available but not dominant
- **Clear conversion funnel**: Prominent CTAs → Product browse → Cart → Checkout

### 3.3 Mobile-First UX
- **Touch targets**: Minimum 44px for all interactive elements
- **Bottom sheet patterns**: Filter/category selection as slide-up panels on mobile
- **Sticky elements**: Search bar and cart icon sticky on scroll (mobile)
- **Thumb-zone optimization**: Primary actions in bottom-center of screen
- **Swipe affordances**: Horizontal product carousels with peek + snap
- **Reduced motion**: Respect `prefers-reduced-motion` for all animations

---

## 4. Layout System Architecture

### 4.1 Layout Router Pattern

The layout selection happens at the **server component level** in `page.tsx`. The server fetches the merchant's preferred layout from storefront options, then renders the appropriate wrapper:

```
page.tsx (Server Component)
  ├── Fetch tenant data, products, capabilities (existing)
  ├── Fetch storefront_layout preference (NEW)
  └── Render layout based on preference:
      ├── 'classic'    → StorefrontClientWrapper.tsx (existing, untouched)
      ├── 'editorial'  → StorefrontEditorialLayout.tsx (NEW)
      └── 'immersive'  → StorefrontImmersiveLayout.tsx (NEW)
```

### 4.2 Shared Props Contract

All three layout wrappers accept the **same props interface** (`StorefrontClientWrapperProps`). This is critical — it means `page.tsx` doesn't need layout-specific logic. The only change to `page.tsx` is a layout selector switch.

```typescript
// Existing interface — shared by all layouts
interface StorefrontClientWrapperProps {
  tenantId: string;
  tenant: any;
  platformSettings: any;
  mapLocation: any;
  // ... all existing props unchanged
  initialStorefrontOptionFlags?: StorefrontOptionFlags | null;
  // NEW: layout hint (for any layout-specific sub-component behavior)
  layoutVariant?: 'classic' | 'editorial' | 'immersive';
}
```

### 4.3 Component Composition (Not Duplication)

Each layout wrapper is a **composition** of existing components in a different order/arrangement. No component code is duplicated:

```
Layout A (Classic):     [Header] [About] [JumpNav] [Catalog] [Featured] [StoreInfo] [Footer]
Layout B (Editorial):   [HeroBanner] [TrustBar] [FeaturedSpotlight] [Catalog] [StorySection] [Footer]
Layout C (Immersive):   [StickyHeader] [ProductHero] [FilterBar] [InfiniteGrid] [QuickInfo] [Footer]
```

### 4.4 New File Structure

```
apps/web/src/
├── app/tenant/[id]/
│   ├── page.tsx                              # MODIFIED: layout router switch
│   ├── StorefrontClientWrapper.tsx            # PRESERVED: Layout A (Classic)
│   ├── StorefrontEditorialLayout.tsx          # NEW: Layout B (Modern Editorial)
│   ├── StorefrontImmersiveLayout.tsx          # NEW: Layout C (Immersive Commerce)
│   ├── StorefrontClient.tsx                   # PRESERVED: shared exports
│   └── layouts/
│       ├── LayoutRouter.tsx                   # NEW: dynamic import router
│       ├── shared/
│       │   ├── StorefrontHeader.tsx           # NEW: extracted, shared header variants
│       │   ├── StorefrontFooter.tsx           # NEW: extracted, enhanced footer
│       │   ├── TrustSignalsBar.tsx            # NEW: rating + badges + hours compact bar
│       │   ├── HeroBanner.tsx                 # NEW: hero section for editorial layout
│       │   ├── StickySearchBar.tsx            # NEW: sticky search for immersive layout
│       │   └── SectionDivider.tsx             # NEW: themed section separators
│       └── hooks/
│           └── useLayoutConfig.ts             # NEW: layout-specific config hook
├── components/storefront/                     # PRESERVED: all existing components
│   ├── ... (existing, no changes)
│   └── ProductGridEnhanced.tsx               # NEW: enhanced grid with animations
├── services/
│   └── PublicStorefrontOptionsService.ts      # MODIFIED: add layout flag
└── utils/
    └── storefrontOptions.ts                   # MODIFIED: add layout type metadata
```

---

## 5. Layout A — Classic (Current)

### 5.1 Changes: None

`StorefrontClientWrapper.tsx` is **preserved exactly as-is**. It remains the default layout for all tiers.

### 5.2 Optional Polish Pass (Non-Breaking)

If desired as a follow-up, minor CSS-only enhancements could be applied without changing structure:

| Enhancement | Current | Proposed | Impact |
|-------------|---------|----------|--------|
| Section spacing | Uniform `py-8` | Alternate `py-10` / `py-14` | Better visual rhythm |
| Card hover states | `hover:shadow-lg` | `hover:shadow-md hover:-translate-y-0.5 transition-all duration-200` | Subtler, smoother lift |
| Section backgrounds | All `bg-white dark:bg-neutral-800` | Alternate `bg-neutral-50/50 dark:bg-neutral-900/50` on even sections | Clearer section breaks |
| Typography scale | `text-3xl` section headers | `text-2xl font-semibold tracking-tight` | More refined hierarchy |

These would be CSS class changes only — no structural/component changes.

---

## 6. Layout B — Modern Editorial

### 6.1 Design Philosophy

Inspired by editorial e-commerce brands (Everlane, Glossier, Muji). Prioritizes storytelling, generous whitespace, and curated product presentation. Best for merchants who have strong brand identity, product photography, and a smaller catalog.

### 6.2 Visual Language

- **Color**: Muted palette — primary accent used sparingly; neutral backgrounds dominate
- **Typography**: Larger display headings (`text-4xl lg:text-5xl`); serif-flavored for headings if brand supports it
- **Spacing**: Generous — `py-16 lg:py-24` between major sections
- **Cards**: Borderless with subtle shadow; full-bleed images; hover reveals overlay
- **Grid**: Asymmetric layouts — hero product larger, supporting products smaller

### 6.3 Page Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ MINIMAL HEADER BAR                                              │
│  Logo (left) | Search icon + Cart icon (right)                  │
│  Thin trust bar: ★ 4.8 (127 reviews) · Open until 9pm · Free   │
│  shipping over $50                                              │
├─────────────────────────────────────────────────────────────────┤
│ HERO BANNER (full-width, 60vh)                                  │
│  Store banner image or gradient                                 │
│  Overlay: Store name (large) + tagline                          │
│  CTA: "Browse Collection" (scrolls to catalog)                  │
│  GBP category badges (overlaid, bottom)                         │
├─────────────────────────────────────────────────────────────────┤
│ FEATURED SPOTLIGHT (2-col asymmetric)                           │
│  ┌──────────────────┬───────────┐                               │
│  │                  │ Product 2 │                               │
│  │   Hero Product   ├───────────┤                               │
│  │   (large card)   │ Product 3 │                               │
│  └──────────────────┴───────────┘                               │
│  Uses: FeaturedBucketsShowcase data (first 3 featured products) │
├─────────────────────────────────────────────────────────────────┤
│ SECTION: "Our Collection" (bg-neutral-50)                       │
│  Inline filter tabs: All | Category 1 | Category 2 | ...       │
│  Search bar (inline, minimal border-bottom style)               │
│  Product grid: 3-col desktop, 2-col tablet, 1-col mobile       │
│  Uses: ProductSearch, CategoryMobileDropdown (mobile),          │
│        ProductCategorySidebar (hidden; filters are inline tabs) │
│        EnhancedProductDisplay                                   │
│  Pagination (bottom)                                            │
├─────────────────────────────────────────────────────────────────┤
│ EDITORIAL STORY SECTION (full-width, bg-white)                  │
│  2-col: Image | "About {storeName}" + description               │
│  Social links as icon-only row beneath description              │
│  Uses: tenant.metadata.businessDescription, social_links        │
├─────────────────────────────────────────────────────────────────┤
│ FEATURED BUCKETS (horizontal scroll carousels)                  │
│  Each bucket type as a horizontal scroll row                    │
│  Section header with type icon + "View All" link                │
│  Uses: FeaturedBucketsShowcase (re-composed as carousels)       │
├─────────────────────────────────────────────────────────────────┤
│ STORE INFORMATION (3-col, bg-neutral-50)                        │
│  Card 1: Visit Us (address + map embed)                         │
│  Card 2: Hours (BusinessHoursCollapsible)                       │
│  Card 3: Get in Touch (contact + fulfillment)                   │
│  Uses: Same components, recomposed into card layout             │
├─────────────────────────────────────────────────────────────────┤
│ SOCIAL PROOF (bg-white)                                         │
│  StoreRatingDisplay (centered, max-w-3xl)                       │
│  "What Our Customers Say" heading                               │
├─────────────────────────────────────────────────────────────────┤
│ FAQ ACCORDION (conditional, bg-neutral-50)                      │
│  FaqStorefrontDisplay (centered, max-w-3xl)                     │
├─────────────────────────────────────────────────────────────────┤
│ INQUIRY FORM (conditional, bg-white)                            │
│  PublicInquiryForm (centered, max-w-lg)                         │
├─────────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS + RECENTLY VIEWED                               │
│  StorefrontRecommendations                                      │
│  LastViewed                                                     │
├─────────────────────────────────────────────────────────────────┤
│ ENHANCED FOOTER                                                 │
│  4-col: Brand | Quick Links | Store Info | Newsletter/QR        │
│  Platform branding (subtle, bottom)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Key Differences from Classic

| Aspect | Classic (A) | Editorial (B) |
|--------|-------------|----------------|
| Header | Dense — logo, pills, badges, actions | Minimal — logo, search icon, cart icon |
| Trust signals | Rating in About section | Compact trust bar directly below header |
| Hero | None | Full-width banner with overlay CTA |
| Featured products | Jump-nav pills + bucketed sections below catalog | Asymmetric spotlight above catalog |
| Category nav | Left sidebar (desktop) | Inline tab pills above grid |
| About section | Above catalog, 2-col with rating | Below catalog, editorial 2-col with image |
| Store info | 3-col grid below featured | 3-col card layout, cleaner separation |
| Footer | Minimal links | Full 4-column informational footer |
| Overall feel | Dense, information-rich | Spacious, curated, brand-forward |

### 6.5 Component Mapping

Every section uses existing components — just recomposed:

| Editorial Section | Existing Components Used |
|---|---|
| Minimal Header | Logo extraction from `StorefrontClientWrapper`, `HoursStatusBadge`, cart from `useMultiCart` |
| Trust Bar | `StoreRatingDisplay` (compact mode), `HoursStatusBadge` (inline) |
| Hero Banner | `tenant.metadata` (banner_url, logo_url), `GBPCategoryBadges` |
| Featured Spotlight | `FeaturedBucketsShowcase` data → custom asymmetric grid of `SmartProductCard` |
| Collection Grid | `ProductSearch`, `CategoryMobileDropdown`, `EnhancedProductDisplay`, `Pagination` |
| Story Section | `tenant.metadata.businessDescription`, social_links rendering |
| Store Info Cards | `BusinessHoursCollapsible`, `GoogleMapEmbed`/`TenantMapSection`/`StorefrontMap`, `FulfillmentOptionsPane` |
| Social Proof | `StoreRatingDisplay` |
| FAQ | `FaqStorefrontDisplay` |
| Inquiry | `PublicInquiryForm` |
| Recommendations | `StorefrontRecommendations`, `LastViewed` |

---

## 7. Layout C — Immersive Commerce

### 7.1 Design Philosophy

Inspired by high-conversion e-commerce (Amazon, Best Buy, ASOS). Prioritizes **product discovery speed**, filtering efficiency, and a frictionless path to cart. Best for merchants with large catalogs, diverse categories, and commerce-enabled storefronts.

### 7.2 Visual Language

- **Color**: Strong primary accent for CTAs; high-contrast badges; white product canvas
- **Typography**: Compact but clear; `text-sm` body, `text-lg` headings; utility-first
- **Spacing**: Tighter — `py-8 lg:py-12`; every pixel earns its place
- **Cards**: Bordered, compact, information-dense; quick-add overlay on hover
- **Grid**: Dense — 4-col desktop, 3-col tablet, 2-col mobile; no wasted space

### 7.3 Page Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ STICKY HEADER                                                   │
│  Logo (left) | Inline Search bar (center, expanded) |           │
│  Cart + Account icons (right)                                   │
│  Category mega-menu bar (below, horizontal scroll on mobile)    │
│  Uses: ProductSearch (inline), CategoryMobileDropdown,          │
│        ProductCategorySidebar data as horizontal tabs            │
├─────────────────────────────────────────────────────────────────┤
│ PRODUCT HERO STRIP (compact, bg-primary-50)                     │
│  Horizontal scroll: 4-6 featured products as compact cards      │
│  "Trending Now" / "Staff Picks" / "On Sale" tabs to switch      │
│  Uses: FeaturedBucketsShowcase data, SmartProductCard (compact)  │
├─────────────────────────────────────────────────────────────────┤
│ FILTER + SORT BAR (sticky below header on scroll)               │
│  Filter chips: Category | Price Range | Availability |          │
│  Sort dropdown: Relevance | Price Low-High | Newest | Rating    │
│  Results count: "Showing 1-12 of 347 products"                  │
│  View toggle: Grid (default) | List | Compact                   │
│  Uses: Categories data, EnhancedProductDisplay controls          │
├─────────────────────────────────────────────────────────────────┤
│ MAIN PRODUCT GRID (full-width, no sidebar)                      │
│  Dense grid: 4-col (xl), 3-col (lg), 2-col (sm), 1-col (xs)   │
│  Product cards: compact variant with quick-add button overlay   │
│  Scroll-triggered loading indicator (pagination or load more)   │
│  Uses: EnhancedProductDisplay, SmartProductCard                  │
│  Pagination at bottom                                           │
├─────────────────────────────────────────────────────────────────┤
│ FEATURED SECTIONS (tabbed, not stacked)                         │
│  Tab bar: New Arrivals | Sale | Staff Picks | Trending          │
│  Single horizontal carousel per active tab                      │
│  Uses: FeaturedBucketsShowcase data, tabbed instead of stacked  │
├─────────────────────────────────────────────────────────────────┤
│ QUICK STORE INFO (compact, single row, bg-neutral-50)           │
│  Inline: 📍 Address | 🕐 Open until 9pm | 📞 (555) 123-4567   │
│  | ★ 4.8 (127 reviews)                                         │
│  Expandable: Click to reveal full hours, map, contact details   │
│  Uses: contactInfo, HoursStatusBadge, StoreRatingDisplay        │
├─────────────────────────────────────────────────────────────────┤
│ REVIEWS (compact, bg-white)                                     │
│  StoreRatingDisplay (compact: summary bar + 3 recent reviews)   │
├─────────────────────────────────────────────────────────────────┤
│ FAQ + INQUIRY (side-by-side on desktop, bg-neutral-50)          │
│  ┌─────────────────────┬─────────────────────┐                  │
│  │  FAQ Accordion       │  Inquiry Form       │                  │
│  └─────────────────────┴─────────────────────┘                  │
│  Uses: FaqStorefrontDisplay, PublicInquiryForm                   │
├─────────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS + RECENTLY VIEWED (carousels)                   │
│  Horizontal scroll carousels, not grid                          │
│  Uses: StorefrontRecommendations, LastViewed                     │
├─────────────────────────────────────────────────────────────────┤
│ COMPACT FOOTER                                                  │
│  2-col: Store info + links | Payment icons + policies            │
│  Platform branding (bottom line)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Key Differences from Classic

| Aspect | Classic (A) | Immersive (C) |
|--------|-------------|----------------|
| Header | Static, dense | Sticky, search-focused, with category mega-menu |
| Product placement | Below About section + Featured nav | Immediately after header (< 200px) |
| Category nav | Left sidebar (desktop) | Horizontal tab bar (sticky filter strip) |
| Grid density | 3-4 col, generous spacing | 4 col dense, compact cards with quick-add |
| Featured sections | Vertically stacked buckets | Tabbed carousel (single row visible) |
| Store info | Full 3-col section | Compact single-row with expand-on-click |
| FAQ + Inquiry | Separate full-width sections | Side-by-side 2-col on desktop |
| Overall feel | Informational, browsing | Transactional, discovery-optimized |

### 7.5 Component Mapping

| Immersive Section | Existing Components Used |
|---|---|
| Sticky Header | Logo, `ProductSearch` (expanded), `useMultiCart` cart icon |
| Category Mega-Menu | `ProductCategorySidebar` data rendered as horizontal tabs |
| Product Hero Strip | `FeaturedBucketsShowcase` data → horizontal carousel of `SmartProductCard` (compact) |
| Filter + Sort Bar | `categories` data as filter chips, `EnhancedProductDisplay` view controls |
| Product Grid | `EnhancedProductDisplay`, `SmartProductCard`, `Pagination` |
| Featured Tabs | `FeaturedBucketsShowcase` data → tabbed interface |
| Quick Store Info | `contactInfo`, `HoursStatusBadge`, `StoreRatingDisplay` (inline) |
| Reviews | `StoreRatingDisplay` |
| FAQ + Inquiry | `FaqStorefrontDisplay`, `PublicInquiryForm` |
| Recommendations | `StorefrontRecommendations`, `LastViewed` |

---

## 8. Shared Component Enhancements

These enhancements benefit **all three layouts** and can be implemented independently. They are additive — new props/modes on existing components, not replacements.

### 8.1 SmartProductCard — New `compact` Variant

```typescript
// Existing variants: 'classic' | 'enhanced' | 'compact' | 'premium' | 'zoom'
// Enhancement: refine 'compact' for immersive layout use

// New optional props:
interface SmartProductCardEnhancements {
  showQuickAdd?: boolean;       // Overlay add-to-cart on hover
  showQuickView?: boolean;      // "Quick View" eye icon on hover
  imageAspectRatio?: '1:1' | '4:3' | '3:4' | '16:9';  // Configurable aspect
  truncateTitle?: number;       // Max chars before ellipsis
}
```

**UX Enhancement**: On hover, a translucent overlay slides up from the bottom with "Quick Add" and "Quick View" buttons. This accelerates the add-to-cart flow without requiring page navigation.

### 8.2 EnhancedProductDisplay — Carousel Mode

```typescript
// New optional props:
interface EnhancedProductDisplayEnhancements {
  displayMode?: 'grid' | 'list' | 'gallery' | 'carousel';  // NEW: carousel
  carouselConfig?: {
    slidesPerView: number;
    autoplay?: boolean;
    peek?: boolean;      // Show edge of next slide
    snap?: boolean;      // Snap to slide boundaries
  };
}
```

The carousel mode reuses the existing card rendering but arranges cards in a horizontal scroll container with CSS scroll-snap and optional autoplay. Uses `@mantine/carousel` (already a dependency).

### 8.3 StoreRatingDisplay — Compact Inline Mode

```typescript
// New optional prop:
interface StoreRatingDisplayEnhancements {
  variant?: 'full' | 'compact' | 'inline';  // NEW: inline for trust bars
  // inline: "★ 4.8 (127 reviews)" — single line, no breakdown
  // compact: Summary bar + 3 most recent reviews
  // full: Current behavior (default)
}
```

### 8.4 ProductSearch — Expanded Inline Mode

```typescript
// New optional prop:
interface ProductSearchEnhancements {
  variant?: 'default' | 'inline' | 'hero';
  // default: Current behavior
  // inline: No border radius, blends into header bar
  // hero: Large, centered, with subtle background blur
  autoFocus?: boolean;
  placeholder?: string;  // Custom placeholder text
}
```

### 8.5 FeaturedBucketsShowcase — Carousel & Tabbed Modes

```typescript
// New optional prop:
interface FeaturedBucketsShowcaseEnhancements {
  displayMode?: 'stacked' | 'carousel' | 'tabbed';
  // stacked: Current behavior (default) — each bucket as a section
  // carousel: Each bucket as a horizontal scroll carousel
  // tabbed: All buckets behind tab interface, one visible at a time
}
```

### 8.6 New Shared Utility Components

These are small, reusable pieces needed by Layout B and C:

#### TrustSignalsBar
A compact, single-line bar showing key trust signals:
```
★ 4.8 (127 reviews) · Open until 9pm · Free shipping over $50
```
Composes: `StoreRatingDisplay` (inline), `HoursStatusBadge` (inline), merchant metadata.

#### SectionDivider
Themed dividers between major sections. Three variants:
- `gradient`: Existing gradient line (`via-purple-500`)
- `subtle`: Thin `border-b border-neutral-100 dark:border-neutral-800`
- `spacer`: Empty div with configurable height

#### StorefrontFooter (Enhanced)
Extracted from the current footer in `StorefrontClientWrapper` and enhanced:
- 4-column layout: Brand info | Navigation | Store details | Connect (QR + social)
- Policy links row (if configured)
- Platform branding line
- All layouts share this component

---

## 9. Mobile-First UX Patterns

### 9.1 Sticky Elements Strategy

| Element | Classic (A) | Editorial (B) | Immersive (C) |
|---------|-------------|----------------|----------------|
| Header | Static | Static (scroll reveals mini-header) | Sticky always |
| Search | Inline in catalog section | Inline in collection section | Sticky in header |
| Cart | Floating widget (existing) | Floating widget | Sticky icon in header + floating widget |
| Filter bar | N/A | N/A | Sticky below header |
| "Back to top" | N/A | Appears after 2 screens of scroll | Appears after 2 screens of scroll |

### 9.2 Mobile Navigation Patterns

#### Current (Classic)
- Horizontal scroll pills for navigation
- `CategoryMobileDropdown` for categories
- No sticky elements

#### Editorial (Mobile)
```
┌────────────────────────────────┐
│ ☰  Logo          🔍  🛒(2)    │  ← Sticky mini-header (appears on scroll)
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │     HERO IMAGE             │ │  ← Full-width banner
│ │     Store Name             │ │
│ │   [Browse Collection →]    │ │
│ └────────────────────────────┘ │
│                                │
│ ★ 4.8 · Open Now · Free Ship  │  ← Trust bar
│                                │
│ ┌─────────┐ ┌─────────┐       │
│ │Featured │ │Featured │       │  ← Featured cards (2-col, swipeable)
│ │Product 1│ │Product 2│       │
│ └─────────┘ └─────────┘       │
│                                │
│ Our Collection                 │
│ [All] [Cat 1] [Cat 2] [→]     │  ← Scrollable category tabs
│ ┌─────────────────────────┐   │
│ │   🔍 Search products... │   │  ← Search input
│ └─────────────────────────┘   │
│ ┌─────────┐ ┌─────────┐       │
│ │Product  │ │Product  │       │  ← 2-col product grid
│ │Card     │ │Card     │       │
│ └─────────┘ └─────────┘       │
```

#### Immersive (Mobile)
```
┌────────────────────────────────┐
│ Logo   [🔍 Search...    ] 🛒(2)│  ← Sticky header with inline search
├────────────────────────────────┤
│ [All] [Cat1] [Cat2] [Cat3] [→]│  ← Sticky category tabs (scroll)
├────────────────────────────────┤
│ ← Trending Now →               │  ← Swipeable featured strip
│ ┌─────┐┌─────┐┌─────┐         │
│ │ P1  ││ P2  ││ P3  │→        │
│ └─────┘└─────┘└─────┘         │
├────────────────────────────────┤
│ 347 products  [Filter▾] [Sort▾]│  ← Sticky filter bar
├────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐       │
│ │Product  │ │Product  │       │  ← Dense 2-col grid
│ │+ Add    │ │+ Add    │       │
│ └─────────┘ └─────────┘       │
│ ┌─────────┐ ┌─────────┐       │
│ │Product  │ │Product  │       │
│ │+ Add    │ │+ Add    │       │
│ └─────────┘ └─────────┘       │
```

### 9.3 Touch Interaction Patterns

| Interaction | Implementation |
|---|---|
| Product card quick-add | Long-press (300ms) reveals add-to-cart; alternative: visible "+" button |
| Category filter | Bottom sheet slide-up panel (mobile); click to open, swipe down to close |
| Image gallery | Swipe horizontal with snap; pinch-to-zoom |
| Featured carousel | CSS `scroll-snap-type: x mandatory` + `overscroll-behavior: contain` |
| Back to top | Floating pill button, appears after 1000px scroll, fades in |
| Cart preview | Swipe left on cart widget to expand mini-cart |

### 9.4 Responsive Breakpoint Usage

| Breakpoint | Grid Cols (A) | Grid Cols (B) | Grid Cols (C) |
|------------|---------------|----------------|----------------|
| `< 640px` (xs) | 1 | 1 | 2 (compact) |
| `640px` (sm) | 2 | 2 | 2 |
| `768px` (md) | 2 | 2 | 3 |
| `1024px` (lg) | 3 | 3 | 3 |
| `1280px` (xl) | 4 | 3 | 4 |
| `1536px` (2xl) | 4 | 3 (max-w constrained) | 5 |

---

## 10. Visual Polish & Design Token Additions

### 10.1 New CSS Custom Properties

Add to `globals.css` under the existing design system section:

```css
/* Layout-specific tokens */
--layout-max-width-editorial: 1200px;
--layout-max-width-immersive: 1536px;
--layout-max-width-classic: 1280px;

/* Section spacing scale */
--section-gap-sm: 2rem;     /* 32px - compact sections */
--section-gap-md: 3rem;     /* 48px - standard sections */
--section-gap-lg: 4rem;     /* 64px - major section breaks */
--section-gap-xl: 5rem;     /* 80px - hero/editorial breaks */

/* Card elevation tokens */
--card-shadow-flat: none;
--card-shadow-raised: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
--card-shadow-elevated: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
--card-shadow-hover: 0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06);

/* Transition tokens */
--transition-card: transform 200ms ease, box-shadow 200ms ease;
--transition-fade: opacity 300ms ease;
--transition-slide: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);

/* Section background alternation */
--section-bg-primary: var(--color-white);
--section-bg-secondary: var(--color-neutral-50);
--section-bg-primary-dark: var(--color-neutral-900);
--section-bg-secondary-dark: var(--color-neutral-850);
```

### 10.2 Utility Classes

Add to `globals.css` or a new `layout-utilities.css`:

```css
/* Card interaction */
.card-lift {
  transition: var(--transition-card);
}
.card-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-hover);
}

/* Section alternation */
.section-alt:nth-child(even) {
  background-color: var(--section-bg-secondary);
}
.dark .section-alt:nth-child(even) {
  background-color: var(--section-bg-secondary-dark);
}

/* Scroll-triggered fade-in */
.fade-in-section {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.fade-in-section.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Sticky utilities */
.sticky-below-header {
  position: sticky;
  top: var(--header-height, 64px);
  z-index: 30;
  backdrop-filter: blur(8px);
  background-color: rgba(255, 255, 255, 0.9);
}
.dark .sticky-below-header {
  background-color: rgba(23, 23, 23, 0.9);
}
```

### 10.3 Animation Utilities

For scroll-triggered animations, a lightweight `useIntersectionFadeIn` hook:

```typescript
// hooks/useIntersectionFadeIn.ts
// Adds 'visible' class to elements with 'fade-in-section' class
// when they enter the viewport (Intersection Observer)
// Respects prefers-reduced-motion
```

### 10.4 Typography Scale Comparison

| Level | Classic (A) | Editorial (B) | Immersive (C) |
|-------|-------------|----------------|----------------|
| Hero | — | `text-4xl lg:text-6xl font-bold tracking-tight` | — |
| Section | `text-3xl font-bold` | `text-3xl lg:text-4xl font-semibold tracking-tight` | `text-xl font-bold` |
| Subsection | `text-xl font-bold` | `text-xl font-medium` | `text-lg font-semibold` |
| Body | `text-base` | `text-base leading-relaxed` | `text-sm leading-normal` |
| Caption | `text-sm text-neutral-600` | `text-sm text-neutral-500 tracking-wide uppercase` | `text-xs text-neutral-500` |
| Price | `text-lg font-bold` | `text-lg font-medium` | `text-base font-bold text-primary-600` |

---

## 11. Tier & Capability Gating

### 11.1 New Capability: `storefront_layout`

This follows the existing capability gate pattern. Add to the storefront_options capability group:

```
storefront_options (main gate - hard)
  ├── ... (existing sub-gates)
  └── Storefront Layout (feature gate) → layout_classic, layout_editorial, layout_immersive
```

### 11.2 Tier Availability Matrix

| Capability Key | Free | Starter | Growth | Pro | Enterprise |
|---|---|---|---|---|---|
| `layout_classic` | Yes | Yes | Yes | Yes | Yes |
| `layout_editorial` | No | No | Yes | Yes | Yes |
| `layout_immersive` | No | No | No | Yes | Yes |

### 11.3 Backend Changes

#### Database: `tenant_capabilities` Table

The `storefront_layout` preference is stored as a tenant setting, resolved through the capability pipeline:

```sql
-- New setting key in tenant_settings
-- key: 'storefront_layout'
-- value: 'classic' | 'editorial' | 'immersive'
-- default: 'classic'
```

#### API: StorefrontOptionsService.ts

Add layout resolution to the existing options service:

```typescript
// New types
export type StorefrontLayoutType = 'layout_classic' | 'layout_editorial' | 'layout_immersive';
export const LAYOUT_TYPES: StorefrontLayoutType[] = ['layout_classic', 'layout_editorial', 'layout_immersive'];

// New fields in StorefrontOptionsState
interface StorefrontOptionsState {
  // ... existing fields
  layoutEnabled: boolean;
  allowedLayoutTypes: StorefrontLayoutType[];
  selectedLayout: 'classic' | 'editorial' | 'immersive';
}
```

#### Public API Response

Add to the `/api/public/tenant/:tenantId/storefront-options` response:

```typescript
interface StorefrontOptionFlags {
  // ... existing flags
  storefrontLayout: 'classic' | 'editorial' | 'immersive';
  allowedLayouts: string[];  // For showing available options in settings
}
```

### 11.4 Frontend Changes

#### PublicStorefrontOptionsService.ts

```typescript
interface StorefrontOptionFlags {
  // ... existing flags
  storefrontLayout: 'classic' | 'editorial' | 'immersive';
  allowedLayouts: ('classic' | 'editorial' | 'immersive')[];
}
```

#### storefrontOptions.ts

Add layout type metadata:

```typescript
const STOREFRONT_LAYOUT_META = {
  layout_classic: {
    key: 'layout_classic',
    label: 'Classic',
    description: 'Traditional storefront layout with sidebar navigation and stacked sections',
    group: 'layout',
    icon: '📋',
    color: 'blue',
    selectionMode: 'radio' as const,
    preview: '/images/layout-previews/classic-preview.png',
  },
  layout_editorial: {
    key: 'layout_editorial',
    label: 'Modern Editorial',
    description: 'Spacious, brand-forward layout with hero banner and curated product showcase',
    group: 'layout',
    icon: '✨',
    color: 'purple',
    selectionMode: 'radio' as const,
    preview: '/images/layout-previews/editorial-preview.png',
  },
  layout_immersive: {
    key: 'layout_immersive',
    label: 'Immersive Commerce',
    description: 'Product-first layout with sticky search, dense grid, and fast add-to-cart',
    group: 'layout',
    icon: '🛒',
    color: 'emerald',
    selectionMode: 'radio' as const,
    preview: '/images/layout-previews/immersive-preview.png',
  },
};
```

---

## 12. Merchant Settings UI

### 12.1 Location

Add a new section to the existing **Storefront Options** settings page:
`apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx`

### 12.2 UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ Storefront Layout                                           │
│ Choose how your storefront appears to customers             │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │             │ │             │ │             │            │
│ │  [Preview]  │ │  [Preview]  │ │  [Preview]  │            │
│ │             │ │             │ │             │            │
│ │  Classic    │ │  Editorial  │ │  Immersive  │            │
│ │  ● Active   │ │  ○ Select   │ │  🔒 Pro+    │            │
│ │             │ │             │ │             │            │
│ │ Traditional │ │ Brand-first │ │ Product-    │            │
│ │ sidebar +   │ │ hero banner │ │ first with  │            │
│ │ stacked     │ │ + curated   │ │ sticky      │            │
│ │ sections    │ │ showcase    │ │ search      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ Preview your storefront →                                   │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Behavior

- Radio-select: Only one layout active at a time
- Locked layouts show the tier required to unlock them
- "Preview" button opens the storefront in a new tab with `?layout_preview=editorial` (temporary preview without saving)
- Save triggers the standard storefront-options PATCH endpoint
- Changes take effect on next page load (15-minute cache TTL, or bust cache on save)

---

## 13. Technical Implementation

### 13.1 page.tsx Modification

The only change to the existing server component:

```typescript
// In page.tsx — after fetching storefrontOptionFlags
const storefrontLayout = storefrontOptionFlags?.storefrontLayout || 'classic';

// Layout preview support (for merchant preview without saving)
const layoutPreview = searchParams?.layout_preview;
const effectiveLayout = layoutPreview || storefrontLayout;

// Render the selected layout
switch (effectiveLayout) {
  case 'editorial':
    return (
      <ProductSingletonProvider tenantId={resolvedTenant.id}>
        <StorefrontEditorialLayout {...sharedProps} layoutVariant="editorial" />
      </ProductSingletonProvider>
    );
  case 'immersive':
    return (
      <ProductSingletonProvider tenantId={resolvedTenant.id}>
        <StorefrontImmersiveLayout {...sharedProps} layoutVariant="immersive" />
      </ProductSingletonProvider>
    );
  default:
    return (
      <ProductSingletonProvider tenantId={resolvedTenant.id}>
        <StorefrontClientWrapper {...sharedProps} layoutVariant="classic" />
      </ProductSingletonProvider>
    );
}
```

### 13.2 Layout File Architecture

Each layout file follows the same pattern:

```typescript
// StorefrontEditorialLayout.tsx
"use client";

import React from 'react';
// Import SAME components as StorefrontClientWrapper
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import ProductSearch from '@/components/storefront/ProductSearch';
import FeaturedBucketsShowcase from '@/components/storefront/FeaturedBucketsShowcase';
// ... etc

// Import NEW shared layout components
import { TrustSignalsBar } from './layouts/shared/TrustSignalsBar';
import { HeroBanner } from './layouts/shared/HeroBanner';
import { StorefrontFooter } from './layouts/shared/StorefrontFooter';
import { SectionDivider } from './layouts/shared/SectionDivider';

// SAME props interface
import type { StorefrontClientWrapperProps } from './StorefrontClientWrapper';

export default function StorefrontEditorialLayout(props: StorefrontClientWrapperProps) {
  // SAME hooks and state logic as StorefrontClientWrapper
  // (extract shared logic into a custom hook: useStorefrontState)
  
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      {/* Recomposed layout using same components, different arrangement */}
    </div>
  );
}
```

### 13.3 Shared State Extraction

To avoid duplicating the ~100 lines of state/hook logic across all three layouts, extract into a shared hook:

```typescript
// layouts/hooks/useStorefrontState.ts
export function useStorefrontState(props: StorefrontClientWrapperProps) {
  // All the shared state: featuredData, contactInfo, hoursStatus,
  // storefrontStatus, storefrontCap, visibility flags, etc.
  
  return {
    logoUrl,
    contactInfo,
    hoursStatus,
    storefrontStatus,
    featuredData,
    featuredCounts,
    isRetailStore,
    isOnlineStore,
    showsHours,
    showsMap,
    showsLocation,
    // ... all computed values
  };
}
```

This hook is called by all three layout files, ensuring consistent behavior.

### 13.4 Dynamic Imports (Performance)

The editorial and immersive layouts are loaded only when needed:

```typescript
// layouts/LayoutRouter.tsx
import dynamic from 'next/dynamic';

const StorefrontEditorialLayout = dynamic(
  () => import('../StorefrontEditorialLayout'),
  { loading: () => <StorefrontSkeleton /> }
);

const StorefrontImmersiveLayout = dynamic(
  () => import('../StorefrontImmersiveLayout'),
  { loading: () => <StorefrontSkeleton /> }
);
```

This ensures Layout B and C don't add bundle size for merchants using Classic.

### 13.5 SEO Considerations

All three layouts render the same content (same products, same store info), just in different arrangements. SEO metadata in `page.tsx` is layout-agnostic — no changes needed. Structured data (JSON-LD) is also shared.

---

## 14. Phased Rollout Plan

### Phase 1 — Foundation (Week 1-2)

**Goal**: Extract shared logic, build infrastructure, zero visual changes.

| Task | Files | Risk |
|------|-------|------|
| Export `StorefrontClientWrapperProps` as a named type | `StorefrontClientWrapper.tsx` | Low |
| Extract `useStorefrontState` hook from StorefrontClientWrapper | `layouts/hooks/useStorefrontState.ts` | Medium — must verify all state logic transfers correctly |
| Verify StorefrontClientWrapper still works identically with extracted hook | `StorefrontClientWrapper.tsx` | Low |
| Create `SectionDivider` component | `layouts/shared/SectionDivider.tsx` | Low |
| Create `StorefrontFooter` component (extract from current footer) | `layouts/shared/StorefrontFooter.tsx` | Low |
| Create `TrustSignalsBar` component | `layouts/shared/TrustSignalsBar.tsx` | Low |
| Add design tokens to `globals.css` | `globals.css` | Low |
| Add `useIntersectionFadeIn` hook | `hooks/useIntersectionFadeIn.ts` | Low |

**Validation**: Current storefront renders identically. No visual or behavioral changes.

### Phase 2 — Backend & Settings (Week 2-3)

**Goal**: Add layout capability to the tier system and merchant settings.

| Task | Files | Risk |
|------|-------|------|
| Add `layout_classic`, `layout_editorial`, `layout_immersive` to capability definitions | API capability config | Medium |
| Add tier mappings for layout capabilities | Tier config files | Medium |
| Add `storefront_layout` to StorefrontOptionsService | `StorefrontOptionsService.ts` | Medium |
| Add `storefrontLayout` to public storefront options response | API route handler | Low |
| Update `PublicStorefrontOptionsService.ts` with layout flag | Frontend service | Low |
| Update `storefrontOptions.ts` with layout metadata | Frontend utils | Low |
| Add layout selector section to StorefrontOptionsSettingsClient | Settings UI | Medium |
| Create layout preview images (static screenshots or Figma exports) | Public assets | Low |

**Validation**: Merchants can see and select layouts in settings. Classic remains default. Selection persists but doesn't change the storefront yet.

### Phase 3 — Layout B: Modern Editorial (Week 3-5)

**Goal**: Build and launch the editorial layout.

| Task | Files | Risk |
|------|-------|------|
| Create `HeroBanner` component | `layouts/shared/HeroBanner.tsx` | Low |
| Create `StorefrontEditorialLayout.tsx` | `StorefrontEditorialLayout.tsx` | High — primary deliverable |
| Implement inline category tabs (reusing category data) | Within editorial layout | Medium |
| Implement asymmetric featured spotlight | Within editorial layout | Medium |
| Add `displayMode: 'carousel'` to FeaturedBucketsShowcase | `FeaturedBucketsShowcase.tsx` | Medium |
| Add `variant: 'inline'` to StoreRatingDisplay | `StoreRatingDisplay.tsx` | Low |
| Add layout router switch to `page.tsx` | `page.tsx` | Medium |
| Add `?layout_preview` query param support | `page.tsx` | Low |
| Responsive testing (mobile, tablet, desktop) | — | Medium |
| Dark mode testing | — | Low |
| Accessibility audit (WCAG 2.1 AA) | — | Medium |

**Validation**: Merchants on Growth+ tiers can select Editorial. It renders correctly on all viewports. Classic layout is unaffected.

### Phase 4 — Layout C: Immersive Commerce (Week 5-7)

**Goal**: Build and launch the immersive commerce layout.

| Task | Files | Risk |
|------|-------|------|
| Create `StickySearchBar` component | `layouts/shared/StickySearchBar.tsx` | Medium |
| Create `StorefrontImmersiveLayout.tsx` | `StorefrontImmersiveLayout.tsx` | High — primary deliverable |
| Implement sticky header with inline search | Within immersive layout | Medium |
| Implement horizontal category mega-menu | Within immersive layout | Medium |
| Implement dense product grid with quick-add overlay | Within immersive layout | High |
| Add `displayMode: 'tabbed'` to FeaturedBucketsShowcase | `FeaturedBucketsShowcase.tsx` | Medium |
| Add `variant: 'compact'` refinements to SmartProductCard | `SmartProductCard.tsx` | Medium |
| Implement filter + sort bar | Within immersive layout | Medium |
| Side-by-side FAQ + Inquiry layout | Within immersive layout | Low |
| Responsive testing | — | Medium |
| Dark mode testing | — | Low |
| Performance testing (dense grid with many products) | — | Medium |
| Accessibility audit | — | Medium |

**Validation**: Merchants on Pro+ tiers can select Immersive. Dense grid performs well with 50+ products. Cart interactions are smooth.

### Phase 5 — Polish & Optimization (Week 7-8)

**Goal**: Cross-layout polish, performance optimization, and monitoring.

| Task | Files | Risk |
|------|-------|------|
| Add scroll-triggered fade-in animations (all layouts) | Shared hook + CSS | Low |
| Optimize dynamic imports and code splitting | Layout router | Low |
| Add layout analytics tracking (which layout, conversion rates) | Behavior tracking | Low |
| Performance audit: Core Web Vitals per layout | — | Medium |
| Create layout preview thumbnails for settings page | Static assets | Low |
| Documentation: update AGENTS.md with layout system docs | `AGENTS.md` | Low |
| Optional: Classic layout CSS-only polish pass | `StorefrontClientWrapper.tsx` | Low |

**Validation**: All three layouts meet performance budgets. Analytics tracking works.

---

## 15. File Manifest

### New Files

| File | Type | Phase | Description |
|------|------|-------|-------------|
| `app/tenant/[id]/StorefrontEditorialLayout.tsx` | Client Component | 3 | Layout B wrapper |
| `app/tenant/[id]/StorefrontImmersiveLayout.tsx` | Client Component | 4 | Layout C wrapper |
| `app/tenant/[id]/layouts/LayoutRouter.tsx` | Client Component | 3 | Dynamic import router |
| `app/tenant/[id]/layouts/shared/StorefrontHeader.tsx` | Client Component | 1 | Shared header variants |
| `app/tenant/[id]/layouts/shared/StorefrontFooter.tsx` | Client Component | 1 | Enhanced footer |
| `app/tenant/[id]/layouts/shared/TrustSignalsBar.tsx` | Client Component | 1 | Compact trust signals |
| `app/tenant/[id]/layouts/shared/HeroBanner.tsx` | Client Component | 3 | Hero banner for editorial |
| `app/tenant/[id]/layouts/shared/StickySearchBar.tsx` | Client Component | 4 | Sticky search for immersive |
| `app/tenant/[id]/layouts/shared/SectionDivider.tsx` | Client Component | 1 | Themed section separators |
| `app/tenant/[id]/layouts/hooks/useStorefrontState.ts` | Hook | 1 | Extracted shared state logic |
| `hooks/useIntersectionFadeIn.ts` | Hook | 1 | Scroll-triggered animations |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `app/tenant/[id]/page.tsx` | 3 | Add layout router switch + preview param |
| `app/tenant/[id]/StorefrontClientWrapper.tsx` | 1 | Export props type; optionally use extracted hook |
| `components/storefront/FeaturedBucketsShowcase.tsx` | 3-4 | Add `displayMode` prop (carousel/tabbed) |
| `components/reviews/StoreRatingDisplay.tsx` | 3 | Add `variant` prop (inline/compact) |
| `components/storefront/ProductSearch.tsx` | 3 | Add `variant` prop (inline/hero) |
| `components/products/SmartProductCard.tsx` | 4 | Add quick-add overlay props |
| `services/PublicStorefrontOptionsService.ts` | 2 | Add `storefrontLayout` + `allowedLayouts` |
| `utils/storefrontOptions.ts` | 2 | Add layout type metadata |
| `app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx` | 2 | Add layout selector section |
| `app/globals.css` | 1 | Add design tokens + utility classes |
| API: `StorefrontOptionsService.ts` | 2 | Add layout capability resolution |
| API: `storefront-options-settings.ts` | 2 | Add layout to settings endpoint |

### Preserved (Untouched) Files

All existing storefront and product components remain unchanged unless explicitly listed as modified above. The Classic layout (`StorefrontClientWrapper.tsx`) continues to work exactly as it does today.

---

## Appendix A: Layout Comparison Matrix

| Feature | Classic (A) | Editorial (B) | Immersive (C) |
|---------|:-----------:|:--------------:|:--------------:|
| Hero banner | - | Full-width | - |
| Trust signals bar | - | Yes | Yes (in header) |
| Sticky header | - | On scroll | Always |
| Sticky search | - | - | Yes |
| Sticky filter bar | - | - | Yes |
| Category sidebar | Left panel | Inline tabs | Horizontal mega-menu |
| Product grid density | Standard | Spacious | Dense |
| Quick-add overlay | - | - | Yes |
| Featured display | Stacked buckets | Asymmetric spotlight + carousels | Tabbed carousel |
| About section | Above catalog | Below catalog (editorial) | Collapsed |
| Store info | Full 3-col section | Card layout | Compact expandable row |
| FAQ + Inquiry | Separate sections | Separate sections | Side-by-side |
| Footer | Minimal | Full 4-col | Compact 2-col |
| Best for | All merchants | Brand-focused, small catalog | Large catalog, high commerce |

## Appendix B: Performance Budgets

| Metric | Target | Notes |
|--------|--------|-------|
| First Contentful Paint (FCP) | < 1.5s | Server-side rendering helps |
| Largest Contentful Paint (LCP) | < 2.5s | Hero image optimization critical for Layout B |
| Cumulative Layout Shift (CLS) | < 0.1 | Sticky elements must reserve space |
| First Input Delay (FID) | < 100ms | Hydration budget for client components |
| Total JS bundle (per layout) | < 150KB gzipped | Dynamic imports keep layout-specific code separate |
| Image optimization | WebP/AVIF, lazy loading | Next.js Image component handles this |

## Appendix C: Accessibility Checklist (Per Layout)

- [ ] All interactive elements have minimum 44x44px touch targets
- [ ] Color contrast ratios meet WCAG 2.1 AA (4.5:1 body, 3:1 large text)
- [ ] All images have meaningful alt text
- [ ] Keyboard navigation works through entire page flow
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader landmark regions (`main`, `nav`, `header`, `footer`)
- [ ] `prefers-reduced-motion` disables all animations
- [ ] `prefers-color-scheme` works with dark mode
- [ ] Skip-to-content link present
- [ ] Dynamic content updates announced via ARIA live regions

---

*This document serves as the design specification and implementation roadmap. Each phase should be validated independently before proceeding to the next. The Classic layout is never at risk — it is the default fallback and is not modified during any phase.*
