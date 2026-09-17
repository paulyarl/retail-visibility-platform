-- 071: Navigation link — Demo Tenants (admin)
-- Sprint 3.1: Demo Tenant Infrastructure
--
-- Adds "Demo Tenants" admin sidebar link, sibling of existing admin links.
-- Idempotent: safe to run on both staging and production.

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-admin-demo-tenants',
  'Demo Tenants',
  '/settings/admin/demo-tenants',
  'flask',
  '',
  'default',
  ARRAY['admin'],
  (SELECT sort_order FROM navigation_links WHERE href = '/settings/admin/bsaas-catalog' LIMIT 1) * 100 + 75,
  true,
  false,
  'CAN_ADMIN_PLATFORM',
  'IS_PLATFORM_ADMIN',
  'PLATFORM_ADMIN',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE href = '/settings/admin/bsaas-catalog' LIMIT 1),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE href = '/settings/admin/bsaas-catalog' LIMIT 1)
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-admin-demo-tenants')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE href = '/settings/admin/bsaas-catalog');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  metadata,
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-admin-demo-tenants'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE href = '/settings/admin/bsaas-catalog' LIMIT 1)
  AND NOT (metadata->'childrenKeys' ? 'nav-admin-demo-tenants');
