# Observability Setup

**REQ:** REQ-2025-904 (Observability tags and dashboards)

## Overview

This directory contains observability scaffolding for multi-region monitoring:
- **Dashboards:** Grafana/Datadog JSON definitions
- **Alerts:** Placeholder alert configurations (disabled by default)

## Current State

- **Region tagging:** All requests tagged with `region` from `tenant.region` (default: `us-east-1`)
- **Tenant tagging:** Requests tagged with `tenant_id` when available
- **Logger:** Structured JSON logs with `tenant_id` and `region` fields
- **Dashboards:** Placeholder panel for "Latency by Region" (single bucket expected)

## Setup

### 1. Logger Integration

The `logger.ts` module tags logs with:
```json
{
  "timestamp": "2025-01-21T12:00:00.000Z",
  "level": "info",
  "message": "request_completed",
  "tenant_id": "demo-tenant",
  "region": "us-east-1",
  "method": "GET",
  "path": "/items"
}
```

### 2. APM Integration (Future)

To integrate with your APM provider:

**Datadog:**
```typescript
import tracer from 'dd-trace';
tracer.init();

// In middleware:
tracer.scope().active()?.setTag('tenant_id', ctx.tenantId);
tracer.scope().active()?.setTag('region', ctx.region);
```

**Grafana Loki:**
```typescript
import { createLogger, transports } from 'winston';
import LokiTransport from 'winston-loki';

const logger = createLogger({
  transports: [
    new LokiTransport({
      host: process.env.LOKI_URL,
      labels: { app: 'rvp-api' },
      json: true,
    }),
  ],
});
```

### 3. Dashboard Import

Import `dashboards/latency-by-region.json` into Grafana:
1. Go to Dashboards → Import
2. Upload JSON file
3. Select Prometheus datasource
4. Save dashboard

### 4. Enable Alerts

Edit `dashboards/latency-by-region.json`:
```json
"alert": {
  "enabled": true,
  "notifications": [{ "uid": "your-notification-channel-uid" }]
}
```

## Metrics to Collect

For full observability, instrument your app to expose:

- `http_request_duration_seconds_bucket{region, tenant_id, method, path, status}`
- `http_requests_total{region, tenant_id, method, path, status}`
- `http_request_size_bytes{region, tenant_id}`
- `http_response_size_bytes{region, tenant_id}`

## Alert Thresholds (Disabled by Default)

- **High Latency:** p95 > 2s for 5 minutes
- **High Error Rate:** 5xx rate > 5% for 5 minutes
- **Feed Success Rate:** < 90% for 30 minutes (placeholder)

## Next Steps

1. Deploy APM agent (Datadog, New Relic, etc.)
2. Configure log aggregation (Loki, CloudWatch, etc.)
3. Enable alerts and configure notification channels
4. Add custom metrics for business KPIs (feed success rate, photo upload success, etc.)
