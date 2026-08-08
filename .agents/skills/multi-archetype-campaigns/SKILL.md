---
name: multi-archetype-campaigns
description: Multi-archetype marketing campaigns, sibling campaigns, business prospect grouping, multi-diagnostic gallery, and sequential engagement cycling. Covers triage alternatives, sibling creation, multi-gallery tokens, completed-work history, and customer portal grouping by business_prospect_id.
category: marketing-ops
risk: medium
source: local-project-patterns
---

# Multi-Archetype Campaigns

## What This Is

A business prospect can have **multiple pain dimensions** (review gap + listing drift + product invisibility). Instead of one campaign per business, the platform creates **sibling campaigns** — one per archetype — that share a `business_prospect_id` and run independent pipelines. The operator triages all matching playbooks, creates siblings for the ones worth pursuing, and can share a **multi-diagnostic gallery** link showing all diagnostic reports in one page.

**Spec:** `docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md`

---

## Core Concepts

### Business Prospect

A `business_prospect_id` groups all sibling campaigns for the same business. The first campaign created for a business is the **primary sibling** (`is_primary_sibling = true`). All subsequent siblings reference the same prospect ID.

- Legacy campaigns (pre-Sprint 1) have `business_prospect_id = null` — they are each treated as their own group.
- `engagement_cycle` tracks sequential re-engagements (1 = first engagement, 2 = after first cycle, etc.).
- Cycling resets a campaign to `seek` stage with `amount_paid_cents = 0` for a fresh outreach round.

### Sibling Campaigns

Each sibling is an independent `mkt_campaigns_list` row with its own:
- `campaign_category` (review_management, recovery_management, profile_repair, triage_management)
- `repair_track` (standard, escalated, null — only for profile_repair)
- `stage` pipeline (runs independently via `transitionsFor(category, repairTrack)`)
- Archetype (A1–A6, resolved via `resolveCampaignArchetype`)

Siblings share business identity fields (business_name, city, contact info, address, etc.) copied from the source campaign at creation time.

### Four Campaign Categories, Three Pipeline Machines

| `campaign_category` | `repair_track` | Pipeline | Stage Machine | How it's assigned |
|---|---|---|---|---|
| `review_management` | — | Review | `REVIEW_TRANSITIONS` | Triage accept of PB-02 |
| `recovery_management` | — | Recovery | `RECOVERY_TRANSITIONS` | Triage accept of PB-04 |
| `triage_management` | — | Review | `REVIEW_TRANSITIONS` | Default before operator accepts triage |
| `profile_repair` | `null` | Review | `REVIEW_TRANSITIONS` | Manual operator creation — track decided later |
| `profile_repair` | `standard` | Review | `REVIEW_TRANSITIONS` | Triage accept of PB-01/PB-03/PB-06/PB-07 |
| `profile_repair` | `escalated` | Recovery | `RECOVERY_TRANSITIONS` | Operator escalation after intake |

---

## Key Files

### Backend Services

| File | Purpose |
|---|---|
| `apps/api/src/services/BusinessProspectService.ts` | Sibling creation, listing, cycling, prospect initialization |
| `apps/api/src/services/triage/TriageEngineService.ts` | `evaluateAllMatchingPlaybooks` — returns all matching playbooks ranked by priority |
| `apps/api/src/services/CampaignTriageService.ts` | `evaluateAllForCampaign` — multi-archetype triage evaluation + `acceptTriage`/`overrideTriage` (sets repair_track for profile_repair) |
| `apps/api/src/services/marketing/GalleryMultiService.ts` | Multi-gallery data assembly from sibling campaigns |
| `apps/api/src/services/marketing/GalleryArchetypeDefaults.ts` | Archetype → gallery title/subtitle/friction summary/CTA label |
| `apps/api/src/services/MarketingCustomerProjection.ts` | `groupCampaignsByProspect` — groups portal campaigns by business_prospect_id |
| `apps/api/src/services/GalleryAnalyticsService.ts` | Event tracking with `siblingCampaignId` for per-sibling attribution |
| `apps/api/src/services/OutreachOpenerService.ts` | `resolveCampaignArchetype` — archetype resolution (triage → fallback) |

### Backend Routes

| File | Route | Purpose |
|---|---|---|
| `apps/api/src/routes/marketing-ops.ts` | `POST /:campaignId/siblings` | Create a sibling campaign |
| `apps/api/src/routes/marketing-ops.ts` | `GET /:campaignId/siblings` | List all siblings for a campaign |
| `apps/api/src/routes/marketing-ops.ts` | `POST /:campaignId/cycle` | Cycle to next engagement |
| `apps/api/src/routes/marketing-ops.ts` | `GET /:campaignId/triage/alternatives` | Get all matching playbooks (multi-archetype suggestions) |
| `apps/api/src/routes/marketing-ops.ts` | `POST /prospects/:prospectId/multi-gallery-token` | Issue multi-gallery token |
| `apps/api/src/routes/marketing-ops-public.ts` | `GET /api/public/marketing/gallery/multi/:token` | Public multi-gallery API |
| `apps/api/src/routes/marketing-ops-public.ts` | `POST /api/public/marketing/gallery/:token/events` | Event tracking with `siblingCampaignId` |

### Frontend

| File | Purpose |
|---|---|
| `apps/web/src/components/marketing-ops/IntelligentTriageCard.tsx` | Triage card with multi-archetype alternatives section + "Create Sibling" buttons |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/SiblingsTab.tsx` | Siblings tab — lists siblings with archetype badges, cycle button |
| `apps/web/src/app/preview/[token]/MultiGalleryPage.tsx` | Multi-gallery page — accordion of sibling sections + "Completed Work" history |
| `apps/web/src/app/preview/[token]/page.tsx` | Routes to MultiGalleryPage when `?prospect=true` |
| `apps/web/src/services/MarketingOpsService.ts` | `getTriageAlternatives`, `createSiblingCampaign`, `listSiblings`, `cycleToNextEngagement`, `generateMultiGalleryToken` |
| `apps/web/src/services/DiagnosticGalleryPublicService.ts` | `getMultiGallery` — public multi-gallery data fetch |
| `apps/web/src/app/account/marketing/page.tsx` | Customer portal — campaigns grouped by business_prospect_id |

### Migrations

| Migration | Purpose |
|---|---|
| `178_mkt_repair_playbook_recategory.sql` | Re-categorizes PB-01/03/06/07 to `profile_repair` + updates `chk_playbook_category` constraint |
| `179_mkt_business_prospect_siblings.sql` | Adds `business_prospect_id`, `engagement_cycle`, `is_primary_sibling` columns + backfill + uniqueness index |
| `180_multi_diagnostic_gallery_tokens.sql` | Adds `metadata` JSONB column for multi-gallery token storage |
| `181_mkt_gallery_events_sibling_campaign.sql` | Adds `sibling_campaign_id` to `mkt_gallery_events` for per-sibling analytics |

### Tests

| File | Tests |
|---|---|
| `apps/api/src/services/triage/__tests__/TriageEngineMultiArchetype.test.ts` | 9 — multi-archetype matching, priority ordering, detectedSignals |
| `apps/api/src/services/__tests__/CampaignTriageRepairCategory.test.ts` | 5 — repair_track for profile_repair on accept/override |
| `apps/api/src/services/__tests__/BusinessProspectService.test.ts` | 11 — sibling creation, listing, cycling, prospect initialization |
| `apps/api/src/services/__tests__/GalleryMultiService.test.ts` | 18 — multi-gallery assembly, completed siblings, eligibility |
| `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` | 30 — status mapping, projection, sibling grouping (6 new) |

---

## Operator Workflow

### 1. Triage with Multi-Archetype Suggestions

When a `seek`-stage campaign has a triage result, the `IntelligentTriageCard` shows:
- The **winner** (highest priority matching playbook) — operator can Accept or Override
- **Alternatives** (other matching playbooks) — each with a "Create Sibling" button

The alternatives come from `evaluateAllMatchingPlaybooks` which returns all playbooks whose matching rules are satisfied by the detected signals, ranked by `priority_rank`.

### 2. Create Sibling Campaigns

Clicking "Create Sibling" on an alternative calls `POST /:campaignId/siblings`:
- Copies business identity fields from the source campaign
- Sets `campaign_category` + `repair_track` from the playbook
- Sets `is_primary_sibling = false`, `engagement_cycle = 1`
- Creates at `seek` stage
- Validates no duplicate (same `business_prospect_id` + `campaign_category` + `repair_track`)

### 3. Siblings Tab

The campaign detail page has a "Siblings" tab showing:
- All sibling campaigns for the same prospect
- Archetype badges (A1–A6) + category badges
- Primary sibling indicator
- Stage badges + engagement cycle numbers
- "Cycle to Next Engagement" button (visible only at `delivered`/`retainer_won` stage)

### 4. Multi-Diagnostic Gallery

When at least 1 sibling has screenshots at `preview_built`/`shown` stage, the operator can issue a multi-gallery token via `POST /prospects/:prospectId/multi-gallery-token`. This creates a `multi_diagnostic_gallery` token with `metadata.business_prospect_id` + `metadata.sibling_campaign_ids`.

The public URL is `/preview/[token]?prospect=true` — the frontend detects the `prospect` query param and renders `MultiGalleryPage` instead of the single `GalleryClient`.

### 5. Multi-Gallery Page Layout

The page shows:
- **Active sibling sections** — accordion with archetype badge, gallery title, friction summary, screenshot carousel, CTA button per sibling. Primary sibling first, then by archetype priority (A2 > A1 > A6 > A3 > A4 > A5).
- **Completed Work section** — collapsed "badge of honor" showing converted siblings (paid/delivered/retainer_won) with their archetype, gallery title, status badge, and paid date. This gives the prospect a sense of journey.
- **Global CTA** — "View Pricing" linking to the pay page.

### 6. Event Tracking with Sibling Attribution

Each event on the multi-gallery page includes `siblingCampaignId` so analytics can attribute engagement to the correct sibling. The `galleryEventSchema` Zod accepts an optional `siblingCampaignId` field, and `GalleryAnalyticsService.trackEvent` persists it as `sibling_campaign_id` on the `mkt_gallery_events` row.

### 7. Sequential Engagement Cycling

When a campaign reaches `delivered` or `retainer_won`, the operator can cycle to the next engagement:
- Increments `engagement_cycle` (1 → 2 → 3 ...)
- Resets `stage` to `seek`
- Resets `amount_paid_cents = 0`, `retainer_status = 'not_pitched'`
- Preserves `business_prospect_id`, `is_primary_sibling`, business identity
- Logs a `cycle_started` stage history entry

This enables re-engaging the same business for a new round of services after the previous engagement is delivered.

---

## Customer Portal Grouping

The customer portal overview (`/account/marketing`) groups campaigns by `business_prospect_id`:
- Sibling campaigns sharing a prospect ID are shown under a group header with the business name + sibling count
- Each campaign shows its cycle number when in a multi-sibling group
- Legacy campaigns (null prospect ID) are each their own group
- Groups are sorted by most recent activity (datePaid desc)
- Within each group, primary sibling is first, then by datePaid desc

The grouping is done by `groupCampaignsByProspect` in `MarketingCustomerProjection.ts` and returned as `campaignGroups` in the `CustomerPortalOverview` DTO.

---

## Archetype Priority Ordering

For multi-gallery display, siblings are ordered by archetype priority:

| Priority | Archetype | Signal Domain | Triage Category |
|---|---|---|---|
| 1 | A2 | BBB crisis (RA) | recovery_management |
| 2 | A1 | Review gap (RA) | review_management |
| 3 | A6 | Product invisibility (VP) | profile_repair |
| 4 | A3 | Listing drift (DS) | profile_repair |
| 5 | A4 | CTA gap (WC) | profile_repair |
| 6 | A5 | Multi-signal (dual) | triage_management / profile_repair |

Primary sibling always sorts first regardless of archetype priority.

---

## What Does NOT Change

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

## API Quick Reference

### Admin (auth required, `/api/admin/marketing-ops`)

```
GET  /:campaignId/triage/alternatives     → { winner, alternatives: TriageRecommendation[] }
POST /:campaignId/siblings                → CampaignDetail (new sibling)
GET  /:campaignId/siblings                → SiblingSummary[]
POST /:campaignId/cycle                   → CampaignDetail (cycled)
POST /prospects/:prospectId/multi-gallery-token → PreviewToken
```

### Public (no auth, token-gated, `/api/public/marketing`)

```
GET  /gallery/multi/:token                → MultiGalleryData (siblings + completedSiblings)
POST /gallery/:token/events               → { success, tracked } (with siblingCampaignId)
POST /gallery/:token/events/batch         → { success, tracked } (batch with siblingCampaignId)
```
