# Fly.io API Failover Runbook

Hot-standby deployment of the RVP API on Fly.io, for use when Railway (primary host) is unavailable.

**Standby URL:** `https://visibleshelf-api.fly.dev`
**Health check:** `https://visibleshelf-api.fly.dev/api/health`
**Primary:** Railway (`t6xnv37o.up.railway.app`)

## Architecture

| Component | Primary | Standby |
|---|---|---|
| API host | Railway | Fly.io (`visibleshelf-api`, region `ord`) |
| Database | Supabase PostgreSQL | Same (shared) |
| Cache | Railway Redis | Upstash Redis `dawn-paper-8155` (`ord`, replica `dfw`) |
| Frontend | Vercel → `api.visibleshelf.com` | Same (no change needed) |
| DNS | **Vercel DNS** (not Cloudflare — the CF zone is inert) | Same |

## Cutover (failover to Fly)

1. Vercel dashboard → `visibleshelf.com` → DNS records
2. Edit the `api` CNAME: `t6xnv37o.up.railway.app` → `gdomwon.visibleshelf-api.fly.dev`
3. Verify: `curl https://api.visibleshelf.com/api/health` → `"status": "ok"` (propagation takes minutes)
4. Confirm Fly machine is running: `fly status -a visibleshelf-api`

## Failback

Reverse the CNAME to `t6xnv37o.up.railway.app` once Railway is healthy.

## Refreshing the standby

Fly does **not** auto-deploy from git. To update the standby image:

```powershell
git checkout main && git pull origin main
fly deploy -a visibleshelf-api
curl https://visibleshelf-api.fly.dev/api/health   # confirm status: ok
```

Note: `fly deploy` builds from the **local working tree** (respecting `.dockerignore`), not from git — deploy from an up-to-date `main` checkout.

## DNS records in place (Vercel DNS)

| Record | Type | Value | Purpose |
|---|---|---|---|
| `api` | CNAME | `t6xnv37o.up.railway.app` | Live traffic → Railway |
| `_acme-challenge.api` | CNAME | `api.visibleshelf.com.gdomwon.flydns.net` | Fly cert issuance (keep permanently for renewal) |
| `_fly-ownership.api` | TXT | `app-gdomwon` | Fly domain ownership verification |

TLS cert for `api.visibleshelf.com` is issued and active on Fly (Let's Encrypt, auto-renews).

## Known gaps on the standby

- **Encryption keys differ from Railway** — `TOKEN_ENCRYPTION_KEY` and `MFA_ENCRYPTION_KEY` were newly generated (Railway's real values were unavailable). Existing encrypted OAuth tokens / MFA secrets in the DB **will not decrypt** on the standby — affected flows need re-auth/re-enrollment. Fix by porting the real Railway values when reachable.
- **Payment OAuth secrets missing/misnamed** — code expects `PAYPAL_CLIENT_ID/SECRET`, `SQUARE_APPLICATION_ID/SECRET`, `CLOVER_CLIENT_ID/SECRET` + redirect URIs; `CLOVER_APP_ID`/`CLOVER_APP_SECRET` were ported under wrong names.
- **`PAYMENT_CREDENTIAL_ENCRYPTION_KEY`** — unset; payment credential encryption disabled.
- **Gemini** — `GOOGLE_AI_API_KEY` is set but the Gemini client expects a different var; AI features degraded.
- **Sentry / New Relic** — unset; no error tracking or APM on standby.
- **Scheduled jobs run on the standby** against production — fine during a full Railway outage; risk of dual execution if Railway is partially up. No global jobs kill-switch exists yet.
- **GMC product sync** — a known payload issue rejects `size` fields (app bug, not deployment-related).

## Troubleshooting

- `fly logs -a visibleshelf-api` — startup crashes show here
- `fly status -a visibleshelf-api` — machine state; crash-loop protection may stop the machine (`fly machine start <id>`)
- `fly secrets list -a visibleshelf-api` — names only; verify values at runtime (a secret can be "deployed" but wrong)
- If the API crash-loops, check logs for `*_ENCRYPTION_KEY` errors first — keys must be exactly 64 hex chars

## fly.toml

Config lives at repo root (`fly.toml`): app `visibleshelf-api`, region `ord`, port 8080, health check `/api/health`, built from `apps/api/Dockerfile`.
