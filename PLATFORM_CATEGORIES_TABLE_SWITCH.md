# Platform Categories Table Switch

**Status:** ✅ COMPLETE - Switched from `directory_category` to `platform_categories`

---

## What Changed

### **Before (directory_category):**

**Table:** `directory_category`
- ❌ No `description` column
- ❌ No `icon_emoji` column
- ❌ No `level` column
- ✅ Has `tenantId` (supports both platform and tenant categories)

**Issues:**
- Missing visual features (emojis)
- Missing helpful descriptions
- Missing hierarchical support (level)

---

### **After (platform_categories):**

**Table:** `platform_categories`
- ✅ Has `description` column
- ✅ Has `icon_emoji` column
- ✅ Has `level` column
- ✅ Has `parent_id` column
- ✅ Has `google_category_id` column
- ✅ Has `sort_order` column
- ✅ Has `is_active` column
- ✅ Has `is_featured` column

**Benefits:**
- Visual emojis in UI
- Helpful descriptions
- Hierarchical categories support
- All features ready to use

---

## Architecture

### **Category System Split:**

```
┌─────────────────────────────────────────────────────────┐
│ PLATFORM CATEGORIES (Admin-Managed)                     │
├─────────────────────────────────────────────────────────┤
│ Table: platform_categories                              │
│ Purpose: Master list of GBP categories                  │
│ Managed by: Admins only                                 │
│ Features: Emojis, descriptions, hierarchy               │
└─────────────────────────────────────────────────────────┘
                            ↓
                    (Tenants select from)
                            ↓
┌─────────────────────────────────────────────────────────┐
│ TENANT CATEGORIES (Tenant-Specific)                     │
├─────────────────────────────────────────────────────────┤
│ Table: directory_category                               │
│ Purpose: Tenant-specific custom categories              │
│ Managed by: Individual tenants                          │
│ Features: Basic category info                           │
│ Filter: WHERE tenantId = '{uuid}'                       │
└─────────────────────────────────────────────────────────┘
```

---

## Files Modified

### **1. Import Endpoint**

**File:** `apps/api/src/routes/categories.platform.ts`

**Changed:**
```typescript
// Before
const created = await categoryService.createTenantCategory('platform', { name, slug });

// After
const created = await prisma.platform_categories.create({
  data: {
    name,
    slug,
    google_category_id: googleCategoryId || slug,
    description: description || `${name} business`,
    icon_emoji: '📦',
    sort_order: 0,
    level: 0,
    is_active: true,
  },
});
```

### **2. Admin GET Endpoint**

**File:** `apps/api/src/routes/admin/platform-categories.ts`

**Changed:**
```sql
-- Before
FROM directory_category dc
WHERE dc."tenantId" = 'platform'

-- After
FROM platform_categories pc
WHERE pc.is_active = true
```

---

## Data Migration

### **Existing Data:**

If you already imported 50 categories to `directory_category`, you have two options:

**Option 1: Re-import (Recommended)**
```bash
# Delete old imports from directory_category
DELETE FROM directory_category WHERE "tenantId" = 'platform';

# Re-import using the new endpoint
# Navigate to /admin/platform-categories
# Click "Bulk Import"
# Search and import categories
```

**Option 2: Migrate Data**
```sql
-- Copy existing categories to platform_categories
INSERT INTO platform_categories (
  id, name, slug, google_category_id, 
  sort_order, is_active, created_at, updated_at,
  description, icon_emoji, level
)
SELECT 
  id, name, slug, "googleCategoryId",
  "sortOrder", "isActive", "createdAt", "updatedAt",
  '' as description,
  '📦' as icon_emoji,
  0 as level
FROM directory_category
WHERE "tenantId" = 'platform';

-- Then delete from directory_category
DELETE FROM directory_category WHERE "tenantId" = 'platform';
```

---

## Benefits

### **For Admins:**

✅ **Visual Emojis** - Categories easier to scan and identify
✅ **Descriptions** - Help understand what each category is for
✅ **Hierarchy** - Support for parent/child categories
✅ **Featured Flag** - Highlight popular categories
✅ **Dedicated Table** - Cleaner separation of concerns

### **For Tenants:**

✅ **Better UX** - See emojis and descriptions when selecting
✅ **Clearer Options** - Descriptions help pick the right category
✅ **Visual Scanning** - Emojis make categories easier to browse

### **For Platform:**

✅ **Scalability** - Dedicated table optimized for platform categories
✅ **Features** - All GBP category features available
✅ **Flexibility** - Can add platform-specific features without affecting tenant categories
✅ **Performance** - Separate tables = better query performance

---

## Table Schema

### **platform_categories:**

```sql
CREATE TABLE platform_categories (
  id                 TEXT PRIMARY KEY DEFAULT ('cat_' || gen_random_uuid()),
  name               TEXT NOT NULL,
  slug               TEXT UNIQUE NOT NULL,
  description        TEXT,
  google_category_id TEXT UNIQUE NOT NULL,
  parent_id          TEXT,
  level              INTEGER DEFAULT 0,
  icon_emoji         TEXT,
  sort_order         INTEGER DEFAULT 0,
  is_active          BOOLEAN DEFAULT true,
  is_featured        BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_platform_categories_google_id ON platform_categories(google_category_id);
CREATE INDEX idx_platform_categories_parent ON platform_categories(parent_id);
CREATE INDEX idx_platform_categories_slug ON platform_categories(slug);
CREATE INDEX idx_platform_categories_sort ON platform_categories(sort_order, name);
```

---

## Testing

### **Test Import:**

```bash
# 1. Navigate to admin page
http://localhost:3000/admin/platform-categories

# 2. Click "📥 Bulk Import"

# 3. Search for categories
# e.g., "grocery", "restaurant", "store"

# 4. Click "Select All"

# 5. Click "Import"

# 6. Verify success message

# 7. Refresh page - should see all imported categories
```

### **Verify Data:**

```sql
-- Check imported categories
SELECT 
  id, name, slug, icon_emoji, description, 
  google_category_id, sort_order
FROM platform_categories
WHERE is_active = true
ORDER BY sort_order, name
LIMIT 10;

-- Count total
SELECT COUNT(*) FROM platform_categories WHERE is_active = true;
```

---

## Future Enhancements

### **Emoji Customization:**

Currently all categories get `📦` emoji. Future enhancement:

```typescript
// Smart emoji assignment based on category name
const getEmojiForCategory = (name: string) => {
  if (name.includes('grocery')) return '🛒';
  if (name.includes('restaurant')) return '🍽️';
  if (name.includes('pharmacy')) return '💊';
  // ... etc
  return '📦';
};
```

### **Hierarchy Support:**

```typescript
// Parent/child relationships
{
  name: "Restaurants",
  level: 0,
  children: [
    { name: "Italian Restaurant", level: 1, parent_id: "..." },
    { name: "Chinese Restaurant", level: 1, parent_id: "..." }
  ]
}
```

### **Featured Categories:**

```sql
-- Mark popular categories as featured
UPDATE platform_categories 
SET is_featured = true 
WHERE slug IN ('grocery-store', 'restaurant', 'pharmacy', 'clothing-store');

-- Show featured first in UI
SELECT * FROM platform_categories 
ORDER BY is_featured DESC, sort_order ASC;
```

---

## Summary

**What We Did:**
- ✅ Switched from `directory_category` to `platform_categories`
- ✅ Updated import endpoint to use new table
- ✅ Updated admin GET endpoint to read from new table
- ✅ Gained emoji, description, and hierarchy support

**What You Need to Do:**
- 📋 Re-import your 50 categories (or migrate data)
- 📋 Test the import functionality
- 📋 Verify categories appear on admin page

**Result:**
- 🎉 Platform categories now have full feature support
- 🎉 Emojis and descriptions ready for UI
- 🎉 Hierarchical categories supported
- 🎉 Cleaner architecture with dedicated table

---

**The switch is complete! Re-import your categories to see them with full features.** 🚀
