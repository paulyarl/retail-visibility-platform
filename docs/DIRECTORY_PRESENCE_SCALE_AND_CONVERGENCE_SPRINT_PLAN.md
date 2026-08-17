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

---

# Sprint 3: Directory Seed Enrichment & Progressive Engagement

**Status:** Planned — not implemented
**Prerequisite:** Sprint 1 (Phases A–F) complete. Sprint 2 (Phases A–E) can be in flight in parallel — Sprint 3 operates on the pre-claim side of the funnel while Sprint 2 operates on the post-claim side. They converge at the claim step.
**Branch context:** `staging`
**Next migration numbers:** `217`–`219`

## S3.1. Problem

Sprint 1 builds the seek-to-seed pipeline. Sprint 2 builds the claim-to-tenant bridge. But between seed and claim, there's a gap: the listing is published with only public-source data (NAP, SNAP from retailer list, category from intelligence profile). The listing may have wrong hours, no photos, no logo, and no owner-confirmed information.

Today's flow is binary: the listing is either unclaimed (operator-seeded, public-source only) or claimed (owner has full control). There's no middle ground where the owner can enrich their listing without committing to a full claim and account creation.

The user's insight is that the directory opens many doors — not just the claim door. The operator can call the business to verify information, complete the listing based on that call, and then send a token-gated self-serve link so the owner can upload photos and correct hours without creating an account. Each step enriches the listing and deepens engagement without requiring commitment. The owner discovers the platform's value through the enrichment experience before being asked to claim.

This sprint builds the progressive engagement funnel: **verify → enrich → claim → upgrade**. Each step is optional, adds value, and lowers the friction of the next.

## S3.2. Non-Goals

- Do not build a new form system — reuse the existing intake portal infrastructure (`mkt_intake_definitions`, `IntakeFormRenderer`, `IntakeDefinitionService`, write-behind adapters)
- Do not require an account for enrichment — the self-serve upload link is token-gated, not auth-gated (same pattern as the recovery intake portal)
- Do not replace the claim flow — enrichment is a pre-claim step that optionally leads to claim
- Do not build a separate outreach tracking system for directory seeds — lightweight status tracking on the seed itself is sufficient (directory seed volume is lower than marketing campaign volume)
- Do not edit `schema.prisma` directly (per repo convention)

## S3.3. Product contract

### S3.3.1. Operator verification workflow

After a seed is published, the operator can:

1. **Mark outreach status** on the seed: `unverified` → `outreach_attempted` → `verified_by_call` → `verified_by_email` → `owner_self_served`
2. **Log outreach attempts**: date, method (call/email/in-person), result, notes
3. **Update listing fields** based on verification: corrected hours, confirmed phone, verified address, owner-confirmed SNAP status
4. **Add provenance rows** with source `owner_verified_call` or `owner_verified_email` (new provenance sources alongside existing `snap_retailer_list`, `owner_confirmed`, `ops_photo`)
5. **Generate an enrichment token** and send it to the owner via email or SMS

The operator verification step is tracked on the seed itself — no separate outreach table needed. The audit log captures each status change.

### S3.3.2. Token-gated self-serve enrichment

The owner receives a link (email or SMS) containing an enrichment token. The link opens a public, token-gated form — **no account required**. The form is rendered by the existing `IntakeFormRenderer` using a new intake definition kind: `directory_presence_enrichment`.

The form asks for:

| Field | Type | Write-behind target |
|---|---|---|
| Business hours | `hours_grid` | `directory_listings_list.hours` + `directory_field_provenance` (field_key: `hours`, source: `owner_self_serve`) |
| Logo or storefront photo | `attachments` | `photo_assets` + `directory_listings_list.logo_url` / `photo_url` + `directory_field_provenance` (field_key: `logo`, source: `owner_self_serve`) |
| Phone correction | `phone` | `directory_listings_list.phone` + `directory_field_provenance` (field_key: `phone`, source: `owner_self_serve`) |
| Website | `url` | `directory_listings_list.website` + `directory_field_provenance` (field_key: `website`, source: `owner_self_serve`) |
| SNAP/EBT confirmation | `checkbox` | `directory_listings_list.snap_ebt_reported` + `snap_ebt_source: 'owner_confirmed'` + `snap_ebt_as_of: now()` + `directory_field_provenance` (field_key: `snap_ebt`, source: `owner_confirmed`) |
| Business description | `textarea` | `directory_listings_list.description` + `directory_field_provenance` (field_key: `description`, source: `owner_self_serve`) |
| Owner name (optional) | `text` | `directory_presence_seeds.owner_name` (new column) — not published, used for claim verification |

The form supports **niche overrides** via `mkt_intake_definitions.niche_overrides` — e.g., the African grocery enrichment form can show culturally relevant category options, while a beauty supply form shows different ones.

### S3.3.3. Progressive engagement states

The seed progresses through enrichment states:

```
unverified (published, public-source data only)
  → outreach_attempted (operator called/emailed, no response yet)
    → verified_by_call (operator spoke with owner, confirmed/corrected info)
      → enrichment_sent (operator sent self-serve upload link)
        → enriched (owner submitted photos/hours via token-gated form)
          → claim_eligible (listing is complete enough to invite claim)
            → claimed (Sprint 2 flow takes over)
```

Each state transition is operator-initiated (except `enriched`, which is owner-initiated via the form submission). The operator can skip states — e.g., go straight from `unverified` to `enrichment_sent` if the listing data is already good enough.

### S3.3.4. Post-enrichment claim CTA

After the owner submits the enrichment form, the success page shows:

> "Your listing is updated! [Business Name] now has your hours, photos, and SNAP status on the [City] [Category] directory. Would you like to claim this listing to get a dashboard where you can manage everything in one place?"

This is the soft claim CTA — the owner has just experienced the platform's value (their listing is now richer) and is offered the next step (claim → dashboard → upgrade) without pressure. The owner can decline and the listing stays enriched.

### S3.3.5. Directory page multi-path engagement

The public directory listing page (`/directory/[slug]`) shows different CTAs depending on the viewer and seed state:

| Viewer | Seed state | CTA shown |
|---|---|---|
| Anyone | unclaimed, unverified | "Is this your business? Contact us to claim it" |
| Anyone | unclaimed, enriched | "Is this your business? Claim this listing" |
| Owner with enrichment token | any unclaimed | Enrichment form (token-gated) |
| Owner who just enriched | any unclaimed | "Your listing is updated! Claim it to get a dashboard" |
| Another business owner | any | "Get listed on this directory" (lead gen — creates a prospect queue entry) |
| Anyone | claimed | Normal directory view (owner-managed) |

The "Get listed" CTA is a lead gen path: a business owner visiting the directory sees other businesses listed and wants their own listing. This creates a prospect queue entry (source_kind: `directory_lead_gen`) that the operator can review and potentially seed — feeding the Sprint 1 loop from the directory's own traffic.

## S3.4. Start-of-phase preflight

Hard rule: every implementation phase ends with `pnpm checkapi` and `pnpm checkweb`. Zero new TS errors.

### S3.4.1. Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Enrichment intake definition | `mkt_intake_definitions` row (data, not code) | Registry-driven — no new code for the form itself |
| Enrichment token | New `directory_enrichment_tokens` table (mirrors `directory_claim_tokens`) | Token-gated, no auth |
| Write-behind adapters | Extend `writeBehindAdapters.ts` with directory-specific adapters | Writes to `directory_listings_list` + `directory_field_provenance` |
| Operator verification UI | Extend admin presence seeds page | Same page, new status/actions |
| Enrichment form | Reuse `IntakeFormRenderer` + `IntakePageClient` | No new form component |
| Post-enrichment CTA | New component on enrichment success page | Soft claim CTA |

### S3.4.2. Skills to read before starting

| Skill | Applied |
|---|---|
| `capability-deployment-flow.md` | Enrichment doesn't change capabilities — but the post-enrichment claim CTA connects to Sprint 2 |
| `manual-sql-migration-policy.md` | SQL-first; `prisma db pull` after apply |
| `tenant-scoped-id-generation.md` | New token ID prefix: `det-` (directory enrichment token) |
| `verify-capability-deployment.md` | Phase E verification |
| `end-of-phase-sprint-checklist.md` | Phase-end checklist |

**AGENTS.md reference (Intake Portal Generalization)**

The existing intake portal infrastructure is documented in AGENTS.md:
- `mkt_intake_definitions` table — declarative `form_schema`, `field_mappings`, `owner_copy`, `niche_overrides` in JSONB
- `IntakeDefinitionService` — loads + caches definitions, builds dynamic Zod schemas from `form_schema`, resolves niche overrides
- `writeBehindAdapters.ts` — maps evidence_payload to existing backend domain models
- `DisputeIntakeService.submitRegistryIntake` — kind-aware idempotency, dynamic Zod validation, write-behind adapters
- `recovery-intake-public.ts` — dispatches to `submitRegistryIntake` for registry kinds; `GET /options` for dynamic option sources
- `IntakeFormRenderer` — generic, registry-driven form renderer (text, url, email, phone, textarea, select, radio, multiselect, checkbox, chips, hours_grid, attachments, number, date, object/nested)
- `IntakePageClient` — detects `context.definition` and renders `IntakeFormRenderer` instead of hardcoded form fields

This sprint adds a new intake kind (`directory_presence_enrichment`) and new write-behind adapters (`directory_listing_write`, `directory_provenance_write`). No new form rendering code.

**Skills to update after implementation (mandatory)**

- `tenant-scoped-id-generation.md` — add `det-` prefix for directory enrichment tokens
- `capability-deployment-flow.md` — note the enrichment flow as a pre-claim engagement path

**New skill to create at phase end**

- `.devin/skills/directory-seed-enrichment-flow.md` — reusable workflow: operator verification → enrichment token → owner self-serve upload → post-enrichment claim CTA. Covers the intake definition kind, write-behind adapters, progressive engagement states, and the multi-path directory page CTAs.

### S3.4.3. ID planning

New ID generator:
- Directory enrichment token: `det-{tk}-{nanoid12}` (mirrors `dct-` claim token pattern)

Existing ID generators reused:
- Field provenance: `dfp-{tk}-{nanoid8}` (existing)

### S3.4.4. Navigation & pages

| Route | Audience | Notes |
|---|---|---|
| `/settings/admin/directory/presence-seeds` | platform admin | **Modified:** outreach status, enrichment token generation, verification logging |
| `/directory/enrich/[token]` | public (token-gated) | **New:** enrichment form (reuses `IntakePageClient` pattern) |
| `/directory/[slug]` | public | **Modified:** multi-path CTAs based on seed state + viewer |
| `/directory/claim/[token]` | public (claimant) | **Unchanged:** Sprint 2's claim flow |

No new sidebar links — enrichment is operator-initiated from the admin seeds page.

### S3.4.5. Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| PATCH | `/api/admin/directory/presence-seeds/:id/outreach` | admin | Update outreach status + log outreach attempt |
| POST | `/api/admin/directory/presence-seeds/:id/enrichment-token` | admin | Generate enrichment token + return link |
| GET | `/api/public/directory/enrich/:token` | public (token) | Resolve enrichment token → seed context + intake definition |
| POST | `/api/public/directory/enrich/:token/submit` | public (token) | Submit enrichment form (dispatches to `submitRegistryIntake`) |
| POST | `/api/public/directory/enrich/:token/attachments` | public (token) | Multipart photo upload (mirrors recovery intake attachments) |
| GET | `/api/public/directory/enrich/:token/options` | public (token) | Dynamic option sources (mirrors recovery intake options) |
| POST | `/api/public/directory/lead-gen` | public | "Get listed" CTA → creates prospect queue entry (source_kind: `directory_lead_gen`) |

**Services to modify**

- `DirectoryPresenceSeedService.ts` — add `updateOutreachStatus`, `generateEnrichmentToken`, enrichment token resolution
- `DisputeIntakeService.ts` (or new `DirectoryEnrichmentIntakeService`) — extend `submitRegistryIntake` for directory enrichment kind
- `writeBehindAdapters.ts` — add `directory_listing_write`, `directory_provenance_write`, `directory_snap_ebt_write` adapters
- `recovery-intake-public.ts` (or new `directory-enrichment-public.ts`) — token-gated public routes for enrichment
- Frontend admin seeds page — outreach status UI, enrichment token generation
- Frontend `IntakePageClient` (or new `DirectoryEnrichmentClient`) — render enrichment form via `IntakeFormRenderer`
- Frontend directory listing page — multi-path CTAs

### S3.4.6. Database

| File | Contents |
|---|---|
| `217_directory_enrichment_tokens.sql` | `directory_enrichment_tokens` table (mirrors `directory_claim_tokens` structure); FK to `directory_presence_seeds`; token string unique index; expires_at index |
| `218_directory_seed_outreach.sql` | Add `outreach_status`, `outreach_notes`, `owner_name`, `owner_email`, `owner_phone` columns to `directory_presence_seeds`; CHECK constraint on `outreach_status` values |
| `219_directory_presence_enrichment_intake.sql` | Data-only: insert `directory_presence_enrichment` intake definition into `mkt_intake_definitions` with form_schema, field_mappings, owner_copy, niche_overrides for African grocery (initial niche) |

After apply (human): staging `prisma db pull && prisma generate`, then same SQL on production.

### S3.4.7. Frontend

| Component | Type | States |
|---|---|---|
| `SeedOutreachPanel` | client | unverified / outreach_attempted / verified / enrichment_sent / enriched — with action buttons per state |
| `DirectoryEnrichmentClient` | client | loading / valid / expired / submitted / error — reuses `IntakeFormRenderer` |
| `DirectoryEnrichmentSuccess` | client | shows updated listing summary + soft claim CTA |
| `DirectoryListingCtas` | client | multi-path CTAs based on seed state + viewer context |
| `DirectoryLeadGenForm` | client | "Get listed" form → creates prospect queue entry |

React Query keys: `['directory-enrichment-token', token]`, `['directory-seed-outreach', seedId]`.

### S3.4.8. Preflight summary block

```
Phase/Sprint: Directory Seed Enrichment & Progressive Engagement — operator verification + token-gated self-serve upload + multi-path directory CTAs
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md (Sprint 3)

New services: updateOutreachStatus, generateEnrichmentToken on DirectoryPresenceSeedService;
              directory_listing_write / directory_provenance_write / directory_snap_ebt_write adapters;
              DirectoryEnrichmentIntakeService (or extend DisputeIntakeService)
New entities: directory_enrichment_tokens; directory_presence_seeds.outreach_status/notes/owner_name/email/phone;
              mkt_intake_definitions row: directory_presence_enrichment
New ID generators needed: det- (directory enrichment token)
New pages/routes: /directory/enrich/[token] (public, token-gated); modified /directory/[slug] (multi-path CTAs);
                  modified /settings/admin/directory/presence-seeds (outreach panel)
New sidebar links: none
New settings cards: SeedOutreachPanel on admin seeds page
New migration: 217–219
New background jobs: none
New capability features: none (enrichment is pre-claim, no capability changes)
Skills to read before starting: manual-sql-migration-policy, tenant-scoped-id-generation,
              verify-capability-deployment, end-of-phase-sprint-checklist
              + AGENTS.md Intake Portal Generalization section
Skills to update after completion:
  - tenant-scoped-id-generation.md (add det- prefix)
  - capability-deployment-flow.md (enrichment as pre-claim engagement path)
New skill to create: .devin/skills/directory-seed-enrichment-flow.md
Insights to capture: the intake portal infrastructure (mkt_intake_definitions + IntakeFormRenderer + write-behind adapters)
      is reusable beyond marketing campaigns — directory seed enrichment is the second use case;
      the progressive engagement funnel (verify → enrich → claim → upgrade) lowers claim friction by letting owners
      experience platform value before committing to an account;
      the directory page itself is a lead gen surface (Get listed CTA) that feeds the Sprint 1 seek loop
```

## S3.5. Implementation phases

### Phase A — Enrichment tokens + intake definition (217, 219)

- Migration 217: `directory_enrichment_tokens` table (mirrors `directory_claim_tokens`):
  - `id VARCHAR(60)` (det- prefix)
  - `seed_id VARCHAR(60)` FK to `directory_presence_seeds`
  - `tenant_id VARCHAR(255)` FK to `tenants`
  - `token VARCHAR(255)` UNIQUE
  - `expires_at TIMESTAMPTZ`
  - `consumed_at TIMESTAMPTZ NULL`
  - `single_use BOOLEAN DEFAULT false` (enrichment tokens are multi-use — owner can submit multiple times)
  - `created_at TIMESTAMPTZ DEFAULT now()`
- Migration 219: insert `directory_presence_enrichment` intake definition into `mkt_intake_definitions`:
  - `intake_kind: 'directory_presence_enrichment'`
  - `label: 'Directory Listing Enrichment'`
  - `driver: 'registry'`
  - `form_schema`: hours_grid, attachments (logo/photo), phone, url (website), checkbox (SNAP confirmation), textarea (description), text (owner_name)
  - `field_mappings`: map each form field to its write-behind adapter
  - `owner_copy`: "Thank you for updating your listing. Your information will appear on the [City] [Category] directory."
  - `niche_overrides`: initial override for African grocery (category-specific labels)
- Implement `generateEnrichmentToken(seedId, ctx)` on `DirectoryPresenceSeedService`:
  - Create token row (multi-use, 90-day expiry)
  - Return `{ token, expiresAt }`
- Implement enrichment token resolution (GET `/api/public/directory/enrich/:token`):
  - Resolve token → seed → listing context
  - Load intake definition for `directory_presence_enrichment`
  - Return `{ seedId, tenantId, businessName, category, city, intakeDefinition }`
- Tests: token generation, token resolution, expired token, consumed token (multi-use so not blocked), intake definition loads correctly

### Phase B — Write-behind adapters + form submission (218)

- Migration 218: add `outreach_status`, `outreach_notes`, `owner_name`, `owner_email`, `owner_phone` to `directory_presence_seeds`
- Implement write-behind adapters in `writeBehindAdapters.ts`:
  - `directory_listing_write`: writes form field values to `directory_listings_list` (hours, phone, website, description, logo_url)
  - `directory_provenance_write`: creates `directory_field_provenance` rows for each written field (source: `owner_self_serve`, show_on_public: true)
  - `directory_snap_ebt_write`: updates `snap_ebt_reported`, `snap_ebt_source: 'owner_confirmed'`, `snap_ebt_as_of: now()`, `snap_ebt_source_name: owner_name`
- Implement enrichment form submission (POST `/api/public/directory/enrich/:token/submit`):
  - Validate token (not expired, not consumed if single_use)
  - Load intake definition → build Zod schema from `form_schema`
  - Validate submitted data against schema
  - Run write-behind adapters for each field
  - Update seed: `outreach_status = 'enriched'`, `owner_name`/`owner_email`/`owner_phone` from form
  - Mark token consumed (if single_use) or record submission (if multi-use)
  - Return success with updated listing summary
- Implement attachment upload (POST `/api/public/directory/enrich/:token/attachments`):
  - Multipart upload (mirrors recovery intake attachments)
  - Store in `photo_assets` linked to the tenant
  - Update `directory_listings_list.logo_url` or `photo_url`
  - Create provenance row (field_key: `logo`/`photo`, source: `owner_self_serve`)
- Tests: form submission writes to listing + provenance; SNAP confirmation updates snap fields; photo upload creates photo_asset + updates listing; niche override labels render correctly

### Phase C — Operator verification UI

- Extend admin presence seeds page with `SeedOutreachPanel`:
  - Shows current `outreach_status` with color-coded badge
  - Action buttons per state:
    - `unverified` → "Log outreach call" (opens form: method, result, notes)
    - `outreach_attempted` → "Log follow-up" / "Mark verified"
    - `verified_by_call` → "Send enrichment link" (generates token + shows link to copy/email/SMS)
    - `enrichment_sent` → "View enrichment status" (shows whether owner has submitted)
    - `enriched` → "Invite to claim" (generates claim token — Sprint 2 flow)
  - Outreach log: expandable history of outreach attempts (date, method, result, notes)
  - Owner contact info: shows `owner_name`, `owner_email`, `owner_phone` if captured
- Backend: `PATCH /api/admin/directory/presence-seeds/:id/outreach`:
  - Accept `{ status, method, result, notes, ownerName, ownerEmail, ownerPhone }`
  - Update seed columns
  - Audit log the status change
- Tests: status transitions; outreach log rendering; enrichment token generation from UI

### Phase D — Enrichment form + post-enrichment CTA

- New page: `/directory/enrich/[token]` (public, token-gated):
  - `DirectoryEnrichmentClient`:
    - Loading: resolve token → seed context + intake definition
    - Valid: render `IntakeFormRenderer` with the definition
    - Expired: show expired message with "request a new link" CTA
    - Submitted: show `DirectoryEnrichmentSuccess` with updated listing summary + soft claim CTA
    - Error: show error with retry
- `DirectoryEnrichmentSuccess`:
  - "Your listing is updated! [Business Name] now has your hours, photos, and SNAP status on the [City] [Category] directory."
  - Show before/after summary of what was updated
  - Soft claim CTA: "Would you like to claim this listing to get a dashboard where you can manage everything in one place?"
    - "Claim this listing" → links to `/directory/claim/[claimToken]` (if a claim token exists for this seed)
    - "No thanks, just keep my listing updated" → links back to `/directory/[slug]`
- Tests: form renders from intake definition; submission writes data; success page shows summary + claim CTA; expired token shows correct message

### Phase E — Directory page multi-path CTAs

- Modify directory listing page (`/directory/[slug]` or `DirectoryEntryClassicLayout`):
  - Add `DirectoryListingCtas` component that renders different CTAs based on:
    - Seed state (unverified / enriched / claimed)
    - Viewer context (has enrichment token? is authenticated? is the owner?)
  - CTAs:
    - Unclaimed, unverified: "Is this your business? Contact us to claim it" → links to a contact form or `/directory/claim/request`
    - Unclaimed, enriched: "Is this your business? Claim this listing" → links to claim flow
    - Claimed: no CTA (normal directory view)
    - "Get listed on this directory" (always shown for non-owners): → `DirectoryLeadGenForm`
- `DirectoryLeadGenForm`:
  - Simple form: business name, category, city, phone/email
  - On submit: creates a prospect queue entry (source_kind: `directory_lead_gen`, scope: `business`)
  - Success: "Thanks! We'll review your business and reach out about getting you listed."
  - Backend: `POST /api/public/directory/lead-gen` → `MarketingProspectQueueService.addToQueue` with `source_kind: 'directory_lead_gen'`
- Tests: CTAs render correctly per state; lead gen form creates prospect queue entry; lead gen prospect appears in operator queue

### Phase F — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- End-to-end: seed published → operator logs outreach call → operator sends enrichment link → owner opens link → owner uploads photos/hours/SNAP → listing updates on directory → owner sees claim CTA → owner claims (Sprint 2 flow)
- Enrichment form renders from intake definition (no hardcoded fields)
- Write-behind adapters update listing + provenance correctly
- Niche overrides render category-specific labels
- Directory page shows correct CTAs per seed state
- Lead gen form creates prospect queue entry visible to operator
- Multi-use enrichment token allows multiple submissions
- End-of-phase checklist
- Create `.devin/skills/directory-seed-enrichment-flow.md`
- Update `tenant-scoped-id-generation.md` (add `det-` prefix)
- Update `capability-deployment-flow.md` (enrichment as pre-claim path)

## S3.6. Schema sketch

### `directory_enrichment_tokens` (217)

```sql
CREATE TABLE IF NOT EXISTS directory_enrichment_tokens (
  id          VARCHAR(60) PRIMARY KEY,
  seed_id     VARCHAR(60) NOT NULL REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  single_use  BOOLEAN NOT NULL DEFAULT FALSE,  -- enrichment is multi-use
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_det_expires ON directory_enrichment_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_det_seed ON directory_enrichment_tokens (seed_id);
CREATE INDEX IF NOT EXISTS idx_det_token ON directory_enrichment_tokens (token);
```

### `directory_presence_seeds` additions (218)

| Column | Type | Notes |
|---|---|---|
| `outreach_status` | VARCHAR(20) DEFAULT 'unverified' | `unverified` / `outreach_attempted` / `verified_by_call` / `verified_by_email` / `enrichment_sent` / `enriched` |
| `outreach_notes` | TEXT NULL | Operator notes from verification calls |
| `owner_name` | VARCHAR(255) NULL | Captured during verification or enrichment |
| `owner_email` | VARCHAR(255) NULL | For sending enrichment/claim links |
| `owner_phone` | VARCHAR(40) NULL | For SMS enrichment/claim links |

```sql
ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS outreach_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS outreach_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(40) NULL;

ALTER TABLE directory_presence_seeds
  DROP CONSTRAINT IF EXISTS chk_dps_outreach_status;
ALTER TABLE directory_presence_seeds
  ADD CONSTRAINT chk_dps_outreach_status
  CHECK (outreach_status IN ('unverified', 'outreach_attempted', 'verified_by_call',
    'verified_by_email', 'enrichment_sent', 'enriched'));
```

### `mkt_intake_definitions` row (219 — data only)

```sql
INSERT INTO mkt_intake_definitions (intake_kind, label, description, driver, form_schema, field_mappings, owner_copy, niche_overrides, is_active, is_draft)
VALUES (
  'directory_presence_enrichment',
  'Directory Listing Enrichment',
  'Token-gated self-serve form for business owners to enrich their unclaimed directory listing.',
  'registry',
  '[...]'::jsonb,  -- form_schema: hours_grid, attachments, phone, url, checkbox, textarea, text
  '[...]'::jsonb,  -- field_mappings: each field → write-behind adapter name
  '{"title": "Update Your Listing", "body": "Thank you for updating your listing. Your information will appear on the directory."}'::jsonb,
  '{}'::jsonb,     -- niche_overrides: populated per category (African grocery initial)
  true,
  false
)
ON CONFLICT (intake_kind) DO NOTHING;
```

## S3.7. Write-behind adapter detail

### `directory_listing_write`

```ts
// writeBehindAdapters.ts
directory_listing_write: async (value: any, adapterCtx: AdapterContext) => {
  // adapterCtx.tenantId is the seed's tenant (directory_seed standing mode)
  // value is the form field value (e.g., phone number, website URL, description)
  // The field_key is passed via the field_mapping configuration
  const { fieldKey } = value;  // from field_mappings

  await prisma.$executeRaw`
    UPDATE directory_listings_list
    SET ${fieldKey} = ${value.value}, updated_at = now()
    WHERE tenant_id = ${adapterCtx.tenantId}
  `;
},
```

### `directory_provenance_write`

```ts
directory_provenance_write: async (value: any, adapterCtx: AdapterContext) => {
  const provenanceId = generateDirectoryFieldProvenanceId(adapterCtx.tenantId);
  const seed = await prisma.$queryRaw<any[]>`
    SELECT id FROM directory_presence_seeds WHERE tenant_id = ${adapterCtx.tenantId} LIMIT 1
  `;

  await prisma.$executeRaw`
    INSERT INTO directory_field_provenance (
      id, seed_id, tenant_id, field_key, value,
      source_name, accessed_at, confidence, show_on_public,
      created_at, updated_at
    ) VALUES (
      ${provenanceId},
      ${seed[0].id},
      ${adapterCtx.tenantId},
      ${value.fieldKey},
      ${value.value},
      'Owner self-serve',
      now(),
      'high',
      true,
      now(), now()
    )
    ON CONFLICT (seed_id, field_key) DO UPDATE
    SET value = EXCLUDED.value, source_name = EXCLUDED.source_name,
        accessed_at = EXCLUDED.accessed_at, updated_at = now()
  `;
},
```

### `directory_snap_ebt_write`

```ts
directory_snap_ebt_write: async (value: any, adapterCtx: AdapterContext) => {
  if (!value) return;  // checkbox unchecked → no change

  await prisma.$executeRaw`
    UPDATE directory_listings_list
    SET snap_ebt_reported = true,
        snap_ebt_source = 'owner_confirmed',
        snap_ebt_as_of = now(),
        snap_ebt_source_name = 'Owner self-serve',
        updated_at = now()
    WHERE tenant_id = ${adapterCtx.tenantId}
  `;
},
```

## S3.8. Progressive engagement state machine

```
                    ┌─────────────┐
                    │  unverified  │ (published, public-source data only)
                    └──────┬──────┘
                           │ operator logs outreach call
                           ▼
                    ┌──────────────────┐
                    │ outreach_attempted │
                    └──────┬───────────┘
                           │ operator reaches owner, verifies info
                           ▼
                    ┌─────────────────┐
                    │ verified_by_call │ (operator updates listing fields)
                    └──────┬──────────┘
                           │ operator generates enrichment token + sends link
                           ▼
                    ┌─────────────────┐
                    │ enrichment_sent  │
                    └──────┬──────────┘
                           │ owner submits enrichment form
                           ▼
                    ┌──────────┐
                    │ enriched  │ (listing has owner-submitted photos/hours/SNAP)
                    └──────┬───┘
                           │ operator generates claim token + sends invite
                           ▼
                    ┌──────────────────┐
                    │ claim_eligible     │ (Sprint 2 claim flow takes over)
                    └──────┬───────────┘
                           │ owner accepts claim
                           ▼
                    ┌──────────┐
                    │  claimed  │ (Sprint 2: promoted to tenant → dashboard → upgrade)
                    └──────────┘
```

**Shortcut paths (operator can skip states):**
- `unverified` → `enrichment_sent` (skip call if listing data is already good)
- `unverified` → `claim_eligible` (skip enrichment if owner is ready to claim immediately)
- `enriched` → `claimed` (owner claims directly from enrichment success page)

## S3.9. Risks

| Risk | Mitigation |
|---|---|
| Enrichment form submission fails mid-write | Wrap write-behind adapters in a transaction; evidence_payload on the intake row is the system of record if adapters fail |
| Owner submits enrichment but never claims | The listing is still enriched — value is captured regardless of claim conversion; the enriched listing is a better directory page and a stronger claim CTA |
| Multi-use enrichment token is shared publicly | Token is tied to a specific seed; sharing it only lets someone else enrich that listing (low risk); operator can revoke by consuming the token |
| Lead gen form is abused for spam prospects | Rate-limit by IP; prospect queue entries from `directory_lead_gen` are reviewed by operator before seeding (same hold-list discipline as intelligence seek) |
| Niche overrides are wrong for a new category | Intake definition is versioned and editable; operator can update `niche_overrides` per category without code changes |
| Write-behind adapter writes to wrong listing | Adapter is tenant-scoped via `adapterCtx.tenantId`; the enrichment token resolves to one seed → one tenant → one listing |

## S3.10. Acceptance

- [ ] Operator can log outreach calls and update outreach status on a seed
- [ ] Operator can generate an enrichment token and send it to the owner
- [ ] Owner can open the enrichment link without creating an account
- [ ] Enrichment form renders from the `directory_presence_enrichment` intake definition (no hardcoded fields)
- [ ] Owner can submit hours, photos, phone, website, SNAP confirmation, and description
- [ ] Write-behind adapters update `directory_listings_list` + `directory_field_provenance` correctly
- [ ] SNAP confirmation sets `snap_ebt_source: 'owner_confirmed'` with today's date
- [ ] Niche overrides render category-specific labels (African grocery initial)
- [ ] Post-enrichment success page shows updated listing summary + soft claim CTA
- [ ] Directory listing page shows correct CTAs per seed state
- [ ] "Get listed" CTA creates a prospect queue entry visible to the operator
- [ ] Multi-use enrichment token allows multiple submissions
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new directory-seed-enrichment-flow skill written

## S3.11. The complete three-sprint loop (end state)

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
                                                    ┌─ Sprint 3: Progressive engagement ─┐
                                                    │                                     │
                                                    │  Operator calls to verify           │
                                                    │    → Updates listing fields         │
                                                    │    → Adds provenance (owner_verified)│
                                                    │                                     │
                                                    │  Operator sends enrichment link     │
                                                    │    → Owner uploads photos/hours     │
                                                    │    → No account needed              │
                                                    │    → Listing enriches on directory  │
                                                    │                                     │
                                                    │  Owner sees claim CTA               │
                                                    │    → "Your listing is updated!      │
                                                    │       Claim it to get a dashboard"  │
                                                    └──────────────┬──────────────────────┘
                                                                   ↓
                                                    ┌─ Sprint 2: Claim-to-tenant bridge ─┐
                                                    │                                     │
                                                    │  Owner accepts claim                │
                                                    │    → Customer promoted to user      │
                                                    │    → OWNER role on tenant           │
                                                    │    → Routed to /t/[tenantId]/dashboard│
                                                    │                                     │
                                                    │  Dashboard: welcome banner          │
                                                    │    → Filtered nav (no walls)        │
                                                    │    → Task checklist                 │
                                                    │    → Upgrade card                   │
                                                    │                                     │
                                                    │  Owner upgrades to paid tier        │
                                                    │    → Stripe checkout                │
                                                    │    → Capabilities refresh           │
                                                    │    → Full dashboard: inventory,     │
                                                    │      orders, checkout, CRM          │
                                                    └──────────────┬──────────────────────┘
                                                                   ↓
                                                    ┌─ Directory page: lead gen ─────────┐
                                                    │                                     │
                                                    │  Another business owner visits      │
                                                    │    → Sees enriched listings         │
                                                    │    → "Get listed" CTA               │
                                                    │    → Prospect queue entry created   │
                                                    │    → Feeds back into Sprint 1 seek  │
                                                    └─────────────────────────────────────┘
```

The platform finds businesses, publishes their listings, verifies and enriches them with owner help, converts owners to tenants, upgrades them to paying customers, and uses the directory's own traffic to find the next batch of businesses. Three sprints, one self-contained ecosystem, zero external prospecting. The directory opens many doors — and every door leads back into the platform.

---

# Cross-Cutting: Token Identity Verification

**Status:** Planned — not implemented
**Prerequisite:** Must be implemented as part of Sprint 2 (claim tokens) and Sprint 3 (enrichment tokens). This is not a separate sprint — it is a security layer that modifies both.
**Branch context:** `staging`
**Migration numbers:** Integrated into Sprint 2 (214) and Sprint 3 (217) migrations

## C1. Problem

Both the claim token (Sprint 2 / existing) and the enrichment token (Sprint 3) are bare URL tokens. Anyone who obtains the URL can:

- **Claim token**: Claim the business as their own, get an OWNER role, and take control of that business's public identity on the platform. This is business identity theft.
- **Enrichment token**: Upload wrong hours, inappropriate photos, or false SNAP confirmation to a listing they don't own. Lower risk (correctable, no identity bound) but still an abuse vector.

The current `DirectoryClaimService.acceptClaim` checks only:
- Token is valid and not expired
- Token is not consumed (single_use)
- Seed status is not already 'claimed'

It does **not** verify that the claimant is the actual business owner. The `userId` parameter is any authenticated user — customer or platform. There is no proof-of-ownership step.

Tokens can leak via:
- URL guessing (unlikely with nanoid, but not impossible)
- Email forwarding (owner forwards the link to someone else)
- Shared inbox (multiple employees see the email)
- Browser history on a shared computer
- Screenshots or social media posts

## C2. Solution: Bound tokens + OTP verification

### C2.1. Claim tokens become identity-bound

When the operator generates a claim token (via `inviteSeed` or the Sprint 3 enrichment → claim handoff), the token is bound to a specific email or phone number captured during the Sprint 3 verification step.

**Schema change** (integrated into migration 214):

```sql
ALTER TABLE directory_claim_tokens
  ADD COLUMN IF NOT EXISTS bound_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS bound_phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN NOT NULL DEFAULT TRUE;
```

- `bound_email` / `bound_phone`: the contact info the operator captured during verification (Sprint 3 `owner_email` / `owner_phone`). At least one must be set if `verification_required` is true.
- `verification_required`: defaults to true. Set to false only when the operator manually overrides (e.g., in-person verification where the operator hands the owner a device and watches them claim).

### C2.2. Claim flow requires OTP

The claim accept endpoint changes from a single-step to a two-step flow:

**Step 1: Initiate claim** (`POST /api/public/directory/claim/:token/initiate`)
- Validates token (not expired, not consumed)
- If `verification_required` is true:
  - Sends an OTP to the bound email or phone (6-digit code, 10-minute expiry)
  - Returns `{ verificationRequired: true, sentTo: maskedEmailOrPhone }`
- If `verification_required` is false:
  - Proceeds directly to step 2 (operator-verified, no OTP needed)
  - Returns `{ verificationRequired: false }`

**Step 2: Accept claim** (`POST /api/public/directory/claim/:token/accept`)
- If `verification_required` is true:
  - Requires `otpCode` in the request body
  - Validates the OTP against the bound email/phone
  - If OTP is invalid or expired → 403 `invalid_otp`
  - If OTP is valid → proceeds with the existing claim logic (consume token, flip org_standing_mode, promote customer to user, create OWNER role)
- If `verification_required` is false:
  - Proceeds with the existing claim logic (no OTP needed)

**OTP storage**: Use a lightweight `directory_claim_otps` table (or Redis if available):

```sql
CREATE TABLE IF NOT EXISTS directory_claim_otps (
  id           VARCHAR(60) PRIMARY KEY,
  token_id     VARCHAR(60) NOT NULL REFERENCES directory_claim_tokens(id) ON DELETE CASCADE,
  code_hash    VARCHAR(255) NOT NULL,  -- bcrypt hash of the 6-digit code
  delivery_method VARCHAR(10) NOT NULL,  -- 'email' or 'sms'
  delivery_target VARCHAR(255) NOT NULL,  -- the email or phone (masked in responses)
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ NULL,
  attempts     INT NOT NULL DEFAULT 0,  -- track failed attempts
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dco_token ON directory_claim_otps (token_id);
CREATE INDEX IF NOT EXISTS idx_dco_expires ON directory_claim_otps (expires_at);
```

- Max 3 attempts per OTP; after 3 failures, the OTP is invalidated and a new one must be initiated
- 10-minute expiry
- Code is bcrypt-hashed (never stored in plaintext)
- One active OTP per token at a time (initiating a new one invalidates the previous)

### C2.3. Enrichment tokens get optional binding

Enrichment tokens are lower risk (additive, not identity-binding), but should still be protected when possible.

**Schema change** (integrated into migration 217):

```sql
ALTER TABLE directory_enrichment_tokens
  ADD COLUMN IF NOT EXISTS bound_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS bound_phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submission_review_required BOOLEAN NOT NULL DEFAULT TRUE;
```

- `bound_email` / `bound_phone`: if the operator has the owner's contact info, the enrichment token is bound to it. If not, the token is unbound.
- `verification_required`: defaults to false for enrichment (lower risk). Set to true if the operator wants OTP for enrichment.
- `submission_review_required`: defaults to true. If the enrichment token is unbound (no owner contact info), submissions go to a `pending_review` state rather than going live immediately. The operator reviews and approves before the listing updates. If the token is bound and verified, submissions can go live immediately (set `submission_review_required` to false).

**Enrichment submission flow**:

- If `verification_required` is true → same OTP flow as claim (initiate → submit with OTP)
- If `verification_required` is false but `submission_review_required` is true:
  - Submission is stored in `evidence_payload` on the intake row
  - Write-behind adapters do NOT run immediately
  - Seed `outreach_status` stays at `enrichment_sent` (not `enriched`)
  - Operator sees a "Pending enrichment review" notification
  - Operator reviews the submission → approves → write-behind adapters run → listing updates → seed status → `enriched`
  - Operator rejects → submission discarded → owner notified
- If both are false (operator-verified, in-person enrichment) → submissions go live immediately

### C2.4. Operator verification is the trust anchor

The identity verification layer depends on the operator capturing the owner's contact info during the Sprint 3 verification step. The trust chain is:

```
Operator calls the business (Sprint 3 Phase C)
  → Operator speaks with someone at the business
    → Operator confirms they're the owner (operator judgment)
      → Operator captures owner_email or owner_phone
        → Operator generates claim token (bound to that email/phone)
          → Claim token requires OTP sent to that email/phone
            → Only the person who controls that email/phone can claim
```

If the operator doesn't have contact info (no answer, or owner isn't ready to claim):
- Claim token is generated without binding (`verification_required: false`, `bound_email: null`)
- But `submission_review_required` is true for enrichment, and the claim itself requires **operator manual approval** as a fallback

**Operator manual approval claim path** (when no bound email/phone):

```
Owner finds claim link (via directory page CTA, not operator invite)
  → Owner initiates claim
    → System sees: no bound email/phone, verification_required: false
      → BUT: operator_approval_required: true (new flag, defaults to true when no bound contact)
        → Claim is held in 'pending_approval' state
          → Operator gets notification: "Someone is trying to claim [Business Name]"
            → Operator reviews: does this person seem legitimate?
              ├─ Approve → claim proceeds (promote to user, OWNER role)
              └─ Reject → claim denied, token consumed, owner notified
```

This covers the case where someone finds the claim link on the directory page (not via operator invite) and tries to claim. The operator acts as the trust gatekeeper.

### C2.5. Three claim paths

After this security layer, there are three claim paths with different trust levels:

| Path | How the owner gets the link | Verification | Trust level |
|---|---|---|---|
| **Operator-invited (verified)** | Operator calls business, captures email/phone, sends bound claim token | OTP to bound email/phone | High — operator verified the contact info |
| **Operator-invited (unverified)** | Operator sends claim token without bound contact (no answer on call) | Operator manual approval | Medium — operator reviews the claimant |
| **Self-discovered** | Owner finds "Claim this listing" CTA on the directory page | Operator manual approval + proof of ownership | Low → Medium — operator reviews + may ask for proof |

**Proof of ownership** (for self-discovered claims): the operator can ask the claimant to verify one of:
- They receive a call/text at the business's listed phone number
- They can send an email from the business's website domain
- They have a business license or utility bill matching the listing address
- They are listed as the business owner on a public registry (state filing, GBP, etc.)

This is a manual step — the operator reviews the proof and approves or rejects. It's not automated, but it's the safety net for self-discovered claims.

## C3. Schema changes summary

### `directory_claim_tokens` additions (in migration 214)

| Column | Type | Notes |
|---|---|---|
| `bound_email` | VARCHAR(255) NULL | Email the OTP is sent to; set during operator verification |
| `bound_phone` | VARCHAR(40) NULL | Phone the OTP is sent to; set during operator verification |
| `verification_required` | BOOLEAN DEFAULT TRUE | If true, OTP is required before claim is accepted |
| `operator_approval_required` | BOOLEAN DEFAULT FALSE | If true (set when no bound contact), claim is held for operator approval |

### `directory_claim_otps` (new table, in migration 214)

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(60) PK | |
| `token_id` | VARCHAR(60) FK → `directory_claim_tokens` | |
| `code_hash` | VARCHAR(255) | bcrypt hash of 6-digit code |
| `delivery_method` | VARCHAR(10) | `email` or `sms` |
| `delivery_target` | VARCHAR(255) | The email or phone (masked in API responses) |
| `expires_at` | TIMESTAMPTZ | 10-minute expiry |
| `consumed_at` | TIMESTAMPTZ NULL | Set when OTP is used |
| `attempts` | INT DEFAULT 0 | Max 3 before invalidation |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### `directory_enrichment_tokens` additions (in migration 217)

| Column | Type | Notes |
|---|---|---|
| `bound_email` | VARCHAR(255) NULL | Optional — if set, OTP may be required |
| `bound_phone` | VARCHAR(40) NULL | Optional — if set, OTP may be required |
| `verification_required` | BOOLEAN DEFAULT FALSE | Lower bar for enrichment (additive, not identity-binding) |
| `submission_review_required` | BOOLEAN DEFAULT TRUE | If true, submissions are held for operator review before going live |

### `directory_presence_seeds` additions (in migration 218, already planned)

The `owner_email` and `owner_phone` columns from Sprint 3 Phase B are the source of the bound email/phone for claim tokens. When the operator generates a claim token via `inviteSeed`, the token is automatically bound to the seed's `owner_email` or `owner_phone` if either is set.

## C4. Modified claim flow

### C4.1. `DirectoryClaimService` changes

```ts
// New method: initiate claim (sends OTP if verification required)
async initiateClaim(
  token: string,
  ctx?: ClaimAuditCtx
): Promise<{
  verificationRequired: boolean;
  sentTo?: string;  // masked email/phone
  operatorApprovalRequired?: boolean;
}> {
  // 1. Load token + seed
  // 2. Check not expired, not consumed
  // 3. If verification_required && (bound_email || bound_phone):
  //    - Generate 6-digit OTP, bcrypt hash, store in directory_claim_otps
  //    - Send OTP via email or SMS
  //    - Return { verificationRequired: true, sentTo: mask(bound_email || bound_phone) }
  // 4. If !verification_required && operator_approval_required:
  //    - Return { verificationRequired: false, operatorApprovalRequired: true }
  // 5. If !verification_required && !operator_approval_required:
  //    - Return { verificationRequired: false }
}

// Modified method: accept claim (now requires OTP if verification was required)
async acceptClaim(
  token: string,
  userId: string,
  otpCode?: string,  // NEW parameter
  ctx?: ClaimAuditCtx
): Promise<ClaimResult> {
  // 1. Load token + seed (existing checks: not expired, not consumed, not claimed)
  // 2. If verification_required:
  //    - Require otpCode in request
  //    - Load active OTP for this token (not consumed, not expired, attempts < 3)
  //    - bcrypt.compare(otpCode, otp.code_hash)
  //    - If match: consume OTP, proceed
  //    - If no match: increment attempts, return { success: false, message: 'invalid_otp' }
  //    - If attempts >= 3: invalidate OTP, return { success: false, message: 'otp_max_attempts' }
  // 3. If operator_approval_required:
  //    - Create a 'pending_approval' claim record (new status on seed or separate table)
  //    - Notify operator
  //    - Return { success: false, message: 'pending_operator_approval' } (not an error — it's a pending state)
  //    - Operator approves separately via admin endpoint
  // 4. If neither: proceed with existing claim logic (consume token, flip mode, promote, OWNER role)
}
```

### C4.2. Route changes

```ts
// NEW: POST /api/public/directory/claim/:token/initiate
router.post('/claim/:token/initiate', async (req, res) => {
  const { token } = req.params;
  const result = await DirectoryClaimService.initiateClaim(token, { ... });
  res.json({ success: true, ...result });
});

// MODIFIED: POST /api/public/directory/claim/:token/accept
router.post('/claim/:token/accept', async (req, res) => {
  const { token } = req.params;
  const { otpCode } = req.body;  // NEW
  const userId = (req as any).user?.id || (req as any).customer?.id;
  if (!userId) return res.status(401).json({ error: 'authentication_required' });
  const result = await DirectoryClaimService.acceptClaim(token, userId, otpCode, { ... });
  // ... existing status mapping + new: 'invalid_otp' → 403, 'otp_max_attempts' → 429,
  //     'pending_operator_approval' → 202 (accepted but pending)
});

// NEW: POST /api/admin/directory/claims/:claimId/approve (admin)
router.post('/claims/:claimId/approve', requirePlatformAdmin, async (req, res) => {
  // Operator reviews pending claim → approves → claim proceeds (promote + OWNER)
});

// NEW: POST /api/admin/directory/claims/:claimId/reject (admin)
router.post('/claims/:claimId/reject', requirePlatformAdmin, async (req, res) => {
  // Operator rejects → claim denied, token consumed, owner notified
});
```

### C4.3. Frontend changes

`DirectoryClaimClient.tsx` gets a new state machine:

```
loading → valid → initiating (sending OTP) → otp_sent (enter code) → accepting → success
                                                              ↓
                                                         invalid_otp (retry, max 3)
                                                              ↓
                                                         otp_max_attempts (re-initiate)

valid → accepting (no OTP needed) → success
                            ↓
                      pending_approval (waiting for operator)
```

New UI states:
- **OTP entry**: 6-digit code input + "Verify" button + "Resend code" link
- **Pending approval**: "Your claim request has been submitted. Our team will review it and contact you within 1-2 business days."
- **Invalid OTP**: "Incorrect code. You have X attempts remaining."
- **Max attempts**: "Too many attempts. Please request a new code."

## C5. Modified enrichment flow

### C5.1. Enrichment submission with review

When `submission_review_required` is true (default for unbound tokens):

```ts
// POST /api/public/directory/enrich/:token/submit
async submitEnrichment(token: string, data: any, ctx?: RequestCtx) {
  // 1. Validate token
  // 2. If verification_required: validate OTP (same as claim)
  // 3. Validate data against intake definition Zod schema
  // 4. Store evidence_payload on the intake row (always — system of record)
  // 5. If submission_review_required:
  //    - Do NOT run write-behind adapters
  //    - Set seed outreach_status to 'enrichment_pending_review' (new status)
  //    - Notify operator: "Enrichment submission pending review for [Business Name]"
  //    - Return { success: true, status: 'pending_review' }
  // 6. If !submission_review_required:
  //    - Run write-behind adapters immediately
  //    - Set seed outreach_status to 'enriched'
  //    - Return { success: true, status: 'enriched' }
}
```

### C5.2. Operator review of enrichment submissions

New admin endpoint + UI:

```ts
// GET /api/admin/directory/enrichment-reviews — list pending submissions
// POST /api/admin/directory/enrichment-reviews/:id/approve — run write-behind adapters, update listing
// POST /api/admin/directory/enrichment-reviews/:id/reject — discard submission, notify owner
```

Admin UI: a "Pending Enrichment Reviews" panel on the seeds page showing submitted data with approve/reject buttons.

## C6. Trust levels summary

| Token type | Bound? | OTP? | Review? | Trust level | Can go live immediately? |
|---|---|---|---|---|---|
| Claim (operator-verified) | Yes (email/phone) | Yes | No | High | Yes (after OTP) |
| Claim (operator-invited, unverified) | No | No | Yes (operator approval) | Medium | No (operator approves) |
| Claim (self-discovered) | No | No | Yes (operator approval + proof) | Low | No (operator approves) |
| Enrichment (bound + verified) | Yes | Yes | No | High | Yes (after OTP) |
| Enrichment (unbound) | No | No | Yes (operator review) | Medium | No (operator reviews) |
| Enrichment (operator-verified, in-person) | No | No | No (operator override) | High | Yes (operator trusts) |

## C7. Implementation integration

This security layer is integrated into Sprint 2 and Sprint 3, not implemented separately:

| Change | Sprint | Phase | Migration |
|---|---|---|---|
| `directory_claim_tokens` bound columns + `directory_claim_otps` table | Sprint 2 | Phase A (214) | 214 |
| `DirectoryClaimService.initiateClaim` + modified `acceptClaim` | Sprint 2 | Phase A | — |
| Claim route changes (initiate endpoint, OTP in accept) | Sprint 2 | Phase A | — |
| Frontend OTP entry + pending approval states | Sprint 2 | Phase B | — |
| Operator claim approval admin endpoint + UI | Sprint 2 | Phase D | — |
| `directory_enrichment_tokens` bound + review columns | Sprint 3 | Phase A (217) | 217 |
| Enrichment submission review flow | Sprint 3 | Phase B | — |
| Operator enrichment review admin endpoint + UI | Sprint 3 | Phase C | — |
| `directory_presence_seeds.outreach_status` gains `enrichment_pending_review` | Sprint 3 | Phase B (218) | 218 |

## C8. Risks

| Risk | Mitigation |
|---|---|
| OTP delivery fails (email bounces, SMS undeliverable) | Fallback to operator manual approval; operator can re-verify contact info and re-generate token |
| Operator is the bottleneck for manual approvals | Notifications + simple approve/reject UI; SLA target 1-2 business days; auto-approve after 7 days if no response (configurable) |
| Bound email is wrong (operator mistyped) | Operator can re-generate token with corrected email; old token is invalidated |
| Attacker intercepts OTP (email compromise) | Out of scope for this layer — email security is the owner's responsibility; the OTP raises the bar significantly vs. bare URL token |
| Self-discovered claims overwhelm operator with approvals | Rate-limit claim initiations by IP; require proof of ownership for self-discovered claims; operator can disable self-discovered claims per seed |
| Enrichment review backlog grows | Auto-approve low-risk fields (hours, phone) after 3 days; only hold photos and SNAP confirmation for manual review |

## C9. Acceptance

- [ ] Claim token generated with bound email/phone requires OTP before accepting
- [ ] Claim token generated without bound contact requires operator manual approval
- [ ] OTP is 6-digit, 10-minute expiry, max 3 attempts, bcrypt-hashed in storage
- [ ] OTP delivery target is masked in API responses (e.g., `j***@gmail.com`, `***-***-1234`)
- [ ] Operator can approve/reject pending claims from admin UI
- [ ] Operator can approve/reject pending enrichment submissions from admin UI
- [ ] Enrichment submissions from unbound tokens go to `pending_review` state, not live
- [ ] Enrichment submissions from bound + verified tokens can go live immediately
- [ ] Self-discovered claims (from directory page CTA) require operator approval + proof of ownership
- [ ] `pnpm checkapi` and `pnpm checkweb` clean

## C10. The trust chain (end state)

```
Operator calls business (Sprint 3 verification)
  → Confirms owner identity (operator judgment — the trust anchor)
    → Captures owner email/phone
      → Generates claim token bound to that email/phone
        → Owner receives token link via email/SMS
          → Owner initiates claim → OTP sent to same email/phone
            → Only the person who controls that inbox/phone can enter the OTP
              → Claim accepted → OWNER role → dashboard → upgrade

If no contact info captured:
  → Claim token is unbound
    → Claim is held for operator manual approval
      → Operator reviews claimant (proof of ownership if self-discovered)
        → Approve → claim proceeds
        → Reject → claim denied
```

The operator's verification call is the trust anchor. The OTP proves the claimant controls the contact info the operator verified. The operator approval is the fallback when no contact info is available. No one can claim a business they don't own without either controlling the owner's email/phone or fooling the operator during manual review.

---

# Scale Phase: Category & Service Reuse Architecture

Before the scale sprints (4–7), it's critical to document the category and service reuse architecture. The platform already has two business category systems for tenant scope, and the directory presence effort reuses both rather than inventing new categories.

## Existing category systems (do not duplicate)

### 1. GBP Categories (`/t/[tenantId]/settings/gbp-category`)

- **Canonical table:** `platform_categories` (has `id`, `name`, `slug`, `google_category_id`, `parent_id`, `level`, `icon_emoji`, `sort_order`, `is_active`, `is_featured`)
- **Tenant storage:** `tenants.gbp_primary_category_id` + `tenants.gbp_primary_category_name` + `tenants.gbp_secondary_categories` (JSONB)
- **Junction table:** `tenant_gbp_categories` (`tenant_id`, `gbp_category_id`, `category_type` = 'primary' | 'secondary')
- **Search:** `GET /api/gbp/categories?query=` (searches `platform_categories`)
- **Popular:** `GET /api/gbp/categories/popular`
- **Component:** `CategorySelectorMulti` (shared, reusable)
- **Hierarchy:** `platform_categories.parent_id` + `level` — supports parent/child categories with breadcrumb paths

### 2. Directory Categories (`/t/[tenantId]/settings/directory`)

- **Canonical table:** `platform_categories` (same table as GBP — the platform has ONE category source)
- **Tenant storage:** `directory_settings_list.primary_category` (free-form string, matches `platform_categories.name`) + `directory_settings_list.secondary_categories` (TEXT[])
- **Listing storage:** `directory_listings_list.primary_category` (free-form string, synced from settings) + `directory_listings_list.secondary_categories` (TEXT[])
- **Junction table:** `directory_listing_categories` (`listing_id`, `category_id`, `is_primary`) — for materialized view support
- **Browse:** `GET /api/directory/categories` (all categories from `platform_categories`) + `GET /api/directory/mv/categories` (categories with store counts from materialized view)
- **Search:** `GET /api/directory/categories/search?q=`
- **Component:** `DirectoryCategorySelectorAdapter` → `CategorySelectorMulti` (adapts directory category format to the shared selector)

### How directory presence reuses these

The presence seed system already uses the directory category pattern:

- `directory_presence_seeds.category` is a free-form string (e.g., "African Grocery Store") that matches `platform_categories.name`
- `directory_listings_list.primary_category` is set from the seed's category (same free-form string)
- The `/place` category pages join `directory_presence_seeds` against `platform_categories` by name to get proper slugs, hierarchy, icons, and metadata
- The seed creation UI should use `DirectoryCategorySelectorAdapter` for category selection (same component as tenant directory settings)
- The `/place` browse pages use the same `platform_categories` slugs as the existing `/directory/categories` pages

**Key principle:** `platform_categories` is the ONE canonical category source. GBP and Directory are two views of the same categories. Directory Presence is a third view of the same categories. No new category tables, no new category systems, no new category enums.

## Services to reuse (do not duplicate)

| Service | Reuse for | Why |
|---|---|---|
| `platform_categories` table | Category source for all presence seeds, browse pages, and search | Single canonical source with hierarchy, slugs, and Google category IDs |
| `DirectoryCategorySelectorAdapter` | Seed creation UI category selection | Already built, already works, already used by tenant directory settings |
| `CategorySelectorMulti` | Shared category selector component | Already supports search, hierarchy, primary/secondary selection |
| `GET /api/directory/categories/search` | Category search in seed creation | Already exists, searches `platform_categories` |
| `GET /api/directory/mv/categories` | Category browse with counts | Already exists, materialized view with store counts |
| `DirectoryPresenceSeedService` | Seed CRUD, publish, invite | Sprint 1 built this; Sprints 4–7 extend it, don't replace it |
| `MarketingProspectQueueService` | Prospect queue for all source kinds | Already supports `intelligence_seek`, `directory_lead_gen`, and other source kinds |
| `IntelligenceProfileService` | Category-specific discovery profiles | Already supports multiple categories, cities, and focus modes |
| `IntelligenceRunService` | Run tracking with profile version fidelity | Already records immutable run history |
| `PromptComposerService` | Fragment-based prompt assembly | Already category-agnostic with per-category profile blocks |
| `SubscriptionBillingService` | Tier upgrades | Sprint 2 reuses this for claim → upgrade |
| `audit()` helper | All audit logging | Object form: `audit({ actor, actorType, action, payload })` |
| `getDirectPool()` | Direct SQL queries in routes | Already used by directory-consolidated and directory-optimized routes |
| `PoweredByFooter` | Public page footer | Already used on directory pages |
| `DirectoryMapGoogle` | Map view | Already used on directory category pages; Sprint 5 reuses for `/place` map |
| `trackBehaviorClient` | Page view tracking | Already used on directory pages; Sprint 6 reuses for growth engine analytics |

**Key principle:** Before creating a new service, check if an existing one already does the job. The platform has been built to be flexible — extend existing services with new methods rather than creating parallel services.

---

# Sprint 4: Multi-City Seek & Batch Seed Operations

**Status:** Planned — not implemented
**Prerequisite:** Sprint 1 (Phases A–F) complete. Sprint 2 and Sprint 3 can be in flight in parallel — Sprint 4 operates on the seek-to-seed pipeline, not the claim or enrichment flows.
**Branch context:** `staging`
**Next migration numbers:** `220`–`221`

## S4.1. Problem

Sprint 1 built the seek → prospect → seed pipeline for a single niche in a single city (Indianapolis African grocery). The intelligence profile infrastructure supports multiple categories and cities, and the prospect queue supports intelligence seek prospects. But the actual execution path is single-city per run:

- `IntelligenceRunService.createRun` is tied to one `campaign_id`, and campaigns have a single `city` field
- `city-category-opportunity.schema.ts` validates single-city, single-category output
- There is no batch seek operation — running the same niche across 5 cities requires 5 separate campaigns, 5 separate runs, 5 separate operator review sessions
- There is no batch seed creation — each prospect must be converted to a seed individually
- There is no bulk publish or bulk invite — each seed must be published and invited individually

Scaling to 10 niches across 10 cities means 100 separate seek runs and thousands of individual seed operations. The operator workflow doesn't scale.

## S4.2. Non-Goals

- Do not change the intelligence profile system — it already supports multiple categories and cities
- Do not change the prospect queue — it already supports intelligence seek prospects with the right fields
- Do not change the prompt composition system — it's fragment-based and category-agnostic
- Do not build a new campaign system — reuse the existing campaign model with a batch wrapper
- Do not edit `schema.prisma` directly (per repo convention)

## S4.3. Product contract

### S4.3.1. Multi-city seek execution

The operator can initiate a **batch seek** that runs the same intelligence profile across multiple cities in one operation:

1. Operator selects a niche (intelligence profile) and a list of cities
2. The system creates one campaign per city (all linked by a shared `batch_id`)
3. Each campaign gets its own intelligence run (same profile, same prompt, different city)
4. Results flow into the prospect queue as normal, tagged with the `batch_id`
5. The operator reviews prospects per city or across the entire batch

The batch seek is a coordination layer — it doesn't change how individual seeks work. It creates N campaigns, N runs, and queues the results with a shared batch identifier for filtering.

### S4.3.2. Batch seed creation

The operator can select multiple prospects from the queue and convert them to seeds in one operation:

1. Operator filters the queue by batch_id, category, city, or business_seek_priority
2. Operator selects N prospects (checkbox or "select all filtered")
3. Operator clicks "Create Seeds" → the system calls `createSeedFromQueue` for each prospect
4. Seeds are created atomically per prospect (one failure doesn't block others)
5. Results are shown as a batch summary: X created, Y skipped (duplicate, insufficient fit), Z failed (error)
6. Each created seed gets the same `seed_batch` identifier for tracking

### S4.3.3. Bulk publish and bulk invite

After batch seed creation, the operator can:

1. Filter seeds by `seed_batch`
2. Select multiple seeds
3. Click "Publish All" → publishes each selected seed's listing
4. Click "Invite All" → mints a claim token for each selected seed
5. Batch operations show progress and per-seed results

Bulk invite is particularly important for scale — the operator doesn't want to click "invite" 50 times.

### S4.3.4. Batch tracking and dashboard

A new **Batch Operations** view shows:

- All seek batches with: niche, cities, total prospects, seeds created, seeds published, seeds claimed, seeds upgraded
- All seed batches with: city, category, total seeds, published count, claimed count, upgraded count
- Progress bars for each batch: what percentage of seeds are published, claimed, upgraded
- Filters by batch_id, niche, city, date range

This gives the operator a single view of the entire growth engine's output at scale.

## S4.4. Start-of-phase preflight

### S4.4.1. Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Batch seek coordination | New `BatchSeekService` | Coordinates N campaigns + N runs across cities |
| Batch seed creation | Extend `DirectoryPresenceSeedService` with `createSeedsFromBatch` | Reuses `createSeedFromQueue` per prospect |
| Bulk publish/invite | Extend `DirectoryPresenceSeedService` with `publishBatch` / `inviteBatch` | Reuses existing publish/invite per seed |
| Batch tracking | New `BatchOperationsService` | Aggregates across batches for the dashboard |
| Batch operations UI | New admin page at `/settings/admin/directory/batches` | Operator-facing batch dashboard |

### S4.4.2. Skills to read before starting

| Skill | Applied |
|---|---|
| `capability-deployment-flow.md` | Batch seed creation uses the same capability pipeline as Sprint 1 |
| `manual-sql-migration-policy.md` | SQL-first; `prisma db pull` after apply |
| `tenant-scoped-id-generation.md` | No new ID generators (reuses existing seed/listing/token IDs) |
| `end-of-phase-sprint-checklist.md` | Phase-end checklist |

**New skill to create at phase end**

- `.devin/skills/batch-seek-and-seed-operations.md` — reusable workflow: multi-city seek execution, batch seed creation, bulk publish/invite, batch tracking dashboard

### S4.4.3. Database

| File | Contents |
|---|---|
| `220_seek_batch_tracking.sql` | `mkt_seek_batches` table: `id`, `batch_id` (human-readable), `profile_id`, `profile_version`, `niche_category`, `cities` (TEXT[]), `campaign_ids` (TEXT[]), `status` (draft/running/completed/failed), `created_at`, `completed_at`, `created_by` |
| `221_seed_batch_metrics.sql` | Add `seek_batch_id` to `directory_presence_seeds` (nullable FK to `mkt_seek_batches`); add `seed_batch_status` view or materialized view for batch metrics (or compute in service layer) |

After apply (human): staging `prisma db pull && prisma generate`, then same SQL on production.

### S4.4.4. Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/marketing-ops/seek-batches` | admin | Create + launch a multi-city seek batch |
| GET | `/api/admin/marketing-ops/seek-batches` | admin | List seek batches with metrics |
| GET | `/api/admin/marketing-ops/seek-batches/:id` | admin | Batch detail with per-city breakdown |
| POST | `/api/admin/directory-presence/presence-seeds/batch-create` | admin | Create seeds from multiple queue entries |
| POST | `/api/admin/directory-presence/presence-seeds/batch-publish` | admin | Publish multiple seeds |
| POST | `/api/admin/directory-presence/presence-seeds/batch-invite` | admin | Invite (mint claim tokens) for multiple seeds |
| GET | `/api/admin/directory-presence/seed-batches` | admin | List seed batches with metrics |

### S4.4.5. Frontend

| Component | Type | States |
|---|---|---|
| `BatchSeekLauncher` | client | select niche → select cities → launch → progress |
| `BatchOperationsDashboard` | client | seek batches list + seed batches list with metrics |
| `BatchSeekDetail` | client | per-city breakdown of a seek batch |
| `QueueBatchActions` | client | select multiple prospects → "Create Seeds" button |
| `SeedBatchActions` | client | select multiple seeds → "Publish All" / "Invite All" buttons |

### S4.4.6. Preflight summary block

```
Phase/Sprint: Multi-City Seek & Batch Seed Operations — batch seek across cities, batch seed creation, bulk publish/invite
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md (Sprint 4)

New services: BatchSeekService (multi-city seek coordination);
              BatchOperationsService (batch tracking + metrics);
              createSeedsFromBatch / publishBatch / inviteBatch on DirectoryPresenceSeedService
New entities: mkt_seek_batches; directory_presence_seeds.seek_batch_id
New ID generators needed: none (reuses existing IDs; batch_id is human-readable slug)
New pages/routes: /settings/admin/directory/batches (batch dashboard);
                  modified /settings/admin/marketing-ops/queue (batch seed creation);
                  modified /settings/admin/directory/presence-seeds (bulk publish/invite)
New sidebar links: "Batches" under Directory admin
New settings cards: none
New migration: 220–221
New background jobs: none (seek execution is synchronous or external-agent-driven)
New capability features: none
Skills to read before starting: capability-deployment-flow, manual-sql-migration-policy,
              tenant-scoped-id-generation, end-of-phase-sprint-checklist
New skill to create: .devin/skills/batch-seek-and-seed-operations.md
Insights to capture: the intelligence profile system already supports multiple categories and cities,
      but the execution path is single-city per run; the batch seek is a coordination layer that
      creates N campaigns + N runs with a shared batch_id; batch seed creation reuses the
      Sprint 1 createSeedFromQueue method per prospect; bulk publish/invite reuses existing
      per-seed operations with a batch wrapper
```

## S4.5. Implementation phases

### Phase A — Seek batch tracking (220)

- Migration 220: `mkt_seek_batches` table
- Implement `BatchSeekService`:
  - `createBatch(input)`: creates a batch record with niche + cities list
  - `launchBatch(batchId)`: creates one campaign per city, initiates intelligence runs (or queues them for external agent execution), links campaigns to batch
  - `getBatchStatus(batchId)`: aggregates per-city progress (prospects queued, seeds created, etc.)
  - `listBatches(filters)`: lists batches with summary metrics
- Backend routes: POST + GET seek-batches
- Tests: batch creation, per-city campaign creation, batch status aggregation

### Phase B — Batch seed creation (221)

- Migration 221: add `seek_batch_id` to `directory_presence_seeds`
- Implement `DirectoryPresenceSeedService.createSeedsFromBatch(queueEntryIds[], ctx)`:
  - Calls `createSeedFromQueue` for each entry (from Sprint 1 Phase A)
  - Collects results: created, skipped (with reason), failed (with error)
  - All seeds in the batch get the same `seed_batch` value (e.g., `african-grocery-columbus-2026-08`)
  - Returns batch summary
- Backend route: POST batch-create
- Frontend: `QueueBatchActions` — multi-select on the prospect queue + "Create Seeds" button
- Tests: batch creation with mixed results (some succeed, some skip duplicates, some fail); idempotency

### Phase C — Bulk publish and bulk invite

- Implement `DirectoryPresenceSeedService.publishBatch(seedIds[], ctx)`:
  - Calls `publishSeed` for each seed
  - Collects results: published, already published, failed
  - Returns batch summary
- Implement `DirectoryPresenceSeedService.inviteBatch(seedIds[], expiresInDays, ctx)`:
  - Calls `inviteSeed` for each seed
  - Collects results: invited, already invited, failed
  - Returns batch summary with claim links
- Backend routes: POST batch-publish, POST batch-invite
- Frontend: `SeedBatchActions` — multi-select on the seeds page + "Publish All" / "Invite All" buttons
- Tests: bulk publish with mixed states; bulk invite with mixed states; partial failure handling

### Phase D — Batch operations dashboard

- Implement `BatchOperationsService`:
  - `listSeekBatches(filters)`: seek batches with per-city metrics
  - `listSeedBatches(filters)`: seed batches with metrics (total, published, claimed, upgraded)
  - `getSeekBatchDetail(batchId)`: per-city breakdown
- Backend routes: GET seek-batches, GET seek-batches/:id, GET seed-batches
- Frontend: `BatchOperationsDashboard` at `/settings/admin/directory/batches`
  - Two tabs: "Seek Batches" and "Seed Batches"
  - Seek batches: niche, cities, campaigns, prospects queued, seeds created, status
  - Seed batches: batch name, city, category, total seeds, published, claimed, upgraded, progress bar
  - Click a batch → detail view with per-city or per-seed breakdown
- Tests: dashboard renders with real batch data; metrics are accurate

### Phase E — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- End-to-end: operator launches a 3-city seek batch → 3 campaigns created → prospects queued → operator selects 10 prospects → creates seeds in batch → bulk publishes → bulk invites → batch dashboard shows progress
- Batch dashboard metrics match actual counts
- Partial failures don't block the rest of the batch
- End-of-phase checklist
- Create `.devin/skills/batch-seek-and-seed-operations.md`

## S4.6. Risks

| Risk | Mitigation |
|---|---|
| Multi-city seek overwhelms the external agent | Limit batch size (max 10 cities per batch); queue cities sequentially if needed |
| Batch seed creation creates duplicate seeds | `createSeedFromQueue` already has duplicate detection (Sprint 1); batch wrapper collects skips |
| Bulk publish fails mid-batch | Per-seed publish is independent; partial results are reported; operator can retry failures |
| Batch dashboard is slow with many batches | Paginate; cache metrics; use materialized view if needed (migration 221 can add one) |
| Operator launches a batch but forgets to review prospects | Batch dashboard shows "prospects queued" count with a link to the filtered queue; notification on batch completion |

## S4.7. Acceptance

- [ ] Operator can launch a multi-city seek batch (select niche + cities)
- [ ] Batch creates one campaign per city with a shared batch_id
- [ ] Operator can select multiple prospects and create seeds in batch
- [ ] Operator can bulk publish and bulk invite selected seeds
- [ ] Batch operations dashboard shows seek batches and seed batches with metrics
- [ ] Partial failures don't block the rest of the batch
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new batch-seek-and-seed-operations skill written

---

# Sprint 5: Directory Browse at Scale + SEO Infrastructure

**Status:** Planned — not implemented
**Prerequisite:** Sprint 4 (Phases A–E) complete. The category pages from the in-flight work (just shipped) work for a small number of listings. This sprint makes them work at scale.
**Branch context:** `staging`
**Next migration numbers:** `222`–`223`

## S5.1. Problem

The `/place` category pages just shipped work for a small directory (10 listings in one category, one city). At scale (hundreds of listings across multiple categories and cities), the browse experience breaks down:

- No search across all presence listings
- No city landing pages (a user looking for "African grocery in Columbus" has no entry point)
- No map view for geographic browsing
- No pagination (a category with 200 listings loads all at once)
- No sorting (by name, by city, by SNAP status, by date added)
- No SEO infrastructure — search engines can't discover presence listings efficiently
- No structured data (JSON-LD) for rich search results

The directory is the platform's public face. At scale, it needs to be both user-browseable and search-engine-discoverable.

## S5.2. Non-Goals

- Do not build a new search engine — use PostgreSQL full-text search or trigram similarity
- Do not build a separate map application — use the existing Google Maps integration
- Do not change the individual listing page (`/place/[slug]`) — that's Sprint 1's scope
- Do not edit `schema.prisma` directly (per repo convention)

## S5.3. Product contract

### S5.3.1. Search across presence listings

A search bar on the `/place` index page (and a dedicated `/place/search` page) that searches across all published presence listings by:

- Business name (exact + fuzzy)
- Category
- City
- State
- SNAP/EBT status

Results are shown as cards (same `PlaceCard` component from the category page) with filters for category, city, and SNAP status.

### S5.3.2. City landing pages

New route: `/place/city/[citySlug]`

Shows all published presence listings in a city, grouped by category. This is the entry point for a user who knows the city but wants to browse all categories.

- City header: "Places in [City], [State]"
- Category breakdown chips (same pattern as the index page but scoped to one city)
- Listings grouped by category, with category headers
- "Browse all categories" link back to `/place`

### S5.3.3. Map view

A map view on the `/place` index and category pages that shows all published presence listings as pins. Clicking a pin shows a mini-card with business name, address, and a link to the listing page.

- Reuses the existing `DirectoryMapGoogle` component (already used on the directory category pages)
- Filters apply (category, city, search)
- Cluster pins at high zoom levels (Google Maps marker clustering)

### S5.3.4. Pagination and sorting

Category and city pages get:

- Pagination (24 per page, with page numbers and prev/next)
- Sort options: Name (A-Z), City, Recently Added, SNAP/EBT first
- URL-based state (query params) so pages are shareable and SEO-crawlable

### S5.3.5. SEO infrastructure

**Sitemap generation:**
- New route: `GET /api/public/directory/places-sitemap.xml`
- Generates a sitemap with all published presence listing URLs (`/place/[slug]`)
- Includes category pages (`/place/category/[slug]`) and city pages (`/place/city/[slug]`)
- Updates daily or on-demand

**Structured data (JSON-LD):**
- Each `/place/[slug]` page includes `LocalBusiness` JSON-LD structured data
- Fields: name, address, telephone, geo, url, description
- Helps Google rich results understand the listing

**Category and city page metadata:**
- Dynamic `<title>` and `<meta description>` per category and city
- Already partially done (the category page has `generateMetadata`)
- City pages get the same treatment

## S5.4. Start-of-phase preflight

### S5.4.1. Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Search | Extend `PlacesBrowsePublicService` with `searchPlaces` | New method on existing service |
| City pages | Extend `PlacesBrowsePublicService` with `getPlacesByCity` | New method on existing service |
| Map data | Extend `PlacesBrowsePublicService` with `getPlacesForMap` | Returns lightweight geo data |
| Sitemap | New `PlacesSitemapService` | Generates XML sitemap |
| Structured data | New `PlaceJsonLd` component | Renders JSON-LD on listing pages |

### S5.4.2. Database

| File | Contents |
|---|---|
| `222_directory_places_search_index.sql` | Add a `tsvector` column or expression index on `directory_listings_list` for full-text search across `business_name`, `city`, `state`, `primary_category`; or use trigram (`pg_trgm`) similarity index on `business_name` |
| `223_directory_places_sitemap_log.sql` | `directory_places_sitemap_log` table: `id`, `generated_at`, `url_count`, `file_path` (if cached to disk) or `etag` (if cached in DB) |

### S5.4.3. Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/public/directory/places/search?q=...&category=...&city=...&snapEbt=...` | public | Search across presence listings |
| GET | `/api/public/directory/places/city/:citySlug` | public | All presence listings in a city, grouped by category |
| GET | `/api/public/directory/places-map?category=...&city=...` | public | Lightweight geo data for map pins |
| GET | `/api/public/directory/places-sitemap.xml` | public | XML sitemap for all presence pages |

### S5.4.4. Frontend

| Component | Type | States |
|---|---|---|
| `PlacesSearchBar` | client | search input + filters |
| `PlacesSearchResults` | client | results grid + filters + pagination |
| `PlaceCityPage` | client | city landing page with category breakdown |
| `PlacesMapView` | client | Google Maps with pins + mini-cards |
| `PlaceJsonLd` | server component | JSON-LD structured data on listing pages |

New routes:
| Route | Purpose |
|---|---|
| `/place/search` | Search page |
| `/place/city/[citySlug]` | City landing page |

### S5.4.5. Preflight summary block

```
Phase/Sprint: Directory Browse at Scale + SEO Infrastructure — search, city pages, map view, pagination, sitemaps, structured data
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md (Sprint 5)

New services: PlacesSitemapService; searchPlaces / getPlacesByCity / getPlacesForMap on PlacesBrowsePublicService
New entities: tsvector/trigram index on directory_listings_list; directory_places_sitemap_log
New ID generators needed: none
New pages/routes: /place/search; /place/city/[citySlug]; /api/public/directory/places-sitemap.xml
New sidebar links: none (public pages)
New settings cards: none
New migration: 222–223
New background jobs: sitemap regeneration (daily or on-demand)
New capability features: none
Skills to read before starting: manual-sql-migration-policy, end-of-phase-sprint-checklist
New skill to create: .devin/skills/directory-places-seo.md
Insights to capture: the directory is the platform's public face; at scale it needs search, city pages,
      map view, pagination, and SEO infrastructure; the existing Google Maps integration can be reused;
      PostgreSQL full-text search or trigram similarity is sufficient (no need for a separate search engine);
      JSON-LD structured data helps Google rich results discover presence listings
```

## S5.5. Implementation phases

### Phase A — Search + city pages (222)

- Migration 222: search index (tsvector or trigram) on `directory_listings_list`
- Backend: `GET /api/public/directory/places/search` — full-text search with filters
- Backend: `GET /api/public/directory/places/city/:citySlug` — listings by city grouped by category
- Frontend: `PlacesSearchBar` + `PlacesSearchResults` on `/place/search`
- Frontend: `PlaceCityPage` at `/place/city/[citySlug]`
- Tests: search by business name, category, city; city page shows all categories in that city

### Phase B — Map view + pagination + sorting

- Backend: `GET /api/public/directory/places-map` — lightweight geo data (id, name, lat, lng, slug, category)
- Frontend: `PlacesMapView` with Google Maps + marker clustering
- Frontend: pagination on category and city pages (24 per page)
- Frontend: sort dropdown (Name, City, Recently Added, SNAP/EBT first)
- Tests: map renders pins; pagination works; sorting changes order

### Phase C — SEO infrastructure (223)

- Migration 223: sitemap log table
- Backend: `GET /api/public/directory/places-sitemap.xml` — generates XML sitemap
- Frontend: `PlaceJsonLd` component on `/place/[slug]` pages — `LocalBusiness` structured data
- Frontend: dynamic metadata on city pages (already done on category pages)
- Tests: sitemap XML is valid; JSON-LD is valid; all published listings appear in sitemap

### Phase D — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- End-to-end: search for "African" → results show; click a city → city page shows all categories; map view shows pins; sitemap is valid XML; listing page has JSON-LD
- End-of-phase checklist
- Create `.devin/skills/directory-places-seo.md`

## S5.6. Acceptance

- [ ] Search bar on `/place` searches across all published presence listings
- [ ] City landing pages at `/place/city/[citySlug]` show all listings in a city grouped by category
- [ ] Map view shows pins for all listings with filters applied
- [ ] Category and city pages paginate (24 per page)
- [ ] Sort options work (Name, City, Recently Added, SNAP/EBT first)
- [ ] Sitemap at `/api/public/directory/places-sitemap.xml` includes all published listings
- [ ] Listing pages include `LocalBusiness` JSON-LD structured data
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new directory-places-seo skill written

---

# Sprint 6: Growth Engine Analytics

**Status:** Planned — not implemented
**Prerequisite:** Sprint 4 (Phases A–E) complete. The batch operations dashboard (Sprint 4 Phase D) provides per-batch metrics. This sprint builds the end-to-end growth loop analytics on top of that.
**Branch context:** `staging`
**Next migration numbers:** `224`–`225`

## S6.1. Problem

The platform's growth engine is a multi-step funnel: seek → prospect → seed → publish → claim → upgrade. Today there is no end-to-end tracking of this funnel. The operator can see individual pieces (prospect queue count, seed count, claim count) but cannot answer:

- What percentage of seek prospects become seeds?
- What percentage of published seeds get claimed?
- What percentage of claimed seeds upgrade to a paid tier?
- Which niches have the highest claim rates?
- Which cities have the highest upgrade rates?
- How long does it take from seed to claim on average?
- Which seek batches are performing best?

Without these metrics, the operator is flying blind. They can't prioritize which niches to expand, which cities to focus on, or which parts of the funnel need optimization.

## S6.2. Non-Goals

- Do not build a real-time analytics engine — daily aggregation is sufficient
- Do not build a separate analytics database — use PostgreSQL views or materialized views
- Do not track individual user behavior (no cookies, no tracking pixels) — aggregate funnel metrics only
- Do not edit `schema.prisma` directly (per repo convention)

## S6.3. Product contract

### S6.3.1. Growth loop funnel

A dashboard at `/settings/admin/growth-engine` showing the end-to-end funnel:

```
Seeks Run → Prospects Queued → Seeds Created → Seeds Published → Seeds Claimed → Seeds Upgraded
   N              N                    N                N                N               N
   ↓              ↓                    ↓                ↓                ↓               ↓
  runs      queue entries        seed rows      published seeds    claimed seeds   upgraded tenants
```

Each stage shows:
- Count for the selected time range
- Conversion rate from the previous stage
- Conversion rate from the first stage (overall)
- Average time to transition (where measurable: seed → publish, publish → claim, claim → upgrade)

### S6.3.2. Per-niche breakdown

A table showing each niche (category) with:
- Total seeks, prospects, seeds, published, claimed, upgraded
- Claim rate (claimed / published)
- Upgrade rate (upgraded / claimed)
- Best performing city for that niche
- Worst performing city for that niche

This helps the operator decide which niches to expand and which to deprioritize.

### S6.3.3. Per-city breakdown

A table showing each city with:
- Total niches, prospects, seeds, published, claimed, upgraded
- Claim rate
- Upgrade rate
- Best performing niche for that city

This helps the operator decide which cities to focus on.

### S6.3.4. Time series

A chart showing the funnel over time (weekly or monthly):
- New seeds created per week
- New claims per week
- New upgrades per week
- Cumulative seeds, claims, upgrades

This shows whether the growth engine is accelerating or decelerating.

### S6.3.5. Directory traffic analytics

Track page views on:
- `/place` (index)
- `/place/category/[slug]` (category pages)
- `/place/city/[slug]` (city pages)
- `/place/[slug]` (individual listing pages)

This is done via the existing `trackBehaviorClient` utility (already used on directory pages). The analytics dashboard shows:
- Total page views per day/week
- Top viewed categories
- Top viewed cities
- Top viewed listings
- Claim CTA click-through rate (views → claim page visits)

### S6.3.6. "Next expansion" recommendations

Based on the growth engine data, the system recommends:
- **Niches to expand**: categories with high claim rates but low city coverage → expand to more cities
- **Cities to expand**: cities with high claim rates but low niche coverage → add more niches
- **Niches to deprioritize**: categories with low claim rates across multiple cities
- **Demand signals**: categories/cities with high directory page views but few listings → high demand, low supply

These are computed from the analytics data and shown as actionable cards on the dashboard.

## S6.4. Start-of-phase preflight

### S6.4.1. Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Funnel metrics | New `GrowthEngineAnalyticsService` | Aggregates across seek batches, seeds, claims, upgrades |
| Time series | Extend `GrowthEngineAnalyticsService` | Same service, different query |
| Directory traffic | Extend `GrowthEngineAnalyticsService` | Uses existing behavior tracking data |
| Recommendations | Extend `GrowthEngineAnalyticsService` | Computed from the same data |
| Dashboard UI | New admin page at `/settings/admin/growth-engine` | Operator-facing analytics dashboard |

### S6.4.2. Database

| File | Contents |
|---|---|
| `224_growth_engine_daily_metrics.sql` | `growth_engine_daily_metrics` table: `date`, `category`, `city`, `seeks_run`, `prospects_queued`, `seeds_created`, `seeds_published`, `seeds_claimed`, `seeds_upgraded`, `directory_views`, `claim_cta_clicks`. Populated by a daily aggregation job. |
| `225_growth_engine_mv.sql` | Materialized view `mv_growth_engine_funnel` for the funnel dashboard (aggregates across all dates with filters). Refresh daily or on-demand. |

### S6.4.3. Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/growth-engine/funnel` | admin | Funnel metrics (seeks → prospects → seeds → published → claimed → upgraded) |
| GET | `/api/admin/growth-engine/by-niche` | admin | Per-niche breakdown |
| GET | `/api/admin/growth-engine/by-city` | admin | Per-city breakdown |
| GET | `/api/admin/growth-engine/time-series` | admin | Time series chart data |
| GET | `/api/admin/growth-engine/directory-traffic` | admin | Directory page view analytics |
| GET | `/api/admin/growth-engine/recommendations` | admin | "Next expansion" recommendations |

### S6.4.4. Frontend

| Component | Type | States |
|---|---|---|
| `GrowthEngineDashboard` | client | funnel + niche + city + time series + traffic + recommendations |
| `GrowthFunnelChart` | client | horizontal funnel visualization |
| `GrowthTimeSeriesChart` | client | line chart (seeds, claims, upgrades over time) |
| `GrowthNicheTable` | client | per-niche breakdown table |
| `GrowthCityTable` | client | per-city breakdown table |
| `GrowthRecommendations` | client | actionable recommendation cards |

### S6.4.5. Preflight summary block

```
Phase/Sprint: Growth Engine Analytics — end-to-end funnel tracking, per-niche/city breakdowns, time series, directory traffic, expansion recommendations
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md (Sprint 6)

New services: GrowthEngineAnalyticsService (funnel metrics, time series, traffic, recommendations)
New entities: growth_engine_daily_metrics; mv_growth_engine_funnel
New ID generators needed: none
New pages/routes: /settings/admin/growth-engine (dashboard);
                  /api/admin/growth-engine/* (6 analytics endpoints)
New sidebar links: "Growth Engine" under admin
New settings cards: none
New migration: 224–225
New background jobs: daily metrics aggregation (runs nightly, populates growth_engine_daily_metrics)
New capability features: none
Skills to read before starting: manual-sql-migration-policy, end-of-phase-sprint-checklist
New skill to create: .devin/skills/growth-engine-analytics.md
Insights to capture: the growth engine is a multi-step funnel (seek → prospect → seed → publish → claim → upgrade);
      without end-to-end tracking the operator can't prioritize which niches to expand or which cities to focus on;
      per-niche and per-city breakdowns reveal which parts of the funnel need optimization;
      directory traffic analytics show demand signals (high views, low listings = expand there);
      the "next expansion" recommendations turn data into actionable operator decisions
```

## S6.5. Implementation phases

### Phase A — Daily metrics aggregation (224)

- Migration 224: `growth_engine_daily_metrics` table
- Implement daily aggregation job (runs nightly):
  - Count seeks run per category/city (from `mkt_intelligence_runs` + `mkt_seek_batches`)
  - Count prospects queued per category/city (from `marketing_prospect_queue`)
  - Count seeds created per category/city (from `directory_presence_seeds`)
  - Count seeds published per category/city (from `directory_presence_seeds` where `status = 'published'`)
  - Count seeds claimed per category/city (from `directory_presence_seeds` where `status = 'claimed'`)
  - Count seeds upgraded per category/city (from `tenants` where `subscription_tier != 'directory_presence'` and `org_standing_mode = 'independent'` and was previously `directory_seed`)
  - Count directory views per category/city (from behavior tracking data)
- Tests: aggregation job produces correct counts; idempotent (re-running for same date overwrites)

### Phase B — Funnel dashboard + materialized view (225)

- Migration 225: `mv_growth_engine_funnel` materialized view
- Implement `GrowthEngineAnalyticsService`:
  - `getFunnel(dateRange)`: aggregates across all niches/cities for the funnel
  - `getByNiche(dateRange)`: per-category breakdown
  - `getByCity(dateRange)`: per-city breakdown
  - `getTimeSeries(dateRange, granularity)`: weekly or monthly time series
- Backend routes: GET funnel, GET by-niche, GET by-city, GET time-series
- Frontend: `GrowthEngineDashboard` with funnel chart, niche table, city table, time series chart
- Tests: funnel metrics match raw counts; niche/city breakdowns are accurate; time series renders

### Phase C — Directory traffic + recommendations

- Implement `GrowthEngineAnalyticsService.getDirectoryTraffic(dateRange)`:
  - Aggregates page views from behavior tracking data
  - Top categories, top cities, top listings by views
  - Claim CTA click-through rate
- Implement `GrowthEngineAnalyticsService.getRecommendations()`:
  - High claim rate + low city coverage → "Expand [niche] to more cities"
  - High claim rate + low niche coverage → "Add more niches in [city]"
  - Low claim rate across cities → "Deprioritize [niche]"
  - High directory views + few listings → "High demand for [category] in [city] — run a seek"
- Backend routes: GET directory-traffic, GET recommendations
- Frontend: directory traffic section + recommendation cards on the dashboard
- Tests: traffic metrics match behavior tracking data; recommendations are logically consistent

### Phase D — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- End-to-end: dashboard shows funnel from seeks to upgrades; niche table shows per-category metrics; city table shows per-city metrics; time series chart renders; recommendations appear
- Daily aggregation job runs without error
- End-of-phase checklist
- Create `.devin/skills/growth-engine-analytics.md`

## S6.6. Acceptance

- [ ] Growth engine dashboard shows the end-to-end funnel (seeks → prospects → seeds → published → claimed → upgraded)
- [ ] Per-niche breakdown shows claim rate and upgrade rate per category
- [ ] Per-city breakdown shows claim rate and upgrade rate per city
- [ ] Time series chart shows seeds, claims, upgrades over time
- [ ] Directory traffic analytics show top viewed categories, cities, and listings
- [ ] "Next expansion" recommendations are actionable and logically consistent
- [ ] Daily aggregation job runs nightly and populates metrics
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new growth-engine-analytics skill written

---

# Sprint 7: Self-Reinforcing Loop (Directory → Seek)

**Status:** Planned — not implemented
**Prerequisite:** Sprint 5 (SEO + browse at scale) and Sprint 6 (analytics) complete. This sprint closes the outer loop — the directory's own traffic and lead gen data feed back into the seek pipeline.
**Branch context:** `staging`
**Next migration numbers:** `226`

## S7.1. Problem

The growth engine is a one-way pipeline today: the operator runs seeks → prospects → seeds → publish → claim → upgrade. The directory's own traffic is a passive observer — people visit the directory, browse listings, and leave.

But the directory generates two valuable signals that should feed back into the seek pipeline:

1. **Search demand**: people search for "[category] in [city]" on the directory. If there are no listings for that search, that's a demand signal — the platform should run a seek for that category+city.

2. **Lead gen submissions**: the "Get listed" CTA from Sprint 3 creates prospect queue entries from business owners who found the directory on their own. These are self-identified prospects — the highest quality prospects in the pipeline because the business owner themselves raised their hand.

Today, neither signal feeds back into the seek pipeline automatically. The operator has to manually notice search demand and lead gen submissions and decide to act on them.

This sprint closes the loop: the directory's own traffic and lead gen data become inputs to the seek pipeline, making the growth engine self-reinforcing.

## S7.2. Non-Goals

- Do not build an automated seek execution system — the operator still decides whether to act on a recommendation
- Do not replace the operator's judgment — recommendations are suggestions, not automatic actions
- Do not build a recommendation engine that uses ML — simple rules-based recommendations from analytics data
- Do not edit `schema.prisma` directly (per repo convention)

## S7.3. Product contract

### S7.3.1. Search demand tracking

When a user searches on `/place/search` and gets zero results (or very few results), the system logs a "search demand" event:

- Search query (e.g., "halal butcher")
- Category (if resolved from the query)
- City (if detected from the query or user's location)
- Result count (0 = no listings, 5 = some but underserved)
- Timestamp

These events are aggregated daily. A category+city with repeated zero-result searches becomes a "demand signal" — the platform should run a seek there.

### S7.3.2. Lead gen prospect workflow

The "Get listed" CTA from Sprint 3 creates prospect queue entries with `source_kind: 'directory_lead_gen'`. This sprint builds the operator workflow for converting those leads into seeds:

- Lead gen prospects appear in the prospect queue with a special badge ("Self-identified")
- Lead gen prospects are prioritized over seek-discovered prospects (the business owner raised their hand)
- Operator reviews the lead gen prospect → if legitimate, creates a seed directly (no need for a seek)
- The seed is published and the owner is invited to claim (they already want to be listed)

This is the fastest path from discovery to claim: the owner finds the directory, submits their business, the operator seeds it, and the owner claims it.

### S7.3.3. Demand-driven seek recommendations

The growth engine dashboard (Sprint 6) gains a "Demand Signals" section:

- **Zero-result searches**: top category+city combinations with zero-result searches in the last 30 days
- **Underserved searches**: top category+city combinations with < 5 listings but > 10 searches
- **Lead gen demand**: categories/cities with the most "Get listed" submissions
- **Geographic demand**: cities with high directory traffic but few presence listings

Each demand signal has a "Run Seek" button that pre-fills the seek batch launcher (Sprint 4) with the recommended category+city.

### S7.3.4. Auto-suggestion for next seek targets

Based on all available signals (search demand, lead gen, directory traffic, claim rates), the system computes a prioritized list of "next seek targets":

```
Priority 1: [Category] in [City] — 15 zero-result searches, 3 lead gen submissions, 0 listings
Priority 2: [Category] in [City] — 8 zero-result searches, 0 lead gen, 2 listings (underserved)
Priority 3: [Category] in [City] — 0 searches, 5 lead gen submissions, 0 listings
...
```

The operator can click "Launch Seek" on any recommendation to start a seek batch for that target.

## S7.4. Start-of-phase preflight

### S7.4.1. Singleton strategy

| Surface | Base | Why |
|---|---|---|
| Search demand tracking | Extend `GrowthEngineAnalyticsService` with `logSearchDemand` + `getSearchDemand` | New metrics on existing service |
| Lead gen workflow | Extend `MarketingProspectQueueService` (already supports `directory_lead_gen` source) | Sprint 3 defined the source kind; this sprint builds the operator workflow |
| Demand signals | Extend `GrowthEngineAnalyticsService` with `getDemandSignals` | Computed from search demand + lead gen + traffic |
| Next seek targets | Extend `GrowthEngineAnalyticsService` with `getNextSeekTargets` | Prioritized recommendations |

### S7.4.2. Database

| File | Contents |
|---|---|
| `226_directory_search_demand.sql` | `directory_search_demand_log` table: `id`, `search_query`, `resolved_category`, `resolved_city`, `result_count`, `searched_at`, `ip_hash` (for dedup, not for tracking) |

### S7.4.3. Backend routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/directory/search-demand` | public (no auth) | Log a search demand event (zero-result or low-result searches) |
| GET | `/api/admin/growth-engine/demand-signals` | admin | Demand signals (zero-result searches, underserved, lead gen) |
| GET | `/api/admin/growth-engine/next-seek-targets` | admin | Prioritized next seek recommendations |

### S7.4.4. Frontend

| Component | Type | States |
|---|---|---|
| `DemandSignalsPanel` | client | zero-result searches + underserved + lead gen demand |
| `NextSeekTargets` | client | prioritized recommendation list with "Launch Seek" buttons |
| `LeadGenBadge` | client | badge on prospect queue entries from `directory_lead_gen` |

### S7.4.5. Preflight summary block

```
Phase/Sprint: Self-Reinforcing Loop (Directory → Seek) — search demand tracking, lead gen workflow, demand-driven seek recommendations
Design doc: docs/DIRECTORY_PRESENCE_SCALE_AND_CONVERGENCE_SPRINT_PLAN.md (Sprint 7)

New services: logSearchDemand / getSearchDemand / getDemandSignals / getNextSeekTargets on GrowthEngineAnalyticsService
New entities: directory_search_demand_log
New ID generators needed: none
New pages/routes: POST /api/public/directory/search-demand (public);
                  GET /api/admin/growth-engine/demand-signals (admin);
                  GET /api/admin/growth-engine/next-seek-targets (admin)
New sidebar links: none (extends Sprint 6 dashboard)
New settings cards: DemandSignalsPanel + NextSeekTargets on growth engine dashboard
New migration: 226
New background jobs: daily search demand aggregation (extends Sprint 6 daily job)
New capability features: none
Skills to read before starting: manual-sql-migration-policy, end-of-phase-sprint-checklist
New skill to create: .devin/skills/self-reinforcing-seek-loop.md
Insights to capture: the directory's own traffic is a discovery source; zero-result searches are demand signals;
      lead gen submissions are the highest quality prospects (self-identified); the loop closes when directory
      demand feeds back into seek targets; the operator still decides whether to act on recommendations
```

## S7.5. Implementation phases

### Phase A — Search demand tracking (226)

- Migration 226: `directory_search_demand_log` table
- Backend: `POST /api/public/directory/search-demand` — logs a search event (query, resolved category/city, result count)
- Frontend: `PlacesSearchResults` calls the search demand endpoint when results are 0 or < 5
- IP hash for dedup (not for tracking) — prevents one user from inflating demand by searching repeatedly
- Tests: search demand is logged; dedup by ip_hash + query + day

### Phase B — Lead gen prospect workflow

- Frontend: `LeadGenBadge` on prospect queue entries with `source_kind: 'directory_lead_gen'`
- Sort prospect queue to show lead gen prospects first (they're self-identified)
- Operator can create a seed directly from a lead gen prospect (no seek needed — the owner wants to be listed)
- Tests: lead gen prospects appear with badge; seed creation from lead gen prospect works

### Phase C — Demand signals + next seek targets

- Implement `GrowthEngineAnalyticsService.getDemandSignals(dateRange)`:
  - Zero-result searches: top category+city with 0 results, sorted by search count
  - Underserved searches: top category+city with < 5 listings but > 10 searches
  - Lead gen demand: categories/cities with most "Get listed" submissions
- Implement `GrowthEngineAnalyticsService.getNextSeekTargets()`:
  - Score each category+city: (zero_result_searches * 3) + (lead_gen_submissions * 5) + (underserved_searches * 2)
  - Sort by score descending
  - Return top 10 with scores and "Launch Seek" buttons
- Backend routes: GET demand-signals, GET next-seek-targets
- Frontend: `DemandSignalsPanel` + `NextSeekTargets` on the growth engine dashboard
- "Launch Seek" button pre-fills the Sprint 4 batch seek launcher with the recommended category+city
- Tests: demand signals are accurate; next seek targets are sorted by score; "Launch Seek" pre-fills correctly

### Phase D — Verify + skills

- `pnpm checkapi` + `pnpm checkweb` clean
- End-to-end: user searches for "halal butcher in Columbus" → 0 results → demand logged → demand signal appears on dashboard → operator clicks "Launch Seek" → seek batch created for halal butcher in Columbus
- Lead gen: business owner submits "Get listed" → prospect appears in queue with badge → operator creates seed → owner invited to claim
- End-of-phase checklist
- Create `.devin/skills/self-reinforcing-seek-loop.md`

## S7.6. Acceptance

- [ ] Zero-result searches on `/place/search` are logged as demand events
- [ ] Demand signals panel shows top zero-result, underserved, and lead gen demand
- [ ] Next seek targets are prioritized by a score combining all signals
- [ ] "Launch Seek" button pre-fills the batch seek launcher with the recommended target
- [ ] Lead gen prospects appear in the queue with a "Self-identified" badge
- [ ] Operator can create a seed directly from a lead gen prospect
- [ ] `pnpm checkapi` and `pnpm checkweb` clean
- [ ] Skills updated / new self-reinforcing-seek-loop skill written

## S7.7. The self-reinforcing loop (end state after all 7 sprints)

```
                        ┌─────────────────────────────────────────────────┐
                        │                                                   │
                        ▼                                                   │
  Operator launches seek batch (Sprint 4)                                   │
    → Intelligence runs execute across N cities                             │
      → Prospects queued (Sprint 1)                                         │
        → Operator reviews + qualifies                                      │
          ├─ Marketing campaign (Sprint 1)                                  │
          └─ Directory seed (Sprint 1)                                      │
                ↓                                                           │
          Publish batch (Sprint 4)                                          │
                ↓                                                           │
          Operator verifies + enriches (Sprint 3)                           │
                ↓                                                           │
          Owner claims (Sprint 2 + Cross-Cutting security)                  │
                ↓                                                           │
          Promoted to tenant → dashboard → upgrade (Sprint 2)               │
                ↓                                                           │
          Paying platform tenant                                            │
                                                                        │
  Directory browse at scale (Sprint 5)                                      │
    → Users search /place/search                                            │
      → Zero-result searches logged as demand (Sprint 7)                    │
        → Demand signals on growth engine dashboard (Sprint 6 + 7)          │
          → "Next seek targets" recommendations (Sprint 7)                  │
            → Operator launches next seek batch ─────────────────────────┘
                                                                        │
  Business owner visits directory (Sprint 5)                                │
    → "Get listed" CTA (Sprint 3)                                           │
      → Lead gen prospect in queue (Sprint 7)                               │
        → Operator creates seed                                             │
          → Owner claims → upgrades ───────────────────────────────────────┘
```

The platform finds businesses, publishes their listings, converts owners to tenants, upgrades them to paying customers, and uses the directory's own traffic to find the next batch of businesses. The loop is self-reinforcing. Seven sprints, one self-contained ecosystem, zero external prospecting. The directory opens many doors — and every door leads back into the platform, which leads back into the directory, which opens more doors.
