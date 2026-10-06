const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  const r = await q(`select occurred_at, message, left(stack_trace, 1500) as stack
    from public.application_error_log where message like '[AWS SES]%'
    order by occurred_at desc limit 1`);
  console.log(JSON.stringify(r, null, 2));
})().finally(() => prisma.$disconnect());
