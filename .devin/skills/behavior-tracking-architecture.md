---
description: Platform behavior tracking system architecture — how frontend tracking services, backend routes, and identity extraction align for both authenticated and anonymous users
---

# Behavior Tracking Architecture

## Problem

The platform has multiple frontend services that track user behavior (page views, product views, add-to-cart, sessions). Without alignment, these services can:
- Call non-existent backend endpoints (404s)
- Require authentication for anonymous storefront visitors (401s)
- Duplicate tracking data across overlapping services
- Send body shapes the backend doesn't expect

## Architecture Overview

```
Frontend Services (3 scopes)
├── BehaviorTrackingService.ts       — ApiSystemSingleton, storefront event tracking
├── AdvancedAnalyticsService.ts      — ApiSystemSingleton, queued analytics events + read queries
├── behaviorTracking.ts (utility)    — ApiSystemSingleton, server-side tracking helper
│
    All use makeEnhancedDefaultRequest with relative paths (no /api prefix)
    Next.js rewrites proxy /api/:path* → backend /api/:path*
│
Backend
├── /api/behavior (NO authenticateToken — anonymous tracking supported)
│   ├── POST   /events              — single event
│   ├── POST   /events/batch        — batch events
│   ├── POST   /sessions            — save session data
│   ├── GET    /analytics           — aggregate analytics (hours param)
│   ├── GET    /patterns/:userId    — user behavior patterns (days param)
│   ├── GET    /session/:sessionId  — retrieve session
│   ├── POST   /session/:sessionId/end — end session
│   ├── PUT    /config              — update tracking config
│   ├── GET    /config              — get tracking config
│   └── GET    /metrics             — real-time metrics (hours param)
│
└── extractTrackingIdentity() — handles both authenticated + anonymous
    ├── Checks req.user (from auth middleware)
    ├── Checks Auth0 session cookie
    ├── Checks x-user-id header
    └── Falls back to anonymous sessionId (generated)
```

## Key Design Decisions

### 1. No `authenticateToken` on `/api/behavior` mount

The behavior tracking routes are mounted **without** `authenticateToken`:
```ts
app.use('/api/behavior', behaviorTrackingRoutes);
```

**Rationale:** Storefront visitors are anonymous. The backend's `extractTrackingIdentity()` (in `apps/api/src/utils/auth0Identity.ts`) already handles both states:
- Authenticated users: extracts userId from Auth0 session
- Anonymous users: generates a session ID, sets `isAuthenticated: false`

Adding `authenticateToken` would block all anonymous tracking with 401s.

### 2. All tracking services extend `ApiSystemSingleton`

Both `BehaviorTrackingService` and `AdvancedAnalyticsService` extend `ApiSystemSingleton`, not `PublicApiSingleton`.

**Rationale:** These are background services with no direct UI engagement. They queue and flush events asynchronously. `ApiSystemSingleton` provides:
- `RequestType.SYSTEM` (not PUBLIC) — appropriate for background telemetry
- `makeEnhancedDefaultRequest` — context-aware caching with system defaults
- No credential requirements — works for anonymous users

### 3. Relative paths without `/api` prefix

Services call `makeEnhancedDefaultRequest('/behavior/events', ...)` — **no `/api` prefix**. The `FlexibleApiSingleton` base class resolves URLs using `process.env.NEXT_PUBLIC_API_BASE_URL` (which is just the host, e.g. `https://api.visibleshelf.com`). Next.js rewrites then proxy `/api/:path*` → backend `/api/:path*`.

**Exception:** `behaviorTracking.ts` utility uses `makeSystemRequest('/api/behavior/events', ...)` with the full `/api` prefix because it uses a different request method signature.

### 4. Server-side identity, not client-provided

Frontend `TrackingEvent` interface intentionally omits `userId`:
```ts
export interface TrackingEvent {
  type: string;
  action: string;
  data?: Record<string, any>;
  timestamp: string;
  // userId removed - server determines from Auth0 session
  sessionId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}
```

The backend `extractTrackingIdentity()` overrides any client-provided userId with the server-determined value. This prevents spoofing.

## Frontend Service Alignment Map

| Service | Base Class | Method | Path | Backend Route |
|---|---|---|---|---|
| `BehaviorTrackingService` | `ApiSystemSingleton` | `sendEvent` | `POST /behavior/events` | ✅ |
| `BehaviorTrackingService` | `ApiSystemSingleton` | `sendBatch` | `POST /behavior/events/batch` | ✅ |
| `BehaviorTrackingService` | `ApiSystemSingleton` | `sendSession` | `POST /behavior/sessions` | ✅ |
| `BehaviorTrackingService` | `ApiSystemSingleton` | `getBehaviorAnalytics` | `GET /behavior/analytics?hours=N` | ✅ |
| `BehaviorTrackingService` | `ApiSystemSingleton` | `getUserBehaviorPatterns` | `GET /behavior/patterns/:userId?days=N` | ✅ |
| `AdvancedAnalyticsService` | `ApiSystemSingleton` | `flushEventQueue` | `POST /behavior/events/batch` | ✅ |
| `AdvancedAnalyticsService` | `ApiSystemSingleton` | `getRealTimeMetrics` | `GET /behavior/metrics?hours=N` | ✅ |
| `AdvancedAnalyticsService` | `ApiSystemSingleton` | `getProductPerformance` | `GET /behavior/analytics?hours=N` | ✅ |
| `AdvancedAnalyticsService` | `ApiSystemSingleton` | `getUserBehavior` | `GET /behavior/patterns/:userId?days=N` | ✅ |
| `behaviorTracking.ts` | `ApiSystemSingleton` | `trackEvent` | `POST /api/behavior/events` | ✅ |
| `behaviorTracking.ts` | `ApiSystemSingleton` | `trackRecommendation` | `POST /api/recommendations/track` | ✅ (separate route) |

## Backend Route Reference

All routes in `apps/api/src/routes/behavior-tracking.ts`, mounted at `/api/behavior` (no auth middleware).

### POST `/events`
- Body: `{ eventType, eventData, url, referrer, tenantId, metadata, priority }`
- Server adds: `userId`, `sessionId`, `isAuthenticated`, `userAgent`
- Returns: `{ success, data: { event, identity }, message }`

### POST `/events/batch`
- Body: `{ events: [...] }` (same shape as single event, per item)
- Server enriches all events with same identity
- Returns: `{ success, data: { processed, identity }, message }`

### POST `/sessions`
- Body: `{ id, tenantId, startTime, endTime?, duration?, events, metadata }`
- Server adds: `userId`, `sessionId`, `isAuthenticated`
- Returns: `{ success, data: { session, identity }, message }`

### GET `/analytics?hours=24`
- Returns: `{ success, data: { analytics, timeRange, timestamp } }`

### GET `/patterns/:userId?days=30`
- Returns: `{ success, data: { userId, patterns, days, timestamp } }`

### GET `/metrics?hours=24`
- Returns: `{ success, metrics: { totalEvents, uniqueUsers, uniqueSessions, ... } }`

### GET `/session/:sessionId`
- Returns: `{ success, data: { session, timestamp } }`

### POST `/session/:sessionId/end`
- Ends session, calculates duration + bounce rate
- Returns: `{ success, data: { sessionId, timestamp } }`

## Separate Tracking Systems (NOT on /api/behavior)

| System | Service | Endpoints | Auth |
|---|---|---|---|
| Security alerts | `SecurityAlertTrackingService.ts` | `/api/security/alerts`, `/api/security/telemetry/:type` | `authenticateToken` |
| Security telemetry (test) | `test-telemetry-client.ts` | `/api/security/telemetry/batch` | `authenticateToken` |
| Recommendations | `RecommendationsSingletonService` | `/api/recommendations/track` | varies |
| Subdomain stats | `AnalyticsService`, `AdminAnalyticsService`, etc. | `/api/analytics/subdomain-stats` | varies |

**Do NOT confuse `/api/analytics/*` with behavior tracking.** The `/api/analytics` router only contains `subdomain-usage` and `subdomain-stats`. All behavior tracking goes through `/api/behavior/*`.

## Common Pitfalls

### 1. Calling `/api/analytics/events` (404)
This endpoint does not exist. The `/api/analytics` router only has `subdomain-usage` and `subdomain-stats`. Behavior events must go to `/api/behavior/events` or `/api/behavior/events/batch`.

### 2. Adding `authenticateToken` to `/api/behavior`
This blocks anonymous storefront visitors from tracking. The `extractTrackingIdentity()` utility is specifically designed to handle anonymous users — don't gate it behind auth.

### 3. Using `PublicApiSingleton` for tracking services
`PublicApiSingleton` sets `RequestType.PUBLIC` and `AppContext.PUBLIC`. Tracking services should use `ApiSystemSingleton` (`RequestType.SYSTEM`) since they are background services, not public data fetchers.

### 4. Sending `userId` from the client
The frontend `TrackingEvent` interface intentionally omits `userId`. The backend overrides any client-provided userId via `extractTrackingIdentity()`. Sending it is harmless but misleading — it will be replaced.

### 5. Missing `url` field in event body
The backend reads `req.body.url` for page view tracking. If the frontend doesn't send it, the event is tracked without URL context, breaking `topPages` analytics.

## Key Files

| File | Role |
|---|---|
| `apps/api/src/index.ts` | Mounts `/api/behavior` (no auth) |
| `apps/api/src/routes/behavior-tracking.ts` | All behavior tracking routes |
| `apps/api/src/services/BehaviorTrackingService.ts` | Backend service (event queue, session mgmt, analytics) |
| `apps/api/src/utils/auth0Identity.ts` | `extractTrackingIdentity()` — anonymous + authenticated |
| `apps/web/src/services/BehaviorTrackingService.ts` | Frontend behavior tracking service |
| `apps/web/src/services/AdvancedAnalyticsService.ts` | Frontend advanced analytics service |
| `apps/web/src/utils/behaviorTracking.ts` | Server-side tracking utility |
| `apps/web/src/providers/platform/BehaviorTrackingSingleton.tsx` | React provider that orchestrates tracking |
