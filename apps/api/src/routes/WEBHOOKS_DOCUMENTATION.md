# Webhook Documentation

## Overview

Webhooks allow Stripe to notify your application about payment events asynchronously. This enables real-time payment status updates without polling.

## Webhook Endpoint

```
POST https://your-domain.com/api/webhooks/stripe
```

## Supported Events

### Payment Intent Events

| Event | Description | Handler |
|-------|-------------|---------|
| `payment_intent.succeeded` | Payment completed successfully | Updates payment to `paid` status |
| `payment_intent.payment_failed` | Payment failed | Updates payment to `failed` status |
| `payment_intent.canceled` | Payment canceled | Updates payment to `cancelled` status |
| `payment_intent.requires_action` | Additional action required | Updates gateway response |

### Charge Events

| Event | Description | Handler |
|-------|-------------|---------|
| `charge.succeeded` | Charge completed | Updates with actual Stripe fees |
| `charge.failed` | Charge failed | Marks payment as failed |
| `charge.refunded` | Charge refunded | Updates refund status |

### Dispute Events

| Event | Description | Handler |
|-------|-------------|---------|
| `charge.dispute.created` | Customer disputed charge | Stores dispute info in metadata |
| `charge.dispute.closed` | Dispute resolved | Updates dispute status |

### Refund Events

| Event | Description | Handler |
|-------|-------------|---------|
| `refund.created` | Refund initiated | Logged for audit |
| `refund.updated` | Refund status changed | Logged for audit |

## Setup Instructions

### 1. Configure Webhook Secret

Get your webhook signing secret from Stripe Dashboard:

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen for (or select "all events")
5. Copy the "Signing secret" (starts with `whsec_`)

### 2. Set Environment Variable

```bash
# .env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Run Database Migration

```bash
psql -h your-host -U your-user -d your-db -f prisma/migrations/006_webhook_events_table.sql
```

### 4. Test Webhook

Use Stripe CLI to test locally:

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

## Webhook Security

### Signature Verification

All webhook requests are verified using Stripe's signature verification:

```typescript
const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  webhookSecret
);
```

**Important:** The webhook endpoint uses raw body parsing, not JSON parsing, to preserve the signature.

### Best Practices

1. **Always verify signatures** - Never process unverified webhooks
2. **Use HTTPS** - Webhooks should only be sent to HTTPS endpoints
3. **Handle idempotency** - Events may be sent multiple times
4. **Return 200 quickly** - Process events asynchronously
5. **Log all events** - Store in `webhook_events` table for audit

## Event Processing Flow

```
Stripe → POST /api/webhooks/stripe
         ├─ Verify signature
         ├─ Log to webhook_events table
         ├─ Return 200 OK immediately
         └─ Process asynchronously
            ├─ Update payment status
            ├─ Update order status
            ├─ Create status history
            └─ Mark event as processed
```

## Monitoring Webhooks

### Get Recent Webhook Events

```bash
GET /api/webhooks/events?limit=50&offset=0
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": "wh_1768077579107_abc123",
      "event_type": "payment_intent.succeeded",
      "event_id": "evt_1abc123",
      "processed": true,
      "error_message": null,
      "created_at": "2026-01-10T20:30:00Z",
      "processed_at": "2026-01-10T20:30:01Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

### Check Webhook Health

```bash
GET /api/webhooks/health
```

**Response:**
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

## Database Schema

### webhook_events Table

```sql
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);
```

**Indexes:**
- `event_type` - Query by event type
- `processed` - Find unprocessed events
- `created_at` - Time-based queries
- `event_id` - Deduplication

## Event Handlers

### Payment Intent Succeeded

**Trigger:** Payment completed successfully

**Actions:**
1. Update payment status to `paid`
2. Set `captured_at` timestamp
3. Update order payment status to `paid`
4. Create order status history entry

**Example:**
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_3abc123",
      "amount": 5000,
      "status": "succeeded"
    }
  }
}
```

### Payment Intent Failed

**Trigger:** Payment failed

**Actions:**
1. Update payment status to `failed`
2. Set `failed_at` timestamp
3. Store error code and message
4. Update order payment status to `failed`

### Charge Refunded

**Trigger:** Charge refunded (full or partial)

**Actions:**
1. Update payment status to `refunded` or `partially_refunded`
2. Update gateway response with refund details

## Error Handling

### Failed Event Processing

If event processing fails:
1. Error is logged to `webhook_events.error_message`
2. Event marked as unprocessed
3. Can be retried manually

### Query Failed Events

```sql
SELECT * FROM webhook_events 
WHERE processed = false 
  AND error_message IS NOT NULL
ORDER BY created_at DESC;
```

### Retry Failed Event

```typescript
// Get event from database
const event = await prisma.webhook_events.findUnique({
  where: { id: 'wh_123' }
});

// Parse and retry
const stripeEvent = JSON.parse(event.payload);
await StripeWebhookHandler.handleEvent(stripeEvent);
```

## Testing

### Local Testing with Stripe CLI

```bash
# Terminal 1: Start your API server
pnpm dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Terminal 3: Trigger events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

### Test Scenarios

**1. Successful Payment Flow**
```bash
# Create payment via API
curl -X POST http://localhost:4000/api/orders/ord_123/payments/charge \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paymentMethod": {"type": "card", "token": "pm_card_visa"}}'

# Webhook automatically sent by Stripe
# Check webhook_events table
SELECT * FROM webhook_events WHERE event_type = 'payment_intent.succeeded';
```

**2. Failed Payment**
```bash
stripe trigger payment_intent.payment_failed

# Check payment status
SELECT payment_status FROM payments WHERE gateway_transaction_id = 'pi_xxx';
```

**3. Refund Processing**
```bash
# Process refund via API
curl -X POST http://localhost:4000/api/payments/pay_123/refund \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 2500, "reason": "requested_by_customer"}'

# Webhook automatically sent
# Verify refund status
SELECT payment_status FROM payments WHERE id = 'pay_123';
```

## Production Deployment

### Checklist

- [ ] Set `STRIPE_WEBHOOK_SECRET` environment variable
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Use HTTPS for webhook URL
- [ ] Test webhook signature verification
- [ ] Monitor webhook events table
- [ ] Set up alerting for failed events
- [ ] Document webhook URL for team
- [ ] Test all event types in production

### Webhook URL Format

```
Production: https://api.yourplatform.com/api/webhooks/stripe
Staging:    https://api-staging.yourplatform.com/api/webhooks/stripe
```

### Monitoring

**Key Metrics:**
- Webhook success rate
- Processing time
- Failed events count
- Event types distribution

**Query for Monitoring:**
```sql
-- Success rate (last 24 hours)
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Event types distribution
SELECT 
  event_type,
  COUNT(*) as count,
  SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) as successful
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

## Troubleshooting

### Webhook Not Received

1. Check Stripe Dashboard webhook logs
2. Verify webhook URL is correct
3. Ensure server is accessible from internet
4. Check firewall/security group settings

### Signature Verification Failed

1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure using raw body parser
3. Check Stripe API version compatibility
4. Verify webhook secret matches endpoint

### Events Not Processing

1. Check `webhook_events` table for errors
2. Review application logs
3. Verify database connectivity
4. Check payment/order records exist

### Duplicate Events

Stripe may send the same event multiple times. The system handles this by:
1. Using `event_id` as unique constraint
2. Checking if event already processed
3. Idempotent event handlers

## Support

For issues with webhooks:
1. Check Stripe Dashboard webhook logs
2. Review `webhook_events` table
3. Check application logs
4. Contact Stripe support for webhook delivery issues

---

**Last Updated:** 2026-01-10  
**API Version:** Phase 3B Week 2 Day 3  
**Status:** Production Ready
