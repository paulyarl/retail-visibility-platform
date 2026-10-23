# Tenant Custom-Domain Visibility — Product Spec

> **What this is:** a paid service that takes a tenant's *own* domain
> (`shop.example.com`) from "connected and technically indexable" to "verified,
> submitted, monitored, and maintained in Search Console."
>
> **What it is not:** a switch that turns indexing on. Tenant-domain pages are
> already advertised by the platform sitemap and canonicalized to the tenant host
> today. The paid product sells **control, insight, and upkeep** — not access.
>
> **Companion docs:**
> - `docs/LocalBiz/PLACES_SEO_INDEXING_SPEC.md` — the platform-side indexing work this builds on
> - `docs/LocalBiz/SEARCH_CONSOLE_OPERATOR_GUIDE.md` — the manual procedure this product automates

**Status:** Proposed — awaiting review
**Owner:** TBD
**Scope:** `apps/api` (property registry, GSC integration, health checks) · `apps/web` (per-host sitemap/robots, tenant + admin surfaces) · ops (verification, reporting)

---

## 1. Why this exists

### 1.1 What a tenant gets for free today

| Already true | Where it lives |
|---|---|
| Custom domain resolves and serves the storefront | `custom_domains` (`status='active'`) + `apps/web/src/proxy.ts` |
| Pages canonicalize to the tenant host (custom → subdomain → platform path) | `apps/api/src/lib/storefront-url.ts`, `apps/web/src/lib/storefront-routing.ts` |
| Storefront + product URLs are listed in the platform sitemap | `apps/api/src/lib/sitemap.ts` (`tenantCanonicalHome`, `buildProductEntries`) |
| The tenant host serves a `robots.txt` whose `Sitemap:` line authorizes those cross-host URLs | `apps/web/src/app/robots.ts` + proxy `.`-path passthrough |

So the discovery baseline is done. What the tenant cannot do is *see* anything:
which queries their domain earns, which pages are excluded, whether the domain
still resolves to one canonical host, or whether a deploy silently broke it.

### 1.2 What they cannot do without their own property

- Submit a sitemap **under their own domain** (today `/sitemap.xml` on any host returns the *platform* sitemap).
- See queries / impressions / CTR for their pages.
- Read coverage: `Discovered`, `Crawled – not indexed`, `Alternate page`, `Excluded by noindex`.
- Request indexing for a new seasonal page or product.
- Detect the failure modes we already know about (see §4.4).

### 1.3 Honest limits

- A competent tenant or their agency can self-serve verification in ~15 minutes. The moat is **recurring monitoring and remediation**, not setup.
- For most of these merchants, Google Business Profile is the larger local lever. GSC-only is a weak bundle (§9).
- Any pricing copy that implies "buy this to get indexed" will generate refunds.

---

## 2. Current technical baseline (what changes)

### 2.1 The per-host sitemap gap (blocking)

`next.config.ts` rewrites `/sitemap.xml` to the platform index for **every host**.
If a tenant verified `shop.example.com` and submitted its `/sitemap.xml`, they
would submit a document containing **other tenants' URLs** — cross-site and
unauthorized for their property, and a cross-tenant leak.

**Required:** a host-aware sitemap on tenant hosts:

```
https://shop.example.com/sitemap.xml   → that tenant only: storefront home + its products
https://shop.example.com/robots.txt    → Sitemap: https://shop.example.com/sitemap.xml
https://visibleshelf.com/sitemap.xml   → platform index (unchanged)
```

Because Next rewrites cannot branch on host, this becomes a route handler that
reads `headers().get('host')`: platform hosts proxy the platform index; tenant
hosts proxy a host-scoped API endpoint.

**Side benefit:** once a tenant host serves its own sitemap, the platform sitemap
no longer needs to advertise that tenant's URLs at all. That removes the §4.10
cross-host authorization dependency for custom domains (the storefront/product
locs keep working for platform subdomains, which are covered by the domain
property).

### 2.2 robots.txt becomes host-aware

`app/robots.ts` currently emits a platform-absolute `Sitemap:` line on every
host. Tenant hosts should advertise **their own** sitemap; the platform host
keeps its own. Keep the platform line as a secondary reference only while the
platform sitemap still lists that tenant's URLs.

---

## 3. Product definition

### 3.1 Packaging

| Tier | What it includes | Rationale |
|---|---|---|
| **Domain connect** (free, exists) | DNS/host attach, canonical ladder, platform sitemap coverage, tenant-host robots | Do not charge for baseline discoverability; don't imply it's off |
| **Domain Visibility** (paid) | Verification + delegated access, per-host sitemap, baseline, monthly report, health monitoring, remediation | Recurring service with real labour |
| **Local Visibility** (paid bundle, recommended) | Domain Visibility + Google Business Profile management + schema/landing-page work | GBP is the stronger lever; bundling raises perceived value and retention |

### 3.2 What "maintained" means (the deliverable)

Monthly, per verified domain:

1. **Report**: clicks/impressions/CTR/position (top queries, top pages), coverage counts, and a plain-language summary of what changed.
2. **Health**: the seven pre-flight gates from the operator guide, automated (§4.4).
3. **Remediation**: anything that fails gets a ticket — canonical regressions, host duplication, noindex leaks, sitemap fetch failures.

---

## 4. Requirements

### 4.1 Per-host sitemap + robots (prerequisite)

- `GET {tenant-host}/sitemap.xml` → `<urlset>`: tenant storefront home, that tenant's `/products/{id}`, and (if published) its `/directory/{slug}`.
- Must be **tenant-scoped in SQL**, not filtered in the view — a filter bug is a cross-tenant leak.
- Cache 1h; invalidate on tenant/product publish changes.
- `GET {tenant-host}/robots.txt` → own sitemap reference; disallow the same app-internal paths as the platform file.
- Platform host behaviour unchanged.

### 4.2 Property registry

One row per (tenant, domain) with the verification lifecycle:

| Field | Notes |
|---|---|
| `tenant_id`, `domain` | unique on `(tenant_id, domain)`; domain lowercased, `www` stripped |
| `property_type` | `domain` (recommended) or `url_prefix` |
| `verification_method` | `dns_txt` \| `html_file` \| `meta_tag` |
| `verification_token`, `verified_at` | token is not secret; shown to the tenant |
| `gsc_property_id` | the identifier Search Console returns |
| `ownership` | `tenant_owned` (platform is a user) \| `platform_managed` (platform is owner, tenant is user) |
| `status` | `pending_dns` → `pending_verification` → `verified` → `joined_existing` \| `error` |
| `last_checked_at`, `last_error` | health-check bookkeeping |

**Ownership policy (recommended):** the tenant owns the property; the platform is added as a user/delegated owner. On churn the data stays with them — which is both fair and a retention argument ("your history is yours").

**Existing properties:** if the tenant (or their agency) already verified the domain, the flow is *join*, not *create*: tenant grants access, platform records `joined_existing`, no second property.

### 4.3 Verification flow

```
Tenant enables Domain Visibility
  → we show the DNS TXT record (name + value)
  → tenant adds it at their DNS host  (or: we integrate Cloudflare for one-click)
  → "Check verification" (manual button + hourly retry for 72h)
  → verified → platform added as delegated owner
  → baseline captured (§4.6) → monitoring on
```

Without DNS access the platform cannot verify on the tenant's behalf. The
"paid setup" is therefore **guided**, unless a DNS-provider integration exists
(§12, decision D2).

### 4.4 Automated health checks (the operator guide, parameterized)

Per verified domain, daily (configurable), reusing the guide's §0 gates:

| Check | Pass condition | Maps to guide |
|---|---|---|
| Host canonicalization | `www` 301s to the stored host (or vice versa); only one host serves 200 | §0.6 |
| robots.txt | 200, references the domain's own sitemap, no disallow of `/place`, `/directory`, `/tenant`, `/shops`, `/products`, `/_next/` | §0.1 |
| sitemap fetch | 200, `application/xml`, parses, URL count > 0 | §0.2–0.3 |
| sitemap scope | **every** `<loc>` is on that domain (leak test) | §0.3 |
| canonical agreement | storefront + a sample product canonicalize to this domain | §0.5/§3 |
| noindex | no real page carries `noindex` (demos/`google_only`/non-public excepted) | §5 |
| sweep | sample of N URLs returns 200 (full sweep weekly) | §0.7 |

Each check writes a row; a state change (pass→fail) opens a ticket and notifies
the tenant. This is the product's core recurring value.

### 4.5 Search Console integration

- **Search Console API**: search analytics (queries/pages), sitemaps list + submit, URL inspection (for indexing requests).
- **Site Verification API**: generate/verify tokens programmatically; still requires the tenant's DNS action.
- **Auth**: a platform Google account (or service account) added as a user of each property. Service accounts can be added as users; confirm against the current Google policy before build (decision D3).
- **Quotas**: URL inspection is per-day and per-property; the monthly report only needs analytics + sitemaps. Indexing requests stay operator-triggered, not automated per page.
- **Data handling**: store aggregates (top queries/pages, coverage counts) — not raw query strings with PII beyond what GSC exposes. Retention 24 months.

### 4.6 Baseline

On verification: capture indexed count, coverage buckets, and sitemap counts
before any submission, so the first report can show movement rather than a
number in isolation. Same table as the operator guide §4.

### 4.7 Entitlement

New capability key `domain_search_console` (advanced type), gated per tenant.

> **Contract rule (AGENTS.md):** edit `shared/tier-contract.json` **first** — tier
> order, capability modules, and `surface_files` — then the code. The contract
> suites (`tier-*`, `mv-shape-lint`, `tier-doc-generation`) fail on drift.

### 4.8 Surfaces

- **Tenant:** `/t/{tenantId}/settings/domain-visibility` — status, DNS instructions, verification button, latest report, check history.
- **Admin:** `/settings/admin/directory/domain-visibility` — all properties, failures, manual re-check, "join existing property" action.
- **Operator report:** the same data as the monthly email/PDF.

---

## 5. Non-goals

- Google Business Profile management (separate service; bundle commercially, not technically).
- Content quality / E-E-A-T work.
- Paid link building, review acquisition, or "guaranteed ranking".
- A general analytics dashboard — Search Console aggregates only.
- Managing the tenant's *own* website outside the storefront (if they have one, we only verify/report on the domain; we don't touch their other site).
- Migrating an existing agency-managed property away from the agency.

---

## 6. Failure modes and guardrails

| Risk | Guardrail |
|---|---|
| **Cross-tenant leak in a per-host sitemap** | SQL scoped by tenant; acceptance test asserts no foreign `<loc>`; leak test runs daily (§4.4) |
| Verification stuck (no DNS access) | 72h retry, then status `pending_dns` with a tenant-facing "we need your DNS record" task |
| Two properties for one domain | `join_existing` flow; uniqueness on `(tenant_id, domain)` + a domain-level lookup before create |
| Tenant churns | Property stays with tenant; platform access revoked; history export offered |
| Google API quota/outage | Health checks degrade to HTTP-only; reports mark data as partial |
| www/apex duplication (already live on `visibleshelf.com`) | Host check is a hard gate before the first submission (§4.4) |
| Tenant's domain used by another tenant | Domain attach already prevents it; the registry re-validates against `custom_domains` |
| Report promises movement | Copy states the 2–4 week window and reports movement, never a rank guarantee |

---

## 7. Build sequence

**PR A — per-host sitemap + host-aware robots** (prerequisite, ships value alone)
Host-aware route handler; tenant-scoped API endpoint; robots per host; leak tests.
*Acceptance:* tenant host sitemap contains only its own URLs; platform host unchanged; no cross-host `<loc>` regression.

**PR B — property registry + guided verification** (manual ops is fine at this scale)
Tables, admin surface, DNS instructions, verification retry, baseline capture.
*Acceptance:* one real tenant domain verified end-to-end by an operator.

**PR C — health checks** (the operator guide, automated)
Daily checks, ticket on state change, admin failures view.
*Acceptance:* deliberately break a canonical/robots on a test tenant → a ticket opens within one run.

**PR D — GSC read integration + monthly report**
Search analytics + sitemaps + coverage; report renderer; delivery.
*Acceptance:* first report contains real queries/pages/coverage for a verified domain.

**PR E — entitlement + tenant UI**
Tier fixture first, then capability, then the settings page.
*Acceptance:* unentitled tenant sees the upsell, entitled tenant sees status/report; contract suites green.

---

## 8. Acceptance criteria (service level)

1. A tenant host's `/sitemap.xml` lists **only** that tenant's URLs (automated leak test).
2. A tenant host's `/robots.txt` references its own sitemap and disallows the same internal paths as the platform file.
3. Verification completes end-to-end for a domain the operator controls; the flow also joins an already-verified property without creating a second one.
4. Every verified domain runs the seven checks daily; a deliberate regression opens a ticket within one run.
5. The monthly report contains queries, top pages, coverage buckets, and a delta against baseline.
6. No tenant can see another tenant's property, checks, or report.
7. `pnpm checkapi`, `pnpm checkweb`, `pnpm build` green; contract suites green.

---

## 9. Pricing and positioning

- **Setup:** one-time, priced as *guided setup + baseline*, not "sitemap submission".
- **Monthly:** monitoring + report + remediation. This is the product.
- **Bundle:** sell with GBP management. GSC-only is a thin story for a local merchant; "your local visibility is watched and fixed" is a real one.
- **Do not** price by "number of pages indexed" or imply indexation is included — it isn't, and it varies.
- **Anchor:** compare to an agency retainer for the same monitoring, not to the free Search Console UI.

---

## 10. Pilot

- **Who:** 3–5 custom-domain tenants (mix of active and dormant).
- **What:** run the operator guide per domain manually first — it validates the checks and produces the baseline the product will automate.
- **Measure:** 30 days before vs 30 days after verification + submission; compare against subdomain-only tenants as control.
- **Metrics:** impressions, clicks, indexed pages, coverage buckets, time-to-index for a newly published product.
- **Decision gate:** if custom-domain tenants show no measurable lift over the control group, sell the *monitoring* value explicitly (or fold it into a GBP bundle) rather than an indexing promise.

---

## 11. Risks and open decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Property ownership** — platform-managed vs tenant-owned | **Tenant-owned, platform is delegated user.** Trust and churn-safety; costs a little more support. |
| D2 | **DNS integration** (Cloudflare one-click) vs guided TXT only | Guided first. Add Cloudflare when >10 tenants stall on DNS access. |
| D3 | **Auth model** — service account added as user vs operator Google account | Verify current Google policy before PR D; service account scales better if permitted. |
| D4 | **Does the platform sitemap keep listing custom-domain URLs** after per-host sitemaps exist? | **Drop them.** Removes the §4.10 cross-host dependency and halves duplicate discovery. Keep platform subdomains (covered by the domain property). |
| D5 | **Report cadence** — monthly vs quarterly | Monthly for the first two quarters (shows movement), quarterly after. |
| D6 | **Price point** | Anchor to agency monitoring retainers; validate in the pilot (§10). |

---

## 12. Appendix — mapping to the operator guide

Every manual step in `SEARCH_CONSOLE_OPERATOR_GUIDE.md` has an owner in this product:

| Guide step | Product owner |
|---|---|
| §0 pre-flight (7 gates) | PR C health checks (daily) |
| §1 property verification | PR B guided flow |
| §2 sitemap submission | PR B (on verify) + PR D (status in report) |
| §3 URL inspection / indexing requests | PR D (operator-triggered; quota-bound) |
| §4 baseline | PR B |
| §5 weekly checks | PR C + PR D report |
| §6 troubleshooting | Ticket + runbook link per check |
| §7 custom domains | this spec |
| §9 rollback | per-tenant: disable monitoring; platform host unaffected |

The guide stays as the **manual fallback** — for a tenant who insists on doing it
themselves, and for debugging when automation disagrees with reality.
