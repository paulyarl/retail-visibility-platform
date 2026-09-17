-- 080: Navigation links — Promotion Catalog + Promotion Revenue (admin sidebar)
-- Sprint 6: Directory Promotion Admin & Analytics
--
-- Adds two admin sidebar links as siblings of "Placement Revenue" (nav-admin-placement-revenue):
-- 1. "Promotion Catalog" — /settings/admin/promotion-catalog
-- 2. "Promotion Revenue" — /settings/admin/promotion-revenue
--
-- Idempotent: safe to run on both staging and production.
-- Uses the sibling link nav-admin-placement-revenue to determine parent and sort_order dynamically.

-- ============================================================
-- 1. Admin: Promotion Catalog link
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-admin-promotion-catalog',
  'Promotion Catalog',
  '/settings/admin/promotion-catalog',
  'tags',
  'NEW',
  'new',
  ARRAY['admin'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-admin-placement-revenue') + 1,
  true,
  false,
  'CAN_ADMIN_PLATFORM',
  'IS_PLATFORM_ADMIN',
  'PLATFORM_ADMIN',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-admin-placement-revenue'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-admin-placement-revenue')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-promotion-catalog')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-placement-revenue');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-admin-promotion-catalog'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-admin-placement-revenue')
  AND NOT (metadata->'childrenKeys' ? 'nav-admin-promotion-catalog');

-- ============================================================
-- 2. Admin: Promotion Revenue link
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-admin-promotion-revenue',
  'Promotion Revenue',
  '/settings/admin/promotion-revenue',
  'chart',
  'NEW',
  'new',
  ARRAY['admin'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-admin-placement-revenue') + 2,
  true,
  false,
  'CAN_ADMIN_PLATFORM',
  'IS_PLATFORM_ADMIN',
  'PLATFORM_ADMIN',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-admin-placement-revenue'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-admin-placement-revenue')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-promotion-revenue')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-placement-revenue');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-admin-promotion-revenue'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-admin-placement-revenue')
  AND NOT (metadata->'childrenKeys' ? 'nav-admin-promotion-revenue');
