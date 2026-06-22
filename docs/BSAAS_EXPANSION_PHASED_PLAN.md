# BSaaS Expansion — Quick Wins Phased Plan

> **Status: All phases complete.** Verified with `pnpm checkapi` + `pnpm checkweb` (zero TS errors).
> User guides: [BSaaS User Guide](./BSAAS_USER_GUIDE.md) | [BSaaS Expansion User Guide](./BSAAS_EXPANSION_USER_GUIDE.md)

5 expansion opportunities implemented, ordered by effort-to-value ratio.

## Phase E1: Admin Complimentary Access ✅ Complete
**Goal**: Admin UI to grant complimentary feature access without charging.

- Admin form: tenant selector + feature selector + optional expiry + notes
- Backend: reuse existing admin feature-purchases endpoint, set `source='admin_grant'`, `price_cents=0`, `billing_cycle='manual'`
- Renewal job already skips non-recurring metadata — verify `source='admin_grant'` is ignored
- No schema changes needed

**Files**:
- `apps/api/src/routes/admin/feature-purchases.ts` — add `grant-complimentary` endpoint
- `apps/web/src/admin/components/` — new `ComplimentaryAccessForm.tsx`
- `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx` — add grant tab/section

## Phase E2: Grace Period for Renewal Failures ✅ Complete
**Goal**: Delay suspension by 7 days with retry, instead of immediate suspension.

- Modify `bsaas-renewal.ts`: on charge failure, set `status='past_due'` + `grace_ends_at` in metadata
- Add retry logic: renewal job re-attempts `past_due` purchases within grace period
- After grace expires: set `status='suspended'`
- New notification type `bsaas_grace_period_warning` (reuse existing grace period warning patterns)
- No schema changes — store `grace_ends_at` in purchase metadata

**Files**:
- `apps/api/src/jobs/bsaas-renewal.ts` — add past_due + retry logic
- `apps/api/src/services/subscription/BillingNotificationService.ts` — add `bsaas_grace_period_warning` type

## Phase E3: Free Trials for BSaaS Features ✅ Complete
**Goal**: Allow `trial_days` on catalog entries for no-cost trial before first charge.

- Migration: add `trial_days INT DEFAULT 0` to `bsaas_catalog`
- Purchase endpoint: if `trial_days > 0`, create purchase with `status='trial'`, `expires_at=now+trial_days`, no charge
- Renewal job: on trial expiry, attempt charge → active or suspended
- Admin UI: add trial_days field to catalog management form
- Notification: `bsaas_trial_started` type

**Files**:
- `database/migrations/049_bsaas_trial_days.sql` — add column
- `apps/api/src/routes/bsaas-purchases.ts` — trial branch in purchase endpoint
- `apps/api/src/jobs/bsaas-renewal.ts` — trial expiry handling
- `apps/api/src/services/subscription/BillingNotificationService.ts` — trial notification
- `apps/web/src/admin/components/BsaasCatalogManagement.tsx` — trial_days field

## Phase E4: Revenue Analytics Dashboard ✅ Complete
**Goal**: Admin dashboard showing BSaaS revenue metrics.

- Aggregation service: total active purchases, MRR, per-feature revenue, churn rate
- Admin page with charts (reuse existing dashboard patterns)
- Read-only — no billing changes

**Files**:
- `apps/api/src/services/BsaasAnalyticsService.ts` — new aggregation service
- `apps/api/src/routes/admin/bsaas-analytics.ts` — new admin analytics route
- `apps/web/src/app/(platform)/settings/admin/bsaas-analytics/page.tsx` — dashboard page
- `apps/web/src/admin/components/BsaasAnalyticsDashboard.tsx` — charts + metrics

## Phase E5: Promotional Discounts / Coupon Codes ✅ Complete
**Goal**: Apply Stripe coupon codes at BSaaS checkout.

- Admin UI to create Stripe Coupons + Promotion Codes via Stripe API
- Purchase endpoint: accept optional `promotionCode` param, apply to PaymentIntent
- Track discount usage in purchase metadata
- Feature Store UI: promo code input field

**Files**:
- `apps/api/src/routes/admin/bsaas-promotions.ts` — CRUD for Stripe coupons
- `apps/api/src/routes/bsaas-purchases.ts` — accept `promotionCode` param
- `apps/web/src/admin/components/BsaasPromotionManagement.tsx` — admin coupon UI
- `apps/web/src/app/(platform)/settings/feature-store/page.tsx` — promo code input

## Verification ✅
Each phase verified with `pnpm checkapi` + `pnpm checkweb` — zero TypeScript errors on both projects.
