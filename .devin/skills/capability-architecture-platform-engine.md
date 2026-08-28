---
description: Strategic framing of the capability architecture as the platform's central engine — soft degradation, decoupled gating, composability, and the strategic possibilities it unlocks
---

# Capability Architecture as Platform Engine

## Strategic Insight

The capability architecture arrived almost by accident — initially a feature-gating mechanism layered on top of tier keys. With its flexible and versatile nature, it has become the engine and brain of the platform, unlocking strategic possibilities that the original tier-only model could not express.

This skill captures the strategic framing so future work extends the capability model rather than re-introducing tier-coupled logic.

## First Principles

### 1. Capabilities are the single source of truth for "what a tenant can do"

The `EffectiveCapabilityResolver` is the platform's central nervous system. Tier keys, subscription status, BSaaS purchases, org inheritance, and admin grants all flow into the resolver, which produces a single per-tenant `EffectiveCapabilities` object. Every consumer (frontend, API middleware, public pages, services) reads from this resolved output — never from the raw tier key.

**Implication:** Never gate behavior on `tier === 'some_tier'`. Gate on the resolved capability domain. The tier is a billing convenience, not a capability constraint.

### 2. Tiers are billing bundles, not capability gates

A tier is a default bundle of capability grants + limits + a price. The capability resolver doesn't care about tier hierarchy — it cares about which feature keys are enabled for this tenant, however they got enabled (tier, BSaaS, org inheritance, admin override).

This decoupling is what makes the following possible:
- BSaaS single-feature purchases (a `presence` tenant buying `storefrontQr` without upgrading tiers)
- Org-level capability propagation (org buys a capability for all locations)
- Soft degradation (downgrade tier → capabilities close, data stays)
- Capability-level trials (trial one domain without trialing an entire tier)

### 3. Status is decoupled from tier

`subscription_status` tracks the billing relationship (`trial`, `active`, `past_due`, `canceled`, `expired`). The tier tracks the billing bundle (`presence`, `discovery`, `storefront`, ...). Neither directly determines what the tenant can do — the capability resolver does, with status as one input among several.

The capability resolver applies status-aware overrides on top of the resolved capabilities:
- `frozen` / `canceled` / `expired` → read-only (most domains disabled)
- `maintenance` / `past_due` → limited (some domains disabled)
- `active` / `trialing` → full resolution from tier + purchases + grants

**Implication:** Don't conflate "expired subscription" with "deleted tenant." An expired tenant on the free baseline tier (`presence` + `active`) still has its place entry; it just has no paid capabilities.

## Soft Degradation Pattern

The platform's degradation model is a natural property of the capability architecture, not a separate code path.

### How it works

1. Tenant's paid subscription expires (trial ends, grace period expires, payment fails)
2. Downgrade logic flips `subscription_tier` → `presence` (free baseline) and `subscription_status` → `active`
3. Capability resolver re-runs: `presence` tier has no paid capability grants, so all paid domains resolve to `enabled: false`
4. Tenant's data is untouched — products, settings, configurations all remain
5. Public place entry remains visible (the `/place/{slug}` surface serves the free baseline)
6. Tenant can renew into any paid tier later; capability resolver re-enables domains and all platform data is restored

### Why this is powerful

- **No "frozen mode" code path** — the gates just close because the resolver returns fewer enabled domains
- **No data migration on downgrade** — the tenant row's tier/status changes; everything else is intact
- **No data migration on renewal** — re-enable capabilities by changing the tier back; data is still there
- **The tier is the gate, not the status** — `presence` + `active` is a legitimate state (free baseline), not an error state

### Key files

- `apps/api/src/services/subscription/TrialManagementService.ts` — `downgradeToExpired()` targets `presence` + `active`
- `apps/api/src/services/tenant/TenantService.ts` — auto-expire on read targets `presence` + `active`
- `apps/api/src/services/subscription/SubscriptionStatusService.ts` — `handleGracePeriodExpiry()` logs the `presence` transition
- `apps/api/src/services/EffectiveCapabilityResolver.ts` — applies status-aware capability overrides
- `apps/api/src/utils/subscription-status.ts` — `deriveInternalStatus()` (single source of truth for UI status)

## The Free Baseline: `presence`

`presence` (display: "Starter") is the strategic platform gateway — the free tier that fulfills the role previously served by `expired_trial`. It has a strategic role as the gateway to convert businesses into platform tenants.

### Tier hierarchy (V3.1)

```
Gateway          directory_presence     FREE seed/claim on-ramp (invite-only)
Entry Presence   presence | discovery | storefront   visibility MODES (peer choice)
Commerce         commitment | ecommerce | omnichannel   money MODES
Scale            professional | organization | enterprise
```

- `directory_presence` — free, invite-only, visibility-only (seed/claim flow)
- `presence` — free baseline (the "place" entry); no capabilities; gateway to convert businesses
- `discovery` — paid (Google SWIS surface + products)
- `storefront` — paid (platform storefront)

### Three paid public surfaces (upgrades from free place entry)

| Surface | Tier | Capability unlock |
|---------|------|-------------------|
| Platform directory | `directory_presence` → `presence` | Directory layouts (up to 4), featured products |
| Google SWIS | `discovery` | Google visibility integration + products |
| Platform storefront | `storefront` | Branded store + product browse |

### Deprecated: `expired_trial`

`expired_trial` is deprecated. `presence` now fulfills its role as the free baseline. Existing `expired_trial` tenants still resolve to `frozen` internal status for backward compatibility, but all new downgrades target `presence` + `active`.

## Strategic Possibilities Unlocked

### Capability-level trials

Instead of trialing an entire tier, trial a single capability domain (e.g., "14-day trial of `storefrontGallery`"). The resolver already supports per-feature overrides via `capabilityFeatures` on `ResolvedTier`; this is mostly a billing/UX layer on top.

### Capability marketplace

The BSaaS purchase path already exists for individual features (`tenant_feature_purchases` table, `bsaas_catalog` table). With capabilities as the primary gate, the feature store becomes the front door, and tiers become "bundles" rather than the only entry point.

### Org-level capability propagation

The `org_standing_mode` inheritance already lifts tenant status from org standing. The same mechanism could propagate capability grants (e.g., org buys `storefrontQr` for all locations). The resolver already merges org tier features; extending this to org-level BSaaS grants is an additive change.

### Capability-aware analytics

Since the resolver knows exactly what's enabled per tenant, growth tips, upgrade prompts, and feature discovery can all be driven by "what capabilities are you missing" rather than "what tier are you on." The `GrowthTipService` already partially does this; deepening it is a content task, not an architecture task.

## Anti-Patterns to Avoid

### Don't gate on tier keys

```ts
// BAD — couples behavior to billing bundle
if (tenant.subscription_tier === 'storefront') {
  renderStorefront();
}

// GOOD — gates on resolved capability
if (capabilities.storefront.enabled) {
  renderStorefront();
}
```

### Don't build separate "degradation mode" code paths

The capability resolver already handles degradation by returning fewer enabled domains. Don't add `if (status === 'expired') { renderLimitedView(); }` — let the capability gates close naturally.

### Don't delete data on downgrade

The whole point of soft degradation is that renewal is a one-step process (change the tier back). If you delete products, settings, or configurations on downgrade, you break the renewal path.

### Don't conflate status with tier

`subscription_status` is the billing relationship. `subscription_tier` is the billing bundle. Neither is the capability gate. The resolver is the gate.

## Related Skills

- `tier-hierarchy.md` — V3.1 tier ordering, layers, upgrade paths
- `three-tier-feature-gating.md` — flexible / explicit / BSaaS gating pattern for feature keys
- `capability-resolution-mv.md` — materialized view for bulk capability lookups
- `capability-domain-decouple.md` — domain decoupling pattern
- `capability-system-integration.md` — end-to-end capability system integration
- `capability-constraint-relationships.md` — cross-capability constraints
- `directory-presence-seed-claim/` — seed/claim workflow for the free gateway tier
- `add-capability-feature.md` — how to add a new capability feature
