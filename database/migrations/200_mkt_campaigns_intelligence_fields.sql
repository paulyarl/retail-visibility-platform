-- Migration 200: Add intelligence_focus + intelligence_zip_codes + intelligence_search_radius_miles
-- to mkt_campaigns_list for Intelligence-scope campaigns.
--
-- These fields store the operator-selected discovery parameters at campaign
-- creation time so the render path can pass them to PromptComposerService.
--
-- intelligence_focus: 'emerging' | 'competitive' (defaults to 'emerging')
-- intelligence_zip_codes: comma-separated ZIP codes (optional)
-- intelligence_search_radius_miles: numeric radius (optional)

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS intelligence_focus VARCHAR(20) DEFAULT 'emerging',
  ADD COLUMN IF NOT EXISTS intelligence_zip_codes TEXT,
  ADD COLUMN IF NOT EXISTS intelligence_search_radius_miles NUMERIC(10,2);

-- Backfill existing intelligence-scope campaigns that don't have a focus set
UPDATE mkt_campaigns_list
SET intelligence_focus = 'emerging'
WHERE scope = 'intelligence' AND intelligence_focus IS NULL;
