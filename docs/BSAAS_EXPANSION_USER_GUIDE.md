# BSaaS Expansion — User Guide

This guide covers the five BSaaS (Billing-as-a-Service) expansion features added in Phases E1–E5. It explains what each feature does, where to find it, and how to use it day-to-day.

---

## Table of Contents

1. [Admin Complimentary Access (E1)](#1-admin-complimentary-access-e1)
2. [Grace Period for Renewal Failures (E2)](#2-grace-period-for-renewal-failures-e2)
3. [Free Trials for BSaaS Features (E3)](#3-free-trials-for-bsaas-features-e3)
4. [Revenue Analytics Dashboard (E4)](#4-revenue-analytics-dashboard-e4)
5. [Promotional Discounts / Coupon Codes (E5)](#5-promotional-discounts--coupon-codes-e5)

---

## 1. Admin Complimentary Access (E1)

### What It Does

Allows platform admins to grant a BSaaS feature to a tenant at no cost. The purchase is recorded with `source='admin_grant'`, `price_cents=0`, and `billing_cycle='manual'`, so the renewal job will never attempt to charge or suspend it.

### How to Use

1. Navigate to **Settings → Admin → BSaaS Catalog**.
2. Locate the **Grant Complimentary Access** section (or tab).
3. Select:
   - **Tenant** — the tenant receiving the feature.
   - **Feature** — the BSaaS catalog item to grant.
   - **Expiry (optional)** — set a date if the grant should expire. Leave blank for indefinite access.
   - **Notes (optional)** — internal note explaining why the grant was given.
4. Click **Grant Access**.

### Things to Know

- Granted features appear in the tenant's feature list with `source=admin_grant`.
- The renewal job skips these — no charges, no suspension.
- To revoke access, an admin can update the purchase status to `cancelled` or `expired` via the admin feature-purchases endpoint.
- Audit log records the action as `feature_purchase.create` with grant details.

---

## 2. Grace Period for Renewal Failures (E2)

### What It Does

When a BSaaS feature renewal charge fails, the tenant now gets a **7-day grace period** before suspension. During this period:

- The feature remains **fully active** (included in capability resolution).
- The purchase status is set to `past_due`.
- The renewal job retries the charge daily.
- A `bsaas_grace_period_warning` notification is sent (email + CRM).

If the charge succeeds during grace, the purchase returns to `active`. If the grace period expires, the purchase is set to `suspended`.

### How It Works (Automatic)

No admin action is required — this is fully automated by the daily renewal job (`bsaas-renewal.ts`):

| Step | Trigger | Action |
|------|---------|--------|
| 1 | Renewal charge fails | Status → `past_due`, `grace_ends_at` set in metadata (now + 7 days) |
| 2 | Daily renewal job | Retries `past_due` purchases where `grace_ends_at` hasn't passed |
| 3 | Retry succeeds | Status → `active`, grace ends |
| 4 | Grace period expires | Status → `suspended`, feature access removed |

### Admin Visibility

- `past_due` purchases appear in the admin feature-purchases list.
- Admins can manually update a `past_due` purchase to `active` or `suspended` if needed.
- The notification system sends an email and creates a CRM alert/task for each grace period warning.

---

## 3. Free Trials for BSaaS Features (E3)

### What It Does

BSaaS catalog entries can now specify a `trial_days` value. When a tenant purchases a feature with `trial_days > 0`:

- No charge is made immediately.
- The purchase is created with `status='trial'` and `expires_at = now + trial_days`.
- The feature is **fully active** during the trial.
- A `bsaas_trial_started` notification is sent.

When the trial expires, the renewal job attempts to charge the tenant's payment method:
- **Charge succeeds** → status becomes `active`.
- **Charge fails** → enters the 7-day grace period (see E2 above).

### How to Configure Trials

1. Navigate to **Settings → Admin → BSaaS Catalog**.
2. Edit or create a catalog entry.
3. Set the **Trial Days** field (e.g., `14` for a 14-day trial).
4. Save.

### Tenant Experience

1. Tenant visits the **Feature Store** page.
2. Features with trials show the trial duration.
3. Tenant clicks **Purchase** — no payment is charged upfront.
4. The feature is activated immediately with `status='trial'`.
5. At trial expiry, the system attempts to charge the saved payment method.

### Things to Know

- Trials are only available for recurring features (`monthly` or `annual`), not `one_time` purchases.
- A tenant cannot start a second trial for the same feature if one is already active.
- If the tenant has no payment method on file at trial expiry, the charge will fail and enter the grace period.

---

## 4. Revenue Analytics Dashboard (E4)

### What It Does

Provides admins with a read-only dashboard showing BSaaS revenue and usage metrics.

### How to Access

Navigate to **Settings → Admin → BSaaS Analytics** (under the **Subscriptions** nav section).

### Metrics Displayed

#### Summary Cards

| Metric | Description |
|--------|-------------|
| **MRR** | Monthly Recurring Revenue from active monthly + annual purchases (annual divided by 12) |
| **ARR** | Annual Recurring Revenue (MRR × 12) |
| **Lifetime Revenue** | Total revenue from all completed charges |
| **Active Purchases** | Count of purchases with `status='active'` |
| **Active Trials** | Count of purchases with `status='trial'` |
| **Unique Tenants** | Number of distinct tenants with any BSaaS purchase |
| **Trial Conversion** | Percentage of trials that converted to active |
| **Churn Rate** | Percentage of purchases that moved to `suspended` or `expired` |

#### Per-Feature Revenue Table

Shows each feature's active count, trial count, monthly revenue, annual revenue, and lifetime revenue.

#### Recent Purchases Table

Shows the most recent 20 purchases with tenant name, feature, status, price, billing cycle, purchase date, and expiry date.

### Things to Know

- The dashboard is **read-only** — no billing changes can be made from it.
- Data is fetched from the backend aggregation service and cached briefly on the frontend.
- Past-due purchases are included in the status breakdown but not in MRR calculations.

---

## 5. Promotional Discounts / Coupon Codes (E5)

### What It Does

Integrates Stripe Coupons and Promotion Codes into the BSaaS checkout flow. Admins can create coupons (percentage or fixed amount off) and promotion codes (shareable codes that reference a coupon). Tenants can enter a promo code at checkout to receive a discount.

### Admin: Creating Coupons and Promotion Codes

#### Creating a Coupon

1. Navigate to **Settings → Admin → BSaaS Promotions** (under the **Subscriptions** nav section).
2. Click **New Coupon**.
3. Fill in:
   - **Name** — internal label (e.g., "Summer Sale 50%").
   - **Duration** — `Once` (first charge only), `Repeating` (multiple months), or `Forever` (all future charges).
   - **Duration (months)** — only if `Repeating` is selected.
   - **Percent Off** — e.g., `50` for 50% off. **OR**
   - **Amount Off (cents)** — e.g., `500` for $5.00 off. (Only one of percent/amount can be used.)
4. Click **Create Coupon**.

#### Creating a Promotion Code

1. In the **Promotion Codes** section, click **New Promotion Code**.
2. Fill in:
   - **Coupon** — select a valid coupon from the dropdown.
   - **Code (optional)** — a custom code like `SUMMER50`. If left blank, Stripe auto-generates one.
   - **Max Redemptions (optional)** — limit the number of times the code can be used.
   - **Expires At (optional)** — date after which the code is no longer valid.
3. Click **Create Promotion Code**.

#### Deactivating a Promotion Code

- Click **Deactivate** next to any active promotion code.
- This makes the code unusable for future purchases but does not affect past purchases where it was already applied.

### Tenant: Using a Promo Code at Checkout

1. Tenant visits the **Feature Store** page.
2. Clicks **Purchase** on a feature.
3. In the confirmation modal, enters the promo code in the **Promo Code (optional)** field.
4. Clicks **Confirm Purchase**.
5. The system validates the code with Stripe, calculates the discount, and charges the discounted amount.

### How Discounts Work

| Duration | Effect |
|----------|--------|
| **Once** | Discount applies to the first charge only. Subsequent renewals are full price. |
| **Repeating** | Discount applies for the specified number of months. |
| **Forever** | Discount applies to every charge for the life of the subscription. |

### Things to Know

- Promo codes are validated in real-time via the Stripe API at checkout.
- Invalid, expired, or exhausted codes return an error — the purchase will not complete.
- Discount details (promotion code, coupon ID, discount amount, charged amount) are stored in the purchase metadata for audit and analytics.
- Coupons and promotion codes are managed via Stripe — deactivating in the admin UI calls `stripe.promotionCodes.update(id, { active: false })`.

---

## Quick Reference: Admin Navigation

All BSaaS admin features are under **Settings → Admin** in the **Subscriptions** section:

| Nav Link | Feature | Phase |
|----------|---------|-------|
| BSaaS Catalog | Manage feature catalog + complimentary grants | E1, E3 |
| BSaaS Analytics | Revenue dashboard | E4 |
| BSaaS Promotions | Coupon & promo code management | E5 |

## Quick Reference: Purchase Statuses

| Status | Meaning | Feature Active? |
|--------|---------|-----------------|
| `active` | Paid and current | Yes |
| `trial` | Free trial in progress | Yes |
| `past_due` | Renewal failed, in grace period (7 days) | Yes |
| `suspended` | Grace period expired or payment failed | No |
| `expired` | Cancelled purchase reached end of billing period | No |
| `cancelled` | Tenant cancelled, awaiting end of billing period | Yes (until expiry) |
