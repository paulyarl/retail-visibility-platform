-- Migration 342: GBP Management — Media Upload + Business Attributes feature keys
--
-- Grows the gbp_management capability module (migration 243) with two keys the
-- Advanced GBP Features surface (settings/integrations/google/advanced) gates on:
--   gbp_media_upload   — Upload + manage GBP photos (media library)
--   gbp_attributes     — Read + write GBP business attributes (fulfillment,
--                        payments, accessibility, amenities)
--
-- Both are ordinary module features: the flexible key
-- (gbp_management_flexible) auto-unlocks them via GbpManagementResolver, and
-- they are individually purchasable in the BSaaS store.
--
-- Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §6.5
--       (module grows as features are built)

-- Step 1: Insert feature keys
INSERT INTO features_list (key, name, description, is_active) VALUES
  ('gbp_media_upload', 'GBP Media Upload', 'Upload and manage Google Business Profile photos', true),
  ('gbp_attributes',   'GBP Business Attributes', 'Read and write Google Business Profile business attributes', true)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Link features to the gbp_management capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active)
SELECT ct.id, f.id, true
FROM capability_type_list ct, features_list f
WHERE ct.key = 'gbp_management'
  AND f.key IN ('gbp_media_upload', 'gbp_attributes')
ON CONFLICT DO NOTHING;

-- Step 3: BSaaS catalog entries (individually purchasable on any tier)
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
    'gbp_media_upload',
    'GBP Photo Upload',
    'Upload photos directly to your Google Business Profile from your device or a URL, organized by category (cover, interior, product, and more).',
    900,
    'monthly',
    14,
    true,
    true,
    15
  ),
  (
    'gbp_attributes',
    'GBP Business Attributes',
    'Manage the attributes shoppers see on your Google listing — fulfillment options (delivery, pickup), payment methods including SNAP/EBT, accessibility, and amenities.',
    900,
    'monthly',
    14,
    true,
    true,
    16
  )
ON CONFLICT (feature_key) DO NOTHING;
