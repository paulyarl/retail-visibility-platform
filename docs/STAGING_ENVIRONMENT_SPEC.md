# Staging Environment Spec — Fly + Vercel + Supabase

## Intent

A true pre-production environment: prod-shaped code path, isolated data,
disposable infrastructure. **The `staging` branch is the landing spot for all
git commits** — every change deploys to Fly staging + Vercel preview first,
then promotes to prod via merge to `main`. Railway is out of the loop
permanently — not a fallback, not restored "when their builds come back."
This staging exists to canary **migrations, env/secret changes, and
third-party integrations** before they touch prod — not to be a second home
for the app.

Design rule: staging holds **no production secrets**. Every credential in the
staging env is a distinct, lower-blast-radius key (the restricted OpenAI
staging key is the template). If staging's secret store is ever compromised,
nothing in it unlocks production.

## Topology

```
git: staging branch (ALL commits land here)
        │
        ├──▶ Vercel Preview (persistent: www.visibleshelf.store)
        │      env: API_BASE_URL → aps.visibleshelf.store
        │
        └──▶ Fly app: visibleshelf-api-staging (1 machine, ord)
               env: local Supabase project (shared) + stg keys

git: main branch (merge = promotion to production)
        │
        ├──▶ Vercel Production (www.visibleshelf.com)
        └──▶ Fly app: visibleshelf-api (2 machines, ord)
               env: prd Supabase project + prod Redis + prd keys

Railway: decommissioned — no deploy target, no env writes, dormant only
until services are formally retired.
```

## Components

### API — `visibleshelf-api-staging` ✅ live

- Built: `fly.staging.toml` (repo root) — same Dockerfile, separate config
  so `fly deploy --config fly.staging.toml` targets staging without
  touching prod's `fly.toml`.
- Fly created an HA pair on first deploy despite `min_machines_running = 0`
  (first-deploy behavior). Both machines `auto_stop` on idle; destroy one
  (`fly machine destroy <id>`) if strict single-machine spend is wanted.
- `shared-cpu-1x`, 2 GB — right-sized for a canary (prod is 2× shared-cpu 4 GB).
  Bump `[[vm]]` in `fly.staging.toml` if staging OOMs on AI workloads.
- `primary_region = "ord"` (same as prod — keeps Upstash Redis same-region)
- DNS: `aps.visibleshelf.store` is the established staging API hostname
  (was Railway; Cloudflare-managed). Cert issued on the Fly app — repoint
  the Cloudflare record from Railway → `66.241.125.31` (A) /
  `2a09:8280:1::1c5:6355:0` (AAAA) or CNAME `visibleshelf-api-staging.fly.dev`.
  The repoint IS the Railway cutover. Until then the app answers on
  `https://visibleshelf-api-staging.fly.dev`.
- Health: `https://visibleshelf-api-staging.fly.dev/api/health` → 200.
- Secrets: `doppler secrets download --config stg --format env-no-quotes
  --no-file | fly secrets import -a visibleshelf-api-staging`.
- Deploys: auto via GitHub Actions on push to `staging`
  (`.github/workflows/deploy-staging.yml` → `flyctl deploy --config
  fly.staging.toml`), or manually: `pnpm deployapi:stg` /
  `fly deploy --config fly.staging.toml`. Prod deploys likewise on push to
  `main` (`deploy-production.yml` → `flyctl deploy`), or `pnpm deployapi`.
  `pnpm deployapi:promote` remains the manual full-pipeline path
  (stg → pause → merge → prod).
- CI auth: repo secret `FLY_API_TOKEN` (org deploy token; regenerate with
  `fly tokens create deploy`).

### Web — Vercel Preview scope (already exists)

- The `staging` branch already produces preview deployments, and
  `visibleshelf.store` / `www.visibleshelf.store` already alias to the
  staging surface — no new domain work, only Preview-scope env vars.
- **Preview-scoped env vars** diverge from production:
  - `API_BASE_URL` / `NEXT_PUBLIC_API_URL` → `https://aps.visibleshelf.store`
    (code already reads these — `apps/web/src/lib/api-proxy.ts:9-12`; no changes needed)
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → shared local project keys
  - `AUTH0_*` / `NEXTAUTH_URL` → staging callback URLs (see Auth0 below)
- Note: `NEXT_PUBLIC_*` is build-time inlined — preview builds are automatic,
  so this is free; just keep the Preview env scope correct.

### Database — shared with `local` Supabase project

- Staging uses the **local Supabase project** (`nbwsiobosqawrugnqddo`) — the
  `stg` Doppler config mirrors `local` for all DB-backed values since both
  environments share the same database.
- Trade-off accepted: local drifts with dev experiments, so staging can't
  canary migrations against a clean prod-shaped schema — but a third project
  was unjustified maintenance for a solo pipeline. If a dedicated staging
  project is ever needed later, `stg` config is already the seam.
- Migration order: **local/stg → prd** (migrations already land on local
  first; prod-shaped Fly staging then exercises them end-to-end).
- Data policy: disposable dev fixtures only — no production data copies.
- API keys: the local project's `sb_publishable`/`sb_secret` pair (legacy
  JWT keys already disabled, matching prd posture).

### Redis — namespaced on existing Upstash

- Prefer a **key namespace** (`stg:` prefix or separate Upstash DB index) on
  the existing ord instance over a second Redis — staging cache correctness
  doesn't justify another billable datastore.
- If isolation ever matters (flush testing), a second free Upstash DB in ord
  is a 5-minute add. Defer until needed.

### Auth0 — staging application in the existing dev tenant

- The tenant `dev-jaiggvvi3zsttaoo.us.auth0.com` is already a dev tenant,
  and the staging app **already exists**: `visible-shelf-staging`
  (`qa3lsBavdX2uIZ5lSElylPvwF58Dzs8C`). `local`/`stg` `AUTH0_*` already
  point at it — nothing to create. Its allowlisted callbacks already cover
  `visibleshelf.store` / `www.visibleshelf.store` / the `-git-staging-`
  preview host.
- Do NOT rotate prd's Auth0 app config to accommodate staging.

### Secrets — Doppler `stg` config

- New Doppler config `stg` in the existing project. Populated per the table
  below — **staging-scoped values only**:

| Secret | Staging value |
|---|---|
| `DATABASE_URL`/`DIRECT_URL`/`SUPABASE_DB_URL` | **mirrors `local`** (shared Supabase project) |
| `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` | **mirrors `local`** sb_* keys |
| `OPENAI_API_KEY` | restricted staging key (already exists) |
| `STRIPE_*` | **test-mode** keys (`sk_test_*`), not live — ⚠️ seeded `stg` currently holds LIVE keys mirrored from `local`; swap in `sk_test_*` and re-import |
| `AUTH0_*` | staging application credentials |
| `*_ENCRYPTION_KEY` | **mirrors `local`** — correction: stg shares local's DB, so encryption keys must match local's or shared ciphertext is unreadable (prod keys still never allowed) |
| `SENTRY_*`/`MAILTRAP_*`/`UPC_*`/`VERCEL_*` | staging-project tokens or omitted where optional |

- `stg` seeds from `local` — DB/Supabase values copy verbatim; only
  environment-divergent vars (callbacks, `API_BASE_URL`, Auth0 app, Redis
  namespace) differ.
- `fly secrets set` on the staging app from the stg config once: replicate
  prod var names, staging values.

## Promotion path

```
commit ──▶ staging branch ──▶ Fly stg + Vercel preview (auto/manual deploy)
        ──▶ verify on www.visibleshelf.store
        ──▶ merge to main ──▶ prod (Vercel prod + fly deploy -a visibleshelf-api)
```

- **Migrations**: apply to local/stg first → contract suites + smoke check →
  apply to prd. The idempotency requirement already exists and is tested
  this way.
- **Env/secret changes**: rotate on stg first when the change is risky
  (the DB-password reset incident is exactly the class of failure stg
  absorbs).
- **Third-party webhooks**: Stripe/GMC/GBP integrations point at
  `aps.visibleshelf.store` endpoints for test-mode verification.
- **Rollback**: prod rollback stays `fly deploy` of the previous image —
  staging doesn't change that path.
- **Railway retirement**: once the Fly staging app is verified, delete the
  Railway services (they hold rotated-but-still-stored secrets — the env
  store is the disclosed compromise surface; leaving it populated is
  lingering exposure). Cancel/downgrade the Railway plan after services are
  removed.

## Cost

| Piece | Cost |
|---|---|
| Fly staging machine (1× shared-cpu) | ~$2-4/mo |
| Supabase staging project | $0 (shares local project) |
| Redis namespace | $0 (shared instance) |
| Vercel preview alias | $0 |
| Auth0 dev-tenant app | $0 |

## Explicit non-goals

- **Not a data mirror** — no prod DB restores into staging; fixture-seeded only.
- **Not HA** — 1 machine; if it dies, redeploy.
- **Not a second production** — no client work, no real tenant accounts,
  no real claim tokens.
- **Not a build-time gate** — merging to main does not require staging
  verification ceremony; it's a tool, not a toll.

## First-run checklist

1. ✅ `fly apps create visibleshelf-api-staging` + `fly.staging.toml` —
   deployed and healthy
2. ✅ Doppler `stg` seeded from `local` (backup at `tmp/stg-backup.env`),
   overrides re-applied → imported via `fly secrets import`. Remaining
   override work: `STRIPE_*` → test-mode; `AUTH0_*` → staging app creds
3. ✅ Staging DB = local project — already migrated; nothing to apply
4. ✅ Cert created for `aps.visibleshelf.store`
5. ✅ DNS repointed (`aps` CNAME → `visibleshelf-api-staging.fly.dev`) —
   `https://aps.visibleshelf.store/api/health` → 200. Railway staging is
   unreachable by name.
6. ⏳ Auth0 staging application + callback URLs
7. ⏳ Vercel: `staging` branch → `www.visibleshelf.store` alias + Preview-scope
   env vars (`NEXT_PUBLIC_API_URL` → staging API, shared-project sb_* keys,
   staging Auth0 app)
8. ⏳ Smoke: staging login → seed claim flow → one catalog read → one audit run
