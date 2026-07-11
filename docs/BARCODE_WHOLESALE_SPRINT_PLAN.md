# Barcode-Driven Product Onboarding & B2B Wholesale Matching — Sprint Plan

**Priority:** HIGH — touches the heart of product creation across all product types
**Design doc:** `docs/COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md` (§12 functional spec, §12.4 modal decomposition)
**Latest migration:** 097 — next available: 098

## Impact Summary

| Product Type | Barcode Enrichment | Wholesale Matching | Decomposition |
|---|---|---|---|
| **Physical** | ✅ Full impact — GTIN lookup, name/brand/description auto-populate | ✅ Full impact — "Order Bulk" / "Find Supplier" | ✅ EditItemModal decomposition |
| **Digital** | ⚠️ Low impact — digital products rarely have barcodes; enrichment is no-op without GTIN | ❌ No impact — no physical supplier | ✅ Decomposition still applies (shared form infrastructure) |
| **Service** | ❌ No impact — services have no barcodes | ❌ No impact — no physical supplier | ✅ Decomposition still applies (shared form infrastructure) |

**Why HIGH priority:** Physical products are the primary use case for the platform. The barcode enrichment + wholesale matching features transform the core product creation flow — both the wizard (already spec-ready) and the legacy EditItemModal (needs decomposition first). The decomposition itself reduces technical debt across all product types since digital and service products share the same modal infrastructure.

---

## Sprint 1: Backend Connectors & Parallel Enrichment (5-6 days)

**Goal:** Commercial barcode lookup APIs integrated into the enrichment fallback chain with parallel orchestration.

### Tasks

1. **Add `BarcodeLookupConnector` to `SupplierConnectors.ts`** (1 day)
   - Implements `SupplierConnector` interface (`fetchByBarcode` + `searchByText`)
   - Reads `BARCODELOOKUP_API_KEY` from env
   - Maps API response → `BatchIngestRow` per §3 field mappings
   - 5s timeout via `AbortSignal.timeout(5000)`
   - Returns `null` if not configured (skipped in chain)

2. **Add `GoUpcConnector` to `SupplierConnectors.ts`** (0.5 day)
   - Implements `fetchByBarcode` only; `searchByText` returns `[]`
   - Reads `GOUPC_API_KEY` from env
   - Same timeout/error patterns

3. **Add `KrogerConnector` to `SupplierConnectors.ts`** (1.5 days)
   - Implements both methods with OAuth2 token management
   - Reads `KROGER_CLIENT_ID` + `KROGER_CLIENT_SECRET` from env
   - Token refresh with 5-min safety margin
   - Transparent re-auth on 401

4. **Integrate parallel orchestration in `BarcodeEnrichmentService.ts`** (1.5 days)
   - Add `enrichFromBarcodeLookup()`, `enrichFromGoUpc()`, `enrichFromKroger()` methods
   - Change `enrich()` Step 4 to `Promise.allSettled([enrichFromBarcodeLookup, enrichFromGoUpc])` → merge payloads
   - Sequential fallback: Kroger → UPCDatabase → OpenFoodFacts → stub
   - Extend `source` type union: `'barcodelookup' | 'goupc' | 'kroger'`
   - Each method: check rate limit → call API → save to DB cache → save to memory cache → log lookup → emit metrics

5. **Create sync job `supplier-commercial-sync.ts`** (1 day)
   - `ensureSupplierExists()` for all three suppliers
   - Nightly backfill for BarcodeLookup.com and Kroger (Go-UPC skipped — no text search)
   - Token refresh for Kroger OAuth2
   - Wire `startSupplierCommercialSync()` into `apps/api/src/index.ts`

6. **Update provider endpoints** (0.5 day)
   - Update `GET /api/barcode-enrichment-singleton/providers` to include new providers
   - Update provider validation in `POST /enrich` and `POST /batch`
   - Add env vars to `apps/api/.env.example`

### Verification
- [ ] `pnpm checkapi` — zero new TS errors
- [ ] Manual test: call enrichment endpoint with a known barcode, verify parallel API calls fire
- [ ] Verify rate limiting still works (429 on exceed)
- [ ] Verify cache hit path unchanged (≤150ms)

### Inflight Checklist (run before starting)
- [ ] Read `deploy-service-extending-base-singleton.md` — connectors extend existing patterns
- [ ] Read `tenant-scoped-id-generation.md` — no new entities, but verify supplier IDs follow convention
- [ ] Confirm env vars not already in use: `BARCODELOOKUP_API_KEY`, `GOUPC_API_KEY`, `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`
- [ ] Check `SupplierConnectors.ts` for existing rate limit patterns to mirror
- [ ] Verify `BatchIngestRow` type covers all fields from commercial API responses

---

## Sprint 2: Wholesale Matching Backend & Capability Gating (4-5 days)

**Goal:** Database tables, service layer, capability resolver, and API routes for B2B wholesale matching with tier gating.

### Tasks

1. **Migration `098_product_suppliers.sql`** (0.5 day)
   - `product_suppliers` table: `id`, `gtin`, `supplier_name`, `supplier_type`, `moq`, `min_order_value`, `external_link`, `affiliate_params`, `region`, `claim_type`, `brand_partner_id`, `created_at`, `updated_at`
   - RLS: cross-tenant read (global supplier data), no tenant-scoped writes
   - Index on `gtin` (lookup), `claim_type` (filtering)
   - Unique constraint on `(gtin, supplier_name)` — one row per supplier per barcode
   - `updated_at` trigger

2. **Migration `099_affiliate_clicks.sql`** (0.5 day)
   - `affiliate_clicks` table: `id`, `tenant_id`, `gtin`, `supplier_id`, `click_id`, `external_url`, `status` (`pending` | `converted` | `expired`), `commission_amount`, `converted_at`, `expires_at`, `created_at`
   - RLS: tenant-scoped (merchants see only their own clicks)
   - Index on `tenant_id`, `click_id` (Faire webhook lookup), `status`
   - `updated_at` trigger

3. **Migration `100_brand_partner_claims.sql`** (0.5 day)
   - `brand_partner_claims` table: `id`, `brand_name`, `gtin`, `claim_type` (`exclusive` | `preferred` | `verified`), `supplier_id`, `admin_approved`, `contact_email`, `created_at`, `updated_at`
   - Unique constraint on `(gtin, claim_type)` where `claim_type = 'exclusive'` — only one exclusive claim per barcode
   - Index on `gtin`, `brand_name`
   - `updated_at` trigger

4. **Prisma schema updates** (0.5 day)
   - Add `ProductSupplier`, `AffiliateClick`, `BrandPartnerClaim` models to `schema.prisma`
   - Run `npx prisma db pull` or manually edit to match migrations
   - Verify relations and indexes

5. **`WholesaleMatchingService.ts`** (1.5 days)
   - `checkSupplierMatch(gtin)` — queries `product_suppliers` for matches, respects `claim_type` hierarchy (exclusive > preferred > verified)
   - `searchFaireSuppliers(query)` — calls Faire API for supplier search (verify endpoint)
   - `buildAffiliateLink(supplier, tenantId)` — constructs Faire affiliate link with tracking params, creates `affiliate_clicks` record
   - `trackAffiliateClick(clickId)` — updates click status
   - `getBrandPartnerClaims(gtin)` — queries `brand_partner_claims` for brand-verified suppliers
   - `saveSupplierMatch(gtin, supplierData)` — inserts/upserts `product_suppliers` row

6. **`WholesaleMatchingResolver.ts` + capability wiring** (1 day)
   - Create resolver: `resolveWholesaleMatching(tenantId)` → `EffectiveWholesaleMatching`
   - Add `EffectiveWholesaleMatching` type to `resolvers/types.ts`
   - Add `wholesale_matching` to `EffectiveCapabilities` type
   - Wire into `EffectiveCapabilityResolver.ts` as `effective[18]`
   - Follow 8-phase capability deployment flow:
     1. Define feature key `wholesale_matching_options` in `canonical-features.ts` + `tier-hierarchies.ts`
     2. Seed DB: `features_list` + `capability_features_list` + `tier_features_list`
     3. No store prefs table needed (tier-gated, not preference-gated)
     4. Resolver + types + wiring (this task)
     5. Route: `wholesale-matching-options-settings.ts` with GET + PUT + tier filtering
     6. Map: `UnifiedCapabilityService.ts` + `CapabilityResolutionService.ts` (frontend fallback)
     7. Display: `CapabilityShowcase.tsx` row
     8. Verify: TS checks + `verify-capability-deployment.md`

7. **API routes** (1.5 days)
   - **Route architecture: orchestrator pattern** — The API uses orchestrator files (`tenant.routes.ts`, `admin.routes.ts`) that mount sub-routers in strict order, registered in `routeRegistry.ts`. New routes must be added to the appropriate orchestrator, NOT mounted individually in `index.ts`.
   - `wholesale-matching.ts` (tenant sub-resource router):
     - `GET /check?gtin=...` — check supplier match (mounted in `tenant.routes.ts` under `/:tenantId/wholesale`)
     - `POST /search` — Faire supplier search
     - `GET /suppliers` — list known suppliers for tenant products
     - `GET /dashboard` — distributor dashboard data
   - `wholesale-matching-options-settings.ts` (tenant settings router):
     - `GET /:tenantId/wholesale-matching-options` — capability settings
     - `PUT /:tenantId/wholesale-matching-options` — update settings
     - Mount in `tenant.routes.ts` alongside other `*-options-settings` routers
   - `admin/wholesale-matching.ts` (admin sub-path router):
     - `GET /suppliers` — admin supplier dashboard
     - `GET /affiliate/analytics` — affiliate click analytics
     - Mount in `admin.routes.ts` under `/wholesale` sub-path, BEFORE generic root mounts
   - `admin/brand-partners.ts` (admin sub-path router):
     - `POST /claims` — admin CRUD for brand partner claims
     - `GET /claims` — list claims
     - Mount in `admin.routes.ts` under `/brand-partners` sub-path
   - `brand-partners.ts` (authenticated, non-tenant):
     - `POST /claims` — brand self-service claim submission
     - Mount in `routeRegistry.ts` as standalone `/api/brand-partners` entry
   - `webhooks/faire.ts` (webhook):
     - `POST /` — Faire order confirmation callback, updates `affiliate_clicks.status`
     - **Must be mounted as `preMiddleware: true`** in `routeRegistry.ts` (before JSON parsing, for signature verification — same pattern as Stripe webhooks)
   - **Route ordering rules:**
     - Tenant sub-resource routers mount BEFORE `tenantsRoutes` (which has `/:id` catch-all) in `tenant.routes.ts`
     - Admin sub-path routers mount BEFORE generic root-mounted routers in `admin.routes.ts`
     - Webhook routes mount in pre-middleware section of `routeRegistry.ts`

### Verification
- [ ] `pnpm checkapi` — zero new TS errors
- [ ] `pnpm checkweb` — zero new TS errors (capability types propagate)
- [ ] Migrations run idempotently: `DO$$ BEGIN ... EXCEPTION WHEN OTHERS THEN END $$;`
- [ ] RLS policies verified: `affiliate_clicks` tenant-scoped, `product_suppliers` global read
- [ ] Capability resolver returns correct tier gating (free=none, growth=search, scale=full)
- [ ] Faire webhook handles order confirmation (updates click status)
- [ ] `verify-capability-deployment.md` checklist passes

### Inflight Checklist (run before starting)
- [ ] Read `tenant-scoped-id-generation.md` — new entities: `psup-{nanoid}` (product_suppliers), `ac-{tk}-{nanoid}` (affiliate_clicks), `bpc-{nanoid}` (brand_partner_claims)
- [ ] Read `capability-deployment-flow.md` — 8-phase deployment for `wholesale_matching_options`
- [ ] Read `capability-data-flow-rules.md` — naming conventions, frontend fallback parity
- [ ] Read `capability-constraint-relationships.md` — check if wholesale matching depends on or conflicts with existing capabilities
- [ ] Read `add-capability-feature.md` skill for the full deployment pattern
- [ ] Read `api-route-architecture-audit.md` — route ordering and catch-all collision rules
- [ ] **Review `routeRegistry.ts`** — understand the `RouteEntry` interface (`path`, `router`, `middleware`, `domain`, `preMiddleware`, `isCatchAll`) and `mountFromRegistry()` function
- [ ] **Review `tenant.routes.ts` orchestrator** — new wholesale routes mount as sub-resource routers BEFORE `tenantsRoutes` (which has `/:id` catch-all)
- [ ] **Review `admin.routes.ts` orchestrator** — admin wholesale/brand-partner routes mount as specific sub-path routers BEFORE generic root mounts
- [ ] **Review webhook mounting pattern** — Faire webhook must be `preMiddleware: true` in `routeRegistry.ts` (before JSON parsing for signature verification, same as Stripe webhooks at `/api/webhooks`)
- [ ] Verify migration numbers 098, 099, 100 don't collide (confirmed: latest is 097)
- [ ] Plan RLS: `product_suppliers` is cross-tenant (global), `affiliate_clicks` is tenant-scoped
- [ ] Check `FAIRE_API_KEY` env var not already in use
- [ ] Identify Faire API endpoints (marked "verify" in design doc — may need partner program enrollment)
- [ ] Plan webhook signature verification for Faire
- [ ] Check if `wholesale_matching_options` feature key collides with existing keys in `canonical-features.ts`
- [ ] **Verify no route path collisions** — check that `/api/tenants/:tenantId/wholesale` doesn't collide with existing tenant sub-resource paths
- [ ] **Verify no admin sub-path collision** — check that `/wholesale` and `/brand-partners` don't collide with existing admin sub-paths

---

## Sprint 3: EditItemModal Decomposition (3-4 days)

**Goal:** Break the 1180-line `EditItemModal` monolith into focused components. No behavior changes — purely structural.

### Tasks

1. **Extract `useItemFormState.ts` hook** (1 day)
   - Move all 20+ `useState` calls from `EditItemModal`
   - Move item initialization effect (lines ~234-307)
   - Move digital product stock effect (lines ~377-389)
   - Move save handler (lines ~420-586)
   - Return `{ values, setters, handleSave, resetForm }`
   - `EditItemModal` consumes hook, renders same JSX — verify `pnpm checkweb`

2. **Extract `useVariantManagement.ts` hook** (0.5 day)
   - Move variant state (`variants`, `originalVariants`, `hasVariants`, `attributeTypes`, `variantsLoading`)
   - Move variant loading effect (lines ~309-375)
   - Move `detectVariantChanges()`, `extractAttributeTypes()`
   - Move variant save logic from `handleSave`
   - Return `{ variants, setVariants, hasVariants, setHasVariants, detectChanges, loading }`
   - Verify `pnpm checkweb`

3. **Extract `ItemBasicFields.tsx`** (0.5 day)
   - Move SKU/name/brand/manufacturer/condition/MPN JSX (lines ~735-824)
   - Pure presentational with props
   - Verify `pnpm checkweb`

4. **Extract `ItemPricingFields.tsx`** (0.25 day)
   - Move price/sale price/stock JSX (lines ~826-882)
   - Verify `pnpm checkweb`

5. **Extract `ItemContentFields.tsx`** (0.25 day)
   - Move description/enhanced/features/specifications JSX (lines ~884-954)
   - Verify `pnpm checkweb`

6. **Extract `ItemCategorySection.tsx`** (0.25 day)
   - Move category display + selector trigger JSX (lines ~990-1064)
   - Verify `pnpm checkweb`

7. **Extract `ItemPhotoPlaceholder.tsx` + `ItemCurrentValues.tsx`** (0.25 day)
   - Small presentational extractions (lines ~956-988, ~1076-1101)
   - Move `CategoryNameDisplay` to `items/` root (already self-contained, lines 1-88)
   - Verify `pnpm checkweb`

8. **Create `EditItemForm.tsx` + `types.ts`** (0.5 day)
   - `EditItemForm` wraps all sub-components, consumes both hooks
   - `EditItemModal.tsx` becomes ~150-line orchestrator (modal open/close + delegates to `EditItemForm`)
   - `types.ts` for shared prop types
   - Verify `pnpm checkweb`

### Verification
- [ ] `pnpm checkweb` — zero new TS errors after EACH extraction step
- [ ] Manual test: open modal for create, edit, all field inputs work
- [ ] Manual test: variants add/edit/delete work
- [ ] Manual test: save creates/updates item correctly
- [ ] No behavior changes — only file structure changed
- [ ] `EditItemModal.tsx` is ≤200 lines

### Inflight Checklist (run before starting)
- [ ] Read `skill-frontend-ux-guardrails.md` — component patterns, loading/empty/error states
- [ ] Read `debug-infinite-render-loops.md` — risk when extracting hooks with effects
- [ ] Verify `useItemsModals.ts` contract — `EditItemModal` props must not change
- [ ] Verify `ItemsPageClient.tsx` integration — `onSave` callback signature unchanged
- [ ] Check for any `EditItemModal` consumers beyond `ItemsPageClient` (grep for imports)
- [ ] Plan prop types in `types.ts` — avoid `any`, use proper interfaces
- [ ] Each extraction step is a separate commit for easy rollback

---

## Sprint 4: Frontend Spec-Aligned Features (4-5 days)

**Goal:** Add GTIN/barcode enrichment and supplier engagement to both the decomposed EditItemModal and the existing ItemCreationWizard.

### Tasks

1. **Shared components** (1.5 days)
   - `OrderBulkButton.tsx` — shows when supplier match found, links to `external_link` with affiliate params, calls `trackAffiliateClick()` on click
   - `FindSupplierUpsell.tsx` — tier-aware: grayed message for free tier, interactive "Find Supplier via Faire" button for premium
   - `useWholesaleMatchingCapability.ts` hook — uses `resolveEffectiveCapabilities` for tier gating
   - `WholesaleMatchingService.ts` (frontend singleton) — extends `TenantApiSingleton`, methods: `checkMatch(gtin)`, `searchSuppliers(query)`, `trackClick(clickId)`, `listSuppliers()`
   - Faire search results modal — brand stories, wholesale terms, MOQ, ordering links

2. **EditItemModal enhancements (post-decomposition)** (1.5 days)
   - Add GTIN/barcode input field to `ItemBasicFields.tsx`
   - Add `lookupBarcode(gtin)` to `useItemFormState.ts` — calls `SupplierImportService.enrichBarcode()`, maps `BarcodeEnrichment` → form fields (same logic as `ItemCreationWizard.handleEnrichmentMatch`)
   - Add enrichment loading state to `ItemBasicFields` — spinner on barcode field, "Enriched from {source}" badge on success
   - Add `SupplierMatchSection.tsx` to `edit-modal/` — renders below content fields, calls `checkSupplierMatch(gtin)` on mount/when GTIN changes
   - Include `gtin` in save payload from `useItemFormState.handleSave()`
   - **Product type awareness:** GTIN field and `SupplierMatchSection` only render for `physical` product type (hidden for digital/service)

3. **Wizard enhancement** (0.5 day)
   - Add `SupplierMatchSection` to `ReviewStep.tsx` — calls `checkSupplierMatch(gtin)` after enrichment completes
   - Affiliate click tracking on "Order Bulk" click
   - No decomposition needed — wizard already step-decomposed (§12.4.5)

4. **Distributor dashboard** (1.5 days)
   - `DistributorDashboardClient.tsx` at `/t/[tenantId]/settings/wholesale`
   - Product table with supplier status per GTIN
   - Regional filters
   - Affiliate earnings widget (from `affiliate_clicks` where `status = 'converted'`)
   - Settings card in `TenantSettings.tsx` (under "Stores" or "Featured Products" group)
   - Sidebar link in `DynamicTenantSidebar.tsx` under "My Inventory" children
   - `navigation_links` INSERT for the new page

### Verification
- [ ] `pnpm checkapi` — zero new TS errors
- [ ] `pnpm checkweb` — zero new TS errors
- [ ] Manual test: EditItemModal — enter barcode, verify enrichment populates fields
- [ ] Manual test: EditItemModal — verify "Order Bulk" appears when supplier match found
- [ ] Manual test: EditItemModal — verify "Find Supplier" upsell appears for premium tier, grayed for free
- [ ] Manual test: Wizard — verify `SupplierMatchSection` on ReviewStep
- [ ] Manual test: Distributor dashboard loads, shows product supplier status
- [ ] Verify GTIN field hidden for digital/service product types in modal
- [ ] Verify affiliate click tracking creates `affiliate_clicks` record

### Inflight Checklist (run before starting)
- [ ] Read `deploy-service-extending-base-singleton.md` — `WholesaleMatchingService` extends `TenantApiSingleton`
- [ ] Read `database-navigation-system.md` — new page at `/t/[tenantId]/settings/wholesale`
  - Sidebar target: `tenant`
  - Icon: identify from registered icons (e.g., `Truck` or `PackageCheck`)
  - Parent: "My Inventory" or "Store Settings"
  - Plan `navigation_links` INSERT with dynamic subquery for parent ID
  - Plan settings card in `TenantSettings.tsx`
- [ ] Read `capability-deployment-flow.md` — verify frontend capability hook matches backend resolver
- [ ] Read `skill-frontend-ux-guardrails.md` — loading/empty/error/disabled states for all new components
- [ ] Read `saas-navigation.md` — sidebar navigation patterns for the new wholesale page
- [ ] Verify `SupplierImportService.enrichBarcode()` method signature matches what `useItemFormState` will call
- [ ] Check `ItemCreationWizard.handleEnrichmentMatch` for the exact `BarcodeEnrichment` → form field mapping to replicate in `useItemFormState`
- [ ] Plan React Query cache keys for wholesale matching queries (include tenant ID)
- [ ] Verify Faire search results modal is SSR-safe (no `window`/`localStorage` access without guards)

---

## Sprint 5: Monetization, Brand Partners & Polish (3-4 days)

**Goal:** Brand partner claims, affiliate analytics, admin tools, and final polish.

### Tasks

1. **Brand partner claim flow** (1 day)
   - Admin UI for reviewing/approving brand partner claims
   - Brand self-service claim submission form (public or authenticated route)
   - `claim_type` hierarchy enforcement: exclusive > preferred > verified
   - Admin approval workflow with email notification

2. **Affiliate analytics dashboard** (1 day)
   - Admin analytics: total clicks, conversion rate, commission earnings
   - Per-tenant affiliate earnings view in distributor dashboard
   - `affiliate_clicks.status` lifecycle: `pending` → `converted` (Faire webhook) → `expired` (30-day cleanup job)

3. **Affiliate click expiry job** (0.5 day)
   - Daily job to mark clicks as `expired` after 30 days with no conversion
   - Wire into `apps/api/src/index.ts` startup

4. **Polish & documentation** (1-1.5 days)
   - Update `SupplierService.ts` header comment
   - Update `COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md` with any implementation deviations
   - Add env vars to `.env.example` (if not done in Sprint 1)
   - Verify all tier gating works end-to-end (free vs growth vs scale)
   - Optional: wizard polish — extract `WizardData` + `INITIAL_DATA` to `wizards/types.ts`, `handleEnrichmentMatch` to `wizards/utils/enrichmentMapper.ts` (§12.4.5 optional refactors)

### Verification
- [ ] `pnpm checkapi` — zero new TS errors
- [ ] `pnpm checkweb` — zero new TS errors
- [ ] Admin can approve/reject brand partner claims
- [ ] Brand can submit claims via self-service form
- [ ] Affiliate analytics dashboard shows correct metrics
- [ ] Click expiry job runs without errors
- [ ] All tier gating verified: free (no wholesale), growth (search only), scale (full)

### Inflight Checklist (run before starting)
- [ ] Read `self-serve-stores-guide.md` — check if wholesale dashboard needs to be in App Store
- [ ] Read `cross-context-cache-invalidation.md` — affiliate click creation may need cache invalidation
- [ ] Plan admin route auth: `requireRole` or `requirePermission` for brand partner claim approval
- [ ] Plan email notification templates for claim approval/rejection (use `BillingNotificationService` patterns)
- [ ] Verify `affiliate_clicks` cleanup job doesn't conflict with existing daily jobs

---

## Dependency Graph

```
Sprint 1 (Backend Connectors)
    ↓
Sprint 2 (Wholesale Backend + Capability)
    ↓                    ↓
Sprint 3 (Decomposition)  Sprint 4 (Frontend Features)
    ↓                    ↓
    └───→ Sprint 5 (Monetization & Polish)
```

- **Sprint 1 → Sprint 2**: Enrichment service must exist before wholesale matching can use enriched data
- **Sprint 2 → Sprint 4**: Capability resolver and API routes must exist before frontend can call them
- **Sprint 3 → Sprint 4**: Decomposition must complete before adding spec features to modal
- **Sprint 3 can run in parallel with Sprint 2** (different codebases: frontend vs backend)
- **Sprint 4 requires both Sprint 2 AND Sprint 3** complete
- **Sprint 5 requires Sprint 4** (needs frontend components for analytics)

## Critical Path

**Sprint 1 → Sprint 2 → Sprint 4 → Sprint 5** = 16-20 days

With Sprint 3 parallelized during Sprint 2:
**Critical path = Sprint 1 (5-6d) + Sprint 2 (4-5d) + Sprint 4 (4-5d) + Sprint 5 (3-4d) = 16-20 days**

Sprint 3 (3-4d) runs in parallel with Sprint 2 — no impact on critical path.

## Total Estimate

| Sprint | Days | Can Parallelize With |
|---|---|---|
| Sprint 1: Backend Connectors | 5-6 | — |
| Sprint 2: Wholesale Backend | 4-5 | Sprint 3 |
| Sprint 3: Modal Decomposition | 3-4 | Sprint 2 |
| Sprint 4: Frontend Features | 4-5 | — |
| Sprint 5: Monetization & Polish | 3-4 | — |
| **Total (critical path)** | **16-20** | |
| **Total (serial)** | **19-24** | |

## Pre-Flight Summary (All Sprints)

```
Phase/Sprint: Barcode-Driven Product Onboarding & B2B Wholesale Matching
Design doc: docs/COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md

New services: WholesaleMatchingService (API), WholesaleMatchingService (frontend singleton)
New entities: product_suppliers (global), affiliate_clicks (tenant-scoped), brand_partner_claims (global)
New ID generators: psup-{nanoid}, ac-{tk}-{nanoid}, bpc-{nanoid}
New pages/routes: /t/[tenantId]/settings/wholesale, /api/tenants/:tenantId/wholesale/* (tenant.routes.ts orchestrator), /api/admin/wholesale/* (admin.routes.ts orchestrator), /api/admin/brand-partners/* (admin.routes.ts orchestrator), /api/brand-partners/claims (routeRegistry.ts standalone), /api/webhooks/faire (routeRegistry.ts preMiddleware)
New sidebar links: "Wholesale Dashboard" under "My Inventory"
New settings cards: TenantSettings "Wholesale & Suppliers" under Stores group
New migrations: 098_product_suppliers, 099_affiliate_clicks, 100_brand_partner_claims
New background jobs: supplier-commercial-sync (nightly), affiliate-click-expiry (daily)
New capability features: wholesale_matching_options (tier-gated: free=none, growth=search, scale=full)
Route architecture: Orchestrator pattern — tenant routes in tenant.routes.ts, admin routes in admin.routes.ts, webhooks in routeRegistry.ts with preMiddleware: true. NO direct app.use() in index.ts for routes.
Skills to read before starting: api-route-architecture-audit, deploy-service-extending-base-singleton, tenant-scoped-id-generation, capability-deployment-flow, capability-data-flow-rules, capability-constraint-relationships, add-capability-feature, database-navigation-system, skill-frontend-ux-guardrails, saas-navigation, debug-infinite-render-loops
Skills to update after completion: None anticipated
New skill to create (if any): barcode-wholesale-integration.md (created)
```
