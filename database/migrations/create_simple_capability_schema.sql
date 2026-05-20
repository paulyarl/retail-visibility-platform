-- Create Simple Capability Schema
-- Direct and clean structure as requested

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

-- 2. Capability Type List Table (capability categories)
CREATE TABLE IF NOT EXISTS capability_type_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- Higher-level grouping: 'core', 'marketing', 'commerce', 'private'
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

-- 4. Tier Features List Table (REVISED - links tiers to capability types)
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
CREATE INDEX IF NOT EXISTS idx_capability_features_list_type_id ON capability_features_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_capability_features_list_feature_id ON capability_features_list(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_list_tier_id ON tier_features_list(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_list_capability_type_id ON tier_features_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_list_enabled ON tier_features_list(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tier_features_list_highlighted ON tier_features_list(tier_id, is_highlighted, highlight_order) WHERE is_highlighted = true;

-- 6. Populate capability types
INSERT INTO capability_type_list (key, name, description, category, sort_order) VALUES
('ecommerce_product_type', 'Ecommerce Product Types', 'Product types for ecommerce selling', 'commerce', 1),
('payment_methods', 'Payment Methods', 'Payment processing capabilities', 'commerce', 2),
('marketing_tools', 'Marketing Tools', 'Marketing and promotional capabilities', 'marketing', 1),
('analytics', 'Analytics', 'Data analysis and reporting', 'core', 1),
('inventory_management', 'Inventory Management', 'Inventory tracking and management', 'core', 2)

ON CONFLICT (key) DO NOTHING;

-- 7. Populate features_list with product types and other features
INSERT INTO features_list (key, name, description, category, marketing_name, icon_name, sort_order) VALUES
-- Product Type Features
('physical_product', 'Physical Product', 'Create tangible goods with inventory management', 'product_types', 'Physical Products', 'package', 1),
('digital_product', 'Digital Product', 'Create downloadable products and digital content', 'product_types', 'Digital Products', 'download', 2),
('hybrid_product', 'Hybrid Product', 'Create products with both physical and digital components', 'product_types', 'Hybrid Products', 'layers', 3),
('custom_product', 'Custom Product', 'Create products with custom attributes and configurations', 'product_types', 'Custom Products', 'settings', 4),
('service_product', 'Service Product', 'Create service-based offerings and appointments', 'product_types', 'Service Products', 'calendar', 5),
('subscription_product', 'Subscription Product', 'Create recurring subscription products', 'product_types', 'Subscription Products', 'repeat', 6),

-- Payment Method Features
('credit_card', 'Credit Card', 'Accept credit and debit card payments', 'payment_methods', 'Credit Cards', 'credit-card', 1),
('paypal', 'PayPal', 'Accept PayPal payments', 'payment_methods', 'PayPal', 'dollar-sign', 2),
('apple_pay', 'Apple Pay', 'Accept Apple Pay payments', 'payment_methods', 'Apple Pay', 'smartphone', 3),
('google_pay', 'Google Pay', 'Accept Google Pay payments', 'payment_methods', 'Google Pay', 'smartphone', 4),

-- Marketing Features
('email_campaigns', 'Email Campaigns', 'Create and send email marketing campaigns', 'marketing_tools', 'Email Campaigns', 'mail', 1),
('discount_codes', 'Discount Codes', 'Create promotional discount codes', 'marketing_tools', 'Discount Codes', 'tag', 1),
('social_sharing', 'Social Sharing', 'Enable social media sharing', 'marketing_tools', 'Social Sharing', 'share-2', 1),

-- Analytics Features
('basic_analytics', 'Basic Analytics', 'View basic sales and traffic reports', 'analytics', 'Basic Analytics', 'bar-chart', 1),
('advanced_analytics', 'Advanced Analytics', 'Advanced reporting with custom metrics', 'analytics', 'Advanced Analytics', 'trending-up', 2)

ON CONFLICT (key) DO NOTHING;

-- 8. Link capability types to features (capability_features_list)
INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions, sort_order) VALUES
-- Ecommerce Product Type Capability
((SELECT id FROM capability_type_list WHERE key = 'ecommerce_product_type'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"base_max_items": 1000, "requires_inventory": true}', 1),
((SELECT id FROM capability_type_list WHERE key = 'ecommerce_product_type'), (SELECT id FROM features_list WHERE key = 'digital_product'), '{"base_max_items": 1000, "requires_delivery": true}', 2),
((SELECT id FROM capability_type_list WHERE key = 'ecommerce_product_type'), (SELECT id FROM features_list WHERE key = 'hybrid_product'), '{"base_max_items": 1000, "requires_inventory": true, "requires_delivery": true}', 3),
((SELECT id FROM capability_type_list WHERE key = 'ecommerce_product_type'), (SELECT id FROM features_list WHERE key = 'custom_product'), '{"base_max_items": 1000, "requires_custom_attributes": true}', 4),

-- Payment Methods Capability
((SELECT id FROM capability_type_list WHERE key = 'payment_methods'), (SELECT id FROM features_list WHERE key = 'credit_card'), '{"transaction_fee": 2.9, "requires_compliance": true}', 1),
((SELECT id FROM capability_type_list WHERE key = 'payment_methods'), (SELECT id FROM features_list WHERE key = 'paypal'), '{"transaction_fee": 2.9, "requires_compliance": true}', 2),
((SELECT id FROM capability_type_list WHERE key = 'payment_methods'), (SELECT id FROM features_list WHERE key = 'apple_pay'), '{"transaction_fee": 2.9, "requires_compliance": true}', 3),
((SELECT id FROM capability_type_list WHERE key = 'payment_methods'), (SELECT id FROM features_list WHERE key = 'google_pay'), '{"transaction_fee": 2.9, "requires_compliance": true}', 4),

-- Marketing Tools Capability
((SELECT id FROM capability_type_list WHERE key = 'marketing_tools'), (SELECT id FROM features_list WHERE key = 'email_campaigns'), '{"max_emails_per_month": 1000, "requires_approval": false}', 1),
((SELECT id FROM capability_type_list WHERE key = 'marketing_tools'), (SELECT id FROM features_list WHERE key = 'discount_codes'), '{"max_active_coupons": 50, "requires_approval": false}', 1),
((SELECT id FROM capability_type_list WHERE key = 'marketing_tools'), (SELECT id FROM features_list WHERE key = 'social_sharing'), '{"max_social_accounts": 5, "requires_api_keys": true}', 1),

-- Analytics Capability
((SELECT id FROM capability_type_list WHERE key = 'analytics'), (SELECT id FROM features_list WHERE key = 'basic_analytics'), '{"data_retention_days": 30, "real_time": false}', 1),
((SELECT id FROM capability_type_list WHERE key = 'analytics'), (SELECT id FROM features_list WHERE key = 'advanced_analytics'), '{"data_retention_days": 365, "real_time": false}', 2)

ON CONFLICT (capability_type_id, feature_id) DO NOTHING;

-- 9. Create comprehensive view for tier capabilities
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
    -- Get all features for this capability type
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

-- 10. Create view for capability management (admin interface)
CREATE OR REPLACE VIEW capability_management_view AS
SELECT 
    ctl.key as capability_type_key,
    ctl.name as capability_type_name,
    ctl.category,
    ctl.description,
    ctl.sort_order as capability_sort_order,
    COUNT(tfl.id) as tier_count,
    STRING_AGG(stl.display_name, ', ' ORDER BY stl.sort_order) as tiers_with_capability,
    COUNT(cfl.feature_id) as feature_count,
    STRING_AGG(fl.name, ', ' ORDER BY fl.sort_order) as features_in_capability
FROM capability_type_list ctl
LEFT JOIN tier_features_list tfl ON ctl.id = tfl.capability_type_id AND tfl.is_enabled = true
LEFT JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
LEFT JOIN capability_features_list cfl ON ctl.id = cfl.capability_type_id AND cfl.is_active = true
LEFT JOIN features_list fl ON cfl.feature_id = fl.id AND fl.is_active = true
WHERE ctl.is_active = true
GROUP BY ctl.id, ctl.key, ctl.name, ctl.category, ctl.description, ctl.sort_order
ORDER BY ctl.sort_order;
