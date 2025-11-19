# Comprehensive Test Execution Plan - All Roles & Scopes

**Priority:** 🔥 CRITICAL - Missing access is a business-critical issue  
**Scope:** All platform and tenant roles with complete access validation  
**Timeline:** Execute before Phase 2 deployment

## 🎯 **Critical Access Matrix**

### **Platform Roles (Cross-Tenant Access)**
| Role | Scope | Tier Bypass | Role Bypass | Expected Access |
|------|-------|-------------|-------------|-----------------|
| **PLATFORM_ADMIN** | All tenants | ✅ Yes | ✅ Yes | **FULL ACCESS** to everything |
| **PLATFORM_SUPPORT** | All tenants (limited) | ✅ Yes | ✅ Yes | **SUPPORT ACCESS** with restrictions |
| **PLATFORM_VIEWER** | All tenants | ❌ No | ❌ No | **READ-ONLY** across platform |

### **Tenant Roles (Single-Tenant Access)**
| Role | Scope | Tier Bypass | Role Bypass | Expected Access |
|------|-------|-------------|-------------|-----------------|
| **TENANT_OWNER** | Owned tenants only | ❌ No | ❌ No | **FULL CONTROL** of owned tenants (highest tenant role) |
| **TENANT_ADMIN** | Assigned tenants | ❌ No | ✅ Yes | **SUPPORT ACCESS** but below Tenant Owner |
| **TENANT_MANAGER** | Assigned tenants | ❌ No | ❌ No | **MANAGE** operations |
| **TENANT_MEMBER** | Assigned tenants | ❌ No | ❌ No | **EDIT** only |
| **TENANT_VIEWER** | Assigned tenants | ❌ No | ❌ No | **VIEW** only |

---

## 🧪 **Test Execution Steps**

### **Step 1: Setup Test Environment**

#### **1.1 Create Enhanced Test Page**
```bash
# Create test directory
mkdir -p apps\web\src\app\test\comprehensive-access

# Create the test page file
```

Create: `apps\web\src\app\test\comprehensive-access\page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { TenantAccessTest } from '@/components/test/TenantAccessTest';

const TEST_SCENARIOS = [
  { id: 'platform-admin', name: 'Platform Admin', description: 'Should have full access to all tenants' },
  { id: 'platform-support', name: 'Platform Support', description: 'Should bypass restrictions but have limits' },
  { id: 'platform-viewer', name: 'Platform Viewer', description: 'Should have read-only access across platform' },
  { id: 'tenant-owner', name: 'Tenant Owner', description: 'Should have full control of owned tenants only' },
  { id: 'tenant-admin', name: 'Tenant Admin', description: 'Should have support access but below Tenant Owner (cannot manage settings/billing)' },
  { id: 'tenant-manager', name: 'Tenant Manager', description: 'Should manage operations' },
  { id: 'tenant-member', name: 'Tenant Member', description: 'Should edit but not manage' },
  { id: 'tenant-viewer', name: 'Tenant Viewer', description: 'Should view only' },
];

export default function ComprehensiveAccessTestPage() {
  const [tenantId, setTenantId] = useState('');
  const [currentScenario, setCurrentScenario] = useState('');

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          🔐 Comprehensive Access Test Suite
        </h1>
        <p className="text-gray-600 text-lg">
          Test all platform and tenant roles with complete scope validation
        </p>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">
            ⚠️ CRITICAL: Missing access is a business-critical issue. Test all scenarios thoroughly.
          </p>
        </div>
      </div>

      {/* Test Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Test Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Tenant ID to Test:
              </label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="e.g., tenant-123"
                className="w-full border border-blue-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Current Test Scenario:
              </label>
              <select
                value={currentScenario}
                onChange={(e) => setCurrentScenario(e.target.value)}
                className="w-full border border-blue-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select scenario to test...</option>
                {TEST_SCENARIOS.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 bg-amber-50 rounded-lg">
          <h3 className="text-lg font-semibold text-amber-900 mb-4">Test Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-amber-800 text-sm">
            <li>Login with the user role you want to test</li>
            <li>Enter a valid tenant ID</li>
            <li>Select the matching test scenario</li>
            <li>Review the access results below</li>
            <li>Verify against expected behavior</li>
            <li>Report any access issues immediately</li>
          </ol>
        </div>
      </div>

      {/* Test Scenarios Grid */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Test Scenarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEST_SCENARIOS.map(scenario => (
            <div
              key={scenario.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                currentScenario === scenario.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setCurrentScenario(scenario.id)}
            >
              <h4 className="font-medium text-gray-900 mb-2">{scenario.name}</h4>
              <p className="text-sm text-gray-600">{scenario.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results */}
      {tenantId && currentScenario && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Testing: {TEST_SCENARIOS.find(s => s.id === currentScenario)?.name}
            </h3>
            <p className="text-gray-600">
              {TEST_SCENARIOS.find(s => s.id === currentScenario)?.description}
            </p>
          </div>
          
          <TenantAccessTest tenantId={tenantId} />
        </div>
      )}

      {(!tenantId || !currentScenario) && (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
          Configure tenant ID and test scenario above to start testing
        </div>
      )}
    </div>
  );
}
```

### **Step 2: Role-Specific Test Execution**

#### **2.1 Platform Admin Test (CRITICAL)**
```
🎯 Goal: Verify full platform access
👤 Login: Platform admin account
🏢 Test Tenant: Any tenant ID
✅ Expected: All features ✅, all bypasses ✅
```

**Test Checklist:**
- [ ] Platform Role shows: `PLATFORM_ADMIN`
- [ ] Platform Access: ✅ Yes
- [ ] Tier Bypass: ✅ Yes  
- [ ] Role Bypass: ✅ Yes
- [ ] Can View: ✅, Can Edit: ✅, Can Manage: ✅, Can Admin: ✅
- [ ] All features show ✅ (barcode scan, quick start, propagation)
- [ ] No tier restrictions applied
- [ ] No role restrictions applied

#### **2.2 Platform Support Test (CRITICAL)**
```
🎯 Goal: Verify support access with limits
👤 Login: Platform support account  
🏢 Test Tenant: Any tenant ID
✅ Expected: Bypass restrictions but limited scope
```

**Test Checklist:**
- [ ] Platform Role shows: `PLATFORM_SUPPORT`
- [ ] Platform Access: ✅ Yes
- [ ] Tier Bypass: ✅ Yes
- [ ] Role Bypass: ✅ Yes
- [ ] Can access any tenant (not just owned)
- [ ] All features show ✅ (support can access everything)
- [ ] Limited to 3 tenant creation (test separately)

#### **2.3 Platform Viewer Test (CRITICAL)**
```
🎯 Goal: Verify read-only platform access
👤 Login: Platform viewer account
🏢 Test Tenant: Any tenant ID  
✅ Expected: Read-only across all tenants
```

**Test Checklist:**
- [ ] Platform Role shows: `PLATFORM_VIEWER`
- [ ] Platform Access: ✅ Yes
- [ ] Tier Bypass: ❌ No
- [ ] Role Bypass: ❌ No
- [ ] Can View: ✅, Can Edit: ❌, Can Manage: ❌, Can Admin: ❌
- [ ] Tenant Role shows: `VIEWER` (effective role)
- [ ] Can access any tenant for viewing
- [ ] Cannot edit or manage anything

#### **2.4 Tenant Owner Test (CRITICAL)**
```
🎯 Goal: Verify full tenant control
👤 Login: Tenant owner account
🏢 Test Tenant: Owned tenant ID only
✅ Expected: Full control of owned tenants
```

**Test Checklist:**
- [ ] Platform Role shows: `None` or empty
- [ ] Platform Access: ❌ No
- [ ] Tenant Role shows: `OWNER`
- [ ] Tenant Access: ✅ Yes
- [ ] Tier Bypass: ❌ No (subject to subscription)
- [ ] Role Bypass: ❌ No
- [ ] Can View: ✅, Can Edit: ✅, Can Manage: ✅, Can Admin: ✅
- [ ] Features based on subscription tier
- [ ] Cannot access non-owned tenants

#### **2.5 Tenant Admin Test**
```
🎯 Goal: Verify support access below Tenant Owner
👤 Login: Tenant admin account
🏢 Test Tenant: Assigned tenant ID
✅ Expected: Support operations but cannot manage settings/billing/ownership
```

**Test Checklist:**
- [ ] Tenant Role shows: `TENANT_ADMIN`
- [ ] Can View: ✅, Can Edit: ✅, Can Manage: ✅, Can Admin: ❌ (below Tenant Owner)
- [ ] Role Bypass: ✅ Yes (support-level access within assigned tenants)
- [ ] Features based on subscription tier
- [ ] Cannot access tenant settings/billing/ownership (Tenant Owner only)
- [ ] Cannot create/delete tenants

#### **2.6 Tenant Manager Test**
```
🎯 Goal: Verify management operations
👤 Login: Tenant manager account
🏢 Test Tenant: Assigned tenant ID
✅ Expected: Can manage operations
```

**Test Checklist:**
- [ ] Tenant Role shows: `MANAGER`
- [ ] Can View: ✅, Can Edit: ✅, Can Manage: ✅, Can Admin: ❌
- [ ] Can access bulk operations, quick start, propagation
- [ ] Cannot access user management (test separately)

#### **2.7 Tenant Member Test**
```
🎯 Goal: Verify edit-only access
👤 Login: Tenant member account
🏢 Test Tenant: Assigned tenant ID
✅ Expected: Edit but not manage
```

**Test Checklist:**
- [ ] Tenant Role shows: `MEMBER`
- [ ] Can View: ✅, Can Edit: ✅, Can Manage: ❌, Can Admin: ❌
- [ ] Can edit individual items
- [ ] Cannot access bulk operations, quick start, propagation
- [ ] Cannot access management features

#### **2.8 Tenant Viewer Test**
```
🎯 Goal: Verify read-only tenant access
👤 Login: Tenant viewer account
🏢 Test Tenant: Assigned tenant ID
✅ Expected: View only
```

**Test Checklist:**
- [ ] Tenant Role shows: `VIEWER`
- [ ] Can View: ✅, Can Edit: ❌, Can Manage: ❌, Can Admin: ❌
- [ ] Cannot edit anything
- [ ] Cannot access any management features
- [ ] Read-only access to all data

### **Step 3: Cross-Scope Access Tests**

#### **3.1 Platform User → Tenant Access**
```
Test: Platform users accessing tenant-scoped features
Expected: Platform users should access any tenant
```

**Test Matrix:**
| Platform Role | Tenant Access | Expected Result |
|---------------|---------------|-----------------|
| PLATFORM_ADMIN | Any tenant | ✅ Full access |
| PLATFORM_SUPPORT | Any tenant | ✅ Support access |
| PLATFORM_VIEWER | Any tenant | ✅ Read-only |

#### **3.2 Tenant User → Platform Access**
```
Test: Tenant users accessing platform-scoped features  
Expected: Tenant users should NOT access platform features
```

**Test Matrix:**
| Tenant Role | Platform Access | Expected Result |
|--------------|-----------------|-----------------|
| TENANT_OWNER | Platform features | ❌ No access |
| TENANT_ADMIN | Platform features | ❌ No access |
| TENANT_MEMBER | Platform features | ❌ No access |

#### **3.3 Cross-Tenant Access**
```
Test: Tenant users accessing other tenants
Expected: Should only access assigned tenants
```

**Test Steps:**
1. Login as tenant user (OWNER/ADMIN/MEMBER)
2. Test with owned/assigned tenant ID → ✅ Should work
3. Test with different tenant ID → ❌ Should fail
4. Verify error handling is graceful

### **Step 4: Feature-Specific Access Tests**

#### **4.1 Tier-Gated Features**
Test each feature against role + tier combination:

```typescript
const CRITICAL_FEATURES = [
  { id: 'barcode_scan', tier: 'professional', permission: 'canEdit' },
  { id: 'quick_start_wizard', tier: 'professional', permission: 'canManage' },
  { id: 'propagation_products', tier: 'organization', permission: 'canManage' },
  { id: 'storefront', tier: 'starter', permission: 'canView' },
];
```

**Test Matrix:**
| Role | Tier | Feature | Expected |
|------|------|---------|----------|
| PLATFORM_ADMIN | Any | Any | ✅ Always |
| TENANT_MEMBER | Professional | barcode_scan + canEdit | ✅ Yes |
| TENANT_MEMBER | Professional | quick_start + canManage | ❌ No (role) |
| TENANT_MANAGER | Starter | barcode_scan + canEdit | ❌ No (tier) |

#### **4.2 Role-Gated Actions**
Test permission types against roles:

```typescript
const PERMISSION_TESTS = [
  { permission: 'canView', roles: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] },
  { permission: 'canEdit', roles: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] },
  { permission: 'canManage', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { permission: 'canAdmin', roles: ['OWNER', 'ADMIN'] },
];
```

### **Step 5: Error Handling & Edge Cases**

#### **5.1 Invalid Access Scenarios**
- [ ] Invalid tenant ID → Clear error message
- [ ] No tenant access → Graceful handling
- [ ] Network errors → Proper fallback
- [ ] Missing permissions → Context-aware error

#### **5.2 Boundary Conditions**
- [ ] User with no roles → Handled gracefully
- [ ] Tenant with no tier → Default behavior
- [ ] Mixed platform/tenant roles → Proper precedence
- [ ] Role changes during session → Updates correctly

### **Step 6: Performance & Reliability**

#### **6.1 Performance Benchmarks**
- [ ] Initial load < 3 seconds
- [ ] Role detection < 1 second
- [ ] Feature checks < 100ms
- [ ] No excessive API calls

#### **6.2 Reliability Tests**
- [ ] Consistent results across refreshes
- [ ] Proper caching behavior
- [ ] Background refresh works
- [ ] Error recovery functions

---

## 🚨 **Critical Failure Scenarios**

### **Immediate Escalation Required:**
1. **Platform admin cannot access tenant** → Business critical
2. **Tenant owner cannot manage owned tenant** → Business critical  
3. **Platform viewer can edit/manage** → Security critical
4. **Tenant member can access admin features** → Security critical
5. **Cross-tenant access allowed** → Security critical

### **Validation Commands:**
```bash
# Check for console errors
# Open browser dev tools → Console tab
# Look for: TypeScript errors, API failures, permission errors

# Check network calls
# Open browser dev tools → Network tab  
# Verify: Proper API calls, no excessive requests, correct responses

# Check performance
# Open browser dev tools → Performance tab
# Measure: Load times, render performance, memory usage
```

---

## 📊 **Test Results Template**

### **Test Execution Log:**
```
Date: ___________
Tester: ___________
Environment: ___________

Platform Admin Test:
[ ] Full access verified
[ ] All bypasses working
[ ] No restrictions applied
Issues: ___________

Platform Support Test:
[ ] Support access verified  
[ ] Bypasses working
[ ] Scope limitations respected
Issues: ___________

Platform Viewer Test:
[ ] Read-only access verified
[ ] No edit/manage access
[ ] Cross-tenant viewing works
Issues: ___________

[Continue for all roles...]

Critical Issues Found:
1. ___________
2. ___________
3. ___________

Performance Results:
- Load time: _____ seconds
- API calls: _____ count
- Errors: _____ count

Overall Status: PASS / FAIL
Deployment Ready: YES / NO
```

---

## 🎯 **Success Criteria**

### **Must Pass (Deployment Blockers):**
- ✅ Platform admin has full access to all tenants
- ✅ Platform support can access all tenants with restrictions
- ✅ Platform viewer is read-only across platform
- ✅ Tenant users only access assigned tenants
- ✅ Role permissions work correctly (view/edit/manage/admin)
- ✅ Tier restrictions apply properly
- ✅ No security bypasses for unauthorized users
- ✅ Performance meets targets (<3s load, <100ms checks)

### **Should Pass (Quality Gates):**
- ✅ Error handling is graceful and informative
- ✅ UI feedback is clear and immediate
- ✅ Cross-scope access is properly blocked
- ✅ Feature badges show correct upgrade paths
- ✅ Background refresh works reliably

**Only deploy Phase 2 after ALL critical tests pass!** 🚀
