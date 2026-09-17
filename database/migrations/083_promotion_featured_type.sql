-- ============================================================
-- Migration 083: Register directory_promoted as a featured_type_registry entry
-- Sprint 4: Badge & Featured Type Integration
--
-- Registers 'directory_promoted' as a system badge with:
--   - group_type = 'platform' (platform-controlled)
--   - is_promotional = true, promotional_priority = 200 (above 'featured' at 100)
--   - requires_tenant_access = true (store-level promotion, not product-level)
--
-- Note: Directory promotion is store-level (tenant-level), not product-level.
-- The delivery mechanism is directory_listings_list.is_promoted/promotion_tier,
-- NOT featured_products (which requires inventory_item_id FK).
-- Badge analytics use badge_events with inventory_item_id = 'store-level'.
-- ============================================================

INSERT INTO featured_type_registry (
  tenant_id, key, label, description, group_type, icon, color,
  priority, sort_order, is_system, is_active,
  requires_tenant_access, requires_admin_approval,
  is_promotional, promotional_priority
)
VALUES (
  NULL, 'directory_promoted', 'Directory Promoted',
  'Store is promoted on the directory map and search results with tier-based visibility',
  'platform', '📍', 'amber',
  50, 12, true, true,
  true, false,
  true, 200
)
ON CONFLICT (tenant_id, key) DO NOTHING;
