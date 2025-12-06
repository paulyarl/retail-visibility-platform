# Unified Categories - Implementation & Testing Plan

## Executive Summary

**Scope:** Consolidate GBP and Directory category management into a unified system
**Risk Level:** 🔴 HIGH - Impacts core data model, APIs, materialized views, and triggers
**Timeline:** 6-8 weeks (phased rollout with extensive testing)
**Rollback Strategy:** Full backup + parallel systems during transition

---

## Master Plan Components

This implementation consists of **four integrated strategies**:

### 1. **Database Schema** (`UNIFIED_CATEGORIES_SCHEMA_COMPLIANT.md`)
- New `tenant_category_assignments` table
- **100% compliant** with platform naming standards
- Single source of truth for all categories
- Platform assignment flags (GBP/Directory/Both)

### 2. **Materialized View Alignment** (`UNIFIED_CATEGORIES_MV_ALIGNMENT.md`) ⭐
- **Critical:** Ensures existing MVs continue working
- Sync triggers keep legacy tables updated
- Zero downtime for directory queries
- Gradual migration to new unified MVs
- **Existing MVs:**
  - `directory_category_listings` (product categories)
  - `directory_category_stats` (product category stats)
  - `directory_gbp_listings` (GBP store types)
  - `directory_gbp_stats` (GBP category stats)

### 3. **UI Simplification** (`UNIFIED_CATEGORIES_SIMPLIFICATION.md`)
- Remove redundant category badge from store cards
- Keep sidebar filter only (cleaner UI)
- Unified category management page
- Platform checkboxes (GBP/Directory/Both)

### 4. **Testing & Validation** (This document)
- Comprehensive test scripts
- Phased rollout strategy
- Risk mitigation at each phase
- Rollback procedures

---

## Impact Assessment

### 🔴 **Critical Impact Areas**

#### 1. Database Schema
**Tables Affected:**
- `tenant_business_profiles_list` - GBP categories stored here
- `directory_listings` - Directory categories stored here
- `tenant_category_assignments` - NEW unified table

**Materialized Views:**
- `mv_directory_stores` - Uses directory categories for filtering
- `mv_store_analytics` - May reference category data
- Any views joining category data

**Triggers:**
- Category sync triggers between GBP and directory
- Audit log triggers for category changes
- Search index update triggers

#### 2. API Endpoints
**Existing Endpoints to Modify:**
```
GET  /api/tenant/gbp-category
PUT  /api/tenant/gbp-category
GET  /api/directory/categories
PUT  /api/directory/settings
GET  /api/gbp/categories (search)
GET  /api/gbp/categories/popular
GET  /api/gbp/mappings
```

**New Endpoints to Create:**
```
GET  /api/tenants/:id/categories/unified
POST /api/tenants/:id/categories/unified
PUT  /api/tenants/:id/categories/unified/:categoryId
DEL  /api/tenants/:id/categories/unified/:categoryId
GET  /api/tenants/:id/categories/sync-status
```

#### 3. Frontend Components
**Components to Update:**
- `GBPCategoryCard.tsx`
- `DirectorySettingsPanel.tsx`
- `StoreCard.tsx` (remove badge)
- `DirectoryFilters.tsx` (rename Store Type)
- All category selectors

#### 4. Data Integrity
**Critical Concerns:**
- Existing category data must not be lost
- GBP sync must continue working during migration
- Directory listings must remain functional
- Search/filtering must work throughout transition

---

## Phased Implementation Plan

### 📋 **Phase 0: Discovery & Planning** (Week 1)
**Goal:** Understand current system completely before making changes

#### Tasks:
1. ✅ Map all database dependencies
2. ✅ Document all API endpoints using category data
3. ✅ Identify all materialized views with category columns
4. ✅ List all triggers related to categories
5. ✅ Document frontend components using categories
6. ✅ Create comprehensive test plan
7. ✅ Set up test environment

#### Deliverables:
- Database dependency map
- API endpoint inventory
- Test script suite
- Risk mitigation plan

---

### 🔍 **Phase 1: Analysis & Test Setup** (Week 2)
**Goal:** Create safety net before making any changes

#### 1.1 Database Analysis Script
```sql
-- File: scripts/analyze-category-dependencies.sql

-- Find all tables with category columns
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name LIKE '%category%'
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- Find all materialized views
SELECT 
  schemaname,
  matviewname,
  definition
FROM pg_matviews
WHERE schemaname = 'public';

-- Find all triggers
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (action_statement LIKE '%category%' 
       OR event_object_table IN (
         'tenant_business_profiles_list',
         'directory_listings'
       ));

-- Find all foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%category%' 
       OR ccu.table_name LIKE '%category%');
```

#### 1.2 Data Snapshot Script
```sql
-- File: scripts/snapshot-category-data.sql

-- Create backup tables
CREATE TABLE backup_tenant_business_profiles_list AS 
SELECT * FROM tenant_business_profiles_list;

CREATE TABLE backup_directory_listings AS 
SELECT * FROM directory_listings;

-- Count current categories
SELECT 
  'GBP Primary' as category_type,
  COUNT(*) as count
FROM tenant_business_profiles_list
WHERE gbp_primary_category_id IS NOT NULL

UNION ALL

SELECT 
  'GBP Secondary' as category_type,
  COUNT(*) as count
FROM tenant_business_profiles_list
WHERE gbp_secondary_categories IS NOT NULL

UNION ALL

SELECT 
  'Directory Primary' as category_type,
  COUNT(*) as count
FROM directory_listings
WHERE primary_category IS NOT NULL

UNION ALL

SELECT 
  'Directory Secondary' as category_type,
  COUNT(*) as count
FROM directory_listings
WHERE secondary_categories IS NOT NULL;
```

#### 1.3 API Test Suite
```typescript
// File: tests/integration/category-api.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { api } from '@/lib/api';

describe('Category API - Pre-Migration Baseline', () => {
  let testTenantId: string;
  
  beforeAll(async () => {
    // Create test tenant with categories
    testTenantId = await createTestTenant();
  });

  describe('GBP Category Endpoints', () => {
    it('should fetch GBP categories', async () => {
      const response = await api.get(`/api/tenant/gbp-category?tenantId=${testTenantId}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('primary');
      expect(data).toHaveProperty('secondary');
    });

    it('should update GBP categories', async () => {
      const response = await api.put('/api/tenant/gbp-category', {
        tenantId: testTenantId,
        primary: { id: 'gcid:grocery_store', name: 'Grocery Store' },
        secondary: []
      });
      expect(response.ok).toBe(true);
    });

    it('should search GBP categories', async () => {
      const response = await api.get(`/api/gbp/categories?query=grocery&tenantId=${testTenantId}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.items).toBeInstanceOf(Array);
    });
  });

  describe('Directory Category Endpoints', () => {
    it('should fetch directory categories', async () => {
      const response = await api.get('/api/directory/categories');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.categories).toBeInstanceOf(Array);
    });

    it('should update directory settings with categories', async () => {
      const response = await api.put('/api/directory/settings', {
        tenantId: testTenantId,
        primaryCategory: 'Grocery Store',
        secondaryCategories: ['Convenience Store']
      });
      expect(response.ok).toBe(true);
    });
  });

  describe('Category Mappings', () => {
    it('should fetch GBP to Directory mappings', async () => {
      const response = await api.get(`/api/gbp/mappings?categoryIds=gcid:grocery_store`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.mappings).toBeInstanceOf(Array);
    });
  });
});
```

#### 1.4 Materialized View Test
```sql
-- File: tests/sql/test-materialized-views.sql

-- Test mv_directory_stores
SELECT 
  COUNT(*) as total_stores,
  COUNT(DISTINCT primary_category) as unique_categories
FROM mv_directory_stores;

-- Test filtering by category
SELECT 
  primary_category,
  COUNT(*) as store_count
FROM mv_directory_stores
WHERE primary_category IS NOT NULL
GROUP BY primary_category
ORDER BY store_count DESC
LIMIT 10;

-- Verify view refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_directory_stores;
```

---

### 🏗️ **Phase 2: Build Unified System (Parallel)** (Week 3-4)
**Goal:** Create new unified system WITHOUT touching existing system

**⚠️ CRITICAL:** This phase includes materialized view alignment strategy.
See `UNIFIED_CATEGORIES_MV_ALIGNMENT.md` for complete MV integration plan.

#### 2.1 Create New Database Schema

**⚠️ IMPORTANT:** This schema is **fully compliant** with platform database naming standards.
See `UNIFIED_CATEGORIES_SCHEMA_COMPLIANT.md` for complete compliance documentation.

```sql
-- File: migrations/001_create_unified_categories.sql
-- Compliant with DATABASE_NAMING_STANDARD_MIGRATION_PLAN.md

CREATE TABLE tenant_category_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Category identification (snake_case)
  category_id VARCHAR(255) NOT NULL,
  category_name VARCHAR(500) NOT NULL,
  category_source VARCHAR(50) NOT NULL, -- 'gbp' or 'directory'
  
  -- Platform assignments (is_ prefix for booleans)
  is_assigned_to_gbp BOOLEAN NOT NULL DEFAULT false,
  is_assigned_to_directory BOOLEAN NOT NULL DEFAULT false,
  
  -- Hierarchy (is_ prefix for booleans)
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Sync tracking (snake_case)
  gbp_sync_status VARCHAR(50),
  directory_sync_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  
  -- Standard timestamps (snake_case)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints (proper naming: fk_, uq_, ck_ prefixes)
  CONSTRAINT fk_tenant_category_assignments_tenant_id 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_tenant_category_assignments_tenant_id_category_id 
    UNIQUE(tenant_id, category_id),
  CONSTRAINT ck_tenant_category_assignments_platform_assignment 
    CHECK (is_assigned_to_gbp = true OR is_assigned_to_directory = true),
  CONSTRAINT ck_one_primary CHECK (
    NOT is_primary OR 
    (SELECT COUNT(*) FROM tenant_category_assignments tca 
     WHERE tca.tenant_id = tenant_category_assignments.tenant_id 
     AND tca.is_primary = true) <= 1
  )
);

-- Indexes for performance (idx_ prefix per platform standards)
CREATE INDEX idx_tenant_category_assignments_tenant_id 
  ON tenant_category_assignments(tenant_id);
CREATE INDEX idx_tenant_category_assignments_tenant_id_is_primary 
  ON tenant_category_assignments(tenant_id, is_primary) 
  WHERE is_primary = true;
CREATE INDEX idx_tenant_category_assignments_tenant_id_gbp 
  ON tenant_category_assignments(tenant_id) 
  WHERE is_assigned_to_gbp = true;
CREATE INDEX idx_tenant_category_assignments_tenant_id_directory 
  ON tenant_category_assignments(tenant_id) 
  WHERE is_assigned_to_directory = true;

-- Audit trigger
CREATE TRIGGER audit_category_changes
  AFTER INSERT OR UPDATE OR DELETE ON tenant_category_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
```

#### 2.2 Create Migration Function
```sql
-- File: migrations/002_create_migration_function.sql

CREATE OR REPLACE FUNCTION migrate_tenant_categories(p_tenant_id VARCHAR)
RETURNS TABLE(
  status VARCHAR,
  categories_migrated INTEGER,
  errors TEXT[]
) AS $$
DECLARE
  v_gbp_primary RECORD;
  v_gbp_secondary JSONB;
  v_dir_primary VARCHAR;
  v_dir_secondary TEXT[];
  v_category_map JSONB := '{}';
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_count INTEGER := 0;
BEGIN
  -- Get GBP categories
  SELECT 
    gbp_primary_category_id,
    gbp_primary_category_name,
    gbp_secondary_categories
  INTO v_gbp_primary
  FROM tenant_business_profiles_list
  WHERE tenant_id = p_tenant_id;
  
  -- Get Directory categories
  SELECT 
    primary_category,
    secondary_categories
  INTO v_dir_primary, v_dir_secondary
  FROM directory_listings
  WHERE tenant_id = p_tenant_id;
  
  -- Migrate GBP primary
  IF v_gbp_primary.gbp_primary_category_id IS NOT NULL THEN
    INSERT INTO tenant_category_assignments (
      tenant_id, category_id, category_name, category_source,
      assigned_to_gbp, assigned_to_directory, is_primary, display_order
    ) VALUES (
      p_tenant_id,
      v_gbp_primary.gbp_primary_category_id,
      v_gbp_primary.gbp_primary_category_name,
      'gbp',
      true,
      v_gbp_primary.gbp_primary_category_name = v_dir_primary, -- Both if names match
      true,
      0
    )
    ON CONFLICT (tenant_id, category_id) DO UPDATE
    SET assigned_to_directory = EXCLUDED.assigned_to_directory OR tenant_category_assignments.assigned_to_directory;
    
    v_count := v_count + 1;
  END IF;
  
  -- Migrate GBP secondary categories
  IF v_gbp_primary.gbp_secondary_categories IS NOT NULL THEN
    -- Implementation for secondary categories
    -- ... (similar pattern)
  END IF;
  
  -- Migrate Directory categories
  IF v_dir_primary IS NOT NULL THEN
    -- Implementation for directory categories
    -- ... (similar pattern)
  END IF;
  
  RETURN QUERY SELECT 
    'success'::VARCHAR,
    v_count,
    v_errors;
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    'error'::VARCHAR,
    0::INTEGER,
    ARRAY[SQLERRM]::TEXT[];
END;
$$ LANGUAGE plpgsql;
```

#### 2.3 Create New API Endpoints
```typescript
// File: apps/api/src/routes/unified-categories.ts

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/tenants/:id/categories/unified
router.get('/:tenantId/categories/unified', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Verify user has access to tenant
    const hasAccess = await verifyTenantAccess(req.user.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Fetch unified categories
    const categories = await prisma.tenantCategoryAssignment.findMany({
      where: { tenantId },
      orderBy: [
        { isPrimary: 'desc' },
        { displayOrder: 'asc' }
      ]
    });
    
    // Separate primary and secondary
    const primary = categories.find(c => c.isPrimary);
    const secondary = categories.filter(c => !c.isPrimary);
    
    res.json({
      success: true,
      data: {
        primary: primary ? formatCategory(primary) : null,
        secondary: secondary.map(formatCategory)
      }
    });
  } catch (error) {
    console.error('[UnifiedCategories] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/tenants/:id/categories/unified
router.post('/:tenantId/categories/unified', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { primary, secondary } = req.body;
    
    // Verify user has access
    const hasAccess = await verifyTenantAccess(req.user.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing categories
      await tx.tenantCategoryAssignment.deleteMany({
        where: { tenantId }
      });
      
      // Insert primary
      if (primary) {
        await tx.tenantCategoryAssignment.create({
          data: {
            tenantId,
            categoryId: primary.categoryId,
            categoryName: primary.categoryName,
            categorySource: primary.categorySource || 'gbp',
            assignedToGbp: primary.platforms.gbp,
            assignedToDirectory: primary.platforms.directory,
            isPrimary: true,
            displayOrder: 0
          }
        });
      }
      
      // Insert secondary
      for (let i = 0; i < secondary.length; i++) {
        const cat = secondary[i];
        await tx.tenantCategoryAssignment.create({
          data: {
            tenantId,
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            categorySource: cat.categorySource || 'gbp',
            assignedToGbp: cat.platforms.gbp,
            assignedToDirectory: cat.platforms.directory,
            isPrimary: false,
            displayOrder: i + 1
          }
        });
      }
      
      return { primary, secondary };
    });
    
    // Trigger sync to GBP and Directory
    await syncToLegacySystems(tenantId);
    
    res.json({
      success: true,
      message: 'Categories saved successfully',
      data: result
    });
  } catch (error) {
    console.error('[UnifiedCategories] Save error:', error);
    res.status(500).json({ error: 'Failed to save categories' });
  }
});

export default router;
```

#### 2.4 Create MV Sync Triggers (Critical for MV Alignment)

**Purpose:** Keep existing materialized views working during transition

```sql
-- File: migrations/003_create_mv_sync_triggers.sql
-- Ensures existing MVs continue to work with unified categories

-- Function to sync unified categories back to legacy tables
CREATE OR REPLACE FUNCTION sync_unified_categories_to_legacy()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync to directory_listings_list (for directory MVs)
  UPDATE directory_listings_list
  SET 
    primary_category = (
      SELECT category_name 
      FROM tenant_category_assignments
      WHERE tenant_id = NEW.tenant_id 
        AND is_primary = true 
        AND is_assigned_to_directory = true
      LIMIT 1
    ),
    secondary_categories = (
      SELECT ARRAY_AGG(category_name ORDER BY display_order)
      FROM tenant_category_assignments
      WHERE tenant_id = NEW.tenant_id 
        AND is_primary = false 
        AND is_assigned_to_directory = true
    )
  WHERE tenant_id = NEW.tenant_id;
  
  -- Sync to gbp_listing_categories (for GBP MVs)
  -- Delete existing
  DELETE FROM gbp_listing_categories 
  WHERE listing_id IN (
    SELECT id FROM directory_listings_list WHERE tenant_id = NEW.tenant_id
  );
  
  -- Insert new
  INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
  SELECT 
    dl.id,
    tca.category_id,
    tca.is_primary
  FROM tenant_category_assignments tca
  INNER JOIN directory_listings_list dl ON dl.tenant_id = tca.tenant_id
  WHERE tca.tenant_id = NEW.tenant_id
    AND tca.is_assigned_to_gbp = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT/UPDATE
CREATE TRIGGER trg_sync_unified_categories_after_change
  AFTER INSERT OR UPDATE ON tenant_category_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_unified_categories_to_legacy();

-- Trigger on DELETE
CREATE OR REPLACE FUNCTION sync_unified_categories_to_legacy_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Same sync logic but uses OLD instead of NEW
  -- (implementation similar to above)
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_unified_categories_after_delete
  AFTER DELETE ON tenant_category_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_unified_categories_to_legacy_delete();

COMMENT ON FUNCTION sync_unified_categories_to_legacy() IS
  'Keeps legacy tables updated so existing MVs continue to work during unified categories migration';
```

#### 2.5 Create Sync Functions (API Layer)
```typescript
// File: apps/api/src/services/category-sync.ts

/**
 * Sync unified categories back to legacy GBP and Directory tables
 * This maintains backward compatibility during transition
 * 
 * NOTE: Database triggers handle most syncing automatically.
 * This function is for manual sync operations if needed.
 */
export async function syncToLegacySystems(tenantId: string) {
  const categories = await prisma.tenantCategoryAssignment.findMany({
    where: { tenantId },
    orderBy: [
      { isPrimary: 'desc' },
      { displayOrder: 'asc' }
    ]
  });
  
  // Sync to GBP table
  const gbpCategories = categories.filter(c => c.assignedToGbp);
  const gbpPrimary = gbpCategories.find(c => c.isPrimary);
  const gbpSecondary = gbpCategories.filter(c => !c.isPrimary);
  
  await prisma.tenantBusinessProfilesList.update({
    where: { tenantId },
    data: {
      gbpPrimaryCategoryId: gbpPrimary?.categoryId,
      gbpPrimaryCategoryName: gbpPrimary?.categoryName,
      gbpSecondaryCategories: gbpSecondary.map(c => ({
        id: c.categoryId,
        name: c.categoryName
      }))
    }
  });
  
  // Sync to Directory table
  const dirCategories = categories.filter(c => c.assignedToDirectory);
  const dirPrimary = dirCategories.find(c => c.isPrimary);
  const dirSecondary = dirCategories.filter(c => !c.isPrimary);
  
  await prisma.directoryListing.update({
    where: { tenantId },
    data: {
      primaryCategory: dirPrimary?.categoryName,
      secondaryCategories: dirSecondary.map(c => c.categoryName)
    }
  });
}
```

---

### 🧪 **Phase 3: Testing & Validation** (Week 5)
**Goal:** Prove new system works before touching production

#### 3.1 Comprehensive Test Suite
```typescript
// File: tests/integration/unified-categories.test.ts

describe('Unified Categories - Full Integration', () => {
  describe('Migration', () => {
    it('should migrate GBP categories correctly', async () => {
      const tenantId = await createTestTenant({
        gbpPrimary: { id: 'gcid:grocery', name: 'Grocery Store' },
        gbpSecondary: [
          { id: 'gcid:convenience', name: 'Convenience Store' }
        ]
      });
      
      await migrateTenantCategories(tenantId);
      
      const unified = await fetchUnifiedCategories(tenantId);
      expect(unified.primary.categoryName).toBe('Grocery Store');
      expect(unified.primary.platforms.gbp).toBe(true);
      expect(unified.secondary).toHaveLength(1);
    });
    
    it('should merge matching categories', async () => {
      const tenantId = await createTestTenant({
        gbpPrimary: { id: 'gcid:grocery', name: 'Grocery Store' },
        directoryPrimary: 'Grocery Store' // Same name
      });
      
      await migrateTenantCategories(tenantId);
      
      const unified = await fetchUnifiedCategories(tenantId);
      expect(unified.primary.platforms.gbp).toBe(true);
      expect(unified.primary.platforms.directory).toBe(true);
    });
    
    it('should preserve all categories during migration', async () => {
      const tenantId = await createTestTenant({
        gbpPrimary: { id: 'gcid:grocery', name: 'Grocery Store' },
        gbpSecondary: [
          { id: 'gcid:convenience', name: 'Convenience Store' },
          { id: 'gcid:organic', name: 'Organic Food Store' }
        ],
        directoryPrimary: 'Grocery Store',
        directorySecondary: ['Health Food Store']
      });
      
      await migrateTenantCategories(tenantId);
      
      const unified = await fetchUnifiedCategories(tenantId);
      const totalCategories = 1 + unified.secondary.length;
      expect(totalCategories).toBe(4); // 1 primary + 3 secondary
    });
  });
  
  describe('Sync to Legacy Systems', () => {
    it('should sync GBP categories back to legacy table', async () => {
      const tenantId = await createTestTenant();
      
      await saveUnifiedCategories(tenantId, {
        primary: {
          categoryId: 'gcid:grocery',
          categoryName: 'Grocery Store',
          platforms: { gbp: true, directory: false }
        },
        secondary: []
      });
      
      const gbpData = await fetchLegacyGBPCategories(tenantId);
      expect(gbpData.gbpPrimaryCategoryName).toBe('Grocery Store');
    });
    
    it('should sync Directory categories back to legacy table', async () => {
      const tenantId = await createTestTenant();
      
      await saveUnifiedCategories(tenantId, {
        primary: {
          categoryId: 'grocery-store',
          categoryName: 'Grocery Store',
          platforms: { gbp: false, directory: true }
        },
        secondary: []
      });
      
      const dirData = await fetchLegacyDirectoryCategories(tenantId);
      expect(dirData.primaryCategory).toBe('Grocery Store');
    });
  });
  
  describe('API Endpoints', () => {
    it('should fetch unified categories', async () => {
      const tenantId = await createTestTenant();
      const response = await api.get(`/api/tenants/${tenantId}/categories/unified`);
      expect(response.ok).toBe(true);
    });
    
    it('should save unified categories', async () => {
      const tenantId = await createTestTenant();
      const response = await api.post(`/api/tenants/${tenantId}/categories/unified`, {
        primary: {
          categoryId: 'gcid:grocery',
          categoryName: 'Grocery Store',
          platforms: { gbp: true, directory: true }
        },
        secondary: []
      });
      expect(response.ok).toBe(true);
    });
  });
  
  describe('Backward Compatibility', () => {
    it('should still work with old GBP endpoint', async () => {
      const tenantId = await createTestTenant();
      
      // Save via unified endpoint
      await saveUnifiedCategories(tenantId, {
        primary: {
          categoryId: 'gcid:grocery',
          categoryName: 'Grocery Store',
          platforms: { gbp: true, directory: false }
        },
        secondary: []
      });
      
      // Fetch via old endpoint
      const response = await api.get(`/api/tenant/gbp-category?tenantId=${tenantId}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.primary.name).toBe('Grocery Store');
    });
  });
});
```

#### 3.2 Database Integrity Tests
```sql
-- File: tests/sql/test-data-integrity.sql

-- Test 1: Verify no data loss
WITH before_migration AS (
  SELECT 
    COUNT(*) as gbp_count
  FROM tenant_business_profiles_list
  WHERE gbp_primary_category_id IS NOT NULL
),
after_migration AS (
  SELECT 
    COUNT(*) as unified_count
  FROM tenant_category_assignments
  WHERE assigned_to_gbp = true AND is_primary = true
)
SELECT 
  b.gbp_count,
  a.unified_count,
  CASE 
    WHEN b.gbp_count = a.unified_count THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM before_migration b, after_migration a;

-- Test 2: Verify primary category constraint
SELECT 
  tenant_id,
  COUNT(*) as primary_count,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM tenant_category_assignments
WHERE is_primary = true
GROUP BY tenant_id
HAVING COUNT(*) != 1;

-- Test 3: Verify platform assignment constraint
SELECT 
  id,
  tenant_id,
  assigned_to_gbp,
  assigned_to_directory,
  CASE 
    WHEN assigned_to_gbp = false AND assigned_to_directory = false THEN 'FAIL'
    ELSE 'PASS'
  END as test_result
FROM tenant_category_assignments
WHERE assigned_to_gbp = false AND assigned_to_directory = false;
```

#### 3.3 Performance Tests
```typescript
// File: tests/performance/category-performance.test.ts

describe('Category Performance', () => {
  it('should fetch categories in < 100ms', async () => {
    const tenantId = await createTestTenant();
    
    const start = Date.now();
    await fetchUnifiedCategories(tenantId);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should save categories in < 500ms', async () => {
    const tenantId = await createTestTenant();
    
    const start = Date.now();
    await saveUnifiedCategories(tenantId, {
      primary: { /* ... */ },
      secondary: [/* ... */]
    });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
  
  it('should handle bulk migration efficiently', async () => {
    const tenantIds = await createMultipleTestTenants(100);
    
    const start = Date.now();
    await Promise.all(tenantIds.map(id => migrateTenantCategories(id)));
    const duration = Date.now() - start;
    
    const avgPerTenant = duration / tenantIds.length;
    expect(avgPerTenant).toBeLessThan(1000); // < 1s per tenant
  });
});
```

---

### 🚀 **Phase 4: Gradual Rollout** (Week 6-7)
**Goal:** Deploy to production with minimal risk

#### 4.1 Rollout Strategy

**Stage 1: Shadow Mode (Week 6, Days 1-3)**
- Deploy unified system to production
- Run migration for all tenants (write to new table only)
- Keep old system as primary
- Log any discrepancies

**Stage 2: Parallel Mode (Week 6, Days 4-7)**
- New unified page available at `/settings/categories`
- Old pages still work
- Both systems write to both tables
- Monitor for issues

**Stage 3: Migration Banners (Week 7, Days 1-3)**
- Add banners to old pages encouraging migration
- Track adoption rate
- Provide migration assistance

**Stage 4: Unified Primary (Week 7, Days 4-7)**
- Make unified system primary
- Old endpoints read from unified table
- Monitor error rates

#### 4.2 Monitoring & Alerts
```typescript
// File: apps/api/src/monitoring/category-monitoring.ts

export const categoryMetrics = {
  // Track API endpoint usage
  trackEndpointUsage: (endpoint: string, method: string) => {
    metrics.increment('category.api.calls', {
      endpoint,
      method
    });
  },
  
  // Track migration success/failure
  trackMigration: (tenantId: string, status: 'success' | 'error', error?: string) => {
    metrics.increment('category.migration', {
      status
    });
    
    if (status === 'error') {
      logger.error('[CategoryMigration] Failed', {
        tenantId,
        error
      });
      
      // Alert on repeated failures
      if (getFailureCount(tenantId) > 3) {
        alertOps('Category migration failing repeatedly', { tenantId });
      }
    }
  },
  
  // Track sync discrepancies
  trackSyncDiscrepancy: (tenantId: string, type: 'gbp' | 'directory') => {
    metrics.increment('category.sync.discrepancy', {
      type
    });
    
    logger.warn('[CategorySync] Discrepancy detected', {
      tenantId,
      type
    });
  }
};
```

#### 4.3 Rollback Plan
```sql
-- File: scripts/rollback-unified-categories.sql

-- Step 1: Verify backup tables exist
SELECT COUNT(*) FROM backup_tenant_business_profiles_list;
SELECT COUNT(*) FROM backup_directory_listings;

-- Step 2: Restore from backup
BEGIN;

-- Restore GBP categories
UPDATE tenant_business_profiles_list t
SET 
  gbp_primary_category_id = b.gbp_primary_category_id,
  gbp_primary_category_name = b.gbp_primary_category_name,
  gbp_secondary_categories = b.gbp_secondary_categories
FROM backup_tenant_business_profiles_list b
WHERE t.tenant_id = b.tenant_id;

-- Restore Directory categories
UPDATE directory_listings d
SET 
  primary_category = b.primary_category,
  secondary_categories = b.secondary_categories
FROM backup_directory_listings b
WHERE d.tenant_id = b.tenant_id;

-- Verify restoration
SELECT 
  'GBP' as table_name,
  COUNT(*) as restored_count
FROM tenant_business_profiles_list
WHERE gbp_primary_category_id IS NOT NULL

UNION ALL

SELECT 
  'Directory' as table_name,
  COUNT(*) as restored_count
FROM directory_listings
WHERE primary_category IS NOT NULL;

COMMIT;
```

---

### 🧹 **Phase 5: Cleanup & Deprecation** (Week 8)
**Goal:** Remove old system after successful migration

#### 5.1 Deprecation Checklist
```markdown
## Deprecation Checklist

### Week 8, Day 1-2: Verify Migration Complete
- [ ] All tenants migrated to unified system
- [ ] No errors in last 7 days
- [ ] Adoption rate > 90%
- [ ] Support tickets < 5 per day

### Week 8, Day 3-4: Deprecate Old Endpoints
- [ ] Add deprecation warnings to old endpoints
- [ ] Update API documentation
- [ ] Notify API consumers (if any)

### Week 8, Day 5-6: Remove Old UI
- [ ] Remove `/settings/gbp-category` page
- [ ] Remove `/settings/directory` category section
- [ ] Update navigation
- [ ] Remove old components

### Week 8, Day 7: Database Cleanup
- [ ] Drop backup tables (after 30 days)
- [ ] Remove old columns (after 60 days)
- [ ] Update materialized views
- [ ] Remove old triggers
```

---

## Test Script Summary

### Quick Validation Script
```bash
#!/bin/bash
# File: scripts/validate-category-system.sh

echo "🧪 Running Category System Validation..."

# 1. Database Tests
echo "📊 Testing database integrity..."
psql $DATABASE_URL -f tests/sql/test-data-integrity.sql

# 2. API Tests
echo "🔌 Testing API endpoints..."
npm run test:integration -- category-api.test.ts

# 3. Migration Tests
echo "🔄 Testing migration function..."
npm run test:integration -- unified-categories.test.ts

# 4. Performance Tests
echo "⚡ Testing performance..."
npm run test:performance -- category-performance.test.ts

# 5. Frontend Tests
echo "🎨 Testing UI components..."
npm run test:e2e -- category-management.spec.ts

echo "✅ Validation complete!"
```

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during migration | Low | Critical | Full backup + rollback plan |
| API downtime | Medium | High | Parallel systems during transition |
| Materialized view breaks | Medium | Medium | Test views before production |
| Performance degradation | Low | Medium | Performance tests + monitoring |
| User confusion | High | Low | Clear migration banners + docs |
| Sync failures | Medium | High | Retry logic + monitoring + alerts |

---

## Success Criteria

### Phase 1-2 (Build)
- ✅ All tests passing
- ✅ Zero data loss in test migrations
- ✅ Performance within acceptable limits

### Phase 3 (Testing)
- ✅ 100% test coverage on critical paths
- ✅ No regressions in existing functionality
- ✅ Successful migration of 10 test tenants

### Phase 4 (Rollout)
- ✅ < 0.1% error rate
- ✅ < 100ms API response time
- ✅ 90% user adoption within 2 weeks

### Phase 5 (Cleanup)
- ✅ Old system fully deprecated
- ✅ Database cleaned up
- ✅ Documentation updated

---

## Conclusion

This phased approach ensures:
1. **Safety:** Parallel systems during transition
2. **Confidence:** Comprehensive testing at each phase
3. **Reversibility:** Full rollback capability
4. **Visibility:** Monitoring and alerts throughout
5. **Gradual adoption:** Users migrate at their own pace

**Estimated Timeline:** 6-8 weeks from start to complete deprecation
**Risk Level:** Mitigated from HIGH to MEDIUM through careful planning
**Confidence Level:** HIGH with comprehensive test coverage
