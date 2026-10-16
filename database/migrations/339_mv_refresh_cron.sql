-- ============================================================
-- 339 — commit the mv_tenant_effective_capabilities refresh cron
--
-- The MV's refresh job has lived in prd since migration 089 as an
-- operator-run snippet in a comment — verified live as cron.job
-- jobid 120 ('refresh-mv_tenant_effective_capabilities', '*/10 * * * *',
-- active, succeeding on cadence). It was never reproducible from the
-- repo: a fresh env built from migrations would silently serve a
-- permanently stale capability view.
--
-- This commits the schedule using 315's guarded idiom: no-op where the
-- job already exists (prd), installs it where pg_cron is present but
-- the job is missing, skips entirely where pg_cron isn't installed.
--
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-mv_tenant_effective_capabilities') THEN
    PERFORM cron.schedule(
      'refresh-mv_tenant_effective_capabilities',
      '*/10 * * * *',
      $cmd$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities$cmd$
    );
  END IF;
END $$;

-- Verification:
--   SELECT jobid, jobname, schedule, active FROM cron.job
--   WHERE jobname = 'refresh-mv_tenant_effective_capabilities';
