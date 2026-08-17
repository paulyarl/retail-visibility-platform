# Sprint Plan: Directory Presence — Traffic Surface & Engagement Tracking

**Document Version:** 1.0
**Date:** 2026-08-17
**Status:** Draft — Ready for Review
**Prerequisite:** Directory Presence Seed & Claim sprint landed (migrations 206–209, `directory_presence_seeds`, `directory_field_provenance`, `directory_claim_tokens`, `directory_presence` tier, `directory_listings_list.listing_origin='directory_seed'`); `BehaviorTrackingService` + `user_behavior_simple` table operational; `GalleryAnalyticsService` pattern proven (token-gated public events, fire-and-forget, per-token + per-campaign rollups, audit-log first-view side effect).

This plan contains **one sprint** that turns the directory presence surface (`/place/[slug]` shopper-facing pages and `/directory/[slug]` claimed-tenant pages) into a first-class analytics surface — answering "which directory entry is getting traffic" and, beyond that, measuring the claim funnel from view → claim click → claim accepted.

---

## 1. Executive Summary

The platform already captures page-view events for directory entries. `StoreViewTracker` (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\components\tracking\StoreViewTracker.tsx" />) fires on both `/directory/[slug]` (claimed tenants) and `/place/[slug]` (unclaimed seeds — see <ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\app\place\[slug]\layouts\PlaceEntryEditorialLayout.tsx" lines="9,96" />), landing rows in `user_behavior_simple` with `entity_type='store'`, `page_type='directory_detail'`, `entity_id=<tenantId>`.

What's missing is the **readout**: no operator-facing view aggregates these events per listing, and no endpoint surfaces "which directory entry is getting traffic." Worse, seed listings are indistinguishable from claimed tenants in the raw events — splitting them requires a join to `tenants.org_standing_mode='directory_seed'` or `directory_listings_list.listing_origin='directory_seed'`. And only a single page-view event is captured — no claim clicks, no call/directions/QR clicks, no dwell, no scroll — so the claim funnel is invisible.

This sprint builds three layers, in order:

1. **Layer 1 — Readout (the core ask).** Admin endpoints + a dedicated "Directory Traffic" admin page that aggregates `user_behavior_simple` per seed, scoped to seeds via join. Answers "which directory entry is getting traffic" with what's already being captured. Pure read, no schema change.
2. **Layer 2 — Seed/claimed distinction in events.** Tag events fired from `/place` with `listing_origin: 'directory_seed'` and `surface: 'directory_seed'` in the `context` JSON so the readout doesn't depend on a join, and claimed-tenant traffic can be filtered out cleanly. Backfill script tags historical rows by join.
3. **Layer 3 — Engagement-grade tracking (mirror the gallery pattern).** Dedicated `directory_presence_events` table + public `POST /api/public/directory/places/:slug/events` endpoint (slug-gated, no auth, rate-limited, fire-and-forget — same shape as `/api/public/marketing/gallery/:token/events` at <ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\routes\marketing-ops-public.ts" lines="260-320" />). Captures `listing_viewed`, `claim_clicked`, `call_clicked`, `directions_clicked`, `qr_scanned`, `dwell_ms`, `session_heartbeat`. Makes directory presence a first-class analytics surface like the gallery, and the claim-conversion funnel becomes measurable: view → claim click → claim accepted.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Per-seed traffic readout** | Admin endpoint + page aggregating `user_behavior_simple` views, unique sessions, and 7/30-day trends per seed, scoped to seeds via join (Layer 1) then via tagged context (Layer 2) |
| **Dedicated Directory Traffic admin page** | New page at `/settings/admin/directory/traffic` ranking all seeds by views, with drill-down to per-seed detail (views over time, top referrers, device split) |
| **Seed/claimed event distinction** | `StoreViewTracker` on `/place` tags context with `listing_origin` + `surface`; backfill script tags historical rows |
| **Engagement event capture** | Public slug-gated `POST /api/public/directory/places/:slug/events` endpoint (fire-and-forget, rate-limited) captures `listing_viewed`, `claim_clicked`, `call_clicked`, `directions_clicked`, `qr_scanned`, `dwell_ms`, `session_heartbeat` |
| **Claim funnel measurement** | `claim_clicked` event + existing `directory_claim_tokens.consumed_at` join → view → claim click → claim accepted funnel per seed and in aggregate |
| **Per-seed engagement panel** | Seed detail page gains a "Traffic & Engagement" panel showing the funnel + recent events live feed (mirrors gallery token analytics) |
| **Cross-seed dashboard** | Directory Traffic page shows aggregate funnel across all seeds, top seeds by views, top seeds by claim CTR, trends |

### Why now

The directory presence tier is live with 10 Indianapolis seeds (migration 209). Operators have no visibility into whether shoppers are actually landing on these listings. Without traffic data, the team is flying blind on which seeds are worth outreach investment, which categories resonate, and whether the claim funnel is working. The capture infrastructure (`user_behavior_simple`, `BehaviorTrackingService`, the gallery analytics pattern) is proven and reusable — the readout is the missing piece. Layer 3 is included because the single page-view event can't answer "did the claim CTA get clicked" — and that's the conversion signal that justifies the seed program.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Strategy — Three Layers, One Surface

### Layer 1 — Readout from existing events (no schema change)

`user_behavior_simple` already has the rows. The gap is purely a read path:

- `GET /api/admin/directory-presence/presence-seeds/:id/traffic` — per-seed aggregate (views, unique sessions, 7/30/90-day counts, daily timeseries, top referrers, device split)
- `GET /api/admin/directory-presence/traffic` — cross-seed rollup (top seeds by views, aggregate funnel, category breakdown, trend)
- Frontend: dedicated Directory Traffic admin page + traffic panel on seed detail

**Scoping to seeds:** Layer 1 joins `entity_id` → `tenants.org_standing_mode='directory_seed'` (or `directory_listings_list.listing_origin='directory_seed'`). This works today but is a join. Layer 2 makes it a filter.

### Layer 2 — Tag events with listing_origin

Modify `StoreViewTracker` to accept an optional `listingOrigin` and `surface` prop, set them in `context` on the `/place` page (where `listing.listingOrigin === 'directory_seed'`). The `/directory` page leaves them unset (or sets `surface: 'directory_claimed'`). Backfill script tags historical rows by join so the readout can switch to the filter once backfilled.

This is a small change but it makes the readout deterministic and lets us split seed vs. claimed traffic in the cross-seed dashboard without a join on every query.

### Layer 3 — Engagement-grade tracking (gallery pattern)

Mirror `GalleryAnalyticsService` (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\services\GalleryAnalyticsService.ts" />) and the gallery public event routes (<ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\routes\marketing-ops-public.ts" lines="260-387" />):

- New `directory_presence_events` table (migration 210) — slug-scoped, not token-scoped (seeds are public browse pages, no token gate)
- New `DirectoryPresenceAnalyticsService` (extends `BaseService`, singleton — mirrors `GalleryAnalyticsService`)
- New public route `POST /api/public/directory/places/:slug/events` + `/events/batch` — slug-gated, rate-limited (60/min/IP), fire-and-forget, Zod-validated event types
- Frontend `useDirectoryPresenceTracking` hook (mirrors `useGalleryTracking` at <ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\app\preview\[token]\useGalleryTracking.ts" />) fires `listing_viewed` on mount, `claim_clicked` / `call_clicked` / `directions_clicked` / `qr_scanned` on CTA clicks, `session_heartbeat` with `dwell_ms` on interval
- Per-seed engagement panel on seed detail (mirrors gallery token analytics panel)
- Claim funnel: `listing_viewed` → `claim_clicked` → `directory_claim_tokens.consumed_at` (claim accepted)

**Why slug-gated, not token-gated:** The gallery is token-gated because it's a private prospect link. Directory presence pages are public browse pages — anyone can land on `/place/african-grocery-indianapolis`. The slug is the trust boundary (we only track events for slugs that resolve to a published seed listing). Rate limiting is IP-based, same as gallery.

---

## 3. Data Source — Existing Capture (Layer 1)

`user_behavior_simple` table. Relevant columns:

| Column | Type | Used for |
|---|---|---|
| `entity_id` | text | tenant_id (join to `tenants.id`) |
| `entity_type` | text | `'store'` |
| `page_type` | text | `'directory_detail'` |
| `context` | json | Layer 2 tags `listing_origin`, `surface` here |
| `session_id` | text | unique session count |
| `referrer` | text | top referrers |
| `user_agent` | text | device split |
| `timestamp` | timestamptz | timeseries |

**Scoping query (Layer 1, pre-backfill):**
```sql
SELECT
  t.id AS tenant_id,
  COUNT(*) AS views,
  COUNT(DISTINCT ub.session_id) AS unique_sessions
FROM user_behavior_simple ub
JOIN tenants t ON t.id = ub.entity_id
WHERE ub.entity_type = 'store'
  AND ub.page_type = 'directory_detail'
  AND t.org_standing_mode = 'directory_seed'
  AND ub.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY t.id
ORDER BY views DESC;
```

**Scoping query (Layer 2, post-backfill):**
```sql
SELECT
  entity_id AS tenant_id,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM user_behavior_simple
WHERE entity_type = 'store'
  AND page_type = 'directory_detail'
  AND context->>'surface' = 'directory_seed'
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY entity_id
ORDER BY views DESC;
```

---

## 4. Schema — Migration 210 (Layer 3)

`database/migrations/210_directory_presence_events.sql`

```sql
-- Directory Presence Events — engagement tracking for public seed listings
-- Mirrors mkt_gallery_events shape, slug-scoped instead of token-scoped.

CREATE TABLE directory_presence_events (
  id              VARCHAR(40) PRIMARY KEY,
  tenant_id       VARCHAR(50) NOT NULL,          -- the seed tenant
  listing_id      VARCHAR(50) NOT NULL,          -- directory_listings_list.id
  slug            VARCHAR(255) NOT NULL,         -- denormalized for fast filter
  session_id      VARCHAR(100),
  event_type      VARCHAR(40) NOT NULL,
  referrer        TEXT,
  user_agent      TEXT,
  ip_hash         VARCHAR(64),                   -- sha256(ip + salt), nullable
  device_type     VARCHAR(20),                   -- mobile|desktop|tablet|unknown
  dwell_ms        INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dpe_tenant_created ON directory_presence_events (tenant_id, created_at DESC);
CREATE INDEX idx_dpe_slug_created ON directory_presence_events (slug, created_at DESC);
CREATE INDEX idx_dpe_session ON directory_presence_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_dpe_event_type ON directory_presence_events (event_type, created_at DESC);

-- Allowed event types (enforced in Zod, documented here):
-- listing_viewed, claim_clicked, call_clicked, directions_clicked,
-- qr_scanned, session_heartbeat, session_end
```

No aggregation rollup table in this sprint — the event volume is low (public browse pages, 10 seeds initially) and queries are admin-only. Add a `directory_presence_analytics` rollup table in a follow-up sprint if volume grows. (The gallery has `mkt_gallery_analytics` because gallery tokens are sent in SMS bursts that spike traffic; seed pages are steady-state.)

### Migration 211 — Backfill script (Layer 2)

`database/migrations/211_backfill_directory_seed_event_context.sql`

```sql
-- Backfill: tag historical user_behavior_simple rows for seed tenants
-- so Layer 2 readout queries can filter by context->>'surface' = 'directory_seed'
-- instead of joining to tenants.
UPDATE user_behavior_simple ub
SET context = COALESCE(context, '{}'::json) || json_build_object(
  'listing_origin', 'directory_seed',
  'surface', 'directory_seed'
)::json
WHERE ub.entity_type = 'store'
  AND ub.page_type = 'directory_detail'
  AND ub.context->>'surface' IS NULL
  AND EXISTS (
    SELECT 1 FROM tenants t
    WHERE t.id = ub.entity_id
      AND t.org_standing_mode = 'directory_seed'
  );
```

Idempotent — the `context->>'surface' IS NULL` guard makes it safe to re-run.

---

## 5. Backend — DirectoryPresenceAnalyticsService (Layer 3)

`apps/api/src/services/DirectoryPresenceAnalyticsService.ts`

Mirrors `GalleryAnalyticsService` (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\services\GalleryAnalyticsService.ts" />):

- Extends `BaseService`, singleton `getInstance()`
- `trackEvent(input)` — single event, fire-and-forget, never throws
- `trackEvents(inputs)` — batch, fire-and-forget
- `getListingAnalytics(tenantId, daysBack)` — per-seed aggregate (views, unique sessions, claim clicks, call clicks, directions clicks, QR scans, avg dwell, device split)
- `getDashboardAnalytics(daysBack)` — cross-seed rollup (top seeds by views, aggregate claim funnel, category breakdown via join to `directory_presence_seeds.category`)
- `getRecentEvents(tenantId, limit)` — live activity feed for seed detail panel
- `getClaimFunnel(tenantId, daysBack)` — joins `directory_presence_events.claim_clicked` to `directory_claim_tokens.consumed_at` for view → click → accepted funnel

**IP hashing:** Reuse `unifiedConfig.galleryIpHashSalt` (or add `directoryPresenceIpHashSalt` — prefer reuse to avoid a new secret).

**Rate limiting:** Reuse the in-memory IP rate limiter pattern from `GalleryAnalyticsService` (60 events/min/IP). Either share the limiter or instantiate a separate one — separate is cleaner (different surfaces, different abuse vectors).

**ID generation:** Add `generateDirectoryPresenceEventId()` to `apps/api/src/lib/id-generator.ts` (prefix `dpe-`).

### Event types (Zod-validated)

```typescript
const ALLOWED_EVENT_TYPES = z.enum([
  'listing_viewed',
  'claim_clicked',
  'call_clicked',
  'directions_clicked',
  'qr_scanned',
  'session_heartbeat',
  'session_end',
]);
```

---

## 6. Backend — Readout Service (Layer 1 + 2)

`apps/api/src/services/DirectoryPresenceTrafficService.ts`

Read-only service that aggregates `user_behavior_simple` for seed listings. No new table — queries the existing behavior table.

- `getSeedTraffic(seedId, daysBack)` — per-seed: views, unique sessions, daily timeseries, top referrers, device split. Joins `directory_presence_seeds` → `tenants` → `user_behavior_simple.entity_id`.
- `getTrafficDashboard(daysBack)` — cross-seed: top seeds by views, aggregate views, category breakdown, trend. Joins `directory_presence_seeds.category`.
- `getClaimFunnelFromBehavior(seedId, daysBack)` — Layer 1 funnel approximation: views (from behavior) → claim token minted (from `directory_claim_tokens`) → claim accepted (`consumed_at`). Less precise than Layer 3 (no `claim_clicked` event) but available immediately.

**Layer 2 switch:** Once backfill (migration 211) runs, queries switch from the `tenants` join to `context->>'surface' = 'directory_seed'` filter. Service exposes a `useTaggedContext` flag (default: auto-detect by checking if any recent rows have `context->>'surface'` set).

---

## 7. API Routes

### Admin (added to `directory-presence-admin.ts`)

```
GET  /api/admin/directory-presence/traffic                    — cross-seed dashboard
GET  /api/admin/directory-presence/presence-seeds/:id/traffic — per-seed traffic
GET  /api/admin/directory-presence/presence-seeds/:id/engagement — per-seed Layer 3 events
GET  /api/admin/directory-presence/presence-seeds/:id/funnel  — claim funnel (Layer 3)
```

All require PLATFORM_ADMIN / PLATFORM_SUPPORT / PLATFORM_VIEWER (read-only, so VIEWER is allowed — matches the existing `requirePlatformStaff` gate in <ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\routes\directory-presence-admin.ts" lines="24-29" />).

### Public (added to `directory-presence-public.ts`)

```
POST /api/public/directory/places/:slug/events       — track single event (fire-and-forget)
POST /api/public/directory/places/:slug/events/batch — track batch (max 50)
```

Slug-gated: resolve slug → `directory_listings_list` row, reject if not found or not `is_published` or not `listing_origin='directory_seed'`. No auth. Rate-limited 60/min/IP. Always returns 200 (fire-and-forget — mirrors gallery at <ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\routes\marketing-ops-public.ts" lines="315-319" />).

### Route registry

No new registry entries needed — both `directory-presence-admin` and `directory-presence-public` are already mounted (<ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\routes\routeRegistry.ts" lines="2022-2035" />). New routes are added to the existing routers.

---

## 8. Frontend

### 8.1 Directory Traffic admin page (Layer 1 + 3)

`apps/web/src/app/(platform)/settings/admin/directory/traffic/page.tsx`

Dedicated page ranking all seeds by views. Sections:
- **Aggregate funnel** (Layer 3): views → claim clicks → claims accepted (all seeds, 30d)
- **Top seeds by views** table (30d views, 7d views, claim CTR, status badge)
- **Category breakdown** (views by `directory_presence_seeds.category`)
- **Trend chart** (daily views, last 30d, all seeds)
- Filters: seed batch, status, category, daysBack (7/30/90)
- Click a seed → drill to seed detail page (existing) which now has the Traffic & Engagement panel

### 8.2 Traffic & Engagement panel on seed detail (Layer 1 + 3)

`apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/[id]/page.tsx` — add panel below existing content:

- **Views card**: 30d views, 7d views, unique sessions, trend sparkline
- **Engagement card** (Layer 3): claim clicks, call clicks, directions clicks, QR scans
- **Claim funnel**: view → claim click → claim accepted (counts + percentages)
- **Recent events live feed** (Layer 3): last 20 events with type, device, time (mirrors gallery token activity feed)
- **Top referrers** (Layer 1): top 5 referrers with counts

### 8.3 StoreViewTracker enhancement (Layer 2)

`apps/web/src/components/tracking/StoreViewTracker.tsx` — add optional props:

```typescript
interface StoreViewTrackerProps {
  tenantId: string;
  storeName?: string;
  categories?: Array<{ id: string; slug: string; isPrimary?: boolean }>;
  listingOrigin?: string;   // 'directory_seed' | 'directory_claimed' | undefined
  surface?: string;         // 'directory_seed' | 'directory_claimed' | undefined
}
```

Thread `listingOrigin` + `surface` into `context`. Update `/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` to pass `listingOrigin="directory_seed" surface="directory_seed"` (it already has `listing.listingOrigin` available). Leave `/directory/[slug]` call site unchanged (or pass `surface="directory_claimed"`).

### 8.4 useDirectoryPresenceTracking hook (Layer 3)

`apps/web/src/app/place/[slug]/useDirectoryPresenceTracking.ts`

Mirrors `useGalleryTracking` (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\app\preview\[token]\useGalleryTracking.ts" />):

- Fires `listing_viewed` on mount
- Fires `session_heartbeat` with `dwell_ms` every 30s
- Fires `session_end` on unload (sendBeacon)
- Exposes `trackEvent` for CTA clicks: `claim_clicked`, `call_clicked`, `directions_clicked`, `qr_scanned`

Wire into `PlaceEntryEditorialLayout`:
- Claim CTA button → `trackEvent({ eventType: 'claim_clicked' })`
- Phone link → `trackEvent({ eventType: 'call_clicked' })`
- Directions link → `trackEvent({ eventType: 'directions_clicked' })`
- QR code → `trackEvent({ eventType: 'qr_scanned' })` on click/scan

### 8.5 Frontend services

`apps/web/src/services/DirectoryPresenceAdminService.ts` — add:
- `getTrafficDashboard(params)` → `GET /api/admin/directory-presence/traffic`
- `getSeedTraffic(seedId, params)` → `GET /api/admin/directory-presence/presence-seeds/:id/traffic`
- `getSeedEngagement(seedId, params)` → `GET /api/admin/directory-presence/presence-seeds/:id/engagement`
- `getSeedFunnel(seedId, params)` → `GET /api/admin/directory-presence/presence-seeds/:id/funnel`

New `apps/web/src/services/DirectoryPresencePublicService.ts` (extends `PublicApiSingleton`, `ttl: 0`):
- `trackEvent(slug, event)` → `POST /api/public/directory/places/:slug/events`
- `trackEventBatch(slug, events)` → `POST /api/public/directory/places/:slug/events/batch`

---

## 9. File Structure

```
apps/api/src/
  services/
    DirectoryPresenceAnalyticsService.ts    (Layer 3 — engagement events)
    DirectoryPresenceTrafficService.ts      (Layer 1+2 — readout from user_behavior_simple)
  routes/
    directory-presence-admin.ts             (extend — traffic/engagement/funnel GETs)
    directory-presence-public.ts            (extend — places/:slug/events POSTs)
  lib/
    id-generator.ts                         (add generateDirectoryPresenceEventId, prefix dpe-)

apps/web/src/
  app/(platform)/settings/admin/directory/
    traffic/page.tsx                        (NEW — Directory Traffic admin page)
    presence-seeds/[id]/page.tsx            (extend — Traffic & Engagement panel)
  app/place/[slug]/
    useDirectoryPresenceTracking.ts         (NEW — Layer 3 tracking hook)
    layouts/PlaceEntryEditorialLayout.tsx   (extend — wire CTA tracking)
  components/tracking/
    StoreViewTracker.tsx                    (extend — listingOrigin + surface props)
  services/
    DirectoryPresenceAdminService.ts        (extend — traffic/engagement/funnel methods)
    DirectoryPresencePublicService.ts       (NEW — public event tracking)

database/migrations/
  210_directory_presence_events.sql         (NEW — Layer 3 events table)
  211_backfill_directory_seed_event_context.sql (NEW — Layer 2 backfill)
```

---

## 10. Sprint Phases

| Phase | Task | Output |
|---|---|---|
| 1 | `DirectoryPresenceTrafficService` — readout queries from `user_behavior_simple` (Layer 1) | Backend service |
| 2 | Admin routes: `GET /traffic`, `GET /presence-seeds/:id/traffic` in `directory-presence-admin.ts` | Endpoints |
| 3 | `DirectoryPresenceAdminService` frontend methods + Directory Traffic admin page | UI (Layer 1 readout live) |
| 4 | Traffic & Engagement panel on seed detail page (views + referrers + device split) | UI |
| 5 | `StoreViewTracker` enhancement + `/place` layout passes `listingOrigin`/`surface` (Layer 2) | Tagged events |
| 6 | Migration 211 — backfill script tags historical rows | Backfill |
| 7 | Switch readout queries to `context->>'surface'` filter (auto-detect) | Layer 2 complete |
| 8 | Migration 210 — `directory_presence_events` table | Schema |
| 9 | `DirectoryPresenceAnalyticsService` — track + query (mirrors `GalleryAnalyticsService`) | Backend service |
| 10 | Public routes: `POST /places/:slug/events` + `/events/batch` in `directory-presence-public.ts` | Endpoints |
| 11 | `DirectoryPresencePublicService` + `useDirectoryPresenceTracking` hook | Frontend capture |
| 12 | Wire CTA tracking in `PlaceEntryEditorialLayout` (claim/call/directions/QR clicks) | Layer 3 capture live |
| 13 | Admin routes: `GET /presence-seeds/:id/engagement` + `GET /presence-seeds/:id/funnel` | Endpoints |
| 14 | Seed detail engagement panel + claim funnel + recent events feed | UI (Layer 3 live) |
| 15 | Directory Traffic page: aggregate claim funnel + top seeds by claim CTR | UI complete |
| 16 | `pnpm checkapi` + `pnpm checkweb` clean | Verification |

**Phases 1–4 ship Layer 1 (the core ask) in the first few days. Phases 5–7 ship Layer 2. Phases 8–15 ship Layer 3.**

---

## 11. Dependencies & Reuse

| Component | Reused from | Path |
|---|---|---|
| Gallery analytics pattern (track + rollup + dashboard) | `GalleryAnalyticsService` | `apps/api/src/services/GalleryAnalyticsService.ts` |
| Public event route pattern (slug-gated, rate-limited, fire-and-forget) | Gallery events route | `apps/api/src/routes/marketing-ops-public.ts` (lines 260–387) |
| Gallery tracking hook pattern | `useGalleryTracking` | `apps/web/src/app/preview/[token]/useGalleryTracking.ts` |
| Existing page-view capture | `StoreViewTracker` | `apps/web/src/components/tracking/StoreViewTracker.tsx` |
| Behavior table | `user_behavior_simple` | (existing) |
| Behavior tracking client | `trackBehaviorClient` | `apps/web/src/utils/behaviorTracking.ts` |
| Base service pattern | `BaseService` singleton | `apps/api/src/services/BaseService.ts` |
| IP hashing | `unifiedConfig.galleryIpHashSalt` | `apps/api/src/config/unifiedConfig.ts` |
| ID generation pattern | `generateGalleryEventId` | `apps/api/src/lib/id-generator.ts` |
| Public API singleton | `PublicApiSingleton` | `apps/web/src/providers/base/PublicApiSingleton.ts` |
| Admin page shell + breadcrumbs | existing presence-seeds page | `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/page.tsx` |
| Auth gate | `requirePlatformStaff` | `apps/api/src/routes/directory-presence-admin.ts` (lines 24–29) |
| Logger | `logger` | `apps/api/src/logger.ts` |

---

## 12. Testing

### Backend tests

`apps/api/src/services/__tests__/DirectoryPresenceAnalyticsService.test.ts`:
- `trackEvent` writes a row with correct fields
- `trackEvent` is fire-and-forget (never throws on DB error)
- `trackEvents` batch writes all rows
- `getListingAnalytics` aggregates views, unique sessions, claim clicks correctly
- `getDashboardAnalytics` returns top seeds by views + category breakdown
- `getClaimFunnel` joins `claim_clicked` events to `directory_claim_tokens.consumed_at`
- `getRecentEvents` returns last N events ordered by created_at desc
- Rate limiter rejects >60 events/min/IP

`apps/api/src/services/__tests__/DirectoryPresenceTrafficService.test.ts`:
- `getSeedTraffic` returns views, unique sessions, daily timeseries
- `getTrafficDashboard` returns top seeds by views + category breakdown
- Scoping: only seed tenants included (not claimed) — both join-based (Layer 1) and context-filter (Layer 2) paths
- `getClaimFunnelFromBehavior` returns view → minted → accepted counts

`apps/api/src/tests/directory-presence-routes.test.ts`:
- Admin traffic routes require auth (401 without, 403 non-platform)
- Public event route: 200 on valid slug, 404 on unknown slug, 404 on non-seed slug, 429 on rate limit
- Public event route: fire-and-forget (always 200 even on DB error)
- Batch route: max 50 events, rejects empty, rejects >50

### Frontend

No automated tests — manual verification:
- Directory Traffic page loads with seed data
- Seed detail Traffic & Engagement panel renders
- `StoreViewTracker` fires with `listing_origin` in context (verify via network tab)
- `useDirectoryPresenceTracking` fires `listing_viewed` on mount, `claim_clicked` on CTA click (verify via network tab)

---

## 13. Verification

After implementation:

```bash
pnpm checkapi
pnpm checkweb
```

Manual verification:
1. Visit `/place/<seed-slug>` → check `user_behavior_simple` row has `context->>'surface' = 'directory_seed'`
2. Visit `/settings/admin/directory/traffic` → see the seed in the top seeds table with views > 0
3. Click claim CTA on `/place/<seed-slug>` → check `directory_presence_events` row with `event_type='claim_clicked'`
4. Visit seed detail page → Traffic & Engagement panel shows the claim click in recent events
5. Visit Directory Traffic page → aggregate claim funnel shows view → click → accepted counts

---

## 14. Open Questions

1. **IP hash salt reuse.** Reuse `unifiedConfig.galleryIpHashSalt` or add a separate `directoryPresenceIpHashSalt`? Reuse is simpler; separate is cleaner. Recommend reuse for now.
2. **Aggregation rollup table.** Skip for this sprint (low volume, admin-only queries). Add `directory_presence_analytics` rollup in a follow-up if volume grows or if the Directory Traffic page becomes slow. The gallery has a rollup because SMS bursts spike traffic; seed pages are steady-state.
3. **Claim funnel attribution window.** When joining `claim_clicked` to `directory_claim_tokens.consumed_at`, should there be an attribution window (e.g., 7 days)? A shopper might view, click claim, then complete the claim flow days later. Recommend a 7-day window for the funnel, configurable in the query.
4. **Layer 2 backfill scope.** Should the backfill tag all historical rows, or only rows newer than 90 days? Tagging all is cheap (one UPDATE) and makes the full history filterable. Recommend all.
5. **Should `/directory/[slug]` (claimed tenants) also get Layer 3 engagement tracking?** This sprint scopes Layer 3 to `/place` (seeds) only. Claimed tenants already have storefront analytics. Extending Layer 3 to `/directory` is a follow-up if there's demand for claimed-listing engagement tracking.
6. **Qr_scanned event.** QR codes are images, not clickable elements. The `qr_scanned` event can only fire if the QR has a click handler (unusual) or via a tracking pixel redirect. Recommend deferring `qr_scanned` capture to a follow-up and keeping the event type in the schema for forward compatibility.
