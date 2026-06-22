---
description: How to audit and optimize dashboard data-fetching performance (reduce API waterfalls, eliminate duplicate calls, prevent cascading re-renders)
---

# Dashboard Performance Audit & Optimization

Use this skill when a dashboard page has excessive API calls, network request waterfalls, or visible re-render thrash. This is a systematic audit-and-fix process, not a feature addition.

## Symptoms That Trigger This Skill

- Network tab shows duplicate calls to the same endpoints on a single page load
- Dashboard takes 3+ seconds to become interactive even on fast connections
- Components flicker or re-render visibly after initial load
- `useEffect` + `setInterval` polling patterns causing continuous background requests
- Console spam from per-render logging in hot paths
- A single hook change cascades re-renders through 5+ child components

## The 4-Phase Audit Process

### Phase 1: Identify the Hot Paths

1. **Open the Network tab** and load the dashboard. Sort by waterfall timeline.
2. **Group identical URLs** — any endpoint called 2+ times per page load is a dedup candidate.
3. **Identify the component tree** — trace which components mount on the dashboard and which hooks they call.
4. **Check for `setInterval` patterns** — grep for `setInterval` in dashboard components. Each one is a manual polling loop that React Query's `refetchInterval` can replace.

```bash
# Find all manual polling in dashboard components
grep -rn "setInterval" apps/web/src/components/dashboard/
grep -rn "setInterval" apps/web/src/components/crm/
grep -rn "setInterval" apps/web/src/components/bot/
```

5. **Check for console.log in hot paths** — these fire on every render and obscure real issues.

```bash
grep -rn "console.log" apps/web/src/hooks/dashboard/
grep -rn "console.log" apps/web/src/components/dashboard/
```

### Phase 2: Eliminate Duplicate Fetches with React Query

**The core problem:** Raw `useEffect` + `useState` fetches don't deduplicate. If two components fetch the same data, you get two network calls. React Query deduplicates by `queryKey` automatically.

**Conversion pattern:**

```tsx
// BEFORE — raw useEffect, no dedup, no caching
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  service.getData(tenantId)
    .then(setData)
    .finally(() => setLoading(false));
}, [tenantId]);

// AFTER — React Query with dedup, caching, and staleTime
const { data, isLoading: loading } = useQuery({
  queryKey: ['namespace', 'resource', tenantId],
  queryFn: () => service.getData(tenantId),
  enabled: !!tenantId,
  staleTime: 60 * 1000,  // 1 minute — don't refetch on re-mount
  retry: 0,               // don't retry failed fetches (prevents waterfall noise)
});
```

**Key decisions:**

| Option | When to use | Value |
|---|---|---|
| `staleTime` | Data changes infrequently (profiles, settings, FAQs) | `60 * 1000` (60s) |
| `staleTime` | Data changes moderately (CRM stats, bot stats) | `30 * 1000` (30s) |
| `refetchInterval` | Replaces manual `setInterval` polling | Match the old interval |
| `retry: 0` | Dashboard widgets — failed fetches shouldn't retry-spam | Always for widgets |
| `throwOnError: false` | Widget shouldn't crash the whole dashboard if one fetch fails | Always for widgets |
| `enabled` | Gate fetches on required params (tenantId, user) | `!!tenantId` |

**Query key namespacing convention:**

```
['tenant', 'info', tenantId]          // useTenantComplete
['tenant', 'business-profile', tenantId]  // TenantDashboardV2
['tenant', 'faqs', tenantId]          // TenantDashboardV2
['tenant', 'users', tenantId]         // CrmTenantWidget
['crm', 'stats', tenantId]            // CrmTenantWidget
['bot', 'config', tenantId]           // BotTenantWidget
['bot', 'dashboard', tenantId]        // BotTenantWidget
['bot', 'conversations', tenantId, { limit: 5 }]  // BotTenantWidget
```

When multiple components use the same query key, React Query returns the cached data instantly — zero extra network calls.

### Phase 3: Prevent Cascading Re-renders

**Problem:** A hook returns a new object reference on every render. Every consumer re-renders even when the data hasn't changed.

**Fix pattern — memoize the hook's return value:**

```tsx
// BEFORE — new object every render, all consumers re-render
return {
  tenant,
  tier,
  usage,
  hasFeature: (id: string) => hasFeature(tier, id),  // new function each render
  // ...
};

// AFTER — memoized, consumers only re-render when values actually change
const hasFeatureCb = useCallback((id: string) => hasFeature(tier, id), [tier]);

return useMemo(() => ({
  tenant,
  tier,
  usage,
  hasFeature: hasFeatureCb,
  // ...
}), [tenant, tier, usage, hasFeatureCb]);
```

**Rules:**
1. Wrap every function in the return value with `useCallback`
2. Wrap every derived object/array with `useMemo`
3. Wrap the final return object with `useMemo` listing all dependencies
4. Remove `console.log` statements from hot paths — they fire on every render

### Phase 4: Replace Manual Polling with `refetchInterval`

**Before:**
```tsx
useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 30000);
  return () => clearInterval(interval);
}, [loadData]);
```

**After:**
```tsx
const { data } = useQuery({
  queryKey: ['crm', 'stats', tenantId],
  queryFn: () => service.getStats(),
  refetchInterval: 30 * 1000,
  staleTime: 30 * 1000,
});
```

**Benefits:**
- No manual cleanup needed
- Pauses automatically when tab is inactive (React Query default)
- Deduplicates with any other component using the same query key
- No `setInterval` leak risk

## Post-Conversion Checklist

After converting a component from raw fetches to React Query:

- [ ] All `useState` for server data removed (only UI state like modals/tabs remains)
- [ ] All `useEffect` for data fetching removed (only side-effects like analytics tracking remain)
- [ ] `useCallback` wrapper removed if it was only used for the fetch function
- [ ] Query keys follow the namespacing convention
- [ ] `staleTime` set appropriately for the data freshness requirement
- [ ] `retry: 0` set for widget components
- [ ] `enabled` gate set if fetch depends on a prop
- [ ] Error states handled (either via `error` from `useQuery` or `throwOnError: false`)
- [ ] Loading state uses `isLoading && !data` to prevent flash on refetch
- [ ] No `console.log` in the hot render path
- [ ] TypeScript compiles clean: `npx tsc --noEmit --project apps/web`

## Common Pitfalls

### 1. Loading state flash on refetch
```tsx
// BAD — shows spinner on every 30s refetch
if (loading) return <Spinner />;

// GOOD — only shows spinner on initial load, not refetch
if (loading && !data) return <Spinner />;
```

### 2. Missing `enabled` gate causes fetch with undefined params
```tsx
// BAD — fires fetch with tenantId=undefined
const { data } = useQuery({
  queryKey: ['tenant', 'profile', tenantId],
  queryFn: () => getProfile(tenantId),
});

// GOOD — waits until tenantId is available
const { data } = useQuery({
  queryKey: ['tenant', 'profile', tenantId],
  queryFn: () => getProfile(tenantId),
  enabled: !!tenantId,
});
```

### 3. Cache invalidation after mutations
```tsx
// After creating/updating data, invalidate the query to trigger refetch
const queryClient = useQueryClient();

async function handleCreate() {
  await service.createItem(data);
  await queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
}
```

### 4. Optimistic updates for toggle actions
```tsx
// For simple status toggles, update cache directly instead of refetching
const queryClient = useQueryClient();

async function handleToggle() {
  const updated = await service.updateStatus(newStatus);
  queryClient.setQueryData(['bot', 'config', tenantId], updated);
}
```

### 5. Field name verification
When converting from `useState<any>` to typed `useQuery` data, TypeScript will catch field name mismatches that were previously hidden. Always verify field names against the actual API response (curl the endpoint) before casting to `any`.

## Verification

```bash
# Type check
npx tsc --noEmit --project apps/web

# Check for remaining raw fetches in dashboard components
grep -rn "useEffect.*\n.*service\.\|useEffect.*\n.*fetch\(" apps/web/src/components/dashboard/ apps/web/src/components/crm/ apps/web/src/components/bot/

# Check for remaining setInterval patterns
grep -rn "setInterval" apps/web/src/components/dashboard/ apps/web/src/components/crm/ apps/web/src/components/bot/

# Check for console.log in hot paths
grep -rn "console.log" apps/web/src/hooks/dashboard/ apps/web/src/components/dashboard/
```

## Files Modified in the Original Audit (Reference)

| File | Change |
|---|---|
| `apps/web/src/hooks/dashboard/useTenantComplete.ts` | Removed console.log, memoized return value + all helpers with `useMemo`/`useCallback` |
| `apps/web/src/components/dashboard/TenantDashboardV2.tsx` | Removed console.log, converted 3 `useEffect` fetches to `useQuery` |
| `apps/web/src/components/bot/BotTenantWidget.tsx` | Converted 3 `useEffect`+`useState` fetches to `useQuery`, added `useQueryClient` for optimistic toggle |
| `apps/web/src/components/crm/CrmTenantWidget.tsx` | Converted `setInterval` polling + 12 `useState` to 2 `useQuery` calls with `refetchInterval`, moved toast logic to `useEffect` watching query data |
