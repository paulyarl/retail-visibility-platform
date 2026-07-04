---
description: User guide for the platform's 4 self-serve stores — Subscription Tier Upgrades, Feature Store (BSaaS), Featured Placement Store, and Directory Promotion Store — plus the unified App Store that combines all four into a single tabbed experience. Covers what each store sells, how to purchase, how to manage items/prices as admin, and common tasks.
---

# Self-Serve Stores Guide

The platform has **4 self-serve stores** where tenants can purchase or upgrade capabilities without admin intervention. Each store serves a distinct purpose and has its own checkout flow, admin catalog, and lifecycle. All four stores are also accessible from a single unified **App Store** page with tabbed navigation.

## Store Overview

| # | Store | Route | What It Sells | Payment Method |
|---|-------|-------|---------------|----------------|
| 0 | **App Store (unified)** | `/t/{tenantId}/settings/store` | All four stores in one tabbed page | All methods |
| 1 | **Subscription / Tier Upgrade** | `/settings/subscription` | Tier plans (starter → enterprise, chain tiers) | Stripe card, PayPal |
| 2 | **Feature Store (BSaaS)** | `/settings/feature-store` | À la carte features not in your tier (chatbot skills, CRM, etc.) | Saved Stripe payment method |
| 3 | **Featured Placement Store** | `/t/{tenantId}/settings/featured-store` | Time-limited featured placement for a specific product on platform surfaces | Stripe Checkout |
| 4 | **Directory Promotion Store** | `/t/{tenantId}/settings/promotion` | Store-level promotion on the public directory (map, search, carousel) | Stripe Checkout |

---

## Store 0: App Store (Unified)

### What It Does

The App Store is a single page that combines all four stores into a tabbed interface. Tenants can switch between Subscription, Feature Store, Featured Store, and Directory Promotion without navigating to separate pages. Each tab lazy-loads its respective store component.

### Tenant Flow

1. Navigate to `/t/{tenantId}/settings/store`
2. Tabs are shown for: **Plans** (Subscription), **Features** (Feature Store), **Placements** (Featured Store), **Promotions** (Directory Promotion)
3. Click any tab to switch — the store component loads on demand
4. All purchase flows work identically to the individual store pages

### Key Details

- **Lazy-loaded**: Each tab's code is fetched only when the tab is active (via `next/dynamic`)
- **Shared payment methods**: Payment methods are fetched once and shared across all tabs
- **Individual stores still work**: Each store remains accessible at its own route for deep-linking
- **Dashboard & settings**: The App Store card appears in both `StoreAccessCard` (dashboard) and `TenantSettings` (settings page) as the first entry

### Files

| Purpose | Path |
|---------|------|
| App Store page | `apps/web/src/app/t/[tenantId]/settings/store/page.tsx` |
| App Store client | `apps/web/src/app/t/[tenantId]/settings/store/AppStoreClient.tsx` |
| Dashboard card | `apps/web/src/components/dashboard/StoreAccessCard.tsx` |
| Settings card | `apps/web/src/components/settings/TenantSettings.tsx` ("Stores" group) |

---

## Store 1: Subscription / Tier Upgrade

### What It Does

Lets tenants upgrade, downgrade, or change their subscription tier. Tiers gate the number of SKUs, locations, and capabilities available. This is the foundational purchase — all other stores layer on top.

### Tenant Flow

1. Navigate to `/settings/subscription?tenantId={tenantId}`
2. View current plan, SKU usage, active capabilities, and payment methods
3. **Add a payment method**: Click "Add Card" (Stripe Elements) or "Add PayPal"
4. **Change tier**: Scroll to the SelfServiceBilling section, select a tier, choose monthly/annual billing
5. Click "Change Plan" — backend creates Stripe subscription with proration
6. Page reloads with new tier active

### Key Details

- **Proration**: Stripe handles proration automatically when upgrading mid-cycle
- **Trial tiers**: Tenants on trial can switch between trial tiers but cannot go from paid back to trial
- **Pending requests**: If manual approval is needed, requests appear in "Pending Subscription Change Requests" section
- **Invoice history**: Link at bottom of page goes to `/t/{tenantId}/settings/billing/invoices`

### Admin Tasks

**View tenant subscriptions**: `/settings/admin/tenants` — see all tenants, their tiers, and status

**Manage tier catalog**: `/settings/admin/tiers` — create, edit, reorder tiers; set pricing, SKU limits, location limits, features

**Override features per tenant**: `/settings/admin/feature-overrides` — manually enable/disable features for a specific tenant

**Manual billing**: `/settings/admin/billing/manual-billing` — create manual invoices or adjust billing

**Platform revenue**: `/settings/admin/platform-revenue` — view aggregate revenue across all subscriptions

### Files

| Purpose | Path |
|---------|------|
| Tenant subscription page | `apps/web/src/app/(platform)/settings/subscription/page.tsx` |
| Self-service billing component | `apps/web/src/components/subscription/SelfServiceBilling.tsx` |
| Billing service (backend) | `apps/api/src/services/subscription/SubscriptionBillingService.ts` |
| Billing routes | `apps/api/src/routes/subscription-billing.ts` |
| Tier management admin page | `apps/web/src/app/(platform)/settings/admin/tiers/page.tsx` |
| Offerings/catalog page | `apps/web/src/app/(platform)/settings/offerings/page.tsx` |

---

## Store 2: Feature Store (BSaaS)

### What It Does

Lets tenants purchase individual features à la carte that aren't included in their subscription tier. Features are capabilities like chatbot skills, CRM tools, social commerce options, etc. Purchases merge into the tenant's effective capabilities via the `EffectiveCapabilityResolver`.

### Tenant Flow

1. Navigate to `/settings/feature-store?tenantId={tenantId}`
2. Browse the catalog — each card shows:
   - **Price** (monthly, annual, or one-time)
   - **Status badge**: "Active" (already purchased), "In Your Plan" (tier-included), "Disabled in Settings" (in tier but turned off), or purchasable
3. Click "Purchase" on a feature
4. Select a saved payment method (or add one via Subscription page first)
5. Optionally enter a promo code
6. Click "Confirm Purchase" — backend charges via Stripe and activates the feature immediately
7. To cancel: Click "Cancel" on an active feature — access continues until period ends

### Key Details

- **Companion purchases**: If a feature requires a parent gate (e.g., `chatbot_skill_crm_assistant` requires `chatbot_enabled`), the system auto-creates a zero-cost companion purchase
- **Trials**: Some features offer free trial days before the first charge
- **Renewals**: Daily job (`bsaas-renewal.ts`) auto-re-charges monthly/annual purchases
- **Grace period**: 7-day grace period on renewal failure before suspension
- **Tier awareness**: Features already in your tier show "Included in Plan" — no need to purchase

### Admin Tasks

**Manage the catalog**: `/settings/admin/bsaas-catalog`
- Add new purchasable features: set feature key, marketing name, description, price, billing cycle, trial days, sort order
- Edit existing entries: change pricing, description, toggle active/inactive
- Delete entries: removes from store (existing purchases remain active)
- **Grant complimentary access**: Click "Grant Access" to give a feature to a tenant at no cost (`source='admin_grant'`, `price_cents=0`)

**View analytics**: `/settings/admin/bsaas-analytics`
- MRR, ARR, churn rate, trial conversion rate
- Per-feature revenue breakdown
- Active vs suspended vs expired purchases

**Manage promotions**: `/settings/admin/bsaas-promotions`
- Create promotional discount codes
- Set percentage or fixed-amount discounts
- Track promotion usage

### Files

| Purpose | Path |
|---------|------|
| Feature Store page | `apps/web/src/app/(platform)/settings/feature-store/page.tsx` |
| Frontend service | `apps/web/src/services/BsaasPurchaseService.ts` |
| Purchase API routes | `apps/api/src/routes/bsaas-purchases.ts` |
| Admin catalog UI | `apps/web/src/admin/components/BsaasCatalogManagement.tsx` |
| Admin catalog page | `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx` |
| Renewal job | `apps/api/src/jobs/bsaas-renewal.ts` |
| Catalog table migration | `database/migrations/047_bsaas_catalog.sql` |
| Detailed skill doc | `.devin/skills/bsaas-purchase-flow.md` |
| Feature store user guide | `.devin/skills/feature-store-user-guide.md` |

---

## Store 3: Featured Placement Store

### What It Does

Lets tenants purchase time-limited featured placement for a **specific product** on platform surfaces (storefront spotlight, shops page, directory). This is a per-product, time-boxed purchase — not a subscription.

### Tenant Flow

1. Navigate to `/t/{tenantId}/settings/featured-store`
2. **Step 1 — Select product**: Search and pick from your inventory items
3. **Step 2 — Select plan**: Choose a duration (7, 14, or 30 days) and surface
4. **Step 3 — Checkout**: Redirected to Stripe Checkout for payment
5. On success: placement activates immediately, product gets featured badge on the selected surface
6. View active placements in "Your Featured Placements" list with expiry countdown
7. **Renew**: Click "Renew" on an expiring placement to extend it

### Key Details

- **Per-product**: Each purchase is for one specific inventory item, not the whole store
- **Surfaces**: `storefront_spotlight`, `cross_tenant_shops`, `directory`
- **Auto-renewal**: Daily job (`featured-placement-renewal.ts`) auto-renews via Stripe off-session payment
- **Grace period**: 7-day grace period on renewal failure
- **Revocation**: Admins can revoke a placement with a reason
- **Trial placements**: Stale pending (trial) placements older than 24h are cleaned up daily

### Admin Tasks

**Manage placement plans**: Admin CRUD via `FeaturedPlacementPurchaseService` methods:
- `adminCreatePlan(planKey, label, surface, durationDays, priceCents)` — create new plan
- `adminUpdatePlan(planKey, ...)` — change pricing, duration, toggle active
- `adminDeletePlan(planKey)` — remove plan
- `adminListPlans(includeInactive)` — view all plans

**View revenue**: `/settings/admin/featured-placement-revenue`
- Total revenue, active purchases, revenue by surface
- Utilization, churn, trial conversion metrics

**Revoke a placement**: `adminRevokePurchase(purchaseId, reason)` — removes active placement from a tenant

**View all purchases**: `adminListPurchases({ status, surface, tenantId })` — filter across all tenants

### Files

| Purpose | Path |
|---------|------|
| Tenant featured store page | `apps/web/src/app/t/[tenantId]/settings/featured-store/page.tsx` |
| Tenant store client | `apps/web/src/app/t/[tenantId]/settings/featured-store/FeaturedStoreClient.tsx` |
| Frontend service | `apps/web/src/services/FeaturedPlacementPurchaseService.ts` |
| Admin revenue dashboard | `apps/web/src/app/(platform)/settings/admin/featured-placement-revenue/FeaturedPlacementRevenueDashboard.tsx` |
| Renewal job | `apps/api/src/jobs/featured-placement-renewal.ts` |
| Billing notifications | `apps/api/src/services/subscription/BillingNotificationService.ts` (5 featured_placement_* types) |

---

## Store 4: Directory Promotion Store

### What It Does

Lets tenants promote their **entire store** (not individual products) on the public directory. Promoted stores get a gold map marker, promoted badge, higher search ranking, and optionally a homepage carousel spot. This is a store-level, time-boxed purchase with three tiers.

### Tenant Flow

1. Navigate to `/t/{tenantId}/settings/promotion`
2. If capability is gated (tier doesn't include directory promotion), shows upgrade prompt linking to subscription page
3. **Choose a tier**:
   - **Basic**: Gold marker, promoted badge, higher visibility, basic analytics
   - **Premium**: Everything in Basic + featured in search results, homepage carousel spot, advanced analytics, priority support
   - **Featured**: Everything in Premium + guaranteed top 3 position, custom marker icon, sponsored content, dedicated account manager
4. **Select duration**: Monthly (30 days), Quarterly (90 days), or Annual (365 days)
5. Click "Checkout" — redirected to Stripe Checkout
6. On success: store is promoted immediately, `directory_promoted` badge appears on directory listings
7. View impression/click analytics on the status panel
8. **Detailed analytics**: Click "View detailed analytics" → `/t/{tenantId}/settings/promotion/analytics`
9. **Cancel**: Click "Cancel" — promotion remains active until expiry, but won't auto-renew
10. **Renew**: Click "Renew Now" on an active or expired promotion

### Key Details

- **Store-level, not product-level**: Promotes the entire tenant/store, not individual products
- **Capability-gated**: Tier must include `directory_promotion` capability; plans filtered by allowed tiers
- **Badge integration**: `directory_promoted` badge registered in `BadgeRegistryService` with `promotionalPriority: 200`
- **Analytics**: Impression and click tracking via `badge_events` table
- **Bot knowledge**: Active promotion is embedded into bot RAG for customer queries
- **Auto-renewal**: Daily job (`promotion-renewal.ts`) handles auto-renewals, grace periods, and expirations
- **Notifications**: 5 notification types (purchased, renewal success/failure, grace period warning, expired)

### Admin Tasks

**Manage promotion catalog**: `/settings/admin/promotion-catalog`
- Create plans: set plan key, label, tier (basic/premium/featured), duration, price, sort order
- Edit plans: change pricing, duration, toggle active/inactive
- Delete plans: removes from store (existing purchases remain active)
- Toggle "Show inactive" to see deactivated plans

**View revenue**: `/settings/admin/promotion-revenue`
- Total revenue, active count, renewal rate, churn rate, grace period conversion
- Revenue by tier breakdown
- Lifecycle status bars, upcoming renewals, grace period promotions

**CRM integration**: 
- `/settings/admin/crm` — Directory Promotions widget shows active count, revenue, grace period count
- CRM tenant detail page has a "Promotion" tab showing current status and purchase history

### Files

| Purpose | Path |
|---------|------|
| Tenant promotion page | `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx` |
| Tenant analytics page | `apps/web/src/app/t/[tenantId]/settings/promotion/analytics/PromotionAnalyticsClient.tsx` |
| Frontend service | `apps/web/src/services/DirectoryPromotionService.ts` |
| Admin catalog page | `apps/web/src/app/(platform)/settings/admin/promotion-catalog/PromotionCatalogClient.tsx` |
| Admin revenue page | `apps/web/src/app/(platform)/settings/admin/promotion-revenue/PromotionRevenueDashboard.tsx` |
| Backend service | `apps/api/src/services/DirectoryPromotionService.ts` |
| API routes | `apps/api/src/routes/promotion.ts` |
| Renewal job | `apps/api/src/jobs/promotion-renewal.ts` |
| Detailed skill doc | `.devin/skills/directory-promotion-guide.md` |

---

## Common Admin Tasks

### Adding a New Purchasable Item to Any Store

1. **Feature Store (BSaaS)**: Go to `/settings/admin/bsaas-catalog` → Click "Add Feature" → Fill in feature key, name, description, price, billing cycle, trial days → Save
2. **Featured Placement**: Use `adminCreatePlan()` API or the admin service — set plan key, label, surface, duration days, price in cents
3. **Directory Promotion**: Go to `/settings/admin/promotion-catalog` → Click "Create Plan" → Set plan key, label, tier, duration, price → Save
4. **Subscription Tier**: Go to `/settings/admin/tiers` → Create new tier with pricing, SKU limits, features

### Changing Prices

1. **Feature Store**: `/settings/admin/bsaas-catalog` → Edit the catalog entry → Change `price_cents` → Save. Existing purchases keep their original price until renewal.
2. **Featured Placement**: Use `adminUpdatePlan(planKey, { priceCents })` — changes price for new purchases only
3. **Directory Promotion**: `/settings/admin/promotion-catalog` → Edit plan → Change price → Save. Existing purchases keep original price.
4. **Subscription Tier**: `/settings/admin/tiers` → Edit tier → Change `priceMonthly`. Only affects new subscriptions and renewals.

### Deactivating / Removing Items

1. **Feature Store**: Toggle `is_active` to false in the catalog entry — hides it from the store but keeps existing purchases active
2. **Featured Placement**: Use `adminUpdatePlan(planKey, { isActive: false })` — hides from store
3. **Directory Promotion**: Toggle active/inactive in the catalog UI
4. **Full deletion**: Use the delete button in any catalog UI — removes from store, existing purchases remain active until expiry

### Revoking a Purchase from a Tenant

- **Feature Store**: Use the admin feature-purchases API at `/api/admin/feature-purchases` to cancel a tenant's purchase
- **Featured Placement**: `adminRevokePurchase(purchaseId, reason)` — immediately removes the placement
- **Directory Promotion**: Use `deactivatePurchase(purchaseId, 'revoked')` via admin API — clears promotion from directory

### Granting Complimentary Access

- **Feature Store**: `/settings/admin/bsaas-catalog` → Click "Grant Access" → Select tenant and feature → Grant at no cost (`source='admin_grant'`)
- **Subscription Tier**: `/settings/admin/feature-overrides` → Manually enable features for a specific tenant
- **Featured Placement / Directory Promotion**: No complimentary access flow — these are Stripe Checkout-based purchases. Admins can manually activate via backend service calls if needed.

---

## Payment Infrastructure

All 4 stores use the shared Stripe billing infrastructure:

| Component | File |
|-----------|------|
| Subscription Billing Service | `apps/api/src/services/subscription/SubscriptionBillingService.ts` |
| Stripe Webhook Handler | `apps/api/src/routes/stripe-webhooks.ts` |
| Billing Notification Service | `apps/api/src/services/subscription/BillingNotificationService.ts` |
| Payment Methods API | `GET/POST /api/subscription/payment-methods` |

**Payment method requirement**: Tenants must have a saved payment method before purchasing from any store. Payment methods are managed on the Subscription page (`/settings/subscription`).

**Stripe Checkout vs. direct charge**:
- Stores 1 & 2 (Subscription, Feature Store): Direct charge via saved payment method
- Stores 3 & 4 (Featured Placement, Directory Promotion): Stripe Checkout redirect for one-time payment

---

## Navigation Links

All store pages are accessible via:

- **App Store (unified)**: `/t/{tenantId}/settings/store` — tabbed view of all four stores
- **Dashboard**: `StoreAccessCard` component shows all 5 entries (App Store + 4 individual stores)
- **Tenant settings**: "Stores" group in `TenantSettings.tsx` shows App Store + 4 individual store cards
- **Tenant sidebar**: "Featured Store" and "Directory Promotion" links under settings
- **Platform settings**: "Feature Store" and "Subscription" links
- **Admin sidebar**: "BSaaS Catalog", "Promotion Catalog", "Promotion Revenue", "Featured Placement Revenue" links

Navigation is database-driven via the `navigation_links` table. See `.devin/skills/database-navigation-system.md` for adding new links.
