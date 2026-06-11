---
description: Verify a capability's tier gate and merchant gate deployment end-to-end
---

# Verify Capability Deployment

This skill audits a capability's full gating flow from database seeds through backend services to frontend resolution. Use it when a capability toggle fails to work despite the tenant's tier supposedly allowing it.

## Capability Gating Architecture

- **Tier gate** (master switch): Determines if a capability is available based on tenant subscription tier. Resolved by backend `*OptionsService` and frontend `CapabilityResolutionService`.
- **Merchant gate** (granular control): Extends tier gate for per-merchant enable/disable. Stored in `tenant_*_options_settings` tables. Managed via `/api/tenants/:tenantId/<capability>-options` routes.

## Verification Steps

### 1. Check Database Seeds

Verify the capability type and feature keys exist in the database:

```sql
-- Check capability_type_list entry
SELECT * FROM capability_type_list WHERE key = '<capability_type_key>';

-- Check features_list entries for this capability
SELECT fl.* FROM features_list fl
JOIN capability_features_list cfl ON cfl.feature_id = fl.id
JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
WHERE ctl.key = '<capability_type_key>';

-- Check tier_features_list for a specific tier (e.g., discovery)
SELECT tfl.feature_key, tfl.is_enabled, tfl.is_inherited
FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE stl.tier_key = '<tier_key>'
AND tfl.capability_type_id = (SELECT id FROM capability_type_list WHERE key = '<capability_type_key>');
```

**Common issue**: Feature keys with leading/trailing spaces (e.g., `"  crm_enabled"` instead of `"crm_enabled"`). Run the cleanup script:
```bash
node scripts/fix_feature_key_spaces.js
```

### 2. Check Backend Service Resolution

Each capability has a backend service (e.g., `CrmOptionsService`, `FaqOptionsService`) that:
- Queries `tier_features_list` by `capability_type_id` (primary) or `feature_key.startsWith(prefix)` (fallback)
- Merges features across tiers (most-permissive-wins)
- Trims feature keys to handle DB whitespace
- Returns a typed state object (e.g., `CrmOptionsState`)

**Verify the service file** at `apps/api/src/services/<Capability>OptionsService.ts`:
- [ ] Uses `capability_type_id` query (not just `startsWith` prefix)
- [ ] Trims `feature_key` when building `mergedFeatures`
- [ ] `resolveFromFeatures` correctly maps feature keys to state flags
- [ ] `getDisabledState()` returns all flags as `false`

### 3. Check Backend Route (Merchant Gate)

The route at `apps/api/src/routes/<capability>-options-settings.ts` handles:
- **GET**: Fetches merchant preferences, merges with tier state, filters by tier allowances
- **PUT**: Validates updates against tier restrictions, persists merchant preferences

**Verify the route**:
- [ ] GET returns `{ success, settings, tierState }` where `tierState.enabled` reflects the tier gate
- [ ] PUT rejects updates for features not allowed by tier (403 `tier_restricted`)
- [ ] PUT rejects all updates if `tierState.enabled` is false (403 `capability_disabled`)
- [ ] Settings are filtered by tier before returning (merchant can't see tier-restricted features)

### 4. Check Tenant Capabilities Endpoint

The public endpoint `GET /api/tenants/:tenantId/capabilities` groups tier features by `capability_type_list.key`. The response includes:
```json
{
  "capabilities": {
    "<capability_type_key>": {
      "capability_enabled": true,
      "is_highlighted": false,
      "features": { "<feature_key>": true, ... }
    }
  }
}
```

**Verify**:
- [ ] The capability type key appears in the response
- [ ] `capability_enabled` is `true` when any feature in the group is enabled
- [ ] Feature keys in the `features` map are trimmed (no leading/trailing spaces)

### 5. Check Frontend Resolution

The frontend `CapabilityResolutionService` (`apps/web/src/services/CapabilityResolutionService.ts`) resolves capabilities from the API response:

**Verify `resolve<Capability>OptionsState` function**:
- [ ] Accepts `capabilityEnabled` as fallback parameter for the `enabled` flag
- [ ] Trims feature keys before resolving (handles DB whitespace)
- [ ] Both `CapabilityResolutionService` (customer-facing) and `TenantCapabilityResolutionService` (tenant-facing) pass `capability_enabled` from the API response

**Verify `resolveAll` in both service classes**:
- [ ] Extracts `capability_enabled` from the API response: `data.capabilities?.<key>?.capability_enabled`
- [ ] Passes it as second argument to `resolve<Capability>OptionsState(features, capabilityEnabled)`

### 6. Check Frontend Hook

The hook at `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` fetches capability state:

**Verify `use<Capability>OptionsCapability` hook**:
- [ ] Uses correct service method (`getService().get<Capability>OptionsState(tenantId)`)
- [ ] Returns `{ enabled, ...groupFlags, isFlexible, features }` with correct typing
- [ ] Loading/error states are handled

### 7. Check Frontend Settings Page

The settings page component should:
- [ ] Show "not available" messaging when `tierState.enabled` is false
- [ ] Disable toggles for features not allowed by tier
- [ ] Use `isTierAllowed(key)` pattern for per-feature tier gating
- [ ] Call `handleSave` which persists merchant preferences via the PUT endpoint

## Capability Type Key → Service Mapping

| Capability Type Key | Backend Service | Frontend Resolver | Route |
|---|---|---|---|
| `crm_options` | `CrmOptionsService` | `resolveCrmOptionsState` | `crm-options-settings.ts` |
| `faq_options` | `FaqOptionsService` | `resolveFaqOptionsState` | `faq-options-settings.ts` |
| `storefront_options` | `StorefrontOptionsService` | `resolveStorefrontOptionsState` | `storefront-options-settings.ts` |
| `featured_options` | `FeaturedOptionsService` | `resolveFeaturedOptionsState` | `featured-options-settings.ts` |
| `storefront_types` | `StorefrontTypeService` | `resolveStorefrontState` | `storefront-type-settings.ts` |
| `product_options` | `ProductOptionsService` | `resolveProductOptionsState` | `product-options-settings.ts` |
| `integration_options` | `IntegrationOptionsService` | `resolveIntegrationState` | `integration-options-settings.ts` |
| `quickstart_options` | `QuickstartOptionsService` | `resolveQuickstartOptionsState` | `quickstart-options-settings.ts` |

## Known Root Causes

1. **Feature key whitespace**: DB `tier_features_list.feature_key` has leading/trailing spaces, causing `startsWith` queries and `features[key]` lookups to miss. Fix: run `scripts/fix_feature_key_spaces.js` and ensure services use `capability_type_id` queries + trim keys.

2. **Missing `capability_type_id` query**: Services using only `feature_key.startsWith(prefix)` are fragile. Fix: query by `capability_type_id` with `startsWith` as fallback.

3. **`capability_enabled` not used as fallback**: The API response includes `capability_enabled` at the group level, but frontend resolvers only check `features.<prefix>_enabled`. If the feature key is malformed, the enabled flag is never set. Fix: pass `capability_enabled` as fallback.

4. **Wrong property name on state object**: Backend routes or other consumers using incorrect property names (e.g., `customerTickets` instead of `customerTicketsEnabled`). Fix: check the `*OptionsState` interface for exact property names.
