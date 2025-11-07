# Staging Test Users

**Purpose:** Pre-configured test users for comprehensive user journey testing  
**Environment:** Staging branch  
**Password Policy:** All test users use the same password for convenience: `TestPass123!`

---

## 🔐 Test User Accounts

| Email Address | Password | Full Name | User Role | Scope |
|--------------|----------|-----------|-----------|-------|
| alice.platformadmin@testing.app | TestPass123! | Alice PlatformAdmin | PLATFORM_ADMIN | Platform-wide (full control) |
| bob.platformadmin@testing.app | TestPass123! | Bob PlatformAdmin | PLATFORM_ADMIN | Platform-wide (full control) |
| charlie.support@testing.app | TestPass123! | Charlie Support | PLATFORM_SUPPORT | Platform-wide (view + support actions) |
| diana.analytics@testing.app | TestPass123! | Diana Analytics | PLATFORM_VIEWER | Platform-wide (read-only) |
| carol.owner@testing.app | TestPass123! | Carol Owner | OWNER | Own tenants |
| david.owner@testing.app | TestPass123! | David Owner | OWNER | Own tenants |
| emma.owner@testing.app | TestPass123! | Emma Owner | OWNER | Own tenants |
| frank.tenantadmin@testing.app | TestPass123! | Frank TenantAdmin | USER | Assigned tenants (via UserTenant.ADMIN) |
| grace.tenantadmin@testing.app | TestPass123! | Grace TenantAdmin | USER | Assigned tenants (via UserTenant.ADMIN) |
| henry.member@testing.app | TestPass123! | Henry Member | USER | Assigned tenants (via UserTenant.MEMBER) |
| iris.member@testing.app | TestPass123! | Iris Member | USER | Assigned tenants (via UserTenant.MEMBER) |
| jack.viewer@testing.app | TestPass123! | Jack Viewer | USER | Assigned tenants (via UserTenant.VIEWER) |
| kate.viewer@testing.app | TestPass123! | Kate Viewer | USER | Assigned tenants (via UserTenant.VIEWER) |
| leo.owner@testing.app | TestPass123! | Leo Owner | OWNER | Own tenants |
| maya.tenantadmin@testing.app | TestPass123! | Maya TenantAdmin | USER | Assigned tenants (via UserTenant.ADMIN) |
| noah.member@testing.app | TestPass123! | Noah Member | USER | Assigned tenants (via UserTenant.MEMBER) |
| olivia.viewer@testing.app | TestPass123! | Olivia Viewer | USER | Assigned tenants (via UserTenant.VIEWER) |

---

## 🎭 Role Clarification

### Explicit Role Definitions

The platform uses **explicit role names** to avoid ambiguity:

#### 1. PLATFORM_ADMIN (Platform-wide Full Control)
**Users:** Alice PlatformAdmin, Bob PlatformAdmin  
**Database:** `User.role = 'PLATFORM_ADMIN'`  
**Access:**
- ✅ Full platform-wide access to ALL tenants
- ✅ Can create, update, delete tenants
- ✅ Access to `/settings/admin`
- ✅ Can manage all users
- ✅ Can manage feature flags
- ✅ Can create organizations
- ✅ Can view system metrics
- ✅ Can modify platform settings
- ✅ No tenant assignments needed

**Use Case:** Platform administrators, DevOps, founders

#### 2. PLATFORM_SUPPORT (Platform-wide View + Support Actions)
**Users:** Charlie Support  
**Database:** `User.role = 'PLATFORM_SUPPORT'`  
**Access:**
- ✅ View ALL tenants (read-only)
- ✅ View all users
- ✅ Reset user passwords
- ✅ Unlock accounts
- ✅ View logs and metrics
- ✅ Access support tools
- ❌ Cannot delete tenants
- ❌ Cannot modify platform settings
- ❌ Cannot change billing
- ❌ Cannot modify tenant data

**Use Case:** Customer support team, technical support

#### 3. PLATFORM_VIEWER (Platform-wide Read-Only)
**Users:** Diana Analytics  
**Database:** `User.role = 'PLATFORM_VIEWER'`  
**Access:**
- ✅ View ALL tenants (read-only)
- ✅ View metrics and analytics
- ✅ Export reports
- ✅ View dashboards
- ❌ Cannot modify ANY data
- ❌ Cannot perform ANY actions
- ❌ Cannot access admin tools
- ❌ Cannot change settings

**Use Case:** Analytics team, sales team, legal/compliance, executives

#### 4. OWNER (Business Owner)
**Users:** Carol, David, Emma, Leo  
**Database:** `User.role = 'OWNER'`  
**Access:**
- ✅ Owns one or more tenants
- ✅ Full control over owned tenants
- ✅ Can create new tenants (up to limit)
- ❌ Cannot access other tenants

#### 5. Tenant-Scoped Roles (via UserTenant)
**Users:** Frank, Grace, Maya (ADMIN), Henry, Iris, Noah (MEMBER), Jack, Kate, Olivia (VIEWER)  
**Database:** `User.role = 'USER'` + `UserTenant.role = 'ADMIN'|'MEMBER'|'VIEWER'`  
**Access:**
- ✅ Access to ASSIGNED tenants only
- ✅ Permissions based on UserTenant.role
- ❌ Cannot access unassigned tenants
- ❌ Cannot access platform admin features

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

### Platform Support Testing
**User:** charlie.support@testing.app
- Role: `PLATFORM_SUPPORT`
- Tenant Assignments: None (not needed - platform-wide view access)
- Test support team workflows
- Can view all tenants (read-only)
- Can reset user passwords
- Can unlock accounts
- Can view logs and metrics
- Cannot delete or modify tenants
- Cannot change platform settings

---

### Platform Viewer Testing
**User:** diana.analytics@testing.app
- Role: `PLATFORM_VIEWER`
- Tenant Assignments: None (not needed - platform-wide view access)
- Test analytics/sales/legal workflows
- Can view all tenants (read-only)
- Can view metrics and generate reports
- Can export data
- Cannot modify any data
- Cannot perform any actions
- Cannot access admin tools

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
-- Note: These queries are idempotent - safe to run multiple times

-- Platform Admins (PLATFORM_ADMIN role)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'alice.platformadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'bob.platformadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Platform Support (PLATFORM_SUPPORT role)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'charlie.support@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Platform Viewer (PLATFORM_VIEWER role)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'diana.analytics@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Organization Owners
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'carol.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'david.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Independent Owners
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'emma.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'leo.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Tenant Admins (ADMIN role, WITH tenant assignments)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'frank.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'grace.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'maya.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Tenant Members
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'henry.member@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'iris.member@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'noah.member@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;

-- Tenant Viewers
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES 
  (gen_random_uuid(), 'jack.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'kate.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated'),
  (gen_random_uuid(), 'olivia.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (email) DO NOTHING;
```

### Step 2: Create User Records in Application Database

```sql
-- Create User records in the "users" table (note: lowercase table name)
-- Note: User model uses first_name and last_name, not a single name field
-- Note: User model uses cuid() by default, but we're using UUIDs for consistency
-- Note: These queries are idempotent - safe to run multiple times

-- Platform Admins (PLATFORM_ADMIN role - explicit, no ambiguity)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'alice.platformadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Alice', 'PlatformAdmin', 'PLATFORM_ADMIN', true, NOW(), NOW()),
  (gen_random_uuid(), 'bob.platformadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Bob', 'PlatformAdmin', 'PLATFORM_ADMIN', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Platform Support (PLATFORM_SUPPORT role - view all + support actions)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'charlie.support@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Charlie', 'Support', 'PLATFORM_SUPPORT', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Platform Viewer (PLATFORM_VIEWER role - read-only all)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'diana.analytics@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Diana', 'Analytics', 'PLATFORM_VIEWER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Organization Owners
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'carol.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Carol', 'Owner', 'OWNER', true, NOW(), NOW()),
  (gen_random_uuid(), 'david.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), 'David', 'Owner', 'OWNER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Independent Owners
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'emma.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Emma', 'Owner', 'OWNER', true, NOW(), NOW()),
  (gen_random_uuid(), 'leo.owner@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Leo', 'Owner', 'OWNER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Tenant Admins (USER role - they get ADMIN via UserTenant.role)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'frank.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Frank', 'TenantAdmin', 'USER', true, NOW(), NOW()),
  (gen_random_uuid(), 'grace.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Grace', 'TenantAdmin', 'USER', true, NOW(), NOW()),
  (gen_random_uuid(), 'maya.tenantadmin@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Maya', 'TenantAdmin', 'USER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Tenant Members
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'henry.member@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Henry', 'Member', 'USER', true, NOW(), NOW()),
  (gen_random_uuid(), 'iris.member@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Iris', 'Member', 'USER', true, NOW(), NOW()),
  (gen_random_uuid(), 'noah.member@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Noah', 'Member', 'USER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Tenant Viewers
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'jack.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Jack', 'Viewer', 'USER', true, NOW(), NOW()),
  (gen_random_uuid(), 'kate.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Kate', 'Viewer', 'USER', true, NOW(), NOW()),
  (gen_random_uuid(), 'olivia.viewer@testing.app', crypt('TestPass123!', gen_salt('bf')), 'Olivia', 'Viewer', 'USER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
```

### Step 3: Create Test Tenants and Organizations

```sql
-- Note: These queries are idempotent - safe to run multiple times

-- Create organization for Carol (lowercase table name, camelCase column names)
INSERT INTO organization (id, name, "ownerId", "createdAt", "updatedAt")
VALUES ('org-001', 'Carol''s Coffee Chain', (SELECT id FROM users WHERE email = 'carol.owner@testing.app'), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create tenants (note: Tenant uses camelCase columns, ownership is via UserTenant with OWNER role)
INSERT INTO "Tenant" (id, name, "organizationId", "createdAt")
VALUES 
  ('tenant-001', 'Carol''s Coffee - Downtown', 'org-001', NOW()),
  ('tenant-002', 'Carol''s Coffee - Uptown', 'org-001', NOW()),
  ('tenant-003', 'Carol''s Coffee - Westside', 'org-001', NOW()),
  ('tenant-004', 'Emma''s Boutique', NULL, NOW())
ON CONFLICT (id) DO NOTHING;
```

### Step 4: Assign Users to Tenants (via user_tenants table)

```sql
-- Note: These queries are idempotent - safe to run multiple times
-- user_tenants has a unique constraint on (user_id, tenant_id)

-- First, assign OWNERS to their tenants (Carol owns all 3 coffee shops)
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'carol.owner@testing.app'), 'tenant-001', 'OWNER', NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'carol.owner@testing.app'), 'tenant-002', 'OWNER', NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'carol.owner@testing.app'), 'tenant-003', 'OWNER', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Emma owns her boutique
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'emma.owner@testing.app'), 'tenant-004', 'OWNER', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Assign Frank (Tenant Admin) to tenant-001 and tenant-004
-- NOTE: UserTenant.role = 'ADMIN' (tenant-scoped admin)
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'frank.tenantadmin@testing.app'), 'tenant-001', 'ADMIN', NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'frank.tenantadmin@testing.app'), 'tenant-004', 'ADMIN', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Assign Grace (Tenant Admin) to tenant-002
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'grace.tenantadmin@testing.app'), 'tenant-002', 'ADMIN', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Assign Henry (Member) to tenant-002
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'henry.member@testing.app'), 'tenant-002', 'MEMBER', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Assign Iris (Member) to tenant-003
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'iris.member@testing.app'), 'tenant-003', 'MEMBER', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Assign Jack (Viewer) to tenant-003
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'jack.viewer@testing.app'), 'tenant-003', 'VIEWER', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Assign Kate (Viewer) to tenant-001
INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM users WHERE email = 'kate.viewer@testing.app'), 'tenant-001', 'VIEWER', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;
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
