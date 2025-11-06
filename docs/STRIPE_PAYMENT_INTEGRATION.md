# Stripe Payment & Billing Integration Strategy

## Overview

This document outlines a phased approach to integrating Stripe payment processing and subscription billing into the Retail Visibility Platform.

---

## Phase 1: Stripe Account Setup & Payment Acceptance

**Timeline:** 1-2 weeks  
**Goal:** Establish Stripe account, configure products, and enable basic payment acceptance

### 1.1 Stripe Account Setup

#### Steps

1. **Create Stripe Account**
   - Sign up at https://dashboard.stripe.com/register
   - Choose Standard account type

2. **Complete Business Profile**
   - Business details (legal name, EIN, address)
   - Banking information for payouts
   - Tax information
   - Identity verification

3. **Enable Payment Methods**
   - Credit/Debit Cards (Visa, Mastercard, Amex, Discover)
   - ACH Direct Debit
   - Digital Wallets (Apple Pay, Google Pay)

4. **Configure Payout Schedule**
   - Recommended: Daily automatic payouts

### 1.2 Product & Pricing Configuration

#### Subscription Tiers

**Starter Plan - $29/month**
- 1 Location
- Up to 100 products
- Google Shopping integration
- Basic storefront
- Email support

**Professional Plan - $79/month**
- Up to 5 locations
- Up to 500 products
- Google Shopping + GMB sync
- Advanced storefront
- Priority support
- QR code marketing

**Enterprise Plan - $199/month**
- Unlimited locations
- Unlimited products
- Full Google integration suite
- White-label storefront
- Dedicated support
- Chain management
- API access

#### Create Products in Stripe Dashboard

Navigate to: Products > Add Product

For each tier:
1. Product name: "Retail Visibility Platform - [Tier Name]"
2. Pricing model: Recurring
3. Billing period: Monthly
4. Price: [Amount]
5. Currency: USD

### 1.3 Tax Configuration

**Enable Stripe Tax**
1. Navigate to: Settings > Tax
2. Enable Stripe Tax
3. Configure tax registration
4. Product tax code: `txcd_10000000` (SaaS)

### 1.4 Webhook Configuration

**Create Webhook Endpoint**

Endpoint URL: `https://api.yourplatform.com/webhooks/stripe`

Events to send:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

### 1.5 API Keys

Navigate to: Developers > API keys

**Test Mode Keys**
```
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
```

**Live Mode Keys**
```
STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_...
STRIPE_LIVE_SECRET_KEY=sk_live_...
STRIPE_LIVE_WEBHOOK_SECRET=whsec_...
```

### 1.6 Test Payment

**Test Cards**
- Success: `4242 4242 4242 4242`
- 3D Secure: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

---

## Phase 2: Platform Payment Integration

**Timeline:** 3-4 weeks  
**Goal:** Integrate Stripe Checkout and payment processing

### 2.1 Backend Setup

#### Install Dependencies

```bash
npm install stripe @stripe/stripe-js
```

#### Database Schema

Add to `prisma/schema.prisma`:

```prisma
model User {
  stripeCustomerId  String?  @unique
  subscriptions     Subscription[]
}

model Subscription {
  id                    String   @id @default(cuid())
  userId                String
  stripeSubscriptionId  String   @unique
  stripePriceId         String
  status                String
  plan                  String
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean  @default(false)
  amount                Int
  currency              String   @default("usd")
  interval              String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

Run migration:
```bash
npx prisma migrate dev --name add_stripe_billing
```

### 2.2 API Endpoints

**Create Checkout Session**
- `POST /api/billing/checkout/session`
- Creates Stripe Checkout session
- Returns session URL

**Customer Portal**
- `POST /api/billing/portal/session`
- Creates billing portal session
- Allows subscription management

**Get Subscription**
- `GET /api/billing/subscription`
- Returns current subscription status

**Webhook Handler**
- `POST /api/webhooks/stripe`
- Handles Stripe events
- Updates database

### 2.3 Frontend Integration

**Pricing Page**
- Display subscription tiers
- "Get Started" buttons
- Redirect to Stripe Checkout

**Billing Settings**
- Show current subscription
- "Manage Subscription" button
- Opens Stripe Customer Portal

### 2.4 Environment Variables

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_...
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE=price_...
```

---

## Phase 3: Subscription Management

**Timeline:** 2-3 weeks  
**Goal:** Implement feature access control and billing automation

### 3.1 Feature Access Control

**Plan Limits**
```typescript
const PLAN_LIMITS = {
  starter: { locations: 1, products: 100 },
  professional: { locations: 5, products: 500 },
  enterprise: { locations: Infinity, products: Infinity }
};
```

**Middleware**
- Check subscription status
- Enforce plan limits
- Block access if expired

### 3.2 Trial Management

**14-Day Free Trial**
- Automatic trial on signup
- No credit card required
- Email reminders at 7 days, 1 day

### 3.3 Billing Automation

**Invoice Generation**
- Automatic monthly billing
- Email invoice to customer
- Retry failed payments (3 attempts)

**Dunning Management**
- Email on payment failure
- Suspend account after 7 days
- Cancel after 30 days

---

## Phase 4: Advanced Features

**Timeline:** 2-3 weeks  
**Goal:** Add advanced billing features

### 4.1 Usage-Based Billing

**Metered Billing**
- Track API calls
- Charge per location
- Overage fees

### 4.2 Promotions

**Discount Codes**
- Percentage off
- Fixed amount off
- Free trial extension

### 4.3 Analytics

**Revenue Metrics**
- MRR (Monthly Recurring Revenue)
- Churn rate
- LTV (Lifetime Value)

---

## Security & Compliance

### PCI Compliance
- ✅ Stripe handles card data
- ✅ No card data stored on servers
- ✅ PCI-DSS Level 1 certified

### Data Protection
- Encrypt Stripe customer IDs
- Secure webhook endpoints
- Rate limit API calls

### Legal Requirements
- Terms of Service
- Privacy Policy
- Refund Policy
- Subscription Terms

---

## Testing Strategy

### Test Checklist

**Phase 1**
- [ ] Create test subscription
- [ ] Verify webhook delivery
- [ ] Test payment methods

**Phase 2**
- [ ] Checkout flow (success)
- [ ] Checkout flow (cancel)
- [ ] Customer portal access
- [ ] Subscription updates

**Phase 3**
- [ ] Feature access control
- [ ] Trial expiration
- [ ] Payment failure handling
- [ ] Subscription cancellation

---

## Rollout Plan

### Week 1-2: Phase 1
- Stripe account setup
- Product configuration
- Test payments

### Week 3-6: Phase 2
- Backend integration
- Frontend components
- Webhook handling

### Week 7-9: Phase 3
- Access control
- Trial management
- Billing automation

### Week 10-12: Phase 4
- Advanced features
- Analytics
- Optimization

---

## Support & Resources

**Stripe Documentation**
- https://stripe.com/docs
- https://stripe.com/docs/billing
- https://stripe.com/docs/webhooks

**Testing**
- https://stripe.com/docs/testing

**Support**
- Stripe Dashboard: https://dashboard.stripe.com
- Email: support@stripe.com
