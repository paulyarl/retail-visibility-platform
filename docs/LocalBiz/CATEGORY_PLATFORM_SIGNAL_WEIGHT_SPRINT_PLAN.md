# Category Platform Signal Weight — Sprint Plan

> Sequences `CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC.md` into shippable phases against the **verified** state of the codebase (verification pass 2026-09-18). The spec defines the model; this plan defines the order, the touch-points, and the guards.

**Status:** Draft
**Owner:** TBD
**Spec:** `docs/LocalBiz/CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC.md`

---

## §1 Verified baseline

What the verification pass confirmed, and what it found missing.

**Exists (reuse):**

| asset | where |
|---|---|
| Profile body in JSONB → no migration for new profile fields | `mkt_intelligence_profiles.configuration_json` |
| Nationwide home = `reference_city IS NULL`; platform scoping + fallback chains | `IntelligenceProfileService.resolve` / `resolveGoldStandard` |
| DRAFT → activate → version flow | `importAsDraft` / `activateDraft` / `publishVersion` |
| Render-control coverage gate | `applyRenderControlCoverageGate`, `MIN_RENDER_CONTROL_COVERAGE_FOR_TIER = 0.5` |
| Claim invite + `contactable → invited → claimed` funnel | `sendClaimInvite`, `SeedFunnelAnalyticsService` |
| Owner testimony precedent (overrides operational) | `callConfirmed` in `scoreOperational` |
| Dimension vocabulary (semantically aligned) | the 11 `INT_*` codes |
| The guarded lane | Identity tab **Push draft seed** (PG cockpit Push is a likely second consumer) |

**Missing / defects (build):**

| id | finding |
|---|---|
| F1 | The Push guard is **client-side only** — `createFromCampaign` evaluates no identity gate |
| F2 | No authority-class vocabulary; `specialized_sources.type` is free-form and has no `government` |
| F3 | No dimension scoring, no 2-of-4 gate |
| F4 | `IdentityPacketService` has no profile/category context — no signal-weight injection point |
| F5 | Render-control gate is unweighted; `DS_MISSING_PROFILE` uses a hardcoded `primaryPlatforms` set |
| F6 | A new `INT_*` code touches three places (registry seed + two hardcoded label maps) |
| F7 | Reachability maps to the existing `contactable` stage |
| F8 | Owner over-rule has a precedent (`callConfirmed`) to extend |

## §2 Decisions to settle before Phase 1

1. **Authority-class values** — confirm `directory | social | government | trade | community` (+ `owner`), and their mapping onto the existing `inferSourceTier` tiers.
2. **Guarded-entry shape** — a new guarded endpoint/workflow for the Push, vs. the campaign stage transition. (Spec §6: Identity tab is the current reality; placement is debatable.)
3. **Initial `τ` / `τ_gap`** — provisional values; calibration deferred (spec §10).

## §3 Phases

**Progress:** Phase 1 ✅ (authority classes → dimensions; NAP corroborators + drift) · Phase 2 ✅ (operator evidence first-class) · Phase 3 ✅ (dimension gate + owner axis) · Phase 4 ✅ (server-side guarded lane) · Phase 5 ✅ (signal weight — derivation, resolution, consumption) · Phase 6 ✅ (render-control alignment) · Phase 7 ✅ (divergence signal seeded on local + prd, pitch framing, gate UI).

**Gate constants (provisional):** `EARN_DIMENSION_COUNT = 2`, `GUARANTEE_STRENGTH_THRESHOLD = 2` — the single number to calibrate (spec §10). Strength = **dimension strength** (tier-weighted presence/citations per dimension) + **supporting strength** (proven recent activity via the operational recency axis). The threshold is *depth-or-breadth*: a single high-signal platform presence (e.g. Google = 2) guarantees on its own, with no second dimension and no activity; recency is supporting strength, not a prerequisite.

**Off-plan (shipped alongside):** campaign-scoped record verification — `MarketingCampaignService.resolveCampaignVerification` + `POST /:id/resolve-verification` + `ResolveVerificationModal` campaign mode + the Identity tab "Verify record" button. Reuses the queue modal rather than a parallel one; writes the campaign's canonical NAP and records an attributed owner-evidence capture.

### Phase 1 — Authority classes → evidence dimensions *(foundation)*

**Goal:** a source's authority class determines the dimension it may testify on.

- Define the authority-class vocabulary and the `class → dimension` map (`directory, social → operational`; `government → identity`; `trade → category`; `community → location`; `owner → above`).
- Map onto `inferSourceTier` (authoritative ≈ government, first_party ≈ owner, aggregators ≈ directory/social) so existing inference feeds the new classes.
- Scope every conflict to its dimension in `identityScoring`.
- ~~Extend `mkt_identity_evidence` with the authority class (CHECK-constrained migration).~~ **Decided: inferred only** — `inferAuthorityClass(name, tier)` derives the class; no column, no migration. A stored class remains the follow-up if operators need to correct a misinference.

**Done:** a source carries a class (inferred); conflicts are dimension-scoped; directory/social disagreement on NAP surfaces as `nap_drift_<field>` (reportable), never a veto.

### Phase 2 — Operator evidence is first-class

**Goal:** "Add evidence" can actually unblock.

- Remove the `agrees: true` hardcode in `IdentityPacketService.assembleIdentityPacket` step 6.
- Operator rows carry authority (class, tier, evidence state, who/when) and can adjudicate a conflict within a dimension.
- Surface the operator's authority in the packet DTO.

**Done:** an operator-entered source can clear a veto / raise a dimension; regression test asserts the old add-only behavior is gone.

### Phase 3 — Dimension gate + owner axis

**Goal:** replace the binary veto with the dimension threshold.

- Replace `collectVetoes`/band with the dimension gate: **2 of 4 earns** (breadth); the strength threshold **guarantees** — *depth or breadth*, so a single high-signal platform presence seeds without a second dimension.
- Strength = dimension strength (presence + citations) + supporting strength (proven recent activity — reviews / ratings / recent comments / secondary citations via the operational recency axis). Presence alone is sufficient; third-party sources count even when not category-recognizable.
- Operational density weighting (social/directory count × signal weight).
- **Owner fifth axis:** over-rule path — recorded `owner_confirmed` testimony (who/when), logged as the unblocking axis, connected-contact gated (§20.4). Extends the `callConfirmed` precedent. *Rescue only*: it applies when the prospect is short of earning — never over a hard veto, never needed once guaranteed/earned.
- **Legacy byte-identity:** no resolvable profile → today's scoring, unchanged.

**Done:** one strong Google presence seeds alone (depth); two dimensions still earn (breadth); a weak lone source without activity blocks; the Istanbul case earns on identity + operational; the legacy path is byte-identical.

### Phase 4 — Enforce the guard server-side *(shared)*

**Goal:** make the guarded lane real, as a reusable capability.

- Extract the gate into a **shared evaluator** (pure service, like `identityScoring`) — dimensions, owner axis, signal weight.
- Route the Identity tab Push through a server-side guarded entry that calls it before creating the seed.
- The **PG cockpit Push on a prospect** is the likely second consumer — it adopts the same evaluator, no re-implementation. *(Access to the identity packet from the cockpit is out of scope — a different game.)*
- Leave `createFromCampaign` and the manual lane ("Add to place listing", manual Create Seed form) unguarded by design.
- Keep the client-side disabled button as UX, not as the guard.

**Done:** a blocked Push is rejected server-side from **any** guarded surface; the manual lane still flows.

### Phase 5 — Signal weight *(derivation + injection + consumption)*

**Goal:** the category-scoped weight, from establishment to scorer.

- Schema: `platform_signal_weights` + `platform_signal_divergence` in `intelligenceProfileSchema` + `INTELLIGENCE_PROFILE_PROMPT_SUFFIX` (JSONB — no migration).
- **National derivation** in the gold-standard establishment template (prevalence × depth, with `basis`) — bump `SEED_VERSION_MARKER`, re-run local + prd.
- **Local derivation** in the market/category establishment template (same estimator).
- `IntelligenceProfileService`: resolve/expose `signal_weight(category, platform, city)` with the confidence gate; carry `basis` + `confidence`.
- `identityScoring`: consume the weight for source influence + veto materiality.

**Done:** the scorer reads a measured weight — `sourceWeight` = tier weight × resolved `signalWeight` (`null` → 1, so no-profile scoring is byte-identical). `IntelligenceProfileService.resolveSignalWeight(s)` picks the confidence-gated effective weight (a confident local estimate outranks national) and carries `basis` + `confidence`; `buildForCampaign` resolves per-source weights and the assembler annotates each source. Derivation prompts landed: gold-standard establishment + discovery templates emit national `platform_signal_weights` (prevalence × depth, `basis`/`confidence`/`observations`, honest-low for unobserved platforms), the market establishment template derives the local layer (§4c, marker `intel-profile-establishment-2026-09-18-signal-weights`), and both schemas accept the field. Veto materiality landed too: `required_field_conflict` fires ⇔ `conflictWeight ≥ agreementWeight` (the spec §2 comparison on weighted contributions); an outvoted authoritative disagreement emits `conflict_outvoted_<field>` and still drags the field score rather than blocking.

### Phase 6 — Render-control alignment

**Goal:** `unable_to_verify` is signal-aligned.

- `signal-extractor.ts`: replace the hardcoded `primaryPlatforms` set with the signal-weight gate; `unable_to_verify` inert below `τ_gap` (no `DS_MISSING_PROFILE`, excluded from the denominator).
- `applyRenderControlCoverageGate`: weight attempted/rendered by signal weight.
- Respect the existing `TriageEngineService.test.ts` control suite.

**Done:** an unrendered Google control suppresses; an unrendered Yelp control is inert. `MIN_SIGNAL_WEIGHT_FOR_GAP = 0.3` (provisional τ_gap) in `business-analysis.schema.ts`; `applyRenderControlCoverageGate(audit, platformSignalWeights?)` weights each control's contribution and excludes below-τ_gap `unable_to_verify` controls from the denominator (emitted as `weighted_attempted` / `weighted_rendered` / `inert_controls` on `render_control_coverage`); `extractSignals` takes `platformSignalWeights` and gates `DS_MISSING_PROFILE` on `business_specific_failure` weight ≥ τ_gap instead of the hardcoded primary set. Wired at every call site via `IntelligenceProfileService.resolveSignalWeightMapForCampaign` (non-fatal; `undefined` → byte-identical legacy gate).

### Phase 7 — Divergence signal, pitch framing, UI

- ~~Emit `platform_signal_divergence` as a new `INT_*` code — registry seed **and** both hardcoded `INT_SIGNAL_LABELS` maps (F6); §S1 regression guard.~~ **Done:** `INT_PLATFORM_SIGNAL_DIVERGENCE` (detection_source `derived`) in `seed-intelligence-discovery-signals.ts` (marker `2026-09-18-v2-signal-divergence`) — **registered on local + prd** — + both `INT_SIGNAL_LABELS` maps. Resolver `resolveSignalDivergences` scans every measured platform, returns only `precedenceViaConfidence` + non-zero Δ — the §4 gate doubles as the emission gate. Emitted code-side in `buildSubstrateEvidence` (one `platform_signal_weight:<platform>` observation each) through `validateSignals` — unregistered codes quarantine. `int-discovery-signals-parity.test.ts` is the §S1 guard (seed/map parity + INT absent from `KNOWN_SIGNAL_CODES` + extractor).
- ~~Pitch: `lead_platform = argmax(signal_weight × gap_severity)` using the effective weight, grounded in `basis`.~~ **Done:** `selectLeadPlatform` + `platformGapSeverity` (pure, in `IntelligenceProfileService`); `resolveSignalWeightsForCampaign` keeps `basis`; `platform_premise` on `CommonFields`; `buildPlatformPremiseInstruction` injected into all six archetype prompts (reported read — barred from crisis inflation + reciting the weight).
- ~~`IdentityPacketCard.tsx`: show the suppressed-conflict reason; display the dimensions.~~ **Done:** gate decision replaces the band when `score.gate` exists; dimension chips + owner axis + stacked strength meter (bar at 2) + human-readable blockers; QC items carry a `FIELD_LABEL` chip so `conflict_outvoted_*` / `nap_drift_*` name their field.
- **Bug found during seeding:** `CODE_PATTERN = /^[A-Z]{2}_…$/` (service + route) rejected every `INT_*` code — the 11 existing rows came from migration 199's SQL, bypassing `createSignal`. Relaxed to `{2,}` in `MarketingSignalRegistryService` + `marketing-ops.ts` `signalCodePattern`.

## §4 Test plan

- **Estimator** — national + local derivation, confidence-gate boundary.
- **Authority/dimension** — class → dimension mapping; conflict scoping.
- **Gate** — 2-of-4 earns; strength threshold guarantees (single strong platform alone, and presence alone without activity); supporting activity lifts a weak presence over the bar; owner over-rule only when short of earning; legacy byte-identity.
- **Operator evidence** — can unblock; attribution carried.
- **Enforcement** — blocked Push rejected server-side; manual lane unaffected.
- **Render-control** — signal-aligned inertness; `DS_MISSING_PROFILE` gating; existing control suite intact.
- **§S1 regression** — divergence never enters `detected_signals` / the extractor / playbook rules.
- ~~**CHECK parity** — `mkt_identity_evidence` authority-class constraint.~~ Not needed — authority class is inferred, not stored (Phase 1 decision).

## §5 Migration & ops

- **No migration** for profile fields (`configuration_json` is JSONB).
- **One migration** for the `mkt_identity_evidence` authority class (CHECK drop/re-add) — applied **tandem local + prd** per AGENTS.md.
- **Seed re-runs:** gold-standard establishment + market establishment templates (local + prd); `seed-intelligence-discovery-signals` for the divergence code (local + prd).

## §6 Risks

| risk | mitigation |
|---|---|
| Gate changes alter seed decisions for existing categories | legacy byte-identity fallback; ship scoring changes behind profile resolution |
| National weight misapplied locally | confidence-gated effective weight (Phase 5) |
| `INT_*` label duplication missed | F6 checklist — three places |
| Operator over-trust | attribution + logging (evidence, not override) |
| Render-control regressions | existing `TriageEngineService` suite gates Phase 6 |

## §7 Deferred

- Confidence **blend band** (local + national both contributing) — spec §10.
- Estimator `depth(p)` calibration + `τ`/`τ_gap` tuning against a real national sample.
- Feedback loop (local deltas revising the national score) — behind operator review.

## §8 Post-sprint micro-gaps (closed)

- [x] **Seed back-fill** — `resolveCampaignVerification` now mirrors connected-call verified facts into the primary-linked seed (`directory_seed_nap_verifications` with the confirmed/corrected split, `nap_verified_at`/`nap_owner_corrected`, provenance upsert, listing sync for corrected core fields, best-effort report refresh). Non-fatal; gated on `outcome ∉ {unreachable, wrong_business}` (§20.4).
- [x] **Persisted "Wait"** — migration 300 adds nullable `seed_decision`/`_at`/`_by` on `mkt_campaigns_list`; `POST /presence-seeds/identity-packet/decision` writes `'wait'|'clear'` and returns the rebuilt packet. Advisory only — never blocks Push.
- [x] **`no_authoritative_source` on authority class** — the QC signal now resolves `s.authorityClass ?? inferAuthorityClass(name, tier)` and tests `government | owner`, so an explicit class on a directory-tier source counts and unlabeled sources keep the legacy tier semantics under inference.
- [x] **Calibration ledger** — spec §10 now carries the provisional-constants table (`LOCAL_PRECEDENCE_CONFIDENCE` = 0.6, `MIN_SIGNAL_WEIGHT_FOR_GAP` = 0.3, `GUARANTEE_STRENGTH_THRESHOLD` = 2) with code sites; recalibrate against a real national sample before tuning.
