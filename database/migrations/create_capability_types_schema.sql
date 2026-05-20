-- Create normalized capability types schema
-- This replaces metadata-based storage with proper relational structure

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

-- 2. Features Table (individual features that can be enabled)
CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Capability Features Junction Table
-- Links capability types to specific features
CREATE TABLE IF NOT EXISTS capability_features (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    capability_type_id TEXT NOT NULL REFERENCES capability_types(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    restrictions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(capability_type_id, feature_id)
);

-- 4. Update tier_features_list to reference proper feature relationships
-- Add foreign key to features table
ALTER TABLE tier_features_list 
ADD COLUMN IF NOT EXISTS feature_id TEXT REFERENCES features(id) ON DELETE CASCADE;

-- Add foreign key to capability_types (optional - can be inferred)
ALTER TABLE tier_features_list 
ADD COLUMN IF NOT EXISTS capability_type_id TEXT REFERENCES capability_types(id) ON DELETE CASCADE;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_capability_types_key ON capability_types(key);
CREATE INDEX IF NOT EXISTS idx_features_key ON features(key);
CREATE INDEX IF NOT EXISTS idx_features_category ON features(category);
CREATE INDEX IF NOT EXISTS idx_capability_features_type_id ON capability_features(capability_type_id);
CREATE INDEX IF NOT EXISTS idx_capability_features_feature_id ON capability_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_feature_id ON tier_features_list(feature_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_capability_type_id ON tier_features_list(capability_type_id);

-- 6. Populate initial capability types
INSERT INTO capability_types (key, name, description) VALUES
('product_types', 'Product Types', 'Types of products merchants can create and manage'),
('creation_methods', 'Creation Methods', 'Methods for creating products and content'),
('payment_methods', 'Payment Methods', 'Payment processing capabilities'),
('analytics', 'Analytics', 'Data analysis and reporting features'),
('marketing', 'Marketing', 'Marketing and promotional tools'),
('integrations', 'Integrations', 'Third-party service integrations')
ON CONFLICT (key) DO NOTHING;

-- 7. Populate product type features
INSERT INTO features (key, name, description, category) VALUES
('physical_product', 'Physical Product', 'Create tangible goods with inventory management', 'product_types'),
('digital_product', 'Digital Product', 'Create downloadable products and digital content', 'product_types'),
('hybrid_product', 'Hybrid Product', 'Create products with both physical and digital components', 'product_types'),
('custom_product', 'Custom Product', 'Create products with custom attributes and configurations', 'product_types'),
('service_product', 'Service Product', 'Create service-based offerings', 'product_types'),
('subscription_product', 'Subscription Product', 'Create recurring subscription products', 'product_types')
ON CONFLICT (key) DO NOTHING;

-- 8. Link capability types to features
INSERT INTO capability_features (capability_type_id, feature_id, restrictions) VALUES
-- Product Types capabilities
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features WHERE key = 'physical_product'),
    '{"max_items": 10, "tier_requirement": "discovery"}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features WHERE key = 'digital_product'),
    '{"max_items": 100, "tier_requirement": "storefront"}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features WHERE key = 'hybrid_product'),
    '{"max_items": 1000, "tier_requirement": "professional"}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features WHERE key = 'custom_product'),
    '{"max_items": 1000, "tier_requirement": "professional"}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features WHERE key = 'service_product'),
    '{"max_items": 500, "tier_requirement": "professional"}'
),
(
    (SELECT id FROM capability_types WHERE key = 'product_types'),
    (SELECT id FROM features WHERE key = 'subscription_product'),
    '{"max_items": 100, "tier_requirement": "enterprise"}'
)
ON CONFLICT (capability_type_id, feature_id) DO NOTHING;

-- 9. Update existing tier_features_list to use proper relationships
-- This migrates from feature_key to feature_id relationships
UPDATE tier_features_list 
SET feature_id = f.id
FROM features f
WHERE tier_features_list.feature_key = f.key
  AND tier_features_list.feature_id IS NULL;

UPDATE tier_features_list 
SET capability_type_id = ct.id
FROM capability_types ct
WHERE tier_features_list.metadata->>'capability_type' = ct.key
  AND tier_features_list.capability_type_id IS NULL;

-- 10. Create view for easy querying of tier capabilities
CREATE OR REPLACE VIEW tier_capabilities_view AS
SELECT 
    stl.tier_key,
    stl.display_name as tier_name,
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    f.key as feature_key,
    f.name as feature_name,
    f.description as feature_description,
    tfl.is_enabled,
    tfl.is_highlighted,
    tfl.highlight_order,
    tfl.marketing_name,
    cf.restrictions,
    tfl.metadata as legacy_metadata
FROM subscription_tiers_list stl
JOIN tier_features_list tfl ON stl.id = tfl.tier_id
LEFT JOIN features f ON tfl.feature_id = f.id
LEFT JOIN capability_types ct ON tfl.capability_type_id = ct.id
LEFT JOIN capability_features cf ON ct.id = cf.capability_type_id AND f.id = cf.feature_id
WHERE stl.is_active = true
  AND tfl.is_enabled = true
ORDER BY stl.sort_order, ct.key, tfl.highlight_order;

-- 11. Create view for capability management
CREATE OR REPLACE VIEW capability_management_view AS
SELECT 
    ct.key as capability_type_key,
    ct.name as capability_type_name,
    f.key as feature_key,
    f.name as feature_name,
    f.category,
    cf.restrictions,
    cf.is_active as capability_feature_active,
    COUNT(tfl.id) as tier_count,
    STRING_AGG(stl.display_name, ', ' ORDER BY stl.sort_order) as tiers_with_feature
FROM capability_types ct
JOIN capability_features cf ON ct.id = cf.capability_type_id
JOIN features f ON cf.feature_id = f.id
LEFT JOIN tier_features_list tfl ON cf.feature_id = tfl.feature_id AND cf.capability_type_id = tfl.capability_type_id
LEFT JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
WHERE ct.is_active = true
  AND f.is_active = true
GROUP BY ct.id, ct.key, ct.name, f.id, f.key, f.name, f.category, cf.restrictions, cf.is_active
ORDER BY ct.key, f.key;
