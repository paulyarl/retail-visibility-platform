# Service Integration Guide

## 🚀 **Integration Phase: Using the New Services**

This guide demonstrates how to integrate the newly extracted services into your application and replace the old PlatformHomeSingletonService calls.

## 📋 **Integration Checklist**

- [ ] Update component imports
- [ ] Replace service calls
- [ ] Test functionality
- [ ] Update error handling
- [ ] Verify cache behavior

## 🔧 **Step 1: Update Imports**

### **Before (Old Pattern):**
```typescript
import { platformHomeService } from '../services/PlatformHomeSingletonService';
```

### **After (New Pattern):**
```typescript
import { tenantUserService } from '../services';
// OR import individual services
import { tenantUserService, adminUserService } from '../services';
```

## 🔄 **Step 2: Replace Service Calls**

### **Example 1: Tenant User Management**

#### **Before:**
```typescript
// Old way - using PlatformHomeSingletonService
const users = await platformHomeService.getTenantUsers(tenantId);
const newUser = await platformHomeService.addTenantUser(tenantId, userData);
```

#### **After:**
```typescript
// New way - using dedicated service
import { tenantUserService } from '../services';

const users = await tenantUserService.getTenantUsers(tenantId);
const newUser = await tenantUserService.addTenantUser(tenantId, userData);
```

### **Example 2: Admin Operations**

#### **Before:**
```typescript
const adminUsers = await platformHomeService.getAdminUsers();
await platformHomeService.deleteAdminUser(userId);
```

#### **After:**
```typescript
import { adminUserService } from '../services';

const adminUsers = await adminUserService.getAdminUsers();
await adminUserService.deleteAdminUser(userId);
```

### **Example 3: Featured Products**

#### **Before:**
```typescript
const featuredProducts = await platformHomeService.getFeaturedProducts(10, 0);
await platformHomeService.unfeatureProduct(productId);
```

#### **After:**
```typescript
import { featuredProductsService } from '../services';

const featuredProducts = await featuredProductsService.getFeaturedProducts(10, 0);
await featuredProductsService.unfeatureProduct(productId);
```

## 🎯 **Step 3: Error Handling Pattern**

### **Consistent Error Handling**
All new services follow the same error handling pattern:

```typescript
try {
  const result = await tenantUserService.addTenantUser(tenantId, userData);
  // Success - result contains the user data
  console.log('User added successfully:', result);
} catch (error) {
  // Error - properly logged and thrown by service
  console.error('Failed to add user:', error);
  // Show user-friendly error message
  showNotification('Failed to add user. Please try again.', 'error');
}
```

## 📱 **Step 4: React Component Integration**

### **Example Component Migration**

#### **Before:**
```typescript
import { platformHomeService } from '../services/PlatformHomeSingletonService';

function TenantUserManager({ tenantId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const userList = await platformHomeService.getTenantUsers(tenantId);
        setUsers(userList || []);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, [tenantId]);

  const handleAddUser = async (userData) => {
    try {
      const newUser = await platformHomeService.addTenantUser(tenantId, userData);
      setUsers(prev => [...prev, newUser]);
    } catch (error) {
      console.error('Failed to add user:', error);
    }
  };

  return (
    // Component JSX
  );
}
```

#### **After:**
```typescript
import { tenantUserService } from '../services';

function TenantUserManager({ tenantId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const userList = await tenantUserService.getTenantUsers(tenantId);
        setUsers(userList || []);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, [tenantId]);

  const handleAddUser = async (userData) => {
    try {
      const newUser = await tenantUserService.addTenantUser(tenantId, userData);
      setUsers(prev => [...prev, newUser]);
    } catch (error) {
      console.error('Failed to add user:', error);
    }
  };

  return (
    // Component JSX
  );
}
```

## 🔍 **Step 5: Service Registry Usage**

For dynamic service access, you can use the service registry:

```typescript
import { services, getService } from '../services';

// Access service by name
const userService = getService('tenantUserService');
const users = await userService.getTenantUsers(tenantId);

// Access by category
import { serviceCategories } from '../services';
const analyticsService = serviceCategories.analytics.adminAnalyticsService;
const stats = await analyticsService.getAdminDirectoryStats();
```

## 🧪 **Step 6: Testing Integration**

### **Unit Testing Example**

```typescript
import { tenantUserService } from '../services';

// Mock the service for testing
jest.mock('../services', () => ({
  tenantUserService: {
    getTenantUsers: jest.fn(),
    addTenantUser: jest.fn(),
  }
}));

describe('TenantUserManager', () => {
  it('should load users on mount', async () => {
    const mockUsers = [{ id: '1', email: 'test@example.com', role: 'admin' }];
    tenantUserService.getTenantUsers.mockResolvedValue(mockUsers);

    const { getByText } = render(<TenantUserManager tenantId="123" />);
    
    await waitFor(() => {
      expect(getByText('test@example.com')).toBeInTheDocument();
    });
  });
});
```

## 📊 **Step 7: Performance Monitoring**

### **Cache Performance**

The new services maintain the same caching behavior as before:

```typescript
// Cache hits are automatically logged
const users = await tenantUserService.getTenantUsers(tenantId);
// Console: [TenantUserService] Cache hit for platform-tenant-users-123

// Cache invalidation happens automatically
await tenantUserService.addTenantUser(tenantId, userData);
// Console: [TenantUserService] Invalidating cache pattern: platform-tenant-users-123*
```

### **Metrics Collection**

Services automatically collect performance metrics:

```typescript
// Access service metrics
const metrics = tenantUserService.getMetrics();
console.log('Cache hit rate:', metrics.cacheHitRate);
console.log('API calls made:', metrics.apiCallCount);
```

## 🔄 **Step 8: Batch Migration Strategy**

### **Phase 1: Low-Risk Services**
Start with read-only services:
- ✅ FeaturedProductsService
- ✅ AdminAnalyticsService
- ✅ TenantAnalyticsService

### **Phase 2: User Management Services**
- ✅ TenantUserService
- ✅ AdminUserService
- ✅ UserManagementService

### **Phase 3: Write-Heavy Services**
- ✅ TenantTierService
- ✅ InventoryScanService
- ✅ IntegrationService

### **Phase 4: Complex Services**
- ✅ OrganizationService
- ✅ SubdomainService
- ✅ TenantCategoryService

## 🎯 **Migration Validation**

### **Functional Testing Checklist**

- [ ] All service calls return expected data
- [ ] Error handling works correctly
- [ ] Cache invalidation functions properly
- [ ] Loading states work as expected
- [ ] UI updates correctly after operations

### **Performance Testing Checklist**

- [ ] No performance regressions
- [ ] Cache hit rates remain high
- [ ] API call counts are optimized
- [ ] Memory usage is stable

## 🚨 **Common Issues and Solutions**

### **Issue 1: Import Errors**
**Problem:** `Cannot find module '../services'`

**Solution:** Ensure the index.ts file is properly exported:
```typescript
// In services/index.ts
export { tenantUserService, TenantUserService } from './TenantUserService';
```

### **Issue 2: Type Errors**
**Problem:** TypeScript errors with service methods

**Solution:** Check that interfaces are properly defined:
```typescript
// Each service should define its interfaces
export interface User {
  id: string;
  email: string;
  // ... other properties
}
```

### **Issue 3: Cache Issues**
**Problem:** Stale data after updates

**Solution:** Verify cache invalidation:
```typescript
// Services automatically invalidate cache
await service.invalidateCache('pattern*');
```

## 📈 **Benefits Achieved**

### **Code Quality**
- **Better separation of concerns**
- **Easier unit testing**
- **Type safety improvements**
- **Consistent error handling**

### **Developer Experience**
- **Clearer service boundaries**
- **Better IDE support**
- **Easier debugging**
- **Improved documentation**

### **Performance**
- **Same caching behavior**
- **Better memory management**
- **Optimized bundle sizes**
- **Faster development cycles**

## 🎉 **Migration Complete!**

Once you've completed these steps, your application will be using the new service architecture with:

- ✅ **12 focused services** instead of one monolithic service
- ✅ **Consistent ApiResult pattern** across all operations
- ✅ **Better testability** and maintainability
- ✅ **Same performance** as before
- ✅ **Improved developer experience**

**Ready for Production!** 🚀
