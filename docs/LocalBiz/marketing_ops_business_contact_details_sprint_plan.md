# Sprint Plan: Marketing Ops — Business Campaign Contact Details, Outreach Tracking & Hot-Prospect Follow-Up

**Document Version:** 1.4
**Date:** 2026-07-30
**Status:** Draft — Ready for Review
**Prerequisite:** Marketing Ops Sprint 1–4 complete (campaign pipeline, prompt workspace, deliverables, branding); Tenant Prospecting Channel sprint schema landed (`gbp_lookup_cache`, `gbp_lookup_cached_at` columns exist but are unpopulated)

This plan contains **three sprints**:
- **Sprint 1 (Part I, §§1–11):** Business Campaign Contact Details — make the campaign the source of truth for prospect contactability (phone / email / website / social), populated via GBP enrichment and manual intake, rendered in the Overview.
- **Sprint 2 (Part II, §§12–22):** Outreach Tracking & Follow-Up Visibility — track each point of contact during `preview_built` and `shown` with a **message + fresh-data snapshot per contact** so historical contacts are reviewable in Ops; schedule follow-ups; surface overdue follow-ups at a glance.
- **Sprint 3 (Part III, §§23–33):** Hot-Prospect Auto-Follow-Up + City Pain Scan Sync — when recent contacts produce no response, automatically schedule the next follow-up *only* for businesses flagged as hot prospects from recent City Pain Scan analysis. Sprint 3 also closes the loop between City Pain Scan executions and the campaign record: the multi-business audit JSON (up to 15 businesses across 5+ categories, with GBP status, website, NAP, pain score, priority, tier, fee estimate) is parsed and synced onto matched campaigns as `city_analysis` audits, so the campaign is the single source of truth and Sprint 2's `buildFreshSnapshot` has real data to work with. The `top_prospects` array from the scan is the primary hot-prospect signal.

Sprint 2 depends on Sprint 1 (outreach logging references the contact channels populated by Sprint 1). Sprint 3 depends on Sprint 2 (auto-scheduling writes into the same outreach log + `next_follow_up_at` rollup) and on scope scan analysis being run (existing `category_analysis` / `city_analysis` prompt types).

---

# Part I — Sprint 1: Business Campaign Contact Details

## 1. Executive Summary

Today a **business-scope** Marketing Ops campaign returns audits and a single `contact_method` / `contact_info` pair. It does **not** return the prospect's full contact surface — phone, email, website URL, social profiles. Operators must hunt for these separately when they reach the `preview_built` and `shown` stages, where the right outreach channel (Text / Email / Contact Form / DM) is decisive.

This sprint closes that gap by making the campaign record the **single source of truth** for prospect contactability, populated automatically where possible (GBP Places lookup) and manually where not (social profiles), and rendered as a dedicated **Business Contact** card in the campaign Overview — ready before any stage transition past `seek`.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Structured contact fields** | Dedicated `phone`, `email`, `website_url`, `social_profiles` on `mkt_campaigns_list` — replacing the single opaque `contact_method`/`contact_info` pair as the canonical contact surface |
| **GBP-driven auto-population** | Implement the planned-but-unbuilt `MarketingGbpEnhancerService` to call Google Places API and populate `phone` + `website_url` (and cache the full payload in the existing `gbp_lookup_cache`) |
| **Manual capture at intake** | Extend the campaign form to collect all four channels at create/edit, with the existing `contact_method`/`contact_info` pair retained as a deprecated fallback |
| **Overview Business Contact card** | New UI block in the Overview tab showing each channel with its outreach affordance (Text / Email / Open Contact Form / Open DM) — visible before `preview_built` |
| **Stage-gate readiness check** | Soft guard that surfaces a "Contact incomplete" warning when transitioning `seek → preview_built` without at least one verified channel |

### Why now

The `preview_built` and `shown` stages are where the operator actually contacts the prospect. Without reliable contact data on the campaign record, every operator re-derives it ad hoc — GBP tabs, website scraping, social search — and the data is lost on the next campaign for the same business. The schema already has `gbp_lookup_cache` (landed in the Tenant Prospecting Channel sprint) but no service populates it. This sprint activates that dormant column and adds the missing structured fields.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer, 0.5 UX/UI designer

---

## 2. Gap Analysis — Current State

### What a business campaign returns today

The `CampaignDetail` payload (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\services\MarketingOpsService.ts" />) includes:

- **Audits** (`audits[]`) — review counts, average rating, unaddressed reviews, GBP claimed, `has_booking`, `has_contact_form`, `mobile_friendly`. **No contact details.** Schema: <ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\prisma\schema.prisma" /> lines 6049–6070.
- **A single contact pair** — `contact_method` (VarChar 50) + `contact_info` (VarChar 255). One method, one value. Schema lines 6095–6096.
- **`has_website`** — a yes/no/none *flag*, NOT the actual website URL. Schema line 6100.

### What the Overview tab shows

<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\app\(platform)\settings\admin\marketing-ops\campaigns\[id]\CampaignDetailClient.tsx" /> lines 327–346 render only `Contact Method`, `Contact Info`, and `Has Website` (the flag). No phone, no email, no website URL, no social profile.

### The dormant infrastructure

`mkt_campaigns_list` already has `gbp_lookup_cache` (Json) + `gbp_lookup_cached_at` (schema lines 6130–6131), landed by the Tenant Prospecting Channel sprint. The sprint plan for that sprint (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\docs\LocalBiz\tenant_prospecting_channel_sprint_plan.md" /> §Task 5B.2) specifies a `MarketingGbpEnhancerService` that would call the Google Places API and cache the result — Places returns **phone, website, and address**.

**But:** `MarketingGbpEnhancerService.ts` does not exist. No file populates `gbp_lookup_cache`. The column is dead today. The sprint plan also does not mention social profiles at all — Places does not return them reliably.

### Gap summary

| # | Gap | Impact |
|---|-----|--------|
| C1 | No dedicated `phone` / `email` / `website_url` / `social_profiles` columns | Operators have nowhere canonical to store or read full contact surface |
| C2 | `gbp_lookup_cache` is unpopulated — `MarketingGbpEnhancerService` never built | Free phone + website data from Places API is not collected |
| C3 | `has_website` is a flag, not the URL | Even when website presence is known, the URL is not |
| C4 | Campaign form collects one `contact_method`/`contact_info` pair only | Intake cannot capture multi-channel contactability |
| C5 | Overview has no Business Contact card | Operator must context-switch to find outreach channels at `preview_built`/`shown` |
| C6 | No readiness signal before `seek → preview_built` | Operators advance to outreach stages with incomplete contact data |
| C7 | Social profiles have no enrichment source | Places API does not return social profiles; needs manual entry or separate scraper (out of scope this sprint — manual only) |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    mkt_campaigns_list (extended)                    │
├─────────────────────────────────────────────────────────────────────┤
│  contact_method  (deprecated — kept for back-compat)                │
│  contact_info    (deprecated — kept for back-compat)                │
│  has_website     (flag — kept; derived from website_url when set)   │
│  + phone              VARCHAR(40)   NULL                            │
│  + email              VARCHAR(255)  NULL                            │
│  + website_url        VARCHAR(500)  NULL                            │
│  + social_profiles    JSONB         NULL  -- [{platform, url, ...}] │
│  gbp_lookup_cache     JSONB         NULL  (existing, now populated) │
│  gbp_lookup_cached_at TIMESTAMPTZ   NULL  (existing, now populated) │
└─────────────────────────────────────────────────────────────────────┘
         ▲                                   ▲
         │ write (manual)                    │ write (Places API)
         │                                   │
┌────────┴──────────┐              ┌─────────┴──────────────────┐
│ CampaignFormClient│              │ MarketingGbpEnhancerService │
│ (intake / edit)   │              │  - lookupBusiness()         │
│                   │              │  - populateContactFields()  │
└───────────────────┘              │  - 72h cache TTL (G7)       │
                                   └─────────────────────────────┘
         │                                   │
         │ read                              │ read
         ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│             CampaignDetailClient — Overview tab                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Business Contact card                                        │   │
│  │  Phone    [Text →]   Email    [Email →]                      │   │
│  │  Website  [Open →]   Social   [Open IG →] [Open FB →]        │   │
│  │  Source: GBP lookup (cached 2h ago) / Manual                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **Dedicated columns, not a JSON blob** | Phone/email/website are individually queryable and indexable; social profiles are variable-length so JSONB is appropriate for that one field only |
| **Keep `contact_method`/`contact_info`** | Back-compat — existing campaigns and the existing form still write them; new fields are additive. Migration backfills new fields from the old pair where parseable. |
| **`has_website` derived, not removed** | When `website_url` is set, `has_website` becomes `'yes'`; otherwise the operator-set value stands. Avoids breaking existing filters. |
| **GBP lookup is opt-in, not automatic** | Places API is billable (G7). Lookup runs on explicit operator action ("Enrich from GBP" button) or on first `seek → preview_built` transition if no phone+website present. |
| **Social profiles manual only this sprint** | No reliable free enrichment source. Form accepts `{platform, url}` pairs; future sprint may add website-scrape enrichment. |
| **Soft stage-gate, not hard block** | `seek → preview_built` with no contact data shows a confirm dialog, not a rejection. Some campaigns legitimately advance on in-person context. |

---

## 4. Schema Migration

```sql
-- ============================================================
-- STEP 1: Dedicated contact columns on mkt_campaigns_list
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS phone           VARCHAR(40),
  ADD COLUMN IF NOT EXISTS email           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website_url     VARCHAR(500),
  ADD COLUMN IF NOT EXISTS social_profiles JSONB;  -- [{ "platform": "instagram", "url": "https://..." }, ...]

-- ============================================================
-- STEP 2: Backfill from legacy contact_method/contact_info
-- ============================================================
-- Best-effort parse: if contact_method is 'phone'/'email'/'website',
-- copy contact_info into the matching new column. Leave others null.

UPDATE mkt_campaigns_list
  SET phone = contact_info
  WHERE contact_method = 'phone' AND contact_info IS NOT NULL AND phone IS NULL;

UPDATE mkt_campaigns_list
  SET email = contact_info
  WHERE contact_method = 'email' AND contact_info IS NOT NULL AND email IS NULL;

UPDATE mkt_campaigns_list
  SET website_url = contact_info
  WHERE contact_method = 'website' AND contact_info IS NOT NULL AND website_url IS NULL;

-- Derive has_website = 'yes' where we now have a website_url
UPDATE mkt_campaigns_list
  SET has_website = 'yes'
  WHERE website_url IS NOT NULL AND (has_website IS NULL OR has_website = 'none');

-- ============================================================
-- STEP 3: Indexes for contact-based search (optional, low cost)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_phone ON mkt_campaigns_list(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_email ON mkt_campaigns_list(email) WHERE email IS NOT NULL;
```

### Prisma Sync

After migration, run `npx prisma db pull && npx prisma generate` to sync `phone`, `email`, `website_url`, `social_profiles` onto `mkt_campaigns_list`.

### Rollback

```sql
ALTER TABLE mkt_campaigns_list
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS social_profiles;
DROP INDEX IF EXISTS idx_mkt_campaigns_phone;
DROP INDEX IF EXISTS idx_mkt_campaigns_email;
```

---

## 5. Tasks

### Task 1: Backend — Extend campaign service + types

| Sub-Task | File | Description |
|----------|------|-------------|
| Extend `CampaignInput` / `CampaignUpdateInput` | `apps/api/src/services/MarketingCampaignService.ts` | Add `phone?`, `email?`, `websiteUrl?`, `socialProfiles?: { platform: string; url: string }[]` |
| Extend `createCampaign` / `updateCampaign` writes | `apps/api/src/services/MarketingCampaignService.ts` | Persist the four new fields; when `websiteUrl` set, set `has_website = 'yes'` |
| Extend `getCampaign` response | `apps/api/src/services/MarketingCampaignService.ts` (line 278) | Already returns all columns via `findUnique`; verify new fields flow through the `...rest` spread at line 306 |
| Add `getContactReadiness(campaign)` helper | `apps/api/src/services/MarketingCampaignService.ts` | Returns `{ hasPhone, hasEmail, hasWebsite, hasSocial, complete: boolean }` — used by stage-gate |

### Task 2: Backend — Implement `MarketingGbpEnhancerService`

| Sub-Task | File | Description |
|----------|------|-------------|
| Create service | `apps/api/src/services/MarketingGbpEnhancerService.ts` (NEW) | Singleton extends `BaseService`. Methods: `lookupBusiness(campaignId, ctx, { force?: boolean })`, `populateContactFields(campaignId, ctx)` |
| Places API call | `apps/api/src/services/MarketingGbpEnhancerService.ts` | Use `GBPBusinessInfoSync` patterns (per Tenant Prospecting sprint plan §Task 5B.2) to look up by `business_name + city`. Extract `formatted_phone_number`, `website`, `formatted_address`. |
| 72h cache (G7) | `apps/api/src/services/MarketingGbpEnhancerService.ts` | Read `gbp_lookup_cache` + `gbp_lookup_cached_at`; if cached and < 72h old, return cached. On miss, call Places, write `gbp_lookup_cache` + `gbp_lookup_cached_at`. `force=true` allowed once per campaign per day. |
| Populate contact fields | `apps/api/src/services/MarketingGbpEnhancerService.ts` | After successful lookup, write `phone` and `website_url` on the campaign (only if not already set — never overwrite operator-entered values). Set `has_website = 'yes'` if `website_url` populated. |
| Fallback on quota/no-match | `apps/api/src/services/MarketingGbpEnhancerService.ts` | On Places failure, fall back to campaign audit data; log and return `{ source: 'audit_fallback', phone: null, website_url: null }` — do not throw. |

### Task 3: Backend — Routes

| Sub-Task | File | Description |
|----------|------|-------------|
| Extend create/update validators | `apps/api/src/routes/marketing-ops.ts` (lines 386, 421) | Add `phone`, `email`, `website_url`, `social_profiles` to the Zod schemas; `social_profiles` is `z.array(z.object({ platform: z.string(), url: z.string().url() })).optional()` |
| Add `POST /:id/enrich-contact` route | `apps/api/src/routes/marketing-ops.ts` | Admin endpoint to trigger GBP enrichment. Accepts `{ force?: boolean }`. Returns the populated contact fields + source. |
| Add `GET /:id/contact-readiness` route | `apps/api/src/routes/marketing-ops.ts` | Returns the readiness object for the stage-gate UI check. |
| Wire enrichment into `seek → preview_built` transition | `apps/api/src/services/MarketingCampaignService.ts` (`transitionStage`) | If transitioning to `preview_built` and no phone AND no website_url, call `MarketingGbpEnhancerService.populateContactFields` (best-effort, await but catch errors). Do not block the transition on enrichment failure. |

### Task 4: Frontend — Types + service client

| Sub-Task | File | Description |
|----------|------|-------------|
| Extend `Campaign` interface | `apps/web/src/services/MarketingOpsService.ts` (line 66) | Add `phone?: string \| null`, `email?: string \| null`, `website_url?: string \| null`, `social_profiles?: { platform: string; url: string }[] \| null` |
| Add `enrichContact(campaignId, { force })` method | `apps/web/src/services/MarketingOpsService.ts` | POST to `/api/admin/marketing-ops/:id/enrich-contact` |
| Add `getContactReadiness(campaignId)` method | `apps/web/src/services/MarketingOpsService.ts` | GET `/api/admin/marketing-ops/:id/contact-readiness` |

### Task 5: Frontend — Campaign form

| Sub-Task | File | Description |
|----------|------|-------------|
| Add contact channel inputs | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` | Four inputs: Phone, Email, Website URL, Social Profiles (repeatable `{platform, url}` rows with add/remove). Place above the existing `contact_method`/`contact_info` pair, which is retained but visually de-emphasized as "Legacy contact method". |
| Submit new fields | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` | Include `phone`, `email`, `website_url`, `social_profiles` in the create/update payload (lines 202–208, 229–234) |
| Backfill legacy pair from new fields | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` | If operator fills new fields but leaves `contact_method`/`contact_info` blank, auto-set the legacy pair from the first non-empty new field (preserves existing filters/reports) |

### Task 6: Frontend — Overview Business Contact card

| Sub-Task | File | Description |
|----------|------|-------------|
| Create `BusinessContactCard` component | `apps/web/src/components/marketing-ops/BusinessContactCard.tsx` (NEW) | Renders Phone / Email / Website / Social rows. Each row: label, value, and an action button — Phone → `sms:` link (Text), Email → `mailto:` link (Email), Website → external link (Open Contact Form), Social → external link per profile (Open DM). Empty rows show "—" and a muted "Add in Edit" hint. |
| Render card in Overview | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (line 325, inside `activeTab === 'overview'`) | Place the `BusinessContactCard` at the top of the Overview tab, before the existing detail grid. Pass `campaign` + `onEnrich` callback. |
| Add "Enrich from GBP" button | `apps/web/src/components/marketing-ops/BusinessContactCard.tsx` | Calls `marketingOpsService.enrichContact(campaignId, { force: false })`, shows loading state, refreshes campaign on success. Displays last-enriched timestamp from `gbp_lookup_cached_at`. |
| Show contact source badge | `apps/web/src/components/marketing-ops/BusinessContactCard.tsx` | Per field: "GBP" if populated by enrich (track via a `contact_source` map returned by enrich endpoint), "Manual" otherwise. |

### Task 7: Frontend — Stage-gate readiness warning

| Sub-Task | File | Description |
|----------|------|-------------|
| Pre-transition check | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (`handleTransition`, line 75) | When `toStage === 'preview_built'`, call `getContactReadiness` first. If `complete === false`, show a confirm dialog: "This campaign has no phone or website on file. Enrich from GBP now, or proceed anyway?" with [Enrich] [Proceed] [Cancel]. |
| Visual indicator on the `preview_built` stage button | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (line 282) | Small warning dot on the `preview_built` pipeline button when readiness is incomplete. |

---

## 6. API Contract

### `POST /api/admin/marketing-ops/:id/enrich-contact`

**Request:** `{ "force"?: boolean }`

**Response 200:**
```json
{
  "phone": "+1-555-0100",
  "website_url": "https://example.com",
  "source": "gbp",            // "gbp" | "audit_fallback"
  "cached_at": "2026-07-30T14:00:00Z",
  "populated": ["phone", "website_url"]  // which fields were newly written
}
```

**Response 200 (no match / quota failure):**
```json
{
  "phone": null,
  "website_url": null,
  "source": "audit_fallback",
  "cached_at": null,
  "populated": []
}
```

### `GET /api/admin/marketing-ops/:id/contact-readiness`

**Response 200:**
```json
{
  "hasPhone": true,
  "hasEmail": false,
  "hasWebsite": true,
  "hasSocial": false,
  "complete": false,
  "missing": ["email", "social"]
}
```

`complete` is defined as `hasPhone || hasEmail` (at least one direct-response channel). Website and social are not required for completeness — they are outreach affordances, not response channels.

---

## 7. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC1 | A business campaign returned by `GET /:id` includes `phone`, `email`, `website_url`, `social_profiles` fields (nullable) | API test: create campaign with all fields, GET, assert presence |
| AC2 | The Overview tab shows a Business Contact card with all four channels and the correct outreach action per channel (sms / mailto / external link / external link) | Manual: open a campaign with all fields populated, verify each action button |
| AC3 | "Enrich from GBP" button calls Places API (or cache), populates `phone` + `website_url` on the campaign, and the card refreshes without page reload | Manual: create campaign with no phone/website, click Enrich, verify fields populate and `gbp_lookup_cached_at` is set |
| AC4 | A second Enrich within 72h returns cached data without a Places API call | Unit test on `MarketingGbpEnhancerService`: mock Places client, call twice, assert one Places call |
| AC5 | `force: true` re-calls Places but is capped at 1/day per campaign | Unit test: two force calls in same day, second returns cached and a `force_capped` flag |
| AC6 | Transitioning `seek → preview_built` with no phone AND no website triggers a confirm dialog offering Enrich or Proceed | Manual: create campaign with no contact, click `preview_built` in pipeline, verify dialog |
| AC7 | Transitioning `seek → preview_built` with no phone/website triggers best-effort enrichment server-side (does not block on failure) | Integration test: mock Places to throw, assert transition still succeeds |
| AC8 | Existing campaigns with only `contact_method='phone'` + `contact_info` still show their phone in the new card after migration | Post-migration manual: open a pre-migration campaign, verify phone appears |
| AC9 | `has_website` filter on the campaigns list still works and now returns campaigns with `website_url` set | API test: filter `has_website=yes`, assert includes campaigns with `website_url` populated by enrich |
| AC10 | Social profiles render as repeatable rows in the form and persist correctly | Manual: add two social rows, save, reload, verify both persist |

---

## 8. Out of Scope (Future Sprints)

| Item | Why deferred |
|------|--------------|
| **Social profile enrichment** (auto-discover from website scrape) | No reliable free source; manual entry is sufficient for v1 |
| **Contact verification** (e.g., SMS ping to confirm phone is live) | Out of scope; operator can verify during outreach |
| **Contact history / outreach log** (track which channel was tried, when, response) | Separate CRM-ish feature; this sprint only stores the contact surface |
| **Extending contact fields to `category` and `city` scope campaigns** | Those scopes target groups, not individual businesses — contact surface is per-business. Revisit if category/city campaigns ever link to specific prospects. |
| **Deprecating `contact_method` / `contact_info` columns** | Keep for back-compat this sprint; remove in a follow-up once all consumers migrate |
| **GBP OAuth-gated Business Profile API** for richer data (posts, photos, hours) | Public Places API is sufficient for contact fields; OAuth flow is a larger sprint |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Places API quota/cost overrun | 72h per-campaign cache (G7 pattern from Tenant Prospecting sprint); force-refresh capped at 1/day; fallback to audit data on quota failure |
| Places API returns wrong business (common business name in a city) | Operator reviews enriched fields before save; enrich never overwrites operator-set values; show `gbp_lookup_cached_at` so operator can judge freshness |
| Social profile URLs are malformed or point to wrong account | Form validates URL format; operator-entered, no auto-trust |
| Backfill parse of `contact_method`/`contact_info` is imperfect (free-text values) | Best-effort only; null is acceptable; operator can fix in Edit |
| Stage-gate dialog annoys operators on legitimately in-person campaigns | Soft confirm, not a block; "Proceed" is one click |

---

## 10. File Inventory

**New files:**
- `apps/api/src/services/MarketingGbpEnhancerService.ts`
- `apps/api/src/services/__tests__/MarketingGbpEnhancerService.test.ts`
- `apps/web/src/components/marketing-ops/BusinessContactCard.tsx`

**Modified files:**
- `apps/api/prisma/schema.prisma` (synced via `db pull`)
- `apps/api/src/services/MarketingCampaignService.ts`
- `apps/api/src/routes/marketing-ops.ts`
- `apps/web/src/services/MarketingOpsService.ts`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`

**Migration:**
- New SQL migration adding `phone`, `email`, `website_url`, `social_profiles` + backfill + indexes (§4)

---

## 11. Open Questions (Sprint 1)

1. **Places API credentials** — does the platform already have a Google Places API key configured, or does this sprint need to provision one? (Check `unifiedConfig` for an existing key before implementation.)
2. **`contact_method` vocabulary** — the form uses a `ContactMethodChecklist` with a `contactMethods` vocab list. Should the new fields drive that vocab list going forward, or keep them independent?
3. **Social platform whitelist** — should the form restrict `social_profiles.platform` to a known list (instagram, facebook, tiktok, linkedin, x, youtube) or accept free text? Recommend whitelist with an "Other" option.

---

# Part II — Sprint 2: Outreach Tracking & Follow-Up Visibility

## 12. Executive Summary

Sprint 1 makes the campaign the source of truth for *how to reach* a prospect. Sprint 2 makes it the source of truth for *that we reached them, when, and what's next*.

During the `preview_built` and `shown` stages, the operator contacts the business to present the preview and chase a decision. Today there is no record of those touchpoints — no contact date, no scheduled follow-up, no way to see at a glance which prospects are slipping through the cracks. The `shown → lost` auto-advance job (7 days, from the Tenant Prospecting Channel sprint) fires blindly with no regard for whether outreach actually happened.

This sprint adds an **outreach log** per campaign (each touchpoint: channel, date, outcome, next-follow-up date) plus rollup columns (`last_contacted_at`, `next_follow_up_at`) for at-a-glance visibility — on the campaign, on the campaigns list, and on the ops dashboard as a "Follow-ups due" widget. The auto-advance job is rewired to honor scheduled follow-ups (a campaign with a future follow-up is not auto-lost).

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Outreach log** | Per-campaign chronological log of contact attempts during `preview_built`/`shown` — channel, date, outcome, notes, contacted-by |
| **Follow-up scheduling** | Each log entry can set a `follow_up_date`; the latest non-completed follow-up becomes the campaign's `next_follow_up_at` |
| **At-a-glance rollups** | `last_contacted_at` + `next_follow_up_at` on the campaign, surfaced on the list view and pipeline so overdue follow-ups are visible without opening each campaign |
| **Follow-ups-due dashboard widget** | Ops dashboard widget: campaigns with `next_follow_up_at <= today` (and not yet contacted today), grouped by overdue / due-today / due-this-week |
| **Auto-advance respects follow-ups** | The `shown → lost` 7-day job skips campaigns with a `next_follow_up_at` in the future; reschedules loss only after the follow-up date passes with no new contact |
| **Quick-log from Overview** | One-click "Log contact" action on the campaign Overview that opens a small form and appends to the log |

### Why a separate sprint

Sprint 1 establishes the contact *surface* (the channels). Sprint 2 establishes the contact *activity*. Coupling them would balloon Sprint 1 and delay the contact-details work, which is the more urgent blocker (operators can't reach out at all without it). Sprint 2 is small and well-scoped on its own, and cleanly depends on Sprint 1's `phone`/`email`/`website_url`/`social_profiles` fields to pre-fill the channel selector in the log form.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer
**Depends on:** Sprint 1 (Part I)

---

## 13. Gap Analysis — Current State

### What exists today

- **Stage history** (`mkt_stage_history_list`, schema lines 6359–6371) — logs stage *transitions* only, not outreach touchpoints. A campaign can sit in `shown` for 7 days with zero outreach and the history shows nothing.
- **`shown → lost` auto-advance job** (Tenant Prospecting Channel sprint §Task 5A.4) — fires after 7 days in `shown` regardless of whether the operator ever contacted the business. Blind to outreach activity.
- **Scorecard** (`MarketingScorecardService`) — counts `previews_shown` / `previews_built` aggregates, not per-campaign contact activity.

### What's missing

| # | Gap | Impact |
|---|-----|--------|
| O1 | No outreach log table | Each contact attempt is lost; no history of what was tried |
| O2 | No `last_contacted_at` on campaign | Operator can't see at a glance whether a prospect was ever contacted |
| O3 | No `next_follow_up_at` on campaign | Scheduled follow-ups live in operators' heads / external calendars — missed silently |
| O4 | No follow-ups-due dashboard view | Operator must open every `shown` campaign to find which need chasing |
| O5 | Auto-advance ignores outreach | A prospect with a scheduled follow-up on day 8 gets auto-lost on day 7 |
| O6 | No quick-log affordance | Logging a contact requires editing notes freeform — friction discourages logging |

---

## 14. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    mkt_campaigns_list (extended)                    │
├─────────────────────────────────────────────────────────────────────┤
│  + last_contacted_at   TIMESTAMPTZ NULL   (rollup, updated on log)  │
│  + next_follow_up_at   TIMESTAMPTZ NULL   (rollup, latest open FU)  │
│  + last_contact_channel VARCHAR(20) NULL  (phone/email/website/...) │
└─────────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ rollup update                       │ rollup update
         │                                      │
┌────────┴──────────────────────────────────┴─────────────────────────┐
│                    mkt_outreach_log (NEW)                           │
│  id, campaign_id, stage_at_time, contact_channel, contact_date,     │
│  outcome, follow_up_date, follow_up_completed_at, notes,            │
│  contacted_by, created_at                                            │
└─────────────────────────────────────────────────────────────────────┘
         ▲ read
         │
┌────────┴────────────────────────────────────────────────────────────┐
│  CampaignDetailClient — Overview: Outreach & Follow-Up card         │
│   Last contacted: 2026-07-28 (phone) · Next follow-up: 2026-07-31   │
│   [Log contact]  [Log history ▾]                                    │
└─────────────────────────────────────────────────────────────────────┘
         ▲ read
         │
┌────────┴────────────────────────────────────────────────────────────┐
│  Ops Dashboard — Follow-ups due widget                              │
│   Overdue (3) · Due today (2) · This week (5)   [Open list →]       │
└─────────────────────────────────────────────────────────────────────┘
```

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **Separate `mkt_outreach_log` table, not reusing `mkt_stage_history_list`** | Stage history is transition events; outreach is a different event class with different fields (channel, outcome, follow-up). Mixing them corrupts both. |
| **Rollup columns on campaign** | At-a-glance visibility on the list view requires denormalized `last_contacted_at` / `next_follow_up_at` — joining the log for every list row is expensive and unnecessary |
| **`next_follow_up_at` = latest open follow-up** | When a log entry sets `follow_up_date` and `follow_up_completed_at` is null, it becomes the campaign's `next_follow_up_at`. Completing a follow-up (by logging a new contact) clears it. |
| **Outcomes are a closed enum** | Enables filtering/reporting ("show me all no-answer outcomes") vs free text |
| **Auto-advance rewired, not removed** | The 7-day `shown → lost` rule is still useful for genuinely abandoned prospects; it just now respects a future `next_follow_up_at` |
| **Quick-log is a modal, not a full page** | Reduces friction — the goal is to make logging a 10-second action |

---

## 15. Schema Migration

```sql
-- ============================================================
-- STEP 1: Outreach log table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_outreach_log (
  id                      VARCHAR(255)  PRIMARY KEY,          -- mol-{nanoid}
  campaign_id             VARCHAR(255)  NOT NULL,
  stage_at_time           VARCHAR(50)   NOT NULL,             -- 'preview_built' | 'shown'
  contact_channel         VARCHAR(20)   NOT NULL,             -- 'phone' | 'email' | 'website' | 'social' | 'in_person' | 'other'
  contact_date            DATE          NOT NULL,
  outcome                 VARCHAR(30)   NOT NULL,             -- 'reached' | 'no_answer' | 'left_message' | 'interested' | 'not_interested' | 'callback_scheduled' | 'other'
  follow_up_date          DATE,                               -- nullable: scheduled follow-up
  follow_up_completed_at  TIMESTAMPTZ,                        -- nullable: set when a later log entry fulfills this follow-up
  notes                   TEXT,
  contacted_by            VARCHAR(255),
  -- Message + fresh-data snapshot (so historical contacts are reviewable in Ops)
  message_snapshot        TEXT,                               -- the rendered message/preview body sent to the prospect
  message_subject         VARCHAR(255),                       -- for email channel
  data_snapshot           JSONB,                              -- fresh audit data used at contact time: {review_count, average_rating, unaddressed_reviews, ...}
  data_fresh_at           TIMESTAMPTZ,                        -- when the snapshot data was fetched (proves freshness)
  preview_token           VARCHAR(255),                       -- optional: link to the mkt_deliverable_preview_tokens row if a preview URL was sent
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_outreach_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_campaign ON mkt_outreach_log(campaign_id, contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_followup ON mkt_outreach_log(follow_up_date) WHERE follow_up_date IS NOT NULL AND follow_up_completed_at IS NULL;

-- ============================================================
-- STEP 2: Rollup columns on campaign
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS last_contacted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_follow_up_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_channel  VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_next_followup ON mkt_campaigns_list(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_last_contacted ON mkt_campaigns_list(last_contacted_at DESC) WHERE last_contacted_at IS NOT NULL;

-- ============================================================
-- STEP 3: Backfill rollups from any future log data (no-op pre-population; safe to run)
-- ============================================================
-- Rollups are maintained by the service on every log write; no historical backfill needed
-- because no outreach log rows exist before this sprint.
```

### Prisma Sync

After migration, run `npx prisma db pull && npx prisma generate` to sync `mkt_outreach_log` and the three new campaign columns.

### ID Generator

Add to `apps/api/src/lib/id-generator.ts`:
```typescript
export const generateOutreachLogId = () => `mol-${nanoid(12)}`;
```

### Rollback

```sql
DROP TABLE IF EXISTS mkt_outreach_log;
ALTER TABLE mkt_campaigns_list
  DROP COLUMN IF EXISTS last_contacted_at,
  DROP COLUMN IF EXISTS next_follow_up_at,
  DROP COLUMN IF EXISTS last_contact_channel;
DROP INDEX IF EXISTS idx_mkt_campaigns_next_followup;
DROP INDEX IF EXISTS idx_mkt_campaigns_last_contacted;
```

---

## 16. Tasks

### Task 8: Backend — Outreach log service

| Sub-Task | File | Description |
|----------|------|-------------|
| Create `MarketingOutreachService` | `apps/api/src/services/MarketingOutreachService.ts` (NEW) | Singleton extends `BaseService`. Methods: `logContact(input, ctx)`, `listLog(campaignId, ctx)`, `completeFollowUp(logId, ctx)`, `getFollowUpsDue({ from, to, assignedTo? }, ctx)`, `buildFreshSnapshot(campaignId, ctx)` |
| `logContact` writes log + updates rollups | `apps/api/src/services/MarketingOutreachService.ts` | Insert into `mkt_outreach_log` (including `message_snapshot`, `message_subject`, `data_snapshot`, `data_fresh_at`, `preview_token`); set campaign `last_contacted_at = contact_date`, `last_contact_channel = contact_channel`; if `follow_up_date` set, set campaign `next_follow_up_at = follow_up_date`; if a prior open follow-up exists for this campaign, mark it `follow_up_completed_at = now` (this contact fulfills it) |
| `buildFreshSnapshot` | `apps/api/src/services/MarketingOutreachService.ts` | Re-fetches the campaign's latest audit data (review_count, average_rating, unaddressed_reviews, last_review_date, gbp_claimed, photo_count) from `mkt_audits_list` + optional GBP refresh; returns `{ data_snapshot, data_fresh_at: now }`. Called before rendering the contact message so every preview uses fresh data, not stale campaign columns. |
| `completeFollowUp` | `apps/api/src/services/MarketingOutreachService.ts` | Marks a log entry's `follow_up_completed_at`; recomputes campaign `next_follow_up_at` to the next open follow-up (or null) |
| `getFollowUpsDue` | `apps/api/src/services/MarketingOutreachService.ts` | Returns campaigns where `next_follow_up_at BETWEEN from AND to` AND stage IN (`preview_built`, `shown`); joined with campaign fields for the dashboard widget |
| Recompute helper | `apps/api/src/services/MarketingOutreachService.ts` | `recomputeRollups(campaignId)`: derive `next_follow_up_at` = min(`follow_up_date`) where `follow_up_completed_at IS NULL`; used after deletes/edits |

### Task 9: Backend — Routes + validators

| Sub-Task | File | Description |
|----------|------|-------------|
| Add outreach routes | `apps/api/src/routes/marketing-ops.ts` | `POST /:id/outreach` (log a contact), `GET /:id/outreach` (list log), `PUT /outreach/:logId` (edit), `DELETE /outreach/:logId`, `POST /outreach/:logId/complete` (mark follow-up done), `GET /follow-ups-due` (dashboard) |
| Zod schemas | `apps/api/src/routes/marketing-ops.ts` | `contact_channel` enum, `outcome` enum, `contact_date` date, `follow_up_date` date optional, `notes` string optional |
| Extend `getCampaign` response | `apps/api/src/services/MarketingCampaignService.ts` (line 278) | Include `outreach_log` (last 20, newest first) in the `findUnique` include; flow through the `...rest` spread |

### Task 10: Backend — Rewire auto-advance job

| Sub-Task | File | Description |
|----------|------|-------------|
| Find the `shown → lost` job | `apps/api/src/services/MarketingCampaignService.ts` or the scheduler that runs it | Locate the 7-day auto-advance logic from Tenant Prospecting Channel sprint §Task 5A.4 |
| Add follow-up guard | (same file) | Before auto-advancing `shown → lost`, check `next_follow_up_at`: if it is in the future, skip this campaign (do not auto-lose). If `next_follow_up_at` is in the past AND `last_contacted_at` is older than the follow-up date, auto-advance to `lost`. If no `next_follow_up_at`, keep existing 7-day rule. |
| Log skips | (same file) | Log skipped auto-advances with reason `follow_up_scheduled` for auditability |

### Task 11: Frontend — Types + service client

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `OutreachLogEntry` interface | `apps/web/src/services/MarketingOpsService.ts` | `{ id, campaign_id, stage_at_time, contact_channel, contact_date, outcome, follow_up_date, follow_up_completed_at, notes, contacted_by, created_at }` |
| Extend `Campaign` / `CampaignDetail` | `apps/web/src/services/MarketingOpsService.ts` | Add `last_contacted_at?`, `next_follow_up_at?`, `last_contact_channel?`, `outreach_log?: OutreachLogEntry[]` |
| Add service methods | `apps/web/src/services/MarketingOpsService.ts` | `logContact(campaignId, input)`, `listOutreach(campaignId)`, `editOutreach(logId, input)`, `deleteOutreach(logId)`, `completeFollowUp(logId)`, `getFollowUpsDue({ from, to })` |

### Task 12: Frontend — Outreach & Follow-Up card + quick-log modal

| Sub-Task | File | Description |
|----------|------|-------------|
| Create `OutreachFollowUpCard` component | `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` (NEW) | Header: "Last contacted: {date} ({channel}) · Next follow-up: {date}" with overdue/due-today color coding (red/amber). Body: chronological log list — each entry shows channel, date, outcome badge, follow-up badge, AND an expandable "Message sent" section rendering `message_snapshot` (with `message_subject` for email) + a "Data at contact" sub-section rendering the `data_snapshot` (review count, rating, unaddressed, etc.) with `data_fresh_at` timestamp. Footer: [Log contact] button + [Full history] toggle. Empty state: "No outreach logged yet — log your first contact." |
| Create `LogContactModal` component | `apps/web/src/components/marketing-ops/LogContactModal.tsx` (NEW) | Fields: contact_channel (select, pre-filled from Sprint 1's populated channels — phone/email/website/social + in_person/other), contact_date (default today), outcome (select), follow_up_date (date picker, optional), notes (textarea), message_snapshot (textarea — paste/type the message actually sent; for email also message_subject), preview_token (optional select of campaign's active preview tokens). On open, the modal calls `buildFreshSnapshot` (via a new `getFreshSnapshot(campaignId)` service method) and displays a "Data freshness: fetched {n} seconds ago" badge so the operator confirms the preview used fresh data before logging. Submit calls `logContact`. |
| Render card in Overview | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (inside `activeTab === 'overview'`, after the Business Contact card from Sprint 1) | Show only when `campaign.scope === 'business'` AND stage IN (`preview_built`, `shown`, `paid`) — outreach is a business-prospecting activity |
| Wire [Log contact] button | `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` | Opens `LogContactModal`; on submit, refresh campaign + card |
| Historical message viewer | `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` | Clicking a log entry expands to show the exact message sent + the data snapshot at contact time — so an operator reviewing why a past contact did/didn't land can see both the wording and the numbers that were true then |

### Task 13: Frontend — Campaigns list follow-up indicators

| Sub-Task | File | Description |
|----------|------|-------------|
| Add follow-up column / badge to campaigns list | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/page.tsx` (or the list component) | Show `next_follow_up_at` as a badge: red "Overdue {n}d" / amber "Due today" / gray "Due {date}". Sortable. |
| Add "Follow-ups due" filter | (same file) | Quick filter chips: Overdue / Due today / This week — set list filter to `next_follow_up_at` range |

### Task 14: Frontend — Ops dashboard Follow-ups-due widget

| Sub-Task | File | Description |
|----------|------|-------------|
| Locate the ops dashboard | `apps/web/src/app/(platform)/settings/admin/marketing-ops/page.tsx` (or dashboard component) | Find the existing dashboard that renders `DashboardStats` |
| Add Follow-ups-due widget | (same file or new `FollowUpsDueWidget.tsx`) | Calls `getFollowUpsDue({ from: today, to: today+7d })`. Renders three counts (Overdue / Due today / This week) with click-through to the campaigns list filtered accordingly. |
| Refresh on dashboard load | (same file) | Fetch in parallel with existing dashboard stats |

---

## 17. API Contract

### `POST /api/admin/marketing-ops/:id/outreach`

**Request:**
```json
{
  "contact_channel": "phone",
  "contact_date": "2026-07-30",
  "outcome": "callback_scheduled",
  "follow_up_date": "2026-08-02",
  "notes": "Spoke to owner, asked to review preview PDF over weekend.",
  "message_snapshot": "Hi {owner}, I noticed Acme Grocery has 14 unaddressed reviews...",
  "message_subject": "Your Acme Grocery review report is ready",
  "preview_token": "mdpt-abc123"
}
```

The `data_snapshot` + `data_fresh_at` are populated server-side by `buildFreshSnapshot` (Task 8) — the client does not send stale data. The client sends the rendered `message_snapshot` it actually sent to the prospect.

**Response 201:**
```json
{
  "id": "mol-abc123",
  "campaign_id": "mc-xyz",
  "stage_at_time": "shown",
  "contact_channel": "phone",
  "contact_date": "2026-07-30",
  "outcome": "callback_scheduled",
  "follow_up_date": "2026-08-02",
  "follow_up_completed_at": null,
  "notes": "Spoke to owner, asked to review preview PDF over weekend.",
  "message_snapshot": "Hi {owner}, I noticed Acme Grocery has 14 unaddressed reviews...",
  "message_subject": "Your Acme Grocery review report is ready",
  "data_snapshot": {
    "review_count": 47,
    "average_rating": 3.8,
    "unaddressed_reviews": 14,
    "last_review_date": "2026-07-25",
    "gbp_claimed": true,
    "photo_count": 8
  },
  "data_fresh_at": "2026-07-30T13:58:00Z",
  "preview_token": "mdpt-abc123",
  "contacted_by": "user-123",
  "created_at": "2026-07-30T14:00:00Z",
  "campaign_rollup": {
    "last_contacted_at": "2026-07-30T14:00:00Z",
    "next_follow_up_at": "2026-08-02T00:00:00Z",
    "last_contact_channel": "phone"
  }
}
```

### `GET /api/admin/marketing-ops/follow-ups-due?from=2026-07-30&to=2026-08-06`

**Response 200:**
```json
{
  "overdue": [
    { "campaign_id": "mc-1", "business_name": "Acme Grocery", "next_follow_up_at": "2026-07-28", "days_overdue": 2, "assigned_to": "user-123" }
  ],
  "due_today": [
    { "campaign_id": "mc-2", "business_name": "Corner Store", "next_follow_up_at": "2026-07-30", "assigned_to": null }
  ],
  "this_week": [
    { "campaign_id": "mc-3", "business_name": "Bodega", "next_follow_up_at": "2026-08-01", "assigned_to": "user-456" }
  ]
}
```

### `POST /api/admin/marketing-ops/outreach/:logId/complete`

**Response 200:** the updated log entry with `follow_up_completed_at` set + the recomputed campaign `next_follow_up_at`.

---

## 18. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC11 | Logging a contact via `POST /:id/outreach` creates a log entry and updates `last_contacted_at` + `last_contact_channel` on the campaign | API test: log a contact, GET campaign, assert rollups |
| AC12 | Logging a contact with a `follow_up_date` sets the campaign's `next_follow_up_at` to that date | API test |
| AC13 | Logging a second contact on a campaign with an open follow-up marks the prior follow-up `follow_up_completed_at` and re-derives `next_follow_up_at` | API test: two logs, assert first follow-up completed, second's follow-up is now the rollup |
| AC14 | The Overview Outreach & Follow-Up card shows last contacted, next follow-up (color-coded overdue/due-today), and the log history | Manual: log 2 contacts on a campaign in `shown`, verify card |
| AC15 | The quick-log modal pre-fills the channel selector with channels the campaign actually has (from Sprint 1's phone/email/website/social) | Manual: campaign with phone+email only, open modal, verify selector shows phone+email+in_person+other |
| AC16 | The campaigns list shows a follow-up badge per row with correct color coding (red overdue / amber today / gray future) and is sortable | Manual |
| AC17 | The "Follow-ups due" dashboard widget shows correct counts and click-through filters the campaigns list | Manual: seed campaigns with various `next_follow_up_at`, verify widget counts |
| AC18 | A campaign in `shown` with `next_follow_up_at` in the future is NOT auto-advanced to `lost` by the 7-day job | Unit/integration test on the job: mock campaign with future follow-up, run job, assert stage unchanged |
| AC19 | A campaign in `shown` with `next_follow_up_at` in the past and no contact since is auto-advanced to `lost` | Unit test: mock campaign with past follow-up + stale `last_contacted_at`, run job, assert `lost` |
| AC20 | A campaign in `shown` with no `next_follow_up_at` follows the existing 7-day rule | Unit test: preserve prior behavior |
| AC21 | Deleting an outreach log entry recomputes `next_follow_up_at` | API test: delete the log that set the follow-up, assert rollup recomputed |
| AC22 | Outreach card only appears for `business` scope campaigns in `preview_built`/`shown`/`paid` stages | Manual: open a `category` scope campaign, verify card absent; open a `seek`-stage business campaign, verify card absent |
| AC23 | Each outreach log entry stores `message_snapshot` (the rendered message sent) and `data_snapshot` (fresh audit data at contact time) with `data_fresh_at` | API test: log a contact with a message, GET log, assert snapshot fields populated and `data_fresh_at` within seconds of now |
| AC24 | `buildFreshSnapshot` re-fetches current audit data (not stale campaign columns) before a contact is logged | Unit test: mutate campaign's `unaddressed_reviews` after an audit update, call `buildFreshSnapshot`, assert snapshot reflects the audit's value not the campaign column |
| AC25 | Historical log entries in the card expand to show the exact message sent + the data snapshot at contact time | Manual: open a campaign with 2 past contacts, expand each, verify message + data rendered per entry |

---

## 19. Out of Scope (Sprint 2)

| Item | Why deferred |
|------|--------------|
| **Automated follow-up reminders** (email/Slack to operator on due date) | The dashboard widget + list badges provide passive visibility; push notifications are a separate notification-infrastructure sprint. (Note: *prospect-driven* auto-scheduling of follow-ups based on hot-prospect signals is in Sprint 3, Part III.) |
| **Outreach templates** (pre-written call scripts / email drafts per channel) | Useful but additive; manual notes suffice for v1 |
| **Outreach analytics** (contact-attempt-to-conversion funnel, best-performing channel) | Depends on accumulated log data; revisit after a quarter of usage |
| **Extending outreach logging to `paid` / `delivered` / retainer stages** | Card shows on `paid` for visibility of the closing touch, but active logging is scoped to the prospecting stages where follow-ups get missed |
| **Multi-assignee follow-ups** (a follow-up assigned to a different operator than the campaign owner) | Adds assignment model complexity; campaign `assigned_to` is the single owner for v1 |

---

## 20. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Operators don't log contacts (friction) → rollups unreliable → auto-advance misfires | Quick-log modal is 1 field + submit; channel pre-filled; default date today. Acceptance: logging is <10 seconds. |
| Auto-advance rewiring introduces a regression where abandoned prospects never go `lost` | Guard only skips when `next_follow_up_at` is in the *future*; past-due follow-ups with no new contact still auto-advance (AC19). Add a safety cap: if no contact in 30 days regardless of follow-ups, force `lost`. |
| Rollup drift (log edited/deleted but rollup not recomputed) | All log mutations go through the service, which always calls `recomputeRollups`. Add a nightly reconcile job as a safety net. |
| Follow-up date in the past at creation (operator back-dates) | Allow it — it immediately surfaces as overdue, which is the correct signal |

---

## 21. File Inventory (Sprint 2)

**New files:**
- `apps/api/src/services/MarketingOutreachService.ts`
- `apps/api/src/services/__tests__/MarketingOutreachService.test.ts`
- `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx`
- `apps/web/src/components/marketing-ops/LogContactModal.tsx`
- `apps/web/src/components/marketing-ops/FollowUpsDueWidget.tsx` (if dashboard widget is split out)

**Modified files:**
- `apps/api/prisma/schema.prisma` (synced via `db pull`)
- `apps/api/src/lib/id-generator.ts` (`generateOutreachLogId`)
- `apps/api/src/services/MarketingCampaignService.ts` (`getCampaign` include + auto-advance rewire)
- `apps/api/src/routes/marketing-ops.ts` (outreach routes + validators)
- `apps/web/src/services/MarketingOpsService.ts` (types + methods)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (card render)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/page.tsx` (list badges + filters)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/page.tsx` (dashboard widget)

**Migration:**
- New SQL migration: `mkt_outreach_log` table + campaign rollup columns + indexes (§15)

---

## 22. Open Questions (Sprint 2)

1. **Auto-advance safety cap** — confirm the 30-day hard cap (§20) is acceptable, or should abandoned prospects with recurring follow-ups stay in `shown` indefinitely at the operator's discretion?
2. **Outreach on `paid` stage** — AC22 shows the card on `paid` for visibility. Should logging still be *active* on `paid` (e.g., chasing delivery confirmation), or read-only?
3. **Follow-ups-due widget assignment scoping** — should the dashboard widget show all operators' follow-ups, or only the current admin's? (Recommend: all, with an "Assigned to me" toggle.)
4. **`stage_at_time` denormalization** — when a campaign transitions `preview_built → shown`, should prior log entries' `stage_at_time` be updated, or kept as the stage at the time of the contact? (Recommend: keep as-is — it's an audit field.)

---

# Part III — Sprint 3: Hot-Prospect Auto-Follow-Up + City Pain Scan Sync

## 23. Executive Summary

Sprint 2 lets an operator *manually* schedule a follow-up after a no-response contact. But for **hot prospects** — businesses flagged as high-priority by a recent City Pain Scan — a no-response contact should not require the operator to remember to re-schedule. The system should keep them on the radar automatically until they convert or are explicitly deprioritized.

This sprint also closes a critical loop: **City Pain Scan executions produce a multi-business ranked audit JSON (up to 15 businesses across 5+ categories, with per-business GBP status, website, NAP, pain score, priority, tier, and fee estimate) that today is stored only in `mkt_prompt_executions_list.raw_output` and never reaches the campaign records.** Sprint 3 parses this output, matches each business to a campaign, stores per-business `city_analysis` audits, syncs structured fields onto campaigns (null-gated — null values in the JSON don't overwrite existing campaign data), and derives hot-prospect signals from the `top_prospects` array + per-business `priority` + `pain_score` + `recommended_tier`. Sprint 2's `buildFreshSnapshot` then has real fresh data to work with, and the auto-follow-up scheduler pursues hot prospects automatically.

### What a City Pain Scan actually produces (from the production prompt)

A `city_analysis` execution (City Pain Scan) audits **a citywide, category-agnostic set of businesses** — up to 15 businesses across at least 5 categories, ranked by pain. The output JSON has this structure:

```
city:                  "Plainfield"
state:                 "Indiana"
audit_date:            "2026-07-30"
summary:               one-paragraph executive summary
city_metrics:          { businesses_analyzed, categories_analyzed, average_pain_score, high_priority_businesses }
categories[]:          [{ category, average_pain_score, businesses[] }]   -- businesses nested per category
businesses[]:          up to 15 ranked businesses (top-level ranked list), each:
    rank:              1-15
    business_name:     string
    category:          string
    google:            { status: "claimed"|"unclaimed"|"likely_claimed"|"unable_to_verify",
                         rating: number|null, reviews: number|null }
    yelp:              { rating: number|null, reviews: number|null }
    facebook:          { rating: number|null, reviews: number|null }
    website:           { status: "working"|"broken"|"none"|"social_only", mobile_friendly: "yes"|"no"|"unknown" }
    nap:               { status: "consistent"|"minor_inconsistencies"|"major_inconsistencies" }
    review_metrics:    { unanswered_reviews: number|null, negative_unanswered: number|null,
                         positive_unanswered: number|null, oldest_unanswered_review: date|null }
    negative_themes[]: array of strings
    pain_score:        integer 0-10
    priority:          string (e.g., "High Priority", "Low")
    recommended_tier:  "tier_1" | "tier_2" | "tier_3"
    estimated_monthly_fee: { minimum: number, maximum: number }
top_prospects[]:       five best sales prospects (ranked)
```

This maps directly to campaign + audit fields (see §25a field mapping). The existing `CategoryAnalysisAuditCard` handles a *different* output format (`market_analysis` wrapper with `top_5_competitors`) — City Pain Scan needs its own renderer.

**Key simplifications from prior schema iterations:**
- `pain_score` is a plain integer 0-10 (not a decimal object) — matches the existing `Int` column, **no rounding needed**
- `priority` is a string (not a boolean) — parsed for hotness derivation
- No `data_quality` block per business — the prompt says "return null if unavailable"; sync gating is null-based (null values don't overwrite)
- No `phone` or `website.url` per business — website is `{status, mobile_friendly}` only, no URL. Contact field integration with Sprint 1 is via GBP enrichment (Sprint 1 Task 2), not via City Pain Scan.
- `negative_themes[]` is an array of strings (not `{theme, frequency}` objects)
- `nap` is just `{status}` (no name/address/phone breakdown)
- No `ownership_type` — national chain filtering is not possible from this schema

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **City Pain Scan → per-business audit storage** | When a `city_analysis` execution completes, each business in the `businesses[]` array is stored as a separate `mkt_audits_list` row (`platform = 'city_analysis'`, `audit_data = {per-business JSON}`) on the matched campaign |
| **City Pain Scan → campaign field sync** | Structured fields from each business's JSON sync onto the matched campaign: `pain_score`, `estimated_tier`, `estimated_fee_cents`, `gbp_claimed`, `has_website`, `nap_consistent`, `unaddressed_reviews` — null-gated (null values in JSON don't overwrite existing campaign data) |
| **Hot-prospect signal** | A campaign is "hot" when the business appears in `top_prospects[]` OR has `priority` containing "High" OR `pain_score >= threshold` (default 7) OR `recommended_tier == 'tier_1'`. Stored as `is_hot_prospect` + `hot_prospect_reason` + `hot_prospect_set_at`. Fallback: static `pain_score >= threshold` at intake. |
| **Category-level intelligence** | `categories[]` (with per-category average pain + nested businesses) and `city_metrics` are stored as a city-level audit for category-level outreach planning |
| **Auto-follow-up scheduler** | A job that, for hot prospects in `preview_built`/`shown` whose latest contact had a no-response outcome and whose `next_follow_up_at` is null/past, schedules the next follow-up at the configured cadence (default 3 days) by writing a new outreach log entry with `outcome = 'auto_follow_up_scheduled'` and a `follow_up_date` |
| **Cadence + cap config** | Configurable follow-up interval (default 3d) and max auto-follow-ups before deprioritization (default 5) — after the cap, the campaign is flagged `hot_prospect_deprioritized` and the auto-scheduler stops |
| **Operator override** | Operator can manually mark a campaign `not_hot` (deprioritize) or `hot` (force) regardless of analysis; auto-scheduler respects the override |
| **City Pain Scan audit rendering** | New `CityAnalysisAuditCard` component renders each per-business audit in the Audits tab (parallel to the existing `CategoryAnalysisAuditCard` for market-level analysis) |
| **Visibility** | Hot-prospect badge on the campaign + list; auto-scheduled follow-ups are distinguishable from manual ones (outcome `auto_follow_up_scheduled`) so operators see the system is pursuing on their behalf |

### Why a separate sprint

Auto-scheduling introduces a background job, a multi-business sync hook into the execution completion path, a deprioritization lifecycle, and a new audit renderer — each with its own edge cases (matching up to 15 businesses to campaigns, null-gated field sync, priority string parsing, cadence vs. auto-advance interaction, cap behavior). Coupling this into Sprint 2 would delay the manual outreach tracking, which is the higher-frequency operator need. Sprint 3 is small but has enough moving parts to warrant isolation and its own acceptance tests.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer
**Depends on:** Sprint 2 (outreach log + `next_follow_up_at` rollup + `buildFreshSnapshot`), City Pain Scan being run (existing `city_analysis` prompt type)

---

## 24. Gap Analysis — Current State

### What exists today

- **`pain_score`** on `mkt_campaigns_list` (schema line 6104) — `Int @default(0)`. Static, set at intake. Never updated from City Pain Scan results. The production prompt produces `pain_score` as an integer 0-10, which matches the column type — no schema mismatch.
- **`city_analysis` prompt type** (`MarketingPromptService.ts` line 19) — executions produce a multi-business ranked audit JSON (up to 15 businesses, categories, top prospects) stored in `mkt_prompt_executions_list.raw_output` / `filtered_output`. **Not synced to campaigns.** Not stored as audits. Not rendered.
- **`category_analysis` audit pattern** — `CategoryAnalysisAuditCard` renders audits where `platform === 'category_analysis'` and `audit_data` has a `market_analysis` wrapper (competitors, pain points, outreach angle). This is a **different** JSON structure from City Pain Scan — City Pain Scan needs its own renderer.
- **`campaign.state`** — referenced in `MarketingExecutionService.ts` line 233 (`state: campaign.state || ''`) but **does not exist** in the Prisma schema or the web `Campaign` interface. At runtime it's `undefined`, silently producing `''`. City Pain Scan output includes `state` at the top level (e.g., "Indiana") — needed for matching (Plainfield, IN vs Plainfield, NJ).
- **Audit creation route** — `POST /:campaignId/audits` already exists with `platform` + `audit_data` + count fields. Storing per-business City Pain Scan audits requires no new route, just a new `platform` value and a sync call per matched business.
- **No auto-follow-up mechanism** — Sprint 2 adds manual follow-up scheduling only.

### What's missing

| # | Gap | Impact |
|---|-----|--------|
| H1 | No `is_hot_prospect` flag on campaign | Operators can't filter/sort by hotness; no input for automation |
| H2 | City Pain Scan results don't sync to campaigns | Multi-business audit JSON (GBP, website, NAP, pain score, priority, tier, fee) sits in execution output, never reaches campaign records or audits table |
| H3 | No `city_analysis` audit rendering | The per-business audit JSON has no UI card (unlike `category_analysis` which has `CategoryAnalysisAuditCard`) |
| H4 | No `state` column on campaign | City matching can't disambiguate same-name cities across states; `campaign.state` is a dead reference |
| H5 | No auto-follow-up scheduler | No-response contacts on hot prospects fall silent unless the operator manually re-schedules |
| H6 | No deprioritization lifecycle | Without a cap, auto-follow-ups could run forever on a prospect that will never convert |
| H7 | No operator override on hotness | Operator judgment has no place to be recorded |
| H8 | No category-level intelligence storage | `categories[]` (with per-category average pain + nested businesses) and `city_metrics` from the scan have no home — valuable for category-scope campaign planning |

---

## 25. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│           City Pain Scan execution (existing)                       │
│   city_analysis prompt runs → ChatGPT/external AI                   │
│   → mkt_prompt_executions_list.raw_output / filtered_output         │
│      (MULTI-BUSINESS audit JSON: up to 15 businesses across 5+      │
│       categories, top_prospects, city_metrics, categories[])        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ NEW: post-execution sync hook
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│         MarketingHotProspectService.syncFromExecution()             │
│   1. Parse execution output JSON                                    │
│   2. Extract city + state (matching keys from top level)            │
│   3. For each business in businesses[] (up to 15):                  │
│      a. Match business_name + city + state → campaign               │
│      b. Store per-business JSON as mkt_audits_list row              │
│         (platform='city_analysis', audit_data={business JSON})      │
│      c. Sync structured fields onto campaign (null-gated)           │
│      d. Derive hotness: in top_prospects[] OR priority contains     │
│         "High" OR pain_score>=7 OR tier=='tier_1'                   │
│         → set is_hot_prospect, hot_prospect_reason,                 │
│           hot_prospect_set_at                                       │
│   4. Store categories[] + city_metrics as a city-level audit        │
│      (platform='city_analysis_summary')                             │
│   5. Return sync report: { matched: N, unmatched: M, hot: K }       │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              mkt_campaigns_list (extended)                          │
│   + state                    VARCHAR(50)  NULL  (NEW — was missing)  │
│   + is_hot_prospect           BOOL      default false               │
│   + hot_prospect_reason       VARCHAR   NULL                        │
│   + hot_prospect_set_at       TIMESTAMPTZ NULL                      │
│   + hot_prospect_deprioritized BOOL     default false               │
│   + auto_followup_count       INT       default 0                   │
│   (pain_score is Int; City Pain Scan produces Int 0-10 — no rounding)│
└──────────────────┬──────────────────────────────────────────────────┘
                   │ read by
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Auto-follow-up scheduler job (NEW)                     │
│   for each campaign WHERE is_hot_prospect AND NOT deprioritized     │
│     AND stage IN (preview_built, shown)                             │
│     AND latest contact outcome IN (no_answer, left_message,         │
│         callback_scheduled with follow_up past & no newer contact)  │
│     AND next_follow_up_at IS NULL OR < today                        │
│   → write outreach log: outcome='auto_follow_up_scheduled',         │
│       follow_up_date = today + cadence (default 3d)                 │
│   → increment auto_followup_count; if >= cap, set deprioritized     │
└─────────────────────────────────────────────────────────────────────┘
```

### 25a. Field Mapping — City Pain Scan JSON → Campaign + Audit

For each business in `businesses[]`, map to the matched campaign + a new audit row:

| JSON path (per business) | Campaign field | Audit field | Sync rule |
|--------------------------|---------------|-------------|-----------|
| `business_name` | `business_name` | — | Set if campaign `business_name` is null |
| `category` | `category` | — | Must match (matching key) |
| `google.reviews` | — | `review_count` | Always sync to audit (even if null) |
| `google.rating` | — | `average_rating` | Always sync to audit |
| `google.status` | `gbp_claimed` | `claimed` | Map `claimed`/`likely_claimed` → true; `unclaimed` → false; `unable_to_verify` → leave unchanged. Sync if non-null. |
| `review_metrics.unanswered_reviews` | `unaddressed_reviews` | `unaddressed_reviews` | Sync if non-null (null = unavailable, don't overwrite) |
| `review_metrics.negative_unanswered` | — | — | Stored in audit_data only |
| `review_metrics.oldest_unanswered_review` | `last_review_date` | — | Sync if non-null |
| `website.status` | `has_website` | `active_page` | Map `working` → 'yes'; `broken` → 'broken'; `none` → 'none'; `social_only` → 'social'. Sync if non-null. |
| `website.mobile_friendly` | — | `mobile_friendly` | Map `yes` → true; `no` → false; `unknown` → null. Sync to audit. |
| `nap.status` | `nap_consistent` | — | Map `consistent` → true; `minor_inconsistencies`/`major_inconsistencies` → false. Sync if non-null. |
| `pain_score` | `pain_score` | — | Sync always (integer 0-10, matches column type — no rounding) |
| `recommended_tier` | `estimated_tier` | — | Sync always (e.g., `tier_1`) |
| `estimated_monthly_fee.minimum` | `estimated_fee_cents` | — | Use minimum × 100 for cents; sync if non-null |
| `priority` | — | — | Hotness input (parsed for "High" keyword) |
| `rank` | — | — | Stored in audit_data; used in hot_prospect_reason |
| `negative_themes[]` | — | — | Stored in audit_data only |

**Top-level fields (not per-business):**

| JSON path | Storage | Sync rule |
|-----------|---------|-----------|
| `top_prospects[]` | Drives hotness — each prospect matched to a campaign gets `is_hot_prospect = true` | Primary hotness signal |
| `categories[]` | Stored as a city-level audit (`platform = 'city_analysis_summary'`) with `audit_data = {categories, city_metrics, summary, city, state, audit_date}` | Category-level intelligence for outreach planning |
| `city_metrics` | Stored in the same city-level summary audit | Aggregate metrics |
| `summary` | Stored in the same city-level summary audit | Executive summary |
| `city` / `state` / `audit_date` | Stored in the same city-level summary audit | Audit provenance |

**Null-gated sync rule:** The production prompt says "If information is unavailable, return null." Sync rules:
- **Non-null values** → sync to campaign (overwrite existing, since City Pain Scan is the freshest data source)
- **Null values** → do NOT overwrite existing campaign values (null means "unavailable", not "doesn't exist")
- **Exception:** `pain_score`, `estimated_tier` → always sync (these are the AI's core assessment, always present in the output)

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **City Pain Scan = up to 15 businesses per execution** | Production prompt confirms this (`businesses[]` array, max 15). Sync is 1:many — each business syncs to its own matched campaign. |
| **Per-business audits, not one giant audit** | Each business gets its own `mkt_audits_list` row linked to its campaign, so Sprint 2's `buildFreshSnapshot` can read the latest per-business audit for fresh data, and the Audits tab shows per-business cards. The full city-level data (categories, metrics, summary) is stored as a separate summary audit. |
| **`top_prospects[]` is the primary hotness signal** | The AI has already ranked the strongest prospects citywide — this is richer than just pain_score threshold. Being in top_prospects = hot. |
| **`priority` string parsed for "High"** | The prompt produces `priority` as a string (e.g., "High Priority"). Parse case-insensitively for "high" to derive hotness. Simpler than a boolean. |
| **No contact field integration with Sprint 1** | The production schema has no `phone` or `website.url` per business — website is `{status, mobile_friendly}` only. Contact fields come from Sprint 1's GBP enrichment (Task 2), not from City Pain Scan. |
| **`state` column added to campaign** | Required for matching (Plainfield IN vs NJ); also fixes the dead `campaign.state` reference in `MarketingExecutionService` line 233 |
| **`pain_score` is already Int 0-10** | The production prompt produces an integer, matching the existing `Int` column. No rounding, no schema change needed. |
| **Null-gated sync (not confidence-gated)** | The production schema has no `data_quality` block. The prompt says "return null if unavailable" — so null is the unavailability signal. Non-null values overwrite (fresh scan data); null values don't overwrite (preserve existing). Simpler than per-field confidence gating. |
| **Category-level intelligence stored as city-level summary audit** | `categories[]` (with per-category average pain + nested businesses) and `city_metrics` are city-wide. Stored as a separate `city_analysis_summary` audit. This enables category-scope campaign planning in a future sprint. |
| **`is_hot_prospect` denormalized onto campaign** | The execution is transient; hotness needs to persist for filtering, list badges, and the scheduler query without re-parsing execution output each time |
| **Auto-follow-ups write real outreach log entries** | Reuses Sprint 2's rollup + dashboard machinery entirely; the only difference is `outcome = 'auto_follow_up_scheduled'` and `contacted_by = 'system'`. Operators see and can edit them like any manual entry. |
| **Cap + deprioritization** | Prevents infinite auto-pursuit. After `max_auto_followups` (default 5) the campaign is flagged `hot_prospect_deprioritized`; the scheduler skips it. Operator can clear the flag to resume. |
| **Operator override always wins** | If operator sets `is_hot_prospect = false` manually, the sync does not re-set it true unless the next scan produces a fresh positive signal (in top_prospects, or priority "High", or pain >= 7, or tier_1) for that business (prevents flapping). |

---

## 26. Schema Migration

```sql
-- ============================================================
-- STEP 1: state column (was missing — fixes dead campaign.state ref)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS state VARCHAR(50);

-- ============================================================
-- STEP 2: Hot-prospect + auto-follow-up columns
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS is_hot_prospect            BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hot_prospect_reason       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS hot_prospect_set_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hot_prospect_deprioritized BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_followup_count       INT          NOT NULL DEFAULT 0;

-- Backfill hotness from existing pain_score (fallback path)
UPDATE mkt_campaigns_list
  SET is_hot_prospect = true,
      hot_prospect_reason = 'pain_score >= 7 (backfill)',
      hot_prospect_set_at = NOW()
  WHERE pain_score >= 7 AND is_hot_prospect = false;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_hot_prospect
  ON mkt_campaigns_list(is_hot_prospect, stage)
  WHERE is_hot_prospect = true AND hot_prospect_deprioritized = false;
```

**Note on `pain_score`:** Stays `Int`. The production City Pain Scan prompt produces `pain_score` as an integer 0-10, which matches the column type. No rounding or schema change needed.

### Prisma Sync

After migration, run `npx prisma db pull && npx prisma generate` to sync `state` + the five hot-prospect columns.

### Config additions

Add to `unifiedConfig` (marketing ops section):
```typescript
marketingOps: {
  hotProspect: {
    painScoreThreshold: 7,        // campaign is hot if pain_score >= this (fallback path)
    autoFollowUpCadenceDays: 3,   // schedule next follow-up this many days out
    maxAutoFollowUps: 5,          // cap before deprioritization
    schedulerIntervalHours: 6,    // how often the scheduler job runs
  },
}
```

### Rollback

```sql
ALTER TABLE mkt_campaigns_list
  DROP COLUMN IF EXISTS is_hot_prospect,
  DROP COLUMN IF EXISTS hot_prospect_reason,
  DROP COLUMN IF EXISTS hot_prospect_set_at,
  DROP COLUMN IF EXISTS hot_prospect_deprioritized,
  DROP COLUMN IF EXISTS auto_followup_count,
  DROP COLUMN IF EXISTS state;
DROP INDEX IF EXISTS idx_mkt_campaigns_hot_prospect;
```

---

## 27. Tasks

### Task 15: Backend — `MarketingHotProspectService` + City Pain Scan sync

| Sub-Task | File | Description |
|----------|------|-------------|
| Create service | `apps/api/src/services/MarketingHotProspectService.ts` (NEW) | Singleton extends `BaseService`. Methods: `syncFromExecution(executionId, ctx)`, `setHot(campaignId, reason, ctx)`, `setNotHot(campaignId, ctx)`, `clearDeprioritized(campaignId, ctx)`, `listHotProspects({ stage?, city?, state?, category? }, ctx)`, `evaluatePainScoreFallback(campaignId, ctx)` |
| `syncFromExecution` — parse | `apps/api/src/services/MarketingHotProspectService.ts` | Load the execution's `filtered_output` (fallback to `raw_output`); parse the City Pain Scan JSON. Extract top-level `city`, `state`, `audit_date`, `summary`, `city_metrics`, `categories[]`, `businesses[]` (up to 15), `top_prospects[]`. |
| `syncFromExecution` — iterate businesses | `apps/api/src/services/MarketingHotProspectService.ts` | For each business in `businesses[]`: (a) match to campaign by `business_name ILIKE business.business_name AND city ILIKE scan.city AND category ILIKE business.category` (+ state if available); (b) store per-business audit; (c) sync fields (null-gated); (d) derive hotness. Collect a sync report: `{ matched: [{campaignId, businessName, hot}], unmatched: [{businessName, reason}] }`. |
| `syncFromExecution` — per-business audit storage | `apps/api/src/services/MarketingHotProspectService.ts` | For each matched business, create an `mkt_audits_list` row: `platform = 'city_analysis'`, `campaign_id = matched`, `audit_data = {full business JSON}`, `review_count` from `business.google.reviews`, `average_rating` from `business.google.rating`, `unaddressed_reviews` from `business.review_metrics.unanswered_reviews`, `claimed` from `business.google.status` (mapped), `active_page` from `business.website.status` (mapped), `mobile_friendly` from `business.website.mobile_friendly` (mapped). |
| `syncFromExecution` — per-business field sync | `apps/api/src/services/MarketingHotProspectService.ts` | Per the field mapping table (§25a): sync `pain_score` (integer, no rounding), `estimated_tier`, `estimated_fee_cents` (from `estimated_monthly_fee.minimum × 100`, if non-null), `gbp_claimed` (from `google.status`, if non-null), `has_website` (from `website.status`, if non-null), `nap_consistent` (from `nap.status`, if non-null), `unaddressed_reviews` (if non-null), `last_review_date` (from `review_metrics.oldest_unanswered_review`, if non-null), `state` (if campaign state is null). **Null-gated:** null values in the JSON do NOT overwrite existing campaign values. |
| `syncFromExecution` — hotness derivation | `apps/api/src/services/MarketingHotProspectService.ts` | For each matched business, set `is_hot_prospect = true` if ANY: business appears in `top_prospects[]` (by name match) OR `business.priority` contains "High" (case-insensitive) OR `business.pain_score >= threshold` OR `business.recommended_tier == 'tier_1'`. Set `hot_prospect_reason = 'City Pain Scan rank #{rank}: pain={pain_score}, tier={tier}, priority={priority}'` and `hot_prospect_set_at = now`. If none of the signals fire, do NOT unset existing hotness. |
| `syncFromExecution` — city-level summary audit | `apps/api/src/services/MarketingHotProspectService.ts` | Store `categories[]` + `city_metrics` + `summary` + `city` + `state` + `audit_date` as a single audit row with `platform = 'city_analysis_summary'`. If a city-scope campaign exists for this city+state, attach to it; otherwise store as execution metadata (logged + retrievable via the execution record). This preserves category-level intelligence for future category-scope campaign planning. |
| `syncFromExecution` — sync report | `apps/api/src/services/MarketingHotProspectService.ts` | Return `{ executionId, city, state, businessesInOutput, matched, unmatched, hotProspectsMarked, summaryStored }`. Log the full report for operator visibility. |
| `setHot` / `setNotHot` | `apps/api/src/services/MarketingHotProspectService.ts` | Operator override endpoints. `setNotHot` records `hot_prospect_reason = 'operator_override'`. |
| `clearDeprioritized` | `apps/api/src/services/MarketingHotProspectService.ts` | Resets `hot_prospect_deprioritized = false` and `auto_followup_count = 0` so the scheduler resumes. |
| `evaluatePainScoreFallback` | `apps/api/src/services/MarketingHotProspectService.ts` | If no city_analysis audit exists for the campaign and `pain_score >= threshold`, set hot with reason `pain_score >= {threshold} (fallback)`. Called on campaign create/update. |

### Task 16: Backend — Hook City Pain Scan execution to sync

| Sub-Task | File | Description |
|----------|------|-------------|
| Locate execution completion path | `apps/api/src/services/MarketingExecutionService.ts` | Find where `city_analysis` executions finalize (status → `completed` / `reviewed`) |
| Call sync hook | `apps/api/src/services/MarketingExecutionService.ts` | After a `city_analysis` execution completes successfully, call `MarketingHotProspectService.syncFromExecution(executionId, ctx)`. Best-effort: catch + log errors, do not fail the execution. Log the sync report (`matched: N, unmatched: M, hot: K`) for operator visibility. |
| Note on `category_analysis` | — | `category_analysis` executions produce a different JSON structure (`market_analysis` wrapper with competitors/pain points) and are NOT hooked to hot-prospect sync this sprint — they analyze a market, not individual businesses. Future sprint may derive hotness from market-level pain points. |

### Task 17: Backend — Auto-follow-up scheduler job

| Sub-Task | File | Description |
|----------|------|-------------|
| Create scheduler | `apps/api/src/services/MarketingAutoFollowUpScheduler.ts` (NEW) | Singleton extends `BaseService`. Method: `run(ctx)`. Designed to be invoked by the existing job runner on `schedulerIntervalHours`. |
| `run` logic | `apps/api/src/services/MarketingAutoFollowUpScheduler.ts` | Query campaigns WHERE `is_hot_prospect = true AND hot_prospect_deprioritized = false AND stage IN (preview_built, shown)`. For each, fetch the latest outreach log entry; if its outcome is a no-response type (`no_answer`, `left_message`, or `callback_scheduled` whose `follow_up_date` is past with no newer contact) AND (`next_follow_up_at IS NULL` OR `next_follow_up_at < today`): write a new outreach log via `MarketingOutreachService.logContact` with `outcome = 'auto_follow_up_scheduled'`, `contact_channel = last_contact_channel`, `contact_date = today`, `follow_up_date = today + cadenceDays`, `contacted_by = 'system'`, `notes = 'Auto-scheduled follow-up (hot prospect, attempt {n})'`. Increment `auto_followup_count`; if `>= maxAutoFollowUps`, set `hot_prospect_deprioritized = true` and log. |
| Idempotency | `apps/api/src/services/MarketingAutoFollowUpScheduler.ts` | Before writing, check no `auto_follow_up_scheduled` entry exists for the campaign with `follow_up_date >= today` — prevents duplicate scheduling if the job runs twice. |
| Register with job runner | (existing scheduler registration site) | Add the job at `schedulerIntervalHours` cadence (default 6h) |

### Task 18: Backend — Routes

| Sub-Task | File | Description |
|----------|------|-------------|
| Add hot-prospect routes | `apps/api/src/routes/marketing-ops.ts` | `PUT /:id/hot-prospect` (body `{ isHot: boolean, reason?: string }`), `POST /:id/clear-deprioritized`, `GET /hot-prospects` (list, with stage/city/category filters) |
| Zod schemas | `apps/api/src/routes/marketing-ops.ts` | `isHot: z.boolean()`, `reason: z.string().max(255).optional()` |
| Extend `getCampaign` response | `apps/api/src/services/MarketingCampaignService.ts` | The five new columns flow through automatically via `findUnique`; verify the `...rest` spread includes them |

### Task 19: Frontend — Types + service client

| Sub-Task | File | Description |
|----------|------|-------------|
| Extend `Campaign` interface | `apps/web/src/services/MarketingOpsService.ts` | Add `is_hot_prospect?: boolean`, `hot_prospect_reason?: string \| null`, `hot_prospect_set_at?: string \| null`, `hot_prospect_deprioritized?: boolean`, `auto_followup_count?: number` |
| Add service methods | `apps/web/src/services/MarketingOpsService.ts` | `setHotProspect(campaignId, { isHot, reason })`, `clearDeprioritized(campaignId)`, `listHotProspects(filters)` |

### Task 20: Frontend — Hot-prospect badge + override UI

| Sub-Task | File | Description |
|----------|------|-------------|
| Hot-prospect badge in campaign header | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (header, near the StageBadge) | Flame icon + "Hot Prospect" badge when `is_hot_prospect && !deprioritized`; muted "Deprioritized" badge when `hot_prospect_deprioritized`. Tooltip shows `hot_prospect_reason` + set date. |
| Override controls | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (Overview, near Outreach card) | Two small buttons: "Mark not hot" / "Mark hot" (toggle), and "Resume auto-follow-ups" (visible only when deprioritized, calls `clearDeprioritized`). |
| Hot-prospect badge on campaigns list | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/page.tsx` | Flame icon on rows where `is_hot_prospect`. Add a "Hot prospects" quick filter chip. |
| Auto-scheduled entries distinguished in Outreach card | `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` (Sprint 2) | Render `outcome = 'auto_follow_up_scheduled'` entries with a "System" tag + muted styling vs. operator-logged entries, so the operator sees which follow-ups the system scheduled on their behalf |

### Task 21: Frontend — Hot prospects dashboard view

| Sub-Task | File | Description |
|----------|------|-------------|
| Add hot-prospects section to dashboard | `apps/web/src/app/(platform)/settings/admin/marketing-ops/page.tsx` | New widget/section: "Hot Prospects ({n})" listing hot prospects by stage with their `auto_followup_count` / `maxAutoFollowUps` progress and next follow-up date. Click-through to filtered campaigns list. |

### Task 22: Frontend — `CityAnalysisAuditCard` component

| Sub-Task | File | Description |
|----------|------|-------------|
| Create `CityAnalysisAuditCard` | `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx` (NEW) | Renders audits where `platform === 'city_analysis'` and `audit_data` has the City Pain Scan per-business structure (`rank`, `business_name`, `category`, `google`, `yelp`, `facebook`, `website`, `nap`, `review_metrics`, `negative_themes`, `pain_score`, `priority`, `recommended_tier`, `estimated_monthly_fee`). Parallel to the existing `CategoryAnalysisAuditCard` which handles the `market_analysis` wrapper. |
| Card layout | `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx` | Sections: (1) Header (rank #, business name, category, priority badge — red if "High Priority", gray otherwise); (2) Platform ratings table (Google / Yelp / Facebook — rating + review count, with "N/A" badges where null); (3) GBP status (claimed/unclaimed/likely/unable_to_verify badge); (4) Website assessment (status badge: working/broken/none/social_only + mobile_friendly badge); (5) NAP consistency (status badge: consistent/minor/major); (6) Review metrics (unanswered reviews, negative unanswered, positive unanswered, oldest unanswered date — with "N/A" where null); (7) Negative themes (list of strings); (8) Pain score (integer 0-10 badge, color-coded: 0-3 green/low, 4-6 amber/medium, 7-8 orange/high, 9-10 red/critical); (9) Recommended tier (tier_1/tier_2/tier_3 badge + fee range) |
| Wire into Audits tab | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (Audits tab, line ~430) | Alongside the existing `CategoryAnalysisAuditCard` conditional, add: if `audit.platform === 'city_analysis' && audit.audit_data`, render `CityAnalysisAuditCard`. The existing audit loop already iterates all audits — just add the conditional branch. |
| Action buttons | `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx` | "Copy summary" (copies the city-level `summary` from the associated city_analysis_summary audit if available — the one-paragraph narrative is the outreach hook); "Save to campaign notes" (appends pain score + tier + priority + negative themes to `campaign.notes`); "Re-sync to campaign" (calls `syncFromExecution` again to re-sync fields — useful after editing the execution output) |

---

## 28. API Contract

### `PUT /api/admin/marketing-ops/:id/hot-prospect`

**Request:** `{ "isHot": false, "reason": "Operator assessed as cold despite high pain score" }`

**Response 200:** the updated campaign with the five hot-prospect fields.

### `POST /api/admin/marketing-ops/:id/clear-deprioritized`

**Response 200:** `{ "is_hot_prospect": true, "hot_prospect_deprioritized": false, "auto_followup_count": 0 }`

### `GET /api/admin/marketing-ops/hot-prospects?stage=shown&city=Plainfield&state=Indiana`

**Response 200:**
```json
{
  "prospects": [
    {
      "campaign_id": "mc-1",
      "business_name": "Acme HVAC",
      "stage": "shown",
      "city": "Plainfield",
      "state": "Indiana",
      "category": "HVAC",
      "pain_score": 8,
      "estimated_tier": "tier_1",
      "hot_prospect_reason": "City Pain Scan rank #3: pain=8, tier=tier_1, priority=High Priority",
      "hot_prospect_set_at": "2026-07-29T10:00:00Z",
      "auto_followup_count": 2,
      "max_auto_followups": 5,
      "next_follow_up_at": "2026-08-01",
      "last_contacted_at": "2026-07-28"
    }
  ]
}
```

---

## 29. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC26 | `syncFromExecution` iterates the `businesses[]` array (up to 15) and matches each to a campaign by business_name + city + category (+ state if available) | Integration test: seed 3 campaigns + execution output with 3 matching businesses, run sync, assert 3 matched |
| AC27 | A business in `top_prospects[]` gets `is_hot_prospect = true` with `hot_prospect_reason` including the rank | Integration test: seed campaign matching a top_prospects entry, run sync, assert hot + reason contains rank |
| AC28 | A business with `priority` containing "High" OR `pain_score >= 7` OR `recommended_tier == 'tier_1'` gets `is_hot_prospect = true` even if not in top_prospects | Integration test: seed business with pain 8 + priority "Low", not in top_prospects, run sync, assert hot |
| AC29 | A business with `pain_score: 3`, `priority: "Low"`, `tier: "tier_3"`, not in top_prospects does NOT set hotness | Integration test: run sync, assert `is_hot_prospect` unchanged |
| AC30 | Each matched business gets a per-business `mkt_audits_list` row with `platform = 'city_analysis'` and the full business JSON in `audit_data` | Integration test: run sync with 3 matches, GET audits for each campaign, assert 3 city_analysis audits |
| AC31 | `syncFromExecution` syncs structured fields: `pain_score` (integer, no rounding), `estimated_tier`, `gbp_claimed`, `has_website`, `nap_consistent` | Integration test: run sync, GET campaign, assert fields match expected mapping |
| AC32 | Null-gated sync: null values in the JSON do NOT overwrite existing campaign values; non-null values do overwrite | Unit test: campaign with `unaddressed_reviews = 5`, sync with null `review_metrics.unanswered_reviews`, assert stays 5; sync with non-null 14, assert updated to 14 |
| AC33 | `pain_score` is an integer 0-10 in the output and syncs directly to the `Int` column with no rounding | Unit test: verify integer passthrough |
| AC34 | City-level intelligence (`categories[]`, `city_metrics`, `summary`) is stored as a `city_analysis_summary` audit | Integration test: run sync, query for summary audit, assert present with categories + metrics data |
| AC35 | A campaign with `pain_score >= 7` and no city_analysis audit is marked hot on create/update via the fallback path | Unit test on `evaluatePainScoreFallback` |
| AC36 | The auto-follow-up scheduler, when run against a hot prospect in `shown` whose latest contact was `no_answer` with no future follow-up, writes a new outreach log entry with `outcome = 'auto_follow_up_scheduled'` and `follow_up_date = today + cadenceDays` | Unit test on `MarketingAutoFollowUpScheduler.run` with mocked clock |
| AC37 | The scheduler increments `auto_followup_count` and, upon reaching `maxAutoFollowUps`, sets `hot_prospect_deprioritized = true` and stops scheduling | Unit test: run scheduler `maxAutoFollowUps + 1` times, assert deprioritized set and no further entries |
| AC38 | A deprioritized hot prospect is skipped by the scheduler until `clearDeprioritized` is called | Unit test: deprioritized campaign, run scheduler, assert no new log entry |
| AC39 | The scheduler is idempotent — running twice in one day does not create duplicate `auto_follow_up_scheduled` entries | Unit test: run twice, assert one entry |
| AC40 | Operator "Mark not hot" sets `is_hot_prospect = false`; the scheduler skips; a subsequent City Pain Scan sync does NOT re-set it true unless the new scan produces a fresh positive signal for that business | Integration test: override, run sync with business at pain 3, assert stays false; run sync with same business at pain 8, assert true |
| AC41 | Auto-scheduled follow-up entries appear in the Outreach card with a "System" tag distinct from operator-logged entries | Manual: trigger scheduler on a seeded hot prospect, open campaign, verify card |
| AC42 | A hot prospect with a future auto-scheduled `next_follow_up_at` is not auto-lost by the Sprint 2 7-day job | Integration test: hot prospect + future auto follow-up, run auto-advance job, assert stage unchanged |
| AC43 | The hot-prospects dashboard view shows correct counts and per-prospect auto-follow-up progress | Manual: seed hot prospects at various `auto_followup_count`, verify view |
| AC44 | `clearDeprioritized` resets `auto_followup_count = 0` and `hot_prospect_deprioritized = false`, and the scheduler resumes on next run | API test + unit test |
| AC45 | The `CityAnalysisAuditCard` renders all per-business sections (rank, platforms, GBP status, website, NAP, review metrics, themes, pain score, priority, tier, fee) in the Audits tab | Manual: seed a city_analysis audit, open campaign Audits tab, verify all sections render |
| AC46 | The pain score badge is color-coded by classification (0-3 green, 4-6 amber, 7-8 orange, 9-10 red) and the priority badge is red when "High Priority" | Manual: verify in the card from AC45 |
| AC47 | When no campaign matches a business in `businesses[]`, sync logs the miss in the sync report and does not create a campaign or throw | Unit test: run sync with unmatched business, assert `unmatched` array populated + no throw |
| AC48 | Sprint 2's `buildFreshSnapshot` reads the latest `city_analysis` audit's `audit_data` for fresh review counts/ratings | Integration test: create city_analysis audit, call `buildFreshSnapshot`, assert snapshot reflects audit values |
| AC49 | The sync report returns `{ matched, unmatched, hotProspectsMarked, summaryStored }` counts for operator visibility | Integration test: run sync, assert report structure |

---

## 30. Out of Scope (Sprint 3)

| Item | Why deferred |
|------|--------------|
| **Push notifications** to operator when an auto-follow-up is scheduled | Passive dashboard visibility suffices; push is the notification-infrastructure sprint |
| **Auto-drafting the follow-up message content** | Sprint 2 captures the message snapshot for manual entries; auto-entries leave `message_snapshot` null (operator composes the actual message when they action the follow-up). AI-drafted follow-ups are a future enhancement. |
| **Hot-prospect decay** (auto-cooling hotness after N days with no scan refresh) | Adds a time-decay model; for v1 hotness persists until operator override or deprioritization. Revisit if hot-prospect list grows stale. |
| **Multi-cadence by channel** (e.g., phone follow-ups every 2d, email every 5d) | Single cadence for v1; channel-aware cadence is a tuning enhancement once usage data exists |
| **Hot-prospect scoring model** (weighted combination of pain_score, scan rank, response history) | Binary hot/not-hot for v1; a scored model is a future analytics sprint |
| **Auto-creating campaigns for unmatched businesses** in City Pain Scan | Sync logs misses for v1; an "Import unmatched as new campaigns" bulk action is a follow-up (§33.7) |
| **City-scope campaign auto-creation** for category-level audit storage | Category-level intelligence stored as execution metadata for v1; city-scope campaign creation is a follow-up (§33.8) |

---

## 31. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| City Pain Scan output format varies between AI providers → sync mis-parses | `syncFromExecution` parses defensively; validates required fields (`businesses[]`, `pain_score` per business); logs parse failures with the raw output for operator review. The production City Pain Scan prompt is the reference schema. |
| Up to 15 businesses matched per execution → bulk sync performance | Sync processes businesses sequentially with per-business try/catch; a single business failure doesn't abort the batch. Sync report shows matched/unmatched counts. |
| Name + city + category matching collisions (two "Corner Store" in Plainfield) | Matching includes `category` as a third key; `state` disambiguates further once the column exists. If multiple campaigns match, sync updates all and logs the ambiguity. Operator resolves via override. |
| Null values in scan output interpreted as "no data" vs "zero" | The prompt says "return null if unavailable" — null means unavailable, not zero. Null-gated sync (§25a) preserves existing campaign values when scan fields are null. Non-null values (including 0) overwrite. |
| Auto-follow-ups annoy prospects (too frequent) | Default cadence 3d is conservative; configurable; cap of 5 prevents infinite pursuit; operator can mark not-hot anytime |
| Scheduler + auto-advance interaction causes premature `lost` | AC42 explicitly guards: future auto follow-up blocks auto-loss; only deprioritized-and-stale prospects go `lost` |
| Hot-prospect list grows unbounded across multiple City Pain Scans | Deprioritization cap + operator override + future decay (out of scope) keep it bounded; dashboard shows count so bloat is visible |
| `top_prospects` matching by name is fuzzy | Match by `business_name ILIKE` with trim; log match confidence; if no match, the prospect is listed in the sync report's `unmatched` array for operator review |

---

## 32. File Inventory (Sprint 3)

**New files:**
- `apps/api/src/services/MarketingHotProspectService.ts`
- `apps/api/src/services/MarketingAutoFollowUpScheduler.ts`
- `apps/api/src/services/__tests__/MarketingHotProspectService.test.ts`
- `apps/api/src/services/__tests__/MarketingAutoFollowUpScheduler.test.ts`
- `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx`

**Modified files:**
- `apps/api/prisma/schema.prisma` (synced via `db pull` — `state` + 5 hot-prospect columns)
- `apps/api/src/config/unifiedConfig.ts` (`marketingOps.hotProspect` block)
- `apps/api/src/services/MarketingExecutionService.ts` (post-completion sync hook for `city_analysis`)
- `apps/api/src/services/MarketingCampaignService.ts` (pain-score fallback on create/update; `getCampaign` includes new columns)
- `apps/api/src/routes/marketing-ops.ts` (hot-prospect routes + validators)
- `apps/web/src/services/MarketingOpsService.ts` (types: `state`, hot-prospect fields; methods: `setHotProspect`, `clearDeprioritized`, `listHotProspects`)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (hot-prospect badge + override controls; `CityAnalysisAuditCard` in Audits tab)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/page.tsx` (list badge + hot filter)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/page.tsx` (hot-prospects dashboard section)
- `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` (system-tag styling for auto entries)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` (add `state` field to form — needed for City Pain Scan matching)

**Migration:**
- New SQL migration: `state` column + five hot-prospect columns + backfill from `pain_score` + index (§26)

---

## 33. Open Questions (Sprint 3)

1. **~~City Pain Scan output schema~~** — **RESOLVED (v3, final).** The production City Pain Scan prompt produces a **multi-business ranked audit** (up to 15 businesses across 5+ categories, with `top_prospects[]`, `categories[]`, and `city_metrics`). Each business in `businesses[]` has a per-business audit with `pain_score` (integer 0-10), `priority` (string), `recommended_tier`, `estimated_monthly_fee`, GBP/Yelp/Facebook metrics, website status, NAP status, and `negative_themes[]`. The structure is documented in §23 and mapped in §25a. The sync is 1:many (one execution → up to 15 campaigns), matched by `business_name + city + category` (+ `state` once added). The reference is the production City Pain Scan prompt (SaaS Version). Key simplifications from prior iterations: `pain_score` is an integer (no rounding), no `data_quality` block (null-gated sync instead), no per-business `phone`/`website.url` (contact fields come from Sprint 1 GBP enrichment), `priority` is a string (parsed for "High"), `negative_themes[]` is strings, `nap` is just `{status}`.
2. **`category_analysis` vs `city_analysis` scope** — this sprint hooks only `city_analysis` (City Pain Scan, multi-business). `category_analysis` produces a market-level `market_analysis` wrapper (competitors, pain points) already handled by `CategoryAnalysisAuditCard`. Should a future sprint also derive hotness from `category_analysis` market-level pain points (e.g., if a category has > 60% unclaimed GBPs, all businesses in that category are hot)? Recommend: yes, as a follow-up.
3. **Cadence tuning** — is 3 days the right default, or should it be stage-dependent (e.g., tighter in `shown` than `preview_built`)? Recommend single default for v1, tune post-usage.
4. **Deprioritization cap of 5** — confirm, or should it be higher/lower? Each auto-follow-up is one operator action to pursue, so 5 ≈ 15 days of pursuit at 3d cadence before the system gives up.
5. **Should auto-follow-ups also fire in `paid`/`delivered`?** Currently scoped to `preview_built`/`shown` (the prospecting stages). Chasing delivery confirmation in `paid` is arguably operator-manual. Confirm scope.
6. **`state` field on campaign form** — the `CampaignFormClient` needs a `state` input for City Pain Scan matching to work. Should it be a free-text field or a US state dropdown? Recommend dropdown (US states + Canadian provinces) since the platform is North American retail.
7. **Unmatched businesses in City Pain Scan** — when a business in `businesses[]` has no matching campaign, should the sync auto-create a `seek`-stage campaign for it? Currently the design logs the miss and does nothing. Auto-creation would turn every City Pain Scan into a campaign-creation event, which could be powerful but also noisy. Recommend: log misses for v1; add an "Import unmatched as new campaigns" bulk action in a follow-up.
8. **Category-scope campaign for city-level summary audit** — the `city_analysis_summary` audit (categories + city_metrics + summary) needs a campaign to attach to. If no city-scope campaign exists for the analyzed city, where does this audit go? Options: (a) auto-create a city-scope campaign, (b) store as execution metadata only, (c) attach to the first matched business's campaign with a flag. Recommend: (b) for v1 — store as execution metadata retrievable via `GET /prompts/executions/:id`; revisit city-scope campaign creation in a follow-up.
9. **`priority` string parsing** — the prompt produces `priority` as a string (e.g., "High Priority", "Low"). The sync parses this case-insensitively for "high" to derive hotness. Confirm the exact string values the AI produces — if it's always "High Priority" vs "Low", a simple includes("high") check suffices. If it varies more, a stricter parse may be needed. Recommend: log the actual `priority` values from the first few real scans to confirm the pattern.
