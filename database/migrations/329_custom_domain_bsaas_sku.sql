-- 329_custom_domain_bsaas_sku.sql
--
-- Custom Domains sprint — BSaaS catalog SKU for the level-3 capability key
-- `storefront_opt_custom_domain` (seeded by migration 327).
--
-- Why it exists: the admin complimentary-grant flow (admin feature grants →
-- tenant_feature_purchases → mv_tenant_effective_capabilities purchase_features)
-- requires a bsaas_catalog row for the feature key. With this row, an operator
-- can comp the capability to any tenant through the existing BSaaS module —
-- demo tenants, goodwill exceptions, DFY pilot customers — with no
-- tenant_feature_overrides_list write and no SOP checklist line.
--
-- Visibility: is_private = TRUE — grant-ready but absent from the self-serve
-- feature catalog (is_active + is_private filter). Flip is_private=false only
-- if the à-la-carte add-on SKU becomes a product decision (the upsell card's
-- "View plans" path could then sell it to sub-Professional tiers).
--
-- Price: $10/mo placeholder — a product call, not a cost model. Only surfaces
-- if the SKU ever goes public; private rows are never price-presented.
-- demo_eligible=false preserves D12: demos get no custom-domain entitlement
-- by default (the sales-demo path is an admin grant, not demo eligibility).

BEGIN;

INSERT INTO bsaas_catalog (
  feature_key,
  marketing_name,
  description,
  price_cents,
  billing_cycle,
  trial_days,
  is_active,
  sort_order,
  trial_eligible,
  demo_eligible,
  is_private
)
VALUES (
  'storefront_opt_custom_domain',
  'Custom Storefront Domain',
  'Serve your storefront on a domain you own — apex, www, or a subdomain like shop.mybrand.com. Includes Vercel-managed verification and TLS, automatic www redirect, and canonical SEO consolidation onto your domain.',
  1000,
  'monthly',
  0,
  true,
  117,
  false,
  false,
  true
)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  is_private     = EXCLUDED.is_private,
  updated_at     = NOW();

COMMIT;

-- Verification:
--   SELECT feature_key, marketing_name, price_cents, billing_cycle, is_private
--   FROM bsaas_catalog WHERE feature_key = 'storefront_opt_custom_domain';
