-- 063: Navigation link — Custom Badges (tenant sidebar)
-- Adds a "Custom Badges" link under "My Settings" in the tenant sidebar
-- so merchants can access their custom badge management UI.
--
-- Idempotent: safe to run on both staging and production.
-- Parent: "My Settings" (id: custom-1776276917946)

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-custom-badges',
  'Custom Badges',
  '/t/{tenantId}/settings/products/badges',
  'featured',
  'NEW',
  'new',
  ARRAY['tenant'],
  8008,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  '{"parentKey": "custom-1776276917946", "hasChildren": false, "childrenKeys": [], "nestingLevel": 1}'::jsonb,
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-custom-badges');

-- Update parent "My Settings" to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-custom-badges'::text)
)
WHERE id = 'custom-1776276917946'
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-custom-badges');
