# Dual Category System UX Design

## Overview
The platform supports TWO distinct category systems, both equally important:

1. **Product Categories** - What stores SELL (tenant_category → InventoryItem)
2. **Store Categories** - What stores ARE (GMB/Google Business categories)

Both are first-class citizens in the directory experience.

---

## Visual Design

### Directory Home Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│                     DIRECTORY HERO                          │
│                  Find Local Stores                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     SEARCH BAR                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Browse by Product Category                                  │
│ 🏷️ Find stores that sell what you're looking for           │
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ Laptops  │ │Smartphones│ │Accessories│ │ Clothing │      │
│ │ 3 stores │ │ 5 stores  │ │ 8 stores  │ │ 12 stores│      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│ [View All Product Categories →]                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Browse by Store Type                                        │
│ 🏪 Find stores by business category                        │
│                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│ │ Electronics  │ │ Clothing     │ │ Restaurants  │       │
│ │ 15 stores    │ │ 23 stores    │ │ 45 stores    │       │
│ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                             │
│ [View All Store Types →]                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ All Stores                                                  │
│ Showing 1-24 of 156 stores                                 │
│                                                             │
│ [Store Cards Grid]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Structure

### 1. Product Category Browser (NEW)
**Component:** `DirectoryProductCategoryBrowser`

```tsx
<div className="mb-12">
  <div className="flex items-center gap-3 mb-4">
    <span className="text-3xl">🏷️</span>
    <div>
      <h2 className="text-2xl font-bold">Browse by Product Category</h2>
      <p className="text-neutral-600">Find stores that sell what you're looking for</p>
    </div>
  </div>
  
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    {productCategories.map(category => (
      <Link 
        href={`/directory/products/${category.slug}`}
        className="card hover:shadow-lg"
      >
        <div className="text-4xl mb-2">{category.icon || '📦'}</div>
        <h3 className="font-semibold">{category.name}</h3>
        <p className="text-sm text-neutral-600">
          {category.storeCount} stores · {category.productCount} products
        </p>
      </Link>
    ))}
  </div>
  
  <Link href="/directory/products" className="btn-link mt-4">
    View All Product Categories →
  </Link>
</div>
```

### 2. Store Type Browser (NEW)
**Component:** `DirectoryStoreTypeBrowser`

```tsx
<div className="mb-12">
  <div className="flex items-center gap-3 mb-4">
    <span className="text-3xl">🏪</span>
    <div>
      <h2 className="text-2xl font-bold">Browse by Store Type</h2>
      <p className="text-neutral-600">Find stores by business category</p>
    </div>
  </div>
  
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {storeTypes.map(type => (
      <Link 
        href={`/directory/stores/${type.slug}`}
        className="card hover:shadow-lg"
      >
        <div className="text-4xl mb-2">{type.icon || '🏬'}</div>
        <h3 className="font-semibold">{type.name}</h3>
        <p className="text-sm text-neutral-600">{type.count} stores</p>
      </Link>
    ))}
  </div>
  
  <Link href="/directory/stores" className="btn-link mt-4">
    View All Store Types →
  </Link>
</div>
```

---

## URL Structure

### Product Categories
- `/directory/products` - All product categories
- `/directory/products/laptops` - Stores selling laptops
- `/directory/products/smartphones` - Stores selling smartphones

### Store Types
- `/directory/stores` - All store types
- `/directory/stores/electronics` - Electronics stores
- `/directory/stores/clothing` - Clothing stores

### Main Directory
- `/directory` - All stores (with both browse options)
- `/directory?search=...` - Search all stores

---

## Breadcrumb Navigation

### Product Category Page
```
Directory > Products > Laptops
```

### Store Type Page
```
Directory > Stores > Electronics
```

### Combined Filter
```
Directory > Products > Laptops > Electronics Stores
```

---

## Filter Sidebar

### On Directory Home
```
┌─────────────────────┐
│ Filters             │
├─────────────────────┤
│ Product Category    │
│ ☐ Laptops (3)      │
│ ☐ Smartphones (5)  │
│ ☐ Accessories (8)  │
│ [Show more...]     │
├─────────────────────┤
│ Store Type          │
│ ☐ Electronics (15) │
│ ☐ Clothing (23)    │
│ ☐ Restaurants (45) │
│ [Show more...]     │
├─────────────────────┤
│ Location            │
│ [City/State...]    │
└─────────────────────┘
```

### On Product Category Page
```
┌─────────────────────┐
│ Filters             │
├─────────────────────┤
│ Product Category    │
│ ✓ Laptops          │  ← Locked/Selected
│   (viewing)         │
├─────────────────────┤
│ Refine by Store Type│
│ ☐ Electronics (12) │
│ ☐ Computer (8)     │
│ ☐ Office (3)       │
├─────────────────────┤
│ Location            │
│ [City/State...]    │
└─────────────────────┘
```

### On Store Type Page
```
┌─────────────────────┐
│ Filters             │
├─────────────────────┤
│ Store Type          │
│ ✓ Electronics      │  ← Locked/Selected
│   (viewing)         │
├─────────────────────┤
│ Refine by Products  │
│ ☐ Laptops (8)      │
│ ☐ Smartphones (12) │
│ ☐ Accessories (15) │
├─────────────────────┤
│ Location            │
│ [City/State...]    │
└─────────────────────┘
```

---

## Store Card Display

### On Product Category Page
```
┌─────────────────────────────┐
│ [Store Logo]                │
│ Best Buy Electronics        │
│ 📍 New York, NY            │
│                             │
│ 🏷️ 12 products in Laptops  │  ← Product context
│ 🏪 Electronics Store       │  ← Store type
│                             │
│ [View Store →]             │
└─────────────────────────────┘
```

### On Store Type Page
```
┌─────────────────────────────┐
│ [Store Logo]                │
│ Best Buy Electronics        │
│ 📍 New York, NY            │
│                             │
│ 🏪 Electronics Store       │  ← Store type (primary)
│ 🏷️ Laptops, Phones, TVs   │  ← Product categories
│                             │
│ [View Store →]             │
└─────────────────────────────┘
```

---

## API Endpoints

### Product Categories
```
GET /api/directory/products                    # List all product categories
GET /api/directory/products/:slug              # Category details
GET /api/directory/products/:slug/stores       # Stores selling this product
```

### Store Types
```
GET /api/directory/store-types                 # List all store types
GET /api/directory/store-types/:slug           # Store type details
GET /api/directory/store-types/:slug/stores    # Stores of this type
```

### Combined
```
GET /api/directory/search?product=laptops&storeType=electronics
```

---

## Database Schema

### Product Categories (Existing)
```sql
tenant_category
  ├─ id
  ├─ name (e.g., "Laptops")
  ├─ slug (e.g., "laptops")
  ├─ google_category_id
  └─ items (relation to InventoryItem)
```

### Store Types (From directory_listings)
```sql
directory_listings
  ├─ primary_category (e.g., "Electronics Store")
  ├─ secondary_categories[] (array)
  └─ ... other fields
```

### Aggregation for Store Types
```sql
-- Get unique store types with counts
SELECT 
  primary_category as name,
  COUNT(*) as store_count
FROM directory_listings
WHERE is_published = true
  AND primary_category IS NOT NULL
GROUP BY primary_category
ORDER BY store_count DESC;
```

---

## Implementation Phases

### Phase 2A: Product Categories (Current)
- ✅ Product category browser
- ✅ Product category detail pages
- ✅ Filter by product category

### Phase 2B: Store Types (NEW)
- ⏳ Store type browser component
- ⏳ Store type detail pages
- ⏳ Filter by store type

### Phase 2C: Integration
- ⏳ Combined filters
- ⏳ Cross-filtering (products + store types)
- ⏳ Breadcrumb navigation
- ⏳ Store cards with both contexts

---

## User Flows

### Flow 1: Browse by Product
```
User lands on /directory
  ↓
Sees "Browse by Product Category"
  ↓
Clicks "Laptops"
  ↓
Goes to /directory/products/laptops
  ↓
Sees stores selling laptops
  ↓
Can refine by store type (Electronics, Computer, etc.)
```

### Flow 2: Browse by Store Type
```
User lands on /directory
  ↓
Sees "Browse by Store Type"
  ↓
Clicks "Electronics"
  ↓
Goes to /directory/stores/electronics
  ↓
Sees all electronics stores
  ↓
Can refine by products (Laptops, Phones, etc.)
```

### Flow 3: Combined Search
```
User lands on /directory
  ↓
Uses filters sidebar
  ↓
Selects "Laptops" (product) + "Electronics" (store type)
  ↓
URL: /directory?product=laptops&storeType=electronics
  ↓
Sees electronics stores that sell laptops
```

---

## Visual Differentiation

### Icons
- **Product Categories:** 🏷️ 📦 🛍️ (tags, packages, shopping)
- **Store Types:** 🏪 🏬 🏢 (buildings, storefronts)

### Colors
- **Product Categories:** Blue accent (#3B82F6)
- **Store Types:** Green accent (#10B981)

### Card Styles
- **Product Category Cards:** Border-left blue accent
- **Store Type Cards:** Border-left green accent

---

## Benefits of Dual System

### For Users
- **Flexibility:** Browse by what they want OR where they want to shop
- **Discovery:** Find new stores through product search
- **Precision:** Combine both for exact matches

### For Platform
- **Rich Data:** Leverage both GMB and inventory data
- **SEO:** More entry points and keywords
- **Differentiation:** Unique feature combining business + product discovery

### For Stores
- **Visibility:** Found through multiple paths
- **Context:** Show both business type and product offerings
- **Verification:** Product categories prove active inventory

---

## Success Metrics

### Engagement
- % users using product categories
- % users using store types
- % users using combined filters

### Discovery
- Average categories browsed per session
- Click-through rate on category cards
- Time spent on category pages

### Conversion
- Store visits from product categories
- Store visits from store types
- Store visits from combined filters

---

## Next Steps

1. **Implement Product Category System** (Current Phase 2)
   - Product category browser
   - Product category detail pages
   - Product category filters

2. **Implement Store Type System** (Phase 2B)
   - Store type browser
   - Store type detail pages
   - Store type filters

3. **Integrate Both Systems** (Phase 2C)
   - Combined filters
   - Cross-filtering
   - Unified search

4. **Polish & Test** (Phase 3)
   - Visual differentiation
   - User testing
   - Performance optimization

---

## File Structure

```
apps/web/src/
├── app/directory/
│   ├── page.tsx                          # Main directory (both browsers)
│   ├── products/
│   │   ├── page.tsx                      # All product categories
│   │   └── [slug]/
│   │       └── page.tsx                  # Product category detail
│   └── stores/
│       ├── page.tsx                      # All store types
│       └── [slug]/
│           └── page.tsx                  # Store type detail
├── components/directory/
│   ├── DirectoryProductCategoryBrowser.tsx  # Product categories
│   ├── DirectoryStoreTypeBrowser.tsx        # Store types
│   ├── DirectoryFilters.tsx                 # Combined filters
│   ├── DirectoryGrid.tsx                    # Reused
│   ├── DirectoryList.tsx                    # Reused
│   └── StoreCard.tsx                        # Shows both contexts
```

---

## Summary

**Two Category Systems, One Seamless Experience:**

- **Product Categories** = "What they sell" (🏷️)
- **Store Types** = "What they are" (🏪)

Both are:
- ✅ First-class citizens
- ✅ Clearly differentiated
- ✅ Complementary, not competing
- ✅ Fully integrated

**Users can:**
- Browse by product category
- Browse by store type
- Combine both for precision
- Switch between views seamlessly

**Platform leverages:**
- GMB data (store types)
- Inventory data (product categories)
- Google sync verification
- Rich discovery experience
