# Product Page Engagement Features - Implementation Plan

**Status:** Ready to Implement  
**Timeline:** 5-7 days  
**Priority:** Medium - Enhances user engagement and product discovery  
**Goal:** Add social engagement features and related products to product detail pages

---

## Overview

Add four key engagement features to product pages:
1. ❤️ **Like/Favorite** - Heart icon to save products
2. 🔗 **Share** - Share product via social media/link
3. 🖨️ **Print** - Print-friendly product view
4. 🔍 **Related Products** - Show similar items from same store/category

---

## Phase 1: Database Schema & Backend (Days 1-2)

### Database Schema

**New Table: `product_likes`**
```sql
CREATE TABLE product_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, user_id),
  UNIQUE(item_id, session_id)
);

CREATE INDEX idx_product_likes_item ON product_likes(item_id);
CREATE INDEX idx_product_likes_user ON product_likes(user_id);
CREATE INDEX idx_product_likes_session ON product_likes(session_id);
```

**Update `items` table:**
```sql
ALTER TABLE items 
  ADD COLUMN like_count INTEGER DEFAULT 0,
  ADD COLUMN share_count INTEGER DEFAULT 0,
  ADD COLUMN print_count INTEGER DEFAULT 0;

CREATE INDEX idx_items_like_count ON items(like_count DESC);
```

### Backend API Endpoints

**File:** `apps/api/src/routes/product-engagement.ts`

- `POST /api/items/:itemId/like` - Toggle like
- `GET /api/items/:itemId/like-status` - Check like status
- `POST /api/items/:itemId/share` - Track share event
- `POST /api/items/:itemId/print` - Track print event
- `GET /api/items/:itemId/related` - Get related products

### Related Products Query Logic

```typescript
// Find items with:
// 1. Same tenant (store)
// 2. Same category (tenant or Google)
// 3. Exclude current item
// 4. Active + public only
// 5. Order by: like_count DESC, created_at DESC
// 6. Limit to 8 items
```

---

## Phase 2: Frontend Components (Days 3-4)

### Components to Create

1. **ProductEngagementActions.tsx**
   - Heart button with like count
   - Share button (opens modal)
   - Print button
   - Real-time state management

2. **ShareModal.tsx**
   - Facebook, Twitter, LinkedIn, Email buttons
   - Copy link functionality
   - Track share platform

3. **RelatedProducts.tsx**
   - Grid of 4-8 related products
   - Product cards with image, name, price, likes
   - Links to product pages

4. **Print Styles (print.css)**
   - Hide navigation, buttons, related products
   - Optimize product details for printing
   - Ensure images print well

---

## Phase 3: Integration & Hooks (Day 5)

### Hooks to Create

**useProductEngagement.ts**
```typescript
// Manages:
// - Like status fetching
// - Toggle like with optimistic updates
// - Share tracking
// - Print tracking
// - Error handling and toasts
```

**Session Management (lib/session.ts)**
```typescript
// For anonymous users:
// - Generate session ID
// - Store in localStorage
// - Attach to API requests
```

---

## Phase 4: Product Page Integration (Day 6)

### Pages to Update

1. **Store Product Page**
   - `/store/[storeSlug]/product/[productSlug]/page.tsx`
   - Add engagement actions below product title
   - Add related products section at bottom

2. **Storefront Product Page**
   - `/storefront/[slug]/product/[productId]/page.tsx`
   - Same integration as store page

### Layout

```
Product Image
Product Name
$99.99
[❤️ 24] [🔗 Share] [🖨️ Print]  ← New engagement actions

Description...
Specifications...

Related Products  ← New section
[Grid of 4-8 products]
```

---

## Phase 5: Directory Integration (Days 7-9)

### Overview

Extend engagement features to the public directory with:
- Storefront-style product views in directory
- Store engagement (like/share stores)
- Related stores by location + category
- Consistent look and feel with storefront

### 5.1 Database Schema Extensions

**New Table: `store_likes`**
```sql
CREATE TABLE store_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, user_id),
  UNIQUE(tenant_id, session_id)
);

CREATE INDEX idx_store_likes_tenant ON store_likes(tenant_id);
CREATE INDEX idx_store_likes_user ON store_likes(user_id);
CREATE INDEX idx_store_likes_session ON store_likes(session_id);
```

**Update `tenants` table:**
```sql
ALTER TABLE tenants 
  ADD COLUMN like_count INTEGER DEFAULT 0,
  ADD COLUMN share_count INTEGER DEFAULT 0;

CREATE INDEX idx_tenants_like_count ON tenants(like_count DESC);
```

### 5.2 Backend API Endpoints

**File:** `apps/api/src/routes/directory-engagement.ts`

```typescript
// Store Engagement
router.post('/stores/:tenantId/like', async (req, res) => {
  // Toggle store like (authenticated or session-based)
});

router.get('/stores/:tenantId/like-status', async (req, res) => {
  // Check if user/session has liked this store
});

router.post('/stores/:tenantId/share', async (req, res) => {
  // Track store share event
});

// Related Stores by Location + Category
router.get('/stores/:tenantId/related', async (req, res) => {
  const { lat, lng, radius = 25, limit = 8 } = req.query;
  
  // Query logic:
  // 1. Get current store's location and categories
  // 2. Find stores within radius
  // 3. Filter by matching categories (primary or secondary)
  // 4. Exclude current store
  // 5. Order by: distance ASC, like_count DESC
  // 6. Limit results
});

// Directory Product View (Storefront-style)
router.get('/directory/products/:itemId', async (req, res) => {
  // Get product with full storefront-style details
  // Include store info, engagement data, related products
});
```

### 5.3 Related Stores Query Logic

```typescript
async function getRelatedStores(
  tenantId: string,
  location: { lat: number; lng: number },
  radius: number = 25,
  limit: number = 8
) {
  // Get source store
  const sourceStore = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      latitude: true,
      longitude: true,
      directoryListing: {
        select: {
          primaryCategory: true,
          secondaryCategories: true
        }
      }
    }
  });
  
  if (!sourceStore) return [];
  
  // Get all categories to match
  const categories = [
    sourceStore.directoryListing?.primaryCategory,
    ...(sourceStore.directoryListing?.secondaryCategories || [])
  ].filter(Boolean);
  
  // Find nearby stores with matching categories
  const nearbyStores = await prisma.$queryRaw`
    SELECT 
      t.*,
      dl.primary_category,
      dl.secondary_categories,
      (
        6371 * acos(
          cos(radians(${location.lat})) * 
          cos(radians(t.latitude)) * 
          cos(radians(t.longitude) - radians(${location.lng})) + 
          sin(radians(${location.lat})) * 
          sin(radians(t.latitude))
        )
      ) AS distance_km
    FROM tenants t
    LEFT JOIN directory_listings dl ON dl.tenant_id = t.id
    WHERE 
      t.id != ${tenantId}
      AND t.directory_visible = true
      AND t.location_status = 'active'
      AND t.google_sync_enabled = true
      AND (
        dl.primary_category = ANY(${categories})
        OR dl.secondary_categories && ${categories}
      )
    HAVING distance_km <= ${radius * 1.60934}
    ORDER BY distance_km ASC, t.like_count DESC
    LIMIT ${limit}
  `;
  
  return nearbyStores;
}
```

### 5.4 Directory Product Page Component

**File:** `apps/web/src/app/directory/product/[itemId]/page.tsx`

```typescript
import DirectoryProductView from '@/components/directory/DirectoryProductView';

export default async function DirectoryProductPage({ params }) {
  const { itemId } = await params;
  
  // Fetch product with full details
  const product = await fetchDirectoryProduct(itemId);
  
  return <DirectoryProductView product={product} />;
}
```

**File:** `apps/web/src/components/directory/DirectoryProductView.tsx`

```typescript
'use client';

// Storefront-style product view for directory
// Includes:
// - Same layout as storefront product page
// - Product engagement actions (like, share, print)
// - Store info card with engagement
// - Related products from same store
// - Related stores section (location + category based)

export default function DirectoryProductView({ product }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4">
        <a href="/directory">Directory</a> / 
        <a href={`/directory/category/${product.category.slug}`}>
          {product.category.name}
        </a> / 
        {product.name}
      </nav>
      
      {/* Product Section (Storefront-style) */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Product Image */}
        <div className="aspect-square relative">
          <Image src={product.imageUrl} alt={product.name} fill />
        </div>
        
        {/* Product Details */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          
          {/* Product Engagement */}
          <ProductEngagementActions
            itemId={product.id}
            itemName={product.name}
            itemUrl={`/directory/product/${product.id}`}
            initialLikeCount={product.likeCount}
          />
          
          {/* Price */}
          {product.price && (
            <p className="text-2xl font-bold text-primary mt-4">
              ${product.price.toFixed(2)}
            </p>
          )}
          
          {/* Description */}
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Description</h2>
            <p>{product.description}</p>
          </div>
          
          {/* Store Card with Engagement */}
          <StoreInfoCard
            store={product.tenant}
            showEngagement={true}
          />
        </div>
      </div>
      
      {/* Related Products (Same Store) */}
      <RelatedProducts
        itemId={product.id}
        tenantSlug={product.tenant.slug}
        limit={8}
        className="mb-12"
      />
      
      {/* Related Stores (Location + Category) */}
      <RelatedStores
        tenantId={product.tenant.id}
        location={{
          lat: product.tenant.latitude,
          lng: product.tenant.longitude
        }}
        categories={[
          product.tenant.directoryListing?.primaryCategory,
          ...(product.tenant.directoryListing?.secondaryCategories || [])
        ]}
        limit={8}
      />
    </div>
  );
}
```

### 5.5 Store Info Card Component

**File:** `apps/web/src/components/directory/StoreInfoCard.tsx`

```typescript
'use client';

import { MapPin, Phone, Globe, Heart, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStoreEngagement } from '@/hooks/useStoreEngagement';

interface StoreInfoCardProps {
  store: {
    id: string;
    businessName: string;
    slug: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string | null;
    website: string | null;
    likeCount: number;
  };
  showEngagement?: boolean;
}

export default function StoreInfoCard({ 
  store, 
  showEngagement = false 
}: StoreInfoCardProps) {
  const { liked, likeCount, toggleLike, trackShare } = useStoreEngagement(
    store.id,
    store.likeCount
  );
  
  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold mb-4">Available at</h3>
        
        <div className="space-y-3">
          {/* Store Name */}
          <a 
            href={`/directory/store/${store.slug}`}
            className="text-lg font-semibold text-primary hover:underline"
          >
            {store.businessName}
          </a>
          
          {/* Address */}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>{store.address}</p>
              <p>{store.city}, {store.state} {store.zipCode}</p>
            </div>
          </div>
          
          {/* Phone */}
          {store.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4" />
              <a href={`tel:${store.phone}`} className="hover:underline">
                {store.phone}
              </a>
            </div>
          )}
          
          {/* Website */}
          {store.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4" />
              <a 
                href={store.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Visit Website
              </a>
            </div>
          )}
          
          {/* Store Engagement */}
          {showEngagement && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLike}
                className="gap-2"
              >
                <Heart 
                  className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : ''}`}
                />
                <span>{likeCount}</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => trackShare('link')}
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share Store</span>
              </Button>
            </div>
          )}
          
          {/* View Store Button */}
          <Button asChild className="w-full mt-4">
            <a href={`/directory/store/${store.slug}`}>
              View Store
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 5.6 Related Stores Component

**File:** `apps/web/src/components/directory/RelatedStores.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Heart } from 'lucide-react';

interface RelatedStore {
  id: string;
  businessName: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  likeCount: number;
  distance: number; // in km
  primaryCategory: string;
  imageUrl: string | null;
}

interface RelatedStoresProps {
  tenantId: string;
  location: { lat: number; lng: number };
  categories: string[];
  limit?: number;
}

export default function RelatedStores({
  tenantId,
  location,
  categories,
  limit = 8
}: RelatedStoresProps) {
  const [stores, setStores] = useState<RelatedStore[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchRelatedStores();
  }, [tenantId]);
  
  const fetchRelatedStores = async () => {
    try {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        limit: limit.toString()
      });
      
      const response = await fetch(
        `/api/directory/stores/${tenantId}/related?${params}`
      );
      const data = await response.json();
      setStores(data.stores || []);
    } catch (error) {
      console.error('Error fetching related stores:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Nearby Similar Stores</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-gray-200" />
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (stores.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4 border-t pt-8">
      <div>
        <h2 className="text-2xl font-bold">Nearby Similar Stores</h2>
        <p className="text-gray-600 text-sm">
          Other stores in the same category near this location
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stores.map((store) => (
          <Link
            key={store.id}
            href={`/directory/store/${store.slug}`}
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              {/* Store Image/Banner */}
              <div className="aspect-video relative bg-gradient-to-br from-blue-500 to-purple-600">
                {store.imageUrl ? (
                  <img
                    src={store.imageUrl}
                    alt={store.businessName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white font-bold text-lg">
                    {store.businessName.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* Store Info */}
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm line-clamp-2 mb-2">
                  {store.businessName}
                </h3>
                
                {/* Category Badge */}
                <div className="text-xs text-gray-600 mb-2">
                  {store.primaryCategory}
                </div>
                
                {/* Location */}
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {store.city}, {store.state}
                  </span>
                </div>
                
                {/* Distance */}
                <div className="text-xs text-gray-500 mb-2">
                  {store.distance < 1 
                    ? `${(store.distance * 1000).toFixed(0)}m away`
                    : `${store.distance.toFixed(1)} km away`
                  }
                </div>
                
                {/* Like Count */}
                {store.likeCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Heart className="h-3 w-3" />
                    <span>{store.likeCount} likes</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### 5.7 Store Engagement Hook

**File:** `apps/web/src/hooks/useStoreEngagement.ts`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useStoreEngagement(
  tenantId: string,
  initialLikeCount: number = 0
) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchLikeStatus();
  }, [tenantId]);
  
  const fetchLikeStatus = async () => {
    try {
      const response = await fetch(
        `/api/directory/stores/${tenantId}/like-status`
      );
      const data = await response.json();
      setLiked(data.liked || false);
      setLikeCount(data.likeCount || initialLikeCount);
    } catch (error) {
      console.error('Error fetching store like status:', error);
    }
  };
  
  const toggleLike = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `/api/directory/stores/${tenantId}/like`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const data = await response.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
      
      toast({
        title: data.liked ? 'Store added to favorites' : 'Store removed from favorites',
        duration: 2000
      });
    } catch (error) {
      console.error('Error toggling store like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update favorite status',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const trackShare = async (platform: string) => {
    try {
      await fetch(`/api/directory/stores/${tenantId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });
    } catch (error) {
      console.error('Error tracking store share:', error);
    }
  };
  
  return {
    liked,
    likeCount,
    loading,
    toggleLike,
    trackShare
  };
}
```

### 5.8 Directory Routes to Create

```
/directory/product/[itemId]           - Storefront-style product view
/directory/store/[storeSlug]          - Store profile with products
/directory/category/[categorySlug]    - Category browse with stores
/directory/search                     - Search products and stores
```

---

## Phase 6: Analytics & Testing (Day 10)

### Testing Checklist

**Backend:**
- [ ] Product like toggle (authenticated users)
- [ ] Product like toggle (anonymous users via session)
- [ ] Store like toggle (authenticated users)
- [ ] Store like toggle (anonymous users via session)
- [ ] Like counts update correctly
- [ ] Share/print tracking works
- [ ] Related products query correct
- [ ] Related stores query correct (location + category)
- [ ] Distance calculations accurate
- [ ] Proper error handling

**Directory Integration:**
- [ ] Directory product page renders storefront-style
- [ ] Product engagement works in directory
- [ ] Store info card displays correctly
- [ ] Store engagement (like/share) works
- [ ] Related products load in directory
- [ ] Related stores load with correct filters
- [ ] Distance displayed correctly (km/m)
- [ ] Category matching works (primary + secondary)
- [ ] Location-based filtering accurate
- [ ] Breadcrumb navigation works

**Frontend:**
- [ ] Heart icon fills when liked
- [ ] Like count updates real-time
- [ ] Share modal works (all platforms)
- [ ] Print dialog opens
- [ ] Print styles applied
- [ ] Related products load
- [ ] Mobile responsive

**Edge Cases:**
- [ ] Rapid like clicks handled
- [ ] Session persists across reloads
- [ ] Works with no related products
- [ ] Graceful error handling

---

## API Routes Summary

### Product Engagement Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/items/:itemId/like` | POST | Toggle product like |
| `/api/items/:itemId/like-status` | GET | Get product like status |
| `/api/items/:itemId/share` | POST | Track product share |
| `/api/items/:itemId/print` | POST | Track product print |
| `/api/items/:itemId/related` | GET | Get related products |

### Directory Engagement Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/directory/stores/:tenantId/like` | POST | Toggle store like |
| `/api/directory/stores/:tenantId/like-status` | GET | Get store like status |
| `/api/directory/stores/:tenantId/share` | POST | Track store share |
| `/api/directory/stores/:tenantId/related` | GET | Get related stores (location + category) |
| `/api/directory/products/:itemId` | GET | Get product with storefront-style details |

---

## Files to Create/Modify

**New Files - Product Engagement (10):**
1. `apps/api/src/routes/product-engagement.ts`
2. `apps/api/src/services/product-engagement.service.ts`
3. `apps/api/src/services/related-products.service.ts`
4. `apps/web/src/components/product/ProductEngagementActions.tsx`
5. `apps/web/src/components/product/ShareModal.tsx`
6. `apps/web/src/components/product/RelatedProducts.tsx`
7. `apps/web/src/hooks/useProductEngagement.ts`
8. `apps/web/src/lib/session.ts`
9. `apps/web/src/styles/print.css`
10. `apps/api/prisma/migrations/.../product_engagement.sql`

**New Files - Directory Integration (8):**
11. `apps/api/src/routes/directory-engagement.ts`
12. `apps/api/src/services/store-engagement.service.ts`
13. `apps/api/src/services/related-stores.service.ts`
14. `apps/web/src/app/directory/product/[itemId]/page.tsx`
15. `apps/web/src/components/directory/DirectoryProductView.tsx`
16. `apps/web/src/components/directory/StoreInfoCard.tsx`
17. `apps/web/src/components/directory/RelatedStores.tsx`
18. `apps/web/src/hooks/useStoreEngagement.ts`

**Modified Files (5):**
1. `apps/api/prisma/schema.prisma` - Add product_likes, store_likes tables
2. `apps/web/src/app/store/[storeSlug]/product/[productSlug]/page.tsx`
3. `apps/web/src/app/storefront/[slug]/product/[productId]/page.tsx`
4. `apps/api/src/index.ts` - Mount new routes
5. `apps/api/prisma/migrations/.../store_engagement.sql`

**Total:** 18 new files + 5 modified = ~2,400 lines of new code

---

## Success Metrics

**Engagement:**
- Like rate: % of views → likes
- Share rate: % of views → shares
- Print rate: % of views → prints

**Discovery:**
- Related product CTR
- Time on site increase
- Pages per session increase

**Business:**
- Conversion rate for liked products
- Repeat visitor rate
- Social traffic increase

---

## Future Enhancements

- User favorites page (all liked products)
- Email notifications for liked product updates
- Social proof ("23 people liked this today")
- Wishlist functionality
- Product comparison
- AI-powered recommendations based on likes
- Engagement analytics dashboard

---

## Implementation Timeline

### Phase 1-4: Product Engagement (Days 1-6)
1. **Day 1:** Database schema + Prisma models (product_likes)
2. **Day 2:** Backend API endpoints + services (product engagement)
3. **Day 3:** Engagement actions component + share modal
4. **Day 4:** Related products component + print styles
5. **Day 5:** Hooks + session management
6. **Day 6:** Product page integration (store + storefront)

### Phase 5: Directory Integration (Days 7-9)
7. **Day 7:** Database extensions (store_likes) + directory API endpoints
8. **Day 8:** Directory components (product view, store card, related stores)
9. **Day 9:** Store engagement hook + directory page integration

### Phase 6: Testing & Launch (Day 10)
10. **Day 10:** Comprehensive testing + analytics setup + documentation

---

## Key Features Summary

### **Product Pages (Store + Storefront)**
- ❤️ Like products (authenticated + anonymous)
- 🔗 Share via social media (Facebook, Twitter, LinkedIn, Email)
- 🖨️ Print-friendly view
- 🔍 Related products (same store + category)

### **Directory Integration (NEW)**
- 🏪 Storefront-style product views in directory
- ❤️ Like stores (authenticated + anonymous)
- 🔗 Share stores via social media
- 📍 Related stores (location + category based)
- 🗺️ Distance-based filtering (within radius)
- 🏷️ Category matching (primary + secondary)
- 🎨 Consistent look and feel with storefront

---

**Ready to start implementation!**
