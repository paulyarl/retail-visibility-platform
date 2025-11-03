const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getTenantIds() {
  const tenants = await prisma.tenant.findMany({
    where: { organizationId: 'org_test_chain_001' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log('\n📋 Tenant IDs for Quick Start testing:\n');
  tenants.forEach(t => {
    console.log(`${t.name}:`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Quick Start: https://retail-visibility-platform-web-git-staging-paul-yarls-projects.vercel.app/t/${t.id}/quick-start\n`);
  });

  await prisma.$disconnect();
}

getTenantIds();
