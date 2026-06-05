# Monitoring Dashboard Integration

**Date**: December 24, 2025
**Status**: Implementation Guide
**Purpose**: Integrate UptimeRobot and Sentry data into admin dashboard

---

## 🎯 **Overview**

This guide shows how to integrate external monitoring data (UptimeRobot, Sentry) into your existing admin security dashboard for a unified monitoring experience.

---

## 📊 **Current Monitoring Stack**

### **Already Implemented**
- ✅ Security threat detection (automatic)
- ✅ Failed login tracking
- ✅ IP blocking system
- ✅ Security audit logs
- ✅ Admin security dashboard

### **New Additions (Phase 2)**
- ✅ Sentry error tracking (frontend + backend)
- ✅ UptimeRobot uptime monitoring
- 🔄 Unified monitoring dashboard (this guide)

---

## 🔗 **Integration Options**

### **Option 1: External Links (Simplest)**
Add quick links to external dashboards in your admin panel.

**Implementation:**
```typescript
// apps/web/src/components/security/monitoring/MonitoringLinks.tsx
export function MonitoringLinks() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Uptime Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Monitor service availability and response times
          </p>
          <a
            href="https://uptimerobot.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open UptimeRobot Dashboard
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Track and debug application errors
          </p>
          <a
            href="https://sentry.io/organizations/visible-shelf/issues/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open Sentry Dashboard
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Public Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            View public status page
          </p>
          <a
            href="https://stats.uptimerobot.com/your-custom-url"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            View Status Page
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
```

### **Option 2: API Integration (Advanced)**
Fetch data from UptimeRobot and Sentry APIs to display in your dashboard.

**UptimeRobot API:**
```typescript
// apps/api/src/services/uptime-monitoring.ts
import axios from 'axios';

export class UptimeMonitoringService {
  private apiKey: string;
  private baseUrl = 'https://api.uptimerobot.com/v2';

  constructor() {
    this.apiKey = process.env.UPTIMEROBOT_API_KEY || '';
  }

  async getMonitors() {
    try {
      const response = await axios.post(`${this.baseUrl}/getMonitors`, {
        api_key: this.apiKey,
        format: 'json',
        logs: 1
      });

      return response.data.monitors.map((monitor: any) => ({
        id: monitor.id,
        name: monitor.friendly_name,
        url: monitor.url,
        status: monitor.status, // 0=paused, 1=not checked, 2=up, 8=seems down, 9=down
        uptime: monitor.custom_uptime_ratio,
        responseTime: monitor.average_response_time,
        lastDown: monitor.logs?.[0]?.datetime
      }));
    } catch (error) {
      console.error('Failed to fetch UptimeRobot data:', error);
      return [];
    }
  }

  async getAlerts() {
    try {
      const response = await axios.post(`${this.baseUrl}/getAlertContacts`, {
        api_key: this.apiKey,
        format: 'json'
      });

      return response.data.alert_contacts;
    } catch (error) {
      console.error('Failed to fetch UptimeRobot alerts:', error);
      return [];
    }
  }
}
```

**Sentry API:**
```typescript
// apps/api/src/services/sentry-monitoring.ts
import axios from 'axios';

export class SentryMonitoringService {
  private authToken: string;
  private org: string;
  private project: string;
  private baseUrl = 'https://sentry.io/api/0';

  constructor() {
    this.authToken = process.env.SENTRY_AUTH_TOKEN || '';
    this.org = process.env.SENTRY_ORG || '';
    this.project = process.env.SENTRY_PROJECT || '';
  }

  async getRecentIssues(limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/projects/${this.org}/${this.project}/issues/`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`
          },
          params: {
            limit,
            query: 'is:unresolved'
          }
        }
      );

      return response.data.map((issue: any) => ({
        id: issue.id,
        title: issue.title,
        level: issue.level,
        count: issue.count,
        userCount: issue.userCount,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink
      }));
    } catch (error) {
      console.error('Failed to fetch Sentry issues:', error);
      return [];
    }
  }

  async getStats() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/organizations/${this.org}/stats_v2/`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`
          },
          params: {
            project: this.project,
            field: ['sum(quantity)'],
            category: 'error',
            interval: '1h',
            statsPeriod: '24h'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to fetch Sentry stats:', error);
      return null;
    }
  }
}
```

### **Option 3: Webhook Integration (Real-time)**
Receive real-time alerts from UptimeRobot and Sentry via webhooks.

**Webhook Endpoint:**
```typescript
// apps/api/src/routes/webhooks/monitoring.ts
import { Router } from 'express';
import { prisma } from '../../prisma';

const router = Router();

// UptimeRobot webhook
router.post('/uptime', async (req, res) => {
  const {
    monitorID,
    monitorFriendlyName,
    monitorURL,
    alertType,
    alertTypeFriendlyName,
    alertDetails,
    monitorAlertContacts
  } = req.body;

  // Log to database
  await prisma.monitoring_events.create({
    data: {
      source: 'uptimerobot',
      event_type: alertType === '1' ? 'down' : 'up',
      monitor_name: monitorFriendlyName,
      monitor_url: monitorURL,
      details: alertDetails,
      timestamp: new Date()
    }
  });

  // Send notification (Slack, email, etc.)
  // await notificationService.send({
  //   title: `${monitorFriendlyName} is ${alertTypeFriendlyName}`,
  //   message: alertDetails
  // });

  res.json({ received: true });
});

// Sentry webhook
router.post('/sentry', async (req, res) => {
  const { action, data } = req.body;

  if (action === 'issue.created' || action === 'issue.alert') {
    const issue = data.issue;

    // Log to database
    await prisma.monitoring_events.create({
      data: {
        source: 'sentry',
        event_type: action,
        monitor_name: issue.title,
        monitor_url: issue.permalink,
        details: JSON.stringify({
          level: issue.level,
          count: issue.count,
          userCount: issue.userCount
        }),
        timestamp: new Date()
      }
    });

    // Send notification for critical errors
    if (issue.level === 'error' || issue.level === 'fatal') {
      // await notificationService.send({
      //   title: `Critical Error: ${issue.title}`,
      //   message: `Affected ${issue.userCount} users`
      // });
    }
  }

  res.json({ received: true });
});

export default router;
```

---

## 🎨 **Unified Dashboard Component**

```typescript
// apps/web/src/components/admin/UnifiedMonitoringDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface MonitoringData {
  uptime: {
    status: 'up' | 'down' | 'degraded';
    percentage: number;
    monitors: Array<{
      name: string;
      status: number;
      uptime: string;
    }>;
  };
  errors: {
    total: number;
    unresolved: number;
    recentIssues: Array<{
      title: string;
      count: number;
      level: string;
    }>;
  };
  security: {
    threats: number;
    blockedIPs: number;
    failedLogins: number;
  };
}

export function UnifiedMonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/monitoring/unified');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch monitoring data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading monitoring data...</div>;
  }

  if (!data) {
    return <div>Failed to load monitoring data</div>;
  }

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            {data.uptime.status === 'up' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.uptime.percentage}%</div>
            <p className="text-xs text-muted-foreground">
              {data.uptime.monitors.length} monitors active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.errors.unresolved}</div>
            <p className="text-xs text-muted-foreground">
              {data.errors.total} total errors (24h)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Threats</CardTitle>
            <Activity className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.security.threats}</div>
            <p className="text-xs text-muted-foreground">
              {data.security.blockedIPs} IPs blocked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uptime Monitors */}
        <Card>
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.uptime.monitors.map((monitor) => (
                <div key={monitor.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {monitor.status === 2 ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">{monitor.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {monitor.uptime}% uptime
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.errors.recentIssues.map((issue, index) => (
                <div key={index} className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{issue.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {issue.count} occurrences
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    issue.level === 'error' ? 'bg-red-100 text-red-800' :
                    issue.level === 'warning' ? 'bg-amber-100 text-amber-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {issue.level}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 📋 **Implementation Checklist**

### **Phase 1: Basic Integration (Week 5)**
- [ ] Add external monitoring links to admin dashboard
- [ ] Create monitoring links component
- [ ] Test links to UptimeRobot and Sentry
- [ ] Document monitoring access for team

### **Phase 2: API Integration (Week 6 - Optional)**
- [ ] Get UptimeRobot API key
- [ ] Get Sentry auth token
- [ ] Create monitoring service classes
- [ ] Build unified monitoring API endpoint
- [ ] Create unified dashboard component

### **Phase 3: Webhook Integration (Week 7 - Optional)**
- [ ] Create webhook endpoints
- [ ] Configure UptimeRobot webhooks
- [ ] Configure Sentry webhooks
- [ ] Set up notification system
- [ ] Test real-time alerts

---

## 🎯 **Recommended Approach for Early Stage**

**Start with Option 1 (External Links):**
- Simplest to implement (5 minutes)
- Zero maintenance overhead
- Full feature access
- Perfect for early stage

**Upgrade to Option 2 when:**
- You have 100+ daily users
- You want unified dashboard
- You have development resources
- You need custom metrics

**Add Option 3 when:**
- You need real-time alerts
- You have incident response team
- You want automated workflows
- You have 1000+ daily users

---

## 💡 **Best Practices**

1. **Start Simple**: External links are sufficient for early stage
2. **Monitor What Matters**: Don't over-monitor, focus on critical paths
3. **Set Up Alerts**: Email + Slack for critical issues
4. **Review Weekly**: Check trends and patterns
5. **Document Incidents**: Use monitoring data for post-mortems
6. **Share Status**: Public status page builds user trust

---

## 🔜 **Next Steps**

1. Complete UptimeRobot setup (5 minutes)
2. Add monitoring links to admin dashboard (5 minutes)
3. Test all monitoring systems
4. Move to Week 5 Day 3-4: Deployment procedures

