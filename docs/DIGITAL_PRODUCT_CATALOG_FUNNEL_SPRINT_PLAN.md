# Digital Product Catalog & Sales Funnel — Analysis & Sprint Plan

## 1. Executive Summary

This document analyzes the platform's current digital product infrastructure and proposes a phased sprint plan to build a **Digital Product Catalog** and **Sales Funnel** system. The design mirrors the proven BSaaS Catalog pattern (features + bundles) but applies it to the merchant side: merchants get a catalog of their digital products and the ability to compose them into sales funnels (upsell, downsell, OTO, order bump) that activate during customer checkout.

### Core Concept

| BSaaS Catalog (Platform → Merchant) | Digital Product Catalog (Merchant → Customer) |
|---|---|
| Feature for sale | Digital product for sale |
| Bundle for sale (comprises features) | Funnel for sale (comprises digital product steps) |
| Admin manages catalog | Merchant manages catalog |
| Merchant purchases from Feature Store | Customer purchases from Storefront |
| Stripe checkout for features | Stripe checkout for products (existing) |

### Key Clarification

The funnel is a **merchant-side tool** that enhances the customer checkout flow. When a customer buys a digital product that's part of a funnel, the checkout flow presents sequential offers (upsell → downsell → OTO) with add-to-cart or skip options at each step. The funnel capability itself is a **purchasable feature** in the BSaaS Feature Store — merchants buy it to unlock funnel building for their storefront.

---

## 2. Current State Analysis

### 2.1 Digital Product Infrastructure (Already Built)

The platform already has substantial digital product support:

**Database Tables** (in `schema.prisma`):
- `digital_download_pages` — per-product download pages with access control, branding, SEO
- `digital_downloads` — asset management (files, links, license keys, access grants)
- `digital_access_grants` — per-purchase access tokens with download limits, expiry, revocation
- `download_access_logs` — audit trail of all download attempts

**Backend Services**:
- `DigitalAccessService` — createAccessGrant, validateAccess, recordDownload, revokeAccess, extendAccess, getAccessStats, cleanupExpiredGrants
- `DigitalFulfillmentService` — hasDigitalProducts, fulfillOrder, retryFulfillment
- `DigitalDownloadPageService` — CRUD for download pages, slug generation, publishing

**Routes**:
- `digital-downloads.ts` — download page routes
- `tenant/digital-download-pages.ts` — tenant management routes
- App router routes for download pages and customer-facing download access

**Inventory Items**:
- `product_type` field already supports `'digital'`, `'hybrid'`, `'physical'`, `'service'`
- `digital_delivery_method` field (`direct_download`, `license_key`)
- `access_duration_days`, `download_limit`, `digital_assets` JSONB field

**Tests**:
- `apps/api/src/tests/digital-products.test.ts` — E2E test scenarios covering product config, download pages, checkout integration, access grants, security, fulfillment

### 2.2 Storefront Type System

Storefront types (`online`, `retail`, `service`, `social`) are resolved via `StorefrontTypeResolver` and `StorefrontTypeService`. The `online` type is the natural home for digital products. The `social` type (TikTok/Instagram) is also relevant for digital product sales through social channels.

### 2.3 Product Type Capability System

`ProductTypeResolver` already handles `physical`, `digital`, `hybrid`, `service` types with tier-gated allowed types, merchant preferences, and effective type resolution. The capability pipeline (`EffectiveCapabilityResolver`) includes product types as step 5 in the 17-step resolver chain.

### 2.4 BSaaS Catalog Pattern (The Precedent)

The BSaaS Catalog demonstrates the exact architectural pattern to follow:

**Admin Side**:
- `bsaas_catalog` table — features with pricing, billing cycle, trial, active toggle
- `bsaas_bundles` + `bsaas_bundle_items` — bundles comprising features
- Admin CRUD routes with Zod validation, audit logging
- Admin frontend with tabbed UI (Features tab + Bundles tab)

**Tenant-Facing Side**:
- Feature catalog endpoint with tier eligibility checks
- Bundle catalog endpoint with component details
- Purchase endpoint with Stripe charge, companion purchases, notification
- Renewal job with grace periods, bundle grouping, cascade cancel

**Frontend**:
- Feature Store page with bundle cards above individual features
- Purchase confirmation modal with payment method picker
- Active purchases list with renewal/cancel

### 2.5 Checkout Flow (Existing)

The platform has a Stripe-based checkout flow:
- Cart service with add/remove items
- Stripe Checkout Sessions for payment
- Stripe webhooks for fulfillment (`stripe-webhooks.ts`)
- Order creation with `order_status` enum
- Digital fulfillment triggered post-payment

### 2.6 What Does NOT Exist (The Gap)

- **No funnel infrastructure** — no tables, services, routes, or UI for sales funnels
- **No upsell/downsell/OTO/order-bump** — no sequential offer presentation during checkout
- **No funnel builder UI** — merchants cannot compose funnels
- **No funnel analytics** — no conversion tracking per funnel step
- **No funnel capability registration** — no feature key in `features_list` or `bsaas_catalog`

---

## 3. Proposed Architecture

### 3.1 Two-Layer Design

**Layer 1: Digital Product Catalog** (merchant-managed)
- Merchants already create digital products via the inventory wizard with `product_type='digital'`
- A dedicated "Digital Products" view in the merchant dashboard surfaces only digital/hybrid items
- Digital product creation wizard step for funnel assignment (which funnel, if any)
- No new tables needed — uses existing `inventory_items` with `product_type` filter

**Layer 2: Sales Funnel System** (merchant-built, customer-facing)
- New `tenant_sales_funnels` table — funnel definition with steps
- New `tenant_funnel_steps` table — ordered steps with offer type, product, pricing
- New `FunnelService` backend service — CRUD, validation, checkout integration
- New `FunnelEngine` — runtime service that injects offers into checkout flow
- New `FunnelAnalyticsService` — conversion tracking per step

### 3.2 Funnel Capability (BSaaS Feature)

The funnel capability is registered as a purchasable feature in the BSaaS catalog:

| Field | Value |
|---|---|
| `feature_key` | `funnel_builder` |
| `capability_type` | `funnel_options` (new capability type) |
| `marketing_name` | Sales Funnel Builder |
| `description` | Create upsell, downsell, OTO, and order bump sequences to boost digital product revenue |
| `price_cents` | 4900 ($49/mo) |
| `billing_cycle` | monthly |
| `trial_days` | 14 |
| `trial_eligible` | true |

**Tier Feature Keys**:
- `funnel_builder` — master gate (purchasable in BSaaS catalog)
- `funnel_builder_flexible` — flexible toggle (all funnel types enabled)
- `funnel_upsell` — upsell step type
- `funnel_downsell` — downsell step type
- `funnel_oto` — one-time offer step type
- `funnel_order_bump` — order bump step type

**Cross-Capability Constraint**: `funnel_builder` requires `product_types_digital` (or `product_types_flexible`) to be enabled. A merchant can't build funnels for digital products if they can't sell digital products.

### 3.3 Funnel Step Types

| Step Type | Description | Trigger | Customer Experience |
|---|---|---|---|
| `order_bump` | Pre-purchase add-on on checkout page | Before payment | Checkbox on checkout page — "Add X for $Y?" |
| `upsell` | Post-purchase upgrade offer | After successful payment | Interstitial page — "Upgrade to X for $Y?" with Accept/Skip |
| `downsell` | Alternative offer after upsell decline | After upsell skip | Interstitial page — "How about X for $Z (discounted)?" with Accept/Skip |
| `oto` | One-time offer, time-limited | After upsell/downsell | Interstitial page with countdown timer — "One-time only: X for $Y" |

### 3.4 Database Schema

#### New Tables

**`tenant_sales_funnels`** — Funnel definitions
```sql
CREATE TABLE tenant_sales_funnels (
  id              VARCHAR(255) PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  entry_item_id   VARCHAR(255) NOT NULL,  -- the product that triggers this funnel
  is_active       BOOLEAN DEFAULT true,
  status          VARCHAR(50) DEFAULT 'draft',  -- draft, active, paused, archived
  total_steps     INT DEFAULT 0,
  analytics       JSONB DEFAULT '{}',  -- cached conversion metrics
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, entry_item_id)  -- one funnel per entry product
);
```

**`tenant_funnel_steps`** — Ordered steps within a funnel
```sql
CREATE TABLE tenant_funnel_steps (
  id              VARCHAR(255) PRIMARY KEY,
  funnel_id       VARCHAR(255) NOT NULL REFERENCES tenant_sales_funnels(id) ON DELETE CASCADE,
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step_number     INT NOT NULL,  -- 1-based ordering
  step_type       VARCHAR(50) NOT NULL,  -- order_bump, upsell, downsell, oto
  offer_item_id   VARCHAR(255) NOT NULL,  -- the product being offered
  offer_price_cents INT NOT NULL,  -- price for this offer (can differ from item price)
  original_price_cents INT,  -- for showing discount (downsell)
  headline        VARCHAR(500),
  description     TEXT,
  cta_accept_label VARCHAR(255) DEFAULT 'Add to Order',
  cta_skip_label   VARCHAR(255) DEFAULT 'No Thanks',
  countdown_seconds INT,  -- for OTO steps
  skip_to_step    INT,  -- which step to go to if skipped (for downsell branching)
  accept_to_step  INT,  -- which step to go to if accepted
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(funnel_id, step_number)
);
```

**`funnel_events`** — Analytics event log
```sql
CREATE TABLE funnel_events (
  id              VARCHAR(255) PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  funnel_id       VARCHAR(255) NOT NULL REFERENCES tenant_sales_funnels(id) ON DELETE CASCADE,
  step_id         VARCHAR(255) REFERENCES tenant_funnel_steps(id) ON DELETE SET NULL,
  order_id        VARCHAR(255),
  customer_email  VARCHAR(255),
  event_type      VARCHAR(50) NOT NULL,  -- view, accept, skip, timeout
  offer_price_cents INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### No Changes to Existing Tables
- `inventory_items` — already has `product_type`, `digital_delivery_method`, etc.
- `orders` / `order_items` — already support multiple items, can reference funnel step in metadata
- `digital_access_grants` — already handles per-purchase access
- `bsaas_catalog` — new `funnel_builder` entry added via seed/migration

### 3.5 Backend Architecture

#### New Services

**`FunnelService.ts`** (singleton)
- `createFunnel(tenantId, data)` — create funnel with steps
- `updateFunnel(tenantId, funnelId, data)` — update funnel + steps (atomic)
- `deleteFunnel(tenantId, funnelId)` — soft delete (archive)
- `getFunnel(tenantId, funnelId)` — with steps
- `listFunnels(tenantId)` — all funnels for tenant
- `getFunnelByEntryItem(tenantId, itemId)` — lookup funnel for a product
- `validateFunnelSteps(steps)` — ensure step ordering is valid (upsell→downsell chain, OTO terminal)
- `toggleFunnelActive(tenantId, funnelId, active)` — pause/resume

**`FunnelEngine.ts`** (runtime, singleton)
- `getCheckoutFunnel(tenantId, itemId)` — returns funnel steps for checkout flow
- `processOrderBump(tenantId, funnelId, orderId, accepted)` — record order bump decision
- `processUpsellStep(tenantId, funnelId, stepId, orderId, accepted)` — record upsell/downsell/OTO decision
- `addOfferToOrder(orderId, itemId, priceCents)` — add accepted offer to existing order
- `getFunnelAnalytics(tenantId, funnelId, dateRange)` — conversion rates per step

**`FunnelAnalyticsService.ts`** (singleton)
- `trackEvent(tenantId, funnelId, stepId, eventType, metadata)` — fire-and-forget event logging
- `getDashboard(tenantId, funnelId)` — summary cards (views, accepts, skips, revenue uplift)
- `getStepConversion(tenantId, stepId)` — per-step conversion rate
- `getTimeSeries(tenantId, funnelId, period)` — daily/weekly/monthly trends
- `aggregateAnalytics(tenantId)` — batch aggregation job

#### New Routes

**`funnel.ts`** (tenant-facing, mounted at `/api/tenants/:tenantId/funnels`)
- `GET /` — list funnels
- `GET /:funnelId` — get funnel with steps
- `POST /` — create funnel
- `PUT /:funnelId` — update funnel
- `DELETE /:funnelId` — archive funnel
- `POST /:funnelId/toggle` — activate/pause
- `GET /:funnelId/analytics` — funnel analytics dashboard
- `GET /:funnelId/analytics/steps` — per-step conversion

**`funnel-checkout.ts`** (customer-facing, mounted at `/api/public/funnels`)
- `GET /:tenantId/checkout/:itemId` — get funnel for checkout (public, no auth)
- `POST /:tenantId/checkout/:orderId/order-bump` — process order bump decision
- `POST /:tenantId/checkout/:orderId/step/:stepId` — process upsell/downsell/OTO decision

#### Checkout Flow Integration

The existing Stripe checkout flow is modified as follows:

1. **Customer adds digital product to cart** → normal flow
2. **Customer initiates checkout** → Stripe Checkout Session created as normal
3. **Order bump injection** → if entry product has a funnel with an `order_bump` step, the bump offer is rendered on the checkout page (via Stripe custom fields or a pre-checkout interstitial)
4. **Payment succeeds** → Stripe webhook fires → order created → digital fulfillment triggered
5. **Upsell sequence** → if funnel has `upsell` step, redirect to interstitial page
6. **Customer accepts upsell** → `FunnelEngine.addOfferToOrder()` → second Stripe charge (off-session) → fulfillment
7. **Customer skips upsell** → if `downsell` step exists, redirect to downsell interstitial
8. **Customer accepts downsell** → second Stripe charge at discounted price → fulfillment
9. **Customer skips downsell** → if `OTO` step exists, redirect to OTO with countdown
10. **OTO expires or skipped** → redirect to order confirmation / download page
11. **All accepted offers** → added to original order as `order_items` with `metadata.funnel_step_id`

#### Capability Resolver Integration

New resolver: `FunnelResolver.ts`
- Reads `funnel_builder` feature from tier features or tenant_feature_purchases
- Returns `EffectiveFunnel` state: `enabled`, `allowed_step_types[]`, `is_flexible`
- Added to `EffectiveCapabilityResolver` pipeline as step 18
- Frontend hook: `useFunnelCapability(tenantId)`

### 3.6 Frontend Architecture

#### Merchant-Facing Pages

**Funnel Builder** (`/t/[tenantId]/settings/funnels`)
- `page.tsx` — server component, capability-gated
- `FunnelListClient.tsx` — funnel table with create/edit/delete, active toggle, analytics link
- `FunnelBuilderClient.tsx` — visual funnel builder:
  - Entry product picker (searchable dropdown, digital products only by default)
  - Step builder with drag-and-drop ordering
  - Per-step config: type, offer product, price, headline, CTA labels, countdown (OTO)
  - Branching visualization (upsell → downsell → OTO chain)
  - Live preview of customer-facing interstitial
- `FunnelAnalyticsClient.tsx` — analytics dashboard:
  - Summary cards: total views, conversion rate, revenue uplift, AOV increase
  - Per-step funnel diagram with conversion rates
  - Revenue by step type (upsell vs downsell vs OTO vs order bump)
  - Time series chart

**Digital Product Catalog View** (`/t/[tenantId]/items?filter=digital`)
- Existing items page with filter applied
- Shows digital/hybrid products with funnel assignment badge
- Quick link to funnel builder from each digital product

**Feature Store Integration**
- "Sales Funnel Builder" card in the Feature Store page
- Shows tier eligibility, trial availability, purchase/trial buttons
- Uses existing BSaaS purchase flow (no new purchase infrastructure needed)

#### Customer-Facing Pages

**Order Bump Component** (in checkout page)
- Checkbox card on Stripe checkout or pre-checkout page
- "Add [Product Name] to your order for just $X" with product image
- Accepted → added to order before payment

**Upsell/Downsell/OTO Interstitial Pages**
- `/checkout/funnel/:orderId/step/:stepId`
- Full-screen offer page with:
  - Product image/video
  - Headline + description
  - Price (with original price strikethrough for downsell)
  - Countdown timer (OTO only)
  - Accept button (green, prominent)
  - Skip link (text, understated)
- Accepted → Stripe off-session charge → redirect to next step or confirmation
- Skipped → redirect to next step (downsell or OTO) or confirmation

### 3.7 Navigation & Settings Integration

- **DynamicTenantSidebar**: "Sales Funnels" link under a new "Sales & Marketing" group (or under "My Inventory")
- **TenantSettings**: "Sales Funnel Builder" card in the Products group
- **CapabilityShowcase**: "Sales Funnels" row with Filter icon, allowed step types, link to /settings/funnels
- **Admin Settings**: No admin page needed (funnel_builder is a standard BSaaS feature)

### 3.8 Renewal & Lifecycle

The funnel_builder feature follows the standard BSaaS renewal pattern:
- Purchased via Feature Store → `tenant_feature_purchases` record with `source='bsaas'`
- Renewed by `bsaas-renewal.ts` job (already handles `source: 'bsaas'`)
- Grace period on failed renewal (7 days)
- On expiry: funnels auto-paused (status set to `paused`), not deleted
- On re-purchase: funnels can be re-activated by merchant

### 3.9 Notifications

New `BillingNotificationType` entries:
- `funnel_builder_purchased` — welcome email + setup guide
- `funnel_builder_renewal_success` — standard renewal confirmation
- `funnel_builder_renewal_failed` — grace period warning
- `funnel_builder_expired` — funnels paused notification

### 3.10 Bot Knowledge Integration

- `BotKnowledgeEmbeddingService.refreshFunnelEmbeddings()` — chunks funnel definitions into embeddings with `source_type='funnel'`
- `BotDynamicResponseService` — when customer asks about products, bot can mention funnel offers
- Refresh trigger: funnel create/update/delete

---

## 4. Sprint Plan

### Sprint 1: Database & Backend Services (7-9 days)

**Goal**: Schema, services, routes, capability registration — backend complete.

**Tasks**:
1. **Migration `093_sales_funnels.sql`** — Create `tenant_sales_funnels`, `tenant_funnel_steps`, `funnel_events` tables with RLS, indexes, triggers
2. **Prisma schema** — Add 3 new models, run `prisma db pull && prisma generate`
3. **ID generators** — `generateFunnelId(tenantKey)`, `generateFunnelStepId(tenantKey)`, `generateFunnelEventId(tenantKey)` in `id-generator.ts`
4. **Capability registration** — Add `funnel_options` capability type, `funnel_builder` + step type feature keys to `features_list` + `capability_features_list`
5. **BSaaS catalog seed** — Add `funnel_builder` to `bsaas_catalog` ($49/mo, 14-day trial)
6. **Tier feature seeds** — Add funnel feature keys to appropriate tiers (trial=none, starter=none, growth=upsell+order_bump, scale=all, enterprise=all)
7. **FunnelResolver.ts** — New resolver, `EffectiveFunnel` type, wired into `EffectiveCapabilityResolver` as step 18
8. **FunnelService.ts** — Full CRUD with step validation, atomic transactions
9. **FunnelEngine.ts** — Checkout integration: `getCheckoutFunnel`, `processOrderBump`, `processUpsellStep`, `addOfferToOrder`
10. **FunnelAnalyticsService.ts** — Event tracking, dashboard, step conversion, time series
11. **Routes** — `funnel.ts` (tenant CRUD + analytics) + `funnel-checkout.ts` (customer-facing)
12. **Route mounting** — in `index.ts` and `mounts/admin-routes.ts`
13. **Checkout flow modification** — Integrate order bump into Stripe checkout, post-payment redirect to upsell interstitial
14. **Stripe webhook update** — After successful payment, check for funnel and trigger upsell sequence
15. **BillingNotificationService** — 4 new notification types
16. **Bot knowledge integration** — `refreshFunnelEmbeddings` + RAG search

**Skill reference**: `add-bsaas-feature.md` (capability registration), `add-capability-feature.md` (resolver wiring)

### Sprint 2: Frontend — Funnel Builder UI (6-8 days)

**Goal**: Merchants can create, edit, and manage funnels visually.

**Tasks**:
1. **FunnelService.ts** (frontend singleton) — extends `TenantApiSingleton`, CRUD methods, analytics fetch
2. **Funnel list page** — `/t/[tenantId]/settings/funnels/page.tsx` + `FunnelListClient.tsx`
3. **Funnel builder page** — `/t/[tenantId]/settings/funnels/[funnelId]/page.tsx` + `FunnelBuilderClient.tsx`
4. **Step builder component** — drag-and-drop step ordering, per-step config form
5. **Product picker** — searchable dropdown filtering to tenant's digital/hybrid products (with option to show all products if storefront type allows)
6. **Live preview** — render customer-facing interstitial preview
7. **Capability gating** — `useFunnelCapability` hook, upgrade prompt when not purchased
8. **Feature Store integration** — "Sales Funnel Builder" card in Feature Store page
9. **Navigation** — sidebar link, settings card, CapabilityShowcase row
10. **Frontend types** — `FunnelState`, `FunnelStepType` in `CapabilityResolutionService.ts`, `UnifiedCapabilityService.ts` mapping

**Skill reference**: `skill-saas-admin-dashboard.md`, `saas-navigation.md`

### Sprint 3: Frontend — Customer Checkout Flow (5-7 days)

**Goal**: Customers see funnel offers during checkout.

**Tasks**:
1. **Order bump component** — checkbox card on checkout page (or pre-checkout interstitial)
2. **Upsell/Downsell/OTO interstitial pages** — `/checkout/funnel/[orderId]/step/[stepId]`
3. **Funnel step renderer** — renders offer based on step type with appropriate UI
4. **Countdown timer** (OTO) — client-side timer with expiry redirect
5. **Accept flow** — call `funnel-checkout` API → Stripe off-session charge → add to order → redirect to next step
6. **Skip flow** — call `funnel-checkout` API (track skip) → redirect to next step or confirmation
7. **Order confirmation page** — show all purchased items including funnel offers
8. **Mobile responsive** — all interstitial pages optimized for mobile (critical for social commerce traffic)
9. **Analytics tracking** — fire-and-forget `trackEvent` on every view/accept/skip/timeout

**Skill reference**: `skill-frontend-ux-guardrails.md`

### Sprint 4: Analytics, Notifications & Polish (5-7 days)

**Goal**: Merchants see funnel performance, lifecycle notifications work, bot knowledge synced.

**Tasks**:
1. **Funnel analytics dashboard** — `FunnelAnalyticsClient.tsx` with summary cards, step diagram, time series
2. **Per-step conversion table** — sortable, with revenue per step
3. **Revenue uplift chart** — additional revenue from funnel vs base order
4. **AOV comparison** — average order value with vs without funnel
5. **Notification wiring** — `funnel_builder_purchased` on purchase, renewal notifications via `bsaas-renewal.ts`
6. **Bot knowledge refresh triggers** — fire-and-forget on funnel create/update/delete
7. **Bot dynamic response** — funnel offer injection when customer asks about products
8. **Funnel auto-pause on expiry** — when `funnel_builder` purchase expires, set all funnels to `paused`
9. **Funnel re-activation** — when merchant re-purchases, allow re-activating paused funnels
10. **Digital product catalog view** — filtered items page with funnel assignment badge
11. **Settings cards** — TenantSettings funnel card, admin settings (if needed)
12. **End-to-end testing** — manual test path: create digital product → create funnel → customer checkout → verify all steps

**Skill reference**: `end-of-phase-sprint-checklist.md`

---

## 5. Technical Decisions

### 5.1 Why Not a Separate Funnel Table per Product Type?

Funnels support both digital and physical products (per user clarification). The `entry_item_id` references `inventory_items` regardless of `product_type`. The funnel capability is gated by `product_types_digital` (or `product_types_flexible`) because funnels are primarily for digital products, but once unlocked, merchants can attach funnels to any product type.

### 5.2 Why Off-Session Charges for Upsell/Downsell/OTO?

The customer has already entered payment info for the initial purchase. Subsequent funnel offers use Stripe's off-session payment capability to charge the saved payment method — no additional checkout friction. This mirrors the BSaaS renewal pattern (`chargePaymentMethod`).

### 5.3 Why Not Stripe Custom Fields for Order Bumps?

Stripe Custom Fields have limited UI (text only, no images). For a compelling order bump, we need a visual card with product image, price, and checkbox. This will be rendered as a pre-checkout interstitial or a custom element injected before the Stripe Checkout redirect.

### 5.4 Funnel Step Branching

Steps have `accept_to_step` and `skip_to_step` fields for branching:
- Upsell accepted → go to next upsell or OTO (or done)
- Upsell skipped → go to downsell
- Downsell accepted → go to OTO (or done)
- Downsell skipped → go to OTO (or done)
- OTO accepted/skipped/expired → done (confirmation page)

This allows flexible funnel topologies while keeping the data model simple.

### 5.5 One Funnel Per Entry Product

`UNIQUE(tenant_id, entry_item_id)` ensures one funnel per product. This simplifies the checkout flow — no need to choose between multiple funnels. If a merchant wants A/B testing, that's a future enhancement.

### 5.6 Funnel Events vs Badge Analytics

Funnel events use a separate `funnel_events` table (not `badge_events`) because the semantics are different: funnel events track checkout flow decisions, not storefront views/clicks. However, the pattern mirrors `badge_events` for consistency.

---

## 6. File Inventory

### New Files — Backend

| File | Purpose |
|---|---|
| `database/migrations/093_sales_funnels.sql` | DB migration |
| `apps/api/src/services/FunnelService.ts` | Funnel CRUD + validation |
| `apps/api/src/services/FunnelEngine.ts` | Checkout integration runtime |
| `apps/api/src/services/FunnelAnalyticsService.ts` | Analytics + event tracking |
| `apps/api/src/services/resolvers/FunnelResolver.ts` | Capability resolver |
| `apps/api/src/routes/funnel.ts` | Tenant CRUD + analytics routes |
| `apps/api/src/routes/funnel-checkout.ts` | Customer-facing checkout routes |

### Modified Files — Backend

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | 3 new models |
| `apps/api/src/lib/id-generator.ts` | 3 new ID generators |
| `apps/api/src/services/resolvers/types.ts` | `EffectiveFunnel` type, `FunnelMerchantSettings` |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Wire `resolveFunnel` as step 18 |
| `apps/api/src/services/resolvers/index.ts` | Export `resolveFunnel` |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | 4 new notification types |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | `refreshFunnelEmbeddings` |
| `apps/api/src/services/BotDynamicResponseService.ts` | Funnel RAG search |
| `apps/api/src/routes/stripe-webhooks.ts` | Post-payment funnel trigger |
| `apps/api/src/index.ts` | Route mounts |
| `apps/api/src/jobs/bsaas-renewal.ts` | Funnel auto-pause on expiry |

### New Files — Frontend

| File | Purpose |
|---|---|
| `apps/web/src/services/FunnelService.ts` | Frontend singleton |
| `apps/web/src/app/t/[tenantId]/settings/funnels/page.tsx` | Funnel list page |
| `apps/web/src/app/t/[tenantId]/settings/funnels/FunnelListClient.tsx` | Funnel list client |
| `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/page.tsx` | Funnel builder page |
| `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx` | Funnel builder client |
| `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/page.tsx` | Analytics page |
| `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/analytics/FunnelAnalyticsClient.tsx` | Analytics client |
| `apps/web/src/app/checkout/funnel/[orderId]/step/[stepId]/page.tsx` | Upsell/Downsell/OTO interstitial |
| `apps/web/src/app/checkout/funnel/[orderId]/step/[stepId]/FunnelStepClient.tsx` | Step renderer client |
| `apps/web/src/components/checkout/OrderBump.tsx` | Order bump component |

### Modified Files — Frontend

| File | Change |
|---|---|
| `apps/web/src/services/CapabilityResolutionService.ts` | `FunnelState` type |
| `apps/web/src/services/UnifiedCapabilityService.ts` | `mapFunnel()` mapper |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | `useFunnelCapability` hook |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | "Sales Funnels" nav link |
| `apps/web/src/components/settings/TenantSettings.tsx` | Funnel builder settings card |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | Funnel row |
| `apps/web/src/app/(platform)/settings/feature-store/page.tsx` | Funnel builder card |
| `apps/web/src/services/BotService.ts` | Funnel embedding types |

---

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Stripe off-session charge failures for upsell | Medium | Graceful error handling, offer retry link, don't block original order |
| Mobile UX for interstitial pages | High | Mobile-first design, large touch targets, fast load times |
| Funnel complexity overwhelming merchants | Medium | Start with simple linear funnels, add branching in future |
| Performance: funnel lookup on every checkout | Low | Cache funnel by entry_item_id (60s TTL, same as other services) |
| Product type mismatch (physical product in digital funnel) | Low | Validation in FunnelService — warn but allow if merchant insists |
| Customer abandonment from too many steps | Medium | Limit to 4 steps max initially, show progress indicator |

---

## 8. Tier Feature Matrix

| Tier | Funnel Builder | Step Types |
|---|---|---|
| Trial | — | — |
| Starter | — | — |
| Growth | Purchasable | order_bump, upsell |
| Scale | Purchasable | order_bump, upsell, downsell, oto |
| Enterprise | Included | All (flexible) |

---

## 9. Cross-Capability Constraints

| Constraint | Rule | Type |
|---|---|---|
| `funnel_requires_digital_products` | `funnel_builder` requires `product_types_digital` or `product_types_flexible` | block |
| `funnel_requires_online_storefront` | `funnel_builder` requires `storefront_online` or `storefront_flexible` | warn |

These are registered in `capability_constraints_list` and enforced by `CapabilityConstraintResolver`.

---

## 10. Timeline Summary

| Sprint | Duration | Critical Path | Deliverable |
|---|---|---|---|
| Sprint 1 | 7-9 days | Yes | Backend complete, API testable |
| Sprint 2 | 6-8 days | Yes | Merchants can build funnels |
| Sprint 3 | 5-7 days | Yes | Customers see funnel offers at checkout |
| Sprint 4 | 5-7 days | No | Analytics, notifications, polish |

**Total**: 23-31 days
**Critical path to merchant-usable**: Sprint 1 + Sprint 2 = 13-17 days
**Critical path to customer-facing**: Sprint 1 + 2 + 3 = 18-24 days

---

## 11. First Executable Slice

The smallest meaningful first step is:

1. Migration `093_sales_funnels.sql` (tables only, no seeds)
2. Prisma schema update (3 models)
3. `FunnelService.ts` with just `createFunnel` + `listFunnels` + `getFunnel`
4. `funnel.ts` routes with just GET + POST
5. Verify via API call: create a funnel with 2 steps, retrieve it

This proves the data model and service pattern before building the full checkout integration.
