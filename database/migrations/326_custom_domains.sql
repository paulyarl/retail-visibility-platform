-- 326_custom_domains.sql
--
-- Custom Domains sprint (docs/CUSTOM_DOMAINS_SPRINT_PLAN.md), Phase 1.1.
-- Tenant-owned domains pointed at the tenant storefront — level 3 of the
-- three-level presentation model (platform path / platform subdomain /
-- tenant domain). Spec: docs/CUSTOM_DOMAINS_FOR_STOREFRONTS.md §5.1/§14.1.1.
--
-- Decisions folded in from the sprint-plan review passes:
--   D4/M7   — one live domain per tenant, enforced by partial unique index
--             (deliberate v1 lock; multi-domain requires dropping it — B6).
--   D9/T-B1 — `domain` holds the LOGICAL ROOT (leading `www.` stripped on
--             write); apex-or-www input = one row, `www.` is never a row.
--   D11/B5  — ON DELETE CASCADE retained; Vercel detach runs in an explicit
--             pre-delete step in each tenant hard-delete path (1.6) — a
--             disabled row alone would still FK-block tenants.delete.
--   H4      — no 'cert_provisioning' status (Vercel exposes no cert state);
--             certificate_status is populated ONLY by our own HTTPS probe.
--   M10     — RLS enabled; tenant + platform-admin policies, NO anon/public
--             policy (writes and reads happen via backend service only).
--   IDs     — app-generated tenant-scoped ids (`cdm-{tenantKey}-{nanoid}`)
--             per .devin/skills/tenant-scoped-id-generation.md; column is
--             VARCHAR(255), not uuid (spec §14.1.1 predates this convention).

CREATE TABLE IF NOT EXISTS custom_domains (
  id                     VARCHAR(255) PRIMARY KEY,
  tenant_id              VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain                 TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'pending_verification'
                         CHECK (status IN (
                           'pending_verification',
                           'verified',
                           'active',
                           'disabled',
                           'error'
                         )),
  verification_token     TEXT,
  vercel_domain_id       TEXT,
  attached_hosts         TEXT[] NOT NULL DEFAULT '{}',
  verification_checked_at TIMESTAMPTZ,
  verification_error     TEXT,
  certificate_status     TEXT, -- probe-derived only (H4) — never set from Vercel
  certificate_error      TEXT,
  is_primary             BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE custom_domains IS
  'Tenant-owned custom domains for level-3 storefront presentation. One row per logical domain (D9): `domain` stores the root with any leading www. stripped — www is derived, never a row. Resolution path is the API resolve-custom-domain endpoint (D5); no public view.';

COMMENT ON COLUMN custom_domains.attached_hosts IS
  'The Vercel project-domain hostnames attached for this logical domain — the detach source of truth (apex rows carry both apex + www, F-B1).';

-- Host lookup for the resolve endpoint (active rows only — filtered in query)
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain
  ON custom_domains (lower(domain));

CREATE INDEX IF NOT EXISTS idx_custom_domains_tenant
  ON custom_domains (tenant_id);

-- Sweeper scan: non-active/non-disabled rows needing re-check
CREATE INDEX IF NOT EXISTS idx_custom_domains_status
  ON custom_domains (status);

-- v1 one-domain cap (D4/M7): at most one non-disabled row per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_domains_tenant_live
  ON custom_domains (tenant_id)
  WHERE status <> 'disabled';

-- updated_at trigger (repo convention: per-table function)
CREATE OR REPLACE FUNCTION update_custom_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_domains_updated_at ON custom_domains;
CREATE TRIGGER custom_domains_updated_at
BEFORE UPDATE ON custom_domains
FOR EACH ROW EXECUTE FUNCTION update_custom_domains_updated_at();

-- RLS (M10): backend service access only — no anon/public policy.
-- Tenant-scoped access mirrors 048_social_pixels conventions; resolution
-- goes through /api/tenants/resolve-custom-domain (service role), not RLS.
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_domains_tenant_all" ON custom_domains;
CREATE POLICY "custom_domains_tenant_all" ON custom_domains
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS "custom_domains_admin_all" ON custom_domains;
CREATE POLICY "custom_domains_admin_all" ON custom_domains
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_setting('app.current_user_id', true)
      AND u.role IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT')
    )
  );

-- Verification queries:
--   SELECT count(*) FROM custom_domains;                        -- table exists
--   SELECT indexname FROM pg_indexes WHERE tablename = 'custom_domains';
--   SELECT polname FROM pg_policies WHERE tablename = 'custom_domains';
