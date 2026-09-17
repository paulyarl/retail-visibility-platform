-- ============================================================
-- Migration 072: Navigation links — Import Wizard & Supplier Mappings (tenant)
-- Sprint 5: Tenant Catalog Integration
--
-- Adds two tenant sidebar links under "My Settings":
-- 1. "Import Wizard" — bulk import from supplier catalogs
-- 2. "Supplier Mappings" — manage supplier-to-inventory mappings
--
-- Idempotent: safe to run on both staging and production.
-- Parent: "My Settings" (id: custom-1776276917946)
-- ============================================================

-- 1. Tenant: Import Wizard link
INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-import-wizard',
  'Import Wizard',
  '/t/{tenantId}/settings/import-wizard',
  'upload',
  'NEW',
  'new',
  ARRAY['tenant'],
  8050,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  '{"parentKey": "custom-1776276917946", "hasChildren": false, "childrenKeys": [], "nestingLevel": 1}'::jsonb,
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-import-wizard');

-- Update parent "My Settings" to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-import-wizard'::text)
)
WHERE id = 'custom-1776276917946'
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-import-wizard');

-- 2. Tenant: Supplier Mappings link
INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-supplier-mappings',
  'Supplier Mappings',
  '/t/{tenantId}/settings/supplier-mappings',
  'link',
  '',
  'default',
  ARRAY['tenant'],
  8051,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  '{"parentKey": "custom-1776276917946", "hasChildren": false, "childrenKeys": [], "nestingLevel": 1}'::jsonb,
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-supplier-mappings');

-- Update parent "My Settings" to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-supplier-mappings'::text)
)
WHERE id = 'custom-1776276917946'
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-supplier-mappings');
