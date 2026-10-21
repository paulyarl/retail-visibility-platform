# Fly.io API — Production Runbook

The RVP API is hosted on **Fly.io** (`visibleshelf-api`), promoted to primary on 2026-10-21 during the Railway platform outage (builds/deploys/dashboard unavailable for hours). Railway is retained as an optional standby / decommission candidate.

**Production URL:** `https://api.visibleshelf.com`
**Direct URL:** `https://visibleshelf-api.fly.dev`
**Health check:** `/api/health`

## Architecture

| Component | Host | Notes |
|---|---|---|
| API | Fly.io `visibleshelf-api` (machines in `ord` + `dfw`) | Dockerfile deploy |
| Database | Supabase PostgreSQL | Unchanged, shared |
| Cache | Upstash Redis `dawn-paper-8155` (`ord`, replica `dfw`) | Created via `fly redis` |
| Frontend | Vercel → `api.visibleshelf.com` | No change — stable hostname |
| DNS | **Vercel DNS** | (Cloudflare zone is inert — not delegated) |
| Standby | Railway `t6xnv37o.up.railway.app` | Optional; flip CNAME back to fail over to it |

## Deploy

Fly does **not** auto-deploy from git — builds come from the local working tree:

```powershell
git checkout main && git pull origin main
fly deploy -a visibleshelf-api
curl https://api.visibleshelf.com/api/health   # confirm "status": "ok"
```

Deploy only from an up-to-date `main` checkout.

## Failover to Railway (if Fly is down)

1. Confirm Railway service is actually healthy first
2. Vercel dashboard → `visibleshelf.com` → DNS → edit `api` CNAME → `t6xnv37o.up.railway.app`
3. `curl https://api.visibleshelf.com/api/health` → `status: ok`
4. Failback: CNAME → `gdomwon.visibleshelf-api.fly.dev`

## DNS records (Vercel DNS)

| Record | Type | Value | Purpose |
|---|---|---|---|
| `api` | CNAME | `gdomwon.visibleshelf-api.fly.dev` | Live traffic → Fly |
| `_acme-challenge.api` | CNAME | `api.visibleshelf.com.gdomwon.flydns.net` | Fly cert issuance/renewal — keep permanently |
| `_fly-ownership.api` | TXT | `app-gdomwon` | Domain ownership verification |

## Secrets

Configured via `fly secrets set -a visibleshelf-api` (~111 vars ported from Doppler/Railway). Source of truth for most values: Doppler `retail-visibility-platform` `local`/`prd` configs + provider dashboards.

Known state as of 2026-10-21:

- `TOKEN_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY` — real values ported from Doppler `local` config (match dev/prod encryption)
- `GOOGLE_API_KEY` — set (Gemini client reads this name, not `GOOGLE_AI_API_KEY`)
- `PAYMENT_CREDENTIAL_ENCRYPTION_KEY` — generated new (was never configured)
- `CLOVER_*`, `PAYPAL_*`, `SQUARE_*` — **sandbox creds only exist in Doppler `local`; production needs live credentials from provider dashboards** (PayPal developer console / Square developer / Clover). Redirect URIs must be registered as `https://api.visibleshelf.com/...`
- Sentry DSN, New Relic — unset; no error tracking/APM on Fly yet

## Troubleshooting

- `fly logs -a visibleshelf-api` — startup crashes appear here
- `fly status -a visibleshelf-api` — machine states; crash-loop protection may stop a machine (`fly machine start <id>`)
- `fly secrets list -a visibleshelf-api` — names/digests only; a secret can be "deployed" but empty or wrong — verify at runtime
- Crash-loops: check for `*_ENCRYPTION_KEY` errors first (keys must be exactly 64 hex chars)

## Notes

- Scheduled jobs run on this deployment (no global jobs kill-switch exists) — fine while it's the sole primary; revisit if a second API host is ever run concurrently
- Known app-level issue: GMC product sync rejects a `size` field in some product payloads (non-fatal)
- `fly.toml` at repo root: app `visibleshelf-api`, region `ord`, port 8080, health `/api/health`
