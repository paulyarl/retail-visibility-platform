-- Migration 372: Social Posting capability module registration
--
-- Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §5
--
-- Registers the `social_posting` capability type and its feature keys:
--   social_posting_enabled      — module on/off baseline
--   social_posting_flexible     — grants ALL module features
--   social_posting_meta         — Facebook Page posting
--   social_posting_instagram    — Instagram content publishing
--   social_posting_threads      — Threads publishing
--   social_posting_scheduler    — scheduled queue + lifecycle
--
-- Tier assignment ships DARK (§5.3): resolution works once the feature
-- ships, but no merchant surface links to it until the dogfood gate (§9
-- Phase 2) passes. VisibleShelf Internal (tid-sud4ky1c) gets its grant via
-- the admin-grant machinery, not this file.
--
-- Fixture-first note: shared/tier-contract.json capability_modules is
-- regenerated from the DB witness after this lands
-- (scripts/sync-fixture-modules.cjs).

-- ============================================================
-- 1. Feature keys
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('social_posting_enabled',    'Social Posting Enabled',    'Master switch for the Social Posting Suite',                    'social', true, 1,  NOW(), NOW()),
  ('social_posting_flexible',   'Social Posting Flexible',   'Grants all social posting surfaces and the scheduler',          'social', true, 2,  NOW(), NOW()),
  ('social_posting_meta',       'Facebook Page Posting',     'Publish and schedule posts to a connected Facebook Page',       'social', true, 10, NOW(), NOW()),
  ('social_posting_instagram',  'Instagram Publishing',      'Publish photo/video content to a connected Instagram account',  'social', true, 11, NOW(), NOW()),
  ('social_posting_threads',    'Threads Publishing',        'Publish posts to a connected Threads profile',                  'social', true, 12, NOW(), NOW()),
  ('social_posting_scheduler',  'Social Post Scheduler',     'Scheduled post queue with retry and lifecycle management',      'social', true, 20, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2. Capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'social_posting',
  'Social Posting Suite',
  'Compose, schedule, and publish posts to connected social platforms (Meta pilot: Facebook Page, Instagram, Threads)',
  'social',
  true,
  60,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- ============================================================
-- 3. Link features → module
-- ============================================================

INSERT INTO capability_features_list (capability_type_id, feature_id, is_active)
SELECT ct.id, f.id, true
FROM capability_type_list ct, features_list f
WHERE ct.key = 'social_posting'
  AND f.key IN (
    'social_posting_enabled',
    'social_posting_flexible',
    'social_posting_meta',
    'social_posting_instagram',
    'social_posting_threads',
    'social_posting_scheduler'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Tier assignments (§5.3 — ships dark)
--    flexible   → professional, organization, enterprise,
--                 chain_professional, chain_enterprise
--    meta only  → commitment, ecommerce, omnichannel
-- ============================================================

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier RECORD;
  v_flexible_tiers TEXT[] := ARRAY['professional', 'organization', 'enterprise', 'chain_professional', 'chain_enterprise'];
  v_meta_tiers     TEXT[] := ARRAY['commitment', 'ecommerce', 'omnichannel'];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'social_posting';
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'capability_type_list row for social_posting not found';
  END IF;

  -- Flexible tiers: enabled flag + flexible key (grants the whole module)
  FOR v_tier IN
    SELECT id, tier_key FROM subscription_tiers_list WHERE tier_key = ANY(v_flexible_tiers)
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier.id, v_cap_type_id, 'social_posting_enabled',  'Social Posting Enabled',  true, false, '{"capability_type": "social_posting"}'),
      (gen_random_uuid()::text, v_tier.id, v_cap_type_id, 'social_posting_flexible', 'Social Posting Flexible', true, false, '{"capability_type": "social_posting"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- Meta tiers: enabled flag + facebook surface only (no scheduler)
  FOR v_tier IN
    SELECT id, tier_key FROM subscription_tiers_list WHERE tier_key = ANY(v_meta_tiers)
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier.id, v_cap_type_id, 'social_posting_enabled', 'Social Posting Enabled',   true, false, '{"capability_type": "social_posting"}'),
      (gen_random_uuid()::text, v_tier.id, v_cap_type_id, 'social_posting_meta',    'Facebook Page Posting',    true, false, '{"capability_type": "social_posting"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;
END $$;
