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
3. Service Layer (runtime)     → OptionsService (e.g., FeaturedOptionsService, CrmOptionsService)
4. Route Layer (API)           → options-settings route (GET/PUT with tier-gate enforcement)
5. Frontend Layer (merchant)   → Settings page + PlanSummaryPanel + CapabilityShowcase
```

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

### 3. Service Layer

Each capability domain has an `*OptionsService` singleton (e.g., `FeaturedOptionsService`, `CrmOptionsService`, `FaqOptionsService`).

**Pattern**:
- Class with `private static instance` and `getInstance()`
- `resolveXxxOptionsState(tenantId)` → returns a typed state object
- Reads tenant tier → queries `tier_features_list` → merges features (most-permissive-wins across org + tenant tiers)
- Returns state with boolean flags for each sub-capability

Add the new capability flag to:
- The state interface (e.g., `FeaturedOptionsState`)
- The `resolveFromFeatures()` method
- The `getDisabledState()` method

Example:
```ts
export interface FeaturedOptionsState {
  // ... existing fields
  expiryMonitorEnabled: boolean;  // NEW
}

resolveFromFeatures(features: Record<string, boolean>): FeaturedOptionsState {
  return {
    // ... existing fields
    expiryMonitorEnabled: !!features.featured_expiry_monitor,  // NEW
  };
}
```

### 4. Route Layer

**File**: `apps/api/src/routes/*-options-settings.ts`

Each OptionsService has a corresponding settings route with:

- **GET** endpoint — returns tier-gate-filtered settings (force off features not in tier)
- **PUT** endpoint — validates each toggle against tier capabilities before saving
- **Public GET** — same as GET but without auth (for storefront rendering)

For each endpoint, add the new field to:
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

### 5. Frontend Layer

**Settings page**: `apps/web/src/app/t/[tenantId]/settings/<capability>-options/`

- Add field to the settings interface
- Add to `useState` default
- Add to `loadSettings` response mapping
- Add a UI card/section with a `Switch` component
- Use `useXxxCapability(tenantId)` hook to get tier state
- Disable the switch when tier doesn't have the capability
- Show "Not included in your plan" or "Professional plan and above" label

**PlanSummaryPanel**: `apps/web/src/components/settings/PlanSummaryPanel.tsx`

- The `resolveCapabilitySummaries()` function maps capability groups to display cards
- Each card shows enabled/disabled status and merchant-gate state
- New sub-capabilities under an existing group (like `featured_options`) appear automatically if the service returns them in `tierState`

**TenantDashboardV2**: `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

- `CapabilityShowcase` component renders capability cards on the dashboard
- `useAllCapabilities` hook provides the full capability state

## Key Patterns

### Singleton Services
All OptionsServices use the singleton pattern. Always call via `getInstance()`:
```ts
const state = await FeaturedOptionsService.getInstance().resolveFeaturedOptionsState(tenantId);
```

### Most-Permissive-Wins
When a tenant belongs to an organization with a higher tier, features are merged as a union — the most permissive tier wins.

### Trial Tier Transparency
Use `getEffectiveTier()` from `utils/trial-tier-transparency.ts` to map trial tiers to their base tiers for feature resolution.

### Tier-Capability SQL
For raw SQL queries that need to gate by capability, use the SQL fragments in `utils/tier-capability-sql.ts`:
- `TIER_CAPABILITY_CTE` — builds a CTE with per-tier feature flags
- `TIER_CAPABILITY_WHERE` — AND clause for tier gate
- `TENANT_PREFS_WHERE` — AND clause for merchant preference gate

### Scheduled Jobs
When a scheduled job needs to check a capability, use the OptionsService rather than hardcoding tier names:
```ts
const featuredState = await FeaturedOptionsService.getInstance().resolveFeaturedOptionsState(tenantId);
if (!featuredState.expiryMonitorEnabled) continue;
```

This ensures the job respects both the tier gate AND the merchant's toggle preference.

## Existing Capability Domains

| Domain | Service | Settings Table | Route |
|--------|---------|---------------|-------|
| Featured Products | `FeaturedOptionsService` | `tenant_featured_options_settings` | `featured-options-settings.ts` |
| CRM | `CrmOptionsService` | `tenant_crm_options_settings` | `crm-options-settings.ts` |
| FAQ | `FaqOptionsService` | `tenant_faq_options_settings` | `faq-options-settings.ts` |
| Product Options | `ProductOptionsService` | `tenant_product_options_settings` | `product-options-settings.ts` |
| Barcode Scanning | (inline in route) | — | `barcode-scan-options-settings.ts` |
| Storefront | `StorefrontOptionsService` | `tenant_storefront_options_settings` | `storefront-options-settings.ts` |
| Integration | `IntegrationOptionsService` | `tenant_integration_settings` | `integration-options-settings.ts` |
| Quickstart | `QuickstartOptionsService` | `tenant_quickstart_options_settings` | `quickstart-options-settings.ts` |
| Fulfillment | (inline in route) | `tenant_fulfillment_settings` | `fulfillment-settings.ts` |
| Payment Gateway | (inline in route) | `tenant_payment_gateway_settings` | `payment-gateway-settings.ts` |
