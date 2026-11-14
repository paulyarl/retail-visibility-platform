# Engagement Brief Spine — Consolidation & First-Consumer Sprint Plan

**Status:** All phases shipped (2026-11-14) — the brief is fully consumed. Spine layer (`brief-spine.ts`) resolves persisted→assembled for every consumer; CallScript/seed ammunition, openers, follow-ups, manual scripts, anchors, pitch-construction slots, the card, communications gate resolution, and the follow-up workspace all read the spine with Pass-1 fragments in fallback branches only. Reassemble-on-import + gate carry-over + OQ7 `deprecated_fragments` marker + D7 synthesis gate (`needsSynthesisOverlay`) shipped. checkapi/checkweb clean; 79 tests green (67 api incl. golden Viet Hua ordering, 12 web card).
**Date:** 2026-11-14
**Upstream spec:** `docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md` (Pass 2 shipped 2026-10-13; OQ7 "judgment migration" remains open — this sprint resolves it)
**Related:** `docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md` (sibling campaigns — the brief's ranking overlay must be archetype-aware)

---

## 1. Gap Sweep — what exists vs what the design needs

### Built and working

| Piece | Where | State |
|---|---|---|
| Pass-1 audit fragment inventory — `gap_analysis`, `observed_assets`, `outreach_problems`, `market_opportunities`, `benefits`, `alignment_scoring`, `recommended_services`/`recommended_attributes`/`recommended_tier`, `detected_signals`, `data_quality` | `business_analysis` audit_data | Complete — every spine slot already has a fragment source |
| Pass-2 brief schema + template + import stamp | `validators/engagement-brief.schema.ts`, `scripts/engagement-brief-default-body.md` (`mpt-seed-brief-001`), `services/engagement-brief/engagement-brief-stamp.ts` | Shipped — model composes the whole spine each run |
| Trust boundaries | `applyEngagementBriefStamp` | `source_audit_id`, `side`, `brief_version` are authoritative writes — model never sets them |
| Precondition | `assertEngagementBriefSourceAudit` in `MarketingExecutionService` | Refuses a brief run with no non-stub `business_analysis` |
| Side classifier | `services/engagement-brief/footprint-side.ts` | v2, `emerging`/`competitive`, density threshold 10 |
| Audit-import recompute triggers | `MarketingAuditService.ts:84`, `MarketingExecutionService.ts:446` → `resharpenSeedsForCampaign` + `syncFulfillmentForCampaign` | The deterministic recompute lane already exists — the brief can ride it |
| Archetype projection | `seed-archetype-briefing-templates.ts` + `ProspectReportService.archetypeFactSlice` | Sibling briefings already consume a deterministic per-archetype extract of the same audit |
| Dirty-queue pattern | `377_pos_dirty_items.sql`, `jobs/pos-dirty-flush.ts` | Signal-only dirty row + flush job — the staleness mechanic template (POS domain, reusable shape) |
| Brief card | `EngagementBriefAuditCard.tsx` | Renders schema faithfully — not the operator workflow |

### The three-voices problem (OQ7)

Three artifacts currently generate pitch material independently:

1. Pass-1 audit: `outreach_problems`, `benefits`, `market_opportunities`, `alignment_scoring.primary_outreach_hook`
2. Pass-2 brief: `engagement_shape.primary_hook_ref`, ranked `pains`
3. Archetype briefings: their own `outreach_problems` per sibling

~10 services read `audit_data` directly and re-decide the top pain each time (`CallScriptService` reads `outreach_problems` at `CallScriptService.ts:1173`; `ManualOutreachScriptService` reads `alignment_scoring.primary_outreach_hook` at :857; `OutreachOpenerService`/`OutreachFollowUpService` read audit_data wholesale). Agreement between the three voices is coincidental, not enforced.

### Open gaps

| # | Gap | Consequence |
|---|---|---|
| G1 | No deterministic assembly — the model recomposes the whole spine from scratch per run | Ranking drifts run-to-run; "rank once" holds within a row, not across re-derivations; a model call is spent on joins code could do |
| G2 | No staleness fingerprint — `source_audit_id` is a pointer, not a freshness check | Operator can't tell whether the brief reflects the latest audit without comparing dates across cards |
| G3 | No ref-integrity validation — `evidence_index` paths are never resolved against the source audit | A hallucinated or drifted path persists silently |
| G4 | Single `evidence_ref` per item | Composite findings (e.g., "no usable web address" = 3 gaps + website issues + channels) lose provenance |
| G5 | No per-archetype ranking overlay — the spine is business-level but siblings pitch different fixes | Each sibling brief re-ranks independently; facts can diverge between sibling chapters |
| G6 | No consumer reads the spine — the ~10 named services still re-derive judgment from Pass 1 | The brief is a pre-computation with one UI reader; its value is conditional on migration landing |
| G7 | Card renders schema, not workflow | Operator manually joins pains→fits→gates→guardrails across five sections |
| G8 | Gates have no resolution state | Second-touch operator can't see what was already asked/answered |
| G9 | `high_attention` doesn't gate the model pass | Every brief costs a full model run regardless of prospect value |
| G10 | OQ7 undecided — dual-emit or breaking change | The audit keeps emitting judgment fragments the brief is supposed to own |
| G11 | **`loadBriefSourceAudit` doesn't resolve sibling audit inheritance** (found in final sweep) | Sibling inheritance is a read-time merge (`loadPrimarySiblingAudits`, `MarketingCampaignService.ts:2060`), not physical rows — a non-primary sibling can pass `assertEngagementBriefSourceAudit` (which reads merged `campaign.audits`) yet stamp `source_audit_id: null`. Precondition and stamp disagree about what "has an audit" means. Fix: pool audit lookups across the `business_prospect_id` sibling set (`ProspectReportService` pattern, `campaign_id IN sibling set`) — also REQUIRED for "spine computed once per business" |
| G12 | Two gate-resolution lanes exist (found in final sweep) | The communications page's verification call is prospect-queue scope (`mkt_prospect_queue` Verify → resolved NAP promotes into the campaign), NOT campaign `verification_gates`. Task 4.4b must scope to campaign gates via logged touches; the prospect lane stays separate |
| G13 | Fingerprint needs a canonical field manifest (found in final sweep) | `evidence_fingerprint` hashes "the fields the assembler reads" — that set must be a named constant (`BRIEF_INPUT_FIELDS`) or two computes hash different things. The assembler's input manifest IS the fingerprint input |

---

## 2. Design decisions

### D1 — The brief becomes a consolidation layer, not a third voice

Pass 1 keeps emitting fragments during transition (see D6). Pass 2 becomes a three-stage pipeline:

- **Assemble (code, deterministic).** A `brief-assembler` service folds audit fragments into spine rows. Each row records `source_fragment` — the audit field path it came from — so `evidence_index` provenance is the join record, not a model citation. Idempotent: same audit in, same spine out.
- **Reconcile (code, rules).** One ordering produced by deterministic rank rules, not a model pick: `non_negotiable` gaps > negative-theme-backed gaps > `recommended` gaps; `outreach_problems` order is the tie-breaker; detected-signal domains break remaining ties. Disagreements between fragment sources (e.g., `market_opportunities` HIGH vs `gap_analysis` recommended on the same defect) resolve to the higher severity and record a `reconciliation_notes` entry.
- **Synthesize (model, optional).** Only the residue: `business_consequence` phrasing for gaps that are field names, `capability_fits` judgment, gate deduplication. Skipped entirely when fragments cover the spine (see D7 spend gate).

### D2 — Pain ordering is code-derived

`digital_opportunity_score.components` + `gap_analysis.severity` + `negative_review_themes.observed_frequency` + `detected_signals` already encode a defensible ordering. The assembler ranks; the model never sorts. `primary_hook_ref` resolves mechanically to `pains[0].ref_id` — re-runs can't silently re-rank a campaign mid-flight.

### D3 — Per-archetype ranking overlay (multi-archetype awareness)

Siblings share one business audit but pitch different fixes. The spine is computed **once per business** (the fragment pool is archetype-agnostic), then each sibling's brief is the same spine with an **archetype ranking overlay**:

- Overlay = deterministic reorder using the archetype's signal domain (A2 → RA_* pains first; A3 → DS_* pains; A4 → WC_* pains; A6 → underexposed-asset-led).
- **`capability_fits` follow their addressed pain's overlay rank** (decided 2026-11-14): each sibling's fit list sorts by `addresses_ref` under that sibling's ordering — A2 leads `review_response`, A3 leads `directory_listing`. Asset-addressed fits sort after all pain-addressed fits. A canonical-order fit list next to a reordered pain list would let one chapter lead two different stories.
- Facts never diverge between sibling chapters — only emphasis does. This mirrors `archetypeFactSlice`, which already does deterministic per-archetype extraction; the overlay is the same move one layer up.
- `engagement_shape.primary_hook_ref` is per-sibling (archetype domain's top pain), while `pains` content is shared.

### D4 — Staleness fingerprint

The stamp computes `evidence_fingerprint` = hash of the audit fields the assembler reads (`gap_analysis`, `observed_assets`, `combined_review_metrics`, `detected_signals`, `outreach_problems`, `alignment_scoring`, `data_quality`). Stored on the brief row at import.

- On subsequent `business_analysis` imports (same lane as `resharpenSeedsForCampaign`): recompute the fingerprint. Identical → brief stays current, zero spend. Changed → mark sibling briefs `stale` and enqueue a reassemble (Layer A/B are free — recompute always; Layer C is the gated spend, see D7).
- Card renders `current | stale` off the stored fingerprint vs latest audit — no cross-card date math for the operator.
- Pattern credit: `pos_dirty_items` — signal-only staleness marking, flush on consume or on tick.

### D5 — Ref integrity at stamp time

`applyEngagementBriefStamp` already loads the source audit. Extend it to resolve each `evidence_index` value against `audit_data` (path-walk); unresolvable paths get warned + the dependent spine item flagged `provenance_broken` rather than silently persisted. Same trust-boundary posture as the `source_audit_id` drop-warn.

### D6 — OQ7 resolved: dual-emit staged migration

Pass 1 keeps emitting `outreach_problems`/`market_opportunities`/`primary_outreach_hook`/`recommended_*` during migration — consumers read them today and a breaking change costs more than redundancy.

- Phase 2 migrates the first consumer (`CallScriptService`) to read the spine with a Pass-1 fallback when no brief exists.
- `importExternalResult` sets a `deprecated_fragment` marker on new audits once a field set has zero remaining readers.
- Deprecation is the last task of Phase 4 — when all named consumers read the spine, Pass-1 template lines stop emitting the judgment blocks.

### D7 — Spend gating

- Layer A+B run on every relevant audit import (free).
- Layer C (model) runs only when: (a) fragments can't cover a required spine slot, AND (b) `high_attention` is true OR an operator explicitly requests a refresh. Emerging-side thin footprints get a code-only skeleton brief — the deterministic answer IS the answer for "no surfaces exist."
- Recompute is dirty-queue-driven (D4), never speculative projection rendering.

### D8 — Schema evolution (brief_version 2)

Backward-compatible additions only:

- `pains[]`/`assets[]`/`capability_fits[]`/`verification_gates[]` gain optional `source_fragment` (audit field path — the join record) and `supporting_refs` (string[] — fixes single-ref loss).
- `verification_gates[]` gain `status` (`pending|answered|needs_reconfirmation|skipped`) + `resolution_note` — operator-editable via the card; persists in `audit_data` (no new table — same OQ3 storage posture). **Gate carry-over by identity** (decided 2026-11-14): a gate is keyed by `blocks` + hash of its `source_fragment`. On re-import, unchanged fragment → `status`/`resolution_note` carry; changed fragment → they carry but `status` flips to `needs_reconfirmation`; blocked item absent from the new spine → gate drops. An answered question stays answered; a stale answer is flagged, never silently trusted.
- Brief root gains `evidence_fingerprint`, `staleness` (`current|stale`), `assembly` (`deterministic|hybrid|model`), `archetype_domain` (the overlay that ranked it).
- All new fields optional at the validator; assembler/stamp owns their authoritative write.

### D9 — The card renders "the play," not the schema

Reorder the card to the operator's read path: hook panel (pain + consequence + spoken lines + attached guardrails + addressing capabilities) → ranked remaining pains each with inline `addressed-by` chips and gate warnings → gate checklist ordered operator-clearable first → quarantined guardrails → collapsed evidence index. Badges triage: only `inferred`/`verify_with_owner` confidence and `internal` visibility badge; `verified_on_surface`/`client_safe` are the default and stay silent. Per-item copy affordance replaces card-level "Copy JSON" as the primary action.

---

## 3. Sprint plan

### Phase 1 — Deterministic spine assembler + stamp hardening

| # | Task | Size |
|---|---|---|
| 1.1 | `services/engagement-brief/brief-assembler.ts` — fragment→spine folding (assemble) + rank rules (reconcile). Emits spine rows with `source_fragment`, `supporting_refs`, `reconciliation_notes` | L |
| 1.1a | Sibling-aware source audit resolution — pool `business_analysis` lookups across `business_prospect_id` sibling set (`campaign_id IN sibling set`, matching `ProspectReportService`'s chapter-audit pooling). Fixes G11 for `loadBriefSourceAudit` AND `assertEngagementBriefSourceAudit` — non-primary siblings get real stamps | M |
| 1.2 | `evidence_fingerprint` computation (`BRIEF_INPUT_FIELDS` manifest — G13) + `staleness` write in `applyEngagementBriefStamp` | M |
| 1.3 | Ref-integrity resolution in the stamp — path-walk `evidence_index` values against source `audit_data`; warn + `provenance_broken` flag | M |
| 1.4 | Schema v2 fields (optional, back-compat) + validator tests | S |
| 1.5 | `brief_version` bump to 2 + `assembly` tag | S |

**Exit:** given the Viet Hua audit JSON, the assembler emits a spine whose pains order matches the manual ranking (unanswered reviews > no web presence > Yelp split > underexposure > second surfaces) with zero model calls; ref-integrity flags a deliberately-broken path in test.

### Phase 2 — First consumer + UI play panel

| # | Task | Size |
|---|---|---|
| 2.1 | `CallScriptService` reads the campaign's latest `engagement_brief` spine (`pains[0..2]` + `do_not_claim` + gates) with `outreach_problems` fallback when no brief exists — same contract shape so callers don't change | M |
| 2.1a | Seed call script ammunition + benefits (`presence-seeds/[id]/page.tsx` `seedScript.ammunition`/`benefits` blocks + "Draft anchors" source) migrate to the linked campaign's spine — carries `do_not_claim` + visibility tags into claim-motion copy, which today inherits `outreach_problems` with NO guardrails. Highest-value consumer win in the sprint | M |
| 2.2 | Card: hook panel (pain + spoken lines + attached guardrails + capability chips) | M |
| 2.3 | Card: pains with inline `addressed-by` chips; staleness badge off `evidence_fingerprint` | M |
| 2.4 | Card: badge triage (silent defaults), per-item copy, rank numbers | S |
| 2.5 | Card: evidence paths link to the sibling audit card on the same tab | S |

| 2.6 | `CallScriptPanel` ammunition → spine read + `do_not_claim` warning strip on the script the operator reads aloud (rides 2.1 — service migrates, panel inherits) | S |

**Exit:** the A2 sibling's call script opens on the spine's `primary_hook` with `do_not_claim` inherited verbatim; the card shows the Viet Hua play as one panel without scrolling.

### Phase 3 — Archetype overlay + synthesis gate

| # | Task | Size |
|---|---|---|
| 3.1 | Archetype ranking overlay — deterministic reorder of `pains` + `capability_fits`-by-addressed-pain by archetype signal domain; `archetype_domain` + per-sibling `primary_hook_ref` stamped | M |
| 3.2 | Archetype briefing templates consume the shared spine (their `outreach_problems` render from overlay-ordered pains + fragments — facts can no longer diverge from the spine) | M |
| 3.2a | Seed "Draft anchors" per-sibling overlay — anchors drafted from linked sibling campaigns resolve each sibling's overlay-ranked spine, so an A2-linked seed gets A2-ordered ammunition (replaces the current flat "every linked campaign's briefing + outreach_problems" pull) | M |
| 3.2b | `PitchConstructionPanel` slot-fill + archetype-affinity starters consume the overlay-ranked spine — removes the panel's local ranking duplication; "fill 3 slots" reads spine pains | M |
| 3.3 | Layer C synthesis — model pass for uncovered spine slots only, gated on `high_attention` or operator refresh; `assembly: hybrid` when it ran | M |
| 3.4 | Dirty-queue wiring: audit import → fingerprint diff → mark stale → reassemble (A/B) → optional C | M |

**Exit:** A2 and A3 siblings for the same prospect show identical fact rows, different rankings; a repeat audit import with unchanged evidence costs zero model calls.

### Phase 4 — Gate state + OQ7 deprecation + remaining consumers

| # | Task | Size |
|---|---|---|
| 4.1 | Gate `status`/`resolution_note` persistence + carry-over-by-identity on re-import (`needs_reconfirmation` flip on fragment drift) + card checklist UI (owner gates first, resolution capture) | M |
| 4.2 | Migrate `OutreachOpenerService`/`OutreachFollowUpService` to spine reads w/ fallback | M |
| 4.3 | `deprecated_fragment` marker path in `importExternalResult`; Pass-1 template deprecation list documented | S |
| 4.4 | Remaining named consumers (`Header`/`Closer`, `DeliverableSection`, `ProspectReport`, `ManualOutreachScript`, `IdentityPacket`) — each a separate, small slice | M each |
| 4.4a | `FollowUpWorkspaceClient` — migrate `OutreachFollowUpService` reads to spine + widen the hardcoded "Review Management" scope so sibling campaigns in recovery/profile_repair appear | M |
| 4.4b | `ProspectCommunicationsClient` — logged touches on a campaign-linked prospect can resolve campaign `verification_gates` (`status`/`resolution_note` written on the spine). Scoped to campaign-level gates only — the prospect-queue verification call (`mkt_prospect_queue` Verify → NAP promotion) is a SEPARATE existing lane, not conflated (G12) | M |
| 4.5 | Optional: seed-page Observed Assets section badges `how_to_use` from the linked brief — shows the operator which verified assets are pitch material vs background | S |

**Exit:** a grep for `audit_data.outreach_problems` / `primary_outreach_hook` in services returns only fallback branches; OQ7 closes with the Pass-1 deprecation marker shipped.

---

## 4. Test plan

- `brief-assembler` unit tests: fragment→spine mapping per field family; rank-rule ordering on a synthetic audit with known severities; reconciliation-note emission on conflicting severities; archetype-overlay reorder (same pool, different order).
- Stamp tests (extend `engagement-brief-stamp.test.ts`): fingerprint stability, staleness flip on changed audit, ref-integrity warn path, `source_fragment` preservation.
- Schema tests (extend `engagement-brief.schema.test.ts`): v2 optional fields, `status` enum, back-compat with v1 payloads.
- `CallScriptService` contract test: identical script output whether evidence comes via spine or `outreach_problems` fallback (the fallback is the spec — the spine must not produce a different play).
- Card tests (extend `EngagementBriefAuditCard.test.ts`): hook panel composition, addressed-by chips, staleness badge, badge triage.
- Golden fixture: the Viet Hua Madison Ave audit → expected spine JSON checked in as `__tests__/fixtures/brief-assembler/viet-hua.ts` — the proving-ground artifact for ordering stability.

## 5. Non-goals

- Changing `resharpenSeedsForCampaign` or the Pass-1 render-control machinery.
- Moving `digital_opportunity_score`, `alignment_scoring`, or `gap_analysis` — those are Pass-1 facts; only judgment fragments migrate.
- A dedicated brief table — `mkt_audits_list` JSONB remains the storage posture (OQ3).
- Public narrative surfaces — they read Pass 1 `observed_assets`/`public_narrative` directly and are untouched by the spine.

## 6. Open questions

- EBT-aware deposit gating (OQ2) stays open — it lands as a `verification_gates` entry on affected spines, not as product scope here.

**Decided 2026-11-14:** gate carry-over by identity with `needs_reconfirmation` on fragment drift (was deferred to Phase 4 — now folded into D8 + Phase 4.1); archetype overlay reorders `capability_fits` by addressed-pain rank (was deferred — now folded into D3 + Phase 3.1).
