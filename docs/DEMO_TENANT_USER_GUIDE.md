# Demo Tenant Architecture — User Guide

## Overview

Demo tenants are a special class of tenant used for sales demonstrations and prospective customer evaluation. They are created from pre-built templates with pre-populated product data, business hours, and a configurable expiration date. The platform automatically expires them when their time is up.

---

## What Makes a Demo Tenant Different

### Database Attributes

Demo tenants are regular rows in the `tenants` table with four additional columns set:

| Column | Type | Description |
|---|---|---|
| `is_demo` | `Boolean?` (default `false`) | Flag marking the tenant as a demo |
| `demo_expires_at` | `DateTime?` | When the demo should auto-expire |
| `demo_source_tenant_id` | `String?` | ID of the tenant this demo was cloned from (if any) |
| `demo_template` | `String?` | Which template was used (`grocery`, `convenience`, `specialty_retail`) |

Schema: `apps/api/prisma/schema.prisma:4713-4716`

### Behaviors Unique to Demo Tenants

1. **Template-based creation** — Created from one of 3 templates with pre-seeded products, categories, business hours, and GBP category
2. **Automatic expiration** — An hourly job (`demo-tenant-expiry.ts`) finds demo tenants past `demo_expires_at` and marks them `closed`, hides from directory, and cancels subscription
3. **Demo banner on storefront** — `DemoBanner.tsx` shows an amber banner: "This is a demonstration store — explore the features, but orders are not real." with a countdown to expiry
4. **QR code landing page** — `/qr/[tenantId]` shows a special demo landing page with demo info card (vs. redirect for non-demo tenants)
5. **QR scan analytics** — Admin can view scan stats (total, 24h, 7d, 30d) per demo tenant via `GET /api/admin/demo-tenants/:id/qr-analytics`
6. **Demo badge in org locations** — `OrgLocationsClient.tsx` shows a purple "Demo" badge next to demo tenants in organization location lists
7. **Revokeable** — Demo status can be revoked, converting back to a regular tenant (clears all 4 demo columns)
8. **Convertible** — An existing regular tenant can be converted to a demo tenant in-place (keeps its data, adds demo flags)

### What Demo Tenants Share with Regular Tenants

- Same `tenants` table, same Prisma model
- Same slug generation via `SlugSingletonService.generateSlug()` (uses `generateUniqueDirectorySlug` with geographic disambiguation)
- Same subscription tier system (`subscription_tier` set from template config)
- Same user-tenant linking (`user_tenants` with `OWNER` role)
- Same business hours table (`business_hours_list`)
- Same product/inventory tables (`inventory_items`)
- Same public API exposure (`GET /api/public/tenant/:identifier` returns `isDemo` and `demoExpiresAt` fields)

---

## Architecture

### Backend Service

**`apps/api/src/services/DemoTenantService.ts`** — Singleton service with these methods:

| Method | Description |
|---|---|
| `getAvailableTemplates()` | Returns list of templates with key, name, product count |
| `createDemoTenant(options)` | Creates a new demo tenant from a template. Generates tenant ID, geographically-disambiguated slug, seeds business profile + products + hours, links owner |
| `seedDemoProducts(tenantId, template)` | Uses `generateQuickStartProducts()` to populate inventory |
| `seedBusinessHours(tenantId, hours)` | Creates `business_hours_list` record with template defaults |
| `seedBusinessProfile(tenantId, name, config)` | Creates `tenant_business_profiles_list` record with template default contact info |
| `expireDemoTenant(tenantId)` | Marks tenant as `closed`, `directory_visible=false`, `subscription_status=cancelled` |
| `listDemoTenants({ includeExpired, limit, offset })` | Lists demo tenants, optionally including expired ones |
| `getDemoTenant(tenantId)` | Gets demo tenant details + active product count |
| `deleteDemoTenant(tenantId)` | Permanently deletes demo tenant and all its data (products, hours, user links) |
| `convertToDemoTenant(tenantId, options)` | Converts an existing regular tenant to demo (adds demo flags, sets expiry) |
| `revokeDemoStatus(tenantId)` | Removes demo status (clears all 4 demo columns, tenant becomes regular) |
| `changeDemoTenantTier(tenantId, newTier)` | Changes subscription tier on a demo tenant (validates against active tiers) |
| `findExpiredDemoTenants()` | Finds active demo tenants past their `demo_expires_at` |

### Backend Routes

**`apps/api/src/routes/admin/demo-tenants.ts`** — All routes require `authenticateToken` + `requirePlatformAdmin`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/demo-tenants/templates` | GET | List available templates |
| `/api/admin/demo-tenants` | GET | List demo tenants (query: `includeExpired`, `limit`, `offset`) |
| `/api/admin/demo-tenants/:id` | GET | Get demo tenant details |
| `/api/admin/demo-tenants` | POST | Create new demo tenant (body: `template`, `businessName?`, `createdBy?`, `expiresAt?`, `subdomain?`) |
| `/api/admin/demo-tenants/convert` | POST | Convert existing tenant to demo (body: `tenantId`, `template?`, `expiresAt?`, `sourceTenantId?`) |
| `/api/admin/demo-tenants/:id/revoke-demo` | POST | Revoke demo status |
| `/api/admin/demo-tenants/:id/tier` | PATCH | Change subscription tier (body: `{ tier: string }`) |
| `/api/admin/demo-tenants/:id/expire` | POST | Manually expire a demo tenant |
| `/api/admin/demo-tenants/:id` | DELETE | Permanently delete demo tenant + all data |
| `/api/admin/demo-tenants/:id/qr-analytics` | GET | QR scan analytics (defined in `public-api.ts`) |

### Expiry Job

**`apps/api/src/jobs/demo-tenant-expiry.ts`** — Runs every 1 hour:
1. Calls `findExpiredDemoTenants()` — finds tenants where `is_demo=true`, `demo_expires_at <= now`, `location_status='active'`
2. For each, calls `expireDemoTenant()` — sets `location_status='closed'`, `subscription_status='cancelled'`, `directory_visible=false`, `closure_reason='Demo tenant expired'`
3. Wired into server startup at `apps/api/src/index.ts:8338`

### Frontend

**Admin Page**: `apps/web/src/app/(platform)/settings/admin/demo-tenants/page.tsx`
- Table of demo tenants with name, template, subdomain/slug, status, expiry, created date
- Actions per row: QR code modal, Expire, Revoke Demo, Delete
- Create modal: template picker, business name override, subdomain
- Convert modal: tenant picker, template (optional), expiry days
- QR modal: QR code display, download (512/1024/2048px), printable card, scan analytics

**Frontend Service**: `apps/web/src/services/DemoTenantAdminService.ts`
- Singleton extending `AdminApiSingleton`
- Methods: `listDemoTenants`, `getTemplates`, `getDemoTenant`, `createDemoTenant`, `expireDemoTenant`, `deleteDemoTenant`, `convertToDemoTenant`, `revokeDemoStatus`, `getQRAnalytics`

**Storefront Demo Banner**: `apps/web/src/components/storefront/DemoBanner.tsx`
- Shows amber banner with expiry countdown
- Rendered on tenant storefront page when `tenant.isDemo === true`

**QR Landing Page**: `apps/web/src/app/qr/[tenantId]/page.tsx`
- Demo tenants get a special landing page with demo info card
- Non-demo tenants get a redirect prompt

**Org Locations**: `apps/web/src/app/t/[tenantId]/settings/organization/locations/OrgLocationsClient.tsx`
- Shows purple "Demo" badge for demo tenants in the location list

### Templates

| Template | Scenario | Products | Tier | GBP Category | Default Hours | City/State |
|---|---|---|---|---|---|---|
| `grocery` | grocery | 20 | professional | grocery_store | 08:00–21:00 (Fri/Sat until 22:00) | New York, NY |
| `convenience` | grocery | 15 | starter | convenience_store | 06:00–23:00 (Fri/Sat until 00:00) | New York, NY |
| `specialty_retail` | general | 18 | professional | store | 10:00–18:00 (Thu/Fri until 19:00) | New York, NY |

Default expiry: **30 days** from creation.

### Slug Generation

Demo tenants use the same `SlugSingletonService.generateSlug()` as regular tenants. This calls `generateUniqueDirectorySlug()` from `apps/api/src/utils/slug-generator.ts` which:
1. Tries base slug (business name slugified)
2. Appends city if collision
3. Appends state abbreviation if still colliding
4. Appends country abbreviation if still colliding
5. Falls back to autoId (derived from tenant ID) for guaranteed uniqueness

**~~Current gap~~** (FIXED): `DemoTenantService.createDemoTenant()` now passes the template's `defaultCity`, `defaultState`, `defaultCountry` to `generateSlug()` for geographic disambiguation. A `tenant_business_profiles_list` record is also created during demo creation with the template's default contact info.

---

## Current Limitations & Gaps

### 1. ~~No Tier Change Support~~ (IMPLEMENTED)
Demo tenants can now have their tier changed via `changeDemoTenantTier()` and the admin UI "Change Tier" button. Valid tiers are sourced from `subscription_tiers_list` (active, non-trial).

### Active Subscription Tiers

The following tiers are active in `subscription_tiers_list` (excluding trial tiers):

| Tier Key | Name | Price | Type | Max SKUs | Max Locations |
|---|---|---|---|---|---|
| `discovery` | Discovery | $29/mo | individual | 75 | 1 |
| `storefront` | Storefront | $59/mo | individual | 200 | 1 |
| `commitment` | Commitment | $79/mo | individual | 500 | 2 |
| `ecommerce` | E-Commerce | $99/mo | individual | 1,000 | 2 |
| `omnichannel` | Omnichannel | $149/mo | individual | 1,500 | 5 |
| `professional` | Professional | $199/mo | individual | 2,000 | 7 |
| `chain_starter` | Chain Starter | $299/mo | organization | 3,000 | 5 |
| `chain_professional` | Chain Professional | $399/mo | organization | 5,000 | 10 |
| `enterprise` | Enterprise | $499/mo | individual | 10,000 | 20 |
| `organization` | Organization | $499/mo | organization | 7,000 | 15 |

### 2. ~~Slug Not Geographically Disambiguated~~ (FIXED)
`createDemoTenant()` now passes `{ city, state, country }` from the template config to `generateSlug()`. Slugs for demo tenants now get the same geographic disambiguation as regular tenants.

### 3. ~~No Business Profile Created~~ (FIXED)
Demo tenants now get a `tenant_business_profiles_list` record during creation via `seedBusinessProfile()`. The profile includes business name, address, city, state, postal code, country, phone, email, website, and description from the template config.

### 4. No Directory Settings Record
Demo tenants don't get a `directory_settings_list` record during creation. The slug is saved to the `tenants.slug` column but not to `directory_settings_list.slug`. The `SlugSingletonService.getOrCreateSlug()` would create one on first access, but it starts with `is_published: false`.

### 5. No Capability/Feature Configuration
Demo tenants inherit whatever capabilities their template tier provides. There's no demo-specific capability override or enhancement.

### 6. Expiry Only Closes — Doesn't Clean Up
When a demo tenant expires, it's marked `closed` and hidden from the directory, but its products, hours, and user links remain. Full cleanup only happens via explicit `deleteDemoTenant()`.

---

## Implemented Enhancements

### A. Tier Change for Demo Tenants (IMPLEMENTED)

Added `changeDemoTenantTier()` method to `DemoTenantService`:

```typescript
async changeDemoTenantTier(
  tenantId: string,
  newTier: string
): Promise<{ changed: boolean; tenantId: string; oldTier: string; newTier: string; reason: string }>
```

This:
1. Verifies the tenant is a demo tenant
2. Validates the tier against the active tiers list
3. Updates `subscription_tier` on the `tenants` record
4. Returns the old and new tier for audit

Backend route: `PATCH /api/admin/demo-tenants/:id/tier` with body `{ tier: string }`

Frontend: `DemoTenantAdminService.changeDemoTenantTier()` + tier selector modal in admin UI with all 10 active tiers (prices shown).

### B. Geographic Slug Generation (IMPLEMENTED)

Updated `createDemoTenant()` to:
1. Create a `tenant_business_profiles_list` record with template default location data (city, state, country, address, phone, email, website, description)
2. Pass the template's location to `slugSingletonService.generateSlug(name, location, tenantId)` for geographic disambiguation

Added `defaultCity`, `defaultState`, `defaultCountry`, `defaultPhone`, `defaultEmail`, `defaultWebsite`, `defaultDescription` to `DemoTemplateConfig` and all 3 templates.

### C. Additional Future Enhancements

- **Clone from existing tenant**: Use `sourceTenantId` to copy products, categories, and settings from a real tenant instead of using templates
- **Demo-to-real conversion**: When revoking demo status, optionally preserve the expiry as a trial period and set up billing
- **Demo analytics dashboard**: Beyond QR scans, track storefront visits, product views, cart actions
- **Template expansion**: Add more templates (restaurant, salon, pharmacy, etc.)
- **Auto-cleanup on expiry**: Option to automatically delete data after a grace period instead of just marking closed

---

## File Reference

| File | Purpose |
|---|---|
| `apps/api/src/services/DemoTenantService.ts` | Backend singleton service (create, list, expire, delete, convert, revoke, changeTier, seedBusinessProfile) |
| `apps/api/src/routes/admin/demo-tenants.ts` | Admin API routes (CRUD + convert + revoke + expire + tier change) |
| `apps/api/src/routes/public-api.ts:4064` | QR analytics endpoint |
| `apps/api/src/routes/public-api.ts:813` | Public tenant API includes `is_demo` + `demo_expires_at` |
| `apps/api/src/jobs/demo-tenant-expiry.ts` | Hourly expiry job |
| `apps/api/src/index.ts:8338` | Job startup wiring |
| `apps/api/prisma/schema.prisma:4713` | Demo columns on `tenants` model |
| `apps/web/src/services/DemoTenantAdminService.ts` | Frontend admin service singleton |
| `apps/web/src/app/(platform)/settings/admin/demo-tenants/page.tsx` | Admin UI page |
| `apps/web/src/components/storefront/DemoBanner.tsx` | Storefront demo banner |
| `apps/web/src/app/qr/[tenantId]/page.tsx` | QR landing page (demo-specific) |
| `apps/web/src/app/t/[tenantId]/settings/organization/locations/OrgLocationsClient.tsx` | Demo badge in org locations |
| `apps/api/src/services/SlugSingletonService.ts` | Slug generation service (shared with regular tenants) |
| `apps/api/src/utils/slug-generator.ts` | Platform standard slug utility with geographic disambiguation |
