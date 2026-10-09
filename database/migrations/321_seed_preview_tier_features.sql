-- 321_seed_preview_tier_features.sql
--
-- §5f of docs/LocalBiz/SEED_PREVIEW_STOREFRONT_SPEC.md — the dedicated
-- `seed_preview` subscription tier. The preview tenant carries
-- subscription_tier='seed_preview'; capability resolution unions
-- tier_features_list rows by tier_key (mv_tenant_effective_capabilities does
-- not filter subscription_tiers_list.is_active), so the tier row plus these
-- explicit feature rows are the demo's entire capability surface.
--
-- Feature set (spec §5f, "Proposed feature set"):
--   Storefront  — retail storefront, product browse, gallery, hours, maps.
--   Commerce    — add to cart, full payment, deposit checkout. The §5b
--                 checkout guard (seed-preview.ts) is what makes these a
--                 sandbox demonstration rather than real transactions.
--   Directory   — directory entry + storefront QR (demo scope only).
--   Payment     — payment_gateway_disabled is the explicit OFF switch for the
--                 payment_gateway_options capability group: the resolver's
--                 type-gate map treats a disabled-key grant as
--                 gate_status='disabled', which blocks any stray
--                 enabled/flexible grant from turning a processor on.
--
-- NO *_flexible keys — a flexible key expands to every feature in its
-- capability type, which would leak whole modules (spec §5f rule 1).
--
-- Billing: price_monthly=0, billing_type='none', is_active=true (same shape
-- as directory_presence — picker queries filter on billing_type='subscription').
-- Keeps the key out of paid tier pickers and Stripe price flows by construction.
--
-- Idempotent: ON CONFLICT guards on both inserts; safe to re-run.
--
-- Apply:
--   psql "$DATABASE_URL" -f database/migrations/321_seed_preview_tier_features.sql

BEGIN;

-- ─── 1. Tier row ─────────────────────────────────────────────────────────
-- tier_key has no unique constraint — guard with WHERE NOT EXISTS so the
-- migration stays idempotent.
INSERT INTO subscription_tiers_list (
  id, tier_key, name, display_name, description,
  price_monthly, max_skus, max_locations,
  tier_type, is_active, sort_order, billing_type,
  featured_store_selection, featured_new_arrival, featured_seasonal,
  featured_sale, featured_staff_pick, featured_bestseller,
  featured_clearance, featured_trending, featured_featured, featured_recommended,
  max_users, metadata, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  'seed_preview',
  'Seed Preview',
  'Seed Preview',
  'Demo-only tier for seed-preview storefronts. Never sold, never billed — exists only to give the /shops/[slug] preview tenant an explicit, minimal capability set (spec §5f).',
  0.00, 20, 1,
  'individual', true, 999, 'none',
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  NULL,
  '{"demo": true, "hidden_from_pricing": true}'::jsonb,
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_tiers_list WHERE tier_key = 'seed_preview'
);

-- ─── 2. Tier feature rows ────────────────────────────────────────────────
-- capability_type_id is resolved per-feature from capability_features_list
-- (the same mapping EffectiveCapabilityResolver uses as its fallback), so a
-- feature lands under the group that actually gates it. Features with no
-- capability_features_list row are skipped with a NOTICE rather than
-- silently writing a NULL capability_type_id.
DO $$
DECLARE
  v_tier_id      TEXT;
  v_feature_key  TEXT;
  v_feature_name TEXT;
  v_cap_type_id  TEXT;
  v_written      INT := 0;
  v_skipped      TEXT[] := '{}';
BEGIN
  SELECT id INTO v_tier_id
  FROM subscription_tiers_list
  WHERE tier_key = 'seed_preview' AND is_active = true
  LIMIT 1;
  IF v_tier_id IS NULL THEN
    RAISE EXCEPTION 'seed_preview tier row not found — section 1 did not insert';
  END IF;

  FOR v_feature_key, v_feature_name IN
    SELECT * FROM (VALUES
      -- storefront_types: retail storefront, master on-switches
      ('storefront',                        'Storefront'),
      ('storefront_enabled',                'Storefront Enabled'),
      ('storefront_retail',                 'Retail Storefront'),
      -- storefront_gallery: sample-catalog imagery
      ('storefront_gallery_enabled',        'Gallery Enabled'),
      ('storefront_gallery_carousel',       'Carousel Gallery'),
      ('storefront_gallery_carousel_on',    'Carousel Gallery (On)'),
      -- storefront_hours: sourced hours only
      ('storefront_hours',                  'Business Hours'),
      ('storefront_hours_enabled',          'Hours Enabled'),
      ('storefront_hours_on',               'Hours Group On'),
      -- storefront_layouts: classic layout only (no picker)
      ('storefront_layouts',                'Storefront Layouts'),
      ('storefront_layouts_enabled',        'Layouts Enabled'),
      ('storefront_layouts_on',             'Layouts Group On'),
      ('storefront_layouts_classic',        'Classic Layout'),
      -- storefront_maps: NAP location display
      ('storefront_maps',                   'Storefront Maps'),
      ('storefront_maps_enabled',           'Maps Enabled'),
      ('storefront_maps_on',                'Maps Group On'),
      -- commerce_types: the demo's reason to exist (§5b sandbox applies)
      ('commerce_enabled',                  'Commerce Enabled'),
      ('commerce_full_payment',             'Commerce Full Payment'),
      ('commerce_deposit_only',             'Commerce Deposit Only'),
      -- payment_gateway_options: explicit OFF — blocks flexible/stray grants
      ('payment_gateway_disabled',          'Payment Gateway Disabled'),
      -- directory_entry: demo-scope directory surface
      ('directory_entry_enabled',           'Directory Entry — Enabled'),
      ('directory_entry_contact_enabled',   'Directory Entry Contact — Enabled'),
      ('directory_entry_contact_on',        'Directory Entry Contact — On'),
      ('directory_entry_hours_enabled',     'Directory Entry Hours — Enabled'),
      ('directory_entry_hours_on',          'Directory Entry Hours — On'),
      ('directory_entry_map_enabled',       'Directory Entry Map — Enabled'),
      ('directory_entry_map_on',            'Directory Entry Map — On'),
      ('directory_entry_qr_enabled',        'Directory Entry QR — Enabled'),
      ('directory_entry_qr_on',             'Directory Entry QR — On'),
      -- storefront_qr: QR surface (demo scope)
      ('storefront_qr_enabled',             'Storefront QR Enabled'),
      ('storefront_qr_classic',             'Classic QR'),
      ('storefront_qr_classic_on',          'Classic QR (On)')
    ) AS f(feature_key, feature_name)
  LOOP
    SELECT cfl.capability_type_id INTO v_cap_type_id
    FROM capability_features_list cfl
    JOIN features_list fl ON fl.id = cfl.feature_id
    WHERE fl.key = v_feature_key AND cfl.is_active = true
    LIMIT 1;

    IF v_cap_type_id IS NULL THEN
      v_skipped := array_append(v_skipped, v_feature_key);
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (
      id, tier_id, capability_type_id, feature_key, feature_name,
      is_enabled, is_inherited, metadata, is_highlighted, highlight_order,
      marketing_name
    )
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      v_feature_key,
      v_feature_name,
      true,
      false,
      jsonb_build_object('demo_tier', true),
      false,
      0,
      NULL
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
    v_written := v_written + 1;
  END LOOP;

  RAISE NOTICE 'seed_preview tier features written: %', v_written;
  IF array_length(v_skipped, 1) > 0 THEN
    RAISE NOTICE 'skipped (no capability_features_list row): %', v_skipped;
  END IF;
END $$;

-- mv_tenant_effective_capabilities is materialized — new tier_features rows
-- don't resolve until refresh. Plain REFRESH (not CONCURRENTLY) is legal
-- inside this transaction; same pattern as migration 095.
REFRESH MATERIALIZED VIEW mv_tenant_effective_capabilities;

COMMIT;

-- Verification:
-- SELECT tfl.feature_key, ctl.key AS cap_type
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- LEFT JOIN capability_type_list ctl ON ctl.id = tfl.capability_type_id
-- WHERE stl.tier_key = 'seed_preview' AND tfl.is_enabled
-- ORDER BY ctl.key, tfl.feature_key;
