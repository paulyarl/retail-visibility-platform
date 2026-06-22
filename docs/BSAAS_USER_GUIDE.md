# BSaaS (Billing-as-a-Service) — User Guide

A practical guide to the à la carte feature purchasing system on the VisibleShelf platform. This covers the core BSaaS functionality — the feature catalog, self-service purchases, billing, renewals, and admin management.

---

## Table of Contents

1. [What Is BSaaS?](#what-is-bsaas)
2. [Feature Store (Tenant Guide)](#feature-store-tenant-guide)
3. [BSaaS Catalog Management (Admin Guide)](#bsaas-catalog-management-admin-guide)
4. [Purchase Management (Admin Guide)](#purchase-management-admin-guide)
5. [Billing & Renewals](#billing--renewals)
6. [Notifications](#notifications)
7. [Architecture Overview](#architecture-overview)
8. [Quick Reference](#quick-reference)

---

## What Is BSaaS?

BSaaS lets tenants purchase individual features à la carte, outside their subscription tier. This means a tenant on a lower tier can buy specific premium features without upgrading their entire plan.

### How It Works

1. **Admins** add features to the BSaaS Catalog with pricing and billing cycle.
2. **Tenants** browse the Feature Store, select a feature, and pay with a saved payment method.
3. The platform **automatically activates** the feature via the capability resolver.
4. **Renewals** are handled automatically by a daily job.
5. **Admins** can view, manage, and override purchases at any time.

### Three Feature Sources

Features can come from three sources, all merged into a single capability set:

| Source | How It's Granted | Who Controls It |
|--------|-----------------|-----------------|
| **Tier-bundled** | Included in subscription tier | Platform pricing |
| **Purchased (BSaaS)** | Tenant buys via Feature Store | Tenant (self-service) |
| **Admin-granted** | Admin grants complimentary access | Platform admin |

The capability resolver uses a **most-permissive-wins** merge — if any source enables a feature, it's active.

---

## Feature Store (Tenant Guide)

### Accessing the Feature Store

Navigate to **Settings → Feature Store**.

### Browsing Features

The Feature Store displays all active catalog entries as cards. Each card shows:

- **Feature name** and description
- **Price** (e.g., `$19.00/mo`, `$9.00/mo`, `$24.00/mo`)
- **Status badge** if already purchased or included in tier:
  - **Active** — feature is currently active
  - **Suspended** — feature is suspended due to payment failure
  - **In Your Plan** — feature is included in your subscription tier (no purchase needed)
  - **Disabled in Settings** — feature is in your tier but turned off in merchant settings

### Purchasing a Feature

1. Click **Purchase** on the desired feature card.
2. The **Confirm Purchase** modal opens showing:
   - Feature name, price, and description
   - **Payment Method** selector — choose from your saved payment methods
   - **Promo Code** field (optional) — enter a code if you have one
3. Click **Confirm Purchase**.
4. The system charges your payment method and activates the feature immediately.

### After Purchase

- The feature is **instantly active** — no restart or refresh needed.
- The feature card updates to show an **Active** badge.
- A confirmation email is sent.
- For monthly features, the renewal job will automatically charge your payment method each month.

### Cancelling a Feature

1. On an active feature card, click **Cancel**.
2. Confirm the cancellation.
3. The feature remains active until the end of the current billing period.
4. After expiry, the feature is removed from your capabilities.

### Things to Know

- You need at least one **saved payment method** to purchase. Add one in **Settings → Subscription**.
- You cannot purchase a feature that's already active or in trial.
- If a feature is included in your tier, you don't need to purchase it — just enable it in settings.
- Promo codes are validated in real-time with Stripe. Invalid codes will be rejected.

---

## BSaaS Catalog Management (Admin Guide)

### Accessing the Catalog Manager

Navigate to **Settings → Admin → BSaaS Catalog** (under the **Subscriptions** nav section).

### Viewing the Catalog

The catalog table shows all entries with:
- Feature key, marketing name, description
- Price (in cents) and billing cycle
- Trial days (if configured)
- Active/inactive status
- Sort order

### Adding a Catalog Entry

1. Click **Add Feature** (or **New Catalog Entry**).
2. Fill in:
   - **Feature Key** — must match a key in `features_list` (e.g., `chatbot_skill_crm_assistant`)
   - **Marketing Name** — customer-facing display name
   - **Description** — shown in the Feature Store
   - **Price (cents)** — e.g., `1900` for $19.00
   - **Billing Cycle** — `one_time`, `monthly`, or `annual`
   - **Trial Days** — number of free trial days (e.g., `14` for a 14-day trial). Set to `0` for no trial.
   - **Sort Order** — controls display order in the Feature Store (lower = first)
   - **Active** — toggle to make visible in the Feature Store
3. Save.

### Editing a Catalog Entry

- Click **Edit** on any entry to update pricing, description, trial days, or active status.
- Changes take effect immediately for new purchases. Existing purchases are unaffected.

### Deactivating a Feature

- Toggle **Active** to `false` to hide a feature from the Feature Store.
- Existing purchases remain active — this only prevents new purchases.

### Default Catalog Entries

The platform ships with these features pre-seeded:

| Feature Key | Marketing Name | Price | Cycle |
|-------------|---------------|-------|-------|
| `chatbot_skill_crm_assistant` | CRM Assistant Skill | $19.00/mo | monthly |
| `chatbot_external_embed` | External Bot Embed | $9.00/mo | monthly |
| `chatbot_skill_order_tracking` | Order Tracking Skill | $12.00/mo | monthly |
| `chatbot_skill_cross_merchant` | Cross-Merchant Search Skill | $24.00/mo | monthly |

---

## Purchase Management (Admin Guide)

### Accessing Purchase Management

Navigate to **Settings → Admin → Feature Purchases** (or via the admin feature-purchases API).

### Viewing All Purchases

The admin purchases list shows all `tenant_feature_purchases` records with:
- Tenant name and ID
- Feature key
- Status (active, trial, past_due, suspended, expired, cancelled)
- Source (bsaas, admin_grant)
- Price and billing cycle
- Purchase date and expiry date

### Filtering

Purchases can be filtered by:
- **Tenant** — view purchases for a specific tenant
- **Status** — filter by purchase status
- **Feature** — filter by feature key

### Updating a Purchase

Admins can update a purchase's status:

| Action | Effect |
|--------|--------|
| Set to `active` | Feature immediately activated |
| Set to `suspended` | Feature immediately removed |
| Set to `cancelled` | Feature remains active until expiry, then removed |
| Set to `expired` | Feature immediately removed |

### Granting Complimentary Access

Admins can grant a feature to a tenant at no cost:

1. Use the **Grant Complimentary Access** form.
2. Select a tenant and feature.
3. Optionally set an expiry date and notes.
4. The purchase is created with `source='admin_grant'`, `price_cents=0`, `billing_cycle='manual'`.
5. The renewal job will never charge or suspend admin-granted features.

### Revoking a Purchase

- Use the admin API to delete or update the purchase status.
- Cache invalidation happens automatically.

---

## Billing & Renewals

### How Billing Works

| Billing Cycle | Charge Behavior |
|---------------|----------------|
| **one_time** | Single charge at purchase. No renewals. Feature stays active indefinitely. |
| **monthly** | Charged at purchase, then re-charged every 30 days by the renewal job. |
| **annual** | Charged at purchase, then re-charged every 365 days by the renewal job. |

### The Renewal Job

A scheduled job (`bsaas-renewal.ts`) runs **daily at midnight UTC** and performs:

1. **Re-charge expiring purchases** — Finds active purchases where `expires_at` has passed and re-charges the saved payment method.
2. **Process expired trials** — Finds `trial` purchases where the trial period has ended. Attempts to charge → converts to `active` on success, or enters grace period on failure.
3. **Retry past-due purchases** — Finds `past_due` purchases within their 7-day grace period and re-attempts the charge.
4. **Suspend expired grace periods** — Finds `past_due` purchases where the grace period has ended and sets them to `suspended`.
5. **Expire cancelled purchases** — Finds `cancelled` purchases that have reached end of billing period and sets them to `expired`.

### Payment Failures & Grace Period

When a renewal charge fails:

1. Purchase status → `past_due`
2. `grace_ends_at` is set in metadata (current time + 7 days)
3. A `bsaas_grace_period_warning` notification is sent
4. The feature **remains active** during the grace period
5. The renewal job retries the charge daily
6. If the charge succeeds → status returns to `active`
7. If the grace period expires → status becomes `suspended` and the feature is removed

### Admin Intervention

Admins can manually:
- Update a `past_due` purchase to `active` (if payment was collected outside the system)
- Update a `suspended` purchase back to `active` (to restore access)
- Cancel any purchase

---

## Notifications

The platform sends billing notifications for BSaaS events via email, CRM tasks, and CRM alerts:

| Notification Type | When It's Sent |
|-------------------|---------------|
| `bsaas_purchase_success` | Feature purchased successfully |
| `bsaas_renewal_success` | Monthly/annual renewal charge succeeded |
| `bsaas_renewal_failed` | Renewal charge failed |
| `bsaas_grace_period_warning` | Entered grace period after failed renewal |
| `bsaas_trial_started` | Free trial started |
| `bsaas_purchase_cancelled` | Purchase cancelled by tenant or admin |

---

## Architecture Overview

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Tier Features   │  │  Tier Features   │  │ tenant_feature_      │
│  (org-level)     │  │  (tenant-level)  │  │ purchases            │
│                  │  │                  │  │                      │
│  Tier gate       │  │  Tier gate       │  │  Purchased / Grant   │
│  (bundled)       │  │  (bundled)       │  │  (à la carte)        │
└────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘
         │                     │                       │
         └──────────┬──────────┘                       │
                    │  most-permissive-wins            │
                    ▼                                  │
         ┌──────────────────────┐                     │
         │  mergedFeatures Map  │◄────────────────────┘
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Per-domain resolvers│
         │  (chatbot, CRM, etc) │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  EffectiveCapabilities│
         │  (single source of   │
         │   truth)              │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  BotSkillService     │
         │  .isSkillAvailable() │
         └──────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `database/migrations/043_tenant_feature_purchases.sql` | Purchases table |
| `database/migrations/047_bsaas_catalog.sql` | Catalog table with pricing |
| `apps/api/src/routes/bsaas-purchases.ts` | Tenant-facing purchase endpoints |
| `apps/api/src/routes/admin/feature-purchases.ts` | Admin purchase CRUD |
| `apps/api/src/routes/admin/bsaas-catalog.ts` | Admin catalog CRUD |
| `apps/api/src/jobs/bsaas-renewal.ts` | Daily renewal job |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Merges purchases into capabilities |
| `apps/api/src/services/subscription/SubscriptionBillingService.ts` | Stripe payment processing |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | Email/CRM notifications |
| `apps/web/src/app/(platform)/settings/feature-store/page.tsx` | Tenant Feature Store UI |
| `apps/web/src/services/BsaasPurchaseService.ts` | Frontend purchase service |

---

## Quick Reference

### Tenant Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/subscription/feature-catalog` | GET | Browse purchasable features |
| `/api/subscription/feature-purchases` | GET | List tenant's purchases |
| `/api/subscription/feature-purchase` | POST | Purchase a feature |
| `/api/subscription/feature-purchase/:id/cancel` | POST | Cancel a purchase |

### Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/feature-purchases` | GET | List all purchases |
| `/api/admin/feature-purchases` | POST | Create/grant a purchase |
| `/api/admin/feature-purchases/:id` | PUT | Update purchase status |
| `/api/admin/feature-purchases/:id` | DELETE | Revoke a purchase |
| `/api/admin/bsaas-catalog` | GET | List catalog entries |
| `/api/admin/bsaas-catalog` | POST | Add catalog entry |
| `/api/admin/bsaas-catalog?id=` | PUT | Update catalog entry |
| `/api/admin/bsaas-catalog?id=` | DELETE | Remove catalog entry |

### Purchase Statuses

| Status | Feature Active? | Description |
|--------|----------------|-------------|
| `active` | Yes | Paid and current |
| `trial` | Yes | Free trial in progress |
| `past_due` | Yes | Renewal failed, in 7-day grace period |
| `suspended` | No | Grace period expired or payment failed |
| `expired` | No | Cancelled purchase reached end of billing period |
| `cancelled` | Yes (until expiry) | Tenant cancelled, awaiting end of period |

### Admin Navigation

| Nav Link | Section | Purpose |
|----------|---------|---------|
| BSaaS Catalog | Subscriptions | Manage feature pricing and availability |
| Feature Purchases | Subscriptions | View and manage tenant purchases |
| BSaaS Analytics | Subscriptions | Revenue dashboard (see Expansion Guide) |
| BSaaS Promotions | Subscriptions | Coupon & promo code management (see Expansion Guide) |
