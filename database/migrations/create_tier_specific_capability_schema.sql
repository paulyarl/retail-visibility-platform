-- Create Tier-Specific Capability Schema
-- Each tier gets their own capability type for product types

-- 1. Features List Table (master repository for ALL features)
CREATE TABLE IF NOT EXISTS features_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    marketing_name TEXT,
    marketing_description TEXT,
    icon_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT
);

-- 2. Capability Type List Table (capability categories - tier-specific)
CREATE TABLE IF NOT EXISTS capability_type_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'product_types', 'payment_methods', 'marketing', 'analytics'
    tier_id TEXT REFERENCES subscription_tiers_list(id) ON DELETE CASCADE, -- Link to specific tier
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Capability Features List Table (links capability types to features)
CREATE TABLE IF NOT EXISTS capability_features_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    capability_type_id TEXT NOT NULL REFERENCES capability_type_list(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES features_list(id) ON DELETE CASCADE,
    restrictions JSONB, -- Base restrictions for this capability-feature combination
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(capability_type_id, feature_id)
);

-- 4. Tier Features List Table (links tiers to their specific capability types)
CREATE TABLE IF NOT EXISTS tier_features_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tier_id TEXT NOT NULL REFERENCES subscription_tiers_list(id) ON DELETE CASCADE,
    capability_type_id TEXT NOT NULL REFERENCES capability_type_list(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_inherited BOOLEAN NOT NULL DEFAULT false,
    is_highlighted BOOLEAN DEFAULT false,
    highlight_order INTEGER DEFAULT 0,
    highlight_description TEXT,
    marketing_name TEXT, -- Tier-specific marketing name for the capability
    tier_specific_restrictions JSONB, -- Tier-specific overrides of base restrictions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    UNIQUE(tier_id, capability_type_id)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_features_list_key ON features_list(key);
CREATE INDEX IF NOT EXISTS idx_features_list_category ON features_list(category);
CREATE INDEX IF NOT EXISTS idx_features_list_active ON features_list(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_capability_type_list_key ON capability_type_list(key);
CREATE INDEX IF NOT EXISTS idx_capability_type_list_category ON capability_type_list(category);
CREATE INDEX IF NOT EXISTS idx_capability_type_list_tier_id ON capability_type_list(tier_id);
CREATE INDEX IF NOT EXISTS idx_capability_features_list_type_id ON capability_features_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_capability_features_list_feature_id ON capability_features_list(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_list_tier_id ON tier_features_list(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_list_capability_type_id ON tier_features_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_list_enabled ON tier_features_list(is_enabled) WHERE is_enabled = true;

-- 6. Populate features_list with product types
INSERT INTO features_list (key, name, description, category, marketing_name, icon_name, sort_order) VALUES
('physical_product', 'Physical Product', 'Create tangible goods with inventory management', 'product_types', 'Physical Products', 'package', 1),
('digital_product', 'Digital Product', 'Create downloadable products and digital content', 'product_types', 'Digital Products', 'download', 2),
('hybrid_product', 'Hybrid Product', 'Create products with both physical and digital components', 'product_types', 'Hybrid Products', 'layers', 3),
('custom_product', 'Custom Product', 'Create products with custom attributes and configurations', 'product_types', 'Custom Products', 'settings', 4),
('service_product', 'Service Product', 'Create service-based offerings and appointments', 'product_types', 'Service Products', 'calendar', 5),
('subscription_product', 'Subscription Product', 'Create recurring subscription products', 'product_types', 'Subscription Products', 'repeat', 6)

ON CONFLICT (key) DO NOTHING;

-- 7. Create tier-specific capability types for product types
DO $$
DECLARE
    discovery_tier_id TEXT;
    starter_tier_id TEXT;
    storefront_tier_id TEXT;
    professional_tier_id TEXT;
    enterprise_tier_id TEXT;
BEGIN
    -- Get tier IDs
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Clear existing product type capabilities
    DELETE FROM capability_type_list WHERE category = 'product_types';
    
    -- Create tier-specific product type capabilities
    INSERT INTO capability_type_list (key, name, description, category, tier_id, sort_order) VALUES
    ('discovery_product_type', 'Discovery Product Types', 'Basic product types for discovery tier', 'product_types', discovery_tier_id, 1),
    ('starter_product_type', 'Starter Product Types', 'Enhanced product types for starter tier', 'product_types', starter_tier_id, 2),
    ('storefront_product_type', 'Storefront Product Types', 'Advanced product types for storefront tier', 'product_types', storefront_tier_id, 3),
    ('professional_product_type', 'Professional Product Types', 'Professional product types for professional tier', 'product_types', professional_tier_id, 4),
    ('enterprise_product_type', 'Enterprise Product Types', 'Enterprise product types for enterprise tier', 'product_types', enterprise_tier_id, 5);
    
    RAISE NOTICE 'Created tier-specific product type capabilities';
END $$;

-- 8. Link tier-specific capability types to features
DO $$
BEGIN
    -- Discovery Product Types -> physical_product only
    INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions, sort_order) VALUES
    ((SELECT id FROM capability_type_list WHERE key = 'discovery_product_type'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"max_items": 10}', 1)
    ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    
    -- Starter Product Types -> physical_product only (more items)
    INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions, sort_order) VALUES
    ((SELECT id FROM capability_type_list WHERE key = 'starter_product_type'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"max_items": 50}', 1)
    ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    
    -- Storefront Product Types -> physical_product + digital_product
    INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions, sort_order) VALUES
    ((SELECT id FROM capability_type_list WHERE key = 'storefront_product_type'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"max_items": 100}', 1),
    ((SELECT id FROM capability_type_list WHERE key = 'storefront_product_type'), (SELECT id FROM features_list WHERE key = 'digital_product'), '{"max_items": 100}', 2)
    ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    
    -- Professional Product Types -> physical_product + digital_product + hybrid_product + custom_product
    INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions, sort_order) VALUES
    ((SELECT id FROM capability_type_list WHERE key = 'professional_product_type'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"max_items": 1000}', 1),
    ((SELECT id FROM capability_type_list WHERE key = 'professional_product_type'), (SELECT id FROM features_list WHERE key = 'digital_product'), '{"max_items": 1000}', 2),
    ((SELECT id FROM capability_type_list WHERE key = 'professional_product_type'), (SELECT id FROM features_list WHERE key = 'hybrid_product'), '{"max_items": 1000}', 3),
    ((SELECT id FROM capability_type_list WHERE key = 'professional_product_type'), (SELECT id FROM features_list WHERE key = 'custom_product'), '{"max_items": 1000}', 4)
    ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    
    -- Enterprise Product Types -> ALL product types (unlimited)
    INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions, sort_order) VALUES
    ((SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"max_items": null}', 1),
    ((SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), (SELECT id FROM features_list WHERE key = 'digital_product'), '{"max_items": null}', 2),
    ((SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), (SELECT id FROM features_list WHERE key = 'hybrid_product'), '{"max_items": null}', 3),
    ((SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), (SELECT id FROM features_list WHERE key = 'custom_product'), '{"max_items": null}', 4),
    ((SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), (SELECT id FROM features_list WHERE key = 'service_product'), '{"max_items": null}', 5),
    ((SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), (SELECT id FROM features_list WHERE key = 'subscription_product'), '{"max_items": null}', 6)
    ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    
    RAISE NOTICE 'Linked tier-specific capabilities to features';
END $$;

-- 9. Assign tier-specific capabilities to tiers
DO $$
DECLARE
    discovery_tier_id TEXT;
    starter_tier_id TEXT;
    storefront_tier_id TEXT;
    professional_tier_id TEXT;
    enterprise_tier_id TEXT;
BEGIN
    -- Get tier IDs
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Clear existing tier assignments
    DELETE FROM tier_features_list WHERE capability_type_id IN (
        SELECT id FROM capability_type_list WHERE category = 'product_types'
    );
    
    -- Assign each tier their specific product type capability
    INSERT INTO tier_features_list (tier_id, capability_type_id, is_enabled, is_highlighted, highlight_order, marketing_name) VALUES
    (discovery_tier_id, (SELECT id FROM capability_type_list WHERE key = 'discovery_product_type'), true, true, 1, 'Basic Product Types'),
    (starter_tier_id, (SELECT id FROM capability_type_list WHERE key = 'starter_product_type'), true, true, 1, 'Enhanced Product Types'),
    (storefront_tier_id, (SELECT id FROM capability_type_list WHERE key = 'storefront_product_type'), true, true, 1, 'Advanced Product Types'),
    (professional_tier_id, (SELECT id FROM capability_type_list WHERE key = 'professional_product_type'), true, true, 1, 'Professional Product Types'),
    (enterprise_tier_id, (SELECT id FROM capability_type_list WHERE key = 'enterprise_product_type'), true, true, 1, 'Unlimited Product Types');
    
    RAISE NOTICE 'Assigned tier-specific capabilities to tiers';
END $$;

-- 10. Create comprehensive view for tier capabilities
CREATE OR REPLACE VIEW tier_capabilities_view AS
SELECT 
    stl.tier_key,
    stl.display_name as tier_name,
    ctl.key as capability_type_key,
    ctl.name as capability_type_name,
    ctl.category as capability_category,
    tfl.is_enabled as capability_enabled,
    tfl.is_highlighted,
    tfl.highlight_order,
    tfl.highlight_description,
    tfl.marketing_name as capability_marketing_name,
    tfl.tier_specific_restrictions,
    -- Get all features for this tier-specific capability
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'feature_key', fl.key,
                'feature_name', fl.name,
                'feature_description', fl.description,
                'marketing_name', fl.marketing_name,
                'icon_name', fl.icon_name,
                'sort_order', fl.sort_order,
                'base_restrictions', cfl.restrictions,
                'effective_restrictions', COALESCE(tfl.tier_specific_restrictions, cfl.restrictions)
            ) ORDER BY fl.sort_order
        )
        FROM capability_features_list cfl
        JOIN features_list fl ON cfl.feature_id = fl.id
        WHERE cfl.capability_type_id = ctl.id AND fl.is_active = true AND cfl.is_active = true
    ) as features,
    -- Count of features for this capability
    (
        SELECT COUNT(*)
        FROM capability_features_list cfl
        JOIN features_list fl ON cfl.feature_id = fl.id
        WHERE cfl.capability_type_id = ctl.id AND fl.is_active = true AND cfl.is_active = true
    ) as total_features
FROM subscription_tiers_list stl
JOIN tier_features_list tfl ON stl.id = tfl.tier_id
JOIN capability_type_list ctl ON tfl.capability_type_id = ctl.id
WHERE stl.is_active = true
  AND ctl.is_active = true
  AND tfl.is_enabled = true
ORDER BY stl.sort_order, ctl.sort_order, tfl.highlight_order;

-- 11. Create view for capability management (admin interface)
CREATE OR REPLACE VIEW capability_management_view AS
SELECT 
    ctl.key as capability_type_key,
    ctl.name as capability_type_name,
    ctl.category,
    stl.tier_key,
    stl.display_name as tier_name,
    ctl.description,
    ctl.sort_order as capability_sort_order,
    COUNT(cfl.feature_id) as feature_count,
    STRING_AGG(fl.name, ', ' ORDER BY fl.sort_order) as features_in_capability
FROM capability_type_list ctl
JOIN subscription_tiers_list stl ON ctl.tier_id = stl.id
LEFT JOIN capability_features_list cfl ON ctl.id = cfl.capability_type_id AND cfl.is_active = true
LEFT JOIN features_list fl ON cfl.feature_id = fl.id AND fl.is_active = true
WHERE ctl.is_active = true
  AND stl.is_active = true
GROUP BY ctl.id, ctl.key, ctl.name, ctl.category, stl.tier_key, stl.display_name, ctl.description, ctl.sort_order
ORDER BY stl.sort_order, ctl.sort_order;
