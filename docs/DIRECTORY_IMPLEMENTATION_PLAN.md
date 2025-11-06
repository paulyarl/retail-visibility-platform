# Directory Implementation Plan - Retail Visibility Platform

**Document Owner:** Engineering Team  
**Date:** 2025-11-06  
**Status:** Ready for Implementation  
**Linked Spec:** `specs/v39/directory_technical_specification_rvp_v_1.md`

---

## Overview

This implementation plan follows the proven storefront blueprint to create a professional, SEO-optimized directory that connects all merchant storefronts into a discovery network. The directory will drive 20-40% of storefront traffic and enable premium listing monetization.

---

## Spec-to-Phase Quick Reference

| Spec Section | Implementation Phase | Weeks | Priority |
|--------------|---------------------|-------|----------|
| Data Model & Auto-Sync | Phase 1 | 1-2 | P0 |
| Search API & Filtering | Phase 1 | 2-3 | P0 |
| Directory Homepage | Phase 1 | 3-4 | P0 |
| SEO Landing Pages | Phase 2 | 5-6 | P0 |
| Map View | Phase 2 | 7-8 | P1 |
| Reviews & Ratings | Phase 3 | 9-10 | P1 |
| Premium Listings | Phase 3 | 11-12 | P1 |
| Analytics Dashboard | Phase 4 | 13-14 | P2 |
| Collections (Curated) | Phase 4 | 15-16 | P2 |

---

## Phase 1: Foundation & Basic Discovery (Weeks 1-4)

### 📋 Spec Reference
- **Data Model** (Spec Section 5)
- **API Contracts** (Spec Section 6)
- **Frontend Components** (Spec Section 7)
- **Search & Filtering** (Spec Section 9)

### Context from Spec

The foundation establishes core directory infrastructure:
1. Database schema with auto-sync from tenants table
2. Full-text search with PostgreSQL + PostGIS
3. Basic UI with grid view and filters
4. Auto-publish all existing storefronts

**Technical Requirements:**
- PostgreSQL GIN indexes for full-text search
- PostGIS GIST indexes for geospatial queries
- Trigger-based auto-sync from tenants
- Mobile-first responsive design

---

### 🎯 Goals

- ✅ Create database schema with auto-sync
- ✅ Implement search API with filtering
- ✅ Build directory homepage with grid view
- ✅ Auto-publish all existing tenants
- ✅ Deploy to staging

---

### 📊 Deliverables

#### 1.1 Database Migration

**File:** `apps/api/prisma/migrations/XXX_create_directory.sql`

**Key Tables:**
- `directory_listings` - Main directory table (extends tenants)
- Auto-sync trigger from tenants table
- Full-text search indexes
- PostGIS geospatial indexes
- **GMB Category Integration:**
  - `primary_category` - Synced from `TenantBusinessProfile.gbpCategory.name`
  - `secondary_categories[]` - Array from `TenantCategory` with `googleCategoryId` mappings
  - `gbp_category_id` - FK reference to `GBPCategory` table
  - Auto-updates when GMB category changes via trigger

**Backfill:** Sync all existing tenants with `storefront_enabled = true`

**GMB Category Sync Logic:**
```sql
-- Sync primary category from GBP
primary_category = COALESCE(
  (SELECT LOWER(REPLACE(name, ' ', '_')) 
   FROM gbp_categories gc 
   JOIN tenant_business_profile tbp ON tbp.gbp_category_id = gc.id 
   WHERE tbp.tenant_id = NEW.id),
  'retail' -- fallback
)

-- Sync secondary categories from TenantCategory
secondary_categories = ARRAY(
  SELECT LOWER(REPLACE(name, ' ', '_'))
  FROM tenant_category
  WHERE tenant_id = NEW.id 
    AND google_category_id IS NOT NULL
    AND is_active = true
)
```

---

#### 1.2 Search API

**File:** `apps/api/src/routes/directory.ts`

**Endpoints:**
- `GET /api/directory/search` - Search with filters
- `GET /api/directory/categories` - Category list with counts
- `GET /api/directory/locations` - Location list with counts

**Features:**
- Full-text search (business name, description, tags)
- **Category filtering (GMB-aligned):**
  - Filter by primary GMB category
  - Filter by secondary categories
  - Multi-category support (OR logic)
- Location filtering (city, state, radius)
- Distance calculation (PostGIS)
- Rating filtering
- Features filtering (delivery, pickup, etc.)
- Open now filtering (business hours)
- Sorting (relevance, distance, rating, newest)
- Pagination

**GMB Category Filtering:**
```typescript
// Support filtering by GMB categories
if (params.category) {
  query = query.where(
    sql`primary_category = ${params.category} 
        OR ${params.category} = ANY(secondary_categories)`
  );
}

// Support multiple categories (OR logic)
if (params.categories && params.categories.length > 0) {
  query = query.where(
    sql`primary_category = ANY(${params.categories}) 
        OR secondary_categories && ${params.categories}`
  );
}
```

---

#### 1.3 Directory Homepage

**File:** `apps/web/src/app/directory/page.tsx`

**Components:**
- Hero section with search bar
- Filter sidebar (category, location, rating)
- Store cards grid (3 columns on desktop)
- Loading states
- Empty states
- Pagination

**Design:**
- Professional, modern, clean
- Blue/indigo gradient hero
- Card-based layout
- Mobile-first responsive

---

#### 1.4 Store Card Component

**File:** `apps/web/src/components/directory/StoreCard.tsx`

**Features:**
- Store logo and name
- Category and location
- Rating with stars
- Distance (if location provided)
- Product count
- Open/closed status
- Featured badge
- View Storefront CTA

---

### ✅ Acceptance Criteria

- [ ] Database migration runs successfully
- [ ] All existing tenants synced to directory
- [ ] Search API returns filtered results
- [ ] Directory homepage loads < 2s
- [ ] Search functionality works
- [ ] Category filtering works
- [ ] Location filtering works
- [ ] Mobile responsive (tested on 3 devices)
- [ ] Deployed to staging

---

### 🧪 Testing

```bash
# Unit tests
npm test apps/api/src/routes/directory.test.ts

# E2E tests
npx playwright test directory-search

# Manual testing
- [ ] Search for "grocery"
- [ ] Filter by category "restaurants"
- [ ] Filter by city "Brooklyn"
- [ ] Sort by rating
- [ ] Click through to storefront
- [ ] Test on mobile (iPhone, Android)
```

---

## Phase 2: Enhanced Discovery & SEO (Weeks 5-8)

### 📋 Spec Reference
- **SEO Strategy** (Spec Section 10)
- **Map View** (Spec Section 7)
- **Performance Requirements** (Spec Section 11)

### Context from Spec

Phase 2 enhances discovery and establishes SEO foundation:
- Interactive map view with clustered markers
- Category landing pages (e.g., `/directory/grocery`)
- Location landing pages (e.g., `/directory/brooklyn-ny`)
- Combined pages (e.g., `/directory/grocery/brooklyn-ny`)
- Related stores for discovery loop

**SEO Targets:**
- "grocery stores in [city]"
- "best [category] near me"
- "stores in [city]"

---

### 🎯 Goals

- ✅ Implement interactive map view
- ✅ Create category landing pages
- ✅ Create location landing pages
- ✅ Add related stores section
- ✅ Optimize performance (< 2s load)

---

### 📊 Deliverables

#### 2.1 Map View

**File:** `apps/web/src/components/directory/MapView.tsx`

**Features:**
- Mapbox GL JS integration
- Marker clustering (zoom to expand)
- Store info popups on click
- Fit bounds to visible markers
- Current location marker
- Filter by category on map

---

#### 2.2 Category Pages

**File:** `apps/web/src/app/directory/[category]/page.tsx`

**SEO:**
- Dynamic meta titles and descriptions
- Structured data (JSON-LD)
- Canonical URLs
- H1 with category name

**Categories:**
- grocery, restaurants, retail, beauty, home, auto, pet, electronics, clothing, specialty

---

#### 2.3 Location Pages

**File:** `apps/web/src/app/directory/[location]/page.tsx`

**Format:** `brooklyn-ny`, `manhattan-ny`

**SEO:**
- "Stores in [City], [State]"
- List all stores in location
- Map view of location
- Neighborhood breakdown

---

#### 2.4 Related Stores

**File:** `apps/web/src/components/directory/RelatedStores.tsx`

**Algorithm:**
- Same category
- Same city/state
- Similar rating
- Exclude current store
- Limit 6 stores

---

### ✅ Acceptance Criteria

- [ ] Map view displays all stores
- [ ] Markers cluster correctly
- [ ] Category pages render with SEO
- [ ] Location pages render with SEO
- [ ] Related stores section works
- [ ] Page load < 2s (Lighthouse)
- [ ] Mobile performance score > 90

---

## Phase 3: Social & Monetization (Weeks 9-12)

### 📋 Spec Reference
- **Reviews & Ratings** (Spec Section 6)
- **Monetization Integration** (Spec Section 14)
- **Analytics & Tracking** (Spec Section 13)

### Context from Spec

Phase 3 adds social features and monetization:
- Reviews and ratings (1-5 stars)
- User favorites (requires auth)
- Premium listing placements
- Merchant analytics dashboard

**Monetization Tiers:**
- Featured: $50/mo (top of category)
- Sponsored: $100/mo (top of search)
- Premium: $200/mo (homepage carousel)

---

### 🎯 Goals

- ✅ Implement reviews system
- ✅ Add user favorites
- ✅ Enable premium listings
- ✅ Build analytics dashboard

---

### 📊 Deliverables

#### 3.1 Reviews System

**Tables:**
- `directory_reviews` - Reviews with ratings
- Update `directory_listings.rating_avg` on new review

**Features:**
- 1-5 star rating
- Title and content
- Photo uploads (optional)
- Merchant responses
- Helpful/not helpful votes
- Moderation flags

---

#### 3.2 Premium Listings

**Stripe Integration:**
- Create subscription products
- Webhook handling
- Auto-expire featured listings
- Merchant upgrade flow

**Display Logic:**
- Featured: Top of category pages
- Sponsored: Top of search results
- Premium: Homepage carousel

---

#### 3.3 Analytics Dashboard

**Merchant Dashboard:**
- Directory views
- Storefront clicks
- CTR from directory
- Review summary
- Premium listing performance

---

### ✅ Acceptance Criteria

- [ ] Users can submit reviews
- [ ] Merchants can respond to reviews
- [ ] Users can favorite stores
- [ ] Premium listings display correctly
- [ ] Stripe subscriptions work
- [ ] Analytics dashboard shows data

---

## Phase 4: Advanced Features (Weeks 13-16)

### 📋 Spec Reference
- **Collections** (Spec Section 5)
- **Analytics & Tracking** (Spec Section 13)

### Context from Spec

Phase 4 adds advanced features:
- Curated collections
- Advanced analytics
- A/B testing
- Performance optimization

---

### 🎯 Goals

- ✅ Create curated collections
- ✅ Advanced analytics
- ✅ A/B testing framework
- ✅ Performance optimization

---

### 📊 Deliverables

#### 4.1 Collections

**Examples:**
- "Top Rated Grocery Stores"
- "New Stores This Month"
- "Pet-Friendly Stores"

**Features:**
- Admin-curated lists
- SEO-optimized pages
- Featured on homepage

---

#### 4.2 Advanced Analytics

**Metrics:**
- Search queries (popular terms)
- Filter usage
- Map interactions
- Conversion funnels
- Cohort analysis

---

### ✅ Acceptance Criteria

- [ ] Collections display on homepage
- [ ] Analytics dashboard complete
- [ ] A/B tests running
- [ ] Performance optimized

---

## Success Metrics

| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| **Directory Page Views** | 50K/mo | Google Analytics |
| **CTR to Storefronts** | 15-25% | Event tracking |
| **SEO Rankings** | Top 10 for 100+ keywords | SEMrush |
| **User Engagement** | 3+ pages/session | Analytics |
| **Premium Adoption** | 10-15% | Conversion tracking |
| **Merchant Retention** | +10-15% | Churn analysis |

---

## Technical Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Mapbox GL JS
- Framer Motion

**Backend:**
- Express.js
- PostgreSQL + PostGIS
- Drizzle ORM
- Zod validation
- Stripe API

**Infrastructure:**
- Vercel (frontend)
- Railway (backend)
- Redis (caching)
- S3 (image storage)

---

## Risk Mitigation

### Risk 1: Low Adoption
**Mitigation:** Auto-publish all tenants, email campaign, in-app promotion

### Risk 2: Poor SEO Performance
**Mitigation:** SEO consultant, content optimization, backlink strategy

### Risk 3: Map Performance
**Mitigation:** Marker clustering, lazy loading, CDN

### Risk 4: Review Spam
**Mitigation:** Moderation tools, verification system, rate limiting

---

## Dependencies

- **Existing:** Tenants table, storefronts, authentication
- **New:** PostgreSQL PostGIS extension
- **External:** Mapbox API, Stripe API
- **Services:** Image CDN, email service

---

## Deployment Strategy

### Staging
- Deploy after each phase
- Test with real data
- Get merchant feedback

### Production
- Phased rollout (10%, 50%, 100%)
- Monitor metrics closely
- Rollback plan ready

---

## Post-Launch

### Week 1-2
- Monitor performance
- Fix critical bugs
- Gather user feedback

### Month 1-3
- Optimize SEO
- A/B test messaging
- Iterate on design

### Month 3-6
- Scale infrastructure
- Add advanced features
- Expand monetization

---

## Conclusion

The Directory transforms the platform from isolated storefronts into a connected discovery network. By following the proven storefront blueprint and implementing in phases, we'll create a professional, SEO-optimized directory that drives significant traffic and revenue.

**Key Success Factors:**
1. Auto-sync from tenants (zero merchant effort)
2. Professional design (worthy of platform excellence)
3. SEO optimization (organic traffic growth)
4. Network effects (more merchants = more value)
5. Monetization (premium listings)

**Expected Impact:**
- 50K+ directory page views/month (Year 1)
- 20-40% of storefront traffic from directory
- $336K-672K/year in premium listings
- +10-15% merchant retention improvement

This isn't just a feature—it's a strategic transformation that multiplies the value of every merchant on the platform. 🚀
