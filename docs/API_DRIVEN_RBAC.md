# API-Driven Role-Based Access Control (RBAC) System

## 🎯 Overview

A comprehensive, API-driven RBAC system that provides secure, role-based access control with flexible group validation. The system uses a gatekeeper architecture where services specify requirements and the system validates user permissions automatically.

## 🏗️ Architecture

### **Gatekeeper Pattern**
```
Service Layer (Gate Specifier) → Base Singleton (Gatekeeper) → API/Cache (Protected Resource)
```

- **Services**: Specify required access groups (no user knowledge)
- **Base Singletons**: Validate user permissions against API-driven groups
- **System**: Automatic token parsing, validation, and access control

## 🚪 Base Singleton Classes

### **AdminApiSingleton**
Handles platform-level administrative operations.

**Allowed Groups:**
- `IS_PLATFORM_ADMIN` - Full system administration
- `IS_PLATFORM_SUPPORT` - Support and troubleshooting access

**Headers:**
- `X-Admin-Request: true` - Marks request as admin operation
- `X-Request-Group: <group>` - Single group validation
- `X-Request-Groups: <group1,group2>` - Multiple groups
- `X-Require-All: true|false` - AND/OR logic for multiple groups

### **TenantApiSingleton**
Handles tenant-specific operations.

**Allowed Groups:**
- `IS_TENANT_ADMIN` - Tenant administration
- `IS_TENANT_OWNER` - Billing and critical settings
- `IS_TENANT_MANAGER` - Operations and analytics
- `IS_TENANT_USER` - Basic tenant access

**Headers:**
- `X-Tenant-Request: true` - Marks request as tenant operation
- `X-Request-Group: <group>` - Single group validation
- `X-Request-Groups: <group1,group2>` - Multiple groups
- `X-Require-All: true|false` - AND/OR logic for multiple groups

## 📖 Usage Examples

### **Single Group Validation**
```typescript
class TenantSettingsService extends TenantApiSingleton {
  async updateBilling() {
    return this.makeTenantRequest('/api/tenant/billing', {
      requestGroup: 'IS_TENANT_OWNER' // Requires tenant owner access
    });
  }
}

class PlatformAdminService extends AdminApiSingleton {
  async manageSystemUsers() {
    return this.makeAdminRequest('/api/admin/users', {
      requestGroup: 'IS_PLATFORM_ADMIN' // Requires platform admin access
    });
  }
}
```

### **Multiple Groups - AND Logic (Default)**
```typescript
class CrossTenantService extends AdminApiSingleton {
  async migrateTenantData() {
    return this.makeAdminRequest('/api/admin/tenant-migration', {
      requestGroups: ['IS_PLATFORM_ADMIN', 'IS_PLATFORM_SUPPORT'], // Must have BOTH
      requireAll: true // AND logic (default)
    });
  }
}
```

### **Multiple Groups - OR Logic**
```typescript
class TenantAnalyticsService extends TenantApiSingleton {
  async viewAnalytics() {
    return this.makeTenantRequest('/api/tenant/analytics', {
      requestGroups: ['IS_TENANT_MANAGER', 'IS_TENANT_ADMIN'], // Needs ANY of these
      requireAll: false // OR logic
    });
  }
}
```

### **Complex Multi-Role Operations**
```typescript
class EmergencyAccessService extends AdminApiSingleton {
  async emergencyIntervention() {
    return this.makeAdminRequest('/api/admin/emergency', {
      requestGroups: ['IS_PLATFORM_ADMIN', 'IS_PLATFORM_SUPPORT'],
      requireAll: false // OR logic - any admin or support can intervene
    });
  }
}

class HighSecurityTenantService extends TenantApiSingleton {
  async criticalOperation() {
    return this.makeTenantRequest('/api/tenant/critical', {
      requestGroups: ['IS_TENANT_OWNER', 'IS_TENANT_ADMIN'],
      requireAll: true // AND logic - must be both owner AND admin
    });
  }
}
```

## 🔐 Security Features

### **Pre-Request Validation**
- **Group Validation**: Only allowed groups per base class
- **Role Verification**: API-driven role group validation
- **Early Rejection**: Unauthorized requests blocked before API calls
- **Cache Security**: Only authorized users can populate/access cache

### **Token-Based Authentication**
- **JWT Parsing**: Automatic user role extraction from tokens
- **Dynamic Validation**: Real-time permission checking
- **Zero Knowledge**: Services don't know about user identities

### **Header Security**
- **Request Type Marking**: `X-Admin-Request`/`X-Tenant-Request`
- **Group Propagation**: Validation groups sent to backend
- **Logic Indication**: `X-Require-All` for AND/OR logic

### **🎯 Optimal API Group Level Security Setup**

For maximum security and maintainability, **service-level and API route-level group names must be identical**. This creates a unified security contract between frontend and backend.

#### **Security Alignment Pattern**
```typescript
// Frontend Service (Gate Specifier)
class TenantSettingsService extends TenantApiSingleton {
  async updateBilling() {
    return this.makeTenantRequest('/api/tenant/billing', {
      requestGroup: 'IS_TENANT_OWNER' // ← Frontend requirement
    });
  }
}

// Backend API Route (Gate Enforcer)
app.put('/api/tenant/billing', authenticate, (req, res) => {
  const requiredGroup = 'IS_TENANT_OWNER'; // ← Identical group name
  
  // Backend validates the same group
  if (!req.user.groups.includes(requiredGroup)) {
    return res.status(403).json({ 
      error: `${requiredGroup} access required` 
    });
  }
  
  // Proceed with billing operation
});
```

#### **Why Identical Group Names Matter**

1. **Security Consistency**: Same validation logic on both ends
2. **Maintainability**: Single source of truth for group names
3. **Debugging**: Easy to trace permission flows
4. **Documentation**: Clear security contract
5. **Testing**: Predictable behavior across layers

#### **Implementation Best Practices**

```typescript
// 1. Centralized Group Constants (Shared Package)
export const SECURITY_GROUPS = {
  TENANT_OWNER: 'IS_TENANT_OWNER',
  TENANT_ADMIN: 'IS_TENANT_ADMIN',
  TENANT_MANAGER: 'IS_TENANT_MANAGER',
  TENANT_USER: 'IS_TENANT_USER',
  PLATFORM_ADMIN: 'IS_PLATFORM_ADMIN',
  PLATFORM_SUPPORT: 'IS_PLATFORM_SUPPORT'
} as const;

// 2. Frontend Service Usage
class TenantService extends TenantApiSingleton {
  async criticalOperation() {
    return this.makeTenantRequest('/api/tenant/critical', {
      requestGroup: SECURITY_GROUPS.TENANT_OWNER
    });
  }
}

// 3. Backend Route Protection
app.put('/api/tenant/critical', authenticate, (req, res) => {
  const requiredGroup = SECURITY_GROUPS.TENANT_OWNER;
  
  if (!hasGroup(req.user, requiredGroup)) {
    return res.status(403).json({ 
      error: `${requiredGroup} access required` 
    });
  }
  
  // Operation logic
});
```

#### **Security Benefits of Alignment**

- **Double Validation**: Frontend pre-validation + backend enforcement
- **Defense in Depth**: Multiple security layers with identical rules
- **Consistent Errors**: Same error messages across frontend/backend
- **Audit Trail**: Clear permission checking at every layer
- **Future-Proof**: Easy to add new groups consistently
- **🔒 Unauthorized Service Prevention**: Discourages out-of-spec services from attempting to call endpoints they're not designed for, as they would need to know the exact group names and validation logic

#### **How Alignment Prevents Unauthorized Access**

```typescript
// ❌ UNAUTHORIZED SERVICE (Blocked by alignment)
class MaliciousService {
  async hackEndpoint() {
    // This fails because:
    // 1. Service doesn't extend proper base class
    // 2. Can't use makeAdminRequest/makeTenantRequest
    // 3. Must manually craft request without proper headers
    // 4. Backend expects X-Admin-Request + correct group
    return fetch('/api/admin/users', {
      headers: { 'Content-Type': 'application/json' }
      // Missing: X-Admin-Request, X-Request-Group, proper auth
    });
  }
}

// ✅ AUTHORIZED SERVICE (Protected by alignment)
class LegitimateAdminService extends AdminApiSingleton {
  async manageUsers() {
    // This succeeds because:
    // 1. Service extends proper base class
    // 2. Uses makeAdminRequest with correct group
    // 3. Headers automatically added: X-Admin-Request, X-Request-Group
    // 4. Backend validates identical group name
    return this.makeAdminRequest('/api/admin/users', {
      requestGroup: 'IS_PLATFORM_ADMIN'
    });
  }
}
```

#### **Security Through Obscurity + Validation**

The alignment creates a **security contract** that:
- **Requires Knowledge**: Unauthorized services must know exact group names
- **Enforces Patterns**: Only proper base classes can add required headers
- **Validates Consistently**: Backend rejects requests without matching groups
- **Audits Automatically**: All requests traceable to legitimate services

#### **🚨 Critical Cross-Tenant Leakage Prevention**

In multi-tenant platforms, this alignment is **essential for preventing cross-tenant data leakage** - one of the most critical security vulnerabilities.

##### **Cross-Tenant Attack Scenarios Prevented**

```typescript
// ❌ PREVENTED: Cross-tenant data access attempt
class TenantAService {
  async accessTenantBData() {
    // This fails because:
    // 1. Service can't specify tenant context properly
    // 2. Missing X-Tenant-Request header
    // 3. No tenant-specific group validation
    // 4. Backend rejects without proper tenant isolation
    return fetch('/api/tenants/tenant-b/data', {
      headers: { 'Authorization': 'Bearer token-from-tenant-a' }
      // Missing: X-Tenant-Request, X-Request-Group, tenant validation
    });
  }
}

// ✅ PROTECTED: Proper tenant isolation
class TenantAService extends TenantApiSingleton {
  async accessOwnData() {
    // This succeeds because:
    // 1. Service extends TenantApiSingleton (tenant-aware)
    // 2. X-Tenant-Request header automatically added
    // 3. User token validated against tenant context
    // 4. Backend enforces tenant isolation
    return this.makeTenantRequest('/api/tenants/current/data', {
      requestGroup: 'IS_TENANT_USER'
    });
  }
}
```

##### **Multi-Tenant Security Layers**

```typescript
// 🔒 LAYER 1: Frontend Tenant Isolation
class TenantService extends TenantApiSingleton {
  async getTenantData() {
    // 1. User token contains tenant_id
    // 2. makeTenantRequest validates tenant context
    // 3. Headers: X-Tenant-Request + X-Request-Group
    return this.makeTenantRequest('/api/tenant/data', {
      requestGroup: 'IS_TENANT_USER'
    });
  }
}

// 🔒 LAYER 2: Backend Tenant Validation
app.get('/api/tenant/data', authenticate, (req, res) => {
  // 1. Validate X-Tenant-Request header exists
  // 2. Extract tenant_id from user token
  // 3. Ensure user belongs to specified tenant
  // 4. Validate IS_TENANT_USER group for that tenant
  // 5. Return only tenant's own data
  
  const userTenantId = req.user.tenant_id;
  const requestedTenantId = req.query.tenant_id;
  
  // 🚨 CRITICAL: Prevent cross-tenant access
  if (userTenantId !== requestedTenantId) {
    return res.status(403).json({ 
      error: 'Cross-tenant access denied' 
    });
  }
  
  // Proceed with tenant-specific data retrieval
});
```

##### **Why This Prevents Data Leakage**

1. **Token Binding**: User tokens are bound to specific tenants
2. **Header Validation**: `X-Tenant-Request` required for tenant operations
3. **Group Context**: Groups validated within tenant context
4. **Backend Enforcement**: Server validates tenant ownership
5. **Audit Logging**: All cross-tenant attempts logged and blocked

##### **Real-World Impact**

```typescript
// 🚨 WITHOUT ALIGNMENT (Vulnerable)
// Attacker can craft requests to access other tenants' data
fetch('/api/tenants/123/sensitive-data', {
  headers: { 'Authorization': 'Bearer attacker-token' }
});
// → Might succeed if backend doesn't validate tenant ownership

// ✅ WITH ALIGNMENT (Secure)
// Attacker cannot access other tenants' data
class AttackerService {
  async hackOtherTenant() {
    // ❌ Fails: No X-Tenant-Request header
    // ❌ Fails: No tenant group validation  
    // ❌ Fails: Backend rejects missing security headers
    return fetch('/api/tenants/123/sensitive-data', {
      headers: { 'Authorization': 'Bearer attacker-token' }
    });
  }
}
```

##### **Multi-Tenant Security Benefits**

- **🔒 Tenant Isolation**: Each tenant's data is completely isolated
- **🚫 Leakage Prevention**: Cross-tenant access attempts automatically blocked
- **📊 Compliance**: Meets SOC2, GDPR, HIPAA tenant isolation requirements
- **🔍 Audit Trail**: All cross-tenant attempts logged for security monitoring
- **⚡ Performance**: Efficient tenant-based caching and data retrieval

#### **Common Anti-Patterns to Avoid**

```typescript
// ❌ AVOID: Different group names
// Frontend: requestGroup: 'IS_TENANT_OWNER'
// Backend: requiredGroup: 'TENANT_OWNER_ACCESS'

// ❌ AVOID: Hardcoded strings
// Frontend: requestGroup: 'IS_TENANT_OWNER'
// Backend: if (req.user.role === 'admin') // Different logic

// ✅ CORRECT: Identical group names
// Frontend: requestGroup: 'IS_TENANT_OWNER'
// Backend: requiredGroup: 'IS_TENANT_OWNER'
```

## 🛡️ Allowed Groups Matrix

| Base Class | Single Groups | Multiple Groups | Logic Support |
|------------|---------------|------------------|---------------|
| **AdminApiSingleton** | `IS_PLATFORM_ADMIN`, `IS_PLATFORM_SUPPORT` | ✅ | AND/OR |
| **TenantApiSingleton** | `IS_TENANT_ADMIN`, `IS_TENANT_OWNER`, `IS_TENANT_MANAGER`, `IS_TENANT_USER` | ✅ | AND/OR |

## 🔄 Validation Flow

### **Single Group Request**
```
1. Service specifies: requestGroup: 'IS_TENANT_OWNER'
2. Base Singleton validates: Is 'IS_TENANT_OWNER' allowed? ✅
3. System checks: Does user have 'IS_TENANT_OWNER' permission? ✅
4. Headers added: X-Tenant-Request, X-Request-Group
5. API call executed with caching
```

### **Multiple Groups - AND Logic**
```
1. Service specifies: requestGroups: ['GROUP1', 'GROUP2'], requireAll: true
2. Base Singleton validates: Are all groups allowed? ✅
3. System checks: Does user have GROUP1? ✅ → Does user have GROUP2? ✅
4. Headers added: X-Tenant-Request, X-Request-Groups, X-Require-All: true
5. API call executed with caching
```

### **Multiple Groups - OR Logic**
```
1. Service specifies: requestGroups: ['GROUP1', 'GROUP2'], requireAll: false
2. Base Singleton validates: Are all groups allowed? ✅
3. System checks: Does user have GROUP1? ❌ → Does user have GROUP2? ✅
4. Headers added: X-Tenant-Request, X-Request-Groups, X-Require-All: false
5. API call executed with caching
```

## 🚨 Error Handling

### **Invalid Group Errors**
```typescript
// Invalid group for admin operations
{
  success: false,
  error: {
    status: 403,
    message: "Invalid admin group: IS_TENANT_OWNER. Allowed groups: IS_PLATFORM_ADMIN, IS_PLATFORM_SUPPORT",
    code: "INVALID_ADMIN_GROUP"
  }
}

// Invalid groups for tenant operations
{
  success: false,
  error: {
    status: 403,
    message: "Invalid tenant groups: IS_PLATFORM_ADMIN. Allowed groups: IS_TENANT_ADMIN, IS_TENANT_OWNER, IS_TENANT_MANAGER, IS_TENANT_USER",
    code: "INVALID_TENANT_GROUPS"
  }
}
```

### **Permission Denied Errors**
```typescript
// Single group denied
{
  success: false,
  error: {
    status: 403,
    message: "IS_TENANT_OWNER access required",
    code: "IS_TENANT_OWNER_ACCESS_REQUIRED"
  }
}

// Multiple groups denied (AND logic)
{
  success: false,
  error: {
    status: 403,
    message: "Requires all of these admin groups: IS_PLATFORM_ADMIN, IS_PLATFORM_SUPPORT",
    code: "MULTIPLE_ADMIN_GROUPS_REQUIRED"
  }
}

// Multiple groups denied (OR logic)
{
  success: false,
  error: {
    status: 403,
    message: "Requires any of these tenant groups: IS_TENANT_MANAGER, IS_TENANT_ADMIN",
    code: "MULTIPLE_TENANT_GROUPS_REQUIRED"
  }
}
```

## 🔧 Backend Integration

### **CORS Configuration**
```typescript
allowedHeaders: [
  'content-type',
  'authorization',
  'x-csrf-token',
  'x-tenant-id',
  'x-no-retry',
  'x-device-info',
  'x-admin-request',        // Admin request marking
  'x-tenant-request',       // Tenant request marking
  'x-request-group',        // Single group validation
  'x-request-groups',       // Multiple groups
  'x-require-all'           // AND/OR logic indicator
]
```

### **Backend Middleware**
```typescript
// Example backend validation middleware
app.use((req, res, next) => {
  const isAdminRequest = req.headers['x-admin-request'] === 'true';
  const isTenantRequest = req.headers['x-tenant-request'] === 'true';
  const requestGroup = req.headers['x-request-group'];
  const requestGroups = req.headers['x-request-groups']?.split(',');
  const requireAll = req.headers['x-require-all'] === 'true';

  // Validate request type matches allowed groups
  // Additional backend validation can be added here
  
  next();
});
```

## 🎯 Best Practices

### **Service Design**
- **Specify Minimum Requirements**: Use the least privileged group that works
- **Clear Intent**: Use descriptive group names that match operation purpose
- **Consistent Patterns**: Follow the same validation pattern across services

### **Group Selection**
- **Single Group**: Use for simple, clear-cut permissions
- **AND Logic**: Use for high-security operations requiring multiple roles
- **OR Logic**: Use for flexible access where any of several roles suffices

### **Error Handling**
- **Graceful Degradation**: Provide meaningful error messages
- **Security**: Don't reveal system details in error messages
- **Logging**: Log security violations for monitoring

## 🔄 Migration Guide

### **From Single Group to Multiple Groups**
```typescript
// Before (single group)
await this.makeTenantRequest('/api/tenant/settings', {
  requestGroup: 'IS_TENANT_OWNER'
});

// After (multiple groups - AND logic)
await this.makeTenantRequest('/api/tenant/settings', {
  requestGroups: ['IS_TENANT_OWNER', 'IS_TENANT_ADMIN'],
  requireAll: true
});

// After (multiple groups - OR logic)
await this.makeTenantRequest('/api/tenant/settings', {
  requestGroups: ['IS_TENANT_MANAGER', 'IS_TENANT_ADMIN'],
  requireAll: false
});
```

### **Backward Compatibility**
- Single `requestGroup` parameter remains fully supported
- Existing services continue to work without changes
- New multiple groups functionality is additive

## 🚀 Benefits

### **Security**
- **Zero Knowledge Services**: Services don't handle user data
- **Centralized Validation**: All permission checks in one place
- **API-Driven**: Roles and groups managed centrally
- **Pre-Request Filtering**: Unauthorized requests blocked early

### **Maintainability**
- **Clean Separation**: Clear boundaries between layers
- **Flexible Validation**: Support for complex permission scenarios
- **Type Safety**: Full TypeScript support
- **Consistent Patterns**: Uniform approach across all services

### **Performance**
- **Caching Integration**: Secure cache access tied to permissions
- **Early Rejection**: No wasted API calls for unauthorized users
- **Efficient Validation**: Optimized group checking logic

---

This API-driven RBAC system provides enterprise-grade security with maximum flexibility and maintainability. The gatekeeper pattern ensures clean separation of concerns while supporting complex permission scenarios through single and multiple group validation with configurable AND/OR logic.

## 📚 Future Reference & Maintenance Guide

### **🎯 System Architecture Overview**

This section serves as a comprehensive reference for future developers, security audits, and system maintenance.

#### **Core Design Principles**
1. **Gatekeeper Pattern** - Services specify gates, system validates access
2. **Zero Knowledge Services** - Services don't handle user identity
3. **API-Driven Validation** - All permissions managed centrally
4. **Multi-Layer Security** - Frontend + backend + database validation
5. **Cross-Tenant Isolation** - Critical for multi-tenant platforms

#### **System Components Map**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Services    │ │───▶│ │ Routes       │ │───▶│ │ Tables      │ │
│ │ (Gate Spec) │ │    │ │ (Gate Enforcer)│ │    │ │ (Data Store)│ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│       │         │    │         │         │    │        │        │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Base        │ │    │ │ Middleware   │ │    │ │ RBAC Tables │ │
│ │ Singletons  │ │    │ │ (Validation) │ │    │ │ (Groups)    │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **🔧 Implementation Checklist**

#### **When Adding New Services**
```typescript
// ✅ CHECKLIST FOR NEW SERVICES
class NewService extends TenantApiSingleton { // 1. Extend proper base class
  async sensitiveOperation() {
    return this.makeTenantRequest('/api/new/endpoint', {
      requestGroup: 'IS_TENANT_ADMIN', // 2. Specify appropriate group
      // OR requestGroups for multiple groups
    });
  }
}
```

#### **When Adding New API Routes**
```typescript
// ✅ CHECKLIST FOR NEW ROUTES
app.post('/api/new/endpoint', authenticate, (req, res) => {
  // 1. Validate required headers
  if (!req.headers['x-tenant-request']) {
    return res.status(400).json({ error: 'Missing tenant request header' });
  }
  
  // 2. Validate group (must match frontend exactly)
  const requiredGroup = 'IS_TENANT_ADMIN';
  if (!hasGroup(req.user, requiredGroup)) {
    return res.status(403).json({ error: `${requiredGroup} access required` });
  }
  
  // 3. Validate tenant ownership (for multi-tenant)
  if (req.user.tenant_id !== req.body.tenant_id) {
    return res.status(403).json({ error: 'Cross-tenant access denied' });
  }
  
  // 4. Proceed with operation
});
```

#### **When Adding New Security Groups**
```typescript
// ✅ CHECKLIST FOR NEW GROUPS
// 1. Add to role-groups.ts
export const ROLE_GROUPS = {
  IS_NEW_ROLE: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN
  ]
} as const;

// 2. Update base class validation
private isValidTenantGroup(group: string): boolean {
  const validTenantGroups = [
    'IS_TENANT_ADMIN', 
    'IS_TENANT_OWNER', 
    'IS_TENANT_MANAGER', 
    'IS_TENANT_USER',
    'IS_NEW_ROLE' // ← Add new group here
  ];
  return validTenantGroups.includes(group);
}

// 3. Update documentation
// Add group to Allowed Groups Matrix
```

### **🚨 Security Audit Checklist**

#### **Monthly Security Review**
- [ ] Verify all admin routes use `AdminApiSingleton`
- [ ] Verify all tenant routes use `TenantApiSingleton`
- [ ] Check CORS headers include all security headers
- [ ] Validate group names match exactly between frontend/backend
- [ ] Review cross-tenant access prevention logic
- [ ] Audit logs for unauthorized access attempts

#### **Quarterly Deep Security Audit**
- [ ] Test cross-tenant leakage scenarios
- [ ] Validate token-to-tenant binding
- [ ] Review group permissions matrix
- [ ] Check for hardcoded group strings
- [ ] Verify RBAC table integrity
- [ ] Test edge cases (expired tokens, invalid groups)

### **🔍 Troubleshooting Guide**

#### **Common Issues & Solutions**

##### **Issue: 403 Forbidden on Valid Requests**
```typescript
// 🔍 DIAGNOSTIC CHECKLIST
// 1. Check if service extends proper base class
class MyService extends TenantApiSingleton { // ✅ Correct
// class MyService extends AuthenticatedApiSingleton { // ❌ Wrong base

// 2. Verify group name spelling
requestGroup: 'IS_TENANT_OWNER' // ✅ Correct
requestGroup: 'IS_TENANTOWNER' // ❌ Missing underscore

// 3. Check if group is allowed for base class
// AdminApiSingleton: IS_PLATFORM_ADMIN, IS_PLATFORM_SUPPORT
// TenantApiSingleton: IS_TENANT_ADMIN, IS_TENANT_OWNER, IS_TENANT_MANAGER, IS_TENANT_USER
```

##### **Issue: CORS Errors**
```typescript
// 🔍 DIAGNOSTIC CHECKLIST
// Check backend CORS configuration
allowedHeaders: [
  'x-admin-request',        // Required for admin operations
  'x-tenant-request',       // Required for tenant operations
  'x-request-group',        // Required for single group validation
  'x-request-groups',       // Required for multiple groups
  'x-require-all'           // Required for AND/OR logic
]
```

##### **Issue: Cross-Tenant Data Leakage**
```typescript
// 🔍 DIAGNOSTIC CHECKLIST
// 1. Verify backend tenant validation
if (req.user.tenant_id !== requestedTenantId) {
  return res.status(403).json({ error: 'Cross-tenant access denied' });
}

// 2. Check frontend uses TenantApiSingleton
class TenantService extends TenantApiSingleton { // ✅ Correct

// 3. Verify X-Tenant-Request header is required
if (!req.headers['x-tenant-request']) {
  return res.status(400).json({ error: 'Tenant context required' });
}
```

### **📈 Performance Optimization Guide**

#### **Caching Strategy**
```typescript
// ✅ OPTIMAL CACHING PATTERNS
class TenantService extends TenantApiSingleton {
  protected cacheTTL = 10 * 60 * 1000; // 10 minutes for tenant data
  
  async getCachedData() {
    return this.makeTenantRequest('/api/tenant/data', {
      requestGroup: 'IS_TENANT_USER'
    }, 'tenant-data-cache-key'); // Cache key ensures tenant isolation
  }
}
```

#### **Database Query Optimization**
```sql
-- ✅ TENANT-ISOLATED QUERIES
SELECT * FROM tenant_data 
WHERE tenant_id = :user_tenant_id 
AND user_id = :user_id;

-- ❌ AVOID: Cross-tenant queries
SELECT * FROM tenant_data; -- Dangerous!
```

### **🔄 Migration & Upgrade Guide**

#### **Legacy Service Migration**
```typescript
// ❌ LEGACY PATTERN (Before)
class OldService {
  async getData() {
    return fetch('/api/data', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
}

// ✅ SECURE PATTERN (After)
class NewService extends TenantApiSingleton {
  async getData() {
    return this.makeTenantRequest('/api/data', {
      requestGroup: 'IS_TENANT_USER'
    });
  }
}
```

#### **Version Compatibility**
- **v1.0**: Single group validation (`requestGroup`)
- **v2.0**: Multiple groups + AND/OR logic (`requestGroups`, `requireAll`)
- **v2.1**: Enhanced cross-tenant protection
- **Future**: Permission-based fine-grained access

### **📞 Support & Escalation**

#### **Security Incident Response**
1. **Immediate**: Block suspicious IP addresses
2. **Investigation**: Review audit logs for cross-tenant attempts
3. **Remediation**: Patch any discovered vulnerabilities
4. **Communication**: Notify affected tenants if required
5. **Prevention**: Update security rules and monitoring

#### **Development Support**
- **Documentation**: This file serves as primary reference
- **Code Examples**: See usage examples throughout
- **Security Team**: Escalate cross-tenant issues immediately
- **Architecture Team**: Consult for major RBAC changes

### **🎓 Training & Onboarding**

#### **New Developer Onboarding**
1. **Read** this documentation completely
2. **Study** the usage examples
3. **Practice** with the implementation checklist
4. **Review** security audit checklist
5. **Build** a test service using proper patterns

#### **Security Team Training**
1. **Understand** cross-tenant leakage prevention
2. **Review** monthly security audit procedures
3. **Learn** troubleshooting common issues
4. **Practice** incident response scenarios

---

**Last Updated**: February 2026  
**Version**: 2.1  
**Maintainers**: Architecture & Security Teams  
**Review Schedule**: Quarterly for security, monthly for functionality
