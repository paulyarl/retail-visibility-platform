-- Populate Simple Capability Schema
-- Direct structure: features_list -> capability_type_list -> capability_features_list -> tier_features_list

-- First, run the schema creation:
-- \i database/migrations/create_simple_capability_schema.sql

-- Then populate tier_features_list with capability type assignments
DO $$
DECLARE
    discovery_tier_id TEXT;
    starter_tier_id TEXT;
    storefront_tier_id TEXT;
    professional_tier_id TEXT;
    enterprise_tier_id TEXT;
    
    -- Capability Type IDs
    ecommerce_product_type_id TEXT;
    payment_methods_id TEXT;
    marketing_tools_id TEXT;
    analytics_id TEXT;
BEGIN
    -- Get tier IDs
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Get capability type IDs
    SELECT id INTO ecommerce_product_type_id FROM capability_type_list WHERE key = 'ecommerce_product_type' LIMIT 1;
    SELECT id INTO payment_methods_id FROM capability_type_list WHERE key = 'payment_methods' LIMIT 1;
    SELECT id INTO marketing_tools_id FROM capability_type_list WHERE key = 'marketing_tools' LIMIT 1;
    SELECT id INTO analytics_id FROM capability_type_list WHERE key = 'analytics' LIMIT 1;
    
    -- Clear existing tier capabilities to avoid conflicts
    DELETE FROM tier_features_list;
    
    -- Discovery Tier - Basic ecommerce product types only
    INSERT INTO tier_features_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        discovery_tier_id,
        ecommerce_product_type_id,
        true,
        false,
        true,
        1,
        'Basic Product Types',
        '{"max_items": 10, "allowed_types": ["physical_product"]}'
    );
    
    -- Starter Tier - Enhanced ecommerce product types
    INSERT INTO tier_features_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        starter_tier_id,
        ecommerce_product_type_id,
        true,
        false,
        true,
        1,
        'Enhanced Product Types',
        '{"max_items": 50, "allowed_types": ["physical_product"]}'
    );
    
    -- Storefront Tier - Ecommerce product types + payment methods
    INSERT INTO tier_features_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        ecommerce_product_type_id,
        true,
        false,
        true,
        1,
        'Advanced Product Types',
        '{"max_items": 100, "allowed_types": ["physical_product", "digital_product"]}'
    ),
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        payment_methods_id,
        true,
        false,
        true,
        2,
        'Payment Processing',
        '{"transaction_fee": 2.9, "max_daily_transactions": 100}'
    );
    
    -- Professional Tier - All core capabilities + basic marketing
    INSERT INTO tier_features_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        professional_tier_id,
        ecommerce_product_type_id,
        true,
        false,
        true,
        1,
        'Professional Product Types',
        '{"max_items": 1000, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        payment_methods_id,
        true,
        false,
        true,
        2,
        'Advanced Payment Processing',
        '{"transaction_fee": 2.5, "max_daily_transactions": 1000}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        marketing_tools_id,
        true,
        false,
        true,
        3,
        'Marketing Tools',
        '{"max_emails_per_month": 5000, "max_campaigns": 10}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        analytics_id,
        true,
        false,
        true,
        4,
        'Advanced Analytics',
        '{"data_retention_days": 365, "custom_reports": true}'
    );
    
    -- Enterprise Tier - All capabilities with unlimited features
    INSERT INTO tier_features_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        ecommerce_product_type_id,
        true,
        false,
        true,
        1,
        'Unlimited Product Types',
        '{"max_items": null, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product", "service_product", "subscription_product"]}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        payment_methods_id,
        true,
        false,
        true,
        2,
        'Enterprise Payment Processing',
        '{"transaction_fee": 2.2, "max_daily_transactions": null}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        marketing_tools_id,
        true,
        false,
        true,
        3,
        'Enterprise Marketing Tools',
        '{"max_emails_per_month": null, "max_campaigns": null, "advanced_automation": true}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        analytics_id,
        true,
        false,
        true,
        4,
        'Enterprise Analytics',
        '{"data_retention_days": null, "real_time": true, "api_access": true}'
    );
    
    RAISE NOTICE 'Simple capability schema populated with tier-specific capabilities';
END $$;

-- Verify the population using the comprehensive view
SELECT 
    tier_key,
    tier_name,
    capability_type_key,
    capability_type_name,
    capability_category,
    capability_enabled,
    capability_marketing_name,
    tier_specific_restrictions,
    total_features,
    features -- This will show the JSON array of features
FROM tier_capabilities_view
WHERE capability_enabled = true
ORDER BY tier_key, capability_category, capability_type_key;

-- Show capability management overview
SELECT 
    capability_type_key,
    capability_type_name,
    category,
    tier_count,
    tiers_with_capability,
    feature_count,
    features_in_capability
FROM capability_management_view
ORDER BY category, capability_type_key;

-- Show specific example: ecommerce_product_type capability and its features
SELECT 
    ctl.key as capability_type_key,
    ctl.name as capability_type_name,
    fl.key as feature_key,
    fl.name as feature_name,
    fl.description as feature_description,
    cfl.restrictions as base_restrictions
FROM capability_type_list ctl
JOIN capability_features_list cfl ON ctl.id = cfl.capability_type_id
JOIN features_list fl ON cfl.feature_id = fl.id
WHERE ctl.key = 'ecommerce_product_type'
ORDER BY fl.sort_order;
