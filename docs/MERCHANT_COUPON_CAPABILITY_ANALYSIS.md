# Merchant Coupon Capability — Analysis & Feasibility Report

## 1. Executive Summary

This report analyzes the feasibility of adding a **Merchant Coupon System** as a purchasable capability feature in the BSaaS Feature Store. The design mirrors the proven BSaaS catalog pattern: the platform sells a coupon capability to merchants, merchants create and distribute coupon codes to their customers, and the checkout flow validates and applies discounts.

### Core Concept

| BSaaS Coupons (Platform → Merchant) | Merchant Coupons (Merchant → Customer) |
|---|---|
| Platform admin creates Stripe coupons | Merchant creates custom coupon codes |
| Merchant enters promo code at BSaaS checkout | Customer enters coupon code at storefront checkout |
| Stripe API validates and applies discount | Platform API validates and applies discount |
| Discount on BSaaS feature purchase price | Discount on customer order subtotal |
| `CouponTargetService` restricts which features/tiers | Merchant configures coupon rules (product, category, min spend, etc.) |
| Admin manages via `/settings/admin/bsaas-promotions` | Merchant manages via `/t/:tenantId/settings/coupons` |

### Key Finding

The platform already has **80% of the infrastructure** needed:

- **`orders.discount_cents`** field exists (default 0) — `@/apps/api/prisma/schema.prisma:2754`
- **`order_items.discount_cents`** field exists (default 0) — `@/apps/api/prisma/schema.prisma:2665`
- **`calculateLineItem()`** and **`calculateOrderTotals()`** already accept discount parameters — `@/apps/api/src/utils/order-calculations.ts:31-77`
- **BSaaS coupon pattern** (Stripe coupons + promo codes + targeting) provides the architectural blueprint — `@/apps/api/src/services/CouponTargetService.ts`
- **Capability resolver pipeline** (17 steps) provides the gating mechanism — `@/apps/api/src/services/resolvers/types.ts:785-818`
- **BSaaS Feature Store** provides the purchase surface — `@/apps/web/src/app/(platform)/settings/feature-store/page.tsx`
- **Checkout flow** already validates items, calculates totals, and processes Stripe payments — `@/apps/api/src/routes/checkout.ts`

The **gap** is: no merchant-facing coupon CRUD, no checkout-time coupon validation, no coupon redemption tracking, and no capability feature key registered for this domain.

---

## 2. Current State Analysis

### 2.1 Existing Discount Infrastructure

**Database fields already present:**
- `orders.discount_cents` (Int, default 0) — order-level discount storage
- `order_items.discount_cents` (Int, default 0) — line-item discount storage
- `orders.currency` — multi-currency support
- `inventory_items.sale_price_cents` — per-product sale pricing (manual markdown)
- `product_variants.sale_price_cents` — per-variant sale pricing

**Order calculation utilities** (`@/apps/api/src/utils/order-calculations.ts`):
```typescript
// Already supports discounts at both line-item and order level
calculateLineItem(quantity, unitPriceCents, taxRate, discountCents)
calculateOrderTotals(items, shippingCents, orderDiscountCents)
```

**Sale price mechanism**: The checkout flow already handles `sale_price_cents` — if set, it replaces `price_cents` as the unit price. This is a simple markdown, not a coupon system. It lacks:
- Customer-facing code entry
- Expiry dates / usage limits
- Minimum spend requirements
- Product/category targeting
- Redemption tracking

### 2.2 BSaaS Coupon Pattern (Platform → Merchant)

The existing BSaaS coupon system (`@/.devin/skills/bsaas-coupons-private-features.md`) provides the architectural template:

**Two-layer model:**
1. **Coupon** — defines discount terms (percent_off or amount_off, duration)
2. **Promotion Code** — shareable code referencing a coupon

**Targeting system** (`CouponTargetService.ts`):
- 6 target types: features, tiers, capability types, tier types, demo status, subscription status
- AND logic between types, OR logic within types
- 60s in-memory cache
- Checkout-time validation before charging

**Admin management:**
- CRUD via `/api/admin/bsaas-promotions`
- Admin UI at `/settings/admin/bsaas-promotions`
- Stripe API integration for coupon/promo code creation

### 2.3 Capability System Architecture

The capability pipeline has 26 resolved domains (`@/apps/api/src/services/resolvers/types.ts:949-980`), indexed as `effective[0]` through `effective[25]`:

```
[0]  commerce              [13] directory_entry        [19] directory_promotion
[1]  payment_gateway        [14] faq                    [20] wholesale_matching
[2]  storefront             [15] crm                    [21] platform_services
[3]  fulfillment            [16] chatbot                [22] storefront_hours
[4]  barcode_scan           [17] org_options            [23] storefront_layouts
[5]  product_types          [18] social_commerce_options [24] storefront_maps
[6]  product_options                                [25] funnel
[7]  featured
[8]  integrations
[9]  quickstart
[10] storefront_options
[11] storefront_qr
[12] storefront_gallery
```

Each domain follows the same 5-layer pattern:
1. **Definition** — `canonical-features.ts` + `features_list` + `capability_features_list`
2. **Database** — `tier_features_list` (tier-bundled) + `tenant_feature_purchases` (BSaaS à la carte)
3. **Resolver** — Per-domain resolver in `resolvers/` directory
4. **Admin API** — CRUD routes for settings
5. **Frontend** — `UnifiedCapabilityService` mapper + settings UI

### 2.4 Checkout Flow

The checkout flow (`@/apps/api/src/routes/checkout.ts`) currently:
1. Validates items and stock availability
2. Fetches tenant commerce capabilities via `getTenantCommerceCapabilities()`
3. Uses `sale_price_cents` if available for unit pricing
4. Calculates order totals (subtotal, tax, shipping, discount)
5. Creates Stripe PaymentIntent
6. Creates order record with `discount_cents` field (currently always 0)

**No coupon validation step exists** in the checkout flow.

### 2.5 Existing `offer_coupon_code` Field

A single `offer_coupon_code` VARCHAR(100) field exists on a social commerce table (`@/apps/api/prisma/schema.prisma:1938`). This appears to be for social commerce event promotions (external coupon codes displayed in social posts), not a platform-managed coupon system. It is a display field, not a validation engine.

---

## 3. Proposed Architecture

### 3.1 Capability Registration

Following the BSaaS pattern (`@/.devin/skills/add-bsaas-feature.md`):

**New capability type:** `coupon_options`

**Feature key naming convention:**
- `_enabled` suffix is reserved **only** for the capability type gate (e.g., `coupon_enabled`)
- Group gates use `_on`/`_off` pattern (e.g., `coupon_discount_types_on` grants all discount type children)
- Individual feature keys use descriptive names without `_enabled` suffix
- This mirrors the QR plan's Phase 5 pattern: `storefront_opt_qr_styled_on` (group gate) → `storefront_opt_qr_dot_rounded` (individual)

**Feature keys:**

| Feature Key | Type | Purpose | Parent Gate | Tier-Bundled | BSaaS Purchasable |
|---|---|---|---|---|---|
| `coupon_enabled` | Capability gate | Master toggle for coupon system | (root) | Professional+ | Yes (lower tiers) |
| `coupon_disabled` | Capability disable | Explicit disengagement of coupon domain | (root) | — | — |
| `coupon_flexible` | Flexible key | Unlocks all coupon features for tier | (root) | Enterprise | — |
| `coupon_discount_types_on` | Group gate (on) | Grants all discount type children | `coupon_enabled` | Professional+ | Yes |
| `coupon_discount_types_off` | Group gate (off) | Explicitly disables all discount types | `coupon_enabled` | — | — |
| `coupon_percent_off` | Individual | Percentage-based discounts | `coupon_discount_types_on` | Professional+ | Yes |
| `coupon_fixed_amount` | Individual | Fixed-amount discounts | `coupon_discount_types_on` | Storefront+ | Yes |
| `coupon_free_shipping` | Individual | Free shipping coupons | `coupon_discount_types_on` | Storefront+ | Yes |
| `coupon_bogo` | Individual | Buy-one-get-one coupons | `coupon_discount_types_on` | Enterprise | Yes |
| `coupon_targeted` | Individual | Product/category-targeted coupons | `coupon_enabled` | Enterprise | Yes |
| `coupon_limited_redemption` | Individual | Usage limits + expiry dates | `coupon_enabled` | Professional+ | Yes |
| `coupon_analytics` | Individual | Redemption analytics dashboard | `coupon_enabled` | Professional+ | Yes |
| `coupon_qr_sharing` | Individual | Styled QR code generation for coupon codes | `coupon_enabled` | Professional+ | Yes |
| `coupon_spotlight` | Individual | Featured coupon display on public surfaces (storefront, directory, product pages) | `coupon_enabled` | Professional+ | Yes |

> **R17 compliance**: `coupon_disabled` follows the enablement precedence rule — `_disabled` > `_enabled` > `_flexible` > features. Every capability type MUST have a `_disabled` key in `features_list` per `capability-data-flow-rules.md` R17.
>
> **R23 compliance**: Every individual feature flag check in the resolver MUST include `flexible ||` prefix — including standalone booleans outside group arrays.

~~**Flexible key:** `coupon_flexible` — unlocks all coupon features for a tier~~ (moved to feature table above)

**QR alignment note:** The `coupon_qr_sharing` feature key gates access to the styled QR code renderer (`qr-code-styling` library) for merchant coupons. This mirrors the BSaaS QR plan's Phase 3 (`PromoCodeQRDialog.tsx`) and Phase 5 (`storefront_opt_qr_styled_on` feature key pattern). The same `qr-code-styling` library, style presets, and icon resolution logic are shared across both BSaaS promo QR codes and merchant coupon QR codes — see §3.8 for details.

**Parent gate mapping** (in `bsaas-purchases.ts` `PARENT_GATE_FEATURES`):
```typescript
coupon_options: 'coupon_enabled',
```

### 3.2 Database Schema

**New table: `tenant_coupons`**

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(255) PK | `cpn-{tk}-{nanoid}` tenant-scoped |
| `tenant_id` | VARCHAR(255) FK → tenants | Owning merchant |
| `code` | VARCHAR(50) | Customer-facing code (e.g., `SUMMER20`) |
| `description` | TEXT | Internal merchant note |
| `discount_type` | VARCHAR(20) | `percent_off` \| `fixed_amount` \| `free_shipping` \| `bogo` |
| `discount_value` | INTEGER | Percent (1-100) or cents (for fixed) |
| `min_spend_cents` | INTEGER | Minimum subtotal required (0 = no minimum) |
| `max_discount_cents` | INTEGER | Cap on discount amount (for percent_off) |
| `target_type` | VARCHAR(20) | `all` \| `specific_products` \| `specific_categories` |
| `target_ids` | JSONB | Array of inventory_item_ids or category slugs |
| `max_redemptions` | INTEGER | Total usage limit (NULL = unlimited) |
| `max_redemptions_per_customer` | INTEGER | Per-customer limit (default 1) |
| `times_redeemed` | INTEGER | Counter (default 0) |
| `starts_at` | TIMESTAMPTZ | Active from date |
| `expires_at` | TIMESTAMPTZ | Expiry date |
| `is_active` | BOOLEAN | Merchant toggle (default true) |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Unique constraint:** `(tenant_id, code)` — one code per tenant

**New table: `coupon_redemptions`**

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(255) PK | `redm-{tk}-{nanoid}` tenant-scoped |
| `tenant_id` | VARCHAR(255) FK | Merchant |
| `coupon_id` | VARCHAR(255) FK → tenant_coupons | Which coupon was redeemed |
| `order_id` | VARCHAR(255) FK → orders | Which order used it |
| `customer_email` | VARCHAR(255) | Customer email (for per-customer limits) |
| `customer_id` | VARCHAR(255) | Optional: logged-in customer ID |
| `discount_applied_cents` | INTEGER | Actual discount amount applied |
| `redeemed_at` | TIMESTAMPTZ | When |

**Indexes:**
- `tenant_coupons`: `(tenant_id, code)` unique, `(tenant_id, is_active)`, `(tenant_id, expires_at)`
- `coupon_redemptions`: `(tenant_id, coupon_id)`, `(tenant_id, customer_email)`, `(order_id)`

**RLS:** Tenant-scoped (merchants can only see their own coupons)

### 3.3 Backend Services

**`CouponService.ts`** — Singleton extending `BaseService`

| Method | Purpose |
|---|---|
| `createCoupon(tenantId, data)` | Create a coupon (validates capability first) |
| `updateCoupon(tenantId, couponId, data)` | Update coupon settings |
| `deleteCoupon(tenantId, couponId)` | Soft-delete (set `is_active = false`) |
| `listCoupons(tenantId, filters?)` | List coupons with filtering |
| `getCoupon(tenantId, couponId)` | Get single coupon |
| `validateCoupon(tenantId, code, context)` | Validate at checkout — returns discount or error |
| `redeemCoupon(tenantId, couponId, orderId, customerEmail)` | Record redemption, increment counter |
| `getCouponAnalytics(tenantId, couponId)` | Redemption stats |
| `getDashboardStats(tenantId)` | Aggregate coupon performance |

**`CouponResolver.ts`** — Per-domain resolver

> **Note on `_enabled` suffix in resolver fields:** The `_enabled` suffix in `EffectiveCouponOptions` fields (e.g., `percent_off_enabled`, `analytics_enabled`) follows the existing resolver convention across all domains — see `EffectiveProductOptions.creation_enabled`, `EffectiveStorefrontOptions.qr_enabled`, `EffectiveChatbot.skills_enabled`, etc. This is the resolver output interface, not feature key naming. Feature keys use `_enabled` only for the capability type gate and `_on`/`_off` for group gates (see §3.1). No conflict exists between the two naming spaces.

```typescript
export interface EffectiveCouponOptions {
  enabled: boolean;
  is_flexible: boolean;
  percent_off_enabled: boolean;
  fixed_amount_enabled: boolean;
  free_shipping_enabled: boolean;
  bogo_enabled: boolean;
  targeted_enabled: boolean;
  limited_redemption_enabled: boolean;
  analytics_enabled: boolean;
  qr_sharing_enabled: boolean;
  coupon_available: boolean;
  merchant_preferences: CouponOptionsMerchantSettings | null;
}
```

**Checkout integration** — Add coupon validation step to `checkout.ts`:

```
1. Validate items & stock (existing)
2. Validate commerce capabilities (existing)
3. NEW: Validate coupon code if provided
   a. Look up coupon by (tenant_id, code)
   b. Check is_active, starts_at, expires_at
   c. Check max_redemptions vs times_redeemed
   d. Check min_spend_cents vs subtotal
   e. Check target_type constraints (product/category)
   f. Check per-customer redemption limit
   g. Check capability: resolveEffectiveCapabilities(tenantId) → coupon_options
   h. Calculate discount: percent_off or fixed_amount or free_shipping
   i. Return discount_cents or error
4. Calculate order totals with discount (existing utility supports this)
5. Create Stripe PaymentIntent with adjusted amount
6. Create order with discount_cents populated
7. Record coupon redemption
```

### 3.4 API Routes

**Tenant routes** (`/api/tenants/:tenantId/coupons`):

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `/api/tenants/:tenantId/coupons` | GET | List coupons | Tenant auth |
| `/api/tenants/:tenantId/coupons` | POST | Create coupon | Tenant auth |
| `/api/tenants/:tenantId/coupons/:id` | GET | Get coupon | Tenant auth |
| `/api/tenants/:tenantId/coupons/:id` | PUT | Update coupon | Tenant auth |
| `/api/tenants/:tenantId/coupons/:id` | DELETE | Deactivate coupon | Tenant auth |
| `/api/tenants/:tenantId/coupons/:id/analytics` | GET | Redemption stats | Tenant auth |
| `/api/tenants/:tenantId/coupons/dashboard` | GET | Aggregate stats | Tenant auth |

**Public route** (no auth — checkout-time validation, follows `AUTH_SCOPE_ISOLATION_SPEC.md` FR-1):

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/public/tenants/:tenantId/coupons/validate` | POST | Validate coupon code at checkout |

**Request:** (tenantId comes from URL path, not body)
```json
{
  "code": "SUMMER20",
  "cartSubtotalCents": 5000,
  "items": [{ "inventoryItemId": "i-xxx", "categorySlug": "apparel" }],
  "customerEmail": "shopper@example.com"
}
```

**Response (valid):**
```json
{
  "valid": true,
  "discountType": "percent_off",
  "discountValue": 20,
  "discountCents": 1000,
  "couponId": "cpn-xxx",
  "message": "20% off applied"
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "reason": "min_spend_not_met",
  "message": "Minimum spend of $50.00 not reached"
}
```

### 3.5 Frontend

**Merchant UI:**
- **Page:** `/t/:tenantId/settings/coupons` — coupon management dashboard
- **Component:** `CouponManagementClient.tsx` — table of coupons with create/edit/deactivate
- **Create form:** code, discount type, value, min spend, max redemptions, expiry, target products/categories
- **Analytics view:** per-coupon redemption count, total discount given, revenue impact
- **Service:** `CouponService.ts` — singleton extending `TenantApiSingleton`
- **Settings card:** in `TenantSettings.tsx` — "Coupons & Promotions" card
- **Sidebar link:** SQL INSERT into `navigation_links` table (database-driven nav — see `.devin/skills/database-navigation-system.md`). File-based fallback in `DynamicTenantSidebar.tsx` is NOT active.
- **Icon registration:** Register coupon icon in `useNavLinks.tsx`, `NavItemRow.tsx`, and admin navigation `page.tsx` `IconComponents` map

**Customer checkout UI:**
- **Coupon input field** in cart/checkout page — "Have a coupon code?" with apply button
- **Discount line** in order summary — shows "-$10.00 (SUMMER20)" when applied
- **Error states:** invalid code, expired, min spend not met, usage limit reached
- **Success state:** green badge with discount amount

**Capability gating:**
- If `coupon_options.enabled === false` → coupon input field hidden in checkout
- If only `percent_off_enabled` → merchant can only create percent_off coupons
- `CapabilityShowcase.tsx` — "Coupons" row showing enabled features

### 3.6 Capability System Integration

**Resolver pipeline position:** Step 26 (`effective[26]`, after `funnel` at step 25)

**`EffectiveCapabilityResolver.ts`** — add `resolveCouponOptions()` call in both `Promise.all` pipelines (primary + MV-based), add to `effective[26]` in result object mapping.

**`resolvers/types.ts`** — add to `EffectiveCapabilities.effective`:
```typescript
coupon_options: EffectiveCouponOptions;
```
Also add `CouponOptionsMerchantSettings` interface and `couponOptions` field to `MerchantSettingsBundle`.

**`resolvers/index.ts`** — export `resolveCouponOptions` from barrel file.

**`public-tenant-capabilities.ts`** — add `coupon_options` block to `buildExpiredCapabilitiesResponse()` with all fields disabled (R13 compliance).

**`EffectiveCapabilityResolver.ts` subscription-status override** — add `result.effective.coupon_options.enabled = false` to both `isReadOnly` and `isLimited` blocks (coupon CRUD is write-heavy).

**Frontend `CapabilityResolutionService.ts`** — add `CouponOptionsState` interface, fallback resolver, and add to `AllCapabilitiesState`.

**Frontend `UnifiedCapabilityService.ts`** — add `BackendEffectiveCouponOptions`, `mapCouponOptions()` mapper, `getCouponOptionsState()` method.

**Frontend `useCapabilityAccess.ts`** — add `useCouponCapability` hook.

**Frontend `effective-capabilities.ts`** — add `CouponOptionsState` re-export.

**Frontend `TenantInfoService.ts`** — add `getCouponSettings()` + `updateCouponSettings()` methods.

**Frontend `PlanSummaryWidget.tsx`** — add entry to `CAPABILITY_META` array (label, icon, prefix, settingsPath).

**Frontend `PlanSummaryPanel.tsx`** — add entry to `CAPABILITY_DISPLAY` map + summary block in `resolveCapabilitySummaries()`.

**Frontend `PublicUnifiedCapabilityService.ts`** — add `CouponOptionsState` to `AllCapabilitiesState` mapping for public storefront reads.

**Admin `capability-constraints.ts`** — if CCL constraints are added (see Section 6.7), update `CONSTRAINT_METADATA` with `coupon_options` entry (key, label, fields, value_type, operators, values).

### 3.7 Bot Knowledge Integration (Optional Enhancement)

Following the pattern from `BotKnowledgeEmbeddingService.ts`:

- **`refreshCouponEmbeddings()`** — chunk active coupons into `bot_knowledge_embeddings` with `source_type='coupon'`
- **`BotDynamicResponseService`** — when customer asks about discounts/promos, search coupon embeddings and inject context
- **Refresh trigger:** fire-and-forget on coupon create/update/delete
- **Skill gate:** `chatbot_skill_product_search` (coupons are product-relevant)

### 3.8 QR Code Sharing for Merchant Coupons

**Aligned with**: `docs/BSAAS_COUPONS_GAP_CLOSURE_AND_QR_PLAN.md` Phases 3-5

The platform has a unified QR generation engine (`@/apps/web/src/lib/qr-engine.ts`) that serves as the single source of truth for all QR surfaces — storefront QR, BSaaS promo codes, private grant tokens, and product QR codes. Merchant coupons integrate into this same engine with new coupon-specific templates and a different URL scheme.

#### QR URL Scheme

```
https://{storefrontDomain}/?coupon={couponCode}
```

The storefront checkout page reads `coupon` from the URL query string and pre-fills the coupon code input. This mirrors the BSaaS scheme (`/settings/feature-store?promo={code}`) but targets the customer-facing storefront instead of the platform Feature Store.

**Short-code variant** (see §3.9): For QR codes and offline sharing, a compact URL using the tenant's 4-character autoId is preferred:
```
https://visibleshelf.com/s/{autoId}?c={couponCode}
```
Example: `https://visibleshelf.com/s/FRSH?c=SUMMER20` — 35 chars vs 60+ for full slug URL. See §3.9 for resolution architecture.

#### Shared Infrastructure from BSaaS QR Plan

| Component | Existing Infrastructure | Merchant Coupon Integration |
|---|---|---|
| `qr-engine.ts` | Unified QR engine — templates, options merging, gradient + logo overlay | Add coupon-specific templates to `QrTemplateName` union + `QR_TEMPLATES` map |
| `qr-code-styling` library | Already installed (used by styled QR path) | Same package, no additional install |
| `PromoCodeQRDialog.tsx` | BSaaS promo QR dialog (uses `qr-engine` + `qr-style-constants`) | Extended as `CouponQRDialog.tsx` — same dialog shell pattern, different URL scheme + icon source |
| `qr-style-config.ts` | Shared theme presets + `buildQROptions()` / `buildQROptionsFromSettings()` | Extend with coupon-specific theme configs if needed (primary engine is `qr-engine.ts`) |
| `qr-style-constants.ts` | `DOT_STYLES`, `CORNER_STYLES`, `CORNER_DOT_STYLES` arrays for style pickers | Reuse same constants in `CouponQRDialog.tsx` style controls |
| `QrEngineOptions` interface | Full styling options (dotType, cornerType, gradient, logo, etc.) | `CouponQRDialog.tsx` uses same interface for QR generation |
| Target-aware icon embedding | BSaaS: feature icon from `features_list.icon_name` | Merchant coupon: discount type icon (percent, dollar, truck, gift) |
| `storefront_opt_qr_styled_on` | Phase 5 public-surface QR pilot feature key | Merchant coupon QR uses `coupon_qr_sharing` feature key (separate capability domain) |
| Lucide SVG icon generation | `lucide-static` approach for BSaaS icons | Same approach for discount-type icons |

#### QR Style Themes

Existing templates in `qr-engine.ts` that can be reused directly:

| Template | `QrTemplateName` | Dot Style | Color | Corners | Use Case |
|---|---|---|---|---|---|
| **Promo (Default)** | `promo` | `rounded` | Blue `#1a56db` | `extra-rounded` | General coupon sharing |
| **Promo (Sale)** | `promo-sale` | `classy-rounded` | Red `#dc2626` | `rounded` | Limited-time percent off |
| **Bundle Promo** | `bundle-promo` | `extra-rounded` | Green `#16a34a` | `extra-rounded` | Free shipping / bundle discounts |
| **Private Grant** | `private-grant` | `dots` | Purple `#7c3aed` | `dot` | BOGO / exclusive campaigns |

New coupon-specific templates to add to `QrTemplateName` in `qr-engine.ts`:

| Template | `QrTemplateName` | Dot Style | Color | Corners | Icon | Use Case |
|---|---|---|---|---|---|---|
| **Merchant Promo** | `merchant-promo` | `rounded` | Blue `#1a56db` | `extra-rounded` | Discount type icon or merchant logo | Default coupon sharing |
| **Flash Sale** | `coupon-flash` | `classy-rounded` | Red `#dc2626` | `rounded` | Percent icon | Limited-time percent off |
| **Free Shipping** | `coupon-free-ship` | `extra-rounded` | Green `#16a34a` | `extra-rounded` | Truck icon | Free shipping coupons |
| **BOGO** | `coupon-bogo` | `dots` | Purple `#7c3aed` | `dot` | Gift icon | Buy-one-get-one campaigns |

> **Note**: The existing `promo`, `promo-sale`, `bundle-promo`, and `private-grant` templates can be used directly for coupon QR codes. The new coupon-specific templates are optional — they provide distinct visual identities for merchant coupons vs platform promo codes. If added, they must be appended to the `QrTemplateName` union type and `QR_TEMPLATES` map in `qr-engine.ts`.

#### Discount-Type-Aware QR Icon Resolution

Unlike BSaaS promo QR codes (which use `coupon_target_rules` to resolve feature icons), merchant coupon QR codes use the **discount type** to select the center icon:

1. `percent_off` → Lucide `IconPercent` (or merchant logo if preferred)
2. `fixed_amount` → Lucide `IconDollarSign`
3. `free_shipping` → Lucide `IconTruck`
4. `bogo` → Lucide `IconGift`
5. **Merchant logo override** → If merchant has a custom logo in `tenant_business_profile`, use it instead of the discount-type icon
6. **Fallback** → Platform logo

This mirrors the BSaaS plan's fallback chain (feature icon → capability icon → tier icon → platform logo) but uses discount types instead of coupon targets.

#### Backend Endpoint

```
GET /api/tenants/:tenantId/coupons/:id/qr
```

Returns QR metadata for client-side rendering:
```json
{
  "success": true,
  "data": {
    "qr_url": "https://visibleshelf.com/s/FRSH?c=SUMMER20",
    "short_code_url": "https://visibleshelf.com/s/FRSH?c=SUMMER20",
    "full_url": "https://store.visibleshelf.com/?coupon=SUMMER20",
    "auto_id": "FRSH",
    "coupon_code": "SUMMER20",
    "discount_type": "percent_off",
    "discount_value": 20,
    "target_icon": {
      "type": "discount_type",
      "icon_name": "IconPercent",
      "icon_url": null,
      "marketing_name": "20% Off"
    },
    "merchant_logo_url": "/uploads/tenant-xxx/logo.png"
  }
}
```

#### Frontend Component

**File**: `apps/web/src/app/t/[tenantId]/settings/coupons/CouponQRDialog.tsx` (new)

- Reuses `PromoCodeQRDialog.tsx` dialog shell pattern from BSaaS QR (same imports: `qr-engine`, `qr-style-constants`, `SectionBadge`, `Accordion`)
- Generates styled QR client-side using `generateQrInstance()` from `qr-engine.ts`
- Shows coupon code, storefront URL, discount info
- URL selector: short-code URL (`/s/FRSH?c=SUMMER20`) as default for QR encoding, full storefront URL (`/tenant/{tenantId}?coupon={code}`) as optional fallback in "Copy link" dropdown
- Theme selector (4 merchant-specific presets above)
- Download buttons: PNG, SVG, Copy link
- "Share to social" buttons (optional): generates a post with QR image + coupon text
- **Capability gating**: QR button only visible when `coupon_qr_sharing` feature key is enabled for the tenant

#### Storefront Auto-Fill from URL

**File**: Storefront checkout page (`/tenant/[id]` — cart/checkout component within the modern storefront)

- On page load, read `coupon` from `useSearchParams()`
- If present, pre-fill the coupon code input and auto-validate
- Show toast: "Coupon SUMMER20 applied — 20% off your order!"
- If invalid (expired, usage limit), show error toast
- This mirrors the BSaaS Feature Store auto-fill from `?promo=` (Phase 3.5)

### 3.9 Short-Code Tenant Resolution via 4-Character Auto ID

The platform has three tenant identification channels, all resolved through `UniversalIdentifierCache.resolveIdentifier()` (`@/apps/api/src/services/UniversalIdentifierCache.ts:97-143`):

| Identifier | Format | Example | Resolution Path |
|---|---|---|---|
| **Tenant ID** | `tid-{nanoid}` | `tid-042hi7ju` | `prisma.tenants.findUnique({ where: { id } })` — direct PK lookup |
| **Slug** | `business-name-state` | `fresh-market-downtown` | `prisma.tenants.findFirst({ where: { slug } })` — indexed lookup |
| **Auto ID (4-char key)** | `[A-Z0-9]{4}` | `FRSH` | `prisma.tenants.findMany({ where: { metadata: { path: ['autoId'], equals } } })` — JSONB metadata lookup |

The 4-character key is generated by `generateTenantKey()` in `@/apps/api/src/lib/id-generator.ts:499-518` — a deterministic hash from tenant ID using a 32-character alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no ambiguous chars 0/O/1/I). The same algorithm is duplicated in `@/apps/api/src/middleware/tenantAutoId.ts:11-31`.

**Existing infrastructure for autoId:**

| Component | Location | Status |
|---|---|---|
| `generateTenantKey()` | `apps/api/src/lib/id-generator.ts:499` | Active — used in all ID generators (orders, items, photos, etc.) |
| `generateTenantAutoId()` | `apps/api/src/middleware/tenantAutoId.ts:11` | Active — middleware + standalone |
| `isTenantAutoId()` | `apps/api/src/middleware/tenantAutoId.ts:85` | Active — validates `/^[A-Z0-9]{4}$/` pattern |
| `resolveTenantByIdentifier()` | `apps/api/src/services/TenantSingletonService.ts:824` | Active — tries tid → autoId → slug |
| `UniversalIdentifierCache.resolveIdentifier()` | `apps/api/src/services/UniversalIdentifierCache.ts:97` | Active — tries tid → slug → autoId (metadata JSONB) |
| `autoIdUrl` in `TenantInfo.urls` | `apps/api/src/services/TenantSingletonService.ts:56` | Active — `/shops/{autoId}` URL generated |
| `/api/shops/:identifier` | `apps/api/src/routes/shops.ts:142` | Active — accepts any identifier |
| `/api/public/shops/:identifier` | `apps/api/src/routes/public-catalog.ts:1560` | Active — public shop lookup by any identifier |
| Frontend `autoIdUrl` links | `apps/web/src/components/shops/ShopCard.tsx:117` | Active — "Short" link button in shop cards |

**Proposed short-code route for coupons:**

A new public route `/s/:autoId` (or `/s/:autoId?c={couponCode}`) would resolve the tenant via `UniversalIdentifierCache` and redirect to the storefront with the coupon code pre-filled:

```
GET /s/FRSH?c=SUMMER20
  → resolveIdentifier('FRSH') → { id: 'tid-xxx', slug: 'fresh-market-downtown' }
  → 302 redirect to /tenant/tid-xxx?coupon=SUMMER20
```

This provides the shortest possible QR URL for offline coupon sharing (print, physical QR, social media) while maintaining full compatibility with the existing identifier resolution system. The redirect targets `/tenant/{id}` (the modern storefront) rather than `/shops/{slug}` (the legacy directory).

**Why 4-char autoId is ideal for coupon QR codes:**

1. **Compact** — 4 chars vs 14+ for `tid-042hi7ju` or 20+ for slug. QR codes with less data are more scannable at smaller sizes.
2. **URL-safe** — uppercase alphanumeric only, no encoding needed
3. **Already resolved** — `UniversalIdentifierCache` handles the lookup with 15-min encrypted cache
4. **Frontend support** — `autoIdUrl` already generated in `TenantInfo.urls`, "Short" link buttons exist in `ShopCard.tsx`
5. **Deterministic** — same tenant always produces same key (hash-based, not random)
6. **No PII** — 4-char hash reveals nothing about the merchant name or location

**Known gap — metadata persistence**: The `UniversalIdentifierCache.resolveFromDatabase()` method (line 222-261) looks up autoId via `metadata->>'autoId'` JSONB path, but `generateTenantAutoId()` is a pure hash function with no database persistence step. The `warmCache()` method (line 321-327) checks `metadata.autoId` — implying the autoId should be stored in tenant metadata. **Recommendation**: The coupon migration (`118_tenant_coupons.sql`) or a prerequisite migration should persist `autoId` into `tenants.metadata` for all existing tenants:
```sql
UPDATE tenants SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('autoId', upper(substr(encode(decode(
  -- deterministic 4-char hash matching generateTenantKey() algorithm
  -- computed in application layer during migration backfill
), 'hex'), 'base64'), 1, 4)) WHERE metadata->>'autoId' IS NULL;
```
Alternatively, a backfill script in `scripts/` can iterate tenants and call `generateTenantKey(tenantId)` to populate `metadata.autoId`.

**Coupon QR URL comparison:**

| URL Format | Example | Chars | QR Density | Use Case |
|---|---|---|---|---|
| Full storefront + query | `https://visibleshelf.com/tenant/tid-042hi7ju?coupon=SUMMER20` | 58 | Medium | Online sharing (email, social) |
| Short-code + query | `https://visibleshelf.com/s/FRSH?c=SUMMER20` | 42 | Low (high scannability) | **QR codes, print, physical** |
| Legacy shops + query | `https://visibleshelf.com/shops/fresh-market-downtown?coupon=SUMMER20` | 68 | High (low scannability) | Legacy directory (not for QR) |

The short-code URL produces a less dense QR matrix, enabling smaller print sizes and faster scan rates — critical for physical coupon distribution (table tents, flyers, packaging inserts).

**Frontend short-code redirect page:**

**File**: `apps/web/src/app/s/[autoId]/page.tsx` (new)

- Server component — reads `autoId` from route params + `c` from query string
- Calls `/api/public/shops/:identifier` to resolve tenant
- Redirects to `/tenant/{tenantId}?coupon={c}` (official modern storefront at `/tenant/[id]`)
- 302 redirect (not 301 — tenant slug or ID may change)
- Error handling: invalid autoId → 404 page with "Store not found"

### 3.10 Coupon Spotlight — Public Surface Featured Coupon

**Gated by**: `coupon_spotlight` feature key (BSaaS purchasable, Professional+ tier-bundled)

The coupon spotlight is a **single reusable component** (`CouponSpotlight.tsx`) that any layout can render at a position appropriate to its structure. The merchant selects an active coupon, flips the "on" switch in settings, and the coupon appears on public surfaces with a promotional message and discount terms.

#### Layout System Architecture

The platform has three public surface types, each with multiple layouts:

| Surface | Route | Layouts | Shared Props Type | Layout Switch |
|---|---|---|---|---|
| **Storefront** | `/tenant/[id]` | classic, editorial, immersive | `StorefrontLayoutProps` (`@/app/products/[id]/layouts/types.ts`) | `page.tsx` switch on `storefrontLayout` |
| **Directory entry** | `/directory/[slug]` | classic, editorial, immersive, premium | `DirectoryEntryLayoutProps` (`@/app/directory/[slug]/layouts/types.ts`) | `page.tsx` switch on `effectiveLayout` |
| **Product page** | `/products/[id]` | classic, showcase, quick-commerce | `ProductLayoutProps` (derived from storefront layout via `PRODUCT_LAYOUT_MAP`) | Product detail page |

All layouts receive shared props and render sections in their own structural order. The `CouponSpotlight` component follows the same pattern as existing shared sections (e.g., `FeaturedBucketsShowcase`, `FaqStorefrontDisplay`, `LocationClosedBanner`) — one component, placed by each layout.

#### Component Design

**File**: `apps/web/src/components/storefront/CouponSpotlight.tsx` (new)

```tsx
interface CouponSpotlightProps {
  tenantId: string;
  coupon: SpotlightCoupon | null;
  variant?: 'banner' | 'card' | 'strip';
  className?: string;
}

interface SpotlightCoupon {
  id: string;
  code: string;
  discountType: 'percent_off' | 'fixed_amount' | 'free_shipping' | 'bogo';
  discountValue: number;
  promotionalMessage: string;  // merchant-written marketing copy
  termsSummary: string;         // e.g., "Min order $50. Expires Aug 31."
  expiresAt: string | null;
  redemptionUrl: string;        // /tenant/{tenantId}?coupon={code} or /s/{autoId}?c={code}
}
```

**Rendering variants** — the same component adapts to the layout's structural needs:

| Variant | Use Case | Layout Placement |
|---|---|---|
| `banner` | Full-width promotional banner with gradient background | Top of page, below header/nav (editorial, immersive, premium) |
| `card` | Bordered card with coupon code + terms | Sidebar or inline section (classic, editorial) |
| `strip` | Compact horizontal strip with code + CTA | Below product title or above checkout (product pages, all storefronts) |

Each layout chooses which variant to render and where to place it. The component itself handles:
- Discount type icon (Lucide `IconPercent`, `IconDollarSign`, `IconTruck`, `IconGift`)
- Promotional message display
- Discount terms summary
- Copy code button
- "Apply now" link to checkout with `?coupon={code}` URL param
- Expiry countdown (if `expiresAt` is set)
- Auto-hide when coupon is expired or exhausted (client-side check + backend validation)

#### Layout Placement Guide

**Storefront layouts** (`/tenant/[id]`):

| Layout | Variant | Position | Rationale |
|---|---|---|---|
| Classic | `card` | Between header and product catalog | Classic layout has vertical sections; card fits the flow |
| Editorial | `banner` | Below hero banner, above featured spotlight | Editorial has a full-width hero; banner continues the visual flow |
| Immersive | `strip` | Below sticky search bar, above product grid | Immersive is compact/mobile-first; strip is minimal and non-intrusive |

**Directory entry layouts** (`/directory/[slug]`):

| Layout | Variant | Position | Rationale |
|---|---|---|---|
| Classic | `card` | Below business info, above product categories | Classic directory is vertical; card fits between sections |
| Editorial | `banner` | Below hero image, above store info | Editorial has full-width hero; banner is natural continuation |
| Immersive | `strip` | Below header, above featured products | Immersive is compact; strip is minimal |
| Premium | `banner` | Below premium hero, above ratings section | Premium has large hero; banner maintains visual hierarchy |

**Product page layouts** (`/products/[id]`):

| Layout | Variant | Position | Rationale |
|---|---|---|---|
| Classic | `strip` | Below product title, above price | Compact strip near purchase decision point |
| Showcase | `card` | In sidebar, below product gallery | Showcase has room for sidebar content |
| Quick-commerce | `strip` | Below product image, above add-to-cart | Quick-commerce is mobile-first; strip is minimal |

#### Merchant Settings

The merchant selects which coupon to feature via the coupon management page:

**New field in `CouponOptionsMerchantSettings`**:
```ts
featuredCouponId: string | null;  // references tenant_coupons.id
spotlightEnabled: boolean;        // master toggle for spotlight display
```

**UI in coupon management page** (`CouponManagementClient.tsx`):
- Each coupon card has a "Feature on storefront" toggle
- Toggling on sets `featuredCouponId` to that coupon's ID and `spotlightEnabled = true`
- Only one coupon can be featured at a time (toggling on a new one turns off the previous)
- Toggle is gated by `coupon_spotlight` capability — if not enabled, show upgrade prompt

#### Public API Endpoint

```
GET /api/public/tenants/:tenantId/coupons/spotlight
```

Returns the active featured coupon for public display (no auth required, follows `AUTH_SCOPE_ISOLATION_SPEC.md` FR-1):

```json
{
  "success": true,
  "data": {
    "id": "cpn-FRSH-x7y2z9",
    "code": "SUMMER20",
    "discount_type": "percent_off",
    "discount_value": 20,
    "promotional_message": "Beat the heat with 20% off your entire order!",
    "terms_summary": "Min order $50. Expires Aug 31. One use per customer.",
    "expires_at": "2026-08-31T23:59:59Z",
    "redemption_url": "/s/FRSH?c=SUMMER20",
    "is_active": true,
    "remaining_uses": 47
  }
}
```

Returns `{ success: true, data: null }` when:
- `coupon_spotlight` capability is not enabled for the tenant
- `spotlightEnabled` is false in merchant settings
- The featured coupon is expired, exhausted, or deleted
- The tenant subscription is read-only or limited

This endpoint is called by `PublicCouponService.ts` (extends `PublicApiSingleton`) and cached client-side with the same pattern as other public capability lookups.

#### Capability Gating

The spotlight is gated at two levels:

1. **Tier/BSaaS level**: `coupon_spotlight` feature key must be enabled in `EffectiveCouponOptions` (resolved by `CouponResolver.ts`)
2. **Merchant level**: `spotlightEnabled` must be `true` AND `featuredCouponId` must reference a valid, active coupon

If the tier loses `coupon_spotlight` (downgrade, cancellation), the public endpoint returns `null` and the component renders nothing — no error state visible to customers.

#### Self-Containment (per decoupled-domain principle)

The `CouponSpotlight` component reads exclusively from:
- `EffectiveCouponOptions.spotlightEnabled` (capability state, not `optFlags` overlay)
- `PublicCouponService.getSpotlightCoupon()` (public API singleton, not direct fetch)
- `coupon_spotlight` feature flag from `useCouponCapability()` hook

This follows the 5-dimension self-containment principle: the component does not read from `StorefrontOptionFlags` or any legacy overlay — all rendering decisions come from the dedicated `coupon_options` domain state.

### 3.11 Coupon Analytics & Event Tracking

**Gated by**: `coupon_analytics` feature key (BSaaS purchasable, Professional+ tier-bundled)

The platform has a proven analytics pattern in `QrAnalyticsService` (`@/apps/api/src/services/QrAnalyticsService.ts`) and `BadgeAnalyticsService` (`@/apps/api/src/services/BadgeAnalyticsService.ts`). Both follow the same architecture:

1. **Event table** — raw event log (e.g., `qr_scan_events`, `badge_events`)
2. **Aggregate table** — period-based rollups (e.g., `qr_analytics`, `badge_analytics`)
3. **Service** — `trackEvent()`, `trackEvents()` (batch), `aggregateForTenant()`, `getDashboard()`, `getTimeSeries()`
4. **Routes** — tenant dashboard (auth), public event tracking (no auth), admin cross-tenant (auth)
5. **Sync job** — scheduled aggregation every 6 hours, iterates active tenants, computes day/week/month rollups
6. **Frontend** — singleton service + analytics client page with summary cards, per-surface table, time series chart, period/date filters

Coupon analytics follows this exact pattern, with coupon-specific event types and metrics.

#### Event Types

The QR system tracks one event type (`scan`). Coupons have a richer lifecycle with multiple event types:

| Event Type | Trigger | Source | Auth |
|---|---|---|---|
| `view` | Coupon spotlight rendered on a public surface | `CouponSpotlight.tsx` client-side | Public (no auth) |
| `copy` | Customer clicked "Copy code" button | `CouponSpotlight.tsx` client-side | Public (no auth) |
| `click` | Customer clicked "Apply now" link | `CouponSpotlight.tsx` client-side | Public (no auth) |
| `validate` | Coupon code submitted at checkout | Checkout page → `/api/public/tenants/:tenantId/coupons/validate` | Public (no auth) |
| `redeem` | Coupon successfully applied to a completed order | `checkout.ts` after successful payment | Server-side (no auth — backend triggered) |
| `fail` | Coupon validation failed (expired, exhausted, invalid) | Checkout validation endpoint | Public (no auth) |

#### Database Schema

**Event table**: `coupon_events` (mirrors `qr_scan_events` + `badge_events`)

```sql
CREATE TABLE IF NOT EXISTS coupon_events (
  id            VARCHAR(255) PRIMARY KEY,   -- cpe-{tk}-{nanoid}
  tenant_id     VARCHAR(255) NOT NULL,
  coupon_id     VARCHAR(255),               -- FK to tenant_coupons.id (nullable for invalid code attempts)
  coupon_code   VARCHAR(100),               -- the code entered/displayed (for events without coupon_id)
  event_type    VARCHAR(20) NOT NULL,       -- view, copy, click, validate, redeem, fail
  surface       VARCHAR(30),                -- storefront, directory, product, checkout, spotlight, qr_code
  session_id    VARCHAR(255),
  order_id      VARCHAR(255),               -- populated on redeem events
  discount_cents BIGINT DEFAULT 0,          -- populated on redeem events
  source        VARCHAR(100) DEFAULT 'coupon',
  referrer      TEXT,
  user_agent    TEXT,
  geo_country   VARCHAR(10),
  geo_city      VARCHAR(100),
  device_type   VARCHAR(20),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (mirror qr_scan_events pattern)
CREATE INDEX idx_coupon_events_tenant_time ON coupon_events (tenant_id, created_at DESC);
CREATE INDEX idx_coupon_events_tenant_event_time ON coupon_events (tenant_id, event_type, created_at DESC);
CREATE INDEX idx_coupon_events_coupon ON coupon_events (coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX idx_coupon_events_surface ON coupon_events (surface);

-- RLS: public INSERT (storefront tracking from anonymous users)
CREATE POLICY coupon_events_public_insert ON coupon_events FOR INSERT WITH CHECK (true);
```

**Aggregate table**: `coupon_analytics` (mirrors `qr_analytics` + `badge_analytics`)

```sql
CREATE TABLE IF NOT EXISTS coupon_analytics (
  id              VARCHAR(255) PRIMARY KEY,  -- cpa-{tk}-{nanoid}
  tenant_id       VARCHAR(255) NOT NULL,
  coupon_id       VARCHAR(255),              -- nullable for aggregate-all-coupons rows
  event_type      VARCHAR(20) NOT NULL,      -- view, copy, click, validate, redeem, fail
  surface         VARCHAR(30),               -- storefront, directory, product, checkout, spotlight, qr_code
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  period_type     VARCHAR(10) NOT NULL DEFAULT 'day',

  -- Counts
  total_events    INT NOT NULL DEFAULT 0,
  unique_visitors INT NOT NULL DEFAULT 0,    -- distinct session_id
  unique_coupons  INT NOT NULL DEFAULT 0,    -- distinct coupon_id

  -- Conversion funnel
  conversion_count INT NOT NULL DEFAULT 0,   -- events that led to redeem
  conversion_rate  DECIMAL(8,4) NOT NULL DEFAULT 0,

  -- Revenue (cents) — discount applied + attributed order revenue
  discount_cents   BIGINT NOT NULL DEFAULT 0,
  revenue_cents    BIGINT NOT NULL DEFAULT 0,  -- order revenue from coupon-attributed orders
  avg_discount_per_redeem BIGINT NOT NULL DEFAULT 0,

  -- Geo + device (same as QR analytics)
  top_country      VARCHAR(10),
  top_city         VARCHAR(100),
  mobile_scans     INT NOT NULL DEFAULT 0,
  desktop_scans    INT NOT NULL DEFAULT 0,
  tablet_scans     INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, coupon_id, event_type, surface, period_start, period_type)
);
```

#### Backend Service

**File**: `apps/api/src/services/CouponAnalyticsService.ts` (new)

Mirrors `QrAnalyticsService.ts` structure:

| Method | Purpose |
|---|---|
| `trackCouponEvent(input)` | Record a single coupon event (public, no auth) |
| `trackCouponEvents(inputs)` | Batch record (public, no auth) |
| `aggregateCouponAnalyticsForTenant(tenantId, periodType)` | Compute rollups from `coupon_events` → `coupon_analytics` |
| `getCouponAnalyticsDashboard(tenantId, period, daysBack)` | Dashboard summary: per-coupon, per-surface, per-event-type metrics |
| `getCouponTimeSeries(tenantId, couponId, period, daysBack)` | Time-series for a specific coupon |
| `getCouponFunnelReport(tenantId, daysBack)` | Funnel: views → copies → clicks → validates → redeems |
| `getCouponROIReport(tenantId, period, daysBack)` | ROI: discount given vs. revenue attributed |

**ID generators** (in `id-generator.ts`):
- `generateCouponEventId()` → `cpe-{tk}-{nanoid}`
- `generateCouponAnalyticsId()` → `cpa-{tk}-{nanoid}`

#### Routes

**File**: `apps/api/src/routes/coupon-analytics.ts` (new)

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/tenants/:tenantId/coupon-analytics` | Tenant | Dashboard summary (per-coupon, per-surface, per-event-type) |
| `GET /api/tenants/:tenantId/coupon-analytics/timeseries` | Tenant | Time-series for a specific coupon |
| `GET /api/tenants/:tenantId/coupon-analytics/funnel` | Tenant | Conversion funnel report |
| `GET /api/tenants/:tenantId/coupon-analytics/roi` | Tenant | ROI report (discount vs. revenue) |
| `POST /api/tenants/:tenantId/coupon-analytics/aggregate` | Tenant | Manual aggregation trigger |
| `POST /api/public/coupon-events` | Public | Track single coupon event (storefront/client-side) |
| `POST /api/public/coupon-events/batch` | Public | Batch track coupon events |
| `GET /api/admin/coupon-analytics` | Admin | Cross-tenant coupon analytics |

Public event tracking follows the same pattern as `POST /api/public/qr-events` — no auth, accepts `tenantId`, `couponId`, `couponCode`, `eventType`, `surface`, `sessionId`, etc.

#### Aggregation Job

**File**: `apps/api/src/jobs/coupon-analytics-sync.ts` (new)

- Runs every 6 hours (staggered after QR sync at 18 min startup delay)
- Iterates all active tenants
- Aggregates `coupon_events` → `coupon_analytics` for day/week/month periods
- Computes per-coupon, per-surface, per-event-type rollups
- Wired into server startup in `index.ts` alongside `qr-analytics-sync.ts` and `badge-analytics-sync.ts`

#### Frontend Analytics

**File**: `apps/web/src/services/CouponAnalyticsService.ts` (new)

Singleton extending `TenantApiSingleton` with:
- `getDashboard(tenantId, period, daysBack)`
- `getTimeSeries(tenantId, couponId, period, daysBack)`
- `getFunnelReport(tenantId, daysBack)`
- `getROIReport(tenantId, period, daysBack)`
- `triggerAggregation(tenantId, period)`
- `formatCurrency()`, `formatPercent()`, `formatNumber()` helpers (same as QR/Badge analytics services)

**File**: `apps/web/src/app/t/[tenantId]/settings/coupons/analytics/page.tsx` (new)

Analytics page at `/t/:tenantId/settings/coupons/analytics` with:
- Summary cards: total views, copy rate, redemption count, total discount given, revenue attributed
- Per-coupon performance table (sortable, clickable for time series drill-down)
- Conversion funnel visualization: view → copy → click → validate → redeem
- Revenue vs. discount bar chart (ROI)
- Period filter (day/week/month) + date range filter (7/14/30/60/90 days)
- Manual refresh button (triggers aggregation)

#### Event Tracking Integration Points

| Integration Point | Event Type | How |
|---|---|---|
| `CouponSpotlight.tsx` | `view`, `copy`, `click` | Client-side `POST /api/public/coupon-events` on component mount (view), button click (copy/click) |
| Checkout validation endpoint | `validate`, `fail` | Server-side `trackCouponEvent()` in `/api/public/tenants/:tenantId/coupons/validate` route handler |
| Checkout success | `redeem` | Server-side `trackCouponEvent()` in `checkout.ts` after successful payment + `redeemCoupon()` |
| QR code scan → redirect | `view` | `/s/[autoId]/page.tsx` tracks `view` event with `surface: 'qr_code'` before redirect |

#### QR Analytics Cross-Reference

Coupon QR codes (§3.8-3.9) generate QR scan events in the existing `qr_scan_events` table with `surface: 'promo'` (already in the `QrSurfaceType` union). The coupon analytics system adds a complementary `coupon_events` entry with `surface: 'qr_code'` when the QR redirect resolves. This provides:

- **QR analytics**: scan counts, device breakdown, geo data for the QR code itself
- **Coupon analytics**: full lifecycle funnel from QR scan → storefront view → checkout validate → redeem

The two systems are complementary, not duplicative — QR analytics tracks the physical QR interaction; coupon analytics tracks the coupon lifecycle across all surfaces.

#### Comparison with QR Analytics Architecture

| Aspect | QR Analytics (existing) | Coupon Analytics (proposed) |
|---|---|---|
| **Event table** | `qr_scan_events` (072, 117) | `coupon_events` (new migration) |
| **Aggregate table** | `qr_analytics` (117) | `coupon_analytics` (new migration) |
| **Event types** | `scan` (single) | `view`, `copy`, `click`, `validate`, `redeem`, `fail` (6 types) |
| **Surfaces** | storefront, product, directory, qr_landing, promo, private_grant, general | storefront, directory, product, checkout, spotlight, qr_code |
| **Service** | `QrAnalyticsService.ts` | `CouponAnalyticsService.ts` |
| **Routes** | `qr-analytics.ts` | `coupon-analytics.ts` |
| **Sync job** | `qr-analytics-sync.ts` (6h) | `coupon-analytics-sync.ts` (6h) |
| **Frontend service** | `QrAnalyticsService.ts` (web) | `CouponAnalyticsService.ts` (web) |
| **Analytics page** | `/settings/storefront-qr/analytics` | `/settings/coupons/analytics` |
| **Admin view** | `/settings/admin/qr-analytics` | `/settings/admin/coupon-analytics` |
| **ID generators** | `generateQrScanEventId`, `generateQrAnalyticsId` | `generateCouponEventId`, `generateCouponAnalyticsId` |
| **Unique metric** | Scans per surface | Conversion funnel (view → redeem) + ROI (discount vs. revenue) |

---

## 4. BSaaS Catalog Entry

### 4.1 Feature Store Listing

The coupon capability would appear in the BSaaS Feature Store (`/settings/feature-store`) as purchasable items:

| Feature Key | Marketing Name | Price | Billing | Trial |
|---|---|---|---|---|
| `coupon_enabled` | Coupon Engine | $19/mo | monthly | 14 days |
| `coupon_discount_types_on` | All Discount Types | $25/mo | monthly | 14 days |
| `coupon_percent_off` | Percentage Discounts | $9/mo | monthly | 14 days |
| `coupon_fixed_amount` | Fixed Amount Discounts | $9/mo | monthly | 14 days |
| `coupon_free_shipping` | Free Shipping Coupons | $12/mo | monthly | 14 days |
| `coupon_bogo` | BOGO Coupons | $15/mo | monthly | 14 days |
| `coupon_targeted` | Product/Category Targeting | $15/mo | monthly | 14 days |
| `coupon_limited_redemption` | Usage Limits & Expiry | $9/mo | monthly | 14 days |
| `coupon_analytics` | Coupon Analytics | $12/mo | monthly | 14 days |
| `coupon_qr_sharing` | QR Code Sharing | $12/mo | monthly | 14 days |
| `coupon_spotlight` | Coupon Spotlight | $9/mo | monthly | 14 days |

**Bundle opportunity:** "Marketing Suite" bundle — coupon_enabled + discount_types_on + targeted + limited_redemption + analytics + qr_sharing + spotlight at $65/mo (33% off).

### 4.2 Capability Engagement Rule

Following the existing `checkCapabilityEngagement()` pattern:
- A merchant's tier must already have at least one feature in `coupon_options` to purchase à la carte coupon features
- This prevents merchants with no coupon engagement from buying individual coupon sub-features

### 4.3 Companion Purchase Pattern

Following `PARENT_GATE_FEATURES`:
- Purchasing `coupon_percent_off` auto-creates a zero-cost companion purchase for `coupon_enabled` if the tier doesn't include it
- Cancelling all real coupon purchases cascades to cancel the `coupon_enabled` companion

---

## 5. Implementation Phases

### Phase 1: Database & Capability Registration (3-4 days)

- [ ] Migration: `118_tenant_coupons.sql` — `tenant_coupons` + `coupon_redemptions` + `coupon_events` + `coupon_analytics` tables, RLS, indexes, triggers. Also seed `coupon_options` capability type, 14 feature keys (1 gate + 1 disabled + 1 flexible + 2 group gates + 9 individual), `capability_features_list` links, `tier_features_list` entries, `bsaas_catalog` entries, and `navigation_links` INSERT for sidebar link
- [ ] Prisma schema: Add both models via `db pull` + `prisma generate`
- [ ] ID generators: `generateCouponId()` (`cpn-{tk}-{nanoid}`), `generateRedemptionId()` (`redm-{tk}-{nanoid}`), `generateCouponEventId()` (`cpe-{tk}-{nanoid}`), `generateCouponAnalyticsId()` (`cpa-{tk}-{nanoid}`)
- [ ] Seed `features_list`: 14 coupon feature keys (1 capability gate + 1 disabled + 1 flexible + 2 group gates + 9 individual)
- [ ] Seed `capability_features_list`: Link features to `coupon_options` capability type
- [ ] Seed `tier_features_list`: Enable features for Professional+ tiers
- [ ] Seed `bsaas_catalog`: 11 catalog entries with pricing (group gate + individual keys; `_off` key and `_disabled` key not sold)
- [ ] Seed `navigation_links`: INSERT coupon management sidebar link (database-driven nav)
- [ ] Feature definitions are seeded via SQL migration (no `canonical-features.ts` or `tier-hierarchies.ts` files exist in this codebase — features go directly into `features_list` via migration)

### Phase 2: Backend Services & Routes (4-5 days)

- [ ] `CouponService.ts` — CRUD, validate, redeem, analytics
- [ ] `CouponAnalyticsService.ts` — event tracking (`trackCouponEvent`, `trackCouponEvents`), aggregation (`aggregateCouponAnalyticsForTenant`), dashboard, time series, funnel report, ROI report (mirrors `QrAnalyticsService.ts` pattern, see §3.11)
- [ ] `CouponResolver.ts` — capability resolver (include `flexible ||` prefix on all feature flag checks per R23)
- [ ] `resolvers/types.ts` — add `EffectiveCouponOptions` + `CouponOptionsMerchantSettings` to types, add `coupon_options` to `EffectiveCapabilities.effective`, add `couponOptions` to `MerchantSettingsBundle`
- [ ] `resolvers/index.ts` — export `resolveCouponOptions`
- [ ] `EffectiveCapabilityResolver.ts` — wire resolver into both pipelines (primary + MV-based), add `effective[26]` mapping, add to `isReadOnly` + `isLimited` blocks
- [ ] `public-tenant-capabilities.ts` — add `coupon_options` to `buildExpiredCapabilitiesResponse()`
- [ ] Tenant routes: `/api/tenants/:tenantId/coupons` (CRUD + analytics)
- [ ] Public route: `/api/public/tenants/:tenantId/coupons/validate` (checkout validation, follows AUTH_SCOPE_ISOLATION_SPEC FR-1)
- [ ] Public route: `GET /api/public/tenants/:tenantId/coupons/spotlight` (featured coupon for public surfaces, follows AUTH_SCOPE_ISOLATION_SPEC FR-1) (see §3.10)
- [ ] Public route: `POST /api/public/coupon-events` + `POST /api/public/coupon-events/batch` (event tracking from storefront/client-side, no auth, mirrors `POST /api/public/qr-events` pattern) (see §3.11)
- [ ] Tenant routes: `GET /api/tenants/:tenantId/coupon-analytics` (dashboard), `GET .../timeseries`, `GET .../funnel`, `GET .../roi`, `POST .../aggregate` (mirrors `qr-analytics.ts` route structure) (see §3.11)
- [ ] Admin route: `GET /api/admin/coupon-analytics` (cross-tenant analytics, auth required) (see §3.11)
- [ ] Route registration in `routeRegistry.ts` (NOT `mounts/core-routes.ts` — that file does not exist; all routes are registered via `mountFromRegistry(app)` in `index.ts`)
- [ ] `PARENT_GATE_FEATURES` — add `coupon_options: 'coupon_enabled'`
- [ ] Zod validation schemas for all endpoints
- [ ] Audit logging for coupon CRUD

### Phase 3: Checkout Integration (2-3 days)

- [ ] Modify `checkout.ts` — add coupon validation step before payment
- [ ] Accept `coupon_code` in checkout request body
- [ ] Call `CouponService.validateCoupon()` → get `discount_cents`
- [ ] Apply discount to order totals via existing `calculateOrderTotals()`
- [ ] Store `discount_cents` on `orders` record (field already exists)
- [ ] Store `coupon_code`, `coupon_id` in order metadata
- [ ] Call `CouponService.redeemCoupon()` after successful payment
- [ ] Call `CouponAnalyticsService.trackCouponEvent()` — `redeem` event with `order_id`, `discount_cents`, `surface: 'checkout'` (see §3.11)
- [ ] Stripe PaymentIntent amount adjusted: `total_cents - discount_cents`
- [ ] Error handling: invalid coupon → `400 coupon_invalid`, expired → `400 coupon_expired`, etc.

### Phase 4: Frontend Merchant UI (4-5 days)

- [ ] `CouponService.ts` (frontend) — singleton extending `TenantApiSingleton` for merchant UI
- [ ] `PublicCouponService.ts` (frontend) — singleton extending `PublicApiSingleton` for customer-facing coupon validation (separate service per AUTH_SCOPE_ISOLATION_SPEC FR-2a)
- [ ] `/t/:tenantId/settings/coupons/page.tsx` — server component
- [ ] `CouponManagementClient.tsx` — coupon table, create/edit modal, deactivate
- [ ] Coupon create form: code, type, value, min spend, max redemptions, expiry, targeting
- [ ] Analytics view: per-coupon stats, dashboard summary
- [ ] `CouponAnalyticsService.ts` (frontend) — singleton extending `TenantApiSingleton` with `getDashboard`, `getTimeSeries`, `getFunnelReport`, `getROIReport`, `triggerAggregation` (see §3.11)
- [ ] `/t/:tenantId/settings/coupons/analytics/page.tsx` — analytics page with summary cards, per-coupon table, conversion funnel, ROI chart, period/date filters, manual refresh (mirrors `QrAnalyticsClient.tsx` pattern) (see §3.11)
- [ ] `TenantSettings.tsx` — "Coupons & Promotions" settings card
- [ ] `CapabilityShowcase.tsx` — "Coupons" row
- [ ] `PlanSummaryWidget.tsx` — add entry to `CAPABILITY_META` (slim dashboard widget)
- [ ] `PlanSummaryPanel.tsx` — add entry to `CAPABILITY_DISPLAY` + summary block (full plan page)
- [ ] `UnifiedCapabilityService.ts` — `mapCouponOptions()` mapper + `getCouponOptionsState()` method
- [ ] `CapabilityResolutionService.ts` — `CouponOptionsState` interface + fallback resolver + add to `AllCapabilitiesState`
- [ ] `effective-capabilities.ts` — re-export `CouponOptionsState`
- [ ] `useCapabilityAccess.ts` — `useCouponCapability` hook
- [ ] `TenantInfoService.ts` — `getCouponSettings()` + `updateCouponSettings()` methods
- [ ] `PublicUnifiedCapabilityService.ts` — add coupon state to public capability mapping
- [ ] Capability gating: hide UI when `coupon_options.enabled === false`
- [ ] Icon registration: `useNavLinks.tsx`, `NavItemRow.tsx`, admin navigation `page.tsx` `IconComponents` map
- [ ] **QR button** in coupon table — visible only when `coupon_qr_sharing` feature key enabled
- [ ] **Spotlight toggle** in coupon table — "Feature on storefront" toggle per coupon, visible only when `coupon_spotlight` feature key enabled (see §3.10)
- [ ] `CouponOptionsMerchantSettings` — add `featuredCouponId` + `spotlightEnabled` fields to merchant settings bundle
- [ ] `CouponQRDialog.tsx` — styled QR dialog (reuses `PromoCodeQRDialog` shell from BSaaS QR plan Phase 3)
- [ ] QR theme presets: Merchant Promo, Flash Sale, Free Shipping, BOGO (extends `qr-style-config.ts`)
- [ ] Download buttons: PNG, SVG, Copy link

### Phase 5: Frontend Customer Checkout UI (2-3 days)

- [ ] Coupon code input field in cart/checkout page
- [ ] "Apply Coupon" button → calls `/api/public/tenants/:tenantId/coupons/validate` via `PublicCouponService`
- [ ] Discount line in order summary
- [ ] Error/success states
- [ ] Hide coupon input when tenant doesn't have coupon capability (check via `PublicUnifiedCapabilityService`)
- [ ] Integration with existing checkout payment flow
- [ ] **Storefront auto-fill from URL** — read `coupon` from `useSearchParams()`, pre-fill code, auto-validate (mirrors BSaaS Feature Store `?promo=` auto-fill from QR plan Phase 3.5)
- [ ] Toast on auto-fill: "Coupon SUMMER20 applied — 20% off!"

### Phase 6: Bot Knowledge & Polish (2-3 days, optional)

- [ ] `BotKnowledgeEmbeddingService.refreshCouponEmbeddings()`
- [ ] `BotDynamicResponseService` — coupon RAG search
- [ ] Refresh triggers on coupon CRUD
- [ ] `BotKnowledgePage.tsx` — coupon embeddings card
- [ ] `BotService.ts` (frontend) — extend `refreshKnowledgeEmbeddings` sourceType union + status types
- [ ] Settings page for merchant coupon preferences (toggle domain)
- [ ] `admin/capability-constraints.ts` — update `CONSTRAINT_METADATA` with `coupon_options` entry if CCL constraints added (see Section 6.7)

### Phase 7: QR Code Sharing & Short-Code Routes (3-4 days, depends on BSaaS QR Plan Phase 3)

- [ ] Backend: `GET /api/tenants/:tenantId/coupons/:id/qr` — returns QR metadata (short-code URL, discount type icon, merchant logo)
- [ ] `CouponQRDialog.tsx` — styled QR dialog reusing `PromoCodeQRDialog` shell pattern + `qr-engine.ts` (`generateQrInstance`, `QR_TEMPLATE_LIST`, `QrTemplateName`)
- [ ] Add coupon-specific templates to `qr-engine.ts` `QrTemplateName` union + `QR_TEMPLATES` map (merchant-promo, coupon-flash, coupon-free-ship, coupon-bogo)
- [ ] Extend `qr-style-config.ts` with coupon theme configs if needed (primary engine is `qr-engine.ts`)
- [ ] Discount-type-aware icon resolution: `percent_off` → `IconPercent`, `fixed_amount` → `IconDollarSign`, `free_shipping` → `IconTruck`, `bogo` → `IconGift` (uses `lucide-static` approach from BSaaS QR plan Phase 3)
- [ ] Merchant logo override: if `tenant_business_profile` has a logo, use it as QR center image
- [ ] Storefront checkout auto-fill from `?coupon=` URL param
- [ ] Capability gating: QR button visible only when `coupon_qr_sharing` feature key enabled
- [ ] Download: PNG, SVG, Copy link
- [ ] **Short-code redirect route**: `apps/web/src/app/s/[autoId]/page.tsx` — server component that resolves autoId via `/api/public/shops/:identifier` and 302-redirects to `/tenant/{tenantId}?coupon={c}` (official storefront, not legacy `/shops/` route) (see §3.9)
- [ ] **Metadata backfill**: Prerequisite migration or `scripts/backfill_tenant_autoid.ts` script to persist `generateTenantKey(tenantId)` into `tenants.metadata.autoId` for all existing tenants (see §3.9 known gap)
- [ ] **QR URL default**: Coupon QR codes use short-code URL `https://visibleshelf.com/s/{autoId}?c={couponCode}` by default; full storefront URL (`/tenant/{tenantId}?coupon={code}`) available as fallback in `CouponQRDialog.tsx` "Copy link" dropdown

**Dependency**: Requires `qr-code-styling` package install + `PromoCodeQRDialog.tsx` from BSaaS QR plan Phase 3. If BSaaS QR plan is not yet implemented, Phase 7 can be deferred — merchant coupons function fully without QR sharing.

### Phase 8: Coupon Spotlight — Public Surface Display (3-4 days, depends on Phases 2 + 4)

- [ ] `CouponSpotlight.tsx` — single reusable component with `banner`, `card`, `strip` variants (see §3.10)
- [ ] `PublicCouponService.ts` — add `getSpotlightCoupon()` method (extends `PublicApiSingleton`)
- [ ] **Storefront integration**: Add `CouponSpotlight` to all 3 storefront layouts at layout-appropriate positions:
  - [ ] `StorefrontEditorialLayout.tsx` — `banner` variant below hero section
  - [ ] `StorefrontImmersiveLayout.tsx` — `strip` variant below sticky search bar
  - [ ] Classic storefront layout — `card` variant between header and product catalog
- [ ] **Directory entry integration**: Add `CouponSpotlight` to all 4 directory entry layouts at layout-appropriate positions:
  - [ ] `DirectoryEntryEditorialLayout.tsx` — `banner` variant below hero image
  - [ ] `DirectoryEntryImmersiveLayout.tsx` — `strip` variant below header
  - [ ] `DirectoryEntryPremiumLayout.tsx` — `banner` variant below premium hero
  - [ ] `DirectoryEntryClassicLayout.tsx` — `card` variant below business info
- [ ] **Product page integration**: Add `CouponSpotlight` to product page layouts:
  - [ ] Classic product layout — `strip` variant below product title
  - [ ] Showcase product layout — `card` variant in sidebar
  - [ ] Quick-commerce product layout — `strip` variant above add-to-cart
- [ ] `DirectoryEntryLayoutProps` — add optional `spotlightCoupon` to shared props type (`@/app/directory/[slug]/layouts/types.ts`)
- [ ] `StorefrontLayoutProps` — add optional `spotlightCoupon` to shared props type (`@/app/products/[id]/layouts/types.ts`)
- [ ] `PublicUnifiedCapabilityService.ts` — expose `coupon_spotlight` flag in public capability state
- [ ] Capability gating: component renders nothing when `coupon_spotlight` is disabled or no featured coupon is set
- [ ] Auto-hide: client-side check for expired/exhausted coupon + backend validation via spotlight endpoint
- [ ] Copy code button + "Apply now" link with `?coupon={code}` URL param
- [ ] **Event tracking**: `POST /api/public/coupon-events` on component mount (`view` event), copy button click (`copy` event), apply link click (`click` event) — client-side, no auth (see §3.11)
- [ ] Self-containment: reads exclusively from `coupon_options` domain state, not `StorefrontOptionFlags` overlay (per decoupled-domain principle)

**Dependency**: Requires Phase 2 (backend spotlight endpoint) + Phase 4 (merchant spotlight toggle UI). Can be deferred — merchant coupons function fully without public surface spotlight.

### Phase 9: Coupon Analytics & Event Tracking (3-4 days, depends on Phases 2 + 3)

- [ ] `CouponAnalyticsService.ts` — backend service: `trackCouponEvent`, `trackCouponEvents` (batch), `aggregateCouponAnalyticsForTenant`, `getCouponAnalyticsDashboard`, `getCouponTimeSeries`, `getCouponFunnelReport`, `getCouponROIReport` (mirrors `QrAnalyticsService.ts`) (see §3.11)
- [ ] `coupon-analytics.ts` routes — tenant dashboard, time series, funnel, ROI, manual aggregate (auth); public event tracking (no auth); admin cross-tenant (auth) (see §3.11)
- [ ] `coupon-analytics-sync.ts` job — scheduled aggregation every 6 hours, iterates active tenants, computes day/week/month rollups from `coupon_events` → `coupon_analytics` (mirrors `qr-analytics-sync.ts`) (see §3.11)
- [ ] Wire sync job into `index.ts` server startup alongside `qr-analytics-sync.ts` and `badge-analytics-sync.ts`
- [ ] `CouponAnalyticsService.ts` (frontend) — singleton extending `TenantApiSingleton` (see §3.11)
- [ ] `/t/:tenantId/settings/coupons/analytics/page.tsx` + `CouponAnalyticsClient.tsx` — analytics dashboard page with summary cards, per-coupon performance table, conversion funnel visualization, ROI chart, period/date filters, manual refresh (mirrors `QrAnalyticsClient.tsx`) (see §3.11)
- [ ] **Checkout event tracking**: `validate` + `fail` events in `/api/public/tenants/:tenantId/coupons/validate` route handler; `redeem` event in `checkout.ts` after successful payment (see §3.11)
- [ ] **Spotlight event tracking**: `view`, `copy`, `click` events from `CouponSpotlight.tsx` client-side (see §3.11)
- [ ] **QR redirect event tracking**: `view` event with `surface: 'qr_code'` in `/s/[autoId]/page.tsx` before redirect (see §3.11)
- [ ] Capability gating: analytics page visible only when `coupon_analytics` feature key enabled
- [ ] Admin analytics page: `/settings/admin/coupon-analytics` (cross-tenant view, mirrors `/settings/admin/qr-analytics`)

**Dependency**: Requires Phase 2 (backend service + routes) + Phase 3 (checkout `redeem` event tracking). Can be deferred — merchant coupons function fully without analytics.

**Total estimated: 25-34 days** (critical path: Phases 1-5 = 15-20 days; Phases 6-7 = 4-6 days optional; Phase 8 = 3-4 days optional; Phase 9 = 3-4 days optional)

---

## 6. Design Decisions

### 6.1 Stripe vs. Platform-Managed Coupons

**BSaaS coupons use Stripe's coupon/promotion code API** because the platform is the seller and Stripe processes the payment.

**Merchant coupons should NOT use Stripe's coupon API** because:
- Each merchant has their own Stripe Connect account — coupon management would require Stripe Connect scoped operations
- Stripe coupons only work with Stripe Subscriptions/invoices, not one-time PaymentIntents (same limitation as BSaaS renewal coupons)
- Merchants need flexibility (targeted products, categories, BOGO) that Stripe's coupon model doesn't support
- The platform already manages the checkout flow and can apply discounts before creating the PaymentIntent

**Decision:** Platform-managed coupons stored in `tenant_coupons` table, validated by `CouponService.validateCoupon()`, discount applied to PaymentIntent amount before Stripe charge.

### 6.2 Discount Calculation

| Type | Calculation | Example |
|---|---|---|
| `percent_off` | `discount_cents = round(subtotal * value / 100)`, capped by `max_discount_cents` | 20% off $50 = $10 |
| `fixed_amount` | `discount_cents = min(value, subtotal)` | $10 off $50 = $10 |
| `free_shipping` | `discount_cents = shipping_cents` | Shipping $8 → discount $8 |
| `bogo` | `discount_cents = cheapest_item_price` (buy one get one free) | $20 item + $15 item → discount $15 |

### 6.3 Per-Customer Limiting

Customer identification for per-customer redemption limits:
1. **Logged-in customer** — use `customer_id` from JWT token
2. **Guest checkout** — use `customer_email` (case-insensitive)
3. **Both** — check `coupon_redemptions` for matching `customer_id` OR `customer_email`

### 6.4 Coupon Code Uniqueness

- Unique per tenant: `(tenant_id, code)` unique constraint
- Two different merchants can both have code `SUMMER20`
- Case-insensitive lookup: `LOWER(code) = LOWER(input)` in validation query
- Code format: alphanumeric + hyphens, 3-50 characters, no spaces

### 6.5 Checkout Flow Position

Coupon validation happens **after** item validation but **before** Stripe PaymentIntent creation:

```
1. Validate items & stock
2. Validate commerce capabilities
3. Calculate subtotal (using sale_price if applicable)
4. NEW: Validate coupon → get discount_cents → track `validate`/`fail` event
5. Calculate final total: subtotal - discount + tax + shipping
6. Create Stripe PaymentIntent for final total
7. Create order record with discount_cents
8. On payment success: record coupon redemption → track `redeem` event
```

This ensures the Stripe charge amount already reflects the discount.

### 6.6 Sale Price + Coupon Stacking

**Decision:** Coupons apply to the post-sale-price subtotal, not the original price. If an item is on sale for $15 (was $20), a 20% coupon applies to $15 ($3 discount), not $20 ($4 discount). This prevents double-dipping and is the standard e-commerce behavior.

### 6.7 CCL Integration

The Cross-Capability Constraint Layer (CCL) could enforce:
- `coupon_free_shipping` **requires** `fulfillment_options.shipping_enabled` (can't offer free shipping without shipping)
- `coupon_bogo` **recommends** `product_options.product_variant_enabled` (BOGO works best with variants)
- `coupon_targeted` **requires** inventory items to exist

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Coupon abuse (code sharing) | Medium | Per-customer limits, max redemptions, expiry dates |
| Discount calculation edge cases | Low | Comprehensive test suite, `Math.max(0, ...)` guards |
| Performance on validation | Low | Index on `(tenant_id, code)`, 60s cache on active coupons |
| Stripe amount mismatch | Medium | Validate coupon BEFORE PaymentIntent, not after |
| Capability bypass via direct API | Low | Checkout route checks `resolveEffectiveCapabilities()` |
| Bot indexing coupon codes | Low | Coupons are tenant-scoped, not in sitemap, no public listing |
| QR code phishing (fake coupon QRs) | Low | QR URLs use official storefront domain only; coupon validation is server-side; invalid codes show error toast |
| `qr-code-styling` scannability with discount-type icons | Low | Use `errorCorrectionLevel: 'H'` when icon embedded; same mitigation as BSaaS QR plan Phase 3; test with multiple QR readers |
| QR dependency on BSaaS QR plan | Low | Phase 7 can be deferred; merchant coupons function fully without QR; `qr-code-styling` install is shared dependency |
| Spotlight showing expired coupon | Low | Public endpoint validates coupon status server-side; component auto-hides on `data: null`; client-side expiry check as fallback |
| Analytics event volume (spotlight views) | Low | Public event tracking is fire-and-forget (non-blocking); batch endpoint available; aggregation job runs every 6h, not real-time; same pattern as QR scan events |

---

## 8. File Inventory

### New Files

| File | Purpose |
|---|---|
| `database/migrations/118_tenant_coupons.sql` | Table creation + RLS + indexes + feature/capability/tier/bsaas_catalog/nav_links seeds |
| `apps/api/src/services/CouponService.ts` | Backend coupon service (CRUD + validate + redeem) |
| `apps/api/src/services/resolvers/CouponResolver.ts` | Capability resolver |
| `apps/api/src/routes/coupons.ts` | Tenant coupon CRUD routes |
| `apps/api/src/routes/public/coupons.ts` | Public coupon validation route |
| `apps/web/src/services/CouponService.ts` | Frontend merchant coupon service |
| `apps/web/src/app/t/[tenantId]/settings/coupons/page.tsx` | Merchant coupon page |
| `apps/web/src/app/t/[tenantId]/settings/coupons/CouponManagementClient.tsx` | Merchant coupon UI |
| `apps/web/src/app/t/[tenantId]/settings/coupons/CouponQRDialog.tsx` | Styled QR dialog for merchant coupons (reuses `PromoCodeQRDialog` shell) |
| `apps/web/src/hooks/tenant-access/useCouponCapability.ts` | Capability hook |
| `apps/web/src/app/s/[autoId]/page.tsx` | Short-code redirect page — resolves 4-char autoId → tenant slug, 302 redirect with coupon code (see §3.9) |
| `apps/web/src/services/PublicCouponService.ts` | Public coupon validation service (extends `PublicApiSingleton`) |
| `apps/web/src/components/storefront/CouponSpotlight.tsx` | Single reusable spotlight component with `banner`, `card`, `strip` variants (see §3.10) |
| `apps/api/src/services/CouponAnalyticsService.ts` | Backend coupon analytics service: event tracking, aggregation, dashboard, funnel, ROI (mirrors `QrAnalyticsService.ts`) (see §3.11) |
| `apps/api/src/routes/coupon-analytics.ts` | Coupon analytics routes: tenant dashboard, time series, funnel, ROI, public event tracking, admin cross-tenant (see §3.11) |
| `apps/api/src/jobs/coupon-analytics-sync.ts` | Scheduled aggregation job — runs every 6h, aggregates `coupon_events` → `coupon_analytics` (mirrors `qr-analytics-sync.ts`) (see §3.11) |
| `apps/web/src/services/CouponAnalyticsService.ts` | Frontend coupon analytics service (extends `TenantApiSingleton`) (see §3.11) |
| `apps/web/src/app/t/[tenantId]/settings/coupons/analytics/page.tsx` | Coupon analytics page (server component) |
| `apps/web/src/app/t/[tenantId]/settings/coupons/analytics/CouponAnalyticsClient.tsx` | Coupon analytics dashboard UI — summary cards, per-coupon table, conversion funnel, ROI chart (mirrors `QrAnalyticsClient.tsx`) (see §3.11) |
| `apps/web/src/app/(platform)/settings/admin/coupon-analytics/page.tsx` | Admin cross-tenant coupon analytics page (mirrors `/settings/admin/qr-analytics`) |
| `scripts/backfill_tenant_autoid.ts` | Backfill script — persists `generateTenantKey(tenantId)` into `tenants.metadata.autoId` for all existing tenants |

### Modified Files

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Add `tenant_coupons` + `coupon_redemptions` + `coupon_events` + `coupon_analytics` models |
| `apps/api/src/lib/id-generator.ts` | Add `generateCouponId`, `generateRedemptionId`, `generateCouponEventId`, `generateCouponAnalyticsId` |
| `apps/api/src/services/resolvers/types.ts` | Add `EffectiveCouponOptions` to `EffectiveCapabilities` |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Wire `CouponResolver` into pipeline |
| `apps/api/src/routes/checkout.ts` | Add coupon validation step + `redeem` event tracking via `CouponAnalyticsService.trackCouponEvent()` (see §3.11) |
| `apps/api/src/routes/bsaas-purchases.ts` | Add `coupon_options` to `PARENT_GATE_FEATURES` |
| `apps/api/src/routes/routeRegistry.ts` | Register coupon routes + coupon-analytics routes (all route mounting via `mountFromRegistry`) |
| `apps/web/src/services/CapabilityResolutionService.ts` | Add `CouponOptionsState` |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Add `mapCouponOptions()` |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | Add `useCouponCapability` |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | Add "Coupons" row |
| `apps/web/src/components/settings/TenantSettings.tsx` | Add "Coupons & Promotions" card |
| `database/migrations/118_tenant_coupons.sql` | Also seeds `features_list`, `capability_features_list`, `tier_features_list`, `bsaas_catalog`, `navigation_links` (no separate canonical-features.ts file exists in this codebase) |
| `apps/web/src/lib/qr-engine.ts` | Add coupon-specific templates to `QrTemplateName` union + `QR_TEMPLATES` map |
| `apps/web/src/lib/qr-style-config.ts` | Extend with coupon theme configs (secondary to `qr-engine.ts`) |
| `apps/web/src/lib/qr-style-constants.ts` | Reused as-is (DOT_STYLES, CORNER_STYLES, CORNER_DOT_STYLES for `CouponQRDialog` style controls) |
| Storefront checkout page | Read `coupon` from URL, pre-fill + auto-validate |
| `apps/web/src/services/PublicCouponService.ts` | Public coupon validation service (extends `PublicApiSingleton`) |
| `apps/api/src/services/resolvers/index.ts` | Export `resolveCouponOptions` |
| `apps/web/src/types/effective-capabilities.ts` | Re-export `CouponOptionsState` |
| `apps/web/src/services/TenantInfoService.ts` | `getCouponSettings` + `updateCouponSettings` methods |
| `apps/web/src/services/PublicUnifiedCapabilityService.ts` | Add coupon state to public capability mapping |
| `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` | Add `CouponSpotlight` (banner variant) below hero section |
| `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` | Add `CouponSpotlight` (strip variant) below sticky search bar |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryEditorialLayout.tsx` | Add `CouponSpotlight` (banner variant) below hero image |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryImmersiveLayout.tsx` | Add `CouponSpotlight` (strip variant) below header |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryPremiumLayout.tsx` | Add `CouponSpotlight` (banner variant) below premium hero |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryClassicLayout.tsx` | Add `CouponSpotlight` (card variant) below business info |
| `apps/web/src/app/directory/[slug]/layouts/types.ts` | Add optional `spotlightCoupon` to `DirectoryEntryLayoutProps` |
| `apps/web/src/app/products/[id]/layouts/types.ts` | Add optional `spotlightCoupon` to `StorefrontLayoutProps` + `ProductLayoutProps` |
| `apps/api/src/index.ts` | Wire `coupon-analytics-sync.ts` job startup + mount `coupon-analytics.ts` routes (see §3.11) |
| `apps/web/src/app/s/[autoId]/page.tsx` | Track `view` event with `surface: 'qr_code'` via `POST /api/public/coupon-events` before redirect (see §3.11) |

---

## 9. Comparison with BSaaS Coupon Pattern

| Aspect | BSaaS Coupons (existing) | Merchant Coupons (proposed) |
|---|---|---|
| **Seller** | Platform | Merchant |
| **Buyer** | Merchant (tenant) | Customer (shopper) |
| **Coupon storage** | Stripe API (external) | `tenant_coupons` table (internal) |
| **Promo code storage** | Stripe API (external) | `code` field on `tenant_coupons` |
| **Targeting** | `CouponTargetService` (6 target types) | `target_type` + `target_ids` (products/categories) |
| **Validation** | Stripe API lookup + `CouponTargetService` | `CouponService.validateCoupon()` |
| **Discount application** | Stripe coupon on charge | Manual discount on PaymentIntent amount |
| **Redemption tracking** | Stripe `times_redeemed` | `coupon_redemptions` table |
| **Admin surface** | `/settings/admin/bsaas-promotions` | `/t/:tenantId/settings/coupons` |
| **Capability gating** | None (admin-only) | `coupon_options` resolver + BSaaS purchase |
| **Renewal behavior** | Not re-applied (known limitation, addressed by QR plan Phase 2) | N/A (one-time per order) |
| **QR code sharing** | `PromoCodeQRDialog.tsx` + `qr-code-styling` (QR plan Phase 3) | `CouponQRDialog.tsx` reuses same library + dialog shell (§3.8) |
| **QR URL scheme** | `/settings/feature-store?promo={code}` | `/?coupon={code}` (storefront checkout) |
| **QR icon source** | Coupon target rules → feature icon | Discount type → Lucide icon (percent, dollar, truck, gift) |
| **Audit** | `bsaas_coupon.create` etc. | `coupon.create`, `coupon.redeem` etc. |

---

## 10. Conclusion

The Merchant Coupon Capability is a **high-feasibility, high-value** feature that:

1. **Reuses existing infrastructure** — `orders.discount_cents`, `order-calculations.ts`, capability resolver pipeline, BSaaS Feature Store
2. **Follows proven patterns** — BSaaS coupon system, capability resolver architecture, singleton service pattern, tenant-scoped ID generation
3. **Aligns with BSaaS QR plan** — reuses `qr-code-styling` library, `PromoCodeQRDialog` component shell, `qr-style-config.ts` theme presets, and `lucide-static` icon generation from `docs/BSAAS_COUPONS_GAP_CLOSURE_AND_QR_PLAN.md` Phases 3-5
4. **Generates new revenue** — 10 purchasable feature keys (including `coupon_discount_types_on` group gate and `coupon_qr_sharing`) + potential bundle, targeting merchants who need marketing tools
5. **Fills a competitive gap** — Most e-commerce platforms offer coupons; the platform currently only has manual sale pricing
6. **Minimal risk** — Additive only, no changes to existing tables (just populating the `discount_cents` field that's been there since creation)

The 19-26 day implementation timeline is conservative given that 80% of the infrastructure already exists. The critical path (Phases 1-5) delivers a merchant-usable system; Phase 6 (bot integration) and Phase 7 (QR sharing) are optional enhancements. Phase 7 depends on the BSaaS QR plan's Phase 3 for `qr-code-styling` install and `PromoCodeQRDialog.tsx` — if the QR plan is not yet implemented, Phase 7 can be deferred without impacting core coupon functionality.

**Recommended next step:** Create a sprint plan document with detailed task breakdown, similar to `docs/DIRECTORY_PROMOTION_SPRINT_PLAN.md` and `docs/DIGITAL_PRODUCT_CATALOG_FUNNEL_SPRINT_PLAN.md`.
