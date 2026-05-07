# Shopping Cart Visibility - Feature Flag Implementation

## 🎯 Overview

The shopping cart feature is **opt-in** for tenants. Only tenants that have configured payment processing will see the "Add to Cart" button on their product pages.

---

## 🔐 How It Works

### **Tenant Opt-In:**
Tenants must have an **active payment gateway** configured in the `tenant_payment_gateways` table:

```sql
SELECT * FROM tenant_payment_gateways 
WHERE tenant_id = 'tenant_123' 
  AND is_active = true;
```

If a tenant has at least one active payment gateway, they are eligible for storefront order processing.

---

## 📊 Database Schema

### **tenant_payment_gateways Table:**
```sql
- id
- tenant_id
- gateway_type (paypal, stripe, square, etc.)
- is_active (boolean)
- is_default (boolean)
- api_key_encrypted
- api_secret_encrypted
- config (JSON)
- created_at
- updated_at
```

**Key Field:** `is_active = true` indicates the tenant has enabled payment processing.

---

## 🎨 Frontend Implementation

### **1. Product Page (TierBasedLandingPage.tsx)**

The AddToCartButton is conditionally rendered based on `tenant.hasActivePaymentGateway`:

```tsx
{/* Add to Cart Button - Only show if tenant has order processing enabled */}
{tenant.hasActivePaymentGateway && (
  <div className="mb-6">
    <AddToCartButton
      product={{...}}
      tenantName={tenant.metadata?.businessName || tenant.name}
      tenantLogo={undefined}
      className="w-full"
    />
  </div>
)}
```

### **2. Tenant Interface:**

```typescript
interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  hasActivePaymentGateway?: boolean; // ← Feature flag
  metadata?: {
    businessName?: string;
    // ...
  };
}
```

---

## 🔄 Backend Integration Needed

The backend API needs to return `hasActivePaymentGateway` when fetching tenant data:

### **API Endpoint: GET /api/tenants/:id**

```typescript
// Check if tenant has active payment gateway
const hasActivePaymentGateway = await prisma.tenant_payment_gateways.findFirst({
  where: {
    tenant_id: tenantId,
    is_active: true,
  },
});

// Return tenant with flag
return {
  ...tenant,
  hasActivePaymentGateway: !!hasActivePaymentGateway,
};
```

### **API Endpoint: GET /items/:id**

When fetching product details, include the tenant's payment gateway status:

```typescript
const tenant = await prisma.tenants.findUnique({
  where: { id: product.tenant_id },
  include: {
    payment_gateways: {
      where: { is_active: true },
      take: 1,
    },
  },
});

return {
  product,
  tenant: {
    ...tenant,
    hasActivePaymentGateway: tenant.payment_gateways.length > 0,
  },
};
```

---

## 🎯 User Experience

### **Tenant WITH Payment Gateway:**
```
Product Page
  ├─ Product Info
  ├─ Price
  ├─ Availability: In Stock
  ├─ [Add to Cart] Button ✅
  └─ Product Details
```

### **Tenant WITHOUT Payment Gateway:**
```
Product Page
  ├─ Product Info
  ├─ Price
  ├─ Availability: In Stock
  ├─ (No Add to Cart Button) ❌
  └─ Product Details
```

---

## 🚀 Benefits

### **For Platform:**
✅ **Controlled Rollout** - Only tenants ready for e-commerce see cart
✅ **Reduced Support** - No cart issues for tenants without payment setup
✅ **Clear Expectations** - Tenants know they need payment gateway for orders

### **For Tenants:**
✅ **Opt-In Model** - Choose when to enable order processing
✅ **No Confusion** - Cart only appears when ready to accept orders
✅ **Flexible Setup** - Can configure payment gateway when ready

### **For Customers:**
✅ **No Dead Ends** - Only see cart on stores that accept orders
✅ **Clear Experience** - If cart is visible, store accepts online orders
✅ **No Frustration** - Won't try to checkout from stores without payment

---

## 📋 Implementation Checklist

### **Frontend:** ✅
- [x] Add `hasActivePaymentGateway` to Tenant interface
- [x] Conditionally render AddToCartButton
- [x] Update TierBasedLandingPage component
- [x] Update product page types

### **Backend:** ⏳ (To Do)
- [ ] Update tenant API to include `hasActivePaymentGateway`
- [ ] Update product API to include tenant payment status
- [ ] Add database query to check active payment gateways
- [ ] Test with tenants that have/don't have payment gateways

---

## 🧪 Testing

### **Test Scenarios:**

1. **Tenant with Active PayPal Gateway:**
   - Create tenant
   - Add PayPal gateway with `is_active = true`
   - Visit product page
   - ✅ "Add to Cart" button should appear

2. **Tenant without Payment Gateway:**
   - Create tenant
   - Do NOT add payment gateway
   - Visit product page
   - ❌ "Add to Cart" button should NOT appear

3. **Tenant with Inactive Gateway:**
   - Create tenant
   - Add PayPal gateway with `is_active = false`
   - Visit product page
   - ❌ "Add to Cart" button should NOT appear

---

## 🔧 Configuration

### **Enable Payment Gateway for Tenant:**

```sql
-- Insert PayPal gateway for tenant
INSERT INTO tenant_payment_gateways (
  id,
  tenant_id,
  gateway_type,
  is_active,
  is_default,
  config
) VALUES (
  'gateway_' || gen_random_uuid()::text,
  'tenant_123',
  'paypal',
  true,
  true,
  '{"mode": "sandbox"}'::jsonb
);
```

### **Disable Payment Gateway:**

```sql
-- Deactivate payment gateway
UPDATE tenant_payment_gateways
SET is_active = false
WHERE tenant_id = 'tenant_123';
```

---

## 📝 Notes

- Cart visibility is **per-tenant**, not per-product
- If tenant has ANY active payment gateway, cart is enabled
- Multiple payment gateways can be active (PayPal + Stripe)
- Default gateway is used for checkout if multiple active
- Inactive gateways don't enable cart functionality

---

**Status:** Frontend implementation complete. Backend API updates needed to pass `hasActivePaymentGateway` flag.
