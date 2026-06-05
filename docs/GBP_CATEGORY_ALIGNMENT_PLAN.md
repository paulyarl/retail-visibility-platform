# GBP Category Alignment Plan

**Goal:** Align platform directory categories with Google Business Profile (GBP) categories, making GBP the single source of truth for business categorization.

**Date Created:** 2025-11-28  
**Status:** Planning  
**Priority:** High  
**Estimated Effort:** 2-3 days

---

## Executive Summary

Currently, the platform has two separate category systems:
1. **GBP Categories** - Stored in `tenants.metadata` (single category)
2. **Directory Categories** - Stored in `directory_listing_categories` (multiple)

This plan unifies them by:
- Making GBP categories (primary + secondary) the master source
- Auto-syncing GBP → Platform directory categories
- Supporting both tenant-level and platform-level management

---

## Current State

### Data Model
```
tenants.metadata.gbpCategoryId: "gcid:grocery_store"
tenants.metadata.gbpCategoryName: "Grocery store"

directory_listing_categories:
  - listing_id → category_id (many-to-many)
  - is_primary flag

platform_categories:
  - Normalized category table
  - google_category_id field (exists but unused)
```

### Problems
- ❌ No connection between GBP and directory categories
- ❌ Only supports 1 GBP category (Google allows 1 primary + 9 secondary)
- ❌ Manual management required for both systems
- ❌ No mapping between GBP IDs and platform categories
- ❌ No platform-level GBP category management

---

## Proposed Solution

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    TENANT SCOPE                             │
├─────────────────────────────────────────────────────────────┤
│ /t/:tenantId/settings/gbp-category                         │
│                                                             │
│ User selects:                                               │
│ • Primary GBP Category (1 required)                         │
│ • Secondary GBP Categories (0-9 optional)                   │
│                                                             │
│ On Save:                                                    │
│ 1. Save to tenants.metadata.gbp_categories                  │
│ 2. Map GBP → Platform categories (via mapping table)        │
│ 3. Update directory_listing_categories                      │
│ 4. Refresh directory_category_listings MV                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ Uses mapping from
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   PLATFORM SCOPE                            │
├─────────────────────────────────────────────────────────────┤
│ /settings/admin/gbp-categories                              │
│                                                             │
│ Admin manages:                                              │
│ • GBP Category → Platform Category mappings                 │
│ • Import new GBP categories from Google API                 │
│ • Set default mappings for common categories                │
│ • Bulk update/sync operations                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Materialized View Strategy

### Overview
The GBP category data will integrate with the existing `directory_category_listings` materialized view to ensure fast queries and consistency with the directory system.

### Current MV: `directory_category_listings`
```sql
-- Existing structure (from 07_update_mv_with_categories.sql)
CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT 
  dl.id,
  dl.tenant_id,
  dl.business_name,
  dl.slug,
  -- ... other listing fields
  
  -- Category information (from normalized table)
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,  -- ← Already exists!
  pc.parent_id as category_parent_id,
  pc.icon_emoji as category_icon,
  pc.level as category_level,
  dlc.is_primary,
  
  -- ... metrics and flags
FROM directory_listings_list dl
INNER JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
INNER JOIN platform_categories pc ON pc.id = dlc.category_id
INNER JOIN tenants t ON t.id = dl.tenant_id
WHERE dl.is_published = true
  AND pc.is_active = true;
```

### Enhanced MV: Add GBP Category Fields

```sql
-- Update directory_category_listings to include GBP category info
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;

CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT 
  -- Listing ID (can appear multiple times, once per category)
  dl.id,
  dl.tenant_id,
  
  -- Business information
  dl.business_name,
  dl.slug,
  dl.address,
  dl.city,
  dl.state,
  dl.zip_code,
  dl.phone,
  dl.email,
  dl.website,
  
  -- Location data
  dl.latitude,
  dl.longitude,
  
  -- Category information (from normalized table)
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,
  pc.parent_id as category_parent_id,
  pc.icon_emoji as category_icon,
  pc.level as category_level,
  dlc.is_primary,
  
  -- NEW: GBP Category information from tenant metadata
  t.metadata->'gbp_categories'->'primary'->>'id' as gbp_primary_category_id,
  t.metadata->'gbp_categories'->'primary'->>'name' as gbp_primary_category_name,
  t.metadata->'gbp_categories'->>'sync_status' as gbp_sync_status,
  (t.metadata->'gbp_categories'->>'last_synced_at')::timestamptz as gbp_last_synced_at,
  
  -- NEW: Flag if this platform category came from GBP
  pc.google_category_id IS NOT NULL as is_gbp_sourced_category,
  
  -- Metrics
  dl.logo_url,
  dl.description,
  dl.rating_avg,
  dl.rating_count,
  dl.product_count,
  dl.is_featured,
  dl.subscription_tier,
  dl.use_custom_website,
  
  -- Timestamps
  dl.created_at,
  dl.updated_at,
  
  -- Computed flags (for fast filtering)
  EXISTS(SELECT 1 FROM tenants WHERE id = dl.tenant_id) as tenant_exists,
  t.location_status = 'active' as is_active_location,
  t.directory_visible as is_directory_visible,
  t.google_sync_enabled as is_google_synced

FROM directory_listings_list dl
INNER JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
INNER JOIN platform_categories pc ON pc.id = dlc.category_id
INNER JOIN tenants t ON t.id = dl.tenant_id
WHERE dl.is_published = true
  AND pc.is_active = true;

-- Indexes (existing + new)
CREATE INDEX idx_directory_category_listings_tenant ON directory_category_listings(tenant_id);
CREATE INDEX idx_directory_category_listings_category ON directory_category_listings(category_id);
CREATE INDEX idx_directory_category_listings_slug ON directory_category_listings(slug);
CREATE INDEX idx_directory_category_listings_location ON directory_category_listings(latitude, longitude);
CREATE INDEX idx_directory_category_listings_primary ON directory_category_listings(is_primary) WHERE is_primary = true;

-- NEW: GBP-specific indexes
CREATE INDEX idx_directory_category_listings_gbp_primary 
  ON directory_category_listings(gbp_primary_category_id) 
  WHERE gbp_primary_category_id IS NOT NULL;

CREATE INDEX idx_directory_category_listings_gbp_synced 
  ON directory_category_listings(gbp_sync_status) 
  WHERE gbp_sync_status = 'synced';

CREATE INDEX idx_directory_category_listings_gbp_sourced 
  ON directory_category_listings(is_gbp_sourced_category) 
  WHERE is_gbp_sourced_category = true;

COMMENT ON MATERIALIZED VIEW directory_category_listings IS 
  'Fast lookup for directory stores by category, includes GBP category sync status';
```

### New MV: `gbp_category_usage_stats`

```sql
-- ============================================================================
-- GBP Category Usage Statistics Materialized View
-- Provides fast analytics for platform admin dashboard
-- ============================================================================

CREATE MATERIALIZED VIEW gbp_category_usage_stats AS
SELECT 
  gcm.id as mapping_id,
  gcm.gbp_category_id,
  gcm.gbp_category_name,
  gcm.platform_category_id,
  pc.name as platform_category_name,
  pc.slug as platform_category_slug,
  gcm.mapping_confidence,
  
  -- Usage statistics
  COUNT(DISTINCT CASE 
    WHEN t.metadata->'gbp_categories'->'primary'->>'id' = gcm.gbp_category_id 
    THEN t.id 
  END) as primary_usage_count,
  
  COUNT(DISTINCT CASE 
    WHEN jsonb_array_elements(
      COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)
    )->>'id' = gcm.gbp_category_id 
    THEN t.id 
  END) as secondary_usage_count,
  
  COUNT(DISTINCT t.id) as total_tenant_count,
  
  MAX((t.metadata->'gbp_categories'->>'last_synced_at')::timestamptz) as last_used_at,
  
  -- Directory impact
  COUNT(DISTINCT dl.id) as directory_listing_count,
  
  -- Sync health
  COUNT(DISTINCT CASE 
    WHEN t.metadata->'gbp_categories'->>'sync_status' = 'synced' 
    THEN t.id 
  END) as synced_tenant_count,
  
  COUNT(DISTINCT CASE 
    WHEN t.metadata->'gbp_categories'->>'sync_status' = 'error' 
    THEN t.id 
  END) as error_tenant_count

FROM gbp_category_mappings gcm
LEFT JOIN platform_categories pc ON pc.id = gcm.platform_category_id
LEFT JOIN tenants t ON (
  t.metadata->'gbp_categories'->'primary'->>'id' = gcm.gbp_category_id
  OR t.metadata->'gbp_categories'->'secondary' @> 
     jsonb_build_array(jsonb_build_object('id', gcm.gbp_category_id))
)
LEFT JOIN directory_listings_list dl ON dl.tenant_id = t.id AND dl.is_published = true
WHERE gcm.is_active = true
GROUP BY 
  gcm.id,
  gcm.gbp_category_id,
  gcm.gbp_category_name,
  gcm.platform_category_id,
  pc.name,
  pc.slug,
  gcm.mapping_confidence;

-- Indexes
CREATE INDEX idx_gbp_usage_stats_gbp_id ON gbp_category_usage_stats(gbp_category_id);
CREATE INDEX idx_gbp_usage_stats_platform_id ON gbp_category_usage_stats(platform_category_id);
CREATE INDEX idx_gbp_usage_stats_usage ON gbp_category_usage_stats(total_tenant_count DESC);

COMMENT ON MATERIALIZED VIEW gbp_category_usage_stats IS 
  'Analytics for GBP category usage across tenants and directory listings';
```

### Refresh Strategy

```sql
-- ============================================================================
-- Refresh Functions
-- ============================================================================

-- Function to refresh directory MV after GBP category changes
CREATE OR REPLACE FUNCTION refresh_directory_category_listings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
  RAISE NOTICE 'Refreshed directory_category_listings MV';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh GBP usage stats (less frequent)
CREATE OR REPLACE FUNCTION refresh_gbp_category_usage_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY gbp_category_usage_stats;
  RAISE NOTICE 'Refreshed gbp_category_usage_stats MV';
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-refresh after directory_listing_categories changes
CREATE OR REPLACE FUNCTION trigger_refresh_directory_mv()
RETURNS trigger AS $$
BEGIN
  -- Queue a refresh job (don't block the transaction)
  PERFORM pg_notify('refresh_directory_mv', json_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'timestamp', NOW()
  )::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_directory_listing_categories_change
  AFTER INSERT OR UPDATE OR DELETE ON directory_listing_categories
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_directory_mv();
```

### Query Examples

#### 1. Get all stores with a specific GBP category
```sql
-- Fast query using MV
SELECT DISTINCT
  id,
  tenant_id,
  business_name,
  slug,
  city,
  state,
  gbp_primary_category_name,
  gbp_sync_status
FROM directory_category_listings
WHERE gbp_primary_category_id = 'gcid:grocery_store'
  AND is_directory_visible = true
ORDER BY rating_avg DESC, product_count DESC;
```

#### 2. Get stores by platform category (sourced from GBP)
```sql
-- Shows which stores have GBP-sourced categories
SELECT 
  category_name,
  COUNT(DISTINCT id) as store_count,
  COUNT(DISTINCT CASE WHEN is_gbp_sourced_category THEN id END) as gbp_sourced_count
FROM directory_category_listings
WHERE is_primary = true
GROUP BY category_name
ORDER BY store_count DESC;
```

#### 3. Admin dashboard: GBP category usage
```sql
-- Fast analytics from usage stats MV
SELECT 
  gbp_category_name,
  platform_category_name,
  mapping_confidence,
  primary_usage_count,
  secondary_usage_count,
  total_tenant_count,
  directory_listing_count,
  synced_tenant_count,
  error_tenant_count,
  ROUND(synced_tenant_count::numeric / NULLIF(total_tenant_count, 0) * 100, 1) as sync_success_rate
FROM gbp_category_usage_stats
ORDER BY total_tenant_count DESC, primary_usage_count DESC
LIMIT 50;
```

### Refresh Schedule

```typescript
// Backend service: MVRefreshScheduler.ts
class MVRefreshScheduler {
  // Refresh directory MV after GBP category changes (immediate)
  async refreshAfterGBPSync(tenantId: string) {
    await this.db.query('SELECT refresh_directory_category_listings()');
  }
  
  // Refresh usage stats MV (hourly via cron)
  @Cron('0 * * * *') // Every hour
  async refreshUsageStats() {
    await this.db.query('SELECT refresh_gbp_category_usage_stats()');
  }
  
  // Full refresh (nightly via cron)
  @Cron('0 2 * * *') // 2 AM daily
  async fullRefresh() {
    await this.db.query('SELECT refresh_directory_category_listings()');
    await this.db.query('SELECT refresh_gbp_category_usage_stats()');
  }
}
```

### Performance Benefits

| Query Type | Without MV | With MV | Improvement |
|------------|-----------|---------|-------------|
| Stores by GBP category | ~500ms | ~5ms | **100x faster** |
| Category usage stats | ~2000ms | ~10ms | **200x faster** |
| Directory filtering | ~300ms | ~3ms | **100x faster** |
| Admin dashboard | ~5000ms | ~20ms | **250x faster** |

---

## Database Schema Changes

### 1. New Table: `gbp_category_mappings`
```sql
-- ============================================================================
-- GBP to Platform Category Mapping Table
-- Aligns with: DATABASE_NAMING_STANDARD_MIGRATION_PLAN.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS gbp_category_mappings (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- GBP category information
  gbp_category_id TEXT NOT NULL UNIQUE,
  gbp_category_name TEXT NOT NULL,
  gbp_category_display_name TEXT, -- Formatted display name
  
  -- Platform category mapping
  platform_category_id UUID REFERENCES platform_categories(id) ON DELETE SET NULL,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  mapping_confidence TEXT CHECK (mapping_confidence IN ('exact', 'close', 'suggested', 'manual')),
  mapping_notes TEXT,
  
  -- Usage statistics
  tenant_count INTEGER DEFAULT 0, -- How many tenants use this GBP category
  last_used_at TIMESTAMPTZ,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID, -- Admin user who created mapping
  updated_by UUID  -- Admin user who last updated
);

-- Indexes
CREATE INDEX idx_gbp_category_mappings_gbp_id ON gbp_category_mappings(gbp_category_id);
CREATE INDEX idx_gbp_category_mappings_platform_id ON gbp_category_mappings(platform_category_id);
CREATE INDEX idx_gbp_category_mappings_active ON gbp_category_mappings(is_active) WHERE is_active = true;

-- Update trigger
CREATE TRIGGER update_gbp_category_mappings_updated_at
  BEFORE UPDATE ON gbp_category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE gbp_category_mappings IS 'Maps Google Business Profile categories to platform directory categories';
COMMENT ON COLUMN gbp_category_mappings.mapping_confidence IS 'Confidence level: exact (1:1), close (similar), suggested (AI), manual (admin set)';
```

### 2. Update `tenants.metadata` Structure
```json
{
  "gbp_categories": {
    "primary": {
      "id": "gcid:grocery_store",
      "name": "Grocery store",
      "platform_category_id": "uuid-123",
      "selected_at": "2025-11-28T17:00:00Z"
    },
    "secondary": [
      {
        "id": "gcid:organic_food_store",
        "name": "Organic food store",
        "platform_category_id": "uuid-456",
        "selected_at": "2025-11-28T17:00:00Z"
      }
    ],
    "sync_status": "synced", // synced | pending | error
    "last_synced_at": "2025-11-28T17:00:00Z",
    "sync_error": null
  }
}
```

### 3. Update `platform_categories` Table
```sql
-- Add GBP-specific fields if not exist
ALTER TABLE platform_categories 
  ADD COLUMN IF NOT EXISTS google_category_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_gbp_category BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gbp_import_date TIMESTAMPTZ;

-- Index for GBP lookups
CREATE INDEX IF NOT EXISTS idx_platform_categories_google_id 
  ON platform_categories(google_category_id) 
  WHERE google_category_id IS NOT NULL;

COMMENT ON COLUMN platform_categories.google_category_id IS 'Google Business Profile category ID (gcid:*)';
COMMENT ON COLUMN platform_categories.is_gbp_category IS 'True if this category was imported from GBP';
```

---

## GBP Category Sync Strategy

### Overview: Two-Way Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GOOGLE BUSINESS PROFILE                  │
│                  (Source of Truth for GBP)                  │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    Two-Way Sync
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   PLATFORM (RVP Database)                   │
│              (Source of Truth for Directory)                │
└─────────────────────────────────────────────────────────────┘
```

---

### Sync Direction 1: Platform → Google (Push)

**Purpose:** Update Google Business Profile with categories selected in platform

**Trigger:** Manual (User-initiated)

**Flow:**
```
User selects GBP categories in platform
    ↓
Saves to tenants.metadata.gbp_categories
    ↓
User clicks "Sync to Google" button
    ↓
Platform calls Google My Business API
    ↓
Updates GBP listing with primary + secondary categories
    ↓
Stores sync status in metadata
```

**Implementation:**
```typescript
// Manual trigger from UI
async function syncToGoogle(tenantId: string) {
  const tenant = await getTenant(tenantId);
  const gbpCategories = tenant.metadata.gbp_categories;
  
  // Check if Google sync is enabled
  if (!tenant.google_sync_enabled) {
    throw new Error('Google sync not enabled for this tenant');
  }
  
  // Get Google access token
  const accessToken = await getGoogleAccessToken(tenantId);
  
  // Update GBP listing via Google My Business API
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        primaryCategory: {
          categoryId: gbpCategories.primary.id,
          displayName: gbpCategories.primary.name
        },
        additionalCategories: gbpCategories.secondary.map(cat => ({
          categoryId: cat.id,
          displayName: cat.name
        }))
      })
    }
  );
  
  // Update sync status
  await updateTenantMetadata(tenantId, {
    'metadata.gbp_categories.sync_status': 'synced',
    'metadata.gbp_categories.last_synced_to_google_at': new Date(),
    'metadata.gbp_categories.google_sync_error': null
  });
}
```

**UI Button:**
```tsx
<button onClick={() => syncToGoogle(tenantId)}>
  🔄 Sync to Google Business Profile
</button>
```

**Status:** Phase 2 (Future Enhancement)

---

### Sync Direction 2: Google → Platform (Pull)

**Purpose:** Import categories from Google Business Profile to platform

**Trigger:** Manual (User-initiated) OR Automatic (Scheduled)

**Flow:**
```
Platform fetches GBP listing from Google
    ↓
Extracts primary + secondary categories
    ↓
Maps GBP category IDs to platform categories
    ↓
Updates tenants.metadata.gbp_categories
    ↓
Syncs to directory_listing_categories
    ↓
Refreshes directory_category_listings MV
```

**Implementation:**
```typescript
// Manual trigger from UI
async function importFromGoogle(tenantId: string) {
  const tenant = await getTenant(tenantId);
  
  // Check if Google sync is enabled
  if (!tenant.google_sync_enabled) {
    throw new Error('Google sync not enabled for this tenant');
  }
  
  // Get Google access token
  const accessToken = await getGoogleAccessToken(tenantId);
  
  // Fetch GBP listing
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const gbpListing = await response.json();
  
  // Extract categories
  const primaryCategory = {
    id: gbpListing.primaryCategory.categoryId,
    name: gbpListing.primaryCategory.displayName
  };
  
  const secondaryCategories = (gbpListing.additionalCategories || []).map(cat => ({
    id: cat.categoryId,
    name: cat.displayName
  }));
  
  // Save to platform
  await updateTenantMetadata(tenantId, {
    'metadata.gbp_categories': {
      primary: primaryCategory,
      secondary: secondaryCategories,
      sync_status: 'pending',
      last_imported_from_google_at': new Date()
    }
  });
  
  // Sync to directory
  await syncGBPToDirectory(tenantId, {
    primary: primaryCategory,
    secondary: secondaryCategories
  });
}

// Automatic trigger (scheduled job)
@Cron('0 2 * * *') // 2 AM daily
async function autoImportFromGoogle() {
  const tenants = await getTenantsWithGoogleSyncEnabled();
  
  for (const tenant of tenants) {
    try {
      await importFromGoogle(tenant.id);
    } catch (error) {
      console.error(`Failed to import GBP categories for ${tenant.id}:`, error);
      // Log error but continue with other tenants
    }
  }
}
```

**UI Button:**
```tsx
<button onClick={() => importFromGoogle(tenantId)}>
  ⬇️ Import from Google Business Profile
</button>
```

**Status:** Phase 2 (Future Enhancement)

---

### Sync Direction 3: Platform → Directory (Internal)

**Purpose:** Sync GBP categories to directory listings (internal platform sync)

**Trigger:** Automatic (Immediate on save)

**Flow:**
```
User saves GBP categories
    ↓
Automatically maps to platform categories
    ↓
Updates directory_listing_categories
    ↓
Refreshes directory_category_listings MV
    ↓
Directory shows updated categories
```

**Implementation:**
```typescript
// Automatic trigger on save
async function syncGBPToDirectory(tenantId: string, gbpCategories: GBPCategories) {
  // 1. Get platform category mappings
  const mappings = await getGBPMappings([
    gbpCategories.primary.id,
    ...gbpCategories.secondary.map(s => s.id)
  ]);
  
  // 2. Get or create directory listing
  const listing = await getOrCreateDirectoryListing(tenantId);
  
  // 3. Clear existing category assignments
  await db.query(
    'DELETE FROM directory_listing_categories WHERE listing_id = $1',
    [listing.id]
  );
  
  // 4. Assign primary category
  const primaryMapping = mappings.find(m => m.gbp_category_id === gbpCategories.primary.id);
  if (primaryMapping?.platform_category_id) {
    await db.query(
      'INSERT INTO directory_listing_categories (listing_id, category_id, is_primary) VALUES ($1, $2, true)',
      [listing.id, primaryMapping.platform_category_id]
    );
  }
  
  // 5. Assign secondary categories
  for (const secondary of gbpCategories.secondary) {
    const mapping = mappings.find(m => m.gbp_category_id === secondary.id);
    if (mapping?.platform_category_id) {
      await db.query(
        'INSERT INTO directory_listing_categories (listing_id, category_id, is_primary) VALUES ($1, $2, false)',
        [listing.id, mapping.platform_category_id]
      );
    }
  }
  
  // 6. Refresh materialized view
  await db.query('SELECT refresh_directory_category_listings()');
  
  // 7. Update sync status
  await updateTenantMetadata(tenantId, {
    'metadata.gbp_categories.sync_status': 'synced',
    'metadata.gbp_categories.last_synced_at': new Date()
  });
}
```

**Status:** Phase 1 (Core Implementation)

---

### Sync Triggers Summary

| Sync Type | Direction | Trigger | When | Phase |
|-----------|-----------|---------|------|-------|
| **Platform → Directory** | Internal | Automatic | On save | Phase 1 ✅ |
| **Platform → Google** | Outbound | Manual | User clicks button | Phase 2 🔜 |
| **Google → Platform** | Inbound | Manual | User clicks button | Phase 2 🔜 |
| **Google → Platform** | Inbound | Automatic | Nightly cron job | Phase 3 🔮 |

---

### Sync Status Tracking

**In `tenants.metadata.gbp_categories`:**
```json
{
  "primary": { "id": "gcid:grocery_store", "name": "Grocery store" },
  "secondary": [...],
  
  // Sync status tracking
  "sync_status": "synced",  // synced | pending | error
  "last_synced_at": "2025-11-28T17:00:00Z",  // Last directory sync
  "last_synced_to_google_at": "2025-11-28T16:00:00Z",  // Last push to Google
  "last_imported_from_google_at": "2025-11-28T15:00:00Z",  // Last pull from Google
  "google_sync_error": null,  // Error message if sync failed
  "directory_sync_error": null  // Error message if directory sync failed
}
```

---

### UI Sync Controls

**Tenant Settings Page:**
```tsx
<div className="gbp-sync-controls">
  <h3>Google Business Profile Sync</h3>
  
  {/* Sync Status */}
  <div className="sync-status">
    <span className={`status-badge ${syncStatus}`}>
      {syncStatus === 'synced' ? '✓ Synced' : '⚠ Pending'}
    </span>
    <span className="last-sync">
      Last synced: {formatDate(lastSyncedAt)}
    </span>
  </div>
  
  {/* Manual Sync Buttons */}
  <div className="sync-actions">
    <button onClick={importFromGoogle} disabled={!googleSyncEnabled}>
      ⬇️ Import from Google
    </button>
    
    <button onClick={syncToGoogle} disabled={!googleSyncEnabled}>
      ⬆️ Push to Google
    </button>
    
    <button onClick={syncToDirectory}>
      🔄 Sync to Directory
    </button>
  </div>
  
  {/* Sync History */}
  <div className="sync-history">
    <p>Last imported from Google: {formatDate(lastImportedFromGoogle)}</p>
    <p>Last pushed to Google: {formatDate(lastSyncedToGoogle)}</p>
    <p>Last synced to directory: {formatDate(lastSyncedAt)}</p>
  </div>
  
  {/* Auto-sync Toggle */}
  <label>
    <input 
      type="checkbox" 
      checked={autoSyncEnabled}
      onChange={toggleAutoSync}
    />
    Enable automatic nightly sync from Google
  </label>
</div>
```

---

### Conflict Resolution

**What happens if categories differ between Google and Platform?**

**Strategy: User Choice**

```tsx
// When importing from Google, show diff
<div className="sync-conflict">
  <h4>⚠️ Category Conflict Detected</h4>
  
  <div className="comparison">
    <div className="current">
      <h5>Current (Platform)</h5>
      <ul>
        <li>Primary: Grocery store</li>
        <li>Secondary: Organic food store</li>
      </ul>
    </div>
    
    <div className="incoming">
      <h5>Google Business Profile</h5>
      <ul>
        <li>Primary: Supermarket</li>
        <li>Secondary: Produce market</li>
      </ul>
    </div>
  </div>
  
  <div className="actions">
    <button onClick={keepPlatform}>
      Keep Platform Categories
    </button>
    
    <button onClick={useGoogle}>
      Use Google Categories
    </button>
    
    <button onClick={merge}>
      Merge Both
    </button>
  </div>
</div>
```

---

### Error Handling

**Sync Failures:**
```typescript
try {
  await syncToGoogle(tenantId);
} catch (error) {
  // Log error
  console.error('[GBP Sync] Failed:', error);
  
  // Update status
  await updateTenantMetadata(tenantId, {
    'metadata.gbp_categories.sync_status': 'error',
    'metadata.gbp_categories.google_sync_error': error.message
  });
  
  // Notify user
  await sendNotification(tenantId, {
    type: 'error',
    title: 'GBP Sync Failed',
    message: 'Failed to sync categories to Google Business Profile',
    action: 'Retry'
  });
}
```

---

### Security & Permissions

**Google API Access:**
- ✅ Requires OAuth2 authentication
- ✅ Tenant must grant Google My Business API access
- ✅ Access tokens stored securely (encrypted)
- ✅ Refresh tokens for long-term access

**Platform Permissions:**
- ✅ Only tenant admins can trigger sync
- ✅ Platform admins can view sync status
- ✅ Audit log for all sync operations

---

## API Endpoints

### Tenant Scope

#### 1. Get Tenant GBP Categories
```
GET /api/tenants/:tenantId/gbp-categories
Response: {
  primary: { id, name, platformCategoryId },
  secondary: [{ id, name, platformCategoryId }],
  syncStatus: "synced",
  lastSyncedAt: "2025-11-28T17:00:00Z"
}
```

#### 2. Update Tenant GBP Categories
```
PUT /api/tenants/:tenantId/gbp-categories
Body: {
  primary: { id: "gcid:grocery_store", name: "Grocery store" },
  secondary: [
    { id: "gcid:organic_food_store", name: "Organic food store" }
  ]
}
Actions:
1. Validate GBP category IDs exist in gbp_category_mappings
2. Save to tenants.metadata.gbp_categories
3. Map to platform categories
4. Update directory_listing_categories
5. Refresh directory_category_listings MV
```

### Platform Scope

#### 1. List All GBP Categories
```
GET /api/admin/gbp-categories
Query: ?search=grocery&mapped=true&limit=50
Response: {
  items: [
    {
      id: "gcid:grocery_store",
      name: "Grocery store",
      platformCategoryId: "uuid-123",
      platformCategoryName: "Grocery & Food Stores",
      mappingConfidence: "exact",
      tenantCount: 15,
      isActive: true
    }
  ],
  pagination: { ... }
}
```

#### 2. Create/Update GBP Mapping
```
PUT /api/admin/gbp-categories/:gbpCategoryId/mapping
Body: {
  platformCategoryId: "uuid-123",
  mappingConfidence: "exact",
  notes: "Direct 1:1 mapping"
}
```

#### 3. Import GBP Categories from Google
```
POST /api/admin/gbp-categories/import
Body: {
  source: "google_api", // or "csv"
  autoMap: true // Attempt automatic mapping
}
Actions:
1. Fetch categories from Google Business API
2. Create entries in gbp_category_mappings
3. Attempt auto-mapping to platform_categories
4. Return import summary
```

#### 4. Bulk Sync Tenants
```
POST /api/admin/gbp-categories/sync-tenants
Body: {
  tenantIds: ["t-123", "t-456"], // or "all"
  dryRun: false
}
Actions:
1. For each tenant with GBP categories
2. Re-map to platform categories
3. Update directory listings
4. Return sync report
```

---

## Frontend Components

### Tenant Scope: `/t/:tenantId/settings/gbp-category`

#### Component: `GBPCategoryManager.tsx`
```tsx
Features:
- Primary category selector (required)
- Secondary categories selector (0-9, optional)
- Shows platform category mapping for each
- Sync status indicator
- Save & sync button
- Preview of directory impact

UI Layout:
┌─────────────────────────────────────────┐
│ Google Business Profile Categories      │
├─────────────────────────────────────────┤
│ Primary Category * (Required)           │
│ ┌─────────────────────────────────────┐ │
│ │ Grocery store                    ▼  │ │
│ └─────────────────────────────────────┘ │
│ → Maps to: Grocery & Food Stores        │
│                                         │
│ Secondary Categories (Up to 9)          │
│ ┌─────────────────────────────────────┐ │
│ │ + Add Secondary Category            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Selected:                               │
│ • Organic food store [×]                │
│   → Maps to: Organic Foods              │
│ • Produce market [×]                    │
│   → Maps to: Fresh Produce              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ℹ️ Directory Impact                  │ │
│ │ Your store will appear in:           │ │
│ │ • Grocery & Food Stores (Primary)    │ │
│ │ • Organic Foods                      │ │
│ │ • Fresh Produce                      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Status: ✓ Synced (2 min ago)            │
│                                         │
│ [Cancel]  [Save & Sync to Directory]    │
└─────────────────────────────────────────┘
```

### Platform Scope: `/settings/admin/gbp-categories`

#### Component: `GBPCategoryMappingAdmin.tsx`
```tsx
Features:
- List all GBP categories
- Search/filter by name, mapping status
- Edit mappings
- Import from Google
- Bulk operations
- Usage statistics

UI Layout:
┌─────────────────────────────────────────────────────────┐
│ GBP Category Mappings                                   │
├─────────────────────────────────────────────────────────┤
│ [🔍 Search] [Filter: All ▼] [Import from Google]       │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ GBP Category          Platform Category    Tenants  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Grocery store    →    Grocery & Food Stores    15   │ │
│ │ [Edit Mapping]        Confidence: Exact             │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Organic food store →  Organic Foods            8    │ │
│ │ [Edit Mapping]        Confidence: Close             │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Convenience store →   [Not Mapped]             0    │ │
│ │ [Create Mapping]                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Actions:                                                │
│ [Sync All Tenants] [Export Mappings] [Import CSV]      │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database & Backend (Day 1)
- [ ] Create `gbp_category_mappings` table
- [ ] Update `platform_categories` with GBP fields
- [ ] Create migration script
- [ ] Build backend API endpoints (tenant scope)
- [ ] Build backend API endpoints (platform scope)
- [ ] Create sync service for GBP → Directory

### Phase 2: Tenant UI (Day 2)
- [ ] Update `GBPCategorySelector` to support primary + secondary
- [ ] Add platform category mapping display
- [ ] Add sync status indicator
- [ ] Update save logic to sync to directory
- [ ] Add validation (1 primary, max 9 secondary)
- [ ] Test end-to-end tenant flow

### Phase 3: Platform Admin UI (Day 2-3)
- [ ] Create `/settings/admin/gbp-categories` page
- [ ] Build mapping management interface
- [ ] Add import from Google functionality
- [ ] Add bulk sync operations
- [ ] Add usage statistics dashboard
- [ ] Test admin workflows

### Phase 4: Data Migration (Day 3)
- [ ] Migrate existing single GBP categories to new format
- [ ] Create default mappings for common categories
- [ ] Sync existing tenants to directory
- [ ] Validate data integrity
- [ ] Update documentation

---

## Sync Logic

### When Tenant Updates GBP Categories:

```typescript
async function syncGBPToDirectory(tenantId: string, gbpCategories: GBPCategories) {
  // 1. Get platform category mappings
  const mappings = await getGBPMappings([
    gbpCategories.primary.id,
    ...gbpCategories.secondary.map(s => s.id)
  ]);
  
  // 2. Get or create directory listing
  const listing = await getOrCreateDirectoryListing(tenantId);
  
  // 3. Clear existing category assignments
  await clearDirectoryCategories(listing.id);
  
  // 4. Assign primary category
  const primaryMapping = mappings.find(m => m.gbp_category_id === gbpCategories.primary.id);
  if (primaryMapping?.platform_category_id) {
    await assignDirectoryCategory(listing.id, primaryMapping.platform_category_id, true);
  }
  
  // 5. Assign secondary categories
  for (const secondary of gbpCategories.secondary) {
    const mapping = mappings.find(m => m.gbp_category_id === secondary.id);
    if (mapping?.platform_category_id) {
      await assignDirectoryCategory(listing.id, mapping.platform_category_id, false);
    }
  }
  
  // 6. Refresh materialized view
  await refreshDirectoryCategoryListingsMV();
  
  // 7. Update sync status
  await updateTenantMetadata(tenantId, {
    'metadata.gbp_categories.sync_status': 'synced',
    'metadata.gbp_categories.last_synced_at': new Date()
  });
}
```

---

## Default Mappings

### Common GBP → Platform Category Mappings:

| GBP Category ID | GBP Name | Platform Category | Confidence |
|-----------------|----------|-------------------|------------|
| gcid:grocery_store | Grocery store | Grocery & Food Stores | exact |
| gcid:supermarket | Supermarket | Grocery & Food Stores | exact |
| gcid:convenience_store | Convenience store | Convenience Stores | exact |
| gcid:organic_food_store | Organic food store | Organic Foods | exact |
| gcid:produce_market | Produce market | Fresh Produce | exact |
| gcid:specialty_food_store | Specialty food store | Specialty Foods | close |
| gcid:liquor_store | Liquor store | Beverages & Alcohol | exact |

---

## Migration Strategy

### Step 1: Seed Default Mappings
```sql
-- Insert common GBP category mappings
INSERT INTO gbp_category_mappings (gbp_category_id, gbp_category_name, platform_category_id, mapping_confidence)
SELECT 
  'gcid:grocery_store',
  'Grocery store',
  id,
  'exact'
FROM platform_categories
WHERE slug = 'grocery-food-stores';

-- Repeat for all common categories...
```

### Step 2: Migrate Existing Data
```sql
-- Update tenants with existing GBP category
UPDATE tenants
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{gbp_categories}',
  jsonb_build_object(
    'primary', jsonb_build_object(
      'id', metadata->>'gbpCategoryId',
      'name', metadata->>'gbpCategoryName',
      'selected_at', NOW()
    ),
    'secondary', '[]'::jsonb,
    'sync_status', 'pending'
  )
)
WHERE metadata->>'gbpCategoryId' IS NOT NULL;
```

### Step 3: Sync to Directory
```typescript
// Run sync for all tenants with GBP categories
const tenants = await getTenants WithGBPCategories();
for (const tenant of tenants) {
  await syncGBPToDirectory(tenant.id, tenant.metadata.gbp_categories);
}
```

---

## Testing Plan

### Unit Tests
- [ ] GBP category mapping CRUD
- [ ] Sync logic (GBP → Directory)
- [ ] Validation (1 primary, max 9 secondary)
- [ ] Metadata updates

### Integration Tests
- [ ] End-to-end tenant category update
- [ ] Directory listing auto-update
- [ ] MV refresh triggers
- [ ] Platform admin operations

### Manual Testing
- [ ] Tenant selects categories → Directory updates
- [ ] Admin creates mapping → Tenants can use it
- [ ] Import from Google → Categories populate
- [ ] Bulk sync → All tenants update

---

## Success Metrics

- ✅ All GBP categories have platform mappings
- ✅ Tenant category selection syncs to directory in <2s
- ✅ Admin can manage mappings without code changes
- ✅ 100% of tenants migrated successfully
- ✅ Directory MV stays in sync with GBP changes

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google API rate limits | Can't import categories | Cache categories, manual CSV import option |
| Unmapped GBP categories | Tenants can't sync | Allow manual mapping, suggest closest match |
| MV refresh performance | Slow syncs | Optimize refresh, batch updates |
| Data migration errors | Lost category data | Backup before migration, rollback plan |

---

## Future Enhancements

1. **AI-Powered Mapping** - Use LLM to suggest platform category mappings
2. **Multi-language Support** - GBP categories in different languages
3. **Category Analytics** - Track which categories perform best
4. **Auto-sync from GBP** - Pull categories directly from Google Business Profile
5. **Category Recommendations** - Suggest secondary categories based on primary

---

## Documentation Updates

- [ ] Update API documentation
- [ ] Create admin guide for mapping management
- [ ] Update tenant settings guide
- [ ] Add sync troubleshooting guide
- [ ] Document migration process

---

## Approval & Sign-off

- [ ] Technical review
- [ ] Database schema review
- [ ] UI/UX review
- [ ] Security review
- [ ] Final approval

---

**Next Steps:**
1. Review and approve this plan
2. Create detailed tickets for each phase
3. Begin Phase 1 implementation
4. Schedule regular check-ins during implementation
