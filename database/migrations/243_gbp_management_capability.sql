-- Migration 243: GBP Management Capability Module
--
-- Registers the gbp_management capability type and 5 feature keys:
--   gbp_ai_response            — AI review response (Tier A drafts + Tier B autopilot)
--   gbp_posts_scheduler        — Scheduled post queue + lifecycle
--   gbp_directory_reviews      — Surface GBP reviews on public surfaces
--   gbp_directory_content      — Surface GBP posts + photos on public surfaces
--   gbp_management_flexible    — Flexible bundle key (auto-unlocks all GBP features)
--
-- Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §6.1–6.5
-- Sprint: docs/LocalBiz/GBP_SPRINT_PHASE4.md Task 1

-- Step 1: Insert capability type
INSERT INTO capability_type_list (key, name, description, is_active)
VALUES ('gbp_management', 'GBP Management', 'Google Business Profile authorized management suite', true)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Insert feature keys
INSERT INTO features_list (key, name, description, is_active) VALUES
  ('gbp_ai_response', 'GBP AI Review Response', 'AI review response (Tier A + Tier B)', true),
  ('gbp_posts_scheduler', 'GBP Post Scheduler', 'Scheduled post queue + lifecycle', true),
  ('gbp_directory_reviews', 'GBP Directory Reviews', 'Surface GBP reviews on public surfaces', true),
  ('gbp_directory_content', 'GBP Directory Content', 'Surface GBP posts + photos on public surfaces', true),
  ('gbp_management_flexible', 'GBP Management Flexible', 'GBP Management flexible bundle key', true)
ON CONFLICT (key) DO NOTHING;

-- Step 3: Link features to capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active)
SELECT ct.id, f.id, true
FROM capability_type_list ct, features_list f
WHERE ct.key = 'gbp_management'
  AND f.key IN (
    'gbp_ai_response',
    'gbp_posts_scheduler',
    'gbp_directory_reviews',
    'gbp_directory_content',
    'gbp_management_flexible'
  )
ON CONFLICT DO NOTHING;
