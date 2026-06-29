# Organization Dashboard — Product Type Awareness Audit

**Date:** 2026-06-28  
**Scope:** Audit of organization-level product handling for product type awareness (physical, digital, hybrid, service)  
**Verdict:** The organization dashboard has **zero product type awareness**. All product-related surfaces treat SKUs as a flat count with no type distinction. Retrofit is recommended.

---

## 1. Current State

### 1.1 Organization Dashboard Structure

The org dashboard (`OrganizationDashboard.tsx`) has 7 tabs:

| Tab | Product Handling | Product Type Awareness |
|---|---|---|
| Overview | KPI grid shows "Total Products" (flat SKU count) | None |
| Locations | Per-location SKU counts with utilization bars | None |
| Propagation | Hero→all product sync, category sync, GBP sync | None — copies `product_type` field blindly |
| Capabilities | Capability rollup across 14 domains | **`product_types` domain is missing** from rollup |
| Team | Team overview, employee distribution | N/A |
| Commerce | Payment settings (deposit, full payment, auto-confirm) | None — no type-specific commerce settings |
| Billing | Usage gauges (locations, SKUs) | None — flat SKU count only |

### 1.2 Backend Product Type System (Tenant-Level)

A fully functional `ProductTypeService` exists at `apps/api/src/services/ProductTypeService.ts`:

- Resolves product type state per tenant from tier capabilities (org tier + tenant tier, most-permissive-wins)
- Supports 4 types: `physical`, `digital`, `hybrid`, `service`
- Tier-gated: tiers control which types are allowed via `product_types_*` feature keys
- Per-tenant settings stored in `tenant_product_types_settings` table
- CCL constraint validation on write (cross-capability constraints)
- Route: `GET/PUT /api/tenants/:tenantId/product-type`

**This service already considers org tier** (line 75: `tenant.organizations_list?.subscription_tier`) but is never called from any org-level API or surfaced on the org dashboard.

### 1.3 Organization Capability Rollup — Missing Domain

`apps/api/src/routes/organization-capabilities.ts` defines `CAPABILITY_DOMAINS`:

```typescript
const CAPABILITY_DOMAINS = [
  'commerce', 'payment_gateway', 'storefront', 'fulfillment', 'product_options',
  'featured', 'integrations', 'quickstart', 'storefront_options',
  'directory_entry', 'faq', 'crm', 'chatbot', 'barcode_scan',
] as const;
```

**`product_types` is absent.** The rollup tracks `product_options` (display/behavior features) but not `product_types` (entity gating — which product types a tenant can sell). This means the org dashboard's Capability Rollup card cannot show whether locations are aligned on product types.

### 1.4 Product Propagation — Type-Blind

The propagation endpoints in `organizations.ts` copy the `product_type` field as-is during hero→location sync (lines 883, 1109, 1558, 1772). However:

- The UI (`OrgPropagationPanel.tsx`) offers no product-type filtering — it's all-or-nothing
- No "propagate only digital products" or "propagate only physical products" option
- No visibility into which product types exist at the hero location before syncing
- No validation that target locations' tiers support the product types being propagated

### 1.5 Organization Commerce Settings — Type-Agnostic

`organization-commerce-settings.ts` handles:
- Deposit payments (percentage, min, max)
- Full payment
- Auto-confirm orders
- Payment on pickup

**Missing type-specific commerce concerns:**
- Digital products: no shipping, instant delivery, download limits
- Service products: booking/appointment flow, no shipping
- Hybrid products: partial fulfillment (physical + digital)
- Physical products: shipping rates, pickup options

### 1.6 Admin Organizations Page

`/settings/admin/organizations` shows org cards with:
- Total locations / max locations
- Total SKUs / max SKUs
- Utilization percentage
- Per-tenant SKU counts

**No product type breakdown anywhere.** An admin cannot see which orgs sell digital vs physical vs service products.

---

## 2. Gap Analysis

### 2.1 Visibility Gaps

| Gap | Impact |
|---|---|
| No product type KPIs on org dashboard | Org admin can't see product mix (e.g., "60% physical, 30% digital, 10% service") |
| No per-location product type breakdown | Can't identify locations with mismatched product types |
| No product type in capability rollup | Can't see which locations have `product_types` enabled or which types they're allowed to sell |
| No product type in admin org list | Platform admins can't audit product type distribution across orgs |

### 2.2 Operational Gaps

| Gap | Impact |
|---|---|
| Propagation is type-blind | Can't selectively propagate by product type |
| No tier-validation on propagation target | Propagating digital products to a tenant whose tier only allows physical will create items that can't be properly displayed |
| Commerce settings ignore product types | Digital products don't need shipping settings; services need booking — org-wide settings don't account for this |
| No product-type-aware recommendations | Dashboard can't suggest "Enable digital products" or "Your hero location has digital products but 3 locations don't support that type" |

### 2.3 Data Flow Gaps

| Gap | Impact |
|---|---|
| `ProductTypeService.resolveProductTypeState()` is tenant-only | No org-level aggregation endpoint exists |
| `CAPABILITY_DOMAINS` array missing `product_types` | Capability rollup API doesn't collect product type status |
| No org-level product type settings table | No mechanism for org-wide product type defaults (only per-tenant) |

---

## 3. Recommendations

**Yes, the organization dashboard should be retrofitted with product type awareness.** The platform already has a robust product type system at the tenant level — the org layer simply doesn't surface or use it.

### Priority Justification

1. **Data integrity risk**: Type-blind propagation can create products on tenants whose tiers don't support that product type, causing display/checkout issues
2. **Operational visibility**: Org admins managing multi-location chains need to see product mix to make informed decisions
3. **Capability alignment**: The capability rollup is incomplete without `product_types` — it's the only split capability domain missing from the rollup
4. **Commerce settings gap**: Type-agnostic commerce settings are a UX issue for chains selling mixed product types

---

## 4. Phased Implementation Plan

### Phase 1: Backend — Org Product Type Aggregation API (P0)

**Goal:** Expose product type data at the org level.

**Tasks:**
1. Add `product_types` to `CAPABILITY_DOMAINS` array in `organization-capabilities.ts` with label "Product Types"
2. Extend the capability rollup endpoint to resolve `product_types` domain status per tenant (calls `ProductTypeService.resolveProductTypeState()` for each location)
3. New endpoint: `GET /api/organizations/:orgId/product-type-rollup` — returns per-location product type state (enabled, type, allowedTypes, isFlexible)
4. New endpoint: `GET /api/organizations/:orgId/product-mix` — aggregates SKU counts by `product_type` across all locations using `prisma.tenant_items.groupBy`
5. Add product-type validation to propagation endpoints: before syncing items, check that target tenant's `ProductTypeState.allowedTypes` includes the item's `product_type`; skip with a warning if not

**Files to modify:**
- `apps/api/src/routes/organization-capabilities.ts` (CAPABILITY_DOMAINS + rollup)
- `apps/api/src/routes/organizations.ts` (propagation validation)
- New: `apps/api/src/services/OrgProductTypeService.ts` (aggregation logic)

**Verification:** API calls return product type data per location; propagation skips mismatched types with warning count.

---

### Phase 2: Frontend — Product Type Visibility on Dashboard (P1)

**Goal:** Surface product type data on the org dashboard.

**Tasks:**
1. New component `OrgProductMixCard.tsx` — shows product type distribution (physical/digital/hybrid/service) as a stacked bar or donut chart with counts and percentages across all locations
2. Add to Overview tab alongside KPI grid
3. Extend `OrgLocationTable.tsx` — add product type badges per location (e.g., "📦 120 physical · 💾 30 digital · 🔧 5 service")
4. Extend `OrgKpiGrid.tsx` — replace flat "Total Products" with type-aware breakdown or add a 5th KPI card for product mix
5. New component `OrgProductTypeRollup.tsx` — table showing each location's product type capability state (enabled, allowed types, selected types) with alignment indicators
6. Add to Capabilities tab below existing `OrgCapabilityRollup`

**Files to modify/create:**
- New: `apps/web/src/components/organization/OrgProductMixCard.tsx`
- New: `apps/web/src/components/organization/OrgProductTypeRollup.tsx`
- Modified: `apps/web/src/components/organization/OrgKpiGrid.tsx`
- Modified: `apps/web/src/components/organization/OrgLocationTable.tsx`
- Modified: `apps/web/src/components/organization/OrganizationDashboard.tsx` (wire new components)
- New: `apps/web/src/hooks/organization/useOrgProductTypeRollup.ts`
- Modified: `apps/web/src/services/OrgCapabilityService.ts` (add product type rollup types)

**Verification:** Dashboard shows product mix; location table shows per-location type badges; capabilities tab shows product type alignment.

---

### Phase 3: Propagation — Type-Aware Sync (P1)

**Goal:** Make product propagation product-type-aware.

**Tasks:**
1. Extend `OrgPropagationPanel.tsx` — add product type filter checkboxes (All, Physical, Digital, Hybrid, Service) before the "Sync from Hero" button
2. Pass selected types as filter params to the sync API
3. Backend: modify propagation endpoints in `organizations.ts` to accept optional `product_types` filter param; only sync items matching the filter
4. Show pre-sync validation summary: "Hero has 120 physical, 30 digital, 5 service. 2 locations don't support digital — those items will be skipped."
5. Post-sync result: include skipped-by-type count with reason

**Files to modify:**
- `apps/api/src/routes/organizations.ts` (filter param + validation)
- `apps/web/src/components/organization/OrgPropagationPanel.tsx` (type filter UI)
- `apps/web/src/components/organization/OrganizationDashboard.tsx` (pass filter state)

**Verification:** Propagating with "digital only" filter only syncs digital items; mismatched locations show skip count.

---

### Phase 4: Commerce — Type-Specific Settings (P2)

**Goal:** Add product-type-aware commerce settings at the org level.

**Tasks:**
1. Extend `OrganizationCommerceSettings` interface with type-specific sections:
   - Physical: shipping defaults, pickup options
   - Digital: delivery method (download link, email), access duration
   - Service: booking lead time, cancellation policy
   - Hybrid: fulfillment split (physical ships, digital downloads)
2. Backend: extend `organization-commerce-settings.ts` PUT schema with optional type-specific fields
3. Frontend: extend commerce settings page with collapsible type-specific sections (only visible if org has that product type)
4. Add "Product Type Requirements" info card on commerce settings page showing which types are active across locations

**Files to modify:**
- `apps/api/src/routes/organization-commerce-settings.ts`
- `apps/web/src/app/(platform)/settings/organization/commerce/page.tsx`
- `apps/web/src/services/OrganizationsSingletonService.ts`

**Verification:** Commerce settings page shows type-specific sections when applicable; settings persist and are respected at checkout.

---

### Phase 5: Admin — Org Product Type Audit View (P2)

**Goal:** Give platform admins product type visibility across all orgs.

**Tasks:**
1. Extend admin organizations page (`/settings/admin/organizations`) — add product type badges to each org card (e.g., "📦 Physical · 💾 Digital")
2. New admin endpoint: `GET /api/admin/organizations/product-type-summary` — aggregates product type distribution across all orgs
3. Optional: product type filter on admin org list (filter orgs by "has digital", "service-only", etc.)

**Files to modify:**
- `apps/web/src/app/(platform)/settings/admin/organizations/page.tsx`
- `apps/api/src/routes/organizations.ts` or new admin route
- `apps/web/src/lib/singletons/TenantOrganizationsSingleton.ts`

**Verification:** Admin can see and filter by product types at the org level.

---

### Phase 6: Recommendations — Type-Aware Suggestions (P3)

**Goal:** Add product-type-aware recommendations to the org dashboard.

**Tasks:**
1. Extend `OrgRecommendationsCard.tsx` with type-aware recommendations:
   - "Your hero location has digital products but 2 locations don't support digital — update their product type settings"
   - "You have service products but no booking flow configured — set up service commerce settings"
   - "3 locations have physical products but no shipping rates configured"
2. Backend: add recommendation logic to org dashboard data endpoint or compute client-side from rollup data

**Files to modify:**
- `apps/web/src/components/organization/OrgRecommendationsCard.tsx`

**Verification:** Recommendations reference actual product type state across locations.

---

## 5. Dependency Map

```
Phase 1 (Backend API) ──┬──→ Phase 2 (Dashboard Visibility)
                        ├──→ Phase 3 (Propagation)
                        └──→ Phase 5 (Admin View)
                              
Phase 2 ─────────────────→ Phase 4 (Commerce Settings)
Phase 2 ─────────────────→ Phase 6 (Recommendations)
```

Phase 1 is the prerequisite for all other phases. Phases 2, 3, and 5 can proceed in parallel after Phase 1. Phases 4 and 6 depend on Phase 2's UI components being in place.

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Propagation validation skips items silently | Medium | Return detailed skip report with reasons; show in UI |
| Product type aggregation query is slow for large orgs | Low | Use `groupBy` with indexed `product_type` column; cache 5 min |
| Org-level commerce settings conflict with tenant-level | Medium | Document precedence: tenant settings override org defaults |
| `CAPABILITY_DOMAINS` change breaks existing rollup cache | Low | Add domain to end of array; old cached responses expire in 5 min |

---

## 7. Estimated Effort

| Phase | Effort | Priority |
|---|---|---|
| Phase 1: Backend API | 1-2 days | P0 |
| Phase 2: Dashboard Visibility | 2-3 days | P1 |
| Phase 3: Propagation | 1-2 days | P1 |
| Phase 4: Commerce Settings | 2-3 days | P2 |
| Phase 5: Admin View | 1 day | P2 |
| Phase 6: Recommendations | 0.5 day | P3 |
| **Total** | **7.5-11.5 days** | |
