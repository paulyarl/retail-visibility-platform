# Subscription Management (v3.5.1)

Quick implementation of subscription status and billing management for revenue generation.

## Overview

Adds subscription tracking to enable revenue generation before full IAP (v3.6) implementation.

## Features

### 1. Subscription Status Tracking
- **Trialing**: 14-day free trial for new tenants with full access within tier limits.
- **Active**: Paid subscription in good standing.
- **Past Due**: Payment failed; within grace period, access still allowed but with warnings and prompts to update billing.
- **Maintenance**: Limited maintenance window for the internal `google_only` fallback tier; tenants can maintain existing catalog and visibility but cannot grow it.
- **Frozen**: Read-only visibility mode after the maintenance window ends or when a subscription is canceled/fully expired; storefront/directory/Google remain online but no edits or syncs are allowed.
- **Canceled / Expired**: Subscription ended by user or due to non-payment; treated as frozen for access until upgraded.

> The precise lifecycle and mapping from Stripe status to these internal
> statuses is defined in the **Status Lifecycle & Stripe Mapping** section
> below.

### 2. Subscription Tiers

> Canonical tier definitions come from `TIER_MODEL_V2_SIMPLIFIED.md`. This
> section summarizes them for API purposes.

#### Starter - $29/month
- Up to **3 locations**.
- Up to **500 SKUs per location**.
- Storefront + Google Shopping + platform directory listing.
- Basic analytics and email support.

#### Professional - $99/month
- Up to **10 locations**.
- Up to **5,000 SKUs per location**.
- Everything in Starter.
- Clover & Square POS integrations.
- Advanced analytics and priority support.

#### Enterprise - $499/month
- Up to **25 locations**.
- Up to **10,000+ SKUs per location**.
- Everything in Professional.
- API access, white-label storefront options, dedicated account manager, SLA-backed support.

#### Organization - Custom pricing
- **Unlimited locations** and effectively unlimited SKUs (bounded only by technical constraints).
- Chain/organization dashboard, full propagation tooling, organization-level billing.
- Custom contracts and pricing; sales-led.

### 3. Access Control
- Middleware blocks access if subscription expired
- Automatic limit enforcement per tier
- Grace period for payment failures

## API Endpoints

### GET /subscriptions/status?tenantId={id}
Get subscription status and usage for a tenant.

**Response:**
```json
{
  "tenant": {
    "id": "tenant_123",
    "name": "Acme Corp"
  },
  "subscription": {
    "status": "trial",
    "tier": "starter",
    "trialEndsAt": "2025-11-23T00:00:00Z",
    "daysRemaining": 28,
    "hasStripeAccount": false
  },
  "usage": {
    "items": {
      "current": 45,
      "limit": 500,
      "percentage": 9
    },
    "users": {
      "current": 2,
      "limit": 3,
      "percentage": 67
    }
  }
}
```

### PATCH /subscriptions/update
Update subscription status (admin only).

**Request:**
```json
{
  "tenantId": "tenant_123",
  "subscriptionStatus": "active",
  "subscriptionTier": "pro",
  "subscriptionEndsAt": "2025-12-23T00:00:00Z",
  "stripeCustomerId": "cus_abc123",
  "stripeSubscriptionId": "sub_xyz789"
}
```

### GET /subscriptions/pricing
Get available pricing tiers (Starter, Professional, Enterprise, Organization) and
their current limits (locations + SKUs per location).

### POST /subscriptions/checkout-session
Create a Stripe Checkout session for self-service signup or upgrade.

**Request (example):**
```json
{
  "tenantId": "tenant_123",
  "tier": "professional",
  "billingInterval": "month" // or "year"
}
```

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/session_abc",
  "sessionId": "cs_test_123"
}
```

### POST /subscriptions/billing-portal-session
Create a Stripe Billing Portal session so an existing customer can manage
payment methods, invoices, and cancellations.

**Request (example):**
```json
{
  "tenantId": "tenant_123"
}
```

**Response:**
```json
{
  "portalUrl": "https://billing.stripe.com/session/xyz"
}
```

## Middleware

### requireActiveSubscription
Checks `Tenant.subscriptionStatus` before allowing access.

- Allows access for `trialing` and `active`.
- May allow `past_due` during a configurable grace period (UI should surface
  warnings).
- Should be combined with more granular write guards (e.g.
  `requireWritableSubscription`) to respect `maintenance` vs `frozen` modes
  described in the tier model.
- Returns `402 Payment Required` when the status indicates that billing action
  is required (e.g. `expired`, `frozen`, `canceled`) so the frontend can direct
  users to upgrade/manage billing.

**Usage:**
```typescript
app.get("/items", requireActiveSubscription, async (req, res) => {
  // Only accessible with active subscription
});
```

### checkSubscriptionLimits
Enforces tier limits based primarily on **locations** and **SKUs per
location** for the current `subscriptionTier` (see tier model doc). Items/users
can still be used as soft caps or advisory limits where needed.

**Usage:**
```typescript
app.post("/items", checkSubscriptionLimits, async (req, res) => {
  // Blocks if tier limit reached
});
```

## Database Schema

The API keeps a **denormalized view** of subscription state on the `Tenant` and a
separate `Subscription` table for provider-specific details (Stripe).

```prisma
model Tenant {
  // ... existing fields ...

  /// High-level subscription state used by middleware
  subscriptionStatus       String?   @default("trial")   // 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'maintenance' | 'frozen'
  subscriptionTier         String?   @default("starter") // 'starter' | 'professional' | 'enterprise' | 'organization' | 'google_only'
  trialEndsAt              DateTime?
  subscriptionEndsAt       DateTime?                     // optional; legacy end date if manually managed
  maintenanceBoundaryAt    DateTime?                     // 6-month maintenance window boundary for google_only fallback
  subscriptionRenewalAt    DateTime?                     // current period end from Stripe

  /// Billing provider linkage (Stripe-first, but can support more later)
  billingProvider          String?                       // e.g. 'stripe'
  stripeCustomerId         String?   @unique
  stripeSubscriptionId     String?   @unique

  subscriptions            Subscription[]                // history
}

model Subscription {
  id                      String   @id @default(cuid())

  tenant                  Tenant   @relation(fields: [tenantId], references: [id])
  tenantId                String

  provider                String   // 'stripe'
  providerCustomerId      String
  providerSubscriptionId  String   @unique

  /// Denormalized tier + raw provider status
  tier                    String   // matches Tenant.subscriptionTier
  status                  String   // raw Stripe status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | ...

  currentPeriodStart      DateTime?
  currentPeriodEnd        DateTime?
  cancelAtPeriodEnd       Boolean  @default(false)
  canceledAt              DateTime?

  priceId                 String?
  currency                String?
  amount                  Int?     // in minor units (cents)

  raw                     Json?    // snapshot of Stripe subscription payload

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

The webhook handler is responsible for:

- Upserting into `Subscription` using `providerSubscriptionId`.
- Deriving `Tenant.subscriptionStatus`, `Tenant.subscriptionTier`,
  `Tenant.trialEndsAt`, `Tenant.maintenanceBoundaryAt`, and
  `Tenant.subscriptionRenewalAt` from the Stripe payload.

`requireActiveSubscription` / `checkSubscriptionLimits` should always read from
the **Tenant** fields so that authorization stays fast and provider-agnostic.

### Status Lifecycle & Stripe Mapping

The API maintains a small internal state machine for subscription status. The
high-level states and behaviors are:

| Internal Status | Description | Typical Access |
|-----------------|-------------|----------------|
| `trialing`      | 14-day free trial with full access within tier limits. | Full read/write, limited by tier caps. |
| `active`        | Paid subscription in good standing. | Full read/write, limited by tier caps. |
| `past_due`      | Payment failed but within grace period. | Read/write allowed; UI should prompt to fix billing. |
| `maintenance`   | `google_only` fallback within 6-month maintenance window. | Maintenance operations only (edit existing products/profile, run syncs for existing SKUs); no new locations/SKUs. |
| `frozen`        | Outside maintenance window or hard cancellation/expiry. | Read-only; storefront/directory/Google remain online but no edits or syncs. |
| `canceled`      | Subscription explicitly canceled. | Treated as `frozen` for access; no new billing. |
| `expired`       | Trial or maintenance window fully over without upgrade. | Treated as `frozen` until upgraded. |

Stripe subscription statuses are mapped to internal statuses as follows:

| Stripe `subscription.status` | Internal `subscriptionStatus` (baseline) |
|------------------------------|------------------------------------------|
| `trialing`                   | `trialing`                               |
| `active`                     | `active`                                 |
| `past_due`                   | `past_due`                               |
| `unpaid`                     | `past_due` or `canceled` (depending on business rules) |
| `canceled`                   | `canceled`                               |

On top of this, the `google_only` fallback tier uses
`Tenant.maintenanceBoundaryAt` to determine `maintenance` vs `frozen`:

- If `subscriptionTier = 'google_only'` and `now < maintenanceBoundaryAt`
  (or `trialEndsAt` if no explicit boundary), set `subscriptionStatus = 'maintenance'`.
- If `subscriptionTier = 'google_only'` and `now >= maintenanceBoundaryAt`, set
  `subscriptionStatus = 'frozen'`.

Additionally, when a trial ends (`now >= trialEndsAt`) and there is no active
paid subscription, the system should move the tenant to either a
`google_only`+`maintenance` state (if explicitly chosen) or directly to
`expired`/`frozen`.

### Stripe Webhooks

Stripe webhooks are responsible for keeping `Subscription` and `Tenant` in sync.

Recommended events to subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

High-level responsibilities:

- **checkout.session.completed**
  - Look up the tenant by metadata (e.g. `tenantId` on the Checkout Session).
  - Store `stripeCustomerId` and `stripeSubscriptionId` on `Tenant` if not
    already present.
  - Create or update the corresponding `Subscription` row.

- **customer.subscription.created / updated**
  - Upsert `Subscription` using `providerSubscriptionId`.
  - Derive `tier` from the active `price` metadata (e.g.
    `price.metadata.tier = 'starter' | 'professional' | ...`).
  - Update `Tenant.subscriptionTier`, `Tenant.subscriptionStatus`, and
    `Tenant.subscriptionRenewalAt`/`trialEndsAt` using the mapping above.

- **customer.subscription.deleted**
  - Mark `Subscription.status = 'canceled'` and set
    `Tenant.subscriptionStatus = 'canceled'`.

- **invoice.payment_failed**
  - Set `Tenant.subscriptionStatus = 'past_due'`.
  - Trigger email reminders and surface billing issues in the UI.

Webhook handlers should be **idempotent** (e.g. by recording Stripe `event.id`
in a separate table or ensuring `providerSubscriptionId` uniqueness) and
should log failures for later inspection.

## Implementation Phases

### Phase 1: Manual Billing (Week 1)
1. Customer signs up → create `Tenant` with `subscriptionStatus = 'trialing'`,
   `subscriptionTier` chosen at signup, and `trialEndsAt = now + 14 days`.
2. Operations sends an invoice manually (Stripe/PayPal/other).
3. Admin calls `PATCH /subscriptions/update` to set `subscriptionStatus = 'active'`,
   `subscriptionTier` (Starter/Professional/Enterprise/Organization), and
   optionally `subscriptionEndsAt`.
4. Middleware (`requireActiveSubscription` / `checkSubscriptionLimits`) uses the
   denormalized Tenant fields to gate access.

**Engineering checklist (Phase 1)**
- [ ] Add new subscription fields to `Tenant` model and run migrations.
- [ ] Implement `GET /subscriptions/status` and `PATCH /subscriptions/update` handlers.
- [ ] Implement `requireActiveSubscription` and `checkSubscriptionLimits` middleware using Tenant fields.
- [ ] Add minimal admin UI/CLI for viewing and updating subscription status/tier.

### Phase 2: Stripe Integration (Week 2-3)
1. When a tenant visits `/settings/subscription`, if `stripeCustomerId` is not
   set, create a Stripe Customer and store `billingProvider = 'stripe'` and
   `stripeCustomerId` on `Tenant`.
2. Expose `POST /subscriptions/billing-portal-session` to create a Stripe
   Billing Portal session and return `portalUrl`.
3. Customer manages payment in the Billing Portal; operations can still use
   `PATCH /subscriptions/update` for manual activation while webhooks are being
   wired up.
4. Start wiring Stripe webhooks to keep the `Subscription` table in sync (even
   if decisions are still manual).

**Engineering checklist (Phase 2)**
- [ ] Configure Stripe account, Products/Prices with `metadata.tier`.
- [ ] Implement helper to create Stripe Customer on first visit to `/settings/subscription`.
- [ ] Implement `POST /subscriptions/billing-portal-session` endpoint.
- [ ] Implement basic Stripe webhook receiver (logging-only or minimal upsert to `Subscription`).
- [ ] Surface "Manage billing" button in the web app that calls the billing portal endpoint.

### Phase 3: Semi-Automated (Week 4)
1. Subscribe to `customer.subscription.updated` and `invoice.payment_failed`
   webhooks and update `Tenant.subscriptionStatus` according to the mapping
   above (e.g. `past_due` on payment failure, `canceled` when canceled).
2. Implement **auto-suspend semantics** by treating certain internal statuses
   (`expired`, `frozen`, `canceled`) as hard blocks in
   `requireActiveSubscription` / `requireWritableSubscription`.
3. Add email notifications and in-app banners when status changes to
   `past_due`, `maintenance`, or `frozen` (see SubscriptionStatusGuide on the
   web app).
4. Keep the Billing Portal link exposed in the UI to let customers fix
   payment issues without contacting support.

**Engineering checklist (Phase 3)**
- [ ] Subscribe to and handle `customer.subscription.updated` and `invoice.payment_failed` events.
- [ ] Implement mapping from Stripe status → internal status (`trialing`, `active`, `past_due`, `canceled`, etc.).
- [ ] Implement `google_only` maintenance/freeze transition rules using `maintenanceBoundaryAt`.
- [ ] Update `requireActiveSubscription` / `requireWritableSubscription` to treat `expired`/`frozen`/`canceled` as hard blocks.
- [ ] Integrate email service for `past_due` and freeze notifications.
- [ ] Wire SubscriptionStatusGuide into key UI surfaces (dashboard, settings) to show current status.

### Phase 4: Full IAP (v3.6+)
1. Self-service signup:
   - Pricing page → signup flow chooses initial `subscriptionTier`.
   - Backend creates Checkout Session via `POST /subscriptions/checkout-session`.
   - On `checkout.session.completed`, webhook finds/creates `Tenant`, links
     Stripe customer/subscription, and sets `subscriptionStatus = 'active'`.
2. Instant activation:
   - No manual `/subscriptions/update` calls required once webhook wiring is
     trusted.
3. Usage-based billing (optional/phase 4b):
   - Track location/SKU usage per tenant.
   - Optionally report usage to Stripe for metered billing, or use thresholds
     to trigger upgrade prompts.
4. Automatic scaling (optional/phase 4c):
   - Use `checkSubscriptionLimits` and usage metrics to recommend or
     auto-enforce tier changes (with clear UI/notifications).

**Engineering checklist (Phase 4)**
- [ ] Implement `POST /subscriptions/checkout-session` endpoint and wire pricing page/upgrade flows to it.
- [ ] Handle `checkout.session.completed` webhook to create/link Tenant ↔ Stripe customer/subscription and set `subscriptionStatus = 'active'`.
- [ ] Remove reliance on manual `/subscriptions/update` for normal flows (keep only for admin overrides).
- [ ] Implement usage tracking for locations and SKUs per tenant.
- [ ] (Optional) Define and implement a metered or usage-based billing strategy with Stripe.
- [ ] (Optional) Implement auto-suggested or enforced tier changes based on usage.

## Usage Examples

### Check Subscription Before Operation
```typescript
import { requireActiveSubscription } from './middleware/subscription';

app.post("/items", requireActiveSubscription, async (req, res) => {
  // Create item - only if subscription active
});
```

### Get Subscription Status
```bash
curl http://localhost:4000/subscriptions/status?tenantId=tenant_123
```

### Update Subscription (Admin)
```bash
curl -X PATCH http://localhost:4000/subscriptions/update \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_123",
    "subscriptionStatus": "active",
    "subscriptionTier": "pro",
    "subscriptionEndsAt": "2025-12-23T00:00:00Z"
  }'
```

## Error Responses

### 402 Payment Required
```json
{
  "error": "trial_expired",
  "message": "Your trial has expired. Please subscribe to continue.",
  "tenant": {
    "id": "tenant_123",
    "name": "Acme Corp",
    "status": "trial_expired",
    "trialEndsAt": "2025-10-23T00:00:00Z"
  }
}
```

### 402 Limit Reached
```json
{
  "error": "item_limit_reached",
  "message": "You've reached the starter plan limit of 500 items. Please upgrade.",
  "limit": 500,
  "current": 500,
  "tier": "starter"
}
```

## Next Steps

1. ✅ Run migration to add subscription fields
2. ✅ Regenerate Prisma Client
3. ✅ Test subscription endpoints
4. 🔄 Add middleware to protected routes
5. 🔄 Create admin UI for subscription management
6. 🔄 Set up Stripe integration
7. 🔄 Add email notifications

## Migration

```bash
# Apply migration
cd apps/api
$env:DATABASE_URL="postgresql://..."
npx prisma migrate deploy

# Or for development
npx prisma migrate dev --name add_subscription_fields
```

## Notes

- All existing tenants get a 14-day trial automatically (unless otherwise
  grandfathered)
- Subscription checks are optional (can be added gradually)
- Stripe integration is prepared but not required
- Full IAP coming in v3.6
