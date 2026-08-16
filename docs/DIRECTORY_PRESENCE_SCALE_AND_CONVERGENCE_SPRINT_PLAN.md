# Directory Presence Scale & Convergence Sprint Plan

**Status:** Planned — not implemented
**Date:** 2026-08-16
**Prerequisite:** Directory Presence Light Tier + SNAP/EBT + Indianapolis Seed sprint (migrations 206–209, `DirectoryPresenceSeedService`, `DirectoryClaimService`, admin seed page, claim landing, `SnapEbtBadge`, `UnclaimedPresenceBanner`) must be complete with clean `pnpm checkapi` + `pnpm checkweb`.
**Branch context:** `staging`
**Latest applied migration at plan time:** `209_indianapolis_african_grocery_seed.sql` (expected)
**Next migration numbers:** `210`–`213`

## 1. Problem

The Directory Presence sprint (206–209) builds the seed/claim/provenance plumbing and ships one hand-written seed batch (10 Indy African grocery stores). The Marketing Ops module already has an intelligence seek pipeline that discovers businesses in a category+city, scores them, and queues prospects with `category_fit`, `identity_confidence`, `discovery_signals`, and `business_snapshot`.

These two systems were built independently. They are two halves of one loop:

```
Intelligence seek → prospect queue → ┌─ campaign (outreach path — exists)
                                     └─ directory seed (visibility path — MISSING)
```

The prospect queue already has every field a directory seed needs. The `DirectoryPresenceSeedService.createSeed` already accepts `identityConfidence`, `categoryFit`, `provenance`, and NAP data. The missing piece is a converter that takes a prospect queue entry and creates a seed — plus the operator UI to review prospects and bulk-seed them, the dashboard filtering so claimed tenants see a relevant (not wall-heavy) dashboard, and the badge architecture decision that determines whether scaling to new niches is cheap or expensive.

This sprint closes those gaps and makes the platform a self-contained growth engine: one seek run can populate both marketing campaigns and directory seeds across any niche and city.

## 2. Non-Goals

- Do not rebuild the intelligence seek pipeline — it works; this sprint consumes its output
- Do not replace `createCampaignFromQueue` — the campaign path stays as-is; the seed path is additive
- Do not build a separate directory-presence dashboard component — extend the shared dashboard via capability filtering (Option B from analysis)
- Do not seed new cities/niches in this sprint — that's the *output* of the engine, not the engine itself. One validation seed batch (replacing the hand-written 209) is sufficient to prove the loop
- Do not edit `schema.prisma` directly (per repo convention)
- Do not add `canonical-features.ts` / `tier-hierarchies.ts` — features are seeded in SQL

## 3. Product contract

### 3.1 Queue-to-seed converter

A new method on `DirectoryPresenceSeedService` (or a new `DirectorySeedFromQueueService` that delegates to it):

```
createSeedFromQueue(queueEntryId, ctx) → SeedSummary
createSeedsFromBatch(queueEntryIds[], ctx) → { created: SeedSummary[]; skipped: { id, reason }[] }
```

- Input: a prospect queue entry with `source_kind = 'intelligence_seek'`
- Validation: `category_fit !== 'insufficient'` AND `identity_confidence !== 'low'` AND `business_seek_priority !== 'hold'`
- Maps prospect fields → seed fields:
  - `business_name` → `businessName`
  - `category` → `primaryCategory`
  - `city` / `state` → `city` / `state`
  - `business_snapshot.{address, phone, website, lat, lng, zip}` → listing fields
  - `business_snapshot.snap_ebt_*` → listing SNAP columns (if present)
  - `category_fit` → `categoryFit` (reject `insufficient`)
  - `identity_confidence` → `identityConfidence` (reject `low`)
  - `discovery_provenance` → `provenance[]` (auto-populate field-level provenance)
  - `discovery_signals` → seed `notes` (operator-visible context)
  - `seed_batch` → auto-generated: `{city-slug}-{category-slug}-{YYYY-MM}` (e.g. `indianapolis-african-grocery-2026-08`)
- Creates: tenant (`org_standing_mode = 'directory_seed'`) + listing (`listing_origin = 'directory_seed'`) + seed record + provenance rows
- Marks the prospect queue entry: new status `seed_created` + new column `processed_seed_id`
- Idempotent: if `processed_seed_id` is already set, return the existing seed

### 3.2 Dashboard capability filtering (Option B)

Extend the shared tenant dashboard (`TenantDashboardV2` + `DynamicTenantSidebar`) to hide nav items and widgets that a `directory_presence` tenant cannot use. No new component, no new route.

**Sidebar changes:**
- Add optional `requiredFeature?: string` field to `NavItem` type
- Tag nav groups: Inventory → `storefront`, Customer Portal → `storefront_online`, Coupons → (coupon feature), Integrations → `integration_enabled`, App Store → (keep, it's the upgrade funnel), FAQ → (faq feature), Bot → (already capability-gated)
- Extend `filterByCapability` in `DynamicTenantSidebar` to check `useTenantAccess(tenantId).hasFeature(item.requiredFeature)` and hide items that fail
- What remains visible for `directory_presence`: Dashboard, My Storefront (directory-relevant children only), My Subscription, My Settings, Support

**Dashboard widget changes:**
- Conditionally hide Orders/Product KPIs when `max_skus === 0` (or when tier = `directory_presence`)
- Show directory-presence-relevant KPIs instead: listing views, QR scans, claim status, SNAP badge status
- Tailor `TaskChecklist` for `directory_presence`: "Verify your listing", "Add business hours", "Upload a logo", "Confirm SNAP/EBT", "Upgrade to sell online"
- Add `directory_presence` to the Growth Tip engine's `tipContext.tierLevel` set

### 3.3 Badge architecture decision

**Decision required before Phase C of this sprint:** generalize the SNAP badge pattern, or copy-paste per badge.

| Option | Schema | Effort per new badge | When to choose |
|---|---|---|---|
| **A: Copy-paste** | Named columns per badge (`snap_ebt_*`, `halal_cert_*`, `wic_*`) | 1 migration + resolver fields + component per badge | ≤2 total badges expected |
| **B: Generalize** | `directory_visibility_badges` JSONB column + `directory_visibility_badge_*` feature family | 0 migrations after initial; resolver iterates; component renders by badge type | 3+ badges expected |

**Recommendation:** Option B (generalize). The sprint plan's scaling analysis shows multiple badge candidates (SNAP, halal cert, kosher cert, WIC, women-owned, Black-owned). Generalizing once is cheaper than migrating named columns three times. The initial migration migrates existing `snap_ebt_*` columns into the JSONB structure.

If the decision is Option A (copy-paste), skip Phase C of this sprint and document the decision + the copy-paste template for future badges.

### 3.4 Operator seed management

Admin UI for the full seek-to-seed workflow:

- **Prospect review → seed approval:** On the prospect queue page, add a "Create Directory Seed" action per prospect (alongside the existing "Create Campaign" action). Bulk-select → "Create Seeds" for batch seeding.
- **Seed batch dashboard:** `/settings/admin/directory/presence-seeds` (from the prior sprint) extended with batch grouping, bulk publish, bulk invite, and provenance review.
- **Hold-list as queue filter:** `business_seek_priority = 'hold'` prospects are visually marked and excluded from the bulk-seed action. No separate holds table needed — the queue already has the field.

## 4. Start-of-phase preflight

Hard rule: every implementation phase ends with `pnpm checkapi` and `pnpm checkweb`. Zero new TS errors.

### 4.1 Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Queue-to-seed converter | `BaseService` (api) + `AdminApiSingleton` (web) | Operator-only |
| Prospect → seed action | Extend existing `MarketingOpsService` (web) | Same page as "Create Campaign" |
| Dashboard nav filtering | Extend `DynamicTenantSidebar` + `useTenantAccess` | Code-driven, not DB-driven |
| Badge resolver (if generalizing) | Extend `DirectoryEntryOptionsResolver` | Same resolver, iterates badges |

### 4.2 Skills to read before starting

| Skill | Applied |
|---|---|
| `capability-deployment-flow.md` | Badge generalization follows the 8-phase pipeline (Phase 7 Display is the main touch) |
| `capability-data-flow-rules.md` | R33 tier-level vs merchant-gated separation for badge resolver |
| `three-tier-feature-gating.md` | `directory_presence` is non-flexible explicit tier; nav filter's `hasFeature` handles all three sources |
| `capability-system-integration.md` | `useAllCapabilities` / `useTenantAccess` for nav filter |
| `database-navigation-system.md` | Admin seed batch page nav (DB-driven) |
| `manual-sql-migration-policy.md` | SQL-first; `prisma db pull` after apply |
| `tenant-scoped-id-generation.md` | No new ID generators in this sprint (reuses `dps-`, `dll-`, `dfp-`, `dct-`) |
| `verify-capability-deployment.md` | Phase E verification |
| `end-of-phase-sprint-checklist.md` | Phase-end checklist |

**Skills to update after implementation (mandatory)**

- `capability-deployment-flow.md` — note this repo has **no** `canonical-features.ts` (still pending from prior sprint)
- `capability-data-flow-rules.md` — if badges are generalized, document the badge-array resolver pattern
- `tenant-scoped-id-generation.md` — no new prefixes in this sprint; confirm

**New skill to create at phase end**

- `.devin/skills/queue-to-directory-seed-converter.md` — reusable workflow: prospect queue entry → directory seed. Covers validation rules, field mapping, provenance auto-population, batch operations, and the hold-list filter.

### 4.3 ID planning

No new ID generators in this sprint. All new records use existing prefixes:
- Directory listing: `dll-{tk}-{nanoid8}` (existing)
- Presence seed: `dps-{tk}-{nanoid8}` (existing)
- Field provenance: `dfp-{tk}-{nanoid8}` (existing)
- Claim token: `dct-{tk}-{nanoid12}` (existing)

### 4.4 Navigation & pages

| Route | Audience | Sidebar | Notes |
|---|---|---|---|
| `/settings/admin/directory/presence-seeds` | platform admin | child of Directory | Extended: batch grouping, bulk publish/invite, provenance review |
| `/settings/admin/marketing-ops/queue` | platform admin | child of Marketing Ops | Extended: "Create Directory Seed" action per prospect + bulk |
| `/settings/admin/directory/seed-batches` | platform admin | child of Directory | **New:** batch overview (cross-niche, cross-city) |
| `/t/[tenantId]/dashboard` | claimed tenant | tenant sidebar | **Modified:** capability-filtered nav + directory-presence widgets |

No new tenant sidebar links — the filtering is the change.

### 4.5 Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/directory/presence-seeds/from-queue` | admin | Create a single seed from a prospect queue entry |
| POST | `/api/admin/directory/presence-seeds/from-queue/batch` | admin | Bulk-create seeds from multiple queue entries |
| POST | `/api/admin/directory/presence-seeds/batch/publish` | admin | Bulk-publish a set of seeds |
| POST | `/api/admin/directory/presence-seeds/batch/invite` | admin | Bulk-mint claim tokens for a set of seeds |
| GET | `/api/admin/directory/seed-batches` | admin | List all seed batches with counts + status breakdown |
| GET | `/api/admin/directory/seed-batches/:batchId` | admin | Batch detail with all seeds in the batch |

All admin routes use `authenticateToken`. Mount under existing admin directory prefix.

**Services to modify**

- `DirectoryPresenceSeedService.ts` — add `createSeedFromQueue`, `createSeedsFromBatch`, `bulkPublish`, `bulkInvite`, `listBatches`
- `MarketingProspectQueueService.ts` — add `processed_seed_id` column support + `seed_created` status
- `DirectoryEntryOptionsResolver.ts` — if badges generalized: iterate badge array instead of named SNAP fields
- `EffectiveCapabilityResolver.ts` — if badges generalized: wire badge resolver
- Frontend `CapabilityResolutionService.ts` — parity for badge array
- `DynamicTenantSidebar.tsx` — `requiredFeature` on nav items + `filterByCapability` extension
- `TenantDashboardV2.tsx` — conditional KPI widgets for `directory_presence`

### 4.6 Database

Migrations (idempotent `DO $$` / `IF NOT EXISTS` / `INSERT … WHERE NOT EXISTS`):

| File | Contents |
|---|---|
| `210_prospect_queue_seed_link.sql` | Add `processed_seed_id` column + `seed_created` status to `mkt_prospect_queue`; CHECK constraint on status enum |
| `211_directory_visibility_badges.sql` | **Only if Option B (generalize):** Add `directory_visibility_badges` JSONB column to `directory_listings_list`; migrate existing `snap_ebt_*` data into JSONB; add `directory_visibility_badge_*` feature family; update tier_features_list |
| `212_directory_seed_batches.sql` | `directory_seed_batches` view or materialized view for batch overview (or pure query — decide during implementation) |
| `213_intelligence_profile_african_grocery.sql` | Data-only: activate the "African Grocery Store" intelligence profile with `reference_city: 'Indianapolis'`, `intelligence_focus: 'emerging'` (if not already seeded by the prior sprint) |

After apply (human): staging `prisma db pull && prisma generate`, then same SQL on production.

**MV:** If `directory_visibility_badges` is added (211), the directory MV SELECT list must include it and the MV must be refreshed.

### 4.7 Frontend

| Component | Type | States |
|---|---|---|
| `ProspectQueueSeedAction` | client | eligible / ineligible (hold/low/insufficient) / already-seeded / creating / created |
| `SeedBatchOverviewClient` | client | batch list with counts, status breakdown, bulk actions |
| `DirectoryPresenceKpiCard` | client | listing views / QR scans / claim status / SNAP badge status |
| `DirectoryPresenceTaskChecklist` | client | verify listing / add hours / upload logo / confirm SNAP / upgrade |
| Nav `NavItem` type | extend | add `requiredFeature?: string` |
| `filterByCapability` | extend | check `requiredFeature` via `useTenantAccess` |
| `SnapEbtBadge` (existing) | extend if generalizing | render from badge array instead of named columns |

React Query keys: `['directory-seed-from-queue']`, `['directory-seed-batches']`, `['directory-seed-batch', batchId]`.

### 4.8 Preflight summary block

```
Phase/Sprint: Directory Presence Scale & Convergence — queue-to-seed converter + dashboard filtering + badge architecture
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md

New services: createSeedFromQueue / createSeedsFromBatch on DirectoryPresenceSeedService (or new DirectorySeedFromQueueService)
New entities: directory_seed_batches (view or table — TBD); processed_seed_id on mkt_prospect_queue;
              directory_visibility_badges JSONB (if Option B)
New ID generators needed: none (reuses dps-/dll-/dfp-/dct-)
New pages/routes: /settings/admin/directory/seed-batches; extended /settings/admin/directory/presence-seeds;
                  extended /settings/admin/marketing-ops/queue (seed action)
New sidebar links: Seed Batches (admin Directory child)
New settings cards: admin Directory → Seed Batches
New migration: 210–213
New background jobs: none in v1
New capability features: directory_visibility_badge_* family (if Option B only)
Skills to read before starting: capability-deployment-flow, capability-data-flow-rules,
              three-tier-feature-gating, capability-system-integration, database-navigation-system,
              manual-sql-migration-policy, verify-capability-deployment, end-of-phase-sprint-checklist
Skills to update after completion:
  - capability-deployment-flow.md (no canonical-features.ts — still pending)
  - capability-data-flow-rules.md (badge-array resolver pattern if generalized)
  - tenant-scoped-id-generation.md (confirm no new prefixes)
New skill to create: .devin/skills/queue-to-directory-seed-converter.md
Insights to capture: prospect queue is the shared intake for both campaigns and directory seeds;
              directory_presence dashboard is the shared dashboard with capability filtering, not a variant;
              badge architecture decision (generalize vs copy-paste) determines scaling cost per niche
```

## 5. Implementation phases

### Phase A — Queue-to-seed converter (210)

- Add `processed_seed_id` column + `seed_created` status to `mkt_prospect_queue` (migration 210)
- Implement `createSeedFromQueue` on `DirectoryPresenceSeedService`:
  - Load prospect queue entry
  - Validate: `source_kind = 'intelligence_seek'`, `category_fit !== 'insufficient'`, `identity_confidence !== 'low'`, `business_seek_priority !== 'hold'`
  - Map fields (see §3.1 mapping table)
  - Auto-generate `seed_batch` from city + category + month
  - Delegate to existing `createSeed` for tenant + listing + seed + provenance creation
  - Update prospect queue entry: `status = 'seed_created'`, `processed_seed_id = seedId`, `processed_at = now()`
  - Idempotent: if `processed_seed_id` already set, return existing seed
- Implement `createSeedsFromBatch`: loop over queue entry IDs, collect results + skips
- Routes: `POST /api/admin/directory/presence-seeds/from-queue` + `/batch`
- Tests: converter success, validation rejections (low/insufficient/hold), idempotency, batch with mixed eligible/ineligible

### Phase B — Dashboard capability filtering

- Add `requiredFeature?: string` to `NavItem` type in `NavItemRow.tsx`
- Tag nav groups in `buildTenantNav` with `requiredFeature`:
  - My Inventory → `requiredFeature: 'storefront'`
  - Customer Portal → `requiredFeature: 'storefront_online'`
  - Coupons → `requiredFeature: 'storefront_online'` (or coupon-specific feature)
  - My Integrations → `requiredFeature: 'integration_enabled'`
  - FAQ → keep (check if faq feature gates it; if not, leave ungated)
  - Bot → already capability-gated (no change)
  - App Store → keep visible (upgrade funnel)
  - My Storefront → keep visible (directory-relevant children work)
  - My Subscription → keep visible (upgrade funnel)
  - My Settings → keep visible
- Extend `filterByCapability` in `DynamicTenantSidebar` to check `requiredFeature` via `useTenantAccess(tenantId).hasFeature(item.requiredFeature)`
- Recursively filter children too (a parent with `requiredFeature` hides all children)
- Modify `TenantDashboardV2`:
  - Hide Orders/Product KPIs when `usage?.totalItems === 0 && tier === 'directory_presence'` (or more generally `max_skus === 0`)
  - Show `DirectoryPresenceKpiCard` instead (listing views, QR scans, claim status, SNAP badge)
  - Conditionally render `DirectoryPresenceTaskChecklist` for `directory_presence` tier
  - Add `directory_presence` to Growth Tip engine `tipContext.tierLevel` set
- Tests: nav filtering hides correct items for `directory_presence`, shows all for `professional`; KPI conditional rendering; task checklist tier check

### Phase C — Badge architecture (211) — conditional

**Only if Option B (generalize) is chosen.** If Option A (copy-paste), skip this phase and document the decision.

- Migration 211: add `directory_visibility_badges` JSONB column to `directory_listings_list`
- Migrate existing `snap_ebt_*` column data into JSONB array: `[{type: 'snap_ebt', reported: true, as_of: '...', source: '...', source_name: '...'}]`
- Add `directory_visibility_badge_enabled` feature key (generic badge gate) + per-badge-type feature keys (`directory_visibility_badge_snap_ebt`, `directory_visibility_badge_halal_cert`, etc.)
- Refactor `DirectoryEntryOptionsResolver`:
  - Replace named `snap_ebt_badge_enabled` / `snap_ebt_visible` with badge-array iteration
  - `badges_enabled`: array of `{ type, badge_enabled, visible }` computed from features + merchant prefs
  - Each badge: `badge_enabled = mainOn && (features['directory_visibility_badge_' + type] || flexible)`, `visible = badge_enabled && merchantPref !== false`
- Frontend parity: `CapabilityResolutionService` maps badge array; `SnapEbtBadge` renders from `badges.find(b => b.type === 'snap_ebt')`
- Tests: badge array resolver on/off/flexible/merchant-hide; migration data correctness; frontend parity

### Phase D — Operator seed management UI

- Extend prospect queue page (`/settings/admin/marketing-ops/queue`):
  - Add "Create Directory Seed" button per prospect (alongside "Create Campaign")
  - Show eligibility state: eligible / hold / low-confidence / insufficient-fit / already-seeded
  - Bulk-select checkbox + "Create Seeds" bulk action
  - After seed creation: show seed ID + link to seed detail
- New seed batch overview page (`/settings/admin/directory/seed-batches`):
  - List all batches with counts by status (draft / published / invited / claimed / suppressed)
  - Click batch → batch detail with all seeds
  - Bulk publish + bulk invite actions
- Extend presence seeds page (`/settings/admin/directory/presence-seeds`):
  - Group by `seed_batch`
  - Provenance review (expandable per seed)
  - Bulk publish + bulk invite
- Routes: `GET /api/admin/directory/seed-batches`, `GET /api/admin/directory/seed-batches/:batchId`, `POST /api/admin/directory/presence-seeds/batch/publish`, `POST /api/admin/directory/presence-seeds/batch/invite`
- Tests: batch list, batch detail, bulk publish, bulk invite

### Phase E — Validation seed batch (213)

- Activate intelligence profile for "African Grocery Store" with `reference_city: 'Indianapolis'` (migration 213, if not already done)
- Run an intelligence seek (operator action, not code):
  - Profile resolves the seek prompt
  - Run executes, produces sampled businesses
  - Prospects queued with `category_fit` / `identity_confidence` / `discovery_signals`
- Operator reviews prospects on the queue page:
  - Hold-list entries (`business_seek_priority = 'hold'`) are visually marked and excluded from bulk-seed
  - Approved prospects → bulk "Create Seeds" → seeds created in batch `indianapolis-african-grocery-2026-08`
- Operator publishes the batch → 10+ cards live on the directory
- Operator sends claim invites
- **This replaces the hand-written 209 migration with a seek-generated seed batch**, proving the loop is closed

### Phase F — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- `verify-capability-deployment.md` checklist (if Phase C was done)
- Directory page in Indianapolis + African grocery shows the seek-generated batch
- Claimed tenant dashboard shows filtered nav + directory-presence KPIs (no dead-end walls)
- Seeded tenants cannot access catalog/checkout (nav filtered, TierGate walls on direct URL)
- Prospect queue → seed → publish → claim → dashboard → upgrade funnel works end-to-end
- End-of-phase checklist
- Create `.devin/skills/queue-to-directory-seed-converter.md`
- Update `capability-deployment-flow.md` (no `canonical-features.ts` note — still pending from prior sprint)
- Update `capability-data-flow-rules.md` (badge-array pattern if Phase C done)

## 6. Schema sketch

### `mkt_prospect_queue` additions (210)

| Column | Type | Notes |
|---|---|---|
| `processed_seed_id` | VARCHAR(60) NULL | FK to `directory_presence_seeds.id` (nullable, set when seed created) |
| `status` | add `seed_created` to allowed values | alongside existing `queued` / `campaign_created` / `dismissed` |

```sql
ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS processed_seed_id VARCHAR(60) NULL;

ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT fk_prospect_queue_seed
  FOREIGN KEY (processed_seed_id) REFERENCES directory_presence_seeds(id)
  ON DELETE SET NULL;

-- status CHECK constraint extended (if one exists; if not, add one)
```

### `directory_visibility_badges` (211 — Option B only)

| Column | Type | Notes |
|---|---|---|
| `directory_visibility_badges` | JSONB DEFAULT '[]' | Array of `{ type, reported, as_of, source, source_name }` |

```sql
ALTER TABLE directory_listings_list
  ADD COLUMN IF NOT EXISTS directory_visibility_badges JSONB DEFAULT '[]';

-- Migrate existing snap_ebt_* data
UPDATE directory_listings_list
SET directory_visibility_badges = jsonb_build_array(
  jsonb_build_object(
    'type', 'snap_ebt',
    'reported', snap_ebt_reported,
    'as_of', snap_ebt_as_of,
    'source', snap_ebt_source,
    'source_name', snap_ebt_source_name
  )
)
WHERE snap_ebt_reported = true
  AND directory_visibility_badges = '[]';
```

Existing `snap_ebt_*` columns are kept for backward compatibility during the transition (deprecated, removed in a future migration after all consumers are updated).

### Badge JSONB shape

```json
[
  {
    "type": "snap_ebt",
    "reported": true,
    "as_of": "2026-08-01",
    "source": "snap_retailer_list",
    "source_name": "Filsan Market"
  },
  {
    "type": "halal_cert",
    "reported": true,
    "as_of": "2026-07-15",
    "source": "ops_photo",
    "source_name": null
  }
]
```

### `directory_seed_batches` (212)

Decision during implementation: materialized view or pure query. If MV:

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS directory_seed_batches AS
SELECT
  seed_batch,
  category,
  city,
  state,
  COUNT(*) AS total_seeds,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'published') AS published_count,
  COUNT(*) FILTER (WHERE status = 'invited') AS invited_count,
  COUNT(*) FILTER (WHERE status = 'claimed') AS claimed_count,
  COUNT(*) FILTER (WHERE status = 'suppressed') AS suppressed_count,
  MIN(created_at) AS first_seed_at,
  MAX(created_at) AS last_seed_at
FROM directory_presence_seeds
GROUP BY seed_batch, category, city, state
ORDER BY seed_batch;
```

## 7. Field mapping: prospect queue → directory seed

| Prospect queue field | Directory seed field | Notes |
|---|---|---|
| `business_name` | `CreateSeedInput.businessName` | Required |
| `category` | `CreateSeedInput.primaryCategory` | Required |
| `city` | `CreateSeedInput.city` | Required |
| `state` | `CreateSeedInput.state` | Required |
| `business_snapshot.address` | `CreateSeedInput.address` | Required; reject if missing |
| `business_snapshot.phone` | `CreateSeedInput.phone` | Optional |
| `business_snapshot.website` | `CreateSeedInput.website` | Optional (usually null for seeds) |
| `business_snapshot.zip` | `CreateSeedInput.zipCode` | Optional |
| `business_snapshot.latitude` | `CreateSeedInput.latitude` | Optional |
| `business_snapshot.longitude` | `CreateSeedInput.longitude` | Optional |
| `business_snapshot.snap_ebt_reported` | `CreateSeedInput.snapEbtReported` | Optional |
| `business_snapshot.snap_ebt_as_of` | `CreateSeedInput.snapEbtAsOf` | Optional |
| `business_snapshot.snap_ebt_source` | `CreateSeedInput.snapEbtSource` | Optional |
| `business_snapshot.snap_ebt_source_name` | `CreateSeedInput.snapEbtSourceName` | Optional |
| `category_fit` | `CreateSeedInput.categoryFit` | Reject if `insufficient` |
| `identity_confidence` | `CreateSeedInput.identityConfidence` | Reject if `low` |
| `discovery_provenance` | `CreateSeedInput.provenance[]` | Auto-populate: each provenance entry → `{ fieldKey, value, sourceName, sourceUrl, accessedAt, confidence, showOnPublic }` |
| `discovery_signals` | `CreateSeedInput.notes` | Joined as comma-separated signal list |
| (auto-generated) | `CreateSeedInput.seedBatch` | `{city-slug}-{category-slug}-{YYYY-MM}` |
| `business_seek_priority` | (validation only) | Reject if `hold` |

## 8. Dashboard filtering detail

### Nav items tagged with `requiredFeature`

| Nav group | `requiredFeature` | Visible on `directory_presence`? |
|---|---|---|
| My Dashboard | (none) | Yes |
| My Inventory | `storefront` | No — hidden |
| Customer Portal | `storefront_online` | No — hidden |
| My Storefront | (none — children filtered individually) | Yes (directory children only) |
| FAQ | (check faq feature — if not on tier, hide) | Likely hidden |
| Bot | (already capability-gated) | Hidden (bot not on tier) |
| Coupons | `storefront_online` | No — hidden |
| My Integrations | `integration_enabled` | No — hidden |
| App Store | (none — keep as upgrade funnel) | Yes |
| My Subscription | (none — keep as upgrade funnel) | Yes |
| My Settings | (none) | Yes |
| Platform | (none) | Yes |

### My Storefront children (filtered individually)

| Child | `requiredFeature` | Visible on `directory_presence`? |
|---|---|---|
| View in Directory | (none) | Yes |
| Directory Settings | `directory_entry_enabled` | Yes |
| Branding | `directory_entry_enabled` | Yes |
| Store Hours | `directory_entry_hours_on` | Yes |
| Business Category | `directory_entry_enabled` | Yes |
| Location Status | (none) | Yes |
| Review Management | (none — if feature gates, add) | Check |
| QR Codes | `directory_entry_qr_on` | Yes |
| QR Analytics | `directory_entry_qr_on` | Yes |
| Image Gallery | `directory_entry_gallery_on` | No — hidden (gallery not on tier) |
| Storefront Layout | `storefront_flexible` | No — hidden |
| Storefront Maps | `directory_entry_map_on` | Yes |
| My Storefront | `storefront_enabled` | Yes (retail one-page) |

### Dashboard KPI conditional

```tsx
// In TenantDashboardV2.tsx
const isDirectoryPresence = tier?.effective?.key === 'directory_presence';
const maxSkus = tier?.effective?.maxSkus ?? 0;
const showCommerceKpis = !isDirectoryPresence && maxSkus > 0;

// KPI grid
{showCommerceKpis ? (
  <>
    <KpiCard label="Orders" ... />
    <KpiCard label="Products Live" ... />
  </>
) : (
  <>
    <DirectoryPresenceKpiCard label="Listing Views" ... />
    <DirectoryPresenceKpiCard label="QR Scans" ... />
  </>
)}
```

### Task checklist for `directory_presence`

| Task | Condition | Link |
|---|---|---|
| Verify your listing | `!hasPublishedDirectory` | `/t/${tenantId}/settings/directory` |
| Add business hours | `!hasHours` | `/t/${tenantId}/settings/hours` |
| Upload a logo | `!hasLogo` | `/t/${tenantId}/settings/branding` |
| Confirm SNAP/EBT status | `snap_ebt_reported && !owner_confirmed` | `/t/${tenantId}/settings/directory` |
| Upgrade to sell online | always (upgrade CTA) | `/t/${tenantId}/settings/subscription` |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Seek-generated seeds have worse data quality than hand-written 209 | Validation gates (category_fit / identity_confidence / hold filter); operator reviews before bulk-seed |
| Badge generalization breaks existing SNAP badge rendering | Keep `snap_ebt_*` columns during transition; JSONB is source of truth, columns are deprecated; update all consumers before removing columns |
| Nav filtering hides something a `directory_presence` tenant needs | Tag conservatively; if unsure, leave visible and let TierGate wall it; test with a real claimed seed tenant |
| Prospect queue status enum drift | Add CHECK constraint in 210; document `seed_created` in the queue service |
| Bulk-seed creates duplicate tenants | `createSeed` generates new tenant IDs; dedup by business_name + address in the converter before calling `createSeed` |
| Intelligence profile not activated for target niche | 213 activates the profile; if the seek can't resolve a profile, it falls back to generic mode — operator should verify profile is active before running |

## 10. Acceptance

- [ ] `createSeedFromQueue` converts a prospect queue entry to a directory seed with auto-populated provenance
- [ ] `createSeedsFromBatch` bulk-converts with eligibility filtering (hold/low/insufficient skipped)
- [ ] Prospect queue entry is marked `seed_created` with `processed_seed_id` after conversion
- [ ] `directory_presence` tenant sidebar hides Inventory, Customer Portal, Coupons, Integrations (and shows everything else)
- [ ] `directory_presence` tenant dashboard shows directory-presence KPIs instead of Orders/Products
- [ ] `directory_presence` task checklist shows relevant tasks (not "add your first product")
- [ ] If Option B: badge array resolver works; existing SNAP badge renders from JSONB; `snap_ebt_*` columns deprecated but functional
- [ ] Operator can run a seek → review prospects → bulk-seed → publish → invite from the admin UI
- [ ] Seed batch overview page shows cross-niche/cross-city batches with status counts
- [ ] Validation seed batch (Indy African grocery) is seek-generated, not hand-written
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new queue-to-seed-converter skill written

## 11. Suggested implementation order

1. Phase A (queue-to-seed converter + 210) — the missing link; shippable independently
2. Phase B (dashboard filtering) — improves claimed tenant UX; independent of A
3. Phase C (badge architecture — if Option B) — schema decision; do before scaling to badge-heavy niches
4. Phase D (operator seed management UI) — depends on A
5. Phase E (validation seed batch) — depends on A + D; proves the loop
6. Phase F (verify + skills)

Phases A and B can run in parallel (different files, no dependencies). Phase C can run in parallel with A and B if the badge decision is made early. Phase D depends on A. Phase E depends on A + D.

## 12. The closed loop (end state)

After this sprint, the platform's growth engine is:

```
Operator selects niche + city
  → Intelligence profile resolves seek prompt (category knowledge + reference city)
    → Intelligence run executes (external agent discovers businesses)
      → City-category opportunity output (sampled businesses + scores + signals)
        → Prospects queued (category_fit + identity_confidence + discovery_signals + provenance)
          → Operator reviews (hold-list filtered, eligibility checked)
            ├─ High digital-opportunity + pain → createCampaignFromQueue → marketing outreach
            └─ Thin footprint + stable identity → createSeedFromQueue → directory seed
                                                                    ↓
                                                              Publish batch
                                                                    ↓
                                                              Claim invite sent
                                                                    ↓
                                                              Owner claims listing
                                                                    ↓
                                                              Filtered dashboard (no walls)
                                                                    ↓
                                                              Upgrade to sell online
                                                                    ↓
                                                              Tier upgrade → full dashboard
```

One seek run. Two conversion paths. Zero external prospecting. The platform finds its own next tenants.

---

# Sprint 2: Claim-to-Tenant Bridge

**Status:** Planned — not implemented
**Prerequisite:** Sprint 1 (Phases A–F) complete. The queue-to-seed converter, dashboard filtering, badge architecture, and operator seed management UI must be shipped with clean `pnpm checkapi` + `pnpm checkweb`.
**Branch context:** `staging`
**Next migration numbers:** `214`–`216`

## S2.1. Problem

Sprint 1 closes the discovery-to-seed loop and the dashboard filtering loop. But the claim flow — the moment a business owner converts from an unclaimed listing to a platform tenant — is incomplete. Today's `DirectoryClaimService.acceptClaim` does three things:

1. Consumes the claim token
2. Flips `tenants.org_standing_mode` from `directory_seed` to `independent`
3. Marks the seed `claimed`

It does **not**:

- **Create a `user_tenants` row** — the claiming user has no OWNER role on the tenant
- **Create or link a platform `users` identity** — `customers` and `users` are separate tables with no foreign key between them; a customer who claims via customer JWT has no platform user identity and cannot access `/t/[tenantId]/dashboard`
- **Set onboarding state** — the user's `onboarding_completed` / `onboarding_step` are not set for the directory-presence flow
- **Route the owner to their dashboard** — the success state links to `/account` (generic), not `/t/[tenantId]/dashboard` (their actual tenant dashboard)
- **Provide an upgrade path** — `directory_presence` is $0/month; there is no tier comparison or checkout flow for upgrading to a paid tier

The claim is a dead end. The owner "claims" but has no dashboard, no role, no onboarding, and no upgrade path. This sprint builds the bridge from claim to full tenant experience.

## S2.2. Non-Goals

- Do not merge `customers` and `users` tables — they serve different purposes (customer = buyer/marketing-portal; user = tenant operator/platform staff)
- Do not replace the existing customer auth system — the claim flow starts with customer auth; the bridge promotes to platform user auth
- Do not build a new subscription system — reuse `SubscriptionBillingService.subscribe` + `updateTenantTier`
- Do not build a new dashboard — the filtered dashboard from Sprint 1 Phase B is the destination
- Do not edit `schema.prisma` directly (per repo convention)

## S2.3. Product contract

### S2.3.1. Customer-to-user promotion

When a customer accepts a directory claim, the system must:

1. **Find or create a platform `users` row** from the customer's email
   - If a `users` row with the same email already exists → link it (the user may already have a platform account)
   - If not → create a new `users` row with `role: USER`, `email_verified: true` (the customer's email was verified during customer registration), `password_hash` copied from the customer record (or null if the customer uses OAuth only — in that case, the user will need to set a password on first platform login)
2. **Link the customer to the user** via a new `customers.linked_user_id` column
3. **Create a `user_tenants` row** with `role: OWNER` linking the new/existing user to the claimed tenant
4. **Set onboarding state** on the user: `onboarding_completed: false`, `onboarding_step: 'directory_claim_welcome'`, `onboarding_data: { claimedViaDirectory: true, seedId, tenantId }`
5. **Return platform user tokens** alongside the claim result so the frontend can transition to platform auth without a second login

### S2.3.2. Post-claim routing

The claim success state must:

- Route to `/t/[tenantId]/dashboard` (not `/account`)
- Carry the platform user JWT (from the promotion step) so the dashboard loads authenticated
- Show a "Welcome — you own this listing" first-visit banner
- Handle the edge case where the user already has a platform account (skip "create password" prompt; just link + redirect)

### S2.3.3. Dashboard welcome state

When a claimed directory-presence tenant visits their dashboard for the first time:

- Show a welcome banner: "Welcome! You're now the owner of [Business Name] on the [City] [Category] directory"
- Show the filtered dashboard from Sprint 1 Phase B (no walls, no dead-end nav)
- Show a guided next-steps checklist (from Sprint 1 Phase B `DirectoryPresenceTaskChecklist`):
  1. Verify your listing
  2. Add business hours
  3. Upload a logo or photo
  4. Confirm SNAP/EBT status (if applicable)
  5. Upgrade to sell online
- The welcome banner dismisses on next visit (stored in `onboarding_data.welcomeDismissed` or a localStorage flag)

### S2.3.4. Subscription upgrade path

The `directory_presence` tenant must have a clear, frictionless upgrade path:

- **Tier comparison card** on the dashboard (replaces or supplements the existing subscription card for `directory_presence` tenants)
  - Shows current tier (`Directory Presence — Free`)
  - Shows 2–3 upgrade options (`Starter`, `Google Only`, or whatever the next tier up is) with feature deltas
  - Each option has a "Upgrade" button → checkout flow
- **Checkout flow** reuses `SubscriptionBillingService.subscribe`:
  - Free tier → `updateTenantTier` (instant, no payment)
  - Paid tier → Stripe checkout (existing payment method flow or new card)
  - On success: `updateTenantTier` + refresh capability state + dashboard re-renders with unlocked nav items
- **Post-upgrade transition**: when the tier changes from `directory_presence` to a higher tier:
  - Nav items un-hide (the `requiredFeature` filter from Sprint 1 Phase B now passes)
  - Dashboard KPIs switch from directory-presence KPIs to commerce KPIs
  - Task checklist switches from directory-presence tasks to the new tier's tasks
  - The `org_standing_mode` stays `independent` (already set during claim)

## S2.4. Start-of-phase preflight

Hard rule: every implementation phase ends with `pnpm checkapi` and `pnpm checkweb`. Zero new TS errors.

### S2.4.1. Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Customer-to-user promotion | New method on `DirectoryClaimService` (or new `DirectoryClaimPromotionService`) | Extends the existing claim flow |
| Post-claim routing | Extend `DirectoryClaimClient.tsx` | Frontend only |
| Dashboard welcome state | Extend `TenantDashboardV2.tsx` | Frontend only |
| Subscription upgrade | Reuse `SubscriptionBillingService` + new `TierUpgradeService` (frontend) | Backend exists; frontend is new |

### S2.4.2. Skills to read before starting

| Skill | Applied |
|---|---|
| `capability-deployment-flow.md` | Tier upgrade triggers capability refresh (Phase 7 Display re-renders) |
| `capability-data-flow-rules.md` | After upgrade, `useAllCapabilities` must refetch — the hook layer is the refresh point |
| `three-tier-feature-gating.md` | Upgraded tier may be flexible or explicit; nav filter handles both |
| `capability-system-integration.md` | `useTenantAccess` refresh after upgrade |
| `manual-sql-migration-policy.md` | SQL-first; `prisma db pull` after apply |
| `tenant-scoped-id-generation.md` | Reuses `generateUserId`, `generateUserTenantId` |
| `verify-capability-deployment.md` | Phase E verification |
| `end-of-phase-sprint-checklist.md` | Phase-end checklist |

**Skills to update after implementation (mandatory)**

- `capability-deployment-flow.md` — note the claim-to-tenant promotion flow as a new entry path to the capability pipeline
- `tenant-scoped-id-generation.md` — confirm `uid-` and `utid-` prefixes reused (no new prefixes)

**New skill to create at phase end**

- `.devin/skills/directory-claim-to-tenant-bridge.md` — reusable workflow: customer accepts claim → promoted to platform user → OWNER role on tenant → onboarding state → dashboard → upgrade path. Covers the customer-to-user promotion pattern, the auth transition, and the upgrade flow.

### S2.4.3. ID planning

No new ID generators. Reuses:
- Platform user: `uid-{nanoid5}` (existing `generateUserId`)
- User-tenant link: `utid-{userId}-{tenantKey}-{nanoid5}` (existing `generateUserTenantId`)

### S2.4.4. Navigation & pages

| Route | Audience | Notes |
|---|---|---|
| `/directory/claim/[token]` | public (claimant) | **Modified:** success state routes to `/t/[tenantId]/dashboard` with platform auth |
| `/t/[tenantId]/dashboard` | claimed tenant | **Modified:** welcome banner for first-visit + upgrade card |
| `/t/[tenantId]/settings/subscription` | claimed tenant | **Modified:** tier comparison + upgrade checkout for `directory_presence` |
| `/t/[tenantId]/settings/subscription/upgrade` | claimed tenant | **New:** dedicated upgrade page with tier comparison + payment |

No new sidebar links — the upgrade path is surfaced via the dashboard card and the existing "My Subscription" link.

### S2.4.5. Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/directory/claim/:token/accept` | customer or platform | **Modified:** now returns `{ tenantId, seedId, userTokens, requiresPasswordSetup }` |
| POST | `/api/public/directory/claim/:token/promote` | customer | **New:** explicit promotion step (if the accept endpoint doesn't auto-promote) — creates user + user_tenants + returns platform tokens |
| GET | `/api/tenant/:tenantId/upgrade/options` | platform user (OWNER) | **New:** returns tier comparison for the current tier (what's available, feature deltas, pricing) |
| POST | `/api/tenant/:tenantId/upgrade` | platform user (OWNER) | **New:** initiates upgrade checkout (Stripe) or instant free-tier upgrade |
| POST | `/api/tenant/:tenantId/upgrade/confirm` | platform user (OWNER) | **New:** confirms upgrade after Stripe checkout success |

**Services to modify**

- `DirectoryClaimService.ts` — add `promoteCustomerToUser` method (or new `DirectoryClaimPromotionService`)
- `SubscriptionBillingService.ts` — no changes (reuse `subscribe` + `updateTenantTier`)
- `auth/auth.service.ts` — add `linkCustomerToUser` (creates user from customer, generates platform JWT)
- `routes/directory-presence-public.ts` — modify accept endpoint to return platform tokens
- `routes/onboarding.ts` — add `directory_claim_welcome` onboarding step handling
- Frontend `DirectoryClaimClient.tsx` — modify success state routing
- Frontend `TenantDashboardV2.tsx` — add welcome banner + upgrade card
- Frontend new `TierUpgradeService.ts` — tier comparison + checkout
- Frontend new `/t/[tenantId]/settings/subscription/upgrade/page.tsx` — upgrade page

### S2.4.6. Database

| File | Contents |
|---|---|
| `214_customer_linked_user_id.sql` | Add `linked_user_id` column to `customers` table (nullable FK to `users.id`); partial index WHERE NOT NULL |
| `215_directory_claim_onboarding.sql` | Add `directory_claim_welcome` to the onboarding step values (if a CHECK constraint exists; otherwise no-op migration); add `onboarding_data` defaults for claim flow |
| `216_tier_upgrade_audit.sql` | Add `directory_tier_upgrade` audit action support (if the audit enum needs extending); otherwise no-op |

After apply (human): staging `prisma db pull && prisma generate`, then same SQL on production.

### S2.4.7. Frontend

| Component | Type | States |
|---|---|---|
| `DirectoryClaimClient` (existing) | extend | success state now routes to `/t/[tenantId]/dashboard` with platform auth |
| `DirectoryClaimWelcomeBanner` | client | first-visit / dismissed |
| `TierUpgradeCard` | client | current tier / available upgrades / feature deltas / pricing |
| `TierUpgradeCheckout` | client | selecting tier / entering payment / processing / success / error |
| `TierUpgradePage` | page | `/t/[tenantId]/settings/subscription/upgrade` |
| `DirectoryClaimPasswordSetup` | client | shown if promoted user has no password (OAuth-only customer) |

React Query keys: `['tier-upgrade-options', tenantId]`, `['tier-upgrade-status']`.

### S2.4.8. Preflight summary block

```
Phase/Sprint: Claim-to-Tenant Bridge — customer-to-user promotion + dashboard welcome + upgrade path
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md (Sprint 2)

New services: promoteCustomerToUser on DirectoryClaimService (or new DirectoryClaimPromotionService);
              TierUpgradeService (frontend); linkCustomerToUser on auth.service
New entities: customers.linked_user_id; directory_claim_welcome onboarding step
New ID generators needed: none (reuses uid-, utid-)
New pages/routes: /t/[tenantId]/settings/subscription/upgrade; modified /directory/claim/[token] success
New sidebar links: none (upgrade via dashboard card + existing My Subscription)
New settings cards: TierUpgradeCard on dashboard for directory_presence tenants
New migration: 214–216
New background jobs: none
New capability features: none (upgrade changes tier, not features)
Skills to read before starting: capability-deployment-flow, capability-data-flow-rules,
              three-tier-feature-gating, capability-system-integration, manual-sql-migration-policy,
              tenant-scoped-id-generation, verify-capability-deployment, end-of-phase-sprint-checklist
Skills to update after completion:
  - capability-deployment-flow.md (claim-to-tenant promotion as new entry path)
  - tenant-scoped-id-generation.md (confirm no new prefixes)
New skill to create: .devin/skills/directory-claim-to-tenant-bridge.md
Insights to capture: customers and users are separate tables with no existing link;
      the claim bridge must promote customer → user + create user_tenants OWNER row;
      the auth transition (customer JWT → platform JWT) is the critical handshake;
      the upgrade path is the conversion funnel from free directory presence to paid commerce
```

## S2.5. Implementation phases

### Phase A — Customer-to-user promotion (214)

- Migration 214: add `customers.linked_user_id` column (nullable FK to `users.id`)
- Implement `promoteCustomerToUser(customerId, ctx)` on `DirectoryClaimService` (or new `DirectoryClaimPromotionService`):
  - Load customer record (email, first_name, last_name, password_hash, email_verified)
  - Check if `users` row with same email already exists
    - If yes → use existing user (the customer may already have a platform account)
    - If no → create new `users` row:
      - `id: generateUserId()`
      - `email: customer.email`
      - `password_hash: customer.password_hash` (copied so the same password works)
      - `first_name`, `last_name` from customer
      - `role: USER`
      - `email_verified: customer.email_verified`
      - `onboarding_completed: false`
      - `onboarding_step: 'directory_claim_welcome'`
      - `onboarding_data: { claimedViaDirectory: true }`
  - Update `customers.linked_user_id` to the user ID
  - Generate platform JWT for the user (via `auth.service`)
  - Return `{ user, tokens }`
- Modify `DirectoryClaimService.acceptClaim`:
  - After consuming token + flipping org_standing_mode + marking seed claimed
  - Call `promoteCustomerToUser(customerId)` (if the claimant is a customer)
  - Create `user_tenants` row: `id: generateUserTenantId(user.id, tenantId)`, `role: OWNER`
  - Set `onboarding_data: { claimedViaDirectory: true, seedId, tenantId, businessName }`
  - Return extended `ClaimResult`: `{ success, tenantId, seedId, message, userTokens, requiresPasswordSetup }`
  - `requiresPasswordSetup: true` if the promoted user has no password_hash (OAuth-only customer)
- Modify `routes/directory-presence-public.ts` accept endpoint:
  - Return the extended result including `userTokens` and `requiresPasswordSetup`
- Tests: promotion creates user + user_tenants; existing user is reused; idempotent (re-claim doesn't create duplicate user_tenants); OAuth-only customer gets `requiresPasswordSetup: true`

### Phase B — Post-claim routing + auth transition

- Modify `DirectoryClaimClient.tsx` success state:
  - If `result.userTokens` → store platform JWT (via `applyExternalAuth` or equivalent)
  - If `result.requiresPasswordSetup` → show `DirectoryClaimPasswordSetup` component (set a password for the new platform account)
  - Route to `/t/${result.tenantId}/dashboard` (not `/account`)
  - Pass `?welcome=true` query param so the dashboard shows the welcome banner
- Modify `DirectoryClaimPublicService.ts` (frontend):
  - `acceptClaim` returns the extended result type
  - Handle the platform token storage
- Tests: success state routes to correct dashboard URL; platform auth is established; password setup flow for OAuth-only customers

### Phase C — Dashboard welcome state

- Modify `TenantDashboardV2.tsx`:
  - Check `searchParams.welcome === 'true'` or `onboarding_step === 'directory_claim_welcome'`
  - Show `DirectoryClaimWelcomeBanner`:
    - "Welcome! You're now the owner of [Business Name] on the [City] [Category] directory"
    - "Your listing is live. Here's what to do next:"
    - Dismiss button (sets `onboarding_data.welcomeDismissed: true` via PATCH `/api/onboarding`)
  - The filtered dashboard from Sprint 1 Phase B renders below (no walls, no dead-end nav)
  - `DirectoryPresenceTaskChecklist` (from Sprint 1 Phase B) renders with the 5 directory-presence tasks
  - The "Upgrade to sell online" task links to `/t/[tenantId}/settings/subscription/upgrade`
- Tests: welcome banner shows on first visit; dismisses on second visit; task checklist renders for directory_presence

### Phase D — Subscription upgrade path (215–216)

- Migration 215: add `directory_claim_welcome` to onboarding step handling (if needed)
- Migration 216: audit action support for tier upgrades (if needed)
- Backend: `GET /api/tenant/:tenantId/upgrade/options`:
  - Load current tier (`directory_presence`)
  - Query `subscription_tiers_list` for upgrade-eligible tiers (tiers with `sort_order` > current tier's `sort_order` and `price_monthly > 0`)
  - For each tier: return `{ key, name, price_monthly, price_annual, feature_deltas }` where `feature_deltas` is the set of features the new tier has that `directory_presence` doesn't (computed from `tier_features_list`)
  - Return `{ currentTier, upgradeOptions }`
- Backend: `POST /api/tenant/:tenantId/upgrade`:
  - Accept `{ targetTier, billingCycle, paymentMethodId? }`
  - If target tier is free → `SubscriptionBillingService.updateTenantTier` (instant)
  - If paid → `SubscriptionBillingService.subscribe` (Stripe checkout)
  - Return checkout result (client secret or success)
- Backend: `POST /api/tenant/:tenantId/upgrade/confirm`:
  - Confirm Stripe checkout success
  - `updateTenantTier` + audit
  - Return updated tier info
- Frontend: `TierUpgradeCard` on dashboard:
  - Shows for `directory_presence` tenants only
  - "You're on the free Directory Presence plan. Upgrade to sell online, manage inventory, and more."
  - "Compare plans" button → `/t/[tenantId]/settings/subscription/upgrade`
- Frontend: `TierUpgradePage` at `/t/[tenantId]/settings/subscription/upgrade`:
  - Tier comparison table (current tier + 2–3 upgrade options)
  - Feature deltas per tier (what you get that you don't have now)
  - Pricing (monthly / annual toggle)
  - "Upgrade" button per tier → `TierUpgradeCheckout`
- Frontend: `TierUpgradeCheckout`:
  - Saved payment method selection (if any) or new card entry (Stripe Elements)
  - Order summary (tier name, billing cycle, price)
  - "Confirm Upgrade" → calls `POST /api/tenant/:tenantId/upgrade`
  - On success: refresh `useTenantAccess` + `useAllCapabilities` → dashboard re-renders with unlocked nav
  - Show success state: "You're now on [Tier Name]! Your dashboard has been upgraded."
- Post-upgrade transition:
  - Nav items un-hide (the `requiredFeature` filter from Sprint 1 Phase B now passes for the new tier's features)
  - Dashboard KPIs switch from directory-presence KPIs to commerce KPIs
  - Task checklist switches from directory-presence tasks to the new tier's tasks
  - `onboarding_step` advances from `directory_claim_welcome` to the new tier's onboarding step
- Tests: upgrade options for `directory_presence`; free-tier instant upgrade; paid-tier Stripe checkout; post-upgrade nav un-hides; post-upgrade KPIs switch

### Phase E — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- End-to-end: claim token → accept → promoted to user → OWNER role → dashboard with welcome banner → filtered nav → task checklist → upgrade card → upgrade checkout → dashboard re-renders with unlocked features
- Claimed tenant can access `/t/[tenantId]/dashboard` (platform auth works)
- Claimed tenant cannot access routes above their tier (TierGate walls on direct URL)
- Upgrade from `directory_presence` to `starter` (or next tier) works via Stripe
- Post-upgrade: nav shows Inventory, Customer Portal, etc.; KPIs show Orders, Products
- OAuth-only customer can set a password after claim
- Re-claim is idempotent (no duplicate user_tenants)
- End-of-phase checklist
- Create `.devin/skills/directory-claim-to-tenant-bridge.md`
- Update `capability-deployment-flow.md` (claim-to-tenant promotion as new entry path)
- Update `tenant-scoped-id-generation.md` (confirm no new prefixes)

## S2.6. Schema sketch

### `customers.linked_user_id` (214)

| Column | Type | Notes |
|---|---|---|
| `linked_user_id` | VARCHAR(255) NULL | FK to `users.id` (nullable, set when customer is promoted to platform user) |

```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS linked_user_id VARCHAR(255) NULL;

ALTER TABLE customers
  ADD CONSTRAINT fk_customers_linked_user
  FOREIGN KEY (linked_user_id) REFERENCES users(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_linked_user_id
  ON customers (linked_user_id)
  WHERE linked_user_id IS NOT NULL;
```

### Onboarding step values (215)

If a CHECK constraint exists on `users.onboarding_step`, add `directory_claim_welcome` to the allowed values. If no constraint exists, this is a no-op migration (the column is a free-form string).

```sql
-- No-op if no CHECK constraint exists on onboarding_step.
-- If one exists, ALTER the constraint to include 'directory_claim_welcome'.
-- This is additive and safe.
```

### Audit action support (216)

If the audit `action` enum needs extending for `directory_tier_upgrade`, add it. If the audit table uses a free-form string for action (which the current `audit.ts` implementation suggests — it maps action strings to a small enum), this is a no-op.

```sql
-- No-op if audit action is a free-form string.
-- If an enum exists, ALTER TYPE to add 'directory_tier_upgrade'.
```

## S2.7. Customer-to-user promotion detail

### Promotion flow

```
Customer accepts claim (customer JWT)
  → acceptClaim consumes token + flips org_standing_mode + marks seed claimed
    → promoteCustomerToUser(customerId)
      → Load customer (email, name, password_hash, email_verified)
      → Find existing users row by email
        ├─ Exists → use existing user
        └─ Not found → create new users row (role: USER, email_verified from customer, password_hash from customer)
      → Update customers.linked_user_id = user.id
      → Generate platform JWT for user
      → Return { user, tokens }
    → Create user_tenants row (role: OWNER, user_id, tenant_id)
    → Set onboarding state (step: 'directory_claim_welcome', data: { claimedViaDirectory: true, seedId, tenantId })
    → Return extended ClaimResult { success, tenantId, seedId, userTokens, requiresPasswordSetup }
```

### Edge cases

| Case | Handling |
|---|---|
| Customer already has a `linked_user_id` | Use the existing linked user; don't create a new one |
| User with same email already exists but no `linked_user_id` on the customer | Link the customer to the existing user; don't create a duplicate |
| User is already an OWNER of the tenant (re-claim) | Idempotent: return success without creating a duplicate `user_tenants` row |
| Customer has no `password_hash` (OAuth-only) | Create user with `password_hash: null`; return `requiresPasswordSetup: true`; frontend prompts for password |
| Customer email not verified | Create user with `email_verified: false`; the platform can re-send verification (or auto-verify since the claim token itself is a form of email verification) |
| Platform user (not customer) accepts claim | Skip promotion; use the existing `req.user.id` directly; create `user_tenants` row |

### Auth transition

The critical handshake is transitioning from customer JWT to platform JWT:

1. Customer is authenticated via `CustomerAuthContext` (customer JWT in localStorage/cookie)
2. Claim accept endpoint receives customer JWT in Authorization header
3. Backend promotes customer → user, generates platform JWT
4. Backend returns platform JWT in the response body
5. Frontend stores platform JWT (via `applyExternalAuth` or equivalent platform auth storage)
6. Frontend routes to `/t/[tenantId]/dashboard` which requires platform auth
7. Dashboard loads with platform JWT → `useTenantAccess(tenantId)` works → filtered nav renders

The customer JWT remains valid for marketing portal access. The platform JWT is new and separate. The user now has both identities linked via `customers.linked_user_id`.

## S2.8. Upgrade path detail

### Tier comparison for `directory_presence`

| Tier | Price/mo | Key features unlocked | Target user |
|---|---|---|---|
| Directory Presence (current) | $0 | Directory listing, SNAP badge, QR code, claim | Visibility-only |
| Google Only | $19 | GBP sync, review management, GBP optimization | Owner with GBP but no online store |
| Starter | $49 | Storefront, inventory (limited), checkout, basic CRM | Owner ready to sell online |
| Professional | $149 | Full inventory, coupons, integrations, advanced CRM | Growing business |

(Actual tiers and pricing from `subscription_tiers_list` — these are illustrative.)

### Feature delta computation

```ts
// GET /api/tenant/:tenantId/upgrade/options
const currentTierFeatures = await getTierFeatures('directory_presence');
const upgradeTiers = await getUpgradeEligibleTiers('directory_presence');

const options = upgradeTiers.map(tier => {
  const tierFeatures = await getTierFeatures(tier.key);
  const newFeatures = tierFeatures.filter(f => !currentTierFeatures.includes(f));
  return {
    key: tier.key,
    name: tier.name,
    priceMonthly: tier.price_monthly,
    priceAnnual: tier.price_annual,
    featureDeltas: newFeatures, // features the upgrade unlocks
  };
});
```

### Post-upgrade refresh

After a successful upgrade, the frontend must refresh:

1. `useTenantAccess(tenantId)` — refetch capability state (new tier → new features)
2. `useAllCapabilities(tenantId)` — refetch resolved capabilities
3. `useMerchantGates(tenantId)` — refetch merchant gates
4. Dashboard re-renders:
   - Nav items un-hide (the `requiredFeature` filter now passes for unlocked features)
   - KPIs switch from directory-presence to commerce
   - Task checklist switches to the new tier's tasks
   - Upgrade card disappears (no longer on `directory_presence`)

## S2.9. Risks

| Risk | Mitigation |
|---|---|
| Customer-to-user promotion creates duplicate users | Check by email first; if user exists, link instead of create; idempotent on re-claim |
| OAuth-only customer can't log in to platform after promotion | `requiresPasswordSetup` flag → frontend prompts for password → user sets password → platform auth works |
| Platform JWT and customer JWT conflict in frontend storage | Use separate storage keys (platform auth vs customer auth); the `CustomerAuthContext` and platform auth context are already separate |
| Upgrade checkout fails mid-flow | Stripe webhook handles async failures; frontend shows error state with retry; tenant stays on `directory_presence` until checkout succeeds |
| Post-upgrade nav doesn't un-hide | Force `useTenantAccess` refetch after upgrade confirmation; test with real tier change |
| User already owns another tenant | Allow it — `user_tenants` supports multiple tenants per user; the dashboard switcher handles it |
| Claim token consumed but promotion fails | Wrap in transaction: if promotion fails, roll back token consumption + org_standing_mode flip |

## S2.10. Acceptance

- [ ] Customer who accepts a claim is promoted to a platform `users` row (or linked to an existing one)
- [ ] `customers.linked_user_id` is set after promotion
- [ ] `user_tenants` row with `OWNER` role is created linking the user to the claimed tenant
- [ ] Onboarding state is set: `onboarding_step: 'directory_claim_welcome'`
- [ ] Claim success state routes to `/t/[tenantId]/dashboard` (not `/account`)
- [ ] Platform JWT is returned and stored so the dashboard loads authenticated
- [ ] OAuth-only customer is prompted to set a password (`requiresPasswordSetup`)
- [ ] Dashboard shows welcome banner on first visit
- [ ] Dashboard shows filtered nav (from Sprint 1 Phase B) — no dead-end walls
- [ ] Dashboard shows `TierUpgradeCard` for `directory_presence` tenants
- [ ] Tier comparison page shows upgrade options with feature deltas and pricing
- [ ] Upgrade checkout works via Stripe (paid tiers) or instant (free tiers)
- [ ] Post-upgrade: nav un-hides, KPIs switch, task checklist switches
- [ ] Re-claim is idempotent (no duplicate users or user_tenants rows)
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new directory-claim-to-tenant-bridge skill written

## S2.11. The complete loop (end state after both sprints)

```
Operator selects niche + city
  → Intelligence profile resolves seek prompt
    → Intelligence run executes (external agent discovers businesses)
      → City-category opportunity output (sampled businesses + scores + signals)
        → Prospects queued (category_fit + identity_confidence + discovery_signals + provenance)
          → Operator reviews (hold-list filtered, eligibility checked)
            ├─ High digital-opportunity + pain → createCampaignFromQueue → marketing outreach
            └─ Thin footprint + stable identity → createSeedFromQueue → directory seed
                                                                    ↓
                                                              Publish batch
                                                                    ↓
                                                              Claim invite sent
                                                                    ↓
                                                              Owner visits claim link
                                                                    ↓
                                                              Owner registers/logs in (customer auth)
                                                                    ↓
                                                              Owner accepts claim
                                                                    ↓
                                                              Customer promoted to platform user (Sprint 2)
                                                                    ↓
                                                              OWNER role on tenant
                                                                    ↓
                                                              Routed to /t/[tenantId]/dashboard
                                                                    ↓
                                                              Welcome banner + filtered dashboard (Sprint 1)
                                                                    ↓
                                                              Task checklist: verify, hours, logo, SNAP, upgrade
                                                                    ↓
                                                              Owner upgrades to paid tier (Sprint 2)
                                                                    ↓
                                                              Stripe checkout → updateTenantTier
                                                                    ↓
                                                              Capabilities refresh → nav un-hides
                                                                    ↓
                                                              Full dashboard: inventory, orders, checkout, CRM
                                                                    ↓
                                                              Owner is now a paying platform tenant
```

The platform found the business, published its listing, converted the owner, and upgraded them to a paying customer — all from a single intelligence seek run. No external prospecting, no manual data entry, no separate dashboard per niche. The loop is closed.
