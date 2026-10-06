const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  const e = (s) => prisma.$executeRawUnsafe(s);
  // security-alert pair — show real commands
  console.log(await q(`select jobid, jobname, command from cron.job where jobname like 'security-alerts%'`));
  // add retention job for cron history itself (idempotent name)
  const existing = await q(`select jobid from cron.job where jobname='purge-cron-run-history'`);
  if (existing.length === 0) {
    console.log(await q(`select cron.schedule('purge-cron-run-history', '15 4 * * *',
      $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days'$$) as jobid`));
    console.log('retention job created');
  } else {
    console.log('retention job already exists', existing);
  }
  // also retention for application_error_log (>14 days) — keeps real errors bounded
  const ex2 = await q(`select jobid from cron.job where jobname='purge-application-error-log'`);
  if (ex2.length === 0) {
    console.log(await q(`select cron.schedule('purge-application-error-log', '20 4 * * *',
      $$DELETE FROM public.application_error_log WHERE occurred_at < now() - interval '14 days'$$) as jobid`));
    console.log('error-log retention job created');
  }
  await e(`VACUUM FULL cron.job_run_details`);
  console.log(await q(`select pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size`));
})().finally(() => prisma.$disconnect());
