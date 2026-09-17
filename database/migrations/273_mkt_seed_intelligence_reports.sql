-- Migration 273: mkt_seed_intelligence_reports — versioned report snapshots
--
-- Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md §12.2
--
-- This is the ONE genuinely new table the spec introduces (§12.1). It stores
-- immutable report version snapshots for reproducibility. The report builder
-- (SeedIntelligenceReportService) writes a new row each time report-visible
-- evidence changes (§5.1 triggers). Metadata-only changes do NOT create a
-- new version (§5.1 non-triggers).
--
-- `report_data` is the immutable SeedIntelligenceReport DTO (§9).
-- `source_snapshot` records prompt/template/source versions (§5.5).
-- `evidence_refs` references existing provenance, audit, signal, outreach,
--   and claim record IDs — it is NOT a second observation store (§12.1).
--
-- Design: the report builder reads from directory_field_provenance,
-- directory_presence_seeds, directory_seed_nap_verifications,
-- directory_seed_outreach_touches, and mkt_signal_registry. This table
-- stores the assembled snapshot so historical reports remain reproducible
-- even if the underlying evidence rows later change.

CREATE TABLE IF NOT EXISTS mkt_seed_intelligence_reports (
  id                    varchar(255) PRIMARY KEY,
  seed_id               varchar(255) NOT NULL,
  version               integer NOT NULL,
  status                varchar(40) NOT NULL,
  report_mode           varchar(30) NOT NULL,
  report_data           jsonb NOT NULL,
  source_snapshot       jsonb NOT NULL,
  evidence_refs         jsonb NOT NULL DEFAULT '[]'::jsonb,
  lint_findings         jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seed_id, version)
);

-- Index for looking up the latest report version for a seed.
CREATE INDEX IF NOT EXISTS idx_mkt_seed_intel_reports_seed
  ON mkt_seed_intelligence_reports (seed_id, version DESC);

-- Index for filtering by status (operator dashboards).
CREATE INDEX IF NOT EXISTS idx_mkt_seed_intel_reports_status
  ON mkt_seed_intelligence_reports (status)
  WHERE status IN ('insufficient_evidence', 'requires_identity_review');

-- Index for published reports (customer-facing queries).
CREATE INDEX IF NOT EXISTS idx_mkt_seed_intel_reports_published
  ON mkt_seed_intelligence_reports (seed_id, version DESC)
  WHERE published_at IS NOT NULL;
