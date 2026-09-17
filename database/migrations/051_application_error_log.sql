-- Migration: 051_application_error_log.sql
-- Purpose: Create application_error_log table for persistent exception storage
-- Part of: P0 Logging Architecture (docs/LOGGING_AUDIT.md)

CREATE TABLE IF NOT EXISTS application_error_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  level           VARCHAR(10) NOT NULL DEFAULT 'error',
  message         TEXT NOT NULL,
  stack_trace     TEXT,
  error_name      VARCHAR(255),
  tenant_id       VARCHAR(255),
  user_id         VARCHAR(255),
  request_method  VARCHAR(10),
  request_path    TEXT,
  request_query   JSONB,
  status_code     INTEGER,
  correlation_id  VARCHAR(255),
  service         VARCHAR(100),
  context         JSONB DEFAULT '{}'::jsonb,
  sentry_event_id VARCHAR(255),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolved_by     VARCHAR(255)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_app_error_log_tenant_time
  ON application_error_log (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_error_log_level_time
  ON application_error_log (level, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_error_log_service_time
  ON application_error_log (service, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_error_log_correlation
  ON application_error_log (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_error_log_unresolved
  ON application_error_log (occurred_at DESC)
  WHERE resolved = false;

COMMENT ON TABLE application_error_log IS 'Persistent application error/exception log with tenant context and Sentry cross-reference';
