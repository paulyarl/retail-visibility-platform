# Prospect Queue ("Add to Queue") — Sprint Plan

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-03
**Companion docs:** `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`, `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md` (Sprint 5 scan-to-campaign spawning), `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md`

---

## 1. Problem / Objective

When an operator reviews a **category audit** (Category Analysis card, City Category Digital Audit card, or a City Pain Scan sync report), they routinely spot businesses that are hot prospects. Today the **only** capture action is the per-business **spawn button** — "create campaign on the spot" — which immediately creates a business-scope child campaign and **navigates away** to it (`router.push` to the new campaign detail page).

This forces an all-or-nothing decision at audit-review time:

- If the operator is near end-of-day, or mid-flow reviewing a dozen sampled businesses, they **won't** spawn a campaign — and the prospect's context is effectively lost. The audit data still exists, but to act on it tomorrow the operator must remember which campaign/audit held the business, navigate back, re-open the audit card, and re-find the row before they can even start campaign creation.
- Spawning immediately also *interrupts* the audit-review flow: one click = one navigation away from the list they were working through.

**Objective:** add a persistent, operator-facing **Prospect Queue**:

1. **"Add to Queue" button** next to every existing spawn button on audit surfaces. One click captures the business — name, location, signals, ratings, and a full snapshot of the business JSON — **without navigating away**.
2. **Queue page** (`/settings/admin/marketing-ops/queue`) — the operator's "start of day" surface. Every queued prospect is actionable directly from the queue: review the snapshot, then **Create Campaign** from the queue row (same spawn logic as today) or **Dismiss**. No need to re-open the source audit.
3. **Dashboard visibility** — queue count + top entries as a dashboard widget, and a nav badge, so the queue is unmissable at the start of the day.
4. **Dual role: mini kanban.** The queue page doubles as a board. Once a queued prospect becomes a campaign, its card moves out of the *Queued* column into the column for the campaign's current pipeline stage — so the queue page tracks each sourced prospect from capture through conversion. Columns are **module-aware**: the stage sets already differ per campaign category (`transitionsFor(category, repairTrack)` in `MarketingCampaignService.ts:107`), and the board renders the correct pipeline (Review vs Recovery) rather than a single hard-coded stage list. Stage advances from the board go through the existing `POST /:id/transition` endpoint — including its checklist soft gate.

Decisions locked with the requester (2026-08-03):

- **Add to Queue never navigates.** Spawning stays available for "act now" prospects; queueing is for "act later" prospects. Both buttons coexist.
- **Queue entries are self-contained.** Campaign creation from the queue must work entirely from the stored snapshot — the source audit/execution is provenance, not a runtime dependency.
- **Queue is operator-global** (all `mkt_*` tables are platform-admin scoped, no RLS), not per-user. `queued_by` is recorded for accountability only.
- **The board is a view, not a stage machine.** The kanban role derives entirely from the existing queue row → `processed_campaign_id` → `mkt_campaigns_list.stage` join and the existing category-aware transition tables. No new stage column, no parallel state — the board can never disagree with the campaign detail page.
- **Board v1 advances by click, not drag.** Drag-and-drop is a later refinement; correctness of module-aware transitions and the checklist soft gate comes first.

---

## 2. Current State (What Already Exists)

### 2.1 Audit surfaces with spawn buttons (the "Add to Queue" insertion points)

| Surface | File | Spawn mechanism |
|---------|------|-----------------|
| **City Category Digital Audit card** — `sampled_businesses` rows, sorted by signal count | `apps/web/src/components/marketing-ops/CityCategoryAnalysisAuditCard.tsx` (list at line 321, handler at line 161) | `marketingOpsService.deriveBusinessCampaign(campaignId, { business_name, rating, review_count, location, detected_signals })` → `router.push` to child campaign |
| **Category Analysis card** — `top_5_competitors` rows | `apps/web/src/components/marketing-ops/CategoryAnalysisAuditCard.tsx` (handler at line 79) | Same `deriveBusinessCampaign` call → `router.push` |
| **City Pain Scan sync report** — unmatched businesses | `apps/web/src/components/marketing-ops/SyncReportCard.tsx` (lines 50–95) | `deriveAllUnmatched(campaignId, executionId)` (bulk) / `deriveFromScan(parentId, business)` (single) |

### 2.2 API / service layer

- `POST /api/admin/marketing-ops/:id/derive-business` (`apps/api/src/routes/marketing-ops.ts:1187`) → `MarketingCampaignService.deriveBusinessCampaign` (`apps/api/src/services/MarketingCampaignService.ts:496`). Seeds name/rating/review_count/location/signals; inherits category/city/tone from parent; child starts at `seek`.
- `POST /api/admin/marketing-ops/:id/derive-from-scan` (`marketing-ops.ts:1086`) → `MarketingHotProspectService.deriveBusinessCampaignFromScanBusiness` (`apps/api/src/services/MarketingHotProspectService.ts:656`). Richer path: maps the full scan business JSON onto campaign columns, creates a `city_analysis` audit on the child, derives hot-prospect status, creates a `business_analysis` audit and **auto-triggers triage** when `detected_signals` are present.
- **Dedup precedent (AC84):** `deriveBusinessCampaignFromScanBusiness` returns the existing campaign when one already exists for the same `business_name + city + category` at `scope='business'` (`MarketingHotProspectService.ts:679-692`). Queue dedup follows the same rule.
- `apps/web/src/services/MarketingOpsService.ts` — web API client; `deriveBusinessCampaign` near line 1468 area, cache-invalidation conventions via `invalidateCachePattern`.

### 2.3 Web chrome

- Nav panel: `apps/web/src/components/marketing-ops/MarketingOpsNavPanel.tsx` — `NAV_ITEMS` array (line 20); supports a `Badge` count next to items (Mantine `Badge` already imported, line 5).
- Dashboard: `apps/web/src/app/(platform)/settings/admin/marketing-ops/MarketingOpsDashboardClient.tsx` — widget grid already hosts `HotProspectsWidget` (line 227); `HotProspectsWidget.tsx` is the pattern to copy for a queue widget (poll-free fetch, count in header, per-row link).
- Page shell: `MarketingOpsPageShell` with breadcrumbs, used by every marketing-ops `page.tsx`.

### 2.4 Data layer conventions

- Migrations live in `database/migrations/`; next number is **160** (`159_mkt_playbook_checklists.sql` is latest).
- `mkt_*` tables: **no RLS** (platform-admin namespace exception), **no DB triggers** (`updated_at` via Prisma `@updatedAt`), IDs generated at the app layer via `id-generator.ts` with prefixes (e.g. `pbcs-`, `cckp-`). New prefix for this feature: `pque-`.
- Prisma does not support expression/partial indexes (`prisma db pull` warns on existing ones, e.g. `idx_navigation_links_metadata_parent_key`). Any partial unique index for queue dedup is therefore **DB-level only** — enforced in SQL, invisible to Prisma, and **mirrored by app-layer checks** (same approach as AC84).

---

## 3. Gap Analysis

| Need | Codebase Reality | Implication |
|------|------------------|-------------|
| Persist a prospect for later without creating a campaign | Does not exist — spawn is the only capture action | New table `mkt_prospect_queue` + Prisma model |
| Add-to-Queue button on audit rows | Only spawn buttons exist on the three audit surfaces | Add a secondary button next to each spawn button; wire to new API |
| Campaign creation from queue *without* the source audit open | `derive-from-scan` needs the full business JSON, which today comes from the open audit card / execution raw output | Store the **full business snapshot JSONB** on the queue entry at queue time; create-from-queue replays the snapshot through the existing derive services |
| Start-of-day queue surface | No queue page, no nav item, no dashboard presence | New page + nav item with count badge + dashboard widget |
| Post-creation tracking of sourced prospects | Campaign list exists but is global; no "prospects I queued" progression view | Board view on the queue page, derived from `processed_campaign_id` → campaign stage (no new data) |
| Module-aware stage columns | `transitionsFor(category, repairTrack)` (`MarketingCampaignService.ts:107`) already resolves Review vs Recovery transition tables; `RECOVERY_STAGE_LABELS` in `recoveryStages.ts` | Board consumes the same maps — no duplicated stage logic |
| Stage advance from the board | `POST /:id/transition` (`marketing-ops.ts:819`) already validates transitions per category and enforces the checklist soft gate (409 `checklist_incomplete` + `acknowledge_incomplete`) | Board reuses the endpoint verbatim; 409 surfaces the existing warning dialog pattern |
| Dedup so the same business can't be queued twice (or re-queued after campaign creation) | AC84 name+city+category dedup exists for campaigns only | Same rule at queue level + check against existing campaigns at queue time |
| Multiple operators, one team queue | No per-user scoping anywhere in mkt_* | Single shared queue; `queued_by` audit column only |

---

## 4. Proposed Architecture

```
Audit surfaces (3 cards)                    Queue surfaces
┌──────────────────────────┐              ┌────────────────────────────┐
│ CityCategoryAnalysisAudit│              │ /marketing-ops/queue page  │
│ CategoryAnalysisAuditCard│   POST       │  - list queued entries      │
│ SyncReportCard           │  /prospect-  │  - Create Campaign per row  │
│  [Spawn] [+ Add to Queue]├─ queue ─────►│  - Dismiss per row          │
└──────────────────────────┘              └─────────────┬──────────────┘
                                                        │ POST /prospect-queue/:id/create-campaign
                                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ mkt_prospect_queue                                                    │
│  business_snapshot JSONB (self-contained)                             │
│  status: queued → campaign_created | dismissed                        │
└──────────────────────────────────────────────────────────────────────┘
                        │ create-campaign replays snapshot
                        ▼
   MarketingHotProspectService.deriveBusinessCampaignFromScanBusiness
   (full snapshot)  OR  MarketingCampaignService.deriveBusinessCampaign
   (thin snapshot — category-analysis rows that lack scan JSON)
```

**Key design decisions:**

1. **Two spawn paths, one queue.** Queue entries captured from scan-derived surfaces (City Category card, SyncReportCard) carry the full scan business JSON and replay through `deriveBusinessCampaignFromScanBusiness` — preserving hot-prospect derivation, `city_analysis` audit creation, and auto-triage. Entries from the Category Analysis card carry the thin payload (name/rating/review_count/location) and replay through `deriveBusinessCampaign`. The queue entry records `source_kind` so the backend picks the right path (§6.4).
2. **The queue is not a campaign stage.** Queued prospects are *pre-campaign*. Nothing appears in the pipeline, scorecards, or conversion stats until the operator creates the campaign. This keeps pipeline metrics honest.
3. **No new navigation weight.** Add-to-Queue is an inline action with optimistic UI — the button flips to a "Queued ✓" state and the operator keeps reviewing the audit.
4. **The kanban board is a derived view.** Board columns and card placement are computed from `mkt_prospect_queue.status` + the joined campaign's `stage` + `transitionsFor(campaign_category, repair_track)`. There is no board state to migrate, sync, or get wrong — if the board and the campaign page ever disagree, the campaign page is right and the board re-renders.

---

## 5. Data Model — Migration `160_mkt_prospect_queue.sql`

### 5.1 `mkt_prospect_queue`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(255) PK | App-layer `pque-` prefix via `id-generator.ts` |
| `business_name` | VARCHAR(255) NOT NULL | |
| `category` | VARCHAR(255) | Inherited from parent campaign at queue time |
| `city` | VARCHAR(255) | Inherited from parent campaign at queue time |
| `state` | VARCHAR(255) | Inherited from parent campaign at queue time |
| `source_kind` | VARCHAR(30) NOT NULL | `category_analysis` · `city_category_audit` · `scan_unmatched` · `manual` |
| `source_scope` | VARCHAR(20) | Denormalized parent campaign scope (`category` · `city`) captured at queue time — survives parent deletion (the FK is SET NULL) and drives the card's scope badge |
| `source_campaign_id` | VARCHAR(255) FK → `mkt_campaigns_list(id)` ON DELETE SET NULL | Parent (category/city-scope) campaign the prospect was discovered from. Nullable so parent deletion never wipes the queue |
| `source_audit_id` | VARCHAR(255) | Provenance only — plain column, **no FK** (audit cleanup must not break the queue) |
| `source_execution_id` | VARCHAR(255) | Set for `scan_unmatched` entries; provenance only |
| `audit_date` | TIMESTAMPTZ | Denormalized `created_at` of the source audit/execution at queue time. Distinct from `created_at` (when it was *queued*) — an operator may queue a prospect from a week-old audit. Drives the card's audit-date chip and stale-audit tinting |
| `business_snapshot` | JSONB NOT NULL DEFAULT `'{}'` | Full business JSON for scan-derived entries; thin `{business_name, rating, review_count, location, detected_signals}` for category-analysis entries. **This is the runtime payload for create-campaign** |
| `detected_signals` | JSONB NOT NULL DEFAULT `'[]'` | Denormalized signal-code array for card badges (crisis vs standard coloring) and future filtering — avoids unpacking `business_snapshot` per row render |
| `signal_count` | INT NOT NULL DEFAULT 0 | Denormalized `len(detected_signals)` for default sort + badges |
| `rating` | NUMERIC(2,1) | Denormalized for list display |
| `review_count` | INT | Denormalized for list display |
| `status` | VARCHAR(20) NOT NULL DEFAULT `'queued'` | `queued` · `campaign_created` · `dismissed` |
| `priority` | VARCHAR(10) NOT NULL DEFAULT `'normal'` | `high` · `normal`. Toggle on the queue page; sort = priority DESC, signal_count DESC, created_at ASC |
| `note` | TEXT | Operator note captured optionally at queue time / editable on the queue page ("call after Tuesday", "asked for by name") |
| `queued_by` | VARCHAR(255) | `req.user.id` at queue time; who *captured* the prospect (attribution, immutable) |
| `assigned_to` | VARCHAR(255) | User id of the operator who *owns working* the prospect. Null = unclaimed. Claim semantics: "Assign to me" sets `req.user.id`; reassign/unassign via PATCH. Seeded onto the campaign's own `assigned_to` at create-campaign time |
| `assigned_at` | TIMESTAMPTZ | Set on assign, cleared on unassign |
| `processed_campaign_id` | VARCHAR(255) FK → `mkt_campaigns_list(id)` ON DELETE SET NULL | Set when a campaign is created from this entry |
| `processed_at` | TIMESTAMPTZ | |
| `dismissed_reason` | VARCHAR(255) | Optional short reason on dismiss (`already_customer`, `bad_fit`, `duplicate`, `other`) |
| `created_at` / `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | `updated_at` via Prisma `@updatedAt` |

**Constraints & indexes:**

```sql
-- status / priority guards
CHECK (status IN ('queued', 'campaign_created', 'dismissed'));
CHECK (priority IN ('high', 'normal'));
CHECK (source_kind IN ('category_analysis', 'city_category_audit', 'scan_unmatched', 'manual'));
CHECK (source_scope IS NULL OR source_scope IN ('category', 'city'));

-- Dedup: one ACTIVE queue entry per business+city+category.
-- Partial unique index — NOT visible to Prisma (expression/partial indexes
-- unsupported by prisma db pull); mirrored by an app-layer check (§9).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_prospect_queue_active_business
  ON mkt_prospect_queue (lower(trim(business_name)), lower(trim(city)), lower(trim(coalesce(category,''))))
  WHERE status = 'queued';

-- List-page sort
CREATE INDEX IF NOT EXISTS idx_mkt_prospect_queue_status_sort
  ON mkt_prospect_queue (status, priority DESC, signal_count DESC, created_at ASC);
```

Notes (matching 159 conventions):

- **No RLS** — `mkt_*` platform-admin namespace exception (`manual-sql-migration-policy.md` §4).
- **No DB triggers** — `updated_at` managed by Prisma.
- After running: `cd apps/api && npx prisma db pull && npx prisma generate` (the partial unique index will appear in the db-pull "unsupported indexes" warning list — expected, same as `navigation_links`).

### 5.2 Lifecycle

```
queued ──Create Campaign──► campaign_created (processed_campaign_id set)
  │                            ▲ re-queue allowed only AFTER this point
  └──Dismiss──► dismissed      │ (a fresh row may be queued once no row is 'queued')
```

- `campaign_created` and `dismissed` rows are retained (audit trail + "previously queued" badge on audit surfaces) and filterable on the queue page; default view shows `queued` only.
- Re-adding a business whose previous entry is `dismissed` creates a **new** row (the partial unique index only covers `status='queued'`). The old row stays as history.

---

## 6. API Surface

All routes live in `apps/api/src/routes/marketing-ops.ts` under the existing admin guard; business logic in a new `apps/api/src/services/MarketingProspectQueueService.ts` (pattern: `MarketingHotProspectService` — Prisma directly, `RequestCtx` logging, `handleServiceError`).

### 6.1 `POST /api/admin/marketing-ops/prospect-queue`

Add a business to the queue.

```ts
const queueAddSchema = z.object({
  business_name: z.string().min(1).max(255),
  category: z.string().max(255).optional(),   // defaults from source campaign
  city: z.string().max(255).optional(),       // defaults from source campaign
  state: z.string().max(255).optional(),
  source_kind: z.enum(['category_analysis', 'city_category_audit', 'scan_unmatched', 'manual']),
  source_campaign_id: z.string().min(1),      // parent campaign (also supplies category/city defaults)
  source_audit_id: z.string().optional(),
  source_execution_id: z.string().optional(),
  audit_date: z.string().datetime().optional(), // audit/execution created_at, supplied by the card (it holds the audit object); server falls back to a source_audit_id lookup, then to queue time
  business_snapshot: z.record(z.any()).default({}),
  priority: z.enum(['high', 'normal']).default('normal'),
  note: z.string().max(2000).optional(),
});
```

Server-side denormalization at insert: `source_scope` is read from the parent campaign's `scope`; `detected_signals`, `signal_count`, `rating`, `review_count` are extracted from `business_snapshot` (the cards already pass the full business object, so signals ride along for free). All four audit-aware card fields (priority, audit date, category, scope, signals) are thus **captured from the audit context at queue time and immutable thereafter** — they describe the audit that found the prospect, not the live world. If the underlying data drifts, the operator re-audits after campaign creation; the queue card is a faithful point-in-time record.

- **Dedup (app layer, mirrors §5.1 index):** if a `queued` row already exists for the same normalized `business_name + city + category` → `200 { success, data: existing, created: false }` (idempotent; the UI shows "Already in queue").
- **Campaign-exists check:** if a `scope='business'` campaign already exists for the same triple (AC84 rule) → `409 { success: false, error: 'campaign_exists', data: { campaignId } }`. The UI toasts "Campaign already exists" with a link. Rationale: queueing a business that is already in the pipeline is operator error, not intent — surface it.
- Response: `201 { success, data: entry, created: true }`.

### 6.2 `GET /api/admin/marketing-ops/prospect-queue`

Query params: `status` (default `queued`), `category`, `city`, `source_kind`, `limit` (default 100), `include=campaigns`. Ordered by `priority DESC, signal_count DESC, created_at ASC`. Response includes `queuedCount` (for the nav badge / widget header) regardless of filters.

`include=campaigns` powers the **board view** (§7.3): LEFT JOINs `processed_campaign_id → mkt_campaigns_list` and decorates each entry with `{ campaign_stage, campaign_category, repair_track, is_hot_prospect, stage_entered_at }`. For the board the client passes `status=queued,campaign_created` (comma-separated) so graduated entries appear in their stage columns; `dismissed` never boards.

### 6.3 `PATCH /api/admin/marketing-ops/prospect-queue/:id`

Update `priority`, `note`, and/or `assigned_to` on a `queued` entry. `404` if not found; `409` if not `queued`.

```ts
const queuePatchSchema = z.object({
  priority: z.enum(['high', 'normal']).optional(),
  note: z.string().max(2000).nullable().optional(),
  assigned_to: z.string().min(1).nullable().optional(), // null = unassign
});
```

Assignment rules: setting `assigned_to` stamps `assigned_at`; `null` clears both. The UI's **Assign to me** action simply PATCHes the caller's own id — no dedicated endpoint. Assignment is claim semantics, not permissions: any operator can reassign (single shared team queue), and the change is visible to everyone on next fetch.

### 6.4 `POST /api/admin/marketing-ops/prospect-queue/:id/create-campaign`

The start-of-day action. Server-side:

1. Load entry; `404` if missing; if `status = 'campaign_created'` → `200 { data: campaign, created: false, alreadyProcessed: true }` (idempotent retry).
2. Resolve parent campaign from `source_campaign_id` (`404` with clear message if the parent was deleted and `source_campaign_id` is null — operator must re-queue manually; acceptable because ON DELETE SET NULL keeps the entry).
3. **Replay the snapshot through the existing spawn logic:**
   - `source_kind IN ('city_category_audit', 'scan_unmatched')` → `MarketingHotProspectService.deriveBusinessCampaignFromScanBusiness(parentId, entry.business_snapshot, ctx)` — full path: campaign columns, `city_analysis` audit, hotness, `business_analysis` audit + auto-triage when signals exist.
   - `source_kind = 'category_analysis'` → `MarketingCampaignService.deriveBusinessCampaign({ parentId, businessName, rating, reviewCount, location, detectedSignals, assignedTo: req.user.id })`.
4. AC84 dedup inside both services still applies — if they return `created: false`, the entry is **still** marked processed against the pre-existing campaign (the prospect is in the pipeline, which is the operator's goal).
5. **Ownership carries forward:** if the entry has `assigned_to`, the resulting campaign's `assigned_to` is set to the same user (falling back to `req.user.id` when unassigned). `deriveBusinessCampaign` accepts `assignedTo` natively; for the scan path the service sets it on the derived campaign after creation. The person who claimed the prospect in the queue owns the campaign it becomes.
6. Mark entry `status='campaign_created'`, `processed_campaign_id`, `processed_at`.
6. Response: `{ success, data: campaign, created, queueEntry }`.

### 6.5 `POST /api/admin/marketing-ops/prospect-queue/:id/dismiss`

Body: `{ reason?: 'already_customer' | 'bad_fit' | 'duplicate' | 'other' }`. Sets `status='dismissed'`, `dismissed_reason`, `processed_at`. Idempotent.

### 6.6 Web client additions (`apps/web/src/services/MarketingOpsService.ts`)

```ts
async addToProspectQueue(input: ProspectQueueAddInput): Promise<{ entry: ProspectQueueEntry; created: boolean }>
async listProspectQueue(filters?: {...}): Promise<{ entries: ProspectQueueEntry[]; queuedCount: number }>
async getProspectQueueBoard(): Promise<{ entries: BoardEntry[]; queuedCount: number }>  // include=campaigns
async updateProspectQueueEntry(id: string, patch: { priority?: 'high'|'normal'; note?: string })
async createCampaignFromQueue(id: string): Promise<{ campaign: Campaign; created: boolean }>
async dismissProspectQueueEntry(id: string, reason?: string)

// Stage maps mirroring MarketingCampaignService.transitionsFor() — used by the
// board to render columns and compute valid click-to-advance targets. The
// backend transition endpoint stays authoritative; these are display/UX only.
export const REVIEW_BOARD_STAGES: { key: string; label: string }[]
export const RECOVERY_BOARD_STAGES: { key: string; label: string }[]
export function boardStagesFor(category: CampaignCategory, repairTrack?: RepairTrack | null)
export function nextStagesFor(category: CampaignCategory, repairTrack: RepairTrack | null | undefined, stage: string): string[]
```

Cache tags: `mkt-ops-prospect-queue` (list + board), invalidated on every mutation; also invalidate `mkt-ops-campaigns-list` on `createCampaignFromQueue` (a new campaign appeared). Board stage transitions go through the existing `transitionStage` client method (which must already invalidate campaign caches) plus `mkt-ops-prospect-queue`.

---

## 7. Web UI

### 7.1 "Add to Queue" buttons on audit surfaces

Each existing spawn button gets a sibling icon-button (lucide `ListPlus`, matching the existing lucide usage in these cards):

| Surface | Placement |
|---------|-----------|
| `CityCategoryAnalysisAuditCard.tsx` sampled-business rows | Right of the existing derive button (line ~430 area) |
| `CategoryAnalysisAuditCard.tsx` competitor rows | Right of the derive button (line 187) |
| `SyncReportCard.tsx` unmatched rows | Right of the single-create action |

Behavior:

1. Click → `addToProspectQueue` with the row's full business object as `business_snapshot` (scan surfaces) or the thin payload (category-analysis surface), plus `source_*` provenance **and the audit context the card already holds**: `audit_date: audit.created_at` on both audit cards, execution/report date on `SyncReportCard`, `source_audit_id` where present, `source_execution_id` for scan rows. `source_scope` is derived server-side from the parent campaign — the client never sends it.
2. **No navigation.** Optimistic state flip: `ListPlus` → spinner → `ListCheck` + tooltip "Queued — find it on the Queue page" (link in the tooltip/toast to `/settings/admin/marketing-ops/queue`). Button stays disabled afterward.
3. `created: false` response → same disabled state but label "Already in queue".
4. `409 campaign_exists` → toast: "A campaign already exists for this business" with a link to it; button unchanged.
5. Errors surface in the card's existing `deriveError`-style inline error line.

Custom-name derive inputs (both audit cards have one) get the same sibling action: "Queue custom business" — same payload minus snapshot extras.

### 7.2 Queue page — `/settings/admin/marketing-ops/queue`

New route following the existing page conventions (`page.tsx` + `ProspectQueueClient.tsx` + `MarketingOpsPageShell` breadcrumbs `Settings › Admin › Marketing Ops › Queue`).

The page has two view modes, toggled in the header: **List** (default; this section) and **Board** (mini kanban; §7.3). The toggle persists in `localStorage` so an operator who starts their day on the board lands back on the board.

Layout (table, dense rows like the campaign list):

| Column | Content |
|--------|---------|
| Business | Name (bold) + city/state; flame icon if snapshot implies hot (reuse the hotness badge logic — `signal_count > 0` ⇒ amber border, crisis signals ⇒ red border, same as `CityCategoryAnalysisAuditCard` rows) |
| Signals | `signal_count` badge + first 2 signal codes, tooltip for the rest |
| Rating | ★ rating · review_count |
| Source | `source_kind` label, linked to the parent campaign (and anchor to the audit card when `source_audit_id` present) — provenance, *not required* to act |
| Queued | Relative time ("yesterday 4:52 PM") + `queued_by` |
| Priority | `high`/`normal` toggle (lucide `Flag`) |
| Note | Inline-edit pencil |
| Actions | **Create Campaign** (primary, violet — same styling as spawn buttons) · **Dismiss** (ghost, opens reason dropdown) |

Header controls: status filter tabs (`Queued (n)` default · `Created` · `Dismissed`), an **"Assigned to me"** toggle (default on for the List view — the start-of-day view is *my* claimed prospects plus anything unclaimed; flip off to see the whole team queue), category/city filters (same pattern as campaign list), "Created" rows link to their campaign instead of offering actions. The List view carries an **Assigned** column rendering `staffDisplayName` or "Unassigned", with the same Assign-to-me inline action.

Create-from-queue row action: spinner → on success the row flips to a "Campaign created ✓ — View" state in-place (no forced navigation; the operator is working the queue, so stay on the page) with a link to the new campaign. Optional follow-up: toast offers "Open campaign".

### 7.3 Board view — the queue as a mini kanban

The same page, same data, rendered as columns. The board's job: *"what happened to every prospect I've queued?"* — from capture to terminal outcome, at a glance.

**Data source.** `GET /prospect-queue` gains `include=campaigns` (or a sibling `GET /prospect-queue/board`) which LEFT JOINs `processed_campaign_id → mkt_campaigns_list` and returns each entry with `{ stage, campaign_category, repair_track, is_hot_prospect, stage_entered_at }` when a campaign exists. Dismissed entries are excluded from the board (visible in List view only).

**Module-aware columns.** Column sets are **not hard-coded** — they come from the same maps the backend transition machine uses:

| Board mode | Columns | Applies to campaigns where |
|-----------|---------|---------------------------|
| **Review pipeline** | Queued → Seek → Preview Built → Shown → Paid → Delivered → Retainer Pitched → Retainer Won → Tenant Onboarded → (Lost / Dead collapsed) | `review_management`; `profile_repair` with `standard` track or undecided triage; `triage_management` (mirrors `transitionsFor` defaults and the Openers/Follow-Ups inclusion rule) |
| **Recovery pipeline** | Queued → Audit Identified → Framework Preview → Outreach Dispatched → Awaiting Owner Intake → Intake Submitted → Final Resolution Drafted → Owner Approved → Resolved & Closed → (Dead collapsed) | `recovery_management`; `profile_repair` with `escalated` track |

A pipeline toggle (Review | Recovery) sits in the header — mirroring how the user guide already splits the two cycles (§3 of the guide). The Review board is default. Labels reuse `STAGE_LABELS` (dashboard client) and `RECOVERY_STAGE_LABELS` (`recoveryStages.ts:39`); terminal `lost`/`dead` columns are collapsed behind a "Show closed" toggle to keep the board narrow.

**The Queued column** is always first, in both modes — it's the same `status='queued'` entries shown in List view, with the same **Create Campaign** / **Dismiss** actions. Creating a campaign from a board card moves the card into its initial stage column (`seek` on the Review board, or the derived recovery stage) on the next render — the visible "graduation" moment.

**Cards.** Compact: business name (bold), city, flame icon when `is_hot_prospect`, days-in-stage chip (`stage_entered_at`, amber after 7 days, red after 14 — staleness is the kanban's main signal), and `StageBadge` (existing component) for campaigns.

**Queued cards are audit-aware** — everything the operator needs to decide *before* hitting **Create Campaign** is on the card, captured from the source audit at queue time (§5.1 denormalized columns):

| Field | Rendering | Source |
|-------|-----------|--------|
| **Priority** | `Flag` toggle, red when `high` — adjustable in place via PATCH | `priority` |
| **Assignee** | Operator display name chip on the card when claimed (resolved via the existing `useStaffUsers()` + `staffDisplayName()` from `PlatformUserSelect.tsx` — same pattern as the campaign list's "Assigned To" column); "Unassigned" grey text when null. **Assign to me** quick action on unclaimed cards (PATCHes own id); assignee can unassign/reassign from the card menu | `assigned_to` |
| **Audit date** | Date chip ("audit: Jul 28"); tinted amber when `audit_date` is > 14 days stale — the finding may have drifted | `audit_date` |
| **Category** | Text badge | `category` |
| **Scope** | Small badge (`category` / `city`) indicating the audit's blast radius the prospect came from | `source_scope` |
| **Signals** | Up to 3 signal-code chips with the same family coloring and crisis highlighting (`RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS` → red) as the audit-card rows, "+n more" overflow tooltip, signal-count badge | `detected_signals` / `signal_count` |
| Rating / reviews | ★ rating · review_count line | `rating` / `review_count` |
| Queued | Relative queued time + who captured it (`queued_by`, smaller secondary text — distinct from the assignee) | `created_at` / `queued_by` |
| Note | Inline pencil preview | `note` |

Click any campaign card → campaign detail page; click a queued card → expands a snapshot popover (full signal list, address, phone, website, observed opportunities from `business_snapshot`) with the **Create Campaign** / **Dismiss** actions. The List view rows carry the same fields as columns, so both views triage identically.

**Advancing a stage (v1: click-to-advance).** Each campaign card has an overflow menu listing the **valid next stages only**, computed client-side from a stage-map constant that mirrors `transitionsFor(category, repair_track)` (same values — review/recovery maps — exported from the web service so it can't drift silently; backend remains authoritative). Selecting one calls `POST /:id/transition`:

- Success → card moves columns.
- `409 checklist_incomplete` → the existing soft-gate warning dialog pattern (list incomplete required steps, "Proceed anyway" re-fires with `acknowledge_incomplete: true`).
- `Invalid stage transition` → toast; the card snaps back. Possible only if the maps drifted or the campaign changed mid-session — backend wins.

Irreversible-looking moves (`lost`, `dead`) ask for confirmation and accept the optional `notes` reason. Resurrection paths already exist in the transition tables (`lost → seek`, `dead → seek`/`audit_identified`), so no special-casing.

**What the board deliberately does not do (v1):**

- **No drag-and-drop** — click-to-advance only. Drag adds an optimistic-update + rollback problem for zero new capability; revisit after the click path ships.
- **Not a global pipeline board** — only queue-sourced campaigns appear. A full-pipeline kanban is a separate feature on the Campaigns page if ever wanted.
- **No WIP limits / swimlanes** — priority flag + staleness chips carry the signal.

### 7.4 Nav + dashboard

- `MarketingOpsNavPanel.tsx` `NAV_ITEMS`: insert `{ href: '/settings/admin/marketing-ops/queue', label: 'Queue', icon: IconListCheck, emoji: '📥' }` directly after **Dashboard** (it is the start-of-day surface). Reuse the existing Mantine `Badge` (already imported) to show `queuedCount` — count fetched by the nav panel via `listProspectQueue({ limit: 0 })`-style lightweight call or a shared SWR-style cache read.
- New `ProspectQueueWidget.tsx` on `MarketingOpsDashboardClient.tsx` next to `HotProspectsWidget` (line 227): header "Prospect Queue (n)", top 3 rows (name, signals badge, relative queued time), "Work the queue →" link. Copies `HotProspectsWidget.tsx` structure.

---

## 8. Edge Cases & Non-Goals

- **Parent campaign deleted after queueing:** `source_campaign_id` is SET NULL; create-campaign then fails with a clear 404 telling the operator to re-queue manually. Accepted — parents are category-scope campaigns and rarely deleted.
- **Audit/execution purged:** no FK on `source_audit_id` / `source_execution_id`; snapshot keeps the entry fully actionable.
- **Same business queued from two different audits:** blocked by the dedup rule (name+city+category), first entry wins; the second click returns the existing entry (`created: false`). The entry's note field is the place to append context.
- **Campaign created directly from the audit (spawn) while an entry is queued:** possible race across sessions. Mitigation: `createCampaignFromQueue` relies on AC84 inside the derive services — it will attach to the existing campaign (`created: false`) and still mark the entry processed. No duplicate campaigns.
- **Stale queue:** no auto-expiry in this sprint. A future sprint can age out `queued` entries > N days into a review bucket. (On the board, staleness is surfaced visually via days-in-stage chips instead.)
- **Track switch mid-board:** a profile-repair campaign switching standard ↔ escalated moves between the Review and Recovery boards (its `transitionsFor` table changes). The card simply appears in the other board mode on next fetch — no board-side bookkeeping, because column membership is derived per render.
- **Non-goals:** per-operator queues, drag-to-reorder within the Queued column (priority flag + deterministic sort is enough for v1), bulk queue-from-audit ("queue all sampled businesses"), drag-and-drop board transitions, global-pipeline board — all deferred (board-specific non-goals also listed in §7.3).

---

## 9. Acceptance Criteria

1. **AC1** — From any of the three audit surfaces, clicking **Add to Queue** persists the business without navigation; the button shows a persistent queued state on re-render (list check survives page reload by cross-referencing the queue list).
2. **AC2** — Re-clicking / re-queueing the same business+city+category returns the existing entry (`created: false`) and never creates a duplicate row.
3. **AC3** — Queueing a business that already has a business-scope campaign returns `409 campaign_exists` with a link; no row is created.
4. **AC4** — The queue page lists queued entries sorted priority DESC → signal_count DESC → FIFO, without opening any audit page.
5. **AC5** — **Create Campaign** from a `scan_unmatched`/`city_category_audit` row produces a child campaign identical in every respect to today's on-the-spot spawn (columns, `city_analysis` audit, hot-prospect flags, auto-triage when signals exist) — verified by replaying the same snapshot through both paths and diffing the results.
6. **AC6** — Create-from-queue marks the entry `campaign_created` with `processed_campaign_id`, and is idempotent (repeat clicks return the same campaign, no duplicates).
7. **AC7** — Dismiss sets status + reason, removes the row from the default view, and allows re-queueing the business later (new row).
8. **AC8** — Nav shows a Queue item with a live queued-count badge; dashboard widget shows count + top 3 + link.
9. **AC9** — `pnpm checkweb` and API typecheck pass; migration runs cleanly forward and `prisma db pull` afterwards shows the model (with the partial unique index listed under unsupported-index warnings only).
10. **AC10 (board)** — The board renders the Review or Recovery column set per the pipeline toggle; every campaign card sits in the column matching its current `stage` — verified against the campaign detail page for a mixed-category queue.
11. **AC11 (board)** — Creating a campaign from a Queued-column card moves the card to the `seek` (or derived recovery) column without a page reload.
12. **AC12 (board)** — Click-to-advance offers only stages valid per `transitionsFor(category, repair_track)`; an advance goes through `POST /:id/transition`, and a `checklist_incomplete` 409 surfaces the soft-gate dialog with proceed-anyway working.
13. **AC13 (board)** — `lost`/`dead` columns are collapsed by default; dismissing an entry removes it from the board; profile-repair track switches move the card between board modes.
14. **AC14 (audit-aware cards)** — A queued card renders priority, audit date (distinct from queued date), category, source scope, and signal chips without opening the source audit; crisis signals render red; an `audit_date` older than 14 days shows the stale tint. Values persist correctly even if the source audit/execution is subsequently deleted (denormalized at queue time).

---

## 10. Testing Plan

**API (`apps/api/src/services/__tests__/MarketingProspectQueueService.test.ts`)** — mirror `MarketingCampaignService.test.ts` style (mocked Prisma):

- add: happy path, dedup hit (`created: false`), campaign-exists 409, signal_count/rating denormalization from snapshot.
- create-campaign: snapshot replay routes to the correct derive service per `source_kind`; AC84 collision still marks entry processed; idempotent second call; entry-not-queued 409.
- dismiss: idempotency, re-queue after dismiss inserts a new row.
- list: ordering (priority → signal_count → FIFO) and `queuedCount` correctness under filters.

**Web (manual / component checks):**

- Button state machine on all three audit cards: idle → loading → queued / already-in-queue / campaign-exists.
- Queue page: create, dismiss, priority toggle, note edit, status tabs; confirm no page navigation on create.
- Board: column membership matches campaign stage; click-to-advance valid-target menus per category; soft-gate dialog on incomplete checklist; card graduation from Queued column; pipeline toggle with a mixed queue.
- Badge/widget counts update after add/dismiss/create (cache invalidation).

---

## 11. Phasing

| Phase | Scope |
|-------|-------|
| **P1 — Data + API** | Migration 160, Prisma model, `MarketingProspectQueueService`, routes (incl. `include=campaigns`), service tests |
| **P2 — Add-to-Queue buttons** | `MarketingOpsService` client block, buttons + state on the three audit cards |
| **P3 — Queue page (List view)** | Route, `ProspectQueueClient`, create/dismiss/priority/note actions, filters |
| **P4 — Chrome** | Nav item + badge, dashboard widget, user-guide section (§12) |
| **P5 — Board view** | List/Board toggle, module-aware columns from stage maps, card graduation, click-to-advance via `/:id/transition` with soft-gate dialog, staleness chips |

P1+P2 alone deliver the core value (capture without navigation); P3 is required before the feature is usable daily. P5 is separable — the List view stands on its own — but small, since the board is a pure derived view over P1's data.

---

## 12. Documentation Updates

- `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md` — new section **§33 Prospect Queue**: what the queue is, Add-to-Queue vs Spawn decision guidance ("act now → Spawn; act later → Queue"), start-of-day workflow, List vs Board views (with the module-aware column explanation pointing back to §3's cycle comparison), click-to-advance and the checklist soft gate on the board, dismiss hygiene, and the note that queue entries are pre-campaign (not in pipeline metrics). Add the queue page to the workflows list in §1 and the nav description.
- This sprint plan linked from the user guide's Sources block.
