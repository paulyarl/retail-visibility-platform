# Checkout Flow Testing Guide

## Prerequisites

### 1. Environment Setup

Add your Stripe publishable key to `.env.local`:

```bash
# In apps/web/.env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51Ovq732Ng8vHl391nzbYYDRLuJiA23IUUlwVs97YL4TVbWcagpHYL3nIlOIAZVOn4eHeThnKIFmTXgF9JMHowxKr00hHKI0GpL
```

### 2. Start Backend API

Make sure your API server is running:

```bash
cd apps/api
pnpm dev
# Should be running on http://localhost:4000
```

### 3. Start Frontend

```bash
cd apps/web
pnpm dev
# Should be running on http://localhost:3000
```

---

## Testing Scenarios

### Test 1: Complete Checkout Flow (Happy Path)

**Objective:** Test successful payment from start to finish

**Steps:**
1. Navigate to `http://localhost:3000/checkout`
2. **Step 1: Customer Information**
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john.doe@example.com`
   - Phone: `(555) 123-4567`
   - Click "Continue to Shipping"

3. **Step 2: Shipping Address**
   - Address Line 1: `123 Main Street`
   - Address Line 2: `Apt 4B` (optional)
   - City: `New York`
   - State: `NY`
   - Postal Code: `10001`
   - Country: `US`
   - Click "Continue to Payment"

4. **Step 3: Payment**
   - Card Number: `4242 4242 4242 4242`
   - Expiry: `12/34` (any future date)
   - CVC: `123`
   - ZIP: `10001`
   - Click "Pay $XX.XX"

**Expected Result:**
- ✅ Payment processes successfully
- ✅ Success alert appears
- ✅ Redirects to confirmation page
- ✅ Order created in database
- ✅ Payment record created
- ✅ Webhook event logged

---

### Test 2: Payment Declined

**Objective:** Test payment failure handling

**Steps:**
1. Follow Test 1 steps 1-2
2. **Step 3: Payment**
   - Card Number: `4000 0000 0000 0002` (decline card)
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `10001`
   - Click "Pay $XX.XX"

**Expected Result:**
- ❌ Payment fails
- ✅ Error message displayed
- ✅ User can retry with different card
- ✅ No order created
- ✅ No charge made

---

### Test 3: 3D Secure Authentication

**Objective:** Test payment requiring authentication

**Steps:**
1. Follow Test 1 steps 1-2
2. **Step 3: Payment**
   - Card Number: `4000 0025 0000 3155` (requires authentication)
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `10001`
   - Click "Pay $XX.XX"
   - Complete authentication in Stripe modal

**Expected Result:**
- ✅ Authentication modal appears
- ✅ After authentication, payment succeeds
- ✅ Order created successfully

---

### Test 4: Form Validation

**Objective:** Test form validation on all steps

**Step 1 Validation:**
- Leave email blank → Should show "Invalid email address"
- Enter invalid email → Should show error
- Leave first/last name blank → Should show "required" error
- Enter short phone number → Should show "at least 10 digits" error

**Step 2 Validation:**
- Leave address blank → Should show "Address is required"
- Leave city blank → Should show "City is required"
- Enter short postal code → Should show "at least 5 characters" error

**Expected Result:**
- ✅ All validation errors display correctly
- ✅ Cannot proceed to next step with invalid data
- ✅ Error messages are clear and helpful

---

### Test 5: Back Navigation

**Objective:** Test navigation between steps

**Steps:**
1. Complete Step 1 (Customer Info)
2. Click "Back" on Step 2
3. Verify data is preserved
4. Complete Step 2 (Shipping)
5. Click "Back" on Step 3
6. Verify data is preserved
7. Complete all steps

**Expected Result:**
- ✅ Back button works on all steps
- ✅ Form data is preserved when going back
- ✅ Can edit previous information
- ✅ Changes are reflected in order summary

---

### Test 6: Order Summary

**Objective:** Verify order summary calculations

**Check:**
- ✅ Line items display correctly
- ✅ Quantities are accurate
- ✅ Subtotal calculation is correct
- ✅ Platform fee (3%) is calculated correctly
- ✅ Shipping cost is included
- ✅ Total is accurate (subtotal + platform fee + shipping)
- ✅ Platform fee tooltip explains the fee

---

### Test 7: Mobile Responsiveness

**Objective:** Test checkout on mobile devices

**Steps:**
1. Open Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone or Android device
4. Complete checkout flow

**Expected Result:**
- ✅ Layout adapts to mobile screen
- ✅ Forms are easy to fill on mobile
- ✅ Buttons are touch-friendly
- ✅ Order summary is accessible
- ✅ Payment form works on mobile

---

### Test 8: Loading States

**Objective:** Verify loading indicators

**Check:**
- ✅ "Processing..." shows during form submission
- ✅ Buttons are disabled during processing
- ✅ Loading spinner appears during payment
- ✅ User cannot double-submit

---

### Test 9: Error Recovery

**Objective:** Test error handling and recovery

**Scenarios:**
1. **Network Error:**
   - Disconnect internet during payment
   - Expected: Error message, can retry

2. **Invalid Card:**
   - Use card `4000 0000 0000 0341` (incorrect CVC)
   - Expected: Error message, can correct

3. **Insufficient Funds:**
   - Use card `4000 0000 0000 9995`
   - Expected: Clear error message

**Expected Result:**
- ✅ All errors display user-friendly messages
- ✅ User can retry after error
- ✅ No data loss on error

---

## Stripe Test Cards Reference

### Success Cards
- **Basic Success:** `4242 4242 4242 4242`
- **Visa:** `4242 4242 4242 4242`
- **Mastercard:** `5555 5555 5555 4444`
- **Amex:** `3782 822463 10005`

### Decline Cards
- **Generic Decline:** `4000 0000 0000 0002`
- **Insufficient Funds:** `4000 0000 0000 9995`
- **Lost Card:** `4000 0000 0000 9987`
- **Stolen Card:** `4000 0000 0000 9979`

### Authentication Required
- **3D Secure:** `4000 0025 0000 3155`
- **3D Secure 2:** `4000 0027 6000 3184`

### Processing Errors
- **Incorrect CVC:** `4000 0000 0000 0127`
- **Expired Card:** `4000 0000 0000 0069`
- **Processing Error:** `4000 0000 0000 0119`

**Note:** For all test cards:
- Use any future expiry date (e.g., `12/34`)
- Use any 3-digit CVC (e.g., `123`)
- Use any 5-digit ZIP code (e.g., `10001`)

---

## Backend Verification

After completing a test payment, verify in the database:

### Check Orders Table
```sql
SELECT * FROM orders 
WHERE customer_email = 'john.doe@example.com'
ORDER BY created_at DESC 
LIMIT 1;
```

### Check Payments Table
```sql
SELECT * FROM payments 
WHERE order_id = 'ord_xxx'
ORDER BY created_at DESC 
LIMIT 1;
```

### Check Webhook Events
```sql
SELECT * FROM webhook_events 
WHERE event_type LIKE 'payment_intent%'
ORDER BY created_at DESC 
LIMIT 5;
```

---

## Common Issues & Solutions

### Issue 1: Stripe Elements Not Loading
**Symptoms:** Payment form is blank or shows error
**Solution:**
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Check browser console for errors
- Ensure Stripe.js is loaded (check Network tab)

### Issue 2: Payment Fails with "No such PaymentIntent"
**Symptoms:** Error after clicking Pay button
**Solution:**
- Ensure API is running on `http://localhost:4000`
- Check API logs for errors
- Verify Stripe secret key is configured in API

### Issue 3: Webhook Events Not Logged
**Symptoms:** Payment succeeds but no webhook events
**Solution:**
- Run Stripe CLI: `stripe listen --forward-to localhost:4000/api/webhooks/stripe`
- Verify webhook secret matches in API `.env`
- Check API logs for webhook errors

### Issue 4: Order Not Created
**Symptoms:** Payment succeeds but no order in database
**Solution:**
- Check API logs for errors
- Verify database connection
- Check order creation endpoint response

---

## Success Criteria

Before proceeding to Day 2, verify:

- ✅ All 3 steps of checkout work correctly
- ✅ Form validation works on all fields
- ✅ Successful payment creates order and payment records
- ✅ Failed payments show appropriate errors
- ✅ Back navigation preserves data
- ✅ Order summary calculates correctly
- ✅ Mobile layout works properly
- ✅ Loading states display correctly
- ✅ Error messages are user-friendly
- ✅ Webhook events are logged

---

## Next Steps

Once testing is complete and all scenarios pass:

1. ✅ Mark Day 1 as complete
2. 🔄 Proceed to Day 2: Order Management UI
3. 📝 Document any issues found
4. 🐛 Create bug tickets for any problems

---

**Testing Status:** Ready to Begin  
**Last Updated:** 2026-01-10  
**Tester:** _____________  
**Date Tested:** _____________
