-- ============================================================
-- Migration 128: Marketing Ops — Campaign Journey Module
--
-- Creates 11 tables for the local marketing operations admin module:
--   1. mkt_campaigns_list              — Campaign records (pipeline tracking)
--   2. mkt_audits_list                 — Per-platform audit data per campaign
--   3. mkt_stage_history_list          — Stage transition audit trail
--   4. mkt_files_list                  — File attachment metadata
--   5. mkt_prompt_templates_list       — Versioned prompt templates
--   6. mkt_prompt_executions_list      — AI execution records
--   7. mkt_filter_flags_list           — Quality filter flags per execution
--   8. mkt_scorecards_list             — Daily scorecard entries
--   9. mkt_deliverable_templates_list  — jsPDF layout templates (v3)
--  10. mkt_deliverables_list           — Generated deliverable records (v3)
--  11. mkt_branding_config             — Operator branding settings (v3)
--
-- Also seeds:
--   - marketing_ops capability type + 6 feature keys
--   - capability_features_list links
--   - tier_features_list assignments (all tiers get _enabled=true, _disabled=false)
--   - navigation_links sidebar entry
--
-- Platform conventions applied:
--   - VARCHAR(255) primary keys (not UUID)
--   - _list suffix for entity tables
--   - Money as INTEGER cents (_cents suffix)
--   - FK to users(id) as TEXT
--   - RLS policies on all tables
--   - updated_at triggers on all tables with updated_at
--   - IF NOT EXISTS / ON CONFLICT DO NOTHING for idempotency
--
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list, navigation_links,
--                users tables must exist
-- Date: 2026-07-28
-- ============================================================


-- ============================================================
-- STEP 1: Create mkt_campaigns_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_campaigns_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mcamp-{nanoid}
  display_id            VARCHAR(20)   UNIQUE,               -- AUS-AD-001 (human-readable, nullable)
  business_name         VARCHAR(255)  NOT NULL,
  category              VARCHAR(100)  NOT NULL,
  city                  VARCHAR(100)  NOT NULL,
  neighborhood          VARCHAR(100),
  contact_method        VARCHAR(50),                        -- email, dm, walk_in
  contact_info          VARCHAR(255),

  -- Audit snapshot (denormalized for quick filtering)
  gbp_claimed           BOOLEAN       NOT NULL DEFAULT false,
  unaddressed_reviews   INT           NOT NULL DEFAULT 0,
  last_review_date      DATE,
  has_website           VARCHAR(20),                        -- working, broken, none
  nap_consistent        BOOLEAN,
  estimated_tier        VARCHAR(20),                        -- tier_1, tier_2, tier_3
  estimated_fee_cents   INT           NOT NULL DEFAULT 0,
  pain_score            INT           NOT NULL DEFAULT 0,

  -- Campaign journey tracking
  stage                 VARCHAR(50)   NOT NULL DEFAULT 'seek',
  stage_entered_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  date_entered          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  date_preview_built    TIMESTAMPTZ,
  date_shown            TIMESTAMPTZ,
  date_paid             TIMESTAMPTZ,
  date_delivered        TIMESTAMPTZ,
  date_retainer_pitched TIMESTAMPTZ,
  date_retainer_won     TIMESTAMPTZ,

  -- Financial tracking
  package_delivered     TEXT,
  amount_paid_cents     INT           NOT NULL DEFAULT 0,
  retainer_status       VARCHAR(50)   NOT NULL DEFAULT 'not_pitched', -- not_pitched, pitched, won, declined
  retainer_amount_cents INT           NOT NULL DEFAULT 0,
  retainer_start_date   DATE,

  -- Metadata
  notes                 TEXT,
  assigned_to           TEXT,                               -- REFERENCES users(id) (nullable = shared pool)
  created_by            TEXT,                               -- REFERENCES users(id)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_stage ON mkt_campaigns_list(stage);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_category ON mkt_campaigns_list(category);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_city ON mkt_campaigns_list(city);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_assigned ON mkt_campaigns_list(assigned_to);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_dates ON mkt_campaigns_list(date_entered, date_paid);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_display_id ON mkt_campaigns_list(display_id);


-- ============================================================
-- STEP 2: Create mkt_audits_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_audits_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- maud-{nanoid}
  campaign_id           VARCHAR(255)  NOT NULL,
  platform              VARCHAR(50)   NOT NULL,             -- google, yelp, facebook, apple_maps, bing, bbb
  review_count          INT           NOT NULL DEFAULT 0,
  average_rating        DECIMAL(2,1),
  unaddressed_reviews   INT           NOT NULL DEFAULT 0,
  owner_response_rate   INT           NOT NULL DEFAULT 0,
  photo_count           INT           NOT NULL DEFAULT 0,
  claimed               BOOLEAN       NOT NULL DEFAULT false,
  active_page           BOOLEAN       NOT NULL DEFAULT false,
  has_booking           BOOLEAN       NOT NULL DEFAULT false,
  has_contact_form      BOOLEAN       NOT NULL DEFAULT false,
  mobile_friendly       BOOLEAN,
  audit_data            JSONB,                              -- flexible platform-specific fields
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_audits_campaign FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_audits_campaign ON mkt_audits_list(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_audits_platform ON mkt_audits_list(campaign_id, platform);


-- ============================================================
-- STEP 3: Create mkt_stage_history_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_stage_history_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- msh-{nanoid}
  campaign_id           VARCHAR(255)  NOT NULL,
  from_stage            VARCHAR(50),
  to_stage              VARCHAR(50)   NOT NULL,
  changed_by            TEXT,                               -- REFERENCES users(id)
  changed_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes                 TEXT,
  trigger_type          VARCHAR(50)   NOT NULL DEFAULT 'manual', -- manual, automated, system
  CONSTRAINT fk_mkt_stage_history_campaign FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_stage_history_campaign ON mkt_stage_history_list(campaign_id, changed_at DESC);


-- ============================================================
-- STEP 4: Create mkt_files_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_files_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mfile-{nanoid}
  campaign_id           VARCHAR(255)  NOT NULL,
  file_type             VARCHAR(50)   NOT NULL,             -- preview, paid_deliverable, runsheet, invoice, audit_output
  file_name             VARCHAR(255)  NOT NULL,
  storage_path          VARCHAR(500)  NOT NULL,
  file_size             INT,
  mime_type             VARCHAR(100),
  uploaded_by           TEXT,                               -- REFERENCES users(id)
  uploaded_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_files_campaign FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_files_campaign ON mkt_files_list(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_files_type ON mkt_files_list(campaign_id, file_type);


-- ============================================================
-- STEP 5: Create mkt_prompt_templates_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_prompt_templates_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mpt-{nanoid}
  name                  VARCHAR(100)  NOT NULL,
  prompt_type           VARCHAR(50)   NOT NULL,             -- seek, fulfill, filter, retainer, category_analysis, city_analysis
  category              VARCHAR(100),                       -- NULL = generic / all categories
  version               INT           NOT NULL DEFAULT 1,
  body                  TEXT          NOT NULL,
  variables             JSONB,                              -- ["business_name", "city", "category", "voice"]
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  is_default            BOOLEAN       NOT NULL DEFAULT false,
  created_by            TEXT,                               -- REFERENCES users(id)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_prompt_templates_type ON mkt_prompt_templates_list(prompt_type, is_active);
CREATE INDEX IF NOT EXISTS idx_mkt_prompt_templates_category ON mkt_prompt_templates_list(category, is_active);


-- ============================================================
-- STEP 6: Create mkt_prompt_executions_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_prompt_executions_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mpe-{nanoid}
  campaign_id           VARCHAR(255)  NOT NULL,
  template_id           VARCHAR(255),
  variables_used        JSONB,
  raw_output            TEXT,
  filtered_output       TEXT,
  pass_rate             INT,
  flagged_count         INT           NOT NULL DEFAULT 0,
  status                VARCHAR(50)   NOT NULL DEFAULT 'pending', -- pending, filtered, reviewed, delivered, archived
  executed_by           TEXT,                               -- REFERENCES users(id)
  executed_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ai_provider           VARCHAR(50),
  ai_model              VARCHAR(50),
  tokens_used           INT           NOT NULL DEFAULT 0,
  cost_cents            INT           NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_executions_campaign FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_executions_template FOREIGN KEY (template_id) REFERENCES mkt_prompt_templates_list(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mkt_executions_campaign ON mkt_prompt_executions_list(campaign_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_executions_status ON mkt_prompt_executions_list(status);
CREATE INDEX IF NOT EXISTS idx_mkt_executions_template ON mkt_prompt_executions_list(template_id);


-- ============================================================
-- STEP 7: Create mkt_filter_flags_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_filter_flags_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mff-{nanoid}
  execution_id          VARCHAR(255)  NOT NULL,
  response_number       INT,
  failed_checks         JSONB,
  suggested_fix         TEXT,
  human_override        TEXT,
  reviewed_by           TEXT,                               -- REFERENCES users(id)
  reviewed_at           TIMESTAMPTZ,
  status                VARCHAR(50)   NOT NULL DEFAULT 'pending', -- pending, fixed, approved_as_is
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_filter_flags_execution FOREIGN KEY (execution_id) REFERENCES mkt_prompt_executions_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_filter_flags_execution ON mkt_filter_flags_list(execution_id);
CREATE INDEX IF NOT EXISTS idx_mkt_filter_flags_status ON mkt_filter_flags_list(status, created_at DESC);


-- ============================================================
-- STEP 8: Create mkt_scorecards_list table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_scorecards_list (
  id                      VARCHAR(255)  PRIMARY KEY,        -- msc-{nanoid}
  user_id                 TEXT,                             -- REFERENCES users(id)
  date                    DATE          NOT NULL,
  category_focus          VARCHAR(100),
  neighborhood_focus      VARCHAR(100),
  previews_built          INT           NOT NULL DEFAULT 0,
  previews_shown          INT           NOT NULL DEFAULT 0,
  packages_paid           INT           NOT NULL DEFAULT 0,
  packages_delivered      INT           NOT NULL DEFAULT 0,
  revenue_collected_cents INT           NOT NULL DEFAULT 0,
  retainers_pitched       INT           NOT NULL DEFAULT 0,
  retainers_won           INT           NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mkt_scorecards_date ON mkt_scorecards_list(date DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_scorecards_user ON mkt_scorecards_list(user_id, date DESC);


-- ============================================================
-- STEP 9: Create mkt_deliverable_templates_list table (v3)
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_deliverable_templates_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mdt-{nanoid}
  name                  VARCHAR(100)  NOT NULL,
  deliverable_type      VARCHAR(50)   NOT NULL,             -- review_responses, service_menu, gbp_audit, testimonial_cards, nap_report, seo_content, lead_magnet
  category              VARCHAR(100),                       -- NULL = all categories
  version               INT           NOT NULL DEFAULT 1,
  layout_spec           JSONB         NOT NULL,             -- jsPDF-compatible layout spec (sections, fonts, colors, positioning)
  page_size             VARCHAR(20)   NOT NULL DEFAULT 'letter',
  orientation           VARCHAR(20)   NOT NULL DEFAULT 'portrait',
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  is_default            BOOLEAN       NOT NULL DEFAULT false,
  created_by            TEXT,                               -- REFERENCES users(id)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_deliverable_templates_type ON mkt_deliverable_templates_list(deliverable_type, is_active);
CREATE INDEX IF NOT EXISTS idx_mkt_deliverable_templates_default ON mkt_deliverable_templates_list(deliverable_type, is_default) WHERE is_default = true;


-- ============================================================
-- STEP 10: Create mkt_deliverables_list table (v3)
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_deliverables_list (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mdlv-{nanoid}
  campaign_id           VARCHAR(255)  NOT NULL,
  execution_id          VARCHAR(255),
  template_id           VARCHAR(255),
  deliverable_type      VARCHAR(50)   NOT NULL,
  status                VARCHAR(50)   NOT NULL,             -- preview, paid, archived
  file_name             VARCHAR(255)  NOT NULL,
  storage_path          VARCHAR(500)  NOT NULL,
  file_size             INT,
  mime_type             VARCHAR(100)  NOT NULL DEFAULT 'application/pdf',
  is_watermarked        BOOLEAN       NOT NULL DEFAULT false,
  branding_applied      JSONB,                              -- {logo_url, primary_color, accent_color, operator_name}
  generated_by          TEXT,                               -- REFERENCES users(id)
  generated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  sent_at               TIMESTAMPTZ,
  sent_method           VARCHAR(50),                        -- email, dm, in_person, link
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_deliverables_campaign FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_deliverables_execution FOREIGN KEY (execution_id) REFERENCES mkt_prompt_executions_list(id) ON DELETE SET NULL,
  CONSTRAINT fk_mkt_deliverables_template FOREIGN KEY (template_id) REFERENCES mkt_deliverable_templates_list(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mkt_deliverables_campaign ON mkt_deliverables_list(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_deliverables_status ON mkt_deliverables_list(status);
CREATE INDEX IF NOT EXISTS idx_mkt_deliverables_type ON mkt_deliverables_list(deliverable_type);


-- ============================================================
-- STEP 11: Create mkt_branding_config table (v3)
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_branding_config (
  id                    VARCHAR(255)  PRIMARY KEY,          -- mbcfg-{nanoid}
  operator_name         VARCHAR(255)  NOT NULL,
  operator_logo_url     TEXT,
  primary_color         VARCHAR(20)   NOT NULL DEFAULT '#111827',
  accent_color          VARCHAR(20)   NOT NULL DEFAULT '#3B82F6',
  text_color            VARCHAR(20)   NOT NULL DEFAULT '#1F2937',
  font_family           VARCHAR(100),
  footer_disclaimer     TEXT,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Only one active config row
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_branding_config_active ON mkt_branding_config(is_active) WHERE is_active = true;


-- ============================================================
-- STEP 12: updated_at triggers for all tables with updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_mkt_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_campaigns_updated_at ON mkt_campaigns_list;
CREATE TRIGGER trg_mkt_campaigns_updated_at
  BEFORE UPDATE ON mkt_campaigns_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_campaigns_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_audits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_audits_updated_at ON mkt_audits_list;
CREATE TRIGGER trg_mkt_audits_updated_at
  BEFORE UPDATE ON mkt_audits_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_audits_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_files_updated_at ON mkt_files_list;
CREATE TRIGGER trg_mkt_files_updated_at
  BEFORE UPDATE ON mkt_files_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_files_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_prompt_templates_updated_at ON mkt_prompt_templates_list;
CREATE TRIGGER trg_mkt_prompt_templates_updated_at
  BEFORE UPDATE ON mkt_prompt_templates_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_prompt_templates_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_prompt_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_prompt_executions_updated_at ON mkt_prompt_executions_list;
CREATE TRIGGER trg_mkt_prompt_executions_updated_at
  BEFORE UPDATE ON mkt_prompt_executions_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_prompt_executions_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_filter_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_filter_flags_updated_at ON mkt_filter_flags_list;
CREATE TRIGGER trg_mkt_filter_flags_updated_at
  BEFORE UPDATE ON mkt_filter_flags_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_filter_flags_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_scorecards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_scorecards_updated_at ON mkt_scorecards_list;
CREATE TRIGGER trg_mkt_scorecards_updated_at
  BEFORE UPDATE ON mkt_scorecards_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_scorecards_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_deliverable_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_deliverable_templates_updated_at ON mkt_deliverable_templates_list;
CREATE TRIGGER trg_mkt_deliverable_templates_updated_at
  BEFORE UPDATE ON mkt_deliverable_templates_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_deliverable_templates_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_deliverables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_deliverables_updated_at ON mkt_deliverables_list;
CREATE TRIGGER trg_mkt_deliverables_updated_at
  BEFORE UPDATE ON mkt_deliverables_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_deliverables_updated_at();

CREATE OR REPLACE FUNCTION update_mkt_branding_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_branding_config_updated_at ON mkt_branding_config;
CREATE TRIGGER trg_mkt_branding_config_updated_at
  BEFORE UPDATE ON mkt_branding_config
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_branding_config_updated_at();


-- ============================================================
-- STEP 13: RLS Policies
-- ============================================================
-- All tables are admin-only (platform admin sees all).
-- No tenant-scoped policies — this is a platform admin module.

-- mkt_campaigns_list: admin-only CRUD
ALTER TABLE mkt_campaigns_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_campaigns_admin_all ON mkt_campaigns_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_campaigns_service_write ON mkt_campaigns_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_audits_list: admin-only CRUD
ALTER TABLE mkt_audits_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_audits_admin_all ON mkt_audits_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_audits_service_write ON mkt_audits_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_stage_history_list: admin-only CRUD
ALTER TABLE mkt_stage_history_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_stage_history_admin_all ON mkt_stage_history_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_stage_history_service_write ON mkt_stage_history_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_files_list: admin-only CRUD
ALTER TABLE mkt_files_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_files_admin_all ON mkt_files_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_files_service_write ON mkt_files_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_prompt_templates_list: admin-only CRUD
ALTER TABLE mkt_prompt_templates_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_prompt_templates_admin_all ON mkt_prompt_templates_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_prompt_templates_service_write ON mkt_prompt_templates_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_prompt_executions_list: admin-only CRUD
ALTER TABLE mkt_prompt_executions_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_prompt_executions_admin_all ON mkt_prompt_executions_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_prompt_executions_service_write ON mkt_prompt_executions_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_filter_flags_list: admin-only CRUD
ALTER TABLE mkt_filter_flags_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_filter_flags_admin_all ON mkt_filter_flags_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_filter_flags_service_write ON mkt_filter_flags_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_scorecards_list: admin-only CRUD
ALTER TABLE mkt_scorecards_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_scorecards_admin_all ON mkt_scorecards_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_scorecards_service_write ON mkt_scorecards_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_deliverable_templates_list: admin-only CRUD
ALTER TABLE mkt_deliverable_templates_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_deliverable_templates_admin_all ON mkt_deliverable_templates_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_deliverable_templates_service_write ON mkt_deliverable_templates_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_deliverables_list: admin-only CRUD
ALTER TABLE mkt_deliverables_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_deliverables_admin_all ON mkt_deliverables_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_deliverables_service_write ON mkt_deliverables_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mkt_branding_config: admin-only CRUD
ALTER TABLE mkt_branding_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_branding_config_admin_all ON mkt_branding_config
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_branding_config_service_write ON mkt_branding_config
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- STEP 14: Seed marketing_ops feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('marketing_ops_enabled',          'Marketing Ops Enabled',          'Master ON gate for marketing ops module',                'marketing_ops', true, 0, NOW(), NOW()),
  ('marketing_ops_disabled',         'Marketing Ops Disabled',         'Explicit deactivation gate for marketing ops',           'marketing_ops', true, 1, NOW(), NOW()),
  ('marketing_ops_prompt_execution', 'Direct AI Prompt Execution',     'In-platform AI prompt execution via AIProviderService',  'marketing_ops', true, 2, NOW(), NOW()),
  ('marketing_ops_filter_review',    'Quality Filter Review Queue',    'Review queue for AI output quality flags',               'marketing_ops', true, 3, NOW(), NOW()),
  ('marketing_ops_batch_execution',  'Batch Prompt Execution',         'Execute prompts across multiple campaigns at once',      'marketing_ops', false, 4, NOW(), NOW()),
  ('marketing_ops_revenue_tracking', 'Revenue and Retainer Tracking',  'Track payments, retainer amounts, and revenue metrics',  'marketing_ops', true, 5, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 15: Create marketing_ops capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'marketing_ops',
  'Marketing Ops',
  'Local marketing campaign management — pipeline tracking, prompt execution, deliverable generation, and revenue tracking. Admin-only module.',
  'marketing_ops',
  true,
  27,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 16: Link marketing_ops features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'marketing_ops';
  v_feature_keys         TEXT[] := ARRAY[
    'marketing_ops_enabled',
    'marketing_ops_disabled',
    'marketing_ops_prompt_execution',
    'marketing_ops_filter_review',
    'marketing_ops_batch_execution',
    'marketing_ops_revenue_tracking'
  ];
  v_capability_type_id TEXT;
  v_feature_id TEXT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_feature_keys[i] LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
      CONTINUE;
    END IF;

    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_capability_type_id, v_feature_id, true, i, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true,
      sort_order = i,
      updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1), v_capability_type_key;
END $$;


-- ============================================================
-- STEP 17: Assign tier features
-- ============================================================
-- All tiers get _enabled=true and _disabled=false (admin module, always available).
-- Advanced features (prompt_execution, filter_review, revenue_tracking) enabled for all tiers.
-- Batch execution disabled for all tiers (future feature).

DO $$
DECLARE
  v_cap_type_id   TEXT;
  v_tier_id       TEXT;
  v_tier_key      TEXT;

  v_all_tiers     TEXT[] := ARRAY[
    'discovery', 'starter', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
    'professional', 'enterprise', 'organization',
    'chain_starter', 'chain_professional', 'chain_enterprise',
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise'
  ];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'marketing_ops' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type marketing_ops not found';
  END IF;

  FOREACH v_tier_key IN ARRAY v_all_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'marketing_ops_enabled',          'Marketing Ops Enabled',          true,  false, '{"capability_type": "marketing_ops"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'marketing_ops_disabled',         'Marketing Ops Disabled',         false, false, '{"capability_type": "marketing_ops"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'marketing_ops_prompt_execution', 'Direct AI Prompt Execution',     true,  false, '{"capability_type": "marketing_ops"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'marketing_ops_filter_review',    'Quality Filter Review Queue',    true,  false, '{"capability_type": "marketing_ops"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'marketing_ops_batch_execution',  'Batch Prompt Execution',         false, false, '{"capability_type": "marketing_ops"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'marketing_ops_revenue_tracking', 'Revenue and Retainer Tracking',  true,  false, '{"capability_type": "marketing_ops"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Marketing ops tier features assigned';
END $$;


-- ============================================================
-- STEP 18: Link capability type to a representative tier (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'marketing_ops'
  AND ct.tier_id IS NULL;


-- ============================================================
-- STEP 19: Navigation link
-- ============================================================

INSERT INTO navigation_links (
  id, label, href, icon, badge, badge_variant,
  targets, sort_order, is_enabled, is_divider_before,
  required_permission, required_group, required_role,
  metadata, created_by
)
SELECT
  'marketing-ops',
  'Marketing Ops',
  '/settings/admin/marketing-ops',
  'megaphone',
  '',
  'default',
  ARRAY['admin'],
  50,
  true,
  false,
  'CAN_ADMIN_PLATFORM',
  'IS_PLATFORM_ADMIN',
  'PLATFORM_ADMIN',
  '{"nestingLevel": 0, "parentKey": null, "hasChildren": false, "childrenKeys": []}'::json,
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'marketing-ops');


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify capability type
-- SELECT key, name, description, category, is_active, sort_order FROM capability_type_list WHERE key = 'marketing_ops';

-- Verify features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'marketing_ops' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'marketing_ops'
--   ORDER BY cf.sort_order;

-- Verify tier features for Professional
-- SELECT tf.feature_key, tf.feature_name, tf.is_enabled FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'marketing_ops%'
--   ORDER BY tf.feature_key;

-- Verify tables
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'mkt_%' ORDER BY tablename;

-- Verify RLS
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'mkt_%' ORDER BY tablename;

-- Verify navigation link
-- SELECT id, target, label, href, icon, sort_order, is_active FROM navigation_links WHERE id = 'marketing-ops';
