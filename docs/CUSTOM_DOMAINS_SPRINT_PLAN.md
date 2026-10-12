# Custom Domains — Sprint Plan (Draft for Team Review)

> Companion to `docs/CUSTOM_DOMAINS_FOR_STOREFRONTS.md` (the product/technical spec — data model, lifecycle, DNS strategy, and §14 scaffolding are settled there). This plan sequences its implementation onto the platform subdomain machinery that is now live (§15): the wildcard `*.visibleshelf.com` rewrite in `apps/web/src/proxy.ts` is the exact pattern a custom domain reuses — one more host→tenant resolution source, same rewrite-to-storefront mechanics.
>
> **DRAFT** — the Decisions table is proposed-settled pending team sign-off; the open questions map to spec §11.

---

## What the prospect asked

"Can our storefront live on our own domain?" — e.g. `shop.mylocalstore.com` serving the tenant's VisibleShelf storefront with their URL in the address bar.

Today the platform answers "branded URL" with `tenant.visibleshelf.com` (live). This sprint adds tenant-owned domains as a distinct, opt-in feature — spec §1's case: retailers expect presence on *their* domain, and it's a natural Pro/Org-tier differentiator.

## Decisions — proposed

| # | Decision | Proposed outcome | Spec anchor |
|---|---|---|---|
| D1 | Environments | **Production-only for v1.** Staging (`.visibleshelf.store`) has no wildcard and its own domain posture; custom domains add a per-env mapping problem we don't need yet. | §5.1 note |
| D2 | Apex domains | **Accept both apex + subdomain** at the data model and Vercel level (Vercel handles apex natively), but tenant-facing *instructions* lead with subdomains (`shop.…`, simple CNAME). Apex gets its own instructions + registrar caveats. | §6.4 |
| D3 | Canonical policy | **Custom domain becomes canonical** for that tenant's storefront once `active`. `/tenant/{id}` and `{subdomain}.visibleshelf.com` remain live fallbacks (no redirect for v1 — canonical link tags only; redirect policy is a follow-up). | §11.2 |
| D4 | Tier gating | **`professional` + `organization` tier_keys, 1 domain per tenant for v1** (DB key names per H5 — not the spec's Starter/Pro/Enterprise wording). The cap counts **one logical domain — apex-or-subdomain plus its `www`** (D9), and narrows §13.1's multi-domain expectation at the top tier (recorded, deliberate). Enforced in code **and** by a partial unique index (M7); the index is a deliberate v1 lock — the `is_primary` schema flag alone does **not** make multi-domain migration-free (B6). | §8.1 |
| D5 | Host resolution mechanism | **API fetch from the proxy** — a `GET /api/tenants/resolve-custom-domain/:host` endpoint mirroring `resolve-subdomain`, not Supabase-from-edge. Matches the existing proxy architecture (the edge never holds a Supabase key today). Spec §5.3's Option-A view and §14.4's middleware scaffold are **superseded** — the API endpoint is the only resolution path (M1). | §5.3 |
| D6 | Public-surface URL preference | **v1: no.** Directory listings, seed pages, QR kits, and outreach merge-vars keep emitting platform URLs. Preferring the custom domain across public surfaces is a deliberate follow-up (it changes SEO consolidation + every emitter). | §11.5 |
| D7 | Cost ownership | **Already settled** (project-phase sprint D9 / spec §16.9 analogue): the prospect owns domain registration + DNS; the platform absorbs implementation and instructs. | — |
| D8 | Wildcard interaction | **None.** Tenant domains are external — they never live under `visibleshelf.com`, so the wildcard-override carve-out (spec §15) can't collide. One guardrail: refuse `*.visibleshelf.com` / platform-domain values at write time. | §15 |
| D9 | Domain-count accounting | **apex + `www` count as one logical domain.** A tenant on `mybrand.com` also gets `www.mybrand.com` without burning a second slot — both project domains attach, `www` redirects to the canonical host. Resolves the D2/D4 collision where an apex tenant would otherwise need 2 of 1 slots (B7). | §6.4 |
| D10 | Feature gating | **Reuse the platform flag system, not a bespoke allowlist store.** Flag `custom_domains` in `platform_feature_flags_list` with `allow_tenant_override=true`; the beta cohort is `tenant_feature_flags_list` rows (H7). The proxy reads `NEXT_PUBLIC_FF_CUSTOM_DOMAINS` — the env name follows the `FF_*` convention, not `CUSTOM_DOMAINS_ENABLED`, because the proxy can't see a non-public var. | §13.2 |
| D11 | Tenant-deletion FK | **Keep `ON DELETE CASCADE`; detach from Vercel in an explicit pre-delete step in each hard-delete path.** Removing the cascade while retaining a `disabled` row leaves the FK in place and blocks `tenants.delete` (B5). | §8.3 |

---

## Phase 0 — Pre-flight

| # | Task | Files | Notes |
|---|---|---|---|
| 0.1 | Settle D1–D11 in team review (D7 already settled); confirm D8's refusal list. | — | The spec's open questions (§11) map 1:1 to the D-table — don't code around unsettled ones. D9–D11 (apex+www accounting, flag mechanism, tenant-deletion FK) are second-pass additions. |
| 0.2 | Verify Vercel API access: a token with project-domain write scope, the project id for `retail-visibility-platform-web`, and the team id if project is team-scoped. Add `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` to doppler (dev + prd). | `apps/api/src/config/unifiedConfig.ts` | Same token class the wildcard work needed; confirm it's not expired and scoped to the right team. |
| 0.3 | Confirm domain-count headroom on the Vercel plan and the Domains API rate limits — per-tenant domains each consume a project domain slot. | — | Vercel documents per-project domain limits; a popular tier feature hits them eventually. Record the number **and reconcile it against spec §3.2's "hundreds to low thousands" target** — one project will hit the per-project ceiling and need multiple projects or a plan change (M12). |
| 0.4 | Inventory every emitter of tenant public URLs (`{subdomain}.visibleshelf.com`, `/tenant/{id}`, `/shops/{slug}`) **plus absolute platform links generated inside the storefront itself** (M3 — otherwise visitors on a custom domain hop back to `visibleshelf.com`), so D6's follow-up is a known list, not a discovery task. | `project-phase-resolution.ts`, QR kit service, `outreach-link-vars.ts`, directory services, storefront components | Output: a checklist in this doc or the spec. Mirrors the Phase-0 claim-CTA inventory pattern from the project-phase sprint. |
| 0.5 | **B1 hotfix (separate change, ships before the sprint):** the existing subdomain branch allowlists storefront paths and 404s the rest — `{tenant}.visibleshelf.com/admin` currently bypasses the auth gate. Also ships B2's fail-closed resolve on the subdomain branch. | `apps/web/src/proxy.ts` | Landed: path allowlist + definitive-answer 404; fetch exceptions still fall through for API-outage resilience. The Phase-4 custom-host branch reuses the same allowlist/fail-closed shape. |
| 0.6 | Auth0 dashboard check (H6): `apps/web/src/lib/auth0.ts` infers `APP_BASE_URL` from the request host — storefront login on a custom domain needs that host in Auth0's allowed callback/logout URLs (dashboard config, not repo-verifiable). Confirm, or mark storefront login out of scope for v1. | — | Product call: if storefront login ships later, the allowlist is per-domain Auth0 config. |

## Phase 1 — Data model & resolution core

| # | Task | Files | Notes |
|---|---|---|---|
| 1.1 | Migration `326_custom_domains.sql`: table per spec §5.1 **with `ON DELETE CASCADE` retained** (D11/B5 — the tenant-delete path detaches from Vercel in a pre-delete step so a delete can't orphan a live project domain; see 1.6). Columns: `id`, `tenant_id`, `domain` unique normalized-lowercase, `status` enum (`pending_verification`/`verified`/`active`/`disabled`/`error` — `cert_provisioning` is **not** an API-observable state per H4), `vercel_domain_id`, `verification_checked_at`, `verification_error`, `certificate_status` (**probe-derived only** per H4 — Vercel exposes no cert field), `certificate_error`, `is_primary`, timestamps. Index on `domain`; **partial unique index on `tenant_id` where `status <> 'disabled'`** (M7 — the 1-domain cap is not code-only). | `database/migrations/326_*.sql` | Refuse platform-domain values (`*visibleshelf.com`, `*.visibleshelf.store`, `localhost`) at the service layer, not the CHECK — the list is code-owned. `schema.prisma` updates via `prisma db pull` + `prisma:generate` after applying (M6 — never hand-edit). **Keep `ON DELETE CASCADE`** (D11/B5) — the Vercel detach happens in a pre-delete step *before* the row disappears; dropping the cascade instead leaves a `disabled` row still holding the FK and blocks `tenants.delete`. Enable RLS + a service-role/no-anon policy on the base table even without the view (M10). |
| 1.2 | ~~`public_custom_domains` view + RLS~~ — **dropped** (M1). The spec's Option-A surface has no consumer under D5; the API endpoint is the only resolution path. Reintroduce only if a concrete consumer is named. | — | Spec §14.1.2/§14.1.3 + §14.4 superseded (doc corrections). |
| 1.3 | `CustomDomainService`: `addDomain` (normalize → platform-domain refusal → insert `pending_verification` + Vercel add call → store `vercel_domain_id` + verification instructions), `getDomainStatus`, `listForTenant`, `removeDomain` (detach from Vercel + delete row per spec §6.2), `resolveHostToTenant` (active-only lookup). | `apps/api/src/services/CustomDomainService.ts` (new) | §14.3 scaffolding is the starting point — adapt to repo conventions (prisma import, logger, error contract). |
| 1.4 | `GET /api/tenants/resolve-custom-domain/:host` — public, rate-limited (`subdomainResolve`-class limiter), returns `{ success, tenantId }` for `status='active'` domains only. **Decide the resolution cache here** (B3): location (edge-side in the proxy vs. API response cache) and TTL, including negative results — shared-IP 429s currently 404 a live storefront (post-B1; see H11). | `apps/api/src/routes/tenants.ts` | Identical contract to `resolve-subdomain/:subdomain` so the proxy treats both the same. |
| 1.5 | Unit tests: normalization, platform-domain refusal, status transitions, resolve-active-only, remove-detach ordering (Vercel call before row delete). | `apps/api/src/lib/__tests__/custom-domain*.test.ts` (helper, next to `subdomain.test.ts`); `services/__tests__/` (service) | M5's placement rule. Mock prisma + the Vercel service (Phase 2's interface lands first as a seam). |
| 1.6 | Tenant-deletion and tier-downgrade lifecycle (H2/B5): an explicit **pre-delete step in each hard-delete path** (`admin-tools.ts` test-tenant delete, `directory-presence-admin.ts` seed delete — Prisma has no delete hook) detaches the tenant's domains from Vercel before the cascade removes the row. Tier downgrade hooks the **existing** `subscription-grace-period` job (`processGracePeriodExpiry` → `downgradeToExpired`), not a new job (H8). | `CustomDomainService.ts` + the two delete routes + `apps/api/src/jobs/subscription-grace-period.ts` | Without this, deleting a tenant leaves live Vercel project domains routing to a gone tenant. A `disabled` row alone still FK-blocks the delete (B5). |

## Phase 2 — Vercel Domains API integration

| # | Task | Files | Notes |
|---|---|---|---|
| 2.1 | `VercelDomainsService`: `addProjectDomain(domain)` (`POST /v10/projects/{idOrName}/domains`), `getProjectDomain(domain)` (`GET /v9/projects/{idOrName}/domains/{domain}` — the project-domain object: `verified` bool + `verification` TXT list — **no cert field**, H4), `verifyProjectDomain(domain)` (`POST /v9/projects/{idOrName}/domains/{domain}/verify` — the "Check status" path needs it, H4), `removeProjectDomain(domain)` (`DELETE /v9/projects/{idOrName}/domains/{domain}`), `getDomainConfig(domain)` (`GET /v6/domains/{domain}/config`: `misconfigured`, `recommendedCNAME`/`recommendedIPv4`, `acceptedChallenges` — for tenant instructions, but see H10). | `apps/api/src/services/VercelDomainsService.ts` (new) | §14.2 scaffolding is the starting point. Do **not** rely on the spec's `GET /v10/domains/{name}` — not in the checked REST reference (H4). Pin the versions: add is **v10**, get/verify/remove are **v9** (H9). A duplicate add returns **400** (not 409) — treat as "already attached, reuse" (H9). Idempotent per §6.2. |
| 2.2 | `unifiedConfig` getters for the Vercel env vars; the service fails closed (throws a typed `vercel_unconfigured`) when absent so the tenant route can 503 cleanly. | `apps/api/src/config/unifiedConfig.ts` | Config-missing must not crash tenant settings reads — only the custom-domain actions. |
| 2.3 | Wire `CustomDomainService` to the Vercel service: add → `addProjectDomain`; check → `verifyProjectDomain` + `getProjectDomain`/`getDomainConfig` → advance `pending_verification → verified` on `verified && !misconfigured`, then **our own HTTPS probe** of the host confirms TLS before flipping `verified → active` and setting `certificate_status` (H4 — the cert state is observable only by probing, not via the API). Error paths record `verification_error`/`certificate_error` without state regression. **Plus the sweeper** (B4): a `scheduled_jobs` registration re-checks non-`active`/`disabled` rows on a cadence — pull-only otherwise strands verified-but-never-rechecked domains forever. | `CustomDomainService.ts` + `apps/api/src/jobs/custom-domain-sweeper.ts` (new module) + `apps/api/src/index.ts` wiring | Jobs are individual modules exporting `startXJob()`, imported/invoked in `index.ts` — **not** entries in `registry.ts` (H8). `scheduleJob(...)` inside the module persists to `scheduled_jobs` with the operator kill switch; a registration, not new infra. |
| 2.4 | Tests: lifecycle transitions against stubbed Vercel responses (pending → verified on `verified && !misconfigured`; verify-action failure; probe-success → active; probe-failure stays `verified` with `certificate_status` unset; Vercel 4xx/5xx → `error` with message preserved). | `__tests__/custom-domain*.test.ts` | Vercel responses fixture-driven; probe stubbed. |

## Phase 3 — Tenant API + settings UI

| # | Task | Files | Notes |
|---|---|---|---|
| 3.1 | Tenant routes: `GET/POST/DELETE /api/tenants/:id/custom-domains`, `POST /api/tenants/:id/custom-domains/:domainId/check` — `authenticateToken` + `checkTenantAccess` + **`requireTenantAdmin`** (`middleware/permissions.ts`, OWNER/ADMIN — `checkTenantAccess` alone passes any member, H3; open product question: widen to `requireTenantRole` incl. MANAGER per spec §8.2), tier gate per D4, rate limits (`subdomainCreate`-class on POST). | `apps/api/src/routes/tenants.ts` | Mirror the `/subdomain` route conventions including the HTTP-facing copy map — but that route is itself under-guarded (any member, H3), so import `requireTenantAdmin` from **`middleware/permissions.ts`** explicitly; `middleware/auth.ts` exports a same-named function with different semantics (M9). Consider tightening `/subdomain`'s guard in the same pass. |
| 3.2 | Tenant settings UI: "Custom domain" section — add form, DNS-instruction card (renders the records Vercel returns: CNAME → `cname.vercel-dns.com` for subdomain; A/ALIAS for apex), status badge, "Check status" action, error display, remove confirm. | tenant settings surface (locate the subdomain section and co-locate) | Non-technical audience — the instruction card is the whole UX; spec §4.1's flow. **Don't rely on `recommendedCNAME`/`recommendedIPv4`** — they can be empty (esp. apex); fall back to the known constants (`cname.vercel-dns.com` for a subdomain, apex A) and treat API values as an override. Present the routing record (A/CNAME) and the ownership TXT (only when `verified=false`) as separate, labeled steps (H10). |
| 3.3 | Feature flag as **platform flag + per-tenant override** (H1/H7): platform flag `custom_domains` in `platform_feature_flags_list` (`allow_tenant_override=true`) gates globally; the beta cohort is `tenant_feature_flags_list` rows (spec §13.2) — reuse `effectiveFlags.ts` + the `/api/admin/platform-flags` and `tenant-flags` surfaces, **not** a new allowlist store. The proxy skips the resolve call when `NEXT_PUBLIC_FF_CUSTOM_DOMAINS` is off (D10). | `unifiedConfig.ts`, `utils/effectiveFlags.ts` (existing), routes, UI | Global flag off = today's behavior; override off for a tenant = routes/UI hidden, host resolve refuses. Env name follows the `FF_*` convention (`FF_CUSTOM_DOMAINS`), not `CUSTOM_DOMAINS_ENABLED`. |
| 3.4 | Web tests: instruction card renders per state (pending/verified/active/error), remove confirm, tier-gate upsell state. | `*.test.ts` renderToStaticMarkup pattern | — |

## Phase 4 — Routing: custom-host rewrite in the proxy

| # | Task | Files | Notes |
|---|---|---|---|
| 4.1 | `proxy.ts`: after `isPlatformSubdomain` misses, classify the remaining host — explicitly **excluding** `*.vercel.app` previews, `localhost`/IP hosts, and platform apexes (`visibleshelf.com`, `www.`, `api.`, `visibleshelf.store`) per M2 — as a candidate custom host → `resolve-custom-domain/:host` (skipped when the flag is off, H1) → same rewrite mechanics + `tcx` cookie. **Fail closed** per B2/B3: same storefront-path allowlist + 404 as the B1 fix, cached resolution incl. negatives (1.4), any non-tenant answer → 404/domain-not-configured, never fall through to the platform app. | `apps/web/src/proxy.ts` | Reuse — extract the rewrite/cookie block **and** the B1 allowlist helper shared with the subdomain branch rather than duplicating either. Skip the resolve call on `NEXT_PUBLIC_FF_CUSTOM_DOMAINS` (H7). **Split the fail-closed policy (H11):** a definitive 404 → fail closed and negative-cacheable; a transient 429/5xx → fail closed but **never** cached (a shared-IP 429 must not take a live storefront down). |
| 4.2 | Canonical policy per D3: storefront emits `<link rel="canonical">` at the custom domain when one is active; platform URLs stay reachable. Target: the `tenant/[id]` storefront's metadata emission (`apps/web/src/app/tenant/[id]/page.tsx` builds tenant metadata — attach `alternates.canonical` there or in the storefront layout head), plus a render test pinning the tag. | `apps/web/src/app/tenant/[id]/` | M4's named target. SEO consolidation without breaking the fallback paths. `generateMetadata({params})` has no host and D3 makes the custom domain canonical even on platform hosts — the value needs a tenant→active-domain lookup (or a tenant field), **not** the request host; cache that read (M8). |
| 4.3 | Tests: host-classification matrix (platform subdomain / apex / custom host / unknown), rewrite targets, passthrough rules. | proxy test or extracted pure helper | Extract `classifyHost`/`buildStorefrontRewrite` as pure helpers — the current inline function is already testable-shaped. |

## Phase 5 — Admin, limits, observability

| # | Task | Files | Notes |
|---|---|---|---|
| 5.1 | Admin routes mirroring `admin-subdomains.ts`: list all custom domains (search/page), view status + Vercel state, force-check, remove — plus sweeper visibility (the B4 job's last-run/next-check state via the existing Scheduled Jobs surface). | `apps/api/src/routes/admin-custom-domains.ts` (new) | Support tooling per spec §4.3 — the failure mode operators will see is "tenant says it's verified but it isn't". |
| 5.2 | Tier enforcement per D4 in `addDomain` + clear upsell copy; count headroom check against 0.3's domain-slot limit before calling Vercel. | `CustomDomainService.ts` | Prefer refusing early to attaching a domain we then can't keep. |
| 5.3 | Telemetry: count/log verification durations, failure reasons, active-domain count. | service + logging | Spec §12's success metrics start here. |

## Phase 6 — Verification & rollout

1. `pnpm checkapi && pnpm checkweb`; API + web suite runs on new/changed files.
2. Migration + RLS on local, then prd.
3. **Live validation with a throwaway domain**: attach a test domain (or a real tenant's) to the project via the tenant flow, walk DNS → verify → cert → storefront end-to-end. Validate both a subdomain (`shop.…`) and apex path.
4. Internal/friendly-tenant beta behind the per-tenant allowlist (H1 — global flag on, `custom_domains_beta` cohort only; env-flag beta conflicts with spec §13.2 and was corrected), then tier-gated rollout.
5. D6 follow-up ticket: public-surface URL preference (directory, QR, outreach) once domains are live in the wild.

---

## Non-goals (v1)

- No redirect of platform URLs → custom domain (canonical tags only, per D3).
- No public-surface URL rewriting (directory/QR/outreach keep platform URLs, per D6).
- No staging support (per D1); no multi-domain per tenant (schema-ready, UI later).
- No storefront login on custom domains unless 0.6's Auth0 check resolves cleanly (H6).
- No email/subdomain-of-tenant-domain support — this serves the storefront only.

## Review findings (gap check, 2026-10-11)

Folded in from the pre-sprint review — the phase rows above now carry the resolutions (B/H/M cross-references inline). Items marked **Blocker** must be settled before Phase 1 starts. A **second pass (below)** adds B5–B7 / H7–H11 / M8–M14 from a 2026-10-11 review against the codebase and Vercel's REST reference; the D-table and phase rows carry those resolutions too.

### Blockers

- **B1. Subdomain branch bypasses the `/admin` auth gate.** `apps/web/src/proxy.ts` (`isPlatformSubdomain` block) returns a rewrite for every path except `/api`, `/_next`, `/favicon`, and dotted paths. It returns before the `/admin` and `/settings/admin` session check runs, so `{tenant}.visibleshelf.com/admin` is rewritten to `/admin` without auth. Phase 4.1 reuses that block for custom hosts, which widens the exposure to every tenant domain. **Fix (both branches):** the rewrite path becomes an allowlist of storefront paths (`/`, `/services`, `/policies`, `/tenant/*`, public global routes). Everything else 404s before rewrite. Fix the existing subdomain branch as its own change; do not wait for custom domains.
- **B2. Unknown hosts fall through to the platform app.** A failed resolve currently drops into normal routing, which renders the platform app on that host. For custom hosts, a resolve that returns anything other than 200 with a tenant must return a 404 or the not-configured page. Never fall through. (Phase 4.1.)
- **B3. Resolve 429 also falls through, and resolve is uncached.** `resolve-subdomain` allows 100 requests per minute per forwarded client IP, and the limiter is in-memory per instance. Shared IPs (store wifi, carrier CGNAT) can trip it, and a 429 now 404s a live storefront (post-B1 — see H11; pre-B1 it showed the platform app). Custom-host resolution must fail closed. Add a short TTL cache, including negative results. Decide the cache location and TTL in Phase 1.4. (Phase 4.1.)
- **B4. No background path to `active`.** Status is pull-only, so a domain whose DNS verifies but is never re-checked stays `pending_verification` forever, and the proxy never serves it. Spec §4.1 and §7.1 call for a sweeper. Implement the sweeper as a job in the existing scheduled-jobs system (migration 312), not webhook machinery. (Phase 2.3, Phase 5.) *Verified:* `apps/api/src/jobs/registry.ts` already registers jobs and persists them to `scheduled_jobs`, with an operator kill switch, so the sweeper is a registration, not new infrastructure.

### High

- **H1. Flag cannot express beta cohorts.** `CUSTOM_DOMAINS_ENABLED` is a global env var, but Phase 6.4 asks for a friendly-tenant beta. Use a per-tenant allowlist (spec §13.2 `custom_domains_beta`). Also skip the proxy's resolve call entirely when the flag is off. (Phase 3.3, 6.4.)
- **H2. `ON DELETE CASCADE` orphans Vercel domains.** Spec §14.1.1 cascades on `tenant_id`, so deleting a tenant drops rows without detaching them from Vercel. Spec §8.3 requires disable-then-detach after a grace period on tenant deletion and tier downgrade. Neither is in the plan. Add a pre-delete detach step in each delete path and a downgrade hook — **keeping the cascade** (dropping it instead leaves a `disabled` row still holding the FK; see B5/D11). (Phase 1.1, add a task.)
- **H3. Role checks missing (verified).** `checkTenantAccess` (`middleware/auth.ts`) passes any tenant member. Phase 3.1 must add `requireTenantAdmin` from `middleware/permissions.ts` (OWNER/ADMIN, built on `requireTenantRole`). Confirm with product whether spec §8.2's MANAGER should also be allowed; if so, use `requireTenantRole` with that set.
- **H4. Cert state is not observable via the API (verified 2026-10-11).** Checked Vercel's REST reference:
  - Project-domain object (`POST /v10/projects/{idOrName}/domains`, and the get/verify endpoints) exposes `verified` (boolean) and `verification` (TXT challenge list). No certificate field.
  - Domain config (`GET /v6/domains/{domain}/config`) exposes `misconfigured`, `configuredBy`, `recommendedCNAME`/`recommendedIPv4`, and `acceptedChallenges` (`dns-01`/`http-01`, which are issuance capabilities, not issued status). No issued or expiry field.
  - Verify action: `POST /v9/projects/{idOrName}/domains/{domain}/verify` completes a TXT challenge (**v9**, not v10 — corrected in H9). Add it to Phase 2.1 (the "Check status" path needs it).
  - The spec's `GET /v10/domains/{name}` is not in the reference we checked. Don't rely on it.
  - **Consequence for Phase 2.3:** drop `cert_provisioning` as an API-observed state. Map `verified && !misconfigured` to the ready state, then confirm TLS with our own HTTPS probe of the host before flipping to `active`. `certificate_status` can only be set from that probe, not from Vercel. Adjust the Phase 1.1 `certificate_status` column to match.
- **H5. Tier naming is inconsistent.** The DB uses `tier_key` values `professional`, `organization`, and `enterprise`. The spec uses Starter/Professional/Enterprise/Organization. This plan says Pro/Org. Decide which keys get the feature. Record that the 1-domain cap in D4 narrows spec §13.1, which expects multiple domains at the top tier.
- **H6. Auth0 callback/logout allowlist.** `apps/web/src/lib/auth0.ts` infers `APP_BASE_URL` from the request host (verified). Storefront login on a custom domain needs that host in Auth0's allowed callback and logout URLs. This is Auth0 tenant configuration, not code, so it can't be verified from the repo. Confirm in the Auth0 dashboard, or mark storefront login out of scope for v1.

### Medium

- **M1.** Drop the `public_custom_domains` view (Phase 1.2) unless a consumer is named. D5 chose the API path, so the view is an anon-readable surface with no caller. Mark spec §14.4 superseded by D5.
- **M2.** Phase 4.1's "any non-apex host" rule would send `*.vercel.app` previews, `localhost`, and IP hosts through resolve. Exclude them explicitly.
- **M3.** Phase 0.4's emitter inventory covers platform URLs generated for external surfaces. Add absolute platform links generated inside the storefront itself, or visitors will hop back to `visibleshelf.com`.
- **M4.** Phase 4.2 needs a named target: the storefront head/metadata location, plus a test.
- **M5.** Phase 1.5 puts tests in `apps/api/src/services/__tests__/`. Both `services/__tests__/` and `lib/__tests__/` exist (verified). The subdomain helper's tests are in `lib/__tests__/subdomain.test.ts`, so put the domain helper tests next to it, and keep service tests in `services/__tests__/`.
- **M6.** Phase 1.1 edits `schema.prisma` by hand. AGENTS.md requires `prisma db pull` and `prisma:generate` instead.
- **M7.** D4 (one domain per tenant) is enforced only in code. Add a partial unique index on `tenant_id` where `status <> 'disabled'`, or state explicitly that the service check is the only enforcement.

### Doc corrections

- D5 and spec §14.4 conflict. §14.4 is superseded by D5.
- D4 and spec §8.1/§13.1 conflict on domain count. The narrowing is recorded here (H5).
- Phase 6.4's env-flag beta conflicts with spec §13.2 (H1).

---

### Second pass (2026-10-11)

Verified against the codebase + Vercel's REST reference. The phase rows and D-table above now carry the resolutions (B5–B7 / H7–H11 / M8–M14).

#### Blockers

- **B5. Dropping the cascade doesn't let a tenant delete succeed.** `custom_domains.tenant_id` is `NOT NULL REFERENCES tenants(id)`. Remove `ON DELETE CASCADE` and the FK default becomes `NO ACTION`, so `prisma.tenants.delete()` throws a FK violation whenever *any* row exists — including a `disabled` one. "Disable the domains" does not satisfy the FK. **Resolution (D11):** keep the cascade and detach from Vercel in an explicit pre-delete step; Prisma has no delete hook, so it's a call in each hard-delete path (`admin-tools.ts` test-tenant delete, `directory-presence-admin.ts` seed delete — confirm whether prod tenants are hard-deleted at all).
- **B6. D4 vs M7 contradict.** D4 says `is_primary` makes multi-domain migration-free; M7's partial unique index on `tenant_id where status <> 'disabled'` enforces exactly one, so a second domain later *requires* dropping that index (a migration). Pick one and say so.
- **B7. Apex + `www` collide with the 1-domain cap.** Vercel treats `mybrand.com` and `www.mybrand.com` as separate project domains, so an apex tenant burns 2 of 1 slots. **Resolution (D9):** count apex + `www` as one logical domain (both attach, `www` redirects to canonical), or lead v1 with subdomains only (spec §6.4 MVP).

#### High

- **H7. Reuse the existing flag system (extends H1).** The platform already ships `platform_feature_flags_list` (+ `allow_tenant_override`) + `tenant_feature_flags_list`, an admin surface (`/api/admin/platform-flags`, `tenant-flags.ts`), a 30s effective-flag cache (`effectiveFlags.ts`), `FF_*` env precedence, and an expiry job — a bespoke "allowlist store" duplicates all of it. The proxy also can't read a non-public var: it needs `NEXT_PUBLIC_FF_CUSTOM_DOMAINS` (mirrors `NEXT_PUBLIC_FF_TENANT_URLS`) to skip the resolve call.
- **H8. Job file targets are wrong.** Jobs are individual modules `apps/api/src/jobs/<name>.ts` exporting `startXJob()`, imported/invoked from `apps/api/src/index.ts` — not `registry.ts` entries. The sweeper is a new module + `index.ts` wiring. Tier downgrade already runs in `subscription-grace-period.ts` (`processGracePeriodExpiry` → `downgradeToExpired`, daily) — hook there.
- **H9. Vercel endpoint versions.** Get-a-project-domain is `GET /v9/projects/{idOrName}/domains/{domain}` and verify is `POST /v9/projects/{idOrName}/domains/{domain}/verify` — not v10 (H4/2.1 say v10 for verify). Add is `POST /v10/projects/{idOrName}/domains`. A duplicate add returns **400**, not 409 — treat as "already attached, reuse".
- **H10. DNS card must not depend on `recommendedCNAME`/`recommendedIPv4`.** Vercel's own guidance: the `verification` array carries only the TXT challenge, not the A/CNAME setup records, and the config arrays are often empty (esp. apex). Fall back to the known constants; present the routing record (A/CNAME) and the ownership TXT (only when `verified=false`) as separate, labeled steps.
- **H11. B3's premise is stale and fail-closed-on-429 is an availability risk.** The landed B1 already 404s on 429 (`proxy.ts`), so a shared-IP/CGNAT 429 takes a *live* storefront down today. Split: definitive 404 → fail closed + negative-cacheable; transient 429/5xx → fail closed but **never** cached.

#### Medium

- **M8. Canonical value needs a source.** `generateMetadata({params})` has no host, and D3 makes the custom domain canonical even on platform hosts — so it needs a tenant→active-domain lookup (or tenant field), not the request host. Extra read per storefront render; cache it.
- **M9. `requireTenantAdmin` name collision.** `middleware/permissions.ts` (`requireTenantRole(OWNER, ADMIN)`) and `middleware/auth.ts` (platform-admin-bypass, param-derived tenantId) both export it; `tenants.ts` imports its guards from `middleware/auth`. State the import path explicitly. Also `/subdomain` itself is under-guarded (any member) — consider fixing in the same pass.
- **M10. RLS on the base table unspecified.** Phase 6.2 says "Migration + RLS" but 1.1 doesn't enable it. Convention (`048_social_pixels.sql`) is `ENABLE ROW LEVEL SECURITY` + a `current_setting('app.current_tenant_id', true)` policy. Enable RLS + a service-role/no-anon policy even without the view (spec §14.1.3), or state it's service-role-only.
- **M11. `www` may be a B1 regression.** `isPlatformSubdomain('www.visibleshelf.com')` returns `www`, which B1 then allowlists + resolves → 404 if no tenant. M2 excludes `www` for custom hosts; the subdomain branch doesn't. Verify `www`/apex still serve.
- **M12. Per-project Vercel domain limit is the real ceiling.** Spec §3.2 targets "hundreds to low thousands"; one project will hit Vercel's per-project limit and need multiple projects or a plan change. Record the number (0.3) and reconcile.
- **M13. Minor drift.** 0.2 adds the Vercel token to doppler "dev + prd" while D1 is production-only (AGENTS uses `local|prd`). The spec file still contains the superseded §14 view/RLS scaffolding, `/v10/domains/{name}`, `cert_provisioning`, and Starter/Pro/Enterprise wording — decide whether to edit the spec or keep the plan as the delta.
- **M14. `misconfigured` coercion.** The `/v6/domains/{domain}/config` example shows `"false"` as a string; the schema says boolean. Coerce defensively before `verified && !misconfigured`.

#### Doc corrections (second pass)

- D4 amended: apex + `www` = one logical domain (D9); the partial index is a deliberate v1 lock (B6).
- D-table gains D9 (domain-count accounting), D10 (flag mechanism), D11 (tenant-deletion FK).
- Spec §14.4's `middleware.ts` name is also stale — the file is `proxy.ts` under Next 16 (`next@16.3.6`); the plan already targets the right path.

---

## Verification findings (to update during implementation)

- Pattern anchors confirmed: `apps/web/src/proxy.ts` (`isPlatformSubdomain`, rewrite block, `tcx` cookie), `apps/api/src/lib/subdomain.ts` (normalize/refuse/availability model to mirror), `apps/api/src/routes/admin-subdomains.ts` (admin-route shape), `GET /api/tenants/resolve-subdomain/:subdomain` (the resolution contract the proxy already consumes).
- Spec anchors: §5 (schema, RLS), §6.2 (Vercel lifecycle, idempotency, detach-on-remove), §8 (tiers), §9 (risks — DNS propagation, host-header spoofing, cert rate limits, SEO duplication), §11 (open questions → D-table), §13 (testing matrix, rollout), §14 (SQL + service + middleware scaffolding).
- Today's §15 learnings that apply here: cert issuance is minutes-scale after Vercel sees DNS; negative-cache NXDOMAINs confuse verification checks (surface "DNS not propagated yet" copy on early checks); Vercel's domain-entry list is the source of truth for whether a host can handshake.
- **B1 landed as its own change** (`apps/web/src/proxy.ts`): the subdomain branch now allowlists storefront paths (`/` + `/services`/`/policies` prefix-roots + pass-through roots), 404s everything else before resolving, and fails closed on any definitive non-tenant answer — `/admin`/`/settings`/`/t/`/`/debug`/`/test-*` can no longer render unauthenticated on a tenant subdomain. The Phase-4 custom-host branch reuses the same `isStorefrontPath` helper and fail-closed resolve.
