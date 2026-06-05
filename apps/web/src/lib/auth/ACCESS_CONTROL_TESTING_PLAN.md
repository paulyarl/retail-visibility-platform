# Access Control Security Testing Plan

## Overview
Comprehensive testing plan to verify the centralized access control system works correctly for all user types and prevents unauthorized access.

**Date Created**: November 6, 2025  
**Status**: Ready for Testing  
**Priority**: CRITICAL - Security Gap

---

## Testing Approach: "Wear Each User's Hat"

Test the platform from each user type's perspective to ensure they:
1. ✅ **CAN** access what they should
2. ❌ **CANNOT** access what they shouldn't
3. 🔒 See appropriate "Access Denied" messages
4. 🎯 Have correct navigation and UI elements

---

## User Types to Test

### 1. Platform Admin
**Role**: `ADMIN` (platform-level)  
**Highest Privileges**: Full system access

### 2. Organization Owner
**Role**: `OWNER` (tenant-level)  
**Context**: Owns one or more locations in a chain

### 3. Organization Admin
**Role**: `ADMIN` (tenant-level)  
**Context**: Admin of one or more locations in a chain

### 4. Organization Member
**Role**: `MEMBER` (tenant-level)  
**Context**: Regular user at a location

### 5. Non-Member User
**Role**: Any role  
**Context**: Not associated with the tenant/organization being accessed

### 6. Unauthenticated User
**Role**: None  
**Context**: Not logged in

---

## Test Scenarios by Page

### 🏠 Platform Settings (`/settings`)

#### Test: Settings Cards Visibility

**Platform Admin** ✅
- [ ] Can see ALL cards including:
  - [ ] Admin Dashboard
  - [ ] Platform Settings
  - [ ] Email Configuration
  - [ ] Feature Flags (Platform)
  - [ ] Organization Dashboard
  - [ ] Personal Settings
  - [ ] Tenant Settings (if has tenant)

**Organization Owner** ✅
- [ ] Can see:
  - [ ] Organization Dashboard (if in org)
  - [ ] Personal Settings
  - [ ] Tenant Settings (for their tenants)
- [ ] CANNOT see:
  - [ ] Admin Dashboard
  - [ ] Platform Settings
  - [ ] Email Configuration
  - [ ] Feature Flags (Platform)

**Organization Admin** ✅
- [ ] Can see:
  - [ ] Organization Dashboard (if in org)
  - [ ] Personal Settings
  - [ ] Tenant Settings (for their tenants)
- [ ] CANNOT see:
  - [ ] Admin Dashboard
  - [ ] Platform Settings
  - [ ] Email Configuration

**Organization Member** ✅
- [ ] Can see:
  - [ ] Personal Settings
  - [ ] Tenant Settings (view only for their tenant)
- [ ] CANNOT see:
  - [ ] Admin Dashboard
  - [ ] Platform Settings
  - [ ] Organization Dashboard

**Non-Member** ❌
- [ ] Can see:
  - [ ] Personal Settings only
- [ ] CANNOT see any tenant/org specific cards

---

### 👑 Organization Dashboard (`/settings/organization?organizationId=XXX`)

#### Test: Page Access

**Platform Admin** ✅
- [ ] Can access ANY organization dashboard
- [ ] Sees all locations in the organization
- [ ] Can set hero location
- [ ] Can trigger bulk sync
- [ ] Override works (bypasses org membership check)

**Organization Owner** ✅
- [ ] Can access THEIR organization dashboard
- [ ] Sees all locations in their organization
- [ ] Can set hero location
- [ ] Can trigger bulk sync
- [ ] CANNOT access other organizations

**Organization Admin** ✅
- [ ] Can access THEIR organization dashboard
- [ ] Sees all locations in their organization
- [ ] Can set hero location
- [ ] Can trigger bulk sync
- [ ] CANNOT access other organizations

**Organization Member** ✅
- [ ] Can access THEIR organization dashboard (view only)
- [ ] Sees all locations in their organization
- [ ] CANNOT set hero location
- [ ] CANNOT trigger bulk sync
- [ ] CANNOT access other organizations

**Non-Member** ❌
- [ ] CANNOT access organization dashboard
- [ ] Sees "Access Restricted" message
- [ ] Message: "Only available to organization members"
- [ ] Back link to /settings works

**Unauthenticated** ❌
- [ ] Redirected to login
- [ ] After login, proper access control applies

---

### 🏢 Tenant Settings (`/t/[tenantId]/settings/tenant`)

#### Test: Page Access

**Platform Admin** ✅
- [ ] Can access ANY tenant settings
- [ ] Can modify business profile
- [ ] Can update settings
- [ ] Override works

**Tenant Owner** ✅
- [ ] Can access THEIR tenant settings
- [ ] Can modify business profile
- [ ] Can update settings
- [ ] CANNOT access other tenants

**Tenant Admin** ✅
- [ ] Can access THEIR tenant settings
- [ ] Can modify business profile
- [ ] Can update settings
- [ ] CANNOT access other tenants

**Tenant Member** ❌
- [ ] CANNOT access tenant settings
- [ ] Sees "Admin Access Required" message
- [ ] Message: "You need tenant administrator privileges"
- [ ] Back link to /t/[tenantId]/settings works

**Non-Member** ❌
- [ ] CANNOT access tenant settings
- [ ] Sees "Access Denied" message
- [ ] Redirected appropriately

---

### 👥 Team Members (`/t/[tenantId]/settings/users`)

#### Test: Page Access

**Platform Admin** ✅
- [ ] Can access ANY tenant's team page
- [ ] Can view all members
- [ ] Can modify roles
- [ ] Can add/remove members

**Tenant Owner** ✅
- [ ] Can access THEIR tenant's team page
- [ ] Can view all members
- [ ] Can modify roles
- [ ] Can add/remove members

**Tenant Admin** ✅
- [ ] Can access THEIR tenant's team page
- [ ] Can view all members
- [ ] Can modify roles (limited)
- [ ] Can add/remove members (limited)

**Tenant Member** ❌
- [ ] CANNOT access team management
- [ ] Sees "Admin Access Required"

**Non-Member** ❌
- [ ] CANNOT access team page
- [ ] Sees "Access Denied"

---

### 🚩 Feature Flags (Tenant) (`/t/[tenantId]/settings/admin/flags`)

#### Test: Page Access

**Platform Admin** ✅
- [ ] Can access ANY tenant's feature flags
- [ ] Can toggle all flags
- [ ] Can see all flag states

**Tenant Owner** ✅
- [ ] Can access THEIR tenant's feature flags
- [ ] Can toggle flags
- [ ] Can see flag states

**Tenant Admin** ✅
- [ ] Can access THEIR tenant's feature flags
- [ ] Can toggle flags
- [ ] Can see flag states

**Tenant Member** ❌
- [ ] CANNOT access feature flags
- [ ] Sees "Admin Access Required"

**Non-Member** ❌
- [ ] CANNOT access feature flags
- [ ] Sees "Access Denied"

---

### 🔧 Admin Dashboard (`/settings/admin`)

#### Test: Page Access

**Platform Admin** ✅
- [ ] Can access admin dashboard
- [ ] Sees all admin tools
- [ ] Can access all admin functions

**Any Other User** ❌
- [ ] CANNOT access admin dashboard
- [ ] Sees "Platform Admin Only" message
- [ ] Message: "This page is restricted to platform administrators"
- [ ] Back link to /settings works

---

### 📧 Email Configuration (`/settings/admin/email`)

#### Test: Page Access

**Platform Admin** ✅
- [ ] Can access email config
- [ ] Can modify settings
- [ ] Can test email

**Any Other User** ❌
- [ ] CANNOT access email config
- [ ] Sees "Platform Admin Only" message

---

## Security Test Cases

### 🔒 Critical Security Tests

#### Test 1: Direct URL Access
**Scenario**: User tries to access pages directly via URL  
**Expected**: Access control blocks unauthorized access

- [ ] Non-admin tries `/settings/admin` → Denied
- [ ] Non-member tries `/t/other-tenant/settings/tenant` → Denied
- [ ] Member tries `/t/their-tenant/settings/users` → Denied (if not admin)
- [ ] Non-org-member tries `/settings/organization?organizationId=other` → Denied

#### Test 2: API Endpoint Protection
**Scenario**: User tries to call API endpoints directly  
**Expected**: Backend validates permissions

- [ ] Non-admin tries to update platform settings → 403
- [ ] Non-member tries to update tenant settings → 403
- [ ] Member tries to modify team → 403

#### Test 3: Platform Admin Override
**Scenario**: Platform admin accesses any resource  
**Expected**: Override works, full access granted

- [ ] Platform admin can access any tenant settings
- [ ] Platform admin can access any organization dashboard
- [ ] Platform admin can modify any resource
- [ ] Override is logged (if logging implemented)

#### Test 4: Cross-Tenant Access
**Scenario**: User from Tenant A tries to access Tenant B  
**Expected**: Access denied

- [ ] Tenant A admin tries `/t/tenant-b/settings/tenant` → Denied
- [ ] Tenant A owner tries to modify Tenant B data → Denied
- [ ] Tenant A member tries to view Tenant B items → Denied

#### Test 5: Role Escalation
**Scenario**: User tries to escalate their own role  
**Expected**: Cannot escalate privileges

- [ ] Member tries to make themselves admin → Denied
- [ ] Admin tries to make themselves platform admin → Denied
- [ ] User tries to modify their own role via API → Denied

#### Test 6: Session Expiry
**Scenario**: User's session expires  
**Expected**: Redirected to login, access denied

- [ ] Expired session on protected page → Redirect to login
- [ ] After re-login, proper access control applies
- [ ] No cached access to unauthorized pages

---

## Testing Tools & Setup

### Test Accounts Needed

Create test accounts for each user type:

```
Platform Admin:
- Email: admin@test.com
- Role: ADMIN (platform)

Organization Owner (Chain A):
- Email: owner-chain-a@test.com
- Role: OWNER
- Tenant: Location 1, Location 2

Organization Admin (Chain A):
- Email: admin-chain-a@test.com
- Role: ADMIN
- Tenant: Location 1

Organization Member (Chain A):
- Email: member-chain-a@test.com
- Role: MEMBER
- Tenant: Location 1

Organization Owner (Chain B):
- Email: owner-chain-b@test.com
- Role: OWNER
- Tenant: Location 3

Non-Member User:
- Email: nomember@test.com
- Role: MEMBER
- Tenant: None
```

### Testing Checklist

**For Each User Type:**
1. [ ] Log in as the user
2. [ ] Navigate to `/settings`
3. [ ] Verify visible cards match expectations
4. [ ] Try to access each protected page
5. [ ] Verify appropriate access/denial
6. [ ] Check "Access Denied" messages are clear
7. [ ] Verify back links work
8. [ ] Try direct URL access to unauthorized pages
9. [ ] Log out and verify session cleared

---

## Expected Results Summary

### ✅ What Should Work

| User Type | Platform Settings | Org Dashboard | Tenant Settings | Team Management | Feature Flags | Admin Dashboard |
|-----------|------------------|---------------|-----------------|-----------------|---------------|-----------------|
| Platform Admin | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ Yes |
| Org Owner | ✅ Personal | ✅ Their Org | ✅ Their Tenants | ✅ Their Tenants | ✅ Their Tenants | ❌ No |
| Org Admin | ✅ Personal | ✅ Their Org | ✅ Their Tenants | ✅ Their Tenants | ✅ Their Tenants | ❌ No |
| Org Member | ✅ Personal | ✅ Their Org (view) | ❌ No | ❌ No | ❌ No | ❌ No |
| Non-Member | ✅ Personal | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

---

## Known Security Improvements

### ✅ Implemented
1. Centralized `useAccessControl` hook
2. `AccessPresets` for common patterns
3. Platform admin override
4. Organization membership checks
5. Tenant role-based access
6. `ProtectedCard` for UI elements
7. `AccessDenied` component with clear messaging
8. Consistent access control across all pages

### 🔄 Future Enhancements
1. Audit logging for admin actions
2. Rate limiting on sensitive endpoints
3. Two-factor authentication for admins
4. Session timeout warnings
5. IP-based access restrictions (optional)
6. Role change notifications
7. Access attempt logging

---

## Testing Timeline

**Phase 1: Critical Paths** (Day 1)
- [ ] Platform Admin access
- [ ] Organization Owner access
- [ ] Non-member denial
- [ ] Direct URL access attempts

**Phase 2: Edge Cases** (Day 2)
- [ ] Cross-tenant access attempts
- [ ] Role escalation attempts
- [ ] Session expiry handling
- [ ] API endpoint protection

**Phase 3: User Experience** (Day 3)
- [ ] Error messages clarity
- [ ] Navigation flow
- [ ] Back links functionality
- [ ] Loading states

---

## Bug Reporting Template

```markdown
## Security Issue

**Severity**: Critical / High / Medium / Low
**User Type**: [Platform Admin / Org Owner / etc.]
**Page**: [URL]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Steps to Reproduce**:
1. Log in as [user type]
2. Navigate to [page]
3. [Action taken]
4. [Result observed]

**Security Impact**: [Describe potential security risk]
**Screenshots**: [If applicable]
```

---

## Success Criteria

### ✅ Testing Complete When:
1. All user types tested for all pages
2. All security test cases pass
3. No unauthorized access possible
4. Clear error messages for all denials
5. Platform admin override works correctly
6. No role escalation vulnerabilities
7. Session handling secure
8. API endpoints protected

### 🎯 Security Goals Met:
- **Zero unauthorized access**: No user can access resources they shouldn't
- **Clear feedback**: Users understand why access is denied
- **Consistent behavior**: Access control works the same everywhere
- **Platform admin power**: Admins can access everything when needed
- **Audit trail**: (Future) All access attempts logged

---

## Notes

- **Centralized System**: All access control uses `useAccessControl` hook
- **Single Source of Truth**: Access logic in `access-control.ts`
- **Fix Once, Apply Everywhere**: Bug fixes propagate automatically
- **Platform Integrity**: Consistent security across all pages
- **User Experience**: Clear messaging, helpful back links

---

## Contact

**Security Questions**: Contact platform admin team  
**Bug Reports**: Use template above  
**Feature Requests**: Security enhancements welcome
