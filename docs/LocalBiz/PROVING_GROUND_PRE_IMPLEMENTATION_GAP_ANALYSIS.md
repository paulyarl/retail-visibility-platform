# Proving Ground — Pre-Implementation Gap Analysis

> **Purpose:** Validate cohesive design across the proving-ground spec, the
> sprint plan, the actual implementation, the new `seed` campaign stage, and
> the batch-label/observer framing — **before** any further implementation
> proceeds.
>
> **Scope:** Identify inconsistencies, stale assumptions, implementation/spec
> drift, and design decisions required. Separate must-have corrections from
> deferred enhancements. Produce acceptance criteria.
>
> **Companion docs:**
> - `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` (design authority)
> - `docs/LocalBiz/proving_ground_sprint_plan.md` (phased implementation)
> - `docs/LocalBiz/PROVING_GROUND_STAGE_CULTURE_FIT_ANALYSIS.md` (PG × stage
>   culture — the batch-label/awareness framing)
> - `docs/LocalBiz/CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md` (the new `seed` stage)

---

## 0. Executive Summary

The proving-ground backend is **substantially built**: migration 262 is
applied, the cadence engine, dedup service, preflight seed script, checklist
direct-assignment branch, and cockpit all exist. The spec and the
implementation agree on the major architecture.

Three categories of gap remain:

1. **Spec/implementation drift** — the PG-01 preflight steps in the seed script
   diverge from the spec's §4.3 step list. The spec's "no new stage names"
   non-goal is now stale given the planned `seed` stage. These need
   reconciliation before the seed stage lands.

2. **Missing stage-awareness layer** — the signal is already flowing (queue
   entries carry `campaign_stage`), but the cockpit doesn't aggregate it. This
   is the core "PG as observer" feature. It's a frontend-only change for the
   basic case.

3. **Deferred scope flex** — `promoteToProvingGround` still hardcodes
   `scope='city'`. The batch-label framing makes category/state/mixed PGs
   architecturally clean, but this is a later enhancement, not a blocker.

**Recommended ship order:**
1. Reconcile the PG-01 step drift + update the spec's stale "no new stage
   names" non-goal (documentation-only, no code).
2. Ship the `seed` stage (structural — see
   `CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md`).
3. Ship the PG stage-awareness panel (frontend-only aggregation, benefits from
   the richer stage set).
4. Ship the PG scope flex (later — the awareness layer works regardless of PG
   scope).

---

## 1. Implementation Status — What's Actually Built

Verified by reading the source files, not the spec claims.

| Component | Spec ref | Built? | File | Notes |
|---|---|---|---|---|
| Migration 262 (queue cols, dedup table, playbook category, touch CHECKs) | §8.1 | **Yes** | `database/migrations/262_proving_ground.sql` | All columns, constraints, indexes, and the dedup table match the spec. |
| `CampaignCategory` includes `'proving_ground'` | §4.1 | **Yes** | `MarketingCampaignService.ts` | Type union includes it. |
| `promoteToProvingGround` | §7 | **Yes** | `MarketingCampaignService.ts` | Hardcodes `scope: 'city'` (the flex gap). |
| `attachChildCampaign` | §4.2 | **Yes** | `MarketingCampaignService.ts` | Guards: parent=PG, child=intelligence, one-parent rule. |
| `resolveEffectivePlaybook` direct-assignment branch | §4.3 | **Yes** | `PlaybookChecklistService.ts` (line ~732) | Resolves `PG-01` by catalog code for city/category-scope PG campaigns, no triage row needed. |
| Triage candidate exclusion for `proving_ground` playbooks | §4.3 | **Yes** | `CampaignTriageService.ts` | PG playbooks filtered out of triage matching. |
| `INTERNAL_LINK_TARGETS` includes `proving_ground_worklist`, `seed_claim_kit` | §4.3 | **Yes** | `PlaybookChecklistService.ts` (line ~543) | Both targets present. |
| `createSeedsForProvingGround` | §4.4 | **Yes** | `DirectoryPresenceSeedService.ts` | Creates + publishes seeds, links to intelligence campaign, issues claim token, stamps `seed_id`, leaves `status='queued'`, idempotent. |
| `ProvingGroundCadenceService` | §4.6–4.8 | **Yes** | `ProvingGroundCadenceService.ts` | Full cadence map, ladder advance, touch cap (3/30d), `connected`→`in_thread`, write-through to seed state, mirror to `mkt_outreach_log`. |
| `ProvingGroundDedupService` | §4.9 | **Yes** | `ProvingGroundDedupService.ts` | `recordVerdict`, `listVerdicts`, `mergeNameVariants`. Group-keyed, not pairwise. |
| PG-01 preflight seed script | §8.3 | **Yes** | `apps/api/src/scripts/seed-proving-ground-preflight.ts` | Idempotent, marker-presence check. **Step list drifts from spec — see §2.1.** |
| `ListQueueFilters.source_campaign_ids` | §5.2 | **Yes** | `MarketingProspectQueueService.ts` | Queue list accepts campaign-tree filter. |
| Queue `campaign_stage` decoration | (not in spec) | **Yes** | `MarketingProspectQueueService.ts` (line ~500) | `includeCampaigns: true` decorates each entry with `campaign_stage`, `campaign_category`, `repair_track`, `stage_entered_at`. **This is the signal the stage-awareness layer aggregates.** |
| PG cockpit page | §5.1 | **Yes** | `ProvingGroundCockpitClient.tsx` | Header, children panel, preflight panel, funnel dashboard, gap log, promote/dismiss/seed actions. **No stage distribution panel — see §2.2.** |
| `resolveBusinessProvingGround` | (not in spec) | **Yes** | `MarketingCampaignService.ts` (line ~1206) | Traces business campaign → queue → source campaign → PG. Powers "View Proving Ground" link. |
| Stage distribution endpoint | §6.1 (culture-fit) | **No** | — | Not built. Frontend-only aggregation is the basic case. |
| PG scope flex (`scope='category'` etc.) | §5.3 (culture-fit) | **No** | — | `promoteToProvingGround` hardcodes `scope: 'city'`. |

---

## 2. Spec / Implementation Drift

### 2.1 PG-01 preflight steps — the seed script diverges from the spec

**The spec §4.3 defines 7 steps:**

| # | Spec step | Type | Writes |
|---|---|---|---|
| 1 | Reconcile cross-campaign duplicates | `manual` | verdicts → `mkt_prospect_dedup_verdicts` |
| 2 | Seed place entries + issue claim tokens | `deliverable` | seeds + tokens + links + `seed_id` |
| 3 | Generate claim-invite QR kits | `deliverable` | per-seed PNG + postcard PDF |
| 4 | Build per-prospect gap-map one-pagers | `deliverable` | on-demand PDF per queue row |
| 5 | Resolve open verifications | `manual` | step note + `mkt_prospect_queue.verification` |
| 6 | Build channel sequence per prospect | `manual` | `channel_sequence` + `current_channel_index` |
| 7 | Assign operator owner per account family | `manual` | `assigned_to` + `account_family` |

**The seed script (`seed-proving-ground-preflight.ts`) defines 7 steps:**

| # | Seed-script step | Type | Action target |
|---|---|---|---|
| 1 | Reconcile Seed Funnel | `manual` | — |
| 2 | Seed & Contact | `internal_link` | `seed_claim_kit` |
| 3 | QR / One-Pagers | `internal_link` | `seed_claim_kit` |
| 4 | Offer Construction | `manual` | — |
| 5 | Assignment | `manual` | — |
| 6 | Open Worklist | `internal_link` | `proving_ground_worklist` |
| 7 | Launch Readiness | `manual` | — |

**Drift:**
- **Step 4 (gap-map one-pagers)**: spec has it as a distinct `deliverable` step;
  the seed script folds it into step 3 ("QR / One-Pagers") and drops the
  dedicated gap-map step.
- **Step 5 (resolve open verifications)**: spec has it; the seed script
  doesn't have an equivalent — verification resolution is not a named step.
- **Step 6 (build channel sequence)**: spec has it; the seed script doesn't
  have it — channel-sequence construction is not a named preflight step.
- **Step 4 (Offer Construction)**: the seed script has it; the spec doesn't
  list "offer construction" as a preflight step (it's a per-prospect decision,
  not a preflight gate).
- **Step 7 (Launch Readiness)**: the seed script has it; the spec doesn't list
  it (G1–G4 baselines are mentioned in the runbook, not as a preflight step).
- **Step 6 (Open Worklist)**: the seed script has it as the worklist-release
  step; the spec's step 6 is "Build channel sequence" (which *releases* the
  worklist per §4.10). The seed script's "Open Worklist" is the operator
  action of opening it, not the preflight gate that releases it.

**Decision required:** Which step list is canonical? The seed script is what
the database actually contains. The spec is the design authority. Options:
- **A.** Update the seed script to match the spec (re-add gap-map, verification,
  channel-sequence steps; drop offer-construction and launch-readiness).
- **B.** Update the spec to match the seed script (the seed script's steps are
  the operator-tested version).
- **C.** Reconcile both into a merged list (the spec's structural steps + the
  seed script's operator-flow steps).

**Recommendation:** Option B or C. The seed script reflects what operators
actually use. If the spec's "build channel sequence" step was dropped, it's
likely because channel-sequence construction moved into the seed-creation flow
(`createSeedsForProvingGround` may scaffold the ladder automatically). Verify
whether the ladder is built during seeding or requires a manual preflight
step. If the former, the spec is stale; if the latter, the seed script is
missing a step.

### 2.2 The "no new stage names" non-goal is now stale

**Spec §11 (Non-Goals):**
> No new stage names — the proving ground sits inside the existing vocabulary
> and never transitions.

**The `seed` stage sprint** (`CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md`) introduces
a new stage name: `seed`, inserted between `seek` and `preview_built`.

**Reconciliation:** These are not in conflict if read carefully:
- The spec's non-goal is about the **PG parent** — it never transitions, so
  no new stage names are needed *for the PG parent's lifecycle*.
- The `seed` stage applies to **business-scope campaigns** (the graduates), not
  to the PG parent.

But the spec's wording ("the proving ground sits inside the existing
vocabulary") is ambiguous — it could be read as "the PG system uses no new
stage names anywhere." The culture-fit analysis already clarified this, but
the spec document itself still carries the stale non-goal.

**Action:** Update spec §11 to:
> No new stage names **for the proving-ground parent** — it sits inside the
> existing vocabulary and never transitions. Downstream business-scope
> campaigns may use the `seed` stage (introduced separately); the PG observes
> it but does not transition through it.

### 2.3 The spec's "stays at 'seek'" language vs the observer model

**Spec §2.1:**
> The parent is a workspace, not a funnel participant. It is created at `seek`
> ... and stays there. Its stage means nothing and advances never.

**Culture-fit analysis:**
> The PG is a batch label. It only cares about the end-to-end stage
> progression of the business-scope campaigns that graduate from the child's
> queue.

These are consistent — the PG parent stays at `seek` and observes downstream
stages. But the spec doesn't mention the observer role at all. The spec's
§6 (Funnel & Gates) describes the seed funnel (seeds, touches, claims) but not
the stage pipeline distribution.

**Action:** Add a section to the spec (or reference the culture-fit analysis)
describing the PG's observer role: the PG reads `campaign_stage` from
graduated business campaigns via the queue decoration and aggregates it into a
distribution. This is a read-only concern; the PG never writes to `stage`.

---

## 3. Seed-Stage Integration Gaps

### 3.1 The `seed` stage and PG preflight seeding are different operations

This is the most important cohesion point. Two different "seed" concepts
coexist:

| Concept | What it means | Where it lives | Who transitions |
|---|---|---|---|
| **PG preflight seeding** (spec §4.4) | Creating a directory presence seed + claim token + queue stamp | `DirectoryPresenceSeedService.createSeedsForProvingGround` | The PG preflight step; the queue row stays `queued` |
| **`seed` campaign stage** (seed sprint) | A pipeline stage between `seek` and `preview_built` for business-scope campaigns | `MarketingCampaignService.transitionStage` | The business campaign transitions `seek → seed → preview_built` |

**These must not be conflated:**
- PG preflight seeding happens **before** a business campaign exists. It
  creates the directory seed and stamps `queue.seed_id`. The queue row is
  `queued`, not `campaign_created`.
- The `seed` campaign stage happens **after** `createCampaignFromQueue`
  graduates the queue row to a business campaign. The business campaign starts
  at `seek` and transitions to `seed` when the seed-first checklist steps
  (create seed, QC, publish, mint token, invite owner) are executed.

**Wait — there's a sequencing question.** If the PG preflight already creates
and publishes the directory seed (step 2 of PG-01), and the business campaign
later transitions to `seed` to "create the seed" (seed-stage checklist step
5), is the seed created twice?

**Resolution:** The PG preflight seeding and the business campaign's `seed`
stage serve different operators at different times:
- **PG preflight** = the launch operator seeds the whole city's prospects in
  bulk, before any business campaign exists. This is the "deploy the batch"
  action.
- **Business campaign `seed` stage** = the assigned operator works a single
  prospect through the seed-first wedge (create/QC/publish/invite) for that
  prospect's campaign. If the PG preflight already seeded the prospect, the
  campaign's seed-stage checklist steps would be **already complete** (the
  seed exists, the token is minted, the owner is invited). The operator
  checks them off.

**But this creates a question:** if the PG preflight creates the seed, what
does the business campaign's `seed` stage *do*? Two interpretations:
- **A.** The `seed` stage is a verification/QC stage — the operator confirms
  the preflight-seeded listing is correct and the owner has been invited. The
  seed already exists; the stage is about confirming it.
- **B.** The `seed` stage is the *first* time the seed is created — the PG
  preflight doesn't seed; it only prepares the queue. The business campaign's
  `seed` stage creates the seed.

**The spec is clear:** PG preflight step 2 creates the seed (`createSeedsForProvingGround`
creates + publishes + links + tokens + stamps `seed_id`). So interpretation A
is correct — the `seed` stage for a PG-graduated business campaign is a
verification stage, not a creation stage.

**The seed-stage sprint plan needs to acknowledge this.** The
`CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md` proposes re-tagging checklist steps 5–9
(create seed, QC, publish, mint token, invite owner) to `seed`. For a
PG-graduated campaign, these steps are already done by the preflight. The
operator would check them off as "already complete" or the system would
auto-check them based on `queue.seed_id` being non-null.

**Decision required:** Should the seed-stage checklist steps auto-complete
when `queue.seed_id` is already set (PG-graduated campaigns)? Or should the
operator manually verify each step?

**Recommendation:** Auto-complete the creation steps (create, publish, mint
token) when `seed_id` is non-null. Leave the QC and invite steps for manual
verification (the operator should confirm the preflight-seeded listing is
correct and the owner was actually invited).

### 3.2 Queue status transitions during the seed lifecycle

The cadence service (`ProvingGroundCadenceService.ts`, line 168) blocks touch
logging when `status === 'campaign_created'`:
```ts
if (entry.status === 'dismissed' || entry.status === 'campaign_created') {
  throw new ConflictError(`entry_${entry.status}`);
}
```

This means:
- **Before graduation**: queue row is `queued` (or `hold`/`in_thread`). Cadence
  operates. Touches are logged to the seed.
- **After graduation**: queue row is `campaign_created`. Cadence exits. The
  business campaign owns the outreach log (`mkt_outreach_log`).

**The stage signal flows correctly through this transition:**
- Before graduation: `campaign_stage` is null (no campaign yet). The stage
  distribution counts this as "still in queue."
- After graduation: `campaign_stage` is the business campaign's stage
  (`seek`, `seed`, `preview_built`, ...). The stage distribution counts it in
  the appropriate stage bucket.

**No gap here.** The queue decoration handles the transition correctly.

### 3.3 GBP enrichment trigger

The seed-stage sprint proposes moving the best-effort GBP enrichment trigger
from `seek → preview_built` to `seek → seed`. This is a business-campaign
transition concern and does not interact with the PG preflight (which doesn't
trigger GBP enrichment — it creates directory seeds, not GBP enrichment).

**No gap.** But worth noting: if the PG preflight already enriched the
listing data (from the intelligence discovery audit), the business campaign's
`seek → seed` GBP enrichment may be redundant. This is an optimization, not a
correctness issue.

---

## 4. Stage-Awareness Aggregation Gaps

### 4.1 The canonical aggregation unit

**Question:** What is counted in the stage distribution?

**Answer:** Business-scope campaigns that graduated from the PG's queue
entries. Each queue entry with a non-null `processed_campaign_id` represents
one graduated prospect. The stage is `mkt_campaigns_list.stage` for that
campaign.

**Not counted:**
- The PG parent itself (it's at `seek` but it's not a prospect).
- Intelligence children (they're data containers, not prospects).
- Queue entries without a `processed_campaign_id` (these are "still in
  queue" — pre-graduation).

### 4.2 The "still in queue" conflation

The culture-fit analysis's frontend aggregation (§6.1) counts entries with
null `campaign_stage` as "still in queue." But this conflates:

| Queue status | `campaign_stage` | Meaning | Should count as |
|---|---|---|---|
| `queued` | null | Seeded, not yet graduated | "still in queue" |
| `hold` | null | On hold, not graduated | "still in queue (on hold)" |
| `in_thread` | null | Live conversation, not graduated | "still in queue (in thread)" |
| `campaign_created` | non-null | Graduated, campaign exists | stage bucket |
| `campaign_created` | null | Graduated but stage null (shouldn't happen) | **data error** |
| `dismissed` | null | Dismissed | "dismissed" (separate) |

**Gap:** The frontend aggregation should distinguish `campaign_stage === null`
because the entry is pre-graduation vs. because of a data error. The safe
approach: count by `status` first, then by `campaign_stage` for
`campaign_created` entries.

**Revised aggregation:**
```ts
const stageDistribution = useMemo(() => {
  const byStage: Record<string, number> = {};
  let stillInQueue = 0;
  let dismissed = 0;
  for (const e of queue.entries) {
    if (e.status === 'dismissed') { dismissed++; continue; }
    if (e.status === 'campaign_created' && e.campaign_stage) {
      byStage[e.campaign_stage] = (byStage[e.campaign_stage] ?? 0) + 1;
    } else if (e.status === 'campaign_created' && !e.campaign_stage) {
      // Data error — graduated campaign with null stage. Count as 'seek'
      // (the default) or surface as a warning.
      byStage['seek'] = (byStage['seek'] ?? 0) + 1;
    } else {
      stillInQueue++;  // queued, hold, in_thread — pre-graduation
    }
  }
  return { byStage, stillInQueue, dismissed };
}, [queue.entries]);
```

**Post-review additions (v2 — verified against code):**

- **`dismissed` is never loaded.** The cockpit's queue call filters
  `status: ['queued','in_thread','hold','verify_then_outreach','campaign_created']`
  — `dismissed` rows don't arrive, so the bucket above always reads 0. Add
  `'dismissed'` to the filter or use a separate count request.
- **Dedupe on `processed_campaign_id`.** AC84's `campaign_exists` path can
  mark a second queue row `campaign_created` against the *same* campaign —
  counting entries double-counts the stage. Bucket a `Map<campaignId, stage>`,
  not rows.
- **Truncation.** `limit: 200` silently caps the set; surface a caveat when
  `entries.length === limit` or fall back to the dedicated endpoint.
- **Endpoint formula fix.** The endpoint sketch's
  `stillInQueue = allQueue − graduated − dismissed` double-subtracts:
  `dismiss()` has no status guard, so a graduated row can be dismissed while
  keeping `processed_campaign_id`. Compute `stillInQueue` from status
  buckets instead. (Corrected sketch: culture-fit doc §6.2.)
- **Business grandchildren are queue-invisible.** `createCampaign` writes
  `parent_campaign_id` directly (~line 773; derive flows set it at ~1454), so
  business campaigns can hang under intelligence children with no queue
  linkage. The distribution needs a `parent_campaign_id IN treeIds` union,
  and `resolveBusinessProvingGround` needs a `parent_campaign_id → PG` hop.

### 4.3 Multiple campaigns per child

A single intelligence child can produce many queue entries, each graduating
to a separate business campaign. The stage distribution counts **campaigns**
(one per prospect), not children. This is correct — the PG cares about
prospect-level progression.

**No gap.** But the distribution should be labeled "prospects in pipeline" not
"children in pipeline" to avoid confusion.

### 4.4 Archived / lost / dead / resurrected campaigns

The stage distribution should include inactive stages (`lost`, `dead`,
`tenant_onboarded`) because they're valid pipeline outcomes. The operator
needs to see "2 lost, 1 dead" to understand the launch's failure rate.

**Gap:** The culture-fit analysis's example shows `lost/dead: 0` as a single
bucket. The implementation should render each terminal stage separately (lost,
dead, tenant_onboarded) since they have different meanings:
- `lost` = the prospect said no.
- `dead` = the campaign was killed (duplicate, bad fit, etc.).
- `tenant_onboarded` = the prospect converted and was onboarded.

**No structural gap** — the `groupBy(['stage'])` query returns all stages
including terminal ones. The frontend just needs to render them all.

### 4.5 Deduplicated and merged prospects

When a dedup verdict marks two seeds as `same_entity` and merges into one,
the merged-away seed's queue entry may still exist. The stage distribution
should not double-count merged prospects.

**Gap:** The current aggregation doesn't account for dedup verdicts. If seed
A and seed B are merged into seed A, and both had queue entries that
graduated to campaigns, the distribution would count both campaigns.

**Resolution options:**
- **A.** Exclude campaigns whose queue entry's seed was merged away (join
  through `mkt_prospect_dedup_verdicts` where `verdict='same_entity'` and
  `seed_id != merge_into`).
- **B.** Accept the double-count for v1 (dedup verdicts are rare; the
  operator can visually reconcile). Add the exclusion in the dedicated
  endpoint (§6.2 of the culture-fit analysis) when it ships.

**Recommendation:** Option B for the frontend-only v1. Option A when the
dedicated endpoint ships.

---

## 5. Scope and Grouping Gaps

### 5.1 `promoteToProvingGround` hardcodes `scope: 'city'`

The culture-fit analysis (§5.3) identifies this as the main scope-flex gap.
The guardrail already supports `scope='category'` and null-city/state
signatures, but the promotion path forces `scope: 'city'` — **and hard-
requires non-empty `category` AND `city` (lines ~982-987)**. Scope flex means
making those validations conditional on scope, not just threading a scope
param through: a category-scope PG has no city; a state/mixed PG may have
neither.

**Status:** Deferred enhancement, not a cohesion blocker. The stage-awareness
layer works regardless of PG scope (it reads through the queue linkage, not
the PG's geography).

### 5.2 Mixed-scope PG (the hard case)

The culture-fit analysis (§5.4) presents Option A (PG as pure parent, no
fixed geography) vs Option B (PG inherits broadest child geography).

**Status:** Deferred. Under the batch-label framing, a mixed PG is just a
batch of children from different geographies. This is architecturally clean
but requires a guardrail signature change for the mixed case (name-based
discriminator). Not needed for the cohesive baseline.

### 5.3 Queue-list initiation

The culture-fit analysis (§5.5) proposes initiating a PG from the queue list
(without an intelligence intermediary). This needs either a
`proving_ground_id` column on `mkt_prospect_queue` or a lightweight
intelligence-scope "shell" campaign.

**Status:** Deferred. The current path (PG ← intelligence ← business) is
proven and sufficient for the cohesive baseline.

---

## 6. Checklist and Preflight Gaps

### 6.1 PG-01 steps have `stage_tag = null` — not affected by the seed-stage re-tagging

The seed script's STEPS array does not set `stage_tag` on any step, so they
default to null. The `PERMANENT_STEP_STAGES` window (line 339:
`['seek', 'preview_built']`) only applies to **permanent code-defined steps**
(the seed-first wedge), not to catalog steps like PG-01.

**No gap.** The seed-stage sprint's proposal to add `seed` to
`PERMANENT_STEP_STAGES` and re-tag permanent steps 5–9 to `seed` does not
affect PG-01 (which has null stage_tags and is always visible).

**But:** The seed-stage sprint proposes adding `seed` to
`PERMANENT_STEP_STAGES`:
```ts
const PERMANENT_STEP_STAGES = new Set(['seek', 'seed', 'preview_built']);
```
This affects **business-scope campaigns only** (line 798:
`showSeedSteps = showPermanent && campaignScope === 'business'`). The PG
parent (scope=city/category) is excluded by the `campaignScope === 'business'`
check. So PG-01 steps remain always visible (they're catalog steps with null
stage_tags), and the permanent seed-first steps are visible only for
business-scope campaigns in `seek`/`seed`/`preview_built`.

**No gap.** The separation is clean.

### 6.2 Preflight gate enforcement

The spec §4.10 says preflight gates outreach via a **worklist-availability
gate** (not stage transitions). The cadence service enforces this implicitly:
it requires `seed_id` (line 165–167), which only exists after preflight step 2
(seeding). Without `seed_id`, `logTouch` throws `not_seeded`.

**No gap.** The gate is enforced by the `seed_id` requirement, not by stage
transitions.

### 6.3 Preflight completion vs. business campaign graduation

**Question:** Must the PG preflight be complete before business campaigns can
be created from the queue?

**Current behavior:** `createCampaignFromQueue` doesn't check preflight
completion. An operator could graduate a queue entry to a business campaign
before the preflight is done.

**Is this a gap?** Probably not — the preflight is about the *batch* (the
whole city's readiness), not about individual prospects. An operator might
graduate a hot prospect before the full preflight is complete. The preflight
gate is on the worklist (outreach), not on campaign creation.

**No gap.** But worth documenting: the preflight gates outreach, not
graduation.

---

## 7. Cadence and Outreach Gaps

### 7.1 Cadence operates on queue/seed records, not PG parent stages

The cadence service (`ProvingGroundCadenceService.logTouch`) operates on
`mkt_prospect_queue` entries with `seed_id`. It never reads or writes the PG
parent's stage. This is correct — cadence is a per-prospect concern.

**No gap.**

### 7.2 Canonical touch storage

Touches are stored in `directory_seed_outreach_touches` (the canonical
record) and mirrored to `mkt_outreach_log` after graduation. This matches
spec §4.8.

**No gap.**

### 7.3 Stage awareness and cadence are separate concerns

The stage distribution (awareness) reads `campaign_stage` from graduated
campaigns. The cadence engine writes to `directory_seed_outreach_touches` and
advances the queue ladder. These are independent:
- A prospect can be in cadence (queue `queued`, touches being logged) and
  have `campaign_stage = null` (not yet graduated).
- A prospect can be graduated (`campaign_stage = 'seed'`) and no longer in
  cadence (queue `campaign_created`, cadence exited).

**No gap.** The separation is clean.

---

## 8. Funnel and Metrics Gaps

### 8.1 What the PG funnel counts (seed funnel) vs. what stage distribution counts (pipeline)

| Metric | Source | Counts |
|---|---|---|
| Seed funnel (`getCohortFunnel`) | `directory_presence_seeds` | Seeds, contactable, invited, claimed, converted, touches, CAC |
| Stage distribution (new) | `mkt_campaigns_list.stage` via queue | seek, seed, preview_built, shown, paid, delivered, lost, dead, tenant_onboarded |

These are complementary, not overlapping:
- The seed funnel measures **seed-level** outcomes (did the owner claim? did
  they convert?).
- The stage distribution measures **campaign-level** progression (where is
  the business campaign in the pipeline?).

**No gap.** But the cockpit should render both clearly separated — the funnel
panel (existing) and the stage distribution panel (new) answer different
questions.

### 8.2 Stage counts should include all campaigns, not just active

The `groupBy(['stage'])` query returns all stages including `lost`, `dead`,
`tenant_onboarded`. The frontend should render all of them, not filter to
"active" stages only. The operator needs to see the full outcome
distribution.

**No structural gap.** Frontend rendering decision.

---

## 9. Frontend / Operator Experience Gaps

### 9.1 Minimum first-class PG cockpit surface

| Surface | Status | Notes |
|---|---|---|
| Header (city/category, gate chips) | **Built** | Existing cockpit. |
| Children panel (intelligence by focus) | **Built** | Existing. |
| Preflight panel (PG-01 checklist) | **Built** | Existing. |
| Funnel dashboard (seed funnel) | **Built** | Existing. |
| Gap log panel | **Built** | Existing. |
| Promote/dismiss/seed actions | **Built** | Existing. |
| **Stage distribution panel** | **Missing** | The core awareness feature. Frontend-only for the basic case. |
| **Campaign-list drill-down** (`?provingGround=<id>&stage=<stage>`) | **Missing** | Needs a new `provingGroundId` filter on `listCampaigns` (queue join + `parent_campaign_id` union) AND `useSearchParams` wiring in `CampaignListClient` — neither exists. |
| Due-today mini-list | **Built** | Existing (queue entries with `next_touch_at`). |

**Gap:** Only the stage distribution panel is missing. Everything else is
built.

### 9.2 The stage distribution panel is frontend-only for the basic case

The cockpit already loads queue entries with `includeCampaigns: true`. Each
entry carries `campaign_stage`. The aggregation is a `useMemo` over the
already-loaded entries (see §4.2 above for the corrected aggregation logic).

**No backend work needed for the basic case.** The dedicated endpoint
(culture-fit §6.2) is a later optimization for large PGs and drill-down.

### 9.3 The PG does not expose child internals

The cockpit renders intelligence children by focus (competitive / emerging),
linking to their detail pages. It does not render the children's profiles,
gold standards, or discoveries. This matches the batch-label framing — the PG
is opaque to child internals.

**No gap.**

---

## 10. Implementation Sequence

### 10.1 Reconciled ship order

```
1. Documentation reconciliation (no code)
   ├─ Update spec §11 ("no new stage names" → "no new PG parent stage names")
   ├─ Update spec to describe the observer role (stage awareness)
   ├─ Reconcile PG-01 step drift (spec §4.3 vs seed script)
   └─ Update seed-stage sprint to acknowledge PG-graduated campaigns
      (seed-stage steps may be auto-completed when seed_id is non-null)

2. Seed stage (structural — CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md)
   └─ Migration 280, transition maps, STAGE_DATE_FIELDS, checklist re-tagging,
      frontend stage labels, track remaps, customer-hidden stages

3. PG stage-awareness panel (frontend-only)
   ├─ Add stage distribution useMemo to ProvingGroundCockpitClient
   ├─ Render distribution bar/chip row
   └─ Corrected aggregation (§4.2 — distinguish by status first)

4. PG scope flex (deferred — later enhancement)
   ├─ promoteToProvingGround accepts scope='city'|'category'
   ├─ attachChildCampaign relaxed for mixed PGs
   └─ Queue-list initiation (proving_ground_id column or shell campaign)

5. Dedicated stage-distribution endpoint (deferred — when PGs grow large)
   └─ GET /api/admin/marketing-ops/:campaignId/stage-distribution
      with dedup-verdict exclusion (§4.5)
```

### 10.2 Migration and type synchronization

- The `seed` stage requires **no migration** for the `stage` column (it's
  `VARCHAR(50)` with no CHECK constraint — verified).
- The `seed` stage requires `date_seed` column addition (migration 280 per
  the seed-stage sprint plan).
- The PG stage-awareness frontend aggregation requires **no migration** (it
  reads existing columns). The **dedicated endpoint does:** neither
  `mkt_prospect_queue.source_campaign_id` nor
  `mkt_campaigns_list.parent_campaign_id` is indexed — ship a numbered
  migration adding both `@@index`es with the endpoint, since it exists for
  the large-PG case where the seq-scans hurt.
- The PG scope flex requires **no migration** (the guardrail already supports
  category/city scope + null city/state).

### 10.3 Test updates required

- **Seed stage:** update `transitionStage` tests, `STAGE_DATE_FIELDS` tests,
  checklist stage-tag tests, frontend stage-label tests, customer-projection
  hidden-stage tests, track-remap tests. (All listed in the seed-stage sprint
  plan.)
- **PG stage awareness:** no new backend tests needed for the frontend-only
  v1. The aggregation is a `useMemo` — test via component render or manual
  verification.
- **PG scope flex:** new tests for `promoteToProvingGround` with
  `scope='category'`, mixed-scope attach, and guardrail signatures.

---

## 11. Must-Have Corrections vs. Deferred Enhancements

### Must-have before implementation

1. **Reconcile PG-01 step drift** (§2.1) — decide which step list is canonical
   and update the stale document. This is documentation-only but must happen
   before the seed stage lands (the seed stage interacts with the checklist
   system).

2. **Update spec §11** (§2.2) — the "no new stage names" non-goal must be
   scoped to the PG parent, not the entire PG system. The `seed` stage applies
   to downstream business campaigns.

3. **Add observer-role description to the spec** (§2.3) — the spec doesn't
   mention stage awareness. Reference the culture-fit analysis or add a new
   section.

4. **Seed-stage sprint: acknowledge PG-graduated campaigns** (§3.1) — the
   seed-stage checklist steps (create/QC/publish/mint/invite) may be
   auto-completed when `queue.seed_id` is non-null. Document this interaction.

### Deferred enhancements (not blockers)

1. **PG scope flex** (§5) — `promoteToProvingGround` accepting
   `scope='category'`, mixed-scope PGs, queue-list initiation.

2. **Dedicated stage-distribution endpoint** (§4.5, culture-fit §6.2) —
   needed only when PGs grow past the entry-load limit or drill-down is
   needed. Ships with the two tree-column indexes (§10.2) and the
   `parent_campaign_id` union for queue-invisible business grandchildren
   (§4.2 v2 notes).

3. **Campaign-list drill-down filter** (§9.1) — `provingGroundId` on
   `listCampaigns` + `useSearchParams` in `CampaignListClient`. Only needed
   when the stage counts become links.

4. **`resolveBusinessProvingGround` third hop** — `parent_campaign_id → PG`
   (directly or via an intelligence parent) so non-queue-linked business
   campaigns keep the "View Proving Ground" link. Bundles with §5 attach
   relaxation.

5. **Dedup-verdict exclusion in stage distribution** (§4.5) — exclude
   merged-away seeds from the count. Acceptable to double-count for v1.

6. **GBP enrichment dedup** (§3.3) — avoid redundant enrichment when the
   preflight already enriched the listing.

---

## 12. Acceptance Criteria

### 12.1 The PG can group independent children

- [ ] A PG parent (city/category scope, `campaign_category='proving_ground'`)
      can have multiple intelligence children attached via
      `parent_campaign_id`.
- [ ] Each child carries its own profiles, gold standards, and discoveries
      without the PG inspecting them.
- [ ] The cockpit renders children by focus, not by internal data.

### 12.2 Child internals remain opaque to the PG

- [ ] The PG cockpit does not render child profiles, gold standards, or
      discoveries.
- [ ] The PG's stage-awareness aggregation reads only `campaign_stage` from
      graduated business campaigns, not child intelligence data.

### 12.3 Business campaigns progress through `seek → seed → preview_built → ...`

- [ ] After the `seed` stage ships, business-scope campaigns can transition
      `seek → seed → preview_built`.
- [ ] The transition map enforces `seek → ['seed', 'dead']` and
      `seed → ['preview_built', 'dead']`.
- [ ] `date_seed` is stamped on `seek → seed`.

### 12.4 PG stage awareness updates as downstream campaigns progress

- [ ] When a business campaign transitions to `seed`, the PG's stage
      distribution reflects the new count (on cockpit reload).
- [ ] The distribution includes all stages: `seek`, `seed`, `preview_built`,
      `shown`, `paid`, `delivered`, `lost`, `dead`, `tenant_onboarded`.
- [ ] Pre-graduation queue entries are counted as "still in queue," not in a
      stage bucket.

### 12.5 Queue/seed deployment remains independent from campaign stage transitions

- [ ] PG preflight seeding (`createSeedsForProvingGround`) stamps `seed_id`
      and leaves `status='queued'` — it does not create a business campaign
      or transition a stage.
- [ ] `createCampaignFromQueue` creates the business campaign at `seek` — it
      does not skip to `seed` even if `seed_id` is already set.
- [ ] The cadence engine operates on queue/seed records and does not read or
      write the PG parent's stage.

### 12.6 No invalid cross-scope stage transitions are introduced

- [ ] The PG parent (scope=city/category) cannot transition stages (the scope
      guard rejects non-business scopes).
- [ ] The `seed` stage is only valid for business-scope campaigns.
- [ ] Intelligence-scope campaigns cannot enter the `seed` stage.

### 12.7 Existing proving-ground functionality remains intact

- [ ] `promoteToProvingGround` still creates city-scope PGs and attaches
      intelligence children.
- [ ] `ProvingGroundCadenceService.logTouch` still logs seed touches, advances
      the ladder, and mirrors to `mkt_outreach_log`.
- [ ] `ProvingGroundDedupService.recordVerdict` still persists verdicts and
      merges name variants.
- [ ] The PG-01 preflight checklist still resolves via
      `resolveEffectivePlaybook` direct-assignment.
- [ ] The seed funnel (`getCohortFunnel`) still reports seed-level metrics.
- [ ] Existing proving-ground tests pass:
      `apps/api/src/services/__tests__/provingGround.test.ts`,
      `apps/api/src/services/__tests__/provingGroundCadence.test.ts`.

---

## 13. Open Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | PG-01 step list: spec or seed script? | A. Update seed script to match spec. B. Update spec to match seed script. C. Merge both. | **B or C** — the seed script is what operators use; verify whether channel-sequence construction is automatic (if so, the spec is stale). |
| D2 | Seed-stage checklist auto-complete for PG-graduated campaigns | A. Auto-complete creation steps when `seed_id` is non-null. B. Operator manually verifies all steps. | **A** — the preflight already did the work; the operator should verify QC and invite, not re-create. |
| D3 | Dedup-verdict exclusion in stage distribution | A. Exclude merged-away seeds from the count. B. Accept double-count for v1. | **B for v1**, **A for the dedicated endpoint.** |
| D4 | Mixed-scope PG guardrail | A. Name-based discriminator (Option A from culture-fit). B. Inherit broadest child geography (Option B). | **Defer** — not needed for the cohesive baseline. |
| D5 | Queue-list PG initiation | A. `proving_ground_id` column on queue. B. Lightweight intelligence shell campaign. | **Defer** — the current path is proven. |

---

## 14. Conclusion

The proving-ground backend is substantially built and matches the spec on all
major architectural points: migration 262, cadence engine, dedup service,
preflight seed script, checklist direct-assignment, and the cockpit.

The gaps that remain before implementation are:

1. **Documentation drift** (PG-01 steps, "no new stage names" non-goal) —
   must be reconciled before the seed stage lands, but requires no code
   changes.

2. **The stage-awareness panel** — the core "PG as observer" feature. The
   signal is already flowing (queue entries carry `campaign_stage`). The
   basic case is a frontend-only `useMemo` aggregation. This is the single
   highest-value, lowest-risk addition.

3. **The seed-stage × PG-graduated interaction** — when the PG preflight
   already created the seed, the business campaign's `seed` stage should
   auto-complete the creation steps. This needs to be documented in the
   seed-stage sprint plan.

The deferred enhancements (PG scope flex, dedicated endpoint, dedup-verdict
exclusion, mixed-scope guardrail) are not blockers. The stage-awareness layer
works regardless of PG scope and benefits from the richer stage set once
`seed` ships.

**Ship order:** documentation reconciliation → `seed` stage → PG
stage-awareness panel → (deferred) PG scope flex → (deferred) dedicated
endpoint.
