-- Scheduled jobs registry + run history
-- Backs the admin "Scheduled Jobs" UI (/settings/admin/jobs): module visibility,
-- status, run history, failures, per-run captured logs, and an enable/disable
-- kill switch for runaway jobs.

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  name           text PRIMARY KEY,
  description    text,
  schedule_label text,
  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name       varchar(100) NOT NULL,
  status         varchar(20) NOT NULL DEFAULT 'running',  -- running | success | failed | skipped
  trigger_source varchar(20) NOT NULL DEFAULT 'schedule', -- schedule | manual | api
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  duration_ms    integer,
  error          text,
  result         jsonb,
  logs           text,
  hostname       varchar(255),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sjr_job_started ON scheduled_job_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sjr_status_started ON scheduled_job_runs (status, started_at DESC);
