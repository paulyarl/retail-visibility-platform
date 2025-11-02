-- Migration: 002_feed_push_jobs.sql
-- Description: Create feed_push_jobs table for async job processing with retry logic
-- Version: v3.6.2-prep (Retrofit R2)
-- Date: 2025-10-31

-- Create job_status enum
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('queued', 'processing', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create feed_push_jobs table
CREATE TABLE IF NOT EXISTS feed_push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sku text,                       -- NULL for full feed push, specific SKU for single item
  job_status job_status NOT NULL DEFAULT 'queued',
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 5,
  last_attempt timestamptz,
  next_retry timestamptz,
  error_message text,
  error_code text,
  payload jsonb,                  -- Job-specific data (feed data, metadata, etc.)
  result jsonb,                   -- Result data from successful job
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  
  -- Constraints
  CONSTRAINT retry_count_valid CHECK (retry_count >= 0 AND retry_count <= max_retries),
  CONSTRAINT next_retry_after_last CHECK (next_retry IS NULL OR last_attempt IS NULL OR next_retry > last_attempt)
);

-- Create indexes
CREATE INDEX idx_feed_jobs_tenant_status ON feed_push_jobs(tenant_id, job_status);
CREATE INDEX idx_feed_jobs_status ON feed_push_jobs(job_status);
CREATE INDEX idx_feed_jobs_next_retry ON feed_push_jobs(next_retry) 
  WHERE job_status = 'queued' AND next_retry IS NOT NULL;
CREATE INDEX idx_feed_jobs_created ON feed_push_jobs(created_at DESC);
CREATE INDEX idx_feed_jobs_sku ON feed_push_jobs(tenant_id, sku) WHERE sku IS NOT NULL;

-- GIN index for payload queries
CREATE INDEX idx_feed_jobs_payload ON feed_push_jobs USING GIN(payload);

-- Add comments
COMMENT ON TABLE feed_push_jobs IS 'Async job queue for feed push operations with retry logic';
COMMENT ON COLUMN feed_push_jobs.sku IS 'NULL for full feed, specific SKU for single item push';
COMMENT ON COLUMN feed_push_jobs.retry_count IS 'Current retry attempt (0 = first attempt)';
COMMENT ON COLUMN feed_push_jobs.next_retry IS 'Timestamp when job should be retried (NULL if not scheduled)';
COMMENT ON COLUMN feed_push_jobs.payload IS 'Job data: feed items, metadata, options';
COMMENT ON COLUMN feed_push_jobs.result IS 'Result from successful job: response data, stats';

-- Enable Row Level Security
ALTER TABLE feed_push_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenants can only see their own jobs
DROP POLICY IF EXISTS feed_jobs_tenant_isolation ON feed_push_jobs;
CREATE POLICY feed_jobs_tenant_isolation ON feed_push_jobs
  FOR SELECT
  USING (tenant_id = auth.uid());

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION touch_feed_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feed_jobs_touch ON feed_push_jobs;
CREATE TRIGGER trg_feed_jobs_touch
  BEFORE UPDATE ON feed_push_jobs
  FOR EACH ROW
  EXECUTE FUNCTION touch_feed_job_updated_at();

-- Function to calculate next retry time with exponential backoff
CREATE OR REPLACE FUNCTION calculate_next_retry(
  p_retry_count int
) RETURNS timestamptz AS $$
DECLARE
  v_delay_seconds int;
BEGIN
  -- Exponential backoff: 1m, 5m, 15m, 1h, 1h
  v_delay_seconds := CASE p_retry_count
    WHEN 0 THEN 60        -- 1 minute
    WHEN 1 THEN 300       -- 5 minutes
    WHEN 2 THEN 900       -- 15 minutes
    WHEN 3 THEN 3600      -- 1 hour
    ELSE 3600             -- 1 hour (max)
  END;
  
  RETURN now() + (v_delay_seconds || ' seconds')::interval;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create a new feed push job
CREATE OR REPLACE FUNCTION create_feed_push_job(
  p_tenant_id uuid,
  p_sku text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO feed_push_jobs (
    tenant_id,
    sku,
    job_status,
    payload
  ) VALUES (
    p_tenant_id,
    p_sku,
    'queued',
    p_payload
  ) RETURNING id INTO v_job_id;
  
  -- Log to audit trail
  PERFORM log_audit_event(
    p_tenant_id,
    'feed_job',
    v_job_id::text,
    'create',
    auth.uid(),
    NULL,
    jsonb_build_object('sku', p_sku, 'status', 'queued'),
    jsonb_build_object('source', 'api')
  );
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as processing
CREATE OR REPLACE FUNCTION start_feed_push_job(
  p_job_id uuid
) RETURNS boolean AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE feed_push_jobs
  SET 
    job_status = 'processing',
    last_attempt = now(),
    next_retry = NULL
  WHERE id = p_job_id
    AND job_status = 'queued'
  RETURNING true INTO v_updated;
  
  RETURN COALESCE(v_updated, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as success
CREATE OR REPLACE FUNCTION complete_feed_push_job(
  p_job_id uuid,
  p_result jsonb DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_tenant_id uuid;
  v_updated boolean;
BEGIN
  UPDATE feed_push_jobs
  SET 
    job_status = 'success',
    result = p_result,
    completed_at = now()
  WHERE id = p_job_id
    AND job_status = 'processing'
  RETURNING tenant_id, true INTO v_tenant_id, v_updated;
  
  -- Log to audit trail
  IF v_updated THEN
    PERFORM log_audit_event(
      v_tenant_id,
      'feed_job',
      p_job_id::text,
      'complete',
      NULL,
      jsonb_build_object('status', 'processing'),
      jsonb_build_object('status', 'success', 'result', p_result),
      NULL
    );
  END IF;
  
  RETURN COALESCE(v_updated, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as failed and schedule retry
CREATE OR REPLACE FUNCTION fail_feed_push_job(
  p_job_id uuid,
  p_error_message text,
  p_error_code text DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_job record;
  v_new_status job_status;
  v_next_retry timestamptz;
BEGIN
  -- Get current job state
  SELECT * INTO v_job
  FROM feed_push_jobs
  WHERE id = p_job_id
    AND job_status = 'processing';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Determine if we should retry
  IF v_job.retry_count < v_job.max_retries THEN
    v_new_status := 'queued';
    v_next_retry := calculate_next_retry(v_job.retry_count + 1);
  ELSE
    v_new_status := 'failed';
    v_next_retry := NULL;
  END IF;
  
  -- Update job
  UPDATE feed_push_jobs
  SET 
    job_status = v_new_status,
    retry_count = retry_count + 1,
    next_retry = v_next_retry,
    error_message = p_error_message,
    error_code = p_error_code,
    completed_at = CASE WHEN v_new_status = 'failed' THEN now() ELSE NULL END
  WHERE id = p_job_id;
  
  -- Log to audit trail
  PERFORM log_audit_event(
    v_job.tenant_id,
    'feed_job',
    p_job_id::text,
    CASE WHEN v_new_status = 'failed' THEN 'fail' ELSE 'retry' END,
    NULL,
    jsonb_build_object('status', 'processing', 'retry_count', v_job.retry_count),
    jsonb_build_object(
      'status', v_new_status,
      'retry_count', v_job.retry_count + 1,
      'error', p_error_message,
      'next_retry', v_next_retry
    ),
    NULL
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get jobs ready for processing
CREATE OR REPLACE FUNCTION get_ready_feed_jobs(
  p_limit int DEFAULT 10
) RETURNS SETOF feed_push_jobs AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM feed_push_jobs
  WHERE job_status = 'queued'
    AND (next_retry IS NULL OR next_retry <= now())
  ORDER BY created_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_feed_push_job TO authenticated;
GRANT EXECUTE ON FUNCTION start_feed_push_job TO authenticated;
GRANT EXECUTE ON FUNCTION complete_feed_push_job TO authenticated;
GRANT EXECUTE ON FUNCTION fail_feed_push_job TO authenticated;
GRANT EXECUTE ON FUNCTION get_ready_feed_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_next_retry TO authenticated;

-- Create view for job statistics
CREATE OR REPLACE VIEW feed_job_stats AS
SELECT 
  tenant_id,
  COUNT(*) FILTER (WHERE job_status = 'queued') as queued_count,
  COUNT(*) FILTER (WHERE job_status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE job_status = 'success') as success_count,
  COUNT(*) FILTER (WHERE job_status = 'failed') as failed_count,
  COUNT(*) as total_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE job_status = 'success') / NULLIF(COUNT(*), 0),
    2
  ) as success_rate_pct,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE job_status = 'success') as avg_duration_seconds
FROM feed_push_jobs
GROUP BY tenant_id;

COMMENT ON VIEW feed_job_stats IS 'Aggregated statistics for feed push jobs by tenant';
