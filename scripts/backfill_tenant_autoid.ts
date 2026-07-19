import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const tenants = await prisma.tenant.findMany({ select: { id: true, metadata: true } });
  for (const tenant of tenants) {
    const meta = (tenant.metadata as any) || {};
    if (!meta.autoId) {
      const autoId = `FRSH-${tenant.id.slice(-6)}`;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { metadata: { ...meta, autoId } },
      });
      console.log(`Backfilled autoId for tenant ${tenant.id}: ${autoId}`);
    }
  }
  await prisma.$disconnect();
}

main();
