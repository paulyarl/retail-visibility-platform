# Competitive Weakness Attribution — Design Spec

**Document Version:** 0.1
**Date:** 2026-09-20
**Status:** Draft for review
**Companion docs:** `BRONZE_STANDARD_SPEC.md` (§7.4 — the emerging-lane analog),
`marketing_ops_discovery_leads_handoff_spec.md` (§6, §8.4–8.5 — the carry +
render machinery this spec extends)

---

## 1. Problem

Emerging-lane discovery has `bronze_attribution` (BRONZE_STANDARD_SPEC §7.4):
when a catalog reason is directly responsible for a find, the scan records it,
and the attribution rides `business_snapshot` → `discovery_context` into the
business audit's Discovery Leads block and the triage briefing's
`PROSPECT ORIGIN` block. The operator — and the downstream analyst — can name
*why this prospect exists*.

Competitive-lane discovery has no equivalent. A competitive candidate emits
`gold_standard_gate_results` (mechanical pass/fail against the benchmark) and
the shared `INT_*` signal vocabulary, but nothing that names *why this
visible incumbent is a prospect worth outreach*. Gate failures are necessary
but not sufficient: a leader can pass every gate and still be exposed, and a
cluster of gate failures only becomes pitch material once it is named as a
pattern. Today that naming is left to free text, so it cannot be aggregated
("which weaknesses recur across category leaders?") and cannot be carried
downstream as structured context.

§7.4 deferred this explicitly: *"Competitive-lane attribution is a separate
question … and is not in scope."* This spec is that separate question.

## 2. Semantics — different question, same plumbing

Bronze attribution is **causal**: it credits the discovery mechanism that
produced the find. Competitive candidates are found by mainstream discovery
by definition (competitive + platform = businesses *present* on the target
platform), so there is no "why was it hidden" to answer.

Competitive attribution is **exposure**: competitive candidates are the
market's *leaders* — selected for their visibility, not their gaps — and
the attribution names **their weaknesses**, documented during selection.
The weakness is the pitch rationale: the named pain that converts "leader
observed" into "we see you — can we help?"

| | Bronze attribution | Competitive weakness |
|---|---|---|
| Question answered | Why was this business invisible? | Where is this leader exposed? |
| Direction | Causal (mechanism → find) | Synthetic (observations → named gap) |
| Absence means | Nothing — mainstream find | Benchmark, not prospect |
| Vocabulary | DB catalog (`mkt_bronze_reason_catalog`) | Seeded prompt vocabulary (§4) |

The field deliberately uses a **distinct name** (`competitive_weaknesses`,
`weakness_key`) rather than reusing `*_attribution` / `reason_key`: the
semantics differ, and downstream consumers must not assume bronze's causal
contract. The `{key, basis}` *shape* is identical so the existing carry and
render plumbing is reused without modification.

## 3. Selection vs. documentation — weaknesses are the pitch, not the filter

Leaders are **selected for their strengths** — the visibility signals that
make them the market's benchmarks. Weaknesses are not the selection
criterion; they are **documented during selection** and become the outreach
wedge: the named pain the pitch speaks to ("we see you — can we help with
this?").

A structural consequence worth stating plainly: a leader with **no**
observable weakness has no pain to pitch — it is a benchmark, not a
prospect. Weakness presence is therefore expected — not optional — on
recommended candidates.

- Selection is strength-driven; weakness documentation rides the same
  evaluation pass.
- A qualifying candidate with `business_seek_recommended: true` SHOULD carry
  at least one `competitive_weaknesses` entry — the weakness *is* the pitch
  wedge (no pain, no pitch).
- A qualifying candidate with no observable weakness MAY emit
  `benchmark_only: true` (optional flag) to record "observed as a reference
  point, not a prospect."
- This is a **prompt-level expectation, not a schema refinement**. The
  codebase's tolerance philosophy (§31 normalizers, optional+nullable
  fields) applies: a recommended candidate with zero weaknesses imports
  cleanly. Compliance is measured by operator observation, not validation
  rejection — a hard refinement would reject valid payloads the model
  legitimately produces.

## 4. Weakness vocabulary v1

Four families. Each key ships with a one-line definition and observable
signals so the analyst can pattern-match — same authoring convention as
bronze `signals`, but the vocabulary lives in the seeded competitive focus
fragment, not a DB catalog (§5).

### 4.1 Asymmetry — strong somewhere, weak elsewhere

| weakness_key | Definition | Observable signals |
|---|---|---|
| `social_dominant_directory_weak` | Active/strong social presence; sparse, stale, or absent directory listings | frequent social posts; thin GBP/Yelp; missing hours/attributes on directories |
| `directory_dominant_social_weak` | Strong directory presence; weak, dormant, or absent social | complete GBP with photos/reviews; no Facebook/IG or months-silent pages |
| `single_platform_concentration` | Dominant on one platform; thin or absent on all others | deep profile on exactly one platform; nothing corroborating elsewhere |

### 4.2 Drift — was strong, decaying

| weakness_key | Definition | Observable signals |
|---|---|---|
| `stale_content_surface` | Ranking on momentum; no recent posts, photos, offers, or updates | last post/photo months old; review replies stopped |
| `nap_drift` | Name/address/phone inconsistent or stale across platforms | conflicting hours, old address on one platform, name variants |
| `reputation_fragility` | High review volume but declining rating or a recent negative cluster | rating trend down; recent reviews sharply lower than lifetime average |
| `review_velocity_decline` | Review cadence has dropped versus the business's prior pace | monthly review counts trending down over trailing periods |
| `category_drift` | Platform category labels diverge from the business's actual specialization | GBP primary category generic while offerings are specialized; labels conflict across platforms |

### 4.3 Absence — a surface is missing entirely

| weakness_key | Definition | Observable signals |
|---|---|---|
| `unclaimed_secondary_profiles` | Claimed/managed on the primary platform; unclaimed elsewhere | "Own this business?" prompts on secondary platforms |
| `website_gap` | Strong platform profiles; weak, dated, or absent website | no website on profiles; template site with stale content |
| `no_conversion_path` | Visible but no booking, ordering, or contact surface | no appointment/order link; phone-only contact on every surface |
| `review_response_absent` | High review volume with zero owner engagement | no owner responses across a large review corpus; Q&A unanswered |

### 4.4 Thinness — present but shallow

| weakness_key | Definition | Observable signals |
|---|---|---|
| `thin_service_surface` | Leader by name recognition; sparse services, attributes, or menu detail | category inferred from name/reviews, not listed services; empty attributes |
| `thin_media_surface` | Strong profile skeleton; few or dated photos | low photo count relative to review volume; photos years old |

Consolidation and splitting are curation decisions (e.g. `thin_media_surface`
vs `stale_content_surface` overlap is intentional — one is absence, one is
decay). Vocab changes are seed edits, not migrations.

## 5. Where the vocabulary lives — deliberately not a catalog

The bronze catalog's machinery (DB table, `catalog_revision`, scope model,
staleness detection, admin routes, test-scan) exists because bronze reasons
drive a *hunt list* and fill *profile slots* — the infrastructure is
load-bearing. Competitive weaknesses fill no slots and execute no vectors.

The v1 vocabulary is therefore **prompt-resident**: authored into the seeded
`seek_intelligence_focus_competitive` fragment (assembled by
`PromptComposerService` at composition step 4). Changes follow normal seed
discipline (edit + re-run against `local` and `prd`).

Promotion path, if it is ever needed: if operators begin authoring weaknesses
frequently, or per-weakness yield tracking becomes a real requirement (which
weaknesses convert to audits/campaigns), promote the vocabulary to a table —
but only then. Do not build the catalog to justify the field.

**Known limitation — no deprecation trail.** A prompt-resident vocabulary has
no `superseded_by` mechanism: renaming a key in the seed leaves historical
snapshots carrying dead keys. Renderers already degrade gracefully (the
label map falls back to the raw key, same as unknown INT_* codes), so this
is cosmetic — but it is the first thing a table promotion would fix.

## 6. Output contract

`discovered_businesses[].competitive_weaknesses` (mirrored into
`qualifying_businesses[]`):

```jsonc
"competitive_weaknesses": [
  { "weakness_key": "review_response_absent",
    "basis": "312 Google reviews, zero owner responses" }
],
"benchmark_only": false   // optional; see §3
```

- Optional + nullable; `.passthrough()` keeps legacy payloads clean.
- `weakness_key` is a free string at the schema layer (the vocabulary is
  prompt-resident, not schema-enforced — same posture as `reason_key`).
- Entries carry a one-line `basis` naming the observation, mirroring bronze.
- Prompt rule (added to `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX`): emit
  `competitive_weaknesses` only when `focus` is `competitive`; recommended
  qualifying candidates SHOULD carry ≥1 entry; a leader with no observable
  weakness is a benchmark, not a prospect.
- `benchmark_only` is **scan/card-display only** — it is not carried into
  `business_snapshot` or `discovery_context`. A queued benchmark is simply
  a prospect with no weaknesses; nothing downstream needs the flag.

## 7. Downstream carry

Identical seam to bronze §7.4, all JSONB — no migration:

1. `business_snapshot.competitive_weaknesses` on queue-add.
2. `discoveryContextSchema.competitive_weaknesses` — same shape, optional.
   `validateDiscoveryContext` counts it toward non-emptiness alongside
   `bronze_attribution`.
3. `renderDiscoveryLeadsBlock` gains a "Competitive weaknesses" subsection.
   Framing differs from bronze's: these are *hypothesis leads* — the scan's
   claim is "the incumbent is exposed here," which the audit must verify
   like any other lead. (Bronze attribution is provenance, not a hypothesis;
   competitive weaknesses are both provenance *and* checkable claims —
   render them under the leads umbrella, not beside it.)
4. `renderCompetitiveWeaknessesBlock` — a `PROSPECT ORIGIN — COMPETITIVE
   WEAKNESSES` block for the signal_triage path, mirroring
   `renderBronzeAttributionBlock`: pitch framing ("the market leader is
   exposed at X — and so is this prospect's competitive frame"). Same
   guardrail as bronze: an exposure, not a verdict.

   **Epistemic caveat — sharper than bronze's.** Bronze attribution is pure
   provenance: a fact about *how the prospect entered the pipeline*, true
   regardless of what the audit later finds. A weakness is a **scan-time
   claim about the business** — the same epistemic class as an INT signal
   lead, unverified until an audit confirms it. On the signal_triage path
   (where hypothesis inputs are restricted to repair signals, T5b) the block
   therefore renders weaknesses as *the scan's claimed exposure* — "the
   discovery scan judged this incumbent exposed at X; confirm before
   pitching" — not as established fact. The provenance is that the scan
   claimed it; the claim itself remains a hypothesis. Pitch framing may
   *use* the claim, clearly attributed to the scan, but must not present it
   as verified.
5. Audit card + queue chips: `weakness: <weakness_key>` alongside the
   existing `bronze: <reason_key>` chip.

## 8. Cross-lane framing — when both attributions are present

The two lanes' attributions are complementary halves of one frame: bronze
says where the prospect was *found* (often where they are strong but
invisible); competitive says where the leader is *exposed*. When
`discovery_context` carries **both** `bronze_attribution` and
`competitive_weaknesses` (a prospect surfaced in both lanes and merged, or a
business that is simultaneously a hidden find and an exposed incumbent), the
triage path renders a combined `PROSPECT ORIGIN — DISCOVERY ATTRIBUTION`
block whose framing aligns them:

> The blind spot that surfaced this prospect and the incumbent's exposure
> describe the same market gap from two directions — pitch the differential
> ("leaders are weak exactly where you were found"), not two unrelated facts.

Mechanism: dual attribution rides the existing **PG merge pattern** — the
identity-ledger accumulation rule already proven by
`ProvingGroundDedupService` (migration 262 / §4.9): a `same_entity` verdict
unions absorbed entries' `name_variants` onto the survivor rather than
last-write-win. The same accumulation rule applies to attribution wherever
a merge touches attribution-bearing rows.

The operative surface today is the **queue dedup (`addToQueue`)**: the
`already_queued` branch returns the existing entry unchanged, so a
competitive-lane Queue/Verify action against an already-queued emerging
prospect would silently drop the new snapshot's `competitive_weaknesses`.
The dedup branch must instead **union-merge attribution fields**
(`bronze_attribution`, `competitive_weaknesses`, `discovery_provenance`)
into the existing entry's `business_snapshot`. Merge semantics: union by
key (`reason_key` / `weakness_key` / `source`+`url`); on duplicate keys,
prefer the non-empty `basis`. This is the only behavioral change this spec
requires of existing code.

Two clarifications:

- **`discovery_context.focus` stays single-valued — and doesn't need to be
  more.** It records the *originating run's* focus (`resolveRunFocus` on
  the queue entry's run), but **attribution presence is itself the
  lane-awareness vector**: `bronze_attribution` populated ⇒ emerging lane
  touched this prospect; `competitive_weaknesses` populated ⇒ competitive
  lane touched it. A consumer never needs `focus` to know which lanes
  produced the entry — the populated arrays encode the full lane
  provenance, and the vector scales to any number of attribution kinds
  without a schema change. Every renderer therefore keys off **field
  presence**, not `focus`: the combined block renders whenever both
  attribution arrays are non-empty, and each lane's block/subsection
  renders whenever its own array is non-empty, regardless of which run
  produced the entry.
- **Seed-level merges are future surface.** `directory_presence_seeds` rows
  don't carry `business_snapshot`, so the PG verdict path has nothing to
  union today; the rule is stated so that any future attribution-bearing
  merge inherits the same accumulation semantics by default.

Single-lane contexts render their own block exactly as today — the combined
block is strictly additive.

### 8.1 Downstream surfaces beyond triage

Attribution is **pipeline provenance carrying framing material** — the same
property that lets `PROSPECT ORIGIN` ride the signal_triage path (where
hypothesis inputs are deliberately restricted to repair signals) makes it
safe on *every* surface that already receives the campaign row, subject to
the §7 epistemic caveat: weakness *claims* stay labeled as scan-claimed
until audit-verified. `discovery_context` lives on `mkt_campaigns_list`, so
no new data plumbing is needed — each surface opts in by rendering the
block:

| Surface | Why attribution lands there |
|---|---|
| Triage briefing (`signal_triage`) | In scope (§7.4–§8) — pitch framing for the Pitch section |
| Business audit (`category_audit`) | In scope — weaknesses render as leads to verify |
| Openers / fulfill-type prompts | Opt-in — "leader weak exactly where you were found" is an opener |
| Call scripts (`CallScriptService`) | Opt-in — the weakness key names the talk track; the basis is the scriptable fact |
| Deliverables / gallery | Opt-in — the differential frame is a designed-artifact headline |

Opt-in means a render call, not a contract change: surfaces that don't
render the block are byte-identical to today, and adding a new consumer is
always additive.

### 8.2 Content, not priority

The downstream value of attribution is **framing material, not ordering**.
Two distinct mechanisms feed the same surfaces and must not be conflated:

- **Priority** — platform signal weights (`resolveSignalWeightsForCampaign`
  → `platform_premise`, hook ordering by `signal_weight × gap_severity`)
  decide *which angle leads*.
- **Content** — `bronze_attribution` + `competitive_weaknesses` supply *what
  the angle says*: named story primitives ("we found you through X",
  "the leader is exposed at Y") that a pitch, script, or briefing can
  quote directly.

A call script's hook *order* comes from weights; the hook's *narrative*
comes from attribution. The two compose — a weighted lead platform tells
the script where to start, and the merged attribution set tells it what to
say when it gets there — but attribution never ranks, scores, or gates
anything. If a surface needs ordering, it uses the weight machinery; if it
needs a story, it uses attribution.

## 9. Guardrails

- **Weaknesses are exposures, not verdicts.** Same norm as bronze attribution
  and audit leads: never presented to the owner as a defect claim; always
  framed as opportunity.
- **Not signals.** `competitive_weaknesses` never enters `detected_signals`
  or any signal pipeline — the §S1 separation holds exactly as it does for
  `bronze_attribution`.
- **Competitive-only.** The field is emitted only under `focus:
  'competitive'`; the emerging lane's contract is byte-identical to today.
- **Curated, not scan-produced.** Same doctrine as the bronze catalog
  (§11.1): the analyst picks from the list; new weaknesses enter via seed
  edits by operators, never by inferring keys from scan output.

## 10. File reference

| Component | File |
|---|---|
| Discovery output schema + prompt suffix | `apps/api/src/validators/intelligence-discovery.schema.ts` |
| Vocabulary injection | `seek_intelligence_focus_competitive` fragment (`apps/api/src/scripts/seed-intelligence-fragments.ts` — re-run `pnpm seed:intelligence-fragments` against local + prd) |
| Context carry | `discoveryContextSchema` + `validateDiscoveryContext` (same file) |
| Snapshot assembly (explicit — required edit) | `apps/web/src/components/marketing-ops/IntelligenceDiscoveryAuditCard.tsx` — `handleQueue` builds `business_snapshot` field-by-field (~L252–269); add `competitive_weaknesses` beside `bronze_attribution`. **Not spread — the field does not ride free** |
| Snapshot → context carry | `apps/api/src/services/MarketingProspectQueueService.ts` (~L944, beside `bronze_attribution`) |
| Queue dedup merge (§8 — the one behavioral change) | `apps/api/src/services/MarketingProspectQueueService.ts` — `addToQueue` `already_queued` branch (~L336–345) |
| Leads block + triage block | `apps/api/src/services/MarketingExecutionService.ts` — `renderDiscoveryLeadsBlock` (~L2142), new `renderCompetitiveWeaknessesBlock` beside `renderBronzeAttributionBlock` (~L2264) |
| UI chips | `IntelligenceDiscoveryAuditCard.tsx`, `ProspectQueueClient.tsx`, `ProvingGroundCockpitClient.tsx` (beside existing `bronze_attribution` rendering; keys render raw like `reason_key` — no label map) |

## 11. Test plan sketch

- Schema: accepts `competitive_weaknesses` entries; accepts null/omitted;
  `benchmark_only` tolerated; entry missing `weakness_key` rejected.
- Context: `validateDiscoveryContext` treats weakness-only context as
  non-empty; carries through `createCampaignFromQueue`.
- Dedup merge (`addToQueue`): second-lane queue action on an `already_queued`
  identity unions `competitive_weaknesses` / `bronze_attribution` /
  `discovery_provenance` into the existing `business_snapshot`; duplicate
  keys keep the non-empty basis; first-add behavior unchanged.
- Render: leads block renders the weaknesses subsection whenever the array
  is non-empty (field presence, **not** `ctx.focus`); triage renders
  `PROSPECT ORIGIN — COMPETITIVE WEAKNESSES` with the scan-claimed caveat
  (§7); combined block renders only when both attribution arrays are
  non-empty; byte-identical render when absent (the G5 norm).
- Emerging-lane regression: competitive fields never appear in emerging
  output; existing bronze tests untouched.
