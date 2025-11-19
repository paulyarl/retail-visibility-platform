# Phase 2: Architecture Refactor

**Status:** 🟡 IN PROGRESS - Foundation fixes complete, now optimizing architecture  
**Timeline:** Week 3-4 (2 weeks)  
**Priority:** High - Fix the foundation for long-term maintainability

## Executive Summary

With Phase 1 emergency fixes deployed, Phase 2 focuses on **architectural refactoring** to eliminate the root causes of the tier system conflicts. The goal is to break down the monolithic `useTenantTier.ts` hook (430+ lines) into focused, maintainable components and create a unified access control system.

## Current Architecture Problems

### 🔴 Monolithic Hook Issue
```typescript
// Current: useTenantTier.ts (430+ lines)
export function useTenantTier(tenantId: string | null): UseTenantTierReturn {
  // 65 lines of state management
  const [tier, setTier] = useState<ResolvedTier | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canSupport, setCanSupport] = useState(false);
  const [userRole, setUserRole] = useState<UserTenantRole | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // 100+ lines of data fetching logic
  const fetchTierData = async () => { /* complex logic */ };

  // 50+ lines of helper functions
  const checkFeature = (featureId: string): boolean => { /* logic */ };
  const getBadge = (featureId: string): TierBadge | null => { /* logic */ };
  
  // 100+ lines of permission logic
  const canAccess = (featureId: string, permissionType: PermissionType): boolean => { /* logic */ };
  
  // 50+ lines of return object
  return { /* massive object */ };
}
```

### 🔴 Duplicate System Issue
```typescript
// Two competing access control systems:

// System 1: useTenantTier.ts (430 lines) - Multi-level: tier + role
const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);

// System 2: useTierAccess.ts (102 lines) - Tier-only
const { hasFeature, requiresUpgrade } = useTierAccess(tenant.subscriptionTier);

// Result: Confusion about which system to use
```

### 🔴 API Call Waterfall Issue
```typescript
// Current: 3-4 sequential API calls
1. GET /auth/me (user profile + platform role)
2. GET /api/tenants/:id/tier (tenant + org tier data)
3. GET /api/tenants/:id/usage (usage statistics)
4. GET /api/users/:id/tenants/:tenantId (user role on tenant)

// Result: 800ms+ loading time, poor caching
```

---

## 🎯 Phase 2 Goals

### 2.1 Decompose Monolithic Hook
**Goal:** Break `useTenantTier.ts` (430 lines) into focused, single-responsibility hooks

### 2.2 Eliminate Duplicate Systems
**Goal:** Merge `useTierAccess.ts` functionality into unified system

### 2.3 Create Unified API
**Goal:** Replace 3-4 API calls with single comprehensive endpoint

### 2.4 Implement Smart Caching
**Goal:** Add React Query for intelligent caching and background refresh

---

## 🏗️ New Architecture Design

### Proposed Hook Structure
```
hooks/tenant-access/
├── index.ts                     # Main export
├── types.ts                     # Shared interfaces
├── useTenantAccess.ts          # 🎯 Main hook (80 lines)
├── hooks/
│   ├── useTierData.ts          # Tier fetching (60 lines)
│   ├── useUserRole.ts          # Role detection (40 lines)
│   ├── useFeatureAccess.ts     # Feature checking (60 lines)
│   └── useUsageData.ts         # Usage statistics (40 lines)
├── utils/
│   ├── feature-normalization.ts # Feature name mapping
│   ├── permission-mapping.ts    # Role permission logic
│   └── badge-generation.ts      # Badge/tooltip logic
└── constants/
    ├── feature-definitions.ts   # Canonical feature list
    └── role-hierarchy.ts        # Role permission matrix
```

### New Main Hook Interface
```typescript
// New: useTenantAccess.ts (80 lines)
export function useTenantAccess(tenantId: string | null): TenantAccessResult {
  // Compose focused hooks
  const tierData = useTierData(tenantId);
  const userRole = useUserRole(tenantId);
  const featureAccess = useFeatureAccess(tierData.tier, userRole.role);
  const usageData = useUsageData(tenantId);

  // Simple composition logic
  return {
    // Tier context
    tier: tierData.tier,
    loading: tierData.loading || userRole.loading,
    error: tierData.error || userRole.error,
    
    // Feature access (unified interface)
    hasFeature: featureAccess.hasFeature,
    canAccess: featureAccess.canAccess,
    getFeatureBadge: featureAccess.getFeatureBadge,
    
    // Usage limits
    usage: usageData.usage,
    isLimitReached: usageData.isLimitReached,
    
    // Refresh function
    refresh: () => Promise.all([tierData.refresh(), usageData.refresh()])
  };
}
```

---

## 📋 Phase 2 Implementation Plan

### Phase 2.1: Hook Decomposition (Week 3, Days 1-3)

#### Step 1: Create Focused Data Hooks
```typescript
// hooks/useTierData.ts (60 lines)
export function useTierData(tenantId: string | null) {
  const { data, loading, error, refetch } = useQuery({
    queryKey: ['tenant-tier', tenantId],
    queryFn: () => fetchTenantTier(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    tier: data?.tier,
    organization: data?.organization,
    isChain: data?.isChain,
    loading,
    error,
    refresh: refetch
  };
}

// hooks/useUserRole.ts (40 lines)
export function useUserRole(tenantId: string | null) {
  const { data, loading, error } = useQuery({
    queryKey: ['user-role', tenantId],
    queryFn: () => fetchUserRole(tenantId),
    enabled: !!tenantId,
  });

  return {
    role: data?.tenantRole,
    platformRole: data?.platformRole,
    canBypassTier: canBypassTierRestrictions(data),
    canBypassRole: canBypassRoleRestrictions(data),
    loading,
    error
  };
}

// hooks/useUsageData.ts (40 lines)
export function useUsageData(tenantId: string | null) {
  const { data, loading, error, refetch } = useQuery({
    queryKey: ['tenant-usage', tenantId],
    queryFn: () => fetchTenantUsage(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30 * 1000, // Background refresh every 30s
  });

  return {
    usage: data?.usage,
    isLimitReached: (limitType: string) => checkLimitReached(data, limitType),
    getUsagePercentage: (limitType: string) => getUsagePercent(data, limitType),
    loading,
    error,
    refresh: refetch
  };
}
```

#### Step 2: Create Feature Access Logic
```typescript
// hooks/useFeatureAccess.ts (60 lines)
export function useFeatureAccess(tier: ResolvedTier | null, userRole: UserTenantRole | null) {
  const featureChecker = useMemo(() => {
    return createFeatureChecker(tier, userRole);
  }, [tier, userRole]);

  return {
    hasFeature: (featureId: string) => featureChecker.hasFeature(featureId),
    canAccess: (featureId: string, permissionType: PermissionType) => 
      featureChecker.canAccess(featureId, permissionType),
    getFeatureBadge: (featureId: string, permissionType?: PermissionType) =>
      featureChecker.getFeatureBadge(featureId, permissionType),
    getAccessDeniedReason: (featureId: string, permissionType: PermissionType) =>
      featureChecker.getAccessDeniedReason(featureId, permissionType)
  };
}
```

### Phase 2.2: Unified API Creation (Week 3, Days 4-5)

#### New Backend Endpoint
```typescript
// New: GET /api/tenants/:id/access-context
// Replaces 3-4 separate API calls with single comprehensive response

interface AccessContextResponse {
  // User context
  user: {
    id: string;
    role: string;
    platformRole: string;
    tenantRole: string | null;
    canBypassTier: boolean;
    canBypassRole: boolean;
  };
  
  // Tier context
  tier: {
    effective: ResolvedTier;
    organization?: TierInfo;
    tenant?: TierInfo;
    isChain: boolean;
  };
  
  // Pre-computed feature access (performance optimization)
  features: Record<string, {
    hasAccess: boolean;
    source: 'tier' | 'role' | 'admin';
    reason?: string;
    requiredTier?: string;
    requiredRole?: string;
  }>;
  
  // Usage limits
  usage: {
    products: { current: number; limit: number; percent: number };
    locations: { current: number; limit: number; percent: number };
    users: { current: number; limit: number; percent: number };
    apiCalls: { current: number; limit: number; percent: number };
  };
  
  // Cache metadata
  cacheKey: string;
  expiresAt: string;
}
```

#### Updated Hook Implementation
```typescript
// Updated: useTenantAccess.ts with unified API
export function useTenantAccess(tenantId: string | null): TenantAccessResult {
  const { data, loading, error, refetch } = useQuery({
    queryKey: ['tenant-access-context', tenantId],
    queryFn: () => api.get(`/api/tenants/${tenantId}/access-context`),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Simple data transformation (no complex logic)
  return useMemo(() => ({
    // Tier context
    tier: data?.tier.effective,
    organization: data?.tier.organization,
    isChain: data?.tier.isChain,
    
    // User context
    userRole: data?.user.tenantRole,
    platformRole: data?.user.platformRole,
    canBypassTier: data?.user.canBypassTier,
    canBypassRole: data?.user.canBypassRole,
    
    // Feature access (pre-computed by backend)
    hasFeature: (featureId: string) => data?.features[featureId]?.hasAccess ?? false,
    canAccess: (featureId: string, permissionType: PermissionType) => 
      checkPermissionAccess(data?.features[featureId], permissionType),
    getFeatureBadge: (featureId: string) => 
      generateFeatureBadge(data?.features[featureId]),
    
    // Usage limits
    usage: data?.usage,
    isLimitReached: (limitType: keyof TenantUsage) => 
      (data?.usage[limitType]?.percent ?? 0) >= 100,
    
    // State
    loading,
    error,
    refresh: refetch
  }), [data, loading, error, refetch]);
}
```

### Phase 2.3: Eliminate Duplicate Systems (Week 4, Days 1-2)

#### Deprecate useTierAccess.ts
```typescript
// Mark as deprecated
/**
 * @deprecated Use useTenantAccess instead
 * This hook will be removed in Phase 3
 */
export function useTierAccess(tenantTier: string | null | undefined): TierAccessResult {
  console.warn('[useTierAccess] DEPRECATED: Use useTenantAccess instead');
  
  // Temporary bridge to new system
  const tenantId = getCurrentTenantId(); // Get from context
  const { hasFeature, tier } = useTenantAccess(tenantId);
  
  return {
    tier: tenantTier || 'starter',
    hasFeature,
    // ... other methods bridged to new system
  };
}
```

#### Migration Guide for Components
```typescript
// OLD: useTierAccess (tier-only)
const { hasFeature, requiresUpgrade } = useTierAccess(tenant.subscriptionTier);

// NEW: useTenantAccess (tier + role)
const { hasFeature, canAccess } = useTenantAccess(tenantId);

// Migration examples:
// OLD: hasFeature('barcode_scan')
// NEW: canAccess('barcode_scan', 'canEdit')

// OLD: requiresUpgrade('storefront')
// NEW: getFeatureBadge('storefront')
```

### Phase 2.4: React Query Integration (Week 4, Days 3-5)

#### Smart Caching Strategy
```typescript
// Query configuration
const queryConfig = {
  // Tier data: Changes infrequently, cache longer
  tierData: {
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Usage data: Changes frequently, refresh in background
  usageData: {
    staleTime: 30 * 1000,      // 30 seconds
    cacheTime: 5 * 60 * 1000,  // 5 minutes
    refetchInterval: 60 * 1000, // Background refresh every minute
  },
  
  // User role: Changes rarely, cache aggressively
  userRole: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  }
};
```

#### Cache Invalidation Strategy
```typescript
// Invalidate cache on relevant mutations
const queryClient = useQueryClient();

// When user switches tenants
const switchTenant = (newTenantId: string) => {
  queryClient.invalidateQueries(['tenant-access-context']);
  queryClient.invalidateQueries(['tenant-tier']);
  queryClient.invalidateQueries(['user-role', newTenantId]);
};

// When subscription changes
const onSubscriptionChange = (tenantId: string) => {
  queryClient.invalidateQueries(['tenant-tier', tenantId]);
  queryClient.invalidateQueries(['tenant-usage', tenantId]);
};

// When user role changes
const onRoleChange = (tenantId: string, userId: string) => {
  queryClient.invalidateQueries(['user-role', tenantId]);
};
```

---

## 📊 Phase 2 Success Metrics

### Performance Metrics:
- [ ] **<200ms tier loading time** (down from 800ms+)
- [ ] **1 API call per access check** (down from 3-4 calls)
- [ ] **90% cache hit rate** for tier data
- [ ] **Background refresh** for usage data

### Code Quality Metrics:
- [ ] **<100 lines per hook** (down from 430 lines monolith)
- [ ] **Single responsibility** per hook
- [ ] **0 duplicate systems** (eliminate useTierAccess)
- [ ] **100% test coverage** for new hooks

### Developer Experience:
- [ ] **Clear hook responsibilities** (easy to understand)
- [ ] **Composable architecture** (mix and match hooks)
- [ ] **TypeScript safety** (proper interfaces)
- [ ] **Migration guide** (smooth transition)

---

## 🧪 Testing Strategy

### Unit Tests (Each Hook)
```typescript
describe('useTierData', () => {
  test('fetches tier data correctly', async () => {
    const { result } = renderHook(() => useTierData('tenant-123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tier).toBeDefined();
  });
  
  test('handles platform admin bypass', () => {
    mockPlatformAdmin();
    const { result } = renderHook(() => useTierData('tenant-123'));
    expect(result.current.canBypassTier).toBe(true);
  });
});

describe('useFeatureAccess', () => {
  test('checks feature access correctly', () => {
    const tier = mockProfessionalTier();
    const role = 'MEMBER';
    const { result } = renderHook(() => useFeatureAccess(tier, role));
    
    expect(result.current.canAccess('barcode_scan', 'canEdit')).toBe(true);
    expect(result.current.canAccess('propagation_products', 'canManage')).toBe(false);
  });
});
```

### Integration Tests (Full System)
```typescript
describe('useTenantAccess Integration', () => {
  test('professional tier user can access barcode scanning', async () => {
    mockTenantTier('professional');
    mockUserRole('MEMBER');
    
    const { result } = renderHook(() => useTenantAccess('tenant-123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    expect(result.current.canAccess('barcode_scan', 'canEdit')).toBe(true);
  });
  
  test('platform admin bypasses all restrictions', async () => {
    mockPlatformAdmin();
    
    const { result } = renderHook(() => useTenantAccess('tenant-123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    expect(result.current.canAccess('any_feature', 'canManage')).toBe(true);
  });
});
```

### Performance Tests
```typescript
describe('Performance', () => {
  test('loads tier data in under 200ms', async () => {
    const start = performance.now();
    const { result } = renderHook(() => useTenantAccess('tenant-123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const end = performance.now();
    
    expect(end - start).toBeLessThan(200);
  });
  
  test('uses cached data on subsequent calls', async () => {
    // First call
    const { unmount } = renderHook(() => useTenantAccess('tenant-123'));
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
    unmount();
    
    // Second call should use cache
    renderHook(() => useTenantAccess('tenant-123'));
    expect(mockApi).toHaveBeenCalledTimes(1); // No additional calls
  });
});
```

---

## 🚀 Migration Strategy

### Phase 2.1: Parallel Implementation (Week 3)
- ✅ Create new hook structure alongside existing system
- ✅ Implement unified API endpoint
- ✅ Add React Query integration
- ❌ **Do not break existing system yet**

### Phase 2.2: Gradual Migration (Week 4)
- ✅ Update 1-2 components to use new system
- ✅ Validate performance improvements
- ✅ Add deprecation warnings to old system
- ✅ Create migration documentation

### Phase 2.3: Full Migration (Phase 3)
- ✅ Update all components to new system
- ✅ Remove old useTierAccess.ts
- ✅ Clean up emergency fixes from Phase 1
- ✅ Remove deprecated code

---

## 🎯 Phase 2 Deliverables

### Week 3 Deliverables:
1. **New Hook Architecture** - Focused, single-responsibility hooks
2. **Unified API Endpoint** - Single call for all access context
3. **React Query Integration** - Smart caching and background refresh
4. **Migration Documentation** - Clear upgrade path for components

### Week 4 Deliverables:
1. **useTierAccess Deprecation** - Mark old system as deprecated
2. **Component Migration** - Update 2-3 key components as examples
3. **Performance Validation** - Confirm <200ms loading times
4. **Testing Suite** - Comprehensive tests for new architecture

### Phase 2 Success Criteria:
- [ ] **430-line monolith** broken into **<100-line focused hooks**
- [ ] **Single API call** replaces 3-4 call waterfall
- [ ] **Duplicate systems eliminated** (no more useTierAccess confusion)
- [ ] **Performance improved** (<200ms vs 800ms+ loading)
- [ ] **Developer experience enhanced** (clear, composable hooks)

---

## 🔄 Risk Mitigation

### High-Risk Items:
1. **Breaking existing functionality** during refactor
   - **Mitigation:** Parallel implementation, gradual migration
   - **Rollback:** Keep old system until new system is proven

2. **Performance regression** from new architecture
   - **Mitigation:** Comprehensive performance testing
   - **Rollback:** Feature flags to switch between systems

3. **API endpoint complexity** causing backend issues
   - **Mitigation:** Incremental API development, thorough testing
   - **Rollback:** Fallback to individual API calls

### Testing Strategy:
- **Unit tests** for each new hook
- **Integration tests** for full system
- **Performance tests** for loading times
- **Regression tests** for existing functionality
- **Load tests** for new API endpoint

---

*Phase 2 transforms the tier system from a monolithic, conflicting architecture into a clean, maintainable, and performant foundation for long-term growth.*
