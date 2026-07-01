---
description: How to extend or maintain the organization-level product type awareness system (physical, digital, service, hybrid)
---

# Organization Product Type Awareness

Use this skill when modifying any org-level product type feature: dashboard visibility, propagation validation, commerce settings, admin audit views, or type-aware recommendations.

## Architecture Overview

The product type system has two layers:

1. **Tenant layer** (pre-existing): `ProductTypeService` at `apps/api/src/services/ProductTypeService.ts` resolves which product types a tenant can sell based on tier capabilities. Stored in `tenant_product_types_settings` table. Route: `GET/PUT /api/tenants/:tenantId/product-type`.

2. **Org layer** (retrofitted): Aggregates tenant-level data across all locations in an organization. Exposed via dedicated endpoints and surfaced on the org dashboard, admin pages, and propagation UI.

### Product Types

Four types are supported throughout the system:
- `physical` — tangible goods requiring shipping/pickup
- `digital` — downloadable or email-delivered products
- `service` — bookable services with appointment/booking flows
- `hybrid` — mixed fulfillment (partial physical + digital)

## Key Files

### Backend
- `apps/api/src/services/OrgProductTypeService.ts` — Aggregation service: `getProductTypeRollup()` and `getProductMix()` per org
- `apps/api/src/routes/organization-capabilities.ts` — `CAPABILITY_DOMAINS` array includes `'product_types'`; rollup endpoint resolves product type state per tenant
- `apps/api/src/routes/organizations.ts` — Propagation endpoints with product-type validation (skips mismatched types); admin `GET /product-type-summary` endpoint
- `apps/api/src/routes/organization-commerce-settings.ts` — Type-specific commerce settings (physical shipping, digital delivery, service cancellation, hybrid fulfillment split)
- `apps/api/prisma/schema.prisma` — `organization_commerce_settings` model includes type-specific fields

### Frontend
- `apps/web/src/services/OrgCapabilityService.ts` — `getProductTypeRollup()` and `getProductMix()` methods with caching
- `apps/web/src/hooks/organization/useOrgProductTypeRollup.ts` — React Query hook
- `apps/web/src/hooks/organization/useOrgProductMix.ts` — React Query hook
- `apps/web/src/components/organization/OrgProductMixCard.tsx` — Stacked bar + legend showing product type distribution
- `apps/web/src/components/organization/OrgProductTypeRollup.tsx` — Per-location capability state table
- `apps/web/src/components/organization/OrgLocationTable.tsx` — Per-location product type SKU badges
- `apps/web/src/components/organization/OrgPropagationPanel.tsx` — Product type filter checkboxes + sync skipped breakdown
- `apps/web/src/components/organization/OrgRecommendationsCard.tsx` — Type-aware recommendations
- `apps/web/src/components/organization/OrganizationDashboard.tsx` — Wires all components together
- `apps/web/src/app/(platform)/settings/organization/commerce/page.tsx` — Type-specific commerce settings UI
- `apps/web/src/app/(platform)/settings/admin/organizations/page.tsx` — Admin product type badges + filter

### Migrations
- `database/migrations/067_org_commerce_product_type_settings.sql` — Type-specific commerce columns

### Audit Document
- `docs/ORG_PRODUCT_TYPE_AWARENESS_AUDIT.md` — Full gap analysis and 6-phase implementation plan

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/organizations/:orgId/product-type-rollup` | Per-location product type capability state (enabled, allowedTypes, selectedTypes, isFlexible) |
| `GET /api/organizations/:orgId/product-mix` | SKU counts grouped by product_type across all locations |
| `GET /api/organizations/product-type-summary` | Admin: aggregates product type distribution across all orgs |
| `GET/PUT /api/organizations/:orgId/commerce-settings` | Type-specific commerce settings (physical_shipping_enabled, digital_delivery_method, service_cancellation_policy, hybrid_fulfillment_split) |

## Data Types

```typescript
// OrgCapabilityService.ts
interface OrgProductTypeRollup {
  totalLocations: number;
  locations: ProductTypeLocationState[];  // per-tenant: enabled, type, isFlexible, allowedTypes, selectedTypes
  summary: { enabledCount, disabledCount, typeDistribution, misalignedCount };
}

interface OrgProductMix {
  totalItems: number;
  mix: ProductMixEntry[];  // { productType, count, percentage }
  perLocation: Array<{ tenantId, tenantName, totalItems, mix }>;
}
```

## Implementation Patterns

### 1. Aggregation Pattern
Org-level product type data is aggregated from tenant-level data using `prisma.inventory_items.groupBy` on `product_type` filtered by `tenant_id IN (org tenant list)`. Results are cached with 5-minute TTL in the frontend singleton service.

### 2. Propagation Validation
When syncing products from hero to target locations, the backend checks each item's `product_type` against the target tenant's `ProductTypeState.allowedTypes`. Mismatched items are skipped with a reason in the response, not silently dropped. The frontend `OrgPropagationPanel` shows a `SyncSkippedBreakdown` with counts and example SKUs.

### 3. Commerce Settings Precedence
Org-level commerce settings serve as defaults. Tenant-level settings override org defaults. Type-specific fields (physical shipping, digital delivery, service cancellation, hybrid fulfillment) are optional — absent values fall back to sensible defaults at checkout.

### 4. Admin Audit View
The admin organizations page fetches `GET /api/organizations/product-type-summary` on load and displays product type badges on each org card. A filter dropdown allows filtering orgs by product type. Pagination is filter-aware (recomputes total pages from filtered list).

### 5. Type-Aware Recommendations
`OrgRecommendationsCard` accepts `productTypeRollup` and `productMix` data and generates contextual recommendations:
- Product type mismatch (hero has types that other locations don't support)
- Digital delivery not configured
- Service booking flow not configured
- Physical shipping rates not configured
- Product types disabled on locations that have products

Recommendations link to relevant dashboard tabs (locations, commerce) via `onNavigate`.

## Common Tasks

### Add a new product type
1. Add the type string to `ProductTypeService` allowed types
2. Add icon + color mapping in frontend components (`PRODUCT_TYPE_ICONS` in admin page, `OrgProductMixCard`, `OrgLocationTable`, `OrgRecommendationsCard`)
3. Add commerce settings field if the new type has specific commerce needs
4. Add migration for any new schema columns
5. Update `OrgProductTypeRollup` and `OrgProductMixCard` to handle the new type

### Add a new type-specific commerce setting
1. Add column to `organization_commerce_settings` via migration
2. Update Prisma schema model
3. Extend Zod schema in `organization-commerce-settings.ts` (optional field)
4. Update GET to return field with default, PUT to persist
5. Add collapsible UI section in commerce settings page

### Extend propagation filtering
1. Add filter param to sync endpoints in `organizations.ts`
2. Filter `heroItems` by product type before propagation loop
3. Return filtered count in response summary
4. Add UI control in `OrgPropagationPanel.tsx`

## What NOT to Do

- Do not call `ProductTypeService.resolveProductTypeState()` in a loop without caching — it does DB queries per tenant. The org rollup endpoint batches this.
- Do not add product type fields to `CAPABILITY_DOMAINS` without also updating the rollup resolver to handle the new domain.
- Do not silently skip items during propagation without returning skip reasons — the UI depends on showing the breakdown.
- Do not create separate admin route files for org-level product type endpoints — mount them on the existing `organizations.ts` router.
