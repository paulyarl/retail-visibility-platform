-- 119_crm_message_content_blocks.sql
-- Adds structured BlockNote JSON storage to CRM ticket and task messages for rich public replies.
-- Internal notes remain plain text in the existing `content` column.

-- Public replies can store BlockNote blocks as JSONB.
-- Existing `content` column is preserved for plain-text fallback, search, and notifications.
ALTER TABLE crm_ticket_messages
  ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT NULL;

ALTER TABLE crm_task_messages
  ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT NULL;
