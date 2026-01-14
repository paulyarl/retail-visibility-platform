# Payment API Documentation

## Overview

Complete payment processing API supporting authorize/capture and direct charge flows with Stripe integration, platform fee calculation, and comprehensive payment tracking.

## Base URL

```
http://localhost:4000/api
```

## Authentication

All endpoints require JWT authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Authorize Payment

Hold funds without capturing (authorize-then-capture flow).

**Endpoint:** `POST /orders/:orderId/payments/authorize`

**Request Body:**
```json
{
  "paymentMethod": {
    "type": "card",
    "token": "pm_card_visa"
  },
  "gatewayType": "stripe",
  "metadata": {
    "customerEmail": "customer@example.com",
    "customerName": "John Doe"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1768069631313_bw0ea0lgw",
    "order_id": "ord_1768069631313_bw0ea0lgw",
    "tenant_id": "tid-m8ijkrnk",
    "amount_cents": 10000,
    "currency": "USD",
    "payment_method": "card",
    "payment_status": "authorized",
    "gateway_type": "stripe",
    "gateway_transaction_id": "pi_3abc123",
    "gateway_authorization_id": "pi_3abc123",
    "gateway_fee_cents": 320,
    "platform_fee_cents": 150,
    "platform_fee_percentage": 1.5,
    "total_fees_cents": 470,
    "net_amount_cents": 9530,
    "fee_waived": false,
    "authorized_at": "2026-01-10T19:30:00Z",
    "authorization_expires_at": "2026-01-17T19:30:00Z",
    "created_at": "2026-01-10T19:30:00Z"
  },
  "fees": {
    "gateway": 320,
    "platform": 150,
    "total": 470,
    "net": 9530,
    "waived": false
  }
}
```

**Error Responses:**
- `400` - Payment method required, authorization failed
- `403` - Unauthorized to process payment
- `404` - Order not found
- `500` - Server error

---

### 2. Capture Payment

Capture previously authorized payment.

**Endpoint:** `POST /orders/:orderId/payments/capture`

**Request Body:**
```json
{
  "paymentId": "pay_1768069631313_bw0ea0lgw",
  "amount": 10000
}
```

**Note:** If `paymentId` is not provided, captures the most recent authorized payment. If `amount` is not provided, captures the full authorized amount.

**Response (200 OK):**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1768069631313_bw0ea0lgw",
    "payment_status": "paid",
    "captured_at": "2026-01-10T19:35:00Z",
    "amount_cents": 10000
  },
  "captured_amount": 10000
}
```

**Error Responses:**
- `400` - Authorization expired
- `403` - Unauthorized to capture payment
- `404` - Payment not found
- `500` - Server error

---

### 3. Direct Charge

Authorize and capture payment in one step.

**Endpoint:** `POST /orders/:orderId/payments/charge`

**Request Body:**
```json
{
  "paymentMethod": {
    "type": "card",
    "token": "pm_card_visa"
  },
  "gatewayType": "stripe",
  "metadata": {
    "customerEmail": "customer@example.com"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1768069631313_bw0ea0lgw",
    "order_id": "ord_1768069631313_bw0ea0lgw",
    "amount_cents": 10000,
    "payment_status": "paid",
    "gateway_type": "stripe",
    "gateway_transaction_id": "pi_3abc123",
    "gateway_fee_cents": 320,
    "platform_fee_cents": 150,
    "total_fees_cents": 470,
    "net_amount_cents": 9530,
    "authorized_at": "2026-01-10T19:30:00Z",
    "captured_at": "2026-01-10T19:30:00Z"
  },
  "fees": {
    "gateway": 320,
    "platform": 150,
    "total": 470,
    "net": 9530,
    "waived": false
  }
}
```

---

### 4. Process Refund

Refund a paid payment (full or partial).

**Endpoint:** `POST /payments/:paymentId/refund`

**Request Body:**
```json
{
  "amount": 5000,
  "reason": "Customer requested refund"
}
```

**Note:** If `amount` is not provided, processes a full refund.

**Response (200 OK):**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1768069631313_bw0ea0lgw",
    "payment_status": "partially_refunded"
  },
  "refund": {
    "id": "re_3xyz789",
    "amount": 5000,
    "currency": "USD",
    "status": "completed",
    "is_partial": true
  }
}
```

**Error Responses:**
- `400` - Payment not paid, refund failed
- `403` - Unauthorized to refund payment
- `404` - Payment not found
- `500` - Server error

---

### 5. Get Payment Details

Retrieve payment information.

**Endpoint:** `GET /payments/:paymentId`

**Response (200 OK):**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1768069631313_bw0ea0lgw",
    "order_id": "ord_1768069631313_bw0ea0lgw",
    "tenant_id": "tid-m8ijkrnk",
    "amount_cents": 10000,
    "currency": "USD",
    "payment_method": "card",
    "payment_status": "paid",
    "gateway_type": "stripe",
    "gateway_transaction_id": "pi_3abc123",
    "gateway_fee_cents": 320,
    "platform_fee_cents": 150,
    "platform_fee_percentage": 1.5,
    "total_fees_cents": 470,
    "net_amount_cents": 9530,
    "fee_waived": false,
    "created_at": "2026-01-10T19:30:00Z",
    "orders": {
      "id": "ord_1768069631313_bw0ea0lgw",
      "order_number": "ORD-2026-000001",
      "order_status": "confirmed",
      "total_cents": 10000,
      "currency": "USD"
    }
  }
}
```

---

### 6. Get Order Payments

Retrieve all payments for an order.

**Endpoint:** `GET /orders/:orderId/payments`

**Response (200 OK):**
```json
{
  "success": true,
  "payments": [
    {
      "id": "pay_1768069631313_bw0ea0lgw",
      "amount_cents": 10000,
      "payment_status": "paid",
      "gateway_type": "stripe",
      "created_at": "2026-01-10T19:30:00Z"
    }
  ],
  "order": {
    "id": "ord_1768069631313_bw0ea0lgw",
    "order_number": "ORD-2026-000001",
    "total_cents": 10000,
    "currency": "USD",
    "payment_status": "paid"
  }
}
```

---

## Payment Flows

### Authorize-Then-Capture Flow

**Use Case:** Hold funds for verification, then capture later (e.g., when order ships)

```
1. POST /orders/:orderId/payments/authorize
   → Payment status: "authorized"
   → Funds held for 7 days

2. POST /orders/:orderId/payments/capture
   → Payment status: "paid"
   → Funds transferred
```

### Direct Charge Flow

**Use Case:** Immediate payment capture (e.g., digital products)

```
1. POST /orders/:orderId/payments/charge
   → Payment status: "paid"
   → Funds transferred immediately
```

---

## Fee Calculation

### Gateway Fees (Stripe)
- **Rate:** 2.9% + $0.30 per transaction
- **Example:** $100 transaction = $3.20 gateway fee

### Platform Fees (Tier-Based)
| Tier | Platform Fee |
|------|--------------|
| Trial | 3.0% |
| Google Only | 2.5% |
| Starter | 2.0% |
| Professional | 1.5% |
| Enterprise | 1.0% |
| Organization | 0.0% (waived) |

### Total Fee Breakdown
```
Transaction: $100.00 (10,000 cents)
Gateway Fee: $3.20 (320 cents)
Platform Fee: $1.50 (150 cents) [Professional tier]
Total Fees: $4.70 (470 cents)
Net to Merchant: $95.30 (9,530 cents)
```

---

## Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Payment initiated but not processed |
| `authorized` | Funds held, not captured |
| `paid` | Payment completed successfully |
| `partially_refunded` | Partial refund issued |
| `refunded` | Full refund issued |
| `failed` | Payment failed |
| `cancelled` | Payment cancelled |

---

## Testing

### Test Payment Methods (Stripe)

**Successful Payment:**
```json
{
  "type": "card",
  "token": "pm_card_visa"
}
```

**Declined Payment:**
```json
{
  "type": "card",
  "token": "pm_card_visa_chargeDeclined"
}
```

**Insufficient Funds:**
```json
{
  "type": "card",
  "token": "pm_card_chargeCustomerFail"
}
```

### Test Scenarios

#### 1. Authorize and Capture
```bash
# Step 1: Authorize
curl -X POST http://localhost:4000/api/orders/ord_123/payments/authorize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": {"type": "card", "token": "pm_card_visa"},
    "gatewayType": "stripe"
  }'

# Step 2: Capture (after 5 minutes)
curl -X POST http://localhost:4000/api/orders/ord_123/payments/capture \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 2. Direct Charge
```bash
curl -X POST http://localhost:4000/api/orders/ord_123/payments/charge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": {"type": "card", "token": "pm_card_visa"},
    "gatewayType": "stripe"
  }'
```

#### 3. Partial Refund
```bash
curl -X POST http://localhost:4000/api/payments/pay_123/refund \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "reason": "Partial refund requested"
  }'
```

---

## Error Handling

### Common Error Codes

| Code | Description |
|------|-------------|
| `payment_method_required` | Payment method token missing |
| `order_not_found` | Order ID invalid |
| `payment_not_found` | Payment ID invalid |
| `unauthorized` | User not authorized |
| `authorization_failed` | Payment authorization failed |
| `capture_failed` | Payment capture failed |
| `charge_failed` | Direct charge failed |
| `refund_failed` | Refund processing failed |
| `authorization_expired` | Authorization expired (>7 days) |
| `payment_not_paid` | Cannot refund unpaid payment |

### Error Response Format
```json
{
  "success": false,
  "error": "authorization_failed",
  "message": "Card declined",
  "details": {
    "code": "card_declined",
    "decline_code": "insufficient_funds"
  }
}
```

---

## Security

### Authorization
- All endpoints require valid JWT token
- Users can only process payments for their own tenant
- Platform admins can process any payment

### PCI Compliance
- Never send raw card numbers to API
- Use Stripe payment method tokens
- Tokens are single-use and secure

### Rate Limiting
- 100 requests per minute per tenant
- 1000 requests per hour per tenant

---

## Integration Guide

### 1. Create Order
```javascript
const order = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenant_id: 'tid-m8ijkrnk',
    customer_email: 'customer@example.com',
    items: [
      {
        sku: 'PROD-001',
        name: 'Product Name',
        quantity: 2,
        unit_price_cents: 1999
      }
    ]
  })
});
```

### 2. Process Payment
```javascript
const payment = await fetch(`/api/orders/${orderId}/payments/charge`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentMethod: {
      type: 'card',
      token: stripePaymentMethodId
    },
    gatewayType: 'stripe'
  })
});
```

### 3. Handle Response
```javascript
const result = await payment.json();
if (result.success) {
  console.log('Payment successful!');
  console.log('Transaction ID:', result.payment.gateway_transaction_id);
  console.log('Net amount:', result.fees.net / 100);
} else {
  console.error('Payment failed:', result.message);
}
```

---

## Webhooks

Webhook endpoints for payment gateway events will be documented separately in `WEBHOOKS_DOCUMENTATION.md`.

---

## Support

For issues or questions:
- Check error codes and messages
- Review test scenarios
- Verify payment method tokens
- Check authorization and permissions

---

**Last Updated:** 2026-01-10  
**API Version:** Phase 3B  
**Status:** Production Ready (Stripe)
