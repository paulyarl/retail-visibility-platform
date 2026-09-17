-- Migration 180: Multi-Diagnostic Gallery Token Support
--
-- Adds a metadata JSONB column to mkt_deliverable_preview_tokens to support
-- multi-diagnostic gallery tokens (token_type = 'multi_diagnostic_gallery').
--
-- The metadata column stores:
--   - business_prospect_id: the prospect group ID
--   - sibling_campaign_ids: array of all sibling campaign IDs included
--   - sibling_summaries: per-sibling gallery metadata (archetype, title, CTA)
--
-- For multi-gallery tokens, the campaign_id column references the primary
-- sibling campaign. The metadata column provides the full sibling context.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- Add metadata column for multi-gallery token context.
-- Does not exist today — friction_summary is used for the gallery friction
-- summary, not prospect/sibling metadata.
ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Expression index for prospect-level gallery lookups.
-- Queries the business_prospect_id from the metadata JSONB.
CREATE INDEX IF NOT EXISTS idx_mkt_preview_tokens_prospect
  ON mkt_deliverable_preview_tokens ((metadata->>'business_prospect_id'))
  WHERE token_type = 'multi_diagnostic_gallery';

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_deliverable_preview_tokens' AND column_name = 'metadata';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'mkt_deliverable_preview_tokens' AND indexname = 'idx_mkt_preview_tokens_prospect';

COMMIT;
