-- Migration 370: Social Posting Suite — core tables
--
-- Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §6
--
-- meta_surface_connections  — the platform profile: one row per publishable
--                             Meta surface (facebook_page | instagram |
--                             threads) under a meta_oauth_accounts_list
--                             identity. Each surface carries its own token —
--                             page tokens never expire; Threads tokens are
--                             60-day and refreshed via th_refresh_token.
-- social_posts              — normalized cross-platform post entity. One row
--                             per destination surface; the composer's fan-out
--                             shares batch_id across surfaces.
-- social_media              — post media stored in a PUBLIC Supabase bucket
--                             (getPublicUrl — permanent, Meta-fetchable; the
--                             300s signed gallery-asset URLs are unusable).
-- tenant_social_posting_settings — merchant soft gate (per
--                             add-capability-feature §3; precedent:
--                             tenant_social_commerce_options_settings).

CREATE TABLE IF NOT EXISTS meta_surface_connections (
  id                       VARCHAR(50) PRIMARY KEY,
  meta_oauth_account_id    TEXT NOT NULL REFERENCES meta_oauth_accounts_list(id) ON DELETE CASCADE,
  surface                  VARCHAR(20) NOT NULL,       -- facebook_page | instagram | threads
  target_ref               VARCHAR(64) NOT NULL,       -- page_id | ig_user_id | threads_user_id
  display_name             VARCHAR(255),               -- page name | ig handle | threads username
  access_token_enc         TEXT NOT NULL,              -- encryptToken() format: iv:authTag:ct
  token_expires_at         TIMESTAMPTZ(6),             -- NULL for page tokens; ~60d for threads
  scopes                   VARCHAR[] NOT NULL DEFAULT '{}',
  connected_at             TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE (meta_oauth_account_id, surface, target_ref)
);

CREATE INDEX IF NOT EXISTS idx_meta_surfaces_account ON meta_surface_connections (meta_oauth_account_id);

CREATE TABLE IF NOT EXISTS social_posts (
  id                    VARCHAR(50) PRIMARY KEY,
  tenant_id             VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform              VARCHAR(24) NOT NULL,          -- meta_facebook | meta_instagram | meta_threads | tiktok | linkedin | pinterest | x
  target_ref            VARCHAR(255),                  -- page_id | ig_user_id | threads_user_id | board_id
  surface_connection_id VARCHAR(50) REFERENCES meta_surface_connections(id) ON DELETE SET NULL,
  body                  TEXT NOT NULL,
  link_url              TEXT,
  media                 JSONB,                         -- [{social_media_id, url, type, alt}]
  platform_payload      JSONB,                         -- adapter-specific extras
  status                VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  scheduled_for         TIMESTAMPTZ(6),
  published_at          TIMESTAMPTZ(6),
  remote_post_id        VARCHAR(255),
  permalink             TEXT,
  attempts              INT NOT NULL DEFAULT 0,
  last_error            TEXT,
  publishing_started_at TIMESTAMPTZ(6),
  batch_id              VARCHAR(64),
  recurrence            JSONB,
  created_by            VARCHAR(12) NOT NULL DEFAULT 'tenant',
  approved_by           VARCHAR(50),
  approved_at           TIMESTAMPTZ(6),
  created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_due      ON social_posts (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant   ON social_posts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts (platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_batch    ON social_posts (batch_id);

CREATE TABLE IF NOT EXISTS social_media (
  id            VARCHAR(50) PRIMARY KEY,
  tenant_id     VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storage_path  VARCHAR(500) NOT NULL,                 -- path inside public bucket
  public_url    TEXT NOT NULL,                         -- getPublicUrl — permanent, Meta-fetchable
  mime_type     VARCHAR(100),
  bytes         INT,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_media_tenant ON social_media (tenant_id);

CREATE TABLE IF NOT EXISTS tenant_social_posting_settings (
  id                        VARCHAR(255) PRIMARY KEY,
  tenant_id                 VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  social_posting_enabled    BOOLEAN NOT NULL DEFAULT true,
  social_posting_meta_on    BOOLEAN NOT NULL DEFAULT true,
  social_posting_ig_on      BOOLEAN NOT NULL DEFAULT true,
  social_posting_threads_on BOOLEAN NOT NULL DEFAULT true,
  default_publish_time      VARCHAR(5),                -- 'HH:MM' merchant-local preferred time
  created_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posting_settings_tenant
  ON tenant_social_posting_settings (tenant_id);
