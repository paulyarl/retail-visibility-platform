# Directory Promotion — Sprint Plan

## Status: Draft
## Date: July 2026
## Source: `meaningful-badge-architecture.md` § Platform Visibility System Hierarchy

---

## Sprint Overview

The `/settings/promotion` page is a scaffold — DB columns exist (migration 078), API endpoints exist, and `DirectoryMap.tsx` already has promoted-marker rendering, but **no payment, no feature delivery, no lifecycle automation, and no integration with the platform's capability/badge/CRM systems**. This sprint plan brings it to full production parity with the Featured Store system.

| Sprint | Phase | Duration | Goal |
|--------|-------|----------|------|
| **Sprint 1** | Payment & Lifecycle | 2-3 days | Stripe checkout, auto-renewal, grace period, expiration enforcement — mirrors FeaturedPlacementService pattern |
| **Sprint 2** | Feature Delivery | 2-3 days | Wire promotion data into directory map, search ranking, directory listing card, carousel spot |
| **Sprint 3** | Capability & Tier Gating | 1-2 days | Register `directory_promotion` capability, tier-gate which promotion tiers are available per plan |
| **Sprint 4** | Badge & Featured Type Integration | 1-2 days | Promotion as a `featured_type_registry` entry, badge assignment on activation, badge analytics tracking |
| **Sprint 5** | CRM Alerts & Notifications | 1-2 days | BillingNotificationService types, CRM alert payloads, admin dashboard widget |
| **Sprint 6** | Admin & Analytics | 1-2 days | Admin management UI, promotion analytics dashboard, impression/click enrichment |

**Total estimated duration:** 8-14 days

---

## Sprint 1: Payment & Lifecycle

**Goal:** Replace the free enable/disable with a full Stripe checkout → activation → renewal → expiration lifecycle, mirroring `FeaturedPlacementService`.

### Tasks

#### 1.1 — Promotion Catalog Table

- **File**: `database/migrations/080_promotion_catalog.sql`
- **Table**: `promotion_catalog` — admin-managed promotion plans
  - `id VARCHAR(255) PRIMARY KEY`
  - `plan_key VARCHAR(100) UNIQUE` — e.g. `dir-promo-basic-30d`
  - `label VARCHAR(200)` — e.g. "Basic Promotion — 30 Days"
  - `tier VARCHAR(50)` — `basic` | `premium` | `featured`
  - `duration_days INT NOT NULL`
  - `price_cents INT NOT NULL`
  - `currency VARCHAR(3) DEFAULT 'USD'`
  - `is_active BOOLEAN DEFAULT true`
  - `sort_order INT DEFAULT 0`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `updated_at TIMESTAMPTZ DEFAULT now()`
- **Seed**: 9 plans (3 tiers × 3 durations: 30/90/365 days)
  - Basic: $20/mo, Premium: $50/mo, Featured: $100/mo
- **RLS**: Admin-only write, public read for active plans
- **Prisma**: Add `promotion_catalog` model to `schema.prisma`

#### 1.2 — Promotion Purchases Table

- **File**: `database/migrations/080_promotion_catalog.sql` (same migration)
- **Table**: `promotion_purchases`
  - `id VARCHAR(255) PRIMARY KEY` — `prom-{tk}-{nanoid}` via `generatePromotionPurchaseId`
  - `tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id)`
  - `plan_key VARCHAR(100) NOT NULL REFERENCES promotion_catalog(plan_key)`
  - `tier VARCHAR(50) NOT NULL`
  - `price_cents INT NOT NULL`
  - `currency VARCHAR(3) DEFAULT 'USD'`
  - `duration_days INT NOT NULL`
  - `status VARCHAR(20) DEFAULT 'pending'` — `pending` | `active` | `expired` | `cancelled` | `grace_period`
  - `stripe_checkout_session_id VARCHAR(255)`
  - `stripe_payment_intent_id VARCHAR(255)`
  - `starts_at TIMESTAMPTZ`
  - `expires_at TIMESTAMPTZ`
  - `grace_period_ends_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `updated_at TIMESTAMPTZ DEFAULT now()`
- **Indexes**: `(tenant_id, status)`, `(status, expires_at)` for renewal job
- **RLS**: Tenant-scoped read, admin read-all
- **Prisma**: Add `promotion_purchases` model

#### 1.3 — ID Generator

- **File**: `apps/api/src/lib/id-generator.ts`
- **Add**: `generatePromotionPurchaseId(tenantKey: string)` → `prom-{tk}-{nanoid}`
- **Add**: `generatePromotionCatalogId()` → `promcat-{nanoid}`

#### 1.4 — DirectoryPromotionService (Backend)

- **File**: `apps/api/src/services/DirectoryPromotionService.ts` (NEW)
- **Pattern**: Mirror `FeaturedPlacementService.ts` — singleton, Stripe integration
- **Methods**:
  - `listCatalogPlans(includeInactive?)` — fetch from `promotion_catalog`
  - `createPurchase({ tenantId, planKey, successUrl, cancelUrl })` — validate plan, create pending purchase, create Stripe checkout session, return checkout URL
  - `activatePurchase(purchaseId, stripeSessionId)` — called from Stripe webhook, set status=active, set starts_at/expires_at, update `directory_listings_list` promotion columns, fire billing notification, fire CRM alert
  - `deactivatePurchase(purchaseId)` — set status=expired, clear `directory_listings_list` promotion columns, fire expiration notification
  - `getActivePurchase(tenantId)` — current active promotion for tenant
  - `getPurchaseHistory(tenantId)` — all purchases for tenant
  - `renewPurchase(purchaseId)` — Stripe off-session payment, create new purchase, expire old, update listing
  - `enterGracePeriod(purchaseId)` — extend expires_at by 7 days, set status=grace_period, fire warning notification
- **Stripe webhook**: Add `directory_promotion` to metadata type field in Stripe webhook handler, call `activatePurchase` on `checkout.session.completed`

#### 1.5 — Rewrite Promotion Routes

- **File**: `apps/api/src/routes/promotion.ts` (rewrite)
- **Replace** direct SQL with `DirectoryPromotionService` calls
- **Endpoints**:
  - `GET /api/tenants/:tenantId/promotion/status` — read from service + `directory_listings_list`
  - `GET /api/tenants/:tenantId/promotion/plans` — list active catalog plans
  - `POST /api/tenants/:tenantId/promotion/purchase` — create checkout session → return URL
  - `POST /api/tenants/:tenantId/promotion/cancel` — cancel active promotion (stop renewal, let it expire)
  - `GET /api/tenants/:tenantId/promotion/history` — purchase history
  - `POST /api/tenants/:tenantId/promotion/track-impression` — keep as-is
  - `POST /api/tenants/:tenantId/promotion/track-click` — keep as-is
  - `GET /api/admin/promotion/catalog` — admin CRUD for catalog plans
  - `POST /api/admin/promotion/catalog` — create plan
  - `PUT /api/admin/promotion/catalog/:planKey` — update plan
  - `DELETE /api/admin/promotion/catalog/:planKey` — deactivate plan

#### 1.6 — Auto-Renewal Job

- **File**: `apps/api/src/jobs/promotion-renewal.ts` (NEW)
- **Pattern**: Mirror `featured-placement-renewal.ts`
- **Schedule**: Daily
- **Logic**:
  1. Find all `promotion_purchases` where `status = 'active'` AND `expires_at <= NOW() + 24h`
  2. Attempt Stripe off-session payment for renewal
  3. On success: create new purchase, expire old, update `directory_listings_list`, fire renewal_success notification
  4. On failure: enter 7-day grace period, fire grace_period_warning notification
  5. After grace period: mark expired, clear `directory_listings_list` promotion columns, fire expired notification
  6. Clean up stale pending purchases older than 24h
- **Wire**: Add to server startup in `index.ts`

#### 1.7 — Rewrite Frontend Promotion Page

- **File**: `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx` (rewrite)
- **Changes**:
  - Fetch plans from `GET /api/tenants/:tenantId/promotion/plans`
  - On "Enable" → call `POST /api/tenants/:tenantId/promotion/purchase` → redirect to Stripe checkout URL
  - Show active promotion status with expiration date, analytics summary
  - "Cancel Renewal" button (lets current period expire)
  - Remove hardcoded `PROMOTION_TIERS` array — use API-driven plans
  - Show purchase history

#### 1.8 — Frontend Service

- **File**: `apps/web/src/services/DirectoryPromotionService.ts` (NEW)
- **Pattern**: Extend `TenantApiSingleton`
- **Methods**: `getPlans`, `getStatus`, `createPurchase`, `cancelPromotion`, `getHistory`

#### 1.9 — Verification

- `pnpm checkapi` — zero TS errors
- `pnpm checkweb` — zero TS errors
- Manual: Purchase flow redirects to Stripe, webhook activates promotion, status endpoint reflects active state

---

## Sprint 2: Feature Delivery

**Goal:** Wire promotion data into directory rendering surfaces so promoted stores actually look different.

### Tasks

#### 2.1 — Enrich Directory Map API

- **File**: `apps/api/src/routes/directory-map.ts`
- **Change**: Add `dll.is_promoted`, `dll.promotion_tier`, `dll.promotion_expires_at` to the SELECT query (line 92-122)
- **Output**: Return `isPromoted` (boolean), `promotionTier` (string|null), `promotionExpiresAt` (date|null) in each listing object
- **Filter**: Only return `isPromoted = true` if `promotion_expires_at > NOW()` (don't expose expired promotions)

#### 2.2 — Enrich Directory Listing API

- **File**: `apps/api/src/routes/directory.ts` (and/or `directory-v2.ts`, `directory-optimized.ts`)
- **Change**: JOIN `directory_listings_list` and select promotion columns in listing detail/list endpoints
- **Purpose**: Directory listing cards can show "Promoted" badge and tier-based styling

#### 2.3 — Enrich Shop Service

- **File**: `apps/api/src/services/ShopService.ts`
- **Change**: Add promotion fields to shop detail queries (lines 546-550, 686-770)
- **Purpose**: Shop pages can display promoted status

#### 2.4 — Directory Search Ranking

- **File**: `apps/api/src/services/store-type-directory.service.ts` (or relevant search service)
- **Change**: Add `ORDER BY` clause that boosts promoted listings:
  ```sql
  ORDER BY 
    CASE WHEN dll.is_promoted AND dll.promotion_expires_at > NOW() 
         THEN CASE dll.promotion_tier 
              WHEN 'featured' THEN 0 
              WHEN 'premium' THEN 1 
              WHEN 'basic' THEN 2 
              ELSE 3 END 
         ELSE 3 END,
    -- existing sort criteria
  ```
- **Purpose**: Promoted stores appear higher in directory search results

#### 2.5 — Directory Map Marker (Already Partially Done)

- **File**: `apps/web/src/components/directory/DirectoryMap.tsx`
- **Status**: Already has promoted marker rendering (lines 166-178, 340-344)
- **Change**: Verify `listing.isPromoted` and `listing.promotionTier` are consumed correctly from the enriched API response (Sprint 2.1)
- **Google Maps variant**: `DirectoryMapGoogle.tsx` — add promoted marker styling (gold pin, larger size, star badge) matching the Leaflet variant

#### 2.6 — Directory Listing Card — Promoted Badge

- **File**: Directory listing card component(s) in `apps/web/src/components/directory/`
- **Change**: Show "Promoted" badge on listing cards when `isPromoted === true`
- **Styling**: Tier-dependent — Basic (amber border), Premium (amber border + "Promoted" badge), Featured (gold gradient + "Featured" badge + larger card)

#### 2.7 — Homepage Carousel Spot

- **File**: Directory homepage component (if applicable)
- **Change**: Add a "Promoted Stores" carousel section that fetches stores with `is_promoted = true` AND `promotion_tier IN ('premium', 'featured')` AND `promotion_expires_at > NOW()`
- **Purpose**: Deliver the "Homepage carousel spot" feature promised in the tier cards

#### 2.8 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors
- Manual: Promoted store shows gold marker on map, appears higher in search, has promoted badge on card

---

## Sprint 3: Capability & Tier Gating

**Goal:** Register `directory_promotion` as a platform capability, tier-gate which promotion tiers are available per tenant plan.

### Tasks

#### 3.1 — Register Capability

- **File**: `docs/feature-flags/registry.yaml` — add `directory_promotion` capability
- **File**: `apps/api/src/services/capabilities/` — add `directory_promotion` to capability resolver
- **Capability key**: `directory_promotion`
- **Tiers**:
  - `trial` — no access (upgrade prompt)
  - `starter` — basic tier only
  - `growth` — basic + premium tiers
  - `scale` / `enterprise` — all tiers (basic + premium + featured)
- **Purpose**: Tenants on lower plans can only purchase lower promotion tiers; higher tiers show an upgrade prompt

#### 3.2 — Backend Tier Gate

- **File**: `apps/api/src/services/DirectoryPromotionService.ts`
- **Change**: In `createPurchase()`, check tenant's effective capabilities for `directory_promotion`. Validate that the requested `tier` is allowed by the tenant's plan. Return 403 `tier_not_available` if gated.
- **Pattern**: Mirror how `featured_custom_badge_slots` gates custom badge access

#### 3.3 — Frontend Tier Gate

- **File**: `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx`
- **Change**: Use `useCapabilityAccess('directory_promotion')` to determine available tiers. Disable/grey-out tiers not available in the current plan with an "Upgrade to {plan}" CTA.
- **Pattern**: Mirror `StorefrontTypeOptionsSettingsClient.tsx` constraint-disabled UI

#### 3.4 — Capability Showcase Integration

- **File**: `apps/web/src/components/settings/CapabilityShowcase.tsx`
- **Change**: Add `directory_promotion` to the showcase with tier availability matrix

#### 3.5 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors
- Manual: Trial tenant cannot purchase, starter tenant sees only basic tier, scale tenant sees all tiers

---

## Sprint 4: Badge & Featured Type Integration

**Goal:** Treat directory promotion as a `featured_type_registry` entry so it flows through the badge system — badge assignment on activation, badge removal on expiration, analytics tracking.

### Tasks

#### 4.1 — Register Promotion as Featured Type

- **File**: `database/migrations/081_promotion_featured_type.sql`
- **Change**: INSERT into `featured_type_registry`:
  - System badge: `key = 'directory_promoted'`, `label = 'Directory Promoted'`, `group_type = 'platform'`, `is_system = true`, `is_active = true`, `is_promotional = true`, `promotional_priority = 200` (higher than `featured` at 100)
  - Sub-types via metadata: `promotion_tier` field distinguishes basic/premium/featured
- **Purpose**: Promotion appears in badge registry, can be assigned/removed like any badge

#### 4.2 — Badge Assignment on Activation

- **File**: `apps/api/src/services/DirectoryPromotionService.ts`
- **Change**: In `activatePurchase()`:
  1. After updating `directory_listings_list`, also write to `featured_products` with `featured_type = 'directory_promoted'`, `assignment_source = 'system'`, `featured_priority = promotional_priority from registry`
  2. In `deactivatePurchase()` / expiration: remove the `featured_products` entry
- **Purpose**: Promotion flows through the unified assignment table — discovery sorting, GMC feed, bot search, recommendations all pick it up automatically

#### 4.3 — Badge Analytics Tracking

- **File**: `apps/api/src/services/DirectoryPromotionService.ts`
- **Change**: In `trackImpression` / `trackClick` endpoints, also call `BadgeAnalyticsService.trackBadgeEvent()` with `badge_key = 'directory_promoted'`
- **Purpose**: Promotion performance appears in the badge analytics dashboard alongside other badges

#### 4.4 — Frontend Badge Display

- **File**: `apps/web/src/components/directory/` — listing card components
- **Change**: The "Promoted" badge on directory cards reads from the badge registry (via `useBadgeMeta('directory_promoted')`) instead of a hardcoded check
- **Purpose**: Consistent badge rendering, color, icon from the registry

#### 4.5 — Auto-Promotion Suggestion

- **File**: Badge suggestions page (`/settings/products/badges/suggestions`)
- **Change**: If a store has high directory impressions but no active promotion, surface a suggestion: "Your store is getting organic traffic — consider Directory Promotion to boost visibility"
- **Purpose**: Data-driven promotion upsell through the existing suggestions framework

#### 4.6 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors
- Manual: Activating promotion creates `featured_products` entry, badge appears on directory card, analytics dashboard shows `directory_promoted` badge metrics

---

## Sprint 5: CRM Alerts & Notifications

**Goal:** Fire billing notifications and CRM alerts for all promotion lifecycle events, surface promotions in the admin CRM.

### Tasks

#### 5.1 — Billing Notification Types

- **File**: `apps/api/src/services/subscription/BillingNotificationService.ts`
- **Add 5 notification types** (mirroring Featured Placement pattern):
  1. `directory_promotion_purchased` — email + CRM alert when promotion goes active
  2. `directory_promotion_renewal_success` — email + CRM alert on successful auto-renewal
  3. `directory_promotion_renewal_failed` — email + CRM alert on failed renewal
  4. `directory_promotion_grace_period_warning` — email + CRM alert when entering grace period
  5. `directory_promotion_expired` — email + CRM alert when promotion expires
- **Email templates**: HTML + text for each, including tier label, expiration date, and renewal price
- **CRM alert payloads**: `title`, `body`, `icon`, `severity` for each type

#### 5.2 — Fire Notifications from Service

- **File**: `apps/api/src/services/DirectoryPromotionService.ts`
- **Wire**:
  - `activatePurchase()` → fire `directory_promotion_purchased`
  - `renewPurchase()` success → fire `directory_promotion_renewal_success`
  - `renewPurchase()` failure → fire `directory_promotion_renewal_failed`
  - `enterGracePeriod()` → fire `directory_promotion_grace_period_warning`
  - `deactivatePurchase()` / expiration → fire `directory_promotion_expired`

#### 5.3 — CRM Admin Widget

- **File**: Admin CRM dashboard (`apps/web/src/app/(platform)/settings/admin/crm/`)
- **Change**: Add "Directory Promotions" widget to CRM dashboard showing:
  - Active promotions count + revenue
  - Recently activated (last 7 days)
  - Upcoming renewals (next 7 days)
  - Promotions in grace period
  - Recently expired
- **Purpose**: Platform staff have visibility into promotion lifecycle without a separate page

#### 5.4 — CRM Tenant Detail — Promotion Tab

- **File**: Admin CRM tenant detail page
- **Change**: Add "Promotion" tab showing:
  - Current promotion status (tier, start, expiration, impressions, clicks, CTR)
  - Purchase history
  - Renewal status
  - Admin actions: force-activate (complimentary), force-cancel, extend grace period

#### 5.5 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors
- Manual: Purchase fires email + CRM alert, renewal failure fires grace period warning, expiration fires expired notification

---

## Sprint 6: Admin & Analytics

**Goal:** Admin management UI for promotion catalog, tenant-facing analytics dashboard, impression/click enrichment.

### Tasks

#### 6.1 — Admin Catalog Management

- **File**: `apps/web/src/app/(platform)/settings/admin/promotion-catalog/` (NEW)
- **Page**: Admin CRUD for `promotion_catalog` — create/edit/deactivate plans
- **Features**: Plan table with tier, duration, price, active toggle, sort order
- **Service**: `AdminPromotionService.ts` extending `AuthenticatedApiSingleton`

#### 6.2 — Admin Revenue Dashboard

- **File**: `apps/web/src/app/(platform)/settings/admin/promotion-revenue/` (NEW)
- **Metrics**:
  - Total promotion revenue (all-time, MTD)
  - Revenue by tier (basic vs premium vs featured)
  - Active promotions count
  - Renewal rate
  - Grace period conversions
  - Churn rate (promotions not renewed)
- **Charts**: Revenue trend, tier distribution, renewal funnel

#### 6.3 — Tenant Analytics Dashboard

- **File**: `apps/web/src/app/t/[tenantId]/settings/promotion/analytics/` (NEW) or enhance existing page
- **Metrics**:
  - Impressions over time (from `promotion_impressions`)
  - Clicks over time (from `promotion_clicks`)
  - CTR trend
  - Days active vs remaining
  - Average daily impressions/clicks
  - Compare to pre-promotion baseline (if data available)
- **Purpose**: Merchant can see ROI of their promotion spend

#### 6.4 — Impression/Click Enrichment

- **File**: `apps/api/src/routes/promotion.ts` — track-impression / track-click endpoints
- **Change**: Also write to `badge_events` table (via `BadgeAnalyticsService.trackBadgeEvent`) with `badge_key = 'directory_promoted'`, `event_type = 'view'` / `'click'`
- **Purpose**: Promotion metrics flow through the unified badge analytics pipeline, appear in badge analytics dashboard

#### 6.5 — Bot Knowledge Integration

- **File**: `apps/api/src/services/BotKnowledgeEmbeddingService.ts`
- **Change**: Add `refreshPromotionEmbeddings()` — chunks active promotion tier + features into `bot_knowledge_embeddings` with `source_type = 'promotion'`
- **Dynamic response**: `BotDynamicResponseService` — when user asks "how do I get more visibility?", search promotion embeddings and suggest Directory Promotion
- **Refresh trigger**: Fire-and-forget on `activatePurchase` / `deactivatePurchase`

#### 6.6 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors
- Manual: Admin can create/edit catalog plans, tenant sees analytics dashboard, bot can answer promotion questions

---

## Architecture Decisions

### Mirror FeaturedPlacementService Pattern
- `DirectoryPromotionService` follows the same singleton + Stripe pattern as `FeaturedPlacementService`
- Separate `promotion_catalog` (admin-managed plans) + `promotion_purchases` (tenant purchases) tables
- Stripe checkout for initial purchase, Stripe off-session payment for renewals
- Grace period: 7 days, same as Featured Store

### Promotion as a Badge Type
- Directory promotion registers as `directory_promoted` in `featured_type_registry`
- Activation writes to `featured_products` with `assignment_source = 'system'`
- This automatically integrates with: discovery sorting, GMC feed, bot search, recommendations, badge analytics
- No separate analytics pipeline needed — badge analytics handles it

### Capability Gating
- `directory_promotion` capability registered in the platform capability system
- Tier availability gated by tenant plan (trial: none, starter: basic, growth: basic+premium, scale: all)
- Frontend shows upgrade CTA for gated tiers, same pattern as `StorefrontTypeOptionsSettingsClient`

### CRM Integration
- All 5 lifecycle events fire both email notifications and CRM alert payloads
- Admin CRM dashboard gets a promotion widget
- Tenant detail gets a promotion tab with admin override actions

### Data Flow
```
Merchant selects tier + duration
  → POST /api/tenants/:tenantId/promotion/purchase
  → DirectoryPromotionService.createPurchase()
  → Stripe checkout session created
  → Merchant pays in Stripe
  → Stripe webhook fires
  → DirectoryPromotionService.activatePurchase()
  → UPDATE directory_listings_list (is_promoted=true, promotion_tier, dates)
  → INSERT featured_products (featured_type='directory_promoted', assignment_source='system')
  → BillingNotificationService.fire('directory_promotion_purchased')
  → CRM alert created
  → BotKnowledgeEmbeddingService.refreshPromotionEmbeddings() (fire-and-forget)

Daily renewal job
  → Find purchases expiring < 24h
  → Stripe off-session payment
  → Success: new purchase, expire old, update listing, fire renewal_success
  → Failure: grace period, fire grace_period_warning
  → After grace: expire, clear listing, fire expired
```

## File Inventory

| File | Sprint | Action |
|------|--------|--------|
| `database/migrations/080_promotion_catalog.sql` | 1 | NEW — catalog + purchases tables |
| `database/migrations/081_promotion_featured_type.sql` | 4 | NEW — register badge type |
| `apps/api/prisma/schema.prisma` | 1, 4 | UPDATE — new models |
| `apps/api/src/lib/id-generator.ts` | 1 | UPDATE — promotion ID generators |
| `apps/api/src/services/DirectoryPromotionService.ts` | 1 | NEW — core service |
| `apps/api/src/routes/promotion.ts` | 1 | REWRITE — use service, add endpoints |
| `apps/api/src/jobs/promotion-renewal.ts` | 1 | NEW — daily renewal job |
| `apps/api/src/index.ts` | 1 | UPDATE — mount routes + job |
| `apps/api/src/routes/directory-map.ts` | 2 | UPDATE — add promotion columns |
| `apps/api/src/routes/directory.ts` | 2 | UPDATE — add promotion columns |
| `apps/api/src/services/ShopService.ts` | 2 | UPDATE — add promotion fields |
| `apps/api/src/services/store-type-directory.service.ts` | 2 | UPDATE — promoted search ranking |
| `apps/web/src/components/directory/DirectoryMapGoogle.tsx` | 2 | UPDATE — promoted marker styling |
| `apps/web/src/components/directory/` (listing cards) | 2 | UPDATE — promoted badge |
| `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx` | 1, 3 | REWRITE — Stripe checkout, tier gating |
| `apps/web/src/services/DirectoryPromotionService.ts` | 1 | NEW — frontend service |
| `apps/web/src/components/settings/CapabilityShowcase.tsx` | 3 | UPDATE — add directory_promotion |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | 5 | UPDATE — 5 new notification types |
| `apps/web/src/app/(platform)/settings/admin/crm/` | 5 | UPDATE — promotion widget + tab |
| `apps/web/src/app/(platform)/settings/admin/promotion-catalog/` | 6 | NEW — admin catalog CRUD |
| `apps/web/src/app/(platform)/settings/admin/promotion-revenue/` | 6 | NEW — admin revenue dashboard |
| `apps/web/src/app/t/[tenantId]/settings/promotion/analytics/` | 6 | NEW — tenant analytics |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | 6 | UPDATE — promotion embeddings |

## Related Documents

- `docs/FEATURED_VISIBILITY_SPRINT_PLAN.md` — Featured Store sprint (the pattern to mirror)
- `.devin/skills/meaningful-badge-architecture.md` — Platform Visibility System Hierarchy
- `.devin/skills/badge-architecture-insights.md` — Badge architecture patterns
- `.devin/skills/database-navigation-system.md` — Navigation link management
