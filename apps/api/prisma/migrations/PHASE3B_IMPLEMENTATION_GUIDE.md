# Phase 3B Implementation Guide

## Quick Start

This guide walks you through implementing Phase 3B: Payment Processing & Shipping Integration.

---

## Step 1: Run Database Migration

### Execute Migration SQL

```bash
# Connect to your database
psql -h your-host -U your-user -d your-database -f 002_phase3b_payment_shipping_config.sql
```

### Verify Migration

```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('tenant_payment_gateways', 'tenant_shipping_carriers');

-- Check payments table updates
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'payments' 
AND column_name IN ('gateway_type', 'gateway_transaction_id', 'gateway_authorization_id');

-- Check shipments table updates
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'shipments' 
AND column_name IN ('carrier_type', 'service_level', 'label_url');
```

---

## Step 2: Update Prisma Schema

Add these models to `apps/api/prisma/schema.prisma`:

```prisma
// ============================================================================
// PHASE 3B: PAYMENT & SHIPPING CONFIGURATION
// ============================================================================

model tenant_payment_gateways {
  id                       String    @id
  tenant_id                String
  gateway_type             String    // 'stripe', 'paypal', 'square'
  is_active                Boolean   @default(false)
  is_default               Boolean   @default(false)
  
  // Encrypted credentials
  api_key_encrypted        String?
  api_secret_encrypted     String?
  webhook_secret_encrypted String?
  
  // Configuration
  config                   Json      @default("{}")
  
  // Payment flow preferences
  default_flow             String    @default("authorize_capture")
  auto_capture_delay_hours Int       @default(168)
  
  // Verification
  last_verified_at         DateTime?
  verification_status      String?
  verification_error       String?
  
  // Metadata
  metadata                 Json      @default("{}")
  created_at               DateTime  @default(now())
  updated_at               DateTime  @updatedAt
  
  // Relations
  tenants                  tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  
  @@unique([tenant_id, gateway_type])
  @@index([tenant_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, is_default])
  @@index([gateway_type])
  @@map("tenant_payment_gateways")
}

model tenant_shipping_carriers {
  id                       String    @id
  tenant_id                String
  carrier_type             String    // 'usps', 'fedex', 'ups', 'shipstation'
  is_active                Boolean   @default(false)
  is_default               Boolean   @default(false)
  
  // Encrypted credentials
  api_key_encrypted        String?
  api_secret_encrypted     String?
  account_number_encrypted String?
  
  // Configuration
  config                   Json      @default("{}")
  
  // Shipping preferences
  default_service_level    String?
  enable_rate_shopping     Boolean   @default(true)
  enable_label_generation  Boolean   @default(true)
  
  // Origin address
  origin_address_line1     String?
  origin_address_line2     String?
  origin_city              String?
  origin_state             String?
  origin_postal_code       String?
  origin_country           String?   @default("US")
  origin_phone             String?
  
  // Verification
  last_verified_at         DateTime?
  verification_status      String?
  verification_error       String?
  
  // Metadata
  metadata                 Json      @default("{}")
  created_at               DateTime  @default(now())
  updated_at               DateTime  @updatedAt
  
  // Relations
  tenants                  tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  
  @@unique([tenant_id, carrier_type])
  @@index([tenant_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, is_default])
  @@index([carrier_type])
  @@map("tenant_shipping_carriers")
}
```

### Update Existing Models

Add to `tenants` model:
```prisma
model tenants {
  // ... existing fields ...
  
  // Phase 3B relations
  payment_gateways  tenant_payment_gateways[]
  shipping_carriers tenant_shipping_carriers[]
}
```

Update `payments` model:
```prisma
model payments {
  // ... existing fields ...
  
  // Phase 3B: Gateway tracking
  gateway_type              String?
  gateway_transaction_id    String?
  gateway_authorization_id  String?
  gateway_fee_cents         Int?      @default(0)
  net_amount_cents          Int?
  gateway_response          Json?     @default("{}")
  captured_at               DateTime?
  authorization_expires_at  DateTime?
  
  @@index([gateway_transaction_id])
  @@index([gateway_authorization_id])
  @@index([gateway_type])
}
```

Update `shipments` model:
```prisma
model shipments {
  // ... existing fields ...
  
  // Phase 3B: Carrier tracking
  carrier_type             String?
  service_level            String?
  label_url                String?
  label_id                 String?
  rate_cents               Int?
  estimated_delivery_date  DateTime?
  carrier_response         Json?     @default("{}")
  tracking_events          Json?     @default("[]")
  
  @@index([carrier_type])
  @@index([tracking_number])
  @@index([label_id])
}
```

### Generate Prisma Client

```bash
cd apps/api
pnpm prisma generate
```

---

## Step 3: Install Dependencies

```bash
cd apps/api

# Payment gateways
pnpm add stripe
pnpm add @paypal/checkout-server-sdk

# Utilities
pnpm add axios  # For carrier APIs
```

---

## Step 4: Set Up Environment Variables

Add to `apps/api/.env`:

```env
# ============================================================================
# PHASE 3B: PAYMENT & SHIPPING CONFIGURATION
# ============================================================================

# Credential Encryption
PAYMENT_CREDENTIAL_ENCRYPTION_KEY=your-32-byte-hex-key-here

# Stripe (for development/testing)
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...

# PayPal Sandbox (for development/testing)
PAYPAL_SANDBOX_CLIENT_ID=...
PAYPAL_SANDBOX_SECRET=...

# Shipping Carriers (for development/testing)
USPS_API_KEY=...
FEDEX_API_KEY=...
UPS_API_KEY=...
SHIPSTATION_API_KEY=...
```

### Generate Encryption Key

```bash
# Generate a secure 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 5: Create Core Infrastructure

### 5.1 Encryption Utility

Create `apps/api/src/utils/credential-encryption.ts`:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('PAYMENT_CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

export function encryptCredential(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCredential(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format');
  }
  
  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 5.2 Payment Gateway Interface

Create `apps/api/src/services/payments/PaymentGatewayInterface.ts`:

```typescript
export interface PaymentMethod {
  type: 'card' | 'bank_account' | 'paypal' | 'other';
  token?: string;
  details?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  authorizationId?: string;
  amount: number;
  currency: string;
  status: 'authorized' | 'captured' | 'failed' | 'pending';
  gatewayResponse: Record<string, any>;
  error?: string;
  feeCents?: number;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  gatewayResponse: Record<string, any>;
  error?: string;
}

export abstract class PaymentGatewayInterface {
  protected credentials: {
    apiKey: string;
    apiSecret?: string;
    webhookSecret?: string;
  };
  
  constructor(credentials: any) {
    this.credentials = credentials;
  }
  
  // Authorize payment (hold funds)
  abstract authorize(
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    metadata?: Record<string, any>
  ): Promise<PaymentResult>;
  
  // Capture authorized payment
  abstract capture(
    authorizationId: string,
    amount?: number
  ): Promise<PaymentResult>;
  
  // Direct charge (authorize + capture)
  abstract charge(
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    metadata?: Record<string, any>
  ): Promise<PaymentResult>;
  
  // Refund payment
  abstract refund(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult>;
  
  // Get payment status
  abstract getStatus(transactionId: string): Promise<PaymentResult>;
  
  // Validate webhook signature
  abstract validateWebhook(
    payload: string | Buffer,
    signature: string
  ): boolean;
}
```

---

## Step 6: Implementation Checklist

### Week 1: Payment Gateway Foundation
- [ ] Run database migration
- [ ] Update Prisma schema
- [ ] Generate Prisma client
- [ ] Create encryption utility
- [ ] Create payment gateway interface
- [ ] Create payment gateway factory
- [ ] Implement Stripe gateway (authorize, capture, charge)
- [ ] Test Stripe integration

### Week 2: Complete Payment Processing
- [ ] Implement Stripe refunds
- [ ] Implement Stripe webhooks
- [ ] Implement PayPal gateway
- [ ] Create payment API routes
- [ ] Create payment test scripts
- [ ] Test all payment flows

### Week 3: Shipping Integration
- [ ] Create shipping carrier interface
- [ ] Implement USPS carrier
- [ ] Implement FedEx carrier
- [ ] Test carrier integrations

### Week 4: Complete Shipping & Configuration
- [ ] Implement UPS carrier
- [ ] Implement ShipStation carrier
- [ ] Create shipping API routes
- [ ] Create configuration API routes
- [ ] Create comprehensive test suite
- [ ] Security audit

---

## Step 7: Testing

### Payment Testing

```bash
# Set test credentials
export STRIPE_TEST_SECRET_KEY=sk_test_...

# Run payment tests
pnpm test:payments
```

### Shipping Testing

```bash
# Set test credentials
export USPS_API_KEY=...

# Run shipping tests
pnpm test:shipping
```

---

## Step 8: Documentation

Create the following documentation:
1. API endpoint reference
2. Gateway configuration guide
3. Carrier configuration guide
4. Webhook setup guide
5. Security best practices
6. Troubleshooting guide

---

## Next Steps

After completing Phase 3B:
1. Deploy to staging environment
2. Test with real credentials (test mode)
3. Create frontend configuration UI
4. Add to tenant onboarding flow
5. Move to Phase 3C (Advanced Features)

---

## Support & Resources

### Stripe Documentation
- https://stripe.com/docs/api
- https://stripe.com/docs/payments/payment-intents
- https://stripe.com/docs/webhooks

### PayPal Documentation
- https://developer.paypal.com/docs/api/overview/
- https://developer.paypal.com/docs/checkout/

### Shipping Carrier Documentation
- USPS: https://www.usps.com/business/web-tools-apis/
- FedEx: https://developer.fedex.com/
- UPS: https://www.ups.com/upsdeveloperkit
- ShipStation: https://www.shipstation.com/docs/api/

---

**Ready to begin Phase 3B implementation!**
