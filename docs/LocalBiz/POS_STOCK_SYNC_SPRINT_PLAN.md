# POS Stock Sync — Sprint Plan

Companion to `POS_STOCK_SYNC_SPEC.md` (v1). This is the build plan: gap
sweep findings first, then phased tasks. Spec scope stands: POS → platform
lane, validated end-to-end through the SWIS push.

## 0. Gap sweep — spec vs codebase (2026-11-10)

| # | Spec said | Reality | Impact |
|---|---|---|---|
| G1 | `mapping_status='matched'` | Actual values are `'mapped'` / `'conflict'` / `'pending'` (`integrations/clover.ts`) | Query uses `'mapped'` |
| G2 | Clover stock via `item_stocks` | Existing code reads `stockCount` off `GET /v3/merchants/{id}/items?expand=...` (real + emulator share the field) | Poll job fetches `/items` for mapped ids and reads `stockCount` — same call shape as the import lane, no new endpoint semantics. `item_stocks` remains an option if per-item reads get hot |
| G3 | "Square OAuth is stubbed" | Half-true. `routes/oauth/square.ts` + `services/square/SquareOAuthService` + `square-oauth.service.ts` are a **real OAuth implementation** (sandbox/prod URL switch, `obtainToken`, refresh). `routes/integrations/square.ts` is the stub (status/disconnect/sync 501s) | Square scope shrinks: wire callback → `square_integrations_list` + locations + product mapping; implement the four `/integrations` stubs as thin wrappers over the existing services |
| G4 | New job pattern needed | Jobs register two places: catalog entry in `index.ts` (~line 120) + `scheduleJob` + dynamic-import `start*` (~line 176) | Both touchpoints in the task list |
| G5 | `swis_listed` push path | Confirmed: `MerchantProductSync.upsertLocalInventoryForItem(tenantId, itemId, storeCode)` exists; `store_code` lives on `google_merchant_links_list` | Job resolves storeCode per tenant once, not per item |
| G6 | — | `clover_sync_logs_list` already has `operation`, counts, `error_details`, `duration_ms` — perfect fit | No schema work needed for logging |

No schema migrations required for Phase 1–2. Only Phase 3 adds a table
(`pos_dirty_items`).

## 1. Phase 1 — shared core + Clover poll (POS→platform operational)

**P1.1 `PosStockSyncService`** (`apps/api/src/services/PosStockSyncService.ts`)

- `reconcileStock(tenantId, diffs, ctx?) → { updated, skipped, swisDirty }`
- Skip-unchanged compare vs `inventory_items.stock`; `update` on change;
  collect `swis_listed` changes into `swisDirty`.
- `swisPushForDirty(tenantId, itemIds)` — resolve `store_code` from active
  `google_merchant_links_list` once; per dirty item call
  `upsertLocalInventoryForItem`; collect `{pushed, skipped, errors}` —
  push failures logged, never thrown. SWIS gate mirrors
  `evaluateSwisReadiness`'s `selectedCount` predicate (swis_listed +
  active + public + physical/hybrid).
- Unit tests: diff/skip/swisDirty matrix; SWIS gate rejection paths;
  per-item failure isolation.

**P1.2 Clover stock client** — small `CloverStockClient` in
`PosStockSyncService` or `services/clover/`: given an integration row,
fetch `/v3/merchants/{merchant_id}/items` (chunked `itemIds`, 100/call,
`limit`+`offset` pagination), return `Map<cloverItemId, stockCount>`.
Reuse the existing `CLOVER_ENVIRONMENT` URL switch and the integration's
`access_token`. Demo-mode fixture items (`clv_item_*`) are never selected
(mode guard in the query, not the client).

**P1.3 Job `clover-stock-sync`** (`apps/api/src/jobs/clover-stock-sync.ts`)

- `scheduleJob`: 15 min via `POS_CLOVER_POLL_INTERVAL_MS` (floor 5 min),
  `envDisableVar: DISABLE_CLOVER_STOCK_SYNC`, `maxRunMs` 10 min, catalog
  entry + dynamic-import `start` in `index.ts`.
- Select `status='active' AND mode='production'` integrations → mapped
  items (`mapping_status='mapped'`, `rvp_item_id` non-null) → fetch stock
  → diff → `reconcileStock` → `swisPushForDirty` → write
  `clover_sync_logs_list` (`operation='stock_sync_poll'` |
  `'stock_sync_baseline'` on first run) + `last_sync_at/last_sync_status`.
- `401` → `last_sync_status='token_expired'`, skip until re-auth. Other
  API errors → log + continue to next integration.
- Unit test: tenant selection excludes demo/inactive; baseline tagging;
  token-expired short-circuit.

## 2. Phase 2 — Square (sandbox-first, same core)

**P2.1 Wire existing OAuth into persistence** — in
`routes/oauth/square.ts` callback: after `exchangeCodeForToken`, upsert
`square_integrations_list` (`merchant_id` from token response,
`location_id` from `locations` list — first ACTIVE), then fire first-run
catalog mapping. Implement `routes/integrations/square.ts` `status` /
`disconnect` / `sync` as thin wrappers (status = real row + mapping
counts; disconnect = revoke + `enabled=false`; `sync` = manual
`batchRetrieveInventoryCounts` run for ops use).

**P2.2 Catalog mapping** — `POST /v2/catalog/list` (ITEM + variations) →
SKU-join to `inventory_items` → upsert `square_product_mappings_list`
(`sync_status='matched'|'unmatched'`). Existing
`square-integration.repository` helpers where they fit.

**P2.3 Job `square-stock-sync`** — daily via
`POS_SQUARE_POLL_INTERVAL_MS`, `DISABLE_SQUARE_STOCK_SYNC`; per enabled
integration `batchRetrieveInventoryCounts` (mapped variation ids,
`location_id`, paginated) → `IN_STOCK` quantity → `reconcileStock` →
`swisPushForDirty` → `square_sync_logs_list` +
`last_sync_at`/`last_error`.

**P2.4 Sandbox verification (§9 of spec)** — Clover sandbox + Square
sandbox E2E runs; demo-lane exclusion test; manual-run from Scheduled
Jobs UI; assert stock + sync-log + swisDirty/push attempt.

## 3. Phase 3 — Clover webhook (deployed-env real-time)

`POST /api/webhooks/clover` (signature-verified, faire-pattern) →
`pos_dirty_items` queue (new migration) → `pos-dirty-flush` job (15 min)
→ grouped `item_stocks` re-pull → `reconcileStock` → push. Webhook
registration on connect. Poll job stays as backstop.

## 4. Phase 4 — hardening

Multi-location Square; per-tenant cadence; operator-facing sync status on
integrations settings page; `swisDirty`-consuming real-time push moved
into the downstream lane's spec.

## 5. Sequencing / effort shape

1. P1.1 → P1.2 → P1.3 land together (core is dead weight without a
   producer). Tests alongside each.
2. P2 is independent — can parallel or follow; gated on sandbox Square
   app creds existing (check `SQUARE_APP_ID` in Doppler first — if
   absent, P2.1 stalls and P2.3's test coverage becomes unit-only).
3. P3 blocked until the API is publicly reachable for webhook delivery
   (stg deploy is sufficient).
4. `pnpm checkapi` + targeted vitest per task; `pnpm build` clean before
   merge per AGENTS.md.
