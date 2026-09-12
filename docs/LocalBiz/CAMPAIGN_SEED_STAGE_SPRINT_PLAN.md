# Campaign "Seed" Stage — Sprint Plan

> Insert a new `seed` stage between `seek` and `preview_built` in the review-track
> campaign pipeline, formalizing the seed-first wedge (create place listing →
> QC → publish → mint claim token → invite owner to claim) as a first-class
> pipeline stage rather than a cluster of permanent checklist steps parked on
> `seek`.

**Pipeline (after this sprint):**

```
queue → seek → seed → preview_built → shown → paid → delivered → retainer_pitched → retainer_won → tenant_onboarded
                 ↘ dead                                        ↘ lost / dead
```

- `seek` — discovery & audit: identify category, set categories, run business audit, verify operational status.
- `seed` — the good-faith wedge: create the place listing seed, QC, publish, mint the claim token, invite the owner to claim (free, no obligation).
- `preview_built` — the paid pitch: triage review, pitch construction, preview deliverable / approach kit, call script.

---

## 1. Motivation

The seed-first wedge (migration 276) added 9 permanent checklist steps to every
business-scope campaign, all tagged `stageTag: 'seek'`. The wedge is a distinct
phase of work — seeding a directory listing and inviting the owner to claim it —
but it currently shares the `seek` stage with discovery/audit work. Operators
cannot tell from the pipeline bar whether a campaign has been seeded, and the
checklist soft-gate cannot distinguish "audit done" from "seed published."

Promoting the wedge to its own stage:

- Makes seed completion visible on the pipeline bar and in stage counts / dashboards.
- Lets the checklist soft-gate warn on `seek → seed` (audit incomplete) and
  `seed → preview_built` (seed not published / claim not invited) independently.
- Gives the customer-facing projection a natural cut point (seed work is
  pre-sale and must remain hidden; the stage name itself never reaches the
  customer because `seed` is added to the hidden-stages set).

---

## 2. Scope

### In scope
- New `seed` stage in the review-track transition machine.
- `date_seed` timestamp column on `mkt_campaigns_list`.
- Re-tag the 5 seed-wedge permanent checklist steps from `seek` → `seed`.
- Re-tag the 3 outreach-access permanent steps from `seek` → `preview_built`.
- Stage window expansion so permanent steps render in `seek`, `seed`, and `preview_built`.
- Frontend pipeline bar, kanban columns, stage badges, stage filters, prompt-type map.
- Track-switch remap tables (review ↔ recovery) for the new stage.
- Cycle-engagement reset target options.
- Customer projection hidden-stages set.
- Dashboard active-stages list.
- Tests.

### Out of scope
- Recovery-track pipeline (unchanged — `seed` is review-track only).
- Non-business-scope campaigns (category/city/intelligence never enter the sales pipeline).
- Changing the default stage for new campaigns (stays `seek`).
- Auto-advancing `seek → seed` (graduation remains operator-initiated; a future
  sprint may add auto-advance when the audit completes).

---

## 3. Database (Migration 280)

**File:** `database/migrations/280_campaign_seed_stage.sql`

The `mkt_campaigns_list.stage` column is `VARCHAR(50)` with `DEFAULT 'seek'` and
**no CHECK constraint** (verified — no `chk_*stage*` constraints exist on the
table). Adding the `seed` literal requires **no constraint migration**, only an
additive timestamp column.

```sql
-- Migration 280: Campaign "seed" stage (review track)
-- Adds the date_seed timestamp column. The stage column is VARCHAR(50) with
-- no CHECK constraint, so the 'seed' literal needs no constraint change.

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS date_seed TIMESTAMPTZ(6);
```

**Apply** (both environments):
```powershell
doppler run --config local -- pnpm prisma db pull
pnpm prisma generate
# Then apply the migration SQL against both configs:
doppler run --config local -- psql $DATABASE_URL -f database/migrations/280_campaign_seed_stage.sql
doppler run --config prd    -- psql $DATABASE_URL -f database/migrations/280_campaign_seed_stage.sql
```

After `prisma db pull`, `schema.prisma` gains `date_seed` on `mkt_campaigns_list`.
Run `pnpm prisma generate` to regenerate the client.

---

## 4. Backend Changes

### 4.1 `apps/api/src/services/MarketingCampaignService.ts`

#### 4.1.1 `CampaignStage` type (line ~58)
Add `'seed'` to the union, positioned between `'seek'` and `'preview_built'`:

```ts
export type CampaignStage =
  | 'seek'
  | 'seed'
  | 'preview_built'
  | 'shown'
  | 'paid'
  | 'delivered'
  | 'retainer_pitched'
  | 'retainer_won'
  | 'lost'
  | 'dead'
  | 'tenant_onboarded';
```

#### 4.1.2 `REVIEW_TRANSITIONS` map (line ~102)
Split `seek → preview_built` into `seek → seed` and `seed → preview_built`:

```ts
const REVIEW_TRANSITIONS: Record<string, string[]> = {
  seek:           ['seed', 'dead'],          // was ['preview_built', 'dead']
  seed:           ['preview_built', 'dead'], // NEW
  preview_built:  ['shown', 'dead'],
  shown:          ['paid', 'lost', 'dead', 'tenant_onboarded'],
  paid:           ['delivered', 'tenant_onboarded', 'gbp_intake_submitted', 'review_setup_submitted'],
  delivered:      ['retainer_pitched', 'closed', 'tenant_onboarded', 'gbp_intake_submitted', 'review_setup_submitted'],
  gbp_intake_submitted:    ['delivered', 'tenant_onboarded'],
  review_setup_submitted:  ['delivered', 'tenant_onboarded'],
  retainer_pitched: ['retainer_won', 'closed'],
  retainer_won:   ['lost', 'tenant_onboarded'],
  lost:           ['seek', 'tenant_onboarded'],
  dead:           ['seek', 'tenant_onboarded'],
};
```

> **Resurrection note:** `lost`/`dead` resurrect to `seek` (not `seed`) — a
> re-engaged prospect restarts discovery. This is unchanged.

#### 4.1.3 `STAGE_DATE_FIELDS` map (line ~232)
Add the `seed` entry:

```ts
const STAGE_DATE_FIELDS: Record<string, string> = {
  seed:            'date_seed',   // NEW
  preview_built:   'date_preview_built',
  shown:           'date_shown',
  paid:            'date_paid',
  delivered:       'date_delivered',
  retainer_pitched:'date_retainer_pitched',
  retainer_won:    'date_retainer_won',
  tenant_onboarded:'date_tenant_onboarded',
};
```

#### 4.1.4 GBP enrichment trigger (line ~2004)
The best-effort GBP enrichment currently fires on `seek → preview_built`. With
the new stage it should fire on `seek → seed` (the audit-informed enrichment
should land before seeding, not after):

```ts
// Best-effort GBP enrichment on seek → seed when no phone AND no website_url.
if (fromStage === 'seek' && toStage === 'seed' && !campaign.phone && !campaign.website_url) {
  // ... unchanged body ...
}
```

#### 4.1.5 Track-switch remap tables (line ~2209)
Add `seed` to both remap tables so profile_repair track switches work from the
new stage:

```ts
private static readonly TRACK_REMAP_REVIEW_TO_RECOVERY: Record<string, string | null> = {
  seek: 'audit_identified',
  seed: 'audit_identified',           // NEW — maps to the same recovery entry as seek
  preview_built: 'framework_preview_generated',
  shown: 'outreach_dispatched',
};

private static readonly TRACK_REMAP_RECOVERY_TO_REVIEW: Record<string, string | null> = {
  audit_identified: 'seek',           // unchanged — recovery → seek, not seed
  framework_preview_generated: 'preview_built',
  outreach_dispatched: 'shown',
  awaiting_owner_intake: 'shown',
};
```

> `seed` maps to `audit_identified` on escalation (the seed work is
> review-track-only; a recovery campaign has no place listing). The reverse
> maps `audit_identified → seek` (not `seed`) so a de-escalated campaign
> restarts discovery.

#### 4.1.6 Dashboard active-stages list (line ~2460)
Add `seed` so seeded campaigns count as active:

```ts
const activeStages = ['seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched'];
```

### 4.2 `apps/api/src/services/PlaybookChecklistService.ts`

#### 4.2.1 `CHECKLIST_STAGE_TAGS` (line ~60)
Add `'seed'` between `'seek'` and `'preview_built'`:

```ts
export const CHECKLIST_STAGE_TAGS = [
  'seek',
  'seed',           // NEW
  'preview_built',
  'shown',
  'paid',
  'delivered',
  'retainer_pitched',
  'retainer_won',
  'lost',
  'dead',
  'tenant_onboarded',
] as const;
```

#### 4.2.2 `STAGE_PIPELINE_ORDER` (line ~80)
Insert `seed` at order 1, bumping the rest:

```ts
const STAGE_PIPELINE_ORDER: Record<string, number> = {
  seek: 0,
  seed: 1,            // NEW
  preview_built: 2,
  shown: 3,
  paid: 4,
  delivered: 5,
  retainer_pitched: 6,
  retainer_won: 7,
  lost: 8,
  dead: 9,
  tenant_onboarded: 10,
};
```

#### 4.2.3 Re-tag `PERMANENT_SEED_STEPS` (line ~155)
The 9 seed-first wedge steps are currently all `stageTag: 'seek'`. Split them:

- **Steps 1–4** (identify category, set categories, business audit, verify
  operational) stay `stageTag: 'seek'` — they are discovery/audit work.
- **Steps 5–9** (create seed, QC, publish, mint claim token, invite owner to
  claim) become `stageTag: 'seed'` — they are the seed-stage wedge.

```ts
// Step 1: identifyCategory      → stageTag: 'seek'   (unchanged)
// Step 2: setCategories         → stageTag: 'seek'   (unchanged)
// Step 3: auditBusiness         → stageTag: 'seek'   (unchanged)
// Step 4: verifyOperational     → stageTag: 'seek'   (unchanged)
// Step 5: seedPlaceListing      → stageTag: 'seed'   (was 'seek')
// Step 6: qcSeed                → stageTag: 'seed'   (was 'seek')
// Step 7: publishSeed           → stageTag: 'seed'   (was 'seek')
// Step 8: mintClaimToken        → stageTag: 'seed'   (was 'seek')
// Step 9: pitchFreeClaim         → stageTag: 'seed'   (was 'seek')
```

#### 4.2.4 Re-tag `PERMANENT_STEPS` (outreach-access, line ~293)
The 3 outreach-access steps (pitch construction, preview deliverable, call
script) are currently `stageTag: 'seek'`. They represent the paid pitch, which
lands at `preview_built`. Re-tag them:

```ts
// pitchConstruction   → stageTag: 'preview_built'  (was 'seek')
// previewDeliverable  → stageTag: 'preview_built'  (was 'seek')
// callScript          → stageTag: 'preview_built'  (was 'seek')
```

#### 4.2.5 `PERMANENT_STEP_STAGES` window (line ~339)
Expand so permanent steps render in `seek`, `seed`, **and** `preview_built`:

```ts
const PERMANENT_STEP_STAGES = new Set(['seek', 'seed', 'preview_built']);
```

> The seed-wedge steps (tagged `seed`) and outreach-access steps (tagged
> `preview_built`) remain visible across all three early stages — the checklist
> is a running list, not a per-stage replacement. The `stageTag` only governs
> the soft-gate ordering (which required steps gate which transition).

### 4.3 `apps/api/src/routes/marketing-ops.ts`

#### 4.3.1 `campaignUpdateSchema` stage enum (line ~329)
Add `'seed'`:

```ts
stage: z.enum(['seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded']).optional(),
```

#### 4.3.2 `stageTransitionSchema` `to_stage` enum (line ~352)
Add `'seed'`:

```ts
to_stage: z.enum(['seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded']),
```

#### 4.3.3 `checklistStageTagEnum` (line ~853)
Add `'seed'`:

```ts
const checklistStageTagEnum = z.enum([
  'seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered',
  'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded',
]);
```

#### 4.3.4 `cycleEngagementSchema` reset target (line ~940)
Add `'seed'` as a valid reset target so a cycled engagement can restart from
the seed stage (re-seed without re-running discovery):

```ts
reset_to_stage: z.enum(['seek', 'seed', 'preview_built']).optional(),
```

### 4.4 `apps/api/src/services/BusinessProspectService.ts`

#### 4.4.1 `CycleInput.resetToStage` (line ~45)
Widen the type:

```ts
resetToStage?: 'seek' | 'seed' | 'preview_built';
```

#### 4.4.2 Cycle reset date-field clearing (line ~474)
Add `date_seed` to the reset block so a cycle reset clears the seed timestamp:

```ts
date_seed: targetStage === 'seed' ? campaign.date_seed : null,
date_preview_built: targetStage === 'preview_built' ? campaign.date_preview_built : null,
```

### 4.5 `apps/api/src/services/MarketingCustomerProjection.ts`

#### 4.5.1 Hidden-stages set (line ~45)
Add `'seed'` — seed work is pre-sale and must never surface to the customer:

```ts
const hiddenStages = ['seek', 'seed', 'preview_built', 'shown', 'lost', 'dead'];
```

### 4.6 `apps/api/src/services/marketing/PostalMailerService.ts`

#### 4.6.1 Allowed stages (line ~81)
Add `'seed'` so the claim-mail postcard can be sent during the seed stage
(the claim token is minted in seed):

```ts
const allowedStages = ['seek', 'seed', 'preview_built'];
```

---

## 5. Frontend Changes

### 5.1 `apps/web/src/services/MarketingOpsService.ts`

#### 5.1.1 `CampaignStage` type (line ~19)
Add `'seed'`:

```ts
export type CampaignStage =
  | 'seek'
  | 'seed'
  | 'preview_built'
  | 'shown'
  | 'paid'
  | 'delivered'
  | 'retainer_pitched'
  | 'retainer_won'
  | 'lost'
  | 'dead'
  | 'tenant_onboarded';
```

#### 5.1.2 `Campaign` interface (line ~164)
Add the `date_seed` field alongside `date_preview_built`:

```ts
date_seed: string | null;
date_preview_built: string | null;
```

#### 5.1.3 `CHECKLIST_STAGE_TAGS` + `CHECKLIST_STAGE_TAG_LABELS` (line ~6025)
Add `'seed'` and its label:

```ts
export const CHECKLIST_STAGE_TAGS = [
  'seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered',
  'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded',
];

export const CHECKLIST_STAGE_TAG_LABELS: Record<ChecklistStageTag, string> = {
  seek: 'Seek',
  seed: 'Seed',
  preview_built: 'Preview Built',
  // ... rest unchanged
};
```

### 5.2 `apps/web/src/components/marketing-ops/StageBadge.tsx`

#### 5.2.1 `STAGE_LABELS` (line ~5)
Add the `seed` label:

```ts
seed: 'Seed',
```

#### 5.2.2 `STAGE_COLORS` (line ~28)
Add a distinct color for `seed` (violet, to differentiate from seek's blue and
preview_built's indigo):

```ts
seed: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
```

### 5.3 `apps/web/src/components/marketing-ops/prospectQueueStageMaps.ts`

#### 5.3.1 `REVIEW_TRANSITIONS` (line ~11)
Add `seed` transitions:

```ts
export const REVIEW_TRANSITIONS: Record<string, string[]> = {
  seek:             ['seed', 'dead'],            // was ['preview_built', 'dead']
  seed:             ['preview_built', 'dead'],   // NEW
  preview_built:    ['shown', 'dead'],
  shown:            ['paid', 'lost', 'tenant_onboarded'],
  paid:             ['delivered', 'tenant_onboarded'],
  delivered:        ['retainer_pitched', 'closed', 'tenant_onboarded'],
  retainer_pitched: ['retainer_won', 'closed'],
  retainer_won:     ['lost', 'tenant_onboarded'],
  lost:             ['seek', 'tenant_onboarded'],
  dead:             ['seek', 'tenant_onboarded'],
};
```

#### 5.3.2 `REVIEW_COLUMNS` (line ~36)
Insert `seed` between `seek` and `preview_built`:

```ts
export const REVIEW_COLUMNS = [
  'seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered',
  'retainer_pitched', 'retainer_won', 'tenant_onboarded',
] as const;
```

### 5.4 `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx`

#### 5.4.1 `PIPELINE_STAGES` (line ~13)
Insert `'seed'`:

```ts
const PIPELINE_STAGES: CampaignStage[] = ['seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];
```

### 5.5 `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`

#### 5.5.1 `PIPELINE_STAGES` (line ~51)
Insert `'seed'`:

```ts
const PIPELINE_STAGES: CampaignStage[] = ['seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];
```

#### 5.5.2 `STAGE_PROMPT_TYPES` (line ~67)
Add the `seed` entry — seed-stage campaigns run the same seek/audit prompts
(the business audit feeds the seed's SEO packet):

```ts
const STAGE_PROMPT_TYPES: Record<CampaignStage, PromptType[]> = {
  seek: ['seek', 'category_analysis', 'city_analysis', 'filter'],
  seed: ['seek', 'category_analysis', 'city_analysis', 'filter'],   // NEW
  preview_built: ['seek', 'category_analysis', 'city_analysis', 'filter'],
  shown: ['seek', 'category_analysis', 'city_analysis', 'filter'],
  paid: ['fulfill', 'filter'],
  delivered: ['fulfill', 'filter'],
  retainer_pitched: ['retainer', 'filter'],
  retainer_won: ['retainer', 'filter'],
  lost: [],
  dead: [],
  tenant_onboarded: [],
};
```

#### 5.5.3 Stage-gated UI sections
Audit every `campaign.stage` check that references `seek` or `preview_built`
and decide whether `seed` should be included:

| Location (line) | Current condition | New condition | Rationale |
|---|---|---|---|
| Intelligent Triage Card (~1126) | `stage === 'seek'` | `stage === 'seek'` (unchanged) | Triage runs in seek, before seeding. |
| Outreach & Follow-Up Card (~1293) | `['preview_built','shown','paid'].includes(stage)` | `['preview_built','shown','paid'].includes(stage)` (unchanged) | Outreach logging starts at the paid pitch, not the seed wedge. |
| Deliverable Construction link (~1306) | `['paid','delivered'].includes(stage)` | unchanged | Post-payment only. |
| Contact-readiness warning dot (~1065) | `stage === 'preview_built'` on `seek` | add `seed` to the readiness check | The readiness dot should also show on `seed` (the seed stage benefits from contact data too). See §5.5.4. |

#### 5.5.4 Contact-readiness warning dot (line ~1065)
The readiness dot currently shows on `preview_built` when `campaign.stage === 'seek'`.
Extend to also show when `campaign.stage === 'seed'` (the operator is about to
graduate to preview_built and should see the same warning):

```ts
const showReadinessDot = stage === 'preview_built'
  && (campaign.stage === 'seek' || campaign.stage === 'seed')
  && contactReadiness != null
  && !contactReadiness.complete;
```

### 5.6 Other frontend stage references (audit + update)

Grep the web app for `'preview_built'` and `'seek'` stage literals and add
`'seed'` where a "seek-or-preview_built" intent exists. Known spots:

- `apps/web/src/app/(platform)/settings/admin/marketing-ops/MarketingOpsDashboardClient.tsx` — stage count buckets; add `seed` to the review-pipeline stage list if it enumerates stages.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/scorecards/ScorecardClient.tsx` — stage filter options; add `seed`.
- `apps/web/src/components/marketing-ops/ReviewResponsePipelineCard.tsx` — stage-gated rendering; audit.
- `apps/web/src/components/marketing-ops/ProspectQueueBoard.tsx` — kanban column order; add `seed` column.

> **Action item:** run `grep -rn "preview_built" apps/web/src` after the core
> edits and classify every hit as (a) needs `seed` added, or (b) intentionally
> preview_built-only.

---

## 6. Seed-First Wedge Step Reassignment Summary

| # | Step | Current `stageTag` | New `stageTag` | Stage |
|---|---|---|---|---|
| 1 | Run category identification | `seek` | `seek` | seek |
| 2 | Set primary and secondary categories | `seek` | `seek` | seek |
| 3 | Run the business audit | `seek` | `seek` | seek |
| 4 | Call to verify operational status | `seek` | `seek` | seek |
| 5 | Create the seed ("Add to Place Listing") | `seek` | **`seed`** | seed |
| 6 | QC the seeded listing | `seek` | **`seed`** | seed |
| 7 | Publish the listing | `seek` | **`seed`** | seed |
| 8 | Mint the claim token | `seek` | **`seed`** | seed |
| 9 | Invite the owner to claim | `seek` | **`seed`** | seed |
| — | Open Pitch Construction | `seek` | **`preview_built`** | preview_built |
| — | Open Preview Deliverable / Approach Kit | `seek` | **`preview_built`** | preview_built |
| — | Open Call Script | `seek` | **`preview_built`** | preview_built |

> These are code-defined steps (synthetic `_permanent_*` IDs), so re-tagging is
> a code change — no DB seed re-run is needed for the permanent steps. DB
> playbook template steps that were tagged `preview_built` by migration 276
> ("Review triage signals") are unaffected.

---

## 7. Existing Campaign Backfill

Campaigns currently in `preview_built` or later **do not** need backfill — they
already passed through the (then-implicit) seed phase. Campaigns in `seek` stay
in `seek`; they will graduate to `seed` on the next operator transition.

**No data migration** is required beyond the additive `date_seed` column. The
`stage` column is VARCHAR and accepts the new literal without a constraint
change.

> Optional (not required): if you want historical `seek` campaigns that
> already have a spawned seed to be reflected as `seed` stage, a one-off
> backfill could set `stage = 'seed'` + `date_seed = now()` for `seek`-stage
> business-scope campaigns that have a row in `directory_presence_seeds` with
> `source_campaign_id = campaign.id`. This is **not** included in the sprint —
> it's a judgment call for the operator after deploy.

---

## 8. Tests

### 8.1 Backend unit tests

**File:** `apps/api/src/services/__tests__/marketingCampaign.recovery.test.ts`
(update the existing `transitionsFor` snapshot)

- `transitionsFor('review_management')` snapshot: add `seed: ['preview_built', 'dead']` and change `seek: ['seed', 'dead']`.
- `isValidTransition`: add `seek → seed` (true), `seed → preview_built` (true), `seek → preview_built` (now **false** — must go through seed), `seed → shown` (false).

**New test file:** `apps/api/src/services/__tests__/campaignSeedStage.test.ts`

- `STAGE_DATE_FIELDS` includes `seed: 'date_seed'`.
- `transitionStage` sets `date_seed` on `seek → seed`.
- `transitionStage` does NOT set `date_seed` on `seed → preview_built` (only `date_preview_built`).
- GBP enrichment fires on `seek → seed` (not `seek → preview_built`).
- Track switch: `seed` → recovery maps to `audit_identified`; reverse maps `audit_identified → seek`.
- Dashboard `activeStages` includes `seed`.

### 8.2 Checklist tests

**File:** `apps/api/src/services/__tests__/PlaybookChecklistService.test.ts`

- `CHECKLIST_STAGE_TAGS` includes `'seed'`.
- `STAGE_PIPELINE_ORDER['seed']` === 1, `STAGE_PIPELINE_ORDER['preview_built']` === 2.
- Seed-wedge steps 5–9 have `stageTag: 'seed'`; steps 1–4 have `stageTag: 'seek'`.
- Outreach-access steps have `stageTag: 'preview_built'`.
- `PERMANENT_STEP_STAGES` includes `seek`, `seed`, `preview_built`.
- `getCampaignChecklist` for a `seed`-stage business-scope campaign renders the seed-wedge steps.

### 8.3 Customer projection tests

**File:** `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts`

- `mapCustomerStatus('seed')` returns `null` (hidden).

### 8.4 Route tests

**File:** `apps/api/src/tests/marketing-customer-routes.test.ts` (no change —
portal routes are stage-agnostic) and the marketing-ops route tests (if a
transition test exists, add `seek → seed`).

### 8.5 Frontend

No automated tests required for the stage label/color/column changes. Manual
verification via the browser preview (see §9).

---

## 9. Verification

```powershell
# 1. Apply migration + regenerate client
doppler run --config local -- pnpm prisma db pull
pnpm prisma generate
doppler run --config local -- psql $DATABASE_URL -f database/migrations/280_campaign_seed_stage.sql

# 2. Typecheck
pnpm checkapi
pnpm checkweb

# 3. Run tests
cd apps/api && pnpm test -- marketingCampaign.recovery
cd apps/api && pnpm test -- campaignSeedStage
cd apps/api && pnpm test -- PlaybookChecklistService
cd apps/api && pnpm test -- MarketingCustomerProjection
```

**Manual verification (browser preview):**

1. Open a `seek`-stage business-scope campaign.
2. Pipeline bar shows: `Seek → Seed → Preview Built → Shown → …`.
3. Click `Seed` — campaign transitions to `seed`; `date_seed` is set.
4. Checklist tab shows seed-wedge steps 5–9 tagged "Seed"; steps 1–4 tagged "Seek".
5. Click `Preview Built` from `seed` — transitions to `preview_built`; `date_preview_built` set.
6. Outreach-access steps (Pitch Construction, etc.) now tagged "Preview Built".
7. Kanban board (campaigns page) shows a `Seed` column between `Seek` and `Preview Built`.
8. Stage badge for a `seed`-stage campaign renders "Seed" in violet.
9. Customer portal: a `seed`-stage campaign does NOT appear in the customer's campaign list (hidden stage).

---

## 10. Risks & Edge Cases

1. **Direct `seek → preview_built` transition breaks.** Any code or operator
   habit that jumps straight from `seek` to `preview_built` will now fail the
   transition validator. The frontend pipeline bar only offers valid transitions,
   so the UI is safe; any API caller doing `seek → preview_built` directly
   must update to `seek → seed → preview_built`. **Mitigation:** grep for
   `to_stage: 'preview_built'` callers and confirm none originate from `seek`.

2. **Cycle engagement reset.** `BusinessProspectService.cycleEngagement` can
   now reset to `seed`. Confirm the date-field clearing block handles `seed`
   (clears `date_preview_built`+ when resetting to `seed`, preserves `date_seed`
   only when resetting to `seed`).

3. **Triage card stage gate.** The Intelligent Triage Card renders only when
   `stage === 'seek'`. After seeding (stage `seed`), triage is no longer
   surfaced — which is correct (triage precedes seeding). But if an operator
   wants to re-triage after seeding, they must resurrect to `seek` first. This
   is the intended behavior; document it in the user guide.

4. **Recovery track unaffected.** `seed` is review-track only. The recovery
   transition map and recovery stage schema are unchanged. A `profile_repair +
   escalated` campaign never enters `seed`.

5. **`proving_ground` campaigns.** These stay at `seek` and never transition
   (spec §2.1). Adding `seed` to the review transition map does not affect them
   because they never call `transitionStage`.

---

## 11. File Checklist

### Backend
- [ ] `database/migrations/280_campaign_seed_stage.sql` — new
- [ ] `apps/api/src/services/MarketingCampaignService.ts` — type, transitions, date fields, GBP trigger, track remap, dashboard
- [ ] `apps/api/src/services/PlaybookChecklistService.ts` — stage tags, pipeline order, step re-tags, stage window
- [ ] `apps/api/src/routes/marketing-ops.ts` — 3 zod enums + cycle reset
- [ ] `apps/api/src/services/BusinessProspectService.ts` — cycle reset type + date clearing
- [ ] `apps/api/src/services/MarketingCustomerProjection.ts` — hidden stages
- [ ] `apps/api/src/services/marketing/PostalMailerService.ts` — allowed stages
- [ ] `apps/api/prisma/schema.prisma` — regenerated via `prisma db pull` (do NOT hand-edit)

### Backend tests
- [ ] `apps/api/src/services/__tests__/marketingCampaign.recovery.test.ts` — update snapshot
- [ ] `apps/api/src/services/__tests__/campaignSeedStage.test.ts` — new
- [ ] `apps/api/src/services/__tests__/PlaybookChecklistService.test.ts` — update
- [ ] `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` — add seed to hidden

### Frontend
- [ ] `apps/web/src/services/MarketingOpsService.ts` — type, Campaign field, checklist tags + labels
- [ ] `apps/web/src/components/marketing-ops/StageBadge.tsx` — label + color
- [ ] `apps/web/src/components/marketing-ops/prospectQueueStageMaps.ts` — transitions + columns
- [ ] `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx` — pipeline stages
- [ ] `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — pipeline stages, prompt types, readiness dot
- [ ] Audit remaining `preview_built` / `seek` stage literals in `apps/web/src` (§5.6)

### Docs
- [ ] `AGENTS.md` — append the new stage to the campaign stage flow note (if a stage list exists)
- [ ] `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md` — add `seed` to the stage flow description
