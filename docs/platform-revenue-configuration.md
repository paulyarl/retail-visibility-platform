# Platform Revenue Collection Configuration Guide

This guide covers the setup and configuration of the platform revenue collection system using Stripe Connect and PayPal Commerce Platform for automatic fee splitting.

## Table of Contents

1. [Overview](#overview)
2. [Stripe Connect Setup](#stripe-connect-setup)
3. [PayPal Commerce Platform Setup](#paypal-commerce-platform-setup)
4. [Environment Variables](#environment-variables)
5. [Database Configuration](#database-configuration)
6. [Webhook Configuration](#webhook-configuration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The platform revenue collection system supports multiple payment gateways with different fee collection methods:

| Gateway | Fee Collection Method | Automatic Split |
|---------|----------------------|-----------------|
| Stripe | `application_fee_amount` via Connect | Yes |
| PayPal | `platform_fees` via Commerce Platform | Yes |
| Square | Monthly invoice via Stripe Billing | No |
| Clover | Monthly invoice via Stripe Billing | No |

### Architecture

```
                    Platform Payment Config
                           |
          +----------------+----------------+
          |                                 |
   Stripe Connect                  PayPal Commerce
          |                                 |
   Merchant Connections            Merchant Connections
          |                                 |
   Application Fees               Platform Fees
          |                                 |
   Platform Revenue Transactions   Platform Revenue Transactions
```

---

## Stripe Connect Setup

### Step 1: Create Platform Account

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Ensure your account is activated (complete identity verification)
3. Navigate to **Settings** > **Connect**

### Step 2: Enable Stripe Connect

1. In Connect settings, click **Get started**
2. Choose your integration type:
   - **Express** (recommended) - Fastest onboarding for merchants
   - **Custom** - Full control over UI, more compliance requirements
   - **Standard** - Merchants manage their own accounts

For this implementation, we use **Express** accounts.

### Step 3: Configure Connect Settings

1. Set your **Platform name** and **Logo**
2. Configure **Branding** settings
3. Set up **OAuth redirect URLs**:
   - Development: `http://localhost:3000/settings/admin/platform-revenue/merchants/{MERCHANT_ID}/complete`
   - Production: `https://yourdomain.com/settings/admin/platform-revenue/merchants/{MERCHANT_ID}/complete`

4. Configure **Webhook endpoints** (see [Webhook Configuration](#webhook-configuration))

### Step 4: Get API Keys

1. Navigate to **Developers** > **API Keys**
2. Copy the following keys:
   - **Publishable key** (starts with `pk_`)
   - **Secret key** (starts with `sk_`)

For production, use **Restricted keys** with only the permissions needed:
- `account` - Read and write
- `account_links` - Write
- `account_sessions` - Write
- `balance` - Read
- `charges` - Read and write
- `checkout_sessions` - Write
- `customers` - Read and write
- `payment_intents` - Read and write
- `payment_links` - Write
- `payment_methods` - Read and write
- `payouts` - Read
- `prices` - Read and write
- `products` - Read and write
- `refunds` - Read and write
- `setup_intents` - Write
- `transfers` - Write
- `webhook_endpoints` - Read and write

### Step 5: Store Keys in Database

Run this SQL to configure the platform:

```sql
INSERT INTO platform_payment_config (id, stripe_platform_account_id, stripe_connect_client_id, stripe_platform_secret_key_encrypted, stripe_webhook_secret_encrypted, default_platform_fee_percent, revenue_collection_enabled)
VALUES (
  'platform_main',
  'acct_PLATFORM_ACCOUNT_ID',  -- Your platform account ID
  'ca_XXXXXXXXXXXXXXXX',       -- Connect client ID from Stripe
  'sk_live_XXXXXXXXXXXXX',     -- Secret key (should be encrypted)
  'whsec_XXXXXXXXXXXXX',       -- Webhook signing secret
  2.0,                         -- Default 2% platform fee
  true
)
ON CONFLICT (id) DO UPDATE SET
  stripe_platform_account_id = EXCLUDED.stripe_platform_account_id,
  stripe_connect_client_id = EXCLUDED.stripe_connect_client_id,
  stripe_platform_secret_key_encrypted = EXCLUDED.stripe_platform_secret_key_encrypted,
  stripe_webhook_secret_encrypted = EXCLUDED.stripe_webhook_secret_encrypted,
  default_platform_fee_percent = EXCLUDED.default_platform_fee_percent,
  revenue_collection_enabled = EXCLUDED.revenue_collection_enabled;
```

---

## PayPal Commerce Platform Setup

### Step 1: Apply for Partner Program

1. Log in to [PayPal Developer](https://developer.paypal.com/)
2. Navigate to **My Apps & Credentials**
3. Apply for **Commerce Platform** access
   - This requires business verification
   - Approval typically takes 2-5 business days

### Step 2: Create Sandbox Application (Development)

1. Switch to **Sandbox** mode
2. Click **Create App**
3. Name it "VisibleShelf Platform"
4. Copy the following:
   - **Client ID** (sandbox)
   - **Client Secret** (sandbox)

### Step 3: Create Live Application (Production)

1. Switch to **Live** mode
2. Create a new app
3. Copy:
   - **Client ID** (live)
   - **Client Secret** (live)

### Step 4: Configure Partner Referrals

Ensure your app has these permissions:
- Accept PayPal payments
- Accept credit/debit cards
- Process refunds
- Collect platform fees

### Step 5: Get Partner ID

Your PayPal Partner Merchant ID is required for Commerce Platform:
1. Go to **Account Settings**
2. Find **Business Information**
3. Copy the **Merchant ID**

### Step 6: Store PayPal Credentials

Add PayPal-specific fields to the platform config:

```sql
-- Note: Currently using stripe fields temporarily
-- Consider adding dedicated paypal columns to platform_payment_config

UPDATE platform_payment_config
SET 
  -- These are temporary mappings until dedicated columns exist
  stripe_connect_client_id = 'PAYPAL_CLIENT_ID',
  stripe_connect_secret_encrypted = 'PAYPAL_CLIENT_SECRET',
  stripe_platform_account_id = 'PAYPAL_PARTNER_MERCHANT_ID'
WHERE id = 'platform_main';
```

### Recommended: Add PayPal-Specific Columns

```sql
ALTER TABLE platform_payment_config
ADD COLUMN IF NOT EXISTS paypal_client_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS paypal_client_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS paypal_partner_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS paypal_webhook_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS paypal_sandbox_mode BOOLEAN DEFAULT true;
```

---

## Environment Variables

Add these to your Doppler configuration:

### Stripe Connect

```bash
# Stripe Platform Keys
STRIPE_PLATFORM_SECRET_KEY=sk_live_XXXXXXXXXXXXX
STRIPE_PLATFORM_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXX
STRIPE_CONNECT_CLIENT_ID=ca_XXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX

# Platform Account
STRIPE_PLATFORM_ACCOUNT_ID=acct_XXXXXXXXXXXXX
```

### PayPal Commerce

```bash
# PayPal Credentials
PAYPAL_CLIENT_ID=AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PAYPAL_CLIENT_SECRET=EXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PAYPAL_PARTNER_ID=XXXXXXXXXXXXXX

# PayPal Mode
PAYPAL_SANDBOX=true  # Set to false for production

# PayPal Webhook
PAYPAL_WEBHOOK_ID=XXXXXXXXXXXXXX
```

### Platform Revenue Settings

```bash
# Default platform fee percentage
DEFAULT_PLATFORM_FEE_PERCENT=2.0

# Platform URL (for webhook return URLs)
PLATFORM_URL=https://yourdomain.com
```

### Doppler Commands

```bash
# Set secrets
doppler secrets set STRIPE_PLATFORM_SECRET_KEY=sk_live_xxx
doppler secrets set STRIPE_CONNECT_CLIENT_ID=ca_xxx
doppler secrets set PAYPAL_CLIENT_ID=xxx
doppler secrets set PAYPAL_CLIENT_SECRET=xxx

# View all secrets
doppler secrets

# Import from .env file
doppler secrets upload .env
```

---

## Database Configuration

### Required Tables

Ensure these tables exist in your Supabase database:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'platform_payment_config',
  'merchant_stripe_connections',
  'merchant_paypal_connections',
  'platform_revenue_transactions',
  'platform_fee_invoices',
  'platform_fee_invoice_items'
);
```

### Sync Prisma Schema

```bash
# Pull database changes
doppler run --config local -- pnpm prisma db pull

# Generate Prisma Client
pnpm prisma generate
```

### Row Level Security (RLS)

The platform revenue tables use RLS. Ensure policies are configured:

```sql
-- Enable RLS on platform tables
ALTER TABLE platform_payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_stripe_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_paypal_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_revenue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fee_invoices ENABLE ROW LEVEL SECURITY;

-- Create admin access policy
CREATE POLICY "Admin full access on platform_payment_config"
ON platform_payment_config FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'platform_admin'
  )
);
```

---

## Webhook Configuration

### Stripe Webhooks

1. Go to **Developers** > **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter your endpoint URL:
   - Development: Use Stripe CLI (see below)
   - Production: `https://api.yourdomain.com/api/webhooks/stripe-connect`

4. Select these events:
   - `account.updated`
   - `account.application.deauthorized`
   - `charge.succeeded`
   - `transfer.created`
   - `payout.created`
   - `payout.failed`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Copy the **Signing secret** (starts with `whsec_`)

#### Local Development with Stripe CLI

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git && scoop install stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/webhooks/stripe-connect

# Copy the webhook signing secret from output
```

### PayPal Webhooks

1. Go to **My Apps & Credentials** in PayPal Developer
2. Select your app
3. Click **Add Webhook**
4. Enter URL: `https://api.yourdomain.com/api/webhooks/paypal-connect`
5. Select these events:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `MERCHANT.ONBOARDED`
   - `MERCHANT.INTEGRATION.ENABLED`

6. Copy the **Webhook ID**

### Webhook Verification

Test webhook endpoints:

```bash
# Stripe webhook test
curl -X POST https://api.yourdomain.com/api/webhooks/stripe-connect \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=xxx,v1=xxx" \
  -d '{"type": "account.updated", "data": {"object": {}}}'

# PayPal webhook test (requires OAuth token)
curl -X POST https://api.yourdomain.com/api/webhooks/paypal-connect \
  -H "Content-Type: application/json" \
  -H "PAYPAL-TRANSMISSION-SIG: xxx" \
  -d '{"event_type": "CHECKOUT.ORDER.APPROVED"}'
```

---

## Testing

### Test Stripe Connect Onboarding

1. Use Stripe CLI to create a test account:

```bash
stripe accounts create --type=express --metadata tenant_id=test_tenant
```

2. Or use the admin UI at `/settings/admin/platform-revenue`

### Test PayPal Sandbox

1. Use PayPal Sandbox accounts for testing
2. Create test merchant accounts in PayPal Developer
3. Use sandbox credentials in your configuration

### Test Fee Collection

```bash
# Create a test payment with platform fee
curl -X POST https://api.yourdomain.com/api/orders/test_order/payments/authorize \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method": "card",
    "gateway_type": "stripe"
  }'
```

### Verify Revenue Recording

```sql
-- Check recorded platform fees
SELECT * FROM platform_revenue_transactions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check merchant connections
SELECT 
  msc.tenant_id,
  msc.onboarding_status,
  msc.stripe_account_status,
  t.name as tenant_name
FROM merchant_stripe_connections msc
JOIN tenants t ON t.id = msc.tenant_id;
```

---

## Troubleshooting

### Common Issues

#### Stripe Connect Onboarding Fails

- **Cause**: Invalid redirect URLs or branding incomplete
- **Solution**: Verify OAuth redirect URLs match exactly in Stripe settings

#### Platform Fees Not Recorded

- **Cause**: Webhook not configured or revenue collection disabled
- **Solution**: 
  1. Check `revenue_collection_enabled` in `platform_payment_config`
  2. Verify webhook endpoint is receiving events
  3. Check server logs for webhook processing errors

#### PayPal Onboarding Link Not Generated

- **Cause**: PayPal Commerce Platform not approved or credentials invalid
- **Solution**:
  1. Verify PayPal Partner status is approved
  2. Check credentials are correct
  3. Ensure app has required permissions

#### Invoice Generation Fails

- **Cause**: Missing tenant Stripe customer ID
- **Solution**: Ensure tenant has `stripe_customer_id` set for billing

### Debug Commands

```bash
# Check Stripe connection status
curl -X GET https://api.yourdomain.com/api/admin/platform-revenue/config \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Check PayPal status
curl -X GET https://api.yourdomain.com/api/admin/paypal-connect/status \
  -H "Authorization: Bearer ADMIN_TOKEN"

# View recent webhooks
stripe logs --tail

# Check PayPal API access
curl -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```

### Logs to Check

```bash
# API server logs
grep -i "platformrevenue\|paypalconnect\|stripeconnect" /var/log/api.log

# Stripe webhook logs
grep -i "webhook" /var/log/api.log | grep stripe

# PayPal webhook logs
grep -i "webhook" /var/log/api.log | grep paypal
```

---

## Security Considerations

### API Key Security

- **Never** commit API keys to version control
- Use Doppler or similar secrets management
- Rotate keys periodically
- Use restricted keys with minimal permissions

### Encryption

The current implementation stores API keys directly. For production:

1. Implement encryption for sensitive fields:
   - `stripe_platform_secret_key_encrypted`
   - `stripe_webhook_secret_encrypted`
   - `paypal_client_secret_encrypted`

2. Use Supabase Vault or application-level encryption

### Webhook Security

- Always verify webhook signatures
- Reject unsigned requests
- Log all webhook events for audit

### Access Control

- Platform revenue endpoints require `platform_admin` role
- Tenant endpoints verify tenant membership
- Webhook endpoints are public but verify signatures

---

## Support Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [PayPal Commerce Platform](https://developer.paypal.com/docs/platforms/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
