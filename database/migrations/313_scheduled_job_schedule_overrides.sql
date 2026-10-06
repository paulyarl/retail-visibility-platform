-- Schedule overrides for registered jobs
-- Lets an operator change a job's cadence from the admin UI without a deploy.
-- NULL kind = run the code-defined default schedule.
--   kind='interval' → schedule_override is minutes between runs (e.g. '30')
--   kind='cron'     → schedule_override is a 5-field cron expression (UTC)

ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS schedule_override_kind varchar(20),
  ADD COLUMN IF NOT EXISTS schedule_override text;

COMMENT ON COLUMN scheduled_jobs.schedule_override_kind IS 'interval | cron | NULL (default schedule)';
COMMENT ON COLUMN scheduled_jobs.schedule_override IS 'interval: minutes between runs; cron: 5-field cron expression, UTC';
