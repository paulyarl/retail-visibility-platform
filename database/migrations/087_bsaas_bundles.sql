-- 087_bsaas_bundles.sql
-- Creates bsaas_bundles + bsaas_bundle_items tables and seeds the
-- Customer Engagement Suite as the first cross-domain bundle.
-- Also adds flexible toggle keys to bsaas_catalog for individual sale.

-- ───────────────────────────────────────────────────────────
-- 1. Create bsaas_bundles table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bsaas_bundles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_key      TEXT        NOT NULL UNIQUE,
  marketing_name  TEXT        NOT NULL,
  description     TEXT,
  price_cents     INTEGER     NOT NULL CHECK (price_cents > 0),
  billing_cycle   VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('one_time', 'monthly', 'annual')),
  trial_days      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsaas_bundles_active ON bsaas_bundles (is_active, sort_order);

-- ───────────────────────────────────────────────────────────
-- 2. Create bsaas_bundle_items table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bsaas_bundle_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       UUID        NOT NULL REFERENCES bsaas_bundles(id) ON DELETE CASCADE,
  feature_key     TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bundle_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_bsaas_bundle_items_bundle ON bsaas_bundle_items (bundle_id);
CREATE INDEX IF NOT EXISTS idx_bsaas_bundle_items_feature ON bsaas_bundle_items (feature_key);

-- ───────────────────────────────────────────────────────────
-- 3. Seed Customer Engagement Suite bundle
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'customer_engagement_suite',
  'Customer Engagement Suite',
  'Unlock full Chatbot, CRM, and FAQ capabilities in one bundle. Get all AI bot skills, dynamic GPT responses, RAG knowledge base, complete CRM with tickets/inquiries/templates, and full FAQ management with chatbot KB integration.',
  7900,
  'monthly',
  14,
  true,
  200
)
ON CONFLICT (bundle_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

-- Seed bundle items
INSERT INTO bsaas_bundle_items (bundle_id, feature_key, sort_order)
SELECT b.id, f.feature_key, f.sort_order
FROM (VALUES
  ('chatbot_flexible', 1),
  ('crm_flexible', 2),
  ('faq_flexible', 3)
) AS f(feature_key, sort_order)
JOIN bsaas_bundles b ON b.bundle_key = 'customer_engagement_suite'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 4. Add flexible toggle keys to bsaas_catalog for individual sale
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES
  ('chatbot_flexible', 'Chatbot — Full Access', 'Unlock all chatbot features: AI responses, dedicated engine, RAG knowledge base, all skills, custom widget themes, and external embed.', 4900, 'monthly', 14, true, 100),
  ('crm_flexible', 'CRM — Full Access', 'Unlock all CRM features: contact import/sync, dashboard analytics, message templates, attachments, ticket management, inquiries, and requests hub.', 3900, 'monthly', 14, true, 101),
  ('faq_flexible', 'FAQ — Full Access', 'Unlock all FAQ features: knowledge base, management hub, CSV import, drag-and-drop reorder, bot preview, gap report, and templates.', 1900, 'monthly', 14, true, 102)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();
