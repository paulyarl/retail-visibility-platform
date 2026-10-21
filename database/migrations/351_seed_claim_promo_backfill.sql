-- Migration 351: backfill seed_claim promo grants for seeds claimed before
-- the claim-time grant shipped (applySeedClaimGrants in DirectoryClaimService).
--
-- Writes tenant_feature_purchases rows (source 'seed_claim') for every
-- directory_presence_seed with status='claimed', same shape the code produces:
--   source='seed_claim', status='active', one-year expiry, promo metadata.
--
-- Mirrors the code's guard via ON CONFLICT DO UPDATE ... WHERE — an existing
-- live paid-source purchase (bsaas/bsaas_bundle/addon/tier_overage with
-- status active/past_due/trial) is never demoted.
--
-- Expiry is a full year from backfill (not from claimed_at) so early claimants
-- aren't shorted; purchased_at keeps claimed_at for provenance. Idempotent —
-- safe to re-run. Run on any env with claimed seeds:
--   cd apps/api && doppler run --config <env> -- node scripts/apply-sql-file.cjs ../../database/migrations/351_seed_claim_promo_backfill.sql

INSERT INTO tenant_feature_purchases
  (tenant_id, feature_key, source, status, purchased_at, expires_at, metadata)
SELECT
  s.tenant_id,
  g.feature_key,
  'seed_claim',
  'active',
  COALESCE(s.claimed_at, now()),
  now() + interval '365 days',
  jsonb_build_object(
    'trigger', 'seed_claim',
    'seed_id', s.id,
    'complimentary', true,
    'granted_by', 'system:seed_claim_backfill',
    'granted_at', now(),
    'reason', 'Seed claim promo — module taste granted at claim for one year (see SEED_CLAIM_PROMO_GRANTS)',
    'backfill', '351'
  )
FROM directory_presence_seeds s
CROSS JOIN (VALUES
  ('flyer_on'),
  ('flyer_directory_on'),
  ('flyer_place_on'),
  ('flyer_items_5'),
  ('storefront_qr_classic_on'),
  ('storefront_qr_directory'),
  ('storefront_qr_resolution_512')
) AS g(feature_key)
WHERE s.status = 'claimed'
ON CONFLICT (tenant_id, feature_key) DO UPDATE
SET source = 'seed_claim',
    status = 'active',
    expires_at = EXCLUDED.expires_at,
    metadata = EXCLUDED.metadata,
    updated_at = now()
WHERE NOT (
  tenant_feature_purchases.source IN ('bsaas', 'bsaas_bundle', 'addon', 'tier_overage')
  AND tenant_feature_purchases.status IN ('active', 'past_due', 'trial')
);
