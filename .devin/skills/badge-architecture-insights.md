# Badge Architecture Insights — 10x Patterns and Lessons

## The Journey: From Decorative Labels to Behavioral Intelligence

This document captures the architectural insights, patterns, and hard-won lessons from implementing the Meaningful Featured Product Badges system across 6 phases. It is designed to help future developers understand not just *what* was built, but *why* each decision mattered and *how* the patterns generalize to other domains.

---

## Anti-Pattern: The Hardcoded Metadata Explosion

### The Problem

The platform had 11 badge types hardcoded as arrays, switch statements, and record literals across 12+ files in both frontend and backend. The `featured_products` table itself was flexible (varchar `featured_type` accepts any key), but everything around it was rigid:

- Display cards had switch statements mapping types to colors/icons
- Storefront sections had hardcoded bucket definitions
- Capability resolvers had hardcoded type lists
- The materialized view had hardcoded WHERE clauses
- Bot search had hardcoded badge filters
- Adding a new badge type required touching every layer

### The Cost

Every new badge type was a multi-file, multi-layer code change. Custom merchant badges were impossible — you can't let a merchant insert a row into a hardcoded array. The architecture actively prevented the product from evolving.

### The Fix: Data-Driven Registry

A single `featured_type_registry` table + cached `BadgeRegistryService` replaced every hardcoded array. Adding a badge type became a data operation (INSERT a row), not a code change. The registry holds all metadata: key, label, description, icon, color, priority, sort order, group, rules, conflicts.

### The Generalizable Insight

**Any time you have entity type metadata hardcoded as arrays or switch statements across 3+ files, you have a registry waiting to be born.** The pattern is:

1. Identify the metadata that varies (labels, colors, icons, priorities)
2. Create a DB table to store it
3. Build a cached service with static fallback
4. Replace all hardcoded references with registry lookups
5. New types become data operations, not code changes

This same pattern was applied to `capability_features_list`, `navigation_links`, and `CapabilityConstraintService`. The badge registry is the most complete expression of it.

---

## Pattern: Two-Concern Separation

### The Insight

Badge architecture has two independent concerns that were previously entangled:

1. **Definition** — "what badges exist?" (metadata: label, icon, color, rules)
2. **Assignment** — "which products have which badges?" (data: product_id, badge_type, priority)

These evolve on different timelines. Definitions change rarely (new badge type added quarterly). Assignments change constantly (products tagged/untagged daily). Entangling them means every assignment query joins against metadata, and every metadata change risks breaking assignments.

### The Implementation

- `featured_type_registry` = definitions (one row per badge type, tenant-scoped or system)
- `featured_products` = assignments (one row per product-badge pair)
- The only link is the `featured_type` varchar column — assignments reference definitions by key, not by foreign key

### Why This Matters

This separation means:
- You can add a badge definition without touching any assignment code
- You can reassign badges without loading definitions
- Display surfaces read definitions once (cached), then render assignments
- Custom badges (Phase 3) required **zero new tables** — they're just registry rows with a `tenant_id`

---

## Pattern: Unified Assignment Table with Provenance

### The Insight

Before this work, platform-controlled badges (trending, bestseller) were computed on-the-fly from materialized view columns. Tenant-controlled badges were in `featured_products`. This created two code paths for everything: display, filtering, analytics, bot search.

### The Fix

**All badges write to `featured_products`.** The `assignment_source` column distinguishes provenance:
- `manual` — merchant tagged the product via UI
- `auto` — rule engine evaluated and assigned based on declarative rules
- `system` — platform algorithm (trending, bestseller) wrote the assignment

A background job (`platform-badge-sync.ts`) runs every 6 hours, computing trending/bestseller/recommended and writing them to `featured_products` with `assignment_source = 'system'`.

### The 10x Effect

After unification:
- **One query pattern** for all badge lookups (no more `IF platform_type THEN query MV ELSE query featured_products`)
- **Analytics** can group by `featured_type` across all sources in one query
- **Discovery** can sort by badge priority regardless of source
- **GMC feed** maps badges to custom labels from one table
- **Bot search** filters by badge from one table
- **Recommendations** boost by badge from one table

Every downstream consumer became simpler. This is the single highest-leverage decision in the entire design.

---

## Pattern: Declarative Rules as Data

### The Insight

Badge auto-assignment rules (e.g., "assign `sale` if `sale_price_cents < price_cents`") were previously implicit — encoded in application logic or not enforced at all. A merchant could tag a product as "Sale" without a sale price, eroding customer trust.

### The Implementation

Rules are stored as JSONB in the registry:
```json
{
  "condition": "and",
  "rules": [
    { "field": "sale_price_cents", "op": "isNotNull" },
    { "field": "sale_price_cents", "op": "lt", "fieldRef": "price_cents" }
  ]
}
```

The `BadgeRuleEngine` evaluates these against product data. Supported operators: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `isNull`, `isNotNull`. Special value formats: `{ daysAgo: N }` for time-relative rules, `fieldRef` for cross-field comparisons, `factor` for proportional comparisons.

### The 10x Effect

- **New rules don't require deployment** — update the JSONB, invalidate the cache
- **Rules are auditable** — they're data, visible in the database, not hidden in code
- **Rules are tenant-customizable** — custom badges can have rules too (via API)
- **Conflict detection is declarative** — `conflictWith` array on the registry entry, checked by the rule engine before assignment
- **Auto-promotion suggestions** are a natural byproduct — just run `evaluateBadgeRulesForTenant()` and show the results

### The Generalizable Insight

**When business rules are encoded as data instead of code, every downstream capability becomes a query, not a feature build.** Auto-promotion suggestions, conflict detection, analytics grouping, and validation all become different views of the same data.

---

## Pattern: Registry-Driven Display

### The Insight

Before the registry, every display surface (product cards, storefront sections, filter UI, admin pages) had hardcoded badge type lists. Changing a badge color required editing multiple components. Adding a badge type required updating every component.

### The Fix

All display surfaces read badge metadata from a single registry API. The frontend `BadgeRegistryService` (singleton with 60s cache + static fallback) provides:
- `useSystemBadges()` — React Query hook for system badges
- `useTenantBadges(tenantId)` — system + custom badges for a tenant
- `useBadgeMeta(badgeKey)` — single badge metadata lookup
- `useBadgeColorClass(badgeKey)` — CSS class string for a badge

No component has badge types hardcoded. The `SmartProductCard` renders badges from the registry. The storefront sections read bucket definitions from the registry. The filter UI generates options from the registry.

### The 10x Effect

- Adding a custom badge → it appears everywhere instantly (cards, filters, sections, bot, search)
- Changing a badge color → one DB update, cache invalidation, all surfaces update
- The same registry feeds frontend display, backend validation, bot search, and GMC feed mapping

---

## Pattern: Behavioral Integration Through Composition, Not Coupling

### The Insight

Phase 5 integrated badges into 5 separate platform systems: discovery sorting, GMC feed mapping, bot NL queries, auto-promotion suggestions, and recommendation engine. The temptation is to build badge awareness deeply into each system. The right approach is to compose lightly.

### The Implementation

Each integration reads badge data from the same sources (`featured_products`, `featured_type_registry`) and adds a thin badge-aware layer:

| System | Integration | Lines Changed |
|--------|-------------|---------------|
| DiscoveryService | `badgeWeighted` flag + `applyBadgeWeightedSort()` | ~20 |
| GMCProductSync | Map `featured_type_array` → `customLabel0-4` | ~15 |
| BotProductCatalogService | `detectBadgeIntent()` + `handleBadgeQuery()` | ~50 |
| RecommendationService | `getUserBadgePreferences()` + `applyBadgeBoost()` | ~80 |
| Auto-promotion | API endpoint + frontend service + UI | ~200 |

No system was refactored. No system has deep knowledge of badge internals. Each reads the badge type array and applies its own domain logic (sorting, mapping, intent detection, scoring).

### The Generalizable Insight

**Behavioral integration is a thin layer, not a deep refactor.** If your registry and assignment table are well-designed, every downstream system can become badge-aware with <100 lines of code. The registry is the coupling point; everything else is composition.

---

## Insight: The `featured` Badge Is a Product Class, Not Just a Label

### The Insight

A badge with tenant-level admin approval, product-level admin approval, and a dedicated approval queue is not just a badge — it's a **product class**. A product tagged with this badge must receive special visibility, premium real estate on public pages, and cross-tenant storefront surfacing. The approval workflow exists because the platform is curating premium placement, not just decorating a product card.

### What the Codebase Shows

The `featured` type already has distinct treatment across multiple surfaces:

| Surface | Treatment | File |
|---------|-----------|------|
| Storefront spotlight | Hero asymmetric 2-column layout, first 3 products from first bucket, large image cards with overlay text | `StorefrontEditorialLayout.tsx:458-550` |
| Featured sections | Crown icon, "Premium Featured" label, indigo coloring — visually distinct from all other badge types | `StorefrontFeaturedProducts.tsx:248-258` |
| Cross-tenant shops page | "Featured Products" section surfaces featured products across all shops | `ShopsPageClient.tsx:1074-1090` |
| Cross-tenant directory | `bucket_type` column on `featured_products` explicitly supports directory context for cross-tenant visibility | `schema.prisma:1536-1537` |
| Admin approval queue | Dedicated "Featured Approval" tab with tenant and product approval workflows | `featured-products/page.tsx` |
| Tenant access gating | `hasFeaturedAccess` prop disables the "Add to Featured" button with "Approval Required" state | `FeaturedProductsManager.tsx:467,594,1154` |

### The Deeper Insight

**The approval workflow is a curation signal, not a permission gate.** When admin approval is required for a badge type, the platform is saying: "Products with this badge get premium real estate, so we need to verify quality before granting it." The badge is not just metadata — it's a **placement contract** that obligates the platform to:

1. **Give it premium visual real estate** — spotlight sections, hero cards, distinct iconography
2. **Surface it across tenant boundaries** — directory pages, cross-tenant shops pages, platform-wide discovery
3. **Gate access at two levels** — tenant-level (is this merchant approved?) and product-level (is this specific product approved?)
4. **Track its performance separately** — analytics should measure whether the premium placement is driving outcomes

### The Alignment Opportunity

The current implementation hardcodes `type.id === 'featured'` for all of these checks. The audit (`docs/FEATURED_TYPE_AUDIT.md`) recommends adding `requires_tenant_access` and `requires_admin_approval` columns to `featured_type_registry`, making the curation contract data-driven. This would allow any future badge type to declare "I am a premium placement" through registry configuration rather than code changes.

### The Generalizable Insight

**When a badge type has an approval workflow, it signals a product class with placement obligations.** The badge is not just a label — it's a contract between the platform and the customer that this product deserves special attention. The architecture should treat badge types with approval requirements as a distinct category that triggers premium placement, cross-tenant surfacing, and dedicated analytics — all driven by registry flags, not hardcoded type checks.

---

## Insight: Badges Need Behavioral Weight

### The Problem

Decorative badges erode customer trust. When a "Sale" badge appears on a product with no sale price, or "New Arrival" on a year-old product, customers learn to ignore badges. The badge becomes noise.

### The Fix

Three mechanisms enforce behavioral weight:

1. **Declarative rules** — auto-assign/auto-remove rules in the registry ensure badges are assigned based on verifiable product data
2. **Auto-promotion suggestions** — the Suggestions page surfaces products that should have badges but don't, and products that have badges but shouldn't
3. **Analytics** — the Analytics page shows CTR, conversion rate, and revenue lift per badge. Badges that don't perform become visible to the merchant

### The Deeper Insight

**Trust is the product.** Every badge is a promise to the customer. The system's job is to keep that promise — automatically when possible, with merchant visibility when not. The analytics close the loop: if a badge isn't driving outcomes, the merchant sees it and can remove it.

---

## Insight: Custom Badges Are Registry Entries, Not a Separate System

### The Insight

If the registry is built correctly, custom badges require:
- **Zero new tables** — they're rows in `featured_type_registry` with a `tenant_id`
- **Zero new display code** — all display surfaces read from the registry
- **Zero new API patterns** — same CRUD endpoints, just tenant-scoped
- **One new capability key** — `featured_custom_badge_slots` gates access by tier

The only custom-badge-specific code is:
- Slot limit enforcement (max 10 per tenant)
- Tier gate check (`customBadgeSlotsEnabled`)
- Key uniqueness validation (per-tenant, not global)

### The 10x Effect

The entire custom badge feature (Phase 3) was the smallest phase by code volume because the registry foundation made it a data operation. This is the payoff of investing in the registry first.

---

## Insight: Analytics Close the Loop

### The Problem

Without analytics, badges are a one-way assertion — the merchant says "this product is on sale" but never learns if the badge drove any behavior. There's no feedback loop.

### The Implementation

- `badge_events` table logs individual storefront interactions (view, click, add_to_cart, purchase)
- `badge_analytics` table stores aggregated metrics per badge per period (day/week/month)
- Aggregation job runs every 6 hours, computing CTR, conversion rate, revenue lift, and trend
- ROI report compares badged vs non-badged product performance
- Frontend dashboard shows per-badge performance with time series drill-down

### The 10x Effect

The analytics loop transforms badges from a merchant assertion into a measurable experiment. Merchants can:
- See which badges drive clicks vs which are ignored
- Compare revenue lift across badge types
- Track trends over time (is "New Arrival" losing effectiveness?)
- Make data-driven decisions about which badges to keep, remove, or add

---

## Pattern: Tenant-Scoped IDs for Multi-Tenant Safety

### The Insight

In a multi-tenant platform, using global auto-increment IDs for tenant-scoped entities creates security risks — a tenant could infer the total number of entities across all tenants by observing ID gaps.

### The Implementation

All badge analytics entities use tenant-scoped IDs via `id-generator.ts`:
- `generateBadgeAnalyticsId(tenantKey)` → `bdga-{tk}-{nanoid}`
- `generateBadgeEventId(tenantKey)` → `bdge-{tk}-{nanoid}`

The tenant key is derived from the tenant's subdomain, ensuring IDs are traceable to a tenant without being sequential.

### The Generalizable Insight

**Every tenant-scoped entity should have a tenant-scoped ID format.** This pattern is already used across the platform (orders, CRM tickets, bot conversations). The badge analytics implementation followed the established convention, ensuring consistency.

---

## Pattern: Singleton Service Architecture (Frontend)

### The Insight

Frontend services in this platform use a specific singleton pattern that provides automatic auth, caching, cache invalidation, and tenant context. Following this pattern ensures new services integrate seamlessly with the existing infrastructure.

### The Implementation

Every badge-related frontend service extends `TenantApiSingleton`:
- Private constructor calling `super('singleton-key', { ttl: ... })`
- Static `getInstance()` method for singleton access
- `getServiceCachePatterns()` declares cache key patterns for invalidation
- `invalidateServiceCaches(tenantId?)` provides manual cache invalidation
- `makeDefaultRequest()` handles auth headers, tenant context, and caching automatically

### The Services

| Service | Singleton Key | Cache TTL |
|---------|---------------|-----------|
| `BadgeRegistryService` | `badge-registry-singleton` | 60s |
| `BadgeAnalyticsService` | `badge-analytics-singleton` | 5min |
| `BadgeSuggestionsService` | `badge-suggestions-singleton` | 1min |

### The 10x Effect

New services get auth, caching, invalidation, and tenant isolation for free. The only code you write is the actual business logic (fetch + transform). This pattern should be followed for every new tenant-scoped frontend service.

---

## Architecture Phase Map

| Phase | What Was Built | Key Insight |
|-------|---------------|-------------|
| 0 — Registry | `featured_type_registry` table, `BadgeRegistryService`, static fallback, platform badge sync job | Data-driven registry replaces 12+ hardcoded arrays. Foundation for everything. |
| 1 — Semantic Rules | `BadgeRuleEngine`, declarative JSONB rules, conflict detection, auto-assign/remove | Rules as data, not code. New rules don't require deployment. |
| 2 — Customer Filtering | Storefront filter UI, badge-aware search, badge-filtered product grids | Badges power navigation, not just display. |
| 3 — Custom Badges | Tenant CRUD, tier gating, slot limits, `CustomBadgeManagerClient` UI | Custom badges are registry rows, not a separate system. Zero new tables. |
| 4 — Analytics | `badge_analytics` + `badge_events` tables, aggregation job, ROI report, dashboard | Analytics close the trust loop. Badges become measurable experiments. |
| 5 — Behavioral Integration | Badge-weighted sort, GMC custom labels, bot NL queries, recommendations, auto-promotion | Integration is a thin layer. Each system became badge-aware with <100 lines. |
| 6 — Skill Documents | `meaningful-badge-architecture.md`, `custom-badge-creation-guide.md`, this document | Capture insights while they're fresh. Patterns generalize to other domains. |

---

## Checklist: Am I Following the Badge Architecture?

1. **Does the change touch more than 2 files?** If so, it should go through the registry, not hardcoded
2. **Is the new badge type stored in `featured_type_registry`?** If not, it won't appear in display surfaces
3. **Does the badge have a semantic rule?** If not, it's decorative — is that intentional?
4. **Does the badge assignment write to `featured_products`?** If not, it bypasses the MV aggregation
5. **Does the badge have analytics tracking?** If not, add `badge_key` to event tracking calls
6. **Does the badge flow through to GMC custom labels?** If adding a new badge, verify `convertToGoogleProduct` handles it
7. **Does the badge appear in bot search?** If adding a new badge, verify `detectBadgeIntent` handles it
8. **Does the badge affect recommendations?** If adding a new badge, verify `getUserBadgePreferences` picks it up
9. **Is the badge discoverable?** Can the merchant find it from the featured options page, the badges page, and the suggestions page?
10. **Is the badge tier-gated correctly?** Custom badges require `customBadgeSlotsEnabled`; system badges are available to all

---

## Patterns That Generalize Beyond Badges

These patterns are not badge-specific. They apply to any entity type system in a multi-tenant SaaS:

1. **Registry pattern** — any entity with metadata hardcoded across multiple files (product types, capability keys, navigation links, storefront sections)
2. **Two-concern separation** — separate "what exists" from "what's assigned" for any entity with definitions + assignments
3. **Unified assignment with provenance** — any system with multiple assignment sources (manual, auto, system) should use one table with a source column
4. **Declarative rules as data** — any business rule that varies by entity type or tenant should be JSONB in the registry, not code
5. **Behavioral integration through composition** — downstream systems should read from the registry and apply thin domain-specific logic, not deep coupling
6. **Analytics close the loop** — any merchant-facing feature should have analytics that show whether it's driving outcomes
7. **Tenant-scoped IDs** — every tenant-scoped entity should have a tenant-scoped ID format
8. **Singleton service pattern** — every frontend tenant-scoped service should extend `TenantApiSingleton`

---

## Related Documents

- `docs/FEATURED_TYPES_MEANINGFUL_BADGES_DESIGN.md` — the original design document with full phase specs
- `.devin/skills/meaningful-badge-architecture.md` — technical architecture reference (components, schema, file map)
- `.devin/skills/custom-badge-creation-guide.md` — merchant user guide for custom badge CRUD
