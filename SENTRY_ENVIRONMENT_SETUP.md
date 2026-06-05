# Sentry Environment Configuration - Staging vs Production

**Date**: December 24, 2025
**Status**: Configuration Updated
**Purpose**: Distinguish between staging and production errors in Sentry

---

## 🎯 **Why This Matters**

By default, Sentry uses `NODE_ENV` to tag environments, but both your staging and production deployments use `NODE_ENV=production`. This means all errors appear as "production" in Sentry, making it impossible to filter staging issues from production issues.

**Solution**: Use custom environment variables to explicitly tag each deployment.

---

## ✅ **What's Been Updated**

### **Code Changes**
- ✅ Frontend: `sentry.client.config.ts` - Uses `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- ✅ Frontend: `sentry.server.config.ts` - Uses `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- ✅ Frontend: `sentry.edge.config.ts` - Uses `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- ✅ Backend: `apps/api/src/index.ts` - Uses `SENTRY_ENVIRONMENT`

### **Environment Variable Priority**
```typescript
// Frontend
environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV

// Backend
environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
```

---

## 🚀 **Railway Configuration**

### **Production Deployments**

#### **Web Service (Production)**
Add these environment variables in Railway:
```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ORG=visible-shelf
SENTRY_PROJECT=visible-shelf-web
```

#### **API Service (Production)**
Add these environment variables in Railway:
```
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
```

---

### **Staging Deployments**

#### **Web Service (Staging)**
Add these environment variables in Railway:
```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
SENTRY_ORG=visible-shelf
SENTRY_PROJECT=visible-shelf-web
```

#### **API Service (Staging)**
Add these environment variables in Railway:
```
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=staging
```

---

## 📊 **How to Use in Sentry Dashboard**

### **Filter by Environment**

1. Go to your Sentry project dashboard
2. Click on "Issues" tab
3. Use the environment filter dropdown
4. Select "production" or "staging"

### **Create Environment-Specific Alerts**

1. Go to "Alerts" → "Create Alert"
2. Add condition: "Environment equals production"
3. Set notification channels
4. Save alert

**Example alerts:**
- **Critical**: Production errors with level=error → Slack + Email
- **Monitoring**: Staging errors with level=error → Email only
- **Info**: Staging warnings → No alerts (review manually)

---

## 🎯 **Environment Tagging**

After deploying with the new environment variables, all errors will be tagged:

**Production Errors:**
```json
{
  "environment": "production",
  "server_name": "api.visibleshelf.com",
  "release": "1.0.0"
}
```

**Staging Errors:**
```json
{
  "environment": "staging",
  "server_name": "aps.visibleshelf.store",
  "release": "1.0.0"
}
```

---

## 🧪 **Testing**

### **Test Production Environment**
```bash
# Trigger an error on production
curl -X POST https://api.visibleshelf.com/api/test-error

# Check Sentry dashboard
# Should see error tagged with environment: "production"
```

### **Test Staging Environment**
```bash
# Trigger an error on staging
curl -X POST https://aps.visibleshelf.store/api/test-error

# Check Sentry dashboard
# Should see error tagged with environment: "staging"
```

---

## 📋 **Deployment Checklist**

### **For Each Environment**
- [ ] Add `SENTRY_ENVIRONMENT` variable to Railway
- [ ] Add `NEXT_PUBLIC_SENTRY_ENVIRONMENT` variable to Railway
- [ ] Redeploy service
- [ ] Trigger test error
- [ ] Verify environment tag in Sentry
- [ ] Set up environment-specific alerts

---

## 💡 **Best Practices**

### **Alert Strategy**
1. **Production**: Alert on all errors immediately
2. **Staging**: Alert on critical errors only
3. **Development**: No alerts (errors logged locally)

### **Issue Prioritization**
1. **Production + Critical**: Drop everything, fix now
2. **Production + Error**: Fix within 24 hours
3. **Staging + Error**: Fix before next production deploy
4. **Staging + Warning**: Review weekly

### **Environment Workflow**
1. Develop locally (no Sentry alerts)
2. Deploy to staging (monitor for issues)
3. Test thoroughly in staging
4. Deploy to production (full monitoring)
5. Monitor production closely for 24 hours

---

## 🔍 **Troubleshooting**

### **Errors Still Showing Wrong Environment**

**Check:**
1. Environment variable is set in Railway
2. Service has been redeployed after adding variable
3. Variable name is correct (case-sensitive)
4. No typos in environment value

**Debug:**
```bash
# Check what environment Sentry sees
curl https://api.visibleshelf.com/health

# Should include environment info in response
```

### **Not Seeing Staging Errors**

**Possible causes:**
1. Staging environment variable not set
2. Staging service not redeployed
3. Filtering by wrong environment in Sentry
4. Errors are being filtered out by `beforeSend`

---

## 📈 **Monitoring Strategy**

### **Daily Review**
- Check production error count
- Review new error types
- Verify staging is stable

### **Weekly Review**
- Compare staging vs production error rates
- Identify patterns in staging errors
- Plan fixes for recurring issues

### **Monthly Review**
- Analyze error trends
- Update alert thresholds
- Review environment-specific metrics

---

## ✅ **Summary**

**Before:**
- All errors tagged as "production"
- Can't distinguish staging from production
- Hard to prioritize issues

**After:**
- Errors tagged with correct environment
- Easy filtering in Sentry dashboard
- Environment-specific alerts
- Better issue prioritization

**Next Steps:**
1. Add environment variables to Railway
2. Redeploy all services
3. Test error tracking in both environments
4. Set up environment-specific alerts

---

## 🔜 **Related Documentation**

- `SENTRY_SETUP_GUIDE.md` - Initial Sentry setup
- `UPTIMEROBOT_SETUP_GUIDE.md` - Uptime monitoring
- `MONITORING_DASHBOARD_INTEGRATION.md` - Unified monitoring

