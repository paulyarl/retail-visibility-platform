-- 043: Per-tenant storefront policies
-- Adds tenant_storefront_policies table for return/shipping/privacy/terms/refund policies
-- Linked to storefront_types capability type

CREATE TABLE IF NOT EXISTS tenant_storefront_policies (
  id              VARCHAR(255) PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL,
  return_policy   TEXT,
  shipping_policy TEXT,
  privacy_policy  TEXT,
  terms_of_service TEXT,
  refund_policy   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_storefront_policies_tenant UNIQUE (tenant_id),
  CONSTRAINT fk_storefront_policies_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_storefront_policies_tenant
  ON tenant_storefront_policies(tenant_id);

-- Add feature key for policy management under storefront_types capability
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_policies',
  'Storefront Policies',
  'Per-tenant return, shipping, privacy, terms, and refund policy pages for storefront compliance',
  NULL,
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Link to storefront_types capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
VALUES (
  (SELECT id FROM capability_type_list WHERE key = 'storefront_types'),
  (SELECT id FROM features_list WHERE key = 'storefront_policies'),
  true,
  0
)
ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
  is_active = true,
  sort_order = 0;

-- Enable for all existing tiers
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  stl.id,
  'storefront_policies',
  'Storefront Policies',
  (SELECT id FROM capability_type_list WHERE key = 'storefront_types'),
  true,
  NOW(),
  NOW()
FROM subscription_tiers_list stl
WHERE NOT EXISTS (
  SELECT 1 FROM tier_features_list tfl
  WHERE tfl.tier_id = stl.id AND tfl.feature_key = 'storefront_policies'
);
