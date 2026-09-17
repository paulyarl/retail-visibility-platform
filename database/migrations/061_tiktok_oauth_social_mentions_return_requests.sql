-- Migration 061: TikTok Shop OAuth, Social Mentions, Return Requests
-- Phase 2B: TikTok Shop Integration
-- Phase 3B: Social Proof / UGC
-- Phase 4B: Customer Returns Portal

-- ============================================================
-- TikTok Shop OAuth Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_oauth_accounts_list (
  id                      VARCHAR(255) PRIMARY KEY,
  tenant_id               VARCHAR(255) NOT NULL,
  tiktok_account_id       VARCHAR(255) NOT NULL,
  email                   VARCHAR(255),
  display_name            VARCHAR(255),
  profile_picture_url     VARCHAR(1000),
  shop_id                 VARCHAR(255),
  shop_name               VARCHAR(255),
  scopes                  TEXT[] DEFAULT '{}',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_tiktok_oauth_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_oauth_accounts_tenant_tiktok
  ON tiktok_oauth_accounts_list (tenant_id, tiktok_account_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_accounts_tenant
  ON tiktok_oauth_accounts_list (tenant_id);

CREATE TABLE IF NOT EXISTS tiktok_oauth_tokens_list (
  id                        VARCHAR(255) PRIMARY KEY,
  account_id                VARCHAR(255) NOT NULL UNIQUE,
  access_token_encrypted    VARCHAR(1000) NOT NULL,
  refresh_token_encrypted   VARCHAR(1000),
  expires_at                TIMESTAMPTZ NOT NULL,
  refresh_expires_at        TIMESTAMPTZ,
  scopes                    TEXT[] DEFAULT '{}',
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_tiktok_tokens_account FOREIGN KEY (account_id) REFERENCES tiktok_oauth_accounts_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tiktok_tokens_account
  ON tiktok_oauth_tokens_list (account_id);

-- ============================================================
-- Social Mentions Table (UGC / Social Proof)
-- ============================================================

CREATE TABLE IF NOT EXISTS social_mentions (
  id                    VARCHAR(255) PRIMARY KEY,
  tenant_id             VARCHAR(255) NOT NULL,
  product_id            VARCHAR(255),
  platform              VARCHAR(50) NOT NULL,
  mention_id            VARCHAR(255) NOT NULL,
  author_username       VARCHAR(255) NOT NULL,
  author_display_name   VARCHAR(255),
  author_avatar_url     VARCHAR(1000),
  content               TEXT NOT NULL,
  media_urls            TEXT[] DEFAULT '{}',
  like_count            INTEGER DEFAULT 0,
  comment_count         INTEGER DEFAULT 0,
  share_count           INTEGER DEFAULT 0,
  view_count            INTEGER DEFAULT 0,
  posted_at             TIMESTAMPTZ NOT NULL,
  moderation_status     VARCHAR(20) DEFAULT 'pending',
  moderated_by          VARCHAR(255),
  moderated_at          TIMESTAMPTZ,
  is_featured           BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_social_mentions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_mentions_platform_mention
  ON social_mentions (platform, mention_id);
CREATE INDEX IF NOT EXISTS idx_social_mentions_tenant_status
  ON social_mentions (tenant_id, moderation_status);
CREATE INDEX IF NOT EXISTS idx_social_mentions_tenant_featured
  ON social_mentions (tenant_id, is_featured, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_mentions_tenant_posted
  ON social_mentions (tenant_id, posted_at DESC);

-- ============================================================
-- Return Requests Table (Customer Returns Portal)
-- ============================================================

CREATE TABLE IF NOT EXISTS return_requests (
  id                    VARCHAR(255) PRIMARY KEY,
  tenant_id             VARCHAR(255) NOT NULL,
  order_id              VARCHAR(255) NOT NULL,
  customer_email        VARCHAR(255) NOT NULL,
  customer_name         VARCHAR(255),
  reason                VARCHAR(50) NOT NULL,
  reason_detail         TEXT,
  items                 JSONB NOT NULL,
  refund_amount_cents   INTEGER DEFAULT 0,
  status                VARCHAR(20) DEFAULT 'requested',
  customer_notes        TEXT,
  admin_notes           TEXT,
  approved_by           VARCHAR(255),
  approved_at           TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_return_requests_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_return_requests_tenant_status
  ON return_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_return_requests_tenant_created
  ON return_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_requests_order
  ON return_requests (order_id);

-- ============================================================
-- Enable RLS on all new tables
-- ============================================================

ALTER TABLE tiktok_oauth_accounts_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_oauth_tokens_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
