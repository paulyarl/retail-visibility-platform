# Market Push Operator Guide

Repeatable runbook for launching a directory market: **dress on staging, push to production.** Created 2026-10-30 after the four-market revert that left Indianapolis-only.

## Why this flow exists

A market push costs **~0.7–2 GB of Supabase egress** — almost all of it pipeline *reads* (prospect scan snapshots, enrichment, audit JSONB), not publish writes. That number is now a **cost model, not a quota risk**: since 2026-11-06 the **prd org is on Pro** (250 GB unified egress/cycle, then $0.09/GB — the Oct breach happened under Free's 5 GB and can't recur at push volumes). The **stg org is still on Free** (5 GB/cycle), so stg-side scan/dress days remain the only quota-bound work in this flow.

Staging and production are **separate Supabase orgs, accounts, and quotas**. So staging does the expensive work — scans, audits, cleanups, briefings, triage — and production receives only the finished payload. Prd's per-market cost drops to the publish slice (KBs per seed). Production stays a storefront; staging is the workshop. Post-Pro this is no longer lockout-avoidance — it's still the right shape: heavy reads stay off the storefront, and every GB that runs on stg is a GB that never counts against prd's meter (or invoice).

```
stg:  scan → audits → cleanups → briefings → triage → export-market-campaign
prd:  import-market-campaign → promote (proving-ground cockpit) → publishBatch
```

## Prerequisites

- Repo checkout with `apps/api/scripts/{export,import,revert}-market-*.cjs` (all plain Node + `pg`, no build)
- Doppler access: `--config stg` (workshop) and `--config prd` (storefront). `--config local` points at the same DB as `stg`.
- Platform-admin login on the prd web app (proving-ground cockpit + promote/publish panels)
- Supabase org usage page open: `dashboard → org → usage` (egress, current cycle) — the **stg** org's page is the one that still matters; prd is on Pro

## Phase 0 — Budget check (30 seconds)

1. **stg org** usage page → uncached egress **Used in period**. Headroom = `5 GB − used`. Stg-side scan/dress is the burst: budget ~1–2 GB per market dressed against what baseline leaves (~3 GB).
2. **prd org** (Pro, 250 GB): a push via this flow costs well under ~100 MB publish-side — effectively free, no check needed under normal operation.
3. Still useful: schedule big stg-side scan/dress days early in stg's billing cycle so the burst has the whole cycle's quota ahead of it (check the stg org's own cycle dates — not necessarily the same as prd's).

## Phase 1 — Dress the market on staging

Run the normal pipeline **entirely on stg**:

- PG/discovery scan for the market (category × city)
- Audits, enrichment, cleanups, briefings
- Triage — promote/dismiss decisions; fix `category_fit`, `identity_confidence`, `verification`
- Optional: a small sample publish to eyeball pages before committing. **Caveat: stg is not indexed in Search Console** — a stg sample validates page rendering and data only, not indexing. To check indexing, publish the sample on **prd** instead (trivial cost under Pro) and use Search Console URL Inspection on the live `/place/<slug>`. Deliberately indexing stg is a separate decision — verify the property + confirm it isn't noindexed — and is generally undesirable: it puts staging URLs in the SERP competing with prd.

Nothing here touches prd. The deliverable is a triaged set of `mkt_prospect_queue` rows for the market, plus the city-scope campaign row (`scope='city'`, e.g. `"African Grocery Store" @ Fort Wayne`).

## Phase 2 — Export (staging)

```bash
cd apps/api
doppler run --config stg -- node scripts/export-market-campaign.cjs \
  --campaign mcamp-XXXX --state IN
```

Options:

| Flag | Purpose |
|---|---|
| `--campaign mcamp-xxx` | Market campaign; supplies city + category |
| `--market "City,ST"` | Export by geography without a campaign row |
| `--state XX` | Required when the city name exists in multiple states (script aborts and lists them) |
| `--category "…"` | Override the campaign's category filter |
| `--status queued,verify_then_outreach` | Only export these triage statuses |
| `--ids pque-1,pque-2` | Explicit queue-id list (bypasses market matching) |
| `--no-profiles` | Skip the `mkt_intelligence_profiles` leg (default: included — all version rows for the market's category keys, scoped to its geos) |
| `--out path.json` | Custom output file (default `audits/market-export-<campaign>-<ts>.json`, gitignored) |

The export prints row counts and the **payload size in MB** — that number is the scan volume prd will *not* have to re-read.

## Phase 3 — Import (production)

Always dry-run first, read the plan, then apply:

```bash
doppler run --config prd -- node scripts/import-market-campaign.cjs --file ../../audits/market-export-mcamp-XXXX-*.json
# …check the plan…
doppler run --config prd -- node scripts/import-market-campaign.cjs --file <same> --apply
```

What the plan shows:

- `campaigns / audits / queue: N to insert, M already exist` — original ids are kept for lineage; re-imports are idempotent (`ON CONFLICT DO NOTHING`)
- `dup-active (skipped)` — queue rows colliding with an already-`queued` same business+city+category on prd (the `uq_mkt_prospect_queue_active_business` index). These are real dupes; skipping is correct.
- `skipped (dangling campaign_id)` audits — audit whose source campaign doesn't exist on prd and wasn't in the export. Harmless; queue rows still land.
- `scope-conflict (skipped)` profiles — an exported `active` profile whose (category_key, focus, city/state/platform) scope is already claimed by a *different* active profile on prd. The target's profile wins; reconcile by hand only if the stg one should win (retire the prd one first).
- `campaign refs NULLed` — stg-only references (`processed_campaign_id`, etc.) that don't resolve on prd.

Sanitization is automatic: `seed_id`, `seek_batch_id`, `processed_at`, tenant refs, and any campaign FK not present on prd all become `NULL`. Snapshots, triage fields, statuses, and provenance ride through unchanged.

> Note on campaigns: if a same-market `scope='city'` campaign already exists on prd under a different `mcamp-*` id, the import adds the stg one too — they coexist harmlessly. Use whichever campaign the cockpit promotes through; the batch name follows that id.

## Phase 4 — Promote on production

Standard path, same as before:

1. Prd admin → **Proving Ground cockpit** (`/settings/admin/marketing-ops/proving-grounds/<campaignId>`) for the market campaign.
2. Attach/select the imported queue entries for the market (city + state + category — the imported rows carry those fields).
3. Promote → `createSeedsForProvingGround` runs, seeds mint under batch `pg-mcamp-<campaignId>-<yyyymmdd>`.
4. Publish via `publishBatch` / the seeds panel.

Seeds, listings, tenants, claim tokens, provenance — all generated natively on prd. Nothing crosses except the payload you imported.

## Phase 5 — Verify

```bash
# seeds landed, correct batch + statuses
doppler run --config prd -- node scripts/db-rescue.cjs sql \
  "SELECT seed_batch, status, count(*) FROM directory_presence_seeds WHERE created_at >= CURRENT_DATE GROUP BY 1,2"

# imported queue rows are stamped/consumed as expected
doppler run --config prd -- node scripts/db-rescue.cjs sql \
  "SELECT status, count(*) FROM mkt_prospect_queue WHERE city='Fort Wayne' AND state='IN' GROUP BY 1"
```

Then eyeball one live `/place/<slug>` and the directory browse for the new city. Check the announce queue (`/api/admin/directory/presence-seeds/announce-queue`) if invites/announces should fire.

For indexing verification (this is the step a stg sample can't cover): Search Console → **URL Inspection** on a sample live `/place/<slug>` — confirms crawlability, canonical, and index status on the real domain. Relevant for re-pushed markets especially: fresh seeds mint fresh slugs, so verify the new URLs rather than assuming the reverted market's old slugs carried over.

## Rollback

If a push needs to come down:

```bash
doppler run --config prd -- node scripts/revert-market-push.cjs \
  --like 'pg-mcamp-XXXX-%'            # dry-run: shows scope + dependents
doppler run --config prd -- node scripts/revert-market-push.cjs \
  --like 'pg-mcamp-XXXX-%' --apply    # deletes seeds + listings + tenants + tokens
```

It writes a full-row backup to `audits/market-revert-<ts>.json` first, handles every FK/no-FK dependent, and aborts if Indianapolis-market seeds match the scope. Queue rows survive (seed back-ref nulled) — they can be re-pushed.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `city exists in multiple states` | Pass `--state XX` on export |
| Import shows more `already exist` than expected | Re-run of a previous import — idempotent, safe to proceed or stop |
| `invalid input syntax` / FK violation mid-import | Schema drift between envs — run `prisma db pull` diff or re-export after migrations land on both |
| Seeds skip with `duplicate_seed` at promote | Same business+category+city already has a live seed on prd — expected guard, not a bug |
| Claim links 404 after publish | Token minted on stg doesn't cross — tokens are prd-native; re-mint via Generate Claim Invite on prd |
| `tenants kept (FK references remain)` in revert output | Tenant picked up real dependencies — inspect before forcing |

## Run sheet (copy/paste)

```bash
MKT=mcamp-XXXX; ST=XX                                   # market campaign + state
cd apps/api
doppler run --config stg -- node scripts/export-market-campaign.cjs --campaign $MKT --state $ST
F=$(ls -t ../../audits/market-export-$MKT-*.json | head -1)
doppler run --config prd -- node scripts/import-market-campaign.cjs --file "$F"          # dry-run
doppler run --config prd -- node scripts/import-market-campaign.cjs --file "$F" --apply  # commit
# → prd proving-ground cockpit → attach queue entries → promote → publish
```
