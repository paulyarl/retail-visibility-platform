-- Populate centralized features schema
-- This creates the central features_list repository and populates tier assignments

-- First, run the schema creation:
-- \i database/migrations/create_centralized_features_schema.sql

-- Then populate tier_features_list with proper foreign key relationships to features_list
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
    service_product_id TEXT;
    subscription_product_id TEXT;
BEGIN
    -- Get tier IDs
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Get capability type and feature IDs from centralized features_list
    SELECT id INTO product_types_capability_id FROM capability_types WHERE key = 'product_types' LIMIT 1;
    SELECT id INTO physical_product_id FROM features_list WHERE key = 'physical_product' LIMIT 1;
    SELECT id INTO digital_product_id FROM features_list WHERE key = 'digital_product' LIMIT 1;
    SELECT id INTO hybrid_product_id FROM features_list WHERE key = 'hybrid_product' LIMIT 1;
    SELECT id INTO custom_product_id FROM features_list WHERE key = 'custom_product' LIMIT 1;
    SELECT id INTO service_product_id FROM features_list WHERE key = 'service_product' LIMIT 1;
    SELECT id INTO subscription_product_id FROM features_list WHERE key = 'subscription_product' LIMIT 1;
    
    -- Clear existing product type features to avoid conflicts
    DELETE FROM tier_features_list 
    WHERE feature_id IN (
        SELECT id FROM features_list WHERE key IN (
            'physical_product', 'digital_product', 'hybrid_product', 
            'custom_product', 'service_product', 'subscription_product'
        )
    );
    
    -- Discovery Tier - Physical products only
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, is_enabled, is_inherited, 
        is_highlighted, highlight_order, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        discovery_tier_id,
        physical_product_id,
        true,
        false,
        true,
        1,
        '{"max_items": 10, "tier_requirement": "discovery"}'
    );
    
    -- Starter Tier - Physical products only (more items)
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        starter_tier_id,
        physical_product_id,
        true,
        false,
        true,
        1,
        '{"max_items": 50, "tier_requirement": "starter"}'
    );
    
    -- Storefront Tier - Physical + Digital products
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        physical_product_id,
        true,
        false,
        true,
        1,
        '{"max_items": 100, "tier_requirement": "storefront"}'
    ),
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        digital_product_id,
        true,
        false,
        true,
        2,
        '{"max_items": 100, "tier_requirement": "storefront"}'
    );
    
    -- Professional Tier - All product types
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        professional_tier_id,
        physical_product_id,
        true,
        false,
        true,
        1,
        '{"max_items": 1000, "tier_requirement": "professional"}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        digital_product_id,
        true,
        false,
        true,
        2,
        '{"max_items": 1000, "tier_requirement": "professional"}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        hybrid_product_id,
        true,
        false,
        true,
        3,
        '{"max_items": 1000, "tier_requirement": "professional"}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        custom_product_id,
        true,
        false,
        true,
        4,
        '{"max_items": 1000, "tier_requirement": "professional"}'
    );
    
    -- Enterprise Tier - All product types with unlimited items
    INSERT INTO tier_features_list (
        id, tier_id, feature_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        physical_product_id,
        true,
        false,
        true,
        1,
        '{"max_items": null, "tier_requirement": "enterprise"}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        digital_product_id,
        true,
        false,
        true,
        2,
        '{"max_items": null, "tier_requirement": "enterprise"}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        hybrid_product_id,
        true,
        false,
        true,
        3,
        '{"max_items": null, "tier_requirement": "enterprise"}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        custom_product_id,
        true,
        false,
        true,
        4,
        '{"max_items": null, "tier_requirement": "enterprise"}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        service_product_id,
        true,
        false,
        true,
        5,
        '{"max_items": null, "tier_requirement": "enterprise"}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        subscription_product_id,
        true,
        false,
        true,
        6,
        '{"max_items": null, "tier_requirement": "enterprise"}'
    );
    
    RAISE NOTICE 'Centralized features schema populated with tier assignments';
END $$;

-- Verify the population using the comprehensive view
SELECT 
    tier_key,
    tier_name,
    capability_type_key,
    capability_type_name,
    feature_key,
    feature_name,
    feature_description,
    feature_marketing_name,
    feature_icon_name,
    is_enabled,
    is_highlighted,
    highlight_order,
    tier_specific_restrictions,
    base_restrictions,
    effective_restrictions
FROM tier_capabilities_view
WHERE capability_type_key = 'product_types'
    AND is_enabled = true
ORDER BY tier_key, highlight_order;

-- Show feature management overview
SELECT 
    feature_key,
    feature_name,
    capability_type_key,
    marketing_name,
    icon_name,
    tier_count,
    tiers_with_feature
FROM feature_management_view
WHERE capability_type_key = 'product_types'
ORDER BY sort_order;
