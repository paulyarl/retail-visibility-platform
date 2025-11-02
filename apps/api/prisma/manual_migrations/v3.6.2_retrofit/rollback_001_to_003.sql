-- Rollback Script: rollback_001_to_003.sql
-- Description: Rollback all v3.6.2-prep retrofit migrations
-- Version: v3.6.2-prep (Retrofit R2)
-- Date: 2025-10-31
-- WARNING: This will drop tables and data. Ensure you have backups!

-- Drop views first (dependencies)
DROP VIEW IF EXISTS pilot_program_kpis;
DROP VIEW IF EXISTS feedback_analytics;
DROP VIEW IF EXISTS feed_job_stats;

-- Drop functions
DROP FUNCTION IF EXISTS submit_feedback(uuid, jsonb, integer, text, text);
DROP FUNCTION IF EXISTS get_ready_feed_jobs(int);
DROP FUNCTION IF EXISTS fail_feed_push_job(uuid, text, text);
DROP FUNCTION IF EXISTS complete_feed_push_job(uuid, jsonb);
DROP FUNCTION IF EXISTS start_feed_push_job(uuid);
DROP FUNCTION IF EXISTS create_feed_push_job(uuid, text, jsonb);
DROP FUNCTION IF EXISTS calculate_next_retry(int);
DROP FUNCTION IF EXISTS touch_feed_job_updated_at();
DROP FUNCTION IF EXISTS log_audit_event(uuid, text, text, text, uuid, jsonb, jsonb, jsonb);

-- Drop tables (reverse order of creation)
DROP TABLE IF EXISTS outreach_feedback CASCADE;
DROP TABLE IF EXISTS feed_push_jobs CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS job_status CASCADE;

-- Note: We keep the base v3.6.1 tables and enums intact
-- This rollback only removes the retrofit additions

-- Verification query to check cleanup
DO $$
BEGIN
  RAISE NOTICE 'Rollback complete. Verifying...';
  
  -- Check if tables are dropped
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    RAISE WARNING 'audit_log table still exists!';
  ELSE
    RAISE NOTICE '✓ audit_log dropped';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feed_push_jobs') THEN
    RAISE WARNING 'feed_push_jobs table still exists!';
  ELSE
    RAISE NOTICE '✓ feed_push_jobs dropped';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outreach_feedback') THEN
    RAISE WARNING 'outreach_feedback table still exists!';
  ELSE
    RAISE NOTICE '✓ outreach_feedback dropped';
  END IF;
  
  RAISE NOTICE 'Rollback verification complete.';
END $$;
