# Role Display Name Mapping & Middleware Alignment

## Display Name Standard

### Platform Roles (User.role)
| Display Name | Database Value | Middleware Behavior |
|--------------|----------------|---------------------|
| **Platform Admin** | `PLATFORM_ADMIN` | Unlimited tenants, bypasses all checks |
| **Platform Support** | `PLATFORM_SUPPORT` | 3 tenant limit globally, view all tenants |
| **Platform Viewer** | `PLATFORM_VIEWER` | Read-only all tenants, cannot create |
| **Tenant Owner** | `OWNER` | Can own tenants, tier-based limits |
| **Tenant User** | `USER` | Basic access, tier-based limits |

### Tenant Roles (UserTenant.role)
| Display Name | Database Value | Middleware Behavior |
|--------------|----------------|---------------------|
| **Tenant Owner** | `OWNER` | Full control + billing (canAdmin) |
| **Tenant Support** | `ADMIN` | Full operations, no billing (canSupport) |
| **Tenant Member** | `MEMBER` | Edit only (canEdit) |
| **Tenant Viewer** | `VIEWER` | Read-only (canView) |

**Note:** `MANAGER` is an alias for `ADMIN` in the permission system - both have identical permissions.

---

## Middleware Alignment Verification

### Platform Role Checks

#### 1. Tenant Creation Limits (`checkTenantCreationLimit`)
```typescript
// PLATFORM_ADMIN
if (user.role === 'PLATFORM_ADMIN') {
  // ✅ Unlimited - bypass all checks
}

// PLATFORM_SUPPORT  
if (user.role === 'PLATFORM_SUPPORT') {
  // ✅ Limited to 3 tenants per owner
  // Can create for themselves or on behalf of customers
}

// PLATFORM_VIEWER
if (user.role === 'PLATFORM_VIEWER') {
  // ❌ Cannot create tenants (read-only)
  // Returns 403: platform_viewer_cannot_create
}

// OWNER (Tenant Owner)
if (user.role === 'OWNER') {
  // ✅ Tier-based limits (1, 3, 10, 25, unlimited)
  // Limit = highest owned tenant's subscription tier
}

// USER (Tenant User)
if (user.role === 'USER') {
  // ✅ Tier-based limits (1, 3, 10, 25, unlimited)
  // Limit = highest owned tenant's subscription tier
}
```

**Display Name Alignment:** ✅ CORRECT
- "Platform Admin" → Unlimited ✅
- "Platform Support" → 3 tenant limit ✅
- "Platform Viewer" → Cannot create ✅
- "Tenant Owner" → Tier-based ✅
- "Tenant User" → Tier-based ✅

---

### Tenant Role Checks

#### 2. Tenant Management (`requireTenantAdmin`)
```typescript
// Requires: OWNER or ADMIN
requireTenantRole(UserTenantRole.OWNER, UserTenantRole.ADMIN)

// ✅ OWNER (Tenant Owner) - Full control
// ✅ ADMIN (Tenant Support) - Full operations
// ❌ MEMBER (Tenant Member) - Blocked
// ❌ VIEWER (Tenant Viewer) - Blocked
```

**Display Name Alignment:** ✅ CORRECT
- "Tenant Owner" → Can manage ✅
- "Tenant Support" → Can manage ✅
- "Tenant Member" → Cannot manage ✅
- "Tenant Viewer" → Cannot manage ✅

#### 3. Inventory Access (`requireInventoryAccess`)
```typescript
// Requires: OWNER, ADMIN, or MEMBER
requireTenantRole(
  UserTenantRole.OWNER,
  UserTenantRole.ADMIN,
  UserTenantRole.MEMBER
)

// ✅ OWNER (Tenant Owner) - Full access
// ✅ ADMIN (Tenant Support) - Full access
// ✅ MEMBER (Tenant Member) - Edit access
// ❌ VIEWER (Tenant Viewer) - Blocked
```

**Display Name Alignment:** ✅ CORRECT
- "Tenant Owner" → Can edit ✅
- "Tenant Support" → Can edit ✅
- "Tenant Member" → Can edit ✅
- "Tenant Viewer" → Cannot edit ✅

#### 4. Tenant Ownership (`requireTenantOwner`)
```typescript
// Requires: OWNER only
if (userRole !== UserTenantRole.OWNER) {
  return 403: 'owner_required'
}

// ✅ OWNER (Tenant Owner) - Can delete tenant, manage billing
// ❌ ADMIN (Tenant Support) - Cannot delete tenant
// ❌ MEMBER (Tenant Member) - Cannot delete tenant
// ❌ VIEWER (Tenant Viewer) - Cannot delete tenant
```

**Display Name Alignment:** ✅ CORRECT
- "Tenant Owner" → Can delete/billing ✅
- "Tenant Support" → Cannot delete/billing ✅
- "Tenant Member" → Cannot delete/billing ✅
- "Tenant Viewer" → Cannot delete/billing ✅

---

## Permission System Alignment

### Frontend Permission Hook (`useTenantTier`)

```typescript
const rolePermissions: Record<UserTenantRole, PermissionType[]> = {
  'OWNER':   ['canView', 'canEdit', 'canManage', 'canSupport', 'canAdmin'],
  'ADMIN':   ['canView', 'canEdit', 'canManage', 'canSupport'],
  'MANAGER': ['canView', 'canEdit', 'canManage', 'canSupport'], // Alias for ADMIN
  'MEMBER':  ['canView', 'canEdit'],
  'VIEWER':  ['canView'],
};
```

**Display Name Alignment:** ✅ CORRECT

| Display Name | Permissions | Aligned? |
|--------------|-------------|----------|
| **Tenant Owner** (OWNER) | canView, canEdit, canManage, canSupport, canAdmin | ✅ |
| **Tenant Support** (ADMIN) | canView, canEdit, canManage, canSupport | ✅ |
| **Tenant Member** (MEMBER) | canView, canEdit | ✅ |
| **Tenant Viewer** (VIEWER) | canView | ✅ |

---

## Platform User Bypass Rules

### Platform Admin
```typescript
if (user.role === 'PLATFORM_ADMIN') {
  // Bypasses ALL checks (tier + role)
  // Acts as OWNER on any tenant
  // Unlimited tenant creation
}
```

**Display Name:** "Platform Admin" ✅

### Platform Support
```typescript
if (user.role === 'PLATFORM_SUPPORT') {
  // Bypasses tier checks
  // Can view all tenants
  // Limited to 3 owned tenants globally
  // Can perform support actions (password resets, etc.)
}
```

**Display Name:** "Platform Support" ✅

### Platform Viewer
```typescript
if (user.role === 'PLATFORM_VIEWER') {
  // Bypasses tier checks for read-only
  // Acts as VIEWER on any tenant
  // Cannot create tenants
  // Cannot perform write operations
}
```

**Display Name:** "Platform Viewer" ✅

---

## Summary: Alignment Status

### ✅ All Display Names Align with Middleware Behavior

**Platform Roles:**
- ✅ Platform Admin → Unlimited, bypass all
- ✅ Platform Support → 3 tenant limit, view all
- ✅ Platform Viewer → Read-only, cannot create
- ✅ Tenant Owner → Tier-based limits, can own tenants
- ✅ Tenant User → Tier-based limits, basic access

**Tenant Roles:**
- ✅ Tenant Owner → Full control + billing (canAdmin)
- ✅ Tenant Support → Full operations, no billing (canSupport)
- ✅ Tenant Member → Edit only (canEdit)
- ✅ Tenant Viewer → Read-only (canView)

**No middleware changes needed** - display names accurately reflect system behavior.

---

## Key Insights

### 1. "Tenant Owner" Appears in Both Lists
- **Platform Level:** `OWNER` role = Can own multiple tenants
- **Tenant Level:** `OWNER` role = Owns this specific tenant

This is intentional and correct. A user with platform role `OWNER` can own multiple tenants, and within each tenant they own, they have the tenant role `OWNER`.

### 2. "Tenant Support" = Database "ADMIN"
The database uses `ADMIN` but we display as "Tenant Support" to:
- Avoid confusion with "Platform Admin"
- Better describe the role (support operations, not administration)
- Align with permission type `canSupport`

### 3. "MANAGER" is an Alias
The permission system treats `MANAGER` and `ADMIN` identically. This is for organizational flexibility - some businesses prefer "Manager" terminology.

---

## Testing Checklist

### Platform Roles
- [ ] Platform Admin can create unlimited tenants
- [ ] Platform Support limited to 3 tenants globally
- [ ] Platform Viewer cannot create tenants
- [ ] Tenant Owner respects tier limits
- [ ] Tenant User respects tier limits

### Tenant Roles
- [ ] Tenant Owner can delete tenant and manage billing
- [ ] Tenant Support can manage operations but not delete
- [ ] Tenant Member can edit but not manage
- [ ] Tenant Viewer is read-only

### Permission System
- [ ] canView: All roles
- [ ] canEdit: MEMBER+
- [ ] canManage: ADMIN/MANAGER+
- [ ] canSupport: ADMIN/MANAGER+
- [ ] canAdmin: OWNER only

**All tests should pass with current middleware implementation.**
