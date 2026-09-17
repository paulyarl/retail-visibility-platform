-- Migration 157: Playbook Catalog & Campaign Triage Engine
--
-- Adds the two tables that back the Intelligent Playbook Catalog &
-- Automated Triage Engine: a standardized playbook catalog (PB-01..PB-05)
-- and a per-campaign triage result row that records the engine's
-- recommendation plus the operator's accept/override decision.
--
-- Per docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
-- Sprint 1 — Data Layer.
--
-- Notes:
--   * No RLS: mkt_* tables are platform-admin scoped global tables (no RLS
--     exists on mkt_campaigns_list / mkt_audits_list). The only RLS in the
--     repo is on product_queue (tenant-scoped).
--   * No DB triggers: updated_at is managed by Prisma @updatedAt in app code.
--   * After running: cd apps/api && npx prisma db pull && npx prisma generate.

-- ─── mkt_playbook_catalog ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mkt_playbook_catalog (
  id                        VARCHAR(255) PRIMARY KEY,
  code                      VARCHAR(20)  NOT NULL UNIQUE,
  name                      VARCHAR(255) NOT NULL,
  category                  VARCHAR(30)  NOT NULL,
  archetype                 VARCHAR(20)  NOT NULL,
  archetype_label           VARCHAR(40)  NOT NULL,
  description               TEXT,
  matching_rules            JSONB        NOT NULL DEFAULT '{}',
  fitd_offer_title          VARCHAR(255) NOT NULL,
  fitd_default_fee_cents    INT          NOT NULL DEFAULT 0,
  retainer_pitch_title      VARCHAR(255) NOT NULL,
  retainer_fee_cents        INT          NOT NULL DEFAULT 0,
  opener_prompt_template_id VARCHAR(255),
  preview_deliverable_type  VARCHAR(50),
  is_active                 BOOLEAN      NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Guard: category must be a known campaign category
ALTER TABLE mkt_playbook_catalog
  DROP CONSTRAINT IF EXISTS chk_playbook_category;

ALTER TABLE mkt_playbook_catalog
  ADD CONSTRAINT chk_playbook_category
  CHECK (category IN ('review_management', 'recovery_management', 'triage_management'));

CREATE INDEX IF NOT EXISTS idx_mkt_playbook_catalog_code
  ON mkt_playbook_catalog (code);
CREATE INDEX IF NOT EXISTS idx_mkt_playbook_catalog_active
  ON mkt_playbook_catalog (is_active);

COMMENT ON TABLE  mkt_playbook_catalog IS 'Standardized playbooks the triage engine recommends; platform-admin managed catalog';
COMMENT ON COLUMN mkt_playbook_catalog.code IS 'Stable human-readable code, e.g. PB-01..PB-05';
COMMENT ON COLUMN mkt_playbook_catalog.category IS 'review_management | recovery_management | triage_management (mirrors mkt_campaigns_list.campaign_category)';
COMMENT ON COLUMN mkt_playbook_catalog.archetype IS 'A1..A5 archetype code (drives opener prompt selection)';
COMMENT ON COLUMN mkt_playbook_catalog.archetype_label IS 'Spec-style label, e.g. A5_DUAL_TRIAGE';
COMMENT ON COLUMN mkt_playbook_catalog.matching_rules IS 'JSON rule criteria used by TriageEngineService (signals, priority, requireBoth, requiresBbb)';
COMMENT ON COLUMN mkt_playbook_catalog.fitd_default_fee_cents IS 'Default foot-in-the-door offer fee in cents';
COMMENT ON COLUMN mkt_playbook_catalog.retainer_fee_cents IS 'Default retainer fee in cents';
COMMENT ON COLUMN mkt_playbook_catalog.opener_prompt_template_id IS 'Nullable metadata only (Option A) — opener prompts are keyed by archetype in code, not DB templates';
COMMENT ON COLUMN mkt_playbook_catalog.preview_deliverable_type IS 'Deliverable type to preview when the playbook is accepted';

-- ─── mkt_campaign_triage_results ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mkt_campaign_triage_results (
  id                      VARCHAR(255)  PRIMARY KEY,
  campaign_id             VARCHAR(255)  NOT NULL UNIQUE,
  recommended_playbook_id VARCHAR(255)  NOT NULL,
  confidence_score        NUMERIC(4,3)  NOT NULL,
  triage_reasoning        TEXT,
  detected_signals        JSONB         NOT NULL DEFAULT '[]',
  is_operator_accepted    BOOLEAN,
  overridden_playbook_id  VARCHAR(255),
  evaluated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_campaign_triage_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_triage_playbook
    FOREIGN KEY (recommended_playbook_id) REFERENCES mkt_playbook_catalog(id),
  CONSTRAINT fk_campaign_triage_override_playbook
    FOREIGN KEY (overridden_playbook_id) REFERENCES mkt_playbook_catalog(id)
);

-- Guard: confidence_score is a proxy for rule specificity/severity (NOT ML
-- probability). UI must label it "Rule Confidence" / "Signal Match Strength".
ALTER TABLE mkt_campaign_triage_results
  DROP CONSTRAINT IF EXISTS chk_triage_confidence;

ALTER TABLE mkt_campaign_triage_results
  ADD CONSTRAINT chk_triage_confidence
  CHECK (confidence_score >= 0 AND confidence_score <= 1);

CREATE INDEX IF NOT EXISTS idx_mkt_campaign_triage_campaign
  ON mkt_campaign_triage_results (campaign_id);

COMMENT ON TABLE  mkt_campaign_triage_results IS 'Per-campaign triage recommendation + operator accept/override decision (one row per campaign)';
COMMENT ON COLUMN mkt_campaign_triage_results.confidence_score IS 'Rule specificity/severity proxy 0.000–1.000 (NOT ML probability — UI must label "Rule Confidence")';
COMMENT ON COLUMN mkt_campaign_triage_results.detected_signals IS 'JSON array of signals that fired during evaluation';
COMMENT ON COLUMN mkt_campaign_triage_results.is_operator_accepted IS 'NULL = pending, true = accepted, false = overridden (overridden_playbook_id populated)';
COMMENT ON COLUMN mkt_campaign_triage_results.overridden_playbook_id IS 'Playbook the operator chose instead of the recommendation (only when is_operator_accepted = false)';

-- ─── Seed: 5 standard playbooks ──────────────────────────────────────────
-- Priority order matches the spec's deterministic cascade:
--   Rule 1 (PB-04) > Rule 2 (PB-05) > Rule 3 (PB-01) > Rule 4 (PB-02) > Rule 5 (PB-03)
--
-- PB-01: Profile Repair & Listing Drift  (A3, review_management)
-- PB-02: Review Gap & Acceleration       (A1, review_management)
-- PB-03: Website CTA & Friction Repair   (A4, review_management)
-- PB-04: Admin Neglect (BBB Recovery)    (A2, recovery_management)  — highest priority
-- PB-05: Multi-Signal Footprint Triage   (A5, triage_management)
INSERT INTO mkt_playbook_catalog (id, code, name, category, archetype, archetype_label, description, matching_rules, fitd_offer_title, fitd_default_fee_cents, retainer_pitch_title, retainer_fee_cents, opener_prompt_template_id, preview_deliverable_type, is_active)
VALUES
  ('pbk-seed-pb01', 'PB-01', 'Profile Repair & Listing Drift', 'review_management', 'A3', 'A3_LISTING_DRIFT',
   'NAP inconsistency or listing drift with no review-volume crisis. Foot-in-the-door: citation & profile alignment.',
   '{"rule":"PB-01","signals":["napInconsistent","urlMismatch","hasDeadUrl"],"priority":3}'::jsonb,
   '$149 One-Time Citation & Profile Alignment', 14900,
   '$199/mo Listing & Search Defense', 19900,
   NULL, 'profile_repair_preview', true),
  ('pbk-seed-pb02', 'PB-02', 'Review Gap & Acceleration', 'review_management', 'A1', 'A1_REVIEW_GAP',
   'Pure review-volume / response gap with no recurring-theme negatives and no listing drift.',
   '{"rule":"PB-02","signals":["daysSinceLastReview","unaddressedReviewCount"],"priority":4}'::jsonb,
   '$99 One-Time Review Jumpstart Pack', 9900,
   '$199/mo Automated Review Engine', 19900,
   NULL, 'review_jumpstart_preview', true),
  ('pbk-seed-pb03', 'PB-03', 'Website CTA & Friction Repair', 'review_management', 'A4', 'A4_CTA_GAP',
   'Fallback: website conversion / CTA friction when no review or listing signal fires.',
   '{"rule":"PB-03","signals":["hasCtaFriction"],"priority":5}'::jsonb,
   '$199 Conversion Audit & Contact Fix', 19900,
   '$299/mo Conversion Optimization', 29900,
   NULL, 'conversion_audit_preview', true),
  ('pbk-seed-pb04', 'PB-04', 'Admin Neglect (BBB Recovery)', 'recovery_management', 'A2', 'A2_NEGATIVE_RECOVERY',
   'BBB emergency recovery: low BBB grade or unanswered BBB complaints. Highest priority. Requires manual BBB input (no automated BBB source yet).',
   '{"rule":"PB-04","signals":["bbbGrade","unansweredBbbComplaints"],"priority":1,"requiresBbb":true}'::jsonb,
   '$349 Dispute Settlement Package', 34900,
   '$399/mo Brand Risk & BBB Shield', 39900,
   NULL, 'dispute_settlement_preview', true),
  ('pbk-seed-pb05', 'PB-05', 'Multi-Signal Footprint Triage', 'triage_management', 'A5', 'A5_DUAL_TRIAGE',
   'Both repair (NAP/website) and review-gap signals present. Dual-track triage.',
   '{"rule":"PB-05","signals":["napInconsistent","hasDeadUrl","daysSinceLastReview","unaddressedReviewCount"],"priority":2,"requireBoth":["repair","review"]}'::jsonb,
   '$249 Complete Digital Footprint Repair', 24900,
   '$299/mo Full Reputation & Local SEO Retainer', 29900,
   NULL, 'footprint_repair_preview', true)
ON CONFLICT (code) DO NOTHING;
