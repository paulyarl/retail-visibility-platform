# Trial Management Documentation

## Overview

The Retail Visibility Platform includes a comprehensive trial management system that automatically handles trial periods, expiration, and conversion workflows.

---

## Trial Lifecycle

### 1. Trial Creation

**When is a trial created?**
- Automatically when a new tenant is created via `POST /tenants`
- During database seeding for demo/test tenants

**Default Trial Settings:**
```javascript
{
  subscriptionTier: 'starter',
  subscriptionStatus: 'trial',
  trialEndsAt: new Date() + 30 days
}
```

**Trial Duration:** 30 days from creation

---

### 2. Active Trial Period

**Status:** `subscriptionStatus: 'trial'`

**User Experience:**
- Full access to starter tier features
- Trial end date displayed on subscription page
- 500 SKU limit
- All features available

**Admin View:**
- Shows as "Active" on admin tenants page
- Can be filtered by status
- Trial end date visible

---

### 3. Trial Expiration

**Automatic Detection:**
- Checked on every `GET /tenants/:id` request
- Compares `trialEndsAt` with current date

**When Trial Expires:**
```javascript
if (trialEndsAt < now) {
  subscriptionStatus = 'expired'
  // NO auto-conversion to paid plan
}
```

**Status Change:** `trial` → `expired`

**Important:** Trials do NOT auto-convert to paid plans. Manual admin action required.

---

### 4. Expired Trial Handling

**Status:** `subscriptionStatus: 'expired'`

**User Experience:**
- Access may be restricted (depending on access control)
- Subscription page shows expired status
- User should contact admin or upgrade

**Admin View:**
- Shows as "Inactive" on admin tenants page
- Appears in inactive filter
- Requires manual follow-up

**Admin Actions Required:**
1. Contact tenant to discuss subscription
2. Verify payment method
3. Manually convert to paid plan
4. Document conversion reason

---

## Auto-Set Missing Trial Dates

**Gap Handling:**

If a tenant has `subscriptionStatus: 'trial'` or `subscriptionTier: 'trial'` but no `trialEndsAt` date:

```javascript
// Automatically set on first fetch
if ((status === 'trial' || tier === 'trial') && !trialEndsAt) {
  trialEndsAt = new Date() + 30 days
  subscriptionStatus = 'trial'
}
```

This ensures all trial users have an expiration date, even if created before this feature was implemented.

---

## Manual Conversion Process

### Converting Expired Trial to Paid Plan

**Location:** `/admin/tiers`

**Steps:**
1. Navigate to Admin → Tier Management
2. Find the expired tenant
3. Select new tier (Starter, Professional, or Enterprise)
4. Select status: "Active"
5. Click "Update Tier"

**What Happens:**
```javascript
{
  subscriptionTier: 'starter', // or chosen tier
  subscriptionStatus: 'active',
  subscriptionEndsAt: new Date() + 30 days // first billing cycle
}
```

---

## API Endpoints

### Get Tenant (with trial logic)

```
GET /tenants/:id
```

**Automatic Actions:**
1. Sets `trialEndsAt` if missing for trial users
2. Marks as `expired` if trial date has passed
3. Returns updated tenant data

**Response:**
```json
{
  "id": "tenant-123",
  "name": "Demo Store",
  "subscriptionTier": "starter",
  "subscriptionStatus": "trial",
  "trialEndsAt": "2025-11-27T00:00:00.000Z",
  "subscriptionEndsAt": null
}
```

### Create Tenant

```
POST /tenants
```

**Request:**
```json
{
  "name": "My New Store"
}
```

**Automatic Trial Setup:**
- Sets `subscriptionTier: 'starter'`
- Sets `subscriptionStatus: 'trial'`
- Sets `trialEndsAt: now + 30 days`

---

## UI Components

### Subscription Page

**Location:** `/settings/subscription`

**Displays:**
- Current plan and pricing
- SKU usage and limits
- Subscription status badge
- **Trial end date** (if on trial)
- Subscription renewal date (if paid)

**Trial Display Logic:**
```javascript
if ((subscriptionTier === 'trial' || subscriptionStatus === 'trial') && trialEndsAt) {
  // Show: "Trial Ends: November 27, 2025"
}
```

### Admin Tenants Page

**Location:** `/settings/admin/tenants`

**Status Logic:**
- **Active:** `subscriptionStatus === 'active'` OR `subscriptionStatus === 'trial'`
- **Inactive:** `subscriptionStatus === 'expired'` OR other non-active statuses

**Filters:**
- All tenants
- Active only
- Inactive only (includes expired trials)

---

## Database Schema

### Tenant Model

```prisma
model Tenant {
  id                    String    @id @default(cuid())
  name                  String
  subscriptionStatus    String?   @default("trial")
  subscriptionTier      String?   @default("starter")
  trialEndsAt           DateTime?
  subscriptionEndsAt    DateTime?
  // ... other fields
}
```

**Subscription Status Values:**
- `trial` - Active trial period
- `active` - Paid subscription active
- `expired` - Trial expired, needs conversion
- `past_due` - Payment failed
- `canceled` - Subscription canceled

---

## Business Rules

### Why No Auto-Conversion?

**Legal & Business Reasons:**
1. **Payment Verification** - Must confirm payment method before charging
2. **Contract Agreement** - User must agree to paid terms
3. **Compliance** - Avoid unauthorized charges
4. **Customer Service** - Opportunity to discuss needs and pricing

### Manual Conversion Benefits

1. **Payment Confirmation** - Verify billing details
2. **Plan Selection** - Choose appropriate tier
3. **Contract Terms** - Review and agree to terms
4. **Customer Relationship** - Personal touch, build trust
5. **Upsell Opportunity** - Discuss higher tiers if needed

---

## Future Enhancements

### Recommended Features

1. **Expired Trials Queue**
   - Dedicated admin page: `/admin/expired-trials`
   - List all expired trials with details
   - Quick actions: Email, Convert, Extend
   - Track follow-up status

2. **Email Notifications**
   - Trial expiring soon (7 days, 3 days, 1 day)
   - Trial expired notification
   - Admin daily digest of expired trials

3. **Grace Period**
   - Allow X days after expiration before restricting access
   - Show countdown banner
   - Soft reminder vs hard cutoff

4. **Self-Service Upgrade**
   - Payment integration (Stripe/PayPal)
   - User can upgrade without admin
   - Auto-activate after successful payment

5. **Trial Extension**
   - Admin can extend trial by X days
   - Log extension reason
   - Limit number of extensions

---

## Testing

### Local Testing

**Create Test Tenant with Trial:**
```bash
cd apps/api
doppler run --config local -- pnpm db:seed:local
```

**Test Expired Trial:**
```javascript
// Manually set trial to past date in database
await prisma.tenant.update({
  where: { id: 'demo-tenant' },
  data: {
    trialEndsAt: new Date('2025-01-01') // Past date
  }
});
```

**Verify Expiration:**
1. Fetch tenant via API
2. Check `subscriptionStatus` changed to `'expired'`
3. Verify shows as "Inactive" on admin page

---

## Troubleshooting

### Trial Date Not Showing

**Cause:** `trialEndsAt` is null

**Solution:** Fetch tenant data - will auto-set if missing

### Trial Not Expiring

**Cause:** `trialEndsAt` is in the future

**Solution:** Check date is correct, wait for expiration

### Tenant Still Active After Expiration

**Cause:** Access control not checking `subscriptionStatus`

**Solution:** Implement middleware to restrict expired tenants

---

## Related Documentation

- [Subscription Tiers](./SUBSCRIPTION_TIERS.md)
- [Organization Requests](./ORGANIZATION_REQUESTS.md)
- [Admin Features](./ADMIN_FEATURES.md)
- [Doppler Configuration](./DOPPLER_DEV_MIGRATION.md)
