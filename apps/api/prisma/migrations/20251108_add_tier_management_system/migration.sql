-- Phase 1: Tier Management System Database Schema
-- This migration creates tables for database-driven tier and feature management

-- ============================================================================
-- TIERS TABLE
-- ============================================================================
-- Stores tier definitions (pricing, limits, metadata)
CREATE TABLE IF NOT EXISTS "tiers" (
  "id" VARCHAR(50) PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "display_name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "price_monthly" DECIMAL(10,2) NOT NULL,
  "price_annual" DECIMAL(10,2),
  "sku_limit" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for active tiers ordered by sort_order
CREATE INDEX IF NOT EXISTS "idx_tiers_active_sort" ON "tiers"("is_active", "sort_order");

-- ============================================================================
-- FEATURES TABLE
-- ============================================================================
-- Stores feature definitions
CREATE TABLE IF NOT EXISTS "features" (
  "id" VARCHAR(50) PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "display_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "category" VARCHAR(50),  -- 'core', 'premium', 'enterprise', 'organization'
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for active features by category
CREATE INDEX IF NOT EXISTS "idx_features_active_category" ON "features"("is_active", "category");

-- ============================================================================
-- TIER_FEATURES TABLE (Many-to-Many)
-- ============================================================================
-- Maps which features belong to which tiers
CREATE TABLE IF NOT EXISTS "tier_features" (
  "tier_id" VARCHAR(50) NOT NULL REFERENCES "tiers"("id") ON DELETE CASCADE,
  "feature_id" VARCHAR(50) NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
  "is_inherited" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tier_id", "feature_id")
);

-- Index for querying features by tier
CREATE INDEX IF NOT EXISTS "idx_tier_features_tier" ON "tier_features"("tier_id");

-- Index for querying tiers by feature
CREATE INDEX IF NOT EXISTS "idx_tier_features_feature" ON "tier_features"("feature_id");

-- ============================================================================
-- TIER_HIERARCHY TABLE
-- ============================================================================
-- Defines tier inheritance (e.g., Professional inherits from Starter)
CREATE TABLE IF NOT EXISTS "tier_hierarchy" (
  "tier_id" VARCHAR(50) NOT NULL REFERENCES "tiers"("id") ON DELETE CASCADE,
  "inherits_from_tier_id" VARCHAR(50) NOT NULL REFERENCES "tiers"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tier_id", "inherits_from_tier_id"),
  -- Prevent self-inheritance
  CONSTRAINT "no_self_inheritance" CHECK ("tier_id" != "inherits_from_tier_id")
);

-- Index for querying inheritance relationships
CREATE INDEX IF NOT EXISTS "idx_tier_hierarchy_tier" ON "tier_hierarchy"("tier_id");
CREATE INDEX IF NOT EXISTS "idx_tier_hierarchy_parent" ON "tier_hierarchy"("inherits_from_tier_id");

-- ============================================================================
-- TIER_CHANGES_AUDIT TABLE
-- ============================================================================
-- Audit log for all tier/feature changes
CREATE TABLE IF NOT EXISTS "tier_changes_audit" (
  "id" VARCHAR(50) PRIMARY KEY,
  "entity_type" VARCHAR(50) NOT NULL,  -- 'tier', 'feature', 'tier_feature', 'tier_hierarchy'
  "entity_id" VARCHAR(100) NOT NULL,
  "action" VARCHAR(20) NOT NULL,  -- 'create', 'update', 'delete'
  "old_value" JSONB,
  "new_value" JSONB,
  "changed_by" VARCHAR(50),  -- user_id
  "changed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "metadata" JSONB DEFAULT '{}'
);

-- Index for querying audit log by entity
CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "tier_changes_audit"("entity_type", "entity_id");

-- Index for querying audit log by user
CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "tier_changes_audit"("changed_by");

-- Index for querying audit log by date
CREATE INDEX IF NOT EXISTS "idx_audit_date" ON "tier_changes_audit"("changed_at" DESC);

-- ============================================================================
-- SEED DATA: Migrate existing hardcoded tiers
-- ============================================================================

-- Insert tiers
INSERT INTO "tiers" ("id", "name", "display_name", "description", "price_monthly", "price_annual", "sku_limit", "sort_order") VALUES
  ('google_only', 'google_only', 'Google-Only', 'Get discovered on Google instantly', 29.00, NULL, 250, 1),
  ('starter', 'starter', 'Starter', 'Perfect for single-location retailers', 49.00, NULL, 500, 2),
  ('professional', 'professional', 'Professional', 'Ideal for established retail businesses', 499.00, NULL, 5000, 3),
  ('enterprise', 'enterprise', 'Enterprise', 'For large single-location operations', 999.00, NULL, NULL, 4),
  ('organization', 'organization', 'Organization', 'For franchise chains & multi-location businesses', 999.00, NULL, 10000, 5),
  ('chain_starter', 'chain_starter', 'Chain Starter', 'Multi-location starter tier', 199.00, NULL, 500, 6),
  ('chain_professional', 'chain_professional', 'Chain Professional', 'Multi-location professional tier', 1999.00, NULL, 5000, 7),
  ('chain_enterprise', 'chain_enterprise', 'Chain Enterprise', 'Multi-location enterprise tier', 4999.00, NULL, NULL, 8)
ON CONFLICT ("id") DO NOTHING;

-- Insert features
INSERT INTO "features" ("id", "name", "display_name", "description", "category") VALUES
  -- Google-Only features
  ('google_shopping', 'google_shopping', 'Google Shopping Feed', 'Automatic Google Shopping feed generation', 'core'),
  ('google_merchant_center', 'google_merchant_center', 'Google Merchant Center', 'Google Merchant Center sync', 'core'),
  ('basic_product_pages', 'basic_product_pages', 'Basic Product Pages', 'Simple product landing pages', 'core'),
  ('qr_codes_512', 'qr_codes_512', 'QR Codes (512px)', 'QR code generation at 512px resolution', 'core'),
  ('performance_analytics', 'performance_analytics', 'Performance Analytics', 'Basic performance tracking', 'core'),
  
  -- Starter features
  ('storefront', 'storefront', 'Public Storefront', 'Complete public-facing storefront', 'core'),
  ('product_search', 'product_search', 'Product Search', 'Product search functionality', 'core'),
  ('mobile_responsive', 'mobile_responsive', 'Mobile-Responsive Design', 'Mobile-optimized layouts', 'core'),
  ('enhanced_seo', 'enhanced_seo', 'Enhanced SEO', 'Advanced SEO optimization', 'core'),
  ('basic_categories', 'basic_categories', 'Basic Categories', 'Product categorization', 'core'),
  
  -- Professional features
  ('quick_start_wizard', 'quick_start_wizard', 'Quick Start Wizard', 'Generate 50-100 products instantly', 'premium'),
  ('product_scanning', 'product_scanning', 'Product Scanning', 'Barcode scanning with data enrichment', 'premium'),
  ('gbp_integration', 'gbp_integration', 'Google Business Profile Integration', 'Full GBP sync and management', 'premium'),
  ('custom_branding', 'custom_branding', 'Custom Branding', 'Custom colors and branding', 'premium'),
  ('business_logo', 'business_logo', 'Business Logo', 'Upload and display business logo', 'premium'),
  ('qr_codes_1024', 'qr_codes_1024', 'QR Codes (1024px)', 'QR code generation at 1024px resolution', 'premium'),
  ('image_gallery_5', 'image_gallery_5', '5-Image Gallery', 'Product image galleries (5 photos)', 'premium'),
  ('interactive_maps', 'interactive_maps', 'Interactive Maps', 'Interactive store location maps', 'premium'),
  ('privacy_mode', 'privacy_mode', 'Privacy Mode', 'Privacy mode for location display', 'premium'),
  ('custom_marketing_copy', 'custom_marketing_copy', 'Custom Marketing Copy', 'Custom marketing text', 'premium'),
  ('priority_support', 'priority_support', 'Priority Support', 'Priority customer support', 'premium'),
  
  -- Enterprise features
  ('unlimited_skus', 'unlimited_skus', 'Unlimited SKUs', 'No SKU limits', 'enterprise'),
  ('white_label', 'white_label', 'White Label Branding', 'Remove all platform branding', 'enterprise'),
  ('custom_domain', 'custom_domain', 'Custom Domain', 'Use your own domain', 'enterprise'),
  ('qr_codes_2048', 'qr_codes_2048', 'QR Codes (2048px)', 'QR code generation at 2048px resolution', 'enterprise'),
  ('image_gallery_10', 'image_gallery_10', '10-Image Gallery', 'Product image galleries (10 photos)', 'enterprise'),
  ('api_access', 'api_access', 'API Access', 'Full API access for integrations', 'enterprise'),
  ('advanced_analytics', 'advanced_analytics', 'Advanced Analytics', 'Advanced analytics and reporting', 'enterprise'),
  ('dedicated_account_manager', 'dedicated_account_manager', 'Dedicated Account Manager', 'Personal account manager', 'enterprise'),
  ('sla_guarantee', 'sla_guarantee', 'SLA Guarantee', 'Service level agreement', 'enterprise'),
  ('custom_integrations', 'custom_integrations', 'Custom Integrations', 'Custom integration development', 'enterprise'),
  
  -- Organization features
  ('propagation_products', 'propagation_products', 'Product Propagation', 'Propagate products across locations', 'organization'),
  ('propagation_categories', 'propagation_categories', 'Category Propagation', 'Propagate categories across locations', 'organization'),
  ('propagation_gbp_sync', 'propagation_gbp_sync', 'GBP Sync Propagation', 'Propagate GBP sync across locations', 'organization'),
  ('propagation_hours', 'propagation_hours', 'Hours Propagation', 'Propagate business hours across locations', 'organization'),
  ('propagation_profile', 'propagation_profile', 'Profile Propagation', 'Propagate profile data across locations', 'organization'),
  ('propagation_flags', 'propagation_flags', 'Flag Propagation', 'Propagate feature flags across locations', 'organization'),
  ('propagation_roles', 'propagation_roles', 'Role Propagation', 'Propagate user roles across locations', 'organization'),
  ('propagation_brand', 'propagation_brand', 'Brand Propagation', 'Propagate brand assets across locations', 'organization'),
  ('organization_dashboard', 'organization_dashboard', 'Organization Dashboard', 'Chain-wide analytics dashboard', 'organization'),
  ('hero_location', 'hero_location', 'Hero Location', 'Designate hero location for testing', 'organization'),
  ('strategic_testing', 'strategic_testing', 'Strategic Testing', 'Test on single location before rollout', 'organization'),
  ('unlimited_locations', 'unlimited_locations', 'Unlimited Locations', 'No location limits', 'organization'),
  ('shared_sku_pool', 'shared_sku_pool', 'Shared SKU Pool', 'Shared SKU pool across locations', 'organization'),
  ('centralized_control', 'centralized_control', 'Centralized Control', 'Centralized management controls', 'organization'),
  
  -- Chain features
  ('multi_location_5', 'multi_location_5', '5 Locations', 'Support for 5 locations', 'core'),
  ('multi_location_25', 'multi_location_25', '25 Locations', 'Support for 25 locations', 'premium'),
  ('basic_propagation', 'basic_propagation', 'Basic Propagation', 'Basic propagation features', 'premium'),
  ('advanced_propagation', 'advanced_propagation', 'Advanced Propagation', 'Advanced propagation features', 'enterprise')
ON CONFLICT ("id") DO NOTHING;

-- Insert tier-feature mappings (google_only)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('google_only', 'google_shopping'),
  ('google_only', 'google_merchant_center'),
  ('google_only', 'basic_product_pages'),
  ('google_only', 'qr_codes_512'),
  ('google_only', 'performance_analytics')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (starter)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('starter', 'storefront'),
  ('starter', 'product_search'),
  ('starter', 'mobile_responsive'),
  ('starter', 'enhanced_seo'),
  ('starter', 'basic_categories')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (professional)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('professional', 'quick_start_wizard'),
  ('professional', 'product_scanning'),
  ('professional', 'gbp_integration'),
  ('professional', 'custom_branding'),
  ('professional', 'business_logo'),
  ('professional', 'qr_codes_1024'),
  ('professional', 'image_gallery_5'),
  ('professional', 'interactive_maps'),
  ('professional', 'privacy_mode'),
  ('professional', 'custom_marketing_copy'),
  ('professional', 'priority_support')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (enterprise)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('enterprise', 'unlimited_skus'),
  ('enterprise', 'white_label'),
  ('enterprise', 'custom_domain'),
  ('enterprise', 'qr_codes_2048'),
  ('enterprise', 'image_gallery_10'),
  ('enterprise', 'api_access'),
  ('enterprise', 'advanced_analytics'),
  ('enterprise', 'dedicated_account_manager'),
  ('enterprise', 'sla_guarantee'),
  ('enterprise', 'custom_integrations')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (organization)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('organization', 'propagation_products'),
  ('organization', 'propagation_categories'),
  ('organization', 'propagation_gbp_sync'),
  ('organization', 'propagation_hours'),
  ('organization', 'propagation_profile'),
  ('organization', 'propagation_flags'),
  ('organization', 'propagation_roles'),
  ('organization', 'propagation_brand'),
  ('organization', 'organization_dashboard'),
  ('organization', 'hero_location'),
  ('organization', 'strategic_testing'),
  ('organization', 'unlimited_locations'),
  ('organization', 'shared_sku_pool'),
  ('organization', 'centralized_control'),
  ('organization', 'api_access')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (chain_starter)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('chain_starter', 'storefront'),
  ('chain_starter', 'product_search'),
  ('chain_starter', 'mobile_responsive'),
  ('chain_starter', 'enhanced_seo'),
  ('chain_starter', 'multi_location_5')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (chain_professional)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('chain_professional', 'quick_start_wizard'),
  ('chain_professional', 'product_scanning'),
  ('chain_professional', 'gbp_integration'),
  ('chain_professional', 'custom_branding'),
  ('chain_professional', 'qr_codes_1024'),
  ('chain_professional', 'image_gallery_5'),
  ('chain_professional', 'multi_location_25'),
  ('chain_professional', 'basic_propagation')
ON CONFLICT DO NOTHING;

-- Insert tier-feature mappings (chain_enterprise)
INSERT INTO "tier_features" ("tier_id", "feature_id") VALUES
  ('chain_enterprise', 'unlimited_skus'),
  ('chain_enterprise', 'white_label'),
  ('chain_enterprise', 'custom_domain'),
  ('chain_enterprise', 'qr_codes_2048'),
  ('chain_enterprise', 'image_gallery_10'),
  ('chain_enterprise', 'api_access'),
  ('chain_enterprise', 'unlimited_locations'),
  ('chain_enterprise', 'advanced_propagation'),
  ('chain_enterprise', 'dedicated_account_manager')
ON CONFLICT DO NOTHING;

-- Insert tier hierarchy (inheritance relationships)
INSERT INTO "tier_hierarchy" ("tier_id", "inherits_from_tier_id") VALUES
  -- Individual tiers
  ('starter', 'google_only'),
  ('professional', 'starter'),
  ('professional', 'google_only'),
  ('enterprise', 'professional'),
  ('enterprise', 'starter'),
  ('enterprise', 'google_only'),
  ('organization', 'professional'),
  ('organization', 'starter'),
  ('organization', 'google_only'),
  
  -- Chain tiers
  ('chain_starter', 'starter'),
  ('chain_starter', 'google_only'),
  ('chain_professional', 'professional'),
  ('chain_professional', 'starter'),
  ('chain_professional', 'google_only'),
  ('chain_enterprise', 'enterprise'),
  ('chain_enterprise', 'professional'),
  ('chain_enterprise', 'starter'),
  ('chain_enterprise', 'google_only')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tiers table
DROP TRIGGER IF EXISTS update_tiers_updated_at ON "tiers";
CREATE TRIGGER update_tiers_updated_at
  BEFORE UPDATE ON "tiers"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for features table
DROP TRIGGER IF EXISTS update_features_updated_at ON "features";
CREATE TRIGGER update_features_updated_at
  BEFORE UPDATE ON "features"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "tiers" IS 'Subscription tier definitions with pricing and limits';
COMMENT ON TABLE "features" IS 'Feature definitions available across tiers';
COMMENT ON TABLE "tier_features" IS 'Many-to-many mapping of tiers to features';
COMMENT ON TABLE "tier_hierarchy" IS 'Tier inheritance relationships for feature inheritance';
COMMENT ON TABLE "tier_changes_audit" IS 'Audit log for all tier and feature changes';

COMMENT ON COLUMN "tiers"."sku_limit" IS 'Maximum SKUs allowed (NULL = unlimited)';
COMMENT ON COLUMN "tiers"."sort_order" IS 'Display order (lower = first)';
COMMENT ON COLUMN "tier_features"."is_inherited" IS 'True if feature is inherited from parent tier';
COMMENT ON COLUMN "tier_hierarchy"."inherits_from_tier_id" IS 'Parent tier to inherit features from';
