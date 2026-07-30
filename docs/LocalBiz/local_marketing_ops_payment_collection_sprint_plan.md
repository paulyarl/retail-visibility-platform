# Sprint Plan: Marketing Ops — Payment Collection from Preview Deliverables

**Document Version:** 1.0  
**Status:** Draft — Ready for Review  
**Goal:** Close the gap between Marketing Ops preview deliverables/QR/demo storefronts and the platform's payment, coupon, revenue, billing, and subscription infrastructure.  
**Sprint Duration:** 4 weeks  
**Team Size:** 2–3 full-stack developers, 1 UX/UI designer, 1 QA engineer  

---

## 1. Objective

Enable a prospect who receives a Marketing Ops preview deliverable (QR deliverable, demo storefront, or public preview page) to pay for the package directly on a public checkout page. The checkout must:

- Be reachable from QR codes, demo links, and shareable preview URLs.
- Support the platform's configured payment gateways (Square, PayPal, etc.), letting the prospect choose which gateway to use, the same way a tenant checkout does.
- Apply coupons, calculate revenue, and record the payment against the campaign.
- Transition the campaign through the `shown → paid → delivered` pipeline and, if applicable, into `tenant_onboarded` via a subscription/tier grant.
- Feed first-touch/last-touch attribution, revenue, billing, and subscription systems.

---

## 2. Background and Gap

Current state (per `tenant_prospecting_channel_sprint_plan.md` and implementation):

- Preview deliverables can be generated and QR-linked to a public preview page.
- Demo storefronts can be generated with a 30-day preview token.
- Campaigns track `paid`, `revenue_collected_cents`, `packages_paid`, and `first_touch_source` / `last_touch_source`.
- `MarketingCampaignService.linkTenant()` and `BillingNotificationService` fire a `marketing_campaign_converted` event on `tenant_onboarded`.

Missing:

- The public preview page has a **signup CTA**, not a **pay CTA**.
- No public checkout route or order creation exists for Marketing Ops deliverables.
- No gateway selection, coupon application, or subscription-tier selection on the public flow.
- Payment success is currently a manual admin update (`paid` stage) rather than an automated conversion.

---

## 3. Scope

### In Scope

1. A new public, token-gated checkout page reachable from QR codes and demo storefronts.
2. Multi-gateway payment selector using the **platform-as-tenant** gateway configuration (re-using `PaymentGatewaySelector` and `TenantPaymentContext` patterns).
3. Coupon/promo-code input tied to the platform's existing coupon engine.
4. Order, payment, revenue, and billing records that integrate with the existing `OrderManagementService`, `ManualBillingService`, and `SubscriptionBillingService`.
5. Automated campaign stage transitions (`shown → paid → delivered`) and, when a subscription is purchased, `paid → tenant_onboarded`.
6. Subscription tier selection/placement (similar to `/settings/subscription`) for paid packages that include ongoing BSaaS access.
7. Dashboard and scorecard updates so `revenue_collected_cents` and `packages_paid` are populated from actual payments, not just manual scorecard entry.
8. QR deliverable and demo storefront updates to deep-link to the new checkout page.
9. Webhook and event handling for payment success/failure/refund.
10. Security: token-only trust boundary (no `?campaign=...` query forgery), CSRF-safe public POSTs, and idempotent order creation.

### Out of Scope

- Re-platforming the existing tenant checkout.
- New payment gateway provider support (use existing Square/PayPal only).
- Invoicing / net-30 billing.
- Recurring retainer billing (this is a separate, future retainer-pitch flow).

---

## 4. User Journey

```
Prospect receives PDF with QR
        │
        ▼
Scans QR → public preview page (watermarked deliverable)
        │
        ▼
Clicks "Pay Now" → public checkout page
        │
        ▼
Sees deliverable summary, amount, and coupon field
        │
        ▼
Selects payment gateway (Square / PayPal / default)
        │
        ▼
(Optional) enters coupon code
        │
        ▼
Selects subscription tier if the package includes ongoing BSaaS
        │
        ▼
Completes payment
        │
        ▼
Payment success
        │
        ├──► Order record created
        ├──► Campaign stage → `paid` (and `delivered` if auto-fulfill)
        ├──► `revenue_collected_cents` updated
        ├──► `last_touch_source` = `qr_deliverable`
        ├──► Billing notification fired
        ├──► Subscription/tier granted (if applicable)
        └──► `tenant_onboarded` if a subscription was selected
```

---

## 5. Architecture

### 5.1 Public Checkout as a Tenant Checkout

The platform itself should be modeled as the "merchant tenant" for Marketing Ops payments. This lets us re-use:

- `apps/web/src/components/products/PaymentGatewaySelector.tsx`
- `apps/web/src/contexts/TenantPaymentContext.tsx`
- `apps/web/src/services/PublicPaymentGatewaySettingsService.ts`
- `apps/api/src/services/payments/PaymentGatewayFactory.ts`
- `apps/api/src/services/OrderManagementService.ts`

A new platform-scoped gateway config can live alongside tenant gateway configs or be read from an organization-level record.

### 5.2 Token Trust Boundary

Continue the existing token-only pattern from `tenant_prospecting_channel_sprint_plan.md`:

- Public URLs carry only `ptoken` (e.g., `/public/marketing/pay?ptoken=mpt_...`).
- The backend resolves `ptoken` → `campaign_id` + `deliverable_id`/`demo_tenant_id` + `source`.
- No `?campaign=...` or `?source=...` query parameters are trusted on the public page.

### 5.3 Marketing Ops Integration Points

- `MarketingCampaignService` — new `markCampaignPaid` method to transition to `paid`, record `date_paid`, `revenue_collected_cents`, and `last_touch_source`.
- `MarketingDeliverableService` — new `upgradeDeliverableToPaid` method to generate the unmarked deliverable and update the record from `preview` to `paid`.
- `MarketingScorecardService` — auto-create or update the daily scorecard for `packages_paid` and `revenue_collected_cents` when a payment occurs.
- `MarketingOpsDashboardClient` — show paid-package revenue as real payment data, not just scorecard aggregates.

---

## 6. Integration with QR, Coupon, Revenue, Billing, and Subscription Tiers

### 6.1 QR

- Update `MarketingDeliverableService.generateDeliverable()` to embed a deep-link QR to the public pay page on preview deliverables (not just the public preview page).
- Add a separate QR style preset in `apps/web/src/lib/qr-style-config.ts` for "marketing-pay" CTA.
- The pay-page QR resolves `ptoken` and pre-fills the deliverable and campaign.

### 6.2 Coupon

- Re-use the existing `coupon_offer` funnel step and coupon validation logic (`apps/api/src/services/FunnelService.ts`).
- Public checkout calls a new `POST /public/marketing/coupons/validate` endpoint or uses the existing public coupon validation.
- Discount amount is applied to the line item; final amount recalculated on the client and verified server-side.
- Coupon redemption is recorded against the order.

### 6.3 Revenue

- Payments write to `revenue_collected_cents` on the campaign and the scorecard.
- `PlatformDashboardSingletonService` or a new Marketing Ops revenue job aggregates campaign revenue for dashboard metric cards.
- Optionally create a `marketing_revenue` table for audit / reporting if needed.

### 6.4 Billing

- On payment success, fire an existing or new billing notification type:
  - `marketing_package_paid` for the one-time package.
  - `marketing_campaign_converted` for `tenant_onboarded` (already exists).
- Integrate with `ManualBillingService` for one-time line items and `SubscriptionBillingService` for subscription packages.

### 6.5 Subscription Tiers

- When a paid package includes a BSaaS subscription, the public checkout shows a tier/plan selector similar to `/settings/subscription` or `PlanSummaryPanel`.
- On payment success:
  - Create a `tenant_subscriptions_list` record.
  - Grant capabilities via `EffectiveCapabilityResolver`.
  - Transition campaign to `tenant_onboarded`.
- If the package is one-time only, the campaign stops at `paid`/`delivered` and the admin links the tenant later.

---

## 7. Tasks

| # | Task | Owner | Points | Notes |
|---|------|-------|--------|-------|
| 1 | Design public pay-page UX and copy | UX / PM | 3 | Must include deliverable summary, amount, coupon, gateway selector, tier selector, and pay CTA. |
| 2 | Add platform-tenant payment gateway config and API | Backend | 5 | New table or re-use org/tenant gateway settings; expose public endpoint for active gateways. |
| 3 | Build `POST /public/marketing/checkout` (token → order) | Backend | 5 | Create order, resolve token, validate coupon, store intent. |
| 4 | Build `POST /public/marketing/pay` (execute payment) | Backend | 8 | Use `PaymentGatewayFactory` for Square/PayPal, idempotency, webhook, error handling. |
| 5 | Add `markCampaignPaid` and `upgradeDeliverableToPaid` in `MarketingCampaignService` | Backend | 5 | Stage transitions, attribution, revenue, deliverable status. |
| 6 | Wire billing notifications and subscription creation | Backend | 5 | `marketing_package_paid` + subscription tier grant + `tenant_onboarded`. |
| 7 | Build public pay page (`/public/marketing/pay?ptoken=...`) | Frontend | 8 | Use `PaymentGatewaySelector`, `TenantPaymentContext`, coupon input, tier selector. |
| 8 | Update QR deliverable generation to deep-link to pay page | Frontend + Backend | 3 | QR style preset + pay URL token. |
| 9 | Update demo storefront CTA to include "Pay Now" | Frontend | 3 | Deep-link to pay page or demo conversion. |
| 10 | Update Marketing Ops dashboard and scorecards with real payment data | Frontend + Backend | 5 | Revenue and packages-paid from orders, not just manual entry. |
| 11 | Webhook and event handling for payment success/failure | Backend | 5 | Idempotent handlers, refund support. |
| 12 | E2E and vitest coverage for the full pay flow | QA / Backend | 8 | Token trust, coupon, gateway selection, stage transitions. |
| 13 | Update user guide and admin documentation | Docs / PM | 3 | `MARKETING_OPS_USER_GUIDE.md` §21 / §23. |

**Total:** 66 points  
**Estimated Duration:** 4 sprints (8 weeks) if one team; 1 large 4-week sprint if 2 parallel tracks.  

---

## 8. Database Additions

```sql
-- Add pay-flow state to existing preview token table
ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS subscription_tier_id UUID,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Track one-time package pricing on the campaign if not already present
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS package_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS subscription_tier_id UUID,
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);

-- Optional dedicated marketing revenue table for audit / reporting
CREATE TABLE marketing_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES mkt_campaigns_list(id),
  order_id UUID REFERENCES orders(id),
  amount_cents INTEGER NOT NULL,
  discount_cents INTEGER DEFAULT 0,
  gateway_type VARCHAR(50),
  gateway_id UUID,
  source VARCHAR(50) NOT NULL, -- 'qr_deliverable', 'demo_storefront', etc.
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

---

## 9. API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/public/marketing/pay` | Render pay page (token, campaign, amount, deliverable). |
| POST | `/public/marketing/checkout` | Create an order/intent from a preview token. |
| POST | `/public/marketing/coupons/validate` | Validate and return discount for a coupon. |
| POST | `/public/marketing/pay` | Execute payment via selected gateway. |
| POST | `/webhooks/marketing/payment` | Receive gateway webhooks (Stripe/Square/PayPal). |
| POST | `/admin/marketing-ops/campaigns/:id/pricing` | Admin sets package price and optional subscription tier. |

---

## 10. Frontend Pages / Components

| Page / Component | Path |
|------------------|------|
| Public pay page | `apps/web/src/app/public/marketing/pay/page.tsx` |
| Pay page client | `apps/web/src/app/public/marketing/pay/PayPageClient.tsx` |
| MarketingPaymentGatewaySelector | `apps/web/src/components/marketing-ops/MarketingPaymentGatewaySelector.tsx` |
| MarketingPackageSummary | `apps/web/src/components/marketing-ops/MarketingPackageSummary.tsx` |
| MarketingCouponInput | `apps/web/src/components/marketing-ops/MarketingCouponInput.tsx` |
| MarketingTierSelector | `apps/web/src/components/marketing-ops/MarketingTierSelector.tsx` |
| Updated QR style config | `apps/web/src/lib/qr-style-config.ts` |
| Updated CampaignFormClient (pricing fields) | `apps/web/.../marketing-ops/campaigns/CampaignFormClient.tsx` |
| Updated CampaignDetailClient ("Set Price" action) | `apps/web/.../marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` |

---

## 11. Security and Compliance

- **Token-only trust:** Public URLs carry `ptoken` only. Campaign and source resolved server-side.
- **Idempotent orders:** Use `idempotency_key` for `POST /public/marketing/pay`.
- **Coupon abuse:** One-time coupon redemption per order; server-side validation of discount.
- **PII:** No payment credentials touch the platform; use gateway-hosted tokens/elements.
- **Webhook verification:** Verify gateway signatures before marking campaigns `paid`.

---

## 12. Exit Criteria

- [ ] A prospect can scan a QR on a preview deliverable, land on a public pay page, select a gateway, enter a coupon, and complete payment.
- [ ] Payment success auto-generates the unmarked paid deliverable and updates the campaign to `paid`/`delivered`.
- [ ] Revenue, packages-paid, and attribution fields update automatically.
- [ ] Subscription-tier packages convert the campaign to `tenant_onboarded` and grant BSaaS capabilities.
- [ ] Demo storefronts can link to the same pay flow.
- [ ] All existing vitest and e2e tests pass; new payment-flow tests pass.
- [ ] User guide is updated with the public pay flow, coupon, and tier selection.

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Public pay page exposes platform gateway config | Use tenant-scoped public gateway endpoint; never return secrets. |
| Gateway webhook failures leave campaign in wrong state | Build idempotent webhook handler and manual admin "resync payment" tool. |
| Refunds require campaign revenue reversal | Record order/payment IDs on campaign so support can reconcile. |
| Subscription tier grant conflicts with existing tenant plan | Validate plan change rules before granting; allow only upgrades or net-new. |
| Coupon validation bypass | Server-side recalculation; reject any client-side total mismatch. |

---

## 14. References

- `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`
- `docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md`
- `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md`
- `docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md`
- `apps/web/src/components/products/PaymentGatewaySelector.tsx`
- `apps/web/src/contexts/TenantPaymentContext.tsx`
- `apps/web/src/services/PublicPaymentGatewaySettingsService.ts`
- `apps/api/src/services/payments/PaymentGatewayFactory.ts`
- `apps/api/src/services/OrderManagementService.ts`
- `apps/api/src/services/SubscriptionBillingService.ts`
- `apps/api/src/services/MarketingCampaignService.ts`
- `apps/api/src/services/MarketingDeliverableService.ts`
- `apps/api/src/services/BillingNotificationService.ts`
- `apps/api/src/routes/marketing-ops.ts`
- `apps/api/database/migrations/129_tenant_prospecting_channel.sql`
