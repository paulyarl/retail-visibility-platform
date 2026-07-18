# QR Analytics Sprint Plan

## Overview

Premium offering that lets merchants track QR code interactions across public surfaces (storefront, product, directory). Shared architecture also supports admin consumers (promos, private grants, general purpose QR tracking).

## Architecture

### Shared Event Table

Enhance the existing `qr_scan_events` table to support multiple consumers and surfaces:

- **Surfaces**: `storefront`, `product`, `directory`, `qr_landing`, `promo`, `private_grant`, `general`
- **Consumer**: `merchant` (tenant QR codes), `admin` (platform-generated QR codes for promos/grants)
- **Product ID**: nullable, for product-specific QR scans
- **Session ID**: for funnel tracking
- **Geo**: country/city derived from IP (optional)
- **Device**: parsed from user_agent

### Aggregation Table (`qr_analytics`)

Mirrors `badge_analytics` pattern:
- Per tenant, per surface, per period (day/week/month)
- `total_scans`, `unique_visitors`, `conversion_count`, `revenue_cents`
- Aggregation job runs every 6 hours

### Capability Gating

- Feature key: `storefront_qr_analytics` under existing `storefront_qr` capability type
- Tier-bundled: `professional`+ (included in plan)
- BSaaS purchasable: lower tiers can buy à la carte
- Merchant gate: `qr_analytics_enabled` pref in `tenant_storefront_qr_settings`

### Admin Shared Analytics

Admin endpoints serve cross-tenant analytics for platform-generated QR codes:
- Promo QR scan tracking (BSaaS promotions)
- Private grant QR scan tracking (feature grant tokens)
- General purpose QR tracking

## Sprint 1: Backend Foundation

### Migration 117

1. Alter `qr_scan_events` table: add `surface`, `consumer`, `product_id`, `session_id`, `geo_country`, `geo_city`, `device_type` columns
2. Create `qr_analytics` aggregation table (mirrors `badge_analytics`)
3. Seed `storefront_qr_analytics` feature key into `features_list` + `capability_features_list`
4. Enable for `professional`, `ecommerce`, `omnichannel`, `enterprise`, `organization` tiers
5. Add `qr_analytics_enabled` column to `tenant_storefront_qr_settings`
6. RLS policies for both tables

### ID Generators

- `generateQrAnalyticsId(tenantId)` → `qra-{tk}-{nanoid}`
- `generateQrScanEventId(tenantId)` → `qrse-{tk}-{nanoid}`

### QrAnalyticsService.ts

Mirrors `BadgeAnalyticsService`:
- `trackQrScanEvent(input)` — insert into `qr_scan_events`
- `trackQrScanEvents(events)` — batch insert
- `aggregateQrAnalyticsForTenant(tenantId, period)` — aggregate into `qr_analytics`
- `getQrAnalyticsDashboard(tenantId, period, daysBack)` — summary cards + per-surface breakdown
- `getQrTimeSeries(tenantId, surface, period, daysBack)` — time-series chart data
- `getAdminQrAnalytics(filters)` — cross-tenant admin analytics (by consumer type)

### Routes (`qr-analytics.ts`)

**Merchant (auth required)**:
- `GET /api/tenants/:tenantId/qr-analytics` — dashboard summary
- `GET /api/tenants/:tenantId/qr-analytics/timeseries` — per-surface time series
- `POST /api/tenants/:tenantId/qr-analytics/aggregate` — manual trigger

**Public (no auth — storefront QR tracking)**:
- `POST /api/public/qr-events` — track a QR scan event
- `POST /api/public/qr-events/batch` — batch track

**Admin (auth required)**:
- `GET /api/admin/qr-analytics` — cross-tenant analytics with filters (consumer, surface, tenantId)

### Aggregation Job (`qr-analytics-sync.ts`)

Runs every 6 hours, aggregates `qr_scan_events` into `qr_analytics` for all active tenants across day/week/month periods. Mirrors `badge-analytics-sync.ts`.

### Prisma Schema

After migration is applied, run `npx prisma db pull && npx prisma generate` to introspect new columns and tables.

## Sprint 2: Frontend

### Frontend Service (`QrAnalyticsService.ts`)

Extends `TenantApiSingleton`:
- `getDashboard(period, daysBack)`
- `getTimeSeries(surface, period, daysBack)`
- `triggerAggregation()`
- Helper methods: `formatCurrency`, `formatPercent`, `formatNumber`

### Merchant Analytics Dashboard

Page at `/t/[tenantId]/settings/storefront-qr/analytics`:
- Summary cards: total scans, unique visitors, conversion rate, revenue attributed
- Per-surface breakdown (storefront QR vs product QR vs directory QR)
- Time-series chart with period selector (day/week/month)
- Recent scans table with surface/device/geo
- Tier-gated: locked state for merchants without the feature

### Admin Analytics Dashboard

Admin page at `/settings/admin/qr-analytics`:
- Cross-tenant QR analytics
- Filter by consumer type (merchant, promo, private_grant, general)
- Filter by surface, tenant, date range
- Summary stats + recent scans table

### TenantQRCode Tracking Integration

Update `TenantQRCode.tsx` to fire QR scan events:
- On QR code render (impression event)
- On QR code click (interaction event)
- Includes surface type, tenant ID, product ID (when applicable)

### Navigation & Settings

- Sidebar link under Storefront QR settings
- Settings card in TenantSettings.tsx
- PlanSummaryPanel + PlanSummaryWidget + CapabilityShowcase entries

### Capability Deployment (8-Phase Checklist)

1. **Define**: `storefront_qr_analytics` feature key
2. **Seed DB**: `features_list` + `capability_features_list` + `tier_features_list`
3. **Store Prefs**: `qr_analytics_enabled` column in `tenant_storefront_qr_settings`
4. **Resolve**: Update `StorefrontQrResolver.ts` to include `qr_analytics_enabled` field
5. **Route**: `qr-analytics.ts` routes (merchant + public + admin)
6. **Map**: `UnifiedCapabilityService.ts` + `CapabilityResolutionService.ts`
7. **Display**: Dashboard, PlanSummary, CapabilityShowcase, settings page
8. **Verify**: `pnpm checkapi` + `pnpm checkweb`

## Pre-Flight Summary

```
Phase/Sprint: QR Analytics Sprint 1 (Backend)
Design doc: docs/QR_ANALYTICS_SPRINT_PLAN.md

New services: QrAnalyticsService.ts (backend), QrAnalyticsService.ts (frontend)
New entities: qr_analytics (aggregate table), enhanced qr_scan_events
New ID generators needed: generateQrAnalyticsId, generateQrScanEventId
New pages/routes: /t/[tenantId]/settings/storefront-qr/analytics, /settings/admin/qr-analytics
New sidebar links: QR Analytics (under Storefront QR)
New settings cards: QR Analytics card in Storefront group
New migration: 117_qr_analytics.sql
New background jobs: qr-analytics-sync.ts (every 6 hours)
New capability features: storefront_qr_analytics
Skills to read before starting: capability-deployment-flow.md, add-capability-feature.md, add-bsaas-feature.md, start-of-phase-sprint-checklist.md, tier-hierarchy.md
Skills to update after completion: capability-deployment-flow.md (QR analytics pattern), add-capability-feature.md (new feature key)
```
