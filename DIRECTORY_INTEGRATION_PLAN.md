# Directory Integration Plan

**Status:** Planning Phase  
**Timeline:** 2-3 weeks (3 phases)  
**Goal:** Integrate directory feature throughout platform UI for discovery, settings, and management

---

## Executive Summary

The directory feature is currently implemented at the backend API level with public-facing pages. This plan outlines how to wire directory functionality throughout the platform's authenticated areas, including tenant dashboards, settings, navigation, and management interfaces.

### Current State
✅ **Backend Complete:**
- API endpoints: `/api/directory/search`, `/categories`, `/locations`, `/:slug`
- Database: `directory_listings` view with full business data
- Public pages: `/directory`, `/directory/[slug]`, `/directory/category/[slug]`, `/directory/location/[slug]`

❌ **Missing Integration:**
- No directory settings in tenant dashboard
- No directory management UI
- No navigation links to directory features
- No analytics/insights for directory listings
- No directory status indicators

---

## Integration Architecture

### 1. Data Flow
```
Tenant Business Profile → Directory Listing (Auto-sync)
                       ↓
                  Directory API
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
  Public Pages   Tenant Settings   Analytics
```

### 2. Key Principles
- **Auto-sync**: Directory listings auto-update from business profile
- **Opt-in/Opt-out**: Tenants control directory visibility
- **Tier-aware**: Directory features respect subscription tiers
- **Centralized**: Single source of truth (business profile)
- **Middleware pattern**: Reusable hooks for directory data

---

## Phase 1: Foundation & Settings (Week 1)

### 1.1 Directory Settings Page
**Location:** `/t/{tenantId}/settings/directory`

**Features:**
- ✅ Directory listing status (Published/Draft/Hidden)
- ✅ Preview directory listing card
- ✅ Toggle directory visibility
- ✅ SEO settings (meta description, keywords)
- ✅ Category selection (primary + secondary)
- ✅ Featured listing upgrade (tier-gated)
- ✅ Link to public directory page

**Components to Create:**
```
components/directory/
├── DirectorySettingsPanel.tsx - Main settings interface
├── DirectoryListingPreview.tsx - Preview card
├── DirectoryVisibilityToggle.tsx - Publish/unpublish control
├── DirectoryCategorySelector.tsx - Category management
└── DirectoryStatusBadge.tsx - Status indicator
```

**Hooks to Create:**
```
hooks/directory/
├── useDirectoryListing.ts - Fetch/update directory listing
├── useDirectorySettings.ts - Listing settings management
└── useDirectoryCategories.ts - Available categories
```

### 1.2 API Endpoints (Backend)
**New endpoints needed:**
```
GET    /api/tenants/:id/directory/listing - Get tenant's directory listing
PATCH  /api/tenants/:id/directory/listing - Update listing settings
POST   /api/tenants/:id/directory/publish - Publish to directory
POST   /api/tenants/:id/directory/unpublish - Remove from directory
GET    /api/directory/categories/all - All available categories
```

### 1.3 Database Schema Updates
**Add to `directory_listings` view or create settings table:**
```sql
-- Option 1: Add columns to tenant_business_profiles
ALTER TABLE tenant_business_profiles ADD COLUMN directory_published BOOLEAN DEFAULT false;
ALTER TABLE tenant_business_profiles ADD COLUMN directory_seo_description TEXT;
ALTER TABLE tenant_business_profiles ADD COLUMN directory_featured BOOLEAN DEFAULT false;
ALTER TABLE tenant_business_profiles ADD COLUMN directory_primary_category TEXT;
ALTER TABLE tenant_business_profiles ADD COLUMN directory_secondary_categories TEXT[];

-- Option 2: Create dedicated table (recommended)
CREATE TABLE directory_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT false,
  seo_description TEXT,
  seo_keywords TEXT[],
  primary_category TEXT,
  secondary_categories TEXT[],
  is_featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id)
);
```

---

## Phase 2: Navigation & Discovery (Week 2)

### 2.1 Tenant Sidebar Integration
**Update:** `TenantSidebar.tsx`

**Add navigation items:**
```typescript
const directoryNavItems = [
  { label: 'Directory Listing', href: `/t/${tenantId}/settings/directory` },
  { label: 'View in Directory', href: `/directory/${slug}`, external: true },
];
```

**Conditional display:**
- Show if tenant has business profile
- Badge if unpublished ("Setup Required")
- Badge if featured ("Featured ⭐")

### 2.2 Dashboard Widget
**Location:** `/t/{tenantId}/dashboard`

**Create:** `DirectoryStatusWidget.tsx`

**Display:**
- Directory listing status
- Views/clicks (if analytics available)
- Quick actions: Edit, View, Share
- Tier upgrade CTA if not featured

**Integration:**
```typescript
// In TenantDashboard.tsx
import DirectoryStatusWidget from '@/components/directory/DirectoryStatusWidget';

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <DashboardStats />
  <QuickActions />
  <DirectoryStatusWidget tenantId={tenantId} />
</div>
```

### 2.3 Top Navigation Indicator
**Update:** `TopNav.tsx` or equivalent

**Add:**
- Directory icon/link in main nav
- Badge if listing needs attention
- Quick link to public directory

### 2.4 Platform Dashboard Integration
**Location:** `/` (Platform dashboard)

**Add section:**
- "Featured in Directory" badge for tenants
- Link to manage directory listing
- Directory discovery CTA for new tenants

---

## Phase 3: Management & Analytics (Week 3)

### 3.1 Directory Management Page
**Location:** `/t/{tenantId}/directory` (new dedicated page)

**Features:**
- Full listing editor (rich text for description)
- Image gallery management
- Business hours sync status
- Category management
- SEO optimization tools
- Preview in different layouts
- Social sharing tools

**Components:**
```
components/directory/
├── DirectoryEditor.tsx - Full listing editor
├── DirectoryImageGallery.tsx - Photo management
├── DirectorySEOTools.tsx - SEO optimization
├── DirectorySocialShare.tsx - Share buttons
└── DirectoryPreviewModes.tsx - Card/list/detail previews
```

### 3.2 Analytics Dashboard
**Location:** `/t/{tenantId}/directory/analytics`

**Metrics to track:**
- Directory page views
- Click-through rate to storefront
- Search appearances
- Category ranking
- Geographic reach
- Comparison to similar businesses

**Create:** `DirectoryAnalytics.tsx`

**Data sources:**
- Google Analytics (if integrated)
- Internal tracking (page views, clicks)
- Search query logs

### 3.3 Bulk Management (Organization Tier)
**Location:** `/org/{orgId}/directory`

**Features:**
- Manage all location listings
- Bulk publish/unpublish
- Consistent branding across locations
- Chain-wide category assignments
- Featured listing management

---

## Technical Implementation Details

### Middleware Pattern (Following Proven Approach)

**1. Data Fetching Hooks:**
```typescript
// hooks/directory/useDirectoryListing.ts
export function useDirectoryListing(tenantId: string) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListing = async () => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/directory/listing`);
      const data = await response.json();
      setListing(data);
    } catch (err) {
      setError('Failed to load directory listing');
    } finally {
      setLoading(false);
    }
  };

  const updateListing = async (updates: Partial<DirectoryListing>) => {
    // Update logic
  };

  const publish = async () => {
    // Publish logic
  };

  const unpublish = async () => {
    // Unpublish logic
  };

  useEffect(() => {
    fetchListing();
  }, [tenantId]);

  return { listing, loading, error, updateListing, publish, unpublish, refresh: fetchListing };
}
```

**2. Settings Management:**
```typescript
// hooks/directory/useDirectorySettings.ts
export function useDirectorySettings(tenantId: string) {
  const [settings, setSettings] = useState<DirectorySettings | null>(null);
  
  const updateSettings = async (updates: Partial<DirectorySettings>) => {
    // PATCH /api/tenants/:id/directory/listing
  };

  const toggleVisibility = async () => {
    // Toggle published status
  };

  return { settings, updateSettings, toggleVisibility };
}
```

**3. Categories Hook:**
```typescript
// hooks/directory/useDirectoryCategories.ts
export function useDirectoryCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  
  useEffect(() => {
    fetch('/api/directory/categories/all')
      .then(res => res.json())
      .then(data => setCategories(data.categories));
  }, []);

  return { categories };
}
```

### Component Structure

**Following Dashboard Refactor Pattern:**

```
components/directory/
├── DirectorySettingsPanel.tsx (150 lines) - Main orchestration
├── DirectoryListingPreview.tsx (80 lines) - Preview card
├── DirectoryVisibilityToggle.tsx (40 lines) - Toggle control
├── DirectoryCategorySelector.tsx (100 lines) - Category picker
├── DirectoryStatusBadge.tsx (30 lines) - Status indicator
├── DirectoryEditor.tsx (200 lines) - Full editor
├── DirectoryImageGallery.tsx (120 lines) - Photo management
├── DirectorySEOTools.tsx (150 lines) - SEO optimization
├── DirectorySocialShare.tsx (60 lines) - Share buttons
├── DirectoryAnalytics.tsx (180 lines) - Analytics dashboard
└── DirectoryStatusWidget.tsx (90 lines) - Dashboard widget
```

**Total:** ~1,200 lines across focused, reusable components

---

## Navigation Structure

### Tenant Context
```
Dashboard
├── Directory Status Widget (new)
│
Settings
├── Business Profile (existing)
├── Business Hours (existing)
├── Directory Listing (new) ← Primary settings
│   ├── Visibility
│   ├── Categories
│   ├── SEO
│   └── Featured Upgrade
│
Directory (new top-level section)
├── Manage Listing (new)
├── Analytics (new)
└── View Public Page (external link)
```

### Platform Context
```
Platform Dashboard
├── Directory Section (new)
│   ├── Your Listings
│   ├── Featured Opportunities
│   └── Browse Directory
```

### Public Context (Already Exists)
```
/directory
├── /search
├── /category/[slug]
├── /location/[slug]
└── /[slug] (business detail)
```

---

## Tier-Based Features

### Google-Only Tier
- ❌ No directory access (Google-focused only)

### Starter Tier
- ✅ Basic directory listing
- ✅ Primary category
- ✅ Basic SEO
- ❌ No featured placement
- ❌ No analytics

### Professional Tier
- ✅ Full directory listing
- ✅ Multiple categories
- ✅ Advanced SEO tools
- ✅ Basic analytics
- ✅ Featured listing (1 month free trial)

### Enterprise Tier
- ✅ All Professional features
- ✅ Priority placement
- ✅ Advanced analytics
- ✅ Custom branding
- ✅ Dedicated support

### Organization Tier
- ✅ All Enterprise features
- ✅ Bulk management
- ✅ Chain-wide settings
- ✅ Multi-location featured listings
- ✅ Consolidated analytics

---

## User Flows

### Flow 1: First-Time Directory Setup
1. Tenant completes business profile
2. Dashboard shows "Get Listed in Directory" CTA
3. Click → `/t/{tenantId}/settings/directory`
4. Auto-populated from business profile
5. Select categories
6. Add SEO description
7. Preview listing
8. Click "Publish to Directory"
9. Confirmation + link to public page

### Flow 2: Managing Existing Listing
1. Navigate to Settings → Directory Listing
2. See current status (Published/Views)
3. Edit categories, description, SEO
4. Preview changes
5. Save updates (auto-syncs to directory)
6. View analytics (if available)

### Flow 3: Featured Listing Upgrade
1. See "Upgrade to Featured" CTA in settings
2. Click → Tier comparison modal
3. Select Professional/Enterprise tier
4. Complete upgrade flow
5. Featured badge appears in directory
6. Priority placement in search results

### Flow 4: Organization Bulk Management
1. Navigate to `/org/{orgId}/directory`
2. See all location listings in table
3. Filter by status, category, location
4. Select multiple listings
5. Bulk actions: Publish, Unpublish, Update Category
6. Preview changes
7. Apply to all selected

---

## API Endpoints Summary

### Tenant-Specific
```
GET    /api/tenants/:id/directory/listing
PATCH  /api/tenants/:id/directory/listing
POST   /api/tenants/:id/directory/publish
POST   /api/tenants/:id/directory/unpublish
GET    /api/tenants/:id/directory/analytics
```

### Organization-Level
```
GET    /api/organizations/:id/directory/listings
PATCH  /api/organizations/:id/directory/bulk-update
POST   /api/organizations/:id/directory/bulk-publish
```

### Public (Already Exist)
```
GET    /api/directory/search
GET    /api/directory/categories
GET    /api/directory/locations
GET    /api/directory/:slug
GET    /api/directory/:slug/related
```

### Admin
```
GET    /api/admin/directory/featured
POST   /api/admin/directory/feature/:tenantId
DELETE /api/admin/directory/feature/:tenantId
GET    /api/admin/directory/categories/manage
```

---

## Success Metrics

### Technical
- ✅ Directory settings page load time < 1s
- ✅ Listing updates sync within 5s
- ✅ Zero downtime during rollout
- ✅ Mobile-responsive on all pages

### Business
- 📊 % of tenants with published listings
- 📊 Average time to first publish
- 📊 Directory page views per listing
- 📊 Click-through rate to storefronts
- 📊 Featured listing conversion rate

### User Experience
- ⭐ Settings page usability score > 4.5/5
- ⭐ Time to publish < 5 minutes
- ⭐ Support tickets related to directory < 5%

---

## Risk Mitigation

### 1. Data Sync Issues
**Risk:** Business profile changes not reflected in directory
**Mitigation:**
- Real-time sync on profile updates
- Manual "Sync Now" button in settings
- Nightly batch sync as backup

### 2. SEO Conflicts
**Risk:** Directory listings compete with storefronts in search
**Mitigation:**
- Canonical URLs pointing to storefront
- Directory pages use `noindex` for duplicates
- Clear differentiation in meta descriptions

### 3. Tier Confusion
**Risk:** Users unclear about directory access by tier
**Mitigation:**
- Clear tier badges in settings
- Upgrade CTAs with feature comparison
- Tooltips explaining tier requirements

### 4. Performance Impact
**Risk:** Directory queries slow down platform
**Mitigation:**
- Materialized view for `directory_listings`
- Caching for category/location lists
- Pagination on all directory endpoints

---

## Testing Plan

### Unit Tests
- ✅ Directory hooks (fetch, update, publish)
- ✅ Settings component logic
- ✅ Category selector
- ✅ SEO tools

### Integration Tests
- ✅ End-to-end publish flow
- ✅ Business profile → directory sync
- ✅ Tier-based feature access
- ✅ Organization bulk management

### Manual QA Checklist
- [ ] Publish new listing
- [ ] Update existing listing
- [ ] Unpublish listing
- [ ] Change categories
- [ ] Update SEO settings
- [ ] Upgrade to featured
- [ ] View analytics
- [ ] Bulk manage (org tier)
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

---

## Deployment Strategy

### Week 1: Foundation
- **Day 1-2:** Database schema + API endpoints
- **Day 3-4:** Directory hooks + settings components
- **Day 5:** Settings page integration + testing

### Week 2: Navigation
- **Day 1-2:** Sidebar integration + dashboard widget
- **Day 3-4:** Top nav + platform dashboard
- **Day 5:** Testing + bug fixes

### Week 3: Advanced Features
- **Day 1-2:** Directory management page + editor
- **Day 3-4:** Analytics dashboard
- **Day 5:** Organization bulk management + final testing

### Rollout
1. **Beta (Week 4):** Enable for 10% of tenants
2. **Monitoring:** Track metrics for 1 week
3. **Gradual Rollout:** 25% → 50% → 100% over 2 weeks
4. **Full Launch:** Announce directory feature

---

## Documentation Needed

### User Documentation
- "Getting Started with Directory Listings"
- "Optimizing Your Directory Presence"
- "Understanding Directory Analytics"
- "Featured Listings Guide"

### Developer Documentation
- Directory API reference
- Directory hooks usage
- Component integration guide
- Testing guidelines

### Admin Documentation
- Managing featured listings
- Category administration
- Troubleshooting sync issues

---

## Future Enhancements (Post-Launch)

### Phase 4: Advanced Features
- Customer reviews/ratings
- Business hours sync automation
- Photo gallery optimization
- Video embeds
- Virtual tours integration

### Phase 5: Marketing Tools
- Directory badges for websites
- Social media auto-posting
- Email marketing integration
- QR codes for in-store promotion

### Phase 6: Discovery Features
- "Near me" search
- Map view
- Filters (hours, rating, features)
- Saved searches
- Email alerts for new listings

---

## Conclusion

This plan provides a comprehensive roadmap for integrating directory functionality throughout the platform. By following the proven middleware pattern and phased approach, we can deliver a robust, user-friendly directory system that enhances tenant visibility and drives customer discovery.

**Key Takeaways:**
- ✅ Leverage existing business profile data
- ✅ Follow middleware pattern for consistency
- ✅ Tier-aware features for monetization
- ✅ Gradual rollout for risk mitigation
- ✅ Analytics-driven optimization

**Timeline:** 3 weeks to full launch
**Effort:** ~1,200 lines of focused, reusable code
**Impact:** Increased tenant value + new discovery channel
