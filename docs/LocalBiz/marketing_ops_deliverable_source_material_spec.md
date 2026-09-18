# Spec: Marketing Ops — Deliverable Source Material (Signal-Gated Analyst Handoff)

**Document Version:** 1.0
**Date:** 2026-09-18
**Status:** Draft — decisions resolved (Appendix B.4); ready for implementation
**Scope:** The 8 deliverable types exposed by the campaign Generate Deliverable modal
(`review_responses`, `service_menu`, `gbp_audit`, `testimonial_cards`, `nap_report`, `seo_content`, `lead_magnet`, `product_visibility_preview`)

**Prerequisites (all landed):**
- `MarketingDeliverableService` (templates, jsPDF generation, branding)
- Deliverable Construction layer (`apps/api/src/services/deliverable/` — OwnerVoice, BusinessContext, ReviewSlot, DeliverableSection, Assembly, Render)
- Playbook catalog + signal registry + triage engine (`mkt_playbook_catalog`, `mkt_signal_registry`, `SignalExtractor`, `TriageEngineService`)
- Business Audit V2 seek templates (`mpt-j9bbem3l`, `mpt-6oeuiizo`) emitting `detected_signals[]`

**Companion docs:**
- `docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md` (§2–9 — construction workflow)
- `docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md` (§5.5 — A6 product-visibility sections)
- `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md` (signal taxonomy + cascade)
- `docs/LocalBiz/marketing_ops_prompt_variable_injection_sprint_plan.md` (`resolvePrompt()` seam, output-schema registry)
- `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md` §28 (deliverable types by track)

---

## 1. Executive Summary

The Generate Deliverable modal lets an operator pick a deliverable type and generate a PDF. Today that PDF contains **whatever string the operator pastes into the "Content (optional)" textarea** — there is no source assembly. `MarketingDeliverableService.generateDeliverable()` takes a `content: string` and a layout spec; nothing produces that content from audit data.

Three of the eight modal types have a **fulfill prompt** that could produce their content (`Fulfill: Review Responses`, `Fulfill: Service Menu`, `Fulfill: GBP Optimization`). The other five (`testimonial_cards`, `nap_report`, `seo_content`, `lead_magnet`, `product_visibility_preview`) have no prompt at all — they exist only as enum labels, zod enum members, and `<option>` entries.

Meanwhile the platform already has a rich **signal pipeline** that is not wired to deliverables at all:

```
regular audit (business_analysis seek)
  └── emits detected_signals[]  ← RA_*/DS_*/WC_*/CP_*/VP_*/INT_* codes  ("A", "B")
        └── SignalExtractor.extractSignals()  →  SignalCode[]
              └── TriageEngineService  →  playbook (matching_rules DSL)  →  archetype  →  preview_deliverable_type
```

The audit already produces the signals. What is missing is the **consumer**: a post-audit prompt that reads the signal set and emits the structured source material that each deliverable type's fulfill prompt needs.

This spec adds:

1. **A new post-audit analyst prompt** — `Seek: Deliverable Source Material` — that consumes the audit + the extracted signal set and emits a `deliverable_source_material` object. It is **signal-gated**: it produces source material only for the deliverable types the fired signals indicate (A, or B, or both) — mirroring the additive `REPORT_EVIDENCE_DIRECTIVE` pattern.
2. **A new output schema** — `deliverable_source_material` — registered in `OUTPUT_SCHEMA_REGISTRY`.
3. **Five new fulfill prompts** — one per unbuilt type — each consuming its slice of the source material.
4. **A resolver service** (`DeliverableSourceService`) and a change to `MarketingDeliverableService.generateDeliverable()` so a type with no explicit `content` resolves its content from source material → fulfill prompt.
5. **Modal wiring** so the type dropdown is signal-aware (only offers types the audit supports) and "Generate PDF" runs the resolve → fulfill → render chain.
6. **A pattern-reuse + repetition guard** (§5.5) — the analyst may reuse the established content shapes (problem→solution pairs, pattern-interrupt hooks, archetype angles) but must not repeat the campaign's already-sent outreach phrasing, and no two source blocks may open the same way.
7. **Inherited value-prop framing** (§5.6) — every fix-implying deliverable carries the established seeding/claiming/validation motion ("claim your profile and we fix it"), including the one-capture-fixes-many-platforms promise, with claim/report links resolved through `outreach-link-vars.ts`.

No new tables. No new stage machine. No per-type content builders in TypeScript — content comes from prompts, per the design directive.

> **Final-pass gap analysis (Appendix B)** found one blocking issue — `business_analysis` emits no verbatim review text (G-1) — now **resolved by Option D**: a `Seek: Review Intake` prompt that parses operator-pasted reviews (§5.7). All Appendix B decisions are recorded in §B.4.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Problem Statement

### 2.1 The modal has no content source

`CampaignDetailClient.tsx` (Generate Deliverable modal, lines 2379–2483) posts `{ template_id, deliverable_type, is_preview, content }` to `POST /marketing-ops/:campaignId/deliverables/generate`. `content` is free-text. If empty, `MarketingDeliverableService.generateDeliverable()` falls back to `extractContentFromExecution(input.executionId)` — but **the modal never sends `execution_id`**, so the body renders the literal default-layout placeholder: *"Content will be populated from AI execution output."*

### 2.2 Only 3 of 8 types have a fulfill prompt

Live template inventory (`docs/api-response/seek-prompt-templates.md`, 31 templates):

| Deliverable type | Fulfill prompt | Notes |
|---|---|---|
| `review_responses` | `mpt-seed-fulfill-001` Fulfill: Review Responses | `output_schema: raw_json` |
| `service_menu` | `mpt-seed-fulfill-002` Fulfill: Service Menu | `output_schema: raw_json` |
| `gbp_audit` | `mpt-seed-fulfill-003` Fulfill: GBP Optimization | `output_schema: raw_json` |
| `testimonial_cards` | — | enum + dropdown only |
| `nap_report` | — | closest: `mpt-profile-repair-nap-drift-seek` (seek, not fulfill) |
| `seo_content` | — | closest: `Enrichment: * Market SEO` (page-level, not per-business) |
| `lead_magnet` | — | enum + dropdown only |
| `product_visibility_preview` | — | section builders only (`deliverable/prompts.ts`) |

### 2.3 Signals are produced but never consumed by deliverables

The audit emits `detected_signals[]` (`business_analysis` schema, `apps/api/src/validators/business-analysis.schema.ts:656`). `SignalExtractor` normalizes it to `SignalCode[]`. The triage engine maps signals → playbook → `preview_deliverable_type`. But **no deliverable code path reads the signal set.** `MarketingDeliverableService`, `DeliverableSectionService`, and `DeliverableRenderService` never call `SignalExtractor`.

### 2.4 Type vocabulary drift (pre-existing, in scope to reconcile)

`mkt_playbook_catalog.preview_deliverable_type` carries values that are **not members of the `DeliverableType` union**:

| Playbook | `preview_deliverable_type` | In `DeliverableType`? |
|---|---|---|
| PB-01 | `nap_report` | yes |
| PB-02 | `review_responses` | yes |
| PB-03 | `cta_audit` | **no** |
| PB-04 | `recovery_resolution` | yes |
| PB-05 | `footprint_audit` | **no** |
| PB-06 | `media_audit` | **no** |
| PB-07 | `product_visibility_preview` | yes |

Any code that trusts `preview_deliverable_type` to name a renderable type will fail for PB-03/PB-05/PB-06. This spec treats the signal→type mapping as authoritative and flags the playbook column for reconciliation (§11, OQ-2).

---

## 3. Architecture

### 3.1 The signal handoff

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. REGULAR AUDIT  (mpt-j9bbem3l / mpt-6oeuiizo / mpt-seed-seek-001)   │
│    prompt_type: seek · output_schema: business_analysis               │
│    emits: detected_signals[] = [RA_*, DS_*, WC_*, CP_*, VP_*, INT_*]  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  (A, B, … — model_emitted codes)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. SIGNAL EXTRACTION  (SignalExtractor.extractSignals)                │
│    3-tier precedence: model_emitted → derived → operator_input        │
│    emits: SignalCode[]  (the normalized, canonical set)               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. POST-AUDIT ANALYST  (NEW: mpt-deliverable-source-material)         │
│    prompt_type: seek · scope: business                                │
│    output_schema: deliverable_source_material                         │
│    consumes: audit_data + SignalCode[]                                │
│    emits: source material ONLY for signal-indicated types (A or B)    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4. FULFILL PROMPT  (one per deliverable type)                         │
│    consumes: its slice of deliverable_source_material + voice/context │
│    emits: the type's final copy (text/JSON)                           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 5. RENDER  (MarketingDeliverableService.generateDeliverable)          │
│    template layout_spec + fulfill output as `content` → branded PDF   │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Signal-gated emission (the core rule)

The post-audit prompt is **not** asked to produce all eight source blocks. It is asked to produce a source block **only for each deliverable type whose governing signal(s) are present in the supplied `SignalCode[]`**. A type with no governing signal is emitted as `null` (or omitted).

This keeps the prompt focused, bounds token usage, and prevents the model from inventing source material for a deliverable the business does not need — the same discipline as `REPORT_EVIDENCE_DIRECTIVE` (§6.1 of the report spec: "Emitted per candidate business, not once per discovery run").

**Signal → deliverable type mapping** (governing signals; a type is in scope if *any* governing signal fired):

| Deliverable type | Governing signal(s) | Playbook | Archetype |
|---|---|---|---|
| `review_responses` | `RA_UNADDRESSED_NEGATIVE_BACKLOG`, `RA_UNADDRESSED_POSITIVE_BACKLOG`, `RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME` | PB-02 | A1 |
| `service_menu` | `DS_MISSING_SERVICE_MENU`, `WC_MISSING_SERVICE_PAGES` | PB-03 | A4 |
| `gbp_audit` | `DS_CLAIMED_STATUS`, `DS_PHOTO_DEFICIT`, `DS_OUTDATED_HOURS`, `DS_OUTDATED_HOLIDAY_HOURS`, `DS_MISSING_PROFILE` | PB-03 / PB-06 | A4 / A3 |
| `testimonial_cards` | `RA_UNADDRESSED_POSITIVE_BACKLOG`, `VP_MISSING_STOREFRONT_PHOTOS`, `VP_MISSING_PROJECT_PHOTOS` | PB-06 | A3 |
| `nap_report` | `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT`, `WC_URL_MISMATCH`, `DS_BROKEN_PROFILE_LINK` | PB-01 | A3 |
| `seo_content` | `WC_MISSING_SERVICE_PAGES`, `WC_MISSING_WEBSITE`, `DS_MISSING_SERVICE_MENU` | PB-03 | A4 |
| `lead_magnet` | `WC_MISSING_CTA`, `WC_MOBILE_FRICTION`, `RA_LOW_REVIEW_VOLUME` | PB-03 | A4 |
| `product_visibility_preview` | `DS_MISSING_PRODUCT_CATALOG`, `WC_MISSING_PRODUCT_BROWSING`, `WC_MISSING_AVAILABILITY_INQUIRY`, `WC_MISSING_PICKUP_DELIVERY` | PB-07 | A6 |
| `recovery_resolution` (existing — **NOT emitted by this prompt**) | `RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS` | PB-04 | A2 |

> **Fallback rule:** when the campaign has **no** audit or **no** `detected_signals[]`, `SignalExtractor` runs its `derived` tier. If even that yields nothing (e.g. an audit-less campaign), the modal falls back to offering all eight types and the source-material prompt emits every block — the legacy behavior. This fallback is warn-logged.

### 3.3 Where the analyst prompt lives

Per design decision, the directive is **not** added to `business_analysis` (which must stay lean and is a shared schema). It is a **separate post-audit seek template**:

- `id`: `mpt-deliverable-source-material`
- `name`: `Seek: Deliverable Source Material`
- `prompt_type`: `seek`
- `scope`: `business`
- `output_schema`: `{ "name": "deliverable_source_material" }`
- `variables`: `["business_name", "city", "category", "detected_signals", "audit_results", "prior_outreach"]`

Two new out-of-scope variables (`detected_signals`, `audit_results`) plus `prior_outreach` are supplied by a variable-builder service — the `ProfileRepairPromptService` / `RecoveryResolutionService` pattern (`variables` override in `resolvePrompt()`), **not** by adding them to `SCOPE_VARIABLES.business` (they are audit/outreach-derived, not campaign-derived). `prior_outreach` carries the campaign's already-emitted opener/pitch hook for cross-surface de-duplication (§5.5). See §7.2.

---

## 4. Data Contracts

### 4.1 New output schema — `deliverable_source_material`

New validator: `apps/api/src/validators/deliverable-source-material.schema.ts`.

```ts
export const DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME = 'deliverable_source_material' as const;

export const deliverableSourceMaterialSchema = z.object({
  // The canonical signal set the analyst consumed. Echoed for provenance.
  signals_consumed: z.array(z.string()),

  // One nullable block per deliverable type. Populated ONLY when the type's
  // governing signal(s) are present in signals_consumed. Absent/null otherwise.
  deliverable_sources: z.object({
    review_responses: reviewResponseSourceSchema.nullable().optional(),
    service_menu: serviceMenuSourceSchema.nullable().optional(),
    gbp_audit: gbpAuditSourceSchema.nullable().optional(),
    testimonial_cards: testimonialCardsSourceSchema.nullable().optional(),
    nap_report: napReportSourceSchema.nullable().optional(),
    seo_content: seoContentSourceSchema.nullable().optional(),
    lead_magnet: leadMagnetSourceSchema.nullable().optional(),
    product_visibility_preview: productVisibilitySourceSchema.nullable().optional(),
  }),

  // Data-quality block, mirroring business_analysis.data_quality.
  data_quality: z.object({
    verified_fields: z.array(z.string()).optional(),
    unavailable_fields: z.array(z.string()).optional(),
    limitations: z.array(z.string()).optional(),
  }).passthrough(),
}).passthrough();
```

Each block shape (concise; full field lists in Appendix A):

```ts
// review_responses — per-review source rows, feeding ReviewSlotService
const reviewResponseSourceSchema = z.object({
  reviews: z.array(z.object({
    platform: z.string(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    text: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
    theme: z.string().nullable().optional(),
    is_negative_first: z.boolean().optional(),
  })).min(1),
});

// service_menu — the service catalog the menu is built from
const serviceMenuSourceSchema = z.object({
  services: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    evidence: z.string().nullable().optional(),
  })).min(1),
  pricing_tiers_present: z.boolean().nullable().optional(),
});

// gbp_audit — GBP profile completeness findings
const gbpAuditSourceSchema = z.object({
  claimed: z.boolean().nullable().optional(),
  primary_category: z.string().nullable().optional(),
  additional_categories: z.array(z.string()).optional(),
  photo_count: z.number().nullable().optional(),
  photo_types_present: z.array(z.string()).optional(),
  photo_types_missing: z.array(z.string()).optional(),
  hours_present: z.boolean().nullable().optional(),
  special_hours_present: z.boolean().nullable().optional(),
  profile_issues: z.array(z.string()).optional(),
  attributes_displayed: z.array(z.string()).optional(),
});

// testimonial_cards — quotable customer praise extracted from reviews
const testimonialCardsSourceSchema = z.object({
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
  })).min(1),
});

// nap_report — canonical vs. observed NAP per platform
const napReportSourceSchema = z.object({
  canonical: z.object({
    name: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  platform_status: z.array(z.object({
    platform: z.string(),
    name: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: z.string().nullable().optional(),   // consistent | drift | missing | unverified
  })),
  material_issues: z.array(z.string()).optional(),
});

// seo_content — per-service-page content briefs
const seoContentSourceSchema = z.object({
  service_pages: z.array(z.object({
    service: z.string(),
    target_terms: z.array(z.string()),
    differentiators: z.array(z.string()).optional(),
    local_context: z.string().nullable().optional(),
  })).min(1),
  public_narrative: z.string().nullable().optional(),
});

// lead_magnet — the conversion offer the magnet supports
const leadMagnetSourceSchema = z.object({
  offer: z.object({
    title: z.string(),
    promise: z.string(),
    audience: z.string().nullable().optional(),
  }),
  friction_points: z.array(z.string()).optional(),
  conversion_opportunities: z.array(z.string()).optional(),
});

// product_visibility_preview — catalog/browsing/fulfillment gaps (A6)
const productVisibilitySourceSchema = z.object({
  product_categories: z.array(z.string()).optional(),
  catalog_gaps: z.array(z.string()).optional(),
  browsing_gaps: z.array(z.string()).optional(),
  availability_inquiry_present: z.boolean().nullable().optional(),
  pickup_delivery_present: z.boolean().nullable().optional(),
  photo_types_missing: z.array(z.string()).optional(),
});
```

### 4.2 Registry entry

Add to `OUTPUT_SCHEMA_REGISTRY` in `apps/api/src/validators/market-analysis.schema.ts` (alongside `business_analysis`, `recovery_resolution`, etc.):

The registry is keyed by schema name and each entry carries three fields (`apps/api/src/validators/market-analysis.schema.ts:260-267`):

```ts
[DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME]: {
  validator: deliverableSourceMaterialSchema,
  // null — this is NOT an audit; it must not be written to mkt_audits_list.
  // Its output lives on the prompt execution. (Same rationale as
  // PROFILE_REPAIR_AUDIT_SCHEMA_NAME / CITATION_REPAIR_PACKAGE_SCHEMA_NAME.)
  auditPlatform: null,
  promptSuffix: DELIVERABLE_SOURCE_MATERIAL_PROMPT_SUFFIX,
},
```

### 4.3 Fulfill prompt output schemas

The three existing fulfill prompts use `raw_json` (permissive). The five new fulfill prompts SHOULD use `raw_json` for consistency, so `importExternalResult()` accepts them without a dedicated shape. If a type later needs validation, add a named schema.

---

## 5. Prompt Specs

### 5.1 NEW — `Seek: Deliverable Source Material`

```
You are assembling the source material for a small business's marketing deliverables.
You are given the business audit and the canonical signal set extracted from it.
Your job is to produce the raw material each deliverable type needs — NOT the finished
deliverable copy.

Business: {{business_name}}
City: {{city}}
Category: {{category}}

Signals detected (canonical set):
{{detected_signals}}

Audit results:
{{audit_results}}

Already sent to the owner — do NOT reuse this phrasing or rhetorical structure:
{{prior_outreach}}

TASK
For each deliverable type whose governing signal is present in the signal set above,
populate its source block in `deliverable_sources`. For every other type, set the
block to null.

Signal → deliverable type:
- review_responses          ← RA_UNADDRESSED_NEGATIVE_BACKLOG, RA_UNADDRESSED_POSITIVE_BACKLOG, RA_REVIEW_DROUGHT, RA_LOW_REVIEW_VOLUME
- service_menu              ← DS_MISSING_SERVICE_MENU, WC_MISSING_SERVICE_PAGES
- gbp_audit                 ← DS_CLAIMED_STATUS, DS_PHOTO_DEFICIT, DS_OUTDATED_HOURS, DS_OUTDATED_HOLIDAY_HOURS, DS_MISSING_PROFILE
- testimonial_cards         ← RA_UNADDRESSED_POSITIVE_BACKLOG, VP_MISSING_STOREFRONT_PHOTOS, VP_MISSING_PROJECT_PHOTOS
- nap_report                ← CP_NAP_NAME_DRIFT, CP_NAP_ADDRESS_DRIFT, CP_NAP_PHONE_DRIFT, WC_URL_MISMATCH, DS_BROKEN_PROFILE_LINK
- seo_content               ← WC_MISSING_SERVICE_PAGES, WC_MISSING_WEBSITE, DS_MISSING_SERVICE_MENU
- lead_magnet               ← WC_MISSING_CTA, WC_MOBILE_FRICTION, RA_LOW_REVIEW_VOLUME
- product_visibility_preview ← DS_MISSING_PRODUCT_CATALOG, WC_MISSING_PRODUCT_BROWSING, WC_MISSING_AVAILABILITY_INQUIRY, WC_MISSING_PICKUP_DELIVERY

TONE
<shared tone directive — composed by the prompt layer, NOT inlined here. See §5.4.>

RULES
- Ground every field in the supplied audit results. Do not invent services, reviews,
  testimonials, NAP values, or product categories that are not in the audit.
- Absence is not a negative. If a field is unavailable, mark it null — do not fabricate.
- For review_responses, include ONLY unanswered reviews. Mark the most severe negative
  review is_negative_first = true.
- For testimonial_cards, quote verbatim from positive reviews in the audit. Never
  paraphrase into a fabricated quote.
- Do not reuse the phrasing or rhetorical structure of any line in `prior_outreach` —
  the owner has already seen it. No two source blocks may open with the same sentence
  pattern (§5.5).
- Echo the signal set you actually used in `signals_consumed`.
- Return the JSON object only — no preamble, no markdown fences.

OUTPUT SCHEMA
<deliverable_source_material schema description appended by the prompt layer>
```

### 5.2 NEW fulfill prompts (5)

All follow the existing fulfill template conventions (declared `variables`, `output_schema: raw_json`, `is_default: false`, `is_active: true`). Bodies below are the operative directives; the rendered prompt is `body + RAW_JSON_PROMPT_SUFFIX`.

**`mpt-seed-fulfill-004` — Fulfill: Testimonial Cards** → `testimonial_cards`
- variables: `["business_name", "category", "city", "testimonials"]`
- body: produce N ready-to-publish testimonial cards, one per supplied testimonial. Each card: the verbatim quote (trimmed to ≤ 40 words without altering meaning), attribution line (author + platform + rating), and a one-line business tagline. No invented quotes. Output JSON: `{ "cards": [{ "quote", "attribution", "tagline" }] }`.

**`mpt-seed-fulfill-005` — Fulfill: NAP Consistency Report** → `nap_report`
- variables: `["business_name", "category", "city", "nap_status"]`
- body: produce a per-platform NAP consistency report. Header: the canonical record (name/address/phone). Then one row per platform: platform, observed values, status (consistent / drift / missing / unverified), and the exact correction to apply. Close with a prioritized correction checklist (highest-impact first) and the claim/submission URLs. Output JSON: `{ "canonical", "platform_rows": [...], "corrections": [...] }`.

**`mpt-seed-fulfill-006` — Fulfill: SEO Content Pack** → `seo_content`
- variables: `["business_name", "category", "city", "service_pages", "public_narrative"]`
- body: for each supplied service page brief, write a ready-to-publish page: H1, meta title (≤ 60 chars), meta description (≤ 155 chars), 150–250 word body grounded in the supplied differentiators and local context, and 3 internal-link suggestions. Reuse `public_narrative` where supplied. No keyword stuffing; no superlatives. Output JSON: `{ "pages": [...] }`.

**`mpt-seed-fulfill-007` — Fulfill: Lead Magnet** → `lead_magnet`
- variables: `["business_name", "category", "city", "offer", "friction_points"]`
- body: produce a lead-magnet document for the supplied offer: title, a 2-sentence promise, a short intake/checklist section that addresses each friction point, and a clear CTA with contact details. 1 page. Output JSON: `{ "title", "promise", "sections": [...], "cta" }`.

**`mpt-seed-fulfill-008` — Fulfill: Product Visibility Preview** → `product_visibility_preview`
- variables: `["business_name", "category", "city", "product_visibility"]`
- body: produce the product-visibility preview sections — mobile catalog structure, GBP photo shot list + captions, availability-inquiry flow, pickup/delivery pathway, and an hours/holiday-hours sync plan — each grounded in the supplied gaps. Reuse the A6 section prompt builders' intent (`deliverable/prompts.ts`) but render as a single deliverable body. Output JSON: `{ "sections": [{ "title", "content" }] }`.

Each fulfill body carries a `Tone:` placeholder line resolved to **Register B** (§5.4) at render time — owner-facing, plain-spoken, no hype. The three existing fulfill templates (`mpt-seed-fulfill-001/002/003`) receive Register B the same way, through the composer, so all eight types read in one voice — their seeded bodies are **not** edited (avoids a re-seed of `seed-marketing-ops-templates.ts`).

Each fulfill body also receives the resolved link variables (`claim_url`, `claim_short_url`, `report_url`) from `outreach-openers/outreach-link-vars.ts` so its closing CTA uses the claim-and-fix motion (§5.6). These are resolved per campaign's linked seed, never hand-built.

### 5.3 Prompt-layer composition

The post-audit prompt's schema description is appended by the prompt-composition layer, consistent with `RAW_JSON_PROMPT_SUFFIX` and the `business_analysis` schema-description convention (`BUSINESS_ANALYSIS_PROMPT_SUFFIX` in `business-analysis.schema.ts`). Add `DELIVERABLE_SOURCE_MATERIAL_PROMPT_SUFFIX` next to the schema.

### 5.4 Tone directives — mirror the established set, compose once

The analyst and fulfill prompts carry a tone directive that **mirrors the tone already established elsewhere in the prompt library** — they do not invent a new register. Two established registers exist, split by audience:

**Register A — internal analyst voice** (the post-audit prompt). Mirrors the outreach-problems directive used by the Business Audit V2 and Profile Repair prompts:

> Tone — warm, professional, helpful: write copy the operator can read aloud to the owner with a straight face and a smile. Never dry, never dull.

and the shared business-intelligence directive (`SHARED_BUSINESS_INTELLIGENCE_TONE_DIRECTIVE`, `apps/api/src/services/intelligence/report-directives.ts:20`):

> Write for a capable business owner or operator. Be clear, specific, useful, and forward-looking. The writing should feel intelligent and commercially aware, never dull, dry, bureaucratic, alarmist, or generic. … Do not shame the business. Do not imply that incomplete public information proves poor business quality. Do not convert an unavailable field into a negative finding.

**Register B — owner-facing deliverable copy** (the fulfill prompts). Mirrors the public/listing voice used by the enrichment prompts and `public_narrative`:

> Warm and professional — a knowledgeable local speaking to a neighbor. Welcoming and plain-spoken, never casual or promotional: no exclamation marks, no superlatives, no hype. Ground every claim in verified public information; do not invent details.

#### Composition rule (non-negotiable)

The directive text is defined **once** in `report-directives.ts` and never hand-copied — the seed script **imports** the constant and interpolates it into the body. This satisfies the shared-directive contract's purpose (no tone drift between surfaces) while keeping the seeded body self-contained for the copy-paste bridge and external-import execution modes.

Concretely:

- `DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE` (Register A) and `DELIVERABLE_FULFILL_TONE_DIRECTIVE` (Register B) live in `report-directives.ts` and are exported.
- `seed-deliverable-source-material-templates.ts` imports both and interpolates them into the seeded bodies — so the body text is generated from the single definition, not duplicated by hand.
- Bump `REPORT_DIRECTIVES_VERSION` on any text change so execution metadata identifies which directive version produced a run.
- Register A and Register B are **different** — the analyst must not write in the owner's marketing voice, and the fulfill prompts must not write internal analyst prose. Do not collapse them into one directive.
- **Implementation note:** an earlier draft specified a `TONE` placeholder composed at render time. That was changed to import-and-interpolate because `MarketingExecutionService.executeSingle` renders the seeded body directly; interpolating the constant achieves the same no-drift guarantee without patching the core execution service.

### 5.5 Reusable content patterns — reuse the shape, not the instance

The prompt library already carries several **content patterns** the analyst can draw on. They are shapes, not one-off copy, and the deliverable prompts should reuse them deliberately — while guarding against the repetition risk that comes from applying the same shape everywhere.

**Existing patterns (source of truth, do not re-invent):**

| Pattern | Where it lives | Shape |
|---|---|---|
| Problem → solution pair | `outreach_problems` field (`business-analysis.schema.ts:938`, `profile-repair-output.schema.ts`) | `problem` (business consequence, not technical label) · `regular` (plain line) · `hook` (same fact, **pattern-interrupt** delivery) · `solution` · `evidence` · `outreach_use` |
| Light-Score hook | `outreach-openers/hook-library.ts` (15 angles) | five beats: diagnostic hook → reassurance → bridge/quantified upside → audit offer → soft CTA |
| Archetype angle | `outreach-openers/archetype-prompts.ts` (A1–A6) | opener angle per archetype |
| Opener hook | `pitch.opener_hook` (triage + per-issue schemas) | 1–2 sentence verbatim opener |
| Emerging angle / signal magnitude | `outreach-openers/emerging-angle-map.ts`, `signal-magnitude.ts` | angle ranking by signal strength |

**Reuse rule:** the analyst and fulfill prompts MAY adopt these *shapes* (e.g. the problem→solution framing for `lead_magnet`, the pattern-interrupt hook for `seo_content` page openers, the five-beat structure for a testimonial card's tagline). They must not copy the campaign's *already-emitted instances*.

**Repetition guard (the risk this section exists to prevent):** the same campaign's outreach opener, pitch, and problem→solution pairs already used these shapes on the owner. If the deliverable repeats the same hook, the same problem phrasing, or the same rhetorical structure, the owner sees the same pitch twice and it reads as boilerplate. Three concrete guards:

1. **Cross-surface de-duplication input.** `DeliverableSourceService` supplies the campaign's already-emitted opener/pitch hook (and the `outreach_problems` `hook` lines) to the analyst as a `prior_outreach` variable. The analyst prompt is instructed: *do not reuse the phrasing or rhetorical structure of any line in `prior_outreach`; the owner has already seen it.*
2. **Intra-deliverable variety.** Across the eight source blocks and across sections within one deliverable, each must open with a distinct structure. Add a prompt rule: *no two source blocks or sections may open with the same sentence pattern.*
3. **Quality-gate extension.** Add a repetition check to the existing gates (`outreach-openers/quality-gate.ts`, `outreach-pitch/quality-gates.ts` pattern) that flags a deliverable body which repeats an opener hook verbatim or near-verbatim (normalized token overlap above a threshold). Surface as a warning, not a hard block — matching the openers workspace behavior.

> **Hint, not a mandate:** these patterns are candidates, not required sections. The analyst should reach for the pattern that fits the signal; forcing every deliverable type through the same problem→solution mold is exactly the repetition failure this section guards against.

### 5.6 Seeding / claiming / validation framing (develop-value-first)

The outreach prompts carry a **value-prop framing** that the deliverables must inherit — the deliverable is the artifact that proves the claim the opener made. The established directive (`seed-business-audit-v2-templates.ts:535`, mirrored in `seed-profile-repair-issue-briefings.ts:55` and `seed-profile-repair-triage-briefing.ts`):

> Frame every pair in the **develop-value-first** motion: the platform **seeds** the prospect's directory presence first and invites the owner to **claim** it. Problems land as *"we surfaced this on your listing,"* solutions as *"claim your profile and we fix it"* — never as *"buy an audit."* Do not assert a published listing exists unless the audit data shows one; the claim-and-fix framing works whether or not the seed is already live.

Supporting copy already in the library shows the register (`hook-library.ts:114`, `manual-play-templates.ts`):

> Good news — you're already listed in our directory, so most of the groundwork is done. You can verify and correct your info here: `{{claim_url}}`
>
> It shows where `{{business}}` appears across public sources. If anything looks off you can claim the listing and fix it yourself: `{{claim_short_url}}` (about two minutes, no cost).

**The one-capture-fixes-many-platforms value prop** (the user's profile-repair example): the information the owner captures **once** in our directory is the same canonical record used to correct their profiles on the other platforms. A `nap_report` or `citation_repair_package` deliverable states this explicitly — *"confirm your details once here, and we use that single record to fix Google, Yelp, and Facebook"* — because it is the core reason the deliverable is worth acting on.

**Rules for the analyst + fulfill prompts:**

1. **Carry the framing.** Every deliverable that implies a fix (`nap_report`, `gbp_audit`, `product_visibility_preview`, `citation_repair_package`, `service_menu`) closes on the claim-and-fix motion, not a purchase ask.
2. **Free / low-friction framing is truthful.** "Claim it and fix it yourself — about two minutes, no cost" is the established register for the self-serve path. Do not invent fees, tiers, or package names (§5.5's solution rule).
3. **Never assert a listing exists unless the audit shows one.** Same caveat as the directive — the framing works whether or not the seed is live.
4. **Resolve links through `outreach-link-vars.ts`, never hand-roll them.** The deliverable's claim/report URLs must come from `resolveClaimUrlForSeed` / `resolveClaimUrlForCampaign` / `buildOutreachLinkVars` (`outreach-openers/outreach-link-vars.ts`) so the `/place/claim` vs `/directory/claim` split cannot drift (the G7 regression that module exists to prevent).
5. **Mint when missing, degrade when impossible.** `DeliverableSourceService.ensureClaimUrl` resolves the campaign's linked seed; if no active token exists it **mints one** via `DirectoryPresenceSeedService.inviteSeed(seedId, 90, { actorType: 'system' })` — mirroring the §13.5 claim handoff in `SeedIntelligenceReportService`. It returns `null` when there is no linked seed or the seed is already claimed.
6. **Never leak `{{claim_url}}`.** The fulfill bodies reference a single `{{claim_cta}}` variable, resolved to either the link-bearing CTA or a link-less variant (`buildClaimCta`). A body therefore never renders a literal placeholder, whether or not a claim path resolves.
7. **Same framing, not the same words.** This is the framing counterpart to §5.5's de-dup rule: the deliverable keeps the claim-and-fix *motion* while avoiding the opener's exact *phrasing*.

### 5.7 NEW — `Seek: Review Intake` (operator-pasted reviews)

Resolves G-1 (§B.4, Option D). The audit does not emit verbatim review text, so the two review-bearing source blocks are populated from an operator-pasted intake rather than the audit. This reuses the existing **copy-paste bridge** execution mode — the operator pastes reviews from Google/Yelp/Facebook; the prompt parses and structures them.

- `id`: `mpt-review-intake`
- `name`: `Seek: Review Intake`
- `prompt_type`: `seek`
- `scope`: `business`
- `output_schema`: `{ "name": "review_intake" }`
- `variables`: `["business_name", "category", "city", "raw_reviews"]`

```
You are structuring raw customer reviews pasted by an operator so they can be used
to build a business's review-response and testimonial deliverables.

Business: {{business_name}} — a {{category}} business in {{city}}

Raw reviews (pasted verbatim from the source; may be messy, numbered, or partially
formatted):
{{raw_reviews}}

TASK
Parse each review into a structured row and classify it.

RULES
- Preserve the review text verbatim — do not paraphrase, correct, or summarize. Trim
  trailing whitespace only.
- Infer platform (google | yelp | facebook | other), rating (1–5 or null), date
  (ISO or null), and author (name or null) where the pasted text shows them. If a
  field is not present, use null — do not guess.
- sentiment: positive (4–5), neutral (3), negative (1–2); null when rating is unknown.
- is_negative_first: true for exactly the most severe negative review (lowest rating,
  most recent as tiebreak); false otherwise.
- answered: true if the pasted text includes an existing owner response; carry that
  response text in `owner_response`.
- testimonials: select reviews with sentiment = positive and a substantive quote
  (≥ 12 words). Quote verbatim; never fabricate.
- Return the JSON object only — no preamble, no markdown fences.

OUTPUT SCHEMA
<review_intake schema description appended by the prompt layer>
```

Output schema `review_intake` (new validator `review-intake.schema.ts`):

```ts
export const REVIEW_INTAKE_SCHEMA_NAME = 'review_intake' as const;
export const reviewIntakeSchema = z.object({
  reviews: z.array(z.object({
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    text: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
    is_negative_first: z.boolean().optional(),
    answered: z.boolean().optional(),
    owner_response: z.string().nullable().optional(),
  })),
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
  })).optional(),
}).passthrough();
```

**Wiring:** `DeliverableSourceService` populates `deliverable_sources.review_responses` from `review_intake.reviews` (unanswered only) and `deliverable_sources.testimonial_cards` from `review_intake.testimonials`. The source-material prompt receives the intake output as an additional variable (`review_intake`) and copies those two blocks through rather than deriving them from the audit. When no intake has run, both blocks are `null` and the modal shows the **Paste reviews** affordance.

---

## 6. Seed & Migration

### 6.1 Migration

**No schema migration.** This work adds prompt-template **data** only — no tables, columns, indexes, or CHECK constraints change. The authoritative source is the seed script (§6.2); inlining the bodies into a numbered `.sql` file would duplicate them and reintroduce the drift the seed script exists to prevent. (Contrast migration 130, which was the initial bootstrap of the default template set; subsequent template changes in this repo are seed-script-only.)

If a future change to this feature adds a column or table, ship it as `300_*.sql` (next free number — current max is 299) and run it tandem local + prd per the AGENTS.md migration SOP.

### 6.2 Seed script

`apps/api/src/scripts/seed-deliverable-source-material-templates.ts` — mirrors `seed-marketing-ops-templates.ts` (deterministic IDs, update-in-place, `SEED_VERSION_MARKER` for body re-sync).

**Re-run discipline (AGENTS.md):** after editing the seed file, re-run against **both** configs or the DB row stays stale:

```powershell
# from apps/api
doppler run --config local -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts
doppler run --config prd   -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts
```

**Verify:** query `mkt_prompt_templates_list` for the six IDs and confirm `updated_at` is newer than the seed file's last commit.

### 6.3 Register the schema before seeding

The seed sets `output_schema.name = 'deliverable_source_material'`. `importExternalResult()` / AI-completion validation resolves the schema via `OUTPUT_SCHEMA_REGISTRY`; an unregistered name returns `null` and validation is skipped or throws (the §2.6 failure mode in the variable-injection spec). **Register the schema (§4.2) before seeding**, and ship the schema + seed in the same change.

---

## 7. Service Layer

### 7.1 New — `DeliverableSourceService`

`apps/api/src/services/deliverable/DeliverableSourceService.ts`

```ts
class DeliverableSourceService extends BaseService {
  /** Resolve which deliverable types the campaign's signals support. */
  async resolveEligibleTypes(campaignId, ctx): Promise<{
    types: DeliverableType[];
    signals: SignalCode[];
    source: 'model_emitted' | 'derived' | 'fallback';
  }>;

  /** Run the post-audit analyst prompt (idempotent by audit + signal hash). */
  async generateSourceMaterial(campaignId, ctx): Promise<DeliverableSourceMaterial>;

  /** Read cached source material from the latest source-material execution. */
  async getSourceMaterial(campaignId, ctx): Promise<DeliverableSourceMaterial | null>;

  /** Resolve the source block for a single deliverable type (null if not eligible). */
  async getTypeSource(campaignId, type, ctx): Promise<unknown | null>;
}
```

- `resolveEligibleTypes` calls `SignalExtractor.extractSignals({ campaign, auditData })` and applies the §3.2 mapping table. It is the single source of truth for "which types does this business need".
- `generateSourceMaterial` builds `detected_signals` (label + code lines) and `audit_results` (structured Markdown via a `serializeAuditResults()` formatter — the §2.10 pattern from the variable-injection spec, **not** a raw JSON dump), passes them through the `variables` override to `resolvePrompt()`, and executes the seek template.
- Idempotency: key on `evidence_snapshot_hash` = hash(audit id + signal set), stored in `mkt_prompt_executions_list.variables_used` JSONB (the table has no metadata column — `128_marketing_ops.sql:194`). Re-running with the same audit + signals returns the cached output. Because the schema's `auditPlatform` is `null`, no `mkt_audits_list` row is written — the output is read back from the execution's `raw_output` / `filtered_output` (G-9).
- **Post-normalization (G-10):** after parsing, deterministically null out any `deliverable_sources.<type>` block whose governing signal is absent from `resolveEligibleTypes()`. Do not trust the model to self-gate.

### 7.2 Variable sourcing

`detected_signals`, `audit_results`, and `prior_outreach` are **not** added to `SCOPE_VARIABLES.business` — they are audit/outreach-derived and supplied via the `variables` override (the `ProfileRepairPromptService` pattern). `DeliverableSourceService` is the builder; `renderTemplate()`, `renderPromptText()`, and `importExternalResult()` must all receive identical variables so the three execution modes (direct API / copy-paste bridge / external import) produce the same prompt.

`prior_outreach` is assembled from the campaign's already-emitted outreach artifacts:

- latest opener text — `mkt_outreach_openers_list.opener_text` (order by `executed_at DESC`);
- accepted triage pitch — `mkt_campaigns_list.repair_triage_briefing` JSONB (migration 232) → `pitch.opener_hook` + `outreach_problems[].hook`;
- per-issue briefings — the per-issue seek execution's `pitch.opener_hook` + `outreach_problems[].hook`.

Concatenate as labeled lines. When none exist (a campaign that never sent outreach), pass an empty string; the de-dup rule then has nothing to guard against (§5.5).

### 7.3 Change — `MarketingDeliverableService.generateDeliverable()`

Today: `content = input.content || extractContentFromExecution(input.executionId)`.

New resolution order (only when `input.content` is empty):

```
1. input.content                      (operator-supplied — unchanged, highest priority)
2. DeliverableSourceService.getTypeSource(campaignId, deliverableType)
       → run the type's fulfill prompt with the source block as a variable
       → fulfill output (text/JSON) becomes the deliverable content
3. extractContentFromExecution(executionId)   (legacy fallback — unchanged)
4. default layout placeholder text            (unchanged)
```

This is additive: existing callers passing `content` are unaffected. A new `sourceResolution` field is stamped into `branding_applied` on the deliverable row for provenance (`{ source: 'fulfill_prompt', promptTemplateId, sourceMaterialExecutionId }`).

**Two constraints on this change:**

- **G-15 — layering.** Do not run fulfill prompts *inside* `MarketingDeliverableService` (it is imported by `deliverable/*`). `DeliverableSourceService` resolves the content and passes it as `content`; `generateDeliverable` stays prompt-agnostic. The resolution order above is executed by the caller (route/service layer), not the base service.
- **G-4 — `review_responses` delegates to the construction workflow.** For `review_responses`, do **not** use the generic source-material → fulfill path. Route it to the existing `ReviewSlotService` + owner-voice flow (the modal's type selection opens/links the deliverable workspace instead of rendering directly). The source-material `review_responses` block is only a fallback when no owner voice is available — and it must then inject the voice profile defaults (`OwnerVoiceService.toVoiceFields`).

### 7.4 Quality gate

Reuse the existing review-response quality-gate pattern for `review_responses`. For the other seven types, run a lightweight gate (no invented facts; no pricing unless in source; length bounds) and store `quality_gate_passed` / `quality_gate_issues` on the fulfill execution. Do not block render on the gate — surface warnings to the operator (matching the openers workspace behavior).

---

## 8. API Surface

```
# Deliverable source material
GET    /deliverable/:campaignId/source-material          — cached source material (or null)
POST   /deliverable/:campaignId/source-material/generate — run the post-audit analyst prompt
GET    /deliverable/:campaignId/eligible-types           — signal-derived type list + signals

# Existing (unchanged, now source-aware server-side)
POST   /:campaignId/deliverables/generate                — resolves content when `content` omitted
```

`POST /:campaignId/deliverables/generate` keeps its current request shape. Its `deliverable_type` zod enum already includes the 8 modal types (`marketing-ops.ts` lines 1025/1038/3518). No request-shape change is required — only the service resolution path changes.

**G-6 — server-side eligibility check.** The route must reject a `deliverable_type` outside `resolveEligibleTypes()` with a 400 `type_not_eligible` (listing the fired signals and the eligible set), unless an explicit `allow_override: true` is passed by a platform-staff caller. Without this, the client dropdown is the only gate.

**G-7 — trigger policy.** `source-material/generate` is synchronous (interactive, mirrors the triage precedent). Additionally, `DeliverableSourceService.generateSourceMaterial()` runs automatically at the end of the audit import (best-effort, non-blocking) so the first Generate is cache-warm. Modal open reads the cached result; a missing cache shows the "will run on Generate" state.

---

## 9. Frontend

### 9.1 Modal changes (`CampaignDetailClient.tsx`, Generate Deliverable modal)

1. On open, `GET /deliverable/:campaignId/eligible-types`. Render the type dropdown from the response, with each option annotated by its governing signal(s). When `source === 'fallback'`, render all eight (current behavior).
2. Show a source-material status line: *"Source material ready"* / *"Not generated — will run on Generate"* with a **Generate Source Material** button (`POST .../source-material/generate`).
3. Change the content textarea label to **"Content (optional — overrides source material)"**. Its placeholder currently says "Leave empty to use execution output" (§2.1) — correct it.
4. "Generate PDF" keeps its current call; the server now resolves content from source material when the textarea is empty.

### 9.2 Types dropdown reconciliation

The modal's hardcoded `<option>` list (lines 2414–2421) currently omits `recovery_resolution`, `reinstatement_appeal`, `citation_repair_package` — correct, since those are profile-repair types with their own workflow. Once signal-driven, the dropdown is data-driven and the hardcoded list is removed.

---

## 10. Testing

- **Schema tests** — `deliverableSourceMaterialSchema` parses each block; rejects a block missing required fields; accepts null blocks.
- **Signal-gating tests** — fixture audits with: only RA signals → only `review_responses` populated; only CP signals → only `nap_report`; A6 signals → only `product_visibility_preview`; no signals → derived tier; no audit → fallback (all types).
- **Eligibility mapping tests** — `resolveEligibleTypes` returns the exact §3.2 sets; assert `preview_deliverable_type` is NOT trusted for PB-03/05/06.
- **Fulfill prompt render tests** — each new template renders with its declared variables and no unresolved `{{...}}` tokens (the `renderTemplate` out-of-scope detector must not suppress them via the override path).
- **Tone composition tests (§5.4)** — the analyst prompt body contains Register A and each fulfill body contains Register B; the directive text is imported from `report-directives.ts` (assert the seeded body matches the exported constant, i.e. no hand-copied drift); `REPORT_DIRECTIVES_VERSION` is bumped when directive text changes.
- **Repetition-guard tests (§5.5)** — `prior_outreach` is populated from the latest opener + pitch hook when they exist, empty otherwise; a deliverable body that repeats the opener hook verbatim is flagged by the extended quality gate; two source blocks opening with the same sentence pattern are flagged.
- **Framing tests (§5.6)** — deliverable bodies for the fix-implying types carry the claim-and-fix CTA (not a purchase ask); the claim/report URLs resolve through `outreach-link-vars.ts` and match the canonical `/place/claim` path; no body asserts a published listing when the audit has none.
- **Resolution-order test** — `generateDeliverable` with `content` set ignores source material; with `content` empty uses the fulfill output; with no source material falls back to the placeholder.
- **Idempotency test** — two `generateSourceMaterial` calls with the same audit + signals produce one execution (hash match).
- **Seed verification** — the six template IDs exist with the expected `output_schema` after seeding; `updated_at` newer than the seed file commit (AGENTS.md discipline).
- **Registry test** — `resolveOutputSchema('deliverable_source_material')` is non-null (guards the §6.3 crash).

---

## 11. Open Questions

- **OQ-1 — `seo_content` vs. `Enrichment: * Market SEO`.** The existing enrichment prompts produce page-level SEO for directory category/location pages, not per-business service pages. Confirm `seo_content` here is a distinct per-business deliverable (this spec assumes yes).
- **OQ-2 — `preview_deliverable_type` reconciliation (§2.4).** PB-03/PB-05/PB-06 carry `cta_audit`/`footprint_audit`/`media_audit`, which are not `DeliverableType` members. Options: (a) add them to the union, (b) remap the playbook column to the nearest valid type, (c) leave and never trust the column. This spec assumes (c) + a follow-up.
- **OQ-3 — Multi-type generation.** Should the modal allow generating several eligible types in one action (batch), or one at a time? This spec assumes one at a time; batch is a v1.1 candidate.
- **OQ-4 — Source-material staleness.** When the audit is re-run, is cached source material invalidated automatically or on next Generate? This spec assumes the hash covers it (new audit → new hash → regenerate).
- **OQ-5 — Review-text source (G-1).** Blocking. See **Appendix B.4** — a decision is required before implementation: extend `business_analysis` to emit verbatim review text (recommended), have the post-audit prompt research it, or drop the two review-bearing types from the generic path.

---

## 12. Sprint Tasks

1. `deliverable-source-material.schema.ts` — Zod schemas + `DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME` + prompt suffix.
2. Register the schema in `OUTPUT_SCHEMA_REGISTRY`.
3. `DeliverableSourceService` — eligibility resolution, source-material generation, idempotency, `serializeAuditResults()`.
4. Author the 5 new fulfill prompt bodies + the post-audit analyst prompt body.
5. Add `DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE` (Register A) + `DELIVERABLE_FULFILL_TONE_DIRECTIVE` (Register B) to `report-directives.ts`, compose them in the deliverable-source/fulfill render path, and bump `REPORT_DIRECTIVES_VERSION` (§5.4).
6. Seed script only — **no migration** (data-only change; §6.1).
7. `seed-deliverable-source-material-templates.ts` + `package.json` script entry.
8. Extend `MarketingDeliverableService.generateDeliverable()` resolution order + provenance stamp.
9. Routes: `source-material`, `source-material/generate`, `eligible-types`.
10. `MarketingOpsService.ts` frontend methods.
11. Modal wiring (data-driven dropdown, source-material status, textarea relabel).
12. Quality gate for the 7 non-review types.
13. Repetition guard (§5.5): `prior_outreach` builder, analyst de-dup rule, quality-gate extension.
14. Seeding/claiming/validation framing (§5.6): claim-and-fix CTA in fix-implying types, link variables resolved via `outreach-link-vars.ts`.
15. Tests (§10) + `pnpm checkapi` + `pnpm checkweb`.
16. Re-run seed against `local` + `prd`; verify `updated_at`.

**Gap-closure tasks (from Appendix B) — sequence these first:**

0a. **G-1 (Option D)** — `Seek: Review Intake` prompt + `review_intake` schema (§5.7); wire the two review-bearing blocks from intake. Log the latent `ReviewSlotService` bug (G-1b) as a separate follow-up.
0b. **G-4 (Option A)** — route `review_responses` to the Deliverable Construction workspace, not the generic path.
0c. **G-6 (Option B)** — server-side eligibility check on `POST /:campaignId/deliverables/generate` with staff `allow_override`.
0d. **G-7** — trigger policy: synchronous endpoint + best-effort run at audit import.
0e. **G-10** — deterministic post-normalization of ineligible source blocks.
0f. **G-3** — `nap_report` non-Google rows from `nap_consistency` variations.
0g. **G-12/G-13** — signal-family filter on `signals_consumed`; business-scope-only with audit-aware degradation (no audit → report unavailable blocks, don't fail).

### 12.1 Implementation status (2026-09-18)

| # | Task | Status | Artifact |
|---|---|---|---|
| 1 | Schemas + prompt suffixes | ✅ | `apps/api/src/validators/deliverable-source-material.schema.ts`, `review-intake.schema.ts` |
| 2 | Registry registration | ✅ | `market-analysis.schema.ts` (`auditPlatform: null` for both) |
| 3 | `DeliverableSourceService` | ✅ | `apps/api/src/services/deliverable/DeliverableSourceService.ts` |
| 4 | Prompt bodies (7) | ✅ | `apps/api/src/scripts/seed-deliverable-source-material-templates.ts` |
| 5 | Tone directives (Register A/B) | ✅ | `apps/api/src/services/intelligence/report-directives.ts` (v2) |
| 6 | Seed script (no migration) | ✅ | same as #4 |
| 7 | `generateDeliverable` resolution | ✅ | resolved in the route, not the base service (G-15) |
| 8 | Routes | ✅ | `marketing-ops.ts` — `eligible-types`, `source-material`, `source-material/generate`, `review-intake`; eligibility check on `deliverables/generate` |
| 9 | Frontend service methods | ✅ | `MarketingOpsService.ts` |
| 10 | Modal wiring | ✅ | `CampaignDetailClient.tsx` (status panel, data-driven types, paste-reviews, relabel) |
| 11 | Quality gate for 7 non-review types | ✅ | `services/deliverable/deliverable-quality-gate.ts` — wired into `resolveDeliverableContent`, surfaced as `warnings` on the generate response |
| 12 | Repetition guard | ✅ | `runRepetitionGate` + `prior_outreach` builder + prompt rule |
| 13 | Seeding/claiming framing | ✅ | `claim_url`/`claim_short_url`/`report_url` resolved via `outreach-link-vars.ts` and passed to fulfill prompts; Register B carries the claim-and-fix rule |
| 14 | Tests | ✅ | 24 passing (3 files) |
| 15 | `pnpm checkapi` / `checkweb` | ✅ | both clean |
| 16 | Re-run seed local + prd | ✅ | V2 seeded — 7 updated on both `local` and `prd` (2026-09-18) |
| 17 | Align `fulfill-001..003` with Register B + CTA | ✅ | `seed-marketing-ops-templates.ts` — Register B tone + claim-and-fix CTA + `claim_url` on review_responses / service_menu / gbp_audit. **Re-seed required** (`seed-marketing-ops-templates.ts`, local + prd) |

**Deferred / follow-up (not blocking):**
- G-1b — latent `ReviewSlotService` bug (reads `platforms[*].reviews[]`, which the schema never emits). Out of scope per Option D; log separately.
- G-7 — best-effort source-material run at audit import (currently synchronous endpoint only).
- G-11 — no migration (data-only); `300_*.sql` reserved for a future schema change.
- G-14/G-19 — `lead_magnet` source thinness; see §11.

### 12.2 G-8 — Per-type layout templates (2026-09-18)

`seed-deliverable-layout-templates.ts` seeds 8 default `layout_spec` rows into `mkt_deliverable_templates_list` (one per modal type, `is_default = true`), so the modal's Template dropdown has a designed layout instead of `getDefaultLayoutSpec()` (heading + body).

**Layout contract:** `renderLayoutSections` renders a `body` section's explicit `text` when present, otherwise the full generated content. Therefore each spec has **exactly one text-less `body` section**; every other section carries explicit text. Each layout is: heading → subheading → divider → **body (generated content)** → spacing → divider → subheading ("Next step") → body (claim-and-fix CTA).

**Modal changes:** the Template dropdown is now filtered to the selected deliverable type, and the type's `is_default` template is auto-selected on open. This also fixes the pre-existing wart where every active template (all types) appeared in the dropdown.

Run `seed-deliverable-layout-templates.ts` on `local` + `prd` to populate the templates.

### 12.3 Claim-link mint + `claim_cta` (2026-09-18)

`claim_url` is **not** operator-supplied — it is derived server-side, and now minted on demand:

- `DeliverableSourceService.ensureClaimUrl(campaignId)` → `resolveCampaignSeedId` → `resolveClaimUrlForSeed`. If that yields nothing and the seed is unclaimed, it mints via `DirectoryPresenceSeedService.inviteSeed(seedId, 90, { actorType: 'system' })` (same pattern as `SeedIntelligenceReportService` §13.5), then re-resolves. Returns `null` for no linked seed / already claimed. Best-effort, never throws.
- Side effect to know: `inviteSeed` flips `directory_presence_seeds.status = 'invited'`. Funnel analytics do **not** count a bare token as an invite (delivery evidence is still required), so this does not inflate the funnel — but it is a real state change.
- The fulfill bodies now use a single **`{{claim_cta}}`** variable (`buildClaimCta`), so a body renders either the link-bearing CTA or a link-less variant — never a literal `{{claim_url}}`. SEED_VERSION_MARKER bumped to **V3** in `seed-deliverable-source-material-templates.ts`; re-seed both scripts.

**Still open:** the prompt workspace and external-import paths for `fulfill-001/002/003` do not resolve `claim_cta`, so those render the placeholder. Fix is to route their variable builder through `buildClaimCta` too.

---

## Appendix A — Full source block shapes

See `deliverable-source-material.schema.ts` (§4.1) for the authoritative definitions. Field lists are aligned to the `business_analysis` fields each block is derived from — **but note G-1/G-3 in Appendix B: two blocks have no source today.**

| Block | Derived from | Source present? |
|---|---|---|
| `review_responses` | `unanswered_negative_review_examples` (summary only), `negative_review_themes`, `combined_review_metrics` | ⚠ **No verbatim review text — G-1** |
| `service_menu` | `recommended_services`, `platforms.google.attributes` | ✅ |
| `gbp_audit` | `platforms.google` (claimed, categories, `photo_count`, `photo_types`, `special_hours_present`, `profile_issues`) | ✅ |
| `testimonial_cards` | — | ⚠ **No positive review text — G-1** |
| `nap_report` | `nap_consistency` (canonical + variations + `material_issues`); `platforms.google.displayed_*` | ⚠ **Non-Google observed NAP absent — G-3** |
| `seo_content` | `website` (issues, `conversion_opportunities`, `product_categories_visible`), `public_narrative`, `recommended_services` | ✅ |
| `lead_magnet` | `website.conversion_opportunities`, `digital_opportunity_score`, `market_opportunities` | ⚠ Thin — G-19 |
| `product_visibility_preview` | `business_type`, `website` product fields, `platforms.google.photo_types`, `gap_analysis` | ✅ |

---

## Appendix B — Gap Analysis (final pass)

Adversarial review of this spec against the codebase, run 2026-09-18. Each gap: what is wrong, evidence, and resolution.

### B.1 Blocking — data-source gaps

**G-1 — `business_analysis` carries no verbatim review text.**
`platformSchema` (`business-analysis.schema.ts:309`) emits counts only (`total_reviews`, `observable_unanswered_*`). Review *text* appears nowhere: `reviewExampleSchema` (line 413) carries `complaint_summary` (a summary), and `reviewThemeSchema` (line 422) carries `summary`. There is **no `reviews[]` array and no `review_text` field**.
Consequences: (a) `reviewResponseSourceSchema.reviews[].text` and `testimonialCardsSourceSchema.testimonials[].quote` have **no source**; (b) the pre-existing `ReviewSlotService.extractUnansweredReviews` (`ReviewSlotService.ts:374-398`) reads `auditData.platforms[*].reviews[]`, which the schema never emits — it survives only via `.passthrough()`, so in practice the construction workflow likely throws *"No unanswered reviews found in audit data."*
**Resolution (needs decision — see §B.4):** either extend the audit to emit verbatim review text, or have the post-audit prompt research it, or route review-bearing types through a different source.

**G-2 — the post-audit prompt has no browsing.**
It executes via `aiProviderFactory.generateChatCompletion` (chat completion — no web access), so it can consume **only** what the audit already emitted. This compounds G-1: it cannot fetch review text the audit omitted. Any source block whose data is not in `audit_data` is ungroundable.

**G-3 — `nap_report` per-platform observed NAP is Google-only.**
`displayed_name` / `displayed_address` / `displayed_phone` exist only on `googlePlatformSchema` (line 332). Yelp/Facebook/BBB platform objects have no displayed NAP fields. The source block's `platform_status[]` rows for non-Google platforms have no source.
**Resolution:** derive non-Google rows from `nap_consistency.*_variations` (which are cross-platform observations) rather than per-platform displayed fields; or restrict the report to Google + canonical.

### B.2 High — design gaps

**G-4 — `review_responses` has two producers.**
The construction workflow (`ReviewSlotService` + owner-voice calibration) and the new source-material → fulfill path both produce `review_responses`. The modal path would **bypass owner-voice calibration**. §7.3 does not say which wins.
**Resolution:** the modal's `review_responses` must delegate to the construction workflow (or the source-material path must inject the owner voice profile). Add an explicit rule.

**G-5 — `recovery_resolution` inconsistency.** §3.2 listed it in the mapping; §5.1's prompt mapping omits it. Fixed inline (annotated as not emitted by this prompt), but the §3.2 table and prompt must stay in sync.

**G-6 — no server-side eligibility enforcement.** The client posts `deliverable_type`; nothing validates it against the signal-derived eligible set. A crafted request could generate a type whose signals never fired.
**Resolution:** `POST /:campaignId/deliverables/generate` validates `deliverable_type ∈ resolveEligibleTypes()`, or explicitly documents operator override.

**G-7 — trigger policy undefined.** When does the post-audit prompt run — modal open, on Generate, or automatically after the audit? Synchronous (added latency on first Generate) vs. async (polling)? Not specified.
**Resolution:** mirror the triage precedent (synchronous for interactive) with a cached result; run automatically post-audit and on first Generate.

**G-8 — no `layout_spec` / templates for the new types.** Even with content, `getDefaultLayoutSpec` renders heading + body (2 sections). No per-type layout template is seeded. Functionally OK; note it as a known limitation.

**G-9 — source-material persistence unspecified.** `auditPlatform: null` → no `mkt_audits_list` row. The output lives on `mkt_prompt_executions_list.raw_output` / `filtered_output`; the idempotency hash goes in `variables_used` JSONB (the table has no metadata column — `128_marketing_ops.sql:194`). Make this explicit in §7.1.

**G-10 — the model may emit ineligible blocks.** Nothing nulls out a block whose governing signal is absent. Add a deterministic post-normalization step (don't trust the model).

### B.3 Medium / Low

- **G-11 — migration number.** Pinned to **300** (max existing is 299). ✅ fixed inline.
- **G-12 — signal families.** The mapping does not state which families the analyst consumes. `OX_*` (outreach state) is not deliverable-relevant and should be excluded from `signals_consumed`; `INT_*` (category intelligence) may be included. State the filter.
- **G-13 — scope compatibility.** The post-audit template is `scope='business'`; `assertScopeCompatible` rejects `category`/`city`/`intelligence` campaigns. Confirm deliverables are business-scope only.
- **G-14 — `prior_outreach` field names.** `mkt_outreach_openers_list.opener_text` (not `body`); triage pitch in `mkt_campaigns_list.repair_triage_briefing` JSONB (migration 232). ✅ fixed inline.
- **G-15 — dependency direction.** Executing fulfill prompts *inside* `MarketingDeliverableService` risks layering trouble — it is imported by `deliverable/*`. Prefer resolving content in `DeliverableSourceService` and passing `content` to `generateDeliverable` (keeps the base service prompt-agnostic).
- **G-16 — zod enum vs. union.** `DeliverableType` union has 11 values; the zod enums (`marketing-ops.ts:1025/1038/3518`) have 8 (`recovery_resolution`, `reinstatement_appeal`, `citation_repair_package` are absent). Pre-existing; note so the eligibility endpoint doesn't advertise un-postable types.
- **G-17 — no cost/latency budget** for the extra AI call per campaign.
- **G-18 — Appendix A testimonial source was wrong** ("positive reviews in `unanswered_negative_review_examples`" — that field is negative-only and summary-only). ✅ fixed inline.
- **G-19 — `lead_magnet` source is thin** (`conversion_opportunities` + `digital_opportunity_score`). May be too weak to ground a magnet without the website's actual content.

### B.4 Decision required — RESOLVED

**G-1 is the one that can sink the sprint.** The post-audit prompt cannot ground `review_responses` or `testimonial_cards` from the current audit output.

**DECISION (2026-09-18): Option D — operator-pasted review intake.** Review data is simple and does not need audit-side research. Add a dedicated **Review Intake analyst prompt** (`Seek: Review Intake`) that accepts reviews **pasted from the source** (Google/Yelp/Facebook) and parses them into the structured `review_responses` / `testimonial_cards` source blocks per the same directives. This reuses the existing **copy-paste bridge** execution mode (`renderPromptText()` / `importExternalResult()`), so no audit-schema change and no AI browsing are required.

| Option | Effect | Cost | Verdict |
|---|---|---|---|
| A. Extend `business_analysis` with `reviews[]` | Fixes G-1 + latent `ReviewSlotService` bug | Touches shared schema + all audit templates + seeds; token cost per audit | Not chosen |
| B. Post-audit prompt researches reviews | No audit change | Needs browsing (G-2); duplicated research | Not chosen |
| C. Drop the two types | Smallest change | Modal loses 2 of 8 types | Not chosen |
| **D. Operator-pasted review intake prompt** | **No schema/audit change; operator supplies source reviews; prompt parses per directives** | **Operator pastes reviews (one manual step)** | **CHOSEN** |

Consequences: (1) the source-material prompt's `review_responses`/`testimonial_cards` blocks are populated **from the Review Intake output**, not from the audit; (2) the modal shows a "Paste reviews" affordance for the two review-bearing types when the intake has not run; (3) the latent `ReviewSlotService` bug (G-1b) is **out of scope** for this sprint — log it as a separate follow-up, since Option D does not touch the audit schema.

**Other decisions (2026-09-18):**

- **G-4 → Option A:** the modal's `review_responses` delegates to the Deliverable Construction workspace (owner voice + review slots). No generic path.
- **G-6 → Option B:** 400 `type_not_eligible` by default, with `allow_override: true` for platform-staff callers.
- **G-13 → Option A + audit awareness:** business scope only; the flow is audit-aware — when no `business_analysis` audit exists it degrades gracefully (source material reports which blocks are unavailable and why) rather than failing.


