# Webhook Setup Guide

## Quick Start

This guide will help you set up Stripe webhooks for local development and production.

## Prerequisites

- Stripe account with test mode enabled
- API server running
- Database migration 006 applied

## Local Development Setup

### Step 1: Install Stripe CLI

**Windows (PowerShell):**
```powershell
scoop install stripe
```

**Mac:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download from https://github.com/stripe/stripe-cli/releases
```

### Step 2: Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate.

### Step 3: Run Database Migration

```bash
cd apps/api
psql -h aws-0-us-east-1.pooler.supabase.com -U postgres.nwqrjhqwmfxqfxfqnvxb -d postgres -f prisma/migrations/006_webhook_events_table.sql
```

### Step 4: Get Webhook Secret

```bash
stripe listen --print-secret
```

Copy the webhook secret (starts with `whsec_`).

### Step 5: Set Environment Variable

Add to your `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### Step 6: Start Webhook Forwarding

In a separate terminal:

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Keep this running while testing.

### Step 7: Test Webhooks

In another terminal:

```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# Test refund
stripe trigger charge.refunded
```

## Verify Webhook Processing

### Check Webhook Events Table

```sql
SELECT 
  id,
  event_type,
  processed,
  error_message,
  created_at,
  processed_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

### Check Payment Updates

```sql
SELECT 
  id,
  payment_status,
  gateway_transaction_id,
  updated_at
FROM payments
ORDER BY updated_at DESC
LIMIT 5;
```

### Check API Endpoint

```bash
curl http://localhost:4000/api/webhooks/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "webhooks": {
    "stripe": "active",
    "paypal": "not_implemented"
  }
}
```

## Production Setup

### Step 1: Configure Stripe Dashboard

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter webhook URL: `https://api.yourplatform.com/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.succeeded`
   - `charge.failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `refund.created`
   - `refund.updated`

5. Click "Add endpoint"
6. Copy the "Signing secret"

### Step 2: Set Production Environment Variable

```bash
# Production .env
STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
STRIPE_SECRET_KEY=sk_live_your_production_key
```

### Step 3: Test Production Webhook

Use Stripe Dashboard to send test events:

1. Go to Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select event type
4. Click "Send test webhook"

### Step 4: Monitor Webhooks

```bash
# Get recent webhook events
curl https://api.yourplatform.com/api/webhooks/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.events[] | {event_type, processed, created_at}'
```

## Testing Scenarios

### Scenario 1: Complete Payment Flow

```bash
# Terminal 1: Start API
pnpm dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Terminal 3: Create and pay for order
# 1. Create order
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tid-m8ijkrnk",
    "customer": {"email": "test@example.com", "name": "Test User"},
    "items": [{"sku": "TEST-001", "name": "Test", "quantity": 1, "unit_price_cents": 5000}]
  }'

# 2. Charge payment
curl -X POST http://localhost:4000/api/orders/ORDER_ID/payments/charge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": {"type": "card", "token": "pm_card_visa"},
    "gatewayType": "stripe"
  }'

# 3. Check webhook was received
# Look for "payment_intent.succeeded" in Terminal 2
# Check database
SELECT * FROM webhook_events WHERE event_type = 'payment_intent.succeeded' ORDER BY created_at DESC LIMIT 1;
```

### Scenario 2: Failed Payment

```bash
# Trigger failed payment
stripe trigger payment_intent.payment_failed

# Check payment status
SELECT id, payment_status, error_message FROM payments ORDER BY updated_at DESC LIMIT 1;
```

### Scenario 3: Refund Processing

```bash
# 1. Process refund via API
curl -X POST http://localhost:4000/api/payments/PAYMENT_ID/refund \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 2500, "reason": "requested_by_customer"}'

# 2. Check webhook received
# Look for "charge.refunded" event

# 3. Verify payment status
SELECT id, payment_status FROM payments WHERE id = 'PAYMENT_ID';
```

## Troubleshooting

### Webhook Not Received

**Problem:** Stripe CLI shows event sent, but not received by API

**Solutions:**
1. Check API is running: `curl http://localhost:4000/api/webhooks/health`
2. Verify port is correct: `stripe listen --forward-to localhost:4000/api/webhooks/stripe`
3. Check firewall settings
4. Review API logs for errors

### Signature Verification Failed

**Problem:** `signature_verification_failed` error

**Solutions:**
1. Verify webhook secret is correct
2. Check environment variable is loaded: `echo $STRIPE_WEBHOOK_SECRET`
3. Restart API server after changing .env
4. Ensure using raw body parser (already configured)

### Events Not Processing

**Problem:** Events received but not processed

**Solutions:**
1. Check webhook_events table:
   ```sql
   SELECT * FROM webhook_events WHERE processed = false;
   ```
2. Review error messages:
   ```sql
   SELECT event_type, error_message FROM webhook_events WHERE error_message IS NOT NULL;
   ```
3. Check API logs for processing errors
4. Verify payment/order records exist

### Database Connection Issues

**Problem:** Cannot insert webhook events

**Solutions:**
1. Verify migration 006 was applied
2. Check database connection
3. Verify table exists:
   ```sql
   \dt webhook_events
   ```

## Monitoring Commands

### Recent Webhook Activity

```sql
-- Last 10 webhooks
SELECT 
  event_type,
  processed,
  created_at,
  processed_at,
  EXTRACT(EPOCH FROM (processed_at - created_at)) as processing_seconds
FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

### Webhook Success Rate

```sql
-- Success rate last 24 hours
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN processed THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN processed THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Failed Events

```sql
-- Failed events with errors
SELECT 
  event_type,
  error_message,
  created_at
FROM webhook_events
WHERE processed = false 
  AND error_message IS NOT NULL
ORDER BY created_at DESC;
```

### Event Types Distribution

```sql
-- Most common events
SELECT 
  event_type,
  COUNT(*) as count
FROM webhook_events
GROUP BY event_type
ORDER BY count DESC;
```

## Best Practices

### 1. Always Use Webhook Secret

Never process webhooks without signature verification:
```typescript
// ✅ Good
const event = stripe.webhooks.constructEvent(body, signature, secret);

// ❌ Bad
const event = JSON.parse(body);
```

### 2. Return 200 Quickly

Process events asynchronously:
```typescript
// ✅ Good
res.status(200).json({ received: true });
setImmediate(() => processEvent(event));

// ❌ Bad
await processEvent(event);
res.status(200).json({ received: true });
```

### 3. Handle Idempotency

Events may be sent multiple times:
```sql
-- Use unique constraint on event_id
INSERT INTO webhook_events (event_id, ...)
ON CONFLICT (event_id) DO NOTHING;
```

### 4. Log Everything

Store all webhook events for debugging:
```typescript
await logWebhookEvent(event);
```

### 5. Monitor Failures

Set up alerts for failed webhooks:
```sql
-- Alert if >5% failure rate
SELECT 
  CASE 
    WHEN success_rate < 95 THEN 'ALERT'
    ELSE 'OK'
  END as status
FROM (
  SELECT 
    ROUND(100.0 * SUM(CASE WHEN processed THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
  FROM webhook_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
) stats;
```

## Next Steps

After webhooks are working:

1. ✅ Test all event types
2. ✅ Monitor webhook processing
3. ✅ Set up production webhooks
4. ✅ Configure alerting
5. ⏳ Implement email notifications
6. ⏳ Add webhook retry logic
7. ⏳ Create admin dashboard

---

**Need Help?**
- Check Stripe Dashboard webhook logs
- Review API server logs
- Check `webhook_events` table
- Test with Stripe CLI

**Status:** Ready for testing  
**Last Updated:** 2026-01-10
