# Orders API Documentation
**Phase 3A: Order Management Foundation**

## Overview
The Orders API provides endpoints for creating and managing orders in the Visible Shelf platform. Orders support optional payment processing, allowing tenants to use the platform for order tracking without payment integration if desired.

## Base URL
```
/api/orders
```

## Authentication
All endpoints require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Create Order
**POST** `/api/orders`

Create a new order (cart checkout).

#### Request Body
```json
{
  "tenant_id": "tid-abc123",
  "customer": {
    "email": "customer@example.com",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "items": [
    {
      "inventory_item_id": "item_123",
      "sku": "SKU-001",
      "name": "Product Name",
      "description": "Product description",
      "quantity": 2,
      "unit_price_cents": 1999,
      "discount_cents": 0
    }
  ],
  "shipping_address": {
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "billing_address": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "shipping_cents": 500,
  "discount_cents": 0,
  "notes": "Please deliver after 5pm",
  "source": "web",
  "metadata": {}
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "order": {
    "id": "ord_1234567890_abc",
    "tenant_id": "tid-abc123",
    "order_number": "ORD-2024-000001",
    "order_status": "draft",
    "payment_status": "pending",
    "fulfillment_status": "unfulfilled",
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "subtotal_cents": 3998,
    "tax_cents": 0,
    "shipping_cents": 500,
    "discount_cents": 0,
    "total_cents": 4498,
    "currency": "USD",
    "created_at": "2024-01-10T12:00:00Z",
    "order_items": [
      {
        "id": "item_1234567890_xyz",
        "sku": "SKU-001",
        "name": "Product Name",
        "quantity": 2,
        "unit_price_cents": 1999,
        "total_cents": 3998
      }
    ],
    "order_status_history": [
      {
        "id": "hist_1234567890_def",
        "from_status": null,
        "to_status": "draft",
        "changed_by_name": "user@example.com",
        "reason": "Order created",
        "created_at": "2024-01-10T12:00:00Z"
      }
    ]
  }
}
```

---

### 2. List Orders
**GET** `/api/orders`

List orders with filtering and pagination.

#### Query Parameters
- `tenant_id` (required): Tenant ID
- `status`: Filter by order status (draft, confirmed, paid, processing, shipped, delivered, cancelled, refunded)
- `payment_status`: Filter by payment status (pending, authorized, paid, refunded, failed, cancelled)
- `customer_email`: Filter by customer email (partial match)
- `from_date`: Filter orders created after this date (ISO 8601)
- `to_date`: Filter orders created before this date (ISO 8601)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

#### Example Request
```
GET /api/orders?tenant_id=tid-abc123&status=paid&page=1&limit=20
```

#### Response (200 OK)
```json
{
  "success": true,
  "orders": [
    {
      "id": "ord_1234567890_abc",
      "order_number": "ORD-2024-000001",
      "order_status": "paid",
      "payment_status": "paid",
      "customer_email": "customer@example.com",
      "total_cents": 4498,
      "created_at": "2024-01-10T12:00:00Z",
      "order_items": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### 3. Get Order Details
**GET** `/api/orders/:id`

Get complete order details including items, payments, shipments, and history.

#### Example Request
```
GET /api/orders/ord_1234567890_abc
```

#### Response (200 OK)
```json
{
  "success": true,
  "order": {
    "id": "ord_1234567890_abc",
    "order_number": "ORD-2024-000001",
    "order_status": "paid",
    "payment_status": "paid",
    "fulfillment_status": "unfulfilled",
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "total_cents": 4498,
    "order_items": [...],
    "payments": [...],
    "shipments": [],
    "order_status_history": [...]
  }
}
```

---

### 4. Update Order Status
**PATCH** `/api/orders/:id`

Update order status and notes.

#### Request Body
```json
{
  "order_status": "confirmed",
  "notes": "Customer confirmed order",
  "internal_notes": "Priority shipping requested",
  "reason": "Customer confirmation received"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "order": {
    "id": "ord_1234567890_abc",
    "order_status": "confirmed",
    "confirmed_at": "2024-01-10T12:30:00Z",
    "updated_at": "2024-01-10T12:30:00Z"
  }
}
```

---

## Order Status Flow

```
draft → confirmed → paid → processing → shipped → delivered
  ↓         ↓         ↓         ↓          ↓
cancelled ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
  ↓
refunded
```

### Status Descriptions
- **draft**: Order created but not confirmed
- **confirmed**: Order confirmed by customer
- **paid**: Payment received
- **processing**: Order being prepared for shipment
- **shipped**: Order shipped to customer
- **delivered**: Order delivered successfully
- **cancelled**: Order cancelled before fulfillment
- **refunded**: Order refunded after payment

---

## Payment Status Flow

```
pending → authorized → paid
   ↓          ↓         ↓
failed    cancelled   partially_refunded → refunded
```

### Payment Status Descriptions
- **pending**: Payment not yet processed
- **authorized**: Payment authorized but not captured
- **paid**: Payment captured successfully
- **partially_refunded**: Partial refund issued
- **refunded**: Full refund issued
- **failed**: Payment failed
- **cancelled**: Payment cancelled

---

## Fulfillment Status

- **unfulfilled**: No items shipped
- **partially_fulfilled**: Some items shipped
- **fulfilled**: All items shipped
- **cancelled**: Fulfillment cancelled

---

## Optional Payment Processing

Orders can be created and managed **without payment processing**. This is useful for:
- Manual payment methods (cash, check, bank transfer)
- Orders tracked for fulfillment only
- Marketplace orders where payment is handled externally
- Quote/invoice workflows

To create an order without payment:
1. Set `payment_status: 'pending'`
2. Don't include payment gateway information
3. Manually update `payment_status` when payment is received

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "tenant_id_required",
  "message": "Tenant ID is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "order_not_found",
  "message": "Order not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "order_creation_failed",
  "message": "Failed to create order",
  "details": "Error details..."
}
```

---

## Testing with cURL

### Create Order
```bash
curl -X POST https://api.visibleshelf.com/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tid-abc123",
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
```

### List Orders
```bash
curl -X GET "https://api.visibleshelf.com/api/orders?tenant_id=tid-abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Order
```bash
curl -X GET "https://api.visibleshelf.com/api/orders/ord_123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Order Status
```bash
curl -X PATCH "https://api.visibleshelf.com/api/orders/ord_123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_status": "confirmed",
    "reason": "Customer confirmed"
  }'
```

---

## Next Steps (Future Phases)

**Phase 3B (Weeks 3-4):**
- Payment gateway integration (Stripe, PayPal)
- Refund processing endpoint
- Shipping carrier integration
- Webhook handlers

**Phase 3C (Weeks 5-6):**
- POS system order sync
- Multi-location order routing
- Google Business Profile orders

**Phase 3D (Weeks 7-8):**
- Customer management
- Purchase history
- Customer segmentation

---

## Support

For questions or issues with the Orders API, contact the development team or refer to the main implementation plan in `PAYMENT_ORDER_MANAGEMENT_PLAN.md`.
