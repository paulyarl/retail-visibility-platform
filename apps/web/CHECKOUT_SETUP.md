# Checkout Flow Setup Guide

## Installation Steps

### 1. Install Stripe Dependencies

```bash
cd apps/web
pnpm add @stripe/stripe-js @stripe/react-stripe-js
pnpm add -D @types/stripe-js
```

### 2. Add Environment Variables

Add to `apps/web/.env.local`:

```bash
# Stripe Public Key (safe to expose in frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### 3. Install Additional UI Dependencies (if not already installed)

```bash
pnpm add react-hook-form @hookform/resolvers
pnpm add @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-separator
```

### 4. Verify shadcn/ui Components

Make sure these shadcn/ui components are installed:
- Button
- Card
- Form
- Input
- Select
- Alert
- Separator
- Tooltip

If any are missing, install them:

```bash
npx shadcn@latest add button card form input select alert separator tooltip
```

## File Structure Created

```
apps/web/src/
├── app/
│   └── checkout/
│       └── page.tsx                    # Main checkout page
└── components/
    └── checkout/
        ├── CheckoutProgress.tsx        # Step indicator
        ├── OrderSummary.tsx           # Order summary sidebar
        ├── CustomerInfoForm.tsx       # Customer info form
        ├── ShippingAddressForm.tsx    # Shipping address form
        └── PaymentForm.tsx            # Stripe payment form
```

## Features Implemented

### ✅ Checkout Page
- 3-step checkout flow (Review → Shipping → Payment)
- Progress indicator
- Responsive design
- Back navigation

### ✅ Order Summary
- Line items display with images
- Price breakdown (subtotal, platform fee, shipping, total)
- Platform fee tooltip explanation
- Security badge
- Sticky sidebar on desktop

### ✅ Customer Info Form
- Email validation
- Name fields
- Phone number
- Form validation with Zod
- Error handling

### ✅ Shipping Address Form
- Full address fields
- US state dropdown
- Country selection
- Postal code validation
- Form validation

### ✅ Payment Form
- Stripe Elements integration
- Card input with validation
- Secure payment processing
- Loading states
- Error handling
- Success/failure feedback
- Billing details auto-fill
- Security notice

## Testing the Checkout Flow

### 1. Start the Development Server

```bash
cd apps/web
pnpm dev
```

### 2. Navigate to Checkout

Visit: `http://localhost:3000/checkout`

### 3. Test with Stripe Test Cards

Use these test card numbers:

**Success:**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**Decline:**
- Card: `4000 0000 0000 0002`

**Requires Authentication:**
- Card: `4000 0025 0000 3155`

### 4. Complete the Flow

1. Fill in customer information
2. Fill in shipping address
3. Enter payment details
4. Submit payment
5. Verify redirect to confirmation page

## API Integration Points

The checkout flow integrates with these backend endpoints:

### Create Order
```typescript
POST /api/orders
Body: {
  customer: { email, name, phone },
  shippingAddress: { ... },
  items: [{ sku, name, quantity, unit_price_cents }]
}
```

### Process Payment
```typescript
POST /api/payments/charge
Body: {
  orderId: string,
  paymentMethod: { type: 'card' },
  gatewayType: 'stripe'
}
```

## Customization

### Styling
All components use Tailwind CSS and can be customized by modifying the className props.

### Validation
Form validation schemas are defined using Zod and can be modified in each form component.

### Payment Options
The PaymentElement automatically shows available payment methods based on your Stripe configuration.

### Platform Fee
Platform fee is calculated as 3% in the checkout page. Modify this in:
```typescript
const platformFee = Math.round(subtotal * 0.03);
```

## Next Steps

1. **Add Cart Management**
   - Create cart context/state
   - Add/remove items
   - Update quantities
   - Persist cart in localStorage

2. **Add Order Confirmation Page**
   - Create `/orders/confirmation` page
   - Display order details
   - Show payment receipt
   - Email confirmation

3. **Add Error Handling**
   - Network errors
   - Payment failures
   - Validation errors
   - Retry logic

4. **Add Analytics**
   - Track checkout steps
   - Conversion funnel
   - Abandonment tracking

5. **Mobile Optimization**
   - Test on mobile devices
   - Optimize form inputs
   - Touch-friendly buttons

## Troubleshooting

### Stripe Elements Not Loading
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Check browser console for errors
- Ensure Stripe.js is loaded

### Payment Fails
- Check API endpoint is running
- Verify Stripe webhook secret is configured
- Check backend logs for errors

### Form Validation Issues
- Verify Zod schemas match requirements
- Check form field names match schema
- Review error messages in console

## Production Checklist

Before deploying to production:

- [ ] Replace test Stripe keys with live keys
- [ ] Test with real payment methods
- [ ] Set up proper error logging
- [ ] Configure webhook endpoints
- [ ] Add rate limiting
- [ ] Enable HTTPS
- [ ] Test mobile experience
- [ ] Add loading states
- [ ] Implement retry logic
- [ ] Add analytics tracking

---

**Status:** Day 1 Complete ✅  
**Next:** Day 2 - Order Management UI  
**Last Updated:** 2026-01-10
