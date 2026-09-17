-- 075_user_organizations.sql
-- Explicit organization-level roles, decoupled from tenant roles.
-- Replaces the derived model (hero tenant admin = org admin) with explicit roles.
--
-- Org roles: ORG_OWNER, ORG_ADMIN, ORG_MEMBER, ORG_VIEWER
--
-- Idempotent: safe to run on both staging and production.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_organizations (
  id              VARCHAR(255) PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations_list(id) ON DELETE CASCADE,
  role            VARCHAR(50)  NOT NULL DEFAULT 'ORG_MEMBER',
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id
  ON user_organizations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id
  ON user_organizations(organization_id);

CREATE INDEX IF NOT EXISTS idx_user_organizations_role
  ON user_organizations(role);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at_user_orgs()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_user_organizations ON user_organizations;
CREATE TRIGGER set_updated_at_user_organizations
  BEFORE UPDATE ON user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at_user_orgs();

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's user list
-- auth.uid() returns UUID; cast to text to match user_id column type
DROP POLICY IF EXISTS "user_orgs_select_members" ON user_organizations;
CREATE POLICY "user_orgs_select_members" ON user_organizations
  FOR SELECT USING (
    organization_id IN (
      SELECT t.organization_id
      FROM tenants t
      JOIN user_tenants ut ON ut.tenant_id = t.id
      WHERE ut.user_id = auth.uid()::text OR auth.role() = 'service_role'
    )
  );

-- Org admins can write (insert/update/delete)
-- auth.uid() returns UUID; cast to text to match user_id column type
DROP POLICY IF EXISTS "user_orgs_modify_admins" ON user_organizations;
CREATE POLICY "user_orgs_modify_admins" ON user_organizations
  FOR ALL USING (
    -- Platform admins via service_role
    auth.role() = 'service_role'
    OR
    -- User is an org admin of this organization
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      WHERE uo.user_id = auth.uid()::text
        AND uo.role IN ('ORG_OWNER', 'ORG_ADMIN')
    )
  );

-- ─── Seed from existing data ──────────────────────────────────────────────────
-- For each org:
--   1. organizations_list.owner_id → ORG_OWNER
--   2. Hero tenant admins (OWNER/ADMIN role on user_tenants for hero tenant) → ORG_ADMIN

-- Seed ORG_OWNER from organizations_list.owner_id
-- Only insert if the user actually exists in the users table
INSERT INTO user_organizations (id, user_id, organization_id, role)
SELECT
  'uorg-owner-' || o.id,
  o.owner_id::text,
  o.id,
  'ORG_OWNER'
FROM organizations_list o
JOIN users u ON u.id = o.owner_id::text
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations uo
  WHERE uo.user_id = o.owner_id::text AND uo.organization_id = o.id
);

-- Seed ORG_ADMIN from hero tenant admins
-- Hero tenant = tenant where metadata->>'isHeroLocation' = 'true' OR
-- the first tenant in the org (fallback)
-- Only insert if the user actually exists in the users table
INSERT INTO user_organizations (id, user_id, organization_id, role)
SELECT
  'uorg-admin-' || o.id || '-' || ut.user_id::text,
  ut.user_id::text,
  o.id,
  'ORG_ADMIN'
FROM organizations_list o
JOIN tenants t ON t.organization_id = o.id
JOIN user_tenants ut ON ut.tenant_id = t.id
JOIN users u ON u.id = ut.user_id::text
WHERE (t.metadata->>'isHeroLocation' = 'true'
       OR t.id = (SELECT id FROM tenants WHERE organization_id = o.id ORDER BY created_at LIMIT 1))
  AND ut.role IN ('OWNER', 'ADMIN')
  AND ut.user_id::text != o.owner_id::text
  AND NOT EXISTS (
    SELECT 1 FROM user_organizations uo
    WHERE uo.user_id = ut.user_id::text AND uo.organization_id = o.id
  );
