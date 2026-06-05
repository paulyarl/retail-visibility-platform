-- ============================================================================
-- Navigation Links — Phase 1 SQL Migration
-- Table: navigation_links
-- Purpose: Persists dynamically-configured sidebar links from the Admin
--          Navigation Control Panel (/settings/admin/navigation).
--          Links are tagged with sidebar targets (all / tenant / admin) and
--          RBAC gates (required_permission / required_group / required_role)
--          so each sidebar renders only the links its audience can see.
--
-- Naming standard: snake_case_plural (per DATABASE_NAMING_STANDARD_MIGRATION_PLAN.md)
-- Run: paste into SQL editor and execute — safe to run multiple times (idempotent)
-- ============================================================================

BEGIN;

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS navigation_links (
    id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

    -- Display
    label               TEXT        NOT NULL,
    href                TEXT        NOT NULL,
    icon                TEXT        NOT NULL DEFAULT '',
    badge               TEXT        NOT NULL DEFAULT '',
    badge_variant       TEXT        NOT NULL DEFAULT 'default'
                                    CHECK (badge_variant IN ('default', 'success', 'warning', 'error', 'new')),

    -- Sidebar targeting — stored as a TEXT array, values: all / tenant / admin
    targets             TEXT[]      NOT NULL DEFAULT ARRAY['all']::TEXT[],

    -- Ordering and visibility
    sort_order          INTEGER     NOT NULL DEFAULT 0,
    is_enabled          BOOLEAN     NOT NULL DEFAULT true,
    is_divider_before   BOOLEAN     NOT NULL DEFAULT false,

    -- RBAC gates (empty string = no restriction)
    required_permission TEXT        NOT NULL DEFAULT '',
    required_group      TEXT        NOT NULL DEFAULT '',
    required_role       TEXT        NOT NULL DEFAULT '',

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          TEXT
);

COMMENT ON TABLE navigation_links IS
    'Dynamically-configured sidebar links managed via Admin Navigation Control Panel. '
    'Each link carries sidebar targets (all/tenant/admin) and optional RBAC gates.';

COMMENT ON COLUMN navigation_links.targets           IS 'Which sidebars show this link: all | tenant | admin';
COMMENT ON COLUMN navigation_links.sort_order        IS 'Display order within sidebar — lower = higher';
COMMENT ON COLUMN navigation_links.badge_variant     IS 'Colour variant for the badge pill';
COMMENT ON COLUMN navigation_links.required_permission IS 'RBAC permission key required to see this link, empty = unrestricted';
COMMENT ON COLUMN navigation_links.required_group    IS 'RBAC role-group key required to see this link, empty = unrestricted';
COMMENT ON COLUMN navigation_links.required_role     IS 'Exact user role required to see this link, empty = unrestricted';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_navigation_links_is_enabled
    ON navigation_links (is_enabled);

CREATE INDEX IF NOT EXISTS idx_navigation_links_sort_order
    ON navigation_links (sort_order ASC)
    WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_navigation_links_targets
    ON navigation_links USING GIN (targets);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

-- Re-use the platform's shared update_updated_at_column function if it exists,
-- otherwise create a local copy (idempotent either way).
CREATE OR REPLACE FUNCTION update_navigation_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_navigation_links_updated_at ON navigation_links;

CREATE TRIGGER trg_navigation_links_updated_at
    BEFORE UPDATE ON navigation_links
    FOR EACH ROW
    EXECUTE FUNCTION update_navigation_links_updated_at();

-- ─── Seed: built-in links ─────────────────────────────────────────────────────
-- These mirror the SEED_LINKS in apps/web/src/app/(platform)/settings/admin/navigation/page.tsx.
-- They are prefixed 'built-in-' so the Control Panel UI marks them as non-deletable.
-- ON CONFLICT DO NOTHING makes this block safe to re-run.

INSERT INTO navigation_links
    (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before,
     required_permission, required_group, required_role)
VALUES
    ('built-in-home',
     'Platform Home',   '/',                  'home',  '',      'default',
     ARRAY['all', 'tenant', 'admin']::TEXT[],
     0, true, false, '', '', ''),

    ('built-in-account',
     'My Account',      '/settings/account',  'user',  '',      'default',
     ARRAY['all', 'tenant']::TEXT[],
     1, true, false, '', '', ''),

    ('built-in-security',
     'Security & Privacy', '/settings/security', 'shield', '', 'default',
     ARRAY['all', 'tenant']::TEXT[],
     2, true, false, '', '', ''),

    ('built-in-admin',
     'Admin Panel',     '/settings/admin',    'admin', 'Admin', 'warning',
     ARRAY['admin']::TEXT[],
     3, true, true, 'CAN_ADMIN_PLATFORM', 'IS_PLATFORM_ADMIN', '')

ON CONFLICT (id) DO NOTHING;

-- ─── Verify ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM navigation_links;
    RAISE NOTICE 'navigation_links table ready — % rows', row_count;
END $$;

COMMIT;
