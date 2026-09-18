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

**Progress:** Phase 1 ✅ (authority classes → dimensions; NAP corroborators + drift) · Phase 2 ✅ (operator evidence first-class) · Phase 3 ✅ (dimension gate + owner axis) · Phase 4 ✅ (server-side guarded lane) · Phase 5–7 pending.

**Gate constants (provisional):** `EARN_DIMENSION_COUNT = 2`, `GUARANTEE_STRENGTH_THRESHOLD = 6` — the single number to calibrate (spec §10). Operational recency is a prerequisite (an inactive business blocks regardless of dimensions).

**Off-plan (shipped alongside):** campaign-scoped record verification — `MarketingCampaignService.resolveCampaignVerification` + `POST /:id/resolve-verification` + `ResolveVerificationModal` campaign mode + the Identity tab "Verify record" button. Reuses the queue modal rather than a parallel one; writes the campaign's canonical NAP and records an attributed owner-evidence capture.

### Phase 1 — Authority classes → evidence dimensions *(foundation)*

**Goal:** a source's authority class determines the dimension it may testify on.

- Define the authority-class vocabulary and the `class → dimension` map (`directory, social → operational`; `government → identity`; `trade → category`; `community → location`; `owner → above`).
- Map onto `inferSourceTier` (authoritative ≈ government, first_party ≈ owner, aggregators ≈ directory/social) so existing inference feeds the new classes.
- Scope every conflict to its dimension in `identityScoring`.
- Extend `IdentityEvidenceService` + `mkt_identity_evidence` with the authority class — **CHECK-constrained**: numbered migration (drop/re-add) + parity test per AGENTS.md enum-sync discipline.

**Done:** a source carries a class; conflicts are dimension-scoped; parity test green.

### Phase 2 — Operator evidence is first-class

**Goal:** "Add evidence" can actually unblock.

- Remove the `agrees: true` hardcode in `IdentityPacketService.assembleIdentityPacket` step 6.
- Operator rows carry authority (class, tier, evidence state, who/when) and can adjudicate a conflict within a dimension.
- Surface the operator's authority in the packet DTO.

**Done:** an operator-entered source can clear a veto / raise a dimension; regression test asserts the old add-only behavior is gone.

### Phase 3 — Dimension gate + owner axis

**Goal:** replace the binary veto with the dimension threshold.

- Replace `collectVetoes`/band with the dimension gate: **2 of 4 earns**, full threshold guarantees.
- Operational density weighting (social/directory count × signal weight).
- **Owner fifth axis:** over-rule path — recorded `owner_confirmed` testimony (who/when), logged as the unblocking axis, connected-contact gated (§20.4). Extends the `callConfirmed` precedent.
- **Legacy byte-identity:** no resolvable profile → today's scoring, unchanged.

**Done:** the Istanbul case earns on identity + operational; the legacy path is byte-identical.

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

**Done:** the scorer reads a measured weight; no profile → legacy behavior.

### Phase 6 — Render-control alignment

**Goal:** `unable_to_verify` is signal-aligned.

- `signal-extractor.ts`: replace the hardcoded `primaryPlatforms` set with the signal-weight gate; `unable_to_verify` inert below `τ_gap` (no `DS_MISSING_PROFILE`, excluded from the denominator).
- `applyRenderControlCoverageGate`: weight attempted/rendered by signal weight.
- Respect the existing `TriageEngineService.test.ts` control suite.

**Done:** an unrendered Google control suppresses; an unrendered Yelp control is inert.

### Phase 7 — Divergence signal, pitch framing, UI

- Emit `platform_signal_divergence` as a new `INT_*` code — registry seed **and** both hardcoded `INT_SIGNAL_LABELS` maps (F6); §S1 regression guard.
- Pitch: `lead_platform = argmax(signal_weight × gap_severity)` using the effective weight, grounded in `basis`.
- `IdentityPacketCard.tsx`: show the suppressed-conflict reason; display the dimensions.

## §4 Test plan

- **Estimator** — national + local derivation, confidence-gate boundary.
- **Authority/dimension** — class → dimension mapping; conflict scoping.
- **Gate** — 2-of-4 earns; threshold guarantees; owner over-rule; legacy byte-identity.
- **Operator evidence** — can unblock; attribution carried.
- **Enforcement** — blocked Push rejected server-side; manual lane unaffected.
- **Render-control** — signal-aligned inertness; `DS_MISSING_PROFILE` gating; existing control suite intact.
- **§S1 regression** — divergence never enters `detected_signals` / the extractor / playbook rules.
- **CHECK parity** — `mkt_identity_evidence` authority-class constraint.

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
