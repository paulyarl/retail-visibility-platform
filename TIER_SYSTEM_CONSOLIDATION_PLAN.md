# Tier System Consolidation Plan

**Status:** 🔴 CRITICAL - Mixed results causing platform admin rejections and professional tier access issues  
**Timeline:** 8 weeks (4 phases)  
**Priority:** Emergency consolidation required

## Executive Summary

The current tier and permission system suffers from **systemic conflicts** where multiple overlapping systems with inconsistent feature definitions compete, causing:
- Platform admins incorrectly rejected from features
- Professional tier users facing unexpected access blocks
- Frontend/backend validation clashes
- Performance bottlenecks from redundant API calls

**Root Cause:** 4+ competing tier systems with different feature names and access logic.

## System Conflict Matrix

| System | Location | Data Source | Feature Names | Admin Bypass | Lines | Status |
|--------|----------|-------------|---------------|--------------|-------|--------|
| **tier-access.ts** | Backend | Hardcoded | `barcode_scan` | ❌ Manual | 477 | Active |
| **tier-features.ts** | Frontend | Hardcoded | `product_scanning` | ❌ Manual | 417 | Active |
| **tier-resolver.ts** | Frontend | Dynamic | Mixed | ✅ Partial | 274 | Active |
| **TierService.ts** | Backend | Database | DB-driven | ❌ None | 256 | Underused |
| **useTenantTier.ts** | Frontend | API calls | `barcode_scan` | ✅ Complex | 412 | Bloated |

## Critical Issues Identified

### 🔴 Feature Name Conflicts
```typescript
// Backend middleware expects:
requireTierFeature('barcode_scan')
requireTierFeature('quick_start_wizard')

// Frontend tier-features.ts defines:
'product_scanning'  // ❌ Different name!
'quick_start_wizard'  // ✅ Matches

// useTenantTier.ts checks:
'barcode_scan'  // ✅ Matches backend
'quick_start_wizard_full'  // ❌ Different variant!

// Result: Backend allows → Frontend blocks = Mixed results
```

### 🔴 Platform Admin Bypass Inconsistencies
- **Backend:** Manual `isPlatformAdmin()` checks scattered across 15+ files
- **Frontend:** Complex role detection in `useTenantTier.ts` (lines 76-112)
- **Result:** Some systems bypass admin checks, others don't

### 🔴 API Call Waterfall Performance Issues
```typescript
// Current useTenantTier.ts makes 3-4 sequential calls:
1. GET /auth/me (user profile + platform role)
2. GET /api/tenants/:id/tier (tenant + org tier data)
3. GET /api/tenants/:id/usage (usage statistics)
4. GET /api/users/:id/tenants/:tenantId (user role on tenant)

// Result: 800ms+ loading time, poor caching
```

---

## 🎯 PHASE 1: Emergency Consolidation (Week 1-2)
**Goal:** Stop the bleeding - Fix critical access issues immediately

### Phase 1.1: Feature Name Standardization (Day 1-2)
**Priority:** 🔥 CRITICAL - Eliminates 80% of mixed results

#### Actions Required:
- [ ] **Audit all feature names** across entire codebase
- [ ] **Create canonical feature mapping** (backend names = source of truth)
- [ ] **Update frontend to match backend** feature names exactly
- [ ] **Add migration script** for any database feature name changes

#### Files to Modify:
```
Frontend Changes:
├── apps/web/src/lib/tiers/tier-features.ts
│   └── Update FEATURE_TIER_MAP to match backend names
├── apps/web/src/hooks/dashboard/useTenantTier.ts
│   └── Update featureTierMap object (lines 208-244)
└── apps/web/src/lib/tiers/tier-resolver.ts
    └── Align feature definitions

Backend Verification:
├── apps/api/src/middleware/tier-access.ts
│   └── Verify FEATURE_TIER_MAP is canonical source
└── apps/api/src/routes/*.ts
    └── Audit all requireTierFeature() calls
```

#### Canonical Feature Names (Backend = Source of Truth):
```typescript
// STANDARDIZED FEATURE NAMES (from backend tier-access.ts)
const CANONICAL_FEATURES = {
  // Professional tier (CRITICAL revenue features)
  'quick_start_wizard': 'professional',
  'barcode_scan': 'professional',  // NOT 'product_scanning'
  'gbp_integration': 'professional',
  
  // Starter tier
  'storefront': 'starter',
  'category_quick_start': 'starter',
  
  // Organization tier
  'propagation_products': 'organization',
  'propagation_categories': 'organization',
  
  // Enterprise tier
  'api_access': 'enterprise',
  'white_label': 'enterprise',
};
```

### Phase 1.2: Platform Admin Bypass Consolidation (Day 3-4)
**Priority:** 🔥 CRITICAL - Fix admin access failures

#### Actions Required:
- [ ] **Create centralized admin utility** in shared location
- [ ] **Replace all manual admin checks** with centralized function
- [ ] **Update caching strategy** for admin status
- [ ] **Performance test** admin bypass logic

#### Implementation:
```typescript
// New file: apps/web/src/lib/auth/platform-admin.ts
export function isPlatformAdmin(user: any): boolean {
  return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
}

export function canBypassTierRestrictions(user: any): boolean {
  return isPlatformAdmin(user);
}

// Update useTenantTier.ts to use centralized function
import { canBypassTierRestrictions } from '@/lib/auth/platform-admin';

// Replace complex logic (lines 76-112) with:
const canSupport = canBypassTierRestrictions(userData.user);
```

### Phase 1.3: Database-Driven Single Source of Truth (Day 5-7)
**Priority:** 🟡 HIGH - Eliminate hardcoded conflicts

#### Actions Required:
- [ ] **Migrate hardcoded features to database** via TierService
- [ ] **Update TierService** to be comprehensive authority
- [ ] **Deprecate hardcoded TIER_FEATURES** in favor of database
- [ ] **Create unified API endpoint** for feature access

#### New Unified API Endpoint:
```typescript
// New endpoint: GET /api/tenants/:id/access-context
// Replaces 3-4 separate API calls with single comprehensive response

interface AccessContextResponse {
  // User context
  user: {
    id: string;
    role: string;
    isPlatformAdmin: boolean;
    tenantRole: string | null;
  };
  
  // Tier context
  tier: {
    effective: string;
    organization?: string;
    tenant?: string;
    isChain: boolean;
  };
  
  // Feature access (pre-computed)
  features: Record<string, {
    hasAccess: boolean;
    source: 'tier' | 'role' | 'admin';
    reason?: string;
  }>;
  
  // Usage limits
  usage: {
    products: { current: number; limit: number; percent: number };
    locations: { current: number; limit: number; percent: number };
  };
}
```

### Phase 1.4: Temporary Emergency Fixes (Day 1 - Immediate)
**Priority:** 🔥 IMMEDIATE - Deploy today to stop user complaints

#### Quick Fixes to Deploy Now:
```typescript
// 1. Add to useTenantTier.ts (line 175) - Force admin bypass
const checkFeature = (featureId: string): boolean => {
  // EMERGENCY: Force platform admin bypass until Phase 1 complete
  if (canSupport || user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT') {
    return true;
  }
  if (!tier) return false;
  return hasFeature(tier, featureId);
};

// 2. Add feature name mapping (line 208) - Handle name conflicts
const FEATURE_NAME_MAPPING: Record<string, string> = {
  'product_scanning': 'barcode_scan',  // Map frontend name to backend
  'quick_start_wizard_full': 'quick_start_wizard',  // Normalize variants
};

const normalizeFeatureId = (featureId: string): string => {
  return FEATURE_NAME_MAPPING[featureId] || featureId;
};
```

---

## Phase 1 Success Criteria

### Technical Metrics:
- [ ] **0 feature name conflicts** between frontend/backend
- [ ] **100% platform admin bypass reliability** across all features
- [ ] **Single API call** for access context (replaces 3-4 calls)
- [ ] **<200ms tier loading time** (down from 800ms+)

### Business Metrics:
- [ ] **0 "access denied" support tickets** from platform admins
- [ ] **0 professional tier access complaints**
- [ ] **Consistent feature availability** across all interfaces
- [ ] **Admin dashboard fully accessible** to platform admins

### Validation Tests:
```typescript
// Test cases to verify Phase 1 success:
describe('Phase 1 Validation', () => {
  test('Platform admin can access all features', () => {
    const admin = { role: 'PLATFORM_ADMIN' };
    expect(canAccess('barcode_scan', 'canEdit', admin)).toBe(true);
    expect(canAccess('quick_start_wizard', 'canManage', admin)).toBe(true);
    expect(canAccess('propagation_products', 'canManage', admin)).toBe(true);
  });
  
  test('Feature names are consistent', () => {
    // Backend and frontend must use same feature names
    expect(BACKEND_FEATURES).toEqual(FRONTEND_FEATURES);
  });
  
  test('Professional tier has expected access', () => {
    const proTenant = { tier: 'professional' };
    expect(hasFeature(proTenant, 'barcode_scan')).toBe(true);
    expect(hasFeature(proTenant, 'quick_start_wizard')).toBe(true);
  });
});
```

---

## Phase 1 Implementation Timeline

### Week 1: Emergency Fixes
- **Day 1:** Deploy temporary admin bypass fixes
- **Day 2:** Complete feature name audit and standardization
- **Day 3:** Implement centralized admin utility
- **Day 4:** Update all admin bypass logic
- **Day 5:** Begin database migration planning

### Week 2: Consolidation
- **Day 6-7:** Migrate features to database via TierService
- **Day 8-9:** Create unified access context API
- **Day 10:** Update useTenantTier to use new API
- **Day 11-12:** Testing and validation
- **Day 14:** Phase 1 deployment and monitoring

---

## Risk Mitigation

### High-Risk Items:
1. **Breaking existing functionality** during feature name changes
   - **Mitigation:** Feature flags for gradual rollout
   - **Rollback:** Keep old names as aliases during transition

2. **API performance degradation** from unified endpoint
   - **Mitigation:** Comprehensive performance testing
   - **Rollback:** Maintain old endpoints during transition

3. **Admin bypass failures** during consolidation
   - **Mitigation:** Deploy emergency fixes first
   - **Rollback:** Temporary force-bypass flag

### Testing Strategy:
- **Unit tests** for all access control functions
- **Integration tests** for API endpoints
- **E2E tests** for admin scenarios
- **Performance tests** for tier loading
- **Regression tests** for existing functionality

---

## Next Phases Preview

### Phase 2: Architecture Refactor (Week 3-4)
- Break down useTenantTier.ts (412 lines → 5 focused hooks)
- Eliminate useTierAccess.ts duplication
- Implement React Query caching

### Phase 3: Performance & Reliability (Week 5-6)
- Intelligent caching strategy
- Error handling standardization
- Background refresh for usage stats

### Phase 4: Advanced Features (Week 7-8)
- Real-time tier updates
- Feature override system
- Audit logging

---

## Immediate Action Required

**🔥 DEPLOY TODAY:**
1. Add emergency admin bypass to useTenantTier.ts
2. Add feature name mapping for conflicts
3. Monitor error logs for access failures

**📋 START TOMORROW:**
1. Complete feature name audit
2. Create canonical feature mapping
3. Begin centralized admin utility

**📊 TRACK METRICS:**
- Support tickets related to access issues
- Platform admin login success rate
- Feature access error rates
- API response times for tier checks

---

*This document will be updated as Phase 1 progresses. All changes should be tracked and validated against the success criteria above.*
