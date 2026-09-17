-- Migration 254: Place Seed SEO Enrichment
--
-- Adds SEO enrichment columns for the directory presence seed → place listing
-- flow. The composer (SeedSeoComposer) produces a deterministic SEO packet at
-- seed time; meta_title + composer auditability live on the seed row, while
-- same_as joins the existing description/keywords columns on the listing.
--
-- Prerequisites: none (additive ALTER on existing tables)
-- Date: 2026-09-02
--
-- Verification (run after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'directory_presence_seeds' AND column_name = 'seo_enrichment';
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'directory_listings_list' AND column_name = 'same_as';

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS seo_enrichment JSONB NULL;

ALTER TABLE directory_listings_list
  ADD COLUMN IF NOT EXISTS same_as TEXT[] NULL DEFAULT '{}';
