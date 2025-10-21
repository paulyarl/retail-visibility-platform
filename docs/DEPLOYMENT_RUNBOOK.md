# Deployment Runbook — RETROFIT-G-MVP-2025-01

**Initiative:** Global Expansion Retrofit  
**PRs:** #1 (DB+Flags), #2 (FE i18n), #3 (Observability)  
**Requirements:** REQ-2025-901 through REQ-2025-905

---

## 📋 Pre-Deployment Checklist

### Environment Variables

**Railway (API):**
- [ ] `FF_GLOBAL_TENANT_META=false`
- [ ] `FF_AUDIT_LOG=false`
- [ ] `FF_I18N_SCAFFOLD=false`
- [ ] `FF_CURRENCY_RATE_STUB=false`
- [ ] `SERVICE_TOKEN=<secure-token>` (generate with `openssl rand -hex 32`)

**Vercel (Web):**
- [ ] `NEXT_PUBLIC_FF_I18N_SCAFFOLD=false`

### Dependencies
- [ ] `pnpm install` completed in `apps/web`
- [ ] `pnpm install` completed in `apps/api`

### Git State
- [ ] All commits on `spec-sync` branch
- [ ] Pushed to `origin/spec-sync`
- [ ] No uncommitted changes

---

## 🚀 Deployment Sequence

### Step 1: Deploy API (Railway)

**Trigger:** Push to `spec-sync` branch auto-deploys to Railway

**Migrations Applied:**
1. `20251021120000_add_tenant_global_fields` — Tenant metadata columns + audit_log table
2. `20251021160000_add_currency_rates_table` — currency_rates table

**Verify:**
```bash
# Check Railway logs for migration success
# Look for: "Migration 20251021120000_add_tenant_global_fields applied"
# Look for: "Migration 20251021160000_add_currency_rates_table applied"
```

**Database Verification:**
```sql
-- Connect to Railway Postgres
-- Check tenant columns exist
SELECT region, language, currency, data_policy_accepted 
FROM "Tenant" LIMIT 1;

-- Check audit_log table exists
SELECT COUNT(*) FROM audit_log;

-- Check currency_rates table exists
SELECT COUNT(*) FROM currency_rates;
```

**Expected Results:**
- All 3 tables/columns exist
- No errors in Railway logs
- API health check passes: `https://your-railway-url.railway.app/health`

---

### Step 2: Deploy Web (Vercel)

**Trigger:** Push to `spec-sync` branch auto-deploys to Vercel

**Build Steps:**
1. `pnpm install` (includes i18next dependencies)
2. `next build --turbopack`
3. Deploy to production

**Verify:**
```bash
# Check Vercel deployment logs
# Look for: "Build completed successfully"
# Look for: No errors related to i18next
```

**Frontend Verification:**
- Visit `https://your-vercel-url.vercel.app/items`
- Verify: No visual changes (flag OFF)
- Verify: No console errors
- Visit `https://your-vercel-url.vercel.app/settings/tenant`
- Verify: Tenant Settings page loads
- Verify: Shows region/language/currency/data_policy_accepted (read-only)

**Expected Results:**
- Build succeeds
- No visual changes on Inventory page
- Tenant Settings page accessible
- No console errors

---

## 🧪 Post-Deployment Validation

### Smoke Tests (Flags OFF)

**Test 1: Tenant CRUD**
```bash
# Create tenant
curl -X POST https://your-railway-url.railway.app/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Tenant"}'

# Expected: 201, tenant created with default region/language/currency
```

**Test 2: Item CRUD**
```bash
# Create item
curl -X POST https://your-railway-url.railway.app/items \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-tenant", "sku": "TEST-001", "name": "Test Item"}'

# Expected: 201, item created
```

**Test 3: Audit Log (Flag OFF)**
```sql
-- Check audit_log is empty (flag OFF)
SELECT COUNT(*) FROM audit_log;
-- Expected: 0 rows
```

**Test 4: Rate-Job (Flag OFF)**
```bash
curl -X POST https://your-railway-url.railway.app/jobs/rates/daily \
  -H "Authorization: Bearer $SERVICE_TOKEN"

# Expected: 503 {"error": "rate_job_disabled"}
```

**Test 5: Frontend i18n (Flag OFF)**
- Visit `/items`
- Verify: Strings display as raw fallbacks (e.g., "Search by SKU or name")
- Open browser console
- Verify: No i18next initialization logs

---

### Integration Tests (Flags ON)

**⚠️ Only run these in staging/dev environments**

#### Enable Audit Log
```bash
# Railway: Set FF_AUDIT_LOG=true
```

**Test:**
```bash
# Create tenant
curl -X POST https://your-railway-url.railway.app/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Audit Test Tenant"}'

# Check audit_log
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;
# Expected: 1 row with action='create', entity_type='tenant'
```

#### Enable i18n Scaffold
```bash
# Vercel: Set NEXT_PUBLIC_FF_I18N_SCAFFOLD=true
```

**Test:**
- Visit `/items`
- Open browser console
- Verify: i18next initialization logs present
- Verify: Strings resolve from `locales/en-US.json`

#### Enable Currency-Rate Stub
```bash
# Railway: Set FF_CURRENCY_RATE_STUB=true
```

**Test:**
```bash
curl -X POST https://your-railway-url.railway.app/jobs/rates/daily \
  -H "Authorization: Bearer $SERVICE_TOKEN"

# Expected: 200 {"success": true, "base": "USD", "date": "2025-01-21", "rows": 1}

# Check currency_rates
SELECT * FROM currency_rates ORDER BY created_at DESC LIMIT 1;
# Expected: 1 row with base='USD', rates JSON
```

---

## 📊 Monitoring

### Logs to Watch

**Railway (API):**
```bash
# Structured JSON logs with region tags
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

**Vercel (Web):**
- No build errors
- No runtime errors in browser console
- No i18next errors (when flag ON)

### Metrics to Track

**API:**
- Request latency (p50, p95, p99)
- Error rate (5xx responses)
- Database query time
- Audit log write latency (when flag ON)

**Web:**
- Page load time
- Time to Interactive (TTI)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

### Alerts (Disabled by Default)

**To enable alerts:**
1. Import `apps/api/observability/dashboards/latency-by-region.json` to Grafana
2. Edit JSON: Set `alert.enabled = true`
3. Configure notification channels (Slack, PagerDuty, etc.)
4. Re-import dashboard

**Alert Thresholds:**
- **High Latency:** p95 > 2s for 5 minutes
- **High Error Rate:** 5xx rate > 5% for 5 minutes

---

## 🔄 Rollback Procedures

### Rollback API (Railway)

**Option 1: Disable Flags**
```bash
# Railway environment variables
FF_GLOBAL_TENANT_META=false
FF_AUDIT_LOG=false
FF_CURRENCY_RATE_STUB=false
```

**Option 2: Revert Code**
```bash
git revert 2502373 af6b9bd 36bbeba
git push origin spec-sync
# Railway auto-deploys reverted code
```

**Option 3: Revert Migrations**
```sql
-- Connect to Railway Postgres
DROP TABLE IF EXISTS currency_rates;
DROP TABLE IF EXISTS audit_log;
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS region;
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS language;
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS currency;
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS data_policy_accepted;
```

---

### Rollback Web (Vercel)

**Option 1: Disable Flag**
```bash
# Vercel environment variables
NEXT_PUBLIC_FF_I18N_SCAFFOLD=false
```

**Option 2: Revert Code**
```bash
git revert dff12d9 a89f6f9
git push origin spec-sync
# Vercel auto-deploys reverted code
```

**Option 3: Rollback Deployment**
- Go to Vercel dashboard
- Select previous deployment
- Click "Promote to Production"

---

## 📝 Post-Deployment Tasks

### Documentation
- [ ] Update Master Spec Changelog with REQ-2025-901 through REQ-2025-905
- [ ] Tag release: `git tag mvp-v1.0.1+retrofit-g-2025-01`
- [ ] Push tag: `git push origin mvp-v1.0.1+retrofit-g-2025-01`

### Observability
- [ ] Import Grafana dashboard from `observability/dashboards/latency-by-region.json`
- [ ] Configure APM integration (Datadog, New Relic, etc.) — see `observability/README.md`
- [ ] Set up log aggregation (Loki, CloudWatch, etc.)

### Testing
- [ ] Run full regression test suite
- [ ] Validate all existing flows (tenant CRUD, item CRUD, photo upload, etc.)
- [ ] Test with flags ON in staging environment

### Communication
- [ ] Notify team of deployment completion
- [ ] Share runbook and PR links
- [ ] Schedule retrospective

---

## 🎯 Success Criteria

### All Flags OFF (Production)
- ✅ Zero behavior change
- ✅ No visual differences
- ✅ No performance degradation
- ✅ No errors in logs
- ✅ All existing flows working

### Flags ON (Staging/Internal)
- ✅ Audit log writes on tenant/item mutations
- ✅ i18n strings resolve from locale files
- ✅ Currency-rate job inserts mock rates
- ✅ Structured logs with region tags
- ✅ Tenant Settings page displays metadata

### Infrastructure
- ✅ Migrations applied successfully
- ✅ Tables/columns exist in database
- ✅ Feature flags configured
- ✅ Environment variables set
- ✅ Dashboard JSON in repo

---

## 📞 Support Contacts

**On-Call Engineer:** [Your Name]  
**Slack Channel:** #rvp-deployments  
**Runbook Location:** `docs/DEPLOYMENT_RUNBOOK.md`  
**PR Links:**
- PR #1: DB+Flags (REQ-2025-901, REQ-2025-902)
- PR #2: FE i18n (REQ-2025-903)
- PR #3: Observability (REQ-2025-904, REQ-2025-905)

---

## 🔍 Troubleshooting

### Issue: Migration fails on Railway

**Symptoms:** Railway logs show migration error

**Solution:**
1. Check migration SQL syntax
2. Verify database connection
3. Check for conflicting migrations
4. Manually apply migration: `npx prisma migrate deploy`

---

### Issue: Vercel build fails

**Symptoms:** Build error related to i18next

**Solution:**
1. Check `pnpm-lock.yaml` is committed
2. Verify `package.json` has correct versions
3. Clear Vercel build cache and retry
4. Check for TypeScript errors

---

### Issue: Rate-job returns 401 even with valid token

**Symptoms:** `POST /jobs/rates/daily` returns 401

**Solution:**
1. Verify `SERVICE_TOKEN` is set in Railway
2. Check token format: `Authorization: Bearer <token>`
3. Ensure token matches exactly (no extra spaces)
4. Check Railway logs for token validation errors

---

### Issue: Tenant Settings page shows "No tenant selected"

**Symptoms:** `/settings/tenant` shows error message

**Solution:**
1. Visit `/tenants` first to select a tenant
2. Check localStorage for `tenantId` key
3. Verify tenant exists in database
4. Check API `/api/tenants` endpoint returns data

---

## ✅ Deployment Complete

Once all checks pass:
- [ ] Mark deployment as successful
- [ ] Update status page
- [ ] Close deployment ticket
- [ ] Archive deployment logs

**Congratulations! 🎉 RETROFIT-G-MVP-2025-01 is live!**
