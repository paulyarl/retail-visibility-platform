const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  console.log('== remaining dupes ==');
  console.log(await q(`select command, string_agg(jobname,' | ') as jobs from cron.job where active group by command having count(*)>1`));
  console.log('== trigger still blocking? (rows since trigger install ~5min ago) ==');
  console.log(await q(`select count(*) as new_rows, count(*) filter (where message like '[AWS SES]%' or message like '[SendGrid]%' or message like '[Mailtrap]%') as spam_rows
    from public.application_error_log where occurred_at > now() - interval '10 minutes'`));
  console.log('== final size ==');
  console.log(await q(`select pg_size_pretty(pg_database_size(current_database())) as db_size`));
  console.log(await q(`select relname, pg_size_pretty(pg_total_relation_size(relid)) as size
    from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 8`));
})().finally(() => prisma.$disconnect());
