# Merchant Coupon Capability — Sprint Plan

## Status: Draft
## Date: July 2026
## Source: `MERCHANT_COUPON_CAPABILITY_ANALYSIS.md` (full architecture document)

---

## Sprint Overview

Merchant coupons are a new capability domain (`coupon_options`) that enables merchants to create, manage, and track their own coupons — validated at checkout, displayed on public surfaces via a spotlight component, shared via QR codes, and measured with full event-level analytics. This sprint plan brings the feature from zero to production across 7 sprints.

**Critical path:** Sprints 1-4 (core coupon CRUD + checkout + merchant UI + customer checkout)
**Optional sprints:** Sprint 5 (Bot knowledge), Sprint 6 (QR sharing + short-code routes), Sprint 7 (Spotlight public display), Sprint 8 (Analytics & event tracking)

| Sprint | Phase(s) | Duration | Goal | Priority |
|--------|----------|----------|------|----------|
| **Sprint 1** | Phase 1 | 3-4 days | Database schema, capability registration, ID generators, feature seeds | P0 — Critical |
| **Sprint 2** | Phase 2 | 4-5 days | Backend services: `CouponService`, `CouponResolver`, all API routes, route registration | P0 — Critical |
| **Sprint 3** | Phase 3 | 2-3 days | Checkout integration: coupon validation, discount application, redemption tracking | P0 — Critical |
| **Sprint 4** | Phase 4 + 5 | 5-6 days | Frontend merchant UI (coupon management, capability hooks, settings) + customer checkout UI (coupon input, auto-fill) | P0 — Critical |
| **Sprint 5** | Phase 8 | 3-4 days | Coupon Spotlight: single reusable component integrated into all 10 layout variants (3 storefront + 4 directory + 3 product) | P1 — High |
| **Sprint 6** | Phase 7 | 3-4 days | QR code sharing: styled QR dialog, short-code redirect route, autoId backfill | P1 — High |
| **Sprint 7** | Phase 9 | 3-4 days | Coupon analytics: event tracking, aggregation job, dashboard with funnel + ROI | P1 — High |
| **Sprint 8** | Phase 6 | 2-3 days | Bot knowledge integration, CCL constraints, polish | P2 — Medium |

**Total estimated duration:** 25-34 days (critical path: 14-18 days for Sprints 1-4)

---

## Dependency Graph

```
Sprint 1 (DB + Capability)
  ├──→ Sprint 2 (Backend Services)
  │      ├──→ Sprint 3 (Checkout Integration)
  │      │      └──→ Sprint 4 (Frontend Merchant + Customer UI)
  │      │             ├──→ Sprint 5 (Coupon Spotlight) [P1]
  │      │             ├──→ Sprint 6 (QR Sharing) [P1, also depends on BSaaS QR Plan Phase 3]
  │      │             └──→ Sprint 7 (Analytics) [P1, also depends on Sprint 3]
  │      └──→ Sprint 7 (Analytics) [P1 — backend service + routes can start after Sprint 2]
  └──→ Sprint 8 (Bot Knowledge + Polish) [P2 — can start after Sprint 4]
```

**Key dependencies:**
- Sprint 2 requires Sprint 1 (tables + capability registration must exist)
- Sprint 3 requires Sprint 2 (CouponService.validateCoupon must exist)
- Sprint 4 requires Sprint 2 + Sprint 3 (frontend needs backend endpoints + checkout flow)
- Sprint 5 requires Sprint 2 (spotlight endpoint) + Sprint 4 (merchant spotlight toggle)
- Sprint 6 requires BSaaS QR Plan Phase 3 (`PromoCodeQRDialog.tsx`, `qr-code-styling` package)
- Sprint 7 requires Sprint 2 (analytics service + routes) + Sprint 3 (redeem event tracking)
- Sprint 8 requires Sprint 4 (coupon CRUD for bot knowledge refresh triggers)

---

## Sprint 1: Database & Capability Registration

**Goal:** Create all database tables, register the `coupon_options` capability type with 14 feature keys, seed tier/BSaaS catalog entries, and add ID generators.

**Duration:** 3-4 days
**Priority:** P0 — Critical
**Blocks:** All subsequent sprints

### Tasks

#### 1.1 — Migration: `118_tenant_coupons.sql`

**File**: `database/migrations/118_tenant_coupons.sql`

**Tables to create:**

1. **`tenant_coupons`** — merchant coupon definitions
   - `id VARCHAR(255) PRIMARY KEY` — `cpn-{tk}-{nanoid}`
   - `tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id)`
   - `code VARCHAR(100) NOT NULL` — alphanumeric + hyphens, 3-50 chars
   - `discount_type VARCHAR(20) NOT NULL` — `percent_off` | `fixed_amount` | `free_shipping` | `bogo`
   - `discount_value INT NOT NULL` — percentage (1-100) or cents amount
   - `min_spend_cents INT DEFAULT 0`
   - `max_redemptions INT` — nullable = unlimited
   - `redemption_count INT DEFAULT 0`
   - `expires_at TIMESTAMPTZ` — nullable = no expiry
   - `is_active BOOLEAN DEFAULT true`
   - `target_type VARCHAR(50)` — nullable, see §3.3 targeting
   - `target_ids TEXT[]` — product/category IDs
   - `promotional_message TEXT` — merchant marketing copy for spotlight
   - `terms_summary VARCHAR(500)` — e.g. "Min order $50. Expires Aug 31."
   - `created_at TIMESTAMPTZ DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ DEFAULT NOW()`
   - `UNIQUE(tenant_id, code)`

2. **`coupon_redemptions`** — redemption log
   - `id VARCHAR(255) PRIMARY KEY` — `redm-{tk}-{nanoid}`
   - `tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id)`
   - `coupon_id VARCHAR(255) NOT NULL REFERENCES tenant_coupons(id)`
   - `order_id VARCHAR(255)` — FK to orders
   - `customer_email VARCHAR(255)`
   - `discount_cents INT NOT NULL`
   - `redeemed_at TIMESTAMPTZ DEFAULT NOW()`

3. **`coupon_events`** — raw event log (see §3.11)
   - `id VARCHAR(255) PRIMARY KEY` — `cpe-{tk}-{nanoid}`
   - `tenant_id VARCHAR(255) NOT NULL`
   - `coupon_id VARCHAR(255)` — nullable for invalid code attempts
   - `coupon_code VARCHAR(100)`
   - `event_type VARCHAR(20) NOT NULL` — view, copy, click, validate, redeem, fail
   - `surface VARCHAR(30)` — storefront, directory, product, checkout, spotlight, qr_code
   - `session_id VARCHAR(255)`
   - `order_id VARCHAR(255)`
   - `discount_cents BIGINT DEFAULT 0`
   - `source VARCHAR(100) DEFAULT 'coupon'`
   - `referrer TEXT`
   - `user_agent TEXT`
   - `geo_country VARCHAR(10)`
   - `geo_city VARCHAR(100)`
   - `device_type VARCHAR(20)`
   - `created_at TIMESTAMPTZ DEFAULT NOW()`

4. **`coupon_analytics`** — period rollups (see §3.11)
   - `id VARCHAR(255) PRIMARY KEY` — `cpa-{tk}-{nanoid}`
   - `tenant_id VARCHAR(255) NOT NULL`
   - `coupon_id VARCHAR(255)` — nullable for aggregate-all rows
   - `event_type VARCHAR(20) NOT NULL`
   - `surface VARCHAR(30)`
   - `period_start DATE NOT NULL`
   - `period_end DATE NOT NULL`
   - `period_type VARCHAR(10) DEFAULT 'day'`
   - `total_events INT DEFAULT 0`
   - `unique_visitors INT DEFAULT 0`
   - `unique_coupons INT DEFAULT 0`
   - `conversion_count INT DEFAULT 0`
   - `conversion_rate DECIMAL(8,4) DEFAULT 0`
   - `discount_cents BIGINT DEFAULT 0`
   - `revenue_cents BIGINT DEFAULT 0`
   - `avg_discount_per_redeem BIGINT DEFAULT 0`
   - `top_country VARCHAR(10)`
   - `top_city VARCHAR(100)`
   - `mobile_scans INT DEFAULT 0`
   - `desktop_scans INT DEFAULT 0`
   - `tablet_scans INT DEFAULT 0`
   - `created_at TIMESTAMPTZ DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ DEFAULT NOW()`
   - `UNIQUE(tenant_id, coupon_id, event_type, surface, period_start, period_type)`

**Indexes** (mirror `qr_scan_events` pattern):
- `idx_tenant_coupons_tenant_code` on `tenant_coupons(tenant_id, code)`
- `idx_tenant_coupons_active` on `tenant_coupons(tenant_id, is_active, expires_at)`
- `idx_coupon_redemptions_coupon` on `coupon_redemptions(coupon_id)`
- `idx_coupon_redemptions_tenant_time` on `coupon_redemptions(tenant_id, redeemed_at DESC)`
- `idx_coupon_events_tenant_time` on `coupon_events(tenant_id, created_at DESC)`
- `idx_coupon_events_tenant_event_time` on `coupon_events(tenant_id, event_type, created_at DESC)`
- `idx_coupon_events_coupon` on `coupon_events(coupon_id) WHERE coupon_id IS NOT NULL`
- `idx_coupon_events_surface` on `coupon_events(surface)`

**RLS**: Enable on all tables. Tenant-scoped SELECT/UPDATE/DELETE via `tenant_id` match. Public INSERT on `coupon_events` (storefront tracking from anonymous users).

**Triggers**: `updated_at` trigger on `tenant_coupons` and `coupon_analytics`.

#### 1.2 — Capability Seeds (in same migration)

**Seed `capability_type_list`**: `coupon_options`

**Seed `features_list`** — 14 feature keys:

| Feature Key | Type |
|---|---|
| `coupon_enabled` | Capability gate |
| `coupon_disabled` | Capability disable |
| `coupon_flexible` | Flexible key |
| `coupon_discount_types_on` | Group gate (on) |
| `coupon_discount_types_off` | Group gate (off) |
| `coupon_percent_off` | Individual |
| `coupon_fixed_amount` | Individual |
| `coupon_free_shipping` | Individual |
| `coupon_bogo` | Individual |
| `coupon_targeted` | Individual |
| `coupon_limited_redemption` | Individual |
| `coupon_analytics` | Individual |
| `coupon_qr_sharing` | Individual |
| `coupon_spotlight` | Individual |

**Seed `capability_features_list`**: Link all 14 features to `coupon_options` capability type.

**Seed `tier_features_list`**: Enable features for Professional+ tiers:
- Professional: `coupon_enabled`, `coupon_discount_types_on`, `coupon_percent_off`, `coupon_fixed_amount`, `coupon_free_shipping`, `coupon_limited_redemption`, `coupon_analytics`, `coupon_qr_sharing`, `coupon_spotlight`
- Enterprise: all above + `coupon_bogo`, `coupon_targeted`, `coupon_flexible`

**Seed `bsaas_catalog`** — 11 entries:

| Feature Key | Marketing Name | Price |
|---|---|---|
| `coupon_enabled` | Coupon Engine | $19/mo |
| `coupon_discount_types_on` | All Discount Types | $25/mo |
| `coupon_percent_off` | Percentage Discounts | $9/mo |
| `coupon_fixed_amount` | Fixed Amount Discounts | $9/mo |
| `coupon_free_shipping` | Free Shipping Coupons | $12/mo |
| `coupon_bogo` | BOGO Coupons | $15/mo |
| `coupon_targeted` | Product/Category Targeting | $15/mo |
| `coupon_limited_redemption` | Usage Limits & Expiry | $9/mo |
| `coupon_analytics` | Coupon Analytics | $12/mo |
| `coupon_qr_sharing` | QR Code Sharing | $12/mo |
| `coupon_spotlight` | Coupon Spotlight | $9/mo |

**Seed `navigation_links`**: INSERT coupon management sidebar link (database-driven nav).

#### 1.3 — Prisma Schema

- Run `db pull` to introspect new tables
- Add `TenantCoupon`, `CouponRedemption`, `CouponEvent`, `CouponAnalytics` models to `schema.prisma`
- Run `prisma generate`

#### 1.4 — ID Generators

**File**: `apps/api/src/lib/id-generator.ts`

Add 4 new generators:
- `generateCouponId(tenantId)` → `cpn-{tk}-{nanoid}`
- `generateRedemptionId(tenantId)` → `redm-{tk}-{nanoid}`
- `generateCouponEventId(tenantId)` → `cpe-{tk}-{nanoid}`
- `generateCouponAnalyticsId(tenantId)` → `cpa-{tk}-{nanoid}`

### Verification

- [ ] Migration applies cleanly: `psql -f 118_tenant_coupons.sql`
- [ ] All 4 tables exist with correct columns
- [ ] RLS enabled on all tables
- [ ] 14 feature keys in `features_list`
- [ ] 11 entries in `bsaas_catalog`
- [ ] `prisma generate` succeeds with 4 new models
- [ ] ID generators produce correctly prefixed IDs
- [ ] `checkapi` passes (zero TS errors)

---

## Sprint 2: Backend Services & Routes

**Goal:** Build `CouponService`, `CouponResolver`, `CouponAnalyticsService`, register all API routes, and wire the resolver into the capability pipeline.

**Duration:** 4-5 days
**Priority:** P0 — Critical
**Depends on:** Sprint 1

### Tasks

#### 2.1 — CouponResolver

**Files**:
- `apps/api/src/services/resolvers/CouponResolver.ts` (new)
- `apps/api/src/services/resolvers/types.ts` (modify)
- `apps/api/src/services/resolvers/index.ts` (modify)
- `apps/api/src/services/EffectiveCapabilityResolver.ts` (modify)

**Details**:
- `resolveCouponOptions()` — resolves capability state from tier features + merchant settings
- Include `flexible ||` prefix on all feature flag checks per R23
- Add `EffectiveCouponOptions` + `CouponOptionsMerchantSettings` to types
- Add `coupon_options` to `EffectiveCapabilities.effective`
- Add `couponOptions` to `MerchantSettingsBundle`
- Wire into both pipelines (primary + MV-based), `effective[26]` mapping
- Add to `isReadOnly` + `isLimited` blocks

#### 2.2 — CouponService

**File**: `apps/api/src/services/CouponService.ts` (new)

**Methods**:
- `createCoupon(tenantId, input)` — CRUD create with validation
- `updateCoupon(tenantId, couponId, input)` — CRUD update
- `deactivateCoupon(tenantId, couponId)` — soft delete (set `is_active = false`)
- `listCoupons(tenantId, filters?)` — paginated list with filters (active, expired, type)
- `validateCoupon(tenantId, code, cartData?)` — validates code, checks expiry, usage limits, min spend, targeting; returns `discount_cents` or throws
- `redeemCoupon(tenantId, couponId, orderId, customerEmail, discountCents)` — increments `redemption_count`, creates `coupon_redemptions` record
- `getSpotlightCoupon(tenantId)` — returns active featured coupon for public display (see §3.10)
- `getCouponAnalytics(tenantId, couponId)` — per-coupon stats summary

**Validation rules**:
- Code format: alphanumeric + hyphens, 3-50 chars, no spaces
- Discount value: 1-100 for percent, > 0 for fixed amount
- Max redemptions: positive integer or null
- Expiry: future date or null
- Target IDs: must reference existing products/categories

#### 2.3 — CouponAnalyticsService

**File**: `apps/api/src/services/CouponAnalyticsService.ts` (new)

Mirrors `QrAnalyticsService.ts` pattern (see §3.11):
- `trackCouponEvent(input)` — single event
- `trackCouponEvents(inputs)` — batch
- `aggregateCouponAnalyticsForTenant(tenantId, periodType)` — rollups
- `getCouponAnalyticsDashboard(tenantId, period, daysBack)` — dashboard
- `getCouponTimeSeries(tenantId, couponId, period, daysBack)` — time series
- `getCouponFunnelReport(tenantId, daysBack)` — conversion funnel
- `getCouponROIReport(tenantId, period, daysBack)` — ROI

#### 2.4 — API Routes

**Files**:
- `apps/api/src/routes/coupons.ts` (new) — tenant CRUD routes
- `apps/api/src/routes/public/coupons.ts` (new) — public validation + spotlight
- `apps/api/src/routes/coupon-analytics.ts` (new) — analytics routes

**Tenant routes** (auth required):
- `GET /api/tenants/:tenantId/coupons` — list coupons
- `POST /api/tenants/:tenantId/coupons` — create coupon
- `PUT /api/tenants/:tenantId/coupons/:id` — update coupon
- `DELETE /api/tenants/:tenantId/coupons/:id` — deactivate coupon
- `GET /api/tenants/:tenantId/coupons/:id/analytics` — per-coupon stats
- `GET /api/tenants/:tenantId/coupon-analytics` — analytics dashboard
- `GET /api/tenants/:tenantId/coupon-analytics/timeseries` — time series
- `GET /api/tenants/:tenantId/coupon-analytics/funnel` — funnel report
- `GET /api/tenants/:tenantId/coupon-analytics/roi` — ROI report
- `POST /api/tenants/:tenantId/coupon-analytics/aggregate` — manual aggregation

**Public routes** (no auth):
- `POST /api/public/tenants/:tenantId/coupons/validate` — checkout validation
- `GET /api/public/tenants/:tenantId/coupons/spotlight` — featured coupon for public surfaces
- `POST /api/public/coupon-events` — track single coupon event
- `POST /api/public/coupon-events/batch` — batch track coupon events

**Admin routes** (auth required):
- `GET /api/admin/coupon-analytics` — cross-tenant analytics

#### 2.5 — Route Registration & Wiring

**Files**:
- `apps/api/src/routes/routeRegistry.ts` (modify) — register all coupon routes
- `apps/api/src/routes/bsaas-purchases.ts` (modify) — add `coupon_options: 'coupon_enabled'` to `PARENT_GATE_FEATURES`
- `apps/api/src/routes/public-tenant-capabilities.ts` (modify) — add `coupon_options` to `buildExpiredCapabilitiesResponse()`
- `apps/api/src/index.ts` (modify) — mount coupon + coupon-analytics routes

#### 2.6 — Zod Validation Schemas

Add Zod schemas for all request bodies:
- Create/update coupon: code, discountType, discountValue, minSpend, maxRedemptions, expiresAt, targetType, targetIds, promotionalMessage, termsSummary
- Validate coupon: code, cartData (items, subtotal)
- Track event: tenantId, couponId, couponCode, eventType, surface, sessionId, etc.

#### 2.7 — Audit Logging

Add audit log entries for coupon CRUD operations (create, update, deactivate, redeem).

### Verification

- [ ] `CouponResolver` wired into both pipelines (primary + MV-based)
- [ ] `effective[26]` mapping returns `EffectiveCouponOptions`
- [ ] All tenant routes return correct data (test with curl/Postman)
- [ ] Public routes work without auth token
- [ ] `PARENT_GATE_FEATURES` includes `coupon_options`
- [ ] `routeRegistry.ts` registers all routes
- [ ] Zod validation rejects invalid input
- [ ] Audit logs created on CRUD
- [ ] `checkapi` passes (zero TS errors)

---

## Sprint 3: Checkout Integration

**Goal:** Integrate coupon validation into the checkout flow — validate before payment, apply discount to PaymentIntent, record redemption after success.

**Duration:** 2-3 days
**Priority:** P0 — Critical
**Depends on:** Sprint 2

### Tasks

#### 3.1 — Modify Checkout Flow

**File**: `apps/api/src/routes/checkout.ts` (modify)

**New checkout flow** (see §6.5):
1. Validate items & stock (existing)
2. Validate commerce capabilities (existing)
3. Calculate subtotal using sale_price (existing)
4. **NEW: Validate coupon** → get `discount_cents` → track `validate`/`fail` event
5. Calculate final total: `subtotal - discount + tax + shipping`
6. Create Stripe PaymentIntent for final total
7. Create order record with `discount_cents`
8. On payment success: record coupon redemption → track `redeem` event

**Implementation**:
- Accept `coupon_code` in checkout request body (optional field)
- If `coupon_code` present: call `CouponService.validateCoupon()` → get `discount_cents`
- Apply discount to order totals via existing `calculateOrderTotals()`
- Store `discount_cents` on `orders` record (field already exists)
- Store `coupon_code`, `coupon_id` in order metadata
- After successful payment: call `CouponService.redeemCoupon()`
- After redemption: call `CouponAnalyticsService.trackCouponEvent()` — `redeem` event with `order_id`, `discount_cents`, `surface: 'checkout'`
- On validation failure: call `CouponAnalyticsService.trackCouponEvent()` — `fail` event

#### 3.2 — Error Handling

- Invalid code → `400 coupon_invalid`
- Expired → `400 coupon_expired`
- Exhausted (max redemptions reached) → `400 coupon_exhausted`
- Min spend not met → `400 coupon_min_spend_not_met`
- Target mismatch → `400 coupon_target_mismatch`
- Capability disabled → `400 coupon_capability_disabled`

#### 3.3 — Stripe PaymentIntent Adjustment

- `PaymentIntent.amount = total_cents - discount_cents`
- Ensure discount is applied BEFORE PaymentIntent creation (not after)
- Edge case: `Math.max(0, total_cents - discount_cents)` — discount cannot make total negative

### Verification

- [ ] Checkout with valid coupon applies correct discount
- [ ] Checkout with expired coupon returns `400 coupon_expired`
- [ ] Checkout with exhausted coupon returns `400 coupon_exhausted`
- [ ] Stripe PaymentIntent amount reflects discount
- [ ] `coupon_redemptions` record created after successful payment
- [ ] `coupon_events` `redeem` event tracked
- [ ] `coupon_events` `fail` event tracked on validation failure
- [ ] Order metadata includes `coupon_code` + `coupon_id`
- [ ] `checkapi` passes (zero TS errors)

---

## Sprint 4: Frontend Merchant UI + Customer Checkout

**Goal:** Build the merchant coupon management page, capability hooks, settings integration, and customer-facing checkout coupon input.

**Duration:** 5-6 days (largest sprint — combines Phase 4 + Phase 5)
**Priority:** P0 — Critical
**Depends on:** Sprint 2 + Sprint 3

### Tasks

#### 4.1 — Frontend Services

**Files**:
- `apps/web/src/services/CouponService.ts` (new) — extends `TenantApiSingleton`: CRUD, analytics, spotlight toggle
- `apps/web/src/services/PublicCouponService.ts` (new) — extends `PublicApiSingleton`: validate, getSpotlightCoupon, trackEvent
- `apps/web/src/services/CouponAnalyticsService.ts` (new) — extends `TenantApiSingleton`: getDashboard, getTimeSeries, getFunnelReport, getROIReport, triggerAggregation

#### 4.2 — Capability Mapping & Hooks

**Files**:
- `apps/web/src/services/UnifiedCapabilityService.ts` (modify) — `mapCouponOptions()` mapper + `getCouponOptionsState()` method
- `apps/web/src/services/CapabilityResolutionService.ts` (modify) — `CouponOptionsState` interface + fallback resolver + add to `AllCapabilitiesState`
- `apps/web/src/types/effective-capabilities.ts` (modify) — re-export `CouponOptionsState`
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` (modify) — `useCouponCapability` hook
- `apps/web/src/services/TenantInfoService.ts` (modify) — `getCouponSettings()` + `updateCouponSettings()` methods
- `apps/web/src/services/PublicUnifiedCapabilityService.ts` (modify) — add coupon state to public capability mapping

#### 4.3 — Merchant Coupon Management Page

**Files**:
- `apps/web/src/app/t/[tenantId]/settings/coupons/page.tsx` (new) — server component
- `apps/web/src/app/t/[tenantId]/settings/coupons/CouponManagementClient.tsx` (new) — client component

**Features**:
- Coupon table: code, type, value, status (active/expired/exhausted), redemptions, actions
- Create/edit modal: code, type, value, min spend, max redemptions, expiry, targeting, promotional message, terms summary
- Deactivate button (soft delete)
- Spotlight toggle per coupon: "Feature on storefront" — visible only when `coupon_spotlight` enabled
- QR button per coupon: visible only when `coupon_qr_sharing` enabled (Sprint 6)
- Capability gating: hide entire page when `coupon_options.enabled === false`

#### 4.4 — Merchant Settings Integration

**Files**:
- `apps/web/src/components/settings/TenantSettings.tsx` (modify) — "Coupons & Promotions" settings card
- `apps/web/src/components/dashboard/CapabilityShowcase.tsx` (modify) — "Coupons" row
- `apps/web/src/components/dashboard/PlanSummaryWidget.tsx` (modify) — add entry to `CAPABILITY_META`
- `apps/web/src/components/dashboard/PlanSummaryPanel.tsx` (modify) — add entry to `CAPABILITY_DISPLAY` + summary block
- `apps/web/src/hooks/tenant-access/useNavLinks.tsx` (modify) — icon registration
- `apps/web/src/components/navigation/NavItemRow.tsx` (modify) — icon component
- Admin navigation `page.tsx` (modify) — `IconComponents` map

#### 4.5 — Merchant Settings Fields

Add to `CouponOptionsMerchantSettings`:
- `featuredCouponId: string | null` — references `tenant_coupons.id`
- `spotlightEnabled: boolean` — master toggle for spotlight display

#### 4.6 — Customer Checkout UI

**File**: Storefront checkout page (`/tenant/[id]` — cart/checkout component)

**Features**:
- Coupon code input field in cart/checkout page
- "Apply Coupon" button → calls `/api/public/tenants/:tenantId/coupons/validate` via `PublicCouponService`
- Discount line in order summary
- Error/success states (toast notifications)
- Hide coupon input when tenant doesn't have coupon capability (check via `PublicUnifiedCapabilityService`)
- **Storefront auto-fill from URL** — read `coupon` from `useSearchParams()`, pre-fill code, auto-validate
- Toast on auto-fill: "Coupon SUMMER20 applied — 20% off!"

### Verification

- [ ] Merchant can create, edit, deactivate coupons
- [ ] Coupon table shows correct status (active/expired/exhausted)
- [ ] Spotlight toggle appears only when `coupon_spotlight` enabled
- [ ] Capability gating hides coupon page when `coupon_options.enabled === false`
- [ ] `useCouponCapability` hook returns correct state
- [ ] Customer can enter coupon code at checkout and see discount
- [ ] Auto-fill from `?coupon=SUMMER20` URL param works
- [ ] Error toasts show for invalid/expired coupons
- [ ] `checkweb` passes (zero TS errors)

---

## Sprint 5: Coupon Spotlight — Public Surface Display

**Goal:** Build the single reusable `CouponSpotlight` component and integrate it into all 10 layout variants across storefront, directory, and product pages.

**Duration:** 3-4 days
**Priority:** P1 — High
**Depends on:** Sprint 2 (spotlight endpoint) + Sprint 4 (merchant spotlight toggle)

### Tasks

#### 5.1 — CouponSpotlight Component

**File**: `apps/web/src/components/storefront/CouponSpotlight.tsx` (new)

**Props**: `tenantId`, `coupon` (SpotlightCoupon | null), `variant` ('banner' | 'card' | 'strip'), `className`

**Features**:
- 3 rendering variants: `banner` (full-width gradient), `card` (bordered sidebar), `strip` (compact horizontal)
- Discount type icon (Lucide: `IconPercent`, `IconDollarSign`, `IconTruck`, `IconGift`)
- Promotional message display
- Discount terms summary
- Copy code button
- "Apply now" link to checkout with `?coupon={code}` URL param
- Expiry countdown (if `expiresAt` set)
- Auto-hide when coupon is expired or exhausted
- Event tracking: `view` on mount, `copy` on copy click, `click` on apply click
- Self-containment: reads from `coupon_options` domain state, not `StorefrontOptionFlags` overlay

#### 5.2 — Storefront Layout Integration (3 layouts)

| Layout | Variant | Position | File |
|---|---|---|---|
| Editorial | `banner` | Below hero section | `StorefrontEditorialLayout.tsx` |
| Immersive | `strip` | Below sticky search bar | `StorefrontImmersiveLayout.tsx` |
| Classic | `card` | Between header and product catalog | Classic storefront layout |

#### 5.3 — Directory Entry Layout Integration (4 layouts)

| Layout | Variant | Position | File |
|---|---|---|---|
| Editorial | `banner` | Below hero image | `DirectoryEntryEditorialLayout.tsx` |
| Immersive | `strip` | Below header | `DirectoryEntryImmersiveLayout.tsx` |
| Premium | `banner` | Below premium hero | `DirectoryEntryPremiumLayout.tsx` |
| Classic | `card` | Below business info | `DirectoryEntryClassicLayout.tsx` |

#### 5.4 — Product Page Layout Integration (3 layouts)

| Layout | Variant | Position | File |
|---|---|---|---|
| Classic | `strip` | Below product title | Classic product layout |
| Showcase | `card` | In sidebar | `ProductShowcaseLayout.tsx` |
| Quick-commerce | `strip` | Above add-to-cart | `ProductQuickCommerceLayout.tsx` |

#### 5.5 — Props Type Updates

**Files**:
- `apps/web/src/app/products/[id]/layouts/types.ts` (modify) — add `spotlightCoupon?` to `StorefrontLayoutProps` + `ProductLayoutProps`
- `apps/web/src/app/directory/[slug]/layouts/types.ts` (modify) — add `spotlightCoupon?` to `DirectoryEntryLayoutProps`
- `apps/web/src/services/PublicUnifiedCapabilityService.ts` (modify) — expose `coupon_spotlight` flag

### Verification

- [ ] Spotlight renders in all 3 storefront layouts
- [ ] Spotlight renders in all 4 directory entry layouts
- [ ] Spotlight renders in all 3 product page layouts
- [ ] Component renders nothing when `coupon_spotlight` disabled or no featured coupon
- [ ] Copy code button works
- [ ] "Apply now" link navigates to checkout with coupon code
- [ ] `view`, `copy`, `click` events tracked via `POST /api/public/coupon-events`
- [ ] Auto-hide works for expired/exhausted coupons
- [ ] `checkweb` passes (zero TS errors)

---

## Sprint 6: QR Code Sharing & Short-Code Routes

**Goal:** Enable styled QR code generation for coupon codes, build the short-code redirect route, and backfill tenant autoId metadata.

**Duration:** 3-4 days
**Priority:** P1 — High
**Depends on:** Sprint 4 (merchant UI) + BSaaS QR Plan Phase 3 (`PromoCodeQRDialog.tsx`, `qr-code-styling` package)

### Tasks

#### 6.1 — Coupon QR Backend

**Route**: `GET /api/tenants/:tenantId/coupons/:id/qr` — returns QR metadata (short-code URL, discount type icon, merchant logo)

#### 6.2 — Coupon QR Dialog

**File**: `apps/web/src/app/t/[tenantId]/settings/coupons/CouponQRDialog.tsx` (new)

- Reuses `PromoCodeQRDialog` shell pattern
- Uses `qr-engine.ts` (`generateQrInstance`, `QR_TEMPLATE_LIST`, `QrTemplateName`)
- URL selector: short-code URL (`/s/FRSH?c=SUMMER20`) as default, full storefront URL as fallback
- Theme selector: Merchant Promo, Flash Sale, Free Shipping, BOGO
- Download: PNG, SVG, Copy link

#### 6.3 — QR Engine Templates

**File**: `apps/web/src/lib/qr-engine.ts` (modify)

Add coupon-specific templates to `QrTemplateName` union + `QR_TEMPLATES` map:
- `merchant-promo`
- `coupon-flash`
- `coupon-free-ship`
- `coupon-bogo`

#### 6.4 — Discount-Type Icon Resolution

- `percent_off` → `IconPercent`
- `fixed_amount` → `IconDollarSign`
- `free_shipping` → `IconTruck`
- `bogo` → `IconGift`

Uses `lucide-static` approach from BSaaS QR plan Phase 3. Use `errorCorrectionLevel: 'H'` when icon embedded.

#### 6.5 — Short-Code Redirect Route

**File**: `apps/web/src/app/s/[autoId]/page.tsx` (new)

- Server component — reads `autoId` from route params + `c` from query string
- Calls `/api/public/shops/:identifier` to resolve tenant
- 302 redirect to `/tenant/{tenantId}?coupon={c}` (official modern storefront)
- Error handling: invalid autoId → 404 page
- Track `view` event with `surface: 'qr_code'` before redirect (see §3.11)

#### 6.6 — AutoId Metadata Backfill

**File**: `scripts/backfill_tenant_autoid.ts` (new)

- Iterates all tenants
- Computes `generateTenantKey(tenantId)` for each
- Persists into `tenants.metadata.autoId`
- Idempotent — skips tenants that already have `autoId` in metadata

#### 6.7 — QR URL Default

Coupon QR codes use short-code URL `https://visibleshelf.com/s/{autoId}?c={couponCode}` by default. Full storefront URL (`/tenant/{tenantId}?coupon={code}`) available as fallback in `CouponQRDialog.tsx` "Copy link" dropdown.

### Verification

- [ ] QR dialog generates scannable QR code with coupon code
- [ ] Short-code URL (`/s/FRSH?c=SUMMER20`) resolves and redirects to `/tenant/{id}?coupon=SUMMER20`
- [ ] Invalid autoId shows 404
- [ ] Backfill script populates `tenants.metadata.autoId` for all tenants
- [ ] QR code with embedded icon scans correctly (test with multiple readers)
- [ ] `view` event tracked on QR redirect
- [ ] `checkweb` + `checkapi` pass (zero TS errors)

---

## Sprint 7: Coupon Analytics & Event Tracking

**Goal:** Build the full analytics pipeline — event tracking, aggregation job, merchant dashboard with conversion funnel and ROI, admin cross-tenant view.

**Duration:** 3-4 days
**Priority:** P1 — High
**Depends on:** Sprint 2 (backend service + routes) + Sprint 3 (checkout redeem event tracking)

### Tasks

#### 7.1 — Backend Analytics Service

**File**: `apps/api/src/services/CouponAnalyticsService.ts` (new — may be partially built in Sprint 2)

Complete all methods:
- `trackCouponEvent(input)` — single event
- `trackCouponEvents(inputs)` — batch
- `aggregateCouponAnalyticsForTenant(tenantId, periodType)` — rollups from `coupon_events` → `coupon_analytics`
- `getCouponAnalyticsDashboard(tenantId, period, daysBack)` — per-coupon, per-surface, per-event-type
- `getCouponTimeSeries(tenantId, couponId, period, daysBack)` — time series for specific coupon
- `getCouponFunnelReport(tenantId, daysBack)` — view → copy → click → validate → redeem
- `getCouponROIReport(tenantId, period, daysBack)` — discount vs. revenue

#### 7.2 — Analytics Routes

**File**: `apps/api/src/routes/coupon-analytics.ts` (new — may be partially built in Sprint 2)

All routes from §3.11:
- Tenant: dashboard, timeseries, funnel, roi, aggregate (auth)
- Public: coupon-events single + batch (no auth)
- Admin: cross-tenant (auth)

#### 7.3 — Aggregation Sync Job

**File**: `apps/api/src/jobs/coupon-analytics-sync.ts` (new)

- Runs every 6 hours (staggered after QR sync at 18 min startup delay)
- Iterates all active tenants
- Aggregates `coupon_events` → `coupon_analytics` for day/week/month periods
- Computes per-coupon, per-surface, per-event-type rollups
- Wire into `index.ts` server startup alongside `qr-analytics-sync.ts` and `badge-analytics-sync.ts`

#### 7.4 — Event Tracking Integration

Wire up all event tracking points:

| Integration Point | Event Type | Sprint |
|---|---|---|
| `CouponSpotlight.tsx` | `view`, `copy`, `click` | Sprint 5 (already wired) |
| Checkout validation | `validate`, `fail` | Sprint 3 (already wired) |
| Checkout success | `redeem` | Sprint 3 (already wired) |
| QR redirect | `view` (surface: `qr_code`) | Sprint 6 (already wired) |

#### 7.5 — Frontend Analytics Service

**File**: `apps/web/src/services/CouponAnalyticsService.ts` (new — may be partially built in Sprint 4)

Singleton extending `TenantApiSingleton` with `getDashboard`, `getTimeSeries`, `getFunnelReport`, `getROIReport`, `triggerAggregation`, `formatCurrency`/`formatPercent`/`formatNumber` helpers.

#### 7.6 — Analytics Dashboard Page

**Files**:
- `apps/web/src/app/t/[tenantId]/settings/coupons/analytics/page.tsx` (new) — server component
- `apps/web/src/app/t/[tenantId]/settings/coupons/analytics/CouponAnalyticsClient.tsx` (new) — client component

**Features** (mirrors `QrAnalyticsClient.tsx`):
- Summary cards: total views, copy rate, redemption count, total discount given, revenue attributed
- Per-coupon performance table (sortable, clickable for time series drill-down)
- Conversion funnel visualization: view → copy → click → validate → redeem
- Revenue vs. discount bar chart (ROI)
- Period filter (day/week/month) + date range filter (7/14/30/60/90 days)
- Manual refresh button (triggers aggregation)
- Capability gating: visible only when `coupon_analytics` feature key enabled

#### 7.7 — Admin Analytics Page

**File**: `apps/web/src/app/(platform)/settings/admin/coupon-analytics/page.tsx` (new)

Cross-tenant coupon analytics (mirrors `/settings/admin/qr-analytics`).

### Verification

- [ ] `trackCouponEvent` inserts into `coupon_events` table
- [ ] `trackCouponEvents` batch insert works
- [ ] Aggregation job produces correct `coupon_analytics` rows
- [ ] Dashboard returns correct summary metrics
- [ ] Funnel report shows view → copy → click → validate → redeem counts
- [ ] ROI report shows discount vs. revenue
- [ ] Time series returns correct data points for a specific coupon
- [ ] Analytics page renders with all charts and filters
- [ ] Admin page shows cross-tenant data
- [ ] Sync job runs without errors
- [ ] `checkapi` + `checkweb` pass (zero TS errors)

---

## Sprint 8: Bot Knowledge & Polish (Optional)

**Goal:** Integrate coupon data into the bot knowledge system, add CCL constraints, and final polish.

**Duration:** 2-3 days
**Priority:** P2 — Medium
**Depends on:** Sprint 4

### Tasks

#### 8.1 — Bot Knowledge Integration

**Files**:
- `apps/api/src/services/BotKnowledgeEmbeddingService.ts` (modify) — `refreshCouponEmbeddings()`
- `apps/api/src/services/BotDynamicResponseService.ts` (modify) — coupon RAG search
- `apps/web/src/app/t/[tenantId]/settings/bot/BotKnowledgePage.tsx` (modify) — coupon embeddings card
- `apps/web/src/services/BotService.ts` (modify) — extend `refreshKnowledgeEmbeddings` sourceType union + status types

**Refresh triggers**: On coupon CRUD (create, update, deactivate), trigger embedding refresh.

#### 8.2 — CCL Integration

**File**: `apps/web/src/admin/capability-constraints.ts` (modify)

Add `coupon_options` entry to `CONSTRAINT_METADATA`:
- `coupon_free_shipping` **requires** `fulfillment_options.shipping_enabled`
- `coupon_bogo` **recommends** `product_options.product_variant_enabled`
- `coupon_targeted` **requires** inventory items to exist

#### 8.3 — Merchant Preferences

Settings page for merchant coupon preferences (toggle domain) — separate from coupon CRUD page.

### Verification

- [ ] Bot knowledge embeddings refresh on coupon CRUD
- [ ] Bot can answer "What coupons do I have?" via RAG search
- [ ] CCL constraints show in capability constraints admin page
- [ ] `checkapi` + `checkweb` pass (zero TS errors)

---

## Cross-Sprint Verification

### After Sprints 1-4 (Critical Path Complete)

- [ ] Merchant can create coupons with all discount types
- [ ] Customer can apply coupon at checkout and receive discount
- [ ] Stripe PaymentIntent reflects discounted amount
- [ ] Redemption count increments on successful order
- [ ] Expired/exhausted coupons rejected at checkout
- [ ] Capability gating hides coupon UI for tenants without `coupon_options`
- [ ] BSaaS purchase flow works (buy `coupon_enabled` → companion purchase)
- [ ] `checkapi` + `checkweb` pass

### After Sprint 5 (Spotlight Complete)

- [ ] Merchant can feature a coupon on public surfaces
- [ ] Spotlight renders in all 10 layout variants
- [ ] Spotlight auto-hides for expired/exhausted coupons
- [ ] Spotlight events tracked (view, copy, click)

### After Sprint 6 (QR Complete)

- [ ] Merchant can generate styled QR codes for coupons
- [ ] Short-code URL resolves and redirects to storefront
- [ ] QR codes are scannable with embedded discount-type icons

### After Sprint 7 (Analytics Complete)

- [ ] Merchant can view coupon analytics dashboard
- [ ] Conversion funnel shows full lifecycle
- [ ] ROI report shows discount vs. revenue
- [ ] Aggregation job runs every 6 hours
- [ ] Admin can view cross-tenant coupon analytics

### After Sprint 8 (Polish Complete)

- [ ] Bot can answer coupon-related questions
- [ ] CCL constraints enforced
- [ ] All sprints verified, feature is production-ready

---

## Architecture References

| Topic | Section in Analysis Doc |
|---|---|
| Capability registration & feature keys | §3.1 |
| Coupon CRUD & validation | §3.2-3.3 |
| Checkout integration | §3.4, §6.5 |
| QR code sharing | §3.8 |
| Short-code tenant resolution (autoId) | §3.9 |
| Coupon Spotlight (public surface) | §3.10 |
| Coupon Analytics & Event Tracking | §3.11 |
| BSaaS catalog & pricing | §4 |
| Design decisions (Stripe, stacking, CCL) | §6 |
| Risk assessment | §7 |
| Full file inventory | §8 |

**Full analysis document**: `docs/MERCHANT_COUPON_CAPABILITY_ANALYSIS.md`
