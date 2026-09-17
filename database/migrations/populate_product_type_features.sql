-- Populate tier_features_list with product type capabilities
-- This migration adds explicit product type features to existing tiers

-- Get tier IDs for mapping (these should exist in subscription_tiers_list)
DO $$
DECLARE
    discovery_tier_id TEXT;
    starter_tier_id TEXT;
    storefront_tier_id TEXT;
    professional_tier_id TEXT;
    enterprise_tier_id TEXT;
BEGIN
    -- Get tier IDs by tier_key
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Discovery Tier - Physical products only
    INSERT INTO tier_features_list (
        id, tier_id, feature_key, feature_name, is_enabled, is_inherited, 
        metadata, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        discovery_tier_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 10, "allowed_types": ["physical_product"]}',
        true,
        1,
        'Physical Products'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
    
    -- Starter Tier - Physical products only (more items)
    INSERT INTO tier_features_list (
        id, tier_id, feature_key, feature_name, is_enabled, is_inherited,
        metadata, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        starter_tier_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 50, "allowed_types": ["physical_product"]}',
        true,
        1,
        'Physical Products'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
    
    -- Storefront Tier - Physical + Digital products
    INSERT INTO tier_features_list (
        id, tier_id, feature_key, feature_name, is_enabled, is_inherited,
        metadata, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 100, "allowed_types": ["physical_product", "digital_product"]}',
        true,
        1,
        'Physical Products'
    ),
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        'digital_product',
        'Digital Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 100, "allowed_types": ["physical_product", "digital_product"]}',
        true,
        2,
        'Digital Products'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
    
    -- Professional Tier - All product types
    INSERT INTO tier_features_list (
        id, tier_id, feature_key, feature_name, is_enabled, is_inherited,
        metadata, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        professional_tier_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 1000, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        1,
        'Physical Products'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        'digital_product',
        'Digital Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 1000, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        2,
        'Digital Products'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        'hybrid_product',
        'Hybrid Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 1000, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        3,
        'Hybrid Products'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        'custom_product',
        'Custom Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": 1000, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        4,
        'Custom Products'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
    
    -- Enterprise Tier - All product types with unlimited items
    INSERT INTO tier_features_list (
        id, tier_id, feature_key, feature_name, is_enabled, is_inherited,
        metadata, is_highlighted, highlight_order, marketing_name
    ) VALUES 
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        'physical_product',
        'Physical Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": null, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        1,
        'Physical Products'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        'digital_product',
        'Digital Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": null, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        2,
        'Digital Products'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        'hybrid_product',
        'Hybrid Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": null, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        3,
        'Hybrid Products'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        'custom_product',
        'Custom Product',
        true,
        false,
        '{"capability_type": "product_types", "max_items": null, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}',
        true,
        4,
        'Custom Products'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
    
    RAISE NOTICE 'Product type features populated for all tiers';
END $$;

-- Verify the population
SELECT 
    stl.tier_key,
    stl.display_name as tier_name,
    tfl.feature_key,
    tfl.feature_name,
    tfl.is_enabled,
    tfl.metadata->>'capability_type' as capability_type,
    tfl.metadata->>'max_items' as max_items,
    tfl.is_highlighted,
    tfl.highlight_order
FROM subscription_tiers_list stl
JOIN tier_features_list tfl ON stl.id = tfl.tier_id
WHERE tfl.metadata->>'capability_type' = 'product_types'
    AND stl.is_active = true
ORDER BY stl.sort_order, tfl.highlight_order;
