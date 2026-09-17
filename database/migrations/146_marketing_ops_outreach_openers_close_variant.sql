-- ============================================================
-- Migration 146: Marketing Ops — Outreach Openers Close Variant
-- ============================================================
-- Description:
--   Adds a close_variant column to mkt_outreach_openers_list to support
--   split-testing two opener close strategies against reply quality:
--
--     'soft'        — current behavior (ambiguity by design):
--                     "Full deliverable's ready within a day if any of
--                     it's useful."
--                     Optimized for response rate. Lets the operator
--                     introduce payment on the reply.
--
--     'direct_paid' — confident commercial intent up front:
--                     "The full deliverable's a paid engagement, ready
--                     within a day if any of the previews land."
--                     Optimized for reply quality — filters freebie-
--                     seekers immediately, signals confidence, saves
--                     the operator from chasing unqualified replies.
--
--   Nullable: legacy openers (generated before this split-test) remain
--   NULL and are treated as 'soft' by convention. New openers record
--   the variant used so reply outcomes can be measured against the
--   close strategy.
--
--   Additive only — no data loss, no backfill needed.
-- Prerequisite: 142_marketing_ops_outreach_openers.sql applied
-- Date: 2026-07-31
-- ============================================================

ALTER TABLE mkt_outreach_openers_list
  ADD COLUMN IF NOT EXISTS close_variant VARCHAR(20);

-- Index supports split-test analysis: group by close_variant, measure
-- reply / no-reply outcomes per cohort.
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_close_variant
  ON mkt_outreach_openers_list(close_variant);

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- \d mkt_outreach_openers_list
--   -- confirm close_variant column is present, type varchar, nullable
--
-- SELECT close_variant, COUNT(*) AS opener_count
--   FROM mkt_outreach_openers_list
--   GROUP BY close_variant
--   ORDER BY opener_count DESC;
--   -- expect NULL cohort (legacy) + 'soft' + 'direct_paid' cohorts
--     -- once split-test openers are generated
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_close_variant;
-- ALTER TABLE mkt_outreach_openers_list DROP COLUMN IF EXISTS close_variant;
