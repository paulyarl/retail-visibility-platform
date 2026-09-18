-- 296_mkt_geography_grids_key_width.sql
--
-- Widens mkt_geography_grids.city_key from varchar(120) to varchar(255).
--
-- Migration 295 introduced the city-level geography grid cache with an
-- exact-string key. The key now carries an optional ZIP segment
-- (`<city>|<state>|<sorted zips>`, or `<city>|<state>|` when the campaign names
-- no ZIPs), so a long city name plus a many-ZIP metro can exceed 120 chars.
-- Widening keeps the exact-string key intact rather than truncating it.
--
-- Applied manually against both `local` and `prd`:
--   psql $DATABASE_URL -f database/migrations/296_mkt_geography_grids_key_width.sql

ALTER TABLE mkt_geography_grids
  ALTER COLUMN city_key TYPE varchar(255);
