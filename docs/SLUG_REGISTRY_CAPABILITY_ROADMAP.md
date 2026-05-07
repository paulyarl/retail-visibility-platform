# Product Slug Registry V2 - Capability Roadmap

> The slug registry V2 architecture with normalized brands, categories, and structured components enables new platform capabilities previously impossible or impractical.

---

## Phase 1: Foundation (Q1 2026) - In Progress

### 1.1 Admin Management UI ✅ COMPLETE
- **Slug Registry Admin** - CRUD operations, parsing, comparison tools
- **Universal Product Catalog** - Browse, search, approve, merge duplicates
- **Inventory Transfers** - Cross-location transfer management
- **Platform Inventory Dashboard** - Cross-tenant visibility

### 1.2 API Infrastructure ✅ COMPLETE
- Admin API routes for slug registry, catalog, inventory stats
- Singleton services with automated caching
- Platform admin authorization middleware

---

## Phase 2: Product Intelligence (Q2 2026) - HIGH PRIORITY

### 2.1 Cross-Tenant Product Matching
**Capability:** Identify identical/similar products across tenants using `compare_registry_products()`

**Use Cases:**
- "Find this product nearby" shopper feature
- Duplicate catalog detection and merge recommendations
- Competitive inventory comparison for merchants

**Implementation:**
```
Priority: HIGH
Effort: 2-3 weeks
Dependencies: Slug registry V2 complete
Files: 
  - apps/api/src/services/ProductMatchingService.ts
  - apps/api/src/routes/product-matching.ts
  - apps/web/src/services/ProductMatchingService.ts
```

### 2.2 Brand & Category Analytics
**Capability:** Platform-wide brand/category performance tracking via `brand_normalized` and `category_normalized`

**Use Cases:**
- Brand performance dashboards for platform admins
- Category trend analysis
- Brand affinity mapping across demographics

**Implementation:**
```
Priority: HIGH
Effort: 2 weeks
Dependencies: Slug registry V2 complete
Files:
  - apps/api/src/routes/admin/brand-analytics.ts
  - apps/api/src/routes/admin/category-analytics.ts
  - apps/web/src/app/(platform)/settings/admin/brand-analytics/page.tsx
```

### 2.3 Product Recommendation Engine
**Capability:** Cross-tenant collaborative filtering and category-based recommendations

**Use Cases:**
- "Shoppers at similar stores also bought..."
- Category-based recommendations with brand affinity fallback
- Local popularity ranking by geographic region

**Implementation:**
```
Priority: HIGH
Effort: 3-4 weeks
Dependencies: Product matching, Brand analytics
Files:
  - apps/api/src/services/RecommendationEngine.ts
  - apps/api/src/routes/recommendations.ts
  - apps/web/src/services/RecommendationService.ts
```

---

## Phase 3: Inventory Intelligence (Q2-Q3 2026) - MEDIUM PRIORITY

### 3.1 Smart Transfer Suggestions
**Capability:** Auto-detect stock imbalances across locations for same product

**Use Cases:**
- Predictive transfer recommendations
- Cross-tenant inventory pooling for low-stock items
- Demand-based redistribution suggestions

**Implementation:**
```
Priority: MEDIUM
Effort: 2-3 weeks
Dependencies: Product matching, Inventory transfers API
Files:
  - apps/api/src/services/TransferSuggestionEngine.ts
  - apps/api/src/routes/admin/transfer-suggestions.ts
```

### 3.2 Demand Signal Aggregation
**Capability:** Aggregate demand by `universal_sku` across platform

**Use Cases:**
- Identify emerging products before national trends
- Seasonal demand forecasting by category/region
- Demand spike alerts for merchants

**Implementation:**
```
Priority: MEDIUM
Effort: 3 weeks
Dependencies: Product matching, Inventory stats
Files:
  - apps/api/src/services/DemandAggregationService.ts
  - apps/api/src/routes/admin/demand-signals.ts
```

### 3.3 Supply Chain Visibility
**Capability:** Track product journey from UPC source to LPC adoption

**Use Cases:**
- Supply chain bottleneck identification by brand/category
- Vendor performance analytics
- Product provenance tracking

**Implementation:**
```
Priority: MEDIUM
Effort: 2-3 weeks
Dependencies: Slug registry audit trail
Files:
  - apps/api/src/routes/admin/supply-chain.ts
  - apps/web/src/app/(platform)/settings/admin/supply-chain/page.tsx
```

---

## Phase 4: Tenant Intelligence & Local Retail (Q3 2026) - MEDIUM PRIORITY

### 4.1 Tenant Product Intelligence Dashboard ⭐ NEW
**Capability:** Merchant-facing dashboard for product performance, competitive positioning, and growth opportunities

**Location:** `/t/[tenantId]/intelligence`

**Sections:**
- **Product Performance** - Top products by views/sales/velocity, slow-moving alerts, turnover rates
- **Competitive Positioning** - Compare to similar stores, category coverage vs peers, unique vs common products
- **Growth Opportunities** - Trending products you don't carry, category gaps, brand suggestions
- **Inventory Intelligence** - Cross-location imbalances, transfer suggestions, reorder recommendations
- **Brand & Category Insights** - Your top brands, category health scores, customer affinity patterns

**Implementation:**
```
Priority: HIGH (Tenant-facing)
Effort: 3 weeks
Dependencies: Product matching, Brand analytics, Inventory stats
Files:
  - apps/api/src/routes/tenant-intelligence.ts
  - apps/api/src/services/TenantIntelligenceService.ts
  - apps/web/src/services/TenantIntelligenceService.ts
  - apps/web/src/app/(platform)/t/[tenantId]/intelligence/page.tsx
  - apps/web/src/app/(platform)/t/[tenantId]/intelligence/ProductPerformanceTab.tsx
  - apps/web/src/app/(platform)/t/[tenantId]/intelligence/CompetitivePositionTab.tsx
  - apps/web/src/app/(platform)/t/[tenantId]/intelligence/GrowthOpportunitiesTab.tsx
  - apps/web/src/app/(platform)/t/[tenantId]/intelligence/InventoryIntelligenceTab.tsx
  - apps/web/src/app/(platform)/t/[tenantId]/intelligence/BrandCategoryInsightsTab.tsx
```

### 4.2 Competitive Intelligence API
**Capability:** Backend API for comparing merchant inventory against similar stores

**Use Cases:**
- "How does my inventory compare to similar stores?"
- Category gap analysis (missing products peers carry)
- Pricing benchmarking by product across tenants

**Implementation:**
```
Priority: MEDIUM
Effort: 2 weeks
Dependencies: Product matching, Brand analytics
Files:
  - apps/api/src/routes/competitive-intelligence.ts
  - apps/api/src/services/CompetitiveIntelligenceService.ts
```

### 4.3 Local Product Discovery
**Capability:** Geographic product availability for shopper-facing features

**Use Cases:**
- "Available near you" shopper feature
- Geographic product availability heat maps
- Regional product preference insights

**Implementation:**
```
Priority: MEDIUM
Effort: 2-3 weeks
Dependencies: Product matching, Location services
Files:
  - apps/api/src/routes/local-discovery.ts
  - apps/web/src/services/LocalDiscoveryService.ts
```

---

## Phase 5: Shopper-Facing Product Page Intelligence (Q3-Q4 2026) - HIGH IMPACT

### 5.1 "Available Nearby" Widget ⭐
**Capability:** Show shoppers which nearby stores carry the same product

**Location:** Product detail pages, search results

**Features:**
- "Find this product nearby" button
- Map view of stores with stock
- Distance and availability indicators
- Click to view store inventory

**Implementation:**
```
Priority: HIGH (Shopper-facing)
Effort: 1.5 weeks
Dependencies: Product matching, Local discovery
Files:
  - apps/api/src/routes/product-availability-nearby.ts
  - apps/web/src/components/product/AvailableNearbyWidget.tsx
  - apps/web/src/components/product/StoreAvailabilityMap.tsx
```

### 5.2 "Similar Products" Recommendations
**Capability:** Show shoppers similar/related products on product pages

**Location:** Product detail pages, cart

**Features:**
- "Customers also viewed" carousel
- "Similar products in this category"
- Brand alternatives
- Price range alternatives

**Implementation:**
```
Priority: HIGH (Shopper-facing)
Effort: 2 weeks
Dependencies: Product matching, Recommendation engine
Files:
  - apps/api/src/routes/product-recommendations.ts
  - apps/web/src/components/product/SimilarProductsCarousel.tsx
  - apps/web/src/components/product/RelatedProducts.tsx
```

### 5.3 Product Trend Indicators
**Capability:** Show popularity signals on product pages

**Location:** Product cards, product detail pages

**Features:**
- "Trending" badge for hot products
- "Popular in your area" indicator
- View count / popularity score
- "Recently purchased" social proof

**Implementation:**
```
Priority: MEDIUM (Shopper-facing)
Effort: 1 week
Dependencies: Demand aggregation, Trending API
Files:
  - apps/api/src/routes/product-trend-indicators.ts
  - apps/web/src/components/product/TrendingBadge.tsx
  - apps/web/src/components/product/PopularityIndicator.tsx
```

### 5.4 Cross-Store Price Comparison
**Capability:** Show shoppers price comparison across stores carrying same product

**Location:** Product detail pages

**Features:**
- "Compare prices nearby" section
- Price range indicator
- Lowest price highlight
- Store reputation/rating context

**Implementation:**
```
Priority: MEDIUM (Shopper-facing)
Effort: 2 weeks
Dependencies: Product matching, Pricing data
Files:
  - apps/api/src/routes/price-comparison.ts
  - apps/web/src/components/product/PriceComparisonWidget.tsx
```

### 5.5 Product Insights Panel
**Capability:** Rich product information panel for shoppers

**Location:** Product detail pages

**Features:**
- Brand information and other products from brand
- Category exploration
- Product specifications from UPC data
- Availability history (how long in stock)

**Implementation:**
```
Priority: LOW (Shopper-facing)
Effort: 1.5 weeks
Dependencies: Brand analytics, Catalog enrichment
Files:
  - apps/api/src/routes/product-insights.ts
  - apps/web/src/components/product/ProductInsightsPanel.tsx
```

---

## Phase 6: Data Products (Q4 2026) - LOW PRIORITY

### 6.1 Trending Products API
**Capability:** Real-time trending by category, brand, or region

**Use Cases:**
- Emerging product alerts for merchants
- Platform-wide product velocity metrics
- Trending widgets for storefronts

**Implementation:**
```
Priority: LOW
Effort: 2 weeks
Dependencies: Demand aggregation
Files:
  - apps/api/src/routes/trending.ts
  - apps/web/src/components/widgets/TrendingProducts.tsx
```

### 6.2 Catalog Enrichment Engine
**Capability:** Auto-suggest categories, normalize brands, infer attributes

**Use Cases:**
- Auto-categorization for unclassified products
- Brand normalization for messy merchant data
- Product attribute inference from slug components

**Implementation:**
```
Priority: LOW
Effort: 3 weeks
Dependencies: Slug registry V2, ML models
Files:
  - apps/api/src/services/CatalogEnrichmentService.ts
```

### 6.3 Data Monetization Products
**Capability:** Anonymized insights for external parties

**Use Cases:**
- Brand performance reports for CPG brands
- Category trend reports for industry analysts
- Local retail health indices

**Implementation:**
```
Priority: LOW
Effort: 4+ weeks
Dependencies: All analytics services, Legal review
Files:
  - apps/api/src/routes/external/data-products.ts
```

---

## Phase 6: Integration Opportunities (Q4 2026+) - FUTURE

### 6.1 Global Ecommerce Bridges
**Capability:** Map LPC products to UPC equivalents for marketplace sync

**Use Cases:**
- Google Shopping integration via `gtin_upc`
- Amazon/eBay product matching via UPC
- Cross-platform inventory sync

**Implementation:**
```
Priority: FUTURE
Effort: 4+ weeks per integration
Dependencies: Product matching, External APIs
```

### 6.2 Slug-Based Search Enhancement
**Capability:** Fuzzy matching on slug components

**Use Cases:**
- Partial product identification from incomplete data
- SKU-to-UPC resolution chain
- Voice search optimization

**Implementation:**
```
Priority: FUTURE
Effort: 2-3 weeks
Dependencies: Search infrastructure
```

---

## Technical Enablers

### Already Implemented
- `product_slug` unique identifier
- `universal_sku` for UPC products
- `brand_normalized` for brand matching
- `category_normalized` for category matching
- `slug_type` (upc/lpc) for product classification
- `slug_prefix` for quick filtering
- `format_version` for schema evolution
- `is_active` for soft-delete
- `migration_status` for rollout tracking
- `slug_components` JSONB for structured parsing
- `compare_registry_products()` PostgreSQL function

### Needed for Future Phases
- [ ] `product_similarity_scores` table for pre-computed matching
- [ ] `demand_signals` table for aggregated demand
- [ ] `transfer_suggestions` table for recommendation caching
- [ ] `brand_performance_metrics` materialized view
- [ ] `category_trend_metrics` materialized view
- [ ] Redis caching layer for real-time recommendations

---

## Priority Matrix

| Capability | Scope | Priority | Effort | Impact |
|------------|-------|----------|--------|--------|
| Product Matching | Shared | HIGH | 2-3wk | High |
| Brand Analytics | Admin | HIGH | 2wk | High |
| Recommendations | Shared | HIGH | 3-4wk | Very High |
| Transfer Suggestions | Admin | MEDIUM | 2-3wk | Medium |
| Demand Aggregation | Shared | MEDIUM | 3wk | High |
| Competitive Intel | Tenant | MEDIUM | 3wk | Medium |
| Local Discovery | Shared | MEDIUM | 2-3wk | High |
| **Available Nearby Widget** | Shopper | HIGH | 1.5wk | Very High |
| **Similar Products** | Shopper | HIGH | 2wk | Very High |
| **Trend Indicators** | Shopper | MEDIUM | 1wk | High |
| **Price Comparison** | Shopper | MEDIUM | 2wk | High |
| **Product Insights Panel** | Shopper | LOW | 1.5wk | Medium |
| Trending API | Shared | LOW | 2wk | Medium |
| Catalog Enrichment | Shared | LOW | 3wk | Medium |
| Data Products | External | LOW | 4+wk | Variable |
| Ecommerce Bridges | External | FUTURE | 4+wk | High |

---

## Next Sprint: Quick Win Plan

### Admin Quick Wins (Week 1-2)

#### A1. Brand Analytics Dashboard ⭐
**Goal:** Platform admins see brand performance across all tenants

**Deliverables:**
- `apps/api/src/routes/admin/brand-analytics.ts` - API endpoints
- `apps/web/src/app/(platform)/settings/admin/brand-analytics/page.tsx` - Dashboard UI
- Top brands by inventory count, tenant adoption, stock value
- Brand trend charts (weekly/monthly)

**Effort:** 1.5 weeks

#### A2. Category Analytics Dashboard
**Goal:** Platform admins see category performance and trends

**Deliverables:**
- `apps/api/src/routes/admin/category-analytics.ts` - API endpoints
- `apps/web/src/app/(platform)/settings/admin/category-analytics/page.tsx` - Dashboard UI
- Category distribution, trending categories, gap analysis

**Effort:** 1 week

#### A3. Platform Trending Products Widget
**Goal:** Show trending products on admin dashboard

**Deliverables:**
- Trending API endpoint (reuse inventory stats)
- Widget component for admin dashboard
- Configurable time windows (24h, 7d, 30d)

**Effort:** 0.5 weeks

---

### Tenant Quick Wins (Week 2-3)

#### T1. Product Performance Tab ⭐
**Goal:** Merchants see their top/bottom performing products

**Deliverables:**
- `apps/api/src/routes/tenant-intelligence.ts` - Base API
- `apps/api/src/services/TenantIntelligenceService.ts` - Service layer
- `apps/web/src/app/(platform)/t/[tenantId]/intelligence/page.tsx` - Dashboard shell
- `apps/web/src/app/(platform)/t/[tenantId]/intelligence/ProductPerformanceTab.tsx`
- Top products by views, stock velocity, sales
- Slow-moving inventory alerts
- Stock turnover rates

**Effort:** 1.5 weeks

#### T2. Inventory Intelligence Tab
**Goal:** Merchants see cross-location insights and transfer suggestions

**Deliverables:**
- `apps/web/src/app/(platform)/t/[tenantId]/intelligence/InventoryIntelligenceTab.tsx`
- Cross-location stock imbalances visualization
- Transfer suggestions (high stock → low stock)
- Reorder recommendations based on velocity

**Effort:** 1 week

#### T3. Brand & Category Insights Tab
**Goal:** Merchants understand their brand/category distribution

**Deliverables:**
- `apps/web/src/app/(platform)/t/[tenantId]/intelligence/BrandCategoryInsightsTab.tsx`
- Your top brands by performance
- Category health scores
- Comparison to platform averages

**Effort:** 0.5 weeks

---

### Sprint Timeline

| Week | Admin Focus | Tenant Focus |
|------|-------------|--------------|
| 1 | Brand Analytics API + UI | - |
| 1.5 | Category Analytics API | Tenant Intel Service |
| 2 | Trending Widget | Product Performance Tab |
| 2.5 | Polish & Testing | Inventory Intel Tab |
| 3 | - | Brand/Category Insights Tab |

---

### Shared Infrastructure (Week 1)

#### S1. Product Matching Service
**Goal:** Foundation for all intelligence features

**Deliverables:**
- `apps/api/src/services/ProductMatchingService.ts`
- `compare_registry_products()` integration
- Similar tenant identification algorithm
- Product similarity scoring

**Effort:** 1 week (parallel with Brand Analytics)

---

## Success Metrics

### Admin Dashboard
- [ ] Platform admins can view top 20 brands by inventory value
- [ ] Platform admins can see category distribution across tenants
- [ ] Platform admins can identify trending products in last 7 days

### Tenant Dashboard
- [ ] Merchants can view their top 10 performing products
- [ ] Merchants can see slow-moving inventory alerts
- [ ] Merchants can view cross-location stock imbalances
- [ ] Merchants can see transfer suggestions

---

## Priority Matrix (Updated)

| Capability | Scope | Priority | Effort | Sprint |
|------------|-------|----------|--------|--------|
| Brand Analytics | Admin | HIGH | 1.5wk | Week 1-2 |
| Category Analytics | Admin | HIGH | 1wk | Week 1-2 |
| Trending Widget | Admin | MEDIUM | 0.5wk | Week 2 |
| Product Matching | Shared | HIGH | 1wk | Week 1 |
| Product Performance | Tenant | HIGH | 1.5wk | Week 2-3 |
| Inventory Intel | Tenant | MEDIUM | 1wk | Week 2-3 |
| Brand/Category Insights | Tenant | MEDIUM | 0.5wk | Week 3 |

---

*Last Updated: May 2026*
*Status: Phase 1 Complete, Phase 2 Ready to Start*
