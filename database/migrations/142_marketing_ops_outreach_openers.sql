-- ============================================================
-- Migration 142: Marketing Ops — Outreach Openers
-- ============================================================
-- Description:
--   Creates the mkt_outreach_openers_list table for storing
--   personalized first-touch outreach openers generated from
--   campaign business_analysis audit data.
--
--   Each row represents one opener generated via the dual execution
--   path (Path 1: AI execute, Path 2: external import), with:
--     - archetype (A1/A2/A3/A4) from deterministic selection
--     - opener_text (the generated opener)
--     - quality_gate_passed + quality_gate_issues (automated checks)
--     - source ('ai' | 'external')
--     - AI provider/model/tokens/cost (nullable, for Path 1)
--     - extracted_fields (JSON — the fields passed to the prompt,
--       preserving audit provenance)
--
--   Mirrors mkt_prompt_executions_list shape.
-- Prerequisite: 141_marketing_ops_review_response_pipeline.sql applied
-- Date: 2026-07-31
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_outreach_openers_list (
  id                        VARCHAR(255)  PRIMARY KEY,             -- mop-{nanoid}
  campaign_id               VARCHAR(255)  NOT NULL,
  archetype                 VARCHAR(10)   NOT NULL,                -- 'A1' | 'A2' | 'A3' | 'A4'
  opener_text               TEXT,
  quality_gate_passed       BOOLEAN       NOT NULL DEFAULT false,
  quality_gate_issues       JSONB,
  source                    VARCHAR(20)   NOT NULL DEFAULT 'ai',   -- 'ai' | 'external'
  ai_provider               VARCHAR(50),
  ai_model                  VARCHAR(100),
  tokens_used               INT           NOT NULL DEFAULT 0,
  cost_cents                INT           NOT NULL DEFAULT 0,
  extracted_fields          JSONB,
  executed_by               VARCHAR(255),
  executed_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_outreach_openers_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_campaign
  ON mkt_outreach_openers_list(campaign_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_archetype
  ON mkt_outreach_openers_list(archetype);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_source
  ON mkt_outreach_openers_list(source);

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS mkt_outreach_openers_list;
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_campaign;
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_archetype;
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_source;
