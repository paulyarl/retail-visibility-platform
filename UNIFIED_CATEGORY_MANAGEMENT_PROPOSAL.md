# Unified Category Management System - Proposal

## Executive Summary

**Current State:** Users manage categories in two separate places:
- **GBP Categories** (`/t/:tenantId/settings/gbp-category`) - For Google Business Profile alignment
- **Directory Categories** (`/t/:tenantId/settings/directory`) - For platform directory organization

**Proposed State:** Single unified category management page where users:
1. Select categories once (primary + up to 9 secondary)
2. Choose which platforms each category applies to (GBP, Directory, or Both)
3. See real-time sync status and mappings

## Business Value

### ✅ **User Benefits**
- **Simplicity:** Manage all categories in one place
- **Efficiency:** Select categories once, apply to multiple platforms
- **Clarity:** Clear visibility of where each category is used
- **Flexibility:** Fine-grained control over platform-specific categories

### ✅ **Platform Benefits**
- **Reduced Confusion:** Single source of truth for business categories
- **Better Data Quality:** Less duplicate/conflicting data
- **Easier Onboarding:** One category selection step instead of two
- **Future-Proof:** Easy to add new platforms (Facebook, Yelp, etc.)

### ✅ **Technical Benefits**
- **Simplified Codebase:** One category management UI instead of two
- **Consistent UX:** Same interaction patterns everywhere
- **Easier Maintenance:** Fix bugs once, applies to all platforms

## Proposed Data Model

### Category Assignment Structure

```typescript
interface UnifiedCategoryAssignment {
  // Category identification
  categoryId: string;        // GBP category ID or Directory slug
  categoryName: string;      // Display name
  categoryType: 'gbp' | 'directory' | 'both';
  
  // Platform assignments
  platforms: {
    gbp: boolean;           // Assigned to Google Business Profile
    directory: boolean;     // Assigned to Platform Directory
  };
  
  // Metadata
  isPrimary: boolean;       // Is this the primary category?
  order: number;            // Display order (for secondary categories)
  
  // Sync status
  gbpSyncStatus?: 'synced' | 'pending' | 'error';
  directorySyncStatus?: 'synced' | 'pending' | 'error';
  lastSynced?: string;
}
```

### Database Schema

**New Table: `tenant_category_assignments`**
```sql
CREATE TABLE tenant_category_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
  
  -- Category identification
  gbp_category_id VARCHAR(255),           -- Google category ID (if applicable)
  directory_category_slug VARCHAR(255),   -- Directory slug (if applicable)
  category_name VARCHAR(500) NOT NULL,    -- Display name
  
  -- Platform assignments
  assigned_to_gbp BOOLEAN DEFAULT false,
  assigned_to_directory BOOLEAN DEFAULT false,
  
  -- Hierarchy
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Sync tracking
  gbp_sync_status VARCHAR(50),
  directory_sync_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, gbp_category_id),
  UNIQUE(tenant_id, directory_category_slug),
  CHECK (assigned_to_gbp = true OR assigned_to_directory = true),
  CHECK (gbp_category_id IS NOT NULL OR directory_category_slug IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_tenant_categories ON tenant_category_assignments(tenant_id);
CREATE INDEX idx_primary_category ON tenant_category_assignments(tenant_id, is_primary);
```

## Proposed UI Design

### Unified Category Management Page

**Route:** `/t/:tenantId/settings/categories`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Business Categories                                     │
│ Manage your categories for Google and Directory        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🌟 Primary Category                                    │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Grocery Store                              [×]    │ │
│ │ ☑ Google Business Profile  ☑ Directory           │ │
│ │ Status: ✓ Synced to both platforms               │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ Secondary Categories (3/9)                             │
│ ┌───────────────────────────────────────────────────┐ │
│ │ ⋮ Convenience Store                        [×]    │ │
│ │   ☑ Google Business Profile  ☐ Directory         │ │
│ └───────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────┐ │
│ │ ⋮ Organic Food Store                       [×]    │ │
│ │   ☐ Google Business Profile  ☑ Directory         │ │
│ └───────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────┐ │
│ │ ⋮ Health Food Store                        [×]    │ │
│ │   ☑ Google Business Profile  ☑ Directory         │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ [+ Add Category]                                       │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 💡 Smart Tip                                    │   │
│ │ Your primary category is used for both Google   │   │
│ │ and Directory by default. Secondary categories  │   │
│ │ can be platform-specific if needed.             │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ [Save & Sync to All Platforms]                        │
└─────────────────────────────────────────────────────────┘
```

### Category Card Design

```
┌─────────────────────────────────────────────────────┐
│ ⋮ Grocery Store                              [×]    │
│                                                     │
│ Platform Assignment:                                │
│ ☑ Google Business Profile    ☑ Directory          │
│                                                     │
│ Status:                                             │
│ • Google: ✓ Synced (2 hours ago)                   │
│ • Directory: ✓ Synced (2 hours ago)                │
│                                                     │
│ Mappings:                                           │
│ • Directory: 🛒 Grocery & Food Stores              │
│ • Confidence: Exact match                           │
└─────────────────────────────────────────────────────┘
```

### Add Category Modal

```
┌─────────────────────────────────────────────────────┐
│ Add Category                                   [×]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 1. Search for Category                              │
│ ┌─────────────────────────────────────────────┐   │
│ │ 🔍 Search Google or Directory categories... │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ 2. Select Source                                    │
│ ○ Google Business Profile Categories               │
│ ● Platform Directory Categories                    │
│                                                     │
│ 3. Choose Platforms                                 │
│ ☑ Assign to Google Business Profile               │
│ ☑ Assign to Platform Directory                    │
│                                                     │
│ [Cancel]                    [Add Category]         │
└─────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Create unified data model and API

**Tasks:**
1. ✅ Create `tenant_category_assignments` table
2. ✅ Create API endpoints:
   - `GET /api/tenants/:id/categories/unified` - Get all assignments
   - `POST /api/tenants/:id/categories/unified` - Create/update assignments
   - `DELETE /api/tenants/:id/categories/unified/:categoryId` - Remove assignment
3. ✅ Create migration script to merge existing GBP + Directory data
4. ✅ Add sync logic to update both GBP and Directory tables

### Phase 2: UI Components (Week 2)
**Goal:** Build unified category management UI

**Tasks:**
1. ✅ Create `UnifiedCategoryCard` component
   - Category display
   - Platform checkboxes
   - Sync status indicators
   - Drag handle for reordering
2. ✅ Create `UnifiedCategorySelector` component
   - Search both GBP and Directory categories
   - Source selection (GBP vs Directory)
   - Platform assignment checkboxes
3. ✅ Create unified categories page
   - Primary category section
   - Secondary categories list
   - Add category flow
   - Save & sync functionality

### Phase 3: Migration & Testing (Week 3)
**Goal:** Migrate existing data and test thoroughly

**Tasks:**
1. ✅ Data migration script
   - Merge existing GBP categories
   - Merge existing Directory categories
   - Detect conflicts and resolve
2. ✅ Testing
   - Unit tests for API endpoints
   - Integration tests for sync logic
   - E2E tests for UI flows
3. ✅ User acceptance testing
   - Test with real tenant data
   - Gather feedback
   - Iterate on UX

### Phase 4: Deployment & Deprecation (Week 4)
**Goal:** Roll out unified system and deprecate old pages

**Tasks:**
1. ✅ Deploy unified categories page
2. ✅ Add migration banner to old pages
   - "We've unified category management! [Migrate Now]"
3. ✅ Auto-migrate users on first visit
4. ✅ Deprecate old endpoints (after 30 days)
5. ✅ Remove old pages (after 60 days)

## API Design

### GET /api/tenants/:id/categories/unified

**Response:**
```json
{
  "success": true,
  "data": {
    "primary": {
      "categoryId": "gcid:grocery_store",
      "categoryName": "Grocery Store",
      "platforms": {
        "gbp": true,
        "directory": true
      },
      "gbpSyncStatus": "synced",
      "directorySyncStatus": "synced",
      "lastSynced": "2024-12-06T20:00:00Z",
      "mappings": {
        "directory": {
          "slug": "grocery-food-stores",
          "name": "Grocery & Food Stores",
          "confidence": "exact"
        }
      }
    },
    "secondary": [
      {
        "categoryId": "gcid:convenience_store",
        "categoryName": "Convenience Store",
        "platforms": {
          "gbp": true,
          "directory": false
        },
        "order": 1,
        "gbpSyncStatus": "synced",
        "lastSynced": "2024-12-06T20:00:00Z"
      },
      {
        "categoryId": "dir:organic-food",
        "categoryName": "Organic Food Store",
        "platforms": {
          "gbp": false,
          "directory": true
        },
        "order": 2,
        "directorySyncStatus": "synced",
        "lastSynced": "2024-12-06T20:00:00Z"
      }
    ]
  }
}
```

### POST /api/tenants/:id/categories/unified

**Request:**
```json
{
  "primary": {
    "categoryId": "gcid:grocery_store",
    "categoryName": "Grocery Store",
    "platforms": {
      "gbp": true,
      "directory": true
    }
  },
  "secondary": [
    {
      "categoryId": "gcid:convenience_store",
      "categoryName": "Convenience Store",
      "platforms": {
        "gbp": true,
        "directory": false
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Categories saved and synced successfully",
  "data": {
    "synced": {
      "gbp": 2,
      "directory": 1
    },
    "errors": []
  }
}
```

## Migration Strategy

### Automatic Data Migration

When a user first visits the unified categories page:

1. **Detect existing data:**
   - Check for GBP categories in `tenant_business_profiles_list`
   - Check for Directory categories in directory listing

2. **Merge intelligently:**
   - If same category exists in both → Mark as "both platforms"
   - If only in GBP → Mark as "gbp only"
   - If only in Directory → Mark as "directory only"

3. **Preserve hierarchy:**
   - Primary category from GBP becomes unified primary
   - Secondary categories merged and deduplicated

4. **Create assignments:**
   - Insert into `tenant_category_assignments` table
   - Mark as migrated to prevent re-migration

### Backward Compatibility

During transition period (60 days):
- Old GBP endpoint still works (read-only)
- Old Directory endpoint still works (read-only)
- Unified endpoint is source of truth
- Changes sync back to old tables for compatibility

## User Communication

### Migration Banner (Old Pages)
```
┌─────────────────────────────────────────────────────┐
│ 🎉 Category Management Just Got Easier!            │
│                                                     │
│ We've unified GBP and Directory categories into    │
│ one simple page. Manage all your categories in     │
│ one place with fine-grained platform control.      │
│                                                     │
│ [Try Unified Categories →]    [Learn More]        │
└─────────────────────────────────────────────────────┘
```

### Onboarding Tooltip (New Page)
```
💡 New! Platform Assignment

You can now choose which platforms each category
applies to:

✓ Google Business Profile - Appears in Google Search
✓ Platform Directory - Appears in our directory

Most categories work for both, but you have full
control if needed!
```

## Success Metrics

### User Adoption
- **Target:** 80% of active users migrate within 30 days
- **Measure:** Track visits to unified page vs old pages

### User Satisfaction
- **Target:** 4.5+ star rating on new category management
- **Measure:** In-app feedback survey

### Data Quality
- **Target:** 95% of tenants have consistent categories across platforms
- **Measure:** Compare GBP vs Directory category assignments

### Support Tickets
- **Target:** 50% reduction in category-related support tickets
- **Measure:** Track tickets mentioning "category" or "GBP"

## Risks & Mitigation

### Risk 1: Data Loss During Migration
**Mitigation:**
- Backup all category data before migration
- Run migration in read-only mode first
- Allow manual rollback for 30 days

### Risk 2: User Confusion
**Mitigation:**
- Clear onboarding tooltips
- Video tutorial
- Help documentation
- In-app support chat

### Risk 3: Platform Sync Failures
**Mitigation:**
- Retry logic with exponential backoff
- Clear error messages
- Manual retry button
- Support team alerts for persistent failures

## Future Enhancements

### Phase 5: Advanced Features
- **AI Category Suggestions:** Recommend categories based on business description
- **Bulk Import:** Import categories from CSV
- **Category Analytics:** Show which categories drive most traffic
- **Multi-Platform Support:** Add Facebook, Yelp, Apple Maps
- **Category Templates:** Pre-configured category sets by industry

### Phase 6: Enterprise Features
- **Chain Propagation:** Apply categories to all locations
- **Category Approval Workflow:** Require admin approval for changes
- **Audit Log:** Track all category changes
- **API Access:** Allow programmatic category management

## Conclusion

The unified category management system represents a significant UX improvement that:

1. **Simplifies** the user experience by consolidating two separate workflows
2. **Empowers** users with fine-grained control over platform assignments
3. **Improves** data quality through a single source of truth
4. **Scales** easily to support additional platforms in the future

**Recommendation:** Proceed with implementation following the 4-week phased approach outlined above.

**Next Steps:**
1. Review and approve proposal
2. Create technical specifications
3. Begin Phase 1 implementation
4. Schedule user testing sessions
