# Trial & Tier Alignment - Phase 5 COMPLETE ✅

**Completion Date:** November 14, 2025  
**Phase:** Stripe Webhook Alignment  
**Status:** ✅ IMPLEMENTATION COMPLETE - Ready for Testing

---

## Executive Summary

Phase 5 successfully implements Stripe webhook handling that aligns with the trial → google_only → maintenance → freeze lifecycle. The webhook handlers ensure subscription status stays in sync with Stripe while preserving the internal tier management rules established in Phases 0-4.

---

## What Was Implemented

### 1. ✅ Stripe Webhook Handler

**File:** `apps/api/src/routes/stripe-webhooks.ts` (NEW - 400+ lines)

**Purpose:** Handle Stripe subscription lifecycle events and keep tenant subscription status in sync

**Supported Events:**
- `checkout.session.completed` - Initial subscription creation
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Status changes
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_failed` - Payment issues
- `invoice.payment_succeeded` - Payment recovery

### 2. ✅ Stripe Status Mapping

**Function:** `mapStripeStatusToInternal(stripeStatus): string`

**Mapping:**
```typescript
Stripe Status → Internal Status
'trialing'    → 'trial'
'active'      → 'active'
'past_due'    → 'past_due'
'unpaid'      → 'past_due'
'canceled'    → 'canceled'
'incomplete'  → 'expired'
```

### 3. ✅ Tier Extraction from Stripe

**Function:** `extractTierFromPrice(price): string`

Extracts tier from Stripe price metadata:
- Checks `price.metadata.tier` or `price.metadata.plan`
- Validates against allowed tiers
- Defaults to 'starter' if invalid
- **Never allows google_only via webhook** (internal tier only)

### 4. ✅ Idempotency System

**Database Table:** `StripeWebhookEvent`

**Schema:**
```prisma
model StripeWebhookEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique
  eventType   String
  processedAt DateTime @default(now())
  createdAt   DateTime @default(now())
}
```

**Purpose:**
- Prevents duplicate event processing
- Tracks all processed webhooks
- Enables debugging and audit trail

---

## Key Implementation Details

### Checkout Session Completed

**Trigger:** User completes Stripe checkout  
**Action:**
- Store `stripeCustomerId` on tenant
- Store `stripeSubscriptionId` on tenant
- Enables future webhook processing

**Code:**
```typescript
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
  },
});
```

### Subscription Created/Updated

**Trigger:** Stripe subscription status changes  
**Actions:**
1. Find tenant by `stripeCustomerId`
2. Extract tier from price metadata
3. Map Stripe status to internal status
4. Calculate subscription end date
5. Update tenant with new status/tier

**Important Rules:**
- ✅ Never downgrades to `google_only` via webhook
- ✅ Preserves `trialEndsAt` for historical reference
- ✅ Only updates tier if valid (not google_only)
- ✅ Calculates `subscriptionEndsAt` from Stripe period

**Code:**
```typescript
const updateData = {
  stripeSubscriptionId: subscription.id,
  subscriptionStatus: mapStripeStatusToInternal(subscription.status),
  subscriptionTier: tier, // Validated, never google_only
  subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
};

// IMPORTANT: Never downgrade to google_only via webhook
if (tier === 'google_only') {
  console.warn('Attempted to set google_only tier via webhook - ignoring');
  delete updateData.subscriptionTier;
}
```

### Subscription Deleted

**Trigger:** Subscription canceled in Stripe  
**Action:**
- Set `subscriptionStatus = 'canceled'`
- Keep tier and other fields for reference
- Let `GET /tenants/:id` handle google_only downgrade

**Rationale:** Separation of concerns - webhooks update status, GET endpoint handles tier downgrade logic

### Payment Failed

**Trigger:** Invoice payment fails  
**Action:**
- Set `subscriptionStatus = 'past_due'`
- TODO: Send email notification

**Grace Period:** User can still access during past_due (handled by middleware)

### Payment Succeeded

**Trigger:** Invoice payment succeeds  
**Action:**
- If was `past_due`, restore to `active`
- TODO: Send confirmation email

---

## Integration with Trial Lifecycle

### Trial → Paid Conversion

**Scenario:** User on trial subscribes via Stripe

**Flow:**
1. User completes checkout → `checkout.session.completed`
2. Stripe creates subscription → `customer.subscription.created`
3. Webhook extracts tier from price metadata
4. Updates tenant: `status = 'active'`, `tier = 'professional'`
5. Preserves `trialEndsAt` for historical reference

**Result:** Clean conversion from trial to paid

### Trial Expiration (No Payment)

**Scenario:** Trial ends without Stripe subscription

**Flow:**
1. `GET /tenants/:id` detects expired trial
2. Auto-downgrades to `google_only` tier
3. Sets `status = 'expired'`
4. No webhook involved (internal logic)

**Result:** Maintenance mode activated

### Paid → Canceled

**Scenario:** User cancels subscription

**Flow:**
1. Stripe cancels subscription → `customer.subscription.deleted`
2. Webhook sets `status = 'canceled'`
3. Keeps tier for reference
4. `GET /tenants/:id` can later downgrade to `google_only` if needed

**Result:** Graceful cancellation

### Payment Failure → Recovery

**Scenario:** Payment fails then succeeds

**Flow:**
1. Payment fails → `invoice.payment_failed`
2. Webhook sets `status = 'past_due'`
3. User updates payment method
4. Payment succeeds → `invoice.payment_succeeded`
5. Webhook restores `status = 'active'`

**Result:** Seamless recovery

---

## Security & Best Practices

### 1. Signature Verification

```typescript
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  STRIPE_WEBHOOK_SECRET
);
```

**Purpose:** Ensures webhook is from Stripe, not malicious actor

### 2. Idempotency

```typescript
const existingEvent = await prisma.stripeWebhookEvent.findUnique({
  where: { eventId: event.id },
});

if (existingEvent) {
  return res.json({ received: true, duplicate: true });
}
```

**Purpose:** Prevents duplicate processing if Stripe retries

### 3. Error Handling

```typescript
try {
  // Process webhook
} catch (error) {
  console.error('Error processing webhook:', error);
  res.status(500).json({ error: 'Webhook processing failed' });
}
```

**Purpose:** Logs errors, returns 500 so Stripe retries

### 4. google_only Protection

```typescript
if (tier === 'google_only') {
  console.warn('Attempted to set google_only tier via webhook - ignoring');
  delete updateData.subscriptionTier;
}
```

**Purpose:** Prevents external systems from setting internal-only tier

---

## Environment Variables Required

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.yourapp.com
```

**Setup:**
1. Get `STRIPE_SECRET_KEY` from Stripe Dashboard
2. Create webhook endpoint in Stripe Dashboard
3. Get `STRIPE_WEBHOOK_SECRET` from webhook settings
4. Add to environment variables

---

## Installation Steps

### 1. Install Stripe SDK

```bash
cd apps/api
npm install stripe @types/stripe
```

### 2. Run Prisma Migration

```bash
npx prisma migrate dev --name add_stripe_webhook_events
# or apply manually:
npx prisma db execute --file prisma/migrations/add_stripe_webhook_events.sql
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Register Webhook Route

Add to `apps/api/src/index.ts`:

```typescript
import stripeWebhooks from './routes/stripe-webhooks';

// IMPORTANT: Must be BEFORE express.json() middleware
// Stripe requires raw body for signature verification
app.use('/stripe/webhooks', express.raw({ type: 'application/json' }), stripeWebhooks);
```

### 5. Configure Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-api.com/stripe/webhooks`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Testing

### Test with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/stripe/webhooks

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

### Test Events

**1. Trial Conversion:**
```bash
stripe trigger customer.subscription.created \
  --add customer:metadata.tenantId=test-tenant-123 \
  --add subscription:items[0].price.metadata.tier=professional
```

**2. Payment Failure:**
```bash
stripe trigger invoice.payment_failed
```

**3. Subscription Cancellation:**
```bash
stripe trigger customer.subscription.deleted
```

### Manual Testing Checklist

- [ ] Checkout session creates Stripe IDs on tenant
- [ ] Subscription creation updates tier and status
- [ ] Subscription update changes status correctly
- [ ] Payment failure sets past_due status
- [ ] Payment success restores active status
- [ ] Subscription deletion sets canceled status
- [ ] Duplicate events are ignored (idempotency)
- [ ] Invalid signatures are rejected
- [ ] google_only tier cannot be set via webhook

---

## Monitoring & Debugging

### Webhook Logs

Query processed webhooks:

```sql
SELECT * FROM stripe_webhook_events 
ORDER BY processed_at DESC 
LIMIT 100;
```

### Failed Webhooks

Check Stripe Dashboard → Developers → Webhooks → [Your Endpoint] → Logs

**Common Issues:**
- Signature verification failed → Check `STRIPE_WEBHOOK_SECRET`
- Tenant not found → Check metadata in Stripe checkout
- Duplicate processing → Check idempotency logic

### Application Logs

```typescript
console.log('[Stripe Webhooks] Received event:', event.type);
console.log('[Stripe Webhooks] Updated tenant:', tenantId);
console.error('[Stripe Webhooks] Error:', error);
```

---

## Alignment with Phase 0-4

### Preserves Trial Lifecycle

✅ **Never auto-converts trial to paid without payment**
- Webhooks only process Stripe events
- Trial expiration handled by `GET /tenants/:id`

✅ **Preserves google_only tier logic**
- Webhooks cannot set google_only tier
- Internal tier management unchanged

✅ **Maintains maintenance/freeze rules**
- `deriveInternalStatus()` still determines operational state
- Webhooks only update raw status/tier fields

### Enhances Existing System

✅ **Adds real-time sync with Stripe**
- Status updates immediately on payment events
- No polling required

✅ **Enables paid subscriptions**
- Trial → Paid conversion via Stripe
- Subscription management via Stripe

✅ **Provides audit trail**
- All webhook events logged
- Debugging and compliance

---

## Files Created/Modified

### Created (3 files)
1. `apps/api/src/routes/stripe-webhooks.ts` (NEW - 400+ lines)
2. `apps/api/prisma/migrations/add_stripe_webhook_events.sql` (NEW)
3. `docs/TRIAL_TIER_ALIGNMENT_PHASE5_COMPLETE.md` (this document)

### Modified (1 file)
4. `apps/api/prisma/schema.prisma` - Added `StripeWebhookEvent` model

### Pending Integration
5. `apps/api/src/index.ts` - Need to register webhook route

---

## Next Steps

### Immediate (Required for Production)
1. Install Stripe SDK: `npm install stripe @types/stripe`
2. Run Prisma migration
3. Generate Prisma client
4. Register webhook route in `index.ts`
5. Configure Stripe Dashboard webhook
6. Test with Stripe CLI

### Short-term (Enhancements)
1. Add email notifications for payment events
2. Add webhook retry logic
3. Add webhook event dashboard in admin UI
4. Monitor webhook success rate

### Long-term (Optional)
1. Support multiple payment providers
2. Add subscription upgrade/downgrade flows
3. Implement proration logic
4. Add subscription analytics

---

## Business Value

### Revenue Enablement
✅ **Enables paid subscriptions** - Users can upgrade from trial  
✅ **Real-time billing sync** - Status updates immediately  
✅ **Payment recovery** - Handles failed payments gracefully  

### Operational Efficiency
✅ **Automated status updates** - No manual intervention  
✅ **Audit trail** - All events logged  
✅ **Error handling** - Retries on failure  

### User Experience
✅ **Seamless upgrades** - Trial → Paid conversion smooth  
✅ **Grace period** - Past due allows continued access  
✅ **Clear status** - Always in sync with Stripe  

---

## Success Metrics

### Technical
- Webhook success rate > 99%
- Processing latency < 1 second
- Zero duplicate processing
- Signature verification 100%

### Business
- Trial → Paid conversion rate
- Payment failure recovery rate
- Subscription retention rate
- Revenue recognition accuracy

---

## Conclusion

Phase 5 is **complete and ready for testing**. The Stripe webhook integration:

✅ **Aligns with Trial Lifecycle** - Preserves all Phase 0-4 rules  
✅ **Enables Paid Subscriptions** - Real-time sync with Stripe  
✅ **Maintains Security** - Signature verification + idempotency  
✅ **Provides Audit Trail** - All events logged  
✅ **Handles Edge Cases** - Payment failures, cancellations, recovery  

**Status: Implementation Complete - Pending Installation & Testing**

---

## Installation Commands

```bash
# 1. Install Stripe SDK
cd apps/api
npm install stripe @types/stripe

# 2. Run migration
npx prisma migrate dev --name add_stripe_webhook_events

# 3. Generate Prisma client
npx prisma generate

# 4. Test webhook handler
stripe listen --forward-to localhost:3001/stripe/webhooks
```

**Phase 5 Complete! Ready for Stripe integration testing.** 🎉
