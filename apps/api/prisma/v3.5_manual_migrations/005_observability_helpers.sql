-- v3.5 — Observability & Monitoring Helpers
-- Views and functions for SLA tracking

-- Audit log quality metrics
CREATE OR REPLACE VIEW audit_log_quality AS
SELECT
  DATE_TRUNC('hour', occurred_at) AS hour,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE request_id IS NULL) AS missing_request_id,
  COUNT(*) FILTER (WHERE actor_type = 'system') AS system_events,
  COUNT(*) FILTER (WHERE actor_type = 'user') AS user_events,
  COUNT(DISTINCT tenant_id) AS active_tenants,
  AVG(jsonb_array_length(diff->'changes')) AS avg_changes_per_event
FROM audit_log
GROUP BY hour
ORDER BY hour DESC;

-- Policy change history summary
CREATE OR REPLACE VIEW policy_change_summary AS
SELECT
  scope,
  COUNT(*) AS version_count,
  MIN(effective_from) AS first_version,
  MAX(effective_from) AS current_version,
  AVG(EXTRACT(EPOCH FROM (effective_to - effective_from))) / 3600 AS avg_duration_hours
FROM sku_billing_policy_history
GROUP BY scope;

-- Tenant tier status (for alerting)
CREATE OR REPLACE VIEW tenant_tier_status AS
SELECT
  c."tenantId",
  c.billable_sku_count,
  t.metadata->>'tier' AS current_tier,
  t.metadata->>'sku_limit' AS sku_limit,
  CASE
    WHEN (t.metadata->>'sku_limit')::int IS NULL THEN 'no_limit'
    WHEN c.billable_sku_count >= (t.metadata->>'sku_limit')::int THEN 'at_limit'
    WHEN c.billable_sku_count >= (t.metadata->>'sku_limit')::int * 0.9 THEN 'warning'
    ELSE 'ok'
  END AS status
FROM tenant_sku_counters c
JOIN "Tenant" t ON t.id = c."tenantId";

-- SWIS feed quality (from existing view, enhanced)
DROP VIEW IF EXISTS swis_feed_quality_report;
CREATE OR REPLACE VIEW swis_feed_quality_report AS
SELECT
  "tenantId",
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE "imageUrl" IS NULL OR "imageUrl" !~ '^https?://') AS bad_images,
  COUNT(*) FILTER (WHERE price IS NULL OR price < 0) AS bad_prices,
  COUNT(*) FILTER (WHERE currency IS NULL OR char_length(currency) <> 3) AS bad_currency,
  COUNT(*) FILTER (WHERE "updatedAt" < now() - interval '48 hours') AS stale_items,
  COUNT(*) FILTER (WHERE "itemStatus" = 'active' AND visibility = 'public') AS swis_eligible,
  COUNT(*) FILTER (WHERE "eligibilityReason" IS NOT NULL) AS excluded_with_reason
FROM "InventoryItem"
GROUP BY "tenantId";

-- Performance monitoring helper
CREATE OR REPLACE FUNCTION check_index_bloat() RETURNS TABLE (
  table_name text,
  index_name text,
  bloat_pct numeric,
  index_size_mb numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname || '.' || tablename AS table_name,
    indexname AS index_name,
    ROUND(100 * (pg_relation_size(indexrelid) - pg_relation_size(indexrelid, 'main'))::numeric / 
          NULLIF(pg_relation_size(indexrelid), 0), 2) AS bloat_pct,
    ROUND(pg_relation_size(indexrelid)::numeric / 1024 / 1024, 2) AS index_size_mb
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY pg_relation_size(indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;
