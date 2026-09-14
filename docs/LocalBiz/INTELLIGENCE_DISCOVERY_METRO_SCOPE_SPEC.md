# Proving Ground Metro Expansion — Spec

**Status:** Roadmap design reference. Not scheduled for active implementation. Open questions (§9) are deferred to the implementation timeframe — none are blocking decisions for the roadmap itself.

> A Proving Ground (PG) workspace spans the metro ring, not just the primary city. When location enrichment has produced `metro_dynamics` for the PG's city, the PG soft auto-expands: it auto-attaches discovery runs for the metro communities with a warning the operator can dismiss or disable. One workspace, one funnel, one worklist — the ring is part of the primary PG, not a fleet of separate PGs.

---

## 1. Overview

### 1.1 Problem

The Proving Ground's product purpose (PG spec §7) is: **the next city is configuration.** Once a PG has proven the outreach motion in a primary city (Madison → Milwaukee → Twin Cities), the next launch is a runbook re-instantiation.

Today, the "next city" is an operator-selected city, launched one at a time. What is missing is the **metro ring** — the surrounding communities that location enrichment already identified and characterized. For Fort Wayne, IN, location enrichment produced 6 metro dynamics entries (New Haven, Huntertown, Leo-Cedarville, Columbia City, Auburn, Warsaw), each with its relationship, character, business scene, and notes. These are natural expansion targets for a Fort Wayne PG: the same category, the same playbook, the same outreach motion, applied to the ring.

The data to drive metro expansion already exists:

- `metro_dynamics` is a first-class field in the location enrichment output (`{ city, state, relationship, character, business_scene, notes }[]`)
- It is already injected into business audit and discovery prompts as context
- `attachChildCampaign` already allows intelligence children with different `city`/`state` to attach to a PG — the kind/focus gate checks `intelligence_campaign_kind = 'discovery'` + `intelligence_focus ∈ {emerging, competitive}` but does NOT check that the child's city matches the parent's city
- The PG City-Launch Runbook (§7) already defines the expansion motion

What is missing is a PG-level mechanism that treats the `metro_dynamics` list as the expansion target set and soft auto-expands the PG to include the ring.

### 1.2 Solution

A PG workspace supports metro. When location enrichment has produced `metro_dynamics` for the PG's city, the PG **soft auto-expands**:

1. The system detects `metro_dynamics` for the PG's city
2. It surfaces a **warning** to the operator: "Location enrichment identified N metro communities. Soft auto-expand will attach discovery runs for these communities to this PG."
3. The operator can **review** (select/deselect communities), **dismiss** (expand now), or **disable auto-expand** (opt out entirely)
4. For each selected community, the system runs discovery (BatchSeekService fan-out) and attaches the runs as intelligence children of the same PG

The metro communities are **not** separate PGs. They are intelligence children of the primary PG, same as the primary city's own emerging/competitive discovery runs. One workspace, one funnel, one worklist, one verdict — the ring is part of the primary PG.

### 1.3 Why one PG spanning the ring, not one PG per community

An earlier draft of this spec proposed one PG per metro community. That framing was wrong:

1. **The PG is the operator's workspace.** One operator works one worklist. Splitting the ring into N PGs fragments the worklist, the funnel, and the operator's day across N cockpits. The PG spec §4.1 already warns against per-ethnic-category PGs for the same reason ("would fragment the funnel and the operator's day").
2. **`attachChildCampaign` already supports cross-city children.** The kind/focus gate does not check the child's city against the parent's. A Fort Wayne PG can have intelligence children for New Haven, Huntertown, etc. — the gate passes. The infrastructure already supports the ring as children of one PG.
3. **The funnel roll-up is per-PG.** PG spec §6 rolls the funnel up from the PG's intelligence children. One PG with ring children gives one funnel covering the whole metro. N PGs give N funnels that the operator has to mentally aggregate.
4. **The guardrail stays clean.** The PG is keyed to the primary city's signature (`scope + campaign_category + category + city + state`). The ring is not a separate PG — it's the same PG with more children. No guardrail collision, no new signature dimension.

### 1.4 Why "soft" auto-expand

"Soft" means the auto-expand is **not forced and not silent**:

- **Not forced** — the operator can dismiss the warning (expand now), review and deselect communities, or disable auto-expand entirely. The PG works fine without the ring.
- **Not silent** — the system surfaces a warning when `metro_dynamics` is detected, so the operator is aware that the ring is available and that auto-expand will attach it. The operator is never surprised by metro community discovery runs appearing in their worklist without notice.

The warning is the keystone: it makes the auto-expand opt-out-able without making it opt-in. The operator does not have to manually launch the ring; they have to actively opt out if they don't want it.

### 1.5 Design principles

- **One PG, one workspace.** The metro ring is part of the primary PG. One worklist, one funnel, one verdict.
- **Soft auto-expand with warning.** The ring is auto-attached when `metro_dynamics` is available, with a warning the operator can dismiss, review, or disable.
- **Reuses existing data.** `metro_dynamics` is already produced by location enrichment. No new enrichment run is required.
- **Reuses existing infrastructure.** `BatchSeekService` fans discovery out; `attachChildCampaign` attaches cross-city children; the PG preflight checklist instantiates from `PG-01`. Metro expansion composes these.
- **Graceful degradation.** If `metro_dynamics` is empty (location enrichment hasn't run, or the city has no recorded metro communities), auto-expand is a no-op — no warning, no attachment, the PG works as a primary-city-only PG.
- **Operator-selectable targets.** The operator can deselect individual metro communities (e.g. drop Warsaw if it's 40 miles out and not a meaningful ring for the category).
- **No focus-axis changes.** Each metro community's discovery runs use the same focus strategy as the primary PG's children (mirror). The `focus` enum is unchanged.

### 1.6 Roadmap positioning

This feature is a **roadmap design reference**, not an active sprint. It sits downstream of the Proving Ground work (PG spec, `proving_ground_sprint_plan.md`) in the expansion timeline:

1. **PG foundation** (in progress) — proving ground campaigns, preflight checklist, cadence, funnel, cockpit. The PG must exist before metro expansion has a workspace to expand.
2. **City-Launch Runbook proven** (precedent) — at least one primary city (Madison) has passed G1–G4 verdicts using the runbook (PG spec §7). Metro expansion is the runbook applied to the `metro_dynamics` ring, so the runbook must be proven first.
3. **Location enrichment coverage** (precedent) — `metro_dynamics` must be produced for the primary city. This is already part of the location enrichment flow but is not yet run for every city; metro expansion is only meaningful where enrichment has run.
4. **Metro expansion** (this spec) — after (1) and (2) are in place and (3) has run for the target city.

The spec is written to be picked up at implementation time without re-design. The open questions (§9) are implementation-time decisions, not roadmap gates.

### 1.6.1 Generalization — Fort Wayne as the reference case study

Fort Wayne, IN is the reference case study (§2.2), but the pattern generalizes to most large-city deployments. The ring shape location enrichment produces for a large city — established industrial suburbs, fast-growing residential corridors, affluent low-density exurbs, satellite county seats, and specialized employment centers — is typical, not Fort Wayne-specific. The same motion applies to:

- **Indianapolis** — Carmel, Fishers, Noblesville, Greenwood, Plainfield, Avon
- **Columbus, OH** — Dublin, Westerville, Hilliard, Grove City, Reynoldsburg
- **Most large-city deployments** — wherever location enrichment has produced `metro_dynamics`

The mechanism is category- and city-agnostic: any large-city PG whose location enrichment has produced `metro_dynamics` can soft auto-expand to its ring. The Fort Wayne case study illustrates the pattern; the spec does not special-case it.

This also applies to **following expansions** — once a primary city's PG is proven and expanded to its ring, the same pattern applies to the next large-city deployment. Metro expansion is a repeatable motion across the deployment portfolio, not a one-off for Fort Wayne.

### 1.7 Dependency boundary — consumer, not producer

This spec is a **consumer** of `metro_dynamics` availability. It does not own or define the production of that data:

- **Consumes** — `metro_dynamics` produced by location enrichment (Stage 1), persisted in `directory_category_enrichment` as the `__location__` row's `context.metro_dynamics`, loaded via `MarketContextLoader.loadLocationContext`. The shape, production, and enrichment coverage of `metro_dynamics` are owned by the location enrichment spec (`PLACE_SEED_SEO_ENRICHMENT_SPEC.md`, `DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md`) and the directory enrichment validator (`directory-enrichment.schema.ts`).
- **Does not produce** — this spec does not add fields to `metro_dynamics`, does not change the enrichment prompt, does not alter the enrichment pipeline, and does not gate enrichment on PG existence. The enrichment runs on its own cadence; metro expansion reads what it produced.
- **Graceful absence** — when `metro_dynamics` is absent (enrichment hasn't run, or the city has no recorded metro communities), metro expansion is a no-op. The PG works as primary-city-only. This is the consumer's degradation path, not a producer contract — enrichment is never obligated to produce `metro_dynamics` for metro expansion's sake.

The dependency is one-directional: metro expansion depends on `metro_dynamics` being available; `metro_dynamics` production does not depend on metro expansion. If the enrichment shape changes upstream (e.g. `metro_dynamics` gains a `commute_distance` field), this spec's consumer code reads the new field opportunistically but never blocks on it.

---

## 2. Data sources

> This spec is a consumer of `metro_dynamics`, not its producer. The shape, production, and coverage of `metro_dynamics` are owned by the location enrichment pipeline (§1.7). This section documents the consumer contract — what this feature reads and relies on — not what it defines.

### 2.1 metro_dynamics (input — consumed, not produced)

Produced by location enrichment (Stage 1), persisted in `directory_category_enrichment` as the `__location__` row's `context.metro_dynamics`:

```typescript
interface MetroDynamic {
  city: string;            // e.g. "New Haven"
  state?: string;          // e.g. "IN"
  relationship: string;    // e.g. "eastern suburb"
  character: string;       // e.g. "established industrial and residential community"
  business_scene?: string; // e.g. "manufacturing, trucking and logistics services, everyday retail"
  notes?: string;          // e.g. "Long tied to the city's industrial base"
}
```

Loaded by `MarketContextLoader.loadLocationContext(city, state)` → `LocationIntelligence.metro_dynamics`.

### 2.2 Fort Wayne as the reference case study

Fort Wayne, IN is the reference case study for this spec, but the pattern generalizes to most large-city deployments. Like most large cities, Fort Wayne anchors a metro that spreads well beyond the city limits — its location enrichment produced 6 metro dynamics entries spanning the eastern, northern, northeastern, western, and employment-center relationships that typify a metro ring:

| city             | state | relationship             | character                                    |
|------------------|-------|--------------------------|----------------------------------------------|
| New Haven        | IN    | eastern suburb           | established industrial and residential       |
| Huntertown       | IN    | northern suburb          | fast-growing residential                    |
| Leo-Cedarville   | IN    | northeastern exurb        | affluent, low-density residential            |
| Columbia City    | IN    | western satellite city   | small-city county seat with manufacturing    |
| Auburn           | IN    | northern county seat     | small city with automotive heritage          |
| Warsaw           | IN    | western employment center| specialized manufacturing hub                 |

This ring shape — established industrial suburbs, fast-growing residential corridors, affluent low-density exurbs, satellite county seats, and specialized employment centers — is the typical output of location enrichment for a large city. The same pattern applies to Indianapolis (Carmel, Fishers, Noblesville, Greenwood, Plainfield), Columbus OH (Dublin, Westerville, Hilliard, Grove City, Reynoldsburg), and most large-city deployments. The Fort Wayne case study is illustrative, not special-cased; the spec's mechanism is category- and city-agnostic.

A Fort Wayne Grocery PG with soft auto-expand attaches discovery runs for the selected communities as intelligence children. The PG's worklist and funnel cover Fort Wayne + the ring. The same motion applies to any large-city PG whose location enrichment has produced `metro_dynamics`.

---

## 3. Expansion model

### 3.1 The expanded PG tree

Soft auto-expand adds intelligence children to the existing PG — no new PGs:

```
PG: "Fort Wayne Grocery Proving Ground" (scope='city', city='Fort Wayne', state='IN')
  ├── (existing) intelligence children:
  │     ├── mcamp-...  focus=competitive, "Fort Wayne"   (primary city)
  │     └── mcamp-...  focus=emerging,   "Fort Wayne"   (primary city)
  │
  └── Metro auto-expand children (new):
        ├── mcamp-...  focus=emerging,    "New Haven"     (metro, eastern suburb)
        ├── mcamp-...  focus=competitive,  "New Haven"     (metro, eastern suburb)
        ├── mcamp-...  focus=emerging,    "Huntertown"    (metro, northern suburb)
        ├── mcamp-...  focus=competitive,  "Huntertown"    (metro, northern suburb)
        └── ... (one emerging + one competitive per selected community)
```

The PG's `city`/`state` stays Fort Wayne, IN. The metro communities are represented by their intelligence children's `city`/`state`. The funnel roll-up (PG spec §6) already aggregates from all intelligence children — the ring children contribute to the same funnel.

### 3.2 Child provenance

Metro auto-expand children are regular intelligence children — they pass the existing `attachChildCampaign` kind/focus gate. To distinguish them from primary-city children for display and filtering, stamp provenance on the intelligence campaign:

| field                          | where                          | purpose                                              |
|--------------------------------|--------------------------------|------------------------------------------------------|
| `metro_expansion_origin_pg_id` | intelligence child (new col)   | points to the PG that auto-expanded (the parent PG)  |
| `metro_community`              | intelligence child (new col)   | the `metro_dynamics` entry's `city`                   |
| `metro_relationship`           | intelligence child (new col)   | the `metro_dynamics` entry's `relationship`            |

These are additive, nullable columns on `mkt_campaigns` (intelligence rows only). Primary-city intelligence children leave them null. The PG row itself gets no new columns — it is still keyed to the primary city.

### 3.3 Structural-duplicate guardrail

Unchanged. The guardrail keys on `scope + campaign_category + category + city + state` (PG spec §4.1) for the PG, and `scope + category + intelligence_campaign_kind + intelligence_focus + intelligence_platform + city + state` (AGENTS.md) for intelligence children. Metro children have their own `city`/`state` (the community's), so they are distinct signatures from the primary city's children — no collision. Two attempts to auto-expand the same community produce a 409 `conflict` on the second (the existing child is reused per the idempotent attach path).

### 3.4 DB columns

Add to `mkt_campaigns` (intelligence rows only, all nullable):

| column                          | type         | notes                                                        |
|---------------------------------|--------------|--------------------------------------------------------------|
| `metro_expansion_origin_pg_id`  | varchar(255) | FK → `mkt_campaigns.id` (the PG). Null for non-expansion children. |
| `metro_community`               | varchar(100) | The metro community city (e.g. "New Haven").                 |
| `metro_relationship`             | varchar(100) | The metro community relationship (e.g. "eastern suburb").      |

No CHECK constraint — these are free-text provenance fields. The `metro_expansion_origin_pg_id` FK is the only structural constraint.

---

## 4. Soft auto-expand

### 4.1 When the warning fires

The warning fires when ALL of the following are true:

1. The campaign is a PG (`scope = 'city'`, `campaign_category = 'proving_ground'`)
2. Location enrichment has run for the PG's city (a `__location__` row exists in `directory_category_enrichment`)
3. The `__location__` row's `context.metro_dynamics` is non-empty
4. Auto-expand is not disabled for this PG (a per-PG flag, §4.5)
5. There are metro communities in `metro_dynamics` that do NOT already have intelligence children attached (i.e. the ring is not fully expanded yet)

When the warning fires, the PG cockpit surfaces a dismissible banner:

```
⚠ Metro expansion available
Location enrichment identified 6 metro communities for Fort Wayne.
Soft auto-expand will attach discovery runs for these communities to this PG.

[ Review communities ]  [ Expand now ]  [ Disable auto-expand ]
```

### 4.2 Review communities

"Review communities" opens a modal listing the `metro_dynamics` entries:

```
Metro communities for Fort Wayne, IN

  [x] New Haven, IN        — eastern suburb — established industrial and residential
  [x] Huntertown, IN       — northern suburb — fast-growing residential
  [ ] Leo-Cedarville, IN   — northeastern exurb — affluent, low-density residential
  [x] Columbia City, IN    — western satellite city — small-city county seat
  [ ] Auburn, IN           — northern county seat — small city with automotive heritage
  [ ] Warsaw, IN           — western employment center — specialized manufacturing hub

Focus strategy: Mirror primary PG (emerging + competitive)

[ Attach selected ]
```

- Communities already expanded (have intelligence children attached) are marked and excluded from the selection.
- The operator deselects communities that are too far afield or not meaningful for the category.
- "Attach selected" runs discovery for each selected community and attaches the runs as intelligence children.

### 4.3 Expand now

"Expand now" attaches all unexpanded `metro_dynamics` communities immediately, using the default selection (all communities). This is the "accept the warning" path — the operator acknowledges the ring and lets the system attach it without reviewing each community.

### 4.4 Disable auto-expand

"Disable auto-expand" sets a per-PG flag (`metro_auto_expand_disabled = true`) that suppresses the warning. The PG stays primary-city-only. The operator can re-enable later from PG settings.

This is the "opt out" path — the operator explicitly says "I don't want the ring," and the warning stops firing.

### 4.5 Per-PG flag

Add `metro_auto_expand_disabled` to `mkt_campaigns` (PG rows only):

| column                          | type    | default | notes                                              |
|---------------------------------|---------|---------|----------------------------------------------------|
| `metro_auto_expand_disabled`    | boolean | `false` | When true, the auto-expand warning does not fire.  |

The flag is the persistence for "Disable auto-expand." It is per-PG — disabling on the Fort Wayne PG does not affect a Milwaukee PG.

### 4.6 The attach flow

For each selected community, the system:

1. **Discovers** — runs establishment + discovery intelligence campaigns for the community + category, using the primary PG's category. This is a `BatchSeekService` fan-out:
   - One batch entry per community, per focus (emerging + competitive, mirroring the primary PG's children)
   - Each entry uses the primary city's category profile (metro communities typically have no own profile — the existing city-aware resolution falls back to the primary city's profile with logged warnings)
   - The batch is tagged with the PG id for traceability

2. **Attaches** — `attachChildCampaign(pgId, childId)` attaches each discovery run as an intelligence child of the PG. The kind/focus gate passes (discovery + emerging/competitive). The child's `city`/`state` is the metro community's. The `metro_expansion_origin_pg_id`, `metro_community`, `metro_relationship` provenance columns are stamped.

3. **Preflight** — the PG's preflight checklist (`PG-01`) already instantiates from the direct-assignment branch (PG spec §4.3). The newly attached children contribute their prospects to the same preflight. The operator runs preflight as normal — the ring's prospects are part of the same checklist.

### 4.7 What is NOT automated

Per PG spec §1.5 (humans execute, agents propose) and §7 (the runbook is operator-driven):

- **Preflight is not auto-run.** The warning auto-attaches discovery children; preflight still requires operator judgment (channel ladder confirmation, dedup verdicts, family ownership).
- **Outreach is not auto-launched.** The expansion attaches children; the operator works the queue.
- **Discovery is not auto-skipped.** The ring's discovery runs are created and attached. If the operator wants to attach existing runs instead, they use the existing cockpit attach dropdown (PG spec §4.2).

### 4.8 Failure handling

- **No `metro_dynamics`** — no warning fires. The PG works as primary-city-only. No error, no banner.
- **Discovery fails for a community** — the community's intelligence children are not created, and the failure is logged. The PG is not blocked. The operator can re-run discovery and attach manually. The warning re-fires on next cockpit load for the failed community (it's still unexpanded).
- **Duplicate child for a community** — if intelligence children for the community already exist (manually attached earlier), `attachChildCampaign`'s idempotent path returns `{ attached: true }` (PG spec §4.2). The provenance columns are stamped on the existing children. The community is marked as expanded.
- **Auto-expand disabled** — the warning does not fire. The operator can re-enable from PG settings.

---

## 5. Frontend

### 5.1 The warning banner

On the PG cockpit, a dismissible banner (§4.1) appears above the existing panels when `metro_dynamics` is available and auto-expand is not disabled:

```
⚠ Metro expansion available
Location enrichment identified 6 metro communities for Fort Wayne.
Soft auto-expand will attach discovery runs for these communities to this PG.

[ Review communities ]  [ Expand now ]  [ Disable auto-expand ]
```

- The banner dismisses for the session (not persisted) when the operator clicks any action.
- The banner reappears on next cockpit load if auto-expand is still not disabled and communities remain unexpanded.

### 5.2 Review modal

The review modal (§4.2) lists `metro_dynamics` entries with checkboxes. Already-expanded communities are marked and excluded. The operator selects/deselects and clicks "Attach selected."

### 5.3 Metro children in the cockpit

The PG cockpit's existing children panel (PG spec §4.2) renders intelligence children by focus. Metro children are distinguished by a badge: "Metro — New Haven (eastern suburb)" reading from the provenance columns. The operator can filter the children panel by primary vs metro.

### 5.4 Funnel and worklist

The funnel and worklist are unchanged — they already aggregate from all intelligence children. Metro children's prospects appear in the same worklist, tagged with their community in the prospect's `city` field. The operator can filter the worklist by community.

### 5.5 PG settings

PG settings gain a "Metro auto-expand" toggle (the `metro_auto_expand_disabled` flag). When disabled, the warning banner does not fire. The operator can re-enable at any time.

---

## 6. API surface

### 6.1 Expand action

`POST /api/admin/marketing-ops/:pgId/expand-metro` — attaches metro community discovery runs to the PG.

Request:
```json
{
  "communities": ["New Haven, IN", "Huntertown, IN"],
  "focusStrategy": "mirror",
  "skipDiscovery": false
}
```

- `communities` — selected metro communities as `"city, state"` strings. If omitted, all unexpanded `metro_dynamics` entries are selected.
- `focusStrategy` — `"mirror"` (default, v1 only). Runs the same focus set as the primary PG's children.
- `skipDiscovery` — if `true`, skip discovery and only stamp provenance on existing manually-attached children. Default `false`.

Response (202 `accepted` — discovery fan-out is async):
```json
{
  "success": true,
  "data": {
    "expansionBatchId": "mexp_...",
    "communities": [
      { "city": "New Haven", "state": "IN", "status": "discovering" },
      { "city": "Huntertown", "state": "IN", "status": "discovering" }
    ]
  }
}
```

### 6.2 Expansion status

`GET /api/admin/marketing-ops/:pgId/metro-expansion` — returns the metro expansion state for the PG:

```json
{
  "available": true,
  "autoExpandDisabled": false,
  "communities": [
    {
      "city": "New Haven", "state": "IN",
      "relationship": "eastern suburb",
      "character": "established industrial and residential",
      "expanded": true,
      "childCampaignIds": ["mcamp-...", "mcamp-..."]
    },
    {
      "city": "Warsaw", "state": "IN",
      "relationship": "western employment center",
      "character": "specialized manufacturing hub",
      "expanded": false,
      "childCampaignIds": []
    }
  ]
}
```

This drives the warning banner (§5.1) and review modal (§5.2).

### 6.3 Toggle auto-expand

`PATCH /api/admin/marketing-ops/:pgId` — the existing campaign update route accepts `metro_auto_expand_disabled` (boolean). Sets the per-PG flag.

### 6.4 Campaign response

Campaign responses include the provenance fields when present:
```json
{
  "id": "mcamp-...",
  "scope": "intelligence",
  "intelligence_campaign_kind": "discovery",
  "intelligence_focus": "emerging",
  "city": "New Haven",
  "state": "IN",
  "metro_expansion_origin_pg_id": "mcamp-pg-...",
  "metro_community": "New Haven",
  "metro_relationship": "eastern suburb"
}
```

### 6.5 Validation

- `communities` entries must match a `metro_dynamics` entry for the PG's city/state. Entries not in `metro_dynamics` are 400 `unknown_metro_community`.
- `focusStrategy` must be `"mirror"` (v1). Other values are 400 `unsupported_focus_strategy`.
- The campaign (`:pgId`) must be `scope = 'city'` + `campaign_category = 'proving_ground'`. Otherwise 400 `not_a_proving_ground`.

---

## 7. Edge cases

### 7.1 No metro_dynamics

If location enrichment hasn't run for the PG's city, or the city has no recorded metro communities:
- No warning fires
- The PG works as primary-city-only
- `GET /metro-expansion` returns `{ available: false, communities: [] }`
- `POST /expand-metro` returns 400 `metro_dynamics_unavailable`

### 7.2 Community with existing children

If intelligence children for a community already exist (manually attached earlier), `attachChildCampaign`'s idempotent path returns `{ attached: true }`. The provenance columns are stamped on the existing children. The community is marked as expanded in `GET /metro-expansion`.

### 7.3 Metro community outside the state

`metro_dynamics` entries may cross state lines (e.g. a Fort Wayne metro community in Ohio or Michigan). The intelligence child's `city`/`state` comes from the metro community's `metro_dynamics` entry, not the PG's. The guardrail keys on the child's own city/state — no collision with the primary city's children.

### 7.4 Duplicate candidates across the ring

The same business may be discovered in the primary city and a metro community (e.g. a chain with locations in Fort Wayne and New Haven). Each discovery run's prospect queue entries are independent — they are not deduplicated across children. The `business_prospect_id` grouping (multi-archetype campaigns) links them for downstream multi-archetype handling, same as cross-city duplicates today. The PG preflight's dedup step (PG spec §4.3 step 1) surfaces cross-child duplicates for verdict.

### 7.5 Re-expansion

The operator can expand the same PG to the ring multiple times (e.g. after the first batch is attached, expand the remaining communities that were deselected initially). Each expansion is a separate `expansionBatchId`. Already-expanded communities are marked and excluded.

### 7.6 Disabling and re-enabling

Disabling auto-expand (`metro_auto_expand_disabled = true`) suppresses the warning but does NOT detach existing metro children. The ring that was already attached stays attached. Re-enabling fires the warning again for any unexpanded communities.

### 7.7 Establishment scans

Metro expansion applies to `intelligence_campaign_kind = 'discovery'` only. Establishment scans (`intelligence_campaign_kind = 'establishment'`) are gold-standard benchmarking and are not fanned out to the ring. The `attachChildCampaign` kind/focus gate already excludes them (PG spec §4.2).

---

## 8. Touch points

### 8.1 Backend

| file                                                                  | change                                                                 |
|-----------------------------------------------------------------------|------------------------------------------------------------------------|
| `apps/api/prisma/schema.prisma`                                       | Add `metro_expansion_origin_pg_id`, `metro_community`, `metro_relationship`, `metro_auto_expand_disabled` to `mkt_campaigns` (db-pull) |
| `database/migrations/<n>_pg_metro_expansion.sql`                     | New migration: add columns + FK on `metro_expansion_origin_pg_id`       |
| `apps/api/src/services/MarketingCampaignService.ts`                   | Persist provenance + flag on create/update; include in response        |
| `apps/api/src/services/ProvingGroundMetroExpansionService.ts` (new)   | Orchestrates expansion: load `metro_dynamics`, fan out discovery, attach children, stamp provenance |
| `apps/api/src/routes/marketing-ops.ts`                                | `POST /:pgId/expand-metro`, `GET /:pgId/metro-expansion`; pass `metro_auto_expand_disabled` through update |
| `apps/api/src/validators/marketing-ops.ts` (or expansion schema)       | `expandMetroSchema`: `communities`, `focusStrategy`, `skipDiscovery`  |

### 8.2 Frontend

| file                                                                  | change                                                                 |
|-----------------------------------------------------------------------|------------------------------------------------------------------------|
| `apps/web/src/services/MarketingOpsService.ts` (or PG service)        | `expandMetro(pgId, input)`, `getMetroExpansion(pgId)`                  |
| PG cockpit page component                                              | Warning banner (§5.1); review modal (§5.2); metro badge on children (§5.3) |
| PG settings component                                                  | "Metro auto-expand" toggle (§5.5)                                       |

### 8.3 Tests

| file                                                                  | coverage                                                              |
|-----------------------------------------------------------------------|-----------------------------------------------------------------------|
| `ProvingGroundMetroExpansion.test.ts` (new)                           | Expansion attaches children with provenance; idempotent on re-expand; no `metro_dynamics` → 400; unknown community → 400; discovery failure does not abort batch; disabled flag suppresses warning |
| `marketingCampaign.recovery.test.ts`                                  | Metro child signature does not collide with primary; duplicate metro child → 409 |

### 8.4 Seeds

No seed changes. The expansion uses the existing `PG-01` preflight playbook and the existing discovery templates. No new playbook, no new template, no new fragment.

---

## 9. Open questions (deferred to implementation)

> These questions are design considerations for the implementation timeframe, not blocking decisions for the roadmap. The spec is a design reference; the answers will be settled when this feature is scheduled.

### 9.1 Async vs sync expansion

The expansion fans out discovery across N communities, which is long-running. v1 should run it async (202 `accepted` + `expansionBatchId`) with a status poll. Open: does the existing intelligence-run execution infrastructure support an async fan-out, or does the expansion action need its own job runner?

### 9.2 Warning frequency

The warning banner is session-dismissed (reappears on next cockpit load). Open: should it be permanently dismissible per community (the operator dismisses Warsaw specifically and it never reappears), or is per-session dismissal enough? Per-community dismissal adds a persisted state per community; per-session is simpler.

### 9.3 Focus strategy selection

v1 ships `"mirror"` only (the metro children run the same focus set as the primary PG's children). Open: is there a real use case for `"emerging_only"` or `"competitive_only"` expansion? If the primary PG proved the motion with both focuses, mirroring is the natural default.

### 9.4 Discovery timing

Should the warning fire immediately when the PG is created (if `metro_dynamics` is already available), or only after the primary PG's discovery runs complete? Firing immediately lets the operator expand early; waiting lets the operator see the primary city's prospects first. v1 recommends firing immediately — the operator can dismiss and expand later.

### 9.5 Migration numbering

The next migration number needs to be picked at implementation time. The columns are additive (nullable, no CHECK except the FK), so the migration is low-risk and re-runnable.

---

## 10. Non-Goals (v1)

- **No separate PGs for metro communities.** The ring is part of the primary PG — one workspace, one funnel, one worklist.
- **No auto-run preflight.** Preflight requires operator judgment (PG spec §1.5). The expansion attaches children; the operator runs preflight.
- **No auto-launch outreach.** The expansion attaches children; the operator works the queue.
- **No cross-metro deduplication.** Duplicate candidates across the ring rely on `business_prospect_id` grouping and the PG preflight's dedup step, same as cross-city duplicates today.
- **No new focus values.** `emerging` and `competitive` are unchanged. Metro children use the same focuses as the primary city's children.
- **No `metro_scope` field on discovery campaigns.** Metro expansion is a PG action, not a discovery modifier. The `focus` axis is unchanged.
