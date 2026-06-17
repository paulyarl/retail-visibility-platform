---
description: Verify a capability's tier gate and merchant gate deployment end-to-end
---

# Verify Capability Deployment

This skill audits a capability's full gating flow from database seeds through backend services to frontend resolution. Use it when a capability toggle fails to work despite the tenant's tier supposedly allowing it.

## Capability Gating Architecture

- **Tier gate** (master switch): Determines if a capability is available based on tenant subscription tier. Resolved by backend `EffectiveCapabilityResolver` (unified endpoint) and domain-specific resolvers in `apps/api/src/services/resolvers/`.
- **Merchant gate** (granular control): Extends tier gate for per-merchant enable/disable. Stored in `tenant_*_options_settings` tables. Managed via `/api/tenants/:tenantId/<capability>-options` routes.
- **Unified endpoint** (single source of truth): `GET /api/tenants/:tenantId/effective-capabilities` returns pre-resolved effective state for all domains. The frontend `UnifiedCapabilityService` maps this response — it does not resolve.

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

### 2. Check Backend Resolver

Each capability domain has a resolver in `apps/api/src/services/resolvers/` (e.g., `CrmOptionsResolver.ts`, `FaqOptionsResolver.ts`) that:
- Accepts `(features: Record<string,boolean>, merchantPrefs: MerchantSettings)`
- Maps tier feature keys → `allowed_*` arrays / booleans
- Applies merchant soft toggles → `effective_*` arrays / booleans
- Returns an `Effective{Domain}` object

The orchestrator `EffectiveCapabilityResolver.ts` fetches all merchant settings in a single DB round-trip, then dispatches to each resolver.

**Verify the resolver file** at `apps/api/src/services/resolvers/<Domain>Resolver.ts`:
- [ ] Maps feature keys to `allowed_*` arrays or booleans in the return object
- [ ] Reads the correct merchant preference fields from `merchantBundle`
- [ ] Computes `effective_*` from `allowed_*` ∩ merchant preference (with fallback for missing preference)
- [ ] For choice-based config (layouts, types, modes): computes a single `effective_*` value, not just the raw merchant preference
- [ ] Returns `enabled: boolean` based on whether any feature in the domain is allowed

**Verify the orchestrator** at `apps/api/src/services/EffectiveCapabilityResolver.ts`:
- [ ] The domain is included in the `Promise.all` dispatch block
- [ ] The resolved state appears in the final `EffectiveCapabilities` return object
- [ ] `fetchMerchantSettings()` fetches the correct settings table (use `safeQuery` for graceful degradation)

### 3. Check Backend Route (Merchant Gate)

The route at `apps/api/src/routes/<capability>-options-settings.ts` handles:
- **GET**: Fetches merchant preferences, merges with tier state, filters by tier allowances
- **PUT**: Validates updates against tier restrictions, persists merchant preferences

**Verify the route**:
- [ ] GET returns `{ success, settings, tierState }` where `tierState.enabled` reflects the tier gate
- [ ] PUT rejects updates for features not allowed by tier (403 `tier_restricted`)
- [ ] PUT rejects all updates if `tierState.enabled` is false (403 `capability_disabled`)
- [ ] Settings are filtered by tier before returning (merchant can't see tier-restricted features)

### 4. Check Unified Effective Capabilities Endpoint

The public endpoint `GET /api/tenants/:tenantId/effective-capabilities` returns the pre-resolved effective state for all domains in a single response:

```json
{
  "tenant_id": "tid-xxx",
  "tier": { "key": "ecommerce", "name": "E-commerce" },
  "effective": {
    "<domain>": {
      "enabled": true,
      "allowed_*": [...],
      "effective_*": [...],
      "merchant_preferences": { ... }
    }
  }
}
```

**Verify**:
- [ ] The domain appears under `effective.<domain>`
- [ ] `enabled` is `true` when the tier allows the capability
- [ ] `effective_*` values reflect both tier hard gates AND merchant soft gates
- [ ] `merchant_preferences` contains the raw merchant toggles (for client-side filtering when needed)

Use `?detail=full` for authenticated requests to also see `gates.tier_hard` and `gates.merchant_soft`.

### 5. Check Frontend Mapping

The frontend `UnifiedCapabilityService` (`apps/web/src/services/UnifiedCapabilityService.ts`) maps the unified endpoint response into typed state objects. It does **not** resolve — resolution happens server-side.

**Verify `map<Domain>` function** in `UnifiedCapabilityService.ts`:
- [ ] Maps the backend `effective.<domain>` fields to the frontend state object (e.g. `BackendEffectiveCommerce` → `CommerceState`)
- [ ] Preserves `enabled` boolean at the top level of the state
- [ ] Maps `merchant_preferences` for client-side filtering when needed (e.g. featured options)
- [ ] Handles optional fields with sensible defaults (e.g. `checkoutMode` fallback from `effective_payment_type`)

**Verify `get<Domain>State` methods**:
- [ ] Call `fetchEffective(tenantId)` once, then extract the specific domain from the unified response
- [ ] Return the same typed state as the old `CapabilityResolutionService` (backward-compatible)

### 6. Check Frontend Hook

The hooks in `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` consume capability state via `UnifiedCapabilityService`:

**Verify `use<Capability>Capability` hook**:
- [ ] Uses `unifiedCapabilityService.get<Domain>State(tenantId)` (not the old resolution service)
- [ ] Returns `{ enabled, ...effectiveFlags, merchantPreferences, isFlexible }` with correct typing
- [ ] `features` is `{}` (legacy compatibility) — components must use `enabled` or `effective_*` flags
- [ ] Loading/error states are handled

### 7. Check Frontend Settings Page

The settings page component should:
- [ ] Show "not available" messaging when `tierState.enabled` is false
- [ ] Disable toggles for features not allowed by tier
- [ ] Use `isTierAllowed(key)` pattern for per-feature tier gating
- [ ] Call `handleSave` which persists merchant preferences via the PUT endpoint

## Capability Type Key → Resolver Mapping

| Capability Type Key | Backend Resolver | Settings Route | Frontend Mapper |
|---|---|---|---|
| `crm_options` | `CrmOptionsResolver.ts` | `crm-options-settings.ts` | `mapCrmOptions` |
| `faq_options` | `FaqOptionsResolver.ts` | `faq-options-settings.ts` | `mapFaqOptions` |
| `storefront_options` | `StorefrontOptionsResolver.ts` | `storefront-options-settings.ts` | `mapStorefrontOptions` |
| `featured_options` | `FeaturedOptionsResolver.ts` | `featured-options-settings.ts` | `mapFeatured` |
| `storefront_types` | `StorefrontTypeResolver.ts` | `storefront-type-settings.ts` | `mapStorefront` |
| `product_options` | `ProductOptionsResolver.ts` | `product-options-settings.ts` | `mapProductOptions` |
| `integration_options` | `IntegrationOptionsResolver.ts` | `integration-options-settings.ts` | `mapIntegration` |
| `quickstart_options` | `QuickstartOptionsResolver.ts` | `quickstart-options-settings.ts` | `mapQuickstart` |
| `commerce` | `CommerceResolver.ts` | `commerce-settings.ts` | `mapCommerce` |
| `payment_gateway` | `PaymentGatewayResolver.ts` | `payment-gateway-settings.ts` | `mapPaymentGateway` |
| `fulfillment` | `FulfillmentResolver.ts` | `fulfillment-settings.ts` | `mapFulfillment` |
| `barcode_scan` | `BarcodeScanResolver.ts` | `barcode-scan-settings.ts` | `mapBarcodeScan` |

All resolution happens in the backend resolver. The frontend `UnifiedCapabilityService` only maps.

## Known Root Causes

1. **Feature key whitespace**: DB `tier_features_list.feature_key` has leading/trailing spaces, causing `startsWith` queries and `features[key]` lookups to miss. Fix: run `scripts/fix_feature_key_spaces.js` and ensure resolvers trim keys.

2. **Missing `capability_type_id` query**: Resolvers using only `feature_key.startsWith(prefix)` are fragile. Fix: query by `capability_type_id` with `startsWith` as fallback.

3. **`effective_*` not computed in resolver**: Choice-based config (layouts, types, modes) only exposes `allowed_*` + raw merchant preference. Components receive ambiguous state. Fix: the backend resolver must compute and return a single `effective_*` value (e.g. `effective_layout`) from `allowed_*` ∩ merchant preference with fallback.

4. **Feature-map guards break after unification**: Components using `Object.keys(X.features).length > 0` always get `false` because unified endpoint sets `features: {}` (legacy compatibility). The feature map is empty — use `X.enabled` instead.

5. **Frontend tries to resolve instead of map**: Code still calling `CapabilityResolutionService` or duplicating resolution logic. Fix: all frontend code should use `UnifiedCapabilityService.get*State()` which calls the unified endpoint and maps the response.

6. **Raw settings dump in effective state**: Returning the entire raw `merchant_preferences` blob bloats the payload. Fix: expose only the scalar values components need; boolean toggles are readable from `merchantPreferences` on the state object.

7. **Cache not invalidated after settings update**: The unified endpoint serves stale data for up to 60 seconds after a merchant changes a setting. Fix: ensure the settings PUT handler calls `invalidateEffectiveCapabilities(tenantId)`.

8. **Wrong property name on state object**: Backend routes or other consumers using incorrect property names (e.g., `customerTickets` instead of `customerTicketsEnabled`). Fix: check the `*OptionsState` interface in `CapabilityResolutionService.ts` (type source) for exact property names.
