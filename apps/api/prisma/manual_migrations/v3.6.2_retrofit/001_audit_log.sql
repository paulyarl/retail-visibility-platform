-- Migration: 001_audit_log.sql
-- Description: Create audit_log table for tracking all entity changes
-- Version: v3.6.2-prep (Retrofit R2)
-- Date: 2025-10-31

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  entity text NOT NULL,          -- 'category', 'profile', 'sku', 'feed_job', etc.
  entity_id text NOT NULL,        -- ID of the entity being audited
  action text NOT NULL,           -- 'create', 'update', 'delete', 'align', 'sync'
  actor_id uuid,                  -- User who performed the action (NULL for system)
  timestamp timestamptz NOT NULL DEFAULT now(),
  diff jsonb,                     -- JSON diff: {old: {...}, new: {...}}
  metadata jsonb                  -- Additional context (IP, user agent, etc.)
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_tenant_timestamp ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- Create GIN index for JSONB queries
CREATE INDEX idx_audit_log_diff ON audit_log USING GIN(diff);

-- Add comment
COMMENT ON TABLE audit_log IS 'Audit trail for all entity changes across the platform';
COMMENT ON COLUMN audit_log.entity IS 'Type of entity: category, profile, sku, feed_job, oauth_token, etc.';
COMMENT ON COLUMN audit_log.action IS 'Action performed: create, update, delete, align, sync, etc.';
COMMENT ON COLUMN audit_log.diff IS 'JSON diff showing old and new values';

-- Enable Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenants can only see their own audit logs
DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR SELECT
  USING (tenant_id = auth.uid());

-- Admin policy: Admins can see all audit logs
DROP POLICY IF EXISTS audit_log_admin_access ON audit_log;
CREATE POLICY audit_log_admin_access ON audit_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create helper function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_tenant_id uuid,
  p_entity text,
  p_entity_id text,
  p_action text,
  p_actor_id uuid DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
  v_diff jsonb;
BEGIN
  -- Build diff object
  IF p_old_data IS NOT NULL OR p_new_data IS NOT NULL THEN
    v_diff := jsonb_build_object(
      'old', p_old_data,
      'new', p_new_data
    );
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_log (
    tenant_id,
    entity,
    entity_id,
    action,
    actor_id,
    diff,
    metadata
  ) VALUES (
    p_tenant_id,
    p_entity,
    p_entity_id,
    p_action,
    p_actor_id,
    v_diff,
    p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

-- Partition setup for performance (optional but recommended)
-- Uncomment if using PostgreSQL 10+ with partitioning support
/*
-- Convert to partitioned table
ALTER TABLE audit_log RENAME TO audit_log_old;

CREATE TABLE audit_log (
  id uuid DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  timestamp timestamptz NOT NULL DEFAULT now(),
  diff jsonb,
  metadata jsonb,
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for current and next 12 months
-- Run this monthly or via cron job
CREATE TABLE audit_log_2025_11 PARTITION OF audit_log
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE audit_log_2025_12 PARTITION OF audit_log
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Migrate data
INSERT INTO audit_log SELECT * FROM audit_log_old;

-- Drop old table
DROP TABLE audit_log_old;
*/
