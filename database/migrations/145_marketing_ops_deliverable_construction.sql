-- ============================================================
-- Migration 145: Marketing Ops — Deliverable Construction
-- ============================================================
-- Description:
--   Post-payment deliverable construction infrastructure:
--     1. mkt_owner_voice_profile — per-campaign owner voice calibration
--        (AI-inferred from existing owner responses, operator-overrideable)
--     2. mkt_deliverable_review_slot — per-review response slot in the
--        deliverable (one row per unanswered review across all platforms)
--     3. mkt_deliverable_section — non-review sections (recovery playbook,
--        listing corrections, CTA/website fixes)
--
--   The preview (pre-payment, 3 review/response pairs) is a subset of
--   the deliverable. Same prompts, same quality gate, same owner voice.
--   When the campaign pays, the workspace expands to all reviews.
--
-- Prerequisite: 141_marketing_ops_review_response_pipeline.sql
-- Date: 2026-07-31
-- ============================================================

-- ─── 1. Owner Voice Profile ─────────────────────────────────────────────
-- One row per campaign. Calibrates all review response drafts so they
-- sound like the owner, not a marketing bot.

CREATE TABLE IF NOT EXISTS mkt_owner_voice_profile (
  id                    VARCHAR(255) PRIMARY KEY,
  campaign_id           VARCHAR(255) UNIQUE NOT NULL,
  person                VARCHAR(10),    -- first_person / third_person / we
  formality             VARCHAR(10),    -- casual / professional / formal
  humor                 VARCHAR(10),    -- none / light / witty
  apology_style         VARCHAR(20),    -- direct_apology / fix_first / acknowledge_and_pivot
  signoff_style         VARCHAR(20),    -- first_name / full_name / title / team / none
  signature             VARCHAR(100),   -- actual signoff text (e.g., "— Sarah, Owner")
  inferred_from_count   INT DEFAULT 0,  -- number of existing responses analyzed (0 = manual)
  inferred_sample       TEXT,           -- sample of responses used for inference
  operator_overrides    JSON DEFAULT '{}', -- fields the operator overrode
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_owner_voice_campaign FOREIGN KEY (campaign_id)
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

-- ─── 2. Deliverable Review Slots ────────────────────────────────────────
-- One row per unanswered review in the deliverable. The preview is the
-- first 3 slots (negative-first cluster); the full deliverable expands
-- to all unanswered reviews.

CREATE TABLE IF NOT EXISTS mkt_deliverable_review_slot (
  id                       VARCHAR(255) PRIMARY KEY,
  deliverable_id           VARCHAR(255),  -- FK to mkt_deliverables_list (nullable until render)
  campaign_id              VARCHAR(255) NOT NULL,
  platform                 VARCHAR(20),   -- google / yelp / facebook
  review_text              TEXT,
  review_rating            INT,           -- 1-5
  review_date              DATE,
  review_author            VARCHAR(100),
  sentiment                VARCHAR(10),   -- positive / neutral / negative
  theme                    VARCHAR(50),   -- theme cluster this review belongs to
  is_negative_first        BOOLEAN DEFAULT FALSE, -- slot 1 in preview (handled 1-star)
  response_text            TEXT,
  response_source          VARCHAR(10),   -- ai / external
  response_ai_provider     VARCHAR(50),
  response_ai_model        VARCHAR(50),
  response_tokens_used     INT DEFAULT 0,
  quality_gate_passed      BOOLEAN,
  quality_gate_issues      TEXT[],
  status                   VARCHAR(20) DEFAULT 'draft', -- draft / approved / skipped
  slot_index               INT DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_review_slot_campaign FOREIGN KEY (campaign_id)
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_slot_deliverable FOREIGN KEY (deliverable_id)
    REFERENCES mkt_deliverables_list(id) ON DELETE CASCADE
);

CREATE INDEX idx_mkt_deliverable_slots_campaign
  ON mkt_deliverable_review_slot(campaign_id, slot_index);
CREATE INDEX idx_mkt_deliverable_slots_status
  ON mkt_deliverable_review_slot(campaign_id, status);

-- ─── 3. Deliverable Sections ────────────────────────────────────────────
-- Non-review-response sections: recovery playbook, listing corrections,
-- CTA/website fixes. Each is generated, quality-gated, and approved
-- independently before render.

CREATE TABLE IF NOT EXISTS mkt_deliverable_section (
  id                    VARCHAR(255) PRIMARY KEY,
  deliverable_id        VARCHAR(255),  -- FK to mkt_deliverables_list (nullable until render)
  campaign_id           VARCHAR(255) NOT NULL,
  section_type          VARCHAR(30),   -- recovery_playbook / listing_corrections / cta_fixes
  title                 VARCHAR(200),
  content               TEXT,
  source                VARCHAR(10),   -- ai / external
  quality_gate_passed   BOOLEAN,
  quality_gate_issues   TEXT[],
  status                VARCHAR(20) DEFAULT 'draft', -- draft / approved / skipped
  section_index         INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_section_campaign FOREIGN KEY (campaign_id)
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_section_deliverable FOREIGN KEY (deliverable_id)
    REFERENCES mkt_deliverables_list(id) ON DELETE CASCADE
);

CREATE INDEX idx_mkt_deliverable_sections_campaign
  ON mkt_deliverable_section(campaign_id, section_index);

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS mkt_deliverable_section;
-- DROP TABLE IF EXISTS mkt_deliverable_review_slot;
-- DROP TABLE IF EXISTS mkt_owner_voice_profile;
