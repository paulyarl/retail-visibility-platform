# Directory Integration - Phase 1 Complete Plan

**Timeline:** 1 Week (5 days)  
**Goal:** Foundation for tenant, admin, and support directory management  
**Status:** Ready to implement

---

## Overview

Phase 1 delivers the **complete foundation** for directory functionality across all user roles:
- ✅ Tenant settings and management
- ✅ Platform admin full control
- ✅ Platform support read + help tools
- ✅ Backend API and database

---

## Day 1-2: Backend Foundation

### Database Schema

```sql
-- Directory settings per tenant
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
  slug TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Featured listings management
CREATE TABLE directory_featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  featured_from TIMESTAMP NOT NULL,
  featured_until TIMESTAMP NOT NULL,
  placement_priority INT DEFAULT 5,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Support notes
CREATE TABLE directory_support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_directory_settings_tenant ON directory_settings(tenant_id);
CREATE INDEX idx_directory_settings_published ON directory_settings(is_published);
CREATE INDEX idx_directory_featured_active ON directory_featured_listings(featured_until) WHERE featured_until > NOW();
```

### API Endpoints

```typescript
// Tenant endpoints
GET    /api/tenants/:id/directory/listing
PATCH  /api/tenants/:id/directory/listing
POST   /api/tenants/:id/directory/publish
POST   /api/tenants/:id/directory/unpublish

// Admin endpoints
GET    /api/admin/directory/listings
GET    /api/admin/directory/featured
POST   /api/admin/directory/feature/:tenantId
DELETE /api/admin/directory/unfeature/:tenantId
GET    /api/admin/directory/stats

// Support endpoints
GET    /api/support/directory/tenant/:tenantId/status
GET    /api/support/directory/tenant/:tenantId/quality-check
POST   /api/support/directory/tenant/:tenantId/add-note
GET    /api/support/directory/tenant/:tenantId/notes

// Shared
GET    /api/directory/categories/all
```

---

## Day 3: Tenant UI

### File Structure
```
apps/web/src/
├── app/t/[tenantId]/settings/directory/
│   └── page.tsx (150 lines)
├── components/directory/
│   ├── DirectorySettingsPanel.tsx (180 lines)
│   ├── DirectoryListingPreview.tsx (90 lines)
│   ├── DirectoryVisibilityToggle.tsx (50 lines)
│   ├── DirectoryCategorySelector.tsx (120 lines)
│   └── DirectoryStatusBadge.tsx (40 lines)
└── hooks/directory/
    ├── useDirectoryListing.ts (140 lines)
    ├── useDirectorySettings.ts (100 lines)
    └── useDirectoryCategories.ts (60 lines)
```

### Key Components

**1. Settings Page** (`/t/{tenantId}/settings/directory/page.tsx`)
```typescript
export default function DirectorySettingsPage({ params }: { params: { tenantId: string } }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1>Directory Listing</h1>
      <DirectorySettingsPanel tenantId={params.tenantId} />
    </div>
  );
}
```

**2. Settings Panel** (`DirectorySettingsPanel.tsx`)
- Publish/unpublish toggle
- Category selector (primary + secondary)
- SEO description editor
- Preview card
- Link to public listing

**3. Status Badge** (`DirectoryStatusBadge.tsx`)
- Published (green)
- Draft (amber)
- Featured (blue with star)

### Navigation Integration

**Update TenantSidebar.tsx:**
```typescript
const directoryNav = {
  label: 'Directory',
  href: `/t/${tenantId}/settings/directory`,
  badge: !listing?.is_published ? 'Setup' : listing?.is_featured ? '⭐' : undefined
};
```

---

## Day 4: Platform Admin UI

### File Structure
```
apps/web/src/
├── app/admin/directory/
│   ├── page.tsx (100 lines) - Overview
│   ├── listings/
│   │   └── page.tsx (200 lines) - All listings table
│   └── featured/
│       └── page.tsx (150 lines) - Featured management
├── components/admin/directory/
│   ├── DirectoryOverviewStats.tsx (120 lines)
│   ├── DirectoryListingsTable.tsx (250 lines)
│   ├── DirectoryFeaturedManager.tsx (180 lines)
│   └── DirectoryFeatureDialog.tsx (100 lines)
└── hooks/admin/
    ├── useAdminDirectoryListings.ts (120 lines)
    └── useAdminDirectoryStats.ts (80 lines)
```

### Key Pages

**1. Overview** (`/admin/directory/page.tsx`)
```typescript
export default function AdminDirectoryOverview() {
  const { stats } = useAdminDirectoryStats();
  
  return (
    <div className="p-6">
      <h1>Directory Management</h1>
      <DirectoryOverviewStats stats={stats} />
      {/* Quick links to listings, featured, categories */}
    </div>
  );
}
```

**2. Listings Table** (`/admin/directory/listings/page.tsx`)
- Filterable table (status, tier, category, location)
- Actions: View, Feature, Unpublish, Edit
- Bulk selection
- Quality score column
- Search by business name or tenant ID

**3. Featured Manager** (`/admin/directory/featured/page.tsx`)
- Active featured listings
- Add featured listing dialog
- Extend/remove featured status
- Performance metrics

### Admin Navigation

**Update admin sidebar:**
```typescript
{
  label: 'Directory',
  icon: MapIcon,
  children: [
    { label: 'Overview', href: '/admin/directory' },
    { label: 'All Listings', href: '/admin/directory/listings' },
    { label: 'Featured', href: '/admin/directory/featured' },
  ]
}
```

---

## Day 5: Platform Support UI

### File Structure
```
apps/web/src/
├── app/support/directory/
│   ├── page.tsx (80 lines) - Support dashboard
│   ├── lookup/
│   │   └── page.tsx (150 lines) - Tenant lookup
│   └── troubleshooting/
│       └── page.tsx (120 lines) - Guide
├── components/support/directory/
│   ├── DirectoryTenantLookup.tsx (180 lines)
│   ├── DirectoryQualityChecker.tsx (200 lines)
│   ├── DirectoryTroubleshootingGuide.tsx (150 lines)
│   └── DirectorySupportNotes.tsx (100 lines)
└── hooks/support/
    └── useDirectorySupport.ts (100 lines)
```

### Key Features

**1. Tenant Lookup** (`/support/directory/lookup`)
- Search by tenant ID or business name
- View listing status
- Quality score
- Missing fields
- Support notes history
- Quick actions (add note, flag for review)

**2. Quality Checker** (`DirectoryQualityChecker.tsx`)
- Completeness percentage
- Missing fields checklist
- Recommendations
- Copy/email recommendations

**3. Troubleshooting Guide** (`/support/directory/troubleshooting`)
- Common issues with solutions
- "Listing not showing" → checks
- "Photos not appearing" → fixes
- "Want to be featured" → upgrade info

### Support Navigation

**Update support sidebar:**
```typescript
{
  label: 'Directory Support',
  icon: MapPinIcon,
  children: [
    { label: 'Tenant Lookup', href: '/support/directory/lookup' },
    { label: 'Troubleshooting', href: '/support/directory/troubleshooting' },
  ]
}
```

---

## Middleware Hooks

### Tenant Hook
```typescript
// hooks/directory/useDirectoryListing.ts
export function useDirectoryListing(tenantId: string) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListing = async () => {
    const res = await fetch(`/api/tenants/${tenantId}/directory/listing`);
    const data = await res.json();
    setListing(data);
    setLoading(false);
  };

  const publish = async () => {
    await fetch(`/api/tenants/${tenantId}/directory/publish`, { method: 'POST' });
    await fetchListing();
  };

  const unpublish = async () => {
    await fetch(`/api/tenants/${tenantId}/directory/unpublish`, { method: 'POST' });
    await fetchListing();
  };

  const updateSettings = async (updates: Partial<DirectorySettings>) => {
    await fetch(`/api/tenants/${tenantId}/directory/listing`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    await fetchListing();
  };

  useEffect(() => { fetchListing(); }, [tenantId]);

  return { listing, loading, error, publish, unpublish, updateSettings, refresh: fetchListing };
}
```

### Admin Hook
```typescript
// hooks/admin/useAdminDirectoryListings.ts
export function useAdminDirectoryListings(filters?: DirectoryFilters) {
  const [listings, setListings] = useState<DirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = async () => {
    const params = new URLSearchParams(filters as any);
    const res = await fetch(`/api/admin/directory/listings?${params}`);
    const data = await res.json();
    setListings(data.listings);
    setLoading(false);
  };

  const featureListing = async (tenantId: string, until: Date) => {
    await fetch(`/api/admin/directory/feature/${tenantId}`, {
      method: 'POST',
      body: JSON.stringify({ featured_until: until }),
    });
    await fetchListings();
  };

  const unfeatureListing = async (tenantId: string) => {
    await fetch(`/api/admin/directory/unfeature/${tenantId}`, { method: 'DELETE' });
    await fetchListings();
  };

  useEffect(() => { fetchListings(); }, [filters]);

  return { listings, loading, featureListing, unfeatureListing, refresh: fetchListings };
}
```

### Support Hook
```typescript
// hooks/support/useDirectorySupport.ts
export function useDirectorySupport(tenantId: string) {
  const [status, setStatus] = useState<DirectoryStatus | null>(null);
  const [notes, setNotes] = useState<SupportNote[]>([]);

  const fetchStatus = async () => {
    const res = await fetch(`/api/support/directory/tenant/${tenantId}/status`);
    const data = await res.json();
    setStatus(data);
  };

  const fetchNotes = async () => {
    const res = await fetch(`/api/support/directory/tenant/${tenantId}/notes`);
    const data = await res.json();
    setNotes(data.notes);
  };

  const addNote = async (note: string) => {
    await fetch(`/api/support/directory/tenant/${tenantId}/add-note`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    await fetchNotes();
  };

  const checkQuality = async () => {
    const res = await fetch(`/api/support/directory/tenant/${tenantId}/quality-check`);
    return await res.json();
  };

  useEffect(() => {
    fetchStatus();
    fetchNotes();
  }, [tenantId]);

  return { status, notes, addNote, checkQuality, refresh: fetchStatus };
}
```

---

## Role-Based Access Control

### Middleware Pattern
```typescript
// middleware/directory-access.ts
export function checkDirectoryAccess(req: Request, res: Response, next: NextFunction) {
  const { user } = req;
  const path = req.path;

  // Tenant endpoints - must own tenant
  if (path.startsWith('/api/tenants/')) {
    const tenantId = req.params.id;
    if (!canAccessTenant(user, tenantId)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  // Admin endpoints - platform admin only
  if (path.startsWith('/api/admin/directory')) {
    if (user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'admin_required' });
    }
  }

  // Support endpoints - admin or support
  if (path.startsWith('/api/support/directory')) {
    if (!['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(user.role)) {
      return res.status(403).json({ error: 'support_access_required' });
    }
  }

  next();
}
```

---

## Testing Checklist

### Tenant UI
- [ ] View directory settings page
- [ ] Publish listing
- [ ] Unpublish listing
- [ ] Select categories
- [ ] Edit SEO description
- [ ] Preview listing
- [ ] View public listing link
- [ ] See status badge in sidebar

### Admin UI
- [ ] View overview stats
- [ ] Filter listings table
- [ ] Feature a listing
- [ ] Unfeature a listing
- [ ] View featured listings
- [ ] Search by business name
- [ ] View quality scores

### Support UI
- [ ] Lookup tenant by ID
- [ ] Lookup tenant by name
- [ ] View listing status
- [ ] Run quality check
- [ ] Add support note
- [ ] View support notes history
- [ ] Access troubleshooting guide

### API
- [ ] GET tenant listing (200)
- [ ] PATCH tenant listing (200)
- [ ] POST publish (200)
- [ ] POST unpublish (200)
- [ ] GET admin listings (200)
- [ ] POST feature listing (200, admin only)
- [ ] DELETE unfeature (200, admin only)
- [ ] GET support status (200, support/admin only)
- [ ] POST support note (200, support/admin only)

---

## Deployment

### Day 1-2: Backend
1. Run database migrations
2. Deploy API endpoints
3. Test with Postman/curl
4. Verify permissions

### Day 3: Tenant UI
1. Deploy tenant components
2. Update sidebar navigation
3. Test publish/unpublish flow
4. Verify public listing link

### Day 4: Admin UI
1. Deploy admin pages
2. Update admin navigation
3. Test featured management
4. Verify role restrictions

### Day 5: Support UI
1. Deploy support pages
2. Update support navigation
3. Test tenant lookup
4. Verify read-only restrictions

### Final
- Smoke test all roles
- Documentation
- Announce to team

---

## Success Metrics

### Technical
- ✅ All API endpoints < 500ms response
- ✅ Zero permission bypass vulnerabilities
- ✅ Mobile responsive on all pages
- ✅ 100% test coverage on critical paths

### User Experience
- ✅ Tenant can publish in < 2 minutes
- ✅ Admin can feature listing in < 30 seconds
- ✅ Support can diagnose issue in < 1 minute

---

## File Count Summary

**Backend:**
- Database migrations: 1 file
- API routes: 3 files (~400 lines total)

**Tenant UI:**
- Pages: 1 file
- Components: 5 files (~480 lines)
- Hooks: 3 files (~300 lines)

**Admin UI:**
- Pages: 3 files (~450 lines)
- Components: 4 files (~650 lines)
- Hooks: 2 files (~200 lines)

**Support UI:**
- Pages: 3 files (~350 lines)
- Components: 4 files (~630 lines)
- Hooks: 1 file (~100 lines)

**Total: ~3,560 lines of focused, reusable code**

---

## Next Steps (Phase 2)

After Phase 1 is complete and stable:
- Analytics dashboard
- Category management UI
- Bulk operations
- Advanced SEO tools
- Email notifications
- Directory widget for tenant dashboard

---

## Notes

- Follow existing patterns (dashboard refactor, Square integration)
- Use middleware pattern for all data fetching
- Single responsibility components
- Role-based access at API level
- Mobile-first responsive design
- Comprehensive error handling
- Loading states for all async operations
