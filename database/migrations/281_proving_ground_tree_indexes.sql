-- Migration 281: Proving-ground tree query index
--
-- The proving-ground cockpit and the new stage-distribution endpoint
-- (GET /api/admin/marketing-ops/:campaignId/stage-distribution — see
-- docs/LocalBiz/PROVING_GROUND_STAGE_CULTURE_FIT_ANALYSIS.md §6.2) resolve
-- a PG's tree through mkt_prospect_queue.source_campaign_id — the
-- queue→tree linkage (WHERE source_campaign_id IN (pg + children)). The
-- cockpit already runs this on every page load via the source_campaign_ids
-- filter; the distribution endpoint runs it three more times. The table
-- grows with prospect volume, so without an index every tree resolution
-- is a sequential scan — exactly the large-PG case the dedicated endpoint
-- exists to serve.
--
-- NOTE: mkt_campaigns_list.parent_campaign_id needs NO new index here —
-- migration 138 already created idx_mkt_campaigns_parent as a PARTIAL
-- index (WHERE parent_campaign_id IS NOT NULL), which serves every
-- tree-resolution query (they only ever match non-null parents). Prisma
-- cannot model partial indexes, so it intentionally does not appear in
-- schema.prisma — do not re-add it; db pull will drop it every time.
--
-- After running: cd apps/api && npx prisma db pull && npx prisma generate
-- (schema.prisma is updated in the same commit to stay in sync).
--
-- Idempotent (IF NOT EXISTS).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_mpq_source_campaign
  ON mkt_prospect_queue (source_campaign_id);

COMMIT;
