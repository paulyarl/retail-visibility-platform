# Sprint Plan: Marketing Ops — Universal Recalibration (Service + Product Businesses)

**Document Version:** 1.2
**Date:** 2026-08-06
**Status:** Draft — Ready for Review

**Revision 1.2 (2026-08-06):** PB-07 retainer_fee_cents lowered from 250,000 ($2,500/mo) to 39,900 ($399/mo) to align with existing migration 158 retainer fee pattern ($199–$399). `DeliverableType` union + `deliverable_type` route zod enum additions for `'product_visibility_preview'` pulled forward from Sprint 2 (§5.5) to Sprint 1 (§5.4) to eliminate the Sprint 1→2 runtime type gap — migration 171 seeds `preview_deliverable_type = 'product_visibility_preview'` and the value must be valid in the TS union + zod enum at runtime. Deliverable section builders remain in Sprint 2.

**Revision 1.1 (2026-08-06):** Corrected against codebase verification — migration numbers renumbered (165/166 already taken → 170/171/172); playbook catalog names/archetypes/ranks corrected to match production seed (`158_mkt_signal_registry.sql`); PB-07 priority rank fixed (3 → 5, with PB-06/PB-03 renumbering); PB-02 `none` set extended so product-visibility signals route to PB-07 instead of PB-02 (cascade co-occurrence fix); route zod enums, opener-service whitelist, and `DeliverableType` unions added to scope; `generateAllSections`, pitch pipeline, and follow-up template descriptions corrected to match actual code; business-type classifier scoped as new work (does not exist today); `DS_OUTDATED_HOLIDAY_HOURS` redesigned around obtainable data; test inventory corrected.

**Prerequisite:** Marketing Ops Sprint 1–6 complete (campaign pipeline, prompt workspace, deliverables, branding, outreach openers, playbook catalog + triage engine); `business_analysis` audit schema landed; signal taxonomy + registry operational; archetype selection + opener prompts (A1–A5) in production.

**Companion docs:**
- `docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md` (A1–A4 archetype system)
- `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md` (PB-01..PB-06, signal taxonomy)
- `docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md` (deliverable sections)
- `docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md` (pitch pipeline)

---

## 1. Executive Summary

The Marketing Ops module was built around **service businesses** (HVAC, plumbing, dental — where the primary pain is unanswered reviews, missing booking flows, and project-photo deficits). The signal taxonomy, audit schema, archetype selection, opener prompts, deliverable section types, and playbook catalog all encode service-business assumptions in their labels, thresholds, and preview artifacts.

A category audit of **Indianapolis African grocery stores** surfaced a product/inventory business niche with strong signals that the current system either mislabels or routes to the wrong archetype. A grocery store with strong community loyalty and fine reviews but no mobile catalog, no product-availability inquiry path, and no storefront photography will either fall through to A1 fallback ("review gap" — irrelevant) or A4 ("missing online booking" — wrong language for a store that doesn't take bookings).

This sprint **recalibrates the platform from service-centric to universal** (service + product/inventory businesses) across five layers:

1. **Signal taxonomy** — add product/inventory signal codes alongside existing service codes
2. **Audit schema** — extend `business_analysis` to capture product-catalog, availability-inquiry, fulfillment, and photo-type fields
3. **Archetype system** — add A6 (Product Visibility Gap) + make the persona preamble archetype-specific instead of universally review-centric
4. **Deliverable sections** — add product-visibility section types (mobile catalog preview, GBP photo optimization, availability-inquiry flow, fulfillment pathway)
5. **Playbook catalog** — add PB-07 (Product Visibility & Catalog Refresh) + update existing playbooks' `matching_rules` to be business-type-aware

The recalibration is **additive, not breaking**. Existing service-business campaigns continue to route through A1–A5 and PB-01–PB-06 unchanged. New product-business campaigns route through A6 and PB-07. The system becomes universal by gaining a second leg, not by rewriting the first.

**Sprint Duration:** 2 sprints (4 weeks)
**Team Size:** 1 full-stack developer + 1 AI/prompt engineer (part-time for prompt recalibration)

---

## 2. Problem Statement — Where the Service Bias Lives

### 2.1 Signal Taxonomy (24 codes, 5 families)

File: `apps/api/src/services/triage/signal-taxonomy.ts`

The 24 canonical signal codes encode service-business concepts:

| Code | Service bias | Product-business reality |
|------|-------------|--------------------------|
| `DS_MISSING_SERVICE_MENU` | "Service menu" = HVAC service tiers | Grocery stores have a **product catalog**, not a service menu |
| `WC_MISSING_SERVICE_PAGES` | "Service pages" = plumbing services list | Grocery stores need **product category browsing** |
| `VP_MISSING_PROJECT_PHOTOS` | "Project photos" = before/after HVAC photos | Grocery stores need **storefront + product photos** |
| `WC_MISSING_CTA` | Exists but A4's prompt hardcodes it to "online booking / scheduling" | Grocery stores need **availability inquiry + pickup/delivery CTAs**, not booking |

**Missing entirely:**
- No signal for "no product catalog / no way to browse products online"
- No signal for "no availability inquiry path" (WhatsApp/SMS/call-to-check-stock)
- No signal for "no pickup or delivery pathway"
- No signal for "outdated holiday hours" (critical for ethnic markets with non-standard holiday schedules)
- No signal for "missing storefront/exterior photos" (distinct from "project photos")

### 2.2 Audit Schema

File: `apps/api/src/validators/business-analysis.schema.ts`

The `websiteSchema` is service-flavored (`service_information_present`, CTA fields) but has no:
- `has_product_browsing`
- `has_availability_inquiry`
- `has_pickup_ordering`
- `has_delivery_option`

(Note: `has_booking` is consumed by `selectArchetype` via the schema's `.passthrough()` — it is not a declared schema field. The new fields below are declared explicitly so they're validated and documented.)

The `googlePlatformSchema` has `primary_category` and `additional_categories` but no declared `photo_count` or `photo_types`. `photo_count` is already consumed by the signal extractor (`platforms.google.photo_count`, via passthrough) for `DS_PHOTO_DEFICIT`, but it's undeclared/unvalidated, and `photo_types` doesn't exist at all — so the system can't distinguish "5 exterior shots, 0 product photos" from "5 product photos, 0 exterior shots."

### 2.3 Archetype Selection + Prompts

Files:
- `apps/api/src/services/outreach-openers/archetype-selection.ts`
- `apps/api/src/services/outreach-openers/archetype-prompts.ts`
- `apps/api/src/services/outreach-openers/field-extractors.ts`

**Selection priority:** `A2 > A1 > A3 > A4` (fallback to A1). A grocery store with fine reviews but no catalog falls through to A1 fallback with the reason "fallback: 0 unanswered reviews" — producing an opener about review silence when the actual pain is product discoverability.

**Persona preamble** (shared across A1–A5, lines 101–111 of `archetype-prompts.ts`):
> "You are a local-business visibility auditor. You pulled this business's public review footprint across Google, Yelp, and Facebook, and found that customer reviews are going unanswered..."

This preamble is **baked into every archetype prompt**. For a grocery store with strong reviews and community loyalty, leading with "reviews are going unanswered" is factually wrong and immediately breaks trust.

**A4 prompt** (lines 260–285) hardcodes the hook to "online booking / scheduling / booking flow" and the previews to "CTA audit, proposed placements, booking flow." A grocery store doesn't take bookings.

### 2.4 Deliverable Sections

Files:
- `apps/api/src/services/deliverable/DeliverableSectionService.ts`
- `apps/api/src/services/deliverable/prompts.ts`

`SectionType` is currently `'recovery_playbook' | 'listing_corrections' | 'cta_fixes'` — all service-business artifacts. There are no section types for:
- Mobile catalog / product-category website preview
- GBP photo optimization plan (storefront + product photos)
- Availability-inquiry flow design (WhatsApp/SMS/call-to-check-stock)
- Pickup/delivery pathway setup
- Hours + holiday-hours synchronization plan

### 2.5 Playbook Catalog

File: `apps/api/src/services/triage/types.ts` (PLAYBOOK_CODES, ARCHETYPE_LABELS)

The 6 playbooks (PB-01..PB-06, as seeded in `database/migrations/158_mkt_signal_registry.sql`) all target service-business pain:

| Code | Production name | Archetype | `priority_rank` | Targets |
|------|----------------|-----------|-----------------|---------|
| PB-01 | Profile Repair & Listing Drift | A3 | 3 | NAP/listing drift |
| PB-02 | Review Gap & Stagnation | A1 | 4 | Review drought / low volume / positive backlog |
| PB-03 | Conversion & Surface Friction | A4 | 6 | CTA friction (fallback) |
| PB-04 | Admin Neglect (BBB Recovery) | A2 | 1 | BBB crisis + unanswered negative backlog |
| PB-05 | Multi-Signal Footprint Triage | A5 | 2 | Dual repair+review signals |
| PB-06 | Visual & Asset Refresh | A3 | 5 | Project photos / stale social / photo deficit |

There is no playbook for "product visibility gap" — the most common pain for grocery stores, bakeries, convenience stores, specialty food markets, and other inventory-driven local businesses.

**Cascade co-occurrence problem (verified against the seeded `matching_rules`):** for the exact niche this sprint targets, PB-07 as originally drafted would rarely win. `RA_LOW_REVIEW_VOLUME` (<15 reviews) and `RA_REVIEW_DROUGHT` (>180 days) fire for most small ethnic grocery stores → **PB-02 (rank 4) outranks PB-07** and routes to A1 "review gap" — the misrouting this sprint exists to fix. Likewise any NAP drift + any review signal → PB-05 dual (rank 2), and the raised product photo threshold feeds PB-06. The fix (§5.4): extend PB-02's `none` set with the product-visibility codes, so a business with a product-catalog gap routes to PB-07 even when weak review-volume signals co-fire. Genuine review crises still win through PB-04 (rank 1, whose `any` includes `RA_UNADDRESSED_NEGATIVE_BACKLOG`).

---

## 3. Design Principles

1. **Additive by default, with three flagged behavior changes.** Existing service-business campaigns continue to route through A1–A5 and PB-01–PB-06. New codes, fields, archetypes, and playbooks are added alongside, not replacing. Three intentional exceptions, each called out in its workstream and covered by the testing strategy:
   - **Persona preamble refactor** (§5.3) — rewrites A3/A4/A5 prompt preambles (A1/A2 unchanged).
   - **PB-02 `none` set extension** (§5.4) — product-visibility signals suppress PB-02 so PB-07 can win the cascade. Affects only businesses with product-catalog gaps; pure service-business audits emit no product codes and are unaffected.
   - **Deliverable section additions for A3/A4/A5 on product/hybrid businesses** (§5.5) — conditional on resolved business type; service businesses see zero change.

2. **Business-type-aware, not business-type-gated.** The system should detect business type from audit data (category, signals) and route accordingly — not require the operator to manually tag a campaign as "service" or "product." The signal codes and archetype selection do this naturally once the codes exist.

3. **Persona preamble becomes archetype-specific.** The shared `PERSONA_PREAMBLE` that leads with "reviews are going unanswered" must be split so each archetype has a preamble that matches its actual reason for existing. A6's preamble leads with product discoverability; A1's keeps the review framing.

4. **Registry rows for metadata; extractor code for detection.** The `mkt_signal_registry` table is the runtime source of truth for labels, families, and active status — new codes are seeded via migration. But detection logic is **hand-written code in `signal-extractor.ts`** (a pure function with hardcoded derivation); the registry's `derived_rule` JSON is documentation/default-threshold reference only and is never evaluated by an ops engine. All 7 new codes require both a registry row AND explicit extractor logic. (Verified: the extractor *unions* model-emitted `detected_signals[]` with derived codes, so new derived codes fire even on new-contract audits.)

5. **Preview references match the archetype — and stay honest about what exists.** Openers say "Three previews attached" as text only; no artifacts are generated at opener time (verified — this is true for A1–A5 today and enforced by the quality gate's regex, not by artifact generation). A6's line references "mobile catalog preview, GBP photo optimization, availability-inquiry flow" — not "recovery playbook" or "booking flow" — so the promised previews match the sections the A6 deliverable actually builds. Reconciling the opener's 3 named previews against the 5 A6 deliverable sections: the opener names the three highest-value previews; the remaining two (fulfillment pathway, hours sync) are part of the paid deliverable. Generating real artifacts at opener time is out of scope (§11) but noted as a pre-existing trust gap across all archetypes.

6. **Thresholds are business-type-sensitive where it matters.** `DS_PHOTO_DEFICIT` threshold of `<5 photos` is reasonable for service businesses but grocery stores should have significantly more product + storefront photos. The threshold becomes a function of business type, not a flat constant.

---

## 4. Proposed Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Raw Audit Ingestion (business_analysis audit_data)      │
│  NEW FIELDS: has_product_browsing, has_availability_     │
│  inquiry, has_pickup_ordering, has_delivery_option,      │
│  photo_count, photo_types[]                              │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  SignalExtractor                                         │
│  NEW CODES: DS_MISSING_PRODUCT_CATALOG,                  │
│  WC_MISSING_PRODUCT_BROWSING, WC_MISSING_AVAILABILITY_   │
│  INQUIRY, WC_MISSING_PICKUP_DELIVERY,                    │
│  VP_MISSING_STOREFRONT_PHOTOS, VP_MISSING_PRODUCT_PHOTOS,│
│  DS_OUTDATED_HOLIDAY_HOURS                               │
│  EXISTING CODES: unchanged (24 → 31 known codes)         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  TriageEngineService (generic set-membership evaluator)  │
│  NEW PLAYBOOK: PB-07 (Product Visibility & Catalog       │
│  Refresh) — priority_rank 5; PB-06/PB-03 renumbered      │
│  to 6/7 to make room                                     │
│  CHANGED: PB-02 none set += product-visibility codes     │
│  (so PB-07 wins the cascade for product businesses)      │
│  EXISTING PB-01/PB-03/PB-04/PB-05/PB-06 rules: unchanged │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Archetype Selection                                     │
│  NEW: A6 (Product Visibility Gap) — selectArchetype      │
│  receives audit_data ONLY (no detected_signals), so A6   │
│  derives from audit fields: business_type product/       │
│  hybrid AND has_product_browsing === false (or no        │
│  website for a product/hybrid business)                  │
│  PRIORITY: A2 > A1 > A6 > A3 > A4 (A6 above A3/A4        │
│  because product invisibility is more urgent than        │
│  listing drift or CTA gap for inventory businesses)      │
│  ALSO: OutreachOpenerService triage-archetype whitelist  │
│  (line 195) extended to accept A6                        │
│  EXISTING A1–A5: unchanged selection logic               │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Opener Prompts (per-archetype, archetype-specific       │
│  persona preamble)                                       │
│  NEW: A6_PROMPT — product-visibility hook + product      │
│  preview artifacts                                       │
│  CHANGED: PERSONA_PREAMBLE split into per-archetype      │
│  preambles (A1 keeps review framing, A6 gets product     │
│  framing)                                                │
│  EXISTING A1–A5 prompt bodies: unchanged                 │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Deliverable Sections                                    │
│  NEW TYPES: mobile_catalog_preview, gbp_photo_optimization,│
│  availability_inquiry_flow, fulfillment_pathway,         │
│  hours_sync_plan                                         │
│  EXISTING: recovery_playbook, listing_corrections,       │
│  cta_fixes — unchanged for service businesses; A3/A4/A5  │
│  gain conditional sections on product/hybrid only (§5.5) │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Work Streams

### Sprint 1 (Weeks 1–2): Signal Taxonomy + Audit Schema + Archetype A6

#### 5.1 Signal Taxonomy Expansion

**Files:**
- `apps/api/src/services/triage/signal-taxonomy.ts` (add 7 codes to `KNOWN_SIGNAL_CODES` + `SIGNAL_LABELS`)
- `apps/api/src/services/triage/signal-extractor.ts` (**hand-written detection logic for all 7 codes** — the extractor is a pure function; registry `derived_rule` JSON is never evaluated, per Principle 4)
- Migration: `database/migrations/170_mkt_signal_registry_product_codes.sql`

**New signal codes (7 codes, bringing 24 → 31):**

| Code | Family | Label | Detection (extractor logic to implement) |
|------|--------|-------|-----------|
| `DS_MISSING_PRODUCT_CATALOG` | DS | Missing Product Catalog | `has_product_browsing === false` (any business type — the agent assessed product browsing, implying product relevance), OR no website detected AND resolved `business_type` is `product`/`hybrid`. Service businesses with no website fire `WC_MISSING_WEBSITE` only. |
| `WC_MISSING_PRODUCT_BROWSING` | WC | Missing Product Browsing | Website exists AND `has_product_browsing === false` (site is informational only, no product/category pages). Type-agnostic. |
| `WC_MISSING_AVAILABILITY_INQUIRY` | WC | Missing Availability Inquiry | `has_availability_inquiry === false` (website field; GBP-side detection is folded into this agent-assessed field — no separate GBP path). Type-agnostic. |
| `WC_MISSING_PICKUP_DELIVERY` | WC | Missing Pickup/Delivery Pathway | `has_pickup_ordering === false` AND `has_delivery_option === false`. Type-agnostic. |
| `VP_MISSING_STOREFRONT_PHOTOS` | VP | Missing Storefront Photos | `photo_types` present AND lacks all of `storefront`/`exterior`/`interior`. Absent `photo_types` → no signal (unknown, per Risk 4). |
| `VP_MISSING_PRODUCT_PHOTOS` | VP | Missing Product Photos | `photo_types` present AND lacks `product`. Absent `photo_types` → no signal. |
| `DS_OUTDATED_HOLIDAY_HOURS` | DS | Outdated/Missing Holiday Hours | `special_hours_present === false`. **Redesigned in v1.1:** GBP does not expose "special hours last updated" timestamps, so the original 90-day-staleness rule was undetectable. The signal now fires on *missing* special hours (obtainable data); the agent notes non-standard holiday schedules in the audit narrative for operator context. |

**Family predicates — update:**
- `isVisualSignal()`: add `VP_MISSING_STOREFRONT_PHOTOS`, `VP_MISSING_PRODUCT_PHOTOS` (already covers `VP_*`)
- `isRepairSignal()`: add `DS_OUTDATED_HOLIDAY_HOURS` (hours drift is a repair-class signal)
- No new predicate family needed — all 7 codes fit existing families (DS, WC, VP)

**Thresholds — business-type-sensitive:**

The `DS_PHOTO_DEFICIT` threshold (currently flat `<5`, `PHOTO_DEFICIT_THRESHOLD` at signal-extractor.ts line 43) becomes a function of resolved business type:
- Product/inventory/hybrid business: `<10` photos (grocery stores should have significantly more)
- Service business, or business type unknown (legacy audits): `<5` photos (existing behavior — backward compatible)

**Business-type resolution (new shared helper — does NOT exist today):**

`MarketingServiceCategoryService.ts` is a value→label lookup for service categories; it does **not** classify service/product/hybrid. This sprint adds a new classifier:

- **New table** `mkt_business_type_categories` (migration 172): `category` (PK, lowercased GBP/category string), `business_type` (`service`/`product`/`hybrid`), `is_active`. Seeded with an initial mapping (grocery store, supermarket, convenience store, bakery, butcher shop, liquor store, pharmacy → `product`; HVAC, plumber, dentist, roofing → `service`; restaurant, caterer, café with retail → `hybrid`).
- **New service** `MarketingBusinessTypeService.ts` with `resolveBusinessType(auditData)`:
  1. Agent-emitted top-level `business_type` (§5.2) wins when present and not `unable_to_verify` — it's an explicit assessment.
  2. Otherwise, category mapping lookup on `audit_metadata.matched_business.category`, then GBP `primary_category`.
  3. Otherwise `null` (unknown) — extractors/thresholds fall back to service-business defaults (existing behavior).

The helper is used by the signal extractor (photo threshold, `DS_MISSING_PRODUCT_CATALOG` no-website branch) and by archetype selection (§5.3). Note this introduces an ordering dependency: business type is resolved *before* signal extraction for a campaign.

**Migration 170:** Seed the 7 new codes into `mkt_signal_registry` with `is_active = true` and appropriate `family` assignments. The `derived_rule` JSON documents each rule for admin display (matching the conventions of migration 158, e.g. `{"field":"photo_count","op":"<","threshold":5}`) but is **not** evaluated at runtime — the extractor code above is the detection implementation.

**Tests:**
- `signal-taxonomy.test.ts`: verify 31 known codes, family predicates for new codes
- `signal-extractor.test.ts`: verify new codes emit correctly from audit data with product-business fields

#### 5.2 Audit Schema Extension

**Files:**
- `apps/api/src/validators/business-analysis.schema.ts`
- `apps/api/src/scripts/seed-marketing-ops-templates.ts` (update "Seek: Business Audit" prompt to request new fields)

**New fields on `websiteSchema`:**

```typescript
has_product_browsing: coercedBooleanNullableTolerant.optional(),
has_availability_inquiry: coercedBooleanNullableTolerant.optional(),
has_pickup_ordering: coercedBooleanNullableTolerant.optional(),
has_delivery_option: coercedBooleanNullableTolerant.optional(),
product_categories_visible: z.array(z.string()).optional(),
```

**New fields on `googlePlatformSchema`:**

```typescript
photo_count: coercedNumberNullable.optional(),  // declaring an already-consumed passthrough field
photo_types: z.array(z.string()).optional(), // ['storefront','exterior','interior','product','team','logo']
special_hours_present: coercedBooleanNullableTolerant.optional(),
```

(v1.1 removed `special_hours_last_updated` — GBP exposes no update timestamps, so asking agents for unobtainable data invites fabrication. `DS_OUTDATED_HOLIDAY_HOURS` fires on `special_hours_present === false`, §5.1.)

**New top-level field:**

```typescript
business_type: z.enum(['service', 'product', 'hybrid', 'unable_to_verify']).optional(),
```

This is the field that disambiguates routing. The seek audit prompt asks the agent to classify the business; the signal extractor and archetype selection use it as a tiebreaker.

**Seek prompt update:** The "Seek: Business Audit" template (`mpt-seed-seek-001`) gains instructions to assess the new website fields, GBP photo types, and business type classification. The `BUSINESS_ANALYSIS_PROMPT_SUFFIX` (the JSON schema appendix sent to external agents) is updated to document the new fields.

**Backward compatibility:** All new fields are `.optional()` — legacy audits without them continue to validate. The signal extractor treats missing fields as `null` (no signal emitted), which is the correct behavior for service-business audits that were never asked about product browsing.

**Tests:**
- `business-analysis.schema.test.ts`: verify new fields validate correctly with all coercion variants
- Verify legacy audit JSON (without new fields) still passes validation

#### 5.3 Archetype A6: Product Visibility Gap

**Files:**
- `apps/api/src/services/outreach-openers/archetype-selection.ts`
- `apps/api/src/services/outreach-openers/archetype-prompts.ts`
- `apps/api/src/services/outreach-openers/field-extractors.ts`
- `apps/api/src/services/triage/types.ts` (add A6 to archetype union + `ARCHETYPE_LABELS`)
- `apps/api/src/services/OutreachOpenerService.ts` (**required, was missing in v1.0:** line 195 hardcodes the accepted-triage archetype whitelist `['A1','A2','A3','A4','A5']` — without adding `'A6'`, an operator-accepted PB-07 triage is silently ignored and the opener falls through to `selectArchetype`)

**A6 selection logic** (in `selectArchetype`):

Insert A6 between A1 and A3 in the priority chain:
```
A2 > A1 > A6 > A3 > A4
```

**Important input constraint (verified):** `selectArchetype(auditData)` receives **only** `BusinessAnalysisAuditData` — it has no access to the extractor's `detected_signals`. A6 therefore derives from audit fields directly:

A6 fires when:
- Resolved business type (§5.1 helper) is `'product'` OR `'hybrid'`, AND
- The audit shows a product-visibility gap: `website.has_product_browsing === false`, OR no website detected (status absent/dead), AND
- A2 (recurring-theme negatives) and A1 (review response gap) did not fire

This mirrors (but does not literally read) the `DS_MISSING_PRODUCT_CATALOG`/`WC_MISSING_PRODUCT_BROWSING` detection logic, keeping `selectArchetype` a pure audit-data function like the existing A1–A4 branches.

This places A6 above A3/A4 because for a product business, having no way for customers to browse products online is a more urgent visibility gap than listing drift or a missing CTA. But A2/A1 still win when reviews are the dominant pain — a grocery store with a cluster of negative reviews about expired products should still get A2.

**A6 field extractor** (`extractA6Fields`):

```typescript
export interface A6Fields extends CommonFields {
  business_type: 'product' | 'hybrid';
  has_website: boolean;
  has_product_browsing: boolean;
  has_availability_inquiry: boolean;
  has_pickup_option: boolean;
  has_delivery_option: boolean;
  photo_count: number;
  photo_types: string[];
  missing_photo_types: string[];   // ['storefront','product'] — what's absent
  product_categories_sample: string[]; // from GBP or website, if visible
}
```

**A6 prompt** (`A6_PROMPT`):

The persona preamble for A6 is **product-visibility-specific** (not the shared review-centric preamble):

```
You are a local-business visibility auditor. You pulled this business's
public footprint across Google Business Profile, Yelp, and their website,
and found that customers have no reliable way to confirm what products
they carry, whether they're open, or whether an item is in stock before
traveling to the store.

You're writing a cold first-touch outreach opener to the small business
owner. The goal: prove you actually looked at their online presence,
surface the specific product-discoverability gap, and offer a concrete
deliverable that fixes it — not a sales pitch. The tone is quiet,
specific, and useful. You are not a vendor. You are someone who did
the homework for them.
```

The opener anatomy (same 6-step structure as A1–A4):

1. Greeting
2. "Pulled together a quick visibility snapshot for [business_name]."
3. The hook — lead with the product-discoverability gap:
   - If no website: "Customers searching for [business_name] online find a Google listing but no website — no way to browse products, check what's in stock, or confirm hours before driving to you."
   - If website but no product browsing: "Your website's up but there's no way for customers to browse products or check availability before coming in — every visit is a guess."
   - If no availability inquiry: "There's no way for a customer to message or call to check if a specific product is in stock — they have to drive there to find out."
   - Pick the strongest gap from the fields. ONE observation only.
4. One line: "Three previews attached — the mobile catalog mockup, the GBP photo optimization, and the availability-inquiry flow."
5. Close: `{{close_line}}`
6. Signoff

**Forbidden:** "online booking," "scheduling," "service menu," "project photos," pricing/tier jargon, exclamation points, emojis, stacking multiple gaps in the hook.

**Persona preamble refactor:**

Split `PERSONA_PREAMBLE` into per-archetype preambles. A1–A2 keep the existing review-centric preamble. A3 keeps a listing-drift framing. A4 keeps a CTA-framing. A5 keeps the dual-signal framing. A6 gets the product-visibility framing above.

This is the single most important change for trust: today, every opener leads with "reviews are going unanswered" even when the archetype is A3 (listing drift) or A4 (CTA gap). The preamble should match the archetype's actual reason for existing.

**ARCHETYPE_LABELS update** (`triage/types.ts`):

```typescript
export type ArchetypeCodeWithA6 = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';

// Backward-compat alias — existing importers of ArchetypeCodeWithA5
// keep compiling; do NOT rename the export without updating importers.
/** @deprecated use ArchetypeCodeWithA6 */
export type ArchetypeCodeWithA5 = ArchetypeCodeWithA6;

export const ARCHETYPE_LABELS: Record<ArchetypeCodeWithA6, string> = {
  A1: 'A1_REVIEW_GAP',
  A2: 'A2_NEGATIVE_RECOVERY',
  A3: 'A3_LISTING_DRIFT',
  A4: 'A4_CTA_GAP',
  A5: 'A5_DUAL_TRIAGE',
  A6: 'A6_PRODUCT_VISIBILITY_GAP',
};
```

Also add `'A6'` to the `ArchetypeCode` union in `archetype-selection.ts` (line 22), the `ArchetypeFields` union + `extractFields` switch in `field-extractors.ts`, and the `buildArchetypePrompt` switch in `archetype-prompts.ts` — all are hardcoded A1–A5 switches/unions that will fail to compile or silently miss A6 otherwise.

**Tests:**
- `archetype-selection.test.ts`: verify A6 fires for product-business audits with catalog gap, does NOT fire for service-business audits, does NOT fire when A2/A1 conditions are met
- `archetype-prompts.test.ts`: verify A6 prompt builds correctly with extracted fields
- `field-extractors.test.ts`: verify A6 field extraction from audit data with new schema fields
- Verify A1–A5 selection + prompts unchanged for service-business audit fixtures

#### 5.4 Playbook PB-07: Product Visibility & Catalog Refresh

**Files:**
- `apps/api/src/services/triage/types.ts` (`PLAYBOOK_CODES` — validated by `MarketingPlaybookCatalogService.validateCode`, so the union MUST be updated or PB-07 CRUD/seed throws)
- `apps/api/src/services/MarketingPlaybookCatalogService.ts` (verify only — no code change beyond the types.ts union)
- `apps/api/src/routes/marketing-ops.ts` (**required, was missing in v1.0:** `playbookCodeEnum` line 446 and `archetypeEnum` line 448 gate playbook CRUD + triage override — add `'PB-07'` and `'A6'`. Note: `playbookCodeEnum` currently omits even `'PB-06'` — fix that pre-existing bug in the same change, or operator override to PB-06/PB-07 400s. **v1.2:** also add `'product_visibility_preview'` to the `deliverable_type` zod enums at lines 611, 624, 1926 in Sprint 1 — pulled forward from §5.5 to avoid a Sprint 1→2 runtime type gap since migration 171 seeds `preview_deliverable_type = 'product_visibility_preview'`)
- `apps/api/src/services/MarketingDeliverableService.ts` (**v1.2 — pulled forward from §5.5 to Sprint 1:** add `'product_visibility_preview'` to the `DeliverableType` union, lines 22–32. The deliverable section builders remain in Sprint 2; only the type union + route enum are pulled forward so the seeded PB-07 row's `preview_deliverable_type` is a valid value at runtime.)
- Migration: `database/migrations/171_mkt_playbook_pb07_product_visibility.sql`

**PB-07 definition:**

| Field | Value |
|-------|-------|
| Code | `PB-07` |
| Name | Product Visibility & Catalog Refresh |
| Category | `triage_management` |
| Archetype | `A6` |
| Priority rank | **5** (see cascade below — v1.0's "rank 3" collided with PB-01's existing rank 3) |
| FITD offer title | "Mobile Catalog + GBP Photo Optimization Preview" |
| FITD default fee | $199 one-time (19,900¢) — v1.0 said "$0, same as PB-01..PB-06 pattern," but production PB-01..PB-06 FITD offers are **paid** ($99–$349). $199 matches the PB-03 surface-deliverable tier. |
| Retainer pitch title | "Monthly Product Visibility & Local Discovery Retainer" |
| Retainer fee | $399/mo (39,900¢) — matches existing PB-03/PB-05 retainer tier (migration 158 range: $199–$399). Configurable per campaign. **v1.2:** lowered from v1.1's $2,500/mo to align with the existing retainer fee pattern. |
| Preview deliverable type | `product_visibility_preview` (requires `DeliverableType` union additions — §5.5) |

**Matching rules:**

```json
{
  "any": ["DS_MISSING_PRODUCT_CATALOG", "WC_MISSING_PRODUCT_BROWSING", "WC_MISSING_AVAILABILITY_INQUIRY", "WC_MISSING_PICKUP_DELIVERY"],
  "all": [],
  "none": ["RA_BBB_GRADE_SUPPRESSION", "RA_UNANSWERED_COMPLAINTS", "RA_UNADDRESSED_NEGATIVE_BACKLOG"],
  "dual": null,
  "confidence": 0.82
}
```

- `any` includes `WC_MISSING_PICKUP_DELIVERY` (resolves Open Question 4: **yes** — missing pickup/delivery is product-visibility-adjacent and the PB-07 deliverable addresses it via the `fulfillment_pathway` section).
- `none` excludes BBB crisis signals AND `RA_UNADDRESSED_NEGATIVE_BACKLOG` — an active negative-review crisis routes to PB-04 (rank 1) first, per the "review crises win" principle. Weak review signals (drought, low volume, positive backlog) do NOT suppress PB-07 — see the PB-02 change below.

**Triage cascade** (production `priority_rank`s, post-sprint):

```
PB-04 (1, BBB/negative crisis) > PB-05 (2, dual-signal) > PB-01 (3, profile repair)
> PB-02 (4, review gap) > PB-07 (5, product visibility) > PB-06 (6, visual refresh) > PB-03 (7, conversion fallback)
```

Migration 171 therefore does three things: (a) INSERT PB-07 at rank 5, (b) renumber `PB-06` 5→6 and `PB-03` 6→7, (c) UPDATE PB-02's `matching_rules` (below). Uses `ON CONFLICT (code) DO UPDATE` (matching migration 158's idempotent re-seed convention), not `DO NOTHING`.

**PB-02 `none` set extension (the cascade co-occurrence fix — flagged behavior change #2):**

Add `DS_MISSING_PRODUCT_CATALOG` and `WC_MISSING_PRODUCT_BROWSING` to PB-02's `none` array. Rationale (§2.5): PB-02's `any` (review drought / low volume / positive backlog) fires for most small grocery stores, and at rank 4 it would otherwise always beat PB-07 — reproducing the A1 "review gap" misrouting this sprint exists to fix. With the extension, a business whose footprint includes a product-catalog gap routes to PB-07; a business with only review stagnation and no catalog gap still routes to PB-02. Genuine review crises are unaffected (they route to PB-04, rank 1). Service businesses emit no product codes, so their PB-02 evaluation is unchanged.

**Tests:**
- `TriageEngineService.test.ts`: verify PB-07 matches on product-visibility signals; does NOT match on BBB crisis or unanswered-negative backlog; does NOT match for service-business audits without product signals; PB-01..PB-06 matching unchanged for service fixtures
- **New co-occurrence test (the critical one):** realistic grocery-store fixture — low review volume (`RA_LOW_REVIEW_VOLUME` fires) + missing product catalog → PB-07 wins over PB-02; verify PB-02's extended `none` suppresses it
- Update the `seededCascade()` fixture (currently hardcodes 6 playbooks + ranks) to include PB-07 at rank 5 and the renumbered PB-06/PB-03

---

### Sprint 2 (Weeks 3–4): Deliverable Sections + Pitch Recalibration + Seek Prompt Update + Integration

#### 5.5 Deliverable Section Types

**Files:**
- `apps/api/src/services/deliverable/DeliverableSectionService.ts`
- `apps/api/src/services/deliverable/prompts.ts`
- `apps/api/src/services/deliverable/DeliverableRenderService.ts`
- `apps/api/src/services/MarketingDeliverableService.ts` (**required, was missing in v1.0:** add `'product_visibility_preview'` to the `DeliverableType` union, lines 22–32)
- `apps/api/src/routes/marketing-ops.ts` (**required:** add `'product_visibility_preview'` to the `deliverable_type` zod enums at lines 611, 624, 1926)
- `apps/web/src/services/MarketingOpsService.ts` (**required:** add to the frontend `DeliverableType` union, lines 60–71)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (**required:** the Generate Deliverable modal has a hardcoded type dropdown at lines 1213–1226)

**Shared archetype resolver (new, used here and in §5.6):** archetype is **not persisted on the campaign** (`mkt_campaigns_list` has no archetype column). Today every consumer recomputes `selectArchetype(auditData)` independently, which diverges from the operator-accepted triage result. Add a shared helper (e.g. `resolveCampaignArchetype(campaignId, ctx)` in `OutreachOpenerService.ts` or a new small service): (1) read the accepted/overridden triage result's playbook → its `archetype` column; (2) fall back to `selectArchetype(latestAuditData)`. This also fixes opener/pitch/deliverable inconsistency when an operator overrides triage.

**New `SectionType` values:**

```typescript
export type SectionType =
  | 'recovery_playbook'
  | 'listing_corrections'
  | 'cta_fixes'
  // New product-visibility sections:
  | 'mobile_catalog_preview'
  | 'gbp_photo_optimization'
  | 'availability_inquiry_flow'
  | 'fulfillment_pathway'
  | 'hours_sync_plan';
```

**New prompt builders** (in `prompts.ts`):

1. **`buildMobileCatalogPrompt`** — generates a mobile product-category website mockup / lightweight catalog structure. Inputs: business name, category, product categories (from GBP or audit), city. Output: recommended category structure, page layout, sample product category pages, click-to-call/WhatsApp/SMS action placements.

2. **`buildGbpPhotoOptimizationPrompt`** — generates a GBP photo optimization plan. Inputs: business name, current photo count, current photo types, missing photo types. Output: shot list (storefront exterior, interior, product close-ups, team, signage), captions, upload priority order, GBP attributes to enable (e.g., "Women-led", "Identifies as Black-owned").

3. **`buildAvailabilityInquiryFlowPrompt`** — generates an availability-inquiry flow design. Inputs: business name, current contact methods, phone, WhatsApp (if detected), SMS capability. Output: recommended inquiry flow (click-to-call / WhatsApp / SMS / web form), response templates for "is this in stock?", staffing considerations.

4. **`buildFulfillmentPathwayPrompt`** — generates a pickup/delivery pathway setup plan. Inputs: business name, category, current fulfillment settings, location. Output: recommended fulfillment options (in-store pickup, curbside, local delivery), platform setup steps (Stripe/local delivery integration), SOP for order flow.

5. **`buildHoursSyncPlanPrompt`** — generates an hours + holiday-hours synchronization plan. Inputs: business name, current GBP hours, special hours status, business type. Output: recommended regular hours update, holiday-hours calendar for the next 12 months (including ethnic-market-relevant holidays), directory sync checklist.

**`generateAllSections` update:**

Correction (verified): today `generateAllSections` does **not** branch on archetype — it branches on audit-data conditions (`recovery_playbook` if negative themes exist, `listing_corrections` if NAP inconsistent, `cta_fixes` if CTAs missing; lines 89–119). This sprint introduces archetype-awareness via the shared resolver above:

- A1–A2 → existing condition-based sections (unchanged)
- A3 → existing sections; **add** `hours_sync_plan` only when resolved business type is product/hybrid
- A4 → existing sections; **add** `availability_inquiry_flow` only when resolved business type is product/hybrid
- A5 → existing sections; **add** `hours_sync_plan` only when resolved business type is product/hybrid
- A6 → `mobile_catalog_preview` + `gbp_photo_optimization` + `availability_inquiry_flow` + `fulfillment_pathway` + `hours_sync_plan`

The A3/A4/A5 additions are flagged behavior change #3 — conditional on business type, so service-business deliverables are byte-identical to today. Each new section type also needs a case in the `generateSection` switch (lines 149–199), not just the `SectionType` union.

**`DeliverableRenderService` update:**

The `deliverableType` passed to `MarketingDeliverableService.generateDeliverable` is currently hardcoded to `'review_responses'` (line 56). Change to derive from the shared archetype resolver:
- A6 → `'product_visibility_preview'`
- A1–A5 or unknown → `'review_responses'` (existing default)

Requires the `DeliverableType` union + zod enum + frontend dropdown additions listed in Files above — `'product_visibility_preview'` is not a valid value anywhere today. Log a warning (not silent catch) if resolution fails and the fallback is used, so misrouted deliverables are observable.

**Tests:**
- `DeliverableSectionService.test.ts`: verify new section types generate correctly with product-business audit fixtures
- Verify existing section types unchanged for service-business audits
- `DeliverableRenderService.test.ts`: verify deliverable type derivation from archetype

#### 5.6 Pitch Pipeline Recalibration

**Files:**
- `apps/api/src/services/outreach-pitch/prompts.ts`
- `apps/api/src/services/outreach-pitch/PitchService.ts`
- `apps/api/src/services/outreach-pitch/CloserService.ts`
- `apps/api/src/services/outreach-pitch/HeaderService.ts` (**required, was missing in v1.0**)

Correction (verified): the pitch pipeline is **already archetype-aware** — `HeaderService` and `CloserService` each call `selectArchetype(auditData)` + `extractFields` internally. The recalibration is therefore:

- **Switch both services to the shared archetype resolver (§5.5)** instead of recomputing `selectArchetype` independently — so the pitch matches the operator-accepted triage result and the opener.
- **HeaderService / CloserService:** branch content on A6 — the closer's retainer offer references product-visibility services for A6 (mobile catalog, GBP photo optimization, availability inquiry, fulfillment, hours sync, monthly reporting) vs. review-management services for A1–A2.
- **prompts.ts:** Add a `PRODUCT_VISIBILITY_PITCH_PROMPT` alongside the existing review-management pitch prompt. The pitch structure (problem → proof → preview → offer) stays the same; the content changes. The A6 field extractor's fields (§5.3) feed it.

**Tests:**
- `PitchService.test.ts` (**new file** — does not exist today): verify A6 campaigns get the product-visibility pitch, A1–A2 get the review-management pitch, and the pitch honors an operator-overridden triage archetype via the shared resolver

#### 5.7 Seek Prompt Template Update

**File:** `apps/api/src/scripts/seed-marketing-ops-templates.ts`

Update the "Seek: Business Audit" template (`mpt-seed-seek-001`) to instruct the audit agent to assess:

1. **Business type classification** — classify as `service`, `product`, `hybrid`, or `unable_to_verify`
2. **Product browsing** — does the website (if any) allow customers to browse products/categories?
3. **Availability inquiry** — is there a way for customers to check if a specific product is in stock (WhatsApp, SMS, click-to-call, web form)?
4. **Pickup/delivery** — does the business offer pickup or delivery? Is it surfaced online?
5. **GBP photo types** — categorize the GBP photos by type (storefront, exterior, interior, product, team, logo) and count per type
6. **Holiday hours** — are special/holiday hours present and current on GBP?

Update the `BUSINESS_ANALYSIS_PROMPT_SUFFIX` (the JSON schema appendix) to document the new fields so external agents emit them.

**Also update "Fulfill: GBP Optimization"** (`mpt-seed-fulfill-003`) to include product-specific photo recommendations (storefront, product close-ups, signage) alongside the existing service-business photo recs. The prompt already mentions "Photo recommendations: types and captions for 5 photos" — extend to be business-type-aware.

**Migration/seed:** Re-run `pnpm seed:mkt-templates` to update the seeded templates in place (idempotent via deterministic IDs).

#### 5.8 Follow-Up Sequence Recalibration

**Files (corrected in v1.1 — v1.0 pointed at the wrong file):**
- `apps/api/src/scripts/seed-marketing-ops-templates.ts` — the Week 1–4 sequence with the Week 4 retainer pitch lives in seed template **`mpt-seed-retainer-001`** ("Retainer: Follow-up Sequence", lines 189–212), not in `followup-prompts.ts`
- `apps/api/src/services/outreach-followups/followup-prompts.ts` — separately, this file holds per-archetype 'doing'/'telling' branch prompts for A1–A5 (line ~434); A6 branch variants are needed here too

**Changes:**

1. **`mpt-seed-retainer-001`:** add a product-visibility variant of the Week 4 retainer pitch. When the campaign archetype (via the shared resolver, §5.5) is A6, the retainer pitch references: "Monthly storefront + product photography, GBP photo refresh, catalog updates, hours/holiday-hours sync, availability-inquiry monitoring, local visibility reporting." A1–A2 keep the existing review-management pitch. (If the template body is archetype-agnostic text, parameterize the Week 4 paragraph with an `{{archetype_variant}}` slot filled at render time — check how the template is rendered before editing.)
2. **`followup-prompts.ts`:** add A6 'doing' and 'telling' branch prompts with product-visibility framing (reference the catalog/photos/inquiry gap, not reviews or booking).
3. Re-run `pnpm seed:mkt-templates` (from `apps/api`, under Doppler) — the seed is idempotent via deterministic IDs (upsert on existing template).

**Tests:**
- `OutreachFollowUpService.test.ts` (**new file** — does not exist today): verify A6 campaigns get product-visibility follow-up content in both the retainer sequence and the doing/telling branches

#### 5.9 Frontend: Triage Card + Campaign Detail Updates

**Files:**
- `apps/web/src/components/marketing-ops/IntelligentTriageCard.tsx` — **no change needed** (verified: renders archetype/playbook labels from triage-result data; override dropdown is API-fed and picks up PB-07 automatically once the route enum is fixed — §5.4)
- `apps/web/src/services/MarketingOpsService.ts` — **code change:** add `'A6'` to `OpenerArchetype` (line 224 — note: currently lacks even `'A5'`, a pre-existing gap to fix in the same edit); add `'product_visibility_preview'` to `DeliverableType` (lines 60–71)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx` — **code change:** hardcoded `ARCHETYPE_LABELS` map (lines 17–22) is A1–A4 only; add A5 (pre-existing gap) and A6 ("Product Visibility Gap"). The opener workspace lives at `/settings/admin/marketing-ops/openers`, not `/outreach` as v1.0 stated.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/PlaybookCatalogClient.tsx` — **code change:** add `'A6'` to the `ARCHETYPES` dropdown (line 25; `PLAYBOOK_CODES` already lists PB-07)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — **code change:** add `product_visibility_preview` to the hardcoded Generate Deliverable type dropdown (lines 1213–1226)

**Triage card:** verified data-driven — A6/PB-07 render automatically.

**Campaign detail:** When a campaign is triaged to PB-07/A6, "Generate Deliverable" produces the product-visibility sections via the backend changes in §5.5; the modal dropdown addition above lets the operator select the type explicitly. Section types are rendered generically from API data (no web-side section label map exists — verified), but do a visual pass on the deliverable workspace (`deliverables/[campaignId]/page.tsx`) with a real A6 deliverable to confirm section titles/content render acceptably.

**Tests:**
- Manual verification: triage a product-business campaign, verify A6 + PB-07 render in triage card, generate opener + deliverable, verify product-visibility sections appear

#### 5.10 Signal Registry Admin UI

**Files:**
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/PlaybookCatalogClient.tsx` (Signal Registry tab, lines 458–520)

The admin UI **exists** (verified) as the "Signal Registry" tab of the playbook catalog page, backed by `MarketingSignalRegistryService` — so per v1.0's own conditional this is **in scope**, as a manual verification step: confirm the 7 new codes appear after migration 170 with correct family/label/active state, and that the register-signal modal's family options cover DS/WC/VP (they're existing families, so no new-family work is expected). Also verify the tab renders `derived_rule` JSON for the new codes without breaking.

---

## 6. Migration Plan

### Migration 1: `170_mkt_signal_registry_product_codes.sql`

(Renumbered from 165 in v1.1 — migrations 165–169 already exist. Next free numbers: 170/171/172.)

Seed 7 new signal codes into `mkt_signal_registry`. Note: `derived_rule` is documentation for the admin UI (matching migration 158's convention of simple `{field, op, threshold}` descriptors); detection is implemented in `signal-extractor.ts` per §5.1.

```sql
INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'DS_MISSING_PRODUCT_CATALOG', 'DS', 'Missing Product Catalog', 'Business has no website (product/hybrid) or website lacks product/category browsing — customers cannot see what products are carried before visiting', 'derived', '{"field":"website.has_product_browsing","op":"==","threshold":false}', true, now(), now()),
  (gen_random_uuid(), 'WC_MISSING_PRODUCT_BROWSING', 'WC', 'Missing Product Browsing', 'Website exists but does not allow customers to browse products or categories', 'derived', '{"field":"website.has_product_browsing","op":"==","threshold":false}', true, now(), now()),
  (gen_random_uuid(), 'WC_MISSING_AVAILABILITY_INQUIRY', 'WC', 'Missing Availability Inquiry', 'No way for customers to check product availability before visiting (no WhatsApp, SMS, click-to-call-to-check-stock, or web form)', 'derived', '{"field":"website.has_availability_inquiry","op":"==","threshold":false}', true, now(), now()),
  (gen_random_uuid(), 'WC_MISSING_PICKUP_DELIVERY', 'WC', 'Missing Pickup/Delivery Pathway', 'No pickup or delivery option surfaced on website, GBP, or fulfillment settings', 'derived', '{"field":"website.has_pickup_ordering","op":"==","threshold":false}', true, now(), now()),
  (gen_random_uuid(), 'VP_MISSING_STOREFRONT_PHOTOS', 'VP', 'Missing Storefront Photos', 'GBP photos lack storefront/exterior/interior shots — customers cannot see the store before visiting', 'derived', '{"field":"google.photo_types","op":"missing_value","threshold":"storefront|exterior|interior"}', true, now(), now()),
  (gen_random_uuid(), 'VP_MISSING_PRODUCT_PHOTOS', 'VP', 'Missing Product Photos', 'GBP photos lack product close-ups — customers cannot see what products are carried', 'derived', '{"field":"google.photo_types","op":"missing_value","threshold":"product"}', true, now(), now()),
  (gen_random_uuid(), 'DS_OUTDATED_HOLIDAY_HOURS', 'DS', 'Missing Holiday Hours', 'GBP special/holiday hours are not present — customers cannot confirm holiday schedules before visiting', 'derived', '{"field":"google.special_hours_present","op":"==","threshold":false}', true, now(), now())
ON CONFLICT (code) DO NOTHING;
```

(The `DS_MISSING_PRODUCT_CATALOG` vs `WC_MISSING_PRODUCT_BROWSING` distinction — no-website vs website-exists — is expressed in extractor code; their `derived_rule` descriptors intentionally share the primary field, with the no-website branch documented in the description.)

### Migration 2: `171_mkt_playbook_pb07_product_visibility.sql`

Seed PB-07 into `mkt_playbook_catalog` at `priority_rank` 5, renumber PB-06/PB-03, and extend PB-02's `none` set (§5.4). Follows migration 158's `ON CONFLICT DO UPDATE` re-seed convention so the migration is safely re-runnable:

```sql
-- 1. Make room at rank 5 (PB-07) — renumber existing rows first.
UPDATE mkt_playbook_catalog SET priority_rank = 7, updated_at = NOW() WHERE code = 'PB-03';
UPDATE mkt_playbook_catalog SET priority_rank = 6, updated_at = NOW() WHERE code = 'PB-06';

-- 2. PB-07: Product Visibility & Catalog Refresh (rank 5, archetype A6).
INSERT INTO mkt_playbook_catalog (id, code, name, category, archetype, archetype_label, description, matching_rules, priority_rank, fitd_offer_title, fitd_default_fee_cents, retainer_pitch_title, retainer_fee_cents, opener_prompt_template_id, preview_deliverable_type, is_active, created_at, updated_at)
VALUES (
  'pbk-pb07',
  'PB-07',
  'Product Visibility & Catalog Refresh',
  'triage_management',
  'A6',
  'A6_PRODUCT_VISIBILITY_GAP',
  'For product/inventory businesses (grocery stores, bakeries, specialty markets) with no online product browsing, availability inquiry, or pickup/delivery pathway. Delivers a mobile catalog mockup, GBP photo optimization, availability-inquiry flow, fulfillment pathway, and hours sync plan.',
  '{"any":["DS_MISSING_PRODUCT_CATALOG","WC_MISSING_PRODUCT_BROWSING","WC_MISSING_AVAILABILITY_INQUIRY","WC_MISSING_PICKUP_DELIVERY"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS","RA_UNADDRESSED_NEGATIVE_BACKLOG"],"dual":null,"confidence":0.82}'::jsonb,
  5,
  'Mobile Catalog + GBP Photo Optimization Preview',
  19900,
  'Monthly Product Visibility & Local Discovery Retainer',
  39900,
  NULL,
  'product_visibility_preview',
  true,
  now(),
  now()
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  archetype = EXCLUDED.archetype,
  archetype_label = EXCLUDED.archetype_label,
  description = EXCLUDED.description,
  matching_rules = EXCLUDED.matching_rules,
  priority_rank = EXCLUDED.priority_rank,
  fitd_offer_title = EXCLUDED.fitd_offer_title,
  fitd_default_fee_cents = EXCLUDED.fitd_default_fee_cents,
  retainer_pitch_title = EXCLUDED.retainer_pitch_title,
  retainer_fee_cents = EXCLUDED.retainer_fee_cents,
  preview_deliverable_type = EXCLUDED.preview_deliverable_type,
  updated_at = NOW();

-- 3. Cascade co-occurrence fix (§5.4): product-visibility signals suppress PB-02
--    so a business with a catalog gap routes to PB-07 even when weak review
--    signals (drought / low volume / positive backlog) co-fire.
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{none}',
      (matching_rules->'none')::jsonb || '["DS_MISSING_PRODUCT_CATALOG","WC_MISSING_PRODUCT_BROWSING"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-02'
  AND NOT (matching_rules->'none' ? 'DS_MISSING_PRODUCT_CATALOG');
```

### Migration 3: `172_mkt_business_type_categories.sql`

New table + seed for the business-type classifier (§5.1 — did not exist in v1.0's assumptions):

```sql
CREATE TABLE IF NOT EXISTS mkt_business_type_categories (
  category      VARCHAR(255) PRIMARY KEY,   -- lowercased GBP primary_category or matched_business.category
  business_type VARCHAR(20) NOT NULL,        -- 'service' | 'product' | 'hybrid'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mkt_business_type_categories (category, business_type) VALUES
  ('grocery store', 'product'),
  ('supermarket', 'product'),
  ('convenience store', 'product'),
  ('bakery', 'product'),
  ('butcher shop', 'product'),
  ('liquor store', 'product'),
  ('pharmacy', 'product'),
  ('specialty food store', 'product'),
  ('hvac contractor', 'service'),
  ('plumber', 'service'),
  ('dentist', 'service'),
  ('roofing contractor', 'service'),
  ('electrician', 'service'),
  ('landscaper', 'service'),
  ('restaurant', 'hybrid'),
  ('caterer', 'hybrid')
ON CONFLICT (category) DO NOTHING;
-- Extend over time via admin tooling or follow-up migrations.
```

### Migration 4: Update seeded prompt templates

Re-run `pnpm seed:mkt-templates` (from `apps/api`, under Doppler) after updating `seed-marketing-ops-templates.ts`. This updates "Seek: Business Audit" (`mpt-seed-seek-001`), "Fulfill: GBP Optimization" (`mpt-seed-fulfill-003`), and "Retainer: Follow-up Sequence" (`mpt-seed-retainer-001`, §5.8) in place — the seed script upserts on deterministic IDs. No SQL migration needed. **Runbook note:** the seed must run in each environment after deploy; add it to the deployment checklist (§9).

---

## 7. Testing Strategy

### 7.1 Unit Tests

Corrected inventory (verified): of the files below, only `TriageEngineService.test.ts` and `DeliverableSectionService.test.ts` exist today. The rest are **new files** (v1.0 mislabeled several as "extend"). Signal extraction is currently tested inside `TriageEngineService.test.ts` — new extraction tests go in a new `signal-extractor.test.ts`.

| Test file | Status | New test cases |
|-----------|--------|---------------|
| `signal-taxonomy.test.ts` | **new** | 31 known codes (was 24); family predicates for 7 new codes; `isRepairSignal` includes `DS_OUTDATED_HOLIDAY_HOURS`; `isVisualSignal` includes new VP codes |
| `signal-extractor.test.ts` | **new** | Extract `DS_MISSING_PRODUCT_CATALOG` (has_product_browsing=false; no-website + product business type); extract `VP_MISSING_PRODUCT_PHOTOS`/`VP_MISSING_STOREFRONT_PHOTOS` from `photo_types`; extract `DS_OUTDATED_HOLIDAY_HOURS` from `special_hours_present === false` (not staleness — redesigned §5.1); service-business audits do NOT emit product codes; **business-type-sensitive photo threshold** (<10 for product, <5 for service/unknown); absent `photo_types` emits nothing |
| `MarketingBusinessTypeService.test.ts` | **new** | Agent-emitted `business_type` wins; category-mapping fallback; `unable_to_verify`/unknown → null; hybrid resolves correctly |
| `business-analysis.schema.test.ts` | **new** | Validate audit JSON with new fields (all coercion variants); validate legacy audit JSON without new fields (backward compat) |
| `archetype-selection.test.ts` | **new** | A6 fires for product-business audit with catalog gap (audit-field-derived — no detected_signals input); A6 does NOT fire for service-business audit; does NOT fire when A2/A1 conditions met; fires for hybrid; priority A2 > A1 > A6 > A3 > A4 |
| `field-extractors.test.ts` | **new** | `extractA6Fields` produces correct fields; missing fields handled gracefully |
| `OutreachOpenerService.test.ts` | **new or extend** | Triage-accepted A6 archetype is honored (whitelist fix); A6 opener prompt builds; **run A6 sample openers through `OutreachOpenerQualityGate`** (85-word cap, one-stat rule, required "three previews attached" phrasing) |
| `TriageEngineService.test.ts` | extend | PB-07 matching (§5.4 list); **grocery-store co-occurrence fixture** (low review volume + catalog gap → PB-07 beats PB-02); update `seededCascade()` fixture for PB-07 + renumbered ranks; PB-01..PB-06 unchanged for service fixtures |
| `DeliverableSectionService.test.ts` | extend | New section types generate; `generateAllSections` branches via shared resolver; A6 → product-visibility sections; A3/A4/A5 additions only fire for product/hybrid |
| `DeliverableRenderService.test.ts` | extend | A6 → `product_visibility_preview`; A1–A5/unknown → `review_responses` fallback; fallback logs a warning |
| `PitchService.test.ts` | **new** | A6 campaigns get product-visibility pitch; A1–A2 get review-management pitch; operator-overridden archetype honored via shared resolver |
| `OutreachFollowUpService.test.ts` | **new** | A6 campaigns get product-visibility retainer pitch + doing/telling branches |

### 7.2 Integration Tests

| Test file | New test cases |
|-----------|---------------|
| `Sprint6E2E.test.ts` (or new `Sprint7E2E.test.ts`) | End-to-end: product-business audit → signal extraction → triage (PB-07) → archetype selection (A6) → opener generation → deliverable generation → verify product-visibility sections present |
| `marketing-customer-routes.test.ts` | Verify customer portal displays product-visibility campaign correctly (projection whitelists new fields) |

### 7.3 Regression Tests

- Run existing `TriageEngineService.test.ts`, `OutreachOpenerQualityGate.test.ts`, `DeliverableSectionService.test.ts`, `Sprint6E2E.test.ts`, `MarketingCustomerProjection.test.ts` — all must pass for service-business fixtures. (Note: `archetype-selection.test.ts` / `archetype-prompts.test.ts` don't exist today — the new ones from §7.1 become the regression baseline going forward.)
- **Preamble refactor quality comparison (Risk 3 mitigation):** generate a sample of A3/A4 openers against identical fixtures before and after the preamble split; run both sets through `OutreachOpenerQualityGate` and compare pass rates + manual spot-check. A1/A2 openers must be byte-identical (same preamble).
- Run `MarketingCustomerProjection.test.ts` — verify projection still whitelists correctly with new audit fields (new fields are additive, should not break existing projection).

### 7.4 Manual Verification

1. Create a campaign for an Indianapolis African grocery store prospect
2. Run seek audit → verify audit_data includes `business_type: "product"`, `has_product_browsing: false`, `photo_types: ["storefront"]` (missing product)
3. Run triage → verify PB-07 recommended, A6 archetype
4. Generate opener → verify opener references product discoverability, not reviews or booking
5. Generate deliverable → verify sections include mobile_catalog_preview, gbp_photo_optimization, availability_inquiry_flow
6. Generate pitch → verify pitch references product-visibility services
7. Verify a service-business campaign (HVAC) still routes through A2/PB-02 unchanged

---

## 8. Risk Analysis

### Risk 1: Seek audit agents don't emit the new fields

**Problem:** External audit agents (Claude, GPT, etc.) may not emit `has_product_browsing`, `photo_types`, `business_type`, etc. — especially for legacy prompt templates that don't ask for them.

**Mitigation:**
- All new fields are `.optional()` in the schema — missing fields don't break validation
- The signal extractor treats missing fields as `null` (no signal emitted) — a product business with a legacy audit simply won't trigger A6, falling through to A1–A4 as before
- The updated seek prompt template explicitly asks for the new fields
- The `BUSINESS_ANALYSIS_PROMPT_SUFFIX` documents the new fields in the JSON schema appendix sent to agents

**Severity:** Low — backward compatible by design. Worst case: product businesses with legacy audits don't get A6 routing until re-audited with the updated prompt.

### Risk 2: Business-type misclassification

**Problem:** The audit agent classifies a hybrid business (e.g., a grocery store that also offers catering) as `service` instead of `product`, causing A6 to not fire.

**Mitigation:**
- A6 selection checks resolved business type `'product' || 'hybrid'` — hybrid businesses still get A6
- Detection is business-type-agnostic except the single gated branch (`DS_MISSING_PRODUCT_CATALOG`'s no-website case, §5.1): a service business with no website fires `WC_MISSING_WEBSITE`, not a product code
- The category-mapping fallback (§5.1) catches cases where the agent emits `unable_to_verify` or omits `business_type` entirely
- Operator override: the triage card allows the operator to override the recommended playbook manually (existing feature — **but requires the `playbookCodeEnum` fix in §5.4**, since the route enum currently rejects PB-06 and would reject PB-07)

**Severity:** Low — hybrid businesses are handled; misclassification falls back to existing A1–A4 routing (not broken, just not optimal).

### Risk 3: Persona preamble refactor breaks existing opener quality

**Problem:** Splitting `PERSONA_PREAMBLE` into per-archetype preambles changes the prompt for A3 and A4, which currently use the review-centric preamble even though their hooks are about listing drift and CTA gaps.

**Mitigation:**
- A1 and A2 keep the exact same preamble (review-centric) — no change to the two most-used archetypes
- A3 and A4 get preambles that match their actual hooks (listing drift / CTA gap) — this is an improvement, not a regression, but should be A/B tested
- Run the quality gate on a sample of A3/A4 openers before and after the preamble change to verify quality doesn't degrade
- Keep the old `PERSONA_PREAMBLE` constant as `REVIEW_CENTRIC_PREAMBLE` for reference and potential rollback

**Severity:** Medium — affects A3/A4 opener quality. Mitigated by quality gate + A/B testing.

### Risk 4: Photo-type detection reliability

**Problem:** GBP doesn't expose photo types via API — the audit agent would need to visually classify photos as "storefront" vs "product" vs "team." This is unreliable.

**Mitigation:**
- `photo_types` is an optional field populated by the audit agent's best-effort classification
- The signal extractor treats missing/empty `photo_types` as "unknown" — `VP_MISSING_STOREFRONT_PHOTOS` and `VP_MISSING_PRODUCT_PHOTOS` only fire when `photo_types` is present and lacks the specific type
- If `photo_types` is absent but `photo_count < threshold`, the existing `DS_PHOTO_DEFICIT` signal still fires (unchanged)
- Future: could add a vision-model-based photo classifier, but that's out of scope for this sprint

**Severity:** Low — signals are best-effort, not blocking. The operator can manually add photo-type signals via the triage override.

**Note (v1.1):** the same data-availability problem applied to `DS_OUTDATED_HOLIDAY_HOURS`' original 90-day-staleness rule (GBP exposes no update timestamps) — the signal was redesigned to fire on `special_hours_present === false` (§5.1), which IS obtainable.

### Risk 5: Deliverable render type derivation

**Problem:** `DeliverableRenderService` currently hardcodes `deliverableType: 'review_responses'`. Changing it to derive from archetype could break the render pipeline if the archetype is unknown or the deliverable type doesn't match what `MarketingDeliverableService.generateDeliverable` expects.

**Mitigation:**
- Default to `'review_responses'` when archetype is unknown or A1–A5
- Only use `'product_visibility_preview'` for A6
- Add `'product_visibility_preview'` to ALL `DeliverableType` unions + route zod enums + frontend dropdown FIRST (§5.5 file list) — deriving to a value the union doesn't admit would fail at the type/validation layer, which is the most likely breakage
- Log a warning on fallback (not a silent try/catch) so misrouted deliverables are observable
- Test the render pipeline end-to-end with an A6 campaign before merging

**Severity:** Medium — could break deliverable render if not tested. Mitigated by union plumbing + fallback + integration test.

### Risk 6: Cascade co-occurrence — residual interactions after the PB-02 fix

**Problem:** Even with PB-02's extended `none` set, other playbooks can outrank PB-07 for product businesses: PB-05 dual (rank 2) fires when a repair signal + a review signal co-occur (e.g., NAP drift + review drought), and PB-06 (renumbered to rank 6) overlaps on photo signals.

**Mitigation:**
- PB-05 winning on genuine dual-signal footprints is **accepted as intended** — a business with both listing drift and review stagnation has a broader footprint problem than product visibility alone; the operator can override to PB-07 (after the route-enum fix)
- PB-07 at rank 5 beats PB-06 at rank 6 on co-occurrence, and PB-07's deliverable includes `gbp_photo_optimization`, so photo pain for product businesses is covered either way
- The §7.1 co-occurrence test pins the intended behavior for the target-niche fixture

**Severity:** Low — analyzed and pinned by tests; residual cases have an operator escape hatch.

### Risk 7: Archetype data-flow divergence between opener, pitch, and deliverable

**Problem:** Archetype is not persisted on the campaign. Today the opener honors the accepted triage result (via a whitelist), while pitch services and (after this sprint) deliverable services recompute `selectArchetype(auditData)` independently. If an operator overrides triage, or if the audit data and triage result disagree, the opener, pitch, and deliverable could each assume a different archetype.

**Mitigation:**
- The shared archetype resolver (§5.5) — accepted/overridden triage playbook archetype first, `selectArchetype` fallback — is used by ALL consumers (opener, pitch header/closer, deliverable sections, render service)
- `PitchService.test.ts` includes an operator-override case

**Severity:** Medium — without the shared resolver this sprint would make the divergence worse (more consumers). With it, consistency improves over the status quo.

---

## 9. Rollout Plan

### Phase 1: Sprint 1 (Weeks 1–2) — Backend foundation

1. Land business-type classifier (migration 172 + `MarketingBusinessTypeService` + resolver helper)
2. Land signal taxonomy expansion (7 new codes + migration 170 + extractor logic + photo threshold)
3. Land audit schema extension (new optional fields)
4. Land A6 archetype (selection + prompt + field extractor + persona preamble refactor + `OutreachOpenerService` whitelist + type-union updates)
5. Land PB-07 playbook (migration 171 incl. rank renumbering + PB-02 `none` update; `PLAYBOOK_CODES` union; `marketing-ops.ts` route enums incl. PB-06 pre-existing fix)
6. After migrations: `doppler run --config local -- pnpm prisma db pull` + `pnpm prisma:generate` (per migration 158's convention), then `pnpm checkapi` + all unit tests
7. Run `pnpm build` — verify no type errors

### Phase 2: Sprint 2 (Weeks 3–4) — Deliverables + prompts + frontend

1. Land shared archetype resolver + deliverable section types (5 new types + prompt builders + `DeliverableType` union plumbing across API union, route zod enums, web union, dropdown)
2. Land pitch pipeline recalibration (Header + Closer + new pitch prompt)
3. Land seek prompt template update + follow-up template update (`mpt-seed-retainer-001`) + re-seed (`doppler run --config local -- pnpm seed:mkt-templates` from `apps/api`)
4. Land frontend updates (`OpenerArchetype` + `DeliverableType` unions, opener workspace labels incl. A5 fix, playbook catalog A6 dropdown, deliverable modal dropdown)
5. Run `pnpm checkapi` + `pnpm checkweb` + all tests
6. Run `pnpm build`
7. Manual verification with an Indianapolis African grocery store prospect (§7.4) + signal registry admin UI check (§5.10)

**Deployment checklist additions:** (a) run migrations 170/171/172 in order; (b) re-run `pnpm seed:mkt-templates` in each environment post-deploy; (c) spot-check one triage override to PB-07 via the admin UI (exercises the fixed route enum).

### Phase 3: Post-sprint — Re-audit + launch

1. Re-run seek audits on triaged Indianapolis African-grocery prospects (with updated prompt) to capture `business_type`, `has_product_browsing`, `photo_types`
2. Re-triage audited prospects — verify A6/PB-07 routing. **Existing-campaign policy:** re-auditing a campaign creates a fresh triage result (migration 169 tracks `source_audit_id`); operator-accepted results on stale audits are NOT auto-invalidated — operators re-accept or override per campaign. No bulk re-triage of other in-flight campaigns this sprint; log the count of campaigns with stale (pre-170) triage results for visibility.
3. Generate openers + pitch packages with product-visibility framing
4. **Observability:** add a log line on archetype resolution (source: triage vs. fallback) and on PB-07 cascade wins; review after the first week of audits to confirm A6/PB-07 actually fire for the target niche (the §2.5 co-occurrence failure mode would otherwise be invisible)
5. Launch outreach campaign

---

## 10. File Change Summary

### Backend (`apps/api`)

| File | Change | Sprint |
|------|--------|--------|
| `src/services/MarketingBusinessTypeService.ts` (**new**) | Business-type classifier: `mkt_business_type_categories` lookup + `resolveBusinessType(auditData)` precedence (agent field → category mapping → null) | 1 |
| `src/services/triage/signal-taxonomy.ts` | Add 7 codes to `KNOWN_SIGNAL_CODES`; update `SIGNAL_LABELS`; update `isRepairSignal` | 1 |
| `src/services/triage/signal-extractor.ts` | Add hand-written extraction logic for 7 new codes; business-type-sensitive photo threshold via `MarketingBusinessTypeService` | 1 |
| `src/services/triage/types.ts` | Add `ArchetypeCodeWithA6` (+ `@deprecated` alias keeping `ArchetypeCodeWithA5` compiling); add `A6_PRODUCT_VISIBILITY_GAP` to `ARCHETYPE_LABELS`; add `PB-07` to `PLAYBOOK_CODES` | 1 |
| `src/services/triage/TriageEngineService.ts` | Verify PB-07 evaluates correctly (generic evaluator — likely no code change needed, just new catalog row) | 1 |
| `src/services/outreach-openers/archetype-selection.ts` | Add A6 to `ArchetypeCode`; insert A6 in selection priority; add A6 selection logic (audit-field-derived) | 1 |
| `src/services/outreach-openers/archetype-prompts.ts` | Split `PERSONA_PREAMBLE` into per-archetype preambles; add `A6_PROMPT`; update `buildArchetypePrompt` switch | 1 |
| `src/services/outreach-openers/field-extractors.ts` | Add `A6Fields` interface; add `extractA6Fields`; update `extractFields` dispatcher + `ArchetypeFields` union | 1 |
| `src/services/OutreachOpenerService.ts` | Add `'A6'` to triage-archetype whitelist (line 195); host (or consume) the shared archetype resolver | 1 |
| `src/routes/marketing-ops.ts` | Add `'PB-07'` + `'A6'` to `playbookCodeEnum`/`archetypeEnum` (lines 446–448); add missing `'PB-06'` (pre-existing bug); add `'product_visibility_preview'` to `deliverable_type` zod enums (lines 611, 624, 1926) — **v1.2: pulled to Sprint 1** | 1 |
| `src/validators/business-analysis.schema.ts` | Add `has_product_browsing`, `has_availability_inquiry`, `has_pickup_ordering`, `has_delivery_option`, `product_categories_visible` to `websiteSchema`; add `photo_count`, `photo_types`, `special_hours_present` to `googlePlatformSchema`; add `business_type` to top-level schema; update `BUSINESS_ANALYSIS_PROMPT_SUFFIX` | 1 |
| `src/services/MarketingPlaybookCatalogService.ts` | Verify PB-07 CRUD works (likely no code change — `PLAYBOOK_CODES` union update in types.ts is the only change) | 1 |
| `src/services/deliverable/DeliverableSectionService.ts` | Add 5 new `SectionType` values + `generateSection` switch cases; update `generateAllSections` to branch via shared archetype resolver | 2 |
| `src/services/deliverable/prompts.ts` | Add 5 new prompt builders (`buildMobileCatalogPrompt`, `buildGbpPhotoOptimizationPrompt`, `buildAvailabilityInquiryFlowPrompt`, `buildFulfillmentPathwayPrompt`, `buildHoursSyncPlanPrompt`) | 2 |
| `src/services/deliverable/DeliverableRenderService.ts` | Derive `deliverableType` via shared archetype resolver instead of hardcoding `'review_responses'`; warn-log on fallback | 2 |
| `src/services/MarketingDeliverableService.ts` | Add `'product_visibility_preview'` to `DeliverableType` union (lines 22–32) — **v1.2: pulled to Sprint 1** | 1 |
| `src/services/outreach-pitch/prompts.ts` | Add `PRODUCT_VISIBILITY_PITCH_PROMPT` | 2 |
| `src/services/outreach-pitch/PitchService.ts` | Use shared archetype resolver; select pitch template accordingly | 2 |
| `src/services/outreach-pitch/HeaderService.ts` | Switch to shared resolver; branch header content on A6 | 2 |
| `src/services/outreach-pitch/CloserService.ts` | Switch to shared resolver; branch closer content on A6 | 2 |
| `src/services/outreach-followups/followup-prompts.ts` | Add A6 'doing'/'telling' branch prompts | 2 |
| `src/scripts/seed-marketing-ops-templates.ts` | Update "Seek: Business Audit" + "Fulfill: GBP Optimization" templates; add product-visibility Week 4 variant to `mpt-seed-retainer-001` | 2 |
| `src/services/MarketingCustomerProjection.ts` | Verify projection whitelists new audit fields (additive — likely no change needed) | 2 |

### Migrations (`database/migrations`)

| File | Sprint |
|------|--------|
| `170_mkt_signal_registry_product_codes.sql` | 1 |
| `171_mkt_playbook_pb07_product_visibility.sql` (incl. PB-06/PB-03 renumber + PB-02 `none` update) | 1 |
| `172_mkt_business_type_categories.sql` | 1 |

### Frontend (`apps/web`)

| File | Change | Sprint |
|------|--------|--------|
| `src/components/marketing-ops/IntelligentTriageCard.tsx` | No change (verified data-driven) — manual verification only | 2 |
| `src/services/MarketingOpsService.ts` | Add `'A6'` (+ missing `'A5'`) to `OpenerArchetype`; add `'product_visibility_preview'` to `DeliverableType` | 2 |
| `src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx` | Add A5 + A6 to hardcoded `ARCHETYPE_LABELS` (lines 17–22) | 2 |
| `src/app/(platform)/settings/admin/marketing-ops/playbooks/PlaybookCatalogClient.tsx` | Add `'A6'` to `ARCHETYPES` dropdown (line 25); verify Signal Registry tab renders the 7 new codes (§5.10) | 2 |
| `src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Add `product_visibility_preview` to Generate Deliverable dropdown (lines 1213–1226); verify A6 deliverable sections render | 2 |
| `src/app/(platform)/settings/admin/marketing-ops/deliverables/[campaignId]/page.tsx` | Visual pass only — section types render generically from API data | 2 |

### Tests (`apps/api/src/services/__tests__` + `apps/api/src/tests`)

| File | New tests | Sprint |
|------|-----------|--------|
| `signal-taxonomy.test.ts` (new) | 31 codes, family predicates | 1 |
| `signal-extractor.test.ts` (new) | 7 new code extraction; business-type photo threshold | 1 |
| `MarketingBusinessTypeService.test.ts` (new) | Resolution precedence + mapping fallback | 1 |
| `business-analysis.schema.test.ts` (new) | New field validation; legacy backward-compat | 1 |
| `archetype-selection.test.ts` (new) | A6 selection (audit-field-derived) | 1 |
| `field-extractors.test.ts` (new) | A6 field extraction | 1 |
| `OutreachOpenerService.test.ts` (new) | A6 whitelist; quality-gate run on A6 openers | 1 |
| `TriageEngineService.test.ts` (extend) | PB-07 matching; co-occurrence fixture; `seededCascade()` update | 1 |
| `DeliverableSectionService.test.ts` (extend) | New section types; resolver branching | 2 |
| `DeliverableRenderService.test.ts` (extend) | deliverableType derivation + fallback logging | 2 |
| `PitchService.test.ts` (new) | A6 pitch; operator-override via resolver | 2 |
| `OutreachFollowUpService.test.ts` (new) | A6 follow-up | 2 |
| `Sprint7E2E.test.ts` (new) | End-to-end product-business flow | 2 |

---

## 11. Out of Scope

The following are explicitly **not** part of this sprint:

1. **Third-party NAP citation distribution** (Yelp/Facebook/Bing/Apple Maps sync) — detected as a gap in the platform alignment analysis but requires external API integrations beyond this sprint's scope. The platform detects NAP inconsistency and syncs its own directory + GBP; third-party citation distribution is a future sprint or partner integration.

2. **Neighborhood/ZIP-code local-SEO landing page generator** — the primitives (slugs, SEO metadata, neighborhood tagging, directory pages) exist but a turnkey "generate N ZIP landing pages" deliverable type is a future sprint.

3. **Recurring photography scheduling job** — adding a calendared monthly photography deliverable to `MarketingDeliverableService` is a future sprint. This sprint adds the GBP photo optimization plan as a one-time deliverable section.

4. **Vision-model-based photo classifier** — automatically classifying GBP photos as "storefront" vs "product" vs "team" via a vision model. Out of scope; `photo_types` is agent-classified or operator-supplied.

5. **BBB data source integration** — PB-04 (BBB crisis recovery) remains blocked on a BBB data source. This sprint does not address that gap.

6. **Multi-language outreach** — outreach openers in languages other than English (relevant for African grocery store owners whose first language may not be English). Future sprint.

7. **A4 hook/previews business-type variants** — A4's prompt hardcodes "online booking / scheduling" hooks and "booking flow" previews (verified: archetype-prompts.ts lines 260–285). A product business that lands on A4 (CTA gap without a catalog gap) still gets booking-framed language. The A6 preamble + A6 archetype cover the primary target niche; a business-type-conditional A4 variant is a future refinement. Documented limitation, not an oversight.

8. **Real preview artifacts at opener time** — "Three previews attached" is text-only for all archetypes (verified: no artifacts are generated at opener time; the quality gate enforces the phrase via regex). Generating actual preview artifacts before first touch is a separate initiative.

---

## 12. Success Criteria

1. **A product-business campaign (grocery store) with no website and no product catalog routes to A6/PB-07** — not A1 fallback or A4 "booking" framing.
1a. **Co-occurrence criterion (the v1.0 failure mode):** a grocery store with low review volume (<15 reviews, `RA_LOW_REVIEW_VOLUME` fires) AND a missing product catalog routes to **PB-07**, not PB-02 — verified by the §7.1 co-occurrence test and a staging triage run.
2. **The A6 opener references product discoverability, mobile catalog, and GBP photos** — not reviews, booking, or project photos.
3. **A6 deliverable sections include mobile_catalog_preview, gbp_photo_optimization, availability_inquiry_flow** — not recovery_playbook or cta_fixes.
4. **A service-business campaign (HVAC) with unanswered negative reviews routes to A2/PB-02** — unchanged from current behavior.
5. **All existing tests pass** — no regressions in A1–A5 selection, prompts, deliverables, or triage.
6. **Legacy audits (without new fields) validate and route correctly** — backward compatibility maintained.
7. **The seek audit prompt asks for business type, product browsing, availability inquiry, photo types, and holiday hours** — new fields are captured for new audits.
8. **`pnpm checkapi`, `pnpm checkweb`, and `pnpm build` all pass.**

---

## 13. Appendix — Signal Code Reference (Post-Sprint)

### 31 Known Signal Codes (was 24)

**Reputation & Administrative (RA) — 6 codes (unchanged):**
- `RA_BBB_GRADE_SUPPRESSION` — BBB Grade Suppression (C or below)
- `RA_UNANSWERED_COMPLAINTS` — Unanswered BBB Complaints
- `RA_REVIEW_DROUGHT` — Review Drought (>180 days)
- `RA_LOW_REVIEW_VOLUME` — Low Review Volume (<15 total)
- `RA_UNADDRESSED_NEGATIVE_BACKLOG` — Unaddressed Negative Review Backlog (≥3)
- `RA_UNADDRESSED_POSITIVE_BACKLOG` — Unaddressed Positive Review Backlog (≥5)

**Digital Surface & Profile (DS) — 8 codes (was 6, +2):**
- `DS_CLAIMED_STATUS` — Unclaimed GBP Profile
- `DS_MISSING_PROFILE` — Missing Platform Profile
- `DS_BROKEN_PROFILE_LINK` — Broken Profile Link
- `DS_MISSING_SERVICE_MENU` — Missing Service Menu *(service businesses)*
- `DS_MISSING_PRODUCT_CATALOG` — Missing Product Catalog *(product businesses)* **NEW**
- `DS_OUTDATED_HOURS` — Outdated Hours of Operation
- `DS_OUTDATED_HOLIDAY_HOURS` — Missing Holiday Hours *(product-relevant; any business with absent special hours)* **NEW**
- `DS_PHOTO_DEFICIT` — Photo Deficit (<5 photos service / <10 photos product)

**Website & Conversion (WC) — 9 codes (was 6, +3):** *(corrected in v1.1 — v1.0 said "8, +2" but added three WC codes)*
- `WC_MISSING_WEBSITE` — No Website Detected
- `WC_BROKEN_WEBSITE` — Broken Website (dead URL)
- `WC_URL_MISMATCH` — URL Mismatch (audit vs campaign)
- `WC_MISSING_CTA` — Missing Call-to-Action
- `WC_MISSING_SERVICE_PAGES` — Missing Service Pages *(service businesses)*
- `WC_MISSING_PRODUCT_BROWSING` — Missing Product Browsing *(product businesses)* **NEW**
- `WC_MISSING_AVAILABILITY_INQUIRY` — Missing Availability Inquiry **NEW**
- `WC_MISSING_PICKUP_DELIVERY` — Missing Pickup/Delivery Pathway **NEW**
- `WC_MOBILE_FRICTION` — Mobile Friction

**Cross-Platform Consistency (CP) — 4 codes (unchanged):**
- `CP_NAP_NAME_DRIFT` — NAP Name Drift
- `CP_NAP_ADDRESS_DRIFT` — NAP Address Drift
- `CP_NAP_PHONE_DRIFT` — NAP Phone Drift
- `CP_MISSING_CONTACT_INFO` — Missing Contact Info

**Content & Visual Proof (VP) — 4 codes (was 2, +2):**
- `VP_MISSING_PROJECT_PHOTOS` — Missing Project Photos *(service businesses)*
- `VP_STALE_SOCIAL_ACTIVITY` — Stale Social Activity
- `VP_MISSING_STOREFRONT_PHOTOS` — Missing Storefront Photos *(product businesses)* **NEW**
- `VP_MISSING_PRODUCT_PHOTOS` — Missing Product Photos *(product businesses)* **NEW**

### 7 Playbooks (was 6)

Corrected in v1.1 to match the production seed (`158_mkt_signal_registry.sql`) + this sprint's changes; v1.0's table had wrong names, archetypes, and ranks:

| Code | Name | Archetype | `priority_rank` | Business type |
|------|------|-----------|-----------------|---------------|
| PB-04 | Admin Neglect (BBB Recovery) | A2 | 1 | Universal |
| PB-05 | Multi-Signal Footprint Triage | A5 | 2 | Universal |
| PB-01 | Profile Repair & Listing Drift | A3 | 3 | Universal |
| PB-02 | Review Gap & Stagnation | A1 | 4 | Universal — `none` set extended with product codes **CHANGED** |
| PB-07 | Product Visibility & Catalog Refresh | A6 | 5 | Product **NEW** |
| PB-06 | Visual & Asset Refresh | A3 | 6 | Universal — renumbered from 5 **CHANGED** |
| PB-03 | Conversion & Surface Friction | A4 | 7 | Universal — renumbered from 6 **CHANGED** |

### 6 Archetypes (was 5)

| Code | Label | Fires on | Business type |
|------|-------|----------|---------------|
| A1 | REVIEW_GAP | Unanswered review rate ≥15% or >15 unanswered | Universal |
| A2 | NEGATIVE_RECOVERY | Recurring-theme negatives (≥3 reviews same theme) | Universal |
| A6 | PRODUCT_VISIBILITY_GAP | Missing product catalog/browsing (product/hybrid business) | Product **NEW** |
| A3 | LISTING_DRIFT | NAP inconsistency | Universal |
| A4 | CTA_GAP | Missing CTA/booking/click-to-call | Universal |
| A5 | DUAL_TRIAGE | Multi-signal footprint (emitted by triage engine only) | Universal |

---

## 14. Open Questions

1. **Should `DS_MISSING_SERVICE_MENU` and `DS_MISSING_PRODUCT_CATALOG` be mutually exclusive?** **Resolved (v1.1):** No — detection is business-type-agnostic (§5.1). `DS_MISSING_PRODUCT_CATALOG` fires on an explicit `has_product_browsing === false` assessment regardless of type; the only type-gated branch is the no-website case, which requires resolved type product/hybrid (service businesses with no website fire `WC_MISSING_WEBSITE` only). A hybrid business can legitimately fire both codes; the cascade sorts it out.

2. **Should A6 have a `direct_paid` close variant specific to product visibility?** The current `CLOSE_VARIANTS` are generic ("Full deliverable's ready..." / "The full deliverable's a paid engagement..."). These work for any archetype. **Recommendation:** No — keep the generic close variants. The close is about commercial intent, not about the specific deliverable.

3. **Should the photo deficit threshold be configurable per category, not just per business type?** A grocery store might need 20+ photos; a convenience store might need 10. **Recommendation:** Start with business-type-sensitive thresholds (service <5, product <10). Per-category configurability is a future enhancement via the signal registry's `derived_rule` JSON.

4. **Should PB-07's `matching_rules` include `WC_MISSING_PICKUP_DELIVERY` in the `any` set?** **Resolved (v1.1): Yes** — it's in the `any` set in migration 171 (§6), since missing pickup/delivery is product-visibility-adjacent and the PB-07 deliverable addresses it via the `fulfillment_pathway` section.

5. **Should A4 get a business-type-conditional hook variant (booking → availability-inquiry framing for product businesses)?** **Resolved (v1.1): Deferred** — added to Out of Scope (§11, item 7). A product business with a CTA gap but no catalog gap still gets A4's booking-framed hook this sprint; the preamble split softens but doesn't eliminate the mismatch. Revisit if A4-routed product businesses underperform in the Phase 3 campaign.
