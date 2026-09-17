-- Migration 253: GAP-E3 — discovery context handoff onto business campaigns.
--
-- Closes the discovery→audit context cliff: child business campaigns born
-- from intelligence-discovered prospects durably carry the discovery context
-- (signals, provenance, seek priority, category fit, run lineage) so the
-- business analysis audit prompt can render a "Discovery leads" block as
-- verification hypotheses (never as findings — §S1 guardrail preserved).
--
-- Spec: docs/LocalBiz/marketing_ops_discovery_leads_handoff_spec.md
-- Additive only; both columns nullable. No backfill (old children simply
-- have no leads block — byte-identical prompt render).

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS discovery_context  JSONB,
  ADD COLUMN IF NOT EXISTS intelligence_run_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_intelligence_run
  ON mkt_campaigns_list (intelligence_run_id)
  WHERE intelligence_run_id IS NOT NULL;
