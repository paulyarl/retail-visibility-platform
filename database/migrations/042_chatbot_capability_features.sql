-- Migration: Register chatbot_options capability type and link features
-- Description: Inserts all chatbot feature keys into features_list,
--              creates the chatbot_options capability type,
--              and links them via capability_features_list.
-- Prerequisites: features_list, capability_type_list, capability_features_list tables must exist
-- Date: 2026-06-19

-- ============================================================
-- 1. Insert chatbot feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Core toggles
  ('chatbot_enabled',              'Enable Chatbot',              'Master toggle for chatbot capability',                 'chatbot', true, 0,  NOW(), NOW()),
  ('chatbot_flexible',             'Flexible Chatbot',            'Unlock all chatbot features regardless of tier',       'chatbot', true, 1,  NOW(), NOW()),
  ('chatbot_static_enabled',       'Static FAQ Responses',        'Enable static FAQ keyword matching responses',         'chatbot', true, 2,  NOW(), NOW()),
  ('chatbot_dynamic_enabled',      'Dynamic GPT Responses',       'Enable dynamic GPT-powered responses with RAG',        'chatbot', true, 3,  NOW(), NOW()),
  ('chatbot_skills_enabled',       'Bot Skills',                  'Enable skill execution (product search, hours, etc.)', 'chatbot', true, 4,  NOW(), NOW()),
  ('chatbot_kb_enabled',           'Knowledge Base',              'Enable knowledge base / RAG retrieval',                'chatbot', true, 5,  NOW(), NOW()),
  ('chatbot_widget_enabled',       'Widget Embed',                'Enable embeddable chatbot widget',                     'chatbot', true, 6,  NOW(), NOW()),

  -- Response engines
  ('chatbot_static_lookup',        'Static Lookup Engine',        'Static FAQ keyword matching response engine',          'chatbot', true, 10, NOW(), NOW()),
  ('chatbot_shared_dynamic',       'Shared Dynamic Engine',       'Shared GPT dynamic response engine',                   'chatbot', true, 11, NOW(), NOW()),
  ('chatbot_lora_finetuned',       'LoRA Fine-Tuned Engine',      'LoRA fine-tuned model response engine (Pro tier)',     'chatbot', true, 12, NOW(), NOW()),
  ('chatbot_dedicated',            'Dedicated Model Engine',      'Dedicated model instance response engine (Enterprise)','chatbot', true, 13, NOW(), NOW()),

  -- Skill types
  ('chatbot_skill_product_search', 'Product Search Skill',        'Bot can search and recommend products',                'chatbot', true, 20, NOW(), NOW()),
  ('chatbot_skill_inventory',      'Inventory Check Skill',       'Bot can check product stock/availability',             'chatbot', true, 21, NOW(), NOW()),
  ('chatbot_skill_order_tracking', 'Order Tracking Skill',        'Bot can look up order status',                         'chatbot', true, 22, NOW(), NOW()),
  ('chatbot_skill_store_hours',    'Store Hours Skill',           'Bot can answer store hours questions',                 'chatbot', true, 23, NOW(), NOW()),
  ('chatbot_skill_cross_merchant', 'Cross-Merchant Skill',        'Bot can search across all merchant stores',            'chatbot', true, 24, NOW(), NOW()),

  -- Knowledge base types
  ('chatbot_kb_static_faq',        'Static FAQ Knowledge Base',   'Static FAQ keyword matching for knowledge base',       'chatbot', true, 30, NOW(), NOW()),
  ('chatbot_kb_rag_retrieval',     'RAG Retrieval',               'Vector similarity search over FAQ embeddings',         'chatbot', true, 31, NOW(), NOW()),
  ('chatbot_kb_product_scoped',    'Product-Scoped Knowledge',    'Product catalog embeddings for RAG',                   'chatbot', true, 32, NOW(), NOW()),
  ('chatbot_kb_gap_report',        'Gap Report',                  'Report on unanswered queries for FAQ improvement',     'chatbot', true, 33, NOW(), NOW()),
  ('chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',    'Automatic embedding refresh on content changes',       'chatbot', true, 34, NOW(), NOW()),

  -- Widget types
  ('chatbot_widget_embed',         'Widget Embed',                'Embeddable chatbot widget on storefront',              'chatbot', true, 40, NOW(), NOW()),
  ('chatbot_widget_custom_theme',  'Widget Custom Theme',         'Customizable widget colors and branding',              'chatbot', true, 41, NOW(), NOW()),
  ('chatbot_widget_skill_cards',   'Widget Skill Cards',          'Render skill results as interactive cards in widget',  'chatbot', true, 42, NOW(), NOW()),
  ('chatbot_widget_after_hours',   'Widget After Hours',          'After-hours offline message and leave-a-note form',    'chatbot', true, 43, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2. Upsert chatbot_options capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'chatbot_options',
  'Chatbot Options',
  'Chatbot capability including response engines, skills, knowledge base, and widget configuration.',
  'chatbot_options',
  true,
  8,
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
-- 3. Link features to chatbot_options capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'chatbot_options';
  v_feature_keys         TEXT[] := ARRAY[
    'chatbot_enabled',
    'chatbot_flexible',
    'chatbot_static_enabled',
    'chatbot_dynamic_enabled',
    'chatbot_skills_enabled',
    'chatbot_kb_enabled',
    'chatbot_widget_enabled',
    'chatbot_static_lookup',
    'chatbot_shared_dynamic',
    'chatbot_lora_finetuned',
    'chatbot_dedicated',
    'chatbot_skill_product_search',
    'chatbot_skill_inventory',
    'chatbot_skill_order_tracking',
    'chatbot_skill_store_hours',
    'chatbot_skill_cross_merchant',
    'chatbot_kb_static_faq',
    'chatbot_kb_rag_retrieval',
    'chatbot_kb_product_scoped',
    'chatbot_kb_gap_report',
    'chatbot_kb_auto_sync',
    'chatbot_widget_embed',
    'chatbot_widget_custom_theme',
    'chatbot_widget_skill_cards',
    'chatbot_widget_after_hours'
  ];
  v_capability_type_id TEXT;
  v_missing_keys       TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Resolve capability type ID
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  -- Wipe old links
  DELETE FROM capability_features_list WHERE capability_type_id = v_capability_type_id;

  -- Re-link with sort_order
  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_capability_type_id, fl.id, true, i, NOW(), NOW()
    FROM features_list fl
    WHERE fl.key = v_feature_keys[i];

    IF NOT FOUND THEN
      v_missing_keys := array_append(v_missing_keys, v_feature_keys[i]);
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
    END IF;
  END LOOP;

  IF array_length(v_missing_keys, 1) > 0 THEN
    RAISE NOTICE 'Missing feature keys (skipped): %', v_missing_keys;
  END IF;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1) - array_length(v_missing_keys, 1), v_capability_type_key;
END $$;

-- ============================================================
-- 4. Enable chatbot features for tiers
-- ============================================================
-- Active tiers (sorted by sort_order):
--   1.  discovery          ($29)   — Static FAQ + widget
--   2.  storefront         ($59)   — + Dynamic GPT + RAG + product search
--   3.  commitment         ($79)   — same as storefront
--   4.  ecommerce          ($99)   — + Skill cards + after hours + gap report + auto-sync
--   5.  omnichannel        ($149)  — same as ecommerce
--   6.  professional       ($199)  — + LoRA + cross-merchant + inventory/order + custom theme
--   7.  chain_starter      ($299)  — same as professional
--   8.  chain_professional ($399)  — same as professional
--   9.  organization       ($499)  — same as professional
--   10. enterprise         ($499)  — Everything (flexible) + dedicated model

DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_tier_key          TEXT;
  v_feature_key       TEXT;
  v_feature_name      TEXT;
  v_marketing_name    TEXT;
  v_highlight         BOOLEAN;
  v_highlight_order   INT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'chatbot_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type chatbot_options not found';
  END IF;

  -- Helper: insert a single tier feature row
  FOR v_tier_key, v_feature_key, v_feature_name, v_marketing_name, v_highlight, v_highlight_order IN
    SELECT * FROM (VALUES
      -- ─── discovery: Static FAQ + widget ───
      ('discovery', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('discovery', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('discovery', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('discovery', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('discovery', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('discovery', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),

      -- ─── storefront: + Dynamic GPT + RAG + product search ───
      ('storefront', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('storefront', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('storefront', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('storefront', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('storefront', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('storefront', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('storefront', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('storefront', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('storefront', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('storefront', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('storefront', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('storefront', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('storefront', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('storefront', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),

      -- ─── commitment: same as storefront ───
      ('commitment', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('commitment', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('commitment', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('commitment', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('commitment', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('commitment', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('commitment', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('commitment', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('commitment', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('commitment', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('commitment', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('commitment', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('commitment', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('commitment', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),

      -- ─── ecommerce: + Skill cards + after hours + gap report + auto-sync ───
      ('ecommerce', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('ecommerce', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('ecommerce', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('ecommerce', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('ecommerce', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('ecommerce', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('ecommerce', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('ecommerce', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('ecommerce', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('ecommerce', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                  false, 0),
      ('ecommerce', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                  false, 0),
      ('ecommerce', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('ecommerce', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('ecommerce', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('ecommerce', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('ecommerce', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),
      ('ecommerce', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                  false, 0),
      ('ecommerce', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                  false, 0),

      -- ─── omnichannel: same as ecommerce ───
      ('omnichannel', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('omnichannel', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('omnichannel', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('omnichannel', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('omnichannel', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('omnichannel', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('omnichannel', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('omnichannel', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('omnichannel', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('omnichannel', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                  false, 0),
      ('omnichannel', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                  false, 0),
      ('omnichannel', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('omnichannel', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('omnichannel', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('omnichannel', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('omnichannel', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),
      ('omnichannel', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                  false, 0),
      ('omnichannel', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                  false, 0),

      -- ─── professional: + LoRA + cross-merchant + inventory/order + custom theme ───
      ('professional', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('professional', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('professional', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('professional', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('professional', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('professional', 'chatbot_lora_finetuned',       'LoRA Fine-Tuned Engine',    'Fine-Tuned AI',       true,  3),
      ('professional', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('professional', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('professional', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('professional', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('professional', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                  false, 0),
      ('professional', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                  false, 0),
      ('professional', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('professional', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('professional', 'chatbot_skill_inventory',      'Inventory Check Skill',     NULL,                  false, 0),
      ('professional', 'chatbot_skill_order_tracking', 'Order Tracking Skill',      NULL,                  false, 0),
      ('professional', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('professional', 'chatbot_skill_cross_merchant', 'Cross-Merchant Skill',      NULL,                  false, 0),
      ('professional', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('professional', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),
      ('professional', 'chatbot_widget_custom_theme',  'Widget Custom Theme',       NULL,                  false, 0),
      ('professional', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                  false, 0),
      ('professional', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                  false, 0),

      -- ─── chain_starter: same as professional ───
      ('chain_starter', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('chain_starter', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('chain_starter', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('chain_starter', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('chain_starter', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('chain_starter', 'chatbot_lora_finetuned',       'LoRA Fine-Tuned Engine',    'Fine-Tuned AI',       true,  3),
      ('chain_starter', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('chain_starter', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('chain_starter', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('chain_starter', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('chain_starter', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                  false, 0),
      ('chain_starter', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                  false, 0),
      ('chain_starter', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('chain_starter', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('chain_starter', 'chatbot_skill_inventory',      'Inventory Check Skill',     NULL,                  false, 0),
      ('chain_starter', 'chatbot_skill_order_tracking', 'Order Tracking Skill',      NULL,                  false, 0),
      ('chain_starter', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('chain_starter', 'chatbot_skill_cross_merchant', 'Cross-Merchant Skill',      NULL,                  false, 0),
      ('chain_starter', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('chain_starter', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),
      ('chain_starter', 'chatbot_widget_custom_theme',  'Widget Custom Theme',       NULL,                  false, 0),
      ('chain_starter', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                  false, 0),
      ('chain_starter', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                  false, 0),

      -- ─── chain_professional: same as professional ───
      ('chain_professional', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('chain_professional', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('chain_professional', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('chain_professional', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('chain_professional', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('chain_professional', 'chatbot_lora_finetuned',       'LoRA Fine-Tuned Engine',    'Fine-Tuned AI',       true,  3),
      ('chain_professional', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('chain_professional', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('chain_professional', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('chain_professional', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('chain_professional', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                  false, 0),
      ('chain_professional', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                  false, 0),
      ('chain_professional', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('chain_professional', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('chain_professional', 'chatbot_skill_inventory',      'Inventory Check Skill',     NULL,                  false, 0),
      ('chain_professional', 'chatbot_skill_order_tracking', 'Order Tracking Skill',      NULL,                  false, 0),
      ('chain_professional', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('chain_professional', 'chatbot_skill_cross_merchant', 'Cross-Merchant Skill',      NULL,                  false, 0),
      ('chain_professional', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('chain_professional', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),
      ('chain_professional', 'chatbot_widget_custom_theme',  'Widget Custom Theme',       NULL,                  false, 0),
      ('chain_professional', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                  false, 0),
      ('chain_professional', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                  false, 0),

      -- ─── organization: same as professional ───
      ('organization', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',             true,  1),
      ('organization', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                  false, 0),
      ('organization', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                  false, 0),
      ('organization', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',true,  2),
      ('organization', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                  false, 0),
      ('organization', 'chatbot_lora_finetuned',       'LoRA Fine-Tuned Engine',    'Fine-Tuned AI',       true,  3),
      ('organization', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                  false, 0),
      ('organization', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                  false, 0),
      ('organization', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                  false, 0),
      ('organization', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                  false, 0),
      ('organization', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                  false, 0),
      ('organization', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                  false, 0),
      ('organization', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                  false, 0),
      ('organization', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                  false, 0),
      ('organization', 'chatbot_skill_inventory',      'Inventory Check Skill',     NULL,                  false, 0),
      ('organization', 'chatbot_skill_order_tracking', 'Order Tracking Skill',      NULL,                  false, 0),
      ('organization', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                  false, 0),
      ('organization', 'chatbot_skill_cross_merchant', 'Cross-Merchant Skill',      NULL,                  false, 0),
      ('organization', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                  false, 0),
      ('organization', 'chatbot_widget_embed',         'Widget Embed',              NULL,                  false, 0),
      ('organization', 'chatbot_widget_custom_theme',  'Widget Custom Theme',       NULL,                  false, 0),
      ('organization', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                  false, 0),
      ('organization', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                  false, 0),

      -- ─── enterprise: Everything (flexible) + dedicated ───
      ('enterprise', 'chatbot_enabled',              'Enable Chatbot',            'Chatbot',              true,  1),
      ('enterprise', 'chatbot_flexible',             'Flexible Chatbot',          NULL,                   false, 0),
      ('enterprise', 'chatbot_static_enabled',       'Static FAQ Responses',      NULL,                   false, 0),
      ('enterprise', 'chatbot_static_lookup',        'Static Lookup Engine',      NULL,                   false, 0),
      ('enterprise', 'chatbot_dynamic_enabled',      'Dynamic GPT Responses',     'Dynamic AI Responses',  true,  2),
      ('enterprise', 'chatbot_shared_dynamic',       'Shared Dynamic Engine',     NULL,                   false, 0),
      ('enterprise', 'chatbot_lora_finetuned',       'LoRA Fine-Tuned Engine',    NULL,                   false, 0),
      ('enterprise', 'chatbot_dedicated',            'Dedicated Model Engine',    'Dedicated AI Model',    true,  3),
      ('enterprise', 'chatbot_kb_enabled',           'Knowledge Base',            NULL,                   false, 0),
      ('enterprise', 'chatbot_kb_static_faq',        'Static FAQ Knowledge Base', NULL,                   false, 0),
      ('enterprise', 'chatbot_kb_rag_retrieval',     'RAG Retrieval',             NULL,                   false, 0),
      ('enterprise', 'chatbot_kb_product_scoped',    'Product-Scoped Knowledge',  NULL,                   false, 0),
      ('enterprise', 'chatbot_kb_gap_report',        'Gap Report',                NULL,                   false, 0),
      ('enterprise', 'chatbot_kb_auto_sync',         'Auto-Sync Knowledge Base',  NULL,                   false, 0),
      ('enterprise', 'chatbot_skills_enabled',       'Bot Skills',                NULL,                   false, 0),
      ('enterprise', 'chatbot_skill_product_search', 'Product Search Skill',      NULL,                   false, 0),
      ('enterprise', 'chatbot_skill_inventory',      'Inventory Check Skill',     NULL,                   false, 0),
      ('enterprise', 'chatbot_skill_order_tracking', 'Order Tracking Skill',      NULL,                   false, 0),
      ('enterprise', 'chatbot_skill_store_hours',    'Store Hours Skill',         NULL,                   false, 0),
      ('enterprise', 'chatbot_skill_cross_merchant', 'Cross-Merchant Skill',      NULL,                   false, 0),
      ('enterprise', 'chatbot_widget_enabled',       'Widget Embed',              NULL,                   false, 0),
      ('enterprise', 'chatbot_widget_embed',         'Widget Embed',              NULL,                   false, 0),
      ('enterprise', 'chatbot_widget_custom_theme',  'Widget Custom Theme',       NULL,                   false, 0),
      ('enterprise', 'chatbot_widget_skill_cards',   'Widget Skill Cards',        NULL,                   false, 0),
      ('enterprise', 'chatbot_widget_after_hours',   'Widget After Hours',        NULL,                   false, 0)
    ) AS t(tier_key, feature_key, feature_name, marketing_name, is_highlight, highlight_order)
  LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      v_feature_key,
      v_feature_name,
      true,
      false,
      '{"capability_type": "chatbot_options"}',
      v_highlight,
      v_highlight_order,
      v_marketing_name
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Chatbot tier features populated for all active tiers';
END $$;

-- ============================================================
-- 5. Verification queries (run manually to confirm)
-- ============================================================
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name, cfl.sort_order
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'chatbot_options'
-- ORDER BY cfl.sort_order;

-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key LIKE 'chatbot_%'
-- ORDER BY stl.sort_order, tfl.feature_key;

-- ============================================================
-- 6. Seed platform_guide bot skill + intents
-- ============================================================

INSERT INTO bot_skills (name, version, description, endpoint, required_capabilities, tier_gates, capability_gates, tenant_status_gates, featured_aware, refresh_cadence_minutes, status, skill_card_schema, default_config)
VALUES (
  'platform_guide',
  '1.0.0',
  'Helps merchants understand their platform capabilities, tier, and recommended next steps. Context-aware for dashboard vs storefront.',
  'internal://platform-guide',
  ARRAY['chatbot_enabled']::varchar[],
  ARRAY[]::varchar[],
  ARRAY['chatbot_skill_product_search']::varchar[],
  ARRAY['active', 'trialing']::varchar[],
  false,
  60,
  'active',
  jsonb_build_object(
    'type', 'platform_guide',
    'title', 'Your Platform Overview',
    'sections', jsonb_build_array(
      jsonb_build_object('label', 'Tier', 'icon', 'badge'),
      jsonb_build_object('label', 'Enabled Features'),
      jsonb_build_object('label', 'Recommended Next Steps')
    )
  ),
  jsonb_build_object('surface', 'auto')
)
ON CONFLICT (name) DO NOTHING;

-- Intent: platform_help — maps to platform_guide skill
INSERT INTO bot_intents (name, category, description, examples, confidence_threshold, mapped_skill, is_active)
VALUES (
  'platform_help',
  'platform',
  'Merchant asks about platform features, capabilities, tier, or what to do next',
  ARRAY[
    'what features do i have',
    'what can i do on this platform',
    'what should i set up next',
    'how do i improve my store',
    'what is my tier',
    'what plan am i on',
    'what am i missing',
    'help me get started',
    'what should i do next',
    'how do i set up my storefront',
    'how do i enable payments',
    'what features are available',
    'guide me through the platform',
    'what do i need to do'
  ],
  0.3,
  'platform_guide',
  true
)
ON CONFLICT (name) DO NOTHING;
