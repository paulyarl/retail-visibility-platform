# GBP Category Sync - Complete Implementation Guide

**Date:** 2025-11-28 (Updated)  
**Purpose:** Verify GBP category alignment implementation (Phases 1-3)  
**Status:** ✅ **COMPLETE - All Phases Implemented**

---

## Implementation Summary

### ✅ Phase 1: Backend & Database (COMPLETE)
- Database migrations for GBP category mappings
- Backend sync service with SSL configuration
- API endpoints for category search and sync
- Materialized views with GBP fields

### ✅ Phase 2: Enhanced UI (COMPLETE)
- Multi-category selector (primary + up to 9 secondary)
- Dropdown-first UX with search fallback
- Category validation and duplicate prevention
- Sync status indicators

### ✅ Phase 3: Mapping Display (COMPLETE)
- Platform category mapping visualization
- Confidence badges (exact/close/suggested/unmapped)
- Links to directory category pages
- Unmapped category warnings

---

## Prerequisites

### 1. Database Migrations Applied ✅
- [x] Migration 10: `gbp_category_mappings` table created
- [x] Migration 11: Default GBP categories seeded
- [x] Migration 12: `directory_category_listings` MV updated (with unique index)
- [x] Migration 13: `gbp_category_usage_stats` MV created
- [x] Migration 14: `directory_category_stats` MV created (with unique index)
- [x] Migration 15: Tenant cleanup triggers and FK cascades

### 2. Backend Services Deployed ✅
- [x] API server with `GBPCategorySyncService`
- [x] SSL configuration for local development
- [x] `/api/gbp/sync-to-directory` endpoint
- [x] `/api/gbp/mappings` endpoint
- [x] `/api/gbp/categories` search endpoint
- [x] `/api/gbp/categories/popular` endpoint

### 3. Frontend Components ✅
- [x] `GBPCategorySelectorMulti` - Multi-category selector
- [x] `GBPCategoryCard` - Settings card with mapping display
- [x] Next.js API proxy routes

### 4. Test Tenant
- Tenant ID: `t-zjd1o7sm` (or your test tenant)
- Has existing directory listing

---

## Test Cases

### Test 1: Verify Database Setup

**SQL Queries:**

```sql
-- 1. Check GBP category mappings exist
SELECT 
  gbp_category_id,
  gbp_category_name,
  platform_category_id,
  mapping_confidence
FROM gbp_category_mappings
WHERE is_active = true
ORDER BY gbp_category_name;

-- Expected: 12 rows with various mapping statuses
```

```sql
-- 2. Check MV has GBP fields
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'directory_category_listings'
  AND column_name LIKE '%gbp%'
ORDER BY column_name;

-- Expected: gbp_primary_category_id, gbp_primary_category_name, gbp_sync_status, gbp_last_synced_at, is_gbp_sourced_category
```

```sql
-- 3. Check usage stats MV exists
SELECT COUNT(*) as mapping_count
FROM gbp_category_usage_stats;

-- Expected: 12 mappings tracked
```

**✅ Pass Criteria:** All queries return expected results

---

### Test 2: API Endpoint - Search GBP Categories

**Request:**
```bash
curl http://localhost:4000/api/gbp/categories?query=grocery&limit=10
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "gcid:grocery_store",
      "name": "Grocery store",
      "slug": "fresh-produce",
      "icon": "🥬",
      "level": 0,
      "parentId": null
    }
  ],
  "count": 1,
  "query": "grocery"
}
```

**✅ Pass Criteria:** Returns grocery-related categories

---

### Test 3: API Endpoint - Popular Categories

**Request:**
```bash
curl http://localhost:4000/api/gbp/categories/popular?limit=10
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "gcid:grocery_store",
      "name": "Grocery store",
      "slug": "fresh-produce",
      "icon": "🥬",
      "storeCount": 0
    }
  ],
  "count": 10
}
```

**✅ Pass Criteria:** Returns list of popular categories

---

### Test 4: Save GBP Category (Single - Primary Only)

**Request:**
```bash
curl -X PUT http://localhost:3000/api/tenant/gbp-category \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tenantId": "t-rerko4xw",
    "primary": {
      "id": "gcid:grocery_store",
      "name": "Grocery store"
    },
    "secondary": []
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": { ... },
  "gbpCategories": {
    "primary": {
      "id": "gcid:grocery_store",
      "name": "Grocery store",
      "selected_at": "2025-11-28T..."
    },
    "secondary": []
  }
}
```

**Verify in Database:**
```sql
-- Check tenant metadata
SELECT 
  id,
  metadata->'gbp_categories' as gbp_categories
FROM tenants
WHERE id = 't-rerko4xw';

-- Expected: gbp_categories with primary set, sync_status = 'synced'
```

```sql
-- Check directory listing categories
SELECT 
  dlc.listing_id,
  dlc.category_id,
  dlc.is_primary,
  pc.name as category_name,
  pc.google_category_id
FROM directory_listing_categories dlc
JOIN platform_categories pc ON pc.id = dlc.category_id
JOIN directory_listings_list dl ON dl.id = dlc.listing_id
WHERE dl.tenant_id = 't-rerko4xw';

-- Expected: 1 row with is_primary = true, mapped to platform category
```

```sql
-- Check MV updated
SELECT 
  business_name,
  gbp_primary_category_id,
  gbp_primary_category_name,
  gbp_sync_status,
  category_name,
  is_primary
FROM directory_category_listings
WHERE tenant_id = 't-rerko4xw';

-- Expected: Row(s) with GBP category info populated
```

**✅ Pass Criteria:** 
- Tenant metadata updated
- Directory categories assigned
- MV shows GBP category
- Sync status = 'synced'

---

### Test 5: Save GBP Categories (Primary + Secondary)

**Request:**
```bash
curl -X PUT http://localhost:3000/api/tenant/gbp-category \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tenantId": "t-rerko4xw",
    "primary": {
      "id": "gcid:grocery_store",
      "name": "Grocery store"
    },
    "secondary": [
      {
        "id": "gcid:organic_food_store",
        "name": "Organic food store"
      },
      {
        "id": "gcid:produce_market",
        "name": "Produce market"
      }
    ]
  }'
```

**Verify in Database:**
```sql
-- Check directory listing has 3 categories (1 primary + 2 secondary)
SELECT 
  dlc.is_primary,
  pc.name as category_name,
  pc.google_category_id
FROM directory_listing_categories dlc
JOIN platform_categories pc ON pc.id = dlc.category_id
JOIN directory_listings_list dl ON dl.id = dlc.listing_id
WHERE dl.tenant_id = 't-rerko4xw'
ORDER BY dlc.is_primary DESC, pc.name;

-- Expected: 3 rows (1 primary, 2 secondary)
```

**✅ Pass Criteria:** 
- All 3 categories assigned
- Primary flag correct
- No duplicates

---

### Test 6: Usage Statistics Update

**After saving categories, check usage stats:**

```sql
SELECT 
  gbp_category_name,
  primary_usage_count,
  secondary_usage_count,
  total_tenant_count,
  directory_listing_count,
  synced_tenant_count
FROM gbp_category_usage_stats
WHERE total_tenant_count > 0
ORDER BY total_tenant_count DESC;

-- Expected: 
-- - "Grocery store" has primary_usage_count = 1
-- - "Organic food store" has secondary_usage_count = 1
-- - "Produce market" has secondary_usage_count = 1
```

**✅ Pass Criteria:** Usage stats reflect actual usage

---

### Test 7: Directory Visibility

**Check store appears in directory:**

```bash
# Search by category slug
curl http://localhost:3000/api/directory/mv/search?category=fresh-produce
```

**Expected:** Store with `t-rerko4xw` appears in results

**Check in UI:**
1. Navigate to `/directory/stores/fresh-produce`
2. Verify store appears in listing
3. Check category badges show correct categories

**✅ Pass Criteria:** Store visible in directory under correct category

---

### Test 8: Unmapped Category Handling

**Request with unmapped category:**
```bash
curl -X PUT http://localhost:3000/api/tenant/gbp-category \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tenantId": "t-rerko4xw",
    "primary": {
      "id": "gcid:convenience_store",
      "name": "Convenience store"
    },
    "secondary": []
  }'
```

**Verify:**
```sql
-- Check sync status
SELECT 
  metadata->'gbp_categories'->>'sync_status' as sync_status,
  metadata->'gbp_categories'->'primary'->>'name' as primary_category
FROM tenants
WHERE id = 't-rerko4xw';

-- Expected: sync_status might be 'partial' or 'synced' depending on mapping
```

**✅ Pass Criteria:** 
- Request succeeds even if category unmapped
- Sync status reflects partial sync if needed

---

### Test 9: MV Refresh Performance

**Test MV refresh:**
```sql
-- Manual refresh
SELECT refresh_directory_category_listings();

-- Check execution time (should be < 1 second for small dataset)
```

**✅ Pass Criteria:** Refresh completes quickly

---

### Test 10: Frontend Integration

**UI Test:**
1. Navigate to `/t/t-rerko4xw/settings/gbp-category`
2. Toggle to dropdown mode
3. Select "Grocery store" from dropdown
4. Click "Save & Sync to Directory"
5. Verify success message
6. Check sync status indicator shows "✓ Synced"

**✅ Pass Criteria:** 
- UI works smoothly
- Save succeeds
- Status updates correctly

---

## Rollback Plan

If tests fail and rollback is needed:

```sql
-- 1. Drop new MVs
DROP MATERIALIZED VIEW IF EXISTS gbp_category_usage_stats;
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;

-- 2. Recreate old MV (from migration 07)
-- Run: apps/api/prisma/manual_migrations/07_update_mv_with_categories.sql

-- 3. Drop new table
DROP TABLE IF EXISTS gbp_category_mappings;

-- 4. Clear tenant metadata
UPDATE tenants
SET metadata = metadata - 'gbp_categories'
WHERE metadata ? 'gbp_categories';
```

---

## Success Criteria Summary

**Phase 1 is successful if:**

- ✅ All 13 migrations applied without errors
- ✅ GBP category search works
- ✅ Popular categories endpoint works
- ✅ Saving primary category syncs to directory
- ✅ Saving primary + secondary categories works
- ✅ Directory listings show correct categories
- ✅ MV includes GBP fields
- ✅ Usage stats track tenant usage
- ✅ Store appears in directory under correct category
- ✅ No performance degradation

---

## Phase 2 & 3 Test Cases

### Test 11: Multi-Category Selection (Phase 2)

**UI Test:**
1. Navigate to `/t/t-zjd1o7sm/settings/gbp-category`
2. Select primary category from dropdown: "Grocery store"
3. Click "Add Secondary Category"
4. Select "Hardware store" from dropdown
5. Click "Save & Sync to Directory"

**Expected:**
- Both categories save successfully
- Success message appears
- Categories persist after page refresh

**✅ Pass Criteria:** Multi-category selection works

---

### Test 12: Category Validation (Phase 2)

**UI Test:**
1. Try to save without selecting primary category
2. Try to add same category as both primary and secondary
3. Try to add more than 9 secondary categories

**Expected:**
- Error: "Please select a primary category"
- Duplicate categories are disabled in dropdown
- "Add Secondary Category" button disabled at 9 secondary

**✅ Pass Criteria:** All validation rules enforced

---

### Test 13: Dropdown vs Search UX (Phase 2)

**UI Test:**
1. Default view shows dropdown for primary
2. Click "🔍 Can't find it? Search"
3. Search for category not in dropdown
4. Switch back to dropdown with "📋 Use Dropdown"

**Expected:**
- Smooth toggle between modes
- Search finds categories not in dropdown
- Both modes prevent duplicates

**✅ Pass Criteria:** UX is intuitive and functional

---

### Test 14: Category Mapping Display (Phase 3)

**After saving categories:**

**Expected UI:**
- "Directory Category Mappings" section appears
- Each GBP category shows:
  - Category name
  - "Maps to: [icon] [Platform Category]" with link
  - Confidence badge (exact/close/suggested)
- Unmapped categories show warning

**Verify in Browser Console:**
```
[GBPCategoryCard] Fetching mappings for: gcid:grocery_store,gcid:hardware_store
[GBPCategoryCard] Mappings received: [...]
```

**✅ Pass Criteria:** Mappings display correctly

---

### Test 15: Mapping Confidence Badges (Phase 3)

**Check badge colors:**
- **Green "exact"**: Perfect GBP → Platform match
- **Blue "close"**: Similar category match
- **Amber "suggested"**: Possible match
- **Gray "unmapped"**: No platform mapping

**✅ Pass Criteria:** Badges display with correct colors

---

### Test 16: Directory Category Links (Phase 3)

**Click platform category link:**
1. Should open in new tab
2. Navigate to `/directory/categories/[slug]`
3. Store should appear in category listing

**✅ Pass Criteria:** Links work and store is visible

---

### Test 17: Unmapped Category Warning (Phase 3)

**Save a category without platform mapping:**
1. Select unmapped GBP category
2. Save successfully
3. Mapping section shows warning:
   - "⚠️ No platform category mapping"
   - Alert: "Your store won't appear in those category pages"

**✅ Pass Criteria:** Clear warning for unmapped categories

---

## Future Enhancements (Phase 4+)

**Not yet implemented:**

**Phase 4: Manual Re-Sync**
- Add "Re-Sync Now" button
- Show sync progress indicator
- Display sync history/log

**Phase 5: Platform Admin**
- Create `/settings/admin/gbp-categories` page
- Build mapping management interface
- Add import from Google functionality
- Add bulk sync operations

**Phase 6: Automatic Sync**
- Sync on tenant profile update
- Scheduled background sync
- Webhook integration with Google

---

## Test Execution Log

**Date:** 2025-11-28  
**Tester:** Development Team

### Phase 1: Backend & Database
| Test | Status | Notes |
|------|--------|-------|
| Test 1: Database Setup | ✅ | All migrations applied |
| Test 2: Search API | ✅ | Category search working |
| Test 3: Popular API | ✅ | Returns grouped categories |
| Test 4: Save Primary Only | ✅ | Syncs to directory |
| Test 5: Save Primary + Secondary | ✅ | Multi-category support |
| Test 6: Usage Stats | ✅ | Tracks category usage |
| Test 7: Directory Visibility | ✅ | Stores appear in categories |
| Test 8: Unmapped Categories | ✅ | Handled gracefully |
| Test 9: MV Performance | ✅ | Concurrent refresh working |
| Test 10: Frontend Integration | ✅ | UI functional |

### Phase 2: Enhanced UI
| Test | Status | Notes |
|------|--------|-------|
| Test 11: Multi-Category Selection | ✅ | Primary + 9 secondary |
| Test 12: Category Validation | ✅ | All rules enforced |
| Test 13: Dropdown vs Search UX | ✅ | Intuitive toggle |

### Phase 3: Mapping Display
| Test | Status | Notes |
|------|--------|-------|
| Test 14: Category Mapping Display | ✅ | Shows all mappings |
| Test 15: Mapping Confidence Badges | ✅ | Color-coded badges |
| Test 16: Directory Category Links | ✅ | Links open correctly |
| Test 17: Unmapped Category Warning | ✅ | Clear warnings |

**Overall Result:** ✅ **PASS** - All phases complete and functional

**Key Achievements:**
- SSL configuration fixed for local development
- Unique indexes added for concurrent MV refresh
- Multi-category selector with dropdown-first UX
- Platform category mapping visualization
- Complete end-to-end sync workflow

**Known Issues:**
- None - all critical issues resolved

**Next Steps:**
- Phase 4: Manual re-sync functionality
- Phase 5: Platform admin interface
- Phase 6: Automatic sync triggers
