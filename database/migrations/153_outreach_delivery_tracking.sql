-- Migration 153: Add delivery tracking fields to outreach log + deliverables
--
-- The recovery resolution delivery flow was best-effort: if the email
-- failed, the failure was logged to the application log but not to the
-- database. Operators had no way to see if a delivery failed, and there
-- was no retry mechanism.
--
-- This migration adds delivery status tracking to both mkt_outreach_log
-- (for outreach cascade steps) and mkt_deliverables_list (for final
-- resolution delivery).
--
-- Sprint 2 — Recovery Production Readiness.

ALTER TABLE mkt_outreach_log
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS delivery_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ;

ALTER TABLE mkt_deliverables_list
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outreach_delivery_retry
  ON mkt_outreach_log (delivery_status, retry_after)
  WHERE delivery_status IN ('failed', 'retrying');

COMMENT ON COLUMN mkt_outreach_log.delivery_status IS 'pending | sent | failed | retrying — tracks email/SMS delivery outcome for retry logic';
COMMENT ON COLUMN mkt_outreach_log.delivery_attempts IS 'Number of delivery attempts made (0 = not yet attempted, 1+ = attempted)';
COMMENT ON COLUMN mkt_outreach_log.last_delivery_error IS 'Error message from the last failed delivery attempt';
COMMENT ON COLUMN mkt_outreach_log.retry_after IS 'Timestamp after which the next retry attempt should be made (exponential backoff)';

COMMENT ON COLUMN mkt_deliverables_list.delivery_status IS 'pending | sent | failed — tracks final deliverable delivery to the owner';
COMMENT ON COLUMN mkt_deliverables_list.delivered_at IS 'Timestamp when the deliverable was successfully delivered to the owner';
