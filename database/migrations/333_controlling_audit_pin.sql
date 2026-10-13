-- 333_controlling_audit_pin.sql
--
-- Operator-pinned "controlling" audit for the project-phase plan.
--
-- Why: the plan's canonical signal set comes from the prospect's latest
-- real business_analysis audit. Audit thoroughness varies run to run — a
-- narrower analyst run silently retracts gaps a thorough run detected
-- (non-emission reads as clearance under latest-wins). The pin lets the
-- operator declare which audit is authoritative for the plan instead of
-- inheriting whichever run happened to land last.
--
-- Semantics: at most ONE audit per prospect group carries
-- is_controlling = true. Uniqueness spans sibling campaigns, so it is
-- enforced in the write path (PUT .../prospects/:id/controlling-audit
-- clears the prospect's audits in the same transaction) rather than a
-- partial unique index, which cannot express the cross-campaign scope.
-- The pin is plan-scoped: only resolveProspectSignals consults it — every
-- other "latest audit" consumer (deliverables, call scripts, openers)
-- keeps latest-wins.
--
-- Idempotent.

BEGIN;

ALTER TABLE mkt_audits_list
  ADD COLUMN IF NOT EXISTS is_controlling boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mkt_audits_controlling
  ON mkt_audits_list (campaign_id)
  WHERE is_controlling;

COMMIT;

-- Verification:
--   SELECT id, campaign_id, platform, is_controlling
--   FROM mkt_audits_list WHERE is_controlling;
