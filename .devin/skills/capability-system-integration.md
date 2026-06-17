---
description: How to add, gate, and surface a new capability in the RVP tier-based feature system
---

# Capability System Integration Guide

This document describes how to add a new tier-gated capability to the VisibleShelf platform so it flows correctly from definition through to the merchant gate settings page.

## Architecture Overview

The capability system has **5 layers**, all of which must be updated for a new capability to work end-to-end:

```
1. Definition Layer (code)     → canonical-features.ts + tier-hierarchies.ts
2. Database Layer (seeded)     → capability_type_list + tier_features_list + features_list
3. Resolver Layer (runtime)    → Backend resolver (e.g., FeaturedOptionsResolver.ts)
4. Route Layer (API)           → Settings PUT route + unified endpoint GET
5. Frontend Layer (merchant)   → Settings page + UnifiedCapabilityService mapper
```

**Unified endpoint** (`GET /api/tenants/:tenantId/effective-capabilities`) is the single source of truth for all capability state. It performs a single DB round-trip, dispatches to per-domain resolvers, and returns pre-resolved effective state. The frontend `UnifiedCapabilityService` maps this response — it does not resolve.

## Step-by-Step: Adding a New Capability

### 1. Definition Layer

**File**: `packages/feature-definitions/src/definitions/canonical-features.ts`

Add a new entry to `CANONICAL_FEATURES`:

```ts
'my_capability': {
  key: 'my_capability',
  name: 'My Capability',
  description: 'What this capability does',
  category: 'product' | 'commerce' | 'analytics' | 'branding' | 'integration' | 'ui',
  metadata: { ... }
},
```

**File**: `packages/feature-definitions/src/definitions/tier-hierarchies.ts`

Add the capability key to the appropriate tier's feature array. Features cascade upward via spread (`...LOWER_TIER_FEATURES`).

- `DISCOVERY_FEATURES` (level 1)
- `STARTER_FEATURES` (level 2)
- `STOREFRONT_FEATURES` (level 3)
- `COMMITMENT_FEATURES` (level 4)
- `PROFESSIONAL_FEATURES` (level 5)
- Enterprise inherits from Professional

### 2. Database Layer

Seed the capability into the database. Follow the pattern in `apps/api/prisma/seed-crm-capabilities.ts`:

1. **`capability_type_list`** — Create a capability type entry (e.g., key=`featured_options`)
2. **`features_list`** — Create feature entries for each toggle (e.g., `featured_expiry_monitor`)
3. **`capability_features_list`** — Link features to the capability type
4. **`tier_features_list`** — Enable features per tier with `is_enabled` and `is_inherited` flags

Also add columns to the tenant settings table if the capability has a merchant-togglable preference:

```sql
ALTER TABLE tenant_featured_options_settings
ADD COLUMN featured_expiry_monitor Boolean DEFAULT false;
```

Update the Prisma schema model to match (`apps/api/prisma/schema.prisma`).

### 3. Resolver Layer

Each capability domain has a backend resolver in `apps/api/src/services/resolvers/` (e.g., `FeaturedOptionsResolver.ts`, `CrmOptionsResolver.ts`).

**Pattern**:
- Export a `resolve{Domain}Options` function accepting `(features, merchantPrefs)`
- Map tier feature keys → `allowed_*` arrays / booleans
- Apply merchant soft toggles → `effective_*` arrays / booleans
- Return an `Effective{Domain}` object (add the interface to `resolvers/types.ts`)

The orchestrator `EffectiveCapabilityResolver.ts` fetches all merchant settings in a single DB round-trip, then dispatches to each resolver.

Add the new capability flag to:
- The `Effective{Domain}` interface in `resolvers/types.ts`
- The resolver's `resolveFromFeatures()` or main resolution function
- The `getDisabledState()` equivalent (return object with all flags `false`)

Example:
```ts
// In resolvers/types.ts
export interface BackendEffectiveFeaturedOptions {
  enabled: boolean;
  allowed_types: string[];
  effective_types: string[];
  expiry_monitor_enabled: boolean;  // NEW
  merchant_preferences: {
    featured_enabled: boolean;
    featured_expiry_monitor: boolean;  // NEW
    // ...
  };
}

// In FeaturedOptionsResolver.ts
export function resolveFeaturedOptions(
  features: Record<string, boolean>,
  merchantSettings: FeaturedOptionsMerchantSettings | null
): BackendEffectiveFeaturedOptions {
  const allowedTypes = [...]; // from features
  const prefs = merchantSettings || {};

  return {
    enabled: allowedTypes.length > 0,
    allowed_types: allowedTypes,
    effective_types: allowedTypes.filter(t =>
      t !== 'expiry_monitor' ? prefs[`featured_${t}`] !== false : prefs.featured_expiry_monitor !== false
    ),
    expiry_monitor_enabled: !!features.featured_expiry_monitor,  // NEW
    merchant_preferences: {
      featured_enabled: !!prefs.featured_enabled,
      featured_expiry_monitor: !!prefs.featured_expiry_monitor,  // NEW
      // ...
    },
  };
}
```

### 4. Route Layer

**File**: `apps/api/src/routes/*-options-settings.ts`

Each capability domain has a settings route with:

- **PUT** endpoint — validates each toggle against tier capabilities before saving, then invalidates the unified cache
- **GET** endpoint — returns tier-gate-filtered settings (authenticated, for settings pages)
- **Public GET** — deprecated; the unified endpoint (`/effective-capabilities`) is now the single source of truth for storefront rendering

For the PUT endpoint, add the new field to:
1. Zod validation schema
2. Default settings object
3. All-false return objects (when tier gate is disabled)
4. Tier-filtered settings construction
5. PUT response object

**Tier-gate enforcement pattern**:
```ts
// GET: force off if tier doesn't have capability
tierFilteredSettings.featured_expiry_monitor =
  !!rawSettings.featured_expiry_monitor && tierState.expiryMonitorEnabled;

// PUT: reject enabling if tier doesn't have capability
if (key === 'featured_expiry_monitor') {
  if (value && !tierState.expiryMonitorEnabled) {
    return res.status(403).json({ error: 'tier_restricted', ... });
  }
  filteredData[key] = value;
  continue;
}
```

**Cache invalidation** (critical):
```ts
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

// After successful prisma update in PUT handler:
await invalidateEffectiveCapabilities(tenantId);
```

This ensures the unified endpoint serves fresh data on the next request.

### 5. Frontend Layer

**Settings page**: `apps/web/src/app/t/[tenantId]/settings/<capability>-options/`

- Add field to the settings interface
- Add to `useState` default
- Add to `loadSettings` response mapping
- Add a UI card/section with a `Switch` component
- Use `useXxxCapability(tenantId)` hook to get effective state from `UnifiedCapabilityService`
- Disable the switch when the unified state shows the feature is not allowed by tier
- Show "Not included in your plan" or "Professional plan and above" label

**UnifiedCapabilityService mapper**: `apps/web/src/services/UnifiedCapabilityService.ts`

- Add the new backend field to the `BackendEffective{Domain}` interface
- Map it in the `map{Domain}` function into the frontend state object
- The mapper should preserve `enabled` at the top level and expose `effective_*` values
- Do not add resolution logic — the backend already resolved everything

**PlanSummaryPanel**: `apps/web/src/components/settings/PlanSummaryPanel.tsx`

- Uses `capabilities` prop from `AllCapabilitiesState` (mapped from unified endpoint)
- Each card shows enabled/disabled status using `capability.enabled` (not `Object.keys(capability.features).length`)
- New sub-capabilities under an existing group appear automatically if the unified endpoint returns them

**TenantDashboardV2**: `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

- `CapabilityShowcase` component renders capability cards on the dashboard
- `useAllCapabilities` hook provides the full capability state from `UnifiedCapabilityService`

## Key Patterns

### Backend Resolvers
All resolution happens in backend resolvers under `apps/api/src/services/resolvers/`. Each resolver is a pure function — not a class singleton:

```ts
import { resolveFeaturedOptions } from '../services/resolvers/FeaturedOptionsResolver';
const state = resolveFeaturedOptions(features, merchantSettings);
```

The orchestrator `EffectiveCapabilityResolver.ts` calls all resolvers in parallel after a single DB round-trip.

### Frontend Mapping (No Resolution)
The frontend `UnifiedCapabilityService` only maps. It calls the unified endpoint once and converts backend shapes to frontend types:

```ts
const commerceState = await unifiedCapabilityService.getCommerceState(tenantId);
// commerceState is pre-resolved; no client-side logic needed
```

Do not add resolution logic in the frontend. If you need a new computed field, add it to the backend resolver.

### Most-Permissive-Wins
When a tenant belongs to an organization with a higher tier, features are merged as a union — the most permissive tier wins. This is handled by `getMergedTierFeatures()` in the orchestrator before dispatching to resolvers.

### Trial Tier Transparency
Use `getEffectiveTier()` from `utils/trial-tier-transparency.ts` to map trial tiers to their base tiers for feature resolution. This happens in the orchestrator before resolver dispatch.

### Tier-Capability SQL
For raw SQL queries that need to gate by capability, use the SQL fragments in `utils/tier-capability-sql.ts`:
- `TIER_CAPABILITY_CTE` — builds a CTE with per-tier feature flags
- `TIER_CAPABILITY_WHERE` — AND clause for tier gate
- `TENANT_PREFS_WHERE` — AND clause for merchant preference gate

### Scheduled Jobs
When a scheduled job needs to check a capability, call the unified endpoint (or use the resolver directly if you already have the features map):

```ts
// Option A: call unified endpoint (respects cache)
const allCaps = await effectiveCapabilityResolver.getEffectiveCapabilities(tenantId);
if (!allCaps.featured.expiry_monitor_enabled) continue;

// Option B: use resolver directly (if you have features already)
const featuredState = resolveFeaturedOptions(features, merchantSettings);
if (!featuredState.expiry_monitor_enabled) continue;
```

This ensures the job respects both the tier gate AND the merchant's toggle preference.

## Existing Capability Domains

| Domain | Backend Resolver | Settings Table | Settings Route | Frontend Mapper |
|--------|----------------|---------------|----------------|-----------------|
| Commerce | `CommerceResolver.ts` | `tenant_commerce_settings` | `commerce-settings.ts` | `mapCommerce` |
| Payment Gateway | `PaymentGatewayResolver.ts` | `tenant_payment_gateway_settings` | `payment-gateway-settings.ts` | `mapPaymentGateway` |
| Storefront Type | `StorefrontTypeResolver.ts` | `tenant_storefront_type_settings` | `storefront-type-settings.ts` | `mapStorefront` |
| Fulfillment | `FulfillmentResolver.ts` | `tenant_fulfillment_settings` | `fulfillment-settings.ts` | `mapFulfillment` |
| Product Options | `ProductOptionsResolver.ts` | `tenant_product_options_settings` | `product-options-settings.ts` | `mapProductOptions` |
| Featured Options | `FeaturedOptionsResolver.ts` | `tenant_featured_options_settings` | `featured-options-settings.ts` | `mapFeatured` |
| Storefront Options | `StorefrontOptionsResolver.ts` | `tenant_storefront_options_settings` | `storefront-options-settings.ts` | `mapStorefrontOptions` |
| Integration | `IntegrationOptionsResolver.ts` | `tenant_integration_settings` | `integration-options-settings.ts` | `mapIntegration` |
| Quickstart | `QuickstartOptionsResolver.ts` | `tenant_quickstart_options_settings` | `quickstart-options-settings.ts` | `mapQuickstart` |
| FAQ | `FaqOptionsResolver.ts` | `tenant_faq_options_settings` | `faq-options-settings.ts` | `mapFaqOptions` |
| CRM | `CrmOptionsResolver.ts` | `tenant_crm_options_settings` | `crm-options-settings.ts` | `mapCrmOptions` |
| Barcode Scan | `BarcodeScanResolver.ts` | `tenant_barcode_scan_settings` | `barcode-scan-options-settings.ts` | `mapBarcodeScan` |

All backend resolvers are pure functions called by `EffectiveCapabilityResolver.ts`. The frontend `UnifiedCapabilityService` maps their output. The old `*OptionsService` classes are deprecated.
