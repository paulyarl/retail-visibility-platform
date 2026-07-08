# Demo Tenant Management

## When to Use

- Creating, modifying, or extending demo tenant functionality
- Changing demo tenant subscription tiers
- Integrating slug generation with demo tenants
- Understanding demo tenant lifecycle and architecture
- Adding new demo templates or modifying existing ones
- Working with the admin demo tenants page at `/settings/admin/demo-tenants`

## Architecture Overview

Demo tenants are regular rows in the `tenants` table with 4 additional columns:
- `is_demo` (Boolean, default false) — marks the tenant as a demo
- `demo_expires_at` (DateTime) — auto-expiry date
- `demo_template` (String) — which template was used (`grocery`, `convenience`, `specialty_retail`)
- `demo_source_tenant_id` (String) — source tenant ID if cloned from an existing tenant

Schema: `apps/api/prisma/schema.prisma:4713-4716`

## Key Files

### Backend
- `apps/api/src/services/DemoTenantService.ts` — Singleton service with all demo tenant logic
- `apps/api/src/routes/admin/demo-tenants.ts` — Admin API routes (CRUD + convert + revoke + expire + tier change)
- `apps/api/src/routes/public-api.ts:4064` — QR analytics endpoint
- `apps/api/src/routes/public-api.ts:813` — Public tenant API includes `isDemo` + `demoExpiresAt` fields
- `apps/api/src/jobs/demo-tenant-expiry.ts` — Hourly background job that auto-expires demo tenants
- `apps/api/src/index.ts:8338` — Job startup wiring

### Frontend
- `apps/web/src/services/DemoTenantAdminService.ts` — Frontend singleton service wrapping admin API
- `apps/web/src/app/(platform)/settings/admin/demo-tenants/page.tsx` — Admin UI page with modals for create, convert, tier change, QR code, expire, revoke, delete
- `apps/web/src/components/storefront/DemoBanner.tsx` — Amber banner shown on demo tenant storefronts with expiry countdown
- `apps/web/src/app/qr/[tenantId]/page.tsx` — QR landing page (demo-specific info card vs redirect for non-demo)
- `apps/web/src/app/t/[tenantId]/settings/organization/locations/OrgLocationsClient.tsx` — Purple "Demo" badge in org location list

### Slug Generation (shared with regular tenants)
- `apps/api/src/services/SlugSingletonService.ts` — Slug management with caching and DB persistence
- `apps/api/src/utils/slug-generator.ts` — Platform standard slug utility with geographic disambiguation

## Demo Tenant Lifecycle

1. **Create** — `createDemoTenant(options)` generates tenant ID, geographically-disambiguated slug, creates business profile, seeds products + business hours, optionally links owner
2. **Active** — Tenant appears in directory, storefront is live with demo banner, QR code works
3. **Expire** — Either manually via admin UI or automatically via hourly job. Sets `location_status='closed'`, `subscription_status='cancelled'`, `directory_visible=false`
4. **Revoke Demo Status** — `revokeDemoStatus(tenantId)` clears all 4 demo columns, tenant becomes a regular tenant
5. **Delete** — `deleteDemoTenant(tenantId)` permanently removes tenant and all associated data

### Conversion
- `convertToDemoTenant(tenantId, options)` — Converts an existing regular tenant to demo in-place (keeps data, adds demo flags)

## DemoTenantService Methods

| Method | Purpose |
|---|---|
| `getAvailableTemplates()` | Returns list of templates |
| `createDemoTenant(options)` | Creates demo tenant with slug, business profile, products, hours |
| `seedBusinessProfile(tenantId, name, config)` | Creates `tenant_business_profiles_list` with template defaults |
| `seedBusinessHours(tenantId, hours)` | Creates `business_hours_list` with template defaults |
| `seedDemoProducts(tenantId, template)` | Populates inventory via `generateQuickStartProducts()` |
| `expireDemoTenant(tenantId)` | Marks closed, hidden, cancelled |
| `listDemoTenants({ includeExpired, limit, offset })` | Lists demo tenants |
| `getDemoTenant(tenantId)` | Gets details + active product count |
| `deleteDemoTenant(tenantId)` | Permanently deletes tenant + all data |
| `convertToDemoTenant(tenantId, options)` | Converts regular tenant to demo |
| `revokeDemoStatus(tenantId)` | Removes demo status |
| `changeDemoTenantTier(tenantId, newTier)` | Changes subscription tier (validates against active tiers) |
| `findExpiredDemoTenants()` | Finds active demo tenants past expiry date |

## API Endpoints

All admin routes require `authenticateToken` + `requirePlatformAdmin`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/demo-tenants/templates` | GET | List available templates |
| `/api/admin/demo-tenants` | GET | List demo tenants |
| `/api/admin/demo-tenants/:id` | GET | Get demo tenant details |
| `/api/admin/demo-tenants` | POST | Create new demo tenant |
| `/api/admin/demo-tenants/convert` | POST | Convert existing tenant to demo |
| `/api/admin/demo-tenants/:id/revoke-demo` | POST | Revoke demo status |
| `/api/admin/demo-tenants/:id/tier` | PATCH | Change subscription tier |
| `/api/admin/demo-tenants/:id/expire` | POST | Manually expire |
| `/api/admin/demo-tenants/:id` | DELETE | Permanently delete |
| `/api/admin/demo-tenants/:id/qr-analytics` | GET | QR scan analytics |

## Active Subscription Tiers

Valid tiers for `changeDemoTenantTier()` (from `subscription_tiers_list` where `is_active=true` and not trial):

| Tier Key | Name | Price | Type |
|---|---|---|---|
| `discovery` | Discovery | $29/mo | individual |
| `storefront` | Storefront | $59/mo | individual |
| `commitment` | Commitment | $79/mo | individual |
| `ecommerce` | E-Commerce | $99/mo | individual |
| `omnichannel` | Omnichannel | $149/mo | individual |
| `professional` | Professional | $199/mo | individual |
| `chain_starter` | Chain Starter | $299/mo | organization |
| `chain_professional` | Chain Professional | $399/mo | organization |
| `enterprise` | Enterprise | $499/mo | individual |
| `organization` | Organization | $499/mo | organization |

## Templates

| Template | Scenario | Products | Tier | GBP Category | City/State |
|---|---|---|---|---|---|
| `grocery` | grocery | 20 | professional | grocery_store | New York, NY |
| `convenience` | grocery | 15 | starter | convenience_store | New York, NY |
| `specialty_retail` | general | 18 | professional | store | New York, NY |

Default expiry: **30 days** from creation.

Each template includes: `defaultCity`, `defaultState`, `defaultCountry`, `defaultPhone`, `defaultEmail`, `defaultWebsite`, `defaultDescription`. These are used for:
1. Geographic slug disambiguation via `slugSingletonService.generateSlug(name, location, tenantId)`
2. Business profile creation via `seedBusinessProfile(tenantId, name, config)`

## Slug Generation Integration

Demo tenants use the same `SlugSingletonService.generateSlug()` as regular tenants:
1. `generateUniqueDirectorySlug()` tries base slug (business name slugified)
2. Appends city if collision
3. Appends state if still colliding
4. Appends country if still colliding
5. Falls back to autoId (derived from tenant ID) for guaranteed uniqueness

`SlugSingletonService.regenerateSlugFromBusinessName(tenantId, forceUpdate)` can be used to regenerate slugs after business name changes. This reads from `tenant_business_profiles_list` which is now created during demo tenant creation.

## Frontend Service

`DemoTenantAdminService` (singleton extending `AdminApiSingleton`):
- `listDemoTenants(includeExpired?)` — Lists demo tenants
- `getTemplates()` — Gets available templates
- `getDemoTenant(tenantId)` — Gets demo tenant details
- `createDemoTenant(options)` — Creates new demo tenant
- `expireDemoTenant(tenantId)` — Expires a demo tenant
- `deleteDemoTenant(tenantId)` — Deletes a demo tenant
- `convertToDemoTenant(tenantId, options)` — Converts regular tenant to demo
- `revokeDemoStatus(tenantId)` — Revokes demo status
- `changeDemoTenantTier(tenantId, tier)` — Changes subscription tier
- `getQRAnalytics(tenantId)` — Gets QR scan analytics

## Admin UI Features

The admin page at `/settings/admin/demo-tenants` provides:
- Table of demo tenants with name, template, subdomain/slug, status, expiry, created date
- **Create modal**: Template picker, business name override, subdomain
- **Convert modal**: Tenant picker, template (optional), expiry days
- **Tier change modal**: Dropdown with all 10 active tiers (prices shown), "Change Tier" button
- **QR modal**: QR code display, download (512/1024/2048px), printable card, scan analytics
- Per-row actions: QR, Expire, Revoke Demo, Change Tier, Delete

## Expiry Job

`apps/api/src/jobs/demo-tenant-expiry.ts` runs every 1 hour:
1. `findExpiredDemoTenants()` — finds tenants where `is_demo=true`, `demo_expires_at <= now`, `location_status='active'`
2. For each, calls `expireDemoTenant()` — sets `location_status='closed'`, `subscription_status='cancelled'`, `directory_visible=false`

## What Makes Demo Tenants Different from Regular Tenants

1. **Template-based creation** — Pre-seeded products, categories, business hours, business profile from template config
2. **Automatic expiration** — Hourly job auto-closes demo tenants past `demo_expires_at`
3. **Demo banner on storefront** — Amber banner with expiry countdown
4. **Special QR landing page** — Demo info card instead of redirect
5. **QR scan analytics** — Admin can view scan stats per demo tenant
6. **Demo badge in org locations** — Purple "Demo" badge in location lists
7. **Revokeable** — Demo status can be revoked, converting back to regular tenant
8. **Convertible** — Regular tenants can be converted to demo in-place
9. **Tier changeable** — Admin can change subscription tier on demo tenants via API or UI

## What Demo Tenants Share with Regular Tenants

- Same `tenants` table, same Prisma model
- Same slug generation via `SlugSingletonService` (with geographic disambiguation)
- Same subscription tier system
- Same user-tenant linking (`user_tenants` with `OWNER` role)
- Same business hours, product/inventory, and business profile tables
- Same public API exposure

## Remaining Gaps (Future Enhancements)

- **No directory settings record** — Slug saved to `tenants.slug` but not `directory_settings_list` during creation
- **No demo-specific capability overrides** — Demo tenants inherit template tier capabilities
- **Expiry only closes** — Data remains after expiry; full cleanup requires explicit `deleteDemoTenant()`
- **Clone from existing tenant** — `sourceTenantId` field exists but clone logic not implemented
- **Demo-to-real conversion with billing** — Revoking demo status doesn't set up billing
- **Template expansion** — Only 3 templates available (grocery, convenience, specialty_retail)

## Reference Document

Full architecture analysis and user guide: `docs/DEMO_TENANT_USER_GUIDE.md`
