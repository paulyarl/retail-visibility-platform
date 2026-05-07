# Deployment Procedures - Visible Shelf

**Version**: 1.0  
**Last Updated**: December 24, 2025  
**Status**: Production Ready

---

## 📋 **Table of Contents**

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Process](#deployment-process)
3. [Rollback Procedures](#rollback-procedures)
4. [Emergency Procedures](#emergency-procedures)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Alerts](#monitoring--alerts)

---

## 🎯 **Deployment Strategy**

**Platform**: Railway  
**Environments**: Staging → Production  
**Deployment Type**: Continuous Deployment (CD) via Git Push  
**Rollback Method**: Git revert + Railway redeploy

---

## ✅ **Pre-Deployment Checklist**

### **Code Quality**
- [ ] All tests passing locally
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Code reviewed (if team deployment)
- [ ] Database migrations tested locally

### **Environment Variables**
- [ ] All required env vars set in Railway
- [ ] Secrets rotated if needed
- [ ] API keys validated
- [ ] Database connection strings verified

### **Database**
- [ ] Migrations reviewed and tested
- [ ] Backup created (automatic on Supabase)
- [ ] Migration rollback plan documented
- [ ] No breaking schema changes without migration path

### **Dependencies**
- [ ] `package.json` dependencies up to date
- [ ] No critical security vulnerabilities (`pnpm audit`)
- [ ] Lock file committed (`pnpm-lock.yaml`)

### **Documentation**
- [ ] CHANGELOG updated
- [ ] Breaking changes documented
- [ ] API changes documented (if applicable)

---

## 🚀 **Deployment Process**

### **Step 1: Deploy to Staging**

#### **1.1 Push to Staging Branch**
```bash
# Ensure you're on the correct branch
git checkout staging

# Merge latest changes
git merge main

# Push to trigger deployment
git push origin staging
```

#### **1.2 Monitor Staging Deployment**
```bash
# Watch Railway deployment logs
# Go to: https://railway.app/project/[project-id]/deployments

# Or use Railway CLI
railway logs --service web --environment staging
railway logs --service api --environment staging
```

#### **1.3 Verify Staging Deployment**
```bash
# Check health endpoints
curl https://visibleshelf.store
curl https://aps.visibleshelf.store/health
curl https://aps.visibleshelf.store/health/db

# Expected responses:
# Frontend: 200 OK (HTML page)
# API health: {"status":"ok","healthy":true,...}
# DB health: {"status":"ok","database":"connected",...}
```

#### **1.4 Run Smoke Tests on Staging**
- [ ] Login works
- [ ] Quick Start flow works
- [ ] Product creation works
- [ ] Photo upload works
- [ ] Storefront loads
- [ ] Critical API endpoints respond

**Staging URL**: https://visibleshelf.store  
**Staging API**: https://aps.visibleshelf.store

---

### **Step 2: Deploy to Production**

#### **2.1 Create Release Tag**
```bash
# Tag the release
git tag -a v1.x.x -m "Release v1.x.x - [Brief description]"
git push origin v1.x.x
```

#### **2.2 Push to Production Branch**
```bash
# Switch to production branch
git checkout production

# Merge from staging (already tested)
git merge staging

# Push to trigger deployment
git push origin production
```

#### **2.3 Monitor Production Deployment**
```bash
# Watch Railway deployment logs
railway logs --service web --environment production
railway logs --service api --environment production

# Watch for errors in Sentry
# Go to: https://visible-shelf.sentry.io/issues/

# Monitor UptimeRobot
# Go to: https://uptimerobot.com/dashboard
```

#### **2.4 Verify Production Deployment**
```bash
# Check health endpoints
curl https://visibleshelf.com
curl https://api.visibleshelf.com/health
curl https://api.visibleshelf.com/health/db

# Check critical pages
curl -I https://visibleshelf.com/login
curl -I https://visibleshelf.com/signup
```

---

### **Step 3: Database Migrations**

#### **3.1 Review Migration**
```bash
# Check pending migrations
npx prisma migrate status

# Review migration SQL
cat prisma/migrations/[timestamp]_[name]/migration.sql
```

#### **3.2 Apply Migration (Staging)**
```bash
# Connect to staging database
# Set DATABASE_URL to staging in .env

# Apply migration
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

#### **3.3 Apply Migration (Production)**
```bash
# IMPORTANT: Backup database first (automatic on Supabase)

# Connect to production database
# Set DATABASE_URL to production in .env

# Apply migration
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

#### **3.4 Migration Rollback (If Needed)**
```sql
-- Connect to database via Supabase dashboard
-- Run rollback SQL manually

-- Example: Rollback a table creation
DROP TABLE IF EXISTS new_table;

-- Example: Rollback a column addition
ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;
```

---

## 🔄 **Rollback Procedures**

### **When to Rollback**

**Immediate rollback if:**
- Critical functionality broken
- Database corruption detected
- Security vulnerability introduced
- >50% error rate in Sentry
- Multiple user reports of issues

**Evaluate before rollback:**
- Minor UI issues (can be hotfixed)
- Non-critical feature bugs
- Performance degradation <20%

---

### **Rollback Process**

#### **Option 1: Railway Rollback (Fastest)**

```bash
# Via Railway Dashboard:
# 1. Go to Deployments tab
# 2. Find last working deployment
# 3. Click "Redeploy"
# 4. Confirm

# Via Railway CLI:
railway rollback --service web --environment production
railway rollback --service api --environment production
```

**Time**: ~2-5 minutes  
**Downtime**: Minimal (rolling deployment)

---

#### **Option 2: Git Revert + Redeploy**

```bash
# 1. Identify the bad commit
git log --oneline -10

# 2. Revert the commit
git revert [commit-hash]

# 3. Push to trigger redeploy
git push origin production

# 4. Monitor deployment
railway logs --service web --environment production
```

**Time**: ~5-10 minutes  
**Downtime**: Minimal

---

#### **Option 3: Database Migration Rollback**

```bash
# 1. Identify the migration to rollback
npx prisma migrate status

# 2. Create rollback migration
# Manually create migration file with reverse SQL

# 3. Apply rollback
npx prisma migrate deploy

# 4. Verify schema
npx prisma db pull
```

**Time**: ~10-20 minutes  
**Downtime**: Depends on migration complexity

---

### **Post-Rollback Actions**

- [ ] Verify all services are healthy
- [ ] Check Sentry for new errors
- [ ] Verify UptimeRobot shows all green
- [ ] Test critical user flows
- [ ] Notify team of rollback
- [ ] Document what went wrong
- [ ] Create issue for fix
- [ ] Plan next deployment

---

## 🚨 **Emergency Procedures**

### **Severity Levels**

#### **P0 - Critical (Immediate Action)**
- **Definition**: Complete service outage, data loss, security breach
- **Response Time**: Immediate
- **Actions**:
  1. Assess impact and root cause
  2. Execute rollback if deployment-related
  3. Notify all stakeholders
  4. Create incident report
  5. Implement fix and redeploy

**Examples**:
- Database down
- Authentication broken
- Payment processing failed
- Security vulnerability exploited

---

#### **P1 - High (Within 1 Hour)**
- **Definition**: Major feature broken, significant user impact
- **Response Time**: <1 hour
- **Actions**:
  1. Assess impact
  2. Determine if rollback needed
  3. Create hotfix if possible
  4. Deploy fix to staging → production

**Examples**:
- Quick Start flow broken
- Photo upload failing
- Storefront not loading
- API returning 500 errors

---

#### **P2 - Medium (Within 24 Hours)**
- **Definition**: Minor feature broken, limited user impact
- **Response Time**: <24 hours
- **Actions**:
  1. Create issue
  2. Plan fix
  3. Include in next deployment

**Examples**:
- UI styling issues
- Non-critical API endpoint errors
- Performance degradation <20%
- Minor data inconsistencies

---

#### **P3 - Low (Within 1 Week)**
- **Definition**: Cosmetic issues, nice-to-have improvements
- **Response Time**: <1 week
- **Actions**:
  1. Add to backlog
  2. Prioritize in sprint planning

**Examples**:
- Typos
- Minor UX improvements
- Non-critical feature requests

---

### **Emergency Contacts**

**On-Call Rotation**: TBD  
**Escalation Path**: TBD

**External Services**:
- **Railway Support**: https://railway.app/help
- **Supabase Support**: https://supabase.com/support
- **Sentry Support**: https://sentry.io/support

---

### **Emergency Runbook**

#### **Service Down**
```bash
# 1. Check Railway status
curl https://api.visibleshelf.com/health

# 2. Check Railway dashboard
# Go to: https://railway.app/project/[project-id]

# 3. Check logs
railway logs --service api --environment production

# 4. Restart service if needed
railway restart --service api --environment production

# 5. If restart fails, rollback
railway rollback --service api --environment production
```

---

#### **Database Connection Issues**
```bash
# 1. Check Supabase status
# Go to: https://status.supabase.com

# 2. Verify connection string
echo $DATABASE_URL

# 3. Test connection
npx prisma db pull

# 4. Check connection pool
# Go to Supabase dashboard → Database → Connection pooling

# 5. Restart API service
railway restart --service api --environment production
```

---

#### **High Error Rate**
```bash
# 1. Check Sentry dashboard
# Go to: https://visible-shelf.sentry.io/issues/

# 2. Identify error pattern
# Filter by: environment=production, last 1 hour

# 3. Check if deployment-related
# Compare error timestamps with deployment time

# 4. Rollback if needed
railway rollback --service web --environment production

# 5. Monitor error rate
# Should decrease within 5 minutes of rollback
```

---

## ✅ **Post-Deployment Verification**

### **Automated Checks**

```bash
# Health endpoints
curl https://api.visibleshelf.com/health
curl https://api.visibleshelf.com/health/db

# Critical API endpoints
curl https://api.visibleshelf.com/api/auth/session
curl https://api.visibleshelf.com/api/items

# Frontend pages
curl -I https://visibleshelf.com
curl -I https://visibleshelf.com/login
curl -I https://visibleshelf.com/signup
```

### **Manual Verification**

- [ ] Login flow works
- [ ] Signup flow works
- [ ] Quick Start creates products
- [ ] Photo upload works
- [ ] Storefront displays correctly
- [ ] Admin dashboard loads
- [ ] No console errors
- [ ] No Sentry errors

### **Monitoring Verification**

- [ ] UptimeRobot shows all monitors green
- [ ] Sentry error rate normal (<10 errors/hour)
- [ ] Railway metrics normal (CPU <50%, Memory <70%)
- [ ] Response times normal (<500ms p95)

---

## 📊 **Monitoring & Alerts**

### **UptimeRobot Monitors**

**Production**:
- Frontend: https://visibleshelf.com (5 min interval)
- API: https://api.visibleshelf.com/health (5 min interval)
- Database: https://api.visibleshelf.com/health/db (5 min interval)

**Staging**:
- Frontend: https://visibleshelf.store (5 min interval)
- API: https://aps.visibleshelf.store/health (5 min interval)
- Database: https://aps.visibleshelf.store/health/db (5 min interval)

### **Sentry Alerts**

**Critical** (Immediate notification):
- Error rate >50 errors/hour (production)
- Database connection errors
- Authentication failures
- Payment processing errors

**Warning** (Email notification):
- Error rate >10 errors/hour (production)
- Performance degradation >1s p95
- New error types

### **Railway Metrics**

**Monitor**:
- CPU usage (alert if >80% for 5 min)
- Memory usage (alert if >90% for 5 min)
- Deployment failures
- Build time (alert if >10 min)

---

## 📝 **Deployment Log Template**

```markdown
## Deployment - [Date] - v[Version]

**Deployed by**: [Name]
**Environment**: Production
**Deployment time**: [Start] - [End]
**Downtime**: [Duration or "None"]

### Changes
- [Feature/Fix 1]
- [Feature/Fix 2]
- [Migration: Description]

### Pre-deployment checks
- [x] All tests passing
- [x] Staging verified
- [x] Database backup confirmed

### Deployment steps
1. [Timestamp] Pushed to production branch
2. [Timestamp] Railway deployment started
3. [Timestamp] Database migration applied
4. [Timestamp] Deployment completed
5. [Timestamp] Verification passed

### Issues encountered
- [None or describe issues]

### Rollback plan
- [Describe rollback steps if needed]

### Post-deployment metrics
- Error rate: [X errors/hour]
- Response time: [Xms p95]
- Uptime: [100%]
```

---

## 🔐 **Security Considerations**

### **Pre-Deployment**
- [ ] No secrets in code
- [ ] Environment variables encrypted
- [ ] API keys rotated if compromised
- [ ] Dependencies scanned for vulnerabilities

### **During Deployment**
- [ ] Use secure connections (HTTPS)
- [ ] Verify SSL certificates
- [ ] Check CORS settings
- [ ] Validate authentication flows

### **Post-Deployment**
- [ ] Monitor for unusual activity
- [ ] Check Sentry for security errors
- [ ] Verify rate limiting working
- [ ] Test authentication edge cases

---

## 📚 **Related Documentation**

- `SENTRY_SETUP_GUIDE.md` - Error tracking setup
- `UPTIMEROBOT_SETUP_GUIDE.md` - Uptime monitoring
- `MONITORING_DASHBOARD_INTEGRATION.md` - Unified monitoring
- `PHASE_2_GAP_ANALYSIS_AND_IMPLEMENTATION.md` - Implementation plan

---

## 🎯 **Deployment Frequency**

**Current Target**:
- **Staging**: Daily (or on-demand)
- **Production**: Weekly (or critical fixes)

**Future Target**:
- **Staging**: Multiple times per day
- **Production**: Daily (with confidence from monitoring)

---

## ✅ **Success Criteria**

A deployment is considered successful when:
- [ ] All health checks pass
- [ ] No errors in Sentry (first 30 min)
- [ ] All UptimeRobot monitors green
- [ ] Response times normal
- [ ] Critical user flows verified
- [ ] No user-reported issues (first 24 hours)

---

**Last Review**: December 24, 2025  
**Next Review**: January 24, 2026  
**Owner**: Platform Team
