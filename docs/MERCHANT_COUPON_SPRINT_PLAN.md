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
| **Sprint 10** | Customer Wallet | 5-6 days | Customer coupon wallet: save coupons, browse by merchant, one-click checkout apply, expiry reminders, wallet insights | P1 — High |

**Total estimated duration:** 30-40 days (critical path: 14-18 days for Sprints 1-4)

---

## Dependency Graph

```
Sprint 1 (DB + Capability)
  ├──→ Sprint 2 (Backend Services)
  │      ├──→ Sprint 3 (Checkout Integration)
  │      │      └──→ Sprint 4 (Frontend Merchant + Customer UI)
  │      │             ├──→ Sprint 5 (Coupon Spotlight) [P1]
  │      │             ├──→ Sprint 6 (QR Sharing) [P1, also depends on BSaaS QR Plan Phase 3]
  │      │             ├──→ Sprint 7 (Analytics) [P1, also depends on Sprint 3]
  │      │             └──→ Sprint 10 (Customer Wallet) [P1, also depends on Sprint 2 + Sprint 3 + Sprint 6]
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
- Sprint 10 requires Sprint 2 (CouponService) + Sprint 3 (checkout integration) + Sprint 6 (QR short-code route for scan-to-save)

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

**Scan-to-Save variant** (requires Sprint 10): QR can include `&save=1` param → scanning auto-saves coupon to customer's wallet instead of just redirecting to storefront. `CouponQRDialog` offers a toggle: "Standard (visit store)" vs "Scan-to-Save (add to wallet)". See Sprint 10 task 10.19 for the short-code route auto-save flow.

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

### After Sprint 10 (Customer Wallet Complete)

- [ ] Customer can save coupons from any merchant to personal wallet
- [ ] Wallet page shows coupons grouped by merchant with status badges
- [ ] Checkout shows saved coupons as one-click apply options
- [ ] QR scan-to-save: scanning a coupon QR auto-saves to wallet
- [ ] Spotlight displays QR toggle for in-store scan-to-save
- [ ] Expiry reminders sent for coupons expiring within 24h/3d/7d (customer notification + merchant CRM alert)
- [ ] Merchant CRM dashboard shows coupon wallet expiry alerts as retargeting opportunities
- [ ] Merchant analytics shows wallet insights (saves, savers, save→redeem rate)
- [ ] `save` event integrated into conversion funnel (including `surface: 'qr_scan'`)
- [ ] Cross-merchant coupon discovery drives platform stickiness

---

## Sprint 9: Coupon-Funnel Convergence (Future)

**Goal:** Unify the two conversion mechanisms — coupons (future-purchase discounts) and sales funnels (inflight-purchase discounts) — by introducing a `coupon_offer` funnel step type, enabling coupon codes as upsell/downsell incentives within the funnel flow.

**Duration:** 3-4 days
**Priority:** P3 — Strategic
**Depends on:** Sprint 7 (analytics) + existing FunnelService

### Motivation

Coupons and funnels share the same goal — conversion — but target different purchase stages:

| Mechanism | Target | Capability | Data Model |
|-----------|--------|------------|------------|
| **Coupon** | Future purchases | `coupon_options` | `tenant_coupons` + `coupon_events` |
| **Funnel** | Inflight purchases | `funnel_options` | `tenant_funnels` + `tenant_funnel_steps` |

Convergence: a funnel step that applies a coupon code as an upsell/downsell incentive — "Accept this offer and get 20% off your next purchase with code SAVE20."

### Tasks

#### 9.1 — `coupon_offer` Funnel Step Type

**Files**:
- `apps/api/src/services/resolvers/types.ts` — add `'coupon_offer'` to `FunnelStepType` union
- `apps/api/src/services/resolvers/FunnelResolver.ts` — add `can_use_coupon_offer` flag
- `apps/api/src/services/FunnelService.ts` — validate `coupon_offer` steps (require `offer_item_id` = coupon ID, resolve coupon code for display)
- `apps/api/src/routes/funnel.ts` — accept `coupon_offer` in CRUD

#### 9.2 — Funnel-Coupon Linkage

**Files**:
- `apps/api/src/services/FunnelService.ts` — `FunnelStepInput.metadata.couponId` links step to coupon
- `apps/api/src/services/CouponAnalyticsService.ts` — track `redeem` events with `surface: 'funnel'` when coupon redeemed via funnel step
- `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx` — coupon step picker UI

#### 9.3 — Unified Conversion Analytics

**Files**:
- `apps/api/src/services/CouponAnalyticsService.ts` — add `surface: 'funnel'` to funnel report
- `apps/web/src/app/t/[tenantId]/settings/coupons/analytics/CouponAnalyticsClient.tsx` — show funnel-surface coupon performance
- `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/FunnelAnalyticsClient.tsx` — show coupon conversion within funnel

#### 9.4 — Capability Gating

- `coupon_offer` funnel step requires **both** `funnel_options` and `coupon_options` capabilities
- CCL constraint: `funnel.can_use_coupon_offer` **requires** `coupon_options.enabled`

### Verification

- [ ] Merchant can add a `coupon_offer` step to a funnel
- [ ] Coupon code is displayed to customer when they accept the funnel step
- [ ] Coupon redemption via funnel tracks `surface: 'funnel'` in analytics
- [ ] Unified analytics show coupon performance across both surfaces (storefront + funnel)
- [ ] Capability gating hides `coupon_offer` step type when either capability is disabled
- [ ] `checkapi` + `checkweb` pass (zero TS errors)

---

## Sprint 10: Customer Coupon Wallet — Cross-Merchant Coupon Saving & Redemption

**Goal:** Enable customers to save coupons from any platform merchant into a personal wallet, browse saved coupons organized by merchant, and apply saved coupons at checkout with one click — eliminating the pain point of remembering/clipboarding coupon codes. Extends the existing `coupon_options` capability with a customer-side engagement layer.

**Duration:** 5-6 days
**Priority:** P1 — High (conversion differentiator)
**Depends on:** Sprint 2 (CouponService + routes) + Sprint 3 (checkout integration) + Sprint 6 (QR short-code route, for scan-to-save flow)

### Motivation

The existing coupon system is **merchant-side only** — merchants create coupons, customers must manually remember and type codes at checkout. This sprint introduces a **customer-side coupon wallet** that:

- Eliminates coupon-code friction (no more "did I save that code?")
- Creates cross-merchant stickiness (customers return to the platform to use saved coupons)
- Provides merchants with **intent signals** (saved-but-not-redeemed = retargeting opportunity)
- Extends the coupon event funnel: `view → save → redeem` (save is a new high-intent event)

### Architecture Overview

```
Scenario 1 — Digital Save (storefront/directory)
  Customer browses storefront/directory
    → Sees CouponSpotlight or coupon card
    → Clicks "Save to Wallet" (auth required)
    → customer_saved_coupons record created
    → coupon_events 'save' event tracked (surface: spotlight | directory)

Scenario 2 — QR Scan-to-Save (in-store / offline)
  Merchant displays CouponSpotlight on screen or prints QR on receipt/table tent
    → Customer scans QR with phone camera
    → Short-code route /s/{autoId}?c={code}&save=1 resolves
    → If authenticated: coupon auto-saves to wallet
    → If not authenticated: redirect to login → auto-save post-login
    → coupon_events 'save' event tracked (surface: qr_scan)
    → Redirected to /account/coupons with success toast

Scenario 3 — Wallet Browse & Shop
  Customer visits /account/coupons (wallet page)
    → Sees saved coupons grouped by merchant
    → Filters: active / expiring / redeemed / expired
    → Clicks "Shop Now" → deep-link to merchant storefront
    → Cross-merchant discovery: sees coupons from other stores alongside

Scenario 4 — Checkout One-Click Redeem
  Customer checks out at any merchant store
    → Saved coupons for that tenant appear as one-click apply chips
    → Select coupon → auto-validate → discount applied
    → Redemption tracked → wallet status updated to 'redeemed'
    → coupon_events 'redeem' event tracked

Scenario 5 — Expiry Reminder Loop (dual-sided)
  Saved coupon approaching expiry
    → Daily reminder job detects coupon expiring in 24h / 3d / 7d
    → Customer notification sent (email + in-app) with coupon-specific details:
      - Merchant name + logo
      - Coupon code (e.g. "SUMMER20")
      - Discount summary (e.g. "20% off your next purchase")
      - Expiry countdown (e.g. "Expires in 24 hours")
      - Deep-link: /tenant/{tenantId}?coupon={code} (storefront with coupon pre-filled)
      - "Shop Now" CTA button → applies coupon at checkout
    → Merchant CRM alert fired (crm_alerts): "{N} customers saved coupon {code} expiring — retargeting opportunity"
    → Customer clicks notification → lands on merchant storefront with coupon code pre-filled
    → Merchant sees CRM alert on dashboard → can proactively engage or extend coupon
    → Converts before expiry → wallet status → 'redeemed'
    → CRM alert auto-dismissed on coupon redemption
```

### Tasks

#### 10.1 — Migration: `119_customer_saved_coupons.sql`

**File**: `database/migrations/119_customer_saved_coupons.sql`

**Tables to create:**

1. **`customer_saved_coupons`** — customer wallet entries
   - `id VARCHAR(255) PRIMARY KEY` — `scpn-{nanoid}`
   - `customer_id VARCHAR(255) NOT NULL REFERENCES customers(id)` — global customer (cross-tenant)
   - `tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id)` — merchant the coupon belongs to
   - `coupon_id VARCHAR(255) NOT NULL REFERENCES tenant_coupons(id)` — the saved coupon
   - `status VARCHAR(20) DEFAULT 'saved'` — `saved` | `redeemed` | `expired`
   - `reminder_enabled BOOLEAN DEFAULT true` — customer opt-in for expiry reminders
   - `saved_at TIMESTAMPTZ DEFAULT NOW()`
   - `redeemed_at TIMESTAMPTZ` — nullable, set when redemption occurs
   - `expired_at TIMESTAMPTZ` — nullable, set when coupon expires while in wallet
   - `UNIQUE(customer_id, coupon_id)` — one save per coupon per customer

2. **`customer_coupon_reminders`** — expiry reminder log (prevents duplicate notifications)
   - `id VARCHAR(255) PRIMARY KEY` — `crmd-{nanoid}`
   - `customer_id VARCHAR(255) NOT NULL`
   - `saved_coupon_id VARCHAR(255) NOT NULL REFERENCES customer_saved_coupons(id)`
   - `reminder_type VARCHAR(20)` — `24h` | `3d` | `7d`
   - `sent_at TIMESTAMPTZ DEFAULT NOW()`
   - `UNIQUE(saved_coupon_id, reminder_type)` — one reminder per type per saved coupon

**Indexes:**
- `idx_customer_saved_coupons_customer_status` on `customer_saved_coupons(customer_id, status)`
- `idx_customer_saved_coupons_customer_tenant` on `customer_saved_coupons(customer_id, tenant_id)`
- `idx_customer_saved_coupons_coupon` on `customer_saved_coupons(coupon_id)`
- `idx_customer_coupon_reminders_customer` on `customer_coupon_reminders(customer_id)`

**RLS**: Enable on both tables. Customer-scoped: `customer_id = auth.uid()::text` (customer JWT identity). No tenant RLS — customer wallet is global across merchants.

**Triggers**: `updated_at` not needed (immutable records, status updates via application layer).

**Event type seed**: Add `'save'` to the `coupon_events.event_type` allowed values (no schema change needed — `event_type` is `VARCHAR(20)`, just add `save` to the application-level enum in `CouponAnalyticsService`).

#### 10.2 — Prisma Schema Sync

- Run `npx prisma db pull` to introspect `customer_saved_coupons` + `customer_coupon_reminders`
- Add `CustomerSavedCoupon` + `CustomerCouponReminder` models to `schema.prisma`
- Add relations: `customers.customer_saved_coupons[]`, `tenant_coupons.customer_saved_coupons[]`
- Run `npx prisma generate`

#### 10.3 — ID Generators

**File**: `apps/api/src/lib/id-generator.ts`

Add 2 new generators:
- `generateSavedCouponId()` → `scpn-{nanoid}` (customer-scoped, not tenant-scoped — wallet is global)
- `generateCouponReminderId()` → `crmd-{nanoid}`

#### 10.4 — CustomerCouponWalletService (Backend)

**File**: `apps/api/src/services/CustomerCouponWalletService.ts` (new)

Singleton extending `BaseService`. Customer-authenticated (not tenant-authenticated).

**Methods:**

- `saveCoupon(customerId, tenantId, couponId)` — creates `customer_saved_coupons` record. Validates: coupon exists, is active, not expired, not exhausted. Idempotent (UNIQUE constraint). Tracks `save` event via `trackCouponEvent`.
- `unsaveCoupon(customerId, savedCouponId)` — removes from wallet (DELETE). Tracks `unsave` event.
- `listWallet(customerId, filters?)` — paginated list of saved coupons with coupon + tenant details joined. Filters: `status` (saved/redeemed/expired), `tenantId` (per-merchant view). Returns coupon code, discount type/value, merchant name/logo, expiry, status.
- `listWalletByTenant(customerId, tenantId)` — saved coupons for a specific merchant (used at checkout).
- `getWalletStats(customerId)` — summary: total saved, active, expiring soon (≤7d), redeemed count, total savings (sum of redeemed discounts).
- `markRedeemed(customerId, couponId, orderId)` — called from checkout flow after successful redemption. Updates `status='redeemed'`, sets `redeemed_at`.
- `syncExpiredStatuses()` — batch job: marks `status='expired'` for saved coupons where the underlying coupon has expired or been deactivated. Called by sync job.
- `getExpiringSoon(customerId, daysThreshold=7)` — saved coupons expiring within threshold, for reminder notifications.

**Event tracking**: Every `saveCoupon` call tracks a `save` event:
```ts
trackCouponEvent({
  tenantId,
  couponId,
  couponCode: coupon.code,
  eventType: 'save',
  surface: 'spotlight' | 'directory' | 'checkout' | 'wallet',
  sessionId,
  source: 'customer_wallet',
});
```

#### 10.5 — Customer Wallet API Routes

**File**: `apps/api/src/routes/customer-coupons.ts` (new)

**Authentication**: Customer JWT via `CustomerTokenService.extractBearerToken(req)` + `verifyAccessToken(token)`. Same pattern as `customer-auth.ts` routes.

**Routes:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/customer-coupons/save` | Customer | Save coupon to wallet |
| `DELETE` | `/api/customer-coupons/:savedCouponId` | Customer | Remove from wallet |
| `GET` | `/api/customer-coupons/wallet` | Customer | List all saved coupons (with filters) |
| `GET` | `/api/customer-coupons/wallet/by-tenant/:tenantId` | Customer | Saved coupons for a specific merchant |
| `GET` | `/api/customer-coupons/stats` | Customer | Wallet summary stats |
| `GET` | `/api/customer-coupons/expiring` | Customer | Coupons expiring soon |

**Public route** (no auth — for "save" button visibility check):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/public/tenants/:tenantId/coupons/saveable` | None | List active coupons a customer can save (for storefront/directory display) |

**Request bodies:**

```ts
// POST /save
{
  tenantId: string;
  couponId: string;
  surface?: 'spotlight' | 'directory' | 'checkout' | 'wallet';
  sessionId?: string;
}
```

**Zod validation** for all request bodies.

#### 10.6 — Route Registration

**File**: `apps/api/src/routes/routeRegistry.ts` (modify) — register `customer-coupons` routes
**File**: `apps/api/src/index.ts` (modify) — mount `customer-coupons` router at `/api/customer-coupons`

#### 10.7 — Checkout Integration: Saved Coupon Auto-Apply

**File**: `apps/api/src/routes/checkout.ts` (modify)

**New checkout flow addition** (after existing coupon validation step):

1. If customer is authenticated (customer JWT present in request):
   - Fetch `listWalletByTenant(customerId, tenantId)` — saved coupons for this merchant
   - Filter to `status='saved'` + coupon still active + not expired
   - Return saved coupons as `availableSavedCoupons` in checkout response payload
2. If customer selects a saved coupon at checkout:
   - Frontend sends `savedCouponId` instead of `couponCode`
   - Backend resolves coupon from `customer_saved_coupons` → auto-validates → applies discount
   - After successful payment: `markRedeemed(customerId, couponId, orderId)`
3. If customer enters a manual code AND has it saved:
   - Detect match → mark as redeemed in wallet after successful payment

**Response payload addition:**
```ts
{
  // ... existing checkout response
  availableSavedCoupons?: Array<{
    savedCouponId: string;
    couponId: string;
    code: string;
    discountType: string;
    discountValue: number;
    promotionalMessage: string | null;
    termsSummary: string | null;
    expiresAt: string | null;
  }>;
}
```

#### 10.8 — Expiry Reminder Job

**File**: `apps/api/src/jobs/coupon-wallet-expiry-reminders.ts` (new)

- Runs daily (staggered after existing jobs, e.g., 45 min startup delay)
- For each `customer_saved_coupons` record with `status='saved'` and `reminder_enabled=true`:
  - Check underlying coupon `expires_at`
  - If expiring within 24h / 3d / 7d and no reminder of that type sent:
    - Create `customer_coupon_reminders` record
    - Send **customer notification** via `CustomerNotificationService` (email + in-app)
    - Notification content (coupon-specific, not generic):
      - Merchant name + logo
      - Coupon code (e.g. "SUMMER20")
      - Discount summary (e.g. "20% off" / "$10 off" / "Free shipping")
      - Expiry countdown (e.g. "Expires in 24 hours")
      - Deep-link: `/tenant/{tenantId}?coupon={code}` (storefront with coupon pre-filled)
      - "Shop Now" CTA button → customer lands on merchant storefront with coupon ready to apply
    - Send **merchant CRM alert** via `CrmAlertService.getInstance().create()` (fire-and-forget)
      - `type: 'coupon_wallet'`
      - `title: 'Saved coupon expiring soon'`
      - `body: '{N} customers have saved coupon {code} expiring in {timeframe}. Retargeting opportunity.'`
      - `icon: 'clock'`
      - `metadata: { couponId, couponCode, saverCount, expiresAt, reminderType }`
    - Merchant CRM dashboard shows alert in `crm_alerts` feed (existing `CrmTenantService` dashboard widget)
- Wire into `index.ts` server startup

#### 10.9 — Expired Status Sync Job

**File**: `apps/api/src/jobs/coupon-wallet-status-sync.ts` (new)

- Runs daily
- Calls `CustomerCouponWalletService.syncExpiredStatuses()`
- Batch updates `customer_saved_coupons.status = 'expired'` where:
  - `status = 'saved'`
  - Underlying coupon `is_active = false` OR `expires_at < NOW()` OR `redemption_count >= max_redemptions`
- Wire into `index.ts` server startup

#### 10.10 — Frontend: CustomerCouponWalletService

**File**: `apps/web/src/services/CustomerCouponWalletService.ts` (new)

Singleton extending `CustomerApiSingleton`:

- `saveCoupon(tenantId, couponId, surface?)` → POST `/api/customer-coupons/save`
- `unsaveCoupon(savedCouponId)` → DELETE `/api/customer-coupons/:id`
- `getWallet(filters?)` → GET `/api/customer-coupons/wallet`
- `getWalletByTenant(tenantId)` → GET `/api/customer-coupons/wallet/by-tenant/:tenantId`
- `getStats()` → GET `/api/customer-coupons/stats`
- `getExpiringSoon()` → GET `/api/customer-coupons/expiring`
- `getSaveableCoupons(tenantId)` → GET `/api/public/tenants/:tenantId/coupons/saveable` (no auth)

**Types:**
```ts
export interface SavedCoupon {
  savedCouponId: string;
  couponId: string;
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  code: string;
  discountType: string;
  discountValue: number;
  promotionalMessage: string | null;
  termsSummary: string | null;
  expiresAt: string | null;
  status: 'saved' | 'redeemed' | 'expired';
  savedAt: string;
  redeemedAt: string | null;
}

export interface WalletStats {
  totalSaved: number;
  active: number;
  expiringSoon: number;
  redeemed: number;
  totalSavingsCents: number;
}
```

#### 10.11 — Frontend: Customer Wallet Page

**Files:**
- `apps/web/src/app/account/coupons/page.tsx` (new) — server component wrapper
- `apps/web/src/app/account/coupons/CouponWalletClient.tsx` (new) — client component

**Features:**

- **Wallet stats header**: Total saved, active, expiring soon, redeemed, total savings (mirrors account overview stat cards)
- **Filter tabs**: All | Active | Expiring Soon | Redeemed | Expired
- **Per-merchant grouping**: Coupons grouped by tenant with merchant name + logo header
- **Coupon cards**: Discount type icon, code (with copy button), discount value, promotional message, terms summary, expiry countdown, status badge
- **Actions per coupon**:
  - "Shop Now" → link to `/tenant/{tenantId}?coupon={code}` (deep-link to merchant storefront with coupon pre-filled)
  - "Remove" → unsave (with confirmation)
- **Empty state**: "No saved coupons yet — browse stores and save coupons for easy access at checkout"
- **Expiring soon banner**: Prominent warning for coupons expiring within 48h
- **Loading + error states**

#### 10.12 — Frontend: CustomerSidebar Nav Item

**File**: `apps/web/src/components/customer/CustomerSidebar.tsx` (modify)

Add "My Coupons" nav item:
```ts
{ href: '/account/coupons', label: 'My Coupons', icon: TicketIcon }
```

Position after "Orders" (high visibility for engagement).

#### 10.13 — Frontend: Account Overview Widget

**File**: `apps/web/src/app/account/page.tsx` (modify)

Add a "Saved Coupons" stat card to the quick stats grid:
- Icon: `TicketIcon` (or `Tags`)
- Count: total active saved coupons
- Link to `/account/coupons`

#### 10.14 — Frontend: Save-to-Wallet Button Component

**File**: `apps/web/src/components/coupons/SaveCouponButton.tsx` (new)

Reusable button component for storefront/directory surfaces:

**Props**: `tenantId`, `couponId`, `couponCode`, `variant` ('icon' | 'full'), `surface`

**Auth-state-aware behavior (3 states):**

| State | What customer sees | Action |
|-------|-------------------|--------|
| **Authenticated + not saved** | "Save to Wallet" button (bookmark icon) | Click → instant save (API call, no page navigation) → toast "Coupon {code} saved to your wallet" → button becomes "Saved ✓". **Customer stays on current page.** |
| **Authenticated + already saved** | "Saved ✓" (filled bookmark icon, green) | Click → unsave (with confirmation toast). **Customer stays on current page.** |
| **Not authenticated** | "Save" button (bookmark icon) | Click → redirect to `/customerlogin?redirect={currentPath}&saveCoupon={couponId}&saveTenantId={tenantId}&saveCode={couponCode}` |

**Authenticated save = zero navigation:**
- Save is a background API call (`POST /api/customer-coupons/save`) — no page reload, no redirect
- Optimistic UI: button flips to "Saved ✓" immediately, rolls back on API error
- Toast notification confirms save: "Coupon {code} saved to your wallet" with optional "View wallet" link
- Customer remains on the storefront/directory/product page they were browsing
- This is critical for conversion: redirecting away from a merchant's store to the wallet page breaks the shopping flow and may cause the customer to not return

**Unauthenticated save flow (post-login auto-save):**
1. Customer clicks "Save" on spotlight → redirected to login page with save params in URL
2. Login page shows contextual banner: "Sign in to save coupon {code} from {merchantName} to your wallet"
3. After successful login (or registration): `saveCoupon` param detected → auto-save executes → **redirect back to original page** (`redirect` param) with success toast "Coupon {code} saved to your wallet" — customer lands where they started, not on the wallet page
4. If customer registers new account: same auto-save executes post-registration → redirect back to original page
5. If customer abandons login: returns to original page, no save performed

**On save**: calls `customerCouponWalletService.saveCoupon()` (background API call), shows toast "Coupon {code} saved to your wallet" with optional "View wallet" link
**On unsave**: calls `unsaveCoupon()` (background API call), shows toast "Coupon removed from wallet"
**Optimistic UI**: immediate state change, rollback on error
**Variant `'icon'`**: bookmark-style icon button (for spotlight strips, compact cards)
**Variant `'full'`**: full button with text (for coupon detail views, wallet page)

#### 10.14a — Frontend: Spotlight Action Bar with Account Access

**File**: `apps/web/src/components/coupons/CouponSpotlightActionBar.tsx` (new)

The CouponSpotlight action bar is the primary engagement surface for coupons. It must serve both authenticated and unauthenticated customers with clear paths to action.

**Action bar layout (left → right):**

```
[Copy Code]  [Save to Wallet]  [QR Code]  [Sign In / Account]
```

**Components:**

1. **Copy Code** — existing button (Sprint 5), copies coupon code to clipboard. Available to all visitors (no auth required).
2. **Save to Wallet** (`SaveCouponButton`) — auth-state-aware (see task 10.14). Shows "Save" for all users; behavior changes based on auth state.
3. **QR Code** — inline QR toggle (see task 10.15). Available to all visitors (merchant can display, customer can scan).
4. **Account button** — auth-state-aware:
   - **Not authenticated**: "Sign In" link button → `/customerlogin?redirect={currentPath}` (subtle, secondary style — not aggressive, doesn't push login over coupon engagement)
   - **Authenticated**: user avatar / initials with dropdown → links to `/account`, `/account/coupons`, `/account/orders`, logout

**Why an account button on the spotlight action bar:**
- Customers encountering coupons from a merchant they haven't visited before may not have a platform account yet
- The "Save" button triggers login, but some customers want to browse first and sign in later — the account button provides a non-disruptive entry point
- After saving, authenticated customers can quickly jump to their wallet from the spotlight without navigating through the account menu
- The account button is **subtle** (secondary style, not primary CTA) — the primary action is "Save to Wallet", not "Sign In"

**Surfaces where the action bar appears:**
- Storefront CouponSpotlight (all 3 layout variants)
- Directory entry CouponSpotlight (all 4 layout variants)
- Product page CouponSpotlight (all 3 layout variants)
- Standalone coupon landing page (if QR redirect targets a dedicated coupon page instead of storefront)

#### 10.14b — Frontend: Coupon Wallet Mini-Widget (Engagement-Activated)

**File**: `apps/web/src/components/coupons/CouponWalletMiniWidget.tsx` (new)

A floating widget that materializes on the page **only after a customer saves their first coupon**. Completely invisible when wallet is empty or customer hasn't engaged. Appears next to the CouponSpotlight as a subtle visual confirmation + persistent wallet access point.

**Visibility rules:**

| State | Widget visibility |
|-------|------------------|
| **Not authenticated** | Invisible (no wallet to show) |
| **Authenticated + 0 saved coupons** | Invisible (nothing to show yet) |
| **Authenticated + 1+ saved coupons** | Visible — materializes with subtle animation |
| **Authenticated + just saved a coupon** | Visible + pulse animation (draws attention to the new save) |

**Widget appearance (when visible):**

```
┌─────────────────────────┐
│  🎫  3 Saved Coupons    │
│  1 expiring soon        │
│  View Wallet →          │
└─────────────────────────┘
```

- **Compact pill/card** — positioned adjacent to the CouponSpotlight component (not a full sidebar, not a modal)
- **Coupon count badge** — total active saved coupons (e.g. "3 Saved Coupons")
- **Expiry alert** — if any saved coupon expires within 7 days, shows "1 expiring soon" in amber/orange
- **"View Wallet →"** — link to `/account/coupons` (opens in same tab, or new tab if customer prefers)
- **Just-saved pulse** — when a customer saves a coupon from the spotlight, the widget slides in (if first save) or pulses (if already visible) with a brief "Coupon saved ✓" confirmation, then settles to its resting state

**Behavior:**
- **On first save (0 → 1)**: widget materializes with slide-in animation + pulse + "Coupon {code} saved" confirmation text (fades after 3s, widget remains visible)
- **On subsequent saves (N → N+1)**: count increments with brief pulse animation, no page navigation
- **On unsave (N → N-1)**: count decrements; if count reaches 0, widget fades out and becomes invisible again
- **On coupon expiry**: count stays same but status updates; if an active coupon expires, the "expiring soon" badge may appear or disappear
- **Persistent within session**: once visible, the widget stays on the page as the customer scrolls/browses — it's a persistent companion, not a transient toast
- **Non-blocking**: widget is positioned to not overlap critical content (floats near spotlight, respects z-index layering)

**Why this works for the non-disruptive save flow:**
- Customer saves a coupon from spotlight → stays on page (task 10.14) → widget materializes next to spotlight → visual confirmation without navigation
- Customer can continue browsing the merchant's store with the widget as a subtle reminder: "you have coupons saved, they're safe in your wallet"
- The widget is the **bridge between the spotlight engagement and the wallet page** — it confirms the save happened, shows running count, and provides a single-click path to the wallet when the customer is ready
- **Invisible by default** = zero clutter for new/unauthenticated visitors. The widget earns its presence through engagement.

**Props**: `customerId`, `tenantId` (optional — for per-merchant coupon count), `position` ('spotlight-adjacent' | 'floating')

**Data source**: `customerCouponWalletService.getStats()` — polled on mount + refreshed after each save/unsave action. Lightweight (single API call, cached for 60s).

#### 10.15 — Frontend: Save Button Integration Points

**Files to modify:**

1. **`CouponSpotlight.tsx`** (Sprint 5 component) — Add `SaveCouponButton` variant `'icon'` next to copy-code button. Also add inline QR code toggle: clicking the QR icon on the spotlight renders a scannable QR encoding the short-code URL with `&save=1` param (see task 10.19). Customer scans → coupon auto-saves to wallet. This is the **in-store QR scan-to-save** flow: merchant displays spotlight on a screen/tabletop display, customer scans QR → coupon lands in wallet → available at checkout across all platform merchants. Also render `CouponWalletMiniWidget` adjacent to the spotlight — invisible by default, materializes on first save.
2. **Storefront checkout coupon input** (Sprint 4) — Add saved coupons section above manual code input:
   - "Your Saved Coupons" horizontal scroll of coupon chips
   - Each chip: discount type icon + code + "Apply" button
   - One-click apply → validates → shows discount in order summary
   - If no saved coupons: collapse section, show manual input only
3. **Directory store cards** (`StoreCard.tsx`, `UnifiedStoreCard.tsx`) — Add `SaveCouponButton` to promoted coupon badge display

#### 10.19 — QR Scan-to-Save: Short-Code Route Wallet Auto-Save

**Files:**
- `apps/web/src/app/s/[autoId]/page.tsx` (modify — Sprint 6 short-code redirect) — detect `&save=1` query param
- `apps/api/src/routes/customer-coupons.ts` (modify) — add `POST /api/customer-coupons/save-by-code` endpoint (resolves coupon by tenant + code, then saves)
- `apps/web/src/app/s/[autoId]/SaveCouponRedirect.tsx` (new) — client component for auto-save redirect flow

**Flow:**

1. **Merchant generates QR** (Sprint 6 `CouponQRDialog`) with `save=1` flag → QR encodes `https://visibleshelf.com/s/{autoId}?c={code}&save=1`
2. **Customer scans QR** → short-code route resolves tenant → detects `save=1`
3. **If customer authenticated**: auto-save coupon to wallet → redirect to `/account/coupons?saved={couponId}` with success toast "Coupon {code} saved to your wallet"
4. **If customer not authenticated**: redirect to `/customerlogin?redirect=/s/{autoId}?c={code}&save=1&saveCoupon={couponId}` → after login, auto-save executes → redirect to wallet page
5. **If coupon already saved**: redirect to wallet with "Already in your wallet" message
6. **If coupon expired/exhausted**: redirect to storefront with "This coupon is no longer available" message

**Backend endpoint**: `POST /api/customer-coupons/save-by-code`
```ts
// Request
{
  tenantId: string;  // resolved from autoId
  couponCode: string; // from 'c' query param
  surface: 'qr_scan';
}
// Response
{
  success: boolean;
  savedCoupon?: SavedCoupon;
  alreadySaved?: boolean;
  error?: string;  // 'coupon_not_found' | 'coupon_expired' | 'coupon_exhausted'
}
```

**Why this is a platform differentiator**: No other e-commerce platform offers cross-merchant QR scan-to-wallet. Customers scan once at any participating merchant → coupon lives in their wallet → redeemable at checkout across all platform stores. This creates:
- **Offline-to-online bridge**: in-store displays, printed receipts, table tents → scan → save → shop online later
- **Cross-merchant discovery**: customer scans QR at Store A → sees Store A's coupon in wallet alongside coupons from Stores B, C, D → discovers new merchants
- **Zero-friction save**: no app install, no clipboard, no remembering codes — scan and it's there

### Verification (QR Scan-to-Save)

- [ ] QR with `&save=1` param triggers auto-save flow on scan
- [ ] Authenticated customer: coupon auto-saved, redirected to wallet with success toast
- [ ] Unauthenticated customer: redirected to login, then auto-save executes post-login
- [ ] Already-saved coupon: shows "Already in your wallet" message
- [ ] Expired coupon: shows "no longer available" message
- [ ] `save` event tracked with `surface: 'qr_scan'` in coupon events
- [ ] Spotlight QR toggle generates scannable QR with `save=1` param
- [ ] `checkapi` + `checkweb` pass

#### 10.16 — Frontend: Checkout Saved Coupons Panel

**File**: `apps/web/src/components/checkout/SavedCouponsPanel.tsx` (new)

**Props**: `tenantId`, `customerId`, `onApplyCoupon`, `selectedCouponId`

**Features:**
- Fetches `getWalletByTenant(tenantId)` on mount
- Shows horizontal scrollable list of active saved coupons
- Each coupon: discount icon, code, value, "Apply" button
- Selected coupon highlighted with checkmark
- "Use code instead" link → falls back to manual code input
- Empty state: "No saved coupons for this store — enter a code or browse available coupons"
- Integrates with existing checkout coupon flow (Sprint 4)

#### 10.17 — Analytics: Save Event in Funnel

**File**: `apps/api/src/services/CouponAnalyticsService.ts` (modify)

- Add `'save'` to `CouponEventType` union
- Update `getCouponFunnelReport()` — funnel now: `view → save → copy → click → validate → redeem`
- `save` event is the highest-intent pre-checkout signal (higher than view/copy)
- Merchant dashboard (Sprint 7) shows save count per coupon

#### 10.18 — Merchant Analytics: Wallet Insights

**File**: `apps/api/src/services/CouponAnalyticsService.ts` (modify)

New method: `getWalletInsights(tenantId, daysBack)`

Returns:
- `totalSaves` — how many customers saved this merchant's coupons
- `uniqueSavers` — distinct customers who saved
- `saveToRedeemRate` — % of saved coupons that were redeemed
- `savedButNotRedeemed` — high-intent retargeting list (count only, not PII)
- `avgTimeToRedeem` — avg hours between save and redeem
- `expiringInWallet` — saved coupons expiring within 7d (retargeting opportunity)

**Route**: `GET /api/tenants/:tenantId/coupon-analytics/wallet-insights` (auth + tenant admin)

**Frontend**: Add "Wallet Insights" tab to `CouponAnalyticsClient.tsx` (Sprint 7 dashboard)

### Verification

- [ ] `customer_saved_coupons` table created with RLS + indexes
- [ ] Customer can save a coupon from spotlight/storefront/directory
- [ ] Customer can view wallet at `/account/coupons` grouped by merchant
- [ ] Wallet stats show correct counts (saved, active, expiring, redeemed, savings)
- [ ] Customer can remove a coupon from wallet
- [ ] Checkout shows saved coupons for the current merchant as one-click apply options
- [ ] Selecting a saved coupon at checkout applies discount correctly
- [ ] After successful checkout with saved coupon, wallet status updates to `redeemed`
- [ ] Expiry reminder job sends customer notifications AND merchant CRM alerts for coupons expiring within 24h/3d/7d
- [ ] Merchant CRM dashboard shows coupon wallet expiry alerts in `crm_alerts` feed
- [ ] Expired status sync job marks wallet entries as `expired` when underlying coupon expires
- [ ] `save` event tracked in `coupon_events` and visible in analytics funnel
- [ ] Merchant analytics shows wallet insights (saves, savers, save→redeem rate)
- [ ] Authenticated customer saving a coupon stays on current page (no redirect to wallet)
- [ ] Save toast includes optional "View wallet" link for navigation without disrupting shopping flow
- [ ] Coupon Wallet Mini-Widget is invisible for unauthenticated users and authenticated users with 0 saved coupons
- [ ] Mini-Widget materializes with slide-in animation on first save (0 → 1)
- [ ] Mini-Widget shows correct coupon count + "expiring soon" badge
- [ ] Mini-Widget count increments/decrements on save/unsave without page navigation
- [ ] Mini-Widget fades out when last coupon is unsaved (count → 0)
- [ ] Mini-Widget does not overlap critical page content
- [ ] Unauthenticated customer clicking "Save" redirects to login with contextual banner + post-login auto-save + return to original page
- [ ] New customer registration triggers auto-save post-registration (no extra step)
- [ ] Spotlight action bar shows "Sign In" for unauthenticated users, avatar dropdown for authenticated
- [ ] Account button on spotlight action bar is subtle (secondary style), "Save to Wallet" is primary CTA
- [ ] CustomerSidebar shows "My Coupons" nav item
- [ ] Account overview shows saved coupons stat card
- [ ] `checkapi` + `checkweb` pass (zero TS errors)

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
