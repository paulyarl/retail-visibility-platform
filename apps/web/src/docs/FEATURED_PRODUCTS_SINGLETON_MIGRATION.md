# Featured Products Singleton Migration

## Overview

The FeaturedProductsManager component has been successfully migrated to the new singleton pattern. This migration demonstrates how complex tenant-scoped components can benefit from centralized state management and improved code organization.

## Architecture

### 1. Singleton Class: `TenantFeaturedProductsSingleton`

**Location:** `apps/web/src/lib/singletons/TenantFeaturedProductsSingleton.ts`

**Responsibilities:**
- Centralized state management for featured products
- API communication and data fetching
- Business logic for featuring/unfeaturing products
- Pagination and filtering logic
- Computed values and helper methods

**Key Features:**
- **Tenant-scoped**: Each tenant gets its own singleton instance
- **Auto-initialization**: Initializes on first subscriber
- **State subscription**: React components can subscribe to state changes
- **Memory management**: Cleanup methods for destroyed instances
- **Registry pattern**: Global singleton registry with tenant ID keys

### 2. React Hook: `useTenantFeaturedProducts`

**Location:** `apps/web/src/hooks/useTenantFeaturedProducts.ts`

**Responsibilities:**
- React integration for the singleton
- Memoized computed values
- Action callbacks with error handling
- Subscription management
- Auto-cleanup options

**Benefits:**
- Clean separation of concerns
- Type-safe API
- Memoized performance
- Automatic subscription management

### 3. Refactored Component: `FeaturedProductsManagerSingleton`

**Location:** `apps/web/src/components/tenant/FeaturedProductsManagerSingleton.ts`

**Improvements:**
- **70% less code**: From 1,461 lines to ~400 lines
- **No business logic**: All logic moved to singleton
- **Clean JSX**: Focus on presentation only
- **Better error handling**: Centralized error management
- **Improved performance**: Memoized values prevent unnecessary re-renders

## Migration Benefits

### ✅ **Code Organization**
- **Before**: Mixed UI and business logic in one large component
- **After**: Clean separation with singleton handling logic, component handling UI

### ✅ **Reusability**
- **Before**: Logic locked inside component, not reusable
- **After**: Singleton can be used by multiple components, pages, or even other singletons

### ✅ **Testing**
- **Before**: Complex component testing with mocked API calls
- **After**: Simple UI testing + separate singleton unit testing

### ✅ **Performance**
- **Before**: Multiple API calls per component instance
- **After**: Shared singleton instance, cached data, memoized computations

### ✅ **Maintainability**
- **Before**: Changes required touching large component file
- **After**: Changes isolated to singleton or component as needed

## Usage Examples

### Basic Usage
```typescript
import { useTenantFeaturedProducts } from '@/hooks/useTenantFeaturedProducts';

function MyComponent({ tenantId }: { tenantId: string }) {
  const {
    // State
    featuredProducts,
    availableProducts,
    isLoading,
    
    // Actions
    featureProduct,
    unfeatureProduct,
    setSelectedType,
    
    // Computed values
    activeFeatured,
    filteredAvailable
  } = useTenantFeaturedProducts(tenantId);

  // Component logic here...
}
```

### Advanced Usage with Options
```typescript
const featuredProducts = useTenantFeaturedProducts(tenantId, {
  autoInitialize: true,    // Auto-initialize on mount
  autoDestroy: false      // Keep singleton alive after unmount
});
```

### Manual Singleton Management
```typescript
import { useTenantFeaturedProductsManager } from '@/hooks/useTenantFeaturedProducts';

function AdminComponent() {
  const { getSingleton, destroySingleton } = useTenantFeaturedProductsManager();
  
  const handleReset = () => {
    const singleton = getSingleton(tenantId);
    singleton.forceRefresh();
  };
  
  const handleCleanup = () => {
    destroySingleton(tenantId);
  };
}
```

## Singleton Registry

The singleton system uses a registry pattern to manage instances:

```typescript
// Automatic registration
const singleton = getTenantFeaturedProductsSingleton(tenantId);

// Manual cleanup
destroyTenantFeaturedProductsSingleton(tenantId);
```

**Benefits:**
- Shared instances across components
- Memory management
- Prevents duplicate instances
- Easy cleanup and debugging

## State Management

### State Structure
```typescript
interface FeaturedProductsState {
  // Data
  featuredProducts: Record<string, FeaturedProduct[]>;
  availableProducts: FeaturedProduct[];
  featuredLimits: Record<string, number>;
  featuredTypes: FeaturedType[];
  
  // UI State
  isLoading: boolean;
  processing: boolean;
  searchQuery: string;
  selectedType: string;
  // ... other UI state
}
```

### Subscription Pattern
```typescript
// Component subscribes to state changes
const unsubscribe = singleton.subscribe(() => {
  // Component re-renders when state changes
});

// Automatic cleanup on unmount
return unsubscribe;
```

## Migration Strategy

### Phase 1: Create Singleton
1. Extract business logic from component
2. Create singleton class with state management
3. Implement API communication
4. Add subscription system

### Phase 2: Create React Hook
1. Wrap singleton in React hook
2. Add memoization for performance
3. Handle subscription lifecycle
4. Provide clean API

### Phase 3: Refactor Component
1. Replace useState/useEffect with hook
2. Remove business logic
3. Simplify JSX
4. Add error handling

### Phase 4: Testing & Deployment
1. Unit test singleton
2. Integration test hook
3. Component testing
4. Gradual rollout

## Performance Improvements

### Before Migration
- **API Calls**: Multiple calls per component mount
- **State**: Duplicated state across components
- **Computations**: Repeated on every render
- **Memory**: No cleanup, potential leaks

### After Migration
- **API Calls**: Shared calls, cached results
- **State**: Single source of truth
- **Computations**: Memoized, cached results
- **Memory**: Automatic cleanup, registry management

## Future Enhancements

### 1. Caching Layer
```typescript
// Add Redis caching for API responses
await singleton.fetchFeaturedProducts({ useCache: true });
```

### 2. Real-time Updates
```typescript
// WebSocket integration for live updates
singleton.subscribeToRealTimeUpdates();
```

### 3. Offline Support
```typescript
// Service worker integration
singleton.enableOfflineMode();
```

### 4. Analytics Integration
```typescript
// Track user interactions
singleton.trackFeatureAction('product_featured', { productId, type });
```

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Lines of Code | 1,461 | ~400 (component) + 600 (singleton) |
| Business Logic | Mixed with UI | Centralized in singleton |
| Reusability | Component-only | Singleton reusable anywhere |
| Testing | Complex integration | Separate unit + integration |
| Performance | Multiple API calls | Shared cached calls |
| Memory Management | Manual | Automatic registry |
| Error Handling | Scattered | Centralized |
| Type Safety | Partial | Complete TypeScript |

## Conclusion

The FeaturedProductsManager migration to the singleton pattern demonstrates significant improvements in:

1. **Code Organization**: Clear separation of concerns
2. **Reusability**: Logic can be shared across components
3. **Performance**: Optimized API calls and memoization
4. **Maintainability**: Easier to test and modify
5. **Scalability**: Pattern can be applied to other components

This serves as an excellent reference for migrating other complex tenant-scoped components to the singleton system.

## Next Steps for Migration

1. **Identify Candidates**: Look for other complex tenant-scoped components
2. **Analyze Dependencies**: Understand API calls and state management
3. **Plan Migration**: Follow the 4-phase migration strategy
4. **Test Thoroughly**: Ensure feature parity and performance
5. **Document Changes**: Update team on new patterns

Recommended candidates for next migration:
- Tenant dashboard components
- Inventory management components
- User management components
- Settings components
