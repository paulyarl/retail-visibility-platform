# Service Product Type — Phased Implementation Plan

> **Status: All phases (1–7) complete.** Zero TS errors on both `checkapi` and `checkweb`.
>
> - Phase 1: Wizard data model & ServiceDetailsStep ✅
> - Phase 2: Pricing & Organization adaptation ✅
> - Phase 3: Backend API & metadata handling ✅
> - Phase 4: Items list, grid & edit modal ✅
> - Phase 5: Public product page integration ✅
> - Phase 6: Quickstart, onboarding & settings polish ✅
> - Phase 7: Testing & verification ✅

## Current State

- `service` exists in the `product_type` DB enum and is referenced throughout type definitions
- Capability gating (tier + merchant prefs) fully supports `service` via `product_types_service` feature keys
- **Public display surfaces** already handle `service`: `ServiceBookingCTA`, `ServiceDurationInfo`, `ServiceAreaInfo`, `ProductTypeSection` service case, `ProductPurchasePanel` service icon
- **Creation wizard** has a `service` radio button in `ProductTypeStep` but selecting it provides no service-specific configuration — the wizard falls through to physical/digital logic
- **No service-specific wizard step** exists for capturing booking URL, duration, service area, availability schedule, etc.
- Service products get unlimited stock (9999) like digital, but there is no service-specific metadata capture in the wizard

## Gap Analysis

| Area | Status | What's Missing |
|------|--------|----------------|
| DB enum | ✅ Done | — |
| Capability gating | ✅ Done | — |
| Public product display | ✅ Done | Components read from `metadata` but wizard never writes service metadata |
| Product creation wizard | ❌ Gap | No `ServiceDetailsStep` or service-specific fields in `ProductTypeStep` |
| Wizard data model | ❌ Gap | `WizardData.productType` has no `serviceProduct` config block (parallel to `digitalProduct`) |
| Item creation API | ⚠️ Partial | API accepts any valid `product_type` enum value, but no service-specific validation or metadata handling |
| Items list/grid | ⚠️ Partial | Service items appear but with physical-type badges/behavior |
| Pricing step | ❌ Gap | No service pricing model (per-session, per-hour, deposit-based) |
| Organization step | ⚠️ Partial | Inventory settings (trackInventory, lowStockThreshold) are irrelevant for services |
| Review step | ❌ Gap | No service-specific review summary |

---

## Phase 1 — Wizard Data Model & Service Step (MVP Creation Flow)

**Goal**: Add a `ServiceDetailsStep` to the creation wizard that captures service-specific metadata.

**Tasks**:
1. Add `serviceProduct` config block to `WizardData.productType` in `ItemCreationWizard.tsx`:
   ```ts
   serviceProduct?: {
     bookingMethod: 'external_url' | 'phone' | 'in_store' | 'contact_only';
     bookingUrl?: string;
     bookingPhone?: string;
     durationMinutes?: number | null;
     sessionLength?: string;
     availabilitySchedule?: string;
     serviceLocation: 'on_site' | 'remote' | 'customer_location';
     serviceArea?: string;
     travelRadius?: number | null;
     pricingModel: 'per_session' | 'per_hour' | 'fixed' | 'deposit';
     depositAmount?: number | null;
     requiresDeposit: boolean;
   };
   ```
2. Create `ServiceDetailsStep.tsx` in `wizards/steps/` — conditionally rendered when `productType.type === 'service'` (replaces or augments `ProductTypeStep` service path).
3. Update `ProductTypeStep.tsx` to use `useProductTypeCapability` (instead of `useProductOptionsCapability`) for `allowedTypes` and `effectiveTypes`.
4. Update `ItemCreationWizard.tsx` step flow — insert service details as a sub-step or conditional section within Step 2 when type is `service`.
5. Update `handleSubmit` in `ItemCreationWizard.tsx` to include service metadata in `productData` when type is `service`.
6. Update `INITIAL_DATA` and `loadExistingProduct` to handle service fields.

**Deliverables**:
- New `ServiceDetailsStep.tsx` component
- Updated `ItemCreationWizard.tsx` with service data model
- Updated `ProductTypeStep.tsx` using `useProductTypeCapability`

**Risk**: Low; additive changes only, no breaking changes to existing flows.

---

## Phase 2 — Pricing & Organization Adaptation

**Goal**: Adapt pricing and organization steps for service-type products.

**Tasks**:
1. Update `PricingStep.tsx`:
   - Show service pricing model selector (per-session, per-hour, fixed, deposit) when type is `service`.
   - Hide variant pricing section for services (services don't have variants).
   - Show deposit field when `pricingModel === 'deposit'`.
2. Update `OrganizationStep.tsx`:
   - Hide inventory tracking settings (`trackInventory`, `lowStockThreshold`, `reorderPoint`, `maxStockLevel`) for services.
   - Hide `allowBackorder` for services.
   - Keep category, SEO, and channel settings.
3. Update `ReviewStep.tsx`:
   - Show service-specific summary (booking method, duration, location, pricing model) when type is `service`.
   - Hide stock/variant summary for services.

**Deliverables**:
- Updated `PricingStep.tsx`, `OrganizationStep.tsx`, `ReviewStep.tsx`

**Risk**: Low; conditional rendering based on product type.

---

## Phase 3 — Backend API & Metadata Handling

**Goal**: Ensure backend properly handles service-specific metadata on item creation/update.

**Tasks**:
1. Update item creation/update API routes to validate service metadata fields:
   - `bookingMethod`, `bookingUrl`, `bookingPhone`, `durationMinutes`, `sessionLength`, `availabilitySchedule`, `serviceLocation`, `serviceArea`, `travelRadius`, `pricingModel`, `depositAmount`, `requiresDeposit`
2. Store service metadata in `metadata` JSON column (no schema changes needed — metadata is flexible).
3. Add server-side validation: if `product_type === 'service'`, require at least `bookingMethod` and `pricingModel`.
4. Update `ProductOptionsResolver` / `ProductTypeResolver` to ensure service type gating is enforced on item creation (reject `service` type if tier doesn't allow it).
5. Update item update/edit endpoints to handle service metadata updates.

**Deliverables**:
- Updated API validation logic
- Service metadata schema documentation

**Risk**: Medium; must not break existing item creation for other types.

---

## Phase 4 — Items List, Grid & Edit Modal

**Goal**: Update inventory surfaces to properly display and edit service products.

**Tasks**:
1. Update `ItemsGrid.tsx` / item card components:
   - Show service-specific badge/icon (Wrench or Calendar icon).
   - Show "Service" label instead of stock count.
   - Hide "Out of Stock" / "Low Stock" indicators for services.
2. Update `ItemsPageClient.tsx`:
   - Use `useProductTypeCapability` for type-enabled check (instead of `useProductOptionsCapability.enabled`).
   - Show "Create Service" button when service type is allowed.
3. Update item edit modal (if separate from wizard):
   - Show service-specific fields when editing a service product.
   - Hide irrelevant fields (stock, variants, shipping).

**Deliverables**:
- Updated items grid, card, and edit components

**Risk**: Low; conditional rendering based on `product_type`.

---

## Phase 5 — Public Product Page Integration

**Goal**: Ensure public product pages correctly render service products with wizard-captured metadata.

**Tasks**:
1. Verify `ProductTypeSection.tsx` service case renders correctly with wizard-captured metadata (it already reads from `product.metadata`).
2. Verify `ServiceBookingCTA`, `ServiceDurationInfo`, `ServiceAreaInfo` components render with metadata fields from the wizard.
3. Update `ProductPurchasePanel.tsx`:
   - Show "Book Now" / "Call to Book" CTA instead of "Add to Cart" for service products.
   - Hide cart-related actions (quantity selector, add to cart button) for services.
   - Show deposit info if `pricingModel === 'deposit'`.
4. Update SEO/structured data for service products (schema.org Service type).
5. Update product page layouts (`ProductShowcaseLayout`, `ProductQuickCommerceLayout`) to handle service products.

**Deliverables**:
- Verified/updated public product page components
- Service-specific purchase panel behavior

**Risk**: Medium; public-facing pages must not break for existing product types.

---

## Phase 6 — Quickstart, Onboarding & Settings Polish

**Goal**: Update onboarding flows and settings pages for service product support.

**Tasks**:
1. Update quickstart/onboarding flows to mention service products when the tier allows them.
2. Update `ProductTypeSettingsClient.tsx` (new product-types settings page) to show service type option with description.
3. Update `PlanSummaryPanel.tsx` to show service in the product types capability summary.
4. Add service-specific help text / tooltips in the wizard.
5. Update `StorefrontSection.tsx` service section to render service products from the catalog with wizard-captured metadata.

**Deliverables**:
- Updated onboarding, settings, and storefront section components

**Risk**: Low; additive UI changes.

---

## Phase 7 — Testing & Verification

**Goal**: Comprehensive test coverage for service product type.

**Tasks**:
1. Unit tests for `resolveProductTypeState` with service feature gates.
2. Integration test: create a service product via the wizard, verify metadata is stored.
3. Integration test: public product page renders service product correctly.
4. E2E test: full flow from creation → publish → public view for a service product.
5. Verify capability gating: service type not available when tier doesn't include it.
6. Run `checkapi` and `checkweb` for zero TS errors.

**Deliverables**:
- Test suite for service product type
- Zero TS errors

**Risk**: Low.

---

## Implementation Priority

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 1 | P0 | Medium | None |
| Phase 2 | P0 | Small | Phase 1 |
| Phase 3 | P0 | Medium | Phase 1 |
| Phase 4 | P1 | Small | Phase 1 |
| Phase 5 | P1 | Medium | Phases 1, 3 |
| Phase 6 | P2 | Small | Phase 1 |
| Phase 7 | P0 | Medium | All phases |

**Recommended starting point**: Phase 1 (wizard data model & service step) — this unblocks all other phases.
