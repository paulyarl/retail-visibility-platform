-- Create centralized features schema with consistent naming
-- features_list becomes the central repository for all features
-- tier_features_list references features_list for tier assignments

-- 1. Capability Types Table (categories of capabilities)
CREATE TABLE IF NOT EXISTS capability_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
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
-- Links capability types to specific features from the central features_list
CREATE TABLE IF NOT EXISTS capability_features (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    capability_type_id TEXT NOT NULL REFERENCES capability_types(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES features_list(id) ON DELETE CASCADE,
    restrictions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(capability_type_id, feature_id)
);

-- 4. Tier Features List Table (references central features_list)
-- This table ONLY stores which tiers have which features enabled
-- All feature details come from features_list table
CREATE TABLE IF NOT EXISTS tier_features_list (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tier_id TEXT NOT NULL REFERENCES subscription_tiers_list(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES features_list(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_inherited BOOLEAN NOT NULL DEFAULT false,
    is_highlighted BOOLEAN DEFAULT false,
    highlight_order INTEGER DEFAULT 0,
    highlight_description TEXT,
    marketing_name TEXT,
    tier_specific_restrictions JSONB, -- Tier-specific overrides of base restrictions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    UNIQUE(tier_id, feature_id)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_capability_types_key ON capability_types(key);
CREATE INDEX IF NOT EXISTS idx_features_list_key ON features_list(key);
CREATE INDEX IF NOT EXISTS idx_features_list_category ON features_list(category);
CREATE INDEX IF NOT EXISTS idx_features_list_capability_type_id ON features_list(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_features_list_active ON features_list(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_capability_features_type_id ON capability_features(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_capability_features_feature_id ON capability_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_tier_id ON tier_features_list(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_feature_id ON tier_features_list(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_enabled ON tier_features_list(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tier_features_highlighted ON tier_features_list(tier_id, is_highlighted, highlight_order) WHERE is_highlighted = true;

-- 6. Populate initial capability types
INSERT INTO capability_types (key, name, description) VALUES
('product_types', 'Product Types', 'Types of products merchants can create and manage'),
('creation_methods', 'Creation Methods', 'Methods for creating products and content'),
('payment_methods', 'Payment Methods', 'Payment processing capabilities'),
('analytics', 'Analytics', 'Data analysis and reporting features'),
('marketing', 'Marketing', 'Marketing and promotional tools'),
('integrations', 'Integrations', 'Third-party service integrations'),
('storefront', 'Storefront', 'Storefront customization and features'),
('inventory', 'Inventory', 'Inventory management capabilities'),
('shipping', 'Shipping', 'Shipping and fulfillment features'),
('customer_management', 'Customer Management', 'Customer relationship management')
ON CONFLICT (key) DO NOTHING;

-- 7. Populate central features_list with ALL system features
INSERT INTO features_list (key, name, description, category, capability_type_id, marketing_name, icon_name, sort_order) VALUES
-- Product Type Features
('physical_product', 'Physical Product', 'Create tangible goods with inventory management, shipping, and fulfillment', 'product_types', (SELECT id FROM capability_types WHERE key = 'product_types'), 'Physical Products', 'package', 1),
('digital_product', 'Digital Product', 'Create downloadable products, digital content, and license-based offerings', 'product_types', (SELECT id FROM capability_types WHERE key = 'product_types'), 'Digital Products', 'download', 2),
('hybrid_product', 'Hybrid Product', 'Create products with both physical and digital components', 'product_types', (SELECT id FROM capability_types WHERE key = 'product_types'), 'Hybrid Products', 'layers', 3),
('custom_product', 'Custom Product', 'Create products with custom attributes, variants, and configurations', 'product_types', (SELECT id FROM capability_types WHERE key = 'product_types'), 'Custom Products', 'settings', 4),
('service_product', 'Service Product', 'Create service-based offerings and appointments', 'product_types', (SELECT id FROM capability_types WHERE key = 'product_types'), 'Service Products', 'calendar', 5),
('subscription_product', 'Subscription Product', 'Create recurring subscription products and memberships', 'product_types', (SELECT id FROM capability_types WHERE key = 'product_types'), 'Subscription Products', 'repeat', 6),

-- Creation Method Features  
('bulk_import', 'Bulk Import', 'Import products in bulk from CSV/Excel files', 'creation_methods', (SELECT id FROM capability_types WHERE key = 'creation_methods'), 'Bulk Import', 'upload', 1),
('api_import', 'API Import', 'Import products via REST API integration', 'creation_methods', (SELECT id FROM capability_types WHERE key = 'creation_methods'), 'API Import', 'code', 2),
('manual_creation', 'Manual Creation', 'Create products manually through forms and wizards', 'creation_methods', (SELECT id FROM capability_types WHERE key = 'creation_methods'), 'Manual Creation', 'plus', 3),

-- Payment Method Features
('credit_card', 'Credit Card', 'Accept credit and debit card payments', 'payment_methods', (SELECT id FROM capability_types WHERE key = 'payment_methods'), 'Credit Cards', 'credit-card', 1),
('paypal', 'PayPal', 'Accept PayPal payments', 'payment_methods', (SELECT id FROM capability_types WHERE key = 'payment_methods'), 'PayPal', 'dollar-sign', 2),
('apple_pay', 'Apple Pay', 'Accept Apple Pay payments', 'payment_methods', (SELECT id FROM capability_types WHERE key = 'payment_methods'), 'Apple Pay', 'smartphone', 3),
('google_pay', 'Google Pay', 'Accept Google Pay payments', 'payment_methods', (SELECT id FROM capability_types WHERE key = 'payment_methods'), 'Google Pay', 'smartphone', 4),

-- Analytics Features
('basic_analytics', 'Basic Analytics', 'View basic sales and traffic reports', 'analytics', (SELECT id FROM capability_types WHERE key = 'analytics'), 'Basic Analytics', 'bar-chart', 1),
('advanced_analytics', 'Advanced Analytics', 'Advanced reporting with custom metrics and insights', 'analytics', (SELECT id FROM capability_types WHERE key = 'analytics'), 'Advanced Analytics', 'trending-up', 2),
('real_time_analytics', 'Real-time Analytics', 'Live data streaming and real-time monitoring', 'analytics', (SELECT id FROM capability_types WHERE key = 'analytics'), 'Real-time Analytics', 'activity', 3),

-- Marketing Features
('email_marketing', 'Email Marketing', 'Send marketing emails and newsletters', 'marketing', (SELECT id FROM capability_types WHERE key = 'marketing'), 'Email Marketing', 'mail', 1),
('social_media_integration', 'Social Media Integration', 'Connect and manage social media accounts', 'marketing', (SELECT id FROM capability_types WHERE key = 'marketing'), 'Social Media', 'share-2', 2),
('seo_tools', 'SEO Tools', 'Search engine optimization tools and insights', 'marketing', (SELECT id FROM capability_types WHERE key = 'marketing'), 'SEO Tools', 'search', 3),

-- Integration Features
('shopify_integration', 'Shopify Integration', 'Integrate with Shopify for product sync', 'integrations', (SELECT id FROM capability_types WHERE key = 'integrations'), 'Shopify', 'shopping-bag', 1),
('woocommerce_integration', 'WooCommerce Integration', 'Integrate with WooCommerce stores', 'integrations', (SELECT id FROM capability_types WHERE key = 'integrations'), 'WooCommerce', 'shopping-cart', 2),
('amazon_integration', 'Amazon Integration', 'Sell on Amazon marketplace', 'integrations', (SELECT id FROM capability_types WHERE key = 'integrations'), 'Amazon', 'package', 3)

ON CONFLICT (key) DO NOTHING;

-- 8. Link capability types to features (junction table)
INSERT INTO capability_features (capability_type_id, feature_id, restrictions) VALUES
-- Product Types capabilities with base restrictions
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features_list WHERE key = 'physical_product'),
    '{"base_max_items": 1000, "requires_inventory": true}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features_list WHERE key = 'digital_product'),
    '{"base_max_items": 1000, "requires_delivery": true}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features_list WHERE key = 'hybrid_product'),
    '{"base_max_items": 1000, "requires_inventory": true, "requires_delivery": true}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features_list WHERE key = 'custom_product'),
    '{"base_max_items": 1000, "requires_custom_attributes": true}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features_list WHERE key = 'service_product'),
    '{"base_max_items": 500, "requires_scheduling": true}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features_list WHERE key = 'subscription_product'),
    '{"base_max_items": 100, "requires_recurring": true}'
)

ON CONFLICT (capability_type_id, feature_id) DO NOTHING;

-- 9. Create comprehensive view for tier capabilities
CREATE OR REPLACE VIEW tier_capabilities_view AS
SELECT 
    stl.tier_key,
    stl.display_name as tier_name,
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    fl.key as feature_key,
    fl.name as feature_name,
    fl.description as feature_description,
    fl.category,
    fl.marketing_name as feature_marketing_name,
    fl.icon_name as feature_icon,
    tfl.is_enabled,
    tfl.is_highlighted,
    tfl.highlight_order,
    tfl.highlight_description,
    tfl.marketing_name as tier_marketing_name,
    tfl.tier_specific_restrictions,
    cf.restrictions as base_restrictions,
    -- Combine base and tier-specific restrictions
    COALESCE(tfl.tier_specific_restrictions, cf.restrictions) as effective_restrictions
FROM subscription_tiers_list stl
JOIN tier_features_list tfl ON stl.id = tfl.tier_id
JOIN features_list fl ON tfl.feature_id = fl.id
LEFT JOIN capability_types ct ON fl.capability_type_id = ct.id
LEFT JOIN capability_features cf ON ct.id = cf.capability_type_id AND fl.id = cf.feature_id
WHERE stl.is_active = true
  AND fl.is_active = true
  AND tfl.is_enabled = true
ORDER BY stl.sort_order, ct.sort_order, fl.sort_order, tfl.highlight_order;

-- 10. Create view for feature management (admin interface)
CREATE OR REPLACE VIEW feature_management_view AS
SELECT 
    fl.key as feature_key,
    fl.name as feature_name,
    fl.description,
    fl.category,
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    fl.marketing_name,
    fl.icon_name,
    fl.sort_order,
    fl.is_active as feature_active,
    cf.restrictions as base_restrictions,
    COUNT(tfl.id) as tier_count,
    STRING_AGG(
        CASE WHEN tfl.is_enabled THEN stl.display_name ELSE stl.display_name || ' (disabled)' END,
        ', ' ORDER BY stl.sort_order
    ) as tiers_with_feature,
    STRING_AGG(
        CASE WHEN tfl.is_highlighted THEN stl.display_name END,
        ', ' ORDER BY stl.sort_order
    ) FILTER (WHERE tfl.is_highlighted = true) as tiers_highlighting_feature
FROM features_list fl
LEFT JOIN capability_types ct ON fl.capability_type_id = ct.id
LEFT JOIN capability_features cf ON ct.id = cf.capability_type_id AND fl.id = cf.feature_id
LEFT JOIN tier_features_list tfl ON fl.id = tfl.feature_id
LEFT JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
WHERE fl.is_active = true
GROUP BY fl.id, fl.key, fl.name, fl.description, fl.category, ct.id, ct.key, ct.name, fl.marketing_name, fl.icon_name, fl.sort_order, fl.is_active, cf.restrictions
ORDER BY ct.sort_order, fl.sort_order;

-- 11. Create view for all available features by capability type
CREATE OR REPLACE VIEW capability_type_features_view AS
SELECT 
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    fl.key as feature_key,
    fl.name as feature_name,
    fl.description,
    fl.category,
    fl.marketing_name,
    fl.icon_name,
    fl.sort_order,
    cf.restrictions,
    cf.is_active as capability_feature_active
FROM capability_types ct
JOIN capability_features cf ON ct.id = cf.capability_type_id
JOIN features_list fl ON cf.feature_id = fl.id
WHERE ct.is_active = true
  AND fl.is_active = true
  AND cf.is_active = true
ORDER BY ct.sort_order, fl.sort_order;
