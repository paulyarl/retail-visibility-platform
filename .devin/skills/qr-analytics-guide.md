---
description: Platform-wide QR code architecture, scan tracking, analytics aggregation, tier gating, and dashboard surfaces for both merchant and admin consumers
---

# QR Analytics & Scan Tracking Architecture Guide

## Overview

The platform supports QR code generation, scan tracking, and analytics across two consumer types:

1. **Merchant** — Tenant QR codes on storefront, product, and directory surfaces. Analytics available as a premium feature (`storefront_qr_analytics`).
2. **Admin** — Platform-generated QR codes for promos, private grants, and general purpose. Cross-tenant analytics visible to platform admins.

Use this skill when:
- Adding or modifying QR scan tracking surfaces
- Extending QR analytics dashboards (merchant or admin)
- Modifying the QR analytics aggregation pipeline
- Working with QR capability gating or merchant preferences
- Adding new QR surfaces or consumer types
- Debugging QR scan event flow or missing analytics data
- Extending Quick Links with QR-related entries

---

## Architecture

### Key Components

| Component | File | Role |
|-----------|------|------|
| Backend Service | `apps/api/src/services/QrAnalyticsService.ts` | Event tracking, aggregation, dashboard queries, admin analytics |
| Backend Routes | `apps/api/src/routes/qr-analytics.ts` | Merchant + public + admin API endpoints |
| Aggregation Job | `apps/api/src/jobs/qr-analytics-sync.ts` | Runs every 6h, aggregates `qr_scan_events` → `qr_analytics` |
| Capability Resolver | `apps/api/src/services/resolvers/StorefrontQrResolver.ts` | Tier + merchant pref gating for `can_use_qr_analytics` |
| Frontend Service | `apps/web/src/services/QrAnalyticsService.ts` | Singleton API client for merchant dashboard |
| Scan Tracking Hook | `apps/web/src/hooks/useQrScanTracking.ts` | Detects `source=qr` URL param, fires scan event |
| Merchant Dashboard | `apps/web/src/app/t/[tenantId]/settings/storefront-qr/analytics/` | Per-surface breakdown, time series, geo/device |
| Admin Dashboard | `apps/web/src/app/(platform)/settings/admin/qr-analytics/page.tsx` | Cross-tenant analytics, by-consumer/surface tables |
| QR Settings | `apps/web/src/app/t/[tenantId]/settings/storefront-qr/StorefrontQrSettingsClient.tsx` | Merchant toggle for `qr_analytics_enabled` |
| Quick Links Engine | `apps/api/src/services/QuickLinksService.ts` | Backend-driven tier-aware dashboard link for QR Analytics |
| Migration | `database/migrations/117_qr_analytics.sql` | Schema: enhanced `qr_scan_events` + `qr_analytics` table + feature seeding |

### Data Flow

```
Visitor scans QR code
  → Lands on public page with ?source=qr in URL
  → useQrScanTracking hook detects source=qr
  → Fires POST /api/public/qr-events { tenantId, surface, consumer, productId, userAgent, referrer }
  → QrAnalyticsService.trackQrScanEvent() inserts into qr_scan_events

Every 6 hours:
  → qr-analytics-sync.ts job iterates active tenants
  → aggregateQrAnalyticsForTenant() computes day/week/month aggregates
  → Upserts into qr_analytics table (per tenant, surface, consumer, period)

Merchant views dashboard:
  → GET /api/tenants/:tenantId/qr-analytics?period=day&daysBack=30
  → QrAnalyticsService.getQrAnalyticsDashboard() reads from qr_analytics
  → Returns per-surface summaries + totals

Admin views dashboard:
  → GET /api/admin/qr-analytics?daysBack=30&consumer=merchant
  → QrAnalyticsService.getAdminQrAnalytics() reads cross-tenant
  → Returns totals, by-consumer, by-surface, recent scans
```

---

## Database Schema

### `qr_scan_events` (enhanced in migration 117)

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | `qrse-{tk}-{nanoid}` |
| `tenant_id` | VARCHAR(255) | Tenant the scan is attributed to |
| `surface` | VARCHAR(30) | `storefront`, `product`, `directory`, `qr_landing`, `promo`, `private_grant`, `general` |
| `consumer` | VARCHAR(20) | `merchant` or `admin` |
| `product_id` | VARCHAR(255) | Nullable, for product-specific scans |
| `session_id` | VARCHAR(255) | For funnel/unique visitor tracking |
| `source` | VARCHAR(100) | How the scan was triggered (e.g. `qr`) |
| `referrer` | TEXT | HTTP referrer |
| `user_agent` | TEXT | Browser user agent (parsed into device_type) |
| `geo_country` | VARCHAR(10) | Derived from IP |
| `geo_city` | VARCHAR(100) | Derived from IP |
| `device_type` | VARCHAR(20) | `mobile`, `desktop`, `tablet`, `unknown` |
| `created_at` | TIMESTAMPTZ | Event timestamp |

**RLS**: Public INSERT allowed (anonymous storefront visitors). Tenant SELECT for own rows. Admin SELECT all.

### `qr_analytics` (new in migration 117)

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | `qra-{tk}-{nanoid}` |
| `tenant_id` | VARCHAR(255) | Tenant |
| `surface` | VARCHAR(30) | Same surfaces as qr_scan_events |
| `consumer` | VARCHAR(20) | `merchant` or `admin` |
| `period_start` | DATE | Period start date |
| `period_end` | DATE | Period end date |
| `period_type` | VARCHAR(10) | `day`, `week`, `month` |
| `total_scans` | INT | Total scan count |
| `unique_visitors` | INT | Distinct session_id count |
| `unique_surfaces` | INT | Distinct product_id count (for product surface) |
| `conversion_count` | INT | Scans that led to a visit/action |
| `revenue_cents` | BIGINT | Attributed revenue |
| `conversion_rate` | DECIMAL(8,4) | conversions / total_scans |
| `avg_revenue_per_scan` | BIGINT | revenue / total_scans |
| `top_country` | VARCHAR(10) | Most common geo country |
| `top_city` | VARCHAR(100) | Most common geo city |
| `mobile_scans` | INT | Mobile device count |
| `desktop_scans` | INT | Desktop device count |
| `tablet_scans` | INT | Tablet device count |

**Unique constraint**: `(tenant_id, surface, consumer, period_start, period_type)` — upsert on aggregation.

**RLS**: Tenant SELECT own rows. Admin SELECT all. Service role full access (for aggregation job).

---

## Capability Gating

### Three-Tier Gating Model

QR Analytics follows the standard three-tier gating pattern:

```
Tier level (storefront_qr_analytics feature key)
  → Determines if the tenant's plan includes QR analytics
  → Seeded for: professional, ecommerce, omnichannel, enterprise, organization,
    chain_professional, chain_enterprise tiers
  → BSaaS purchasable for lower tiers via Feature Store

Merchant preference (qr_analytics_enabled in tenant_storefront_qr_settings)
  → Merchant must explicitly enable analytics in QR settings
  → Defaults to false
  → Toggle in StorefrontQrSettingsClient.tsx

Effective capability (can_use_qr_analytics in resolver output)
  → = tierEnabled AND merchantPrefEnabled
  → Exposed via effective.storefront_qr.can_use_qr_analytics
```

### Resolver Logic (`StorefrontQrResolver.ts`)

```typescript
// Tier gate
const qrAnalyticsTierEnabled = flexible || !!features.storefront_qr_analytics;
const qrAnalyticsEnabled = mainOn && qrAnalyticsTierEnabled;

// Merchant pref gate
can_use_qr_analytics: qrAnalyticsEnabled && (merchantPrefs?.qr_analytics_enabled === true)
```

**Key rule (R33)**: `qr_analytics_enabled` (tier-level field) is derived from features only. `can_use_qr_analytics` (effective field) combines tier + merchant pref. Merchant preferences never gate tier-level fields.

### Frontend Mapping

```
Backend: effective.storefront_qr.can_use_qr_analytics
  → UnifiedCapabilityService.mapStorefrontQr() → StorefrontQrState.canUseQrAnalytics
  → Used by: StorefrontQrSettingsClient (toggle visibility), QuickLinksService (link condition)
```

### Where Gating Is Enforced

| Surface | How | File |
|---------|-----|------|
| Merchant dashboard page | `capabilityKey: 'storefrontQr'` in UnifiedSettings | `TenantSettings.tsx` |
| Quick Links (dashboard) | `condition: ctx.capabilities?.effective.storefront_qr.can_use_qr_analytics` | `QuickLinksService.ts` |
| QR settings toggle | `useStorefrontQrCapability` hook checks `canUseQrAnalytics` | `StorefrontQrSettingsClient.tsx` |
| Admin dashboard | No gating — admin always sees | `page.tsx` |
| `CAPABILITY_KEY_TO_GATE_KEY` | `storefrontQr: 'storefront_qr'` | `UnifiedSettings.tsx` |

---

## Scan Tracking

### `useQrScanTracking` Hook

Located at `apps/web/src/hooks/useQrScanTracking.ts`.

```typescript
useQrScanTracking(tenantId, surface, { productId?, enabled? })
```

- Detects `source=qr` URL parameter on page load
- Fires once per page load (uses `useRef` guard)
- Calls `QrAnalyticsService.trackScanEvent()` (fire-and-forget)
- Passes `consumer: 'merchant'`, `source: 'qr'`, `referrer`, `userAgent`

### Tracking Surfaces

| Surface | Component | File |
|---------|-----------|------|
| Storefront | `StorefrontClientWrapper` | `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` |
| Product (showcase) | `ProductShowcaseLayout` | `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` |
| Product (quick commerce) | `ProductQuickCommerceLayout` | `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` |
| Directory (classic) | `DirectoryEntryClassicLayout` | `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryClassicLayout.tsx` |
| Directory (editorial) | `DirectoryEntryEditorialLayout` | `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryEditorialLayout.tsx` |
| Directory (immersive) | `DirectoryEntryImmersiveLayout` | `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryImmersiveLayout.tsx` |
| Directory (premium) | `DirectoryEntryPremiumLayout` | `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryPremiumLayout.tsx` |

### QR Code URL Generation

QR codes generated by `TenantQRCode.tsx` and `StyledTenantQR.tsx` append `?source=qr` to the target URL. This parameter is what `useQrScanTracking` detects on the landing page.

---

## API Endpoints

### Merchant (auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenants/:tenantId/qr-analytics` | Dashboard summary (period, daysBack params) |
| GET | `/api/tenants/:tenantId/qr-analytics/timeseries` | Per-surface time series (surface, period, daysBack params) |
| POST | `/api/tenants/:tenantId/qr-analytics/aggregate` | Manual aggregation trigger |

### Public (no auth — storefront QR tracking)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/public/qr-events` | Track a single QR scan event |
| POST | `/api/public/qr-events/batch` | Batch track QR scan events |

### Admin (auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/qr-analytics` | Cross-tenant analytics (consumer, surface, tenantId, daysBack filters) |

---

## Aggregation Job

File: `apps/api/src/jobs/qr-analytics-sync.ts`

- **Interval**: Every 6 hours (`6 * 60 * 60 * 1000` ms)
- **Startup delay**: 12 minutes (staggered after badge analytics sync)
- **Flow**: Fetch all active tenants → For each, call `aggregateQrAnalyticsForTenant()` for day/week/month periods
- **Aggregation**: Reads from `qr_scan_events`, computes metrics, upserts into `qr_analytics` using `ON CONFLICT (tenant_id, surface, consumer, period_start, period_type) DO UPDATE`
- **Wired into**: `apps/api/src/index.ts` at server startup

---

## Dashboard Pages

### Merchant Dashboard (`/t/[tenantId]/settings/storefront-qr/analytics`)

- **Page**: `apps/web/src/app/t/[tenantId]/settings/storefront-qr/analytics/page.tsx`
- **Client**: `apps/web/src/app/t/[tenantId]/settings/storefront-qr/analytics/QrAnalyticsClient.tsx`
- **Features**:
  - Summary cards: total scans, unique visitors, conversion rate, revenue
  - Per-surface breakdown table (storefront, product, directory)
  - Time-series chart with period selector (day/week/month)
  - Geographic breakdown (top country/city)
  - Device breakdown (mobile/desktop/tablet)
  - Manual refresh button (triggers aggregation)

### Admin Dashboard (`/settings/admin/qr-analytics`)

- **Page**: `apps/web/src/app/(platform)/settings/admin/qr-analytics/page.tsx`
- **Features**:
  - Cross-tenant summary stats (total scans, unique visitors, tenant count)
  - By-consumer breakdown table (merchant vs admin)
  - By-surface breakdown table
  - Recent scans table with tenant, surface, device, geo
  - Filters: consumer type, surface, tenant ID, date range

---

## Navigation & Quick Links

### Navigation Links

| Location | File | Link |
|----------|------|------|
| Tenant sidebar | `DynamicTenantSidebar.tsx` | QR Analytics under QR Codes (Directory & Storefront section) |
| Admin sidebar | `AdminNavContent.tsx` | QR Analytics under Content & Analytics |
| Admin sidebar | `SidebarLayout.tsx` | QR Analytics under Analytics |
| Admin sidebar | `ResponsiveSidebarLayout.tsx` | QR Analytics under Analytics |

### Quick Links (Tenant Dashboard)

The QR Analytics link in Quick Links is **backend-driven** via `QuickLinksService.ts`:

```typescript
{
  id: 'qr-analytics',
  label: () => 'QR Analytics',
  description: () => 'Track QR code scan performance',
  href: (ctx) => `/t/${ctx.tenantId}/settings/storefront-qr/analytics`,
  icon: 'BarChart3',
  category: 'visibility',
  condition: (ctx) => {
    const qr = ctx.capabilities?.effective.storefront_qr;
    return !!qr && qr.can_use_qr_analytics;
  },
  score: () => 48,
}
```

The `QuickLinksCard.tsx` component renders links from the backend response. The `BarChart3` icon is mapped in the `ICONS` record.

### Settings Cards

| Page | File | Card |
|------|------|------|
| Admin settings landing | `apps/web/src/app/(platform)/settings/admin/page.tsx` | QR Analytics card in Platform Configuration group |
| Tenant settings landing | `apps/web/src/components/settings/TenantSettings.tsx` | QR Analytics card in Store Settings group (after QR Codes) |

Both cards use `capabilityKey: 'storefrontQr'` for tier gating in `UnifiedSettings.tsx`.

---

## ID Generators

Defined in `apps/api/src/lib/id-generator.ts`:

- `generateQrAnalyticsId(tenantId)` → `qra-{tk}-{nanoid}` (aggregation rows)
- `generateQrScanEventId(tenantId)` → `qrse-{tk}-{nanoid}` (scan events)

Both use tenant-scoped ID generation per the `tenant-scoped-id-generation.md` skill.

---

## Frontend Service

`apps/web/src/services/QrAnalyticsService.ts` extends `TenantApiSingleton`:

| Method | Description |
|--------|-------------|
| `getDashboard(tenantId, period, daysBack)` | Fetches dashboard summary + per-surface breakdown |
| `getTimeSeries(tenantId, surface, period, daysBack)` | Fetches time series for a specific surface |
| `triggerAggregation(tenantId, period)` | Manually triggers aggregation |
| `trackScanEvent(event)` | Fire-and-forget scan event tracking (public endpoint) |
| `formatCurrency(cents)` | Formats cents as dollar string |
| `formatPercent(value)` | Formats decimal as percentage string |
| `formatNumber(value)` | Formats number with commas |

---

## Extending the System

### Adding a New QR Surface

1. Add the surface type to `QrSurfaceType` in both backend and frontend `QrAnalyticsService.ts`
2. Add `useQrScanTracking` hook call in the new page component with the new surface type
3. Ensure QR codes for the new surface append `?source=qr` to their target URL
4. The aggregation job and dashboard will automatically pick up the new surface

### Adding a New Consumer Type

1. Add to `QrConsumerType` in both services
2. Update admin dashboard filters if needed
3. Ensure scan events are fired with the correct consumer type

### Modifying Aggregation Periods

1. Update `PeriodType` in both services
2. Update the aggregation job to compute the new period
3. Update dashboard period selectors

---

## Related Skills

- `capability-deployment-flow.md` — 8-phase capability deployment checklist
- `add-capability-feature.md` — Adding new feature keys to existing capability types
- `add-bsaas-feature.md` — Making features purchasable à la carte
- `three-tier-feature-gating.md` — Tier + merchant pref + effective flag pattern
- `capability-data-flow-rules.md` — R33: merchant prefs never gate tier-level fields
- `tenant-scoped-id-generation.md` — Tenant-scoped ID patterns
- `google-integration-and-demo-qr.md` — Demo tenant QR code generation
- `badge-architecture-insights.md` — Badge analytics (mirrored pattern)
