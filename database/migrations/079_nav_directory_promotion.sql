-- 079: Navigation link — Directory Promotion (tenant sidebar)
-- Adds a "Directory Promotion" link as a sibling of "Featured Store" in the tenant sidebar.
-- This wires the orphaned /settings/promotion page into the DB-driven navigation.
--
-- Idempotent: safe to run on both staging and production.
-- Uses the same parent as the "Featured Store" link (nav-tenant-featured-store).

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-directory-promotion',
  'Directory Promotion',
  '/t/{tenantId}/settings/promotion',
  'featured',
  'Directory',
  'default',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-featured-store') + 1,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-featured-store'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-featured-store')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-directory-promotion')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-featured-store');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-directory-promotion'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-featured-store')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-directory-promotion');
