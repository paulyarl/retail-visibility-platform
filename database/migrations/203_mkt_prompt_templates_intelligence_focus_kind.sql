-- Migration 203: Add intelligence_focus + intelligence_campaign_kind to mkt_prompt_templates_list
--
-- Makes prompt templates focus- and kind-aware so the campaign workspace
-- Prompts tab can filter by the campaign's intelligence type. Previously
-- focus was inferred from the template NAME (regex /competitive/i) and kind
-- was inferred from output_schema.name — both were artifacts, not queryable
-- data.
--
-- intelligence_focus: 'emerging' | 'competitive' (NULL for non-intelligence
--   templates and for composition fragments, which are identified by
--   fragment_kind).
-- intelligence_campaign_kind: 'discovery' | 'establishment' (NULL for
--   non-intelligence templates and fragments).
--
-- Both columns are nullable. The list query uses "match OR IS NULL" so that
-- legacy/untyped templates remain visible alongside focus-matched ones.

ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN IF NOT EXISTS intelligence_focus VARCHAR(20),
  ADD COLUMN IF NOT EXISTS intelligence_campaign_kind VARCHAR(20);

-- Backfill the known seeded intelligence templates.
UPDATE mkt_prompt_templates_list
SET intelligence_focus = 'emerging', intelligence_campaign_kind = 'discovery'
WHERE id = 'mpt-seed-intel-discovery-emerging-001';

UPDATE mkt_prompt_templates_list
SET intelligence_focus = 'competitive', intelligence_campaign_kind = 'discovery'
WHERE id = 'mpt-seed-intel-discovery-competitive-001';

UPDATE mkt_prompt_templates_list
SET intelligence_campaign_kind = 'establishment'
WHERE id = 'mpt-seed-intel-profile-establishment-001';

-- Index for the focus/kind-aware list query used by the campaign Prompts tab.
CREATE INDEX IF NOT EXISTS idx_mkt_prompt_templates_intelligence
  ON mkt_prompt_templates_list (intelligence_focus, intelligence_campaign_kind, is_active);
