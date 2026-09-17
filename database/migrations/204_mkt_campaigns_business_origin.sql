-- Migration 204: Add business_origin_country + business_origin_region
-- to mkt_campaigns_list for diaspora / heritage-origin categorization.
--
-- Many niche categories encode a continent-level origin as part of the
-- niche label (e.g. "African Grocery Store", "Indian Grocery Store").
-- The continent qualifier is too coarse for prompt composition, niche
-- overrides, and outreach targeting — a Gambian, Ethiopian, and Nigerian
-- grocery store serve very different diaspora communities. These fields
-- capture the specific country and/or region of origin so deliverable
-- prompts, intake niche overrides, and reporting can reference the
-- actual heritage community rather than a pan-continental label.
--
-- Both fields are nullable, free-text (country name, not ISO code) since
-- they are prompt-facing rather than join keys. Region absorbs the
-- multi-country case (e.g. "West Africa" spans Gambia, Senegal, Nigeria).
--
-- business_origin_country: e.g. "Gambia", "India", "Nigeria" (nullable)
-- business_origin_region:   e.g. "West Africa", "South Asia" (nullable)

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS business_origin_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS business_origin_region VARCHAR(100);
