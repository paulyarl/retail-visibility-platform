-- Dedupe suppression accounting for application_error_log
-- The dedupe trigger (trg_rvp_error_log_dedupe) and the app's DatabaseTransport
-- both drop/skip repeated identical error inserts; this table counts what was
-- suppressed so admins retain volume visibility (one row per distinct message).
-- Keyed by md5(message); `message` stores the first-seen text for display.

CREATE TABLE IF NOT EXISTS public.error_log_dedupe_stats (
  message_md5          text PRIMARY KEY,
  message              text NOT NULL,
  source               varchar(20) NOT NULL DEFAULT 'db-trigger',  -- 'logger' | 'db-trigger'
  suppressed_count     bigint NOT NULL DEFAULT 0,
  first_suppressed_at  timestamptz NOT NULL DEFAULT now(),
  last_suppressed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_dedupe_stats_last_seen
  ON public.error_log_dedupe_stats (last_suppressed_at DESC);

COMMENT ON TABLE public.error_log_dedupe_stats IS 'Suppression counters for deduplicated application_error_log writes (spam circuit-breaker accounting)';
