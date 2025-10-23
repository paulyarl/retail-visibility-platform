-- v3.5 — Tier Automation Enhancements (REQ-2025-803)
-- Real-time counter updates with NOTIFY/LISTEN

-- Enhanced counters view using versioned policy
DROP VIEW IF EXISTS tenant_sku_counters;

CREATE OR REPLACE VIEW tenant_sku_counters AS
WITH policy AS (
  SELECT * FROM v_effective_sku_billing_policy WHERE scope = 'global' LIMIT 1
)
SELECT
  i."tenantId",
  COUNT(*) FILTER (WHERE i."itemStatus" = 'active') AS active_total,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'inactive') AS inactive_total,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'archived') AS archived_total,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'active' AND i.visibility = 'public') AS active_public,
  COUNT(*) FILTER (WHERE i."itemStatus" = 'active' AND i.visibility = 'private') AS active_private,
  -- Billable count according to current policy
  COUNT(*) FILTER (
    WHERE i."itemStatus" = 'active'
      AND (
        (SELECT count_active_private FROM policy) = true 
        OR i.visibility = 'public'
      )
      AND (
        (SELECT count_zero_price FROM policy) = true 
        OR (i.price IS NOT NULL AND i.price > 0)
      )
      AND (
        (SELECT require_image FROM policy) = false 
        OR (i."imageUrl" IS NOT NULL AND i."imageUrl" ~ '^https?://')
      )
      AND (
        (SELECT require_currency FROM policy) = false 
        OR (i.currency IS NOT NULL AND char_length(i.currency) = 3)
      )
      AND (
        (SELECT count_preorder FROM policy) = true 
        OR i.availability <> 'preorder'
      )
  ) AS billable_sku_count,
  -- Policy snapshot for reference
  (SELECT row_to_json(policy.*) FROM policy) AS policy_snapshot
FROM "InventoryItem" i
GROUP BY i."tenantId";

-- NOTIFY trigger for real-time updates
CREATE OR REPLACE FUNCTION notify_counter_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'tenant_counter_update',
    json_build_object(
      'tenantId', COALESCE(NEW."tenantId", OLD."tenantId"),
      'timestamp', now()
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_counter_notify ON "InventoryItem";
CREATE TRIGGER trg_counter_notify
AFTER INSERT OR UPDATE OR DELETE ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION notify_counter_change();

-- Materialized view for faster dashboard loads (refresh every 5 min)
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_sku_counters_cache AS
SELECT * FROM tenant_sku_counters;

CREATE UNIQUE INDEX IF NOT EXISTS idx_counters_cache_tenant 
  ON tenant_sku_counters_cache ("tenantId");

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_counter_cache() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_sku_counters_cache;
END;
$$ LANGUAGE plpgsql;
