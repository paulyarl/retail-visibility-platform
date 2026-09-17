-- 085: Navigation link — App Store (tenant sidebar)
-- Adds a top-level "App Store" link to the tenant sidebar that consolidates
-- all 4 self-serve stores (Plans, Features, Featured Products, Directory Promotion)
-- into a single tabbed interface at /t/{tenantId}/settings/store.
--
-- The App Store link is placed as a parent with children for each tab,
-- sibling to "My Subscription" in the sidebar.
--
-- Idempotent: safe to run on both staging and production.

-- 1. Insert the parent "App Store" nav link
INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-app-store',
  'App Store',
  '/t/{tenantId}/settings/store',
  'store',
  'NEW',
  'new',
  ARRAY['tenant'],
  (
    SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-subscription'
    UNION ALL
    SELECT 200
    LIMIT 1
  ),
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', null,
    'hasChildren', true,
    'childrenKeys', '["nav-tenant-app-store-plans","nav-tenant-app-store-features","nav-tenant-app-store-placements","nav-tenant-app-store-promotions"]'::jsonb,
    'nestingLevel', 0
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-app-store');

-- 2. Insert child links for each tab
INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-app-store-browse',
  'Browse All',
  '/t/{tenantId}/settings/store',
  'store',
  '',
  'default',
  ARRAY['tenant'],
  0,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', 'nav-tenant-app-store',
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', 1
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-app-store-browse');

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-app-store-plans',
  'Plans',
  '/t/{tenantId}/settings/store?tab=plans',
  'creditcard',
  '',
  'default',
  ARRAY['tenant'],
  1,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', 'nav-tenant-app-store',
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', 1
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-app-store-plans');

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-app-store-features',
  'Features',
  '/t/{tenantId}/settings/store?tab=features',
  'bolt',
  '',
  'default',
  ARRAY['tenant'],
  2,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', 'nav-tenant-app-store',
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', 1
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-app-store-features');

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-app-store-placements',
  'Featured Products',
  '/t/{tenantId}/settings/store?tab=placements',
  'star',
  '',
  'default',
  ARRAY['tenant'],
  3,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', 'nav-tenant-app-store',
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', 1
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-app-store-placements');

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-app-store-promotions',
  'Directory Promotion',
  '/t/{tenantId}/settings/store?tab=promotions',
  'trendingup',
  '',
  'default',
  ARRAY['tenant'],
  4,
  true,
  false,
  '',
  'IS_TENANT_MANAGER',
  '',
  jsonb_build_object(
    'parentKey', 'nav-tenant-app-store',
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', 1
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-app-store-promotions');
