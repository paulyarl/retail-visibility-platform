# 🚀 Directory Phase 1 - Implementation Kickoff

**Date:** November 10, 2025  
**Phase:** 1 - Foundation & Basic Discovery  
**Duration:** 4 weeks  
**Status:** Ready to Start

---

## 📋 **Phase 1 Overview**

**Goal:** Build the foundation for a professional directory that auto-syncs all merchant storefronts into a searchable, filterable discovery network.

**Key Deliverables:**
1. Database schema with auto-sync from tenants
2. Search API with filtering
3. Directory homepage with grid view
4. Store card components
5. Auto-publish all existing storefronts

---

## 🎯 **Week-by-Week Breakdown**

### **Week 1: Database & Backend**
- [ ] Create database migration
- [ ] Set up auto-sync triggers
- [ ] Backfill existing tenants
- [ ] Build search API endpoints

### **Week 2: Frontend Foundation**
- [ ] Create directory homepage
- [ ] Build store card component
- [ ] Implement search UI
- [ ] Add filter sidebar

### **Week 3: Search & Filters**
- [ ] Category filtering
- [ ] Location filtering
- [ ] Distance calculation
- [ ] Rating filtering
- [ ] Sorting options

### **Week 4: Polish & Deploy**
- [ ] Loading states
- [ ] Empty states
- [ ] Mobile responsive
- [ ] Performance optimization
- [ ] Deploy to staging

---

## 📊 **Implementation Order**

### **Step 1: Database Migration** (Day 1-2)
**Priority:** P0 - Everything depends on this

**File:** `apps/api/prisma/migrations/XXX_create_directory.sql`

**What to Build:**
```sql
-- Main directory table
CREATE TABLE directory_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- NAP Data (synced from TenantBusinessProfile)
  business_name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(2) DEFAULT 'US',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  
  -- Geolocation (PostGIS)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geolocation GEOGRAPHY(POINT, 4326),
  
  -- Categories (GMB-aligned)
  primary_category VARCHAR(100),
  secondary_categories VARCHAR(100)[],
  gbp_category_id UUID REFERENCES gbp_categories(id),
  
  -- Metadata
  logo_url TEXT,
  description TEXT,
  business_hours JSONB,
  features JSONB, -- {delivery: true, pickup: true, etc}
  
  -- Stats
  rating_avg DECIMAL(2,1) DEFAULT 0,
  rating_count INT DEFAULT 0,
  product_count INT DEFAULT 0,
  
  -- Premium
  is_featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMP,
  
  -- Privacy
  map_privacy_mode VARCHAR(20) DEFAULT 'precise', -- precise, neighborhood, hidden
  display_map BOOLEAN DEFAULT true,
  
  -- Tier-based features
  subscription_tier VARCHAR(50),
  use_custom_website BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_directory_geolocation ON directory_listings USING GIST(geolocation);
CREATE INDEX idx_directory_category ON directory_listings(primary_category);
CREATE INDEX idx_directory_city_state ON directory_listings(city, state);
CREATE INDEX idx_directory_rating ON directory_listings(rating_avg DESC);
CREATE INDEX idx_directory_featured ON directory_listings(is_featured, featured_until);

-- Full-text search
CREATE INDEX idx_directory_search ON directory_listings 
  USING GIN(to_tsvector('english', business_name || ' ' || COALESCE(description, '')));
```

**Auto-Sync Trigger:**
```sql
-- Trigger to auto-sync from tenants
CREATE OR REPLACE FUNCTION sync_directory_listing()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if storefront is enabled
  IF NEW.storefront_enabled = true THEN
    INSERT INTO directory_listings (
      tenant_id,
      business_name,
      address,
      city,
      state,
      zip_code,
      phone,
      email,
      website,
      latitude,
      longitude,
      geolocation,
      logo_url,
      subscription_tier
    )
    SELECT 
      tbp.tenant_id,
      tbp.business_name,
      CONCAT_WS(', ', tbp.address_line1, tbp.address_line2),
      tbp.city,
      tbp.state,
      tbp.postal_code,
      tbp.phone_number,
      tbp.email,
      tbp.website,
      tbp.latitude,
      tbp.longitude,
      ST_SetSRID(ST_MakePoint(tbp.longitude, tbp.latitude), 4326)::geography,
      tbp.logo_url,
      NEW.subscription_tier
    FROM tenant_business_profile tbp
    WHERE tbp.tenant_id = NEW.id
    ON CONFLICT (tenant_id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_directory
  AFTER INSERT OR UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION sync_directory_listing();
```

**Backfill Script:**
```sql
-- Backfill all existing tenants with storefronts
INSERT INTO directory_listings (
  tenant_id,
  business_name,
  address,
  city,
  state,
  zip_code,
  phone,
  email,
  website,
  latitude,
  longitude,
  geolocation,
  logo_url,
  subscription_tier
)
SELECT 
  t.id,
  tbp.business_name,
  CONCAT_WS(', ', tbp.address_line1, tbp.address_line2),
  tbp.city,
  tbp.state,
  tbp.postal_code,
  tbp.phone_number,
  tbp.email,
  tbp.website,
  tbp.latitude,
  tbp.longitude,
  ST_SetSRID(ST_MakePoint(tbp.longitude, tbp.latitude), 4326)::geography,
  tbp.logo_url,
  t.subscription_tier
FROM tenants t
JOIN tenant_business_profile tbp ON tbp.tenant_id = t.id
WHERE t.storefront_enabled = true
ON CONFLICT (tenant_id) DO NOTHING;
```

---

### **Step 2: Search API** (Day 3-4)
**Priority:** P0 - Frontend depends on this

**File:** `apps/api/src/routes/directory.ts`

**Endpoints to Build:**

#### **GET /api/directory/search**
```typescript
interface SearchParams {
  q?: string;                    // Search query
  category?: string;             // Primary category
  categories?: string[];         // Multiple categories (OR)
  city?: string;                 // Filter by city
  state?: string;                // Filter by state
  lat?: number;                  // User latitude
  lng?: number;                  // User longitude
  radius?: number;               // Radius in miles (default 25)
  minRating?: number;            // Minimum rating (1-5)
  features?: string[];           // delivery, pickup, etc
  openNow?: boolean;             // Filter by business hours
  sort?: 'relevance' | 'distance' | 'rating' | 'newest';
  page?: number;                 // Pagination
  limit?: number;                // Results per page (default 24)
}

interface SearchResponse {
  listings: DirectoryListing[];
  total: number;
  page: number;
  pages: number;
  filters: {
    categories: { name: string; count: number }[];
    cities: { name: string; state: string; count: number }[];
  };
}
```

#### **GET /api/directory/categories**
```typescript
interface CategoriesResponse {
  categories: {
    id: string;
    name: string;
    slug: string;
    count: number;
  }[];
}
```

#### **GET /api/directory/locations**
```typescript
interface LocationsResponse {
  locations: {
    city: string;
    state: string;
    slug: string;
    count: number;
  }[];
}
```

---

### **Step 3: Directory Homepage** (Day 5-7)
**Priority:** P0 - User-facing entry point

**File:** `apps/web/src/app/directory/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Hero Section                                │
│ ┌─────────────────────────────────────────┐ │
│ │ 🔍 Search stores near you...            │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

┌──────────┬──────────────────────────────────┐
│ Filters  │ Store Grid                       │
│          │ ┌───┐ ┌───┐ ┌───┐               │
│ Category │ │ 1 │ │ 2 │ │ 3 │               │
│ □ Grocery│ └───┘ └───┘ └───┘               │
│ □ Retail │ ┌───┐ ┌───┐ ┌───┐               │
│          │ │ 4 │ │ 5 │ │ 6 │               │
│ Location │ └───┘ └───┘ └───┘               │
│ □ Brooklyn│                                 │
│ □ Manhattan│                                │
│          │                                  │
│ Rating   │                                  │
│ ⭐⭐⭐⭐⭐   │                                  │
└──────────┴──────────────────────────────────┘
```

**Component Structure:**
```typescript
export default function DirectoryPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <DirectoryHero />
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <DirectoryFilters />
          </aside>
          
          {/* Store Grid */}
          <main className="lg:col-span-3">
            <DirectoryGrid />
          </main>
        </div>
      </div>
    </div>
  );
}
```

---

### **Step 4: Store Card Component** (Day 8-9)
**Priority:** P0 - Core UI component

**File:** `apps/web/src/components/directory/StoreCard.tsx`

**Design:**
```
┌─────────────────────────────────┐
│ [Logo]  Store Name          ⭐4.8│
│         Category • City, ST      │
│                                  │
│ 📍 2.3 miles away               │
│ 🛍️ 142 products                 │
│ 🟢 Open now                      │
│                                  │
│ [View Storefront →]             │
└─────────────────────────────────┘
```

**Implementation:**
```typescript
interface StoreCardProps {
  listing: {
    id: string;
    slug: string;
    businessName: string;
    logoUrl?: string;
    primaryCategory: string;
    city: string;
    state: string;
    ratingAvg: number;
    ratingCount: number;
    productCount: number;
    distance?: number;
    isOpen?: boolean;
    isFeatured?: boolean;
    subscriptionTier: string;
    useCustomWebsite: boolean;
    websiteUrl?: string;
  };
}

export function StoreCard({ listing }: StoreCardProps) {
  // Determine destination URL based on tier and settings
  const canUseCustomUrl = ['professional', 'enterprise', 'organization'].includes(
    listing.subscriptionTier
  );
  
  const destinationUrl = 
    canUseCustomUrl && listing.useCustomWebsite && listing.websiteUrl
      ? listing.websiteUrl
      : `/s/${listing.slug}`;
  
  const ctaText = 
    canUseCustomUrl && listing.useCustomWebsite && listing.websiteUrl
      ? 'Visit Website'
      : 'View Storefront';
  
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4">
      {/* Featured badge */}
      {listing.isFeatured && (
        <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded mb-2">
          Featured
        </span>
      )}
      
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Logo */}
        <div className="w-16 h-16 bg-neutral-100 rounded-lg shrink-0">
          {listing.logoUrl && (
            <img src={listing.logoUrl} alt={listing.businessName} className="w-full h-full object-cover rounded-lg" />
          )}
        </div>
        
        {/* Name & Rating */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-neutral-900 truncate">
            {listing.businessName}
          </h3>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>{listing.primaryCategory}</span>
            <span>•</span>
            <span>{listing.city}, {listing.state}</span>
          </div>
        </div>
        
        {/* Rating */}
        {listing.ratingAvg > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-yellow-500">⭐</span>
            <span className="font-semibold">{listing.ratingAvg.toFixed(1)}</span>
          </div>
        )}
      </div>
      
      {/* Stats */}
      <div className="space-y-1 text-sm text-neutral-600 mb-4">
        {listing.distance && (
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>{listing.distance.toFixed(1)} miles away</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span>🛍️</span>
          <span>{listing.productCount} products</span>
        </div>
        {listing.isOpen !== undefined && (
          <div className="flex items-center gap-2">
            <span className={listing.isOpen ? 'text-green-600' : 'text-red-600'}>
              {listing.isOpen ? '🟢' : '🔴'}
            </span>
            <span>{listing.isOpen ? 'Open now' : 'Closed'}</span>
          </div>
        )}
      </div>
      
      {/* CTA */}
      <a
        href={destinationUrl}
        className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        target={canUseCustomUrl && listing.useCustomWebsite ? '_blank' : undefined}
        rel={canUseCustomUrl && listing.useCustomWebsite ? 'noopener noreferrer' : undefined}
      >
        {ctaText} →
      </a>
    </div>
  );
}
```

---

## ✅ **Phase 1 Acceptance Criteria**

### **Database**
- [ ] Migration runs successfully
- [ ] Auto-sync trigger works
- [ ] All existing tenants backfilled
- [ ] PostGIS extension enabled
- [ ] Indexes created

### **API**
- [ ] Search endpoint returns results
- [ ] Category filtering works
- [ ] Location filtering works
- [ ] Distance calculation accurate
- [ ] Pagination works
- [ ] Response time < 500ms

### **Frontend**
- [ ] Directory homepage loads
- [ ] Search functionality works
- [ ] Filters update results
- [ ] Store cards display correctly
- [ ] CTA buttons work (storefront vs custom URL)
- [ ] Mobile responsive
- [ ] Loading states
- [ ] Empty states

### **Performance**
- [ ] Page load < 2s
- [ ] Lighthouse score > 90
- [ ] Mobile performance good

---

## 🧪 **Testing Plan**

### **Unit Tests**
```bash
# API tests
npm test apps/api/src/routes/directory.test.ts

# Component tests
npm test apps/web/src/components/directory/*.test.tsx
```

### **E2E Tests**
```bash
# Playwright tests
npx playwright test directory-search
npx playwright test directory-filters
npx playwright test directory-mobile
```

### **Manual Testing Checklist**
- [ ] Search for "grocery"
- [ ] Filter by category "restaurants"
- [ ] Filter by city "Brooklyn"
- [ ] Filter by rating (4+ stars)
- [ ] Sort by distance
- [ ] Sort by rating
- [ ] Click through to storefront
- [ ] Click through to custom website (Pro tier)
- [ ] Test on iPhone
- [ ] Test on Android
- [ ] Test on tablet

---

## 📝 **Next Steps**

1. **Review this kickoff plan** - Make sure we're aligned
2. **Start with database migration** - Foundation first
3. **Build API endpoints** - Backend ready
4. **Create frontend components** - User-facing
5. **Test thoroughly** - Quality matters
6. **Deploy to staging** - Get feedback

---

## 🎯 **Success Metrics for Phase 1**

| Metric | Target |
|--------|--------|
| **Migration Success** | 100% of tenants synced |
| **API Response Time** | < 500ms |
| **Page Load Time** | < 2s |
| **Mobile Performance** | Lighthouse > 90 |
| **Zero Errors** | No console errors |

---

**Ready to start building the directory foundation!** 🚀

Let me know when you're ready to begin, and we'll start with the database migration.
