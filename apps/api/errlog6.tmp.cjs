const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  console.log('== scheduled_jobs row ==');
  console.log(await q(`select name, enabled, schedule_override_kind, schedule_override, updated_at from scheduled_jobs where name='monthly-fee-summary'`));
  console.log('== recent runs ==');
  console.log(await q(`select status, trigger_source, started_at, finished_at, duration_ms, hostname, left(coalesce(error,''),120) as err
    from scheduled_job_runs where job_name='monthly-fee-summary' order by started_at desc limit 15`));
  console.log('== run count/day ==');
  console.log(await q(`select started_at::date as d, count(*) as n, count(distinct hostname) as hosts
    from scheduled_job_runs where job_name='monthly-fee-summary' group by 1 order by 1 desc limit 10`));
})().finally(() => prisma.$disconnect());
