---
description: Pre-resolved capability materialized view (mv_tenant_effective_capabilities) for fast bulk capability lookups without N resolver calls
---

# Capability Resolution Materialized View

## Problem

The `EffectiveCapabilityResolver` resolves capabilities per tenant by merging tier features, org tier features, and BSaaS purchases. This requires 3-5 DB queries per tenant. For directory listing pages showing 20-50 stores, calling the resolver N times is prohibitively expensive.

## Solution

`mv_tenant_effective_capabilities` is a general-purpose materialized view that pre-resolves **all** capability features for **all** tenants in a single query. Any API route can JOIN it by `(tenant_id, feature_key)` to get a boolean `is_enabled` flag without calling the resolver.

### Data Flow

```
Source tables                         MV                      API routes
┌─────────────────────┐
│ tier_features_list  │──┐
│ (tenant tier +      │  │
│  org tier features) │  │    ┌──────────────────────────┐    ┌──────────────────────┐
└─────────────────────┘  ├──▶│ mv_tenant_effective_     │──▶│ directory.ts         │
                         │   │ capabilities             │    │ directory-mv.ts      │
┌─────────────────────┐  │   │                          │    │ directory-consolidated│
│ tenant_feature_     │──┤   │ (tenant_id, feature_key,  │    │ any future route     │
│ purchases           │  │   │  is_enabled)              │    └──────────────────────┘
│ (BSaaS single +     │  │   └──────────────────────────┘
│  bundle + admin      │  │            ▲
│  complimentary)     │  │            │ Refresh every 10 min
└─────────────────────┘  │            │ via Supabase cron
                         │     ┌──────┴───────┐
┌─────────────────────┐  │     │ REFRESH      │
│ tenant_feature_     │──┘     │ MATERIALIZED │
│ overrides_list      │        │ VIEW         │
│ (admin grants)      │        │ CONCURRENTLY │
└─────────────────────┘        └──────────────┘

Flexible expansion (×3 sources):
  tier_features_list     → {capability_key}_flexible → expand to all features in capability type
  tenant_feature_purchases → {capability_key}_flexible → expand to all features in capability type
  tenant_feature_overrides_list → {capability_key}_flexible → expand to all features in capability type
```

### MV Definition

The MV mirrors the `EffectiveCapabilityResolver` merge logic exactly:

1. **Trial tier mapping**: Trial tiers (`trial_professional`, `trial_starter`, etc.) are mapped to their base tiers via a `trial_map` CTE, matching `getEffectiveTier()`.
2. **Tenant + org tier resolution**: Resolves effective tier keys for both the tenant's own tier and the org tier (if the tenant belongs to an organization).
3. **Tier feature collection**: Gathers all `tier_features_list` rows for the resolved tier IDs where `is_enabled = true`.
4. **Flexible tier expansion**: When a tier has a `{capability_key}_flexible` feature (e.g., `directory_entry_flexible`), expands to ALL features linked to that capability type via `capability_features_list`. This mirrors the resolver pattern where `flexible = !!features.{capability_key}_flexible` grants all features in the capability type.
5. **BSaaS purchase merging**: Adds `tenant_feature_purchases` rows with status in `('active', 'past_due', 'trial')` and not expired. Sources include single purchases from BSaaS Catalog, bundle purchases, and admin-granted complimentary promotions.
6. **Flexible purchase expansion**: When a tenant purchases a `{capability_key}_flexible` feature via BSaaS (single or bundle), expands to ALL features in that capability type — same logic as flexible tier expansion but driven by purchases.
7. **Admin override merging**: Adds `tenant_feature_overrides_list` rows where `granted = true` and not expired. Admin can grant any feature through the OverrideService.
8. **Flexible override expansion**: When an admin grants a `{capability_key}_flexible` override, expands to ALL features in that capability type.
9. **Most-permissive-wins union**: `UNION` of all six sources — one row per `(tenant_id, feature_key)` that is effectively enabled.

### Schema

```sql
Materialized view: mv_tenant_effective_capabilities
  tenant_id     TEXT
  feature_key   TEXT
  is_enabled    BOOLEAN (always TRUE — absence of a row means NOT enabled)

Indexes:
  UNIQUE (tenant_id, feature_key)  -- enables CONCURRENTLY refresh
  (feature_key)                    -- fast filtering by feature
```

**Key design point**: The MV only contains rows where `is_enabled = TRUE`. A missing row for a given `(tenant_id, feature_key)` pair means the feature is NOT enabled for that tenant. API queries use `LEFT JOIN` + `COALESCE(mec.is_enabled, false)` to handle this.

## When to Use

| Scenario | Use Resolver | Use MV |
|---|---|---|
| Single tenant capability check (e.g., settings page) | ✅ | ❌ |
| Bulk listing with per-tenant capability flag (e.g., directory) | ❌ | ✅ (JOIN) |
| Real-time capability check after purchase | ✅ | ❌ (stale up to 10 min) |
| API route returning N stores with capability-gated fields | ❌ | ✅ (JOIN) |
| Admin UI checking capabilities for a specific tenant | ✅ | ❌ |
| Public effective-capabilities endpoint (`GET /:tenantId/effective-capabilities`) | ✅ | ❌ |

**Rule of thumb**: If you're returning a list of tenants/stores and need a capability flag per row, use the MV. If you're checking a single tenant's capabilities in real-time (settings, post-purchase, write routes), use the resolver.

### MV-Based Endpoint Resolver

`resolveEffectiveCapabilitiesFromMV(tenantIdOrSlug, opts)` in `EffectiveCapabilityResolver.ts` provides the same output shape as `resolveEffectiveCapabilities` but reads raw capabilities from the MV instead of running 5+ queries.

- **Used by**: Bulk listing routes only (directory.ts, directory-mv.ts, directory-consolidated.ts). NOT used by `GET /api/tenants/:tenantId/effective-capabilities` — that endpoint uses `resolveEffectiveCapabilities` for real-time data.
- **Cache**: Separate `MV_CACHE` (60s TTL), invalidated alongside `MEMORY_CACHE` by `invalidateEffectiveCapabilities`
- **Pipeline**: MV lookup → per-domain resolvers → cross-capability constraints → subscription-status override → cache
- **Trade-off**: Raw feature data is up to 10 minutes stale (MV refresh interval). Merchant settings are always fresh (fetched in real-time). Acceptable for public/read-only surfaces.

## Flexible Feature Sources

A `{capability_key}_flexible` feature (e.g., `directory_entry_flexible`) grants ALL features in that capability type. The MV expands flexible features from three sources:

| Source | Table | How Flexible is Granted |
|---|---|---|
| **Tier inheritance** | `tier_features_list` | Admin assigns `_flexible` to a tier via Admin UI at `/settings/admin/capabilities` |
| **BSaaS purchase** | `tenant_feature_purchases` | Merchant purchases `_flexible` from BSaaS Catalog at `/settings/admin/bsaas-catalog` (single or bundle) |
| **Admin override** | `tenant_feature_overrides_list` | Admin grants `_flexible` via OverrideService (Promotion Catalog, BSaaS Catalog, or direct override) |

Each source has its own CTE in the MV definition that expands the `_flexible` key into all feature keys linked to the same capability type via `capability_features_list`.

## How to Use

### Step 1: JOIN the MV in your SQL query

```sql
SELECT
  dll.tenant_id,
  dll.business_name,
  -- ... other fields ...
  COALESCE(mec.is_enabled, false) as can_use_external_link
FROM directory_listings_list dll
INNER JOIN tenants t ON dll.tenant_id = t.id
LEFT JOIN mv_tenant_effective_capabilities mec
  ON mec.tenant_id = dll.tenant_id
  AND mec.feature_key = 'directory_entry_external_link'
```

### Step 2: Map the flag in your response

```typescript
canUseExternalLink: row.can_use_external_link || false,
```

### Step 3: Use the flag in frontend components

```tsx
const canUseExternal = store.canUseExternalLink && !!store.website;
const destinationUrl = canUseExternal
  ? store.website
  : `/directory/${store.tenantId}`;
```

## Adding a New Capability Feature to the MV

The MV is general-purpose — no changes needed when adding a new feature key. The MV automatically includes any feature that appears in `tier_features_list` or `tenant_feature_purchases`.

### Checklist for a new feature using the MV

1. **Seed the feature key** in `features_list` and link to `capability_type_list` via `capability_features_list` (see `add-capability-feature.md` skill).
2. **Assign to tiers** via Admin UI at `/settings/admin/capabilities`.
3. **Add merchant preference column** if the feature has a per-tenant toggle (e.g., `external_link_enabled` in `tenant_storefront_options_settings`).
4. **JOIN the MV** in the relevant API route(s), filtering by your `feature_key`.
5. **Map the flag** in the API response.
6. **Use the flag** in frontend components to gate behavior.
7. **Refresh the MV** after tier assignments change (or wait up to 10 minutes for the cron job).

## Refresh Strategy

### Scheduled refresh (production)

Set up a Supabase cron job to refresh every 10 minutes:

```sql
SELECT cron.schedule(
  'refresh-mv_tenant_effective_capabilities',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities$$
);
```

`CONCURRENTLY` is supported because of the unique index on `(tenant_id, feature_key)`. This means reads are not blocked during refresh.

### Manual refresh (after admin changes)

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities;
```

### Staleness window

The MV can be up to 10 minutes stale. This is acceptable for directory listing pages where the capability flag controls UI behavior (e.g., showing an external link vs. internal link). For real-time capability checks (e.g., immediately after a BSaaS purchase), use the `EffectiveCapabilityResolver` directly.

## Performance Characteristics

- **MV size**: ~1,700 rows for ~200 tenants × ~8 features (scales linearly with tenants × features)
- **Refresh time**: < 1 second with `CONCURRENTLY`
- **Query impact**: Single `LEFT JOIN` with index lookup — negligible overhead vs. base query
- **Compared to resolver**: Eliminates 3-5 DB queries × N tenants per request

## Trial Tier Mapping

The MV includes a `trial_map` CTE that maps trial tiers to base tiers, matching `getEffectiveTier()` in the resolver:

```sql
trial_google_only        → google_only
trial_discovery          → discovery
trial_starter            → starter
trial_storefront         → storefront
trial_commitment         → commitment
trial_professional       → professional
trial_ecommerce          → ecommerce
trial_omnichannel        → omnichannel
trial_enterprise         → enterprise
trial_chain_starter      → chain_starter
trial_chain_professional → chain_professional
trial_chain_enterprise   → chain_enterprise
```

If a new trial tier is added, update both the MV definition and `getEffectiveTier()` in the resolver.

## Existing API Routes Using the MV

| Route File | Feature Key | Flag Name |
|---|---|---|
| `apps/api/src/routes/directory.ts` | `directory_entry_external_link` | `canUseExternalLink` |
| `apps/api/src/routes/directory-mv.ts` | `directory_entry_external_link` | `canUseExternalLink` |
| `apps/api/src/routes/directory-consolidated.ts` | `directory_entry_external_link` | `canUseExternalLink` |

## Migration File

The MV was created in `database/migrations/089_directory_entry_external_link.sql` (Part 3). The migration file also includes verification queries at the bottom.

## Org Standing Mode & the MV

The `org_standing_mode` column on `tenants` (`'independent'` default, `'inherited'`) controls **subscription-status gating only**, NOT tier feature resolution. This means:

- **The MV is unaffected by standing mode.** The MV resolves which features a tenant has from its tier, purchases, and overrides. Standing mode only affects whether the tenant's subscription status is lifted to `active` by a healthy org (asymmetric inheritance).
- **The tenant's own tier is always used for feature resolution.** `resolveOrgStandingInheritance()` in `utils/org-standing-inheritance.ts` explicitly preserves the tenant's tier — it only overrides `effectiveStatus`, not `effectiveTier`.
- **The resolver's Step 6** (subscription-status override in `EffectiveCapabilityResolver.ts`) already applies the standing-mode-aware status before running the `isReadOnly`/`isLimited` override blocks. The MV does not need to replicate this because the MV only stores feature keys, not subscription status.

**`standing_mode_grace_until`**: When an org falls out of good standing, inherited tenants get a 7-day grace period before auto-flipping to `independent`. The `org-standing-inheritance.ts` batch job handles this. The MV remains unaffected throughout — feature keys don't change, only the subscription-status override does.

**`tier_change_logs_list`**: Audit log for tier system admin changes (entity_type, action, before/after state, changed_by). Does NOT affect the MV or resolver at runtime — it's a compliance/audit trail for the admin tier-system routes (`/api/admin/tier-system/change-logs`).

**`tier_catalog_permissions`**: Tier-level permissions for the global supplier catalog (browse, add, override, edit, remove). This is a separate concern from capability resolution — it gates catalog management actions, not feature flags. The MV does not need to incorporate this.

## Related Skills

- `add-capability-feature.md` — How to add a new feature key
- `three-tier-feature-gating.md` — Tier gating, BSaaS purchases, merchant preferences
- `capability-deployment-flow.md` — End-to-end capability deployment checklist
