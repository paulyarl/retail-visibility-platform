const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  console.log('== email spam timing (is it cron-regular?) ==');
  console.log(await q(`select date_trunc('minute', occurred_at) as minute, count(*) as n
    from public.application_error_log
    where message like '[AWS SES]%' and occurred_at > now() - interval '30 minutes'
    group by 1 order by 1 desc limit 15`));
  console.log('== sample context ==');
  console.log(await q(`select request_path, context, stack_trace is not null as has_stack
    from public.application_error_log where message like '[Mailtrap]%' order by occurred_at desc limit 3`));
  console.log('== audit_log columns ==');
  console.log(await q(`select column_name from information_schema.columns where table_schema='public' and table_name='audit_log' order by ordinal_position`));
  console.log('== cron job_run_details ==');
  console.log(await q(`select min(start_time) as oldest, count(*) as rows,
    count(*) filter (where start_time < now() - interval '7 days') as older_7d from cron.job_run_details`));
  console.log('== cron jobs ==');
  console.log(await q(`select jobid, jobname, schedule, active from cron.job order by jobid`));
})().finally(() => prisma.$disconnect());
