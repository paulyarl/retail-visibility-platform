-- ============================================================
-- Platform Services Capability Type Seed Migration
--
-- Seeds the platform_services capability type, feature keys,
-- capability-feature links, tier assignments, and bsaas_catalog
-- entries for one-time professional services (logo design, banners,
-- store setup, profile setup, SEO optimization, social media kit).
--
-- Key differences from other capabilities:
--   - No merchant settings table (no merchant gate)
--   - No merchant prefs in resolver (features only)
--   - One-time billing (not recurring)
--   - All tiers get platform_services_enabled=true (bypass engagement check)
--   - Individual service keys NOT in any tier — purchasable only via BSaaS store
--   - Fulfillment tracked via CRM tickets/tasks/alerts (existing architecture)
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, bsaas_catalog tables must exist
-- Date: 2026-07-13
-- ============================================================


-- ============================================================
-- STEP 1: Insert platform_services feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('platform_services_enabled',          'Platform Services Enabled',          'Master ON gate for platform services capability',                 'platform_services', true, 0, NOW(), NOW()),
  ('platform_services_disabled',         'Platform Services Disabled',         'Explicit deactivation gate for platform services',                'platform_services', true, 1, NOW(), NOW()),
  ('platform_service_logo_design',       'Professional Logo Design',           'Custom logo design by platform design team — 3 concepts, final delivery in PNG/SVG/PDF', 'platform_services', true, 10, NOW(), NOW()),
  ('platform_service_banner_design',     'Banner Design',                      'Custom banner design for storefront or marketing — 2 variations, final delivery in required formats', 'platform_services', true, 11, NOW(), NOW()),
  ('platform_service_store_setup',       'Store Setup Assistance',             'Full storefront setup — layout, hours, contact info, policies, initial product catalog', 'platform_services', true, 12, NOW(), NOW()),
  ('platform_service_profile_setup',     'Profile Optimization',               'Business profile audit and optimization — info, photos, descriptions for SEO', 'platform_services', true, 13, NOW(), NOW()),
  ('platform_service_seo_optimization',  'SEO Optimization',                   'On-page + local SEO — meta tags, headings, content, Google Business Profile setup', 'platform_services', true, 14, NOW(), NOW()),
  ('platform_service_social_media_kit',  'Social Media Kit',                   'Social media template designs for each platform — includes usage guide', 'platform_services', true, 15, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 2: Create platform_services capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'platform_services',
  'Platform Services',
  'Professional services offered by the platform team — logo design, banners, store setup, profile optimization, SEO, and social media kits. One-time billing, human fulfillment via CRM.',
  'platform_services',
  true,
  7,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 3: Link platform_services features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'platform_services';
  v_feature_keys         TEXT[] := ARRAY[
    'platform_services_enabled',
    'platform_services_disabled',
    'platform_service_logo_design',
    'platform_service_banner_design',
    'platform_service_store_setup',
    'platform_service_profile_setup',
    'platform_service_seo_optimization',
    'platform_service_social_media_kit'
  ];
  v_capability_type_id TEXT;
  v_feature_id TEXT;
  v_idx INT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_feature_keys[i] LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
      CONTINUE;
    END IF;

    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_capability_type_id, v_feature_id, true, i, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true,
      sort_order = i,
      updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1), v_capability_type_key;
END $$;


-- ============================================================
-- STEP 4: Assign tier features
-- ============================================================
-- All tiers get _enabled=true and _disabled=false (explicit engagement bypass).
-- Individual service keys are NOT assigned to any tier — purchasable only via BSaaS store.
-- This ensures checkCapabilityEngagement() passes for all merchants regardless of tier.

DO $$
DECLARE
  v_cap_type_id   TEXT;
  v_tier_id       TEXT;
  v_tier_key      TEXT;

  v_all_tiers     TEXT[] := ARRAY[
    'discovery', 'starter', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
    'professional', 'enterprise', 'organization',
    'chain_starter', 'chain_professional', 'chain_enterprise',
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise'
  ];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'platform_services' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type platform_services not found';
  END IF;

  -- All tiers — _enabled=true, _disabled=false
  FOREACH v_tier_key IN ARRAY v_all_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'platform_services_enabled',  'Platform Services Enabled',  true,  false, '{"capability_type": "platform_services"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'platform_services_disabled', 'Platform Services Disabled', false, false, '{"capability_type": "platform_services"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Platform services tier features assigned';
END $$;


-- ============================================================
-- STEP 5: Add service entries to bsaas_catalog
-- ============================================================
-- All services are one_time billing, no trial, not private (visible in Feature Store).

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES
  (
    'platform_service_logo_design',
    'Professional Logo Design',
    'Custom logo design by our platform design team. Includes 3 concepts, 2 rounds of revisions, and final delivery in PNG, SVG, and PDF formats.',
    29900,
    'one_time',
    0,
    true,
    70,
    false,
    false,
    false
  ),
  (
    'platform_service_banner_design',
    'Banner Design',
    'Custom banner design for your storefront or marketing campaigns. Includes 2 variations, 1 round of revisions, and final delivery in required formats.',
    14900,
    'one_time',
    0,
    true,
    71,
    false,
    false,
    false
  ),
  (
    'platform_service_store_setup',
    'Store Setup Assistance',
    'Full storefront setup by our team — layout configuration, business hours, contact info, policies, and initial product catalog setup (up to 50 products).',
    49900,
    'one_time',
    0,
    true,
    72,
    false,
    false,
    false
  ),
  (
    'platform_service_profile_setup',
    'Profile Optimization',
    'Business profile audit and optimization — update info, photos, and descriptions for maximum SEO impact and customer engagement.',
    19900,
    'one_time',
    0,
    true,
    73,
    false,
    false,
    false
  ),
  (
    'platform_service_seo_optimization',
    'SEO Optimization',
    'On-page and local SEO optimization — meta tags, headings, content optimization, image alt text, and Google Business Profile configuration.',
    39900,
    'one_time',
    0,
    true,
    74,
    false,
    false,
    false
  ),
  (
    'platform_service_social_media_kit',
    'Social Media Kit',
    'Custom social media template designs for Instagram, Facebook, and TikTok. Includes profile headers, post templates, and a usage guide.',
    24900,
    'one_time',
    0,
    true,
    75,
    false,
    false,
    false
  )
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  trial_eligible = EXCLUDED.trial_eligible,
  demo_eligible  = EXCLUDED.demo_eligible,
  is_private     = EXCLUDED.is_private;


-- ============================================================
-- STEP 6: Link capability type to a representative tier (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'platform_services'
  AND ct.tier_id IS NULL;


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify capability type
-- SELECT key, name, description, category, is_active, sort_order FROM capability_type_list WHERE key = 'platform_services';

-- Verify features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'platform_services' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'platform_services'
--   ORDER BY cf.sort_order;

-- Verify tier features for Professional
-- SELECT tf.feature_key, tf.feature_name, tf.is_enabled FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'platform_service%'
--   ORDER BY tf.feature_key;

-- Verify bsaas_catalog entries
-- SELECT feature_key, marketing_name, price_cents, billing_cycle, is_active FROM bsaas_catalog WHERE feature_key LIKE 'platform_service_%' ORDER BY sort_order;
