# GMC Merchant API Migration + SWIS Local Inventory Spec

**Status:** DRAFT v0.1 — for review
**Owner:** Engineering (Product sign-off on §7 UI workflow and §8 entitlement shape)
**Date:** 2026-11-02
**Scope:** Migrate the Google Merchant Center integration off the sunset Content API for Shopping onto the Merchant API, and add the **local inventory data path** required for the `discovery`/SWIS tier promise ("products on Google surfaces"). Includes the auth hardening and read-path repairs found in the 2026-11-02 code review.

**Referenced docs:**
- `docs/PLATFORM_GBP_GOOGLE_ADS_SPEC.md` — positions `discovery`/SWIS as the $29 Google-surface tier and a primary ads wedge ("get products on google shopping", "see what's in store")
- `docs/ENTRY_PRESENCE_TRIAD_REDESIGN_SPEC.md` — `discovery` = "SWIS mode", grants `integration_google_*`/`integration_gmc_sync` natively
- `shared/tier-contract.json` — fixture-first rule for any capability-key change (§8)
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — capability-module + scheduler precedent this spec reuses
- Google docs: Merchant API migration guide (`developers.google.com/merchant/api/guides/compatibility/overview`), Content API sunset (`shopping-content/guides/deprecation-and-sunset`), local inventory spec (`support.google.com/merchants/answer/14819809`), free local listings (`answer/15310605`), local inventory data spec / store_code (`answer/13869896`)

---

## 1. Problem Statement

Three compounding failures, in severity order:

### 1.1 The entire integration is on a dying API
Every GMC call — reads (`lib/google/gmc.ts`) and writes (`services/GMCProductSync.ts`, `services/GMCProductSyncSingletonService.ts`, `services/VariantAwareGMCSync.ts`) — uses the **Content API for Shopping**, which sunset **2026-08-18**. Since 2026-09-01, calls from GCP projects without an extension **intermittently fail with HTTP 410**, ramping to full decommission in early 2027. Extension requests capped at 2026-12-31. The integration is presumably already degrading in production — and our silent-swallow error handling (§1.3) makes the degradation invisible.

### 1.2 The sync produces online offers only — SWIS gets nothing
`GMCProductSync.ts` hardcodes `channel: 'online'` (line ~163); the inventory path PATCHes `products/online:en:US:{offerId}`. SWIS ("See what's in store") is a **free local listings** surface driven by a *separate* data path: local-destination products **plus per-store `localInventories` instances keyed by `store_code` matching the GBP store code**. Zero occurrences of `localinventory`, `storeCode`, `liasettings`, or `channel: 'local'` exist in `apps/api/src`. Today, tenants paying for the SWIS tier get online Shopping surfaces at best — the signature surface is undelivered.

### 1.3 The read path is broken and the routes are unauthenticated
- `lib/google/gmc.ts` builds malformed URLs (`{shoppingcontent}/v2.1/accounts/{id}/products` — matches neither Content API `/content/v2.1/{id}/products` nor Merchant API `merchantapi.googleapis.com`) → 404 → swallowed → `[]`/`null` → routes return 200 with empty payloads. Broken integration is indistinguishable from "no products".
- `getProductStats` counts `productStatus.itemLevelIssues`, which `products.list` never returns → everything tallies `active` even if the URL worked. No pagination anywhere.
- `google-merchant-oauth.ts` and `inline-google-oauth.ts` apply **zero auth middleware** — `mountFromRegistry` only enforces `entry.middleware`; `authLevel` is route-map metadata. `GET /google/gmc/products|stats|accounts` reads any tenant's GMC data by `tenant_id` query param (IDOR); `POST /google/gmc/sync` writes `google_merchant_links_list` for arbitrary tenant+merchant pairs (unauthenticated cross-tenant write). Same pattern in `google-merchant-oauth.ts` (`/google/oauth/status|list-merchants|link-merchant`).
- `GET /tenant/:tenant_id/swis/preview` returns `{id,name,price,image_url,sku}` while the UI type expects `{sku,title,price,currency,image_url,availability,updated_at,brand,categoryPath,badges}` — the widget renders empty titles, no availability, no badges, and a fictitious "Updated now" timestamp. `sort` is sent but ignored; `limit` uncapped (spec says ≤24).

### 1.4 What works and must be preserved
- `lib/google/token-store.ts` (`findGoogleToken`, `resolveGoogleAccessToken`, `resolveGoogleTokenState`) — OAuth scope `auth/content` carries over to Merchant API; no re-consent needed for existing tokens.
- `evaluateGMCSyncGate`/`isGMCSyncAllowed`/`gmcSyncGateError` (`lib/google/capability-gate.ts`) — layered entitlement gate, reuse as-is.
- `gbp-target.ts` + `gbp_locations_list` — location resolution machinery the store-code mapping builds on.
- `jobs/gmc-scheduled-sync.ts` — 6h cadence already inside the 14-day local-inventory expiry; keep, extend.
- `GMCValidationService` — pre-flight feed validation, still correct concept.
- `google-merchant-oauth.ts` status/link flow + `OverviewTab` merchant picker — the connection UX is right; it needs additional checklist steps, not a rewrite.

---

## 2. Goals / Non-Goals

**Goals**
1. **Zero Content API remnants** — no `shoppingcontent`/`content/v2.1`/`custombatch`/`online:en:` literals or call sites survive in `src/` (enforced, §12).
2. Tenants on GMC-eligible tiers get their products onto **local surfaces** (free local listings / SWIS), not just online listings — the paid `discovery` promise.
3. A read-back path that can state, per tenant, "N products live on Google, M with issues" from Google-side truth — not pushed-intent.
4. Auth on every tenant-scoped Google endpoint.
5. Merchant-facing setup checklist that walks the console-only steps (program enrollment, GBP↔MC link, store code).

**Non-Goals**
- Local Inventory *Ads* (paid) — out of scope; free local listings only. Ads wedge is `PLATFORM_GBP_GOOGLE_ADS_SPEC.md`'s domain.
- Multi-store/chain tenants — one `store_code` per tenant for v1 (platform is single-store SMB). Schema shouldn't preclude more.
- MCA (multi-client account) sub-account architecture — v1 links merchant-owned MC accounts as today.
- POS-app fast path (Clover/Square Local Inventory app feeding SWIS independently). Worth detecting and surfacing ("already fed by your POS provider") but not blocking — see §10 open decisions.
- Rewriting the `/swis/preview` widget UX — only the endpoint contract fix (§7.4) so it stops rendering empty cards.

---

## 3. Merchant API Mapping (Content API → Merchant API)

| Concern | Content API (current) | Merchant API (target) |
| --- | --- | --- |
| Host | `shoppingcontent.googleapis.com` | `merchantapi.googleapis.com` |
| Accounts | `GET /content/v2.1/accounts/{id}` | `GET /accounts/v1/accounts/{id}` |
| Reachable accounts | `GET /content/v2.1/accounts/authinfo` | `GET /accounts/v1/accounts:listSubaccounts` (MCA) or same authinfo-equivalent — **verify during impl** |
| Product upsert | `PUT …/products/{offerId}` | `POST /products/v1/{parent=accounts/*}/productInputs:insert` with `dataSource` |
| Product read | `GET …/products/{id}` | `GET /products/v1/accounts/{account}/products/{product}` (processed view) |
| Product status/issues | `productstatuses` resource | `reports` sub-API / product-level `itemLevelIssues` on processed products — **verify exact resource during impl** |
| Local inventory | `localinventory.insert` | `POST /inventories/v1/{parent=accounts/*/products/*}/localInventories:insert` (`storeCode` + availability/price/quantity/pickup fields) |
| Channel | `channel: 'online' | 'local'` | **Removed** — replaced by destinations/marketing methods on the data source or `includedDestinations` product attribute |
| Price | `{value, currency}` | `{amountMicros: int64, currencyCode}` |
| Batch | `custombatch` | **Gone** — sequential/async calls; bound by our own concurrency limiter (start at 10 in-flight) |
| Bootstrap | none | **Developer registration required**: `POST /accounts/v1/accounts/{account}/developerRegistration:registerGcp` once per GCP project |

Hard rule for implementation: resource identity moves to `name` (`accounts/{account}/products/{product}` where `{product}` encodes channel~language~feedLabel~offerId). The `online:en:US:{offerId}` path-hacking in `updateProductInventory` (line ~828) goes away entirely.

---

## 4. Phase 0 — Stop the Bleeding (days, no migration dependency)

**Status: LANDED 2026-11-02** (items 2–5; item 1 extension request is an ops action — owner + GCP project id still needed). Residual: `feed-jobs` `/:id` routes authenticate but don't yet scope job→tenant (needs a job lookup to scope — Phase-1 follow-up); `GET /` without a `tenantId` query still lists cross-tenant job metadata for authenticated tenant users.

1. **File the Content API extension request** for the platform GCP project (max 2026-12-31) as insurance while migration lands. Decision item: owner + GCP project id.
2. **Auth hardening** — add `authenticateToken, checkTenantAccess` to:
   - `inline-google-oauth.ts`: `/google/gmc/accounts`, `/google/gmc/sync`, `/google/gmc/products`, `/google/gmc/stats`, and the GBP siblings (`/google/gbp/*`) in the same file.
   - `google-merchant-oauth.ts`: `/google/oauth/status`, `list-merchants`, `link-merchant`, `product-sync-status`, `validation-report`, inventory/price push, product delete, and every tenant-scoped handler (OAuth `auth`/`callback` endpoints stay public by design).
   - **`feed-jobs.ts`** — the worst case found in the sweep: mounted at `/api/feed-jobs` labeled `authLevel: 'admin'` with **no middleware**. `GET /setup-status/:tenantId` leaks any tenant's Google linkage/subdomain state; `POST /` creates feed-push jobs for arbitrary tenantIds (subscription-tier checks exist but no identity check). Add `requireAdmin`/tenant middleware at mount.
   - Or set `middleware:` on the registry entries — the registry enforces `entry.middleware`, `authLevel` alone does nothing.
   - Compliant reference (do not break): `gmc-product-sync-singleton.ts` self-auths via `router.use(authenticateToken)` + per-route `tenantIds` check, and `feed-validation.ts` mounts with `middleware: [authenticateToken]`. Those are the two correct patterns in this surface.
3. **Fail loudly in `gmc.ts`** — `listProducts`/`getProduct`/`getProductStats`/`getMerchantAccount` must surface failures (like `listMerchantAccounts` already does — the `merchant_accounts_failed` pattern with its regression test in `__tests__/gmc.test.ts`), not return `[]`/`null`. **Do not fix the URLs** — the functions get rewritten in Phase 1; the throw-first change is one-line-per-function insurance.
4. **Label truth**: `/tenant/:tenant_id/swis/preview` is effectively public — either add middleware or drop the entry's `authLevel: 'tenant'` label so route-map/OpenAPI reflect reality.
5. Delete `apps/api/temp-index.{ts,js}` — stale pre-snake_case duplicates, unreferenced.

**Exit:** no unauthenticated tenant-scoped Google endpoint; every Google API failure is observable (no silent `[]`).

---

## 5. Phase 1 — Merchant API Migration

### 5.1 One client, three call sites consolidated
Today there are three sync implementations (`GMCProductSync.ts`, `GMCProductSyncSingletonService.ts`, `VariantAwareGMCSync.ts`) with overlapping responsibilities and two different endpoint shapes. Migration collapses them into:

- **`lib/google/merchant-api.ts`** — thin client: auth (via `token-store`), base URL, typed request helpers, 410/429/backoff handling, per-tenant rate limit (reuse the singleton's `RATE_LIMIT_*` concept, applied per Merchant API quota instead of our invented 100/hr).
- **`services/MerchantProductSync.ts`** — product upsert/read, absorbing `VariantAwareGMCSync`'s variant logic (itemGroupId/attribute mapping is already correct — port it verbatim).
- `GMCProductSyncSingletonService` — keep the singleton shell (operation tracking, cache, stats endpoints consumed by `gmc-product-sync-singleton.ts` routes) but delegate all HTTP to `merchant-api.ts`. Retire `GMCProductSync.ts` + `VariantAwareGMCSync.ts` as HTTP callers (VariantAware stays as the *mapping* layer if useful).

### 5.2 Bootstrap
- One-time `developerRegistration:registerGcp` per GCP project — add to ops runbook + a startup check that warns if unregistered.
- Provision a **primary data source** per linked merchant (`datasources` sub-API) if none exists; store its resource name on `google_merchant_links_list.data_source_name` (§9 schema). `productInputs:insert` requires `dataSource`.

### 5.3 Endpoint parity table (what replaces what)

| Existing | Replaced by |
| --- | --- |
| `listMerchantAccounts` (authinfo) | Merchant API equivalent — keep throw-first contract + tests |
| `syncMerchantAccount` | `accounts.get` on Merchant API, same upsert into `google_merchant_links_list` |
| `syncSingleProduct`/`syncBatchProducts`/`VariantAwareGMCSync` | `productInputs:insert` per product (no custombatch — concurrency-limited loop), `channel`→`includedDestinations` |
| `updateProductInventory` (PATCH `online:en:US:*`) | local inventory insert (§6.3) for local + product re-input for price/availability deltas |
| `updatePrice` | `productInputs:insert` with updated price (Merchant API has no partial price endpoint — verify) |
| `listProducts`/`getProduct`/`getProductStats` | §7 read-back (processed products + issues) |
| `jobs/gmc-scheduled-sync.ts` | unchanged orchestration, new callee |

**Sweep note — the inventory/price paths are already dead code.** `updateInventory` PATCHes `products/online:en:US:{offerId}` — the Content API `products` resource has no PATCH. `updateProductInventory` (singleton) PUTs `/products/{id}/inventory` — also not a real path. Both always return API errors today, so callers (`google-merchant-oauth.ts` inventory/price routes, `gmc-product-sync-singleton.ts:145`) are broken-by-construction, not just deprecated. No migration loyalty owed — delete rather than port. Two more singleton artifacts worth noting: the `mock_gmc_access_token` branch executes *after* the real `fetch` fires (mock still hits Google first), and `getSyncStats` returns fabricated `tenantUsage` rows (`merchant_12345`).

### 5.4 Field mapping notes
- `price` → `{amountMicros, currencyCode}` — all `price_cents/100` arithmetic moves to micros at the boundary.
- `condition`, `gtin`, `mpn`, `brand`, `identifierExists`, `googleProductCategory`, `productTypes`, `customLabel0-4`, `itemGroupId`, variant attrs — same names on `productAttributes`.
- `contentLanguage`/`targetCountry` → `offerId`/`contentLanguage`/`feedLabel` on the input (feedLabel replaces targetCountry).
- `pickupMethod`/`pickupSla` — move from the product to the **local inventory instance** (they're per-store attributes).
- `contentLanguage`/`targetCountry`/`currency` are hardcoded `en`/`US`/`USD` today — acceptable for the launch cohort (US-local platform) but keep them parameters on the new client so non-US feed labels don't require surgery later.

---

## 6. Phase 2 — SWIS Local Inventory Path (the tier promise)

### 6.1 Store code (new data)
- Add `google_merchant_links_list.store_code` (text, nullable) + `gbp_locations_list.store_code` (text, nullable).
- Source of truth is GBP (Google requires `store_code` to match the Business Profile). v1 derivation: location's GBP `storeCode` field if Google returns one via `listLocations`; else deterministic default `vs-{tenant_slug}` written to GBP via the Business Information API (we already write GBP fields — `GBPBusinessInfoSync`).
- One store per tenant in v1; column (not hardcode) so multi-store lands later without migration surgery.

### 6.2 Readiness chain (what must be true before local sync runs)
1. GMC link active (`google_merchant_links_list.is_active`) — exists.
2. GBP location resolved (`resolveGbpTarget`) — exists.
3. **GBP↔MC account link** — merchant-side console step (or Accounts API `relationships` if exposed — verify); surfaced as checklist state, not silently assumed.
4. **Free local listings enrollment** on the MC account — console step; detect via Merchant API programs/account settings (verify exact probe) and surface as checklist state.
5. `store_code` set on both sides.
6. **Product selection** — the merchant has explicitly chosen ≥1 product for the local surface (`inventory_items.swis_listed`, **default false** — deny-by-default). Local inventory sync never runs for an unselected item (§6.4).

Represent as `swis_readiness` on the merchant-link row: `pending_gbp_link | pending_enrollment | pending_store_code | pending_selection | ready | error` + `swis_readiness_detail` JSON for the checklist. `ready` requires all six — including ≥1 selected product.

### 6.3 Product + inventory writes
- **Products:** same catalog payload, submitted with **local destination included** (`includedDestinations: ['FREE_LOCAL_LISTINGS']` or the data-source marketing-method equivalent — verify enum). Only `GMC_SYNCABLE_PRODUCT_TYPES` (physical/hybrid) **and `swis_listed=true`** reach the local destination; unselected items continue to the online destination unchanged — the selection scopes the local surface, never the online feed. The online feed itself gets a per-product opt-out: `google_online_excluded` (§7.3, §9) removes an item from the online destination without touching catalog visibility. SWIS additionally wants `in_stock` items but out-of-stock is still valid feed data (`availability: out_of_stock` hides the item — correct behavior).
- **Deselection is a delete:** flipping `swis_listed` off must issue `localInventories:delete` for that (product, storeCode) — Google retains the instance otherwise and the item keeps showing in-store. Also fire on item deactivation/`visibility` drop below `public`.
- **Inventory:** `localInventories:insert` per (selected product, storeCode) on every `stock_quantity`/`price` change — this **replaces** today's `updateProductInventory` PATCH hack. Fields: `storeCode`, `availability` (`in_stock`/`limited_availability`/`out_of_stock`/`on_display_to_order`), `quantity`, `price`/`salePrice` (micros), `pickupMethod`/`pickupSla` (from the existing fulfillment-mode settings in `SettingsTab`), optional `instoreProductLocation`.
- **Freshness:** extend `jobs/gmc-scheduled-sync.ts` to upsert local inventories in the same 6h run (14-day expiry → we stay <1% of the window). Add a delta trigger: stock-changing writes (POS sync, manual edit) enqueue a local-inventory upsert rather than waiting for the cycle — reuse `gmc-sync-retry.ts` for failure retry.

### 6.4 Gate
`evaluateGMCSyncGate` stays the entitlement check (physical storefront + non-digital products + `gmc_sync` integration). SWIS local sync adds a **readiness check** (§6.2), not a new entitlement — a tenant entitled to GMC sync is entitled to the local path; readiness is setup state, not plan state. See §8 for the optional upsell question.

**Merchant opt-in = product selection (deny-by-default).** The consent boundary is per-product, not a global flag: nothing reaches the local surface until the merchant explicitly selects it (`swis_listed`, default false). Rationale: SWIS broadcasts *live in-store stock*; wholesale/internal/aspirational-stock items leaking to Google is a worse failure than a missing toggle, and deliberate selection keeps that risk merchant-owned. `swis_enabled` on the link row stays as a **master switch** (default off) — it flips on automatically the first time the merchant saves a selection, and serves as the "pause all local listings" kill-switch without losing selections. Two consequences worth stating: (a) newly added products are **not** listed until selected — selection is intent, never inherited; (b) a `discovery` tenant who never opens the picker silently receives online-only delivery of a paid local-surface promise — mitigated by making selection the checklist's headline action + an alert notice (§7.3), not a buried preference.

### 6.5 Status ↔ sync reconciliation (folded from the 2026-11-02 review)

The item-status model and the sync eligibility rules disagree across four query sites — this is the real "product leak" hole, bigger than the selection checkbox. Reconcile to one rule: **Google shows exactly what the public catalog shows.**

**Current divergence (the bug set):**

| Consumer | item_status | visibility | product_type |
| --- | --- | --- | --- |
| `batchSyncProducts` | ≠ `trashed` | `public` | physical/hybrid |
| `gmc-sync-retry` | ≠ `trashed` | `public` | **none** |
| `validation-report` | ≠ `trashed` | `public` | physical/hybrid |
| `product-sync-status` endpoint | **no filter** | **no filter** | **no filter** |
| Public catalog / `swis/preview` | = `active` | `public` | — |

1. **Unified eligibility filter** — all sites use `item_status='active' AND visibility='public' AND product_type IN (physical, hybrid) AND NOT google_online_excluded`. `inactive`/`archived` items currently re-feed Google every 6h while hidden from the storefront; `google_online_excluded` (§7.3) joins the filter as the per-product online opt-out. The local destination applies the same filter **plus** `swis_listed`.
2. **Removal on any eligibility loss** — today `deleteProduct` only fires on trash/purge (`inline-items-crud.ts:1795,1900`). Add status-change hooks: `item_status→inactive|archived`, `visibility→private`, `product_type` out of the syncable set, **`google_online_excluded` set true** ⇒ delete online product + variant offers (never deleted today) + `localInventories` instances. Selection removal (§6.3) and status flips from the GMC UI (§7.3) run the same code path.
3. **Retry-job triple bug** — `gmc-sync-retry.ts` reads `sync_retry_count`/`sync_error_at`, columns that don't exist → retryCount always 0, no backoff ever; the `permanent_error` cap write violates the `sync_status` enum → throws → item stays `error`. Net: every errored item retries every 2h forever. Fix by moving retry state into `gmc_item_sync_state` (`retry_count`, `last_error`, `last_error_at` — real columns, not phantom fields), terminal state as a value in that table rather than an enum hack; add the missing `product_type` filter.
4. **Persist error detail** — `metadata.gmc_sync_error`/`gmc_item_id` are read by `product-sync-status` but never written. Write `last_error` + `offer_id` on every attempt (in `gmc_item_sync_state`, not metadata).
5. **Status endpoint eligibility** — `product-sync-status` gains the unified filter (or an explicit `eligible` column) so `pending` means "will sync, hasn't yet" rather than mixing in private/trashed/digital items that can never move. `gmc_item_sync_state.status` values: `pending | synced | error | exhausted | excluded`.
6. **"Sync Selected" passes the selection** — ProductsTab's bulk action currently calls `onSyncAll()` and discards `selectedIds`; pass them to `batchSyncProducts(itemIds)` (parameter already exists).
7. **`sync_status` is parent-level** — variant syncs don't touch the item row; per-destination state in `gmc_item_sync_state` covers parent and variants (`offer_id` dimension absorbs variants without a new column).
8. **Availability source of truth** — feed derives `availability` from `stock_quantity`/`stock`, ignoring the `availability` enum on `inventory_items`. Pick the stock field as truth for both destinations; drop the enum from feed logic (or map it explicitly — decision at impl).

---

## 7. Phase 3 — Read-Back & Merchant-Facing Workflow

### 7.1 Google-side truth endpoint
Replace `listProducts`/`getProductStats` with a Merchant API read that returns, per tenant:
`{ synced: n, local_inventory_instances: n, issues: [{ product, severity, code, description }] }` — from processed products + their `itemLevelIssues` (paginate fully; the old 250-cap is gone). This powers both the admin diagnosis and the tenant UI.

### 7.2 Per-item sync state (new table `gmc_item_sync_state`)
`(tenant_id, item_id, offer_id, destination, last_sync_at, last_sync_status, last_error, issue_count)` — written by sync, read by ProductsTab. This is what lets the UI say "live on Google / sync failed / excluded" per product instead of nothing.

### 7.3 UI workflow changes (`/t/{tenantId}/settings/integrations/google`)

The connect → link-merchant → sync flow is right; SWIS adds three steps the API can't do for the merchant (console-only), so the checklist does the guiding:

- **Alert notice** — when all prerequisites except selection are done (`swis_readiness='pending_selection'`), the tenant gets a persistent notice (integrations page banner + dashboard alert): "Your products can appear in-store on your Google profile — **select which products to show**." It clears on first selection; it does not nag before the prerequisites exist.
- **OverviewTab setup checklist** gains: `Link Business Profile to Merchant Center` (console, with deep-link + "check again" re-probe), `Enable free local listings in Merchant Center` (console), `Store code assigned` (auto — show the derived code, editable until first sync), and **`Select products for in-store listings`** — the final action, deep-linking into the ProductsTab picker with a count of what's already selected. Steps render from the `swis_readiness` state machine — no new status endpoints, extend `getGoogleFeedJobsSetupStatus`/`getGoogleMerchantSyncStatus` payloads.
- **ProductsTab becomes per-product state management** — each row carries three controls plus the sync-state readout, so a merchant can manage a product's lifecycle *and* its surface presence in one place:
  1. **Item status flip** — `active ↔ inactive`, the same flip the items page performs (same PATCH endpoint, same permission). Confirm copy states the consequence honestly: "Inactive removes this product from your catalog **and all Google surfaces**" — it runs the §6.5 eligibility-loss path (online delete + variant offers + `localInventories` delete), not a soft hide. Flipping back to active re-feeds on the next sync (destination columns retain their flags).
  2. **"Shopping" checkbox** — online destination, **default checked**, writes `google_online_excluded` (inverted storage). Unchecking = the online opt-out: item stays public/active on the catalog but is deleted from the online feed. This is the scalpel for wholesale/MAP/internal items that mustn't hit Shopping.
  3. **"In-store (SWIS)" checkbox** — local destination, **default unchecked**, writes `swis_listed` (per §6.4 deny-by-default). Disabled (with reason tooltip) until `swis_readiness='ready'` or the item fails eligibility.
  - Per-destination state column from `gmc_item_sync_state` + §7.1 issues list: `synced | pending | error | exhausted | excluded` for Shopping and Local side by side — the readout proves each control's effect instead of implying it.
  - Filters: eligibility-aware (`selectable` = active+public+physical/hybrid), plus surface filters (`on Shopping`, `on Local`, `excluded`). Column-header checkboxes = select-all/filtered-select on each surface column. "Sync now" pushes product + local inventory for selected items.
  - **Write API:** `PATCH /google/merchant/product-surfaces/:itemId { swis_listed?, google_online_excluded?, item_status? }` — single authenticated endpoint behind `checkTenantAccess`, applies flags then triggers the matching sync/delete path per changed field (bulk variant `…/bulk` for the header checkboxes). Item-status writes delegate to the existing items-page handler rather than duplicating its trash-capacity/variant side effects.
- **SettingsTab** — the existing fulfillment/pickup settings now drive `localInventories` (`pickupMethod`/`pickupSla`); label them "In-store pickup (shown on Google)". Add the store-code display here, plus a "See what's in store" section with the `swis_enabled` master switch (pause-all without losing selections) and the selected-product count linking back to the picker.
- **Guide page** (`integrations/google/guide`) — document the three console steps with screenshots/links; SWIS copy ("your products browsable on your Google profile") mirrors the tier marketing so `discovery` tenants see the payoff named.
- SWIS-only hint: if a tenant's POS provider already feeds Google (Clover/Square Local Inventory app), say so instead of double-feeding — detection heuristic in §10.

### 7.4 `/swis/preview` endpoint contract fix (small, same sprint)
Return the documented shape: `{items:[{sku,title,brand,price,currency,image_url,availability,updated_at,category_path,badges}], total}`; honor `sort` (`updated_desc|price_asc|alpha_asc`); cap `limit` at 24; key on `id` not nullable `sku`. Either fix the response or fix `SwisPreviewItem` — pick the spec shape since `docs/v_3_6_technical_requirements_impl_ready.md` line 200 already pins it. Flag stays off until the contract is exercised.

---

## 8. Tier / Capability Contract

- **No new capability key for v1** — SWIS local sync is the fulfillment of `integration_gmc_sync`/`google_merchant_center`, not an upsell. `discovery` grants it natively already; `storefront`+ gets it via `integration_flexible` or native keys as today.
- **Optional (decision):** if we want "SWIS-only on a non-discovery tier" as a BSaaS SKU, add `google_local_inventory` (or `integration_swis_feed`) to `shared/tier-contract.json` **first** — fixture edit → regen `capability_modules` (`sync-fixture-modules.cjs`) → DB witness re-dump → wire `effective_google_types`. Per AGENTS.md the contract suites fail on drift; do not bypass.
- `integration_gmc_sync` feature copy in `tier-features.ts`/`presence-modes.ts` should name the real surface: "Products on Google Shopping + in-store listings (See what's in store)" — only once Phase 2 ships, to keep copy honest.

---

## 9. Data Model (migration 373+)

```sql
-- google_merchant_links_list
+ store_code            text
+ data_source_name      text        -- Merchant API dataSource resource name
+ swis_enabled          boolean default false   -- master switch; auto-set on first selection (§6.4)
+ swis_readiness        text default 'pending_gbp_link'
+ swis_readiness_detail jsonb

-- gbp_locations_list
+ store_code            text

-- inventory_items
+ swis_listed           boolean not null default false  -- merchant-selected for local surface (deny-by-default)
+ google_online_excluded boolean not null default false -- per-product online opt-out (§7.3 "Shopping" checkbox, inverted)

-- new: gmc_item_sync_state
id, tenant_id, item_id, offer_id,
destination text,            -- 'online' | 'local'
last_sync_at, last_sync_status, last_error, issue_count int,
unique(tenant_id, item_id, destination)
```

---

## 10. Testing & Rollout

- **Unit:** `merchant-api.ts` request shapes (name/parent/dataSource/price-micros); store-code derivation; readiness state machine transitions; `swis/preview` contract (response shape + sort + limit clamp).
- **Integration:** sandbox MC account end-to-end — product insert → localInventories insert → processed-product read-back shows no errors → flip `stock_quantity` → assert availability propagates.
- **Contract suites:** tier-contract tests if §8 optional key lands.
- **Rollout:** Phase 0 immediately (independent PR). Phase 1 behind `FF_MERCHANT_API` with Content API fallback until Google 410s it fully. Phase 2 gated per-tenant on `swis_readiness='ready'`. Dogfood on `VisibleShelf Internal` (`tid-sud4ky1c`) before tenant GA — same pattern as social posting.
- **Verification commands:** `pnpm checkapi`, `pnpm checkweb`, `cd apps/web && npx vitest run`, API vitest suites for `__tests__/gmc*` + new sync tests.

## 11. Open Decisions

1. **Extension request** — file it anyway (insurance) or commit to migration velocity? Owner + GCP project id needed.
2. **GBP↔MC link** — is it API-exposable for our account type, or forever a console step? (Determines whether §6.2 step 3 is automated or guided.)
3. **POS-app detection** — can we detect a tenant's Clover/Square already feeding local inventory (a `localinventory` instance exists for their storeCode from another feed source) and suppress double-feed? Fallback: surface an advisory, not a block.
4. **Google Hosted Local Storefront verification** (`requestinventoryverification`-equivalent in Merchant API) — needed for tenants without websites; defer to v1.1 or include? Most platform tenants have a platform storefront → `link` resolves — likely deferrable.
5. **`/swis/preview` auth** — public (matches `visibility='public'` semantics) or tenant-scoped (matches mount label)? Currently neither — it claims 'tenant' and enforces nothing.
6. **Multi-store** — confirm single-store assumption holds for the launch cohort (DFY portfolio tenants may have multi-location GBP accounts — `resolveGbpLocation` already handles several rows per tenant).

---

## 12. Appendix — Content API Remnant Inventory & Retirement Matrix

Full sweep of every Content API artifact (2026-11-02). This spec is the complete migration *and* cleanup — nothing in this table survives untouched.

### 12.1 Live call sites (files making Content API HTTP requests)

| File | Sites | Disposition |
| --- | --- | --- |
| `services/GMCProductSync.ts` | 7: products.insert ×2 (single+variant), `products/batch` (custombatch), PATCH `online:en:US:*` ×2 (updateInventory/updatePrice), DELETE `online:en:US:*` | **Retire** — replaced by `MerchantProductSync.ts` (§5.1). `convertToGoogleProduct` survives as the mapping layer (renamed to Merchant API shape). `identifierExists` logic already correct — port to `GMCProductSync.identifier.test.ts` coverage |
| `services/GMCProductSyncSingletonService.ts` | 2: PUT `products/{offerId}`, PUT `products/{id}/inventory` (nonexistent path) | **Shell survives, HTTP replaced** — keeps singleton/ops-tracking/routes contract, delegates to `merchant-api.ts` (§5.1). Delete: mock-token branch (fires real fetch first), fabricated `tenantUsage` stats |
| `lib/google/gmc.ts` | 6: authinfo, accounts.get, products list/get, stats (4 malformed URLs + 1 working authinfo) | **Rewrite** as thin Merchant API read module; keep `listMerchantAccounts` throw-first contract + tests |

### 12.2 Dead / stub remnants

| File | Notes | Disposition |
| --- | --- | --- |
| `services/VariantAwareGMCSync.ts` | All `fetch` calls are commented-out stubs — pure mapping/propagation trigger | **Absorb** variant mapping into `MerchantProductSync.ts`; delete the file |
| `apps/api/temp-index.{ts,js}` | Stale pre-snake_case monolith duplicates (wrong-schema `/swis/preview` copy) | **Delete** (Phase 0) |

### 12.3 Route callers (rewire — endpoint paths stay stable for web)

| File | Endpoints | Action |
| --- | --- | --- |
| `routes/google-merchant-oauth.ts` | `/google/oauth/{status,list-merchants,link-merchant}`, `/google/merchant/{sync,sync-status,product-sync-status,validation-report,settings}`, PATCH `/google/merchant/inventory/:itemId`, price, product DELETE | Rewire handlers to new services; **delete** inventory/price PATCH handlers (dead paths, §5.3) — or rewire to `localInventories` where semantics fit |
| `routes/inline-google-oauth.ts` | `/google/gmc/{accounts,sync,products,stats}` | Rewire to `lib/google/gmc.ts` rewrite; add auth (Phase 0) |
| `routes/gmc-product-sync-singleton.ts` | singleton route surface | Unchanged — delegates through the singleton shell |
| `routes/feed-jobs.ts` | `/api/feed-jobs/*` | Auth fix (Phase 0); job handler calls new sync service |
| `routes/inline-items-crud.ts` | trash/purge GMC delete hooks (1795, 1900) | Rewire to `MerchantProductSync.delete` + extend to all eligibility-loss transitions (§6.5 #2) |

### 12.4 Jobs, tests, generated, docs

| Artifact | Action |
| --- | --- |
| `jobs/gmc-scheduled-sync.ts` | Keep orchestration; callee swaps to `MerchantProductSync` + local-inventory upsert (§6.3) |
| `jobs/gmc-sync-retry.ts` | Rewire retry state to `gmc_item_sync_state`; add `product_type` filter (§6.5 #3) |
| `lib/google/__tests__/gmc.test.ts` | Rewrite for Merchant API read module (keep the throw-first assertions) |
| `services/__tests__/GMCProductSync.identifier.test.ts` | Keep — retarget to mapping layer |
| `generated/route-map.json`, `openapi.json` | Regenerate after route changes — never hand-edit |
| `apps/web` service layer (`platformHomeService`, `googleIntegrationService`) | **Unchanged** — endpoint paths stay stable, internals swap |
| Docs (`PLATFORM_GBP_GOOGLE_ADS_SPEC.md`, this spec, AGENTS.md) | Update integration claims after Phase 1 lands |

### 12.5 The completion gate

"Migration done" is testable, not vibes. Add a lint test (same pattern as the repo's `mv-shape-lint`/contract suites) asserting **no Content API literals in `apps/api/src`**: `shoppingcontent`, `content/v2.1`, `custombatch`, `products/batch`, `online:en:` — plus zero live references to `GMCProductSync.ts`/`GMCProductSyncSingletonService`'s own fetch calls. Ship-blocking: the gate fails until §12.1–§12.3 are fully rewired or deleted, which prevents partial-migration drift (the exact failure mode this spec exists to fix).
