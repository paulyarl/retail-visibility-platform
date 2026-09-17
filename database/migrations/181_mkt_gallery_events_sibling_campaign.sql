-- Migration 181: mkt_gallery_events.sibling_campaign_id
--
-- Adds sibling_campaign_id to mkt_gallery_events for per-sibling engagement
-- attribution in multi-gallery tokens.
--
-- For single-gallery tokens: sibling_campaign_id is NULL (the campaign_id
-- is the sibling).
-- For multi-gallery tokens: sibling_campaign_id identifies which sibling's
-- gallery section the user was viewing when the event fired.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- sibling_campaign_id: the specific sibling campaign the engagement event
-- was on. NULL for single-gallery tokens (the campaign_id is the sibling).
-- For multi-gallery tokens, this identifies which sibling's gallery section
-- the user was viewing when the event fired.
ALTER TABLE mkt_gallery_events
  ADD COLUMN IF NOT EXISTS sibling_campaign_id VARCHAR(255);

-- Index for per-sibling analytics queries (event_type + time ordering)
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_sibling
  ON mkt_gallery_events (sibling_campaign_id, event_type, created_at DESC)
  WHERE sibling_campaign_id IS NOT NULL;

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_gallery_events' AND column_name = 'sibling_campaign_id';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'mkt_gallery_events' AND indexname = 'idx_mkt_gallery_events_sibling';

COMMIT;
