# Monitoring & Alerting Guide - Payment Processing System

## Overview

This guide covers monitoring, alerting, and observability for the payment processing system in production.

## Monitoring Stack

### Recommended Tools

1. **Application Performance Monitoring (APM)**
   - New Relic (already integrated)
   - Sentry (already integrated for errors)
   - DataDog (alternative)

2. **Database Monitoring**
   - Supabase Dashboard (built-in)
   - pgAdmin
   - Custom SQL queries

3. **Log Aggregation**
   - Railway Logs (built-in)
   - Papertrail
   - Logtail

4. **Uptime Monitoring**
   - UptimeRobot
   - Pingdom
   - Better Uptime

## Key Metrics to Monitor

### 1. Payment Metrics

#### Payment Success Rate

```sql
-- Real-time success rate (last hour)
SELECT 
  COUNT(*) as total_payments,
  SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending,
  ROUND(100.0 * SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as success_rate_pct
FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Alert Threshold:** Success rate < 95%

#### Payment Volume

```sql
-- Payments per hour (last 24 hours)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as payment_count,
  SUM(total_amount_cents) / 100.0 as total_amount,
  SUM(platform_fee_cents) / 100.0 as platform_revenue
FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

**Alert Threshold:** Volume drops > 50% compared to same hour yesterday

#### Average Transaction Value

```sql
-- Average transaction value by day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as transactions,
  AVG(total_amount_cents) / 100.0 as avg_transaction,
  MIN(total_amount_cents) / 100.0 as min_transaction,
  MAX(total_amount_cents) / 100.0 as max_transaction
FROM payments
WHERE payment_status = 'paid'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 2. Webhook Metrics

#### Webhook Processing Health

```sql
-- Webhook processing status (last hour)
SELECT 
  event_type,
  COUNT(*) as total,
  SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed,
  SUM(CASE WHEN NOT processed THEN 1 ELSE 0 END) as unprocessed,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN processed THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as success_rate
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY total DESC;
```

**Alert Threshold:** 
- Unprocessed webhooks > 5 in 1 hour
- Error rate > 5%

#### Webhook Latency

```sql
-- Average processing time
SELECT 
  event_type,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_seconds,
  MAX(EXTRACT(EPOCH FROM (processed_at - created_at))) as max_processing_seconds
FROM webhook_events
WHERE processed = true
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY avg_processing_seconds DESC;
```

**Alert Threshold:** Average processing time > 5 seconds

#### Failed Webhooks

```sql
-- Recent failed webhooks
SELECT 
  event_id,
  event_type,
  error_message,
  created_at,
  processed_at
FROM webhook_events
WHERE processed = false
  AND error_message IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Alert Threshold:** Any failed webhook (immediate notification)

### 3. Revenue Metrics

#### Platform Fee Revenue

```sql
-- Daily platform revenue
SELECT 
  DATE(created_at) as date,
  COUNT(*) as transactions,
  SUM(total_amount_cents) / 100.0 as gross_revenue,
  SUM(platform_fee_cents) / 100.0 as platform_revenue,
  SUM(gateway_fee_cents) / 100.0 as gateway_fees,
  SUM(net_amount_cents) / 100.0 as merchant_revenue,
  ROUND(100.0 * SUM(platform_fee_cents) / NULLIF(SUM(total_amount_cents), 0), 2) as platform_fee_pct
FROM payments
WHERE payment_status = 'paid'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Revenue by Tenant

```sql
-- Top revenue generating tenants (last 30 days)
SELECT 
  p.tenant_id,
  t.name as tenant_name,
  COUNT(*) as transactions,
  SUM(p.total_amount_cents) / 100.0 as total_revenue,
  SUM(p.platform_fee_cents) / 100.0 as platform_fees,
  AVG(p.total_amount_cents) / 100.0 as avg_transaction
FROM payments p
JOIN tenants t ON p.tenant_id = t.id
WHERE p.payment_status = 'paid'
  AND p.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.tenant_id, t.name
ORDER BY total_revenue DESC
LIMIT 20;
```

### 4. Error Metrics

#### Payment Failures by Reason

```sql
-- Payment failure reasons
SELECT 
  gateway_response->>'error_code' as error_code,
  gateway_response->>'error_message' as error_message,
  COUNT(*) as occurrences,
  MAX(created_at) as last_occurrence
FROM payments
WHERE payment_status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY gateway_response->>'error_code', gateway_response->>'error_message'
ORDER BY occurrences DESC
LIMIT 20;
```

**Alert Threshold:** New error code appears or error count spikes

#### Refund Rate

```sql
-- Refund rate by day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_refunds,
  SUM(refund_amount_cents) / 100.0 as total_refunded,
  COUNT(DISTINCT order_id) as orders_refunded
FROM payments
WHERE refund_status = 'refunded'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Alert Threshold:** Refund rate > 5% of daily transactions

#### Dispute Rate

```sql
-- Disputes tracking
SELECT 
  DATE(created_at) as date,
  COUNT(*) as disputes,
  SUM(total_amount_cents) / 100.0 as disputed_amount
FROM payments
WHERE dispute_status IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Alert Threshold:** Any new dispute (immediate notification)

### 5. Performance Metrics

#### API Response Times

```sql
-- Slow payment operations (if you're logging response times)
-- This would come from your APM tool (New Relic/Sentry)
```

Monitor in New Relic:
- `/api/payments/authorize` - Target: < 2s
- `/api/payments/capture` - Target: < 2s
- `/api/payments/charge` - Target: < 2s
- `/api/webhooks/stripe` - Target: < 1s

#### Database Query Performance

```sql
-- Slow queries (PostgreSQL)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%payments%'
  OR query LIKE '%webhook_events%'
ORDER BY mean_time DESC
LIMIT 20;
```

**Alert Threshold:** Query time > 1 second

## Alert Configuration

### Critical Alerts (Immediate Notification)

1. **Payment Gateway Down**
   - Condition: All payments failing for > 5 minutes
   - Action: Page on-call engineer
   - Channels: SMS, Phone, Slack

2. **Webhook Processing Stopped**
   - Condition: No webhooks processed in 10 minutes
   - Action: Page on-call engineer
   - Channels: SMS, Phone, Slack

3. **Database Connection Lost**
   - Condition: Database unreachable
   - Action: Page on-call engineer
   - Channels: SMS, Phone, Slack

4. **Dispute Created**
   - Condition: New dispute detected
   - Action: Notify finance team
   - Channels: Email, Slack

### High Priority Alerts (15-minute response)

1. **High Failure Rate**
   - Condition: Payment success rate < 95%
   - Action: Investigate immediately
   - Channels: Slack, Email

2. **Webhook Errors Spiking**
   - Condition: > 5 webhook errors in 1 hour
   - Action: Check logs and investigate
   - Channels: Slack, Email

3. **API Response Time Degraded**
   - Condition: P95 response time > 3 seconds
   - Action: Check database and API performance
   - Channels: Slack

### Medium Priority Alerts (1-hour response)

1. **Unusual Refund Rate**
   - Condition: Refund rate > 5% of daily transactions
   - Action: Review refund reasons
   - Channels: Email, Slack

2. **Revenue Drop**
   - Condition: Revenue < 50% of same day last week
   - Action: Investigate cause
   - Channels: Email

### Low Priority Alerts (Daily digest)

1. **Failed Payment Summary**
   - Condition: Daily summary of failed payments
   - Action: Review and categorize
   - Channels: Email

2. **Platform Fee Revenue Report**
   - Condition: Daily revenue summary
   - Action: Review metrics
   - Channels: Email

## Dashboard Setup

### Recommended Dashboards

#### 1. Payment Operations Dashboard

**Metrics:**
- Total payments (24h)
- Success rate (24h)
- Total revenue (24h)
- Platform fees (24h)
- Active payment methods
- Payment volume by hour
- Top tenants by volume

#### 2. Webhook Health Dashboard

**Metrics:**
- Webhooks received (24h)
- Processing success rate
- Average processing time
- Failed webhooks
- Events by type
- Processing latency chart

#### 3. Revenue Dashboard

**Metrics:**
- Daily revenue trend (30 days)
- Platform fee revenue
- Revenue by tenant
- Average transaction value
- Revenue by payment method
- Refund rate

#### 4. Error Tracking Dashboard

**Metrics:**
- Failed payments by error code
- Webhook errors
- API error rate
- Database errors
- Dispute tracking

## Monitoring Queries for Automation

### Health Check Endpoint

Add to your API:

```typescript
// src/routes/monitoring.ts
import express from 'express';
import { prisma } from '../prisma';

const router = express.Router();

router.get('/health/payments', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Check recent payment success rate
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as successful
      FROM payments
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `;
    
    const successRate = stats[0].total > 0 
      ? (stats[0].successful / stats[0].total) * 100 
      : 100;
    
    // Check webhook processing
    const webhookStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed
      FROM webhook_events
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `;
    
    const webhookSuccessRate = webhookStats[0].total > 0
      ? (webhookStats[0].processed / webhookStats[0].total) * 100
      : 100;
    
    const healthy = successRate >= 95 && webhookSuccessRate >= 95;
    
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      payments: {
        total: stats[0].total,
        successRate: successRate.toFixed(2) + '%',
      },
      webhooks: {
        total: webhookStats[0].total,
        successRate: webhookSuccessRate.toFixed(2) + '%',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
```

### Automated Monitoring Script

```bash
#!/bin/bash
# monitoring/check-payment-health.sh

# Configuration
API_URL="https://api.yourplatform.com"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
ALERT_THRESHOLD=95

# Check payment health
RESPONSE=$(curl -s "$API_URL/health/payments")
SUCCESS_RATE=$(echo $RESPONSE | jq -r '.payments.successRate' | sed 's/%//')

# Alert if below threshold
if (( $(echo "$SUCCESS_RATE < $ALERT_THRESHOLD" | bc -l) )); then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{
      \"text\": \"⚠️ Payment Success Rate Alert\",
      \"attachments\": [{
        \"color\": \"danger\",
        \"fields\": [{
          \"title\": \"Success Rate\",
          \"value\": \"$SUCCESS_RATE%\",
          \"short\": true
        }, {
          \"title\": \"Threshold\",
          \"value\": \"$ALERT_THRESHOLD%\",
          \"short\": true
        }]
      }]
    }"
fi
```

## Log Analysis

### Important Log Patterns

#### Payment Failures

```bash
# Search for payment failures
grep "Payment.*failed" /var/log/api.log | tail -50

# Count failures by error code
grep "Payment.*failed" /var/log/api.log | \
  grep -oP 'error_code: \K[^,]+' | \
  sort | uniq -c | sort -rn
```

#### Webhook Issues

```bash
# Search for webhook errors
grep "Webhook.*Error" /var/log/api.log | tail -50

# Count webhook errors by type
grep "Webhook.*Error" /var/log/api.log | \
  grep -oP 'event_type: \K[^,]+' | \
  sort | uniq -c | sort -rn
```

## Incident Response

### Payment System Down

1. **Immediate Actions:**
   - Check API health endpoint
   - Verify database connectivity
   - Check Stripe status page
   - Review recent deployments

2. **Investigation:**
   - Check error logs
   - Review recent code changes
   - Test payment flow manually
   - Check external dependencies

3. **Resolution:**
   - Rollback if recent deployment
   - Fix identified issue
   - Deploy fix
   - Verify system recovery

4. **Post-Incident:**
   - Document root cause
   - Update monitoring
   - Improve alerting
   - Conduct retrospective

### High Webhook Failure Rate

1. **Check webhook logs**
2. **Verify Stripe webhook secret**
3. **Test webhook endpoint manually**
4. **Check for signature verification issues**
5. **Review recent code changes**

## Maintenance Windows

Schedule regular maintenance:

- **Daily:** Review error logs and metrics
- **Weekly:** Analyze performance trends
- **Monthly:** Review and optimize queries
- **Quarterly:** Capacity planning review

---

## Monitoring Checklist

- [ ] APM tool configured (New Relic/Sentry)
- [ ] Database monitoring enabled
- [ ] Log aggregation setup
- [ ] Uptime monitoring configured
- [ ] Critical alerts configured
- [ ] Dashboards created
- [ ] Health check endpoints deployed
- [ ] Automated monitoring scripts running
- [ ] Incident response plan documented
- [ ] On-call rotation established

**Last Updated:** 2026-01-10  
**Version:** Phase 3B Week 2 Day 4  
**Status:** Production Ready
