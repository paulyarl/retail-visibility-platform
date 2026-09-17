-- 044: Chatbot skill — policy-faq
-- Adds chatbot_skill_policy_faq feature key linked to chatbot_options capability type
-- Enables policy Q&A bot skill for all tiers with chatbot access

-- Insert feature key
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'chatbot_skill_policy_faq',
  'Chatbot Skill: Policy FAQ',
  'Bot skill that answers customer questions about store policies (returns, shipping, refunds, privacy, terms)',
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

-- Link to chatbot_options capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
VALUES (
  (SELECT id FROM capability_type_list WHERE key = 'chatbot_options'),
  (SELECT id FROM features_list WHERE key = 'chatbot_skill_policy_faq'),
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
  'chatbot_skill_policy_faq',
  'Chatbot Skill: Policy FAQ',
  (SELECT id FROM capability_type_list WHERE key = 'chatbot_options'),
  true,
  NOW(),
  NOW()
FROM subscription_tiers_list stl
WHERE NOT EXISTS (
  SELECT 1 FROM tier_features_list tfl
  WHERE tfl.tier_id = stl.id AND tfl.feature_key = 'chatbot_skill_policy_faq'
);
