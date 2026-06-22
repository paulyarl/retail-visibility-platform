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
│  - feature_key, status, source='bsaas', expires_at       │
│  - metadata: { price_cents, billing_cycle, stripe_* }    │
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

## What's New for Self-Service BSaaS

### 1. Feature Catalog Endpoint
- `GET /api/subscription/feature-catalog` — Returns purchasable features with pricing
- Reads from `features_list` where `metadata.bsaas_price_cents` is set
- Groups by capability domain (chatbot, crm, etc.)

### 2. Tenant-Facing Purchase Endpoint
- `POST /api/subscription/feature-purchase` — Self-service purchase
- Accepts `{ featureKey, paymentMethodId, billingCycle? }`
- Validates feature is BSaaS-eligible
- Charges via Stripe (one-time or recurring)
- Creates `tenant_feature_purchases` row with `source='bsaas'`
- Calls `invalidateEffectiveCapabilities(tenantId)`
- Sends `BillingNotificationService` notification

### 3. Cancel/Suspend Endpoint
- `POST /api/subscription/feature-purchase/:id/cancel` — Cancel a purchase
- Sets `status='cancelled'`, invalidates cache, notifies

### 4. Frontend Purchase Page
- `apps/web/src/app/(platform)/settings/feature-store/page.tsx`
- Shows available features with prices
- Reuses Stripe Elements payment method flow
- Shows active purchases with cancel option

### 5. Webhook Extension
- Extend `stripe-webhooks.ts` to handle BSaaS subscription events
- On `invoice.payment_failed` → suspend purchase
- On `invoice.paid` → reactivate purchase

### 6. Notification Extensions
- New `BillingNotificationType` values: `feature_purchased`, `feature_payment_failed`, `feature_expired`, `feature_canceled`
- Reuse existing email → CRM alert → CRM task pipeline

## Purchase Flow (End-to-End)

```
1. Merchant visits /settings/feature-store
2. Sees catalog of purchasable features (e.g., "CRM Assistant Skill — $19/mo")
3. Clicks "Add" on a feature
4. Selects existing payment method or enters new card (Stripe Elements)
5. Frontend calls POST /api/subscription/feature-purchase
   { featureKey: 'chatbot_skill_crm_assistant', paymentMethodId: 'pm_xxx' }
6. Backend:
   a. Validate feature exists in features_list and has BSaaS pricing
   b. Get payment method via SubscriptionBillingService
   c. Charge via Stripe (one-time or create subscription)
   d. Upsert tenant_feature_purchases (status=active, source=bsaas)
   e. invalidateEffectiveCapabilities(tenantId)
   f. BillingNotificationService.sendNotification({ type: 'feature_purchased' })
7. Frontend refreshes capabilities → feature is now available
8. Bot skill endpoints return 200 instead of 403
```

## Pricing Model

Feature pricing is stored in `features_list.metadata`:

```json
{
  "bsaas_price_cents": 1900,
  "bsaas_billing_cycle": "monthly",
  "bsaas_trial_days": 0,
  "bsaas_marketing_name": "CRM Assistant Skill",
  "bsaas_description": "AI-powered support ticket creation and CRM context injection"
}
```

Features without `bsaas_price_cents` in metadata are not available for self-service purchase (admin-only grant).

## File Reference

| File | Purpose |
|------|---------|
| `apps/api/src/routes/subscription-billing.ts` | Existing subscription routes (mount point) |
| `apps/api/src/services/subscription/SubscriptionBillingService.ts` | Billing service (reused for payment methods + Stripe) |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | Notification service (extended with feature_* types) |
| `apps/api/src/routes/admin/feature-purchases.ts` | Admin CRUD for feature purchases |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Automatic merge of purchases into capabilities |
| `apps/api/src/routes/stripe-webhooks.ts` | Stripe webhook handler (extended for BSaaS) |
| `apps/web/src/app/(platform)/settings/subscription/page.tsx` | Existing subscription page (pattern reference) |
| `apps/web/src/components/subscription/SelfServiceBilling.tsx` | Existing billing UI (pattern reference) |

## Related Documents

- **`add-bsaas-feature.md`** — How to add a purchasable feature to the platform
- **`docs/BSAAS_PHASED_PLAN.md`** — Original phased plan (Phases 1-5, all complete)
- **`docs/BSAAS_PURCHASE_PHASED_PLAN.md`** — Phased plan for self-service purchase flow
