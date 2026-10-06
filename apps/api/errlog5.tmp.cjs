const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  console.log('== merchant_stripe_connections ==');
  console.log(await q(`select onboarding_status, stripe_payouts_enabled, count(*) as n
    from merchant_stripe_connections group by 1,2 order by n desc`));
  console.log('== distinct tenants eligible for fee summary ==');
  console.log(await q(`select count(distinct tenant_id) as tenants from merchant_stripe_connections
    where onboarding_status='completed' and stripe_payouts_enabled=true`));
})().finally(() => prisma.$disconnect());
