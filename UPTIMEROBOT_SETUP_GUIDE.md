# UptimeRobot Monitoring Setup Guide

**Date**: December 24, 2025
**Status**: Ready for Setup
**Cost**: $0 (Free tier: 50 monitors, 5-minute checks)

---

## 🎯 **What is UptimeRobot?**

UptimeRobot is an uptime monitoring service that helps you:
- Monitor website and API availability 24/7
- Get instant alerts when services go down
- Track uptime percentage and response times
- Create public status pages for users
- Monitor SSL certificate expiration

---

## 🆓 **Free Tier Benefits**

**What You Get Free:**
- 50 monitors (plenty for early stage)
- 5-minute check intervals
- Unlimited alerts (email, SMS, webhook, Slack, etc.)
- 2-month log retention
- Public status pages
- SSL certificate monitoring
- Response time tracking

**When to Upgrade:**
- If you need 1-minute check intervals ($7/month)
- If you need more than 50 monitors
- If you need advanced features (maintenance windows, etc.)

---

## ✅ **What We'll Monitor**

### **Critical Services (6 monitors)**

**Production Environment:**
1. **Frontend (Production)** - https://visibleshelf.com
2. **API (Production)** - https://api.visibleshelf.com/health
3. **Database Health (Production)** - https://api.visibleshelf.com/health/db

**Staging Environment:**
4. **Frontend (Staging)** - https://visibleshelf.store
5. **API (Staging)** - https://aps.visibleshelf.store/health
6. **Database Health (Staging)** - https://aps.visibleshelf.store/health/db

### **Additional Monitors (Optional)**
- SSL certificate expiration monitoring
- Specific API endpoints (auth, items, etc.)
- Admin dashboard availability
- Public storefront pages

---

## 🚀 **Setup Steps**

### **Step 1: Create UptimeRobot Account (Free)**

1. Go to https://uptimerobot.com/signUp
2. Sign up with email (no credit card required)
3. Verify your email address
4. You're ready to create monitors!

### **Step 2: Create Monitors**

#### **Monitor 1: PRODUCTION - Frontend**
1. Click "Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: PROD - Visible Shelf Frontend
4. **URL**: `https://visibleshelf.com`
5. **Monitoring Interval**: 5 minutes (free tier)
6. **Monitor Timeout**: 30 seconds
7. **Alert Contacts**: Add your email
8. Click "Create Monitor"

#### **Monitor 2: PRODUCTION - API**
1. Click "Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: PROD - Visible Shelf API
4. **URL**: `https://api.visibleshelf.com/health`
5. **Monitoring Interval**: 5 minutes
6. **Monitor Timeout**: 30 seconds
7. **Alert Contacts**: Add your email
8. Click "Create Monitor"

> **Note**: Keyword monitoring requires Pro plan. Free tier monitors HTTP status codes only (200 OK).

#### **Monitor 3: PRODUCTION - Database Health**
1. Click "Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: PROD - Database Health
4. **URL**: `https://api.visibleshelf.com/health/db`
5. **Monitoring Interval**: 5 minutes
6. **Monitor Timeout**: 30 seconds
7. **Alert Contacts**: Add your email
8. Click "Create Monitor"

> **Note**: Keyword monitoring requires Pro plan. Free tier monitors HTTP status codes only (200 OK).

#### **Monitor 4: STAGING - Frontend**
1. Click "Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: STAGING - Visible Shelf Frontend
4. **URL**: `https://visibleshelf.store`
5. **Monitoring Interval**: 5 minutes
6. **Monitor Timeout**: 30 seconds
7. **Alert Contacts**: Add your email
8. Click "Create Monitor"

#### **Monitor 5: STAGING - API**
1. Click "Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: STAGING - Visible Shelf API
4. **URL**: `https://aps.visibleshelf.store/health`
5. **Monitoring Interval**: 5 minutes
6. **Monitor Timeout**: 30 seconds
7. **Alert Contacts**: Add your email
8. Click "Create Monitor"

> **Note**: Keyword monitoring requires Pro plan. Free tier monitors HTTP status codes only (200 OK).

#### **Monitor 6: STAGING - Database Health**
1. Click "Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: STAGING - Database Health
4. **URL**: `https://aps.visibleshelf.store/health/db`
5. **Monitoring Interval**: 5 minutes
6. **Monitor Timeout**: 30 seconds
7. **Alert Contacts**: Add your email
8. Click "Create Monitor"

> **Note**: Keyword monitoring requires Pro plan. Free tier monitors HTTP status codes only (200 OK).

### **Step 3: Configure Alert Contacts**

#### **Email Alerts (Default)**
- Already configured with your signup email
- Receives alerts immediately when service goes down
- Receives "back up" notification when service recovers

#### **Add Slack Integration (Recommended)**
1. Go to "My Settings" → "Alert Contacts"
2. Click "Add Alert Contact"
3. Select "Slack"
4. Follow instructions to connect your Slack workspace
5. Choose channel (e.g., #alerts, #monitoring)
6. Save and assign to monitors

#### **Add SMS Alerts (Optional - Paid)**
1. Go to "My Settings" → "Alert Contacts"
2. Click "Add Alert Contact"
3. Select "SMS"
4. Enter phone number
5. Verify phone number
6. Assign to critical monitors only (to avoid spam)

### **Step 4: Create Public Status Page**

1. Go to "Status Pages" in sidebar
2. Click "Add New Status Page"
3. **Page Name**: Visible Shelf Status
4. **Custom URL**: `visibleshelf` (becomes uptimerobot.com/visibleshelf)
5. **Monitors to Show**: Select all production monitors
6. **Custom Domain** (Optional): status.visibleshelf.com
7. **Design**: Choose theme and colors
8. Click "Create Status Page"

**Share with users**: https://stats.uptimerobot.com/your-custom-url

---

## 🔧 **Advanced Configuration**

### **SSL Certificate Monitoring**

1. Create new monitor
2. **Monitor Type**: HTTP(s)
3. **URL**: Your production domain
4. **SSL Certificate Expiration**: Enable
5. **Alert Days Before**: 30 days (default)
6. This will alert you before SSL expires

### **Maintenance Windows**

Set up maintenance windows to prevent false alerts during deployments:

1. Go to "Maintenance Windows"
2. Click "Add New Maintenance Window"
3. **Type**: One-time or Recurring
4. **Duration**: 30 minutes (typical deployment time)
5. **Monitors**: Select all monitors
6. Schedule before planned deployments

### **Custom HTTP Headers**

For authenticated endpoints:

1. Edit monitor
2. Scroll to "Advanced Settings"
3. Add custom headers:
   ```
   Authorization: Bearer your-monitoring-token
   ```
4. Save monitor

---

## 📊 **Understanding UptimeRobot Dashboard**

### **Monitor Status Colors**
- 🟢 **Green (Up)**: Service is responding normally
- 🔴 **Red (Down)**: Service is not responding
- 🟡 **Yellow (Paused)**: Monitor is paused (maintenance)
- ⚫ **Gray (Not Checked Yet)**: New monitor, first check pending

### **Key Metrics**
- **Uptime %**: Percentage of time service was available
- **Response Time**: Average response time in milliseconds
- **Down Events**: Number of times service went down
- **Last Down**: When service last went down

### **Response Time Tracking**
- View response time graphs
- Identify performance degradation
- Compare response times across services

---

## 🚨 **Alert Configuration Best Practices**

### **Alert Thresholds**
- **Down for**: 2 minutes (default) - Wait for 2 failed checks before alerting
- **Reason**: Prevents false positives from temporary network issues

### **Alert Channels Priority**
1. **Critical (Production)**: Email + Slack + SMS (if paid)
2. **Important (Staging)**: Email + Slack
3. **Monitoring (SSL, etc.)**: Email only

### **Alert Fatigue Prevention**
- Don't alert on every single endpoint
- Group related services
- Use maintenance windows during deployments
- Set appropriate down thresholds (2-5 minutes)

---

## 🔗 **Integration with Existing Systems**

### **Works With:**
- ✅ Sentry (error tracking) - Complementary
- ✅ Railway deployment - Monitors Railway services
- ✅ Vercel deployment - Monitors Vercel frontend
- ✅ Your security dashboard - Different purpose

### **Webhook Integration (Advanced)**

Send downtime alerts to your own API:

1. Create webhook endpoint in your API:
   ```typescript
   app.post('/api/webhooks/uptime', (req, res) => {
     const { monitorFriendlyName, alertType, monitorURL } = req.body;
     
     // Log to database
     // Send to Slack
     // Create incident ticket
     
     res.json({ received: true });
   });
   ```

2. Add webhook as alert contact in UptimeRobot
3. Assign to monitors

---

## 📋 **Health Check Endpoint Requirements**

Your API should have a health check endpoint that returns:

```typescript
// apps/api/src/routes/health.ts
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'ok',
      healthy: true,
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      healthy: false,
      database: 'disconnected',
      error: error.message
    });
  }
});
```

**Key Requirements:**
- Returns 200 status code when healthy
- Returns 503 status code when unhealthy
- Includes keyword for monitoring (e.g., `"status":"ok"`)
- Checks critical dependencies (database, cache, etc.)

---

## 🎯 **Monitoring Strategy**

### **What to Monitor**
✅ **Do Monitor:**
- Production frontend (user-facing)
- Production API health endpoint
- Database connectivity (via API)
- SSL certificate expiration
- Critical API endpoints (auth, payments)

❌ **Don't Monitor:**
- Every single API endpoint (too many alerts)
- Development/local environments
- Internal admin tools (unless critical)
- Non-critical features

### **Check Intervals**
- **Production**: 5 minutes (free tier)
- **Staging**: 5 minutes (free tier)
- **SSL Certificates**: Daily (built-in)

---

## 📈 **Using UptimeRobot Data**

### **Weekly Review**
- Check uptime percentages (target: >99.5%)
- Review response time trends
- Identify slow endpoints
- Plan performance improvements

### **Monthly Reports**
- Generate uptime reports
- Share with stakeholders
- Track improvement over time
- Justify infrastructure investments

### **Incident Response**
1. Receive alert (email/Slack)
2. Check UptimeRobot dashboard for details
3. Check Sentry for related errors
4. Investigate and fix issue
5. Verify service recovery
6. Document incident

---

## ✅ **Setup Verification Checklist**

After setup, verify:
- [ ] UptimeRobot account created
- [ ] Production frontend monitor created
- [ ] Production API monitor created
- [ ] Database health monitor created
- [ ] Staging monitors created (if applicable)
- [ ] Email alerts configured
- [ ] Slack integration added (optional)
- [ ] Public status page created
- [ ] SSL certificate monitoring enabled
- [ ] Test alert received (pause/unpause monitor)
- [ ] Health check endpoint working
- [ ] Keyword monitoring working
- [ ] Response time tracking active

---

## 🧪 **Testing Your Monitors**

### **Test Downtime Alerts**
1. Pause a monitor manually
2. Wait 2 minutes
3. Check if you receive alert
4. Unpause monitor
5. Check if you receive "back up" notification

### **Test Health Check**
```bash
# Test your health endpoint
curl https://api.visibleshelf.com/health

# Should return:
{
  "status": "ok",
  "healthy": true,
  "database": "connected"
}
```

### **Test Keyword Monitoring**
1. Temporarily change health endpoint response
2. Remove the keyword (e.g., `"status":"ok"`)
3. Wait for UptimeRobot to detect
4. Should receive alert
5. Restore keyword
6. Should receive "back up" notification

---

## 🚨 **Common Issues & Solutions**

### **False Positive Alerts**

**Problem**: Getting alerts but service is actually up

**Solutions:**
1. Increase "Down for" threshold to 5 minutes
2. Check if firewall is blocking UptimeRobot IPs
3. Verify health endpoint is stable
4. Check for intermittent network issues

### **No Alerts Received**

**Problem**: Service went down but no alert

**Solutions:**
1. Verify email address in alert contacts
2. Check spam folder
3. Verify monitor is not paused
4. Check alert contact is assigned to monitor

### **Keyword Not Found**

**Problem**: Monitor shows down due to keyword not found

**Solutions:**
1. Verify exact keyword in health endpoint response
2. Check for extra spaces or quotes
3. Use simpler keyword (e.g., just `ok` instead of `"status":"ok"`)
4. Test endpoint manually with curl

---

## 💡 **Pro Tips**

1. **Use Descriptive Names**: "Visible Shelf - API (Production)" is better than "API"
2. **Group by Environment**: Prefix with "PROD -" or "STAGING -"
3. **Set Up Status Page Early**: Users appreciate transparency
4. **Monitor SSL Early**: Don't wait until last minute
5. **Use Maintenance Windows**: Prevent false alerts during deployments
6. **Review Weekly**: Check response times and uptime trends
7. **Document Incidents**: Use UptimeRobot logs for post-mortems

---

## 🎉 **You're Done!**

UptimeRobot is now monitoring your platform 24/7. You'll get:
- Instant alerts when services go down
- Uptime percentage tracking
- Response time monitoring
- Public status page for users
- SSL certificate expiration alerts

**Free tier is perfect for early stage** - upgrade only when you need faster checks or more monitors.

---

## 📚 **Resources**

- [UptimeRobot Documentation](https://uptimerobot.com/help/)
- [API Documentation](https://uptimerobot.com/api/)
- [Status Page Examples](https://uptimerobot.com/blog/status-page-examples/)
- [Best Practices](https://uptimerobot.com/blog/website-monitoring-best-practices/)

---

## 🔜 **Next Steps**

**Week 5 Day 3-4**: Create deployment procedures and rollback documentation
