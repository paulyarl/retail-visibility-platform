-- SKU Billing Policy for tier-based gating
-- Configurable rules for what counts as a "billable SKU"

-- 1) Global policy table
CREATE TABLE IF NOT EXISTS sku_billing_policy (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scope text NOT NULL DEFAULT 'global',
  count_active_private boolean NOT NULL DEFAULT true,
  count_preorder boolean NOT NULL DEFAULT true,
  count_zero_price boolean NOT NULL DEFAULT false,
  require_image boolean NOT NULL DEFAULT true,
  require_currency boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Per-tenant overrides
CREATE TABLE IF NOT EXISTS sku_billing_policy_overrides (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  count_active_private boolean,
  count_preorder boolean,
  count_zero_price boolean,
  require_image boolean,
  require_currency boolean,
  note text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 3) Insert default global policy
INSERT INTO sku_billing_policy (scope, count_active_private, count_preorder, count_zero_price, require_image, require_currency)
VALUES ('global', true, true, false, true, true)
ON CONFLICT (id) DO NOTHING;

-- 4) Effective policy view (resolves overrides)
CREATE OR REPLACE VIEW v_effective_sku_billing_policy AS
SELECT
  t.id AS tenant_id,
  COALESCE(o.count_active_private, p.count_active_private) AS count_active_private,
  COALESCE(o.count_preorder, p.count_preorder) AS count_preorder,
  COALESCE(o.count_zero_price, p.count_zero_price) AS count_zero_price,
  COALESCE(o.require_image, p.require_image) AS require_image,
  COALESCE(o.require_currency, p.require_currency) AS require_currency,
  COALESCE(o.updated_at, p.updated_at) AS updated_at
FROM "Tenant" t
CROSS JOIN LATERAL (
  SELECT * FROM sku_billing_policy WHERE scope = 'global' ORDER BY updated_at DESC LIMIT 1
) p
LEFT JOIN sku_billing_policy_overrides o ON o.tenant_id = t.id;

-- 5) SKU counters view (for dashboards and tier gating)
CREATE OR REPLACE VIEW tenant_sku_counters AS
WITH policy AS (
  SELECT * FROM sku_billing_policy WHERE scope = 'global' ORDER BY updated_at DESC LIMIT 1
)
SELECT
  i."tenantId",
  COUNT(*) FILTER (WHERE i."itemStatus" = 'active') AS active_total,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'inactive') AS inactive_total,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'archived') AS archived_total,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'active' AND i.visibility = 'public') AS active_public,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'active' AND i.visibility = 'private') AS active_private,
  -- Billable according to policy
  COUNT(*) FILTER (
    WHERE i."itemStatus" = 'active'
      AND ((SELECT count_active_private FROM policy) OR i.visibility = 'public')
      AND ((SELECT count_zero_price FROM policy) OR (i.price IS NOT NULL AND i.price > 0))
      AND ((SELECT require_image FROM policy) = false OR (i."imageUrl" IS NOT NULL AND i."imageUrl" ~ '^https?://'))
      AND ((SELECT require_currency FROM policy) = false OR (i.currency IS NOT NULL AND char_length(i.currency)=3))
      AND ((SELECT count_preorder FROM policy) OR i.availability <> 'preorder')
  ) AS billable_sku_count
FROM "InventoryItem" i
GROUP BY i."tenantId";

-- 6) Index for active private items (if policy counts them)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_private
  ON "InventoryItem" ("tenantId")
  WHERE "itemStatus" = 'active' AND visibility = 'private';
