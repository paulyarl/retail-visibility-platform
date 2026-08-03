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

- `apps/api/src/services/outreach-openers/archetype-selection.ts` already does deterministic archetype selection (`A2 > A1 > A3 > A4` — recurring-theme negatives win on specificity+urgency) from `business_analysis` audit_data. **Note:** the triage cascade in §6.2 is a separate, higher-level scheme (PB-04 → PB-05 → PB-01 → PB-02 → PB-03) that supersedes this ordering when a triage result is present.
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
| `TargetArchetype` (`A1_REVIEW_GAP` ... `A5_DUAL_TRIAGE`) | Archetype codes are currently `A1`–`A4` (`ArchetypeCode`), selected with priority `A2 > A1 > A3 > A4`. Prompts switch on the 2-char code. | Add `A5` to `ArchetypeCode`; store a separate `archetype_label` in the catalog. The triage cascade (PB-04→PB-05→PB-01→PB-02→PB-03) is a *separate* scheme that supersedes the existing `selectArchetype` ordering when a triage result is present. |
| `PlaybookCatalog` / `CampaignTriageResult` models | Do not exist. | Two new migrations + Prisma models required. |
| BBB grade and unanswered BBB complaints | No BBB signal in audit data. Only a test fixture references BBB in `DisputeIntakeService.test.ts`. | Rule 1 (PB-04 BBB recovery) is **blocked on a BBB data source**. See risk #1. |
| Deterministic `evaluateTriage` with hardcoded confidence | No existing `TriageEngineService`. | New pure service + unit tests. |
| Admin Playbook Catalog page | Does not exist. | New Next.js route under `/settings/admin/marketing-ops/`. |
| Campaign triage card with Accept/Override | Does not exist. | Add to `CampaignDetailClient.tsx` and call new API. |
| `openerPromptTemplateId` on playbook | Existing openers are built from `archetype-prompts.ts`, not DB templates. | Decide whether to template-ize prompts in DB or keep the prompt builder keyed by archetype. |

---

## 4. Proposed Architecture

```
┌────────────────────────┐
│  Raw Audit Ingestion   │ (mkt_audits_list.audit_data, campaign columns)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ SignalExtractor        │ ── Normalizes platform signals from audit_data
│ + TriageEngineService  │ ── Runs priority cascade, returns TriageRecommendation
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ mkt_playbook_catalog   │ ── Seed catalog (PB-01..PB-05)
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
  matching_rules JSONB NOT NULL DEFAULT '{}',    -- rule criteria JSON
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
CREATE INDEX idx_mkt_playbook_catalog_active ON mkt_playbook_catalog(is_active);
CREATE INDEX idx_mkt_campaign_triage_campaign ON mkt_campaign_triage_results(campaign_id);
```

### 5.2 Prisma Models

```prisma
model mkt_playbook_catalog {
  id                        String     @id @db.VarChar(255)
  code                      String     @unique @db.VarChar(20)
  name                      String     @db.VarChar(255)
  category                  String     @db.VarChar(30)
  archetype                 String     @db.VarChar(20)
  archetype_label           String     @db.VarChar(40)
  description               String?
  matching_rules            Json?      @db.Json
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

### 5.3 Seed Data (5 Standard Playbooks)

| Code | Name | Category | Archetype | FITD | Retainer |
|------|------|----------|-----------|------|----------|
| PB-01 | Profile Repair & Listing Drift | `review_management` | `A3` | $149 One-Time Citation & Profile Alignment | $199/mo Listing & Search Defense |
| PB-02 | Review Gap & Acceleration | `review_management` | `A1` | $99 One-Time Review Jumpstart Pack | $199/mo Automated Review Engine |
| PB-03 | Website CTA & Friction Repair | `review_management` | `A4` | $199 Conversion Audit & Contact Fix | $299/mo Conversion Optimization |
| PB-04 | Admin Neglect (BBB Recovery) | `recovery_management` | `A2` | $349 Dispute Settlement Package | $399/mo Brand Risk & BBB Shield |
| PB-05 | Multi-Signal Footprint Triage | `triage_management` | `A5` | $249 Complete Digital Footprint Repair | $299/mo Full Reputation & Local SEO Retainer |

---

## 6. Triage Rules Engine

### 6.1 Inputs

```typescript
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

### 6.2 Deterministic Priority Cascade

The engine must preserve the exact priority order from the spec:

1. **Rule 1 — BBB Emergency Recovery** (`PB-04`) — highest priority.
2. **Rule 2 — Multi-Signal Triage** (`PB-05`) — both repair and review issues.
3. **Rule 3 — Pure Profile Repair** (`PB-01`).
4. **Rule 4 — Pure Review Gap** (`PB-02`).
5. **Rule 5 — Fallback CTA Gap** (`PB-03`).

Hardcoded confidence scores:

- PB-04: `0.95`
- PB-05: `0.90`
- PB-01 / PB-02: `0.85`
- PB-03: `0.70`

### 6.3 Deterministic Note

Because the rules are entirely deterministic, `confidenceScore` is a proxy for rule specificity/severity, not a statistical probability. This is acceptable but should be documented so operators do not misinterpret it as ML confidence.

---

## 7. Sprints

### Sprint 1: Data Layer (2–3 days)

1. Migration file `database/migrations/157_mkt_playbook_catalog.sql` for `mkt_playbook_catalog` and `mkt_campaign_triage_results` (indexes only — **no RLS, no triggers**; mkt_* tables are platform-admin scoped and `updated_at` is managed by Prisma `@updatedAt`). Naming follows the codebase convention (`NNN_descriptive_name.sql`, 3-digit numbered — see `database/migrations/README.md`; latest was `156_profile_repair_track_a_templates.sql`). After running: `cd apps/api && npx prisma db pull && npx prisma generate`.
2. Add Prisma models to `apps/api/prisma/schema.prisma` immediately after `mkt_outreach_openers_list` (line ~6619).
3. Add ID generators `generatePlaybookCatalogId()` and `generateCampaignTriageId()` in `apps/api/src/lib/id-generator.ts` (NOT `src/utils/` — the utils/ dir has no id-generator) with prefixes `pbk-` and `trg-`, following the existing `customAlphabet` nanoid pattern (`tid-`, `uid-`, `pid-`, `cmid-`).
4. Seed `mkt_playbook_catalog` with the 5 standard playbooks via migration or seed script.
5. Unit test: catalog seed, triage result CRUD.

### Sprint 2: Signal Extractor & Triage Engine (3–4 days)

1. `SignalExtractor` service in `apps/api/src/services/triage/`:
   - Read `business_analysis` audit_data JSON.
   - Map to `NormalizedSignals` interface.
   - Fill missing fields from `mkt_campaigns_list` columns.
2. `TriageEngineService.evaluateTriage(signals)`:
   - Pure function, exactly the spec's cascade.
   - Returns `TriageRecommendation` with `playbookCode`, `category`, `archetype`, `confidence`, `reasoning`, `detectedSignals`.
3. Add `A5` archetype to `ArchetypeCode` and update `archetype-selection.ts` to be a consumer of the triage result (fallback to existing logic when no triage result).
4. Add `triage_management` as a valid `campaign_category` constant.
5. Unit tests covering all 5 rule branches + fallback.

### Sprint 3: Admin API (2–3 days)

1. New or extended `marketing-ops.ts` routes:
   - `GET /admin/marketing-ops/playbooks` — list catalog.
   - `GET /admin/marketing-ops/playbooks/:id` — detail.
   - `PUT /admin/marketing-ops/playbooks/:id` — update rules/fees/templates.
   - `POST /admin/marketing-ops/playbooks/:id/activate` — toggle `is_active`.
   - `POST /admin/marketing-ops/campaigns/:id/triage` — evaluate + upsert `mkt_campaign_triage_results`.
   - `POST /admin/marketing-ops/campaigns/:id/triage/accept` — accept recommendation.
   - `POST /admin/marketing-ops/campaigns/:id/triage/override` — override to another playbook.
   - **Route ordering hazard:** `marketing-ops.ts` has explicit warnings at lines 1813 and 2010 that specific routes MUST be declared before `router.get('/:id', ...)`. The `/playbooks` and `/playbooks/:id` routes will be shadowed by the catch-all `/:id` if placed after it. Insert them with the other specific-path routes up top (near `/openers`, `/follow-ups`, `/scorecards`).
2. **Service granularity:** introduce a new `MarketingPlaybookCatalogService` for catalog CRUD (matches the one-service-per-domain pattern: `MarketingPromptService`, `MarketingDeliverableService`, `MarketingScorecardService`, etc.). Only the "apply triage decision to campaign" step belongs in `MarketingCampaignService`. `TriageEngineService` (Sprint 2) stays a pure function.
3. Extend `MarketingCampaignService` to apply triage decision:
   - Set `campaign_category`, `repair_track` (if applicable), `package_price_cents`, `archetype` selection, deliverable template, and `track_decision_reason`.
   - Log stage/transition history with `triggerType: 'triage_decision'`.
4. Input validation (Zod) for all new endpoints.

### Sprint 4: Playbook Catalog Admin UI (2–3 days)

1. New Next.js app route: `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/`.
2. **Two nav registries must be updated** (they are already out of sync — NavPanel has Openers/Follow-Ups/Split Tests that AdminNavContent lacks):
   - `apps/web/src/components/marketing-ops/MarketingOpsNavPanel.tsx` `NAV_ITEMS` array (in-section Mantine panel).
   - `apps/web/src/components/navigation/AdminNavContent.tsx` Marketing Ops `children` array (global admin sidebar, ~line 334).
   - Add a `Playbooks` entry to both with an icon (e.g. `IconBook`/`📚`).
3. **Tenant-scoped route mirror:** a parallel route tree exists at `apps/web/src/app/t/[tenantId]/settings/admin/marketing-ops/...` (recovery, scorecards, prompts, campaigns, etc.). Decide whether Playbooks is platform-admin-only or also tenant-admin reachable. If后者, mirror the page under `t/[tenantId]/...`. Recommendation: platform-admin-only for v1 (catalog is global config, not tenant data).
4. `MarketingOpsService` methods for playbook CRUD.
5. Table view: code, name, category badge, archetype, FITD fee, retainer fee, active status.
6. Edit modal: JSON editor for `matching_rules`, fee fields, prompt template ID, deliverable type.

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

---

## 8.5 Integration Notes (Codebase Validation 2026-08-02)

The following were verified against the live codebase and supersede any conflicting earlier statements in this doc:

1. **Archetype selection priority** is `A2 > A1 > A3 > A4` (not `A1 > A2 > A3 > A4`) — see `archetype-selection.ts:6,108,116`. The triage cascade in §6.2 is a separate higher-level scheme.
2. **ID generator location** is `apps/api/src/lib/id-generator.ts` (not `src/utils/`). Existing prefixes use nanoid `customAlphabet`: `tid-`, `uid-`, `pid-`, `cmid-`.
3. **Migration location & naming** is `database/migrations/NNN_descriptive_name.sql` (3-digit numbered, executed in order — see `database/migrations/README.md`; latest was `156_profile_repair_track_a_templates.sql`). NOT `apps/api/prisma/migrations/` (that dir holds Prisma-generated migration metadata/notes, not the canonical SQL). After running: `cd apps/api && npx prisma db pull && npx prisma generate`.
4. **No RLS / no DB triggers** on `mkt_*` tables. They are platform-admin scoped global tables. `updated_at` is managed by Prisma `@updatedAt`, not a DB trigger. The only RLS in the migrations dir is on `product_queue` (tenant-scoped) in a `.backup` file.
5. **Route ordering hazard** in `marketing-ops.ts` (warnings at lines 1813 and 2010): specific routes MUST be declared before `router.get('/:id', ...)`. New `/playbooks` routes will be shadowed if placed after the catch-all.
6. **Two nav registries** must be kept in sync: `MarketingOpsNavPanel.tsx` `NAV_ITEMS` and `AdminNavContent.tsx` Marketing Ops `children` (~line 334). They are already out of sync.
7. **Tenant-scoped route mirror** exists at `apps/web/src/app/t/[tenantId]/settings/admin/marketing-ops/...`. Product call needed: is Playbooks platform-admin-only or also tenant-admin reachable? Recommendation: platform-admin-only for v1.
8. **CampaignDetailClient tab system** (`'overview' | 'audits' | 'files' | 'deliverables' | 'prompts' | 'history' | 'lineage' | 'cascade'`) with prior art for inline decision panels (`RepairTrackPanel`, `CascadePanel` at lines 20–22). Triage card belongs above tabs for `seek`-stage campaigns, not as a new tab.
9. **Backend service granularity** is one-service-per-domain (`MarketingPromptService`, `MarketingDeliverableService`, `MarketingScorecardService`, etc. — see `marketing-ops.ts` imports lines 121–147). Add a new `MarketingPlaybookCatalogService` for catalog CRUD; only the "apply triage decision" step belongs in `MarketingCampaignService`.

---

## 9. Acceptance Criteria

- [ ] Migration creates both tables and seed playbooks are queryable.
- [ ] `TriageEngineService.evaluateTriage` produces the expected playbook for each of the 5 rule branches.
- [ ] Accepting a triage recommendation updates the campaign's `campaign_category`, `package_price_cents`, `archetype` selection, and logs a decision.
- [ ] Override creates a `mkt_campaign_triage_results` row with `is_operator_accepted = false` and `overridden_playbook_id` populated.
- [ ] Playbook Catalog admin list/edit is reachable at `/settings/admin/marketing-ops/playbooks`.
- [ ] Campaign triage card appears in `CampaignDetailClient` after a business_analysis audit is saved.
- [ ] A5 opener prompt can be generated for PB-05 campaigns.

---

## 10. Dependencies / Blockers

- **BBB data source** for PB-04 to be fully functional.
- **Product confirmation** on `triage_management` as a new `campaign_category` vs. reusing `profile_repair` / `review_management` as the category and using a triage flag.
- **Design approval** on the Campaign Triage Card layout (spec provides an ASCII wireframe).
- **Archetype A5 prompt copy** from Marketing / Ops.

---

## 11. Estimated Total Duration

- Conservative: **11–14 developer days**
- With parallel backend/frontend: **2.5–3 calendar weeks** (assuming one senior full-stack engineer + one reviewer)
