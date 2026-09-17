-- Migration 163: crm_support_tickets.campaign_id additive column (§5.7)
-- Optional link from a customer support ticket to the marketing campaign it
-- concerns. Cross-domain soft reference (no FK), set only by marketing portal
-- endpoints, never accepted from tenant-scoped flows.

BEGIN;

ALTER TABLE crm_support_tickets
  ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_campaign
  ON crm_support_tickets(campaign_id);

COMMIT;
