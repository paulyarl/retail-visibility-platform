# POS Stock Sync — Clover + Square → Platform

Spec v1 · 2026-11-10 · status: draft for review

## 1. Purpose

Make `inventory_items.stock` truthful for POS-connected merchants.

**Scope boundary — this spec is the POS → platform lane only.** The
platform → SWIS lane (MerchantProductSync, `upsertLocalInventoryForItem`,
`gmc-scheduled-sync`, the `swis-readiness` checklist) already exists as a
separate lane and is NOT built here. The relationship between the lanes is
a *dependency*: platform → SWIS is incomplete whenever POS → platform is
not operational, because it can only ever publish stock as fresh as this
lane makes it. This spec's done-state is: stock truth flows from the POS
into `inventory_items` on a defined cadence, with observability (jobs,
sync logs, status surface) an operator can verify.

**But the lanes are validated end-to-end.** §9 includes an explicit
POS → platform → SWIS propagation check: a stock mutation in the sandbox
POS must be observable reaching the downstream lane (the changed item's
`swis_listed` flag + the GMC push path it feeds). The downstream lane is
not rebuilt for that validation — it's *touched*: the existing
`upsertLocalInventoryForItem` / `gmc-scheduled-sync` machinery is invoked
as the consumer of this lane's output so the pipeline is proven whole,
not just each half.

## 2. Architecture

```
Clover POS ──(poll: GET item_stocks)──────────────┐
Square POS ──(poll: batchRetrieveInventoryCounts)─▶  reconcile ─▶ inventory_items.stock
Clover POS ──(webhook → dirty-mark → re-pull)─────┘       │
                                                        ▼  (downstream lane, existing)
                                              MerchantProductSync / GMC local inventory
```

Three producers, one reconcile path. No lane owns stock-update logic —
dedup, logging, and item-mutation rules live in the shared core so every
POS provider behaves identically and observability is uniform.

## 3. Shared core — `PosStockSyncService`

New service `apps/api/src/services/PosStockSyncService.ts`:

```ts
reconcileStock(tenantId, diffs: Array<{
  inventoryItemId: string;
  newStock: number;
  source: 'clover_poll' | 'clover_webhook' | 'square_poll';
  posItemId?: string;   // provider-side id, for logs
}>, ctx?) → { updated: number; skipped: number; swisDirty: string[] }
```

Behavior:

1. For each diff: compare `newStock` vs `inventory_items.stock`.
   Unchanged → skip (counts toward `skipped`).
2. Changed → `inventory_items.update({ stock })`.
3. Changed items that are `swis_listed` are returned in `swisDirty` —
   the caller's *hand-off to the downstream lane*. The poll jobs then
   fire `MerchantProductSync.upsertLocalInventoryForItem` for each dirty
   item (best-effort, push failures logged not thrown) so the end-to-end
   chain is exercised on every run — a real-time push hook in the
   downstream lane's own spec may later take that call over, but the
   pipeline is proven working from day one rather than asserted on paper.
4. Reconcile is per-item idempotent — a mid-run crash leaves the next run
   to redo the untouched tail.

`reconcileStock` itself does NOT call `upsertLocalInventoryForItem` —
the lane boundary lives inside the service (reconcile vs. push are
separate steps), while the *job* performs both so every run exercises
the full POS → platform → SWIS chain.

## 4. Lane 1 — Clover poll job `clover-stock-sync`

New `apps/api/src/jobs/clover-stock-sync.ts`, registered via
`scheduleJob` (jobs/registry — admin Scheduled Jobs UI, run history,
kill switch, lock TTL come free):

| Setting | Value |
|---|---|
| `name` | `clover-stock-sync` |
| `computeNextDelay` | 15 min (`POS_CLOVER_POLL_INTERVAL_MS` env override, floor 5 min) |
| `envDisableVar` | `DISABLE_CLOVER_STOCK_SYNC` |
| `maxRunMs` | 10 min |

Per run, for every `clover_integrations_list` row where `status='active'`
AND `mode='production'` (demo integrations excluded — the emulator lane
never touches real stock):

1. Fetch stock for mapped items:
   `GET {apiBaseUrl}/v3/merchants/{merchant_id}/item_stocks?itemIds={csv}`
   — `apiBaseUrl` from the existing env switch (`CLOVER_ENVIRONMENT`,
   sandbox → `sandbox.dev.clover.com`). Chunk `itemIds` at 100.
   Only mapped items: `clover_item_mappings_list` where `rvp_item_id IS
   NOT NULL` and `mapping_status='matched'` — unmapped rows are the
   operator's pending queue, not sync targets.
2. Build diffs (clover `stockCount` → `inventory_items.stock`) →
   `PosStockSyncService.reconcileStock`.
3. Update `last_sync_at` / `last_sync_status` on the integration row and
   write a `clover_sync_logs_list` row (`operation='stock_sync_poll'`,
   counts + error details + `swis_dirty_count`, `duration_ms`) — mirrors
   the existing import sync's logging so the operator sees one uniform
   audit trail.
4. Per-integration isolation: a Clover API failure on tenant A is logged
   and the loop moves to tenant B. `401` →
   `last_sync_status='token_expired'`, skipped until re-auth — never
   retried hot.

**First run behavior:** the first poll per integration is a *baseline* —
reconcile normally but tag the sync-log row `operation='stock_sync_baseline'`
so a 500-item first sync doesn't read as a 500-item day.

## 5. Lane 2 — Clover webhook (phase 3, after the poll proves out)

`POST /api/webhooks/clover` — public route (no `authenticateToken`;
Clover isn't a session), signature-verified per Clover's webhook auth
header, following the `routes/webhooks/faire.ts` pattern (raw body →
verify → parse).

- Event types consumed: payment/order/inventory mutations. Payloads are
  signal-only (no stock numbers) → insert dirty item ids into a
  `pos_dirty_items` work queue (new table, phase-3 migration: `id,
  provider, integration_id, pos_item_id, queued_at, flushed_at`).
- A debounce job (`pos-dirty-flush`, every 15 min) groups dirty ids by
  integration → re-pulls `item_stocks` for just those ids → same
  `reconcileStock` path. Thin payloads + dedup means a busy merchant
  costs ~1 API read per 15 min regardless of transaction volume.
- Registration: on OAuth-connect success, `POST
  /v3/merchants/{id}/webhooks` registers the endpoint for that merchant
  (best-effort; the poll job is the safety net if registration fails).
- Env note: webhooks require a publicly reachable API — they activate on
  stg/prd deploys. Local dev relies on the poll lane (or a tunnel).

## 6. Lane 3 — Square (sandbox-first)

The Square surface is stubbed today: `/square/oauth/authorize`,
`/oauth/callback`, `/disconnect`, `/sync` all return 501 — but
`square_integrations_list` / `square_product_mappings_list` /
`square_sync_logs_list` all exist in the schema already.
`SQUARE_ENVIRONMENT` (sandbox|production) already switches
`unifiedConfig`.

**6.1 OAuth connect** — implement the four stubs against Square OAuth v2:

- `authorize` → build `connect.squareupsandbox.com` /
  `connect.squareup.com` authorize URL (scopes: `ITEMS_READ
  INVENTORY_READ MERCHANT_PROFILE_READ`, state = signed tenant nonce).
- `callback` → exchange code → upsert `square_integrations_list`
  (`access_token`, `refresh_token`, `merchant_id`, `scopes`,
  `mode=SQUARE_ENVIRONMENT`, `enabled=true`) → fetch locations →
  `location_id` (first active location; multi-location is a later
  decision — the schema holds one).
- `disconnect` → revoke token, `enabled=false`.
- `status` → return the real row (replaces the hardcoded
  `enabled:false`).

**6.2 Product mapping** — on first connect, run a catalog pull
(`POST /v2/catalog/list` + variations) and populate
`square_product_mappings_list` by SKU match against `inventory_items`
(`sync_status='matched'` | `'unmatched'`). SKU is the join key — same
convention the Clover mapping table already uses. Unmatched rows surface
in the status route for operator triage; they are not sync targets.

**6.3 Daily job `square-stock-sync`** — registry job, `computeNextDelay`
= 24h (`POS_SQUARE_POLL_INTERVAL_MS` override),
`DISABLE_SQUARE_STOCK_SYNC`:

- Per enabled integration: `batchRetrieveInventoryCounts` for all mapped
  `square_item_variation_id`s at `location_id`, paginated.
- Counts (`state='IN_STOCK'`) → diffs → `reconcileStock`.
- `square_sync_logs_list` row per run (`sync_type='inventory'`,
  `direction='pull'`, counts, errors). `last_sync_at`/`last_error` on the
  integration.

## 7. Config surface

| Var | Purpose | Default |
|---|---|---|
| `CLOVER_ENVIRONMENT` | existing sandbox/prod URL switch | `sandbox` |
| `SQUARE_ENVIRONMENT` | existing sandbox/prod switch | `sandbox` |
| `POS_CLOVER_POLL_INTERVAL_MS` | lane-1 cadence | 900000 (15 min) |
| `POS_SQUARE_POLL_INTERVAL_MS` | lane-3 cadence | 86400000 (24 h) |
| `DISABLE_CLOVER_STOCK_SYNC` | kill switch (registry convention) | — |
| `DISABLE_SQUARE_STOCK_SYNC` | kill switch | — |
| `SQUARE_APP_ID`, `SQUARE_APP_SECRET` | OAuth app credentials | Doppler |
| `CLOVER_WEBHOOK_SECRET` (phase 3) | webhook signature verify | Doppler |

## 8. Ops & failure posture

- **Both jobs appear in Scheduled Jobs UI** automatically via
  `scheduleJob` (schedule label, run history, captured logs, DB kill
  switch, lock TTL).
- **Sync logs are per-integration per-run** (`clover_sync_logs_list`,
  `square_sync_logs_list`) — the operator debugging stale stock reads one
  row: last run, counts, the failing item's error.
- **No partial-tenant corruption:** reconcile is per-item idempotent; a
  mid-run crash just means the next run redoes the untouched tail.
- **Rate limits:** Clover `item_stocks` chunked at 100 ids; Square
  `batchRetrieveInventoryCounts` paginated.
- **Token expiry is a first-class state** (`last_sync_status`), not a log
  line — the integrations UI can badge "reconnect needed".
- **Downstream signal:** `swisDirty` counts land in each sync-log row so
  the operator can see "this run dirtied N SWIS-listed items — the next
  GMC sync window covers them" without the two lanes sharing a call.

## 9. Test plan (sandbox)

1. **Unit:** `reconcileStock` diff/skip/`swisDirty` matrix; Clover
   `stockCount` mapping; Square `IN_STOCK` quantity mapping;
   unmatched-mapping exclusion. Pattern: existing service vitest suite.
2. **Clover sandbox E2E (end-to-end):** `CLOVER_ENVIRONMENT=sandbox` →
   OAuth-connect a sandbox merchant → import items → mark one
   `swis_listed` → mutate stock in the Clover sandbox dashboard →
   trigger the job manually from Scheduled Jobs UI → assert
   `inventory_items.stock` updated + `clover_sync_logs_list` row written
   + the item appeared in `swisDirty` and the local-inventory upsert was
   attempted for it (GMC-linked sandbox tenant → assert the push
   succeeded; no GMC link → assert it's logged as skipped-by-gate, which
   is the honest outcome of a full-chain run on an unlinked tenant).
3. **Square sandbox E2E:** sandbox app creds → connect → mapping run →
   mutate stock in sandbox Seller Dashboard → manual job run → same
   assertions.
4. **Regression guard:** the demo emulator lane (`clover-demo-emulator`)
   must be untouched — assert `mode='demo'` integrations are never
   selected by the job (test in the tenant-selection unit test).
5. **Prod go-live checklist:** flip `CLOVER_ENVIRONMENT` /
   `SQUARE_ENVIRONMENT` per env, register Square prod OAuth redirect URL,
   watch first real runs via Scheduled Jobs + sync logs before calling
   the lane operational. Only then does the platform → SWIS lane have a
   truthful upstream.

## 10. Phases

- **Phase 1 (this build):** `PosStockSyncService` + Clover poll job +
  sync-log writes. Square OAuth + mapping + daily job (independent — can
  land in the same release or behind `DISABLE_`).
- **Phase 2:** sandbox E2E verification per §9; operator-facing sync
  status surfacing on the integrations settings page.
- **Phase 3:** Clover webhook receiver + `pos_dirty_items` + debounce
  flush + connect-time webhook registration.
- **Phase 4:** multi-location Square, per-tenant sync cadence overrides,
  and — in the downstream lane's own spec — consuming `swisDirty` for a
  real-time SWIS push instead of the 6h window.
