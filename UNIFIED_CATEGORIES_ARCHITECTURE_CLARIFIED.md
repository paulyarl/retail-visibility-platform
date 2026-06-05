# Unified Categories - Clarified Architecture

## 🎯 Core Principle: Separation of Concerns

**Two distinct use cases, one unified management system:**

```
┌─────────────────────────────────────────────────────────────┐
│ UNIFIED CATEGORY MANAGEMENT                                 │
│ (Single selection interface with platform checkboxes)       │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             │                                │
             ▼                                ▼
┌────────────────────────────┐  ┌───────────────────────────┐
│ STOREFRONT                 │  │ DIRECTORY                 │
│ (Individual Store Page)    │  │ (Store Listings)          │
├────────────────────────────┤  ├───────────────────────────┤
│ Purpose:                   │  │ Purpose:                  │
│ • Google Business Profile  │  │ • Directory organization  │
│   alignment                │  │ • Store discovery         │
│ • SEO optimization         │  │ • Category browsing       │
│                            │  │                           │
│ Display:                   │  │ Display:                  │
│ • GBP Categories           │  │ • Store Type/Product      │
│ • Shown in SIDEBAR         │  │   Categories              │
│ • Not on badge             │  │ • Shown in SIDEBAR FILTER │
│                            │  │ • Not on badge            │
│ Example:                   │  │                           │
│ "Restaurant"               │  │ Example:                  │
│ "Italian Restaurant"       │  │ "Frozen Foods"            │
│ "Pizza Place"              │  │ "Grocery"                 │
└────────────────────────────┘  └───────────────────────────┘
```

---

## Current State Analysis

### Storefront (Individual Store Page)
**Current Location:** `/t/[tenantId]/storefront` or `/d/[slug]`

**Current Display:**
- GBP categories shown somewhere (need to verify exact location)
- Used for Google Business Profile alignment
- Helps with SEO and Google Maps integration

**Purpose:**
- ✅ Show what Google sees this business as
- ✅ Help with local SEO
- ✅ Align with Google Business Profile

### Directory (Store Listings)
**Current Location:** `/directory` or `/directory/category/[slug]`

**Current Display:**
- Store Type in sidebar filter
- Business Categories badge next to store name (to be removed)
- Used for organizing and filtering stores

**Purpose:**
- ✅ Organize stores by product/service categories
- ✅ Help users find relevant stores
- ✅ Browse by category

---

## Proposed Architecture

### 1. Unified Management (Backend)

**Single Table:** `tenant_category_assignments`
```sql
CREATE TABLE tenant_category_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Category details
  category_id VARCHAR(255) NOT NULL,
  category_name VARCHAR(500) NOT NULL,
  category_source VARCHAR(50) NOT NULL, -- 'gbp' or 'directory'
  
  -- Platform assignments (can be both!)
  is_assigned_to_gbp BOOLEAN NOT NULL DEFAULT false,
  is_assigned_to_directory BOOLEAN NOT NULL DEFAULT false,
  
  -- Hierarchy
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Insight:** A category can be assigned to:
- GBP only (shows on storefront sidebar)
- Directory only (shows in directory filter)
- Both (shows in both places)

---

### 2. Storefront Display (Individual Store)

**Location:** Storefront sidebar (individual store page)

**Purpose:** Google Business Profile alignment

**Display:**
```
┌─────────────────────────────────────┐
│ Store Sidebar                       │
├─────────────────────────────────────┤
│ 📍 Location                         │
│ 🕒 Hours                            │
│                                     │
│ 🏷️ Business Categories (GBP)       │
│ ├─ Restaurant (Primary)            │
│ ├─ Italian Restaurant              │
│ └─ Pizza Place                     │
│                                     │
│ 📞 Contact                          │
│ 🌐 Website                          │
└─────────────────────────────────────┘
```

**Data Source:**
```sql
-- Get GBP categories for storefront
SELECT 
  category_name,
  is_primary,
  display_order
FROM tenant_category_assignments
WHERE tenant_id = $1
  AND is_assigned_to_gbp = true
ORDER BY is_primary DESC, display_order ASC;
```

**Purpose:**
- Shows what Google sees this business as
- Helps customers understand business type
- Improves local SEO
- Aligns with Google Business Profile

---

### 3. Directory Display (Store Listings)

**Location:** Directory sidebar filter

**Purpose:** Store discovery and organization

**Display:**
```
┌─────────────────────────────────────┐
│ Directory Filters                   │
├─────────────────────────────────────┤
│ 🔍 Search                           │
│                                     │
│ 📂 Categories                       │
│ ├─ ☐ Frozen Foods (24)             │
│ ├─ ☐ Grocery (18)                  │
│ ├─ ☐ Bakery (12)                   │
│ └─ ☐ Deli (8)                      │
│                                     │
│ 📍 Location                         │
│ ⭐ Rating                           │
└─────────────────────────────────────┘

Store Cards (NO BADGE):
┌─────────────────────────────────────┐
│ 🏪 Joe's Grocery                    │
│ ⭐⭐⭐⭐⭐ (24 reviews)              │
│ 📍 123 Main St, City, ST           │
│                                     │
│ [View Store]                        │
└─────────────────────────────────────┘
```

**Data Source:**
```sql
-- Get directory categories for filtering
SELECT 
  category_name,
  COUNT(DISTINCT tenant_id) as store_count
FROM tenant_category_assignments
WHERE is_assigned_to_directory = true
GROUP BY category_name
ORDER BY store_count DESC;
```

**Purpose:**
- Organize stores by product/service type
- Help users find relevant stores
- Browse by category
- Filter directory listings

---

## Unified Management UI

**Location:** `/t/[tenantId]/settings/categories` (new unified page)

**Interface:**
```
┌─────────────────────────────────────────────────────────────┐
│ Business Categories                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Select up to 10 categories that describe your business:    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search categories...                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Selected Categories:                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. ⭐ Restaurant                                         │ │
│ │    ☑ Google Business Profile (Storefront)              │ │
│ │    ☑ Platform Directory                                │ │
│ │    [Remove]                                             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 2. Italian Restaurant                                   │ │
│ │    ☑ Google Business Profile (Storefront)              │ │
│ │    ☐ Platform Directory                                │ │
│ │    [Remove]                                             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 3. Frozen Foods                                         │ │
│ │    ☐ Google Business Profile (Storefront)              │ │
│ │    ☑ Platform Directory                                │ │
│ │    [Remove]                                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Add Category]                          [Save Changes]   │
└─────────────────────────────────────────────────────────────┘

Help Text:
• Google Business Profile: Shows on your storefront and Google Maps
• Platform Directory: Shows in directory filters and search
• You can select both for maximum visibility
```

---

## Use Case Examples

### Example 1: Restaurant
**Business:** Joe's Italian Restaurant

**Categories Selected:**
1. ⭐ Restaurant (Primary)
   - ☑ GBP (Storefront)
   - ☑ Directory
2. Italian Restaurant
   - ☑ GBP (Storefront)
   - ☐ Directory
3. Pizza Place
   - ☑ GBP (Storefront)
   - ☐ Directory

**Result:**
- **Storefront Sidebar:** Shows "Restaurant (Primary), Italian Restaurant, Pizza Place"
- **Directory Filter:** Only "Restaurant" appears (for directory organization)
- **Google Business Profile:** Syncs "Restaurant, Italian Restaurant, Pizza Place"

---

### Example 2: Grocery Store
**Business:** Fresh Foods Market

**Categories Selected:**
1. ⭐ Grocery Store (Primary)
   - ☑ GBP (Storefront)
   - ☑ Directory
2. Supermarket
   - ☑ GBP (Storefront)
   - ☐ Directory
3. Frozen Foods
   - ☐ GBP (Storefront)
   - ☑ Directory
4. Bakery
   - ☐ GBP (Storefront)
   - ☑ Directory
5. Deli
   - ☐ GBP (Storefront)
   - ☑ Directory

**Result:**
- **Storefront Sidebar:** Shows "Grocery Store (Primary), Supermarket"
- **Directory Filter:** Shows "Grocery Store, Frozen Foods, Bakery, Deli"
- **Google Business Profile:** Syncs "Grocery Store, Supermarket"

---

## Data Flow

### User Selects Categories
```
User Interface
  ↓
POST /api/categories/unified
  ↓
tenant_category_assignments table
  ├─ is_assigned_to_gbp = true/false
  └─ is_assigned_to_directory = true/false
  ↓
Sync Triggers (for backward compatibility)
  ├─ Update directory_listings_list (for directory MVs)
  └─ Update gbp_listing_categories (for GBP MVs)
  ↓
Materialized Views Refresh
  ├─ directory_category_listings (directory filters)
  └─ directory_gbp_listings (storefront display)
```

### Storefront Display
```
Storefront Page Load
  ↓
GET /api/categories/storefront/:tenantId
  ↓
Query: WHERE is_assigned_to_gbp = true
  ↓
Render in Storefront Sidebar
```

### Directory Display
```
Directory Page Load
  ↓
GET /api/categories/directory
  ↓
Query: WHERE is_assigned_to_directory = true
  ↓
Render in Directory Filter Sidebar
```

---

## Migration Strategy

### Phase 1: Keep Both Displays (Week 3-4)
- Storefront sidebar shows GBP categories
- Directory sidebar shows Store Type filter
- Both work independently
- No UI changes yet

### Phase 2: Unified Management (Week 5-6)
- Create unified category management page
- Users can assign categories to GBP, Directory, or both
- Old pages still work (backward compatibility)

### Phase 3: Remove Redundancies (Week 7-8)
- Remove category badge from directory store cards
- Keep only sidebar filters
- Cleaner UI

---

## API Endpoints

### Get Categories for Storefront
```typescript
// GET /api/categories/storefront/:tenantId
// Returns GBP categories for storefront sidebar display

router.get('/storefront/:tenantId', async (req, res) => {
  const categories = await prisma.tenantCategoryAssignment.findMany({
    where: {
      tenantId: req.params.tenantId,
      isAssignedToGbp: true
    },
    orderBy: [
      { isPrimary: 'desc' },
      { displayOrder: 'asc' }
    ]
  });
  
  res.json(categories);
});
```

### Get Categories for Directory
```typescript
// GET /api/categories/directory
// Returns directory categories for filter sidebar

router.get('/directory', async (req, res) => {
  const categories = await prisma.$queryRaw`
    SELECT 
      category_name,
      COUNT(DISTINCT tenant_id) as store_count
    FROM tenant_category_assignments
    WHERE is_assigned_to_directory = true
    GROUP BY category_name
    ORDER BY store_count DESC
  `;
  
  res.json(categories);
});
```

### Save Unified Categories
```typescript
// POST /api/categories/unified
// Saves categories with platform assignments

router.post('/unified', async (req, res) => {
  const { tenantId, categories } = req.body;
  
  // Delete existing
  await prisma.tenantCategoryAssignment.deleteMany({
    where: { tenantId }
  });
  
  // Insert new with platform flags
  await prisma.tenantCategoryAssignment.createMany({
    data: categories.map((cat, index) => ({
      tenantId,
      categoryId: cat.id,
      categoryName: cat.name,
      categorySource: cat.source,
      isAssignedToGbp: cat.assignedToGbp,
      isAssignedToDirectory: cat.assignedToDirectory,
      isPrimary: index === 0,
      displayOrder: index
    }))
  });
  
  res.json({ success: true });
});
```

---

## UI Changes Summary

### ✅ Keep (No Changes)
- **Storefront sidebar** - Shows GBP categories (for Google alignment)
- **Directory sidebar filter** - Shows Store Type/Categories (for directory organization)

### ❌ Remove
- **Directory store card badge** - No longer needed (redundant with sidebar)

### ➕ Add
- **Unified category management page** - Single place to manage all categories with checkboxes

---

## Benefits of This Architecture

### Clear Separation of Concerns
- **Storefront = Google alignment** (GBP categories)
- **Directory = Store discovery** (Product/Store Type categories)
- Both can share categories OR use different ones

### Flexibility
- Restaurant can show "Italian Restaurant" on storefront (GBP)
- Same restaurant can show "Restaurants" in directory (for browsing)
- Grocery store can show "Frozen Foods, Bakery, Deli" in directory
- Same store shows "Grocery Store, Supermarket" on storefront (GBP)

### User Experience
- ✅ Single management interface
- ✅ Clear checkboxes for each platform
- ✅ No confusion about where categories appear
- ✅ Cleaner directory UI (no badge)

### Technical
- ✅ Single source of truth
- ✅ Backward compatible (sync triggers)
- ✅ Existing MVs keep working
- ✅ Gradual migration possible

---

## Conclusion

This architecture provides:

1. **Clear Purpose:** Storefront = Google, Directory = Discovery
2. **Unified Management:** One place to select categories
3. **Flexibility:** Categories can apply to one or both platforms
4. **Clean UI:** Sidebars only, no redundant badges
5. **Backward Compatible:** Existing MVs continue working

**Key Insight:** The unified system doesn't force categories to appear everywhere - it gives users control over where each category is displayed, based on its purpose.
