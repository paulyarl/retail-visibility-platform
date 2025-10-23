# Tenant Management & IAP — v3.6 Spec Pack (Tiers, Boosters, Status, In‑App Purchases)

**Version:** v3.6-tm-iap-draft-1  
**Editor:** Retail Spec & Outreach GPT  
**Date:** 2025-10-23  
**Status:** 📋 Planned for v3.6  
**Parents:** REQ-2025-803 (Tier Automation), REQ-2025-802 (Policy Versioning), REQ-2025-801 (Audit Logging), REQ-2025-601 (Google OAuth & Feed Push)  
**Related:** v3.4 SWIS schema, `tenant_sku_counters`, `v_effective_sku_billing_policy`

---

## 0) Changelog
| Date | Version | Change | Editor |
|---|---|---|---|
| 2025-10-23 | v3.6-tm-iap-draft-1 | Initial tenant management + IAP integration spec | RVP-GPT |
| 2025-10-23 | v3.6-tm-iap-draft-1 | Saved to repo for future implementation | Cascade |

---

## 1) Objectives & Non-Goals

**Objectives**  
- Self-serve **upgrade/downgrade** between tiers with proration.  
- **Boosters** (à-la-carte capacity/features) purchase & management.  
- Tenant **status lifecycle**: active ↔ inactive ↔ suspended, with auditable transitions.  
- **In-app purchases (IAP)** via Stripe Payment Element (cards, Apple Pay, Google Pay) and hosted checkout.  
- Real-time **entitlements engine** computed from tier + boosters + policy version.  
- Full **auditability**, **RLS**, and **observability**.

**Non-Goals (v3.6):** Marketplace revenue share, multi-org cross-tenant pooling (planned v3.7+).

---

## 2) Data Model & Migrations (PostgreSQL)

### 2.1 Catalog & Subscription Tables

```sql
-- Plans
CREATE TABLE IF NOT EXISTS tenant_plan_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                 -- LITE, STD, PLUS, ENT
  name text NOT NULL,
  price_monthly_cents integer NOT NULL,
  price_yearly_cents integer NOT NULL,
  features jsonb NOT NULL DEFAULT '{}',      -- {"search_pro":true}
  limits jsonb   NOT NULL DEFAULT '{}',      -- {"billable_skus":200,"users":2}
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Boosters (add-ons)
CREATE TABLE IF NOT EXISTS tenant_booster_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                 -- BOOST_SKU_500, BOOST_SEARCH_PRO
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('one_time','recurring')),
  price_cents integer NOT NULL,
  payload jsonb NOT NULL,                    -- {"billable_skus":500} or {"search_pro":true}
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Current subscription (one row per tenant)
CREATE TABLE IF NOT EXISTS tenant_subscription (
  tenant_id uuid PRIMARY KEY,
  plan_code text NOT NULL REFERENCES tenant_plan_catalog(code),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  status text NOT NULL CHECK (status IN ('active','canceled','past_due')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  external_ref text,                          -- Stripe subscription id
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Booster purchases
CREATE TABLE IF NOT EXISTS tenant_booster_purchase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  booster_code text NOT NULL REFERENCES tenant_booster_catalog(code),
  type text NOT NULL CHECK (type IN ('one_time','recurring')),
  qty integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('pending','active','canceled','expired')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  external_ref text,                          -- Stripe item/invoice id
  audit_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tbp_tenant ON tenant_booster_purchase(tenant_id);

-- Tenant status transitions
CREATE TABLE IF NOT EXISTS tenant_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  from_status text NOT NULL CHECK (from_status IN ('active','inactive','suspended')),
  to_status   text NOT NULL CHECK (to_status   IN ('active','inactive','suspended')),
  reason_code text NOT NULL,                  -- non_payment, policy_violation, user_request
  notes text,
  actor_type text NOT NULL CHECK (actor_type IN ('user','system','admin')),
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tsh_tenant_time ON tenant_status_history(tenant_id, occurred_at DESC);

-- Computed entitlements cache
CREATE TABLE IF NOT EXISTS tenant_entitlements_cache (
  tenant_id uuid PRIMARY KEY,
  computed_at timestamptz NOT NULL,
  limits jsonb NOT NULL,
  features jsonb NOT NULL,
  policy_version_ref text NOT NULL
);
```

### 2.2 Effective Views

```sql
-- Merge tier + boosters + policy view reference (compute in service; store snapshot here)
CREATE OR REPLACE VIEW v_tenant_billing_snapshot AS
SELECT e.tenant_id,
       e.limits,
       e.features,
       e.policy_version_ref,
       c.active_total,
       c.active_public,
       c.active_private,
       c.active_billable
FROM tenant_entitlements_cache e
JOIN tenant_sku_counters c ON c.tenant_id = e.tenant_id;
```

### 2.3 RLS (outline)

```sql
ALTER TABLE tenant_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_tenant_rw ON tenant_subscription
  USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- Repeat analogous RLS for booster_purchase and entitlements_cache
```

---

## 3) Entitlements Engine

- Inputs: `tenant_subscription.plan_code.limits`, SUM(payload) from active `tenant_booster_purchase`, policy snapshot from `v_effective_sku_billing_policy`.
- Output: `{limits:{billable_skus, users, ...}, features:{...}, policy_version_ref}` persisted in `tenant_entitlements_cache`.
- Refresh triggers:
  - On purchase/renewal/cancel webhooks
  - On policy version change
  - On manual admin change
  - Nightly reconciliation job

Pseudo:
```ts
function computeEntitlements(tenantId){
  const plan = getPlanLimits(tenantId);
  const boosters = sumActiveBoosters(tenantId);
  const limits = mergeNumeric(plan.limits, boosters.payload);
  const features = unionFlags(plan.features, boosters.flags);
  const policyRef = currentPolicyRef();
  upsertEntitlementsCache(tenantId, limits, features, policyRef);
}
```

---

## 4) IAP Integration (Stripe + Apple Pay/Google Pay)

### 4.1 Product Catalog Sync
- Mirror `tenant_plan_catalog` and `tenant_booster_catalog` to Stripe **Products/Prices**.  
- One product per plan/booster; monthly/yearly prices; boosters may have one-time or recurring prices.

### 4.2 Checkout & Billing Flows
- **Hosted Checkout Session** for upgrades/downgrades & booster purchases.  
- **Payment Element** (in-app) for saved payment methods and one-time boosters.  
- **Proration**: set `proration_behavior='always_invoice'` for mid-cycle upgrades; schedule downgrades at period end.

### 4.3 Webhooks (Required)
- `checkout.session.completed`: mark booster/subscription pending→active; compute entitlements.  
- `customer.subscription.updated`: reflect plan changes, status, current period end.  
- `invoice.paid` / `invoice.payment_failed`: dunning → suspend if needed.  
- `customer.subscription.deleted`: status → canceled; compute entitlements.

**Security**: verify signatures; idempotency keys per operation; store `external_ref` ids.

### 4.4 API Contracts (Server)

```http
POST /iap/checkout/session
  body: { kind: "plan|booster", code: string, billing_cycle?: "monthly|yearly", qty?: number, returnUrl: string }
  resp: { url: string }  # redirect URL (hosted checkout)

POST /iap/payment-intent
  body: { boosterCode: string, qty: number }
  resp: { clientSecret: string }

POST /iap/webhooks/stripe
  headers: { Stripe-Signature }
  body: raw  # do not JSON parse before verify
  effects: upsert subscription/booster; recompute entitlements; audit
```

### 4.5 Admin & Tenant APIs

```http
GET  /tenant/entitlements                # cached limits/features
GET  /tenant/billing/snapshot            # joins counters; UI card source
POST /tenant/plan/preview                # returns proration diff
POST /tenant/plan/upgrade                # creates hosted checkout session
POST /tenant/plan/downgrade              # schedules change at renewal; audit
POST /tenant/booster/purchase            # hosted checkout/payment element
POST /tenant/status                      # {to_status, reason_code}
```

### 4.6 Proration Logic
- Upgrade now: create subscription update with proration; entitlement apply **immediately** after `invoice.paid`.  
- Downgrade: store `pending_downgrade` record; apply at `current_period_end`; block if usage > target cap unless booster added.

### 4.7 Dunning & Suspension
- On `invoice.payment_failed` start dunning (email/in-app).  
- After N failures or grace end ⇒ set tenant status to **suspended** (write `tenant_status_history`) and revoke publishing scopes.  
- On payment recovery ⇒ **reactivate**.

---

## 5) UX/Flows (Key Screens)

- **Plan Selector Modal**: plan cards, feature compare, monthly/yearly toggle, proration preview.  
- **Booster Drawer**: pick quantity, price calc, confirm; shows new cap.  
- **Counters Card**: usage bar (e.g., 312/300), CTA: *Add 500 SKUs* (booster) or *Upgrade Plan*.  
- **Status Banner**: inactive/suspended with action button (Pay now / Appeal).  
- **Receipts & Activity**: purchase history, invoices (PDF link), entitlement changes.

Accessibility: WCAG 2.1 AA; keyboard navigable; receipts downloadable; localization ready.

---

## 6) Observability & Audit

- Metrics: `iap_checkout_created_total`, `iap_webhook_errors_total`, `entitlement_compute_latency_ms_p95`, `plan_change_success_rate`, `overage_events_total`.  
- Logs: request_id propagation; Stripe event id; tenant_id; diff objects redacted for PII.  
- Dashboards: **Billing & Entitlements**, **Dunning & Suspension**, **IAP Health**.  
- Audit: every plan/booster/status change → `audit_log` + link IDs; exportable CSV.

---

## 7) CI/CD & Safety

- **Feature Flags**: `FF_IAP`, `FF_TIER_AUTOMATION`, `FF_DOWNGRADE_SAFEGUARD`.  
- **Contract Tests**: proration math, overlap prevention, downgrade guard with over-cap.  
- **Replay-safe Webhooks**: enforce idempotency via event id store.  
- **Rollback**: disable FFs; keep data; revert plan to previous code; re-compute entitlements.

---

## 8) Acceptance Criteria

- 100% IAP events result in correct subscription/booster state and entitlement recomputation.  
- Upgrade applies within **≤5s** after payment confirmation.  
- Downgrade cannot schedule while over cap unless booster added.  
- Suspension triggers on dunning policy and fully reverses on payment.  
- Audit logs present for all changes; P95 entitlement read <200ms.

---

## 9) Rollout Plan (3–5 weeks)

| Week | Focus | Milestones |
|---|---|---|
| 1 | Schema + Catalog | Migrations + Stripe product sync script |
| 2 | Checkout + Webhooks | Hosted checkout + webhook handlers + idempotency store |
| 3 | Entitlements Engine | Cache + snapshot view + UI counters card |
| 4 | Downgrade Safeguards | Pre-flight checks + scheduled changes |
| 5 | Dunning + Suspension | Policy + alerts + reactivation path; hardening + docs |

---

## 10) Open Questions

- Booster **stacking limits** (max qty?)  
- **Annual → Monthly** downgrade proration policy?  
- Enterprise custom contracts (seat-based + SKU pool)?  
- Regional taxes/VAT invoices per jurisdiction (OSS/MOSS config).

---

## 11) Dependencies

### Required from v3.5 (Already Implemented ✅)
- `tenant_sku_counters` view
- `sku_billing_policy_history` table
- `v_effective_sku_billing_policy` view
- `audit_log` table and middleware
- Tenant model with metadata

### New Dependencies for v3.6
- Stripe account with webhook endpoint
- Payment processing compliance (PCI)
- Email service for dunning notifications
- Invoice generation service

---

## 12) Success Metrics

- **Conversion Rate**: % of free → paid upgrades
- **Booster Adoption**: % of tenants with active boosters
- **Churn Rate**: % of downgrades/cancellations
- **Payment Success**: % of successful transactions
- **Dunning Recovery**: % of recovered failed payments
- **Support Tickets**: Billing-related support volume

---

## 13) Related Documents

- `NEXT_STEPS_V3.5.md` - Current implementation status
- `apps/api/V3.5_API_IMPLEMENTATION.md` - API documentation
- `apps/api/prisma/migrations/v3.5/README.md` - Migration guide
- `ROADMAP.md` - Product roadmap (to be created)
