-- ============================================================
-- 045: CRM Assistant Bot Skill
--
-- Adds the chatbot_skill_crm_assistant feature key, links it
-- to the chatbot_options capability type, and assigns it to
-- professional+ tiers. Lower tiers can purchase it via
-- tenant_feature_purchases.
-- ============================================================

-- 1. Insert the new skill feature key into features_list
INSERT INTO features_list (key, name, description, category, is_active, sort_order)
VALUES (
  'chatbot_skill_crm_assistant',
  'CRM Assistant Skill',
  'Bot can create support tickets, look up ticket status, and inject CRM context into dynamic responses',
  'chatbot',
  true,
  30
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2. Link to chatbot_options capability type
INSERT INTO capability_features_list (feature_id, capability_type_id, is_active, sort_order)
SELECT
  f.id,
  ct.id,
  true,
  30
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE f.key = 'chatbot_skill_crm_assistant'
  AND ct.key = 'chatbot_options'
ON CONFLICT DO NOTHING;

-- 3. Enable for professional+ tiers
DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id TEXT;
  v_tier_key TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'chatbot_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type chatbot_options not found';
  END IF;

  FOR v_tier_key IN SELECT unnest(ARRAY['professional', 'chain_starter', 'chain_professional', 'organization', 'enterprise'])
  LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      'chatbot_skill_crm_assistant',
      'CRM Assistant Skill',
      true,
      false,
      '{"capability_type": "chatbot_options"}',
      false,
      0,
      NULL
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;
END $$;
