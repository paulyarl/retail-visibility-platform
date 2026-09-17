-- Migration 271: Campaign secondary categories
--
-- Business campaigns could only carry a single `category` (primary). The
-- category-identification act flow returns `campaign_exists` when a campaign
-- for the business already exists — the identified category had nowhere to
-- go (only the service-category vocab was updated, so the campaign detail
-- showed nothing). Mirrors the primary_category / secondary_categories
-- pattern already used by directory_presence_seeds (seed create/edit UI).
--
-- Slot semantics (enforced at the service layer, not by CHECK):
--   category              → primary category (empty for categoryless seeks)
--   secondary_categories  → additional identified/assigned categories
--
-- Idempotent (IF NOT EXISTS). Non-null with '{}' default — existing
-- campaigns start with no secondary categories.

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS secondary_categories TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN mkt_campaigns_list.secondary_categories IS
  'Secondary categories (Migration 271) — additional categories beyond the primary `category`, populated by the category-identification act flow (campaign_exists path) and the campaign create/edit form.';
