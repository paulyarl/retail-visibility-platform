const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  const r = await q(`select occurred_at, left(stack_trace, 2000) as stack, context
    from public.application_error_log where message like '[Mailtrap]%'
    order by occurred_at desc limit 1`);
  console.log(JSON.stringify(r, null, 2));
})().finally(() => prisma.$disconnect());
