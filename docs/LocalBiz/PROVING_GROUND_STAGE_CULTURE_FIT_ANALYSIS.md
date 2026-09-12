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
>
> **Review note (v2 — post-gap-analysis reconciliation):** the implementation
> sketches in §6 have been corrected against the codebase and against
> `PROVING_GROUND_PRE_IMPLEMENTATION_GAP_ANALYSIS.md` (which reviewed this
> document). Corrections: the cockpit's status filter excludes `dismissed`;
> stage buckets must count distinct campaigns, not queue rows; the endpoint's
> `stillInQueue` must come from queue-status buckets, not subtraction;
> business grandchildren linked via `parent_campaign_id` (not the queue) need
> a union in the distribution and a third hop in `resolveBusinessProvingGround`;
> `promoteToProvingGround` hard-requires `city` + `category`; and the
> `seed` bucket is stage-based, while "has been seeded" today lives on
> `queue.seed_id`. §9 carries the review changelog.

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
├── 24 prospects in the pipeline (distinct graduated campaigns)
│   ├── seek:            8
│   ├── seed:            5  (stage — 0 until migration 280 ships AND the
│   │                      operator transitions; see §7 for the seed_id caveat)
│   ├── preview_built:   4
│   ├── shown:           3
│   ├── paid:            2
│   ├── delivered:       1
│   ├── tenant_onboarded:1
│   ├── lost:            0  (terminal stages render separately — lost = said
│   ├── dead:            0   no, dead = killed; see pre-impl gap §4.4)
│   └── …other stages as they appear (retainer_*, *_submitted, recovery
│       stages for escalated campaigns — render arbitrary keys, §6.3)
├── 6 prospects still in queue (queued / hold / in_thread, pre-graduation)
│   └── of which 4 seeded (queue.seed_id set — the wedge already deployed)
└── 3 prospects dismissed
```

Note the two different "seeded" signals: the `seed` **stage** bucket counts
graduated campaigns the operator moved through `seek → seed`; the
`seed_id`-based count measures the PG-preflight wedge on the queue side. They
are related but not interchangeable (§7).

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
| `promoteToProvingGround` | Hardcodes `scope: 'city'` (line ~994) AND hard-requires non-empty `category` + `city` (lines ~982-987) | **Yes** — accept the source campaign's scope (city or category), pass it through, and make the `city`/`category` requirements conditional on scope (§6.4). |
| `attachChildCampaign` guards | Child must be `scope='intelligence'` (or `directory_enrichment`) | **Yes** — relax to allow attaching business-scope campaigns directly (for the "mixture" case) — AND update every linkage reader (`resolveBusinessProvingGround`, the distribution query, the cockpit attach/children UI). See §6.4. |
| Queue → PG linkage | `source_campaign_id` → intelligence child → `parent_campaign_id` → PG | **Mostly** — works for queue-graduated campaigns, but business campaigns created via the `parent_campaign_id` create-time passthrough / derive flows (business grandchildren) bypass the queue entirely and are invisible to both the resolver and the distribution. Needs the `parent_campaign_id` union/hop (§6.2). |
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
  linkage without going through `source_campaign_id`) — every linkage reader
  must learn the column with `OR` semantics and entry-level dedup; see §6.4
  for the full reader list, or
- Reusing `source_campaign_id` by creating a lightweight intelligence-scope
  "shell" campaign as the intermediary (preserves the existing linkage path
  but severs the entry's link to the discovery run that actually sourced it —
  `source_audit_id`/`discovery_provenance` partially compensate).

---

## 6. Implementation Sketch (Read-Only Stage Awareness + PG Flex)

### 6.1 Stage distribution — frontend-only for the basic case

The cockpit already loads queue entries with `includeCampaigns: true`, and
each entry carries `campaign_stage`. For the basic case (the cockpit's current
200-entry load), the stage distribution is a frontend aggregation — **with
four corrections** the naive version gets wrong:

1. **`dismissed` is not in the cockpit's load.** The queue call filters
   `status: ['queued','in_thread','hold','verify_then_outreach','campaign_created']`
   — `dismissed` rows never arrive, so counting them in the loop always
   yields 0. Either add `'dismissed'` to the status filter (cheap — they're
   just more rows) or issue a separate `status=dismissed` count request.
2. **Bucket by distinct campaign, not queue row.** Two queue entries for the
   same business can both graduate into the *same* `processed_campaign_id`
   (the AC84 `campaign_exists` path marks the second entry
   `campaign_created` against the pre-existing campaign). Counting entries
   double-counts the stage. Dedupe on `processed_campaign_id`.
3. **Count by queue `status` first, stage second.** A `campaign_created`
   entry with null `campaign_stage` is a data error, not "still in queue"
   (pre-impl gap §4.2). And `hold`/`in_thread` are still-in-queue but worth
   their own sub-buckets.
4. **The 200-entry cap silently truncates.** If `queue.entries.length ===
   limit`, the distribution is a partial view — surface a caveat or fall
   back to the dedicated endpoint (§6.2).

```tsx
// In ProvingGroundCockpitClient — request dismissed too, so the bucket works:
//   status: ['queued','in_thread','hold','verify_then_outreach',
//            'campaign_created','dismissed']
const stageDistribution = useMemo(() => {
  const campaignStageById = new Map<string, string | null>();
  let stillInQueue = 0;
  let seededPreGraduation = 0;   // queue.seed_id set, no campaign yet
  let dismissed = 0;
  for (const e of queue.entries) {
    if (e.status === 'dismissed') { dismissed++; continue; }
    if (e.status === 'campaign_created' && e.processed_campaign_id) {
      // Dedupe: several queue rows can point at one campaign (AC84).
      campaignStageById.set(e.processed_campaign_id, e.campaign_stage ?? 'seek');
    } else {
      stillInQueue++;  // queued / hold / in_thread / verify_then_outreach
      if (e.seed_id) seededPreGraduation++;
    }
  }
  const byStage: Record<string, number> = {};
  for (const stage of campaignStageById.values()) {
    byStage[stage ?? 'seek'] = (byStage[stage ?? 'seek'] ?? 0) + 1;
  }
  return {
    byStage,
    stillInQueue,
    seededPreGraduation,
    dismissed,
    totalInPipeline: campaignStageById.size,
    truncated: queue.entries.length >= 200,  // partial view — show caveat
  };
}, [queue.entries]);
```

No new endpoint, no new query — but the status filter must include
`dismissed`, and the renderer must label arbitrary stage keys (recovery-track
stages like `audit_identified` appear on escalated campaigns; don't hardcode
the review-stage map).

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
  seededPreGraduation: number;
  dismissed: number;
}> {
  // 1. Resolve the tree: PG + children (one level — the attach guard +
  //    create-time passthrough can produce deeper trees; if business
  //    grandchildren are in scope, recurse or union as below).
  const children = await this.prisma.mkt_campaigns_list.findMany({
    where: { parent_campaign_id: provingGroundId },
    select: { id: true },
  });
  const treeIds = [provingGroundId, ...children.map(c => c.id)];

  // 2a. Queue entries graduated to business campaigns (dedupe on
  //     processed_campaign_id — multiple rows can share one campaign).
  const queueEntries = await this.prisma.mkt_prospect_queue.findMany({
    where: {
      source_campaign_id: { in: treeIds },
      processed_campaign_id: { not: null },
    },
    select: { processed_campaign_id: true },
  });
  const campaignIds = new Set(
    queueEntries.map(e => e.processed_campaign_id).filter((id): id is string => id != null),
  );

  // 2b. UNION: business-scope campaigns linked DIRECTLY to the tree via
  //     parent_campaign_id — derive flows (deriveFromParent sets
  //     parentCampaignId at createCampaign, line ~1454) and any future
  //     direct-attach business children never touch the queue. Without this
  //     branch they are invisible to the distribution.
  const directChildren = await this.prisma.mkt_campaigns_list.findMany({
    where: { parent_campaign_id: { in: treeIds }, scope: 'business' },
    select: { id: true },
  });
  directChildren.forEach(c => campaignIds.add(c.id));

  // 3. Load the business campaigns' stages (Set → deduped groupBy input).
  const stageGroups = await this.prisma.mkt_campaigns_list.groupBy({
    by: ['stage'],
    where: { id: { in: [...campaignIds] } },
    _count: { id: true },
  });
  const byStage: Record<string, number> = {};
  stageGroups.forEach(g => { byStage[g.stage] = g._count.id; });

  // 4. Queue-side buckets from STATUS, not subtraction. dismiss() has no
  //    status guard — a campaign_created row can be dismissed while keeping
  //    processed_campaign_id, so `total − graduated − dismissed`
  //    double-subtracts those rows (can go negative).
  const [stillInQueue, seededPreGraduation, dismissed] = await Promise.all([
    this.prisma.mkt_prospect_queue.count({
      where: {
        source_campaign_id: { in: treeIds },
        status: { in: ['queued', 'hold', 'in_thread', 'verify_then_outreach'] },
      },
    }),
    this.prisma.mkt_prospect_queue.count({
      where: {
        source_campaign_id: { in: treeIds },
        status: { in: ['queued', 'hold', 'in_thread', 'verify_then_outreach'] },
        seed_id: { not: null },
      },
    }),
    this.prisma.mkt_prospect_queue.count({
      where: { source_campaign_id: { in: treeIds }, status: 'dismissed' },
    }),
  ]);

  return {
    totalInPipeline: campaignIds.size,
    byStage,
    stillInQueue,
    seededPreGraduation,
    dismissed,
  };
}
```

**Required alongside this endpoint:**

- **Indexes (numbered migration):** `mkt_prospect_queue.source_campaign_id`
  and `mkt_campaigns_list.parent_campaign_id` are both unindexed today
  (verified in `schema.prisma`). Every tree query — including the existing
  cockpit load — seq-scans. Ship `@@index([source_campaign_id])` and
  `@@index([parent_campaign_id])` with this endpoint; it exists precisely for
  the large-PG case where the scans hurt.
- **`resolveBusinessProvingGround` third hop:** the resolver traces
  queue → `source_campaign_id` → parent. Business campaigns linked directly
  (`parent_campaign_id` → PG, or → intelligence child → PG) return null and
  lose the "View Proving Ground" link. Add a `campaign.parent_campaign_id`
  hop — and decide whether grandchildren resolve one or two levels up.
- **Dedup-verdict exclusion (pre-impl gap §4.5 / D3):** merged-away seeds can
  leave two graduated campaigns for one real business. Acceptable to
  double-count in v1; add the `mkt_prospect_dedup_verdicts` exclusion join
  here when this endpoint ships.

Route: `GET /api/admin/marketing-ops/:campaignId/stage-distribution` (gated to
`proving_ground` campaigns).

**Ship order:** frontend aggregation first (§6.1 — zero backend work), then
the dedicated endpoint (§6.2) when PGs grow past the entry-load limit or
drill-down is needed.

### 6.3 Frontend: cockpit stage distribution panel

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

**The drill-down link is not free — two pieces of work are required:**

1. **Backend filter.** `listCampaigns` supports `stage` and
   `parentCampaignId` (`CampaignListFilters`, `MarketingCampaignService.ts`
   ~423) but `parentCampaignId=<pg>` returns the PG's *children* (intelligence
   campaigns), not the graduated business campaigns. A new
   `provingGroundId` filter must join through the queue —
   `id IN (SELECT processed_campaign_id FROM mkt_prospect_queue WHERE
   source_campaign_id IN (treeIds))` — plus the direct-`parent_campaign_id`
   union for grandchildren (same linkage as the distribution endpoint).
2. **Frontend wiring.** `CampaignListClient` has a stage dropdown but reads
   no `searchParams` — add `useSearchParams` handling for `provingGround` +
   `stage`, and pass `provingGroundId` through `listCampaigns`.

### 6.4 PG scope flex (ships after stage awareness)

- `promoteToProvingGround`: accept `scope?: 'city' | 'category'` (default
  `city`); pass through to `createCampaign`. **The hard requirements must
  become conditional:** the function currently throws when `category` OR
  `city` is empty (lines ~982-987). A category-scope PG legitimately has no
  city; a state-scoped/mixed PG may have neither. Gate the `city` requirement
  on `scope === 'city'` and the `category` requirement on non-mixed scopes.
- `attachChildCampaign`: for mixed PGs, relax the `scope='intelligence'`
  guard to also accept `scope='business'` when the PG has no fixed geography
  (mixed case). The business campaign links directly to the PG as a child.
  **This is not a one-line change** — relaxing the guard also requires:
  - `resolveBusinessProvingGround`: add a `campaign.parent_campaign_id → PG`
    hop, or directly-attached business campaigns silently lose the "View
    Proving Ground" link.
  - The stage-distribution union (§6.2 step 2b) — direct children are
    already covered once that branch exists.
  - The cockpit's `attachable` list (filters to intelligence discovery runs
    only, ~line 217) and the children panel (renders by focus) — business
    children need their own rendering.
- Queue-list initiation: add `proving_ground_id` to `mkt_prospect_queue`
  (nullable FK → `mkt_campaigns_list`), set when an operator groups queue
  entries into a PG from the queue board. **Every linkage reader must learn
  the new column** — it is a second column, not an addition to `treeIds`
  (`treeIds` feeds `source_campaign_id IN (...)`):
  - cockpit queue load (`source_campaign_ids` filter → needs
    `OR: [{ source_campaign_id IN treeIds }, { proving_ground_id = pgId }]`)
  - the stage-distribution endpoint (same OR)
  - `resolveBusinessProvingGround` (queue entry → `proving_ground_id` direct)
  - `getCohortFunnel({ campaignIds })` tree scoping
  - `ProvingGroundDedupService` scoping
  Define exclusivity semantics up front: an entry carrying BOTH
  `source_campaign_id` and `proving_ground_id` must not double-count —
  dedupe on entry id across the OR. The shell-campaign alternative avoids
  the column but re-points `source_campaign_id` away from the real discovery
  run — provenance is partially preserved via `source_audit_id` /
  `discovery_provenance`, but the "which run found this prospect" link is
  lost. Also requires a numbered migration (column + FK + index) per the
  migration discipline in AGENTS.md.

### 6.5 What this does NOT change

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

**One caveat the mock in §4.1 glosses:** the `seed` stage and "has been
seeded" are different signals. PG-preflight seeding
(`createSeedsForProvingGround`) stamps `queue.seed_id` and leaves the row
`queued` — the wedge executes *before* a campaign exists. And per the seed
sprint's own scope, `seek → seed` stays operator-initiated (no auto-advance):
a PG-seeded prospect that later graduates enters at `seek` and reaches `seed`
only when the operator moves it. So the `seed` stage bucket systematically
under-reports actual seeding activity — the true "seeded" number is
`queue.seed_id IS NOT NULL`, which is why the corrected aggregation (§6.1,
§6.2) carries a separate `seededPreGraduation` bucket. Whether the seed-stage
checklist auto-completes / the stage auto-advances for pre-seeded PG
graduates is open decision D2 in the pre-implementation gap analysis — if D2
resolves to auto-advance, the two signals converge and the caveat disappears.

**Recommended order:** ship the `seed` stage first (it's the structural
change), then add the proving ground stage awareness (it's a read-only
addition that benefits from the richer stage set), then flex the PG scope
(the stage awareness already works regardless of how the PG is scoped).

---

## 8. Test Plan & Ship Checklist

The corrected design still ships in the same order (frontend aggregation →
endpoint → scope flex), but each step carries verification the original
sketch omitted:

**Frontend aggregation (§6.1):**
- [ ] `dismissed` added to the cockpit's queue status filter (or separate
      count) — verify the dismissed bucket is non-zero on a PG with
      dismissed rows.
- [ ] Stage buckets count distinct `processed_campaign_id` — craft two queue
      rows graduated to the same campaign (AC84 path) and confirm a single
      count.
- [ ] `campaign_created` + null `campaign_stage` surfaces as `seek` (or a
      warning), never "still in queue".
- [ ] `truncated` caveat renders when `entries.length === limit`.
- [ ] `seededPreGraduation` counts `seed_id`-stamped rows without campaigns.
- [ ] Unknown/recovery stage keys render with a fallback label.
- [ ] `listProspectQueue` request bypasses the service `cacheTTL` (or the
      panel tolerates its staleness) — the distribution reflects a just-run
      transition after reload.

**Dedicated endpoint (§6.2):**
- [ ] `stillInQueue` computed from status buckets — dismiss a
      `campaign_created` row and confirm no double-subtract (value stays
      ≥ 0 and consistent).
- [ ] A business grandchild linked via `parent_campaign_id` (derive flow —
      `createCampaign` writes `parent_campaign_id` directly, ~line 773)
      appears in `byStage` and in `totalInPipeline`.
- [ ] Index migration applied to `mkt_prospect_queue.source_campaign_id`
      and `mkt_campaigns_list.parent_campaign_id` on local + prd.
- [ ] `resolveBusinessProvingGround` resolves direct-`parent_campaign_id`
      campaigns (third hop) — "View Proving Ground" renders for them.
- [ ] Dedup-verdict exclusion (pre-impl §4.5 / D3) — merged-away seeds'
      campaigns excluded, or explicitly deferred with a code comment.

**Drill-down (§6.3):**
- [ ] `listCampaigns` `provingGroundId` filter returns queue-graduated AND
      parent-linked business campaigns, combinable with `stage`.
- [ ] `CampaignListClient` reads `?provingGround=<id>&stage=<stage>`.

**Scope flex (§6.4 — deferred):**
- [ ] `promoteToProvingGround` accepts `scope='category'`; `city` requirement
      conditional on scope (new tests next to the provingGround.test.ts
      suite).
- [ ] Business-scope attach: resolver hop + distribution union + cockpit UI
      all updated together.
- [ ] `proving_ground_id` initiation: all linkage readers updated, OR-dedup
      verified, migration shipped.

---

## 9. Conclusion

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

### 9.1 Review changelog (v2)

This document was reviewed against the codebase and against
`PROVING_GROUND_PRE_IMPLEMENTATION_GAP_ANALYSIS.md`. Corrections applied in
place:

- §4.1 mock: terminal stages split; `seeded` shown as a `seed_id`-based
  pre-graduation bucket distinct from the `seed` stage.
- §5.3 table: `promoteToProvingGround`'s `city`/`category` hard requirements
  added; queue→PG linkage row now flags business grandchildren; attach
  relaxation notes the reader updates it drags.
- §5.5: `proving_ground_id` reader list + OR/dedup semantics; shell-campaign
  provenance loss.
- §6.1: status-first counting, distinct-campaign dedup, `dismissed` load
  fix, truncation caveat, `seededPreGraduation` bucket, arbitrary stage
  labels, cache staleness check.
- §6.2: `stillInQueue` from status buckets (dismissal of graduated rows made
  the subtraction unsafe); `parent_campaign_id` union for grandchildren /
  future direct business children; required indexes migration;
  `resolveBusinessProvingGround` third hop; dedup-verdict exclusion.
- §6.3: drill-down link priced — new `provingGroundId` listCampaigns filter
  + `searchParams` wiring.
- §6.4 (renumbered; the doc previously had two §6.2s): scope-conditional
  `city`/`category` validation; full reader list for `proving_ground_id`.
- §7: `seed` stage vs `queue.seed_id` semantic caveat (open decision D2).
- §8: test plan & ship checklist added.

Where this doc and the pre-implementation gap analysis diverge, the
pre-implementation doc is canonical for decisions D1–D5; this doc is
canonical for the stage-awareness implementation shape.
