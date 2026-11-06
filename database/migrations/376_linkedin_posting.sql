-- Migration 376: LinkedIn Company Page posting — OAuth + surfaces + feature key
--
-- Spec: docs/LocalBiz/LINKEDIN_POSTING_SPEC.md §5, §4.4
--
-- linkedin_oauth_accounts_list   — the LinkedIn member identity behind a
--                                  tenant's company-page posting. One row per
--                                  (tenant, member sub); carries the member
--                                  access token + optional refresh token.
--                                  Tokens are MEMBER-scoped: one token posts
--                                  to every org page the member administers
--                                  (author URN does the switching) — unlike
--                                  Meta's per-surface page tokens.
-- linkedin_surface_connections   — one row per selected organization page
--                                  (surface='organization_page',
--                                  target_ref='urn:li:organization:{id}').
--                                  No token column — rides the account token.
-- tenant_social_posting_settings — +social_posting_linkedin_on merchant
--                                  soft toggle (defaults ON, same as siblings).
-- features_list                  — +social_posting_linkedin registered and
--                                  linked to the social_posting module.
--                                  Ships DARK (§4.4): flexible expansion emits
--                                  it automatically for *_flexible holders
--                                  (tier rows AND overrides, both MV and
--                                  fetchRawCapabilities paths); explicit
--                                  tier_features_list rows land at GA.

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS linkedin_oauth_accounts_list (
  id                        VARCHAR(50) PRIMARY KEY,
  tenant_id                 VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  linkedin_member_id        VARCHAR(64) NOT NULL,          -- OIDC sub claim
  display_name              VARCHAR(255),
  email                     VARCHAR(255),
  access_token_enc          TEXT NOT NULL,                 -- encryptToken() format: iv:authTag:ct
  refresh_token_enc         TEXT,                          -- nullable: product may not issue one
  token_expires_at          TIMESTAMPTZ(6),                -- ~60d access token
  refresh_token_expires_at  TIMESTAMPTZ(6),                -- ~1yr when issued
  scopes                    VARCHAR[] NOT NULL DEFAULT '{}',
  reauthorization_required  BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, linkedin_member_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_tenant
  ON linkedin_oauth_accounts_list (tenant_id);

CREATE TABLE IF NOT EXISTS linkedin_surface_connections (
  id                        VARCHAR(50) PRIMARY KEY,
  linkedin_oauth_account_id VARCHAR(50) NOT NULL REFERENCES linkedin_oauth_accounts_list(id) ON DELETE CASCADE,
  surface                   VARCHAR(20) NOT NULL DEFAULT 'organization_page',
  target_ref                VARCHAR(64) NOT NULL,          -- urn:li:organization:{id}
  display_name              VARCHAR(255),                  -- page name
  member_role               VARCHAR(40),                   -- ADMINISTRATOR | CONTENT_ADMINISTRATOR | DIRECT_SPONSORED_CONTENT_POSTER
  connected_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE (linkedin_oauth_account_id, surface, target_ref)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_surfaces_account
  ON linkedin_surface_connections (linkedin_oauth_account_id);

-- ============================================================
-- 2. Merchant soft-toggle column
-- ============================================================

ALTER TABLE tenant_social_posting_settings
  ADD COLUMN IF NOT EXISTS social_posting_linkedin_on BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 3. Feature key + module link (ships dark — no tier rows)
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'social_posting_linkedin',
  'LinkedIn Company Page Posting',
  'Publish and schedule posts to administered LinkedIn organization pages',
  'social',
  true,
  13,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

INSERT INTO capability_features_list (capability_type_id, feature_id, is_active)
SELECT ct.id, f.id, true
FROM capability_type_list ct, features_list f
WHERE ct.key = 'social_posting'
  AND f.key = 'social_posting_linkedin'
ON CONFLICT DO NOTHING;
