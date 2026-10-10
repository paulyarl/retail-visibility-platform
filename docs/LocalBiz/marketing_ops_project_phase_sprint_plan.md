# Marketing Ops — Project Phase Plan Sprint Plan

> Companion to `marketing_ops_project_phase_spec.md` (v6). Delivers the project phase plan end-to-end: the A1/A3 signal fixes it depends on, seed-fidelity persistence, the versioned predicate substrate, the pure `selectProjectPhases` evaluator with lane confidence, the read-only plan endpoint, the operator Plan cockpit, and the owner-facing gallery project view behind a flag.
>
> Ordering follows spec §17. The plan layer is computed-on-read and owns nothing — every phase below leaves sibling pipelines, triage outcomes, and the seed lifecycle untouched.

---

## Decisions — settled

| # | Decision | Outcome |
|---|---|---|
| D1 | A1 materiality thresholds | **Settled:** rate ≥ 25% **and** count ≥ 5, both required, both OR-branches. The derived `RA_*_BACKLOG` thresholds get the same materiality treatment via the shared helper. Recorded in spec §10/§16. |
| D2 | Owner-requested domain trigger | **Settled:** a structured campaign field, read via `operatorInputs.domainRequested`. Migration detail for the field lands with Phase 3. |
| D3 | Owner-facing copy approval | **Settled:** automated gate only (`runProjectPhaseGate`); the operator reviews on the Plan panel before sharing. |
| D4 | `tier_3` visibility | **Settled:** shown, capped at two phases. |
| D5 | `seed_fidelity` recompute | **Settled:** publish-time verdict is authoritative for public surfaces; lazy refresh at plan resolution when the source audit is newer. |
| D6 | `misaligned` seed | **Settled:** degrade to `#claim-inquiry` on every claim surface — never a token flow. |
| D7 | Cap protection | **Settled:** skip-protected rule — dependencies of retained phases are skipped, dependents trimmed last; cap never exceeded. |
| D8 | `mkt_project_phase_predicates` shape | Proposed: `id`, `phase_key`, `predicate_version`, `signals jsonb` (any_of), `min_severity jsonb` (per-signal floors, nullable), `int_rank_modifiers jsonb`, `copy_keys jsonb`, `seed_version text`, `updated_at`. Unique `(phase_key, predicate_version)`. Confirm at migration time. |
| D9 | Domain cost ownership | **Open** — business/finance question outside spec scope (spec §16.8). Does not block any phase below. |

---

## Phase 0 — Pre-flight

| # | Task | Files | Notes |
|---|---|---|---|
| 0.1 | D1–D7 are settled (recorded in spec §16 and this table). Confirm D8's table shape at migration time; D9 stays open but blocks nothing. | — | The spec's decisions are the sprint's contract — don't code around them. |
| 0.2 | Verify the subdomain capability wiring landed (spec §7 note says "in progress"). If not, Phase 8 proceeds but Findability renders `blocked` — acceptable, that's the designed behavior. | `CapabilityResolutionService.ts`, `/t/[tenantId]/settings/subdomain` | External dependency, not a sprint task. |
| 0.3 | Survey every surface emitting a claim CTA and list where `seed_fidelity` must be consulted: `/place/[slug]` claim entry, `outreach-link-vars.ts` merge vars, QR kits (`ClaimInviteQrKitService`), seed-report pages. | `PlaceEntryEditorialLayout.tsx`, `outreach-link-vars.ts`, `ClaimInviteQrKitService.ts`, seed-report pages | D6 depends on this inventory being complete — a surface missed here keeps inviting claims on misaligned seeds. |

## Phase 1 — Selector prerequisite fixes (spec §10)

| # | Task | Files | Notes |
|---|---|---|---|
| 1.1 | Shared material-variance helper: normalize name variants (case, punctuation, legal suffixes — "Inc"/"LLC"); `unable_to_verify` never counts as inconsistency; phone/address differences are always material. Prefer consuming `material_issues` where populated. | new helper in `apps/api/src/services/triage/` or `outreach-openers/` | One helper, three consumers (1.2, 1.3, §6 fidelity). Export for the seed-fidelity comparator in Phase 2. |
| 1.2 | A1 fix: fire only when unanswered rate ≥ 25% **and** unanswered count ≥ 5 in `selectArchetype` — both OR-branches. | `archetype-selection.ts` (~lines 181-183) | Plan triggers don't depend on A1, but the opener fallback path does. |
| 1.3 | A3 fix in `selectArchetype`: `material_issues`/helper-based name-variance instead of `name_variations.length > 0`. | `archetype-selection.ts` (~lines 206-212) | |
| 1.4 | Same fix in `deriveSignals` — `CP_NAP_NAME_DRIFT` must not emit on `name_variations.length > 0` alone. | `signal-extractor.ts` (~line 595) | The derived path is the partial lane's signal source — this fix is load-bearing for plan correctness. |
| 1.5 | Regression tests on generic fixtures: mostly-answered reviews → no A1; formatting-only name variants → no A3/`CP_NAP_NAME_DRIFT`; `unable_to_verify` → neither. | `archetype-selection` + `signal-extractor` test files | Generic fixtures, not business-specific (spec §14). |

## Phase 2 — Seed fidelity (spec §4/§6/§13)

| # | Task | Files | Notes |
|---|---|---|---|
| 2.1 | Migration: `seed_fidelity` column on `directory_presence_seeds` (`'aligned'\|'thin'\|'misaligned'\|'unknown'`, default `'unknown'`). | `database/migrations/` + `pnpm prisma:generate` | Seed-side schema change — explicitly not "plan persistence" (spec §17.3). |
| 2.2 | Fidelity comparator: live seed material fields vs audit canonical footprint using the Phase 1.1 helper; NAP-verification data from the seed's verification flow is authoritative when present. | `DirectoryPresenceSeedService.ts` or a new `seed-fidelity.ts` | Same material-variance rule as 1.1 — formatting differences are not misalignment. |
| 2.3 | Write the verdict at publish and on the lazy refresh path — recompute when `sourceAuditId` is newer than the stored verdict. | seed publish flow + plan-resolution read | Publish-time verdict is what public surfaces consult. |
| 2.4 | CTA degradation: every surface from 0.3 consults `seed_fidelity`; `misaligned` routes to `#claim-inquiry` instead of the token/claim flow. | surfaces from Phase 0.3 | The plan's own CTA suppression (Phase 8) rides on top of this — not instead of it. |

## Phase 3 — Predicate substrate (spec §5/§13)

| # | Task | Files | Notes |
|---|---|---|---|
| 3.1 | Migration: `mkt_project_phase_predicates` per D8. | `database/migrations/` + `pnpm prisma:generate` | |
| 3.2 | `seed-project-phase-predicates.ts` + `PROJECT_PHASE_PREDICATES_VERSION`: seed v1 rows verbatim from the spec §5 trigger table — five `any_of` rows, the explicit-unmapped list as a coverage allowlist, the `INT_*` rank-modifier map, and per-phase copy keys. `SEED_VERSION_MARKER` idempotent pattern per existing seed scripts. | `apps/api/src/scripts/seed-project-phase-predicates.ts` (new) | The spec table is the initial seed contents — transcribe, don't reinterpret. |
| 3.3 | Coverage invariant: every `KNOWN_SIGNAL_CODES` entry is either referenced by a predicate row or in the explicit unmapped list — a check (test + optional seed-script assertion), not a runtime gate. | `signal-taxonomy.ts` consumer | Fails the build/tests, not production plans. |

## Phase 4 — Plan evaluator (`project-phases.ts`)

| # | Task | Files | Notes |
|---|---|---|---|
| 4.1 | Types + constants: `ProjectPhaseKey`, `PhaseStatus`, `PhaseExitPredicate`, `ProjectPhaseInput`, `ProjectPhase`, `ProjectPhasePlan`, `ACTIVE_STAGES`, `TERMINAL_COMPLETE_STAGES` per spec §8/§12. Export from `outreach-openers/index.ts`. | `apps/api/src/services/outreach-openers/project-phases.ts` (new) | Pure module — no I/O anywhere in this file. |
| 4.2 | `resolveProspectSignals(campaignId/prospectId)`: full lane = `extractSignals` on primary's latest real `business_analysis` (`getLatestAuditData` sibling fallback); partial lane = latest stub `detected_signals` + derive tier on cat-id `digital_footprint`; operator-input BBB union (always `full` provenance); persisted-snapshot fallback with lane inheritance; `discoverySignals` from scan/`discovery_signal_map`. Returns `{signals, signalLanes, lane, sourceAuditId, discoverySignals}`. | `project-phases.ts` or `services/triage/` | The only I/O in the plan path lives here and in the endpoint — keep the evaluator pure. |
| 4.3 | `selectProjectPhases` core: load predicate rows at `predicateSeedVersion` → evaluate `any_of` + `min_severity` floors → per-phase confidence from `signalLanes` → severity via `computeSignalSeverity` → sibling attribution via playbook `matchingRules` pools → caps with dependency protection → status derivation → exit predicates. | `project-phases.ts` | `INT_*` adjusts cap rank only when the audit-derived signal for the same gap exists. |
| 4.4 | Seed-claim resolution: primary sibling's live seed via `DirectorySeedCampaignLinkService`; `dps.status`, `seed_fidelity`, `placeUrl`, and `claimUrl` via the **read-only** order (`/c/{short_code}` → active token → `placeUrl`). Never `getClaimInviteKitMeta`/`resolveClaimInviteKit` (lazy `ensureClaimShortCode` write). | `project-phases.ts` + `directory_claim_tokens` lookup | Spec §13 prohibits the kit resolvers in the plan path — assert it in review. |
| 4.5 | Unit tests: every trigger set, every cap + protection interaction, every capability state, lane/provenance matrix, `INT_*` rank-only, `min_severity` floors, attribution pools, status derivation (incl. `lost`/`dead`), cycle increment, exit predicates, read-only claim resolution (no token mint/short-code backfill). | `project-phases.test.ts` (new) | Spec §14 matrix — generic full-lane + one partial-lane stub fixture. |

## Phase 5 — Owner-facing copy + quality gate

| # | Task | Files | Notes |
|---|---|---|---|
| 5.1 | Phase prompt templates — one per phase, fixed anatomy (goal, evidence, actions, exit criterion), following `archetype-prompts.ts`. Copy keys resolve from the predicate row's `copy_keys`. | `project-phases.ts` or a `project-phase-prompts.ts` sibling | Owner copy never names signals/archetypes/tiers/price — spec §9 forbidden list is the gate's job, but templates shouldn't produce it either. |
| 5.2 | Phase evidence extractor — reuse common field extractors; emit `{campaignId, field, value, signalCode}` rows. | `field-extractors.ts` + new phase extractor | Verbatim review quotes pass through attributed and unedited — the gate exempts them. |
| 5.3 | `runProjectPhaseGate` per spec §11: forbidden terms (narrative only, quote exemption), single-seed rule, misaligned-seed CTA suppression, verified-phase evidence requirement, no `suggested` phase in owner projection. | `quality-gate.ts` pattern | Gate tests in 4.5's suite. |

## Phase 6 — Plan endpoint (spec §13)

| # | Task | Files | Notes |
|---|---|---|---|
| 6.1 | `GET /api/admin/marketing-ops/prospects/:prospectId/project-plan` — resolves siblings + audit via `BusinessProspectService`/`getLatestAuditData`, calls 4.2 + 4.3 + 4.4, returns the internal plan. `?campaignId=` fallback treats a null-prospect campaign as a singleton group (that campaign is primary). Empty/unknown prospect → **200** with all-`not_triggered`, never 404. No writes — no `initializeProspectFromCampaign`, no token minting. | `apps/api/src/routes/marketing-ops.ts` + thin service wrapper | Route stays thin: gather inputs, call pure evaluator, serialize. |
| 6.2 | Lifecycle-semantics tests (spec §13 Plan lifecycle): first-read materialization with no initialization write; dissolved/empty prospect → 200 all-`not_triggered`; membership, stage, audit, and seed changes visible on the next read (no stale state); a zero-write assertion on the endpoint path. | endpoint test suite | The plan owns nothing — these tests guard the non-destructive contract. |

## Phase 7 — Operator Plan cockpit + prospect awareness (spec §13)

| # | Task | Files | Notes |
|---|---|---|---|
| 7.1 | `MarketingOpsService` types + `getProjectPlan(prospectId)` fetch. | `apps/web/src/services/MarketingOpsService.ts` | Mirror the API contract types; internal plan (all five phases + internals). |
| 7.2 | `PlanCockpitPanel` component: header band (tier, cycle, lane, predicate version, source-audit link, gate badge), wedge card (seed status, fidelity badge, claim URL + copy, CTA counts), public-surfaces strip (7.5), phase board (all five rows — status/confidence/severity/signal/suppression chips, dependency markers, sibling links, collapsed suppressed rows), drill-down evidence popovers, prior-cycle history. | `apps/web/src/components/marketing-ops/PlanCockpitPanel.tsx` (new) | Cockpit conventions: chips carry state, every chip is a link, collapsed regions show counts. |
| 7.3 | Mount the panel on **every** sibling's campaign detail beside the Siblings tab — resolve the plan by the viewed campaign's `business_prospect_id` (`?campaignId=` fallback for null-prospect singletons), so all members render the same cockpit. `#plan` hash selects the panel (cockpit hash-tab pattern). | `CampaignDetailClient.tsx` | One cockpit per prospect group — it is not a per-campaign artifact. Read-only surface — actions link out to owning surfaces. |
| 7.4 | **Bidirectional awareness wiring.** (a) Prospect-family strip on the cockpit: every sibling under the `business_prospect_id` with stage chip + campaign-detail link — the full family, not just `contributingCampaignIds` (reuse the SiblingsTab dataset). (b) Sibling→cockpit entry: a "Project plan" link/chip in each sibling's campaign-detail context area navigating to `#plan`, so every member's awareness of the shared cockpit is one click. | `PlanCockpitPanel.tsx`, `CampaignDetailClient.tsx`, SiblingsTab data source | The awareness is navigation on the existing `business_prospect_id` join — no new entity, no new state. |
| 7.5 | **Public-surfaces assembly + strip.** The endpoint wrapper gathers each sibling's linked seeds via `DirectorySeedCampaignLinkService` (status, `placeUrl`, `seed_fidelity` when known) and the demo storefront URL from `demo_tenant_id` (`{tenant-slug}.visibleshelf.com`); the panel renders the `publicSurfaces` strip — `suppressed` seeds show as retired history, not live surfaces. | route/service wrapper + `PlanCockpitPanel.tsx` | Read-only links out to the public surface or its admin — no new state. |
| 7.6 | Render tests via the `renderToStaticMarkup` pattern (`.test.ts`, `MantineProvider`, `initialTab`-style props for collapsed panels). | `PlanCockpitPanel.test.ts` (new) | Assert board row order, badge presence, collapsed-region counts, family-strip membership (non-contributing siblings included), surfaces-strip entries (seed + demo links, suppressed-as-history). |

**Deferred:** the dedicated prospect route (`/settings/admin/marketing-ops/prospects/[id]`, mirroring `proving-grounds/[id]`) — the endpoint is already prospect-keyed, so promoting the cockpit to a standalone dossier page is a UI placement change, not a contract change. Track it when the surface outgrows a panel.

## Phase 8 — Gallery project view (spec §9/§13)

| # | Task | Files | Notes |
|---|---|---|---|
| 8.1 | `GalleryMultiService` attaches the owner-facing projection (suppressed + `suggested` removed, internals stripped). | `apps/api/src/services/marketing/GalleryMultiService.ts` | Same plan object as the cockpit — curated twin, never a separate computation. |
| 8.2 | `MultiGalleryPage` project view above the sibling accordion: plan header + visible phases + one plan-level CTA (seed claim → earliest incomplete verified phase → pricing fallback). CTA precedence: plan > sibling CTAs > "View Pricing". | `MultiGalleryPage.tsx` | Claim CTA suppressed on `misaligned` fidelity — surfaces already degrade via Phase 2.4. |
| 8.3 | Feature flag the project view. | gallery env/flag plumbing | Flag off = today's gallery unchanged. |
| 8.4 | Plan-CTA gallery event with a plan-level identifier alongside `siblingCampaignId`. | `GalleryMultiService` event write | Wedge claim-rate must be measurable separately from sibling CTA clicks. |

## Phase 9 — Verification & rollout

1. `pnpm checkapi` **and** `pnpm checkweb` (new types on both sides).
2. `cd apps/api && npx vitest run` on the new/changed suites (project-phases, signal-extractor, archetype-selection, marketing-audits); `cd apps/web && npx vitest run` for the panel tests.
3. Run migrations + predicate seed on **local**, then **prd**:
   ```powershell
   doppler run --config local -- npx tsx src/scripts/seed-project-phase-predicates.ts
   # repeat with --config prd
   ```
4. Operator review on **two live prospects** (spec §17.6): one full-lane multi-sibling prospect, one partial-lane emerging-pool prospect — verify the board, the wedge, and the owner projection against each.
5. Enable the gallery flag after the review signs off.

---

## Verification findings

- Format follows `TRIAGE_REPAIR_OUTREACH_PROBLEMS_SPRINT_PLAN.md` (decisions table, `# | Task | Files | Notes` tables, verification phase, dual-config seed runs).
- Spec anchors: §5 (predicates, coverage, caps), §6 (fidelity), §8 (stage sets, status, exits), §9 (owner rules), §10 (A1/A3 fixes), §11 (gate), §12 (contract), §13 (integration + Plan cockpit), §14 (tests), §16 (open questions → D-table), §17 (rollout → phase order).
- Code anchors confirmed during spec review: `signal-extractor.ts` (pure `extractSignals`, derived-path NAP bug ~595), `archetype-selection.ts` (A1 ~181-183, A3 ~206-212), `BusinessContextService.getLatestAuditData` (non-stub + sibling fallback), `STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES` (`lib/marketing-audits.ts:23`), `signal-magnitude.ts` (`computeSignalSeverity`, `SEVERITY_RANK`), `SEED_VERSION_MARKER` pattern, `ProvingGroundCockpitClient` (layout conventions).
