# Category Platform Signal Weight — Spec

> The seed gate currently treats every platform as equally signal-bearing. A disagreement from a platform that carries almost no signal for a category (e.g. Yelp for a Middle Eastern grocery) can hard-veto a seed, while the platforms that actually carry the category's signal (Google, Facebook) cannot outvote it. This spec introduces **signal weight** — a single, category-scoped, empirically derived score per platform — as the one authority on how much a platform's signal influences a read. A platform blocks a seed only in proportion to the signal it actually carries.

**Status:** Draft — design complete, not implemented.
**Owner:** TBD
**Scope:** `apps/api` intelligence-profile schema + gold-standard establishment template + `identityScoring` + render-control gap rule + discovery benchmark; `apps/web` identity ledger surfacing.

---

## 1. Problem

Two defects share one root cause: the system assumes every platform is equally signal-bearing.

1. **Low-influence platforms block seeds.** `identityScoring.collectVetoes()` fires `required_field_conflict` on `conflictWeight > 0` — the mere *existence* of any disagreeing source, regardless of tier or how strongly the field is otherwise corroborated (`apps/api/src/services/directory/identityScoring.ts`). A lone secondary-aggregator disagreement therefore vetoes regardless of how much first-party/authoritative agreement surrounds it.
2. **Unverifiability is scored as health.** The render-control work (`AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC.md`) made `unable_to_verify` attributable, but it still counts the same whether the platform carries the category's signal or not. Failing to verify Google-for-grocery is a gap; failing to verify Yelp-for-grocery is noise.

The platform is an **observer** of the market, not a shaper of it. The intelligence profile is a model of the **observation surface**: which platforms carry category traffic, reviews, ratings, and profile depth — the signal waves the platform rides. The profile already holds the raw material (`specialized_sources[].type/capabilities/limitations`, `priority`), but it is descriptive prose — unscored and unconsumed by the scorer.

## 2. Model — signal weight as the single source of truth

`signal_weight(category, platform) ∈ [0,1]` is the only authority on a platform's influence. Every consumer reads that same number: the identity scorer, the veto, the render-control gap rule, the gold standard, the audit. No per-consumer reinterpretation, no second table.

**Influence rule.** For a field, each source contributes `signal_weight(category, platform)`. The veto becomes a comparison rather than an existence test:

```
required_field_conflict  fires  ⇔  conflictSignalWeight ≥ agreementSignalWeight
```

Example — Middle Eastern Grocery:

| platform | signal_weight |
|---|---|
| google | 0.95 |
| facebook | 0.80 |
| apple_maps | 0.55 |
| bbb | 0.30 |
| yelp | 0.20 |

Yelp (0.20) disagreeing with Google + Facebook + Apple agreeing (2.30) → no veto, and the score barely moves. Yelp stops blocking **without an override** — it simply has less influence, which is the truth for that category. If Yelp agreed, it would add almost nothing, which is also correct.

**Decision required — authority absorption.** For "single source of truth" to hold, the weight must encode *everything*, including source authority. A state business registry has near-zero traffic/reviews, but is the most authoritative source for legal name and address. Under a pure observational-density weight it would score low and could be outvoted by a popular aggregator. **This spec assumes Option 1: absorbed** — `signal_weight` means "how much this source should influence our read," and the establishment prompt must be instructed to weight authoritative registries highly *despite* low traffic. The alternative (density-only, authority as a separate multiplier) reintroduces a second number and is rejected. *Confirm before implementation.*

> **Superseded by §2 Authority roles.** Authority is expressed as a *role* (evidence dimension), not as a weight component — so signal weight does not need to absorb it. Retained here for the record.

### Authority roles → evidence dimensions

Source authorities have **roles relative to a profile**, and the role determines which evidence dimension a source may testify on:

| authority class | role | evidence dimension |
|---|---|---|
| directory, social | operational corroborator | **operational** — active / listed / reviewed |
| government | identity + registration + credibility | **identity** |
| trade | category | **category** — category fit / authenticity |
| community | location | **location** — local presence / community |
| scoring | the seed decision | platform seed |

**Directory/social are operational corroborators — density matters.** Presence across multiple social platforms (Facebook, Instagram, Yelp…) scores high for operational; each contributes in proportion to its signal weight, so the *count* of independent corroborators matters and a low-signal platform adds little. They corroborate operational only — they do not establish identity.

**Owner — the fifth axis, above all four.** The owner is the ground truth for their own business and carries the most influence to undo a block. The owner axis **may over-rule the threshold and proceed to seed.**

**The gate:**

- **2 of 4 dimensions → earns a seed** (breadth).
- **The strength threshold → guarantees a seed** (depth *or* breadth — a single high-signal platform presence is enough on its own).
- **Owner confirmation → over-rules the threshold; proceeds to seed** — but only when the prospect is *short of earning*. It never overrides a hard veto and is not needed once a seed is guaranteed or earned.

**Strength is presence + activity.** Total strength is the sum of two parts: **dimension strength** — the tier-weighted presence/citation of distinct agreeing sources per dimension — and **supporting strength** — proven recent activity (reviews, ratings, recent comments, secondary citations) feeding the operational recency axis. Third-party sources that are *not category-recognizable* still count as supporting signals. **Platform presence alone is sufficient**: a strong single platform (e.g. Google) seeds with no second dimension and no activity signal, while a weaker presence can still cross the bar on the strength of its recent activity.

**Reachability does not gate seeding.** Seeding status is driven by **signal strength** — the dimension threshold (2/4 earns, full threshold guarantees) plus the owner axis. Owner reachability is orthogonal: it governs the *claim invite*, not the *seed*. A seed publishes on signal strength; the invite is a separate operational step that needs a channel, and its absence does not block publishing.

The false-seed aversion is a **signal-strength** call — publishing a *weak* seed is what to avoid, not publishing one without a channel. *Reachability* = at least one captured owner channel (phone/email); *verified reachability* = a connected contact (§20.4). Both are relevant to the invite, not to seeding status.

**Role is orthogonal to signal weight.** Authority class decides *which dimension* a source speaks to (eligibility); signal weight decides *how much influence* it has within that dimension (magnitude). This supersedes the authority-absorption decision above — authority is a role, not a weight.

**Consequence for the veto.** A conflict is material only *within a source's dimension*. A directory/social source is an *operational* witness — but it is also a **NAP corroborator**, contributing to the NAP fields without being able to veto them. See below.

### NAP corroborators — drift, not conflict

Directory/social sources **do** contribute to the NAP fields (name, address, phone, website) — as **corroborators**, not authorities. The distinction is a source's standing on the field:

- A source whose dimension **owns** the field (government on NAP, trade on category) is an **authority**: its disagreement is a *conflict* and can gate.
- Every other source is a **NAP corroborator**: its agreement counts, but its disagreement is **drift** — a reportable, repairable signal, never a conflict.

This resolves the Istanbul case at the root: Yelp disagreeing on the name is *drift* (Yelp holds a stale value — a repair opportunity), not an identity conflict. Identity is carried by government + owner; corroborators refine it and surface drift.

Drift is deliberately **excluded from the score's purity** — a stale aggregator value is not a defect in the record we hold. It surfaces as a `nap_drift_<field>` QC signal (reportable) and, downstream, as a profile-repair item (repairable). This reuses the existing NAP-report `drift` vocabulary (`nap_report.platform_status.status: consistent | drift | missing | unverified`).

**Owner over-rule is attributable, not silent.** The fifth axis clears a block only as recorded owner testimony — who, when, and an evidence state (`owner_confirmed`) — logged as the axis that unblocked the seed, and consistent with the connected-contact gate (AGENTS.md §20.4). It is the strongest evidence, not an acknowledge override.

### Operator judgment trust

The operator is a peer of the analyst, not a data-entry clerk. Just as the analyst collects public information to establish provenance, the operator supplies evidence to unblock a prospect — both are on the same team working toward the same goal. Operator-entered evidence is therefore **first-class**:

- it carries authority (source, tier, evidence state, who/when),
- it counts toward the evidence dimensions (operational / identity / category / location),
- it can **adjudicate a conflict** within a dimension, and
- it can record the **owner axis** (over-rule).

**"Add evidence" is the operator's instrument**, and it must be able to actually unblock — satisfy a dimension toward 2/4, lift strength toward the bar (a supporting citation counts even when it is not category-recognizable), adjudicate a conflict, or record owner confirmation. It is not a silent override: it is attributed, logged evidence with the same standing as analyst-collected public signal.

*This corrects the current implementation*, where operator evidence is hardcoded `agrees: true` (`IdentityPacketService.assembleIdentityPacket` step 6) and can only *add* agreement — it can never clear a veto. That makes the tool unable to do the job the operator needs it for.

### Remit — a scoring driver

Signal weight has **one job**: answer *how much does this platform's signal move a score?* It is not a general-purpose platform lookup and must not be threaded into every subsystem that mentions a platform. Its tasks are specific and bounded:

1. **Weight a source's influence** in identity scoring.
2. **Decide veto materiality** — whether a conflict can outrank agreement.
3. **Align the gating power of an absence** — `unable_to_verify` is inert below `τ_gap` and gates in proportion to `signal_weight` above it.

All three are the same question asked at different points on the scoring path. Nothing else is in scope.

### Reported, not applied — the pitch

Signal weight has a second, distinct role: it is **reported** as the traffic fact that frames the pitch.

> *"Most of your customers are on this platform — and here are your visibility pains on the platform where your expected traffic exists."*

The distinction that keeps the remit bounded is the verb:

| role | verb | signal weight is… |
|---|---|---|
| **Scoring driver** (§2 remit) | *applied* | changes an outcome — source influence, veto materiality, absence gating |
| **Pitch framing** | *reported* | read as a fact — supplies the platform premise |

Signal weight supplies the **"where"** (where the category's customers are). The pitch's **"what"** — which pains, what offer, what sequence — remains its own logic. Signal weight does not compute the offer, and the pitch never feeds back into scoring.

The lead platform is the intersection of the two facts, not signal weight alone:

```
lead_platform = argmax( signal_weight × gap_severity )
```

— the platform that matters *and* where the business is weak. It must use the confidence-gated **effective** weight (§4), so a national premise is never asserted over a divergent local market.

### Non-goals

Signal weight is explicitly **not**:

- **A discovery driver** — it does not shape what a scan searches for, or where the analyst probes.
- **A pitch or offer engine** — the pitch *reads* signal weight as the traffic fact (which platform the category's customers are on), but signal weight does not compute the offer, the pains, or the sequence. It supplies the *where*; the pitch owns the *what*.
- **A universal platform lookup** — other subsystems keep their own platform handling; they do not adopt signal weight just because it exists.
- **A market-shaping input** — the platform observes; signal weight measures the observation surface, it does not act on it.

The divergence signal (§5) is a **byproduct observation** emitted by the establishment — not a scoring input, and not a consumer surface. It rides along; it does not spread the weight's remit.

## 3. Derivation — two establishments, same estimator, different sample

Both the national and local scores are computed by the **same estimator** (prevalence × depth over the sampled gold-standard candidates). Only the sample differs. Apples to apples, or the divergence in §5 is meaningless.

```
for each observed platform p:
  prevalence(p) = exemplars_with(p) / exemplars_sampled
  depth(p)      = normalized composite of { review_volume, rating_count,
                                            profile_completeness, category_density }
  signal_weight(p) = normalize(prevalence(p) × depth(p))     → [0,1]
```

| scope | produced by | sample | home |
|---|---|---|---|
| **National** | gold-standard establishment scan (`mpt-seed-gold-standard-scan-001`) — nationwide latitude to probe coast to coast | many markets | city-agnostic profile (`reference_city IS NULL`) |
| **Local** | market/category establishment scan, city-scoped | one market | city-scoped profile (`reference_city = <city>`) |

The national derivation belongs to the gold-standard establishment because the weight is a property of the **category**, not a city. A single-market scan can only observe what happens to be populated locally and would mistake local density for category truth. The gold-standard analyst is also the one with the mandate to sample broadly, so it can *measure* the weight rather than assert it.

## 4. Confidence gate — local outranks national only when supported

`Δ = w_loc − w_nat` is only meaningful relative to sample size. A local weight from 3 candidates against a national weight from 500 is not a divergence — it is sampling error, and it looks exactly like a signal.

```
confidence(platform, city) ≥ τ   →  w_effective = w_loc   + emit divergence
confidence(platform, city) < τ   →  w_effective = w_nat   + suppress divergence
```

One confidence measure gates **both** precedence and divergence emission — if the local sample is too thin to outrank national, it is also too thin to report. No second policy to keep in sync.

- **Confidence is per-`(platform, city)`**, not per-profile. A metro may have 18 Yelp observations but only 2 BBB ones; profile-level gating would let a well-sampled platform ride a thin one into precedence.
- **Derived from sample basis** (`local_candidates` + per-platform observation count), not a hand-set label — reproducible and auditable.
- **τ is configurable and category-sensitive** — a category with a handful of national exemplars needs a lower bar than one with hundreds.

| local confidence | governs | divergence |
|---|---|---|
| ≥ τ | local | emitted |
| < τ | national | suppressed |

## 5. Divergence as a signal

The per-platform difference vector is itself an observation: a market where a nationally-quiet platform over-indexes is a market characteristic, not an error.

```json
platform_signal_divergence: [
  { "platform": "yelp", "national": 0.20, "local": 0.62, "delta": 0.42,
    "basis": { "local_candidates": 18, "national_candidates": 512 },
    "confidence": "high" }
]
```

- **Where it lives:** the `INT_*` intelligence-observation family, extending the closed 11-code set (seeded by `seed-intelligence-discovery-signals.ts`). It must stay **display-only** — per AGENTS.md §S1, INT_* codes never enter `detected_signals`, the signal extractor, or playbook rule evaluation. A "platform over-indexes locally" observation surfaces in discovery/report and never triggers triage.
- **Emission is gated by the same confidence** as §4 — no divergence from a thin sample.
- **Second-order payoff:** accumulated local deltas across many markets are evidence for revising the national score. That is a bootstrap, so it stays behind operator review (§8).

## 6. Consumers — applied (scoring) and reported (pitch)

Signal weight is **applied** on scoring surfaces only, and **reported** (read-only) on the pitch surface. No other consumer.

### Applied — scoring surfaces

Per §2's remit, signal weight is read **only** where a platform's signal moves a score. Three surfaces, all on the scoring path:

| scoring surface | change |
|---|---|
| **Identity source influence** (`identityScoring.scoreField`) | A source's contribution = `signal_weight(category, platform)` (replacing the fixed `TIER_WEIGHT` lookup when a profile resolves). **Legacy fallback:** no resolvable profile → current `TIER_WEIGHT` behavior preserved byte-for-byte. |
| **Veto materiality** (`identityScoring.collectVetoes`) | The veto becomes a weighted comparison — `required_field_conflict` fires ⇔ `conflictSignalWeight ≥ agreementSignalWeight` — instead of `conflictWeight > 0`. This is the seed-path change: a low-signal platform can no longer block. |
| **Audit gap scoring** (render-control `unable_to_verify` → gap) | `unable_to_verify`'s gating power is **aligned to signal weight**: it produces a gap — and can suppress a tier or emit `DS_MISSING_PROFILE` — only in proportion to `signal_weight`, and is **inert below `τ_gap`**. A low-signal platform's unverifiability is powerless. |

### `unable_to_verify` is signal-aligned

The render-control mechanism (`AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC.md`) made an unrendered platform *attributable*. Signal weight makes it *proportionate* — the gate's power tracks how much signal the platform actually carries for the category. If `unable_to_verify` has gating powers, those powers are aligned to the signal weight.

- **Below `τ_gap` — inert.** No gap entry, excluded from the coverage denominator, no `DS_MISSING_PROFILE`. The platform is not a signal surface for this category, so its absence says nothing. `unable_to_verify` is powerless here.
- **At or above `τ_gap` — gates in proportion to `signal_weight`.** The coverage gate (`controls_rendered / controls_attempted`) weights each platform's contribution by its signal weight, so failing to render Google (0.95) tanks coverage and suppresses the tier, while failing to render Yelp (0.20) barely moves it.

This keeps the render-control spec's intent — unverifiability is never scored as health — while removing the converse defect: a platform with no category signal being treated as a verification obligation.

### Reported — the pitch surface

The pitch/deliverable **reads** signal weight as the traffic fact (§2 *Reported, not applied*):

- **Lead platform** = `argmax(signal_weight × gap_severity)` — the platform that matters *and* where the business is weak. Uses the confidence-gated effective weight, never the national value when a confident local one diverges.
- **The premise** — "most of your customers are on this platform" — is grounded in the measured `basis` (prevalence × depth), not asserted.
- **Read-only.** The pitch consumes the resolved weight; it never re-derives, overrides, or feeds back into scoring.

**Scoring transparency (not a consumer).** `IdentityPacketCard.tsx` should surface *why* a conflict was suppressed — *"Yelp disagreement — signal weight 0.20 for this category; does not veto."* This is the scoring decision explaining itself, not a new place signal weight is applied.

**Deliberately excluded** (see §2 non-goals): discovery shaping, and any subsystem that merely references a platform. The pitch's platform selection is a *reported* read (above), not an applied one.

### Guard placement — a shared guarded lane

The guarded lane is a **shared gating capability**, not an Identity-tab feature. Its first consumer is the **Identity tab's "Push draft seed"**; a **Proving-Ground cockpit Push button on a prospect** is a natural second — same gating logic, different surface.

| lane | who | guards |
|---|---|---|
| **Guarded** | Identity tab Push *(first consumer)*; PG cockpit Push on a prospect *(likely second)* | evaluates the gate — dimensions, owner axis, signal weight — before creating the seed |
| **Manual** | "Add to place listing" (`BusinessAnalysisAuditCard`), the manual Create Seed form, testing / back channels | raw creator; **deliberately unguarded** |

**Current reality — the gap:** the guard on the Push is **client-side only**. `IdentityPacketCard` disables the button when `vetoes.length > 0`, but the endpoint it calls (`POST /presence-seeds/from-campaign/:campaignId` → `createFromCampaign`) evaluates no identity gate — only `identity_mismatch` and `incomplete_nap`. The block is advisory, not enforced.

**Making it real:** the gate is a **shared evaluator** — a pure service, like `identityScoring` — consumed by a guarded entry that any guarded surface calls. The Identity tab is the first consumer; the PG cockpit adopts it without re-implementing. The raw `createFromCampaign` endpoint stays for the manual lane. Placement is debatable — the guard could equally live in the campaign stage transition — but the Identity tab Push is where it is today.

**Out of scope:** *accessing the identity packet from the cockpit* is a different game — navigation, permissions, and context. It is not part of the Push gate and this spec does not address it.

## 7. Storage & resolution — no migration

The profile body is stored in `mkt_intelligence_profiles.configuration_json` (JSONB), so `platform_signal_weights` and `platform_signal_divergence` are **data-only additions** to the profile JSON. No numbered migration, no `prisma db pull`.

- **Schema:** add `platform_signal_weights` (and the divergence block) to `intelligenceProfileSchema` in `apps/api/src/validators/intelligence-profile.schema.ts` + document them in `INTELLIGENCE_PROFILE_PROMPT_SUFFIX`. Optional + `.passthrough()` keeps legacy profiles valid.
- **National home:** city-agnostic profile (`reference_city IS NULL`).
- **Local home:** city-scoped profile (`reference_city = <city>`).
- **Resolution:** consumers resolve via the existing chains — `IntelligenceProfileService.resolve(category, focus, city, platform)` / `resolveGoldStandard(category, platform, city)` — which already walk city+platform fallbacks (AGENTS.md §Intelligence Profile City Scoping, migration 205 / 236).
- **Read path:** one resolved `signal_weight(category, platform)` per consumer.

## 8. Guardrails

1. **Never a silent override.** The weight must *explain* suppression ("Yelp conflict suppressed — signal weight 0.20 for Middle Eastern Grocery"), keeping the audit trail the `preview_built` gate philosophy demands. A divergence must never quietly rewrite a hard block.
2. **DRAFT → operator activate → `publishVersion`.** LLM-derived weights are noisy; they ride the existing review flow so a bad derivation is reviewable and reversible.
3. **§S1 preserved.** Divergence signals are INT_* / display-only; no triage coupling.
4. **Legacy byte-identical.** No resolvable profile → current scoring behavior unchanged. This makes the change safe to land before every category has a profile.
5. **Confidence gating is mandatory** for both precedence and divergence emission.

## 9. Implementation checklist

Scoped to the scoring remit (§2). Anything not on this list is a non-goal.

- [ ] Make the guarded lane real: extract the gate into a **shared evaluator** (pure service) and route the Identity tab Push through a server-side guarded entry that calls it. The PG cockpit Push is the likely second consumer — same evaluator, no re-implementation (identity-packet access from the cockpit is out of scope). Leave the raw `createFromCampaign` endpoint for the manual lane.
- [ ] Classify each source's authority class → evidence dimension (operational / identity / category / location); scope each conflict to its dimension.
- [ ] Operational dimension: density-weighted corroboration — social/directory count × signal weight; multiple independent socials score high.
- [ ] Seed gate: replace the single veto with the dimension threshold — **2 of 4 earns** (breadth), the strength threshold **guarantees** (depth or breadth; a single high-signal platform presence is enough).
- [ ] Owner fifth axis: the over-rule path — recorded owner testimony (`owner_confirmed`, who/when) that clears a block and proceeds to seed; logged as the unblocking axis; connected-contact gated (§20.4).
- [ ] Operator evidence is first-class: operator-entered sources count toward dimensions, adjudicate conflicts, and can record the owner axis — i.e. **"Add evidence" can unblock**. Remove the `agrees: true` hardcode; carry authority + attribution.
- [ ] Reachability stays out of the seed gate: seeding status is signal-driven; the claim invite is a separate operational step.
- [x] Extend `intelligenceProfileSchema` with `platform_signal_weights` + `platform_signal_divergence`; update `INTELLIGENCE_PROFILE_PROMPT_SUFFIX`.
- [x] Gold-standard establishment + discovery templates (`seed-gold-standard-scan-template.ts`): task the analyst to derive the national `platform_signal_weights` (prevalence × depth, with `basis`, `confidence`, `observations`) across the coast-to-coast sample; `gold-standard-scan.schema.ts` accepts the field and the output suffix documents the rules. Re-run against `local` + `prd` per AGENTS.md.
- [x] Market/category establishment template: derive the local `platform_signal_weights` with the same estimator + `basis` + `confidence` + `observations` (§4c; seed marker `intel-profile-establishment-2026-09-18-signal-weights`). Re-run against `local` + `prd`.
- [x] `IntelligenceProfileService`: resolve/expose `signal_weight(category, platform, city)` with the confidence gate — a confident local estimate outranks national; carry `basis` + `confidence` through; missing profile data → legacy behavior.
- [x] `identityScoring.ts` — **source influence**: consume signal weight via `sourceWeight` (tier weight × resolved signal weight); `signalWeight == null` → 1, preserving the legacy `TIER_WEIGHT` path byte-identically when no profile resolves.
- [x] `identityScoring.ts` — **veto materiality**: `required_field_conflict` fires ⇔ `conflictWeight ≥ agreementWeight` (§2's comparison, on signal-weighted contributions). An outvoted authoritative disagreement no longer blocks — it emits `conflict_outvoted_<field>` and still drags the field score.
- [x] `signal-extractor.ts` / coverage gate — `unable_to_verify` signal-aligned: inert below `MIN_SIGNAL_WEIGHT_FOR_GAP` (τ_gap = 0.3, provisional) — no `DS_MISSING_PROFILE`, excluded from the coverage denominator; weighted by `signal_weight` above it. Wired at every `extractSignals` call site + the import coverage gate via `resolveSignalWeightMapForCampaign`; `undefined` → legacy uniform behavior.
- [x] Emit `platform_signal_divergence` as a new INT_* code — `INT_PLATFORM_SIGNAL_DIVERGENCE` (detection_source `derived`). Resolver: `resolveSignalDivergences` scans every measured platform and returns only `precedenceViaConfidence` winners with non-zero Δ — the §4 gate doubles as the emission gate (§5: "one confidence measure gates both"). Emission point: `SeedReportEvidenceService.buildSubstrateEvidence` — one `platform_signal_weight:<platform>` observation per divergence (source `intelligence_profile:<id>@v<version>`) plus the signal pushed through `validateSignals`, so an unseeded/inactive code lands in quarantine, not the report. Seeded via `seed-intelligence-discovery-signals.ts` (marker `2026-09-18-v2-signal-divergence`; local + prd) + both `INT_SIGNAL_LABELS` maps.
- [x] `IdentityPacketCard.tsx`: gate panel — the server's `gate.decision` (guaranteed/earned/rescued/blocked) replaces the band when present; dimension chips (satisfied + strength + sourceCount), the owner axis chip (`ownerOverRule`), a stacked strength meter (presence + activity vs the bar at 2), and human-readable blockers. Suppressed conflicts render in QC signals with a field label (`conflict_outvoted_<field>` + `nap_drift_<field>` carry `field` → `FIELD_LABEL` chip).
- [x] Pitch/deliverable: `selectLeadPlatform(auditData, resolved)` = `argmax(signal_weight × gap_severity)` in `IntelligenceProfileService` (pure; `platformGapSeverity` scores `gap_analysis` + failed `quality_gate_results` — non_negotiable 1, recommended 0.5). `resolveSignalWeightsForCampaign` returns the full resolution (keeps `basis`); `resolveSignalWeightMapForCampaign` delegates. `OutreachOpenerService` populates `common.platform_premise`; `buildPlatformPremiseInstruction` injects the "customers are on <platform>" framing into all six archetype prompts — grounded in `basis`, explicitly barred from crisis inflation and from reciting the weight. Null when no platform qualifies → no premise.
- [x] Tests (partial): resolver unit tests — national + local, confidence-gate boundary, `precedenceViaConfidence` flag semantics, `resolveSignalDivergences` gate/scan/non-fatal (`IntelligenceProfileService.signalWeights.test.ts`); weighted scoring + unweighted byte-identity (`identityScoring.test.ts`); weighted coverage gate — high-signal suppresses, low-signal inert, boundary + all-inert cases (`business-analysis-availability-control.test.ts`); weighted `DS_MISSING_PROFILE` emission (`TriageEngineService.test.ts`); substrate divergence emission — validated path, unregistered-code quarantine, non-fatal failure (`SeedReportEvidenceService.test.ts`); §S1 regression guard — seed/label-map parity + INT codes absent from `KNOWN_SIGNAL_CODES` and the extractor (`int-discovery-signals-parity.test.ts`); lead-platform selection — argmax semantics, effective-weight preference, gap-free/unresolved → null (`IntelligenceProfileService.signalWeights.test.ts`).

## 10. Deferred / open questions

- **Blend band.** A middle confidence band where local *and* national both contribute (weighted by confidence) instead of a hard switch. Deferred from v1 — the threshold is simpler and the divergence signal already captures the disagreement. Recorded so the deferral is conscious.
- **Feedback loop.** Aggregating local deltas to revise the national score is the same bootstrap as §5; keep behind operator review.
- **Estimator normalization.** The exact `depth(p)` composite weights (review volume vs rating count vs profile completeness vs category density) need a calibration pass against a real national sample before τ and `τ_gap` can be set.
- **Explicitly out (non-goals, §2).** Discovery-benchmark gap weighting stays out — signal weight does not shape discovery. The pitch's platform selection is *in* as a reported read (§6), not an applied one.
