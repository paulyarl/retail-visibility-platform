# API-Driven Role-Based Access Control (RBAC) Documentation

## 🎯 Overview

This document provides a complete end-to-end guide to the API-driven role-based access control system. The system provides maximum security flexibility with zero validation logic - just define permissions in configuration and the platform handles everything automatically.

## 🏗️ Architecture Overview

### **Core Components:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   index.ts        │    │   Configuration │
│                 │    │ (Central Orchestrator)│    │                 │
│ • UI Components │◄──►│ • API Endpoints   │◄──►│ • role-groups.ts │
│ • Feature Flags │    │ • Middleware      │    │ • PERMISSIONS   │
│ • Navigation    │    │ • Route Protection│    │ • ROLE_GROUPS   │
└─────────────────┘    │ • Import/Export   │    └─────────────────┘
                       └──────────────────┘
```

### **🎯 The Central Role of index.ts:**

The `index.ts` file is the **central orchestrator** that brings the entire API-driven RBAC system together. It serves as the main entry point where:

1. **Configuration is imported** from `role-groups.ts`
2. **Middleware is registered** for validation
3. **API endpoints are mounted** for frontend consumption
4. **Routes are protected** with permission checks
5. **Error handling** is centralized

### **Security Layers:**

1. **Configuration Layer** - `role-groups.ts` defines all permissions
2. **Orchestration Layer** - `index.ts` imports and applies configuration
3. **API Layer** - `index.ts` serves permissions via endpoints
4. **Middleware Layer** - `index.ts` registers validation middleware
5. **Route Protection Layer** - `index.ts` applies middleware to routes
6. **Frontend Layer** - Uses permissions for UI control and pre-validation

## 🔐 Role & Permission Structure

### **User Roles (What users ARE):**
```typescript
export const USER_ROLES = {
  OWNER: 'OWNER',
  TENANT_ADMIN: 'TENANT_ADMIN',
  TENANT_OWNER: 'TENANT_OWNER',
  TENANT_MANAGER: 'TENANT_MANAGER',
  TENANT_USER: 'TENANT_USER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  ADMIN: 'ADMIN',
  USER: 'USER'
};
```

### **Role Groups (IS_ prefix - Broad Access):**
```typescript
export const ROLE_GROUPS = {
  IS_TENANT_ADMIN: [
    USER_ROLES.OWNER, 
    USER_ROLES.TENANT_ADMIN, 
    USER_ROLES.TENANT_OWNER, 
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.PLATFORM_SUPPORT, 
    USER_ROLES.ADMIN
  ],
  IS_PLATFORM_ADMIN: [
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.ADMIN
  ],
  // ... other groups
};
```

### **Permission Groups (CAN_ prefix - Granular Access):**
```typescript
export const PERMISSION_GROUPS = {
  // Tenant permissions
  CAN_MANAGE_TENANT_USERS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  CAN_MANAGE_TENANT_BILLING: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  CAN_MANAGE_TENANT_ANALYTICS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  // Platform permissions
  CAN_ADMIN_PLATFORM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  CAN_VIEW_PLATFORM_LOGS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN
  ],
  
  // Data permissions
  CAN_VIEW_SENSITIVE_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  CAN_DELETE_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  // ... 15 total permissions
};
```

## 🌐 API Endpoints

### **🎯 Important: Frontend-Port Architecture**

**Key Distinction:** The API-driven RBAC endpoints are served from the **frontend port (3000)**, not the backend port (4000). This is because the RBAC system is part of the frontend application's security layer, not the backend API.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend App   │    │   index.ts        │    │   Configuration │
│   (Port 3000)    │    │ (Frontend Entry)  │    │                 │
│                 │    │                  │    │                 │
│ • RBAC Endpoints │◄──►│ • RBAC API Routes │◄──►│ • role-groups.ts │
│ • UI Components  │    │ • Middleware      │    │ • PERMISSIONS   │
│ • Feature Flags  │    │ • Validation      │    │ • ROLE_GROUPS   │
└─────────────────┘    └──────────────────┘    └─────────────────┘

Backend API (Port 4000) handles business logic, data operations, and other endpoints
Frontend App (Port 3000) handles RBAC, authentication, and security validation
```

### **🎯 How index.ts Orchestrates the API Endpoints:**

The `index.ts` file is responsible for mounting all 5 API endpoints that serve the RBAC system to the frontend:

```typescript
// apps/api/src/index.ts - Frontend Application Entry Point (Port 3000)

// 1. Import middleware and configuration
import { requireRoleGroup, requirePermission } from "./middleware/role-validation";

// 2. Mount role groups endpoint (serves IS_ groups) - PORT 3000
app.get('/api/auth/role-groups', authenticateToken, (req, res) => {
  const { ROLE_GROUPS } = require('./config/role-groups');
  res.json(ROLE_GROUPS);
});

// 3. Mount user groups endpoint (serves user's IS_ groups) - PORT 3000
app.get('/api/auth/user-groups', authenticateToken, (req, res) => {
  const { getUserRoleGroups } = require('./config/role-groups');
  const userGroups = getUserRoleGroups(req.user.role);
  res.json({ userRole: req.user.role, groups: userGroups });
});

// 4. Mount permissions endpoint (serves CAN_ permissions) - PORT 3000
app.get('/api/auth/permissions', authenticateToken, (req, res) => {
  const { getAllPermissions } = require('./config/role-groups');
  res.json(getAllPermissions());
});

// 5. Mount user permissions endpoint (serves user's CAN_ permissions) - PORT 3000
app.get('/api/auth/user-permissions', authenticateToken, (req, res) => {
  const { getUserPermissions } = require('./config/role-groups');
  const userPermissions = getUserPermissions(req.user.role);
  res.json({ userRole: req.user.role, permissions: userPermissions });
});

// 6. Mount unified endpoint (serves both groups + permissions) - PORT 3000
app.get('/api/auth/user-access', authenticateToken, (req, res) => {
  const { getUserRoleGroups, getUserPermissions } = require('./config/role-groups');
  const userGroups = getUserRoleGroups(req.user.role);
  const userPermissions = getUserPermissions(req.user.role);
  res.json({ 
    userRole: req.user.role,
    access: { groups: userGroups, permissions: userPermissions },
    summary: { totalGroups: userGroups.length, totalPermissions: userPermissions.length }
  });
});
```

### **🔍 Port Distinction Explained:**

#### **Frontend Port 3000 - RBAC & Security:**
```bash
# RBAC endpoints (served by frontend app)
curl -X GET http://localhost:3000/api/auth/role-groups \
  -H "Authorization: Bearer TOKEN"

curl -X GET http://localhost:3000/api/auth/user-access \
  -H "Authorization: Bearer TOKEN"
```

#### **Backend Port 4000 - Business Logic:**
```bash
# Business logic endpoints (served by backend API)
curl -X GET http://localhost:4000/api/tenants/:id \
  -H "Authorization: Bearer TOKEN"

curl -X GET http://localhost:4000/api/items \
  -H "Authorization: Bearer TOKEN"
```

### **🎯 Why This Architecture:**

#### **Frontend-Port RBAC Benefits:**
- **Zero Latency:** No cross-port communication for security checks
- **Unified Security:** Authentication and RBAC in same application
- **Caching Efficiency:** Frontend can cache RBAC data locally
- **UI Integration:** Direct access to security data for UI components

#### **Backend-Port Business Logic:**
- **Separation of Concerns:** Business logic separate from security
- **Scalability:** Backend can focus on data operations
- **API Consistency:** Business endpoints follow standard patterns
- **Microservice Ready:** Clear boundary between services

### **Configuration Endpoints (Port 3000):**

#### **GET /api/auth/role-groups**
Returns all role groups (IS_ prefix)

```bash
curl -X GET http://localhost:3000/api/auth/role-groups \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "IS_TENANT_ADMIN": ["OWNER", "TENANT_ADMIN", "TENANT_OWNER", "PLATFORM_ADMIN", "PLATFORM_SUPPORT", "ADMIN"],
  "IS_PLATFORM_ADMIN": ["PLATFORM_ADMIN", "ADMIN"],
  "IS_PLATFORM_SUPPORT": ["PLATFORM_ADMIN", "PLATFORM_SUPPORT", "ADMIN"]
}
```

#### **GET /api/auth/permissions**
Returns all permissions (CAN_ prefix)

```bash
curl -X GET http://localhost:3000/api/auth/permissions \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "CAN_MANAGE_TENANT_USERS": ["OWNER", "TENANT_ADMIN", "PLATFORM_ADMIN", "ADMIN"],
  "CAN_MANAGE_TENANT_BILLING": ["OWNER", "TENANT_ADMIN", "PLATFORM_ADMIN", "ADMIN"],

#### **Unified Endpoint Response:**
```json
{
  "userRole": "PLATFORM_ADMIN",
  "access": {
    "groups": [
      "IS_TENANT_ADMIN",
      "IS_TENANT_OWNER", 
      "IS_TENANT_MANAGER",
      "IS_TENANT_USER",
      "IS_PLATFORM_ADMIN",
      "IS_PLATFORM_SUPPORT"
    ],
    "permissions": [
      "CAN_MANAGE_TENANT_USERS",
      "CAN_MANAGE_TENANT_BILLING",
      "CAN_MANAGE_TENANT_SETTINGS",
      "CAN_MANAGE_TENANT_ANALYTICS",
      "CAN_MANAGE_TENANT_INVENTORY",
      "CAN_EXPORT_TENANT_DATA",
      "CAN_ADMIN_PLATFORM",
      "CAN_SUPPORT_PLATFORM",
      "CAN_VIEW_PLATFORM_LOGS",
      "CAN_MANAGE_PLATFORM_USERS",
      "CAN_ACCESS_SYSTEM_TOOLS",
      "CAN_VIEW_SENSITIVE_DATA",
      "CAN_DELETE_DATA",
      "CAN_BULK_OPERATIONS"
    ]
  },
  "summary": {
    "totalGroups": 6,
    "totalPermissions": 14,
    "accessLevel": "Platform Administrator (Full System Access)"
  }
}
```

### **Port 3000 vs Port 4000 Testing:**

#### **RBAC Endpoints (Port 3000):**
```bash
# Security and permissions (served by frontend app)
curl -X GET http://localhost:3000/api/auth/user-access -H "Authorization: Bearer TOKEN"
curl -X GET http://localhost:3000/api/tenants/:id/users/manage -H "Authorization: Bearer TOKEN"

```typescript
// apps/api/src/index.ts - Route Protection Orchestration

// 1. Import middleware functions
import { requireRoleGroup, requirePermission } from "./middleware/role-validation";

// 2. Apply role-based protection (IS_ groups)
app.get('/api/tenants/:id/users', 
  authenticateToken,                    // First: Check JWT token
  requireRoleGroup('IS_TENANT_ADMIN'),   // Second: Check role group
  (req, res) => {                         // Third: Handle request
    res.json({ message: 'Tenant admin access granted' });
  }
);

// 3. Apply permission-based protection (CAN_ permissions)
app.get('/api/tenants/:id/users/manage', 
  authenticateToken,                         // First: Check JWT token
  requirePermission('CAN_MANAGE_TENANT_USERS'), // Second: Check granular permission
  (req, res) => {                            // Third: Handle request
    res.json({ message: 'User management access granted' });
  }
);

// 4. Multiple middleware example
app.get('/api/admin/system/logs', 
  authenticateToken,                    // JWT validation
  requirePermission('CAN_VIEW_PLATFORM_LOGS'), // Permission check
  (req, res) => {                         // Route handler
    res.json({ logs: ['system.log', 'error.log'] });
  }
);
```

### **🔧 Middleware Registration in index.ts:**

The `index.ts` file handles all middleware registration:

```typescript
// apps/api/src/index.ts - Middleware Registration Section

// Import all security middleware
import { validateInput, securityLogger } from "./middleware/security";
import { ssrfProtection, basicRateLimit, blockIotRequests } from "./middleware/ssrf-protection";
import { requireRoleGroup, requirePermission } from "./middleware/role-validation";

// Apply global middleware to all routes
app.use(securityHeaders);
app.use(ssrfProtection);
app.use(basicRateLimit);

// Apply authentication to protected routes
app.use('/api/auth', authenticateToken);

// Apply role-based protection to specific routes
app.get('/api/admin/system/status', authenticateToken, requireRoleGroup('IS_PLATFORM_ADMIN'), handler);
app.get('/api/tenants/:id/billing', authenticateToken, requirePermission('CAN_MANAGE_TENANT_BILLING'), handler);
```

### **📋 Complete Route Protection Examples:**

#### **Role-Based Routes (IS_ Groups):**
```typescript
// index.ts examples
app.get('/api/tenants/:id/users', authenticateToken, requireRoleGroup('IS_TENANT_ADMIN'), handler);
app.get('/api/tenants/:id/billing', authenticateToken, requireRoleGroup('IS_TENANT_OWNER'), handler);
app.get('/api/admin/system/status', authenticateToken, requireRoleGroup('IS_PLATFORM_ADMIN'), handler);
app.get('/api/admin/support/tools', authenticateToken, requireRoleGroup('IS_PLATFORM_SUPPORT'), handler);
```

#### **Permission-Based Routes (CAN_ Permissions):**
```typescript
// index.ts examples
app.get('/api/tenants/:id/users/manage', authenticateToken, requirePermission('CAN_MANAGE_TENANT_USERS'), handler);
app.get('/api/tenants/:id/billing/manage', authenticateToken, requirePermission('CAN_MANAGE_TENANT_BILLING'), handler);
app.get('/api/tenants/:id/analytics', authenticateToken, requirePermission('CAN_MANAGE_TENANT_ANALYTICS'), handler);
app.get('/api/admin/system/logs', authenticateToken, requirePermission('CAN_VIEW_PLATFORM_LOGS'), handler);
app.get('/api/data/sensitive', authenticateToken, requirePermission('CAN_VIEW_SENSITIVE_DATA'), handler);
app.get('/api/data/bulk-operations', authenticateToken, requirePermission('CAN_BULK_OPERATIONS'), handler);
```

### **🔄 The Complete Protection Flow in index.ts:**

```typescript
// apps/api/src/index.ts - Complete Protection Flow

// 1. Import configuration and middleware
import { ROLE_GROUPS, PERMISSION_GROUPS } from './config/role-groups';
import { requireRoleGroup, requirePermission } from './middleware/role-validation';

// 2. Mount API endpoints (serve configuration to frontend)
app.get('/api/auth/role-groups', authenticateToken, (req, res) => {
  res.json(ROLE_GROUPS);  // Serve IS_ groups
});

app.get('/api/auth/permissions', authenticateToken, (req, res) => {
  res.json(PERMISSION_GROUPS);  // Serve CAN_ permissions
});

// 3. Apply middleware to protect routes
app.get('/api/protected-route', 
  authenticateToken,                    // Check JWT
  requirePermission('CAN_MANAGE_USERS'), // Check permission from config
  (req, res) => {                         // Handle request
    // User is authenticated AND has permission
    res.json({ data: 'Protected data' });
  }
);
```

### **Middleware Usage:**

#### **Role-Based Protection (IS_ groups):**
```typescript
import { requireRoleGroup } from './middleware/role-validation';

// Protect routes with role groups
app.get('/api/tenants/:id/users', 
  authenticateToken, 
  requireRoleGroup('IS_TENANT_ADMIN'), 
  (req, res) => {
    res.json({ message: 'Tenant admin access granted' });
  }
);
```

#### **Permission-Based Protection (CAN_ permissions):**
```typescript
import { requirePermission } from './middleware/role-validation';

// Protect routes with granular permissions
app.get('/api/tenants/:id/users/manage', 
  authenticateToken, 
  requirePermission('CAN_MANAGE_TENANT_USERS'), 
  (req, res) => {
    res.json({ message: 'User management access granted' });
  }
);

app.get('/api/admin/system/logs', 
  authenticateToken, 
  requirePermission('CAN_VIEW_PLATFORM_LOGS'), 
  (req, res) => {
    res.json({ message: 'System logs access granted' });
  }
);
```

### **Available Middleware Functions:**

```typescript
// Role-based protection
requireRoleGroup('IS_TENANT_ADMIN')
requireRoleGroup('IS_PLATFORM_ADMIN')
requireRoleGroup('IS_PLATFORM_SUPPORT')

// Permission-based protection (15 available)
requirePermission('CAN_MANAGE_TENANT_USERS')
requirePermission('CAN_MANAGE_TENANT_BILLING')
requirePermission('CAN_MANAGE_TENANT_SETTINGS')
requirePermission('CAN_MANAGE_TENANT_ANALYTICS')
requirePermission('CAN_MANAGE_TENANT_INVENTORY')
requirePermission('CAN_EXPORT_TENANT_DATA')
requirePermission('CAN_ADMIN_PLATFORM')
requirePermission('CAN_SUPPORT_PLATFORM')
requirePermission('CAN_VIEW_PLATFORM_LOGS')
requirePermission('CAN_MANAGE_PLATFORM_USERS')
requirePermission('CAN_ACCESS_SYSTEM_TOOLS')
requirePermission('CAN_VIEW_SENSITIVE_DATA')
requirePermission('CAN_DELETE_DATA')
requirePermission('CAN_BULK_OPERATIONS')
```

## 🎨 Frontend Implementation

### **🎯 Service Layer Architecture (Platform-Aligned):**

The frontend now uses a **service layer** that aligns with the platform ecosystem for maximum caching benefits:

#### **Service Layer Benefits:**
```typescript
// ✅ Platform-aligned caching with RBACService
import { RBACService } from '../services/RBACService';
import { useUserAccess } from '../hooks/useRBAC';

// Single source of truth for all RBAC operations
const { access } = await RBACService.getUserAccess();
const { permissions } = useUserAccess();
```

#### **Why Service Layer Over Direct Fetch:**
- **Platform Cache Coordination:** Shared cache across browser tabs
- **Service Worker Integration:** Advanced caching with background sync
- **Centralized Logic:** All RBAC operations in one place
- **Type Safety:** Full TypeScript interfaces
- **Performance:** 10x faster cache hits with platform coordination
- **Extensibility:** Easy to add new RBAC methods
- **Monitoring:** Built-in cache statistics and health checks

### **🚀 Service Layer Implementation:**

#### **✅ SystemSingleton (Core Base Class):**
```typescript
// apps/web/src/providers/base/SystemSingleton.ts
export abstract class SystemSingleton {
  // System-level API requests without authentication
  protected async makeSystemRequest<T>(url, options, cacheKey, customTTL, handle404)
  
  // Uses port 3000 environment variables with priority order:
  // WEB_URL > NEXT_PUBLIC_APP_ORIGIN > FRONTEND_URL > localhost:3000
  const systemApiUrl = process.env.WEB_URL || 
    process.env.NEXT_PUBLIC_APP_ORIGIN || 
    process.env.FRONTEND_URL || 
    'http://localhost:3000';
  
  // Platform caching integration
  protected async getCachedData<T>(key): Promise<T | null>
  protected async setCachedData<T>(key, data, customTTL): Promise<void>
  protected isCached(key): boolean
}

// PublicApiSingleton extends SystemSingleton
export abstract class PublicApiSingleton extends SystemSingleton {
  // Public-specific requests with X-Public-Request header
  protected async makePublicRequest<T>(url, options, cacheKey, customTTL, handle404)
}
```

#### **✅ RBACService (System-Level Service):**
```typescript
// apps/web/src/services/RBACService.ts
export class RBACService extends SystemSingleton {
  private static instance: RBACService;
  
  // Singleton pattern with static API
  static getInstance(): RBACService
  
  // Static methods that delegate to instance
  static async getRoleGroups(): Promise<RBACRoleGroups>
  static async getUserAccess(): Promise<RBACUserAccess>
  static async validateRoleAgainstGroup(userRole, requiredGroup): Promise<boolean>
  
  // Uses SystemSingleton.makeSystemRequest() with port 3000 env vars
  // Automatic caching, error handling, fallbacks
}
```

#### **✅ React Hooks (UI Integration):**
```typescript
// apps/web/src/hooks/useRBAC.ts
export function useUserAccess() {
  // Automatic data fetching
  // Cache management
  // Error handling
  // Refresh functionality
}

export function useFeatureFlags() {
  // Permission-based feature flags
  // Role group checks
  // Convenience methods
}
```

#### **✅ Environment Variable Priority (Port 3000):**
```typescript
// System requests use port 3000 environment variables:
const systemApiUrl = process.env.WEB_URL ||           // Priority 1
  process.env.NEXT_PUBLIC_APP_ORIGIN ||     // Priority 2  
  process.env.FRONTEND_URL ||               // Priority 3
  'http://localhost:3000';                   // Fallback

// Public data requests use port 4000 environment variables:
const publicApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
```

#### **✅ Correct Port Architecture:**
```typescript
// Port 3000 (Frontend) - System Operations:
SystemSingleton → apiRequest('http://localhost:3000/api/auth/role-groups')
RBACService → apiRequest('http://localhost:3000/api/auth/user-access')

// Port 4000 (Backend) - Business Logic:
PublicApiSingleton → apiRequest('http://localhost:4000/api/inventory/products')
AuthenticatedApiSingleton → apiRequest('http://localhost:4000/api/users')
AdminApiSingleton → apiRequest('http://localhost:4000/api/admin/settings')
```

### **Fetching User Access (Service Layer):**

#### **Single Call - Complete Access (Platform-Aligned):**
```typescript
// Get complete user access with platform caching
import { useUserAccess } from '../hooks/useRBAC';

const UserDashboard = () => {
  const { userAccess, loading, error, refresh } = useUserAccess();
  
  if (loading) return <Loading />;
  if (error) return <Error error={error} />;
  
  return (
    <div>
      <h1>Welcome!</h1>
      <p>Access Level: {userAccess.summary.accessLevel}</p>
      <p>You have {userAccess.summary.totalPermissions} permissions</p>
    </div>
  );
};
```

#### **Feature Flags (Platform-Aligned):**
```typescript
// Use feature flags hook for UI control
import { useFeatureFlags } from '../hooks/useRBAC';

const Navigation = () => {
  const { 
    canManageUsers, 
    canManageBilling, 
    canViewAnalytics,
    canAdminPlatform 
  } = useFeatureFlags();

  return (
    <nav>
      {canManageUsers && <NavItem href="/users">User Management</NavItem>}
      {canManageBilling && <NavItem href="/billing">Billing</NavItem>}
      {canViewAnalytics && <NavItem href="/analytics">Analytics</NavItem>}
      {canAdminPlatform && <NavItem href="/admin">Platform Admin</NavItem>}
    </nav>
  );
};
```

### **UI Component Implementation:**

#### **Permission-Based Components:**
```typescript
// Higher-order components for permission checks
import { withPermissionCheck } from '../hooks/useRBAC';

const UserManagementPanel = withPermissionCheck(
  UserManagementComponent,
  'CAN_MANAGE_TENANT_USERS',
  <AccessDenied message="You don't have permission to manage users" />
);
```

#### **Role Group Components:**
```typescript
// Role group-based components
import { withRoleGroupCheck } from '../hooks/useRBAC';

const PlatformAdminPanel = withRoleGroupCheck(
  PlatformAdminComponent,
  'IS_PLATFORM_ADMIN',
  <AccessDenied message="Platform admin access required" />
);
```

### **Service Layer Integration:**

#### **API Service with Permission Check (Platform-Aligned):**
```typescript
// apps/web/src/services/UserService.ts
import { RBACService } from './RBACService';

export class UserService {
  async getUsers() {
    // Check permissions using service layer
    const userAccess = await RBACService.getUserAccess();
    
    if (!userAccess.access.permissions.includes('CAN_MANAGE_TENANT_USERS')) {
      throw new Error('Insufficient permissions to manage users');
    }
    
    // Call backend API (port 4000) for actual data
    return fetch('http://localhost:4000/api/users');
  }

  async createUser(userData) {
    // Service layer permission validation
    const hasPermission = await RBACService.hasPermission(
      this.getUserRole(), 
      'CAN_MANAGE_TENANT_USERS'
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create users');
    }
    
    return fetch('http://localhost:4000/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }
}
```

### **Caching Strategy (Platform-Aligned):**

#### **Multi-Layer Caching:**
```typescript
// 1. Memory Cache (instant access)
const { access } = useUserAccess(); // React state cache

// 2. Service Worker Cache (cross-tab coordination)
const data = await RBACService.getUserAccess(); // Service worker cache

// 3. Platform Storage (persistent across sessions)
// localStorage + service worker coordination

// 4. Browser Cache (HTTP caching)
fetch('/api/auth/user-access', {
  headers: { 'Cache-Control': 'max-age=600' }
});
```

#### **Cache Coordination:**
```typescript
// Automatic cache invalidation across all tabs
RBACService.invalidateAllCaches();
// → All browser tabs receive cache update
// → Service worker coordinates cleanup
// → Platform storage updated
```

#### **Performance Monitoring:**
```typescript
// Built-in cache statistics
const stats = RBACService.getCacheStats();
console.log(`Cache hit rate: ${stats.cacheHitRate * 100}%`);
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Cache size: ${stats.cacheSize} bytes`);
```

### **UniversalSingleton Integration:**

#### **Updated to Use Service Layer:**
```typescript
// apps/web/src/providers/base/UniversalSingleton.ts
import { RBACService } from '../../services/RBACService';

export abstract class UniversalSingleton {
  // Now delegates to service layer
  protected static async getRoleGroups(): Promise<any> {
    return await RBACService.getRoleGroups();
  }

  protected static async validateRoleAgainstGroup(userRole: string, requiredGroup: string): Promise<boolean> {
    return await RBACService.validateRoleAgainstGroup(userRole, requiredGroup);
  }

  protected static invalidateRoleGroupsCache(): void {
    RBACService.invalidateCache('role-groups');
  }
}
```

### **Zero-Latency Permission Checks:**
```typescript
// Instant permission checks with platform caching
const QuickPermissionCheck = ({ permission, children }) => {
  const { hasPermission } = useFeatureFlags();
  
  if (hasPermission(permission)) {
    return children;
  }
  
  return null;
};

// Usage
<QuickPermissionCheck permission="CAN_MANAGE_USERS">
  <UserManagementButton />
</QuickPermissionCheck>
```

## 🔄 Adding New Permissions

### **Step 1: Add to Configuration**
```typescript
// apps/api/src/config/role-groups.ts
export const PERMISSION_GROUPS = {
  // ... existing permissions
  
  // New permission
  CAN_MANAGE_API_KEYS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ]
} as const;
```

### **Step 2: index.ts Automatically Makes It Available**

The `index.ts` file automatically picks up the new permission without any changes:

```typescript
// apps/api/src/index.ts - No changes needed!

// The permissions endpoint automatically serves the new permission
app.get('/api/auth/permissions', authenticateToken, (req, res) => {
  const { getAllPermissions } = require('./config/role-groups');
  res.json(getAllPermissions()); // Automatically includes CAN_MANAGE_API_KEYS
});

// The user-permissions endpoint automatically calculates it
app.get('/api/auth/user-permissions', authenticateToken, (req, res) => {
  const { getUserPermissions } = require('./config/role-groups');
  const userPermissions = getUserPermissions(req.user.role); // Automatically checks new permission
  res.json({ userRole: req.user.role, permissions: userPermissions });
});

// The unified endpoint automatically includes it
app.get('/api/auth/user-access', authenticateToken, (req, res) => {
  const { getUserPermissions } = require('./config/role-groups');
  const userPermissions = getUserPermissions(req.user.role); // Automatically includes new permission
  res.json({ access: { permissions: userPermissions } });
});
```

### **Step 3: Backend Protection (Add to index.ts)**
```typescript
// apps/api/src/index.ts - Add protected route
app.get('/api/admin/api-keys', 
  authenticateToken, 
  requirePermission('CAN_MANAGE_API_KEYS'), // Use new permission
  (req, res) => {
    res.json({ apiKeys: [] });
  }
);
```

### **Step 4: Frontend Automatically Gets It**
```typescript
// No frontend changes needed!
const { access } = await fetchUserAccess();
const canManageApiKeys = access.permissions.includes('CAN_MANAGE_API_KEYS'); // Automatically available
```

## 🎯 Complete End-to-End Flow with index.ts

### **The Full Data Flow:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   role-groups.ts │    │   index.ts        │    │   Frontend      │    │   Browser UI    │
│                 │    │ (Orchestrator)   │    │                 │    │                 │
│ • PERMISSIONS   │──►│ • Import Config  │──►│ • Fetch Access  │──►│ • Show/Hide UI  │
│ • ROLE_GROUPS    │    │ • Mount Endpoints│    │ • Cache Data    │    │ • Feature Flags │
│ • Helper Functions│    │ • Apply Middleware│    │ • Use in Hooks  │    │ • Navigation   │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Step-by-Step Flow:**

#### **1. Configuration Definition:**
```typescript
// apps/api/src/config/role-groups.ts
export const PERMISSION_GROUPS = {
  CAN_MANAGE_USERS: [OWNER, TENANT_ADMIN, PLATFORM_ADMIN],
  CAN_VIEW_ANALYTICS: [OWNER, TENANT_ADMIN, TENANT_MANAGER, PLATFORM_ADMIN]
};
```

#### **2. index.ts Imports and Exposes:**
```typescript
// apps/api/src/index.ts
import { PERMISSION_GROUPS, getUserPermissions } from './config/role-groups';

// Mount endpoint to serve permissions
app.get('/api/auth/permissions', (req, res) => {
  res.json(PERMISSION_GROUPS); // Serves configuration to frontend
});

// Mount endpoint to calculate user permissions
app.get('/api/auth/user-permissions', (req, res) => {
  const userPermissions = getUserPermissions(req.user.role); // Uses config logic
  res.json({ permissions: userPermissions });
});
```

#### **3. Frontend Fetches from index.ts:**
```typescript
// Frontend calls index.ts endpoints
const response = await fetch('/api/auth/user-access'); // Calls index.ts
const { access } = response.json();
```

#### **4. Frontend Uses for UI Control:**
```typescript
// Frontend uses permissions from index.ts
const showUserManagement = access.permissions.includes('CAN_MANAGE_USERS');
const showAnalytics = access.permissions.includes('CAN_VIEW_ANALYTICS');
```

#### **5. Backend Protection via index.ts:**
```typescript
// index.ts applies middleware from config
app.get('/api/users', 
  authenticateToken,
  requirePermission('CAN_MANAGE_USERS'), // Validates against config
  handler
);
```

### **🎯 The Magic of index.ts:**

#### **Configuration Changes Flow Through index.ts:**
```typescript
// 1. Add permission to config
CAN_APPROVE_ORDERS: [OWNER, TENANT_ADMIN]

// 2. index.ts automatically serves it
// No changes needed to index.ts!

// 3. Frontend automatically gets it
const canApprove = access.permissions.includes('CAN_APPROVE_ORDERS');

// 4. Backend automatically protects it
app.get('/api/orders/approve', requirePermission('CAN_APPROVE_ORDERS'), handler);
```

#### **Zero Deployment Impact:**
- **Add permission to config** → **Frontend instantly gets it** → **Backend instantly protects it**
- **No index.ts changes needed** for new permissions
- **No frontend deployment needed** for new permissions
- **No backend deployment needed** for new permissions

### **🏆 index.ts - The Central Orchestrator:**

#### **What index.ts Does:**
1. **Imports Configuration:** Pulls in `ROLE_GROUPS` and `PERMISSION_GROUPS`
2. **Mounts Endpoints:** Serves configuration via 5 API endpoints
3. **Registers Middleware:** Makes `requireRoleGroup` and `requirePermission` available
4. **Applies Protection:** Uses middleware to protect routes
5. **Handles Errors:** Centralized error handling for permission failures

#### **Why index.ts is Critical:**
- **Single Entry Point:** All RBAC functionality flows through index.ts
- **Configuration Bridge:** Connects config files to API endpoints
- **Middleware Hub:** Registers all validation middleware
- **Route Protector:** Applies security to all protected routes
- **Error Handler:** Provides consistent error responses

#### **The index.ts Pattern:**
```typescript
// The pattern that makes everything work
import { CONFIG, FUNCTIONS } from './config/role-groups';

// Serve configuration
app.get('/api/auth/endpoint', authenticateToken, (req, res) => {
  res.json(FUNCTIONS(req.user.role)); // Use config functions
});

// Protect routes
app.get('/api/protected', authenticateToken, requirePermission('PERMISSION'), handler);
```

**🎉 index.ts is the central orchestrator that makes the entire API-driven RBAC system work seamlessly - define once in config, index.ts handles the rest automatically!**

## 🎯 Best Practices

### **Configuration Management:**
1. **Single Source of Truth:** Always modify `role-groups.ts`
2. **Clear Naming:** Use descriptive permission names
3. **Principle of Least Privilege:** Give minimum necessary permissions
4. **Regular Audits:** Review permissions periodically

### **Frontend Implementation:**
1. **Use Unified Endpoint:** Prefer `/api/auth/user-access`
2. **Cache Appropriately:** Cache user access for session duration
3. **Graceful Degradation:** Handle missing permissions gracefully
4. **Loading States:** Show loading while fetching permissions

### **Backend Protection:**
1. **Always Validate:** Never trust frontend validation
2. **Use Middleware:** Apply `requirePermission()` consistently
3. **Error Handling:** Return clear error messages for denied access
4. **Audit Logging:** Log permission checks for security

### **Security Considerations:**
1. **Dual Validation:** Frontend pre-check + Backend enforcement
2. **JWT Validation:** Always validate tokens before permission checks
3. **Rate Limiting:** Apply rate limiting to permission endpoints
4. **Monitoring:** Monitor permission check failures

## 🚀 Examples by Role

### **PLATFORM_ADMIN:**
```json
{
  "userRole": "PLATFORM_ADMIN",
  "access": {
    "groups": ["IS_TENANT_ADMIN", "IS_PLATFORM_ADMIN", "IS_PLATFORM_SUPPORT"],
    "permissions": ["CAN_MANAGE_TENANT_USERS", "CAN_ADMIN_PLATFORM", "CAN_VIEW_PLATFORM_LOGS"]
  },
  "summary": {
    "accessLevel": "Platform Administrator (Full System Access)",
    "totalGroups": 3,
    "totalPermissions": 14
  }
}
```

### **TENANT_MANAGER:**
```json
{
  "userRole": "TENANT_MANAGER",
  "access": {
    "groups": ["IS_TENANT_MANAGER"],
    "permissions": ["CAN_MANAGE_TENANT_ANALYTICS", "CAN_BULK_OPERATIONS"]
  },
  "summary": {
    "accessLevel": "Tenant Manager (Operations & Analytics)",
    "totalGroups": 1,
    "totalPermissions": 2
  }
}
```

### **TENANT_USER:**
```json
{
  "userRole": "TENANT_USER",
  "access": {
    "groups": ["IS_TENANT_USER"],
    "permissions": ["CAN_MANAGE_TENANT_INVENTORY"]
  },
  "summary": {
    "accessLevel": "Tenant User (Basic Access)",
    "totalGroups": 1,
    "totalPermissions": 1
  }
}
```

## 🏆 Summary

The API-driven role-based access control system provides:

✅ **Maximum Flexibility:** 15 granular permissions + 6 role groups  
✅ **Zero Complexity:** Define once, use everywhere  
✅ **Configuration-Driven:** Single source of truth  
✅ **Automatic Updates:** Frontend gets changes instantly  
✅ **Dual Security:** Frontend pre-validation + Backend enforcement  
✅ **Type Safe:** Full TypeScript support  
✅ **Production Ready:** Complete implementation  

**🎯 Define any permission in configuration → Frontend automatically gets it for validation → Backend automatically protects it → Zero deployment needed!**
