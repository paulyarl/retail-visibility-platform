# UptimeRobot Quick Setup - Visible Shelf

**Copy-paste ready configuration for all 6 monitors**

---

## 📋 **Monitor Configuration**

### **PRODUCTION Environment**

#### **Monitor 1: PROD - Visible Shelf Frontend**
```
Monitor Type: HTTP(s)
Friendly Name: PROD - Visible Shelf Frontend
URL: https://visibleshelf.com
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```

#### **Monitor 2: PROD - Visible Shelf API**
```
Monitor Type: HTTP(s)
Friendly Name: PROD - Visible Shelf API
URL: https://api.visibleshelf.com/health
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```
> **Note**: Keyword monitoring requires Pro plan ($7/month). Free tier checks HTTP 200 OK status.

#### **Monitor 3: PROD - Database Health**
```
Monitor Type: HTTP(s)
Friendly Name: PROD - Database Health
URL: https://api.visibleshelf.com/health/db
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```
> **Note**: Keyword monitoring requires Pro plan ($7/month). Free tier checks HTTP 200 OK status.

---

### **STAGING Environment**

#### **Monitor 4: STAGING - Visible Shelf Frontend**
```
Monitor Type: HTTP(s)
Friendly Name: STAGING - Visible Shelf Frontend
URL: https://visibleshelf.store
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```

#### **Monitor 5: STAGING - Visible Shelf API**
```
Monitor Type: HTTP(s)
Friendly Name: STAGING - Visible Shelf API
URL: https://aps.visibleshelf.store/health
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```
> **Note**: Keyword monitoring requires Pro plan ($7/month). Free tier checks HTTP 200 OK status.

#### **Monitor 6: STAGING - Database Health**
```
Monitor Type: HTTP(s)
Friendly Name: STAGING - Database Health
URL: https://aps.visibleshelf.store/health/db
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```
> **Note**: Keyword monitoring requires Pro plan ($7/month). Free tier checks HTTP 200 OK status.

---

## ✅ **Setup Checklist**

- [ ] Create UptimeRobot account (https://uptimerobot.com/signUp)
- [ ] Create Monitor 1: PROD Frontend
- [ ] Create Monitor 2: PROD API
- [ ] Create Monitor 3: PROD Database
- [ ] Create Monitor 4: STAGING Frontend
- [ ] Create Monitor 5: STAGING API
- [ ] Create Monitor 6: STAGING Database
- [ ] Add email alert contact
- [ ] Add Slack integration (optional)
- [ ] Create public status page
- [ ] Test monitors (all should show green/up)

---

## 🧪 **Test Your Monitors**

After setup, verify all endpoints are responding:

```bash
# Production
curl https://visibleshelf.com
curl https://api.visibleshelf.com/health
curl https://api.visibleshelf.com/health/db

# Staging
curl https://visibleshelf.store
curl https://aps.visibleshelf.store/health
curl https://aps.visibleshelf.store/health/db
```

**Expected responses:**
- Frontend: HTML page (200 OK)
- API health: `{"status":"ok","healthy":true,...}`
- Database health: `{"status":"ok","database":"connected",...}`

---

## 🎯 **Status Page Configuration**

**Recommended settings:**
- **Page Name**: Visible Shelf Status
- **Custom URL**: visibleshelf
- **Monitors to Show**: All 3 production monitors (hide staging)
- **Show Response Times**: Yes
- **Show Uptime**: Yes (30 days)

**Public URL**: https://stats.uptimerobot.com/visibleshelf

---

## 📊 **Expected Results**

After 5 minutes, you should see:
- ✅ All 6 monitors showing "Up" (green)
- ✅ Response times displayed (typically 100-500ms)
- ✅ Uptime percentage: 100%
- ✅ No alerts triggered

If any monitor shows "Down":
1. Check the URL manually in browser
2. Verify keyword exists in response
3. Check firewall/CORS settings
4. Review UptimeRobot logs for details

---

## 🚨 **Alert Priority**

**Critical (Immediate action):**
- PROD Frontend down
- PROD API down
- PROD Database disconnected

**Important (Review within 30 min):**
- STAGING Frontend down
- STAGING API down
- STAGING Database disconnected

**Monitoring (Review daily):**
- Response time degradation
- Uptime percentage drops

---

## 💡 **Pro Tips**

1. **Naming Convention**: Use PROD/STAGING prefix for easy filtering
2. **Alert Threshold**: Set "Down for 2 minutes" to avoid false positives
3. **Maintenance Windows**: Schedule before deployments
4. **Status Page**: Only show production monitors publicly
5. **Slack Alerts**: Create #monitoring channel for all alerts
6. **Weekly Review**: Check response time trends every Monday

---

## 🔜 **Next Steps**

After UptimeRobot is set up:
1. ✅ Verify all monitors are green
2. ✅ Test alert by pausing a monitor
3. ✅ Share status page URL with team
4. ✅ Add Slack integration
5. ✅ Move to Week 5 Day 3-4: Deployment procedures

---

**Setup time**: ~10 minutes
**Cost**: $0 (free tier)
**Monitoring coverage**: 100% of critical services
