# Directory Presence Light Tier + SNAP/EBT Visibility + Indianapolis Seed Sprint Plan

**Status:** Planned — not implemented
**Date:** 2026-08-16
**Focus city:** Indianapolis, IN
**Category:** African Grocery Store
**Branch context:** `staging`
**Latest applied migration at plan time:** `205_intelligence_profiles_reference_city.sql`
**Next migration numbers:** `206`–`209`

## 1. Problem

Emerging African grocery operators in Indianapolis already have customers. They do not have a stable public identity. Discovery found 10+ qualifying thin-footprint stores with phone + address + SNAP/news evidence and almost no owned website.

The platform already has a full storefront stack (layouts, catalog, QR, policies, checkout) and a tenant-backed directory (`directory_listings_list` requires `tenant_id`). Selling that stack first is the wrong door.

Needed: a **Directory Presence** light tier that publishes a shopper-facing listing from public information, shows SNAP/EBT only when sourced, and seeds 10 Indianapolis African grocery identities on the same city/category page so the directory looks like a market, not a demo.

## 2. Non-Goals

- Do not build catalog, cart, checkout, or EBT payment processing
- Do not seed contested identities (Jackieline High School Rd vs Stratton Sq LLC; TETEES vs Heaven at 4903 S High School Rd; Sant Yalla closed-flag)
- Do not invent hours, ratings, or EBT from category labels
- Do not use `tenants.is_demo` for seeded prospects (that flag is for demo-store clones)
- Do not edit `schema.prisma` directly
- Do not add `canonical-features.ts` / `tier-hierarchies.ts` — those files **do not exist** in this repo; features are seeded in SQL (`features_list` + `tier_features_list`)

## 3. Product contract

### 3.1 New tier: `directory_presence`

| Field | Value |
|---|---|
| `tier_key` | `directory_presence` |
| Display name | Directory Presence |
| Position | Below `starter`. Visibility-only. Not a discounted Professional. |
| Price | Operator-set later. Sprint seeds `price_monthly = 0` + `metadata.invite_only = true`. |
| `max_skus` | `0` |
| `max_locations` | `1` |

**On for this tier**

- `directory_entry_enabled`
- `directory_entry_layout_classic` only
- `directory_entry_hours_on`, `directory_entry_map_on`, `directory_entry_contact_on`, `directory_entry_qr_on`
- `storefront_enabled` + `storefront_retail` (one-page retail presence, no catalog)
- `directory_visibility_snap_ebt` (badge only)

**Off for this tier**

- `storefront_online`, `storefront_flexible`, `storefront_policies`
- Product types / product options / checkout / coupons
- `directory_entry_layout_editorial|immersive|premium`
- Featured / promoted directory slots
- Gallery beyond what public seed photos allow (keep gallery feature off unless a photo row exists)

### 3.2 SNAP/EBT visibility (not payments)

New feature key: `directory_visibility_snap_ebt`

- Capability type: `directory_entry` (existing)
- Resolver field: `snap_ebt_badge_enabled` (tier) + `snap_ebt_visible` (tier AND sourced AND merchant not suppressed)
- Card copy: **"SNAP/EBT reported"** + `as_of` date
- Never infer from “African grocery”, “halal”, or “international”
- Sources allowed: SNAP retailer list, owner confirmation after claim, or in-store photo reviewed by ops

### 3.3 Unclaimed presence tenants

`directory_listings_list.tenant_id` is required (directory query `INNER JOIN tenants`). Seed records are real tenants with a new standing mode, not fake demo stores.

| Field | Seed value |
|---|---|
| `subscription_tier` | `directory_presence` |
| `subscription_status` | `invite` or existing closest non-billing status — if `invite` is new, add it; otherwise `trial` + `manual_subscription_control = true` and `manual_subscription_reason = 'directory_presence_seed'` |
| `org_standing_mode` | `directory_seed` (new allowed value) |
| `directory_visible` | `true` |
| `service_level` | `self_service` |
| `location_status` | `active` |

Claim converts `directory_seed` → normal claimed tenant without wiping the listing.

## 4. Start-of-phase preflight (completed)

Hard rule: every implementation phase ends with `pnpm checkapi` and `pnpm checkweb`. Zero new TS errors.

### 4.1 Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Public directory read | existing directory routes; extend DTO only | Already public |
| Seed / claim admin | `AdminApiSingleton` (web) + `BaseService` (api) | Operator-only |
| Claim invite token consume | `PublicApiSingleton` | Unauthenticated claim landing |
| Capability-gated SNAP badge | resolver, not a new paid settings domain if possible | Visibility flag |

No direct `fetch`. Cache: invalidate directory listing + MV after seed/claim/SNAP update.

### 4.2 Skills read

| Skill | Applied |
|---|---|
| `start-of-phase-sprint-checklist.md` | This document |
| `capability-deployment-flow.md` | 8-phase for SNAP/EBT + light storefront flags |
| `capability-data-flow-rules.md` | `directory_visibility_snap_ebt` naming; no new `_enabled` group-gate collision |
| `tenant-scoped-id-generation.md` | New prefixes below |
| `manual-sql-migration-policy.md` | SQL first; `prisma db pull` after apply |
| `add-storefront-type.md` | Light retail storefront = existing `storefront_retail`, no new type |
| `database-navigation-system.md` | Admin seed/claim page needs nav + settings card |

**Skills to update after implementation (mandatory)**

- `capability-deployment-flow.md` — note this repo has **no** `canonical-features.ts`; Phase 1 for this codebase is SQL `features_list`
- `capability-data-flow-rules.md` — SNAP/EBT is a **visibility badge**, not a payment/checkout group
- `add-storefront-type.md` — Directory Presence uses `storefront_retail` without product sections
- `tenant-scoped-id-generation.md` §4 catalog — add prefixes listed below
- `end-of-phase-sprint-checklist.md` — no change unless claim tokens introduce a new public auth path worth noting

**New skill to create at phase end**

- `.devin/skills/directory-presence-seed-claim.md` — reusable workflow: unclaimed tenant + listing + provenance + claim token. Recurring for other city/category seeds.

### 4.3 ID planning

| Entity | Scope | Prefix | Format | Collision check |
|---|---|---|---|---|
| Tenant | existing | `tid` | `tid-{nanoid}` | exists |
| Directory listing | tenant | `dll` | `dll-{tk}-{nanoid8}` | **new** — no `generateDirectoryListingId` today |
| Presence seed record | tenant | `dps` | `dps-{tk}-{nanoid8}` | new |
| Field provenance row | tenant | `dfp` | `dfp-{tk}-{nanoid8}` | new |
| Claim token | tenant | `dct` | `dct-{tk}-{nanoid12}` | new |
| Feature / tier IDs | global | existing `generateFeatureId` / `generateTierId` | keep |

`directory_photos.id` still uses `gen_random_uuid()` — do **not** migrate in this sprint (out of scope). New listing IDs must not use raw UUID.

Add generators in `id-generator.ts` **before** services.

### 4.4 Navigation & pages

| Route | Audience | Sidebar | Notes |
|---|---|---|---|
| `/directory` + category/city filters | public | none | Extend existing `apps/web/src/app/directory/page.tsx` |
| `/directory/[slug]` | public | none | Badge + unclaimed banner on existing detail |
| `/directory/claim/[token]` | public | none | New claim landing |
| `/settings/admin/directory/presence-seeds` | platform admin | child of Directory | New |
| `/settings/admin/directory/listings` | existing | already there | Add seed status filter |

**Admin settings card** (`apps/web/src/app/(platform)/settings/admin/page.tsx` Directory section):

- Label: Presence Seeds
- Href: `/settings/admin/directory/presence-seeds`
- Icon: register in `useNavLinks.tsx`, `page.tsx`, `NavItemRow.tsx` (same icon in all three)

**No tenant sidebar** for unclaimed seeds. After claim, existing directory-entry settings suffice.

Draft nav INSERT uses dynamic parent subquery:

```sql
INSERT INTO navigation_links (...)
SELECT ...
WHERE NOT EXISTS (
  SELECT 1 FROM navigation_links WHERE href = '/settings/admin/directory/presence-seeds'
);
```

### 4.5 Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | existing public directory list/detail | public | Add SNAP + provenance DTO fields |
| GET | `/api/public/directory/claim/:token` | public | Token summary |
| POST | `/api/public/directory/claim/:token/accept` | public + customer/user auth as designed | Bind owner |
| GET/POST | `/api/admin/directory/presence-seeds` | admin | List / create seeds |
| POST | `/api/admin/directory/presence-seeds/:id/publish` | admin | Publish listing |
| POST | `/api/admin/directory/presence-seeds/:id/invite` | admin | Mint claim token |
| PATCH | `/api/admin/directory/presence-seeds/:id/fields` | admin | Update sourced fields |

Mount public claim under `/api/public/...`. Admin under existing admin directory prefix. Per-route `authenticateToken` on admin. Review catch-all order on `/api/admin/directory/:id`.

**Jobs:** none required for v1. Optional later: SNAP as-of stale warning.

**Services to modify**

- `DirectoryEntryOptionsResolver.ts` — SNAP badge fields
- Frontend `CapabilityResolutionService.ts` — parity
- `EffectiveCapabilityResolver.ts` — wire
- `buildExpiredCapabilitiesResponse` — disabled SNAP fields
- `directory-mv.ts` / `directory-consolidated.ts` / `DirectoryService.ts` — select new listing columns
- `StorefrontTypeService.ts` — no new type; `directory_presence` only enables `storefront_retail`

### 4.6 Database

Migrations (idempotent `DO $$` / `IF NOT EXISTS` / `INSERT … WHERE NOT EXISTS`):

| File | Contents |
|---|---|
| `206_directory_presence_tier.sql` | Insert `subscription_tiers_list` row `directory_presence`; seed features + `tier_features_list` |
| `207_directory_visibility_snap_ebt.sql` | Listing columns + capability feature + resolver-facing defaults |
| `208_directory_presence_seed.sql` | `directory_presence_seeds`, `directory_field_provenance`, `directory_claim_tokens`; tenant standing-mode check |
| `209_indianapolis_african_grocery_seed.sql` | Data-only: 10 tenants + listings + provenance + SNAP as-of |

After apply (human): staging `prisma db pull && prisma generate`, then same SQL on production.

**MV:** `directory-mv.ts` joins `directory_listings_list`. New listing columns must be added to the SELECT list. If an MV materializes listing rows, plan `REFRESH MATERIALIZED VIEW` in 207 comments.

### 4.7 Frontend

| Component | Type | States |
|---|---|---|
| `SnapEbtBadge` | client | hidden / reported+as_of / suppressed |
| `UnclaimedPresenceBanner` | client | unclaimed / invited / claimed |
| `PresenceSeedAdminClient` | client | list, publish, invite, field edit |
| `DirectoryClaimPageClient` | client | invalid, expired, already claimed, success |
| Directory card (existing) | extend | badge slot; no product_count on this tier |

React Query keys: `['directory-presence-seeds']`, `['directory-claim', token]`, tenant-scoped after claim.

SSR: claim page must not touch `localStorage` without window guard.

### 4.8 Capability 8-phase for SNAP/EBT

1. **Define** — SQL `features_list` key `directory_visibility_snap_ebt` (not a new `_enabled` group gate)
2. **Seed** — link to `directory_entry`; enable on `directory_presence` and higher tiers that already have directory entry
3. **Prefs** — column on `tenant_directory_entry_settings`: `snap_ebt_display` (merchant may hide after claim). Seed listings also store sourced state on the listing row.
4. **Resolve** — `DirectoryEntryOptionsResolver` + types + frontend fallback parity
5. **Route** — directory-entry settings Zod + DEFAULT + all-false + GET filter (R32)
6. **Map** — UnifiedCapabilityService + CapabilityResolutionService
7. **Display** — PlanSummaryWidget + directory card badge (not PlanSummaryPanel unless already listing directory_entry)
8. **Verify** — `verify-capability-deployment.md` + TS checks

Constraint: SNAP badge **recommends** `directory_entry_enabled`. Do not require checkout.

### 4.9 Preflight summary block

```
Phase/Sprint: Directory Presence light tier + SNAP/EBT badge + Indianapolis African grocery seed
Design doc: docs/DIRECTORY_PRESENCE_LIGHT_TIER_SPRINT_PLAN.md

New services: DirectoryPresenceSeedService (admin), DirectoryClaimService (public)
New entities: directory_presence_seeds, directory_field_provenance, directory_claim_tokens;
              subscription tier directory_presence; 10 seed tenants + listings
New ID generators needed: generateDirectoryListingId (dll-), generateDirectoryPresenceSeedId (dps-),
              generateDirectoryFieldProvenanceId (dfp-), generateDirectoryClaimTokenId (dct-)
New pages/routes: /settings/admin/directory/presence-seeds; /directory/claim/[token]
New sidebar links: Presence Seeds (admin Directory child)
New settings cards: admin Directory → Presence Seeds
New migration: 206–209
New background jobs: none in v1
New capability features: directory_visibility_snap_ebt (+ directory_presence tier feature set)
Skills to read before starting: capability-deployment-flow, capability-data-flow-rules,
              tenant-scoped-id-generation, manual-sql-migration-policy, add-storefront-type,
              database-navigation-system, end-of-phase-sprint-checklist
Skills to update after completion:
  - capability-deployment-flow.md (this repo seeds features in SQL, no canonical-features.ts)
  - capability-data-flow-rules.md (visibility badge vs payment)
  - add-storefront-type.md (retail presence without catalog)
  - tenant-scoped-id-generation.md §4 (dll/dps/dfp/dct)
Insights to capture: directory_listings_list requires tenant_id so seeds must be presence tenants;
              SNAP/EBT is sourced visibility; one identity per address; hours/EBT omitted without provenance
New skill to create: .devin/skills/directory-presence-seed-claim.md
```

## 5. Implementation phases

### Phase A — Tier + capabilities (206, 207)

- Insert `directory_presence` tier
- Seed feature keys and `tier_features_list`
- Add listing columns (see schema)
- Extend `DirectoryEntryOptionsResolver` + frontend fallback
- Tests: resolver on/off/flexible/merchant hide; expired-capabilities shape

### Phase B — Presence seed + claim schema (208)

- Tables + RLS + `updated_at` triggers
- ID generators
- Admin + public claim services/routes
- Unclaimed banner + claim page (empty state OK until Phase C)

### Phase C — Indianapolis seed (209)

Publish **10** cards the same day on grocery + Indianapolis filters.

| # | Name | Address | Phone | SNAP as-of source |
|---|---|---|---|---|
| 1 | African Market | 8057 E 38th St, Indianapolis, IN 46226 | (317) 602-8322 | SNAP list |
| 2 | Janjai Redlight Market | 3504 Madison Ave, Indianapolis, IN 46227 | (317) 292-7655 | SNAP list |
| 3 | Garaya African Market | 4150 Lafayette Rd Ste C, Indianapolis, IN 46254 | (317) 550-7793 | SNAP list |
| 4 | YB Enterprise African Market | 711 E Thompson Rd, Indianapolis, IN 46227 | (317) 734-3827 | SNAP list |
| 5 | Dreamcast African Market | 7125 Georgetown Rd #900, Indianapolis, IN 46268 | (317) 985-9643 | SNAP list |
| 6 | Jokkymore African Market | 1041 N Girls School Rd, Indianapolis, IN 46214 | (317) 629-1981 | omit badge |
| 7 | Royal African Market | 3071 N High School Rd, Indianapolis, IN 46224 | (317) 371-0837 | SNAP list |
| 8 | Baobab African Market | 7031 N Michigan Rd, Indianapolis, IN 46268 | (317) 253-0650 | SNAP list |
| 9 | Ethiopian Market LLC | 7355 W 10th St, Indianapolis, IN 46214 | (317) 332-8984 | omit badge |
| 10 | Safari Market | 5653 W Morris St, Indianapolis, IN 46241 | (317) 717-5866 | SNAP as **Filsan Market** same address — provenance must record alternate SNAP name |

Every card footer: `Listed from public directories / SNAP / news. Not a claimed profile.`

**Do not seed in 209:** Jackieline, TETEES, Heaven, Ruthbae, Kaura, Victory, Sant Yalla, Gomez, Karibu, Royalty, His Grace, Saraga, Money Saver, Jiallo’s.

### Phase D — Shopper UI + invite copy

- Badge on card + detail
- Unclaimed banner
- Claim landing
- Admin invite mints token; outreach template (claim, not e-commerce)

### Phase E — Verify

- `pnpm checkapi` + `pnpm checkweb`
- `verify-capability-deployment.md`
- Directory page in Indianapolis + grocery (or `African grocery store` secondary) shows 10 cards
- Seeded tenants cannot open catalog/checkout
- End-of-phase checklist + skill updates

## 6. Schema sketch

### `directory_listings_list` additions (207)

| Column | Type | Notes |
|---|---|---|
| `snap_ebt_reported` | BOOLEAN DEFAULT false | |
| `snap_ebt_as_of` | DATE NULL | |
| `snap_ebt_source` | TEXT NULL | `snap_retailer_list` / `owner_confirmed` / `ops_photo` |
| `snap_ebt_source_name` | TEXT NULL | e.g. Filsan Market |
| `listing_origin` | VARCHAR(32) DEFAULT `claimed` | `claimed` \| `directory_seed` |
| `public_disclaimer` | TEXT NULL | unclaimed footer |

### `directory_presence_seeds`

| Column | Notes |
|---|---|
| `id` | `dps-{tk}-{nanoid}` |
| `tenant_id` | unique |
| `listing_id` | unique |
| `category` | `African Grocery Store` |
| `city` / `state` | |
| `seed_batch` | `indy-african-grocery-2026-08` |
| `status` | `draft` \| `published` \| `invited` \| `claimed` \| `suppressed` |
| `identity_confidence` | `high` \| `medium` |
| `category_fit` | `verified` \| `probable` |
| `notes` | operator only |

### `directory_field_provenance`

One row per field (`name`, `address`, `phone`, `snap_ebt`, `hours`, `specialty_line`).

| Column | Notes |
|---|---|
| `field_key` | |
| `value` | stored text |
| `source_name` / `source_url` | |
| `accessed_at` | |
| `confidence` | |
| `show_on_public` | false unless sourced |

**Rule:** if `hours` has no provenance row with `show_on_public`, do not render hours.

### `directory_claim_tokens`

| Column | Notes |
|---|---|
| `token_hash` | store hash, not raw |
| `expires_at` | |
| `consumed_at` / `consumed_by` | |
| `single_use` | true |

## 7. Light storefront behavior

For `directory_presence` + `storefront_retail`:

- Show: name, specialty line, address, phone, map (if lat/lng), QR, SNAP badge if sourced, claim banner if unclaimed
- Hide: product grids, featured rails, booking, checkout, policies
- `product_count` on directory cards must be 0 / omitted — do not join inventory for this origin

Reuse `/tenant/[id]` only if section resolver can hide product/service sections when `max_skus = 0` and origin is `directory_seed`. If that is risky, ship **directory detail as the only public page** for seeds and attach storefront after claim. Prefer the second path in Phase B/D to avoid storefront section regressions.

## 8. Invite copy (operator)

> You’re already listed on the Indianapolis African grocery directory from public information (address, phone, and SNAP where reported). Claim the listing to fix hours or phone and add a photo. This is not an online store.

Conversion = claim, not checkout.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Wrong identity published | 209 only high/medium + hold list |
| Stale EBT/hours | provenance + as-of; omit if missing |
| Seed tenants billed | invite-only metadata; no Stripe customer |
| Directory empty until 10 publish | publish batch atomically in 209 transaction |
| `canonical-features` skill drift | update skill: this repo uses SQL |
| Capability MV stale | refresh / invalidate after 206–207 |

## 10. Acceptance

- [ ] `directory_presence` exists and cannot access catalog/checkout
- [ ] SNAP badge renders only with source + as-of
- [ ] Safari card can show SNAP with source name Filsan Market
- [ ] 10 Indianapolis listings live on one grocery directory view
- [ ] Unclaimed footer on all 10
- [ ] Claim token binds an owner without wiping NAP
- [ ] Held names are absent
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new seed-claim skill written

## 11. Suggested implementation order

1. Phase A (tier + SNAP columns + resolver) — shippable without public names
2. Phase B (seed/claim plumbing)
3. Phase C (209 data)
4. Phase D (UI + invites)
5. Phase E (verify + skills)

Do not start 209 until A+B are on staging and a dry-run SELECT of the 10 rows looks correct.
