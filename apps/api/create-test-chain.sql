-- Create Test Chain Organization
-- This script creates a demo chain with 3 locations for testing

-- 1. Create the organization
INSERT INTO "organization" (
  "id",
  "name",
  "ownerId",
  "subscriptionTier",
  "subscriptionStatus",
  "maxLocations",
  "maxTotalSKUs",
  "trialEndsAt",
  "createdAt",
  "updatedAt"
) VALUES (
  'org_test_chain_001',
  'Demo Retail Chain',
  'demo-user',
  'chain_professional',
  'active',
  5,
  2500,
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  "name" = EXCLUDED."name",
  "maxLocations" = EXCLUDED."maxLocations",
  "maxTotalSKUs" = EXCLUDED."maxTotalSKUs",
  "updatedAt" = NOW();

-- 2. Create Location 1 - Main Store
INSERT INTO "Tenant" (
  "id",
  "name",
  "subscriptionTier",
  "subscriptionStatus",
  "organizationId",
  "metadata",
  "createdAt",
  "updatedAt"
) VALUES (
  'chain_location_main',
  'Demo Chain - Main Store',
  'professional',
  'active',
  'org_test_chain_001',
  '{"city": "New York", "state": "NY", "address_line1": "123 Main St", "postal_code": "10001"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  "organizationId" = EXCLUDED."organizationId",
  "updatedAt" = NOW();

-- 3. Create Location 2 - Downtown Branch
INSERT INTO "Tenant" (
  "id",
  "name",
  "subscriptionTier",
  "subscriptionStatus",
  "organizationId",
  "metadata",
  "createdAt",
  "updatedAt"
) VALUES (
  'chain_location_downtown',
  'Demo Chain - Downtown Branch',
  'professional',
  'active',
  'org_test_chain_001',
  '{"city": "New York", "state": "NY", "address_line1": "456 Broadway", "postal_code": "10012"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  "organizationId" = EXCLUDED."organizationId",
  "updatedAt" = NOW();

-- 4. Create Location 3 - Uptown Store
INSERT INTO "Tenant" (
  "id",
  "name",
  "subscriptionTier",
  "subscriptionStatus",
  "organizationId",
  "metadata",
  "createdAt",
  "updatedAt"
) VALUES (
  'chain_location_uptown',
  'Demo Chain - Uptown Store',
  'professional',
  'active',
  'org_test_chain_001',
  '{"city": "New York", "state": "NY", "address_line1": "789 Park Ave", "postal_code": "10021"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  "organizationId" = EXCLUDED."organizationId",
  "updatedAt" = NOW();

-- 5. Add sample items to Location 1 (Main Store) - 850 SKUs
INSERT INTO "InventoryItem" ("id", "tenantId", "sku", "name", "title", "brand", "price", "currency", "availability", "itemStatus", "visibility", "createdAt", "updatedAt")
SELECT 
  'item_main_' || generate_series,
  'chain_location_main',
  'MAIN-SKU-' || LPAD(generate_series::text, 4, '0'),
  'Product ' || generate_series,
  'Main Store Product ' || generate_series,
  'Demo Brand',
  (random() * 100 + 10)::numeric(12,2),
  'USD',
  'in_stock',
  'active',
  'public',
  NOW(),
  NOW()
FROM generate_series(1, 850)
ON CONFLICT (id) DO NOTHING;

-- 6. Add sample items to Location 2 (Downtown) - 600 SKUs
INSERT INTO "InventoryItem" ("id", "tenantId", "sku", "name", "title", "brand", "price", "currency", "availability", "itemStatus", "visibility", "createdAt", "updatedAt")
SELECT 
  'item_downtown_' || generate_series,
  'chain_location_downtown',
  'DOWN-SKU-' || LPAD(generate_series::text, 4, '0'),
  'Product ' || generate_series,
  'Downtown Product ' || generate_series,
  'Demo Brand',
  (random() * 100 + 10)::numeric(12,2),
  'USD',
  'in_stock',
  'active',
  'public',
  NOW(),
  NOW()
FROM generate_series(1, 600)
ON CONFLICT (id) DO NOTHING;

-- 7. Add sample items to Location 3 (Uptown) - 400 SKUs
INSERT INTO "InventoryItem" ("id", "tenantId", "sku", "name", "title", "brand", "price", "currency", "availability", "itemStatus", "visibility", "createdAt", "updatedAt")
SELECT 
  'item_uptown_' || generate_series,
  'chain_location_uptown',
  'UPTN-SKU-' || LPAD(generate_series::text, 4, '0'),
  'Product ' || generate_series,
  'Uptown Product ' || generate_series,
  'Demo Brand',
  (random() * 100 + 10)::numeric(12,2),
  'USD',
  'in_stock',
  'active',
  'public',
  NOW(),
  NOW()
FROM generate_series(1, 400)
ON CONFLICT (id) DO NOTHING;

-- Summary
SELECT 
  'Organization Created' as status,
  o.id as organization_id,
  o.name as organization_name,
  o."maxTotalSKUs" as max_skus,
  COUNT(DISTINCT t.id) as total_locations,
  COUNT(i.id) as total_skus
FROM "organization" o
LEFT JOIN "Tenant" t ON t."organizationId" = o.id
LEFT JOIN "InventoryItem" i ON i."tenantId" = t.id
WHERE o.id = 'org_test_chain_001'
GROUP BY o.id, o.name, o."maxTotalSKUs";

-- Show location breakdown
SELECT 
  t.id as tenant_id,
  t.name as location_name,
  COUNT(i.id) as sku_count,
  ROUND((COUNT(i.id)::numeric / 2500 * 100), 1) as percentage_of_pool
FROM "Tenant" t
LEFT JOIN "InventoryItem" i ON i."tenantId" = t.id
WHERE t."organizationId" = 'org_test_chain_001'
GROUP BY t.id, t.name
ORDER BY sku_count DESC;

-- Access URL
SELECT 
  'Access the dashboard at:' as info,
  '/settings/organization?organizationId=org_test_chain_001' as url;
