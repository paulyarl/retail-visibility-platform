# Product × Sales Funnel Fusion Analysis

> **Status:** Analysis / Design Phase  
> **Date:** 2026-07-19  
> **Depends on:** Product Catalog (product_type: physical | digital | hybrid), Sales Funnels (funnel_options capability), Funnel Checkout Flow (Sprint 3)

---

## 1. Executive Summary

Products and sales funnels are a natural fit — regardless of product type. A grocery store can bundle a collection of goods in a funnel offer with savings that beat purchasing items separately. A digital creator can offer a complete toolkit with order bumps and upsells. A hybrid retailer can move physical inventory swiftly while driving foot traffic both online and in-store. Funnels transform a single product page from "here's a product" into "here's a purchase journey."

Currently, funnels only surface during checkout (order bump on the review step) and post-purchase (upsell/downsell/OTO interstitial pages). This analysis proposes a new **Funnel-Aware Product Page** that surfaces the merchant-designed funnel directly on the product listing page — *before* the customer clicks "Add to Cart" or "Buy Now."

The key insight: the funnel IS the merchandising strategy. A product page that shows "Here's what you're getting, and here's what else you can get" creates a unified buying experience that mirrors how platforms like Stan Store, ThriveCart, and ClickFunnels present offers — but generalized across physical, digital, and hybrid product types.

---

## 2. Current Architecture

### 2.1 Product System

**Product Types:** `physical` | `digital` | `hybrid`  
**Digital Delivery Methods:** `direct_download` | `external_link` | `license_key` | `access_grant`  
**License Types:** `personal` | `commercial` | `educational` | `enterprise`

Key files:
- `apps/web/src/components/items/DigitalProductConfig.tsx` — merchant configures digital delivery
- `apps/web/src/components/storefront/sections/DigitalSection.tsx` — storefront digital product grid
- `apps/web/src/components/products/DigitalProductBadge.tsx` — "Digital" badge on product cards
- `apps/web/src/app/products/[id]/page.tsx` — public product page (all types)
- `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` — editorial layout
- `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` — immersive layout

Product type fields on `ProductData`:
```typescript
productType?: 'physical' | 'digital' | 'hybrid';
digitalDeliveryMethod?: string;
digitalAssets?: any[];
licenseType?: string;
accessDurationDays?: number;
downloadLimit?: number;
```

### 2.2 Sales Funnel System

**Capability:** `funnel_options` (resolver: `FunnelResolver.ts`)  
**Step Types:** `order_bump` | `upsell` | `downsell` | `oto` | `coupon_offer`  
**Trigger Types:** `product` (entry item match) | `cart_value` (min cart threshold) | `always`

Key files:
- `apps/api/src/services/FunnelService.ts` — CRUD for funnels + steps
- `apps/api/src/services/FunnelEngine.ts` — checkout-time resolution + execution
- `apps/api/src/services/resolvers/FunnelResolver.ts` — tier/merchant capability resolution
- `apps/api/src/routes/funnel-checkout.ts` — public checkout endpoints
- `apps/web/src/services/FunnelCheckoutService.ts` — frontend funnel checkout client
- `apps/web/src/components/checkout/OrderBump.tsx` — order bump card on checkout review
- `apps/web/src/app/checkout/funnel/[orderId]/step/[stepId]/FunnelStepClient.tsx` — post-purchase interstitial

### 2.3 Current Funnel Touchpoints

| Touchpoint | When | What Happens |
|---|---|---|
| **Order Bump** | Checkout review step (before payment) | Checkbox card added to order if accepted |
| **Upsell/Downsell/OTO** | Post-purchase interstitial page | Full-page offer with accept/skip + OTO countdown |
| **Coupon Offer** | Post-purchase interstitial page | Coupon code displayed for future purchase |

**The gap:** The funnel is invisible until checkout. The customer has no preview of the offer journey while browsing the product page.

---

## 3. Proposed: Funnel-Aware Product Page

### 3.1 Core Concept

When a digital product has an associated active funnel (via `entry_item_id` match or `trigger_type: 'always'`), the product page renders a **Funnel Preview Section** between the product gallery/purchase panel and the bottom sections.

This section shows:
1. **The offer journey** — a visual timeline/stepper of the funnel steps
2. **Each offer's product** — card with image, title, price, discount, and step type badge
3. **Coupon offers** — coupon code preview with discount info
4. **"Buy Now" shortcut** — clicking any offer card adds both the main product and that offer to cart

### 3.2 Layout Integration

The funnel preview integrates into all three product page layouts:

| Layout | Placement | Style |
|---|---|---|
| **Classic** | Between product detail and featured products section | Full-width horizontal scroll cards |
| **Showcase** | Between gallery/purchase grid and `ProductBottomSections` | Full-width stepper + offer cards |
| **Quick Commerce** | Between compact purchase panel and bottom sections | Compact horizontal scroll with peek-through |

### 3.3 Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│  PRODUCT PAGE (Showcase Layout)                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐                    │
│  │  Gallery     │  │  Purchase Panel  │                    │
│  │              │  │  Price / Buy Now │                    │
│  └──────────────┘  └──────────────────┘                    │
│                                                             │
│  ── Funnel Preview Section ──────────────────────────────  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🛒 Your Purchase Journey                           │   │
│  │                                                     │   │
│  │  ●─────●─────●─────●                                │   │
│  │  Main  Bump  Upsell OTO                             │   │
│  │  Product        Offer  Offer                        │   │
│  │                                                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │ Main    │ │ ⚡ Order │ │ ⬆ Upsell│ │ ✨ OTO  │  │   │
│  │  │ Product │ │ Bump    │ │ Offer   │ │ Offer   │  │   │
│  │  │ $29.99  │ │ $9.99   │ │ $19.99  │ │ $14.99  │  │   │
│  │  │ ✓ In    │ │ + Add   │ │ Upgrade │ │ Limited │  │   │
│  │  │   Cart  │ │   to    │ │   after │ │   time  │  │   │
│  │  │         │ │   order │ │ purchase│ │  offer  │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  │                                                     │   │
│  │  💡 These offers are available during checkout       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Product Bottom Sections ────────────────────────────  │
│  Reviews / FAQ / Recommendations / etc.                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Product × Funnel: Why It's a Natural Fit Across All Product Types

The funnel preview works universally — each product type has distinct strategic advantages:

| Factor | Physical Products | Digital Products | Hybrid Products |
|---|---|---|---|
| **Marginal cost** | Per-unit cost | Zero | Mixed |
| **Delivery** | Shipping, pickup, in-store | Instant download/link | Both |
| **Inventory** | Stock-limited | Unlimited | Mixed |
| **Bundle friction** | Medium (shipping, weight) | None | Low |
| **Impulse buy suitability** | Medium | High | High |
| **Funnel offer margin** | Varies (inventory clearance) | ~100% | Mixed |
| **Customer expectation** | Browse → cart → checkout | See → buy → get instantly | Flexible |
| **Strategic use case** | Move inventory, increase basket size, drive foot traffic | Complete the toolkit, upsell premium content | Bridge physical + digital value |

**Physical product funnels** are a strategic means to move inventory swiftly while increasing foot traffic both online and in-store. A grocery store can bundle a collection of goods with savings that beat purchasing items separately — turning a single product page into a basket-building opportunity. Order bumps suggest complementary items ("add a loaf of bread to your soup order"), upsells offer premium variants ("upgrade to organic for $2 more"), and coupon offers drive repeat visits.

**Digital product funnels** eliminate the friction that makes funnel offers awkward for physical goods (shipping costs for the bump, inventory checks for the upsell). The entire funnel can be presented as a "complete your toolkit" narrative with zero delivery friction.

**Hybrid product funnels** bridge both worlds — a physical product can have digital add-ons (recipe eBook with a kitchen appliance) or a digital product can have physical companions (printed workbook with an online course).

---

## 4. Technical Architecture

### 4.1 New Component: `ProductFunnelPreview`

```
apps/web/src/components/products/ProductFunnelPreview.tsx
```

**Props:**
```typescript
interface ProductFunnelPreviewProps {
  tenantId: string;
  productId: string;
  productPriceCents: number;
  productType: 'physical' | 'digital' | 'hybrid';
  layoutVariant: ProductLayoutKey; // 'classic' | 'showcase' | 'quick-commerce'
  className?: string;
}
```

**Behavior:**
1. On mount, calls `funnelCheckoutService.resolveCheckoutFunnel(tenantId, { triggerProductId: productId })`
2. If no funnel or funnel has 0 visible steps → renders nothing
3. If funnel exists → renders stepper + offer cards
4. Tracks "funnel_preview_viewed" event per step (new analytics event type)
5. Offer card click → adds main product to cart + navigates to checkout with `triggerProductId` pre-set

**Data flow:**
```
ProductFunnelPreview
  → funnelCheckoutService.resolveCheckoutFunnel(tenantId, { triggerProductId })
    → GET /api/public/funnels/:tenantId/checkout?triggerProductId=...
      → FunnelEngine.getCheckoutFunnel()
        → resolveEffectiveCapabilities() (tier gate)
        → prisma.tenant_sales_funnels.findMany() (find matching funnel)
        → filter steps by allowed_steps
      → returns CheckoutFunnel { funnel_id, name, steps[] }
  → renders stepper + offer cards
```

### 4.2 New Component: `FunnelOfferCard`

```
apps/web/src/components/products/FunnelOfferCard.tsx
```

Renders a single funnel step as a visual card:
- Product image (fetched from offer_item_id)
- Step type badge (Order Bump, Upsell, Downsell, OTO, Coupon Offer)
- Display title + description
- Price + discount (strikethrough + save badge)
- "Added at checkout" / "Offered after purchase" / "Limited time" label
- OTO countdown badge (if applicable)

### 4.3 New Component: `FunnelStepper`

```
apps/web/src/components/products/FunnelStepper.tsx
```

Visual timeline showing the purchase journey:
- Dots/segments for: Main Product → Order Bump → Upsell → Downsell → OTO → Coupon Offer
- Current step highlighted (main product = first dot)
- Connecting lines with step type icons
- Responsive: horizontal on desktop, vertical on mobile

### 4.4 Backend: New Public Endpoint for Product-Page Funnel Resolution

The existing `GET /api/public/funnels/:tenantId/checkout` endpoint already resolves funnels by `triggerProductId`. However, for the product page we need a lighter-weight response that includes **offer item details** (name, image, price) so the frontend doesn't need N+1 API calls.

**New endpoint:**
```
GET /api/public/funnels/:tenantId/product/:productId
```

**Response:**
```typescript
{
  success: boolean;
  funnel: {
    funnel_id: string;
    name: string;
    trigger_type: string;
    steps: Array<{
      id: string;
      step_type: FunnelStepType;
      offer_item_id: string;
      display_title: string | null;
      display_description: string | null;
      price_cents: number | null;
      discount_cents: number;
      sort_order: number;
      // NEW: enriched offer item details
      offer_item: {
        name: string;
        image_url: string | null;
        product_type: 'physical' | 'digital' | 'hybrid';
        price_cents: number;
        description: string | null;
      } | null;
      // NEW: coupon details (for coupon_offer steps)
      coupon: {
        code: string;
        discount_type: string;
        discount_value: number;
      } | null;
    }>;
  } | null;
}
```

**Backend implementation:** `FunnelEngine.getProductFunnelPreview(tenantId, productId)` — reuses `getCheckoutFunnel()` logic, then batch-fetches offer item details via a single `prisma.inventory_items.findMany({ where: { id: { in: offerItemIds } } })` call. For `coupon_offer` steps, fetches coupon details from `tenant_coupons`.

### 4.5 Frontend Service: `ProductFunnelService`

```
apps/web/src/services/ProductFunnelService.ts
```

Extends `PublicApiSingleton` (no auth required, cached 60s):
```typescript
class ProductFunnelService extends PublicApiSingleton {
  async getProductFunnel(tenantId: string, productId: string): Promise<ProductFunnelPreview | null> {
    // GET /api/public/funnels/:tenantId/product/:productId
  }
}
```

### 4.6 Integration into Product Page Layouts

Each layout wrapper receives a new optional prop:

```typescript
interface ProductShowcaseLayoutProps {
  // ... existing props ...
  funnelPreview?: React.ReactNode; // NEW
}
```

In `page.tsx`, the funnel preview is constructed server-side (or as a client component) and passed to the active layout:

```typescript
// In page.tsx, after resolving product data:
const funnelPreview = (
  <ProductFunnelPreview
    tenantId={product.tenantId}
    productId={product.id}
    productPriceCents={product.priceCents}
    productType={product.productType || 'physical'}
    layoutVariant={productLayout}
  />
);

// Passed to layout:
<ProductShowcaseLayout
  // ... existing props ...
  funnelPreview={funnelPreview}
/>
```

Each layout renders it in its appropriate position:
- **Showcase:** Between the gallery/purchase grid and `ProductBottomSections`
- **Quick Commerce:** Between the compact purchase panel and bottom sections
- **Classic:** Between the product detail tabs and featured products

### 4.7 Analytics: New Event Types

Extend `FunnelAnalyticsService` with product-page-specific events:

| Event Type | Trigger | Metadata |
|---|---|---|
| `preview_viewed` | Funnel preview section renders on product page | `productId`, `funnelId`, `stepIds[]` |
| `preview_step_clicked` | User clicks an offer card in the preview | `productId`, `funnelId`, `stepId`, `offerItemId` |
| `preview_buy_now_clicked` | User clicks "Buy Now" from a specific offer card | `productId`, `funnelId`, `stepId` |

These events feed into the existing funnel analytics dashboard with a new "Preview → Checkout" conversion funnel metric.

### 4.8 Capability Gating

The funnel preview is gated by two conditions:
1. **Tenant has funnel_options enabled** — checked via `EffectiveFunnel.enabled` in the resolve call
2. **Product has an associated active funnel** — checked by the resolve call returning a non-null funnel

No new capability type or feature key is needed. The preview is a rendering surface for the existing `funnel_options` capability, following the capability-deployment-flow pattern (Phase 7: update rendering surfaces).

### 4.9 Product Type Specialization

The funnel preview adapts its behavior and messaging based on `productType`:

| Feature | Physical | Digital | Hybrid |
|---|---|---|---|
| **Offer card badge** | "Ships with order" / "Pickup available" | "Instant access" | "Instant + shipped" |
| **Bundle display** | Shows shipping note + basket savings | "All items delivered instantly" | Shows both delivery types |
| **"Buy Now" behavior** | Adds to cart → checkout | Can skip cart → direct checkout (if single item) | Adds to cart → checkout |
| **OTO timer** | Standard 5 min | Optional extended (no inventory risk) | Standard 5 min |
| **Coupon offer CTA** | "Use on next purchase" / "Save on your next visit" | "Apply to this purchase" | "Apply to this purchase" |
| **Inventory-aware messaging** | "Only 3 left — bundle while available" | N/A | "Limited stock for physical item" |
| **Basket savings display** | "Save $5 vs. buying separately" | N/A | "Save $8 vs. buying separately" |
| **Foot traffic CTA** | "Available for in-store pickup" | N/A | "Pickup or download" |

The `ProductFunnelPreview` component checks `productType` and adjusts labels, badges, and CTAs accordingly. For physical products, inventory data from the offer item is used to display urgency messaging (stock count, low-stock warnings).

---

## 5. Implementation Plan

### Sprint 1: Backend — Product Funnel Preview Endpoint

**Tasks:**
1. Add `getProductFunnelPreview()` method to `FunnelEngine.ts` — reuses `getCheckoutFunnel()` + batch-fetches offer item details (name, image, price, product_type) and coupon details
2. Add `GET /api/public/funnels/:tenantId/product/:productId` route to `funnel-checkout.ts`
3. Add `preview_viewed`, `preview_step_clicked`, `preview_buy_now_clicked` event types to `FunnelAnalyticsService`
4. Track `preview_viewed` events when the new endpoint is called (one per step, mirroring checkout behavior)

**Files:**
- `apps/api/src/services/FunnelEngine.ts` (new method)
- `apps/api/src/routes/funnel-checkout.ts` (new route)
- `apps/api/src/services/FunnelAnalyticsService.ts` (new event types)

### Sprint 2: Frontend — Funnel Preview Components

**Tasks:**
1. Create `ProductFunnelService.ts` — singleton extending `PublicApiSingleton`
2. Create `FunnelStepper.tsx` — visual timeline component
3. Create `FunnelOfferCard.tsx` — individual offer card with product image, price, badge
4. Create `ProductFunnelPreview.tsx` — container that resolves funnel, renders stepper + cards, handles empty/loading/error states
5. Product type specialization: physical (inventory urgency, basket savings, pickup CTAs), digital (instant access badges, direct checkout), hybrid (both)

**Files:**
- `apps/web/src/services/ProductFunnelService.ts` (NEW)
- `apps/web/src/components/products/FunnelStepper.tsx` (NEW)
- `apps/web/src/components/products/FunnelOfferCard.tsx` (NEW)
- `apps/web/src/components/products/ProductFunnelPreview.tsx` (NEW)

### Sprint 3: Frontend — Layout Integration

**Tasks:**
1. Add `funnelPreview` prop to `ProductShowcaseLayout`, `ProductQuickCommerceLayout`, and the Classic layout section
2. Render `ProductFunnelPreview` in each layout at the appropriate position
3. Wire up in `page.tsx` — construct the component and pass to active layout
4. Track `preview_step_clicked` and `preview_buy_now_clicked` events from offer card interactions
5. Responsive design: horizontal scroll on mobile, full grid on desktop

**Files:**
- `apps/web/src/app/products/[id]/page.tsx` (wire up)
- `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` (render preview)
- `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` (render preview)
- Classic layout section (render preview)

### Sprint 4: Analytics & Polish

**Tasks:**
1. Add "Preview → Checkout" conversion funnel to funnel analytics dashboard
2. Add preview view/click metrics to tenant analytics page
3. Bot knowledge integration — `BotKnowledgeEmbeddingService.refreshFunnelEmbeddings` already exists; ensure product-funnel associations are included
4. Empty state design: "No offers available for this product" vs. silent render
5. A/B test hook: `metadata.show_preview` flag on funnel to let merchants opt out of product-page preview while keeping checkout funnel

**Files:**
- `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/FunnelAnalyticsClient.tsx` (preview metrics)
- `apps/api/src/services/FunnelAnalyticsService.ts` (aggregation methods)
- `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx` (opt-out toggle)

---

## 6. Design Decisions

### 6.1 Why Not Modify the Checkout Flow?

The product page funnel preview is **additive**, not a replacement for the checkout funnel. The checkout flow (order bump on review step, post-purchase interstitials) remains unchanged. The preview simply surfaces the funnel earlier in the customer journey, creating awareness and intent before checkout.

### 6.2 Why a New Endpoint Instead of Reusing `/checkout`?

The existing `GET /api/public/funnels/:tenantId/checkout` returns step data but not offer item details (name, image, description). The product page needs these to render offer cards. Rather than making N+1 calls from the frontend, the new endpoint batch-fetches and enriches the response. The checkout endpoint remains optimized for its purpose (fast resolution, no enrichment).

### 6.3 Why Not a New Capability?

The funnel preview is a rendering surface for the existing `funnel_options` capability. It doesn't introduce a new concern — it displays the same funnel data in a new location. Adding a capability would violate R14 (one capability = one concern). The merchant opt-out is handled via funnel metadata (`metadata.show_preview`), not a new feature key.

### 6.4 Why Product-Type-Aware, Not Type-Specific?

The funnel preview is designed to work universally across physical, digital, and hybrid products. Each product type gets specialized UX (inventory urgency for physical, instant access for digital, dual-delivery for hybrid), but the core component and data flow are identical. This follows the platform pattern: the base feature works universally, but specific product types get tailored messaging (like how magazine gallery works for all products but is optimized for image-heavy products).

### 6.5 Merchant Opt-Out

Merchants may not want the funnel preview on product pages (e.g., they prefer the surprise factor of checkout-time offers). The opt-out is a simple boolean toggle in the funnel builder: `metadata.show_preview = false`. When false, the `ProductFunnelPreview` component renders nothing. Default: `true` (preview shown).

---

## 7. Data Flow Diagram

```
                    PRODUCT PAGE (server)
                          │
                    page.tsx
                    resolves product, tenant, capabilities
                          │
                    ┌─────┴─────┐
                    │           │
              ProductFunnelPreview (client component)
                    │
                    │ useEffect: resolveCheckoutFunnel
                    ▼
              ProductFunnelService.getProductFunnel(tenantId, productId)
                    │
                    │ GET /api/public/funnels/:tenantId/product/:productId
                    ▼
              FunnelEngine.getProductFunnelPreview()
                    │
                    ├── resolveEffectiveCapabilities(tenantId)
                    │     └── FunnelResolver: tier features + merchant prefs
                    │         → EffectiveFunnel { enabled, allowed_steps[] }
                    │
                    ├── prisma.tenant_sales_funnels.findMany()
                    │     WHERE entry_item_id = productId OR trigger_type = 'always'
                    │     INCLUDE tenant_funnel_steps WHERE is_active = true
                    │
                    ├── filter steps by allowed_steps
                    │
                    ├── batch fetch offer items (inventory_items)
                    │     WHERE id IN (step.offer_item_id for all steps)
                    │
                    ├── batch fetch coupons (tenant_coupons)
                    │     WHERE id IN (step.offer_item_id for coupon_offer steps)
                    │
                    └── return enriched CheckoutFunnel with offer_item + coupon details
                          │
                    ProductFunnelPreview renders:
                    ├── FunnelStepper (visual timeline)
                    ├── FunnelOfferCard[] (one per step)
                    └── Analytics: track preview_viewed per step
```

---

## 8. Edge Cases

| Edge Case | Handling |
|---|---|
| No active funnel for product | `ProductFunnelPreview` renders nothing |
| Funnel exists but no steps pass tier gate | Renders nothing (same as no funnel) |
| Offer item deleted/inactive | Offer card shows "Offer unavailable" with greyed-out style |
| Coupon deleted/expired | Coupon offer card shows "Coupon expired" or is hidden |
| Merchant opted out (`metadata.show_preview = false`) | Renders nothing |
| Multiple funnels match same product | First match (by `created_at desc`) is shown, same as checkout logic |
| Product is physical but has digital funnel offers | Works normally — digital offers shown as "Instant access" add-ons |
| Product is digital but has physical funnel offers | Works normally — physical offers show "Ships with order" + inventory status |
| Physical offer item has low stock | Offer card shows urgency badge: "Only N left — bundle while available" |
| Physical funnel offers exceed available stock | Offer card shows "Limited availability" with stock count; bundle savings still displayed |
| Cart value trigger (`trigger_type: 'cart_value'`) | Not applicable on product page (no cart yet) — only `product` and `always` triggers resolve |
| Guest user (not authenticated) | Preview works (public endpoint, no auth required) |

---

## 9. Relationship to Existing Systems

### 9.1 Funnel Checkout Flow (Sprint 3)

The product page preview is **upstream** of the checkout flow. It does not replace any checkout behavior:
- Order bump still appears on the checkout review step
- Upsell/downsell/OTO still appear as post-purchase interstitials
- The preview creates *awareness* of these offers before checkout

### 9.2 Coupon-Funnel Convergence (Sprint 9)

Coupon offer steps are already supported in funnels. The preview surfaces them on the product page with the coupon code and discount info, creating a "save for later" CTA that drives repeat purchases.

### 9.3 Product Catalog (All Types)

The preview works across all product types — physical, digital, and hybrid. It reads `productType` to adjust labels, badges, and CTAs. For physical products, it also reads inventory data from offer items to display urgency messaging. No changes to the product catalog system itself are needed; the preview is purely a rendering surface that consumes existing product + funnel data.

### 9.4 Magazine Gallery Pattern

The integration follows the same pattern used by the Magazine Gallery feature: a new component is conditionally rendered in each layout based on capability flags, with the layout determining placement and style.

### 9.5 Capability Deployment Flow

Per the capability-deployment-flow skill doc, adding a new rendering surface is Phase 7. No new capability type, feature key, resolver, or migration is needed. The preview consumes the existing `funnel_options` capability and the existing `CheckoutFunnel` data structure (enriched).

---

## 10. Future Enhancements (Out of Scope)

| Enhancement | Description |
|---|---|
| **Funnel A/B testing** | Show different funnels to different visitors, track conversion |
| **Dynamic pricing in preview** | Adjust offer prices based on visitor behavior (e.g., cart abandonment history) |
| **Funnel preview on storefront** | Show funnel preview on the main storefront page, not just product pages |
| **Bundle builder** | Let customers select multiple funnel offers as a custom bundle with combined discount |
| **Funnel preview analytics dashboard** | Dedicated dashboard showing preview views → checkout → purchase conversion |
| **AI-powered funnel suggestions** | Bot suggests funnel steps based on product catalog analysis |
| **Social proof in preview** | "23 people bought this offer in the last hour" badges on offer cards |

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Performance: extra API call on product page** | Medium | Low | 60s cache on `ProductFunnelService`, parallel fetch with other capability calls |
| **Offer item N+1 queries** | Low | Medium | Batch fetch in `getProductFunnelPreview()` |
| **Merchant confusion: preview vs. checkout** | Medium | Low | Clear labeling: "Available during checkout" on offer cards |
| **Preview reduces checkout surprise → lower conversion** | Low | Medium | Merchant opt-out via `metadata.show_preview = false`; A/B test in Sprint 4 |
| **Layout breakage on mobile** | Medium | Medium | Horizontal scroll with peek-through, tested at 320px breakpoint |
| **Stale funnel data after merchant edits** | Low | Low | Cache invalidation on funnel update (existing `invalidateServiceCaches` pattern) |

---

## 12. Summary

The Product × Funnel Fusion creates a unified product page that shows the complete purchase journey — not just the product, but the entire funnel the merchant has designed. For a grocery store, this means bundling complementary goods with savings that beat separate purchases, moving inventory swiftly while increasing basket size and driving foot traffic. For digital creators, it's a zero-friction "complete your toolkit" experience. For hybrid retailers, it bridges physical and digital value in a single offer journey.

**Key architectural decisions:**
- **No new capability** — uses existing `funnel_options`
- **New enriched endpoint** — batch-fetches offer item details for preview rendering
- **Additive to checkout** — preview surfaces the funnel earlier, checkout flow unchanged
- **Product-type-aware** — specialized UX per type (physical: inventory urgency, basket savings, pickup CTAs; digital: instant access, direct checkout; hybrid: both), core component universal
- **Merchant opt-out** — `metadata.show_preview` flag on funnel

**4 sprints:**
1. Backend endpoint + analytics events
2. Frontend components (stepper, offer cards, preview container)
3. Layout integration (all 3 product page layouts)
4. Analytics dashboard + polish
