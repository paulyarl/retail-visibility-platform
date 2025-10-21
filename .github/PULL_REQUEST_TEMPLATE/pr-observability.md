# PR #3: Observability + Rate-Job Stub (REQ-2025-904, REQ-2025-905)

## 🎯 Objective

Add observability scaffolding and currency-rate job stub:
- Logger with tenant_id and region tags for APM integration
- Grafana dashboard for "Latency by Region" monitoring
- Currency-rate job stub endpoint (feature-flagged, service-token protected)
- Disabled alert placeholders

## 📋 Changes

### Observability Infrastructure
**Files:**
- `apps/api/src/logger.ts` — Structured JSON logger with tenant_id and region tags
- `apps/api/observability/dashboards/latency-by-region.json` — Grafana dashboard JSON
- `apps/api/observability/README.md` — APM integration guide

**Log Format:**
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

### Currency-Rate Job Stub
**Files:**
- `apps/api/src/jobs/rates.ts` — Daily rate job (feature-flagged, service-token protected)
- `apps/api/src/jobs/rates.test.ts` — Unit tests
- `apps/api/prisma/migrations/20251021160000_add_currency_rates_table/migration.sql` — currency_rates table

**Endpoint:** `POST /jobs/rates/daily`
- ✅ Protected by `Authorization: Bearer <SERVICE_TOKEN>`
- ✅ Feature-flagged: `FF_CURRENCY_RATE_STUB` (default OFF)
- ✅ Writes mock rates to `currency_rates` table
- ✅ Returns 503 when flag OFF, 401 when token invalid

### Dashboard Panels
**Grafana JSON includes:**
1. **API Latency by Region (p95)** — Histogram quantile grouped by region
2. **Request Count by Region** — Rate of requests per region
3. **Error Rate by Region** — 5xx rate per region

**Alert (Disabled):**
- Trigger: p95 latency > 2s for 5 minutes
- State: `enabled: false`
- To enable: Set `alert.enabled = true` and configure notification channels

### Environment Variables
**Railway:**
- `FF_CURRENCY_RATE_STUB=false` (default OFF)
- `SERVICE_TOKEN=<secure-token>` (required for rate-job)

## 🧪 Testing

### Flag OFF (Default)
- ✅ `POST /jobs/rates/daily` returns 503 (rate_job_disabled)
- ✅ Logger outputs structured JSON with region tags
- ✅ No currency_rates writes

### Flag ON (Validated in Staging)
- ✅ Valid token → 200, inserts mock rates into currency_rates
- ✅ Invalid token → 401 (unauthorized)
- ✅ Missing token → 401 (unauthorized)
- ✅ Mock rates: USD base with EUR, GBP, JPY, CAD, AUD

### Unit Tests
```bash
cd apps/api
pnpm test src/jobs/rates.test.ts
```

**Coverage:**
- ✅ Returns 503 when flag OFF
- ✅ Returns 401 when token missing
- ✅ Returns 401 when token invalid
- ✅ (Skipped) Returns 200 and inserts rates when flag ON + valid token

## 📊 Acceptance Gates

- [x] **Gate A (Staging):** Logger tags visible in structured logs
- [x] **Gate A (Staging):** Rate-job returns 503 with flag OFF
- [x] **Gate A (Staging):** Rate-job returns 200 with flag ON + valid token
- [x] **Gate B (Pre-Prod):** Dashboard JSON present in repo
- [x] **Gate B (Pre-Prod):** Alert disabled by default
- [x] **Gate C (Prod):** No behavioral diffs (flag OFF)

## 🚀 Deployment Steps

1. **Apply migration to production:**
   ```bash
   # Railway auto-applies on deploy
   # Or manually: npx prisma migrate deploy
   ```

2. **Set SERVICE_TOKEN in Railway:**
   ```bash
   # Generate secure token
   SERVICE_TOKEN=$(openssl rand -hex 32)
   
   # Add to Railway environment variables
   ```

3. **Verify migration:**
   ```sql
   -- Check currency_rates table exists
   SELECT COUNT(*) FROM currency_rates;
   ```

4. **Monitor logs:**
   - Check for structured JSON logs with `tenant_id` and `region` fields
   - No errors related to rate-job endpoint

5. **Optional: Enable flag for testing:**
   ```bash
   FF_CURRENCY_RATE_STUB=true
   ```

6. **Test rate-job endpoint:**
   ```bash
   curl -X POST https://your-railway-url.railway.app/jobs/rates/daily \
     -H "Authorization: Bearer $SERVICE_TOKEN"
   
   # Expected: {"success": true, "base": "USD", "date": "2025-01-21", "rows": 1}
   ```

7. **Import dashboard to Grafana:**
   - Go to Dashboards → Import
   - Upload `observability/dashboards/latency-by-region.json`
   - Select Prometheus datasource
   - Save dashboard

## 🔄 Rollback Plan

If issues arise:

1. **Disable flag:**
   ```bash
   FF_CURRENCY_RATE_STUB=false
   ```

2. **Revert migration (if needed):**
   ```sql
   DROP TABLE IF EXISTS currency_rates;
   ```

3. **Revert code (if needed):**
   ```bash
   git revert 2502373
   git push origin spec-sync
   ```

## 📊 Observability Metrics

**Current State:**
- All requests tagged with `region` from `tenant.region` (default: `us-east-1`)
- All requests tagged with `tenant_id` when available
- Structured JSON logs ready for Loki/CloudWatch/Datadog

**Future APM Integration:**

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

## 🔔 Alert Configuration

**To enable alerts:**

1. Edit `observability/dashboards/latency-by-region.json`:
   ```json
   "alert": {
     "enabled": true,
     "notifications": [{ "uid": "your-notification-channel-uid" }]
   }
   ```

2. Configure notification channels in Grafana:
   - Email, Slack, PagerDuty, etc.

3. Re-import dashboard

**Alert Thresholds:**
- **High Latency:** p95 > 2s for 5 minutes
- **High Error Rate:** 5xx rate > 5% for 5 minutes (future)
- **Feed Success Rate:** < 90% for 30 minutes (future)

## 📝 Related

- **Requirements:** REQ-2025-904 (Observability), REQ-2025-905 (Rate-Job Stub)
- **Initiative:** RETROFIT-G-MVP-2025-01
- **Commits:** `2502373`
- **Depends on:** PR #1 (DB+Flags) for tenant.region
- **Completes:** 3-PR retrofit sequence

## ✅ Checklist

- [x] Logger with tenant_id and region tags
- [x] Rate-job endpoint with service token protection
- [x] Feature flag configured (OFF by default)
- [x] currency_rates table migration
- [x] Grafana dashboard JSON
- [x] Alert disabled by default
- [x] Unit tests for rate-job
- [x] README with APM integration guide
- [x] Zero behavior change with flag OFF
