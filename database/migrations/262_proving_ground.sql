-- 262_proving_ground.sql
-- Proving Ground Campaign — Phase-0 checklist & outreach sequencing.
-- Spec: docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md
-- Sprint plan: docs/LocalBiz/proving_ground_sprint_plan.md (Phase 1)
--
--   1. mkt_prospect_queue — channel ladder, cadence state, seed linkage,
--      account family; status gains 'hold' + 'in_thread'.
--   2. directory_seed_outreach_touches — channel/outcome CHECKs extended for
--      the full cadence signal taxonomy.
--   3. mkt_playbook_catalog — category CHECK gains 'proving_ground' (PG-01
--      preflight playbook row; filtered out of triage matching app-side).
--   4. mkt_prospect_dedup_verdicts — group-keyed identity ledger.
--
-- Idempotent throughout (IF EXISTS / IF NOT EXISTS). No backfill needed —
-- all new columns are nullable or defaulted.

BEGIN;

-- ─── 1. mkt_prospect_queue ───────────────────────────────────────────────

ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS channel_sequence JSONB NULL,
  ADD COLUMN IF NOT EXISTS current_channel_index SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_touch_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS seed_id VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS account_family VARCHAR(255) NULL;

-- seed_id FK → directory_presence_seeds (cross-family FK precedent:
-- directory_seed_campaign_links already FKs into mkt_campaigns_list).
DO $$
BEGIN
  IF to_regclass('directory_presence_seeds') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mpq_seed')
  THEN
    ALTER TABLE mkt_prospect_queue
      ADD CONSTRAINT fk_mpq_seed
      FOREIGN KEY (seed_id) REFERENCES directory_presence_seeds(id);
  END IF;
END $$;

-- channel_sequence must be an array of rungs when present.
ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_channel_sequence;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_channel_sequence
  CHECK (channel_sequence IS NULL OR jsonb_typeof(channel_sequence) = 'array');

-- status: + hold (touch-cap / nurture park) + in_thread (live conversation —
-- cadence exited; the ladder and thread drive next moves).
ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_status;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_status
  CHECK (status IN (
    'queued', 'verify_then_outreach', 'campaign_created', 'dismissed',
    'hold', 'in_thread'
  ));

CREATE INDEX IF NOT EXISTS idx_mpq_next_touch
  ON mkt_prospect_queue (status, next_touch_at);
CREATE INDEX IF NOT EXISTS idx_mpq_seed
  ON mkt_prospect_queue (seed_id) WHERE seed_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mpq_account_family
  ON mkt_prospect_queue (account_family) WHERE account_family IS NOT NULL;

-- ─── 2. directory_seed_outreach_touches ──────────────────────────────────
-- Canonical touch record — the funnel's `touches`/`cacEstimate` numerator.
-- Postgres names inline column CHECKs {table}_{column}_check.
-- Guarded: migration 259 creates this table — if a target DB hasn't applied
-- it yet, skip rather than hard-fail (the CHECKs get re-applied by a re-run
-- after 259 lands).

DO $$
BEGIN
  IF to_regclass('directory_seed_outreach_touches') IS NOT NULL THEN
    ALTER TABLE directory_seed_outreach_touches
      DROP CONSTRAINT IF EXISTS directory_seed_outreach_touches_channel_check;
    ALTER TABLE directory_seed_outreach_touches
      ADD CONSTRAINT directory_seed_outreach_touches_channel_check
      CHECK (channel IN ('call', 'email', 'sms', 'mail', 'form', 'referral', 'other'));

    ALTER TABLE directory_seed_outreach_touches
      DROP CONSTRAINT IF EXISTS directory_seed_outreach_touches_outcome_check;
    ALTER TABLE directory_seed_outreach_touches
      ADD CONSTRAINT directory_seed_outreach_touches_outcome_check
      CHECK (outcome IN (
        'connected', 'no_response', 'no_answer', 'no_reply', 'voicemail',
        'bad_number', 'bounce', 'unread', 'read_no_reply', 'form_submitted',
        'referral_asked', 'claimed', 'not_interested'
      ));
  ELSE
    RAISE NOTICE 'directory_seed_outreach_touches missing (migration 259 not applied) — skipping CHECK extension';
  END IF;
END $$;

-- ─── 3. mkt_playbook_catalog ─────────────────────────────────────────────
-- 'proving_ground' category lets PG-01 live in the catalog so the checklist
-- system (steps, progress, suggestions, builder tab) works unchanged.
-- Triage candidate exclusion is enforced app-side in
-- CampaignTriageService.loadSignalsAndPlaybooks — catalog UI still lists it.

ALTER TABLE mkt_playbook_catalog
  DROP CONSTRAINT IF EXISTS chk_playbook_category;
ALTER TABLE mkt_playbook_catalog
  ADD CONSTRAINT chk_playbook_category
  CHECK (category IN (
    'review_management', 'recovery_management', 'profile_repair',
    'triage_management', 'proving_ground'
  ));

-- ─── 4. mkt_prospect_dedup_verdicts ──────────────────────────────────────
-- Identity ledger: one row per surfaced duplicate group (seed_ids is the
-- sorted canonical set, matching getCohortFunnel's ARRAY_AGG output), not
-- pairwise — clusters can exceed 2 seeds.

CREATE TABLE IF NOT EXISTS mkt_prospect_dedup_verdicts (
  id           VARCHAR(255) PRIMARY KEY,
  seed_ids     VARCHAR(60)[] NOT NULL,
  match_key    VARCHAR(20)  NOT NULL,
  verdict      VARCHAR(20)  NOT NULL,
  merge_into   VARCHAR(60),
  rationale    TEXT,
  resolved_by  VARCHAR(255),
  resolved_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_mpdv_match_key CHECK (match_key IN ('phone', 'address_city')),
  CONSTRAINT chk_mpdv_verdict   CHECK (verdict IN ('same_entity', 'distinct')),
  CONSTRAINT uq_mpdv_group UNIQUE (seed_ids, match_key)
);

-- merge_into FK added separately so the table still exists on DBs where
-- directory_presence_seeds hasn't been migrated in yet.
DO $$
BEGIN
  IF to_regclass('directory_presence_seeds') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mpdv_merge_into')
  THEN
    ALTER TABLE mkt_prospect_dedup_verdicts
      ADD CONSTRAINT fk_mpdv_merge_into
      FOREIGN KEY (merge_into) REFERENCES directory_presence_seeds(id);
  END IF;
END $$;

COMMIT;
