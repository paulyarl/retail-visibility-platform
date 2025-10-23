# Subscription Management (v3.5.1)

Quick implementation of subscription status and billing management for revenue generation.

## Overview

Adds subscription tracking to enable revenue generation before full IAP (v3.6) implementation.

## Features

### 1. Subscription Status Tracking
- **Trial**: 30-day free trial for new tenants
- **Active**: Paid subscription
- **Past Due**: Payment failed, grace period
- **Canceled**: Subscription terminated

### 2. Subscription Tiers

#### Starter - $49/month
- 500 items
- 3 users
- 1 location
- Basic sync
- Email support

#### Professional - $149/month
- 5,000 items
- 10 users
- 5 locations
- Advanced sync
- Priority support

#### Enterprise - $499/month
- Unlimited items
- Unlimited users
- Unlimited locations
- Custom integrations
- Dedicated support

### 3. Access Control
- Middleware blocks access if subscription expired
- Automatic limit enforcement per tier
- Grace period for payment failures

## API Endpoints

### GET /subscriptions/status?tenantId={id}
Get subscription status and usage for a tenant.

**Response:**
```json
{
  "tenant": {
    "id": "tenant_123",
    "name": "Acme Corp"
  },
  "subscription": {
    "status": "trial",
    "tier": "starter",
    "trialEndsAt": "2025-11-23T00:00:00Z",
    "daysRemaining": 28,
    "hasStripeAccount": false
  },
  "usage": {
    "items": {
      "current": 45,
      "limit": 500,
      "percentage": 9
    },
    "users": {
      "current": 2,
      "limit": 3,
      "percentage": 67
    }
  }
}
```

### PATCH /subscriptions/update
Update subscription status (admin only).

**Request:**
```json
{
  "tenantId": "tenant_123",
  "subscriptionStatus": "active",
  "subscriptionTier": "pro",
  "subscriptionEndsAt": "2025-12-23T00:00:00Z",
  "stripeCustomerId": "cus_abc123",
  "stripeSubscriptionId": "sub_xyz789"
}
```

### GET /subscriptions/pricing
Get available pricing tiers.

## Middleware

### requireActiveSubscription
Blocks API access if subscription is expired or canceled.

**Usage:**
```typescript
app.get("/items", requireActiveSubscription, async (req, res) => {
  // Only accessible with active subscription
});
```

### checkSubscriptionLimits
Enforces tier limits (items, users, etc.).

**Usage:**
```typescript
app.post("/items", checkSubscriptionLimits, async (req, res) => {
  // Blocks if tier limit reached
});
```

## Database Schema

```prisma
model Tenant {
  // ... existing fields ...
  
  subscriptionStatus     String?   @default("trial")
  subscriptionTier       String?   @default("starter")
  trialEndsAt           DateTime?
  subscriptionEndsAt    DateTime?
  stripeCustomerId      String?   @unique
  stripeSubscriptionId  String?   @unique
}
```

## Implementation Phases

### Phase 1: Manual Billing (Week 1)
1. Customer signs up → Trial status
2. Send invoice manually (Stripe/PayPal)
3. Update subscription status via API
4. Customer gets access

### Phase 2: Stripe Integration (Week 2-3)
1. Create Stripe customer
2. Send billing portal link
3. Customer manages payment
4. Manual activation still required

### Phase 3: Semi-Automated (Week 4)
1. Auto-suspend on payment failure
2. Email reminders
3. Self-service billing link in UI

### Phase 4: Full IAP (v3.6+)
1. Self-service signup
2. Instant activation
3. Usage-based billing
4. Automatic scaling

## Usage Examples

### Check Subscription Before Operation
```typescript
import { requireActiveSubscription } from './middleware/subscription';

app.post("/items", requireActiveSubscription, async (req, res) => {
  // Create item - only if subscription active
});
```

### Get Subscription Status
```bash
curl http://localhost:4000/subscriptions/status?tenantId=tenant_123
```

### Update Subscription (Admin)
```bash
curl -X PATCH http://localhost:4000/subscriptions/update \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_123",
    "subscriptionStatus": "active",
    "subscriptionTier": "pro",
    "subscriptionEndsAt": "2025-12-23T00:00:00Z"
  }'
```

## Error Responses

### 402 Payment Required
```json
{
  "error": "trial_expired",
  "message": "Your trial has expired. Please subscribe to continue.",
  "tenant": {
    "id": "tenant_123",
    "name": "Acme Corp",
    "status": "trial_expired",
    "trialEndsAt": "2025-10-23T00:00:00Z"
  }
}
```

### 402 Limit Reached
```json
{
  "error": "item_limit_reached",
  "message": "You've reached the starter plan limit of 500 items. Please upgrade.",
  "limit": 500,
  "current": 500,
  "tier": "starter"
}
```

## Next Steps

1. ✅ Run migration to add subscription fields
2. ✅ Regenerate Prisma Client
3. ✅ Test subscription endpoints
4. 🔄 Add middleware to protected routes
5. 🔄 Create admin UI for subscription management
6. 🔄 Set up Stripe integration
7. 🔄 Add email notifications

## Migration

```bash
# Apply migration
cd apps/api
$env:DATABASE_URL="postgresql://..."
npx prisma migrate deploy

# Or for development
npx prisma migrate dev --name add_subscription_fields
```

## Notes

- All existing tenants get 30-day trial automatically
- Subscription checks are optional (can be added gradually)
- Stripe integration is prepared but not required
- Full IAP coming in v3.6
