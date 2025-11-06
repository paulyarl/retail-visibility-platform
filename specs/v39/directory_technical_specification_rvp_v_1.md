# Directory Technical Specification - Retail Visibility Platform v1.0

**Document Owner:** Product & Engineering Team  
**Date:** 2025-11-06  
**Status:** Draft  
**Version:** 1.0

---

## Executive Summary

The **Directory** is a public discovery platform that transforms isolated merchant storefronts into a connected network. It enables customers to search, browse, and discover local stores by category, location, and other filters, creating network effects that benefit all merchants on the platform.

**Key Features:**
- Full-text search across stores and products
- Category and location filtering
- Interactive map view with clustering
- Store ratings and reviews
- Premium listing placements
- SEO-optimized pages for organic traffic
- Mobile-first responsive design

**Strategic Value:**
- Creates network effects (more merchants = more traffic for all)
- Drives 20-40% of storefront traffic from directory
- Enables premium listing monetization ($336K-672K/year)
- Improves merchant retention (+10-15%)
- Builds brand authority as THE local retail marketplace

---

## Goals & Objectives

### Primary Goals

1. **Discovery Engine:** Enable customers to easily find local stores
2. **Network Effects:** Create compounding value as merchant base grows
3. **Traffic Driver:** Generate 20-40% of storefront traffic from directory
4. **SEO Dominance:** Rank for thousands of local search keywords
5. **Monetization:** Enable premium listings and advertising revenue

### Success Criteria

- **Traffic:** 50K+ directory page views/month (Year 1)
- **Conversion:** 15-25% of directory visitors click through to storefronts
- **SEO:** Top 10 rankings for 100+ category/location keywords
- **Engagement:** 3+ pages per session, 2+ minute session duration
- **Monetization:** 10-15% of merchants upgrade to premium listings
- **Retention:** +10-15% improvement in merchant retention

---

## System Architecture

### High-Level Architecture

```
Client Layer (Desktop, Tablet, Mobile Browsers)
    ↓ HTTPS
Next.js App Router
    /directory (main page)
    /directory/search (search results)
    /directory/[category] (category pages)
    /directory/[city]-[state] (location pages)
    /directory/[slug] (individual listing)
    ↓ API Calls
API Layer (Express)
    GET  /api/directory/search
    GET  /api/directory/categories
    GET  /api/directory/locations
    GET  /api/directory/:slug
    POST /api/directory/:slug/review
    POST /api/directory/:slug/favorite
    ↓ Database Queries
PostgreSQL + PostGIS
    • tenants (existing)
    • directory_listings (new)
    • directory_reviews (new)
    • directory_favorites (new)
    • directory_views (analytics)
    • directory_collections (curated)
```

---

## Data Model

### Core Tables

**directory_listings**
- Extends tenants with directory-specific fields
- Auto-syncs from tenants table via trigger
- Includes SEO, categorization, location, stats
- **GMB Category Alignment:** Syncs from `TenantBusinessProfile.gbpCategoryId` (FK to `GBPCategory`)
- **Multiple Categories:** Supports `primary_category` + `secondary_categories[]` array
- **Category Hierarchy:** Aligns with platform's existing GMB category sync system

**directory_reviews**
- Customer reviews with 1-5 star ratings
- Merchant responses
- Moderation flags
- Helpful/not helpful votes

**directory_favorites**
- User favorites (many-to-many)
- Requires authentication

**directory_views**
- Analytics tracking
- Session, referrer, location data

**directory_collections**
- Curated lists (e.g., "Top Rated Grocery Stores")
- Platform admin managed

### GMB Category Integration

**Existing Platform Infrastructure:**
- `GBPCategory` table: Local cache of Google Business Profile categories
- `TenantBusinessProfile.gbpCategoryId`: FK relation to GBPCategory
- `TenantBusinessProfile.gbpCategorySyncStatus`: Sync status tracking
- `TenantCategory`: Vendor-owned custom categories with `googleCategoryId` mapping
- **Bi-directional Sync:** Tenant ↔ GMB category synchronization

**Directory Category Strategy:**
1. **Primary Category:** Synced from `TenantBusinessProfile.gbpCategory.name`
2. **Secondary Categories:** Derived from `TenantCategory` with `googleCategoryId` mappings
3. **Fallback:** If no GMB category, use tenant's custom category or default to "retail"
4. **Sync Trigger:** Auto-update directory listing when GMB category changes

**Category Mapping Examples:**
- GMB: "Restaurant" → Directory: "restaurants"
- GMB: "Grocery Store" → Directory: "grocery"
- GMB: "Pet Store" → Directory: "pet"
- GMB: "Hardware Store" → Directory: "home"

---

### NAP Data Integration (Name, Address, Phone)

**Existing Platform Infrastructure:**
- `TenantBusinessProfile`: Complete NAP data storage
  - `businessName`: Business name
  - `addressLine1`, `addressLine2`: Street address
  - `city`, `state`, `postalCode`, `countryCode`: Location data
  - `phoneNumber`: Contact phone
  - `email`, `website`: Additional contact info
  - `latitude`, `longitude`: Geocoded coordinates
  - `displayMap`: Map visibility toggle
  - `mapPrivacyMode`: Precise vs neighborhood display

**Directory NAP Strategy:**
1. **Business Name:** Synced from `TenantBusinessProfile.businessName`
2. **Address:** Complete address from `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`
3. **Phone:** Synced from `TenantBusinessProfile.phoneNumber`
4. **Coordinates:** Latitude/longitude for geospatial queries and map display
5. **Privacy Respect:** Honor `mapPrivacyMode` setting (precise vs neighborhood)

**Google Maps Integration:**
- **Existing Feature:** Platform already has Google Maps integration (`FF_MAP_CARD`)
- **API Key:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (already configured)
- **Map Display:** Embedded Google Maps on storefront pages
- **Directory Maps:** Leverage same infrastructure for directory map view
- **Geocoding:** Use existing lat/lng from `TenantBusinessProfile`
- **Privacy Mode:** Respect merchant's `mapPrivacyMode` preference

**NAP Data Sync Flow:**
```
TenantBusinessProfile (Source of Truth)
    ↓
Auto-Sync Trigger
    ↓
directory_listings (Denormalized for Performance)
    ↓
Directory Search & Map View
```

**Denormalized Fields for Performance:**
- `business_name` - Direct copy from TenantBusinessProfile
- `address` - Concatenated full address
- `city`, `state`, `zip_code` - Individual fields for filtering
- `latitude`, `longitude` - Geocoded coordinates
- `geolocation` - PostGIS geography point for spatial queries

---

### Website Destination Strategy (Tier-Based)

**Default Behavior:**
- All directory store cards link to tenant's **platform storefront** (`/s/[slug]`)
- This drives traffic to the platform and showcases the storefront
- Maintains platform branding and ecosystem

**Tier-Based Flexibility:**

| Tier | Website Destination | Custom URL Allowed | Rationale |
|------|---------------------|-------------------|-----------|
| **Google-Only** ($29/mo) | Platform storefront only | ❌ No | Entry tier, platform branding |
| **Starter** ($49/mo) | Platform storefront only | ❌ No | Standard tier, platform branding |
| **Professional** ($499/mo) | Platform storefront (default) | ✅ Yes (optional) | Premium tier, flexibility |
| **Enterprise** ($999/mo) | Platform storefront (default) | ✅ Yes (optional) | White-label, full control |
| **Organization** ($999/mo) | Platform storefront (default) | ✅ Yes (optional) | Multi-location, flexibility |

**Implementation:**
```typescript
// directory_listings table
website_url: string | null  // Custom website URL (Professional+ only)
use_custom_website: boolean // Toggle to use custom URL vs storefront

// Logic for "View Store" button
const destinationUrl = listing.use_custom_website && listing.website_url
  ? listing.website_url  // Custom URL (Professional+)
  : `/s/${listing.slug}`; // Platform storefront (default)
```

**Benefits:**
1. **Platform Traffic:** Lower tiers drive traffic to platform storefronts
2. **Premium Value:** Higher tiers get flexibility to use their own website
3. **White-Label Support:** Enterprise can fully brand their presence
4. **Upsell Opportunity:** "Want to link to your own website? Upgrade to Professional"
5. **Analytics:** Track which merchants use custom URLs vs storefronts

**Validation Rules:**
- Custom URL must be valid HTTPS URL
- Custom URL only available for Professional, Enterprise, Organization tiers
- Platform storefront always available as fallback
- Merchants can toggle between custom URL and storefront

**UI/UX:**
```
Store Card:
┌────────────────────────────────────┐
│ [Logo] Store Name            ⭐ 4.8│
│ Category • City, State             │
│                                    │
│ "Short description..."             │
│                                    │
│ 📍 1.2 mi • 🕒 Open • 📦 500+ SKUs │
│                                    │
│ [View Storefront] ← Default        │
│ or                                 │
│ [Visit Website] ← If custom URL    │
└────────────────────────────────────┘

Professional+ Settings:
┌────────────────────────────────────┐
│ Directory Listing Settings         │
│                                    │
│ Website Destination:               │
│ ○ Platform Storefront (default)   │
│ ● Custom Website                   │
│                                    │
│ Custom URL:                        │
│ [https://example.com         ]     │
│                                    │
│ Preview: [View Storefront]         │
│                                    │
│ [Save Changes]                     │
└────────────────────────────────────┘
```

### Key Indexes

- Full-text search (GIN index on tsvector)
- Geospatial queries (PostGIS GIST index)
- Category and location filtering (includes GMB categories)
- Rating and featured sorting
- GMB category FK index for sync performance

---

## API Contracts

### GET /api/directory/search

**Query Parameters:**
- `q` - Search query
- `category` - Primary category
- `city`, `state` - Location filters
- `lat`, `lng`, `radius` - Distance filtering
- `minRating` - Minimum rating (1-5)
- `features` - Array of features (delivery, pickup, etc.)
- `openNow` - Boolean
- `sort` - relevance | distance | rating | newest
- `page`, `limit` - Pagination

**Response:**
```json
{
  "listings": [
    {
      "id": "uuid",
      "slug": "store-name",
      "businessName": "Store Name",
      "shortDescription": "...",
      "primaryCategory": "grocery",
      "city": "Brooklyn",
      "state": "NY",
      "distance": 1.2,
      "rating": 4.8,
      "reviewCount": 127,
      "productCount": 500,
      "logoUrl": "...",
      "features": ["delivery", "curbside_pickup"],
      "isOpen": true,
      "isFeatured": false,
      "storefrontUrl": "/s/store-name"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /api/directory/:slug

Get detailed listing with reviews and related stores.

### POST /api/directory/:slug/review

Submit review (requires authentication).

**Request:**
```json
{
  "rating": 5,
  "title": "Great store!",
  "content": "...",
  "photos": ["url1", "url2"]
}
```

### POST /api/directory/:slug/favorite

Toggle favorite (requires authentication).

---

## Frontend Components

### Key Components

1. **DirectoryHero** - Hero section with search
2. **FeaturedCarousel** - Premium listings carousel
3. **FilterSidebar** - Category, location, rating filters
4. **StoreCard** - Grid view store card
5. **MapView** - Interactive map with markers
6. **StoreDetail** - Individual listing page
7. **ReviewSection** - Reviews with ratings
8. **RelatedStores** - Discovery loop

### Design System

**Professional, Modern, Clean:**
- Tailwind CSS for styling
- shadcn/ui components
- Lucide icons
- Framer Motion animations
- Responsive grid layouts
- Mobile-first approach

**Color Palette:**
- Primary: Blue (#2563EB)
- Secondary: Indigo (#4F46E5)
- Success: Green (#10B981)
- Warning: Amber (#F59E0B)
- Neutral: Gray scale

---

## Search & Filtering

### Full-Text Search

PostgreSQL `tsvector` with GIN index:
```sql
to_tsvector('english', 
  business_name || ' ' || 
  description || ' ' || 
  array_to_string(tags, ' ')
)
```

### Geospatial Queries

PostGIS for distance calculations:
```sql
ST_DWithin(
  geolocation,
  ST_MakePoint(lng, lat)::geography,
  radius_in_meters
)
```

### Filtering Options

- **Category:** Primary category
- **Location:** City, state, radius
- **Rating:** Minimum rating
- **Features:** Delivery, pickup, online orders
- **Open Now:** Based on business hours
- **Sort:** Relevance, distance, rating, newest

---

## SEO Strategy

### Auto-Generated Pages

**Category Pages:**
- `/directory/grocery`
- `/directory/restaurants`
- Target: "[category] stores near me"

**Location Pages:**
- `/directory/brooklyn-ny`
- `/directory/manhattan-ny`
- Target: "stores in [city]"

**Combined Pages:**
- `/directory/grocery/brooklyn-ny`
- Target: "[category] stores in [city]"

### SEO Optimization

- Unique meta titles and descriptions
- Structured data (JSON-LD)
- Canonical URLs
- XML sitemaps
- Internal linking
- Image optimization
- Mobile-friendly

---

## Performance Requirements

- **Page Load:** < 2 seconds (LCP)
- **Search Response:** < 500ms
- **Map Rendering:** < 1 second
- **Infinite Scroll:** Smooth, no jank
- **Image Loading:** Lazy loading, WebP format
- **Caching:** Redis for frequently accessed data

---

## Security & Privacy

- **Authentication:** JWT tokens for user actions
- **Authorization:** Role-based access control
- **Rate Limiting:** Prevent abuse
- **Input Validation:** Zod schemas
- **SQL Injection:** Parameterized queries
- **XSS Protection:** Content sanitization
- **GDPR Compliance:** Cookie consent, data export

---

## Analytics & Tracking

### Metrics to Track

- Page views (directory, category, location, listing)
- Click-through rate (directory → storefront)
- Search queries and results
- Filter usage
- Map interactions
- Review submissions
- Favorite actions
- Session duration
- Bounce rate

### Tools

- Google Analytics 4
- Custom event tracking
- Heatmaps (Hotjar)
- A/B testing (Vercel Analytics)

---

## Monetization Integration

### Premium Listings

**Tiers:**
- Featured: $50/mo (top of category)
- Sponsored: $100/mo (top of search)
- Premium: $200/mo (homepage carousel)

**Implementation:**
- `is_featured`, `is_sponsored` flags
- `featured_until`, `sponsored_until` timestamps
- Automatic expiration
- Stripe subscription integration

### Advertising

- Platform upgrade banners (lower tiers)
- Google AdSense (sidebar, footer)
- Sponsored placements

---

## Testing Strategy

### Unit Tests
- API endpoints
- Database queries
- Search algorithms
- Filter logic

### Integration Tests
- Search flow
- Review submission
- Favorite actions
- Premium listing display

### E2E Tests (Playwright)
- Directory homepage
- Search and filter
- Map view
- Store detail page
- Review submission

### Performance Tests
- Load testing (k6)
- Search performance
- Map rendering
- Database query optimization

---

## Rollout Plan

### Phase 1: MVP (Weeks 1-4)
- Basic directory page
- Search and category filtering
- Grid view with store cards
- Auto-publish all existing tenants
- SEO foundation

### Phase 2: Enhanced Discovery (Weeks 5-8)
- Map view
- Advanced filtering
- Location-based search
- Related stores
- SEO optimization

### Phase 3: Social & Monetization (Weeks 9-12)
- Reviews and ratings
- User favorites
- Premium listings
- Analytics dashboard
- A/B testing

---

## Success Metrics

| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| Directory Page Views | 50K/mo | Google Analytics |
| CTR to Storefronts | 15-25% | Event tracking |
| SEO Rankings | Top 10 for 100+ keywords | SEMrush |
| User Engagement | 3+ pages/session | Analytics |
| Premium Adoption | 10-15% | Conversion tracking |
| Merchant Retention | +10-15% | Churn analysis |

---

## Dependencies

- **Existing:** Tenants table, storefronts
- **New:** PostgreSQL PostGIS extension
- **External:** Mapbox/Leaflet for maps
- **Services:** Stripe for premium listings

---

## Risks & Mitigation

### Risk 1: Low Adoption
**Mitigation:** Auto-publish all tenants, promote via email

### Risk 2: Poor SEO Performance
**Mitigation:** Hire SEO consultant, optimize content

### Risk 3: Map Performance Issues
**Mitigation:** Marker clustering, lazy loading

### Risk 4: Review Spam
**Mitigation:** Moderation tools, verification system

---

## Appendix

### Categories

- Grocery & Food
- Restaurants & Cafes
- Retail & Shopping
- Health & Beauty
- Home & Garden
- Automotive
- Pet Supplies
- Electronics
- Clothing & Apparel
- Specialty Stores

### Features

- Delivery available
- Curbside pickup
- Online orders
- Accepts credit cards
- Wheelchair accessible
- Free parking
- Open late
- Family-friendly

---

**End of Technical Specification**
