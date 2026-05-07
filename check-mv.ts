import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check MV for the specific product
  const mv = await prisma.$queryRaw`
    SELECT 
      product_slug,
      product_name,
      tenant_id,
      tenant_name,
      tenant_city,
      tenant_state,
      tenant_latitude,
      tenant_longitude
    FROM mv_global_discovery 
    WHERE product_slug = 'lpc_R4KG-PHYS-SHIP-PUBL-QZKB_frozen-foods_pid-R4KG-qz3cfdvr_10bdd80a'
  `;
  console.log('MV Product Location Data:', JSON.stringify(mv, null, 2));

  await prisma.$disconnect();
}
check();
