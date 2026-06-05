# Expand GBP Categories - Quick Win Implementation

**Goal:** Expand from 25 to 1,000+ Google Business Profile categories

**Status:** Ready to implement (1-2 hours)

---

## Step 1: Get Comprehensive GBP Category List

### **Option A: Use PlePer Tools (Recommended)**

1. Visit: https://pleper.com/index.php?do=tools&sdo=gmb_categories

2. Configure:
   - **Country:** United States (or your primary market)
   - **Language:** English
   - **View:** All categories

3. Export:
   - Copy the full list
   - Save as JSON format
   - Should have 1,000-4,000 categories

### **Option B: Use Community Resources**

Search GitHub for:
- "Google Business Profile categories JSON"
- "GBP categories list"
- "Google My Business categories"

Good sources:
- https://github.com/search?q=google+business+profile+categories+json
- Community-maintained lists
- Usually 1,000-3,000 categories

### **Option C: Manual Compilation**

Use the expanded seed file I created as a starting point and add more categories by industry:

**Retail (200+ categories):**
- Department stores
- Specialty stores
- Outlet stores
- Discount stores
- Warehouse clubs
- etc.

**Food & Dining (300+ categories):**
- Restaurants (by cuisine type)
- Cafes & Coffee shops
- Bars & Pubs
- Fast food
- Food trucks
- Catering
- etc.

**Services (400+ categories):**
- Professional services
- Personal services
- Home services
- Business services
- Automotive services
- etc.

**Healthcare (200+ categories):**
- Medical practices
- Dental offices
- Therapy centers
- Wellness centers
- Medical labs
- etc.

**Entertainment (150+ categories):**
- Venues
- Recreation
- Arts & Culture
- Events
- Sports facilities
- etc.

---

## Step 2: Format the Data

### **Required JSON Structure:**

```json
{
  "categories": [
    {
      "id": "gcid:unique_category_id",
      "name": "Category Display Name",
      "slug": "category-slug",
      "description": "Brief description of the category",
      "icon_emoji": "🏪",
      "google_category_id": "gcid:unique_category_id",
      "sort_order": 10,
      "level": 0
    }
  ]
}
```

### **Field Guidelines:**

**id:** Unique identifier
- Format: `gcid:category_name_lowercase`
- Example: `gcid:grocery_store`

**name:** Display name
- User-friendly name
- Proper capitalization
- Example: "Grocery Store"

**slug:** URL-friendly identifier
- Lowercase
- Hyphens instead of spaces
- Example: "grocery-store"

**description:** Brief explanation
- 1-2 sentences
- What the business does
- Example: "Supermarket selling groceries and household items"

**icon_emoji:** Visual identifier
- Single emoji
- Relevant to category
- Example: "🛒"

**google_category_id:** GBP identifier
- Same as `id` field
- Format: `gcid:category_name`

**sort_order:** Display order
- Increments of 10
- Allows insertion between items
- Example: 10, 20, 30, etc.

**level:** Hierarchy level
- 0 for top-level categories
- 1+ for subcategories
- Example: 0

---

## Step 3: Replace the Seed File

### **File Location:**
```
apps/api/src/data/platform-categories-seed.json
```

### **Current Format (Array):**
```json
[
  { "name": "...", "slug": "...", ... },
  { "name": "...", "slug": "...", ... }
]
```

### **New Format (Object with categories array):**
```json
{
  "categories": [
    { "id": "...", "name": "...", "slug": "...", ... },
    { "id": "...", "name": "...", "slug": "...", ... }
  ]
}
```

### **Update Backend to Handle New Format:**

**File:** `apps/api/src/routes/categories.platform.ts`

**Current code (line ~160):**
```typescript
const seedPath = path.join(__dirname, '../data/platform-categories-seed.json');
const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
const categoriesToImport = seedData; // Assumes array
```

**Update to:**
```typescript
const seedPath = path.join(__dirname, '../data/platform-categories-seed.json');
const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
const categoriesToImport = Array.isArray(seedData) ? seedData : (seedData.categories || []);
```

This handles both formats (backward compatible).

---

## Step 4: Update Frontend Search Endpoint

**File:** `apps/web/src/app/admin/platform-categories/page.tsx`

**Current code (line ~118):**
```typescript
const response = await fetch('/api/platform/categories/gbp-seed');
if (response.ok) {
  const data = await response.json();
  const allCategories = data.categories || [];
  // ...
}
```

This already handles the new format! ✅

---

## Step 5: Test the Import

### **Start Development Server:**
```bash
cd apps/api
npm run dev

cd apps/web
npm run dev
```

### **Test Admin Import:**
1. Navigate to: `http://localhost:3000/admin/platform-categories`
2. Click "📥 Bulk Import"
3. Search for categories (e.g., "restaurant", "store", "service")
4. Select multiple categories
5. Click "Import (X)"
6. Verify success message

### **Test Tenant Selection:**
1. Navigate to: `http://localhost:3000/t/{tenantId}/settings/directory`
2. Select primary category
3. Add secondary categories
4. Verify categories appear in dropdown

---

## Step 6: Deploy

### **Commit Changes:**
```bash
git add apps/api/src/data/platform-categories-seed.json
git add apps/api/src/routes/categories.platform.ts
git commit -m "Expand GBP categories from 25 to 1000+"
git push
```

### **Verify Production:**
1. Deploy to staging first
2. Test import functionality
3. Deploy to production
4. Monitor for issues

---

## Quick Start: Use My Expanded Seed File

I've created a starter file with the structure ready:

**File:** `apps/api/src/data/platform-categories-seed-expanded.json`

**What to do:**

1. **Rename it:**
   ```bash
   mv platform-categories-seed-expanded.json platform-categories-seed.json
   ```

2. **Add more categories:**
   - Open the file
   - Add categories following the same pattern
   - Increment sort_order by 10
   - Use appropriate emojis

3. **Or replace with full list:**
   - Get full list from PlePer Tools
   - Format as shown above
   - Replace the file

---

## Recommended Category Count

**Minimum (Good):** 100-200 categories
- Covers most common business types
- Easy to manage
- Quick to implement

**Recommended (Better):** 500-1,000 categories
- Comprehensive coverage
- Covers niche businesses
- Great variety

**Maximum (Best):** 2,000-4,000 categories
- Complete GBP taxonomy
- Covers everything
- Future-proof

**Start with 500-1,000 and expand based on tenant needs!**

---

## Category Organization Tips

### **Group by Industry:**

```json
{
  "categories": [
    // Retail (sort_order: 1000-1999)
    { "id": "gcid:grocery_store", "sort_order": 1010, ... },
    { "id": "gcid:clothing_store", "sort_order": 1020, ... },
    
    // Food & Dining (sort_order: 2000-2999)
    { "id": "gcid:restaurant", "sort_order": 2010, ... },
    { "id": "gcid:cafe", "sort_order": 2020, ... },
    
    // Services (sort_order: 3000-3999)
    { "id": "gcid:hair_salon", "sort_order": 3010, ... },
    { "id": "gcid:plumber", "sort_order": 3020, ... }
  ]
}
```

### **Use Descriptive Names:**

✅ Good:
- "Italian Restaurant"
- "Women's Clothing Store"
- "Organic Grocery Store"

❌ Avoid:
- "Restaurant" (too generic)
- "Store" (not descriptive)
- "Business" (meaningless)

---

## Monitoring Growth

### **Track Category Usage:**

Add analytics to see which categories are most popular:

```sql
-- Most used categories
SELECT 
  primary_category,
  COUNT(*) as usage_count
FROM directory_settings_list
WHERE primary_category IS NOT NULL
GROUP BY primary_category
ORDER BY usage_count DESC
LIMIT 50;
```

### **Identify Gaps:**

```sql
-- Categories tenants are creating custom
SELECT 
  name,
  COUNT(*) as tenant_count
FROM directory_category
WHERE tenantId != 'platform'
GROUP BY name
HAVING COUNT(*) > 5
ORDER BY tenant_count DESC;
```

If many tenants create the same custom category, add it to the platform list!

---

## Expected Results

### **Before (25 categories):**
- Limited variety
- Many businesses not covered
- Tenants create custom categories
- Lower satisfaction

### **After (500-1,000 categories):**
- ✅ Comprehensive coverage
- ✅ Most businesses covered
- ✅ Less custom category creation
- ✅ Higher satisfaction
- ✅ Better directory organization

---

## Maintenance Plan

### **Quarterly Review:**
1. Check category usage analytics
2. Add popular custom categories to platform
3. Remove unused categories
4. Update descriptions as needed

### **Annual Update:**
1. Review Google's official GBP category list
2. Add new categories
3. Deprecate outdated categories
4. Reorganize if needed

---

## Next Steps

**Today (1-2 hours):**
1. ✅ Get comprehensive GBP category list (500-1,000 categories)
2. ✅ Format as JSON
3. ✅ Replace seed file
4. ✅ Update backend code (backward compatible)
5. ✅ Test import
6. ✅ Deploy

**This Week:**
- Monitor tenant usage
- Gather feedback
- Add missing categories

**This Month:**
- Analyze popular categories
- Optimize category organization
- Document best practices

---

## Success Criteria

✅ **500+ categories available**
✅ **Search/select works smoothly**
✅ **Import completes successfully**
✅ **Tenants can find their business type**
✅ **Less custom category creation**
✅ **Higher platform satisfaction**

---

## Need Help?

**If you get stuck:**

1. **Format Issues:** Use the expanded seed file as a template
2. **Too Many Categories:** Start with 200-300, expand later
3. **Missing Emojis:** Use 🏪 as default, update later
4. **Slow Search:** Add pagination (already supported)

**Remember:** Start small (200-500 categories), expand based on actual tenant needs. The platform can grow organically! 🌱

---

## Quick Command Reference

```bash
# Navigate to API directory
cd apps/api/src/data

# Backup current file
cp platform-categories-seed.json platform-categories-seed-backup.json

# Replace with expanded file
mv platform-categories-seed-expanded.json platform-categories-seed.json

# Or edit directly
nano platform-categories-seed.json

# Test
npm run dev

# Deploy
git add platform-categories-seed.json
git commit -m "Expand GBP categories to 500+"
git push
```

**You're ready to expand! Start with the expanded seed file I created and add more categories as needed.** 🚀
