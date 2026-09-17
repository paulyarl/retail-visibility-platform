-- Migration 282: mkt_prospect_queue.proving_ground_id — queue-list PG initiation
--
-- Adds a direct queue-entry → proving-ground linkage so an operator can group
-- selected queue rows into a proving ground without an intelligence discovery
-- intermediary (culture-fit §5.5/§6.5). Entries keep source_campaign_id for
-- discovery provenance; proving_ground_id marks PG membership directly.
--
-- Readers use OR semantics across the two columns and dedupe on entry id:
--   OR: [{ source_campaign_id IN treeIds }, { proving_ground_id = pgId }]
--
-- Idempotent (IF NOT EXISTS / guarded).

BEGIN;

ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS proving_ground_id VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mpq_proving_ground'
  ) THEN
    ALTER TABLE mkt_prospect_queue
      ADD CONSTRAINT fk_mpq_proving_ground
      FOREIGN KEY (proving_ground_id) REFERENCES mkt_campaigns_list(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mpq_proving_ground
  ON mkt_prospect_queue (proving_ground_id);

COMMIT;
