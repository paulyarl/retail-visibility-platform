-- ──────────────────────────────────────────────────────────────────────────
-- Migration 302: Enable auto-mint for the profile_repair_access intake
--
-- Spec: docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md §6 edge case 8.
--
-- Migration 301 shipped the definition with trigger_stages='[]' so a
-- schema-before-code deploy window could not auto-mint DFY access intakes on
-- DIY campaigns (no trigger_guard evaluator existed yet). This migration
-- flips trigger_stages to ['delivered'] — apply only after the
-- trigger_guard evaluation code is deployed and verified.
--
-- Tandem staging + prod run required per AGENTS.md.
--
-- Rollback:
--   UPDATE mkt_intake_definitions SET trigger_stages='[]'::jsonb
--   WHERE intake_kind='profile_repair_access';
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE mkt_intake_definitions
SET trigger_stages = '["delivered"]'::jsonb,
    updated_at = NOW()
WHERE intake_kind = 'profile_repair_access';

COMMIT;
