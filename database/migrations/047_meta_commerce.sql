-- 047: Meta Commerce Integration — OAuth tables for Instagram Shopping + Facebook Shop
-- Mirrors google_oauth_accounts_list + google_oauth_tokens_list pattern

CREATE TABLE IF NOT EXISTS meta_oauth_accounts_list (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  meta_account_id       TEXT NOT NULL,
  email                 TEXT,
  display_name          TEXT,
  profile_picture_url   TEXT,
  business_id           TEXT,
  catalog_id            TEXT,
  instagram_account_id  TEXT,
  scopes                TEXT[] DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_meta_oauth_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_oauth_accounts_tenant_meta
  ON meta_oauth_accounts_list (tenant_id, meta_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_accounts_tenant
  ON meta_oauth_accounts_list (tenant_id);

CREATE TABLE IF NOT EXISTS meta_oauth_tokens_list (
  id                    TEXT PRIMARY KEY,
  account_id            TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  token_type            TEXT NOT NULL DEFAULT 'Bearer',
  expires_at            TIMESTAMPTZ NOT NULL,
  scopes                TEXT[] DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_meta_tokens_account FOREIGN KEY (account_id) REFERENCES meta_oauth_accounts_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meta_tokens_account
  ON meta_oauth_tokens_list (account_id);

-- Enable RLS
ALTER TABLE meta_oauth_accounts_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_oauth_tokens_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies (mirror Google OAuth pattern)
DROP POLICY IF EXISTS "meta_oauth_admin_all" ON meta_oauth_accounts_list;
CREATE POLICY "meta_oauth_admin_all" ON meta_oauth_accounts_list
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = current_setting('request.jwt.claims', true)::json->>'sub' AND users.role = 'PLATFORM_ADMIN'::user_role)
  );

DROP POLICY IF EXISTS "meta_oauth_tenant_own" ON meta_oauth_accounts_list;
CREATE POLICY "meta_oauth_tenant_own" ON meta_oauth_accounts_list
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.tenant_id = meta_oauth_accounts_list.tenant_id
      AND ut.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

DROP POLICY IF EXISTS "meta_tokens_admin_all" ON meta_oauth_tokens_list;
CREATE POLICY "meta_tokens_admin_all" ON meta_oauth_tokens_list
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = current_setting('request.jwt.claims', true)::json->>'sub' AND users.role = 'PLATFORM_ADMIN'::user_role)
  );

DROP POLICY IF EXISTS "meta_tokens_tenant_own" ON meta_oauth_tokens_list;
CREATE POLICY "meta_tokens_tenant_own" ON meta_oauth_tokens_list
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meta_oauth_accounts_list a
      JOIN user_tenants ut ON ut.tenant_id = a.tenant_id
      WHERE a.id = meta_oauth_tokens_list.account_id
      AND ut.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_meta_oauth_accounts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS trg_meta_oauth_accounts_updated_at ON meta_oauth_accounts_list;
CREATE TRIGGER trg_meta_oauth_accounts_updated_at
  BEFORE UPDATE ON meta_oauth_accounts_list
  FOR EACH ROW EXECUTE FUNCTION update_meta_oauth_accounts_updated_at();

CREATE OR REPLACE FUNCTION update_meta_oauth_tokens_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS trg_meta_oauth_tokens_updated_at ON meta_oauth_tokens_list;
CREATE TRIGGER trg_meta_oauth_tokens_updated_at
  BEFORE UPDATE ON meta_oauth_tokens_list
  FOR EACH ROW EXECUTE FUNCTION update_meta_oauth_tokens_updated_at();
