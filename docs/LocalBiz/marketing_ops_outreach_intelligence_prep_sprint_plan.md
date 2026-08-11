# Marketing Ops — Outreach Intelligence Prep + Light-Score Hooks Sprint Plan

**Status:** 📋 Spec — not yet implemented
**Date:** 2026-08-11
**Prerequisite sprints:** Business Contact Details, Outreach Openers (A1–A6), Outreach ↔ Checklist Bridge, Multi-Archetype Campaigns (siblings)

Two related sprints:

- **Sprint 1 (§1–§10):** Outreach Intelligence Prep — the manual research
  worksheet tab on business-scope campaigns. Ships the
  `recommended_salutation` merge field that Sprint 2 consumes.
- **Sprint 2 (§11+):** Light-Score Hook Library — server-side starter hook
  suggestions aligned with the campaign's archetype and detected signals,
  personalized with Sprint 1's salutation.

---

# Sprint 1 — Outreach Intelligence Prep (Manual Research Worksheet)

---

## 1. Problem

Business-scope campaigns have a **Checklist tab** and an **Audits tab**, but
nothing between "audit complete" and "send opener" captures the
**business-published contact context** an operator needs to personalize a
first-touch message:

- `OutreachOpenerService.resolveOpener()` / `executeOpener()` generate openers
  from audit data, but have **no owner name, no business-published email, no
  salutation input** — greetings are generic.
- `BusinessContactCard` + `getContactReadiness` track phone/email/website
  presence on the campaign row, but not **who to greet**, **how the business
  describes itself** (family-owned, sole proprietor), or **which channel the
  business prefers**.
- Operators currently do this research ad hoc (or skip it) and the result is
  not stored, auditable, or reusable by the opener/pitch pipeline.

### Scope (from the worksheet spec)

A **manual research worksheet**, completed by a human **after** the Business
Audit and **before** outreach begins:

```
Category Discovery → … → Individual Business Audit → Outreach Intelligence Prep → Campaign Eligibility → Outreach
```

- Gathers **business-published contact context only** — information the
  business itself chose to publish in a business capacity. Not a
  personal-information lookup.
- **Hard rule:** if a field can't be filled from an acceptable source, leave
  it blank — never guess, infer, or reconstruct (no guessed email formats, no
  names from unlinked personal social profiles).
- Does **not** re-score, re-rank, or re-assess anything the Category/Business
  Audit already covers.
- Output is a fixed JSON record stored **alongside** (not merged into) the
  Business Audit record.

---

## 2. Goal

Add an **"Outreach Prep"** tab to business-scope campaign detail pages where
an operator completes the worksheet, with:

1. Per-field **source** + **source confidence** capture, with the source
   acceptability guide visible inline.
2. A server-computed **salutation fallback chain** producing
   `recommended_salutation`, ready for direct use as a template merge field.
3. A stored JSON record matching the worksheet schema exactly, joined to the
   campaign (and through it, the business audit).
4. Integration surface so the opener/pitch composer can consume the salutation
   and preferred channel.

### Non-goals

- No scraping, auto-fill, or AI generation of worksheet values. This is a
  manual-entry record by design.
- No changes to audit scoring, triage, or stage machines.
- No new pipeline stage — the worksheet is campaign data, not a stage gate.
  (A soft checklist linkage is a Phase 4 integration, not a gate.)

---

## 3. Design principles

1. **Additive, not breaking.** New table, new routes, new tab. No changes to
   `mkt_audits_list`, `mkt_campaigns_list` columns, or existing tabs.
2. **Null over fabrication.** The API accepts and stores `null` for any
   un-gathered field; validation never forces a value. Confidence defaults to
   `unavailable`.
3. **Server owns the salutation chain.** The frontend previews it live for
   UX, but `recommended_salutation` is computed and persisted by the backend
   on save — one implementation, unit-tested.
4. **Business-scope only.** The tab renders only for `scope === 'business'`
   campaigns. The worksheet is **gathered once per business prospect** (one
   campaign gathers it; the business-published contact context — owner name,
   business email, team signal — is shared across siblings because they
   share the business identity). Non-primary siblings **read the primary
   sibling's worksheet** so Sprint 2 can resolve archetype-aligned hooks
   with a shared salutation. This is **not** the audits inheritance pattern:
   audits inherit diagnostic output (a full audits join); the worksheet
   inherits gathered contact context via a read-time campaign-id
   resolution (a single-column lookup), implemented in
   `OutreachIntelligenceService` itself — no dependency on
   `MarketingCampaignService.loadPrimarySiblingAudits`. Sibling
   independence shows up in Sprint 2, where each sibling resolves its own
   archetype (`resolveCampaignArchetype(campaignId)`) and consumes the
   shared intelligence through its own aligned hooks.
5. **Auditability.** Upserts go through the `audit()` helper
   (`actorType: 'user'`), and every field carries its source + confidence so
   a later reviewer can judge provenance.

---

## 4. Schema changes

### Migration `188_mkt_outreach_intelligence.sql`

One worksheet per campaign (1:1). Denormalized columns exist for the fields
the platform queries (salutation, channel, confidence); the `payload` JSONB
column is the source of truth and stores the full worksheet record verbatim
per the output contract.

```sql
CREATE TABLE mkt_outreach_intelligence (
  id                         VARCHAR(255) PRIMARY KEY,
  campaign_id                VARCHAR(255) NOT NULL UNIQUE
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,

  -- Denormalized query/merge columns (derived from payload on save)
  owner_name                 VARCHAR(255),
  owner_name_confidence      VARCHAR(20) NOT NULL DEFAULT 'unavailable',
  business_email             VARCHAR(255),
  business_email_confidence  VARCHAR(20) NOT NULL DEFAULT 'unavailable',
  team_signal                VARCHAR(20) NOT NULL DEFAULT 'unknown',
  preferred_contact_channel  VARCHAR(50),
  recommended_salutation     VARCHAR(255) NOT NULL,
  research_date              DATE,
  prepared_by                VARCHAR(255),

  -- Full worksheet record (sources, quoted descriptions, notes, linked audit ref)
  payload                    JSONB NOT NULL,

  created_at                 TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT chk_oi_owner_conf CHECK (owner_name_confidence IN ('confirmed','inferred_low_risk','unavailable')),
  CONSTRAINT chk_oi_email_conf CHECK (business_email_confidence IN ('confirmed','inferred_low_risk','unavailable')),
  CONSTRAINT chk_oi_team_signal CHECK (team_signal IN ('sole_owner','family_team','small_staff','unknown'))
);

CREATE INDEX idx_mkt_outreach_intelligence_campaign ON mkt_outreach_intelligence(campaign_id);
```

**Prisma:** after migrating, `pnpm prisma:generate` (Doppler: `doppler run
--config local -- pnpm prisma db pull` from `apps/api`) adds
`mkt_outreach_intelligence` with a required relation on `mkt_campaigns_list`.

### Stored payload contract (verbatim worksheet JSON)

`payload` stores the inner `outreach_intelligence` object exactly as specced:

```json
{
  "business_name": "",
  "address": null,
  "linked_audit_reference": null,
  "prepared_by": "",
  "research_date": "YYYY-MM-DD",
  "owner_name":  { "value": null, "source": null, "source_confidence": "unavailable" },
  "business_email": { "value": null, "source": null, "source_confidence": "unavailable" },
  "team_signal": { "value": "unknown", "quoted_description": null, "source": null, "source_confidence": "unavailable" },
  "preferred_contact_channel": { "value": null, "source": null, "source_confidence": "unavailable" },
  "recommended_salutation": "",
  "researcher_notes": ""
}
```

- `business_name` / `address` are **snapshotted from the campaign row** on
  save (server-side), not re-typed by the operator — the worksheet says
  "reference the identifiers already established in the Business Audit — do
  not re-verify identity here."
- `linked_audit_reference` defaults server-side to the campaign's latest
  `business_analysis` audit id when not supplied (reuse the lookup pattern in
  `OutreachOpenerService.getLatestBusinessAnalysisAudit`).
- `recommended_salutation` inside the payload is always overwritten
  server-side by the resolver (§5.2) — client input for it is ignored.

---

## 5. Backend

### 5.1 `apps/api/src/services/OutreachIntelligenceService.ts`

New `BaseService` singleton (mirrors `MarketingAuditService`):

| Method | Behavior |
|---|---|
| `getForCampaign(campaignId, ctx)` | Returns the worksheet row for the campaign. Resolution order: (1) look up by `campaign_id`; found → return it. (2) Not found **and** this is a non-primary sibling (`business_prospect_id != null` AND `is_primary_sibling = false` AND another business-scope campaign shares the `business_prospect_id`) → resolve the primary sibling's campaign id via a self-contained lookup on `mkt_campaigns_list` (`where: { business_prospect_id, scope: 'business' }`, pick `is_primary_sibling = true`, else earliest by `created_at` — same fallback rule as `loadPrimarySiblingAudits` but returning only the campaign id, not an audits join), look up the worksheet by that campaign id, and return it with `inherited: true` + `sourceCampaignId`. (3) Still not found → return `null`. **Does not** call `MarketingCampaignService.loadPrimarySiblingAudits` (that method is private and inherits audit data, not gathered contact context — different motivation, different lookup). |
| `upsert(campaignId, input, ctx)` | Zod-validates the payload, snapshots `business_name`/`address` from the campaign row, defaults `linked_audit_reference`, computes `recommended_salutation` via `resolveSalutation()`, upserts by `campaign_id`, writes `audit()` entry. Rejects writes on non-primary siblings with 409 — intelligence is gathered once per business prospect; edit the primary's worksheet (UI deep-links to it). |
| `delete(campaignId, ctx)` | Removes the row (admin cleanup); audit logged. |

### 5.2 Salutation fallback chain — `resolveSalutation(payload, businessName)`

Pure exported function (unit-tested in isolation):

1. `owner_name.value` present **and** `source_confidence` ∈
   {`confirmed`, `inferred_low_risk`} → `Hi {firstName},`
   (first name = first whitespace-delimited token of the stored value; the
   worksheet stores "first name minimum, full name if available").
2. Else, campaign `business_name` present and usable as a greeting →
   `Hi {business_name},`
3. Else → `Hi there,`

"Usable as a greeting" heuristic (kept deliberately simple and documented):
non-empty after trim, ≤ 60 chars, contains at least one letter, and is not
all-punctuation/digits. Anything weirder falls through to `Hi there,` — the
operator can see the resolved value in the tab and adjust research
accordingly. The function never fabricates a name.

### 5.3 Zod schema

Defined alongside the other inline schemas in `marketing-ops.ts` (existing
convention — `auditCreateSchema` etc. live in the route file):

```ts
const confidenceEnum = z.enum(['confirmed', 'inferred_low_risk', 'unavailable']);
const sourcedField = z.object({
  value: z.string().max(500).nullable(),
  source: z.string().max(500).nullable(),
  source_confidence: confidenceEnum,
});
const outreachIntelligenceSchema = z.object({
  linked_audit_reference: z.string().max(255).nullish(),
  prepared_by: z.string().max(255),
  research_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // ISO 8601 date
  owner_name: sourcedField,
  business_email: sourcedField.refine(
    (f) => !f.value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value),
    'must be a valid email when provided'),
  team_signal: z.object({
    value: z.enum(['sole_owner', 'family_team', 'small_staff', 'unknown']),
    quoted_description: z.string().max(500).nullable(),
    source: z.string().max(500).nullable(),
    source_confidence: confidenceEnum,
  }),
  preferred_contact_channel: sourcedField,
  researcher_notes: z.string().max(4000).default(''),
});
```

**Guardrail enforcement at the API boundary:** when `source_confidence` is
`confirmed`, `source` must be non-empty (a confirmation without a citation is
a contract violation → 400). When confidence is `unavailable`, `value` must
be `null`.

### 5.4 Routes — `apps/api/src/routes/marketing-ops.ts`

Admin-authed (the router already applies `authenticateToken` +
`requirePlatformAdmin`):

```
GET    /:campaignId/outreach-intelligence   — fetch (with sibling inheritance resolution)
PUT    /:campaignId/outreach-intelligence   — upsert (validates + computes salutation)
DELETE /:campaignId/outreach-intelligence   — remove worksheet
```

Registration note: these are two-segment paths under `/:campaignId`, so they
must be registered **before** the single-segment `GET /:id` catch-all group,
following the same ordering discipline as `/conversion-stats` and the audits
routes.

Response envelope follows the file's existing `{ success, data }` contract.

---

## 6. Frontend

### 6.1 Tab registration — `CampaignDetailClient.tsx`

- Extend the `Tab` union (line 31) with `'outreach-prep'`.
- Add to the `tabs` array (line 320) **conditionally on
  `campaign?.scope === 'business'`**, positioned between **Checklist** and
  **Stage History** (funnel order: audit → prep → outreach):

```ts
...(campaign?.scope === 'business'
  ? [{ key: 'outreach-prep' as Tab, label: 'Outreach Prep' }]
  : []),
```

- Render block mirrors the checklist pattern:

```tsx
{activeTab === 'outreach-prep' && campaign && (
  <OutreachIntelligenceTab
    campaignId={campaign.id}
    businessName={campaign.business_name}
    isNonPrimarySibling={campaign.is_primary_sibling === false}
  />
)}
```

### 6.2 `OutreachIntelligenceTab.tsx` (new, co-located in `campaigns/[id]/`)

Follows `CampaignChecklistTab.tsx` conventions: `'use client'`, local
loading/error state, lucide icons, Tailwind + `dark:` classes.

Layout (dense, single-column worksheet):

1. **Header card** — worksheet purpose line ("Business-published contact
   context only — never guess; leave blank and let the fallback chain handle
   it"), research date (defaults today), prepared-by (defaults from
   `useStaffUsers()`), linked audit reference (read-only display of the
   resolved default, overridable).
2. **Field rows** — one per worksheet field (owner name, business email, team
   signal, preferred contact channel):
   - value input (text / email / segmented select for team signal / text),
   - source input (free text, placeholder examples: "About page", "BBB
     contact field", "Signed review response"),
   - confidence segmented control (`confirmed` / `inferred_low_risk` /
     `unavailable`) — selecting `unavailable` clears and disables the value,
   - per-field helper text with the acceptable/not-acceptable source summary
     (collapsible "Source guide" popover per field).
3. **Team signal extras** — `quoted_description` text input shown when a
   non-`unknown` value is selected.
4. **Salutation preview card** — live client-side resolution of the fallback
   chain as the operator types (same rules as §5.2), rendered as a merge-field
   chip: `Hi Maria,` / `Hi Tetees African Food Market,` / `Hi there,` with a
   one-click copy button. Labeled "Preview — final value computed on save."
5. **Researcher notes** — textarea.
6. **Save / Delete actions** — PUT upsert; delete behind a confirm.

Empty state (no row yet): brief explainer + "Start worksheet" that seeds the
form with the blank schema. Non-primary sibling without its own row: shows
the inherited worksheet read-only with the purple inheritance banner (same
pattern as the Audits tab) and a deep-link to the primary sibling's tab.

`skill-frontend-ux-guardrails` applies: loading skeleton, error card with
dismiss, disabled-while-saving, dark-mode classes on every element.

### 6.3 `apps/web/src/services/MarketingOpsService.ts`

Add types + methods (service is the existing export pattern):

```ts
export type SourceConfidence = 'confirmed' | 'inferred_low_risk' | 'unavailable';
export type TeamSignalValue = 'sole_owner' | 'family_team' | 'small_staff' | 'unknown';
export interface SourcedField { value: string | null; source: string | null; source_confidence: SourceConfidence; }
export interface OutreachIntelligence { /* row + payload, inherited?: boolean, sourceCampaignId?: string */ }

getOutreachIntelligence(campaignId)
saveOutreachIntelligence(campaignId, payload)
deleteOutreachIntelligence(campaignId)
```

---

## 7. Integration points

### 7.1 Opener / composer salutation (Phase 4)

- `MarketingOutreachService.buildFreshSnapshot` gains
  `outreach_intelligence: { recommended_salutation, preferred_contact_channel,
  team_signal } | null` (single lookup by campaign_id) so the contact message
  composer can pre-fill the greeting merge field.
- `OutreachOpenerService.resolveOpener` reads `recommended_salutation` when
  present and injects it into the opener context (overrides the generic
  greeting). No prompt-schema change — it's an additional context field.

### 7.2 Checklist linkage (Phase 4)

- Playbook starter steps gain (via suggestion flow or next starter migration)
  an `internal_link` step: "Complete Outreach Intelligence Prep" linking to
  the campaign's Outreach Prep tab, using the bridge's existing
  `internal_link` step type + auto-detect (link target = tab key
  `outreach-prep`). Step can auto-complete when a worksheet row exists with a
  non-null `research_date`. Opt-in per the bridge's `auto_complete` flag —
  not a stage gate.

---

## 8. Sprint slices

| Slice | Deliverables | Files touched |
|---|---|---|
| **1. Schema + service core** | Migration 188; Prisma regen; `OutreachIntelligenceService` (get/upsert/delete); `resolveSalutation` pure fn | `database/migrations/188_*.sql`, `apps/api/prisma/schema.prisma`, `apps/api/src/services/OutreachIntelligenceService.ts` |
| **2. Service tests** | Salutation chain: all 3 tiers + confidence gating + edge cases (full name → first name, unpunctuated store name, unusable name → `Hi there,`); upsert idempotency; confirm-requires-source 400; unavailable-requires-null; sibling inheritance read; sibling write 409 | `apps/api/src/services/__tests__/OutreachIntelligenceService.test.ts` |
| **3. Routes** | Zod schema; GET/PUT/DELETE with correct registration order; audit logging | `apps/api/src/routes/marketing-ops.ts` |
| **4. Route tests** | 401 unauth; 404 unknown campaign; PUT→GET round-trip preserves payload verbatim; salutation persisted from server computation | `apps/api/src/tests/` (mirrors `marketing-customer-routes.test.ts` patterns) |
| **5. Frontend tab** | Tab registration (business-scope only); `OutreachIntelligenceTab` form + source guide + live salutation preview + inheritance banner; service client methods | `CampaignDetailClient.tsx`, `OutreachIntelligenceTab.tsx`, `MarketingOpsService.ts` (web) |
| **6. Integration** | `buildFreshSnapshot` salutation field; opener context injection; checklist `internal_link` starter step | `MarketingOutreachService.ts`, `OutreachOpenerService.ts`, playbook starters |
| **7. Verify** | `pnpm checkapi`, `pnpm checkweb`, run API test suites | — |

Slices 1–5 are the MVP (worksheet usable end-to-end). Slice 6 can ship in the
same sprint or fast-follow without schema changes.

---

## 9. Acceptance criteria

1. Business-scope campaign detail shows an **Outreach Prep** tab between
   Checklist and Stage History; category/city-scope campaigns do not.
2. Operator can complete and save the worksheet; a GET returns the stored
   record with the exact payload schema from the spec (nulls preserved).
3. `recommended_salutation` follows the fallback chain exactly:
   confirmed/inferred owner name → `Hi {firstName},`; else business name →
   `Hi {Store Name},`; else `Hi there,`. Server value wins over client input.
4. A `confirmed` field with no source is rejected (400). A field marked
   `unavailable` with a value is rejected (400).
5. Non-primary siblings display the primary's worksheet read-only with an
   inheritance banner; writes to siblings are rejected with a deep-link path.
6. Every save is audit-logged with actor + timestamp.
7. `pnpm checkapi` and `pnpm checkweb` pass; new service + route tests pass.

---

## 10. Guardrails restated (for implementers)

- The tab UI must never suggest, auto-complete, or scrape values. Inputs are
  blank by default.
- Helper copy in the tab repeats the hard rule: *"If a field cannot be filled
  from a business-published source, leave it blank — the fallback chain
  handles it. Do not guess or infer values."*
- Personal information found in research (personal phone, home address,
  unlinked personal social profiles) is **not recordable** — there is no
  field for it by design.

---

# Sprint 2 — Light-Score Hook Library + Server-Side Starter Suggestions

## 11. Problem

Twelve proven first-touch **hook angles** (one per service-package item) exist
as operator knowledge, each following the same five-beat shape:

> light "score" hook → reassurance → quantified upside → low-commitment audit
> offer → soft CTA

Today there is no system support for them:

1. **Starters are hardcoded in the frontend.** `HEADER_STARTERS`,
   `CLOSER_STARTERS`, `CONTACT_STARTERS` in `PitchConstructionPanel.tsx`
   (lines 65–200) are archetype-keyed but live entirely in the component —
   gap #4 from the Outreach ↔ Checklist Bridge sprint plan. There is no
   hook/angle-level starter at all (subjects only, no bodies).
2. **No server-side suggestion.** Nothing ranks hook angles against the
   campaign's resolved archetype + detected signals. The operator picks from
   memory.
3. **No salutation merge.** Hooks open with a generic "Hey!" — Sprint 1's
   `recommended_salutation` (`Hi Maria,`) is never consumed.
4. **No attribution.** `mkt_outreach_openers_list` records `archetype`,
   `source`, `close_variant` — but not which hook angle was used, so
   `getSplitTestStats()` can't tell us which angles convert.

### Seed catalog (from operator playbook)

| Angle key | Archetype affinity | Subject (pattern) |
|---|---|---|
| `gbp_verification` | A3, A4 | "quick question about your Google listing" |
| `nap_normalization` | A3 | "your business shows up a little differently everywhere" |
| `hours_sync` | A3 | "are your hours right everywhere?" |
| `website_foundation` | A4 | "quick question about your website" |
| `product_category_pages` | A6 | "do people know everything you carry?" |
| `review_acquisition` | A1 | "noticed you don't have many reviews up yet" |
| `testimonial_amplification` | A1, A2 | "you've got fans and nobody knows it" |
| `local_seo` | A5, A6 | "a quick look at how easy you are to find" |
| `cross_platform_expansion` | A3, A5 | "you're on Google — but that might be it" |
| `photo_content_setup` | A6 | "your listing could use a few more photos" |
| `click_to_call` | A4 | "quick test on your listing from my phone" |
| `reputation_monitoring` | A1, A2 | "who's watching your reviews?" |

Full subject + body copy for each angle ships in the catalog module as
**templates with merge placeholders** (§13.3). The operator-authored samples
are the **rendered output for one niche** (African grocery stores in
Indianapolis) — they show how each hook aligns to its service-package offer
and the five-beat shape. The catalog stores the templatized version:
niche-specific nouns become `{{category}}` / `{{city}}` placeholders, the
greeting becomes `{{salutation}}`, and the signoff becomes `{{sender_name}}`.
Generic phrasings that work across niches ("local shops", "shops like yours",
"your shop") stay verbatim in the template. Some sample phrasings that can't
survive mechanical `{{category}}` substitution ("a specialty one", "a new
grocery store") are replaced with genericized alternatives in the template
("a shop like yours", "a new store like yours") — see §13.2 merge-field
rules for the substitution categories.

---

## 12. Goal

- A **server-owned hook catalog** (the 12 angles, full copy, archetype/signal
  affinity, five-beat shape metadata) replacing frontend-hardcoded starters
  for hooks.
- A **suggestion endpoint** that ranks angles for a campaign by archetype +
  detected signals and returns copy with **merge fields resolved**
  (salutation from Sprint 1, city, category, sender). Note: `{{business}}`
  is defined but unused in the seed hooks — they use generic "your shop" /
  "your business" phrasing instead, which works across niches without
  personalization.
- A **hook picker** in the openers workspace fed by that endpoint.
- **Attribution**: the opener record stores which angle was used so
  split-test stats can rank angles.

### Non-goals

- No AI generation changes — `executeOpener` (AI path) stays as-is; hooks are
  the fast manual-assembly path, like today's starters.
- No DB-backed admin hook editor this sprint (code-defined catalog, like
  `GalleryArchetypeDefaults.ts`). Fast-follow candidate.
- Header/closer/contact starters stay client-side for now; only the **hook**
  layer is server-fed this sprint.

---

## 13. Design

### 13.1 Catalog module — `apps/api/src/services/outreach-openers/hook-library.ts`

Code-defined, typed, unit-tested (mirrors `GalleryArchetypeDefaults.ts`):

```ts
export type HookAngle =
  | 'gbp_verification' | 'nap_normalization' | 'hours_sync'
  | 'website_foundation' | 'product_category_pages' | 'review_acquisition'
  | 'testimonial_amplification' | 'local_seo' | 'cross_platform_expansion'
  | 'photo_content_setup' | 'click_to_call' | 'reputation_monitoring';

export interface HookTemplate {
  angle: HookAngle;
  label: string;                    // "GBP verification & optimization"
  archetypes: ArchetypeCode[];      // affinity, from the table above
  signals: string[];                // signal-taxonomy codes that boost rank
  subject: string;                  // merge placeholders allowed
  body: string;                     // five-beat shape, merge placeholders
                                    // ({{salutation}}, {{category}}, {{city}},
                                    // {{sender_name}}; {{business}} defined
                                    // but unused in seed hooks)
  shape: {                          // annotated beats for the picker UI
    score_hook: string; reassurance: string; quantified_upside: string;
    audit_offer: string; soft_cta: string;
  };
}

export const HOOK_LIBRARY: HookTemplate[] = [ /* 12 seed hook templates */ ];
```

### 13.2 Suggestion service — `HookSuggestionService.suggestForCampaign(campaignId, ctx)`

1. Resolve archetype via `resolveCampaignArchetype(campaignId)` (existing).
   This is the **sibling's own** archetype — siblings are independent
   campaigns and each consumes the shared intelligence through its own
   aligned hooks. (Sprint 1's worksheet is gathered once per business
   prospect and read-shared by siblings; the archetype is per-campaign.)
2. Pull detected signals from the campaign's triage result via
   `CampaignTriageService.getTriageResult(campaignId)` — read
   `detectedSignals: DetectedSignal[]` and map to `.code` (the `SignalCode`
   values used by `extractSignals`, stored on `mkt_campaign_triage_results`).
   Do **not** read `selectArchetype`'s inputs (`combined_review_metrics`,
   `negative_review_themes`, `nap_consistency`) — those are archetype
   inputs, not signals. When no triage result exists, fall back to an
   empty signal set (hooks rank by archetype affinity only, tie-broken by
   catalog order); the endpoint still returns all 12 hooks.
3. Rank: archetype-affinity hooks first, ordered by signal-match count
   (deterministic tie-break by catalog order). Return all 12, ranked — the
   operator can always pick off-rank.
4. Resolve merge fields per hook (never fabricate — missing values keep the
   placeholder visible so the operator sees what's unresolved):
   - `{{salutation}}` — from `mkt_outreach_intelligence.recommended_salutation`
     (Sprint 1), resolved via the **same** primary-sibling inheritance
     lookup as `OutreachIntelligenceService.getForCampaign` (so a sibling
     with no own worksheet still gets the shared salutation). If no
     worksheet exists for the campaign or its primary sibling, run the
     same fallback chain inline
     against the campaign's business name (`Hi {Store Name},` → `Hi there,`).
     This replaces the "Hey!" greeting in the operator's sample copy —
     the sample's "Hey!" is a placeholder, not the intended final greeting.
   - `{{business}}` — `mkt_campaigns_list.business_name`. **Defined but
     unused in seed hooks**: the operator's samples use generic "your shop"
     / "your business" / "your listing" phrasing, which works across niches
     without personalization. The merge field is available for future hooks
     that want to address the business by name.
   - `{{city}}` — campaign city. Used where the sample copy references the
     city directly ("in Indy" → "in {{city}}"). Some hooks use "in your
     area" instead — those stay verbatim (no `{{city}}` merge).
   - `{{category}}` — campaign category, lowercased for in-sentence use
     ("African grocery stores"). Used where the sample copy references the
     niche category directly ("I was looking up African grocery stores in
     {{city}}" → "I was looking up {{category}} in {{city}}"). Three
     phrasing categories in the operator samples:
     (a) **Clean substitution** — `{{category}}` replaces the niche noun
         directly ("African grocery stores" → `{{category}}`).
     (b) **Generic phrasings** — work across niches as-is, no merge needed
         ("Most local shops", "shops like yours", "a shop like yours",
         "your shop"). Stay verbatim in the template.
     (c) **Un-substitutable phrasings** — mechanical `{{category}}` produces
         ungrammatical output ("a specialty one" → "a african grocery stores
         one"). These are replaced with genericized alternatives in the
         template ("a shop like yours", "a new store like yours") that work
         across niches. The operator can edit after loading if they want
         niche-specific language.
   - `{{sender_name}}` — campaign's assigned operator display name
     (falls back to the platform sender identity). Replaces "Adrien Yarl"
     in the sample signoff (`-- Adrien Yarl` → `-- {{sender_name}}`).

### 13.3 Route — `marketing-ops.ts`

```
GET /:campaignId/hook-suggestions
  → { success, data: { archetype, suggestions: RankedHook[] } }

RankedHook = HookTemplate & {
  rank: number;
  matchedSignals: string[];
  resolved: { subject: string; body: string };   // merge fields applied
}
```

Registered with the other `/:campaignId/*` two-segment routes (before the
`GET /:id` catch-all).

### 13.4 Attribution — migration `189_mkt_openers_hook_angle.sql`

```sql
ALTER TABLE mkt_outreach_openers_list
  ADD COLUMN hook_angle VARCHAR(40);

CREATE INDEX idx_mkt_outreach_openers_hook_angle
  ON mkt_outreach_openers_list(hook_angle) WHERE hook_angle IS NOT NULL;
```

- `importOpener` / `executeOpener` accept optional `hookAngle` (validated
  against `HOOK_LIBRARY` keys; unknown → 400).
- `getSplitTestStats()` gains a `byHookAngle` grouping alongside the existing
  archetype/variant groupings.

### 13.5 Frontend

- **`PitchConstructionPanel.tsx`** — new **"Suggested hooks"** section above
  the header starters: ranked cards showing angle label, resolved subject,
  resolved body, matched-signal chips, and a "Use this hook" button that
  loads subject → header field and body → import field (same click-to-load
  interaction as existing starters). Fetches via a new
  `MarketingOpsService.getHookSuggestions(campaignId)`. Loading/error/empty
  states per `skill-frontend-ux-guardrails`.
- **Opener import flow** — when a hook was loaded, the panel passes
  `hookAngle` through `importOpener` so attribution lands on the opener row.
- **Outreach Prep tab tie-in (optional, same sprint):** a compact "Suggested
  opener hook" preview at the bottom of the Sprint 1 tab showing the top
  ranked hook with the resolved salutation — makes the worksheet's payoff
  visible where the research happens. Read-only; deep-links to the openers
  workspace.

---

## 14. Guardrails (Sprint 2)

1. **Hedged scores stay hedged.** The "light score" beat is always framed as
   approximate ("probably sitting around a C-minus", "most local shops are in
   that range") — never a fabricated precise grade for the specific business.
   The catalog copy encodes this; the suggestion service must not inject
   audit-derived numbers into the score beat.
2. **Quantified upside is generic, not prospect-specific.** "20–30% of
   near-me searches" is a range claim about the pattern, not a measured value
   for this business. Prospect-specific numbers (review counts, directory
   mismatches) come only from real audit fields and only in beats designed
   for them.
3. **Merge fields never fabricate.** Unresolvable placeholders render as-is
   for the operator to fix; the salutation always degrades through the Sprint
   1 fallback chain.
4. **Hook copy passes the existing quality gate** when imported
   (`quality-gate.ts`); server-suggested ≠ auto-approved.

---

## 15. Sprint 2 slices

| Slice | Deliverables | Files |
|---|---|---|
| **1. Catalog** | `hook-library.ts` with 12 hook **templates** (operator samples converted to merge-placeholder templates per §13.2's three phrasing categories), types, shape annotations | `apps/api/src/services/outreach-openers/hook-library.ts` |
| **2. Suggestion service + tests** | `HookSuggestionService` ranking + merge resolution; unit tests: archetype affinity ordering, signal boost, salutation from worksheet vs inline fallback, placeholder pass-through on missing fields, `{{category}}` / `{{city}}` substitution, genericized phrasings survive across niches | `HookSuggestionService.ts`, `__tests__/HookSuggestionService.test.ts` |
| **3. Route + attribution** | `GET /:campaignId/hook-suggestions`; migration 189; `hookAngle` on `importOpener` only (not `executeOpener` — see §12 non-goals); `byHookAngle` in split-test stats; Prisma regen after migration 189 | `marketing-ops.ts`, `OutreachOpenerService.ts`, `database/migrations/189_*.sql` |
| **4. Frontend picker** | Suggested-hooks section in `PitchConstructionPanel`, service client method, click-to-load + attribution pass-through | `PitchConstructionPanel.tsx`, `MarketingOpsService.ts` (web) |
| **5. Verify** | `pnpm checkapi`, `pnpm checkweb`, service tests | — |

---

## 16. Acceptance criteria (Sprint 2)

1. `GET /:campaignId/hook-suggestions` returns all 12 hooks ranked, with
   archetype-affinity hooks first and merge fields resolved.
2. When a Sprint 1 worksheet exists with a confirmed owner name, suggested
   bodies open with `Hi {firstName},`; without one, they degrade through the
   fallback chain — never blank, never guessed. (The operator sample's
   "Hey!" is not the final greeting — `{{salutation}}` replaces it.)
3. The openers workspace shows ranked hook cards (subject + body + matched
   signals); "Use this hook" loads the copy into the import flow.
4. Importing an opener from a hook persists `hook_angle` (via `importOpener`
   only — `executeOpener` is unchanged per §12 non-goals); split-test stats
   expose a `byHookAngle` grouping.
5. No audit-derived number ever appears inside a score beat; unresolved
   placeholders render visibly rather than being fabricated.
6. `{{category}}` and `{{city}}` substitutions produce grammatical output
   across niches — no "a african grocery stores one" or "a new african
   grocery stores" from mechanical substitution. Genericized alternatives
   in the template ("a shop like yours") handle phrasings that can't be
   mechanically substituted.
7. `pnpm checkapi` / `pnpm checkweb` pass; new tests pass.
