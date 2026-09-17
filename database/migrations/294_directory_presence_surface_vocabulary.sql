-- 294_directory_presence_surface_vocabulary.sql
--
-- Phase 1 (A) — surface vocabulary alignment for the directory traffic surface.
--
-- The traffic-surface spec introduced `surface: 'directory_seed' | 'directory_claimed'`,
-- which collided with the pre-existing ecosystem vocabulary
-- (`surface: 'place' | 'directory'`) already written by CategoryBrowseTracker /
-- LocationBrowseTracker into the SAME `user_behavior_simple.context` JSON.
--
-- Canonical vocabulary after this migration:
--   context->>'surface'        : 'place' | 'directory'
--   context->>'listing_origin' : 'directory_seed' | 'claimed'
--                                 (mirrors directory_listings_list.listing_origin)
--
-- Migration 292 backfilled `surface = 'directory_seed'`; this rewrites rows
-- written under the old vocabulary. Idempotent — a second run matches nothing.
--
-- Apply against both `local` and `prd`:
--   psql "$DATABASE_URL" -f database/migrations/294_directory_presence_surface_vocabulary.sql

-- Old seed-entry surface value → ecosystem 'place'
UPDATE user_behavior_simple
SET context = jsonb_set(context, '{surface}', '"place"', false)
WHERE entity_type = 'store'
  AND page_type = 'directory_detail'
  AND context->>'surface' = 'directory_seed';

-- Old claimed-entry surface value → ecosystem 'directory'
UPDATE user_behavior_simple
SET context = jsonb_set(context, '{surface}', '"directory"', false)
WHERE entity_type = 'store'
  AND page_type = 'directory_detail'
  AND context->>'surface' = 'directory_claimed';

-- Old claimed listing_origin value → the directory_listings_list vocabulary
UPDATE user_behavior_simple
SET context = jsonb_set(context, '{listing_origin}', '"claimed"', false)
WHERE entity_type = 'store'
  AND page_type = 'directory_detail'
  AND context->>'listing_origin' = 'directory_claimed';
