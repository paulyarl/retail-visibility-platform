const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tenantId = process.argv[2];

if (!tenantId) {
  console.error('Usage: node clear-products.js <tenant_id>');
  process.exit(1);
}

async function clearProducts() {
  console.log(`🗑️  Clearing products for tenant: ${tenantId}`);
  
  const result = await prisma.inventoryItem.deleteMany({
    where: { tenantId }
  });
  
  console.log(`✅ Deleted ${result.count} products`);
  
  await prisma.$disconnect();
}

clearProducts();
