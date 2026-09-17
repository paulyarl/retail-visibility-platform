-- Populate Enhanced Capability-Tier Schema
-- This creates tier-specific capabilities with feature inheritance and grouping

-- First, run the schema creation:
-- \i database/migrations/create_capability_tier_schema.sql

-- Then populate tier_capabilities_list with tier-specific capabilities
DO $$
DECLARE
    discovery_tier_id TEXT;
    starter_tier_id TEXT;
    storefront_tier_id TEXT;
    professional_tier_id TEXT;
    enterprise_tier_id TEXT;
    
    -- Capability Type IDs
    product_creation_id TEXT;
    payment_processing_id TEXT;
    email_marketing_id TEXT;
    advanced_analytics_id TEXT;
    api_access_id TEXT;
BEGIN
    -- Get tier IDs
    SELECT id INTO discovery_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery' LIMIT 1;
    SELECT id INTO starter_tier_id FROM subscription_tiers_list WHERE tier_key = 'starter' LIMIT 1;
    SELECT id INTO storefront_tier_id FROM subscription_tiers_list WHERE tier_key = 'storefront' LIMIT 1;
    SELECT id INTO professional_tier_id FROM subscription_tiers_list WHERE tier_key = 'professional' LIMIT 1;
    SELECT id INTO enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'enterprise' LIMIT 1;
    
    -- Get capability type IDs
    SELECT id INTO product_creation_id FROM capability_types WHERE key = 'product_creation' LIMIT 1;
    SELECT id INTO payment_processing_id FROM capability_types WHERE key = 'payment_processing' LIMIT 1;
    SELECT id INTO email_marketing_id FROM capability_types WHERE key = 'email_marketing' LIMIT 1;
    SELECT id INTO advanced_analytics_id FROM capability_types WHERE key = 'advanced_analytics' LIMIT 1;
    SELECT id INTO api_access_id FROM capability_types WHERE key = 'api_access' LIMIT 1;
    
    -- Clear existing tier capabilities to avoid conflicts
    DELETE FROM tier_capabilities_list;
    
    -- Discovery Tier - Basic product creation only
    INSERT INTO tier_capabilities_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        discovery_tier_id,
        product_creation_id,
        true,
        false,
        true,
        1,
        'Basic Product Creation',
        '{"max_items": 10, "allowed_types": ["physical_product"]}'
    );
    
    -- Starter Tier - Enhanced product creation
    INSERT INTO tier_capabilities_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        starter_tier_id,
        product_creation_id,
        true,
        false,
        true,
        1,
        'Enhanced Product Creation',
        '{"max_items": 50, "allowed_types": ["physical_product"]}'
    );
    
    -- Storefront Tier - Product creation + Payment processing
    INSERT INTO tier_capabilities_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        product_creation_id,
        true,
        false,
        true,
        1,
        'Advanced Product Creation',
        '{"max_items": 100, "allowed_types": ["physical_product", "digital_product"]}'
    ),
    (
        gen_random_uuid()::text,
        storefront_tier_id,
        payment_processing_id,
        true,
        false,
        true,
        2,
        'Payment Processing',
        '{"transaction_fee": 2.9, "max_daily_transactions": 100}'
    );
    
    -- Professional Tier - All core capabilities + basic marketing
    INSERT INTO tier_capabilities_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        professional_tier_id,
        product_creation_id,
        true,
        false,
        true,
        1,
        'Professional Product Creation',
        '{"max_items": 1000, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product"]}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        payment_processing_id,
        true,
        false,
        true,
        2,
        'Advanced Payment Processing',
        '{"transaction_fee": 2.5, "max_daily_transactions": 1000, "supports_crypto": false}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        email_marketing_id,
        true,
        false,
        true,
        3,
        'Email Marketing',
        '{"max_emails_per_month": 5000, "max_campaigns": 10}'
    ),
    (
        gen_random_uuid()::text,
        professional_tier_id,
        advanced_analytics_id,
        true,
        false,
        true,
        4,
        'Advanced Analytics',
        '{"data_retention_days": 365, "real_time": false, "custom_reports": true}'
    );
    
    -- Enterprise Tier - All capabilities including private features
    INSERT INTO tier_capabilities_list (
        id, tier_id, capability_type_id, is_enabled, is_inherited,
        is_highlighted, highlight_order, marketing_name, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        product_creation_id,
        true,
        false,
        true,
        1,
        'Unlimited Product Creation',
        '{"max_items": null, "allowed_types": ["physical_product", "digital_product", "hybrid_product", "custom_product", "service_product", "subscription_product"]}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        payment_processing_id,
        true,
        false,
        true,
        2,
        'Enterprise Payment Processing',
        '{"transaction_fee": 2.2, "max_daily_transactions": null, "supports_crypto": true}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        email_marketing_id,
        true,
        false,
        true,
        3,
        'Enterprise Email Marketing',
        '{"max_emails_per_month": null, "max_campaigns": null, "advanced_automation": true}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        advanced_analytics_id,
        true,
        false,
        true,
        4,
        'Enterprise Analytics',
        '{"data_retention_days": null, "real_time": true, "custom_reports": true, "api_access": true}'
    ),
    (
        gen_random_uuid()::text,
        enterprise_tier_id,
        api_access_id,
        true,
        false,
        true,
        5,
        'Full API Access',
        '{"rate_limit": "10000/hour", "webhooks": true, "custom_integrations": true}'
    );
    
    RAISE NOTICE 'Capability-tier schema populated with tier-specific capabilities';
END $$;

-- Add feature overrides for fine-grained control where needed
-- Example: Discovery tier can only use physical_product, not digital_product
DO $$
DECLARE
    discovery_product_creation_capability_id TEXT;
    physical_product_id TEXT;
    digital_product_id TEXT;
BEGIN
    -- Get the capability ID for discovery tier's product creation
    SELECT tcl.id INTO discovery_product_creation_capability_id
    FROM tier_capabilities_list tcl
    JOIN subscription_tiers_list stl ON tcl.tier_id = stl.id
    JOIN capability_types ct ON tcl.capability_type_id = ct.id
    WHERE stl.tier_key = 'discovery' AND ct.key = 'product_creation';
    
    -- Get feature IDs
    SELECT id INTO physical_product_id FROM features_list WHERE key = 'physical_product';
    SELECT id INTO digital_product_id FROM features_list WHERE key = 'digital_product';
    
    -- Add overrides for discovery tier
    INSERT INTO tier_feature_overrides (
        id, tier_capability_id, feature_id, is_enabled, tier_specific_restrictions
    ) VALUES 
    (
        gen_random_uuid()::text,
        discovery_product_creation_capability_id,
        physical_product_id,
        true,
        '{"max_items": 10}'
    ),
    (
        gen_random_uuid()::text,
        discovery_product_creation_capability_id,
        digital_product_id,
        false,
        '{"reason": "Digital products not available in discovery tier"}'
    );
    
    RAISE NOTICE 'Feature overrides added for discovery tier';
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
    enabled_features,
    features -- This will show the JSON array of features with overrides
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
