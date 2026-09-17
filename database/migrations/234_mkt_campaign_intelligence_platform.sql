-- 234_mkt_campaign_intelligence_platform.sql
-- Gold Standard System — Sprint 0
--
-- Adds intelligence_platform to mkt_campaigns_list so gold-standard
-- campaigns can record which platform they target (google | yelp |
-- facebook | bbb | apple_maps | bing | all). The column is nullable
-- because emerging/competitive intelligence campaigns are city-focused,
-- not platform-focused, and legacy campaigns have no platform value.
--
-- The platform replaces city as the focus dimension for gold-standard
-- campaigns. Gold-standard campaigns are city-agnostic, so City becomes
-- optional when focus = 'gold_standards'.
--
-- Idempotent — safe to re-run.

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS intelligence_platform VARCHAR(20);

COMMENT ON COLUMN mkt_campaigns_list.intelligence_platform IS
  'Platform focus for gold-standard intelligence campaigns (google | yelp | facebook | bbb | apple_maps | bing | all). NULL for emerging/competitive campaigns.';

-- Verification:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'mkt_campaigns_list' AND column_name = 'intelligence_platform';
