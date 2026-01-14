# Production Deployment Guide - Payment Processing System

## Overview

This guide covers deploying the complete payment processing system to production, including payment APIs, webhook handlers, and monitoring setup.

## Prerequisites

- [ ] Production Stripe account with live API keys
- [ ] Production database (Supabase/PostgreSQL)
- [ ] Production environment (Railway/Vercel/AWS)
- [ ] SSL certificate for webhook endpoint
- [ ] Monitoring tools configured

## Deployment Checklist

### 1. Database Setup

#### Run Migrations

```bash
# Connect to production database
psql -h your-production-host -U your-user -d your-db

# Run migrations in order
\i prisma/migrations/001_phase3a_order_management.sql
\i prisma/migrations/002_phase3b_payment_shipping_config.sql
\i prisma/migrations/003_phase3b_platform_transaction_fees.sql
\i prisma/migrations/006_webhook_events_table.sql
```

#### Verify Tables

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'orders',
    'order_items',
    'payments',
    'tenant_payment_gateways',
    'platform_fee_tiers',
    'platform_fee_overrides',
    'webhook_events'
  );

-- Verify indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('payments', 'webhook_events');
```

### 2. Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:5432/database

# Stripe (Production)
STRIPE_SECRET_KEY=sk_live_your_production_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret

# Payment Encryption
PAYMENT_CREDENTIAL_ENCRYPTION_KEY=your_32_byte_encryption_key_here

# API Configuration
API_PORT=4000
NODE_ENV=production

# Frontend URL (for CORS)
FRONTEND_URL=https://your-production-domain.com
```

#### Generate Encryption Key

```bash
# Generate secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Stripe Configuration

#### Get Production API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Switch to **Live mode** (toggle in top-right)
3. Copy **Secret key** (starts with `sk_live_`)
4. Copy **Publishable key** (starts with `pk_live_`)

#### Configure Production Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
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
5. Click **Add endpoint**
6. Copy **Signing secret** (starts with `whsec_`)
7. Add to environment: `STRIPE_WEBHOOK_SECRET=whsec_...`

### 4. Platform Fee Configuration

#### Set Default Fee Tiers

```sql
-- Insert default platform fee tiers
INSERT INTO platform_fee_tiers (
  id, tier_name, tier_level, percentage_fee, 
  fixed_fee_cents, min_transaction_cents, max_transaction_cents,
  description, is_active, created_at, updated_at
) VALUES
  (
    'tier_starter',
    'Starter',
    1,
    3.0,
    0,
    0,
    NULL,
    'Default tier for new tenants',
    true,
    NOW(),
    NOW()
  ),
  (
    'tier_professional',
    'Professional',
    2,
    1.5,
    0,
    0,
    NULL,
    'Professional tier with reduced fees',
    true,
    NOW(),
    NOW()
  ),
  (
    'tier_enterprise',
    'Enterprise',
    3,
    0.5,
    0,
    0,
    NULL,
    'Enterprise tier with minimal fees',
    true,
    NOW(),
    NOW()
  );
```

#### Assign Tiers to Tenants

```sql
-- Update tenant fee tiers
UPDATE tenants 
SET platform_fee_tier_id = 'tier_professional'
WHERE id = 'your-tenant-id';
```

### 5. Payment Gateway Setup

#### Configure Tenant Payment Gateways

```sql
-- Example: Add Stripe gateway for tenant
INSERT INTO tenant_payment_gateways (
  id,
  tenant_id,
  gateway_type,
  is_active,
  is_default,
  api_key_encrypted,
  api_secret_encrypted,
  config,
  default_flow,
  verification_status,
  created_at,
  updated_at
) VALUES (
  'tpg_' || gen_random_uuid(),
  'your-tenant-id',
  'stripe',
  true,
  true,
  encode(encrypt(
    'pk_live_your_publishable_key'::bytea,
    'your_encryption_key'::bytea,
    'aes'
  ), 'base64'),
  encode(encrypt(
    'sk_live_your_secret_key'::bytea,
    'your_encryption_key'::bytea,
    'aes'
  ), 'base64'),
  jsonb_build_object(
    'testMode', false,
    'webhookSecret', null,
    'apiVersion', '2025-10-29.clover'
  ),
  'authorize_capture',
  'verified',
  NOW(),
  NOW()
);
```

### 6. Deployment Steps

#### Railway Deployment

```bash
# 1. Push code to repository
git add .
git commit -m "Production deployment: Payment processing system"
git push origin main

# 2. Railway will auto-deploy
# Monitor deployment at: https://railway.app/project/your-project

# 3. Set environment variables in Railway dashboard
# Settings → Variables → Add all required variables

# 4. Verify deployment
curl https://api.yourplatform.com/api/webhooks/health
```

#### Manual Deployment

```bash
# 1. Build application
pnpm build

# 2. Run database migrations
pnpm prisma migrate deploy

# 3. Generate Prisma client
pnpm prisma generate

# 4. Start production server
NODE_ENV=production pnpm start
```

### 7. Post-Deployment Verification

#### Test Webhook Endpoint

```bash
# Check webhook health
curl https://api.yourplatform.com/api/webhooks/health

# Expected response:
# {
#   "success": true,
#   "status": "healthy",
#   "webhooks": {
#     "stripe": "active",
#     "paypal": "not_implemented"
#   }
# }
```

#### Send Test Webhook from Stripe

1. Go to https://dashboard.stripe.com/webhooks
2. Click on your production endpoint
3. Click **Send test webhook**
4. Select `payment_intent.succeeded`
5. Click **Send test webhook**

#### Verify Database

```sql
-- Check webhook was received
SELECT * FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 5;

-- Check processing status
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed,
  SUM(CASE WHEN NOT processed THEN 1 ELSE 0 END) as failed
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '1 hour';
```

#### Test Payment Flow

```bash
# Create test order
curl -X POST https://api.yourplatform.com/api/orders \
  -H "Authorization: Bearer $PRODUCTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "your-tenant-id",
    "customer": {
      "email": "test@example.com",
      "name": "Test Customer"
    },
    "items": [{
      "sku": "TEST-001",
      "name": "Test Product",
      "quantity": 1,
      "unit_price_cents": 1000
    }]
  }'

# Authorize payment (use real Stripe test card in live mode test)
curl -X POST https://api.yourplatform.com/api/orders/ORDER_ID/payments/authorize \
  -H "Authorization: Bearer $PRODUCTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": {
      "type": "card",
      "token": "pm_card_visa"
    },
    "gatewayType": "stripe"
  }'
```

### 8. Monitoring Setup

#### Database Monitoring Queries

```sql
-- Payment success rate (last 24 hours)
SELECT 
  COUNT(*) as total_payments,
  SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Webhook processing health
SELECT 
  event_type,
  COUNT(*) as total,
  SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as errors
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;

-- Platform fee revenue
SELECT 
  DATE(created_at) as date,
  COUNT(*) as transactions,
  SUM(platform_fee_cents) / 100.0 as platform_revenue,
  SUM(gateway_fee_cents) / 100.0 as gateway_fees,
  SUM(net_amount_cents) / 100.0 as merchant_revenue
FROM payments
WHERE payment_status = 'paid'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Alert Conditions

Set up alerts for:

1. **High Failure Rate**: Payment success rate < 95%
2. **Webhook Failures**: Unprocessed webhooks > 5 in 1 hour
3. **Database Errors**: Error rate > 1% in 1 hour
4. **Response Time**: API response time > 2 seconds
5. **Dispute Created**: Immediate notification

### 9. Security Checklist

- [ ] All API keys stored in environment variables (not in code)
- [ ] HTTPS enabled for all endpoints
- [ ] Webhook signature verification enabled
- [ ] Payment credentials encrypted in database
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] SQL injection protection (using Prisma)
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive data
- [ ] Audit logging enabled

### 10. Rollback Plan

If issues occur after deployment:

```bash
# 1. Revert to previous deployment
git revert HEAD
git push origin main

# 2. Or rollback in Railway
# Dashboard → Deployments → Select previous deployment → Redeploy

# 3. Disable webhooks temporarily
# Stripe Dashboard → Webhooks → Disable endpoint

# 4. Monitor error logs
# Railway Dashboard → Logs

# 5. Database rollback (if needed)
# Restore from backup or run reverse migrations
```

### 11. Performance Optimization

#### Database Indexes

```sql
-- Verify critical indexes exist
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('payments', 'orders', 'webhook_events')
ORDER BY tablename, indexname;
```

#### Connection Pooling

Ensure PgBouncer is configured:
```
DATABASE_URL=postgresql://user:password@host:6543/db?pgbouncer=true&connection_limit=1
```

### 12. Maintenance Tasks

#### Daily

- Monitor webhook processing rate
- Check payment success rate
- Review error logs

#### Weekly

- Analyze platform fee revenue
- Review failed payments
- Check for disputed charges

#### Monthly

- Database performance review
- Update Stripe API version if needed
- Review and optimize slow queries
- Backup verification

### 13. Support & Troubleshooting

#### Common Issues

**Webhook not received:**
- Check Stripe Dashboard webhook logs
- Verify webhook URL is correct
- Check firewall/security group settings
- Verify SSL certificate is valid

**Payment authorization failed:**
- Check Stripe API key is correct
- Verify payment method is valid
- Check for Stripe account issues
- Review error message in response

**Database connection errors:**
- Check DATABASE_URL is correct
- Verify connection pool settings
- Check database is accessible
- Review connection limits

#### Debug Commands

```bash
# Check API health
curl https://api.yourplatform.com/health

# Check webhook health
curl https://api.yourplatform.com/api/webhooks/health

# View recent logs (Railway)
railway logs --tail 100

# Check database connectivity
psql $DATABASE_URL -c "SELECT NOW();"
```

### 14. Documentation Links

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Payment API Documentation](./PAYMENTS_API_DOCUMENTATION.md)
- [Webhook Setup Guide](./WEBHOOK_SETUP_GUIDE.md)
- [Testing Guide](./PAYMENT_TESTING_SETUP.md)

---

## Production Deployment Complete! 🚀

Once all checklist items are complete, your payment processing system is ready for production use.

**Last Updated:** 2026-01-10  
**Version:** Phase 3B Week 2 Day 4  
**Status:** Production Ready
