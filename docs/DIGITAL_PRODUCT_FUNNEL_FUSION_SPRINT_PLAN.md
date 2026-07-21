# Product × Funnel Fusion — Full-Spectrum Gap Analysis & Sprint Plan

> **Status:** Architecture Review / Sprint Plan  
> **Date:** 2026-07-21  
> **Depends on:** Product Catalog (product_type: physical | digital | hybrid), Sales Funnels (funnel_options capability), Funnel Checkout Flow (Sprint 3), Coupon-Funnel Convergence (Sprint 9)  
> **Supersedes:** `DIGITAL_PRODUCT_FUNNEL_FUSION_ANALYSIS.md` (§5 Implementation Plan — expanded and restructured)

---

## 1. Executive Summary

The platform has a functional sales funnel engine (order bumps, upsells, downsells, OTOs, coupon offers) and a product catalog that supports physical, digital, and hybrid product types. However, the two systems operate in isolation until the customer reaches checkout. The product page — the primary merchandising surface — is funnel-blind. Digital products, despite being the highest-margin, lowest-friction funnel candidates, receive no specialized layout treatment and are rendered through physical-product layouts designed for gallery + stock + shipping paradigms.

This document delivers a full-spectrum gap analysis across four dimensions — product layouts, funnel architecture, digital product UX, and cross-product-type dynamics — and proposes a 6-sprint implementation plan that:

1. **Introduces a dedicated Digital Product Layout** (`ProductDigitalLayout`) optimized for instant delivery, license/access metadata, and zero-friction checkout
2. **Builds a universal Funnel-Aware Product Page** that surfaces the merchant-designed funnel on the product page across all product types
3. **Makes the funnel architecture product-type-aware** so that step behavior, messaging, and checkout flow adapt to physical/digital/hybrid dynamics
4. **Closes analytics gaps** with preview-to-purchase conversion tracking

---

## 2. Current Architecture Audit

### 2.1 Product Page Layout System

**Three layouts exist**, mapped from storefront layout preferences:

| Storefront Layout | Product Layout | Component | Design Intent |
|---|---|---|---|
| `classic` | `classic` | `TierBasedLandingPage` | Sidebar + product detail + featured products |
| `editorial` | `showcase` | `ProductShowcaseLayout` | 55/45 grid, gallery + purchase panel, bottom sections |
| `immersive` | `quick-commerce` | `ProductQuickCommerceLayout` | Compact sticky header, 45/55 grid, mobile-first |

**Layout resolution:** `resolveProductLayout()` in `@/app/products/[id]/layouts/types.ts` maps storefront layout → product layout, with `?layout_preview=` override.

**Key files:**
- `@/app/products/[id]/page.tsx` — server component, resolves product + tenant + capabilities, renders layout
- `@/app/products/[id]/ProductShowcaseLayout.tsx` — client component, gallery + purchase panel + bottom sections
- `@/app/products/[id]/ProductQuickCommerceLayout.tsx` — client component, compact layout
- `@/app/products/[id]/layouts/types.ts` — layout types + resolution function
- `@/components/landing-page/TierBasedLandingPage.tsx` — classic layout (shared with storefront)
- `@/components/products/sections/ProductGalleryPanel.tsx` — gallery rendering
- `@/components/products/sections/ProductPurchasePanel.tsx` — purchase panel (price, variants, add-to-cart)
- `@/components/products/sections/ProductBottomSections.tsx` — detail tabs, actions, map, hours

### 2.2 Sales Funnel System

**Capability:** `funnel_options` (resolver: `FunnelResolver.ts`)  
**Step Types:** `order_bump` | `upsell` | `downsell` | `oto` | `coupon_offer`  
**Trigger Types:** `product` (entry item match) | `cart_value` (min cart threshold) | `always`

**Funnel touchpoints (current):**

| Touchpoint | When | Component | Surface |
|---|---|---|---|
| Order Bump | Checkout review step (before payment) | `OrderBump.tsx` | Checkout page |
| Upsell/Downsell/OTO | Post-purchase interstitial | `FunnelStepClient.tsx` | `/checkout/funnel/[orderId]/step/[stepId]` |
| Coupon Offer | Post-purchase interstitial | `FunnelStepClient.tsx` | Same interstitial |

**Key files:**
- `@/api/src/services/FunnelEngine.ts` — `getCheckoutFunnel()`, `processOrderBump()`, `processUpsellStep()`, `getNextStepForOrder()`
- `@/api/src/services/FunnelService.ts` — CRUD for funnels + steps
- `@/api/src/services/FunnelAnalyticsService.ts` — event tracking (viewed, accepted, declined)
- `@/api/src/services/resolvers/FunnelResolver.ts` — tier/merchant capability resolution
- `@/api/src/routes/funnel-checkout.ts` — 3 public endpoints (resolve, order-bump, step)
- `@/web/src/services/FunnelCheckoutService.ts` — frontend singleton
- `@/web/src/components/checkout/OrderBump.tsx` — order bump card
- `@/web/src/app/checkout/funnel/[orderId]/step/[stepId]/FunnelStepClient.tsx` — interstitial

### 2.3 Digital Product System

**Product type fields on `ProductData`:**
```typescript
productType?: 'physical' | 'digital' | 'hybrid';
digitalDeliveryMethod?: 'direct_download' | 'external_link' | 'license_key' | 'access_grant';
digitalAssets?: any[];
licenseType?: 'personal' | 'commercial' | 'educational' | 'enterprise';
accessDurationDays?: number;
downloadLimit?: number;
```

**Key files:**
- `@/components/items/DigitalProductConfig.tsx` — merchant configures digital delivery
- `@/components/storefront/sections/DigitalSection.tsx` — storefront digital product grid (3 layout variants)
- `@/components/products/DigitalProductBadge.tsx` — type badge, delivery method badge, access status
- `@/components/products/type-sections/DigitalDownloadInfo.tsx` — download info display
- `@/app/downloads/[tenantId]/[slug]/page.tsx` — download fulfillment page
- `@/services/downloads/PublicDownloadService.ts` — download singleton

### 2.4 What's Already Built (Prior Sprints)

| Sprint | What | Status |
|---|---|---|
| Funnel Sprint 1 | Backend: FunnelEngine, FunnelService, FunnelResolver, routes, migration | ✅ Complete |
| Funnel Sprint 2 | Frontend: FunnelBuilderClient, FunnelListClient, analytics page, capability gating | ✅ Complete |
| Funnel Sprint 3 | Checkout: OrderBump, interstitial page, FunnelStepClient, Stripe funnelNextStep | ✅ Complete |
| Funnel Sprint 9 | Coupon-Funnel Convergence: `coupon_offer` step type, coupon picker in builder | ✅ Complete |
| Digital Products | Product type field, DigitalProductConfig, DigitalSection, DigitalProductBadge, download page | ✅ Complete |

---

## 3. Full-Spectrum Gap Analysis

### 3.1 Product Layout Gaps

| Gap | Impact | Severity |
|---|---|---|
| **No digital-specific product layout** — Digital products render through physical-product layouts with gallery-first, stock-focused, shipping-oriented UX. Digital products don't need gallery dominance, stock counters, or shipping panels — they need delivery method visibility, license terms, instant access messaging, and streamlined checkout. | Digital product pages feel awkward — "Only 3 left in stock" on an unlimited digital download, shipping options on an instant access product. | **High** |
| **No product-type-aware layout routing** — `resolveProductLayout()` maps storefront layout → product layout but ignores `productType`. A digital product on a store with `immersive` storefront gets `quick-commerce` layout, which shows stock counters and fulfillment panes irrelevant to digital goods. | Merchants cannot present digital products optimally without switching their entire storefront layout. | **High** |
| **No delivery method surfacing in purchase panel** — `ProductPurchasePanel` shows price, variants, stock, fulfillment — but not digital delivery method, license type, access duration, or download limit. These are buried in metadata or shown only in `DigitalDownloadInfo` (a secondary section). | Customers don't know what they're getting (download? license key? time-limited access?) until after purchase. | **Medium** |
| **No instant checkout path for digital single-items** — All products go through the same cart → checkout flow. Digital products (especially single-item downloads) could skip the cart entirely and go straight to a streamlined checkout — the "Buy Now → Instant Access" pattern used by Stan Store, Gumroad, and Lemon Squeezy. | Friction for digital impulse purchases. | **Medium** |
| **Classic layout uses `TierBasedLandingPage`** — This is a storefront component repurposed for product pages. It works but wasn't designed for digital products and doesn't expose digital-specific fields in the purchase panel. | Inconsistent digital UX across layouts. | **Low** |

### 3.2 Funnel Architecture Gaps

| Gap | Impact | Severity |
|---|---|---|
| **Funnel is invisible until checkout** — The merchant-designed funnel (order bump, upsell, OTO) only surfaces during checkout and post-purchase. The product page — where the customer is most engaged — shows no funnel context. | Missed opportunity to build purchase intent before checkout. Customers don't know there are bundle savings or upgrade offers until they're already in the payment flow. | **High** |
| **No product-page funnel preview endpoint** — The existing `GET /api/public/funnels/:tenantId/checkout` returns step data but not offer item details (name, image, price, product_type). The product page would need N+1 calls to render offer cards. | Performance barrier for product-page funnel preview. | **High** |
| **Funnel steps are not product-type-aware** — A `coupon_offer` step shows the same "Use on next purchase" CTA regardless of whether the product is physical (drive repeat visit) or digital (apply to this purchase). An `upsell` step doesn't know if the offer item is digital (instant access, no shipping) or physical (ships with order). | Generic messaging reduces funnel conversion for all product types. | **Medium** |
| **No `preview_viewed` / `preview_step_clicked` analytics events** — `FunnelAnalyticsService` tracks `viewed`, `accepted`, `declined` — all checkout-time events. There's no tracking for product-page funnel preview views or clicks, so merchants can't measure preview → checkout conversion. | Blind spot in funnel analytics. Merchants can't A/B test preview vs. no-preview. | **Medium** |
| **No merchant opt-out for product-page preview** — Some merchants may prefer the "surprise factor" of checkout-only funnel offers. There's no `metadata.show_preview` flag on funnels. | Merchants forced into product-page preview even if it hurts their conversion strategy. | **Low** |
| **`cart_value` trigger not applicable on product page** — The product page has no cart, so `trigger_type: 'cart_value'` funnels can't resolve. Only `product` and `always` triggers should resolve on the product page. | Edge case — documented but not enforced in code. | **Low** |

### 3.3 Digital Product UX Gaps

| Gap | Impact | Severity |
|---|---|---|
| **No "What You Get" panel** — Digital products need a clear pre-purchase summary: file format, file size, download limit, license type, access duration. Currently scattered across metadata, `DigitalDownloadInfo`, and `DigitalProductBadge`. | Customer uncertainty reduces digital conversion. | **High** |
| **No access grant flow in checkout** — `access_grant` delivery method has no post-purchase fulfillment path. `direct_download` has the `/downloads/[tenantId]/[slug]` page, but `access_grant` (e.g., course access, membership) has no equivalent. | Incomplete digital delivery for non-download digital products. | **Medium** |
| **No digital-specific order confirmation** — The order success page treats all products the same. Digital products should show "Your download is ready" or "Your access is active" with a direct link, not just "Order confirmed." | Post-purchase confusion for digital customers. | **Medium** |
| **No license key display in order history** — `license_key` delivery method generates keys but the order history page doesn't display them. Customers must know to go to the downloads page. | Poor digital post-purchase experience. | **Low** |

### 3.4 Cross-Product-Type Dynamics Gaps

| Gap | Impact | Severity |
|---|---|---|
| **No product-type-aware funnel step behavior** — When an upsell offer item is digital but the main product is physical, the interstitial should say "Add this digital companion to your order — instant access after purchase." When both are physical, it should say "Ships with your order." The current `FunnelStepClient` shows the same generic messaging. | Missed personalization opportunity. | **Medium** |
| **No inventory-aware offer cards** — For physical offer items, the funnel preview should show stock urgency ("Only 3 left — bundle while available"). For digital items, it should show "Unlimited" or "Instant access." The current funnel data doesn't include stock or product_type for offer items. | No urgency messaging for physical, no friction-free messaging for digital. | **Medium** |
| **No basket savings calculator** — When a funnel bundles multiple products at a discount, the preview should show "Save $X vs. buying separately." Currently, each step shows its own price/discount but there's no aggregate savings display. | Missed value perception opportunity. | **Low** |

---

## 4. Architecture: Digital Product Layout

### 4.1 New Layout: `ProductDigitalLayout`

A fourth product page layout specifically designed for digital and hybrid products. Unlike the three existing layouts (which are mapped from storefront layout preferences), the digital layout is **auto-selected when `productType === 'digital'`** and can be overridden by `?layout_preview=`.

**Layout resolution update:**

```typescript
export function resolveProductLayout(
  storefrontLayout?: string | null,
  previewLayout?: string | null,
  productType?: string | null,
): ProductLayoutKey {
  // Preview override always wins
  if (previewLayout && ['classic', 'showcase', 'quick-commerce', 'digital'].includes(previewLayout)) {
    return previewLayout as ProductLayoutKey;
  }
  // Auto-route digital products to digital layout
  if (productType === 'digital') {
    return 'digital';
  }
  // Existing storefront layout mapping
  if (storefrontLayout && storefrontLayout in PRODUCT_LAYOUT_MAP) {
    return PRODUCT_LAYOUT_MAP[storefrontLayout as StorefrontLayoutKey];
  }
  return 'classic';
}
```

**`ProductLayoutKey` extended:** `'classic' | 'showcase' | 'quick-commerce' | 'digital'`

### 4.2 Digital Layout Composition

```
┌─────────────────────────────────────────────────────────────┐
│  PRODUCT DIGITAL LAYOUT                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Compact Header (store name + back + cart)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐     │
│  │  Product Visual  │  │  Digital Purchase Panel      │     │
│  │  (single image   │  │  • Title + digital badge     │     │
│  │   or video,      │  │  • Price (no stock counter)  │     │
│  │   no gallery     │  │  • "What You Get" summary:   │     │
│  │   carousel)      │  │    - Delivery method         │     │
│  │                  │  │    - File format/size        │     │
│  │                  │  │    - License type            │     │
│  │                  │  │    - Access duration         │     │
│  │                  │  │    - Download limit          │     │
│  │                  │  │  • "Buy Now → Instant Access"│     │
│  │                  │  │  • "Add to Cart"             │     │
│  │                  │  │  • Digital trust badges      │     │
│  └──────────────────┘  └──────────────────────────────┘     │
│                                                             │
│  ── Funnel Preview Section (if funnel exists) ──────────  │
│  [Stepper + Offer Cards — same as other layouts]            │
│                                                             │
│  ── Product Details ────────────────────────────────────  │
│  Description / Features / Specifications / Reviews / FAQ    │
│                                                             │
│  ── Store Info ─────────────────────────────────────────  │
│  Business info (no map, no hours — digital store)           │
└─────────────────────────────────────────────────────────────┘
```

**Key differences from existing layouts:**
- **No gallery carousel** — Single hero image or video. Digital products typically have one cover image, not multiple angle shots.
- **No stock counter** — Digital products are unlimited (unless `downloadLimit` is set, which is shown as a "What You Get" field, not a stock warning).
- **No fulfillment pane** — No shipping, pickup, or delivery options. Replaced with "What You Get" panel.
- **No variant selector** (by default) — Digital products rarely have physical-style variants. If variants exist (e.g., personal vs. commercial license), shown as a simple radio group.
- **"Buy Now" prioritized over "Add to Cart"** — For single digital items, "Buy Now → Instant Access" can bypass the cart and go directly to a streamlined checkout.
- **Digital trust badges** — "Instant Access", "Secure Download", "License Key Provided" badges in the purchase panel.
- **No map/hours sections** — Digital stores don't need location info.

### 4.3 New Component: `DigitalPurchasePanel`

```
apps/web/src/components/products/sections/DigitalPurchasePanel.tsx
```

Replaces `ProductPurchasePanel` in the digital layout. Shows:
- Product title + `DigitalProductBadge` (type + delivery method)
- Price (no strikethrough stock urgency)
- "What You Get" summary card (delivery method, file format, file size, license type, access duration, download limit)
- "Buy Now → Instant Access" button (primary CTA — navigates to checkout with `?direct_checkout=true`)
- "Add to Cart" button (secondary CTA)
- Digital trust badges row
- Coupon input (if coupon capability enabled)

### 4.4 New Component: `DigitalWhatYouGetCard`

```
apps/web/src/components/products/sections/DigitalWhatYouGetCard.tsx
```

Renders the pre-purchase digital product summary:
- Delivery method icon + label (Direct Download, License Key, External Link, Access Grant)
- File format + file size (from metadata)
- License type (Personal, Commercial, Educational, Enterprise)
- Access duration (if time-limited)
- Download limit (if restricted)
- "Instant Access" or "Access within X hours" messaging

### 4.5 New Component: `ProductDigitalLayout`

```
apps/web/src/app/products/[id]/ProductDigitalLayout.tsx
```

Client component. Composition:
1. Compact header (store name, back, cart) — reuse from QuickCommerce
2. 50/50 grid: Product visual (left) + DigitalPurchasePanel (right)
3. Funnel preview section (if funnel exists)
4. Product detail tabs (description, features, specs)
5. Reviews + FAQ
6. Store info (business name, links — no map/hours)

---

## 5. Architecture: Universal Funnel-Aware Product Page

### 5.1 New Backend Endpoint: Product Funnel Preview

```
GET /api/public/funnels/:tenantId/product/:productId
```

**Purpose:** Returns the active funnel for a product with enriched offer item details (name, image, price, product_type, stock) and coupon details — all in a single call.

**Response:**
```typescript
{
  success: boolean;
  funnel: {
    funnel_id: string;
    name: string;
    trigger_type: string;
    metadata: { show_preview?: boolean } | null;
    steps: Array<{
      id: string;
      step_type: FunnelStepType;
      offer_item_id: string;
      display_title: string | null;
      display_description: string | null;
      price_cents: number | null;
      discount_cents: number;
      sort_order: number;
      offer_item: {
        name: string;
        image_url: string | null;
        product_type: 'physical' | 'digital' | 'hybrid';
        price_cents: number;
        stock: number | null;
        description: string | null;
      } | null;
      coupon: {
        code: string;
        discount_type: string;
        discount_value: number;
      } | null;
    }>;
  } | null;
}
```

**Backend implementation:** `FunnelEngine.getProductFunnelPreview(tenantId, productId)`:
1. Reuses `getCheckoutFunnel()` logic (resolve capabilities, find matching funnel, filter steps)
2. Checks `metadata.show_preview !== false` (merchant opt-out)
3. Batch-fetches offer item details via `prisma.inventory_items.findMany({ where: { id: { in: offerItemIds } } })`
4. For `coupon_offer` steps, batch-fetches coupon details from `tenant_coupons`
5. Returns enriched response

### 5.2 New Frontend Service: `ProductFunnelService`

```
apps/web/src/services/ProductFunnelService.ts
```

Extends `PublicApiSingleton` (no auth, 60s cache):
```typescript
class ProductFunnelService extends PublicApiSingleton {
  async getProductFunnel(tenantId: string, productId: string): Promise<ProductFunnelPreview | null>
}
```

### 5.3 New Components

#### `ProductFunnelPreview`

```
apps/web/src/components/products/ProductFunnelPreview.tsx
```

Container component. On mount, calls `ProductFunnelService.getProductFunnel()`. If null or `show_preview === false`, renders nothing. Otherwise renders `FunnelStepper` + `FunnelOfferCard[]`.

Props:
```typescript
interface ProductFunnelPreviewProps {
  tenantId: string;
  productId: string;
  productPriceCents: number;
  productType: 'physical' | 'digital' | 'hybrid';
  layoutVariant: ProductLayoutKey;
}
```

#### `FunnelStepper`

```
apps/web/src/components/products/FunnelStepper.tsx
```

Visual timeline showing the purchase journey:
- Dots for: Main Product → each funnel step
- Step type icons (Zap for bump, TrendingUp for upsell, etc.)
- Responsive: horizontal on desktop, vertical on mobile

#### `FunnelOfferCard`

```
apps/web/src/components/products/FunnelOfferCard.tsx
```

Single offer card with:
- Offer item image (or coupon icon for coupon_offer)
- Step type badge
- Display title + description
- Price + discount (strikethrough + save badge)
- Product-type-aware label: "Instant access" (digital), "Ships with order" (physical), "Instant + shipped" (hybrid)
- Inventory urgency for physical: "Only N left" (if stock < 5)
- "Available at checkout" / "Offered after purchase" / "Limited time" label
- OTO countdown badge (if step_type === 'oto')

### 5.4 Layout Integration

Each layout receives a `funnelPreview?: React.ReactNode` prop and renders it at the appropriate position:

| Layout | Placement | Style |
|---|---|---|
| **Classic** | Between `TierBasedLandingPage` and `FeaturedProductsSection` | Full-width horizontal scroll cards |
| **Showcase** | Between gallery/purchase grid and `ProductBottomSections` | Full-width stepper + offer cards |
| **Quick Commerce** | Between compact purchase panel and bottom sections | Compact horizontal scroll with peek-through |
| **Digital** | Between digital purchase panel and detail tabs | Full-width, digital-styled (instant access messaging) |

### 5.5 Product-Type-Aware Funnel Behavior

The `ProductFunnelPreview` component and `FunnelOfferCard` adapt messaging based on `productType`:

| Feature | Physical | Digital | Hybrid |
|---|---|---|---|
| Offer card badge | "Ships with order" / "Pickup available" | "Instant access" | "Instant + shipped" |
| Bundle display | "Save $X vs. buying separately" + shipping note | "All items delivered instantly" | Both delivery types |
| "Buy Now" behavior | Adds to cart → checkout | Can skip cart → direct checkout | Adds to cart → checkout |
| OTO timer | Standard 5 min | Optional extended (no inventory risk) | Standard 5 min |
| Coupon offer CTA | "Use on next purchase" | "Apply to this purchase" | "Apply to this purchase" |
| Inventory messaging | "Only N left — bundle while available" | N/A | "Limited stock for physical item" |

### 5.6 Analytics: New Event Types

Extend `FunnelAnalyticsService` with product-page-specific events:

| Event Type | Trigger | Metadata |
|---|---|---|
| `preview_viewed` | Funnel preview section renders on product page | `productId`, `funnelId`, `stepIds[]` |
| `preview_step_clicked` | User clicks an offer card in the preview | `productId`, `funnelId`, `stepId`, `offerItemId` |
| `preview_buy_now_clicked` | User clicks "Buy Now" from a specific offer card | `productId`, `funnelId`, `stepId` |

### 5.7 Merchant Opt-Out

Funnel metadata flag `show_preview` (default: `true`):
- `metadata.show_preview = false` → `ProductFunnelPreview` renders nothing
- Added to `FunnelBuilderClient` as a toggle in the funnel settings section
- No new capability or feature key needed (per R14 — one capability = one concern)

---

## 6. Sprint Plan

### Sprint 1: Backend — Product Funnel Preview Endpoint + Analytics Events

**Goal:** Create the enriched backend endpoint that the product page will call to render the funnel preview, and add preview-specific analytics event types.

**Tasks:**

1. **`FunnelEngine.getProductFunnelPreview(tenantId, productId)`** — New method in `@/api/src/services/FunnelEngine.ts`
   - Reuses `getCheckoutFunnel()` logic (resolve capabilities, find matching funnel, filter steps by `allowed_steps`)
   - Checks `metadata.show_preview !== false` (merchant opt-out)
   - Only resolves `trigger_type: 'product'` and `trigger_type: 'always'` funnels (skips `cart_value` — no cart on product page)
   - Batch-fetches offer item details: `prisma.inventory_items.findMany({ where: { id: { in: offerItemIds } } })` — selects `id, name, image_url, product_type, price_cents, stock, description`
   - For `coupon_offer` steps: batch-fetches coupon details from `tenant_coupons` (code, discount_type, discount_value)
   - Returns enriched `ProductFunnelPreview` response

2. **`GET /api/public/funnels/:tenantId/product/:productId`** — New route in `@/api/src/routes/funnel-checkout.ts`
   - Query params: `sessionId`, `customerId` (for analytics tracking)
   - Tracks `preview_viewed` event per step (one event per step, like checkout `viewed` events)
   - Returns enriched funnel or `{ success: true, funnel: null }`

3. **Analytics event types** — Extend `FunnelAnalyticsService` in `@/api/src/services/FunnelAnalyticsService.ts`
   - Add `preview_viewed`, `preview_step_clicked`, `preview_buy_now_clicked` to accepted event types
   - Add `productId` to `TrackFunnelEventInput` and `metadata` field for additional context
   - Add aggregation methods: `getPreviewMetrics(tenantId, funnelId)` — returns preview views, step clicks, buy-now clicks, and preview-to-checkout conversion rate

4. **`preview_step_clicked` and `preview_buy_now_clicked` tracking endpoints** — Add to `funnel-checkout.ts`
   - `POST /api/public/funnels/:tenantId/preview-event` — body: `{ funnelId, stepId, eventType, productId, sessionId?, customerId? }`
   - Lightweight endpoint that just records the event, no processing

5. **Unit tests** — `FunnelEngine.test.ts` (or extend existing test file)
   - Test: no funnel for product → returns null
   - Test: funnel with `show_preview = false` → returns null
   - Test: `cart_value` trigger funnel → not resolved on product page
   - Test: `always` trigger funnel → resolved
   - Test: offer item enrichment (batch fetch)
   - Test: coupon enrichment for `coupon_offer` steps

**Files:**
- `apps/api/src/services/FunnelEngine.ts` (new method + `ProductFunnelPreview` interface export)
- `apps/api/src/routes/funnel-checkout.ts` (new GET + POST routes)
- `apps/api/src/services/FunnelAnalyticsService.ts` (new event types + `getPreviewMetrics`)
- `apps/api/src/tests/FunnelEngine.test.ts` (new tests)

**Verification:** `pnpm checkapi`

---

### Sprint 2: Frontend — Digital Product Layout

**Goal:** Build the dedicated digital product page layout with digital-optimized purchase panel, "What You Get" card, and streamlined composition.

**Tasks:**

1. **Extend `ProductLayoutKey`** — Update `@/app/products/[id]/layouts/types.ts`
   - Add `'digital'` to `ProductLayoutKey` union
   - Add `PRODUCT_LAYOUT_LABELS.digital = 'Digital Product'`
   - Update `resolveProductLayout()` to accept `productType` param and auto-route `digital` → `'digital'` layout
   - Preview override still wins

2. **`DigitalWhatYouGetCard`** — New component at `@/components/products/sections/DigitalWhatYouGetCard.tsx`
   - Props: `product: any` (reads `digitalDeliveryMethod`, `licenseType`, `accessDurationDays`, `downloadLimit`, metadata for file format/size)
   - Renders structured summary: delivery method (icon + label), file format, file size, license type, access duration, download limit
   - "Instant Access" or "Access within X hours" messaging based on delivery method
   - Clean card design with icons from lucide-react (Download, Key, Link, Clock, FileCheck)

3. **`DigitalPurchasePanel`** — New component at `@/components/products/sections/DigitalPurchasePanel.tsx`
   - Props: `product`, `tenant`, `safeFeatures`, `currentPriceCents`, `currentListPriceCents`, `resolvedCurrentUrl`, `socialCommerceFlags`, `fulfillmentPane` (ignored for digital)
   - Renders: product title, `DigitalProductBadge` (type + delivery method), price (no stock counter), `DigitalWhatYouGetCard`, "Buy Now → Instant Access" button (primary), "Add to Cart" button (secondary), digital trust badges, coupon input (if enabled)
   - "Buy Now" navigates to `/checkout?direct_checkout=true&product_id={productId}` — signals the checkout page to skip cart and go straight to checkout with this single item
   - No variant selector by default (unless product has variants — then simple radio group)
   - No fulfillment pane, no stock counter, no shipping info

4. **`ProductDigitalLayout`** — New layout at `@/app/products/[id]/ProductDigitalLayout.tsx`
   - Client component
   - Compact header (reuse pattern from QuickCommerce — store name, back, cart)
   - 50/50 grid: Product visual (left — single hero image or `ProductVideoPlayer`, no gallery carousel) + `DigitalPurchasePanel` (right)
   - `ProductBottomSections` for detail tabs, reviews, FAQ
   - No map, no hours sections (digital store)
   - `CouponSpotlight` strip
   - `StickyPurchaseBar` with "Buy Now" CTA

5. **Wire into `page.tsx`** — Update `@/app/products/[id]/page.tsx`
   - Import `ProductDigitalLayout`
   - Update `resolveProductLayout()` call to pass `product.productType`
   - Add `productLayout === 'digital'` branch rendering `ProductDigitalLayout`
   - Pass `funnelPreview` prop (will be wired in Sprint 4)

6. **Digital trust badges** — Small inline component or section within `DigitalPurchasePanel`
   - "Instant Access" (Download icon)
   - "Secure Checkout" (ShieldCheck icon)
   - "License Key Provided" (Key icon, if `deliveryMethod === 'license_key'`)

**Files:**
- `apps/web/src/app/products/[id]/layouts/types.ts` (extend types + resolution)
- `apps/web/src/components/products/sections/DigitalWhatYouGetCard.tsx` (NEW)
- `apps/web/src/components/products/sections/DigitalPurchasePanel.tsx` (NEW)
- `apps/web/src/app/products/[id]/ProductDigitalLayout.tsx` (NEW)
- `apps/web/src/app/products/[id]/page.tsx` (wire digital layout branch)

**Verification:** `pnpm checkweb` — navigate to a digital product page and verify layout renders

---

### Sprint 3: Frontend — Funnel Preview Components

**Goal:** Build the `ProductFunnelPreview`, `FunnelStepper`, and `FunnelOfferCard` components with product-type-aware messaging.

**Tasks:**

1. **`ProductFunnelService`** — New singleton at `@/web/src/services/ProductFunnelService.ts`
   - Extends `PublicApiSingleton` (no auth, 60s cache)
   - `getProductFunnel(tenantId, productId): Promise<ProductFunnelPreview | null>`
   - `trackPreviewEvent(tenantId, funnelId, stepId, eventType, productId, sessionId?, customerId?)` — POST to preview-event endpoint
   - Export `ProductFunnelPreview`, `ProductFunnelStep`, `ProductFunnelOfferItem`, `ProductFunnelCoupon` interfaces

2. **`FunnelStepper`** — New component at `@/components/products/FunnelStepper.tsx`
   - Props: `steps: ProductFunnelStep[]`, `productTitle: string`
   - Renders horizontal timeline on desktop, vertical on mobile
   - Dots for: Main Product (first, highlighted) → each step (icon by step_type)
   - Connecting lines with step type colors
   - Step type icons: Zap (order_bump), TrendingUp (upsell), ArrowDownCircle (downsell), Flame (oto), Tag (coupon_offer)

3. **`FunnelOfferCard`** — New component at `@/components/products/FunnelOfferCard.tsx`
   - Props: `step: ProductFunnelStep`, `productType: 'physical' | 'digital' | 'hybrid'`, `onClick?: () => void`
   - Renders: offer item image (or coupon icon), step type badge, display title + description, price + discount (strikethrough + save badge)
   - Product-type-aware label:
     - Digital offer: "Instant access" badge
     - Physical offer: "Ships with order" badge + stock urgency ("Only N left" if stock < 5)
     - Hybrid offer: "Instant + shipped" badge
   - Step timing label: "Available at checkout" (order_bump), "Offered after purchase" (upsell/downsell), "Limited time" (oto with countdown)
   - OTO countdown badge (if `step_type === 'oto'`)
   - Coupon offer: coupon code + discount type/value, "Use on next purchase" (physical) or "Apply to this purchase" (digital/hybrid)

4. **`ProductFunnelPreview`** — New component at `@/components/products/ProductFunnelPreview.tsx`
   - Props: `tenantId`, `productId`, `productPriceCents`, `productType`, `layoutVariant`
   - On mount: calls `ProductFunnelService.getProductFunnel()`
   - If null or no steps → renders nothing
   - If funnel exists: renders section with header ("Your Purchase Journey"), `FunnelStepper`, `FunnelOfferCard[]`
   - Tracks `preview_viewed` event (already tracked by backend endpoint, but this is a client-side safety net)
   - Offer card click → tracks `preview_step_clicked` + navigates to checkout with `triggerProductId` pre-set
   - "Buy Now" click on offer card → tracks `preview_buy_now_clicked` + navigates to checkout
   - Loading state: skeleton stepper
   - Error state: silent render nothing (non-critical)
   - Layout variant affects styling: `quick-commerce` = compact scroll, `showcase` = full-width grid, `classic` = horizontal scroll, `digital` = full-width with digital styling

5. **Basket savings calculator** — Inline within `ProductFunnelPreview`
   - If funnel has 2+ offer steps with prices: calculates `sum(individual prices) - sum(funnel prices)` = savings
   - Displays "Save $X vs. buying separately" banner above offer cards
   - Only shown if savings > 0

**Files:**
- `apps/web/src/services/ProductFunnelService.ts` (NEW)
- `apps/web/src/components/products/FunnelStepper.tsx` (NEW)
- `apps/web/src/components/products/FunnelOfferCard.tsx` (NEW)
- `apps/web/src/components/products/ProductFunnelPreview.tsx` (NEW)

**Verification:** `pnpm checkweb`

---

### Sprint 4: Frontend — Layout Integration (All 4 Layouts)

**Goal:** Wire `ProductFunnelPreview` into all four product page layouts and the `page.tsx` server component.

**Tasks:**

1. **Add `funnelPreview` prop to all layout components:**
   - `ProductShowcaseLayout` — add `funnelPreview?: React.ReactNode` to props, render between gallery/purchase grid and `ProductBottomSections`
   - `ProductQuickCommerceLayout` — add `funnelPreview?: React.ReactNode` to props, render between purchase panel and `ProductBottomSections`
   - `ProductDigitalLayout` — add `funnelPreview?: React.ReactNode` to props, render between digital purchase panel and detail tabs
   - Classic layout (in `page.tsx`) — render between `TierBasedLandingPage` and `FeaturedProductsSection`

2. **Construct `ProductFunnelPreview` in `page.tsx`:**
   ```typescript
   const funnelPreview = (
     <ProductFunnelPreview
       tenantId={product.tenantId}
       productId={product.id}
       productPriceCents={product.priceCents}
       productType={product.productType || 'physical'}
       layoutVariant={productLayout}
     />
   );
   ```
   Pass to whichever layout is rendered.

3. **Responsive design:**
   - Desktop: full-width stepper + offer card grid (4 columns max)
   - Tablet: 2-column offer card grid
   - Mobile: horizontal scroll with peek-through (snap-x), stepper collapses to vertical

4. **Track `preview_step_clicked` and `preview_buy_now_clicked`** — handled within `ProductFunnelPreview` and `FunnelOfferCard` components (Sprint 3), verified in this sprint

5. **Empty state handling:**
   - No funnel: `ProductFunnelPreview` renders nothing (silent)
   - Funnel exists but `show_preview = false`: renders nothing
   - Funnel exists but all steps filtered by tier gate: renders nothing
   - Funnel exists with steps: renders stepper + cards

**Files:**
- `apps/web/src/app/products/[id]/page.tsx` (construct + pass funnelPreview)
- `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` (add prop + render)
- `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` (add prop + render)
- `apps/web/src/app/products/[id]/ProductDigitalLayout.tsx` (add prop + render)

**Verification:** `pnpm checkweb` — test with a product that has an active funnel

---

### Sprint 5: Funnel Builder — Merchant Opt-Out + Product-Type Awareness

**Goal:** Add the `show_preview` toggle to the funnel builder, and make the funnel builder product-type-aware so merchants can see how their funnel will render for different product types.

**Tasks:**

1. **`show_preview` toggle in `FunnelBuilderClient`** — Update `@/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx`
   - Add toggle in funnel settings section: "Show funnel preview on product page" (default: enabled)
   - Saves to `metadata.show_preview` on the funnel
   - When disabled, shows info note: "Funnel offers will only appear during checkout — not on the product page."

2. **Product-type-aware step preview** — Enhance the step editor in `FunnelBuilderClient`
   - When a step's offer item is selected, show its `product_type` badge
   - Show a preview label: "This offer will show as 'Instant access' on digital products" or "Ships with order on physical products"
   - Helps merchants understand how their funnel renders across product types

3. **Entry product type display** — In the funnel builder, when an entry item is selected, show its product type
   - If entry item is digital: note "This funnel will auto-route to the Digital Product layout"
   - If entry item is physical: note "This funnel will render on the product's standard layout"

4. **Funnel list page** — Update `FunnelListClient.tsx`
   - Show product type badge on each funnel (based on entry item's product type)
   - Show "Preview enabled/disabled" indicator

5. **Backend: `FunnelService` update** — Ensure `metadata.show_preview` is accepted in create/update
   - Already supported via `metadata` field, but add validation: `show_preview` must be boolean if present

**Files:**
- `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx` (toggle + product-type awareness)
- `apps/web/src/app/t/[tenantId]/settings/funnels/FunnelListClient.tsx` (badges)
- `apps/api/src/services/FunnelService.ts` (metadata validation)

**Verification:** `pnpm checkapi` + `pnpm checkweb`

---

### Sprint 6: Analytics Dashboard + Polish

**Goal:** Add preview-to-purchase conversion metrics to the funnel analytics dashboard, polish UX, and run end-to-end verification.

**Tasks:**

1. **Preview metrics in funnel analytics dashboard** — Update `@/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/FunnelAnalyticsClient.tsx`
   - New "Preview → Checkout" conversion section:
     - Preview views (product page)
     - Step clicks (from preview)
     - Buy Now clicks (from preview)
     - Preview-to-checkout conversion rate
   - New time series chart for preview views alongside existing checkout views
   - Per-step preview metrics in the step conversion table

2. **Backend aggregation** — `FunnelAnalyticsService.getPreviewMetrics(tenantId, funnelId)`
   - Returns: `preview_views`, `step_clicks`, `buy_now_clicks`, `checkout_entries` (from preview), `conversion_rate`
   - Time series: daily preview views vs. checkout views

3. **Bot knowledge integration** — Ensure `BotKnowledgeEmbeddingService.refreshFunnelEmbeddings` includes product-funnel associations
   - When a funnel is created/updated, refresh embeddings with funnel → product association context
   - Bot can answer "Does this product have any bundle offers?"

4. **Direct checkout for digital single-items** — Update checkout page to handle `?direct_checkout=true&product_id=...`
   - If `direct_checkout=true` and `product_id` is set: skip cart, add single item to a new order, go straight to checkout review
   - Only applicable for digital products (physical products may need shipping info first)
   - Falls back to normal cart flow if product is physical or hybrid

5. **Digital order confirmation enhancement** — Update checkout success page
   - If order contains digital products: show "Your download is ready" / "Your access is active" section with direct links
   - Link to `/downloads/[tenantId]/[slug]` for download products
   - Show license key (if `license_key` delivery method) directly on confirmation page

6. **Edge case handling:**
   - Multiple funnels match same product → first match by `created_at desc` (same as checkout logic)
   - Offer item deleted/inactive → offer card shows "Offer unavailable" with greyed-out style
   - Coupon deleted/expired → coupon offer card shows "Coupon expired" or is hidden
   - Guest user → preview works (public endpoint, no auth required)

7. **End-to-end test** — Add tests to sprint-e2e-batch test file
   - Test: digital product renders `ProductDigitalLayout`
   - Test: product with funnel renders `ProductFunnelPreview`
   - Test: `show_preview = false` → no preview rendered
   - Test: preview endpoint returns enriched data
   - Test: analytics events tracked

**Files:**
- `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/FunnelAnalyticsClient.tsx` (preview metrics)
- `apps/api/src/services/FunnelAnalyticsService.ts` (aggregation methods)
- `apps/api/src/services/BotKnowledgeEmbeddingService.ts` (funnel-product embeddings)
- `apps/web/src/app/checkout/page.tsx` (direct checkout support)
- `apps/web/src/app/checkout/success/page.tsx` (digital confirmation)
- `apps/api/src/tests/sprint-e2e-batch.test.ts` (new test section)

**Verification:** `pnpm checkapi` + `pnpm checkweb` + E2E batch tests

---

## 7. Dependency Graph

```
Sprint 1 (Backend endpoint + analytics)
    │
    ├──→ Sprint 3 (Frontend funnel components) — depends on endpoint
    │        │
    │        └──→ Sprint 4 (Layout integration) — depends on components
    │                 │
    │                 └──→ Sprint 6 (Analytics + polish) — depends on integration
    │
    └──→ Sprint 5 (Funnel builder opt-out) — depends on backend metadata support

Sprint 2 (Digital product layout) — independent, no dependencies
    │
    └──→ Sprint 4 (Layout integration) — digital layout needs funnelPreview prop
```

**Sprint 2 can run in parallel with Sprint 1.** Sprint 5 can run in parallel with Sprint 3. Critical path: Sprint 1 → Sprint 3 → Sprint 4 → Sprint 6.

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Performance: extra API call on product page** | Medium | Low | 60s cache on `ProductFunnelService`, parallel fetch with other capability calls |
| **Offer item N+1 queries** | Low | Medium | Batch fetch in `getProductFunnelPreview()` — single `findMany` for all offer items |
| **Digital layout auto-routing breaks existing stores** | Low | High | `?layout_preview=` override always wins; merchants can force a different layout; auto-routing only applies to `productType === 'digital'` |
| **Preview reduces checkout surprise → lower conversion** | Low | Medium | Merchant opt-out via `metadata.show_preview = false`; Sprint 6 analytics lets merchants measure impact |
| **Layout breakage on mobile** | Medium | Medium | Horizontal scroll with peek-through, tested at 320px breakpoint; stepper collapses to vertical |
| **Direct checkout bypasses cart logic** | Medium | Medium | Only for digital single-items; falls back to cart for physical/hybrid; cart service still handles order creation |
| **Stale funnel data after merchant edits** | Low | Low | Cache invalidation on funnel update (existing `invalidateServiceCaches` pattern) |
| **`ProductDigitalLayout` missing features from other layouts** | Medium | Medium | Reuse `ProductBottomSections`, `ProductDetailTabs`, `ProductBreadcrumb`, `StickyPurchaseBar` — only the top section is new |

---

## 9. Design Decisions

### 9.1 Why a Fourth Layout Instead of Adapting Existing Ones?

Digital products have fundamentally different purchase drivers: no stock urgency, no shipping, no fulfillment method selection, instant gratification. Adapting `ProductShowcaseLayout` or `ProductQuickCommerceLayout` with conditionals would create a combinatorial mess of `if (productType === 'digital')` branches. A dedicated layout keeps each layout focused and maintainable.

### 9.2 Why Auto-Route Instead of Merchant Opt-In?

Digital products on physical-product layouts look broken ("Only 3 left in stock" on an unlimited download). Auto-routing ensures digital products always look professional. Merchants can override with `?layout_preview=` or by setting their storefront layout preference. The auto-route only applies when `productType === 'digital'` — hybrid products stay on their storefront-configured layout.

### 9.3 Why Not Modify the Checkout Flow?

The product page funnel preview is **additive**, not a replacement for the checkout funnel. The checkout flow (order bump on review step, post-purchase interstitials) remains unchanged. The preview creates awareness and intent before checkout.

### 9.4 Why a New Endpoint Instead of Reusing `/checkout`?

The existing `GET /api/public/funnels/:tenantId/checkout` returns step data but not offer item details. The product page needs enriched data (name, image, price, product_type, stock) to render offer cards. Rather than N+1 frontend calls, the new endpoint batch-fetches and enriches. The checkout endpoint remains optimized for its purpose.

### 9.5 Why No New Capability?

The funnel preview is a rendering surface for the existing `funnel_options` capability. It doesn't introduce a new concern — it displays the same funnel data in a new location. Per R14 (one capability = one concern), adding a capability would be wrong. The merchant opt-out is `metadata.show_preview`, not a feature key.

### 9.6 Why Product-Type-Aware, Not Type-Specific?

The funnel preview works universally across physical, digital, and hybrid products. Each type gets specialized UX (inventory urgency for physical, instant access for digital, dual-delivery for hybrid), but the core component and data flow are identical. This follows the platform pattern: base feature works universally, specific types get tailored messaging.

---

## 10. File Inventory

### New Files

| File | Sprint | Purpose |
|---|---|---|
| `apps/web/src/components/products/sections/DigitalWhatYouGetCard.tsx` | 2 | Pre-purchase digital product summary |
| `apps/web/src/components/products/sections/DigitalPurchasePanel.tsx` | 2 | Digital-optimized purchase panel |
| `apps/web/src/app/products/[id]/ProductDigitalLayout.tsx` | 2 | Digital product page layout |
| `apps/web/src/services/ProductFunnelService.ts` | 3 | Frontend singleton for funnel preview API |
| `apps/web/src/components/products/FunnelStepper.tsx` | 3 | Visual purchase journey timeline |
| `apps/web/src/components/products/FunnelOfferCard.tsx` | 3 | Individual funnel offer card |
| `apps/web/src/components/products/ProductFunnelPreview.tsx` | 3 | Container: resolves funnel, renders stepper + cards |
| `apps/api/src/tests/FunnelEngine.test.ts` | 1 | Unit tests for `getProductFunnelPreview` |

### Modified Files

| File | Sprint | Changes |
|---|---|---|
| `apps/api/src/services/FunnelEngine.ts` | 1 | New `getProductFunnelPreview()` method + `ProductFunnelPreview` interface |
| `apps/api/src/routes/funnel-checkout.ts` | 1 | New GET + POST routes for product preview + event tracking |
| `apps/api/src/services/FunnelAnalyticsService.ts` | 1, 6 | New event types, `productId` field, `getPreviewMetrics()` |
| `apps/web/src/app/products/[id]/layouts/types.ts` | 2 | Add `'digital'` to `ProductLayoutKey`, update `resolveProductLayout()` |
| `apps/web/src/app/products/[id]/page.tsx` | 2, 4 | Digital layout branch, `funnelPreview` construction + passing |
| `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` | 4 | `funnelPreview` prop + render |
| `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` | 4 | `funnelPreview` prop + render |
| `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx` | 5 | `show_preview` toggle + product-type awareness |
| `apps/web/src/app/t/[tenantId]/settings/funnels/FunnelListClient.tsx` | 5 | Product type + preview status badges |
| `apps/api/src/services/FunnelService.ts` | 5 | `metadata.show_preview` validation |
| `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/FunnelAnalyticsClient.tsx` | 6 | Preview metrics section |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | 6 | Funnel-product embedding context |
| `apps/web/src/app/checkout/page.tsx` | 6 | Direct checkout support for digital |
| `apps/web/src/app/checkout/success/page.tsx` | 6 | Digital order confirmation |
| `apps/api/src/tests/sprint-e2e-batch.test.ts` | 6 | E2E tests for digital layout + funnel preview |

---

## 11. Acceptance Criteria

- [ ] `pnpm checkapi` — zero TS errors
- [ ] `pnpm checkweb` — zero TS errors
- [ ] Digital product page renders `ProductDigitalLayout` (auto-routed)
- [ ] Digital layout shows "What You Get" card with delivery method, license type, access info
- [ ] Digital layout does not show stock counter, fulfillment pane, or shipping options
- [ ] Product page with active funnel renders `ProductFunnelPreview` (stepper + offer cards)
- [ ] Product page without funnel renders no preview section (silent)
- [ ] Funnel with `metadata.show_preview = false` renders no preview section
- [ ] Offer cards show product-type-aware labels ("Instant access" / "Ships with order")
- [ ] Physical offer cards show stock urgency when stock < 5
- [ ] Coupon offer cards show coupon code + discount info
- [ ] OTO offer cards show countdown timer
- [ ] Basket savings banner shows when funnel has 2+ priced offer steps
- [ ] `preview_viewed`, `preview_step_clicked`, `preview_buy_now_clicked` events tracked
- [ ] Funnel analytics dashboard shows preview-to-checkout conversion metrics
- [ ] Funnel builder has `show_preview` toggle
- [ ] Direct checkout (`?direct_checkout=true`) works for digital single-items
- [ ] Digital order confirmation shows download/access links
- [ ] E2E batch tests pass for all new functionality
- [ ] No new capability type or feature key introduced (uses existing `funnel_options`)
