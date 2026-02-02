# Phase 5: Scope Expansion Plan
**Product Category, Shop Category, and Location Scopes**

## Overview

Phase 5 extends the Shops Discovery API with three new scopes that enable category-based and location-based product discovery. This builds on the existing `mv_global_discovery` and `mv_category_discovery` materialized views.

---

## Current MV Schema Analysis

### ✅ **Already Available in MVs**

**`mv_global_discovery` (Base MV):**
- ✅ `shop_category` - Primary GBP category name
- ✅ `shop_category_id` - Primary GBP category ID
- ✅ `shop_google_category_id` - Google taxonomy ID
- ✅ `tenant_id`, `tenant_name`, `tenant_slug`
- ✅ `tenant_city`, `tenant_state`, `tenant_country`, `tenant_zip`
- ✅ All product fields (name, description, price, images, etc.)
- ✅ Trending scores, quality signals, stock status

**`mv_category_discovery` (Category-Enhanced MV):**
- ✅ All fields from `mv_global_discovery` (inherited)
- ✅ `gbp_secondary_categories_array` - Secondary GBP categories (JSONB)
- ✅ `gbp_category_type` - 'both', 'primary', 'secondary', 'none'
- ✅ `gbp_primary_category_name` - Primary category name
- ✅ `gbp_secondary_category_ids_array` - Array of secondary category IDs
- ✅ `gbp_primary_category_name_lower` - Lowercase for ILIKE searches
- ✅ `has_matching_secondary_category` - Boolean flag for common terms

### 🚧 **Missing for Location Scope**

**Need to Add:**
- ❌ `tenant_latitude` - Geocoded latitude
- ❌ `tenant_longitude` - Geocoded longitude
- ❌ Geospatial index on coordinates
- ❌ Distance calculation function

---

## Phase 5A: Product Category Scope (Days 1-2)

### Goal
Enable discovery of products filtered by **product category** (not shop category).

### Current State
- Product categories exist in `directory_category` table
- MV has `directory_category_id` field
- Category name available via join

### Implementation

**1. Add Product Category Fields to MV** (Day 1 - 2 hours)
```sql
-- Add to mv_global_discovery SELECT
dc.name as product_category_name,
dc.slug as product_category_slug,
dc.id as product_category_id,
dc.google_category_id as product_google_category_id,
LOWER(dc.name) as product_category_name_lower
```

**2. Refresh MV** (Day 1 - 1 hour)
```bash
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_discovery;
```

**3. Implement `handleCategoryScope()` in ScopeRouter** (Day 1 - 3 hours)
```typescript
private async handleCategoryScope(bucketType: string, options: DiscoveryOptions) {
  const { category, limit = 12 } = options;
  
  // Determine if filtering by product category or shop category
  const categoryType = category?.productName ? 'product' : 'shop';
  
  if (categoryType === 'product') {
    return this.shopsService.getProductsByProductCategory({
      categoryName: category.productName,
      categoryId: category.productId,
      bucketType,
      limit
    });
  } else {
    return this.shopsService.getProductsByShopCategory({
      categoryName: category.shopCategoryName,
      categoryId: category.shopCategoryId,
      bucketType,
      limit
    });
  }
}
```

**4. Add Service Methods** (Day 2 - 4 hours)
```typescript
// ShopsFeaturedService.ts
async getProductsByProductCategory(options: {
  categoryName?: string;
  categoryId?: string;
  bucketType: string;
  limit?: number;
}) {
  const query = `
    SELECT * FROM mv_global_discovery
    WHERE item_status = 'active'
      AND visibility = 'public'
      AND (
        product_category_name_lower ILIKE $1
        OR product_category_id = $2
      )
      ${this.getBucketTypeFilter(bucketType)}
    ORDER BY trending_score DESC
    LIMIT $3
  `;
  
  return this.prisma.$queryRawUnsafe(
    query,
    `%${categoryName?.toLowerCase()}%`,
    categoryId,
    limit
  );
}

async getProductsByShopCategory(options: {
  categoryName?: string;
  categoryId?: string;
  bucketType: string;
  limit?: number;
}) {
  const query = `
    SELECT * FROM mv_category_discovery
    WHERE item_status = 'active'
      AND visibility = 'public'
      AND (
        gbp_primary_category_name_lower ILIKE $1
        OR gbp_primary_category_id = $2
        OR EXISTS(
          SELECT 1 
          FROM jsonb_array_elements(gbp_secondary_categories_array) elem
          WHERE LOWER(elem->>'name') ILIKE $1
        )
      )
      ${this.getBucketTypeFilter(bucketType)}
    ORDER BY trending_score DESC
    LIMIT $3
  `;
  
  return this.prisma.$queryRawUnsafe(
    query,
    `%${categoryName?.toLowerCase()}%`,
    categoryId,
    limit
  );
}

private getBucketTypeFilter(bucketType: string): string {
  switch (bucketType) {
    case 'trending': return 'AND trending_score > 0';
    case 'new': return 'AND featured_type = \'new_arrival\'';
    case 'sale': return 'AND featured_type = \'sale\'';
    case 'seasonal': return 'AND featured_type = \'seasonal\'';
    case 'staff': return 'AND featured_type = \'staff_pick\'';
    case 'selection': return 'AND featured_type = \'store_selection\'';
    case 'random': return '';
    case 'random-weighted': return '';
    default: return '';
  }
}
```

**5. Test Category Scope** (Day 2 - 2 hours)
```bash
# Product category
curl "http://localhost:4000/api/public/shops/category/trending?category[productName]=Electronics&limit=5"

# Shop category (GBP)
curl "http://localhost:4000/api/public/shops/category/trending?category[shopCategoryName]=Grocery Store&limit=5"

# Shop category with secondary
curl "http://localhost:4000/api/public/shops/category/sale?category[shopCategoryName]=Market&limit=5"
```

**Effort:** 2 days (12 hours)

---

## Phase 5B: Shop Category Scope (Days 3-4)

### Goal
Enhanced shop category filtering with primary + secondary GBP categories.

### Current State
- `mv_category_discovery` already has all needed fields
- Secondary categories stored in JSONB array
- Search helpers already implemented

### Implementation

**1. Enhance `handleCategoryScope()` for Advanced Filtering** (Day 3 - 4 hours)
```typescript
async getProductsByShopCategoryAdvanced(options: {
  categoryName?: string;
  categoryId?: string;
  includeSecondary?: boolean;
  bucketType: string;
  limit?: number;
}) {
  const { categoryName, categoryId, includeSecondary = true, bucketType, limit = 12 } = options;
  
  const secondaryFilter = includeSecondary ? `
    OR EXISTS(
      SELECT 1 
      FROM jsonb_array_elements(gbp_secondary_categories_array) elem
      WHERE LOWER(elem->>'name') ILIKE $1
      OR elem->>'id' = $2
    )
  ` : '';
  
  const query = `
    SELECT * FROM mv_category_discovery
    WHERE item_status = 'active'
      AND visibility = 'public'
      AND (
        gbp_primary_category_name_lower ILIKE $1
        OR gbp_primary_category_id = $2
        ${secondaryFilter}
      )
      ${this.getBucketTypeFilter(bucketType)}
    ORDER BY 
      CASE WHEN gbp_category_type = 'both' THEN 1
           WHEN gbp_category_type = 'primary' THEN 2
           WHEN gbp_category_type = 'secondary' THEN 3
           ELSE 4 END,
      trending_score DESC
    LIMIT $3
  `;
  
  return this.prisma.$queryRawUnsafe(
    query,
    `%${categoryName?.toLowerCase()}%`,
    categoryId,
    limit
  );
}
```

**2. Add Category Aggregation Endpoint** (Day 3 - 3 hours)
```typescript
// Get trending categories (most products)
async getTrendingCategories(options: { limit?: number }) {
  const query = `
    SELECT 
      gbp_primary_category_name as category_name,
      gbp_primary_category_id as category_id,
      COUNT(DISTINCT inventory_item_id)::integer as product_count,
      COUNT(DISTINCT tenant_id)::integer as shop_count,
      AVG(trending_score)::numeric as avg_trending_score,
      SUM(CASE WHEN has_image THEN 1 ELSE 0 END)::integer as products_with_images
    FROM mv_category_discovery
    WHERE item_status = 'active'
      AND visibility = 'public'
      AND gbp_primary_category_name IS NOT NULL
    GROUP BY gbp_primary_category_name, gbp_primary_category_id
    HAVING COUNT(DISTINCT inventory_item_id) >= 3
    ORDER BY product_count DESC, avg_trending_score DESC
    LIMIT $1
  `;
  
  return this.prisma.$queryRawUnsafe(query, limit);
}
```

**3. Add Category Browse Endpoint** (Day 4 - 3 hours)
```typescript
// GET /api/public/shops/categories
router.get('/shops/categories', async (req, res) => {
  const { limit = 20, minProducts = 3 } = req.query;
  
  const shopsService = (await import('../services/ShopsFeaturedService')).default;
  const service = shopsService.getInstance();
  
  const categories = await service.getTrendingCategories({
    limit: parseInt(limit as string),
    minProducts: parseInt(minProducts as string)
  });
  
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.json({
    success: true,
    data: categories,
    count: (categories as any[]).length
  });
});
```

**4. Test Shop Category Scope** (Day 4 - 2 hours)
```bash
# Primary category only
curl "http://localhost:4000/api/public/shops/category/trending?category[shopCategoryName]=Grocery Store&limit=5"

# Include secondary categories
curl "http://localhost:4000/api/public/shops/category/sale?category[shopCategoryName]=Market&includeSecondary=true&limit=5"

# Browse all categories
curl "http://localhost:4000/api/public/shops/categories?limit=20&minProducts=5"
```

**Effort:** 2 days (12 hours)

---

## Phase 5C: Location Scope (Days 5-8)

### Goal
Enable discovery of products near a geographic location using radius search.

### Current State
- Tenant addresses stored in `tenants` table
- No geocoded coordinates
- No geospatial indexing

### Implementation

**1. Add Geocoding to Tenants Table** (Day 5 - 4 hours)

**Migration:**
```sql
-- Add geocoding columns
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS geocoding_source VARCHAR(50);

-- Add geospatial index
CREATE INDEX IF NOT EXISTS idx_tenants_location 
ON tenants USING GIST (
  ll_to_earth(latitude, longitude)
);

-- Add to mv_global_discovery
ALTER MATERIALIZED VIEW mv_global_discovery 
ADD COLUMN tenant_latitude DECIMAL(10, 8),
ADD COLUMN tenant_longitude DECIMAL(11, 8);
```

**2. Implement Geocoding Service** (Day 5-6 - 8 hours)
```typescript
// services/GeocodingService.ts
import axios from 'axios';

export class GeocodingService {
  private static instance: GeocodingService;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new GeocodingService();
    }
    return this.instance;
  }
  
  async geocodeTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        city: true, 
        state: true, 
        country: true, 
        zip: true,
        address: true 
      }
    });
    
    if (!tenant) return null;
    
    // Use Google Geocoding API or OpenStreetMap Nominatim
    const address = `${tenant.address}, ${tenant.city}, ${tenant.state} ${tenant.zip}, ${tenant.country}`;
    const coords = await this.geocodeAddress(address);
    
    if (coords) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          latitude: coords.lat,
          longitude: coords.lng,
          geocoded_at: new Date(),
          geocoding_source: 'google_maps'
        }
      });
    }
    
    return coords;
  }
  
  private async geocodeAddress(address: string) {
    // Option 1: Google Maps Geocoding API (requires API key)
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          address,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    );
    
    if (response.data.results?.[0]) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    
    return null;
  }
  
  async geocodeAllTenants() {
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { latitude: null },
          { geocoded_at: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } // 90 days old
        ]
      },
      select: { id: true }
    });
    
    for (const tenant of tenants) {
      await this.geocodeTenant(tenant.id);
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
    }
  }
}
```

**3. Implement Location Scope Handler** (Day 6-7 - 8 hours)
```typescript
// ScopeRouter.ts
private async handleLocationScope(bucketType: string, options: DiscoveryOptions) {
  const { location, limit = 12 } = options;
  
  if (!location?.city && !location?.zip) {
    throw new Error('Location filter requires city or zip code');
  }
  
  // Geocode the search location
  const geocodingService = GeocodingService.getInstance();
  const searchAddress = location.zip || `${location.city}, ${location.state}`;
  const searchCoords = await geocodingService.geocodeAddress(searchAddress);
  
  if (!searchCoords) {
    throw new Error('Unable to geocode location');
  }
  
  const radius = location.radius || 25; // Default 25 miles
  
  return this.shopsService.getProductsByLocation({
    latitude: searchCoords.lat,
    longitude: searchCoords.lng,
    radiusMiles: radius,
    bucketType,
    limit
  });
}
```

**4. Add Location-Based Query Methods** (Day 7 - 6 hours)
```typescript
// ShopsFeaturedService.ts
async getProductsByLocation(options: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  bucketType: string;
  limit?: number;
}) {
  const { latitude, longitude, radiusMiles, bucketType, limit = 12 } = options;
  
  // Use PostgreSQL earthdistance extension for radius search
  const query = `
    SELECT 
      *,
      earth_distance(
        ll_to_earth(tenant_latitude, tenant_longitude),
        ll_to_earth($1, $2)
      ) / 1609.34 as distance_miles
    FROM mv_global_discovery
    WHERE item_status = 'active'
      AND visibility = 'public'
      AND tenant_latitude IS NOT NULL
      AND tenant_longitude IS NOT NULL
      AND earth_box(ll_to_earth($1, $2), $3 * 1609.34) @> ll_to_earth(tenant_latitude, tenant_longitude)
      ${this.getBucketTypeFilter(bucketType)}
    ORDER BY distance_miles ASC, trending_score DESC
    LIMIT $4
  `;
  
  return this.prisma.$queryRawUnsafe(
    query,
    latitude,
    longitude,
    radiusMiles,
    limit
  );
}

async getNearbyShops(options: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  limit?: number;
}) {
  const query = `
    SELECT 
      tenant_id,
      tenant_name,
      tenant_slug,
      shop_category,
      tenant_city,
      tenant_state,
      COUNT(DISTINCT inventory_item_id)::integer as product_count,
      earth_distance(
        ll_to_earth(tenant_latitude, tenant_longitude),
        ll_to_earth($1, $2)
      ) / 1609.34 as distance_miles
    FROM mv_global_discovery
    WHERE tenant_latitude IS NOT NULL
      AND tenant_longitude IS NOT NULL
      AND earth_box(ll_to_earth($1, $2), $3 * 1609.34) @> ll_to_earth(tenant_latitude, tenant_longitude)
    GROUP BY tenant_id, tenant_name, tenant_slug, shop_category, 
             tenant_city, tenant_state, tenant_latitude, tenant_longitude
    HAVING COUNT(DISTINCT inventory_item_id) >= 3
    ORDER BY distance_miles ASC
    LIMIT $4
  `;
  
  return this.prisma.$queryRawUnsafe(
    query,
    latitude,
    longitude,
    radiusMiles,
    limit
  );
}
```

**5. Add PostgreSQL Extensions** (Day 7 - 1 hour)
```sql
-- Enable earthdistance extension
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
```

**6. Test Location Scope** (Day 8 - 3 hours)
```bash
# Products near New York City (25 mile radius)
curl "http://localhost:4000/api/public/shops/location/trending?location[city]=New York&location[state]=NY&location[radius]=25&limit=10"

# Products near ZIP code (10 mile radius)
curl "http://localhost:4000/api/public/shops/location/sale?location[zip]=10001&location[radius]=10&limit=10"

# Nearby shops
curl "http://localhost:4000/api/public/shops/nearby?location[city]=Brooklyn&location[state]=NY&location[radius]=15&limit=20"
```

**Effort:** 4 days (24 hours)

---

## Implementation Timeline

### **Phase 5A: Product Category Scope**
- **Duration:** 2 days (12 hours)
- **Complexity:** Low
- **Dependencies:** None (MV already has product category fields)

### **Phase 5B: Shop Category Scope**
- **Duration:** 2 days (12 hours)
- **Complexity:** Low-Medium
- **Dependencies:** None (mv_category_discovery already exists)

### **Phase 5C: Location Scope**
- **Duration:** 4 days (24 hours)
- **Complexity:** High
- **Dependencies:** 
  - Google Maps API key (geocoding)
  - PostgreSQL earthdistance extension
  - Tenant geocoding backfill

### **Total Phase 5 Effort**
- **Duration:** 8 days (48 hours)
- **Complexity:** Medium-High
- **Risk:** Location scope requires external API and data migration

---

## Testing Strategy

### **Unit Tests**
- Category filtering logic
- Geocoding service
- Distance calculations
- Bucket type filters

### **Integration Tests**
- Category scope with all bucket types
- Location scope with various radii
- MV query performance
- Edge cases (no results, invalid locations)

### **Performance Tests**
- Category queries on large datasets
- Location radius search performance
- MV refresh time with geocoded data
- Concurrent location queries

---

## Success Metrics

### **Phase 5A: Product Category**
- ✅ All 8 bucket types work with product category filter
- ✅ Response time < 200ms for category queries
- ✅ Accurate filtering by product category name/ID

### **Phase 5B: Shop Category**
- ✅ Primary + secondary GBP category filtering
- ✅ Category browse endpoint returns top categories
- ✅ Response time < 250ms for category queries

### **Phase 5C: Location**
- ✅ All tenants geocoded successfully
- ✅ Radius search returns accurate results
- ✅ Distance calculations within 1% accuracy
- ✅ Response time < 300ms for location queries
- ✅ Nearby shops endpoint functional

---

## API Examples

### **Product Category Scope**
```bash
# Trending electronics
GET /api/public/shops/category/trending?category[productName]=Electronics&limit=10

# Sale items in Home & Garden
GET /api/public/shops/category/sale?category[productName]=Home & Garden&limit=10
```

### **Shop Category Scope**
```bash
# Trending products from Grocery Stores
GET /api/public/shops/category/trending?category[shopCategoryName]=Grocery Store&limit=10

# New arrivals from Restaurants (includes secondary categories)
GET /api/public/shops/category/new?category[shopCategoryName]=Restaurant&includeSecondary=true&limit=10

# Browse all categories
GET /api/public/shops/categories?limit=20&minProducts=5
```

### **Location Scope**
```bash
# Trending products near NYC (25 mile radius)
GET /api/public/shops/location/trending?location[city]=New York&location[state]=NY&location[radius]=25&limit=10

# Sale items near ZIP code (10 mile radius)
GET /api/public/shops/location/sale?location[zip]=10001&location[radius]=10&limit=10

# Random products near location
GET /api/public/shops/location/random?location[city]=Brooklyn&location[state]=NY&location[radius]=15&limit=10

# Nearby shops
GET /api/public/shops/nearby?location[city]=Brooklyn&location[state]=NY&location[radius]=15&limit=20
```

---

## Dependencies & Prerequisites

### **Phase 5A & 5B (Category Scopes)**
- ✅ `mv_global_discovery` exists
- ✅ `mv_category_discovery` exists
- ✅ Product categories in `directory_category` table
- ✅ GBP categories in tenant metadata

### **Phase 5C (Location Scope)**
- ❌ Google Maps API key (for geocoding)
- ❌ PostgreSQL `earthdistance` extension
- ❌ Tenant geocoding migration
- ❌ Latitude/longitude columns in tenants table
- ❌ Geospatial index on coordinates

---

## Risk Mitigation

### **Geocoding Rate Limits**
- **Risk:** Google Maps API has rate limits
- **Mitigation:** 
  - Cache geocoded results
  - Batch geocode during off-peak hours
  - Use free tier (40,000 requests/month)
  - Fallback to OpenStreetMap Nominatim (free, no API key)

### **Geocoding Accuracy**
- **Risk:** Addresses may not geocode correctly
- **Mitigation:**
  - Validate addresses before geocoding
  - Manual review of failed geocodes
  - Allow manual lat/lng entry in tenant settings

### **Performance**
- **Risk:** Location queries may be slow
- **Mitigation:**
  - Use geospatial indexes (GIST)
  - Limit radius to reasonable values (50 miles max)
  - Cache popular location queries
  - Use MV for pre-computed data

### **Data Quality**
- **Risk:** Incomplete tenant addresses
- **Mitigation:**
  - Require complete addresses for directory listings
  - Validate address format on tenant creation
  - Provide address autocomplete in UI

---

## Future Enhancements (Phase 6+)

### **Advanced Location Features**
- Multi-location search (polygon/bounding box)
- "Near me" using browser geolocation
- Location-based trending (what's popular nearby)
- Delivery radius filtering

### **Category Enhancements**
- Multi-category filtering (AND/OR logic)
- Category hierarchy navigation
- Related categories suggestions
- Category-specific trending scores

### **Hybrid Scopes**
- Location + Category (e.g., "Grocery stores near me")
- Location + Bucket Type (e.g., "Sale items within 10 miles")
- Category + Shop Category (e.g., "Electronics from Tech Stores")

---

## Conclusion

Phase 5 adds powerful discovery capabilities through category and location filtering. The implementation is incremental, with low-risk category scopes first (5A & 5B), followed by the more complex location scope (5C).

**Recommended Approach:**
1. Start with Phase 5A (Product Category) - Quick win, low risk
2. Follow with Phase 5B (Shop Category) - Builds on existing MV
3. Finish with Phase 5C (Location) - Most complex, highest value

**Total Effort:** 8 days (48 hours)
**Expected Completion:** 2 weeks with testing and QA
