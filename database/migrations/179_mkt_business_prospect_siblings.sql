-- Migration 179: business_prospect_id + engagement_cycle + is_primary_sibling
--
-- Adds three columns to mkt_campaigns_list to support the multi-archetype
-- sibling campaign model:
--   - business_prospect_id: groups sibling campaigns for the same business
--     prospect. NULL for category/city scope campaigns. All siblings share
--     the same value.
--   - engagement_cycle: tracks sequential cycling within a sibling campaign.
--     Default 1 (first engagement). Increments when the operator cycles back
--     after delivery for a follow-on package.
--   - is_primary_sibling: marks the highest-priority archetype sibling for
--     display ordering and default gallery focus.
--
-- Backfill: for existing business-scope campaigns without a prospect_id,
-- generate a dedicated prospect ID with a 'bp_' prefix to avoid collisions
-- with campaign IDs (which are used as foreign keys). Each existing business
-- campaign becomes its own prospect group with one sibling — itself.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- business_prospect_id: groups sibling campaigns for the same business prospect.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS business_prospect_id VARCHAR(255);

-- engagement_cycle: tracks sequential cycling within a sibling campaign.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS engagement_cycle INT NOT NULL DEFAULT 1;

-- is_primary_sibling: marks the highest-priority archetype sibling.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS is_primary_sibling BOOLEAN NOT NULL DEFAULT false;

-- Index for sibling lookups (partial — only business-scope campaigns with a prospect ID)
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_business_prospect
  ON mkt_campaigns_list (business_prospect_id)
  WHERE business_prospect_id IS NOT NULL;

-- Sibling uniqueness: one (category, repair_track) per prospect group.
-- Prevents duplicate siblings (e.g., two A1 campaigns for the same prospect).
-- Uses COALESCE(repair_track, 'none') so NULL repair_track is treated as a
-- distinct value — allows one review_management, one recovery_management,
-- one profile_repair+standard, and one profile_repair+escalated per prospect.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_campaigns_prospect_sibling_unique
  ON mkt_campaigns_list (business_prospect_id, campaign_category, COALESCE(repair_track, 'none'))
  WHERE business_prospect_id IS NOT NULL AND scope = 'business';

-- Backfill: each existing business-scope campaign becomes its own prospect group.
-- Uses 'bp_' prefix (underscore) to distinguish from generated IDs (bp-{nanoid}).
UPDATE mkt_campaigns_list
  SET business_prospect_id = CONCAT('bp_', id), is_primary_sibling = true
  WHERE scope = 'business' AND business_prospect_id IS NULL;

-- Verification queries (run manually after applying):
-- SELECT scope, COUNT(*), COUNT(business_prospect_id) FROM mkt_campaigns_list GROUP BY scope;
-- SELECT business_prospect_id, COUNT(*) FROM mkt_campaigns_list WHERE business_prospect_id IS NOT NULL GROUP BY business_prospect_id HAVING COUNT(*) > 1;
-- (Second query should return 0 rows — no prospect has multiple siblings yet)

COMMIT;
