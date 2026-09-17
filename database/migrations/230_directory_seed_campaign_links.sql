-- Migration 230: Directory seed ↔ marketing campaign links
--
-- Bridges the gap between directory_presence_seeds (unclaimed listings
-- published for SEO) and mkt_campaigns_list (operator-validated prospect
-- campaigns). A single physical business may have many sibling campaigns
-- (multi-archetype), so this is a join table — not a 1:1 FK on the seed.
--
-- Linking lets the operator project operator-validated campaign signals
-- (origin country/region, neighborhood, owner voice, directory profiles,
-- reconciled NAP) onto the public-facing seed listing to enrich SEO,
-- with provenance preserved per-field.
--
-- Auto-projection only fires when NAP matches with high confidence; the
-- operator can always trigger a manual sync with a per-field diff.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. directory_seed_campaign_links
-- =============================================================
CREATE TABLE IF NOT EXISTS directory_seed_campaign_links (
  id                   VARCHAR(60)   PRIMARY KEY,
  seed_id              VARCHAR(60)   NOT NULL,
  campaign_id          VARCHAR(255)  NOT NULL,
  tenant_id            VARCHAR(255)  NOT NULL,
  link_role            VARCHAR(20)   NOT NULL DEFAULT 'primary',
  nap_match_confidence VARCHAR(10)   NOT NULL DEFAULT 'medium',
  nap_match_summary    JSONB         NULL,
  last_synced_at       TIMESTAMPTZ   NULL,
  last_sync_fields     TEXT[]        NULL,
  created_by           VARCHAR(255)  NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT fk_dscl_seed FOREIGN KEY (seed_id)
    REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  CONSTRAINT fk_dscl_campaign FOREIGN KEY (campaign_id)
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_dscl_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT chk_dscl_link_role
    CHECK (link_role IN ('primary', 'sibling', 'recovery')),
  CONSTRAINT chk_dscl_nap_confidence
    CHECK (nap_match_confidence IN ('high', 'medium', 'low', 'none'))
);

-- One primary link per seed; siblings/recovery are unrestricted.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dscl_seed_primary
  ON directory_seed_campaign_links (seed_id)
  WHERE link_role = 'primary';

-- Prevent duplicate (seed, campaign) pairs regardless of role.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dscl_seed_campaign
  ON directory_seed_campaign_links (seed_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_dscl_campaign ON directory_seed_campaign_links (campaign_id);
CREATE INDEX IF NOT EXISTS idx_dscl_tenant ON directory_seed_campaign_links (tenant_id);

-- =============================================================
-- 2. New provenance field keys for campaign-sourced signals
-- =============================================================
-- Extends the implicit vocabulary of directory_field_provenance.field_key
-- (no CHECK constraint on that column, so this is documentation only).
--
-- New keys written by DirectorySeedCampaignLinkService.syncFromCampaign:
--   origin_country    — campaign.business_origin_country → keywords
--   origin_region     — campaign.business_origin_region  → keywords
--   neighborhood      — campaign.neighborhood            → keywords
--   description       — synthesized from owner voice / campaign notes
--   directory_profile — link from campaign.directory_profiles JSON
--
-- All campaign-sourced provenance rows use:
--   source_name = 'linked_campaign'
--   source_url  = (admin campaign URL)
--   confidence  = 'high'  (operator-validated)
--   show_on_public = true

COMMIT;
