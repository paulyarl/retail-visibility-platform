import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const tenantId = 'tid-m8ijkrnk';
  
  console.log('=== Checking featured products for tenant:', tenantId, '===\n');
  
  // 1. Check if tenant exists and its status
  const tenant = await prisma.$queryRaw`
    SELECT id, name, subscription_tier, location_status, directory_visible
    FROM tenants 
    WHERE id = ${tenantId}
  `;
  console.log('Tenant info:', JSON.stringify(tenant, null, 2));
  
  // 2. Check directory listing status
  const directoryListing = await prisma.$queryRaw`
    SELECT tenant_id, is_published, city, state
    FROM directory_listings_list
    WHERE tenant_id = ${tenantId}
  `;
  console.log('\nDirectory listing:', JSON.stringify(directoryListing, null, 2));
  
  // 3. Check inventory items for this tenant
  const inventoryItems = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM inventory_items
    WHERE tenant_id = ${tenantId}
      AND item_status = 'active'
      AND visibility = 'public'
  `;
  console.log('\nActive public inventory items:', JSON.stringify(inventoryItems, null, 2));
  
  // 4. Check featured products for this tenant
  const featuredProducts = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM featured_products
    WHERE tenant_id = ${tenantId}
      AND is_active = true
      AND (featured_expires_at IS NULL OR featured_expires_at > now())
      AND (featured_at IS NULL OR featured_at <= now())
  `;
  console.log('\nActive featured products:', JSON.stringify(featuredProducts, null, 2));
  
  // 5. Check mv_global_discovery for this tenant
  const mvProducts = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM mv_global_discovery
    WHERE tenant_id = ${tenantId}
      AND featured_is_active = true
      AND item_status = 'active'
      AND visibility = 'public'
  `;
  console.log('\nProducts in mv_global_discovery:', JSON.stringify(mvProducts, null, 2));
  
  // 6. Check tier capability settings
  const tierFeatures = await prisma.$queryRaw`
    SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
    FROM subscription_tiers_list stl
    JOIN tier_features_list tfl ON tfl.tier_id = stl.id
    WHERE stl.tier_key = (SELECT subscription_tier FROM tenants WHERE id = ${tenantId})
      AND tfl.feature_key LIKE 'featured_%'
    ORDER BY tfl.feature_key
  `;
  console.log('\nTier features:', JSON.stringify(tierFeatures, null, 2));
  
  // 7. Check tenant featured options settings
  const tenantSettings = await prisma.$queryRaw`
    SELECT * FROM tenant_featured_options_settings
    WHERE tenant_id = ${tenantId}
  `;
  console.log('\nTenant featured options settings:', JSON.stringify(tenantSettings, null, 2));
  
  // 8. Sample products from mv_global_discovery
  const sampleProducts = await prisma.$queryRaw`
    SELECT 
      inventory_item_id,
      product_name,
      featured_type,
      featured_type_array,
      featured_is_active,
      item_status,
      visibility,
      subscription_tier
    FROM mv_global_discovery
    WHERE tenant_id = ${tenantId}
    LIMIT 5
  `;
  console.log('\nSample products from MV:', JSON.stringify(sampleProducts, null, 2));
  
  // 9. Check if MV needs refresh
  const mvRefreshTime = await prisma.$queryRaw`
    SELECT MAX(mv_refreshed_at) as last_refresh
    FROM mv_global_discovery
  `;
  console.log('\nMV last refreshed at:', JSON.stringify(mvRefreshTime, null, 2));
  
  await prisma.$disconnect();
}
check();
