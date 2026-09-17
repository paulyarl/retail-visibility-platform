-- Migration 244: GBP Management Tier Assignments + BSaaS Catalog Entries
--
-- Assigns gbp_management_flexible to the full retail visibility tier (if it exists),
-- and creates 5 BSaaS catalog entries for individual features + the flexible bundle.
--
-- Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §6.3
-- Sprint: docs/LocalBiz/GBP_SPRINT_PHASE4.md Task 2

-- Step 1: Assign gbp_management_flexible to the full retail visibility tier
-- (flexible key auto-unlocks all features in the module via resolver)
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled)
SELECT
  'tfl_gbp_mgmt_' || st.id,
  st.id,
  'gbp_management_flexible',
  'GBP Management (Flexible)',
  true
FROM subscription_tiers_list st
WHERE st.tier_key = 'full_retail_visibility'
ON CONFLICT DO NOTHING;

-- Step 2: BSaaS catalog entries (5 SKUs)
-- The bsaas_catalog table auto-generates UUIDs for the id column.
INSERT INTO bsaas_catalog (
  feature_key,
  marketing_name,
  description,
  price_cents,
  billing_cycle,
  trial_days,
  trial_eligible,
  is_active,
  sort_order
) VALUES
  (
    'gbp_ai_response',
    'GBP AI Review Response',
    'AI-powered review response drafts with owner voice and category-aware tone. Tier A generates 3 draft replies for merchant approval; Tier B autopilot handles 5-star no-comment reviews automatically.',
    2900,
    'monthly',
    14,
    true,
    true,
    10
  ),
  (
    'gbp_posts_scheduler',
    'GBP Post Scheduler',
    'Schedule Google Business Profile posts in advance. Compose offers, events, and updates, then schedule them for automatic publication at the optimal time.',
    1900,
    'monthly',
    14,
    true,
    true,
    11
  ),
  (
    'gbp_directory_reviews',
    'GBP Reviews on Directory',
    'Surface your Google Business Profile reviews on your public directory and place pages. Includes aggregate rating badge and review list with owner replies.',
    900,
    'monthly',
    14,
    true,
    true,
    12
  ),
  (
    'gbp_directory_content',
    'GBP Posts + Photos on Directory',
    'Surface your Google Business Profile posts and photos on your public directory and place pages. Includes offer cards, event cards, and category-grouped photo gallery.',
    900,
    'monthly',
    14,
    true,
    true,
    13
  ),
  (
    'gbp_management_flexible',
    'GBP Pro (Complete)',
    'Complete GBP Management Suite: AI review responses, post scheduler, and public directory surfacing for reviews, posts, and photos. Best value — includes all GBP capabilities.',
    4900,
    'monthly',
    14,
    true,
    true,
    14
  )
ON CONFLICT (feature_key) DO NOTHING;
