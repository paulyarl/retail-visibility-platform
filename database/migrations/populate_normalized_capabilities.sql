-- Populate normalized capability schema with product type features
-- This replaces metadata-based storage with proper relational structure

-- First, run the schema creation:
-- \i database/migrations/create_capability_types_schema.sql

-- Then populate tier_features_list with proper foreign key relationships
DO $$
DECLARE
    discovery_tier_id TEXT;
    starter_tier_id TEXT;
    storefront_tier_id TEXT;
    professional_tier_id TEXT;
    enterprise_tier_id TEXT;
    product_types_capability_id TEXT;
    physical_product_id TEXT;
    digital_product_id TEXT;
    hybrid_product_id TEXT;
    custom_product_id TEXT;
BEGIN
    -- Get tier IDs
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Get capability type and feature IDs
    SELECT id INTO product_types_capability_id FROM capability_types WHERE key = 'product_types' LIMIT 1;
    SELECT id INTO physical_product_id FROM features WHERE key = 'physical_product' LIMIT 1;
    SELECT id INTO digital_product_id FROM features WHERE key = 'digital_product' LIMIT 1;
    SELECT id INTO hybrid_product_id FROM features WHERE key = 'hybrid_product' LIMIT 1;
    SELECT id INTO custom_product_id FROM features WHERE key = 'custom_product' LIMIT 1;
    
    -- Clear existing product type features to avoid conflicts
    DELETE FROM tier_features_list 
    WHERE feature_key IN ('physical_product', 'digital_product', 'hybrid_product', 'custom_product');
    
    -- Discovery Tier - Physical products only
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, capability_type_id, feature_key, feature_name, 
        is_enabled, is_inherited, restrictions, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        discovery_tier_id,
        physical_product_id,
        product_types_capability_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"max_items": 10, "tier_requirement": "discovery"}',
        true,
        1,
        'Physical Products'
    );
    
    -- Starter Tier - Physical products only (more items)
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, capability_type_id, feature_key, feature_name,
        is_enabled, is_inherited, restrictions, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        starter_tier_id,
        physical_product_id,
        product_types_capability_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"max_items": 50, "tier_requirement": "starter"}',
        true,
        1,
        'Physical Products'
    );
    
    -- Storefront Tier - Physical + Digital products
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, capability_type_id, feature_key, feature_name,
        is_enabled, is_inherited, restrictions, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        physical_product_id,
        product_types_capability_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"max_items": 100, "tier_requirement": "storefront"}',
        true,
        1,
        'Physical Products'
    ),
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        digital_product_id,
        product_types_capability_id,
        'digital_product',
        'Digital Product',
        true,
        false,
        '{"max_items": 100, "tier_requirement": "storefront"}',
        true,
        2,
        'Digital Products'
    );
    
    -- Professional Tier - All product types
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, capability_type_id, feature_key, feature_name,
        is_enabled, is_inherited, restrictions, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        professional_tier_id,
        physical_product_id,
        product_types_capability_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"max_items": 1000, "tier_requirement": "professional"}',
        true,
        1,
        'Physical Products'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        digital_product_id,
        product_types_capability_id,
        'digital_product',
        'Digital Product',
        true,
        false,
        '{"max_items": 1000, "tier_requirement": "professional"}',
        true,
        2,
        'Digital Products'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        hybrid_product_id,
        product_types_capability_id,
        'hybrid_product',
        'Hybrid Product',
        true,
        false,
        '{"max_items": 1000, "tier_requirement": "professional"}',
        true,
        3,
        'Hybrid Products'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        custom_product_id,
        product_types_capability_id,
        'custom_product',
        'Custom Product',
        true,
        false,
        '{"max_items": 1000, "tier_requirement": "professional"}',
        true,
        4,
        'Custom Products'
    );
    
    -- Enterprise Tier - All product types with unlimited items
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, capability_type_id, feature_key, feature_name,
        is_enabled, is_inherited, restrictions, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        physical_product_id,
        product_types_capability_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"max_items": null, "tier_requirement": "enterprise"}',
        true,
        1,
        'Physical Products'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        digital_product_id,
        product_types_capability_id,
        'digital_product',
        'Digital Product',
        true,
        false,
        '{"max_items": null, "tier_requirement": "enterprise"}',
        true,
        2,
        'Digital Products'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        hybrid_product_id,
        product_types_capability_id,
        'hybrid_product',
        'Hybrid Product',
        true,
        false,
        '{"max_items": null, "tier_requirement": "enterprise"}',
        true,
        3,
        'Hybrid Products'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        custom_product_id,
        product_types_capability_id,
        'custom_product',
        'Custom Product',
        true,
        false,
        '{"max_items": null, "tier_requirement": "enterprise"}',
        true,
        4,
        'Custom Products'
    );
    
    RAISE NOTICE 'Normalized capability schema populated with product type features';
END $$;

-- Verify the population using the view
SELECT 
    tier_key,
    tier_name,
    capability_type_key,
    capability_type_name,
    feature_key,
    feature_name,
    is_enabled,
    restrictions,
    is_highlighted,
    highlight_order,
    marketing_name
FROM tier_capabilities_view
WHERE capability_type_key = 'product_types'
    AND is_enabled = true
ORDER BY tier_key, highlight_order;
