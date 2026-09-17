-- 119_crm_message_content_blocks_rollback.sql
-- Rollback for rich content migration: drops the JSONB columns added in 119.

ALTER TABLE crm_ticket_messages
  DROP COLUMN IF EXISTS content_blocks;

ALTER TABLE crm_task_messages
  DROP COLUMN IF EXISTS content_blocks;
