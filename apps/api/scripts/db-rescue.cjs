#!/usr/bin/env node
/**
 * db-rescue — emergency database diagnostics & cleanup utility.
 *
 * Plain Node + @prisma/client on purpose: must work when the TS build is
 * broken. Reads DATABASE_URL/DIRECT_URL from the environment, so run it
 * through doppler:
 *
 *   doppler run --config prd -- node scripts/db-rescue.cjs report
 *   doppler run --config local -- node scripts/db-rescue.cjs report
 *
 * Commands (run with no args or `help` for full list):
 *   report                        DB size, biggest tables, error-log & cron health
 *   errors top [--days N]         Most frequent error messages (default 7d)
 *   errors purge --days N         Delete application_error_log older than N days
 *          [--like 'prefix%']     ...optionally only rows matching a LIKE pattern
 *   guard install --like P [--like P2...]   BEFORE INSERT trigger that silently
 *                                           drops matching rows (spam circuit breaker)
 *   guard status | drop           Inspect / remove the guard trigger
 *   cron list | dupes             pg_cron jobs / commands scheduled more than once
 *   cron trim [--days N]          Delete cron.job_run_details older than N days (def 3)
 *   cron retention [--days N]     Install nightly self-purge job for job_run_details
 *   cron unschedule <name>        cron.unschedule by job name
 *   vacuum <table> [--full]       VACUUM ANALYZE (or VACUUM FULL ANALYZE with --full)
 *   sql "select ..."              Arbitrary read query escape hatch (SELECT/WITH/EXPLAIN)
 *
 * Created 2026-10-06 after the application_error_log spam incident
 * (monthly-fee-summary loop → 717K rows / 400MB). See git history.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const q = (sql) => prisma.$queryRawUnsafe(sql);
const e = (sql) => prisma.$executeRawUnsafe(sql);
const out = (rows) => console.log(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));

// ── arg helpers ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd = args[0];
const sub = args[1];
function flag(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}
function flags(name) {
  const out = [];
  args.forEach((a, i) => { if (a === `--${name}` && args[i + 1]) out.push(args[i + 1]); });
  return out;
}
const has = (name) => args.includes(`--${name}`);
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ident = (s) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(s)) throw new Error(`unsafe identifier: ${s}`);
  return s.includes('.') ? s : `public.${s}`;
};

const GUARD_FN = 'public.rvp_rescue_skip_rows';
const GUARD_TRG = 'trg_rvp_rescue_skip';

async function report() {
  console.log('== database size ==');
  out(await q(`select pg_size_pretty(pg_database_size(current_database())) as db_size`));
  console.log('== schema totals (approx — toast counted under both parent and itself) ==');
  out(await q(`select n.nspname as schema, pg_size_pretty(sum(pg_total_relation_size(c.oid))) as total
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname not like 'pg_%' and n.nspname <> 'information_schema' and c.relkind = 'r'
    group by 1 order by sum(pg_total_relation_size(c.oid)) desc`));
  console.log('== top tables ==');
  out(await q(`select schemaname, relname as table, pg_size_pretty(pg_total_relation_size(relid)) as total,
    n_live_tup as rows, n_dead_tup as dead
    from pg_catalog.pg_statio_user_tables t
    join pg_stat_user_tables s using (relid, schemaname, relname)
    order by pg_total_relation_size(relid) desc limit 20`));
  console.log('== replication slots (inactive slots retain WAL → phantom disk usage) ==');
  out(await q(`select slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_wal from pg_replication_slots`));
  console.log('== application_error_log: volume by day (14d) ==');
  out(await q(`select occurred_at::date as d, count(*) as n from public.application_error_log
    where occurred_at > now() - interval '14 days' group by 1 order by 1`));
  console.log('== application_error_log: top messages (7d) ==');
  out(await q(`select left(message, 100) as msg, count(*) as n from public.application_error_log
    where occurred_at > now() - interval '7 days' group by 1 order by n desc limit 10`));
  console.log('== spam guard trigger ==');
  out(await q(`select tgname, tgrelid::regclass as table from pg_trigger where tgname = ${sqlStr(GUARD_TRG)}`));
  console.log('== pg_cron: jobs ==');
  out(await q(`select count(*) as active_jobs from cron.job where active`));
  await cronDupes();
  console.log('== cron.job_run_details ==');
  out(await q(`select count(*) as rows, min(start_time) as oldest, max(start_time) as newest,
    pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size from cron.job_run_details`));
}

async function errorsTop() {
  const days = Number(flag('days', 7));
  out(await q(`select level, service, error_name, left(message, 120) as msg, count(*) as n
    from public.application_error_log
    where occurred_at > now() - interval '${Math.max(1, days | 0)} days'
    group by 1,2,3,4 order by n desc limit 20`));
}

async function errorsPurge() {
  const days = Number(flag('days', 0));
  if (!(days > 0)) throw new Error('errors purge requires --days N (N > 0). Refusing to delete everything.');
  const likes = flags('like');
  let where = `occurred_at < now() - interval '${days | 0} days'`;
  if (likes.length) where += ` and (${likes.map((p) => `message like ${sqlStr(p)}`).join(' or ')})`;
  const n = await e(`DELETE FROM public.application_error_log WHERE ${where}`);
  console.log(`deleted ${n} rows`);
  out(await q(`select count(*) as remaining, pg_size_pretty(pg_total_relation_size('public.application_error_log')) as size
    from public.application_error_log`));
  console.log('hint: run `vacuum application_error_log --full` to return disk space (locks the table briefly)');
}

async function guardInstall() {
  const likes = flags('like');
  if (!likes.length) throw new Error('guard install requires at least one --like pattern');
  const cond = likes.map((p) => `NEW.message like ${sqlStr(p)}`).join('\n         or ');
  await e(`CREATE OR REPLACE FUNCTION ${GUARD_FN}() RETURNS trigger AS $f$
    BEGIN
      IF ${cond} THEN RETURN NULL; END IF;
      RETURN NEW;
    END; $f$ LANGUAGE plpgsql`);
  await e(`DROP TRIGGER IF EXISTS ${GUARD_TRG} ON public.application_error_log`);
  await e(`CREATE TRIGGER ${GUARD_TRG} BEFORE INSERT ON public.application_error_log
    FOR EACH ROW EXECUTE FUNCTION ${GUARD_FN}()`);
  console.log(`guard installed — INSERTs matching ${likes.length} pattern(s) are silently dropped`);
  console.log(`patterns: ${likes.join(' | ')}`);
}

async function guardStatus() {
  out(await q(`select tgname, tgrelid::regclass as table from pg_trigger where tgname = ${sqlStr(GUARD_TRG)}`));
  out(await q(`select proname, prosrc from pg_proc where proname = 'rvp_rescue_skip_rows'`));
}

async function guardDrop() {
  await e(`DROP TRIGGER IF EXISTS ${GUARD_TRG} ON public.application_error_log`);
  await e(`DROP FUNCTION IF EXISTS ${GUARD_FN}`);
  console.log('guard removed');
}

async function cronList() {
  out(await q(`select jobid, jobname, schedule, left(command, 80) as command, active from cron.job order by jobid`));
}

async function cronDupes() {
  console.log('== pg_cron: duplicate commands ==');
  out(await q(`select left(command, 90) as command, string_agg(jobname || ' (' || schedule || ')', ' | ') as jobs
    from cron.job where active group by command having count(*) > 1 order by command`));
}

async function cronTrim() {
  const days = Number(flag('days', 3));
  const n = await e(`DELETE FROM cron.job_run_details WHERE start_time < now() - interval '${Math.max(1, days | 0)} days'`);
  console.log(`deleted ${n} run-history rows`);
  await e(`VACUUM cron.job_run_details`);
  out(await q(`select count(*) as rows, pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size from cron.job_run_details`));
}

async function cronRetention() {
  const days = Number(flag('days', 3));
  const name = 'purge-cron-run-history';
  const existing = await q(`select jobid from cron.job where jobname = ${sqlStr(name)}`);
  if (existing.length) {
    console.log(`${name} already exists (jobid ${existing[0].jobid}) — updating command`);
    await e(`update cron.job set command = 'DELETE FROM cron.job_run_details WHERE start_time < now() - interval ''${days | 0} days''' where jobname = ${sqlStr(name)}`);
  } else {
    out(await q(`select cron.schedule(${sqlStr(name)}, '15 4 * * *',
      $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '${days | 0} days'$$) as jobid`));
  }
}

async function cronUnschedule() {
  const name = args[2];
  if (!name) throw new Error('cron unschedule <jobname>');
  out(await q(`select cron.unschedule(${sqlStr(name)}) as ok`));
}

async function vacuum() {
  const table = args[1] && !args[1].startsWith('--') ? args[1] : flag('table', null);
  if (!table) throw new Error('vacuum <table> [--full]');
  const t = ident(table);
  const full = has('full');
  console.log(`${full ? 'VACUUM FULL' : 'VACUUM'} ANALYZE ${t} … ${full ? '(exclusive lock — returns disk space)' : '(no lock — frees space for reuse)'}`);
  await e(`VACUUM (${full ? 'FULL, ' : ''}ANALYZE) ${t}`);
  out(await q(`select pg_size_pretty(pg_total_relation_size('${t}')) as size, pg_size_pretty(pg_database_size(current_database())) as db`));
}

async function sql() {
  const query = args[1];
  if (!query) throw new Error('sql "<query>"');
  if (!/^\s*(select|with|explain|show)\b/i.test(query)) throw new Error('sql is read-only: SELECT/WITH/EXPLAIN/SHOW only');
  out(await q(query));
}

const HELP = `db-rescue — emergency DB diagnostics & cleanup
usage: node scripts/db-rescue.cjs <command> [opts]   (wrap with doppler run --config <env>)

  report                                  full health report (run this first)
  errors top [--days N]                   top error messages (default 7)
  errors purge --days N [--like 'pat%']   delete error-log rows (repeatable --like)
  guard install --like 'pat%' [...]       install spam circuit-breaker trigger
  guard status | drop                     inspect / remove the guard
  cron list | dupes                       pg_cron jobs / duplicate commands
  cron trim [--days N]                    purge job_run_details (default 3d)
  cron retention [--days N]               install nightly self-purge cron job
  cron unschedule <name>                  remove a pg_cron job
  vacuum <table> [--full]                 VACUUM ANALYZE (--full returns disk space)
  sql "select ..."                        read-only escape hatch
`;

(async () => {
  try {
    switch (cmd) {
      case 'report': await report(); break;
      case 'errors':
        if (sub === 'top') await errorsTop();
        else if (sub === 'purge') await errorsPurge();
        else throw new Error('errors top | errors purge --days N [--like pat]');
        break;
      case 'guard':
        if (sub === 'install') await guardInstall();
        else if (sub === 'status') await guardStatus();
        else if (sub === 'drop') await guardDrop();
        else throw new Error('guard install --like pat | status | drop');
        break;
      case 'cron':
        if (sub === 'list') await cronList();
        else if (sub === 'dupes') await cronDupes();
        else if (sub === 'trim') await cronTrim();
        else if (sub === 'retention') await cronRetention();
        else if (sub === 'unschedule') await cronUnschedule();
        else throw new Error('cron list | dupes | trim | retention | unschedule <name>');
        break;
      case 'vacuum': await vacuum(); break;
      case 'sql': await sql(); break;
      case 'help': case undefined: case null: console.log(HELP); break;
      default: console.log(HELP); throw new Error(`unknown command: ${cmd}`);
    }
  } catch (err) {
    console.error(`\nerror: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
