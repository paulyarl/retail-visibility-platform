-- Migration 054: Add platform feature flag for navigation source toggle
-- Allows admins to switch between database-driven and file-based navigation

INSERT INTO platform_feature_flags_list (id, flag, enabled, description, rollout, allow_tenant_override, updated_at, created_at)
SELECT 'nav-source-flag', 'use_file_based_navigation', false,
       'When enabled, sidebars use hardcoded file-based fallback arrays instead of database navigation_links. Useful for debugging or emergency fallback.',
       'platform', false, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM platform_feature_flags_list WHERE flag = 'use_file_based_navigation'
);
