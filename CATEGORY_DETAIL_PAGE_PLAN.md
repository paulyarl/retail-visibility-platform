# Category Detail Page Implementation Plan

## Current State
- ✅ Category browser showing 3 categories (Accessories, Laptops, Smartphones)
- ✅ Category listing page working
- ✅ Route exists: `/directory/categories/[categorySlug]`
- ❌ Backend service methods are stubs (return empty data)
- ❌ Page shows "No stores found" because API returns empty arrays
- ❌ Missing list/grid/map view toggle
- ❌ Opens in same page but doesn't feel like natural drill-down

## Goal
Implement category detail pages that **match directory UX exactly**:
- Same hero section with breadcrumb navigation
- Same view toggle (Grid / List / Map)
- Same filters sidebar
- Same search functionality
- Natural drill-down feel (not a jump to new page)
- Clear "Back to Directory" navigation
- Category information in context (not as separate page)

---

## UX Requirements (Match Directory Exactly)

### Visual Structure
```
┌─────────────────────────────────────────────────────────┐
│ Hero Section (Blue gradient)                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Breadcrumb: Directory > Laptops                     │ │
│ │ H1: Laptops                                         │ │
│ │ Subtitle: 1 store · 1 product                      │ │
│ │ [← Back to Directory]                               │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Search Bar (same as directory)                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Filters (same as directory - but category is locked)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Results Header                                          │
│ "Showing 1-3 of 3 stores"  [Grid] [List] [Map]        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Store Cards (Grid View)                                │
│ ┌──────┐ ┌──────┐ ┌──────┐                            │
│ │Store1│ │Store2│ │Store3│                            │
│ │1 prod│ │2 prod│ │1 prod│                            │
│ └──────┘ └──────┘ └──────┘                            │
└─────────────────────────────────────────────────────────┘
```

### Navigation Flow
1. **From Directory Home:**
   - Click category card → Navigate to `/directory/categories/laptops`
   - URL changes but feels like same page (no new window)
   - Smooth transition (no jarring jump)

2. **On Category Page:**
   - Breadcrumb shows: Directory > Laptops
   - "Back to Directory" button in hero
   - Browser back button works naturally

3. **View Switching:**
   - Grid/List/Map toggle works exactly like directory
   - State persists (if user was in list view, stays in list view)
   - Same components used (DirectoryGrid, DirectoryList, DirectoryMap)

### Components to Reuse
- ✅ DirectorySearch (search bar)
- ✅ DirectoryFilters (filters sidebar - category locked)
- ✅ DirectoryGrid (store cards in grid)
- ✅ DirectoryList (store cards in list)
- ✅ DirectoryMap (map view with markers)
- ✅ StoreCard (individual store display)

### Key Differences from Directory
- **Category is locked** - User is viewing one category only
- **Breadcrumb shows category path** - Directory > Category Name
- **Back button** - Clear way to return to directory
- **Hero subtitle** - Shows store count and product count for THIS category
- **Store cards show product count** - "3 products in Laptops"

---

## Phase 1: Backend Service Implementation (30-45 min)

### Task 1.1: Implement `getStoresByCategory` Method
**File:** `apps/api/src/services/category-directory.service.ts`

**What it needs to do:**
- Accept `categoryId` (or `categorySlug`), optional `location`, and `radius`
- Query tenants that have active products in this category
- Include business profile data (name, address, location)
- Count products per store in this category
- Return store list with metadata

**Implementation:**
```typescript
async getStoresByCategory(
  categorySlug: string,
  location?: { lat: number; lng: number },
  radius?: number
) {
  // 1. Find category by slug
  const category = await prisma.tenantCategory.findFirst({
    where: { slug: categorySlug, isActive: true }
  });
  
  // 2. Find tenants with products in this category
  const stores = await prisma.tenant.findMany({
    where: {
      googleSyncEnabled: true,
      directoryVisible: true,
      locationStatus: 'active',
      items: {
        some: {
          tenantCategoryId: category.id,
          itemStatus: 'active',
          visibility: 'public',
        },
      },
    },
    include: {
      businessProfile: true,
      _count: {
        select: {
          items: {
            where: {
              tenantCategoryId: category.id,
              itemStatus: 'active',
            },
          },
        },
      },
    },
  });
  
  // 3. Return formatted data
  return stores.map(store => ({
    id: store.id,
    name: store.businessProfile?.businessName || store.name,
    slug: store.slug,
    address: store.businessProfile?.addressLine1,
    city: store.businessProfile?.city,
    state: store.businessProfile?.state,
    latitude: store.businessProfile?.latitude,
    longitude: store.businessProfile?.longitude,
    productCount: store._count.items,
  }));
}
```

**Testing:**
- Call endpoint: `GET /api/directory/categories/laptops/stores`
- Should return stores with laptop products
- Verify product counts are correct

---

### Task 1.2: Implement `getCategoryPath` Method
**File:** `apps/api/src/services/category-directory.service.ts`

**What it needs to do:**
- Accept `categoryId`
- Build breadcrumb path from root to current category
- Handle parent-child relationships
- Return array of category objects for breadcrumb

**Implementation:**
```typescript
async getCategoryPath(categoryId: string) {
  const path = [];
  let currentId = categoryId;
  
  while (currentId) {
    const category = await prisma.tenantCategory.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });
    
    if (!category) break;
    
    path.unshift(category); // Add to beginning
    currentId = category.parentId;
  }
  
  return path;
}
```

**Testing:**
- Call with a category that has parents
- Verify breadcrumb order is correct (root → parent → current)

---

### Task 1.3: Update API Route Handler
**File:** `apps/api/src/routes/directory-categories.ts`

**Current issue:** Route is calling with `undefined` categoryId

**Fix:**
```typescript
// GET /api/directory/categories/:categorySlug/stores
router.get('/categories/:categorySlug/stores', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const { lat, lng, radius } = req.query;
    
    // Parse location if provided
    const location = lat && lng ? {
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    } : undefined;
    
    const radiusMiles = radius ? parseFloat(radius as string) : 25;
    
    // Get stores by category slug (not ID)
    const stores = await categoryDirectoryService.getStoresByCategory(
      categorySlug,
      location,
      radiusMiles
    );
    
    res.json({
      success: true,
      data: { stores },
    });
  } catch (error) {
    console.error('Error fetching stores by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores',
    });
  }
});
```

---

## Phase 2: Frontend Integration - Reuse Directory Components (45-60 min)

### Task 2.1: Restructure CategoryViewClient to Match DirectoryClient
**File:** `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx`

**Strategy:** Copy structure from `DirectoryClient.tsx` and adapt for category

**Key Changes:**
1. **Same state management:**
   ```typescript
   const [data, setData] = useState<DirectoryResponse | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
   const [category, setCategory] = useState<Category | null>(null);
   ```

2. **Fetch category + stores:**
   ```typescript
   useEffect(() => {
     const fetchData = async () => {
       // 1. Fetch category info
       const catRes = await fetch(`${apiBaseUrl}/api/directory/categories`);
       const catData = await catRes.json();
       const currentCat = catData.data.categories.find(c => c.slug === categorySlug);
       setCategory(currentCat);
       
       // 2. Fetch stores in this category
       const storesRes = await fetch(
         `${apiBaseUrl}/api/directory/categories/${categorySlug}/stores?${params}`
       );
       const storesData = await storesRes.json();
       
       // 3. Transform to DirectoryResponse format
       setData({
         listings: storesData.data.stores.map(store => ({
           id: store.id,
           tenantId: store.id,
           businessName: store.name,
           slug: store.slug,
           city: store.city,
           state: store.state,
           productCount: store.productCount,
           // ... other fields
         })),
         pagination: {
           page: 1,
           limit: 24,
           totalItems: storesData.data.stores.length,
           totalPages: 1,
         },
       });
     };
     fetchData();
   }, [categorySlug, searchParams]);
   ```

3. **Reuse exact same components:**
   ```tsx
   return (
     <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
       {/* Hero Section - Modified for category */}
       <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
         <div className="container mx-auto px-4 py-12">
           {/* Breadcrumb */}
           <nav className="mb-4 text-sm">
             <Link href="/directory" className="hover:underline">Directory</Link>
             <span className="mx-2">›</span>
             <span>{category?.name}</span>
           </nav>
           
           {/* Title */}
           <h1 className="text-4xl font-bold mb-2">{category?.name}</h1>
           <p className="text-xl opacity-90">
             {data?.pagination.totalItems || 0} stores · {category?.productCount || 0} products
           </p>
           
           {/* Back Button */}
           <Link 
             href="/directory"
             className="inline-flex items-center gap-2 mt-4 text-white/90 hover:text-white"
           >
             ← Back to Directory
           </Link>
         </div>
       </div>

       {/* Search Bar - SAME as directory */}
       <DirectorySearch />

       {/* Filters - SAME as directory (category locked) */}
       <DirectoryFilters 
         categories={[]} // Hide category filter since we're IN a category
         locations={[]}
       />

       {/* Main Content */}
       <div className="container mx-auto px-4 py-8">
         {/* Results Header with View Toggle - SAME as directory */}
         <div className="flex items-center justify-between mb-6">
           <p className="text-neutral-600">
             Showing {data?.listings.length || 0} stores
           </p>
           
           {/* View Toggle - EXACT SAME */}
           <div className="flex gap-2">
             <button onClick={() => setViewMode('grid')}>Grid</button>
             <button onClick={() => setViewMode('list')}>List</button>
             <button onClick={() => setViewMode('map')}>Map</button>
           </div>
         </div>

         {/* Views - REUSE EXACT COMPONENTS */}
         {viewMode === 'grid' && (
           <DirectoryGrid 
             listings={data?.listings || []} 
             loading={loading}
             pagination={data?.pagination}
           />
         )}
         
         {viewMode === 'list' && (
           <DirectoryList 
             listings={data?.listings || []} 
             loading={loading}
           />
         )}
         
         {viewMode === 'map' && (
           <DirectoryMap 
             listings={data?.listings || []} 
             loading={loading}
           />
         )}
       </div>
     </div>
   );
   ```

---

### Task 2.2: Update DirectoryCategoryBrowser Links
**File:** `apps/web/src/components/directory/DirectoryCategoryBrowser.tsx`

**Change link behavior:**
```tsx
// Before: Opens in new tab or jumps
<Link href={`/directory/categories/${category.slug}`}>

// After: Natural navigation (no target="_blank")
<Link 
  href={`/directory/categories/${category.slug}`}
  className="block hover:shadow-lg transition-shadow"
>
  {/* Category card content */}
</Link>
```

---

### Task 2.3: Add Store Product Count Badge
**File:** `apps/web/src/components/directory/StoreCard.tsx`

**Add optional category context:**
```tsx
interface StoreCardProps {
  listing: DirectoryListing;
  index: number;
  categoryName?: string; // NEW: Show "X products in Category"
}

// In the card, add badge:
{categoryName && listing.productCount > 0 && (
  <div className="text-sm text-neutral-600 mt-2">
    {listing.productCount} {listing.productCount === 1 ? 'product' : 'products'} in {categoryName}
  </div>
)}
```

---

## Phase 3: Testing & Polish (15-20 min)

### Task 3.1: Test All Category Pages
- [ ] `/directory/categories/accessories` - Should show 1 store
- [ ] `/directory/categories/laptops` - Should show 1 store
- [ ] `/directory/categories/smartphones` - Should show 1 store
- [ ] Verify product counts are correct
- [ ] Verify store information displays properly

### Task 3.2: Test Navigation Flow
- [ ] Click category from browser → Detail page
- [ ] Click "View all" → All categories page
- [ ] Click category from all categories → Detail page
- [ ] Breadcrumbs work correctly
- [ ] Back button works

### Task 3.3: Test Empty States
- [ ] Category with no stores shows appropriate message
- [ ] Loading states display correctly
- [ ] Error states handled gracefully

### Task 3.4: Test Filtering (if implemented)
- [ ] Location filtering works
- [ ] Radius adjustment works
- [ ] Sort options work

---

## Phase 4: Optional Enhancements (Future)

### Enhancement 4.1: Category Hierarchy
- Show parent/child category relationships
- "Browse similar categories" section
- Category tree navigation

### Enhancement 4.2: Advanced Filtering
- Filter by store rating
- Filter by distance
- Filter by product availability
- Sort by relevance, distance, rating, product count

### Enhancement 4.3: Category Analytics
- Track category page views
- Track store clicks from category pages
- Popular categories dashboard

### Enhancement 4.4: SEO Optimization
- Dynamic meta tags per category
- Structured data (Schema.org)
- Category-specific sitemaps
- Open Graph tags for social sharing

---

## Implementation Order

### Priority 1 (Must Have - Today):
1. ✅ Implement `getStoresByCategory` method
2. ✅ Fix API route to use categorySlug
3. ✅ Update CategoryViewClient to fetch and display stores
4. ✅ Test with existing 3 categories

### Priority 2 (Should Have - This Week):
5. ⏳ Implement `getCategoryPath` for breadcrumbs
6. ⏳ Add category metadata display
7. ⏳ Improve empty states
8. ⏳ Add loading skeletons

### Priority 3 (Nice to Have - Next Week):
9. ⏳ Location filtering
10. ⏳ Sort options
11. ⏳ Category hierarchy
12. ⏳ SEO optimization

---

## Success Criteria

**Phase 1 Complete When:**
- ✅ API returns stores for each category
- ✅ Product counts are accurate
- ✅ No stub methods remain
- ✅ Error handling works

**Phase 2 Complete When:**
- ✅ Category pages display stores
- ✅ Store cards show product counts
- ✅ Navigation works end-to-end
- ✅ Empty states are clear

**Phase 3 Complete When:**
- ✅ All 3 test categories work
- ✅ No console errors
- ✅ Mobile responsive
- ✅ Performance is good (<2s load)

---

## Estimated Timeline

- **Phase 1:** 30-45 minutes
- **Phase 2:** 20-30 minutes
- **Phase 3:** 15-20 minutes
- **Total:** 65-95 minutes (~1.5 hours)

---

## Files to Modify

### Backend:
1. `apps/api/src/services/category-directory.service.ts` - Implement methods
2. `apps/api/src/routes/directory-categories.ts` - Fix route handler

### Frontend:
3. `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx` - Update component
4. `apps/web/src/components/directory/StoreCard.tsx` - Add category badge (optional)

### Testing:
5. Manual testing in browser
6. Check API responses in Network tab
7. Verify database queries are efficient

---

## Ready to Start?

**Next Action:** Implement Phase 1, Task 1.1 - `getStoresByCategory` method

This will immediately fix the "No stores found" issue and make the category detail pages functional!
