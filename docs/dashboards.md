# RVP Dashboards — Category & Scanning

This doc outlines recommended panels/queries. Adapt to your metrics backend (Grafana/Datadog/Cloud).

## Category KPIs
- gbp_sync_success_rate
  - Panel: % success (Last 24h, stacked success/fail)
  - Query (PromQL-style): sum(rate(gbp_sync_success_total[1h])) / (sum(rate(gbp_sync_success_total[1h])) + sum(rate(gbp_sync_fail_total[1h])))

- hours_out_of_sync_count
  - Panel: current count + trend
  - Query: sum(gbp_hours_out_of_sync)

- taxonomy_stale_count
  - Panel: # stale product mappings by tenant
  - Query: sum by(tenant_id) (product_category_stale)

- mapping_latency_p95
  - Panel: p95 latency of category mapping operations
  - Query: histogram_quantile(0.95, sum by (le) (rate(category_mapping_latency_seconds_bucket[5m])))

## Scanning KPIs
- scan_success_rate
  - Panel: % successful scans over time
  - Query: sum(rate(scan_success_total[5m])) / (sum(rate(scan_success_total[5m])) + sum(rate(scan_fail_total[5m])))

- enrichment_hit_rate
  - Panel: % cache/provider hits
  - Query: sum(rate(enrichment_hit_total[5m])) / sum(rate(enrichment_lookup_total[5m]))

- validation_error_rate
  - Panel: errors per minute
  - Query: sum(rate(scan_validation_error_total[5m]))

- duplicate_detection_latency_ms
  - Panel: p95 latency
  - Query: histogram_quantile(0.95, sum by (le) (rate(duplicate_latency_ms_bucket[5m])))

- commit_success_rate
  - Panel: commits vs invalid/duplicate
  - Query: sum(rate(scan_commit_success_total[5m])) / (sum(rate(scan_commit_success_total[5m])) + sum(rate(scan_commit_fail_total[5m])))

## Category Coverage (UI adjunct)
- category_mapping_coverage_pct
  - Panel: coverage by tenant
  - Source: API /api/{tenantId}/categories/coverage; poll + store as gauge

## Alert Suggestions
- GBP sync success < 95% (5m)
- Enrichment hit rate < 60% (15m)
- Validation error rate spike > baseline +3σ
- Duplicate latency p95 > 1s (15m)
- Hours out-of-sync > 0 for > 60m
