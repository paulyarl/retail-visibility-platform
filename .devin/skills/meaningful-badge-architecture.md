# Meaningful Badge Architecture

## Overview

The Meaningful Badge system replaces hardcoded `featured_type` arrays with a data-driven badge registry, declarative rule engine, and behavioral integration across discovery, search, feeds, and recommendations. Badges are assertions about products, not decorations — every badge should assert something verifiable.

## Architecture Principles

1. **Badges are assertions, not decorations** — every badge asserts something verifiable about the product
2. **Auto-assign when possible, manual when intentional** — data-driven badges auto-assign via rules; curation badges stay manual
3. **One registry, one assignment table** — definitions in `featured_type_registry`, assignments in `featured_products`. No separate tables per badge category
4. **Data-driven, not code-driven** — adding a badge type is a data operation (DB row), not a code change across 12+ files
5. **All assignment surfaces write to the same table** — auto-assign jobs, manual UI, platform algorithms, and wizard suggestions all write to `featured_products` with `assignment_source` distinguishing provenance
6. **Registry-driven display** — all display surfaces read badge metadata from a single registry API. No component has badge types hardcoded
7. **Badges power navigation, not just display** — filtering, sorting, search, feeds, and recommendations respect badges

## Core Components

### Badge Registry (`BadgeRegistryService.ts`)
- Single source of truth for all badge type definitions
- Loads from `featured_type_registry` DB table with 60s in-memory cache
- Falls back to static seed data (`STATIC_BADGE_TYPES`) if DB table is not populated
- Pattern mirrors `CapabilityConstraintService`: DB-driven + cached + static fallback
- System badges (`tenant_id = NULL`) vs tenant custom badges (`tenant_id = <tid>`)
- Each badge has: `key`, `label`, `description`, `group` (tenant/platform), `icon`, `color`, `priority`, `sortOrder`, `autoAssignRule` (JSONB), `autoRemoveRule` (JSONB), `conflictWith` (string[])

### Badge Rule Engine (`BadgeRuleEngine.ts`)
- Evaluates declarative `auto_assign_rule` and `auto_remove_rule` JSONB from the registry against product data
- Rule format: `{ condition: "and"|"or"|"manual", rules: [{ field, op, value?, fieldRef?, factor? }] }`
- Supported operators: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `isNull`, `isNotNull`
- Special value formats: `{ daysAgo: N }` (computed as now - N days), `fieldRef` (compares against another field), `factor` (multiplies fieldRef)
- `evaluateBadgeRulesForTenant()` returns `{ toAssign, toRemove, conflicts }` — used by auto-promotion suggestions API
- Conflict detection via `conflictWith` array on registry entries

### Badge Analytics (`BadgeAnalyticsService.ts`)
- Tracks badge performance metrics: views, clicks, add-to-cart, orders, revenue
- `badge_analytics` table stores aggregated metrics per badge per period (day/week/month)
- `badge_events` table logs individual storefront events (view, click, add_to_cart, purchase)
- Aggregation job (`badge-analytics-sync.ts`) runs every 6 hours
- ROI report compares badged vs non-badged product performance
- Frontend dashboard at `/t/[tenantId]/settings/products/badges/analytics`

### Discovery Service Integration (`DiscoveryService.ts`)
- `badgeWeighted` option on `DiscoveryQuery` enables badge-weighted re-sorting
- `applyBadgeWeightedSort()` boosts products with active badges and higher `featured_priority`
- Stable sort preserves original order for equal scores
- Cache key includes `badgeWeighted` flag to avoid cache collisions

### GMC Feed Mapping (`GMCProductSync.ts`)
- Badge types mapped to Google Merchant Center `customLabel0` through `customLabel4`
- `convertToGoogleProduct()` reads `featured_type_array` from item and assigns up to 5 custom labels
- Both `syncProduct()` and `batchSyncProducts()` fetch active badge assignments from `featured_products` before mapping
- Enables badge-based filtering and reporting in Google Shopping campaigns

### Bot Natural Language Queries (`BotProductCatalogService.ts`)
- `detectBadgeIntent()` maps natural language phrases to `ProductBadge` types
- Patterns: "what's on sale?" → `sale`, "show me new arrivals" → `new_arrival`, "any clearance items?" → `clearance`, etc.
- `handleBadgeQuery()` detects intent and fetches matching products via `getProductsByBadge()`
- Returns `{ badge, products }` or `null` if no badge intent detected

### Recommendation Engine Integration (`recommendationService.ts`)
- `getUserBadgePreferences()` analyzes user viewing history and returns badge type → preference score (0-1)
- `applyBadgeBoost()` applies score boost to recommendations matching user's badge preferences
- `featuredTypeArray` field on `Recommendation` interface carries badge data through the pipeline
- Boost weight is configurable (default: 5 points per matched preference)

### Auto-Promotion Suggestions
- Backend: `GET /api/tenants/:tenantId/badge-suggestions` endpoint in `badge-registry.ts` routes
- Returns `{ toAssign, toRemove, conflicts, summary }` from `evaluateBadgeRulesForTenant()`
- Frontend: `BadgeSuggestionsService.ts` (singleton extending `TenantApiSingleton`)
- UI: `/t/[tenantId]/settings/products/badges/suggestions` — summary cards, assign/remove tables, conflict warnings
- Linked from main badges page alongside analytics

## Database Schema

### `featured_type_registry`
- Badge definitions: `id`, `tenant_id` (NULL = system), `key`, `label`, `description`, `group_type`, `icon`, `color`, `priority`, `sort_order`, `is_system`, `is_active`, `auto_assign_rule` (JSONB), `auto_remove_rule` (JSONB), `conflict_with` (text[])
- Seeded by migration `060_featured_type_registry.sql`

### `featured_products`
- Badge assignments: `id`, `inventory_item_id`, `tenant_id`, `featured_type`, `featured_priority`, `featured_at`, `featured_expires_at`, `auto_unfeature`, `is_active`, `bucket_type`, `assignment_source` (manual/auto/system), `rule_evaluated_at`
- Unique constraint on `[inventory_item_id, featured_type]`

### `badge_analytics`
- Aggregated metrics: `id`, `tenant_id`, `badge_key`, `period_type`, `period_start`, `period_end`, `views`, `clicks`, `add_to_cart_count`, `order_count`, `units_sold`, `revenue_cents`, `ctr`, `conversion_rate`, `avg_order_value_cents`, `revenue_lift`, `product_count`
- Migration: `064_badge_analytics.sql`

### `badge_events`
- Event log: `id`, `tenant_id`, `badge_key`, `inventory_item_id`, `event_type`, `session_id`, `user_id`, `metadata` (JSONB)
- Migration: `064_badge_analytics.sql`

## Key Patterns

- **Two-Concern Separation**: "what badges exist" (registry) vs "which products have which badges" (assignment table) evolve independently
- **Data-driven badge registry**: single table + cached service replaces all hardcoded arrays. Adding a badge type = data operation, not code change
- **Unified assignment table**: all sources (auto, manual, system) write to `featured_products`. `assignment_source` column distinguishes provenance
- **Declarative badge rules**: auto-assign/auto-remove rules as JSONB, evaluated by rule engine. New rules don't require deployment
- **Tenant-scoped IDs**: all badge analytics entities use tenant-scoped IDs (e.g., `bdga-{tk}-{nanoid}`) via `id-generator.ts`
- **Singleton service pattern**: frontend services extend `TenantApiSingleton` with private constructor + `getInstance()` + cache patterns

## File Reference

| File | Role |
|------|------|
| `apps/api/src/services/BadgeRegistryService.ts` | Badge definition registry with cache + fallback |
| `apps/api/src/services/BadgeRuleEngine.ts` | Declarative rule evaluation engine |
| `apps/api/src/services/BadgeAnalyticsService.ts` | Badge performance tracking and aggregation |
| `apps/api/src/services/DiscoveryService.ts` | Badge-weighted product discovery sorting |
| `apps/api/src/services/GMCProductSync.ts` | GMC feed custom label mapping from badges |
| `apps/api/src/services/BotProductCatalogService.ts` | Bot NL badge intent detection |
| `apps/api/src/services/recommendationService.ts` | Badge preference tracking and recommendation boosting |
| `apps/api/src/routes/badge-registry.ts` | Badge CRUD + suggestions API endpoints |
| `apps/api/src/routes/badge-analytics.ts` | Badge analytics API endpoints |
| `apps/api/src/jobs/badge-analytics-sync.ts` | Aggregation job (runs every 6h) |
| `apps/api/src/lib/id-generator.ts` | Tenant-scoped ID generators for badge entities |
| `apps/web/src/services/BadgeAnalyticsService.ts` | Frontend analytics service (singleton) |
| `apps/web/src/services/BadgeSuggestionsService.ts` | Frontend suggestions service (singleton) |
| `apps/web/src/app/t/[tenantId]/settings/products/badges/` | Badge management UI (custom badges, analytics, suggestions) |
| `database/migrations/060_featured_type_registry.sql` | Registry seed data |
| `database/migrations/064_badge_analytics.sql` | Analytics + events tables |

## Checklist for Future Badge Work

- Does the change touch more than 2 files? If so, it should go through the registry, not hardcoded
- Is the new badge type stored in `featured_type_registry`? If not, it won't appear in display surfaces
- Does the badge have a semantic rule? If not, it's decorative — is that intentional?
- Does the badge assignment write to `featured_products`? If not, it bypasses the MV aggregation
- Does the badge have analytics tracking? If not, add `badge_key` to event tracking calls
- Does the badge flow through to GMC custom labels? If adding a new badge, verify `convertToGoogleProduct` handles it

## Related Patterns in the Codebase

- `CapabilityConstraintService.ts` — same cache + DB-driven + static fallback pattern
- `capability_features_list` — same registry pattern for capability definitions
- `navigation_links` table — same data-driven vs hardcoded evolution
