# Unified Capabilities Endpoint — Phase Plan

## Status: Draft | Target: Backend + Frontend | Risk: Medium

## Executive Summary

Replace the current **N+1 request waterfall** (1 tier-capabilities call + ~10 merchant-settings calls) with a **single unified endpoint** that resolves tier hard-gates + merchant soft-gates + org overrides server-side and returns a flat "effective capability manifest."

**Current cost per storefront load:** ~11 HTTP requests, ~2.6K lines of client-side resolution logic.
**Target cost:** 1 HTTP request, ~200 lines of client-side consumption logic.

---

## Phase 1: Backend `EffectiveCapabilityResolver` Service

**Goal:** Port the resolution logic from `CapabilityResolutionService.ts` (frontend, 2,667 lines) into a backend singleton that merges tier features + merchant preferences + org settings.

**New Files:**
- `apps/api/src/services/EffectiveCapabilityResolver.ts` — Core resolver
- `apps/api/src/services/resolvers/CommerceResolver.ts` — Tier + merchant + org merge for commerce
- `apps/api/src/services/resolvers/PaymentGatewayResolver.ts`
- `apps/api/src/services/resolvers/StorefrontTypeResolver.ts`
- `apps/api/src/services/resolvers/FulfillmentResolver.ts`
- `apps/api/src/services/resolvers/ProductOptionsResolver.ts`
- `apps/api/src/services/resolvers/FeaturedOptionsResolver.ts`
- `apps/api/src/services/resolvers/IntegrationOptionsResolver.ts`
- `apps/api/src/services/resolvers/QuickstartOptionsResolver.ts`
- `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts`
- `apps/api/src/services/resolvers/FaqOptionsResolver.ts`
- `apps/api/src/services/resolvers/CrmOptionsResolver.ts`
- `apps/api/src/services/resolvers/BarcodeScanResolver.ts`

**Key Design Decisions:**

1. **Resolver Interface:** Each resolver accepts `(tierFeatures: Record<string,boolean>, merchantSettings: any, orgSettings: any)` and returns an `EffectiveCapability` object.
2. **Commerce resolver reuses** existing `getTenantCommerceCapabilities()` (`apps/api/src/utils/commerce-capabilities.ts:172`) — already does tier + tenant + org merge.
3. **StorefrontType resolver reuses** `StorefrontTypeService.resolveStorefrontTypeState()` (`apps/api/src/services/StorefrontTypeService.ts`) — already does tier + merchant merge.
4. **All other resolvers** are ported from frontend functions in `CapabilityResolutionService.ts` (lines 658–1999).

**DB Query Strategy (Single Round-Trip):**

```ts
// EffectiveCapabilityResolver.getEffectiveCapabilities(tenantId)
const [tenant, tierFeatures, merchantSettings] = await Promise.all([
  prisma.tenants.findUnique({ ... }),
  getMergedTierFeatures(tenantId),        // existing logic from tenant-capabilities.ts
  getAllMerchantSettings(tenantId),       // NEW: parallel fetch across all settings tables
]);
```

`getAllMerchantSettings` performs one `Promise.all` across:
- `tenant_commerce_settings`
- `tenant_payment_gateway_settings`
- `tenant_storefront_type_settings`
- `tenant_fulfillment_settings`
- `tenant_product_options_settings`
- `tenant_featured_options_settings`
- `tenant_integration_options_settings`
- `tenant_quickstart_options_settings`
- `tenant_storefront_options_settings`
- `tenant_faq_options_settings`
- `tenant_crm_options_settings`
- `tenant_barcode_scan_settings`

**Completion Criteria:**
- [ ] All 12 resolver modules implemented with unit tests
- [ ] `EffectiveCapabilityResolver` orchestrates them into a single `EffectiveCapabilities` object
- [ ] Zero regression on existing `/api/tenants/:id/capabilities` response shape
- [ ] `checkapi` passes

---

## Phase 2: Unified Endpoint + Server-Side Cache

**Goal:** Expose `GET /api/tenants/:tenantId/effective-capabilities` (public, no auth) and `GET /api/tenants/:tenantId/effective-capabilities?detail=full` (authenticated, includes raw gates).

**Files:**
- Modify: `apps/api/src/routes/tenant-capabilities.ts` — add new route
- Modify: `apps/api/src/index.ts` — register if needed
- New: `apps/api/src/middleware/effective-capabilities-cache.ts` — cache middleware

**Response Shape (Public / Storefront):**

```json
{
  "tenant_id": "tid-m8ijkrnk",
  "tier": {
    "key": "ecommerce",
    "name": "E-commerce",
    "description": "Full Payment Commerce..."
  },
  "effective": {
    "commerce": {
      "enabled": true,
      "cart_visible": true,
      "payment_type": "full",
      "checkout_available": true,
      "checkout_mode": { "mode": "full_payment_only" }
    },
    "payment_gateway": {
      "enabled": true,
      "effective_gateways": ["stripe", "paypal"],
      "checkout_available": true
    },
    "storefront": {
      "enabled": true,
      "type": "online",
      "effective_type": "online"
    },
    "fulfillment": {
      "enabled": true,
      "pickup": true,
      "delivery": true,
      "shipping": false,
      "service": true
    },
    "storefront_options": {
      "enabled": true,
      "layout": "immersive",
      "hours_display": true,
      "map_display": true,
      "qr_codes": true,
      "qr_resolution": "1024",
      "image_gallery_limit": 5,
      "can_use_layout_immersive": true,
      "can_use_layout_classic": false
    },
    "integrations": {
      "enabled": true,
      "effective": ["gbp", "square", "clover"]
    },
    "product_options": {
      "enabled": true,
      "allowed_types": ["physical", "digital"],
      "layout": "immersive",
      "variants": true,
      "gallery": true
    },
    "featured": {
      "enabled": true,
      "effective_types": ["sale", "new_arrival", "featured"]
    },
    "crm": {
      "enabled": true,
      "tickets": true,
      "inquiry_channels": ["storefront", "directory", "product"],
      "contact_management": true
    },
    "quickstart": {
      "enabled": true,
      "wizard": true,
      "category_generator": true,
      "can_use_ai_wizard": true
    },
    "faq": {
      "enabled": true,
      "storefront_accordion": true,
      "product_accordion": true
    },
    "barcode_scan": {
      "enabled": true,
      "effective_modes": ["manual", "usb", "camera"]
    }
  },
  "uncategorized_features": []
}
```

**Response Shape (Authenticated / Detail=full):**

Adds a `"gates"` section for settings pages to show why something is disabled:

```json
{
  "...": "...",
  "gates": {
    "tier_hard": {
      "payment_gateway_options": {
        "capability_enabled": true,
        "features": { "payment_gateway_stripe": true, "payment_gateway_clover": false }
      }
    },
    "merchant_soft": {
      "payment_gateway": { "stripe_enabled": true, "clover_enabled": false }
    },
    "org_override": {
      "commerce": { "full_payment_enabled": true }
    }
  }
}
```

**Caching Strategy:**

| Layer | TTL | Invalidation Trigger |
|---|---|---|
| In-memory LRU (per worker) | 60s | Any settings PUT for tenant |
| Redis (shared) | 300s (5 min) | Any settings PUT for tenant |
| HTTP `Cache-Control` (public) | 60s | — |

Cache key: `effective_caps:{tenantId}`
Invalidation: Every existing settings PUT handler (commerce, payment gateway, fulfillment, etc.) must call `EffectiveCapabilityResolver.invalidate(tenantId)` after successful update.

**Completion Criteria:**
- [ ] New endpoint returns correct merged state for all 12 capability domains
- [ ] Cache hit reduces response time to <50ms (target: <20ms)
- [ ] Cache invalidation fires on all settings mutations
- [ ] Load test: 1,000 RPM with >95% cache hit rate

---

## Phase 3: Frontend `UnifiedCapabilityService`

**Goal:** Create a drop-in replacement for `CapabilityResolutionService` that calls the unified endpoint instead of fanning out.

**New Files:**
- `apps/web/src/services/UnifiedCapabilityService.ts`
- `apps/web/src/hooks/useEffectiveCapabilities.ts`
- `apps/web/src/types/effective-capabilities.ts`

**Interface (backward-compatible):**

```ts
class UnifiedCapabilityService extends PublicApiSingleton {
  async getAllCapabilities(tenantId: string): Promise<AllCapabilitiesState>
  async getCommerceState(tenantId: string): Promise<CommerceState>
  async getPaymentGatewayState(tenantId: string): Promise<PaymentGatewayState>
  // ... etc
}
```

The service calls `/api/tenants/${tenantId}/effective-capabilities` **once**, then maps the flat `effective.*` response into the existing typed state objects. No resolution logic — just mapping.

**Completion Criteria:**
- [ ] `UnifiedCapabilityService` implements same interface as `CapabilityResolutionService`
- [ ] Unit tests verify mapping correctness against mock unified response
- [ ] `checkweb` passes

---

## Phase 4: Migrate Public Storefront Pages

**Goal:** Switch public-facing pages from `CapabilityResolutionService` to `UnifiedCapabilityService`. These are the highest-traffic, highest-impact pages.

**Pages to migrate (in order):**

1. `apps/web/src/app/tenant/[id]/page.tsx` — Storefront landing (uses `publicStorefrontTypeService`, `publicCommerceSettingsService`)
2. `apps/web/src/app/products/[id]/page.tsx` — Product detail (uses `CapabilityResolutionService` for product options, commerce)
3. `apps/web/src/app/checkout/page.tsx` — Checkout (uses commerce + payment gateway + fulfillment)
4. `apps/web/src/app/directory/[slug]/page.tsx` — Directory listing (uses storefront type, featured options)
5. `apps/web/src/app/carts/page.tsx` — Cart page (uses commerce)

**Migration Pattern per Page:**

```tsx
// BEFORE (fan-out)
const [capState, commerceState, paymentState] = await Promise.all([
  capabilityResolutionService.getAllCapabilities(tenantId),
  capabilityResolutionService.getCommerceState(tenantId),
  capabilityResolutionService.getPaymentGatewayState(tenantId),
]);

// AFTER (single call)
const effective = await unifiedCapabilityService.getAllCapabilities(tenantId);
// effective.commerce, effective.paymentGateway already resolved
```

**Completion Criteria:**
- [ ] All 5 storefront pages use `UnifiedCapabilityService`
- [ ] Lighthouse performance score improves (fewer network requests)
- [ ] No visual or functional regressions in checkout flow
- [ ] No visual or functional regressions in product detail page

---

## Phase 5: Migrate Tenant Dashboard + Admin Pages

**Goal:** Switch authenticated pages. These use `TenantCapabilityResolutionService` (5-min cache) and `TenantInfoService`.

**Pages to migrate (in order):**

1. `apps/web/src/app/t/[tenantId]/settings/payment-gateways/page.tsx`
2. `apps/web/src/app/t/[tenantId]/settings/commerce/page.tsx`
3. `apps/web/src/app/t/[tenantId]/settings/fulfillment/page.tsx`
4. `apps/web/src/app/t/[tenantId]/settings/storefront-options/page.tsx`
5. `apps/web/src/app/t/[tenantId]/settings/product-options/page.tsx`
6. `apps/web/src/app/t/[tenantId]/settings/featured-options/page.tsx`
7. `apps/web/src/app/t/[tenantId]/settings/integration-options/page.tsx`
8. `apps/web/src/app/t/[tenantId]/settings/quickstart-options/page.tsx`
9. `apps/web/src/app/t/[tenantId]/settings/faq-options/page.tsx`
10. `apps/web/src/app/t/[tenantId]/settings/barcode-scan/page.tsx`
11. `apps/web/src/components/dashboard/TenantDashboard.tsx` — Main dashboard
12. `apps/web/src/components/dashboard/TenantDashboardV2.tsx` — Dashboard v2

**Settings pages:** Use `?detail=full` to access `gates` section for upgrade messaging ("Your plan doesn't include Clover — upgrade to Professional").

**Completion Criteria:**
- [ ] All settings pages read from unified endpoint
- [ ] Upgrade messaging still works (reads from `gates.tier_hard`)
- [ ] Toggle saves still work (PUT to existing individual settings endpoints)
- [ ] `checkweb` passes

---

## Phase 6: Deprecation & Cleanup

**Goal:** Remove dead code and deprecate redundant endpoints.

**Backend:**
- Mark as deprecated (but keep alive for 30 days):
  - `GET /api/public/tenant/:tenantId/commerce-settings`
  - `GET /api/public/tenant/:tenantId/payment-gateway-settings`
  - `GET /api/public/tenant/:tenantId/storefront-type`
  - `GET /api/public/tenant/:tenantId/fulfillment-settings`
  - `GET /api/public/tenant/:tenantId/featured-options-settings`
  - `GET /api/public/tenant/:tenantId/product-options-settings`
  - `GET /api/public/tenant/:tenantId/integration-options-settings`
  - `GET /api/public/tenant/:tenantId/quickstart-options-settings`
  - `GET /api/public/tenant/:tenantId/storefront-options-settings`
  - `GET /api/public/tenant/:tenantId/faq-options-settings`
  - `GET /api/public/tenant/:tenantId/barcode-scan-settings`
- Add `Deprecation: true` header to responses
- Add console.warn on backend when these are called

**Frontend:**
- Delete `CapabilityResolutionService.ts` (2,667 lines)
- Delete `TenantCapabilityResolutionService` class
- Delete `PublicCommerceSettingsService.ts`
- Delete `PublicPaymentGatewaySettingsService.ts`
- Delete `PublicStorefrontTypeService.ts`
- Delete `PublicFulfillmentService.ts`
- Delete `PublicFeaturedOptionsService.ts`
- Update all imports to use `UnifiedCapabilityService`

**Completion Criteria:**
- [ ] All deprecated endpoints return 200 with `Deprecation: true` header
- [ ] Frontend dead code removed
- [ ] `checkweb` and `checkapi` pass
- [ ] Bundle size reduced by ~50KB+ (removal of resolution logic)

---

## Technical Architecture

### Unified Response Contract

```typescript
interface EffectiveCapabilitiesResponse {
  tenant_id: string;
  tier: { key: string; name: string; description: string };
  effective: {
    commerce: EffectiveCommerce;
    payment_gateway: EffectivePaymentGateway;
    storefront: EffectiveStorefront;
    fulfillment: EffectiveFulfillment;
    product_options: EffectiveProductOptions;
    featured: EffectiveFeatured;
    integrations: EffectiveIntegrations;
    quickstart: EffectiveQuickstart;
    storefront_options: EffectiveStorefrontOptions;
    faq: EffectiveFaq;
    crm: EffectiveCrm;
    barcode_scan: EffectiveBarcodeScan;
  };
  gates?: {
    tier_hard: Record<string, CapabilityGroup>;
    merchant_soft: Record<string, Record<string, boolean>>;
    org_override: Record<string, Record<string, boolean>>;
  };
  uncategorized_features: string[];
}
```

### Cache Invalidation Flow

```
Tenant changes payment gateway setting
  → PUT /api/tenants/:id/payment-gateway-settings
    → prisma update
    → EffectiveCapabilityResolver.invalidate(tenantId)
      → redis.del(`effective_caps:${tenantId}`)
      → in-memory LRU delete
    → return 200

Next GET /effective-capabilities
  → cache miss
  → recompute (single DB round-trip)
  → cache set (redis + memory)
  → return fresh payload
```

### Performance Targets

| Metric | Before | After |
|---|---|---|
| Requests per storefront load | ~11 | 1 |
| Capabilities resolution time (client) | ~50ms + network | ~0ms (server pre-resolved) |
| Capabilities payload size | ~800B + N responses | ~2.5KB single response |
| Capabilities cache hit p99 | N/A (client-side, per-browser) | <20ms @ 95% hit rate |
| Settings table queries | 10+ sequential / parallel | 1 parallel batch |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cache stale after settings update | Low | High | Invalidate on ALL settings PUTs; add TTL buffer |
| Frontend resolution logic has edge cases not captured in backend port | Medium | High | Port with 1:1 unit tests; run A/B shadow mode in Phase 3 |
| Public endpoint payload too large for edge caching | Low | Medium | Enable gzip; `?fields=` filter if needed |
| Settings routes used by external consumers | Medium | Medium | Deprecation headers + 30-day grace; keep routes alive in Phase 6 only |
| Org override logic diverges between frontend and backend | Medium | High | Reuse existing `getTenantCommerceCapabilities` pattern; test with org tenants |

---

## Dependencies

- No database migrations required (reads existing tables)
- No new npm packages required
- **Cache:** In-memory LRU per worker (60s TTL). Redis was considered but not implemented; the two-tier cache (backend 60s + frontend `PublicApiSingleton` 15min) proved sufficient in practice.

---

## Lessons Learned (Post-Implementation)

### 1. Raw Settings Dump Is an Anti-Pattern
An early attempt to expose the entire raw `merchant_preferences` blob on each effective state was reverted. It bloats the payload and leaks internal schema details to the frontend. **Correct approach:** selectively expose only the non-boolean config values that components actually need (e.g. `delivery_fee_cents`, `pickup_ready_time_minutes`, `effective_layout`). Boolean toggles are already readable from `merchantPreferences` on the effective state.

### 2. The `effective_*` Single-Value Pattern
For choice-based configuration (layouts, types, payment modes), components need a single resolved value — not just `allowed_*` + raw merchant preference separately. Example:
- Backend: `effective_layout: StorefrontOptLayoutType` (computed from `allowed_layouts` ∩ `merchant_prefs.storefront_layout` with fallback)
- Frontend: `effectiveLayout: StorefrontOptLayoutType` (mapped directly, no client-side logic)

This pattern should be applied to any new choice-based capability domain.

### 3. Feature-Map Guards Break After Unification
Many components guarded rendering with `Object.keys(X.features).length > 0`. After unification, `features` is always `{}` (it's a legacy compatibility field). **Fix:** use `X.enabled` instead. This was the root cause of the `PlanSummaryPanel` bug where no capabilities rendered.

### 4. `CapabilityResolutionService.ts` Is a Type Source, Not Just Dead Code
The resolution class in `CapabilityResolutionService.ts` is obsolete, but its exported interfaces (`AllCapabilitiesState`, `CommerceState`, `FulfillmentState`, etc.) are still imported by `UnifiedCapabilityService.ts`, hooks, and pages. **Do not delete the file** until all types have been extracted to a dedicated types module.

### 5. Two-Tier Cache, Not Redis
The backend resolver uses a **60-second in-memory LRU cache** (per worker). A Redis layer was never added. The frontend `PublicApiSingleton` adds a second **15-minute cache** at the `UnifiedCapabilityService` level. In practice this means:
- First storefront hit: ~1.8s (backend cache miss, does single DB round-trip)
- Subsequent hits for 15 min: served from frontend singleton cache (zero network)
- After frontend TTL: one lightweight HTTP round-trip served from backend memory cache (<20ms)

### 6. Subscription Metadata Stays Separate
The unified endpoint intentionally does **not** include subscription status, trial dates, or grace periods. `/api/tenants/:tenantId/tier/public` remains the canonical source for that data. This is by design — subscription lifecycle and capability resolution are separate concerns.

### 7. Cross-Context Coupling: `TenantPaymentProvider`
Commerce and payment gateway state flow into `TenantPaymentProvider` via `initialCommerceSettings` and `initialPaymentGatewaySettings`. When migrating from legacy `CommerceSettings` / `PaymentGatewaySettings` shapes to unified `CommerceState` / `PaymentGatewayState`, the provider's prop types must be updated to accept the unified shape (e.g. `enabled` at top level, not just `gateway_enabled`).

### 8. Featured Options Need Merchant Preferences for Client-Side Filtering
The unified `FeaturedOptionsState` includes `merchantPreferences` with per-type toggles (`featured_store_selection`, `featured_sale`, etc.). Directory and product pages use these toggles to filter featured products client-side after fetching them from the catalog API. The unified endpoint does not pre-filter products — it only surfaces the gate flags.

### 9. Frontend Fallback Logic Still Exists
Some computed fields have fallback logic in the frontend mapper that the backend resolver doesn't replicate:
- `CommerceState.checkoutMode`: frontend `mapCommerce` derives a default `{ mode }` object from `effective_payment_type` when the backend doesn't send an explicit `checkout_mode`.
Keep these mappers minimal — they should be mapping, not resolving.

### 10. Cache Invalidation Already Wired
All existing settings PUT handlers (commerce, payment gateway, fulfillment, product options, featured options, storefront options, FAQ, CRM, barcode scan, integration, quickstart) already call `invalidateEffectiveCapabilities(tenantId)` after a successful Prisma update. No additional backend wiring is needed for new capability domains as long as the pattern is followed.

## Success Metrics

1. **Network:** Storefront pages make ≤3 API calls total (down from ~11)
2. **Performance:** Capabilities endpoint p99 <50ms with cache
3. **Code:** `CapabilityResolutionService.ts` deleted; `UnifiedCapabilityService.ts` <300 lines
4. **Bundle:** Web bundle reduced by ≥40KB
5. **Stability:** Zero capability-gate regressions in production for 14 days post-launch

---

## Appendix: File Inventory

### Backend files to create (~13)
- `apps/api/src/services/EffectiveCapabilityResolver.ts`
- `apps/api/src/services/resolvers/*.ts` (11 resolver modules)
- `apps/api/src/middleware/effective-capabilities-cache.ts`

### Backend files to modify (~13)
- `apps/api/src/routes/tenant-capabilities.ts` — add unified route
- `apps/api/src/routes/commerce-settings.ts` — add cache invalidation
- `apps/api/src/routes/payment-gateway-settings.ts` — add cache invalidation
- `apps/api/src/routes/fulfillment-settings.ts` — add cache invalidation
- `apps/api/src/routes/storefront-type-settings.ts` — add cache invalidation
- `apps/api/src/routes/product-options-settings.ts` — add cache invalidation
- `apps/api/src/routes/featured-options-settings.ts` — add cache invalidation
- `apps/api/src/routes/integration-options-settings.ts` — add cache invalidation
- `apps/api/src/routes/quickstart-options-settings.ts` — add cache invalidation
- `apps/api/src/routes/storefront-options-settings.ts` — add cache invalidation
- `apps/api/src/routes/faq-options-settings.ts` — add cache invalidation
- `apps/api/src/routes/barcode-scan-settings.ts` — add cache invalidation
- `apps/api/src/routes/crm-options-settings.ts` — add cache invalidation (if exists)

### Frontend files to create (~3)
- `apps/web/src/services/UnifiedCapabilityService.ts`
- `apps/web/src/hooks/useEffectiveCapabilities.ts`
- `apps/web/src/types/effective-capabilities.ts`

### Frontend files to modify (~17)
- `apps/web/src/app/tenant/[id]/page.tsx`
- `apps/web/src/app/products/[id]/page.tsx`
- `apps/web/src/app/checkout/page.tsx`
- `apps/web/src/app/directory/[slug]/page.tsx`
- `apps/web/src/app/carts/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/*/page.tsx` (10 settings pages)
- `apps/web/src/components/dashboard/TenantDashboard.tsx`
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

### Frontend files to delete (~8)
- `apps/web/src/services/CapabilityResolutionService.ts`
- `apps/web/src/services/PublicCommerceSettingsService.ts`
- `apps/web/src/services/PublicPaymentGatewaySettingsService.ts`
- `apps/web/src/services/PublicStorefrontTypeService.ts`
- `apps/web/src/services/PublicFulfillmentService.ts`
- `apps/web/src/services/PublicFeaturedOptionsService.ts`
- `apps/web/src/hooks/useCapabilityGate.ts` (or redirect to new hook)
- `apps/web/src/hooks/usePublicCapabilities.ts`

---

## Appendix: Updated Skill Document — Adding a New Capability (Post-Unification)

The `.devin/skills/add-capability-feature.md` skill document must be updated to reflect the unified resolver architecture. The old flow required touching both frontend `CapabilityResolutionService` and backend `*OptionsService`. The new flow centralizes resolution in the backend resolver layer.

### Updated Post-Insert Checklist (replace steps 3–4 in skill doc)

After adding to `features_list`, linking to a capability type, and enabling for tiers, follow these unified steps:

1. **Create/update the backend resolver** in `apps/api/src/services/resolvers/{Domain}Resolver.ts`:
   - Accept `(features: Record<string,boolean>, merchantPrefs: {Domain}MerchantSettings | null)`.
   - Map tier feature keys → `allowed_*` arrays.
   - Apply merchant soft toggles → `effective_*` arrays / booleans.
   - Return an `Effective{Domain}` object (add the interface to `resolvers/types.ts`).
   - Follow the pattern of existing resolvers (e.g. `PaymentGatewayResolver.ts`, `ProductOptionsResolver.ts`).

2. **Export the resolver** from `apps/api/src/services/resolvers/index.ts`.

3. **Wire into the orchestrator** in `EffectiveCapabilityResolver.ts`:
   - Add the new settings table to `fetchMerchantSettings()` (use `safeQuery` for graceful degradation).
   - Add the new resolver to the `Promise.all` dispatch block.
   - Include the resolved state in the final `EffectiveCapabilities` return object.

4. **Update the unified endpoint response** — no extra route needed; `GET /api/tenants/:tenantId/effective-capabilities` automatically surfaces the new domain under `effective.{domain}`.

5. **Add cache invalidation** in the settings PUT handler for the new domain:
   - After a successful Prisma update, call `invalidateEffectiveCapabilities(tenantId)`.

6. **Add a unit test** in `apps/api/src/services/resolvers/resolvers.test.ts`:
   - Test disabled state when tier has no matching features.
   - Test enabled state when tier allows + merchant enables.
   - Test merchant override (tier allows but merchant disables).

7. **Update the frontend** — instead of touching `CapabilityResolutionService`, update `UnifiedCapabilityService` to map the new `effective.{domain}` field into the typed state object consumed by React components.

### What to Remove from the Skill Document

- Remove references to `CapabilityResolutionService` frontend resolution logic.
- Remove the requirement to update individual `Public*Service.ts` files.
- Clarify that merchant preference tables still exist per-domain, but resolution now happens server-side in the resolver.

### Verification (New)

After adding a new capability:

```bash
pnpm checkapi          # must pass
pnpm test -- --run     # resolver tests must pass
curl http://localhost:3001/api/tenants/:tenantId/effective-capabilities \
  | jq '.data.effective.<new_domain>'   # must return resolved state
```
