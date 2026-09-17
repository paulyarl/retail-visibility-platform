-- Migration 216: Seek batch tracking + batch_id on campaigns and prospect queue
--
-- Enables multi-city seek operations: one batch creates N campaigns (one per
-- city) with a shared batch_id. Prospect queue entries are tagged with the
-- batch_id for filtering. Seeds link back to the seek batch.

CREATE TABLE IF NOT EXISTS mkt_seek_batches (
  id              VARCHAR(60) PRIMARY KEY,
  batch_slug      VARCHAR(100) NOT NULL UNIQUE,
  profile_id      VARCHAR(64),
  profile_version INT,
  niche_category  VARCHAR(100) NOT NULL,
  cities          TEXT[] NOT NULL DEFAULT '{}',
  campaign_ids    TEXT[] NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by      VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_msb_status ON mkt_seek_batches (status);
CREATE INDEX IF NOT EXISTS idx_msb_profile ON mkt_seek_batches (profile_id);
CREATE INDEX IF NOT EXISTS idx_msb_slug ON mkt_seek_batches (batch_slug);

-- Add batch_id to campaigns for multi-city grouping
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS seek_batch_id VARCHAR(60) REFERENCES mkt_seek_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcl_seek_batch ON mkt_campaigns_list (seek_batch_id);

-- Add batch_id to prospect queue for batch filtering
ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS seek_batch_id VARCHAR(60) REFERENCES mkt_seek_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mpq_seek_batch ON mkt_prospect_queue (seek_batch_id);

-- Add seek_batch_id to directory_presence_seeds for linking seeds to seek batches
ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS seek_batch_id VARCHAR(60) REFERENCES mkt_seek_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dps_seek_batch ON directory_presence_seeds (seek_batch_id);
