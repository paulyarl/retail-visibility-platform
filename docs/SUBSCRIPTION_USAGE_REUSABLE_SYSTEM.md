# Subscription Usage Reusable System

**Status:** ✅ PRODUCTION READY  
**Date:** November 11, 2025  
**Principle:** Change Once, Apply Everywhere

## Overview

Centralized subscription usage display system that can be used across multiple pages (account, dashboard, settings, etc.) with consistent data fetching and visual presentation.

---

## Architecture

### 1. Hook: `useSubscriptionUsage`

**Location:** `apps/web/src/hooks/useSubscriptionUsage.ts`

**Purpose:** Centralized data fetching for subscription and SKU usage

**Returns:**
```typescript
{
  usage: SubscriptionUsage | null,
  loading: boolean,
  error: string | null
}
```

**SubscriptionUsage Interface:**
```typescript
{
  // Tenant info
  tenantId: string;
  tenantName: string;
  
  // Subscription details
  tier: SubscriptionTier;
  tierName: string;
  tierPrice: string;
  tierDescription: string;
  status: string;
  
  // SKU usage
  skuUsage: number;
  skuLimit: number;
  skuPercent: number;
  skuIsUnlimited: boolean;
  
  // Visual indicators
  usageColor: 'green' | 'yellow' | 'red';
  usageStatus: 'healthy' | 'warning' | 'critical';
  
  // Metadata
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
}
```

### 2. Component: `SubscriptionUsageBadge`

**Location:** `apps/web/src/components/subscription/SubscriptionUsageBadge.tsx`

**Purpose:** Reusable UI component with multiple display variants

**Variants:**
1. **compact** - Small badge for headers/dashboards
2. **card** - Full card display for settings pages
3. **inline** - Inline display for lists

---

## Usage Examples

### Example 1: Account Page (Card Variant)

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge 
  variant="card" 
  showUpgradeLink={true} 
/>
```

**Result:** Full card with plan details, SKU usage, progress bar, and upgrade link

### Example 2: Dashboard Header (Compact Variant)

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge variant="compact" />
```

**Result:** Small badge showing "125 / 500" with color indicator

### Example 3: Tenant List (Inline Variant)

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge 
  variant="inline" 
  tenantId="specific-tenant-id" 
/>
```

**Result:** Inline display with tier name and usage

### Example 4: Custom Tenant ID

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge 
  variant="card" 
  tenantId={customTenantId}
  showUpgradeLink={true}
/>
```

**Result:** Shows data for specific tenant instead of current tenant

---

## Visual Variants

### Compact Variant

```
┌─────────────────────────┐
│ 📦 125 / 500  🟢        │
└─────────────────────────┘
```

**Features:**
- Package icon
- Current / Limit display
- Color dot (green/yellow/red)
- Minimal space usage

### Card Variant

```
┌─────────────────────────────────────┐
│ SKU Usage & Current Plan            │
│ Your product usage and subscription │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Current Plan          trial     │ │
│ │ Starter                         │ │
│ │ $49/month                       │ │
│ │ Get started with the basics     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📦 SKU Usage          125 / 500    │
│                       25% used      │
│ [████████░░░░░░░░░░░░░░]           │
│                                     │
│ → View all subscription tiers      │
└─────────────────────────────────────┘
```

**Features:**
- Full plan details
- SKU usage with progress bar
- Color-coded warnings
- Upgrade link

### Inline Variant

```
📦 Starter    125 / 500    25%
```

**Features:**
- Tier name
- Usage count
- Percentage
- Compact single line

---

## Color Indicators

### Usage Status Colors

| Usage % | Color | Status | Meaning |
|---------|-------|--------|---------|
| 0-79% | 🟢 Green | Healthy | Plenty of capacity |
| 80-99% | 🟡 Yellow | Warning | Approaching limit |
| 100%+ | 🔴 Red | Critical | At or over limit |

### Visual Examples

**Healthy (25% used):**
```
[████████░░░░░░░░░░░░░░░░] 🟢
```

**Warning (85% used):**
```
[████████████████████░░░░] 🟡
```

**Critical (100% used):**
```
[████████████████████████] 🔴
```

---

## Integration Points

### Current Integrations

1. **Account Page** (`/settings/account`)
   - Variant: `card`
   - Shows: Full plan + usage + upgrade link
   - Status: ✅ Implemented

### Recommended Integrations

2. **Dashboard** (`/`)
   - Variant: `compact`
   - Location: Header next to TenantLimitBadge
   - Shows: Quick usage indicator

3. **Tenant Dashboard** (`/t/:id`)
   - Variant: `compact`
   - Location: Top bar
   - Shows: Current tenant usage

4. **Settings Overview** (`/settings`)
   - Variant: `inline`
   - Location: Subscription card
   - Shows: Quick status

5. **Subscription Page** (`/settings/subscription`)
   - Variant: `card` or custom
   - Location: Top of page
   - Shows: Current usage before tier options

---

## Benefits

### ✅ Change Once, Apply Everywhere

**Before:**
- Each page had custom SKU usage code
- Duplicate data fetching logic
- Inconsistent display formats
- Hard to maintain

**After:**
- Single hook for data fetching
- Single component for display
- Consistent across all pages
- Update once, fixes everywhere

### ✅ Consistent UX

- Same visual language everywhere
- Same color indicators
- Same progress bar style
- Same upgrade messaging

### ✅ Easy Maintenance

- Fix bugs in one place
- Add features once
- Update styling centrally
- Refactor safely

### ✅ Performance

- Shared data fetching logic
- Optimized API calls
- Consistent caching strategy
- Reduced bundle size (reuse)

---

## API Calls

### Data Sources

**Hook makes 2 parallel API calls:**

1. **Tenant Info:**
   ```
   GET /api/tenants/{tenantId}
   ```
   Returns: tier, status, name, metadata

2. **SKU Count:**
   ```
   GET /api/items?tenantId={tenantId}&count=true
   ```
   Returns: item count

**Parallel fetching ensures fast load times**

---

## Error Handling

### Loading State

```typescript
if (loading) {
  return <div>Loading...</div>;
}
```

### Error State

```typescript
if (error || !usage) {
  return null; // Gracefully hide if error
}
```

**Errors don't break the page - component just doesn't render**

---

## Customization

### Props

```typescript
interface SubscriptionUsageBadgeProps {
  variant?: 'compact' | 'card' | 'inline';
  showUpgradeLink?: boolean;
  tenantId?: string;
  className?: string;
}
```

### Examples

**Custom styling:**
```typescript
<SubscriptionUsageBadge 
  variant="compact" 
  className="shadow-lg border-2"
/>
```

**Specific tenant:**
```typescript
<SubscriptionUsageBadge 
  variant="card" 
  tenantId="tenant-123"
/>
```

**No upgrade link:**
```typescript
<SubscriptionUsageBadge 
  variant="card" 
  showUpgradeLink={false}
/>
```

---

## Testing

### Test Cases

1. **Loading State**
   - Shows loading indicator
   - No errors thrown

2. **Error State**
   - Gracefully hides component
   - No console errors

3. **Healthy Usage (< 80%)**
   - Green indicator
   - Correct percentage
   - Progress bar accurate

4. **Warning Usage (80-99%)**
   - Yellow indicator
   - Warning message
   - Upgrade prompt

5. **Critical Usage (100%+)**
   - Red indicator
   - Critical message
   - Strong upgrade prompt

6. **Unlimited Tier**
   - Shows ∞ symbol
   - No progress bar
   - No percentage

7. **Different Variants**
   - Compact renders correctly
   - Card renders correctly
   - Inline renders correctly

---

## Migration Guide

### Migrating Existing Pages

**Step 1: Remove custom code**
```typescript
// ❌ Remove this
const [tenantData, setTenantData] = useState<any>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  // ... custom fetching logic
}, []);
```

**Step 2: Add component**
```typescript
// ✅ Add this
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
```

**That's it! 100+ lines → 1 line**

---

## Future Enhancements

### Phase 2 Ideas

1. **Real-time Updates**
   - WebSocket for live usage updates
   - Auto-refresh on SKU changes

2. **Historical Trends**
   - Usage over time chart
   - Growth projections

3. **Alerts**
   - Email when approaching limit
   - In-app notifications

4. **Comparison**
   - Show usage vs other tenants
   - Industry benchmarks

5. **Recommendations**
   - AI-powered tier suggestions
   - Cost optimization tips

---

## Related Files

### Core Files

- `apps/web/src/hooks/useSubscriptionUsage.ts` - Data hook
- `apps/web/src/components/subscription/SubscriptionUsageBadge.tsx` - UI component

### Integration Examples

- `apps/web/src/app/(platform)/settings/account/page.tsx` - Card variant
- (Future) Dashboard - Compact variant
- (Future) Tenant Dashboard - Compact variant

### Related Systems

- `apps/web/src/hooks/useTenantLimits.ts` - Location limits hook
- `apps/web/src/components/tenant/TenantLimitBadge.tsx` - Location limits badge
- `apps/web/src/lib/tiers.ts` - Tier configuration

---

## Conclusion

**✅ Reusable subscription usage system is production ready!**

This system provides:
- ✅ Single source of truth for subscription data
- ✅ Consistent UI across all pages
- ✅ Easy to integrate (1 line of code)
- ✅ Easy to maintain (change once, apply everywhere)
- ✅ Graceful error handling
- ✅ Multiple display variants
- ✅ Performance optimized

**Use this system for all subscription usage displays moving forward!** 🎯

---

## Quick Reference

### Import

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
```

### Basic Usage

```typescript
// Compact badge
<SubscriptionUsageBadge variant="compact" />

// Full card
<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />

// Inline display
<SubscriptionUsageBadge variant="inline" />

// Custom hook (if you need raw data)
const { usage, loading, error } = useSubscriptionUsage();
```

**That's all you need to know!** 🚀
