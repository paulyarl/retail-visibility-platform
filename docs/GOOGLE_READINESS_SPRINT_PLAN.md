# Google Readiness Sprint Plan

**Created:** 2026-06-29  
**Goal:** Make Google visibility the leading wedge for merchant acquisition. Fix all gaps identified in the Google Readiness Audit so the platform can confidently demo Google sync to prospective merchants.

**Context:** Google visibility is the #1 pitch angle for non-digital retail merchants. The platform has functional GMC + GBP sync infrastructure, but it has not been aligned with recent capability system enhancements (product types, storefront types, tier gating). This sprint closes those gaps.

---

## Sprint 0: Pre-Demo Blockers (Must complete before merchant demos)

### 0.1 — Enable feature flag for demo tenants

- **Gap:** `FF_GOOGLE_CONNECT_SUITE` is at 15% rollout with a pilot cohort of 2 tenants. Demo tenants will be blocked from Google integration.
- **Files:** `docs/feature-flags/registry.yaml`
- **Tasks:**
  - [ ] Add demo tenant IDs to `pilot_cohort` list in `FF_GOOGLE_CONNECT_SUITE`
  - [ ] Alternatively, move `production: true` if broader rollout is desired
  - [ ] Verify feature flag check is actually enforced in Google integration routes (currently it may not be checked at all)

### 0.2 — Unify Google OAuth: migrate GBP tokens to encrypted storage

- **Gap:** GMC uses `google_oauth_accounts_list` + `google_oauth_tokens_list` (encrypted, AES-256-GCM). GBP stores tokens as **unencrypted plain text** on the `tenants` table (`google_business_access_token`, `google_business_refresh_token`). Security vulnerability + confusing dual-OAuth UX.
- **Files:** 
  - `apps/api/src/services/GBPBusinessInfoSync.ts` — `getValidAccessToken()` reads from `tenants` table
  - `apps/api/src/routes/google-business-oauth.ts` — callback stores tokens on `tenants` table
  - `apps/api/prisma/schema.prisma` — GBP token columns on `tenants` model
- **Tasks:**
  - [ ] Migrate GBP OAuth callback to store tokens in `google_oauth_tokens_list` (same as GMC)
  - [ ] Migrate `GBPBusinessInfoSync.getValidAccessToken()` to read from `google_oauth_tokens_list`
  - [ ] Migrate `google-business-oauth.ts` location listing + sync to use shared token store
  - [ ] Create migration script to move existing GBP tokens from `tenants` columns to `google_oauth_tokens_list`
  - [ ] Remove `google_business_access_token`, `google_business_refresh_token`, `google_business_token_expiry` columns from `tenants` (after migration + verification)
  - [ ] Consolidate OAuth flow: one "Connect Google" button that requests both `content` + `business.manage` scopes (already done in `oauth.ts` `GOOGLE_SCOPES`) — GBP should reuse the same OAuth account, not initiate a separate flow
  - [ ] Update frontend to show single Google connection status (not separate GMC + GBP cards)

### 0.3 — Add automated GMC product sync job

- **Gap:** No scheduled GMC sync job exists. Products go stale on Google Shopping without re-sync. Merchants must manually trigger.
- **Files:**
  - `apps/api/src/jobs/gmc-product-sync.ts` (NEW)
  - `apps/api/src/index.ts` (wire job startup)
- **Tasks:**
  - [ ] Create `gmc-product-sync.ts` job that runs every 6 hours
  - [ ] Job queries all tenants with active GMC connections (OAuth tokens + active merchant link)
  - [ ] For each tenant, calls `batchSyncProducts(tenantId)` for all public, non-trashed items
  - [ ] Log sync results per tenant (synced/failed counts)
  - [ ] Rate limit: max 100 GMC requests per hour per tenant (mirror singleton service config)
  - [ ] Wire into server startup in `index.ts` alongside other scheduled jobs

### 0.4 — Filter non-syncable product types from GMC sync

- **Gap:** `convertToGoogleProduct()` only checks `visibility === 'public'`. Digital products, service products, and subscriptions are synced to Google Shopping where they will be rejected or create invalid listings.
- **Files:**
  - `apps/api/src/services/GMCProductSync.ts` — `syncProduct()` and `batchSyncProducts()`
  - `apps/api/src/services/resolvers/ProductTypeResolver.ts` (reference for product type checks)
- **Tasks:**
  - [ ] Define syncable product types: `physical` (sync), `digital` (skip), `service` (skip), `subscription` (skip)
  - [ ] Add product type check in `syncProduct()` before calling `convertToGoogleProduct()`
  - [ ] Add product type filter in `batchSyncProducts()` where clause
  - [ ] Return informative skip message in sync result (not a failure — a deliberate exclusion)
  - [ ] Log skipped items for audit trail

### 0.5 — Verify storefront publication before GMC sync

- **Gap:** GMC sync builds product links using subdomain or fallback URL without verifying the storefront is actually enabled/published. Products could be synced with links to a disabled storefront — Google flags these as mismatched domains.
- **Files:**
  - `apps/api/src/services/GMCProductSync.ts` — `syncProduct()` and `batchSyncProducts()`
  - `apps/api/src/services/resolvers/StorefrontTypeResolver.ts` (reference)
- **Tasks:**
  - [ ] Check storefront capability is enabled for tenant before sync
  - [ ] Verify tenant has a subdomain configured (or custom domain) — fallback URL `visibleshelf.com/store/{tenantId}` is not GMC-compliant
  - [ ] Return clear error if storefront not published: "Storefront must be published with a custom domain or subdomain before Google sync"
  - [ ] Add pre-sync validation step in `getGMCSyncStatus()` — include `storefrontReady: boolean` in status response

### 0.6 — GBP API approval status

- **Gap:** GBP locations endpoint has explicit `api_not_approved` error handling with `quota_limit_value: '0'`, indicating Google Business Profile API access is pending platform verification.
- **Files:** None (external dependency)
- **Tasks:**
  - [x] Check Google Cloud Console for GBP API verification status
  - [x] If pending: complete Google's verification process (OAuth consent screen, domain verification, business verification)
  - [x] If approved: remove the `api_not_approved` error handling or convert to a warning
  - [x] If blocked: document workaround (manual GBP setup) and adjust demo pitch to lead with GMC (Shopping) instead of GBP (Business Profile)

**Status (2026-06-30):** GBP API access is pending Google's platform verification. The codebase already handles this gracefully:
- `google-business-oauth.ts` locations endpoint returns `api_not_approved` (503) with user-friendly message when `quota_limit_value: '0'`
- GBP OAuth flow and token storage work correctly — only the locations API is blocked
- **Demo strategy:** Lead with GMC (Google Shopping) as the primary wedge. GBP is "connected but pending Google approval" — show the sync UI and explain the value, but don't demo live GBP location linking until approved.
- **Action items for user:** Complete Google's OAuth consent screen verification + business verification in Google Cloud Console to unblock GBP API access.

---

## Sprint 1: Capability Alignment (Post-demo, pre-scale)

### 1.1 — Enforce integration capability gating in sync routes

- **Gap:** GMC and GBP sync routes check OAuth connection only. They do NOT check `IntegrationOptionsResolver` or `EffectiveCapabilityResolver`. A tenant on the lowest tier with OAuth tokens can sync to Google, bypassing the tier system.
- **Files:**
  - `apps/api/src/routes/google-merchant-oauth.ts` — sync endpoints
  - `apps/api/src/routes/google-business-oauth.ts` — sync endpoints
  - `apps/api/src/services/resolvers/IntegrationOptionsResolver.ts` (reference)
  - `apps/api/src/services/EffectiveCapabilityResolver.ts` (reference)
- **Tasks:**
  - [ ] Add capability check in `POST /google/merchant/sync` — verify `integration_google_merchant_center` is enabled
  - [ ] Add capability check in `POST /google/merchant/sync/:itemId` — same
  - [ ] Add capability check in `POST /google/business/sync` — verify `integration_gbp` is enabled
  - [ ] Return 403 `tier_restricted` error if capability not enabled
  - [ ] Add capability check in batch sync job (skip tenants without capability)

### 1.2 — Wire VariantAwareGMCSync into routes

- **Gap:** `VariantAwareGMCSync.ts` exists with full variant-aware product conversion (itemGroupId, color, size, pattern, material, gender, ageGroup) but routes call the non-variant `GMCProductSync.ts`. Product variants are not synced as separate Google items.
- **Files:**
  - `apps/api/src/services/VariantAwareGMCSync.ts` (exists, needs wiring)
  - `apps/api/src/routes/google-merchant-oauth.ts` — sync endpoints
  - `apps/api/src/services/GMCProductSync.ts` — consolidate
- **Tasks:**
  - [ ] Replace `batchSyncProducts()` calls in routes with `VariantAwareGMCSync` when items have variants
  - [ ] Fall back to basic `convertToGoogleProduct()` for items without variants
  - [ ] Ensure variant attributes (color, size, etc.) are pulled from inventory item metadata or variant tables
  - [ ] Test with a product that has 3+ variants to verify itemGroupId linkage

### 1.3 — Consolidate duplicate GMC sync services

- **Gap:** `GMCProductSync.ts` (standalone functions, used by routes) and `GMCProductSyncSingletonService.ts` (singleton class with rate limiting + analytics, has mock token bypass for test tenant `tid-m8ijkrnk`). The singleton is partially used or dead code.
- **Files:**
  - `apps/api/src/services/GMCProductSync.ts`
  - `apps/api/src/services/GMCProductSyncSingletonService.ts`
- **Tasks:**
  - [ ] Audit which callers use standalone vs singleton
  - [ ] Merge singleton's rate limiting + analytics into standalone functions
  - [ ] Remove mock token bypass or gate behind `NODE_ENV === 'test'`
  - [ ] Delete `GMCProductSyncSingletonService.ts` after merge
  - [ ] Update all imports

### 1.4 — Add Google product category mapping UI

- **Gap:** `convertToGoogleProduct()` uses `item.google_product_category_id` if set, but there's no UI to help merchants map platform categories to Google's product taxonomy (~5,000 categories). Most products will have no Google category set.
- **Files:**
  - `apps/web/src/app/t/[tenantId]/settings/` (new page)
  - `apps/api/src/routes/` (new or existing category routes)
- **Tasks:**
  - [ ] Fetch Google product category taxonomy (Google publishes this as a static file)
  - [ ] Add category mapping table: `tenant_category_id` → `google_product_category_id`
  - [ ] Build admin UI: for each platform category, search/select Google category
  - [ ] Auto-populate `google_product_category_id` on items based on their category mapping
  - [ ] Show coverage metric: "X of Y categories mapped to Google"

---

## Sprint 2: Sync Quality & Error Handling

### 2.1 — Add pre-sync validation for Google Shopping compliance

- **Gap:** No pre-sync validation that products meet Google Shopping requirements. Non-compliant products are rejected by Google after sync, with no advance warning.
- **Files:**
  - `apps/api/src/services/GMCProductSync.ts` or new `GMCValidationService.ts`
  - `apps/web/src/app/t/[tenantId]/settings/integrations/google/` (validation results UI)
- **Tasks:**
  - [ ] Define validation rules: GTIN required for branded products, brand required, image URL required + valid, description min 30 chars, title max 150 chars, price > 0
  - [ ] Add `validateProductForGMC(item)` function
  - [ ] Run validation before sync, return issues as warnings (don't block, but report)
  - [ ] Add "Validation Report" section to sync-status page showing per-product issues
  - [ ] Add bulk validation endpoint: `GET /google/merchant/validation-report`

### 2.2 — Add retry queue for failed syncs

- **Gap:** Failed syncs are marked `sync_status: 'error'` with no retry mechanism. Merchant must manually re-trigger sync for each failed product.
- **Files:**
  - `apps/api/src/jobs/gmc-sync-retry.ts` (NEW)
  - `apps/api/src/index.ts` (wire job)
- **Tasks:**
  - [ ] Create `gmc-sync-retry.ts` job that runs every 2 hours
  - [ ] Query items with `sync_status: 'error'` for tenants with active GMC connections
  - [ ] Retry sync with exponential backoff (max 3 retries per item)
  - [ ] Track retry count in item metadata or a sync retry log table
  - [ ] After max retries, mark as `sync_status: 'permanent_error'` and notify tenant

### 2.3 — Auto-delete products from GMC on item trash/delete

- **Gap:** When an item is trashed or deleted from the platform, it's not removed from Google Merchant Center. Stale products remain on Google Shopping.
- **Files:**
  - `apps/api/src/services/GMCProductSync.ts` — `deleteProduct()` exists but is not called on item lifecycle events
  - Item delete/trash route handlers
- **Tasks:**
  - [ ] Hook into item trash handler: call `deleteProduct(tenantId, itemId)` if item was previously synced
  - [ ] Hook into item delete handler: same
  - [ ] Fire-and-forget (don't block item deletion on GMC deletion success)
  - [ ] Log GMC deletion result

### 2.4 — Add GBP hours sync

- **Gap:** `GBPBusinessInfoSync` syncs name/phone/website/address/description/categories but NOT business hours. `GBPSyncTrackingService` has `hours` as a tracked category but no implementation.
- **Files:**
  - `apps/api/src/services/GBPBusinessInfoSync.ts`
  - `apps/api/src/services/GBPSyncTrackingService.ts`
- **Tasks:**
  - [ ] Add `syncBusinessHours(tenantId, hoursData)` function
  - [ ] Read from `business_hours_list` table
  - [ ] Convert to GBP hours format (open/close periods per day)
  - [ ] Push to GBP API: `PATCH /locations/{locationId}?updateMask=regularHours`
  - [ ] Add special hours sync from `business_hours_special_list`
  - [ ] Wire into `syncAllBusinessInfo()` so hours are included in full sync

---

## Sprint 3: Demo Tenant Infrastructure

### 3.1 — Demo tenant creation tooling

- **Gap:** No concept of "demo" tenants with pre-populated data, restricted capabilities, or expiration.
- **Files:**
  - `apps/api/src/services/DemoTenantService.ts` (NEW)
  - `apps/api/src/routes/admin/demo-tenants.ts` (NEW)
  - `apps/web/src/app/(platform)/settings/admin/demo-tenants/` (NEW)
- **Tasks:**
  - [ ] Define demo tenant schema: `is_demo: boolean`, `demo_expires_at: timestamp`, `demo_source_tenant_id: string` (optional, for cloning)
  - [ ] Create `DemoTenantService` with: `createDemoTenant()`, `seedDemoProducts()`, `expireDemoTenant()`
  - [ ] Admin route to create demo tenant from template (grocery, convenience, specialty retail)
  - [ ] Seed with 15-20 realistic products per template with images, prices, categories, GTINs
  - [ ] Pre-configure: subdomain, GBP categories, Google product categories, business hours, fulfillment settings
  - [ ] Auto-expire after 30 days (configurable)
  - [ ] Demo banner on storefront: "This is a demonstration store"

### 3.2 — QR code generation for demo tenants

- **Gap:** No QR-code-specific landing experience. QR codes would just point to the storefront URL.
- **Files:**
  - `apps/web/src/app/qr/[tenantId]/page.tsx` (NEW)
  - `apps/web/src/components/qr/` (NEW)
- **Tasks:**
  - [ ] Generate QR codes that resolve to `{subdomain}.visibleshelf.com` or `/qr/{tenantId}`
  - [ ] QR landing page: storefront with demo banner + "This is what your store could look like" CTA
  - [ ] Track QR scan analytics (scan count, unique visitors, conversion to signup)
  - [ ] Generate printable QR cards (PDF) for in-person sales meetings

---

## Sprint 4: Frontend Polish

### 4.1 — Unified Google integration dashboard

- **Gap:** Frontend has 6 pages under `/settings/integrations/google/` but they're basic. No unified view showing GMC + GBP status, sync health, product coverage, and validation issues in one place.
- **Files:**
  - `apps/web/src/app/t/[tenantId]/settings/integrations/google/page.tsx` (main page)
  - `apps/web/src/app/t/[tenantId]/settings/integrations/google/sync-status/page.tsx`
  - `apps/web/src/app/t/[tenantId]/settings/integrations/google/advanced/page.tsx`
- **Tasks:**
  - [x] Redesign main Google page with tabbed layout: Overview | Products | Business Profile | Settings
  - [x] Overview tab: connection status (single Google account), sync health summary, product coverage %, validation issues count
  - [x] Products tab: per-product sync status table (synced/pending/error/skipped), retry button, validation issues
  - [x] Business Profile tab: GBP connection, location info, hours sync, category sync, last sync per field
  - [x] Settings tab: fulfillment mode (pickup/shipping), merchant link, subdomain configuration

### 4.2 — Sync health dashboard with per-product status

- **Gap:** Current sync-status page shows aggregate counts only. No per-product breakdown.
- **Files:**
  - `apps/web/src/app/t/[tenantId]/settings/integrations/google/sync-status/`
- **Tasks:**
  - [x] Add per-product sync status table with: product name, SKU, sync status, last synced, error message
  - [x] Filter by status (all/synced/pending/error/skipped)
  - [x] Bulk actions: retry selected, sync selected
  - [x] Auto-refresh every 30 seconds during active sync

---

## Sprint 5: Organizational Scaling

### 5.1 Org-Level Google Integration Dashboard

**Goal:** Aggregate Google integration sync health across all child tenants for org admins.

**Depends on:** Sprint 4.1 (unified dashboard) + Sprint 4.2 (sync health table)

**Tasks:**
- [ ] Create org-level Google integration page at `/settings/organization/google` using the same container + tab pattern
- [ ] Overview tab: aggregate sync health across all child tenants (connected/disconnected counts, total sync errors, product coverage %)
- [ ] Products tab: cross-tenant product sync status table with tenant column + filter by tenant within org
- [ ] Business Profile tab: all GBP locations across the org in one view
- [ ] Settings tab: org-level fulfillment defaults with "push to child tenants" action (reuses PropagationService pattern)
- [ ] Backend endpoint: `GET /api/organizations/:orgId/google/aggregate-sync-status` — loops over child tenants, calls existing per-tenant sync status, aggregates
- [ ] Capability gating: resolve via `resolveEffectiveCapabilities(heroTenantId)` — org tier's `integration_options` features gate the org-level dashboard
- [ ] Bulk actions: trigger sync across all locations, retry all errored products across locations

### 5.2 Org-Level QR Code Management

**Goal:** Enable org admins to batch-generate QR codes and view aggregate scan analytics across all locations.

**Depends on:** Sprint 3.2 (QR code generation)

**Tasks:**
- [ ] Add "QR Codes" section to org admin panel with batch generation for all child tenants
- [ ] Batch printable card generation: one PDF/PNG per location, or a combined sheet
- [ ] Backend endpoint: `GET /api/organizations/:orgId/qr-analytics` — aggregates `qr_scan_events` across child tenants (`WHERE tenant_id IN (SELECT id FROM tenants WHERE organization_id = $1)`)
- [ ] Org-level analytics dashboard: per-location scan breakdown + total org scans, comparison chart
- [ ] Capability gating: resolve via `resolveEffectiveCapabilities(heroTenantId)` — org tier's `product_options.features.product_opt_qr_codes` gates QR management

### 5.3 Demo Organizations

**Goal:** Extend the demo tenant concept to support demo organizations with multiple child locations for chain/multi-location sales demos.

**Depends on:** Sprint 3.1 (demo tenant tooling) + Sprint 3.2 (QR code generation)

**Tasks:**
- [ ] Database migration: add `is_demo`, `demo_expires_at`, `demo_template` columns to `organizations_list` (nullable, additive)
- [ ] Update Prisma schema: add demo fields to `organizations_list` model
- [ ] Create `DemoOrganizationService` (backend) — mirrors `DemoTenantService` pattern:
  - `createDemoOrganization(options)` — creates `organizations_list` with `is_demo: true`, org tier (e.g., `chain_professional`), then creates N child demo tenants via `DemoTenantService.createDemoTenant` with `organization_id` set
  - `listDemoOrganizations()` — lists orgs where `is_demo = true`
  - `expireDemoOrganization(orgId)` — cascades expiry to all child tenants
  - `deleteDemoOrganization(orgId)` — cascades deletion to all child tenants
  - `findExpiredDemoOrganizations()` — for the expiry job
- [ ] Demo org templates: `chain_grocery_3loc` (3 grocery stores in different neighborhoods), `chain_convenience_5loc` (5 convenience stores), `chain_specialty_2loc` (2 specialty retail stores)
- [ ] Update `demo-tenant-expiry.ts` job to also check `organizations_list` for expired demo orgs and cascade-close all child tenants
- [ ] Frontend: add "Demo Organizations" tab to admin demo page (alongside existing "Demo Tenants" tab)
  - Create demo org modal: select template, set business name, set location count, set expiry
  - List demo orgs with child tenant expansion
  - Per-org QR code batch generation (one QR per child location)
  - Per-org aggregate scan analytics
- [ ] API routes: `POST /api/admin/demo-organizations`, `GET /api/admin/demo-organizations`, `GET /api/admin/demo-organizations/:id`, `POST /api/admin/demo-organizations/:id/expire`, `DELETE /api/admin/demo-organizations/:id`
- [ ] Capability resolution: demo org uses org tier (e.g., `chain_professional`) — `resolveEffectiveCapabilities(heroTenantId)` resolves all 17 capability domains from the org tier via most-permissive-wins merge

### 5.4 Org-Level Capability Awareness

**Goal:** Document and enforce how org-level features are gated by the org's tier via the existing capability resolution architecture.

**Depends on:** Sprint 5.1 + 5.2 + 5.3

**Tasks:**
- [ ] Verify that org-level Google dashboard checks `resolveEffectiveCapabilities(heroTenantId).effective.integrations.enabled` — gated by org tier's `integration_options` feature keys
- [ ] Verify that org-level QR management checks `resolveEffectiveCapabilities(heroTenantId).effective.product_options.features.product_opt_qr_codes` — gated by org tier's `product_options` feature keys
- [ ] Verify that demo orgs resolve capabilities through the hero tenant using the org's tier (e.g., `chain_professional`), inheriting all 17 capability domains
- [ ] Confirm `organization_options` (OrgOptionsResolver) remains the separate org-specific capability layer for tabs/panels/propagation — no duplication of tenant-level capability domains
- [ ] Add frontend `useOrgCapabilities(heroTenantId)` hook that calls the existing `/api/tenants/:tenantId/effective-capabilities` endpoint with the hero tenant ID and caches the result for org-level UI gating

---

## Dependency Graph

```
Sprint 0 (Pre-Demo)
  0.1 Feature flag ──┐
  0.2 Unify OAuth ───┤── Demo ready (MVP)
  0.3 Auto sync job ─┤
  0.4 Product type ──┤
  0.5 Storefront ────┘
  0.6 GBP approval ──── (external, parallel)

Sprint 1 (Capability Alignment)
  1.1 Capability gating ─── depends on 0.2 (unified OAuth)
  1.2 Variant sync ──────── depends on 0.4 (product type filter)
  1.3 Consolidate services ── independent
  1.4 Category mapping ──── independent

Sprint 2 (Sync Quality)
  2.1 Pre-sync validation ── depends on 1.4 (category mapping)
  2.2 Retry queue ────────── depends on 0.3 (auto sync job)
  2.3 Auto-delete on trash ── independent
  2.4 GBP hours sync ────── depends on 0.2 (unified OAuth) + 0.6 (GBP approval)

Sprint 3 (Demo Infrastructure)
  3.1 Demo tenant tooling ── depends on Sprint 0 complete
  3.2 QR code generation ─── depends on 3.1

Sprint 4 (Frontend Polish)
  4.1 Unified dashboard ──── depends on 0.2 (unified OAuth) + 1.1 (capability gating)
  4.2 Sync health table ──── depends on 2.1 (validation) + 2.2 (retry queue)

Sprint 5 (Organizational Scaling)
  5.1 Org Google dashboard ──── depends on 4.1 + 4.2
  5.2 Org QR management ─────── depends on 3.2
  5.3 Demo organizations ────── depends on 3.1 + 3.2
  5.4 Org capability awareness ── depends on 5.1 + 5.2 + 5.3
```

---

## Success Metrics

| Metric | Current | Target after Sprint 0 | Target after Sprint 2 |
|---|---|---|---|
| Products with Google category | Unknown | — | >80% |
| Sync success rate | Unknown | >90% | >98% |
| Auto-sync coverage | 0% (manual only) | 100% (every 6h) | 100% + retry queue |
| Stale products on Google | Unknown | <5% | <1% |
| Demo tenant setup time | N/A | <30 min | <10 min |
| QR scan → signup conversion | N/A | Track | >15% |

---

## Notes

- **GBP API approval (#0.6) is an external dependency.** If it remains blocked, pivot the demo pitch to lead with GMC (Google Shopping) and use GBP as a "coming soon" feature.
- **Sprint 0 is the minimum viable Google wedge.** Sprints 1-2 make it production-quality. Sprint 3 enables the demo tenant strategy. Sprint 4 is polish.
- **The mock token bypass in `GMCProductSyncSingletonService.ts` (`tid-m8ijkrnk`) must be removed or properly gated** — it's a security risk in production.
- **GBP token encryption (#0.2) is a security fix, not just alignment.** Plain text OAuth tokens on the `tenants` table is a vulnerability.
- **Sprint 5 extends features to organizations.** The existing `EffectiveCapabilityResolver` already resolves org-tier capabilities through the hero tenant (most-permissive-wins merge). No new capability keys are needed — org tiers receive the same capability type assignments as individual tenant tiers. The `organization_options` capability (OrgOptionsResolver) remains the separate org-specific layer for tabs/panels/propagation. Demo organizations require additive columns on `organizations_list` (`is_demo`, `demo_expires_at`, `demo_template`) and a `DemoOrganizationService` that mirrors `DemoTenantService`.
