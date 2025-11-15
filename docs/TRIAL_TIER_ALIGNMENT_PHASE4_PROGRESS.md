# Trial & Tier Alignment - Phase 4 Progress

**Phase:** Frontend UX & Messaging Alignment  
**Status:** 🚧 IN PROGRESS  
**Started:** November 14, 2025

---

## Objective

Update the frontend UI to reflect the trial → google_only → maintenance → freeze lifecycle with clear, user-friendly messaging and visual indicators.

---

## Completed ✅

### 1. Frontend Subscription Status Utilities

**File:** `apps/web/src/lib/subscription-status.ts` (NEW)

**Purpose:** Mirror backend status derivation logic on the frontend

**Exports:**
- `InternalStatus` type - 7 operational states
- `MaintenanceState` type - maintenance/freeze/null
- `deriveInternalStatus()` - Derives operational status from subscription fields
- `getMaintenanceState()` - Determines maintenance vs freeze for google_only
- `getStatusLabel()` - User-friendly status labels
- `getStatusColor()` - Color coding for UI (green/yellow/red/gray)

**Key Logic:**
```typescript
// Trial expires → google_only + expired status
if (status === 'expired' && tier === 'google_only') {
  // Check if within maintenance window (trialEndsAt)
  if (now < trialEndsAt) return 'maintenance';
  return 'frozen';
}
```

### 2. Enhanced useSubscriptionUsage Hook

**File:** `apps/web/src/hooks/useSubscriptionUsage.ts`

**Added Fields:**
- `internalStatus: InternalStatus` - Derived operational status
- `maintenanceState: MaintenanceState` - For google_only lifecycle

**Benefits:**
- All components get consistent status information
- Single source of truth for frontend status logic
- Automatically calculated on every data fetch

### 3. Updated SubscriptionStatusGuide Component

**File:** `apps/web/src/components/subscription/SubscriptionStatusGuide.tsx`

**Changes:**
- Replaced inline maintenance logic with `getMaintenanceState()` helper
- Updated trial warning message to explain google_only downgrade
- Added bullet points explaining what happens when trial ends:
  - Storefront/directory/Google listings remain online
  - Can update existing products
  - Cannot add new products
  - Premium features disabled

**Before:**
```typescript
// Inline logic checking status === 'active'
if (tier === 'google_only' && status === 'active') {
  // maintenance logic
}
```

**After:**
```typescript
// Centralized helper
const maintenanceState = getMaintenanceState({
  tier,
  status,
  trialEndsAt: usage.trialEndsAt,
});
```

### 4. Enhanced SubscriptionUsageBadge Component

**File:** `apps/web/src/components/subscription/SubscriptionUsageBadge.tsx`

**Added:** Maintenance/Freeze visual indicators in compact variant

**Visual Design:**
- **Maintenance:** Yellow warning triangle + "Maintenance" label
- **Freeze:** Red lock icon + "Frozen" label
- Positioned before SKU/location usage
- Only shows when `maintenanceState !== null`

**Example Display:**
```
[⚠️ Maintenance] | [📦 47/50] | [🏢 1/1]
[🔒 Frozen] | [📦 50/50] | [🏢 1/1]
```

---

## Remaining Work 🚧

### 5. Update CreationCapacityWarning Component

**File:** `apps/web/src/components/capacity/CreationCapacityWarning.tsx`

**TODO:**
- [ ] Add awareness of `internalStatus`
- [ ] Show specific messaging for maintenance mode:
  - "Your trial has ended. You can update existing products but cannot add new ones."
- [ ] Show specific messaging for frozen state:
  - "Your account is frozen. Please upgrade to regain access."
- [ ] Adjust warning thresholds based on status

### 6. Add Maintenance/Freeze Banners

**Locations:**
- Dashboard page
- Items page
- Quick Start page
- Bulk upload modal

**Design:**
- Prominent banner at top of page
- Clear explanation of current state
- Upgrade CTA button
- Dismissible (with localStorage persistence)

**Example Banner (Maintenance):**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Maintenance Mode                                      │
│ Your trial has ended. You can update existing products  │
│ but cannot add new ones. Upgrade to continue growing.   │
│ [View Plans] [Dismiss]                                   │
└─────────────────────────────────────────────────────────┘
```

### 7. Update Subscription Settings Page

**File:** `apps/web/src/app/(platform)/settings/subscription/page.tsx`

**TODO:**
- [ ] Display internal status prominently
- [ ] Show maintenance window countdown (if applicable)
- [ ] Explain what happens in each state
- [ ] Clear upgrade paths based on current state
- [ ] Use `isTrialStatus()` and `getTrialEndLabel()` helpers

### 8. Update Feature Gate Components

**Files to Review:**
- Quick Start wizard
- Barcode scanner page
- Bulk upload modal
- Category generation

**TODO:**
- [ ] Check `internalStatus` before allowing access
- [ ] Block premium features in maintenance/frozen states
- [ ] Show appropriate error messages
- [ ] Provide upgrade CTAs

---

## Testing Checklist

### Manual Testing Scenarios

- [ ] **Active Trial (days 1-13)**
  - No warnings shown
  - All features accessible
  - Normal capacity indicators

- [ ] **Trial Ending Soon (days 14)**
  - Warning card shows with countdown
  - Explains what happens after trial
  - Upgrade CTA visible

- [ ] **Trial Expired → Maintenance Mode**
  - Auto-downgrade to google_only tier
  - Maintenance indicator in badge
  - Can update existing products
  - Cannot add new products
  - Premium features blocked
  - Clear messaging throughout UI

- [ ] **Maintenance → Frozen**
  - Freeze indicator in badge
  - All write operations blocked
  - Read-only mode messaging
  - Storefront remains visible
  - Upgrade prompts everywhere

- [ ] **Paid Subscription (Active)**
  - No maintenance/freeze indicators
  - Normal tier limits enforced
  - All features accessible per tier

- [ ] **Paid Subscription (Expired)**
  - Expired status shown
  - Renewal prompts
  - Access blocked appropriately

---

## Implementation Notes

### Design Principles

1. **Progressive Disclosure**
   - Don't overwhelm users with warnings
   - Show relevant information at the right time
   - Provide clear next steps

2. **Consistent Messaging**
   - Use same terminology everywhere (maintenance, frozen)
   - Explain what users CAN do, not just what they can't
   - Always provide upgrade path

3. **Visual Hierarchy**
   - Critical states (frozen) use red
   - Warning states (maintenance) use yellow
   - Normal states use green/blue
   - Icons reinforce meaning

4. **User Empathy**
   - Don't make users feel punished
   - Emphasize that visibility is preserved
   - Frame upgrade as opportunity, not requirement

### Technical Decisions

**Why Mirror Backend Logic?**
- Ensures frontend and backend agree on status
- Reduces API calls (derive from existing data)
- Makes testing easier (same logic, same results)

**Why Use Centralized Helpers?**
- Fix once, apply everywhere
- Consistent behavior across all components
- Easier to maintain and update
- Type-safe with TypeScript

**Why Show Maintenance/Freeze in Badge?**
- Always visible in header
- Constant reminder of current state
- Doesn't require scrolling to see
- Subtle but clear

---

## Next Steps

1. **Immediate (This Session):**
   - Update `CreationCapacityWarning` component
   - Add maintenance/freeze banners to key pages
   - Test with different subscription states

2. **Short-term (Next Session):**
   - Update subscription settings page
   - Add feature gate checks
   - Comprehensive manual testing

3. **Medium-term (Next Week):**
   - User acceptance testing
   - Gather feedback on messaging
   - Refine visual design
   - Add analytics tracking

---

## Files Created/Modified

### Created
- ✅ `apps/web/src/lib/subscription-status.ts` (200+ lines)

### Modified
- ✅ `apps/web/src/hooks/useSubscriptionUsage.ts` - Added internal status fields
- ✅ `apps/web/src/components/subscription/SubscriptionStatusGuide.tsx` - Updated maintenance logic
- ✅ `apps/web/src/components/subscription/SubscriptionUsageBadge.tsx` - Added status indicators

### Pending
- 🚧 `apps/web/src/components/capacity/CreationCapacityWarning.tsx`
- 🚧 `apps/web/src/app/(platform)/settings/subscription/page.tsx`
- 🚧 Banner components (to be created)
- 🚧 Feature gate updates

---

## Success Metrics

**User Understanding:**
- Users understand what maintenance mode means
- Users know what they can/cannot do
- Users know how to upgrade

**Conversion:**
- Trial → Paid conversion rate
- Maintenance → Paid conversion rate
- Time from trial end to upgrade

**Support:**
- Reduced tickets about "why can't I add products"
- Reduced confusion about subscription status
- Clear self-service upgrade path

---

## Phase 4 Status: 40% Complete

**Completed:** Core infrastructure and key components  
**Remaining:** Banners, settings page, feature gates, testing

**Estimated Completion:** 1-2 more sessions
