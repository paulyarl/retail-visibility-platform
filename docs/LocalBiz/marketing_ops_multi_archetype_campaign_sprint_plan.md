# Sprint Plan: Marketing Ops — Multi-Archetype Campaigns (Concurrent Siblings + Sequential Cycling)

**Document Version:** 1.0
**Date:** 2026-08-08
**Status:** Draft — Ready for Review

**Supersedes:** The single-archetype-per-campaign assumption inherited from:
- `marketing_ops_outreach_opener_sprint_plan.md` (A1–A4 archetype system, one archetype per campaign)
- `marketing_ops_playbook_catalog_triage_sprint_plan.md` (triage picks one winning playbook)
- `marketing_ops_universal_recalibration_sprint_plan.md` (A6 addition, still single-archetype)
- `MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md` (one gallery token per campaign, one archetype framing)

This sprint does **not** break those specs — it extends the model so that a single business prospect can have **multiple concurrent archetype campaigns** (sibling campaigns) plus **sequential cycling** within each sibling for follow-on packages. The existing single-archetype flow remains the default when triage detects only one qualifying archetype.

**Prerequisite:** Marketing Ops Sprint 1–6 complete; Universal Recalibration Sprint 1–2 complete (A6 + shared archetype resolver); Diagnostic Gallery Sprint 1–8 complete (gallery tokens, archetype-aware defaults, analytics); Intake Portal Generalization complete (registry-driven intake).

**Companion docs:**
- `docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md` (archetype system)
- `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md` (triage engine + signal taxonomy)
- `docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md` (A6, shared resolver)
- `docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md` (gallery tokens, archetype framing)
- `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md` (customer portal, multiple campaigns per customer)

---

## 1. Executive Summary

The Marketing Ops platform currently treats **one business prospect = one campaign = one archetype**. The triage engine detects multiple signals but selects only the **single strongest** archetype via a priority cascade (A2 > A1 > A6 > A3 > A4). The operator can override to a different playbook, but the campaign still resolves to exactly one archetype at runtime — driving one opener, one gallery framing, one deliverable, one payment.

Real businesses have **multiple concurrent pain dimensions**. A restaurant may have unanswered reviews (A1), NAP drift across platforms (A3), and no online ordering path (A6). Presenting all three dimensions simultaneously to the prospect **amplifies the pain scale** and forces conversion on at least one — ideally all. The current single-archetype model leaves sales opportunities on the table: the prospect sees only their strongest pain, not the full picture.

This sprint introduces a **hybrid sibling + cycling model**:

1. **Concurrent sibling campaigns** — Multiple campaign rows for the same business prospect, each with its own archetype, linked by a shared `business_prospect_id`. Each sibling runs its own independent pipeline (seek → shown → paid → delivered). The operator manually creates siblings from the triage-presented archetype list.

2. **Multi-dimensional diagnostic gallery** — One prospect-level landing page that shows all pain dimensions as navigable sections, each linking to the individual sibling campaign's archetype gallery with its own CTA. The prospect sees the full picture, then drills into each archetype's detailed gallery.

3. **Sequential cycling** — After delivering a sibling's package, the operator can cycle that sibling back for a follow-on engagement (e.g., review monitoring retainer after initial review response package). An `engagement_cycle` counter tracks this. The customer portal already supports multiple revenue rows per campaign.

**Sprint Duration:** 3 sprints (6 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Problem Statement

### 2.1 Single-Archetype Constraint

The archetype is resolved at runtime by `resolveCampaignArchetype(campaignId, ctx)` in `apps/api/src/services/OutreachOpenerService.ts`:

```
Precedence:
  1. Operator-accepted triage result's playbook archetype (honors overrides)
  2. selectArchetype(latestAuditData) fallback (deterministic: A2 > A1 > A6 > A3 > A4)
```

This returns **one** `ArchetypeCode`. Every downstream consumer — opener, header, closer, deliverable sections, gallery framing — branches on that single archetype. There is no mechanism to run a second archetype campaign for the same business without creating an unrelated duplicate campaign row.

### 2.2 Triage Shows One Winner

`TriageEngineService.evaluateTriage` runs the playbook cascade (first match in `priority_rank` order wins) and returns a single `TriageRecommendation` with one `playbookCode` and one `archetype`. The `detectedSignals` array may contain signals from multiple archetype families (e.g., `RA_UNANSWERED_NEGATIVES` + `DS_NAP_NAME_DRIFT` + `WC_NO_PRODUCT_BROWSING`), but the engine picks only the winning playbook. The operator sees the triggered signals but can only accept or override to one playbook.

### 2.3 Gallery Is Per-Campaign, Single-Archetype

The gallery token issuance route (`POST /campaigns/:id/gallery-token`) resolves one archetype, builds one set of archetype-aware defaults (`GalleryArchetypeDefaults.ts`), and mints one token. The gallery page renders one archetype's framing. There is no prospect-level view that aggregates multiple sibling galleries.

### 2.4 Lost Sales Opportunity

When triage detects A1 + A3 + A6 signals, the current system pitches only A1 (highest priority). The prospect never sees their listing drift or product visibility gap. After the A1 package is delivered, the operator must manually create a new campaign for A3 — but it's disconnected from the original prospect, with no shared context, no combined gallery, and no cross-archetype upsell narrative.

---

## 3. Design Decisions

### 3.1 Sibling Campaigns (Not A5 Umbrella)

**Decision:** Multiple campaign rows per business prospect, not one combined A5 campaign.

**Rationale:**
- A5 (multi-signal) bundles everything into one package with one payment. It can't sell archetypes separately or sequence them as distinct upsells.
- Sibling campaigns preserve independent pipelines, payments, deliverables, and stage transitions. The operator can deliver A1 this week and A3 next month.
- The customer portal already supports multiple campaigns per `customer_id` — no portal changes needed for siblings.
- `mkt_revenue` already supports multiple payments per campaign — no revenue model changes for cycling.

**Rejected alternative — A5 umbrella:** One combined campaign with multi-archetype deliverable sections. Simpler schema but loses the ability to sell archetypes separately, track per-archetype conversion, or sequence follow-on engagements per archetype.

### 3.2 `business_prospect_id` (Not `parent_campaign_id`)

**Decision:** New `business_prospect_id` column on `mkt_campaigns_list`, distinct from the existing `parent_campaign_id`.

**Rationale:**
- `parent_campaign_id` is used for **category-scope → business-scope** derivation (a category audit spawns child business campaigns in different cities/neighborhoods). Its semantics are "derived from this parent scope."
- Sibling campaigns are **peers**, not parent-child. They share the same business prospect but are not derived from each other.
- Conflating the two would break the existing lineage tab and category-derivation flow.

**`business_prospect_id` semantics:**
- NULL for category-scope and city-scope campaigns (they are not business prospects)
- NULL for legacy business-scope campaigns (backfilled on first sibling creation — see §5.1)
- Non-NULL for business-scope campaigns that are part of a sibling group
- All siblings share the same `business_prospect_id` value
- The first sibling created generates the `business_prospect_id` (a generated opaque ID, not the campaign ID)

### 3.3 Manual Sibling Creation from Triage

**Decision:** Triage presents the ranked archetype list as suggestions. The operator manually picks which ones to create as siblings.

**Rationale:**
- Auto-creating all qualifying siblings could produce campaigns the operator doesn't want (e.g., A4 for a business with a minor CTA gap that isn't worth pursuing).
- Manual creation gives the operator control over which pain dimensions to surface to the prospect.
- The triage card already shows detected signals — extending it to show "all matching playbooks" (not just the winner) is a natural UX extension.

### 3.4 Multi-Dimensional Gallery: One Landing Page + Drill-Down

**Decision:** One prospect-level landing page with navigation to each sibling's archetype gallery.

**Rationale (per operator direction):**
- "1 Page per prospect, with navigation to each campaign's gallery with each gallery having CTA for the archetype campaign"
- The prospect sees the full multi-dimensional picture on one page (amplifies pain)
- Each dimension links to its own detailed gallery (per-archetype screenshots, friction summary, CTA)
- Each archetype gallery has its own CTA → its own pay token → its own payment

**Implementation:**
- New `token_type = 'multi_diagnostic_gallery'` on `mkt_deliverable_preview_tokens`
- The multi-gallery token references the `business_prospect_id`, not a single `campaign_id`
- The landing page fetches all sibling campaigns for that prospect, renders a section per sibling with archetype-aware title/subtitle/CTA
- Each section links to the sibling's individual `diagnostic_gallery` token URL
- Individual sibling gallery tokens are minted as usual (one per sibling campaign)

### 3.5 Sequential Cycling Within a Sibling

**Decision:** An `engagement_cycle` counter on `mkt_campaigns_list` tracks follow-on engagements within the same sibling campaign.

**Rationale:**
- After delivering A1's review response package, the operator can cycle back: re-run triage (which may now detect A3 as the strongest remaining signal within that campaign's scope), or offer a follow-on package of the same archetype (e.g., "review monitoring retainer").
- Cycling reuses the same campaign row — no new sibling needed for follow-ons of the same archetype.
- `mkt_revenue` already supports multiple payments per campaign.
- The customer portal already shows multiple receipts per campaign.
- Stage history already records all transitions.

**Cycling flow:**
1. Campaign reaches `delivered` (or `retainer_won`)
2. Operator clicks "Start Next Engagement" → campaign cycles back to `seek` (or `preview_built` if audit is still current)
3. `engagement_cycle` increments
4. Operator can re-run triage, generate new gallery, dispatch new outreach
5. New `mkt_revenue` row created on payment

**Cycle reset semantics (explicit):**

When `cycleToNextEngagement` runs, the following fields are reset and the following are preserved:

| Field | Reset to | Rationale |
|---|---|---|
| `stage` | `seek` (or `preview_built` if `resetToStage` is passed) | New engagement starts at the top of the pipeline |
| `stage_entered_at` | `now()` | New stage entry timestamp |
| `date_entered` | `now()` | New engagement start date |
| `date_preview_built` | `null` (unless resetting to `preview_built`) | Old preview is stale |
| `date_shown` | `null` | Old outreach is stale |
| `date_paid` | `null` | New payment hasn't happened yet |
| `date_delivered` | `null` | New deliverable hasn't been generated |
| `date_retainer_pitched` | `null` | Retainer is per-cycle |
| `date_retainer_won` | `null` | Retainer is per-cycle |
| `amount_paid_cents` | `0` | New cycle starts at zero; prior payments are in `mkt_revenue` |
| `retainer_status` | `'not_pitched'` | Retainer is per-cycle |
| `retainer_amount_cents` | `0` | Per-cycle |
| `engagement_cycle` | `+1` | Incremented |
| `cascade_enabled` | `false` | Old cascade config is stale |
| `cascade_config` | `null` | Old cascade config is stale |

**Preserved (NOT reset):**
- `business_prospect_id` — the prospect group doesn't change
- `is_primary_sibling` — primary status doesn't change
- `campaign_category` — the archetype pillar doesn't change (the operator can still override triage)
- `repair_track` — the track doesn't change (operator can still switch via `switchRepairTrack`)
- `customer_id` — the customer relationship carries across cycles (they're the same business owner)
- `tenant_id` — tenant assignment doesn't change
- `business_name`, `category`, `city`, `phone`, `email`, `website_url`, address fields — business identity doesn't change
- `parent_campaign_id` — lineage doesn't change
- `estimated_fee_cents` — kept as the starting estimate; triage re-acceptance can update it
- `pain_score` — kept; re-evaluation can update it
- `notes` — kept (historical context)
- `assigned_to` — kept (operator assignment doesn't change)
- `service_category` — kept
- `tone` — kept
- `attributes` — kept
- `scope` — kept

**Stage history:** A `cycle_started` transition is logged with `fromStage = 'delivered'` (or `retainer_won`), `toStage = 'seek'` (or `preview_built`), `notes = 'Engagement cycle N→N+1'`, `triggerType = 'manual'`. This preserves the full history of all cycles within the campaign row.

**Stage history + cycle tracking:** The `notes` field on `mkt_stage_history_list` includes the cycle number (e.g., `'Engagement cycle 1→2'`) so the stage history timeline can display which cycle each transition belongs to. No schema change to `mkt_stage_history_list` is needed — the `notes` field is sufficient for display. If per-cycle querying becomes a need later, a `engagement_cycle` column can be added to `mkt_stage_history_list` in a future migration.

**`mkt_revenue`:** Each cycle's payment creates a new `mkt_revenue` row (the existing model already supports this). The `amount_paid_cents` field on the campaign row reflects only the current cycle's payment — historical payments are queryable via `mkt_revenue` ordered by `created_at`.

**`mkt_deliverables_list` per cycle:** Deliverables are 1:N per campaign (the existing model supports multiple). Each cycle generates a NEW deliverable row — the old cycle's deliverable is NOT updated or overwritten. This preserves the historical deliverable for the customer portal (which shows all deliverables for a campaign). The new deliverable's `title` includes the cycle number (e.g., `'Review Response Package — Engagement 2'`) to distinguish it from prior cycles. The `package_delivered` field on the campaign row is updated to the new deliverable's title.

**`customer_id` across cycles:** The `customer_id` field is preserved across cycles (the customer relationship doesn't change). This ensures the customer portal continues to show the campaign with all its historical receipts and deliverables.

---

## 4. Schema Changes

### 4.0 Migration 178: Repair Playbook Re-Categorization (Pre-Requisite Correction)

**Problem:** `profile_repair` exists as a `CampaignCategory` but is NOT a `PlaybookCategory`. The triage engine can only assign `review_management`, `recovery_management`, or `triage_management`. Playbooks matching on repair signals (NAP drift, URL mismatch, missing photos, missing CTA, product visibility) are miscategorized as `review_management`.

**Signal domain mapping (corrected):**
- **Review** = customer feedback + owner response engagement → RA signals (review drought, low volume, unanswered backlog)
- **Recovery** = BBB reputation recovery → RA signals (BBB grade, unanswered complaints, negative backlog)
- **Repair** = fixing actual profile/website/product drifts → DS + CP + VP + WC signals (NAP drift, URL mismatch, broken links, missing photos, missing CTA, missing product catalog)

**Re-categorization:**

| Playbook | Archetype | Signals | Old category | New category |
|---|---|---|---|---|
| PB-01 | A3 | `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT`, `WC_URL_MISMATCH` | `review_management` | `profile_repair` |
| PB-03 | A4 | `WC_MISSING_CTA`, `WC_MISSING_SERVICE_PAGES`, `DS_MISSING_SERVICE_MENU`, `WC_MOBILE_FRICTION`, `WC_MISSING_WEBSITE` | `review_management` | `profile_repair` |
| PB-06 | A3 | `VP_MISSING_PROJECT_PHOTOS`, `VP_STALE_SOCIAL_ACTIVITY`, `DS_PHOTO_DEFICIT` | `review_management` | `profile_repair` |
| PB-07 | A6 | `WC_MISSING_PRODUCT_BROWSING`, `DS_MISSING_PRODUCT_CATALOG`, `VP_MISSING_PRODUCT_PHOTOS` | `review_management` | `profile_repair` |
| PB-02 | A1 | `RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME`, `RA_UNADDRESSED_POSITIVE_BACKLOG` | `review_management` | `review_management` (unchanged) |
| PB-04 | A2 | `RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS`, `RA_UNADDRESSED_NEGATIVE_BACKLOG` | `recovery_management` | `recovery_management` (unchanged) |
| PB-05 | A5 | Dual-signal (repair + review) | `triage_management` | `triage_management` (unchanged) |

```sql
-- 178_mkt_repair_playbook_recategory.sql

-- Re-categorize repair-focused playbooks from review_management to profile_repair.
-- This corrects a semantic mismatch: PB-01/PB-03/PB-06/PB-07 match on profile/website/product
-- drift signals (DS, CP, VP, WC families), not review signals (RA family).
UPDATE mkt_playbook_catalog
  SET category = 'profile_repair'
  WHERE code IN ('PB-01', 'PB-03', 'PB-06', 'PB-07');
```

**Type changes:**

`apps/api/src/services/triage/types.ts`:
```typescript
export const PLAYBOOK_CATEGORIES = [
  'review_management',
  'recovery_management',
  'profile_repair',       // NEW — was missing
  'triage_management',
] as const;
```

**`CampaignTriageService.acceptTriage` extension:**

When the operator accepts a `profile_repair` playbook, the campaign is re-categorized to `profile_repair` with `repair_track: 'standard'` (default — runs the review pipeline). The operator can later escalate to `repair_track: 'escalated'` (switches to the recovery pipeline) via `switchRepairTrack` if the repair issue is severe (suspension, hijacked listing, etc.).

```typescript
// In acceptTriage — after setting campaign_category:
if (playbook.category === 'profile_repair') {
  await this.prisma.mkt_campaigns_list.update({
    where: { id: campaignId },
    data: {
      campaign_category: 'profile_repair',
      repair_track: 'standard',  // default — review pipeline
      estimated_fee_cents: playbook.fitdDefaultFeeCents,
    },
  });
}
```

**What does NOT change:**
- `transitionsFor('profile_repair', 'standard')` already returns `REVIEW_TRANSITIONS` — no change needed
- `transitionsFor('profile_repair', 'escalated')` already returns `RECOVERY_TRANSITIONS` — no change needed
- `pipelineFor('profile_repair', 'standard')` already returns `'review'` — no change needed
- `pipelineFor('profile_repair', 'escalated')` already returns `'recovery'` — no change needed
- `switchRepairTrack` already handles track switching — no change needed
- Existing `profile_repair` campaigns created manually are unaffected — they already work correctly

**Code changes required (Sprint 1):**

1. **`CampaignTriageService.acceptTriage`** — set `repair_track: 'standard'` when accepting a `profile_repair` playbook (shown above).

2. **`CampaignTriageService.overrideTriage`** — same fix: set `repair_track: 'standard'` when the override playbook's category is `profile_repair`. Without this, overriding to PB-01/PB-03/PB-06/PB-07 sets `campaign_category: 'profile_repair'` but leaves `repair_track: null` (undecided), which produces undefined pipeline behavior.

```typescript
// In overrideTriage — after setting campaign_category + estimated_fee_cents:
await this.prisma.mkt_campaigns_list.update({
  where: { id: campaignId },
  data: {
    campaign_category: overridePlaybook.category,
    estimated_fee_cents: overridePlaybook.fitdDefaultFeeCents,
    // NEW: set repair_track when overriding to a profile_repair playbook
    ...(overridePlaybook.category === 'profile_repair' ? { repair_track: 'standard' } : {}),
  },
});
```

3. **`MarketingCampaignService.transitionStage`** — fix the registry-driven intake condition. The current code excludes ALL `profile_repair` campaigns from registry-driven intake auto-gen:

```typescript
// CURRENT (buggy after Migration 178):
if (category !== 'recovery_management' && category !== 'profile_repair') {
  // registry-driven intake (gbp_optimization, review_response_setup, etc.)
}
```

After Migration 178, campaigns that accept PB-01/PB-03/PB-06/PB-07 become `profile_repair` + `standard` (review pipeline). They MUST still get registry-driven intake. Only `profile_repair` + `escalated` (recovery pipeline) should be excluded (it gets dispute intake via the first block):

```typescript
// FIXED:
const runsReviewPipeline =
  category === 'review_management' ||
  category === 'triage_management' ||
  (category === 'profile_repair' && repairTrack === 'standard');
if (runsReviewPipeline) {
  // registry-driven intake (gbp_optimization, review_response_setup, etc.)
}
```

4. **`MarketingPlaybookCatalogService.toRow`** — fix `ArchetypeCodeWithA5` → `ArchetypeCodeWithA6` cast (line 277). The deprecated `ArchetypeCodeWithA5` type should be replaced with `ArchetypeCodeWithA6` since A6 is now a first-class archetype. This is a type-only change — both types resolve to the same union.

5. **`apps/api/src/routes/marketing-ops.ts`** — update `playbookCategoryEnum` Zod schema (line 452) to include `profile_repair`. The current enum only allows `review_management`, `recovery_management`, `triage_management`. After Migration 178, the playbook catalog will have rows with `category = 'profile_repair'`, and the playbook create/update routes (lines 471, 487) will reject them with a validation error.

```typescript
// CURRENT (line 452):
const playbookCategoryEnum = z.enum(['review_management', 'recovery_management', 'triage_management']);

// FIXED:
const playbookCategoryEnum = z.enum([
  'review_management',
  'recovery_management',
  'profile_repair',        // NEW
  'triage_management',
]);
```

**Migration ordering constraint:** Migration 178 (which re-categorizes the playbook rows) MUST be applied AFTER the code deploy that adds `profile_repair` to `PLAYBOOK_CATEGORIES` and `playbookCategoryEnum`. If the migration runs first, the playbook catalog will have rows with a category that the type system and route validation reject — causing runtime errors on any playbook list/create/update operation. The deploy sequence is: code deploy → migration apply.

**Impact on existing campaigns:**
- Campaigns that previously accepted PB-01/PB-03/PB-06/PB-07 triage have `campaign_category: 'review_management'`. They are NOT automatically re-categorized (that would change their pipeline behavior). They keep `review_management` until the operator manually changes the category or re-accepts triage.
- New campaigns accepting these playbooks after the migration will get `profile_repair` + `standard` track.

### 4.1 Migration 179: `business_prospect_id` + `engagement_cycle`

```sql
-- 178_mkt_business_prospect_siblings.sql

-- business_prospect_id: groups sibling campaigns for the same business prospect.
-- NULL for category/city scope campaigns and legacy business campaigns until
-- backfilled. All siblings share the same value.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN business_prospect_id VARCHAR(255);

-- engagement_cycle: tracks sequential cycling within a sibling campaign.
-- Default 1 (first engagement). Increments when the operator cycles back
-- after delivery for a follow-on package.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN engagement_cycle INT NOT NULL DEFAULT 1;

-- is_primary_sibling: marks the highest-priority archetype sibling for
-- display ordering and default gallery focus.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN is_primary_sibling BOOLEAN NOT NULL DEFAULT false;

-- Index for sibling lookups
CREATE INDEX idx_mkt_campaigns_business_prospect
  ON mkt_campaigns_list (business_prospect_id)
  WHERE business_prospect_id IS NOT NULL;

-- Sibling uniqueness: one archetype per prospect group. This prevents
-- duplicate siblings (e.g., two A1 campaigns for the same prospect).
-- Enforced at DB level in addition to the application-level 409 check.
-- Note: archetype is resolved at runtime (not persisted on the campaign),
-- so we use campaign_category as the proxy for uniqueness. This allows
-- one review_management, one recovery_management, one profile_repair,
-- and one triage_management sibling per prospect. Multiple profile_repair
-- siblings with different repair_tracks (standard vs escalated) are allowed
-- by using (business_prospect_id, campaign_category, repair_track) as the
-- unique key.
CREATE UNIQUE INDEX idx_mkt_campaigns_prospect_sibling_unique
  ON mkt_campaigns_list (business_prospect_id, campaign_category, COALESCE(repair_track, 'none'))
  WHERE business_prospect_id IS NOT NULL AND scope = 'business';

-- Backfill: for existing business-scope campaigns without a prospect_id,
-- generate a dedicated prospect ID with a 'bp_' prefix to avoid collisions
-- with campaign IDs (which are used as foreign keys and could be confused
-- with prospect IDs in queries). Each existing business campaign becomes
-- its own prospect group with one sibling — itself.
UPDATE mkt_campaigns_list
  SET business_prospect_id = CONCAT('bp_', id), is_primary_sibling = true
  WHERE scope = 'business' AND business_prospect_id IS NULL;
```

### 4.2 Migration 180: Multi-Diagnostic Gallery Token Support

```sql
-- 180_multi_diagnostic_gallery_tokens.sql

-- The existing mkt_deliverable_preview_tokens table has a token_type column
-- (VARCHAR). We add 'multi_diagnostic_gallery' as a valid value, enforced at
-- the application layer (Zod schema).
--
-- For multi-gallery tokens, the campaign_id column references the primary
-- sibling campaign. A new metadata JSONB column stores:
--   - business_prospect_id: the prospect group ID
--   - sibling_campaign_ids: array of all sibling campaign IDs included
--   - sibling_summaries: per-sibling gallery metadata (archetype, title, CTA)

-- Add metadata column (does not exist today — friction_summary is used for
-- the gallery friction summary, not prospect/sibling metadata)
ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN metadata JSONB;

-- Add an index for prospect-level gallery lookups
CREATE INDEX idx_mkt_preview_tokens_prospect
  ON mkt_deliverable_preview_tokens ((metadata->>'business_prospect_id'))
  WHERE token_type = 'multi_diagnostic_gallery';
```

**Prisma schema update (model `mkt_deliverable_preview_tokens`):**
```prisma
model mkt_deliverable_preview_tokens {
  // ... existing fields ...
  metadata              Json?
  // ... existing relations ...
}
```

### 4.3 Prisma Schema Updates

**File:** `apps/api/prisma/schema.prisma` (model `mkt_campaigns_list`)

Add three fields:
```prisma
business_prospect_id                                                              String?                              @db.VarChar(255)
engagement_cycle                                                                  Int                                  @default(1)
is_primary_sibling                                                                Boolean                              @default(false)
```

Add relation for self-referencing sibling grouping (optional — lookups use `business_prospect_id` directly):
```prisma
@@index([business_prospect_id])
```

### 4.4 Type & Interface Extensions

**Backend (`apps/api/src/services/MarketingCampaignService.ts`):**

The `CampaignDetail` type (returned by `getCampaign`) gains three fields + a siblings array:

```typescript
export interface SiblingSummary {
  id: string;
  display_id: string | null;
  business_name: string | null;
  campaign_category: string;
  repair_track: string | null;
  stage: string;
  archetype: string | null;        // resolved archetype (A1–A6)
  is_primary_sibling: boolean;
  engagement_cycle: number;
  pipeline: 'review' | 'recovery';
  estimated_fee_cents: number;
  amount_paid_cents: number;
  created_at: string;
}

export interface CampaignDetail extends Campaign {
  // ... existing fields ...
  business_prospect_id: string | null;
  engagement_cycle: number;
  is_primary_sibling: boolean;
  siblings: SiblingSummary[];      // all siblings for this prospect (excluding self), ordered by archetype priority
}
```

The base `Campaign` type (returned by `listCampaigns`) gains the three scalar fields so list views can group/filter by prospect:

```typescript
export interface Campaign {
  // ... existing fields ...
  business_prospect_id: string | null;
  engagement_cycle: number;
  is_primary_sibling: boolean;
}
```

**Frontend (`apps/web/src/services/MarketingOpsService.ts`):**

The frontend `Campaign` and `CampaignDetail` interfaces mirror the backend additions. The `SiblingSummary` type is also exported for the siblings tab UI:

```typescript
export interface SiblingSummary {
  id: string;
  display_id: string | null;
  business_name: string | null;
  campaign_category: CampaignCategory;
  repair_track: RepairTrack | null;
  stage: CampaignStage;
  archetype: string | null;
  is_primary_sibling: boolean;
  engagement_cycle: number;
  pipeline: 'review' | 'recovery';
  estimated_fee_cents: number;
  amount_paid_cents: number;
  created_at: string;
}

export interface Campaign {
  // ... existing fields (lines 84-163) ...
  business_prospect_id?: string | null;
  engagement_cycle?: number;
  is_primary_sibling?: boolean;
}

export interface CampaignDetail extends Campaign {
  // ... existing fields ...
  business_prospect_id?: string | null;
  engagement_cycle?: number;
  is_primary_sibling?: boolean;
  siblings?: SiblingSummary[];
}
```

---

## 5. Backend Changes

### 5.1 Business Prospect Service (New)

**File:** `apps/api/src/services/BusinessProspectService.ts` (new)

**Responsibilities:**
- Generate `business_prospect_id` for a new sibling group
- Create sibling campaigns from triage-presented archetypes
- List siblings for a prospect
- Backfill legacy campaigns (idempotent — the migration handles initial backfill)

**Key methods:**

```typescript
class BusinessProspectService extends BaseService {
  /**
   * Create a sibling campaign for an existing business prospect.
   * Copies business info from the primary sibling, sets the new campaign's
   * archetype via triage acceptance, and links via business_prospect_id.
   */
  async createSiblingCampaign(input: {
    prospectId: string;
    archetype: ArchetypeCode;
    playbookCode?: PlaybookCode;
    /**
     * For profile_repair siblings (not from triage): the repair track.
     * 'standard' → review pipeline, 'escalated' → recovery pipeline.
     * Only used when campaignCategory is 'profile_repair'.
     */
    campaignCategory?: CampaignCategory;
    repairTrack?: 'standard' | 'escalated';
    repairIssueType?: string;
    assignedTo?: string;
    notes?: string;
  }, ctx?: RequestCtx): Promise<mkt_campaigns_list>;

  /**
   * Initialize a prospect group from an existing campaign.
   * Called when the operator creates the first sibling from a campaign
   * that doesn't yet have a business_prospect_id.
   *
   * Generates a prospect ID with the 'bp_' prefix (e.g., 'bp_abc123def456')
   * to avoid collisions with campaign IDs. This matches the backfill format
   * in Migration 179.
   */
  async initializeProspectFromCampaign(campaignId: string, ctx?: RequestCtx): Promise<string>;

  /**
   * List all sibling campaigns for a prospect, ordered by archetype priority.
   */
  async listSiblings(prospectId: string, ctx?: RequestCtx): Promise<mkt_campaigns_list[]>;

  /**
   * Get the primary sibling (highest-priority archetype, or explicitly marked).
   */
  async getPrimarySibling(prospectId: string, ctx?: RequestCtx): Promise<mkt_campaigns_list | null>;

  /**
   * Cycle a sibling campaign to its next engagement.
   * Increments engagement_cycle, resets stage to seek (or preview_built
   * if the audit is still current), records stage history.
   */
  async cycleToNextEngagement(campaignId: string, ctx?: RequestCtx): Promise<mkt_campaigns_list>;
}
```

**Sibling creation flow:**
1. Operator selects an archetype from the triage-presented list (which now includes repair playbooks PB-01/PB-03/PB-06/PB-07 alongside review PB-02 and recovery PB-04), OR manually chooses `profile_repair` as the category with a specific `repairTrack` (for repair-centric siblings not driven by triage — e.g., escalated track for a known suspension)
2. `initializeProspectFromCampaign` is called if the source campaign has no `business_prospect_id` yet (generates a new prospect ID, sets it on the source campaign, marks source as primary)
3. `createSiblingCampaign` copies business info (name, category, city, phone, email, website, address) from the primary sibling, creates a new campaign at `seek` stage with `business_prospect_id` set. **`customer_id` is also copied** from the primary sibling — if the primary sibling has been claimed by a customer, all siblings inherit the same `customer_id` so the customer portal shows the full sibling group. If the primary sibling has no `customer_id` (not yet claimed), siblings start with `customer_id = null` and inherit it when any sibling is claimed (the claim sweep already matches by business identity, so all siblings for the same prospect get claimed together).
4. **For triage-driven siblings:** the new sibling gets its own triage evaluation — the operator accepts the chosen playbook to lock in the archetype and category. Accepting PB-01/PB-03/PB-06/PB-07 sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'`. Accepting PB-02 sets `review_management`. Accepting PB-04 sets `recovery_management`. **For manually-created `profile_repair` siblings:** the category and track are set directly at creation — no triage acceptance needed
5. The new sibling runs its own pipeline independently — review pipeline for `review_management` / `profile_repair` + `standard`, recovery pipeline for `recovery_management` / `profile_repair` + `escalated`

### 5.2 Triage Multi-Archetype Presentation

**File:** `apps/api/src/services/triage/TriageEngineService.ts` (extend)

**Current:** `evaluateTriage` returns the first matching playbook in priority order. The recommendation is built inline (there is no `buildRecommendation` function — the `TriageRecommendation` object is constructed inside the `for` loop at lines 211-218).

**Extension:** Add `evaluateAllMatchingPlaybooks` that returns **all** playbooks whose `matching_rules` match the signal set, ranked by `priority_rank`. This is the "suggestion list" the operator picks from. Each result includes `detectedSignals` so the UI can show which signals triggered each alternative — the operator needs this to make an informed sibling creation decision.

```typescript
/**
 * Evaluate all playbooks that match the signal set, ranked by priority.
 * Used by the multi-archetype triage card to present sibling-creation
 * suggestions. The winner (rank 1) is the same as evaluateTriage's result.
 *
 * Each TriageRecommendation includes detectedSignals (the signals that
 * contributed to this playbook's rule match) so the UI can show the
 * operator which signals triggered each alternative.
 */
export function evaluateAllMatchingPlaybooks(
  signals: SignalCode[],
  playbooks: PlaybookCatalogRow[],
): TriageRecommendation[] {
  const signalSet = new Set(signals);
  return playbooks
    .filter((pb) => pb.isActive && ruleMatches(pb.matchingRules, signalSet))
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .map((pb) => ({
      playbookCode: pb.code,
      category: pb.category,
      archetype: pb.archetype,
      confidence: pb.matchingRules.confidence,
      reasoning: buildReasoning(pb, signalSet, pb.matchingRules),
      detectedSignals: buildDetectedSignals(signalSet, pb.matchingRules),
    }));
}
```

**Note:** `buildReasoning` and `buildDetectedSignals` already exist as private functions in `TriageEngineService.ts` (lines 102-152). They are reused here — no new helpers needed. The inline recommendation construction in `evaluateTriage` (lines 211-218) should be refactored to call a shared `buildRecommendation` helper to avoid duplication, but this is optional.

**File:** `apps/api/src/services/CampaignTriageService.ts` (extend)

Add `evaluateAllForCampaign` that wraps `evaluateAllMatchingPlaybooks` with DB access. This requires extracting a `loadSignalsAndPlaybooks` helper from the existing `evaluateTriageForCampaign` (which currently inlines signal extraction at lines 145-170 and playbook loading at line 175). The helper is a pure refactor — no behavior change to `evaluateTriageForCampaign`.

```typescript
/**
 * Extract the signal-loading + playbook-loading logic from evaluateTriageForCampaign
 * into a reusable helper. This is a refactor of lines 145-175 of the existing method —
 * no behavior change. Used by both evaluateTriageForCampaign and evaluateAllForCampaign.
 */
private async loadSignalsAndPlaybooks(
  input: TriageEvaluateInput,
  ctx?: RequestCtx,
): Promise<{ signals: SignalCode[]; playbooks: PlaybookCatalogRow[]; sourceAuditId: string | null }> {
  const { campaignId, bbb, operatorAddedSignals, operatorRemovedSignals } = input;

  const campaign = await this.prisma.mkt_campaigns_list.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new NotFoundError('Campaign not found');

  const allAudits = await this.prisma.mkt_audits_list.findMany({
    where: { campaign_id: campaignId },
    orderBy: { created_at: 'desc' },
  });
  const selectedAudit = this.selectAuditForTriage(allAudits);
  const auditData = (selectedAudit?.audit_data as SignalExtractorInput['auditData']) ?? null;
  const sourceAuditId = selectedAudit?.id ?? null;

  const extractorInput: SignalExtractorInput = {
    campaign: {
      last_review_date: campaign.last_review_date,
      unaddressed_reviews: campaign.unaddressed_reviews ?? 0,
      nap_consistent: campaign.nap_consistent,
      has_website: campaign.has_website,
      website_url: campaign.website_url,
      gbp_claimed: (campaign as any).gbp_claimed ?? null,
    },
    auditData,
    bbb,
  };
  let signals: SignalCode[] = extractSignals(extractorInput);

  // Operator enrichment (same as existing lines 160-170)
  if (operatorAddedSignals?.length) {
    const existing = new Set(signals);
    for (const code of operatorAddedSignals) {
      if (typeof code === 'string' && code.length > 0) {
        existing.add(code as SignalCode);
      }
    }
    signals = Array.from(existing);
  }
  if (operatorRemovedSignals?.length) {
    const removeSet = new Set(operatorRemovedSignals);
    signals = signals.filter((s) => !removeSet.has(s));
  }

  const playbooks = await MarketingPlaybookCatalogService.listActivePlaybooksOrdered(ctx);
  return { signals, playbooks, sourceAuditId };
}

/**
 * Evaluate all matching playbooks for a campaign (winner + alternatives).
 * The winner is stored via evaluateTriageForCampaign (same as today).
 * The alternatives are returned for the UI to present as sibling-creation
 * suggestions.
 */
async evaluateAllForCampaign(input: TriageEvaluateInput, ctx?: RequestCtx): Promise<{
  winner: StoredTriageResult;
  alternatives: TriageRecommendation[];
}> {
  // 1. Run the normal evaluation (stores the winner, same as today)
  const winner = await this.evaluateTriageForCampaign(input, ctx);
  // 2. Re-load signals + playbooks (the helper is idempotent — no side effects)
  const { signals, playbooks } = await this.loadSignalsAndPlaybooks(input, ctx);
  // 3. Run the engine in "all matches" mode
  const allMatches = evaluateAllMatchingPlaybooks(signals, playbooks);
  // 4. Alternatives = all matches except the winner
  const alternatives = allMatches.filter(
    (m) => m.playbookCode !== winner.recommendedPlaybook.code
  );
  return { winner, alternatives };
}
```

**`MultiArchetypeTriageResult` type (in `triage/types.ts`):**
```typescript
export interface MultiArchetypeTriageResult {
  winner: StoredTriageResult;
  alternatives: TriageRecommendation[];  // each includes detectedSignals
}
```

### 5.3 Triage Routes (Extend)

**File:** `apps/api/src/routes/marketing-ops.ts`

Add route:
```
GET  /:campaignId/triage/alternatives  — list all matching playbooks for sibling creation
POST /:campaignId/siblings             — create a sibling campaign from a chosen archetype
GET  /:campaignId/siblings             — list sibling campaigns for this prospect
POST /:campaignId/cycle                — cycle to next engagement (sequential)
```

**`POST /:campaignId/siblings` request body:**
```typescript
{
  archetype: 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  // For triage-driven siblings (review_management / recovery_management):
  playbookCode?: 'PB-01' | 'PB-02' | 'PB-03' | 'PB-04' | 'PB-05' | 'PB-06' | 'PB-07';
  // For repair-centric siblings (not from triage):
  campaignCategory?: 'profile_repair';
  repairTrack?: 'standard' | 'escalated';
  repairIssueType?: string;  // e.g. 'suspension', 'nap_drift', 'hijacked_listing'
  assignedTo?: string;
  notes?: string;
}
```

**Validation:**
- If `playbookCode` is provided, the sibling is triage-driven — category is set by the playbook's category on triage acceptance
- If `campaignCategory` is `'profile_repair'`, the sibling is repair-centric — no playbook needed, `repairTrack` and `repairIssueType` are set directly
- At least one of `playbookCode` or `campaignCategory` must be provided

**Response:** The new sibling campaign row (same shape as `GET /campaigns/:id`).

**`POST /:campaignId/cycle` request body:**
```typescript
{
  resetToStage?: 'seek' | 'preview_built';  // default: seek
  notes?: string;
}
```

**Response:** The updated campaign row with incremented `engagement_cycle`.

### 5.4 Multi-Diagnostic Gallery Token

**File:** `apps/api/src/routes/marketing-ops.ts` (extend)

Add route:
```
POST /prospects/:prospectId/multi-gallery-token  — mint a multi-diagnostic gallery token
```

**Request body:**
```typescript
{
  expires_in_days?: number;  // default: 72
  gallery_title?: string;    // default: "Digital Health Diagnostic — {businessName}"
  gallery_subtitle?: string; // default: "{N} issues found across {M} areas"
}
```

**Flow:**
1. Load all sibling campaigns for the prospect (`BusinessProspectService.listSiblings`)
2. Filter to siblings at `preview_built` or `shown` stage (only those with galleries ready)
3. For each qualifying sibling, ensure a `diagnostic_gallery` token exists (mint if not)
4. Mint a `multi_diagnostic_gallery` token with metadata:
   ```json
   {
     "business_prospect_id": "prospect-abc",
     "sibling_campaign_ids": ["camp-1", "camp-2", "camp-3"],
     "sibling_token_ids": ["token-1", "token-2", "token-3"],
     "gallery_title": "Digital Health Diagnostic — Joe's Grocery",
     "gallery_subtitle": "3 issues found across 3 areas"
   }
   ```
5. Return the multi-gallery URL: `{baseUrl}/preview/{multiToken}?prospect=true`

**Stage gate:** At least one sibling must be at `preview_built` or `shown` with at least one screenshot uploaded.

### 5.5 Multi-Gallery Public API

**File:** `apps/api/src/routes/marketing-ops-public.ts` (extend)

Add route:
```
GET /api/public/gallery/multi/:token  — fetch multi-gallery data
```

**Response:**
```typescript
{
  token: string;
  expiresAt: string;
  galleryTitle: string;
  gallerySubtitle: string;
  siblings: Array<{
    campaignId: string;
    archetype: ArchetypeCode;
    galleryTitle: string;
    gallerySubtitle: string;
    frictionSummary: Record<string, string | number>;
    ctaLabel: string;
    ctaAmountCents?: number;
    galleryUrl: string;       // /preview/{siblingToken}
    payUrl: string;           // /marketing/pay?ptoken={siblingToken}
    screenshotCount: number;
    isPrimary: boolean;
  }>;
}
```

**Engagement tracking:** The multi-gallery page fires the same `gallery_opened`, `screenshot_viewed`, `cta_clicked` events as the single gallery, but with an additional `sibling_campaign_id` field on each event. Events are recorded against the multi-gallery token, with the sibling reference in metadata.

### 5.6 Gallery Archetype Defaults (No Change)

**File:** `apps/api/src/services/marketing/GalleryArchetypeDefaults.ts`

Already implemented and archetype-aware. The multi-gallery landing page calls `resolveGalleryArchetypeDefaults` per sibling to build each section's title/subtitle/friction/CTA. No changes needed.

### 5.7 Customer Portal (Minimal Change)

**File:** `apps/api/src/services/MarketingCustomerProjection.ts`

The portal already groups by `customer_id` and shows multiple campaigns. The only addition: group campaigns by `business_prospect_id` in the overview so the customer sees "Joe's Grocery — 3 engagements" instead of three separate entries.

**`buildPortalOverview` extension:**
```typescript
// After projecting campaigns, group by business_prospect_id
const prospectGroups = new Map<string, CustomerCampaignProjection[]>();
for (const c of projected) {
  const pid = (c as any).businessProspectId ?? c.id; // fallback for legacy
  if (!prospectGroups.has(pid)) prospectGroups.set(pid, []);
  prospectGroups.get(pid)!.push(c);
}
// Return grouped campaigns
return {
  ...overview,
  campaignGroups: Array.from(prospectGroups.entries()).map(([prospectId, campaigns]) => ({
    businessProspectId: prospectId,
    businessName: campaigns[0]?.businessName ?? 'Unknown',
    campaigns,
  })),
};
```

---

## 6. Frontend Changes

### 6.1 Triage Card — Multi-Archetype Suggestions

**File:** `apps/web/src/components/marketing-ops/IntelligentTriageCard.tsx` (extend)

**Current:** Shows the winning playbook + accept/override buttons.

**Extension:** After the winning recommendation, show an "Additional Archetypes" section listing all matching playbooks (from `GET /:campaignId/triage/alternatives`). Each alternative has a "Create Sibling Campaign" button.

```
┌─────────────────────────────────────────────────────────┐
│  Intelligent Triage                                     │
│                                                         │
│  Recommended: PB-01 Review Response (A1)                │
│  Confidence: 0.85 · Signals: RA_UNANSWERED_NEGATIVES... │
│  [Accept Recommendation]  [Override ▼]                  │
│                                                         │
│  ── Additional Detected Archetypes ──                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ A3 — Listing Drift (PB-03)                      │    │
│  │ Signals: DS_NAP_NAME_DRIFT, DS_NAP_PHONE_DRIFT  │    │
│  │ Confidence: 0.70                                │    │
│  │                        [Create Sibling Campaign]│    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ A6 — Product Visibility Gap (PB-07)             │    │
│  │ Signals: WC_NO_PRODUCT_BROWSING, VP_PHOTO_DEFICIT│   │
│  │ Confidence: 0.65                                │    │
│  │                        [Create Sibling Campaign]│    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Campaign Detail — Sibling Campaigns Tab

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (extend)

Add a new tab: `siblings` ("Sibling Campaigns")

**Content:**
- Prospect header: business name + prospect ID + sibling count
- List of sibling campaigns with:
  - Archetype badge (A1–A6)
  - Stage badge
  - Engagement cycle indicator (if > 1)
  - Link to sibling campaign detail
  - "Primary" badge on the primary sibling
- "Create Sibling" button → opens archetype picker modal (lists remaining detected archetypes not yet created as siblings)
- "Generate Multi-Gallery" button → mint a multi-diagnostic gallery token for the prospect
- Multi-gallery URL display + copy button

**Tab type extension:**
```typescript
type Tab = 'overview' | 'audits' | 'files' | 'deliverables' | 'prompts' | 'checklist' | 'history' | 'lineage' | 'cascade' | 'siblings';
```

### 6.3 Campaign Detail — Cycle to Next Engagement

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (extend)

When a campaign is at `delivered` or `retainer_won` stage, show a "Start Next Engagement" button in the overview tab. Clicking it:
1. Confirms with the operator (modal: "This will cycle the campaign back to seek for a follow-on engagement. Engagement cycle will increment to N.")
2. Calls `POST /:campaignId/cycle`
3. Refreshes the campaign detail

### 6.4 Multi-Diagnostic Gallery Page

**File:** `apps/web/src/app/preview/[token]/MultiGalleryPage.tsx` (new)

**Route:** `/preview/[token]?prospect=true` (query param distinguishes multi-gallery from single gallery)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Digital Health Diagnostic — Joe's Grocery                  │
│  3 issues found across 3 areas · Expires in 71h 59m         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ⚠ Review Response Diagnostic (A1)                     │  │
│  │ 12 of your reviews are going unanswered across        │  │
│  │ Google & Yelp                                         │  │
│  │                          [View Detailed Gallery →]    │  │
│  │                          [Fix All Reviews — $297]     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ⚠ Listing Consistency Diagnostic (A3)                 │  │
│  │ Your business shows up 3 different ways across        │  │
│  │ Google, Yelp & Facebook                               │  │
│  │                          [View Detailed Gallery →]    │  │
│  │                          [Sync My Listings — $197]    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ⚠ Product Visibility Diagnostic (A6)                  │  │
│  │ Customers can't see what you carry before visiting    │  │
│  │                          [View Detailed Gallery →]    │  │
│  │                          [Show My Products — $397]    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Why am I seeing this? · Powered by VisibleShelf            │
└─────────────────────────────────────────────────────────────┘
```

**Each section:**
- Archetype icon + gallery title (from `resolveGalleryArchetypeDefaults`)
- Subtitle (archetype-aware)
- "View Detailed Gallery" → navigates to `/preview/{siblingToken}` (the individual archetype gallery)
- CTA button → navigates to `/marketing/pay?ptoken={siblingToken}` (the individual archetype's pay page)
- Primary sibling section is highlighted (border accent + "Priority" badge)

**Engagement tracking:**
- `gallery_opened` fires on page load (against the multi-gallery token)
- `cta_clicked` fires when any CTA or "View Detailed Gallery" is clicked (with `sibling_campaign_id` in metadata)
- `session_heartbeat` fires every 30s
- `session_end` fires on unload

### 6.5 Frontend Services

**File:** `apps/web/src/services/MarketingOpsService.ts` (extend)

Add methods:
```typescript
async getTriageAlternatives(campaignId: string): Promise<TriageRecommendation[]>
async createSiblingCampaign(campaignId: string, input: {
  archetype: string;
  playbookCode?: string;
  assignedTo?: string;
  notes?: string;
}): Promise<CampaignDetail>
async listSiblings(campaignId: string): Promise<CampaignDetail[]>
async cycleToNextEngagement(campaignId: string, opts?: {
  resetToStage?: 'seek' | 'preview_built';
  notes?: string;
}): Promise<CampaignDetail>
async generateMultiGalleryToken(prospectId: string, opts?: {
  expiresInDays?: number;
  galleryTitle?: string;
  gallerySubtitle?: string;
}): Promise<{ token: string; url: string; expiresAt: string }>
```

**File:** `apps/web/src/services/MarketingPayPublicService.ts` (no change — pay page already resolves campaign from token regardless of type)

---

## 7. Outreach Integration

### 7.1 Multi-Archetype Outreach Message

When the operator dispatches outreach for a prospect with multiple siblings, the outreach message can reference the multi-gallery URL instead of (or in addition to) individual sibling gallery URLs.

**Outreach message template (multi-archetype):**
```
Hi {ownerName},

I noticed a few things affecting {businessName}'s online presence:

• {N1} unanswered reviews across Google & Yelp
• Your business info is inconsistent across platforms
• Customers can't browse your products online

I put together a free diagnostic report showing exactly what's happening:
{multiGalleryUrl}

The report expires in 72 hours. Take a look and let me know which areas
you'd like to tackle first.

— {operatorName}
```

**Outreach log:** `mkt_outreach_log.preview_token` records the multi-gallery token. The existing outreach dispatch flow is extended to accept a `prospect_id` parameter that triggers multi-gallery URL generation.

### 7.2 Individual Sibling Outreach

The operator can still dispatch outreach per-sibling (single-archetype message + single gallery URL). This is the existing flow, unchanged. The multi-gallery is an additional option, not a replacement.

---

## 8. Edge Cases

### 8.1 Single Archetype (No Siblings)

When triage detects only one qualifying archetype, the flow is unchanged. No siblings are created, no multi-gallery token is needed. The operator uses the existing single-archetype gallery + outreach flow.

### 8.2 Sibling Already Exists

If the operator tries to create a sibling for an archetype that already has a sibling campaign for this prospect, the API returns a 409 Conflict: "A sibling campaign with archetype {X} already exists for this prospect." The operator can cycle the existing sibling instead.

### 8.3 Sibling Stage Independence

Each sibling runs its own pipeline independently. Sibling A1 may be at `delivered` while sibling A3 is at `shown` and sibling A6 is at `seek`. The multi-gallery only includes siblings at `preview_built` or `shown` (those with galleries ready). Siblings at `paid` or later are excluded from the multi-gallery (the prospect already converted on those).

### 8.4 Cross-Archetype Upsell After Partial Conversion

When the prospect pays for one sibling (say A1), that sibling advances to `paid` → `delivered`. The other siblings remain at `shown`. The operator can now follow up with "You've fixed your reviews — now let's fix your listings" using the remaining sibling campaigns. The multi-gallery token can be regenerated to exclude the converted sibling (showing only remaining pain dimensions).

### 8.5 Cycling vs. New Sibling

- **Cycling** = follow-on engagement for the **same** archetype (e.g., second batch of review responses, review monitoring retainer). Reuses the same campaign row, increments `engagement_cycle`.
- **New sibling** = a **different** archetype for the same business. Creates a new campaign row with the same `business_prospect_id`.

### 8.6 Legacy Campaigns (Pre-Migration)

The migration backfills `business_prospect_id = id` for all existing business-scope campaigns, making each its own prospect group with one sibling. The operator can create additional siblings from any legacy campaign's triage alternatives.

### 8.7 Category/City Scope Campaigns

Category-scope and city-scope campaigns do not get `business_prospect_id` (they are not business prospects). The sibling flow only applies to `scope = 'business'` campaigns. The `parent_campaign_id` relationship (category → business derivation) is unchanged.

---

## 9. Sprint Breakdown

### Sprint 1 (Weeks 1–2): Repair Re-Categorization + Schema + Backend Foundation

**Scope:**
- Migration 178 (repair playbook re-categorization — PB-01/PB-03/PB-06/PB-07 → `profile_repair`)
- Migration 179 (`business_prospect_id` + `engagement_cycle` + `is_primary_sibling`)
- Migration 180 (multi-gallery token `metadata` column + prospect index)
- Prisma schema update + `pnpm prisma:generate`
- `triage/types.ts` — add `profile_repair` to `PLAYBOOK_CATEGORIES`, add `MultiArchetypeTriageResult`
- `CampaignTriageService.acceptTriage` — set `repair_track: 'standard'` when accepting a `profile_repair` playbook
- `CampaignTriageService.overrideTriage` — set `repair_track: 'standard'` when overriding to a `profile_repair` playbook (C2 fix)
- `MarketingCampaignService.transitionStage` — fix registry-driven intake condition to include `profile_repair` + `standard` (C1 fix)
- `MarketingPlaybookCatalogService.toRow` — fix `ArchetypeCodeWithA5` → `ArchetypeCodeWithA6` cast (S1 fix)
- `CampaignTriageService.loadSignalsAndPlaybooks` — extract helper from `evaluateTriageForCampaign` (refactor, A2 fix)
- `BusinessProspectService` (new) — sibling creation, listing, cycling
- `TriageEngineService.evaluateAllMatchingPlaybooks` (pure function extension, includes `detectedSignals` per alternative — A1 fix)
- `CampaignTriageService.evaluateAllForCampaign` (DB wrapper using `loadSignalsAndPlaybooks`)
- New routes: `GET /triage/alternatives`, `POST /siblings`, `GET /siblings`, `POST /cycle`
- `MarketingCampaignService` — extend `CampaignInput` + `CampaignListFilters` with `businessProspectId`
- `listCampaigns` filter by `business_prospect_id`
- `CampaignDetail` type — include `business_prospect_id`, `engagement_cycle`, `is_primary_sibling`, `siblings[]` (S2 fix)
- `SiblingSummary` type (new) — sibling list element shape

**Files touched:**
- `apps/api/prisma/schema.prisma` — 3 new fields on `mkt_campaigns_list` + `metadata` on `mkt_deliverable_preview_tokens` + indexes
- `database/migrations/178_mkt_repair_playbook_recategory.sql` (new)
- `database/migrations/179_mkt_business_prospect_siblings.sql` (new)
- `database/migrations/180_multi_diagnostic_gallery_tokens.sql` (new — adds `metadata` column)
- `apps/api/src/services/triage/types.ts` (extend — add `profile_repair` to `PLAYBOOK_CATEGORIES`, `MultiArchetypeTriageResult`)
- `apps/api/src/services/CampaignTriageService.ts` (extend — `profile_repair` accept + override logic, `loadSignalsAndPlaybooks` refactor, `evaluateAllForCampaign`)
- `apps/api/src/services/BusinessProspectService.ts` (new)
- `apps/api/src/services/triage/TriageEngineService.ts` (extend — `evaluateAllMatchingPlaybooks` with `detectedSignals`)
- `apps/api/src/services/MarketingCampaignService.ts` (extend — fix `transitionStage` intake condition, filters, input, detail shape, `SiblingSummary` type)
- `apps/api/src/services/MarketingPlaybookCatalogService.ts` (fix — `ArchetypeCodeWithA5` → `ArchetypeCodeWithA6`)
- `apps/api/src/routes/marketing-ops.ts` (extend — 4 new routes)

**Tests:**
- `apps/api/src/services/__tests__/BusinessProspectService.test.ts` (new):
  - `initializeProspectFromCampaign` — generates prospect ID, sets on campaign, marks primary
  - `createSiblingCampaign` — copies business info, sets prospect ID, creates at seek stage
  - `createSiblingCampaign` — 409 when archetype already exists as sibling
  - `createSiblingCampaign` — `profile_repair` sibling with `repairTrack: 'standard'` runs review pipeline
  - `createSiblingCampaign` — `profile_repair` sibling with `repairTrack: 'escalated'` runs recovery pipeline
  - `listSiblings` — returns all siblings ordered by archetype priority
  - `getPrimarySibling` — returns the primary or highest-priority sibling
  - `cycleToNextEngagement` — increments cycle, resets stage, records history
- `apps/api/src/services/__tests__/TriageEngineMultiArchetype.test.ts` (new):
  - `evaluateAllMatchingPlaybooks` — returns all matching playbooks ranked by priority
  - `evaluateAllMatchingPlaybooks` — winner matches `evaluateTriage` result
  - `evaluateAllMatchingPlaybooks` — empty when no playbooks match
  - `evaluateAllForCampaign` — returns winner + alternatives
- `apps/api/src/services/__tests__/CampaignTriageRepairCategory.test.ts` (new):
  - `acceptTriage` with PB-01 → sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'`
  - `acceptTriage` with PB-03 → sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'`
  - `acceptTriage` with PB-06 → sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'`
  - `acceptTriage` with PB-07 → sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'`
  - `acceptTriage` with PB-02 → sets `campaign_category: 'review_management'` (unchanged)
  - `acceptTriage` with PB-04 → sets `campaign_category: 'recovery_management'` (unchanged)
  - `overrideTriage` to PB-01 → sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'` (C2 fix)
  - `overrideTriage` to PB-07 → sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'` (C2 fix)
  - `overrideTriage` to PB-02 → sets `campaign_category: 'review_management'` + `repair_track: null` (unchanged)
  - `transitionsFor('profile_repair', 'standard')` returns `REVIEW_TRANSITIONS`
  - `transitionsFor('profile_repair', 'escalated')` returns `RECOVERY_TRANSITIONS`
  - `pipelineFor('profile_repair', 'standard')` returns `'review'`
  - `pipelineFor('profile_repair', 'escalated')` returns `'recovery'`
- `apps/api/src/services/__tests__/MarketingCampaignServiceIntakeRegression.test.ts` (new — C1 fix):
  - `transitionStage` to `outreach_dispatched` for `profile_repair` + `standard` → auto-generates registry intake (gbp_optimization / review_response_setup)
  - `transitionStage` to `outreach_dispatched` for `profile_repair` + `escalated` → auto-generates dispute intake (NOT registry intake)
  - `transitionStage` to `outreach_dispatched` for `review_management` → auto-generates registry intake (unchanged)
  - `transitionStage` to `outreach_dispatched` for `recovery_management` → auto-generates dispute intake (unchanged)
- `apps/api/src/tests/marketing-ops-sibling-routes.test.ts` (new):
  - `POST /siblings` — creates triage-driven sibling, returns 201
  - `POST /siblings` — creates `profile_repair` sibling with `repairTrack`, returns 201
  - `POST /siblings` — 409 when archetype already exists
  - `GET /siblings` — lists siblings for prospect
  - `POST /cycle` — increments engagement_cycle, resets stage + date_* fields (per §3.5 reset semantics)
  - `POST /cycle` — preserves `business_prospect_id`, `customer_id`, `campaign_category`, `repair_track`
  - `GET /triage/alternatives` — returns winner + alternatives with `detectedSignals` per alternative (A1 fix)
  - Auth required on all routes

### Sprint 2 (Weeks 3–4): Multi-Diagnostic Gallery

**Scope:**
- Migration 181 (`mkt_gallery_events.sibling_campaign_id` column — for per-sibling event tracking in multi-gallery context)
- Multi-gallery token issuance route (`POST /prospects/:prospectId/multi-gallery-token`)
- Multi-gallery public API (`GET /api/public/gallery/multi/:token`)
- Multi-gallery frontend page (`/preview/[token]?prospect=true`)
- Multi-gallery engagement tracking (events with `sibling_campaign_id` — see Migration 181 below)
- `MarketingOpsService` frontend — `generateMultiGalleryToken`
- `MarketingOpsPublicService` frontend — `getMultiGalleryData`
- Outreach integration — multi-archetype message template + dispatch with `prospect_id`

**Migration 181: `mkt_gallery_events.sibling_campaign_id`**

The existing `mkt_gallery_events` table has `token_id` + `campaign_id` but no `sibling_campaign_id`. For multi-gallery tokens, the `campaign_id` is the primary sibling's campaign, but engagement events (screenshot views, CTA clicks) happen on individual sibling galleries. Without `sibling_campaign_id`, we can't attribute engagement to a specific sibling — only to the prospect group as a whole.

```sql
-- 181_mkt_gallery_events_sibling_campaign.sql

-- sibling_campaign_id: the specific sibling campaign the engagement event
-- was on. NULL for single-gallery tokens (the campaign_id is the sibling).
-- For multi-gallery tokens, this identifies which sibling's gallery section
-- the user was viewing when the event fired.
ALTER TABLE mkt_gallery_events
  ADD COLUMN sibling_campaign_id VARCHAR(255);

-- Index for per-sibling analytics queries
CREATE INDEX idx_mkt_gallery_events_sibling
  ON mkt_gallery_events (sibling_campaign_id, event_type, created_at DESC)
  WHERE sibling_campaign_id IS NOT NULL;
```

**Prisma schema update (model `mkt_gallery_events`):**
```prisma
model mkt_gallery_events {
  // ... existing fields ...
  sibling_campaign_id String?   @db.VarChar(255)
  // ... existing indexes ...
}
```

**Event tracking extension:** The `galleryEventSchema` Zod schema in `marketing-ops-public.ts` gains an optional `siblingCampaignId` field. The `GalleryAnalyticsService.trackEvent` method passes it through to the `mkt_gallery_events` row. For single-gallery tokens, `siblingCampaignId` is null (the `campaign_id` is the sibling). For multi-gallery tokens, the frontend sends `siblingCampaignId` with each event so the analytics can attribute engagement to the correct sibling.

**Files touched:**
- `database/migrations/181_mkt_gallery_events_sibling_campaign.sql` (new)
- `apps/api/prisma/schema.prisma` (extend — `sibling_campaign_id` on `mkt_gallery_events`)
- `apps/api/src/routes/marketing-ops.ts` (extend — multi-gallery token route)
- `apps/api/src/routes/marketing-ops-public.ts` (extend — multi-gallery public API)
- `apps/api/src/services/marketing/GalleryMultiService.ts` (new — multi-gallery data assembly)
- `apps/api/src/services/marketing/GalleryEventService.ts` (extend — `sibling_campaign_id` in metadata)
- `apps/web/src/app/preview/[token]/MultiGalleryPage.tsx` (new)
- `apps/web/src/app/preview/[token]/page.tsx` (extend — detect `?prospect=true` and render MultiGalleryPage)
- `apps/web/src/services/MarketingOpsService.ts` (extend — `generateMultiGalleryToken`)
- `apps/web/src/services/MarketingPayPublicService.ts` (extend — `getMultiGalleryData`)
- `apps/api/src/services/OutreachDispatchService.ts` (extend — multi-archetype message template)

**Tests:**
- `apps/api/src/services/__tests__/GalleryMultiService.test.ts` (new):
  - Assembles multi-gallery data from sibling campaigns
  - Filters siblings at preview_built/shown only
  - Excludes paid/delivered siblings
  - Includes archetype-aware defaults per sibling
  - Primary sibling is first in the list
- `apps/api/src/tests/multi-gallery-routes.test.ts` (new):
  - Token issuance: stage gate (at least 1 sibling at preview_built/shown)
  - Token issuance: screenshot gate (at least 1 sibling with screenshots)
  - Public API: valid token → 200 with siblings array
  - Public API: expired token → 200 with re-activation hook
  - Public API: invalid token → 404
  - Event tracking: `cta_clicked` with `sibling_campaign_id` metadata

### Sprint 3 (Weeks 5–6): Frontend + Portal + Tests

**Scope:**
- Triage card — multi-archetype suggestions UI
- Campaign detail — siblings tab + cycle button
- Customer portal — campaign grouping by `business_prospect_id`
- Full test suite + build verification

**Files touched:**
- `apps/web/src/components/marketing-ops/IntelligentTriageCard.tsx` (extend — alternatives section)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (extend — siblings tab, cycle button)
- `apps/web/src/services/MarketingOpsService.ts` (extend — `getTriageAlternatives`, `createSiblingCampaign`, `listSiblings`, `cycleToNextEngagement`)
- `apps/api/src/services/MarketingCustomerProjection.ts` (extend — group by `business_prospect_id`)
- `apps/web/src/app/account/marketing/page.tsx` (extend — grouped campaign display)

**Tests:**
- Frontend component tests:
  - Triage card renders alternatives with "Create Sibling" buttons
  - Siblings tab lists all siblings with archetype badges
  - Cycle button appears only at delivered/retainer_won stage
  - Multi-gallery page renders all sibling sections with CTAs
  - Multi-gallery page fires `gallery_opened` on load
- `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` (extend):
  - `buildPortalOverview` groups campaigns by `business_prospect_id`
  - Legacy campaigns (null prospect ID) are each their own group
- Full build verification:
  - `pnpm checkapi` passes with zero new errors
  - `pnpm checkweb` passes with zero new errors
  - `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds
  - All new migrations apply cleanly
  - All test suites pass

---

## 10. What Does NOT Change

| Component | Why it's unchanged |
|---|---|
| Stage pipeline per campaign | Each sibling runs its own independent pipeline |
| `mkt_revenue` model | Already supports multiple payments per campaign (for cycling) |
| Customer portal campaign list | Already supports multiple campaigns per `customer_id` |
| `resolveCampaignArchetype` | Still resolves one archetype per campaign — siblings each have their own |
| `GalleryArchetypeDefaults` | Already archetype-aware — called per sibling |
| Outreach opener/header/closer | Already archetype-aware via `resolveCampaignArchetype` |
| Deliverable section generation | Already archetype-aware — each sibling generates its own deliverable |
| `parent_campaign_id` | Unchanged — still used for category→business derivation |
| Triage engine cascade | Still picks one winner — `evaluateAllMatchingPlaybooks` is an additional API |
| Pay page | Already resolves campaign from token regardless of type |
| Intake portal | Registry-driven intake works per-campaign — each sibling has its own intake |

### 10.1 Per-Sibling Pipeline Behavior (Review vs Recovery vs Repair)

Each sibling inherits its pipeline behavior from its `campaign_category` (and `repair_track` for `profile_repair`) — this is the existing `transitionsFor(category, repairTrack)` + `pipelineFor(category, repairTrack)` dispatch. The key insight: **siblings can run different pipeline machines** because each is an independent campaign row with its own `campaign_category`.

**Three signal domains, three triage pillars:**

| Pillar | Signal families | What it's about | Triage category |
|---|---|---|---|
| **Review** | RA (review drought, low volume, unanswered backlog) | Customer feedback + owner response engagement | `review_management` |
| **Recovery** | RA (BBB grade, unanswered complaints, negative backlog) | BBB reputation recovery | `recovery_management` |
| **Repair** | DS + CP + VP + WC (NAP drift, URL mismatch, broken links, missing photos, missing CTA, missing product catalog) | Fixing actual profile/website/product drifts | `profile_repair` |

**Four campaign categories, three pipeline machines:**

| `campaign_category` | `repair_track` | Pipeline | Stage Machine | How it's assigned |
|---|---|---|---|---|
| `review_management` | — | Review | `REVIEW_TRANSITIONS` | Triage accept of PB-02 |
| `recovery_management` | — | Recovery | `RECOVERY_TRANSITIONS` | Triage accept of PB-04 |
| `triage_management` | — | Review (stuck at `seek`) | `REVIEW_TRANSITIONS` | Default before operator accepts triage |
| `profile_repair` | `null` (undecided) | Review | `REVIEW_TRANSITIONS` (starts at `seek`) | Manual operator creation — track decided later |
| `profile_repair` | `standard` | Review | `REVIEW_TRANSITIONS` | Triage accept of PB-01/PB-03/PB-06/PB-07 (default), OR manual operator choice for standard repair (NAP drift, unclaimed profile, missing category/hours, platform gap) |
| `profile_repair` | `escalated` | Recovery | `RECOVERY_TRANSITIONS` | Operator escalates from standard (suspension, duplicate listing, hijacked listing, ownership dispute, address verification block) — can de-escalate back via `switchRepairTrack` |

**`profile_repair` is now a first-class triage category** (corrected by Migration 178). When triage accepts PB-01/PB-03/PB-06/PB-07, the campaign gets `campaign_category: 'profile_repair'` + `repair_track: 'standard'` (default — runs the review pipeline). The operator can later escalate to `repair_track: 'escalated'` (switches to the recovery pipeline via `switchRepairTrack`, which remaps stages: `seek → audit_identified`, `preview_built → framework_preview_generated`, `shown → outreach_dispatched`). The operator can also de-escalate back (recovery → review) before intake is submitted.

The key difference from `recovery_management`: a `profile_repair` + `escalated` campaign runs the **recovery pipeline** but uses the `profile_repair` intake kind (not `dispute`), and the operator can **switch tracks** mid-flight. A `recovery_management` campaign is locked to the recovery pipeline with no track switching.

**Playbook → Category → Pipeline → Behavior (corrected):**

| Playbook | Archetype | Category | Track | Pipeline | Stage Machine | Gallery Framing | Deliverable |
|---|---|---|---|---|---|---|---|
| PB-02 | A1 | `review_management` | — | Review | `seek → preview_built → shown → paid → delivered → retainer_pitched → retainer_won` | "Review Response Diagnostic" | Review responses |
| PB-04 | A2 | `recovery_management` | — | Recovery | `audit_identified → framework_preview_generated → outreach_dispatched → awaiting_owner_intake → intake_submitted → final_resolution_drafted → owner_approved → resolved_and_closed` | "Review Recovery Diagnostic" | Recovery playbook + dispute intake |
| PB-05 | A5 | `triage_management` → (accept → re-categorize) | — | Review or Recovery | Depends on accepted playbook | "Multi-Signal Diagnostic" | Combined sections |
| PB-01 | A3 | `profile_repair` | `standard` | Review | `seek → preview_built → shown → paid → delivered → retainer_pitched → retainer_won` | "Listing Accuracy Diagnostic" | Listing corrections + profile repair intake |
| PB-03 | A4 | `profile_repair` | `standard` | Review | Same review stages | "Conversion Gap Diagnostic" | CTA fixes + profile repair intake |
| PB-06 | A3 | `profile_repair` | `standard` | Review | Same review stages | "Listing Accuracy Diagnostic" | Visual/asset refresh + profile repair intake |
| PB-07 | A6 | `profile_repair` | `standard` | Review | Same review stages | "Product Visibility Diagnostic" | Product visibility sections + profile repair intake |
| *(manual)* | A3 | `profile_repair` | `escalated` | Recovery | Same recovery stages | "Listing Accuracy Diagnostic" | Profile repair intake (escalated: suspension, hijacked, etc.) |

**Concrete example — same business prospect, 4 siblings:**

| Sibling | Source | Category | Track | Pipeline | What it does |
|---|---|---|---|---|---|
| 1 (primary) | PB-02 (A1) | `review_management` | — | Review | Review response deliverable — "Fix All Reviews" — review pipeline stages, review-centric opener, review response intake |
| 2 | PB-04 (A2) | `recovery_management` | — | Recovery | Dispute intake machine — "Fix the Negative Review Cluster" — recovery pipeline stages, recovery-centric opener, dispute intake form |
| 3 | PB-07 (A6) | `profile_repair` | `standard` | Review | Product visibility deliverable — "Show My Products" — review pipeline stages, product-centric opener, GBP optimization intake |
| 4 | PB-01 (A3) | `profile_repair` | `escalated` | Recovery | Profile repair — "Fix Your Suspended Google Listing" — recovery pipeline stages, repair-centric opener, profile_repair intake (escalated track: suspension/hijacked) |

Sibling 3 is triage-driven: the operator accepts PB-07, which sets `campaign_category: 'profile_repair'` + `repair_track: 'standard'`. It runs the review pipeline with product-visibility deliverable sections.

Sibling 4 is triage-driven then escalated: the operator accepts PB-01 (standard track, review pipeline), then escalates to `repair_track: 'escalated'` via `switchRepairTrack` when they discover the listing is suspended. It switches to the recovery pipeline with `profile_repair` intake kind. The operator could de-escalate it back to the review pipeline if the suspension turns out to be a simple NAP fix.

Each sibling:
- Has its own `campaign_category` set by `CampaignTriageService.acceptTriage` / `overrideTriage` (for triage-assigned siblings, including `profile_repair` playbooks) or manually at creation (for manually-created `profile_repair` siblings)
- Has its own `repair_track` — `standard` by default when triage assigns `profile_repair`, `null` for `review_management` / `recovery_management` siblings
- Runs its own stage transitions via `transitionsFor(category, repairTrack)` — review siblings use `REVIEW_TRANSITIONS`, recovery siblings use `RECOVERY_TRANSITIONS`, `profile_repair` siblings use whichever track is active
- Routes to its own pipeline tab via `pipelineFor(category, repairTrack)` — review + standard-repair siblings appear in Openers/Follow-Ups, recovery + escalated-repair siblings appear in Recovery tab
- Generates its own archetype-specific deliverable sections via `DeliverableSectionService.generateAllSections` (A6 → product sections, A1–A5 → review-management sections)
- Renders its own archetype-specific gallery via `resolveGalleryArchetypeDefaults`
- Dispatches its own archetype-specific outreach via `HeaderService` / `CloserService` (A6 → product-visibility framing, A1–A5 → review-management framing)
- Fires its own registry-driven intake forms on stage transitions (dispute intake for recovery, profile_repair intake for escalated repair, gbp_optimization/review_response_setup for review + standard repair)
- Has its own independent payment, revenue, receipt, and retainer

The sibling model does not change any of this — it simply allows multiple independent campaign rows to exist for the same business prospect, each with its own category/archetype/pipeline, linked by `business_prospect_id`.

---

## 11. Migration Path for Existing Campaigns

1. **Migration 178** re-categorizes PB-01/PB-03/PB-06/PB-07 from `review_management` to `profile_repair` in the playbook catalog. Existing campaigns that already accepted these playbooks keep `review_management` (no automatic re-categorization — that would change pipeline behavior). New campaigns accepting these playbooks after the migration get `profile_repair` + `standard` track.
2. **Migration 179** backfills `business_prospect_id = id` for all existing `scope = 'business'` campaigns. Each becomes its own prospect group with one sibling (itself), marked as primary.
3. No existing campaign changes behavior — `resolveCampaignArchetype` still returns one archetype, the gallery still renders one archetype, outreach still works per-campaign.
4. The operator can create siblings from any existing campaign's triage alternatives (if the audit detected multiple signals — now including repair playbooks as separate suggestions from review playbooks).
5. The operator can cycle any delivered campaign to its next engagement.
6. The multi-gallery is opt-in — the operator generates it only when they want to present multiple dimensions.

---

## 12. Sprint Summary

| Sprint | Goal | Depends On | Key Deliverables |
|---|---|---|---|
| 1 | Repair Re-Categorization + Schema + Backend Foundation | — | Migration 178 (repair re-categorization), Migrations 179/180 (siblings + multi-gallery metadata), `profile_repair` as `PlaybookCategory`, accept+override `repair_track` fix, `transitionStage` intake regression fix, `ArchetypeCodeWithA6` fix, `loadSignalsAndPlaybooks` refactor, BusinessProspectService, triage multi-archetype (with `detectedSignals`), sibling + cycle routes, `SiblingSummary` type |
| 2 | Multi-Diagnostic Gallery | S1 | Migration 181 (gallery events sibling_campaign_id), multi-gallery token, public API, frontend page, outreach integration |
| 3 | Frontend + Portal + Tests | S1, S2 | Triage card alternatives, siblings tab, cycle button, portal grouping, full test suite |

**Parallelism:** Sprint 2's backend work (multi-gallery API) can start as soon as Sprint 1's schema is landed. Sprint 3's frontend work depends on both S1 and S2 APIs.

**Critical path:** S1 → S2 → S3 (3 sprints on the critical path).

---

## 13. Open Questions for Review

1. **Multi-gallery expiry:** Should the multi-gallery token have the same 72h default as individual gallery tokens, or a longer window (e.g., 7 days) since it represents a broader engagement?

2. **Cross-sibling analytics:** Should the dashboard analytics (`getDashboardAnalytics`) add a "prospect-level" view that aggregates engagement across siblings, or keep analytics per-campaign?

3. **Retainer scope:** When a sibling reaches `retainer_won`, does the retainer cover only that archetype's ongoing service, or can it be expanded to cover all siblings? (Current model: retainer is per-campaign.)

4. **A5 interaction:** If triage detects a dual-signal (A5) and the operator creates siblings instead, should A5 be offered as an alternative? Or should A5 suppress sibling creation (since it's the combined approach)?
