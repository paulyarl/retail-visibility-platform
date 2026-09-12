# Proving Ground × Stage Culture — Fit Analysis

> **Question:** Can the proving ground module fit the campaign stage culture,
> and would the fit be mutual (both systems benefit)?
>
> **Answer:** **Yes — as a read-only awareness layer, not a transition
> participant.** The proving ground is a location/category wrapper that sits
> on top of the queue and feeds the stage pipeline starting from `seek`. The
> best integration is for the wrapper to be **aware** of the stages of its
> wrapped prospects — observing and aggregating the stage distribution of the
> business-scope campaigns it has spawned, without itself transitioning
> through stages.
>
> This is mutual:
> - **The proving ground gains** a "where are my prospects in the funnel?"
>   view that answers "is this city launch working?" at a glance — without
>   leaving the cockpit or joining the per-business pipeline by hand.
> - **The stage culture gains** a natural aggregation surface — the proving
>   ground becomes the "deployment view" of the stage pipeline, a roll-up the
>   per-business stages cannot produce on their own.

---

## 1. The Layered Model — PG as a Batch, Not a Container

The seed batch pattern provides the cleanest analogy:

- **Seed batch**: `createSeedsFromBatch(queueEntryIds, seedBatch)` takes a set
  of queue entries, creates a seed for each, all tagged with the same
  `seed_batch` label. Each seed is independent — it progresses through its own
  lifecycle (draft → published → invited → claimed). The batch is just a
  grouping label. The batch doesn't know or care what's inside each seed.
- **PG mix**: each child (intelligence campaign) is like a seed in a batch.
  The child has its own profiles, gold standards, discoveries, audits — its
  own internal intelligence work. The PG is the batch label. The PG does not
  care what profiles the child uses. It only cares about the **end-to-end
  stage progression** of the business-scope campaigns that graduate from the
  child's queue.

```
┌─────────────────────────────────────────────────────────────┐
│  PROVING GROUND (the batch label — like seed_batch)         │
│  scope ∈ {city, category, state, mixed}                     │
│  campaign_category = 'proving_ground'                       │
│  Stays at 'seek' forever. Never transitions.                │
│  Does NOT care what profiles/gold-standards each child uses.│
│  Only cares: where are the spawned prospects in the stages? │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ CHILD A (intel) │  │ CHILD B (intel) │  │ CHILD C (...)│ │
│  │ own profiles    │  │ own profiles    │  │ own profiles │ │
│  │ own gold std    │  │ own gold std    │  │ own gold std │ │
│  │ own discoveries │  │ own discoveries │  │ own discov.  │ │
│  │ → queue rows    │  │ → queue rows    │  │ → queue rows │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                     │                  │         │
│           └─────────┬──────────┘──────────────────┘         │
│                     ▼                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  QUEUE (prospect rows, already decorated with         │  │
│  │  campaign_stage via includeCampaigns)                  │  │
│  │  source_campaign_id → child                           │  │
│  │  seed_id → directory_presence_seeds                   │  │
│  │  processed_campaign_id → business-scope campaign     │  │
│  │  campaign_stage ← the stage signal (already flowing)  │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │ createCampaignFromQueue           │
│                          ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  STAGE PIPELINE (business-scope campaigns)            │  │
│  │  seek → seed → preview_built → shown → paid → ...     │  │
│  │  One campaign per prospect. Transitions operator-      │  │
│  │  initiated. Timestamped. Checklist soft-gated.        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

The PG is a grouping label over children. Each child is an opaque unit that
carries its own intelligence work. The PG's only signal of interest is the
stage progression of the business campaigns that graduate from each child's
queue — and that signal is **already flowing** (the queue list decorates
each entry with `campaign_stage` via `includeCampaigns`, line ~500 of
`MarketingProspectQueueService.ts`).

---

## 2. Why the Proving Ground Doesn't *Have* Stages (Still Correct)

The spec's decision (§4.10, §11) to keep the proving ground stage-less remains
correct. The proving ground is a deployment-scope workspace aggregating many
prospects at different funnel positions. One stage cannot represent that. The
scope guard (`scope !== 'business'` → `ValidationError`) is the right hard
wall — the proving ground must not transition.

**What changes from the first analysis:** the proving ground doesn't need to
*transition* through stages to be *aware* of stages. Awareness is a read-only
aggregation concern — observing the `stage` column of spawned business-scope
campaigns and rolling it up into a distribution. No transition, no scope guard
conflict, no new stage machine.

---

## 3. What Already Exists (The Signal Is Already Flowing)

### 3.1 Business campaign → Proving Ground (exists)

`resolveBusinessProvingGround` (line ~1206) already traces a business-scope
campaign back to its proving ground:

```
business campaign → mkt_prospect_queue.processed_campaign_id
                 → queue.source_campaign_id
                 → intelligence child or PG itself
                 → if intelligence child: parent_campaign_id → PG
```

This powers the "View Proving Ground" link on the business campaign detail
page.

### 3.2 Queue entries already carry the stage signal (the key finding)

The queue list (`MarketingProspectQueueService.list`, line ~494) already
decorates each entry with `campaign_stage` when `includeCampaigns: true`:

```ts
const decorated = entries.map((e) => {
  const camp = e.mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list;
  return {
    ...rest,
    campaign_stage: camp?.stage ?? null,        // ← the stage signal
    campaign_category: camp?.category ?? null,
    repair_track: camp?.repair_track ?? null,
    is_hot_prospect: camp?.is_hot_prospect ?? null,
    stage_entered_at: camp?.stage_entered_at ?? null,
    campaign_has_business_audit: ...,
    business_audit_at: ...,
  };
});
```

The PG cockpit already loads these entries:
```ts
marketingOpsService.listProspectQueue({
  source_campaign_ids: ids,
  includeCampaigns: true,   // ← already passing this
  ...
})
```

**The stage signal is already in the cockpit's data.** The cockpit currently
uses it only for the due-today list and the promote panel. Aggregating it into
a stage distribution is a frontend-only change — no new endpoint required for
the basic case (the entries are already loaded with `campaign_stage`).

### 3.3 Proving ground → children (exists, intelligence-only)

The cockpit loads `camp.children` — intelligence-scope discovery campaigns.
The children panel renders them by focus (competitive / emerging). Each child
is an opaque unit carrying its own profiles, gold standards, and discoveries.
The PG does not inspect the child's internals — it only observes the stage
progression of the business campaigns that graduate from the child's queue.

### 3.4 What's missing: the aggregation (frontend-only for the basic case)

The gap is not a data-flow gap — the signal is already flowing. The gap is an
**aggregation**: the cockpit loads N queue entries each carrying
`campaign_stage`, but it doesn't group them by stage and render the
distribution. For the basic case (PG with intelligence children), this is a
frontend-only change — group the already-loaded entries by `campaign_stage`
and render a distribution bar.

For the full case (large PGs, drill-down, historical trends), a dedicated
`getProvingGroundStageDistribution` endpoint (§6.1) avoids loading all 200+
entries just to count stages.

---

## 4. The Fit: Stage Awareness for the Wrapper

### 4.1 What the proving ground sees

A stage distribution roll-up of its spawned business-scope campaigns:

```
Proving Ground: Madison Grocery
├── 24 prospects in the pipeline
│   ├── seek:           8  (not yet seeded)
│   ├── seed:           5  (seeded, claim invited)
│   ├── preview_built:  4  (pitch built, awaiting show)
│   ├── shown:           3  (pitch shown, awaiting payment)
│   ├── paid:            2  (paid, in fulfillment)
│   ├── delivered:       1  (delivered)
│   ├── tenant_onboarded: 1 (converted)
│   └── lost/dead:       0
├── 6 prospects still in queue (not yet graduated to campaigns)
└── 3 prospects dismissed
```

This tells the launch operator: "most of my prospects are still in seek/seed —
the wedge is working but the pitch hasn't landed yet. Two have paid. The launch
is alive but not yet converting."

### 4.2 Why this is mutual

**Proving ground benefits:**
- The cockpit's "is this deployment working?" question gets a direct answer
  from the stage distribution, complementing the seed funnel metrics (which
  measure seeds/claims, not pipeline progression).
- The operator can see bottlenecks: if 8 prospects are stuck at `seek` and 0
  at `seed`, the seed wedge isn't being executed. If 4 are at `preview_built`
  and 0 at `shown`, the pitch isn't landing.
- The due-today worklist (queue rows) and the stage distribution (campaign
  rows) are two views of the same funnel — the queue is "pre-graduation" and
  the stages are "post-graduation." Together they give the full picture.

**Stage culture benefits:**
- The proving ground becomes the natural "deployment view" of the stage
  pipeline — a roll-up that the per-business `getDashboardStats` (which
  aggregates across ALL campaigns) cannot provide. The PG-scoped view answers
  "how is this category in this city/state progressing through the funnel?" —
  a question the stage pipeline alone can't answer because it has no
  deployment grouping concept.
- The `seed` stage gets a natural aggregation surface: the PG can show "5
  prospects seeded" as a stage count, reinforcing the seed stage's visibility
  without the PG itself needing to enter the seed stage.

### 4.3 Why this doesn't break the separation

- The proving ground **reads** the `stage` column of business-scope campaigns.
  It does not **write** to it. No transition, no scope guard issue.
- The aggregation is a `groupBy` query joining through the queue's
  `processed_campaign_id` → `mkt_campaigns_list.stage`. No new stage machine,
  no new transition map entry, no change to `transitionStage`.
- The proving ground's own `stage` stays `seek`. The wrapper observes; it does
  not participate.

---

## 5. PG as the Deployment Unit (The Scaling Vision)

### 5.1 The genuine gap

As business deployment scales across states and categories, there is a real
need to group deployments into a unit. Today the platform has:

- **Business-scope campaigns** — one per prospect, in the stage pipeline.
- **Intelligence-scope campaigns** — discovery/establishment runs, data
  containers.
- **Category/city-scope campaigns** — aggregate scans.

What's missing is a **deployment group** — a unit that says "these N prospects
across these M locations in category C are one coordinated launch." The proving
ground is the natural home for this, but today it's locked to
`scope='city'` + one category per PG.

### 5.2 The flexibility spectrum

The PG concept can generalize along two axes:

**Geographic axis:**
- **City-scoped** (current): `scope='city'`, `city='Madison'`, `state='WI'` —
  one city, one or more categories.
- **Category-scoped**: `scope='category'`, `category='Grocery'`, no city —
  all prospects in a category across a region. The guardrail already supports
  this (the category/city-scope branch at line ~579 handles both).
- **State-scoped**: `scope='city'` with `city=null`, `state='WI'` — a
  statewide deployment. The guardrail's null-city semantics already mean
  "nationwide" when both are null; a state-only value means "statewide."
- **Mixed**: a PG whose children span multiple cities/states. The PG itself
  carries no fixed geography; the children carry the specificity.

**Category axis:**
- **Single category** (current): `category='Grocery'`.
- **Multi-category**: an umbrella PG spanning related categories (e.g.,
  "Ethnic Grocery" = Indian + Middle Eastern + African). The spec already
  anticipates this (§4.1: "the Madison tree spans two ethnic categories — one
  proving ground uses the umbrella value `Grocery`").

### 5.3 What needs to flex vs what's already there

| Capability | Current state | Needs to change? |
|---|---|---|
| `CampaignScope` enum | `'business' \| 'category' \| 'city' \| 'intelligence'` | **No** — `city` and `category` already cover the geographic axis. State-scoped = `city` with city=null. Mixed = no fixed geo on the PG row. |
| Guardrail signature | `scope + campaign_category + category + city + state` (line ~581) | **No** — already handles category/city scope + null city/state. A mixed PG with null city+state gets a nationwide signature (one active mixed PG at a time — may need a name-based discriminator). |
| `promoteToProvingGround` | Hardcodes `scope: 'city'` (line ~994) | **Yes** — accept the source campaign's scope (city or category) and pass it through. |
| `attachChildCampaign` guards | Child must be `scope='intelligence'` (or `directory_enrichment`) | **Yes** — relax to allow attaching business-scope campaigns directly (for the "mixture" case where a PG groups businesses from different cities without an intelligence intermediary). |
| Queue → PG linkage | `source_campaign_id` → intelligence child → `parent_campaign_id` → PG | **No** — already works. A business campaign's PG is resolved through the queue entry's source. |
| Stage awareness (new) | Missing | **Yes** — the read-only aggregation from §4. |

### 5.4 The mixed-scoped PG (the hard case)

A mixed PG — businesses from different locations under one roof — is the
architecturally hardest case because it breaks the "one geography per PG"
assumption. Two approaches:

**Option A: PG as a pure parent (no fixed geography).**
The PG row has `city=null`, `state=null`, `category=null` (or an umbrella
label). Its identity is its name + its children. The guardrail would need a
name-based discriminator (two active mixed PGs with the same name → 409).
Children carry all geographic specificity. This is clean but requires a
guardrail signature change for the mixed case.

**Option B: PG inherits the broadest child geography.**
The PG row's `city`/`state`/`category` are set to the broadest common
denominator of its children. A PG with children in Madison WI and Milwaukee WI
gets `state='WI'`, `city=null`. This reuses the existing guardrail but
requires re-keying when children are attached/detached. Fragile.

**Recommendation:** Option A for the mixed case, with the understanding that
mixed PGs are the exception (most deployments are city or category scoped).
The common path stays `scope='city'` or `scope='category'` with a fixed
geography; mixed is an escape hatch for cross-region deployments.

### 5.5 Initiation sources

The user's vision: PG can be initiated from the queue list, a city campaign,
or a category campaign. Today only `promoteToProvingGround` (from an
intelligence discovery campaign) creates a PG. The expansion:

| Initiation source | How it works today | How it would work |
|---|---|---|
| Intelligence discovery campaign | `promoteToProvingGround` — creates city-scope PG, attaches the run | Same, but accept `scope='category'` too |
| Queue list | Not supported | "Group these N queue entries into a PG" — creates a PG and stamps `source_campaign_id` on the queue entries (or a new `proving_ground_id` column) |
| City campaign | Not supported | "Promote this city-scope campaign to a PG" — converts/wraps the city campaign as a PG parent |
| Category campaign | Not supported | "Promote this category-scope campaign to a PG" — same, for category scope |

The queue-list initiation is the most interesting because it doesn't require
an intelligence intermediary — the operator selects prospects from the queue
and groups them into a deployment. This needs either:
- A `proving_ground_id` column on `mkt_prospect_queue` (direct PG → queue
  linkage without going through `source_campaign_id`), or
- Reusing `source_campaign_id` by creating a lightweight intelligence-scope
  "shell" campaign as the intermediary (preserves the existing linkage path).

---

## 6. Implementation Sketch (Read-Only Stage Awareness + PG Flex)

### 6.1 Stage distribution — frontend-only for the basic case

The cockpit already loads queue entries with `includeCampaigns: true`, and
each entry carries `campaign_stage`. For the basic case (the cockpit's current
200-entry load), the stage distribution is a frontend aggregation:

```tsx
// In ProvingGroundCockpitClient, after queue entries are loaded:
const stageDistribution = useMemo(() => {
  const byStage: Record<string, number> = {};
  let stillInQueue = 0;
  let dismissed = 0;
  for (const e of queue.entries) {
    if (e.status === 'dismissed') { dismissed++; continue; }
    if (e.campaign_stage) {
      byStage[e.campaign_stage] = (byStage[e.campaign_stage] ?? 0) + 1;
    } else {
      stillInQueue++;  // graduated campaign not yet created, or stage null
    }
  }
  return { byStage, stillInQueue, dismissed, totalInPipeline: Object.values(byStage).reduce((a, b) => a + b, 0) };
}, [queue.entries]);
```

No new endpoint, no new query. The signal is already there.

### 6.2 Stage distribution — dedicated endpoint (for large PGs + drill-down)

For PGs with many prospects (where loading 200+ entries just to count stages
is wasteful) or for drill-down (filter the campaign list by PG + stage), a
dedicated endpoint avoids the full entry load:

```ts
async getProvingGroundStageDistribution(
  provingGroundId: string,
  ctx?: RequestCtx,
): Promise<{
  totalInPipeline: number;
  byStage: Record<string, number>;
  stillInQueue: number;
  dismissed: number;
}> {
  // 1. Resolve the tree: PG + intelligence children
  const children = await this.prisma.mkt_campaigns_list.findMany({
    where: { parent_campaign_id: provingGroundId },
    select: { id: true },
  });
  const treeIds = [provingGroundId, ...children.map(c => c.id)];

  // 2. Find queue entries graduated to business campaigns
  const queueEntries = await this.prisma.mkt_prospect_queue.findMany({
    where: {
      source_campaign_id: { in: treeIds },
      processed_campaign_id: { not: null },
    },
    select: { processed_campaign_id: true, status: true },
  });

  // 3. Load the business campaigns' stages
  const campaignIds = queueEntries
    .map(e => e.processed_campaign_id)
    .filter((id): id is string => id != null);

  const stageGroups = await this.prisma.mkt_campaigns_list.groupBy({
    by: ['stage'],
    where: { id: { in: campaignIds } },
    _count: { id: true },
  });

  // 4. Build the distribution
  const byStage: Record<string, number> = {};
  stageGroups.forEach(g => { byStage[g.stage] = g._count.id; });

  // 5. Count queue-only and dismissed
  const allQueue = await this.prisma.mkt_prospect_queue.count({
    where: { source_campaign_id: { in: treeIds } },
  });
  const dismissed = await this.prisma.mkt_prospect_queue.count({
    where: { source_campaign_id: { in: treeIds }, status: 'dismissed' },
  });

  return {
    totalInPipeline: campaignIds.length,
    byStage,
    stillInQueue: allQueue - campaignIds.length - dismissed,
    dismissed,
  };
}
```

Route: `GET /api/admin/marketing-ops/:campaignId/stage-distribution` (gated to
`proving_ground` campaigns).

**Ship order:** frontend aggregation first (§6.1 — zero backend work), then
the dedicated endpoint (§6.2) when PGs grow past the entry-load limit or
drill-down is needed.

### 6.2 Frontend: cockpit stage distribution panel

A new panel in the proving ground cockpit, between the funnel metrics and the
preflight checklist, rendering the stage distribution as a horizontal bar or
chip row — mirroring the pipeline bar from the campaign detail page but
aggregated across all spawned prospects:

```
┌──────────────────────────────────────────────────────────┐
│  Prospect pipeline stages                                │
│                                                          │
│  seek 8 │ seed 5 │ preview_built 4 │ shown 3 │ paid 2 │  │
│  delivered 1 │ tenant_onboarded 1                          │
│                                                          │
│  6 still in queue · 3 dismissed                          │
└──────────────────────────────────────────────────────────┘
```

Each stage count links to a filtered campaign list (`?provingGround=<id>
&stage=<stage>`), so the operator can drill into the prospects at each stage.

### 6.3 PG scope flex (ships after stage awareness)

- `promoteToProvingGround`: accept `scope?: 'city' | 'category'` (default
  `city`); pass through to `createCampaign`.
- `attachChildCampaign`: for mixed PGs, relax the `scope='intelligence'`
  guard to also accept `scope='business'` when the PG has no fixed geography
  (mixed case). The business campaign links directly to the PG as a child.
- Queue-list initiation: add `proving_ground_id` to `mkt_prospect_queue`
  (nullable FK → `mkt_campaigns_list`), set when an operator groups queue
  entries into a PG from the queue board. The stage distribution query
  includes `proving_ground_id` in its `treeIds` set.

### 6.4 What this does NOT change

- No new stage on the proving ground.
- No transition map entry for the proving ground.
- No scope guard change.
- No `STAGE_DATE_FIELDS` entry.
- No checklist re-tagging.
- The `seed` stage sprint is unaffected — the proving ground simply reads
  whatever stages exist, including `seed` once it ships.

---

## 7. Relationship to the `seed` Stage Sprint

The `seed` stage and the proving ground's stage awareness are complementary,
not coupled:

- The `seed` stage makes the per-prospect seed wedge first-class in the
  pipeline. The proving ground's stage distribution will show `seed: N` counts
  once the `seed` stage ships, giving the launch operator a view of how many
  prospects have been seeded.
- The proving ground's stage awareness works with any stage set — it reads
  the `stage` column and groups by whatever values exist. Adding `seed` later
  doesn't require a change to the distribution endpoint.
- If the `seed` stage ships first, the proving ground's stage distribution
  immediately benefits (it shows the seed count). If the stage awareness ships
  first, it works with the current stages and gains `seed` for free when the
  stage sprint lands.

**Recommended order:** ship the `seed` stage first (it's the structural
change), then add the proving ground stage awareness (it's a read-only
addition that benefits from the richer stage set), then flex the PG scope
(the stage awareness already works regardless of how the PG is scoped).

---

## 8. Conclusion

The PG is a **batch label**, not a container — the same pattern as
`seed_batch` on directory presence seeds. Each child (intelligence campaign)
is an opaque unit carrying its own profiles, gold standards, and discoveries.
The PG does not care what profiles the child uses. It only cares about the
**end-to-end stage progression** of the business-scope campaigns that graduate
from the child's queue.

The fit is mutual, and it's an **awareness** fit, not a **transition** fit:

- The PG is a deployment wrapper (batch label) over children. It feeds the
  stage pipeline at `seek` via `createCampaignFromQueue`.
- The wrapper should be **aware** of the stages of its wrapped prospects —
  a read-only aggregation of the `campaign_stage` signal that is **already
  flowing** through the queue's `includeCampaigns` decoration.
- The PG does not transition through stages itself (the scope guard stays;
  the spec's stage-less design is correct).
- The stage culture gains a "deployment view" roll-up that the per-business
  pipeline cannot produce on its own.
- The `seed` stage and the stage awareness are complementary — the awareness
  layer reads whatever stages exist, including `seed` once it ships.

The PG's longer-term evolution — from city-scoped to flex-scoped (city /
category / state / mixed) — is a natural generalization that the existing
guardrail and scope enum mostly already support. The mixed case is simplest
under the batch-label framing: a mixed PG is just a batch of children from
different cities/categories, each carrying its own geography. The PG doesn't
need a fixed geography — it's a grouping label, like `seed_batch`.

The stage signal is already flowing (queue entries carry `campaign_stage`).
The basic stage distribution is a **frontend-only aggregation** — no new
endpoint required. The dedicated endpoint is a later optimization for large
PGs and drill-down.
