const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.$executeRawUnsafe(`VACUUM (FULL, ANALYZE) public.application_error_log`);
  const r = await prisma.$queryRawUnsafe(`select pg_size_pretty(pg_total_relation_size('public.application_error_log')) as t,
    pg_size_pretty(pg_database_size(current_database())) as db`);
  console.log(r);
})().finally(() => prisma.$disconnect());
