-- 295_mkt_geography_grids.sql
--
-- City-level geography grid cache (intelligence discovery substrate).
--
-- The discovery substrate's sweep units (ZIPs + corridors + adjacent
-- municipalities) are CATEGORY-INDEPENDENT: they describe the retail catchment
-- of a market, not a category. Deriving them per category means re-deriving —
-- and re-hallucinating — the same market's ZIPs for every category, with a
-- slightly different set each time. This table derives the grid ONCE per
-- (city, state) market and reuses it across every category's establishment and
-- discovery runs.
--
-- Populated from the establishment profile's `geography_grid` on import
-- (AI-derived), or from the campaign's intelligence_zip_codes when set. Read at
-- prompt-render time when the campaign carries no ZIPs, so the grid is
-- authoritative rather than re-derived.
--
-- No CHECK constraints — `derivation` is validated in code (GeographyGridService).
--
-- Applied manually against both `local` and `prd`:
--   psql $DATABASE_URL -f database/migrations/295_mkt_geography_grids.sql

CREATE TABLE IF NOT EXISTS mkt_geography_grids (
  id                varchar(64)  PRIMARY KEY,
  -- Normalized lookup key: "<lowercased city>|<uppercased state>". Kept as a
  -- stored column (rather than a functional index) so Prisma can model it.
  city_key          varchar(120) NOT NULL,
  city              varchar(100) NOT NULL,
  state             varchar(50)  NOT NULL,
  -- The GeographyGrid object: { city, state, zips[], corridors[],
  -- adjacent_municipalities[], radius_miles }.
  grid              jsonb        NOT NULL DEFAULT '{}'::jsonb,
  -- How the grid was derived: 'campaign_zip_codes' | 'profile_import' | 'ai_derived'.
  derivation        varchar(30)  NOT NULL DEFAULT 'ai_derived',
  source_profile_id varchar(64),
  created_at        timestamptz(6) NOT NULL DEFAULT now(),
  updated_at        timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_geography_grids_city_key
  ON mkt_geography_grids (city_key);
