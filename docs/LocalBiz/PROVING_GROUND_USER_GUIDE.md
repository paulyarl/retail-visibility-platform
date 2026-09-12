# Proving Ground — Operator Guide

**Scope:** Day-to-day operation of proving ground (PG) workspaces — creating them, feeding them prospects, watching the pipeline, and jumping from a prospect to any of its artifacts.

**Sources:**
- `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` — the engineering spec
- `docs/LocalBiz/PROVING_GROUND_STAGE_CULTURE_FIT_ANALYSIS.md` — stage-awareness design (§9.3 has the as-built changelog)
- `docs/LocalBiz/CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md` — the `seed` stage this guide references
- `docs/campaigns/madison-proving-ground-operator-playbook.md` — the runbook the UX operationalizes

---

## 1. What a proving ground is

A proving ground is the **operator workspace for a market launch** — one campaign of category `proving_ground` that batches every prospect, discovery run, and business campaign belonging to a city + category (or a cross-market batch — see §3.3).

Two rules govern everything on the page:

- **The PG never moves.** It is created at `seek` and stays there forever. It is a *batch label* and awareness surface, not a pipeline participant — think `seed_batch` on directory listings, not a campaign with its own funnel.
- **The PG never mutates its members by viewing them.** Everything on the cockpit is read-only aggregation. State changes only happen through explicit actions (promote, graduate, attach, dismiss).

```
Proving Ground (scope = city or category, category = proving_ground)
  ├── children: intelligence discovery runs (emerging / competitive)
  ├── children: directory enrichment campaigns
  ├── children: business campaigns (mixed PGs only — §3.3)
  └── queue rows: one per prospect — the actual worklist
        └── each row may carry: seed_id, channel ladder, account family,
            proving_ground_id, processed_campaign_id (once graduated)
```

**Navigation:** `Settings → Admin → Marketing Ops → Proving Grounds` lists every PG grouped by market → category. Click a card to open its cockpit at `/settings/admin/marketing-ops/proving-grounds/{id}`.

---

## 2. Creating a proving ground — three paths

### 2.1 Promote a discovery run (the classic path)

On any **intelligence-scope discovery campaign** (focus `emerging` or `competitive`), use **Promote to Proving Ground** on the campaign detail page.

- Creates a city-scope (default) or category-scope PG and attaches the discovery run as a child in one action.
- If an *active* PG already exists for the same signature, the run **merges into it** — this is how `emerging` + `competitive` runs for one market fold into a single workspace. `mergeCampaignIds` can fold additional runs in at the same time.
- Category/city/state/title are overridable — e.g. promote an umbrella `Grocery` category when merging ethnic sub-categories.
- Validation is scope-conditional: `category` is always required (it's the market identity); `city` is required only for city-scope PGs.

### 2.2 Group queue entries directly (queue-list initiation)

On the **Prospect Queue** page (List view), check any rows and click **Group into Proving Ground**. The modal asks for:

- **Title** (required) and **Category** (required — defaults to the group's dominant value).
- **City** (optional — leave blank for a mixed/geography-free PG).
- **Domain scope** (city vs. category — only shown when a city is set).

The action creates-or-reuses the PG (a matching active PG is reused, never duplicated) and stamps `proving_ground_id` on each selected row. The rows keep their `source_campaign_id` for discovery provenance — the new column marks *membership*, the old one records *where the prospect was found*.

### 2.3 New Campaign

The index page's **+ New Campaign** button pre-fills `scope=city` + `campaignCategory=proving_ground` for the manual path.

---

## 3. The cockpit

### 3.1 Header

Title, market, gate chips (seed-funnel benchmark gates with pass/hollow state), market enrichment status, and the **Public copy** panel (the SEO copy the market feeds public category pages — viewable and overridable).

### 3.2 Funnel metrics + Due today

Directory-seed funnel roll-up (contactable → invited → claimed → converted, touches, CAC estimate) plus the list of queue rows whose `next_touch_at` is due. Funnel counts come from `directory_seed_campaign_links` — PG-grouped seeds are dual-linked to the PG, and `COUNT(DISTINCT)` keeps them from double-counting.

### 3.3 Prospect pipeline (stage distribution)

*New in this sprint.* Answers "where are my prospects in the funnel?" — a read-only roll-up of every business campaign that graduated out of this PG:

- **Stage chips** — one per stage value (`seek`, `seed`, `preview_built`, … including recovery stages and any arbitrary values, with fallback labels). Colored with the same palette as `StageBadge`. **Click a chip to drill into the campaigns list** filtered to that PG + stage (`?proving_ground=<id>&stage=<stage>` — a clearable filter chip appears on the list).
- **still in queue** — open-status rows not yet graduated.
- **seeded (pre-graduation)** — rows carrying `seed_id` that haven't produced a campaign. *Distinct from the `seed` stage:* `seed_id` means preflight seeding is done; the `seed` stage is the campaign's pipeline position. (See §5.2 — the two converge for PG graduates.)
- **dismissed** — closed rows (a dismissed row can still have graduated a campaign, so this is reported from status buckets, not subtraction).
- A **truncation caveat** appears if the underlying queue load hit its row limit.

The distribution covers campaigns reached through **all three lineage paths**: queue `source_campaign_id`, direct `proving_ground_id` membership, and parent-linked business children (derive-flow grandchildren), deduplicated on campaign id.

### 3.4 Preflight checklist (PG-01)

The PG's own playbook checklist — preflight work like dedup and seed-batch prep. This is PG-level work, separate from each business campaign's checklist.

### 3.5 Duplicate resolution

Preflight step 1's data surface — dedup verdicts across the PG's seeds.

### 3.6 Promote to listings + artifact chips

The core worklist: queue rows eligible for promotion to directory listings.

- **Promote selected** creates + publishes a listing per checked prospect, links the seed to its campaign(s), and mints a claim token. Audit-backed prospects are pre-checked (audits produce richer seed data); hold-priority prospects stay unchecked.
- **Artifact chips** *(new)* — every row carries a click-to-open chip per artifact surface, modeled on the coverage page's state cells:

  | Chip | Opens | Locked until |
  |---|---|---|
  | seed | the presence-seed workspace | `seed_id` exists |
  | campaign | the business campaign | `processed_campaign_id` exists |
  | audit | campaign `?tab=audits` (two-state: audited / no-audit) | campaign |
  | checklist | `?tab=checklist` — shows `· N done` from emitted progress | campaign |
  | outreach | `?tab=outreach-prep` | campaign |
  | gallery | `?tab=gallery` | campaign |
  | openers | `/openers?campaign=<id>` | campaign |
  | follow-ups | `/follow-ups?campaign=<id>` *(deep-link added this sprint)* | campaign |
  | deliverables | `?tab=deliverables` | campaign |

  Locked chips are gray with a tooltip naming the unlock. Chips **navigate, never mutate** — promote/graduate/dismiss remain the only actions.

### 3.7 Children

Attach/detach panel for the PG's children:

- **Intelligence discovery runs** (emerging/competitive) — attachable on any PG.
- **Directory enrichment** campaigns (category/city scope).
- **Business campaigns** *(new)* — attachable only when the PG has **no city** (a mixed/geography-free PG). On a city-scope PG, businesses join through the queue → graduation path instead. The children panel and attach dropdown show a `business` badge / `[biz]` prefix.

### 3.8 Discovery prospects

On-demand loader that pulls candidates from the attached intelligence campaigns so they can be queued.

### 3.9 Gap log

Append-only mid-run incident record (blocked paths, failures worth remembering).

---

## 4. Working the queue

PG prospects live in the shared Prospect Queue — the cockpit reads rows where `source_campaign_id` is in the tree **or** `proving_ground_id` matches.

- **Queue rows carry the cadence state**: `seed_id`, the channel ladder (call → email → sms → mail → form → referral), `current_channel_index`, `next_touch_at`, `account_family` (one owner → one operator/thread).
- **Log** records an outreach outcome — advances the ladder and schedules the next touch. Also writes through to the seed's outreach state machine so the funnel sees it.
- **Verify** gates outreach on a phone call for unverified NAP.
- **Create** graduates the row into a business campaign (see §5).
- **Group into Proving Ground** (multi-select) is the §2.2 initiation path.
- The queue's `proving_ground_id` filter is also available to API consumers (`GET /prospect-queue?proving_ground_id=`).

---

## 5. Graduation and the `seed` stage

### 5.1 The pipeline

Business campaigns run `seek → seed → preview_built → shown → paid → delivered → retainer_pitched → retainer_won`. The `seed` stage is the good-faith wedge: create the directory listing, QC it, publish, mint the claim token, invite the owner — *then* build the paid pitch.

### 5.2 PG auto-advance (the D2 retrofit)

When a queue row already carries `seed_id` (PG preflight seeding ran *before* graduation) and the operator hits **Create**:

- The new campaign enters at `seed`, not `seek` — the wedge work is objectively done.
- Four checklist steps auto-complete: place listing, publish, mint claim token, pitch free claim.
- **`qcSeed` stays incomplete** — quality control is a human call, and it's the remaining gate before `preview_built`.
- Rows without `seed_id` graduate at `seek` as before; the auto-advance only fires while the campaign is still at `seek`.

### 5.3 Checklist status to the cockpit

Queue decoration emits a `checklist_completed` count per processed campaign (one batched query, no per-campaign calls) — that's what powers the `checklist · N done` chip. Denominators vary by effective playbook, so the chip shows counts, not fractions; the campaign's checklist tab is the full view.

### 5.4 "View Proving Ground" links

A business campaign's detail page shows a **View Proving Ground** link whenever lineage resolves — through its queue row (`source_campaign_id` → parent, or `proving_ground_id` directly), or by walking up to two levels of `parent_campaign_id` (covers direct-attached businesses and derive-flow grandchildren).

---

## 6. Mixed (geography-free) proving grounds

A category-scope PG with no city is a **mixed PG** — a batch of prospects from different markets sharing a category (or just an operator-chosen grouping via §2.2).

What changes:

- Business campaigns can be **attached directly** as children (no queue detour).
- Promotion/grouping validation drops the city requirement.
- Queue rows reach it through `proving_ground_id` (they may have no discovery source at all).

What stays the same: the stage distribution, funnel metrics, artifact chips, and drill-downs all work identically — every reader ORs the two linkage columns and dedupes.

---

## 7. Boundaries (what the PG is *not*)

- **Not a pipeline participant** — it never transitions; its `seek` stage is meaningless.
- **Not a funnel entity** — funnel metrics belong to seeds; campaign metrics belong to business campaigns. The cockpit *reports* both, it doesn't merge them.
- **Not a mutator** — no view, panel, or aggregation writes state. All changes are explicit actions.
- **Not a checklist owner for its members** — PG-01 preflight is the PG's own checklist; each business campaign resolves its own playbook checklist independently.

---

## 8. Recently shipped (this iteration)

| Enhancement | Where |
|---|---|
| `seed` pipeline stage + `date_seed` | `seek → seed → preview_built`; `seek → preview_built` no longer valid |
| D2 auto-advance + checklist auto-complete | `createCampaignFromQueue` on `seed_id` rows |
| Prospect pipeline distribution panel | cockpit §3.3, `GET /:id/stage-distribution` |
| Artifact chip matrix (click-to-open) | cockpit §3.6, `ProspectArtifactChips` |
| Campaign-list drill-down | `?proving_ground=&stage=` filter params |
| `/follow-ups?campaign=` deep-link | openers-pattern prefill |
| Checklist progress emission | `checklist_completed` on decorated queue rows |
| Scope flex: category-scope / mixed PGs | `promoteToProvingGround` + `attachChildCampaign` |
| Queue-list PG initiation | `proving_ground_id` column (migration 282) + group action |
| Seed fan-out linkage | PG-grouped seeds dual-linked for cohort funnels |
| "View Proving Ground" via parent chain | `resolveBusinessProvingGround` ≤2-hop fallback |

**Known deferrals:** dedup-verdict exclusion from the distribution (D3), presence-count chip upgrades (gallery tokens / deliverables / opener counts / `demo_tenant_id`), and per-stage checklist fractions (needs per-playbook denominators).
