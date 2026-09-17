-- Migration 201: Add intelligence_campaign_kind to mkt_campaigns_list
--
-- Distinguishes intelligence-scope campaigns that exist to run a discovery
-- scan (emerging/competitive) from campaigns that exist only as a vehicle
-- to import a Category Intelligence Profile via /executions/external.
--
-- Values:
--   'discovery'      — campaign runs an Intelligence Discovery prompt
--                      (focus = emerging | competitive). Default.
--   'establishment'  — campaign was used to bootstrap a category profile
--                      via the Intelligence Profile Establishment template.
--                      Excluded from discovery-workspace campaign pickers.
--
-- The import hook (MarketingPromptService.importExternalResult) flips a
-- campaign to 'establishment' when an intelligence_profile-schema result
-- is imported against it, so the discriminator is durable and automatic.

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS intelligence_campaign_kind VARCHAR(20) DEFAULT 'discovery';

-- Backfill: any intelligence-scope campaign that has already been used to
-- import an intelligence_profile-schema execution is an establishment
-- campaign. Detect by joining to mkt_prompt_executions_list where the
-- template's output_schema name is 'intelligence_profile'.
UPDATE mkt_campaigns_list c
SET intelligence_campaign_kind = 'establishment'
WHERE c.scope = 'intelligence'
  AND c.intelligence_campaign_kind = 'discovery'
  AND EXISTS (
    SELECT 1
    FROM mkt_prompt_executions_list e
    JOIN mkt_prompt_templates_list t ON t.id = e.template_id
    WHERE e.campaign_id = c.id
      AND t.output_schema->>'name' = 'intelligence_profile'
  );
