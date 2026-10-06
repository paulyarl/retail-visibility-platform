-- ============================================================
-- 315 — scheduled_job_runs retention
--
-- Every migrated job now records a run row (with captured console
-- output, capped 64KB) on each execution. At ~5-minute cadences
-- that is thousands of rows/day — keep a 7-day window: long enough
-- to glance back during an incident, short enough to stay cheap.
-- Purge runs daily at 03:45 via pg_cron, staggered after the other
-- retention jobs (03:00 cron history, 03:30 error log).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-scheduled-job-runs') THEN
    PERFORM cron.schedule(
      'purge-scheduled-job-runs',
      '45 3 * * *',
      $cmd$DELETE FROM public.scheduled_job_runs WHERE started_at < now() - interval '7 days'$cmd$
    );
  END IF;
END $$;
