# Rollback Procedures — ENH-2026-041 & ENH-2026-042

## Overview
This document outlines the rollback procedures for MapCard and SWIS Preview features in case of critical issues during deployment.

**Last Updated:** 2025-10-21  
**Owner:** DevOps Lead  
**Reviewers:** Engineering Lead, QA Lead  

---

## Quick Rollback Decision Matrix

| Severity | Criteria | Action | Timeline |
|----------|----------|--------|----------|
| **P0 - Critical** | Data loss, security breach, complete outage | Immediate rollback | <15 min |
| **P1 - High** | >5% error rate, major UX degradation | Rollback within 1 hour | <1 hour |
| **P2 - Medium** | 1-5% error rate, minor UX issues | Investigate, rollback if not fixed | <4 hours |
| **P3 - Low** | <1% error rate, cosmetic issues | Fix forward, no rollback | N/A |

---

## Rollback Procedures

### Phase 1: Immediate Disable (5 minutes)

**Step 1: Disable Feature Flags**
```typescript
// In production console or admin panel
import { disableForAll } from '@/lib/featureFlags';

// Disable MapCard
disableForAll('FF_MAP_CARD');

// Disable SWIS Preview
disableForAll('FF_SWIS_PREVIEW');

// Verify flags are disabled
console.log(getAllFeatureFlags());
```

**Step 2: Verify UI Hidden**
- Check production site: Map and SWIS widgets should not render
- Verify settings panels are hidden
- Confirm no console errors

**Expected Result:** Features immediately hidden from all users

---

### Phase 2: API Rollback (15 minutes)

**Step 1: Disable API Routes**

```bash
# SSH to production server
ssh production-server

# Disable geocoding endpoint
sudo systemctl stop geocode-service

# Disable SWIS preview endpoint
sudo systemctl stop swis-preview-service

# Verify services stopped
sudo systemctl status geocode-service
sudo systemctl status swis-preview-service
```

**Step 2: Update Route Guards**

```typescript
// In API middleware
export function mapCardGuard(req, res, next) {
  return res.status(503).json({
    error: 'MapCard feature temporarily unavailable',
    code: 'FEATURE_DISABLED'
  });
}

export function swisPreviewGuard(req, res, next) {
  return res.status(503).json({
    error: 'SWIS Preview temporarily unavailable',
    code: 'FEATURE_DISABLED'
  });
}
```

**Expected Result:** API endpoints return 503 gracefully

---

### Phase 3: Cache Invalidation (10 minutes)

**Step 1: Clear CDN Cache**

```bash
# Cloudflare/Vercel cache purge
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["*/swis/preview","*/geocode"]}'
```

**Step 2: Clear Redis Cache**

```bash
# Connect to Redis
redis-cli

# Clear geocode cache
DEL geocode:*

# Clear SWIS preview cache
DEL swis:preview:*

# Verify cleared
KEYS geocode:*
KEYS swis:preview:*
```

**Expected Result:** All cached data cleared

---

### Phase 4: Database Rollback (30 minutes)

**Only if schema changes were deployed**

**Step 1: Backup Current State**

```sql
-- Backup tables
CREATE TABLE tenant_business_profile_backup AS 
SELECT * FROM tenant_business_profile;

CREATE TABLE swis_feed_preview_settings_backup AS 
SELECT * FROM swis_feed_preview_settings;
```

**Step 2: Rollback Schema Changes**

```sql
-- Remove new columns from tenant_business_profile
ALTER TABLE tenant_business_profile 
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS display_map,
  DROP COLUMN IF EXISTS map_privacy_mode;

-- Drop SWIS settings table
DROP TABLE IF EXISTS swis_feed_preview_settings;

-- Drop geocode cache table
DROP TABLE IF EXISTS geocode_cache;
```

**Step 3: Verify Schema**

```sql
-- Verify columns removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tenant_business_profile';

-- Verify tables dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('swis_feed_preview_settings', 'geocode_cache');
```

**Expected Result:** Schema reverted to pre-deployment state

---

### Phase 5: Code Rollback (15 minutes)

**Step 1: Revert Git Commits**

```bash
# Identify commits to revert
git log --oneline | grep -E "(MapCard|SWIS)"

# Revert the commits (example)
git revert 122569e  # Phase 7: MapCard + SWIS
git revert 477ef97  # Phase 6: Business Profile (if needed)

# Push to production branch
git push origin main
```

**Step 2: Trigger Deployment**

```bash
# Vercel deployment
vercel --prod

# Or trigger via CI/CD
git tag rollback-$(date +%Y%m%d-%H%M%S)
git push --tags
```

**Expected Result:** Previous version deployed

---

### Phase 6: Verification (15 minutes)

**Step 1: Smoke Tests**

```bash
# Run automated smoke tests
npm run test:smoke

# Check critical paths
curl https://production-url.com/
curl https://production-url.com/tenants
curl https://production-url.com/settings/tenant
```

**Step 2: Manual Verification**

- [ ] Homepage loads without errors
- [ ] Tenant list page works
- [ ] Settings page accessible
- [ ] No MapCard or SWIS widgets visible
- [ ] No console errors
- [ ] No 500 errors in logs

**Step 3: Monitor Metrics**

```bash
# Check error rates
datadog-cli metrics query "avg:error.rate{service:rvp-web}"

# Check response times
datadog-cli metrics query "avg:http.response_time{service:rvp-web}"
```

**Expected Result:** All systems green

---

## Post-Rollback Actions

### Immediate (Within 1 hour)

1. **Incident Report**
   - Document what went wrong
   - Timeline of events
   - Impact assessment
   - Root cause analysis

2. **Stakeholder Communication**
   - Notify engineering team
   - Update status page
   - Inform product team
   - Customer communication (if needed)

3. **Data Integrity Check**
   - Verify no data loss
   - Check for orphaned records
   - Validate user data

### Short-term (Within 24 hours)

1. **Root Cause Analysis**
   - Identify failure point
   - Review logs and metrics
   - Reproduce issue in staging
   - Document findings

2. **Fix Development**
   - Create fix branch
   - Implement solution
   - Add regression tests
   - Code review

3. **Testing**
   - Unit tests
   - Integration tests
   - Load tests
   - Security review

### Long-term (Within 1 week)

1. **Improved Monitoring**
   - Add missing metrics
   - Create new alerts
   - Update dashboards

2. **Process Improvements**
   - Update deployment checklist
   - Enhance rollback procedures
   - Improve testing coverage

3. **Documentation**
   - Update runbooks
   - Document lessons learned
   - Share with team

---

## Rollback Validation Checklist

### Pre-Rollback
- [ ] Severity assessed (P0-P3)
- [ ] Stakeholders notified
- [ ] Rollback decision approved
- [ ] Backup created
- [ ] Rollback plan reviewed

### During Rollback
- [ ] Feature flags disabled
- [ ] API endpoints disabled
- [ ] Cache cleared
- [ ] Schema reverted (if needed)
- [ ] Code reverted
- [ ] Deployment triggered

### Post-Rollback
- [ ] Smoke tests passed
- [ ] Manual verification completed
- [ ] Metrics normalized
- [ ] No new errors
- [ ] Incident report created
- [ ] Stakeholders updated

---

## Emergency Contacts

| Role | Name | Contact | Escalation |
|------|------|---------|------------|
| DevOps Lead | TBD | Slack: @devops | Immediate |
| Engineering Lead | TBD | Slack: @eng-lead | <15 min |
| QA Lead | TBD | Slack: @qa-lead | <30 min |
| Product Lead | TBD | Slack: @product | <1 hour |
| On-Call Engineer | TBD | PagerDuty | 24/7 |

---

## Rollback Scripts

### Quick Disable Script

```bash
#!/bin/bash
# rollback-map-swis.sh

echo "🚨 Emergency Rollback: MapCard + SWIS Preview"

# 1. Disable feature flags
echo "Disabling feature flags..."
curl -X POST https://api.production.com/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"FF_MAP_CARD": "off", "FF_SWIS_PREVIEW": "off"}'

# 2. Clear cache
echo "Clearing cache..."
redis-cli DEL "geocode:*" "swis:preview:*"

# 3. Verify
echo "Verifying rollback..."
curl https://production-url.com/health

echo "✅ Rollback complete"
```

### Database Rollback Script

```sql
-- rollback-schema.sql

BEGIN;

-- Backup current state
CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
SELECT * FROM tenant_business_profile;

-- Remove columns
ALTER TABLE tenant_business_profile 
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS display_map,
  DROP COLUMN IF EXISTS map_privacy_mode;

-- Drop tables
DROP TABLE IF EXISTS swis_feed_preview_settings;
DROP TABLE IF EXISTS geocode_cache;

-- Verify
SELECT COUNT(*) FROM tenant_business_profile;

COMMIT;
```

---

## Testing Rollback Procedures

### Staging Rollback Test

**Frequency:** Before each production deployment  
**Duration:** 30 minutes  
**Owner:** QA Lead  

**Steps:**
1. Deploy features to staging
2. Enable feature flags
3. Verify features working
4. Execute rollback procedure
5. Verify rollback successful
6. Document any issues

**Success Criteria:**
- Rollback completes in <30 minutes
- No data loss
- No errors in logs
- All services healthy

---

## Lessons Learned Template

```markdown
# Rollback Incident Report

**Date:** YYYY-MM-DD
**Feature:** MapCard / SWIS Preview
**Severity:** P0/P1/P2/P3
**Duration:** XX minutes

## What Happened
[Description of the issue]

## Timeline
- HH:MM - Issue detected
- HH:MM - Rollback initiated
- HH:MM - Rollback completed
- HH:MM - Services restored

## Root Cause
[Technical explanation]

## Impact
- Users affected: XX%
- Duration: XX minutes
- Data loss: Yes/No

## What Went Well
- [Positive aspects]

## What Went Wrong
- [Issues encountered]

## Action Items
- [ ] Fix root cause
- [ ] Add monitoring
- [ ] Update procedures
- [ ] Team training

## Prevention
[How to prevent in future]
```

---

## Appendix: Monitoring Queries

### Error Rate
```sql
SELECT 
  DATE_TRUNC('minute', timestamp) as time,
  COUNT(*) FILTER (WHERE status >= 500) as errors,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE status >= 500)::float / COUNT(*)) * 100 as error_rate
FROM api_logs
WHERE service IN ('geocode', 'swis-preview')
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY time
ORDER BY time DESC;
```

### Response Time
```sql
SELECT 
  service,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99
FROM api_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY service;
```

---

**Document Version:** 1.0  
**Last Tested:** Pending  
**Next Review:** Before production deployment
