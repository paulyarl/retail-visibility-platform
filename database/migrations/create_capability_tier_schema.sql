-- Create Enhanced Capability-Tier Schema
-- Supports tier-specific capabilities with feature inheritance and grouping

-- 1. Capability Types Table (categories like 'marketing', 'commerce', 'private')
CREATE TABLE IF NOT EXISTS capability_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- Higher-level grouping: 'core', 'marketing', 'commerce', 'private', 'analytics'
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Central Features List Table (master repository for ALL features)
CREATE TABLE IF NOT EXISTS features_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    capability_type_id TEXT REFERENCES capability_types(id) ON DELETE SET NULL,
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

-- 3. Capability Features Junction Table
-- Groups features into capability types (e.g., 'commerce' capability includes physical_product, digital_product, etc.)
CREATE TABLE IF NOT EXISTS capability_features (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    capability_type_id TEXT NOT NULL REFERENCES capability_types(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES features_list(id) ON DELETE CASCADE,
    restrictions JSONB, -- Base restrictions for this capability-feature combination
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(capability_type_id, feature_id)
);

-- 4. Tier Capabilities List Table (REVISED - tier-specific capabilities, not individual features)
-- This stores which CAPABILITIES tiers have, not individual features
CREATE TABLE IF NOT EXISTS tier_capabilities_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tier_id TEXT NOT NULL REFERENCES subscription_tiers_list(id) ON DELETE CASCADE,
    capability_type_id TEXT NOT NULL REFERENCES capability_types(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_inherited BOOLEAN NOT NULL DEFAULT false,
    is_highlighted BOOLEAN DEFAULT false,
    highlight_order INTEGER DEFAULT 0,
    highlight_description TEXT,
    marketing_name TEXT, -- Tier-specific marketing name for the capability
    tier_specific_restrictions JSONB, -- Tier-specific overrides of base capability restrictions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    UNIQUE(tier_id, capability_type_id)
);

-- 5. Tier Feature Overrides Table (for fine-grained control when needed)
-- Optional table for when a tier needs to override specific features within a capability
CREATE TABLE IF NOT EXISTS tier_feature_overrides (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tier_capability_id TEXT NOT NULL REFERENCES tier_capabilities_list(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES features_list(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    tier_specific_restrictions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tier_capability_id, feature_id)
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_capability_types_key ON capability_types(key);
CREATE INDEX IF NOT EXISTS idx_capability_types_category ON capability_types(category);
CREATE INDEX IF NOT EXISTS idx_features_list_key ON features_list(key);
CREATE INDEX IF NOT EXISTS idx_features_list_category ON features_list(category);
CREATE INDEX IF NOT EXISTS idx_features_list_capability_type_id ON features_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_features_list_active ON features_list(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_capability_features_type_id ON capability_features(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_capability_features_feature_id ON capability_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_capabilities_tier_id ON tier_capabilities_list(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_capabilities_capability_type_id ON tier_capabilities_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_tier_capabilities_enabled ON tier_capabilities_list(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tier_capabilities_highlighted ON tier_capabilities_list(tier_id, is_highlighted, highlight_order) WHERE is_highlighted = true;
CREATE INDEX IF NOT EXISTS idx_tier_feature_overrides_capability_id ON tier_feature_overrides(tier_capability_id);
CREATE INDEX IF NOT EXISTS idx_tier_feature_overrides_feature_id ON tier_feature_overrides(feature_id);

-- 7. Populate enhanced capability types with proper grouping
INSERT INTO capability_types (key, name, description, category, sort_order) VALUES
-- Core Capabilities (basic platform functionality)
('product_creation', 'Product Creation', 'Create and manage products', 'core', 1),
('inventory_management', 'Inventory Management', 'Track and manage inventory', 'core', 2),
('order_management', 'Order Management', 'Process and fulfill orders', 'core', 3),

-- Commerce Capabilities (selling and transactions)
('payment_processing', 'Payment Processing', 'Accept payments and process transactions', 'commerce', 1),
('shipping_fulfillment', 'Shipping & Fulfillment', 'Manage shipping and fulfillment', 'commerce', 2),
('tax_management', 'Tax Management', 'Calculate and manage taxes', 'commerce', 3),

-- Marketing Capabilities (promotion and customer acquisition)
('email_marketing', 'Email Marketing', 'Send marketing emails and newsletters', 'marketing', 1),
('social_media', 'Social Media Integration', 'Connect and manage social media', 'marketing', 2),
('seo_tools', 'SEO Tools', 'Search engine optimization', 'marketing', 3),
('discount_coupons', 'Discounts & Coupons', 'Create promotional discounts', 'marketing', 4),

-- Private/Advanced Capabilities (premium features)
('advanced_analytics', 'Advanced Analytics', 'Detailed analytics and reporting', 'private', 1),
('api_access', 'API Access', 'Programmatic access via REST API', 'private', 2),
('custom_integrations', 'Custom Integrations', 'Build custom integrations', 'private', 3),
('white_label', 'White Label', 'Custom branding and white-label options', 'private', 4),

-- Customer Management
('customer_accounts', 'Customer Accounts', 'Customer registration and accounts', 'core', 4),
('customer_loyalty', 'Customer Loyalty', 'Loyalty programs and rewards', 'marketing', 5)

ON CONFLICT (key) DO NOTHING;

-- 8. Populate features_list with comprehensive feature set
INSERT INTO features_list (key, name, description, category, capability_type_id, marketing_name, icon_name, sort_order) VALUES
-- Product Creation Features
('physical_product', 'Physical Product', 'Create tangible goods with inventory management', 'product_creation', (SELECT id FROM capability_types WHERE key = 'product_creation'), 'Physical Products', 'package', 1),
('digital_product', 'Digital Product', 'Create downloadable products and digital content', 'product_creation', (SELECT id FROM capability_types WHERE key = 'product_creation'), 'Digital Products', 'download', 2),
('hybrid_product', 'Hybrid Product', 'Create products with both physical and digital components', 'product_creation', (SELECT id FROM capability_types WHERE key = 'product_creation'), 'Hybrid Products', 'layers', 3),
('custom_product', 'Custom Product', 'Create products with custom attributes and configurations', 'product_creation', (SELECT id FROM capability_types WHERE key = 'product_creation'), 'Custom Products', 'settings', 4),
('service_product', 'Service Product', 'Create service-based offerings and appointments', 'product_creation', (SELECT id FROM capability_types WHERE key = 'product_creation'), 'Service Products', 'calendar', 5),
('subscription_product', 'Subscription Product', 'Create recurring subscription products', 'product_creation', (SELECT id FROM capability_types WHERE key = 'product_creation'), 'Subscription Products', 'repeat', 6),

-- Inventory Management Features
('bulk_inventory', 'Bulk Inventory Updates', 'Update inventory in bulk', 'inventory_management', (SELECT id FROM capability_types WHERE key = 'inventory_management'), 'Bulk Updates', 'upload', 1),
('inventory_tracking', 'Real-time Inventory Tracking', 'Track inventory in real-time', 'inventory_management', (SELECT id FROM capability_types WHERE key = 'inventory_management'), 'Real-time Tracking', 'activity', 2),
('low_stock_alerts', 'Low Stock Alerts', 'Get alerts when inventory is low', 'inventory_management', (SELECT id FROM capability_types WHERE key = 'inventory_management'), 'Stock Alerts', 'bell', 3),

-- Payment Processing Features
('credit_card', 'Credit Card Payments', 'Accept credit and debit card payments', 'payment_processing', (SELECT id FROM capability_types WHERE key = 'payment_processing'), 'Credit Cards', 'credit-card', 1),
('paypal', 'PayPal', 'Accept PayPal payments', 'payment_processing', (SELECT id FROM capability_types WHERE key = 'payment_processing'), 'PayPal', 'dollar-sign', 2),
('apple_pay', 'Apple Pay', 'Accept Apple Pay payments', 'payment_processing', (SELECT id FROM capability_types WHERE key = 'payment_processing'), 'Apple Pay', 'smartphone', 3),
('google_pay', 'Google Pay', 'Accept Google Pay payments', 'payment_processing', (SELECT id FROM capability_types WHERE key = 'payment_processing'), 'Google Pay', 'smartphone', 4),
('crypto_payments', 'Cryptocurrency', 'Accept cryptocurrency payments', 'payment_processing', (SELECT id FROM capability_types WHERE key = 'payment_processing'), 'Crypto Payments', 'bitcoin', 5),

-- Marketing Features
('email_campaigns', 'Email Campaigns', 'Create and send email marketing campaigns', 'email_marketing', (SELECT id FROM capability_types WHERE key = 'email_marketing'), 'Email Campaigns', 'mail', 1),
('discount_codes', 'Discount Codes', 'Create promotional discount codes', 'discount_coupons', (SELECT id FROM capability_types WHERE key = 'discount_coupons'), 'Discount Codes', 'tag', 1),
('social_sharing', 'Social Sharing', 'Enable social media sharing', 'social_media', (SELECT id FROM capability_types WHERE key = 'social_media'), 'Social Sharing', 'share-2', 1),

-- Analytics Features
('basic_analytics', 'Basic Analytics', 'View basic sales and traffic reports', 'advanced_analytics', (SELECT id FROM capability_types WHERE key = 'advanced_analytics'), 'Basic Analytics', 'bar-chart', 1),
('advanced_analytics', 'Advanced Analytics', 'Advanced reporting with custom metrics', 'advanced_analytics', (SELECT id FROM capability_types WHERE key = 'advanced_analytics'), 'Advanced Analytics', 'trending-up', 2),
('real_time_analytics', 'Real-time Analytics', 'Live data streaming and monitoring', 'advanced_analytics', (SELECT id FROM capability_types WHERE key = 'advanced_analytics'), 'Real-time Analytics', 'activity', 3)

ON CONFLICT (key) DO NOTHING;

-- 9. Link capability types to features (capability_features junction)
INSERT INTO capability_features (capability_type_id, feature_id, restrictions, sort_order) VALUES
-- Product Creation Capability
((SELECT id FROM capability_types WHERE key = 'product_creation'), (SELECT id FROM features_list WHERE key = 'physical_product'), '{"base_max_items": 1000, "requires_inventory": true}', 1),
((SELECT id FROM capability_types WHERE key = 'product_creation'), (SELECT id FROM features_list WHERE key = 'digital_product'), '{"base_max_items": 1000, "requires_delivery": true}', 2),
((SELECT id FROM capability_types WHERE key = 'product_creation'), (SELECT id FROM features_list WHERE key = 'hybrid_product'), '{"base_max_items": 1000, "requires_inventory": true, "requires_delivery": true}', 3),
((SELECT id FROM capability_types WHERE key = 'product_creation'), (SELECT id FROM features_list WHERE key = 'custom_product'), '{"base_max_items": 1000, "requires_custom_attributes": true}', 4),
((SELECT id FROM capability_types WHERE key = 'product_creation'), (SELECT id FROM features_list WHERE key = 'service_product'), '{"base_max_items": 500, "requires_scheduling": true}', 5),
((SELECT id FROM capability_types WHERE key = 'product_creation'), (SELECT id FROM features_list WHERE key = 'subscription_product'), '{"base_max_items": 100, "requires_recurring": true}', 6),

-- Payment Processing Capability
((SELECT id FROM capability_types WHERE key = 'payment_processing'), (SELECT id FROM features_list WHERE key = 'credit_card'), '{"transaction_fee": 2.9, "requires_compliance": true}', 1),
((SELECT id FROM capability_types WHERE key = 'payment_processing'), (SELECT id FROM features_list WHERE key = 'paypal'), '{"transaction_fee": 2.9, "requires_compliance": true}', 2),
((SELECT id FROM capability_types WHERE key = 'payment_processing'), (SELECT id FROM features_list WHERE key = 'apple_pay'), '{"transaction_fee": 2.9, "requires_compliance": true}', 3),
((SELECT id FROM capability_types WHERE key = 'payment_processing'), (SELECT id FROM features_list WHERE key = 'google_pay'), '{"transaction_fee": 2.9, "requires_compliance": true}', 4),
((SELECT id FROM capability_types WHERE key = 'payment_processing'), (SELECT id FROM features_list WHERE key = 'crypto_payments'), '{"transaction_fee": 1.5, "requires_wallet": true}', 5),

-- Marketing Capability
((SELECT id FROM capability_types WHERE key = 'email_marketing'), (SELECT id FROM features_list WHERE key = 'email_campaigns'), '{"max_emails_per_month": 1000, "requires_approval": false}', 1),
((SELECT id FROM capability_types WHERE key = 'discount_coupons'), (SELECT id FROM features_list WHERE key = 'discount_codes'), '{"max_active_coupons": 50, "requires_approval": false}', 1),
((SELECT id FROM capability_types WHERE key = 'social_media'), (SELECT id FROM features_list WHERE key = 'social_sharing'), '{"max_social_accounts": 5, "requires_api_keys": true}', 1),

-- Analytics Capability
((SELECT id FROM capability_types WHERE key = 'advanced_analytics'), (SELECT id FROM features_list WHERE key = 'basic_analytics'), '{"data_retention_days": 30, "real_time": false}', 1),
((SELECT id FROM capability_types WHERE key = 'advanced_analytics'), (SELECT id FROM features_list WHERE key = 'advanced_analytics'), '{"data_retention_days": 365, "real_time": false}', 2),
((SELECT id FROM capability_types WHERE key = 'advanced_analytics'), (SELECT id FROM features_list WHERE key = 'real_time_analytics'), '{"data_retention_days": 90, "real_time": true}', 3)

ON CONFLICT (capability_type_id, feature_id) DO NOTHING;

-- 10. Create comprehensive view for tier capabilities (NEW DESIGN)
CREATE OR REPLACE VIEW tier_capabilities_view AS
SELECT 
    stl.tier_key,
    stl.display_name as tier_name,
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    ct.category as capability_category,
    tcl.is_enabled as capability_enabled,
    tcl.is_highlighted,
    tcl.highlight_order,
    tcl.highlight_description,
    tcl.marketing_name as capability_marketing_name,
    tcl.tier_specific_restrictions,
    -- Get all features for this capability
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'feature_key', fl.key,
                'feature_name', fl.name,
                'feature_description', fl.description,
                'marketing_name', fl.marketing_name,
                'icon_name', fl.icon_name,
                'sort_order', fl.sort_order,
                'base_restrictions', cf.restrictions,
                'is_enabled', COALESCE(tfo.is_enabled, true),
                'tier_restrictions', tfo.tier_specific_restrictions,
                'effective_restrictions', COALESCE(tfo.tier_specific_restrictions, cf.restrictions)
            ) ORDER BY fl.sort_order
        )
        FROM capability_features cf
        JOIN features_list fl ON cf.feature_id = fl.id
        LEFT JOIN tier_feature_overrides tfo ON tcl.id = tfo.tier_capability_id AND fl.id = tfo.feature_id
        WHERE cf.capability_type_id = ct.id AND fl.is_active = true AND cf.is_active = true
    ) as features,
    -- Count of features for this capability
    (
        SELECT COUNT(*)
        FROM capability_features cf
        JOIN features_list fl ON cf.feature_id = fl.id
        WHERE cf.capability_type_id = ct.id AND fl.is_active = true AND cf.is_active = true
    ) as total_features,
    -- Count of enabled features for this tier
    (
        SELECT COUNT(*)
        FROM capability_features cf
        JOIN features_list fl ON cf.feature_id = fl.id
        LEFT JOIN tier_feature_overrides tfo ON tcl.id = tfo.tier_capability_id AND fl.id = tfo.feature_id
        WHERE cf.capability_type_id = ct.id 
          AND fl.is_active = true 
          AND cf.is_active = true
          AND COALESCE(tfo.is_enabled, true) = true
    ) as enabled_features
FROM subscription_tiers_list stl
JOIN tier_capabilities_list tcl ON stl.id = tcl.tier_id
JOIN capability_types ct ON tcl.capability_type_id = ct.id
WHERE stl.is_active = true
  AND ct.is_active = true
  AND tcl.is_enabled = true
ORDER BY stl.sort_order, ct.sort_order, tcl.highlight_order;

-- 11. Create view for capability management (admin interface)
CREATE OR REPLACE VIEW capability_management_view AS
SELECT 
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    ct.category,
    ct.description,
    ct.sort_order as capability_sort_order,
    COUNT(tcl.id) as tier_count,
    STRING_AGG(stl.display_name, ', ' ORDER BY stl.sort_order) as tiers_with_capability,
    COUNT(cf.feature_id) as feature_count,
    STRING_AGG(fl.name, ', ' ORDER BY fl.sort_order) as features_in_capability,
    STRING_AGG(
        CASE WHEN tcl.is_highlighted THEN stl.display_name END,
        ', ' ORDER BY stl.sort_order
    ) FILTER (WHERE tcl.is_highlighted = true) as tiers_highlighting_capability
FROM capability_types ct
LEFT JOIN tier_capabilities_list tcl ON ct.id = tcl.capability_type_id AND tcl.is_enabled = true
LEFT JOIN subscription_tiers_list stl ON tcl.tier_id = stl.id
LEFT JOIN capability_features cf ON ct.id = cf.capability_type_id AND cf.is_active = true
LEFT JOIN features_list fl ON cf.feature_id = fl.id AND fl.is_active = true
WHERE ct.is_active = true
GROUP BY ct.id, ct.key, ct.name, ct.category, ct.description, ct.sort_order
ORDER BY ct.sort_order;
