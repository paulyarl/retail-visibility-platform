-- Migration 188: Outreach Intelligence Prep Worksheet
--
-- One worksheet per campaign (1:1). Captures business-published contact
-- context (owner name, business email, team signal, preferred channel)
-- gathered by a human operator after the Business Audit and before
-- outreach begins. The server-computed recommended_salutation feeds
-- Sprint 2's hook library as the {{salutation}} merge field.
--
-- Denormalized columns exist for the fields the platform queries/merges
-- (salutation, channel, confidence); the payload JSONB column is the
-- source of truth and stores the full worksheet record verbatim per the
-- output contract (§4 of the sprint plan).
--
-- Sibling inheritance: the worksheet is gathered once per business
-- prospect. Non-primary siblings read the primary sibling's worksheet
-- via a read-time campaign-id resolution in OutreachIntelligenceService
-- (NOT a DB-level mechanism). Writes to non-primary siblings are rejected
-- with 409 — edit the primary's worksheet.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_outreach_intelligence (
  id                         VARCHAR(255) PRIMARY KEY,
  campaign_id                VARCHAR(255) NOT NULL UNIQUE
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,

  -- Denormalized query/merge columns (derived from payload on save)
  owner_name                 VARCHAR(255),
  owner_name_confidence      VARCHAR(20) NOT NULL DEFAULT 'unavailable',
  business_email             VARCHAR(255),
  business_email_confidence  VARCHAR(20) NOT NULL DEFAULT 'unavailable',
  team_signal                VARCHAR(20) NOT NULL DEFAULT 'unknown',
  preferred_contact_channel  VARCHAR(50),
  recommended_salutation     VARCHAR(255) NOT NULL,
  research_date              DATE,
  prepared_by                VARCHAR(255),

  -- Full worksheet record (sources, quoted descriptions, notes, linked audit ref)
  payload                    JSONB NOT NULL,

  created_at                 TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT chk_oi_owner_conf CHECK (owner_name_confidence IN ('confirmed','inferred_low_risk','unavailable')),
  CONSTRAINT chk_oi_email_conf CHECK (business_email_confidence IN ('confirmed','inferred_low_risk','unavailable')),
  CONSTRAINT chk_oi_team_signal CHECK (team_signal IN ('sole_owner','family_team','small_staff','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_intelligence_campaign
  ON mkt_outreach_intelligence(campaign_id);

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_outreach_intelligence' ORDER BY ordinal_position;

COMMIT;
