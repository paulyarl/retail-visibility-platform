# Sprint Plan: Marketing Ops — Seek Category Intelligence Scope

**Document Version:** 1.1 (added GAP-P8 — profile establishment loop)
**Date:** 2026-08-14
**Status:** Ready for Sprint Planning — Design Decisions Resolved (§3), Open Questions Resolved (§13)

**Source analysis:** `docs/LocalBiz/SEEK_INTELLIGENCE_SCOPE_GAP_ANALYSIS.md` (revised 2026-08-14)
**Spec under review:** Functional Specification — Seek Category Intelligence Scope (§1–§66)
**Codebase baseline:** `retail-visibility-platform` @ marketing-ops seek pipeline (migrations through `193_mkt_prospect_queue_business_name_nullable.sql`)

**Prerequisite:** Marketing Ops Sprint 1–6 complete; Multi-Archetype Campaigns Sprint complete (sibling campaigns, `business_prospect_id`, multi-gallery); Intake Portal Generalization complete (registry-driven intake); Diagnostic Gallery Sprint complete.

**Companion docs:**
- `docs/LocalBiz/SEEK_INTELLIGENCE_SCOPE_GAP_ANALYSIS.md` (full gap analysis + traceability matrix)
- `docs/LocalBiz/Audit Prompts/` (V1/V2/V3 prompt texts, per-LLM variants)
- `errors/mpt-6vrf6xtz-prompt-body.md` (V3 emerging-discovery prompt body, 1,199 lines)
- `errors/zionsville-category-import-chatgpt.md` (V3 Zionsville Auto Repair run, 2026-08-13 — §61 baseline)

---

## 1. Executive Summary

The spec proposes a fourth Seek scope, `intelligence`, that composes (1) the existing Category Seek prompt framework, (2) a new Intelligence amplification extension, (3) a reusable Category Intelligence Profile, and (4) an `emerging`/`competitive` focus modifier, then routes qualifying businesses into the existing Business Seek workflow.

**Headline finding from the gap analysis:** the spec is substantially a refactor-and-generalize of behavior that already exists as the Category V3 monolithic prompt (`mpt-6vrf6xtz`) — plus one genuinely new subsystem (Category Intelligence Profiles) and one genuinely new discipline (clean discovery-signal separation + provenance). Roughly 70–80% of the spec's *behavioral* surface already exists in V3 + the shared pipeline. The genuinely new engineering is: prompt composition, the profile subsystem, a slimmer discovery-oriented output schema, run-level provenance, and the operator UI.

This sprint also delivers the **vision extension (§1B of the analysis):** profile-amplified business-audit prompt resolution. Before a business audit prompt is presented or executed, the backend resolves it against the business's category, and if an active intelligence profile exists for that category, the resolved prompt includes category intelligence (terminology, specialized sources with capability/limitation contracts, category evidence rules, prohibited inferences). This generalizes profiles from "discovery-scope input" to a cross-scope capability. The existing single-seam design in `MarketingExecutionService` (`renderPrompt()` + `executeSingle()` both delegate to `renderTemplate()`, which already receives the full campaign object) supports this cleanly with one shared `resolvePrompt()` wrapper.

**Sprint Duration:** 3 sprints (6 weeks)
**Team Size:** 1 full-stack developer

**Resolved design decisions (see §3 for rationale):**
- **Composition:** Option A — runtime fragment composition (composer service assembles base + extension + profile block + focus at render time)
- **Vision §1B:** included in this sprint — `resolvePrompt()` seam + business profile block + provenance stamping + workspace indicator
- **Amplification scope:** seek business audits only (smallest blast radius; fulfill/retainer deferred)
- **Profile establishment:** operator-driven establishment loop (GAP-P8) — a dedicated profile-establishment template is resolved by the backend, exposed in the workspace, run in an external AI, imported via `/executions/external` with Zod validation against the §10 profile structure, and persisted as a DRAFT profile; operator activates it; both business audit resolution and intelligence discovery runs then pick up the active profile for free (resolver unchanged)

---

## 2. Problem Statement

### 2.1 V3 Is a Hand-Maintained Monolith That References V2

Category Audit V3 (`mpt-6vrf6xtz`, 1,199 lines) implements the spec's entire emerging-focus behavior in production-ready form — thin-footprint targeting, deep/long-tail search, social-only/directory-only discovery, hidden trust, recently-established businesses. But it is a monolith that *textually references* V2 ("Use the same input variables as Category Audit V2", "Use the same geographic model as Category Audit V2") in at least six sections (input contract, category definition, geography, dedup, signals, market size). Every V2 rule change must currently be manually mirrored into V3. This is precisely the maintenance hazard the spec's §49 warns about, and V3's existence is the strongest internal evidence that the composition architecture is needed.

### 2.2 No `intelligence` Scope Anywhere

`CampaignScope`, `PromptScope`, the `SCOPE_VARIABLES` map, `assertScopeCompatible`, queue `source_kind`/`source_scope` enums, and all UI selectors are hardcoded to `business | category | city`. There is no fourth scope.

### 2.3 No Category Intelligence Profile Store

Nothing resembling profiles, profile resolution, or generic-fallback mode exists. V3 is category-generic — it has no per-category discovery knowledge (specialized sources with capability/limitation contracts, evidence ecosystems, category-specific signals).

### 2.4 Prompt-Version Provenance Is Unreliable (Pre-Existing Defect)

Template updates mutate rows in place (`MarketingPromptService` update path); executions store only `template_id` — so historical executions cannot be faithfully attributed to the prompt text that produced them. This is already a latent reproducibility defect for *all* scopes; the spec's §42 makes it a hard requirement. The §1B vision increases the urgency: "which prompt produced this output" now depends on resolution-time state (profile version), not just template state.

### 2.5 Signal Families Are Mixed

V3 mixes Business-Audit signals (RA/DS/WC/CP/VP) and discovery signals (EF) in one `detected_signals` array, and migration 191 folded an emerging signal (`EF_ZERO_INDEXED_PRESENCE`) into the `DS` family so the outreach hook library could consume it. The spec's §30 mandates the opposite direction — discovery signals in their own `INT_` family, strictly separate from Business Audit signals.

### 2.6 Business Audits Are Category-Aligned, Not Category-Intelligence-Aware

Today the business audit receives the category as a substituted string (`{{category}}`) — it knows *which* category, nothing more. It does not know *how to audit that category*: terminology, specialized sources, per-source capability/limitation contracts, category evidence rules, prohibited inferences. The §1B vision closes this gap.

---

## 3. Design Decisions

### 3.1 Composition: Option A — Runtime Fragment Composition

**Decision:** Store fragments as templates with a new `prompt_type = 'fragment'` and a `fragment_kind` column (`seek_category_base`, `seek_intelligence_extension`, `seek_intelligence_focus_emerging`, `seek_intelligence_focus_competitive`). A composer service assembles body = base + extension + rendered-profile-block + focus + market inputs, then runs existing variable substitution.

**Rationale:**
- Truest to spec §49 (no `AutoRepairEmergingPrompt`, `HVACCompetitivePrompt` proliferation).
- Single source of truth per fragment; profile changes don't touch prompt text.
- The §1B vision (profile-amplified business resolution) is clean under Option A — profile injection is one resolver call shared by both scopes. Under Option B, profile-amplified business audits would require regenerating profile-augmented variants of every business template per profile version (proliferation squared).
- V3 is the in-house proof that the monolith approach hurts.

**Trade-off acknowledged:** New composer code path; `scope-utils` variable validation must run against the *assembled* body; prompt library UI needs a fragment concept (fragments hidden from the normal list or shown with a distinct badge). This is acceptable — the composer is a focused service, and the assembled body is a string that the existing `renderTemplate()` already handles.

### 3.2 Vision §1B Included — Profile-Amplified Business Resolution

**Decision:** This sprint delivers `resolvePrompt()` in `MarketingExecutionService` wrapping `renderTemplate()`, called by both `renderPrompt()` (workspace presentation) and `executeSingle()` (in-platform execution) so presentation and execution resolve identically. Plus `IntelligenceProfileService.renderBusinessProfileBlock(profile)` and execution/import provenance stamping.

**Rationale:**
- Both entry points already converge on a single resolution seam (`renderTemplate()` at L234–288, which already receives the full campaign object — and therefore `campaign.category`).
- Backward compatible by construction: campaigns whose category has no active profile resolve exactly as today (`intelligence_mode: 'none'`); no existing business template changes; no scope-compat changes (the profile block contains no `{{variables}}`).
- Evidence-safety payoff: injecting `prohibited_inferences` and source `limitations` into business audits directly attacks the §31 failure modes at the scope where they are most likely to occur (e.g. "CARFAX review count ≠ total online reviews" lands in the audit prompt itself).
- LOW–MEDIUM effort because it rides the existing single-seam design.

### 3.3 Amplification Scope: Seek Business Audits Only

**Decision:** Profile block injected only into business-scope `seek` prompts. Fulfill/retainer prompts stay generic for now.

**Rationale:**
- Smallest blast radius for the PoC.
- Fulfill prompts (GBP optimization, service menus) plausibly benefit from category terminology too, but starting with `seek` keeps the change reviewable and the test matrix bounded.
- Extension to fulfill/retainer is a one-line gate change in `resolvePrompt()` once validated.

### 3.4 Category Alignment Rule (Normative)

**Decision:** A profile is applied to a business-scope resolution if and only if the profile's category matches the campaign's category. Normalized exact match (case/whitespace-insensitive) on `mkt_intelligence_profiles.category_key`. No fuzzy/nearest-neighbor matching. No cross-category application, ever. Miss → generic resolution, `intelligence_mode: 'none'`.

**Rationale:** A mismatched profile is actively harmful — e.g. CARFAX capability contracts injected into a restaurant audit would corrupt it. Wrong-category amplification is strictly worse than none.

### 3.5 Signal Naming: `INT_*` Canonical, V3 Aliases Untouched

**Decision:** Adopt `INT_*` as canonical for the new scope. V3 keeps emitting `EF_*`/`DS_ZERO_INDEXED_PRESENCE` aliases (unchanged per §45). Do not reuse the DS alias for Intelligence output. Intelligence scope emits INT codes only, written to a new `discovery_signals` field (not `detected_signals`).

**Rationale:** Migration 191 deliberately placed `EF_ZERO_INDEXED_PRESENCE` in the DS family so the outreach hook library (`emerging-angle-map.ts`, `hook-library.ts`) could consume it. The spec's §30 boundary requires the INT family to stay out of the audit families. V3 remains operational; Intelligence is a parallel scope.

### 3.6 Queue as Discovery Substrate (Not a New `business_discoveries` Table)

**Decision:** Extend `mkt_prospect_queue` with intelligence-specific columns rather than creating a new `business_discoveries` table. Spec §55 explicitly permits this.

**Rationale:** The queue already has dedup (name+city+category), campaign-exists checks, `business_snapshot` JSON, `detected_signals`, priority, assignment, dismissal, and `createCampaignFromQueue()` which replays snapshots into business-scope campaigns. The operator workflow (assign/dismiss/priority) is desired for discoveries.

### 3.7 Run Record: Thin `mkt_intelligence_runs` Table + `prompt_version` on Executions

**Decision:** (a) Add `template_version` + `template_body_hash` as nullable columns on `mkt_prompt_executions_list` (universal fix benefiting all scopes, GAP-P4). (b) A thin `mkt_intelligence_runs` table linked to the execution for the §41 record (`focus`, `profile_id`, `profile_version`, `intelligence_mode`, `prompt_version`).

**Rationale:** §58 observability wants to query by focus/profile/mode without JSON spelunking. §40 wants a stable `intelligence_run_id` lineage handle. Putting `prompt_version` on executions benefits all scopes and is the minimum fix for the pre-existing provenance defect.

### 3.8 Profile Establishment Loop (GAP-P8) — Operator-Driven Profile Authoring

**Decision:** Add a dedicated profile-establishment path that uses the existing external-import machinery to create profiles, rather than requiring manual JSON authoring. The loop:

```text
New category without a profile
  → profile-establishment template resolved by backend
  → resolved prompt exposed in workspace
  → operator runs it in external AI
  → import via /executions/external, Zod-validated against the §10 profile structure
  → persists as DRAFT profile → operator activates
  → business audits in that category now resolve profile-aware prompts (§1B)
  → intelligence discovery runs switch from generic_fallback to profile mode (§19)
```

**Rationale:**
- `importExternalResult` is already generic over registry-declared output schemas. The `recovery_resolution` registry entry (`auditPlatform: null`, `market-analysis.schema.ts` L166–170) proves the registry supports non-audit outputs — "recovery resolutions create deliverables, not audits." A profile-establishment schema with `auditPlatform: null` follows the same pattern: no audit is created; a post-import hook persists the validated JSON into `mkt_intelligence_profiles`.
- The `business_analysis` auto-sync hook (`MarketingPromptService.ts` L468–483) is the direct precedent for "validate, then persist elsewhere" — after import, if `auditPlatform === 'business_analysis'`, it best-effort syncs to `MarketingHotProspectService`. The profile import hooks persistence into `mkt_intelligence_profiles` the same way.
- The resolver never changes: `IntelligenceProfileService.resolve()` only returns active profiles, so both consumers (business audit resolution via `resolvePrompt()`, intelligence discovery via `composeIntelligencePrompt()`) pick up newly activated profiles for free. No resolver code change is needed for the establishment loop to benefit both scopes.
- This preserves the spec's §51 separation of creation from consumption — creation becomes operator-driven (template + external AI + import + activate) rather than manual JSON authoring, but it is still a deliberate, reviewed act, not auto-generation from discovery run output.

**Two normative rules:**

1. **Draft-by-default with human activation.** Profiles silently shape every future prompt resolved for that category — imported profiles must not go live without operator approval. The import persists as `status = 'draft'`; a separate `activate` action flips it to `active` (and flips the previous active version to `retired`, atomic). One active version per profile; historical runs keep the version they used (§43 immutability).

2. **Discovery runs never self-promote into profiles.** A `generic_fallback` run's findings do not become a profile. Establishment only happens through the dedicated template + import + activation path. This is the critical distinction from auto-generation: the establishment template is a *profile-authoring* prompt, not a *discovery* prompt. Its output schema is the §10 profile structure, not the `intelligence_discovery` schema.

**Scope note:** the written spec defers profile generation to "future" (§51, §63). This workflow pulls the bootstrap mode (which §41 already enumerates) forward as an operator-driven capability — registered as **GAP-P8 (MEDIUM effort)**. The `auto_repair_us v1` profile should still be hand-seeded for the PoC, since the establishment template itself needs a known-good profile format to validate against (the hand-seeded profile is the reference shape for the Zod schema).

### 3.9 External Import Is the Realistic Execution Mode for the PoC

**Decision:** The sprint's PoC runs use path B (external LLM + JSON import via `importExternalResult`), exactly as V3 operates today. Internal execution (path A) remains supported but is capped at `maxTokens: 2000` with a fixed system message — too small for full discovery JSON. Per-execution model/token configuration is deferred (Open Question §13.4).

**Rationale:** The V3 Zionsville run used path B. The external-import endpoint with Zod validation works unchanged for offline PoC runs. Resolution + provenance parity across both paths is the new work (GAP-P7): an external import must record the same `focus` / `profile_id` / `profile_version` / `intelligence_mode` an internal run stamps automatically.

---

## 4. Schema Changes

### Migration 194 — `mkt_prompt_executions_list` provenance snapshot (GAP-P4)

```sql
-- 194_mkt_execution_prompt_snapshot.sql
-- Snapshot template version + body hash at execution/import time so historical
-- runs can be attributed to the prompt text that produced them. Benefits all scopes.

ALTER TABLE mkt_prompt_executions_list
  ADD COLUMN template_version INT,
  ADD COLUMN template_body_hash VARCHAR(64);

-- Optional: full body snapshot for byte-exact reproduction (recommended)
ALTER TABLE mkt_prompt_executions_list
  ADD COLUMN template_body_snapshot TEXT;
```

**Prisma model:** `mkt_prompt_executions_list` gains `template_version`, `template_body_hash`, `template_body_snapshot` (all nullable).

### Migration 195 — `mkt_intelligence_profiles` (GAP-P5)

```sql
-- 195_mkt_intelligence_profiles.sql
-- Category Intelligence Profile store. Immutable version rows (unlike prompt
-- templates today) — historical runs reference the exact version used (§43).

CREATE TABLE mkt_intelligence_profiles (
  id                  VARCHAR(64)  NOT NULL,        -- profile_id, e.g. 'auto_repair_us'
  category_key        VARCHAR(100) NOT NULL,        -- normalized lookup key
  category_name       VARCHAR(100) NOT NULL,
  version             INT          NOT NULL DEFAULT 1,
  configuration_json  JSONB        NOT NULL,        -- §10 structure (see below)
  status              VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active | draft | retired
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_intelligence_profiles PRIMARY KEY (id, version)
);

-- One active version per profile; one profile per category key (enforced at resolve time)
CREATE UNIQUE INDEX idx_intelligence_profiles_active
  ON mkt_intelligence_profiles (category_key)
  WHERE status = 'active';

CREATE INDEX idx_intelligence_profiles_id
  ON mkt_intelligence_profiles (id);
```

**`configuration_json` shape (§10):**
```jsonc
{
  "terminology": { ... },
  "synonyms": [ ... ],
  "subcategories": [ ... ],
  "specialized_sources": [
    { "name": "CARFAX", "type": "service_history", "priority": 1,
      "capabilities": [ ... ], "limitations": [ ... ] }
  ],
  "discovery_patterns": { ... },
  "category_evidence_rules": { ... },
  "prohibited_inferences": [ "CARFAX review count ≠ total online reviews", ... ],
  "category_signals": [ "INT_VERTICAL_SOURCE_DISCOVERY", ... ]
}
```

### Migration 196 — `mkt_prompt_templates_list` fragment support (GAP-P1)

```sql
-- 196_mkt_prompt_templates_fragment.sql
-- Fragment support for runtime composition (Option A).
-- Fragments are templates with prompt_type = 'fragment' and a fragment_kind.

ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN fragment_kind VARCHAR(60);

-- Fragment kinds: seek_category_base, seek_intelligence_extension,
-- seek_intelligence_focus_emerging, seek_intelligence_focus_competitive,
-- business_profile_block (rendered dynamically from profile, not stored —
-- this kind is reserved for documentation, not seeded)
CREATE INDEX idx_prompt_templates_fragment_kind
  ON mkt_prompt_templates_list (fragment_kind)
  WHERE fragment_kind IS NOT NULL;
```

**No CHECK constraint on `prompt_type`** — the column is varchar; the TS union is extended (see §5.1).

### Migration 197 — `mkt_prospect_queue` intelligence extension (GAP-E2)

```sql
-- 197_mkt_prospect_queue_intelligence.sql
-- Extend the prospect queue as the discovery substrate (spec §55 permits reuse).
-- New columns are all nullable so legacy queue entries are unaffected (§44).

ALTER TABLE mkt_prospect_queue
  ADD COLUMN category_fit           VARCHAR(20),    -- verified | probable | insufficient
  ADD COLUMN identity_confidence    VARCHAR(20),    -- high | medium | low
  ADD COLUMN location_status        VARCHAR(40),    -- inside_city | adjacent_city | metro_area | outside_market
  ADD COLUMN discovery_provenance   JSONB,          -- §32 array: [{ source_name, source_role, evidence_types[] }]
  ADD COLUMN discovery_signals      JSONB,          -- INT_* codes only (separate from detected_signals per §30)
  ADD COLUMN business_seek_priority VARCHAR(20),    -- high | medium | low | hold (NOT overloading existing priority)
  ADD COLUMN intelligence_run_id    VARCHAR(64);    -- FK to mkt_intelligence_runs

CREATE INDEX idx_prospect_queue_intelligence_run
  ON mkt_prospect_queue (intelligence_run_id)
  WHERE intelligence_run_id IS NOT NULL;
```

**Critical discipline:** `detected_signals` stays for Business-Audit signals only. `discovery_signals` holds `INT_*` codes. The two families never mix in one column (§30).

### Migration 198 — `mkt_intelligence_runs` (GAP-E1)

```sql
-- 198_mkt_intelligence_runs.sql
-- Thin run record for §41 fields + stable lineage handle (§40).
-- Linked to the execution that produced the run.

CREATE TABLE mkt_intelligence_runs (
  id                  VARCHAR(64)  NOT NULL,
  campaign_id         VARCHAR(255) NOT NULL,        -- intelligence-scope campaign
  execution_id        VARCHAR(255) NOT NULL,        -- the prompt execution
  focus               VARCHAR(20)  NOT NULL,        -- emerging | competitive
  profile_id          VARCHAR(64),                  -- nullable (generic_fallback)
  profile_version     INT,                          -- nullable (generic_fallback)
  intelligence_mode   VARCHAR(30)  NOT NULL,        -- profile | generic_fallback | none
  prompt_version      INT,                          -- snapshot of template version
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_intelligence_runs PRIMARY KEY (id),
  CONSTRAINT fk_intel_runs_campaign FOREIGN KEY (campaign_id)
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_intel_runs_execution FOREIGN KEY (execution_id)
    REFERENCES mkt_prompt_executions_list(id) ON DELETE CASCADE
);

CREATE INDEX idx_intelligence_runs_campaign ON mkt_intelligence_runs (campaign_id);
CREATE INDEX idx_intelligence_runs_focus ON mkt_intelligence_runs (focus);
CREATE INDEX idx_intelligence_runs_profile ON mkt_intelligence_runs (profile_id, profile_version);
```

### Migration 199 — `INT_` signal registry seeds (GAP-S1)

```sql
-- 199_mkt_signal_int_family.sql
-- 11 INT_* discovery signals (§28). 5 are renames of V3 EF_* codes;
-- V3 keeps emitting EF/DS aliases (unchanged per §45). Intelligence scope
-- emits INT codes only.

INSERT INTO mkt_signal_registry (code, family, label, detection_source, derived_rule) VALUES
  ('INT_LOW_VISIBILITY',            'INT', 'Low Visibility',                'model_emitted', NULL),
  ('INT_WEAK_MAINSTREAM_INDEXING',  'INT', 'Weak Mainstream Indexing',      'model_emitted', NULL),
  ('INT_SINGLE_SOURCE',             'INT', 'Single Source Only',            'model_emitted', NULL),
  ('INT_HIDDEN_TRUST',              'INT', 'Strong Hidden Trust',           'model_emitted', NULL),
  ('INT_RECENT_BUSINESS_EVIDENCE',  'INT', 'Recently Established',          'model_emitted', NULL),
  ('INT_POSSIBLE_CATEGORY_MISALIGNMENT', 'INT', 'Possible Category Misalignment', 'model_emitted', NULL),
  ('INT_VERTICAL_SOURCE_DISCOVERY', 'INT', 'Vertical Source Discovery',     'model_emitted', NULL),
  ('INT_MULTISOURCE_IDENTITY',      'INT', 'Multisource Identity',          'model_emitted', NULL),
  ('INT_ACTIVE_OPERATIONAL_EVIDENCE','INT', 'Active Operational Evidence',  'model_emitted', NULL),
  ('INT_CATEGORY_SPECIALIZATION',   'INT', 'Category Specialization',       'model_emitted', NULL),
  ('INT_UNDEREXPOSED_CREDENTIAL',   'INT', 'Underexposed Credential',       'model_emitted', NULL)
  ON CONFLICT (code) DO NOTHING;
```

**No schema change needed** — `mkt_signal_registry` accepts new codes; the `family` column already exists.

---

## 5. Backend Changes

### 5.1 Scope system — add `intelligence` (GAP-P2, P3)

**Files touched:**
- `apps/api/src/services/MarketingPromptService.ts` — extend `PromptScope` union: `'business' | 'category' | 'city' | 'intelligence'`; extend `PromptType` with `'fragment'`
- `apps/api/src/services/MarketingCampaignService.ts` — extend `CampaignScope` union: `'business' | 'category' | 'city' | 'intelligence'`
- `apps/api/src/services/scope-utils.ts` — add `intelligence` to `SCOPE_VARIABLES`:
  ```ts
  intelligence: ['category', 'city', 'state', 'zip_codes', 'search_radius_miles', 'focus', 'neighborhood'],
  ```
  `assertScopeCompatible` works unchanged (string comparison).
- `apps/api/src/services/MarketingProspectQueueService.ts` — extend `source_kind` union with `'intelligence_seek'`; extend `source_scope` with `'intelligence'`
- `apps/api/src/services/MarketingExecutionService.ts` — `renderTemplate()` already keys `SCOPE_VARIABLES` by scope string; no change needed beyond the map entry

**Note:** `zip_codes` and `search_radius_miles` are not currently campaign fields or scope variables (they exist only inside the audit output schema). They must be added as execution-time caller-supplied variables (passed via `input.variables`) or campaign attributes. The `renderTemplate()` already injects caller-supplied variables as overrides regardless of scope — so this works without campaign schema changes.

### 5.2 IntelligenceProfileService (GAP-P5, P6) — new service

**File:** `apps/api/src/services/intelligence/IntelligenceProfileService.ts` (new)

**Methods:**
- `resolve(category: string): Promise<IntelligenceProfile | null>` — normalized exact match (case/whitespace-insensitive) on `category_key`, active version only. Returns null on miss (→ generic fallback). **Unchanged by GAP-P8** — the resolver only returns active profiles, so both consumers (business audit resolution, intelligence discovery) pick up newly activated profiles for free.
- `getVersion(profileId: string, version: number): Promise<IntelligenceProfile | null>` — for historical fidelity (§43).
- `listActive(): Promise<IntelligenceProfile[]>` — for admin UI.
- `listDrafts(): Promise<IntelligenceProfile[]>` — for admin UI (GAP-P8 — draft profiles awaiting activation).
- `createProfile(input): Promise<IntelligenceProfile>` — creates version 1 (manual authoring path; used by the hand-seed script).
- `importAsDraft(input: { categoryKey, categoryName, configurationJson }): Promise<IntelligenceProfile>` — **GAP-P8** — called by the post-import hook when an `intelligence_profile` schema result is imported. Persists as `status = 'draft'`. Does NOT activate.
- `activateDraft(profileId: string, version: number): Promise<IntelligenceProfile>` — **GAP-P8** — flips a draft to `active`, flips the previous active version (if any) to `retired`. Atomic transaction. Separate from `publishVersion` (which creates a new version from operator-supplied JSON); `activateDraft` promotes an already-persisted draft.
- `publishVersion(profileId: string, configurationJson): Promise<IntelligenceProfile>` — creates a new immutable version row (from operator-supplied JSON, manual authoring path), flips the previous active version to `retired`, marks the new one `active`. Atomic transaction.
- `renderProfileBlock(profile: IntelligenceProfile): string` — serializes the discovery-relevant slice of the §10 profile (terminology, specialized sources + capabilities/limitations, discovery patterns, category evidence rules, prohibited inferences, category signals) into prompt text for the Intelligence scope.
- `renderBusinessProfileBlock(profile: IntelligenceProfile): string` — serializes the audit-relevant slice (terminology, specialized sources + capability/limitation contracts, category evidence rules, prohibited inferences, category signals) into prompt text for business-scope resolution (§1B). Shares section renderers with `renderProfileBlock` with different sections enabled.

**Normalization:** `normalizeCategoryKey(s) = s.trim().toLowerCase().replace(/\s+/g, ' ')`. Stored on `category_key` at creation time. No fuzzy matching.

**Seed:** `auto_repair_us v1` with the CARFAX source model per spec §46 (content authoring task — see Open Question §13.3).

### 5.3 PromptComposerService (GAP-P1) — new service

**File:** `apps/api/src/services/intelligence/PromptComposerService.ts` (new)

**Methods:**
- `composeIntelligencePrompt(input: { focus: 'emerging' | 'competitive'; profile: IntelligenceProfile | null; variables: Record<string, any> }): Promise<{ body: string; resolution: PromptResolution }>`

**Assembly order (spec §3):**
1. Load `seek_category_base` fragment (the canonical Category Seek framework — extracted from V2 doc text, see §5.4).
2. Append `seek_intelligence_extension` fragment.
3. If profile found → append `renderProfileBlock(profile)`; else append `generic_fallback` disclosure block.
4. Append `seek_intelligence_focus_${focus}` fragment.
5. Return assembled body + resolution metadata (`profile_id`, `profile_version`, `intelligence_mode`).

**Variable validation:** The assembled body is a string with `{{variable}}` placeholders. The existing `renderTemplate()` out-of-scope variable check runs against the assembled body — so the composer must produce a body that only references `intelligence`-scope variables. Fragments are authored to respect this.

**Fragment loading:** Fragments are `mkt_prompt_templates_list` rows with `prompt_type = 'fragment'` and `fragment_kind` set. Loaded by `fragment_kind` via `MarketingPromptService.listTemplates({ fragmentKind })`.

### 5.4 Canonical Category Base extraction (prereq for GAP-P1)

**Decision:** Extract the shared Category Seek rule sections from the V2 doc text (`docs/LocalBiz/Audit Prompts/…prompt - v2 - Seek.md`) — the same text V3 references — into the `seek_category_base` fragment. Not the shorter DB seed `mpt-seed-seek-002` (V1-era).

**Deliverable:** A seeded `seek_category_base` fragment template containing: input contract, category definition, geographic classification (incl. `outside_market` exclusion), ownership exclusion list, dedup/identity rules, the "do not convert unavailable information into a negative signal" rule (§31), and the Business-Audit routing list convention. This is the single source of truth that both V2 and V3 currently re-state separately.

### 5.5 resolvePrompt() seam in MarketingExecutionService (GAP-P7)

**File:** `apps/api/src/services/MarketingExecutionService.ts` (extend)

**New method:**
```ts
async resolvePrompt(input: {
  templateId: string;
  campaignId: string;
  variables?: Record<string, any>;
}, ctx?: RequestCtx): Promise<{
  prompt: string;
  resolution: { profile_id: string | null; profile_version: number | null; intelligence_mode: 'profile' | 'none' };
}>
```

**Flow:**
1. `base render` → `renderTemplate(body, variables, campaign)` [existing, unchanged]
2. `profile resolution` → `IntelligenceProfileService.resolve(campaign.category)` (normalized exact match; active version only)
3. `profile found?` → append `renderBusinessProfileBlock(profile)`; stamp `intelligence_mode: 'profile'`
4. `no match?` → return base render unchanged; stamp `intelligence_mode: 'none'`
5. Return `{ prompt, resolution }`

**Gate:** Only business-scope `seek` prompts are amplified (§3.3). Other scopes/types pass through unchanged.

**Wiring:**
- `renderPrompt()` (L207–223) calls `resolvePrompt()` instead of `renderTemplate()` directly. Returns `prompt` string (workspace presentation — operator copies out to external LLM).
- `executeSingle()` (L110–201) calls `resolvePrompt()` instead of `renderTemplate()` directly. Uses `prompt` as the user message. Stamps `resolution` onto the execution record.
- `importExternalResult()` (`MarketingPromptService` L354+) accepts optional `resolution` metadata (`profile_id`, `profile_version`, `intelligence_mode`) and stamps it on the execution record — external-import parity (§1C).

**Regression guarantee:** No-profile path returns the base render byte-identical to today. Test: matching category → block present + provenance stamped; mismatched/absent category → byte-identical base render; inactive profile version → treated as absent; case/whitespace variants of the category string still match.

### 5.6 Provenance stamping on executions (GAP-P4, E1)

**Files touched:**
- `apps/api/src/services/MarketingPromptService.ts` — `createExecution()` + `importExternalResult()` snapshot `template_version` + `template_body_hash` (+ optional full body) from the template at execution/import time. Accept optional `resolution` metadata for §1B provenance.
- `apps/api/src/services/MarketingExecutionService.ts` — `executeSingle()` passes `resolution` to `createExecution()`.

### 5.7 IntelligenceRunService (GAP-E1) — new service

**File:** `apps/api/src/services/intelligence/IntelligenceRunService.ts` (new)

**Methods:**
- `createRun(input: { campaignId, executionId, focus, profileId?, profileVersion?, intelligenceMode, promptVersion }): Promise<IntelligenceRun>`
- `getRun(id): Promise<IntelligenceRun | null>`
- `listRunsForCampaign(campaignId): Promise<IntelligenceRun[]>`

Called after execution/import completion for intelligence-scope campaigns.

### 5.8 intelligence-discovery output schema (GAP-O1, G1, S2)

**File:** `apps/api/src/validators/intelligence-discovery.schema.ts` (new)

**Shape (§33 minimum + run-level fields):**
- `intelligence_mode`: `'profile' | 'generic_fallback'`
- `focus`: `'emerging' | 'competitive'`
- `profile_echo`: `{ profile_id, version } | null`
- `saturation_summary`: `{ candidates_considered, candidates_returned, candidates_excluded_outside_market, candidates_held }`
- `discovered_businesses[]`: per-candidate object:
  - `business_name`, `category`, `city`, `state`
  - `ownership_type` (existing enum)
  - `location_status` (existing enum + `outside_market` — excluded from final set per §24)
  - `identity_confidence`: `high | medium | low`
  - `category_fit`: `verified | probable | insufficient`
  - `discovery_signals[]`: `INT_*` codes only (no Business-Audit signal fields — §22/§30)
  - `discovery_provenance[]`: `[{ source_name, source_role, evidence_types[] }]`
  - `business_seek_recommended`: boolean
  - `business_seek_priority`: `high | medium | low | hold`
  - `why_discovered`: string
- **No** `detected_signals`, benchmarks, tiers, fees, or audit-adjacent computation (§22 deliberately drops these).

**Cross-field refinement:** Candidates with `identity_confidence` conflicts or `category_fit = 'insufficient'` must have `business_seek_priority = 'hold'` or `business_seek_recommended = false` (§26, §38).

**Registry entry:** Add to `OUTPUT_SCHEMA_REGISTRY` in `market-analysis.schema.ts`:
```ts
intelligence_discovery: {
  validator: intelligenceDiscoverySchema,
  auditPlatform: 'intelligence_discovery',
  promptSuffix: INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX,
}
```
`auditPlatform: 'intelligence_discovery'` so imports land in `mkt_audits_list` like every other analysis type, and the existing external-import endpoint works unchanged.

**Evidence-safety (GAP-S2):** The schema structurally prevents the main §31 failure mode by (a) not including any `detected_signals`/Business-Audit fields, and (b) scoping source evidence under `discovery_provenance[].evidence_types` with an enum drawn from the profile capability vocabulary. Schema-level omission is the strongest available guarantee.

### 5.9 intelligence-profile output schema + establishment import hook (GAP-P8)

**File:** `apps/api/src/validators/intelligence-profile.schema.ts` (new)

A Zod schema validating the §10 profile structure (the same structure stored in `mkt_intelligence_profiles.configuration_json`). This is the output schema for the profile-establishment template — it validates the JSON the external AI produces before it is persisted as a DRAFT profile.

**Shape (§10):**
- `terminology`: object
- `synonyms`: array
- `subcategories`: array
- `specialized_sources[]`: `{ name, type, priority, capabilities[], limitations[] }`
- `discovery_patterns`: object
- `category_evidence_rules`: object
- `prohibited_inferences[]`: string
- `category_signals[]`: string (INT_* codes)
- `.passthrough()` for forward-compatible fields

**Registry entry** in `market-analysis.schema.ts`:
```ts
intelligence_profile: {
  validator: intelligenceProfileSchema,
  auditPlatform: null,  // profiles create mkt_intelligence_profiles rows, not audits
  promptSuffix: INTELLIGENCE_PROFILE_PROMPT_SUFFIX,
}
```
`auditPlatform: null` mirrors the `recovery_resolution` pattern (L166–170) — no audit is created on import. A post-import hook handles persistence.

**Post-import hook** in `MarketingPromptService.importExternalResult()` (extend, mirroring L468–483):
```ts
// GAP-P8: best-effort profile draft creation from intelligence_profile imports.
// Catches + logs errors so a persistence failure never fails the import.
if (resolved.auditPlatform === null && schemaName === 'intelligence_profile') {
  try {
    const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService.js');
    const profile = await IntelligenceProfileService.getInstance()
      .importAsDraft({
        categoryKey: normalizeCategoryKey(parsedJson.category_name),
        categoryName: parsedJson.category_name,
        configurationJson: parsedJson,
      }, ctx);
    logger.info('Profile draft created from external import', ctx, {
      profileId: profile.id,
      version: profile.version,
      campaignId: input.campaignId,
    });
  } catch (err) {
    logger.error('Profile draft creation failed (best-effort)', ctx, {
      error: (err as Error).message,
      campaignId: input.campaignId,
    });
  }
}
```

**Profile-establishment template** (seeded): a dedicated prompt template with `scope = 'intelligence'`, `prompt_type = 'seek'`, `output_schema = { name: 'intelligence_profile' }`. The prompt instructs the external AI to produce a §10 profile JSON for a given category. Resolved via `resolvePrompt()` (workspace presentation) — the operator copies it out, runs it externally, and imports the result.

**Note:** The establishment template is NOT a discovery prompt. It does not produce `discovered_businesses[]`. Its output is the profile structure itself. This is the critical distinction from auto-generation (§3.8 normative rule 2).

### 5.10 Queue ingestion from intelligence audits (GAP-E2, G2)

**File:** `apps/api/src/services/MarketingProspectQueueService.ts` (extend)

**New method:** `ingestFromIntelligenceAudit(input: { auditId, intelligenceRunId, discoveredBusinesses[] }): Promise<{ queued, skipped, deduped }>`

- Maps each `discovered_businesses[]` entry to a queue row with the new intelligence columns (`category_fit`, `identity_confidence`, `location_status`, `discovery_provenance`, `discovery_signals`, `business_seek_priority`, `intelligence_run_id`).
- `source_kind = 'intelligence_seek'`, `source_scope = 'intelligence'`, `source_campaign_id` / `source_audit_id` / `source_execution_id` from the run.
- Dedup on name+city+category (existing mechanic). Cross-layer convergence: a business appearing in both `emerging` and `competitive` runs collapses into one entry; discovery provenance preserves which layer(s) found it.
- `business_seek_priority = 'hold'` rows are queued but flagged (not dropped) — operator sees them with disabled actions.
- Ownership exclusion (GAP-G2): drop/hold `national_chain`, `franchise`, `regional_chain` per profile/run config on ingestion (broader than the existing hot-prospect sync which skips `national_chain` only).

### 5.11 INT signal family guardrails (GAP-S1)

**Files touched:**
- `apps/api/src/services/triage/signal-extractor.ts` — verify INT codes are never extracted into triage evaluation. Extraction today pulls from `audit_data.detected_signals` of business/category audits; intelligence discoveries write to `discovery_signals` (GAP-E2), so this separation is mechanical if the naming discipline holds. Add an explicit family filter: ignore any code with `family = 'INT'` in the extraction path.
- `apps/api/src/services/triage/TriageEngineService.ts` — playbook rule evaluation excludes the INT family (verify family filtering; today families are display-grouped, not access-controlled — add an explicit exclusion).
- `apps/web/src/components/marketing-ops/` — UI badge color map gains an INT color (see §6.3).

### 5.12 Business Seek handoff with discovery context (GAP-E3)

**Files touched:**
- `apps/api/src/services/MarketingCampaignService.ts` — `deriveBusinessCampaign()` carries §39 `discovery_context` (focus, signals, sources) via `business_snapshot` into the child campaign's `attributes`/notes. Stamps `intelligence_run_id` on the child for lineage.
- `apps/api/src/services/MarketingProspectQueueService.ts` — `createCampaignFromQueue()` propagates the new intelligence fields so the lineage chain `intelligence_run → discovery (queue entry) → campaign → business audit` is queryable.
- Legacy callers unaffected (§44) — all new fields are nullable/optional.

### 5.13 Routes

**File:** `apps/api/src/routes/marketing-ops.ts` (extend)

New admin routes:
- `GET  /api/admin/marketing-ops/intelligence/profiles` — list active profiles
- `GET  /api/admin/marketing-ops/intelligence/profiles/drafts` — list draft profiles (GAP-P8 — awaiting activation)
- `GET  /api/admin/marketing-ops/intelligence/profiles/:id` — get profile (with version history)
- `POST /api/admin/marketing-ops/intelligence/profiles` — create profile (manual authoring)
- `POST /api/admin/marketing-ops/intelligence/profiles/:id/publish` — publish new version (manual authoring)
- `POST /api/admin/marketing-ops/intelligence/profiles/:id/versions/:version/activate` — activate a draft (GAP-P8 — draft → active, flips previous active to retired, atomic)
- `GET  /api/admin/marketing-ops/intelligence/runs?campaignId=` — list runs for a campaign
- `GET  /api/admin/marketing-ops/intelligence/runs/:id` — run detail (with discovered businesses)

The external-import endpoint (`POST /api/admin/marketing-ops/prompts/executions/external`) accepts optional `resolution` metadata + `focus` for intelligence-scope imports — no new route, just extended input. The `intelligence_profile` schema import triggers the post-import hook (§5.9) automatically — no new route for establishment; the operator uses the existing import endpoint and then activates via the `/activate` route.

---

## 6. Frontend Changes

### 6.1 Campaign form — Intelligence scope + focus (GAP-F1)

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` (extend)

- Scope dropdown gains `intelligence`.
- When `intelligence` selected: show Category/City/State + Focus radio (Emerging/Competitive) + advanced ZIP/radius inputs (passed as execution-time variables, not campaign fields).
- Profile resolution stays invisible to the operator (§56) — the operator does not pick a profile; the backend resolves by category.

### 6.2 IntelligenceDiscoveryAuditCard (GAP-F2)

**File:** `apps/web/src/components/marketing-ops/IntelligenceDiscoveryAuditCard.tsx` (new)

Follows the established audit-card pattern (copy `CityCategoryAnalysisAuditCard` structure):
- **Run summary header** (§57 counts): discovered / recommended / held / excluded, profile + version + mode + focus.
- **Candidate table** sorted by `business_seek_priority` (high → medium → low → hold).
- Per-row badges for `INT_*` signals and provenance source count.
- `why_discovered` expandable.
- Per-row actions reusing existing handlers:
  - **Queue** (`addToQueue` with new intelligence fields)
  - **Campaign** (`deriveBusinessCampaign` with discovery context)
- `hold` rows render disabled actions with a tooltip.
- Admin/advanced view exposes profile/prompt versions and mode per §56.

### 6.3 Queue UI — INT signal badges + provenance (GAP-F2)

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/queue/ProspectQueueClient.tsx` (extend)

- `discovery_signals` (INT family) rendered with a distinct badge color (new INT color in the family color map).
- `discovery_provenance` source count shown as a secondary badge.
- `business_seek_priority` shown as a priority indicator (distinct from the existing operator triage `priority`).
- `intelligence_run_id` links to the run detail.

### 6.4 Prompt Workspace resolution indicator (GAP-F3)

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptWorkspaceClient.tsx` (extend)

- Passive resolution indicator: "Category intelligence: auto_repair_us v1" vs. "No category profile — generic resolution."
- No workflow change — the operator still copies out the resolved prompt to an external LLM or runs it internally.
- The indicator reads from the `resolution` metadata returned by `renderPrompt()` (now `resolvePrompt()`).

### 6.5 Prompt library — fragment handling

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/` (extend)

- Scope filter gains `intelligence`.
- Fragments (`prompt_type = 'fragment'`) are hidden from the normal template list or shown with a distinct "Fragment" badge. Fragments are not executable directly — they are composition inputs.

### 6.6 Frontend services

**File:** `apps/web/src/services/MarketingOpsService.ts` (extend)
- `listIntelligenceProfiles`, `getIntelligenceProfile`, `createIntelligenceProfile`, `publishProfileVersion`
- `listIntelligenceRuns`, `getIntelligenceRun`
- `ingestFromIntelligenceAudit` (admin-triggered queue ingestion from an imported audit)

---

## 7. Sprint Breakdown

### Sprint 1 (Weeks 1–2): Provenance Foundation + Scope + Profile Subsystem

**Scope:**
- Migration 194 (`mkt_prompt_executions_list` provenance snapshot — `template_version`, `template_body_hash`, `template_body_snapshot`)
- Migration 195 (`mkt_intelligence_profiles` — immutable version rows)
- Migration 196 (`mkt_prompt_templates_list.fragment_kind`)
- Prisma schema update + `pnpm prisma:generate`
- Extract canonical Category Base from V2 doc text → seed `seek_category_base` fragment
- `intelligence` scope: extend `CampaignScope`, `PromptScope`, `SCOPE_VARIABLES` (incl. `focus`, `zip_codes`, `search_radius_miles`), queue `source_kind`/`source_scope`, `PromptType` with `'fragment'`
- `IntelligenceProfileService` (new) — `resolve`, `getVersion`, `listActive`, `createProfile`, `publishVersion` (immutable versioning, atomic active-flip), `renderProfileBlock`, `renderBusinessProfileBlock`
- Seed `auto_repair_us v1` profile with CARFAX source model (content task — see §13.3)
- Generic fallback disclosure block (GAP-P6)
- Provenance stamping: `createExecution()` + `importExternalResult()` snapshot `template_version` + `template_body_hash`; accept optional `resolution` metadata
- Admin routes: profile CRUD + publish version

**Files touched:**
- `database/migrations/194_mkt_execution_prompt_snapshot.sql` (new)
- `database/migrations/195_mkt_intelligence_profiles.sql` (new)
- `database/migrations/196_mkt_prompt_templates_fragment.sql` (new)
- `apps/api/prisma/schema.prisma` (extend — 3 tables/columns)
- `apps/api/src/services/MarketingPromptService.ts` (extend — `PromptScope`, `PromptType`, provenance stamping, `importExternalResult` resolution metadata)
- `apps/api/src/services/MarketingCampaignService.ts` (extend — `CampaignScope`)
- `apps/api/src/services/scope-utils.ts` (extend — `intelligence` in `SCOPE_VARIABLES`)
- `apps/api/src/services/MarketingProspectQueueService.ts` (extend — `source_kind`/`source_scope` unions)
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` (new)
- `apps/api/src/scripts/seed-intelligence-fragments.ts` (new — seeds `seek_category_base`, `seek_intelligence_extension`, `seek_intelligence_focus_emerging`, `seek_intelligence_focus_competitive`, generic fallback)
- `apps/api/src/scripts/seed-intelligence-profile-auto-repair.ts` (new — seeds `auto_repair_us v1`)
- `apps/api/src/routes/marketing-ops.ts` (extend — profile routes)

**Tests:**
- `apps/api/src/services/__tests__/IntelligenceProfileService.test.ts` (new):
  - `resolve` — normalized exact match on `category_key` (case/whitespace-insensitive)
  - `resolve` — miss returns null (→ generic fallback)
  - `resolve` — inactive version treated as absent
  - `getVersion` — returns historical version (immutability)
  - `publishVersion` — creates new immutable row, flips previous to `retired`, marks new `active`, atomic
  - `publishVersion` — only one active version per category key after publish
  - `renderProfileBlock` — includes terminology, specialized sources, capabilities/limitations, prohibited inferences
  - `renderBusinessProfileBlock` — includes audit-relevant slice (no discovery patterns)
- `apps/api/src/services/__tests__/ScopeIntelligenceCompat.test.ts` (new):
  - `SCOPE_VARIABLES.intelligence` includes `focus`, `zip_codes`, `search_radius_miles`
  - `assertScopeCompatible` — intelligence template + intelligence campaign → pass
  - `assertScopeCompatible` — intelligence template + business campaign → throw
  - `renderTemplate` — intelligence scope allows `focus` variable; rejects out-of-scope `business_name`
- `apps/api/src/services/__tests__/ExecutionProvenance.test.ts` (new):
  - `createExecution` snapshots `template_version` + `template_body_hash`
  - `importExternalResult` snapshots provenance + accepts `resolution` metadata
  - Template update after execution does not mutate the execution's snapshot
- `apps/api/src/tests/intelligence-profile-routes.test.ts` (new):
  - `GET /profiles` — lists active profiles
  - `POST /profiles` — creates profile
  - `POST /profiles/:id/publish` — publishes new version
  - Auth required on all routes

**TypeScript gate (end of Sprint 1 — non-negotiable):**
- `pnpm checkapi` passes with zero new errors (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` passes with zero new errors (`tsc --noEmit --project apps/web`)
- Pre-existing error count must not increase
- `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds (migrations 194–196 applied + Prisma types regenerated)
- All new migrations apply cleanly
- All Sprint 1 test suites pass
- Sprint 1 is not complete until both TS checks are green

### Sprint 2 (Weeks 3–4): Composition + Cross-Scope Resolution + Output Schema + Persistence + Profile Establishment

**Scope:**
- Migration 197 (`mkt_prospect_queue` intelligence extension — `category_fit`, `identity_confidence`, `location_status`, `discovery_provenance`, `discovery_signals`, `business_seek_priority`, `intelligence_run_id`)
- Migration 198 (`mkt_intelligence_runs`)
- Migration 199 (`INT_` signal registry seeds)
- `PromptComposerService` (new) — assembles base + extension + profile block + focus; returns assembled body + resolution metadata
- `resolvePrompt()` seam in `MarketingExecutionService` — wraps `renderTemplate()`, called by both `renderPrompt()` and `executeSingle()`; business-scope seek-only profile amplification (§1B); no-profile regression (byte-identical base render)
- `intelligence-discovery.schema.ts` (new) + registry entry + prompt suffix + hold/cross-field refinements + `outside_market` exclusion
- `intelligence-profile.schema.ts` (new — GAP-P8) + registry entry (`auditPlatform: null`) + prompt suffix — validates §10 profile structure for the establishment import path
- Profile-establishment template (seeded — GAP-P8) — dedicated prompt template with `output_schema = { name: 'intelligence_profile' }`; instructs external AI to produce a §10 profile JSON for a given category
- Post-import hook in `importExternalResult()` (GAP-P8 — mirrors L468–483 pattern) — when `auditPlatform === null` and schema is `intelligence_profile`, calls `IntelligenceProfileService.importAsDraft()` to persist as DRAFT
- `IntelligenceProfileService.importAsDraft()` + `activateDraft()` + `listDrafts()` (GAP-P8) — draft-by-default with human activation; `activateDraft` flips draft → active + previous active → retired (atomic)
- `IntelligenceRunService` (new) — create/list/get runs
- Queue ingestion: `ingestFromIntelligenceAudit()` — maps discovered businesses to queue rows with intelligence columns; dedup; cross-layer convergence; ownership exclusion (franchise/regional/national)
- INT signal family guardrails: `signal-extractor.ts` family filter; `TriageEngineService` INT exclusion
- Business Seek handoff: `deriveBusinessCampaign()` carries discovery context + `intelligence_run_id`; `createCampaignFromQueue()` propagates intelligence fields
- Admin routes: run list/detail; profile draft list + activate; external-import extended input (resolution + focus)

**Files touched:**
- `database/migrations/197_mkt_prospect_queue_intelligence.sql` (new)
- `database/migrations/198_mkt_intelligence_runs.sql` (new)
- `database/migrations/199_mkt_signal_int_family.sql` (new)
- `apps/api/prisma/schema.prisma` (extend — queue columns, `mkt_intelligence_runs` model)
- `apps/api/src/services/intelligence/PromptComposerService.ts` (new)
- `apps/api/src/services/intelligence/IntelligenceRunService.ts` (new)
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` (extend — `importAsDraft`, `activateDraft`, `listDrafts` for GAP-P8)
- `apps/api/src/services/MarketingExecutionService.ts` (extend — `resolvePrompt()`, wire into `renderPrompt()` + `executeSingle()`)
- `apps/api/src/validators/intelligence-discovery.schema.ts` (new)
- `apps/api/src/validators/intelligence-profile.schema.ts` (new — GAP-P8)
- `apps/api/src/validators/market-analysis.schema.ts` (extend — `intelligence_discovery` + `intelligence_profile` registry entries)
- `apps/api/src/services/MarketingPromptService.ts` (extend — `importExternalResult` post-import hook for `intelligence_profile` schema, GAP-P8)
- `apps/api/src/services/MarketingProspectQueueService.ts` (extend — `ingestFromIntelligenceAudit`, intelligence columns)
- `apps/api/src/services/MarketingCampaignService.ts` (extend — `deriveBusinessCampaign` discovery context + run lineage)
- `apps/api/src/services/triage/signal-extractor.ts` (extend — INT family filter)
- `apps/api/src/services/triage/TriageEngineService.ts` (extend — INT exclusion)
- `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` (new — GAP-P8, seeds the establishment template)
- `apps/api/src/routes/marketing-ops.ts` (extend — run routes, draft list + activate route, external-import extended input)

**Tests:**
- `apps/api/src/services/__tests__/PromptComposerService.test.ts` (new):
  - `composeIntelligencePrompt` — emerging + profile → base + extension + profile block + emerging focus
  - `composeIntelligencePrompt` — competitive + profile → base + extension + profile block + competitive focus
  - `composeIntelligencePrompt` — null profile → base + extension + generic fallback disclosure + focus
  - Assembled body only references intelligence-scope variables (no `business_name`)
- `apps/api/src/services/__tests__/ResolvePrompt.test.ts` (new — GAP-P7 regression):
  - Business seek + matching category → block present + `intelligence_mode: 'profile'` + provenance stamped
  - Business seek + mismatched category → byte-identical base render + `intelligence_mode: 'none'`
  - Business seek + absent category → byte-identical base render + `intelligence_mode: 'none'`
  - Business seek + inactive profile version → treated as absent
  - Business seek + case/whitespace variant of category → matches
  - Fulfill/retainer prompt → no amplification (gate: seek-only)
  - Category/city scope → no amplification (gate: business-only)
- `apps/api/src/services/__tests__/IntelligenceDiscoverySchema.test.ts` (new):
  - Enum coercion (tolerant preprocessors mirror `city-category-opportunity.schema.ts`)
  - `outside_market` candidates excluded from final set
  - `identity_confidence` conflict → `business_seek_priority = 'hold'`
  - `category_fit = 'insufficient'` → `business_seek_priority = 'hold'` or `business_seek_recommended = false`
  - No Business-Audit signal fields present (structural §31 guarantee)
  - `discovery_provenance[].evidence_types` enum from profile capability vocabulary
  - `.passthrough()` allows forward-compatible fields
- `apps/api/src/services/__tests__/IntelligenceRunService.test.ts` (new):
  - `createRun` — stamps all §41 fields
  - `listRunsForCampaign` — returns runs ordered by created_at
- `apps/api/src/services/__tests__/QueueIntelligenceIngestion.test.ts` (new):
  - `ingestFromIntelligenceAudit` — maps discovered businesses to queue rows with intelligence columns
  - Dedup on name+city+category (existing mechanic)
  - Cross-layer convergence: same business in emerging + competitive runs → one entry, provenance preserves both
  - `hold` rows queued but flagged
  - Ownership exclusion: `national_chain`/`franchise`/`regional_chain` dropped/held
- `apps/api/src/services/__tests__/SignalExtractorIntFamily.test.ts` (new):
  - INT codes in `discovery_signals` are not extracted into triage evaluation
  - INT family excluded from playbook rule evaluation
  - V3's `DS_ZERO_INDEXED_PRESENCE` alias still flows to hook library untouched (regression)
- `apps/api/src/services/__tests__/DeriveBusinessCampaignDiscovery.test.ts` (new):
  - `deriveBusinessCampaign` carries `discovery_context` (focus, signals, sources) into child
  - `deriveBusinessCampaign` stamps `intelligence_run_id` on child
  - `createCampaignFromQueue` propagates intelligence fields
  - Legacy callers (no intelligence fields) → unaffected
- `apps/api/src/tests/intelligence-run-routes.test.ts` (new):
  - `GET /runs?campaignId=` — lists runs
  - `GET /runs/:id` — run detail
  - External import with `resolution` + `focus` → stamps provenance + creates run
  - Auth required
- `apps/api/src/services/__tests__/IntelligenceProfileEstablishment.test.ts` (new — GAP-P8):
  - `intelligence_profile` schema validates §10 structure (terminology, specialized_sources with capabilities/limitations, prohibited_inferences, category_signals)
  - `importAsDraft` — persists as `status = 'draft'`, does NOT activate
  - `importAsDraft` — resolver still returns null for the category (draft is not active)
  - `activateDraft` — flips draft → active + previous active → retired (atomic)
  - `activateDraft` — resolver now returns the profile for the category
  - Post-import hook: `importExternalResult` with `intelligence_profile` schema → creates draft (no audit created, `auditPlatform: null`)
  - Post-import hook: persistence failure does not fail the import (best-effort, mirrors L468–483)
  - Discovery run never self-promotes: `intelligence_discovery` schema import does NOT create a profile (normative rule 2)
  - Business audit resolution picks up newly activated profile for free (resolver unchanged)
  - Intelligence discovery composition picks up newly activated profile for free (resolver unchanged)

**TypeScript gate (end of Sprint 2 — non-negotiable):**
- `pnpm checkapi` passes with zero new errors (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` passes with zero new errors (`tsc --noEmit --project apps/web`)
- Pre-existing error count must not increase
- `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds (migrations 197–199 applied + Prisma types regenerated)
- All new migrations apply cleanly
- All Sprint 2 test suites pass
- Sprint 2 is not complete until both TS checks are green

### Sprint 3 (Weeks 5–6): Frontend + Validation Sprint Test (spec §61)

**Scope:**
- Campaign form: Intelligence scope + focus + advanced inputs
- `IntelligenceDiscoveryAuditCard` + queue/derive actions + run summary header
- Queue UI: INT signal badges + provenance + `business_seek_priority` + run link
- Prompt Workspace resolution indicator
- Prompt library: fragment handling (hide/badge fragments)
- Frontend services: profile/run/ingest methods
- Validation sprint test (spec §61): run matrix + regression + vision-extension spot check
- Full build verification

**Files touched:**
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` (extend — intelligence scope + focus + ZIP/radius)
- `apps/web/src/components/marketing-ops/IntelligenceDiscoveryAuditCard.tsx` (new)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/queue/ProspectQueueClient.tsx` (extend — INT badges, provenance, priority, run link)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptWorkspaceClient.tsx` (extend — resolution indicator)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/` (extend — fragment handling, intelligence scope filter)
- `apps/web/src/services/MarketingOpsService.ts` (extend — profile/run/ingest methods)

**Tests:**
- Frontend component tests:
  - Campaign form renders Intelligence scope with focus radio + ZIP/radius inputs
  - `IntelligenceDiscoveryAuditCard` renders run summary header (counts, profile, mode, focus)
  - Candidate table sorted by `business_seek_priority`
  - `hold` rows render disabled actions with tooltip
  - Queue row renders INT signal badges + provenance count + run link
  - Prompt Workspace shows "Category intelligence: auto_repair_us v1" when profile resolved
  - Prompt Workspace shows "No category profile — generic resolution" when no profile
- **Validation sprint test (spec §61):**
  - Run matrix: Legacy Category V3 (`mpt-6vrf6xtz`, as-is per §45) vs Intelligence Emerging vs Intelligence Competitive × {Zionsville, Plainfield} × Auto Repair
  - V3 baseline exists: `errors/zionsville-category-import-chatgpt.md` (2026-08-13) — the §61 "V3 vs Intelligence Emerging, Zionsville" comparison starts immediately once the Intelligence side produces its first run
  - Capture §61 metrics from the new observability fields (focus, profile, mode, source counts, candidate counts)
- **Regression:**
  - Existing category/business executions + external imports unchanged (existing test suites + spot runs)
  - V3's EF/DS signal aliases continue flowing to the hook library untouched
  - Business audits in categories without a profile render byte-identical to today
- **Vision-extension spot check (§1B):**
  - Run a business audit for a Zionsville Auto Repair prospect with `auto_repair_us v1` active
  - Verify the resolved prompt contains the CARFAX capability/limitation block
  - Verify the execution record carries `profile_id`/`profile_version`/`intelligence_mode: 'profile'`
**TypeScript gate (end of Sprint 3 — non-negotiable, final sprint gate):**
- `pnpm checkapi` passes with zero new errors (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` passes with zero new errors (`tsc --noEmit --project apps/web`)
- Pre-existing error count must not increase
- `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds (all migrations 194–199 applied + Prisma types regenerated)
- All new migrations (194–199) apply cleanly
- All test suites pass (Sprint 1 + 2 + 3)
- Sprint 3 — and the entire engagement — is not complete until both TS checks are green

---

## 8. What Does NOT Change

| Component | Why it's unchanged |
|---|---|
| Category V2 prompt + docs | Spec §45 — no mandatory changes to V2/V3 or Business Seek callers |
| Category V3 (`mpt-6vrf6xtz`) | Spec §45 — remains operational as-is; the §61 baseline uses it unmodified |
| V3's `EF_*`/`DS_ZERO_INDEXED_PRESENCE` aliases | Migration 191 alias stays; hook library (`emerging-angle-map.ts`, `hook-library.ts`) consumes it untouched |
| Business audit output contract (`business_analysis` schema) | §1B — profile awareness changes research guidance only; output contract (triage, signals) is unchanged |
| `mkt_audits_list` storage model | `intelligence_discovery` is a new `auditPlatform` value; same table |
| External-import endpoint | Works unchanged for offline PoC runs; extended input (resolution + focus) is optional |
| `deriveBusinessCampaign` mechanism | Extended with discovery context + run lineage; legacy callers unaffected (additive-only) |
| Queue dedup mechanic | Name+city+category dedup reused; cross-layer convergence is a feature |
| `parent_campaign_id` lineage | Unchanged — still used for category→business derivation; `intelligence_run_id` is a separate lineage handle |
| Stage pipeline per campaign | Intelligence-scope campaigns run the same seek stage pipeline |
| Customer portal | No changes — discoveries flow through the existing queue→campaign→portal path |
| `assertScopeCompatible` | Works unchanged (string comparison); just a new scope value in the union |
| `renderTemplate()` variable substitution | Works unchanged on the assembled body; composer produces a string with `{{variable}}` placeholders |
| `IntelligenceProfileService.resolve()` | Unchanged by GAP-P8 — only returns active profiles, so both consumers (business audit resolution, intelligence discovery) pick up newly activated profiles for free |
| `importExternalResult()` core flow | Unchanged by GAP-P8 — the post-import hook is additive (best-effort, mirrors L468–483); the `intelligence_profile` schema uses `auditPlatform: null` (mirrors `recovery_resolution`) so no audit is created |

---

## 9. MVP Acceptance Criteria Mapping (spec §59)

| Criterion | Closed by |
|---|---|
| `intelligence` valid Seek scope | Sprint 1 — GAP-P2 |
| Existing scopes remain operational | Sprint 3 — regression tests |
| Prompts extend Category framework, not duplicated | Sprint 1–2 — GAP-P1 (composer) + canonical base extraction |
| Composition includes all 4 components | Sprint 2 — GAP-P1, P5 |
| Accepts category/city/state/focus | Sprint 1 — GAP-P2, P3 |
| Focus `emerging` / `competitive` | Sprint 2 — GAP-P3, P1 (focus fragments) |
| Run records `prompt_version` | Sprint 1 — GAP-P4 (provenance snapshot) |
| Run records `profile_version` | Sprint 2 — GAP-E1 (`mkt_intelligence_runs`) |
| Profile defines specialized sources | Sprint 1 — GAP-P5 (hand-seed) + Sprint 2 — GAP-P8 (establishment loop for additional categories) |
| Source capabilities / prohibited inferences | Sprint 1 — GAP-P5 (JSON structure) + Sprint 2 — GAP-P8 (establishment import validates §10 structure) |
| Generic fallback | Sprint 1 — GAP-P6 |
| Returns qualifying discovered businesses | Sprint 2 — GAP-O1 |
| Candidates: category fit | Sprint 2 — GAP-O1, E2 |
| Candidates: identity confidence | Sprint 2 — GAP-O1, E2 |
| Candidates: location status | Sprint 2 — GAP-O1 (reusable enum) |
| Candidates: discovery signals | Sprint 2 — GAP-S1, O1 |
| Candidates: discovery provenance | Sprint 2 — GAP-E2, O1 |
| Candidates: Business Seek recommendation + priority | Sprint 2 — GAP-O1, E2 |
| Signal families stay separate | Sprint 2 — GAP-S1 |
| Missing evidence ≠ deficiency | Sprint 2 — GAP-S2, O1 (structural schema omission) |
| Chain/franchise exclusion | Sprint 2 — GAP-G2 (ingestion filter) + prompt base |
| Deduplication | Reused (queue dedup) |
| Candidate launches Business Seek | Sprint 2 — GAP-E3 wiring |
| Optional Intelligence parentage on Business Seek | Sprint 2 — GAP-E3 |
| Legacy Business Seek callers compatible | Design constraint (additive-only) |
| No mandatory Category V2/V3 modification | Design constraint (§45) |

---

## 10. Gap Register Summary

| # | Gap | Layer | Severity | Effort | Sprint |
|---|---|---|---|---|---|
| GAP-P1 | No prompt composition (runtime fragments) | Prompt | High | M | 2 |
| GAP-P2 | `intelligence` absent from scope system | Cross-cutting | High | L | 1 |
| GAP-P3 | Focus parameter (`emerging`/`competitive`) | Prompt/Runtime | Medium | L | 1–2 |
| GAP-P4 | Prompt-version provenance unreliable | Data/Runtime | High | S | 1 |
| GAP-P5 | Category Intelligence Profile store + resolver + immutable versioning | Data/Service | High | M | 1 |
| GAP-P6 | Generic fallback template + `intelligence_mode` disclosure | Prompt/Runtime | Medium | L | 1 |
| GAP-P7 | Profile-amplified business prompt resolution (§1B) | Service | Medium | L–M | 2 |
| GAP-P8 | Profile establishment loop (operator-driven: establishment template + external import + draft/activate lifecycle) | Service/Validator | Medium | M | 2 |
| GAP-E1 | Intelligence run record | Data | High | M | 2 |
| GAP-E2 | Discovered-business persistence (queue extension) | Data | High | M | 2 |
| GAP-E3 | Handoff carries discovery context; lineage queryable | Service | Medium | L | 2 |
| GAP-S1 | `INT_` signal family + triage/UI separation | Service | Medium | L | 2 |
| GAP-S2 | Evidence-safety enforcement (schema omission) | Validator | Medium | S | 2 |
| GAP-O1 | `intelligence_discovery` output schema + registry + suffix | Validator | High | M | 2 |
| GAP-G1 | `outside_market` classification + exclusion | Validator | Low | S | 2 |
| GAP-G2 | Broader ownership exclusion on ingestion | Service | Low | S | 2 |
| GAP-F1 | Scope + focus selection UI | Frontend | Medium | L–M | 3 |
| GAP-F2 | Intelligence results card + candidate actions | Frontend | Medium | M | 3 |
| GAP-F3 | Prompt Workspace resolution indicator (§1B) | Frontend | Low | S | 3 |
| GAP-B1 | Observability fields (focus/profile/mode/source rollups) | Data | Low | S | 2 (fields recorded; no metrics pipeline) |

---

## 11. Operating Workflow (confirmed 2026-08-14)

```text
New market + category
        ↓
Intelligence-scope campaign (category, city, state)
        ↓
┌─────────────────────────────┬─────────────────────────────┐
│ Run 1: focus = competitive  │ Run 2: focus = emerging     │
└─────────────────────────────┴─────────────────────────────┘
        ↓ per run: backend resolution (resolvePrompt / composeIntelligencePrompt)
Category Base + Intelligence Extension + Profile (if category match) + Focus Modifier + Market Inputs
        ↓
┌─────────────────────────────┬─────────────────────────────┐
│ Path A: internal AI         │ Path B: external AI         │
│ executeSingle() via         │ copy resolved prompt from   │
│ configured provider         │ workspace → run externally  │
│ (capped maxTokens: 2000)    │ → import JSON via           │
│                             │ /executions/external        │
└─────────────────────────────┴─────────────────────────────┘
        ↓ both paths produce identical artifacts
Execution record + intelligence run + intelligence_discovery audit
        ↓ validated import/parse
Discovered businesses → prospect queue (cross-layer dedup)
        ↓ per candidate
Business Seek → profile-aware business audit (§1B) → triage → campaign
```

**Properties:**
1. Dual execution paths already exist and are inherited for free. New work is resolution + provenance parity across both (GAP-P7).
2. Two layers, one campaign. Executions are already many-per-campaign; the run record's `focus` field distinguishes them.
3. Cross-layer convergence is a feature. Queue dedup collapses businesses surfaced by both layers into one entry; discovery provenance preserves which layer(s) found it.
4. Layer roles stay distinct (§15/§16): competitive builds the benchmarking set; emerging builds the prospect set. Same profile, same category base — only the focus modifier differs.
5. **Practical constraint:** internal execution is capped at `maxTokens: 2000` — path B (external run + import) is the realistic execution mode for the PoC, exactly as V3 operates today.

### 11A. Profile Establishment Workflow (GAP-P8)

The discovery workflow above assumes a profile already exists for the category. The establishment workflow bootstraps a profile for a new category using the same external-import machinery:

```text
New category without a profile
        ↓
Profile-establishment template resolved by backend (resolvePrompt)
        ↓
Resolved prompt exposed in workspace
        ↓
Operator runs it in external AI
        ↓
Import via /executions/external
        ↓ Zod-validated against §10 profile structure (intelligence_profile schema, auditPlatform: null)
        ↓ post-import hook persists as DRAFT (IntelligenceProfileService.importAsDraft)
        ↓
Operator reviews draft → activates (POST /profiles/:id/versions/:version/activate)
        ↓ draft → active; previous active → retired (atomic)
        ↓
Business audits in that category now resolve profile-aware prompts (§1B)
        ↓ resolver unchanged — resolve() only returns active profiles
Intelligence discovery runs switch from generic_fallback to profile mode (§19)
        ↓ resolver unchanged — composeIntelligencePrompt picks up active profile for free
```

**Properties:**
1. **Rides existing import machinery.** `importExternalResult` is already generic over registry-declared output schemas. The `recovery_resolution` entry (`auditPlatform: null`) proves the registry supports non-audit outputs. The post-import hook mirrors the `business_analysis` auto-sync pattern (L468–483).
2. **Draft-by-default with human activation.** Profiles silently shape every future prompt resolved for that category — imported profiles must not go live without operator approval. The import persists as `status = 'draft'`; a separate `activate` action flips it to `active`.
3. **Discovery runs never self-promote into profiles.** The establishment template is a *profile-authoring* prompt, not a *discovery* prompt. Its output schema is `intelligence_profile` (§10 structure), not `intelligence_discovery` (discovered businesses). A `generic_fallback` discovery run's findings do not become a profile.
4. **Resolver never changes.** `IntelligenceProfileService.resolve()` only returns active profiles, so both consumers (business audit resolution, intelligence discovery composition) pick up newly activated profiles for free — no resolver code change needed.
5. **PoC seed vs. establishment.** `auto_repair_us v1` is hand-seeded for the PoC (the establishment template needs a known-good profile format to validate against). The establishment loop is the scalable path for additional categories beyond the PoC.

---

## 12. Sprint Summary

| Sprint | Weeks | Focus | Migrations | Key Deliverables |
|---|---|---|---|---|
| 1 | 1–2 | Provenance + Scope + Profile | 194, 195, 196 | Execution provenance snapshot; `intelligence` scope; `IntelligenceProfileService` + `auto_repair_us v1` hand-seed; canonical Category Base fragment; generic fallback; profile admin routes |
| 2 | 3–4 | Composition + Resolution + Output + Persistence + Profile Establishment | 197, 198, 199 | `PromptComposerService`; `resolvePrompt()` seam (§1B); `intelligence_discovery` schema; `intelligence_profile` schema + establishment template + import hook + draft/activate lifecycle (GAP-P8); `IntelligenceRunService`; queue ingestion; INT signal family + guardrails; Business Seek handoff with discovery context |
| 3 | 5–6 | Frontend + Validation | — | Campaign form (scope + focus); `IntelligenceDiscoveryAuditCard`; queue INT badges; Prompt Workspace resolution indicator; §61 run matrix; regression + vision-extension spot check; full build verification |

---

## 13. Open Questions — Resolved

### 13.1 Composition: runtime fragments vs. generated monoliths? — RESOLVED

**Decision:** Option A — runtime fragment composition (§3.1). The §1B vision (profile-amplified business resolution) tips the recommendation toward A: profile injection is one resolver call shared by both scopes, and profile edits propagate to future resolutions with correct version stamping. Under Option B, profile-amplified business audits would require regenerating profile-augmented variants of every business template per profile version.

### 13.2 Should §1B (profile-amplified business resolution) be in this sprint? — RESOLVED

**Decision:** Yes — included in this sprint (§3.2). LOW–MEDIUM effort; rides the existing single-seam design; increases the urgency of GAP-P4 provenance work (which is already in Sprint 1).

### 13.3 Which business prompt types get profile amplification? — RESOLVED

**Decision:** Seek business audits only (§3.3). Smallest blast radius. Extension to fulfill/retainer is a one-line gate change in `resolvePrompt()` once validated.

### 13.4 Token budget for in-platform execution? — DEFERRED

Internal executions are capped at `maxTokens: 2000` (`executeSingle` L145). The PoC uses path B (external run + import). Per-execution model/token configuration is a real requirement if profile-amplified prompts make in-platform execution more attractive, but is deferred to a follow-on. The sprint should call this out so "internal AI" isn't assumed to work out of the box for full discovery JSON.

### 13.5 Profile authoring ownership? — PARTIALLY RESOLVED (GAP-P8)

The **establishment loop** (GAP-P8, §3.8) provides an operator-driven authoring path: a dedicated template is resolved, run in an external AI, imported via `/executions/external`, Zod-validated against the §10 profile structure, and persisted as a DRAFT. The operator reviews and activates it. This replaces manual JSON authoring for categories beyond the PoC.

For the PoC itself, `auto_repair_us v1` is **hand-seeded** (via `seed-intelligence-profile-auto-repair.ts`) because the establishment template needs a known-good profile format to validate against. The hand-seeded profile is the reference shape for the `intelligence_profile` Zod schema. A human reviewer must still approve `prohibited_inferences` content regardless of whether the profile arrives via hand-seed or the establishment loop — this is a content-review gate, not an engineering one.

### 13.6 CARFAX access? — OPEN (test design)

The profile assumes CARFAX-sourced evidence is reachable by the executing model. Confirm the research channel (external LLM with browsing? in-platform model with tools?) can actually reach it. This affects the §61 test design more than the code.

### 13.7 V3's signal mixing — accept slimmer Intelligence output? — RESOLVED

**Decision:** Yes. The Intelligence output schema is slimmer than V3's contract — no benchmarks, tiers, fees, or Business-Audit signals (§22). The spec's §57 summary UI implies the slimmer shape. V3 remains operational for those who want the richer output; Intelligence is a parallel scope with strict signal-family separation (§30).

---

## 14. Start-of-Sprint Pre-Flight Checklist

Before Sprint 1 begins, confirm:

- [ ] `auto_repair_us v1` profile content (§10 structure with CARFAX source model) is drafted and approved — this is the critical-path content task for the PoC hand-seed (§13.5). The establishment loop (GAP-P8) provides the operator-driven path for additional categories beyond the PoC, but the hand-seed must exist first as the reference shape for the `intelligence_profile` Zod schema.
- [ ] Canonical Category Base text extracted from V2 doc (`docs/LocalBiz/Audit Prompts/…prompt - v2 - Seek.md`) — the same text V3 references
- [ ] `errors/mpt-6vrf6xtz-prompt-body.md` (V3 prompt) and `errors/zionsville-category-import-chatgpt.md` (V3 Zionsville run) are available as the §61 baseline
- [ ] Migration numbering confirmed: next is 194 (current latest is `193_mkt_prospect_queue_business_name_nullable.sql`)
- [ ] `pnpm checkapi` + `pnpm checkweb` pass cleanly on the current baseline (no pre-existing errors to distinguish from sprint errors)
- [ ] `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds on the current baseline
- [ ] CARFAX research channel confirmed for the §61 test design (§13.6)
- [ ] Team sign-off on Option A (runtime composition) + §1B inclusion + seek-only amplification (§3.1–§3.3)
