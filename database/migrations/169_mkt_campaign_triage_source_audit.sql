-- Migration 169: mkt_campaign_triage_results — source_audit_id tracking
--
-- Records which mkt_audits_list row fed the triage evaluation. This makes the
-- audit→triage lineage visible to operators so they know whether the
-- recommendation was derived from a business_analysis audit, a different
-- audit platform, or campaign columns alone (when source_audit_id IS NULL).
--
-- The triage evaluator loads all audits for a campaign and prefers the latest
-- business_analysis audit. If none exists, it falls back to the latest audit
-- with a top-level detected_signals[] array. If none qualify, auditData is
-- null and signals are derived from campaign columns only.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE mkt_campaign_triage_results
  ADD COLUMN IF NOT EXISTS source_audit_id VARCHAR(255);

-- Soft FK to mkt_audits_list (no CASCADE — triage results should survive
-- audit deletion; the source_audit_id becomes a dangling reference that the
-- app treats as "audit no longer available").
ALTER TABLE mkt_campaign_triage_results
  DROP CONSTRAINT IF EXISTS fk_campaign_triage_source_audit;

ALTER TABLE mkt_campaign_triage_results
  ADD CONSTRAINT fk_campaign_triage_source_audit
    FOREIGN KEY (source_audit_id) REFERENCES mkt_audits_list(id) ON DELETE SET NULL;

COMMENT ON COLUMN mkt_campaign_triage_results.source_audit_id IS 'The mkt_audits_list row whose audit_data fed the signal extractor. NULL = no audit used (signals derived from campaign columns only).';

COMMIT;
