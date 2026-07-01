---
description: Architecture for Google integration dashboards (tabbed layout, per-product sync status) and demo tenant QR code generation with scan analytics tracking, including organizational scaling via hero tenant capability resolution and demo organizations
---

# Google Integration Dashboard & Demo Tenant QR Architecture

## Overview

This skill documents two related systems built in Sprint 4 and Sprint 3.2:

1. **Google Integration Dashboard** — A unified tabbed dashboard replacing 6 scattered pages under `/settings/integrations/google/`, with per-product GMC sync status, GBP business profile tracking, and fulfillment settings.
2. **Demo Tenant QR Code Generation** — QR code generation from the admin demo tenant panel, a public QR landing page with scan tracking, and scan analytics for measuring demo engagement.

Use this skill when:
- Adding or modifying Google integration UI surfaces
- Extending GMC sync status or GBP sync tracking
- Adding QR code generation for tenants
- Extending QR scan analytics or the QR landing page
- Working with the demo tenant admin panel
- Scaling Google integration or QR features to the organization level
- Creating demo organizations with multiple child locations
- Resolving org-level capabilities via the hero tenant pattern

---

## Part 1: Google Integration Dashboard

### 1.1 Architecture

The dashboard uses a **container + tab component** pattern. The main page is a client component that fetches shared state (GMC/GBP connection status, setup progress) and passes it as props to four tab components. Each tab fetches its own domain-specific data independently.

```
page.tsx (container)
├── tabs/OverviewTab.tsx       — summary cards, setup steps, quick actions
├── tabs/ProductsTab.tsx       — per-product sync table, filters, bulk actions
├── tabs/BusinessProfileTab.tsx — GBP location info, sync tracking per field
└── tabs/SettingsTab.tsx       — fulfillment mode, merchant link, subdomain
```

**Key files:**
- `apps/web/src/app/t/[tenantId]/settings/integrations/google/page.tsx` — container
- `apps/web/src/app/t/[tenantId]/settings/integrations/google/tabs/*.tsx` — tab components
- `apps/web/src/services/PlatformHomeSingletonService.ts` — shared service for Google API calls
- `apps/web/src/services/GoogleIntegrationService.ts` — OAuth URL generation
- `apps/web/src/services/GMCValidationService.ts` — GMC product validation reports
- `apps/api/src/routes/google-merchant-oauth.ts` — backend API including per-product sync status endpoint

### 1.2 Tab Pattern

Each tab is a self-contained client component that receives shared state as props:

```typescript
interface ProductsTabProps {
  tenantId: string;
  gmcConnected: boolean;
  hasMerchantLink: boolean;
  onSyncAll: () => void;
  syncing: boolean;
  syncResult: any;
}
```

The container page manages:
- Active tab state (`TabId = 'overview' | 'products' | 'business-profile' | 'settings'`)
- GMC/GBP connection status (fetched once, shared with all tabs)
- Setup status (progress steps)
- Sync trigger and result

Each tab manages its own:
- Data fetching (products, GBP location, sync tracking, settings)
- Loading/error states
- Filtering and pagination
- Auto-refresh intervals

### 1.3 Per-Product Sync Status

**API endpoint:** `GET /google/merchant/product-sync-status`
- Query params: `tenantId` (required), `status` (all/success/pending/error), `search`, `limit`, `offset`
- Returns: `{ products: ProductSyncItem[], total, summary: { synced, pending, error } }`

**Frontend service method** on `PlatformHomeSingletonService`:
```typescript
async getGMCProductSyncStatus(tenantId: string, options?: {
  status?: string; search?: string; limit?: number; offset?: number;
}): Promise<any>
```

**ProductsTab features:**
- Status filter (all/success/pending/error) with badge counts
- Search by product name or SKU
- Bulk selection with retry/sync actions
- Auto-refresh every 30 seconds during active sync (toggled on sync trigger, off on completion)
- GMC validation report integration (per-product error/warning counts)

### 1.4 GBP Sync Tracking

**API endpoint:** `GET /google/business/sync-tracking?tenantId=X`
- Returns per-field sync status: `{ syncedCount, pendingCount, failedCount, fields: [...] }`

**Frontend service method** on `PlatformHomeSingletonService`:
```typescript
async getGoogleBusinessSyncTracking(tenantId: string): Promise<any>
```

The `BusinessProfileTab` displays:
- Linked GBP location info (name, address, phone, website, categories)
- Sync summary by category (synced/pending/failed counts)
- Sync business info button (calls `syncGoogleBusiness`)
- Quick links to hours, categories, and advanced GBP features

### 1.5 Service Method Naming Convention

Google integration methods on `PlatformHomeSingletonService` follow the pattern:
- `getGoogle*` — fetch Google-related data (e.g., `getGoogleFeedJobsSetupStatus`, `getGoogleGBPStatus`, `getGoogleBusinessSyncTracking`)
- `syncGoogle*` — trigger sync operations (e.g., `syncGoogleBusiness`)
- `disconnectGoogle*` — disconnect OAuth (e.g., `disconnectGoogleOAuth`, `disconnectGoogleGBP`)

All methods use `makeDefaultRequest` with cache keys prefixed `platform-google-*` and `platform-gmc-*`.

### 1.6 Adding a New Tab

1. Create `tabs/NewTab.tsx` as a client component with props for shared state
2. Add the tab ID to the `TabId` union type in `page.tsx`
3. Add a tab button in the container's tab navigation
4. Render the component conditionally when the tab is active
5. The tab fetches its own data using existing or new service methods
6. If new service methods are needed, add them to `PlatformHomeSingletonService` following the naming convention above

---

## Part 2: Demo Tenant QR Code Generation

### 2.1 Architecture

The QR system has three layers:

```
Admin Panel (generation)     QR Landing Page (consumer)     API (tracking + analytics)
┌──────────────────┐        ┌──────────────────┐           ┌──────────────────┐
│ Demo Tenants     │        │ /qr/[tenantId]   │           │ POST /api/public/│
│ Admin Page       │───────▶│                  │──────────▶│  qr/:tenantId/   │
│                  │        │ - Tracks scan    │           │  scan            │
│ - Generate QR    │        │ - Shows demo     │           │                  │
│ - Download PNG   │        │   banner + CTA   │           │ GET /api/admin/  │
│ - Printable card │        │ - Redirects to   │           │  demo-tenants/   │
│ - Scan analytics │        │   storefront     │           │  :id/qr-analytics│
└──────────────────┘        └──────────────────┘           └──────────────────┘
```

**Key files:**
- `apps/web/src/app/(platform)/settings/admin/demo-tenants/page.tsx` — admin panel with QR modal
- `apps/web/src/app/qr/[tenantId]/page.tsx` — public QR landing page
- `apps/api/src/routes/public-api.ts` — scan tracking + analytics endpoints
- `database/migrations/072_qr_scan_events.sql` — `qr_scan_events` table
- `apps/api/prisma/schema.prisma` — `qr_scan_events` model
- `apps/web/src/components/public/TenantQRCode.tsx` — existing tier-aware QR component (storefront-facing)

### 2.2 QR Code Generation

QR codes are generated **client-side** using the `qrcode` npm package (already installed). The admin panel dynamically imports it:

```typescript
const QRCode = (await import('qrcode')).default;
const canvas = document.createElement('canvas');
await QRCode.toCanvas(canvas, url, {
  width: 512,
  margin: 3,
  color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'H',
});
const dataUrl = canvas.toDataURL('image/png', 1.0);
```

**QR URL format:** `{origin}/qr/{tenantId}`

The URL points to the QR landing page, not directly to the storefront. This allows scan tracking before redirect.

### 2.3 Download Options

The admin QR modal provides:
- **Size downloads** — 512px, 1024px, 2048px PNG files
- **Printable card** — A4-sized PNG (595×842px) with tenant name, QR code, "DEMO STORE" badge, expiry date, and "Powered by VisibleShelf" footer. Generated using Canvas 2D API with the QR image drawn onto a layout canvas.

### 2.4 QR Landing Page

**Route:** `/qr/[tenantId]` (Next.js app directory)

**Flow:**
1. Page loads → POST to `/api/public/qr/:tenantId/scan` with `source`, `referrer`, `userAgent`
2. API validates tenant exists, inserts `qr_scan_events` row, returns tenant info
3. Page displays:
   - Demo banner (purple gradient) if `is_demo` is true
   - Tenant name with store icon
   - Demo info card with feature highlights (Real Products, Full Features, Time-Limited)
   - CTA buttons: "Visit Demo Store" (→ storefront) and "Get Your Own Store" (→ /signup?demo=X)
4. For non-demo tenants: simple redirect card with "Visit Store" button

**Redirect logic:**
- If `subdomain` exists → `https://{subdomain}.visibleshelf.com`
- Else if `slug` exists → `/tenant/{slug}`
- Else → `/tenant/{tenantId}`

### 2.5 Scan Tracking API

**POST `/api/public/qr/:tenantId/scan`** (no auth required)
- Body: `{ source?, referrer?, userAgent? }`
- Validates tenant exists
- Inserts row into `qr_scan_events` with `id`, `tenant_id`, `source`, `referrer`, `user_agent`, `created_at`
- Returns: `{ tenantId, tenantName, subdomain, slug, isDemo }`

**GET `/api/admin/demo-tenants/:id/qr-analytics`** (admin only)
- Returns scan statistics and recent scan events:
  - `stats`: `total_scans`, `unique_days`, `last_scan_at`, `scans_24h`, `scans_7d`, `scans_30d`
  - `recentScans`: last 50 scan events (id, source, referrer, user_agent, created_at)

### 2.6 Database Schema

```sql
CREATE TABLE qr_scan_events (
  id          VARCHAR(255) PRIMARY KEY,
  tenant_id   VARCHAR(255) NOT NULL,
  source      VARCHAR(100) DEFAULT 'qr_code',
  referrer    TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes: tenant_id, created_at DESC, (tenant_id, created_at DESC)
-- RLS enabled with permissive policy
-- FK to tenants(id) ON DELETE CASCADE
```

**ID format:** `qrs-{timestamp}-{random}` — not tenant-scoped (scan events are system-level tracking, not tenant-owned entities).

### 2.7 Existing TenantQRCode Component

There is a separate, pre-existing `TenantQRCode` component at `apps/web/src/components/public/TenantQRCode.tsx` used on **storefront-facing** surfaces (product pages, directory listings). It is **tier-aware** (higher tiers get logo overlay, higher error correction) and gated by capability flags (`storefront_options_qr_code`).

The admin QR modal in the demo tenant page does **not** use `TenantQRCode` — it generates QR codes directly using the `qrcode` library. This is intentional:
- Admin QR codes need custom printable card generation (Canvas 2D API)
- Admin QR codes don't need tier-awareness (demo tenants are always a fixed tier)
- Admin QR codes need multiple download sizes on demand
- The landing page URL (`/qr/{tenantId}`) is different from storefront QR URLs

### 2.8 Demo Tenant Admin Panel Integration

The demo tenant admin page at `apps/web/src/app/(platform)/settings/admin/demo-tenants/page.tsx` was extended with:

**State:**
- `qrOpen` / `qrTenant` — modal visibility and selected tenant
- `qrDataUrl` — generated QR code as data URL
- `qrGenerating` — loading state for QR generation
- `qrAnalytics` / `loadingAnalytics` — scan analytics data

**Functions:**
- `handleOpenQR(tenant)` — opens modal, generates QR, fetches analytics
- `generateQRCode(tenant)` — creates QR canvas at 512px
- `downloadQRCode(size)` — regenerates at requested size and triggers download
- `downloadPrintableCard()` — composes A4 layout with QR + tenant info
- `fetchQRAnalytics(tenantId)` — calls admin analytics endpoint

**UI:**
- "QR" button (indigo, with `QrCode` icon) in each tenant row's action column
- Modal with QR display, download buttons, "Open QR Landing Page" link, and scan analytics dashboard
- Analytics shows 4 stat cards (Total, 24h, 7d, 30d) + recent scans list

---

## Part 3: Patterns and Lessons

### 3.1 Container + Tab Component Pattern

The tabbed dashboard avoids the anti-pattern of one massive component fetching all data. Instead:
- **Container** fetches shared state (connection status, setup progress) once
- **Each tab** fetches its own data independently and manages its own loading/error states
- **Props flow down** — tabs receive connection status as props, don't re-fetch it
- **Events flow up** — tabs call container callbacks (e.g., `onSyncAll`) for shared actions

This pattern should be used when a settings page has multiple distinct data domains that don't need to share loading state.

### 3.2 Client-Side QR Generation

QR codes are generated client-side using Canvas API rather than server-side. Benefits:
- No server compute cost
- Instant regeneration at different sizes
- Canvas can be composited for printable cards
- `qrcode` library is already a dependency

The `qrcode` library is dynamically imported (`await import('qrcode')`) to avoid bundling it on pages that don't use QR codes.

### 3.3 Landing Page Interstitial Pattern

The QR code points to `/qr/[tenantId]` rather than directly to the storefront. This interstitial pattern:
- Enables scan tracking before redirect
- Provides a demo-branded experience with CTA to sign up
- Works for both demo and non-demo tenants (different UI)
- Can be extended with A/B testing, custom messaging, or affiliate tracking

### 3.4 Direct Pool for Simple Tracking Tables

The scan tracking endpoints use `getDirectPool()` (raw SQL) instead of Prisma. This is intentional for:
- Simple INSERT/SELECT operations with no relations to load
- Avoiding Prisma client overhead for high-frequency writes (scan events)
- The table has no complex relations or transactions

Prisma is still used for the tenant lookup (validation) in the scan endpoint.

---

## Part 5: Organizational Scaling

### 5.1 Tier Architecture: Individual vs Organization

The platform separates tiers by `tier_type` on `subscription_tiers_list`:

- **`tier_type: 'individual'`** — starter, professional, enterprise, etc. (assigned to standalone tenants)
- **`tier_type: 'organization'`** — chain_starter, chain_professional, chain_enterprise, etc. (assigned to organizations)

Both tier types receive the **same capability type assignments** (commerce, integration_options, product_options, storefront_options, etc.) via `tier_features_list`. The difference is the tier key and limits, not the capability domains available.

### 5.2 How Org Capabilities Resolve Today

The `EffectiveCapabilityResolver` (`apps/api/src/services/EffectiveCapabilityResolver.ts`) already handles org-level capability resolution through the **hero tenant** pattern:

1. When `resolveEffectiveCapabilities(heroTenantId)` is called, it fetches the tenant and its `organization_id`
2. It retrieves both `orgTierKey` (from `organizations_list.subscription_tier`) and `tenantTierKey` (from `tenants.subscription_tier`)
3. It fetches `tier_features_list` for **both** tiers
4. It merges features **most-permissive-wins** (line 388-403)

This means the hero tenant inherits all capability domains from the org's tier. All 17 domains (commerce, integrations, product_options, storefront_options, etc.) are resolved from the org tier's feature assignments.

The separate `organization_options` capability (resolved by `OrgOptionsResolver` at `apps/api/src/services/resolvers/OrgOptionsResolver.ts`) handles **org-specific UI concerns only**: which org tabs are visible (overview, locations, propagation, capabilities, team, commerce, billing), which panels are available, and which propagation types are allowed. It does **not** duplicate tenant-level capability domains.

### 5.3 Org-Level Google Integration Dashboard

**Scaling approach:** The org-level dashboard reuses the same container + tab pattern but aggregates across child tenants.

**Capability gating:** Check `resolveEffectiveCapabilities(heroTenantId).effective.integrations.enabled` — gated by the org tier's `integration_options` feature keys. No new capability keys needed.

**Architecture:**
```
Org Google Dashboard (container)
├── Overview tab: aggregate sync health across all child tenants
│   ├── Loop over child tenants → call getGMCProductSyncStatus per tenant
│   └── Sum: connected/disconnected, total errors, product coverage %
├── Products tab: cross-tenant sync status with tenant column + filter
├── Business Profile tab: all GBP locations across the org
└── Settings tab: org-level fulfillment defaults → push to child tenants
    (reuses PropagationService pattern)
```

**Backend endpoint:** `GET /api/organizations/:orgId/google/aggregate-sync-status` — loops over child tenants, calls existing per-tenant sync status endpoints, aggregates results. Same pattern as the existing `capability-rollup` endpoint at `apps/api/src/routes/organization-capabilities.ts:254-367`.

### 5.4 Org-Level QR Code Management

**Scaling approach:** QR codes are inherently per-tenant (each location has its own storefront URL), but org admins need batch management and aggregate analytics.

**Capability gating:** Check `resolveEffectiveCapabilities(heroTenantId).effective.product_options.features.product_opt_qr_codes` — gated by the org tier's `product_options` feature keys. No new capability keys needed.

**Architecture:**
- Batch QR generation: loop over child tenants, generate QR code per tenant using existing client-side `qrcode` library
- Batch printable cards: generate one card per location, or a combined sheet
- Aggregate scan analytics: `GET /api/organizations/:orgId/qr-analytics` queries `qr_scan_events` with `WHERE tenant_id IN (SELECT id FROM tenants WHERE organization_id = $1)`
- Per-location breakdown in the org admin panel: shows scans per tenant + total org scans

### 5.5 Demo Organizations

**Problem:** The demo tenant concept (`is_demo`, `demo_expires_at`, `demo_template` on the `tenants` table) does not exist at the organization level. The `organizations_list` table has no demo fields.

**Solution:** Extend the demo pattern to organizations by adding the same demo fields to `organizations_list` and creating a `DemoOrganizationService` that mirrors `DemoTenantService`.

**Demo org templates:**
- `chain_grocery_3loc` — creates an org with 3 grocery store tenants in different neighborhoods
- `chain_convenience_5loc` — creates an org with 5 convenience store tenants
- `chain_specialty_2loc` — creates an org with 2 specialty retail stores

**Lifecycle:**
1. `createDemoOrganization()` — creates `organizations_list` with `is_demo: true`, org tier (e.g., `chain_professional`), then calls `DemoTenantService.createDemoTenant` N times with `organization_id` set on each child tenant
2. One child tenant is marked as hero location via `metadata.isHeroLocation`
3. `expireDemoOrganization(orgId)` — cascades expiry to all child tenants (same as `expireDemoTenant` but for all children)
4. `deleteDemoOrganization(orgId)` — cascades deletion to all child tenants
5. The existing `demo-tenant-expiry.ts` job is extended to also check `organizations_list` for expired demo orgs

**Capability resolution for demo orgs:** The hero tenant of the demo org resolves through `resolveEffectiveCapabilities(heroTenantId)` using the org's tier (e.g., `chain_professional`). All 17 capability domains are resolved from the org tier via most-permissive-wins merge. No changes to the resolver needed.

**QR codes for demo orgs:** Each child demo tenant gets its own QR code via the existing flow. The org admin can batch-generate QR codes for all locations and see aggregate scan analytics.

### 5.6 Org-Level Capability Awareness Pattern

The key insight is that **org-level features are gated by the org's tier, resolved through the hero tenant**. The existing architecture already supports this:

```
Org Admin requests org-level feature
  ↓
resolveEffectiveCapabilities(heroTenantId)
  → Fetches org tier (organizations_list.subscription_tier)
  → Fetches tenant tier (tenants.subscription_tier)
  → Merges tier features most-permissive-wins
  → Resolves all 17 capability domains
  → Also resolves organization_options (OrgOptionsResolver)
  ↓
Check the relevant domain:
  → effective.integrations.enabled → gate Google dashboard
  → effective.product_options.features.product_opt_qr_codes → gate QR management
  → effective.org_options.allowed_tabs → gate org UI tabs
  ↓
If enabled → show org-level UI
  ↓
Org-level UI loops over child tenants
  → Calls existing per-tenant service methods
  → Aggregates results
```

**No new capability keys are needed.** The org's tier already has the same capability type assignments as individual tenant tiers. The `organization_options` capability (OrgOptionsResolver) remains the separate org-specific layer for tabs/panels/propagation — it does not duplicate tenant-level domains.

**Frontend pattern:** A `useOrgCapabilities(heroTenantId)` hook calls the existing `/api/tenants/:tenantId/effective-capabilities` endpoint with the hero tenant ID and caches the result for org-level UI gating. This is the same endpoint used for tenant-level capability resolution — just called with the hero tenant ID instead of a child tenant ID.

---

## Part 6: Existing Skills Alignment

### Skills That Do NOT Need Updates

- `deploy-service-extending-base-singleton.md` — The new methods on `PlatformHomeSingletonService` follow the existing singleton pattern documented here. No new base class or pattern was introduced.
- `capability-deployment-flow.md` — No new capabilities or feature keys were added.
- `capability-data-flow-rules.md` — No new capability rules introduced.
- `feature-flag-catalog.md` — QR code generation for demo tenants is not gated by a feature flag; it's available to all platform admins.
- `tenant-scoped-id-generation.md` — QR scan event IDs use a simple `qrs-{timestamp}-{random}` format, not tenant-scoped IDs. This is intentional since scan events are system-level tracking, not tenant-owned entities.

### No Conflicts

This session's implementations do not conflict with any existing skill documents. The Google integration dashboard and QR code generation are self-contained features that follow existing platform patterns (singleton services, Mantine UI components, Next.js app directory routing, raw SQL for simple tracking tables).

The organizational scaling section (Part 5) documents how these features scale via the existing `EffectiveCapabilityResolver` hero tenant pattern — no new capability keys, resolvers, or settings tables are needed. The `organization_options` capability (OrgOptionsResolver) remains the separate org-specific layer for tabs/panels/propagation. The planned demo organization extension (Sprint 5.3) mirrors the existing `DemoTenantService` pattern and requires only additive columns on `organizations_list`.
