---
description: Checklist for ensuring all store purchase flows (BSaaS, Featured Placements, Directory Promotions) have capability awareness, companion purchase soft-enables, and companion cleanup across all lifecycle phases
---

# Store Purchases Capability Checklist

Use this checklist when building or auditing any self-service store purchase flow on the platform. It ensures that paid features work regardless of tenant tier by automatically soft-enabling missing capabilities via zero-cost companion purchases, and cleaning them up when the paid entitlement expires.

## Why This Exists

When a merchant purchases a feature (e.g., a Featured Placement) but their tier doesn't include the parent capability (e.g., `featured_options`), the purchase would silently fail to produce visible results — the capability resolver would gate the feature off. The fix is a **companion purchase pattern**: automatically creating a zero-cost `tenant_feature_purchases` row for the parent gate feature so the resolver sees the capability as enabled.

## The Companion Purchase Pattern

### How It Works

```
1. Merchant pays for a sub-feature (e.g., featured placement)
2. activatePurchase() runs
3. ensureXxxCapabilityCompanions(tenantId) checks:
   a. Is the parent gate feature already in the tenant's tier? → skip
   b. Is there already an active companion or real purchase? → skip
   c. Otherwise: upsert a zero-cost companion purchase (source='companion', status='active', expires_at=null)
4. invalidateEffectiveCapabilities(tenantId) — so resolver picks up the new entitlement
5. Feature is now visible on all surfaces
```

### Companion Cleanup (On Expiration/Revocation)

```
1. Placement expires or is revoked
2. maybeCancelXxxCapabilityCompanions(tenantId) checks:
   a. Are there other active placements for this tenant? → skip (still needed)
   b. Are there active non-companion BSaaS purchases for the capability? → skip
   c. Is the feature already in the tenant's tier? → skip (we didn't create the companion)
   d. Otherwise: expire the companion purchases
3. invalidateEffectiveCapabilities(tenantId)
```

## Parent Gate Feature Map

Each capability domain has a parent gate feature key. When a sub-feature is purchased, the companion purchase targets the parent gate.

| Capability Type | Parent Gate Feature Key | Merchant Gate Table | Toggle Column |
|---|---|---|---|
| `chatbot_options` | `chatbot_enabled` | `tenant_chatbot_options_settings` | `chatbot_enabled` |
| `crm_options` | `crm_enabled` | `tenant_crm_options_settings` | `crm_enabled` |
| `social_commerce_options` | `social_commerce_enabled` | `tenant_social_commerce_options_settings` | `social_commerce_enabled` |
| `storefront_options` | `storefront_opt_enabled` | — | — |
| `quickstart_options` | `quickstart_enabled` | — | — |
| `fulfillment_options` | `fulfillment_enabled` | — | — |
| `payment_gateway_options` | `payment_gateway_enabled` | — | — |
| `featured_options` | `featured_enabled` | `tenant_featured_options_settings` | `featured_enabled` |
| `faq_options` | `faq_enabled` | — | — |
| `barcode_scan_options` | `barcode_enabled` | — | — |
| `directory_entry` | `directory_entry_enabled` | — | — |
| `directory_promotion` | `directory_promotion_enabled` | — | — |
| `organization_options` | `org_enabled` | — | — |
| `integration_options` | `integration_enabled` | — | — |

**Source**: `PARENT_GATE_FEATURES` and `MERCHANT_GATE_MAP` in `apps/api/src/routes/bsaas-purchases.ts`

## Full Checklist (All Store Phases)

### Phase 1: Purchase Creation (`createPurchase`)

- [ ] **Capability awareness log**: Before creating the purchase record, check if the tenant's tier includes the parent gate feature. If not, log an informational message (not a warning — the purchase is valid, companions will handle it).
- [ ] **No blocking**: Never block a purchase based on tier capability. The payment IS the entitlement.
- [ ] **Validate plan/product ownership**: Ensure the plan exists, is active, and the product belongs to the tenant.

### Phase 2: Purchase Activation (`activatePurchase`)

- [ ] **Companion purchase creation**: After activating the purchase and updating the relevant display tables (e.g., `featured_products`), call `ensureXxxCapabilityCompanions(tenantId)`.
- [ ] **Companion targets**: Create companions for BOTH the parent gate feature (e.g., `featured_enabled`) AND the specific sub-feature (e.g., `featured_featured`) if the capability has sub-types.
- [ ] **Tier check before creating**: Only create companions if the feature is NOT already in the tenant's tier (avoid duplicate entitlements).
- [ ] **Idempotent upsert**: Use `upsert` with `tenant_id_feature_key` unique constraint to avoid duplicates.
- [ ] **Companion metadata**: Set `source: 'companion'`, `status: 'active'`, `expires_at: null`, and metadata with `companion_for`, `price_cents: 0`, `created_reason`.
- [ ] **Cache invalidation**: Call `invalidateEffectiveCapabilities(tenantId)` after creating companions.

### Phase 3: Renewal (Auto-Renewal Job)

- [ ] **No companion changes on renewal**: Renewal extends the existing placement — companions remain active. No action needed.
- [ ] **Renewal failure → grace period**: Companions stay active during grace period (the placement is still active).
- [ ] **Grace period expiration**: When the placement is finally expired after grace period, call `maybeCancelXxxCapabilityCompanions(tenantId)`.

### Phase 4: Expiration / Revocation

- [ ] **Companion cleanup**: After deactivating the placement and invalidating featured caches, call `maybeCancelXxxCapabilityCompanions(tenantId)`.
- [ ] **Guard against premature cleanup**: Only cancel companions if:
  - No other active placements exist for the tenant
  - No active non-companion BSaaS purchases exist for the capability domain
  - The feature is not already in the tenant's tier
- [ ] **Cache invalidation**: Call `invalidateEffectiveCapabilities(tenantId)` after cancelling companions.

### Phase 5: Frontend Display

- [ ] **Surface labels**: Ensure each surface type has a human-readable label (e.g., `storefront_spotlight` → "Your Storefront Spotlight").
- [ ] **No tier gating in UI**: The store page should show all plans regardless of tier. The purchase payment handles entitlement.
- [ ] **Active purchases list**: Show active placements with surface, expiry, and renewal options.

### Phase 6: Admin / Revocation

- [ ] **Admin revoke triggers cleanup**: `revokePurchase()` must call `maybeCancelXxxCapabilityCompanions(tenantId)`.
- [ ] **Audit trail**: Log revocation reason and timestamp.

## Implementation Patterns

### Pattern A: BSaaS Feature Purchase (Existing)

Used by `bsaas-purchases.ts` for standard à la carte feature purchases.

```
File: apps/api/src/routes/bsaas-purchases.ts
Functions: ensureCompanionPurchase(), maybeCancelCompanion()
Key: Uses PARENT_GATE_FEATURES map to find parent gate for a capability type
```

### Pattern B: Featured Placement Purchase (This Session)

Used by `FeaturedPlacementService.ts` for featured product placement purchases.

```
File: apps/api/src/services/FeaturedPlacementService.ts
Methods: ensureFeaturedCapabilityCompanions(), maybeCancelFeaturedCapabilityCompanions()
Key: Hardcoded companion targets ['featured_enabled', 'featured_featured']
     because featured placements always need both the parent gate and the
     specific 'featured' sub-type enabled.
```

### Pattern C: Directory Promotion Purchase (Future)

If directory promotions also need companion purchases, follow the same pattern with `directory_promotion_enabled` as the companion target.

## Key Files Reference

| File | Purpose |
|---|---|
| `apps/api/src/routes/bsaas-purchases.ts` | BSaaS purchase flow with `ensureCompanionPurchase()` + `maybeCancelCompanion()` |
| `apps/api/src/services/FeaturedPlacementService.ts` | Featured placement service with companion create/cleanup methods |
| `apps/api/src/jobs/featured-placement-renewal.ts` | Daily renewal job with companion cleanup on grace period expiration |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Capability resolver — merges purchases into effective capabilities |
| `apps/api/src/services/ActiveFeaturedResolver.ts` | Featured product cache invalidation |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | Billing notifications for all purchase lifecycle events |

## Common Gaps to Watch For

1. **Missing companion on activation**: Purchase succeeds but feature is invisible because capability resolver gates it off. Fix: Add `ensureXxxCapabilityCompanions()` call in `activatePurchase()`.

2. **Missing cleanup on expiration**: Companion purchases persist forever after placement expires, keeping capability enabled for free. Fix: Add `maybeCancelXxxCapabilityCompanions()` call in expiration/revocation paths.

3. **Missing cleanup in renewal job**: The daily renewal job handles expiration but doesn't clean up companions. Fix: Add companion cleanup call after grace period expiration in the job.

4. **Blocking purchase on tier check**: Never reject a purchase because the tier doesn't have the capability — the payment IS the entitlement. Only log an informational message.

5. **Forgetting sub-type companion**: Some capabilities need both the parent gate AND a specific sub-type enabled (e.g., `featured_enabled` + `featured_featured`). Missing the sub-type companion means the resolver enables the domain but the specific feature type is still gated.

6. **Not invalidating capability cache**: After creating or cancelling companions, always call `invalidateEffectiveCapabilities(tenantId)`. Without this, the resolver serves stale data for up to 60 seconds.

## Related Documents

- **`bsaas-purchase-flow.md`** — BSaaS purchase flow architecture and end-to-end walkthrough
- **`capability-deployment-flow.md`** — Master capability deployment pipeline (8 phases)
- **`capability-data-flow-rules.md`** — Data flow rules for capability resolution
- **`add-bsaas-feature.md`** — How to add a purchasable feature to the platform
