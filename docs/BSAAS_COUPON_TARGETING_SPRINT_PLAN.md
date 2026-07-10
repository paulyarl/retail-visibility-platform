# BSaaS Coupon Targeting — Sprint Plan

## Problem

Coupons are broad — any valid promo code can be applied to any BSaaS transaction. There is no way to restrict a coupon to specific features, tiers, capability types, demo/non-demo tenants, or subscription statuses. This limits promotional precision and creates revenue leakage risk.

## Solution

Add a platform-side targeting layer using a local DB table (`coupon_target_rules`) that stores per-coupon target constraints. The checkout flow validates these targets before applying the discount. Stripe's native coupon/promotion code system remains the discount engine; the targeting layer is a gate on top.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Admin UI                                                 │
│  /settings/admin/bsaas-promotions                         │
│  Coupon form + target fields (features, tiers, etc.)     │
│  Promotion code table shows target badges                │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Admin API                                                │
│  POST /coupon — creates Stripe coupon + target rules     │
│  PUT /coupon/:id/targets — update target rules           │
│  GET / — lists coupons with target info                  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  coupon_target_rules table (PostgreSQL)                   │
│  coupon_id → target_features, target_tiers, etc. (JSONB) │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Tenant Checkout (bsaas-purchases.ts)                     │
│  POST /feature-purchase  → validates targets + discount   │
│  POST /bundle-purchase   → validates targets + discount   │
│  (both flows now apply promo codes)                      │
└──────────────────────────────────────────────────────────┘
```

## Target Types

| Target | Field | Values | Checkout Check |
|--------|-------|--------|----------------|
| **Feature** | `target_features` | Array of feature keys (e.g., `["chatbot_flexible", "crm_flexible"]`) | `featureKey` must be in list |
| **Tier** | `target_tiers` | Array of tier keys (e.g., `["discovery", "storefront", "ecommerce", "professional"]`) | Tenant's `subscription_tier` must be in list |
| **Capability type** | `target_capability_types` | Array of capability type keys (e.g., `["chatbot_options", "crm_options"]`) | Feature's capability type must be in list |
| **Tier type** | `target_tier_types` | Array: `["individual"]`, `["organization"]`, `["individual", "organization"]` | Tenant's tier `tier_type` from `subscription_tiers_list` (individual vs organization) |
| **Demo status** | `target_demo_status` | Array: `["demo"]`, `["non_demo"]` | Tenant's `is_demo` flag |
| **Subscription status** | `target_subscription_statuses` | Array of statuses (e.g., `["active", "trial"]`) | Tenant's `subscription_status` must be in list |

**Rule**: `null` on any field = no constraint (all values pass). All non-null fields must pass (AND logic).

## Database

### Migration: `097_coupon_target_rules.sql`

```sql
CREATE TABLE IF NOT EXISTS coupon_target_rules (
  id VARCHAR(255) PRIMARY KEY,
  coupon_id VARCHAR(255) NOT NULL UNIQUE,
  target_features JSONB,          -- null = all features
  target_tiers JSONB,             -- null = all tiers
  target_capability_types JSONB,  -- null = all capability types
  target_tier_types JSONB,        -- null = all tier types
  target_demo_status JSONB,       -- null = all demo statuses
  target_subscription_statuses JSONB, -- null = all subscription statuses
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: admin-only
-- No tenant access — coupons are platform-managed
-- Index on coupon_id for checkout lookup
```

### Prisma Model

```prisma
model coupon_target_rules {
  id                         String   @id
  coupon_id                  String   @unique
  target_features            Json?
  target_tiers               Json?
  target_capability_types    Json?
  target_tier_types          Json?
  target_demo_status         Json?
  target_subscription_statuses Json?
  created_at                 DateTime @default(now()) @db.Timestamptz(6)
  updated_at                 DateTime @default(now()) @db.Timestamptz(6)
}
```

## Sprints

### Sprint 1: Backend — DB + Targeting Validation (3-4 days)

1. **Migration `097_coupon_target_rules.sql`** — table, RLS, indexes, updated_at trigger
2. **Prisma schema** — `coupon_target_rules` model
3. **`CouponTargetService.ts`** — singleton backend service:
   - `getTargetsForCoupon(couponId)` — fetch rules, 60s in-memory cache
   - `validateCouponTargets(couponId, context)` — checks all non-null target fields against purchase context
   - `setCouponTargets(couponId, targets)` — upsert rules
   - `invalidateCache()` — called on target updates
4. **Admin API changes** (`bsaas-promotions.ts`):
   - `POST /coupon` — accept optional target fields, create `coupon_target_rules` row after Stripe coupon creation
   - `PUT /coupon/:id/targets` — update target rules for existing coupon
   - `GET /` — include target info in coupon response
5. **Checkout validation** (`bsaas-purchases.ts`):
   - `POST /feature-purchase` — after Stripe promo code validation, call `validateCouponTargets()` with `{ featureKey, tenantId }`. Reject with `coupon_target_mismatch` if fails.
   - `POST /bundle-purchase` — **fix the promo code gap**: add full promo code validation + targeting check. Pass `{ bundleKey, featureKeys, tenantId }` as context.
6. **ID generator** — `generateCouponTargetId()` in `id-generator.ts` (prefix `ctgt-`)

### Sprint 2: Frontend — Admin UI (2-3 days)

1. **`AdminBsaasPromotionsService.ts`** — extend types:
   - `BsaasCoupon` gets `targets?: CouponTargets` field
   - `CreateCouponRequest` gets optional target fields
   - New `updateCouponTargets(couponId, targets)` method
2. **`BsaasPromotionManagement.tsx`** — enhance coupon form:
   - Target section in coupon create form with 6 optional fields
   - Feature multi-select (populated from catalog)
   - Tier multi-select (populated from subscription tiers)
   - Capability type multi-select
   - Tier type checkboxes (trial/paid)
   - Demo status checkboxes (demo/non-demo)
   - Subscription status multi-select
   - Target badges in coupon table (show which targets are set)
   - Edit targets button on existing coupons
3. **Promo code table** — show target badges derived from parent coupon

## Validation Logic (Pseudocode)

```typescript
async function validateCouponTargets(couponId, context) {
  const rules = await getTargetsForCoupon(couponId);
  if (!rules) return { valid: true }; // no rules = no constraints

  // Feature check
  if (rules.target_features && !rules.target_features.includes(context.featureKey)) {
    return { valid: false, reason: 'coupon_not_valid_for_feature' };
  }

  // Tier check
  if (rules.target_tiers && !rules.target_tiers.includes(context.tenantTier)) {
    return { valid: false, reason: 'coupon_not_valid_for_tier' };
  }

  // Capability type check
  if (rules.target_capability_types) {
    const capType = await getFeatureCapabilityType(context.featureKey);
    if (!rules.target_capability_types.includes(capType)) {
      return { valid: false, reason: 'coupon_not_valid_for_capability' };
    }
  }

  // Tier type check (trial vs paid)
  if (rules.target_tier_types) {
    const tierType = context.subscriptionStatus === 'trial' ? 'trial' : 'paid';
    if (!rules.target_tier_types.includes(tierType)) {
      return { valid: false, reason: 'coupon_not_valid_for_tier_type' };
    }
  }

  // Demo status check
  if (rules.target_demo_status) {
    const demoStatus = context.isDemo ? 'demo' : 'non_demo';
    if (!rules.target_demo_status.includes(demoStatus)) {
      return { valid: false, reason: 'coupon_not_valid_for_demo_status' };
    }
  }

  // Subscription status check
  if (rules.target_subscription_statuses && !rules.target_subscription_statuses.includes(context.subscriptionStatus)) {
    return { valid: false, reason: 'coupon_not_valid_for_subscription_status' };
  }

  return { valid: true };
}
```

## Error Responses

| Error Code | HTTP | Cause |
|------------|------|-------|
| `coupon_target_mismatch` | 400 | Promo code valid but targets don't match this purchase context |
| `coupon_not_valid_for_feature` | 400 | Specific target mismatch — feature not in allowed list |
| `coupon_not_valid_for_tier` | 400 | Specific target mismatch — tier not in allowed list |
| `coupon_not_valid_for_capability` | 400 | Specific target mismatch — capability type not in allowed list |
| `coupon_not_valid_for_tier_type` | 400 | Specific target mismatch — tier type (trial/paid) not in allowed list |
| `coupon_not_valid_for_demo_status` | 400 | Specific target mismatch — demo status not in allowed list |
| `coupon_not_valid_for_subscription_status` | 400 | Specific target mismatch — subscription status not in allowed list |

## Design Decisions

1. **Local DB table, not Stripe metadata** — Stripe metadata is string-only, limited to 50 keys, and can't do structured queries. A local table gives us JSONB, caching, and extensibility.

2. **Targets on coupon, not promotion code** — All promotion codes referencing a coupon share the same targets. This is simpler and matches the Stripe model where the coupon defines the discount terms.

3. **AND logic across target fields** — All non-null fields must pass. Within each field, it's an OR (any match in the list). This gives admins precise control.

4. **Null = no constraint** — A coupon with no target rules behaves exactly as it does today (applies to everything).

5. **Bundle promo code gap fixed** — The bundle-purchase endpoint currently ignores promo codes. This sprint adds full promo code validation + targeting to bundle purchases.

6. **No new capability features needed** — Coupon targeting is an admin tool, not a tenant-facing capability. It doesn't need feature keys or tier gating.

7. **No new pages** — Targeting UI is added to the existing `/settings/admin/bsaas-promotions` page. No new navigation links needed.

## Pre-Flight Checklist

See `.devin/skills/bsaas-coupon-targeting-checklist.md` for the pre-flight checklist.
