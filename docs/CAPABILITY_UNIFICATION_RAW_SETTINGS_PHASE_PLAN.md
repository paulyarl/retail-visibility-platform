# Capability Unification — Raw Settings Phase Plan

**Objective:** Extend the unified `/api/public/tenant/:tenantId/capabilities` endpoint to include raw merchant preference settings alongside resolved capability state, eliminating the need for separate public settings endpoints on storefront pages.

**Status:** Phase 6 extension — capability gates migrated, raw settings remain on legacy endpoints.

---

## Background

The unified endpoint currently returns **resolved** capability state (booleans, merged tier + merchant preferences). Several storefront components need access to the underlying **raw** merchant settings values:

- Commerce: deposit percentage, checkout mode config
- Payment Gateway: active gateway, publishable key (safe), provider
- Storefront Type: layout type, theme config
- Fulfillment: delivery radius, fee schedule, method availability
- Featured Options: merchant-selected featured types, max items
- FAQ: actual FAQ content (data, not capability)

The backend resolver already fetches all raw merchant settings in a single DB round-trip but discards them after computing effective state.

---

## Phase 6A: Backend — Add `raw_settings` to Unified Response

**Scope:** `apps/api/src/services/resolvers/types.ts`, `EffectiveCapabilityResolver.ts`, `unified-capabilities.ts` route

**Tasks:**
1. Define `PublicMerchantSettingsBundle` interface (strip secrets from `MerchantSettingsBundle`)
2. Add `raw_settings?: PublicMerchantSettingsBundle` field to `EffectiveCapabilities` type
3. Populate `raw_settings` in resolver from existing `merchantBundle` variable
4. Gate inclusion behind `detail=full` or always include (payload is ~2-3 KB)
5. Verify `checkapi` passes

**Estimated effort:** 20-30 minutes
**Risk:** Low — no new DB fetches, only type + assignment changes

---

## Phase 6B: Frontend — Add Raw Settings to `AllCapabilitiesState`

**Scope:** `apps/web/src/services/CapabilityResolutionService.ts`, `UnifiedCapabilityService.ts`

**Tasks:**
1. Add `rawSettings` field to `AllCapabilitiesState` interface
2. Map each backend `raw_settings` sub-object to frontend-friendly shape
3. Expose typed getters on `UnifiedCapabilityService`:
   - `getRawCommerceSettings(tenantId)`
   - `getRawPaymentGatewaySettings(tenantId)`
   - `getRawStorefrontTypeSettings(tenantId)`
   - `getRawFulfillmentSettings(tenantId)`
   - `getRawFeaturedOptionsSettings(tenantId)`
4. Verify `checkweb` passes

**Estimated effort:** 30-40 minutes
**Risk:** Low — additive only, no breaking changes to existing resolved state

---

## Phase 6C: Migrate Fulfillment Settings

**Scope:** `apps/web/src/components/checkout/FulfillmentMethodForm.tsx`

**Tasks:**
1. Replace `publicFulfillmentService.getFulfillmentSettings` with `unifiedCapabilityService.getRawFulfillmentSettings`
2. Update fee calculation to read from raw settings shape
3. Remove `PublicFulfillmentService` import
4. Verify checkout flow renders correctly

**Estimated effort:** 20-30 minutes
**Risk:** Medium — fee calculation logic must match exact field names

---

## Phase 6D: Migrate Tenant Page Raw Settings

**Scope:** `apps/web/src/app/tenant/[id]/page.tsx`

**Tasks:**
1. Replace `publicCommerceSettingsService.getCommerceSettings` with `unifiedCapabilityService.getRawCommerceSettings`
2. Replace `publicPaymentGatewaySettingsService.getPaymentGatewaySettings` with `unifiedCapabilityService.getRawPaymentGatewaySettings`
3. Replace `publicStorefrontTypeService.getStorefrontTypeSettings` with `unifiedCapabilityService.getRawStorefrontTypeSettings`
4. Remove all three legacy service imports
5. Verify `checkweb` passes

**Estimated effort:** 20-30 minutes
**Risk:** Low — props passed to child components, no logic changes

---

## Phase 6E: Migrate Featured Options Filtering

**Scope:** `apps/web/src/app/products/[id]/page.tsx`, `apps/web/src/app/directory/[slug]/page.tsx`

**Tasks:**
1. Replace `publicFeaturedOptionsService.getFeaturedOptionsSettings` with `unifiedCapabilityService.getRawFeaturedOptionsSettings`
2. Verify `FeaturedOptionsSettings` shape matches for filtering functions
3. Remove `PublicFeaturedOptionsService` import from both pages
4. Verify `checkweb` passes

**Estimated effort:** 15-20 minutes
**Risk:** Low — shape is already compatible (same `featured_enabled`, `allowed_featured_types`, etc.)

---

## Phase 6F: Cleanup — Delete Remaining Public*Service Files

**Scope:** `apps/web/src/services/`

**Files to delete (after zero imports confirmed):
- `PublicCommerceSettingsService.ts`
- `PublicPaymentGatewaySettingsService.ts`
- `PublicStorefrontTypeService.ts`
- `PublicFulfillmentService.ts`
- `PublicFeaturedOptionsService.ts`

**`PublicFaqService.ts` stays** — it provides actual FAQ data (content queries), not capability flags.

**Tasks:**
1. `grep -r "from '@/services/Public.*Service'" apps/web/src` to confirm zero imports
2. Delete each file
3. Run `pnpm checkweb` after each deletion

**Estimated effort:** 10 minutes
**Risk:** Low — verified by grep before deletion

---

## Phase 6G: Deprecate Legacy Public Settings Endpoints

**Scope:** `apps/api/src/routes/public/`

**Tasks:**
1. Add `Deprecation: true` header to all legacy public settings endpoints
2. Add `console.warn` on backend when these are called
3. Update API route docs/comment blocks with `@deprecated`
4. Verify `checkapi` passes

**Estimated effort:** 20 minutes
**Risk:** Low — additive headers only, no route removal

---

## Completion Criteria

- [ ] `GET /api/public/tenant/:tenantId/capabilities` returns `raw_settings` for all capability domains
- [ ] All storefront pages use `UnifiedCapabilityService` exclusively
- [ ] Zero remaining imports of `PublicCommerceSettingsService`, `PublicPaymentGatewaySettingsService`, `PublicStorefrontTypeService`, `PublicFulfillmentService`, `PublicFeaturedOptionsService`
- [ ] All legacy public settings endpoints include `Deprecation: true` header
- [ ] `checkweb` and `checkapi` pass with zero errors
- [ ] Bundle size reduced by ~40KB+ (removal of 5 legacy service classes)

---

## Notes

- The `PublicFaqService` is intentionally out of scope — it provides FAQ content (a data query), not capability configuration. It may be migrated to a domain-specific data service later.
- Raw settings should never contain secrets (API keys, webhook URLs, encrypted config). The `PublicMerchantSettingsBundle` type must be security-audited before deployment.
- Cache invalidation: `invalidateEffectiveCapabilities()` already clears on every merchant settings PUT. No additional work needed.
