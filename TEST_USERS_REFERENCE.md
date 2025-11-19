# Test Users Reference Guide

**Status:** ✅ READY - Complete test user matrix for all roles  
**Purpose:** Comprehensive user accounts for testing role-based access control  
**Password:** All test users use `Admin123!` for consistency

## 🎯 **Test User Matrix**

### **Platform Roles (Cross-Tenant Access)**

| Role | Email | Description | Expected Access |
|------|-------|-------------|-----------------|
| **PLATFORM_ADMIN** | `admin@rvp.com` | Platform administrator | ✅ Full system access, unlimited tenants |
| **PLATFORM_SUPPORT** | `support@rvp.com` | Platform support | ✅ All tenants + support actions (3 tenant limit) |
| **PLATFORM_VIEWER** | `viewer@rvp.com` | Platform viewer | ✅ Read-only access to all tenants |

### **Tenant Roles (Single/Assigned Tenant Access)**

| Role | Email | Description | Expected Access |
|------|-------|-------------|-----------------|
| **TENANT_OWNER** | `owner@rvp.com` | Tenant owner | ✅ Full control of owned tenants (highest tenant role) |
| **TENANT_ADMIN** | `tenantadmin@rvp.com` | Tenant admin | ✅ Support access but below Tenant Owner |
| **TENANT_MANAGER** | `manager@rvp.com` | Tenant manager | ✅ Management operations |
| **TENANT_MEMBER** | `member@rvp.com` | Tenant member | ✅ Edit only, no manage |
| **TENANT_VIEWER** | `tenantviewer@rvp.com` | Tenant viewer | ✅ View only |

### **Legacy/Deprecated Roles**

| Role | Email | Description | Expected Access |
|------|-------|-------------|-----------------|
| **ADMIN** | `legacy@rvp.com` | Legacy admin | ✅ Platform admin (deprecated) |
| **USER** | `user@rvp.com` | Basic user | ✅ Basic access (limits based on tier) |

## 🧪 **Test Scenarios by Role**

### **Platform Admin Test**
```bash
./test-access.bat admin@rvp.com [tenant-id] platform-admin Admin123!
```
**Expected Results:**
- ✅ Platform Access: Yes
- ✅ Tier Bypass: Yes
- ✅ Role Bypass: Yes
- ✅ Can View/Edit/Manage/Admin: All Yes

### **Platform Support Test**
```bash
./test-access.bat support@rvp.com [tenant-id] platform-support Admin123!
```
**Expected Results:**
- ✅ Platform Access: Yes
- ✅ Tier Bypass: Yes
- ✅ Role Bypass: Yes
- ✅ Can View/Edit/Manage/Admin: All Yes
- ⚠️ Tenant Creation Limit: 3 globally

### **Platform Viewer Test**
```bash
./test-access.bat viewer@rvp.com [tenant-id] platform-viewer Admin123!
```
**Expected Results:**
- ✅ Platform Access: Yes
- ❌ Tier Bypass: No
- ❌ Role Bypass: No
- ✅ Can View: Yes
- ❌ Can Edit/Manage/Admin: No

### **Tenant Owner Test**
```bash
./test-access.bat owner@rvp.com [owned-tenant-id] tenant-owner Admin123!
```
**Expected Results:**
- ❌ Platform Access: No
- ❌ Tier Bypass: No
- ❌ Role Bypass: No
- ✅ Can View/Edit/Manage/Admin: All Yes (for owned tenants)
- ✅ Can manage settings/billing/ownership

### **Tenant Admin Test**
```bash
./test-access.bat tenantadmin@rvp.com [assigned-tenant-id] tenant-admin Admin123!
```
**Expected Results:**
- ❌ Platform Access: No
- ❌ Tier Bypass: No
- ✅ Role Bypass: Yes (support-level within assigned tenants)
- ✅ Can View/Edit/Manage: Yes
- ❌ Can Admin: No (cannot manage settings/billing/ownership)

### **Tenant Manager Test**
```bash
./test-access.bat manager@rvp.com [assigned-tenant-id] tenant-manager Admin123!
```
**Expected Results:**
- ❌ Platform Access: No
- ❌ Tier Bypass: No
- ❌ Role Bypass: No
- ✅ Can View/Edit/Manage: Yes
- ❌ Can Admin: No

### **Tenant Member Test**
```bash
./test-access.bat member@rvp.com [assigned-tenant-id] tenant-member Admin123!
```
**Expected Results:**
- ❌ Platform Access: No
- ❌ Tier Bypass: No
- ❌ Role Bypass: No
- ✅ Can View/Edit: Yes
- ❌ Can Manage/Admin: No

### **Tenant Viewer Test**
```bash
./test-access.bat tenantviewer@rvp.com [assigned-tenant-id] tenant-viewer Admin123!
```
**Expected Results:**
- ❌ Platform Access: No
- ❌ Tier Bypass: No
- ❌ Role Bypass: No
- ✅ Can View: Yes
- ❌ Can Edit/Manage/Admin: No

## 🏢 **Test Tenant IDs**

Use these tenant IDs for testing (replace with actual IDs from your system):

| Tenant Name | Tenant ID | Owner | Purpose |
|-------------|-----------|-------|---------|
| **Test Location 1** | `cmi525r4y0004g8bsbzcpuipz` | admin@rvp.com | Primary test tenant |
| **Test Location 2** | `[tenant-id-2]` | owner@rvp.com | Tenant owner tests |
| **Test Location 3** | `[tenant-id-3]` | tenantadmin@rvp.com | Tenant admin tests |
| **Demo Store** | `[tenant-id-4]` | manager@rvp.com | Manager/member tests |

## 🚀 **Quick Test Commands**

### **Critical Access Tests (5 minutes)**
```bash
# Test platform admin (highest privilege)
./test-access.bat admin@rvp.com cmi525r4y0004g8bsbzcpuipz platform-admin Admin123!

# Test tenant owner (highest tenant privilege)
./test-access.bat owner@rvp.com [owned-tenant-id] tenant-owner Admin123!

# Test tenant admin (new role)
./test-access.bat tenantadmin@rvp.com [assigned-tenant-id] tenant-admin Admin123!

# Test tenant member (restricted access)
./test-access.bat member@rvp.com [assigned-tenant-id] tenant-member Admin123!

# Test platform viewer (read-only)
./test-access.bat viewer@rvp.com cmi525r4y0004g8bsbzcpuipz platform-viewer Admin123!
```

### **Full Role Matrix Test (15 minutes)**
```bash
# Run all platform roles
./test-access.bat admin@rvp.com cmi525r4y0004g8bsbzcpuipz platform-admin Admin123!
./test-access.bat support@rvp.com cmi525r4y0004g8bsbzcpuipz platform-support Admin123!
./test-access.bat viewer@rvp.com cmi525r4y0004g8bsbzcpuipz platform-viewer Admin123!

# Run all tenant roles
./test-access.bat owner@rvp.com [tenant-id] tenant-owner Admin123!
./test-access.bat tenantadmin@rvp.com [tenant-id] tenant-admin Admin123!
./test-access.bat manager@rvp.com [tenant-id] tenant-manager Admin123!
./test-access.bat member@rvp.com [tenant-id] tenant-member Admin123!
./test-access.bat tenantviewer@rvp.com [tenant-id] tenant-viewer Admin123!
```

## 📋 **User Creation Checklist**

To create these test users in your system:

### **Required Fields:**
- ✅ **Email:** As specified in matrix above
- ✅ **Password:** `Admin123!` (consistent across all)
- ✅ **Role:** Platform or tenant role as specified
- ✅ **Name:** Descriptive (e.g., "Platform Admin User")
- ✅ **Email Verified:** True

### **Tenant Assignments:**
- **Platform users:** No specific tenant assignments needed
- **Tenant users:** Must be assigned to specific tenants with appropriate roles
- **Tenant Admin:** Assign to multiple tenants for testing scope

### **Creation Methods:**
1. **Admin Panel:** Use `/settings/admin/users` to create users
2. **API Endpoint:** `POST /api/admin/users` with role specification
3. **Database Direct:** Insert into users table with proper role values

## 🔍 **Validation Checklist**

After creating test users, verify:

- [ ] All users can authenticate with `Admin123!`
- [ ] Platform users have correct platform-wide access
- [ ] Tenant users are properly assigned to test tenants
- [ ] Role hierarchy is respected (Owner > Admin > Manager > Member > Viewer)
- [ ] TENANT_ADMIN role shows support access but below Tenant Owner
- [ ] Platform bypass permissions work correctly
- [ ] Tier restrictions apply appropriately

## 📊 **Expected Test Results Summary**

| Role | Platform Access | Tenant Access | Tier Bypass | Role Bypass | Admin Functions |
|------|----------------|---------------|-------------|-------------|-----------------|
| **PLATFORM_ADMIN** | ✅ All | ✅ All | ✅ Yes | ✅ Yes | ✅ Full |
| **PLATFORM_SUPPORT** | ✅ All | ✅ All | ✅ Yes | ✅ Yes | ✅ Support |
| **PLATFORM_VIEWER** | ✅ All | ✅ Read-only | ❌ No | ❌ No | ❌ None |
| **TENANT_OWNER** | ❌ No | ✅ Owned | ❌ No | ❌ No | ✅ Full (tenant) |
| **TENANT_ADMIN** | ❌ No | ✅ Assigned | ❌ No | ✅ Yes | ❌ Limited |
| **TENANT_MANAGER** | ❌ No | ✅ Assigned | ❌ No | ❌ No | ❌ Limited |
| **TENANT_MEMBER** | ❌ No | ✅ Assigned | ❌ No | ❌ No | ❌ None |
| **TENANT_VIEWER** | ❌ No | ✅ Read-only | ❌ No | ❌ No | ❌ None |

**This reference guide ensures comprehensive testing of the complete role-based access control system!**
