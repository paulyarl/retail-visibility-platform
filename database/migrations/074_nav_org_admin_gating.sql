-- 074_nav_org_admin_gating.sql
-- Tag org-related navigation links with requiredOrgAdmin: true in metadata
-- so that filterByOrgRole in DynamicTenantSidebar hides them for non-org-admins.
-- Idempotent: safe to run on both staging and production.

UPDATE navigation_links
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"requiredOrgAdmin": true}'::jsonb,
    updated_at = NOW()
WHERE href LIKE '%/settings/organization'
   OR href LIKE '%/settings/propagation'
   OR href LIKE '%/propagation'
  AND id NOT LIKE 'nav-admin-%';
