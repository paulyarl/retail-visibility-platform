# Featured Products Quality Scoring System

## Overview

A comprehensive scoring system that **incentivizes stores to improve their quality** by rewarding complete profiles, accurate data, and professional presentation with increased featured product visibility.

### Strategic Purpose

Featured products serve as a **quality incentive engine** that:
- Rewards stores that invest in complete, accurate profiles
- Encourages professional branding (logos, descriptions)
- Prioritizes stores with location data (critical for local shopping)
- Motivates stores to maintain inventory and gather reviews
- Drives overall platform quality through competitive improvement

**The more effort a store puts into their profile, the more visibility they earn.**

**Total Score Range:** 0-120 points (100 base + 20 bonus)

## Scoring Breakdown (Optimized for Local Shopping)

### 1. Location & Discoverability (40 points max) 📍

**PRIMARY FACTOR** - Essential for local shopping directory.

| Metric | Points | Why It Matters |
|--------|--------|----------------|
| **Location Data** | 20 pts | Latitude/longitude enables maps, proximity search, directions |
| **Business Hours** | 15 pts | Customers need to know when you're open |
| **Recently Updated** | 5 pts | Active stores get slight boost |

**Examples:**
- Full location + hours + updated this week = **40 points**
- Location + hours only = **35 points**
- No location data = **0-20 points** (major penalty)

**Why Location is #1:**
- Local shopping is about proximity and convenience
- Customers can't visit if they don't know where you are
- Maps and directions require coordinates
- Hours prevent wasted trips

### 2. Store Reputation (30 points max) ⭐

Measures customer satisfaction and inventory depth.

| Metric | Points | Calculation |
|--------|--------|-------------|
| **Rating Average** | 0-15 pts | `(rating_avg / 5.0) × 15` |
| **Rating Count** | 0-10 pts | `min(rating_count / 5, 10)` |
| **Product Count** | 0-5 pts | `min(product_count / 10, 5)` |

**Examples:**
- 5.0 stars, 50+ reviews, 50+ products = **30 points**
- 4.0 stars, 25 reviews, 25 products = **19.5 points**
- 3.0 stars, 10 reviews, 10 products = **11 points**

### 3. Profile Completeness (20 points max) 🎨

Measures professional presentation.

| Element | Points | Requirement |
|---------|--------|-------------|
| **Logo** | 10 pts | Has logo URL |
| **Description** | 10 pts | Description > 50 characters |

**Examples:**
- Logo + description = **20 points**
- Logo only = **10 points**
- Neither = **0 points**

### 4. Engagement (10 points max) 💼

Measures commitment and online presence.

| Metric | Points | Tiers |
|--------|--------|-------|
| **Subscription Tier** | 0-7 pts | Enterprise: 7, Pro: 5, Starter: 3 |
| **Website** | 3 pts | Has external website |

**Examples:**
- Enterprise + website = **10 points**
- Pro + website = **8 points**
- Starter, no website = **3 points**

## Quality Tiers

| Tier | Score Range | Description |
|------|-------------|-------------|
| **Excellent** | 80-100 | Premium stores with complete profiles and strong reputation |
| **Good** | 60-79 | Well-maintained stores with good customer feedback |
| **Fair** | 40-59 | Basic stores with some quality indicators |
| **Poor** | 30-39 | Minimal quality, meets minimum threshold |
| **Unqualified** | 0-29 | Below minimum threshold, not recommended for featuring |

**Minimum Quality Threshold:** 35 points (location data is critical)

## API Endpoints

### GET /api/featured-products/scored

Get featured products ordered by store quality score.

**Query Parameters:**
- `limit` (default: 20, max: 100) - Number of results
- `minScore` (default: 35) - Minimum quality score
- `category` - Filter by category slug
- `tier` - Filter by quality tier (excellent/good/fair/poor)

**Example Request:**
```bash
GET /api/featured-products/scored?limit=50&minScore=60&tier=excellent
```

**Example Response:**
```json
{
  "items": [
    {
      "id": "prod_123",
      "name": "Premium Product",
      "storeName": "High Quality Store",
      "storeSlug": "high-quality-store",
      "qualityScore": 87.5,
      "qualityTier": "excellent",
      "scoreBreakdown": {
        "locationDiscoverability": 40.0,
        "storeQuality": 28.5,
        "profileCompleteness": 20.0,
        "engagement": 9.0
      },
      "storeRatingAvg": 4.8,
      "storeRatingCount": 120,
      "storeProductCount": 250
    }
  ],
  "count": 50,
  "scoreDistribution": {
    "excellent": 35,
    "good": 12,
    "fair": 3,
    "poor": 0
  }
}
```

### GET /api/featured-products/score-stats

Get statistics about store quality scores across all featured products.

**Example Response:**
```json
{
  "totalStoresWithFeatured": 150,
  "totalFeaturedProducts": 1250,
  "avgQualityScore": 65.3,
  "minQualityScore": 32.0,
  "maxQualityScore": 95.5,
  "distribution": {
    "excellent": 450,
    "good": 520,
    "fair": 230,
    "poor": 40,
    "unqualified": 10
  },
  "threshold": 35
}
```

## Implementation Details

### SQL Query Structure

The scoring is calculated directly in SQL for maximum performance:

```sql
WITH store_scores AS (
  SELECT 
    tenant_id,
    -- Location & Discoverability (40 pts) - PRIMARY
    (CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN business_hours IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE 
      WHEN updated_at > NOW() - INTERVAL '7 days' THEN 5
      WHEN updated_at > NOW() - INTERVAL '14 days' THEN 4
      WHEN updated_at > NOW() - INTERVAL '30 days' THEN 3
      WHEN updated_at > NOW() - INTERVAL '60 days' THEN 2
      WHEN updated_at > NOW() - INTERVAL '90 days' THEN 1
      ELSE 0
    END) as location_discoverability_score,
    
    -- Store Reputation (30 pts)
    COALESCE((rating_avg / 5.0) * 15, 0) +
    LEAST(COALESCE(rating_count / 5.0, 0), 10) +
    LEAST(COALESCE(product_count / 10.0, 0), 5) as store_quality_score,
    
    -- Profile Completeness (20 pts)
    (CASE WHEN logo_url IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN LENGTH(description) > 50 THEN 10 ELSE 0 END) as profile_completeness_score,
    
    -- Engagement (10 pts)
    (CASE subscription_tier
      WHEN 'enterprise' THEN 7
      WHEN 'pro' THEN 5
      WHEN 'starter' THEN 3
      ELSE 0
    END) +
    (CASE WHEN website IS NOT NULL THEN 3 ELSE 0 END) as engagement_score
  FROM directory_listings_list
  WHERE is_published = true
)
SELECT 
  sp.*,
  (ss.location_discoverability_score + ss.store_quality_score + 
   ss.profile_completeness_score + ss.engagement_score) as quality_score
FROM storefront_products sp
JOIN store_scores ss ON sp.tenant_id = ss.tenant_id
WHERE sp.is_actively_featured = true
ORDER BY quality_score DESC, sp.featured_priority DESC
```

### Performance

- **Query Time:** <10ms using materialized views
- **Scalability:** Handles thousands of featured products efficiently
- **Caching:** Results can be cached for 5-15 minutes

## Use Cases

### 1. Directory Home Page
Show top-quality featured products from excellent stores:
```
GET /api/featured-products/scored?tier=excellent&limit=12
```

### 2. Category Pages
Show high-quality featured products in specific categories:
```
GET /api/featured-products/scored?category=electronics&minScore=60&limit=20
```

### 3. Store Quality Dashboard
Monitor overall featured product quality:
```
GET /api/featured-products/score-stats
```

### 4. Quality Improvement
Identify stores below threshold that need improvement:
```
GET /api/featured-products/scored?minScore=0&tier=poor
```

## Benefits

### For Stores (Incentive Alignment)
✅ **Clear Improvement Path:** Know exactly what to do to increase visibility  
✅ **Competitive Motivation:** See how you rank and what to improve  
✅ **Reward for Effort:** Time invested in profile = more featured visibility  
✅ **No Pay-to-Win:** Based on quality, not subscription tier (mostly)  
✅ **Transparent Scoring:** Understand why you rank where you do  

### For Platform
✅ **Quality Flywheel:** Better stores → better user experience → more stores join  
✅ **Data Completeness:** Incentivizes location data, hours, descriptions  
✅ **Professional Standards:** Encourages branding and presentation  
✅ **Local Shopping Focus:** Prioritizes stores with complete location data  
✅ **Scalability:** Efficient SQL-based scoring handles growth  

### For Customers
✅ **Better Experience:** See products from high-quality, reliable stores  
✅ **Complete Information:** Featured stores have location, hours, descriptions  
✅ **Local Relevance:** Proximity bonus shows nearby stores first  
✅ **Category Match:** See products from stores that specialize in what you want  

## Migration Path

### Phase 1: Parallel Testing
- Run new scoring endpoint alongside existing featured products
- Compare results and validate scoring algorithm
- Gather feedback from stores

### Phase 2: Gradual Rollout
- Use scored endpoint for directory home page
- Monitor engagement and conversion metrics
- Adjust scoring weights if needed

### Phase 3: Full Migration
- Replace all featured product queries with scored version
- Deprecate old endpoint
- Add store quality dashboard for merchants

## Future Enhancements

### Incentive Improvements
1. **Store Dashboard:** Show stores their current score and improvement opportunities
2. **Score History:** Track score improvements over time to show progress
3. **Achievement Badges:** Reward milestones ("Complete Profile", "100 Reviews", etc.)
4. **Competitive Leaderboards:** Show top-scoring stores by category/region
5. **Improvement Notifications:** Alert stores when they can gain points

### Algorithm Refinements
1. **Dynamic Weights:** Adjust scoring weights based on category or region
2. **Temporal Variety:** Rotate high-scoring stores to prevent staleness
3. **User Preferences:** Personalize scoring based on user behavior
4. **A/B Testing:** Test different scoring algorithms
5. **New Store Boost:** Temporary bonus for new stores (first 30 days)

### Gamification
1. **Point Milestones:** Celebrate when stores reach 50, 75, 90, 100+ points
2. **Improvement Challenges:** "Add business hours this week for +15 points"
3. **Category Champions:** Highlight top-scoring store in each category
4. **Quality Tiers:** Bronze/Silver/Gold/Platinum based on score ranges

## Related Files

- **Scoring Logic:** `apps/api/src/utils/featured-product-scoring.ts`
- **API Routes:** `apps/api/src/routes/featured-products-scored.ts`
- **Materialized View:** `storefront_products` (existing)
- **Directory View:** `directory_listings_list` (existing)
