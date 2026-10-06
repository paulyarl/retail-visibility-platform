const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const q = (s) => prisma.$queryRawUnsafe(s);
  console.log('== db size ==');
  console.log(await q(`select pg_size_pretty(pg_database_size(current_database())) as db_size`));
  console.log('== top 25 tables ==');
  console.log(await q(`select schemaname, relname as table, pg_size_pretty(pg_total_relation_size(relid)) as total,
    pg_size_pretty(pg_relation_size(relid)) as heap,
    pg_size_pretty(pg_total_relation_size(relid)-pg_relation_size(relid)) as idx_toast,
    n_live_tup as rows
    from pg_catalog.pg_statio_user_tables t
    join pg_stat_user_tables s using (relid, schemaname, relname)
    order by pg_total_relation_size(relid) desc limit 25`));
  console.log('== schema totals ==');
  console.log(await q(`select n.nspname as schema, pg_size_pretty(sum(pg_total_relation_size(c.oid))) as total
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and c.relkind in ('r','m','i','t')
    group by 1 order by sum(pg_total_relation_size(c.oid)) desc`));
  console.log('== replication slots ==');
  console.log(await q(`select slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_wal from pg_replication_slots`));
})().finally(() => prisma.$disconnect());
