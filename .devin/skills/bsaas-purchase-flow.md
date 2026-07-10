---
description: How to implement self-service à la carte feature purchases (BSaaS) with Stripe billing, reusing the existing subscription billing infrastructure
---

# BSaaS Self-Service Purchase Flow

This document describes the end-to-end flow for tenant self-service purchase of à la carte features (BSaaS), reusing the existing subscription billing infrastructure.

## Architecture Overview

The BSaaS purchase flow layers on top of the existing subscription billing system:

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (Merchant UI)                                   │
│  BSaaS Purchase Page → Stripe Elements → POST /api/...    │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Tenant-Facing Purchase API                               │
│  POST /api/subscription/feature-purchase                  │
│  GET  /api/subscription/feature-catalog                   │
│  POST /api/subscription/feature-purchase/:id/cancel       │
│  GET  /api/subscription/bundle-catalog                    │
│  POST /api/subscription/bundle-purchase                   │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  SubscriptionBillingService (reused)                      │
│  - getPaymentMethodById()                                 │
│  - getOrCreateStripeCustomer()                            │
│  - Stripe charge (one-time or recurring)                  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  tenant_feature_purchases table                           │
│  - feature_key, status, source='bsaas'|'bsaas_bundle'    │
│  - metadata: { price_cents, billing_cycle, bundle_key? } │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  EffectiveCapabilityResolver (automatic)                  │
│  - Merges active purchases into mergedFeatures            │
│  - invalidateEffectiveCapabilities() on every change      │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  BillingNotificationService (reused)                      │
│  - Email to tenant owners                                 │
│  - CRM alert (tenant-facing)                              │
│  - CRM task for follow-up                                 │
└──────────────────────────────────────────────────────────┘
```

## Existing Infrastructure (Reusable)

### Subscription Billing Service
- **File**: `apps/api/src/services/subscription/SubscriptionBillingService.ts`
- **Key methods**:
  - `getPaymentMethodById(id)` — Retrieves saved payment method
  - `getOrCreateStripeCustomer(tenantId, name)` — Gets or creates Stripe customer
  - `subscribe(tenantId, tier, paymentMethodId, billingCycle)` — Creates Stripe subscription
- **Gateways**: Stripe (primary), PayPal (secondary), Manual (admin override)

### Subscription Billing Routes
- **File**: `apps/api/src/routes/subscription-billing.ts`
- **Mounted at**: `/api/subscription`
- **Key routes**:
  - `GET /tiers` — Tier pricing catalog
  - `POST /subscribe` — Subscribe to tier (instant activation)
  - `POST /confirm` — Confirm 3D Secure payment
  - `GET /payment-methods` — List saved payment methods
  - `POST /payment-methods` — Add new payment method
  - `POST /cancel` — Cancel subscription
  - `POST /change-tier` — Change tier with proration
- **Auth**: `authenticateToken` + `requirePermission('CAN_MANAGE_TENANT_BILLING')`

### Stripe Webhook Handler
- **File**: `apps/api/src/routes/stripe-webhooks.ts`
- **Mounted at**: `/stripe/webhooks`
- **Events handled**: `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`, `customer.subscription.deleted`
- **Pattern**: Map Stripe event → update tenant state → send notification

### Billing Notification Service
- **File**: `apps/api/src/services/subscription/BillingNotificationService.ts`
- **Notification types**: `payment_success`, `payment_failed`, `subscription_canceled`, `tier_changed`, `trial_*`
- **Channels**: Email to tenant owners, CRM alert, CRM task, notification log
- **Usage**: `BillingNotificationService.sendNotification({ tenantId, type, metadata })`

### Feature Purchases Admin API (already built)
- **File**: `apps/api/src/routes/admin/feature-purchases.ts`
- **Mounted at**: `/api/admin/feature-purchases`
- **Operations**: CRUD for `tenant_feature_purchases` table
- **Cache invalidation**: `invalidateEffectiveCapabilities(tenantId)` called on every change

### Effective Capability Resolver (automatic merge)
- **File**: `apps/api/src/services/EffectiveCapabilityResolver.ts`
- **Behavior**: `fetchRawCapabilities()` queries `tenant_feature_purchases` where `status='active'` and not expired, merges into `mergedFeatures` map
- **Source-agnostic**: Resolver doesn't care how a feature was enabled (tier or purchase)

## What Was Built (All Phases Complete)

### Phase 1: Backend Purchase API
- `GET /api/subscription/feature-catalog` — Returns purchasable features from `bsaas_catalog` table with tier-aware status **and capability engagement eligibility** (`tierEligible`, `ineligibleReason` per item)
- `GET /api/subscription/feature-purchases` — Lists tenant's active purchases
- `POST /api/subscription/feature-purchase` — Self-service purchase with Stripe charge **(pre-charge capability engagement check blocks ineligible purchases with `403 upgrade_required`)**
- `POST /api/subscription/feature-purchase/:id/cancel` — Cancel a purchase
- **File**: `apps/api/src/routes/bsaas-purchases.ts`
- **Catalog table**: `bsaas_catalog` (migration `047_bsaas_catalog.sql`)
- Purchase metadata includes `payment_method_id` for renewal re-charging

### Phase 5: Capability Engagement Purchase Gate
- **Rule**: A merchant can only purchase a feature à la carte if their tier already grants at least one other feature within the same capability type ("active capability engagement"). This enables vertical upgrades within an engaged capability domain while blocking purchases for capability types the tier doesn't touch at all.
- **Function**: `checkCapabilityEngagement(tenantId, featureKey)` in `bsaas-purchases.ts`
- **Data flow**: `feature_key → capability_features_list → capability_type_id → tier_features_list (WHERE tier_id IN tenant_tiers AND is_enabled=true)`
- **No schema changes**: Reuses existing `tier_features_list → capability_features_list → capability_type_list` chain
- **Frontend**: Ineligible items show locked card with "Upgrade Required" badge, reason text, and "Upgrade Plan" button linking to `/t/{tenantId}/settings/store?tab=plans`

### Phase 6: Eligibility Flags (trial_eligible, demo_eligible, is_private)
- **Migration**: `database/migrations/094_trial_eligible_flag.sql` — Adds three columns to both `bsaas_catalog` and `bsaas_bundles`:
  - `trial_eligible` (BOOLEAN, default false, opt-in) — Must be true AND `trial_days > 0` for trial purchases to be allowed
  - `demo_eligible` (BOOLEAN, default true, opt-out) — When false, demo tenants (`tenants.is_demo = true`) are blocked from purchasing with `403 demo_tenant_blocked`
  - `is_private` (BOOLEAN, default false, opt-in) — When true, item is hidden from public Feature Store catalog endpoints
- **Prisma schema**: `bsaas_catalog` and `bsaas_bundles` models include all three fields with `@@index([is_private])`
- **Backend purchase logic** (`bsaas-purchases.ts`):
  - `getCatalogEntry()` returns `trial_eligible` and `demo_eligible`
  - Feature catalog endpoint: `where: { is_active: true, is_private: false }` — filters private items
  - Bundle catalog endpoint: `where: { is_active: true, is_private: false }` — filters private bundles
  - Feature purchase: checks `demo_eligible` (blocks demo tenants), checks `trial_eligible` (only enters trial branch if true + trial_days > 0)
  - Bundle purchase: same checks for bundles
- **Admin routes**: `admin/bsaas-catalog.ts` and `admin/bsaas-bundles.ts` — all three flags in Zod create/update schemas
- **Frontend types**: `BsaasPurchaseService.ts` (`trialEligible`, `demoEligible` on catalog items), `AdminBsaasCatalogService.ts` and `AdminBsaasBundleService.ts` (all three flags on entries + inputs)
- **Feature Store UI** (`feature-store/page.tsx`):
  - Fetches tenant's `isDemo` status via `tenantPublicService.getPublicTenantInfo()`
  - `trialEligible` controls trial badges and "Start Trial" vs "Purchase" button labels
  - `demoEligible` blocks demo tenants (shows "Demo Restricted" badge + disabled "Not Available for Demo" button)
  - `demo_tenant_blocked` error handling in both feature and bundle purchase handlers
- **Admin UI**: Radio toggle switches (Yes/No) for all three flags in `BundleEditModal.tsx` and `BsaasFeaturesTab.tsx`; table columns for Trial Elig. and Demo Elig. in both features and bundles tables

### Tier Status Check (Flexible Expansion)
- **Function**: `checkTierFeatureStatus(tenantId, featureKey)` in `bsaas-purchases.ts`
- **Purpose**: Determines if a feature is already included in the tenant's tier (so the catalog shows "Included in Plan" instead of a purchase button)
- **Two-step resolution** (mirrors the MV's flexible CTEs from migration 089):
  1. **Exact match**: Check `tier_features_list` for the exact `feature_key` with `is_enabled=true`
  2. **Flexible fallback**: If no exact match, resolve the feature's capability type via `capability_features_list`, construct `{capability_key}_flexible`, and check if the tenant has that flexible key from **any source**:
     - Tier-bundled: `tier_features_list` (tier has `{capability}_flexible` enabled)
     - Purchased: `tenant_feature_purchases` (tenant purchased `{capability}_flexible`)
     - Admin grant: `tenant_feature_overrides_list` (admin granted `{capability}_flexible`)
     If any source has the flexible key, the feature is in-tier via flexible expansion.
- **Why not use the MV directly?** `mv_tenant_effective_capabilities` has a 10-minute refresh cron, which creates a staleness risk for post-purchase confirmation and settings pages. The live query avoids this.
- **Merchant gate**: After confirming in-tier, checks the merchant gate toggle for the capability domain (e.g., `tenant_chatbot_options_settings.chatbot_enabled`)
- **Returns**: `{ inTier, merchantGateOn, capabilityKey }` → frontend maps to `in_tier_active`, `in_tier_gate_off`, or `not_in_tier`

### Phase 2: Frontend Purchase Page
- **File**: `apps/web/src/app/(platform)/settings/feature-store/page.tsx`
- Shows catalog with tier-aware UI (`in_tier_active`, `in_tier_gate_off`, `not_in_tier`)
- Payment method selection + purchase confirmation flow
- Active purchases list with cancel option
- **Service**: `apps/web/src/services/BsaasPurchaseService.ts`

### Phase 3: Billing Integration
- **Renewal job**: `apps/api/src/jobs/bsaas-renewal.ts` — Daily job that:
  - Re-charges expiring monthly/annual purchases via `chargePaymentMethod`
  - Suspends purchases on payment failure (sets `status='suspended'`)
  - Expires cancelled purchases past their billing period
  - Sends `bsaas_renewal_success` or `bsaas_renewal_failed` notifications
- **Server startup**: Wired into `apps/api/src/index.ts` alongside grace period job
- **Notification types added to BillingNotificationService**:
  - `bsaas_purchase_success` — On successful purchase (email + CRM alert + CRM task)
  - `bsaas_renewal_success` — On successful renewal charge
  - `bsaas_renewal_failed` — On renewal payment failure (high priority CRM task, 7-day due date)
  - `bsaas_purchase_cancelled` — On cancellation
- All notification types include email templates, CRM alerts (tenant-facing), and CRM tasks (staff follow-up)

### Phase 4: Admin Catalog UI
- **Admin API**: `apps/api/src/routes/admin/bsaas-catalog.ts` — CRUD for `bsaas_catalog` table
- **Admin proxy route**: `apps/web/src/app/api/admin/bsaas-catalog/route.ts`
- **Admin service**: `apps/web/src/services/AdminBsaasCatalogService.ts`
- **Admin UI**: `apps/web/src/admin/components/BsaasCatalogManagement.tsx`
- **Admin page**: `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx`
- Nav links added to both admin sidebar and tenant sidebar

## Purchase Flow (End-to-End)

```
1. Merchant visits /settings/feature-store
2. Sees catalog of purchasable features (e.g., "CRM Assistant Skill — $19/mo")
   - Features already in their tier show as "Included" (in_tier_active)
   - Features in tier but gated off show as "Included (inactive)" (in_tier_gate_off)
   - Features not in tier and tier is engaged in the capability type show price + "Add" button (not_in_tier, tierEligible=true)
   - Features not in tier and tier has NO engagement in the capability type show locked state with "Upgrade Required" badge (not_in_tier, tierEligible=false)
3. Clicks "Add" on an eligible feature
4. Selects existing payment method or enters new card (Stripe Elements)
5. Frontend calls POST /api/subscription/feature-purchase
   { featureKey: 'chatbot_skill_crm_assistant', paymentMethodId: 'pm_xxx' }
6. Backend:
   a. Validate feature exists in bsaas_catalog and is active
   b. Check tenant doesn't already have active purchase or tier inclusion
   c. **Check capability engagement** — verify tenant's tier has ≥1 feature in the same capability type. If not, return 403 upgrade_required.
   d. Get payment method via SubscriptionBillingService
   e. Charge via Stripe (chargePaymentMethod — one-time PaymentIntent)
   f. Upsert tenant_feature_purchases (status=active, source=bsaas, expires_at=+30d or +365d)
   g. invalidateEffectiveCapabilities(tenantId)
   h. Audit log (feature_purchase.create)
   i. BillingNotificationService.sendNotification({ type: 'bsaas_purchase_success' })
7. Frontend refreshes capabilities → feature is now available
8. Bot skill endpoints return 200 instead of 403
```

### Companion Purchase Pattern (Critical)

When a tenant purchases a sub-feature whose capability type has a parent gate (e.g., `chatbot_skill_crm_assistant` → `chatbot_enabled`), the backend auto-creates a **zero-cost companion purchase** for the parent gate. Without this, the tenant pays but the capability resolver gates the feature off because the parent gate isn't enabled.

**Functions** (in `bsaas-purchases.ts`):
- `ensureCompanionPurchase(tenantId, capabilityKey, purchasedFeatureKey)` — Creates companion on purchase activation
- `maybeCancelCompanion(tenantId, cancelledFeatureKey)` — Cancels companion when no other active purchases remain

**Key maps**:
- `PARENT_GATE_FEATURES` — Maps capability type keys to parent gate feature keys
- `MERCHANT_GATE_MAP` — Maps capability type keys to merchant settings tables and toggle columns

**Same pattern applies to Featured Placements**: `FeaturedPlacementService` has `ensureFeaturedCapabilityCompanions()` and `maybeCancelFeaturedCapabilityCompanions()` that create companions for `featured_enabled` + `featured_featured` on activation and clean them up on expiration/revocation.

See **`store-purchases-capability-checklist.md`** for the full checklist across all store purchase phases.

## Renewal Flow (Automated)

```
1. Daily job (bsaas-renewal.ts) runs at midnight
2. Finds active purchases where expires_at <= now+24h
3. For each expiring purchase:
   a. Read payment_method_id from purchase metadata
   b. Re-charge via chargePaymentMethod(tenantId, paymentMethodId, priceCents)
   c. On success: extend expires_at (+30d monthly, +365d annual), send bsaas_renewal_success
   d. On failure: set status='suspended', invalidate capabilities, send bsaas_renewal_failed
4. Expire cancelled purchases past their billing period (status → 'expired')
5. Suspend active purchases whose expiry has passed without renewal
```

## Pricing Model

Feature pricing is stored in the `bsaas_catalog` table (migration `047_bsaas_catalog.sql`):

| Column | Type | Description |
|--------|------|-------------|
| `feature_key` | VARCHAR(100) | References `features_list.key` |
| `price_cents` | INTEGER | Price in cents (e.g., 1900 = $19.00) |
| `billing_cycle` | VARCHAR(20) | `monthly`, `annual`, or `one_time` |
| `trial_days` | INTEGER | Trial period in days (0 = no trial) |
| `trial_eligible` | BOOLEAN | Opt-in flag — must be true for trials to be allowed (default false) |
| `demo_eligible` | BOOLEAN | Opt-out flag — when false, demo tenants cannot purchase (default true) |
| `is_private` | BOOLEAN | When true, hidden from Feature Store (default false) |
| `is_active` | BOOLEAN | Whether feature is available for purchase |
| `sort_order` | INTEGER | Display ordering |
| `marketing_name` | VARCHAR(255) | Display name in Feature Store |
| `marketing_description` | TEXT | Marketing copy |
| `icon_name` | VARCHAR(100) | Icon identifier |

Admins manage the catalog via the admin UI at `/settings/admin/bsaas-catalog`.

## File Reference

| File | Purpose |
|------|---------|
| `apps/api/src/routes/bsaas-purchases.ts` | Tenant-facing purchase API (catalog, bundle catalog, purchase, bundle purchase, cancel) |
| `apps/api/src/routes/admin/bsaas-catalog.ts` | Admin CRUD for bsaas_catalog table |
| `apps/api/src/routes/admin/bsaas-bundles.ts` | Admin CRUD for bsaas_bundles + bsaas_bundle_items |
| `apps/api/src/jobs/bsaas-renewal.ts` | Daily renewal job (re-charge, bundle grouping, suspend, expire) |
| `apps/api/src/services/subscription/SubscriptionBillingService.ts` | Billing service (chargePaymentMethod reused) |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | Notification service (extended with bsaas_* types) |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Automatic merge of purchases into capabilities |
| `apps/api/src/index.ts` | Server startup (renewal job wired in) |
| `apps/web/src/app/(platform)/settings/feature-store/page.tsx` | Feature Store purchase page |
| `apps/web/src/services/BsaasPurchaseService.ts` | Frontend purchase service (features + bundles) |
| `apps/web/src/services/AdminBsaasBundleService.ts` | Admin frontend bundle service |
| `apps/web/src/app/api/admin/bsaas-catalog/route.ts` | Admin API proxy route |
| `apps/web/src/services/AdminBsaasCatalogService.ts` | Admin frontend service |
| `apps/web/src/admin/components/BsaasCatalogManagement.tsx` | Admin catalog management UI (tabs: features + bundles) |
| `apps/web/src/admin/components/BundlesTab.tsx` | Admin bundle management tab |
| `apps/web/src/admin/components/BundleEditModal.tsx` | Admin bundle create/edit modal |
| `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx` | Admin catalog page |
| `database/migrations/047_bsaas_catalog.sql` | Catalog table migration |
| `database/migrations/087_bsaas_bundles.sql` | Bundle tables + Customer Engagement Suite seed |
| `database/migrations/088_bsaas_bundle_seeds.sql` | Commerce Power Pack, Operations, Growth, Everything Pack seeds |
| `database/migrations/093_everything_pack_split.sql` | Splits Everything Pack into no-org (16 components) + org (17 components) variants |
| `database/migrations/094_trial_eligible_flag.sql` | Adds `trial_eligible`, `demo_eligible`, `is_private` columns to `bsaas_catalog` and `bsaas_bundles` |

## Expansion Opportunities

### ✅ Completed (Phases E1–E5)

The following were implemented as quick-win expansions. See:
- **`docs/BSAAS_EXPANSION_PHASED_PLAN.md`** — Phased plan (all phases complete)
- **`docs/BSAAS_EXPANSION_USER_GUIDE.md`** — User guide for all five features

| Phase | Feature | Summary |
|-------|---------|---------|
| E1 | Admin Complimentary Access | Admin UI to grant features at no cost (`source='admin_grant'`, `price_cents=0`) |
| E2 | Grace Period for Renewal Failures | 7-day grace period with daily retries before suspension (`status='past_due'`) |
| E3 | Free Trials for BSaaS Features | `trial_days` on catalog entries, no charge during trial, auto-converts on expiry |
| E4 | Revenue Analytics Dashboard | Admin dashboard with MRR, ARR, churn, trial conversion, per-feature revenue |
| E5 | Promotional Discounts / Coupon Codes | Stripe coupon/promo code management, discount at checkout, tracked in metadata |

### Remaining Future Opportunities

### 1. Stripe Subscriptions (True Recurring Billing)
Currently renewals use synchronous `chargePaymentMethod` (PaymentIntent). Migrating to Stripe Subscriptions would enable:
- Automatic retry via Stripe Smart Retries (no custom retry logic needed)
- Webhook-driven lifecycle (`invoice.payment_failed`, `customer.subscription.deleted`)
- Proration when upgrading/downgrading between monthly and annual
- Stripe-hosted invoice PDFs and receipt emails
- **Implementation**: Create Stripe Price objects per catalog entry, subscribe customer on purchase, handle `invoice.payment_failed` in `stripe-webhooks.ts` to suspend purchases

### 2. Usage-Based Pricing (Metered BSaaS)
- For features like AI bot conversations, API calls, or product embeddings
- Stripe Metered Billing: create subscription item with `usage_type=metered`
- Report usage to Stripe via `subscriptionItems.createUsageRecord()`
- Invoice generated automatically by Stripe based on usage tiers
- Requires `bsaas_catalog.price_model` column: `flat` vs `metered` vs `tiered`

### 3. Feature Upgrades / Downgrades
- Allow tenants to switch between monthly and annual billing
- Proration logic: calculate remaining value, apply credit or charge difference
- Update `billing_cycle` and `price_cents` in purchase metadata
- Adjust `expires_at` based on new cycle

## Bundle Purchase Flow

Bundles group multiple flexible toggle features across capability domains into a single purchasable product at a discount vs. buying each separately.

### Schema

- **`bsaas_bundles`** table — `bundle_key`, `marketing_name`, `description`, `price_cents`, `billing_cycle`, `trial_days`, `trial_eligible`, `demo_eligible`, `is_private`, `is_active`, `sort_order`
- **`bsaas_bundle_items`** table — `bundle_id`, `feature_key`, `sort_order` (junction table linking bundles to feature keys)
- **Migrations**: `087_bsaas_bundles.sql` (tables + Customer Engagement Suite seed), `088_bsaas_bundle_seeds.sql` (Commerce Power Pack, Operations Bundle, Growth Bundle, Everything Pack seeds)
- **Prisma models**: `bsaas_bundles`, `bsaas_bundle_items`

### Bundle Catalog Endpoint

- **`GET /api/subscription/bundle-catalog`** — Returns active bundles with component features, tier eligibility per component, purchase status, and trial info per tenant
- Uses `checkBundleEngagement()` to verify the tenant's tier has ≥1 feature in EVERY capability type represented by the bundle's components
- Computes `allInTier` by calling `checkTierFeatureStatus()` for each component — if all are in-tier (including via flexible expansion), the bundle shows "Included in Plan" with a disabled button instead of "Start Trial"
- Computes `allActive` by checking if all components have active purchases — filters out fully-purchased bundles

### Bundle Purchase Endpoint

- **`POST /api/subscription/bundle-purchase`** — Validates bundle, checks existing purchases, verifies capability engagement for ALL components
- **Trial branch**: Creates `tenant_feature_purchases` rows with `source='bsaas_bundle'`, `status='trial'` for each component
- **Normal purchase**: Single Stripe charge for the entire bundle price, creates active purchase rows for each component
- Each component's `metadata` includes `bundle_key`, `bundle_name`, `price_cents`, `billing_cycle`, `payment_method_id`
- Calls `ensureCompanionPurchase()` for each component's parent gate
- Calls `invalidateEffectiveCapabilities()` once after all purchases
- Audit logs and notifications sent

### Bundle Cancellation (Cascade)

- When cancelling a `bsaas_bundle` purchase, the cancel endpoint checks `metadata.bundle_key`
- Finds all other purchases with the same `bundle_key` for the tenant
- Cancels all components (bundle = all-or-nothing)
- Calls `maybeCancelCompanion()` for each component
- Audit log records `bundle_purchase.cancel` with all cancelled IDs

### Bundle Renewal (Single Charge)

- The renewal job (`bsaas-renewal.ts`) groups expiring `bsaas_bundle` purchases by `metadata.bundle_key`
- Charges once per bundle (not per component) — saves Stripe transaction fees
- Extends expiry for all component purchases on success
- On failure, enters grace period for all components
- Expired trial conversion also groups by bundle_key and charges once

### Source Field

- `source: 'bsaas'` — Individual feature purchase
- `source: 'bsaas_bundle'` — Bundle component purchase (linked via `metadata.bundle_key`)
- `source: 'companion'` — Zero-cost parent gate companion (auto-created)
- `source: 'admin_grant'` — Admin complimentary access

The `EffectiveCapabilityResolver` treats all sources equally — it merges any active purchase into `mergedFeatures` regardless of source.

### Available Bundles

| Bundle | Key | Components | Price | Discount | Trial |
|--------|-----|-----------|-------|----------|-------|
| Customer Engagement Suite | `customer_engagement_suite` | chatbot_flexible + crm_flexible + faq_flexible | $79/mo | 26% | 14 days |
| Commerce Power Pack | `commerce_power_pack` | social_commerce_flexible + storefront_opt_flexible + product_options_flexible | $69/mo | 29% | 14 days |
| Operations Bundle | `operations_bundle` | integration_flexible + fulfillment_flexible + payment_gateway_flexible | $49/mo | 29% | 14 days |
| Growth Bundle | `growth_bundle` | featured_flexible + directory_entry_flexible + quickstart_flexible | $39/mo | 32% | 14 days |
| Everything Pack | `everything_pack` | 16 flexible toggles (no org) | $279/mo | ~30% | 14 days |
| Everything Pack + Org | `everything_pack_org` | All 17 flexible toggles (includes org_flexible) | $299/mo | 31% | 14 days |

### Bundle Engagement Caveat (Critical)

`checkBundleEngagement()` runs `checkCapabilityEngagement()` for **every** component in the bundle. If the tenant's tier has **zero** features in **any** capability type represented by the bundle's components, the **entire bundle** is blocked — not just the individual component.

This means a bundle containing `org_flexible` will be blocked for any tenant whose tier has no `organization_options` features. To solve this, the Everything Pack was split into two variants:
- **Everything Pack** (16 components, no `org_flexible`) — purchasable by any tier with engagement in the 16 included domains
- **Everything Pack + Org** (17 components, with `org_flexible`) — only purchasable by tiers with org engagement (e.g., chain tiers)

When creating new bundles that span many capability domains, consider whether all target tiers have engagement in every included domain. If not, either split the bundle or create domain-specific sub-bundles.

### Admin Management

- **Admin API**: `apps/api/src/routes/admin/bsaas-bundles.ts` — CRUD for bundles and bundle items
- **Admin service**: `apps/web/src/services/AdminBsaasBundleService.ts`
- **Admin UI**: `apps/web/src/admin/components/BundlesTab.tsx` + `BundleEditModal.tsx` (tab in BsaasCatalogManagement)
- **Admin page**: `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx`
- **Clone Bundle**: BundlesTab has a Copy icon button per row that opens BundleEditModal in clone mode — pre-fills all fields from the source bundle with `_copy` suffix on bundle_key and `(Copy)` suffix on marketing_name. Bundle key is editable (new bundle). Useful for testing bundle behavior without modifying the original.

### Frontend Bundle Purchase

- **Service**: `BsaasPurchaseService.getBundleCatalog()` and `purchaseBundle()`
- **UI**: Feature Store page (`feature-store/page.tsx`) shows bundle cards above individual features with component list, pricing, trial badges, eligibility states, and purchase confirmation modal

## Related Documents

- **`store-purchases-capability-checklist.md`** — Checklist for ensuring all store purchase flows have capability awareness, companion purchase soft-enables, and companion cleanup
- **`add-bsaas-feature.md`** — How to add a purchasable feature to the platform
- **`docs/BSAAS_PHASED_PLAN.md`** — Original phased plan (Phases 1-5, all complete)
- **`docs/BSAAS_PURCHASE_PHASED_PLAN.md`** — Phased plan for self-service purchase flow
- **`docs/BSAAS_EXPANSION_PHASED_PLAN.md`** — Expansion quick wins (Phases E1-E5, all complete)
- **`docs/BSAAS_USER_GUIDE.md`** — User guide for core BSaaS features
- **`docs/BSAAS_EXPANSION_USER_GUIDE.md`** — User guide for E1-E5 expansion features
