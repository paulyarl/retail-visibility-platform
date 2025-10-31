# Changelog - October 31, 2025

## Major Updates: UI/UX Improvements & Tier Alignment

### 🎨 Language & Terminology Improvements

#### Inventory Page (`/items`)
- **Title**: "Items" → "Inventory"
- **Description**: "Manage your product catalog" → "Manage your catalog and stock levels"
- **Stats Cards**: 
  - "Total Items" → "Total Products"
  - "Active Items" → "Active"
  - "Inactive Items" → "Inactive"
- **Buttons**: "Create Item" → "Add Product"
- **Badge Text**: "items" → "products"
- **Search Placeholder**: Added "products" for clarity

#### Locations Page (`/tenants`)
- **Title**: "Tenants" → "Locations"
- **Description**: "Manage your store locations and businesses" → "Manage your stores and business locations"
- **Create Form**: "Create New Tenant" → "Add New Location"
- **Button**: "Create Tenant" → "Add Location"
- **Placeholder**: "Enter tenant name" → "Enter location name"

#### Dashboard (`/`)
- **Gauge Labels**:
  - "Total Inventory" → "Catalog Size"
  - "Active Listings" → "Live Products"
  - "Sync Status" → "Sync Health"
  - "on Google" → "synced to Google"
  - "needs attention" → "items need sync"
  - "all synced" → "everything synced"
- **Quick Actions**: "Manage Tenants" → "Manage Locations"
- **Getting Started**: "Create a tenant" → "Add your first location"

#### Tenant Switcher
- **Label**: "Tenant" → "Location"
- **Link**: "Select a tenant" → "Select location"

#### AppShell Navigation
- **Platform Name**: Hardcoded "RVP" → Dynamic from platform settings
- **Visibility**: Hidden when user is logged out

### 📊 Subscription Tier Alignment

#### New Tier Structure (Individual Locations)
1. **Trial** - Free, 500 SKUs
2. **Google-Only** - $29/mo, 250 SKUs (NEW)
   - Google Shopping feeds
   - No storefront
   - Basic product pages
   - Performance analytics

3. **Starter** - $49/mo, 500 SKUs
   - Public storefront with product catalog
   - Product search functionality
   - Google Shopping feeds
   - Platform branding

4. **Professional** - $149/mo, 2,000 SKUs (was 5,000)
   - Everything in Starter
   - 1024px QR codes (print-ready)
   - Custom branding & logo
   - Interactive store location maps
   - Image galleries (5 photos)

5. **Enterprise** - $299/mo, 10,000 SKUs (was $499/mo, unlimited)
   - Everything in Professional
   - 2048px QR codes (billboard-ready)
   - White-label storefront
   - Remove platform branding
   - Image galleries (10 photos)
   - API access
   - Dedicated account manager

#### Chain/Multi-Location Tiers
1. **Chain Google-Only** - $99/mo (NEW)
   - 5 locations, 1,250 SKUs
   - 32% savings vs individual

2. **Chain Starter** - $199/mo
   - 5 locations, 2,500 SKUs

3. **Chain Professional** - $499/mo
   - 15 locations, 25,000 SKUs

4. **Chain Enterprise** - $899/mo (was $999/mo)
   - Unlimited locations & SKUs

### 🔄 Flexible Subscription Features

#### Upgrade/Downgrade Capabilities
- Added Google-Only tier to subscription page
- Users can now downgrade to save costs
- Updated tier ordering for proper upgrade/downgrade detection
- Added "Flexible Plans That Grow With You" section to offerings page
- Highlighted no-contract, change-anytime policy

### 🎯 Conditional UI for Auth States

#### Logged Out Users See:
- Public platform stats (30 retailers, 3 products, etc.)
- Visitor-focused Quick Actions
- "Sign In" and "Create Free Account" CTAs
- Public contact form link
- NO AppShell navigation
- NO tenant switcher
- NO "Add Your First Product" empty state

#### Authenticated Users See:
- Personal dashboard metrics
- Quick Actions (View Storefront, Manage Locations, etc.)
- Getting Started checklist
- AppShell navigation
- Tenant/Location switcher
- Settings contact link

### 🧹 Code Quality Improvements

#### Debug Logging Cleanup
- Removed all troubleshooting console.log statements
- Kept only essential error logging
- Cleaner production-ready code

#### Contact Form Updates
- Public contact (`/contact`) - For visitors
- Settings contact (`/settings/contact`) - For tenant preferences
- Smart routing based on authentication status

### 📝 Files Modified

#### Core Tier Definitions
- `apps/web/src/lib/tiers.ts` - Added google_only tier, updated limits
- `apps/web/src/lib/chain-tiers.ts` - Added chain_google_only, updated pricing

#### UI Components
- `apps/web/src/components/items/ItemsClient.tsx` - Language updates
- `apps/web/src/components/tenants/TenantsClient.tsx` - Language updates
- `apps/web/src/components/app-shell/AppShell.tsx` - Platform branding, auth visibility
- `apps/web/src/components/app-shell/TenantSwitcher.tsx` - Location terminology
- `apps/web/src/components/PublicFooter.tsx` - Smart contact links

#### Pages
- `apps/web/src/app/page.tsx` - Dashboard improvements, conditional UI
- `apps/web/src/app/api/dashboard/route.ts` - Fixed metrics, removed debug logs
- `apps/web/src/app/settings/subscription/page.tsx` - Added google_only tier
- `apps/web/src/app/settings/offerings/page.tsx` - Flexible plans section
- `apps/web/src/app/admin/tiers/page.tsx` - Added google_only, updated pricing
- `apps/web/src/app/contact/page.tsx` - Updated comments

### 🚀 Impact Summary

**User Experience**
- ✅ More user-friendly terminology throughout
- ✅ Better linguistic variety (products, inventory, catalog, locations)
- ✅ Clear differentiation between visitor and authenticated experiences
- ✅ Flexible subscription options with upgrade/downgrade paths

**Business Value**
- ✅ New affordable entry point (Google-Only $29/mo)
- ✅ Chain Google-Only tier for multi-location businesses
- ✅ Clearer value proposition with flexible plans
- ✅ Reduced friction with no-contract messaging

**Technical Improvements**
- ✅ Consistent tier definitions across all pages
- ✅ Offerings page as single source of truth
- ✅ Clean, production-ready code
- ✅ Proper TypeScript types for all tiers

### 📊 Pricing Changes Summary

| Tier | Old Price | New Price | Old SKUs | New SKUs |
|------|-----------|-----------|----------|----------|
| Google-Only | N/A | $29/mo | N/A | 250 |
| Starter | $49/mo | $49/mo | 500 | 500 |
| Professional | $149/mo | $149/mo | 5,000 | 2,000 |
| Enterprise | $499/mo | **$299/mo** | Unlimited | 10,000 |
| Chain Google-Only | N/A | $99/mo | N/A | 1,250 |
| Chain Enterprise | $999/mo | **$899/mo** | Unlimited | Unlimited |

### 🎯 Breaking Changes

**IMPORTANT**: The tier structure has been updated. Existing users on old tiers will continue to work, but new tier limits apply:
- Professional tier now has 2,000 SKU limit (down from 5,000)
- Enterprise tier now has 10,000 SKU limit (was unlimited)
- New google_only tier type added to TypeScript definitions

### 📚 Next Steps

1. **Test all tier transitions** - Verify upgrade/downgrade flows work correctly
2. **Update marketing materials** - Ensure all external docs reflect new pricing
3. **Monitor user feedback** - Track adoption of Google-Only tier
4. **Consider email campaign** - Notify existing users of new flexible options

---

**Total Commits**: 10
**Files Changed**: 15
**Lines Added**: ~500
**Lines Removed**: ~150

All changes pushed to `staging` branch and ready for production deployment.
