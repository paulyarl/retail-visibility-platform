-- ============================================================
-- Migration 138: Marketing Ops — Campaign Parent/Child Linkage
-- ============================================================
-- Description:
--   - Adds parent_campaign_id to mkt_campaigns_list to support derived
--     business-scope campaigns spawned from category/city/state (or business)
--     campaigns. Enables the "create business campaign from discovered
--     competitor" flow.
--   - Self-referencing FK with ON DELETE SET NULL: deleting a parent does not
--     cascade-delete children; the child's parent link is simply cleared.
--   - Index on parent_campaign_id for efficient child lookups.
-- Prerequisite: 137_marketing_ops_contact_fields.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: parent_campaign_id column + self-FK
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS parent_campaign_id VARCHAR(255);

-- Self-referencing foreign key. A parent may not exist yet for legacy rows,
-- so the FK is added after the column (all NULLs are valid initially).
ALTER TABLE mkt_campaigns_list
  DROP CONSTRAINT IF EXISTS fk_mkt_campaigns_parent;
ALTER TABLE mkt_campaigns_list
  ADD CONSTRAINT fk_mkt_campaigns_parent
    FOREIGN KEY (parent_campaign_id)
    REFERENCES mkt_campaigns_list(id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION;

-- ============================================================
-- STEP 2: Index for child lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_parent
  ON mkt_campaigns_list(parent_campaign_id) WHERE parent_campaign_id IS NOT NULL;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_campaigns_list
--   DROP CONSTRAINT IF EXISTS fk_mkt_campaigns_parent;
-- DROP INDEX IF EXISTS idx_mkt_campaigns_parent;
-- ALTER TABLE mkt_campaigns_list
--   DROP COLUMN IF EXISTS parent_campaign_id;
