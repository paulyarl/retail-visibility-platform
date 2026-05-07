# Payment Testing Setup Guide

## Current Status

✅ **Payment API Routes:** Fully implemented  
✅ **Payment Gateway Factory:** Working  
✅ **Platform Fee Calculator:** Working  
✅ **Database Schema:** Complete  
⚠️ **Stripe Test Credentials:** Need valid API keys

## Issue: Expired Stripe Test Key

The test Stripe API key in the setup script has expired. You need to get valid test credentials from your Stripe account.

## How to Get Stripe Test Credentials

### 1. Sign up for Stripe (if you don't have an account)
- Go to https://dashboard.stripe.com/register
- Create a free account

### 2. Get Test API Keys
1. Log in to https://dashboard.stripe.com
2. Make sure you're in **Test Mode** (toggle in top right)
3. Go to **Developers** → **API keys**
4. Copy your test keys:
   - **Publishable key:** `pk_test_...`
   - **Secret key:** `sk_test_...` (click "Reveal test key")

### 3. Update the Database

Run this SQL with your actual Stripe test keys:

```sql
-- Delete existing gateway
DELETE FROM tenant_payment_gateways 
WHERE tenant_id = 'tid-m8ijkrnk' AND gateway_type = 'stripe';

-- Insert with YOUR Stripe test keys
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
    'tpg_stripe_' || extract(epoch from now())::bigint,
    'tid-m8ijkrnk',
    'stripe',
    true,
    true,
    encode('YOUR_PUBLISHABLE_KEY_HERE'::bytea, 'base64'),  -- pk_test_...
    encode('YOUR_SECRET_KEY_HERE'::bytea, 'base64'),       -- sk_test_...
    jsonb_build_object(
        'testMode', true,
        'webhookSecret', null,
        'apiVersion', '2025-10-29.clover'
    ),
    'authorize_capture',
    'verified',
    now(),
    now()
);

-- Verify
SELECT 
    id,
    gateway_type,
    is_active,
    config->>'testMode' as test_mode
FROM tenant_payment_gateways
WHERE tenant_id = 'tid-m8ijkrnk';
```

### 4. Run Payment Tests

```powershell
cd c:\Users\pauly\Documents\Windsurf Projects\RVP\retail-visibility-platform\apps\api\src\routes
.\test-payments.ps1
```

## Alternative: Use Stripe CLI for Testing

If you want to test without a Stripe account, you can use the Stripe CLI:

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Get test keys
stripe keys list
```

## What the Tests Will Do

1. ✅ Create test order ($50)
2. ✅ Authorize payment (hold funds for 7 days)
3. ✅ Get payment details
4. ✅ Capture authorized payment
5. ✅ Create second order ($50)
6. ✅ Direct charge (immediate payment)
7. ✅ Process partial refund ($25)
8. ✅ Get all payments for order

## Expected Results

```
✅ Order created successfully
✅ Payment authorized successfully
   Gateway Fee: $1.76 (2.9% + $0.30)
   Platform Fee: $0.75 (1.5% for Professional tier)
   Net to Merchant: $47.49
✅ Payment captured successfully
✅ Direct charge successful
✅ Partial refund processed
```

## Fee Breakdown Example

For a $50.00 transaction:
- **Transaction Amount:** $50.00 (5000 cents)
- **Stripe Fee:** $1.76 (2.9% + $0.30)
- **Platform Fee:** $0.75 (1.5% for Professional tier)
- **Total Fees:** $2.51
- **Net to Merchant:** $47.49

## Troubleshooting

### Error: "Expired API Key"
- Get new test keys from Stripe dashboard
- Update the database with new keys

### Error: "No active payment gateway configured"
- Run the SQL insert script above
- Verify with: `SELECT * FROM tenant_payment_gateways WHERE tenant_id = 'tid-m8ijkrnk';`

### Error: "This API call cannot be made with a publishable API key"
- Make sure you're using the **secret key** (sk_test_...) not the publishable key
- The setup script should have them in the correct order

### Error: "Encryption key not configured"
- This is normal for testing - we use base64 encoding instead
- For production, set `PAYMENT_CREDENTIAL_ENCRYPTION_KEY` environment variable

## Next Steps After Testing

Once payment tests pass:

1. **Webhook Handlers** - Handle Stripe payment events
2. **Frontend Integration** - Add payment UI
3. **Production Setup** - Use real encryption for credentials
4. **PayPal Integration** - Fix SDK method names
5. **Admin Dashboard** - Fee management UI

## Production Deployment Checklist

Before going to production:

- [ ] Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Set `PAYMENT_CREDENTIAL_ENCRYPTION_KEY` environment variable
- [ ] Use live Stripe keys (not test keys)
- [ ] Set up webhook endpoints
- [ ] Configure webhook secrets
- [ ] Test with real payment methods
- [ ] Set up monitoring and alerts
- [ ] Review PCI compliance requirements

---

**Status:** Ready for testing with valid Stripe credentials  
**Documentation:** Complete  
**Next:** Get Stripe test keys and run tests
