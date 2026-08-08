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

---

## 4. Schema Changes

### 4.1 Migration 178: `business_prospect_id` + `engagement_cycle`

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

-- Backfill: for existing business-scope campaigns without a prospect_id,
-- set business_prospect_id = id (each existing business campaign becomes
-- its own prospect group with one sibling — itself).
UPDATE mkt_campaigns_list
  SET business_prospect_id = id, is_primary_sibling = true
  WHERE scope = 'business' AND business_prospect_id IS NULL;
```

### 4.2 Migration 179: Multi-Diagnostic Gallery Token Support

```sql
-- 179_multi_diagnostic_gallery_tokens.sql

-- The existing mkt_deliverable_preview_tokens table already has a token_type
-- column. We add 'multi_diagnostic_gallery' as a valid value.
-- For multi-gallery tokens, the campaign_id column references the primary
-- sibling campaign, and a new metadata field 'sibling_campaign_ids' lists
-- all sibling campaign IDs included in the multi-gallery.

-- No schema change needed — token_type is a VARCHAR and metadata is JSONB.
-- The new token_type value is enforced at the application layer (Zod schema).

-- Add an index for prospect-level gallery lookups
CREATE INDEX idx_mkt_preview_tokens_prospect
  ON mkt_deliverable_preview_tokens ((metadata->>'business_prospect_id'))
  WHERE token_type = 'multi_diagnostic_gallery';
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
    assignedTo?: string;
    notes?: string;
  }, ctx?: RequestCtx): Promise<mkt_campaigns_list>;

  /**
   * Initialize a prospect group from an existing campaign.
   * Called when the operator creates the first sibling from a campaign
   * that doesn't yet have a business_prospect_id.
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
1. Operator selects an archetype from the triage-presented list
2. `initializeProspectFromCampaign` is called if the source campaign has no `business_prospect_id` yet (generates a new prospect ID, sets it on the source campaign, marks source as primary)
3. `createSiblingCampaign` copies business info (name, category, city, phone, email, website, address) from the primary sibling, creates a new campaign at `seek` stage with `business_prospect_id` set
4. The new sibling gets its own triage evaluation — the operator accepts the chosen playbook to lock in the archetype
5. The new sibling runs its own pipeline independently

### 5.2 Triage Multi-Archetype Presentation

**File:** `apps/api/src/services/triage/TriageEngineService.ts` (extend)

**Current:** `evaluateTriage` returns the first matching playbook in priority order.

**Extension:** Add `evaluateAllMatchingPlaybooks` that returns **all** playbooks whose `matching_rules` match the signal set, ranked by `priority_rank`. This is the "suggestion list" the operator picks from.

```typescript
/**
 * Evaluate all playbooks that match the signal set, ranked by priority.
 * Used by the multi-archetype triage card to present sibling-creation
 * suggestions. The winner (rank 1) is the same as evaluateTriage's result.
 */
export function evaluateAllMatchingPlaybooks(
  signals: ReadonlySet<SignalCode>,
  playbooks: PlaybookCatalogRow[],
): TriageRecommendation[] {
  return playbooks
    .filter((pb) => ruleMatches(pb.matchingRules, signals))
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .map((pb) => buildRecommendation(pb, signals));
}
```

**File:** `apps/api/src/services/CampaignTriageService.ts` (extend)

Add `evaluateAllForCampaign` that wraps `evaluateAllMatchingPlaybooks` with DB access (loads campaign + audit + signals, returns all matching recommendations).

```typescript
async evaluateAllForCampaign(input: TriageEvaluateInput, ctx?: RequestCtx): Promise<{
  winner: StoredTriageResult;
  alternatives: TriageRecommendation[];
}> {
  // 1. Run the normal evaluation (stores the winner)
  const winner = await this.evaluateTriageForCampaign(input, ctx);
  // 2. Re-run the engine in "all matches" mode
  const { signals, playbooks } = await this.loadSignalsAndPlaybooks(input, ctx);
  const allMatches = evaluateAllMatchingPlaybooks(signals, playbooks);
  // 3. Alternatives = all matches except the winner
  const alternatives = allMatches.filter(
    (m) => m.playbookCode !== winner.recommendedPlaybook.code
  );
  return { winner, alternatives };
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
  playbookCode?: 'PB-01' | 'PB-02' | 'PB-03' | 'PB-04' | 'PB-05' | 'PB-06' | 'PB-07';
  assignedTo?: string;
  notes?: string;
}
```

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

### Sprint 1 (Weeks 1–2): Schema + Backend Foundation

**Scope:**
- Migration 178 (`business_prospect_id` + `engagement_cycle` + `is_primary_sibling`)
- Migration 179 (multi-gallery token index)
- Prisma schema update + `pnpm prisma:generate`
- `BusinessProspectService` (new) — sibling creation, listing, cycling
- `TriageEngineService.evaluateAllMatchingPlaybooks` (pure function extension)
- `CampaignTriageService.evaluateAllForCampaign` (DB wrapper)
- New routes: `GET /triage/alternatives`, `POST /siblings`, `GET /siblings`, `POST /cycle`
- `MarketingCampaignService` — extend `CampaignInput` + `CampaignListFilters` with `businessProspectId`
- `listCampaigns` filter by `business_prospect_id`
- `CampaignDetail` type — include `business_prospect_id`, `engagement_cycle`, `is_primary_sibling`, `siblings[]`

**Files touched:**
- `apps/api/prisma/schema.prisma` — 3 new fields + index
- `database/migrations/178_mkt_business_prospect_siblings.sql` (new)
- `database/migrations/179_multi_diagnostic_gallery_tokens.sql` (new)
- `apps/api/src/services/BusinessProspectService.ts` (new)
- `apps/api/src/services/triage/TriageEngineService.ts` (extend)
- `apps/api/src/services/triage/types.ts` (extend — `MultiArchetypeTriageResult`)
- `apps/api/src/services/CampaignTriageService.ts` (extend)
- `apps/api/src/services/MarketingCampaignService.ts` (extend — filters, input, detail shape)
- `apps/api/src/routes/marketing-ops.ts` (extend — 4 new routes)

**Tests:**
- `apps/api/src/services/__tests__/BusinessProspectService.test.ts` (new):
  - `initializeProspectFromCampaign` — generates prospect ID, sets on campaign, marks primary
  - `createSiblingCampaign` — copies business info, sets prospect ID, creates at seek stage
  - `createSiblingCampaign` — 409 when archetype already exists as sibling
  - `listSiblings` — returns all siblings ordered by archetype priority
  - `getPrimarySibling` — returns the primary or highest-priority sibling
  - `cycleToNextEngagement` — increments cycle, resets stage, records history
- `apps/api/src/services/__tests__/TriageEngineMultiArchetype.test.ts` (new):
  - `evaluateAllMatchingPlaybooks` — returns all matching playbooks ranked by priority
  - `evaluateAllMatchingPlaybooks` — winner matches `evaluateTriage` result
  - `evaluateAllMatchingPlaybooks` — empty when no playbooks match
  - `evaluateAllForCampaign` — returns winner + alternatives
- `apps/api/src/tests/marketing-ops-sibling-routes.test.ts` (new):
  - `POST /siblings` — creates sibling, returns 201
  - `POST /siblings` — 409 when archetype already exists
  - `GET /siblings` — lists siblings for prospect
  - `POST /cycle` — increments engagement_cycle, resets stage
  - Auth required on all routes

### Sprint 2 (Weeks 3–4): Multi-Diagnostic Gallery

**Scope:**
- Multi-gallery token issuance route (`POST /prospects/:prospectId/multi-gallery-token`)
- Multi-gallery public API (`GET /api/public/gallery/multi/:token`)
- Multi-gallery frontend page (`/preview/[token]?prospect=true`)
- Multi-gallery engagement tracking (events with `sibling_campaign_id` metadata)
- `MarketingOpsService` frontend — `generateMultiGalleryToken`
- `MarketingOpsPublicService` frontend — `getMultiGalleryData`
- Outreach integration — multi-archetype message template + dispatch with `prospect_id`

**Files touched:**
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

---

## 11. Migration Path for Existing Campaigns

1. **Migration 178** backfills `business_prospect_id = id` for all existing `scope = 'business'` campaigns. Each becomes its own prospect group with one sibling (itself), marked as primary.
2. No existing campaign changes behavior — `resolveCampaignArchetype` still returns one archetype, the gallery still renders one archetype, outreach still works per-campaign.
3. The operator can create siblings from any existing campaign's triage alternatives (if the audit detected multiple signals).
4. The operator can cycle any delivered campaign to its next engagement.
5. The multi-gallery is opt-in — the operator generates it only when they want to present multiple dimensions.

---

## 12. Sprint Summary

| Sprint | Goal | Depends On | Key Deliverables |
|---|---|---|---|
| 1 | Schema + Backend Foundation | — | Migrations 178/179, BusinessProspectService, triage multi-archetype, sibling + cycle routes |
| 2 | Multi-Diagnostic Gallery | S1 | Multi-gallery token, public API, frontend page, outreach integration |
| 3 | Frontend + Portal + Tests | S1, S2 | Triage card alternatives, siblings tab, cycle button, portal grouping, full test suite |

**Parallelism:** Sprint 2's backend work (multi-gallery API) can start as soon as Sprint 1's schema is landed. Sprint 3's frontend work depends on both S1 and S2 APIs.

**Critical path:** S1 → S2 → S3 (3 sprints on the critical path).

---

## 13. Open Questions for Review

1. **Multi-gallery expiry:** Should the multi-gallery token have the same 72h default as individual gallery tokens, or a longer window (e.g., 7 days) since it represents a broader engagement?

2. **Cross-sibling analytics:** Should the dashboard analytics (`getDashboardAnalytics`) add a "prospect-level" view that aggregates engagement across siblings, or keep analytics per-campaign?

3. **Retainer scope:** When a sibling reaches `retainer_won`, does the retainer cover only that archetype's ongoing service, or can it be expanded to cover all siblings? (Current model: retainer is per-campaign.)

4. **A5 interaction:** If triage detects a dual-signal (A5) and the operator creates siblings instead, should A5 be offered as an alternative? Or should A5 suppress sibling creation (since it's the combined approach)?
