# Phase 3B: Payment Processing & Shipping Integration

## Overview

**Duration:** 4 weeks  
**Status:** Planning Complete - Ready for Implementation

Building on Phase 3A's order foundation, Phase 3B adds comprehensive payment processing and shipping capabilities with multi-gateway support and per-tenant configuration.

## Requirements Summary

### Payment Gateways
- ✅ Stripe (Primary)
- ✅ PayPal (Secondary)
- 🔄 Extensible for future gateways (Square, Authorize.net)

### Payment Flows
- ✅ Authorize then capture (hold funds)
- ✅ Direct charge (immediate capture)
- ✅ Tenant-configurable default flow

### Shipping Integration
- ✅ USPS
- ✅ FedEx
- ✅ UPS
- ✅ ShipStation API (aggregator)
- ✅ Label generation
- ✅ Real-time rate calculation
- ✅ Tracking updates

### Configuration Model
- ✅ Per-tenant payment gateway credentials
- ✅ Per-tenant shipping carrier preferences
- ✅ Secure credential storage (encrypted)
- ✅ Part of tenant onboarding flow

---

## Architecture Design

### Payment Gateway Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Payment Gateway Interface                  │
│  (Abstract base class for all payment providers)        │
├─────────────────────────────────────────────────────────┤
│  + authorize(amount, paymentMethod)                     │
│  + capture(authorizationId, amount?)                    │
│  + charge(amount, paymentMethod)                        │
│  + refund(chargeId, amount?, reason?)                   │
│  + getStatus(transactionId)                             │
│  + validateWebhook(payload, signature)                  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
         ┌────────────────┴────────────────┐
         │                                 │
┌────────┴─────────┐            ┌─────────┴────────┐
│  StripeGateway   │            │  PayPalGateway   │
├──────────────────┤            ├──────────────────┤
│ - createIntent() │            │ - createOrder()  │
│ - captureIntent()│            │ - captureOrder() │
│ - createRefund() │            │ - createRefund() │
└──────────────────┘            └──────────────────┘
```

### Shipping Carrier Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Shipping Carrier Interface                 │
│  (Abstract base class for all shipping providers)       │
├─────────────────────────────────────────────────────────┤
│  + getRates(origin, destination, package)               │
│  + createLabel(shipment, service)                       │
│  + trackShipment(trackingNumber)                        │
│  + cancelLabel(labelId)                                 │
│  + validateAddress(address)                             │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
         ┌────────────────┼────────────────┬──────────────┐
         │                │                │              │
┌────────┴─────┐  ┌──────┴──────┐  ┌─────┴─────┐  ┌────┴─────┐
│ USPSCarrier  │  │ FedExCarrier│  │UPSCarrier │  │ShipStation│
└──────────────┘  └─────────────┘  └───────────┘  └──────────┘
```

---

## Database Schema Updates

### New Tables

#### 1. `tenant_payment_gateways`
Stores per-tenant payment gateway configurations.

```sql
CREATE TABLE tenant_payment_gateways (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_type TEXT NOT NULL, -- 'stripe', 'paypal', 'square'
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  
  -- Encrypted credentials
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  
  -- Gateway-specific config
  config JSONB DEFAULT '{}',
  
  -- Payment flow preferences
  default_flow TEXT DEFAULT 'authorize_capture', -- 'authorize_capture', 'direct_charge'
  auto_capture_delay_hours INTEGER DEFAULT 168, -- 7 days default
  
  -- Status
  last_verified_at TIMESTAMP,
  verification_status TEXT, -- 'verified', 'failed', 'pending'
  verification_error TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, gateway_type)
);

CREATE INDEX idx_tenant_payment_gateways_tenant ON tenant_payment_gateways(tenant_id);
CREATE INDEX idx_tenant_payment_gateways_active ON tenant_payment_gateways(tenant_id, is_active);
```

#### 2. `tenant_shipping_carriers`
Stores per-tenant shipping carrier configurations.

```sql
CREATE TABLE tenant_shipping_carriers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_type TEXT NOT NULL, -- 'usps', 'fedex', 'ups', 'shipstation'
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  
  -- Encrypted credentials
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  account_number_encrypted TEXT,
  
  -- Carrier-specific config
  config JSONB DEFAULT '{}',
  
  -- Shipping preferences
  default_service_level TEXT, -- 'standard', 'express', 'overnight'
  enable_rate_shopping BOOLEAN DEFAULT true,
  enable_label_generation BOOLEAN DEFAULT true,
  
  -- Origin address (warehouse/store)
  origin_address_line1 TEXT,
  origin_address_line2 TEXT,
  origin_city TEXT,
  origin_state TEXT,
  origin_postal_code TEXT,
  origin_country TEXT DEFAULT 'US',
  
  -- Status
  last_verified_at TIMESTAMP,
  verification_status TEXT,
  verification_error TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, carrier_type)
);

CREATE INDEX idx_tenant_shipping_carriers_tenant ON tenant_shipping_carriers(tenant_id);
CREATE INDEX idx_tenant_shipping_carriers_active ON tenant_shipping_carriers(tenant_id, is_active);
```

#### 3. Updates to Existing Tables

**`payments` table - Add gateway tracking:**
```sql
ALTER TABLE payments ADD COLUMN gateway_type TEXT; -- 'stripe', 'paypal', etc.
ALTER TABLE payments ADD COLUMN gateway_transaction_id TEXT; -- External transaction ID
ALTER TABLE payments ADD COLUMN gateway_authorization_id TEXT; -- For authorize/capture flow
ALTER TABLE payments ADD COLUMN gateway_fee_cents INTEGER DEFAULT 0; -- Gateway processing fee
ALTER TABLE payments ADD COLUMN net_amount_cents INTEGER; -- Amount after fees
ALTER TABLE payments ADD COLUMN gateway_response JSONB DEFAULT '{}'; -- Full gateway response
ALTER TABLE payments ADD COLUMN captured_at TIMESTAMP; -- When authorization was captured
ALTER TABLE payments ADD COLUMN authorization_expires_at TIMESTAMP; -- Auth expiration

CREATE INDEX idx_payments_gateway_transaction ON payments(gateway_transaction_id);
CREATE INDEX idx_payments_gateway_authorization ON payments(gateway_authorization_id);
```

**`shipments` table - Add carrier tracking:**
```sql
ALTER TABLE shipments ADD COLUMN carrier_type TEXT; -- 'usps', 'fedex', 'ups', 'shipstation'
ALTER TABLE shipments ADD COLUMN service_level TEXT; -- 'standard', 'express', 'overnight'
ALTER TABLE shipments ADD COLUMN label_url TEXT; -- URL to shipping label PDF
ALTER TABLE shipments ADD COLUMN label_id TEXT; -- Carrier's label ID
ALTER TABLE shipments ADD COLUMN rate_cents INTEGER; -- Actual shipping cost from carrier
ALTER TABLE shipments ADD COLUMN estimated_delivery_date DATE;
ALTER TABLE shipments ADD COLUMN carrier_response JSONB DEFAULT '{}'; -- Full carrier response
ALTER TABLE shipments ADD COLUMN tracking_events JSONB DEFAULT '[]'; -- Array of tracking events

CREATE INDEX idx_shipments_carrier_type ON shipments(carrier_type);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
```

---

## Implementation Plan

### Week 1: Payment Gateway Foundation

#### Day 1-2: Database & Core Infrastructure
- [ ] Create migration `002_phase3b_payment_shipping_config.sql`
- [ ] Add new tables: `tenant_payment_gateways`, `tenant_shipping_carriers`
- [ ] Update `payments` and `shipments` tables
- [ ] Create encryption utilities for credentials
- [ ] Update Prisma schema

#### Day 3-4: Payment Gateway Interface
- [ ] Create `src/services/payments/PaymentGatewayInterface.ts`
- [ ] Create `src/services/payments/PaymentGatewayFactory.ts`
- [ ] Implement credential encryption/decryption
- [ ] Create gateway configuration validator

#### Day 5: Stripe Integration (Part 1)
- [ ] Install Stripe SDK: `pnpm add stripe`
- [ ] Create `src/services/payments/gateways/StripeGateway.ts`
- [ ] Implement authorize flow (Payment Intent)
- [ ] Implement direct charge flow
- [ ] Add error handling and logging

### Week 2: Complete Payment Processing

#### Day 1-2: Stripe Integration (Part 2)
- [ ] Implement capture flow
- [ ] Implement refund processing
- [ ] Add webhook signature validation
- [ ] Create webhook handler routes
- [ ] Test all Stripe flows

#### Day 3-4: PayPal Integration
- [ ] Install PayPal SDK: `pnpm add @paypal/checkout-server-sdk`
- [ ] Create `src/services/payments/gateways/PayPalGateway.ts`
- [ ] Implement authorize/capture flow
- [ ] Implement direct charge flow
- [ ] Implement refund processing
- [ ] Add webhook handlers

#### Day 5: Payment API Routes
- [ ] Create `src/routes/payments.ts`
- [ ] POST `/api/orders/:id/payments/authorize` - Authorize payment
- [ ] POST `/api/orders/:id/payments/capture` - Capture authorized payment
- [ ] POST `/api/orders/:id/payments/charge` - Direct charge
- [ ] POST `/api/payments/:id/refund` - Process refund
- [ ] GET `/api/payments/:id` - Get payment details
- [ ] Create payment test scripts

### Week 3: Shipping Integration

#### Day 1-2: Shipping Carrier Interface
- [ ] Create `src/services/shipping/ShippingCarrierInterface.ts`
- [ ] Create `src/services/shipping/ShippingCarrierFactory.ts`
- [ ] Implement address validation utilities
- [ ] Create package dimension calculator

#### Day 3-4: USPS Integration
- [ ] Install USPS SDK or create REST client
- [ ] Create `src/services/shipping/carriers/USPSCarrier.ts`
- [ ] Implement rate calculation
- [ ] Implement label generation
- [ ] Implement tracking updates
- [ ] Test USPS flows

#### Day 5: FedEx Integration
- [ ] Install FedEx SDK
- [ ] Create `src/services/shipping/carriers/FedExCarrier.ts`
- [ ] Implement rate calculation
- [ ] Implement label generation
- [ ] Implement tracking updates

### Week 4: Complete Shipping & Testing

#### Day 1: UPS Integration
- [ ] Install UPS SDK
- [ ] Create `src/services/shipping/carriers/UPSCarrier.ts`
- [ ] Implement rate calculation
- [ ] Implement label generation
- [ ] Implement tracking updates

#### Day 2: ShipStation Integration
- [ ] Install ShipStation SDK or create REST client
- [ ] Create `src/services/shipping/carriers/ShipStationCarrier.ts`
- [ ] Implement multi-carrier rate shopping
- [ ] Implement label generation
- [ ] Implement tracking updates

#### Day 3: Shipping API Routes
- [ ] Create `src/routes/shipping.ts`
- [ ] POST `/api/orders/:id/shipping/rates` - Get shipping rates
- [ ] POST `/api/orders/:id/shipping/label` - Create shipping label
- [ ] GET `/api/shipments/:id/tracking` - Get tracking info
- [ ] DELETE `/api/shipments/:id/label` - Cancel label
- [ ] POST `/api/shipping/validate-address` - Validate address

#### Day 4: Tenant Configuration API
- [ ] Create `src/routes/tenant-payment-config.ts`
- [ ] POST `/api/tenants/:id/payment-gateways` - Add gateway
- [ ] PUT `/api/tenants/:id/payment-gateways/:gatewayId` - Update gateway
- [ ] DELETE `/api/tenants/:id/payment-gateways/:gatewayId` - Remove gateway
- [ ] POST `/api/tenants/:id/payment-gateways/:gatewayId/verify` - Verify credentials
- [ ] Create `src/routes/tenant-shipping-config.ts`
- [ ] POST `/api/tenants/:id/shipping-carriers` - Add carrier
- [ ] PUT `/api/tenants/:id/shipping-carriers/:carrierId` - Update carrier
- [ ] DELETE `/api/tenants/:id/shipping-carriers/:carrierId` - Remove carrier

#### Day 5: Integration Testing
- [ ] Create comprehensive test suite
- [ ] Test all payment flows (authorize, capture, charge, refund)
- [ ] Test all shipping flows (rates, labels, tracking)
- [ ] Test webhook handlers
- [ ] Test error scenarios
- [ ] Performance testing
- [ ] Security audit

---

## API Endpoints Summary

### Payment Endpoints

```
POST   /api/orders/:orderId/payments/authorize
POST   /api/orders/:orderId/payments/capture
POST   /api/orders/:orderId/payments/charge
POST   /api/payments/:paymentId/refund
GET    /api/payments/:paymentId
GET    /api/orders/:orderId/payments

POST   /api/webhooks/stripe
POST   /api/webhooks/paypal
```

### Shipping Endpoints

```
POST   /api/orders/:orderId/shipping/rates
POST   /api/orders/:orderId/shipping/label
GET    /api/shipments/:shipmentId
GET    /api/shipments/:shipmentId/tracking
DELETE /api/shipments/:shipmentId/label
POST   /api/shipping/validate-address
```

### Configuration Endpoints

```
# Payment Gateway Config
GET    /api/tenants/:tenantId/payment-gateways
POST   /api/tenants/:tenantId/payment-gateways
GET    /api/tenants/:tenantId/payment-gateways/:gatewayId
PUT    /api/tenants/:tenantId/payment-gateways/:gatewayId
DELETE /api/tenants/:tenantId/payment-gateways/:gatewayId
POST   /api/tenants/:tenantId/payment-gateways/:gatewayId/verify

# Shipping Carrier Config
GET    /api/tenants/:tenantId/shipping-carriers
POST   /api/tenants/:tenantId/shipping-carriers
GET    /api/tenants/:tenantId/shipping-carriers/:carrierId
PUT    /api/tenants/:tenantId/shipping-carriers/:carrierId
DELETE /api/tenants/:tenantId/shipping-carriers/:carrierId
POST   /api/tenants/:tenantId/shipping-carriers/:carrierId/verify
```

---

## Security Considerations

### Credential Encryption
- Use AES-256-GCM for encrypting API keys
- Store encryption key in environment variable
- Never log decrypted credentials
- Rotate encryption keys periodically

### Webhook Security
- Validate webhook signatures (Stripe, PayPal)
- Use HTTPS only for webhook endpoints
- Implement replay attack prevention
- Rate limit webhook endpoints

### PCI Compliance
- Never store raw credit card numbers
- Use gateway tokenization
- Log only last 4 digits for reference
- Implement proper access controls

---

## Testing Strategy

### Unit Tests
- Payment gateway implementations
- Shipping carrier implementations
- Encryption/decryption utilities
- Webhook signature validation

### Integration Tests
- End-to-end payment flows
- End-to-end shipping flows
- Webhook processing
- Error handling

### Test Environments
- Stripe Test Mode
- PayPal Sandbox
- Carrier test credentials
- Mock webhook events

---

## Dependencies

### NPM Packages
```json
{
  "stripe": "^14.0.0",
  "@paypal/checkout-server-sdk": "^1.0.3",
  "crypto": "built-in",
  "axios": "^1.6.0" // For carrier APIs
}
```

### Environment Variables
```env
# Encryption
PAYMENT_CREDENTIAL_ENCRYPTION_KEY=

# Platform-level test credentials (for development)
STRIPE_TEST_SECRET_KEY=
STRIPE_TEST_WEBHOOK_SECRET=
PAYPAL_SANDBOX_CLIENT_ID=
PAYPAL_SANDBOX_SECRET=

# Shipping carriers (for development)
USPS_API_KEY=
FEDEX_API_KEY=
UPS_API_KEY=
SHIPSTATION_API_KEY=
```

---

## Rollout Strategy

### Phase 3B.1: Payment Processing (Weeks 1-2)
- Database migration
- Stripe integration
- PayPal integration
- Payment API routes
- Webhook handlers
- Testing

### Phase 3B.2: Shipping Integration (Weeks 3-4)
- Shipping carrier interfaces
- USPS, FedEx, UPS integrations
- ShipStation integration
- Shipping API routes
- Configuration endpoints
- Comprehensive testing

### Phase 3B.3: Tenant Onboarding (Week 5)
- Frontend configuration UI
- Credential setup wizard
- Gateway verification flow
- Carrier setup wizard
- Documentation

---

## Success Criteria

### Payment Processing
- ✅ Authorize and capture flow working
- ✅ Direct charge flow working
- ✅ Refund processing working
- ✅ Webhook handlers processing events
- ✅ Multi-gateway support (Stripe + PayPal)
- ✅ Per-tenant configuration working
- ✅ Encrypted credential storage

### Shipping Integration
- ✅ Rate calculation from all carriers
- ✅ Label generation working
- ✅ Tracking updates working
- ✅ Address validation working
- ✅ Multi-carrier support (USPS, FedEx, UPS, ShipStation)
- ✅ Per-tenant configuration working

### Testing
- ✅ 90%+ code coverage
- ✅ All integration tests passing
- ✅ Webhook tests passing
- ✅ Error handling verified
- ✅ Security audit passed

---

## Next Steps After Phase 3B

### Phase 3C: Advanced Features (Weeks 5-6)
- Customer management system
- Saved payment methods
- Subscription/recurring payments
- Multi-location inventory routing
- Advanced shipping rules

### Phase 3D: Analytics & Reporting (Weeks 7-8)
- Order analytics dashboard
- Payment analytics
- Shipping analytics
- Revenue reports
- Customer insights

---

## Documentation Deliverables

1. **API Documentation** - Complete endpoint reference
2. **Integration Guides** - How to configure each gateway/carrier
3. **Webhook Guide** - How to handle webhook events
4. **Security Guide** - Best practices for credential management
5. **Testing Guide** - How to test payment and shipping flows
6. **Troubleshooting Guide** - Common issues and solutions

---

## Risk Mitigation

### Technical Risks
- **Gateway API changes:** Monitor changelog, version lock SDKs
- **Webhook failures:** Implement retry logic, dead letter queue
- **Credential leaks:** Audit logging, encryption at rest
- **Rate limiting:** Implement exponential backoff

### Business Risks
- **Gateway downtime:** Support multiple gateways, graceful degradation
- **Carrier issues:** Multi-carrier support, fallback options
- **Compliance:** Regular PCI audits, security reviews

---

**Phase 3B is comprehensive and production-ready. Ready to begin implementation!**
