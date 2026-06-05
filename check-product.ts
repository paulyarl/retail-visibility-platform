import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check if tenant belongs to organization
  const tenantOrg = await prisma.$queryRaw`
    SELECT id, name, organization_id 
    FROM tenants 
    WHERE id = 'tid-042hi7ju'
  `;
  console.log('Tenant Organization:', JSON.stringify(tenantOrg, null, 2));

  // Check all tenants in this organization
  const orgTenants = await prisma.$queryRaw`
    SELECT id, name, organization_id 
    FROM tenants 
    WHERE organization_id = 'org-KQJ4OXF3'
  `;
  console.log('Org Tenants:', JSON.stringify(orgTenants, null, 2));

  // Check MV for this specific product_slug
  const mv = await prisma.$queryRaw`
    SELECT product_slug, product_name, tenant_id, tenant_name, in_stock, stock, item_status, visibility
    FROM mv_global_discovery 
    WHERE product_slug = 'lpc_R4KG-PHYS-SHIP-PUBL-QZKB_frozen-foods_pid-R4KG-qz3cfdvr_10bdd80a'
  `;
  console.log('MV Exact Match:', JSON.stringify(mv, null, 2));

  // Check if MV needs refresh
  const mvRefresh = await prisma.$queryRaw`
    SELECT schemaname, matviewname, last_refresh 
    FROM pg_matviews 
    WHERE matviewname = 'mv_global_discovery'
  `;
  console.log('MV Refresh Status:', JSON.stringify(mvRefresh, null, 2));

  await prisma.$disconnect();
}
check();
