# Staging Test Users

**Purpose:** Pre-configured test users for comprehensive user journey testing  
**Environment:** Staging branch  
**Password Policy:** All test users use the same password for convenience: `TestPass123!`

---

## 🔐 Test User Accounts

| Email Address | Password | Full Name | User Role | Scope |
|--------------|----------|-----------|-----------|-------|
| alice.platformadmin@testing.app | TestPass123! | Alice PlatformAdmin | PLATFORM_ADMIN | Platform-wide |
| bob.platformadmin@testing.app | TestPass123! | Bob PlatformAdmin | PLATFORM_ADMIN | Platform-wide |
| carol.owner@testing.app | TestPass123! | Carol Owner | OWNER | Own tenants |
| david.owner@testing.app | TestPass123! | David Owner | OWNER | Own tenants |
| emma.owner@testing.app | TestPass123! | Emma Owner | OWNER | Own tenants |
| frank.tenantadmin@testing.app | TestPass123! | Frank TenantAdmin | ADMIN | Assigned tenants |
| grace.tenantadmin@testing.app | TestPass123! | Grace TenantAdmin | ADMIN | Assigned tenants |
| henry.member@testing.app | TestPass123! | Henry Member | MEMBER | Assigned tenants |
| iris.member@testing.app | TestPass123! | Iris Member | MEMBER | Assigned tenants |
| jack.viewer@testing.app | TestPass123! | Jack Viewer | VIEWER | Assigned tenants |
| kate.viewer@testing.app | TestPass123! | Kate Viewer | VIEWER | Assigned tenants |
| leo.owner@testing.app | TestPass123! | Leo Owner | OWNER | Own tenants |
| maya.tenantadmin@testing.app | TestPass123! | Maya TenantAdmin | ADMIN | Assigned tenants |
| noah.member@testing.app | TestPass123! | Noah Member | MEMBER | Assigned tenants |
| olivia.viewer@testing.app | TestPass123! | Olivia Viewer | VIEWER | Assigned tenants |

---

## 🎭 Role Clarification

### Explicit Role Definitions

The platform uses **explicit role names** to avoid ambiguity:

#### 1. PLATFORM_ADMIN (Global Scope)
**Users:** Alice PlatformAdmin, Bob PlatformAdmin  
**Database:** `User.role = 'PLATFORM_ADMIN'`  
**Access:**
- ✅ Platform-wide access to ALL tenants
- ✅ Access to `/settings/admin`
- ✅ Can manage all users
- ✅ Can manage feature flags
- ✅ Can create organizations
- ✅ Can view system metrics
- ✅ No tenant assignments needed

**How to identify in code:**
```typescript
// Platform Admin = explicit PLATFORM_ADMIN role
const isPlatformAdmin = user.role === 'PLATFORM_ADMIN';
```

#### 2. ADMIN (Tenant Scope)
**Users:** Frank TenantAdmin, Grace TenantAdmin, Maya TenantAdmin  
**Database:** `User.role = 'ADMIN'` + Assigned to specific tenants via `UserTenant`  
**Access:**
- ✅ Admin access to ASSIGNED tenants only
- ✅ Can manage inventory for assigned tenants
- ✅ Can edit tenant settings for assigned tenants
- ✅ Can manage users for assigned tenants (if permission granted)
- ❌ Cannot access unassigned tenants
- ❌ Cannot access `/settings/admin`
- ❌ Cannot manage feature flags

**How to identify in code:**
```typescript
// Tenant Admin = ADMIN role (scoped to assigned tenants)
const isTenantAdmin = user.role === 'ADMIN';
```

#### 3. Other Roles
- **OWNER** - Owns one or more tenants
- **MEMBER** - Read/write access to assigned tenants
- **VIEWER** - Read-only access to assigned tenants

---

## 👥 User Assignment Strategy

### Platform Admin Testing
**Users:** alice.platformadmin@testing.app, bob.platformadmin@testing.app
- Role: `PLATFORM_ADMIN`
- Tenant Assignments: None (not needed - platform-wide access)
- Test platform-wide admin features
- Access to `/settings/admin`
- Can manage all tenants and users
- Can manage feature flags

---

### Organization Owner Testing
**Users:** carol.owner@testing.app, david.owner@testing.app
- Role: `OWNER`
- Tenant Assignments: Own tenants in organization
- Test chain/organization features
- Own multiple tenants in organization
- Can propagate settings across locations
- Can manage organization settings

---

### Independent Tenant Owner Testing
**Users:** emma.owner@testing.app, leo.owner@testing.app
- Role: `OWNER`
- Tenant Assignments: Own independent tenants
- Test single-tenant scenarios
- Own 1-3 independent tenants (no organization)
- Full control over owned tenants
- Cannot access other users' tenants

---

### Tenant Admin Testing
**Users:** frank.tenantadmin@testing.app, grace.tenantadmin@testing.app, maya.tenantadmin@testing.app
- Role: `ADMIN`
- Tenant Assignments: Assigned to specific tenants via `UserTenant`
- Test tenant-scoped admin permissions
- Assigned to specific tenants (not owners)
- Can manage inventory and settings for assigned tenants
- Cannot delete tenants
- Cannot access unassigned tenants
- Cannot access platform admin features

---

### Tenant Member Testing
**Users:** Henry Member, Iris Member, Noah Member
- Test read/write permissions
- Can add/edit items
- Can upload photos
- Cannot edit tenant settings
- Cannot manage users

---

### Tenant Viewer Testing
**Users:** Jack Viewer, Kate Viewer, Olivia Viewer
- Test read-only permissions
- Can view tenant details
- Can view inventory
- Cannot create/edit/delete
- All edit buttons should be hidden/disabled

---

## 🏢 Suggested Tenant Assignments

### Scenario 1: Platform Admin
```
User: alice.admin@testing.app
Tenants: Access to ALL tenants
Organization: N/A (platform-wide access)
```

### Scenario 2: Organization Owner (Chain)
```
User: carol.owner@testing.app
Organization: "Carol's Coffee Chain"
Tenants:
  - Carol's Coffee - Downtown (tenant-001)
  - Carol's Coffee - Uptown (tenant-002)
  - Carol's Coffee - Westside (tenant-003)
```

### Scenario 3: Independent Tenant Owner
```
User: emma.owner@testing.app
Organization: None
Tenants:
  - Emma's Boutique (tenant-004)
```

### Scenario 4: Tenant Admin (Assigned)
```
User: frank.admin@testing.app
Organization: None
Assigned Tenants:
  - Carol's Coffee - Downtown (tenant-001)
  - Emma's Boutique (tenant-004)
Role: ADMIN (for these tenants only)
```

### Scenario 5: Tenant Member (Assigned)
```
User: henry.member@testing.app
Organization: None
Assigned Tenants:
  - Carol's Coffee - Uptown (tenant-002)
Role: MEMBER (read/write, no settings)
```

### Scenario 6: Tenant Viewer (Assigned)
```
User: jack.viewer@testing.app
Organization: None
Assigned Tenants:
  - Carol's Coffee - Westside (tenant-003)
Role: VIEWER (read-only)
```

---

## 🧪 Testing Scenarios by User

### Test 1: Platform Admin (Alice)
- [ ] Login as alice.platformadmin@testing.app
- [ ] Verify role is `PLATFORM_ADMIN` (not `ADMIN`)
- [ ] Verify access to `/settings/admin`
- [ ] Verify can see ALL tenants (not just assigned)
- [ ] Verify can manage feature flags
- [ ] Verify can create organizations
- [ ] Verify can manage all users
- [ ] Verify can access any tenant's data
- [ ] Verify can perform actions on any tenant

### Test 2: Organization Owner (Carol)
- [ ] Login as carol.owner@testing.app
- [ ] Verify sees only organization tenants
- [ ] Verify can create new location in organization
- [ ] Verify can propagate settings to all locations
- [ ] Verify cannot access Emma's Boutique

### Test 3: Independent Owner (Emma)
- [ ] Login as emma.owner@testing.app
- [ ] Verify sees only owned tenant
- [ ] Verify can create new independent tenant
- [ ] Verify cannot see Carol's tenants
- [ ] Verify cannot access admin features

### Test 4: Tenant Admin (Frank)
- [ ] Login as frank.tenantadmin@testing.app
- [ ] Verify role is `ADMIN`
- [ ] Verify HAS tenant assignments in `UserTenant` table (tenant-001, tenant-004)
- [ ] Verify sees ONLY assigned tenants (tenant-001, tenant-004)
- [ ] Verify can edit tenant settings for assigned tenants
- [ ] Verify can manage inventory for assigned tenants
- [ ] Verify cannot delete tenants
- [ ] Verify cannot see tenant-002 or tenant-003
- [ ] Verify CANNOT access `/settings/admin`
- [ ] Verify CANNOT manage feature flags

### Test 5: Tenant Member (Henry)
- [ ] Login as henry.member@testing.app
- [ ] Verify sees only tenant-002
- [ ] Verify can add/edit items
- [ ] Verify can upload photos
- [ ] Verify cannot edit tenant settings
- [ ] Verify cannot manage users

### Test 6: Tenant Viewer (Jack)
- [ ] Login as jack.viewer@testing.app
- [ ] Verify sees only tenant-003
- [ ] Verify can view items
- [ ] Verify cannot create/edit/delete items
- [ ] Verify all edit buttons hidden/disabled
- [ ] Verify cannot access settings

---

## 🔄 User-Tenant Relationship Matrix

| User | User Role | Scope | Tenant 001 | Tenant 002 | Tenant 003 | Tenant 004 | Other Tenants |
|------|-----------|-------|------------|------------|------------|------------|---------------|
| Alice PlatformAdmin | PLATFORM_ADMIN | Platform | ✅ All Access | ✅ All Access | ✅ All Access | ✅ All Access | ✅ All Access |
| Bob PlatformAdmin | PLATFORM_ADMIN | Platform | ✅ All Access | ✅ All Access | ✅ All Access | ✅ All Access | ✅ All Access |
| Carol Owner | OWNER | Org Tenants | ✅ Owner | ✅ Owner | ✅ Owner | ❌ No Access | ❌ No Access |
| David Owner | OWNER | Own Tenants | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access | ✅ Own Tenants |
| Emma Owner | OWNER | Own Tenants | ❌ No Access | ❌ No Access | ❌ No Access | ✅ Owner | ❌ No Access |
| Frank TenantAdmin | ADMIN | Assigned | ✅ Admin | ❌ No Access | ❌ No Access | ✅ Admin | ❌ No Access |
| Grace TenantAdmin | ADMIN | Assigned | ❌ No Access | ✅ Admin | ❌ No Access | ❌ No Access | ❌ No Access |
| Henry Member | MEMBER | Assigned | ❌ No Access | ✅ Member | ❌ No Access | ❌ No Access | ❌ No Access |
| Iris Member | MEMBER | Assigned | ❌ No Access | ❌ No Access | ✅ Member | ❌ No Access | ❌ No Access |
| Jack Viewer | VIEWER | Assigned | ❌ No Access | ❌ No Access | ✅ Viewer | ❌ No Access | ❌ No Access |
| Kate Viewer | VIEWER | Assigned | ✅ Viewer | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access |

---

## 📝 Setup Instructions

### Step 1: Create Test Users in Supabase Auth

```sql
-- Run in Supabase SQL Editor
-- Note: Supabase Auth uses magic links, so these users will need to verify email
-- For testing, you may want to use Supabase's test email feature

-- Platform Admins (PLATFORM_ADMIN role)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES 
  ('alice.platformadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('bob.platformadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated');

-- Organization Owners
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES 
  ('carol.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('david.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated');

-- Independent Owners
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES 
  ('emma.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('leo.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated');

-- Tenant Admins (ADMIN role, WITH tenant assignments)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES 
  ('frank.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('grace.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('maya.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated');

-- Tenant Members
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES 
  ('henry.member@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('iris.member@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('noah.member@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated');

-- Tenant Viewers
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES 
  ('jack.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('kate.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('olivia.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated');
```

### Step 2: Create User Records in Application Database

```sql
-- Create User records (adjust IDs based on your schema)
-- Platform Admins (PLATFORM_ADMIN role - explicit, no ambiguity)
INSERT INTO "User" (id, email, name, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'alice.platformadmin@testing.app', 'Alice PlatformAdmin', 'PLATFORM_ADMIN', NOW(), NOW()),
  (gen_random_uuid(), 'bob.platformadmin@testing.app', 'Bob PlatformAdmin', 'PLATFORM_ADMIN', NOW(), NOW());

-- Organization Owners
INSERT INTO "User" (id, email, name, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'carol.owner@testing.app', 'Carol Owner', 'OWNER', NOW(), NOW()),
  (gen_random_uuid(), 'david.owner@testing.app', 'David Owner', 'OWNER', NOW(), NOW());

-- Independent Owners
INSERT INTO "User" (id, email, name, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'emma.owner@testing.app', 'Emma Owner', 'OWNER', NOW(), NOW()),
  (gen_random_uuid(), 'leo.owner@testing.app', 'Leo Owner', 'OWNER', NOW(), NOW());

-- Tenant Admins (ADMIN role, WILL have UserTenant records)
INSERT INTO "User" (id, email, name, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'frank.tenantadmin@testing.app', 'Frank TenantAdmin', 'ADMIN', NOW(), NOW()),
  (gen_random_uuid(), 'grace.tenantadmin@testing.app', 'Grace TenantAdmin', 'ADMIN', NOW(), NOW()),
  (gen_random_uuid(), 'maya.tenantadmin@testing.app', 'Maya TenantAdmin', 'ADMIN', NOW(), NOW());

-- Tenant Members
INSERT INTO "User" (id, email, name, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'henry.member@testing.app', 'Henry Member', 'MEMBER', NOW(), NOW()),
  (gen_random_uuid(), 'iris.member@testing.app', 'Iris Member', 'MEMBER', NOW(), NOW()),
  (gen_random_uuid(), 'noah.member@testing.app', 'Noah Member', 'MEMBER', NOW(), NOW());

-- Tenant Viewers
INSERT INTO "User" (id, email, name, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'jack.viewer@testing.app', 'Jack Viewer', 'VIEWER', NOW(), NOW()),
  (gen_random_uuid(), 'kate.viewer@testing.app', 'Kate Viewer', 'VIEWER', NOW(), NOW()),
  (gen_random_uuid(), 'olivia.viewer@testing.app', 'Olivia Viewer', 'VIEWER', NOW(), NOW());
```

### Step 3: Create Test Tenants

```sql
-- Create organization for Carol
INSERT INTO "Organization" (id, name, created_at, updated_at)
VALUES ('org-001', 'Carol''s Coffee Chain', NOW(), NOW());

-- Create tenants
INSERT INTO "Tenant" (id, name, owner_id, organization_id, created_at, updated_at)
VALUES 
  ('tenant-001', 'Carol''s Coffee - Downtown', (SELECT id FROM "User" WHERE email = 'carol.owner@testing.app'), 'org-001', NOW(), NOW()),
  ('tenant-002', 'Carol''s Coffee - Uptown', (SELECT id FROM "User" WHERE email = 'carol.owner@testing.app'), 'org-001', NOW(), NOW()),
  ('tenant-003', 'Carol''s Coffee - Westside', (SELECT id FROM "User" WHERE email = 'carol.owner@testing.app'), 'org-001', NOW(), NOW()),
  ('tenant-004', 'Emma''s Boutique', (SELECT id FROM "User" WHERE email = 'emma.owner@testing.app'), NULL, NOW(), NOW());
```

### Step 4: Assign Users to Tenants

```sql
-- Assign Frank (Tenant Admin) to tenant-001 and tenant-004
-- NOTE: User.role = 'ADMIN' but scoped to these tenants only
INSERT INTO "UserTenant" (user_id, tenant_id, role, created_at, updated_at)
VALUES 
  ((SELECT id FROM "User" WHERE email = 'frank.tenantadmin@testing.app'), 'tenant-001', 'ADMIN', NOW(), NOW()),
  ((SELECT id FROM "User" WHERE email = 'frank.tenantadmin@testing.app'), 'tenant-004', 'ADMIN', NOW(), NOW());

-- Assign Grace (Tenant Admin) to tenant-002
-- NOTE: User.role = 'ADMIN' but scoped to this tenant only
INSERT INTO "UserTenant" (user_id, tenant_id, role, created_at, updated_at)
VALUES 
  ((SELECT id FROM "User" WHERE email = 'grace.tenantadmin@testing.app'), 'tenant-002', 'ADMIN', NOW(), NOW());

-- Assign Henry (Member) to tenant-002
INSERT INTO "UserTenant" (user_id, tenant_id, role, created_at, updated_at)
VALUES 
  ((SELECT id FROM "User" WHERE email = 'henry.member@testing.app'), 'tenant-002', 'MEMBER', NOW(), NOW());

-- Assign Iris (Member) to tenant-003
INSERT INTO "UserTenant" (user_id, tenant_id, role, created_at, updated_at)
VALUES 
  ((SELECT id FROM "User" WHERE email = 'iris.member@testing.app'), 'tenant-003', 'MEMBER', NOW(), NOW());

-- Assign Jack (Viewer) to tenant-003
INSERT INTO "UserTenant" (user_id, tenant_id, role, created_at, updated_at)
VALUES 
  ((SELECT id FROM "User" WHERE email = 'jack.viewer@testing.app'), 'tenant-003', 'VIEWER', NOW(), NOW());

-- Assign Kate (Viewer) to tenant-001
INSERT INTO "UserTenant" (user_id, tenant_id, role, created_at, updated_at)
VALUES 
  ((SELECT id FROM "User" WHERE email = 'kate.viewer@testing.app'), 'tenant-001', 'VIEWER', NOW(), NOW());
```

---

## ✅ Verification Checklist

- [ ] All 15 test users created in Supabase Auth
- [ ] All 15 test users created in User table
- [ ] Organization "Carol's Coffee Chain" created
- [ ] 4 test tenants created
- [ ] User-tenant assignments created
- [ ] Can login as each user
- [ ] Each user sees correct tenants
- [ ] Permissions work as expected

---

## 🔒 Security Notes

**⚠️ STAGING ONLY**
- These users are for staging/testing ONLY
- Never use these credentials in production
- All users share the same password for testing convenience
- Delete all test users before production deployment

**Password:** `TestPass123!`
- Simple password for testing
- Easy to remember
- Should be changed if staging is publicly accessible

---

**Created:** November 7, 2025  
**Last Updated:** November 7, 2025  
**Environment:** Staging  
**Status:** Ready for Testing
