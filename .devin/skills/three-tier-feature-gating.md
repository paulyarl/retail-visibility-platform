---
description: Three-tier gating pattern for capability features — flexible tiers get features automatically, non-flexible tiers need explicit assignment, and lower tiers can purchase via BSaaS store
---

# Three-Tier Feature Gating Pattern

This document defines the canonical pattern for gating capability features across subscription tiers. Every feature key in `tier_features_list` should follow this pattern.

## The Three Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Feature Availability                          │
├──────────────────┬──────────────────┬──────────────────────────┤
│  1. Flexible     │  2. Explicit     │  3. BSaaS Purchasable    │
│  (automatic)     │  (assigned)      │  (self-service purchase) │
├──────────────────┼──────────────────┼──────────────────────────┤
│  Tier has        │  Tier does NOT   │  Tier does NOT have      │
│  product_options │  have flexible,  │  flexible or explicit    │
│  _flexible flag  │  but feature is  │  assignment — tenant     │
│                  │  explicitly      │  purchases via BSaaS     │
│  Resolver auto-  │  assigned in     │  store                   │
│  enables all     │  tier_features_  │                          │
│  creation/       │  list            │  tenant_feature_         │
│  layout/sections │                  │  purchases table         │
│  features        │                  │                          │
├──────────────────┼──────────────────┼──────────────────────────┤
│  No DB row       │  DB row with     │  No tier_features_list   │
│  needed in       │  is_enabled=true │  row, but bsaas_catalog  │
│  tier_features_  │  in tier_        │  entry required +        │
│  list            │  features_list   │  tenant_feature_         │
│                  │                  │  purchases row at runtime│
└──────────────────┴──────────────────┴──────────────────────────┘
```

## How the Resolver Handles It

The `ProductOptionsResolver` (and other resolvers) check features in order:

```ts
// Example from ProductOptionsResolver.ts:67
const showsSupplierCatalog =
  isFlexible ||                          // Tier 1: flexible → automatic
  creationGroupEnabled ||                // Group gate enabled
  !!features.product_options_creation_supplier_catalog;  // Tier 2: explicit
```

For Tier 3 (BSaaS), the `EffectiveCapabilityResolver.fetchRawCapabilities()` auto-merges active purchases into the same `mergedFeatures` map, so the resolver sees the feature as enabled without any additional code.

```
tier_features_list (org)  ──┐
tier_features_list (tenant)──┤── mergedFeatures Map ──→ Per-domain Resolver
tenant_feature_purchases  ──┘    (OR merge)
```

The resolver is **source-agnostic** — it only asks "is this feature in the allowed list?" not "how did it get here?"

## Which Tiers Are Flexible?

Flexible tiers have `product_options_flexible` enabled in `tier_features_list`. As of last query:

| Tier Key | Flexible? |
|----------|-----------|
| professional | ✅ |
| chain_professional | ✅ |
| organization | ✅ |
| enterprise | ✅ |
| trial_professional | ✅ |

**All other tiers are non-flexible** and need either explicit assignment or BSaaS purchase.

> **Important**: Always query the database to confirm current flexible tier assignments — the admin UI can change these at any time:
> ```sql
> SELECT stl.tier_key, tfl.is_enabled
> FROM tier_features_list tfl
> JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
> WHERE tfl.feature_key = 'product_options_flexible'
>   AND tfl.is_enabled = true
> ORDER BY stl.sort_order;
> ```

## Decision Matrix: Which Tier Applies?

| Condition | Tier | Action |
|-----------|------|--------|
| Tier has `product_options_flexible` | Flexible | No assignment needed — resolver auto-enables |
| Tier is non-flexible, feature should be bundled | Explicit Assignment | Insert row in `tier_features_list` with `is_enabled=true` |
| Tier is non-flexible, feature should NOT be bundled | BSaaS Purchasable | Add entry to `bsaas_catalog` — tenant purchases via store |

## Migration Pattern

When migrating a feature from "enabled for all" to the three-tier pattern:

### Step 1: Identify tier categories

```sql
-- Which tiers are flexible?
SELECT tier_key FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE tfl.feature_key = 'product_options_flexible' AND tfl.is_enabled = true;

-- Which tiers currently have the feature?
SELECT tier_key, is_enabled FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE tfl.feature_key = '<your_feature_key>'
ORDER BY stl.sort_order;
```

### Step 2: Remove assignment from lower tiers

```sql
DELETE FROM tier_features_list
WHERE feature_key = '<your_feature_key>'
  AND tier_id IN (
    SELECT id FROM subscription_tiers_list
    WHERE tier_key IN ('discovery', 'storefront',
                       'trial_discovery', 'trial_storefront')
  );
```

### Step 3: Keep explicit assignment for mid tiers

No action needed — the existing rows in `tier_features_list` remain.

### Step 4: Add BSaaS catalog entry

```sql
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  '<your_feature_key>',
  '<Marketing Name>',
  '<Description for merchants>',
  <price_in_cents>,
  'monthly',
  <trial_days>,
  true,
  <sort_order>
)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  billing_cycle = EXCLUDED.billing_cycle,
  trial_days = EXCLUDED.trial_days,
  updated_at = NOW();
```

### Step 5: Verify

```sql
-- Verify tier assignments
SELECT stl.tier_key, tfl.is_enabled
FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE tfl.feature_key = '<your_feature_key>'
ORDER BY stl.sort_order;

-- Verify BSaaS catalog entry
SELECT * FROM bsaas_catalog WHERE feature_key = '<your_feature_key>';
```

## Worked Example: Supplier Catalog Import

**Feature key**: `product_options_creation_supplier_catalog`

| Tier Category | Tiers | How They Get It |
|---------------|-------|-----------------|
| Flexible | professional, chain_professional, organization, enterprise, trial_professional | Automatic via resolver |
| Explicit (mid-tier) | commitment, ecommerce, omnichannel, chain_starter + trials | `tier_features_list` assignment (from migration 082) |
| BSaaS Purchasable | discovery, storefront + trials | Purchase via Feature Store ($15/mo, 14-day trial) |

**Migration files**:
- `082_supplier_catalog_capability.sql` — Initial setup, enabled for all tiers
- `083_supplier_catalog_tier_strategy.sql` — Applies three-tier pattern: removes lower-tier assignments, adds BSaaS catalog entry

## Architectural Insights

### The Platform Engineer's Decision Space

The only decision for platform engineers is whether a specific feature is part of the three-tier feature economy. Once that single decision is made, the architecture handles everything else automatically:

1. **Add the feature key** to `features_list` + link to capability type (SQL or admin UI)
2. **Decide: is this feature in the three-tier economy?**
   - If yes → assign to mid tiers via `tier_features_list`, add BSaaS catalog entry for lower tiers
   - If no → just seed it for all tiers or leave it flexible-only
3. **Done.** Resolver picks it up, frontend hooks work, routes are gated, purchases flow through.

No route changes, no middleware changes, no frontend flag wiring, no custom purchase logic. The resolver, BSaaS catalog, tenant purchases, and capability hooks all already exist and just need a feature key to operate on.

### Shared Control Model

The defining characteristic of this architecture is **shared control** between platform and merchants. Most platforms pick one side:

- **Platform-only control** (feature flags, LaunchDarkly, etc.) — platform toggles, merchants have no say. Rigid, top-down.
- **Merchant-only control** (app marketplace add-ons) — merchants buy whatever they want, platform has no bundling strategy. Chaos at scale.

This architecture creates **negotiated control** where both sides have authority at different layers:

| Layer | Who Controls | Mechanism |
|-------|-------------|-----------|
| Capability type + feature keys | Platform | `capability_type_list` + `features_list` |
| Tier bundling | Platform | `tier_features_list` — which tiers get what by default |
| BSaaS catalog pricing | Platform | `bsaas_catalog` — what's purchasable, at what price |
| Tier assignment | Platform | Admin UI — explicit per-tier enable/disable |
| **Feature purchase** | **Merchant** | `tenant_feature_purchases` — buy what they need |
| **Merchant gate toggle** | **Merchant** | `tenant_product_options_settings` — enable/disable at store level |

The platform shapes the economy (what's bundled, what's purchasable, pricing). The merchant shapes their own experience (what to buy, what to toggle on). Neither side has full control — and that's what makes it work at scale.

With hundreds of features, platform-only control becomes unmanageable — every tier change requires engineering work. Merchant-only control becomes chaotic — no bundling strategy, no upsell path. Shared control scales because each side manages their own layer.

### Why Not Feature Flags?

Feature flags and the capability architecture solve different problems. Feature flags are binary toggles (on/off per tenant) designed for platform-controlled rollout. The capability architecture is a multi-source entitlement system designed for shared control.

What the capability architecture handles that feature flags cannot:

| Concern | Feature Flags | Capability Architecture |
|---------|--------------|------------------------|
| Tier bundling | No tier concept — manual per-tenant overrides | `tier_features_list` — bulk tier assignment via admin UI |
| Purchasable features | No path — would need a parallel purchase system | `bsaas_catalog` + `tenant_feature_purchases` — first-class citizen |
| Unified resolution | Each route does its own flag check | `EffectiveCapabilityResolver` merges all sources into one capabilities map |
| Tier flexibility | Hardcode tier checks in middleware | `isFlexible` flag in resolver — automatic feature unlock |
| Merchant control | `allow_tenant_override` exists but no tier awareness | Merchant gates sit on top of tier/purchase entitlements |
| Frontend state | `useFeatureFlag` returns boolean only | Capability hooks return full state (enabled, tier, purchase status, allowed plans) |
| BSaaS store | Does not exist | Self-service purchase flow with trials, billing cycles, renewal |

The resolver is **source-agnostic** — it merges tier features, explicit assignments, and purchases into a single capabilities map. Routes and frontend hooks ask "is this feature enabled?" without caring how it got there. With feature flags, every route needs its own `requireFlag` middleware with no merging, no purchasing, no tier awareness.

### Scale Considerations

With hundreds of features working together to control behaviors for both platform and merchants, the three-tier pattern scales because:

- **Platform engineers** make one decision per feature (in the economy or not), not per-route or per-tier
- **Admins** manage tier assignments through a UI, not through code deployments
- **Merchants** self-serve via the Feature Store, not through support tickets
- **The resolver** handles all merging automatically — no per-feature integration code
- **Cache invalidation** is centralized — purchase changes trigger capability cache refresh without route-level coordination

## Verification Insight: DB Assignments vs Resolved State

Queries against `tier_features_list` show **explicit DB assignments**, not **resolved runtime capabilities**. These are not the same thing:

| Source | Visible in `tier_features_list` query? | Visible to resolver at runtime? |
|--------|---------------------------------------|--------------------------------|
| Explicit tier assignment | ✅ Yes — row exists | ✅ Yes — feature map includes it |
| Flexible tier (via `isFlexible`) | ❌ No — no row needed | ✅ Yes — resolver short-circuits on `isFlexible` |
| BSaaS purchase | ❌ No — in `tenant_feature_purchases` | ✅ Yes — resolver merges purchases into feature map |

This means:

- **Flexible tiers** (professional, chain_professional, organization, enterprise) will have the feature at runtime even with **zero rows** in `tier_features_list`. The resolver checks `isFlexible` first, before looking at the feature map.
- **Explicit assignments** for flexible tiers are **redundant but harmless** — the resolver short-circuits on `isFlexible` before reaching the feature check. They can make verification queries misleading by appearing to be the source of enablement.
- **The only way to verify runtime behavior** is to call the resolver API (`resolveEffectiveCapabilities`) or test the actual route/feature, not to query `tier_features_list` alone.

### Recommended Verification Approach

A single query combining flexible tiers, explicit assignments, and BSaaS catalog status gives the full picture:

```sql
-- Combined: shows all tiers with their feature source (flexible, explicit, or purchasable)
WITH flexible_tiers AS (
  SELECT tfl.tier_id
  FROM tier_features_list tfl
  WHERE tfl.feature_key = 'product_options_flexible' AND tfl.is_enabled = true
),
explicit_tiers AS (
  SELECT tfl.tier_id, tfl.is_enabled
  FROM tier_features_list tfl
  WHERE tfl.feature_key = '<your_feature_key>'
)
SELECT
  stl.tier_key,
  stl.display_name,
  CASE
    WHEN ft.tier_id IS NOT NULL THEN 'flexible (automatic)'
    WHEN et.tier_id IS NOT NULL AND et.is_enabled THEN 'explicit (assigned)'
    WHEN et.tier_id IS NOT NULL AND NOT et.is_enabled THEN 'explicit (disabled)'
    WHEN bc.feature_key IS NOT NULL THEN 'purchasable (BSaaS store)'
    ELSE 'none'
  END AS feature_source
FROM subscription_tiers_list stl
LEFT JOIN flexible_tiers ft ON ft.tier_id = stl.id
LEFT JOIN explicit_tiers et ON et.tier_id = stl.id
LEFT JOIN bsaas_catalog bc ON bc.feature_key = '<your_feature_key>' AND bc.is_active = true
WHERE stl.is_active = true
ORDER BY stl.sort_order;
```

For runtime verification of tenant-level purchases:

```sql
-- Check active purchases by lower-tier merchants
SELECT tenant_id, feature_key, status, expires_at
FROM tenant_feature_purchases
WHERE feature_key = '<your_feature_key>' AND status = 'active';
```

> **Rule**: Never rely solely on `tier_features_list` queries to determine feature availability. Flexible tiers and BSaaS purchases are invisible to this query but are fully active at runtime via the resolver.

## Related Documents

- **`add-bsaas-feature.md`** — How to add a purchasable feature to the BSaaS store
- **`capability-deployment-flow.md`** — 8-phase deployment pipeline for capabilities
- **`capability-data-flow-rules.md`** — Canonical data flow rules (R14-R17)
- **`add-capability-feature.md`** — How to add a new feature key to the capability system
