-- Migration 359: Chain Prospecting Feed
-- Spec: docs/LocalBiz/CHAIN_PROSPECTING_FEED_SPEC.md
--
-- The dedup surface resolves every duplicate group to a binary verdict —
-- same_entity (merge + suppress) or distinct (walk away). A third outcome
-- was being thrown away: distinct entities that are ONE business —
-- legitimate multi-location operators surfaced by the same-phone match
-- key. This migration:
--
--   1. Widens mkt_prospect_dedup_verdicts.chk_mpdv_verdict with
--      'distinct_chain' — distinct entities linked as one operator's
--      locations. Clears the funnel gate like 'distinct' (the exclusion
--      join covers all verdicts); merge_into stays NULL.
--   2. directory_chain_groups — the durable chain entity. A verdict row
--      answers "what did the operator decide about this group"; the
--      chain group answers "which seeds are one chain" — joinable (a
--      third location found next month attaches to the existing group)
--      and outliving individual verdict rows.
--   3. directory_chain_group_members — seed → group membership.
--
-- Idempotent throughout (IF EXISTS / IF NOT EXISTS).

BEGIN;

-- ─── 1. Verdict vocabulary ───────────────────────────────────────────────

ALTER TABLE mkt_prospect_dedup_verdicts
  DROP CONSTRAINT IF EXISTS chk_mpdv_verdict;
ALTER TABLE mkt_prospect_dedup_verdicts
  ADD CONSTRAINT chk_mpdv_verdict
  CHECK (verdict IN ('same_entity', 'distinct', 'distinct_chain'));

-- ─── 2. directory_chain_groups ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS directory_chain_groups (
  id              VARCHAR(255) PRIMARY KEY,
  display_name    VARCHAR(255),
  status          VARCHAR(20)  NOT NULL DEFAULT 'candidate',
  confidence      VARCHAR(20)  NOT NULL,
  source_signals  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_dcg_status
    CHECK (status IN ('candidate','confirmed','claimed','org_linked','dismissed')),
  CONSTRAINT chk_dcg_confidence
    CHECK (confidence IN ('chain_confirmed','chain_probable'))
);

-- ─── 3. directory_chain_group_members ────────────────────────────────────

CREATE TABLE IF NOT EXISTS directory_chain_group_members (
  chain_group_id  VARCHAR(255) NOT NULL,
  seed_id         VARCHAR(60)  NOT NULL,
  tenant_id       VARCHAR(255),
  added_by        VARCHAR(255),
  added_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_group_id, seed_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dcgm_group') THEN
    ALTER TABLE directory_chain_group_members
      ADD CONSTRAINT fk_dcgm_group
      FOREIGN KEY (chain_group_id) REFERENCES directory_chain_groups(id);
  END IF;
  IF to_regclass('directory_presence_seeds') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dcgm_seed') THEN
    ALTER TABLE directory_chain_group_members
      ADD CONSTRAINT fk_dcgm_seed
      FOREIGN KEY (seed_id) REFERENCES directory_presence_seeds(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dcgm_seed
  ON directory_chain_group_members (seed_id);
CREATE INDEX IF NOT EXISTS idx_dcg_status
  ON directory_chain_groups (status);

COMMIT;
