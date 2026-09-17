-- ============================================================
-- Migration 147: Marketing Ops — Outreach Follow-Ups
-- ============================================================
-- Description:
--   Extends mkt_outreach_openers_list to hold follow-up messages
--   alongside openers in the same table, using a nullable
--   message_type discriminator:
--
--     NULL         — opener (implicit default; existing rows unchanged)
--     'follow_up'  — follow-up message (explicit; set at create time)
--
--   The burden of explicitness is on the follow-up workflow. Opener
--   queries filter `WHERE message_type IS DISTINCT FROM 'follow_up'`
--   to exclude follow-ups. Follow-up queries filter
--   `WHERE message_type = 'follow_up'`.
--
--   New columns (all nullable, all NULL for openers):
--     followup_type    VARCHAR(20) — 'doing' | 'telling'
--       Determines the follow-up's structure:
--         'doing'   — footprint changed since opener; follow-up shows
--                     new proof (new reviews, new responses drafted).
--                     Aligns with the opener's showing-not-telling
--                     philosophy.
--         'telling' — footprint unchanged; follow-up reminds the
--                     prospect of existing previews. Fallback when
--                     there's nothing new to show.
--       Selected automatically by the service based on a fresh-snapshot
--       diff against the opener's stored data_snapshot.
--
--     followup_number  INT — 1, 2, 3... (which touch in the sequence)
--       NULL for openers. Increments per campaign for follow-ups.
--
--     opener_id        VARCHAR(255) — self-referential FK to the
--       opener row this follow-up follows up on. NULL for openers.
--       Allows querying a campaign's full message sequence in one pass.
--
--     data_diff        JSON — what changed since the opener (or since
--       the last follow-up). NULL for openers and for 'telling'
--       follow-ups (nothing changed). For 'doing' follow-ups, contains
--       the delta: new review count, new themes, new platforms, etc.
--
--   Compound unique constraint: (campaign_id, message_type, followup_number)
--   ensures a campaign has one opener and follow-ups 1, 2, 3... without
--   collision.
--
--   Additive only — no data loss, no backfill needed. Existing opener
--   rows remain NULL on all new columns.
-- Prerequisite: 142_marketing_ops_outreach_openers.sql applied
-- Date: 2026-07-31
-- ============================================================

-- ============================================================
-- STEP 1: Add follow-up columns
-- ============================================================

ALTER TABLE mkt_outreach_openers_list
  ADD COLUMN IF NOT EXISTS message_type    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS followup_type   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS followup_number INT,
  ADD COLUMN IF NOT EXISTS opener_id       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS data_diff       JSONB;

-- ============================================================
-- STEP 2: Indexes
-- ============================================================

-- Filter openers (message_type IS NULL) vs follow-ups ('follow_up')
-- efficiently. Partial index on follow-ups only — openers are the
-- majority and don't need a partial index (the IS NULL filter is
-- cheap on a small table).
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_followups
  ON mkt_outreach_openers_list(campaign_id, followup_number)
  WHERE message_type = 'follow_up';

-- Self-referential FK lookup: find all follow-ups for a given opener.
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_opener_id
  ON mkt_outreach_openers_list(opener_id)
  WHERE opener_id IS NOT NULL;

-- Follow-up type filter (doing vs telling) for analytics.
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_followup_type
  ON mkt_outreach_openers_list(followup_type)
  WHERE message_type = 'follow_up';

-- ============================================================
-- STEP 3: Self-referential FK constraint
-- ============================================================
-- opener_id references id in the same table. NULL for openers.
-- ON DELETE SET NULL so deleting an opener doesn't cascade-delete
-- its follow-ups (they lose the link but remain for provenance).

ALTER TABLE mkt_outreach_openers_list
  DROP CONSTRAINT IF EXISTS fk_mkt_outreach_openers_opener_ref;
ALTER TABLE mkt_outreach_openers_list
  ADD CONSTRAINT fk_mkt_outreach_openers_opener_ref
  FOREIGN KEY (opener_id) REFERENCES mkt_outreach_openers_list(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================
-- STEP 4: Compound unique constraint
-- ============================================================
-- One opener per campaign (message_type IS NULL) and one follow-up
-- per number per campaign. Enforces sequence integrity.
-- Note: NULLs are distinct in unique constraints, so the opener
-- constraint uses a partial unique index.

CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_outreach_openers_one_per_campaign
  ON mkt_outreach_openers_list(campaign_id)
  WHERE message_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_outreach_followups_per_campaign
  ON mkt_outreach_openers_list(campaign_id, followup_number)
  WHERE message_type = 'follow_up';

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- \d mkt_outreach_openers_list
--   -- confirm new columns: message_type, followup_type,
--   -- followup_number, opener_id, data_diff
--
-- SELECT message_type, COUNT(*) AS cnt
--   FROM mkt_outreach_openers_list
--   GROUP BY message_type;
--   -- expect NULL (existing openers) only until follow-ups are created
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP INDEX IF EXISTS uq_mkt_outreach_followups_per_campaign;
-- DROP INDEX IF EXISTS uq_mkt_outreach_openers_one_per_campaign;
-- ALTER TABLE mkt_outreach_openers_list
--   DROP CONSTRAINT IF EXISTS fk_mkt_outreach_openers_opener_ref;
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_followup_type;
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_opener_id;
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_followups;
-- ALTER TABLE mkt_outreach_openers_list
--   DROP COLUMN IF EXISTS data_diff,
--   DROP COLUMN IF EXISTS opener_id,
--   DROP COLUMN IF EXISTS followup_number,
--   DROP COLUMN IF EXISTS followup_type,
--   DROP COLUMN IF EXISTS message_type;
