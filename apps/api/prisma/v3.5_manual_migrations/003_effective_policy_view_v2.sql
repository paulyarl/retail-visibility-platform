-- v3.5 — Enhanced Effective Policy View (REQ-2025-802)
-- Uses history table for point-in-time policy resolution

-- Drop old view and recreate with history support
DROP VIEW IF EXISTS v_effective_sku_billing_policy;

CREATE OR REPLACE VIEW v_effective_sku_billing_policy AS
SELECT DISTINCT ON (scope)
  scope,
  count_active_private,
  count_preorder,
  count_zero_price,
  require_image,
  require_currency,
  effective_from,
  effective_to,
  updated_by
FROM sku_billing_policy_history
WHERE effective_from <= now()
  AND (effective_to IS NULL OR effective_to > now())
ORDER BY scope, effective_from DESC;

-- Point-in-time policy lookup function
CREATE OR REPLACE FUNCTION get_policy_at_time(
  p_scope text,
  p_timestamp timestamptz DEFAULT now()
) RETURNS TABLE (
  count_active_private boolean,
  count_preorder boolean,
  count_zero_price boolean,
  require_image boolean,
  require_currency boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.count_active_private,
    h.count_preorder,
    h.count_zero_price,
    h.require_image,
    h.require_currency
  FROM sku_billing_policy_history h
  WHERE h.scope = p_scope
    AND h.effective_from <= p_timestamp
    AND (h.effective_to IS NULL OR h.effective_to > p_timestamp)
  ORDER BY h.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
