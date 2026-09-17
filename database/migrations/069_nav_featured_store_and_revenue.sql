-- 069: Navigation links — Featured Store (tenant) + Placement Revenue (admin)
-- Sprint 6: Analytics & Revenue
--
-- Adds:
-- 1. "Featured Store" tenant sidebar link — sibling of existing "Featured Products" tenant link
-- 2. "Placement Revenue" admin sidebar link — sibling of existing "Platform Revenue" (bsaas-analytics)
--
-- Idempotent: safe to run on both staging and production.
-- Uses subqueries to find parent IDs dynamically (parent IDs differ between environments).

-- ============================================================
-- 1. Tenant: Featured Store link
-- ============================================================
-- Reference: existing "Featured Products" tenant link (custom-1776272982768 exists in both DBs)
-- Parent is determined dynamically from that link's metadata.

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-featured-store',
  'Featured Store',
  '/t/{tenantId}/settings/featured-store',
  'store',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'custom-1776272982768') * 100 + 99,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'custom-1776272982768'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'custom-1776272982768')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-featured-store')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'custom-1776272982768');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-featured-store'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'custom-1776272982768')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-featured-store');

-- ============================================================
-- 2. Admin: Placement Revenue link
-- ============================================================
-- Reference: existing "Platform Revenue" link at /settings/admin/bsaas-analytics
-- Parent is determined dynamically from that link's metadata.

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-admin-placement-revenue',
  'Placement Revenue',
  '/settings/admin/featured-placement-revenue',
  'chart',
  '',
  'default',
  ARRAY['admin'],
  (SELECT sort_order FROM navigation_links WHERE href = '/settings/admin/bsaas-analytics' LIMIT 1) * 100 + 99,
  true,
  false,
  'CAN_ADMIN_PLATFORM',
  'IS_PLATFORM_ADMIN',
  'PLATFORM_ADMIN',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE href = '/settings/admin/bsaas-analytics' LIMIT 1),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE href = '/settings/admin/bsaas-analytics' LIMIT 1)
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-placement-revenue')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE href = '/settings/admin/bsaas-analytics');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-admin-placement-revenue'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE href = '/settings/admin/bsaas-analytics' LIMIT 1)
  AND NOT (metadata->'childrenKeys' ? 'nav-admin-placement-revenue');
