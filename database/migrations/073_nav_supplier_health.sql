-- ============================================================
-- Migration 073: Navigation link for Supplier Health Dashboard
-- Adds "Supplier Health" link to admin sidebar under the same parent
-- as the existing "Suppliers" link.
-- Idempotent: safe to run on both staging and production.
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-admin-supplier-health',
  'Supplier Health',
  '/settings/admin/suppliers/health',
  'activity',
  '',
  'default',
  ARRAY['admin'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-admin-suppliers' LIMIT 1) + 1,
  true,
  false,
  'CAN_ADMIN_PLATFORM',
  'IS_PLATFORM_ADMIN',
  'PLATFORM_ADMIN',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-admin-suppliers' LIMIT 1),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-admin-suppliers' LIMIT 1)
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-supplier-health')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-suppliers');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-admin-supplier-health'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-admin-suppliers' LIMIT 1)
  AND NOT (metadata->'childrenKeys' ? 'nav-admin-supplier-health');
