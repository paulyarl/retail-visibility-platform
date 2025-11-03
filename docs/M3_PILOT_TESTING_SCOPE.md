# M3 GBP Category Sync - Pilot Testing Scope

**Date:** November 3, 2025  
**Status:** Ready for Pilot Testing on Staging  
**Feature Flags:** `FF_TENANT_GBP_CATEGORY_SYNC`, `FF_CATEGORY_MIRRORING`

---

## ✅ What Works in Pilot

### 1. **UI & User Experience**
- ✅ GBP Business Category settings page (`/t/{tenantId}/settings/gbp-category`)
- ✅ Category search with debounced input (45+ stub categories)
- ✅ Category selection and display
- ✅ Save button functionality
- ✅ Quick start guide with popular categories
- ✅ Search tips and best practices
- ✅ Google Merchant Center restrictions warning
- ✅ Breadcrumb navigation
- ✅ Clarification card explaining business vs product categories
- ✅ Dark mode support

### 2. **Database & Storage**
- ✅ Schema migration applied to staging
- ✅ GBP category fields in `TenantBusinessProfile`:
  - `gbpCategoryId` (stores selected category ID)
  - `gbpCategoryName` (stores category display name)
  - `gbpCategorySyncStatus` (tracks sync state)
  - `gbpCategoryLastMirrored` (timestamp of last sync)
- ✅ Data persistence on save
- ✅ Data retrieval on page load

### 3. **API Routes**
- ✅ `GET /api/gbp/categories` - Search categories (stub data)
- ✅ `PUT /api/tenant/gbp-category` - Save selected category
- ✅ `GET /api/tenant/gbp-category` - Retrieve current category
- ✅ Feature flag validation
- ✅ Error handling

### 4. **Navigation & UX Flow**
- ✅ Settings landing page card with "M3" badge
- ✅ Link from Categories page to GBP Category page
- ✅ Link from GBP Category page to Product Categories
- ✅ Contextual help and next steps

---

## ⚠️ Pilot Limitations (Expected)

### 1. **No Real GBP API Integration**
**Impact:** Categories will NOT actually sync to Google Business Profile

**What happens:**
- User can search and select categories ✅
- Category is saved to database ✅
- Sync status shows "Pending" ⚠️
- **Actual sync to GBP does NOT occur** ❌
- `gbpCategoryLastMirrored` remains `null` ⚠️

**Why:**
- Using stub category data (45 categories vs 4,000+ real)
- Category IDs are placeholders (`gcid:grocery_store` format)
- Real GBP API requires OAuth, credentials, and location ID mapping
- Sync worker not yet implemented

### 2. **Limited Category Selection**
**Impact:** Only 45 categories available vs 4,000+ in real GBP

**Available categories:**
- Food & Drink: 11 types
- Shopping: 13 types
- Health & Beauty: 10 types
- Automotive: 3 types
- Services: 3 types

**Missing:**
- Specialized categories (e.g., "Organic grocery store")
- Regional variations
- Subcategories and variants
- Less common business types

### 3. **No Sync Worker**
**Impact:** Background sync process not implemented

**Missing functionality:**
- Automatic retry on sync failure
- Scheduled sync checks
- Out-of-sync detection
- Audit logging of sync attempts
- Telemetry events

### 4. **No Admin Dashboard Tiles**
**Impact:** No monitoring or manual retry UI

**Missing:**
- Sync status overview dashboard
- Manual retry button for failed syncs
- Bulk sync operations
- Sync history/logs view

---

## 🧪 Pilot Testing Checklist

### Test Scenarios

#### ✅ Scenario 1: First-Time Category Selection
1. Navigate to `/t/{tenantId}/settings`
2. Click "GBP Business Category" card
3. Verify quick start guide displays
4. Search for "grocery" (should show 2 results)
5. Select "Grocery store"
6. Click "Save Category"
7. Verify success message
8. Verify status badge shows "Pending"
9. Refresh page - category should persist

**Expected Result:** Category saved, status = "Pending", lastMirrored = null

#### ✅ Scenario 2: Change Category
1. Navigate to GBP Category page
2. Search for different category (e.g., "pharmacy")
3. Select "Pharmacy"
4. Click "Save Category"
5. Verify success message
6. Verify new category displays

**Expected Result:** New category saved, replaces old one, status remains "Pending"

#### ✅ Scenario 3: Search Functionality
1. Type "foo" - should show Food & Drink categories
2. Type "store" - should show multiple store types
3. Type "xyz123" - should show no results
4. Type single character - should show no results (min 2 chars)

**Expected Result:** Search works with debounce, filters correctly

#### ✅ Scenario 4: Navigation Flow
1. From Settings → Click GBP Category card
2. Read clarification card
3. Click "Manage Product Categories" link → Should go to `/t/{tenantId}/categories`
4. On Categories page, click "Set Business Category" in Next Steps
5. Should return to GBP Category page

**Expected Result:** All navigation links work correctly

#### ✅ Scenario 5: Feature Flag Enforcement
1. Disable `FF_TENANT_GBP_CATEGORY_SYNC` for tenant
2. Navigate to `/t/{tenantId}/settings`
3. Verify GBP Category card does NOT appear
4. Try to access `/t/{tenantId}/settings/gbp-category` directly
5. Should show 403 or redirect

**Expected Result:** Feature properly gated

---

## 📋 Known Issues & Workarounds

### Issue 1: Sync Status Always "Pending"
**Status:** Expected behavior during pilot  
**Workaround:** None needed - this is by design until real API integration  
**Resolution:** Implement sync worker in M3 Phase 2

### Issue 2: Limited Category Options
**Status:** Expected behavior during pilot  
**Workaround:** If needed category not in list, note it for future expansion  
**Resolution:** Integrate real GBP API with full 4,000+ categories

### Issue 3: No Sync History
**Status:** Expected behavior during pilot  
**Workaround:** Check database directly for saved values  
**Resolution:** Build admin dashboard tiles in M3 Phase 2

---

## 🚀 Next Steps After Pilot

### Phase 2: Real GBP API Integration
1. **Set up Google Cloud Project**
   - Enable Google My Business API
   - Configure OAuth 2.0 credentials
   - Set up service account

2. **Implement Real Category Search**
   - Replace stub data with live API calls
   - Handle pagination (4,000+ categories)
   - Cache category list for performance
   - Map real category IDs

3. **Build Sync Worker**
   - Create background job to sync categories to GBP
   - Implement retry logic with exponential backoff
   - Add audit logging
   - Handle rate limits

4. **Add Telemetry**
   - Track sync success/failure rates
   - Monitor out-of-sync conditions
   - Alert on repeated failures

5. **Build Admin Dashboard**
   - Sync status overview tile
   - Manual retry functionality
   - Sync history view
   - Bulk operations

### Phase 3: Production Rollout
1. Test with real GBP locations
2. Expand pilot to more tenants
3. Monitor sync performance
4. Gather user feedback
5. Full production release

---

## 📊 Success Metrics for Pilot

### User Experience
- [ ] Users can find and select categories easily
- [ ] Search functionality is intuitive
- [ ] Navigation between pages is clear
- [ ] Help content is useful

### Technical
- [ ] No errors in category selection/save
- [ ] Data persists correctly in database
- [ ] Feature flags work as expected
- [ ] Page load times acceptable (<2s)

### Feedback to Gather
- Which categories are users searching for that aren't in stub list?
- Is the difference between business and product categories clear?
- Are the quick start guides helpful?
- Any confusion about "Pending" status?

---

## 🔗 Related Documentation

- [Navigation Critique & Recommendations](./NAVIGATION_CRITIQUE_AND_RECOMMENDATIONS.md)
- [Implementation Tracking V3.7-V3.8](./IMPLEMENTATION_TRACKING_V3_7_V3_8.md)
- [Google My Business API Docs](https://developers.google.com/my-business)
- [GBP Categories Reference](https://developers.google.com/my-business/reference/rest/v4/categories)

---

**End of Document**
