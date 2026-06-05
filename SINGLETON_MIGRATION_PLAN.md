# Singleton Migration Plan: Public Directory Requests

## Overview
This plan outlines the phased migration of public directory requests from direct API calls to the new singleton middleware system for products, directory, stores, and categories.

## Current State Analysis

### Existing Public Directory Endpoints
- ✅ **Health Check**: `/health` - Working
- ✅ **Featured Products**: `/api/directory/random-featured` - Working (85% success rate)
- ✅ **Directory Categories**: `/api/directory/categories` - Working  
- ✅ **Featured Stores**: `/api/directory/featured-stores` - Working
- ❌ **Directory Main**: `/api/directory` - 500 error (Prisma JsonBody issue)
- ❌ **Directory Tenant Info**: `/api/directory/tenant/:id` - 500 error (Prisma JsonBody issue)

### Singleton Components Status
- ✅ **ProductSingleton**: 100% test success
- ✅ **CategorySingleton**: 100% test success  
- ✅ **StoreSingleton**: 66% test success (tenant info issue)
- ✅ **Performance**: 100% test success (898ms for 10 concurrent requests)

---

## Phase 1: Foundation & Quick Wins (Week 1)

### Priority 1: Featured Products Migration 🚀
**Target**: `/api/directory/random-featured` → ProductSingleton
- **Current Status**: ✅ Working (85% success rate)
- **Effort**: Low (already tested)
- **Impact**: High (most visible feature)

#### Tasks:
1. **Frontend Integration**
   - Update `RandomFeaturedProducts` component to use `useRandomFeaturedProducts` hook
   - Add error boundaries and loading states
   - Implement cache TTL display

2. **Testing**
   - Run API singleton batch test
   - Manual browser testing at `/test-featured-products`
   - Performance benchmarking

3. **Success Criteria**
   - ✅ Component loads without errors
   - ✅ Data displays correctly
   - ✅ Cache metrics visible
   - ✅ Performance < 500ms

---

### Priority 2: Directory Categories Migration 📂
**Target**: `/api/directory/categories` → CategorySingleton
- **Current Status**: ✅ Working (100% success rate)
- **Effort**: Low
- **Impact**: Medium

#### Tasks:
1. **Create Category Singleton Hook**
   ```typescript
   // New hook: useDirectoryCategories()
   export const useDirectoryCategories = () => {
     const { actions } = useCategorySingleton();
     // Implementation for fetching categories
   };
   ```

2. **Frontend Integration**
   - Update directory category components
   - Add category tree navigation
   - Implement category filtering

3. **Testing**
   - API endpoint testing
   - Component integration testing
   - Cache performance testing

---

## Phase 2: Core Directory Features (Week 2)

### Priority 3: Featured Stores Migration 🏪
**Target**: `/api/directory/featured-stores` → StoreSingleton
- **Current Status**: ✅ Working (66% success rate)
- **Effort**: Medium
- **Impact**: High

#### Tasks:
1. **Fix Store Singleton Issues**
   - Resolve Prisma JsonBody enum error in `/api/directory/tenant/:id`
   - Update StoreSingleton to handle tenant info properly

2. **Create Store Singleton Hook**
   ```typescript
   // New hook: useFeaturedStores()
   export const useFeaturedStores = (limit = 10) => {
     const { actions } = useStoreSingleton();
     // Implementation for fetching featured stores
   };
   ```

3. **Frontend Integration**
   - Update store listing components
   - Add store card components
   - Implement store search functionality

4. **Testing**
   - Fix tenant info endpoint
   - Test store data flow
   - Performance testing

---

### Priority 4: Directory Search Migration 🔍
**Target**: `/api/directory/search` → Combined Singletons
- **Current Status**: ✅ Working (tested)
- **Effort**: High
- **Impact**: High

#### Tasks:
1. **Create Unified Search Hook**
   ```typescript
   // New hook: useDirectorySearch()
   export const useDirectorySearch = (query: string, type?: 'products' | 'stores') => {
     const productActions = useProductSingleton().actions;
     const storeActions = useStoreSingleton().actions;
     // Combined search implementation
   };
   ```

2. **Search Implementation**
   - Product search via ProductSingleton
   - Store search via StoreSingleton
   - Unified search results
   - Search result caching

3. **Frontend Integration**
   - Update search components
   - Add search filters
   - Implement search history

---

## Phase 3: Advanced Features (Week 3)

### Priority 5: Directory Main Page Migration 🏠
**Target**: `/api/directory` → Combined Singletons
- **Current Status**: ❌ 500 error (Prisma JsonBody issue)
- **Effort**: High
- **Impact**: High

#### Tasks:
1. **Fix Prisma JsonBody Issue**
   - Debug and fix the enum error in directory.ts
   - Update query to handle JSON fields properly
   - Add error handling for malformed data

2. **Create Directory Main Hook**
   ```typescript
   // New hook: useDirectoryMain()
   export const useDirectoryMain = () => {
     const productActions = useProductSingleton().actions;
     const storeActions = useStoreSingleton().actions;
     const categoryActions = useCategorySingleton().actions;
     // Combined directory data
   };
   ```

3. **Frontend Integration**
   - Update main directory page
   - Add featured sections
   - Implement location-based content

---

### Priority 6: Tenant-Specific Pages 🏢
**Target**: `/api/directory/tenant/:id` → StoreSingleton
- **Current Status**: ❌ 500 error (Prisma JsonBody issue)
- **Effort**: High
- **Impact**: Medium

#### Tasks:
1. **Fix Tenant Info Endpoint**
   - Resolve Prisma JsonBody enum error
   - Add proper error handling
   - Implement tenant data caching

2. **Create Tenant Hook**
   ```typescript
   // New hook: useTenantInfo()
   export const useTenantInfo = (tenantId: string) => {
     const { actions } = useStoreSingleton();
     // Tenant-specific data implementation
   };
   ```

3. **Frontend Integration**
   - Update tenant profile pages
   - Add tenant product listings
   - Implement tenant analytics

---

## Phase 4: Optimization & Monitoring (Week 4)

### Priority 7: Performance Optimization ⚡
**Tasks:**
1. **Cache Optimization**
   - Implement Redis caching
   - Add cache invalidation strategies
   - Optimize cache TTLs

2. **Bundle Optimization**
   - Code splitting for singletons
   - Lazy loading of singleton hooks
   - Tree shaking unused code

3. **Monitoring**
   - Add performance metrics
   - Implement error tracking
   - Create dashboard for singleton health

---

## Testing Strategy

### End-to-End Testing Framework
Each migration phase includes:

1. **API Testing**
   ```bash
   cd apps/api && pnpm run test:singletons
   ```

2. **Frontend Testing**
   - Component rendering tests
   - Data flow tests
   - Error handling tests

3. **Performance Testing**
   - Load testing with concurrent requests
   - Cache hit rate testing
   - Memory usage monitoring

4. **Manual Testing**
   - Browser testing at `/test-featured-products`
   - Mobile responsiveness testing
   - Accessibility testing

### Success Metrics
- ✅ **Performance**: < 500ms response time
- ✅ **Reliability**: > 95% success rate
- ✅ **Cache Hit Rate**: > 80% for repeated requests
- ✅ **Error Rate**: < 1% for singleton operations

---

## Implementation Checklist

### Phase 1 Checklist
- [ ] Featured Products singleton integration
- [ ] Directory Categories singleton integration
- [ ] API tests passing (85%+ success rate)
- [ ] Frontend tests passing
- [ ] Performance benchmarks met

### Phase 2 Checklist
- [ ] Featured Stores singleton integration
- [ ] Store singleton tenant info fix
- [ ] Directory Search singleton integration
- [ ] Unified search implementation
- [ ] Error handling improvements

### Phase 3 Checklist
- [ ] Directory main page fix
- [ ] Prisma JsonBody issue resolution
- [ ] Tenant-specific pages migration
- [ ] Advanced features implementation
- [ ] Complete test coverage

### Phase 4 Checklist
- [ ] Redis caching implementation
- [ ] Performance optimization
- [ ] Monitoring dashboard
- [ ] Documentation updates
- [ ] Production deployment

---

## Risk Mitigation

### Technical Risks
1. **Prisma JsonBody Issues**
   - **Mitigation**: Create migration scripts, add fallback queries
   - **Backup**: Use raw SQL queries if needed

2. **Cache Invalidation**
   - **Mitigation**: Implement cache versioning, add manual cache clearing
   - **Backup**: Disable caching during development

3. **Performance Regression**
   - **Mitigation**: Continuous performance monitoring
   - **Backup**: Rollback to direct API calls

### Business Risks
1. **User Experience Impact**
   - **Mitigation**: Gradual rollout, feature flags
   - **Backup**: Maintain backward compatibility

2. **Data Consistency**
   - **Mitigation**: Implement data validation, add health checks
   - **Backup**: Data integrity checks

---

## Timeline Summary

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| 1 | Foundation | Featured Products, Categories |
| 2 | Core Features | Featured Stores, Search |
| 3 | Advanced | Directory Main, Tenant Pages |
| 4 | Optimization | Performance, Monitoring |

**Total Duration**: 4 weeks
**Expected Success Rate**: 95%+
**Performance Improvement**: 2-3x faster responses

---

## Next Steps

1. **Start Phase 1**: Begin with Featured Products migration
2. **Setup Testing**: Ensure API and frontend tests are running
3. **Monitor Progress**: Track success metrics and performance
4. **Adjust Plan**: Adapt based on testing results and feedback

This migration plan ensures a systematic, test-driven approach to migrating public directory requests to the singleton system while maintaining high performance and reliability.
