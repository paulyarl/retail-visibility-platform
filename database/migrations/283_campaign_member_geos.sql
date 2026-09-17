-- Migration 283: mkt_campaigns_list.member_geos
-- Proving-ground domain model (describe + auto-expand). A PG's constraint
-- domain is two axes:
--   categories = category ∪ secondary_categories   (Migration 271 — reused)
--   geos       = {city,state} ∪ member_geos        (this column)
-- member_geos stores extra {city, state} pairs declared beyond the anchor
-- geo — e.g. Indianapolis + Plainfield "city + suburbs" PGs, or a geo that
-- auto-expands when an out-of-domain queue row is grouped in. Only
-- meaningful when the anchor city is set; a geography-free PG's geo domain
-- is unconstrained (nationwide) and member_geos stays empty.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS member_geos JSONB DEFAULT NULL;
