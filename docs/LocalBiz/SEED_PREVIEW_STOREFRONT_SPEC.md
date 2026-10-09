# Seed Preview Storefront — Spec

Status: draft rev 7 (design only — no implementation yet). §11 is the gap register.
Date: 2026-10-08
Related: `AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md` (§12 anchors/ammunition), `mkt_outreach_anchors`, `outreach_problems` audit contract, migration 230 seed↔campaign links, migration 309 (campaign playbook decision), the PB-08 Website Acquisition & Build playbook (migrations 303–305, 318).

## 0. Revision log

Rev 2 closed the first review (G1–G7). Rev 3 added the free product allowance (G8). Rev 4 narrows the preview to PB-08 and sets the rules for the free slots (G9–G12). Rev 5 makes the free slots a claim incentive (G13), which supersedes the parts of G8, G10, G11, and G12 that assumed slots were live on unclaimed seeds. Rev 7 ran the code verification pass: corrected the storefront URL (`/shops/[slug]`, not `/retail/[slug]` — that page is the claim-token-gated preview), added C-7–C-12 (slug resolution, purchase-driven renewals, MV semantics, closed-preview rendering, column constraints, banner plumbing), resolved B-7/B-8/D-8's column question, and added B-11 (conditional noindex — `shops/[slug]` has none) and B-12 (`is_demo` gates on tenant-scanning jobs, owner directive).

| # | Gap | Resolution |
|---|---|---|
| G1 | Preview tenants could enter the public directory (`directory_visible` defaults true). | §3 step 5 and §7: `directory_visible = false` set explicitly on every preview, with a test. |
| G2 | Generated products went live as if they were the shelf. | §5: sample labeling, `noindex`, banner. |
| G3 | The generic grocery catalog doesn't match an African grocer; showing it is a category mismatch. | §5: sample items are labeled. The verified-first ordering was superseded by G11 and G13. |
| G4 | Hours were pulled from the listing without a source. | §3 step 2: hours included only when sourced. |
| G5 | A preview and the owner's claimed tenant could both exist for one business. | §6a: claim archives the preview; nothing is merged. |
| G6 | `storefront` tier key and `demo_template` type were unverified. | §3 step 4 and §10: `omnichannel` decided; `seed_preview` added to the `DemoTemplate` union. |
| G7 | No measurement. | §6b. |
| G8 | Every seed has 5 free product slots, which the spec did not account for. | §5c: the slots exist on every seed, not only claimed ones. |
| G9 | The preview was offered for every seed, but it is a PB-08 (website gap) artifact. | §3 step 0 and §4: eligibility is server-enforced. Only PB-08 seeds can create a preview. |
| G10 | Free slots on unclaimed seeds could be filled with invented products. | §5c: a slot publishes only with a source row, the same rule as hours. |
| G11 | A preview and a seed's own slots could show two different catalogs for one business. | §5d: the preview shows verified slots first, then labeled samples. |
| G12 | The claim hand-off made the owner re-pick products that were already on the seed. | Superseded by G13: nothing is on the seed before claim, so the owner enters up to 5 products at claim. |
| G13 | The 5 free slots are a claim incentive, so unclaimed seeds must not publish them. | §5c: slots unlock on claim and are owner-entered. §5d: the pre-claim preview is sample-only. §6a: the owner adds up to 5 products at claim. |
| G15 | Two publication paths (seed and demo) were described separately, with inconsistent end-state language ("archived," "retired," "closed"). | §1b: a rendering table with each path's gate and end state. §6a: claim retires the preview, the same as expiry. |
| G16 | Retirement said "deleted or inactive" for products, but the product lifecycle has defined states (`item_status`, `item_visibility`). | §5e: each rendering path maps onto the lifecycle. Retirement sets sample products to `archived` and `private`. Drafts are `inactive`. |
| G17 | Open problems from the final gap review were not verified. | §11: each is now closed (verified), a build task, or a decision. |
| G14 | Pre-claim publication was framed as a write-path problem. The operator controls the seed and its tenant before claim, so writes can't be the control. | §2 item 8 and §7: publication is gated on claim, which is the control transfer. Pre-claim writes are operator drafts. §10 item 9 makes the public-query check a required gate. Previews have no owner and rely on labeling, `noindex`, expiry, and the checkout guard. |

## 1. Thesis

The audit's Outreach Ammunition produces `problem → hook → fix` kits whose **fix column frequently describes the platform's own product**. Example from `dps-329R` (Arsema Food Mart):

> Problem: no owned website — only a free Square storefront page — so nothing ranks for the items the store sells.
> Fix: "Build a small owned site that lists the store's product categories with a stock-check or reserve-for-pickup path…"
> Evidence names the exact searches: "teff flour Indianapolis", "berbere".

Today the operator quotes that fix verbally on the call. The stronger move, for PB-08 prospects only: **generate the fix as an artifact** — a preview storefront built from the seed's verified data — and put the URL in the outreach. The preview is labeled as a sample, so it demonstrates the fix without claiming the business's shelf or inventory.

## 1b. Rendering paths for prospects

Products reach a public page through two paths. Each has its own gate and its own end state.

| Path | Tenant | Product state before claim | Gate | Ends by |
|---|---|---|---|---|
| 1. Seed | Seed tenant (operator-controlled until claim) | Operator drafts, not public | Public only after claim (control transfers to owner; `org_standing_mode` `directory_seed` → `independent`) | Claim makes the products public. The tenant stays live with the owner. |
| 2. Demo | Preview tenant (`demo_template = 'seed_preview'`, no owner) | Sample products, public while the preview is active | Labeled sample, `noindex`, 14-day expiry, checkout guard (§5b, §7) | Retired on claim, or retired on expiry. Retirement sets `location_status = 'closed'`, `directory_visible = false`, and sample products `archived` with `item_visibility = private` (§5e). |

Only Path 2 publishes products before claim, and it does so by design. Path 1 publishes nothing before claim. This section governs §5c (slots, Path 1) and §5 and §6a (previews, Path 2).

## 1a. Scope

- **Preview:** PB-08 seeds only (§3 step 0). It is a website-gap artifact.
- **Free product slots:** a claim incentive. Up to 5 display-only products unlock on the `directory_presence` tier when the owner claims the seed. Unclaimed seeds publish none (§5c).

## 2. Existing machinery (reuse inventory)

| Piece | Where | Role in this feature |
|---|---|---|
| `DemoTenantService` | `apps/api/src/services/DemoTenantService.ts` | Tenant creation, `is_demo`/`demo_expires_at`/`demo_source_tenant_id`/`demo_template` columns, expiry/convert/delete/list/revoke APIs (verified) |
| `generateQuickStartProducts` | `apps/api/src/lib/quick-start.ts` | Scenario-catalog generation (`SCENARIOS`: `grocery`, `fashion`, `general`, `restaurant`, `service_business`), `createAsDrafts`, `storefrontType` aware (verified) |
| Demo expiry job | `apps/api/src/jobs/demo-tenant-expiry.ts` | Sweeps `demo_expires_at <= now()` → `expireDemoTenant` (`location_status='closed'`, `directory_visible=false`, verified) |
| Admin demo routes | `apps/api/src/routes/admin/demo-tenants.ts` | Existing CRUD surface. The `createFromSeed` route goes under `directory-presence-admin.ts` |
| Seed tenant | `directory_presence_seeds.tenant_id` | Provenance anchor for `demo_source_tenant_id`, and the tenant that carries the free slots |
| Slug | `SlugSingletonService.generateSlug` (verified) | Preview slug from the seed's city and state |
| Public storefront | `/shops/[slug]` (verified) | The shareable preview URL. `/retail/[slug]` is NOT the storefront — it is the claim-token-gated claim preview (`?preview=<token>`). Slug resolution (`UniversalIdentifierCache.resolveIdentifier` → `StoreService.getStoreByIdentifier`) hits `tenants` directly with no directory gate, so a `directory_visible=false` preview resolves fine |
| Storefront MV | `mv_storefront_discovery` (verified) | Drives the shop page's products. Gates only on `location_status='active'` + `item_status='active'` + `visibility='public'` — demo tenants are included by design ("storefront product visibility is independent of directory visibility"). `mv_global_discovery` DOES filter `directory_visible=true`, so previews are isolated from cross-tenant discovery for free |
| MV refresh | `POST /api/cache/refresh-mv` (verified) | On-demand only — no scheduled job refreshes `mv_storefront_discovery`, and `generateQuickStartProducts` refreshes only `storefront_category_counts`. Both create AND retire paths must trigger the refresh or the preview is stale/empty |
| Ammo cards | `apps/web/src/components/marketing-ops/OutreachProblemsSection.tsx` | Where "the fix" text already renders. Optional action slot |
| `OutreachAmmunitionEntry` | `CallScriptService` assembled payloads | Already carries `solution` text to both script surfaces |
| Tier limits | `apps/api/src/utils/tier-limits.ts` | `directory_presence.maxSkus = 5` (verified) |

### What's missing (the build)

1. `createDemoTenant` is template-generic: hardcoded "Demo Grocery Store", `+1-555`, "New York". `CreateDemoTenantOptions` overrides only `businessName` and `subdomain`.
2. `generateQuickStartProducts` accepts no custom-product knob. Audit-named items can't be injected.
3. No link from seed to demo tenant. `demo_source_tenant_id` exists but nothing sets it.
4. `DemoTemplate` is `'grocery' | 'convenience' | 'specialty_retail'`. `'seed_preview'` must be added.
5. `createDemoTenant` does not set `directory_visible`, and the schema default is `true` (verified). Every preview must set it to `false` explicitly.
6. `routes/checkout.ts` has no demo guard (verified). See §5b.
7. The product provenance key does not exist yet. Free slots need one (§5c).
8. **Control model and publication gate.** The operator creates and controls the seed and its tenant until claim. Control transfers to the owner at claim (`org_standing_mode` moves from `directory_seed` to `independent`, per the seed-claim skill). Pre-claim product writes are therefore operator drafts, and they are not public. Public product publication follows control: products are off before claim and on after claim. The public product queries must enforce that gate. Verification result (§11, item C-2): the public product query (`apps/api/src/routes/public-catalog.ts`, reading `mv_storefront_discovery`) filters on `item_status = 'active'` and `visibility = 'public'` only. It has no claim condition, so Path 1 is not gated today. Build item B-2 adds the write-side rule. Products default to `item_status = active` in the schema, so pre-claim operator drafts must be written as `inactive` (§5e).
9. **Retirement is not implemented.** `expireDemoTenant` updates only the tenant row (verified). Product retirement (§5e) must be added, and `mv_storefront_discovery` must refresh, because the public query reads the view's snapshot (§11, B-1).

## 3. Design — `DemoTenantService.createFromSeed(seedId, options?)`

New method that mirrors `createDemoTenant` but builds the config from the seed and listing instead of `DEMO_TEMPLATES`.

```
Input:  seedId, options { productCount?, expiresAt?, scenario? }
Output: { tenantId, slug, storefrontUrl, productsCreated, categoriesCreated, expiresAt, existing }
```

Steps:

0. **Eligibility (G9, D-8 decided).** The seed is eligible when at least one linked campaign (`directory_seed_campaign_links`, any role) carries a **confirmed** PB-08 decision — `mkt_campaigns_list.playbook_decision ->> 'kind' = 'website_build_scope'` (migration 309 JSONB payload; verified column, operator-ratified not merely detected). `playbook_code = 'PB-08'` alone (assignment/detection) is NOT sufficient — the preview is a commitment artifact. If no linked campaign has the confirmed decision, return `409 not_pb08_eligible`. There is no operator override in v1. This check runs server-side before any tenant is created.
1. Load the seed, the `directory_listings_list` row (joined on `listing_id`), and the latest linked-campaign audit (`directory_seed_campaign_links` → `getLatestAuditData`, the same resolution `assembleForSeed` uses).
2. Build `SeedPreviewConfig`:
   - `name` ← seed business name.
   - `city`, `state`, `country`, `address_line1`, `postal_code`, `phone` ← listing NAP, with the same verified-field rule as the seed. Fields not verified are left empty.
   - `hours` ← the seed's sourced hours only. If hours are not sourced, the preview shows "Hours not yet confirmed" (§7).
   - `gbp_primary_category_id/name` ← seed category.
   - `scenario` ← `mapSeedCategoryToScenario(seed.category)` with a `general` fallback. `'African Grocery Store'` → `grocery`, `'Fashion Boutique'` → `fashion`.
   - `subscriptionTier: 'seed_preview'`, a dedicated tier key with an explicit feature list (§5f). It shows the full and deposit checkout paths (§5b) and nothing else.
   - `storefrontType: 'retail'`.
3. `SlugSingletonService.generateSlug(name, {city, state, country}, tenantId)`.
4. `tenants.create` with:
   - `is_demo: true`
   - `directory_visible: false` (G1, explicit)
   - `demo_expires_at` = 14 days by default (D-4: extendable — `POST /presence-seeds/:id/demo-storefront/extend` adds +7 days per call, max 2 extensions, hard cap 28 days; the response includes `expiresAt` and `extensionsUsed`)
   - `demo_source_tenant_id = seed.tenant_id`
   - `demo_template = 'seed_preview'` (varchar(50), unconstrained — verified)
   - `subscription_tier = 'seed_preview'` is schema-safe: the column is a free-form `String?` with no check constraint (verified)
5. `seedBusinessProfile` variant that takes explicit NAP fields. Shared private helper with the template-config version. Do not pass a `DEMO_TEMPLATES`-shaped object through.
6. `generateQuickStartProducts({ tenant_id, scenario, productCount, assignCategories: true, createAsDrafts: false, generateImages: false, storefrontType: 'retail' })`. Products are sample data (§5). The public page labels them.
7. **Refresh `mv_storefront_discovery`** (`REFRESH MATERIALIZED VIEW CONCURRENTLY` — verified: refresh is on-demand only, no scheduled job, and quick-start does not refresh this view). Without this step the preview URL renders an empty storefront. Runs after commit — `CONCURRENTLY` cannot run inside a transaction.
8. Return `{ tenantId, slug, storefrontUrl: '/shops/' + slug, … }`.

### Idempotency

One live preview per seed. Before creating, look up `tenants` where `demo_source_tenant_id = seed.tenant_id AND is_demo = true AND location_status = 'active'`. If found, return it with `existing: true`. Expired or closed previews don't block a fresh one.

## 4. Route and UI

**Route:** `POST /api/admin/directory-presence/presence-seeds/:id/demo-storefront` (staff-gated, `requirePlatformStaff`, next to the existing anchor and script routes in `directory-presence-admin.ts`). Returns `409 not_pb08_eligible` for other seeds (§3 step 0). `POST .../demo-storefront/extend` for the capped extension (D-4).

**Campaign-side trigger (D-5 decided — in v1).** A PB-08 campaign's Openers workspace gets the same generate action, resolving `campaign → directory_seed_campaign_links → seed` (`resolveCampaignSeedId`-style, preferring the primary link) and calling the same service method. The route stays seed-scoped; the campaign surface calls it through its resolved seed.

Response:

```json
{ "tenantId": "ten-…", "slug": "arsema-food-mart-indianapolis-in",
  "storefrontUrl": "/shops/arsema-food-mart-indianapolis-in",
  "productsCreated": 20, "expiresAt": "…", "existing": false }
```

**Seed page UI.** The preview action appears only on PB-08-eligible seeds, under the "Audit ammunition" section. Other seeds do not show it.

- No live preview: "Generate preview storefront" button. Success state shows the URL, an "opens the storefront" link, and a copy button.
- Live preview exists: show the URL, a countdown ("preview expires in 9 days"), a Regenerate button (retires the old preview, then creates a new one), and an Expire now button.
- The UI shows the sample-data label before the operator copies the link, so the operator knows what the prospect will see.

**Optional phase-2 sugar:** `OutreachProblemsSection` gets an optional `onGenerateFixDemo` callback. When a PB-08 problem's `solution` text matches an owned-site pattern, the card shows "Generate preview storefront →". Deliberately phase 2. Pattern-matching fix text is fragile, and the section-level button delivers the same loop.

## 5. Catalog and labeling (G2, G3)

**Publication rule.** Every preview is a sample, labeled as one:

- The public page shows a banner: "Preview — sample catalog built from public listing data. Not this business's inventory." It can be dismissed, but it is shown on first load for each visitor. The public tenant-info payload already returns `isDemo`/`demoExpiresAt` (verified in `routes/public/tenants.ts`), so the banner needs no API change.
- Sample products carry a sample flag and a "Sample" badge.
- `noindex` must be conditional: `shops/[slug]/layout.tsx` sets no robots tag (verified — the earlier note cited `retail/[slug]`, which is the wrong page). A blanket `noindex` on `shops/[slug]` would deindex every real tenant's storefront, so `generateMetadata` sets `robots: { index: false }` only when the resolved tenant `is_demo` (B-11). Sitemap exclusion: confirm `shops` pages aren't in the sitemap source for demo tenants.
- The preview is never linked from `/place` or the directory. It is reachable only by its URL, and its products stay out of `mv_global_discovery` (that view filters `directory_visible=true`) while appearing on the shop page via `mv_storefront_discovery` (no directory filter — verified).

**MVP catalog.** The scenario-mapped sample catalog, with `productCount` around 20 and `generateImages: false`. For an African grocer, the `grocery` scenario is generic. That is acceptable only because the banner and badges say it is a sample. The preview must not show audit-named items as stocked, because that would be a claim about the shelf.

**Phase 2: audit-driven product hints.** The ammunition's evidence fields name real products ("teff, berbere and injera"). Extract candidates from `outreach_problems[].evidence` and `problem`, but only where the item is backed by verified evidence (owner-confirmed, or observed on a verified page). Pass them as `catalogHints: string[]` on `QuickStartOptions`, and have the generator place them first. Unverified items never enter the catalog.

## 5b. Checkout demo (Omnichannel, sandbox only)

The preview runs on the dedicated `seed_preview` tier (§5f), which mirrors the Omnichannel commerce surface so the prospect can see it: add to cart, full payment, and deposit checkout with the holding-fee explanation. Checkout is a demonstration, not a transaction.

**Hard rule: no real payment is ever taken on a preview.** A preview is a public page under the business's name, but it has no owner authorization for sales. A prospect who completes checkout must not pay the business, and no order is created for it.

**Primary control: module gating.** The payment gateway is a capability module, `payment_gateway_options`, with its own keys (verified). `resolvePaymentGateway` returns no gateway when the tier lists no `payment_gateway_*` key, and `payment_gateway_disabled` overrides any enabled key (verified in `PaymentGatewayResolver.ts`). So the `seed_preview` tier can show the commerce UI through the commerce module (`commerce_enabled`, `commerce_full_payment`, `commerce_deposit_only`) while the payment module supplies no processor. The sandbox is then a property of configuration, not of route code.

This control is only as good as the route that consumes it. `routes/checkout.ts` does not call `resolvePaymentGateway` (verified). It reads `tenant_payment_gateways` and defaults to `paypal` when no method is given (verified at lines 799, 821, 962). Until B-9 is built, the route can reach a processor without consulting the module. That is why the demo-tenant check below stays as a second guard.

**Secondary guard.** The server short-circuits for any tenant with `demo_template = 'seed_preview'`, before any payment intent or charge is created. This stays until B-9 and B-10 are done and tested.

Required behavior:

- **Server-side guard.** `routes/checkout.ts` currently has no demo guard (verified). It routes the payment through the tenant's gateway with no check on `is_demo` or `demo_template`. The preview path must short-circuit before any payment intent or charge is created, for any tenant with `demo_template = 'seed_preview'`. The guard lives on the server, not in the UI.
- **Sandbox response.** The checkout flow runs through the UI as normal. At the payment step, the preview shows: "Demo checkout. No payment is taken and no order is placed." The guard returns a sandbox response, and no order row is written.
- **Deposit demo.** The deposit path shows the holding-fee explanation as text. It shows no real fee amounts or policy terms for the business, and it is labeled as a sample policy.
- **Sample prices.** Sample products carry "Sample price" labels. Owner-entered products have no price unless the owner supplies one with a source row. The checkout total is labeled as a sample total.
- **Tier honesty.** The preview banner states that the commerce features shown are part of a Commerce plan, not the plan the prospect would start on. The claim offer names the tier separately (§10 Q5).

## 5c. Free product slots on every seed (G8, G10)

The free slots are a claim incentive. A claimed seed runs on the `directory_presence` tier, which allows 5 products on its public page. The limit is `TIER_LIMITS.directory_presence.maxSkus = 5` in `apps/api/src/utils/tier-limits.ts` (verified), and a test enforces it (`product-routes-sku-limits.test.ts`). Unclaimed seeds publish no products. The owner unlocks the slots by claiming the listing. Operator drafts on an unclaimed seed are written as `item_status = inactive`, and claim moves the owner's published products to `active` (§5e).

**Evidence rule.** A slot publishes only with a source row, the same rule as hours. At claim, the owner enters each product. That entry is owner-confirmed by definition, so it carries its own source row. Before claim, nothing is published, so no product is sourced from scan or scenario data for a seed.

A slot with no source row is not published. No product is created from a category scenario for a seed's own slots. Scenario catalogs are used only by the preview (§5).

**Provenance.** Add a `products` provenance key to the seed's provenance table. Each slot records the product name, source platform, source URL, and `as_of`. The public page shows a slot only when its provenance row has `show_on_public = true`, the same gate as name and address. Products are published only after the claim, so this gate is never met before claim.

**Display only.** The free tier has no checkout. The claim offer says so. Checkout and deposit are Commerce features (§5b).

## 5d. How the preview and the slots relate (G11)

Before claim, a PB-08 seed has no published products, so the preview shows sample items only, all labeled "Sample." The preview never reads from the seed's slots, and no seed slot can appear in it. The preview is the demonstration of what the owner can do after claim, and it is clearly marked as a demonstration.

Note on ordering: the G11 "verified first" rule applied to a state that cannot occur before claim, so it is removed.

## 5e. Product lifecycle alignment (G16)

Products carry two lifecycle fields, both already in the schema (verified):

- `item_status`: `active`, `inactive`, `archived`, `trashed` (default `active`).
- `item_visibility`: `public`, `private`.

`generateQuickStartProducts` already maps drafts to `inactive` (`createAsDrafts`), so `inactive` is the platform's draft state.

Each rendering path maps onto these states:

| Event | Seed-path products (Path 1) | Preview products (Path 2) |
|---|---|---|
| Created as operator draft | `item_status = inactive`, `item_visibility = private` | n/a |
| Created as sample | n/a | `item_status = active`, `item_visibility = public` while the preview is live |
| Owner claims the seed | Owner's products: `item_status = active`, `item_visibility = public` on publish | Sample products: `item_status = archived`, `item_visibility = private` |
| Preview expires | n/a | Sample products: `item_status = archived`, `item_visibility = private` |
| Operator deletes a draft | `item_status = trashed` | `item_status = trashed` |

Rules:

- **Archive, not trash, for retirement.** `archived` keeps the record for audit. `trashed` is reserved for operator deletions of drafts that were never shown.
- **Archive in the retirement transaction; refresh the MV after commit.** `REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot run inside a transaction block (Postgres), so the flow is: transaction archives tenant + products → commit → `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_storefront_discovery`. The public query reads the MV snapshot, so the refresh is what makes retirement visible — and the same refresh is required on create for the products to appear at all (§3 step 7).
- **Publication needs both gates.** A product renders publicly only when its tenant is claimed (Path 1) or active (Path 2), and its `item_status` is `active` and `item_visibility` is `public`. Verification of the public query is §10 item 9.
- **Quick-start randomness.** When `createAsDrafts` is false, `generateQuickStartProducts` sets about 25% of items to `inactive` at random (verified). A preview catalog of 20 therefore shows about 15 active items. The preview needs either a deterministic all-active option or an accepted mix (§10 item 10).

## 5f. Demo tier: a dedicated `seed_preview` key

**Proposal:** a dedicated tier key, `seed_preview`, whose feature list is written out explicitly. It mirrors the Omnichannel storefront and commerce capabilities, and it switches on only what the demo needs.

**Why a dedicated key and not Omnichannel:**

- Capability resolution is most-permissive-wins (`EffectiveCapabilityResolver`, per the strategy doc). On Omnichannel, an override can't remove a feature. Only a tier whose list leaves the feature out removes it. "Omnichannel minus X" therefore needs a tier of its own.
- A dedicated key is never sold. It is not a subscription, and billing can exclude it by key (this makes B-7 a key check, not a flag check).
- The demo's switches live in one place: the `tier_features_list` rows for the key.

**What gating does and does not do.** Gating by tier configuration is the feature control: a key the configuration excludes is not available, and the tier cannot leak features it does not list. The one thing gating cannot express is a sandbox. A checkout key that is enabled takes real payment, because the architecture has no "enabled but sandboxed" state. So the §5b guard is the sandbox mechanism that turns an enabled checkout into a demonstration. It is not a defense against feature leaks.

**Two rules that keep the gating sound:**

- **No `_flexible` key in the `seed_preview` list.** A module's flexible key expands to every feature in its capability type (verified in the strategy doc's three-source table). If the tier exposes a flexible key, the tier leaks the whole module. The tier test asserts that the list is an explicit set of plain feature keys.
- **Resolution is a union across three sources.** Tier, BSaaS purchases, and admin grants are all merged, most-permissive-wins. The demo tenant must have no `tenant_feature_purchases` rows and no `tenant_feature_overrides_list` rows, or a stray grant would widen the demo. A test asserts both tables are empty for the preview tenant.

**Proposed feature set** (product to finalize the exact list):

- Storefront: retail storefront, product browse, gallery, hours, maps.
- Commerce: add to cart, full payment, and deposit checkout. These are the switches the demo exists to show, and the sandbox rule in §5b applies to them.
- Directory: directory entry and storefront QR (demo scope only).
- Excluded: Google SWIS and integrations, platform services, CRM beyond the demo's contact button, chatbot, and organization features.

**Required changes:**

- Add `seed_preview` to the `SubscriptionTier` type and to `TIER_LIMITS` in `apps/api/src/utils/tier-limits.ts`. Set `maxSkus` to the demo catalog size (about 20).
- Add the `tier_features_list` rows through a migration under the SOP.
- Update `.devin/skills/tier-hierarchy.md` and `FEATURE_TIER_MAP`. The strategy doc says these must stay in sync, and I have not checked them yet.
- Keep the key out of tier pickers, Stripe price maps, and upgrade UIs.

**Module configuration for the demo tier.** Commerce modules on: `commerce_enabled`, `commerce_full_payment`, and `commerce_deposit_only`. Payment gateway module off: no `payment_gateway_*` key, plus `payment_gateway_disabled` as an explicit off switch. The explicit off switch matters because the resolver lets it override any enabled key, so a stray grant (§5f, union rule) can't turn a processor on. Fulfillment keys stay off unless the demo needs a pickup path. The `*_flexible` keys in all three modules stay out, since each expands to its whole module (`payment_gateway_flexible` expands to all four gateways).

**Fallback:** if a dedicated key is too heavy, keep Omnichannel and rely on the server guard in §5b. That works, but it shows every Omnichannel feature rather than the chosen set.

## 6. Public presentation and claim path

- The preview's `/shops/[slug]` page renders as a normal storefront with the seed's name, address, and phone. Hours appear only when sourced. The sample banner and conditional `noindex` apply as in §5.
- The banner is shown when `tenants.is_demo` is true, read server-side. The public tenant-info payload already returns `isDemo`/`demoExpiresAt` (verified). Scope: `apps/web/src/app/shops/[slug]/`.
- **Closed-preview rendering (B-8, verified).** `shops/[slug]/page.tsx` routes `locationStatus !== 'active'` to `StorefrontStatusPanel`, and `getStoreByIdentifier` requires `subscription_status = 'active'` — `expireDemoTenant` sets it to `cancelled`. A retired preview stops serving at both levels once `mv_storefront_discovery` refreshes.

### 6a. Claim path (G5, G12)

On owner claim of the seed, the preview is retired, not merged. Retirement is the same end state as expiry (Path 2 in §1b):

1. `expireDemoTenant(previewTenantId)` closes the preview and sets `directory_visible = false`. Claim calls it synchronously from `DirectoryClaimService.acceptClaim` (verified at line 881). Expiry runs hourly through `demo-tenant-expiry` (verified in `apps/api/src/index.ts`), so an expired preview can stay live for up to an hour unless the expiry job also retires products (B-1).
2. The preview's sample products are set to `item_status = archived` and `item_visibility = private`, in the same transaction as the tenant retirement — then `mv_storefront_discovery` refreshes after commit (§5e; `CONCURRENTLY` can't run inside a transaction).
3. The owner adds up to 5 products during claim. Each one is entered by the owner and is owner-confirmed. Nothing from the preview carries over, and nothing is published before claim.
4. The claimed tenant is the real business record. It doesn't adopt the preview's sample catalog.

Phase 2 (not MVP): an owner-review step for keeping individual sample items.

Note: `revokeDemoStatus` alone is not enough. It leaves the preview live with `directory_visible` still true and the sample products in place, so the claim must call `expireDemoTenant` first.

### 6b. Measurement (G7)

- Log a touch on the seed when a preview is generated: channel `other`, notes `preview_storefront_generated`, with the preview tenant ID.
- Track preview opens from the public page view, keyed by the preview tenant.
- Log a claim event when the seed is claimed, with the retired preview's tenant ID, so preview-to-claim can be measured.

## 7. Safety

- **Zero writes to the real listing.** The preview is a separate tenant. `directory_presence_seeds`, `directory_listings_list`, and `/place` are untouched.
- **PB-08 only.** The server rejects previews for any other seed (§3 step 0).
- **Not in the directory.** `directory_visible = false` is set explicitly on creation, and a test asserts it (§8).
- **No invented facts.** NAP comes from the seed's verified listing. Hours appear only when sourced. Sample items are labeled. Verified slots need a source row. A preview never states an inventory claim.
- **Noindex and no sitemap.** The public page is excluded from search and sitemaps.
- **Slots are a claim incentive.** Unclaimed seeds publish no products. The owner unlocks the 5 slots by claiming.
- **Control model.** Before claim, the operator controls the seed, its tenant, and any drafts. At claim, control transfers to the owner, and public product publication follows control.
- **Previews have no owner and publish sample products by design.** Their safety rests on the sample labeling, `noindex`, the 14-day expiry, and the checkout guard in §5b. Claim status does not apply to previews, so none of these controls depend on it.
- **Self-expiring.** 14 days by default, through the existing `demo-tenant-expiry` job. Expiry sets `location_status='closed'` and `directory_visible=false`.
- **No real payments.** The checkout guard in §5b blocks payment creation for every `seed_preview` tenant on the server. This is a hard requirement, not a UI choice.
- **Distinguishable.** `demo_template = 'seed_preview'` separates prospect previews from sales demos in `listDemoTenants` and in analytics.
- **No duplicate after claim.** The claim retires the preview (§6a), so one business has one live public tenant.

## 8. Test plan

Unit tests for `DemoTenantService.createFromSeed` (mock prisma, same pattern as `ManualOutreachAnchorService.suggestVariants.test.ts`):

- A non-PB-08 seed is rejected with `not_pb08_eligible`, and no tenant is created (G9).
- Config is assembled from seed and listing NAP, not template defaults.
- Hours are omitted when not sourced, and included when sourced.
- Category to scenario mapping, including the `general` fallback.
- `directory_visible` is `false` on the created tenant (G1).
- `noindex` is set on the public page configuration (G2).
- Before claim, the preview reads no seed slots, and all preview items are labeled "Sample" (G11).
- Idempotent: a second call returns `existing: true`.
- An expired prior preview doesn't block a fresh one.
- `demo_source_tenant_id` is the seed's tenant, `demo_template = 'seed_preview'`, expiry 14 days.

Free-slot tests (G8, G10, G13):

- An unclaimed seed publishes no products. Operator drafts written to an unclaimed seed's tenant are not returned by the public product queries. After claim, the same products are returned.
- After claim, a product with a provenance row and `show_on_public = true` is published.
- A claimed seed's products are capped at 5.
- No scenario catalog is written to a seed's own slots.

Checkout guard tests (must pass before any preview ships):

- A checkout request on a `seed_preview` tenant creates no payment intent and no charge (asserted against the payment gateway mock).
- The same request returns the sandbox response, and no order row is written.
- Deposit and full-payment paths are both covered.
- A non-preview tenant's checkout is unchanged.

Claim-path tests:

- Claim archives the preview: `expireDemoTenant` is called, `directory_visible` becomes `false`, and sample products are removed or inactive (G5).
- Claim lets the owner add up to 5 products, each with a provenance row, and does not copy sample items (G12, G13).

Product lifecycle tests (G16):

- Operator drafts on a seed are written as `inactive` and `private`, and are not returned by the public product query.
- Claim moves the owner's published products to `active` and `public`.
- Preview expiry and claim both set sample products to `archived` and `private`, in the same transaction as the tenant retirement.
- A closed preview returns no active products.
- Retirement never sets `trashed`.

Route tests:

- 401 and 403 without staff.
- 201 on a happy-path create for a PB-08 seed.
- 409 `not_pb08_eligible` for a non-PB-08 seed.
- 200 with `existing: true` on a repeat call.

Also `pnpm checkapi` and `pnpm checkweb`.

## 9. Out of scope (v1)

- Image generation for demo products.
- `catalogHints` audit-product injection (phase 2).
- Claim-side selective keeping of individual sample items (phase 2).
- Ammo-card `onGenerateFixDemo` inline action (phase 2).
- Prospect-facing signup conversion metrics on the preview page beyond the logging in §6b.
- Operator override of the PB-08 eligibility gate.

## 10. Decisions and open questions

Decided (rev 2 and rev 4 defaults, reviewable):

- Sample products are labeled live on the preview. Alternative: keep them as drafts. Recommendation: labeled live, so the storefront demonstrates the fix.
- Previews are `noindex`, excluded from sitemaps, and never linked from `/place`.
- Claim archives the preview. Nothing from the preview is merged. The owner adds up to 5 products at claim.
- Hours are sourced-only.
- Previews are PB-08 only, enforced on the server.
- The 5 free product slots are a claim incentive. Unclaimed seeds publish none, and claimed owners enter their own products (G13).
- The preview's tier is the dedicated `seed_preview` key (§5f), which lists the demo's features explicitly. `omnichannel` is the documented fallback if a dedicated key is too heavy.

Still open:

1. **Source of the preview.** Should the preview use the seed's tenant (`demo_source_tenant_id`) or enrich the seed's own tenant? Option A was rejected for v1 because it risks the real listing. Rev 4 keeps a separate demo tenant.
2. **Feature gates on the preview tier — DONE (migration 321).** `subscription_tiers_list` + `tier_features_list` rows for `seed_preview` — the explicit §5f feature set (retail storefront, gallery, hours, maps, commerce enabled/full/deposit, `payment_gateway_disabled` as the hard off-switch, directory entry + storefront QR). No `*_flexible` keys. Verified against prod: `mv_tenant_effective_capabilities` doesn't filter tier `is_active`, so `billing_type='none'` + `price_monthly=0` keeps the key out of paid pickers while features still resolve. Apply migration 321 to staging + prod like 319/320.
3. **Campaign-side generation — DECIDED (D-5): in v1.** The PB-08 campaign's Openers workspace triggers the same route via its linked seed.
4. **Preview expiry — DECIDED (D-4).** 14 days base + capped extension: +7 days per call, max 2 extensions, hard cap 28 days.
5. **Honesty labeling for the claim offer — DONE.** The claim success copy names "Directory Presence", states "5 free product slots", and now says the free listing's products are "display-only (no checkout)". The upgrade teaser already says "checkout arrives with Commerce tiers". Banner wording still warrants a final read (D-2).
6. **Documentation conflict on directory_presence limits — DONE.** Code (5) confirmed as source of truth. `.devin/skills/directory-presence-seed-claim/SKILL.md` now reads `max_skus: 5` with the claim-incentive/migration-319 note; `PLATFORM_STRATEGY_V3.1_DEPTH_RUNGS.md` carries a dated "Shipped correction" note pointing at the operational values.
7. **Products provenance key.** Confirm the field name and the source types allowed for claimed-seed products (§5c). Owner entry at claim counts as owner-confirmed, so the pre-claim definition question no longer applies.
8. **PB-08 eligibility — column verified, strictness open.** `mkt_campaigns_list.playbook_code = 'PB-08'` is the field (varchar, verified; `MarketingCampaignService` treats it as definitive). Open choice: any linked campaign with the code, or the stricter confirmed `playbook_decision` row. Tracked as D-8.
9. **Publication gate (required before any preview ships).** Verify that the public product queries filter on claim (`org_standing_mode = 'independent'` or the seed's claimed status). If they don't, add the gate. Pre-claim drafts must stay private.
10. **Sample catalog status mix.** Choose between a deterministic all-active option for the preview catalog (new option on `generateQuickStartProducts`) or accepting the roughly 25% inactive mix. The all-active option is recommended, because an inactive item in a demo looks like a broken storefront.

## 11. Gap register (rev 6)

Each open problem from the final review, with its status. **Closed** means verified in code. **Build** means a task with an owner. **Decision** means a product call.

### Closed (verified)

| Item | Finding | Evidence |
|---|---|---|
| C-1 Seed tenant exists before claim | Seed tenants are real tenant rows, created and controlled by the operator until claim. | `.devin/skills/directory-presence-seed-claim/SKILL.md` |
| C-2 Public product gate | The public query filters on `item_status` and `visibility` only. It has no claim condition, so Path 1 is not gated today. Moved to B-2. | `apps/api/src/routes/public-catalog.ts` (`mv_storefront_discovery`) |
| C-3 `noindex` mechanism | NOT covered — `shops/[slug]/layout.tsx` sets no robots tag (the earlier note cited `retail/[slug]`, which is the claim-preview page, not the storefront). Conditional `noindex` when `is_demo` is a build item (B-11). | `apps/web/src/app/shops/[slug]/layout.tsx` |
| C-4 Claim hook | `DirectoryClaimService.acceptClaim` is the function to call for retirement. | `apps/api/src/services/DirectoryClaimService.ts` line 881 |
| C-5 Expiry schedule | Runs hourly. Retirement can lag by up to one hour. | `apps/api/src/index.ts` line 148 |
| C-6 Preview tenant has no owner | No owner exists until claim, and sample products publish by design (Path 2). | §1b, §7 |
| C-7 Slug resolves for non-directory tenants | `UniversalIdentifierCache.resolveIdentifier` → `tenants` by id/slug, no directory/`is_demo` gate. A `directory_visible=false` preview resolves on `/shops/[slug]`. | `apps/api/src/services/UniversalIdentifierCache.ts` |
| C-8 Renewal jobs are purchase-driven | `bsaas-renewal`, `featured-placement-renewal`, `promotion-renewal` iterate purchase tables — a preview with no purchase rows has nothing to renew. `subscription-grace-period` scans `subscription_status='past_due'` (unreachable without a payment failure); `monthly-fee-summary` iterates `merchant_stripe_connections` `onboarding_status='completed'` (demos never onboard). Hardening gate retained as B-12. | `apps/api/src/jobs/` |
| C-9 MV semantics | `mv_storefront_discovery` gates on `location_status='active'` + `item_status='active'` + `visibility='public'` — no `directory_visible`/`is_demo` filter (deliberate). `mv_global_discovery` filters `directory_visible=true`, so previews are isolated from cross-tenant discovery automatically. Refresh is on-demand (`POST /api/cache/refresh-mv`); no scheduled job. | `apps/api/database/migrations/create_scope_aware_mvs.sql`, `routes/cache.ts` |
| C-10 Closed-preview rendering | `shops/[slug]` shows `StorefrontStatusPanel` when `locationStatus !== 'active'`; `getStoreByIdentifier` requires `subscription_status='active'` and expiry sets `cancelled`. | `apps/web/src/app/shops/[slug]/page.tsx`, `StoreService.getStoreByIdentifier` |
| C-11 Column constraints | `demo_template` varchar(50) and `subscription_tier` free-form `String?` accept `seed_preview` with no DDL. | migration 070, `schema.prisma` |
| C-12 Demo banner plumbing | Public tenant-info payload already returns `isDemo`/`demoExpiresAt` — banner needs only frontend rendering. | `apps/api/src/routes/public/tenants.ts` |

### Build (B-items, with owner to assign)

| Item | Task | Blocks |
|---|---|---|
| B-1 Retirement covers products + MV refresh | `expireDemoTenant` and the claim path archive sample products (§5e) inside the retirement transaction, then refresh `mv_storefront_discovery` after commit — `REFRESH ... CONCURRENTLY` cannot run inside a transaction. Without the refresh, the public query keeps serving archived items from the snapshot. The same refresh is required on create or the new preview renders empty (no scheduled refresh exists — C-9). | Any preview |
| B-2 Write-side claim gate | Products written to an unclaimed seed tenant are forced to `item_status = inactive`. Optionally add a claim condition to the public query as defense in depth. | Path 1 publication |
| B-3 Preview page-view source | IMPLEMENTED — the Layer 3 shelf-event route gained a `seed_preview` surface; the slug (`:ref`) resolves to the `seed_preview` demo tenant server-side so events are keyed by preview tenant (non-preview slugs resolve null and are dropped). `shops/[slug]` mounts `SeedPreviewTracker` when `tenantInfo.isDemo` — `listing_viewed` on mount, 30s `session_heartbeat`, `session_end` beacon. View count rides `getSeedPreviewStatus` → shown on the seed page; `seed_preview` also appears in the per-surface engagement rollup automatically. | — |
| B-4 Claim product step and incentive copy | The claim page has no product-entry step. Add it, and state the up-to-5 free products on the claim page copy. | Claim incentive |
| B-5 Idempotency guard | Concurrent generate calls can both pass the "existing" check. Add an advisory lock or a partial unique index on live previews per seed. | Route |
| B-6 Deterministic all-active sample catalog | Add an option to `generateQuickStartProducts` so previews are all active (§10 item 10). | Preview quality |
| B-7 Billing exclusion | RESOLVED by C-8 — renewal jobs iterate purchase tables; a preview with no `tenant_feature_purchases`/`featured_placement_purchases` rows has nothing to renew, and §5f's test already asserts both tables stay empty for the preview tenant. Retained as B-12 hardening. | — |
| B-8 Closed-preview rendering | RESOLVED by C-10 — status panel for non-`active` locationStatus + `subscription_status='active'` gate in `getStoreByIdentifier`; expiry sets `cancelled`. | — |
| B-9 Checkout consumes the module | `routes/checkout.ts` calls `resolvePaymentGateway` and refuses checkout when it returns no gateway, with a sandbox response for demo tenants. Replaces the direct `tenant_payment_gateways` read for this path. | Module gating as primary control (§5b) |
| B-10 Remove the paypal default | The checkout route defaults the gateway to `paypal` when no method is given (verified). Default to none, so a missing gateway fails closed. | B-9 |
| B-11 Conditional noindex + sitemap exclusion | `shops/[slug]` gets `robots: { index: false }` in `generateMetadata` only when the resolved tenant `is_demo` (blanket noindex would deindex real tenants). Confirm demo tenants are absent from the sitemap source. | Preview labeling (§5) |
| B-12 `is_demo` hardening gates (owner directive) | Add `NOT COALESCE(is_demo, false)` / `is_demo: { not: true }` to every tenant-scanning billing/notification job (`subscription-grace-period`, `monthly-fee-summary`, `badge-analytics-sync`, `coupon-analytics-sync`, `platform-badge-sync`, `expireManualSubscriptionControl`) as defense in depth on top of C-8. | Belt-and-suspenders; not blocking |

### Decision (D-items)

| Item | Question | Owner input |
|---|---|---|
| D-1 Takedown before claim | IMPLEMENTED via existing anonymous contact plumbing — the demo banner's "Own {business}?" toggle expands `PublicInquiryForm` (math CAPTCHA + honeypot) posting to `POST /api/public/inquiries` with `tenant_id='platform'` + `preview_slug`. The route resolves the `seed_preview` demo tenant → `demo_source_tenant_id` → source seed, appends claim context (seed id, admin review link, preview URL) to the inquiry body, and logs the contact on the seed's outreach-touches timeline — the request lands in the CRM Requests Hub (`source_tag='seed_preview_owner'`) AND on the seed page. Response-time SLA remains an ops call. | Operations |
| D-2 Consent language | Banner shipped as: "This is a sample storefront preview. Products shown are examples — this business has not claimed this page yet." + the D-1 owner line. Final wording sign-off remains open. | Product and legal |
| D-3 Tier honesty | Confirm the claim copy names the `directory_presence` tier and says checkout is not included (§5b, open item 5). | Product |
| D-4 Preview expiry | DECIDED: 14d base + capped extension (+7d per call, max 2, hard cap 28d). | Product |
| D-5 Campaign-side generation | DECIDED: in v1 — Openers surface on a PB-08 campaign triggers the same seed-scoped route via the linked seed. | Product |
| D-6 Docs conflict | Correct `PLATFORM_STRATEGY_V3.1` and the seed-claim skill to show `max_skus` 5, or confirm 5 is intended (open item 6). | Docs owner |
| D-7 Demo tier | DONE: dedicated `seed_preview` tier + explicit feature rows via migration 321 (verified against prod schema + omnichannel's feature rows). | Product and Engineering |
| D-8 PB-08 eligibility strictness | DECIDED: eligibility requires a **confirmed** `playbook_decision.kind='website_build_scope'` on a linked campaign (stricter than `playbook_code` alone). | Engineering |

### Remaining verification gates before any preview ships

1. B-1 implemented and tested (retirement covers products and the view refreshes after commit).
2. B-2 implemented and tested (Path 1 products stay private before claim).
3. B-9/B-10 implemented and tested (checkout short-circuits for `seed_preview` before any payment intent).
4. B-11 implemented (conditional `noindex` + sample banner on `shops/[slug]`).
5. B-12 recommended (`is_demo` gates on tenant-scanning jobs).
