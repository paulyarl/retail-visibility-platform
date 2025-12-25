# Sentry Error Tracking Setup Guide

**Date**: December 24, 2025
**Status**: Configured - Awaiting Sentry Account Setup
**Cost**: $0 (Free tier: 5,000 events/month)

---

## 🎯 **What is Sentry?**

Sentry is an error tracking and performance monitoring platform that helps you:
- Track errors in real-time
- Get detailed stack traces and context
- Monitor application performance
- Set up alerts for critical issues
- Understand user impact of errors

---

## ✅ **What's Already Configured**

### **Frontend (Next.js)**
- ✅ `@sentry/nextjs` package installed
- ✅ `sentry.client.config.ts` - Client-side error tracking
- ✅ `sentry.server.config.ts` - Server-side error tracking
- ✅ `sentry.edge.config.ts` - Edge runtime error tracking
- ✅ `next.config.ts` - Sentry webpack plugin configured

### **Backend (Express API)**
- ✅ `@sentry/node` package installed
- ✅ Sentry initialization in `index.ts`
- ✅ Request handler middleware
- ✅ Error handler middleware
- ✅ Tracing middleware for performance monitoring

---

## 🚀 **Setup Steps**

### **Step 1: Create Sentry Account (Free)**

1. Go to https://sentry.io/signup/
2. Sign up with GitHub or email
3. Create a new organization (e.g., "Visible Shelf")
4. You'll get 5,000 events/month free forever

### **Step 2: Create Projects**

Create two projects in Sentry:

#### **Project 1: Frontend (Next.js)**
1. Click "Create Project"
2. Platform: **Next.js**
3. Project name: `visible-shelf-web` or `vs-web`
4. Copy the **DSN** (looks like: `https://abc123@o123456.ingest.sentry.io/456789`)

#### **Project 2: Backend (Node.js/Express)**
1. Click "Create Project"
2. Platform: **Node.js**
3. Project name: `visible-shelf-api` or `vs-api`
4. Copy the **DSN**

### **Step 3: Add Environment Variables**

#### **Frontend (.env.local in apps/web)**
```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn@o123456.ingest.sentry.io/456789
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development  # or 'staging' or 'production'
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=visible-shelf-web

# Optional: For source map uploads (production only)
SENTRY_AUTH_TOKEN=your-auth-token
```

#### **Backend (.env in apps/api)**
```bash
# Sentry Configuration
SENTRY_DSN=https://your-backend-dsn@o123456.ingest.sentry.io/789012
SENTRY_ENVIRONMENT=development  # or 'staging' or 'production'
```

#### **Railway Environment Variables**
Add these to your Railway deployment:

**For Web Service (Production):**
- `NEXT_PUBLIC_SENTRY_DSN` = Your frontend DSN
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` = `production`
- `SENTRY_ORG` = Your organization slug
- `SENTRY_PROJECT` = visible-shelf-web

**For Web Service (Staging):**
- `NEXT_PUBLIC_SENTRY_DSN` = Your frontend DSN
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` = `staging`
- `SENTRY_ORG` = Your organization slug
- `SENTRY_PROJECT` = visible-shelf-web

**For API Service (Production):**
- `SENTRY_DSN` = Your backend DSN
- `SENTRY_ENVIRONMENT` = `production`

**For API Service (Staging):**
- `SENTRY_DSN` = Your backend DSN
- `SENTRY_ENVIRONMENT` = `staging`

### **Step 4: Test Error Tracking**

#### **Test Frontend Errors**
Create a test page or add a button:
```typescript
// Test error in any component
<button onClick={() => {
  throw new Error('Test Sentry Frontend Error');
}}>
  Test Error
</button>
```

#### **Test Backend Errors**
Add a test route or trigger an error:
```typescript
// In any API route
app.get('/api/test-error', (req, res) => {
  throw new Error('Test Sentry Backend Error');
});
```

Visit the endpoints and check your Sentry dashboard!

---

## 📊 **Sentry Dashboard Features**

### **Issues Tab**
- See all errors grouped by type
- Stack traces with source code context
- User impact metrics
- Error frequency and trends

### **Performance Tab**
- Transaction traces
- Slow API endpoints
- Database query performance
- Frontend page load times

### **Alerts**
Set up alerts for:
- New error types
- Error rate spikes
- Performance degradation
- Specific error patterns

---

## 🔧 **Configuration Details**

### **Sample Rates**
- **Traces**: 10% (0.1) - Captures 10% of transactions for performance monitoring
- **Replays**: 10% of sessions, 100% of error sessions
- **Development**: Errors logged to console, not sent to Sentry

### **Ignored Errors**
The following errors are automatically filtered:
- Browser extension errors
- Network errors (handled separately)
- ResizeObserver errors (harmless)
- Chrome/Firefox extension errors

### **Environment Filtering**
- **Development**: Errors logged but not sent (saves quota)
- **Production**: All errors sent to Sentry
- **Staging**: All errors sent to Sentry

---

## 💰 **Free Tier Limits**

**What You Get Free:**
- 5,000 errors/month
- 10,000 performance transactions/month
- 50 replays/month
- 90 days data retention
- Unlimited team members
- Basic integrations (Slack, GitHub, etc.)

**When to Upgrade:**
- If you exceed 5,000 errors/month
- If you need longer data retention
- If you need advanced features (custom alerts, etc.)

**Pricing:**
- Developer: $0/month (current)
- Team: $26/month (when you grow)
- Business: $80/month (for enterprise features)

---

## 🎯 **What Sentry Will Track**

### **Automatically Tracked:**
- ✅ Unhandled exceptions
- ✅ Promise rejections
- ✅ API errors (500, 404, etc.)
- ✅ Database errors
- ✅ Network failures
- ✅ Performance issues

### **Manually Track:**
```typescript
// Frontend
import * as Sentry from '@sentry/nextjs';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error);
}

// Backend
import * as Sentry from '@sentry/node';

Sentry.captureException(new Error('Custom error'));
Sentry.captureMessage('Important event happened');
```

---

## 🔗 **Integration with Existing Systems**

### **Works With:**
- ✅ Railway deployment (automatic error tracking)
- ✅ Vercel deployment (automatic error tracking)
- ✅ Your security dashboard (complementary)
- ✅ UptimeRobot (next step in Phase 2)

### **Complements:**
- Your existing threat detection (different purpose)
- Security audit logs (different data)
- Performance monitoring (New Relic alternative)

---

## 📋 **Next Steps After Setup**

1. **Set Up Alerts**
   - Email notifications for new errors
   - Slack integration for critical issues
   - Weekly digest emails

2. **Configure Integrations**
   - GitHub: Link errors to commits
   - Slack: Real-time error notifications
   - Jira: Create tickets from errors (if needed)

3. **Customize Error Grouping**
   - Set up custom fingerprints
   - Configure error grouping rules
   - Set up ignore rules for known issues

4. **Monitor Performance**
   - Identify slow API endpoints
   - Track frontend page load times
   - Monitor database query performance

---

## 🚨 **Troubleshooting**

### **Errors Not Appearing in Sentry**

**Check:**
1. DSN is correctly set in environment variables
2. Environment is not 'development' (errors are logged but not sent)
3. Error is not in the ignored list
4. Sentry quota not exceeded

**Debug:**
```bash
# Check if DSN is loaded
console.log('Sentry DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN);
console.log('Sentry DSN:', process.env.SENTRY_DSN);
```

### **Too Many Errors**

**Solutions:**
1. Add more errors to ignore list
2. Increase sample rate filtering
3. Fix the underlying issues causing errors
4. Upgrade to paid plan if needed

---

## ✅ **Verification Checklist**

After setup, verify:
- [ ] Sentry account created
- [ ] Two projects created (web + api)
- [ ] DSN copied for both projects
- [ ] Environment variables added locally
- [ ] Environment variables added to Railway
- [ ] Test error sent from frontend
- [ ] Test error sent from backend
- [ ] Errors visible in Sentry dashboard
- [ ] Alerts configured
- [ ] Team members invited (if applicable)

---

## 🎉 **You're Done!**

Sentry is now tracking errors across your entire platform. You'll get:
- Real-time error notifications
- Detailed stack traces
- User impact metrics
- Performance insights

**Next Phase 2 Step**: Set up UptimeRobot for uptime monitoring

---

## 📚 **Resources**

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
- [Sentry Pricing](https://sentry.io/pricing/)
