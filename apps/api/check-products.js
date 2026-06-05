const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
  try {
    const tenantId = 'tid-m8ijkrnk';
    console.log('Checking products for tenant:', tenantId);
    
    // Check inventory items
    const items = await prisma.inventory_items.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, item_status: true, visibility: true }
    });
    
    console.log('Inventory items:', items.length);
    items.forEach(item => console.log('  -', item.name, '(', item.item_status, ')'));
    
    // Check featured products
    const featured = await prisma.featured_products.findMany({
      where: { tenant_id: tenantId },
      select: { inventory_item_id: true, featured_type: true, is_active: true }
    });
    
    console.log('Featured products:', featured.length);
    featured.forEach(f => console.log('  -', f.inventory_item_id, f.featured_type, f.is_active));
    
    // Check materialized view using Prisma raw query
    const mvResult = await prisma.$queryRaw\`
      SELECT COUNT(*) as count 
      FROM mv_global_discovery 
      WHERE tenant_id = \${tenantId}
        AND featured_is_active = true
        AND item_status = 'active'
        AND visibility = 'public'
    \`;
    
    console.log('Materialized view count (featured, active, public):', mvResult[0]?.count || 0);
    
    // Check all items in materialized view for this tenant
    const allMvResult = await prisma.$queryRaw\`
      SELECT COUNT(*) as count 
      FROM mv_global_discovery 
      WHERE tenant_id = \${tenantId}
    \`;
    
    console.log('Materialized view count (all items):', allMvResult[0]?.count || 0);
    
    // Check specific featured items
    const featuredMvResult = await prisma.$queryRaw\`
      SELECT inventory_item_id, featured_type, featured_is_active, item_status, visibility
      FROM mv_global_discovery 
      WHERE tenant_id = \${tenantId}
        AND featured_is_active = true
      LIMIT 5
    \`;
    
    console.log('Sample featured items in MV:');
    featuredMvResult.forEach(item => {
      console.log('  -', item.inventory_item_id, item.featured_type, item.featured_is_active, item.item_status, item.visibility);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();
