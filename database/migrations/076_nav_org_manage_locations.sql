-- 076_nav_org_manage_locations.sql
-- Adds "Manage Locations" tenant sidebar link for self-service org location management.
-- Sibling of existing "Organization Dashboard" link at /t/{tenantId}/settings/organization.
--
-- Idempotent: safe to run on both staging and production.
-- Uses subqueries to find parent IDs dynamically (parent IDs differ between environments).

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-org-locations',
  'Manage Locations',
  '/t/{tenantId}/settings/organization/locations',
  'map-pin',
  '',
  'default',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE href = '/t/{tenantId}/settings/organization' LIMIT 1) * 100 + 99,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE href = '/t/{tenantId}/settings/organization' LIMIT 1),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE href = '/t/{tenantId}/settings/organization' LIMIT 1),
    'requiredOrgAdmin', true
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-org-locations')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE href = '/t/{tenantId}/settings/organization');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-org-locations'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE href = '/t/{tenantId}/settings/organization' LIMIT 1)
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-org-locations');
