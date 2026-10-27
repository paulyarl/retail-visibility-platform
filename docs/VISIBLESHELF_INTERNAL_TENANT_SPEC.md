# VisibleShelf Internal — Custom Tenant Deploy Spec

**Status:** DEPLOYED 2026-10-27 (tenant row created; external connects pending)
**Owner:** Platform team
**Date:** 2026-10-27
**Purpose of this doc:** two roles — the deploy record for the `VisibleShelf Internal` tenant, and the **template** for future custom tenant deploys (§10 is the reusable part).

---

## 1. Purpose

A platform-internal tenant that is our own best customer — "eat our own cooking" at full fidelity:

- **GBP Management Suite playground** — connects to the platform's own verified Google Business Profile (`VisibleShelf`), giving a real, 60+-day profile to exercise posts, reviews, photos, hours/NAP guardian against once Gate B (project allowlisting, case `5-5364000041203`) lands.
- **GMC-aware storefront** — carries real products through the Merchant Center sync + `GMCValidationService` pipeline so feed quality, taxonomy, and validation surfaces are dogfooded end-to-end.
- **Living demo** — a real storefront on a real tier, viewable like any merchant's, without `is_demo` exclusions (indexable, directory-eligible).
- **Fixture donor** — once GBP access lands, `GBP_TRANSPORT=record` can refresh `apps/api/fixtures/gbp/approved/` from real responses (see `AGENTS.md` "GBP transport seam").
- **Onboarding journey dogfood** — a fresh tenant's dashboard is the merchant guided-setup surface verbatim: Next Steps checklist, Attention Needed flags, capability activation counters (observed live 2026-10-27: 5/17 steps, "23/27 capabilities", storefront/product-type selection prompts). Completing them through the UI — rather than seeding around them — exercises the same path every new merchant walks.

**The internal-store twin (noted 2026-10-27):** this tenant is one of *two* internal stores. The other is the platform's own **BSaaS / App Store** (`bsaas_catalog` — capability-anchored SKUs, bundles, promotions → `tenant_feature_purchases`; the "App Store" surface on every tenant dashboard). Two internal stores on the same commerce substrate, opposite business models — physical dropship goods vs software capability SKUs — is the flexibility proof: the platform runs its own billing storefront and its own retail store on shared rails. The App Store also checks the "**in-app purchase**" box that app/game marketplaces are judged on — `tenant_feature_purchases` is the IAP ledger and the feature unlock happens in-product; unlike a game's IAP, ours runs on the same commerce engine we sell. **Revenue-surface inventory** (the partner/investor framing — every stream is wired, none slideware): subscription MRR (`subscription_tier`), IAP expansion (`tenant_feature_purchases`), transaction take-rate (`platform_fee_percentage`/`platform_fee_fixed_cents`), managed services (`service_level`/`managed_services_active`) — and the internal stores exercise each end-to-end.

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

## 5. Products & merchandising model

**Decided 2026-10-27:** a real dropship retail store — *tools for retailers* — with GMC (the platform's own MC) as the acquisition channel and a fully functional storefront. Visible Shelf LLC acts as the retailer to wholesalers (resale cert, real margins); suppliers fulfill.

**What it sells:** retail-visibility hardware and supplies — the physical toolkit of the product we sell (a merchant touring the demo storefront sees a store selling QR stands, shelf talkers, NFC tags, decals — the tools they're supposed to use).

Three catalog tiers:

| Tier | SKUs | Source | Feed notes |
|---|---|---|---|
| Wholesale UPC'd goods | ~10 | Azar Displays / Displays2go / Store Supply Warehouse (fixtures, sign frames, shelf talkers); Seritag/GoToTags (NFC); Amazon Business/POSGuys (scanners, label printers) | Real GTINs — strongest GMC items |
| POD custom | ~4–6 | Sticker Mule / Signs.com / POD signage — engraved QR stands, window decals, Etsy-inspired formats | `identifier_exists: false`; own designs + imagery |
| Digital / hybrid | ~3 | Playbook PDF, template packs, Merchant Visibility Starter Kit bundle | Exercises `digital`/`hybrid` product types; digital is weak on the Shopping surface — not the feed lead |

Price shape: $15–60 impulse range for signage/POD, 2–3 $100+ hardware anchors.

**Inventory modeling (`inventory_items`):** POD items → `track_inventory=false` (supplier prints/ships on demand — always in stock, nothing to count); wholesale goods → `source_type` + `supplier_catalog_item_id` link where the supplier catalog supports it (`last_supplier_sync` tracks freshness); `allow_backorder` as the alternative for made-to-order items that should still sell through a stock-out.

**Feed gates (validator ERROR set):** `title`, `description` ≥30 chars, `image_url`, `price`; `item_status='active'` + `visibility='public'`; `product_type` ∈ `physical`/`hybrid` for the GMC surface.

## 6. Capability & readiness

**Relevant capability keys** (feature-registry collections — the merchant-gate surface):

- `payment_gateway_options` collection: `payment_gateway_stripe` (primary for this store), `payment_gateway_paypal`, `payment_gateway_square`; state keys `payment_gateway_enabled` / `_flexible` / `_disabled`
- `fulfillment_options` collection: dropship = `fulfillment_shipping`; digital/catalog items also exercise `fulfillment_service`; `fulfillment_pickup` / `_delivery` unused here (no physical premises); state keys `fulfillment_enabled` / `_flexible` / `_disabled`

**Storefront readiness checklist for a real store:**

- [ ] **Payment gateway onboard** — all three are wired as per-gateway checkout routes (`routes/checkout/{stripe,paypal,square}.ts`); the `PaymentGatewayFactory` paypal/square cases are a stale parallel abstraction, not the live path. **Stripe Connect onboard** (`/api/tenants/{id}/stripe-connect/onboard`) is the primary (only one with a webhook handler + Connect service). PayPal route is **pinned to `api-m.sandbox.paypal.com`** — needs the prod endpoint for real charges. Square switches on `squareEnvironment` + platform creds and **mocks silently when creds are absent** — so per-gateway prod smoke tests are the only proof of operational readiness (package bumps may be needed — Square path already runs direct-API, no SDK)
- [ ] **Shipping settings in MC** — honest dropship delivery windows (supplier lead times, not ours)
- [ ] **Returns/refund policy page** on the storefront — GMC requires it for approval; honest dropship terms
- [ ] **MO resale certificate** under Visible Shelf LLC for tax-exempt wholesale buying; collect/remit MO sales tax
- [ ] **Order → supplier forward SOP** — manual forwarding is fine at this volume; automation later
- [ ] **Production checkout smoke test** — a real purchase end-to-end (add to cart → payment capture → order record → supplier forward → refund exercise) on `shelfvisible.visibleshelf.com` before the store is promoted; confirms gateway operational readiness, not just config presence

**Platform build item — storefront order → partner order submit (flagged 2026-10-27):** dropship needs a generic outbound fulfillment layer: order items routed to a partner (POD APIs — Printful/Printify; dealer dropship — Azar/Displays2go; print vendor — Lob) with `submitOrder → vendorOrderId → status webhook`. The shape already exists at flyer scope — `FlyerPrintProvider` (`stub`/`manual`/`lob` vendors, `tenant_flyer_card_orders` in `submitted` state, vendor status via public webhook in `public-flyer.ts`); the build is generalizing it to `inventory_items` fulfillment sources (`source_type`/`supplier_catalog_item_id` already link items to suppliers). Until it ships: manual order→supplier forwarding SOP. This is a *platform* capability — every dropship tenant wants it, this store is just the first consumer.

Content must be real — this is a customer-visible storefront and anything the GBP Suite publishes lands on the live acquisition profile (`PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.5 cadence).

## 7. Decisions & rejected alternatives

| # | Decision | Rejected | Why |
|---|---|---|---|
| D1 | New dedicated tenant | `tenants.id='platform'` sentinel; demo tenant `tid-25we5qgj` | Sentinel is platform-scope plumbing, not a storefront actor, and platform staff hold no membership row on it so standard tenant UX doesn't reach it cleanly; the demo tenant is shopper-demo inventory, not the internal dogfood |
| D2 | `is_demo=false` | demo flag | Demo tenants are `noindex`'d and excluded from sitemap/directory — this tenant is meant to be visible |
| D3 | Subdomain only | Custom domain (e.g. `shelfvisible.shop`) | Attaching a custom domain flips the canonical ladder (`custom → subdomain → path`) to a host the MC doesn't claim → GMC "mismatched domains"; fixing it would release the `visibleshelf.com` claim (the §3.3 entity-trust point) and drift the storefront away from the GBP's website field — the exact NAP drift we audit merchants for |
| D4 | `enterprise` tier | Lower rung | Playground must exercise the full capability surface; tier is cosmetic cost-wise (internal, fee-waived) |
| D5 | Slug `shelfvisible` | `visibleshelf-internal` | Redundant doubling (`visibleshelf-internal.visibleshelf.com`); `shelfvisible` matches the social handles |

## 8. Deploy procedure

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

## 9. As-built record

| Field | Value |
|---|---|
| Tenant ID | `tid-sud4ky1c` |
| Created | 2026-10-27 |
| Env | prd |
| Owner user | `uid-li9gr` (`yarlmoment@gmail.com`, PLATFORM_ADMIN → tenant OWNER) |
| Dashboard | `visibleshelf.com/t/tid-sud4ky1c` |
| Storefront | `shelfvisible.visibleshelf.com` / `visibleshelf.com/tenant/tid-sud4ky1c` |

## 10. Reusing this spec — custom tenant deploy template

For any bespoke tenant (internal, partner, showcase, migration assist):

1. **Fill the §2 field table** — the only required decisions: `name`, `slug`, `subdomain`, `subscription_tier`, `subscription_status`, `is_demo`, owner.
2. **Run §8's script** with the chosen fields — same command shape, no `--internal` for customer tenants.
3. **Decide address strategy per D3's logic** — custom domain only if the tenant owns its canonical host AND its MC (if any) claims that host.
4. **External connects are all post-create, tenant-scoped** — GBP/MC/POS are OAuth rows on the tenant; nothing in the tenant row itself references them.
5. **Gates worth checking:** slug/subdomain uniqueness (script enforces), trial limits (bypassed by direct creation), tier validity (must exist in `shared/tier-contract.json`), `is_demo` indexation consequences.
6. **Capability control is two-gated** — tier gate via `subscription_tier` → `tier-contract.json` capability modules; merchant gate via `tenant_feature_overrides_list`, `tenant_feature_flags_list`, `tenant_feature_purchases` (org-level: `feature_overrides` + `feature_override_details`). A custom deploy can open the tier and still shape features per-tenant.
