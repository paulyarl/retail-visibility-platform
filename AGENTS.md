# AGENTS.md — Project Conventions

## Build & Typecheck Commands

- `pnpm checkapi` — TypeScript check for `apps/api` (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` — TypeScript check for `apps/web` (`tsc --noEmit --project apps/web`)
- `pnpm prisma:generate` — Regenerate Prisma Client (run after schema changes)
- `doppler run --config local -- pnpm prisma db pull` — Pull DB schema into `prisma/schema.prisma` (run from `apps/api`)
- `doppler run --config local -- pnpm prisma generate` — Regenerate client with Doppler secrets
- `cd apps/web && npx vitest run` — web unit tests (vitest, node environment, `src/**/*.test.ts`). Run a single file by path.

### Web component render tests (no jsdom needed)

`apps/web` has no jsdom/testing-library, but Mantine 9 ships **pre-compiled CSS modules** (`.module.mjs` are plain JS class-name maps, no CSS imports), so a component can be server-rendered in the existing node-environment vitest project:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';

const html = renderToStaticMarkup(
  createElement(MantineProvider, null, createElement(SomeView, { profile })),
);
expect(html).toContain('…');
```

Wrap in `MantineProvider` or Mantine throws `MantineProvider was not found in component tree`. Pattern: `apps/web/src/components/marketing-ops/BronzeStandardProfileView.test.ts`. Note `Accordion` panels are unmounted while collapsed (`keepMounted` defaults to false), so assert collapsed-panel copy only after expanding.

Non-Mantine components need **no provider** — plain elements + Radix wrappers (`@/components/ui/Tabs`) + lucide icons all render bare (`ResolveVerificationModal.test.ts`, `BusinessContactCard.test.ts`). Rules of thumb learned wiring the marketing-ops tests (2026-09-23):

- **Radix `TabsContent` unmounts inactive panels** (same trap as `Accordion`). The static render only produces the active tab's markup. Preferred workaround: give the component an optional `initialTab` prop (see `ResolveVerificationModal`) and render the test with `initialTab: 'enrichment'` — do NOT mock `@/components/ui/Tabs`; keep tests on real primitives. The same trick works for *state-gated* panels: `ResolveVerificationModal`'s `initialOutcome` prop lets a test render the non-operational gate notice / blocked next-action without interaction. Export pure helpers the component relies on (`snapshotWebsite`) so edge-case coercion is unit-testable too.
- **`useEffect` never runs** in `renderToStaticMarkup`. Data-loading components (`IdentityPacketCard`) can only render their loading state, so test the *data contract* instead: extract the pure bridge/mapper into a named export (`buildVerificationEntryFromPacket` in `IdentityPacketCard.tsx`) and unit-test it + integration-test the presentational child (`ResolveVerificationModal`) it feeds.
- **Service singletons import cleanly.** `MarketingOpsService.getInstance()` is instantiated at module load but its browser globals (`window`, `localStorage`, `navigator.sendBeacon`, `document.cookie`) are all `typeof window !== 'undefined'`-guarded, so a client component importing the service renders in node — its methods only run inside event handlers that never fire in SSR.
- **`.test.ts`, not `.tsx`.** `vitest.config.ts` includes only `src/**/*.test.ts` and JSX needs a `.tsx` filename — use `createElement`, and cast partial fixtures (`as unknown as Campaign`) rather than filling every field of the big service types.
- **Assert on `value="…"` attributes.** Controlled inputs serialize their prefilled state into markup, so `expect(html).toContain('value="MapQuest"')` pins the prefill — the exact assertion that would have caught the snapshot-prefill regression.
- **Async server pages are testable as elements.** `await PlacesIndexPage()` returns the fragment element without rendering, so band order can be pinned by type: `Children.toArray(page.props.children)` → `types[0] === PlacesIndexHero`. Mock the service with `vi.mock('@/services/PlacesBrowsePublicService', async (importOriginal) => ({ ...await importOriginal(), default: { …vi.fn()s } }))` — the `importOriginal` spread keeps named/type-ish exports resolvable. Pattern: `apps/web/src/app/place/place-index-order.test.ts`.

### `/place` home — header leads, national coverage copy follows (added 2026-09-23)

`PlacesIndexHero` (server) renders the breadcrumb + H1 + browse copy + search entry + shelf counts, then `PlaceNationalPanel` renders the national packet narrative/coverage band, then the category grid. The panel originally rendered *above* the client index, so the title trailed the copy. The header is server-rendered because the old client-owned header only existed after hydration (the client returns its loading branch during SSR, so the H1 was absent from the HTML) — the hero must stay above the panel and outside the client's loading gate. Counts come from the server-side `getCategories()` read in `page.tsx`, passed down as `initialCategories`; `PlacesIndexClient` keeps its fetch only as the fallback for when that read returns null.

### Intelligence profile view dispatch (3 shapes, 2 surfaces)

`configuration_json` has three shapes and each needs its own view — a mismatch renders a header-only shell:

| Shape | Detection | View |
|---|---|---|
| `gold_standard_scan` (`expected_fields`, `candidates`) | `isGoldStandardProfile` (colocated in `GoldStandardProfileView.tsx`) | `GoldStandardProfileView` |
| `bronze_standard_scan` (`reason_coverage`, `catalog_snapshot`, `vector_execution_log`, `scope_mix`) | `isBronzeStandardProfile` (`apps/web/src/lib/bronze-standard-profile.ts`) | `BronzeStandardProfileView` |
| §10 Category Intelligence Profile (`terminology`, `specialized_sources`, `category_signals`) | fallback | `CategoryProfileView` |

Both surfaces must dispatch: `IntelligenceProfilesClient` (View modal) and `IntelligenceEstablishmentPanel` (campaign Overview tab). The panel renders `activeProfile ?? bestMatchingDraft` — a draft shows as a labeled preview, so an establishment campaign's overview renders the scan output **before** activation too.

### Bronze discovery — reason-slot fill pattern (added 2026-09-23)

Bronze discovery campaigns (`scope=intelligence`, `focus=bronze_standards`, `kind=discovery`) mirror gold discovery: the ACTIVE profile owns a slot board of per-reason exemplar slots (cap 2, `MAX_SLOTS_PER_REASON`), and the imported city scan's draft is the candidate pool. `BronzeStandardDiscoveryPanel` renders on the campaign Overview tab (after the establishment branch in `CampaignDetailClient`) — the slot board, discovered candidates (`bronzeDiscoveryFillCandidates` in `lib/bronze-standard-profile.ts` diffs draft vs active on name+address), and click-to-fill/remove.

Fill/unfill commit DIRECTLY to the active profile — retire old active + new active version in one transaction, one version bump per action, mirroring `addGoldStandardCandidate`/`removeGoldStandardCandidate`. Endpoints: `POST/DELETE /intelligence-profiles/:id/bronze-slots` → `IntelligenceProfileService.addBronzeReasonFill`/`removeBronzeReasonFill`. Distinct from the draft-gated `POST /:id/bronze-fill` (§7.3 out-of-loop writes). Removing a reason's last slot reverts the entry to `empty_unproven`. With no active profile the imported draft shows as proposed coverage — activating it establishes the board.

### Bronze catalog snapshot — DB truth, not the model's echo

A bronze profile's `catalog_snapshot` is documented as a verbatim embedding of the scope-applicable catalog rows (§4), but the model re-echoes ~17 rows by hand and **the injected block is its only source**. Two consequences to keep in mind when touching either side:

- `BronzeReasonCatalogService.serializeCatalogBlock` must emit each reason's `Scope:` line (`formatBronzeReasonScope`) — without it the model can only fill `scope_*` with nulls, so a category-scoped reason (`trade_manifest_only`, `wholesale_or_hybrid_role` in migration 291) comes back reading as `universal` and `scope_mix` is wrong. The block is injected at render time, so fixing it needs **no seed re-run**.
- The bronze import hook (`MarketingPromptService`, `schemaName === 'bronze_standard_scan'`) rebuilds `catalog_snapshot` + `scope_mix` + `catalog_revision` from `mkt_bronze_reason_catalog` via `buildBronzeCatalogSnapshot(applicableReasons(scope))` whenever the payload carried a snapshot. `scope_mix` counts by geographic level AND counts platform-scoped reasons separately in `platform_bound` (independent axis, §3.6.5) — a platform-only reason is `universal` + `platform_bound`.

Live profiles scanned before this fix keep the all-`universal` snapshot; the next establishment scan re-imports a correct one (no backfill script).

### Bronze scans — catchment footprint + cascading national proof (added 2026-09-22)

Two behaviors widen what a city bronze scan covers and what context it sees:

- **Catchment footprint.** Bronze scans (stage-1 market-scoped establishment, stage-2 standalone city scan, and the folded city scan inside emerging establishment) inject the same `GEOGRAPHY GRID` retail-catchment block stage-3 discovery uses — campaign `intelligence_zip_codes` / `intelligence_search_radius_miles` > `mkt_geography_grids` cache > AI derivation. `renderBronzeRegionDirective`'s coverage boundary is the **catchment**, not the administrative city line, so a state-line-split metro (Kansas City, MO/KS) fills slots on both sides. The profile still anchors to campaign `city`/`state` (resolution + catalog-predicate key); fills record their real municipality via `observed_city`/`observed_state` on the slot schema. Location-scoped catalog rows remain anchor-bound — the `applicableReasons` predicate was not widened to catchment municipalities.
- **Cascading national proof.** When `resolveBronzeStandard` returns a market-scoped profile (city/state set), `resolveBronzeNationalProofBlock` also resolves the nationwide row and injects `serializeBronzeStandard(profile, 'national_proof')` — a compact proven/unproven record (one exemplar name per reason, no vector log, no drift expansion). It grounds `empty_proven_elsewhere` classification and exemplar evidence depth that a thin city profile can't supply. Skipped when the resolved profile IS national or no distinct national row exists. Applies at all three bronze injection sites: stage-2 standalone, stage-3 emerging calibration, and the folded city scan.

### Bronze consumer write-back — attribution is the fill gate (added 2026-09-22)

`importExternalResult` (`MarketingPromptService`) has two post-import hooks that extend §7.3's out-of-loop fill path to bronze's consumers — the establishment scan may miss a business its consumers reach:

- **Discovery lane (§7.4):** `intelligence_discovery` imports write each attributed candidate's reasons to the market's resolved bronze profile as `discovered_by: 'emerging_scan'|'competitive_scan'` slots — confirmatory, dropped on re-scan unless re-found. Only in-market, non-`benchmark_only` candidates write; one new draft version per import via `IntelligenceProfileService.recordBronzeExternalFills` (batch — N fills produce ONE draft).
- **Audit lane (§7.3):** a `business_analysis` import on a campaign carrying `discovery_context.bronze_attribution` writes `business_audit` slots — but ONLY when the audit confirms low digital quality (≥1 failed `non_negotiable` quality gate, or a `non_negotiable` gap when gate results are absent). These are ground truth and survive re-scans via `mergeBronzeCoverage`.

No active bronze profile at the campaign's scope → fills are noted, not written (never fabricate a profile). Un-attributed candidates never write — attribution must be causal, not resemblance. `POST /intelligence-profiles/:id/bronze-fill` remains restricted to operator/audit provenance.

## Seed Scripts — Re-run Discipline

Seed scripts in `apps/api/src/scripts/seed-*.ts` are idempotent (update-in-place) but are **not** run automatically. After editing any seed file, you MUST re-run it against both `local` and `prd` Doppler configs, or the DB row will be stale and the rendered prompt will silently use the old body.

**Run from `apps/api`:**
```powershell
# Intelligence cluster (has package.json script entries)
doppler run --config local -- pnpm seed:intelligence-fragments
doppler run --config local -- pnpm seed:intelligence-discovery-templates
doppler run --config local -- pnpm seed:intelligence-discovery-signals
doppler run --config local -- pnpm seed:intelligence-profile-establishment-template
doppler run --config local -- pnpm seed:intelligence-profile-auto-repair

# Directory enrichment templates — category/location/category-set packet bodies,
# including the national ('__all__') variants consumed by national enrichment +
# discovery framing.
doppler run --config local -- pnpm seed:directory-enrichment-templates

# Profile repair + marketing ops + gold standard (use npx tsx directly)
doppler run --config local -- npx tsx src/scripts/seed-profile-repair-signals.ts
doppler run --config local -- npx tsx src/scripts/seed-profile-repair-issue-briefings.ts
doppler run --config local -- npx tsx src/scripts/seed-profile-repair-triage-briefing.ts
doppler run --config local -- npx tsx src/scripts/seed-marketing-ops-templates.ts
doppler run --config local -- npx tsx src/scripts/seed-gold-standard-scan-template.ts

# Deliverable source material (spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md)
# Seeds 7 prompt templates: mpt-review-intake, mpt-deliverable-source-material,
# mpt-seed-fulfill-004..008. Data-only — NO migration. Bump SEED_VERSION_MARKER
# in the script to force a body re-sync.
doppler run --config local -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts

# Deliverable layout templates (G-8) — one default jsPDF layout_spec per
# deliverable type in mkt_deliverable_templates_list, so the Generate
# Deliverable modal's Template dropdown has a designed layout per type.
doppler run --config local -- npx tsx src/scripts/seed-deliverable-layout-templates.ts

# Business Audit V2 (Category-Integrated mpt-j9bbem3l + Signal-Aligned mpt-6oeuiizo)
# — wires Category Intelligence + Gold Standard + Website Accessibility Verification
#   directive into both variants. Bump SEED_VERSION_MARKER in the script to re-apply.
doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts

# Website Positioning audit template (PB-08 / A7 website gap, spec:
# docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md) — seeds the
# platform='website_positioning' audit template row.
doppler run --config local -- npx tsx src/scripts/seed-website-positioning-audit-template.ts
```
Repeat each command with `--config prd` for production.

**Verify after re-running:** query the live DB (or regenerate the `docs/api-response/seek-prompt-templates.md` dump) and confirm each template's `updated_at` is newer than the seed file's last git commit. A stale `updated_at` means the seed was not re-run after an edit.

**Idempotency check pattern:** seed scripts must check for the **presence of the new marker** (e.g. `BRIEFING_MARKER`), NOT the absence of an old section (e.g. `!body.includes('## Output')`). The absence-of-old pattern is unsafe because old bodies may never have had the old section either, causing the seed to skip every time.

**Two subtler failure modes (bit us 2026-09-14, seed-business-audit-v2-templates):**
- **`insertAfter` fingerprints only the first 80 chars of the insertion.** Never combine multiple bindings into one `insertAfter` call — if the first chunk is already present, the whole insertion is skipped and the later chunks are silently dropped while the version marker still gets appended.
- **`removeSection` deletes up to the next `##`/`###` heading and swallows headingless content.** A binding inserted between a removable directive and the next heading gets eaten on the next run. Insert headingless bindings (e.g. `MARKET_CONTEXT_BINDING`) AFTER all `removeSection` calls in the transform so each run self-heals.

**Third failure mode (bit us 2026-09-20, same seed): the two V2 variants use DIFFERENT signal-list formats.** `mpt-6oeuiizo` (Signal-Aligned) uses markdown bullets — `` * `WC_BROKEN_WEBSITE`: ... `` — while `mpt-j9bbem3l` (Category-Integrated / "Cohesive") uses plain lines — `WC_BROKEN_WEBSITE: ...` (no bullet, no backticks). A transform that anchors on only one form **throws** `Anchor not found` on the other (and the whole template update is aborted). Two lessons:
- An `insertAfter` anchor that may be absent must be guarded (`if (out.includes(anchor))`) or replaced with a format-aware helper. `replaceFirst` no-ops silently when the `from` is missing; `insertAfter` throws — so a pre-existing silent no-op can become a hard failure the moment you add an `insertAfter` on the same anchor.
- When amending a signal-definition list, handle BOTH formats (`broadenWcBrokenWebsite` / `appendWebsiteGapDefinitions` in the seed are the reference pattern).

## Business Audit — Platform Availability Control (render controls)

Spec: `docs/LocalBiz/AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC.md` (status block is current as of 2026-09-18).

The audit could not previously distinguish "this business is not discoverable on Google" from "the analyst could not render Google" — both produced `unable_to_verify`, emitted no signal, and scored zero, so unverifiability was scored as health. A **render control** (a gold-standard exemplar on the same platform) makes the failure attributable. `signal-extractor.ts` fires `DS_MISSING_PROFILE` only on a `business_specific_failure` determination, falling back to the legacy `!google` rule when `render_controls` is absent.

**Scoring amendments (shipped 2026-09-18):**
- `action_classification` is `nullable().optional()` — the model emits `null` (not `BALANCED_HEALTHY`) when no rating/sentiment could be verified.
- `recommended_tier` is `tierEnum.nullable().optional()`. `applyRenderControlCoverageGate()` (in `business-analysis.schema.ts`) computes `controls_rendered / controls_attempted` from `render_controls`, and when the rate is below `MIN_RENDER_CONTROL_COVERAGE_FOR_TIER` (0.5) it nulls the tier, deletes `estimated_monthly_service_fee`, and stamps `render_control_coverage`. Audits with no `render_controls` are untouched (legacy behaviour preserved).
- **Apply the gate in the import path, not the validator.** `MarketingPromptService.importExternalResult` persists the **raw** parsed JSON (`audit_data: parsedJson`), not the Zod output — a Zod `.transform()` would never reach the stored audit.
- `google_profile_maintenance` rubric split: control-confirmed absence scores 2; verified-maintained scores 0; `unable_to_verify` is excluded from the denominator rather than scored 0.

**Prompt amendments** (all in `seed-business-audit-v2-templates.ts`, each its own fingerprint-safe `insertAfter`/`replaceFirst`, marker `business-audit-v2-2026-09-18-availability-scoring-4`): rubric split, `PLATFORM_GAP_CASCADE_DIRECTIVE` (one `profile_presence` gap + one gate entry per non_negotiable gate — no per-field fan-out), `ACTION_CLASSIFICATION_NULL_DIRECTIVE`, `PLATFORM_SYNDICATION_CLAUSE` (a platform captured via a syndication path is `partial`, not `unable_to_verify`), `DATA_QUALITY_CONFLICTS_CLAUSE` (`conflicts` is for conflicting evidence about the business, not prompt-block provenance).

**Audit card:** `BusinessAnalysisAuditCard.tsx` renders a "Platform Availability (render control)" section + coverage badge, and shows "Tier suppressed" instead of a bare tier when the gate fired.

**Interactive verification (spec §12, shipped 2026-09-19):** an optional caller-supplied `interactive_verification` variable puts the external analyst on notice that an operator is attending the run and may be asked to render blocked platforms (Facebook/Yelp login walls) and paste back observables. `interactive-verification-directive.ts` (services root — universal, scope-agnostic) exports the directive + `buildInteractiveVerificationPreamble`; `resolvePrompt` prefixes it onto `baseRendered` AND the composed-path `rendered` — the only two render sites. The variable is **never body-declared**, so no `SCOPE_VARIABLES` entries and no seed changes are needed; blank/`'off'` is byte-identical to a solo run. Opt-in UI is the "Interactive verification — operator present" checkbox in the Prompt Workspace Variables panel (+ `operator_observations` textarea for the re-render path). New render surfaces that bypass `resolvePrompt` must prefix `buildInteractiveVerificationPreamble(variables)` themselves — fulfill-type paths (recovery resolution, openers, deliverables, bronze test-scan) intentionally skip it since they don't browse platforms.

## Diagnostic Gallery — Eligibility, Rendering & the `preview_built` Gate

Spec: `docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md`.

- **Storage:** diagnostic screenshots live in the private Supabase **`disputes`** bucket (`StorageBuckets.DISPUTES`), created by migration **299** (`INSERT INTO storage.buckets … ON CONFLICT DO NOTHING`). Service-role key bypasses RLS, so no storage policies are needed. A missing bucket surfaces as `500 upload_failed: Bucket not found`.
- **Admin read path:** `GET /api/admin/marketing-ops/:campaignId/files/diagnostic-screenshots` returns `signed_url` + `download_url` (5-min TTL). The web fallback degrades to `listFiles` if the endpoint 404s, so a web-before-API deploy does not break the tab.
- **Eligibility precheck:** `GET /api/admin/marketing-ops/campaigns/:id/gallery-eligibility` (`GalleryEligibilityService`) returns `{ eligible, reason, action, archetype, hasBusinessAnalysisAudit, hasAcceptedTriage, … }`. `reason` ∈ `invalid_stage | no_screenshots | no_business_analysis_audit | archetype_unresolved`. The Gallery tab shows an amber banner + disables Generate from this.
- **Archetype source:** the chain (openers, headers, closers, gallery defaults, deliverable sections) derives from an **operator-accepted triage** or a real (non-stub) `business_analysis` audit. Stub audits (`manual_queue` / `queue_promotion` / `derived_from_parent`) do **not** satisfy it.
- **Hard gate:** `POST /api/admin/marketing-ops/:id/transition` returns `409 business_analysis_required` when `to_stage === 'preview_built'` and no archetype resolves. There is **no acknowledge override** — `preview_built` has no back-edge to `seed` (`REVIEW_TRANSITIONS` is one-way), so entering it without an audit strands the campaign. Fix forward by running the seek-stage business analysis.
- **Stage is not editable via the generic update.** `PUT /api/admin/marketing-ops/:id` returns `400 stage_not_editable` if `stage` is present; the edit form's Stage field is read-only. Previously the field was accepted and then silently dropped by `updateCampaign`, making the dropdown a no-op.

## DB CHECK Constraints — Enum Sync Discipline

`mkt_prospect_queue` (and other mkt_* tables) carry Postgres CHECK constraints that are **not** managed by Prisma (schema.prisma is db-pulled and ignores them). When you add a value to an app-layer enum, you MUST also ship a numbered migration that drops + re-adds the CHECK with the full value set, or inserts with the new value fail with `23514 check constraint violated` (500 `internal_error` at runtime).

Known constraint ↔ enum pairs (drift history: migrations 256, 264, 270 — this has bitten three times):

- `chk_prospect_queue_source_kind` ↔ `ProspectSourceKind` in `MarketingProspectQueueService.ts` + `prospectQueueAddSchema` in `marketing-ops.ts`
- `chk_prospect_queue_status` ↔ `ProspectStatus` (same file)
- `chk_prospect_queue_source_scope` ↔ `ProspectCampaignScope` (same file)
- `directory_seed_outreach_touches_channel_check` ↔ seed-touch channels (`TouchChannel` in `ProvingGroundCadenceService.ts`, `DirectoryPresenceSeedService.ts`, `touchLogSchema` in `directory-presence-admin.ts`). Current set (migration 273): `call, email, sms, mail, form, referral, visit, other`.
- `directory_seed_outreach_touches_outcome_check` ↔ seed-touch outcomes (`TouchOutcome` in `ProvingGroundCadenceService.ts` + report-delivery outcomes in `SeedReportDeliveryService.ts`). Current set (migration 289): 262's set + `report_delivered, report_viewed, report_claimed, report_declined, claim_qr_generated`.

**Silent-drop hazard:** a writer whose value is not in the CHECK fails with `23514`, and if the insert sits inside a best-effort `try/catch` (e.g. `SeedReportDeliveryService.recordDeliveryEvent`), the row is silently dropped with only a `logger.error` — no test failure if the test only asserts SQL *text*. Migrations 259/262/273/289 fixed one such case. When touching a CHECK-guarded table, add a **constraint-parity test** that parses the effective CHECK value set from `database/migrations/*.sql` and asserts the writer's emitted values are members (pattern: `apps/api/src/services/__tests__/SeedReportDeliveryService.test.ts`). Note there is a decoy `apps/api/database/migrations` (13 unrelated legacy files) — resolve the real migrations dir by walking ancestors and picking the candidate with the most numbered files.

When adding an enum value, grep the table name for `chk_` constraints and sync every one the enum touches. Migrations are applied manually: `psql $DATABASE_URL -f database/migrations/<n>_<name>.sql` (Doppler-provided URL), against both `local` and `prd`.

**Migration SOP (team convention):** migrations are always applied **in tandem — staging + prod** — never one environment without the other. Source code and schema therefore travel separately: the DB is migrated when the work lands on `staging`, and the feature only becomes *reachable* once the code reaches `main` (which is what deploys prod). Consequences to design around:

- A DB-only defect (e.g. the `42804` text→date cast on `mkt_identity_evidence`, migration 297/298) is invisible until the endpoint exists in prod, so the **real-DB smoke check on a new table's write path is the guardrail** — not the mocked unit tests, and not `prisma db pull`.
- Never ship a numbered migration file without telling the user it needs the tandem run; a file committed but unapplied leaves `schema.prisma` (db-pulled) describing a table that does not exist.
- Because prod's schema can lead prod's code, additive-only migrations (nullable columns, new tables, `ADD COLUMN IF NOT EXISTS`) are the safe default — a destructive change would hit prod before any code depends on it.

## Seed Intelligence Report — Schema Additions (migrations 271–272)

Spec: `docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md`

- `271_directory_field_provenance_evidence_state.sql` — adds `evidence_state` (varchar 40, CHECK-constrained to the 9-state taxonomy) + `notes` (text) to `directory_field_provenance`. Backfills existing rows: `owner_confirmed` when `override_by IS NOT NULL`, else `observed`. Run against `local` + `prd`.
- `272_mkt_outreach_log_anchor_columns.sql` — adds `anchor_id` (varchar 255), `anchor_snapshot` (jsonb), `verification_results` (jsonb) to `mkt_outreach_log`. All nullable; existing rows unaffected. Run against `local` + `prd`.
- `273_mkt_seed_intelligence_reports.sql` — creates `mkt_seed_intelligence_reports` table for immutable versioned report snapshots (§12.2). `report_data` is the SeedIntelligenceReport DTO; `evidence_refs` references existing provenance/audit/signal/outreach/claim IDs (NOT a duplicate observation store). Run against `local` + `prd`.
- `274_mkt_outreach_anchors.sql` — creates `mkt_outreach_anchors` (§12.4): operator outreach theses scoped to `seed_id` / `campaign_id` / `business_prospect_id` (at least one required), lifecycle `draft → active → used → retired`. Anchor contact events snapshot the anchor into `mkt_outreach_log.anchor_snapshot` + `verification_results`; `fact_confirmed`/`fact_corrected` results also write `directory_seed_nap_verifications` rows (`owner_corrected` FALSE/TRUE respectively). Run against `local` + `prd`.
- `287_mkt_campaign_manual_scripts.sql` — creates `mkt_campaign_manual_scripts` for the openers workspace **Manual tab** (operator playground / producer lane; guide: `docs/LocalBiz/marketing_ops_manual_play_lane_guide.md`). `UNIQUE(campaign_id, template_key)` upsert semantics, `fields` jsonb + `script_body` merge-resolved at read by `ManualOutreachScriptService`, `promoted_opener_id`/`promoted_anchor_id`/`promoted_header_id`/`promoted_closer_id` stamp the shared pipeline rows each doc produced. **No CHECK constraints** — `template_key` is validated in code against `manual-play-templates.ts`; adding a template is a catalog-only change. Run against `local` + `prd` (applied).
- `288_mkt_manual_play_templates.sql` — creates `mkt_manual_play_templates` for operator-authored **Save-as-template** plays (spec: `docs/LocalBiz/MANUAL_PLAY_TEMPLATE_AUTHORING_SPEC.md`). `ManualOutreachScriptService` resolves templates catalog-first, DB-fallback (`resolveTemplate`); `listTemplatesForCampaign` merges `catalog ++ operator(active ∪ saved)`. **No CHECK constraints** — `anchor_type`/`status`/field roles validated in code. Keys are `op_<slug>` (immutable); DELETE is soft archive — docs under archived keys stay resolvable. `GET/POST /manual-script-templates`, `PUT/DELETE /manual-script-templates/:key`, plus `GET /:campaignId/manual-script-merge-context` (Construction Variables panel). Run against `local` + `prd`.
- `seed:intelligence-discovery-signals` — seeds the 11 `INT_*` discovery signal codes into `mkt_signal_registry` as a new `INT` family. Idempotent update-in-place. Run against `local` + `prd`:
  ```powershell
  doppler run --config local -- pnpm seed:intelligence-discovery-signals
  doppler run --config prd --    pnpm seed:intelligence-discovery-signals
  ```
  Bump `SEED_VERSION_MARKER` in `src/scripts/seed-intelligence-discovery-signals.ts` to force label/description re-sync on already-registered rows.

Report pipeline notes:
- **Shared prompt directives (§6.1, §6.10)** live in `apps/api/src/services/intelligence/report-directives.ts` and are composed ONCE by `PromptComposerService.composeIntelligencePrompt` — never copy them into fragment bodies or seed transforms. Bump `REPORT_DIRECTIVES_VERSION` on text changes.
- **Report generation:** `SeedIntelligenceReportService.refreshReport(seedId)` builds from `SeedReportEvidenceService.buildSubstrateEvidence` (legacy seeds need no prompt output) and is idempotent via an `evidence_snapshot_hash` in `generated_from`. Triggered best-effort after anchor verification results, claim completion (both claim paths), and owner NAP corrections. Admin: `POST .../presence-seeds/:id/report/refresh`, `GET .../report/versions`, `GET .../report-pdf?version=`.
- **Report enrichment (audit fragments):** `SeedReportEvidenceService.getSeedReportContext(seedId, dims)` resolves the seed's linked campaign (`directory_seed_campaign_links` primary-first → `mkt_campaigns_list.discovery_context` → latest `business_analysis` + `category_identification` audits) plus `MarketContextLoader` enrichment. It feeds: `narrative` (Tier-C `public_narrative` + location `market_summary` / `metro_context` / `notable_areas` — the descriptive location fragments only; `market_gaps` / `metro_dynamics` / `city_profile` stay paid-side), `market_classification.category_profile_context`/`operational_signals`/`recommended_categories` (category enrichment + the audit's `candidate_categories` minus the resolved category), `source_summary.discovery_attribution` (`discovery_context.bronze_attribution`, queue `business_snapshot` fallback — each entry's `label` is resolved from `mkt_bronze_reason_catalog` so the report shows "Trade / import-only visibility", never a raw `reason_key`; renderers prefer `label`, then `basis`, then a humanized key), and `platform_presence` (BA `platforms` + cat-id `digital_footprint.platforms_found`; `unable_to_verify` is skipped — never an absence finding). `source_summary.source_types[].label` is a business-facing name via `sourceDisplayLabel` (`business_analysis_audit` → "Business presence review") — internal source keys never render raw. All narrative fields pass `vetReportText` (lintNarrativeText + peer-language guard) at build time — unsafe copy is dropped, never lint-blocking. Tone contract (enrichment seed V12): `context.market_summary` / `metro_context` / `category_summary` / `category_signals` are declared shopper-facing in the template TONE sections — existing enrichment rows keep pre-V12 register until the next enrichment run. The context rides `NormalizedEvidence.report_context` and is inside the `evidence_snapshot_hash` (`substrate_template: 'substrate-2'`), so a new audit/enrichment run produces a new report version. Free/paid split: the seed report carries context + presence only — `market_opportunities`/`gap_analysis`/`signal_checklist`/`recommended_services`/`competitive_weaknesses` stay behind `MarketIntelAccessService.canAccessFull` (paid or claimed-owner via `recordUnlock('owner_claim')`).
- **Public surface:** `GET /api/public/marketing/seed/:seedId/report` (+ `/preview`, `/report/pdf`); claimed-owner: `GET /api/customer/marketing/seed/:seedId/report` (verifies approved `directory_claim_requests` row).
- **§13.4:** `POST /api/admin/marketing-ops/:id/outreach` accepts `anchor_id` + `verification_results` — validated before the log row is created, then `attachAnchorToOutreachLog` back-fills snapshot + seed touch + NAP write-back + report refresh.
- **Connected-contact gate (§20.4):** `fact_confirmed`/`fact_corrected` only write NAP verification rows when `callResult` is a connected outcome; no-answer/voicemail/wrong-number cannot produce verified facts.

After applying migrations 271–272, run `pnpm prisma:generate` (or `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate`) so the Prisma Client picks up the new columns.

## Directory Presence Traffic Surface (Layer 1 + 2)

Spec: `docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md`

Page-view traffic for `/place/[slug]` (unclaimed seeds) and `/directory/[slug]` (claimed tenants) is captured by `StoreViewTracker` into `user_behavior_simple` (`entity_type='store'`, `page_type='directory_detail'`, `entity_id=<tenantId>`).

- **Layer 1 readout:** `apps/api/src/services/DirectoryPresenceTrafficService.ts` aggregates those rows, scoped to seeds via join on `directory_presence_seeds.tenant_id`. Admin routes (in `directory-presence-admin.ts`, mount `/api/admin/directory-presence`): `GET /traffic` (cross-seed rollup) and `GET /presence-seeds/:id/traffic` (per-seed). Both require `requirePlatformStaff`.
- **Admin page:** `/settings/admin/directory/traffic` (`apps/web/src/app/(platform)/settings/admin/directory/traffic/page.tsx`). Card on `/settings/admin` ("Directory Traffic"), plus Directory Panel and admin-nav entries.
- **Layer 2 tagging:** `StoreViewTracker` accepts `listingOrigin` + `surface` props and stamps them into `context`. **Canonical vocabulary:**
  - `listing_origin` = `directory_seed` (`/place` layouts) | `claimed` (the four `/directory` layouts) — mirrors `directory_listings_list.listing_origin`.
  - `surface` = `place` (`/place`) | `directory` (`/directory`) — matches the `CategoryBrowseTracker` / `LocationBrowseTracker` vocabulary already in `context`.

  **Do NOT use the sprint spec's `surface: 'directory_seed' | 'directory_claimed'`** — it collides with the pre-existing ecosystem `surface` axis written into the same `user_behavior_simple.context` JSON. The readout exposes an optional `surface` filter (bound param) and always reports a `surfaceBreakdown` (untagged historical rows appear as `untagged`).
- **Migration `294_directory_presence_surface_vocabulary.sql`** — rewrites any rows written under the old spec vocabulary (`surface` `directory_seed`→`place`, `directory_claimed`→`directory`; `listing_origin` `directory_claimed`→`claimed`). Idempotent. Applied manually to `local` + `prd`.
- **Migration `295_directory_presence_events_surface_scope.sql`** — makes `directory_presence_events` surface-scoped: `tenant_id`/`listing_id` become NULLABLE and `surface` / `entity_ref` / `detail` are added (+ `idx_dpe_surface_created`). Entry events carry tenant+listing and `surface` ∈ `place_entry|directory_entry`; shelf events carry neither and `surface` ∈ `place_category|place_city|directory_category|directory_location|directory_store_type|directory_home`. Safe (table was empty). Idempotent.

**Directory surface taxonomy (`user_behavior_simple` — single source of truth):**

| Surface | Route | Tracker | `page_type` | `entity_type` | `entity_id` | `context.surface` |
|---|---|---|---|---|---|---|
| Seed entry | `/place/[slug]` | `StoreViewTracker` | `directory_detail` | `store` | `tenantId` | `place` |
| Claimed entry | `/directory/[slug]` | `StoreViewTracker` | `directory_detail` | `store` | `tenantId` | `directory` |
| Seed category shelf | `/place/category/[slug]` | `CategoryBrowseTracker` | `directory_category` | `category` | `place/category/<slug>` | `place` |
| Claimed category shelf | `/directory/categories/[slug]` | `CategoryBrowseTracker` | `directory_category` | `category` | `directory/categories/<slug>` | `directory` |
| Seed city shelf | `/place/city/[citySlug]` | `LocationBrowseTracker` | `directory_location` | `location` | `place/city/<slug>` | `place` |
| Claimed location shelf | `/directory/location/[location]` | `LocationBrowseTracker` | `directory_location` | `location` | `directory/location/<slug>` | `directory` |
| Store-type shelf | `/directory/stores/[storeTypeSlug]` | `StoreTypeViewClient` | `directory_store_type` | `category` | `<storeTypeSlug>` | `directory` |
| Directory home | `/directory` | `DirectoryClient` | `directory_home` | — | — | — |
| Directory search | `/directory` | `DirectoryClient` | `search_results` | `search` | — | — |

Rules:
- `context.surface` is **`place | directory`** (the ecosystem axis). Never `directory_seed` / `directory_claimed`.
- `context.listing_origin` is **`directory_seed | claimed`** — mirrors `directory_listings_list.listing_origin` (column default `claimed`).
- `entity_id` is a raw id for entries and a path for shelves — do not assume it is a tenant id.
- Entry CTA/engagement events live in `directory_presence_events` (Layer 3). **QR scans live in `qr_scan_events`** (redirect tracking is authoritative) — do not emit `qr_scanned` into `directory_presence_events`; that event type is reserved for forward compatibility only.
- The `Directory Traffic` readout shows entry rows (seed-joined) plus a **Shelf Traffic** table (`directory_category` / `directory_location` / `directory_store_type` / `directory_home`). Shelf rows are not seed-scoped, so the entry filters do not apply to them.
- **Shelf→entry attribution:** shelf cards append `?shelf=<surface>/<type>/<slug>` (e.g. `place/category/indian-grocery`, `directory/location/madison-wi`) to their entry links. `StoreViewTracker` reads the param and stamps `context.referrer_shelf` on the Layer 1 entry view; the readout exposes it as `shelfReferrals` (the **Referring Shelves** section). The `shelfRef` prop is threaded through `StoreCard` → `StoreList` → `DirectoryGrid`/`DirectoryList` and through `UnifiedStoreCard`; all are optional and default to `undefined` (no behavior change elsewhere). Attribution only applies to shelf→entry navigation captured after this shipped.
- **Entry source attribution:** `StoreViewTracker` also stamps `context.entry_source` from `?utm_source=` (verbatim) / `?source=` / `'shelf'` when `?shelf=` is present. Precedence: `utm_source` → `source` → `shelf` → absent. Known `?source=` values:
  - `qr` — a QR code printed for a listing encodes that listing's URL with `?source=qr`; the entry view is attributed to QR while the scan itself stays authoritative in `qr_scan_events`.
  - `related` (`RelatedStores`), `recent` (`LastViewed`), `recommendation` (`StoreTypeRecommendations` + the directory-home "Trending Nearby" list), `promoted` (`PromotedStoresCarousel`).
  - `search` — `/place/search` result cards.
  - `storefront` — storefront/product → directory links (`StorefrontHeader`, `StorefrontFooter`, `StorefrontClientWrapper`, `ProductHeaderSection`, `StorefrontActions`, `ProductNavigation`, `BackToInventoryButton`, `SmartProductCard`, `LocationAvailabilitySection`).

  These are **not shelf browse** — they emit no `shelf_viewed`/`listing_clicked` and do not affect shelf CTR; they only contribute an entry **source**. `UnifiedStoreCard` takes `sourceRef` for this (`RelatedStores`/`LastViewed` both render through it). The readout exposes `entrySources` (the **Entry Sources** section); organic/direct views are unattributed and not listed.
  - Caveat: param-based attribution is sticky — a reload/refresh keeps the query string, so the same view can be re-counted under the same source. Treat these as directional, not exact.
  - Known pre-existing bug (not fixed): `components/directory/DirectoryMap.tsx` writes `<a href="/directory/${listing.slug}">` as a **plain string** (not a template literal), so that legacy map renders a literal `${listing.slug}` URL. The live map is `DirectoryMapGoogle`.
- **Shelf engagement (Layer 3, migration 295):** shelves now emit engagement events too — `shelf_viewed`, `listing_clicked`, `filter_applied`, plus `session_heartbeat`/`session_end` for dwell. Capture is via `useDirectoryShelfTracking` (`apps/web/src/hooks/`), wired at the two existing browse trackers (`CategoryBrowseTracker` → `place_category`/`directory_category`; `LocationBrowseTracker` → `place_city`/`directory_location`) and directly in `StoreTypeViewClient` (`directory_store_type`). `filter_applied` fires from a `filterSignature` prop diff (serialized filter/sort state). `listing_clicked` is **self-reported by the cards** via `reportShelfListingClick(shelfRef)` — no callback plumbing. Card coverage (all shelf renderers now report):
  - `components/stores/StoreCard` (via `StoreList` → `DirectoryGrid`) and `components/directory/UnifiedStoreCard` (via `DirectoryList`) — directory category / location / store-type shelves.
  - `components/directory/redesign/StoreCardV2` (via `StoreResults`, `shelfRef="directory/home"`) — **directory home**, all three layout variants.
  - Inline `PlaceCard` in `PlaceCategoryClient` and the inline cards in `PlaceCityClient` — place category / city shelves.
  - `DirectoryMapGoogle` InfoWindow `?shelf=` (prop `shelfRef`) — map view on category / store-type / home.
  - `shelfRefToSurface` accepts a slug-less `directory/home` (ref falls back to the sentinel `home`).
  - **Instrumented as entry SOURCES, not shelves:** `RelatedStores` (`?source=related`), `LastViewed` (`?source=recent`), `StoreTypeRecommendations` (`?source=recommendation`) — they load entry pages but are cross-sell/recency, so they must not pollute shelf CTR. `PromotedStoresCarousel` uses the separate `DirectoryPromotionService` impression/click pipeline (featured-placement billing), which is NOT wired to the traffic readout.
  - **Dead code (no importers):** `components/directory/UniversalDirectoryGrid` + `components/stores/UniversalStoreCard`, and the third `components/directory/StoreCard.tsx`.
  - Public route: `POST /api/public/directory/surfaces/:surface/:ref/events` + `/events/batch` — surface enum-validated, ref slug-validated, rate-limited, no DB lookup.
  - Readout: `GET /api/admin/directory-presence/surface-engagement` → `getSurfaceEngagement` → the **Surface Engagement** table (views / sessions / avg dwell / click-throughs / CTR / filters / CTA clicks) spanning entries **and** shelves in one grid.
  - Entry events stamp `surface` server-side (derived from `listing_origin`), so no client change was needed for entry surfaces.
- **Layer 3 serves BOTH entry surfaces.** `POST /api/public/directory/places/:slug/events` resolves published listings of either origin (`directory_seed` **or** `claimed`), so `/directory/[slug]` (claimed) fires events too — `storefront_clicked` (Visit Storefront) and `call_clicked` (phone) in addition to the automatic view/heartbeat/session_end. The four `/directory` layouts call `useDirectoryPresenceTracking` from `@/hooks/useDirectoryPresenceTracking` (shared with `/place`).
- **Two distinct claim funnels — do not conflate:**
  - `DirectoryPresenceAnalyticsService.getClaimFunnel` = **on-page CTA conversion** (`listing_viewed` → `claim_clicked` → accepted), per-seed/aggregate. Shown on the Directory Traffic page + seed detail panel.
  - `SeedFunnelAnalyticsService.getCohortFunnel` = **GTM/cohort funnel** (seeds → contactable → invited → claimed, per-channel invite-scan + report-scan rates, benchmark gates), campaign-scoped. Shown on `/settings/admin/directory/funnel`.
  - They share only the `claims accepted` terminus. Invite/QR-driven conversion belongs to the cohort funnel; on-page CTA conversion belongs here.
- **Migration `292_backfill_directory_seed_event_context.sql`** — tags historical `directory_detail` rows for seed tenants with `listing_origin`/`surface = 'directory_seed'` (idempotent: only rows where `context->>'surface' IS NULL`) and adds the partial expression index `idx_ubs_directory_detail_surface`. Applied manually to `local` + `prd`; no `schema.prisma` change, so no `prisma generate` needed for it.
- **Layer 3 (engagement):** `directory_presence_events` (migration `293_directory_presence_events.sql` — slug-scoped, mirrors `mkt_gallery_events`; migration `295` makes it surface-scoped). `DirectoryPresenceAnalyticsService` tracks `listing_viewed | shelf_viewed | listing_clicked | filter_applied | claim_clicked | call_clicked | directions_clicked | storefront_clicked | qr_scanned | session_heartbeat | session_end` (fire-and-forget; 60/min/IP limiter) and exposes `getListingEngagement`, `getRecentEvents`, `getClaimFunnel`, `getDashboardEngagement`, `getSurfaceEngagement`, plus seed-scoped `getSeedEngagement` / `getSeedClaimFunnel`. **Uses raw SQL (`$executeRawUnsafe` / `$queryRawUnsafe`) instead of a Prisma model** — deliberately avoids a `prisma db pull` + client regeneration dependency for the events table.
  - Public capture: `POST /api/public/directory/places/:slug/events` + `/events/batch` (slug-gated to published listings of either origin — `directory_seed` or `claimed` — rate-limited, always 200 on a resolved slug).
  - Admin: `GET /api/admin/directory-presence/engagement`, `GET /presence-seeds/:id/engagement`, `GET /presence-seeds/:id/funnel` (all `requirePlatformStaff`).
  - Web: `DirectoryPresencePublicService` (`ttl: 0`) + `useDirectoryPresenceTracking` (`apps/web/src/hooks/useDirectoryPresenceTracking.ts` — shared by `/place` and `/directory`). Wired into `PlaceEntryEditorialLayout` (seed: `claim_clicked` on both claim CTAs) and all four `/directory` entry layouts (claimed: `storefront_clicked` on Visit Storefront, `call_clicked` via the optional `onPhoneClick` prop on `ContactInformationCollapsible`). `PlaceEntryEditorialLayout` requires a `slug` prop (passed by `PlacePageClient` and the retail preview page).
  - UI: `TrafficEngagementPanel` mounted on the seed detail page (funnel + counts + recent feed); the Directory Traffic page shows Layer 3 summary cards, an aggregate claim funnel, and a Claim CTR column.
  - **`qr_scanned` is schema/Zod-only** — QR codes are images with no click target (spec §14.6). `directions_clicked` has no dedicated link yet (no directions CTA exists).

**Windows `prisma generate` EPERM:** regenerating while a dev watcher (`pnpm dev:local-vercel` / `tsx watch`) is running fails with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`. Stop the node/dev processes first, then re-run `pnpm prisma generate`.

## Identity Packet — Operator Evidence (migration 297)

Campaign detail → **Identity** tab (`IdentityPacketCard`, `apps/web/src/components/marketing-ops/IdentityPacketCard.tsx`).

The packet (`IdentityPacketService.buildForCampaign`, `GET /api/admin/directory-presence/presence-seeds/identity-packet?campaignId=`) is a **derived view**: every ledger row comes from the latest non-stub `business_analysis` audit (platform blocks, owner website, `audit_metadata.identity_corroboration_sources`), scan-audit attribute chips, or `directory_field_provenance`. A business with no audit therefore renders an empty ledger and **0 on both axes** — the normal state right after a prospect call, and the reason the tab reads "Blocked".

- **Write path:** `apps/api/src/services/IdentityEvidenceService.ts` (`mkt_identity_evidence`, migration 297). `POST /presence-seeds/identity-evidence` + `DELETE /presence-seeds/identity-evidence/:id` (`requirePlatformStaff`, declared before `/presence-seeds/:id`). Both return the **re-assembled packet** so the tab re-renders scores without a second round trip.
- **Scope = business prospect, not campaign.** Rows are stamped with `business_prospect_id` when the campaign has one, else `campaign_id`; reads union the prospect group, so one verification call covers every sibling archetype. The UI tags rows captured on a sibling as `shared from sibling`.
- **Scoring:** manual rows are pushed into `assembleIdentityPacket` as ordinary `IdentitySourceRef`s with `agrees: true` (the operator asserts corroboration — there is no competing value to compare). `evidenceState`/`tier` are validated; an omitted tier falls back to `inferSourceTier`.
- **Echo discount is the subtle part:** the independence group is derived from the source **name**, and `sourceGroupSlug` maps platform names onto the audit's own platform keys (`Google Business Profile` → `google`, not `google-business-profile`). Without that mapping a hand-entered GBP row would count as a second independent corroboration of the same platform. Do not "simplify" `sourceGroupSlug` back to a plain slug.
- **`inferSourceTier` lives in `directory/identityScoring.ts`** (re-exported from `IdentityPacketService` for existing callers). It moved there because `IdentityEvidenceService` needs it and importing it from the packet service would form a cycle (packet → evidence → packet).
- **Owner identity rides on the same row** (`owner_name`/`owner_phone`/`owner_email`). It is **not** an identity-scoring field — it is the source for owner outreach, captured once per prospect and reused: the packet returns the newest `ownerContact`, and `IdentityEvidenceService.reuseOwnerContact` back-fills the prospect group's campaign records (`owner_names` / `phones` / `email` / `phone`) **fill-if-empty, never overwriting**. That is the surface outreach tooling already reads (opener merge context, campaign form, sibling creation copy in `BusinessProspectService.createSiblingCampaign`).
- **Provenance mirror:** when the campaign has a linked `primary` seed, corroborated fields are mirrored into `directory_field_provenance` with `ON CONFLICT (seed_id, field_key) DO NOTHING` (never clobbers audit/owner evidence) and `show_on_public = false` (publishing stays deliberate). Mirrored rows carry `notes = EVIDENCE_PROVENANCE_NOTE`, which is what makes delete able to retract **exactly** what it wrote — an upsert by another writer changes `source_name`, so the retraction skips it.
- **Vocabulary single source:** `IDENTITY_SOURCE_TIERS` / `IDENTITY_EVIDENCE_STATES` / `IDENTITY_FIELD_KEYS` + `is*` guards in `directory/identityScoring.ts` drive route Zod validation, the CHECK constraints, and the web labels (`apps/web/src/lib/identity-evidence.ts` — labels, presets, `todayISODate`). Adding a member means updating the array **and** the CHECK in migration 297 (drop + re-add inside the guarded `DO` block).
- **Migration 297 is self-healing:** the `CREATE TABLE IF NOT EXISTS` is followed by `ADD COLUMN IF NOT EXISTS` for every column and guarded `DO` blocks for each constraint, so re-running the file repairs a table created by an earlier revision of it. Run it against `local` + `prd`, then `pnpm prisma:generate` (the model is in `schema.prisma`; the service itself uses raw SQL).
- **Migration 298 repairs the content guard** — run it too. Two defects in 297's: (a) the first revision created `chk_identity_evidence_corroborates_nonempty` with **no owner-contact escape**, which rejects the supported owner-contact-only row, and 297's guarded `DO` block can never remove it (it is a different constraint name), so 298 drops it explicitly; (b) the replacement `chk_identity_evidence_content` tested `array_length(corroborates, 1) >= 1`, but Postgres returns **NULL** for an empty array, `NULL >= 1` is NULL, and **a NULL CHECK passes** — the guard never bit. 298 re-adds it as `COALESCE(array_length(corroborates, 1), 0) >= 1`. General rule: never write `array_length(...) >= n` in a CHECK without `COALESCE`.
- **Raw-query param casting:** Prisma binds a JS **string** parameter as `text`, and `text` → `date`/`jsonb`/`text[]` are **not** implicit casts in Postgres — the insert fails with `42804` (`column "x" is of type date but expression is of type text`). Every placeholder targeting a non-text column needs an explicit cast in the SQL: `${value}::date`, `${json}::jsonb`, `${array}::text[]`. Mocked unit tests cannot catch this (it is a type-binding requirement, not a value problem), so a new table's write path must be exercised against a real DB once — a throwaway script that creates a row and deletes it is enough, and it also confirms the CHECK constraints actually accept the writer's values.
- **Tests:** `apps/api/src/services/__tests__/IdentityEvidenceService.test.ts` (scope, tier inference, empty-payload rejection, owner back-fill, mirror + retraction, and the CHECK **constraint-parity** suite that parses the effective value sets out of `database/migrations`) and the `manualEvidence` cases in `IdentityPacketService.test.ts` (unaudited zero-state → scored, echo discount, owner contact, retraction).
- **Persisted "Wait" (migration 300):** `mkt_campaigns_list.seed_decision` / `seed_decision_at` / `seed_decision_by` (all nullable, additive) store the operator's seed decision so the Identity tab's Wait survives reloads. `POST /presence-seeds/identity-packet/decision` (`{campaignId, decision: 'wait'|'clear'}`) writes via `IdentityPacketService.setSeedDecision` and returns the rebuilt packet; the packet read is a **non-fatal side query** (`$queryRaw` in try/catch) so an unmigrated DB renders `seedDecision: null` instead of a 500. Advisory only — Wait never disables Push. Apply to `local` + `prd`.
- **Verification → seed back-fill:** `MarketingCampaignService.resolveCampaignVerification` also mirrors connected-call verified facts into the **primary-linked seed** (`directory_seed_campaign_links.link_role='primary'`): `directory_seed_nap_verifications` rows (`owner_corrected` FALSE for confirms / TRUE for corrections, split against current `directory_field_provenance`), `nap_verified_at` / `nap_owner_corrected` stamps, provenance upsert (`owner_confirmed`/`owner_corrected`), `directory_listings_list` sync for corrected core fields (tenant-scoped, like the anchor path), and a best-effort `SeedIntelligenceReportService.refreshReport`. The whole block is non-fatal and gated on `outcome ∉ {unreachable, wrong_business}` — the §20.4 connected-contact rule.
- **Verify record modal prefill contract (campaign mode):** `ResolveVerificationModal` initializes from `entry.business_snapshot`, but campaign mode has no snapshot — `IdentityPacketCard` synthesizes one from the packet (`verificationEntry`). The packet therefore carries campaign columns that exist solely for this prefill (`addressCity/State/Zip`, `businessHours`, `email`, `socialProfiles`, `directoryProfiles`, `ownerContact`). This is load-bearing, not convenience: `resolveCampaignVerification` writes `socialProfiles`/`directoryProfiles` as **wholesale column replaces**, so any stored row the modal didn't render is silently deleted on the next save. When adding a modal field that maps to a campaign column, thread it through `buildForCampaign`'s select → `AssembleInput.campaign` → the packet → `verificationEntry.business_snapshot`.

**Outreach Prep worksheet prefill (identity → worksheet).** The Outreach Prep tab's worksheet (`mkt_outreach_intelligence`, `OutreachIntelligenceService`) is a *curated, business-published-only* artifact whose banner forbids personal phone numbers and guessing email formats, and whose API rejects `confirmed` without a source citation (Zod `superRefine`). The identity ledger is raw evidence. They meet through a **prefill, never an auto-write**: `GET /:campaignId/outreach-intelligence/identity-prefill` (`mapEvidenceToWorksheetPrefill`, pure, exported next to `resolveSalutation`) returns suggestions the operator reviews before hitting the existing Save — that keeps the human gate and the primary-sibling 409 rule intact.

- Maps **owner/contact name** and **business-published email**, each from the NEWEST usable ledger row carrying it, with citation `"{source_name} ({accessed_at})"` and confidence from `confidenceForEvidence` (owner-confirmed/owner-corrected or `first_party`/`authoritative` → `confirmed`; aggregator → `inferred_low_risk`).
- **Derives `preferred_contact_channel`** (email beats phone) and marks it `inferred_low_risk` with a `"Derived from …"` citation — a channel is our inference, not a published fact.
- **Never maps `owner_phone`.** The worksheet has no phone field by design; the owner's cell belongs on the campaign record (`phones`/`phone`), which the evidence write already back-fills. Team signal stays entirely operator-entered (it is a judgement read from published About copy).
- Rows in `UNUSABLE_EVIDENCE_STATES` (`conflicting`, `owner_disputed`, `not_checked`, `not_found_during_discovery`) may not supply a value — the newest *usable* row wins. Prefilled `unavailable` fields must never overwrite an existing operator entry (the tab applies a suggestion only when its confidence ≠ `unavailable`).
- Invariants the mapper must preserve (unit-tested): `confirmed` ⇒ non-empty citation, and `unavailable` ⇒ `value`/`source` both null — otherwise the operator cannot save what the prefill produced.

## WhatsApp Channel Integration

Spec: `docs/LocalBiz/WHATSAPP_CHANNEL_INTEGRATION_SPEC.md`

- `275_whatsapp_channels.sql` — creates `whatsapp_channels` (platform-owned WABA channel registry; `wac-{tenantKey}-{nanoid}` ids, `access_token_encrypted`, CHECK on `status`) + `bot_messages.wa_message_id` with a partial unique dedupe index (`WHERE wa_message_id IS NOT NULL`). Applied to staging + prod.
- `286_directory_entry_whatsapp.sql` — seeds `directory_entry_whatsapp_on` + `directory_entry_whatsapp_enabled` feature keys (granted to `presence` + `directory_presence` tiers), adds `whatsapp_display`/`whatsapp_number` columns to `tenant_directory_entry_settings`, and syncs `chk_whatsapp_channels_status` to the app enum (`active|inactive|disabled|revoked` — 275 shipped a stale 2-value set). Run against `local` + `prd`, then `prisma db pull && pnpm prisma generate`.
- Shared pipeline: `services/bot/BotTurnPipeline.ts` (`preprocessTurn`/`completeTurn`/`persistAssistantTurn`) — one engine, widget + WhatsApp transports. Widget contract pinned by `src/tests/bot-public-pipeline.test.ts` (13 tests) — must stay green.
- Meta webhooks mount in `bootstrap.ts` §6 pre-middleware (path-scoped `express.json({verify})` raw-body capture); `routeRegistry`'s `preMiddleware` flag is NOT a true pre-parser mount. Signature verification fails closed on missing secret/signature/rawBody.
- WhatsApp session ids are `wa-{phone_number_id}-{wa_id}`; multiple rows per session are intentional (archive + recreate). Do NOT add a unique index on `bot_conversations.session_id`.
- `OAUTH_ENCRYPTION_KEY` assertion is WhatsApp-scoped (`services/whatsapp/crypto.ts`) — Meta/Google OAuth consumers keep the existing random-fallback behavior. Do not globalize.
- `directory_entry_whatsapp_on` is an explicit-key exception to flexible-grants: `directory_entry_flexible` does NOT unlock it (decision D5). CTA number provenance: merchant `whatsapp_number` pref → active channel `display_phone_number`; never the NAP phone; never a Meta test number.

## Architecture

- **Campaign structural-duplicate guardrail:** `MarketingCampaignService.createCampaign` blocks creation of a second *active* campaign with the same structural signature. Re-run the existing campaign to produce a versioned output instead. Inactive stages (`lost`, `dead`, `closed`, `resolved_and_closed`) do NOT block — a fresh campaign can be created after the prior one was killed. The check is keyed on structural attributes (NOT campaign id):
  - **intelligence scope** → `scope + category + intelligence_campaign_kind + intelligence_focus + intelligence_platform + city + state` (null/empty/`all` platform + null city/state = nationwide; the "Indian Grocery / Establishment / Gold_standards / All Platforms" case)
  - **business scope** → `scope + campaign_category + business_name + category + city + state`
  - **category / city scope** → `scope + campaign_category + category + city + state`
  - Implementation: `findDuplicateCampaign` in `apps/api/src/services/MarketingCampaignService.ts`; throws `ConflictError` (409 `conflict`) with the existing campaign's id + stage. Best-effort on lookup failure (logs + allows create). Tests: `apps/api/src/services/__tests__/marketingCampaign.recovery.test.ts` → "createCampaign structural-duplicate guardrail" (7 tests).

- **Backend:** Node.js + Express + TypeScript in `apps/api`
  - Routes in `apps/api/src/routes/` (registered via `routeRegistry.ts`)
  - Services in `apps/api/src/services/`
  - Prisma ORM; schema at `apps/api/prisma/schema.prisma`
  - Migrations in `database/migrations/` (numbered, e.g. `161_*.sql`)
  - `RequestCtx` type lives in `apps/api/src/context.ts` (NOT `middleware/auth.ts`)
  - Config via `unifiedConfig` from `apps/api/src/config/unifiedConfig.ts` (NOT `config.ts`)
  - `audit()` helper in `apps/api/src/audit.ts` accepts optional `actorType: 'user' | 'system' | 'integration' | 'customer'`
- **Frontend:** Next.js (App Router) + TypeScript in `apps/web`
  - Pages in `apps/web/src/app/`
  - Services in `apps/web/src/services/` (extend `PublicApiSingleton` or `CustomerApiSingleton`)
  - Customer auth context: `apps/web/src/contexts/CustomerAuthContext.tsx`
  - Customer auth service: `apps/web/src/services/CustomerAuthService.ts` (singleton; `applyExternalAuth()` persists tokens from external auth flows)

## Conventions

- Platform sentinel: use `'platform'` (the `tenants.id = 'platform'` row). Do NOT use `'_platform_'`.
- `PLATFORM_SCOPE` constant: `apps/api/src/lib/platform-scope.ts`
- Marketing Ops public routes mount at `/api` (so routes are `/api/public/marketing/*`)
- Marketing Ops admin routes mount at `/api/admin/marketing-ops`
- Customer auth routes mount at `/api/customer-auth`
- Frontend public services extend `PublicApiSingleton` with `ttl: 0` for no caching
- Double-wrap response contract: unwrap with `result.data?.data ?? result.data`
- Mantine UI is used on marketing public pages (`@mantine/core`); customer account pages use Tailwind + `@/components/ui/*`
- Tabler icons: use `IconLogin` (not `IconLogIn`)
- **Tracked link + QR variables:** never hand-build a claim/report URL in a script, pitch, or merge context. Resolve `{{report_url}}` / `{{claim_url}}` / `{{claim_short_url}}` / `{{qr_url_*}}` through `apps/api/src/services/outreach-openers/outreach-link-vars.ts` (`buildOutreachLinkVars`, `resolveClaimUrlForCampaign`). Canonical claim path is `/place/claim/{token}` (`/directory/claim/{token}` is a legacy web redirect only). The kit services are imported lazily there because `ClaimInviteQrKitService` evaluates `unifiedConfig.get()` at module load.

## Marketing Ops Customer Portal (Phase 1)

Spec: `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`

Key files:
- `apps/api/src/services/MarketingCustomerService.ts` — claim service (`claimAllEligible`, `issueClaimToken`, `getClaimTokenSummary`, `consumeClaimToken`, `registrationClaimSweep`)
- `apps/api/src/services/marketing/MarketingReceiptPdfService.ts` — shared receipt PDF generator
- `apps/api/src/services/marketing/MarketingReceiptEmailService.ts` — receipt + claim invite emails
- `apps/api/src/routes/marketing-ops-public.ts` — public pay + claim endpoints (§6.1)
- `apps/api/src/routes/marketing-ops.ts` — admin pay-link + send-claim-invite endpoints (§8.1, §8.2)
- `apps/web/src/services/MarketingClaimPublicService.ts` — frontend claim service
- `apps/web/src/app/marketing/claim/` — public claim pages (Path B)
- `apps/web/src/app/marketing/pay/PayPageClient.tsx` — pay page with email field + account CTA

Three claim paths, one claim service:
- **Path A** (at payment): pay page success screen → register/login → `claimViaPayRegister` / `claimViaPayLogin`
- **Path B** (email awareness): `/marketing/claim` → email → claim link → `/marketing/claim/[token]` → register/login
- **Path C** (registration sweep): `CustomerAuthService.verifyEmail` / `oauthLogin` → `registrationClaimSweep` (fire-and-forget)

## Marketing Ops Customer Portal (Phase 2 — Authenticated Portal)

Context signals (§4.2):
- `CustomerAuthService.computeContexts(customerId)` returns `{ storefront, platform }` booleans
- `contexts` field on `/me` and all auth responses (login, register, oauth, claim)
- Frontend `CustomerAuthContext` exposes `contexts` and refreshes after claim/purchase events

Portal backend (§6.2, §6.4, §6.5, §7.3, §7.4, §7.7, §7.9):
- `apps/api/src/routes/marketing-customer.ts` — authenticated portal routes at `/api/customer/marketing/*`
  - All routes require customer JWT + `requirePlatformContext` gate (403 `context_required`)
  - Endpoints: overview, campaigns, purchases, receipts (view + PDF), branding, support tickets, alerts
- `apps/api/src/services/MarketingCustomerProjection.ts` — customer-safe projection:
  - `projectCampaign` / `projectCampaigns` — whitelists fields, hides internal stages
  - `mapCustomerStatus` — maps internal stages to customer-legible statuses (§7.3)
  - `buildPortalOverview` — aggregates total spent, active engagements, deliverables ready
  - `buildReceiptViewModel` — receipt DTO with QR destination + branding resolution (§7.4)

Portal frontend (§7.2, §7.4, §7.7, §7.9):
- `apps/web/src/services/MarketingCustomerService.ts` — extends `CustomerApiSingleton`, wraps all portal endpoints
- `apps/web/src/app/account/marketing/` — portal pages:
  - `page.tsx` — overview (summary cards + campaigns + recent purchases)
  - `purchases/page.tsx` — full payment history table
  - `campaigns/[id]/page.tsx` — campaign detail with progress timeline + deliverables + receipts
  - `receipts/[revenueId]/page.tsx` — HTML receipt view with QR
  - `settings/page.tsx` — branding settings with live QR preview
  - `support/page.tsx` + `support/[ticketId]/page.tsx` — support tickets
  - `alerts/page.tsx` — platform alerts with mark-read/dismiss
- `apps/web/src/components/customer/CustomerSidebar.tsx` — signal-gated nav groups:
  - "Shopping" group (storefront context)
  - "My Services" group (platform context)
  - "Account" group (context-agnostic, §7.8)
  - Unread alert badge on Notifications (refreshes every 60s when platform context active)

Migrations:
- `162_mkt_customer_branding.sql` — per-customer branding (logo, asset URL, brand color)
- `163_crm_tickets_campaign_id.sql` — additive `campaign_id` on `crm_support_tickets`
- `164_crm_customer_alert_states.sql` — per-customer alert read/dismiss state

## Marketing Ops Customer Portal (Phase 3 — Card on File + Repeat Purchase)

Saved-card plumbing (§6.3):
- `CustomerPaymentMethodsService.savePaymentMethodFromIntent(customerId, pi)` — attaches a PI's payment_method to the customer's platform-scoped Stripe customer
- `CustomerPaymentMethodsService.getOrCreateStripeCustomer` is now public (was private)
- `SubscriptionBillingService.createOneTimePaymentIntent` accepts `setupFutureUsage` + `customer` params
- `SubscriptionBillingService.stripeInstance` getter (public accessor for the private Stripe instance)
- `ConversionSource` type extended with `'portal_checkout'`
- Pay page (`/marketing/pay`) passes `saveCard` → `setup_future_usage: 'off_session'` on the PI; post-confirmation, if authenticated + opted in, calls `savePaymentMethodFromIntent`

Portal checkout (§7.6, §7.5):
- `POST /api/customer/marketing/checkout` — repeat-purchase checkout:
  - Off-session charge with `useSavedMethodId` (customer + payment_method + off_session: true)
  - SCA failure → 402 `authentication_required` with clientSecret for frontend fallback
  - Interactive checkout → PI with `setup_future_usage: 'off_session'` + platform Stripe customer
  - Coupon redemption: `savedCouponId` (wallet) or `couponCode` (ad-hoc) → validates + applies discount → flips wallet row to `redeemed`
- `POST /api/customer/marketing/checkout/confirm` — confirms interactive checkout, marks campaign paid, flips coupon, sends receipt email
- `GET /api/customer/marketing/coupons/applicable?campaignId=` — wallet coupons valid for the campaign's price (§7.5)
- `POST /api/customer/marketing/payment-methods/save-from-payment` — attaches PI's PM to platform scope

Frontend checkout:
- `apps/web/src/app/account/marketing/campaigns/[id]/checkout/page.tsx` — portal checkout page:
  - Saved card selection (platform-scope payment methods)
  - Applicable coupon list (one-click apply) + ad-hoc coupon code entry
  - Off-session charge for saved cards; Stripe Elements fallback for new cards
  - Order summary with discount + total
- Campaign detail page gains "Purchase again / Upgrade" button (§7.6)
- `MarketingCustomerService` (frontend) gains `savePaymentMethodFromIntent`, `getApplicableCoupons`, `createCheckout`, `confirmCheckout`
- `MarketingPayPublicService.createCheckout` accepts `saveCard` param
- Pay page shows "Save this card" checkbox when customer is authenticated

## Marketing Ops Customer Portal — Tests (§11)

- `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` (24 tests):
  - Status mapper: every internal stage maps to a customer status or is hidden
  - Hidden stages (seek, seed, preview_built, shown, lost, dead) return null
  - Active subscription overrides stage
  - `projectCampaign` whitelists fields (no notes, pain_score, estimated_*, assigned_to)
  - `projectCampaigns` filters out hidden-stage campaigns
- `apps/api/src/tests/marketing-customer-routes.test.ts` (7 tests):
  - JWT required: no auth → 401, invalid token → 401
  - Context gating: storefront-only → 403 context_required, zero-context → 403, platform → 200
  - Cross-customer isolation: customer A gets 404 on customer B's campaign + receipt

## Marketing Ops Customer Portal — Alert Composer (§8.3)

Operator composer for sending alerts to marketing customers (platform-context only).

Backend endpoints (in `marketing-ops.ts`):
- `GET  /api/admin/marketing-ops/alerts/customers` — list marketing customers for recipient picker
- `GET  /api/admin/marketing-ops/alerts/recipient-count` — pre-send recipient estimate
- `POST /api/admin/marketing-ops/alerts` — create targeted / broadcast / campaign-scoped alert
- `GET  /api/admin/marketing-ops/alerts` — sent alerts history with read/dismissed counts

Frontend:
- `/settings/admin/crm/broadcast/marketing` — dedicated marketing broadcast page (mirrors tenant broadcast)
- Campaign detail "Customer Account" section — "Send Alert" link + "Send Claim Invite" button
- `MarketingOpsService` gains `listMarketingAlertCustomers`, `getAlertRecipientCount`, `createMarketingAlert`, `listMarketingAlerts`, `sendClaimInvite`

Alert targeting (stored in `crm_alerts.metadata`):
- `mkt_broadcast` — no metadata, visible to all platform-context customers
- `mkt_direct` — `metadata.customer_id`, visible to one customer
- `mkt_campaign` — `metadata.campaign_id`, visible to customers who claimed that campaign

All alerts use `tenant_id = PLATFORM_SCOPE`. Customer-side reader is in `marketing-customer.ts` (`GET /alerts`, `POST /alerts/:id/read`, etc.).

## Intake Portal Generalization (Registry-Driven Intake Forms)

Spec: `docs/LocalBiz/INTAKE_PORTAL_GENERALIZATION_PLAN.md`

Generalizes the token-gated "owner data collection" framework to support multiple intake types (dispute, profile_repair, gbp_optimization, review_response_setup, ...) via a registry-driven architecture.

### Schema (Migration 173)
- `mkt_intake_definitions` table — declarative `form_schema`, `field_mappings`, `owner_copy`, `niche_overrides` in JSONB
- `mkt_dispute_intake` — `campaign_id` UNIQUE relaxed to `@@unique([campaign_id, intake_kind])` (1:N relation)
- FK from `mkt_dispute_intake.intake_kind` → `mkt_intake_definitions.intake_kind`

### Backend Services
- `apps/api/src/services/intake/IntakeDefinitionService.ts` — loads + caches definitions, builds dynamic Zod schemas from `form_schema`, resolves niche overrides, runs custom validators
- `apps/api/src/services/intake/writeBehindAdapters.ts` — maps evidence_payload to existing backend domain models (business_hours_list, review_response_settings, etc.)
- `apps/api/src/services/DisputeIntakeService.ts` — extended with `submitRegistryIntake` (kind-aware idempotency, dynamic Zod validation, write-behind adapters, downstream agent enqueue stub)
- `apps/api/src/services/MarketingCampaignService.ts` — registry-driven auto-gen hook: checks `getDefinitionsForTrigger(stage)` on non-recovery transitions; `REVIEW_TRANSITIONS` extended with `gbp_intake_submitted` + `review_setup_submitted` stages
- `apps/api/src/services/RecoveryResolutionService.ts` — updated for 1:N relation (uses `find` on `mkt_dispute_intake` array, `findFirst` for `findByCampaign`)

### Routes
- `apps/api/src/routes/recovery-intake-public.ts` — dispatches to `submitRegistryIntake` for registry kinds; `GET /options` endpoint for dynamic option sources; `reissue` accepts `intakeKind`
- `apps/api/src/routes/marketing-ops.ts` — `GET /recovery/:campaignId/intake` accepts `intakeKind` query param (returns single intake) or returns all intakes (array); `reissue-link` + `attachments/:id` accept `intakeKind`

### Frontend
- `apps/web/src/app/recovery/intake/IntakeFormRenderer.tsx` — generic, registry-driven form renderer (text, url, email, phone, textarea, select, radio, multiselect, checkbox, chips, hours_grid, attachments, number, date, object/nested)
- `apps/web/src/app/recovery/intake/IntakePageClient.tsx` — registry render path: detects `context.definition` and renders `IntakeFormRenderer` instead of hardcoded form fields
- `apps/web/src/services/RecoveryIntakePublicService.ts` — `submitRegistryIntake`, `getOptions`, `reissueLink(campaignId, intakeKind)`
- `apps/web/src/services/RecoveryOpsService.ts` — `getIntake(campaignId, intakeKind)`, `reissueLink(campaignId, intakeKind)`, `downloadAttachment(campaignId, attachmentId, fileName, intakeKind)`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` — generic evidence payload renderer for registry kinds (JSON display + downstream action panel)

### Tests
- `apps/api/src/services/__tests__/IntakeDefinitionService.test.ts` (15 tests) — getByKind, getDefinitionsForTrigger, resolve (niche overrides), buildSubmitSchema (dynamic Zod), cache invalidation
- `apps/api/src/services/__tests__/DisputeIntakeService.test.ts` (21 tests) — existing dispute tests + 6 new submitRegistryIntake tests (success, idempotency, expired/invalid token, missing definition, Zod validation failure)

### Key Patterns
- **Code-defined kinds** (`dispute`, `profile_repair`): hardcoded form fields in `IntakePageClient`, validated by `recovery-intake.schema.ts`
- **Registry-driven kinds** (`gbp_optimization`, `review_response_setup`): dynamic form fields from `mkt_intake_definitions.form_schema`, validated by `IntakeDefinitionService.buildSubmitSchema`
- **Niche overrides**: `niche_overrides[category]` can add fields, override field labels/help, and override owner copy per business category
- **Downstream handoff**: stubbed enqueue with manual import path (plan §7.4)

## Gallery Short URLs (SMS-friendly prospect links)

Mirrors the coupon `/s/{autoId}` short URL pattern for diagnostic gallery tokens. The 32-char `/preview/{token}` URL is too long for SMS outreach to phone-only prospects; the short `/g/{shortCode}` form (6 chars) makes text-message gallery links practical.

### Schema (Migration 183)
- `mkt_deliverable_preview_tokens.short_code` — nullable `VARCHAR(8)`, unique partial index `idx_mkt_preview_tokens_short_code` (WHERE NOT NULL)
- 6-char codes from curated 32-char alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no 0/O/1/I), ~1B combinations
- Legacy tokens have `short_code = null` and keep working via the long URL; `ensureShortCode()` lazily backfills on next admin access

### Backend
- `apps/api/src/lib/id-generator.ts` — `generateGalleryShortCode()` (6-char nanoid from curated alphabet)
- `apps/api/src/services/MarketingDeliverableService.ts`:
  - `generateCampaignToken()` now mints a unique `short_code` (with 3-retry collision handling) for `diagnostic_gallery` + `multi_diagnostic_gallery` token types
  - `resolveShortCode(shortCode)` — public lookup, returns `{ token, tokenType }`; expired tokens return null
  - `ensureShortCode(tokenId, tokenType)` — lazy backfill for legacy tokens
- `apps/api/src/routes/gallery-code.ts` — `GET /api/gallery-code/:shortCode` (public, no auth) → `{ token, tokenType, isMultiGallery }`
- `apps/api/src/routes/routeRegistry.ts` — registers `/api/gallery-code` at `authLevel: 'public'`
- `apps/api/src/routes/marketing-ops.ts`:
  - Single gallery token response includes `shortUrl` + `shortCode` alongside `galleryUrl`
  - Multi-gallery token response includes `galleryUrl` (`?prospect=true`), `shortUrl`, `shortCode`
  - Pay-links list (`GET /campaigns/:id/pay-links`) includes `shortCode` + `shortUrl` per token (powers `listGalleryTokens`)

### Frontend
- `apps/web/src/services/GalleryShortCodeService.ts` — `resolveShortCode()` (extends `PublicApiSingleton`, `ttl: 0`)
- `apps/web/src/app/g/[shortCode]/page.tsx` — server redirect page: resolves short code → redirects to `/preview/{token}` (or `?prospect=true` for multi-gallery)
- `apps/web/src/services/MarketingOpsService.ts` — `GalleryToken` interface extended with `short_code?` + `shortUrl?`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/GalleryPanel.tsx` — "Use short URLs" toggle (default on); prefers `/g/{shortCode}` when available
- `apps/web/src/components/marketing-ops/LogContactModal.tsx` — "Insert gallery link" prefers short URL for SMS-friendly message body
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/SiblingsTab.tsx` — multi-gallery hint mentions SMS-friendly short URL

### Key Patterns
- **Resolution flow**: `/g/{shortCode}` (server page) → `GET /api/gallery-code/:shortCode` → `redirect(/preview/{token}[?prospect=true])`
- **Multi-gallery detection**: `tokenType === 'multi_diagnostic_gallery'` → append `?prospect=true` so `preview/[token]/page.tsx` renders `MultiGalleryPage`
- **Collision handling**: 3 retries on unique-index conflict; falls back to no short code (long URL still works) if exhausted
- **Lazy backfill**: legacy tokens without `short_code` are not broken; `ensureShortCode()` can backfill them on demand

## Intelligence Campaign Prompts — Focus + Kind Awareness

Makes prompt templates focus- and kind-aware so the campaign workspace Prompts tab surfaces only the templates matching the campaign's intelligence type. Previously focus was inferred from the template NAME (regex `/competitive/i`) and kind was inferred from `output_schema.name` — both were artifacts, not queryable data.

### Schema (Migration 203)
- `mkt_prompt_templates_list.intelligence_focus` — nullable `VARCHAR(20)` (`'emerging'` | `'competitive'`); NULL for non-intelligence templates + composition fragments
- `mkt_prompt_templates_list.intelligence_campaign_kind` — nullable `VARCHAR(20)` (`'discovery'` | `'establishment'`); NULL for non-intelligence templates + fragments
- Index `idx_mkt_prompt_templates_intelligence` on `(intelligence_focus, intelligence_campaign_kind, is_active)`
- Backfill sets the 3 known seeded templates: emerging discovery, competitive discovery, establishment

### Backend
- `apps/api/src/services/MarketingPromptService.ts`:
  - `PromptTemplateInput` gains `intelligenceFocus` + `intelligenceCampaignKind` (nullable)
  - `createTemplate` / `updateTemplate` persist both fields
  - `listTemplates` accepts `intelligenceFocus`, `intelligenceCampaignKind`, and `includeNullFocusKind` filters — when `includeNullFocusKind` is set, returns templates matching the focus+kind OR templates with NULL focus/kind (legacy fallback)
  - `cloneTemplate` copies both fields
  - `clearDefaultForType` includes focus+kind in the default-uniqueness key (so emerging + competitive can each have their own default)
- `apps/api/src/routes/marketing-ops.ts`:
  - `promptTemplateCreateSchema` accepts `intelligence_focus` + `intelligence_campaign_kind` (nullable enums)
  - `GET /prompts/templates` accepts `intelligence_focus`, `intelligence_campaign_kind`, `include_null_focus_kind` query params
  - `POST` / `PUT /prompts/templates/:id` pass the new fields through
- Seed scripts updated to set the new fields:
  - `apps/api/src/scripts/seed-intelligence-discovery-templates.ts` — sets `intelligenceFocus` + `intelligenceCampaignKind: 'discovery'` on both templates
  - `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` — sets `intelligenceCampaignKind: 'establishment'`
  - `apps/api/src/scripts/seed-intelligence-fragments.ts` — unchanged (fragments identified by `fragment_kind`, focus/kind stay NULL)

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `IntelligenceCampaignKind` type added (next to existing `IntelligenceFocus`)
  - `PromptTemplate` + `PromptTemplateCreateInput` gain `intelligence_focus?` + `intelligence_campaign_kind?`
  - `listPromptTemplates` accepts + passes the new filters
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — Prompts tab:
  - For intelligence-scope campaigns, passes `intelligence_focus` + `intelligence_campaign_kind` + `include_null_focus_kind: true` so only matching templates (plus legacy untyped ones) are fetched
  - Header text shows the active focus + kind when intelligence-scope
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`:
  - `PromptTemplateModal` shows Focus + Kind selectors only when `scope = 'intelligence'`; clears them when scope leaves intelligence
  - `intelligenceDiscoveryTemplateIds` memo uses stored fields with name-based fallback for legacy templates
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`:
  - `templateFocus` reads `template.intelligence_focus` first, falls back to name regex for legacy templates
  - `isIntelligenceDiscovery` / `isIntelligenceEstablishment` read `template.intelligence_campaign_kind` first, fall back to `output_schema.name`

### Key Patterns
- **Match + fallback**: the campaign Prompts tab query uses `(focus AND kind match) OR (focus AND kind are NULL)` so legacy/untyped templates remain visible alongside focus-matched ones
- **Backward compatibility**: all focus/kind inference sites retain a name-based or output_schema-based fallback so templates that haven't been re-seeded still work
- **Fragments excluded**: composition fragments (`prompt_type = 'fragment'`) keep NULL focus/kind — they're identified by `fragment_kind` and assembled by `PromptComposerService`

## Compatible Prompts Tab — Organization + Triage Recommendations

The Prompts tab on the campaign detail page (`CampaignDetailClient.tsx`) surfaces prompt templates filtered by the campaign's `scope` and current `stage`. Two organizational layers help the operator pick the right workspace quickly:

### Category Grouping
- Prompts are grouped by `category` (e.g., `profile_repair`, `Digital Audit`, `Review Response`), with an "Uncategorized" bucket sorted last
- Within each group: `is_default` prompts pinned first, then sorted by `output_schema` name, then by name
- Each card shows badges: **Default** (blue), **Intelligence-aware** (violet — all business-scope seek prompts), **output_schema** (gray)

### Triage Recommendations
- When triage is decided (`isOperatorAccepted === true` OR `overriddenPlaybook != null`), a green **"Recommended by Triage"** section appears at the top
- `computeTriageRecommendations()` matches prompts via two layers:
  - **Signal-based** (higher rank): `SIGNAL_PROMPT_MATCHERS` maps signal code patterns to prompt name patterns (e.g., `CP_NAP_*` → "NAP Drift Audit", `DS_CLAIMED_STATUS` → "Unclaimed Profile Audit", `WC_*` → "Business Audit", review signals → "Business Audit")
  - **Playbook category-based** (broader fallback): `PLAYBOOK_CATEGORY_TO_PROMPT_CATEGORIES` maps the effective playbook's category to prompt template categories (e.g., `profile_repair` → `profile_repair`, `review_management` → `Digital Audit` + `Review Response`)
- Each recommended card carries green reason badges explaining why it was recommended
- Recommended prompts are excluded from the "All Prompts" section below to avoid duplication
- All computation is client-side (no new API endpoint); triage result is fetched via `getTriage(campaignId)` in parallel with `listPromptTemplates`

## Business Origin (Diaspora / Heritage Categorization)

Captures the international country/region of origin for diaspora-niche campaigns (e.g. "African Grocery Store" → country: Gambia, region: West Africa). The continent-level qualifier in the `category` field is too coarse for prompt composition, niche overrides, and outreach targeting — a Gambian, Ethiopian, and Nigerian grocery store serve very different diaspora communities.

### Schema (Migration 204)
- `mkt_campaigns_list.business_origin_country` — nullable `VARCHAR(100)`, free-text country name (not ISO code, since prompt-facing)
- `mkt_campaigns_list.business_origin_region` — nullable `VARCHAR(100)`, free-text region (absorbs the multi-country case, e.g. "West Africa" spans Gambia, Senegal, Nigeria)
- Both nullable; no backfill required. Legacy campaigns have NULL and keep working.

### Backend
- `apps/api/src/routes/marketing-ops.ts`:
  - `campaignBaseSchema` accepts `business_origin_country` + `business_origin_region` (optional strings, max 100)
  - POST + PUT handlers pass `businessOriginCountry` / `businessOriginRegion` through to the service
- `apps/api/src/services/MarketingCampaignService.ts`:
  - `CampaignInput` + `CampaignUpdateInput` gain `businessOriginCountry?` + `businessOriginRegion?`
  - `createCampaign` writes both fields (null when absent)
  - `updateCampaign` writes both fields when present in the input (`!== undefined` guard)
- `apps/api/src/services/BusinessProspectService.ts` — `createSiblingCampaign` copies both origin fields from the source campaign (origin travels with the business identity, like `tone` + `attributes`)
- `apps/api/src/services/scope-utils.ts` — `business_origin` added to `business`, `category`, and `intelligence` scope variable lists (origin is niche-level context, not business-name-specific)
- `apps/api/src/services/MarketingExecutionService.ts` — `renderTemplate` candidate map builds `business_origin` as `country, region` joined string (empty when both null)
- `apps/api/src/services/deliverable/prompts.ts`:
  - `BusinessContextFields` gains `businessOrigin: string | null`
  - All 9 deliverable prompt templates (review response, recovery playbook, listing corrections, CTA fixes, mobile catalog, GBP photo, availability inquiry, fulfillment pathway, hours sync) inject `{{business_origin}}` (fallback: `'unspecified'`)
- `apps/api/src/services/deliverable/BusinessContextService.ts` — `getBusinessContext` populates `businessOrigin` from `[country, region].filter(Boolean).join(', ')`

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `Campaign` interface gains `business_origin_country?` + `business_origin_region?`
  - `CampaignCreateInput` gains both fields
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx`:
  - `FormState` + `EMPTY_FORM` include both fields (default `''`)
  - `fetchCampaign` loads both fields
  - Create submit sends `strOrUndef(form.business_origin_country)` + `strOrUndef(form.business_origin_region)`
  - Edit submit sends raw values (so cleared state persists)
  - Two `SuggestiveSelect` fields ("Origin Country" + "Origin Region") placed after the Category field, with vocabulary sourced from existing campaign records via `distinctValues`
  - Helper text explains the diaspora-niche use case + that non-diaspora categories should leave them blank

### Key Patterns
- **Country name, not ISO code**: these fields are prompt-facing (interpolated into deliverable prompts as `{{business_origin}}`), not join keys. "Gambia" reads naturally in a prompt; "GM" does not.
- **Region absorbs multi-country**: most grocery stores are regional rather than single-country. A single region field ("West Africa") handles the case where a store serves multiple country communities without requiring an array.
- **Scope placement**: `business_origin` is in `business`, `category`, and `intelligence` scope variable lists — origin is niche-level context tied to the category, not the specific business name, so category-scope and intelligence-scope prompts can reference it too.

## Log Contact Modal — Per-Channel Result Options + Other Subtype

Extends the "Log contact" modal so every channel has a tailored result dropdown (mirroring the Phone channel's "Call result" pattern), and the "Other" channel gains a subtype selector (DM / Text / Email / Fax-Mail).

### Behavior
- **Phone** — unchanged: "Call result" (Connected / Voicemail / No Answer / Wrong Number / Disconnected) auto-maps to `outcome`.
- **Email** — Contact result: Replied / Sent-no-reply / Bounced / Unsubscribed / Marked as spam / Failed to send.
- **Website** — Contact result: Form submitted / Awaiting response / Form error / No contact form / Page not found.
- **Social** — Contact result: Replied / Sent-no-reply / Comment left / Profile not found / No DM access.
- **In Person** — Contact result: Met owner / Met staff / Not available / Left message with staff / Refused / Closed permanently / Wrong location.
- **Other** — Contact result: Replied / Sent-no-reply / Bad contact info / Refused / Failed to send. Plus an "Other type" subtype selector: DM / Text-SMS / Email / Fax-Mail.
- Selecting a contact result auto-sets the `outcome` field (operator can still override after, but backend enforces the mapping).

### Storage
- Reuses the existing `mkt_outreach_log.call_details` JSON column — no migration required.
- `call_details.call_result` is phone-only; `call_details.contact_result` is non-phone-only; `call_details.other_subtype` is `other`-channel-only. Backend Zod validation enforces these gates plus the per-channel allowed result set and the result→outcome mapping.

### Backend
- `apps/api/src/services/MarketingOutreachService.ts` — `CallDetails` extended with optional `contact_result` + `other_subtype`; new `ContactResult` + `OtherSubtype` union types.
- `apps/api/src/routes/marketing-ops.ts`:
  - `contactResultEnum` + `otherSubtypeEnum` Zod enums
  - `CONTACT_RESULT_TO_OUTCOME` map (result → required outcome)
  - `CHANNEL_CONTACT_RESULTS` map (channel → allowed result values)
  - `callDetailsSchema` extended with optional `call_result` / `contact_result` / `other_subtype`
  - `outreachLogSchema.superRefine` rewritten to handle both phone (`call_result` path) and non-phone (`contact_result` path) coherence checks

### Frontend
- `apps/web/src/services/MarketingOpsService.ts` — `CallDetails` + `ContactResult` + `OtherSubtype` types mirror backend; `LogContactInput` extended with optional `call_details` + `update_worksheet`.
- `apps/web/src/components/marketing-ops/LogContactModal.tsx`:
  - Per-channel result option arrays (`EMAIL_RESULT_OPTIONS`, `WEBSITE_RESULT_OPTIONS`, `SOCIAL_RESULT_OPTIONS`, `IN_PERSON_RESULT_OPTIONS`, `OTHER_RESULT_OPTIONS`) each with `outcome` mapping
  - `OTHER_SUBTYPE_OPTIONS` for the Other subtype selector
  - `contactResultOptionsForChannel(channel)` helper
  - `contactResult` + `otherSubtype` state; `useEffect` on `channel` resets result to first option of new channel + auto-maps outcome
  - Non-phone section renders "Contact result" dropdown + (when `other`) "Other type" dropdown
  - Submit sends `call_details: { contact_result, other_subtype }` for non-phone channels via `logContact`

## Outreach Checklist Bridge (Sprint 1)

Spec: `docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md`

Bridges the campaign execution layer (Openers, Follow-Ups, Pitch Construction, Contact Log) to the planning layer (Checklist Builder). Closes the gap where `outreach` checklist steps were hollow labels with no artifact detection or auto-completion.

### Migrations (apply in order)
- `185a_mkt_checklist_internal_link_step_type.sql` — DDL: adds `internal_link` to `chk_checklist_step_type` check constraint
- `185_mkt_outreach_checklist_bridge_backfill.sql` — Data-only: backfills `outreach_kind` + `auto_complete` on existing outreach starter steps; adds `internal_link` steps for Openers Workspace + Deliverables deep-links
- `186_mkt_outreach_state_signal_registry.sql` — Data-only: seeds `OX_*` signal rows in `mkt_signal_registry` under new `OX` family

### Backend
- `apps/api/src/services/OutreachChecklistBridgeService.ts` — bridge service:
  - `getOutreachState(campaignId)` — counts + derived flags from outreach tables
  - `checkStepSatisfaction(campaignId, step)` — checks if an outreach step's artifact exists
  - `onOutreachArtifactCreated(campaignId, kind, actor)` — auto-completes steps with `auto_complete=true` (fire-and-forget, called after opener/follow-up/pitch/contact-log creation)
  - `resolveStepDeepLink(campaignId, step)` — resolves internal URL for outreach + internal_link steps
  - `enrichStepViews(campaignId, stepViews)` — enriches checklist view with `outreachStatus` + `internalLink`
- `apps/api/src/services/triage/outreach-state-extractor.ts` — derives `OX_*` signals from outreach tables (openers, follow-ups, pitches, contact logs)
- `apps/api/src/services/triage/signal-taxonomy.ts` — `OX` family + 6 codes + `isOutreachStateSignal()` predicate
- `apps/api/src/services/triage/TriageEngineService.ts` — `evaluateTriage` + `evaluateAllMatchingPlaybooks` filter out `OX_*` signals (display-only, don't influence playbook selection)
- `apps/api/src/services/PlaybookChecklistService.ts`:
  - `internal_link` added to `CHECKLIST_STEP_TYPES`
  - `validateInternalLinkConfig` — validates named target against registry
  - `INTERNAL_LINK_TARGETS` — named target registry: `openers_workspace | deliverables | gallery | campaign_tab | recovery_detail | intake_form`
  - `getCampaignChecklist` enriches step views with `outreachStatus` + `internalLink` via bridge service (lazy import, best-effort)
  - `CampaignChecklistStepView` extended with `outreachStatus?` + `internalLink?`
- `apps/api/src/services/OutreachOpenerService.ts` — `fireBridgeAutoComplete` after execute/import (fire-and-forget)
- `apps/api/src/services/OutreachFollowUpService.ts` — `fireBridgeAutoComplete` after execute/import
- `apps/api/src/services/outreach-pitch/PitchService.ts` — fire-and-forget bridge call after `assemblePitch`
- `apps/api/src/services/MarketingOutreachService.ts` — fire-and-forget bridge call after `logContact`
- `apps/api/src/routes/marketing-ops.ts` — `GET /:id/outreach-state` endpoint

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `CHECKLIST_STEP_TYPES` includes `internal_link`
  - `INTERNAL_LINK_TARGETS` + `INTERNAL_LINK_TARGET_LABELS` — named target registry (mirrors backend)
  - `OUTREACH_KINDS` + `OUTREACH_KIND_LABELS` — outreach kind enum + labels
  - `ChecklistStepView` extended with `outreachStatus?` + `internalLink?`
  - `OutreachState` interface + `getOutreachState(campaignId)` method
- `apps/web/src/app/.../CampaignChecklistTab.tsx`:
  - Outreach steps render channel badge + kind label + satisfaction indicator (detected/not yet) + deep-link button + one-click "mark complete"
  - `internal_link` steps render "Open →" button with resolved URL
  - `SuggestionFormModal` captures `stepType` + type-specific `actionConfig` (URL for `url_check`, target for `internal_link`, channel+kind for `outreach`, credential_ref for `credentials`)
- `apps/web/src/app/.../ChecklistBuilderTab.tsx`:
  - `internal_link` in step type dropdown with indigo color
  - `internal_link` target selector + params JSON input
  - `outreach` kind selector + auto-complete checkbox + min follow-up # input
- `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` — checklist cross-link footer ("X/Y outreach steps complete →")
- `apps/web/src/app/.../OpenerWorkspaceClient.tsx` — checklist badge in campaign selector ("Checklist: X/Y outreach steps done →")

### Key Patterns
- **OX signals are display-only**: `isOutreachStateSignal()` predicate; triage engine filters them out of rule evaluation
- **Fire-and-forget bridge calls**: `import('./OutreachChecklistBridgeService').then(...)` pattern — checklist auto-completion never breaks the outreach flow
- **Named target registry**: `internal_link` steps use named targets (not raw URLs) — keeps step templates portable across campaigns; `{campaignId}` resolved at render time
- **Lazy import for circular dep avoidance**: `PlaybookChecklistService` lazy-imports `OutreachChecklistBridgeService` (bridge imports checklist service for step lookups)
- **Best-effort enrichment**: bridge enrichment failures are logged + swallowed — checklist renders without enrichment if bridge has issues

## Intelligence Profile City Scoping (Migration 205)

Closes the city-contamination gap: an intelligence profile established from a city-A establishment campaign was being applied to a city-B discovery campaign for the same `(category, focus)`, injecting city-A-specific discovery patterns, supplier names, and business examples into the city-B prompt. The discovery AI then returned city-A businesses.

### Schema (Migration 205)
- `mkt_intelligence_profiles.reference_city` — nullable `VARCHAR(100)`. NULL = city-agnostic (legacy/backfill sentinel).
- `idx_mkt_intel_profiles_active_category_city_focus` — partial unique index on `(category_key, reference_city, intelligence_focus) WHERE status = 'active' AND reference_city IS NOT NULL` — one active profile per (category, city, focus) triple.
- `idx_mkt_intel_profiles_active_category_focus_nullcity` — partial unique index on `(category_key, intelligence_focus) WHERE status = 'active' AND reference_city IS NULL` — preserves one-city-agnostic-profile-per-(category, focus) invariant.
- Backfill: `reference_city` populated from the most recent establishment campaign matching each profile's category_key. Profiles whose category has no establishment campaign remain NULL (city-agnostic).

### Resolution Semantics
`IntelligenceProfileService.resolve(category, focus?, city?, ctx?)`:
1. If `city` is provided: try exact `(category_key, reference_city, focus)` match (primary path).
2. Fall back to city-agnostic `(category_key, reference_city=NULL, focus)` match — logged warning.
3. Fall back to `(category_key, focus)` match ignoring city — logged warning (cross-city contamination possible).
4. If `focus` is omitted (business-scope §1B path): city is still honored; focus filter is dropped.

### Render-Time City Mismatch Guard
`renderProfileBlock(profile, targetCity?)` and `renderBusinessProfileBlock(profile, targetCity?)`:
- Emit a `CITY RETARGETING DIRECTIVE` when the profile's `reference_city` differs from the campaign's target city — instructs the AI to apply category-level knowledge but re-derive concrete discovery queries, supplier lists, and business examples for the target city.
- Emit a `CITY APPLICATION DIRECTIVE` when a city-agnostic profile is applied to a city-specific campaign.

### Establishment Import
`MarketingPromptService.importExternalResult` now reads the establishment campaign's `city` and stamps it onto the imported draft via `importAsDraft({ referenceCity })`. This is the key fix: the establishment campaign's city flows end-to-end into the profile's reference_city.

### Key Files
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` — `resolve`, `createProfile`, `importAsDraft`, `activateDraft`, `publishVersion`, `renderProfileBlock`, `renderBusinessProfileBlock`, `normalizeReferenceCity`
- `apps/api/src/services/intelligence/PromptComposerService.ts` — `composeIntelligencePrompt({ category, focus, city })`
- `apps/api/src/services/MarketingExecutionService.ts` — passes `input.campaign.city` to composer + business-scope resolver
- `apps/api/src/services/MarketingPromptService.ts` — stamps establishment campaign city onto imported draft
- `apps/api/src/routes/marketing-ops.ts` — `resolve` route accepts `?city=` query; `create` route accepts `referenceCity` body field
- `apps/web/src/services/MarketingOpsService.ts` — `resolveIntelligenceProfile(category, focus?, city?)`, `createIntelligenceProfile({ referenceCity })`, `IntelligenceProfile.reference_city`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` — displays reference_city badge (cyan for city-scoped, gray for city-agnostic)
- `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` — establishment template now instructs the AI to produce city-specific concrete examples

### Tests
- `apps/api/src/services/__tests__/IntelligenceProfileService.focus-alignment.test.ts` — 24 tests (existing focus tests updated for `reference_city: null` filter + 13 new city-scoped tests)
- `apps/api/src/services/__tests__/PromptComposerService.test.ts` — 5 tests (city pass-through test added)
- `apps/api/src/services/__tests__/ResolvePrompt.test.ts` — 9 tests (business-scope city pass-through assertion updated)

## Directory Seed ↔ Campaign Link (Migration 230)

Bridges `directory_presence_seeds` (unclaimed public listings) with `mkt_campaigns_list` (operator-validated prospect campaigns) so campaign signals can enrich the seed's public SEO surface. One physical business may have many sibling campaigns (multi-archetype), so this is a join table — not a 1:1 FK on the seed.

### Schema (Migration 230)
- `directory_seed_campaign_links` — join table (`seed_id`, `campaign_id`, `tenant_id`, `link_role`, `nap_match_confidence`, `nap_match_summary` JSONB, `last_synced_at`, `last_sync_fields[]`)
- `link_role` CHECK: `primary` (one per seed, enforced by partial unique index) / `sibling` / `recovery`
- `nap_match_confidence` CHECK: `high` / `medium` / `low` / `none`
- Unique on `(seed_id, campaign_id)` regardless of role

### Backend
- `apps/api/src/services/DirectorySeedCampaignLinkService.ts`:
  - `computeNapMatch(seedId, campaignId)` — normalized business name + address + phone + city comparison; high = name match AND (address OR phone match) AND city match
  - `linkCampaign(seedId, campaignId, role)` — creates link, computes NAP match, **auto-projects campaign signals only when NAP confidence is high**
  - `unlinkCampaign(seedId, campaignId)` — removes link; does NOT roll back projected fields (provenance rows remain as audit trail)
  - `listLinks(seedId)` — returns links with campaign summary
  - `buildDiff(seedId, campaignId)` — per-field diff (campaign value vs current seed value) for operator review
  - `syncFromCampaign(seedId, campaignId, fields[])` — projects selected fields onto listing + writes `directory_field_provenance` rows with `source_name = 'linked_campaign'`, `confidence = 'high'`, `show_on_public = true`
  - `findCandidateCampaigns(seedId, query?)` — searches unlinked campaigns by business name similarity or city+category match
- `apps/api/src/routes/directory-presence-admin.ts` — 6 new endpoints under `/api/admin/directory-presence/presence-seeds/:id/campaign-links`:
  - `GET  /campaign-links` — list linked campaigns
  - `GET  /campaign-candidates?query=` — search unlinked campaigns
  - `GET  /campaign-links/:campaignId/diff` — per-field diff
  - `POST /campaign-links` — link a campaign (body: `{ campaignId, role }`)
  - `DELETE /campaign-links/:campaignId` — unlink
  - `POST /campaign-links/:campaignId/sync` — project fields (body: `{ fields[] }`)
- `apps/api/src/lib/id-generator.ts` — `generateDirectorySeedCampaignLinkId(tenantId)` (`dscl-` prefix)

### Projection policy
- **Auto-projection on link**: only when `nap_match_confidence = 'high'`. Default projected fields: phone, website, primaryCategory, originCountry, originRegion, neighborhood.
- **Manual sync**: operator opens diff modal, picks fields explicitly. Overwrites operator-entered seed values; provenance row preserves the audit trail.
- **Origin country/region/neighborhood** → merged into `directory_listings_list.keywords[]` as prefixed tokens (`origin_country:Senegal`, `neighborhood:Broad Ripple`) for SEO.
- **Primary category** projection also mirrors to `directory_presence_seeds.category` so `/place` browse pages stay consistent.
- **Directory profiles** (JSON) → provenance row only (not flattened onto listing).

### Frontend
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — `listCampaignLinks`, `findCampaignCandidates`, `getCampaignDiff`, `linkCampaign`, `unlinkCampaign`, `syncFromCampaign` + types `DirectorySeedCampaignLink`, `DirectoryCampaignCandidate`, `DirectoryCampaignDiffEntry`
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/[id]/LinkedCampaignsPanel.tsx` — panel with:
  - Linked campaign cards (role badge, NAP confidence badge, last sync metadata, expandable NAP match details)
  - "Link Campaign" picker modal (search + role selector + candidate list with already-linked state)
  - "Sync" diff modal (per-field campaign-vs-seed comparison, checkbox select, project button)
  - "Unlink" with confirm (warns that projected fields stay)
- Mounted on seed detail page after the Outreach & Enrichment section

### Provenance field keys (new, campaign-sourced)
- `origin_country`, `origin_region`, `neighborhood`, `description`, `directory_profile`
- All campaign-sourced provenance: `source_name = 'linked_campaign'`, `source_url = /settings/admin/marketing-ops/recovery/:campaignId`, `confidence = 'high'`, `show_on_public = true`

## V3.1 Entry Presence Tier (Migration 231)

Implements the V3.1 tier strategy: `directory_presence` (free gateway) → Entry Presence triad (`presence`, `discovery`, `storefront`) → Commerce tiers → Scale tiers. The `presence` tier is a clean directory-enrichment-only tier (display name "Starter", $19/mo) that does NOT inherit Google or platform marketplace capabilities. The legacy `starter` tier remains dormant and inactive.

Strategy source of truth: `docs/PLATFORM_STRATEGY_V3.md`
Progressive upgrade spec: `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md`
Tier hierarchy skill: `.devin/skills/tier-hierarchy.md`

### Tier taxonomy
| Key | Layer | Price | Display | Role |
|-----|-------|------:|---------|------|
| `directory_presence` | Gateway | $0 | Directory Presence | Free seed/claim on-ramp |
| `presence` | Entry Presence | $19 | Starter | Paid in-house directory surface (logo, about, gallery, layouts) |
| `discovery` | Entry Presence | $29 | Discovery | Google visibility surface |
| `storefront` | Entry Presence | $59 | Storefront | Platform marketplace/storefront surface |
| `commitment` | Commerce | $79 | Commitment | Deposit-only money mode |
| `ecommerce` | Commerce | $99 | E-commerce | Full-payment money mode |
| `omnichannel` | Commerce | $149 | Omnichannel | Deposit + full-payment mode |
| `professional` | Scale | $199 | Professional | Advanced single-location tier |
| `organization` | Scale | $499 | Organization | Organization tier |
| `enterprise` | Scale | $499 | Enterprise | Multi-location/enterprise tier |

Legacy inactive tiers (do NOT reactivate): `starter`, `google_only`, `chain_starter`.

### Hierarchy
```text
directory_presence: []
presence:           [directory_presence]
discovery:          [directory_presence]
storefront:         [discovery, directory_presence]
```
`presence` does NOT inherit `google_only` or `starter`. It is directory enrichment only.

### Migration 231
- `database/migrations/231_entry_presence_tier.sql`
- Adds `billing_type` column to `subscription_tiers_list` (default `'subscription'`, `directory_presence` set to `'none'`)
- Inserts `presence` tier row ($19, sort_order=10, `billing_type='subscription'`)
- Seeds 6 directory-entry feature keys: `directory_entry_logo_on`, `directory_entry_about_on`, `directory_entry_gallery_on`, `directory_entry_social_on`, `directory_entry_layout_editorial`, `directory_entry_layout_immersive`
- Links features to `directory_entry` capability type
- Seeds `tier_features_list` for `presence` (directory enrichment only)
- Renumbers active V3 tier sort orders (0/10/20/30/40/50/60/70/80/90)

### Backend
- `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` — reads `directory_entry_logo_on` / `directory_entry_about_on` (with `_enabled` fallbacks); produces `logo_enabled`, `can_show_logo`, `about_enabled`, `can_show_about`
- `apps/api/src/services/resolvers/types.ts` — `EffectiveDirectoryEntryOptions` includes the 4 new fields
- `apps/api/src/routes/public-tenant-capabilities.ts` — expired capability response includes false-valued logo/about fields
- `apps/api/src/routes/directory-presence-upgrade.ts` — V3.1 gateway upgrade API:
  - GET `/:tenantId/upgrade/options` — when current tier is `directory_presence`, returns the triad (`presence`, `discovery`, `storefront`) with mode metadata (`mode`, `surface`, `tagline`, `isPrimary`) and `isGatewayUpgrade: true`; non-gateway tenants get the flat sort_order ladder
  - POST `/:tenantId/upgrade` — enforces: from gateway, only the three Entry Presence modes are valid targets (`invalid_gateway_upgrade_target` error otherwise); paid tiers require `paymentMethodId`
- `apps/api/src/middleware/tier-access.ts` — `presence` added to `TIER_HIERARCHY`, `tierOrder`, display names, pricing
- `apps/api/src/utils/tier-limits.ts` — `presence` added to `SubscriptionTier` type and `TIER_LIMITS` (maxSkus: 0 — directory mode, no catalog)
- `apps/api/src/utils/trial-tier-transparency.ts` — `trial_presence` → `presence` mapping
- `apps/api/src/services/GrowthTipService.ts` — `presence` added to `TIER_ORDER`

### Frontend
- `apps/web/src/lib/tiers/tier-features.ts` — clean `presence` entry (directory-mode only); `TIER_HIERARCHY.presence = ['directory_presence']`; `TIER_DISPLAY_NAMES.presence = 'Starter'`; `TIER_PRICING.presence = 19`
- `apps/web/src/lib/tiers/tier-resolver.ts` — `presence` in `TierInfo['level']`, `mapTierLevel`, hierarchy comparison, upgrade options
- `apps/web/src/lib/tiers/content-consistency.ts` — `presence` progression entry
- `apps/web/src/lib/growth-tips/tipEngine.ts` — `presence` in `TIER_ORDER`
- `apps/web/src/services/CapabilityResolutionService.ts` — `logoEnabled`, `aboutEnabled`, `canShowLogo`, `canShowAbout`
- `apps/web/src/services/UnifiedCapabilityService.ts` — `BackendEffectiveDirectoryEntry` extended; `mapDirectoryEntry()` maps snake_case → camelCase
- `apps/web/src/services/DirectoryPresenceUpgradeService.ts` — `UpgradeTierOption` gained `mode`, `surface`, `tagline`, `isPrimary`, `billingType`; `UpgradeOptions` gained `isGatewayUpgrade`
- `apps/web/src/app/t/[tenantId]/settings/subscription/upgrade/page.tsx` — V3.1 mode picker:
  - When `isGatewayUpgrade` is true: renders mode badges (`directory`/`google`/`platform`), taglines, surface labels, "Recommended" badge on Presence
  - Presence card gets blue ring + border highlight as primary CTA
  - Paid tiers show inline Stripe `CardElement` form when selected (SetupIntent flow → `paymentMethodId` → `upgrade()` call)
- `apps/web/src/app/directory/[slug]/page.tsx` — passes `directoryEntryOptions` through `layoutProps`
- `apps/web/src/app/directory/[slug]/layouts/types.ts` — `DirectoryEntryLayoutProps` includes capability state
- All 4 directory layouts (Classic, Editorial, Immersive, Premium) — gate logo with `canShowLogo`, about with `canShowAbout`; default `?? true` so existing tenants keep rendering
- `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` — gates logo with `dirEntryOpts?.canShowLogo`
- `apps/web/src/app/directory/claim/[token]/DirectoryClaimClient.tsx` — claim success CTA is "Choose Your Presence Mode" (not "Upgrade to Sell Online")
- `apps/web/src/components/dashboard/TierUpgradeCard.tsx` — dashboard CTA is "Choose Your Presence Mode"

### Tests
- `apps/api/src/services/resolvers/CapabilityResolversOnOff.test.ts` — 8 new `DirectoryEntryOptionsResolver` tests (logo/about gating, flexible tier, disabled capability, layout keys)
- `apps/web/src/lib/tiers/entry-presence-tier.test.ts` — 21 tests verifying presence feature boundaries, hierarchy isolation, legacy starter dormancy, gateway free-tier limits
- `apps/web/vitest.config.ts` — vitest config for web app (node environment, `@` alias)

## Profile Repair Briefing Persistence & Opener Bridge (Migration 232)

AI-generated triage and per-issue briefings are persisted as campaign artifacts (not just execution logs) and can be wired into the Openers workspace.

### Schema (Migration 232)
- `mkt_campaigns_list.repair_triage_briefing` JSONB NULL — persists the triage briefing (`scope`, `viability`, `pitch`, `risks`, `recommended_track`, etc.) with provenance metadata (`_execution_id`, `_validated`)

### Backend persistence
- `ProfileRepairPromptService.executeSeekSync()` — after running the triage template (`mpt-profile-repair-triage-default`), parses + validates the AI output, persists the briefing to `repair_triage_briefing` with `_execution_id` and `_validated` flags. Best-effort output (strict Zod fails but `profile_repair_triage` exists) is persisted with `_validated: false`. Unparseable output does NOT overwrite the previous briefing.
- `ProfileRepairPromptService.importExternalResult()` — persists valid imported triage output the same way.
- Per-issue seek templates (`mpt-profile-repair-nap-drift-seek`, etc.) do NOT persist to `repair_triage_briefing` — their output (`profile_repair_audit`) is rendered from `mkt_prompt_executions_list.raw_output` by the frontend.

### Opener bridge
- `OutreachOpenerService.createFromBriefing()` — creates/updates an opener from an AI briefing's `opener_hook`. Mirrors `importOpener` upsert + quality gate + bridge autocomplete logic, but:
  - `source = 'ai_briefing'` (distinct from `'ai'` and `'external'`)
  - `hook_angle = null` (briefing's `primary_angle` is free-text, not a HOOK_LIBRARY key)
  - `extracted_fields` includes `{ sourceBriefing, executionId, primaryAngle }` for provenance
- Route: `POST /api/admin/marketing-ops/openers/from-briefing` (before the catch-all)
- Frontend: `MarketingOpsService.createOpenerFromBriefing()` + `OpenerSource` widened to `'ai' | 'external' | 'ai_briefing'`

### Frontend
- `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx` — reads `campaign.repair_triage_briefing` on mount (survives refresh + track confirmation); re-runs triage with explicit `templateId = 'mpt-profile-repair-triage-default'` (so post-confirmation re-runs don't accidentally run a per-issue seek); shows "Unverified" badge when `_validated === false`; "Create Opener from Hook" button
- `apps/web/src/components/marketing-ops/RepairBriefingCard.tsx` — renders per-issue `profile_repair_audit` executions (scope, impact, pitch, risks) + "Create Opener from Hook" button
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — fetches executions via `listExecutions`, filters by `output_schema.name === 'profile_repair_audit'`, renders `RepairBriefingCard`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx` — source badge shows "AI Briefing" for `ai_briefing` source

### Tests
- `apps/api/src/services/__tests__/OutreachOpenerService.test.ts` (4 tests) — create with `source='ai_briefing'`, upsert in place, quality-gate failure doesn't block, provenance fields
- `apps/api/src/services/__tests__/ProfileRepairPromptService.persistence.test.ts` (4 tests) — strict validation pass (`_validated=true`), best-effort (`_validated=false`), unparseable output (no write), per-issue template (no write)

### Platform signal weights in the triage briefing (2026-09-20, seed marker `triage-briefing-v4`)
Per `CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC.md` §2 "Reported, not applied", `resolvePrompt`'s `signal_triage` path appends a `=== PLATFORM SIGNAL WEIGHTS ===` block (weights table + `LEAD PLATFORM:` + read-only directive) after the gold-standard block and before market context — in ALL three sub-paths (CI present, gold-standard-only, neither), since weights live on every active profile for the category. The render reuses the seek auto-source's `resolveSignalWeightsForCampaign` result (hoisted `resolvedSignalWeights`) — one resolution per render; `serializeSignalWeightContext` returns `''` when nothing resolves → legacy render preserved. The block supplies the "where the customers are" premise + severity weighting; it never feeds scoring. The `fulfill_target` path also appends the block (lazy resolution — weights are resolved there when the seek auto-source didn't run), so the citation package's fix-sheet ordering follows the same priority.

### Platform-aware outreach ranking (2026-10, seed markers `issue-briefing-v3`, `fulfill-package-v5`)
The lead-platform formula is generalized to a ranking: `rankPlatformPriorities(auditData, resolved)` (IntelligenceProfileService) returns every platform that BOTH carries a resolved weight AND shows an audit gap, sorted by `signal_weight × gap_severity` desc — entry `[0]` is what `selectLeadPlatform` returns. `signalPlatformDisplayName` maps canonical keys to owner-facing names ("Apple Maps", "BBB"). Consumers:
- **HookSuggestionService / CallScriptService** — `HookTemplate.platforms?: string[]` tags bind hooks to canonical platform keys; the severity tie-break keys are scaled by `×(1 + platformScore)` (hook's best platform score; 0 for untagged/unweighted → byte-identical legacy order). A residual `platformScore` tie-break orders the signal-less tail toward high-traffic platforms. Result shapes expose `platform_priorities` (and `callContext.platform_premise`); `{{lead_platform}}` resolves in hook bodies, call-script stages, and ManualOutreachScriptService merge context — the placeholder stays visible when nothing resolves.
- **Issue briefings + citation-package seeds** — `outreach_problems` rank severity × weight within the issue-aligned set; fix sheets and the submission-guide order of operations follow the platform ranking.
All weight resolution is best-effort try/catch — unresolved → empty priorities → exactly the pre-weight behavior.

## Gold Standard Scan — Two-Template Pattern (Establishment vs Discovery)

Gold-standard scans use TWO distinct prompt templates, gated by `intelligence_campaign_kind` on the campaign. The Prompts tab filters templates by `intelligence_campaign_kind` (with a NULL fallback for legacy templates), so a discovery campaign sees only the discovery template and an establishment campaign sees only the establishment template.

### Templates (seeded by `apps/api/src/scripts/seed-gold-standard-scan-template.ts`)
- `mpt-seed-gold-standard-scan-001` — **Establishment** (`intelligence_campaign_kind = 'establishment'`): instructs the analyst to DERIVE `expected_fields` and `quality_gates` from the top candidates. The validated JSON is persisted as a DRAFT gold-standard profile by `IntelligenceProfileService.importAsDraft()`.
- `mpt-seed-gold-standard-scan-discovery-001` — **Discovery** (`intelligence_campaign_kind = 'discovery'`): instructs the analyst to EVALUATE new candidates against the already-established gold-standard profile (injected at render time). The validated JSON creates an audit; it does NOT create a profile draft.

### Render-time profile injection
- `MarketingExecutionService.resolvePrompt()` — when `intelligence_focus === 'gold_standards'` AND `intelligence_campaign_kind === 'discovery'`, resolves the active gold-standard profile via `IntelligenceProfileService.resolveGoldStandard(category)` and injects it via `serializeGoldStandard(profile, 'discovery')`.
- Establishment scans skip injection (they ARE the derivation step) and render the template body as-is.
- When no active profile exists for a discovery scan, a degraded-mode warning is appended (the analyst falls back to deriving expected_fields from candidates).

### `GoldStandardRole` type (`apps/api/src/services/intelligence/IntelligenceProfileService.ts`)
- `'benchmark'` — audit/seek prompt: compare a business against the gold standard
- `'target'` — fulfill prompt: produce fixes that move toward the gold standard
- `'discovery'` — gold-standard discovery scan: evaluate new candidates against the established expected fields and quality gates (do NOT re-derive)

### `serializeGoldStandard(profile, 'discovery')` output
Emits a `=== GOLD STANDARD DISCOVERY CRITERIA ===` block containing:
- Universal expected fields (canonical NAP, hours, website)
- Per-platform expected fields (primary category, attributes, description, photo count, branding expectations)
- Quality gates (non_negotiable + recommended)
- Pattern exemplars (candidates flagged `is_gold_standard` in the establishment scan, with destination URLs)

The directive tells the analyst to: evaluate each candidate against the established gates, mark `is_gold_standard = true` ONLY for candidates that pass ALL non_negotiable gates, and ECHO the established `expected_fields` in the output (not re-derive them).

### Re-seeding
```bash
cd apps/api
doppler run --config local -- npx tsx src/scripts/seed-gold-standard-scan-template.ts
doppler run --config prd -- npx tsx src/scripts/seed-gold-standard-scan-template.ts
```
Idempotent — updates existing templates in place and creates the discovery template if missing.

## Gold Standard Profile — Platform-Aware Resolution (Migration 236)

Gold-standard profiles are now platform-scoped, mirroring the existing city-aware resolution pattern. The `mkt_intelligence_profiles` table has a `reference_platform` column (VARCHAR(20), nullable):
- `NULL` = cross-platform profile (the default; backward-compatible with all existing profiles)
- `'google'` | `'yelp'` | `'facebook'` | `'bbb'` | `'apple_maps'` | `'bing'` = platform-specific profile

### Identity tuple
`importAsDraft()` now uses `(category_key, intelligence_focus, reference_city, reference_platform)` as the identity tuple. A google-specific establishment scan and a cross-platform establishment scan for the same category get **distinct profile ids** — they coexist rather than shadowing each other.

### Resolution fallback chain (`IntelligenceProfileService.resolve()`)
When `platform` is provided, the resolver narrows from most-specific to least-specific:
1. `(category, focus, city, platform)` — city + platform exact
2. `(category, focus, city, platform=null)` — city exact, cross-platform fallback
3. `(category, focus, city=null, platform)` — city-agnostic, platform exact
4. `(category, focus, city=null, platform=null)` — city-agnostic, cross-platform fallback
5. Legacy focus-only / category-only fallbacks (ignore platform)

This means a business audit on Google first looks for a google-specific gold-standard profile; if none exists, it falls back to the cross-platform profile's google section. You only need per-platform profiles when the cross-platform benchmark isn't deep enough.

### Import hook (`MarketingPromptService`)
When a gold-standard scan result is imported, `platform_focus` from the scan JSON is persisted as `reference_platform`. If `platform_focus === 'all'`, `reference_platform` is set to `NULL` (cross-platform).

### `resolveGoldStandard(category, platform?, ctx?)`
- `platform` is optional; when omitted, resolves cross-platform profiles only (backward-compatible).
- When provided, follows the platform-aware fallback chain above.

### Callers that pass platform
- `MarketingExecutionService.resolvePrompt()` — discovery scans pass `campaign.intelligence_platform`
- `MarketingExecutionService` audit/fulfill/triage paths — pass `campaign.intelligence_platform` when available
- Frontend `GoldStandardEstablishmentPanel` / `GoldStandardDiscoveryPanel` — pass `campaign.intelligence_platform`
- Frontend `PromptWorkspaceClient` — passes `selectedCampaign.intelligence_platform` for gold-standard focus
- API route `GET /intelligence-profiles/resolve/:category?platform=...` — accepts `platform` query param
- API route `POST /intelligence-profiles` — accepts `referencePlatform` in body

### Frontend
- `IntelligenceProfile` interface includes `reference_platform: string | null`
- `resolveIntelligenceProfile(category, focus?, city?, platform?)` — 4th param is platform
- `GoldStandardEstablishmentPanel` shows platform badge on active profile card; draft filter matches campaign platform OR cross-platform drafts

## Gold Standard — Emerging/Competitive Discovery Benchmark (Platform-Aware)

Closes the gap where emerging/competitive discovery scans had no category-top benchmark to rate candidates against. The gold standard profile (established by a prior Gold Standard Establishment scan) is now injected into emerging/competitive discovery scans as a `discovery_benchmark` block, introducing **platform awareness** into focus discovery scans for the first time.

### Injection point
`MarketingExecutionService.resolvePrompt()` — composer path (emerging/competitive intelligence-scope seek):
- After `PromptComposerService.composeIntelligencePrompt()` returns the composed body (base + extension + focus profile + focus modifier), resolves the gold standard via `IntelligenceProfileService.resolveGoldStandard(category, campaign.intelligence_platform, ctx)`
- If present: appends `serializeGoldStandard(goldStandard, 'discovery_benchmark')` to the rendered prompt
- If absent: appends a soft degraded-mode note (`=== NO GOLD STANDARD PROFILE — BENCHMARKING ABSENT ===`) so the operator knows to run an establishment scan first
- Resolution metadata includes `gold_standard_profile_id` + `gold_standard_profile_version` for audit trail

### `'discovery_benchmark'` role (`GoldStandardRole` type)
New role added to `IntelligenceProfileService.serializeGoldStandard()`:
- Header: `=== GOLD STANDARD DISCOVERY BENCHMARK ===`
- Includes `Platform scope:` line (platform-specific or `cross-platform (all platforms)`)
- Directive instructs the analyst to:
  - Rate each discovered candidate per-platform against the established expected fields and quality gates
  - Set `gold_standard_match = true` ONLY for candidates that pass ALL `non_negotiable` gates on the platform(s) where they have a presence
  - Populate `gold_standard_gate_results` per candidate with per-gate pass/fail
  - Aggregate per-platform gate failures into `platform_analysis.platform_breakdown`
  - Recommend a `primary_platform` for outreach based on where the gold standard is deepest AND where candidates have the most fixable gaps (highest-opportunity platform, not just the most-present platform)
  - Populate `platform_analysis.outreach_recommendation` with platform-specific opportunities and `recommended_platform_focus` for downstream business audits

### `PromptResolution` type
Extended with optional `gold_standard_profile_id?: string | null` and `gold_standard_profile_version?: number | null`.

## Discovery Leads Handoff (GAP-E3 — Migration 253)

Spec: `docs/LocalBiz/marketing_ops_discovery_leads_handoff_spec.md`

Closes the discovery→audit context cliff: child business campaigns born from intelligence-discovered prospects durably carry the discovery context (signals, provenance, seek priority, category fit, run lineage) so the business analysis audit prompt can render a "Discovery leads" block as verification hypotheses (never as findings — §S1 guardrail preserved).

### Migration 253
`database/migrations/253_campaign_discovery_context.sql` — additive `discovery_context JSONB` + `intelligence_run_id VARCHAR(64)` on `mkt_campaigns_list` + partial index on `intelligence_run_id`. Both nullable; no backfill.

### Data contract — `DiscoveryContext`
Stored on `mkt_campaigns_list.discovery_context` (JSONB, nullable). Validated by `discoveryContextSchema` in `apps/api/src/validators/intelligence-discovery.schema.ts`:
- `focus: 'emerging' | 'competitive'` (source-run focus, NOT the campaign's own `intelligence_focus` column)
- `discovered_at`, `business_seek_priority`, `category_fit`, `identity_confidence`, `location_status`, `seek_batch_id`
- `discovery_signals: string[]` (INT_* only — `/^INT_/` regex enforced)
- `discovery_provenance` (reuses the now-exported `discoveryProvenanceSchema`)
- `validateDiscoveryContext(raw)` helper returns `DiscoveryContext | null` (drop + log on invalid — never blocks campaign creation)

### Backend
- `MarketingCampaignService.createCampaign()` + `deriveBusinessCampaign()` — accept optional `discoveryContext` + `intelligenceRunId`, persist to new columns, append human-readable "Discovery context" section to notes
- `MarketingProspectQueueService.createCampaignFromQueue()` — builds discovery context from the queue entry for `source_kind = 'intelligence_seek'`, validates via `validateDiscoveryContext`, passes through to `deriveBusinessCampaign`. New private `resolveRunFocus(intelligenceRunId)` does PK lookup on `mkt_intelligence_runs.focus`
- `MarketingExecutionService.resolvePrompt()` — `category_audit` path injects `renderDiscoveryLeadsBlock(campaign)` after gold-standard benchmark, before `appendPromptSuffix`. Block renders signals (labeled via hardcoded `INT_SIGNAL_LABELS` map) + provenance (capped at 6) + priority/fit + `discovered_at` + mandatory absence-rules paragraph. Returns `''` when context absent (byte-identical render). `resolution.discovery_leads_injected` stamps whether the block was appended.

### INT label map (hardcoded)
The intelligence sprint's proposed registry seed (migration 199, GAP-S1) was never delivered — no INT_* rows exist in `mkt_signal_registry`. INT_* is a closed, spec-defined 11-code family, so a static `INT_SIGNAL_LABELS` map is used in both `MarketingCampaignService` (notes) and `MarketingExecutionService` (leads block) to avoid a DB dependency in the render path.

### Guardrails (§9)
1. §S1 preserved — INT_* codes never enter `detected_signals`, the signal extractor, or playbook rule evaluation
2. Verification framing mandatory — block always carries "hypotheses, not findings" framing + absence-rules paragraph
3. Scope exclusions — block renders only for business-scope `seek` prompts with `promptRole === 'category_audit'` (never `fulfill`, `signal_triage`, or intelligence-scope)
4. No triage coupling — discovery context does not auto-trigger triage or alter triage results

### Tests
- `apps/api/src/services/__tests__/DeriveBusinessCampaignDiscovery.test.ts` (7 tests) — T1 handoff with context, T2 legacy call, T7 invalid-context drop (4 cases)
- `apps/api/src/services/__tests__/DiscoveryLeadsBlock.test.ts` (11 tests) — T3 block rendering (6 cases), T4 triage invariance, T5 role gating (4 cases)
- `apps/api/src/services/__tests__/SignalExtractorIntFamily.test.ts` (5 tests, unchanged) — §S1 regression guard


### Output schema (`intelligence-discovery.schema.ts`)
Per-candidate (all optional, forward-compatible via `.passthrough()`):
- `gold_standard_match: z.boolean().nullable().optional()` — passes ALL non_negotiable gates
- `gold_standard_gate_results: z.array(z.object({ gate: z.string(), passed: z.boolean(), platform: z.string().optional() })).nullable().optional()` — per-gate pass/fail

Top-level `platform_analysis` section (optional — present only when a gold standard block was injected):
- `gold_standard_profile_id` / `gold_standard_profile_version` / `gold_standard_platform` — traceability
- `platform_breakdown[]` — per-platform presence counts, meets_gold_standard_count, common_gate_failures
- `candidates_meeting_all_gates` — category-level benchmarking summary
- `most_common_gate_failures[]` — aggregated gate failures with severity
- `outreach_recommendation` — `primary_platform`, `platform_rationale`, `platform_specific_opportunities[]`, `recommended_platform_focus`, `primary_angle`, `suggested_call_to_action`

The `recommended_platform_focus` field is the key handoff — it tells downstream business audits which platform to target, closing the loop between discovery and audit.

### Prompt suffix (`INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX`)
Updated to document the new output fields and rules:
- When a `=== GOLD STANDARD DISCOVERY BENCHMARK ===` block is present, populate `gold_standard_match`, `gold_standard_gate_results`, and `platform_analysis`
- When no gold standard block is present (degraded mode), omit all three entirely

### Tests
- `IntelligenceProfileService.gold-standard.test.ts` — 7 new tests for `discovery_benchmark` role (header label, platform scope line, directive text, field serialization, no cross-contamination with benchmark/discovery roles)
- `ResolvePrompt.test.ts` — 6 new tests for the composer path (gold standard injected when present, degraded note when absent, platform passed through, competitive focus, composer body preserved + gold standard appended)
- `IntelligenceDiscoverySchema.test.ts` — 14 new tests for per-candidate gold standard fields + `platform_analysis` section (valid, absent, null, wrong shape, missing required fields, passthrough)

### Downstream consumption (phase 2, documented but not built)
- Queue ingestion could map `outreach_recommendation.recommended_platform_focus` to the spawned business audit campaign's `intelligence_platform`
- Frontend discovery audit card renders the `platform_analysis` section with per-platform bars + outreach recommendation + "Meets Gold Standard" badge per candidate

## GBP Authorized Management Suite (Phases 0–4)

Spec: `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
Sprint plans: `docs/LocalBiz/GBP_SPRINT_PHASE0.md` through `GBP_SPRINT_PHASE4.md`
User guide: `docs/LocalBiz/GBP_USER_GUIDE_PHASE5.md`

A capability module (`gbp_management`) that converts Marketing Ops prospects into claimed, verified, paying tenants with full Google Business Profile management. Initial scope: emerging single-location businesses (multi-location path preserved in schema).

### Capability Keys (Migration 243)
- `gbp_ai_response` — AI review response (Tier A drafts + future Tier B autopilot)
- `gbp_posts_scheduler` — Scheduled post queue + lifecycle
- `gbp_directory_reviews` — Surface GBP reviews on public directory/place pages
- `gbp_directory_content` — Surface GBP posts + photos on public directory/place pages
- `gbp_management_flexible` — Flexible bundle key (auto-unlocks all four features above via resolver)

### Tier Assignment + BSaaS Catalog (Migration 244)
- `full_retail_visibility` tier has `gbp_management_flexible`
- 5 BSaaS catalog entries: 4 individual features + 1 flexible bundle (`gbp_management_flexible` at $49/mo, best value)
- Catalog visible at `/settings/admin/bsaas-catalog` and purchasable via Feature Store

### Merchant Gate Toggles (Migration 245)
- `tenant_gbp_options_settings` table — tenant-scoped soft gate
- `gbp_reviews_display` (default true) — controls whether entitled reviews surface on public pages
- `gbp_content_display` (default true) — controls whether entitled posts/photos surface on public pages
- Settings route: `apps/api/src/routes/gbp-options-settings.ts` (`GET/PUT /api/tenants/:tenantId/gbp-options`)
- PUT handler calls `invalidateEffectiveCapabilities(tenantId)` to clear in-memory + MV caches

### Two-Gate Architecture (R33 Compliant)
- **Hard gate (entitlement):** `gbp_directory_reviews` / `gbp_directory_content` / `gbp_ai_response` / `gbp_posts_scheduler` from tier, BSaaS, grants, or admin complimentary
- **Soft gate (merchant pref):** `gbp_reviews_display` / `gbp_content_display` from `tenant_gbp_options_settings`
- Resolver: `apps/api/src/services/resolvers/GbpManagementResolver.ts`
  - `can_show_reviews` / `can_show_content` / `can_use_ai_response` / `can_use_posts_scheduler` — hard gate only (R33: tier-level, never gated by merchant prefs)
  - `reviews_enabled` / `content_enabled` — effective state (hard AND soft gate)
- Wired into `EffectiveCapabilityResolver.ts` (both regular + MV paths) via `resolveGbpManagement()`
- Frontend mapping: `UnifiedCapabilityService.ts` → `mapGbpManagement()` → `GbpManagementState` in `CapabilityResolutionService.ts`
- `PlanSummaryWidget.tsx` includes GBP Management capability card

### Phase 1 — Claim & Verification
- Customer claim workflow via `mkt_customer_claim_tokens` (existing claim service)
- GBP verification: `apps/api/src/services/GBPVerificationService.ts` — fetch options, initiate, complete with PIN
- Customer routes: `apps/api/src/routes/gbp-customer.ts` — `GET /status`, `GET /verification/options`, `POST /verification/start`, `POST /verification/complete`
- Directory seed standing transition: `unclaimed` → `claimed` after claim + verification
- CRM alerts fired on successful conversion
- Frontend: `apps/web/src/app/account/marketing/gbp/page.tsx` — GBP dashboard with connection status, verification card, location details, aggregate rating

### Phase 2 — Review Intelligence & Tier A Reply Engine
- Hourly review ingestion: `apps/api/src/jobs/gbpReviewIngestion.ts` — fetches reviews, refreshes cached aggregate rating, applies sentiment tagging, fires CRM alerts
- Cached aggregate rating: `gbp_locations_list.cached_average_rating` + `cached_review_count`
- Rule-based sentiment: positive, negative, neutral, mixed
- Tier A AI draft replies: `apps/api/src/services/GBPReviewReplyService.ts` — 3 drafts per review with owner-voice + category-aware tone
- Entitlement-aware: drafts only generated when `gbp_ai_response` is entitled
- Review reply + dispute endpoints in `gbp-customer.ts`
- Review dispute intake: registry-driven via `mkt_dispute_intake` with `intake_kind`
- Frontend: `apps/web/src/app/account/marketing/gbp/reviews/page.tsx` — review inbox

### Phase 3 — Local Post Publisher & Media Manager
- Scheduled post publishing: `apps/api/src/jobs/gbpPostScheduler.ts` (every 15 min) — publishes SCHEDULED posts to Google
- Post lifecycle: DRAFT → SCHEDULED → PUBLISHING → PUBLISHED | FAILED
- Post CRUD customer routes in `gbp-customer.ts`
- Binary upload: `GBPAdvancedSync.uploadPhotoBinary()` for media upload
- Gold Standard photo benchmark: `IntelligenceProfileService.resolveGoldStandard()` → `expected_fields.platforms.google.expected_photo_count`
- Frontend: `apps/web/src/app/account/marketing/gbp/posts/` (composer, offer builder, post card) + `apps/web/src/app/account/marketing/gbp/media/` (uploader, gallery)

### Phase 4 — Public Surfacing & Monetization
- Public GBP endpoints: `apps/api/src/routes/directory-gbp-public.ts`
  - `GET /api/public/directory/:slug/gbp-reviews` — public reviews + aggregate rating
  - `GET /api/public/directory/:slug/gbp-posts` — published posts only
  - `GET /api/public/directory/:slug/gbp-photos` — active photos
  - All endpoints enforce both gates; return `{ enabled: false }` when either gate fails
  - Public field filtering: excludes sentiment, ai_drafts, reply_status, dispute_status, view_count, status, scheduled_for, post_name, tenant_id
- Surface-agnostic GBP components: `apps/web/src/components/gbp/`
  - `GbpReviewsSection.tsx` — aggregate rating badge + review list with owner replies
  - `GbpPostsSection.tsx` — post card grid (offers, events, standard)
  - `GbpPhotoGallerySection.tsx` — category-filtered photo gallery
  - All self-gating: render nothing when `{ enabled: false }`
- Directory integration: `apps/web/src/app/directory/[slug]/page.tsx` — all 4 layout variants (classic, editorial, immersive, premium)
- Place integration: `apps/web/src/app/place/[slug]/page.tsx` — editorial layout
- Upgrade funnels on GBP dashboard: AI review response + post scheduler upsells linking to `/settings/feature-store?feature=gbp_*`
- POS/GMC CTAs on GBP dashboard: link to `/settings/integration-options` (wires existing integration settings, no duplicate logic)

### Tests
- `apps/api/src/services/resolvers/GbpManagementResolver.test.ts` (7 tests) — disabled, flexible, individual features, both gates, defaults, flexible+merchant gate
- `apps/api/src/tests/directory-gbp-public-routes.test.ts` (7 tests) — 404, both gates pass, hard gate fail, soft gate fail, posts, photos, public field filtering
- `apps/api/src/tests/gbp-customer-routes.test.ts` (24 tests) — auth, context gating, cross-customer isolation, reviews, replies, posts, media
- `apps/api/src/tests/gbpPostScheduler.test.ts` (5 tests) — scheduler lifecycle
- `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts` (15 tests) — draft generation, reply publishing
- `apps/api/src/services/__tests__/GBPVerificationService.test.ts` (7 tests) — verification options, initiation, completion
- `apps/api/src/services/__tests__/CustomerGBPAccessService.test.ts` (8 tests) — customer GBP access resolution

### Key Files
- `apps/api/src/services/GBPAdvancedSync.ts` — GBP API wrapper (reviews, posts, media, locations)
- `apps/api/src/services/CustomerGBPAccessService.ts` — customer-to-GBP bridge resolution
- `apps/api/src/services/gbp/prompts.ts` — Tier A prompt construction (owner voice, category tone)
- `apps/api/src/jobs/gbpReviewIngestion.ts` — hourly review ingestion job
- `apps/api/src/jobs/gbpPostScheduler.ts` — scheduled post publisher (every 15 min)
- `apps/web/src/services/MarketingCustomerService.ts` — frontend service for all customer GBP endpoints
- `apps/web/src/components/customer/CustomerSidebar.tsx` — GBP nav items in customer sidebar

## Directory Claim Operator Approval Flow (Migration 246)

Closes the gap where `DirectoryClaimService.initiateClaim` returned `operatorApprovalRequired: true` but persisted nothing — the request was lost and operators had no review queue. Also fixes `computeContexts` so directory-claim owners get platform context (and thus see Marketing/GBP nav).

### Schema (Migration 246)
- `directory_claim_requests` — pending/approved/rejected claim requests with `seed_id`, `tenant_id`, `token_id`, `customer_id`, `customer_email`, `customer_name`, `status`, `rejection_reason`, `submitted_at`, `reviewed_at`, `reviewed_by`

### Backend
- `apps/api/src/services/DirectoryClaimService.ts`:
  - `initiateClaim` now persists a `directory_claim_requests` row (status='pending') when `operator_approval_required` is true (idempotent — returns existing pending request if one exists for the token)
  - Fires a platform-scoped CRM alert (`type='directory_claim_pending'`) so operators see it in their feed
  - `listClaimRequests({ status })` — admin review queue (joins seed + listing for business name, category, location)
  - `approveClaimRequest(requestId, adminUserId)` — consumes token, flips `org_standing_mode` to `independent`, promotes customer to platform user, updates request to 'approved'
  - `rejectClaimRequest(requestId, adminUserId, reason)` — revokes token, updates request to 'rejected'
- `apps/api/src/routes/directory-presence-public.ts` — `/initiate` now passes `customerEmail` + `customerName` from auth context to `initiateClaim`
- `apps/api/src/routes/directory-presence-admin.ts` — new routes:
  - `GET  /api/admin/directory-presence/claim-requests` — list (default: pending)
  - `POST /api/admin/directory-presence/claim-requests/:id/approve` — approve
  - `POST /api/admin/directory-presence/claim-requests/:id/reject` — reject
- `apps/api/src/services/CustomerAuthService.computeContexts` — now grants `platform: true` when the customer owns a claimed directory seed via three paths:
  1. `linked_user_id → user_tenants → directory_presence_seeds` (customer was promoted)
  2. `directory_claim_requests.customer_id` matches (customer_id was captured on initiate)
  3. `directory_claim_requests.customer_email` matches customer's email AND status='approved' (covers the case where `/initiate` ran before `optionalCustomerAuth` was added, so `customer_id` was null but email was stored)
- `apps/api/src/routes/directory-presence-public.ts` — `/initiate` and `/accept` now apply `optionalAuth` + `optionalCustomerAuth` middleware so `req.customer` is populated for authenticated owners (previously the public route didn't parse customer JWTs, so `customer_id` was never stored on claim requests)
- `apps/api/src/lib/id-generator.ts` — `generateDirectoryClaimRequestId(tenantId)` (`dcr-{tenantKey}-{nanoid12}`)

### Frontend
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — `listClaimRequests`, `approveClaimRequest`, `rejectClaimRequest` methods + `DirectoryClaimRequest` interface
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/page.tsx` — "Pending Claim Requests" section at the top of the seeds page with Approve/Reject buttons (only renders when there are pending requests)

## Owner Claim Verification (Migration 274)

Owner must confirm categories + attributes (a consent contract) before a directory claim can be initiated; accepted values mint as official listing data, unknown owner-typed labels are held for operator review (abuse gate).

### Schema (Migration 274)
- `directory_presence_seeds.owner_verified_at` / `owner_verification` (consent snapshot) / `owner_proposed_categories` (JSONB array of `{label, role, status, proposed_at, decided_at, decided_by}`)

### Backend
- `DirectoryClaimService.initiateClaim` — hard gate: returns `verification_required`/`ownerVerificationRequired` until `owner_verified_at` is set; `applyOwnerVerification` mints known categories + owner-authoritative attributes to the listing via `DirectoryPresenceSeedService.updateFields` with `source_name='owner_claim'` provenance, syncs `directory_settings_list`, stamps `category_fit='verified'` + consent record
- Abuse gate: labels not in `platform_categories ∪ mkt_service_categories_list` → `owner_proposed_categories` (pending), never the listing. `DirectoryPresenceSeedService.decideProposedCategory` (admin accept/reject) — accept registers into `mkt_service_categories_list` + mints to listing; last decision auto-resolves the Requests-Hub ticket
- `POST /api/admin/directory-presence/presence-seeds/:id/proposed-categories/decision` (platform-staff)
- `GET /api/public/directory/attribute-definitions` — public suggestion catalog for the owner picker

### Operator notifications — SOP
**Requests from public surfaces → Requests Hub.** `crm_alerts` is the *customer/tenant* notification feed (`tenant_id=<tenant>` = tenant CRM; `tenant_id='platform'` = marketing-customer portal with metadata read-time targeting — NOT an operator inbox; rows there also render in the broadcast-history page). For operator-facing work items, create a `crm_support_tickets` row: `tenant_id='platform'`, a `category` for grouping (`directory_claim` for claim flow), `inquiry_id` = the domain row id for linkage/auto-resolve, plus a `crm_ticket_messages` entry with a `button` block linking to the action page. For inbound "contact us" style requests (no triage decision needed), `crm_inquiries` rows land in the same Hub — `source` carries the origin tag (`public_form`, `customer_portal`, `help_desk_support`, `place_claim_request`, or a validated client `source_tag`). These surface in the Requests Hub (`/settings/admin/crm/requests`) + admin CRM dashboard stats + personal CRM assigned queue. Established precedents: claim requests (DirectoryClaimService), owner category proposals (same), place-page claim contact form + public-catalog inquiries + CCPA requests (`crm_inquiries`).

**Place-page claim contact form** (`/place/[slug]` → `PublicInquiryForm` → `POST /api/public/inquiries`): sends `source_tag='place_claim_request'` + `listing_id`; the route resolves listing→seed, appends a claim-context block (business, place URL, seed id, admin review link) to the inquiry body, and logs a `directory_seed_outreach_touches` row (`channel='form'`, `outcome='form_submitted'`) so the engagement shows on the seed detail's touch timeline.

**Directory intake surfaces → Requests Hub tickets** (public forms rendered on place/location/category pages via `AddBusinessCta`/`SuggestBusinessCta`):
- *Suggest a business* → `directory_presence_suggestions` (status `submitted`) + platform ticket `category='directory_suggestion'` `inquiry_id=suggestion.id`, auto-resolved when `updateStatus`/`approve` decides → queue at `/settings/admin/directory/suggestions`
  - Suggestion row actions: **Approve** (seed + claim link immediately), **Campaign** (business-scope `triage_management` campaign from NAP — audit-first, seed later), **Queue** / **Verify** (`addToQueue` `source_kind='public_suggestion'` → prospect-queue kanban `queued`/`verify_then_outreach`/`in_thread`/`hold`/`campaign_created`/`dismissed` with per-entry `logTouch` CRM activity + `next_touch_at` cadence — this is the "track communication before authorizing a seed" path; queue→campaign via `POST /prospect-queue/:id/create-campaign`)
  - Linkage: queue entries carry `business_snapshot.suggestion_id`; `listSuggestions` reverse-joins it → row shows an "in queue (status)" chip; `approve()` stamps `mkt_prospect_queue.seed_id` so the funnel reads suggestion → queue → campaign → seed
- **Contact consent (migration 275):** both intake forms carry an opt-in checkbox — `contact_consent` on `directory_presence_suggestions`, `owner_contact_consent` on `directory_presence_seeds` (survives the anonymous email-verify payload via `CreateSeedInput.ownerContactConsent`). `false`/absent = do not contact; the queue snapshot keeps the email in `submitter_email` but only routes it to `email` (outreach-usable) when consented. Surfaced on the suggestion detail modal, the intake ticket body, the touch note, and the seed detail owner block.
- *Add your business* → `directory_presence_seeds` draft (`seed_batch='owner-submitted'`, authenticated immediately / anonymous after email verify) + platform ticket `category='directory_owner_submission'` `inquiry_id=seed.id` + `form_submitted` touch on the seed timeline; auto-resolved by `publishSeed`/`deleteSeed` (via `resolveIntakeTickets`) → review at `/settings/admin/directory/presence-seeds/{seedId}`

### Frontend
- `/directory/claim/[token]` — `ClaimVerificationPanel` (valid state): category selector + create-new (flagged "sent for operator review"), attribute chips + suggestions + custom add, consent checkbox gating Claim. The valid state also offers a collapsed `DirectoryClaimListingEditor` (`includeCategories={false}` — the verification panel owns the category consent contract; a second category editor's save would be overwritten at claim submit) for optional pre-claim NAP/hours/slug/notes corrections via `PUT /claim/:token/listing` (token-gated, works pre-claim; name stays locked — corrections go through the reviewer notes field), plus a "What happens after you claim" bullet expectations block (OTP vs. operator review; free-forever listing + 5 free product slots promise linked back to `/place/about`; proof upload + further corrections live on the post-submit `pending_approval` screen — `POST /claim/:token/proof` requires a pending `directory_claim_requests` row, so it cannot run pre-submit).
- Seed detail page — "Owner Verification" section (consent stamp + per-proposal accept/reject); seeds list rows show an amber "N categories pending review" badge when `pendingOwnerProposals > 0`
- Tests: `DirectoryClaimService.ownerVerification.test.ts` (gate, mint, abuse-gate diversion, resend pass-through)





## Prospect Communications (prospect-scoped communication history)

Page: `/settings/admin/marketing-ops/communications` (`ProspectCommunicationsClient.tsx`) — picker → unified timeline, patterned after the openers/follow-ups workspaces. Deep-link: `?prospect=<queueEntryId>`.

- **Anchor = the queue entry.** `mkt_prospect_queue` is the prospect registry; it links the seed (pre-campaign) and the processed campaign (post-campaign). A campaign created straight from an audit card without ever entering the queue is NOT listed.
- **Aggregator:** `apps/api/src/services/ProspectCommunicationService.ts` (read-only). `listProspects()` → picker + rolled-up contact counts; `getTimeline(queueEntryId)` → merged events. Routes: `GET /api/admin/marketing-ops/prospects`, `GET /prospects/:id/timeline`.
- **Sources merged:** `directory_seed_outreach_touches` (by `seed_id`, pre-campaign) + `mkt_outreach_log` (by campaign, incl. siblings sharing `business_prospect_id`). Siblings fold into one conversation.
- **Channel normalization:** `normalizeChannel` maps `call`→`phone`, `visit`→`in_person`; everything else passes through. `raw_channel` preserves the stored value. Kept separate from `ProvingGroundCadenceService.CHANNEL_TO_OUTREACH` (that one collapses channels for the campaign-log taxonomy).
- **Card actions** mirror the PG promote panel: `queued` → Verify (`requestVerification`); `verify_then_outreach` → Resolve (`ResolveVerificationModal`); campaign present → Log contact (`LogContactModal`); pre-campaign seeded → Log touch (`logProspectTouch`).
- **`ResolveVerificationModal` prop is `VerificationEntryLike`,** a structural minimal shape (not `ProspectQueueEntry`) so non-queue surfaces can open it. `ProspectQueueEntry` still satisfies it.
- **Migration `295_directory_seed_outreach_touch_recording.sql`** — adds `recording_url`, `recording_duration_seconds` (+ CHECK ≥ 0), `recording_provider`, `recording_attached_at`, `recording_attached_by` to `directory_seed_outreach_touches` (pre-campaign call recordings). Additive/idempotent; guarded on migration 259. Campaign-side recordings already live in `mkt_outreach_log.call_details.recording_url`. Writers: `addOutreachTouch` (recording at log time), `attachTouchRecording` (attach later — `POST .../presence-seeds/:id/touches/:touchId/recording`). Apply to `local` + `prd`, then `pnpm prisma:generate`.
- **Business-hours journey (migration 296).** Opening hours pasted from the GBP listing in the resolve-verification modal travel **queue → campaign → seed listing**:
  1. Modal pastes/parses (`parseGoogleHoursPaste`) → `verifiedHours` on `resolveVerification`.
  2. Written to the queue snapshot as **both** `verified_nap.hours` (provenance) and flat `hours`.
  3. `createCampaignFromQueue` reads `verified_nap.hours ?? snapshot.hours` and passes `businessHours` to `deriveBusinessCampaign`/`createCampaign` → `mkt_campaigns_list.business_hours` (added by migration 296). The scan path applies it via `geoPatch.business_hours` post-derive.
  4. `DirectoryPresenceSeedService.createFromCampaign` reads `campaign.business_hours || audit.business_hours`; the queue→seed batch paths (`createSeedsFromBatch`, `createSeedsForProvingGround`) read `snapshot.hours || snapshot.verified_nap.hours`.
  5. `createSeed`/`updateSeed` write `directory_listings_list.business_hours` and sync `business_hours_list` (public hours endpoint).
  Canonical shape + parser live in **`apps/web/src/lib/business-hours.ts`** (shared by the seed detail page and the verification modal — do not re-inline the parser). Apply migration 296 to `local` + `prd`.
  **Editable at every leg via one component:** `apps/web/src/components/business-hours/BusinessHoursEditor.tsx` (timezone + GBP paste/parse + per-day grid). Mounted on the seed detail page (refactored to it), the campaign create/edit form (`CampaignFormClient`, `business_hours` field), and the prospect card on the communications page (queue leg). Queue writes go through `PATCH /prospect-queue/:id` `hours` (null clears) and merge into `business_snapshot.hours` + `verified_nap.hours`; hours are treated as identity enrichment, so they stay editable on `hold`/`in_thread` rows but not after graduation. Campaign writes go through the campaign create/update body `business_hours` (null clears via `Prisma.DbNull`).
- Tests: `ProspectCommunicationService.test.ts`, `DirectoryPresenceSeedService.outreachTouchRecording.test.ts`, `DirectoryPresenceSeedService.businessHours.test.ts`, hours cases in `MarketingProspectQueueService.test.ts`.

## Proving Ground Campaigns (Migration 262)

Spec: `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` � Sprint plan: `docs/LocalBiz/proving_ground_sprint_plan.md`

A proving ground is a `scope=city` + `campaign_category=proving_ground` aggregate campaign � the operator workspace for a city/category launch. One active PG per city/category signature (structural-duplicate guardrail).

Backend:
- `apps/api/src/services/ProvingGroundCadenceService.ts` � the authoritative signal->wait table (spec section 4.7): logTouch() writes the canonical touch on the seed (`directory_seed_outreach_touches`), advances the channel ladder, stamps `next_touch_at`, enforces the 3-consuming-touches/30d cap (hold +60d), exits to `in_thread` on live contact. Dead-channel signals (`bad_number`, `bounce`) do NOT consume a slot. Write-through keeps the seed outreach_state machine in sync; mirrors to `mkt_outreach_log` once `processed_campaign_id` exists.
- `apps/api/src/services/ProvingGroundDedupService.ts` � group-keyed identity ledger (`mkt_prospect_dedup_verdicts`); `same_entity` merges identity into the survivor seed's `name_variants`; `getCohortFunnel` excludes resolved groups (duplicateSeedCount = unannotated only).
- `DirectoryPresenceSeedService.createSeedsForProvingGround` � preflight seeding: seed+publish+link to source intelligence campaign+claim token+`queue.seed_id`; leaves status `queued` (seeding is the START of outreach, not graduation).
- `PlaybookChecklistService.resolveEffectivePlaybook` � PG campaigns resolve PG-01 directly by catalog code (no triage row required; aggregate campaigns never triage). `CampaignTriageService` excludes `proving_ground`-category playbooks from candidates.
- Routes: `POST /api/admin/marketing-ops/prospect-queue/:id/log-touch`; `POST/DELETE /:campaignId/children[/:childId]`; `POST /:campaignId/promote-to-proving-ground` (one-action create-or-merge: creates the city-scope PG parent or reuses the existing active PG for the same city+category, then attaches the source + `mergeCampaignIds`); `POST /:id/gap-log` (append-only mid-run gap entries); `PATCH /prospect-queue/:id` accepts `account_family` (family-only patches also allowed on `hold`/`in_thread` rows — identity, not cadence); `POST /api/admin/directory-presence/presence-seeds/proving-ground-seed`; `POST/GET .../dedup-verdicts`; `GET /prospect-queue?source_campaign_ids=a,b,c` (tree filter).
- `MarketingCampaignService.promoteToProvingGround` — flips an unparented intelligence campaign into a PG tree. Guards: `source_not_intelligence_scope` (400), `source_already_parented` (409). Per-child attach failures collect in `skipped` rather than aborting.
- `BaseService.handleError` passes `HttpError` subclasses through unchanged � do not wrap/re-create; guards must surface their real status codes (409/404).

Seed script: `doppler run --config local -- pnpm seed:proving-ground-preflight` (idempotent; requires migration 262's CHECK extension first). Re-run for `prd` after edits.

Frontend:
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/proving-grounds/[id]/` � cockpit (gates, tree funnel, preflight checklist embed, dedup panel, children attach/detach, due-today, gap log).
- `ProspectQueueClient` � `in_thread`/`hold` tabs, next_touch_at due badges, channel-ladder chips (dead rungs struck through), Log-outcome modal.
- Creation paths (all produce the same `scope=city` + `proving_ground` signature):
  - New Campaign form: `proving_ground` is always in the Campaign Category dropdown; selecting it coerces scope → `city` (category is the primary selector). Proving Grounds index "+ New Campaign" deep-links `?scope=city&campaignCategory=proving_ground`. Post-create redirect goes to the cockpit.
  - Campaign detail (intelligence, unparented): "Proving Ground" header button → promote modal (title/category/city/state pre-filled + same-market merge checkboxes). Attached campaigns show a "View Proving Ground" link instead.
  - Intelligence Profiles → Non-Business table: per-row flask action = one-click promote/merge; PG rows get a filled flask jumping to the cockpit.
- Client: `MarketingOpsService.logProspectTouch` / `attachProvingGroundChild` / `detachProvingGroundChild` / `promoteToProvingGround` / `getCampaignChildren`; `DirectoryPresenceAdminService.provingGroundSeed` / `recordDedupVerdict` / `listDedupVerdicts`.

Tests: `provingGround.test.ts` (guardrail + attach/detach + gap log + account_family), `provingGroundCadence.test.ts` (cadence map, cap, write-through, verdicts), PG-01 cases in `PlaybookChecklistService.test.ts`, verdict-exclusion cases in `SeedFunnelAnalyticsService.getCohortFunnel.test.ts`.

## Intelligence Coverage Map — 7-State Slot Model

Page: `/settings/admin/marketing-ops/coverage` (`CoverageClient.tsx`). Backend: `IntelligenceProfileService.getCoverage()`; route `GET /api/admin/marketing-ops/intelligence-profiles/coverage`.

Every slot position (gold standards: platform, nationwide; emerging/competitive: city) carries TWO orthogonal state dimensions — the UI renders two stacked chips per position (establishment on top, discovery on the bottom):

- **Establishment** `slot.status`: `pending` (nothing) → `inflight` (establishment campaign, no profile yet — `profile_id` holds the campaign id) → `draft` (draft profile) → `active` (active profile). Actions: create campaign → open campaign → activate profile → discovery unlocked below.
- **Discovery** `slot.discovery_status` + `discovery_campaign_id`: `pending` → `inflight` → `executed`. A discovery campaign is **executed** when it has ≥1 `mkt_prompt_executions_list` row with `status='completed'` OR ≥1 `mkt_audits_list` row (gold_standard_scan / intelligence_discovery imports). Actions: create campaign → open campaign → open audit (`?tab=audits`).

Key rules (regression history — do not reintroduce):
- The discovery dimension is tracked **per campaign kind, independent of establishment** — discovery campaigns never flip the establishment status and never create an `inflight` establishment slot. The old model conflated them (an executed discovery rendered "green + in-flight arrow" forever).
- Discovery campaigns attach to the slot covering their position (any establishment status); when none exists (e.g. gold-standards platform scan with no platform profile — platform slots reuse the All Platforms establishment by design) a `pending` slot is created to host the discovery state. An establishment campaign arriving later **upgrades** a pending slot rather than pushing a second one. Newest discovery campaign wins (campaigns arrive `created_at desc`).
- Terminal stages (`lost`, `dead`, `closed`, `resolved_and_closed`) are excluded from both dimensions.
- The old `status: 'discovered'` value is gone — replaced by `status: 'pending'` + `discovery_status: 'executed'`.
- Frontend: the discovery chip stays **locked** (lock icon, not clickable) until the establishment chip is active — except gold standards, where the **All Platforms** establishment also unlocks per-platform discovery (proxy establishment — mirrors `resolveGoldStandard`'s platform fallback chain). "All Platforms" is always the first chip in the gold row.

Tests: `apps/api/src/services/__tests__/IntelligenceProfileService.coverage.test.ts` (15 tests — all 7 states, gold platform slots, newest-wins, pending-slot upgrade, terminal exclusion, PG slot shape).

## National Location Row — Sync Contract (shipped 2026-09-22)

The `('__location__','__all__','__all__')` row in `directory_category_enrichment` is **derived state** over every covered market: `getNationalCoverage()` measures `directory_listings_list`, `getNationalCategoryEnrichments()` reads all `(category,'__all__','__all__')` packets. It refreshes on two triggers:

- **National category apply** — `CategoryMarketEnrichmentService.applyEnrichmentPacket`'s `else` (national) branch calls `enrichLocation('__all__','__all__')`, mirroring the city cascade. `enrichMarket` bails on the sentinel (`invalid_market`) — national category rows are campaign-lane only.
- **Every PG shelf sweep** — `ProvingGroundShelfSweepService` calls it unconditionally after the per-city location pass (`triggerSource='pg_sweep'`); reported as `nationalLocation` on `ShelfSweepReport`, NOT inside `locationMarkets` (that array is per-city first-fill only). This covers listing-driven coverage drift that category deploys don't.

**Preserve contract (differs from city rows):** `enrichNational` keeps the campaign row's head copy when `composer_version=2` (meta_title / description / keywords / secondary_categories / schema_type_hint) and only refreshes `context.national_coverage`. City `enrichLocation` overwrites head fields deterministically on every sync — do NOT copy that behavior into the national path; the composer cannot write national coverage narrative, so the campaign packet is the only good source of head copy.

**What sync does NOT refresh:** the AI narrative fields (`body_copy`, `shopper_guide`, `faq`, `area_breakdown`, `context.market_gaps` / `metro_dynamics` / `top_categories`) go stale as coverage shape changes — they only update on a `__location__`/`__all__` campaign re-run. Open follow-up: staleness signal comparing stamped `context.national_coverage` vs live `getNationalCoverage()` on the Coverage surface. Also open (sprint plan Phase C.3): the `profile_activated` hook still requires non-null `reference_city`, so national profile activation produces no national packet.

Tests: `directoryEnrichment.apply.category.test.ts` (national resync call), `directoryEnrichment.apply.location.test.ts` (campaign-copy preservation + baseline write), `ProvingGroundShelfSweep.test.ts` (national refresh + error isolation).
