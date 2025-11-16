-- ============================================================================
-- POPULATE TEST DATA: Category Directory
-- ============================================================================
-- This script populates test data so you can see the category directory working
-- Run this in Supabase SQL Editor after the main migration
-- ============================================================================

-- Step 1: Enable Google sync for existing tenants
-- ============================================================================
-- This enables the first 5 tenants for testing
-- Adjust the LIMIT or add WHERE clause to target specific tenants

UPDATE "Tenant" t
SET 
  google_sync_enabled = true,
  google_last_sync = NOW(),
  directory_visible = true,
  slug = LOWER(REPLACE(t.name, ' ', '-')) || '-' || SUBSTRING(t.id, 1, 8)
WHERE t.id IN (
  SELECT id FROM "Tenant" 
  WHERE location_status = 'active'
  LIMIT 5
);

-- Verify the update
SELECT 
  id,
  name,
  slug,
  google_sync_enabled,
  google_last_sync,
  directory_visible
FROM "Tenant"
WHERE google_sync_enabled = true;

-- Step 2: Ensure tenants have business profiles
-- ============================================================================
-- Check which tenants are missing business profiles

SELECT 
  t.id,
  t.name,
  CASE WHEN bp.tenant_id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as profile_status
FROM "Tenant" t
LEFT JOIN tenant_business_profile bp ON bp.tenant_id = t.id
WHERE t.google_sync_enabled = true;

-- If any are missing, you'll need to create business profiles for them
-- Example (adjust values as needed):
/*
INSERT INTO tenant_business_profile (
  tenant_id, 
  business_name, 
  address_line1, 
  city, 
  state, 
  postal_code, 
  country_code,
  latitude,
  longitude,
  updated_at
)
SELECT 
  id,
  name,
  '123 Main St',
  'New York',
  'NY',
  '10001',
  'US',
  40.7128,
  -74.0060,
  NOW()
FROM "Tenant"
WHERE google_sync_enabled = true
  AND id NOT IN (SELECT tenant_id FROM tenant_business_profile);
*/

-- Step 3: Ensure products have categories assigned
-- ============================================================================
-- Check how many products have categories

SELECT 
  t.name as tenant_name,
  COUNT(ii.id) as total_products,
  COUNT(ii.tenant_category_id) as products_with_category,
  COUNT(CASE WHEN ii."itemStatus" = 'active' AND ii.visibility = 'public' THEN 1 END) as active_public_products
FROM "Tenant" t
INNER JOIN "InventoryItem" ii ON ii."tenantId" = t.id
WHERE t.google_sync_enabled = true
GROUP BY t.id, t.name;

-- Get available categories
SELECT id, name, slug, is_active
FROM tenant_category
WHERE is_active = true
LIMIT 10;

-- Assign random categories to products that don't have one
-- (Only for testing - in production, categories should be assigned properly)
/*
WITH random_category AS (
  SELECT id FROM tenant_category WHERE is_active = true ORDER BY RANDOM() LIMIT 1
)
UPDATE "InventoryItem" ii
SET tenant_category_id = (SELECT id FROM random_category)
WHERE ii.tenant_category_id IS NULL
  AND ii."itemStatus" = 'active'
  AND ii.visibility = 'public'
  AND ii."tenantId" IN (
    SELECT id FROM "Tenant" WHERE google_sync_enabled = true
  );
*/

-- Step 4: Refresh the materialized view
-- ============================================================================

SELECT refresh_directory_category_stores();

-- Step 5: Verify the results
-- ============================================================================

-- Check what's in the materialized view
SELECT 
  category_name,
  COUNT(DISTINCT tenant_id) as store_count,
  SUM(product_count) as total_products
FROM directory_category_stores
GROUP BY category_name
ORDER BY store_count DESC;

-- See detailed view
SELECT 
  store_name,
  category_name,
  product_count,
  city,
  state,
  google_sync_enabled,
  directory_visible
FROM directory_category_stores
ORDER BY category_name, store_name
LIMIT 20;

-- ============================================================================
-- QUICK TEST QUERIES
-- ============================================================================

-- 1. How many stores are eligible for the directory?
SELECT COUNT(*) as eligible_stores
FROM "Tenant"
WHERE google_sync_enabled = true
  AND google_last_sync > NOW() - INTERVAL '24 hours'
  AND directory_visible = true
  AND location_status = 'active';

-- 2. How many products are eligible?
SELECT COUNT(*) as eligible_products
FROM "InventoryItem" ii
INNER JOIN "Tenant" t ON t.id = ii."tenantId"
WHERE t.google_sync_enabled = true
  AND t.google_last_sync > NOW() - INTERVAL '24 hours'
  AND ii."itemStatus" = 'active'
  AND ii.visibility = 'public'
  AND ii.tenant_category_id IS NOT NULL;

-- 3. Which categories have the most stores?
SELECT 
  tc.name as category_name,
  COUNT(DISTINCT ii."tenantId") as store_count,
  COUNT(ii.id) as product_count
FROM tenant_category tc
INNER JOIN "InventoryItem" ii ON ii.tenant_category_id = tc.id
INNER JOIN "Tenant" t ON t.id = ii."tenantId"
WHERE tc.is_active = true
  AND t.google_sync_enabled = true
  AND t.google_last_sync > NOW() - INTERVAL '24 hours'
  AND ii."itemStatus" = 'active'
  AND ii.visibility = 'public'
GROUP BY tc.id, tc.name
ORDER BY store_count DESC, product_count DESC
LIMIT 10;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If materialized view is empty, check each requirement:

-- 1. Do we have tenants with google_sync_enabled?
SELECT COUNT(*) FROM "Tenant" WHERE google_sync_enabled = true;

-- 2. Do they have recent sync timestamps?
SELECT COUNT(*) FROM "Tenant" 
WHERE google_sync_enabled = true 
  AND google_last_sync > NOW() - INTERVAL '24 hours';

-- 3. Do they have business profiles?
SELECT COUNT(*) 
FROM "Tenant" t
INNER JOIN tenant_business_profile bp ON bp.tenant_id = t.id
WHERE t.google_sync_enabled = true;

-- 4. Do they have active, public products?
SELECT COUNT(*) 
FROM "Tenant" t
INNER JOIN "InventoryItem" ii ON ii."tenantId" = t.id
WHERE t.google_sync_enabled = true
  AND ii."itemStatus" = 'active'
  AND ii.visibility = 'public';

-- 5. Do products have categories assigned?
SELECT COUNT(*) 
FROM "Tenant" t
INNER JOIN "InventoryItem" ii ON ii."tenantId" = t.id
WHERE t.google_sync_enabled = true
  AND ii."itemStatus" = 'active'
  AND ii.visibility = 'public'
  AND ii.tenant_category_id IS NOT NULL;

-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================

-- To reset test data:
/*
UPDATE "Tenant" 
SET 
  google_sync_enabled = false,
  google_last_sync = NULL,
  slug = NULL
WHERE google_sync_enabled = true;

SELECT refresh_directory_category_stores();
*/
