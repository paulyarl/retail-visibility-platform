CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_updated
  ON inventory_item (tenant_id, updated_at DESC)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_avail
  ON inventory_item (tenant_id, availability)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_catpath_gin
  ON inventory_item USING GIN (category_path)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_price
  ON inventory_item (tenant_id, price)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_title_alpha
  ON inventory_item (tenant_id, lower(title))
  WHERE visibility = 'public';
