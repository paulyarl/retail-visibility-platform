-- Create clean relational design for tenant GBP categories
-- Replaces JSON metadata approach with proper junction table

-- 1. Create junction table for tenant GBP categories
CREATE TABLE tenant_gbp_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gbp_category_id VARCHAR(50) NOT NULL REFERENCES gbp_categories_list(id) ON DELETE CASCADE,
  category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('primary', 'secondary')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each tenant can't have the same category assigned twice with the same type
  UNIQUE(tenant_id, gbp_category_id, category_type)
);

-- 2. Create indexes for performance
CREATE INDEX idx_tenant_gbp_categories_tenant_id ON tenant_gbp_categories(tenant_id);
CREATE INDEX idx_tenant_gbp_categories_gbp_category_id ON tenant_gbp_categories(gbp_category_id);
CREATE INDEX idx_tenant_gbp_categories_type ON tenant_gbp_categories(category_type);
CREATE INDEX idx_tenant_gbp_categories_composite ON tenant_gbp_categories(tenant_id, category_type, gbp_category_id);

-- 3. Add comments for documentation
COMMENT ON TABLE tenant_gbp_categories IS 'Junction table linking tenants to their GBP categories (primary and secondary)';
COMMENT ON COLUMN tenant_gbp_categories.category_type IS 'Type of GBP category: primary or secondary';
COMMENT ON COLUMN tenant_gbp_categories.tenant_id IS 'Reference to the tenant';
COMMENT ON COLUMN tenant_gbp_categories.gbp_category_id IS 'Reference to the GBP category from gbp_categories_list';

-- 4. Migrate existing data from metadata to junction table
INSERT INTO tenant_gbp_categories (tenant_id, gbp_category_id, category_type)
SELECT 
  t.id as tenant_id,
  (t.metadata -> 'gbp_categories' -> 'primary' ->> 'id') as gbp_category_id,
  'primary' as category_type
FROM tenants t
WHERE 
  t.metadata -> 'gbp_categories' -> 'primary' IS NOT NULL
  AND (t.metadata -> 'gbp_categories' -> 'primary' ->> 'id') IS NOT NULL
  AND (t.metadata -> 'gbp_categories' -> 'primary' ->> 'id') LIKE 'gcid:%';

-- 5. Migrate secondary categories
INSERT INTO tenant_gbp_categories (tenant_id, gbp_category_id, category_type)
SELECT 
  t.id as tenant_id,
  sec_cat.value ->> 'id' as gbp_category_id,
  'secondary' as category_type
FROM tenants t
CROSS JOIN jsonb_array_elements(t.metadata -> 'gbp_categories' -> 'secondary') AS sec_cat(value)
WHERE 
  sec_cat.value ->> 'id' IS NOT NULL
  AND sec_cat.value ->> 'id' LIKE 'gcid:%';

-- 6. Verify migration results
DO $$
DECLARE
  primary_count INTEGER;
  secondary_count INTEGER;
  total_tenants INTEGER;
BEGIN
  SELECT COUNT(*) INTO primary_count FROM tenant_gbp_categories WHERE category_type = 'primary';
  SELECT COUNT(*) INTO secondary_count FROM tenant_gbp_categories WHERE category_type = 'secondary';
  SELECT COUNT(DISTINCT tenant_id) INTO total_tenants FROM tenant_gbp_categories;
  
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '- Primary categories migrated: %', primary_count;
  RAISE NOTICE '- Secondary categories migrated: %', secondary_count;
  RAISE NOTICE '- Total tenants with GBP categories: %', total_tenants;
END $$;

-- 7. Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_tenant_gbp_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_gbp_categories_updated_at
  BEFORE UPDATE ON tenant_gbp_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_gbp_categories_updated_at();

-- 8. Create view for easy querying (combines tenant and category info)
CREATE VIEW tenant_gbp_categories_view AS
SELECT 
  tgc.id,
  tgc.tenant_id,
  t.name as tenant_name,
  tgc.gbp_category_id,
  gc.name as gbp_category_name,
  gc.display_name as gbp_category_display_name,
  tgc.category_type,
  tgc.created_at,
  tgc.updated_at
FROM tenant_gbp_categories tgc
JOIN tenants t ON t.id = tgc.tenant_id
JOIN gbp_categories_list gc ON gc.id = tgc.gbp_category_id
WHERE gc.is_active = true;

COMMENT ON VIEW tenant_gbp_categories_view IS 'Convenient view for querying tenant GBP categories with tenant and category names';
