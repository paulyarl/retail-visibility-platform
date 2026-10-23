-- 356_seek_batch_updated_at.sql
-- Add the missing updated_at column launchBatch's status UPDATE has always
-- referenced. The column was never part of mkt_seek_batches (created in 216,
-- extended in 227/228 without it), so every launch minted its campaigns and
-- then failed the bookkeeping UPDATE — batches stuck in 'draft' with live
-- campaigns attached. First real launch surfaced it.

ALTER TABLE mkt_seek_batches
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

COMMENT ON COLUMN mkt_seek_batches.updated_at IS
  'Last mutation timestamp — set on launch/status transitions.';
