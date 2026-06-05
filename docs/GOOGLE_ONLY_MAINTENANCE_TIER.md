# google_only: Internal Maintenance Tier

**Status:** ✅ IMPLEMENTED - Phase 3 Complete  
**Purpose:** Internal tier for expired trial accounts to prevent premium feature leakage while maintaining visibility

---

## Overview

`google_only` is an **internal-only tier** that serves as a maintenance mode for expired trial accounts. It prevents premium feature leakage while allowing users to maintain their existing online presence.

### Key Characteristics

- **Not a purchasable tier** - Users cannot directly subscribe to google_only
- **Auto-assigned** - System automatically downgrades expired trials to google_only
- **Maintenance mode** - Can update existing products/profile, cannot add new products
- **Time-limited** - Eventually transitions to frozen (read-only) state
- **Visibility preserved** - Storefront and directory listing remain online

---

## Trial → google_only Lifecycle

### Phase 1: Active Trial (14 days)
- **Status:** `subscriptionStatus = 'trial'`
- **Tier:** User's chosen tier (starter, professional, etc.)
- **Access:** Full access within tier limits
- **Can do:** Create products, use premium features, grow inventory

### Phase 2: Trial Expires
- **Trigger:** `trialEndsAt < now`
- **Action:** `GET /tenants/:id` auto-downgrades
- **Result:**
  - `subscriptionStatus = 'expired'`
  - `subscriptionTier = 'google_only'` (if no Stripe subscription)
- **Purpose:** Prevent premium feature leakage

### Phase 3: Maintenance Mode (google_only)
- **Status:** `subscriptionStatus = 'expired'`, `subscriptionTier = 'google_only'`
- **Internal Status:** `'maintenance'` (via `deriveInternalStatus()`)
- **Duration:** While `now < trialEndsAt` (uses trial end as boundary)
- **Access:**
  - ✅ Update existing products (name, price, description, images)
  - ✅ Update business profile
  - ✅ Sync existing products to Google
  - ❌ Add new products (blocked by `checkSubscriptionLimits`)
  - ❌ Use premium features (Quick Start, barcode scanner, etc.)
- **Visibility:** Storefront and directory remain online

### Phase 4: Frozen (Read-Only)
- **Trigger:** `now >= trialEndsAt` (maintenance window expired)
- **Internal Status:** `'frozen'` (via `deriveInternalStatus()`)
- **Access:**
  - ✅ View products and data
  - ✅ Storefront remains visible
  - ✅ Directory listing remains visible
  - ❌ No edits allowed (blocked by `requireWritableSubscription`)
  - ❌ No syncs allowed
- **Purpose:** Preserve visibility while preventing all modifications

---

## Implementation Details

### Auto-Downgrade Logic

**Location:** `apps/api/src/index.ts` - `GET /tenants/:id`

```typescript
// Check if trial has expired and mark as expired
// If there is no active subscription attached, downgrade tier to internal google_only
if (
  tenant.subscriptionStatus === "trial" &&
  tenant.trialEndsAt &&
  tenant.trialEndsAt < now
) {
  const hasStripeSubscription = !!tenant.stripeSubscriptionId;

  tenant = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: "expired",
      // For maintenance-only accounts without a paid subscription, force internal google_only tier
      subscriptionTier: hasStripeSubscription ? tenant.subscriptionTier : "google_only",
    },
  });
}
```

### Status Derivation

**Location:** `apps/api/src/utils/subscription-status.ts`

```typescript
export function deriveInternalStatus(tenant): InternalStatus {
  // ... status checks ...

  // Check if this is google_only tier (internal maintenance tier)
  if (tier === 'google_only') {
    // google_only is maintenance tier for expired trials
    // Check if still within maintenance window (uses trialEndsAt as boundary)
    const maintenanceState = getMaintenanceState({
      tier,
      status,
      trialEndsAt: tenant.trialEndsAt,
    });

    if (maintenanceState === 'freeze') {
      return 'frozen';
    }
    return 'maintenance';
  }
}
```

### Maintenance State Logic

**Location:** `apps/api/src/utils/subscription-status.ts`

```typescript
export function getMaintenanceState(ctx): MaintenanceState {
  const isInactive = status === 'canceled' || status === 'expired';

  let inMaintenanceWindow = false;

  if (tier === 'google_only' && !isInactive) {
    if (!ctx.trialEndsAt) {
      inMaintenanceWindow = true; // No boundary = always maintenance
    } else {
      const boundary = new Date(ctx.trialEndsAt);
      if (!Number.isNaN(boundary.getTime()) && now < boundary) {
        inMaintenanceWindow = true; // Within trial end boundary
      }
    }
  }

  const isFullyFrozen = isInactive || (tier === 'google_only' && !inMaintenanceWindow);

  if (inMaintenanceWindow) return 'maintenance';
  if (isFullyFrozen) return 'freeze';
  return null;
}
```

---

## Middleware Enforcement

### 1. checkSubscriptionLimits (Growth Blocking)

**Purpose:** Blocks new product creation in maintenance mode  
**Location:** `apps/api/src/middleware/subscription.ts`

```typescript
// In maintenance mode, block growth (new items) even if numeric limits not reached
if (req.method === "POST" && maintenanceState === "maintenance") {
  return res.status(403).json({
    error: "maintenance_no_growth",
    message: "Your account is in maintenance mode. You can update existing products, but cannot add new products until you upgrade.",
    subscriptionTier: tier,
    subscriptionStatus: status,
    maintenanceState,
    upgradeUrl: "/settings/subscription",
  });
}
```

### 2. requireWritableSubscription (Freeze Blocking)

**Purpose:** Blocks ALL writes in frozen state  
**Location:** `apps/api/src/middleware/subscription.ts`

```typescript
// Frozen accounts are read-only (visibility only)
if (internalStatus === 'frozen') {
  return res.status(403).json({
    error: "account_frozen",
    message: "Your account is in read-only mode. Your storefront and directory listing remain visible, but you cannot make changes. Please upgrade to regain full access.",
    subscriptionStatus: tenant.subscriptionStatus,
    subscriptionTier: tenant.subscriptionTier,
    internalStatus,
    upgradeUrl: "/settings/subscription",
  });
}
```

---

## Usage Guidelines

### When to Use requireWritableSubscription

Apply to endpoints that modify data:

```typescript
// Item updates (PUT/PATCH)
app.patch("/items/:id", requireWritableSubscription, checkSubscriptionLimits, handler);

// Profile updates
app.patch("/tenant/profile", requireWritableSubscription, handler);

// Sync triggers
app.post("/sync/trigger", requireWritableSubscription, handler);
```

### When to Use checkSubscriptionLimits

Apply to endpoints that create new resources:

```typescript
// Item creation (POST)
app.post("/items", requireWritableSubscription, checkSubscriptionLimits, handler);

// Bulk uploads
app.post("/items/bulk", requireWritableSubscription, checkSubscriptionLimits, handler);
```

### Middleware Order

Always use this order:
1. `requireActiveSubscription` - Blocks canceled/expired (optional, for read endpoints)
2. `requireWritableSubscription` - Blocks frozen accounts
3. `checkSubscriptionLimits` - Blocks growth in maintenance, enforces tier limits

---

## Business Logic

### Why google_only Exists

1. **Prevent Premium Feature Leakage**
   - Trial users get access to premium features (Quick Start, barcode scanner, etc.)
   - Without downgrade, they'd keep premium features forever
   - google_only ensures they lose premium access immediately

2. **Graceful Degradation**
   - Don't immediately freeze accounts (bad UX)
   - Give users time to maintain their existing presence
   - Preserve their online visibility (storefront/directory)

3. **Upgrade Incentive**
   - Users see their limitations clearly
   - Can maintain but not grow
   - Creates natural upgrade pressure

4. **Fair Resource Usage**
   - Prevents abuse of trial system
   - Limits resource consumption for non-paying users
   - Maintains platform sustainability

### Maintenance Window Duration

**Current:** Uses `trialEndsAt` as boundary (immediate transition to freeze after trial)

**Future Option:** Could add `maintenanceBoundaryAt` field for extended grace period:
- Trial ends → Downgrade to google_only
- Maintenance window → 6 months from trial end
- After 6 months → Freeze

**Current Decision:** Keep it simple - use trial end as boundary. Can extend later if needed.

---

## Error Messages

### Maintenance Mode (403)
```json
{
  "error": "maintenance_no_growth",
  "message": "Your account is in maintenance mode. You can update existing products, but cannot add new products until you upgrade.",
  "subscriptionTier": "google_only",
  "subscriptionStatus": "expired",
  "maintenanceState": "maintenance",
  "upgradeUrl": "/settings/subscription"
}
```

### Frozen State (403)
```json
{
  "error": "account_frozen",
  "message": "Your account is in read-only mode. Your storefront and directory listing remain visible, but you cannot make changes. Please upgrade to regain full access.",
  "subscriptionStatus": "expired",
  "subscriptionTier": "google_only",
  "internalStatus": "frozen",
  "upgradeUrl": "/settings/subscription"
}
```

---

## Testing Scenarios

### Test 1: Trial Expiration
1. Create tenant with trial status
2. Set `trialEndsAt` to past date
3. Call `GET /tenants/:id`
4. Verify: `subscriptionStatus = 'expired'`, `subscriptionTier = 'google_only'`

### Test 2: Maintenance Mode
1. Set tenant to `subscriptionStatus = 'expired'`, `subscriptionTier = 'google_only'`
2. Set `trialEndsAt` to future date (within maintenance window)
3. Try to update existing product → Should succeed
4. Try to create new product → Should fail with `maintenance_no_growth`

### Test 3: Frozen State
1. Set tenant to `subscriptionStatus = 'expired'`, `subscriptionTier = 'google_only'`
2. Set `trialEndsAt` to past date (outside maintenance window)
3. Try to update product → Should fail with `account_frozen`
4. Try to create product → Should fail with `account_frozen`

### Test 4: Paid Subscription Protection
1. Create tenant with trial + Stripe subscription ID
2. Let trial expire
3. Verify: Tier does NOT downgrade to google_only (keeps original tier)

---

## Frontend Integration

### Status Display

Show appropriate messaging based on internal status:

```typescript
import { deriveInternalStatus } from '@/lib/subscription-status';

const internalStatus = deriveInternalStatus(tenant);

if (internalStatus === 'maintenance') {
  return (
    <Alert variant="warning">
      Your account is in maintenance mode. You can update existing products 
      but cannot add new ones. <Link to="/settings/subscription">Upgrade now</Link>
    </Alert>
  );
}

if (internalStatus === 'frozen') {
  return (
    <Alert variant="error">
      Your account is in read-only mode. Your storefront remains visible, 
      but you cannot make changes. <Link to="/settings/subscription">Upgrade to regain access</Link>
    </Alert>
  );
}
```

### Feature Gating

```typescript
// Disable "Add Product" button in maintenance/frozen
const canAddProducts = internalStatus !== 'maintenance' && internalStatus !== 'frozen';

<Button disabled={!canAddProducts}>
  {internalStatus === 'maintenance' ? 'Upgrade to Add Products' : 'Add Product'}
</Button>
```

---

## Migration Notes

### Existing Tenants

No migration needed - auto-downgrade happens on next `GET /tenants/:id` call for expired trials.

### Future Enhancements

1. **Extended Maintenance Window**
   - Add `maintenanceBoundaryAt` field to schema
   - Set to `trialEndsAt + 6 months` on downgrade
   - Update `getMaintenanceState()` to use dedicated field

2. **Maintenance Notifications**
   - Email users when entering maintenance mode
   - Remind them of freeze date
   - Provide upgrade prompts

3. **Freeze Notifications**
   - Email users when account freezes
   - Explain what's preserved (visibility)
   - Clear upgrade path

---

## Summary

`google_only` is a critical internal tier that:
- ✅ Prevents premium feature leakage from expired trials
- ✅ Provides graceful degradation (maintenance → freeze)
- ✅ Preserves user visibility (storefront/directory)
- ✅ Creates natural upgrade incentive
- ✅ Maintains platform sustainability

**Implementation Status:** Complete and production-ready.
