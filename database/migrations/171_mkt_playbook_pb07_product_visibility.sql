-- Migration 171: mkt_playbook_catalog — PB-07 Product Visibility + cascade renumber + PB-02 none extension
--
-- Sprint 1 (Universal Recalibration). Three operations:
--   1. Renumber PB-06 (5→6) and PB-03 (6→7) to make room for PB-07 at rank 5
--   2. Insert PB-07 (Product Visibility & Catalog Refresh) at priority_rank 5, archetype A6
--   3. Extend PB-02's matching_rules.none with product-visibility codes so a business with
--      a catalog gap routes to PB-07 instead of PB-02 (cascade co-occurrence fix)
--
-- Post-migration cascade priority:
--   PB-04(1) > PB-05(2) > PB-01(3) > PB-02(4) > PB-07(5) > PB-06(6) > PB-03(7)
--
-- PB-07 retainer_fee_cents = 39900 ($399/mo) — matches existing PB-03/PB-05 retainer tier.
-- preview_deliverable_type = 'product_visibility_preview' — new value; DeliverableType union
-- + route zod enums are updated in the same sprint (v1.2: pulled to Sprint 1).
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- 1. Renumber existing rows to make room at rank 5.
UPDATE mkt_playbook_catalog SET priority_rank = 7, updated_at = NOW() WHERE code = 'PB-03';
UPDATE mkt_playbook_catalog SET priority_rank = 6, updated_at = NOW() WHERE code = 'PB-06';

-- 2. Insert PB-07 at rank 5. Uses ON CONFLICT DO UPDATE (matches migration 158's re-seed convention).
INSERT INTO mkt_playbook_catalog (
  id, code, name, category, archetype, archetype_label, description,
  matching_rules, priority_rank,
  fitd_offer_title, fitd_default_fee_cents,
  retainer_pitch_title, retainer_fee_cents,
  opener_prompt_template_id, preview_deliverable_type,
  is_active
) VALUES (
  'pbk-pb07',
  'PB-07',
  'Product Visibility & Catalog Refresh',
  'triage_management',
  'A6',
  'A6_PRODUCT_VISIBILITY_GAP',
  'For product/inventory businesses (grocery stores, bakeries, specialty markets) with no online product browsing, availability inquiry, or pickup/delivery pathway. Delivers a mobile catalog mockup, GBP photo optimization, availability-inquiry flow, fulfillment pathway, and hours sync plan.',
  '{"any":["DS_MISSING_PRODUCT_CATALOG","WC_MISSING_PRODUCT_BROWSING","WC_MISSING_AVAILABILITY_INQUIRY","WC_MISSING_PICKUP_DELIVERY"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS","RA_UNADDRESSED_NEGATIVE_BACKLOG"],"dual":null,"confidence":0.82}'::jsonb,
  5,
  'Mobile Catalog + GBP Photo Optimization Preview',
  19900,
  'Monthly Product Visibility & Local Discovery Retainer',
  39900,
  NULL,
  'product_visibility_preview',
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  archetype = EXCLUDED.archetype,
  archetype_label = EXCLUDED.archetype_label,
  description = EXCLUDED.description,
  matching_rules = EXCLUDED.matching_rules,
  priority_rank = EXCLUDED.priority_rank,
  fitd_offer_title = EXCLUDED.fitd_offer_title,
  fitd_default_fee_cents = EXCLUDED.fitd_default_fee_cents,
  retainer_pitch_title = EXCLUDED.retainer_pitch_title,
  retainer_fee_cents = EXCLUDED.retainer_fee_cents,
  preview_deliverable_type = EXCLUDED.preview_deliverable_type,
  updated_at = NOW();

-- 3. Cascade co-occurrence fix: extend PB-02's none set with product-visibility codes.
--    Without this, PB-02 (rank 4) wins over PB-07 (rank 5) for grocery stores that have
--    both low review volume (RA_LOW_REVIEW_VOLUME fires) AND a missing product catalog —
--    routing them to A1 "review gap" instead of A6 "product visibility gap".
--    The guard (AND NOT ...) makes this idempotent so re-running doesn't duplicate entries.
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{none}',
      (matching_rules->'none')::jsonb || '["DS_MISSING_PRODUCT_CATALOG","WC_MISSING_PRODUCT_BROWSING"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-02'
  AND NOT (matching_rules->'none' ? 'DS_MISSING_PRODUCT_CATALOG');

COMMIT;

-- Verification:
-- SELECT code, name, archetype, priority_rank, preview_deliverable_type FROM mkt_playbook_catalog ORDER BY priority_rank;
-- SELECT code, matching_rules->'none' AS none_set FROM mkt_playbook_catalog WHERE code = 'PB-02';
