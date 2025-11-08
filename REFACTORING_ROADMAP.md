# Refactoring Roadmap

**Last Updated:** 2025-11-08  
**Status:** In Progress  
**Overall Progress:** 40% Complete

---

## 🎯 Objectives

1. **Reduce code complexity** - Break down monolithic components
2. **Improve maintainability** - Single responsibility per file
3. **Fix hydration issues** - Consistent server/client rendering
4. **Establish patterns** - Reusable hooks and components
5. **Enable testing** - Isolated, testable units

---

## 📊 Progress Overview

| Phase | Status | Priority | Completion |
|-------|--------|----------|------------|
| Phase 1: Critical Fixes | ✅ Complete | P0 | 100% |
| Phase 2: Shell Components | ✅ Complete | P1 | 100% |
| Phase 3: Admin Pages | 🟡 In Progress | P1 | 50% |
| Phase 4: Settings Pages | ⏸️ Pending | P2 | 0% |
| Phase 5: Feature Pages | ⏸️ Pending | P3 | 0% |

---

## Phase 1: Critical Fixes ✅ COMPLETE

**Priority:** P0 (Blocking)  
**Status:** ✅ Complete  
**Completed:** 2025-11-08

### Completed Items

- [x] **Fix 403/401 errors on admin routes**
  - Lines: N/A
  - Impact: Critical - blocking admin access
  - Solution: Fixed middleware to check `access_token` cookie
  - Commit: `470240d`

- [x] **Fix hydration errors in AppShell**
  - Lines: 237 → 180 (24% reduction)
  - Impact: High - affecting all platform pages
  - Solution: Added mounted state, extracted hooks
  - Commit: `1199cda`

- [x] **Fix hydration errors in AdminLayout**
  - Lines: 158
  - Impact: Medium - affecting admin pages
  - Solution: Added mounted state for pathname checks
  - Commit: `de4ecc0`

### Outcomes
- ✅ All admin routes accessible
- ✅ No hydration errors on platform pages
- ✅ Established refactoring pattern

---

## Phase 2: Shell Components ✅ COMPLETE

**Priority:** P1 (High)  
**Status:** ✅ Complete  
**Completed:** 2025-11-08

### Completed Items

- [x] **AppShell Refactor**
  - Lines: 237 → 180 (24% reduction)
  - Complexity: 7 hooks → 3 hooks
  - Created:
    - `hooks/useAppNavigation.ts` (60 lines)
    - `hooks/useSessionRestore.ts` (30 lines)
    - `NavLinks.tsx` (55 lines)
  - Commit: `d095e95`

- [x] **AdminLayout Review**
  - Lines: 158
  - Status: ✅ Good enough (already fixed hydration)
  - Decision: No refactor needed

- [x] **TenantShell Review**
  - Lines: 80
  - Status: ✅ Already ideal
  - Decision: No refactor needed (server-side logic)

### Outcomes
- ✅ Centralized navigation logic
- ✅ Reusable hooks pattern established
- ✅ Clean separation of concerns

---

## Phase 3: Admin Pages 🟡 IN PROGRESS

**Priority:** P1 (High)  
**Status:** 🟡 50% Complete  
**Target:** 2025-11-15

### Completed Items

- [x] **Billing Page Refactor** ✅
  - Lines: 335 → 145 (57% reduction!)
  - Complexity: 8 hooks → 3 hooks
  - Created:
    - `types.ts` (30 lines)
    - `hooks/useBillingData.ts` (65 lines)
    - `hooks/useBillingFilters.ts` (95 lines)
    - `components/BillingFilters.tsx` (110 lines)
    - `components/TenantCard.tsx` (45 lines)
    - `components/BillingPagination.tsx` (50 lines)
  - Status: ✅ Complete, no hydration errors
  - Commit: `6f37e04`

### Pending Items

- [ ] **Dashboard Refactor** 🚨 CRITICAL
  - Current: 1,039 lines, 10 hooks
  - Target: ~400 lines total (60% reduction)
  - Priority: **P0** (Highest complexity, main entry point)
  - Estimated: 2-3 hours
  - Plan:
    - Extract `useDashboardData.ts` - Tenant data & stats
    - Extract `usePlatformStats.ts` - Public stats
    - Extract `useShowcaseMode.ts` - Showcase config
    - Create `DashboardStats.tsx` - Stats cards
    - Create `QuickActions.tsx` - Action buttons
    - Create `TenantInfo.tsx` - Tenant header
    - Create `PlatformStatsSection.tsx` - Visitor stats

- [ ] **Admin Tools Page**
  - Current: Unknown
  - Priority: P2
  - Status: Needs assessment

- [ ] **Admin Users Page**
  - Current: Unknown
  - Priority: P2
  - Status: Needs assessment

- [ ] **Admin Tiers Page**
  - Current: Unknown
  - Priority: P2
  - Status: Needs assessment

- [ ] **Admin Organizations Page**
  - Current: Unknown
  - Priority: P3
  - Status: Needs assessment

- [ ] **Admin Categories Page**
  - Current: Unknown
  - Priority: P3
  - Status: Needs assessment

- [ ] **Admin Enrichment Page**
  - Current: Unknown
  - Priority: P3
  - Status: Needs assessment

### Success Metrics
- [ ] All admin pages < 300 lines
- [ ] No hydration errors
- [ ] Reusable components extracted
- [ ] Consistent hook patterns

---

## Phase 4: Settings Pages ⏸️ PENDING

**Priority:** P2 (Medium)  
**Status:** ⏸️ Not Started  
**Target:** TBD

### Pages to Assess

- [ ] **Settings Admin Pages** (17 pages)
  - `/settings/admin/page.tsx`
  - `/settings/admin/branding/page.tsx`
  - `/settings/admin/emails/page.tsx`
  - `/settings/admin/feature-overrides/page.tsx`
  - `/settings/admin/features/page.tsx`
  - `/settings/admin/features-showcase/page.tsx`
  - `/settings/admin/gbp-sync/page.tsx`
  - `/settings/admin/organization-requests/page.tsx`
  - `/settings/admin/permissions/page.tsx`
  - `/settings/admin/platform-flags/page.tsx`
  - `/settings/admin/scan-metrics/page.tsx`
  - `/settings/admin/tenants/page.tsx`
  - `/settings/admin/tier-management/page.tsx`
  - `/settings/admin/tier-matrix/page.tsx`
  - `/settings/admin/tier-system/page.tsx`
  - `/settings/admin/upgrade-requests/page.tsx`
  - `/settings/admin/users/page.tsx`

- [ ] **User Settings Pages** (7 pages)
  - `/settings/page.tsx`
  - `/settings/account/page.tsx`
  - `/settings/appearance/page.tsx`
  - `/settings/contact/page.tsx`
  - `/settings/language/page.tsx`
  - `/settings/offerings/page.tsx`
  - `/settings/organization/page.tsx`
  - `/settings/subscription/page.tsx`
  - `/settings/tenant/page.tsx`

### Action Items
1. Run line count analysis on all settings pages
2. Identify pages > 300 lines
3. Prioritize by complexity and usage
4. Create refactor plan for each

---

## Phase 5: Feature Pages ⏸️ PENDING

**Priority:** P3 (Low)  
**Status:** ⏸️ Not Started  
**Target:** TBD

### Pages to Assess

- [ ] **Scan Pages**
  - `/scan/page.tsx`
  - `/scan/[sessionId]/page.tsx`

- [ ] **Items Pages**
  - Status: Needs discovery

- [ ] **Tenant-Scoped Pages**
  - Status: Needs discovery

### Action Items
1. Discover all feature pages
2. Run complexity analysis
3. Prioritize by usage and complexity

---

## 🎯 Current Sprint Focus

**Week of 2025-11-08:**

### Top Priority
1. 🚨 **Dashboard Refactor** (1,039 lines → ~400 lines)
   - Highest complexity
   - Main entry point
   - Likely hydration issues
   - Estimated: 2-3 hours

### Secondary Priority
2. **Admin Pages Assessment**
   - Run line count on all admin pages
   - Identify next refactor candidates
   - Estimated: 30 minutes

### Stretch Goals
3. **Settings Pages Discovery**
   - Catalog all settings pages
   - Run complexity analysis
   - Create prioritized list

---

## 📈 Metrics & KPIs

### Code Reduction
- **Target:** 40% reduction in total lines across refactored pages
- **Current:** 57% reduction (billing), 24% reduction (AppShell)
- **Average:** 40.5% ✅ On target

### Complexity Reduction
- **Target:** < 5 useState hooks per page
- **Billing:** 8 → 3 hooks ✅
- **AppShell:** 7 → 3 hooks ✅

### Quality Metrics
- **Hydration Errors:** 0 (after refactor) ✅
- **Test Coverage:** TBD
- **Component Reusability:** Increasing ✅

---

## 🛠️ Refactoring Patterns

### Established Patterns

1. **Hook Extraction**
   ```typescript
   // Data fetching
   useDashboardData() → { data, loading, error }
   
   // Business logic
   useBillingFilters() → { filters, setFilters, filteredData }
   
   // UI state
   useShowcaseMode() → { mode, setMode }
   ```

2. **Component Structure**
   ```
   feature/
   ├── page.tsx (orchestration, ~150 lines)
   ├── types.ts (shared interfaces)
   ├── hooks/ (business logic)
   └── components/ (presentational)
   ```

3. **Hydration Safety**
   ```typescript
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   return mounted ? <Content /> : null;
   ```

4. **Logging for Debug**
   ```typescript
   console.log('[ComponentName] Event:', data);
   ```

### Anti-Patterns to Avoid
- ❌ > 300 lines in a single component
- ❌ > 5 useState hooks in one component
- ❌ Mixing data fetching with rendering logic
- ❌ Duplicate code between desktop/mobile
- ❌ Client-side only checks that differ from server

---

## 📝 Notes & Learnings

### Key Insights
1. **Centralized utilities fix bugs everywhere** - Fix once, apply everywhere
2. **Refactoring fixes hydration issues** - Clean patterns prevent mismatches
3. **Hooks enable reusability** - Extract logic, reuse across pages
4. **Component extraction reduces complexity** - Single responsibility per file

### Technical Debt Identified
- Dashboard: 1,039 lines (3x normal size)
- Unknown complexity in settings pages
- Potential duplication across admin pages

### Future Improvements
- [ ] Add unit tests for extracted hooks
- [ ] Create Storybook for components
- [ ] Establish code review checklist
- [ ] Add pre-commit hooks for line count limits

---

## 🚀 Getting Started

### For Dashboard Refactor
1. Read current dashboard structure
2. Identify all state and effects
3. Create types file
4. Extract hooks one by one
5. Create components
6. Refactor main page
7. Test thoroughly
8. Deploy and monitor

### For New Refactors
1. Run line count: `Get-Content page.tsx | Measure-Object -Line`
2. Count hooks: `Select-String -Pattern "useState|useEffect"`
3. Identify responsibilities
4. Follow established patterns
5. Test before and after
6. Update this document

---

## 📞 Questions & Decisions

### Open Questions
- Should we refactor all admin pages or just the largest?
- What's the threshold for "needs refactoring"? (Currently: 300 lines)
- Should we add automated checks for complexity?

### Decisions Made
- ✅ Use hooks for business logic, components for UI
- ✅ Keep pages as orchestrators only
- ✅ Extract reusable components to shared locations
- ✅ Add logging for debugging hydration issues
- ✅ Prioritize by complexity and impact, not alphabetically

---

## 🎉 Wins & Celebrations

- ✅ Fixed critical 403/401 errors blocking admin access
- ✅ Eliminated all hydration errors in refactored components
- ✅ Reduced billing page by 57% while improving maintainability
- ✅ Established reusable patterns for future refactors
- ✅ Created comprehensive tracking system

**Next milestone:** Dashboard refactor complete! 🎯
