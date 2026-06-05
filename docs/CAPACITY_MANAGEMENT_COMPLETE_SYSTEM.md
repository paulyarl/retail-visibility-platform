# Complete Capacity Management System

**Status:** ✅ PRODUCTION READY  
**Date:** November 11, 2025  
**Principle:** Change Once, Apply Everywhere

## Overview

Unified capacity management system that displays **both SKU and Location usage** across the entire platform with consistent data fetching and visual presentation.

---

## What's Included

### 1. SKU Capacity
- Current product count vs limit
- Tier-based limits (250 to unlimited)
- Visual progress bars
- Color-coded warnings (green/yellow/red)

### 2. Location Capacity
- Current location count vs limit
- Role and tier-based limits
- Visual progress bars
- Color-coded warnings (green/yellow/red)

### 3. Overall Status
- Worst-case indicator (SKU or Location)
- At-a-glance health check
- Critical/warning/healthy states

---

## Architecture

### Hook: `useSubscriptionUsage`

**Fetches 3 data sources in parallel:**
1. Tenant info (`/api/tenants/{id}`)
2. SKU count (`/api/items?tenantId={id}&count=true`)
3. Location limits (`/api/tenant-limits/status`)

**Returns complete usage data:**
```typescript
{
  // SKU metrics
  skuUsage, skuLimit, skuPercent, skuColor, skuStatus,
  
  // Location metrics
  locationUsage, locationLimit, locationPercent, locationColor, locationStatus,
  
  // Overall status
  overallColor, overallStatus
}
```

### Component: `SubscriptionUsageBadge`

**3 display variants:**

1. **Compact** - For headers/dashboards
   - Shows both SKU and location counts
   - Color dots for each
   - Minimal space

2. **Card** - For settings pages
   - Full plan details
   - Separate SKU section with progress bar
   - Separate location section with progress bar
   - Upgrade link

3. **Inline** - For lists
   - Tier name + SKU + Location
   - Percentages for each
   - Single line display

---

## Visual Examples

### Compact Variant

```
┌──────────────────────────────────────────────┐
│ 📦 125 / 500 🟢  |  🏢 2 / 3 🟡            │
└──────────────────────────────────────────────┘
```

**Shows:**
- SKU: 125 / 500 (green - healthy)
- Location: 2 / 3 (yellow - warning at 66%)

### Card Variant

```
┌─────────────────────────────────────────────┐
│ SKU Usage & Current Plan                    │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Current Plan              trial         │ │
│ │ Starter                                 │ │
│ │ $49/month                               │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 📦 SKU Usage              125 / 500        │
│                           25% used          │
│ [████████░░░░░░░░░░░░░░░░]                 │
│                                             │
│ 🏢 Location Usage         2 / 3            │
│                           66% used          │
│ [████████████████░░░░░░░░]                 │
│                                             │
│ → View all subscription tiers              │
└─────────────────────────────────────────────┘
```

### Inline Variant

```
📦 Starter  SKU: 125/500 25%  Loc: 2/3 66%
```

---

## Color Indicators

### Status Colors (Applied to Both SKU and Location)

| Usage % | Color | Status | Visual |
|---------|-------|--------|--------|
| 0-79% | 🟢 Green | Healthy | Good capacity |
| 80-99% | 🟡 Yellow | Warning | Approaching limit |
| 100%+ | 🔴 Red | Critical | At/over limit |

### Overall Status

**Takes worst of SKU or Location:**
- If either is red → Overall red
- If either is yellow → Overall yellow
- If both green → Overall green

**Examples:**
- SKU: 🟢 25%, Location: 🟡 85% → Overall: 🟡
- SKU: 🔴 100%, Location: 🟢 50% → Overall: 🔴
- SKU: 🟢 30%, Location: 🟢 40% → Overall: 🟢

---

## Usage Examples

### Example 1: Dashboard Header

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge variant="compact" />
```

**Result:** Compact badge showing both SKU and location with color dots

### Example 2: Account Page

```typescript
<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
```

**Result:** Full card with plan, SKU section, location section, upgrade link

### Example 3: Tenant List

```typescript
<SubscriptionUsageBadge variant="inline" tenantId={tenant.id} />
```

**Result:** Inline display with tier name, SKU, and location usage

---

## Integration Points

### Current Integrations

1. **Account Page** (`/settings/account`)
   - Variant: `card`
   - Shows: Full capacity details
   - Status: ✅ Implemented

### Recommended Integrations

2. **Dashboard** (`/`)
   - Variant: `compact`
   - Location: Header
   - Shows: Quick capacity check

3. **Tenant Dashboard** (`/t/:id`)
   - Variant: `compact`
   - Location: Top bar
   - Shows: Current tenant capacity

4. **Settings Overview** (`/settings`)
   - Variant: `inline`
   - Location: Subscription card
   - Shows: Quick status

---

## Benefits

### ✅ Complete Capacity View

**Before:**
- SKU usage in one place
- Location usage in another place
- No unified view

**After:**
- Both metrics together
- Single source of truth
- Consistent display everywhere

### ✅ Early Warning System

**Proactive alerts:**
- Yellow at 80% (either SKU or location)
- Red at 100% (either SKU or location)
- Users can plan ahead
- Reduces surprise limit hits

### ✅ Change Once, Apply Everywhere

**Centralized logic:**
- Update hook → all pages updated
- Fix bug → fixed everywhere
- Add feature → available everywhere
- Consistent UX across platform

### ✅ Performance Optimized

**Parallel fetching:**
- 3 API calls in parallel
- Fast load times
- Efficient data retrieval
- Minimal overhead

---

## API Calls

### Data Sources

**Hook makes 3 parallel API calls:**

1. **Tenant Info:**
   ```
   GET /api/tenants/{tenantId}
   ```
   Returns: tier, status, name, metadata

2. **SKU Count:**
   ```
   GET /api/items?tenantId={tenantId}&count=true
   ```
   Returns: product count

3. **Location Limits:**
   ```
   GET /api/tenant-limits/status
   ```
   Returns: current locations, limit, tier

**All fetched in parallel for optimal performance**

---

## Real-World Scenarios

### Scenario 1: Approaching SKU Limit

```
User has:
- SKU: 450 / 500 (90% - Yellow warning)
- Location: 1 / 3 (33% - Green)

Display:
- SKU progress bar: Yellow
- Location progress bar: Green
- Overall status: Yellow (warning)
- Message: "Approaching SKU limit"
```

### Scenario 2: At Location Limit

```
User has:
- SKU: 200 / 500 (40% - Green)
- Location: 3 / 3 (100% - Red critical)

Display:
- SKU progress bar: Green
- Location progress bar: Red
- Overall status: Red (critical)
- Message: "Location limit reached"
- Upgrade prompt shown
```

### Scenario 3: Both Critical

```
User has:
- SKU: 500 / 500 (100% - Red)
- Location: 3 / 3 (100% - Red)

Display:
- SKU progress bar: Red
- Location progress bar: Red
- Overall status: Red (critical)
- Message: "Both limits reached"
- Strong upgrade prompt
```

### Scenario 4: Unlimited Tier

```
User has:
- SKU: 5000 / ∞ (Unlimited)
- Location: 15 / ∞ (Unlimited)

Display:
- No progress bars (unlimited)
- Shows counts only
- Overall status: Green (healthy)
- No upgrade prompts
```

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
  return null; // Gracefully hide
}
```

### Missing Data
- Defaults to 0 if counts unavailable
- Shows "N/A" if tier info missing
- Never breaks the page

---

## Testing

### Test Matrix

| SKU % | Location % | Overall | Display |
|-------|------------|---------|---------|
| 25% | 33% | 🟢 Green | Both healthy |
| 85% | 40% | 🟡 Yellow | SKU warning |
| 50% | 90% | 🟡 Yellow | Location warning |
| 100% | 50% | 🔴 Red | SKU critical |
| 60% | 100% | 🔴 Red | Location critical |
| 100% | 100% | 🔴 Red | Both critical |
| ∞ | ∞ | 🟢 Green | Unlimited |

### Test Cases

1. **Healthy State**
   - Both under 80%
   - Green indicators
   - No warnings

2. **Warning State**
   - Either 80-99%
   - Yellow indicator
   - Warning message

3. **Critical State**
   - Either 100%+
   - Red indicator
   - Upgrade prompt

4. **Unlimited**
   - Shows ∞ symbol
   - No progress bars
   - No warnings

5. **Loading**
   - Shows loading state
   - No errors

6. **Error**
   - Gracefully hides
   - No console errors

---

## Migration Guide

### Migrating Existing Pages

**Before (separate displays):**
```typescript
// SKU usage
const [skuData, setSkuData] = useState(null);
// ... fetch logic

// Location usage
const [locationData, setLocationData] = useState(null);
// ... fetch logic

// Display separately
<div>SKUs: {skuData}</div>
<div>Locations: {locationData}</div>
```

**After (unified display):**
```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
```

**200+ lines → 1 line!**

---

## Future Enhancements

### Phase 2 Ideas

1. **Predictive Alerts**
   - "At current rate, you'll hit limit in 14 days"
   - Proactive upgrade suggestions

2. **Historical Trends**
   - Usage over time charts
   - Growth projections
   - Capacity planning tools

3. **Smart Recommendations**
   - AI-powered tier suggestions
   - Cost optimization tips
   - Usage pattern analysis

4. **Real-time Updates**
   - WebSocket for live counts
   - Instant limit updates
   - No page refresh needed

5. **Bulk Actions**
   - "Upgrade all locations" button
   - Batch capacity management
   - Multi-tenant operations

---

## Related Systems

### Integrates With

1. **Tenant Limits System**
   - Location creation enforcement
   - Ownership transfer checks
   - Platform role limits

2. **SKU Limits System**
   - Product creation enforcement
   - Tier-based restrictions
   - Upload limits

3. **Subscription System**
   - Tier management
   - Upgrade flows
   - Billing integration

---

## Key Files

### Core Files

- `apps/web/src/hooks/useSubscriptionUsage.ts` - Data hook
- `apps/web/src/components/subscription/SubscriptionUsageBadge.tsx` - UI component

### Integration Examples

- `apps/web/src/app/(platform)/settings/account/page.tsx` - Card variant

### Related Files

- `apps/web/src/hooks/useTenantLimits.ts` - Location limits
- `apps/web/src/lib/tiers.ts` - Tier configuration
- `apps/api/src/routes/tenant-limits.ts` - Location limits API
- `apps/api/src/routes/items.ts` - SKU count API

---

## Quick Reference

### Import

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
```

### Basic Usage

```typescript
// Compact (both SKU and location)
<SubscriptionUsageBadge variant="compact" />

// Full card (both sections with progress bars)
<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />

// Inline (both metrics in one line)
<SubscriptionUsageBadge variant="inline" />

// Custom hook (raw data)
const { usage, loading, error } = useSubscriptionUsage();
// usage.skuUsage, usage.locationUsage, usage.overallStatus
```

---

## Conclusion

**✅ Complete capacity management system is production ready!**

This system provides:
- ✅ Unified SKU and location usage display
- ✅ Consistent UI across all pages
- ✅ Early warning system (80% threshold)
- ✅ Overall health status
- ✅ Easy to integrate (1 line of code)
- ✅ Easy to maintain (change once, apply everywhere)
- ✅ Performance optimized (parallel fetching)
- ✅ Graceful error handling

**Use this system for all capacity displays moving forward!** 🎯

---

## Summary

**What makes this system complete:**

1. **Dual Metrics** - SKU + Location in one place
2. **Three Variants** - Compact, card, inline for different contexts
3. **Color Coding** - Green/yellow/red for instant status
4. **Overall Status** - Worst-case indicator for quick health check
5. **Reusable** - One component, many pages
6. **Maintainable** - Change once, apply everywhere
7. **Performant** - Parallel API calls
8. **User-Friendly** - Clear visual indicators and upgrade paths

**This is the complete capacity management solution!** 🚀
