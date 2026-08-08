# Marketing Ops Diagnostic Gallery — Expiring Tokenized Screenshot Report

**Status:** Draft spec for review
**Date:** 2026-08-08
**Stages:** `preview_built`, `shown`
**Depends on:** existing `mkt_deliverable_preview_tokens`, `mkt_files_list`, `mkt_audits_list`, `mkt_outreach_log`
**Analytics pattern:** follows `qr_scan_events`/`qr_analytics` and `funnel_events`/`FunnelAnalyticsService` established patterns

---

## 1. Overview

A tokenized public URL (`/preview/[token]`) that renders a "Digital Health Diagnostic Report" — a magazine-style gallery of operator-captured, annotated screenshots showing a prospect's cross-platform listing errors. The URL expires (default 72h), creating urgency. On expiry, the page degrades to a re-activation hook.

### 1.1 Correction to Original Premise

The original pitch assumed screenshots are **automatically captured** during the seek audit. They are not. The seek audit (`mkt_audits_list.audit_data`) produces **structured signal JSON** — NAP mismatches, phone drift, broken links, review counts, mobile-friendliness flags. Screenshots are a **manual operator step**: the operator reviews the audit signals, captures screenshots from Google/Facebook/Yelp/Website, edits/annotates them (red callouts), and uploads them as `mkt_files_list` rows. The gallery page then assembles those uploaded files into the report.

### 1.2 Workflow Summary

```
[ Seek Audit Executed ] → mkt_audits_list (structured signals)
          │
          ▼
[ Operator Reviews Signals ] — pain points, mismatches, friction
          │
          ▼
[ Operator Captures Screenshots ] — Google, Facebook, Yelp, Website
          │
          ▼
[ Operator Edits/Annotates ] — red callouts, highlights
          │
          ▼
[ Operator Uploads to Campaign ] — mkt_files_list (file_type='diagnostic_screenshot')
          │
          ▼
[ Operator Generates Gallery Token ] — mkt_deliverable_preview_tokens (token_type='diagnostic_gallery')
          │
          ▼
[ Outreach Dispatch ] — email/SMS includes /preview/[token] URL
          │                    mkt_outreach_log.preview_token records the link
          ▼
[ Prospect Opens Gallery ] — /preview/[token] frontend route
          │                    ├── Countdown timer (TTL remaining)
          │                    ├── Carousel of annotated screenshots
          │                    ├── Friction summary from audit signals
          │                    └── CTA → /marketing/pay?ptoken={pay_token}
          │                    └── Engagement beacons fire on every interaction
          ▼
[ Engagement Events Recorded ] — mkt_gallery_events (append-only)
          │                    ├── gallery_opened (first view → stamps viewed_at)
          │                    ├── screenshot_viewed (per-slide, with dwell time)
          │                    ├── carousel_next / carousel_prev
          │                    ├── cta_clicked
          │                    ├── cta_hovered
          │                    ├── session_heartbeat (30s intervals for duration)
          │                    └── session_end (page unload / visibility change)
          ▼
[ Operator Notified + Analytics ] — real-time view alert + aggregate dashboard
```

---

## 2. Stage Gate

The gallery is available when a campaign reaches `preview_built` (seek audit complete, signals available). The token is typically generated when the campaign transitions to `shown` (outreach dispatched), but operators can generate it earlier at `preview_built` to preview the gallery themselves before sending.

**Allowed stages for token generation:** `preview_built`, `shown`
**Blocked stages:** `seek` (no audit yet), `paid`+ (prospect already converted — use the customer portal instead)

---

## 2.5. Archetype Awareness

The campaign's archetype (A1–A6) drives both the **prospect-facing gallery experience** and the **operator-facing tooling**. The archetype is resolved via the existing `resolveCampaignArchetype()` function (`OutreachOpenerService.ts`), which checks for an operator-accepted triage result first, then falls back to `selectArchetype(latestAuditData)`. The gallery inherits the same archetype — no separate resolution path.

### 2.5.1. The Six Archetypes

| Code | Label | Core Pain | Gallery Framing |
|---|---|---|---|
| A1 | Review Response Gap | Unanswered reviews (volume) | "Your reviews are going unanswered" |
| A2 | Negative Review Recovery | Recurring-theme negatives | "A cluster of negative reviews all point at the same thing" |
| A3 | Listing Drift | NAP inconsistency across platforms | "Your business shows up differently on every platform" |
| A4 | Conversion / CTA Gap | Website has no booking/call/scheduling | "Your site gets traffic but there's no way to become a customer" |
| A5 | Dual-Signal Footprint Triage | Combined listing + review gaps | "Two gaps in your footprint — wrong directions and review silence" |
| A6 | Product Visibility Gap | Product/hybrid business with no online product browsing | "Customers can't see what you carry before visiting" |

### 2.5.2. Prospect-Facing Archetype Awareness

The gallery page adapts its framing based on the archetype. The **screenshots are the same** (operator-uploaded), but the **title, subtitle, friction summary framing, and CTA copy** shift to match the archetype's pain narrative. This creates continuity between the outreach message (which already uses archetype-aware openers) and the gallery landing page.

**Gallery title defaults by archetype:**

| Archetype | Default Gallery Title | Default Subtitle Pattern |
|---|---|---|
| A1 | "Review Response Diagnostic — {businessName}" | "{N} of your reviews are going unanswered across Google & Yelp" |
| A2 | "Review Recovery Diagnostic — {businessName}" | "A cluster of {N} negative reviews about {theme} — all unanswered" |
| A3 | "Listing Consistency Diagnostic — {businessName}" | "Your business shows up {N} different ways across Google, Yelp & Facebook" |
| A4 | "Website Conversion Diagnostic — {businessName}" | "Your site gets traffic but visitors can't {book/call/schedule} online" |
| A5 | "Footprint Diagnostic — {businessName}" | "Two gaps: wrong directions and unanswered reviews" |
| A6 | "Product Visibility Diagnostic — {businessName}" | "Customers can't see what you carry before visiting the store" |

**CTA copy defaults by archetype:**

| Archetype | Default CTA Label | Implied Fix |
|---|---|---|
| A1 | "Fix All {N} Unanswered Reviews" | Review response deliverable |
| A2 | "Fix the {theme} Review Cluster" | Negative recovery playbook |
| A3 | "Sync All {N} Listing Errors" | NAP correction + directory sync |
| A4 | "Add {booking/call} to Your Site" | CTA implementation |
| A5 | "Fix Both Gaps — Listings + Reviews" | Combined repair + response |
| A6 | "Show Your Products Online" | Product visibility / GBP photo optimization |

**Friction summary auto-generation (Phase 2):** When the operator generates a gallery token, the system can auto-populate the friction summary from the audit data, pre-filled per archetype:

- **A1/A2:** friction rows derived from `combined_review_metrics` + `negative_review_themes` (unanswered count, theme, supporting review count)
- **A3:** friction rows derived from `nap_consistency` (name variations, phone variations, address variations, material issues)
- **A4:** friction rows derived from `website` audit (missing CTA, missing click-to-call, missing booking)
- **A5:** combined A3 + A1/A2 friction rows (capped at 4 — strongest from each)
- **A6:** friction rows derived from `website.has_product_browsing`, `platforms.google.photo_count`, `platforms.google.photo_types`

For Phase 1 MVP, the friction summary is operator-authored in the modal (§4.2), with the archetype-aware defaults shown as placeholder text / pre-fill suggestions.

**Screenshot guidance by archetype (operator-facing, Phase 1):**

The operator's screenshot upload panel shows archetype-specific guidance for what to capture:

| Archetype | Screenshot Guidance |
|---|---|
| A1 | Google review list (showing unanswered count), Yelp review list, individual unanswered reviews (negative + positive) |
| A2 | The specific negative review cluster (theme-matched), Google review page showing the recurring theme, individual themed reviews |
| A3 | Google listing (NAP), Yelp listing (NAP), Facebook listing (NAP) — side-by-side or annotated to show variations |
| A4 | Website homepage (annotated: no booking button, no click-to-call), mobile view (if different), competitor site with working CTA (optional contrast) |
| A5 | Google listing (NAP drift) + review page (unanswered) — showing both gaps in one gallery |
| A6 | Google Business Profile (photo tab — sparse/missing product photos), website (no product browsing), competitor GBP (rich product photos, optional contrast) |

### 2.5.3. Operator-Facing Archetype Awareness

**Token generation modal (§4.2):** When the operator opens the "Generate Gallery Link" modal, the system:
1. Resolves the archetype via `resolveCampaignArchetype(campaignId)` (same function used by the opener workspace)
2. Pre-fills the gallery title, subtitle, CTA label, and friction summary with archetype-aware defaults (operator can override)
3. Shows the archetype badge (e.g. "A2 — Negative Recovery") with the resolution reason
4. Shows the screenshot guidance for the archetype (above)

**Analytics segmentation (§4.8):** The admin analytics endpoints and dashboard break down engagement by archetype:
- "Which archetype converts best?" (A2 galleries have higher CTA click rates than A3?)
- "Which archetype gets the longest session duration?" (A2 themed clusters may get more dwell time than A1 raw counts)
- Funnel by archetype: opened → screenshots viewed → CTA clicked → paid, per archetype

This requires storing the archetype on the gallery token at generation time (see §3.2 schema addition).

**Outreach continuity:** The gallery's archetype matches the opener's archetype by construction (both resolve from the same campaign). When the prospect reads the outreach email ("A cluster of 5 negative reviews all point at the same thing — trip fees and pricing surprises") and clicks through to the gallery, the gallery title says "Review Recovery Diagnostic" and the friction summary leads with the same theme — creating a seamless narrative from email to gallery to CTA.

---

## 3. Schema Changes

### 3.1 Tables

The existing infrastructure covers token + file storage. **One new table** is added for engagement analytics, following the established `qr_scan_events` / `funnel_events` append-only event pattern:

| Table | Role | Status |
|---|---|---|
| `mkt_deliverable_preview_tokens` | Token storage (new `token_type='diagnostic_gallery'`) | Existing — extended |
| `mkt_files_list` | Screenshot storage (new `file_type='diagnostic_screenshot'`) | Existing — convention only |
| `mkt_audits_list` | Signal source (existing `audit_data` JSON) | Existing — read-only |
| `mkt_outreach_log` | Outreach dispatch log (existing `preview_token` column) | Existing — links dispatch to token |
| `mkt_gallery_events` | **Append-only engagement event log** (opens, slide views, clicks, dwell) | **New — Migration 166** |
| `mkt_gallery_analytics` | **Aggregate rollup** per token per period (views, clicks, avg duration) | **New — Migration 166** |

### 3.2 Migration 165: Diagnostic Gallery Metadata

Additive columns on `mkt_deliverable_preview_tokens` for gallery-specific metadata. All nullable — existing token rows are unaffected.

```sql
-- 165_diagnostic_gallery_metadata.sql

ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN IF NOT EXISTS gallery_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gallery_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS friction_summary JSONB,
  ADD COLUMN IF NOT EXISTS cta_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cta_amount_cents INT,
  ADD COLUMN IF NOT EXISTS gallery_archetype VARCHAR(10);

COMMENT ON COLUMN mkt_deliverable_preview_tokens.gallery_title IS
  'Diagnostic gallery: custom report title (defaults to business name)';
COMMENT ON COLUMN mkt_deliverable_preview_tokens.gallery_subtitle IS
  'Diagnostic gallery: sub-headline under the title';
COMMENT ON COLUMN mkt_deliverable_preview_tokens.friction_summary IS
  'Diagnostic gallery: array of {severity, label, detail} friction callouts';
COMMENT ON COLUMN mkt_deliverable_preview_tokens.cta_label IS
  'Diagnostic gallery: CTA button text (e.g. "Fix All 8 Errors Now")';
COMMENT ON COLUMN mkt_deliverable_preview_tokens.cta_amount_cents IS
  'Diagnostic gallery: price shown on CTA button';
COMMENT ON COLUMN mkt_deliverable_preview_tokens.gallery_archetype IS
  'Diagnostic gallery: campaign archetype at token generation time (A1–A6). Drives gallery framing + analytics segmentation. Resolved via resolveCampaignArchetype().';
```

### 3.3 File Type Convention

Screenshots are stored as `mkt_files_list` rows with:
- `file_type = 'diagnostic_screenshot'`
- `file_name` = human-readable label (e.g. `"Google vs Facebook — Phone Mismatch.png"`)
- `storage_path` = Supabase storage path (private `diagnostics` bucket or existing `disputes` bucket)

An optional `sort_order` is not added as a column — the gallery renders files in `uploaded_at` order. Operators upload in the display sequence they want.

### 3.4 Prisma Schema Additions

```prisma
model mkt_deliverable_preview_tokens {
  // ... existing fields ...
  gallery_title        String?  @db.VarChar(255)
  gallery_subtitle     String?
  friction_summary     Json?
  cta_label            String?  @db.VarChar(255)
  cta_amount_cents     Int?
  gallery_archetype    String?  @db.VarChar(10)   // A1–A6
}
```

### 3.5 Migration 166: Gallery Engagement Events + Analytics

Two new tables following the `qr_scan_events` / `qr_analytics` dual-table pattern: raw append-only events for per-interaction tracking, plus a rollup table for aggregate dashboard queries.

```sql
-- 166_diagnostic_gallery_analytics.sql

-- ── Raw event log (append-only, one row per interaction) ──
CREATE TABLE IF NOT EXISTS mkt_gallery_events (
  id              VARCHAR(255) PRIMARY KEY,
  token_id        VARCHAR(255) NOT NULL,
  campaign_id     VARCHAR(255) NOT NULL,
  session_id      VARCHAR(255),          -- anonymous session (UUID per browser tab)
  event_type      VARCHAR(30) NOT NULL,  -- gallery_opened | screenshot_viewed | carousel_next | carousel_prev | cta_clicked | cta_hovered | session_heartbeat | session_end
  screenshot_index INT,                   -- which slide (0-based) for screenshot_viewed / carousel_* events
  screenshot_id   VARCHAR(255),           -- mkt_files_list.id of the slide being viewed
  dwell_ms        INT,                    -- milliseconds spent on slide (for screenshot_viewed) or on page (for session_*)
  client_width    INT,                    -- viewport width (responsive tracking)
  client_height   INT,
  referrer        TEXT,
  user_agent      TEXT,
  ip_hash         VARCHAR(64),            -- SHA-256 hash of IP (never raw IP — privacy)
  geo_country     VARCHAR(10),
  geo_city        VARCHAR(100),
  device_type     VARCHAR(20),            -- mobile | desktop | tablet | unknown
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mkt_gallery_events_token ON mkt_gallery_events(token_id);
CREATE INDEX idx_mkt_gallery_events_campaign ON mkt_gallery_events(campaign_id);
CREATE INDEX idx_mkt_gallery_events_type ON mkt_gallery_events(event_type);
CREATE INDEX idx_mkt_gallery_events_session ON mkt_gallery_events(session_id);
CREATE INDEX idx_mkt_gallery_events_created ON mkt_gallery_events(created_at DESC);
CREATE INDEX idx_mkt_gallery_events_token_type_time ON mkt_gallery_events(token_id, event_type, created_at DESC);
CREATE INDEX idx_mkt_gallery_events_campaign_type_time ON mkt_gallery_events(campaign_id, event_type, created_at DESC);

-- ── Aggregate rollup (per token per day) ──
CREATE TABLE IF NOT EXISTS mkt_gallery_analytics (
  id                   VARCHAR(255) PRIMARY KEY,
  token_id             VARCHAR(255) NOT NULL,
  campaign_id          VARCHAR(255) NOT NULL,
  period_start         DATE NOT NULL,
  period_type          VARCHAR(10) DEFAULT 'day',
  total_opens          INT DEFAULT 0,          -- gallery_opened events (total views, including repeat)
  unique_sessions      INT DEFAULT 0,          -- distinct session_id count
  total_screenshot_views INT DEFAULT 0,        -- screenshot_viewed events
  total_carousel_navs  INT DEFAULT 0,          -- carousel_next + carousel_prev
  cta_clicks           INT DEFAULT 0,          -- cta_clicked events
  cta_hovers           INT DEFAULT 0,          -- cta_hovered events
  avg_session_duration_ms INT DEFAULT 0,       -- mean dwell across sessions
  avg_screenshots_viewed  INT DEFAULT 0,       -- mean distinct slides viewed per session
  mobile_views         INT DEFAULT 0,
  desktop_views        INT DEFAULT 0,
  tablet_views         INT DEFAULT 0,
  top_country          VARCHAR(10),
  top_city             VARCHAR(100),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_id, period_start, period_type)
);

CREATE INDEX idx_mkt_gallery_analytics_token ON mkt_gallery_analytics(token_id);
CREATE INDEX idx_mkt_gallery_analytics_campaign ON mkt_gallery_analytics(campaign_id);
CREATE INDEX idx_mkt_gallery_analytics_period ON mkt_gallery_analytics(period_start DESC);
```

**Prisma models:**

```prisma
model mkt_gallery_events {
  id              String   @id @db.VarChar(255)
  token_id        String   @db.VarChar(255)
  campaign_id     String   @db.VarChar(255)
  session_id      String?  @db.VarChar(255)
  event_type      String   @db.VarChar(30)
  screenshot_index Int?
  screenshot_id   String?  @db.VarChar(255)
  dwell_ms        Int?
  client_width    Int?
  client_height   Int?
  referrer        String?
  user_agent      String?
  ip_hash         String?  @db.VarChar(64)
  geo_country     String?  @db.VarChar(10)
  geo_city        String?  @db.VarChar(100)
  device_type     String?  @db.VarChar(20)
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([token_id], map: "idx_mkt_gallery_events_token")
  @@index([campaign_id], map: "idx_mkt_gallery_events_campaign")
  @@index([event_type], map: "idx_mkt_gallery_events_type")
  @@index([session_id], map: "idx_mkt_gallery_events_session")
  @@index([created_at(sort: Desc)], map: "idx_mkt_gallery_events_created")
  @@index([token_id, event_type, created_at(sort: Desc)], map: "idx_mkt_gallery_events_token_type_time")
  @@index([campaign_id, event_type, created_at(sort: Desc)], map: "idx_mkt_gallery_events_campaign_type_time")
}

model mkt_gallery_analytics {
  id                       String   @id @db.VarChar(255)
  token_id                 String   @db.VarChar(255)
  campaign_id              String   @db.VarChar(255)
  period_start             DateTime @db.Date
  period_type              String   @default("day") @db.VarChar(10)
  total_opens              Int      @default(0)
  unique_sessions          Int      @default(0)
  total_screenshot_views   Int      @default(0)
  total_carousel_navs      Int      @default(0)
  cta_clicks               Int      @default(0)
  cta_hovers               Int      @default(0)
  avg_session_duration_ms  Int      @default(0)
  avg_screenshots_viewed   Int      @default(0)
  mobile_views             Int      @default(0)
  desktop_views            Int      @default(0)
  tablet_views             Int      @default(0)
  top_country              String?  @db.VarChar(10)
  top_city                 String?  @db.VarChar(100)
  created_at               DateTime @default(now()) @db.Timestamptz(6)
  updated_at               DateTime @default(now()) @db.Timestamptz(6)

  @@unique([token_id, period_start, period_type])
  @@index([token_id], map: "idx_mkt_gallery_analytics_token")
  @@index([campaign_id], map: "idx_mkt_gallery_analytics_campaign")
  @@index([period_start(sort: Desc)], map: "idx_mkt_gallery_analytics_period")
}
```

### 3.6 Event Types

| Event Type | Trigger | Key Fields | Purpose |
|---|---|---|---|
| `gallery_opened` | Page load (token resolved, not expired) | `session_id` | Count total opens; first open stamps `viewed_at` on token |
| `screenshot_viewed` | Carousel lands on a slide (initial + navigation) | `screenshot_index`, `screenshot_id`, `dwell_ms` | Per-slide engagement; which screenshots get attention |
| `carousel_next` | User clicks next arrow / swipes right | `screenshot_index` (target slide) | Navigation engagement |
| `carousel_prev` | User clicks prev arrow / swipes left | `screenshot_index` (target slide) | Navigation engagement |
| `cta_clicked` | User clicks the CTA button | — | Conversion intent — strongest signal |
| `cta_hovered` | User hovers CTA for >500ms | — | Soft intent signal |
| `session_heartbeat` | Every 30s while page is visible | `dwell_ms` (cumulative) | Active session duration tracking |
| `session_end` | Page unload / tab hidden / visibility change to hidden | `dwell_ms` (final) | Final session duration |

**Session ID:** Generated client-side as a `crypto.randomUUID()` per page load, stored in memory. Not persisted in cookies — each gallery visit is a fresh session. This enables unique-session counting without cross-session tracking.

---

## 4. Backend

### 4.1 Token Issuance — `MarketingDeliverableService.generateCampaignToken`

**No new method.** The existing `generateCampaignToken(campaignId, tokenType, deliverableId?, expiryDays, ctx?)` already accepts an arbitrary `tokenType` string. We extend it to accept `'diagnostic_gallery'` and pass gallery metadata.

**Extension:** Add optional `galleryMeta` parameter:

```typescript
async generateCampaignToken(
  campaignId: string,
  tokenType: 'deliverable' | 'demo_storefront' | 'diagnostic_gallery',
  deliverableId?: string,
  expiryDays: number = 30,
  ctx?: RequestCtx,
  galleryMeta?: {
    galleryTitle?: string;
    gallerySubtitle?: string;
    frictionSummary?: Array<{ severity: 'critical' | 'warning' | 'info'; label: string; detail: string }>;
    ctaLabel?: string;
    ctaAmountCents?: number;
    galleryArchetype?: string;  // A1–A6, resolved via resolveCampaignArchetype()
  },
): Promise<any>
```

When `tokenType === 'diagnostic_gallery'`:
- Default `expiryDays` = 3 (72 hours) unless overridden
- Persist `galleryMeta` fields onto the token row
- `ctaAmountCents` defaults to `campaign.package_price_cents` if not provided
- `galleryArchetype` is resolved via `resolveCampaignArchetype(campaignId, ctx)` if not explicitly provided — the archetype is always stamped on the token at generation time for analytics segmentation

### 4.2 Admin Route — `POST /api/admin/marketing-ops/campaigns/:id/gallery-token`

New admin endpoint for operators to mint a diagnostic gallery token.

**Request:**
```json
{
  "expires_in_days": 3,
  "gallery_title": "Review Recovery Diagnostic — Joe's Plumbing",
  "gallery_subtitle": "A cluster of 5 negative reviews about trip fees — all unanswered",
  "friction_summary": [
    { "severity": "critical", "label": "Trip-Fee Review Cluster", "detail": "5 negative reviews all cite surprise trip fees — 0 owner responses" },
    { "severity": "warning", "label": "Unanswered Positive Reviews", "detail": "12 positive reviews also going unanswered" }
  ],
  "cta_label": "Fix the Trip-Fee Review Cluster",
  "cta_amount_cents": 14900
}
```

All fields are optional — when omitted, the server auto-fills them from the archetype-aware defaults (§2.5.2). The `gallery_archetype` is always resolved server-side via `resolveCampaignArchetype()` and stamped on the token, regardless of whether the operator overrides the title/subtitle/CTA.

**Behavior:**
1. Validate campaign exists and stage is `preview_built` or `shown`
2. Resolve archetype via `resolveCampaignArchetype(campaignId, ctx)` — stamps `gallery_archetype` on the token
3. Apply archetype-aware defaults for any omitted fields (title, subtitle, CTA label — see §2.5.2)
4. Validate at least 1 `diagnostic_screenshot` file exists on the campaign (400 `no_screenshots` if none)
5. Supersede prior unconverted `diagnostic_gallery` tokens for this campaign (same pattern as pay-links)
4. Call `generateCampaignToken` with `tokenType='diagnostic_gallery'`, `expiryDays` (default 3), and `galleryMeta`
5. Return token + gallery URL: `{baseUrl}/preview/{token.token}`

**Response:**
```json
{
  "success": true,
  "token": {
    "id": "mdpt-abc12345",
    "token": "aB3x...32chars",
    "tokenType": "diagnostic_gallery",
    "galleryUrl": "https://app.visibleshelf.com/preview/aB3x...",
    "expiresAt": "2026-08-11T14:30:00Z",
    "createdAt": "2026-08-08T14:30:00Z"
  }
}
```

### 4.3 Public Route — `GET /api/public/marketing/gallery/:token`

New public endpoint (no auth — token is the trust boundary) that resolves the gallery token and returns all data needed to render the page.

**Resolution logic** (mirrors `resolvePreviewToken` in `marketing-ops-public.ts`):
1. Find token row by `token` value, include `mkt_campaigns_list`
2. If not found → 404 `invalid_token`
3. If `expires_at < now` → 200 with `{ expired: true, expiredAt, businessName }` (the frontend renders the re-activation hook)
4. If `token_type !== 'diagnostic_gallery'` → 404 (wrong token type for this endpoint)
5. Stamp `viewed_at` if null (first view)
6. Fetch `mkt_files_list` where `campaign_id = campaign.id` AND `file_type = 'diagnostic_screenshot'`, ordered by `uploaded_at ASC`
7. Generate signed URLs for each screenshot (private bucket — signed URL with short TTL)
8. Fetch audit signals from `mkt_audits_list` for additional friction context (optional enrichment)
9. Return gallery payload

**Response (active):**
```json
{
  "success": true,
  "data": {
    "expired": false,
    "businessName": "Joe's Plumbing",
    "archetype": "A2",
    "archetypeLabel": "Negative Review Recovery",
    "galleryTitle": "Review Recovery Diagnostic — Joe's Plumbing",
    "gallerySubtitle": "A cluster of 5 negative reviews about trip fees — all unanswered",
    "expiresAt": "2026-08-11T14:30:00Z",
    "screenshots": [
      {
        "id": "mfl_001",
        "fileName": "Google — Trip-Fee Review Cluster.png",
        "signedUrl": "https://...signed...",
        "mimeType": "image/png"
      },
      {
        "id": "mfl_002",
        "fileName": "Individual Trip-Fee Reviews.png",
        "signedUrl": "https://...signed...",
        "mimeType": "image/png"
      }
    ],
    "frictionSummary": [
      { "severity": "critical", "label": "Trip-Fee Review Cluster", "detail": "5 negative reviews all cite surprise trip fees — 0 owner responses" },
      { "severity": "warning", "label": "Unanswered Positive Reviews", "detail": "12 positive reviews also going unanswered" }
    ],
    "cta": {
      "label": "Fix the Trip-Fee Review Cluster",
      "amountCents": 14900,
      "amountFormatted": "$149.00",
      "payUrl": "/marketing/pay?ptoken={linked_pay_token}"
    },
    "branding": {
      "operatorName": "VisibleShelf",
      "logoUrl": "https://...",
      "primaryColor": "#111827",
      "accentColor": "#3B82F6"
    }
  }
}
```

**Response (expired):**
```json
{
  "success": true,
  "data": {
    "expired": true,
    "expiredAt": "2026-08-11T14:30:00Z",
    "businessName": "Joe's Plumbing",
    "reactivationUrl": "/marketing/claim?expired=true"
  }
}
```

### 4.4 CTA Link — Pay Token Bridging

The gallery CTA needs to route to the pay page (`/marketing/pay?ptoken=...`). Two options:

**Option A (recommended):** The gallery token itself is accepted by the existing pay endpoint. When the pay page's `resolvePreviewToken` encounters a `diagnostic_gallery` token, it resolves the campaign and proceeds normally (the token already carries `campaign_id`). No separate pay token needed. The gallery token doubles as the pay token.

**Option B:** The admin endpoint mints a second `deliverable`-type token at the same time and stores its value in the gallery token's metadata. More complex, two tokens to manage.

→ **Go with Option A.** The `resolvePreviewToken` function in `marketing-ops-public.ts` already returns the campaign regardless of `token_type`. The pay page only needs `campaign_id` + `package_price_cents`, both available from a `diagnostic_gallery` token. Add `diagnostic_gallery` to the `classifyTokenType` switch so the pay page treats it like a standard campaign token.

### 4.5 Engagement Analytics Service — `GalleryAnalyticsService`

New service at `apps/api/src/services/GalleryAnalyticsService.ts`, following the `FunnelAnalyticsService.trackFunnelEvent` + `QrAnalyticsService` patterns.

```typescript
class GalleryAnalyticsService extends BaseService {
  static getInstance(): GalleryAnalyticsService;

  // ── Event Tracking ──

  /**
   * Track a single engagement event. Fire-and-forget safe — never throws
   * (mirrors FunnelAnalyticsService.trackFunnelEvent pattern).
   *
   * On gallery_opened: also stamps viewed_at on the token if null (first view),
   * fires operator notification, logs audit event.
   */
  async trackEvent(input: TrackGalleryEventInput): Promise<void>;

  /**
   * Batch track multiple events (for heartbeat batching — see §5.5).
   * Uses createMany in a single transaction.
   */
  async trackEvents(inputs: TrackGalleryEventInput[]): Promise<void>;

  // ── Aggregate Rollup ──

  /**
   * Compute mkt_gallery_analytics rows from mkt_gallery_events for a
   * given period. Mirrors aggregateQrAnalyticsForTenant pattern:
   * GROUP BY token_id, period_start → upsert into mkt_gallery_analytics.
   * Called by a periodic job (see §4.7).
   */
  async aggregateAnalytics(
    periodType?: 'day' | 'week',
    daysBack?: number,
  ): Promise<{ rowsComputed: number; errors: string[] }>;

  // ── Query ──

  /**
   * Per-token engagement summary for the admin panel.
   * Returns: opens, unique sessions, avg duration, screenshot views,
   * CTA clicks, CTA hover rate, device breakdown, geo, timeline.
   */
  async getTokenAnalytics(tokenId: string): Promise<GalleryTokenAnalytics>;

  /**
   * Per-campaign engagement summary (aggregates across all gallery tokens
   * for a campaign). Used on the campaign detail page.
   */
  async getCampaignAnalytics(campaignId: string): Promise<GalleryCampaignAnalytics>;

  /**
   * Cross-campaign engagement summary for the marketing ops dashboard.
   * Top campaigns by engagement, view-to-CTA-click funnel, etc.
   */
  async getDashboardAnalytics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    operatorId?: string;
  }): Promise<GalleryDashboardAnalytics>;

  // ── Real-time ──

  /**
   * Returns recent engagement events (last N) for a token — used by
   * the operator's live activity feed.
   */
  async getRecentEvents(tokenId: string, limit?: number): Promise<GalleryEvent[]>;
}

interface TrackGalleryEventInput {
  tokenId: string;
  campaignId: string;
  sessionId: string;
  eventType: GalleryEventType;
  screenshotIndex?: number;
  screenshotId?: string;
  dwellMs?: number;
  clientWidth?: number;
  clientHeight?: number;
  referrer?: string;
  userAgent?: string;
  ipHash?: string;       // computed server-side from req.ip
  geoCountry?: string;
  geoCity?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'unknown';
}

type GalleryEventType =
  | 'gallery_opened'
  | 'screenshot_viewed'
  | 'carousel_next'
  | 'carousel_prev'
  | 'cta_clicked'
  | 'cta_hovered'
  | 'session_heartbeat'
  | 'session_end';
```

**First-view side effects** (on `gallery_opened` when `token.viewed_at` is null):
1. Stamp `viewed_at = NOW()` on `mkt_deliverable_preview_tokens`
2. Log `audit()` event: `{ action: 'view', actorType: 'customer', metadata: { token_id, campaign_id, business_name } }`
3. Fire-and-forget operator notification (email or in-app) — "Prospect opened diagnostic gallery for [Business Name]"
4. Future: adjust cascade priority in `ReviewCascadeService` (Phase 2)

**IP hashing:** The server computes `ipHash = SHA-256(req.ip + salt)` — never stores raw IP. The salt is from `unifiedConfig`. This enables geo-deduplication and rough unique-visitor estimation without PII storage.

**Geo enrichment:** Optional — if a geo-IP service is configured in `unifiedConfig`, the server enriches events with `geo_country` / `geo_city` at ingestion time. If not configured, these fields are null. No client-side geo (privacy).

**Device type parsing:** Server-side, mirroring `QrAnalyticsService.parseDeviceType`:
```typescript
function parseDeviceType(userAgent: string | null): DeviceType {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}
```

### 4.6 Public Tracking Endpoints

Two public endpoints (no auth — token is the trust boundary) for the frontend to beacon engagement events.

#### `POST /api/public/marketing/gallery/:token/events`

Track a single engagement event. Called by the frontend on each interaction (open, slide view, carousel nav, CTA click/hover).

**Request:**
```json
{
  "sessionId": "uuid-v4",
  "eventType": "screenshot_viewed",
  "screenshotIndex": 1,
  "screenshotId": "mfl_002",
  "dwellMs": 4200,
  "clientWidth": 1280,
  "clientHeight": 720
}
```

**Behavior:**
1. Resolve token → get `tokenId` + `campaignId` (same `resolvePreviewToken` logic)
2. If token invalid or expired → 404 (don't track events on dead tokens, except `gallery_opened` on an expired token which is still logged so we know they tried)
3. Validate `eventType` against the allowed set
4. Enrich with `userAgent`, `ipHash`, `deviceType`, `geoCountry`, `geoCity` from the request
5. Call `GalleryAnalyticsService.trackEvent()` (fire-and-forget — 200 even if tracking fails internally)
6. Return `{ success: true }`

**Response:** `200 { success: true }` (always, even if internal tracking fails — never block the UX on analytics)

#### `POST /api/public/marketing/gallery/:token/events/batch`

Batch-track multiple events in a single request. Used by the frontend to batch heartbeats (see §5.5) and to flush queued events on `session_end` (page unload via `sendBeacon`).

**Request:**
```json
{
  "sessionId": "uuid-v4",
  "events": [
    { "eventType": "session_heartbeat", "dwellMs": 30000 },
    { "eventType": "session_heartbeat", "dwellMs": 60000 },
    { "eventType": "screenshot_viewed", "screenshotIndex": 2, "screenshotId": "mfl_003", "dwellMs": 15000 }
  ]
}
```

**Behavior:** Same resolution + enrichment as single-event endpoint, then calls `trackEvents()` (batch insert).

**Response:** `200 { success: true, tracked: 3 }`

### 4.7 Aggregation Job

A periodic job (mirroring `qr-analytics-sync.ts` and `coupon-analytics-sync.ts`) runs daily to compute `mkt_gallery_analytics` rollups from `mkt_gallery_events`.

**File:** `apps/api/src/jobs/gallery-analytics-sync.ts`

**Schedule:** Daily at 2:00 AM (via existing job scheduler)

**Logic:**
1. Query `mkt_gallery_events` grouped by `token_id`, `DATE_TRUNC('day', created_at)`
2. Compute: `total_opens`, `unique_sessions` (distinct `session_id`), `total_screenshot_views`, `total_carousel_navs`, `cta_clicks`, `cta_hovers`, `avg_session_duration_ms` (from `session_end` events), `avg_screenshots_viewed` (distinct `screenshot_id` per session), device breakdown, top geo
3. Upsert into `mkt_gallery_analytics` with `ON CONFLICT (token_id, period_start, period_type) DO UPDATE`

### 4.8 Admin Analytics Endpoints

#### `GET /api/admin/marketing-ops/campaigns/:id/gallery-analytics`

Per-campaign engagement summary. Returns aggregate metrics across all gallery tokens for the campaign.

**Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "mkt_001",
    "businessName": "Joe's Plumbing",
    "tokens": [
      {
        "tokenId": "mdpt_abc",
        "tokenPreview": "aB3x...32chars",
        "createdAt": "2026-08-08T14:30:00Z",
        "expiresAt": "2026-08-11T14:30:00Z",
        "isExpired": false,
        "viewedAt": "2026-08-09T10:15:00Z",
        "totalOpens": 3,
        "uniqueSessions": 2,
        "avgSessionDurationMs": 127000,
        "totalScreenshotViews": 8,
        "totalCarouselNavs": 5,
        "ctaClicks": 1,
        "ctaHovers": 2,
        "screenshotsViewed": [0, 1, 2],
        "deviceBreakdown": { "mobile": 2, "desktop": 1, "tablet": 0 },
        "topCountry": "US",
        "topCity": "Austin",
        "recentEvents": [
          { "eventType": "cta_clicked", "createdAt": "2026-08-09T10:17:30Z", "deviceType": "mobile" },
          { "eventType": "gallery_opened", "createdAt": "2026-08-09T10:15:00Z", "deviceType": "mobile" }
        ]
      }
    ],
    "campaignTotals": {
      "totalOpens": 3,
      "uniqueSessions": 2,
      "ctaClicks": 1,
      "viewToCtaRate": 0.33,
      "avgSessionDurationMs": 127000
    }
  }
}
```

#### `GET /api/admin/marketing-ops/gallery-analytics/dashboard`

Cross-campaign dashboard. Top campaigns by engagement, funnel metrics (opened → viewed screenshots → clicked CTA → paid), date-range filterable.

**Query params:** `?from=2026-08-01&to=2026-08-31&operatorId=xxx`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalGalleriesOpened": 145,
      "uniqueProspects": 89,
      "totalCtaClicks": 23,
      "totalConversions": 8,
      "openToCtaRate": 0.159,
      "ctaToConversionRate": 0.348,
      "openToConversionRate": 0.055,
      "avgSessionDurationMs": 94000
    },
    "topCampaigns": [
      {
        "campaignId": "mkt_001",
        "businessName": "Joe's Plumbing",
        "opens": 3,
        "ctaClicks": 1,
        "conversions": 1,
        "avgDurationMs": 127000
      }
    ],
    "funnel": {
      "opened": 145,
      "viewedAllScreenshots": 78,
      "clickedCta": 23,
      "paid": 8
    },
    "byArchetype": [
      {
        "archetype": "A2",
        "archetypeLabel": "Negative Review Recovery",
        "galleriesOpened": 42,
        "uniqueProspects": 28,
        "ctaClicks": 9,
        "conversions": 4,
        "openToCtaRate": 0.214,
        "avgSessionDurationMs": 142000
      },
      {
        "archetype": "A3",
        "archetypeLabel": "Listing Drift",
        "galleriesOpened": 38,
        "uniqueProspects": 24,
        "ctaClicks": 5,
        "conversions": 1,
        "openToCtaRate": 0.132,
        "avgSessionDurationMs": 87000
      },
      {
        "archetype": "A1",
        "archetypeLabel": "Review Gap",
        "galleriesOpened": 35,
        "uniqueProspects": 21,
        "ctaClicks": 4,
        "conversions": 2,
        "openToCtaRate": 0.114,
        "avgSessionDurationMs": 76000
      },
      {
        "archetype": "A4",
        "archetypeLabel": "CTA Gap",
        "galleriesOpened": 18,
        "uniqueProspects": 11,
        "ctaClicks": 3,
        "conversions": 1,
        "openToCtaRate": 0.167,
        "avgSessionDurationMs": 95000
      },
      {
        "archetype": "A6",
        "archetypeLabel": "Product Visibility Gap",
        "galleriesOpened": 12,
        "uniqueProspects": 5,
        "ctaClicks": 2,
        "conversions": 0,
        "openToCtaRate": 0.167,
        "avgSessionDurationMs": 118000
      }
    ],
    "timeline": [
      { "date": "2026-08-08", "opens": 12, "ctaClicks": 2, "conversions": 0 },
      { "date": "2026-08-09", "opens": 18, "ctaClicks": 4, "conversions": 2 }
    ]
  }
}
```

The `byArchetype` breakdown lets operators see which pain narratives convert best — e.g. "A2 (Negative Recovery) galleries have 2x the CTA click rate of A1 (Review Gap) — focus screenshot capture effort on themed negative clusters."

### 4.9 Outreach Log Integration

The existing `mkt_outreach_log.preview_token` column stores the gallery token string. When an operator logs an outreach contact that includes a gallery link, they pass the token value. The outreach log record then links the dispatch to the token, enabling view-rate analytics (dispatch date → first `gallery_opened` event → time-to-view).

No schema change needed — the column already exists.

### 4.10 View Tracking & Operator Notification

On first `gallery_opened` event (when `token.viewed_at` is null):
- Stamp `viewed_at = NOW()` on `mkt_deliverable_preview_tokens`
- Log `audit()` event: `{ action: 'view', actorType: 'customer', metadata: { token_id, campaign_id, business_name } }`
- Fire-and-forget operator notification (email or in-app) — "Prospect opened diagnostic gallery for [Business Name]"
- Future enhancement: adjust cascade priority in `ReviewCascadeService` based on view event

This is handled inside `GalleryAnalyticsService.trackEvent()` as a side effect of the `gallery_opened` event type — no separate endpoint needed.

---

## 5. Frontend

### 5.1 Public Gallery Page — `/preview/[token]`

**Route:** `apps/web/src/app/preview/[token]/page.tsx` (Server Component → fetches initial data) + `apps/web/src/app/preview/[token]/GalleryClient.tsx` (Client Component → carousel, countdown, CTA)

**Page states:**

| State | Trigger | Render |
|---|---|---|
| Loading | Initial fetch | Skeleton loader |
| Active | Token valid, not expired | Full gallery (countdown + carousel + friction + CTA) |
| Expired | `expires_at < now` | Re-activation hook |
| Invalid | Token not found | Error card with "request a fresh scan" link |

**Active gallery layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [LOGO]   {galleryTitle}                              ⏰ 47h 12m    │
│           {gallerySubtitle}                              remaining   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    CAROUSEL / MAGAZINE SLIDER                 │  │
│  │  [ < ]  ┌─────────────────────────────────────────┐  [ > ]   │  │
│  │         │          Screenshot N of M               │          │  │
│  │         │          (annotated image)                │          │  │
│  │         └─────────────────────────────────────────┘           │  │
│  │         ● ● ● ○ ○  (dots indicator)                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  FRICTION SUMMARY:                                                  │
│  🔴 Phone Number Mismatch — Google shows (555) 123-4567;           │
│      Facebook shows (555) 987-6543                                  │
│  🔴 Dead Website Link — Facebook 'Visit Website' returns 404       │
│  🟡 Address Drift — Google lists 123 Main St; Yelp lists 125 Main  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  {cta_label}                                                        │
│  [ ⚡ {cta_label} — {amountFormatted} ]  →  /marketing/pay?ptoken=  │
└─────────────────────────────────────────────────────────────────────┘
```

**Countdown timer:** Client-side `setInterval` computing remaining time from `expiresAt`. Displays as `Xd Yh Zm` (days/hours/minutes). When it hits zero, the page auto-switches to the expired state without a refetch (optimistic). A "refresh" button can refetch to get the server-confirmed expired state.

**Carousel:** Simple state-driven slider (current index, prev/next buttons, dot indicators). Keyboard accessible (arrow keys). No external carousel library — lightweight custom implementation with Mantine or Tailwind.

**Tech stack:** Mantine UI (`@mantine/core`) — consistent with existing public marketing pages (`/marketing/pay`, `/marketing/claim`). Tailwind is acceptable if the page is standalone enough.

### 5.2 Expired State

```
┌─────────────────────────────────────────────────────────────────────┐
│  [LOGO]                                                             │
│                                                                     │
│  ⏰ This diagnostic report for {businessName} expired on {date}.   │
│                                                                     │
│  The screenshots and friction analysis are no longer available.     │
│  Click below to request a fresh scan from our team.                 │
│                                                                     │
│  [ Request Fresh Scan ]  →  /marketing/claim?expired=true           │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Frontend Service — `DiagnosticGalleryPublicService`

New service at `apps/web/src/services/DiagnosticGalleryPublicService.ts`:
- Extends `PublicApiSingleton` with `ttl: 0` (no caching — token state is time-sensitive)
- `getGallery(token: string): Promise<GalleryData>` — calls `GET /api/public/marketing/gallery/:token`
- `trackEvent(token, event): Promise<void>` — calls `POST /api/public/marketing/gallery/:token/events`
- `trackEventBatch(token, events): Promise<void>` — calls `POST /api/public/marketing/gallery/:token/events/batch`
- Double-wrap unwrap: `result.data?.data ?? result.data`

### 5.4 Engagement Beacon Hook — `useGalleryTracking`

Client-side hook at `apps/web/src/app/preview/[token]/useGalleryTracking.ts` that instruments every user interaction and beacons events to the backend. This is the core of the engagement analytics system.

```typescript
interface UseGalleryTrackingInput {
  token: string;
  tokenId: string;
  campaignId: string;
  screenshots: Array<{ id: string }>;
  isExpired: boolean;
}

interface TrackedEvent {
  eventType: GalleryEventType;
  screenshotIndex?: number;
  screenshotId?: string;
  dwellMs?: number;
}

function useGalleryTracking({ token, tokenId, campaignId, screenshots, isExpired }: UseGalleryTrackingInput) {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const sessionStartRef = useRef(Date.now());
  const currentSlideStartRef = useRef(Date.now());
  const heartbeatQueueRef = useRef<TrackedEvent[]>([]);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fire a single event ──
  const track = useCallback((event: TrackedEvent) => {
    // Don't track on expired/invalid pages (except gallery_opened for "they tried" signal)
    if (isExpired && event.eventType !== 'gallery_opened') return;
    DiagnosticGalleryPublicService.trackEvent(token, {
      sessionId,
      ...event,
      clientWidth: window.innerWidth,
      clientHeight: window.innerHeight,
    }).catch(() => {}); // fire-and-forget — never block UX
  }, [token, sessionId, isExpired]);

  // ── On mount: gallery_opened ──
  useEffect(() => {
    track({ eventType: 'gallery_opened', dwellMs: 0 });
  }, [track]);

  // ── Heartbeat: every 30s while page is visible ──
  useEffect(() => {
    const sendHeartbeats = () => {
      if (document.visibilityState !== 'visible') return;
      const elapsed = Date.now() - sessionStartRef.current;
      track({ eventType: 'session_heartbeat', dwellMs: elapsed });
    };
    heartbeatTimerRef.current = setInterval(sendHeartbeats, 30_000);
    return () => clearInterval(heartbeatTimerRef.current!);
  }, [track]);

  // ── Screenshot viewed: called by carousel on slide change ──
  const trackSlideView = useCallback((index: number, screenshotId: string) => {
    const dwell = Date.now() - currentSlideStartRef.current;
    // Record dwell on the PREVIOUS slide before switching
    // (handled by carousel component — see below)
    currentSlideStartRef.current = Date.now();
    track({ eventType: 'screenshot_viewed', screenshotIndex: index, screenshotId, dwellMs: dwell });
  }, [track]);

  // ── Carousel navigation ──
  const trackCarouselNav = useCallback((direction: 'next' | 'prev', targetIndex: number) => {
    track({ eventType: direction === 'next' ? 'carousel_next' : 'carousel_prev', screenshotIndex: targetIndex });
  }, [track]);

  // ── CTA interactions ──
  const trackCtaClick = useCallback(() => {
    track({ eventType: 'cta_clicked' });
  }, [track]);

  const trackCtaHover = useCallback(() => {
    track({ eventType: 'cta_hovered' });
  }, [track]);

  // ── Session end: flush on unload / visibility hidden ──
  useEffect(() => {
    const flushSessionEnd = () => {
      const dwell = Date.now() - sessionStartRef.current;
      // Use sendBeacon for reliability on page unload (won't be cancelled)
      const payload = JSON.stringify({
        sessionId,
        events: [{ eventType: 'session_end', dwellMs: dwell }],
      });
      const url = `/api/public/marketing/gallery/${token}/events/batch`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      } else {
        // Fallback: fetch with keepalive
        fetch(url, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
      }
    };

    // Flush on tab close / page unload
    window.addEventListener('beforeunload', flushSessionEnd);
    // Flush on tab hidden (mobile backgrounding)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSessionEnd();
    });

    return () => {
      window.removeEventListener('beforeunload', flushSessionEnd);
    };
  }, [token, sessionId]);

  return { trackSlideView, trackCarouselNav, trackCtaClick, trackCtaHover };
}
```

**Key design decisions:**

1. **`sendBeacon` for session end:** The `navigator.sendBeacon` API guarantees delivery even when the page is being unloaded — the browser queues it. This is critical for capturing the final `session_end` event with the total dwell time. Fallback to `fetch` with `keepalive: true` for browsers without `sendBeacon`.

2. **Heartbeat batching (Phase 2 optimization):** For MVP, each heartbeat fires a single `POST /events` call every 30s. This is acceptable for low traffic. For scale, the hook can batch heartbeats in `heartbeatQueueRef` and flush via `POST /events/batch` every 2 minutes or on `visibilitychange`.

3. **Dwell time on slides:** The carousel component calls `trackSlideView(newIndex, newScreenshotId)` on each slide change. The hook computes dwell as the delta between the current call and the previous `currentSlideStartRef` — so the dwell is attributed to the slide the user was ON, not the one they're navigating TO.

4. **No cookies, no cross-session tracking:** `sessionId` is a fresh UUID per page load. We don't set cookies or localStorage. This means repeat visits from the same prospect count as separate sessions — which is the desired behavior for engagement analytics (we want to know how many times they opened the gallery, not who they are).

5. **Privacy:** No PII is collected. `userAgent` and `ipHash` are enriched server-side. The client only sends `sessionId`, `eventType`, `screenshotIndex`, `screenshotId`, `dwellMs`, and viewport dimensions.

### 5.5 Admin UI — Gallery Token Generation + Analytics

**Location:** Campaign detail page in the admin marketing-ops section — `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` (or the campaign detail page, whichever is the current operator surface for `preview_built`/`shown` campaigns).

**New panel: "Diagnostic Gallery"** with two tabs:

**Tab 1: "Gallery Link"**
- Shows archetype badge at the top of the panel (e.g. "A2 — Negative Review Recovery") with resolution reason — same badge pattern as the opener workspace
- Shows archetype-specific screenshot guidance (§2.5.2) — e.g. for A2: "Capture: the specific negative review cluster, Google review page showing the recurring theme, individual themed reviews"
- Shows uploaded diagnostic screenshots (from `GET /:campaignId/files` filtered to `file_type='diagnostic_screenshot'`)
- Upload button (uses existing file upload flow — presigned URL or direct POST to `/:campaignId/files`)
- "Generate Gallery Link" button → opens modal with:
  - Archetype badge displayed (read-only — resolved server-side, not operator-selectable)
  - TTL selector (default 3 days / 72h)
  - Gallery title (pre-filled with archetype-aware default from §2.5.2 — operator can override)
  - Gallery subtitle (pre-filled with archetype-aware default — operator can override)
  - Friction summary builder (add/remove rows: severity + label + detail; pre-filled with archetype-aware suggestions as placeholder text)
  - CTA label (pre-filled with archetype-aware default — operator can override)
  - CTA amount (auto-filled from `package_price_cents`)
- On generate: calls `POST /api/admin/marketing-ops/campaigns/:id/gallery-token` (archetype is stamped server-side)
- Displays the resulting URL with copy-to-clipboard
- Shows existing gallery tokens for the campaign (active + expired) with lifecycle status + archetype badge

**Tab 2: "Engagement Analytics"**
- Calls `GET /api/admin/marketing-ops/campaigns/:id/gallery-analytics`
- Per-token engagement summary cards (each token shows its archetype badge):
  - Total opens (with unique session count)
  - Avg session duration (formatted as Xm Ys)
  - Screenshots viewed (which slides got attention — heatmap bar chart)
  - CTA clicks + hovers
  - Device breakdown (mobile/desktop/tablet pie or bars)
  - Geo (top country/city if available)
- Recent activity feed (last 20 events with timestamps + event type icons)
- Funnel mini-widget: Opened → Viewed All Screenshots → Clicked CTA → Paid
- If no engagement yet: empty state with "No prospect views yet — link expires in Xd Yh"

**Cross-campaign dashboard** (separate page, linked from the marketing-ops admin index):
- Calls `GET /api/admin/marketing-ops/gallery-analytics/dashboard`
- Summary cards: total opens, unique prospects, CTA clicks, conversions, open-to-CTA rate, CTA-to-conversion rate, avg session duration
- **Archetype breakdown table** (the `byArchetype` array from the dashboard response):
  - One row per archetype (A1–A6) with: galleries opened, unique prospects, CTA clicks, conversions, open-to-CTA rate, avg session duration
  - Sortable by any column — lets operators see which pain narratives convert best
  - Bar chart comparing open-to-CTA rates across archetypes
- Top campaigns table (by engagement)
- Funnel widget: Opened → Viewed All Screenshots → Clicked CTA → Paid
- Timeline chart (opens + CTA clicks + conversions over time)

### 5.6 Admin Service Extension — `MarketingOpsService`

Add to `apps/web/src/services/MarketingOpsService.ts`:
- `generateGalleryToken(campaignId, params): Promise<GalleryTokenResult>`
- `listGalleryTokens(campaignId): Promise<GalleryToken[]>` (optional — can reuse existing pay-links list filtered by type)
- `getGalleryAnalytics(campaignId): Promise<GalleryCampaignAnalytics>` — per-campaign engagement
- `getGalleryDashboard(filters?): Promise<GalleryDashboardAnalytics>` — cross-campaign dashboard

---

## 6. Outreach Integration

### 6.1 Archetype Continuity — Opener → Gallery → CTA

The gallery's archetype is the **same archetype** as the outreach opener, by construction. Both resolve from the same campaign via `resolveCampaignArchetype()`. This creates a seamless narrative:

1. **Opener email** (A2): "A cluster of 5 negative reviews all point at the same thing — trip fees and pricing surprises. And they're sitting unanswered."
2. **Gallery landing** (A2): Title = "Review Recovery Diagnostic — Joe's Plumbing", subtitle = "A cluster of 5 negative reviews about trip fees — all unanswered", screenshots = the trip-fee review cluster
3. **Gallery CTA** (A2): "Fix the Trip-Fee Review Cluster — $149"
4. **Pay page**: same campaign, same price, same archetype-aware deliverable

The prospect never sees a disconnect between the email hook and the gallery framing. This is the core value of archetype awareness — the pain narrative is consistent across every touchpoint.

### 6.2 Email/SMS Template Insertion

The gallery URL is inserted into outreach messages as a variable. The pitch construction panel (`PitchConstructionPanel.tsx`) or the outreach log form gains a "Insert Gallery Link" button that:
1. Checks if a `diagnostic_gallery` token exists for the campaign
2. If not, prompts the operator to generate one (or auto-generates with archetype-aware defaults)
3. Inserts `{galleryUrl}` into the message body at cursor position
4. The gallery's archetype matches the opener's archetype by construction — no mismatch possible

### 6.3 Outreach Log

When logging an outreach contact (`POST /api/admin/marketing-ops/:campaignId/outreach`), the operator passes `preview_token: galleryTokenString`. This is already supported by the existing `mkt_outreach_log.preview_token` column and the `MarketingOutreachService.logContact` input.

### 6.4 View-Rate Analytics

With `viewed_at` on the token, `mkt_gallery_events` for granular engagement, and `preview_token` on outreach logs, the admin can see:
- Which outreach dispatches led to gallery views (join `mkt_outreach_log.preview_token` → `mkt_deliverable_preview_tokens.token` → `mkt_gallery_events`)
- Time-to-view (outreach `contact_date` → first `gallery_opened` event)
- View-to-conversion rate (first `gallery_opened` → `paid_at` / `converted_at`)
- Per-screenshot engagement (which friction points got the most dwell time)
- CTA click-through rate (opens → `cta_clicked` events)
- Full funnel: outreach dispatched → gallery opened → screenshots viewed → CTA clicked → paid

This is surfaced via the admin analytics endpoints in §4.8 and the campaign detail analytics tab in §5.5.

---

## 7. Security Considerations

### 7.1 Token Security

The existing `generatePreviewToken()` produces a 32-character high-entropy opaque token (nanoid with 62-char alphabet = ~190 bits entropy). This is sufficient — no HMAC signature layer is needed for the MVP. The token is the secret; the URL is `/preview/{token}`.

**Why not HMAC?** The original pitch proposed an HMAC signature over `{campaign_id, expires_at}`. This is unnecessary complexity for this use case:
- The token is already a random secret stored in the DB
- The DB is the source of truth for expiry (checked server-side on every request)
- HMAC adds a stateless verification path, but we're already doing a DB lookup for the campaign + files + screenshots
- If we later want stateless verification (e.g. for CDN caching), we can add an HMAC layer then

### 7.2 Screenshot Access

Screenshots are stored in a **private** Supabase bucket (reuse `disputes` bucket or create a `diagnostics` bucket). The public gallery endpoint generates **signed URLs** with a short TTL (e.g. 5 minutes) so the images can't be hotlinked or shared beyond the gallery session. The signed URL TTL is shorter than the token TTL — if the prospect refreshes the page after 5 minutes, new signed URLs are generated.

### 7.3 No PII Leakage

The gallery page shows:
- Business name (public information)
- Screenshots of public listings (Google, Facebook, Yelp — all publicly visible)
- Friction summary (derived from public audit data)

It does **not** show:
- Owner name or contact details (unless the operator explicitly includes them in the gallery subtitle)
- Internal campaign notes, pain score, estimated fee
- Operator-assigned-to or internal stage names

### 7.4 Analytics Data Privacy

The engagement analytics system is designed to collect behavioral data without PII:

| Data Point | Stored? | Privacy Treatment |
|---|---|---|
| IP address | **No** — only `SHA-256(ip + salt)` hash | Irreversible; salt from config |
| User agent | Yes (raw) | Needed for device-type parsing; no name/email embedded |
| Session ID | Yes (UUID per page load) | Not persisted in cookies; fresh per visit — no cross-session tracking |
| Geo (country/city) | Yes (if geo-IP configured) | Coarse-grained; no street-level |
| Referrer | Yes | The URL the prospect came from (e.g. email client) |
| Viewport dimensions | Yes | For responsive layout analytics |

**No cookies are set.** No `localStorage` or `sessionStorage` is used for tracking. The prospect is not identified or re-identified across visits. Each gallery open is an anonymous session.

**Event endpoint rate limiting:** The `POST /events` and `POST /events/batch` endpoints are rate-limited per token (e.g. 60 events/minute) to prevent abuse. Rate limiting uses the existing `RateLimitingService` keyed on the token value.

**Data retention:** Raw `mkt_gallery_events` rows are retained for 90 days, then archived/deleted by a cleanup job. Aggregate `mkt_gallery_analytics` rows are retained indefinitely (they're small and useful for long-term trends).

---

## 8. Implementation Phases

### Phase 1 — MVP (this spec)

- Migration 165 (gallery metadata columns)
- Migration 166 (gallery events + analytics tables)
- `generateCampaignToken` extension for `diagnostic_gallery` type
- `GalleryAnalyticsService` — event tracking + aggregation + query
- Archetype resolution at token generation (`resolveCampaignArchetype` integration)
- Archetype-aware defaults for gallery title, subtitle, CTA label, friction summary
- Admin route `POST /campaigns/:id/gallery-token`
- Public route `GET /api/public/marketing/gallery/:token` (includes archetype in response)
- Public tracking routes `POST /gallery/:token/events` + `/events/batch`
- Admin analytics routes `GET /campaigns/:id/gallery-analytics` + `/gallery-analytics/dashboard` (with `byArchetype` breakdown)
- Frontend gallery page `/preview/[token]` (active + expired states, archetype-aware framing)
- `useGalleryTracking` hook — engagement beacons (open, slide view, carousel nav, CTA, heartbeat, session end)
- Admin panel for screenshot upload + token generation (archetype badge + screenshot guidance + pre-filled defaults) + engagement analytics tab + cross-campaign dashboard with archetype breakdown
- Outreach log integration (existing `preview_token` column)
- Aggregation job (`gallery-analytics-sync.ts`)
- View tracking (`viewed_at` stamp + audit event + operator notification on first open)

### Phase 2 — Enhancements (future)

- Auto-generate friction summary from audit signals per archetype (A1→review metrics, A3→NAP variations, A4→website gaps, A6→product visibility)
- Cascade priority adjustment based on view event (boost prospects who opened but didn't click CTA)
- Heartbeat batching (flush every 2min instead of every 30s)
- A/B test gallery layouts (carousel vs. magazine grid) — segment A/B results by archetype
- Auto-screenshot capture pipeline (Playwright/puppeteer) — archetype-aware capture targets
- HMAC stateless token verification for CDN caching
- Real-time operator alert via WebSocket (instant notification on gallery open)
- Per-screenshot heatmap overlay (where the prospect's attention lingered — eye-tracking proxy via scroll/zoom)

---

## 9. Testing

### 9.1 Backend Tests

`apps/api/src/tests/diagnostic-gallery-routes.test.ts`:
- Token resolution: valid token → 200 with gallery data (includes `archetype` + `archetypeLabel`)
- Token resolution: expired token → 200 with `expired: true`
- Token resolution: invalid token → 404
- Token resolution: wrong type (deliverable token on gallery endpoint) → 404
- First view stamps `viewed_at`; second view does not overwrite
- No screenshots on campaign → 400 `no_screenshots` on token generation
- Stage gate: `seek` stage → 400, `paid` stage → 400, `preview_built`/`shown` → 201
- Supersede: generating a new token marks prior unconverted gallery tokens as converted
- Archetype stamping: token generation resolves archetype via `resolveCampaignArchetype` and stamps `gallery_archetype` on the token row
- Archetype defaults: when `gallery_title` omitted, server fills with archetype-aware default (A2 → "Review Recovery Diagnostic — {businessName}")
- Archetype defaults: when `cta_label` omitted, server fills with archetype-aware default (A2 → "Fix the {theme} Review Cluster")
- Archetype continuity: gallery token archetype matches opener archetype for the same campaign

`apps/api/src/services/__tests__/GalleryAnalyticsService.test.ts`:
- `trackEvent`: inserts a row into `mkt_gallery_events` with correct fields
- `trackEvent` with `gallery_opened`: stamps `viewed_at` on token if null; does not overwrite if already set
- `trackEvent` with `gallery_opened`: fires audit event + operator notification (mocked)
- `trackEvent`: enriches `deviceType` from `userAgent` (mobile/desktop/tablet/unknown)
- `trackEvent`: computes `ipHash` as SHA-256 of IP + salt (never raw IP)
- `trackEvents` (batch): inserts multiple rows in a single transaction
- `trackEvent` on expired token: still logs `gallery_opened` but rejects other event types
- `trackEvent` on invalid token: returns silently (fire-and-forget, no throw)
- `aggregateAnalytics`: computes correct rollup from raw events (total_opens, unique_sessions, cta_clicks, avg duration)
- `aggregateAnalytics`: upserts into `mkt_gallery_analytics` (ON CONFLICT updates)
- `getTokenAnalytics`: returns per-token summary with correct counts + device breakdown
- `getCampaignAnalytics`: aggregates across multiple tokens for a campaign
- `getDashboardAnalytics`: returns cross-campaign funnel (opened → viewed → clicked → paid)
- `getDashboardAnalytics`: returns `byArchetype` breakdown with per-archetype open/CTA/conversion rates

`apps/api/src/tests/diagnostic-gallery-tracking-routes.test.ts`:
- `POST /events`: valid event → 200, event row created
- `POST /events`: invalid event_type → 400
- `POST /events`: invalid/expired token → 404 (except `gallery_opened`)
- `POST /events/batch`: multiple events → 200, all rows created
- `POST /events/batch`: empty events array → 200 with `tracked: 0`
- Rate limiting: >60 events/min for same token → 429
- `GET /campaigns/:id/gallery-analytics`: requires auth → 401 without
- `GET /campaigns/:id/gallery-analytics`: response includes archetype badge per token
- `GET /gallery-analytics/dashboard`: requires auth → 401 without
- `GET /gallery-analytics/dashboard`: response includes `byArchetype` array with all 6 archetypes represented

### 9.2 Frontend

- Gallery page renders screenshots in carousel
- Gallery page displays archetype-aware title + subtitle (A2 → "Review Recovery Diagnostic")
- Countdown timer decrements correctly
- Expired state renders re-activation hook
- CTA button links to `/marketing/pay?ptoken={token}`
- CTA button displays archetype-aware label (A2 → "Fix the Trip-Fee Review Cluster")
- Keyboard navigation (arrow keys for carousel)
- Admin gallery link tab shows archetype badge + screenshot guidance
- Admin gallery link modal pre-fills title/subtitle/CTA with archetype-aware defaults
- Admin analytics tab shows archetype badge per token
- Admin cross-campaign dashboard shows archetype breakdown table
- `useGalleryTracking` fires `gallery_opened` on mount
- `useGalleryTracking` fires `screenshot_viewed` with correct `dwellMs` on slide change
- `useGalleryTracking` fires `carousel_next`/`carousel_prev` on navigation
- `useGalleryTracking` fires `cta_clicked` on CTA button click
- `useGalleryTracking` fires `cta_hovered` on CTA hover >500ms
- `useGalleryTracking` fires `session_heartbeat` every 30s
- `useGalleryTracking` fires `session_end` via `sendBeacon` on `beforeunload`
- `useGalleryTracking` fires `session_end` via `sendBeacon` on `visibilitychange` to hidden
- Admin analytics tab renders engagement summary cards
- Admin analytics tab renders recent activity feed
- Admin analytics tab shows empty state when no engagement

---

## 10. File Inventory

### New Files

| File | Purpose |
|---|---|
| `database/migrations/176_diagnostic_gallery_metadata.sql` | Gallery metadata columns on preview tokens |
| `database/migrations/177_diagnostic_gallery_analytics.sql` | Events + analytics tables |
| `apps/api/src/services/GalleryAnalyticsService.ts` | Event tracking, aggregation, query service |
| `apps/api/src/services/marketing/GalleryArchetypeDefaults.ts` | Archetype-aware default title/subtitle/CTA helper |
| `apps/api/src/jobs/gallery-analytics-sync.ts` | Daily aggregation job |
| `apps/api/src/jobs/gallery-events-purge.ts` | 90-day retention purge job |
| `apps/web/src/app/preview/[token]/page.tsx` | Server component — fetch gallery data |
| `apps/web/src/app/preview/[token]/GalleryClient.tsx` | Client component — carousel + countdown + CTA |
| `apps/web/src/app/preview/[token]/useGalleryTracking.ts` | Engagement beacon hook |
| `apps/web/src/services/DiagnosticGalleryPublicService.ts` | Frontend service (gallery + event tracking) |
| `apps/api/src/tests/diagnostic-gallery-routes.test.ts` | Backend route tests (token resolution, generation) |
| `apps/api/src/tests/diagnostic-gallery-tracking-routes.test.ts` | Backend tracking endpoint tests |
| `apps/api/src/services/__tests__/GalleryAnalyticsService.test.ts` | Analytics service unit tests |

### Existing Files Extended

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Introspected from DB after migrations 176 + 177 (do NOT edit directly — run `prisma db pull`) |
| `apps/api/src/routes/marketing-ops-public.ts` | Add `GET /gallery/:token`, `POST /gallery/:token/events`, `POST /gallery/:token/events/batch` + `resolveSource` update (NOT `classifyTokenType` — see G2) |
| `apps/api/src/routes/marketing-ops.ts` | Add `POST /campaigns/:id/gallery-token`, `POST /:campaignId/files/upload`, `GET /campaigns/:id/gallery-analytics`, `GET /gallery-analytics/dashboard` |
| `apps/api/src/routes/routeRegistry.ts` | Register new public gallery + tracking routes |
| `apps/api/src/services/MarketingDeliverableService.ts` | Extend `generateCampaignToken` signature: widen `tokenType` union + add `galleryMeta` param |
| `apps/api/src/services/MarketingCampaignService.ts` | Add `'diagnostic_gallery'` to `ConversionSource` union type |
| `apps/api/src/services/OutreachOpenerService.ts` | Import `resolveCampaignArchetype` in gallery token route (already exported — no change to the function itself) |
| `apps/api/src/lib/id-generator.ts` | Add `generateGalleryEventId` + `generateGalleryAnalyticsId` |
| `apps/api/src/config/unifiedConfig.ts` | Add `galleryIpHashSalt` (optional env var) |
| `apps/api/src/index.ts` | Register `startGalleryAnalyticsSync` + `startGalleryEventsPurge` jobs |
| `apps/web/src/services/MarketingOpsService.ts` | Add `generateGalleryToken`, `getGalleryAnalytics`, `getGalleryDashboard`, `uploadDiagnosticScreenshot` |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Add `gallery` tab (NOT `RecoveryDetailClient.tsx` — see G35) |
| Admin marketing-ops dashboard | Add cross-campaign gallery analytics dashboard with archetype breakdown |

---

## 11. Gap Analysis — Spec vs. Codebase Verification

This section documents every discrepancy found by verifying the spec against the actual codebase. Items are classified by severity.

### 11.1. Critical — Will Break Implementation If Not Fixed

#### G1. Migration numbers 165 and 166 are already taken

**Spec says:** `165_diagnostic_gallery_metadata.sql` and `166_diagnostic_gallery_analytics.sql`

**Codebase reality:** Migration 165 is `165_mkt_niche_tone_presets.sql`, 166 is `166_mkt_campaign_owner_names_phones.sql`, ... 175 is `175_mkt_checklist_stage_tags.sql`. The next available migration number is **176**.

**Fix:** Renumber to `176_diagnostic_gallery_metadata.sql` and `177_diagnostic_gallery_analytics.sql`. Update all references in §3.2, §3.5, §8, §9, §10.

#### G2. `classifyTokenType` function does not exist

**Spec says (§4.4):** "Add `diagnostic_gallery` to the `classifyTokenType` switch so the pay page treats it like a standard campaign token."

**Codebase reality:** There is no `classifyTokenType` function in `marketing-ops-public.ts` or anywhere else. The relevant function is `resolveSource(token)` (line 68 of `marketing-ops-public.ts`), which returns `'demo_storefront'` or `'qr_deliverable'` based on `token_type`. The pay page's `resolvePreviewToken` (line 52) doesn't filter by token type at all — it accepts any valid, non-expired token and resolves the campaign.

**Fix:** Replace all references to `classifyTokenType` with `resolveSource`. The actual change needed is:
1. Add `'diagnostic_gallery'` to `resolveSource` so it returns `'diagnostic_gallery'` (a new `ConversionSource` value) instead of falling through to `'qr_deliverable'`
2. Add `'diagnostic_gallery'` to the `ConversionSource` union type in `MarketingCampaignService.ts` (line 53)
3. No change needed to `resolvePreviewToken` — it already accepts any token type

#### G3. `generateCampaignToken` signature doesn't match the spec's proposed extension

**Spec says (§4.1):** The existing signature is `generateCampaignToken(campaignId, tokenType, deliverableId?, expiryDays, ctx?)` and we extend it with `galleryMeta`.

**Codebase reality:** The actual signature (line 598 of `MarketingDeliverableService.ts`) is:
```typescript
async generateCampaignToken(
  campaignId: string,
  tokenType: 'deliverable' | 'demo_storefront',  // ← union type, NOT arbitrary string
  deliverableId?: string,
  expiryDays: number = 30,
  ctx?: RequestCtx
): Promise<any>
```

The `tokenType` is a **literal union**, not `string`. The spec's proposed `'diagnostic_gallery'` in the union is correct, but the spec also says "already accepts an arbitrary `tokenType` string" — **this is wrong**. It's a typed union. The extension must add `| 'diagnostic_gallery'` to the union.

Also: the method is called as `MarketingDeliverableService.generateCampaignToken(...)` (static-style) in the pay-links route (line 4378), but it's actually an instance method (`this.prisma` inside). The route uses `MarketingDeliverableService.generateCampaignToken` — need to verify whether it's a static method or instance. Looking at the code: the class is a singleton via `BaseService`, and the route calls it as `MarketingDeliverableService.generateCampaignToken` — this works because the class exports a singleton or has static methods. The spec should clarify this.

**Fix:** Correct §4.1 to say "the `tokenType` parameter is a literal union `'deliverable' | 'demo_storefront'` — we add `| 'diagnostic_gallery'` to the union." Remove the claim that it "already accepts an arbitrary string."

#### G4. Supersede pattern in §4.2 has duplicate step numbers

**Spec says (§4.2 Behavior):** Steps 1-5, then "4. Call `generateCampaignToken`..." and "5. Return token..." — steps 4 and 5 are duplicated (steps 4-5 from the first list, then 4-5 again).

**Fix:** Renumber the post-supersede steps to 6 and 7.

### 11.2. High — Schema/Pattern Mismatches

#### G5. `mkt_gallery_events` missing `tenant_id` column

**Spec says (§3.5):** The `mkt_gallery_events` table has `token_id`, `campaign_id`, `session_id`, etc. — no `tenant_id`.

**Codebase reality:** Both reference patterns (`qr_scan_events`, `funnel_events`) have a `tenant_id` column. The `FunnelAnalyticsService.trackFunnelEvent` requires `tenantId` in its input and uses `generateFunnelEventId(tenantId)` for the ID. The `QrAnalyticsService` also keys on `tenant_id`.

Marketing campaigns use `PLATFORM_SCOPE` (`'platform'`) as the tenant. The gallery events should follow the same pattern for consistency and to support future multi-tenant expansion.

**Fix:** Add `tenant_id VARCHAR(255) NOT NULL DEFAULT 'platform'` to `mkt_gallery_events` and `mkt_gallery_analytics`. Add `tenant_id` to the Prisma models. The `GalleryAnalyticsService.trackEvent` input should accept `tenantId` (defaulting to `PLATFORM_SCOPE`) and use `generateGalleryEventId(tenantId)` for the ID.

#### G6. No ID generator functions for gallery events/analytics

**Spec says:** Uses `mkt_gallery_events` and `mkt_gallery_analytics` tables with `id VARCHAR(255) PRIMARY KEY`.

**Codebase reality:** Every other event/analytics table has dedicated ID generators in `id-generator.ts`:
- `generateFunnelEventId(tenantId)` → `fevt-{tenantKey}-{nanoid}`
- `generateQrScanEventId(tenantId)` → `qrse-{tenantKey}-{nanoid}`
- `generateQrAnalyticsId(tenantId)` → `qra-{tenantKey}-{nanoid}`

The spec doesn't mention ID generation at all. Without a generator, the service will need to invent IDs inline.

**Fix:** Add to §4.5 and the file inventory:
- `generateGalleryEventId(tenantId)` → `gevt-{tenantKey}-{nanoid}` (format mirrors `fevt-`)
- `generateGalleryAnalyticsId(tenantId)` → `ga-{tenantKey}-{nanoid}` (format mirrors `qra-`)
- Both added to `apps/api/src/lib/id-generator.ts`

#### G7. `mkt_deliverable_preview_tokens` has RLS — new tables need RLS too

**Codebase reality:** The Prisma schema marks `mkt_deliverable_preview_tokens`, `mkt_files_list`, `mkt_outreach_log`, `qr_scan_events`, and `funnel_events` with the comment: "This model contains row level security and requires additional setup for migrations."

**Spec gap:** The spec's migration SQL (§3.5) uses `CREATE TABLE IF NOT EXISTS` but doesn't mention RLS policies. If the database has RLS enabled on the `public` schema (which it does, given the Prisma comments), the new tables need RLS policies or the service queries will fail.

**Fix:** Add to §3.5 migration:
```sql
ALTER TABLE mkt_gallery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_gallery_analytics ENABLE ROW LEVEL SECURITY;
-- RLS policies: platform-scoped service role bypasses RLS (existing pattern)
-- No per-tenant policies needed — gallery events are platform-scoped
```
Or document that the service uses the service-role key (which bypasses RLS) — matching how `qr_scan_events` is accessed.

#### G8. `resolveSource` needs a new `ConversionSource` value

**Spec says (§4.4):** The gallery token doubles as the pay token (Option A).

**Codebase reality:** The `resolveSource` function (line 68 of `marketing-ops-public.ts`) returns `'demo_storefront'` or `'qr_deliverable'`. The `ConversionSource` type in `MarketingCampaignService.ts` (line 53) is:
```typescript
export type ConversionSource =
  | 'qr_deliverable' | 'demo_storefront' | 'gbp_enhancer'
  | 'directory_preview' | 'manual' | 'external' | 'portal_checkout';
```

If a prospect pays via a gallery token, the conversion source would currently be `'qr_deliverable'` (the fallback) — losing the attribution signal.

**Fix:** Add `'diagnostic_gallery'` to the `ConversionSource` union. Update `resolveSource` to return `'diagnostic_gallery'` for that token type. This is how the system tracks which surface drove the conversion.

### 11.3. Medium — Incomplete Specifications

#### G9. File upload is metadata-only, not actual file upload

**Spec says (§5.5):** "Upload button (uses existing file upload flow — presigned URL or direct POST to `/:campaignId/files`)"

**Codebase reality:** The `POST /:campaignId/files` route (line 1332 of `marketing-ops.ts`) only creates a **metadata record** in `mkt_files_list` — it accepts `storage_path` as a string and doesn't handle file bytes. There is no presigned URL generation in `MarketingFileService`. The actual file upload to Supabase storage must happen **separately** — the frontend uploads to Supabase directly (or via another endpoint), gets the `storage_path`, then calls `POST /:campaignId/files` with that path.

The spec doesn't specify how the screenshot bytes get to Supabase. The `DisputeIntakeService` uses `multer` + direct Supabase upload (line 588). The marketing-ops file route has no such mechanism.

**Fix:** Add a §4.x section "Screenshot Upload Flow" specifying:
1. Frontend uploads screenshot bytes to Supabase `disputes` (or new `diagnostics`) bucket directly via the Supabase JS client (using a service-role-signed upload URL), OR
2. Add a new `POST /:campaignId/files/upload` route that accepts `multipart/form-data` (multer), uploads to Supabase, and creates the `mkt_files_list` record in one step (mirroring `DisputeIntakeService` pattern)

Option 2 is more consistent with the existing intake upload pattern.

#### G10. Signed URL generation for screenshots is unspecified

**Spec says (§4.3 step 7, §7.2):** "Generate signed URLs for each screenshot (private bucket — signed URL with short TTL)"

**Codebase reality:** The spec doesn't show the actual code or service for generating signed URLs. `DigitalAssetService.ts` has a `createSignedUrl` pattern (line 155), but it's for a different bucket. The `DisputeIntakeService` downloads files via `supabase.storage.from(StorageBuckets.DISPUTES.name).download(pathKey)` (line 653) — it doesn't generate signed URLs, it proxies the download through the API.

The spec needs to decide:
- **Option A:** Generate Supabase signed URLs (5-min TTL) and return them in the gallery payload. The frontend loads images directly from Supabase. Requires the `diagnostics` bucket to allow public read via signed URL.
- **Option B:** Proxy image downloads through the API: `GET /api/public/marketing/gallery/:token/screenshot/:fileId` → backend fetches from Supabase and streams to client. More secure (no signed URL exposure), but adds latency and load.

**Fix:** Pick one approach and specify it. Option A is simpler and matches the spec's current wording. Add the signed URL generation code to §4.3, using `supabase.storage.from(bucket).createSignedUrl(path, 300)` (5-min TTL).

#### G11. `tenant_id` on `mkt_deliverable_preview_tokens` not populated by `generateCampaignToken`

**Codebase reality:** The `mkt_deliverable_preview_tokens` schema has a `tenant_id` column (line 6525), but `generateCampaignToken` (line 606) doesn't set it — it only sets `id`, `campaign_id`, `deliverable_id`, `token_type`, `token`, `expires_at`. The `tenant_id` is null on all tokens.

**Spec gap:** The spec doesn't mention `tenant_id` on the token. This is fine for the MVP (the column is nullable), but the spec should acknowledge it. If RLS policies ever filter by `tenant_id`, gallery tokens would be invisible.

**Fix:** Add a note in §3.2 that `tenant_id` is not set by `generateCampaignToken` (existing behavior) and gallery tokens will have `tenant_id = null`, consistent with existing deliverable/demo tokens. No action needed for MVP.

#### G12. `BaseService.handleError` returns an Error, doesn't throw — but the spec says "never throws"

**Spec says (§4.5):** `trackEvent` is "fire-and-forget safe — never throws (mirrors FunnelAnalyticsService.trackFunnelEvent pattern)."

**Codebase reality:** `FunnelAnalyticsService.trackFunnelEvent` (line 77-96) catches errors and calls `this.handleError(error)` — which **returns** an Error (line 20 of `BaseService.ts`), it does **not** re-throw. So the claim is correct: the method catches and swallows. But `BaseService.handleError` logs the error and returns it; the caller ignores the return value, so the error is effectively swallowed.

**Verdict:** The spec's claim is accurate. No fix needed, but the spec should note that `handleError` is called for logging purposes and the returned Error is discarded (fire-and-forget pattern).

#### G13. Aggregation job registration not specified

**Spec says (§4.7):** "Daily aggregation job (`gallery-analytics-sync.ts`)"

**Codebase reality:** The QR analytics sync job is registered in `apps/api/src/index.ts` (line 238): `const { startQrAnalyticsSync } = await import('./jobs/qr-analytics-sync'); await startQrAnalyticsSync();`. The spec doesn't mention where the gallery analytics sync job is registered.

**Fix:** Add to §4.7: "Register in `apps/api/src/index.ts` alongside `startQrAnalyticsSync` — `const { startGalleryAnalyticsSync } = await import('./jobs/gallery-analytics-sync'); await startGalleryAnalyticsSync();`. Runs every 6 hours (same cadence as QR analytics)."

### 11.4. Low — Documentation/Clarity Issues

#### G14. `gallery_archetype` column added in §3.2 but not in the original §3.1 table summary

**Spec says (§3.1):** The table summary lists `gallery_title`, `gallery_subtitle`, `friction_summary`, `cta_label`, `cta_amount_cents` — but not `gallery_archetype`.

**Fix:** The §3.1 table is a high-level overview; the §3.2 migration is the source of truth. No fix needed, but for completeness, the §3.1 table could mention `gallery_archetype` as a sixth column.

#### G15. Spec references "Mantine or Tailwind" for the gallery page — existing public pages use Mantine

**Spec says (§5.1):** "Mantine UI (`@mantine/core`) — consistent with existing public marketing pages. Tailwind is acceptable if the page is standalone enough."

**Codebase reality:** The existing public marketing pages (`/marketing/pay`, `/marketing/claim`) use Mantine. The AGENTS.md rule says: "Mantine UI is used on marketing public pages (`@mantine/core`); customer account pages use Tailwind + `@/components/ui/*`."

**Fix:** Remove the "Tailwind is acceptable" hedge. The gallery page is a public marketing page → Mantine, full stop. This aligns with the AGENTS.md convention.

#### G16. `RecoveryDetailClient.tsx` may not be the right host for the gallery panel

**Spec says (§5.5):** "Location: ...`RecoveryDetailClient.tsx` (or the campaign detail page, whichever is the current operator surface for `preview_built`/`shown` campaigns)."

**Codebase reality:** `RecoveryDetailClient.tsx` exists at `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` — it's the recovery track detail page. The gallery is for `preview_built`/`shown` stage campaigns, which are in the **review track** (the main campaign pipeline), not necessarily the recovery track. The campaign detail page for the review track may be a different component.

**Fix:** Verify which admin component renders `preview_built`/`shown` campaigns. The spec's hedging language ("or the campaign detail page, whichever is the current operator surface") is acceptable for a draft, but should be pinned to a specific file before implementation.

#### G17. `cta_amount_cents` defaults to `campaign.package_price_cents` — but what if price is null?

**Spec says (§4.1):** "`ctaAmountCents` defaults to `campaign.package_price_cents` if not provided"

**Codebase reality:** The pay-links route (line 4364) has a comment: "Price guard (§8.1): warn but still allow minting (operator may have a custom-priced follow-on)." The `package_price_cents` can be null. The gallery CTA needs a price to display.

**Fix:** Add to §4.2: "If `cta_amount_cents` is omitted AND `campaign.package_price_cents` is null → 400 `no_price_set` (the gallery CTA requires a price to display). The operator must set the campaign price before generating a gallery token."

#### G18. Spec doesn't mention the `amount_cents` / `discount_cents` / `coupon_code` columns on the token

**Codebase reality:** `mkt_deliverable_preview_tokens` has `amount_cents`, `discount_cents`, `coupon_code`, `subscription_tier_id` columns (lines 6529-6532) that are set during the pay checkout flow (line 195-203 of `marketing-ops-public.ts`). When a gallery token doubles as a pay token (Option A, §4.4), these columns will be populated by the pay checkout — but the spec doesn't mention this interaction.

**Fix:** Add a note in §4.4: "When the gallery token is used for payment, the existing pay checkout flow populates `amount_cents`, `discount_cents`, `coupon_code`, and `subscription_tier_id` on the token row (existing behavior in `POST /api/public/marketing/pay/checkout`). No additional gallery-specific handling needed."

#### G19. `sendBeacon` payload doesn't match the batch endpoint schema

**Spec says (§5.4):** The `flushSessionEnd` function sends:
```javascript
const payload = JSON.stringify({
  sessionId,
  events: [{ eventType: 'session_end', dwellMs: dwell }],
});
const url = `/api/public/marketing/gallery/${token}/events/batch`;
navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
```

**Codebase gap:** The batch endpoint schema (§4.6) expects `{ events: TrackGalleryEventInput[] }` where each event has `sessionId`, `eventType`, `dwellMs`, `clientWidth`, `clientHeight`, etc. The `sendBeacon` payload only includes `sessionId` at the top level and `eventType`/`dwellMs` per event — missing `clientWidth`/`clientHeight` and the token is in the URL, not the body.

**Fix:** Update the `sendBeacon` payload to match the batch endpoint schema:
```javascript
const payload = JSON.stringify({
  events: [{
    sessionId,
    eventType: 'session_end',
    dwellMs: dwell,
    clientWidth: window.innerWidth,
    clientHeight: window.innerHeight,
  }],
});
```

#### G20. Spec doesn't specify `Content-Type` handling for `sendBeacon`

**Codebase gap:** `navigator.sendBeacon` with a `Blob` requires the `type` option to be set to `application/json` for the server to parse it. The spec does this correctly (`new Blob([payload], { type: 'application/json' })`), but the batch endpoint needs to handle the `sendBeacon` content type, which may differ from a normal `fetch` POST. Express's `express.json()` middleware should handle this, but it's worth noting.

**Fix:** No code fix needed, but add a note in §4.6: "The batch endpoint must accept `application/json` from both `fetch` and `sendBeacon` — Express's `express.json()` middleware handles both transparently."

### 11.5. Summary Table

| ID | Severity | Area | One-line summary |
|---|---|---|---|
| G1 | Critical | Migrations | 165/166 taken — renumber to 176/177 |
| G2 | Critical | Backend | `classifyTokenType` doesn't exist — use `resolveSource` |
| G3 | Critical | Backend | `generateCampaignToken` tokenType is a union, not arbitrary string |
| G4 | Critical | Spec | Duplicate step numbers in §4.2 |
| G5 | High | Schema | `mkt_gallery_events` missing `tenant_id` column |
| G6 | High | Backend | No ID generator functions for gallery events/analytics |
| G7 | High | Schema | New tables need RLS policies (or documented service-role bypass) |
| G8 | High | Backend | `ConversionSource` type needs `'diagnostic_gallery'` value |
| G9 | Medium | Backend | File upload is metadata-only — screenshot bytes upload unspecified |
| G10 | Medium | Backend | Signed URL generation for screenshots unspecified |
| G11 | Medium | Schema | `tenant_id` on token not populated (existing behavior, undocumented) |
| G12 | Medium | Backend | `handleError` returns Error, doesn't throw — spec claim is correct |
| G13 | Medium | Backend | Aggregation job registration in `index.ts` not specified |
| G14 | Low | Spec | §3.1 table summary missing `gallery_archetype` column |
| G15 | Low | Frontend | Remove "Tailwind acceptable" hedge — Mantine only per AGENTS.md |
| G16 | Low | Frontend | `RecoveryDetailClient.tsx` may be wrong host component |
| G17 | Low | Backend | `cta_amount_cents` null price case unhandled |
| G18 | Low | Backend | Token `amount_cents`/`discount_cents`/`coupon_code` interaction undocumented |
| G19 | Low | Frontend | `sendBeacon` payload doesn't match batch endpoint schema |
| G20 | Low | Backend | `sendBeacon` Content-Type handling note needed |

### 11.6. Additional Gaps — Cross-Review Findings

The following gaps were identified in a cross-review of the spec against the codebase. They supplement §11.1–11.5 with findings the original analysis missed.

#### G21. High — A2 theme not returned by `resolveCampaignArchetype`

**Spec says (§2.5.2):** A2 defaults use `{theme}` placeholder: "A cluster of {N} negative reviews about {theme} — all unanswered" and CTA "Fix the {theme} Review Cluster".

**Codebase reality:** `resolveCampaignArchetype()` returns `{ archetype, source, reason }` — it does **not** return the A2 negative-review `theme`. The `ResolvedArchetype` interface (line 88 of `OutreachOpenerService.ts`) has no `theme` field. The code comment at line 85 explicitly acknowledges this: "OutreachOpenerService.executeOpener uses the same logic inline (it needs the theme for A2, which the shared helper does not return)."

The `HeaderService` (line 141-145) solves this by calling `selectArchetype(auditData)` separately to get the theme when the resolved archetype is A2:
```typescript
const autoSel = selectArchetype(auditResult.auditData);
selection = resolved.archetype === 'A2'
  ? { archetype: 'A2', reason: resolved.reason, theme: autoSel.theme }
  : { archetype: resolved.archetype, reason: resolved.reason };
```

**Fix:** The gallery token generation endpoint (§4.2) must follow the same pattern — when `resolveCampaignArchetype` returns A2, call `selectArchetype(auditData)` to extract the `theme` for use in the A2 default title/subtitle/CTA. Document this in §4.2 step 2. Alternatively, extend `ResolvedArchetype` to include an optional `theme` field (breaking change to the interface — less desirable for MVP).

#### G22. High — A5 only produced by triage engine, not `selectArchetype` fallback

**Spec says (§2.5.1):** A5 (Dual-Signal Footprint Triage) is one of the six archetypes with its own gallery defaults.

**Codebase reality:** `selectArchetype()` (line 134 of `archetype-selection.ts`) **never returns A5**. The code comment at line 11-14 explicitly states: "A5_DUAL_TRIAGE is NOT produced by selectArchetype — it is only emitted by the TriageEngineService." A5 only surfaces when an operator-accepted triage result exists with a PB-05 playbook recommendation.

**Impact:** If a campaign has no operator-accepted triage, `resolveCampaignArchetype` falls back to `selectArchetype`, which will never yield A5. The A5 gallery defaults (title: "Footprint Diagnostic", CTA: "Fix Both Gaps") will rarely auto-fill — only when the operator has accepted a PB-05 triage recommendation.

**Fix:** Add a note in §2.5.2: "A5 gallery defaults only activate when an operator-accepted triage result with archetype A5 exists. Without accepted triage, the fallback `selectArchetype` will never produce A5 — the campaign will resolve to A1/A2/A3/A4/A6 instead. This is acceptable: A5 is a multi-signal triage outcome, not a deterministic signal extraction."

#### G23. High — Token-keyed rate limiting not supported by `RateLimitingService`

**Spec says (§7.4):** "The `POST /events` and `POST /events/batch` endpoints are rate-limited per token (e.g. 60 events/minute). Rate limiting uses the existing `RateLimitingService` keyed on the token value."

**Codebase reality:** `RateLimitingService.checkRateLimit()` (line 315 of `RateLimitingService.ts`) accepts `(ip: string, routeType: string, path: string)` — it is **IP-based only**. There is no token-keyed rate limiting capability. The middleware (line 788) extracts `req.ip` and passes it as the rate-limit key.

**Fix:** Two options:
1. **(Recommended for MVP)** Use IP-based rate limiting on the tracking endpoints (existing capability). The spec's "60 events/minute per token" becomes "60 events/minute per IP" — sufficient for abuse prevention. A single prospect's IP hitting one gallery won't exceed 60/min (heartbeats are every 30s = 2/min).
2. **(Phase 2)** Extend `RateLimitingService` with a `checkRateLimitByKey(key, routeType, path)` method that accepts an arbitrary key string (the token). This is a new capability — not a one-line change.

Update §7.4 to use IP-based rate limiting for MVP, with token-keyed as a Phase 2 enhancement.

#### G24. High — Operator notification service/template doesn't exist

**Spec says (§4.10):** "Fire-and-forget operator notification (email or in-app) — 'Prospect opened diagnostic gallery for [Business Name]'"

**Codebase reality:** No operator notification service or template exists. `RealtimeService` is customer-facing only (WebSocket to authenticated customer sessions). `EmailService` exists but has no "prospect opened gallery" template. There is no operator-facing notification channel (no operator WebSocket, no operator email dispatcher for gallery events).

**Fix:** For MVP, implement as an **in-app notification** stored in the database (a new `mkt_operator_notifications` table or reuse `crm_alerts` with a new `mkt_gallery_view` type). The operator sees it on their next admin page load. For Phase 2, add real-time WebSocket push. Update §4.10 to specify the storage mechanism and remove the "email or in-app" hedge — pick one for MVP.

Alternatively, use the existing `audit()` log (which already fires on first view) and surface it in the admin activity feed — no new notification infrastructure needed for MVP. The analytics tab (§5.5) already shows recent events; the first `gallery_opened` event is visible there.

#### G25. High — `resolvePreviewToken` returns null on expiry — can't reuse for expired 200 response

**Spec says (§4.3):** "If `expires_at < now` → 200 with `{ expired: true, expiredAt, businessName }`"

**Codebase reality:** The existing `resolvePreviewToken()` (line 52-66 of `marketing-ops-public.ts`) returns `null` when the token is expired:
```typescript
if (token.expires_at && token.expires_at < new Date()) {
  return null;
}
```
The pay page treats `null` as a 404 "Invalid or expired token." The gallery needs a **different** code path that returns the token row even when expired, so it can render the re-activation hook with business name + expiry date.

**Fix:** The gallery route cannot reuse `resolvePreviewToken`. It needs its own resolver (e.g. `resolveGalleryToken`) that:
1. Finds the token row (same as `resolvePreviewToken`)
2. If not found → 404 `invalid_token`
3. If `token_type !== 'diagnostic_gallery'` → 404
4. If expired → return the token row with an `expired: true` flag (does NOT return null)
5. If active → return the token row normally

Document this in §4.3 — explicitly note that `resolvePreviewToken` is NOT reused and a separate `resolveGalleryToken` function is needed.

#### G26. Medium — CTA price vs pay page price divergence

**Spec says (§4.1):** "`ctaAmountCents` defaults to `campaign.package_price_cents` if not provided"

**Codebase reality:** The pay page endpoint (`GET /api/public/marketing/pay`, line 97 of `marketing-ops-public.ts`) always uses `campaign.package_price_cents`:
```typescript
const packagePriceCents = campaign.package_price_cents || 0;
```
It does **not** read `token.amount_cents` or `token.cta_amount_cents`. The checkout endpoint (line 150) also uses `campaign.package_price_cents || 0`.

**Impact:** If the operator sets a custom `cta_amount_cents` on the gallery token (e.g. $199) but the campaign's `package_price_cents` is $149, the gallery CTA shows "$199" but the pay page charges $149. The prospect sees a price drop on the pay page — confusing.

**Fix:** Two options:
1. **(Recommended)** The gallery CTA `cta_amount_cents` is a **display-only** field — it must always match `campaign.package_price_cents`. Remove the ability to override it; auto-fill from campaign price only. The operator can change the campaign price if they want a different number.
2. **(Phase 2)** The pay page reads `token.cta_amount_cents` if present, falling back to `campaign.package_price_cents`. This requires changes to the pay endpoint and checkout flow — more complex, and risks breaking existing pay-link behavior.

Update §4.1 and §4.4 to clarify that `cta_amount_cents` is display-only and must equal `campaign.package_price_cents` for MVP.

#### G27. Medium — Heartbeat inflation of `avg_session_duration_ms`

**Spec says (§3.6, §5.4):** `session_heartbeat` fires every 30s while the page is visible. `session_end` fires on unload with final dwell.

**Codebase gap:** The aggregation job (§4.7) computes `avg_session_duration_ms` from events. If it naively sums `dwell_ms` across all event types (including heartbeats), the duration will be inflated — each heartbeat carries a cumulative `dwell_ms` (time since session start), so summing heartbeats + session_end would double-count.

**Fix:** The aggregation must compute session duration from the **last event per session** only:
```sql
-- Per-session duration = max(dwell_ms) across all events in that session
-- (heartbeats carry cumulative dwell, so the last heartbeat or session_end has the final duration)
SELECT session_id, MAX(dwell_ms) as session_duration
FROM mkt_gallery_events
WHERE token_id = ? AND event_type IN ('session_heartbeat', 'session_end')
GROUP BY session_id
```
Add this to §4.7 aggregation logic. Document that `dwell_ms` on heartbeats is **cumulative since session start**, not per-interval.

#### G28. Medium — Aggregation job is token-scoped, not tenant-scoped

**Spec says (§4.7):** "Daily aggregation job (`gallery-analytics-sync.ts`)"

**Codebase reality:** The `qr-analytics-sync.ts` job is **tenant-scoped** — it iterates tenants and aggregates per-tenant. Gallery analytics is **token/campaign-scoped** (no tenant dimension in the aggregation). The sync job cannot be a direct copy of the QR pattern; it must group by `token_id` and `campaign_id`.

**Fix:** Document in §4.7 that the aggregation query groups by `(token_id, campaign_id, period_start)` — not by tenant. The job iterates all gallery tokens with events in the period, aggregates each, and upserts into `mkt_gallery_analytics`. The job structure is:
```
1. Find all token_ids with mkt_gallery_events in the last 24h
2. For each token_id: aggregate events → upsert mkt_gallery_analytics row
3. Log completion
```

#### G29. Medium — No data-retention purge job for `mkt_gallery_events`

**Spec says (§7.4):** "Raw `mkt_gallery_events` rows are retained for 90 days, then archived/deleted by a cleanup job."

**Codebase reality:** No purge job is specified for `mkt_gallery_events`. Existing purge patterns: `log-purge.ts` (daily at 2 AM UTC, registered in `index.ts` line 256) and `flag-expiry-cleanup.ts` (daily, line 328).

**Fix:** Add to §4.7 and the file inventory: a `gallery-events-purge.ts` job (or extend `log-purge.ts`) that deletes `mkt_gallery_events` rows where `created_at < NOW() - INTERVAL '90 days'`. Register in `index.ts` alongside the other purge jobs. The `mkt_gallery_analytics` rows are retained indefinitely (no purge).

#### G30. Medium — `ipHashSalt` not in `unifiedConfig` + no geo-IP service config

**Spec says (§7.4):** "IP stored only as `SHA-256(ip + salt)` hash — never raw. Salt from config."

**Codebase reality:** No `ipHashSalt` field exists in `unifiedConfig.ts`. No geo-IP service is configured anywhere in the codebase. The `QrAnalyticsService` stores `geo_country`/`geo_city` but these fields are populated from request headers or a geo-IP lookup that isn't clearly configured.

**Fix:** Add to §4.5 (GalleryAnalyticsService):
1. Add `galleryIpHashSalt` to `unifiedConfig.ts` (env var: `GALLERY_IP_HASH_SALT`). If unset, IP hashing is skipped and `ip_hash` is null (graceful degradation — don't block the feature on config).
2. Geo-IP: for MVP, skip geo enrichment (set `geo_country`/`geo_city` to null). Add as a Phase 2 enhancement when a geo-IP service is configured. The `QrAnalyticsService` pattern can be followed once the service exists.

Update §7.4 to reflect that geo-IP is Phase 2 and IP hashing degrades gracefully if salt is unset.

#### G31. Medium — `crypto.randomUUID()` requires HTTPS secure context

**Spec says (§5.4):** `const sessionId = useMemo(() => crypto.randomUUID(), []);`

**Codebase reality:** `crypto.randomUUID()` requires a **secure context** (HTTPS or `localhost`). On HTTP (e.g. a prospect opening the gallery from an email link to a non-HTTPS staging environment), `crypto.randomUUID` is undefined and will throw.

The `uuid` package is not a direct dependency of `apps/web` (it may be a transitive dependency, but importing it directly is safer).

**Fix:** Use a fallback in the hook:
```typescript
const sessionId = useMemo(() => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (HTTP)
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}, []);
```
This avoids adding a dependency while handling the edge case. Update §5.4.

#### G32. Low — `file_type` is unconstrained — application-layer validation only

**Codebase reality:** `mkt_files_list.file_type` is `VarChar(50)` with no enum, CHECK constraint, or application-layer validation. The spec's `file_type='diagnostic_screenshot'` is a convention only.

**Fix:** Add a note in §3.3: "The `file_type` column has no database-level constraint. The `'diagnostic_screenshot'` value is enforced at the application layer — the gallery token generation route (§4.2) validates `COUNT(*) WHERE file_type = 'diagnostic_screenshot'` before minting a token. The file upload route does not validate `file_type` values — any string is accepted."

#### G33. Low — `POST /:campaignId/files` has no stage gate

**Codebase reality:** The file upload route (line 1332 of `marketing-ops.ts`) creates a `mkt_files_list` record without checking the campaign's stage. Operators can upload diagnostic screenshots at any stage (including `seek` before the audit is complete).

**Fix:** This is acceptable — operators may want to pre-stage screenshots before the gallery token is generated. The stage gate is on **token generation** (§4.2), not on file upload. Add a note in §3.3: "File upload has no stage gate — operators can upload screenshots at any stage. The stage gate is enforced at token generation (§4.2), not at upload time."

#### G34. Low — `DigitalAssetService.generateSignedUrl` is bucket-specific

**Codebase reality:** `DigitalAssetService.generateSignedUrl()` (line 150-168 of `DigitalAssetService.ts`) is hardcoded to `this.bucketName` (set at construction). It cannot be reused for a different bucket without instantiating a new service or refactoring.

**Fix:** The gallery route (§4.3) should generate signed URLs directly via the Supabase client:
```typescript
const { data, error } = await supabase.storage
  .from(StorageBuckets.DISPUTES.name)  // or new 'diagnostics' bucket
  .createSignedUrl(filePath, 300);  // 5-minute TTL
```
This mirrors the `DisputeIntakeService` pattern (line 588) of using the Supabase client directly. Document this in §4.3 and §7.2.

#### G35. Low — `CampaignDetailClient.tsx` is the actual operator surface (refines G16)

**Codebase reality:** The campaign detail page for the review track (where `preview_built`/`shown` campaigns live) is `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`. It has tabs: `overview | audits | files | deliverables | prompts | checklist | history | lineage | cascade` (line 26). There is no `gallery` tab.

`RecoveryDetailClient.tsx` is for the **recovery track** (dispute intake campaigns), not the review track. The spec's §5.5 location reference is incorrect for `preview_built`/`shown` campaigns.

**Fix:** Update §5.5 to reference `CampaignDetailClient.tsx` as the host component. Add a new `gallery` tab to the `Tab` union type (line 26) and the tabs array (line 315). The gallery panel renders when `activeTab === 'gallery'`.

### 11.7. Updated Summary Table (All Gaps)

| ID | Severity | Area | One-line summary |
|---|---|---|---|
| G1 | Critical | Migrations | 165/166 taken — renumber to 176/177 |
| G2 | Critical | Backend | `classifyTokenType` doesn't exist — use `resolveSource` |
| G3 | Critical | Backend | `generateCampaignToken` tokenType is a union, not arbitrary string |
| G4 | Critical | Spec | Duplicate step numbers in §4.2 |
| G5 | High | Schema | `mkt_gallery_events` missing `tenant_id` column |
| G6 | High | Backend | No ID generator functions for gallery events/analytics |
| G7 | High | Schema | New tables need RLS policies (or documented service-role bypass) |
| G8 | High | Backend | `ConversionSource` type needs `'diagnostic_gallery'` value |
| G9 | Medium | Backend | File upload is metadata-only — screenshot bytes upload unspecified |
| G10 | Medium | Backend | Signed URL generation for screenshots unspecified |
| G11 | Medium | Schema | `tenant_id` on token not populated (existing behavior, undocumented) |
| G12 | Medium | Backend | `handleError` returns Error, doesn't throw — spec claim is correct |
| G13 | Medium | Backend | Aggregation job registration in `index.ts` not specified |
| G14 | Low | Spec | §3.1 table summary missing `gallery_archetype` column |
| G15 | Low | Frontend | Remove "Tailwind acceptable" hedge — Mantine only per AGENTS.md |
| G16 | Low | Frontend | `RecoveryDetailClient.tsx` is wrong host — use `CampaignDetailClient.tsx` (see G35) |
| G17 | Low | Backend | `cta_amount_cents` null price case unhandled |
| G18 | Low | Backend | Token `amount_cents`/`discount_cents`/`coupon_code` interaction undocumented |
| G19 | Low | Frontend | `sendBeacon` payload doesn't match batch endpoint schema |
| G20 | Low | Backend | `sendBeacon` Content-Type handling note needed |
| G21 | High | Backend | A2 theme not returned by `resolveCampaignArchetype` — need separate `selectArchetype` call |
| G22 | High | Backend | A5 only from triage engine — `selectArchetype` fallback never yields A5 |
| G23 | High | Backend | Token-keyed rate limiting not supported — `RateLimitingService` is IP-only |
| G24 | High | Backend | Operator notification service/template doesn't exist |
| G25 | High | Backend | `resolvePreviewToken` returns null on expiry — can't reuse for expired 200 response |
| G26 | Medium | Backend | CTA price vs pay page price divergence — pay page ignores token-level price |
| G27 | Medium | Backend | Heartbeat `dwell_ms` is cumulative — aggregation must use MAX not SUM |
| G28 | Medium | Backend | Aggregation job is token-scoped, not tenant-scoped — can't copy `qr-analytics-sync` |
| G29 | Medium | Backend | No data-retention purge job for `mkt_gallery_events` |
| G30 | Medium | Backend | `ipHashSalt` not in `unifiedConfig` + no geo-IP service configured |
| G31 | Medium | Frontend | `crypto.randomUUID()` requires HTTPS — need fallback for non-secure contexts |
| G32 | Low | Schema | `file_type` is unconstrained — application-layer validation only |
| G33 | Low | Backend | `POST /:campaignId/files` has no stage gate (acceptable — gate is on token generation) |
| G34 | Low | Backend | `DigitalAssetService.generateSignedUrl` is bucket-specific — use Supabase client directly |
| G35 | Low | Frontend | `CampaignDetailClient.tsx` is the actual host (refines G16) — add `gallery` tab |

---

## 12. Sprint Plan

The spec's Phase 1 MVP (§8) is a single monolithic block. This section breaks it into **8 sprints** ordered by dependency layers, with every gap fix (G1–G35) woven into the sprint where it belongs. Each sprint produces a verifiable milestone.

### Dependency Graph

```
Sprint 1 (Schema & Foundation)
   │
   ├──→ Sprint 2 (Token Issuance & Archetype) ──→ Sprint 3 (Public Gallery API)
   │                                                    │
   │                                                    ▼
   └──→ Sprint 4 (Analytics Backend)               Sprint 5 (Frontend Gallery)
            │                                            │
            ├──→ Sprint 6 (Admin UI) ←──────────────────┘
            │
            ├──→ Sprint 7 (Jobs & Outreach Integration)
            │
            └──→ Sprint 8 (Tests & Verification) ←── (all sprints)
```

Sprints 2 and 4 can run in parallel after Sprint 1. Sprint 3 depends on Sprint 2. Sprint 5 depends on Sprints 3 + 4. Sprint 6 depends on Sprints 2 + 4. Sprint 7 depends on Sprint 4. Sprint 8 depends on all.

### Sprint Gate — TypeScript Checks (Non-Negotiable)

**Every sprint MUST end with zero new TypeScript errors on both apps. No exceptions. This is the final gate before marking a sprint complete.**

```bash
pnpm checkapi   # tsc --noEmit --project apps/api
pnpm checkweb   # tsc --noEmit --project apps/web
```

- **Zero new errors.** Pre-existing errors should not increase.
- **Run both checks** — API and web are independent TypeScript projects.
- **Do not skip, do not defer.** A sprint with TS errors is not complete.
- **Plan for this.** Allocate time at the end of every sprint to run checks and fix errors before committing.
- **Pre-flight:** Before starting each sprint, run the start-of-phase checklist (`.devin/skills/start-of-phase-sprint-checklist.md`) to plan singleton bases, ID generators, navigation, migration idempotency, and skill awareness.

### Sprint Gate — Prisma Schema Workflow

**Never edit `schema.prisma` directly.** All schema changes come from SQL migration files applied to the DB first, then introspected:

```bash
# 1. Write SQL migration file
# 2. Apply migration to DB
# 3. Introspect DB into Prisma schema + regenerate client
cd apps/api && doppler run --config local -- pnpm prisma db pull && pnpm prisma generate
```

This is the `manual-sql-migration-policy.md` convention. The Sprint 1 Prisma task below follows this flow.

---

### Sprint 1 — Schema & Foundation

**Goal:** Land the database schema, Prisma models, ID generators, and config additions. Nothing user-facing — pure infrastructure that unblocks all subsequent sprints.

**Tasks:**

1. **Migration 176: Gallery metadata columns** (fixes G1, G14)
   - File: `database/migrations/176_diagnostic_gallery_metadata.sql`
   - Add 6 columns to `mkt_deliverable_preview_tokens`: `gallery_title`, `gallery_subtitle`, `friction_summary`, `cta_label`, `cta_amount_cents`, `gallery_archetype`
   - All nullable (existing tokens unaffected)
   - Document: `tenant_id` on token is NOT set by `generateCampaignToken` (G11) — existing behavior, no change

2. **Migration 177: Gallery events + analytics tables** (fixes G1, G5, G7)
   - File: `database/migrations/177_diagnostic_gallery_analytics.sql`
   - `mkt_gallery_events` with `tenant_id VARCHAR(255) NOT NULL DEFAULT 'platform'` (G5)
   - `mkt_gallery_analytics` with `tenant_id VARCHAR(255) NOT NULL DEFAULT 'platform'` (G5)
   - `ENABLE ROW LEVEL SECURITY` on both tables + document service-role bypass (G7)
   - All indexes per §3.5

3. **Prisma schema introspection** (fixes G5) — **do NOT edit `schema.prisma` directly**
   - After migrations 176 + 177 are applied to the DB, run:
     ```bash
     cd apps/api && doppler run --config local -- pnpm prisma db pull && pnpm prisma generate
     ```
   - This introspects the DB into `schema.prisma` and regenerates the Prisma client with the new tables/columns as TypeScript types
   - Verify the generated models include `tenant_id` on `mkt_gallery_events` + `mkt_gallery_analytics` and the 6 gallery columns on `mkt_deliverable_preview_tokens`

4. **ID generators** (fixes G6)
   - File: `apps/api/src/lib/id-generator.ts`
   - Add `generateGalleryEventId(tenantId)` → `gevt-{tenantKey}-{nanoid}` (mirrors `generateFunnelEventId`)
   - Add `generateGalleryAnalyticsId(tenantId)` → `ga-{tenantKey}-{nanoid}` (mirrors `generateQrAnalyticsId`)

5. **Config additions** (fixes G30)
   - File: `apps/api/src/config/unifiedConfig.ts`
   - Add `galleryIpHashSalt` (env: `GALLERY_IP_HASH_SALT`) — optional, defaults to null
   - If null, IP hashing is skipped and `ip_hash` is null (graceful degradation)
   - No geo-IP config for MVP (Phase 2)

6. **ConversionSource type extension** (fixes G8)
   - File: `apps/api/src/services/MarketingCampaignService.ts`
   - Add `'diagnostic_gallery'` to the `ConversionSource` union type

7. **resolveSource update** (fixes G2)
   - File: `apps/api/src/routes/marketing-ops-public.ts`
   - Add `'diagnostic_gallery'` case to `resolveSource()` → returns `'diagnostic_gallery'`

**Verification:**
- Migrations 176 + 177 apply cleanly to the DB
- `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds (Sprint Gate — Prisma Schema Workflow)
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)
- Generated Prisma models include the new tables/columns

**Gaps closed:** G1, G2, G5, G6, G7, G8, G11, G14, G30 (config part)

---

### Sprint 2 — Token Issuance & Archetype Resolution

**Goal:** Operators can generate a diagnostic gallery token via the admin API, with archetype-aware defaults auto-filled. Depends on Sprint 1.

**Tasks:**

1. **Extend `generateCampaignToken`** (fixes G3)
   - File: `apps/api/src/services/MarketingDeliverableService.ts`
   - Widen `tokenType` union: `'deliverable' | 'demo_storefront' | 'diagnostic_gallery'`
   - Add optional `galleryMeta` parameter: `{ galleryTitle?, gallerySubtitle?, frictionSummary?, ctaLabel?, ctaAmountCents?, galleryArchetype? }`
   - Default `expiryDays` for `diagnostic_gallery` = 3 (not 30)
   - Persist gallery columns on the token row

2. **Admin route: `POST /campaigns/:id/gallery-token`** (fixes G4, G17, G26, G32, G33)
   - File: `apps/api/src/routes/marketing-ops.ts`
   - Validate campaign stage is `preview_built` or `shown` (stage gate)
   - Validate at least 1 `diagnostic_screenshot` file exists: `COUNT(*) WHERE file_type = 'diagnostic_screenshot'` (G32 — application-layer validation, no DB constraint)
   - Note: file upload itself has no stage gate (G33 — acceptable, gate is here)
   - If `cta_amount_cents` omitted AND `campaign.package_price_cents` is null → 400 `no_price_set` (G17)
   - `cta_amount_cents` is display-only — must equal `campaign.package_price_cents` for MVP (G26). Auto-fill from campaign price; reject operator override if it differs
   - Supersede prior unconverted `diagnostic_gallery` tokens (same pattern as pay-links route line 4368)
   - Fix step numbering: steps 1-7 (no duplicates) (G4)
   - Return token + gallery URL: `{baseUrl}/preview/{token.token}`

3. **Archetype resolution at token generation** (fixes G21, G22)
   - Call `resolveCampaignArchetype(campaignId, ctx)` → stamps `gallery_archetype` on token
   - For A2: also call `selectArchetype(auditData)` to extract the `theme` (G21 — mirrors `HeaderService` line 141-145 pattern)
   - Apply archetype-aware defaults for omitted title/subtitle/CTA (§2.5.2 tables)
   - Document: A5 defaults only activate when operator-accepted triage with A5 exists (G22 — `selectArchetype` fallback never yields A5). Acceptable for MVP.

4. **Archetype default helper**
   - New file: `apps/api/src/services/marketing/GalleryArchetypeDefaults.ts`
   - Export `getArchetypeDefaults(archetype, businessName, auditData, theme?)` → returns `{ galleryTitle, gallerySubtitle, ctaLabel }`
   - Contains the §2.5.2 default title/subtitle/CTA tables as code
   - A2 uses `theme` for `{theme}` placeholder substitution

**Verification:**
- `POST /campaigns/:id/gallery-token` with a `preview_built` campaign + 1 screenshot → 201 with token + URL
- Same call on `seek` stage → 400
- Same call with no screenshots → 400 `no_screenshots`
- Omitting `gallery_title` → response token has archetype-aware default
- A2 campaign → title contains the resolved theme
- Generating a second token → first token's `converted_at` is stamped
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)

**Gaps closed:** G3, G4, G17, G21, G22, G26, G32, G33

---

### Sprint 3 — Public Gallery API

**Goal:** A public endpoint resolves the gallery token and returns all data needed to render the page, including signed screenshot URLs and expired-state handling. Depends on Sprints 1 + 2.

**Tasks:**

1. **`resolveGalleryToken` function** (fixes G25)
   - File: `apps/api/src/routes/marketing-ops-public.ts`
   - Does NOT reuse `resolvePreviewToken` (which returns null on expiry)
   - New function that returns the token row even when expired (with an `expired` flag)
   - Steps: find token → 404 if not found → 404 if `token_type !== 'diagnostic_gallery'` → return `{ token, campaign, expired: boolean }`

2. **Public route: `GET /api/public/marketing/gallery/:token`** (fixes G10, G34)
   - File: `apps/api/src/routes/marketing-ops-public.ts`
   - Use `resolveGalleryToken`
   - If expired → 200 with `{ expired: true, expiredAt, businessName, reactivationUrl }`
   - If active → fetch `mkt_files_list` where `file_type = 'diagnostic_screenshot'`, ordered by `uploaded_at ASC`
   - Generate signed URLs via Supabase client directly (G34 — not `DigitalAssetService`):
     ```typescript
     const { data } = await supabase.storage
       .from(StorageBuckets.DISPUTES.name)  // reuse disputes bucket for MVP
       .createSignedUrl(filePath, 300);  // 5-minute TTL
     ```
   - Stamp `viewed_at` if null (first view)
   - Return gallery payload per §4.3 response shape (archetype, screenshots, friction, CTA, branding)

3. **Screenshot upload flow** (fixes G9)
   - Add `POST /:campaignId/files/upload` route to `marketing-ops.ts`
   - Accepts `multipart/form-data` (multer, mirroring `DisputeIntakeService` line 588)
   - Uploads to Supabase `disputes` bucket, creates `mkt_files_list` record with `file_type = 'diagnostic_screenshot'`
   - One-step upload (bytes + metadata) — not the metadata-only `POST /:campaignId/files` route

4. **Pay token bridging** (fixes G2 — already updated `resolveSource` in S1)
   - The gallery token doubles as the pay token (Option A)
   - `resolvePreviewToken` in the pay endpoint already accepts any token type — no change needed
   - `resolveSource` returns `'diagnostic_gallery'` (done in S1) → conversion attribution is correct
   - Document: pay page uses `campaign.package_price_cents`, not `token.cta_amount_cents` (G26 — display-only)

5. **Register routes in `routeRegistry.ts`**
   - Add `GET /api/public/marketing/gallery/:token` to the public routes section

**Verification:**
- `GET /gallery/valid-token` → 200 with screenshots array (signed URLs work)
- `GET /gallery/expired-token` → 200 with `{ expired: true, ... }`
- `GET /gallery/invalid-token` → 404
- `GET /gallery/deliverable-type-token` → 404 (wrong type)
- Signed URLs expire after 5 minutes
- `POST /:campaignId/files/upload` with a PNG → 201 with file record
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)

**Gaps closed:** G9, G10, G25, G34

---

### Sprint 4 — Analytics Backend

**Goal:** Engagement events can be tracked, aggregated, and queried. Operator notification fires on first view. Depends on Sprint 1 (schema + IDs). Can run in parallel with Sprints 2 + 3.

**Tasks:**

1. **`GalleryAnalyticsService`** (fixes G12, G24, G27, G28, G30)
   - File: `apps/api/src/services/GalleryAnalyticsService.ts`
   - Extends `BaseService`, singleton pattern
   - `trackEvent(input)`: inserts into `mkt_gallery_events`, fire-and-forget (catches errors, calls `this.handleError` which returns but doesn't throw — G12)
   - `trackEvents(inputs)`: batch insert via `createMany` in a transaction
   - `aggregateAnalytics(periodType, daysBack)`: token-scoped aggregation (G28 — groups by `token_id, campaign_id, period_start`, NOT tenant)
     - `avg_session_duration_ms` = `MAX(dwell_ms)` per session, then averaged (G27 — heartbeats carry cumulative dwell, use MAX not SUM)
   - `getTokenAnalytics(tokenId)`: per-token summary
   - `getCampaignAnalytics(campaignId)`: aggregate across tokens
   - `getDashboardAnalytics(filters)`: cross-campaign funnel + `byArchetype` breakdown
   - `getRecentEvents(tokenId, limit)`: live activity feed

2. **IP hashing + device parsing** (fixes G30)
   - `ipHash = SHA-256(req.ip + galleryIpHashSalt)` if salt is configured, else `null` (graceful degradation)
   - `parseDeviceType(userAgent)` — mirrors `QrAnalyticsService.parseDeviceType`
   - Geo enrichment: skip for MVP (fields null) — Phase 2

3. **First-view side effects** (fixes G24)
   - On `gallery_opened` when `token.viewed_at` is null:
     1. Stamp `viewed_at = NOW()` on token
     2. Log `audit()` event: `{ action: 'view', actorType: 'customer', metadata: { token_id, campaign_id, business_name } }`
     3. Operator notification: use the audit log + analytics tab activity feed (G24 — no new notification service for MVP). The first `gallery_opened` event is visible in the admin analytics tab's recent activity feed.
     - Document: real-time WebSocket notification is Phase 2

4. **Public tracking endpoints** (fixes G23)
   - File: `apps/api/src/routes/marketing-ops-public.ts`
   - `POST /api/public/marketing/gallery/:token/events` — single event
   - `POST /api/public/marketing/gallery/:token/events/batch` — batch events
   - Rate limiting: IP-based (G23 — `RateLimitingService` is IP-only, not token-keyed). 60 events/min per IP. Sufficient for MVP (one prospect's heartbeats = 2/min).
   - Always return 200 (fire-and-forget — never block UX on analytics)
   - Validate `eventType` against the 8 allowed types
   - Enrich with `userAgent`, `ipHash`, `deviceType` server-side

5. **Admin analytics endpoints**
   - File: `apps/api/src/routes/marketing-ops.ts`
   - `GET /campaigns/:id/gallery-analytics` — per-campaign summary with per-token breakdown
   - `GET /gallery-analytics/dashboard` — cross-campaign dashboard with `byArchetype` array
   - Both require admin auth

6. **Register routes in `routeRegistry.ts`**

**Verification:**
- `POST /events` with `gallery_opened` → 200, event row created, `viewed_at` stamped on token
- Second `gallery_opened` → 200, `viewed_at` NOT overwritten
- `POST /events` with invalid `eventType` → 400
- `POST /events/batch` with 3 events → 200, `tracked: 3`
- `POST /events` on expired token (non-`gallery_opened`) → 404
- `POST /events` on expired token (`gallery_opened`) → 200 (still tracked)
- `>60 events/min` from same IP → 429
- `GET /campaigns/:id/gallery-analytics` without auth → 401
- `GET /gallery-analytics/dashboard` → response includes `byArchetype` array
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)

**Gaps closed:** G12, G23, G24, G27, G28, G30 (full)

---

### Sprint 5 — Frontend Gallery Page

**Goal:** The public `/preview/[token]` page renders the diagnostic gallery with carousel, countdown, CTA, and engagement tracking. Depends on Sprints 3 (gallery API) + 4 (tracking API).

**Tasks:**

1. **`DiagnosticGalleryPublicService`** (fixes G15)
   - File: `apps/web/src/services/DiagnosticGalleryPublicService.ts`
   - Extends `PublicApiSingleton` with `ttl: 0`
   - `getGallery(token)`, `trackEvent(token, event)`, `trackEventBatch(token, events)`
   - Double-wrap unwrap: `result.data?.data ?? result.data`

2. **`/preview/[token]/page.tsx`** (Server Component)
   - File: `apps/web/src/app/preview/[token]/page.tsx`
   - Fetches gallery data server-side, passes to `GalleryClient`
   - Handles 404 (invalid token) with error card

3. **`/preview/[token]/GalleryClient.tsx`** (Client Component, Mantine) (fixes G15)
   - File: `apps/web/src/app/preview/[token]/GalleryClient.tsx`
   - **Mantine only** — remove "Tailwind acceptable" hedge (G15, per AGENTS.md)
   - States: loading skeleton, active gallery, expired, invalid
   - Active: countdown timer (client-side `setInterval`), carousel (custom, keyboard-accessible), friction summary, CTA button
   - CTA links to `/marketing/pay?ptoken={token}` (gallery token doubles as pay token)
   - Expired: re-activation hook with "Request Fresh Scan" → `/marketing/claim?expired=true`

4. **`useGalleryTracking` hook** (fixes G19, G31)
   - File: `apps/web/src/app/preview/[token]/useGalleryTracking.ts`
   - Session ID: `crypto.randomUUID()` with fallback for non-secure contexts (G31):
     ```typescript
     const sessionId = useMemo(() => {
       if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
       return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
     }, []);
     ```
   - `gallery_opened` on mount
   - `screenshot_viewed` on slide change (dwell on previous slide)
   - `carousel_next` / `carousel_prev` on navigation
   - `cta_clicked` on CTA click
   - `cta_hovered` on CTA hover >500ms
   - `session_heartbeat` every 30s while visible (cumulative `dwellMs`)
   - `session_end` via `sendBeacon` on `beforeunload` + `visibilitychange`
   - Fix `sendBeacon` payload to match batch endpoint schema (G19):
     ```typescript
     const payload = JSON.stringify({
       events: [{
         sessionId,
         eventType: 'session_end',
         dwellMs: dwell,
         clientWidth: window.innerWidth,
         clientHeight: window.innerHeight,
       }],
     });
     ```
   - Fallback: `fetch` with `keepalive: true` if `sendBeacon` unavailable

**Verification:**
- `/preview/valid-token` renders gallery with screenshots in carousel
- Archetype-aware title/subtitle display correctly (A2 → "Review Recovery Diagnostic")
- Countdown timer decrements
- CTA button links to pay page with correct ptoken
- Arrow keys navigate carousel
- `/preview/expired-token` renders re-activation hook
- `/preview/invalid-token` renders error card
- `gallery_opened` fires on mount (visible in network tab)
- `session_heartbeat` fires every 30s
- `session_end` fires on tab close (via sendBeacon)
- Page works on HTTP (session ID fallback works)
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)

**Gaps closed:** G15, G19, G31

---

### Sprint 6 — Admin UI

**Goal:** Operators can upload screenshots, generate gallery tokens, and view engagement analytics from the admin campaign detail page. Depends on Sprints 2 (token API) + 4 (analytics API).

**Tasks:**

1. **Add `gallery` tab to `CampaignDetailClient.tsx`** (fixes G16, G35)
   - File: `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
   - Add `'gallery'` to the `Tab` union type (line 26)
   - Add `{ key: 'gallery', label: 'Diagnostic Gallery' }` to the tabs array (line 315)
   - Render `GalleryPanel` component when `activeTab === 'gallery'`
   - Note: `RecoveryDetailClient.tsx` is for the recovery track (G16) — NOT used here

2. **`GalleryPanel` component** (Tab 1: Gallery Link)
   - File: `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/GalleryPanel.tsx`
   - Archetype badge at top (e.g. "A2 — Negative Review Recovery") with resolution reason
   - Archetype-specific screenshot guidance (§2.5.2 table)
   - Screenshot list (from `GET /:campaignId/files` filtered to `diagnostic_screenshot`)
   - Upload button → `POST /:campaignId/files/upload` (from Sprint 3)
   - "Generate Gallery Link" button → modal with:
     - Archetype badge (read-only)
     - TTL selector (default 3 days)
     - Gallery title (pre-filled with archetype default)
     - Gallery subtitle (pre-filled)
     - Friction summary builder (add/remove rows)
     - CTA label (pre-filled with archetype default)
     - CTA amount (auto-filled from `package_price_cents`, read-only — G26)
   - On generate → `POST /campaigns/:id/gallery-token`
   - Display resulting URL with copy-to-clipboard
   - List existing gallery tokens (active + expired) with lifecycle status + archetype badge

3. **`GalleryAnalyticsTab` component** (Tab 2: Engagement Analytics)
   - File: `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/GalleryAnalyticsTab.tsx`
   - Calls `GET /campaigns/:id/gallery-analytics`
   - Per-token engagement cards (archetype badge per token):
     - Total opens + unique sessions
     - Avg session duration (formatted Xm Ys)
     - Screenshots viewed heatmap (bar chart per slide)
     - CTA clicks + hovers
     - Device breakdown (mobile/desktop/tablet bars)
     - Geo (top country/city if available)
   - Recent activity feed (last 20 events)
   - Funnel mini-widget: Opened → Viewed All → Clicked CTA → Paid
   - Empty state: "No prospect views yet — link expires in Xd Yh"

4. **Cross-campaign dashboard page**
   - File: `apps/web/src/app/(platform)/settings/admin/marketing-ops/gallery-dashboard/page.tsx`
   - Calls `GET /gallery-analytics/dashboard`
   - Summary cards: total opens, unique prospects, CTA clicks, conversions, rates
   - **Archetype breakdown table** (one row per A1–A6): galleries opened, unique prospects, CTA clicks, conversions, open-to-CTA rate, avg duration
   - Sortable columns + bar chart comparing open-to-CTA rates
   - Top campaigns table
   - Funnel widget + timeline chart

5. **`MarketingOpsService` extensions** (fixes G18)
   - File: `apps/web/src/services/MarketingOpsService.ts`
   - `generateGalleryToken(campaignId, params)`
   - `listGalleryTokens(campaignId)` (filter existing pay-links list by `token_type`)
   - `getGalleryAnalytics(campaignId)`
   - `getGalleryDashboard(filters)`
   - `uploadDiagnosticScreenshot(campaignId, file)` (multipart upload)
   - Document: token `amount_cents`/`discount_cents`/`coupon_code` are populated by the pay checkout flow (G18 — existing behavior, no gallery-specific handling)

**Verification:**
- Campaign detail page shows "Diagnostic Gallery" tab for `preview_built`/`shown` campaigns
- Archetype badge displays correctly
- Screenshot upload works (file appears in list)
- Generate modal pre-fills archetype-aware defaults
- Generated URL is copyable
- Analytics tab shows engagement data after a prospect views the gallery
- Cross-campaign dashboard shows archetype breakdown table
- Empty states render when no data
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)

**Gaps closed:** G16, G18, G35

---

### Sprint 7 — Jobs & Outreach Integration

**Goal:** Daily aggregation rollup runs automatically, raw events are purged after 90 days, and operators can insert gallery links into outreach messages. Depends on Sprint 4 (analytics service).

**Tasks:**

1. **`gallery-analytics-sync.ts` aggregation job** (fixes G13, G27, G28)
   - File: `apps/api/src/jobs/gallery-analytics-sync.ts`
   - Mirrors `qr-analytics-sync.ts` structure but **token-scoped** (G28 — groups by `token_id, campaign_id`, not tenant)
   - Query: `mkt_gallery_events` grouped by `token_id, DATE_TRUNC('day', created_at)`
   - `avg_session_duration_ms` = average of `MAX(dwell_ms)` per session (G27 — MAX not SUM)
   - Upsert into `mkt_gallery_analytics` with `ON CONFLICT (token_id, period_start, period_type) DO UPDATE`
   - Schedule: daily at 2:00 AM UTC (via `setInterval` or cron, matching `log-purge.ts` pattern)

2. **Register aggregation job** (fixes G13)
   - File: `apps/api/src/index.ts`
   - Add alongside `startQrAnalyticsSync` (line 238):
     ```typescript
     const { startGalleryAnalyticsSync } = await import('./jobs/gallery-analytics-sync');
     await startGalleryAnalyticsSync();
     logger.info('Gallery analytics sync started (daily at 2 AM UTC)');
     ```

3. **`gallery-events-purge.ts` retention job** (fixes G29)
   - File: `apps/api/src/jobs/gallery-events-purge.ts`
   - Deletes `mkt_gallery_events` where `created_at < NOW() - INTERVAL '90 days'`
   - `mkt_gallery_analytics` rows retained indefinitely
   - Schedule: daily at 2:30 AM UTC (after aggregation, before log-purge)

4. **Register purge job**
   - File: `apps/api/src/index.ts`
   - Add alongside `startLogPurgeJob` (line 256):
     ```typescript
     const { startGalleryEventsPurge } = await import('./jobs/gallery-events-purge');
     startGalleryEventsPurge();
     logger.info('Gallery events purge job started (daily, 90-day retention)');
     ```

5. **Outreach log UI integration**
   - The backend already accepts `previewToken` in `MarketingOutreachService.logContact` (line 39) — no backend change
   - Add "Insert Gallery Link" button to the pitch construction / outreach log UI
   - When clicked, fetches the active gallery token for the campaign and inserts `/preview/{token}` into the message body
   - The `preview_token` field on `mkt_outreach_log` is populated with the gallery token string
   - View-rate analytics: join `mkt_outreach_log.preview_token` → `mkt_deliverable_preview_tokens.token` → `mkt_gallery_events` (schema supports this, no new code — the analytics query in Sprint 4 can use this join)

**Verification:**
- Aggregation job runs and populates `mkt_gallery_analytics` rows
- Re-running the job upserts (updates existing rows, doesn't duplicate)
- Purge job deletes events older than 90 days
- Analytics rows survive purge
- "Insert Gallery Link" button in outreach UI inserts the correct URL
- Outreach log record has `preview_token` populated
- `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
- `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)

**Gaps closed:** G13, G27 (full), G28 (full), G29

---

### Sprint 8 — Tests & Verification

**Goal:** Full test coverage for all backend and frontend components. Depends on all prior sprints.

**Tasks:**

1. **Backend route tests** (fixes G20)
   - File: `apps/api/src/tests/diagnostic-gallery-routes.test.ts`
   - Token resolution: valid → 200 with gallery data (includes `archetype` + `archetypeLabel`)
   - Token resolution: expired → 200 with `{ expired: true }`
   - Token resolution: invalid → 404
   - Token resolution: wrong type (deliverable token) → 404
   - First view stamps `viewed_at`; second view doesn't overwrite
   - No screenshots → 400 `no_screenshots` on token generation
   - Stage gate: `seek` → 400, `paid` → 400, `preview_built`/`shown` → 201
   - Supersede: new token marks prior unconverted gallery tokens as converted
   - Archetype stamping: token has `gallery_archetype` matching `resolveCampaignArchetype`
   - Archetype defaults: omitted `gallery_title` → archetype-aware default (A2 → "Review Recovery Diagnostic — {businessName}")
   - A2 theme: omitted `cta_label` → "Fix the {theme} Review Cluster" with resolved theme
   - Null price: `package_price_cents` null + no `cta_amount_cents` → 400 `no_price_set`
   - CTA price guard: `cta_amount_cents` ≠ `package_price_cents` → 400 (display-only enforcement)

2. **Analytics service tests**
   - File: `apps/api/src/services/__tests__/GalleryAnalyticsService.test.ts`
   - `trackEvent`: inserts row with correct fields
   - `trackEvent` with `gallery_opened`: stamps `viewed_at` if null; doesn't overwrite if set
   - `trackEvent` with `gallery_opened`: fires audit event (mocked)
   - `trackEvent`: enriches `deviceType` from `userAgent`
   - `trackEvent`: computes `ipHash` as SHA-256(IP + salt) when salt configured; null when not
   - `trackEvents` (batch): inserts multiple rows in one transaction
   - `trackEvent` on expired token: logs `gallery_opened`, rejects others
   - `trackEvent` on invalid token: returns silently (no throw)
   - `aggregateAnalytics`: correct rollup (total_opens, unique_sessions, cta_clicks)
   - `aggregateAnalytics`: `avg_session_duration_ms` uses MAX(dwell_ms) per session, not SUM (G27)
   - `aggregateAnalytics`: upserts (ON CONFLICT updates)
   - `getTokenAnalytics`: per-token summary with device breakdown
   - `getCampaignAnalytics`: aggregates across multiple tokens
   - `getDashboardAnalytics`: cross-campaign funnel
   - `getDashboardAnalytics`: `byArchetype` array with all 6 archetypes represented

3. **Tracking endpoint tests** (fixes G20)
   - File: `apps/api/src/tests/diagnostic-gallery-tracking-routes.test.ts`
   - `POST /events`: valid event → 200, row created
   - `POST /events`: invalid `eventType` → 400
   - `POST /events`: expired token (non-open) → 404
   - `POST /events`: expired token (`gallery_opened`) → 200
   - `POST /events/batch`: multiple events → 200, `tracked: N`
   - `POST /events/batch`: empty array → 200, `tracked: 0`
   - `POST /events/batch`: `sendBeacon` Content-Type (`application/json` via Blob) parsed correctly (G20)
   - Rate limiting: >60 events/min from same IP → 429
   - `GET /campaigns/:id/gallery-analytics`: no auth → 401
   - `GET /gallery-analytics/dashboard`: no auth → 401
   - `GET /gallery-analytics/dashboard`: `byArchetype` has all 6 archetypes

4. **Frontend tests**
   - Gallery page renders carousel with screenshots
   - Archetype-aware title/subtitle (A2 → "Review Recovery Diagnostic")
   - Countdown timer decrements
   - Expired state renders re-activation hook
   - CTA links to `/marketing/pay?ptoken={token}`
   - CTA label is archetype-aware (A2 → "Fix the {theme} Review Cluster")
   - Keyboard navigation (arrow keys)
   - `useGalleryTracking` fires all 8 event types correctly
   - `session_end` fires via `sendBeacon` on `beforeunload`
   - `session_end` fires via `sendBeacon` on `visibilitychange` to hidden
   - Session ID fallback works when `crypto.randomUUID` is undefined
   - Admin gallery tab shows archetype badge + screenshot guidance
   - Admin generate modal pre-fills archetype defaults
   - Admin analytics tab shows engagement cards + activity feed
   - Admin dashboard shows archetype breakdown table

5. **Full build verification**
   - `pnpm checkapi` passes with zero new errors (Sprint Gate — TS Checks)
   - `pnpm checkweb` passes with zero new errors (Sprint Gate — TS Checks)
   - `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` succeeds (Sprint Gate — Prisma Schema Workflow)
   - All new migrations apply cleanly to a fresh DB
   - All test suites pass

**Gaps closed:** G20 (full)

---

### Sprint Summary

| Sprint | Goal | Depends On | Gaps Closed |
|---|---|---|---|
| 1 | Schema & Foundation | — | G1, G2, G5, G6, G7, G8, G11, G14, G30 (config) |
| 2 | Token Issuance & Archetype | S1 | G3, G4, G17, G21, G22, G26, G32, G33 |
| 3 | Public Gallery API | S1, S2 | G9, G10, G25, G34 |
| 4 | Analytics Backend | S1 | G12, G23, G24, G27, G28, G30 (full) |
| 5 | Frontend Gallery Page | S3, S4 | G15, G19, G31 |
| 6 | Admin UI | S2, S4 | G16, G18, G35 |
| 7 | Jobs & Outreach Integration | S4 | G13, G27 (full), G28 (full), G29 |
| 8 | Tests & Verification | All | G20 (full) |

**Parallelism:** Sprints 2 + 4 can run simultaneously after Sprint 1. Sprint 3 starts after Sprint 2. Sprints 5 + 6 can run simultaneously after Sprint 4 (S5 also needs S3). Sprint 7 starts after Sprint 4. Sprint 8 is last.

**Critical path:** S1 → S2 → S3 → S5 → S8 (5 sprints on the longest path).

**All 35 gaps are closed by the end of Sprint 8.**
