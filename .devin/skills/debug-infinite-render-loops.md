# Debug Infinite Render Loops

## Overview
This skill provides a systematic approach to debugging infinite render loops, repeated API calls, and unexpected page reloads in React/Next.js applications.

## Problem Indicators
- Repeated API calls to the same endpoint at regular intervals
- Console logs showing component re-renders every N seconds
- Network tab showing duplicate requests
- Page appearing to "reload" (may be client-side re-render, not full page reload)

## Investigation Checklist

### 1. Identify the Pattern
- **Check timing**: Is it 2 seconds? 6 seconds? 30 seconds? This hints at the source.
- **Check scope**: Is it full page reloads or client-side re-renders?
- **Check location**: Does it happen on all pages or specific routes?

### 2. Check React Query Configuration
```bash
# Search for refetchInterval
grep -r "refetchInterval" src/
```

**Common culprits:**
- `refetchInterval: 30 * 1000` or similar
- `refetchOnWindowFocus: true` (default behavior)
- Multiple queries with overlapping keys

**Action:**
- Remove unnecessary `refetchInterval` values
- Set `refetchOnWindowFocus: false` for non-critical data
- Check if interval matches the observed timing

### 3. Check for Redirect Loops
```bash
# Search for router.push
grep -r "router.push" src/

# Search for window.location
grep -r "window.location" src/
```

**Common culprits:**
- Unconditional `router.push` in `useEffect` without guards
- Auth redirects that trigger each other
- `window.location.href` or `window.location.reload()` in periodic code

**Action:**
- Add `useRef` guards to prevent repeated redirects
- Check redirect conditions are stable
- Verify redirect doesn't lead back to the same page

### 4. Add Verbose Logging
Add timestamped logging to key components to track execution flow:

```typescript
const renderCount = useRef(0);
const timestamp = new Date().toISOString();
renderCount.current++;
console.log(`[ComponentName] render #${renderCount.current} at ${timestamp}`);

useEffect(() => {
  const effectTimestamp = new Date().toISOString();
  console.log(`[ComponentName] effect at ${effectTimestamp}`);
  // ... effect logic
}, [dependencies]);
```

**Key places to log:**
- Layout components (server and client)
- Auth gates and route guards
- Data fetching hooks
- Components that use `useEffect` with dependencies

### 5. Check Global Components
Hooks used in global components (like `ClientRootLayout`) run on **all pages**:

```bash
# Find components used in ClientRootLayout
grep -r "useNavLinks\|useAuth\|useTenant" src/components/ClientRootLayout.tsx
```

**Common culprits:**
- Navigation hooks fetching on public pages
- Auth state changes triggering re-fetches
- Context providers re-rendering

**Action:**
- Add pathname checks to skip loading on public pages
- Only fetch when on relevant routes (e.g., `/t/*`, `/admin/*`)
- Use guards to prevent re-fetching when data is already loaded

### 6. Add Guards to Prevent Repeated Execution
Use `useRef` to track if an action has already been performed:

```typescript
const hasExecutedRef = useRef(false);

useEffect(() => {
  if (hasExecutedRef.current) {
    console.log(`[Hook] skipping - already executed`);
    return;
  }
  hasExecutedRef.current = true;
  
  // ... perform action
}, [dependencies]);
```

**Common use cases:**
- Redirect attempts
- `localStorage` writes
- API calls that should only happen once
- Initial data loading

### 7. Check Auth State Changes
OAuth token refresh can cause auth state changes that trigger re-renders:

```typescript
// Check if hook depends on isAuthenticated
const { isAuthenticated } = useAuth();

// If isAuthenticated changes, all dependent hooks re-run
```

**Action:**
- Add guards to prevent re-fetching when auth state changes but data is already loaded
- Use stable cache keys that don't depend on auth state
- Consider if the hook really needs to re-fetch on auth changes

## Solution Pattern

### For Repeated Data Fetching
```typescript
export function useData() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  
  const load = useCallback(() => {
    // Skip if not authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    // Skip if already loaded (prevents re-fetch on auth state changes)
    if (hasLoadedRef.current && data) {
      return;
    }
    
    setLoading(true);
    fetchData().then(result => {
      setData(result);
      setLoading(false);
      hasLoadedRef.current = true;
    });
  }, [isAuthenticated, data]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { data, loading };
}
```

### For Route-Specific Loading
```typescript
export function useData() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
  // Only load on specific routes
  const shouldLoad = pathname?.startsWith('/t/') || 
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/settings');
  
  useEffect(() => {
    if (!isAuthenticated || !shouldLoad) {
      return;
    }
    // ... load data
  }, [isAuthenticated, shouldLoad]);
}
```

## Case Study: Today's Session

### Problem
Dashboard making repeated calls to `/api/tenants/tid-m8ijkrnk` every ~2 seconds.

### Investigation
1. Checked `refetchInterval` - found 30-second intervals, not 2-second
2. Removed unnecessary `refetchInterval` from `TenantDashboardV2.tsx` and `CrmTenantWidget.tsx`
3. Added verbose logging with timestamps
4. Added guards to `TenantAuthGate`, `SetTenantId`, `RememberTenantRoute`
5. Logs showed client-side re-renders every 6 seconds, not full page reloads
6. `useNavLinks` was being called repeatedly due to auth state changes

### Root Cause
- `useNavLinks` hook used by `CommandPalette` in `ClientRootLayout` (global component)
- OAuth token refresh causing auth state changes
- Hook re-fetching on every auth state change
- Hook was loading on public pages unnecessarily

### Solution
1. Added `hasLoadedRef` guard to prevent re-fetching when data is already loaded
2. Added pathname check to skip loading on public pages
3. Added `useRef` import to fix missing import error

### Files Modified
- `apps/web/src/hooks/useNavLinks.tsx` - Added guards and pathname check
- `apps/web/src/components/tenant/TenantAuthGate.tsx` - Added redirect guard
- `apps/web/src/components/client/SetTenantId.tsx` - Added execution guard
- `apps/web/src/components/client/RememberTenantRoute.tsx` - Added pathname change guard
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx` - Removed `refetchInterval`
- `apps/web/src/components/crm/CrmTenantWidget.tsx` - Removed `refetchInterval`

## Quick Reference

### Common Intervals and Their Sources
- **2 seconds**: `setInterval(..., 2000)` - Check for explicit intervals
- **5 seconds**: `setInterval(..., 5000)` - Common for polling
- **6 seconds**: Often auth state changes (OAuth token refresh)
- **30 seconds**: `refetchInterval: 30 * 1000` - React Query default
- **5 minutes**: Cache TTL defaults

### Debugging Commands
```bash
# Find all refetchInterval
grep -rn "refetchInterval" src/

# Find all setInterval
grep -rn "setInterval" src/

# Find router.push
grep -rn "router.push" src/

# Find window.location
grep -rn "window.location" src/

# Find useEffect with pathname
grep -rn "useEffect.*pathname" src/
```

### Key Principles
1. **Distinguish reload types**: Full page reload vs client-side re-render
2. **Use verbose logging**: Timestamps are crucial for timing issues
3. **Check global components**: Hooks in `ClientRootLayout` run everywhere
4. **Add guards**: `useRef` flags prevent repeated execution
5. **Route-specific loading**: Only fetch on relevant pages
6. **Auth state awareness**: Auth changes can trigger cascading re-renders
