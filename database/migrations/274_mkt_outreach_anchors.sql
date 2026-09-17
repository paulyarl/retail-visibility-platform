-- Migration 274: mkt_outreach_anchors — manual outreach anchors (spec §12.4)
--
-- Operator-controlled outreach thesis layer. A manual anchor gives the
-- operator a focused question to verify during contact without changing
-- the detected archetype.
--
-- Anchor types:
--   identity_verification, address_verification, hours_verification,
--   operating_status_verification, website_or_profile_claim,
--   category_verification, service_verification,
--   customer_discovery_problem, listing_accuracy,
--   seed_claim_invitation, owner_reported_pain, custom
--
-- Lifecycle: draft → active → used → retired
--   draft    — created by operator, not yet used in outreach
--   active   — selected for use in an outreach script/contact
--   used     — recorded in a contact event (anchor_snapshot taken)
--   retired  — no longer available for new contacts

CREATE TABLE IF NOT EXISTS mkt_outreach_anchors (
  id                       varchar(255) PRIMARY KEY,
  seed_id                  varchar(255),
  campaign_id              varchar(255),
  business_prospect_id     varchar(255),
  anchor_type              varchar(50)  NOT NULL,
  status                   varchar(20)  NOT NULL DEFAULT 'draft',
  title                    varchar(255) NOT NULL,
  operator_thesis          text         NOT NULL,
  observed_issue           text,
  evidence_summary         text,
  evidence_refs            jsonb        NOT NULL DEFAULT '[]'::jsonb,
  verification_question    text         NOT NULL,
  pain_question            text,
  recommended_transition   text,
  expected_verification    varchar(30)  NOT NULL DEFAULT 'confirm',
  created_by               varchar(255) NOT NULL,
  activated_by             varchar(255),
  created_at               timestamptz  NOT NULL DEFAULT now(),
  activated_at             timestamptz,
  retired_at               timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_anchors_seed_id
  ON mkt_outreach_anchors (seed_id) WHERE seed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_anchors_campaign_id
  ON mkt_outreach_anchors (campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_anchors_status
  ON mkt_outreach_anchors (status);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_anchors_type
  ON mkt_outreach_anchors (anchor_type);

-- Enforce at least one scope
ALTER TABLE mkt_outreach_anchors
  ADD CONSTRAINT chk_anchor_scope
  CHECK (seed_id IS NOT NULL OR campaign_id IS NOT NULL OR business_prospect_id IS NOT NULL);
