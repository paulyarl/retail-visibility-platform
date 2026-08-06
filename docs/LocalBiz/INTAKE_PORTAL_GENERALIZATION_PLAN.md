# Intake Portal Generalization — GBP Optimization + Review-Response Services

**Status:** Plan (pending approval)
**Date:** 2026-08-06
**Revision 1 (2026-08-06):** gap-closure pass after codebase verification —
Prisma 1:1→1:N relation ripple (§3 Phase 3b, §6.4), impossible trigger /
campaign-category confusion (§6.2 rewritten), GBP write-target correction
(§6.5), owner link delivery (§6.6), per-platform pipeline upsert, public
picklist endpoint, manual-import endpoint spec, customer-portal status
mapping.
**Revision 2 (2026-08-06):** registry-driven architecture (§2.1, §7) —
per-kind Zod schemas / service methods / form branches replaced by
`mkt_intake_definitions` + dynamic validator + generic submit + renderer,
so niche/service scans (auto repair: ~10 services) become definition rows,
not code. GBP + review are the first two registry kinds.
**Depends on:** migrations 149, 154 (existing intake infrastructure)

---

## 1. Goal

Extend the existing token-gated recovery intake portal so the same machinery
collects owner-provided data for two additional services:

1. **Google Business Profile (GBP) optimization + recurring maintenance** —
   confirmed hours, service area, booking URL, category/attribute
   confirmations, photo uploads.
2. **Review-request + owner-response workflow** — owner voice profile,
   response approval policy, review-request timing/platforms.

The recovery intake portal (`/api/public/recovery/intake`) is already a
generalizable "owner data collection" framework. It has an `intake_kind`
discriminator (`'dispute' | 'profile_repair'`) and an `evidence_payload`
JSONB column designed for kind-specific structured data. The downstream
domain tables for both target services already exist
(`mkt_owner_voice_profile`, `mkt_review_response_pipeline`, `gbp_*`).

---

## 2. Decision: One Table, Generalized

**Choice:** generalize `mkt_dispute_intake` to support all intake kinds via
the existing `intake_kind` discriminator + `evidence_payload` JSONB.

**Rationale:**

- The intake table is a *collection mechanism*, not the system of record.
  ~90% of its columns (token, `campaign_id`, `expires_at`, `viewed_at`,
  `submitted_at`, owner contact) are identical for every service type.
- Kind-specific structured data already lives in `evidence_payload` JSON
  (profile_repair uses it for `proof_of_location`, `google_profile_id`,
  `suspension_notice_details`).
- The real domain data goes to dedicated tables that already exist:
  - Review-response intake → `mkt_owner_voice_profile` + `mkt_review_response_pipeline.metadata`
  - GBP intake → `gbp_locations_list`, `gbp_media`, `gbp_attributes`
- Splitting into per-service tables would duplicate the token/resolve/
  submit/attachment machinery to solve a problem (service-specific columns)
  that the JSON payload + existing domain tables already handle.

**The one schema change that's actually required:** relax
`campaign_id @unique` → `@@unique([campaign_id, intake_kind])` so a campaign
can have parallel recovery + GBP + review intakes. This is needed regardless
of the one-vs-many decision.

**When separate tables *would* win (not applicable here):**
strongly-typed indexed queryable fields, FK relationships out of the JSON,
fundamentally different lifecycles, or independent RLS policies. Neither GBP
nor review-response intake has these properties today.

### 2.1 Scaling decision: registry-driven definitions (Revision 2)

The category-scan workflow (e.g. the 2026-08 auto repair scan) surfaces
~10 deliverable services per niche, most of which need their own owner
intake. Hardcoding a Zod schema + service method + frontend form branch
per kind (the Revision-1 approach for GBP/review) does not scale.

**Choice:** a registry table, `mkt_intake_definitions`, drives every
non-recovery intake kind. Each definition carries a declarative
`form_schema` (fields, types, validation, options), `field_mappings`
(write-behind to domain tables via whitelisted code adapters),
`owner_copy` (page title/intro/success), `trigger_stages`, and optional
niche scoping. One generic submit path + one dynamic form renderer serve
all registry kinds; only genuinely special write-behind logic gets code
(adapters). See §7 for the full architecture.

**Dual track:**
- **Code-defined (unchanged):** `dispute`, `profile_repair` — existing
  hardcoded flows stay as-is (battle-tested, deeply wired into the
  recovery agent).
- **Registry-defined (all new kinds):** `gbp_optimization` and
  `review_response_setup` are built as the *first two registry kinds* —
  they validate the engine immediately — followed by niche/service
  definitions (§7.4 seed list from the auto repair scan).

---

## 3. Phased Implementation

### Phase 1 — Schema migration (migration 173)

**File:** `database/migrations/173_intake_generalization.sql`

1. **Create `mkt_intake_definitions`** (the registry — see §7.1 for the
   full column list, including `created_by` / `updated_by` / `is_draft`
   for future admin authoring — §7.6). Seed rows for the two code-defined
   kinds (`dispute`, `profile_repair`, marked `driver = 'code'`) and the
   two first registry kinds (`gbp_optimization`, `review_response_setup`,
   `driver = 'registry'`, with their `form_schema` / `field_mappings` /
   `owner_copy` JSONB — content per Phase 2).
2. Drop the inline-UNIQUE constraint on `mkt_dispute_intake.campaign_id`
   (added by the column definition in migration 149, line 76 — Postgres
   auto-named it `mkt_dispute_intake_campaign_id_key`; confirm with
   `\d mkt_dispute_intake` before writing the DROP).
3. Add composite unique: `UNIQUE(campaign_id, intake_kind)`.
4. **Widen `intake_kind` to `VARCHAR(40)`** and add an FK:
   `intake_kind REFERENCES mkt_intake_definitions(intake_kind)`.
   ~~CHECK constraint with 4 literals~~ — **rejected**: a fixed CHECK
   would require a migration for every new niche/service kind, defeating
   the registry. The FK gives the same integrity while new kinds become
   `INSERT`s, not migrations. (Migration 154 added the column as bare
   `VARCHAR(20)` — no existing CHECK to replace.)
5. Update the `intake_kind` COMMENT to document the registry relationship.
6. No new columns on `mkt_dispute_intake` — kind-specific data goes in
   the existing `evidence_payload` JSONB, shaped by the definition's
   `form_schema`.
7. Update `mkt_dispute_attachments` COMMENT to clarify it serves all intake
   kinds. The `dispute_intake_id` FK column name stays (rename migration
   not worth it); the column is generic.

**Prisma schema:** **DO NOT edit `schema.prisma` directly** — per
`manual-sql-migration-policy.md`, all schema changes flow through SQL
migration → `prisma db pull` → `prisma generate`. After migration 173 is
applied to the DB:

```bash
cd apps/api
doppler run --config local -- pnpm prisma db pull   # introspect
pnpm prisma:generate                                  # generate types
```

`prisma db pull` will automatically introspect:
- `mkt_dispute_intake`: composite unique `@@unique([campaign_id, intake_kind])`,
  widened `intake_kind` VARCHAR(40) + FK, updated comment.
- `mkt_campaigns_list`: the relation flips from
  `mkt_dispute_intake mkt_dispute_intake?` to
  `mkt_dispute_intake mkt_dispute_intake[]` (1:1 → 1:N). **This is a
  breaking change for ~10 existing consumers** — see Phase 3b for the
  full ripple list. Run `pnpm checkapi` to enumerate every break.
- New `mkt_intake_definitions` model.

### Phase 2 — Intake definition seeds + dynamic validator

**New module:** `apps/api/src/services/intake/IntakeDefinitionService.ts`

- Loads definitions from `mkt_intake_definitions` (cached, keyed by
  `intake_kind` + resolved niche — see §7.2).
- `buildSubmitSchema(definition)` — builds a Zod schema **dynamically**
  from `form_schema` (field types map to Zod primitives; `required`,
  `min/max`, `pattern`, `options` become validators) and wraps it with the
  shared envelope (`token`, `ownerEmail`, `ownerPhone`, `evidencePayload`,
  `attachmentIds`). No per-kind validator files.
- Escape hatch: a field with `custom_validator` names a whitelisted
  code-side check (e.g. `gbp_category_ids_exist`).

The two tables below are the **seed `form_schema` content** for the first
two registry kinds (inserted by migration 173), not standalone Zod files.

**Seed: `gbp_optimization` definition — `form_schema` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `confirmed_hours` | object | `monday`...`sunday` with open/close pairs + `special_hours` array (holiday date + hours) |
| `service_area` | array | cities/zip codes (for service-area businesses) |
| `booking_url` | optional URL | |
| `category_preferences` | array | GBP category IDs the owner confirms (from `gbp_categories_list`) |
| `attribute_confirmations` | object | attribute_id → value (from `gbp_attributes`) |
| `photo_uploads` | array | attachment IDs (logo, interior, work samples) — references `mkt_dispute_attachments` |
| `owner_notes` | free text | |

Notes:
- `category_preferences` uses the whitelisted `gbp_category_ids_exist`
  custom validator (values must exist in `gbp_categories_list` — the same
  rows the `/options` endpoint serves; see Phase 3).
- Neither registry kind collects a dispute-style "owner statement". The
  generic submit maps `owner_notes` → `owner_statement` on persistence
  (the shared repo `submitIntake` requires the field) and leaves
  `proposed_resolution` null.

**Seed: `review_response_setup` definition — `form_schema` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `voice_profile` | object | matches `mkt_owner_voice_profile` columns: `person` (first/third), `formality` (casual/professional), `humor` (yes/no/sometimes), `apology_style` (direct/empathetic/brief), `signoff_style` (first-name/full-name/none), `signature` (free text) |
| `response_policy` | object | `approval_mode` (`owner_reviews` \| `auto_publish`), `negative_threshold` (star rating below which owner must approve), `escalation_email` |
| `review_request_config` | object | `platforms` (array: google, facebook, etc.), `timing` (after_service \| weekly \| manual), `request_template_preferences` (optional) |
| `owner_notes` | free text | |

Notes:
- `voice_profile` enum values must fit the column widths on
  `mkt_owner_voice_profile` (`person`/`formality`/`humor` VARCHAR(10),
  `apology_style`/`signoff_style` VARCHAR(20), `signature` VARCHAR(100)).
- `review_request_config.platforms` is an array, and
  `mkt_review_response_pipeline` is **per-platform**
  (`@@unique([campaign_id, platform])`, `platform` NOT NULL). The
  `review_pipeline_per_platform` write-behind adapter upserts one pipeline
  row per selected platform (see Phase 3, item 3).

### Phase 3 — Backend service + route dispatch

**File:** `apps/api/src/services/DisputeIntakeService.ts` (extend)

1. Widen the `intakeKind` type from the 2-kind union to `string`
   (validated against `mkt_intake_definitions` at the trust boundaries —
   route dispatch + `generateIntakeLink`), in `IntakeContext`,
   `generateIntakeLink`, and
   `DisputeIntakeRepository.CreateDisputeIntakeInput`.
2. Add **one** generic `submitRegistryIntake(input, ctx)` (replaces the
   Revision-1 plan's per-kind `submitGbpOptimizationIntake` /
   `submitReviewResponseIntake` methods):
   - Resolve token → intake row → load definition via
     `IntakeDefinitionService` (kind + campaign niche).
   - Validate expiry, idempotency guard (mirrors `submitIntake`).
   - Persist `evidence_payload` (always — it is the system of record at
     intake time) + map `owner_notes` → `owner_statement`.
   - Execute the definition's `field_mappings` through the **write-behind
     adapter registry** (item 3).
   - Transition campaign stage to the definition's `submitted_stage`
     (§6.1) with the parallel-intake stage guard (item 5).
   - Enqueue downstream agent (best-effort stub + manual dual path,
     §6.3) — the stub message names the definition's
     `downstream_agent` label.
3. **Write-behind adapter registry** (new module,
   `apps/api/src/services/intake/writeBehindAdapters.ts`): whitelisted,
   code-side adapters keyed by adapter name in `field_mappings`. Initial
   set:
   - `business_hours_write` — hours → `business_hours_list.periods` +
     `business_hours_special_list` (tenant-linked only).
   - `gbp_attributes_write` — attribute confirmations → `gbp_attributes`
     upsert by `[tenant_id, attribute_id]`.
   - `gbp_media_write` — photo attachments → `gbp_media` rows
     (`source_url` = attachment URL).
   - `gbp_categories_write` — category preferences →
     `gbp_listing_categories` **only when a synced `gbp_locations_list`
     row exists**; otherwise payload-only + `logger.warn` (§6.5).
   - `owner_voice_profile_upsert` — voice profile →
     `mkt_owner_voice_profile` (keyed on `campaign_id @unique`).
   - `review_pipeline_per_platform` — one
     `mkt_review_response_pipeline` upsert **per platform** in
     `review_request_config.platforms` (composite key
     `[campaign_id, platform]`), `metadata` from `response_policy` +
     `review_request_config`.
   - `payload_only` — explicit no-op (default for unmapped fields).
   Every adapter is tenant-aware: no linked tenant → payload-only +
   `logger.warn` (write pending operator action). Adding a new adapter is
   the *only* code change a novel write target ever requires.
4. Update `resolveIntake` to also return the resolved definition's
   `owner_copy` + `form_schema` for registry kinds (the public page
   renders generically — no per-kind frontend code), alongside the
   widened `intakeKind`.
5. **Parallel-intake stage guard.** A campaign can now have multiple
   intakes outstanding in parallel, but `mkt_campaigns_list.stage` is a
   single column — the second submission would clobber the first's stage.
   Rule: only transition when the campaign's current stage is *earlier*
   in its pipeline than the target per-kind stage (never transition
   backward, never out of `resolved_and_closed`/`retainer_won`). The
   intake row's `submitted_at` is the source of truth for "which intakes
   are done"; the stage is only an operator-facing signal.
6. **Kind-aware idempotency (bug the original plan missed).**
   `generateIntakeLink` currently reuses `repo.findByCampaign(campaignId)`
   — after the composite unique this lookup is no longer unique and would
   reissue the *wrong kind's* token (e.g. generating a GBP link for a
   campaign that has a dispute intake would reissue the dispute token).
   Repository changes:
   - Replace `findByCampaign(campaignId)` with
     `findByCampaignAndKind(campaignId, intakeKind)` using the new
     composite unique (`where: { campaign_id_intake_kind: {...} }`).
   - Add `listByCampaign(campaignId)` returning all kinds (for the new
     admin list endpoint, Phase 5).
   - `generateIntakeLink` and `reissueLink(campaignId, intakeKind)` take
     the kind through; `reissueLink` falls back to `generateIntakeLink`
     for that kind when no row exists.

### Phase 3b — Prisma 1:1 → 1:N relation ripple (NOT optional)

Removing `campaign_id @unique` changes the `mkt_campaigns_list →
mkt_dispute_intake` relation from singular to an array. Every existing
consumer must be updated to select the right kind. Verified call sites:

| File:line | Current code | Fix |
|-----------|--------------|-----|
| `RecoveryResolutionService.ts:82,755,835` | `include: { mkt_dispute_intake: { include: { mkt_dispute_attachments: true } } }` | Array now — pick the row matching the campaign's kind (`dispute`, or `profile_repair` for escalated repair); keep behavior identical |
| `RecoveryResolutionService.ts:90,763,843` | `campaign.mkt_dispute_intake` (singular read) | Same selection as above |
| `RecoveryResolutionService.ts:474-494,625-630` | `include … select owner_email/owner_phone` for delivery fallback | Same selection (recovery flows only care about dispute/profile_repair rows) |
| `RecoveryResolutionService.ts:378,1034` | `findUnique({ where: { campaign_id } })` | `findByCampaignAndKind(campaignId, kind)` via the repository |
| `RecoveryCascadeService.ts:77,137` | `include: { mkt_dispute_intake: { select: { id, access_token } } }` + singular read | Array — select the row whose kind matches the cascade's email variant |
| `marketing-ops.ts:3804` (`GET /recovery/:campaignId/intake`) | `findUnique({ where: { campaign_id } })` | Keep endpoint for backward compat but resolve to the dispute/profile_repair row; the new `GET /:campaignId/intakes` (Phase 5) returns all |

Strategy: add a `kindForCampaign(campaign)` helper (category + repair_track
→ intake kind, mirroring `MarketingCampaignService.ts:860`) so every
recovery-side consumer selects deterministically.

**File:** `apps/api/src/routes/recovery-intake-public.ts` (extend dispatch)

The `/submit` handler already dispatches on `intakeKind`. Replace the
kind-specific branching plan with a two-way dispatch:

- `intakeKind === 'dispute' | 'profile_repair'` → existing code-defined
  schemas + service methods (unchanged).
- anything else → look up the definition (`driver = 'registry'`, 400
  `unknown_intake_kind` if none), validate with the dynamically built
  schema (`IntakeDefinitionService.buildSubmitSchema`), call
  `submitRegistryIntake`.

Also widen the local `intakeKind` variable type in the handler (currently
`'dispute' | 'profile_repair'`).

**New endpoint (same file):** `GET /api/public/recovery/intake/options?token=`

Registry forms need server-side picklist data (GBP categories, attribute
definitions, supported platforms, …), and the public portal has no way to
fetch it today. Token-gated (same trust boundary as the rest of the
router); resolves the token → definition, then fulfills the
`options_source` declared by each `select`/`multiselect` field in
`form_schema`. Whitelisted sources:

- `gbp_categories` — active rows from `gbp_categories_list`
  (`id`, `name`, `display_name`).
- `gbp_attribute_definitions` — attribute keys + value types relevant to
  the campaign's business category (static list, or derived from existing
  `gbp_attributes` rows for the linked tenant when present).
- `review_platforms` — supported review platforms list.
- `current_values` (when a tenant/location is linked) — existing hours,
  booking URL, categories, etc., so the owner confirms rather than
  re-enters.

Fields without an `options_source` carry inline `options` in
`form_schema` and need no server round-trip. 404/expired handling
identical to `GET /intake`.

**File:** `apps/api/src/services/MarketingCampaignService.ts` (extend
auto-generation hook)

The existing hook at line 854 auto-generates intake links on
`outreach_dispatched` for recovery + escalated profile_repair campaigns —
that behavior is unchanged. Add a **second, data-driven** hook for
registry kinds: on `paid` / `retainer_won`, load active definitions whose
`trigger_stages` contain the new stage and whose `service_category`
matches the campaign's purchased service (per the corrected §6.2), and
generate one intake link per matching definition. No per-kind `if`s —
adding a definition row is sufficient to wire a new trigger. The
`generateIntakeLink` method is idempotent **per kind** (after the Phase 3
fix), so firing at both stages is safe — the second call reissues a fresh
token for the same kind.

### Phase 4 — Frontend

**File:** `apps/web/src/services/RecoveryIntakePublicService.ts` (extend)

Add **one** generic `submitRegistryIntake(token, payload)` (the payload
shape comes from the definition, so per-kind methods add nothing), widen
`IntakeContext.intakeKind` to `string`, and add `getOptions(token)` for
the picklist endpoint (Phase 3).

**New component:** `apps/web/src/components/intake/IntakeFormRenderer.tsx`

A definition-driven renderer: maps each `form_schema` field `type` to a
Mantine control. Initial field-type inventory (covers the auto repair
scan's services — see §7.4):

| Field type | Control |
|------------|---------|
| `text` / `url` / `email` / `phone` | `TextInput` |
| `textarea` | `Textarea` |
| `select` / `radio` | `Select` / `Radio.Group` |
| `multiselect` | `MultiSelect` (inline options or fetched via `/options`) |
| `checkbox` | `Checkbox` |
| `chips` | chip-array input (service areas, zip codes) |
| `hours_grid` | custom Mon–Sun open/close grid + special-hours list (the one genuinely bespoke widget) |
| `attachments` | existing `FileInput` + `handleFileUpload` |
| `number` / `date` | `NumberInput` / `DateInput` |

Client-side required/format validation mirrors the definition; the
server-side dynamic Zod schema remains authoritative.

**File:** `apps/web/src/app/recovery/intake/IntakePageClient.tsx` (extend
form branching)

The component already branches on `isProfileRepair`. Registry kinds take a
third path: render `IntakeFormRenderer` with the `form_schema` +
`owner_copy` returned by `resolveIntake`, fetch `/options` on mount, and
submit via `submitRegistryIntake`. Dispute/profile_repair keep their
existing hardcoded forms.

Per-kind copy is no longer hardcoded (lines 284-388 branch on
`isProfileRepair` today): page title, subtitle, intro, field labels, and
success message all come from the definition's `owner_copy`. The
dispute-specific `proposedResolution` / `serviceDate` fields only render
for code-defined kinds.

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` (extend evidence display)

The admin detail already renders `evidence_payload` for `profile_repair`
(line 394). Registry kinds get a **generic evidence renderer**: walk the
definition's `form_schema` and display each submitted value under its
declared `label` (hours grid → table, chips → tag list, attachments →
links). No per-kind admin branches; dispute/profile_repair keep their
existing displays.

### Phase 5 — Operator-side intake link management

**File:** `apps/api/src/routes/marketing-ops.ts`

The admin route `POST /recovery/:campaignId/reissue-link` calls
`disputeIntakeService.reissueLink(campaignId)`. This currently assumes one
intake per campaign. Updates:

- Accept an `intakeKind` query param so operators can reissue/inspect a
  specific kind's link. `reissueLink(campaignId, intakeKind)` gains the
  kind parameter (Phase 3, item 6); since it falls back to
  `generateIntakeLink` when no row exists, this doubles as the manual
  "generate link for kind" operator action.
- Add `GET /:campaignId/intakes` returning all intake rows for a campaign
  (one per kind) via `repo.listByCampaign` — powers the per-kind link
  display + copy-to-clipboard in the admin detail (this is also the
  **owner delivery mechanism** for the new kinds until/unless automated
  email is added; see §6.6).
- Keep the existing single-row endpoint for backward compat (deprecate).

**Public reissue endpoint** (`POST /api/public/recovery/intake/reissue`
in `recovery-intake-public.ts`): takes only `campaignId` today — ambiguous
once multiple kinds exist. Extend `reissueSchema` with a required
`intakeKind` and pass it through.

**Manual import endpoint (§6.3 backend — was unspecified):**

`POST /api/admin/marketing-ops/recovery/:campaignId/intakes/:kind/import-result`

- Body: `{ result: unknown }` — the external agent's JSON output.
- Validates against a new Zod output schema per kind
  (`gbp-optimization-result.schema.ts` — applied hours/categories/
  attributes/photos; `review-response-result.schema.ts` — configured
  pipeline state), mirroring `MarketingPromptService.importExternalResult`'s
  validate-then-persist shape.
- Persists via the same write path as `submitGbpOptimizationIntake`'s
  tenant-table writes (shared private method, so intake-submit and
  manual-import can never drift).
- Audit-log the import (`audit()` with `actorType: 'user'`).

### Phase 6 — Config + tests

**File:** `apps/api/src/config/unifiedConfig.ts`

The intake TTL + attachment config is named `recoveryIntakeTokenTtlDays` /
`recoveryMaxAttachmentBytes` / `recoveryAllowedAttachmentMimes`. These are
generic enough to reuse as-is. Optionally add aliases
(`intakeTokenTtlDays` etc.) for clarity, but not required.

**Tests:**

- `apps/api/src/services/__tests__/DisputeIntakeService.test.ts` — cases
  for `submitRegistryIntake`: token resolution, evidence payload
  persistence, adapter execution (`mkt_owner_voice_profile` upsert,
  per-platform `mkt_review_response_pipeline` rows, tenant-linked
  `business_hours_list` write + payload-only fallback when no tenant),
  idempotent re-submit, `owner_notes` → `owner_statement` mapping.
- `apps/api/src/services/__tests__/IntakeDefinitionService.test.ts` (new)
  — niche override merge, dynamic Zod builder (required/format/options/
  custom validator), unknown kind → error, `payload_only` default,
  adapter whitelist rejects unknown adapter names.
- Kind-scoping regression tests (the Phase 3/3b changes):
  `generateIntakeLink` for kind B on a campaign that already has kind A
  creates a *second* row (not a reissue of A); `reissueLink` with kind
  only touches that kind's token; `listByCampaign` returns all kinds.
- Ripple regression: `RecoveryResolutionService` + `RecoveryCascadeService`
  still select the dispute/profile_repair intake correctly when a campaign
  has multiple intake rows (update existing suites —
  `recoveryResolution.test.ts`, `recoveryCascade.test.ts`,
  `recoveryAdmin.test.ts` all touch `mkt_dispute_intake`).
- `apps/api/src/tests/recovery-intake-public-routes.test.ts` — add cases
  for the new dispatch branches: invalid payload → 400, valid payload →
  200, wrong-kind token → falls through to correct schema; `/options`
  endpoint (wrong kind → empty/400, valid GBP token → categories).
- Admin routes: `GET /:campaignId/intakes` (multi-row),
  `reissue-link?intakeKind=`, `import-result` (invalid JSON → 400, valid →
  persists + audits).
- `MarketingCustomerProjection.test.ts` — add cases for
  `gbp_intake_submitted` / `review_setup_submitted` → decided customer
  status (§6.1), and confirm they are not hidden.

---

## 4. Files Touched (summary)

| File | Change |
|------|--------|
| `database/migrations/173_intake_generalization.sql` | NEW — `mkt_intake_definitions` (+ `created_by`/`updated_by`/`is_draft` for future admin authoring) + seeds, relax unique → composite, `intake_kind` FK (no CHECK), comments |
| `apps/api/prisma/schema.prisma` | **auto-introspected via `prisma db pull`** (never edited directly) — composite unique, `intake_kind` FK + VARCHAR(40), **relation 1:1 → 1:N**, new `mkt_intake_definitions` model |
| `apps/api/src/services/intake/IntakeDefinitionService.ts` | NEW — definition load/cache, niche merge, dynamic Zod builder |
| `apps/api/src/services/intake/writeBehindAdapters.ts` | NEW — whitelisted write-behind adapters (hours, gbp attrs/media/categories, voice profile, per-platform pipeline) |
| `apps/api/src/validators/gbp-optimization-result.schema.ts` | NEW — manual-import output schema (§6.3) |
| `apps/api/src/validators/review-response-result.schema.ts` | NEW — manual-import output schema (§6.3) |
| `apps/api/src/services/DisputeIntakeService.ts` | widen type to registry kinds, `submitRegistryIntake`, kind-aware idempotency, stage guard, definition in `resolveIntake` |
| `apps/api/src/repositories/DisputeIntakeRepository.ts` | `findByCampaign` → `findByCampaignAndKind`, add `listByCampaign` |
| `apps/api/src/services/RecoveryResolutionService.ts` | Phase 3b ripple — kind-selected intake reads (8 sites) |
| `apps/api/src/services/RecoveryCascadeService.ts` | Phase 3b ripple — kind-selected intake reads (2 sites) + per-kind email copy if §6.6 option B |
| `apps/api/src/services/recoveryStages.ts` | labels/literals for the two new stages (or a sibling `serviceStages.ts`) |
| `apps/api/src/services/MarketingCustomerProjection.ts` | `mapCustomerStatus` entries for the two new stages |
| `apps/api/src/routes/recovery-intake-public.ts` | code-vs-registry dispatch, `/options` endpoint, `intakeKind` on public reissue |
| `apps/api/src/services/MarketingCampaignService.ts` | data-driven auto-gen hook (reads definitions), transition map entries |
| `apps/api/src/routes/marketing-ops.ts` | `intakeKind` param on reissue, new list endpoint, import-result endpoint |
| `apps/web/src/services/RecoveryIntakePublicService.ts` | generic `submitRegistryIntake`, widen type, `getOptions` |
| `apps/web/src/components/intake/IntakeFormRenderer.tsx` | NEW — definition-driven form renderer |
| `apps/web/src/app/recovery/intake/IntakePageClient.tsx` | registry render path + definition-driven copy + options fetch |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` | generic evidence renderer + per-kind link list/copy + downstream action panel (stub button + manual import textarea) |
| `apps/api/src/services/__tests__/DisputeIntakeService.test.ts` | new test cases |
| `apps/api/src/services/__tests__/IntakeDefinitionService.test.ts` | NEW — niche merge, dynamic schema builder, adapter dispatch |
| `apps/api/src/tests/recovery-intake-public-routes.test.ts` | new dispatch test cases |
| `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` | new stage-mapping cases |
| `apps/api/src/services/__tests__/recoveryResolution.test.ts` / `recoveryCascade.test.ts` / `recoveryAdmin.test.ts` | multi-intake regression updates |

---

## 5. Verification

- `pnpm checkapi` + `pnpm checkweb` pass — `checkapi` is the net that
  catches every Phase 3b relation-ripple break after `prisma db pull` +
  `prisma:generate`
- `doppler run --config local -- pnpm prisma db pull` succeeds (introspects
  migration 173 changes into `schema.prisma`)
- `pnpm prisma:generate` succeeds after introspection
- New unit + route tests pass; existing recovery suites
  (`recoveryResolution`, `recoveryCascade`, `recoveryAdmin`) pass
  unmodified-in-behavior after the multi-intake updates
- Manual: generate a `gbp_optimization` intake link via admin route, open
  the public URL, submit the form, confirm `evidence_payload` persisted +
  `mkt_owner_voice_profile` (for review) / `business_hours_list` +
  `gbp_attributes` (for GBP, tenant-linked) updated
- Manual: create a dispute intake + a GBP intake on the **same campaign**,
  submit both, confirm two rows coexist, the stage guard never moves the
  campaign backward, and recovery resolution delivery still picks the
  dispute row's `owner_email`
- Flexibility proof: INSERT a test definition row for one of the §7.4
  seeded kinds (e.g. `service_landing_pages` with the auto-repair niche
  override), activate it, generate a link, and confirm the public form
  renders + submits with **zero code changes**

---

## 6. Decisions

### 6.1 Per-kind stages (DECIDED)

Add per-kind stage literals rather than reusing `intake_submitted`:

- `dispute` → `intake_submitted` (existing)
- `profile_repair` → `intake_submitted` (existing)
- `gbp_optimization` → `gbp_intake_submitted` (new)
- `review_response_setup` → `review_setup_submitted` (new)

Per-kind stages keep the transition map legible per service and let
operators filter pipelines by which intakes are outstanding. Required
plumbing beyond the transition map:

- **Which machine:** the new kinds serve review-pipeline campaigns
  (see corrected §6.2), so add `gbp_intake_submitted` and
  `review_setup_submitted` to `REVIEW_TRANSITIONS` — reachable from
  `paid`, `delivered`, and `retainer_won`, with outbound transitions back
  to the stage the campaign came from (or forward to
  `delivered`/`retainer_pitched`). The parallel-intake stage guard
  (Phase 3, item 5) prevents clobbering when both intakes are outstanding.
  With the registry (§7), a definition's `submitted_stage` is only valid
  if it exists in the campaign's transition map — validate at seed/admin
  time; new kinds should reuse these two stages unless a genuinely new
  stage is warranted.
- **Literal centralization:** add the two literals to
  `recoveryStages.ts` (labels + zod enum + `isRecoveryStage` guard) or a
  new sibling module if they're considered service-pipeline rather than
  recovery stages — decide at implementation; either way no inlined
  strings.
- **Customer portal mapping:** add both stages to
  `MarketingCustomerProjection.mapCustomerStatus` → `payment_received`
  ("Payment received") — the owner has paid and submitted setup info,
  matching the existing `intake_submitted` treatment. Without this they
  silently fall into the `in_production` fallback. Also confirm
  `mapCustomerStatus` handles `awaiting_owner_intake` deliberately
  (today: fallback) — out of scope to change, just don't regress it.
- **`STAGE_DATE_FIELDS`:** no new date columns — the intake row's
  `submitted_at` is the timestamp of record.
- **Track-switch guardrails:** `TRACK_REMAP_*` tables return null
  (blocked) for unknown stages — the new stages are blocked from track
  switches by default, which is correct (they're review-pipeline stages;
  escalation after intake submission is already blocked today).

### 6.2 Auto-generation triggers (REWRITTEN — original was impossible)

The original text said "fire at `outreach_dispatched` and `retainer_won`
for `gbp_optimization` and `review_management` campaigns." Two problems
found in verification:

1. `gbp_optimization` is an **intake kind**, not a campaign category —
   `CampaignCategory` is `'review_management' | 'recovery_management' |
   'profile_repair' | 'triage_management'`. No new category is added
   (that would cascade into `transitionsFor`, `pipelineFor`, admin UI
   tabs, and playbook matching — a much larger change).
2. `outreach_dispatched` exists only in `RECOVERY_TRANSITIONS`.
   Review-pipeline campaigns (`review_management`) run
   seek → preview_built → shown → paid → delivered → retainer_pitched →
   retainer_won and **never** pass through `outreach_dispatched`.

**Corrected trigger table:**

| Intake kind | Campaign selection | Trigger stage(s) |
|-------------|-------------------|------------------|
| `dispute` (existing) | `recovery_management` | `outreach_dispatched` (existing hook, unchanged) |
| `profile_repair` (existing) | `profile_repair` + escalated | `outreach_dispatched` + track-switch call site (existing, unchanged) |
| `review_response_setup` | `review_management` | `paid` (one-time purchase) and `retainer_won` (retainer) |
| `gbp_optimization` | campaigns whose purchased service is GBP-related — match on `service_category` / playbook code (e.g. the "GBP Media & Project Asset Optimization" products seeded in migration 158) | `paid` and `retainer_won` |

Operators can always generate/reissue any kind manually via the Phase 5
admin endpoints regardless of triggers. The `generateIntakeLink` method is
idempotent **per kind** (after the Phase 3 fix), so firing at both stages
is safe — the second call reissues a fresh token + resets expiry for that
kind only.

**Revision 2 note:** the trigger table above is *data*, not code — it
lives in `mkt_intake_definitions.trigger_stages` + `service_category`
(§7.1), and the Phase 3 hook reads it. Adding a niche/service kind wires
its triggers with the definition row.

### 6.3 Downstream agent for GBP/review (DECIDED — stub + manual path)

No existing GBP sync or review-request agent to enqueue yet. Stub the
enqueue as a best-effort warning (mirroring the recovery intake's
`logger.warn` on enqueue failure), and provide a **manual dual path**
matching the prompt execution pattern (`MarketingExecutionService.executeSingle`
for AI vs `MarketingPromptService.importExternalResult` for manual
external import).

**Stub behavior on intake submit:**

```ts
// Best-effort enqueue — stubbed for now (no agent wired yet).
// Operator can manually trigger the downstream action from the admin
// workspace, or import an external result (dual path, see below).
try {
  // TODO: wire GbpSyncService.enqueue / ReviewRequestService.enqueue
  //   when those agents are built. Until then, log a warning so the
  //   operator knows manual action is required.
  logger.warn('GBP sync agent not yet wired — operator must manually trigger or import', ctx, {
    intakeId: record.id,
    campaignId: record.campaign_id,
    intakeKind: 'gbp_optimization',
  });
} catch (enqueueError) {
  logger.warn('GBP sync enqueue failed — operator can manually re-run', ctx, {
    intakeId: record.id,
    campaignId: record.campaign_id,
    error: (enqueueError as Error).message,
  });
}
```

**Manual dual path (operator-side):**

Mirror the prompt execution dual path — the operator can either:

1. **AI execute** (future): trigger the downstream agent from the admin
   workspace once `GbpSyncService` / `ReviewRequestService` exist
   (analogous to `MarketingExecutionService.executeSingle`).
2. **Manual external import** (available now): paste an external agent's
   JSON output into the admin workspace, which validates against the
   expected output schema and persists the result (analogous to
   `MarketingPromptService.importExternalResult`).

For Phase 1 of this plan, only the stub + the manual import path are
built. The AI execute path is a stub button in the admin UI that surfaces
the "not yet wired" warning. The manual import path accepts the GBP
optimization or review-response result JSON, validates it, and writes to
the downstream tables (`gbp_locations_list` / `gbp_attributes` /
`gbp_listing_categories` for GBP; `mkt_owner_voice_profile` /
`mkt_review_response_pipeline` for review — though the review intake
already writes these directly from the owner's submitted payload, so the
manual import path is primarily for GBP where an external agent may
produce the optimized profile data).

**Admin UI additions (Phase 5):**

- Recovery detail page gains a "Downstream Action" panel per intake kind:
  - For `gbp_optimization`: "Run GBP Sync" button (stubbed → warning) +
    "Import External Result" textarea + schema validation.
  - For `review_response_setup`: "Run Review Setup" button (stubbed →
    warning) + "Import External Result" textarea (rare — owner payload
    already populates the tables).
- Both reuse the existing `importExternalResult` pattern's validation +
  persistence shape, adapted for the GBP/review output schemas. Backend
  endpoint specified in Phase 5 (`POST …/intakes/:kind/import-result`).

### 6.4 Prisma relation 1:1 → 1:N (DECIDED — ripple is in scope)

Removing `campaign_id @unique` flips
`mkt_campaigns_list.mkt_dispute_intake` from `mkt_dispute_intake?` to
`mkt_dispute_intake[]`. Rather than preserving a 1:1 illusion, all
consumers become kind-aware via `findByCampaignAndKind` / a
`kindForCampaign(campaign)` helper (Phase 3b table). Recovery flows
(dispute + escalated profile_repair) are behavior-preserving; they never
touch the new kinds' rows.

Alternative considered and rejected: keep `campaign_id @unique` and put
parallel intakes in a new table — duplicates the entire token/attachment/
submit machinery for zero gain (see §2).

### 6.5 GBP write targets (DECIDED — corrects the original plan)

The original plan said "write confirmed hours/attributes/categories to
`gbp_locations_list` / `gbp_attributes` / `gbp_listing_categories`."
Verification found `gbp_locations_list` is a Google **sync cache**
(account_id/location_id keyed) with no hours, service-area, or booking-URL
columns, and `gbp_listing_categories` requires a synced listing. Corrected
targets:

| Intake field | Write target (tenant linked) | No tenant / no location |
|--------------|------------------------------|--------------------------|
| `confirmed_hours` | `business_hours_list.periods` + `business_hours_special_list` | `evidence_payload` only + `logger.warn` |
| `service_area` | `evidence_payload` (no tenant-scoped home today) | same |
| `booking_url` | `tenant_business_profiles_list` (or payload-only if no suitable column) | payload only |
| `category_preferences` | `gbp_listing_categories` only when a synced `gbp_locations_list` row exists | payload only |
| `attribute_confirmations` | `gbp_attributes` (upsert by `[tenant_id, attribute_id]`) | payload only |
| `photo_uploads` | `gbp_media` rows (`source_url` = attachment URL, `is_active`) | attachments stay on the intake row |

`evidence_payload` is always written first and is the system of record at
intake time; the tenant-table writes are a convenience projection for the
(eventual) GBP sync agent.

### 6.6 Owner link delivery for the new kinds (DECIDED)

Recovery links reach owners via hardcoded per-kind email copy in
`RecoveryCascadeService.ts:273-278` — but review-pipeline campaigns have
no cascade, and `paid`/`retainer_won` transitions send nothing. Two
options:

- **A (Phase-1 scope, chosen):** operator-delivered. The Phase 5
  `GET /:campaignId/intakes` list + copy-to-clipboard in the admin detail
  page is the delivery mechanism; operators paste the link into whatever
  customer thread they're already running. Zero new email surface.
- **B (follow-up, not in this plan):** automated transactional email on
  link generation (per-kind copy, mirroring the cascade templates) via
  the existing email service — revisit if operator toil becomes painful.

The `viewed_at` stamp + admin intake list give operators visibility into
whether the owner has opened the link either way.

---

## 7. Schema-Driven Intake Architecture (Revision 2)

Driver: niche category scans (e.g. the 2026-08 Plainfield auto repair
scan) recommend ~10 deliverable services, most needing their own owner
intake. Per-kind code does not scale; the registry does.

### 7.1 `mkt_intake_definitions` table (created by migration 173)

| Column | Type | Notes |
|--------|------|-------|
| `intake_kind` | VARCHAR(40) PK | referenced by `mkt_dispute_intake.intake_kind` FK |
| `label` / `description` | VARCHAR(255) / TEXT | operator-facing |
| `driver` | VARCHAR(10) | `'code'` (dispute, profile_repair) \| `'registry'` |
| `service_category` | VARCHAR(100) NULL | purchased service that triggers this intake — matches `mkt_campaigns_list.service_category` / `mkt_service_categories_list.value` |
| `trigger_stages` | JSONB | pipeline stages that auto-generate the link, e.g. `["paid","retainer_won"]` |
| `submitted_stage` | VARCHAR(50) | campaign stage on submission (must be reachable in the campaign's transition map — validated at seed time) |
| `form_schema` | JSONB | field list: `key`, `type` (see renderer table, Phase 4), `label`, `help_text`, `required`, `validation` (min/max/pattern), `options` or `options_source`, optional `custom_validator` |
| `field_mappings` | JSONB | `[{ field, adapter, config? }]` — write-behind via whitelisted adapters (Phase 3, item 3); unmapped fields default to `payload_only` |
| `owner_copy` | JSONB | `title`, `subtitle`, `intro`, `statement_label`, `success_message` |
| `niche_overrides` | JSONB | keyed by lowercased GBP category (same values as `mkt_business_type_categories.category`): `{ "auto repair": { add_fields, field_overrides, owner_copy_overrides } }` |
| `downstream_agent` | VARCHAR(100) NULL | label for the §6.3 stub / future agent wiring |
| `version`, `is_active`, timestamps | | definition iteration without touching intake rows |

### 7.2 Definition resolution

`IntakeDefinitionService.resolve(intakeKind, campaignCategory)`:

1. Load the active row by `intake_kind` (in-memory cache, TTL or bump on
   admin update).
2. If `niche_overrides` contains the campaign's lowercased category,
   merge it over the base definition (added fields, overridden labels).
3. Return the effective definition. Intake rows store only
   `intake_kind` — resolution re-applies at resolve/submit time, so
   definition updates apply to outstanding links.

### 7.3 What stays code

- Token / resolve / submit / attachment machinery (already generic).
- Write-behind adapters (whitelisted functions — the only code a new
  write target requires).
- The `hours_grid` widget and any `custom_validator` functions.
- `dispute` / `profile_repair` end-to-end flows (`driver = 'code'`).

### 7.4 Seed definitions (from the auto repair category scan)

Ship `gbp_optimization` + `review_response_setup` active; seed the
remaining scan-derived kinds **inactive** pending per-niche field review:

| Scan recommendation | Intake kind | Key fields |
|---------------------|-------------|------------|
| GBP optimization + recurring maintenance | `gbp_optimization` | hours grid, service area, booking URL, categories, attributes, photos |
| Review-request + owner-response workflow | `review_response_setup` | voice profile, response policy, request config |
| Mobile appointment + estimate-request forms | `appointment_estimate_setup` | booking platform/URL, estimate info requirements, mobile workflow notes |
| Service landing pages | `service_landing_pages` | services offered (chips — niche override seeds brakes/diagnostics/engines/transmissions/AC/suspension/diesel/fleet for auto repair), differentiators, warranty terms |
| Digital vehicle-inspection demo content | `dvi_content_setup` | has-DVI-process, sample media (attachments), usage consent |
| Shop/technician/equipment/repair photography | `photo_asset_collection` | attachments-heavy: exterior, interior, technicians, equipment, completed repairs |
| Hours / holiday / directory sync | `hours_directory_sync` | hours grid, holiday hours, directories to sync |
| Local SEO (Plainfield / Hendricks County) | `local_seo_setup` | service-area chips, priority towns (geo pre-fill), target services |
| Call / form / appointment conversion tracking | `conversion_tracking_setup` | call-tracking consent, primary conversion goals, form endpoints |
| Monthly reputation + visibility reporting | `reporting_preferences` | metrics checkboxes, delivery email, cadence |

### 7.5 Adding a new kind (the payoff)

1. INSERT a definition row (migration seed now; admin tooling later).
2. New write target? Add one whitelisted adapter function.
3. New widget? Add one renderer field type.

No route, service-method, or `mkt_dispute_intake` schema changes — and no
CHECK-constraint migration (§Phase 1 FK instead).

### 7.6 Admin definition tooling (future sprint — vision)

**Vision:** operators/admins author intake definitions (scope/category/
campaign-aware forms) through an admin UI — a form-schema builder,
field-mappings picker, niche-overrides editor, and live preview — with no
engineer involvement.

**This sprint builds the engine that makes that possible; the admin CRUD
surface is a separate follow-up sprint.** Definitions are seeded by
migration and edited by engineers until then.

**Schema readiness (address now to avoid a follow-up migration):** the
§7.1 column list is shaped for admin authoring, but two columns should be
added in migration 173 so the follow-up sprint doesn't need a migration:

| Column | Type | Why now |
|--------|------|---------|
| `created_by` / `updated_by` | VARCHAR(255) NULL | Admin authoring needs to track who edited a definition. Engineer-seeded rows set this to `'system'`. |
| `is_draft` | BOOLEAN DEFAULT false | Admin authoring needs a draft/published state so operators can iterate on a definition without it being live. Engineer-seeded rows ship `is_draft = false`. (`is_active` already exists but means "retired" — a definition can be active-but-draft while being edited, or inactive-and-published. `is_draft` gates resolve/submit; `is_active` gates whether the kind is offered at all.) |

The `version` column already supports iteration without touching intake
rows; the follow-up sprint's admin UI will use `version` + `is_draft` +
`is_active` together for the publish flow.

**Follow-up sprint scope (not in this plan):**
- Admin CRUD routes (`/api/admin/marketing-ops/intake-definitions`)
- Form-schema builder UI (drag-and-drop field editor → `form_schema` JSONB)
- Field-mappings picker (adapter dropdown → `field_mappings` JSONB)
- Niche-overrides editor (per-category field add/override UI)
- Live preview (renders `IntakeFormRenderer` against the in-progress
  definition without persisting)
- Validation at save time (`submitted_stage` reachable in transition map,
  adapter names whitelisted, `form_schema` well-formed)

---

## 8. Sprint 1 Pre-Flight Checklist

Per `start-of-phase-sprint-checklist.md`. Completed before implementation.

### 8.1 Singleton Service Strategy

| Service | Audience | Web base | API base |
|---------|----------|----------|----------|
| `RecoveryIntakePublicService` (existing, extend) | Public storefront | `PublicApiSingleton` (existing, `ttl: 0`) | N/A |
| `IntakeDefinitionService` (new) | Internal — called by routes + service | N/A | `BaseService` (stateless load + cache, no tenant scope) |
| `DisputeIntakeService` (existing, extend) | Internal | N/A | `BaseService` (existing singleton) |
| Write-behind adapters (new module) | Internal — called by `DisputeIntakeService` | N/A | Stateless functions (no singleton needed) |

No direct `fetch` — all frontend calls via `RecoveryIntakePublicService` (existing pattern).

### 8.2 Skill Document Awareness

**Skills read before starting:**
- `manual-sql-migration-policy.md` — **critical**: never edit `schema.prisma`; SQL migration → `prisma db pull` → `prisma generate`. Plan corrected in Phase 1.
- `backend-dev-guidelines.md` — layered architecture, `asyncErrorWrapper`, Zod validation, `unifiedConfig` only.
- `tenant-scoped-id-generation.md` — `mkt_intake_definitions` PK is `intake_kind` (VARCHAR(40)), not a generated ID. No new ID generator needed. Existing `generateDisputeIntakeId` / `generateDisputeToken` reused for intake rows.

**Skills to update after completion:**
- `manual-sql-migration-policy.md` §4 — add migration 173 as a worked example for `mkt_*` namespace (composite unique drop/add + FK + JSONB seeds).
- `start-of-phase-sprint-checklist.md` — no changes needed.

**New skill to create after completion:**
- `.devin/skills/registry-driven-intake-forms.md` — captures the registry-driven definition pattern (`mkt_intake_definitions` + dynamic Zod builder + generic renderer + write-behind adapters + niche overrides). This is a reusable architecture pattern for any "declarative form definition → runtime validation + rendering" need.

### 8.3 Tenant-Scoped ID Planning

| Entity | ID format | New generator? |
|--------|-----------|----------------|
| `mkt_intake_definitions` | `intake_kind` VARCHAR(40) PK (natural key, not generated) | No |
| `mkt_dispute_intake` (existing) | `mdint-{nanoid}` (existing `generateDisputeIntakeId`) | No |
| `mkt_dispute_attachments` (existing) | `mdatt-{nanoid}` (existing `generateDisputeAttachmentId`) | No |
| Intake access tokens (existing) | 32-char nanoid (existing `generateDisputeToken`) | No |

No new ID generators needed this sprint.

### 8.4 Navigation & Page Planning

No new pages or sidebar links this sprint:
- Public intake page: `/recovery/intake` (existing, extending form branching)
- Admin recovery detail: `/settings/admin/marketing-ops/recovery/[campaignId]` (existing, extending evidence display + downstream action panel)
- No new settings cards — the intake portal is operator-triggered from the existing recovery detail page.

### 8.5 Backend Architecture Planning

| Route file | Change | Auth level |
|------------|--------|------------|
| `recovery-intake-public.ts` (existing) | Add registry dispatch to `/submit`, new `GET /options` endpoint, `intakeKind` on `/reissue` | Public (token-gated) |
| `marketing-ops.ts` (existing) | `intakeKind` param on reissue, new `GET /:campaignId/intakes`, new `POST .../import-result` | Admin (`authenticateToken` + `requirePlatformAdmin`) |

No new route files. No new registry entries (existing `recoveryIntakePublicRoutes` mount at `/api` covers the public endpoints; `marketingOpsRoutes` mount at `/api/admin/marketing-ops` covers admin).

No new background jobs (downstream agent enqueue is stubbed to warning).

### 8.6 Database & Migration Planning

- **Migration file:** `database/migrations/173_intake_generalization.sql`
- **New table:** `mkt_intake_definitions` (no RLS, no triggers — `mkt_*` namespace convention)
- **Constraint changes:** drop `mkt_dispute_intake_campaign_id_key`, add composite `UNIQUE(campaign_id, intake_kind)`, widen `intake_kind` to VARCHAR(40) + FK to `mkt_intake_definitions`
- **Seed data:** 4 definition rows (2 code-defined, 2 registry-defined with JSONB `form_schema` / `field_mappings` / `owner_copy`)
- **Idempotency:** `IF NOT EXISTS` / `IF EXISTS` guards, `ON CONFLICT DO NOTHING` for seeds, `BEGIN; ... COMMIT;`
- **Prisma:** `prisma db pull` → `prisma generate` (never edit `schema.prisma` directly)

### 8.7 Frontend Architecture Planning

| Component | Type | Reuse |
|-----------|------|-------|
| `IntakeFormRenderer.tsx` (new) | Client component | Mantine controls, existing `FileInput` + `handleFileUpload` |
| `IntakePageClient.tsx` (existing) | Client component | Existing token resolve / expired / submitted scaffolding |
| `RecoveryDetailClient.tsx` (existing) | Client component | Existing evidence display scaffolding |

No React Query cache keys (token-gated, `ttl: 0` on all public service methods).

### 8.8 Capability System Planning

No capability features this sprint — intake definitions are platform-admin scoped, not tenant-tier-gated.

### 8.9 Pre-Flight Summary

```
Phase/Sprint: Intake Portal Generalization Sprint 1
Design doc: docs/LocalBiz/INTAKE_PORTAL_GENERALIZATION_PLAN.md

New services: IntakeDefinitionService (BaseService), writeBehindAdapters (stateless functions)
New entities: mkt_intake_definitions (registry table, natural-key PK)
New ID generators needed: none (existing generators reused)
New pages/routes: none (existing routes extended)
New sidebar links: none
New settings cards: none
New migration: 173_intake_generalization.sql
New background jobs: none (downstream enqueue stubbed to warning)
New capability features: none
Skills to read before starting: manual-sql-migration-policy.md, backend-dev-guidelines.md, tenant-scoped-id-generation.md
Skills to update after completion: manual-sql-migration-policy.md §4 (migration 173 worked example)
Insights to capture in skills: registry-driven definition pattern (dynamic Zod from JSONB, generic renderer, write-behind adapter whitelist, niche override merge)
New skill to create: .devin/skills/registry-driven-intake-forms.md
```

### 8.10 Critical Correction Applied

**Phase 1 Prisma schema edits → removed.** The original plan said "update
`apps/api/prisma/schema.prisma`" in 3 places. This violates
`manual-sql-migration-policy.md`: never edit `schema.prisma` directly.
Corrected to: SQL migration → `prisma db pull` → `prisma generate`. The
`prisma db pull` introspection step automatically captures the composite
unique, FK, widened column, relation cardinality flip, and new
`mkt_intake_definitions` model.
