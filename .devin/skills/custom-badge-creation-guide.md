# Custom Badge Creation — Merchant User Guide

## Overview

Merchants can create custom badges to highlight products in their storefront beyond the built-in system badges (sale, new_arrival, clearance, etc.). Custom badges are tenant-scoped — they belong to your store and don't affect other merchants.

## Access Requirements

Custom badges require the `featured_custom_badge_slots` capability (under the `featured_options` capability type). This feature can be enabled through **any** of the following paths — the platform's capability architecture is flexible and not hardcoded to specific tiers:

- **Tier-bundled**: Included in Professional, Enterprise, Organization, Chain Professional, and Chain Enterprise tiers (plus trial mirrors). Flexible tier includes all features.
- **BSaaS purchase**: Available as a monthly add-on in the Feature Store (`/t/[tenantId]/settings/feature-store`) for tenants on any tier. Includes a 14-day free trial. The `EffectiveCapabilityResolver` auto-merges active purchases into the tenant's capability set.
- **Admin grant**: Platform admins can assign the `featured_custom_badge_slots` feature to any tier via the capability admin UI, or grant it directly to a tenant via `POST /api/admin/feature-purchases` (source `admin_grant`, price 0).

**Slot limit**: Maximum 10 custom badges per tenant.

**Access check**: The backend returns `hasAccess: boolean` from `GET /api/tenants/:tenantId/badge-registry/custom`. If `false`, the UI shows options to purchase from the Feature Store or upgrade the plan.

## Where to Find It

1. Navigate to **Settings → Products → Badges** (`/t/[tenantId]/settings/products/badges`)
2. The Custom Badge Manager shows:
   - Slot usage indicator (e.g., 3 / 10 slots used)
   - List of existing custom badges with edit/delete/toggle controls
   - "New Badge" button to create a custom badge
   - Links to **Analytics** and **Suggestions** sub-pages

## Creating a Custom Badge

1. Click **New Badge**
2. Fill in the form:
   - **Key** (required): Unique identifier for the badge. Auto-lowercased and spaces converted to underscores. Must be unique within your tenant. Example: `eco_friendly`
   - **Label** (required): Display name shown on the badge in the storefront. Example: "Eco-Friendly"
   - **Description** (optional): Internal note explaining what the badge means. Not shown to customers.
   - **Icon** (optional): Emoji or short text shown before the label. Example: 🌱
   - **Color** (required): One of 10 preset colors — blue, green, red, orange, purple, amber, yellow, teal, indigo, pink
3. Click **Save** to create the badge

### Validation
- Duplicate keys are rejected with a 409 error
- If you've reached the 10-badge limit, the "New Badge" button is disabled

## Editing a Custom Badge

1. Click the **pencil icon** on any existing custom badge
2. Modify label, description, icon, color, priority, or sort order
3. Click **Save** to update

## Toggling Badge Active State

- Click the **Active/Inactive** toggle on any badge to enable or disable it
- Inactive badges remain in your registry but won't appear on products or in storefront display

## Deleting a Custom Badge

1. Click the **trash icon** on the badge
2. A confirmation prompt appears
3. Confirm to permanently delete the badge
- Deleting a badge does NOT automatically remove it from products — existing `featured_products` assignments with that `featured_type` will remain but won't render (the badge definition is gone)

## Assigning Custom Badges to Products

Custom badges are assigned to products the same way as system badges:
- Via the **Featured Products** management UI in the product settings
- Via the API: `POST /api/tenants/:tenantId/featured-products` with `featured_type` set to your custom badge key
- Custom badges support `featured_priority` for sort ordering and `featured_expires_at` for time-limited promotions

## Analytics for Custom Badges

Custom badges are tracked in badge analytics just like system badges:
- Navigate to **Settings → Products → Badges → Analytics**
- View views, clicks, CTR, conversion rate, revenue, and ROI per badge
- Filter by time period (daily/weekly/monthly) and date range

## Auto-Promotion Suggestions

Custom badges with declarative rules (auto-assign/auto-remove JSONB) are evaluated by the rule engine:
- Navigate to **Settings → Products → Badges → Suggestions**
- View products that should be assigned or removed badges based on rules
- Note: Custom badges created via the UI are `manual` by default — rules must be set via the API or database

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tenants/:tenantId/badge-registry/custom` | GET | List custom badges + slot usage |
| `/api/tenants/:tenantId/badge-registry/custom` | POST | Create a custom badge |
| `/api/tenants/:tenantId/badge-registry/custom/:badgeId` | PUT | Update a custom badge |
| `/api/tenants/:tenantId/badge-registry/custom/:badgeId` | DELETE | Delete a custom badge |
| `/api/tenants/:tenantId/badge-registry` | GET | List all badges (system + custom) |

## Frontend Hooks

| Hook | Purpose |
|------|---------|
| `useTenantCustomBadges(tenantId)` | Fetch custom badges + slot usage + access state |
| `useCreateCustomBadge(tenantId)` | Create mutation |
| `useUpdateCustomBadge(tenantId)` | Update mutation |
| `useDeleteCustomBadge(tenantId)` | Delete mutation |

## Capability Architecture

Custom badge slots use the platform's standard capability architecture. The feature is **source-agnostic** — the `EffectiveCapabilityResolver` merges features from three sources (org-tier, tenant-tier, BSaaS purchases) into a single `mergedFeatures` map. Downstream services only check "is this feature enabled?" without caring how it was enabled.

- **Feature key**: `featured_custom_badge_slots` (in `features_list`)
- **Capability type**: `featured_options` (linked via `capability_features_list`)
- **Tier seeding**: Migration `062_custom_badge_slots_capability.sql` seeds the feature for Professional+ tiers
- **BSaaS catalog**: Migration `080_bsaas_custom_badge_slots.sql` adds it to `bsaas_catalog` for à la carte purchase
- **Resolver**: `FeaturedOptionsService.resolveFeaturedOptionsState()` checks `flexible || !!features.featured_custom_badge_slots`
- **Admin override**: Admins can grant via `POST /api/admin/feature-purchases` with `source: 'admin_grant'`

See `.devin/skills/bsaas-purchase-flow.md` and `.devin/skills/add-bsaas-feature.md` for the full BSaaS architecture.

## Key Files

| File | Role |
|------|------|
| `apps/api/src/routes/badge-registry.ts` | CRUD endpoints for custom badges |
| `apps/api/src/services/BadgeRegistryService.ts` | `createTenantBadge`, `updateTenantBadge`, `deleteTenantBadge`, `getTenantCustomBadges`, `countTenantCustomBadges` |
| `apps/api/src/services/FeaturedOptionsService.ts` | Capability gate via `customBadgeSlotsEnabled` |
| `apps/web/src/hooks/useBadgeRegistry.ts` | React Query hooks for CRUD operations |
| `apps/web/src/app/t/[tenantId]/settings/products/badges/CustomBadgeManagerClient.tsx` | Badge manager UI (shows Feature Store + upgrade options when access denied) |
| `apps/web/src/services/BadgeRegistryService.ts` | Frontend service with badge metadata + color classes |
| `database/migrations/062_custom_badge_slots_capability.sql` | Seeds feature in `features_list` + tier features for Professional+ |
| `database/migrations/080_bsaas_custom_badge_slots.sql` | Adds feature to `bsaas_catalog` for à la carte purchase |

## Tips

- **Choose meaningful badge keys**: Keys are permanent identifiers. Use snake_case (e.g., `local_made`, `award_winner`).
- **Use colors consistently**: Assign colors that convey meaning (e.g., green for sustainability, red for clearance).
- **Keep descriptions clear**: Descriptions help your team understand why a badge exists and when to assign it.
- **Monitor performance**: Use the Analytics page to see which custom badges drive clicks and revenue. Remove badges that don't perform.
- **Check Suggestions regularly**: The Suggestions page shows products that match badge rules, helping you keep badges up-to-date without manual scanning.
