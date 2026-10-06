const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  const e = (s) => prisma.$executeRawUnsafe(s);
  console.log('== jobs by command (dupes share a command) ==');
  console.log(await q(`select command, string_agg(jobname || ' (' || schedule || ')', ' | ' order by jobid) as jobs, count(*) as njobs
    from cron.job where active group by command having count(*) > 1 order by njobs desc`));
  const del = await e(`DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days'`);
  console.log('job_run_details deleted:', del);
  await e(`VACUUM cron.job_run_details`);
  console.log('== remaining ==');
  console.log(await q(`select count(*) as rows, min(start_time) as oldest, pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size from cron.job_run_details`));
})().finally(() => prisma.$disconnect());
