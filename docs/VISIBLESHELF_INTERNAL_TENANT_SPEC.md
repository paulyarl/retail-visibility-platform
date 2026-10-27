# VisibleShelf Internal — Custom Tenant Deploy Spec

**Status:** DEPLOYED 2026-10-27 (tenant row created; external connects pending)
**Owner:** Platform team
**Date:** 2026-10-27
**Purpose of this doc:** two roles — the deploy record for the `VisibleShelf Internal` tenant, and the **template** for future custom tenant deploys (§9 is the reusable part).

---

## 1. Purpose

A platform-internal tenant that is our own best customer — "eat our own cooking" at full fidelity:

- **GBP Management Suite playground** — connects to the platform's own verified Google Business Profile (`VisibleShelf`), giving a real, 60+-day profile to exercise posts, reviews, photos, hours/NAP guardian against once Gate B (project allowlisting, case `5-5364000041203`) lands.
- **GMC-aware storefront** — carries real products through the Merchant Center sync + `GMCValidationService` pipeline so feed quality, taxonomy, and validation surfaces are dogfooded end-to-end.
- **Living demo** — a real storefront on a real tier, viewable like any merchant's, without `is_demo` exclusions (indexable, directory-eligible).
- **Fixture donor** — once GBP access lands, `GBP_TRANSPORT=record` can refresh `apps/api/fixtures/gbp/approved/` from real responses (see `AGENTS.md` "GBP transport seam").

## 2. Tenant record (the deploy fields)

| Field | Value | Notes |
|---|---|---|
| `id` | `tid-*` generated | `generateTenantId()` format |
| `name` | `VisibleShelf Internal` | Display name everywhere |
| `slug` | `shelfvisible` | Matches `@shelfvisible` on every social handle; `/directory/shelfvisible` |
| `subdomain` | `shelfvisible` | `shelfvisible.visibleshelf.com` — canonical storefront host |
| `subscription_tier` | `enterprise` | Top of `shared/tier-contract.json` ladder — nothing gated |
| `subscription_status` | `active` | Not a trial — internal tenants don't trial |
| `location_status` | `active` | |
| `is_demo` | `false` | Deliberately NOT demo — demo tenants get `noindex` and are excluded from sitemaps/directory surfaces |
| `data_policy_accepted` | `true` | It's us |
| `manual_subscription_control` | `true` | Keep billing automation/dunning off an internal row |
| `platform_fee_waived` | `true` | No self-billing |
| `created_by` | platform admin user id | Also gets the `user_tenants` OWNER row |
| `metadata` | `{ internal: true, purpose: 'platform-dogfood' }` | Marked internal for reporting filters |

## 3. Addresses

| Surface | URL | Status |
|---|---|---|
| Tenant dashboard | `visibleshelf.com/t/{tenantId}` | active at create |
| Platform path | `visibleshelf.com/tenant/{tenantId}` | active at create |
| Subdomain | `shelfvisible.visibleshelf.com` | canonical storefront host |
| Custom domain | **none** | See decision D3 |

## 4. External connections

| Connection | Target | Mechanism | Status |
|---|---|---|---|
| Google Business Profile | The platform's own `VisibleShelf` GBP (verified 60+ days) | Normal tenant OAuth connect (`business.manage`), from an account that is owner/manager on that GBP | **Blocked on Gate B** — project `407743626849` allowlist pending (case `5-5364000041203`, ~Nov 7–10). `GET /api/google/business/locations` returns `503 api_not_approved` until quota flips to 300 QPM. |
| Google Merchant Center | The platform's existing MC — `visibleshelf.com` verified + claimed, `google_merchant_links_list` row for this tenant | Tenant-scoped MC connect | Ready when products exist |
| Clover/Square/Meta/Pinterest | — | Optional later | Not connected at create |

**Why the platform MC is correct here** (amends `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.3's "tenant products never enter the platform MC"):

- The invariant stands for *merchants* — tenant products never enter the platform MC. `VisibleShelf Internal` is the platform itself as a tenant; the dedicated MC is simply *this tenant's own* MC connection. It is tenant-scoped in the DB like any other.
- Practical win: `visibleshelf.com` is already claimed in that MC, and `shelfvisible.visibleshelf.com` lives under the claimed apex — feed `link`s are GMC-clean with zero new domain work.
- The GBP↔MC link on the platform profile is unaffected — the entity-trust benefit stays.

## 5. Products & content plan

Products are operator-authored (brainstorm in progress), not seeded from a template. Every product must pass the feed validator (`GMCValidationService.validateProductForGMC`) — the ERROR set:

- `title`, `description` (≥30 chars), `image_url`, `price`
- `item_status = 'active'` + `visibility = 'public'` to enter the feed at all
- `product_type` ∈ `physical`/`hybrid` for the GMC surface

Content must be real — this is a customer-visible storefront and the posts it publishes through the GBP Suite land on the live acquisition profile (see `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.5 cadence: Mon Update / Wed Offer / Fri Update).

## 6. Decisions & rejected alternatives

| # | Decision | Rejected | Why |
|---|---|---|---|
| D1 | New dedicated tenant | `tenants.id='platform'` sentinel; demo tenant `tid-25we5qgj` | Sentinel is platform-scope plumbing, not a storefront actor, and platform staff hold no membership row on it so standard tenant UX doesn't reach it cleanly; the demo tenant is shopper-demo inventory, not the internal dogfood |
| D2 | `is_demo=false` | demo flag | Demo tenants are `noindex`'d and excluded from sitemap/directory — this tenant is meant to be visible |
| D3 | Subdomain only | Custom domain (e.g. `shelfvisible.shop`) | Attaching a custom domain flips the canonical ladder (`custom → subdomain → path`) to a host the MC doesn't claim → GMC "mismatched domains"; fixing it would release the `visibleshelf.com` claim (the §3.3 entity-trust point) and drift the storefront away from the GBP's website field — the exact NAP drift we audit merchants for |
| D4 | `enterprise` tier | Lower rung | Playground must exercise the full capability surface; tier is cosmetic cost-wise (internal, fee-waived) |
| D5 | Slug `shelfvisible` | `visibleshelf-internal` | Redundant doubling (`visibleshelf-internal.visibleshelf.com`); `shelfvisible` matches the social handles |

## 7. Deploy procedure

```bash
cd apps/api
doppler run --config prd -- node scripts/create-tenant.cjs \
  --name "VisibleShelf Internal" \
  --slug shelfvisible \
  --subdomain shelfvisible \
  --tier enterprise \
  --owner-email <admin email> \
  --internal
```

`scripts/create-tenant.cjs` is parameterized (name/slug/subdomain/tier/owner/flags) and idempotent — safe to re-run; it reports existing collisions instead of duplicating. `--internal` applies the internal-tenant flag set (manual subscription control, fee waived, `metadata.internal`).

**Post-create checklist:**

- [ ] Tenant resolves: `GET /api/tenants/{id}` → 200
- [ ] Storefront renders at `shelfvisible.visibleshelf.com`
- [ ] OWNER membership row present (`user_tenants`)
- [ ] Business profile seeded (`tenant_business_profiles_list`) with platform NAP — phone `+1 913-703-6157`, `contact@visibleshelf.com`, `visibleshelf.com`
- [ ] Products added per §5
- [ ] GBP connect — **after** case `5-5364000041203` approval (quota 300 QPM)
- [ ] MC link — the existing platform MC row
- [ ] `GBP_TRANSPORT=record` fixture refresh once live GBP calls work

## 8. As-built record

| Field | Value |
|---|---|
| Tenant ID | `tid-sud4ky1c` |
| Created | 2026-10-27 |
| Env | prd |
| Owner user | `uid-li9gr` (`yarlmoment@gmail.com`, PLATFORM_ADMIN → tenant OWNER) |
| Dashboard | `visibleshelf.com/t/tid-sud4ky1c` |
| Storefront | `shelfvisible.visibleshelf.com` / `visibleshelf.com/tenant/tid-sud4ky1c` |

## 9. Reusing this spec — custom tenant deploy template

For any bespoke tenant (internal, partner, showcase, migration assist):

1. **Fill the §2 field table** — the only required decisions: `name`, `slug`, `subdomain`, `subscription_tier`, `subscription_status`, `is_demo`, owner.
2. **Run §7's script** with the chosen fields — same command shape, no `--internal` for customer tenants.
3. **Decide address strategy per D3's logic** — custom domain only if the tenant owns its canonical host AND its MC (if any) claims that host.
4. **External connects are all post-create, tenant-scoped** — GBP/MC/POS are OAuth rows on the tenant; nothing in the tenant row itself references them.
5. **Gates worth checking:** slug/subdomain uniqueness (script enforces), trial limits (bypassed by direct creation), tier validity (must exist in `shared/tier-contract.json`), `is_demo` indexation consequences.
