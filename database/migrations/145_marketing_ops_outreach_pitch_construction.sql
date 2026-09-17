-- ============================================================
-- Migration 145: Marketing Ops — Outreach Pitch Construction
-- ============================================================
-- Description:
--   Creates 4 tables for the Pitch Construction layer built on top
--   of the Outreach Opener workspace. Each copy component (header,
--   closer, contact) is a variation-bearing entity mirroring
--   mkt_outreach_openers_list, enabling split-testing of header /
--   closer / contact combinations against the same opener + preview.
--   The pitches table assembles one full pitch from a selected
--   variant of each component plus 3 review/response pairs (stored
--   as JSON evidence on the pitch row).
--
--   Tables:
--     mkt_outreach_headers_list   — subject-line variants (dual AI/Import)
--     mkt_outreach_closers_list   — closer-line variants (dual AI/Import)
--     mkt_outreach_contacts_list  — optional contact footer variants (free-text)
--     mkt_outreach_pitches_list   — assembled pitch record (one row per pitch)
--
--   See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md
-- Prerequisite: 142_marketing_ops_outreach_openers.sql applied
-- Date: 2026-07-31
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Headers (subject-line variants)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mkt_outreach_headers_list (
  id                        VARCHAR(255)  PRIMARY KEY,             -- moh-{nanoid}
  campaign_id               VARCHAR(255)  NOT NULL,
  header_text               TEXT,
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
  CONSTRAINT fk_mkt_outreach_headers_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_headers_campaign
  ON mkt_outreach_headers_list(campaign_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_headers_source
  ON mkt_outreach_headers_list(source);

-- ────────────────────────────────────────────────────────────
-- 2. Closers (closer-line variants)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mkt_outreach_closers_list (
  id                        VARCHAR(255)  PRIMARY KEY,             -- moc-{nanoid}
  campaign_id               VARCHAR(255)  NOT NULL,
  closer_text               TEXT,
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
  CONSTRAINT fk_mkt_outreach_closers_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_closers_campaign
  ON mkt_outreach_closers_list(campaign_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_closers_source
  ON mkt_outreach_closers_list(source);

-- ────────────────────────────────────────────────────────────
-- 3. Contacts (optional operator footer variants — free-text, no AI gate)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mkt_outreach_contacts_list (
  id                        VARCHAR(255)  PRIMARY KEY,             -- mocc-{nanoid}
  campaign_id               VARCHAR(255)  NOT NULL,
  contact_text              TEXT,
  label                     VARCHAR(100),                          -- operator-facing variant name
  created_by                VARCHAR(255),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_outreach_contacts_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_contacts_campaign
  ON mkt_outreach_contacts_list(campaign_id);

-- ────────────────────────────────────────────────────────────
-- 4. Pitches (assembled pitch record — one row per assembled pitch)
-- ────────────────────────────────────────────────────────────
-- review_pairs JSON shape: array of 3 objects:
--   {
--     "review_text": "...",            -- pasted public customer review
--     "response_text": "...",          -- owner response (AI draft or imported)
--     "response_source": "ai" | "external",
--     "response_ai_provider": "...",   -- nullable
--     "response_ai_model": "...",      -- nullable
--     "response_tokens_used": 0,       -- nullable
--     "is_negative_first": true        -- slot 1 default
--   }
--
--   Cascade rules (authoritative source — this migration):
--     campaign_id, opener_id → ON DELETE CASCADE
--     header_id, closer_id, contact_id → ON DELETE SET NULL
--   Note: prisma db pull may drop the onDelete directives from schema.prisma;
--   the DB constraints below persist regardless. If regenerating migrations
--   from schema.prisma (we don't — raw SQL migrations are the source of truth),
--   re-add onDelete: SetNull on the 3 nullable FKs in the Prisma model.
CREATE TABLE IF NOT EXISTS mkt_outreach_pitches_list (
  id                        VARCHAR(255)  PRIMARY KEY,             -- mopch-{nanoid}
  campaign_id               VARCHAR(255)  NOT NULL,
  opener_id                 VARCHAR(255)  NOT NULL,
  header_id                 VARCHAR(255),                          -- nullable (header optional until selected)
  closer_id                 VARCHAR(255),                          -- nullable
  contact_id                VARCHAR(255),                          -- nullable (contact is optional)
  review_pairs              JSONB,                                 -- array of 3 review/response pair objects
  assembled_text            TEXT,                                  -- rendered full pitch in fixed format
  created_by                VARCHAR(255),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_outreach_pitches_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_outreach_pitches_opener
    FOREIGN KEY (opener_id) REFERENCES mkt_outreach_openers_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_outreach_pitches_header
    FOREIGN KEY (header_id) REFERENCES mkt_outreach_headers_list(id) ON DELETE SET NULL,
  CONSTRAINT fk_mkt_outreach_pitches_closer
    FOREIGN KEY (closer_id) REFERENCES mkt_outreach_closers_list(id) ON DELETE SET NULL,
  CONSTRAINT fk_mkt_outreach_pitches_contact
    FOREIGN KEY (contact_id) REFERENCES mkt_outreach_contacts_list(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_pitches_campaign
  ON mkt_outreach_pitches_list(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_pitches_opener
  ON mkt_outreach_pitches_list(opener_id);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_pitches_header
  ON mkt_outreach_pitches_list(header_id);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_pitches_closer
  ON mkt_outreach_pitches_list(closer_id);

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS mkt_outreach_pitches_list;
-- DROP TABLE IF EXISTS mkt_outreach_contacts_list;
-- DROP TABLE IF EXISTS mkt_outreach_closers_list;
-- DROP TABLE IF EXISTS mkt_outreach_headers_list;
-- DROP INDEX IF EXISTS idx_mkt_outreach_pitches_campaign;
-- DROP INDEX IF EXISTS idx_mkt_outreach_pitches_opener;
-- DROP INDEX IF EXISTS idx_mkt_outreach_pitches_header;
-- DROP INDEX IF EXISTS idx_mkt_outreach_pitches_closer;
-- DROP INDEX IF EXISTS idx_mkt_outreach_contacts_campaign;
-- DROP INDEX IF EXISTS idx_mkt_outreach_closers_campaign;
-- DROP INDEX IF EXISTS idx_mkt_outreach_closers_source;
-- DROP INDEX IF EXISTS idx_mkt_outreach_headers_campaign;
-- DROP INDEX IF EXISTS idx_mkt_outreach_headers_source;
