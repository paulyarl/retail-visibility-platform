# 🔁 Retrofit Applied: v3.6.2-prep
**Base Version:** v3.6.1-stable  
**Retrofit Date:** 2025-10-31  
**Status:** Implementation-Ready  
**Feature Branch:** `feature/visibility-alignment-pack-v3.6.1`

---

## 📋 Retrofit Summary

This document captures all **additional** requirements applied to v3.6.1 to prepare for v3.6.2. These are incremental changes that enhance the base spec with production-ready patterns.

---

## R1. Architecture Boundaries

### Service Separation
```yaml
services:
  auth:
    owns: [tenant, user, session, RLS]
    port: 3001
  inventory:
    owns: [SKU CRUD, feed sync, category management]
    port: 3002
  business_profile:
    owns: [NAP, hours, SEO, maps]
    port: 3003
  integrations:
    owns: [Google OAuth, Merchant, GBP, Stripe]
    port: 3004
  observability:
    owns: [metrics export, alert rules, dashboards]
    port: 3005

api_gateway:
  enabled: true
  rate_limiting: per_service
  authentication: JWT
```

### Deliverables
- [ ] Create `architecture_boundaries.yaml` in `/docs/architecture/`
- [ ] Service dependency diagram (Mermaid or draw.io)
- [ ] Data flow diagram
- [ ] Kubernetes/Docker manifests per service

---

## R2. Data Layer Additions

### Audit Log Table
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity text NOT NULL,          -- 'category', 'profile', 'sku', etc.
  entity_id text NOT NULL,
  action text NOT NULL,           -- 'create', 'update', 'delete', 'align'
  actor_id uuid,                  -- user who performed action
  timestamp timestamptz DEFAULT now(),
  diff jsonb                      -- old vs new values
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
```

**Partition Strategy:** Monthly partitions for performance (retain 12 months).

### Feed Push Jobs Table (Async + Retries)
```sql
CREATE TABLE IF NOT EXISTS feed_push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sku text,
  job_status text CHECK (job_status IN ('queued','processing','success','failed')),
  retry_count int DEFAULT 0,
  last_attempt timestamptz,
  next_retry timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feed_jobs_tenant ON feed_push_jobs(tenant_id, job_status);
CREATE INDEX idx_feed_jobs_retry ON feed_push_jobs(next_retry) WHERE job_status = 'queued';
```

**Retry Logic:** Exponential backoff
- Attempt 1: Immediate
- Attempt 2: +1 minute
- Attempt 3: +5 minutes
- Attempt 4: +15 minutes
- Attempt 5: +1 hour
- Max retries: 5

### Outreach Feedback Table
```sql
CREATE TABLE IF NOT EXISTS outreach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  feedback jsonb,
  score integer CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feedback_tenant ON outreach_feedback(tenant_id, created_at DESC);
```

### Rollback Pack
Create `rollback_001_to_007.sql`:
```sql
-- Drop new retrofit tables
DROP TABLE IF EXISTS outreach_feedback;
DROP TABLE IF EXISTS feed_push_jobs;
DROP TABLE IF EXISTS audit_log;

-- Drop views
DROP VIEW IF EXISTS swis_feed_quality_report;
DROP VIEW IF EXISTS swis_feed_view;
DROP VIEW IF EXISTS v_feed_category_resolved;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_inventory_item_qty_avail ON inventory_item;
DROP TRIGGER IF EXISTS trg_inventory_item_touch ON inventory_item;

-- Relax NOT NULL constraints (if needed for rollback)
ALTER TABLE inventory_item
  ALTER COLUMN tenant_id DROP NOT NULL,
  ALTER COLUMN sku DROP NOT NULL,
  ALTER COLUMN title DROP NOT NULL;

-- Keep enums (safe to leave)
```

---

## R3. Observability & Synthetic Monitoring

### SLA Targets
- **Uptime:** ≥99.9%
- **Synthetic Latency (p95):** <400ms
- **Feed Push Success Rate:** ≥95%

### Datadog Dashboards

#### Dashboard 1: Category Alignment
- `feed_approval_rate` (target ≥95%)
- `category_mapping_coverage_pct` (target 100%)
- `qa_footer_engagement_rate` (target ≥60%)
- `time_to_alignment_median_ms` (target ≤90s)
- `taxonomy_version_active_age_days` (target ≤30 days)

#### Dashboard 2: Feed Push Jobs
- `feed_push_success_rate` (target ≥95%)
- Job queue depth
- Retry distribution histogram
- Average processing time
- Error rate by tenant

#### Dashboard 3: API Performance
- `swis_preview_p95_ms` (target ≤300ms)
- API response times by endpoint
- Error rates by service
- Rate limit hits

### Synthetic Monitoring (3 Journeys)

**Journey 1: Align Category**
1. Login → Navigate to `/t/{tenant}/categories`
2. Open alignment drawer
3. Search Google taxonomy
4. Select mapping → Save
5. Validate success toast
- **Target:** p95 <400ms

**Journey 2: Save Profile**
1. Login → Navigate to `/t/{tenant}/settings/profile`
2. Fill form fields
3. Validate live
4. Save
5. Verify "NAP complete" badge
- **Target:** p95 <400ms

**Journey 3: Feed Push**
1. Login → Navigate to inventory
2. Trigger feed push
3. Monitor job status in `feed_push_jobs`
4. Verify success
- **Target:** p95 <400ms

### Alerts

**Business Metrics:**
- `feed_approval_rate < 95%` → Slack #alerts
- `category_mapping_coverage_pct < 100%` → Slack #alerts
- `oauth_error_rate > 10%` → Slack #critical

**Technical Metrics:**
- Error rate >5% → PagerDuty
- API latency p95 >1s → Slack #alerts
- Job queue depth >1000 → Slack #alerts
- Uptime <99.9% → PagerDuty

---

## R4. Feature Flag Lifecycle

### Flag Registry
Create `flag_registry.yaml`:
```yaml
flags:
  - key: FF_GOOGLE_CONNECT_SUITE
    owner: integrations_team
    created: 2025-09-10
    expires: 2026-03-01
    status: pilot
    description: "Enables Google OAuth and sync features"
    
  - key: FF_FEED_ALIGNMENT_ENFORCE
    owner: api_team
    created: 2025-08-15
    expires: 2026-01-15
    status: active
    description: "Blocks feed submission when categories unmapped"
    
  - key: FF_CATEGORY_MANAGEMENT_PAGE
    owner: ux_team
    created: 2025-09-01
    expires: 2026-02-01
    status: active
    description: "Enables category management UI"
    
  - key: FF_CATEGORY_QUICK_ACTIONS
    owner: ux_team
    created: 2025-09-20
    expires: 2026-03-20
    status: pilot
    description: "Enables sticky Quick Actions footer"
```

### Flag Governance Policy
1. **Ownership:** Every flag must have an owner (team or individual)
2. **Expiry:** Max 6 months from creation
3. **Review:** Quarterly flag audit
4. **Cleanup:** Remove flags expired >30 days
5. **Notification:** Email owner 30 days before expiry

### Flag Lifecycle States
- `pilot` - Testing with select tenants
- `active` - Enabled in production
- `deprecated` - Scheduled for removal
- `removed` - Cleaned up from codebase

---

## R5. API Clarifications

### Authentication Standards
- **All `/tenant/*` endpoints:** Require JWT with `tenant_scope`
- **Admin routes (`/admin/*`):** Require `aud=admin` in JWT
- **Sensitive operations:** Require step-up token with `amr=step_up`, valid ≤5 minutes

### Rate Limiting Headers
All API responses include:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1698796800
Retry-After: 60  (on 429 responses)
```

### Client Backoff Guidance
**Exponential Backoff Strategy:**
```javascript
function calculateBackoff(attempt) {
  const baseDelay = 1000; // 1 second
  const maxDelay = 32000; // 32 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 0.3 * delay; // ±30% jitter
  return delay + jitter;
}
```

**Usage:**
- On 429 (Rate Limit): Use `Retry-After` header
- On 5xx (Server Error): Use exponential backoff
- Max retries: 5 attempts

---

## R6. Rollout & CI/CD

### Migration Pipeline
```yaml
# .github/workflows/migrate.yml
name: Database Migrations
on:
  push:
    branches: [main, staging]
    paths: ['apps/api/prisma/migrations/**']

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Flyway Migrations
        run: |
          flyway migrate \
            -url=${{ secrets.DB_URL }} \
            -locations=filesystem:./apps/api/prisma/migrations
      - name: Verify Migration
        run: flyway validate
      - name: Create Rollback Artifact
        run: |
          cp rollback_*.sql /ops/reports/rollback-$(date +%Y%m%d).sql
```

### Deployment Environments
1. **Staging:** Auto-deploy on merge to `staging` branch
2. **Pilot:** Manual promotion from staging (10 tenants)
3. **Production:** Manual promotion after pilot validation

### Artifacts & Reports
Store in `/ops/reports/`:
- Migration logs: `migration-YYYYMMDD.log`
- Rollback scripts: `rollback-YYYYMMDD.sql`
- QA reports: `qa-report-YYYYMMDD.pdf`
- Performance benchmarks: `perf-YYYYMMDD.json`

---

## R7. A11y & UX

### AXE Integration (CI/CD)
```yaml
# .github/workflows/a11y.yml
name: Accessibility Audit
on: [pull_request]

jobs:
  axe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run AXE DevTools
        run: |
          npm run test:a11y
      - name: Fail on Critical Issues
        run: |
          if [ $(cat axe-results.json | jq '.violations | length') -gt 0 ]; then
            echo "Critical A11y issues found"
            exit 1
          fi
```

**Requirements:**
- 0 critical issues to pass
- Color contrast ≥4.5:1
- All interactive elements keyboard-accessible

### NVDA Testing Checklist
- [ ] Screen reader announces all state changes
- [ ] Form errors read aloud
- [ ] Success toasts announced via ARIA live region
- [ ] Modal focus trap working
- [ ] Drawer navigation logical

### Figma Design Link
- **Location:** `/design/sprint-a-v3.6.2.fig`
- **Components:** QuickActionsFooter, AlignmentDrawer, GoogleCard, MapCard, SwisPreviewPane
- **Sync:** Component specs in 2.4.7 match Figma

### Localization Readiness
Extract copy keys for i18n:
```typescript
// en.json
{
  "cta.save": "Save",
  "cta.align": "Align Category",
  "cta.validate": "Validate Feed",
  "toast.saved": "Saved successfully",
  "toast.mapping_updated": "Mapping updated",
  "banner.unmapped": "Some categories are not mapped to Google taxonomy",
  "help.why_align": "Why align? Improves approval rate on Google"
}
```

---

## R8. Outreach & Pilot Feedback

### Pilot KPIs
- **Satisfaction Score:** ≥80% (score 4-5 out of 5)
- **Feed Accuracy:** ≥90% approval rate
- **Engagement:** ≥60% use Quick Actions footer
- **Time to Alignment:** ≤90s median

### Feedback Collection
Query `outreach_feedback` table:
```sql
SELECT 
  tenant_id,
  AVG(score) as avg_score,
  COUNT(*) as feedback_count,
  jsonb_agg(feedback) as all_feedback
FROM outreach_feedback
WHERE created_at >= now() - interval '30 days'
GROUP BY tenant_id
HAVING AVG(score) >= 4;
```

### Pilot Cohort Selection
- 10 tenants total
- Mix: 3 single-location, 5 small chains (2-5 locations), 2 large chains (10+ locations)
- Industries: Hardware, sporting goods, pet supplies, home goods
- Criteria: Active users, >100 SKUs, engaged with support

---

## 📝 Implementation Checklist

### Phase 1: Data Layer (Day 1-2)
- [ ] Create `audit_log` table with monthly partitions
- [ ] Create `feed_push_jobs` table with retry logic
- [ ] Create `outreach_feedback` table
- [ ] Create `rollback_001_to_007.sql`
- [ ] Test rollback script on staging

### Phase 2: Architecture (Day 3)
- [ ] Create `architecture_boundaries.yaml`
- [ ] Draw service dependency diagram
- [ ] Create Kubernetes manifests
- [ ] Configure API Gateway
- [ ] Set up rate limiting per service

### Phase 3: Observability (Day 4-5)
- [ ] Create 3 Datadog dashboards
- [ ] Set up 3 synthetic monitoring journeys
- [ ] Configure 7 alerts (4 business, 3 technical)
- [ ] Test alert routing to Slack/PagerDuty

### Phase 4: Feature Flags (Day 6)
- [ ] Create `flag_registry.yaml`
- [ ] Document flag lifecycle policy
- [ ] Set up quarterly review process
- [ ] Implement expiry notifications

### Phase 5: API Enhancements (Day 7)
- [ ] Add rate limiting headers to all endpoints
- [ ] Document client backoff strategy
- [ ] Implement step-up token flow for sensitive ops
- [ ] Update API documentation

### Phase 6: CI/CD (Day 8)
- [ ] Create migration pipeline (GitHub Actions)
- [ ] Set up Flyway integration
- [ ] Configure artifact storage in `/ops/reports/`
- [ ] Test rollback automation

### Phase 7: A11y & UX (Day 9)
- [ ] Integrate AXE into CI/CD pipeline
- [ ] Perform NVDA testing on all flows
- [ ] Link Figma designs
- [ ] Extract i18n copy keys

### Phase 8: Pilot Setup (Day 10)
- [ ] Select 10 pilot tenants
- [ ] Enable feature flags for pilot cohort
- [ ] Set up feedback collection
- [ ] Schedule weekly check-ins

---

## 🚨 Rollback Plan (Enhanced)

### Immediate Actions
1. **Disable Feature Flags:**
   ```bash
   FF_CATEGORY_MANAGEMENT_PAGE=false
   FF_CATEGORY_QUICK_ACTIONS=false
   FF_FEED_ALIGNMENT_ENFORCE=warn
   FF_GOOGLE_CONNECT_SUITE=false
   ```

2. **Revert Application:**
   ```bash
   kubectl rollout undo deployment/rvp-app
   redis-cli FLUSHDB  # Clear cache
   ```

3. **Database Rollback:**
   ```bash
   psql -f /ops/reports/rollback-$(date +%Y%m%d).sql
   ```

4. **Notify Stakeholders:**
   - Post in Slack #incidents
   - Update status page
   - Email affected pilot tenants
   - Schedule post-mortem within 24h

---

## 📊 Success Metrics

### Technical Metrics
- ✅ All migrations run successfully
- ✅ Rollback tested and verified
- ✅ 0 critical A11y issues
- ✅ API latency p95 <500ms
- ✅ Uptime ≥99.9%

### Business Metrics
- ✅ Feed approval rate ≥95%
- ✅ Category mapping coverage 100%
- ✅ Pilot satisfaction ≥80%
- ✅ QA footer engagement ≥60%

### Operational Metrics
- ✅ All dashboards operational
- ✅ Alerts firing correctly
- ✅ Synthetic monitors passing
- ✅ CI/CD pipeline green

---

## 📅 Timeline

| Phase | Days | Owner | Status |
|-------|------|-------|--------|
| Data Layer | 1-2 | API Lead | 🔴 Not Started |
| Architecture | 3 | Tech Lead | 🔴 Not Started |
| Observability | 4-5 | DevOps | 🔴 Not Started |
| Feature Flags | 6 | Product Ops | 🔴 Not Started |
| API Enhancements | 7 | API Lead | 🔴 Not Started |
| CI/CD | 8 | DevOps | 🔴 Not Started |
| A11y & UX | 9 | UX Lead | 🔴 Not Started |
| Pilot Setup | 10 | Product Ops | 🔴 Not Started |

**Total Duration:** 10 days (2 weeks)

---

## 🔗 Related Documents

- **Base Spec:** `specs/retail_visibility_master_spec_v_3_6_1_stable.md`
- **Sprint Checklist:** `SPRINT_CHECKLIST_v3.6.1.md`
- **Architecture:** `/docs/architecture/boundaries.yaml`
- **Flag Registry:** `/docs/feature-flags/registry.yaml`
- **Rollback Scripts:** `/ops/reports/rollback-*.sql`

---

**Last Updated:** 2025-10-31  
**Next Review:** Daily standup
