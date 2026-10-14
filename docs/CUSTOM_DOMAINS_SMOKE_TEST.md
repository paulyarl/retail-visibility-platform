# Custom Domain Smoke Test — `placeshelf.store`

**Status**: **Executed 2026-10-14 — all 7 assertions passed** (see Findings)
**Domain under test**: `placeshelf.store` (purchased at Namecheap for this purpose)
**Environment**: **Production only** — custom domains are prod-only (sprint plan D1)

## Why a throwaway domain

The original idea was to repoint `visibleshelf.store`, but that domain is hardcoded as a platform root everywhere it matters and can never exercise the custom-domain path:

- `apps/api/src/lib/custom-domain.ts` — `PLATFORM_DOMAIN_SUFFIXES` includes `visibleshelf.store`; `addDomain` refuses it (and every subdomain of it) with `platform_domain`.
- `apps/web/src/lib/storefront-routing.ts` — it's in `PLATFORM_DOMAINS`/`PLATFORM_APEXES`, so `isCandidateCustomHost` rejects the apex, `www.`, and all subdomains; the proxy would never attempt custom-host resolution.
- It's also the **staging apex** (`visibleshelf.store` / `aps.visibleshelf.store`) — repointing it would take staging down.

A purchased throwaway domain exercises the real end-to-end path (Vercel attach → DNS → verify → HTTPS probe → `active` → host-based rewrite) with zero code changes and zero risk to platform domains.

---

## Phase 0 — prerequisites (verify once, prod)

- [ ] **API env**: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` set on the production API. Missing → `VercelUnconfiguredError` → every attach returns 503 `unconfigured`.
- [ ] **Web env**: `NEXT_PUBLIC_FF_CUSTOM_DOMAINS=true` on the production Vercel project. If off, `proxy.ts` skips the custom-host branch entirely and the domain serves the platform app — a misleading "pass".
- [ ] **DB flag**: `custom_domains` platform flag is **off** but `allow_tenant_override=true` — the tenant needs its own `tenant_feature_flags_list` row (enabled via the attach modal's "Enable flag" or `PUT /api/admin/tenant-flags/:tenantId/custom_domains`).
- [ ] **Public resolve endpoints reachable**: `GET /api/tenants/resolve-custom-domain/<host>` and `GET /api/tenants/resolve-subdomain/<slug>` must return a real response (200/404), **not 401**. The proxy calls them unauthenticated — a `router.use(authenticateToken)` anywhere upstream in the tenants router silently kills all tenant-host routing (both subdomains and custom domains). See Findings #2.
- [ ] Domain `placeshelf.store` purchased at Namecheap; **Namecheap BasicDNS** in use; record TTLs set to minimum for fast revert.

---

## Phase 1 — setup (before touching DNS)

### 1.1 Create the temporary tenant

```bash
POST /api/admin/demo-tenants
{ "template": "grocery" }
```

A demo tenant gives a realistic storefront (products, hours) plus a built-in expiry/delete path. Record the returned `tenantId`.

> **Gotcha (observed)**: if the tenant doesn't appear in `/settings/admin/demo-tenants`, check `location_status` — the list only shows `active` tenants. In the 2026-10 run, an existing tenant (`tid-8622qs2t`) was converted to a demo and needed `PATCH /api/tenants/:id/status` → `active` before it surfaced.

### 1.2 Grant the capability + enable the tenant flag

The attach gate requires BOTH the tenant flag (`custom_domains`, since the platform flag is off with `allow_tenant_override`) and the `storefront_domains_custom_domain` capability. The admin UI's **Attach Domain modal** at `/settings/admin/subdomain` does both from the tenant's entitlement card — "Grant via BSaaS" (prefilled `ComplimentaryAccessForm`, submits to `POST /api/admin/feature-purchases/grant-complimentary`) and "Enable flag" (`PUT /api/admin/tenant-flags/:tenantId/custom_domains`). Equivalent API calls:

```bash
POST /api/admin/feature-purchases/grant-complimentary
{ "tenant_id": "<TENANT_ID>", "feature_key": "storefront_domains_custom_domain", "reason": "smoke test" }

PUT /api/admin/tenant-flags/<TENANT_ID>/custom_domains
{ "enabled": true, "rollout": "tenant" }
```

(`storefront_domains_flexible` also satisfies the capability gate.)

### 1.3 Attach the domain

```bash
POST /api/admin/custom-domains/<TENANT_ID>
{ "domain": "placeshelf.store", "apex": true }
```

Expected: `201`, `attachedHosts: ["placeshelf.store", "www.placeshelf.store"]` — one logical domain, apex declared (D9), so both project domains are attached and the row starts at `pending_verification`.

### 1.4 Confirm gate state (optional sanity)

```bash
GET /api/admin/custom-domains/<TENANT_ID>
```

Expect `entitlement: { "entitled": true, "flagOn": true }` and the domain row in `pending_verification`.

---

## Phase 2 — DNS at Namecheap

Add records under BasicDNS (confirm values against `GET /v6/domains/placeshelf.store/config`'s `recommendedIPv4`/`recommendedCNAME` — standard values below):

| Type | Host | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` (Vercel anycast) |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `TXT` | per Vercel challenge | **only if** a `check` surfaces a `verification` challenge — unlikely for a fresh domain |

### 2.1 Activate

```bash
POST /api/admin/custom-domains/<TENANT_ID>/<DOMAIN_ID>/check
```

Runs the full lifecycle: `verify` → `verified && !misconfigured` → our HTTPS probe → `active`, with `certificate_status: "issued"`. Alternatively wait ≤15 min — `custom-domain-sweeper` runs the identical path every 15 minutes.

> **Gotcha**: the proxy caches host resolutions for 60s per isolate (including negative results). If you visited `placeshelf.store` while it was `pending_verification`, allow ~a minute after activation before re-testing.

> **Probe semantics (post-fix)**: `probeHttps` treats **any completed HTTPS exchange** as cert-ready — undici validates the chain + hostname and throws on failure, so even a fail-closed 404 response proves TLS works. Before this fix, `verified → active` was a deadlock: the probe required 2xx/3xx but the proxy intentionally 404s non-`active` hosts. A `verified` row with `certificate_error: 'HTTPS 404'` (or any 4xx) on a domain whose cert is issued means the TLS handshake is fine — on the current build the sweeper self-heals it to `active`; on older builds a manual flip is needed (see Troubleshooting).

---

## Phase 3 — smoke assertions

| # | Check | Expected |
|---|---|---|
| 1 | `curl -I https://placeshelf.store/` | `200`, valid TLS cert, `Set-Cookie: tcx={"tenant_id":"<TENANT_ID>",...}` |
| 2 | `curl https://placeshelf.store/` HTML | The demo tenant's storefront (rewrite to `/tenant/<TENANT_ID>`) — not the platform app |
| 3 | `curl -I https://www.placeshelf.store/` | **301** → `https://placeshelf.store/` |
| 4 | `curl -I https://placeshelf.store/manage` | **302** → `https://visibleshelf.com/t/<TENANT_ID>` (absolute platform origin — never the request host) |
| 5 | `curl -I https://placeshelf.store/admin` | 404 — non-storefront paths fail closed on a tenant host |
| 6 | `GET /api/admin/custom-domains/<TENANT_ID>` | `status: "active"`, `certificateStatus: "issued"` |
| 7 | `curl -I https://random.placeshelf.store/` | Vercel edge 404 — host never attached, never reaches the proxy |

Pass criteria: all 7.

---

## Phase 4 — revert / cleanup

```bash
# 1. Detach both Vercel hosts + delete the custom_domains row
DELETE /api/admin/custom-domains/<TENANT_ID>/<DOMAIN_ID>

# 2. Delete the demo tenant (remaining rows cascade; detach already done)
DELETE /api/admin/demo-tenants/<TENANT_ID>

# 3. Remove the A/CNAME records at Namecheap
# 4. Park or let placeshelf.store lapse
```

Cleanup leaves no residue: Vercel project domains detached, `custom_domains` row gone (audit rows in `audit_log` remain intentionally), demo tenant deleted, DNS reverted.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `503 unconfigured` on attach | `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` missing on prod API |
| `403 not_entitled` on attach | Capability override not granted, or `custom_domains` platform flag off — check `GET /api/admin/custom-domains/:tenantId` `entitlement` |
| `400 platform_domain` on attach | Wrong domain — `*visibleshelf.com`/`*visibleshelf.store` are refused by design |
| Domain serves the **platform app**, not the storefront | `NEXT_PUBLIC_FF_CUSTOM_DOMAINS` not `true` on prod web — the custom-host branch never ran |
| Domain serves the platform **404** after activation | (a) 60s per-isolate negative-resolve cache — wait a minute; (b) resolve endpoints 401ing — probe `GET /api/tenants/resolve-custom-domain/<host>` directly; a `router.use(authenticateToken)` regression in `tenant-users.ts` caused exactly this in prod (Findings #2) |
| Stuck at `verified`, never `active` | `certificate_error: 'HTTPS 404'` on an issued cert = the old probe deadlock (Findings #1) — fixed; sweeper self-heals. Other probe errors = cert still issuing or DNS not propagated; re-`check` |
| Storefront header shows a **stale business name** after a profile edit | Not a domain problem — the header reads `tenant_business_profiles_list.business_name` (`apps/web/src/app/tenant/[id]/page.tsx`) and the page is ISR-cached; wait for revalidation or hard-refresh. The product MVs don't carry the business name at all |
| `verify` returns a TXT challenge | Domain needs an ownership TXT (rare for fresh domains) — value is stored in `verification_token`; add it at Namecheap and re-`check` |

---

## Findings — 2026-10-14 run

**Result: 7/7 assertions passed.** Apex 200 with `tcx` tenant cookie, `www`→apex 301, `/manage`→platform-origin 302, `/admin` fail-closed 404, unattached-subdomain edge rejection, storefront render correct, domain row `active`/`issued`.

The run caught two real production bugs — exactly what the throwaway-domain exercise was for:

1. **`verified → active` lifecycle deadlock** (`CustomDomainService.probeHttps`): the probe required a 2xx/3xx response before flipping `active`, but the proxy fail-closes non-`active` hosts to `/_not-found` (404) by design — so `active` was unreachable through the only path that could grant it. Fixed: any completed HTTPS exchange counts as cert-ready.
2. **Auth wall killing all tenant-host routing** (`tenant-users.ts`): `router.use(authenticateToken)` on a router mounted at `/` in the tenants orchestrator 401'd every unauthenticated `/api/tenants/*` request — including `resolve-subdomain`, `resolve-custom-domain`, and `storefront-canonical`. **All subdomain storefronts were 404ing in production**, not just custom domains. Fixed: per-route `authenticateToken` (the same `AUTH_SCOPE_ISOLATION_SPEC.md` NFR-3 violation class as a prior incident).

Two follow-on discoveries during the run also got fixed: a cross-tenant profile-write authorization gap (`POST/GET /api/tenant/profile`, `PUT /api/tenant/gbp-category` had no `checkTenantAccess`), and a storefront slug picker sourcing suggestions from `profile.business_name` instead of the page-scope tenant record.

Data note: `placeshelf.store` was attached to demo tenant `tid-8622qs2t` ("Ivoire African Market"), whose `tenant_business_profiles_list` row happened to contain stale "ATOBABS AFRICA INTERNATIONAL MARKET" data — a useful illustration that profile and tenant records can diverge, not a routing bug.

---

## References

- Spec: `docs/CUSTOM_DOMAINS_FOR_STOREFRONTS.md` · decisions: `docs/CUSTOM_DOMAINS_SPRINT_PLAN.md`
- Lifecycle: `apps/api/src/services/CustomDomainService.ts` (`addDomain` → `pending_verification` → `checkDomain` → `verified` → `active`)
- Vercel client: `apps/api/src/services/VercelDomainsService.ts`
- Host routing: `apps/web/src/proxy.ts` (custom-host branch), `apps/web/src/lib/storefront-routing.ts`
- Routes: `POST/GET/DELETE /api/admin/custom-domains/...` (`apps/api/src/routes/admin-custom-domains.ts`), tenant DIY equivalents in `apps/api/src/routes/tenants.ts`
- Sweeper: `apps/api/src/jobs/custom-domain-sweeper.ts` (15 min cadence)
