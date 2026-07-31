# Sprint Plan: Marketing Ops — Business Campaign Contact Details, Outreach Tracking, Hot-Prospect Follow-Up & Seek Audit Integration

**Document Version:** 1.7
**Date:** 2026-07-30
**Status:** Draft — Ready for Review
**Prerequisite:** Marketing Ops Sprint 1–4 complete (campaign pipeline, prompt workspace, deliverables, branding); Tenant Prospecting Channel sprint schema landed (`gbp_lookup_cache`, `gbp_lookup_cached_at` columns exist but are unpopulated)

This plan contains **five sprints**:
- **Sprint 1 (Part I, §§1–11):** Business Campaign Contact Details — make the campaign the source of truth for prospect contactability (phone / email / website / social), populated via GBP enrichment and manual intake, and rendered in the Overview.
- **Sprint 2 (Part II, §§12–22):** Outreach Tracking & Follow-Up Visibility — track each point of contact during `preview_built` and `shown` with a **message + fresh-data snapshot per contact** so historical contacts are reviewable in Ops; schedule follow-ups; surface overdue follow-ups at a glance.
- **Sprint 3 (Part III, §§23–33):** Hot-Prospect Auto-Follow-Up + City Pain Scan Sync — when recent contacts produce no response, automatically schedule the next follow-up *only* for businesses flagged as hot prospects from recent City Pain Scan analysis. Sprint 3 also closes the loop between City Pain Scan executions and the campaign record: the multi-business audit JSON (up to 15 businesses across 5+ categories, with per-business GBP status, website, NAP, digital opportunity score, high-attention flag, tier, fee estimate, data quality, and contact details) is parsed and synced onto matched campaigns as `city_analysis` audits, so the campaign is the single source of truth and Sprint 2's `buildFreshSnapshot` has real data to work with. The `top_opportunities` array from the scan is the primary hot-prospect signal.

Sprint 2 depends on Sprint 1 (outreach logging references the contact channels populated by Sprint 1). Sprint 3 depends on Sprint 2 (auto-scheduling writes into the same outreach log + `next_follow_up_at` rollup) and on scope scan analysis being run (existing `category_analysis` / `city_analysis` prompt types). Sprint 4 depends on Sprint 1 (contact field sync) and Sprint 3 (hot-prospect derivation logic + `MarketingHotProspectService` reuse).

- **Sprint 4 (Part IV, §§34–44):** Business-Scope Seek Audit Integration — register the production seek prompt's `business_analysis` output schema, build a `BusinessAnalysisAuditCard` renderer, sync seek audit fields onto the campaign (data_quality-gated, like Sprint 3's City Pain Scan sync), and derive hot-prospect signals from single-business seek audits. This closes the loop between seek-stage executions and the campaign record, complementing Sprint 3's citywide sync with a per-business deep dive.

Sprint 4 depends on Sprint 1 (contact field sync) and Sprint 3 (hot-prospect derivation logic + `MarketingHotProspectService` reuse).

- **Sprint 5 (Part V, §§45–54):** Scan-to-Campaign Spawning — surface the City Pain Scan sync report in the UI, extend `deriveBusinessCampaign` to accept the full scan business payload (seeding all fields + creating the `city_analysis` audit on the child), and add "Create campaign" + "Create all unmatched" actions so operators can spawn business-scope campaigns from unmatched scan businesses in one click. Turns the sync report from a log line into an actionable surface.

Sprint 5 depends on Sprint 3 (`syncFromExecution` report + `MarketingHotProspectService`) and the existing `deriveBusinessCampaign` infrastructure.

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

Sprint 2 lets an operator *manually* schedule a follow-up after a no-response contact. But for **hot prospects** — businesses flagged as high-attention by a recent City Pain Scan — a no-response contact should not require the operator to remember to re-schedule. The system should keep them on the radar automatically until they convert or are explicitly deprioritized.

This sprint also closes a critical loop: **City Pain Scan executions produce a rich, compliance-aware multi-business audit JSON (up to 15 businesses across 5+ categories, with per-business GBP status, website, NAP, digital opportunity score, high-attention flag, tier, fee estimate, data quality, contact details, and ownership type) that today is stored only in `mkt_prompt_executions_list.raw_output` and never reaches the campaign records.** Sprint 3 parses this output, matches each business to a campaign, stores per-business `city_analysis` audits, syncs structured fields onto campaigns (confidence-gated via per-business `data_quality`), syncs contact details (phone, website URL) onto Sprint 1's contact fields (null-only), and derives hot-prospect signals from the `top_opportunities` array + per-business `high_attention` flag + `digital_opportunity_score` + `recommended_tier`. Sprint 2's `buildFreshSnapshot` then has real fresh data to work with, and the auto-follow-up scheduler pursues hot prospects automatically.

### What a City Pain Scan actually produces (from the production prompt)

A `city_analysis` execution (City Pain Scan) audits **a citywide, category-agnostic set of businesses** — up to 15 businesses across at least 5 categories, ranked by digital opportunity. The output JSON has this top-level structure:

```
audit_metadata:         { city, state, audit_date, businesses_considered, businesses_included,
                          categories_included, data_access_method, limitations[] }
summary:                one-paragraph executive summary
city_metrics:           { observable_total_reviews, observable_unanswered_reviews,
                          observable_unanswered_negative_reviews, observable_unanswered_positive_reviews,
                          high_attention_businesses, average_digital_opportunity_score (DECIMAL, 1 dp),
                          counts_complete }
category_rankings[]:    [{ rank, category, businesses_included, average_digital_opportunity_score,
                          high_attention_businesses, common_opportunities[], outreach_priority,
                          recommended_service_focus }]
businesses[]:           up to 15 ranked businesses, each with full per-business audit (see below)
top_opportunities[]:    [{ rank, business_name, category, digital_opportunity_score,
                          recommended_tier, primary_opportunity, suggested_service }]
```

Each entry in `businesses[]` has this per-business structure:

```
rank:                   1-15
business_name:          string
category:               string
ownership_type:         "independent"|"local_chain"|"regional_chain"|"national_chain"|"unknown"
address:                string|null
business_phone:         string|null
platforms:
    google:             { profile_status, rating, total_reviews, reviews_with_observable_response,
                          observable_unanswered_reviews, observable_unanswered_negative_reviews,
                          observable_unanswered_positive_reviews, oldest_observable_unanswered_review,
                          newest_observable_unanswered_review, data_status }
    yelp:               { ...same structure... }
    facebook:           { profile_status, rating_or_recommendation, ...same structure... }
combined_review_metrics: { observable_total_reviews, observable_unanswered_reviews,
                          observable_unanswered_negative_reviews, observable_unanswered_positive_reviews,
                          unanswered_rate_percent }
website:                { url, status, mobile_friendly, https, contact_information_visible,
                          call_to_action_present, issues[] }
nap_consistency:        { status, name_variations[], address_variations[], phone_variations[],
                          material_issues[] }
unanswered_negative_review_examples[]: [{ platform, rating, date, complaint_summary,
                          response_status, verification_status }]
negative_review_themes[]: [{ theme, observed_frequency, summary }]
opportunities:          { reputation_management[], local_search[], website_conversion[] }
digital_opportunity_score: { score (INT 0-10), classification, components: {
                          google_profile_maintenance, review_response_opportunity,
                          unanswered_negative_reviews, website_opportunity, nap_consistency }, rationale }
high_attention:         boolean
high_attention_reasons: string[]
recommended_tier:       "tier_1"|"tier_2"|"tier_3" + tier_rationale
estimated_monthly_service_fee: { minimum, maximum, currency }
recommended_services[]: string[]
data_quality:           { confidence: "high"|"medium"|"low", verified_fields[],
                          unavailable_fields[], limitations[] }
sources[]:              string[]
```

This maps directly to campaign + audit fields (see §25a field mapping). The existing `CategoryAnalysisAuditCard` handles a *different* output format (`market_analysis` wrapper with `top_5_competitors`) — City Pain Scan needs its own renderer.

**Key features of the production prompt:**
- **Compliance-aware:** `data_access_method: "public_authorized_sources_only"`, explicit `limitations[]`, no personal info about owners/employees/reviewers, no financial inferences
- **`digital_opportunity_score`** is an integer 0-10 (matches existing `pain_score Int` column — no rounding) but wrapped in an object with `classification` and `components` for richer display
- **`high_attention`** is a boolean (cleaner than the prior `priority` string) with `high_attention_reasons[]`
- **`data_quality`** block per business — confidence-gated sync is back (verified fields overwrite freely; unavailable fields don't sync)
- **`business_phone` + `website.url`** — Sprint 1 contact integration is back (null-only sync)
- **`ownership_type`** — national chain filtering is back (skip `national_chain` in hot-prospect sync)
- **`negative_review_themes`** as structured objects `{theme, observed_frequency, summary}` — richer than strings
- **`nap_consistency`** with `name_variations[]`, `address_variations[]`, `phone_variations[]` — richer than just `{status}`
- **`top_opportunities`** (not `top_prospects`) with `primary_opportunity` + `suggested_service`

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **City Pain Scan → per-business audit storage** | When a `city_analysis` execution completes, each business in the `businesses[]` array is stored as a separate `mkt_audits_list` row (`platform = 'city_analysis'`, `audit_data = {per-business JSON}`) on the matched campaign |
| **City Pain Scan → campaign field sync** | Structured fields from each business's JSON sync onto the matched campaign: `pain_score` (from `digital_opportunity_score.score`), `estimated_tier`, `estimated_fee_cents`, `gbp_claimed`, `has_website`, `nap_consistent`, `unaddressed_reviews` — confidence-gated via per-business `data_quality` |
| **City Pain Scan → contact field sync (Sprint 1 integration)** | `business.business_phone` populates Sprint 1's `phone` field; `business.website.url` populates `website_url` — but only if the campaign's corresponding field is null (never overwrite operator-entered or GBP-enriched contacts) |
| **Hot-prospect signal** | A campaign is "hot" when the business appears in `top_opportunities[]` OR has `high_attention == true` OR `digital_opportunity_score.score >= threshold` (default 7) OR `recommended_tier == 'tier_1'`. Stored as `is_hot_prospect` + `hot_prospect_reason` (includes `primary_opportunity` from `top_opportunities` if ranked) + `hot_prospect_set_at`. Fallback: static `pain_score >= threshold` at intake. |
| **National chain filtering** | Businesses with `ownership_type == 'national_chain'` are skipped during hot-prospect sync — they're not local-biz prospects for a local-marketing-ops platform |
| **Category-level intelligence** | `category_rankings[]` and `city_metrics` are stored as a city-level `city_analysis_summary` audit for category-level outreach planning |
| **Auto-follow-up scheduler** | A job that, for hot prospects in `preview_built`/`shown` whose latest contact had a no-response outcome and whose `next_follow_up_at` is null/past, schedules the next follow-up at the configured cadence (default 3 days) by writing a new outreach log entry with `outcome = 'auto_follow_up_scheduled'` and a `follow_up_date` |
| **Cadence + cap config** | Configurable follow-up interval (default 3d) and max auto-follow-ups before deprioritization (default 5) — after the cap, the campaign is flagged `hot_prospect_deprioritized` and the auto-scheduler stops |
| **Operator override** | Operator can manually mark a campaign `not_hot` (deprioritize) or `hot` (force) regardless of analysis; auto-scheduler respects the override |
| **City Pain Scan audit rendering** | New `CityAnalysisAuditCard` component renders each per-business audit in the Audits tab (parallel to the existing `CategoryAnalysisAuditCard` for market-level analysis) |
| **Data quality surfacing** | Each business's `data_quality` block (confidence, verified fields, unavailable fields, limitations) is displayed on the audit card and gates field sync (low-confidence fields don't overwrite operator-set values) |
| **Visibility** | Hot-prospect badge on the campaign + list; auto-scheduled follow-ups are distinguishable from manual ones (outcome `auto_follow_up_scheduled`) so operators see the system is pursuing on their behalf |

### Why a separate sprint

Auto-scheduling introduces a background job, a multi-business sync hook into the execution completion path, a deprioritization lifecycle, and a new audit renderer — each with its own edge cases (matching up to 15 businesses to campaigns, per-business confidence-gated field sync, contact field integration with Sprint 1, national chain filtering, cadence vs. auto-advance interaction, cap behavior). Coupling this into Sprint 2 would delay the manual outreach tracking, which is the higher-frequency operator need. Sprint 3 is small but has enough moving parts to warrant isolation and its own acceptance tests.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer
**Depends on:** Sprint 1 (contact fields `phone`, `website_url` — populated by City Pain Scan sync), Sprint 2 (outreach log + `next_follow_up_at` rollup + `buildFreshSnapshot`), City Pain Scan being run (existing `city_analysis` prompt type)

---

## 24. Gap Analysis — Current State

### What exists today

- **`pain_score`** on `mkt_campaigns_list` (schema line 6104) — `Int @default(0)`. Static, set at intake. Never updated from City Pain Scan results. The production prompt produces `digital_opportunity_score.score` as an integer 0-10, which maps directly to the column — no schema mismatch, no rounding.
- **`city_analysis` prompt type** (`MarketingPromptService.ts` line 19) — executions produce a rich, compliance-aware multi-business audit JSON (up to 15 businesses, category rankings, top opportunities) stored in `mkt_prompt_executions_list.raw_output` / `filtered_output`. **Not synced to campaigns.** Not stored as audits. Not rendered.
- **`category_analysis` audit pattern** — `CategoryAnalysisAuditCard` renders audits where `platform === 'category_analysis'` and `audit_data` has a `market_analysis` wrapper (competitors, pain points, outreach angle). This is a **different** JSON structure from City Pain Scan — City Pain Scan needs its own renderer.
- **`campaign.state`** — referenced in `MarketingExecutionService.ts` line 233 (`state: campaign.state || ''`) but **does not exist** in the Prisma schema or the web `Campaign` interface. At runtime it's `undefined`, silently producing `''`. City Pain Scan output includes `audit_metadata.state` (e.g., "Indiana") — needed for matching (Plainfield, IN vs Plainfield, NJ).
- **Audit creation route** — `POST /:campaignId/audits` already exists with `platform` + `audit_data` + count fields. Storing per-business City Pain Scan audits requires no new route, just a new `platform` value and a sync call per matched business.
- **No auto-follow-up mechanism** — Sprint 2 adds manual follow-up scheduling only.

### What's missing

| # | Gap | Impact |
|---|-----|--------|
| H1 | No `is_hot_prospect` flag on campaign | Operators can't filter/sort by hotness; no input for automation |
| H2 | City Pain Scan results don't sync to campaigns | Rich multi-business audit JSON (GBP, website, NAP, digital opportunity score, high-attention, tier, fee, data quality, contacts) sits in execution output, never reaches campaign records or audits table |
| H3 | No `city_analysis` audit rendering | The per-business audit JSON has no UI card (unlike `category_analysis` which has `CategoryAnalysisAuditCard`) |
| H4 | No `state` column on campaign | City matching can't disambiguate same-name cities across states; `campaign.state` is a dead reference |
| H5 | No auto-follow-up scheduler | No-response contacts on hot prospects fall silent unless the operator manually re-schedules |
| H6 | No deprioritization lifecycle | Without a cap, auto-follow-ups could run forever on a prospect that will never convert |
| H7 | No operator override on hotness | Operator judgment has no place to be recorded |
| H8 | No category-level intelligence storage | `category_rankings[]` and `city_metrics` from the scan have no home — valuable for category-scope campaign planning |
| H9 | No data quality surfacing | Each business in the scan has a `data_quality` block (confidence, verified/unavailable fields, limitations) but there's no way to see it or gate field sync on it |
| H10 | No contact field integration | `businesses[].business_phone` and `businesses[].website.url` from the scan could populate Sprint 1's contact fields but there's no sync path |
| H11 | No national chain filtering | The scan tags `ownership_type` per business but there's no filter to skip national chains from hot-prospect syncing |

---

## 25. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│           City Pain Scan execution (existing)                       │
│   city_analysis prompt runs → ChatGPT/external AI                   │
│   → mkt_prompt_executions_list.raw_output / filtered_output         │
│      (MULTI-BUSINESS audit JSON: up to 15 businesses across 5+      │
│       categories, top_opportunities, city_metrics,                  │
│       category_rankings[], per-business data_quality)               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ NEW: post-execution sync hook
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│         MarketingHotProspectService.syncFromExecution()             │
│   1. Parse execution output JSON                                    │
│   2. Extract audit_metadata.city + state (matching keys)            │
│   3. For each business in businesses[] (up to 15):                  │
│      a. SKIP if ownership_type == 'national_chain'                  │
│      b. Match business_name + city + state → campaign               │
│      c. Store per-business JSON as mkt_audits_list row              │
│         (platform='city_analysis', audit_data={business JSON})      │
│      d. Sync structured fields onto campaign (data_quality-gated)   │
│      e. Sync contact fields (business_phone, website.url) if null   │
│      f. Derive hotness: in top_opportunities[] OR                   │
│         high_attention==true OR score>=7 OR tier=='tier_1'          │
│         → set is_hot_prospect, hot_prospect_reason (with             │
│           primary_opportunity from top_opportunities if ranked),    │
│           hot_prospect_set_at                                       │
│   4. Store category_rankings + city_metrics + summary as a          │
│      city-level audit (platform='city_analysis_summary')            │
│   5. Return sync report: { matched: N, unmatched: M, hot: K,        │
│      skipped_chains: J }                                            │
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
│   (pain_score is Int; scan produces digital_opportunity_score.score │
│    as Int 0-10 — maps directly, no rounding)                        │
│   (phone, website_url from Sprint 1 — populated by scan sync + GBP) │
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
| `ownership_type` | — | — | Used for filtering (skip `national_chain`); stored in audit_data |
| `business_phone` | `phone` (Sprint 1) | — | Set if null — **never overwrite** operator/GBP-enriched |
| `address` | — | — | Stored in audit_data only (no campaign address column) |
| `platforms.google.total_reviews` | — | `review_count` | Always sync to audit |
| `platforms.google.rating` | — | `average_rating` | Always sync to audit |
| `platforms.google.profile_status` | `gbp_claimed` | `claimed` | Map `claimed`/`likely_claimed` → true; `unclaimed` → false; `unable_to_verify` → leave unchanged. Sync if in `data_quality.verified_fields` or if non-null and campaign value is null. |
| `platforms.google.observable_unanswered_reviews` | `unaddressed_reviews` | `unaddressed_reviews` | Sync if non-null AND in `data_quality.verified_fields` (unanswered counts are often unavailable) |
| `combined_review_metrics.unanswered_rate_percent` | — | — | Stored in audit_data only |
| `website.url` | `website_url` (Sprint 1) | — | Set if null — **never overwrite** operator/GBP-enriched |
| `website.status` | `has_website` | `active_page` | Map `working` → 'yes'; `broken` → 'broken'; `none_found` → 'none'; `social_media_only` → 'social'; `unable_to_verify` → leave unchanged. Sync if non-null. |
| `website.mobile_friendly` | — | `mobile_friendly` | Map `yes`/`likely` → true; `no` → false; `unable_to_verify` → null. Sync to audit. |
| `nap_consistency.status` | `nap_consistent` | — | Map `consistent` → true; `minor_variations`/`major_inconsistencies` → false; `unable_to_verify` → leave unchanged. Sync if non-null. |
| `digital_opportunity_score.score` | `pain_score` | — | Sync always (integer 0-10, maps directly to `Int` column — no rounding) |
| `digital_opportunity_score.classification` | — | — | Stored in audit_data for display |
| `digital_opportunity_score.components` | — | — | Stored in audit_data for display (score breakdown) |
| `recommended_tier` | `estimated_tier` | — | Sync always (e.g., `tier_1`) |
| `estimated_monthly_service_fee.minimum` | `estimated_fee_cents` | — | Use minimum × 100 for cents; sync if `data_quality.confidence` >= `confidenceThreshold` config (default "medium") |
| `high_attention` | — | — | Hotness input (if `true`) |
| `high_attention_reasons[]` | — | — | Stored in audit_data; used in hot_prospect_reason |
| `rank` | — | — | Stored in audit_data; used in hot_prospect_reason |
| `negative_review_themes[]` | — | — | Stored in audit_data only (structured objects) |
| `opportunities` | — | — | Stored in audit_data only (reputation/local_search/website) |
| `data_quality.confidence` | — | — | Stored in audit_data; gates field sync (see below) |
| `data_quality.verified_fields[]` | — | — | Fields in this list sync freely (overwrite) |
| `data_quality.unavailable_fields[]` | — | — | Fields in this list do NOT sync at all |

**Top-level fields (not per-business):**

| JSON path | Storage | Sync rule |
|-----------|---------|-----------|
| `top_opportunities[]` | Drives hotness — each opportunity matched to a campaign gets `is_hot_prospect = true` with `hot_prospect_reason` including `primary_opportunity` + `suggested_service` | Primary hotness signal |
| `category_rankings[]` | Stored as a city-level audit (`platform = 'city_analysis_summary'`) with `audit_data = {category_rankings, city_metrics, summary, audit_metadata}` | Category-level intelligence for outreach planning |
| `city_metrics` | Stored in the same city-level summary audit | Aggregate metrics |
| `summary` | Stored in the same city-level summary audit | Executive summary |
| `audit_metadata` | Stored in the same city-level summary audit | Audit provenance (city, state, date, limitations) |

**Data-quality-gated sync rule:** Each business has its own `data_quality` block with `confidence` ("high"/"medium"/"low"), `verified_fields[]`, and `unavailable_fields[]`. Sync rules per field:
- Fields in `verified_fields[]` → sync freely (overwrite campaign value)
- Fields NOT in `verified_fields[]` and NOT in `unavailable_fields[]` → sync only if campaign value is null/unset
- Fields in `unavailable_fields[]` → do NOT sync at all (leave campaign value unchanged)
- `digital_opportunity_score.score`, `recommended_tier` → always sync (these are the AI's core assessment, always present)
- `estimated_fee_cents` → only sync if `data_quality.confidence` >= `confidenceThreshold` config (default "medium")
- Contact fields (`phone`, `website_url`) → always null-only (set if null, never overwrite), regardless of data_quality

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **City Pain Scan = up to 15 businesses per execution** | Production prompt confirms this (`businesses[]` array, max 15). Sync is 1:many — each business syncs to its own matched campaign. |
| **Per-business audits, not one giant audit** | Each business gets its own `mkt_audits_list` row linked to its campaign, so Sprint 2's `buildFreshSnapshot` can read the latest per-business audit for fresh data, and the Audits tab shows per-business cards. The full city-level data (category_rankings, metrics, summary) is stored as a separate summary audit. |
| **`top_opportunities[]` is the primary hotness signal** | The AI has already ranked the strongest opportunities citywide with `primary_opportunity` + `suggested_service` — this is richer than just score threshold. Being in top_opportunities = hot, with the primary opportunity stored in `hot_prospect_reason`. |
| **`high_attention` boolean (not priority string)** | The production prompt uses a clean boolean `high_attention` with `high_attention_reasons[]` — simpler and more reliable than parsing a priority string. |
| **Contact field integration with Sprint 1** | `businesses[].business_phone` and `businesses[].website.url` populate Sprint 1's `phone` and `website_url` — but only if null. This means a City Pain Scan can bootstrap contact details for campaigns that haven't been GBP-enriched yet, creating a three-sprint integration: scan → contact fields → outreach. |
| **National chain filtering** | Businesses with `ownership_type == 'national_chain'` are skipped during hot-prospect sync — they're not local-biz prospects. Counted in the sync report as `skipped_chains`. |
| **`state` column added to campaign** | Required for matching (Plainfield IN vs NJ); also fixes the dead `campaign.state` reference in `MarketingExecutionService` line 233 |
| **`digital_opportunity_score.score` maps to `pain_score`** | The scan uses the neutral term "digital opportunity score" but it's semantically the same as the campaign's `pain_score` (0-10, higher = more opportunity). The score is an integer, matching the `Int` column — no rounding. The `classification` and `components` are preserved in the audit's `audit_data` for richer display. |
| **Per-business data_quality gating** | Each business has its own confidence level and verified/unavailable field lists. A business with `confidence: "high"` and `verified_fields: ["google_rating", "website_status"]` syncs those freely, while `unavailable_fields: ["observable_unanswered_reviews"]` blocks that sync entirely. This prevents low-confidence AI output from corrupting operator-set data. |
| **Category-level intelligence stored as city-level summary audit** | `category_rankings[]` and `city_metrics` are city-wide. Stored as a separate `city_analysis_summary` audit. This enables category-scope campaign planning in a future sprint. |
| **`is_hot_prospect` denormalized onto campaign** | The execution is transient; hotness needs to persist for filtering, list badges, and the scheduler query without re-parsing execution output each time |
| **Auto-follow-ups write real outreach log entries** | Reuses Sprint 2's rollup + dashboard machinery entirely; the only difference is `outcome = 'auto_follow_up_scheduled'` and `contacted_by = 'system'`. Operators see and can edit them like any manual entry. |
| **Cap + deprioritization** | Prevents infinite auto-pursuit. After `max_auto_followups` (default 5) the campaign is flagged `hot_prospect_deprioritized`; the scheduler skips it. Operator can clear the flag to resume. |
| **Operator override always wins** | If operator sets `is_hot_prospect = false` manually, the sync does not re-set it true unless the next scan produces a fresh positive signal (in top_opportunities, or high_attention true, or score >= 7, or tier_1) for that business (prevents flapping). |

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

**Note on `pain_score`:** Stays `Int`. The production City Pain Scan prompt produces `digital_opportunity_score.score` as an integer 0-10, which maps directly to the `pain_score` column. No rounding or schema change needed. The `classification` and `components` are preserved in the audit's `audit_data` JSON.

### Prisma Sync

After migration, run `npx prisma db pull && npx prisma generate` to sync `state` + the five hot-prospect columns.

### Config additions

Add to `unifiedConfig` (marketing ops section):
```typescript
marketingOps: {
  hotProspect: {
    painScoreThreshold: 7,        // campaign is hot if digital_opportunity_score >= this (fallback path)
    autoFollowUpCadenceDays: 3,   // schedule next follow-up this many days out
    maxAutoFollowUps: 5,          // cap before deprioritization
    schedulerIntervalHours: 6,    // how often the scheduler job runs
    confidenceThreshold: 'medium', // minimum data_quality.confidence to sync fee estimates
    skipNationalChains: true,     // skip ownership_type == 'national_chain' in hot-prospect sync
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
| `syncFromExecution` — parse | `apps/api/src/services/MarketingHotProspectService.ts` | Load the execution's `filtered_output` (fallback to `raw_output`); parse the City Pain Scan JSON. Extract `audit_metadata.city`, `audit_metadata.state`, `audit_metadata.audit_date`, `summary`, `city_metrics`, `category_rankings[]`, `businesses[]` (up to 15), `top_opportunities[]`. |
| `syncFromExecution` — iterate businesses | `apps/api/src/services/MarketingHotProspectService.ts` | For each business in `businesses[]`: (a) skip if `ownership_type == 'national_chain'` and `skipNationalChains` config is true; (b) match to campaign by `business_name ILIKE business.business_name AND city ILIKE audit_metadata.city AND category ILIKE business.category` (+ state if available); (c) store per-business audit; (d) sync fields (data_quality-gated); (e) sync contacts (null-only); (f) derive hotness. Collect a sync report: `{ matched: [{campaignId, businessName, hot}], unmatched: [{businessName, reason}], skipped_chains: N }`. |
| `syncFromExecution` — per-business audit storage | `apps/api/src/services/MarketingHotProspectService.ts` | For each matched business, create an `mkt_audits_list` row: `platform = 'city_analysis'`, `campaign_id = matched`, `audit_data = {full business JSON}`, `review_count` from `business.platforms.google.total_reviews`, `average_rating` from `business.platforms.google.rating`, `unaddressed_reviews` from `business.combined_review_metrics.observable_unanswered_reviews`, `claimed` from `business.platforms.google.profile_status` (mapped), `active_page` from `business.website.status` (mapped), `mobile_friendly` from `business.website.mobile_friendly` (mapped). |
| `syncFromExecution` — per-business field sync | `apps/api/src/services/MarketingHotProspectService.ts` | Per the field mapping table (§25a): sync `pain_score` (from `digital_opportunity_score.score`, integer, no rounding), `estimated_tier`, `estimated_fee_cents` (from `estimated_monthly_service_fee.minimum × 100`, if `data_quality.confidence` >= threshold), `gbp_claimed` (from `platforms.google.profile_status`, if in verified_fields or null-fill), `has_website` (from `website.status`, if non-null), `nap_consistent` (from `nap_consistency.status`, if non-null), `unaddressed_reviews` (if non-null AND in verified_fields), `state` (if null). **Data quality gate:** fields in `data_quality.verified_fields[]` overwrite freely; fields not verified and not unavailable fill nulls only; fields in `data_quality.unavailable_fields[]` don't sync. |
| `syncFromExecution` — contact field sync (Sprint 1 integration) | `apps/api/src/services/MarketingHotProspectService.ts` | If campaign `phone` is null and `business.business_phone` is non-null, set `phone`. If campaign `website_url` is null and `business.website.url` is non-null, set `website_url` and `has_website = 'yes'`. **Never overwrite** existing contact values — scan is a fallback, not a replacement for operator/GBP-enriched data. |
| `syncFromExecution` — hotness derivation | `apps/api/src/services/MarketingHotProspectService.ts` | For each matched business, set `is_hot_prospect = true` if ANY: business appears in `top_opportunities[]` (by name match) OR `business.high_attention == true` OR `business.digital_opportunity_score.score >= threshold` OR `business.recommended_tier == 'tier_1'`. Set `hot_prospect_reason = 'City Pain Scan rank #{rank}: score={score}, tier={tier}, high_attention={high_attention}, opportunity={primary_opportunity from top_opportunities if ranked}'` and `hot_prospect_set_at = now`. If none of the signals fire, do NOT unset existing hotness. |
| `syncFromExecution` — city-level summary audit | `apps/api/src/services/MarketingHotProspectService.ts` | Store `category_rankings[]` + `city_metrics` + `summary` + `audit_metadata` as a single audit row with `platform = 'city_analysis_summary'`. If a city-scope campaign exists for this city+state, attach to it; otherwise store as execution metadata (logged + retrievable via the execution record). This preserves category-level intelligence for future category-scope campaign planning. |
| `syncFromExecution` — sync report | `apps/api/src/services/MarketingHotProspectService.ts` | Return `{ executionId, city, state, businessesInOutput, matched, unmatched, skippedChains, hotProspectsMarked, summaryStored }`. Log the full report for operator visibility. |
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
| Create `CityAnalysisAuditCard` | `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx` (NEW) | Renders audits where `platform === 'city_analysis'` and `audit_data` has the City Pain Scan per-business structure (`rank`, `business_name`, `category`, `ownership_type`, `platforms`, `website`, `nap_consistency`, `combined_review_metrics`, `negative_review_themes`, `digital_opportunity_score`, `high_attention`, `recommended_tier`, `estimated_monthly_service_fee`, `data_quality`). Parallel to the existing `CategoryAnalysisAuditCard` which handles the `market_analysis` wrapper. |
| Card layout | `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx` | Sections: (1) Header (rank #, business name, category, ownership_type badge, high_attention badge — red if true with reasons tooltip); (2) Platform ratings table (Google / Yelp / Facebook — rating + review count + data_status, with "N/A" badges where null); (3) GBP status (profile_status badge: claimed/unclaimed/likely_claimed/unable_to_verify); (4) Website assessment (status badge + mobile_friendly badge + HTTPS badge + contact info visible + CTA present + issues list); (5) NAP consistency (status badge + name/address/phone variations if any + material_issues); (6) Combined review metrics (total, unanswered, negative unanswered, positive unanswered, unanswered rate % — with "N/A" where null); (7) Unanswered negative review examples (up to 3 — platform, rating, date, complaint summary, response status, verification status); (8) Negative review themes (structured: theme + observed_frequency badge + summary); (9) Opportunities (reputation_management / local_search / website_conversion — list per category); (10) Digital opportunity score (score badge 0-10 color-coded: 0-3 green/low, 4-6 amber/medium, 7-8 orange/high, 9-10 red/very_high + classification label + component breakdown bar chart + rationale); (11) Recommended tier (tier_1/tier_2/tier_3 badge + tier_rationale + fee range + recommended_services); (12) **Data quality block** (confidence badge colored by level: green high, amber medium, red low; verified_fields listed green; unavailable_fields listed red; limitations listed) |
| Wire into Audits tab | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (Audits tab, line ~430) | Alongside the existing `CategoryAnalysisAuditCard` conditional, add: if `audit.platform === 'city_analysis' && audit.audit_data`, render `CityAnalysisAuditCard`. The existing audit loop already iterates all audits — just add the conditional branch. |
| Action buttons | `apps/web/src/components/marketing-ops/CityAnalysisAuditCard.tsx` | "Copy summary" (copies the city-level `summary` from the associated `city_analysis_summary` audit if available — the one-paragraph narrative is the outreach hook); "Save to campaign notes" (appends score + tier + high_attention + negative themes + opportunities to `campaign.notes`); "Re-sync to campaign" (calls `syncFromExecution` again to re-sync fields — useful after editing the execution output) |

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
      "hot_prospect_reason": "City Pain Scan rank #3: score=8, tier=tier_1, high_attention=true, opportunity=Unclaimed GBP with 20+ unanswered negative reviews",
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
| AC27 | A business in `top_opportunities[]` gets `is_hot_prospect = true` with `hot_prospect_reason` including the `primary_opportunity` | Integration test: seed campaign matching a top_opportunities entry, run sync, assert hot + reason contains primary_opportunity |
| AC28 | A business with `high_attention == true` OR `digital_opportunity_score.score >= 7` OR `recommended_tier == 'tier_1'` gets `is_hot_prospect = true` even if not in top_opportunities | Integration test: seed business with score 8 + high_attention false, not in top_opportunities, run sync, assert hot |
| AC29 | A business with `score: 3`, `high_attention: false`, `tier: "tier_3"`, not in top_opportunities does NOT set hotness | Integration test: run sync, assert `is_hot_prospect` unchanged |
| AC30 | Each matched business gets a per-business `mkt_audits_list` row with `platform = 'city_analysis'` and the full business JSON in `audit_data` | Integration test: run sync with 3 matches, GET audits for each campaign, assert 3 city_analysis audits |
| AC31 | `syncFromExecution` syncs structured fields: `pain_score` (from `digital_opportunity_score.score`, integer, no rounding), `estimated_tier`, `gbp_claimed`, `has_website`, `nap_consistent` | Integration test: run sync, GET campaign, assert fields match expected mapping |
| AC32 | Data-quality-gated sync: fields in `data_quality.verified_fields[]` overwrite freely; fields not verified fill nulls only; fields in `unavailable_fields[]` don't sync | Unit test: 3 scenarios — verified field overwrites, unverified field fills null only, unavailable field doesn't sync |
| AC33 | `digital_opportunity_score.score` is an integer 0-10 and syncs directly to the `pain_score Int` column with no rounding | Unit test: verify integer passthrough from `digital_opportunity_score.score` to `pain_score` |
| AC34 | Contact field integration: `business.business_phone` populates campaign `phone` if null; `business.website.url` populates `website_url` if null — never overwrites existing | Unit test: campaign with null phone, sync, assert phone set; campaign with existing phone, sync, assert unchanged |
| AC35 | National chain filtering: businesses with `ownership_type == 'national_chain'` are skipped from hot-prospect sync and counted in `skippedChains` | Unit test: seed business with `national_chain`, run sync, assert not synced + `skippedChains: 1` |
| AC36 | City-level intelligence (`category_rankings[]`, `city_metrics`, `summary`) is stored as a `city_analysis_summary` audit | Integration test: run sync, query for summary audit, assert present with rankings + metrics data |
| AC37 | A campaign with `pain_score >= 7` and no city_analysis audit is marked hot on create/update via the fallback path | Unit test on `evaluatePainScoreFallback` |
| AC38 | The auto-follow-up scheduler, when run against a hot prospect in `shown` whose latest contact was `no_answer` with no future follow-up, writes a new outreach log entry with `outcome = 'auto_follow_up_scheduled'` and `follow_up_date = today + cadenceDays` | Unit test on `MarketingAutoFollowUpScheduler.run` with mocked clock |
| AC39 | The scheduler increments `auto_followup_count` and, upon reaching `maxAutoFollowUps`, sets `hot_prospect_deprioritized = true` and stops scheduling | Unit test: run scheduler `maxAutoFollowUps + 1` times, assert deprioritized set and no further entries |
| AC40 | A deprioritized hot prospect is skipped by the scheduler until `clearDeprioritized` is called | Unit test: deprioritized campaign, run scheduler, assert no new log entry |
| AC41 | The scheduler is idempotent — running twice in one day does not create duplicate `auto_follow_up_scheduled` entries | Unit test: run twice, assert one entry |
| AC42 | Operator "Mark not hot" sets `is_hot_prospect = false`; the scheduler skips; a subsequent City Pain Scan sync does NOT re-set it true unless the new scan produces a fresh positive signal for that business | Integration test: override, run sync with business at score 3, assert stays false; run sync with same business at score 8, assert true |
| AC43 | Auto-scheduled follow-up entries appear in the Outreach card with a "System" tag distinct from operator-logged entries | Manual: trigger scheduler on a seeded hot prospect, open campaign, verify card |
| AC44 | A hot prospect with a future auto-scheduled `next_follow_up_at` is not auto-lost by the Sprint 2 7-day job | Integration test: hot prospect + future auto follow-up, run auto-advance job, assert stage unchanged |
| AC45 | The hot-prospects dashboard view shows correct counts and per-prospect auto-follow-up progress | Manual: seed hot prospects at various `auto_followup_count`, verify view |
| AC46 | `clearDeprioritized` resets `auto_followup_count = 0` and `hot_prospect_deprioritized = false`, and the scheduler resumes on next run | API test + unit test |
| AC47 | The `CityAnalysisAuditCard` renders all 12 per-business sections (header, platforms, GBP, website, NAP, review metrics, review examples, themes, opportunities, score, tier, data quality) in the Audits tab | Manual: seed a city_analysis audit, open campaign Audits tab, verify all sections render |
| AC48 | The `data_quality` block is displayed with color-coded confidence badges (green high / amber medium / red low) and lists verified/unavailable fields + limitations | Manual: verify in the card from AC47 |
| AC49 | The digital opportunity score badge is color-coded by classification (0-3 green, 4-6 amber, 7-8 orange, 9-10 red) with component breakdown | Manual: verify in the card from AC47 |
| AC50 | When no campaign matches a business in `businesses[]`, sync logs the miss in the sync report and does not create a campaign or throw | Unit test: run sync with unmatched business, assert `unmatched` array populated + no throw |
| AC51 | Sprint 2's `buildFreshSnapshot` reads the latest `city_analysis` audit's `audit_data` for fresh review counts/ratings | Integration test: create city_analysis audit, call `buildFreshSnapshot`, assert snapshot reflects audit values |
| AC52 | The sync report returns `{ matched, unmatched, skippedChains, hotProspectsMarked, summaryStored }` counts for operator visibility | Integration test: run sync, assert report structure |

---

## 30. Out of Scope (Sprint 3)

| Item | Why deferred |
|------|--------------|
| **Push notifications** to operator when an auto-follow-up is scheduled | Passive dashboard visibility suffices; push is the notification-infrastructure sprint |
| **Auto-drafting the follow-up message content** | Sprint 2 captures the message snapshot for manual entries; auto-entries leave `message_snapshot` null (operator composes the actual message when they action the follow-up). AI-drafted follow-ups are a future enhancement. |
| **Hot-prospect decay** (auto-cooling hotness after N days with no scan refresh) | Adds a time-decay model; for v1 hotness persists until operator override or deprioritization. Revisit if hot-prospect list grows stale. |
| **Multi-cadence by channel** (e.g., phone follow-ups every 2d, email every 5d) | Single cadence for v1; channel-aware cadence is a tuning enhancement once usage data exists |
| **Hot-prospect scoring model** (weighted combination of pain_score, scan rank, response history) | Binary hot/not-hot for v1; a scored model is a future analytics sprint |
| **Auto-creating campaigns for unmatched businesses** in City Pain Scan | Sync logs misses for v1; an "Import unmatched as new campaigns" bulk action is a follow-up (§33.8) |
| **City-scope campaign auto-creation** for category-level audit storage | Category-level intelligence stored as execution metadata for v1; city-scope campaign creation is a follow-up (§33.9) |

---

## 31. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| City Pain Scan output format varies between AI providers → sync mis-parses | `syncFromExecution` parses defensively; validates required fields (`businesses[]`, `digital_opportunity_score.score` per business); logs parse failures with the raw output for operator review. The production City Pain Scan prompt is the reference schema. |
| Up to 15 businesses matched per execution → bulk sync performance | Sync processes businesses sequentially with per-business try/catch; a single business failure doesn't abort the batch. Sync report shows matched/unmatched/skipped_chains counts. |
| Name + city + category matching collisions (two "Corner Store" in Plainfield) | Matching includes `category` as a third key; `state` disambiguates further once the column exists. If multiple campaigns match, sync updates all and logs the ambiguity. Operator resolves via override. |
| Null values in scan output interpreted as "no data" vs "zero" | The prompt says "return null if unavailable" — null means unavailable, not zero. Data-quality-gated sync (§25a) preserves existing campaign values when scan fields are null or unavailable. Non-null verified values overwrite. |
| Low-confidence data overwrites good operator data | Per-business `data_quality` gating (§25a): verified fields overwrite freely; unverified fill nulls only; unavailable fields don't sync. Each business has its own confidence level. |
| Contact field sync overwrites operator/GBP-enriched data | Contact sync (`business_phone`, `website.url`) is **null-only** — never overwrites existing values. Scan is a fallback, not a replacement. |
| `digital_opportunity_score.score` → `pain_score` semantic mismatch | The scan uses "digital opportunity score" (neutral framing) but it maps to `pain_score` (same 0-10 scale, higher = more opportunity). Documented in field mapping (§25a) and design decisions. |
| Auto-follow-ups annoy prospects (too frequent) | Default cadence 3d is conservative; configurable; cap of 5 prevents infinite pursuit; operator can mark not-hot anytime |
| Scheduler + auto-advance interaction causes premature `lost` | AC44 explicitly guards: future auto follow-up blocks auto-loss; only deprioritized-and-stale prospects go `lost` |
| Hot-prospect list grows unbounded across multiple City Pain Scans | Deprioritization cap + operator override + future decay (out of scope) keep it bounded; dashboard shows count so bloat is visible |
| `top_opportunities` matching by name is fuzzy | Match by `business_name ILIKE` with trim; log match confidence; if no match, the opportunity is listed in the sync report's `unmatched` array for operator review |

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

1. **~~City Pain Scan output schema~~** — **RESOLVED (v4, final).** The production City Pain Scan prompt (compliance-aware version) produces a **multi-business ranked audit** (up to 15 businesses across 5+ categories, with `top_opportunities[]`, `category_rankings[]`, and `city_metrics`). Each business in `businesses[]` has a full per-business audit with `digital_opportunity_score` (integer 0-10 + classification + components), `high_attention` (boolean + reasons), `recommended_tier`, `estimated_monthly_service_fee`, `data_quality` (confidence + verified/unavailable fields), `business_phone`, `website.url`, `ownership_type`, GBP/Yelp/Facebook metrics, website assessment, NAP consistency with variations, and structured `negative_review_themes[]`. The structure is documented in §23 and mapped in §25a. The sync is 1:many (one execution → up to 15 campaigns), matched by `business_name + city + category` (+ `state` once added). The reference is the production City Pain Scan prompt (compliance-aware version). Key features: `digital_opportunity_score.score` is an integer (no rounding, maps to `pain_score`), `data_quality` block enables confidence-gated sync, `business_phone` + `website.url` enable Sprint 1 contact integration, `ownership_type` enables national chain filtering, `high_attention` is a clean boolean.
2. **`category_analysis` vs `city_analysis` scope** — this sprint hooks only `city_analysis` (City Pain Scan, multi-business). `category_analysis` produces a market-level `market_analysis` wrapper (competitors, pain points) already handled by `CategoryAnalysisAuditCard`. Should a future sprint also derive hotness from `category_analysis` market-level pain points (e.g., if a category has > 60% unclaimed GBPs, all businesses in that category are hot)? Recommend: yes, as a follow-up.
3. **Cadence tuning** — is 3 days the right default, or should it be stage-dependent (e.g., tighter in `shown` than `preview_built`)? Recommend single default for v1, tune post-usage.
4. **Deprioritization cap of 5** — confirm, or should it be higher/lower? Each auto-follow-up is one operator action to pursue, so 5 ≈ 15 days of pursuit at 3d cadence before the system gives up.
5. **Should auto-follow-ups also fire in `paid`/`delivered`?** Currently scoped to `preview_built`/`shown` (the prospecting stages). Chasing delivery confirmation in `paid` is arguably operator-manual. Confirm scope.
6. **`state` field on campaign form** — the `CampaignFormClient` needs a `state` input for City Pain Scan matching to work. Should it be a free-text field or a US state dropdown? Recommend dropdown (US states + Canadian provinces) since the platform is North American retail.
7. **Confidence threshold for fee sync** — the config has `confidenceThreshold: 'medium'` for syncing `estimated_monthly_service_fee`. Should fee sync at `data_quality.confidence: "low"` or require `medium`? Recommend: require `medium` or higher — fees are operator-facing and shouldn't auto-populate from low-confidence data.
8. **Unmatched businesses in City Pain Scan** — when a business in `businesses[]` has no matching campaign, should the sync auto-create a `seek`-stage campaign for it? Currently the design logs the miss and does nothing. Auto-creation would turn every City Pain Scan into a campaign-creation event, which could be powerful but also noisy. Recommend: log misses for v1; add an "Import unmatched as new campaigns" bulk action in a follow-up.
9. **Category-scope campaign for city-level summary audit** — the `city_analysis_summary` audit (category_rankings + city_metrics + summary) needs a campaign to attach to. If no city-scope campaign exists for the analyzed city, where does this audit go? Options: (a) auto-create a city-scope campaign, (b) store as execution metadata only, (c) attach to the first matched business's campaign with a flag. Recommend: (b) for v1 — store as execution metadata retrievable via `GET /prompts/executions/:id`; revisit city-scope campaign creation in a follow-up.
10. **`high_attention` vs `digital_opportunity_score` overlap** — the prompt sets `high_attention = true` when score >= 7 OR > 15 unanswered reviews. This means `high_attention` is largely redundant with the `score >= 7` hotness signal. Confirm that keeping both signals in the OR logic is intentional (belt-and-suspenders) vs. simplifying to just `score >= 7`. Recommend: keep both — `high_attention` also captures the "> 15 unanswered reviews" case which could fire at score 6 if review-response opportunity is high.

---

# Part IV — Sprint 4: Business-Scope Seek Audit Integration

## 34. Executive Summary

Sprint 3 closed the loop between **citywide** City Pain Scan executions and campaign records — a multi-business audit synced onto up to 15 matched campaigns. But there's a second, earlier audit flow that's still disconnected: the **business-scope seek prompt**.

The production seek prompt is a **single-business deep-dive audit** run at the `seek` stage for one specified business. It produces a rich, compliance-aware JSON structure with identity verification, per-platform review metrics (Google/Yelp/Facebook), website assessment, NAP consistency with variations, negative review themes, a digital opportunity score (0-10 with component breakdown), high-attention flag, recommended service tier + fee, recommended services, data quality block, and structured sources. Today this output is stored only in `mkt_prompt_executions_list.raw_output` — **never validated, never stored as an audit, never rendered, never synced to the campaign record.**

Sprint 4 closes this gap by:
1. **Registering the `business_analysis` output schema** in the `OUTPUT_SCHEMA_REGISTRY` (alongside the existing `market_analysis` schema for category-scope prompts) — so the existing `importExternalResult` flow validates seek prompt JSON and auto-creates an audit with `platform = 'business_analysis'`.
2. **Building a `BusinessAnalysisAuditCard`** component that renders the full seek audit in the Audits tab — parallel to `CategoryAnalysisAuditCard` (market-level) and `CityAnalysisAuditCard` (citywide per-business, from Sprint 3).
3. **Syncing seek audit fields onto the campaign** — `digital_opportunity_score.score` → `pain_score`, `recommended_tier` → `estimated_tier`, fee → `estimated_fee_cents`, GBP status, website status, NAP status, review counts, contact details (`business_phone`, `website.url`) — all data_quality-gated, reusing Sprint 3's `MarketingHotProspectService` sync machinery.
4. **Deriving hot-prospect signals from seek audits** — same OR logic as Sprint 3 (`high_attention == true` OR `score >= 7` OR `tier_1`), so a single-business seek audit can flag a campaign as hot even without a citywide scan.

### What the seek prompt actually produces (from the production prompt)

A `seek` execution audits **one specified business** with identity verification. The output JSON has this top-level structure:

```
audit_metadata:         { audit_date, requested_business: {business_name, city, state, category,
                          address, phone}, matched_business: {business_name, category, address,
                          phone, website}, identity_status, identity_confidence, limitations[] }
summary:                one concise paragraph covering overall presence, reviews, themes,
                        website, NAP, score, high-attention, tier, strongest opportunity
platforms:
    google:             { profile_status, rating, total_reviews, reviews_with_observable_response,
                          observable_unanswered_reviews, observable_unanswered_negative_reviews,
                          observable_unanswered_positive_reviews, observable_response_rate_percent,
                          oldest/newest_observable_unanswered_review, primary_category,
                          additional_categories[], displayed_name/address/phone/website,
                          profile_issues[], data_status }
    yelp:               { ...same structure minus primary_category/additional_categories... }
    facebook:           { profile_status, rating_or_recommendation, ...same structure... }
combined_review_metrics: { observable_total_reviews, observable_reviews_with_response,
                          observable_unanswered_reviews, observable_unanswered_negative_reviews,
                          observable_unanswered_positive_reviews, observable_response_rate_percent,
                          observable_unanswered_rate_percent, oldest/newest_unanswered_review,
                          counts_complete }
website:                { url, status, mobile_friendly, https, contact_information_visible,
                          click_to_call_available, call_to_action_present,
                          service_information_present, location_information_present,
                          issues[], conversion_opportunities[] }
nap_consistency:        { overall_status, canonical_name, canonical_address, canonical_phone,
                          name_variations[], address_variations[], phone_variations[],
                          material_issues[] }
unanswered_negative_review_examples[]: [{ platform, rating, date, complaint_summary,
                          response_status, verification_status }]
negative_review_themes[]: [{ theme, observed_frequency, supporting_review_count, summary }]
digital_opportunity_score: { score (INT 0-10), classification, components: {
                          google_profile_maintenance, review_response_opportunity,
                          unanswered_negative_reviews, website_opportunity, nap_consistency }, rationale }
high_attention:         boolean
high_attention_reasons: string[]
recommended_tier:       "tier_1"|"tier_2"|"tier_3" + tier_rationale
estimated_monthly_service_fee: { minimum, maximum, currency }
recommended_services[]: string[]
data_quality:           { confidence: "high"|"medium"|"low", verified_fields[],
                          unavailable_fields[], conflicts[], limitations[] }
sources[]:              [{ platform, source_type, url, accessed_date }]
```

**Key differences from City Pain Scan per-business entries (Sprint 3):**
- **Standalone** — not nested in a `businesses[]` array; the entire JSON IS the audit
- **Identity verification** — `audit_metadata.requested_business` vs `matched_business` with `identity_status` (confirmed/ambiguous/mismatched) + `identity_confidence` — critical for ensuring the audit is about the RIGHT business
- **Richer Google data** — `primary_category`, `additional_categories[]`, `displayed_name/address/phone/website`, `profile_issues[]` (not in City Pain Scan)
- **Richer website assessment** — `click_to_call_available`, `service_information_present`, `location_information_present`, `conversion_opportunities[]` (not in City Pain Scan)
- **Richer NAP** — `canonical_name/address/phone` + `name_variations[]` + `address_variations[]` + `phone_variations[]` + `material_issues[]` (City Pain Scan has just `status` + variations)
- **Richer data_quality** — adds `conflicts[]` (for identity ambiguity, conflicting listings)
- **Structured sources[]** — `{platform, source_type, url, accessed_date}` objects (City Pain Scan has `sources[]` as strings)
- **No `rank`** — single business, not ranked against others
- **No `ownership_type`** — not relevant for a single specified business
- **No `top_opportunities`** — that's a citywide ranking concept
- **`combined_review_metrics` has `observable_reviews_with_response` + `observable_response_rate_percent`** — City Pain Scan doesn't have these

**Shared fields with City Pain Scan (same semantics):**
- `digital_opportunity_score` — same structure (score 0-10, classification, components, rationale)
- `high_attention` + `high_attention_reasons[]` — same boolean + reasons
- `recommended_tier` + `estimated_monthly_service_fee` — same tier + fee structure
- `platforms.google/yelp/facebook` — same per-platform review metrics structure
- `website` — same status enum + mobile_friendly + https + contact_info + CTA
- `nap_consistency.status` — same enum (consistent/minor_variations/major_inconsistencies/unable_to_verify)
- `negative_review_themes[]` — same structured objects
- `data_quality` — same confidence + verified/unavailable fields (plus `conflicts[]`)

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Seek audit → output schema registration** | Register `business_analysis` in `OUTPUT_SCHEMA_REGISTRY` with a Zod validator, `auditPlatform = 'business_analysis'`, and a prompt suffix. The existing `importExternalResult` flow then validates seek JSON and auto-creates an audit. |
| **Seek audit → audit storage** | The seek execution's JSON is stored as an `mkt_audits_list` row (`platform = 'business_analysis'`, `audit_data = {full JSON}`) on the campaign — automatically by `importExternalResult` when the schema is registered. No new sync hook needed. |
| **Seek audit → campaign field sync** | After audit creation, sync structured fields onto the campaign: `pain_score` (from `digital_opportunity_score.score`), `estimated_tier`, `estimated_fee_cents`, `gbp_claimed`, `has_website`, `nap_consistent`, `unaddressed_reviews`, contact fields (`business_phone`, `website.url`) — data_quality-gated, reusing Sprint 3's `MarketingHotProspectService.syncFromAudit` method. |
| **Seek audit → hotness derivation** | Same OR logic as Sprint 3: `high_attention == true` OR `score >= 7` OR `recommended_tier == 'tier_1'` → `is_hot_prospect = true`. A seek audit can flag a campaign as hot even without a citywide scan. |
| **Seek audit rendering** | New `BusinessAnalysisAuditCard` component renders the full seek audit in the Audits tab — parallel to `CategoryAnalysisAuditCard` (market-level) and `CityAnalysisAuditCard` (citywide per-business). |
| **Identity verification surfacing** | The card prominently displays `identity_status` (confirmed/ambiguous/mismatched) + `identity_confidence` — if ambiguous, warn the operator that the audit may be about a different business. |
| **Data quality surfacing** | Same as Sprint 3: confidence badge (green/amber/red), verified fields, unavailable fields, plus `conflicts[]` (unique to seek). |

### Why a separate sprint

The seek prompt has a richer schema than City Pain Scan per-business entries (identity verification, canonical NAP, structured sources, conversion opportunities, profile issues). It needs its own Zod validator, its own audit card with sections that don't exist in `CityAnalysisAuditCard`, and its own sync logic that handles identity ambiguity. Coupling this into Sprint 3 would delay the citywide sync + auto-follow-up work. Sprint 4 is small (mostly a new schema + card + sync reuse) but distinct enough to warrant isolation.

**Sprint Duration:** 1 sprint (1 week — smaller than Sprint 3, reuses Sprint 3 machinery)
**Team Size:** 1 full-stack developer
**Depends on:** Sprint 1 (contact fields `phone`, `website_url`), Sprint 3 (`MarketingHotProspectService` sync + hotness logic, `CityAnalysisAuditCard` patterns)

---

## 35. Gap Analysis — Current State

### What exists today

- **`seek` prompt type** (`MarketingPromptService.ts` line 19) — executions produce a single-business audit JSON stored in `mkt_prompt_executions_list.raw_output` / `filtered_output`. **Not validated against a schema. Not stored as an audit. Not rendered. Not synced to campaigns.**
- **`OUTPUT_SCHEMA_REGISTRY`** (`market-analysis.schema.ts` line 121) — only `market_analysis` is registered (for `category_analysis` prompts). Seek prompts have no registered schema, so `importExternalResult` skips validation and audit creation for them.
- **`importExternalResult`** (`MarketingPromptService.ts` line 296) — validates JSON against the template's `output_schema` name from the registry; if `auditPlatform` is set, creates an audit. Seek prompts fall through with no validation + no audit.
- **`CategoryAnalysisAuditCard`** — renders `platform === 'category_analysis'` audits with `market_analysis` wrapper. Different structure from seek output.
- **`CityAnalysisAuditCard`** (Sprint 3, Task 22) — renders `platform === 'city_analysis'` audits with per-business City Pain Scan structure. Closer to seek output but missing identity verification, canonical NAP, structured sources, conversion opportunities, profile issues.
- **`MarketingHotProspectService`** (Sprint 3, Task 15) — syncs City Pain Scan fields onto campaigns + derives hotness. Reusable for seek audits with a new `syncFromAudit` method.

### What's missing

| # | Gap | Impact |
|---|-----|--------|
| S1 | No `business_analysis` schema in `OUTPUT_SCHEMA_REGISTRY` | Seek prompt JSON is never validated; `importExternalResult` skips audit creation for seek executions |
| S2 | No `business_analysis` audit storage | Seek audit JSON sits in execution `raw_output`, never reaches `mkt_audits_list` or the Audits tab |
| S3 | No `BusinessAnalysisAuditCard` | The seek audit's rich structure (identity, platforms, website, NAP, themes, score, tier, data quality, sources) has no UI renderer |
| S4 | No seek audit → campaign field sync | `digital_opportunity_score.score`, `recommended_tier`, fee, GBP status, website, NAP, contacts from seek audits never reach the campaign record |
| S5 | No seek audit → hotness derivation | A seek audit with `high_attention == true` or `score >= 7` doesn't flag the campaign as hot (only City Pain Scan does, via Sprint 3) |
| S6 | No identity verification surfacing | The seek prompt verifies business identity (`identity_status: confirmed/ambiguous/mismatched`) but this is invisible to operators — they could be looking at an audit of the wrong business |

---

## 36. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│           Seek prompt execution (existing)                          │
│   seek prompt runs → ChatGPT/external AI                            │
│   → mkt_prompt_executions_list.raw_output / filtered_output         │
│      (SINGLE-BUSINESS audit JSON: identity verification, platforms, │
│       website, NAP, review metrics, themes, score, tier, fee,       │
│       data_quality, sources)                                        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ EXISTING: importExternalResult (no changes needed
                   │           once schema is registered)
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    OUTPUT_SCHEMA_REGISTRY (MODIFIED — add business_analysis)        │
│   1. Validate JSON against businessAnalysisSchema (Zod)             │
│   2. Create mkt_audits_list row:                                    │
│      platform = 'business_analysis',                                │
│      audit_data = {full seek JSON},                                 │
│      review_count, average_rating, etc. from JSON                   │
│   3. Return { execution, audit }                                    │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ NEW: post-audit sync hook (reuses Sprint 3 svc)
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    MarketingHotProspectService.syncFromAudit() (NEW method)         │
│   1. Load audit + campaign                                          │
│   2. Check identity_status — skip sync if 'mismatched'              │
│   3. Sync structured fields (data_quality-gated, same as Sprint 3): │
│      pain_score ← digital_opportunity_score.score                   │
│      estimated_tier ← recommended_tier                              │
│      estimated_fee_cents ← estimated_monthly_service_fee.minimum    │
│      gbp_claimed ← platforms.google.profile_status                  │
│      has_website ← website.status                                   │
│      nap_consistent ← nap_consistency.overall_status                │
│      unaddressed_reviews ← combined_review_metrics.observable_unanswered_reviews │
│   4. Sync contacts (null-only, same as Sprint 3):                   │
│      phone ← audit_metadata.matched_business.phone (if null)        │
│      website_url ← website.url (if null)                            │
│   5. Derive hotness (same OR logic as Sprint 3):                    │
│      high_attention == true OR score >= 7 OR tier_1 → hot           │
│   6. Return sync report                                              │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              mkt_campaigns_list (extended by Sprint 3)              │
│   pain_score, estimated_tier, estimated_fee_cents, gbp_claimed,     │
│   has_website, nap_consistent, unaddressed_reviews,                 │
│   phone, website_url (Sprint 1),                                    │
│   is_hot_prospect, hot_prospect_reason, hot_prospect_set_at         │
│   (Sprint 3 columns — reused, no new migration)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 36a. Field Mapping — Seek Audit JSON → Campaign + Audit

| JSON path | Campaign field | Audit field | Sync rule |
|-----------|---------------|-------------|-----------|
| `audit_metadata.matched_business.business_name` | `business_name` | — | Set if null; log if different from campaign name (identity check) |
| `audit_metadata.matched_business.phone` | `phone` (Sprint 1) | — | Set if null — **never overwrite** |
| `audit_metadata.matched_business.website` | `website_url` (Sprint 1) | — | Set if null — **never overwrite** |
| `platforms.google.total_reviews` | — | `review_count` | Always sync to audit |
| `platforms.google.rating` | — | `average_rating` | Always sync to audit |
| `platforms.google.profile_status` | `gbp_claimed` | `claimed` | Map `claimed`/`likely_claimed` → true; `unclaimed` → false; `unable_to_verify` → leave unchanged. Sync if in `data_quality.verified_fields` or null-fill. |
| `combined_review_metrics.observable_unanswered_reviews` | `unaddressed_reviews` | `unaddressed_reviews` | Sync if non-null AND in `data_quality.verified_fields` |
| `combined_review_metrics.observable_response_rate_percent` | — | — | Stored in audit_data only |
| `website.url` | `website_url` (Sprint 1) | — | Set if null — **never overwrite** |
| `website.status` | `has_website` | `active_page` | Map `working` → 'yes'; `broken` → 'broken'; `none_found` → 'none'; `social_media_only` → 'social'; `unable_to_verify` → leave unchanged. Sync if non-null. |
| `website.mobile_friendly` | — | `mobile_friendly` | Sync to audit |
| `nap_consistency.overall_status` | `nap_consistent` | — | Map `consistent` → true; `minor_variations`/`major_inconsistencies` → false; `unable_to_verify` → leave unchanged. Sync if non-null. |
| `digital_opportunity_score.score` | `pain_score` | — | Sync always (integer 0-10, no rounding) |
| `digital_opportunity_score.classification` | — | — | Stored in audit_data for display |
| `digital_opportunity_score.components` | — | — | Stored in audit_data for display |
| `recommended_tier` | `estimated_tier` | — | Sync always |
| `estimated_monthly_service_fee.minimum` | `estimated_fee_cents` | — | Use minimum × 100; sync if `data_quality.confidence` >= `confidenceThreshold` config |
| `high_attention` | — | — | Hotness input (if `true`) |
| `high_attention_reasons[]` | — | — | Stored in audit_data; used in `hot_prospect_reason` |
| `negative_review_themes[]` | — | — | Stored in audit_data only |
| `recommended_services[]` | — | — | Stored in audit_data only |
| `data_quality.confidence` | — | — | Stored in audit_data; gates field sync |
| `data_quality.verified_fields[]` | — | — | Fields in this list sync freely |
| `data_quality.unavailable_fields[]` | — | — | Fields in this list don't sync |
| `data_quality.conflicts[]` | — | — | Stored in audit_data; displayed on card (unique to seek) |
| `sources[]` | — | — | Stored in audit_data (structured objects) |
| `audit_metadata.identity_status` | — | — | Stored in audit_data; displayed prominently on card; gates sync (skip if `mismatched`) |
| `audit_metadata.identity_confidence` | — | — | Stored in audit_data; displayed on card |

**Data-quality-gated sync rule:** Same as Sprint 3 (§25a):
- Fields in `verified_fields[]` → sync freely (overwrite)
- Fields not verified and not unavailable → sync only if campaign value is null
- Fields in `unavailable_fields[]` → don't sync
- `digital_opportunity_score.score`, `recommended_tier` → always sync
- `estimated_fee_cents` → sync only if `confidence` >= `confidenceThreshold`
- Contact fields → always null-only (set if null, never overwrite)

**Identity-gated sync rule (unique to seek):**
- `identity_status == 'confirmed'` → sync normally
- `identity_status == 'ambiguous'` → sync normally but log a warning + set `hot_prospect_reason` to include "identity ambiguous"
- `identity_status == 'mismatched'` → **skip sync entirely**; log the mismatch; don't update campaign fields or hotness

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **Register `business_analysis` in `OUTPUT_SCHEMA_REGISTRY`** | Reuses the existing `importExternalResult` flow — no new import endpoint needed. Once the schema is registered, seek executions are validated + auto-create audits. |
| **`syncFromAudit` method on `MarketingHotProspectService`** | Reuses Sprint 3's sync + hotness logic. The method takes an audit (instead of an execution) and syncs fields + derives hotness. Shared helper for data_quality gating + contact sync. |
| **Identity-gated sync** | The seek prompt verifies identity (`confirmed`/`ambiguous`/`mismatched`). Syncing fields from a mismatched audit would corrupt the campaign with data about a different business. Skip sync on mismatch; warn on ambiguous. |
| **No new schema migration** | Sprint 4 reuses Sprint 3's columns (`pain_score`, `estimated_tier`, `is_hot_prospect`, etc.) and Sprint 1's contact columns. No new database columns needed. |
| **Separate `BusinessAnalysisAuditCard` (not reusing `CityAnalysisAuditCard`)** | The seek schema has sections that City Pain Scan doesn't: identity verification, canonical NAP, structured sources, conversion opportunities, profile issues, `conflicts[]` in data_quality. A separate card keeps each renderer focused on its schema. |
| **Seek hotness + City Pain Scan hotness are additive** | If a campaign has both a seek audit (hot) and a city_analysis audit (hot), both set `is_hot_prospect = true`. The `hot_prospect_reason` reflects whichever ran most recently. Operator override still wins. |
| **Seek sync runs after `importExternalResult`** | The existing import flow creates the audit. A post-import hook (or a manual "Sync to campaign" button on the audit card) calls `syncFromAudit`. Automatic sync on import is preferred; the button is a fallback. |

---

## 37. Schema Migration

**No new migration needed.** Sprint 4 reuses:
- Sprint 1's contact columns (`phone`, `website_url`, `email`, `social_profiles`)
- Sprint 3's hot-prospect columns (`is_hot_prospect`, `hot_prospect_reason`, `hot_prospect_set_at`, `hot_prospect_deprioritized`, `auto_followup_count`)
- Sprint 3's `state` column
- Existing `pain_score`, `estimated_tier`, `estimated_fee_cents`, `gbp_claimed`, `has_website`, `nap_consistent`, `unaddressed_reviews` columns

### Config additions

Add to `unifiedConfig` (marketing ops section, extending Sprint 3's config):
```typescript
marketingOps: {
  hotProspect: {
    // ... Sprint 3 config ...
    painScoreThreshold: 7,
    autoFollowUpCadenceDays: 3,
    maxAutoFollowUps: 5,
    schedulerIntervalHours: 6,
    confidenceThreshold: 'medium',
    skipNationalChains: true,
    // Sprint 4 additions:
    skipMismatchedIdentity: true,  // skip sync when identity_status == 'mismatched'
    autoSyncOnImport: true,        // auto-run syncFromAudit after importExternalResult
  },
}
```

---

## 38. Tasks

### Task 23: Backend — Register `business_analysis` output schema

| Sub-Task | File | Description |
|----------|------|-------------|
| Define Zod schema | `apps/api/src/validators/business-analysis.schema.ts` (NEW) | Define `businessAnalysisSchema` (Zod) matching the production seek prompt's JSON schema. Include: `audit_metadata` (with `requested_business`, `matched_business`, `identity_status`, `identity_confidence`, `limitations[]`), `summary`, `platforms` (google/yelp/facebook with full per-platform fields), `combined_review_metrics`, `website` (with all assessment fields), `nap_consistency` (with canonical + variations + material_issues), `unanswered_negative_review_examples[]`, `negative_review_themes[]`, `digital_opportunity_score` (with components), `high_attention` + `high_attention_reasons[]`, `recommended_tier` + `tier_rationale`, `estimated_monthly_service_fee`, `recommended_services[]`, `data_quality` (with `conflicts[]`), `sources[]`. Use `z.coerce.number()` for ratings/counts (consistent with `marketAnalysisSchema`). |
| Export schema name + suffix | `apps/api/src/validators/business-analysis.schema.ts` | Export `BUSINESS_ANALYSIS_SCHEMA_NAME = 'business_analysis'`, `BUSINESS_ANALYSIS_PROMPT_SUFFIX` (human-readable schema description appended to prompt text), and `businessAnalysisSchema`. |
| Register in registry | `apps/api/src/validators/market-analysis.schema.ts` (MODIFY) | Add `businessAnalysisSchema` to `OUTPUT_SCHEMA_REGISTRY` with `auditPlatform: 'business_analysis'` and `promptSuffix: BUSINESS_ANALYSIS_PROMPT_SUFFIX`. Import from `business-analysis.schema.ts`. |
| Seed seek template with schema | `apps/api/src/scripts/seed-marketing-ops-templates.ts` (MODIFY) | Update the default `seek` prompt template's `output_schema` to `{ name: 'business_analysis' }` so `importExternalResult` picks up the validator. |

### Task 24: Backend — `MarketingHotProspectService.syncFromAudit` + seek sync

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `syncFromAudit` method | `apps/api/src/services/MarketingHotProspectService.ts` (MODIFY) | New method: `syncFromAudit(auditId, ctx)`. Loads the audit + campaign. Checks `audit_data.audit_metadata.identity_status` — if `mismatched` and `skipMismatchedIdentity` config is true, skip sync + log. Otherwise: sync structured fields (data_quality-gated, per §36a), sync contacts (null-only), derive hotness (same OR logic as Sprint 3). Returns `{ campaignId, fieldsSynced, contactsSynced, hotProspectMarked, identityStatus, skipped }`. |
| Refactor shared sync helpers | `apps/api/src/services/MarketingHotProspectService.ts` (MODIFY) | Extract shared field-sync logic from `syncFromExecution` (Sprint 3) into private helpers: `syncDataQualityGatedField`, `syncContactField`, `deriveHotness`, `mapGbpStatus`, `mapWebsiteStatus`, `mapNapStatus`. Both `syncFromExecution` and `syncFromAudit` use these helpers. |
| Wire auto-sync on import | `apps/api/src/services/MarketingPromptService.ts` (MODIFY) | In `importExternalResult`, after audit creation, if `autoSyncOnImport` config is true and `auditPlatform === 'business_analysis'`, call `MarketingHotProspectService.syncFromAudit(audit.id, ctx)`. Best-effort — catch errors, log, don't fail the import. |
| Add "Sync to campaign" API | `apps/api/src/routes/marketing-ops.ts` (MODIFY) | `POST /:campaignId/audits/:auditId/sync` — calls `syncFromAudit` manually. For when auto-sync is disabled or for re-syncing after editing audit data. Returns the sync report. |

### Task 25: Frontend — `BusinessAnalysisAuditCard` component

| Sub-Task | File | Description |
|----------|------|-------------|
| Create `BusinessAnalysisAuditCard` | `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx` (NEW) | Renders audits where `platform === 'business_analysis'` and `audit_data` has the seek prompt structure. Parallel to `CategoryAnalysisAuditCard` + `CityAnalysisAuditCard`. |
| Card layout | `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx` | Sections: (1) **Identity verification header** (requested vs matched business name, identity_status badge: green confirmed / amber ambiguous / red mismatched, identity_confidence, limitations[]); (2) Summary paragraph; (3) Platform ratings table (Google / Yelp / Facebook — rating, total reviews, response rate, unanswered count, data_status); (4) GBP assessment (profile_status badge, primary_category, additional_categories[], displayed_name/address/phone/website, profile_issues[]); (5) Website assessment (status badge, mobile_friendly, https, contact_info_visible, click_to_call, CTA, service_info, location_info, issues[], conversion_opportunities[]); (6) NAP consistency (overall_status badge, canonical name/address/phone, name/address/phone variations, material_issues[]); (7) Combined review metrics (total, with response, unanswered, negative unanswered, positive unanswered, response rate %, unanswered rate %, counts_complete flag); (8) Unanswered negative review examples (up to 3 — platform, rating, date, complaint_summary, response_status, verification_status); (9) Negative review themes (theme + observed_frequency badge + supporting_review_count + summary); (10) Digital opportunity score (score badge 0-10 color-coded + classification + component breakdown bar chart + rationale); (11) High-attention badge (red if true, with reasons tooltip); (12) Recommended tier (tier badge + tier_rationale + fee range + recommended_services[]); (13) **Data quality block** (confidence badge, verified_fields, unavailable_fields, conflicts[], limitations[]); (14) Sources list (platform, source_type, url, accessed_date) |
| Wire into Audits tab | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (MODIFY) | Add conditional: if `audit.platform === 'business_analysis' && audit.audit_data`, render `BusinessAnalysisAuditCard`. Alongside the existing `CategoryAnalysisAuditCard` + `CityAnalysisAuditCard` (Sprint 3) conditionals. |
| Identity warning banner | `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx` | If `identity_status === 'ambiguous'`, show an amber warning banner: "The AI found multiple businesses matching this name. Verify this audit is about the correct business before relying on its data." If `mismatched`, show a red banner: "This audit appears to be about a different business. Field sync was skipped." |
| Action buttons | `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx` | "Copy summary" (copies the `summary` paragraph); "Save to campaign notes" (appends score + tier + high_attention + themes + recommended_services to `campaign.notes`); "Sync to campaign" (calls `POST /:campaignId/audits/:auditId/sync` — re-syncs fields onto campaign) |

### Task 26: Frontend — Wire seek execution import → audit → sync

| Sub-Task | File | Description |
|----------|------|-------------|
| Verify import flow creates audit | `apps/web/src/services/MarketingOpsService.ts` (VERIFY) | The existing `importExternalResult` call (used for category_analysis imports) should now also work for seek prompts once the schema is registered. No frontend changes needed — the import form already supports all prompt types. Verify the audit appears in the Audits tab after import. |
| Add "Sync to campaign" button call | `apps/web/src/services/MarketingOpsService.ts` (MODIFY) | Add `syncAuditToCampaign(campaignId, auditId)` method calling `POST /:campaignId/audits/:auditId/sync`. Used by the `BusinessAnalysisAuditCard` action button. |
| Type additions | `apps/web/src/services/MarketingOpsService.ts` (MODIFY) | Add `BusinessAnalysisAudit` type matching the seek JSON schema (for the card's props). |

---

## 39. API Contract

### `POST /api/admin/marketing-ops/:campaignId/audits/:auditId/sync`

**Request:** no body

**Response 200:**
```json
{
  "campaignId": "mc-1",
  "auditId": "maud-1",
  "fieldsSynced": ["pain_score", "estimated_tier", "gbp_claimed", "has_website", "nap_consistent", "unaddressed_reviews"],
  "contactsSynced": ["phone"],
  "hotProspectMarked": true,
  "hotProspectReason": "seek audit: score=8, tier=tier_1, high_attention=true",
  "identityStatus": "confirmed",
  "skipped": false
}
```

**Response 200 (skipped — mismatched identity):**
```json
{
  "campaignId": "mc-1",
  "auditId": "maud-1",
  "fieldsSynced": [],
  "contactsSynced": [],
  "hotProspectMarked": false,
  "identityStatus": "mismatched",
  "skipped": true,
  "skipReason": "identity_status is mismatched — audit appears to be about a different business"
}
```

---

## 40. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC53 | The `business_analysis` Zod schema validates a valid seek prompt JSON output without errors | Unit test: parse a sample seek JSON, assert no Zod errors |
| AC54 | The `business_analysis` Zod schema rejects an invalid seek JSON (missing required field, wrong type) with field-level errors | Unit test: parse a malformed JSON, assert Zod error with field path |
| AC55 | `importExternalResult` with a `seek` template (with `output_schema.name = 'business_analysis'`) validates the JSON and creates an audit with `platform = 'business_analysis'` | Integration test: import a seek result, GET audits for campaign, assert `business_analysis` audit present |
| AC56 | `importExternalResult` with a `seek` template that has no `output_schema` (or unregistered name) skips validation + audit creation (backward compatible) | Integration test: import with unregistered schema, assert no audit created, no throw |
| AC57 | `syncFromAudit` syncs `pain_score` from `digital_opportunity_score.score` (integer, no rounding), `estimated_tier`, `gbp_claimed`, `has_website`, `nap_consistent` onto the campaign | Integration test: import seek audit, run sync, GET campaign, assert fields match |
| AC58 | `syncFromAudit` syncs `phone` from `audit_metadata.matched_business.phone` if campaign phone is null; never overwrites existing | Unit test: null phone → set; existing phone → unchanged |
| AC59 | `syncFromAudit` syncs `website_url` from `website.url` if campaign website_url is null; never overwrites existing | Unit test: null website_url → set; existing → unchanged |
| AC60 | `syncFromAudit` sets `is_hot_prospect = true` when `high_attention == true` OR `digital_opportunity_score.score >= 7` OR `recommended_tier == 'tier_1'` | Integration test: import audit with score 8, run sync, assert hot |
| AC61 | `syncFromAudit` does NOT set hotness when `score: 3`, `high_attention: false`, `tier: "tier_3"` | Integration test: run sync, assert `is_hot_prospect` unchanged |
| AC62 | `syncFromAudit` skips sync entirely when `identity_status == 'mismatched'` and `skipMismatchedIdentity` is true | Unit test: mismatched audit, run sync, assert `skipped: true`, no fields synced |
| AC63 | `syncFromAudit` syncs normally when `identity_status == 'ambiguous'` but includes "identity ambiguous" in `hot_prospect_reason` | Unit test: ambiguous audit, run sync, assert fields synced + reason includes "identity ambiguous" |
| AC64 | Data-quality-gated sync: fields in `verified_fields[]` overwrite; unverified fill nulls only; `unavailable_fields[]` don't sync | Unit test: 3 scenarios (same as Sprint 3 AC32) |
| AC65 | Auto-sync on import: if `autoSyncOnImport` is true, `importExternalResult` calls `syncFromAudit` after audit creation | Integration test: import seek result with config on, GET campaign, assert fields synced without manual button |
| AC66 | Auto-sync failure doesn't fail the import: if `syncFromAudit` throws, the audit is still created and the import returns successfully | Integration test: mock sync to throw, import, assert audit created + import success + error logged |
| AC67 | The `BusinessAnalysisAuditCard` renders all 14 sections (identity, summary, platforms, GBP, website, NAP, review metrics, review examples, themes, score, high-attention, tier, data quality, sources) | Manual: seed a `business_analysis` audit, open campaign Audits tab, verify all sections render |
| AC68 | The identity verification header shows `identity_status` badge (green confirmed / amber ambiguous / red mismatched) + `identity_confidence` + `limitations[]` | Manual: verify in the card from AC67 |
| AC69 | When `identity_status === 'ambiguous'`, an amber warning banner is displayed | Manual: seed ambiguous audit, verify banner |
| AC70 | When `identity_status === 'mismatched'`, a red warning banner is displayed noting sync was skipped | Manual: seed mismatched audit, verify banner |
| AC71 | The data quality block displays `confidence` badge (green/amber/red), `verified_fields[]`, `unavailable_fields[]`, `conflicts[]`, and `limitations[]` | Manual: verify in the card from AC67 |
| AC72 | The digital opportunity score badge is color-coded (0-3 green, 4-6 amber, 7-8 orange, 9-10 red) with component breakdown | Manual: verify in the card from AC67 |
| AC73 | The "Sync to campaign" button calls `POST /:campaignId/audits/:auditId/sync` and refreshes the campaign | Manual: click button, verify campaign fields update |
| AC74 | Sprint 2's `buildFreshSnapshot` reads the latest `business_analysis` audit's `audit_data` for fresh review counts/ratings (same as it reads `city_analysis` audits from Sprint 3) | Integration test: create business_analysis audit, call `buildFreshSnapshot`, assert snapshot reflects audit values |
| AC75 | A campaign with both a `business_analysis` audit (hot) and a `city_analysis` audit (hot) has `is_hot_prospect = true` with the reason from whichever synced most recently | Integration test: sync city_analysis (hot), then sync business_analysis (hot), assert reason reflects seek audit |

---

## 41. Out of Scope (Sprint 4)

| Item | Why deferred |
|------|--------------|
| **Auto-running the seek prompt** (calling the AI from within the app) | The seek prompt is run externally (ChatGPT/external agent) and imported via `importExternalResult`. In-app AI execution is a future enhancement. |
| **Seek prompt template editor in the UI** | The seek prompt body is seeded via script. A UI editor for prompt templates exists already (prompt workspace) but the seek prompt's compliance-aware body is long and best managed via seed script + version control. |
| **Identity resolution workflow** (operator confirms/rejects ambiguous identity) | For v1, ambiguous identity is surfaced as a warning banner. An interactive "confirm this is the right business" workflow is a future enhancement. |
| **Seek audit → Sprint 3 auto-follow-up trigger** | Sprint 3's auto-follow-up scheduler runs on `is_hot_prospect`. If a seek audit sets hot, the scheduler will pick it up automatically. No Sprint 4 work needed — but confirm this works end-to-end (AC75 covers the hotness part; scheduler interaction is covered by Sprint 3 ACs). |
| **Multi-seek audit history comparison** (comparing multiple seek audits over time for the same business) | Each seek import creates a new audit. Comparing audits (score trend, review count growth) is a future analytics enhancement. |
| **Seek audit → GBP enrichment fallback** | If the seek audit has `matched_business.phone` but GBP enrichment (Sprint 1) already populated it, the seek audit won't overwrite. A "prefer seek audit over GBP" mode is a future config option. |

---

## 42. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Seek prompt output format varies between AI providers → Zod validation fails | The schema uses `z.coerce.number()` + `z.nullable()` generously (consistent with `marketAnalysisSchema`). `importExternalResult` logs the full Zod error with field paths on failure. Operator can edit the JSON and re-import. |
| Identity mismatch → wrong business's data synced to campaign | `syncFromAudit` checks `identity_status`; skips sync on `mismatched`; warns on `ambiguous`. The card shows a red/amber banner. Operator can manually verify before clicking "Sync to campaign". |
| Seek audit overwrites City Pain Scan data (or vice versa) | Both syncs use data_quality-gated rules. The most recent sync wins for verified fields. `hot_prospect_reason` reflects the most recent sync. Operator override always wins. |
| Seek audit + City Pain Scan audit both set hot → hot_prospect_reason flaps | `hot_prospect_reason` is overwritten on each sync. The reason reflects the most recent sync source. This is acceptable — the campaign is hot either way. |
| Large seek JSON (with sources, examples, themes) → audit_data column size | `audit_data` is JSONB (unbounded). The seek JSON is typically < 50KB. No concern. |
| `autoSyncOnImport` fails silently → operator doesn't know sync didn't happen | The sync result is logged. The audit card's "Sync to campaign" button lets operators manually re-sync. A future enhancement could surface sync status on the audit card. |
| Seek Zod schema is strict → rejects valid-but-slightly-different output | The schema uses nullable fields + coerce.number() + enums with `unable_to_verify` fallbacks. Edge cases will surface during testing; loosen the schema as needed. |

---

## 43. File Inventory (Sprint 4)

**New files:**
- `apps/api/src/validators/business-analysis.schema.ts`
- `apps/api/src/services/__tests__/BusinessAnalysisSchema.test.ts`
- `apps/api/src/services/__tests__/MarketingHotProspectServiceSeekSync.test.ts`
- `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx`

**Modified files:**
- `apps/api/src/validators/market-analysis.schema.ts` (add `business_analysis` to `OUTPUT_SCHEMA_REGISTRY`)
- `apps/api/src/services/MarketingHotProspectService.ts` (add `syncFromAudit` method; refactor shared sync helpers)
- `apps/api/src/services/MarketingPromptService.ts` (auto-sync hook in `importExternalResult`)
- `apps/api/src/routes/marketing-ops.ts` (add `POST /:campaignId/audits/:auditId/sync` route)
- `apps/api/src/scripts/seed-marketing-ops-templates.ts` (update seek template `output_schema`)
- `apps/web/src/services/MarketingOpsService.ts` (add `syncAuditToCampaign` method + `BusinessAnalysisAudit` type)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (add `BusinessAnalysisAuditCard` conditional in Audits tab)

**No new migration** — reuses Sprint 1 + Sprint 3 columns.

---

## 44. Open Questions (Sprint 4)

1. **~~Seek prompt output schema~~** — **RESOLVED.** The production seek prompt (compliance-aware version) produces a single-business audit with identity verification, per-platform review metrics, website assessment, NAP consistency, negative review themes, digital opportunity score (0-10), high-attention flag, recommended tier + fee, data quality, and structured sources. The structure is documented in §34 and mapped in §36a. The Zod schema is defined in Task 23.
2. **`syncFromAudit` vs `syncFromExecution`** — Sprint 3's `syncFromExecution` parses execution output and syncs multiple businesses. Sprint 4's `syncFromAudit` takes a single already-created audit and syncs its fields. Should these share a common base method, or is the separation cleaner? Recommend: separate methods with shared private helpers (data_quality gating, contact sync, hotness derivation, status mapping). The input shapes are different (execution JSON with `businesses[]` vs single audit JSON).
3. **Auto-sync on import vs manual sync button** — should `importExternalResult` auto-run `syncFromAudit` after creating the audit, or should the operator click "Sync to campaign" manually? Recommend: auto-sync (configurable via `autoSyncOnImport`), with the manual button as a fallback. Auto-sync reduces operator friction — the audit is the freshest data, sync it immediately.
4. **Identity ambiguity handling** — when `identity_status == 'ambiguous'`, should sync proceed (with a warning) or be skipped (like `mismatched`)? Recommend: proceed with warning. The operator can see the ambiguous banner and manually override if needed. Skipping would lose valuable data in cases where the AI is just being cautious.
5. **Seek audit + City Pain Scan audit conflict** — if a seek audit sets `pain_score = 8` and a later City Pain Scan sets `pain_score = 6`, the campaign's `pain_score` becomes 6 (most recent wins). Is this correct, or should the higher score win (most pessimistic)? Recommend: most recent wins (consistent with "freshest data" principle). Operator can manually override.
6. **Should seek audit hotness trigger Sprint 3's auto-follow-up scheduler?** — Yes, by design. The scheduler checks `is_hot_prospect` regardless of which sync set it. A seek audit flagging hot should trigger auto-follow-ups just like a City Pain Scan. Confirm this works end-to-end (no Sprint 4 code needed — just verify).
7. **Seek prompt template seeding** — should the default seek template be updated in-place (replacing the current body) or versioned (create a new version, keep the old)? Recommend: update in-place via seed script. The current seek template body is likely a placeholder; the production prompt is the real content. Versioning is for when operators customize the prompt.

---

# Part V — Sprint 5: Scan-to-Campaign Spawning

## 45. Executive Summary

Sprints 3 and 4 close the loop between scan executions and *existing* campaigns — but only for businesses that already have a campaign record. When a City Pain Scan audits 15 businesses and only 3 have matching campaigns, the other 12 are logged as `unmatched` in the sync report and discarded. The operator has no way to act on them without manually creating 12 campaigns one by one.

Sprint 5 closes this gap by turning the sync report into an **actionable surface**:

1. **Surface the sync report in the UI** — after a City Pain Scan sync runs (either via the execution completion hook or a manual re-sync), the report is visible on the parent campaign's detail page with matched / unmatched / skipped-chains breakdowns and per-business actions.
2. **Extend `deriveBusinessCampaign` to accept the full scan business payload** — the existing method accepts only `{businessName, rating, reviewCount, location}`. Sprint 5 adds a richer variant that seeds all scan-derived fields (pain_score, estimated_tier, estimated_fee_cents, gbp_claimed, has_website, nap_consistent, unaddressed_reviews, phone, website_url, high_attention, hot_prospect_reason) onto the new child campaign and creates the `city_analysis` audit on it — so the child is fully populated at creation time, not just a stub.
3. **Add "Create campaign" + "Create all unmatched" actions** — per-unmatched-business and bulk creation from the sync report UI.
4. **Persist the sync report** — currently the report is returned from `syncFromExecution` but only logged. Sprint 5 stores the latest report on the parent campaign (or execution metadata) so it's retrievable for the UI without re-running the sync.

### Existing infrastructure (already in place)

| Piece | Location | What it does |
|-------|----------|--------------|
| `deriveBusinessCampaign` | `MarketingCampaignService.ts:410` | Creates a business-scope child from a parent, inherits category/city/tone/attributes, sets `parent_campaign_id`. Currently accepts minimal fields only. |
| `POST /:id/derive-business` | `marketing-ops.ts:753` | Route for the above. |
| `service.deriveBusinessCampaign` | `MarketingOpsService.ts:789` | Frontend service client. |
| `CategoryAnalysisAuditCard` derive buttons | `CategoryAnalysisAuditCard.tsx:79-114` | UI for spawning business campaigns from category-scan competitors. Proves the pattern works end-to-end. |
| `syncFromExecution` report | `MarketingHotProspectService.ts:97-107` | Returns `{ matched, unmatched, skippedChains, hotProspectsMarked, summaryStored }` — but only logs it, doesn't persist or surface it. |
| `parent_campaign_id` column | `mkt_campaigns_list` | Lineage link from child → parent. Already populated by `deriveBusinessCampaign`. |
| `mkt_campaigns_list_parent_campaign_idTomkt_campaigns_list` relation | `schema.prisma` | Prisma relation for parent → children. Already included in `getCampaign` response. |

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Sync report persistence** | The latest `syncFromExecution` report is stored as execution metadata (or a dedicated column) so the UI can retrieve it without re-running the sync. Stored on the execution record, keyed by execution ID. |
| **Sync report UI** | A `SyncReportCard` component on the parent campaign's detail page (Overview or a new "Scan Results" tab) showing matched campaigns (with links), unmatched businesses (with "Create campaign" buttons), skipped chains count, and hot-prospects-marked count. |
| **Rich derive** | `deriveBusinessCampaignFromScanBusiness` accepts the full City Pain Scan business JSON and seeds all fields + creates the `city_analysis` audit on the new child. The child starts at `seek` stage with hot-prospect already derived. |
| **Bulk create** | "Create all unmatched" button that spawns business campaigns for every unmatched business in the report. Returns a batch result with created campaign IDs. |
| **Re-sync action** | "Re-run sync" button that calls `syncFromExecution` again (useful after creating campaigns for previously-unmatched businesses — a re-sync will now match them). |

## 46. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│         City Pain Scan execution (existing)                         │
│   → syncFromExecution() runs (Sprint 3)                             │
│   → returns SyncReport { matched, unmatched, skippedChains, ... }   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ NEW: persist report on execution
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Execution record (extended)                            │
│   + sync_report JSONB  — { matched, unmatched, skippedChains,       │
│                            hotProspectsMarked, summaryStored,       │
│                            syncedAt }                               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ GET /:id/sync-report
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SyncReportCard (NEW frontend component)                │
│   • Matched: list of {campaignId, businessName, hot} → links       │
│   • Unmatched: list of {businessName, reason} → [Create campaign]  │
│   • Skipped chains: N                                               │
│   • Hot marked: K                                                   │
│   • [Create all unmatched] [Re-run sync]                            │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ "Create campaign" click
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│     deriveBusinessCampaignFromScanBusiness()                        │
│   1. Load parent campaign (city-scope)                              │
│   2. Create business-scope child:                                   │
│      - Inherit: category, city, state, neighborhood, tone, attrs    │
│      - Seed from scan business: business_name, pain_score,          │
│        estimated_tier, estimated_fee_cents, gbp_claimed,            │
│        has_website, nap_consistent, unaddressed_reviews,            │
│        phone, website_url, is_hot_prospect, hot_prospect_reason     │
│      - Set parent_campaign_id                                       │
│   3. Create city_analysis audit on child (full business JSON)       │
│   4. Return child campaign                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 46a. Field Mapping — Scan Business → New Child Campaign

| Scan business JSON path | Child campaign field | Sync rule |
|--------------------------|---------------------|-----------|
| `business_name` | `business_name` | Always set |
| `category` | `category` | Always set (from business, fallback to parent) |
| `audit_metadata.city` | `city` | From scan metadata |
| `audit_metadata.state` | `state` | From scan metadata |
| `digital_opportunity_score.score` | `pain_score` | Integer, no rounding |
| `recommended_tier` | `estimated_tier` | Direct map |
| `estimated_monthly_service_fee.minimum × 100` | `estimated_fee_cents` | If confidence >= threshold |
| `platforms.google.profile_status` | `gbp_claimed` | Mapped (claimed/likely_claimed → true) |
| `website.status` | `has_website` | Mapped (working → 'yes', etc.) |
| `nap_consistency.status` | `nap_consistent` | Mapped (consistent → true) |
| `platforms.google.observable_unanswered_reviews` | `unaddressed_reviews` | If in verified_fields |
| `business_phone` | `phone` | Always set (null-only on existing, but new campaign = always) |
| `website.url` | `website_url` | Always set if non-null |
| `high_attention` OR `score >= 7` OR `tier_1` | `is_hot_prospect` + `hot_prospect_reason` | Same OR logic as Sprint 3 |
| Parent's `tone` | `tone` | Inherited |
| Parent's `attributes` | `attributes` | Inherited |
| Parent's `neighborhood` | `neighborhood` | Inherited |

## 47. Schema Migration

```sql
-- ============================================================
-- Migration 140: Marketing Ops — Sync Report Persistence
-- ============================================================
-- Stores the latest City Pain Scan sync report on the execution
-- record so the UI can retrieve it without re-running the sync.
-- ============================================================

ALTER TABLE mkt_prompt_executions_list
  ADD COLUMN IF NOT EXISTS sync_report JSONB;

-- Index for fast lookup by campaign_id
CREATE INDEX IF NOT EXISTS idx_mkt_executions_sync_report
  ON mkt_prompt_executions_list(campaign_id)
  WHERE sync_report IS NOT NULL;
```

### Prisma Sync

After migration, run `npx prisma db pull && npx prisma generate` to sync the `sync_report` column.

### Rollback

```sql
ALTER TABLE mkt_prompt_executions_list
  DROP COLUMN IF EXISTS sync_report;
DROP INDEX IF EXISTS idx_mkt_executions_sync_report;
```

## 48. Tasks

### Task 27: Backend — Persist sync report + retrieve endpoint

| Sub-Task | File | Description |
|----------|------|-------------|
| Persist report in `syncFromExecution` | `apps/api/src/services/MarketingHotProspectService.ts` (MODIFY) | After sync completes, store the report as `sync_report` JSONB on the execution record: `this.prisma.mkt_prompt_executions_list.update({ where: { id: executionId }, data: { sync_report: report as any } })`. Include a `syncedAt` timestamp in the stored report. |
| Add `getSyncReport` method | `apps/api/src/services/MarketingHotProspectService.ts` (MODIFY) | `getSyncReport(executionId, ctx)` — loads the execution and returns the stored `sync_report` JSONB. Returns null if no sync has run. |
| Add `GET /:id/sync-report` route | `apps/api/src/routes/marketing-ops.ts` (MODIFY) | Returns the stored sync report for an execution. `GET /executions/:executionId/sync-report` (or `GET /:campaignId/sync-report?executionId=...` if we want it campaign-scoped). |

### Task 28: Backend — Rich derive from scan business

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `deriveBusinessCampaignFromScanBusiness` | `apps/api/src/services/MarketingHotProspectService.ts` (MODIFY) | New method: `deriveBusinessCampaignFromScanBusiness(parentId, business, ctx)`. Loads the parent (city-scope) campaign. Creates a business-scope child with all fields seeded from the scan business JSON (per §46a field mapping). Creates a `city_analysis` audit on the child with the full business JSON. Derives hotness (same OR logic). Sets `parent_campaign_id`. Returns the new child campaign. |
| Add `POST /:id/derive-from-scan` route | `apps/api/src/routes/marketing-ops.ts` (MODIFY) | Body: `{ business: BusinessJson }` (the full scan business object). Calls `deriveBusinessCampaignFromScanBusiness`. Returns 201 with the new campaign. |
| Add `POST /:id/derive-all-unmatched` route | `apps/api/src/routes/marketing-ops.ts` (MODIFY) | Body: `{ executionId: string }`. Loads the sync report, iterates `unmatched[]`, calls `deriveBusinessCampaignFromScanBusiness` for each. Returns `{ created: [{campaignId, businessName}], failed: [{businessName, error}] }`. Best-effort — one failure doesn't stop the batch. |

### Task 29: Frontend — SyncReportCard + actions

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `getSyncReport` service method | `apps/web/src/services/MarketingOpsService.ts` (MODIFY) | `getSyncReport(executionId)` → calls `GET /executions/:executionId/sync-report`. |
| Add `deriveFromScan` + `deriveAllUnmatched` service methods | `apps/web/src/services/MarketingOpsService.ts` (MODIFY) | `deriveFromScan(parentId, business)` → `POST /:id/derive-from-scan`. `deriveAllUnmatched(parentId, executionId)` → `POST /:id/derive-all-unmatched`. |
| Create `SyncReportCard` | `apps/web/src/components/marketing-ops/SyncReportCard.tsx` (NEW) | Renders the sync report: matched campaigns (links), unmatched businesses (with "Create campaign" buttons), skipped chains count, hot-prospects-marked count, "Create all unmatched" + "Re-run sync" buttons. Shows `syncedAt` timestamp. |
| Wire into CampaignDetailClient | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (MODIFY) | For city-scope campaigns with a recent `city_analysis` execution, fetch + render `SyncReportCard` in the Overview tab. |

## 49. API Contract

### `GET /api/admin/marketing-ops/executions/:executionId/sync-report`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "executionId": "mpe-1",
    "city": "Plainfield",
    "state": "Indiana",
    "businessesInOutput": 15,
    "matched": [{ "campaignId": "mc-1", "businessName": "Acme HVAC", "hot": true }],
    "unmatched": [{ "businessName": "Bob's Plumbing", "reason": "No matching campaign" }],
    "skippedChains": 2,
    "hotProspectsMarked": 5,
    "summaryStored": true,
    "syncedAt": "2026-07-30T12:00:00Z"
  }
}
```

### `POST /api/admin/marketing-ops/:id/derive-from-scan`

**Request:**
```json
{
  "business": {
    "rank": 4,
    "business_name": "Bob's Plumbing",
    "category": "Plumbing",
    "business_phone": "(317) 555-0100",
    "website": { "url": "https://bobsplumbing.com", "status": "working" },
    "digital_opportunity_score": { "score": 8 },
    "recommended_tier": "tier_1",
    "high_attention": true,
    "platforms": { "google": { "profile_status": "unclaimed", "total_reviews": 45, "rating": 3.2 } }
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "mc-new-1",
    "scope": "business",
    "business_name": "Bob's Plumbing",
    "stage": "seek",
    "parent_campaign_id": "mc-city-1",
    "is_hot_prospect": true,
    "hot_prospect_reason": "City Pain Scan rank #4: score=8, tier=tier_1, high_attention=true",
    "pain_score": 8
  }
}
```

### `POST /api/admin/marketing-ops/:id/derive-all-unmatched`

**Request:** `{ "executionId": "mpe-1" }`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "created": [{ "campaignId": "mc-new-1", "businessName": "Bob's Plumbing" }],
    "failed": [{ "businessName": "Jane's Electrical", "error": "Parent campaign not found" }]
  }
}
```

## 50. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC76 | `syncFromExecution` persists the sync report as `sync_report` JSONB on the execution record | Integration test: run sync, query execution, assert `sync_report` non-null with matched/unmatched arrays |
| AC77 | `getSyncReport(executionId)` returns the stored report | Unit test: persist a report, call getSyncReport, assert shape matches |
| AC78 | `deriveBusinessCampaignFromScanBusiness` creates a business-scope child with all scan fields seeded (pain_score, tier, fee, gbp_claimed, has_website, nap_consistent, phone, website_url) | Integration test: derive from a scan business, GET child campaign, assert all fields match |
| AC79 | `deriveBusinessCampaignFromScanBusiness` creates a `city_analysis` audit on the child with the full business JSON | Integration test: derive, GET audits for child, assert `city_analysis` audit present |
| AC80 | `deriveBusinessCampaignFromScanBusiness` sets `is_hot_prospect` when the business has `score >= 7` OR `high_attention == true` OR `tier_1` | Unit test: derive from a hot business, assert child `is_hot_prospect == true` |
| AC81 | `deriveBusinessCampaignFromScanBusiness` sets `parent_campaign_id` to the parent campaign | Unit test: derive, assert child's `parent_campaign_id` matches parent |
| AC82 | `deriveBusinessCampaignFromScanBusiness` inherits category, city, state, tone, attributes from the parent | Unit test: derive, assert inherited fields match parent |
| AC83 | `POST /:id/derive-all-unmatched` creates campaigns for all unmatched businesses in the report and returns created/failed arrays | Integration test: seed a sync report with 3 unmatched, call derive-all, assert 3 created |
| AC84 | `deriveBusinessCampaignFromScanBusiness` does NOT create a duplicate if a campaign already exists for that business name + city + category | Unit test: derive twice for the same business, assert second call returns the existing campaign (or throws a clear error) |
| AC85 | The `SyncReportCard` renders matched campaigns (with links), unmatched businesses (with "Create campaign" buttons), and counts | Manual: seed a sync report, open campaign detail, verify card |
| AC86 | Clicking "Create campaign" on an unmatched business calls `deriveFromScan` and redirects to the new child campaign | Manual: click button, verify redirect + child campaign loads |
| AC87 | Clicking "Create all unmatched" calls `deriveAllUnmatched` and shows the created/failed result | Manual: click button, verify batch result |
| AC88 | Clicking "Re-run sync" calls `syncFromExecution` again and refreshes the report | Manual: create campaigns for unmatched, click re-run, verify they now appear in "matched" |

## 51. Out of Scope (Sprint 5)

| Item | Why deferred |
|------|--------------|
| **Auto-creating campaigns for all unmatched businesses during sync** | Could be noisy (15 new campaigns per scan). Sprint 5 makes it operator-initiated. Auto-create-on-sync is a future config option. |
| **Deduplication across scans** | If two City Pain Scans both audit "Acme HVAC", Sprint 5 creates one child per scan (unless a matching campaign already exists). Cross-scan dedup is a future enhancement. |
| **Seek audit mismatch → create new campaign** | When a seek audit comes back `identity_status: 'mismatched'`, Sprint 4 skips sync. Offering to create a new campaign for the *matched* business is a future enhancement. |
| **Category-scope scan → business spawning** | The existing `CategoryAnalysisAuditCard` derive buttons already handle this (top-5 competitors). Sprint 5 focuses on City Pain Scan's richer per-business data. |
| **Sync report history** | Sprint 5 stores only the latest report per execution. A history of sync runs (with diffs) is a future analytics enhancement. |

## 52. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Bulk create spawns many campaigns at once → noisy pipeline | "Create all" shows a confirmation modal with the count before proceeding. Operator can also create individually. |
| Duplicate campaigns for the same business | `deriveBusinessCampaignFromScanBusiness` checks for an existing campaign by business_name + city + category before creating. Returns the existing one if found (AC84). |
| Sync report grows large (15 businesses × full JSON) | `sync_report` JSONB is bounded by the scan output size (max 15 businesses). PostgreSQL JSONB handles this efficiently. |
| Parent campaign deleted after sync report stored | `sync_report` is on the execution record, which is cascade-deleted with the campaign. No orphaned reports. |

## 53. File Inventory (Sprint 5)

**Backend:**
- `apps/api/src/services/MarketingHotProspectService.ts` (MODIFY — persist report, getSyncReport, deriveBusinessCampaignFromScanBusiness)
- `apps/api/src/routes/marketing-ops.ts` (MODIFY — 3 new routes)
- `database/migrations/140_marketing_ops_sync_report.sql` (NEW)

**Frontend:**
- `apps/web/src/services/MarketingOpsService.ts` (MODIFY — 3 new service methods)
- `apps/web/src/components/marketing-ops/SyncReportCard.tsx` (NEW)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (MODIFY — wire SyncReportCard)

## 54. Open Questions (Sprint 5)

1. **Sync report storage location** — on the execution record (`mkt_prompt_executions_list.sync_report`) or on the campaign (`mkt_campaigns_list`)? Recommend: execution record. The report is execution-scoped (one report per scan run), and executions are already linked to campaigns. Multiple scans on the same campaign each have their own report.
2. **Deduplication on derive** — should `deriveBusinessCampaignFromScanBusiness` check for an existing campaign by business_name + city + category before creating? Recommend: yes, return the existing one if found (AC84). Prevents duplicates from "Create all" + manual "Create" on the same business.
3. **Sync report tab vs Overview** — should the `SyncReportCard` be in the Overview tab or a new "Scan Results" tab? Recommend: Overview for city-scope campaigns (it's the primary content). A separate tab is overkill for one card.
4. **Re-run sync from UI** — should "Re-run sync" call `syncFromExecution` (which re-parses the execution output) or just re-match businesses against campaigns? Recommend: full re-run. The execution output hasn't changed, but new campaigns may exist since the last sync. Re-running picks them up.
5. **Bulk create confirmation** — should "Create all unmatched" show a confirmation modal? Recommend: yes, with the count and business names. Prevents accidental mass creation.
