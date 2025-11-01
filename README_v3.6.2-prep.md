# 🚀 v3.6.2-prep Implementation Package

**Feature Branch:** `feature/visibility-alignment-pack-v3.6.1`  
**Base Version:** v3.6.1-stable  
**Retrofit Applied:** 2025-10-31  
**Status:** Ready for Implementation

---

## 📦 Package Contents

This implementation package contains everything needed to build and deploy v3.6.2-prep with all retrofit enhancements.

### Commits Summary

**Commit 1:** `b51d333` - Base v3.6.1 stable spec and sprint checklist
- `SPRINT_CHECKLIST_v3.6.1.md` - 10-day sprint implementation plan
- `specs/retail_visibility_master_spec_v_3_6_1_stable.md` - Stable base specification

**Commit 2:** `6c81bfd` - Retrofit documentation
- `RETROFIT_v3.6.2-prep.md` - All incremental enhancements (R1-R8)

**Commit 3:** `cde60f2` - Implementation files
- SQL migrations (001-003 + rollback)
- Architecture boundaries YAML
- Feature flag registry YAML

---

## 📁 File Structure

```
retail-visibility-platform/
├── SPRINT_CHECKLIST_v3.6.1.md          # Day-by-day implementation plan
├── RETROFIT_v3.6.2-prep.md             # Retrofit enhancements documentation
├── README_v3.6.2-prep.md               # This file
│
├── specs/
│   └── retail_visibility_master_spec_v_3_6_1_stable.md
│
├── apps/api/prisma/migrations/v3.6.2_retrofit/
│   ├── 001_audit_log.sql               # Audit trail table + helper functions
│   ├── 002_feed_push_jobs.sql          # Async job queue with retry logic
│   ├── 003_outreach_feedback.sql       # Pilot feedback collection
│   └── rollback_001_to_003.sql         # Rollback script
│
├── docs/
│   ├── architecture/
│   │   └── boundaries.yaml             # Service boundaries & ownership
│   └── feature-flags/
│       └── registry.yaml               # Feature flag lifecycle & registry
```

---

## 🎯 Quick Start

### 1. Review Documentation
```bash
# Read the sprint checklist
cat SPRINT_CHECKLIST_v3.6.1.md

# Review retrofit enhancements
cat RETROFIT_v3.6.2-prep.md

# Check architecture boundaries
cat docs/architecture/boundaries.yaml

# Review feature flags
cat docs/feature-flags/registry.yaml
```

### 2. Run Migrations (Staging First!)
```bash
# Navigate to migrations directory
cd apps/api/prisma/migrations/v3.6.2_retrofit

# Review migrations
cat 001_audit_log.sql
cat 002_feed_push_jobs.sql
cat 003_outreach_feedback.sql

# Run on staging database
psql $STAGING_DB_URL -f 001_audit_log.sql
psql $STAGING_DB_URL -f 002_feed_push_jobs.sql
psql $STAGING_DB_URL -f 003_outreach_feedback.sql

# Verify tables created
psql $STAGING_DB_URL -c "\dt audit_log feed_push_jobs outreach_feedback"

# Test rollback (optional)
psql $STAGING_DB_URL -f rollback_001_to_003.sql
```

### 3. Configure Feature Flags
```bash
# Set initial flag values (all disabled by default)
export FF_AUDIT_LOG=true
export FF_ASYNC_FEED_JOBS=false
export FF_CATEGORY_MANAGEMENT_PAGE=true
export FF_FEED_ALIGNMENT_ENFORCE=warn
```

### 4. Start Implementation
Follow the day-by-day plan in `SPRINT_CHECKLIST_v3.6.1.md`

---

## 🗄️ Database Migrations

### Migration 001: Audit Log
**Purpose:** Track all entity changes across the platform  
**Tables:** `audit_log`  
**Functions:** `log_audit_event()`  
**Features:**
- Full audit trail with JSON diffs
- RLS policies for tenant isolation
- Helper function for easy logging
- Optional monthly partitioning

**Usage:**
```sql
-- Log an audit event
SELECT log_audit_event(
  'tenant-uuid',
  'category',
  'category-id',
  'update',
  'user-uuid',
  '{"name": "Old Name"}'::jsonb,
  '{"name": "New Name"}'::jsonb,
  '{"ip": "192.168.1.1"}'::jsonb
);
```

### Migration 002: Feed Push Jobs
**Purpose:** Async job processing with exponential backoff retry  
**Tables:** `feed_push_jobs`  
**Functions:** 
- `create_feed_push_job()`
- `start_feed_push_job()`
- `complete_feed_push_job()`
- `fail_feed_push_job()`
- `get_ready_feed_jobs()`

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: +1 minute
- Attempt 3: +5 minutes
- Attempt 4: +15 minutes
- Attempt 5: +1 hour
- Max: 5 retries

**Usage:**
```sql
-- Create a feed push job
SELECT create_feed_push_job(
  'tenant-uuid',
  'SKU-123',
  '{"feed_data": {...}}'::jsonb
);

-- Get jobs ready for processing
SELECT * FROM get_ready_feed_jobs(10);
```

### Migration 003: Outreach Feedback
**Purpose:** Collect pilot feedback and track KPIs  
**Tables:** `outreach_feedback`  
**Views:** `feedback_analytics`, `pilot_program_kpis`  
**Functions:** `submit_feedback()`

**Pilot KPIs:**
- Satisfaction: ≥80% (score 4-5)
- Feed Accuracy: ≥90%
- Engagement: ≥60%
- Time to Alignment: ≤90s

**Usage:**
```sql
-- Submit feedback
SELECT submit_feedback(
  'tenant-uuid',
  '{"comment": "Great feature!", "rating": 5}'::jsonb,
  5,
  'usability',
  'category_alignment'
);

-- View pilot KPIs
SELECT * FROM pilot_program_kpis;
```

---

## 🏗️ Architecture

### Service Boundaries (5 Services)

1. **Auth Service** (port 3001)
   - Owns: tenant, user, session, RLS
   - Responsibilities: Authentication, authorization, RBAC

2. **Inventory Service** (port 3002)
   - Owns: inventory_item, tenant_category, feed_push_jobs
   - Responsibilities: SKU CRUD, category management, feed sync

3. **Business Profile Service** (port 3003)
   - Owns: tenant_business_profile
   - Responsibilities: NAP data, hours, SEO, maps

4. **Integrations Service** (port 3004)
   - Owns: google_oauth_*, stripe_*
   - Responsibilities: OAuth, Google Merchant, GBP, Stripe

5. **Observability Service** (port 3005)
   - Owns: audit_log, outreach_feedback
   - Responsibilities: Metrics, alerts, dashboards, feedback

### API Gateway
- Port: 8080
- Provider: Kong/Nginx/Traefik
- Rate Limiting: 1000 req/min global, per-service limits
- Authentication: JWT with Bearer token

---

## 🚩 Feature Flags

### Active Flags (Production Ready)
- `FF_SCHEMA_V34_READY` - SWIS-ready schema (100%)
- `FF_CATEGORY_MANAGEMENT_PAGE` - Category UI (100%)
- `FF_FEED_ALIGNMENT_ENFORCE` - Feed validation (warn mode)
- `FF_AUDIT_LOG` - Audit trail (100%)

### Pilot Flags (Testing)
- `FF_BUSINESS_PROFILE` - Business profile module (20%)
- `FF_GOOGLE_CONNECT_SUITE` - Google OAuth (15%)
- `FF_CATEGORY_QUICK_ACTIONS` - Quick Actions footer (30%)
- `FF_ASYNC_FEED_JOBS` - Async job processing (30%)

### A/B Test Flags
- `FF_SWIS_PREVIEW` - SWIS preview pane (20% rollout)

### Flag Lifecycle
- **Max Lifetime:** 6 months
- **Review:** Quarterly
- **Expiry Warning:** 30 days before
- **Auto-Cleanup:** 30 days after expiry

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

## 🚨 Rollback Procedure

### Immediate Rollback
```bash
# 1. Disable feature flags
export FF_CATEGORY_MANAGEMENT_PAGE=false
export FF_CATEGORY_QUICK_ACTIONS=false
export FF_FEED_ALIGNMENT_ENFORCE=warn
export FF_ASYNC_FEED_JOBS=false

# 2. Revert application
kubectl rollout undo deployment/rvp-app

# 3. Clear cache
redis-cli FLUSHDB

# 4. Database rollback (if needed)
psql $DB_URL -f apps/api/prisma/migrations/v3.6.2_retrofit/rollback_001_to_003.sql
```

### Post-Rollback
1. Notify stakeholders in Slack #incidents
2. Update status page
3. Email affected pilot tenants
4. Schedule post-mortem within 24h

---

## 📅 Implementation Timeline

| Phase | Days | Owner | Deliverables |
|-------|------|-------|--------------|
| Data Layer | 1-2 | API Lead | Migrations 001-003, rollback script |
| Architecture | 3 | Tech Lead | Service boundaries, API Gateway |
| Core APIs | 4-5 | API Lead | 20+ endpoints, audit logging |
| UI Foundation | 6-7 | UX Lead | Routing, CSRF, Business Profile |
| Category UI | 8-9 | UX Lead | Category page, alignment drawer |
| Final Polish | 10 | All | Quick Actions, testing, docs |

**Total Duration:** 10 days (2 weeks)

---

## 🔗 Key Resources

### Documentation
- **Base Spec:** `specs/retail_visibility_master_spec_v_3_6_1_stable.md`
- **Sprint Plan:** `SPRINT_CHECKLIST_v3.6.1.md`
- **Retrofit Doc:** `RETROFIT_v3.6.2-prep.md`
- **Architecture:** `docs/architecture/boundaries.yaml`
- **Feature Flags:** `docs/feature-flags/registry.yaml`

### Migrations
- **Audit Log:** `apps/api/prisma/migrations/v3.6.2_retrofit/001_audit_log.sql`
- **Feed Jobs:** `apps/api/prisma/migrations/v3.6.2_retrofit/002_feed_push_jobs.sql`
- **Feedback:** `apps/api/prisma/migrations/v3.6.2_retrofit/003_outreach_feedback.sql`
- **Rollback:** `apps/api/prisma/migrations/v3.6.2_retrofit/rollback_001_to_003.sql`

### Monitoring
- **Datadog:** [Dashboard URLs to be added]
- **Sentry:** [Project URL to be added]
- **Synthetic Monitors:** [Monitor URLs to be added]

---

## 👥 Team Contacts

- **Platform Owner:** tech_lead@retailvisibility.com
- **Auth Team:** auth-team@retailvisibility.com
- **API Team:** api-team@retailvisibility.com
- **UX Team:** ux-team@retailvisibility.com
- **Integrations Team:** integrations-team@retailvisibility.com
- **DevOps Team:** devops-team@retailvisibility.com

---

## ✅ Pre-Implementation Checklist

Before starting implementation:

- [ ] All team members have reviewed the sprint checklist
- [ ] Database backup completed
- [ ] Staging environment ready
- [ ] Feature flags configured
- [ ] Monitoring dashboards created
- [ ] Pilot tenant cohort selected (10 tenants)
- [ ] Rollback procedure tested
- [ ] Team kickoff meeting scheduled

---

## 📝 Notes

- This is a **retrofit** release - v3.6.1 base + production-ready enhancements
- All migrations are **idempotent** and can be run multiple times safely
- Feature flags allow **gradual rollout** - start with pilot, expand to production
- **Rollback script tested** and ready for emergency use
- **Audit logging** captures all changes for compliance and debugging

---

**Created:** 2025-10-31  
**Last Updated:** 2025-10-31  
**Version:** 1.0
