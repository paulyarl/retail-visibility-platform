# BSaaS Self-Service Purchase Flow — Phased Implementation Plan

> Enabling tenants to purchase à la carte features (bot skills, external embed, CRM) via self-service checkout, reusing the existing subscription billing infrastructure.

---

## Overview

The platform already has:
- **Subscription billing** — Self-service tier purchase via Stripe/PayPal with payment methods, invoices, and notifications
- **Feature purchases table** — `tenant_feature_purchases` with admin CRUD API
- **Automatic capability resolution** — `EffectiveCapabilityResolver` merges active purchases into capabilities

What's missing is the **tenant-facing purchase flow** — letting merchants buy features themselves instead of requiring admin action.

---

## Phase 1: Backend Purchase API

**Goal:** Create tenant-facing endpoints for browsing purchasable features and completing self-service purchases.

### Deliverables

1. **Feature catalog endpoint** — `GET /api/subscription/feature-catalog`
   - Returns features from `features_list` where `metadata.bsaas_price_cents` is set
   - Groups by capability domain
   - Shows current purchase status for the calling tenant

2. **Purchase endpoint** — `POST /api/subscription/feature-purchase`
   - Accepts `{ featureKey, paymentMethodId }`
   - Validates feature is BSaaS-eligible
   - Charges via Stripe using existing `SubscriptionBillingService` payment method
   - Creates `tenant_feature_purchases` row with `source='bsaas'`
   - Calls `invalidateEffectiveCapabilities(tenantId)`
   - Sends notification via `BillingNotificationService`

3. **Cancel endpoint** — `POST /api/subscription/feature-purchase/:id/cancel`
   - Sets `status='cancelled'`
   - Invalidates cache
   - Sends cancellation notification

4. **List tenant purchases** — `GET /api/subscription/feature-purchases`
   - Returns active purchases for the calling tenant

### Verification
- `npx tsc --noEmit` passes on both apps
- Manual test: call `GET /api/subscription/feature-catalog` → returns features with pricing
- Manual test: call `POST /api/subscription/feature-purchase` with valid payment method → purchase created, capabilities updated

---

## Phase 2: Frontend Purchase Page

**Goal:** Create a self-service feature store page where merchants can browse and purchase add-on features.

### Deliverables

1. **Feature store page** — `apps/web/src/app/(platform)/settings/feature-store/page.tsx`
   - Feature catalog grid with pricing, descriptions, and "Add" buttons
   - Shows active purchases with status and cancel option
   - Reuses Stripe Elements payment method flow from `SelfServiceBilling.tsx`
   - Capability-aware: shows which features are already in tier vs. purchasable

2. **API hooks** — `useFeatureCatalog`, `useFeaturePurchases`, `usePurchaseFeature`
   - React Query hooks for catalog, purchases, and purchase action

3. **Navigation** — Add link to feature store from subscription page and settings sidebar

### Verification
- `npx tsc --noEmit` passes on both apps
- Manual test: visit `/settings/feature-store` → see catalog → purchase a feature → capabilities update

---

## Phase 3: Billing Integration

**Goal:** Wire BSaaS purchases into the billing and notification infrastructure.

### Deliverables

1. **Stripe recurring billing** — Create Stripe subscription for monthly BSaaS features
   - Use `SubscriptionBillingService.getOrCreateStripeCustomer()`
   - Create Stripe subscription with feature-specific price
   - Store `stripe_subscription_id` in purchase metadata

2. **Webhook extension** — Extend `stripe-webhooks.ts`
   - On `invoice.payment_failed` for BSaaS subscription → set `status='suspended'`
   - On `invoice.paid` → set `status='active'`
   - Call `invalidateEffectiveCapabilities(tenantId)` on every change

3. **Notification types** — Extend `BillingNotificationService`
   - `feature_purchased` — "You've added {feature name}"
   - `feature_payment_failed` — "Payment failed for {feature name}"
   - `feature_canceled` — "Your {feature name} has been canceled"
   - `feature_expired` — "Your {feature name} has expired"

4. **Expiry job** — Scheduled task calling `expire_feature_purchases()` SQL function
   - Send `feature_expired` notification on expiry

### Verification
- Manual test: purchase monthly feature → Stripe subscription created → webhook updates status
- Manual test: fail payment → purchase suspended → feature removed from capabilities
- Manual test: cancel purchase → Stripe subscription canceled → notification sent

---

## Phase 4: Admin Dashboard

**Goal:** Give platform admins visibility into BSaaS revenue and purchase management.

### Deliverables

1. **Admin feature store dashboard** — Revenue summary, purchase trends, top features
2. **Purchase management** — Extend existing admin feature-purchases CRUD with revenue analytics
3. **Pricing management** — Admin UI to set/update `bsaas_price_cents` in feature metadata

### Verification
- Admin can see total BSaaS revenue, active subscriptions, churn rate
- Admin can update feature pricing
