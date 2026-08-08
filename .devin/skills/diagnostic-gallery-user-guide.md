---
description: Operator user guide for the Marketing Ops Diagnostic Gallery — an expiring tokenized screenshot report that shows prospects their cross-platform listing errors with engagement analytics. Covers screenshot upload, gallery token generation, outreach integration, the public gallery page, and the analytics dashboard.
---

# Diagnostic Gallery — Operator User Guide

The Diagnostic Gallery is a **tokenized public report** that shows prospects their cross-platform listing errors through operator-captured, annotated screenshots. The gallery URL expires (default 7 days), creating urgency. Every prospect interaction — opening the gallery, viewing screenshots, clicking the CTA — is tracked for analytics.

This guide covers the operator workflow end-to-end: from uploading screenshots to generating the gallery link, sharing it in outreach, and reviewing engagement analytics.

---

## When to Use the Diagnostic Gallery

The gallery is available when a campaign reaches the **`preview_built`** or **`shown`** stage. It is typically generated when outreach is dispatched (campaign transitions to `shown`), but operators can generate it earlier at `preview_built` to preview the gallery themselves before sending.

**Do not use the gallery when:**
- The campaign is at `seek` stage (no audit yet — no screenshots to capture)
- The campaign is at `paid` stage or beyond (prospect already converted — use the customer portal instead)

---

## Operator Workflow

```
1. Review audit signals (seek audit output)
2. Capture screenshots from Google / Facebook / Yelp / Website
3. Edit / annotate screenshots (red callouts, highlights)
4. Upload screenshots to the campaign (Gallery tab)
5. Generate gallery token (Gallery tab → Generate Link)
6. Share the gallery URL in outreach (Log Contact modal → Insert Gallery Link)
7. Prospect opens gallery → engagement events tracked
8. Review analytics (Gallery Analytics tab + cross-campaign dashboard)
```

---

## Step 1: Upload Screenshots

Screenshots are stored as `mkt_files_list` rows with `file_type = 'diagnostic_screenshot'`. The gallery renders them in **upload order** (oldest first), so upload in the display sequence you want the prospect to see.

### How to upload

1. Navigate to the campaign detail page: **Settings → Admin → Marketing Ops → Campaigns → [Campaign]**
2. Click the **Gallery** tab
3. In the **Screenshots** section, click **Upload** or drag a file into the upload zone
4. Select the annotated screenshot file (PNG, JPG — max 10 MB)
5. The file uploads to Supabase storage and appears in the screenshot list

### Screenshot guidance by archetype

The campaign's archetype (A1–A6) determines what screenshots to capture:

| Archetype | What to capture |
|---|---|
| **A1** (Review Response Gap) | Google review list (showing unanswered count), Yelp review list, individual unanswered reviews |
| **A2** (Negative Review Recovery) | The specific negative review cluster (theme-matched), Google review page showing the recurring theme, individual themed reviews |
| **A3** (Listing Drift) | Google listing (NAP), Yelp listing (NAP), Facebook listing (NAP) — side-by-side or annotated to show variations |
| **A4** (Conversion / CTA Gap) | Website homepage (annotated: no booking button, no click-to-call), mobile view, competitor site with working CTA (optional contrast) |
| **A5** (Dual-Signal) | Google listing (NAP drift) + review page (unanswered) — showing both gaps in one gallery |
| **A6** (Product Visibility) | Google Business Profile (photo tab — sparse/missing product photos), website (no product browsing), competitor GBP (rich product photos) |

### File naming

Use descriptive file names — the prospect sees them in the gallery:
- Good: `"Google vs Facebook — Phone Mismatch.png"`
- Good: `"Trip-Fee Review Cluster — 5 Reviews.png"`
- Bad: `"screenshot1.png"`

---

## Step 2: Generate the Gallery Token

The gallery token is the public URL that you share with the prospect. It is tokenized (no auth required — the token is the trust boundary) and expires after a configurable number of days.

### How to generate

1. On the campaign detail page, go to the **Gallery** tab
2. In the **Gallery Links** section, click **Generate Gallery Link**
3. A modal appears with pre-filled defaults based on the campaign's archetype:
   - **Gallery title** — archetype-aware default (e.g. "Review Recovery Diagnostic")
   - **Gallery subtitle** — archetype-aware default (e.g. "A recurring negative theme is dragging down your reputation")
   - **CTA label** — archetype-aware default (e.g. "Start Recovery")
   - **Expiry (days)** — default 7 days (configurable 1–365)
   - **Friction summary** — operator-authored rows describing the specific issues found
4. Override any fields as needed, then click **Generate**
5. The token is created and the gallery URL appears in the links list
6. Copy the URL with the **Copy** button

### What happens on generation

- The system resolves the campaign's archetype via `resolveCampaignArchetype()` and stamps it on the token (used for analytics segmentation)
- Archetype-aware defaults are applied for any omitted fields
- Prior unconverted `diagnostic_gallery` tokens for this campaign are superseded (marked `converted_at = now()`) — only one active gallery token remains
- The gallery URL format is: `{baseUrl}/preview/{token}`

### Stage gate

| Stage | Can generate? | Reason |
|---|---|---|
| `seek` | No | No audit yet — no screenshots to capture |
| `preview_built` | Yes | Audit complete, screenshots may be uploaded |
| `shown` | Yes | Outreach dispatched — typical generation point |
| `paid`+ | No | Prospect converted — use customer portal |

### Screenshot gate

At least 1 `diagnostic_screenshot` file must exist on the campaign before generating a token. If none exist, the system returns a `400 no_screenshots` error.

---

## Step 3: Share the Gallery URL in Outreach

The gallery URL can be included in outreach messages (email, SMS, phone log notes) so the prospect can click through to view their diagnostic report.

### Insert Gallery Link button

When logging a contact in the outreach workflow:

1. Open the **Log Contact** modal (from the campaign's outreach log or activity feed)
2. Compose your message in the **Message** field
3. Click the **Insert Gallery Link** button below the message field
4. The system fetches the most recent active (non-expired, non-converted) gallery token for the campaign and appends the URL to your message:

   ```
   View your diagnostic report: https://app.visibleshelf.com/preview/aB3x...
   ```

5. Complete the contact log entry

If no active gallery token exists, the system shows an error: *"No active gallery link found. Generate one in the Diagnostic Gallery tab first."*

### Outreach message template

A typical outreach message with a gallery link:

```
Hi {firstName},

I put together a free diagnostic report showing exactly what's happening
with your online presence:

{galleryUrl}

The report expires in 7 days. Take a look and let me know which areas
you'd like to tackle first.

— {operatorName}
```

---

## Step 4: The Public Gallery Page

When the prospect opens the gallery URL, they see a magazine-style report page at `/preview/[token]`.

### Page states

| State | What the prospect sees |
|---|---|
| **Loading** | Spinner while the token is resolved and screenshots are fetched |
| **Active** | Full gallery: countdown timer, screenshot carousel, friction summary, CTA button |
| **Expired** | Re-activation hook: business name + "This report has expired" + link to re-engage (`/marketing/pay?ptoken={token}`) |
| **Invalid** | "Invalid or unknown token" — the token doesn't exist or is the wrong type |

### Active gallery layout

```
┌─────────────────────────────────────────────┐
│  [Business Name]                             │
│  Digital Health Diagnostic Report            │
│  [Gallery Title — archetype-aware]           │
│  [Gallery Subtitle — archetype-aware]        │
│                                              │
│  ⏱ Expires in 2d 14h 32m                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │     [Screenshot 1 of N]             │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│  ◀ Prev                          Next ▶     │
│  Slide 1 / 3                                 │
│                                              │
├─────────────────────────────────────────────┤
│  Issues Found                                │
│  • [Friction row 1 — severity: critical]    │
│  • [Friction row 2 — severity: warning]     │
│  • [Friction row 3 — severity: info]        │
├─────────────────────────────────────────────┤
│  [Fix the Issue — $149.00]  ← CTA button    │
│  → links to /marketing/pay?ptoken={token}   │
└─────────────────────────────────────────────┘
```

### Engagement tracking

The gallery page fires engagement events on every prospect interaction. These are fire-and-forget (never block the UX) and rate-limited to 60 events/min per IP:

| Event | When it fires |
|---|---|
| `gallery_opened` | Page load (first view stamps `viewed_at` on the token) |
| `screenshot_viewed` | Carousel lands on a slide (with dwell time) |
| `carousel_next` / `carousel_prev` | User navigates the carousel |
| `cta_clicked` | User clicks the CTA button (strongest conversion signal) |
| `cta_hovered` | User hovers the CTA for >500ms (soft intent) |
| `session_heartbeat` | Every 30s while the page is visible (duration tracking) |
| `session_end` | Page unload / tab hidden (final duration) |

**Privacy:** IP addresses are hashed with SHA-256 + salt before storage. Raw IPs are never persisted. Device type (mobile/desktop/tablet) is parsed from the user agent.

---

## Step 5: Review Analytics

### Per-campaign analytics (Gallery Analytics tab)

On the campaign detail page, the **Gallery Analytics** tab shows:

- **Funnel summary:** total tokens, viewed tokens, total opens, unique sessions, CTA clicks, CTA click-through rate
- **Per-token engagement:** for each gallery token, shows opens, screenshot views, carousel navs, CTA clicks/hovers, avg session duration, device breakdown (mobile/desktop/tablet)
- **Device breakdown:** how many views came from mobile vs desktop vs tablet

### Cross-campaign dashboard

A dedicated analytics dashboard at **Settings → Admin → Marketing Ops → Gallery Dashboard** shows:

- **Overall funnel:** total tokens generated, viewed, converted (across all campaigns)
- **View rate:** percentage of tokens that were opened
- **Conversion rate:** percentage of viewed tokens that converted (CTA clicked → paid)
- **Total events:** raw engagement event count in the selected period
- **By archetype:** funnel metrics broken down by A1–A6, so you can see which archetypes convert best
- **Time period filter:** adjustable days-back (default 30, max 365)

### Aggregation schedule

Raw engagement events (`mkt_gallery_events`) are aggregated into rollup rows (`mkt_gallery_analytics`) by a background job:

| Job | Schedule | Purpose |
|---|---|---|
| `gallery-analytics-sync` | Daily at 2:00 AM UTC | Aggregates raw events into per-token per-day rollups (uses MAX dwell per session for avg duration) |
| `gallery-events-purge` | Daily at 2:30 AM UTC | Deletes raw events older than 90 days (rollups are retained) |

The analytics tab and dashboard read from the rollup table for performance. Raw events are retained for 90 days for detailed investigation.

---

## Key Files Reference

### Backend

| File | Role |
|---|---|
| `apps/api/src/routes/marketing-ops.ts` | Admin routes: `POST /campaigns/:id/gallery-token`, `POST /:campaignId/files/upload`, `GET /campaigns/:id/gallery-analytics`, `GET /gallery-analytics/dashboard` |
| `apps/api/src/routes/marketing-ops-public.ts` | Public routes: `GET /public/marketing/gallery/:token`, `POST /public/marketing/gallery/:token/events`, `POST /public/marketing/gallery/:token/events/batch` |
| `apps/api/src/services/GalleryAnalyticsService.ts` | Event tracking, aggregation, analytics queries (singleton) |
| `apps/api/src/services/marketing/GalleryArchetypeDefaults.ts` | Archetype-aware default title/subtitle/CTA/friction (pure function) |
| `apps/api/src/services/MarketingDeliverableService.ts` | `generateCampaignToken` — extended with `galleryMeta` param |
| `apps/api/src/jobs/gallery-analytics-sync.ts` | Daily aggregation job (2:00 AM UTC) |
| `apps/api/src/jobs/gallery-events-purge.ts` | Daily purge job (2:30 AM UTC) |
| `database/migrations/176_diagnostic_gallery_metadata.sql` | Gallery metadata columns on `mkt_deliverable_preview_tokens` |
| `database/migrations/177_diagnostic_gallery_analytics.sql` | `mkt_gallery_events` + `mkt_gallery_analytics` tables |

### Frontend

| File | Role |
|---|---|
| `apps/web/src/app/preview/[token]/page.tsx` | Public gallery page (Suspense-wrapped client component) |
| `apps/web/src/app/preview/[token]/GalleryClient.tsx` | Gallery UI: carousel, countdown, friction summary, CTA (Mantine) |
| `apps/web/src/app/preview/[token]/useGalleryTracking.ts` | Engagement tracking hook (beacons, heartbeats, session end) |
| `apps/web/src/services/DiagnosticGalleryPublicService.ts` | Frontend API client for gallery data (extends `PublicApiSingleton`, `ttl: 0`) |
| `apps/web/src/app/(platform)/.../GalleryPanel.tsx` | Admin: screenshot upload + gallery token management |
| `apps/web/src/app/(platform)/.../GalleryAnalyticsTab.tsx` | Admin: per-campaign analytics view |
| `apps/web/src/app/(platform)/.../gallery-dashboard/GalleryDashboardClient.tsx` | Admin: cross-campaign analytics dashboard |
| `apps/web/src/components/marketing-ops/LogContactModal.tsx` | Outreach: "Insert Gallery Link" button |

---

## API Endpoints Reference

### Public (no auth — token is the trust boundary)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/public/marketing/gallery/:token` | Resolve token → gallery data (screenshots, friction, CTA) |
| `POST` | `/api/public/marketing/gallery/:token/events` | Track a single engagement event (rate-limited 60/min per IP) |
| `POST` | `/api/public/marketing/gallery/:token/events/batch` | Track multiple events (max 50 per batch) |

### Admin (requires `authenticateToken` + `requirePlatformAdmin`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/admin/marketing-ops/campaigns/:id/gallery-token` | Generate a gallery token (stage + screenshot gated) |
| `POST` | `/api/admin/marketing-ops/:campaignId/files/upload` | Upload a diagnostic screenshot |
| `GET` | `/api/admin/marketing-ops/campaigns/:id/gallery-analytics` | Per-campaign analytics summary |
| `GET` | `/api/admin/marketing-ops/gallery-analytics/dashboard` | Cross-campaign dashboard (optional `?daysBack=30`) |

---

## Troubleshooting

### "No active gallery link found"

The **Insert Gallery Link** button in the Log Contact modal can't find an active token. Either:
- No gallery token has been generated yet → generate one in the Gallery tab
- All existing tokens have expired → generate a new one
- All existing tokens have been converted (superseded by a newer token) → generate a new one

### "no_screenshots" error on token generation

The campaign has no `diagnostic_screenshot` files. Upload at least one screenshot in the Gallery tab before generating a token.

### "invalid_stage" error on token generation

The campaign is not at `preview_built` or `shown` stage. Check the campaign stage — if it's at `seek`, the audit hasn't been run yet. If it's at `paid` or beyond, the prospect has already converted.

### Gallery page shows "expired" immediately

The token's `expires_at` has already passed. This happens if:
- The token was generated with a very short expiry (e.g. 1 day) and time has passed
- The system clock is correct but the token was generated long ago

Generate a new token with a longer expiry window.

### Analytics not showing data

- The aggregation job runs at 2:00 AM UTC — data may not appear until the next run
- The per-campaign analytics tab reads from the rollup table, not raw events
- Check that the prospect actually opened the gallery (the `gallery_opened` event stamps `viewed_at` on the token — if `viewed_at` is null, the gallery was never opened)
- Raw events older than 90 days are purged by the `gallery-events-purge` job

### Screenshots not appearing in the gallery

- Verify the file was uploaded with `file_type = 'diagnostic_screenshot'` (not `screenshot` — the gallery specifically queries `diagnostic_screenshot`)
- Check that the file belongs to the same campaign as the gallery token
- The gallery renders files in `uploaded_at ASC` order — re-upload if the order is wrong

---

## Archetype-Aware Defaults

When a gallery token is generated, the system resolves the campaign's archetype and pre-fills the gallery metadata with archetype-aware defaults. The operator can override any field.

| Archetype | Default Title | Default CTA Label |
|---|---|---|
| A1 | Review Response Diagnostic | Start Recovery |
| A2 | Review Recovery Diagnostic | Start Recovery |
| A3 | Listing Accuracy Diagnostic | Fix My Listings |
| A4 | Conversion Gap Diagnostic | Fix My Funnel |
| A5 | Multi-Signal Diagnostic | Start Recovery |
| A6 | Product Visibility Diagnostic | Fix My Visibility |

The archetype is resolved via `resolveCampaignArchetype(campaignId)`, which checks for an operator-accepted triage result first, then falls back to `selectArchetype(latestAuditData)`. The archetype is stamped on the token at generation time and used for analytics segmentation — it does not change if the triage is later re-evaluated.

---

## Design Decisions

- **Fire-and-forget analytics:** Event tracking never blocks the UX. If the database is down, events are silently dropped (logged server-side). The prospect never sees an error from analytics.
- **IP hashing:** Raw IPs are never stored. SHA-256 hash with salt is used for rate limiting and deduplication. When no salt is configured, `ip_hash` is null (graceful degradation).
- **Rate limiting:** 60 events/min per IP (in-memory, not Redis). Prevents abuse without infrastructure overhead. The 61st event in a 60-second window returns 429.
- **Supersede on regenerate:** Generating a new gallery token marks prior unconverted tokens as `converted_at = now()`. Only one active gallery token per campaign at a time.
- **Token doubles as pay token:** The gallery token is also the `ptoken` for the pay page (`/marketing/pay?ptoken={token}`). One token, one URL, one conversion path.
- **MAX dwell per session (G27):** `avg_session_duration_ms` uses the maximum `dwell_ms` value per session (not the last value), so heartbeats that report cumulative dwell are correctly measured.
- **Token-scoped aggregation (G28):** Analytics rollups group by `(token_id, campaign_id, date)`, not by tenant. This enables per-token drill-down in the analytics UI.
