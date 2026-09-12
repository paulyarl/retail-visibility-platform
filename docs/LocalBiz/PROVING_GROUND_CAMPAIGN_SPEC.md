# Proving Ground Campaign — Phase-0 Checklist & Outreach Sequencing UX

**Status:** Draft spec (v2 — consolidated with full-spectrum gap analysis; every reuse claim verified against code)
**Companion docs:**
- `docs/LocalBiz/PROVING_GROUND_USER_GUIDE.md` (operator-facing guide — cockpit, queue workflows, scope flex)
- `docs/LocalBiz/proving_ground_sprint_plan.md` (phased implementation — Phase 1→6, dependencies, acceptance criteria)
- `docs/campaigns/madison-proving-ground-operator-playbook.md` (the runbook this UX operationalizes)
- `docs/campaigns/madison-east-washington-leadership-pitch.md`
- `docs/campaigns/madison-middle-eastern-grocery-prospect-priority.md`
- `docs/campaigns/madison-indian-grocery-emerging-prospect-priority.md`
- `docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md` (checklist machinery this builds on)
- `docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md` (seed funnel + touch log this feeds)
- `docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md` (sibling campaigns downstream)

**Purpose:** Set the scaling precedent for city/category outreach campaigns. Madison is not a one-off — it is the first instantiation of a repeatable **city-launch motion**. A city-scope campaign acts as the operator workspace (the "proving ground") and links the intelligence-scope discovery campaigns that feed it. Phase-0 preparation is a managed checklist, not a doc; per-prospect outreach follows a pre-built channel ladder with signal-driven cadence; every touch an operator logs is a touch the funnel gates can count.

**Operator model:** Human operators. Agents may propose (existing `mkt_playbook_checklist_suggestions` loop) but humans execute and check off.

---

## 1. Goals

1. **One workspace per city/category.** The proving ground aggregates every discovery run feeding a city's outreach — competitive + emerging + future focuses — under one operator surface.
2. **Preflight as data, not documentation.** Phase 0 becomes queryable state: checklist progress, dedup verdicts, seed linkages, channel ladders. "Is this city ready to touch?" is a query, not a meeting.
3. **Signal-driven cadence.** The ladder + outcome signals own *when next*; operator memory owns nothing. The signal — not elapsed days — determines the wait.
4. **Funnel-visible outreach.** One canonical touch record. Every logged touch feeds `touches → cacEstimate` and the G-gates directly; no parallel books between the worklist and the funnel.
5. **Expansion as instantiation.** Milwaukee / Twin Cities launch = run the City-Launch Runbook (§7). Zero bespoke engineering; the Madison docs become the reference instantiation.

---

## 2. Concept Model

### 2.1 The three-tier campaign tree

```
mkt_campaigns_list (scope = 'city', campaign_category = 'proving_ground')
  "Madison Grocery Proving Ground"          ← operator workspace (stays at 'seek')
  ├── children (parent_campaign_id):
  │     ├── mcamp-io0p8470  scope=intelligence, focus=competitive, "Middle Eastern Grocery"
  │     └── mcamp-n3fb21nq  scope=intelligence, focus=emerging,   "Indian Grocery"
  │           └── (business-scope campaigns derived per prospect — existing flow)
  ├── checklist: resolved from playbook PG-01 'proving_ground_preflight' (§4.3)
  └── mkt_prospect_queue rows: one per contactable prospect,
        source_campaign_id → the intelligence campaign,
        source_audit_id    → the audit that produced the candidate,
        seed_id            → the directory place seed (§4.4 — the keystone)
```

- **Why city scope, not a new `marketing` scope:** `CampaignScope` is a closed four-value enum (`business | category | city | intelligence`) across the Zod route schema, the service types, and the frontend. `city` already means "aggregate, non-business, non-intelligence" — exactly the proving ground's semantics. Introducing a fifth scope value would ripple through every scope-branched service for zero semantic gain.
- **Why a parent campaign rather than extending the intelligence campaigns:** discovery campaigns are data containers (audit payloads, candidates, gate results). Outreach is an operational process with touches, cadence, gates, and a funnel. Keeping scopes separate preserves the structural-duplicate guardrail semantics and lets one proving ground aggregate *multiple* discovery runs for the same city.
- **The tree extends existing semantics, it doesn't collide:** business-scope campaigns already point up at intelligence parents (`deriveBusinessCampaign` with the migration-253 discovery-context handoff; `createCampaignFromQueue` replays this for `intelligence_seek` entries). The proving ground adds a level *above* intelligence campaigns: `proving_ground ← intelligence ← business`.
- **The parent is a workspace, not a funnel participant.** It is created at `seek` (only `recovery_management` starts elsewhere in `createCampaign`) and stays there. Its stage means nothing and advances never; the gates are read off the seed funnel (§6). Because the guardrail exempts inactive stages, a killed proving ground (→ `dead`) frees the city for a fresh launch — natural re-launch semantics.

### 2.2 The queue row is the operator surface of the seed funnel

The funnel measures **seeds** (`directory_presence_seeds`): contactable, invited, claimed, converted, touches. The operator works **queue rows**. Today these are separate islands joined only by fuzzy NAP matching — which is precisely the dedup problem this spec exists to solve. The `seed_id` linkage (§4.4) fuses them: the queue row becomes the operator-facing projection of the seed, and every worklist action (QR kit, claim link, gap-map, log outcome, funnel roll-up) resolves through it.

### 2.3 Design principles

- **Scopes stay separate** — guardrail semantics preserved (§4.1).
- **Seed-first outreach** — the seed is the canonical funnel entity; the queue row is its worklist projection.
- **One cadence engine, two projections** — cadence state lives on the queue row (operator worklist) and writes through to the seed's outreach-state machine (migration 257) so both stay coherent (§4.6).
- **One canonical touch record** — the seed touch (migration 259), mirrored to `mkt_outreach_log` once a campaign exists (§4.8).
- **Humans execute, agents propose** — unchanged from the checklist sprint.

---

## 3. What's Already Built (reuse — all rows verified)

| Capability | Where | Status |
|---|---|---|
| Playbook checklist step templates (typed, ordered, stage-tagged) | `mkt_playbook_checklist_steps`, `PlaybookChecklistService` | Exists |
| Per-campaign lazy check-off progress | `mkt_campaign_checklist_progress` | Exists |
| Stage-aware soft gating (`STAGE_PIPELINE_ORDER`) | `PlaybookChecklistService` | Exists |
| Operator suggestion loop (add/modify/remove) | `mkt_playbook_checklist_suggestions` | Exists |
| Permanent code-defined steps (pitch construction, call script, preview kit) | `PERMANENT_STEPS` in `PlaybookChecklistService` | Exists |
| Per-prospect work queue w/ source linkage | `mkt_prospect_queue` (`source_campaign_id`, `source_audit_id`, `business_snapshot`, `detected_signals`, `status`, `priority`, `assigned_to`, `verification`) | Exists |
| Queue board + list views, filters, verification flow | `queue/ProspectQueueClient.tsx` + `ProspectQueueBoard` | Exists |
| Queue → campaign graduation (idempotent, discovery-context handoff) | `MarketingProspectQueueService.createCampaignFromQueue` | Exists |
| Seed outreach state machine (`outreach_state`, `outreach_scheduled_at`) | Migration 257 on `directory_presence_seeds` | Exists |
| Seed touch log (channel + outcome + operator + occurred_at) | `directory_seed_outreach_touches` (migration 259) + `POST /api/admin/directory/presence-seeds/:id/touches` | Exists — **no frontend consumer yet; the worklist becomes its first** |
| Outreach logging w/ delivery signals | `mkt_outreach_log` (`delivery_status`, `delivery_attempts`, `last_delivery_error`, `retry_after`) | Exists |
| Funnel metrics incl. invite scans + duplicate-seed surfacing | `SeedFunnelAnalyticsService.getCohortFunnel` (accepts `campaignIds`, returns `potentialDuplicateSeeds`) | Exists |
| Claim-invite QR kit — PNG + 4x6 postcard PDF per seed | `ClaimInviteQrKitService` (requires an active `directory_claim_tokens` row) | Exists |
| Pre-claim QR scan attribution (tenant stamped via token→seed before redirect) | `routes/directory-claim-qr.ts` | Exists — **closes the playbook Gap Log item on `inviteScans` attribution** |
| Campaign-first triage-aware postcard (post-campaign mailer) | `PostalMailerService` + `PostalMailerPdfService` | Exists |
| Multi-archetype siblings + `business_prospect_id` grouping | `BusinessProspectService` | Exists |

---

## 4. Gaps to Build

### 4.1 Proving-ground campaign kind

- **`scope = 'city'`, `campaign_category = 'proving_ground'`** (new category value).
- The create route must actually accept both: today `POST /api/admin/marketing-ops` exposes neither `campaign_category` nor `parent_campaign_id` in its Zod schema (only sibling creation sets them internally). Extend `campaignBaseSchema`/create-route mapping + the `CampaignCategory` TS type + a create-route category enum that includes `proving_ground`.
- **No DB CHECK exists on `mkt_campaigns_list.campaign_category`** (verified — it appears in zero migrations), so the column accepts the new value once the API can write it.
- `transitionsFor('proving_ground')` currently falls through to `REVIEW_TRANSITIONS` by accident of ordering. Make it explicit and tested: the proving ground uses the review machine's stage *names* only; it never transitions.
- **Guardrail (verified):** for city/category scope, `findDuplicateCampaign` keys on `scope + campaign_category + category + city + state` — so this naturally prevents two *active* proving grounds for the same city/category, and a killed (inactive-stage) one frees the slot. The spike from v1 remains worth one hour: after the route extension, create twice in local, confirm the 409 `conflict`.
- **Parent `category` value (decision):** the Madison tree spans two ethnic categories (Middle Eastern + Indian). One proving ground uses the umbrella value **`Grocery`** — the guardrail then keys `city=Grocery-Madison-WI`, and the expansion precedent stays one-workspace-per-city. Per-ethnic-category proving grounds would fragment the funnel and the operator's day.

### 4.2 Parent/child attachment

- **`parent_campaign_id` semantics (verified):** the column already means *"derived from / reports up to"*. It is written by `deriveBusinessCampaign` (business child of an intelligence/category/city parent — migration-253 discovery-context handoff), `deriveBusinessCampaignFromScanBusiness` (city pain scan → business child), and **copied** to sibling campaigns by `BusinessProspectService` (`parent_campaign_id: source.parent_campaign_id`) — siblings share the same parent pointer; sibling grouping itself lives on `business_prospect_id`, not this column. Reusing it for `intelligence → proving_ground` is the same upward direction: `business → intelligence → proving_ground`.
- **Free at the intelligence level:** nothing writes `parent_campaign_id` on `scope = 'intelligence'` rows today, so the column is unoccupied there.
- New endpoint: `POST /api/admin/marketing-ops/:campaignId/children` (or `attach-child`) — sets `parent_campaign_id` on an intelligence campaign. Guards:
  - parent must be `campaign_category = 'proving_ground'` (city/category scope);
  - child must be `scope = 'intelligence'`;
  - child must satisfy **`parent_campaign_id IS NULL` or already equal this parent** — 409 `conflict` with the existing parent id otherwise. The null-guard (not "proving-ground parent") is deliberate: the column is singular, and any future lineage use (e.g. a metro rollup) must not be silently clobbered.
- **Kind/focus gating — uniform for originate AND attach:** a child must be a **discovery prospect run** — `intelligence_campaign_kind = 'discovery'` AND `intelligence_focus ∈ {emerging, competitive}` (nulls normalize to `discovery`/`emerging`, matching the signature normalization). Enforced in **both** `promoteToProvingGround` (400 `source_not_discovery_prospect_run`) and `attachChildCampaign` (400 `child_not_discovery_prospect_run`), and mirrored in both UI affordances (the Non-Business Campaigns promote button, the campaign-detail promote button, and the cockpit attach dropdown). Rationale:
  - Discovery runs carry the market's `discovered_businesses` → queue rows → seeds → funnel. They are the feed the proving ground exists to work.
  - Establishment runs produce the *profile* (category definition, gates, gold standard), not prospects — attaching one contributes zero seeds and zero queue rows, and clutters the children panel with non-workable entries.
  - Establishment and gold-standards runs are frequently **state-scoped or nationwide** (`city`/`state` null per the guardrail signature — "Indian Grocery / Establishment / Gold_standards / All Platforms"). A promote keyed on a null city would fail the non-empty `city` requirement or, worse, key the workspace to the wrong geography.
  - In `promoteToProvingGround`'s merge path (`mergeCampaignIds`), non-discovery ids are collected into `skipped` rather than aborting the promotion.
- The campaign detail `children` include already selects `scope`, so mixed-scope children are discriminable; the cockpit renders intelligence children by focus (competitive / emerging), **not** by stage pipeline. Business grandchildren stay under their intelligence parents — the proving ground does not flatten the tree.

### 4.3 `proving_ground_preflight` playbook + checklist attachment

- New catalog row: code **`PG-01`**, name "Proving Ground Preflight", `category = 'proving_ground'` — requires extending `chk_playbook_category` (migration 178) with the new value.
- **Triage exclusion (critical):** the playbook catalog's `category` means "which pipeline machine this playbook runs," and `listActivePlaybooksOrdered` feeds the triage engine as *matching candidates*. Filter `category = 'proving_ground'` playbooks out at the triage-engine load site so preflight templates never enter matching, never appear in triage alternatives, and can never re-categorize a business campaign.
- **Checklist resolution (critical):** `resolveEffectivePlaybook` currently resolves *only* via `mkt_campaign_triage_results`, and triage is hard-blocked for non-business scopes (`assertBusinessScope` → 400, correctly). A city-scope proving ground can therefore never receive a triage row, and the v1 claim "the existing component works unmodified" was false — the tab would render its "run triage" dead-end forever. Fix: extend `resolveEffectivePlaybook` with a direct-assignment branch — *if the campaign is proving-ground scope (`scope ∈ {category, city}` + `campaign_category = 'proving_ground'`) → resolve the playbook by code `PG-01`, no triage row required.* Everything else in the checklist system (lazy progress, suggestion loop, builder tab, step validation) then works unchanged.
- **Preflight steps** (all `stage_tag = 'seek'`, `is_required = true`; instructions carry the match rules and evidence rules):

| # | Step | Type | Writes | Completion |
|---|---|---|---|---|
| 1 | Reconcile cross-campaign duplicates | `manual` | verdicts → `mkt_prospect_dedup_verdicts` (§4.9) | `duplicateSeedCount` for the tree = 0 |
| 2 | Seed place entries + issue claim tokens | `deliverable` | `directory_presence_seeds` + `directory_claim_tokens` + `directory_seed_campaign_links` (seed → **intelligence** campaign) + `mkt_prospect_queue.seed_id` | every contactable prospect has a seed + active token |
| 3 | Generate claim-invite QR kits | `deliverable` | per-seed PNG + 4x6 postcard (existing `ClaimInviteQrKitService`; depends on step 2's tokens — without them it no-ops with `no_active_claim_token`) | kit downloadable per prospect |
| 4 | Build per-prospect gap-map one-pagers | `deliverable` | on-demand PDF per queue row (§4.11) | one-pager per prospect |
| 5 | Resolve open verifications | `manual` | step note (the gap log) + `mkt_prospect_queue.verification` | gap log empty or annotated |
| 6 | Build channel sequence per prospect | `manual` | `channel_sequence` + `current_channel_index = 0` (§4.5) | **releases the worklist** (§4.10) |
| 7 | Assign operator owner per account family | `manual` | `assigned_to` + `account_family` (§4.12) | every family has an owner |

- Seed links must target the **intelligence** campaigns, not the parent — that is what makes the funnel roll-up (§6) work.
- Step types `internal_link` may need new named targets in `INTERNAL_LINK_TARGETS` (e.g. `proving_ground_worklist`, `seed_claim_kit`) for the deep-link actions.

### 4.4 Queue → seed linkage (the keystone)

```sql
ALTER TABLE mkt_prospect_queue
  ADD COLUMN seed_id VARCHAR(60) NULL REFERENCES directory_presence_seeds(id);
```

- Stamped at preflight step 2. Every downstream action is seed-keyed: QR kit, claim tokens, funnel metrics, seed outreach state, touch logging. Without `seed_id` the only join is fuzzy NAP matching — the exact problem dedup is trying to solve.
- Cross-family FK precedent exists (`directory_seed_campaign_links` already FKs into `mkt_campaigns_list`).
- **Seeding path:** `DirectoryPresenceSeedService.createSeedsFromBatch(queueEntryIds, seedBatch)` already converts queue entries → seeds in bulk, but for the *existing* flow it marks the row `campaign_created` (seeding was the end state there) and does not stamp a campaign link usable for tree-filtered funnel queries. For the proving ground, seeding is the *start* of outreach — the preflight action needs a sibling path (`createSeedsForProvingGround`, or a parameterized variant) that: (a) creates + publishes the seed, (b) links it to the **intelligence** campaign via `DirectorySeedCampaignLinkService` (required for the funnel's `directory_seed_campaign_links` join), (c) issues the seed claim token, (d) stamps `mkt_prospect_queue.seed_id`, and (e) leaves `status = 'queued'`.

### 4.5 `channel_sequence` on `mkt_prospect_queue`

```sql
ALTER TABLE mkt_prospect_queue
  ADD COLUMN channel_sequence jsonb;   -- ordered ladder
```

Shape:

```json
[
  {"channel": "call",   "target": "(608) 284-7277", "evidence": "gbp_place_card", "status": "verified"},
  {"channel": "text",   "target": "(608) 284-7277", "evidence": "inferred_mobile", "status": "unverified"},
  {"channel": "form",   "target": "https://…/contact", "evidence": "audit_provenance", "status": "verified"},
  {"channel": "mailer", "target": "6704 Watts Rd…", "evidence": "audit_provenance", "status": "verified"},
  {"channel": "referral","target": "Cap Times owner interview", "evidence": "press", "status": "unverified"}
]
```

- `status ∈ {verified, unverified, dead}` — `dead` set by the cadence engine on hard-negative signals (§4.7).
- Built during preflight step 6 from `business_snapshot` + `detected_signals` + audit `discovery_provenance` — the UI presents a **scaffolded ladder the operator confirms**, not a blank form. Derived *only from audited evidence* — never assume a channel exists because it's common.
- Auditable because each rung carries its evidence source.

### 4.6 Cadence state per prospect

```sql
ALTER TABLE mkt_prospect_queue
  ADD COLUMN current_channel_index smallint NOT NULL DEFAULT 0,
  ADD COLUMN next_touch_at timestamptz;
```

- **Status extension:** `chk_prospect_queue_status` (migration 256) gains `hold` and `in_thread`. Full lifecycle:

```
queued ──log outcome──▶ queued (next_touch_at set per §4.7)
queued ──live_reply──▶ in_thread          (cadence exits; ladder + thread drive moves)
queued ──3 consuming touches / 30d──▶ hold (next_touch_at = +60d)
hold   ──due date──▶ queued                (re-enter cadence)
in_thread ──no deal──▶ hold | dismissed
```

- **Write-through (one engine, two projections):** every logged outcome also updates the seed's migration-257 machine (`outreach_state`, `outreach_state_entered_at`, `outreach_scheduled_at`) so the seed-side "awaiting outreach" queue and the proving-ground worklist never diverge.
- `next_touch_at` gives the queue a natural "due today" sort — the operator's daily worklist.

### 4.7 Cadence engine — the authoritative signal→wait table

One table, all signals from the playbook, business-day semantics explicit. This supersedes both the playbook's table and the abridged v1 map (which had dropped rows).

| Stored outcome | Meaning | Wait before next touch | Next move |
|---|---|---|---|
| `bad_number` (call/text: wrong number/disconnect) | Channel dead | **0 days — same day** | Mark rung `dead`; next rung. **Does not consume a touch slot.** |
| `bounce` (email) | Channel dead | **0 days** | Drop email rung; next rung. No slot consumed. |
| `no_answer` (call, rings, no VM) | Right number, wrong time | **+1 day**, different send window | Retry same rung (max 2 no-answers), then advance |
| `voicemail` | Delivered, unproven | **+3 business days** | Next rung (text/WhatsApp with gap-map link) |
| `unread` (text/DM) | Wrong channel or contact | **+2 days, then abandon channel** | Next rung |
| `read_no_reply` (text/DM) | Seen and deferred | **+5 days** | Second text naming a local competitor, or next rung |
| `no_reply` (email sent) | Delivered, unproven | **+5 business days** | Call or text; email never gets a second wait |
| `form_submitted` | Unproven, no read receipt | **+7 days** | Call referencing the form submission |
| mail touch logged (`channel='mail'`) | Postal QR in flight | **+10 days** | At due: check `qr_scan_events` — scan-without-claim → second postcard; no scan → referral rung or `hold` |
| `referral_asked` | Third-party delivery, unproven | **+14 days** | `hold`, `next_touch_at` +60d |
| `connected` (live reply) | Human contact | Exit cadence | `in_thread`; the ladder — not this table — drives the next move |
| `not_interested` | Hard negative | — | Dismiss (`bad_fit`/`other`) |

- **Touch cap:** max **3 consuming touches per prospect per rolling 30 days** (dead-channel signals excluded) → auto `status = 'hold'`, `next_touch_at` +60d. Do not burn the list.
- **Send windows** (operator guidance, surfaced as worklist hints + step instructions): mid-morning 9:30–11:30 and mid-afternoon 14:00–16:00; never lunch/dinner rush; never Friday midday (halal-community prayer window).
- Implementation: a focused `ProvingGroundCadenceService` owning the map, ladder advancement, touch-cap counting, and the seed write-through.

### 4.8 Outcome logging — one canonical touch record

- **Canonical record = the seed touch** (`directory_seed_outreach_touches`). This is not optional: the funnel's `touches` metric (→ `cacEstimate`, gate math) counts seed-touch rows, **not** `mkt_outreach_log`. If the worklist logged only to `mkt_outreach_log`, every touch-dependent gate would silently read zero — the exact stale-seed failure class AGENTS.md warns about.
- `mkt_outreach_log.campaign_id` is NOT NULL, and Touch 1 happens while the prospect is still a queue row with no campaign — the cadence loop *cannot* write it pre-graduation anyway.
- The endpoint already exists (`POST /api/admin/directory/presence-seeds/:id/touches`) with **no frontend consumer today** — the worklist's "Log outcome" becomes its first.
- **Mirror to `mkt_outreach_log`** (channel, outcome, notes, `delivery_status`) once `processed_campaign_id` exists, so campaign pages keep their outreach history.
- **Taxonomy extension** (migration 262): `channel` CHECK gains `form`, `referral`; `outcome` CHECK gains `no_answer`, `bounce`, `unread`, `read_no_reply`, `form_submitted` (existing `connected`/`voicemail`/`bad_number`/`claimed`/`not_interested` already cover the rest; `no_response` remains as legacy alias of `no_answer`).

### 4.9 Identity ledger — dedup verdicts that persist and clear the signal

- New table — **group-keyed**, not pairwise: `potentialDuplicateSeeds` emits `seedIds` as an array (a phone-shared cluster can exceed 2 seeds), so a pairwise key would force N-choose-2 annotations per cluster. One row per surfaced group:

```sql
CREATE TABLE mkt_prospect_dedup_verdicts (
  id           VARCHAR(255) PRIMARY KEY,
  seed_ids     VARCHAR(60)[] NOT NULL,          -- sorted canonical set (the group as surfaced)
  match_key    VARCHAR(20)  NOT NULL,          -- 'phone' | 'address_city'
  verdict      VARCHAR(20)  NOT NULL,          -- 'same_entity' | 'distinct'
  merge_into   VARCHAR(60)  REFERENCES directory_presence_seeds(id),  -- surviving seed when same_entity
  rationale    TEXT,
  resolved_by  VARCHAR(255),
  resolved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seed_ids, match_key)
);
```

- `getCohortFunnel` excludes groups whose `seed_ids` match a verdict row (same set, same match_key) from `potentialDuplicateSeeds`; `duplicateSeedCount` reports **unannotated** groups only. Preflight step 1's completion (`= 0`) becomes programmatically checkable, and the group never re-surfaces on weekly reviews.
- A `same_entity` verdict also merges `name_variants` onto `merge_into` — the verdicts accumulate into a **canonical identity ledger** (Swagat/Krishna, Amal/Halal & Hijab). Distinct verdicts are permanent knowledge: future discovery runs that re-surface the same group auto-resolve.
- v1's "checklist note suffices" is rejected: notes are unqueryable and the signal never clears.

### 4.10 Preflight gate enforcement — the worklist, not stage transitions

- "Phase 0 blocks outreach" is enforced as a **worklist-availability gate**: while required preflight steps are incomplete, the due-today list renders rows read-only with a banner ("Preflight incomplete — N required steps") deep-linking the missing steps; **Log outcome / Start touch actions are disabled**.
- Stage-transition gating is explicitly *not* used: the parent never transitions, so a seek-tagged soft gate on it is vacuous. The existing soft-gate machinery stays untouched for business-scope campaigns.

### 4.11 Gap-map one-pagers

- **v1: on-demand, per-prospect PDF** generated from the queue row (business_snapshot + detected signals + gold-standard comparison), following the `ClaimInviteQrKitService` generation pattern — regenerable, no storage. Lead with the **local** benchmark (Krishna 260, Fresh Mart SP 126); national names (Sahadi's, Phoenicia) as ceiling context only.
- The textable CTA is the seed claim link (from the QR kit meta) — *claim your free listing*, never a paid tier on Touch 1.
- Rationale: deliverables and the diagnostic gallery are **campaign-keyed**, and queue-stage prospects have no campaign. A queue-side artifact is the only structurally available home. A token-gated public gap page is deferred (§11) — competitor visibility of your gaps is a business decision, not a default.

### 4.12 Account families

- `account_family VARCHAR(255) NULL` on queue rows, set at preflight step 7. The worklist groups rows sharing a family — the Tairov family (Istanbul + both Fresh Marts) is one group, one operator, one thread, three storefront gap-maps.
- v1: grouping + shared assignee. v2 (deferred): promote to an entity with shared cadence/thread when cross-business families need coordinated scheduling.

---

## 5. UX Surfaces

### 5.1 Proving Ground page — the operator cockpit

One page per proving ground:

1. **Header** — city/category, workspace badge, live gate chips (G1–G4 + postal verdict, read off the funnel report).
2. **Children panel** — attached discovery campaigns rendered by focus (competitive / emerging), linking to their detail pages.
3. **Preflight panel** — the existing checklist component, resolved via §4.3.
4. **Gate dashboard** — `getCohortFunnel` filtered to `campaignIds = [parent, ...children]`.
5. **Gap log panel** — preflight step 5's note + per-prospect `verification` states.
6. **Due-today mini-list** — top overdue prospects, deep-linking into the worklist filtered to this tree.

### 5.2 Prospect queue worklist

Extends the existing `ProspectQueueClient` (list + board views, filters, verification flow):

1. **Due-today sort** — overdue first, then `next_touch_at` asc, nulls last.
2. **Channel ladder visualization** — rungs with status (verified / unverified / dead), current rung highlighted, dead rungs struck.
3. **One-click "Log outcome"** — dialog with channel prefilled from the current rung, outcome from the §4.7 taxonomy, notes → writes the seed touch, advances `current_channel_index`, sets `next_touch_at` per the map, writes through to the seed machine, mirrors to `mkt_outreach_log` when a campaign exists.
4. **Preflight gate banner** — §4.10.
5. **Account-family grouping** — §4.12.
6. **Per-row actions** — QR kit (PNG / postcard) download, gap-map PDF, claim-link copy — all resolving via `seed_id`.
7. **Filters gain** — proving-ground tree scope and status `hold` / `in_thread`. The list API (`GET /prospect-queue`) needs a new `source_campaign_ids` filter (`ListQueueFilters` today has no campaign filter) — the worklist queries `source_campaign_id IN (children of this proving ground)`.

### 5.3 Checklist tab on the parent campaign

The existing component, unmodified except for the §4.3 resolution branch (direct `PG-01` assignment instead of the triage dead-end).

---

## 6. Funnel & Gates (reporting)

- `getCohortFunnel` filtered to the proving-ground tree (`campaignIds = [parent, ...children]`) reports: `seeds`, `contactable`, `invited`, `claimed`, `claimed30d`, `napVerified`, `converted`, `cacEstimate`, `inviteScans`, `inviteScanRate`, `duplicateSeedCount`.
- The parent contributes no seeds — by design. Seeding (preflight step 2) links seeds to the **intelligence** campaigns, and the roll-up works through those links.
- **`touches` / `cacEstimate` are now genuinely fed** by §4.8: every worklist-logged touch is a seed touch, which is what the metric counts.
- **`duplicateSeedCount` = unannotated pairs** (§4.9) — it reaches zero when preflight step 1 is done and stays there.
- **G1 caveat (accepted for v1):** the funnel's `contactable` is a derived `contact_status`, not a time-windowed "reached within 14 days," and there is no tier slicing. G1 is judged manually off `contactable` + `contact_status_derived_at` for v1; windowing is deferred. G2–G4 and the postal verdict read directly off the report.
- **G3 attribution is already solved** — the QR redirect stamps tenant pre-claim via token→seed; the playbook Gap Log item is closed.

---

## 7. City-Launch Runbook (the expansion precedent)

The proving ground's product purpose: the next city is configuration.

1. **Discover** — run establishment + discovery intelligence campaigns for the city/category (existing flows; coverage page verifies profile gaps). The establishment run produces the profile the discovery runs consume — it is never attached to the proving ground (§4.2 kind/focus gate).
2. **Create + Attach (one action)** — `POST /:campaignId/promote-to-proving-ground` on a discovery campaign creates the PG (`scope='city'`, `campaign_category='proving_ground'`, umbrella category) and attaches the run as its first child; `mergeCampaignIds` folds in sibling runs (emerging + competitive). If an active PG already exists for the city+category signature, the call reuses it — promote IS the merge path, not a 409. UI entry points: campaign-detail "Proving Ground" modal, the Non-Business table's per-row flask action, or the Campaign form (`proving_ground` is always in the Category dropdown; selecting it coerces scope → `city`). The guardrail still enforces one active per city/category.
3. **Attach stragglers** — link any remaining discovery campaigns (emerging / competitive focus) as children from the cockpit's attach dropdown (§4.2) — the dropdown is pre-filtered to the same kind/focus gate.
4. **Preflight** — checklist instantiates from `PG-01`; the operator confirms the scaffolded ladders, seeds + tokens materialize, duplicates get verdicts, families get owners.
5. **Work** — operators run the due-today list; signals drive the cadence; touches feed the funnel.
6. **Verdict** — weekly: gates G1–G4 + the postal test off the cockpit dashboard. Pass → ship the motion to the next city. Fail → the gate tells you which layer (channels, claim flow, attribution, pitch timing) to fix before spending elsewhere.

---

## 8. Migration, Seed & Rollout Plan

**Build order:** phased — see `docs/LocalBiz/proving_ground_sprint_plan.md` (Phase 1→6 with dependencies + acceptance criteria).

### 8.1 Migration `262_proving_ground.sql`

- `mkt_prospect_queue`: `+ channel_sequence JSONB NULL`, `+ current_channel_index SMALLINT NOT NULL DEFAULT 0`, `+ next_touch_at TIMESTAMPTZ NULL`, `+ seed_id VARCHAR(60) NULL FK → directory_presence_seeds`, `+ account_family VARCHAR(255) NULL`; extend `chk_prospect_queue_status` with `hold`, `in_thread`; indexes `(status, next_touch_at)`, `(seed_id)`, `(account_family)`.
- `directory_seed_outreach_touches`: extend `channel` CHECK (+ `form`, `referral`), `outcome` CHECK (+ `no_answer`, `bounce`, `unread`, `read_no_reply`, `form_submitted`).
- `mkt_playbook_catalog`: extend `chk_playbook_category` (+ `proving_ground`).
- New table `mkt_prospect_dedup_verdicts` (§4.9).

### 8.2 Code changes

- Create route + `CampaignCategory` type + create-route category enum gain `proving_ground` and `parent_campaign_id`; attach-children endpoint (§4.2); `POST /:campaignId/promote-to-proving-ground` (create-or-merge + multi-attach, §7).
- `resolveEffectivePlaybook` direct-assignment branch (§4.3); triage-engine candidate exclusion for `proving_ground` playbooks.
- `ProvingGroundCadenceService` (§4.7) + seed write-through + `mkt_outreach_log` mirror.
- `getCohortFunnel` duplicate-exclusion join (§4.9).
- `createSeedsForProvingGround` (or parameterized `createSeedsFromBatch` variant): seed + publish + link to intelligence campaign + issue claim token + stamp `seed_id`, leaving `status = 'queued'` (§4.4).
- `GET /prospect-queue` gains `source_campaign_ids` filter (§5.2).
- Frontend: cockpit page, worklist extensions, checklist tab resolution, `MarketingOpsService` client methods.

### 8.3 Seed script — `seed-proving-ground-preflight.ts`

Follows the AGENTS.md seed discipline: idempotent with **marker-presence** checks (never absence-of-old), `SEED_VERSION_MARKER` bump to re-apply, package.json script entry, re-run against **both** `local` and `prd`, then verify each row's `updated_at` is newer than the seed file's last commit.

---

## 9. Test Plan

- **Guardrail:** duplicate proving-ground create → 409 `conflict` with existing id/stage (extend the `marketingCampaign.recovery.test.ts` pattern); killed parent frees the slot.
- **Checklist:** proving-ground campaign resolves `PG-01` with no triage row; `assertBusinessScope` still rejects city scope for triage; triage candidate list excludes `proving_ground` playbooks.
- **Attachment:** one-parent guard (409 on second attach); children listing discriminates scopes; **kind/focus gate** — non-discovery kinds and `gold_standards` focus → 400 `child_not_discovery_prospect_run` on attach, `source_not_discovery_prospect_run` on promote; merge skips non-discovery ids rather than aborting.
- **Cadence:** each §4.7 signal → correct wait + ladder advance; dead-channel does not consume a slot; touch cap 3/30d → `hold` +60d; `connected` → `in_thread`; write-through updates `outreach_state`/`outreach_scheduled_at`.
- **Funnel visibility:** a logged seed touch increments `touches` in `getCohortFunnel`; mirrored `mkt_outreach_log` row appears post-graduation.
- **Dedup:** verdict persisted → pair excluded from `potentialDuplicateSeeds`; `same_entity` merges `name_variants`.
- **Queue linkage:** preflight seeding stamps `seed_id`; QR kit resolves through it.

---

## 10. Open Questions

1. **Gap-map surface** — on-demand PDF (v1, recommended) vs token-gated public page. Deferred; competitor visibility of gaps is a business decision.
2. **Account-family entity timing** — v1 tag + grouping vs v2 entity with shared cadence/thread.
3. **G1 windowing** — accept manual judgment v1, or add a `contact_status_derived_at` windowed metric later.

---

## 11. Non-Goals (v1)

- No agent-executed steps (human operators only; suggestion loop already exists for proposals).
- No automated send infrastructure (calls/texts are operator-performed; mailers are generated PDFs, fulfillment manual).
- No new stage names — the proving ground sits inside the existing vocabulary and never transitions.
- No public gap-map pages (v1).
- No cross-city portfolio dashboard (v1 — per-city cockpits only).
