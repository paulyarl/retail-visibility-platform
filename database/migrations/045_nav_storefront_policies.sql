-- 045: Navigation link — Storefront Policies (tenant sidebar)
-- Adds a "Storefront Policies" link under "My Settings" in the tenant sidebar
-- so merchants can access their policy editor from the navigation.

INSERT INTO navigation_links (id, label, href, icon, targets, sort_order, is_enabled, metadata)
SELECT 'nav-tenant-storefront-policies', 'Storefront Policies', '/t/{tenantId}/settings/policies', 'settings', ARRAY['tenant'], 8007, true,
  '{"parentKey": "custom-1776276917946", "hasChildren": false, "childrenKeys": [], "nestingLevel": 1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-policies');

-- Update parent "My Settings" to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  metadata,
  '{childrenKeys}',
  (metadata->'childrenKeys') || to_jsonb('nav-tenant-storefront-policies'::text)
)
WHERE id = 'custom-1776276917946'
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-storefront-policies');
