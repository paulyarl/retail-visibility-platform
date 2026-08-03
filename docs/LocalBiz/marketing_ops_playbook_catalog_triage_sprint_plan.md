# Intelligent Playbook Catalog & Triage Engine — Sprint Analysis

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-02
**Companion docs:** `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md`, `docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md`, `docs/RECOVERY_MANAGEMENT_ENGINE_SPRINT_PLAN.md`

---

## 1. Problem / Objective

The functional spec adds an **Intelligent Playbook Catalog & Automated Triage Engine** that sits between audit ingestion and campaign initialization. It must:

1. Evaluate raw audit signals from GBP, BBB, Yelp, website, and NAP data.
2. Match those signals to a pre-seeded catalog of standardized playbooks.
3. Recommend a `Campaign Category`, `Archetype`, `FITD Offer`, and `Retainer Pitch`.
4. Expose an admin UI to manage the catalog and accept/override triage recommendations per campaign.

This sprint analysis decomposes the spec into concrete, codebase-aware work streams, estimates, and risks.

---

## 2. Current State (What Already Exists)

The Marketing Ops module already has most of the infrastructure the spec needs. The work is additive, not greenfield.

### 2.1 Data Layer

- `mkt_campaigns_list` (`apps/api/prisma/schema.prisma:6088`):
  - `campaign_category` (VARCHAR 30, default `review_management`) with existing values `review_management`, `recovery_management`, `profile_repair`.
  - `repair_track` (VARCHAR 20) and `track_decided_at` / `track_decision_reason` already capture track decisions.
  - `package_price_cents`, `retainer_amount_cents`, `estimated_fee_cents` already exist.
  - `last_review_date`, `unaddressed_reviews`, `nap_consistent`, `has_website`, `website_url` already store key triage signals.
- `mkt_audits_list` (`schema.prisma:6049`):
  - `platform` (VARCHAR 50) with `business_analysis` as the canonical multi-signal audit.
  - `audit_data` JSONB holds structured output.
- `mkt_deliverable_templates_list` and `mkt_outreach_openers_list` already support template references and opener generation.

### 2.2 Business Logic

- `apps/api/src/services/outreach-openers/archetype-selection.ts` already does deterministic archetype selection (`A2 > A1 > A3 > A4` — recurring-theme negatives win on specificity+urgency) from `business_analysis` audit_data. **Note:** the triage cascade in §6.2 is a separate, higher-level scheme (PB-04 → PB-05 → PB-01 → PB-02 → PB-06 → PB-03) that supersedes this ordering when a triage result is present.
- `apps/api/src/services/outreach-openers/archetype-prompts.ts` has prompt builders for `A1`–`A4`.
- `apps/api/src/routes/marketing-ops.ts` is the existing admin/operator route surface.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/` already hosts the admin UI for campaigns, openers, follow-ups, deliverables, etc.

### 2.3 Track / Triage Pattern

The `profile_repair` category already introduced a "triage-first" pattern: campaign starts in `seek`, the track is decided later, and the decision is logged in `track_decision_reason` / `track_decided_at` (`MarketingCampaignService.ts:902`). This is the same lifecycle concept the spec generalizes to all campaigns.

---

## 3. Gap Analysis: Spec vs. Codebase

| Spec Item | Codebase Reality | Implication |
|-----------|------------------|-------------|
| `PlaybookCategory` enum (`REVIEW_MANAGEMENT`, `RECOVERY_MANAGEMENT`, `TRIAGE_MANAGEMENT`) | `campaign_category` is a `VarChar(30)` with values `review_management`, `recovery_management`, `profile_repair`. No DB enums are used in this schema. | Add `triage_management` as a valid app-level constant; keep DB as VARCHAR. |
| `TargetArchetype` (`A1_REVIEW_GAP` ... `A5_DUAL_TRIAGE`) | Archetype codes are currently `A1`–`A4` (`ArchetypeCode`), selected with priority `A2 > A1 > A3 > A4`. Prompts switch on the 2-char code. | Add `A5` to `ArchetypeCode`; store a separate `archetype_label` in the catalog. The triage cascade (PB-04→PB-05→PB-01→PB-02→PB-06→PB-03) is a *separate* scheme that supersedes the existing `selectArchetype` ordering when a triage result is present. |
| `PlaybookCatalog` / `CampaignTriageResult` models | Do not exist. | Two new migrations + Prisma models required. |
| BBB grade and unanswered BBB complaints | No BBB signal in audit data. Only a test fixture references BBB in `DisputeIntakeService.test.ts`. | Rule 1 (PB-04 BBB recovery) is **blocked on a BBB data source**. See risk #1. |
| Deterministic `evaluateTriage` with hardcoded confidence | No existing `TriageEngineService`. | New pure service + unit tests. |
| Admin Playbook Catalog page | Does not exist. | New Next.js route under `/settings/admin/marketing-ops/`. |
| Campaign triage card with Accept/Override | Does not exist. | Add to `CampaignDetailClient.tsx` and call new API. |
| `openerPromptTemplateId` on playbook | Existing openers are built from `archetype-prompts.ts`, not DB templates. | Decide whether to template-ize prompts in DB or keep the prompt builder keyed by archetype. |
| Standardized `detected_signals: SignalCode[]` array (5 families: RA/DS/WC/CP/VP) | Audit outputs are free-form `audit_data` JSON; no signal codes exist. `business_analysis` audits have the raw fields but not the taxonomy. | New `signal-taxonomy.ts` + extractor + audit prompt contract update (Sprint 2A). Legacy audits derive codes from raw fields. |
| PB-06 Visual & Asset Refresh | Not in original spec. | New seed row; new cascade tier; reuses A3 archetype (no new prompt needed). |
| Admin-managed dynamic rules (future unknown signals) | Hardcoded TS unions (`SignalCode`) and hardcoded cascades cannot absorb new signals/playbooks without a deploy. | Signals become data (`mkt_signal_registry` table); the engine becomes a generic set-membership evaluator; admins add signals + playbook rules via a Rule Builder UI (Sprint 4 extension). |

---

## 4. Proposed Architecture

```
┌────────────────────────┐
│  Raw Audit Ingestion   │ (mkt_audits_list.audit_data, campaign columns)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ SignalExtractor        │ ── Emits SignalCode[] from audit_data + columns
│ + TriageEngineService  │ ── GENERIC evaluator: set-membership over rules,
│                        │    no per-playbook hardcoded branches
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ mkt_signal_registry    │ ── Signal codes as DATA (admin-extensible)
│ mkt_playbook_catalog   │ ── Catalog (PB-01..PB-06 + future) w/ priority_rank
│ mkt_campaign_triage    │ ── Per-campaign result + operator override
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Admin UI               │ ── Playbook list/editor, campaign triage card
└────────────────────────┘
```

### 4.1 Signal Sources

The `SignalExtractor` should consume both `mkt_campaigns_list` columns and the latest `business_analysis` audit (`platform = 'business_analysis'`) in `mkt_audits_list.audit_data`.

| Signal | Source Today | Notes |
|--------|---------------|-------|
| `hasDeadUrl` / `urlMismatch` | `audit_data.website.status`, `website_url` | Need parser for dead/mismatch vs HTTPS. |
| `napInconsistent` | `mkt_campaigns_list.nap_consistent` + `audit_data.nap_consistency` | Use canonical NAP material issues. |
| `daysSinceLastReview` | `mkt_campaigns_list.last_review_date` | Compute `NOW() - last_review_date`. |
| `unaddressedReviewCount` | `mkt_campaigns_list.unaddressed_reviews` | Already computed. |
| `hasCtaFriction` | `audit_data.website` (`call_to_action_present`, `click_to_call_available`, `has_booking`) | Combine booleans. |
| `googleRating` | `audit_data.platforms.google.rating` | Platform-specific. |
| `bbbGrade` / `unansweredBbbComplaints` | **No automated source**; operator input possible | See risk #1. Can be collected via a triage pre-flight form/campaign field until BBB scraping exists. |

---

## 5. Data Model

### 5.1 Migration SQL

```sql
-- Migration: database/migrations/157_mkt_playbook_catalog.sql
-- Naming follows the codebase convention (NNN_descriptive_name.sql, 3-digit
-- numbered, executed in order — see database/migrations/README.md). RLS is
-- intentionally omitted: mkt_* tables are platform-admin scoped global tables,
-- not tenant-scoped (no RLS exists on mkt_campaigns_list / mkt_audits_list).
-- updated_at is managed by Prisma @updatedAt, not a DB trigger.
-- After running: cd apps/api && npx prisma db pull && npx prisma generate.

CREATE TABLE IF NOT EXISTS mkt_playbook_catalog (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,              -- e.g. 'PB-01'
  name VARCHAR(255) NOT NULL,
  category VARCHAR(30) NOT NULL,                 -- review_management, recovery_management, triage_management
  archetype VARCHAR(20) NOT NULL,                -- A1..A5
  archetype_label VARCHAR(40) NOT NULL,          -- e.g. 'A5_DUAL_TRIAGE'
  description TEXT,
  matching_rules JSONB NOT NULL DEFAULT '{}',    -- triggering signal groups (Sprint 2A matrix)
  priority_rank INT NOT NULL,                    -- cascade evaluation order: PB-04=1, PB-05=2, PB-01=3, PB-02=4, PB-06=5, PB-03=6
  fitd_offer_title VARCHAR(255) NOT NULL,
  fitd_default_fee_cents INT NOT NULL DEFAULT 0,
  retainer_pitch_title VARCHAR(255) NOT NULL,
  retainer_fee_cents INT NOT NULL DEFAULT 0,
  opener_prompt_template_id VARCHAR(255),
  preview_deliverable_type VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signal registry: signals as DATA so admins can register future unknown
-- signals without an engine deploy. detection_source tells the extractor how
-- the signal is produced:
--   model_emitted  — audit LLM output includes the code in detected_signals[]
--   derived        — computed from raw audit/campaign fields by code (thresholds)
--   operator_input — manually supplied (e.g. BBB pre-flight inputs)
CREATE TABLE IF NOT EXISTS mkt_signal_registry (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,              -- e.g. 'RA_REVIEW_DROUGHT'
  family VARCHAR(10) NOT NULL,                   -- RA, DS, WC, CP, VP (extensible)
  label VARCHAR(255) NOT NULL,                   -- e.g. 'Review Drought (>180 days)'
  description TEXT,
  detection_source VARCHAR(20) NOT NULL DEFAULT 'model_emitted',
  derived_rule JSONB,                            -- only for detection_source='derived': { field, op, threshold }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mkt_campaign_triage_results (
  id VARCHAR(255) PRIMARY KEY,
  campaign_id VARCHAR(255) NOT NULL UNIQUE,
  recommended_playbook_id VARCHAR(255) NOT NULL,
  confidence_score NUMERIC(4,3) NOT NULL,        -- 0.000 to 1.000
  triage_reasoning TEXT,
  detected_signals JSONB NOT NULL DEFAULT '[]',
  is_operator_accepted BOOLEAN,                  -- null = pending, true = accepted, false = overridden
  overridden_playbook_id VARCHAR(255),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_campaign_triage_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_triage_playbook
    FOREIGN KEY (recommended_playbook_id) REFERENCES mkt_playbook_catalog(id),
  CONSTRAINT fk_campaign_triage_override_playbook
    FOREIGN KEY (overridden_playbook_id) REFERENCES mkt_playbook_catalog(id)
);

CREATE INDEX idx_mkt_playbook_catalog_code ON mkt_playbook_catalog(code);
CREATE INDEX idx_mkt_playbook_catalog_active ON mkt_playbook_catalog(is_active, priority_rank);
CREATE INDEX idx_mkt_signal_registry_code ON mkt_signal_registry(code);
CREATE INDEX idx_mkt_signal_registry_family ON mkt_signal_registry(family, is_active);
CREATE INDEX idx_mkt_campaign_triage_campaign ON mkt_campaign_triage_results(campaign_id);
```

### 5.2 Prisma Models

```prisma
model mkt_signal_registry {
  id               String   @id @db.VarChar(255)
  code             String   @unique @db.VarChar(60)
  family           String   @db.VarChar(10)
  label            String   @db.VarChar(255)
  description      String?
  detection_source String   @default("model_emitted") @db.VarChar(20)
  derived_rule     Json?    @db.Json
  is_active        Boolean  @default(true)
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @default(now()) @db.Timestamptz(6)
}

model mkt_playbook_catalog {
  id                        String     @id @db.VarChar(255)
  code                      String     @unique @db.VarChar(20)
  name                      String     @db.VarChar(255)
  category                  String     @db.VarChar(30)
  archetype                 String     @db.VarChar(20)
  archetype_label           String     @db.VarChar(40)
  description               String?
  matching_rules            Json?      @db.Json
  priority_rank             Int
  fitd_offer_title          String     @db.VarChar(255)
  fitd_default_fee_cents    Int
  retainer_pitch_title      String     @db.VarChar(255)
  retainer_fee_cents        Int
  opener_prompt_template_id String?    @db.VarChar(255)
  preview_deliverable_type  String?    @db.VarChar(50)
  is_active                 Boolean    @default(true)
  created_at                DateTime   @default(now()) @db.Timestamptz(6)
  updated_at                DateTime   @default(now()) @db.Timestamptz(6)

  mkt_campaign_triage_results                 mkt_campaign_triage_results[]
  mkt_campaign_triage_results_override        mkt_campaign_triage_results[] @relation("mkt_campaign_triage_results_overridden_playbook")
}

model mkt_campaign_triage_results {
  id                     String   @id @db.VarChar(255)
  campaign_id            String   @unique @db.VarChar(255)
  recommended_playbook_id String  @db.VarChar(255)
  confidence_score       Decimal  @db.Decimal(4, 3)
  triage_reasoning       String?
  detected_signals       Json?    @db.Json
  is_operator_accepted   Boolean?
  overridden_playbook_id String?  @db.VarChar(255)
  evaluated_at           DateTime @default(now()) @db.Timestamptz(6)
  created_at             DateTime @default(now()) @db.Timestamptz(6)
  updated_at             DateTime @default(now()) @db.Timestamptz(6)

  campaign            mkt_campaigns_list    @relation(fields: [campaign_id], references: [id], onDelete: Cascade)
  playbook            mkt_playbook_catalog  @relation(fields: [recommended_playbook_id], references: [id])
  overridden_playbook mkt_playbook_catalog? @relation("mkt_campaign_triage_results_overridden_playbook", fields: [overridden_playbook_id], references: [id])
}
```

### 5.3 Seed Data (6 Standard Playbooks)

Seed values below reflect the **Master Signal-to-Playbook Alignment Matrix** (Sprint 2A), which supersedes the original spec's offer naming. PB-06 is new with the signal taxonomy.

| Code | Name | Category | Archetype | FITD | Retainer |
|------|------|----------|-----------|------|----------|
| PB-01 | Profile Repair & Listing Drift | `review_management` | `A3` | $149 One-Time Citation & Profile Alignment Package | $199/mo Listing Synchronization & Search Defense |
| PB-02 | Review Gap & Stagnation | `review_management` | `A1` | $99 One-Time Review Acceleration & Response Pack | $199/mo Automated Review Acquisition Engine |
| PB-03 | Conversion & Surface Friction | `review_management` | `A4` | $199 One-Time Website & Surface Conversion Fix | $299/mo Conversion & Local SEO Retainer |
| PB-04 | Admin Neglect (BBB Recovery) | `recovery_management` | `A2` | $349 One-Time BBB Settlement & Dispute Package | $399/mo Reputation Defense & Risk Shield |
| PB-05 | Multi-Signal Footprint Triage | `triage_management` | `A5` | $249 One-Time Complete Digital Footprint Audit & Repair | $299/mo Full Local Reputation & Listing Retainer |
| PB-06 | Visual & Asset Refresh | `review_management` | `A3` | $149 One-Time GBP Media & Project Asset Optimization | $199/mo Ongoing Local Content & Photo Refresh |

---

## 6. Triage Rules Engine

### 6.1 Inputs

> **Superseded by Sprint 2A:** the engine's public input is a standardized `SignalCode[]` array (see Sprint 2A). The `NormalizedSignals` interface below survives only as the extractor's *internal* working shape for threshold computations (e.g., computing `daysSinceLastReview` before emitting `RA_REVIEW_DROUGHT`). Do not expose `NormalizedSignals` to the engine or API.

```typescript
// Engine input (canonical):
export type TriageInput = SignalCode[];   // e.g. ["WC_URL_MISMATCH", "RA_REVIEW_DROUGHT", ...]

// Extractor-internal detail shape (NOT the engine input):
export interface NormalizedSignals {
  bbbGrade?: string;                       // 'A+' ... 'F'
  googleRating?: number;
  unansweredBbbComplaints: number;
  hasDeadUrl: boolean;
  urlMismatch: boolean;
  napInconsistent: boolean;
  daysSinceLastReview: number;
  unaddressedReviewCount: number;
  hasCtaFriction: boolean;
}
```

### 6.2 Deterministic Priority Cascade (Seeded Default)

**The engine is a generic evaluator, not hardcoded branches.** The cascade below is simply the *seeded state* of `mkt_playbook_catalog` (`priority_rank` + `matching_rules`). The engine loads active playbooks ordered by `priority_rank` and evaluates each playbook's rules against the `SignalCode[]` set until one matches. Admins can reorder, add, or disable playbooks/rules from the UI without a deploy (see §6.4).

The seeded cascade reflects the **Master Alignment Matrix** and supersedes the original spec's five-rule list (PB-06 inserted as a new specific tier ahead of the fallback):

1. **Rule 1 — BBB Emergency Recovery** (`PB-04`) — `RA_BBB_GRADE_SUPPRESSION` or `RA_UNANSWERED_COMPLAINTS` (or `RA_UNADDRESSED_NEGATIVE_BACKLOG` per matrix).
2. **Rule 2 — Multi-Signal Triage** (`PB-05`) — any repair signal (`CP_*`, `WC_URL_MISMATCH`, `WC_BROKEN_WEBSITE`, `DS_BROKEN_PROFILE_LINK`) **and** any review signal (`RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME`, `RA_UNADDRESSED_*_BACKLOG`) present simultaneously, with no active crisis.
3. **Rule 3 — Pure Profile Repair** (`PB-01`) — repair signals only (`CP_NAP_*_DRIFT`, `WC_URL_MISMATCH`).
4. **Rule 4 — Pure Review Gap** (`PB-02`) — review signals only (`RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME`, `RA_UNADDRESSED_POSITIVE_BACKLOG`).
5. **Rule 5 — Visual & Asset Refresh** (`PB-06`) — visual signals only (`VP_*`, `DS_PHOTO_DEFICIT`).
6. **Rule 6 — Fallback Conversion Gap** (`PB-03`) — `WC_MISSING_CTA`, `WC_MISSING_SERVICE_PAGES`, `DS_MISSING_SERVICE_MENU`, or no actionable signals.

Hardcoded confidence scores:

- PB-04: `0.95`
- PB-05: `0.90`
- PB-01 / PB-02: `0.85`
- PB-06: `0.80`
- PB-03: `0.70`

### 6.3 Deterministic Note

Because the rules are entirely deterministic, `confidenceScore` is a proxy for rule specificity/severity, not a statistical probability. This is acceptable but should be documented so operators do not misinterpret it as ML confidence. Confidence values are stored per-playbook in the catalog (seeded as below) so admins can tune them with the rules.

### 6.4 Rules DSL (Admin-Managed Dynamic Rules)

`matching_rules` JSONB on `mkt_playbook_catalog` uses one small DSL evaluated by set membership over the campaign's `SignalCode[]`:

```json
{
  "any": ["WC_URL_MISMATCH", "CP_NAP_NAME_DRIFT"],          // ≥1 present → match
  "all": [],                                                 // every code must be present
  "none": ["RA_BBB_GRADE_SUPPRESSION"],                      // match fails if any present (crisis guard)
  "dual": {                                                  // PB-05-style dual trigger
    "groupA": ["CP_NAP_NAME_DRIFT", "WC_URL_MISMATCH"],
    "groupB": ["RA_REVIEW_DROUGHT", "RA_LOW_REVIEW_VOLUME"]
  },
  "confidence": 0.85
}
```

Evaluation semantics:

- A playbook matches when: at least one `any` code is present (or `any` is empty), **and** every `all` code is present, **and** no `none` code is present, **and** (if `dual` set) ≥1 code from each of `groupA` and `groupB` is present.
- First match in `priority_rank` order wins. `none` is how PB-05 expresses "no active BBB crisis."
- Unknown codes in rules or detected signals are ignored with a warning log — forward-compatible with signals registered later.

**Why this scales to future unknowns:** when a new signal appears (e.g., `RA_AI_REVIEW_SPAM`), the flow is: (1) admin registers the code in the signal registry with a label/family, (2) the audit prompt is updated to emit it, (3) the admin adds it to an existing playbook's rule or creates a new playbook — all without touching the engine. Only `derived` signals (threshold-computed from raw fields) require code; `model_emitted` and `operator_input` signals are fully dynamic.

---

## 7. Sprints

### Sprint 1: Data Layer (2–3 days)

1. Migration file `database/migrations/157_mkt_playbook_catalog.sql` for `mkt_playbook_catalog` and `mkt_campaign_triage_results` (indexes only — **no RLS, no triggers**; mkt_* tables are platform-admin scoped and `updated_at` is managed by Prisma `@updatedAt`). Naming follows the codebase convention (`NNN_descriptive_name.sql`, 3-digit numbered — see `database/migrations/README.md`; latest was `156_profile_repair_track_a_templates.sql`). After running: `cd apps/api && npx prisma db pull && npx prisma generate`.
2. Add Prisma models to `apps/api/prisma/schema.prisma` immediately after `mkt_outreach_openers_list` (line ~6619).
3. Add ID generators `generatePlaybookCatalogId()` and `generateCampaignTriageId()` in `apps/api/src/lib/id-generator.ts` (NOT `src/utils/` — the utils/ dir has no id-generator) with prefixes `pbk-` and `trg-`, following the existing `customAlphabet` nanoid pattern (`tid-`, `uid-`, `pid-`, `cmid-`).
4. Seed `mkt_signal_registry` with the 24 known signal codes (Sprint 2A §2A.1 taxonomy) including family, label, and `detection_source` (`model_emitted` for most, `operator_input` for BBB codes, `derived` where thresholds are computed in code).
5. Seed `mkt_playbook_catalog` with the 6 standard playbooks (§5.3, includes PB-06 from the signal taxonomy) via migration or seed script, including `priority_rank` and `matching_rules` in the §6.4 DSL shape.
6. Unit test: catalog seed, signal registry seed, triage result CRUD.

### Sprint 2: Signal Extractor & Triage Engine (3–4 days)

1. `SignalExtractor` service in `apps/api/src/services/triage/` — **task superseded by Sprint 2A task 2** (extractor emits `SignalCode[]`, not `NormalizedSignals`).
2. `TriageEngineService.evaluateTriage(signals: SignalCode[])`:
   - Pure function evaluating playbooks in `priority_rank` order (§6.2 cascade).
   - Returns `TriageRecommendation` with `playbookCode`, `category`, `archetype`, `confidence`, `reasoning`, `detectedSignals`.
3. Add `A5` archetype to `ArchetypeCode` and update `archetype-selection.ts` to be a consumer of the triage result (fallback to existing logic when no triage result).
4. Add `triage_management` as a valid `campaign_category` constant.
5. Unit tests covering all 6 cascade branches + fallback (edge cases in Sprint 2A task 6).

### Sprint 2A: Platform Signal Taxonomy & Signal-Code Pipeline (3–4 days) — SUPERSEDES Sprint 2 signal model

**Why this supersedes:** the original spec evaluated ad-hoc boolean flags (`NormalizedSignals`). The Full Platform Signal Taxonomy standardizes detection into a canonical `SignalCode[]` array across 5 families. The taxonomy becomes the single contract between audit ingestion, the triage engine, the playbook catalog, and the UI's "Triggered Signals" display. Sprint 2's extractor task is rewritten as below; the engine input type changes from `NormalizedSignals` to `SignalCode[]`.

#### 2A.1 Canonical Signal Taxonomy

Five signal families, each with stable code strings (stored in `mkt_campaign_triage_results.detected_signals` and emitted by audits):

| Family | Prefix | Codes |
|--------|--------|-------|
| Reputation & Administrative | `RA_` | `RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS`, `RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME`, `RA_UNADDRESSED_NEGATIVE_BACKLOG`, `RA_UNADDRESSED_POSITIVE_BACKLOG` |
| Digital Surface & Profile | `DS_` | `DS_CLAIMED_STATUS`, `DS_MISSING_PROFILE`, `DS_BROKEN_PROFILE_LINK`, `DS_MISSING_SERVICE_MENU`, `DS_OUTDATED_HOURS`, `DS_PHOTO_DEFICIT` |
| Website & Conversion | `WC_` | `WC_MISSING_WEBSITE`, `WC_BROKEN_WEBSITE`, `WC_URL_MISMATCH`, `WC_MISSING_CTA`, `WC_MISSING_SERVICE_PAGES`, `WC_MOBILE_FRICTION` |
| Cross-Platform Consistency | `CP_` | `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT`, `CP_MISSING_CONTACT_INFO` |
| Content & Visual Proof | `VP_` | `VP_MISSING_PROJECT_PHOTOS`, `VP_STALE_SOCIAL_ACTIVITY` |

#### 2A.2 Master Signal-to-Playbook Alignment Matrix

| Playbook | Category | Triggering Signal Group | Archetype |
|----------|----------|------------------------|-----------|
| PB-01 Profile Repair & Listing Drift | `review_management` | `WC_URL_MISMATCH`, `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT` | A3 |
| PB-02 Review Gap & Stagnation | `review_management` | `RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME`, `RA_UNADDRESSED_POSITIVE_BACKLOG` | A1 |
| PB-03 Conversion & Surface Friction | `review_management` | `WC_BROKEN_WEBSITE`, `WC_MISSING_CTA`, `WC_MISSING_SERVICE_PAGES`, `DS_MISSING_SERVICE_MENU` | A4 |
| PB-04 Admin Neglect (BBB Recovery) | `recovery_management` | `RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS`, `RA_UNADDRESSED_NEGATIVE_BACKLOG` | A2 |
| PB-05 Multi-Signal Footprint Triage | `triage_management` | Dual: any CP/WC repair signal AND any RA review signal (no active BBB crisis) | A5 |
| PB-06 Visual & Asset Refresh | `review_management` | `VP_MISSING_PROJECT_PHOTOS`, `VP_STALE_SOCIAL_ACTIVITY`, `DS_PHOTO_DEFICIT` | A3 |

#### 2A.3 Tasks

1. **`signal-taxonomy.ts`** in `apps/api/src/services/triage/` — **registry-backed, not hardcoded**:
   - Loads active signals from `mkt_signal_registry` (with short-lived cache + invalidation on registry writes), so new codes registered by admins are live without a deploy.
   - A thin TS fallback constant seeds/validates the 24 known codes; the DB registry is the runtime source of truth.
   - Family predicate helpers (`isRepairSignal()`, `isReviewSignal()`, `isCrisisSignal()`, `isVisualSignal()`) operate on registry `family` values.
   - Signal → human-readable label map sourced from the registry for the triage card's "Triggered Signals" chips.
2. **`SignalExtractor` rewrite** (replaces Sprint 2 task 1):
   - Emits `SignalCode[]` from: `business_analysis` audit_data, `mkt_campaigns_list` columns (`last_review_date`, `unaddressed_reviews`, `nap_consistent`, `has_website`, `website_url`, `gbp_claimed`), and operator BBB pre-flight inputs (`bbb_grade`, `unanswered_bbb_complaints`).
   - Mapping table from each taxonomy code → source field(s) + threshold (e.g., `RA_REVIEW_DROUGHT` ⟸ `last_review_date` older than 180 days; `RA_LOW_REVIEW_VOLUME` ⟸ combined review count < 15; `RA_UNADDRESSED_NEGATIVE_BACKLOG` ⟸ ≥3 unanswered reviews ≤3 stars from `combined_review_metrics` / `negative_review_themes`).
3. **Audit output contract** — update seek/`business_analysis` prompt templates (`docs/LocalBiz/Audit Prompts/`) to emit the standardized array:
   ```json
   {
     "business_name": "One Hour Heating & Air Conditioning",
     "detected_signals": ["WC_URL_MISMATCH", "RA_REVIEW_DROUGHT", "CP_NAP_NAME_DRIFT", "VP_MISSING_PROJECT_PHOTOS"]
   }
   ```
   Extractor precedence: model-emitted `detected_signals` first; derive codes from raw fields only for legacy audits that lack the array.
4. **Generic rules evaluator** — `TriageEngineService` implements the §6.4 DSL (`any`/`all`/`none`/`dual`) as pure set-membership over `SignalCode[]`, evaluating active playbooks in `priority_rank` order. No per-playbook code branches. Seed `matching_rules` for all 6 playbooks from the §2A.2 matrix (PB-05 uses `dual` + `none: [RA_BBB_GRADE_SUPPRESSION, RA_UNANSWERED_COMPLAINTS]` for the "no active crisis" guard).
5. **Seed PB-06** (Visual & Asset Refresh) — catalog grows to 6 playbooks (§5.3).
6. **Unit tests:** per-family detection, threshold edge cases (exactly 180 days, exactly 15 reviews), dual-trigger PB-05, PB-06 visual-only path, legacy-audit derivation fallback, `priority_rank` ordering, DSL semantics (`any`/`all`/`none`/`dual` combinations), unknown-code tolerance, and registry-driven dynamic rule changes (add a new signal + new playbook rule at runtime, verify it matches without code changes).

### Sprint 3: Admin API (2–3 days)

1. New or extended `marketing-ops.ts` routes:
   - `GET /admin/marketing-ops/playbooks` — list catalog.
   - `GET /admin/marketing-ops/playbooks/:id` — detail.
   - `PUT /admin/marketing-ops/playbooks/:id` — update rules/fees/templates.
   - `POST /admin/marketing-ops/playbooks/:id/activate` — toggle `is_active`.
   - `POST /admin/marketing-ops/campaigns/:id/triage` — evaluate + upsert `mkt_campaign_triage_results`.
   - `POST /admin/marketing-ops/campaigns/:id/triage/accept` — accept recommendation.
   - `POST /admin/marketing-ops/campaigns/:id/triage/override` — override to another playbook.
   - Signal registry CRUD for the Rule Builder: `GET /signals`, `POST /signals`, `PUT /signals/:id`, `POST /signals/:id/activate` — registry writes invalidate the taxonomy cache in `signal-taxonomy.ts`.
   - `PUT /admin/marketing-ops/playbooks/reorder` — bulk `priority_rank` update for the cascade-order affordance in the admin table.
   - **Route ordering hazard:** `marketing-ops.ts` has explicit warnings at lines 1813 and 2010 that specific routes MUST be declared before `router.get('/:id', ...)`. The `/playbooks` and `/signals` routes will be shadowed by the catch-all `/:id` if placed after it. Insert them with the other specific-path routes up top (near `/openers`, `/follow-ups`, `/scorecards`). Multi-segment routes like `/:campaignId/triage/*` are NOT shadowed and are safe anywhere.
2. **Service granularity:** introduce a new `MarketingPlaybookCatalogService` for catalog CRUD (matches the one-service-per-domain pattern: `MarketingPromptService`, `MarketingDeliverableService`, `MarketingScorecardService`, etc.). Only the "apply triage decision to campaign" step belongs in `MarketingCampaignService`. `TriageEngineService` (Sprint 2) stays a pure function.
3. Extend `MarketingCampaignService` to apply triage decision:
   - Set `campaign_category`, `repair_track` (if applicable), `package_price_cents`, `archetype` selection, deliverable template, and `track_decision_reason`.
   - Log stage/transition history with `triggerType: 'triage_decision'`.
4. Input validation (Zod) for all new endpoints.

### Sprint 4: Playbook Catalog Admin UI + Rule Builder (3–4 days)

1. New Next.js app route: `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/`.
2. **Two nav registries must be updated** (they are already out of sync — NavPanel has Openers/Follow-Ups/Split Tests that AdminNavContent lacks):
   - `apps/web/src/components/marketing-ops/MarketingOpsNavPanel.tsx` `NAV_ITEMS` array (in-section Mantine panel).
   - `apps/web/src/components/navigation/AdminNavContent.tsx` Marketing Ops `children` array (global admin sidebar, ~line 334).
   - Add a `Playbooks` entry to both with an icon (e.g. `IconBook`/`📚`).
3. **Tenant-scoped route mirror:** a parallel route tree exists at `apps/web/src/app/t/[tenantId]/settings/admin/marketing-ops/...` (recovery, scorecards, prompts, campaigns, etc.). Decide whether Playbooks is platform-admin-only or also tenant-admin reachable. If后者, mirror the page under `t/[tenantId]/...`. Recommendation: platform-admin-only for v1 (catalog is global config, not tenant data).
4. `MarketingOpsService` methods for playbook CRUD **and signal registry CRUD**.
5. Table view: code, name, category badge, archetype, FITD fee, retainer fee, active status, `priority_rank` (with reorder affordance — up/down or drag; reordering IS retuning the cascade).
6. **Rule Builder** (replaces raw-JSON editing of `matching_rules`) — structured editor for the §6.4 DSL:
   - Signal picker per clause (`any` / `all` / `none` / `dual.groupA` / `dual.groupB`), multi-select sourced live from `mkt_signal_registry` so newly registered signals appear immediately.
   - Clause add/remove with plain-language preview ("Matches when ANY of … is present AND NONE of … is present").
   - Confidence slider per playbook.
   - Raw JSON toggle kept as an advanced escape hatch, with Zod-validated round-trip.
7. **Signal Registry manager** (same page, second tab or section):
   - Table of registered signals: code, family badge, label, `detection_source`, active toggle.
   - "Register Signal" modal: code (validated `FAMILY_UPPER_SNAKE` format), family (existing or new), label, description, detection source. Warns that `derived` signals additionally need extractor code before they can fire.
8. **New playbook creation flow**: code, name, category, archetype, pricing, plus Rule Builder — the full "future unknown" path (new signal → new rule → new playbook) is UI-only.

### Sprint 5: Campaign Triage Widget (2–3 days)

1. Add `IntelligentTriageCard` component to `CampaignDetailClient.tsx` (`apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`).
2. **Placement:** the detail view already has a tab system (`'overview' | 'audits' | 'files' | 'deliverables' | 'prompts' | 'history' | 'lineage' | 'cascade'`) and prior art for inline decision panels (`RepairTrackPanel`, `CascadePanel` imported at lines 20–22). Place the triage card **above the tabs, visible only for `seek`-stage campaigns** (mirrors `RepairTrackPanel` placement), not as a new tab — the triage decision is a prerequisite gate, not a parallel view.
3. Display: recommended playbook, confidence (labeled "Rule Confidence" / "Signal Match Strength" per Risk 3 — not "ML confidence"), triggered signals, rationale.
4. Add **BBB pre-flight inputs** in the triage card so operators can manually supply `bbb_grade` and `unanswered_bbb_complaints` to enable PB-04.
5. Actions:
   - `Accept Recommendation` → calls API accept and refreshes campaign state.
   - `Override` → dropdown of active playbooks, calls API override.
6. Add `useTriage` hook/swr data fetch.
7. Handle states: pending / accepted / overridden.

### Sprint 6: Archetype A5 Opener + Hardening (2–3 days)

1. Add `A5_PROMPT` to `archetype-prompts.ts` for `A5_DUAL_TRIAGE`.
2. Update `buildArchetypePrompt` switch for `A5`.
3. E2E test: full flow from business_analysis audit to triage result to opener generation.
4. Update `CampaignDetailClient` to use triage-derived archetype for opener workspace when accepted.
5. Documentation and admin runbook.

---

## 8. Key Risks

### Risk 1 — BBB Signal Source (High)

The spec's **Rule 1** (PB-04) depends on `bbbGrade` and `unansweredBbbComplaints`. Today the platform does not ingest BBB data automatically outside of `DisputeIntakeService.test.ts` test fixtures. Three paths are available:

1. **Operator manual input (recommended short-term):** Add a "BBB snapshot" step in the campaign triage UI where the operator enters the BBB letter grade and number of unanswered complaints. Store these on `mkt_campaigns_list` (e.g., `bbb_grade`, `unanswered_bbb_complaints`) or in `mkt_campaign_triage_results.detected_signals`. The triage engine treats these as first-class BBB signals.
2. **Automated BBB scraping (long-term):** Extend the `business_analysis` prompt/output to include BBB grade and complaint counts.
3. **Conditional PB-04:** Keep Rule 1 in code but only fire when `signals.bbbGrade` is present.

**Recommendation:** Implement (1) immediately so PB-04 is usable from day one. Add `bbb_grade` and `unanswered_bbb_complaints` as optional triage input fields on the campaign. When populated, the engine runs Rule 1. When absent, Rule 1 is skipped and PB-04 will not fire.

### Risk 2 — Archetype A5 Prompt (Medium)

`archetype-prompts.ts` currently supports `A1`–`A4`. The `A5_DUAL_TRIAGE` archetype requires a new prompt and potential field-extractor adjustments to combine profile-drift and review-drought themes without stacking stats. Allocate time in Sprint 6.

### Risk 3 — Deterministic Confidence Interpretation (Medium)

The 0.0–1.0 `confidenceScore` is hardcoded. UI should label it "Rule Confidence" or "Signal Match Strength" rather than a ML probability to avoid operator confusion.

### Risk 4 — Category Constant Expansion (Low)

`campaign_category = 'triage_management'` is a new app-level value. Any code that switches on `campaign_category` (stage machines, transitions, filters, dashboards) needs to handle it. The stage machine fallback already defaults to `review_management`, which is a safe default for triage, but product/UX needs to decide whether `triage_management` campaigns should stay in `seek` until accepted.

### Risk 5 — Prompt Template ID Coupling (Low)

The spec stores `openerPromptTemplateId` on the playbook, but the current opener system uses `archetype-prompts.ts` by code. Two options:

- **Option A:** Keep prompts in code; `openerPromptTemplateId` is informational only.
- **Option B:** Move prompts to `mkt_deliverable_templates_list` and have the opener builder fetch by template ID.

**Recommendation:** Start with Option A to avoid large refactoring. Store `openerPromptTemplateId` as nullable metadata and use archetype code to pick the prompt builder.

### Risk 6 — Rule Governance & Drift (Medium)

Making rules admin-editable trades deploy-safety for flexibility. Failure modes: two playbooks with overlapping `any` groups where `priority_rank` silently decides; a `none` guard accidentally removed; a reorder that demotes PB-04 below PB-05 (crisis no longer wins). Mitigations:

- **Change audit trail:** log every rule/registry/reorder mutation (who/when/diff) — reuse the existing admin audit logging pattern.
- **Validation on save:** warn when a playbook's rule set is a strict subset of a higher-ranked playbook (shadowed rule), and when PB-04-class crisis signals appear in any playbook ranked below a non-crisis playbook.
- **Derived-signal honesty:** the registry UI must state that `derived` signals need extractor code before they fire — otherwise admins will register signals that never match.
- **Simulation before save (nice-to-have, v1.1):** "test this rule against the last N triage evaluations" dry-run to preview impact.

---

## 8.5 Integration Notes (Codebase Validation 2026-08-02)

The following were verified against the live codebase and supersede any conflicting earlier statements in this doc:

1. **Archetype selection priority** is `A2 > A1 > A3 > A4` (not `A1 > A2 > A3 > A4`) — see `archetype-selection.ts:6,108,116`. The triage cascade in §6.2 is a separate higher-level scheme.
2. **ID generator location** is `apps/api/src/lib/id-generator.ts` (not `src/utils/`). Existing prefixes use nanoid `customAlphabet`: `tid-`, `uid-`, `pid-`, `cmid-`.
3. **Migration location & naming** is `database/migrations/NNN_descriptive_name.sql` (3-digit numbered, executed in order — see `database/migrations/README.md`; latest was `156_profile_repair_track_a_templates.sql`). NOT `apps/api/prisma/migrations/` (that dir holds Prisma-generated migration metadata/notes, not the canonical SQL). After running: `cd apps/api && npx prisma db pull && npx prisma generate`. **Gitignore note:** `*.sql` is gitignored (`.gitignore:42`) with exceptions only for uppercase-prefixed utility scripts (`CREATE_`, `INSERT_`, `MIGRATE_`, etc.). Numbered migrations (152–157) are intentionally **not tracked in git** — they are local-only DB artifacts. The committed source of truth is `schema.prisma` after `prisma db pull`. Do NOT `git add -f` the numbered migration file.
4. **No RLS / no DB triggers** on `mkt_*` tables. They are platform-admin scoped global tables. `updated_at` is managed by Prisma `@updatedAt`, not a DB trigger. The only RLS in the migrations dir is on `product_queue` (tenant-scoped) in a `.backup` file.
5. **Route ordering hazard** in `marketing-ops.ts` (warnings at lines 1813 and 2010): specific routes MUST be declared before `router.get('/:id', ...)`. New `/playbooks` routes will be shadowed if placed after the catch-all.
6. **Two nav registries** must be kept in sync: `MarketingOpsNavPanel.tsx` `NAV_ITEMS` and `AdminNavContent.tsx` Marketing Ops `children` (~line 334). They are already out of sync.
7. **Tenant-scoped route mirror** exists at `apps/web/src/app/t/[tenantId]/settings/admin/marketing-ops/...`. Product call needed: is Playbooks platform-admin-only or also tenant-admin reachable? Recommendation: platform-admin-only for v1.
8. **CampaignDetailClient tab system** (`'overview' | 'audits' | 'files' | 'deliverables' | 'prompts' | 'history' | 'lineage' | 'cascade'`) with prior art for inline decision panels (`RepairTrackPanel`, `CascadePanel` at lines 20–22). Triage card belongs above tabs for `seek`-stage campaigns, not as a new tab.
9. **Backend service granularity** is one-service-per-domain (`MarketingPromptService`, `MarketingDeliverableService`, `MarketingScorecardService`, etc. — see `marketing-ops.ts` imports lines 121–147). Add a new `MarketingPlaybookCatalogService` for catalog CRUD; only the "apply triage decision" step belongs in `MarketingCampaignService`.

---

## 9. Acceptance Criteria

- [ ] Migration creates both tables and seed playbooks (6, including PB-06) are queryable with `priority_rank` and `matching_rules` populated.
- [ ] `SignalExtractor` emits the canonical `SignalCode[]` array (5 families) from audit data, campaign columns, and operator BBB inputs; legacy audits without `detected_signals` derive codes correctly.
- [ ] `TriageEngineService.evaluateTriage` consumes `SignalCode[]` and produces the expected playbook for each of the 6 cascade branches in `priority_rank` order.
- [ ] Accepting a triage recommendation updates the campaign's `campaign_category`, `package_price_cents`, `archetype` selection, and logs a decision.
- [ ] Override creates a `mkt_campaign_triage_results` row with `is_operator_accepted = false` and `overridden_playbook_id` populated.
- [ ] Playbook Catalog admin list/edit is reachable at `/settings/admin/marketing-ops/playbooks`.
- [ ] Rule Builder edits `matching_rules` without raw JSON; signal picker reflects newly registered signals without a redeploy.
- [ ] Admin can register a brand-new signal code, attach it to a playbook rule, and see it match on the next triage evaluation — end-to-end with no code change (for `model_emitted` / `operator_input` sources).
- [ ] Admin can reorder `priority_rank` from the catalog table and the next evaluation follows the new cascade order.
- [ ] Campaign triage card appears in `CampaignDetailClient` after a business_analysis audit is saved.
- [ ] A5 opener prompt can be generated for PB-05 campaigns.

---

## 10. Dependencies / Blockers

- **BBB data source** for PB-04 to be fully functional (operator manual input is the agreed short-term path — see Risk 1).
- **Audit prompt contract update** — seek/`business_analysis` templates in `docs/LocalBiz/Audit Prompts/` must emit the `detected_signals: SignalCode[]` array; Sprint 2A's model-emitted path depends on it (legacy derivation covers the gap until templates ship). **DONE** — all 4 seek prompts now emit `detected_signals`.
- **Product confirmation** on `triage_management` as a new `campaign_category` vs. reusing `profile_repair` / `review_management` as the category and using a triage flag.
- **Design approval** on the Campaign Triage Card layout (spec provides an ASCII wireframe).
- **Archetype A5 prompt copy** from Marketing / Ops.

---

## 11. Estimated Total Duration

- Conservative: **15–19 developer days** (includes Sprint 2A signal taxonomy + Sprint 4 Rule Builder)
- With parallel backend/frontend: **3–4 calendar weeks** (assuming one senior full-stack engineer + one reviewer)
