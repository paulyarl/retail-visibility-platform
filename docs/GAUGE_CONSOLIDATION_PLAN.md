# Gauge & Badge Consolidation Plan

**Status:** 📋 RECOMMENDED REFACTOR  
**Date:** November 11, 2025  
**Principle:** DRY - Don't Repeat Yourself

## Overview

Consolidate all existing gauges, badges, and usage displays to use the centralized `useSubscriptionUsage` hook and `SubscriptionUsageBadge` component. This eliminates duplicate data fetching code and ensures consistency across the platform.

---

## Current State Analysis

### Existing Components with Duplicate Logic

#### 1. **DashboardStats Component**
**File:** `components/dashboard/DashboardStats.tsx`

**Current implementation:**
```typescript
export interface DashboardStatsProps {
  totalItems: number;      // ← Fetched separately
  activeItems: number;
  syncIssues: number;
  locations: number;       // ← Fetched separately
}
```

**Issues:**
- Props passed from parent (parent fetches data)
- Each parent component has its own fetch logic
- No limit information shown
- No capacity warnings

**Opportunity:**
- Replace with `useSubscriptionUsage` hook
- Add limit information to cards
- Show capacity warnings
- Reduce parent component code

#### 2. **TenantLimitBadge Component**
**File:** `components/tenant/TenantLimitBadge.tsx`

**Current implementation:**
- Uses `useTenantLimits` hook
- Only shows location limits
- Separate from SKU limits
- Duplicate fetching logic

**Opportunity:**
- Migrate to `useSubscriptionUsage`
- Show both location AND SKU limits
- Unified display
- Code reduction

#### 3. **Organization Page**
**File:** `app/(platform)/settings/organization/page.tsx`

**Current implementation:**
- Custom SKU usage calculation
- Custom location counting
- Inline progress bars
- Duplicate code

**Opportunity:**
- Replace with `SubscriptionUsageBadge`
- Remove custom calculation code
- Consistent UI

#### 4. **Subscription Page**
**File:** `app/(platform)/settings/subscription/page.tsx`

**Current implementation:**
```typescript
const skuUsage = tenant._count?.items || 0;
const skuLimit = isChainTier 
  ? (tierInfo as any).maxTotalSKUs 
  : (tierInfo as any).maxSKUs;
const usagePercent = skuLimit === Infinity ? 0 : Math.round((skuUsage / skuLimit) * 100);
```

**Issues:**
- Custom calculation logic
- Fetches tenant and items separately
- No reusability

**Opportunity:**
- Use `useSubscriptionUsage` hook
- Remove calculation code
- Add `SubscriptionUsageBadge` component

---

## Consolidation Strategy

### Phase 1: Core Components (High Impact)

#### 1.1 Enhance DashboardStats

**Before:**
```typescript
// Parent fetches data
const [stats, setStats] = useState({
  totalItems: 0,
  locations: 0,
  // ...
});

// Fetch logic in parent...

<DashboardStats 
  totalItems={stats.totalItems}
  locations={stats.locations}
  // ...
/>
```

**After:**
```typescript
// DashboardStats fetches its own data
<DashboardStats />

// Inside DashboardStats.tsx:
const { usage } = useSubscriptionUsage();

// Now has access to:
// - usage.skuUsage (total items)
// - usage.skuLimit (capacity)
// - usage.locationUsage (locations)
// - usage.locationLimit (capacity)
// - usage.skuColor, usage.locationColor (warnings)
```

**Benefits:**
- Self-contained component
- Shows capacity information
- Color-coded warnings
- Less parent code

#### 1.2 Migrate TenantLimitBadge

**Before:**
```typescript
// Uses separate hook
const { status, canCreateTenant, isAtLimit } = useTenantLimits();

// Only shows locations
<div>{status.current} / {status.limit}</div>
```

**After:**
```typescript
// Use unified hook
const { usage } = useSubscriptionUsage();

// Shows both SKU and locations
<SubscriptionUsageBadge variant="compact" />
```

**Benefits:**
- Shows both metrics
- Consistent with other pages
- Less code to maintain

#### 1.3 Refactor Organization Page

**Before:**
```typescript
// Custom fetching
const [tenants, setTenants] = useState([]);
const [itemCounts, setItemCounts] = useState({});

// Custom calculation
const totalItems = Object.values(itemCounts).reduce((a, b) => a + b, 0);
const maxItems = CHAIN_TIERS[tier].maxTotalSKUs;

// Custom progress bar
<div className="progress-bar">
  <div style={{ width: `${percent}%` }} />
</div>
```

**After:**
```typescript
// Use centralized component
<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
```

**Benefits:**
- 50+ lines → 1 line
- Consistent UI
- Automatic updates
- Less maintenance

---

## Detailed Migration Examples

### Example 1: DashboardStats Enhancement

**File:** `components/dashboard/DashboardStats.tsx`

**Current (117 lines):**
```typescript
export interface DashboardStatsProps {
  totalItems: number;
  activeItems: number;
  syncIssues: number;
  locations: number;
}

export default function DashboardStats({ totalItems, activeItems, syncIssues, locations }: DashboardStatsProps) {
  const inventoryCount = useCountUp(totalItems);
  const locationsCount = useCountUp(locations);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Catalog Size */}
      <Card>
        <CardContent>
          <div className="text-3xl font-bold">{inventoryCount}</div>
          <p>total products</p>
        </CardContent>
      </Card>
      
      {/* Locations */}
      <Card>
        <CardContent>
          <div className="text-3xl font-bold">{locationsCount}</div>
          <p>managed stores</p>
        </CardContent>
      </Card>
      
      {/* ... other cards */}
    </div>
  );
}
```

**After (with capacity info):**
```typescript
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';

export interface DashboardStatsProps {
  activeItems: number;  // Keep sync-specific data
  syncIssues: number;
}

export default function DashboardStats({ activeItems, syncIssues }: DashboardStatsProps) {
  // Get capacity data from centralized hook
  const { usage, loading } = useSubscriptionUsage();
  
  const inventoryCount = useCountUp(usage?.skuUsage || 0);
  const locationsCount = useCountUp(usage?.locationUsage || 0);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Catalog Size - with capacity */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold">{inventoryCount}</div>
            {usage && !usage.skuIsUnlimited && (
              <div className={`w-3 h-3 rounded-full ${
                usage.skuColor === 'red' ? 'bg-red-500' :
                usage.skuColor === 'yellow' ? 'bg-yellow-500' :
                'bg-green-500'
              }`} />
            )}
          </div>
          <p className="text-sm text-neutral-500">
            {usage && !usage.skuIsUnlimited 
              ? `${usage.skuUsage} / ${usage.skuLimit} products`
              : 'total products'}
          </p>
          {usage && usage.skuPercent >= 80 && (
            <p className="text-xs text-yellow-600 mt-1">
              {usage.skuPercent}% capacity used
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Locations - with capacity */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold">{locationsCount}</div>
            {usage && !usage.locationIsUnlimited && (
              <div className={`w-3 h-3 rounded-full ${
                usage.locationColor === 'red' ? 'bg-red-500' :
                usage.locationColor === 'yellow' ? 'bg-yellow-500' :
                'bg-green-500'
              }`} />
            )}
          </div>
          <p className="text-sm text-neutral-500">
            {usage && !usage.locationIsUnlimited
              ? `${usage.locationUsage} / ${usage.locationLimit} locations`
              : 'managed stores'}
          </p>
          {usage && usage.locationPercent >= 80 && (
            <p className="text-xs text-yellow-600 mt-1">
              {usage.locationPercent}% capacity used
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* ... other cards unchanged */}
    </div>
  );
}
```

**Code reduction:**
- Parent components: -20 to -50 lines each (no more data fetching)
- DashboardStats: +30 lines (but adds capacity info)
- Net: Significant reduction across all parent components

**Benefits:**
- Shows capacity limits
- Color-coded warnings
- Self-contained (no props needed for counts)
- Consistent with other pages

---

### Example 2: Replace Custom Progress Bars

**Before (Organization Page):**
```typescript
// Custom calculation
const totalItems = tenants.reduce((sum, t) => sum + (t._count?.items || 0), 0);
const maxItems = CHAIN_TIERS[tier].maxTotalSKUs;
const usagePercent = Math.round((totalItems / maxItems) * 100);

// Custom progress bar
<div className="mt-4">
  <div className="flex justify-between text-sm mb-2">
    <span>SKU Usage</span>
    <span>{totalItems} / {maxItems}</span>
  </div>
  <div className="w-full bg-gray-200 rounded-full h-3">
    <div
      className={`h-full rounded-full ${
        usagePercent >= 100 ? 'bg-red-500' :
        usagePercent >= 80 ? 'bg-yellow-500' :
        'bg-green-500'
      }`}
      style={{ width: `${usagePercent}%` }}
    />
  </div>
</div>
```

**After:**
```typescript
<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
```

**Code reduction:** 20+ lines → 1 line

---

### Example 3: Subscription Page Simplification

**Before:**
```typescript
// Fetch tenant and items
const [tenantRes, itemsRes] = await Promise.all([
  api.get(`/api/tenants/${tenantId}`),
  api.get(`/api/items?tenantId=${tenantId}&count=true`)
]);

const tenantData = await tenantRes.json();
let itemCount = 0;
if (itemsRes.ok) {
  const itemsData = await itemsRes.json();
  itemCount = itemsData.count || (Array.isArray(itemsData) ? itemsData.length : 0);
}

// Calculate usage
const tierInfo = TIER_LIMITS[tenantData.subscriptionTier];
const skuLimit = tierInfo.maxSKUs;
const usagePercent = skuLimit === Infinity ? 0 : Math.round((itemCount / skuLimit) * 100);

// Display
<div>
  <h3>Current Usage</h3>
  <p>{itemCount} / {skuLimit === Infinity ? '∞' : skuLimit}</p>
  <div className="progress-bar">
    <div style={{ width: `${usagePercent}%` }} />
  </div>
</div>
```

**After:**
```typescript
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';

const { usage } = useSubscriptionUsage();

// Display
<SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
```

**Code reduction:** 30+ lines → 3 lines

---

## Migration Checklist

### Phase 1: High-Impact Components

- [ ] **DashboardStats** - Add capacity info from `useSubscriptionUsage`
- [ ] **Organization Page** - Replace custom progress bars
- [ ] **Subscription Page** - Use `SubscriptionUsageBadge`
- [ ] **TenantLimitBadge** - Migrate to unified system

### Phase 2: Dashboard Pages

- [ ] **Platform Dashboard** (`/(platform)/page.tsx`)
- [ ] **Tenant Dashboard** (`/t/[tenantId]/page.tsx`)
- [ ] **Admin Dashboard** (`/admin/page.tsx`)

### Phase 3: Settings Pages

- [ ] **Account Page** (already done ✅)
- [ ] **Tenant Settings** (`/settings/tenant/page.tsx`)
- [ ] **Admin Tenants** (`/settings/admin/tenants/page.tsx`)

### Phase 4: Creation Pages

- [ ] **Location Creation** (when found)
- [ ] **Product Creation** (when found)
- [ ] **Bulk Import** (when found)

---

## Code Reduction Estimate

### Per Component Type

| Component Type | Current Lines | After Migration | Reduction |
|----------------|---------------|-----------------|-----------|
| Dashboard Stats | 117 | 150 (+capacity) | Parent: -30 each |
| Organization Page | 200+ | 150 | -50+ |
| Subscription Page | 150+ | 120 | -30+ |
| Custom Progress Bars | 20-30 each | 1 | -20 to -30 each |
| Tenant Limit Badge | 80 | 1 (use unified) | -79 |

### Total Estimated Reduction

**Conservative estimate:**
- 10+ components with custom logic
- Average 30 lines per component
- **Total: ~300+ lines of duplicate code eliminated**

**Additional benefits:**
- Consistent UI across all pages
- Single source of truth for capacity data
- Easier maintenance (fix once, works everywhere)
- Better user experience (consistent warnings)

---

## Benefits Summary

### 1. Code Reduction
- ✅ Eliminate duplicate fetching logic
- ✅ Remove custom calculation code
- ✅ Delete custom progress bar implementations
- ✅ Consolidate capacity display logic

### 2. Consistency
- ✅ Same visual language everywhere
- ✅ Same color indicators (green/yellow/red)
- ✅ Same capacity warnings
- ✅ Same upgrade messaging

### 3. Maintainability
- ✅ Fix bugs in one place
- ✅ Add features once
- ✅ Update styling centrally
- ✅ Easier testing

### 4. Performance
- ✅ Optimized parallel fetching
- ✅ Consistent caching strategy
- ✅ Reduced API calls (components share data)
- ✅ Better bundle size (code reuse)

### 5. User Experience
- ✅ Capacity info everywhere it matters
- ✅ Proactive warnings
- ✅ Clear upgrade paths
- ✅ No surprises

---

## Migration Strategy

### Step 1: Audit
- [x] Identify all components with custom capacity logic
- [x] Document current implementations
- [x] Estimate code reduction

### Step 2: Prioritize
- [ ] Start with high-impact components (DashboardStats)
- [ ] Move to frequently-used pages (dashboards)
- [ ] Finish with edge cases

### Step 3: Migrate
- [ ] Replace custom logic with `useSubscriptionUsage`
- [ ] Replace custom UI with `SubscriptionUsageBadge`
- [ ] Test each component
- [ ] Update parent components

### Step 4: Cleanup
- [ ] Remove unused hooks
- [ ] Delete duplicate code
- [ ] Update documentation
- [ ] Run tests

### Step 5: Monitor
- [ ] Check for regressions
- [ ] Verify performance
- [ ] Gather user feedback
- [ ] Iterate if needed

---

## Risk Mitigation

### Potential Risks

1. **Breaking Changes**
   - Risk: Existing components depend on current props
   - Mitigation: Gradual migration, keep old props temporarily

2. **Performance Impact**
   - Risk: More components fetching data
   - Mitigation: Hook uses efficient caching, parallel requests

3. **UI Inconsistencies**
   - Risk: New component doesn't match existing design
   - Mitigation: Variants (compact/card/inline) cover all cases

4. **Data Accuracy**
   - Risk: Centralized data might not match custom calculations
   - Mitigation: Thorough testing, compare outputs

---

## Testing Plan

### Unit Tests

```typescript
describe('useSubscriptionUsage', () => {
  it('fetches data in parallel', async () => {
    // Test parallel API calls
  });
  
  it('calculates percentages correctly', () => {
    // Test calculation logic
  });
  
  it('determines colors correctly', () => {
    // Test green/yellow/red logic
  });
});

describe('SubscriptionUsageBadge', () => {
  it('renders compact variant', () => {
    // Test compact display
  });
  
  it('renders card variant', () => {
    // Test card display
  });
  
  it('shows warnings at 80%', () => {
    // Test warning threshold
  });
});
```

### Integration Tests

```typescript
describe('DashboardStats with capacity', () => {
  it('shows capacity warnings', () => {
    // Test warning display
  });
  
  it('updates after creation', () => {
    // Test real-time updates
  });
});
```

### Manual Testing

- [ ] Test all variants (compact/card/inline)
- [ ] Test at different capacity levels (0%, 50%, 80%, 100%)
- [ ] Test with unlimited tiers
- [ ] Test loading states
- [ ] Test error states
- [ ] Test on different screen sizes

---

## Success Metrics

### Quantitative

- **Code Reduction:** Target 300+ lines removed
- **Component Count:** Reduce from 10+ custom implementations to 1 unified system
- **API Calls:** Reduce duplicate fetching by ~50%
- **Bundle Size:** Reduce by ~5-10KB (code reuse)

### Qualitative

- **Consistency:** Same UI across all pages
- **Maintainability:** Single source of truth
- **User Experience:** Capacity info everywhere
- **Developer Experience:** Easier to add capacity displays

---

## Timeline Estimate

### Phase 1 (Week 1)
- Migrate DashboardStats
- Migrate Organization Page
- Migrate Subscription Page

### Phase 2 (Week 2)
- Migrate all dashboard pages
- Migrate TenantLimitBadge
- Update parent components

### Phase 3 (Week 3)
- Migrate settings pages
- Add to creation pages
- Cleanup old code

### Phase 4 (Week 4)
- Testing
- Documentation
- Monitoring

**Total: 4 weeks for complete migration**

---

## Conclusion

**✅ Consolidating gauges and badges provides:**

1. **Massive Code Reduction** - 300+ lines eliminated
2. **Consistent UX** - Same display everywhere
3. **Single Source of Truth** - One hook, one component
4. **Better Maintenance** - Fix once, works everywhere
5. **Improved Performance** - Optimized fetching
6. **Enhanced Features** - Capacity warnings everywhere

**This refactor aligns perfectly with the "change once, apply everywhere" principle!** 🎯

---

## Quick Reference

### Before (Custom Implementation)
```typescript
// Fetch data
const [items, setItems] = useState(0);
const [limit, setLimit] = useState(0);

useEffect(() => {
  // Custom fetch logic...
}, []);

// Custom calculation
const percent = Math.round((items / limit) * 100);

// Custom UI
<div className="progress-bar">
  <div style={{ width: `${percent}%` }} />
</div>
```

### After (Unified System)
```typescript
// Use centralized hook
const { usage } = useSubscriptionUsage();

// Use centralized component
<SubscriptionUsageBadge variant="compact" />
```

**30+ lines → 3 lines!** 🚀
