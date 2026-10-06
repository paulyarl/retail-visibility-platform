const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  console.log('== age distribution ==');
  console.log(await q(`select min(occurred_at) as oldest, max(occurred_at) as newest, count(*) as rows,
    count(*) filter (where occurred_at < now() - interval '30 days') as older_30d,
    count(*) filter (where occurred_at < now() - interval '7 days') as older_7d,
    count(*) filter (where occurred_at < now() - interval '1 day') as older_1d
    from public.application_error_log`));
  console.log('== per-day last 14d ==');
  console.log(await q(`select occurred_at::date as d, count(*) as n from public.application_error_log
    where occurred_at > now() - interval '14 days' group by 1 order by 1`));
  console.log('== top errors ==');
  console.log(await q(`select level, service, error_name, left(message,100) as msg, count(*) as n
    from public.application_error_log group by 1,2,3,4 order by n desc limit 15`));
  console.log('== audit_log age ==');
  console.log(await q(`select min(created_at) as oldest, max(created_at) as newest, count(*) as rows,
    count(*) filter (where created_at < now() - interval '30 days') as older_30d from public.audit_log`));
  console.log('== cron job_run_details ==');
  console.log(await q(`select min(start_time) as oldest, max(start_time) as newest, count(*) as rows,
    count(*) filter (where start_time < now() - interval '7 days') as older_7d from cron.job_run_details`));
})().finally(() => prisma.$disconnect());
