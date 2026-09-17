-- 047_bsaas_catalog.sql
-- Creates the bsaas_catalog table for self-service à la carte feature purchases.
-- Follows the same pattern as capability_type_list → features_list → capability_features_list.
--
-- bsaas_catalog links a feature_key (from features_list) to pricing metadata,
-- making it available for self-service purchase via the tenant-facing API.
-- Admins manage catalog entries via the admin UI (add features, set pricing).
--
-- Flow:
--   features_list → bsaas_catalog (marks feature as purchasable + pricing)
--   tenant_feature_purchases (actual purchases by tenants)
--   EffectiveCapabilityResolver (auto-merges active purchases into capabilities)

CREATE TABLE IF NOT EXISTS bsaas_catalog (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key     TEXT        NOT NULL,
  marketing_name  TEXT,
  description     TEXT,
  price_cents     INTEGER     NOT NULL CHECK (price_cents > 0),
  billing_cycle   VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('one_time', 'monthly', 'annual')),
  trial_days      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bsaas_catalog_feature_key_unique UNIQUE (feature_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bsaas_catalog_active ON bsaas_catalog (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_bsaas_catalog_feature_key ON bsaas_catalog (feature_key);

-- Seed initial catalog entries
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES
  ('chatbot_skill_crm_assistant', 'CRM Assistant Skill', 'AI-powered support ticket creation, inquiry lookup, and CRM context injection for your bot.', 1900, 'monthly', 0, true, 1),
  ('chatbot_external_embed', 'External Bot Embed', 'Embed your bot widget on external sites (WordPress, custom sites) with an embed key.', 900, 'monthly', 0, true, 2),
  ('chatbot_skill_order_tracking', 'Order Tracking Skill', 'Let your bot look up customer order status and shipping details in real time.', 1200, 'monthly', 0, true, 3),
  ('chatbot_skill_cross_merchant', 'Cross-Merchant Search Skill', 'Enable your bot to search products across all merchants on the platform.', 2400, 'monthly', 0, true, 4)
ON CONFLICT (feature_key) DO NOTHING;
