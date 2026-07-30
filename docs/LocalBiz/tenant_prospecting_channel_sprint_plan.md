# Sprint Plan: Tenant Prospecting Channel — Marketing Ops → Tenant Conversion

**Document Version:** 2.0
**Date:** 2026-07-29
**Status:** Enhanced Draft — Gap closures from architecture review incorporated
**Prerequisite:** Marketing Ops Sprint 1–4 complete (campaign pipeline, prompt workspace, deliverables, branding)

---

## 1. Executive Summary

This sprint bridges the Marketing Ops campaign pipeline into a **tenant acquisition channel**. Today, campaigns track prospects from `seek` through `retainer_won` but have no connection to the tenant system. This sprint closes that gap with five complementary features that turn marketing deliverables into tenant conversion tools.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Campaign-to-Tenant Bridge** | Link campaigns to tenants, add `tenant_onboarded` stage (incl. resurrection from `lost`/`dead`), track first/last-touch conversion metrics |
| **Demo Storefront Preview** | Auto-generate a category-matched demo tenant from campaign data so prospects see their future storefront — **and convert that demo tenant into their real tenant on signup** |
| **QR Marketing Deliverables** | Embed QR codes on deliverable PDFs linking to a public preview page with signup CTA |
| **GBP Enhancer + Directory Preview** | Pull prospect's real GBP data, generate an enhancement report, and show a simulated directory listing |
| **Trial-Grant on Conversion** | Auto-grant a BSaaS trial for the capability the deliverable showcased — show the pain, demo the cure, trial the cure |

### v2.0 Gap Closures (from architecture review)

| # | Gap Closed | Change |
|---|-----------|--------|
| G1 | **Auto-advance vs. token expiry collision** — `shown → lost` job (7d) fires while 30-day preview tokens are live; late QR conversions had no valid transition | Resurrection transitions (`lost`/`dead → tenant_onboarded`) + auto-advance job skips campaigns with live unconverted tokens (Task 5A.4) |
| G2 | **Forgeable attribution** — signup reading `?campaign={id}&source=...` query params lets any client attach signups to any campaign | Token-only trust boundary: public CTAs pass only a preview token (`ptoken`); campaign + source resolved server-side (Task 5B.4) |
| G3 | **Demo storefront thrown away** — prospect signs up fresh and rebuilds what they already saw | Demo-to-real tenant conversion is the primary signup path from demos (Task 5B.5) |
| G4 | **No revenue-loop hook on conversion** | `marketing_campaign_converted` billing notification (email + CRM alert) fires on every `tenant_onboarded` transition (Task 5A.1) |
| G5 | **Single-touch attribution lossy** — one `conversion_source` column can't represent multi-touch journeys | `first_touch_source` + `last_touch_source` columns (§4 Step 3) |
| G6 | **Preview page content unscoped** — public page could leak operator pricing/internal audit notes | Explicit response allow-list + rate limiting on public route (Task 5B.1) |
| G7 | **GBP Places API cost unbudgeted** | 72h per-campaign lookup cache + audit-data fallback + forced-refresh cap (Task 5B.2) |
| G8 | **Pipeline serves two populations** — prospects (acquisition) and existing tenants (upsell) share the same funnel | `campaign_origin` column ('prospect' \| 'upsell') separates metrics (§4 Step 3b) |

**Sprint Duration:** 2 sprints (4 weeks)
**Team Size:** 2 full-stack developers, 1 UX/UI designer

---

## 2. Existing Infrastructure (Reuse, Don't Rebuild)

| System | Location | What It Provides |
|--------|----------|-----------------|
| **DemoTenantService** | `apps/api/src/services/DemoTenantService.ts` | Creates demo tenants with templates (grocery, convenience, specialty_retail), pre-populated products, GBP categories, hours, expiration |
| **QR Style Config** | `apps/web/src/lib/qr-style-config.ts` | 4 theme presets (promo, promo-sale, bundle-promo, private-grant) with `buildQROptions()` helper |
| **GBP Sync** | `apps/api/src/services/GBPBusinessInfoSync.ts`, `GBPAdvancedSyncSingletonService.ts`, `GBPCategorySyncService.ts` | Full GBP data pulling, category mapping, business info sync |
| **Directory Listings** | `apps/api/src/routes/directory-mv.ts`, `directory-tenant.ts`, `DirectoryPromotionService.ts` | Materialized view-based directory with photos, categories, promoted stores |
| **Marketing Deliverables** | `apps/api/src/services/MarketingDeliverableService.ts` | jsPDF generation with branding, watermarks, layout specs |
| **Marketing Branding** | `apps/api/src/services/MarketingBrandingService.ts` | Operator branding (logo, colors, footer disclaimer) applied to PDFs |
| **Tenant Creation** | `POST /tenants` in `temp-index.ts` | Creates trial tenant with `starter` tier, links to owner via `user_tenant` |
| **Campaign Pipeline** | `apps/api/src/services/MarketingCampaignService.ts` | 9-stage pipeline with transition rules, stage history, dashboard stats |

---

## 3. Architecture: The Conversion Funnel

```
┌──────────┐    ┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  SEEK    │───→│ PREVIEW     │───→│ SHOWN            │───→│ PAID              │
│(Prospect)│    │ BUILT       │    │                  │    │                   │
└──────────┘    └─────────────┘    └──────────────────┘    └───────────────────┘
                       │                  │                         │
                       ▼                  ▼                         ▼
                ┌─────────────┐    ┌──────────────┐         ┌──────────────────┐
                │ DEMO        │    │ QR DELIVERABLE│         │ DELIVERED        │
                │ STOREFRONT  │    │ + PUBLIC PAGE│         │ + GBP ENHANCER   │
                │ PREVIEW     │    │ + SIGNUP CTA │         │ + DIRECTORY LIST │
                └─────────────┘    └──────────────┘         └──────────────────┘
                                          │                         │
                                          ▼                         ▼
                                   ┌──────────────┐         ┌──────────────────┐
                                   │ TENANT       │────────→│ RETAINER WON     │
                                   │ ONBOARDED    │         │ (existing)       │
                                   │ (NEW STAGE)  │         └──────────────────┘
                                   └──────────────┘
```

### New Stage: `tenant_onboarded`

Added to `VALID_TRANSITIONS` in `MarketingCampaignService.ts`:

```
shown        → ['paid', 'lost', 'tenant_onboarded']   // direct conversion from preview
paid         → ['delivered', 'tenant_onboarded']       // conversion after payment
delivered    → ['retainer_pitched', 'tenant_onboarded', 'closed']
retainer_won → ['lost', 'tenant_onboarded']            // already a tenant, link retroactively
lost         → ['tenant_onboarded']                    // resurrection: late QR/demo conversion (G1)
dead         → ['seek', 'tenant_onboarded']            // resurrection: re-engaged prospect converts (G1)
```

**Resurrection semantics:** When a campaign transitions from `lost` or `dead` to `tenant_onboarded`, `linkTenant` logs stage history with notes indicating the resurrection path (e.g., "Resurrected: converted via qr_deliverable after auto-advance to lost"). The dashboard counts these separately as **resurrected conversions** — a key signal that long-lived QR artifacts outperform the 7-day sales cycle.

---

## 4. Database Changes

### Migration: `129_tenant_prospecting_channel.sql`

```sql
-- ============================================================
-- STEP 1: Add tenant_id to mkt_campaigns_list
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

-- FK to tenants table (nullable — populated when prospect becomes tenant)
DO $$ BEGIN
  ALTER TABLE mkt_campaigns_list
    ADD CONSTRAINT fk_mkt_campaigns_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_tenant ON mkt_campaigns_list(tenant_id);

-- ============================================================
-- STEP 2: Add date_tenant_onboarded column
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS date_tenant_onboarded TIMESTAMPTZ;

-- ============================================================
-- STEP 3: First/last-touch conversion attribution (G5)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS first_touch_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_touch_source VARCHAR(50);
  -- Sources: 'qr_deliverable', 'demo_storefront', 'gbp_enhancer', 'directory_preview', 'manual', 'external'
  -- first_touch_source: write-once, set on the first recorded prospect interaction (token view or admin link)
  -- last_touch_source:  overwritten on every subsequent touch; value at conversion = conversion driver

-- ============================================================
-- STEP 3b: Campaign origin — prospect vs. upsell population (G8)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS campaign_origin VARCHAR(20) NOT NULL DEFAULT 'prospect';
  -- 'prospect': business is not a tenant (acquisition funnel)
  -- 'upsell':   existing tenant buying marketing services (set when admin links a tenant at creation)

-- ============================================================
-- STEP 3c: Demo storefront link on campaign (G3)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS demo_tenant_id VARCHAR(255);

DO $$ BEGIN
  ALTER TABLE mkt_campaigns_list
    ADD CONSTRAINT fk_mkt_campaigns_demo_tenant
    FOREIGN KEY (demo_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_demo_tenant ON mkt_campaigns_list(demo_tenant_id);

-- ============================================================
-- STEP 3d: GBP lookup cache on campaign (G7)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS gbp_lookup_cache JSONB,
  ADD COLUMN IF NOT EXISTS gbp_lookup_cached_at TIMESTAMPTZ;

-- ============================================================
-- STEP 4: Public deliverable preview tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_deliverable_preview_tokens (
  id              VARCHAR(255)  PRIMARY KEY,          -- mdpt-{nanoid}
  deliverable_id  VARCHAR(255),                        -- nullable: demo-storefront tokens have no deliverable
  campaign_id     VARCHAR(255)  NOT NULL,              -- unified trust anchor for ALL public CTAs (G2)
  token_type      VARCHAR(20)   NOT NULL DEFAULT 'deliverable',  -- 'deliverable' | 'demo_storefront'
  token           VARCHAR(255)  UNIQUE NOT NULL,       -- random token for public URL
  expires_at      TIMESTAMPTZ   NOT NULL,
  viewed_at       TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ,
  tenant_id       VARCHAR(255),                        -- populated on signup
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_preview_deliverable
    FOREIGN KEY (deliverable_id) REFERENCES mkt_deliverables_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_preview_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_preview_token ON mkt_deliverable_preview_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mkt_preview_deliverable ON mkt_deliverable_preview_tokens(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_mkt_preview_campaign ON mkt_deliverable_preview_tokens(campaign_id);

-- RLS: public read by token, admin full access
ALTER TABLE mkt_deliverable_preview_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_preview_public_read ON mkt_deliverable_preview_tokens
    FOR SELECT
    USING (true);  -- token validation done in service layer
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_preview_admin_all ON mkt_deliverable_preview_tokens
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_preview_service_write ON mkt_deliverable_preview_tokens
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### Prisma Sync

After migration, run `npx prisma db pull && npx prisma generate` to sync the `tenant_id`, `date_tenant_onboarded`, `first_touch_source`, `last_touch_source`, `campaign_origin`, `demo_tenant_id`, `gbp_lookup_cache` fields on `mkt_campaigns_list` and the new `mkt_deliverable_preview_tokens` model.

### ID Generator

Add to `apps/api/src/lib/id-generator.ts`:

```typescript
// NOTE: prefix is mdpt- (not mpt-) — mpt- is already taken by generatePromptTemplateId
export const generatePreviewTokenId = () => `mdpt-${nanoid(12)}`;
export const generatePreviewToken = () => nanoid(32); // URL-safe token, 32-char entropy
```

---

## 5. Sprint Breakdown

### Sprint 5A: Campaign-to-Tenant Bridge + Demo Storefront (Week 1–2)

**Goal:** Campaigns link to tenants, prospects can preview a demo storefront, and conversion is tracked.

#### Task 5A.1: Campaign Schema + Service Updates

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `tenant_id`, `date_tenant_onboarded`, `first_touch_source`, `last_touch_source`, `campaign_origin`, `demo_tenant_id`, `gbp_lookup_cache` to campaign model | `apps/api/prisma/schema.prisma` | Synced via `db pull` |
| Add `tenant_onboarded` to `CampaignStage` type | `apps/api/src/services/MarketingCampaignService.ts` | Extend the union type |
| Update `VALID_TRANSITIONS` map | `apps/api/src/services/MarketingCampaignService.ts` | Add `tenant_onboarded` as valid target from `shown`, `paid`, `delivered`, `retainer_won`, **plus resurrection from `lost` and `dead`** (G1) |
| Add `STAGE_DATE_FIELDS` entry | `apps/api/src/services/MarketingCampaignService.ts` | `tenant_onboarded: 'date_tenant_onboarded'` |
| Add `linkTenant` method | `apps/api/src/services/MarketingCampaignService.ts` | Links campaign to tenant, transitions to `tenant_onboarded`, sets `last_touch_source` (and `first_touch_source` if unset — write-once), detects resurrection (`lost`/`dead` origin) and logs it in stage history notes |
| Add `fireConversionNotification` | `apps/api/src/services/MarketingCampaignService.ts` | Fire-and-forget `BillingNotificationService` call with new `marketing_campaign_converted` type on every `tenant_onboarded` transition — email + CRM alert (G4) |
| Add `firstTouchSource`/`lastTouchSource`/`campaignOrigin` to `CampaignUpdateInput` | `apps/api/src/services/MarketingCampaignService.ts` | Pass-through to update; `first_touch_source` write-once enforced in service layer |
| Add conversion metrics to `getDashboardStats` | `apps/api/src/services/MarketingCampaignService.ts` | Count campaigns with `tenant_id` set, conversion rate by last-touch source, resurrected count, prospect vs. upsell split |
| Update Zod schemas in routes | `apps/api/src/routes/marketing-ops.ts` | Add `tenant_onboarded` to stage enum, `campaign_origin` to update schema. Attribution fields are **server-managed** — never accepted from clients (G2) |
| Add `POST /:id/link-tenant` route | `apps/api/src/routes/marketing-ops.ts` | Admin endpoint to link campaign to existing tenant (sets `last_touch_source='manual'`) |
| Add `GET /conversion-stats` route | `apps/api/src/routes/marketing-ops.ts` | Conversion funnel stats (shown → onboarded rate, first vs. last touch, resurrected conversions, origin split) |

#### Task 5A.2: Demo Storefront Preview from Campaign

Leverages existing `DemoTenantService` pattern but generates a **campaign-scoped demo** that uses the prospect's actual business data.

| Sub-Task | File | Description |
|----------|------|-------------|
| Add campaign-to-demo-template mapper | `apps/api/src/services/MarketingCampaignService.ts` (new method) | Maps campaign `category` to nearest `DemoTemplate` (grocery/convenience/specialty_retail) with fallback to `specialty_retail` |
| Add `generateDemoStorefront` method | `apps/api/src/services/MarketingCampaignService.ts` | Calls `DemoTenantService.createDemoTenant` with campaign business name, category, city; sets `demoExpiresAt` to 7 days; **stores `demo_tenant_id` on the campaign** (G3) |
| Add shared token factory `generateCampaignToken(campaignId, tokenType, deliverableId?)` | `apps/api/src/services/MarketingDeliverableService.ts` | Single token issuance path used by both QR deliverable links and demo storefront CTAs (G2); `generateDemoStorefront` auto-issues a `demo_storefront` token (30-day expiry) |
| Add `GET /:id/demo-storefront` route | `apps/api/src/routes/marketing-ops.ts` | Admin endpoint to generate/retrieve demo storefront for a campaign |
| Add demo storefront preview page | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/demo/page.tsx` | Shows the demo storefront in an iframe or redirect to `/t/[demoTenantId]` with admin preview mode |
| Add "Generate Demo Storefront" button | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Button in campaign detail that calls the endpoint and shows preview link |
| Add demo storefront badge to campaign detail | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Shows "Demo Storefront Active" badge with expiration when linked |

**Category Mapping Logic:**

```
campaign.category → DemoTemplate:
  - contains "grocery" | "supermarket" | "food" → 'grocery'
  - contains "convenience" | "corner" | "bodega" → 'convenience'
  - everything else → 'specialty_retail'
```

The demo tenant uses the campaign's `business_name`, `city`, and `category` to populate the profile. Products come from the existing `QuickStartScenario` templates.

#### Task 5A.3: Frontend Conversion Dashboard

| Sub-Task | File | Description |
|----------|------|-------------|
| Add conversion widget to Marketing Ops dashboard | `apps/web/src/app/(platform)/settings/admin/marketing-ops/MarketingOpsDashboardClient.tsx` | Cards: conversion rate, total tenants onboarded, resurrected conversions, first vs. last touch breakdown, prospect vs. upsell split, trials granted/activated |
| Add tenant link column to campaign list | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx` | Shows tenant name/link if `tenant_id` is set, "Unlinked" otherwise |
| Add `tenant_onboarded` to stage filter + Kanban | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx` | New stage column in Kanban, new filter option |
| Add `StageBadge` variant for `tenant_onboarded` | `apps/web/src/components/marketing-ops/StageBadge.tsx` | Teal/cyan color for the new stage |

#### Task 5A.4: Auto-Advance Guard — Live Token Collision Fix (G1)

The existing `marketing-ops-stage-autoadvance` job moves `shown → lost` after 7 days. With 30-day preview tokens in circulation, the job would strand late QR conversions in `lost`. Belt-and-suspenders fix: the resurrection transitions (5A.1) are the safety net; this guard is the prevention.

| Sub-Task | File | Description |
|----------|------|-------------|
| Skip campaigns with live tokens | `apps/api/src/jobs/marketing-ops-stage-autoadvance.ts` | Before transitioning `shown → lost`, check for any `mkt_deliverable_preview_tokens` (joined via campaign_id) where `expires_at > NOW()` AND `converted_at IS NULL`. If found, skip the campaign this cycle |
| Log skips for observability | `apps/api/src/jobs/marketing-ops-stage-autoadvance.ts` | `logger.info` with `campaignId` + live token count in meta; skip count surfaced in `getConversionStats` |
| Make stale window configurable | `apps/api/src/jobs/marketing-ops-stage-autoadvance.ts` | `MARKETING_OPS_SHOWN_STALE_DAYS` via `unifiedConfig`, default 7 |
| Unit test the guard | `apps/api/src/jobs/marketing-ops-stage-autoadvance.test.ts` (NEW) | Campaign with live token skipped; expired token still auto-advances; converted token still auto-advances |

**Exit Criteria Sprint 5A:**
- [ ] Campaign can be linked to a tenant via admin UI
- [ ] Demo storefront generates from campaign data, is viewable, and auto-issues a `demo_storefront` preview token
- [ ] Conversion metrics (incl. resurrected + first/last touch + origin split) appear on dashboard
- [ ] `tenant_onboarded` stage appears in Kanban and tracker, incl. resurrection from `lost`/`dead`
- [ ] `marketing_campaign_converted` billing notification fires on conversion
- [ ] Auto-advance job skips campaigns with live unconverted tokens
- [ ] Zero TS errors on `checkapi` and `checkweb`

---

### Sprint 5B: QR Marketing Deliverables + GBP Enhancer + Directory Preview (Week 3–4)

**Goal**: Deliverables include QR codes linking to public preview pages, prospects see their GBP enhancement report and simulated directory listing.

#### Task 5B.1: QR Marketing Deliverable Service

Reuses `qr-style-config.ts` theme system and `MarketingDeliverableService` PDF generation.

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `marketing` theme to QR style config | `apps/web/src/lib/qr-style-config.ts` | New theme: `marketing` — operator brand colors, rounded dots, clean look |
| Add `generatePreviewToken` method | `apps/api/src/services/MarketingDeliverableService.ts` | Creates `mkt_deliverable_preview_tokens` record with 30-day expiry, returns token |
| Add `getDeliverableByToken` method | `apps/api/src/services/MarketingDeliverableService.ts` | Public lookup by token, marks `viewed_at`, returns deliverable metadata (not file) |
| Add QR code to PDF generation | `apps/api/src/services/MarketingDeliverableService.ts` | Embed QR code in PDF footer linking to `/p/deliverable/{token}` — uses `qrcode` npm package to generate QR buffer, placed via `doc.addImage()` |
| Add public deliverable preview route | `apps/api/src/routes/marketing-ops-public.ts` (NEW) | `GET /api/public/deliverable/:token` — returns **allow-listed** deliverable metadata + campaign business name + signup CTA data. No auth required. **Rate-limited: 30 req/min/IP** (G6) |
| Add public deliverable preview page | `apps/web/src/app/p/deliverable/[token]/page.tsx` (NEW) | Shows: deliverable preview (watermarked PDF in iframe), business name, "Sign up to unlock full report" CTA button (links to `/auth/signup?ptoken={token}` — token only), operator branding header |
| Add "Generate Preview Link" button to deliverable list | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | In Deliverables tab, button next to each deliverable to generate a public preview link with QR |
| Add QR preview dialog | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/QRPreviewDialog.tsx` (NEW) | Shows QR code (using `qr-code-styling` + `marketing` theme), preview URL, copy button, download QR as PNG |
| Register public route | `apps/api/src/routes/routeRegistry.ts` | Import + register `marketing-ops-public` router |

**Preview Content Allow-List (G6):**

The public endpoint response is explicitly scoped — it is a marketing artifact, not an internal record dump:

| Included | Excluded |
|----------|----------|
| Business name, city, category | Operator pricing / package fees |
| Watermarked deliverable PDF (preview URL) | Internal audit notes, pain score |
| Operator branding header (name, logo, colors) | Assigned operator, campaign stage/history |
| Signup CTA with `ptoken` | Full (unwatermarked) deliverable file |

**QR Code Implementation Detail:**

The QR code is generated server-side using the `qrcode` npm package (already a dependency for QR features). In `MarketingDeliverableService.generateDeliverable()`:

```typescript
import QRCode from 'qrcode';

// After PDF content is rendered, before save:
const previewUrl = `${process.env.PUBLIC_URL}/p/deliverable/${token}`;
const qrBuffer = await QRCode.toBuffer(previewUrl, {
  width: 150,
  margin: 1,
  color: { dark: '#1a56db', light: '#ffffff' },
});
const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
doc.addImage(qrBase64, 'PNG', pageWidth - 50, pageHeight - 50, 25, 25);
doc.setFontSize(6);
doc.setTextColor(120, 120, 120);
doc.text('Scan to view online', pageWidth - 50, pageHeight - 22);
```

#### Task 5B.2: GBP Enhancer Service

Uses existing GBP sync infrastructure to pull the prospect's real GBP data and generate an enhancement report deliverable.

| Sub-Task | File | Description |
|----------|------|-------------|
| Create `MarketingGbpEnhancerService.ts` | `apps/api/src/services/MarketingGbpEnhancerService.ts` (NEW) | Singleton extends `BaseService`. Methods: `generateGbpReport(campaignId, ctx)`, `compareGbpToBestPractices(gbpData)`, `generateEnhancementDeliverable(campaignId, ctx)` |
| Pull GBP data for prospect | `MarketingGbpEnhancerService.ts` | Uses `GBPBusinessInfoSync` patterns to fetch business profile by name + city (public GBP API, no OAuth needed for basic lookup) |
| Best-practices scoring | `MarketingGbpEnhancerService.ts` | Scores: photos (0-10), review response rate (0-10), categories completeness (0-10), hours accuracy (0-10), description presence (0-10), posts frequency (0-10). Total /60. |
| Generate enhancement report as deliverable | `MarketingGbpEnhancerService.ts` | Calls `MarketingDeliverableService.generateDeliverable()` with type `gbp_audit`, content = formatted report with scores, gaps, and recommendations |
| Add `gbp_enhancer` prompt type | `apps/api/src/routes/marketing-ops.ts` | Add to `promptTemplateCreateSchema` prompt_type enum |
| Add `POST /:id/gbp-enhancer` route | `apps/api/src/routes/marketing-ops.ts` | Admin endpoint to trigger GBP report generation for a campaign |
| Add GBP enhancer button to campaign detail | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Button in Overview tab: "Generate GBP Enhancement Report" |
| Frontend service method | `apps/web/src/services/MarketingOpsService.ts` | Add `generateGbpReport(campaignId)` method |

**GBP Lookup Strategy:**

The service uses the Google Business Profile **public** Places API (not the OAuth-gated Business Profile API) to look up the prospect's business by name + city. This returns: rating, review count, photos, categories, hours, website — enough for an enhancement report without requiring the prospect to grant OAuth access.

If the business can't be found via Places API, the service falls back to using the campaign's audit data (already captured during the `seek` stage) to generate the report.

**Caching & Cost Control (G7):**

Places API lookups are billable and rate-limited. The service caches lookup results on the campaign record (`gbp_lookup_cache` + `gbp_lookup_cached_at`, migration Step 3d) with a **72-hour TTL**. Within the TTL, report generation uses the cached payload. On cache miss, one Places API call is made; on quota failure or no match, the service falls back to campaign audit data. Operators can force a refresh via `?refresh=true` on the admin endpoint — capped at 1 forced refresh per campaign per day.

#### Task 5B.3: Directory Listing Preview

Shows the prospect what their directory listing would look like if they joined the platform.

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `generateDirectoryPreview` method | `apps/api/src/services/MarketingGbpEnhancerService.ts` | Creates a simulated directory listing from campaign data (business name, category, city, audit photos if available). Does NOT create a real directory entry — returns a preview payload. |
| Add `GET /:id/directory-preview` route | `apps/api/src/routes/marketing-ops.ts` | Admin endpoint to get directory preview data for a campaign |
| Add directory preview page | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/directory-preview/page.tsx` (NEW) | Renders a mockup of the directory listing card using existing `DirectoryStoreCard` component with the preview data |
| Add "Preview Directory Listing" button | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Link to directory preview page |
| Frontend service method | `apps/web/src/services/MarketingOpsService.ts` | Add `getDirectoryPreview(campaignId)` method |

**Preview Payload Structure:**

```typescript
interface DirectoryPreviewPayload {
  businessName: string;
  category: string;
  city: string;
  description: string;        // generated from campaign audit data
  photos: string[];           // from GBP Places API or placeholder
  rating?: number;            // from GBP or campaign audit
  reviewCount?: number;       // from GBP or campaign audit
  hours?: Array<{ day: string; open: string; close: string }>;
  simulatedUrl: string;       // what their directory URL would be: /store/{slug}
  benefits: string[];         // ["Visible in directory search", "Customer reviews", ...]
}
```

#### Task 5B.4: Public Signup CTA Integration — Token-Only Trust Boundary (G2)

All public CTAs (QR deliverable page, demo storefront banner) carry **only a preview token**. Campaign, conversion source, and attribution are resolved server-side from the token record. Client-supplied `campaignId` or `source` parameters are ignored everywhere — this closes the forgery vector where a crafted URL could attach a signup to an arbitrary campaign.

| Sub-Task | File | Description |
|----------|------|-------------|
| Add signup CTA to public deliverable page | `apps/web/src/app/p/deliverable/[token]/page.tsx` | "Get Your Full Report + Storefront" button → `/auth/signup?ptoken={token}` — token only, no campaign context in URL |
| Thread `ptoken` through signup | `apps/web/src/app/auth/signup/` (existing flow) | Preserves `ptoken` through the Auth0 round-trip (store in `sessionStorage` before redirect, restore after callback) and passes it to tenant creation |
| Accept `previewToken` on tenant creation | Tenant creation route (`POST /tenants`) | Optional field. Server resolves token → campaign + `token_type`; rejects expired tokens; idempotent for already-converted tokens (re-link tolerated) |
| Server-side conversion tracking | `apps/api/src/services/MarketingCampaignService.ts` | `linkTenant` called during tenant creation with `last_touch_source` derived from `token_type` (`deliverable` → 'qr_deliverable', `demo_storefront` → 'demo_storefront'); `first_touch_source` set if unset |
| Mark preview token as converted | `apps/api/src/services/MarketingDeliverableService.ts` | `markTokenConverted(token, tenantId)` — sets `converted_at` and `tenant_id` on preview token |

#### Task 5B.5: Demo-to-Real Tenant Conversion + Trial Grant (G3)

**Demo-to-real conversion (primary signup path from demos):** the demo tenant the prospect already browsed becomes their real tenant — name, products, profile, and the exact storefront that sold them carry over. Nothing is rebuilt.

| Sub-Task | File | Description |
|----------|------|-------------|
| Add `convertDemoToRealTenant` method | `apps/api/src/services/MarketingCampaignService.ts` | Flips `is_demo=false`, clears `demo_expires_at`/`demo_source_tenant_id` via the existing `DemoTenantService` conversion path, attaches the new owner via `user_tenant`, keeps seeded products/profile/hours |
| Wire into signup with demo token | Tenant creation route | If resolved token is `token_type='demo_storefront'` and campaign has `demo_tenant_id`, **convert** instead of create-new |
| Add demo storefront CTA banner | Demo storefront layout / storefront banner component | Dismissible "This is a personalized preview — claim this storefront" banner rendered when `is_demo=true` and a `ptoken` query param is present; CTA → `/auth/signup?ptoken={token}` |
| Unconverted demos expire normally | Existing demo expiry job | No special-casing — 7-day schedule unchanged |

**Trial-grant on conversion:** when a campaign converts, auto-grant a trial for the capability the deliverable showcased — *show the pain, demo the cure, trial the cure*.

| Sub-Task | File | Description |
|----------|------|-------------|
| Define `DELIVERABLE_TRIAL_MAP` | `apps/api/src/services/MarketingCampaignService.ts` | Maps deliverable types to trial-eligible BSaaS catalog entries, e.g. `gbp_audit` → directory promotion trial, `review_responses` → reviews/social proof trial, `service_menu` → product catalog trial. Resolved against `bsaas_catalog` rows where `trial_eligible=true` |
| Add `grantShowcaseTrial(campaignId, tenantId)` | `apps/api/src/services/MarketingCampaignService.ts` | Fire-and-forget after `linkTenant`; dynamic import of the BSaaS purchase service (circular-dep-safe pattern); **failure-tolerant — trial failure never blocks signup or conversion** |
| Idempotency | Same | One trial per tenant per feature via existing BSaaS trial dedup; safe to call on re-link/resurrection |
| Admin visibility | `MarketingOpsDashboardClient.tsx` | Trial grants surfaced in conversion widget ("trials granted / activated") |

**Exit Criteria Sprint 5B:**
- [ ] Deliverable PDFs include QR codes linking to public preview pages
- [ ] Public preview page shows watermarked deliverable + signup CTA, responses are allow-listed (no pricing/audit internals), route is rate-limited
- [ ] GBP enhancer generates a scored report from prospect's real GBP data; lookups cached 72h; audit-data fallback works
- [ ] Directory listing preview renders with campaign data
- [ ] Signup passes only `ptoken`; server resolves campaign + source; client-supplied campaign/source params are ignored
- [ ] Signup via demo token converts the demo tenant to a real tenant (products/profile retained)
- [ ] Trial granted on conversion matching deliverable type; trial failure does not block signup
- [ ] Zero TS errors on `checkapi` and `checkweb`

---

## 6. Campaign-to-Tenant Bridge: Detailed Flow

### Manual Linking (Admin)

```
Admin views campaign detail
  → Clicks "Link to Tenant"
  → Selects existing tenant from dropdown (or creates new)
  → Campaign transitions to `tenant_onboarded`
  → `tenant_id`, `date_tenant_onboarded`, `last_touch_source` = 'manual' set (`first_touch_source` if unset)
  → Stage history logged
```

### Automatic Linking (via QR Deliverable Signup) — token-only (G2)

```
Prospect receives deliverable PDF with QR code
  → Scans QR → lands on /p/deliverable/{token}  (rate-limited, allow-listed content)
  → Views watermarked preview
  → Clicks "Get Your Full Report + Storefront"
  → Redirected to /auth/signup?ptoken={token}   ← token ONLY; no campaignId/source in URL
  → Creates account; tenant creation passes previewToken to POST /tenants
  → Server resolves token → campaign, token_type='deliverable'
  → MarketingCampaignService.linkTenant() — last_touch_source='qr_deliverable'
  → Campaign transitions to `tenant_onboarded` (incl. resurrection if lost/dead)
  → Preview token marked converted; billing notification fires; trial granted
  → Admin sees conversion in dashboard
```

### Demo Storefront Conversion — demo becomes the real tenant (G3)

```
Admin generates demo storefront from campaign
  → DemoTenantService creates 7-day demo tenant
  → Campaign.demo_tenant_id set + demo_storefront preview token auto-issued
  → Admin shares demo URL (with ptoken) with prospect
  → Prospect browses THEIR storefront: their name, category-matched products
  → Prospect clicks "Claim this storefront" banner CTA
  → Redirected to /auth/signup?ptoken={token}
  → Server resolves token → token_type='demo_storefront' + campaign.demo_tenant_id
  → convertDemoToRealTenant(): is_demo=false, owner attached, products/profile kept
  → Campaign transitions to `tenant_onboarded`, last_touch_source='demo_storefront'
  → If prospect never signs up: demo expires on the normal 7-day schedule
```

### Resurrection (G1)

```
Campaign auto-advanced shown → lost at day 7 (or guarded: skipped while tokens live)
  → Prospect scans QR at day 12 and signs up
  → linkTenant detects from_stage='lost' → valid resurrection transition
  → Stage history notes "Resurrected: converted via qr_deliverable after auto-advance"
  → Dashboard counts as resurrected conversion (separate metric)
```

---

## 7. Conversion Metrics

Added to `getDashboardStats` and new `getConversionStats` method:

| Metric | Calculation | Display |
|--------|-------------|---------|
| **Total Conversions** | Count of campaigns with `tenant_id` IS NOT NULL | Dashboard card |
| **Conversion Rate** | Conversions / (shown + paid + delivered + retainer_won + tenant_onboarded) | Dashboard card |
| **By Last-Touch Source** | Group by `last_touch_source` — what closed the conversion | Bar chart |
| **First vs. Last Touch** | `first_touch_source` × `last_touch_source` matrix — what opens vs. what closes (G5) | Stacked bar |
| **Resurrected Conversions** | Count where conversion `from_stage` was `lost` or `dead` (G1) | Dashboard card |
| **QR Deliverable Views** | Count of deliverable tokens with `viewed_at` IS NOT NULL | Dashboard card |
| **QR Conversion Rate** | Deliverable token conversions / views | Dashboard card |
| **Demo Claim Rate** | `demo_storefront` token conversions / demo tokens issued (G3) | Dashboard card |
| **Trial Grants / Activations** | Trials granted by `grantShowcaseTrial` vs. trials converted to paid | Dashboard card |
| **Prospect vs. Upsell Split** | Conversions grouped by `campaign_origin` (G8) | Pie/donut |
| **Avg Time to Conversion** | Avg `date_tenant_onboarded` - `date_entered` | Dashboard card |
| **Auto-Advance Guard Skips** | Campaigns skipped by the live-token guard per job run (G1) | Ops metric |

---

## 8. Component Inventory

| Component | Location | Type |
|-----------|----------|------|
| `QRPreviewDialog` | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/QRPreviewDialog.tsx` | NEW — Modal showing QR code + preview URL |
| `PublicDeliverablePreview` | `apps/web/src/app/p/deliverable/[token]/page.tsx` | NEW — Public page with watermarked PDF + signup CTA |
| `DirectoryPreviewPage` | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/directory-preview/page.tsx` | NEW — Simulated directory listing preview |
| `DemoStorefrontPage` | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/demo/page.tsx` | NEW — Demo storefront preview wrapper |
| `ConversionStatsWidget` | `apps/web/src/app/(platform)/settings/admin/marketing-ops/ConversionStatsWidget.tsx` | NEW — Dashboard widget with conversion metrics |
| `StageBadge` (extended) | `apps/web/src/components/marketing-ops/StageBadge.tsx` | MODIFIED — Add `tenant_onboarded` variant |
| `CampaignDetailClient` (extended) | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | MODIFIED — Add demo, QR, GBP, directory buttons |
| `MarketingOpsDashboardClient` (extended) | `apps/web/src/app/(platform)/settings/admin/marketing-ops/MarketingOpsDashboardClient.tsx` | MODIFIED — Add conversion stats widget |
| `CampaignListClient` (extended) | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx` | MODIFIED — Add tenant link column, new stage |
| `MarketingGbpEnhancerService` | `apps/api/src/services/MarketingGbpEnhancerService.ts` | NEW — GBP report generation |
| `marketing-ops-public.ts` | `apps/api/src/routes/marketing-ops-public.ts` | NEW — Public deliverable preview routes |

---

## 9. Service Layer: New + Modified

### New Services

| Service | Extends | Purpose |
|---------|---------|---------|
| `MarketingGbpEnhancerService` | `BaseService` | GBP data lookup, scoring, enhancement report generation, directory preview payload |

### Modified Services

| Service | Changes |
|---------|---------|
| `MarketingCampaignService` | Add `tenant_onboarded` stage (incl. resurrection transitions), `linkTenant()`, `generateDemoStorefront()` (+ demo token issuance), `convertDemoToRealTenant()`, `grantShowcaseTrial()` + `DELIVERABLE_TRIAL_MAP`, `fireConversionNotification()`, `getConversionStats()`, extend `getDashboardStats()` |
| `MarketingDeliverableService` | Add `generatePreviewToken()`, `generateCampaignToken()` (shared token factory), `getDeliverableByToken()` (allow-listed response, G6), `markTokenConverted()`, QR code embedding in `generateDeliverable()` |
| `MarketingOpsService` (frontend) | Add `generateGbpReport()`, `getDirectoryPreview()`, `generateDemoStorefront()`, `linkTenant()`, `getConversionStats()` methods |
| `marketing-ops-stage-autoadvance` (job) | Live-token guard, configurable stale window, skip logging (Task 5A.4) |
| Tenant creation route (`POST /tenants`) | Accept optional `previewToken`; server-side token resolution → `linkTenant` / `convertDemoToRealTenant`; ignore client-supplied campaign/source params (G2) |

---

## 10. Route Summary

### New Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/marketing-ops/:id/link-tenant` | Platform Admin | Link campaign to existing tenant |
| `GET` | `/api/admin/marketing-ops/:id/demo-storefront` | Platform Admin | Generate/get demo storefront for campaign |
| `POST` | `/api/admin/marketing-ops/:id/gbp-enhancer` | Platform Admin | Generate GBP enhancement report |
| `GET` | `/api/admin/marketing-ops/:id/directory-preview` | Platform Admin | Get directory listing preview data |
| `GET` | `/api/admin/marketing-ops/conversion-stats` | Platform Admin | Conversion funnel statistics |
| `GET` | `/api/public/deliverable/:token` | Public | Get deliverable metadata by preview token |

### Modified Routes

| Method | Path | Change |
|--------|------|--------|
| `PUT` | `/api/admin/marketing-ops/:id` | Add `tenant_id`, `campaign_origin` to update schema (attribution fields are server-managed) |
| `POST` | `/api/admin/marketing-ops/:id/transition` | Add `tenant_onboarded` to valid stages |
| `POST` | `/tenants` (existing) | Accept optional `previewToken`; resolve campaign + source server-side; **ignore** client-supplied `campaignId`/`source` (G2) |

---

## 11. Dependencies

### NPM Packages (already installed)

| Package | Used For |
|---------|----------|
| `qrcode` | Server-side QR code generation for PDF embedding |
| `jspdf` | PDF generation (already in MarketingDeliverableService) |
| `zod` | Route validation |
| `nanoid` | Token generation |

### No New Dependencies Required

All functionality builds on existing packages and platform infrastructure.

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Late QR conversion lands on `lost` campaign | **High** (7d job vs 30d tokens) | Medium | Resurrection transitions + live-token guard on auto-advance job (G1) — belt and suspenders |
| Attribution forgery via crafted signup URLs | Medium | Medium | Token-only trust boundary — server resolves campaign/source; client params ignored (G2) |
| GBP Places API rate limits / cost | Medium | Medium | 72h per-campaign cache, audit-data fallback, 1 forced refresh/day cap (G7) |
| Public preview leaks pricing/internal notes | Low | High | Explicit response allow-list; no file download; watermarked preview only (G6) |
| Public preview token abuse | Low | Low | 30-day expiry, 30 req/min/IP rate limit, 32-char nanoid entropy, metadata only |
| Trial-grant abuse (repeat trials) | Low | Low | Existing BSaaS one-trial-per-tenant-per-feature dedup; idempotent grant |
| Demo tenant inventory growth | Low | Low | Normal 7-day expiry job; demo-to-real conversion *reduces* demo sprawl (G3) |
| QR code rendering in PDF | Low | Medium | Use `qrcode` package (battle-tested), test with multiple PDF sizes |
| Category mapping gaps | Medium | Low | Fallback to `specialty_retail` template, extensible mapping table |
| Signup drops `ptoken` through Auth0 round-trip | Medium | Medium | `sessionStorage` handoff before redirect, restored at callback; covered by E2E test |

---

## 13. Testing Strategy

### Unit Tests

| Test | File | Coverage |
|------|------|----------|
| Stage transition validation | `MarketingCampaignService.test.ts` | All new transitions incl. resurrection from `lost`/`dead` |
| Auto-advance guard | `marketing-ops-stage-autoadvance.test.ts` (NEW) | Live token skipped; expired/converted tokens still auto-advance |
| GBP scoring logic | `MarketingGbpEnhancerService.test.ts` | Score edge cases + 72h cache TTL behavior |
| Category mapping | `MarketingCampaignService.test.ts` | All category keywords + fallback |
| Preview token generation | `MarketingDeliverableService.test.ts` | Token uniqueness, expiry, both token types |
| Token-only attribution | `MarketingCampaignService.test.ts` | Client-supplied campaign/source ignored; source derived from `token_type` |
| Demo-to-real conversion | `MarketingCampaignService.test.ts` | `is_demo` flip, owner attach, products retained, idempotency |
| Trial grant | `MarketingCampaignService.test.ts` | `DELIVERABLE_TRIAL_MAP` resolution, BSaaS dedup, failure tolerance |
| Conversion stats calculation | `MarketingCampaignService.test.ts` | Rate calc, first/last touch grouping, resurrected count, origin split |

### Integration Tests

| Test | Description |
|------|-------------|
| Campaign → link tenant → verify stage transition + history | Full flow |
| Campaign → generate demo → verify demo tenant created with campaign data | Full flow |
| Deliverable → generate preview token → public lookup by token | Full flow |
| GBP enhancer → generate report → verify deliverable created | Full flow |

### E2E Tests

| Journey | Steps |
|---------|-------|
| Admin links campaign to tenant | Campaign detail → Link to Tenant → Select tenant → Verify stage = `tenant_onboarded` |
| Admin generates demo storefront | Campaign detail → Generate Demo → View demo storefront |
| Admin generates GBP report | Campaign detail → Generate GBP Report → View in Deliverables tab |
| Public deliverable preview → signup | Generate preview link → incognito → view watermarked PDF → CTA → signup with `ptoken` → verify campaign linked, `last_touch_source='qr_deliverable'` |
| Demo storefront claim | Generate demo → open with `ptoken` → claim CTA → signup → verify demo converted (`is_demo=false`, products intact) |
| Resurrected conversion | Force campaign to `lost` → signup via live token → verify `tenant_onboarded` + resurrected metric increments |

---

## 14. v2.0 Roadmap (Post-Sprint)

| Feature | Value | Effort |
|---------|-------|--------|
| **Automated demo storefront email** — Send demo link to prospect directly from platform | High | Low |
| **A/B test deliverable types** — Compare conversion rates between GBP audit vs. review responses vs. service menu | High | Medium |
| **Retainer-to-tenant migration** — Convert retainer clients to self-serve tenants with data migration | High | High |
| **Campaign sequence automation** — Auto-send deliverable → wait 3 days → send demo link → wait 7 days → send GBP report | High | Medium |
| **Multi-location prospecting** — One campaign for a chain, generate demo per location | Medium | Medium |
| **Prospect scoring model** — ML model predicting conversion likelihood from audit data | Medium | High |
| **White-label deliverable portal** — Prospect-facing portal with all deliverables, demo, and signup (replaces single-deliverable preview page) | High | High |
| **Trial-grant conversion analytics** — Measure which deliverable→trial pairings produce paid BSaaS conversions | High | Low |

---

## 15. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | _______________ | _______________ | _______________ |
| Tech Lead | _______________ | _______________ | _______________ |

---

*End of Sprint Plan — Tenant Prospecting Channel v2.0*
