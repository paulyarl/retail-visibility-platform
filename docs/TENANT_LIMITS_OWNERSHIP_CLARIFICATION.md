# Tenant Limits - Ownership Clarification ✅

**Status:** ✅ CORRECT IMPLEMENTATION - No Changes Needed  
**Date:** November 11, 2025

## Core Principle

**Platform users operate across tenants. Tenant users operate within their scope.**

---

## Two Distinct User Types

### Platform Users
- **Roles:** PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_VIEWER
- **Scope:** Operate across ALL tenants
- **Limits:** Platform-level (not tied to individual tenant tiers)

### Tenant Users
- **Roles:** OWNER, ADMIN, MANAGER, MEMBER, VIEWER (within a tenant)
- **Scope:** Operate within their owned/assigned tenants
- **Limits:** Tier-based (based on their subscription tier)

---

## Tenant Creation Scenarios

### Scenario 1: Platform Admin Creates Tenant (As Owner)

**Flow:**
```typescript
POST /tenants
req.user = { role: 'PLATFORM_ADMIN', userId: 'admin-123' }

Middleware: checkTenantCreationLimit()
  ↓
Check: isPlatformAdmin(req.user) → TRUE
  ↓
Result: return next() // ✅ BYPASS - No limits
  ↓
Tenant created with:
  - owner: 'admin-123' (Platform Admin)
  - tier: 'starter' (default)
  - status: 'trial'
```

**Outcome:** ✅ **Unlimited** - Platform Admin can create as many tenants as needed

**Why:** Platform Admin operates across tenants, not constrained by any individual tenant's tier.

---

### Scenario 2: Regular User Creates Tenant (As Owner)

**Flow:**
```typescript
POST /tenants
req.user = { role: 'USER', userId: 'user-456' }

Middleware: checkTenantCreationLimit()
  ↓
Check: isPlatformAdmin(req.user) → FALSE
  ↓
Check: Count user's owned tenants
  ↓
Check: User's highest tier (from owned tenants)
  ↓
Check: Can user create more based on tier?
  ↓
Result: 
  - If within limit → next() ✅
  - If at limit → 403 error ❌
  ↓
Tenant created with:
  - owner: 'user-456' (Regular User)
  - tier: 'starter' (default)
  - status: 'trial'
```

**Outcome:** ⚠️ **Tier-Limited** - User can only create tenants up to their tier limit

**Why:** Regular user operates within their scope, constrained by their subscription tier.

---

## Current Implementation Verification

### Code Analysis

```typescript
// apps/api/src/middleware/permissions.ts

export async function checkTenantCreationLimit(req, res, next) {
  // 1. Authentication check
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required' });
  }

  // 2. Platform Admin bypass (operates across tenants)
  if (isPlatformAdmin(req.user)) {
    return next(); // ✅ NO LIMITS
  }

  // 3. Platform Support limit (3 tenants globally)
  if (req.user.role === 'PLATFORM_SUPPORT') {
    // Check global tenant count
    // Limited to 3 across ALL users
  }

  // 4. Platform Viewer block (read-only)
  if (req.user.role === 'PLATFORM_VIEWER') {
    return res.status(403).json({ error: 'platform_viewer_cannot_create' });
  }

  // 5. Regular user tier check (operates within scope)
  const ownedTenants = await prisma.userTenant.findMany({
    where: {
      userId: req.user.userId,  // ✅ Checks OWNER's limits
      role: UserTenantRole.OWNER,
    },
  });

  // Determine user's effective tier from owned tenants
  // Check if user can create more based on tier
  // ✅ TIER LIMITS APPLY
}
```

### Tenant Creation Endpoint

```typescript
// apps/api/src/index.ts

app.post("/tenants", 
  authenticateToken,           // Who is creating?
  checkTenantCreationLimit,    // Can they create?
  async (req, res) => {
    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: parsed.data.name,
        subscriptionTier: 'starter',
        subscriptionStatus: 'trial',
      }
    });
    
    // Link to creator as OWNER
    await prisma.userTenant.create({
      data: {
        userId: req.user.userId,  // ✅ Creator becomes owner
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });
  }
);
```

---

## Verification Matrix

| Creator Role | Owner After Creation | Limit Check | Max Tenants | Correct? |
|--------------|---------------------|-------------|-------------|----------|
| **PLATFORM_ADMIN** | Platform Admin | ❌ Bypassed | ∞ Unlimited | ✅ YES |
| **PLATFORM_SUPPORT** | Platform Support | ✅ Global count | 3 total | ✅ YES |
| **PLATFORM_VIEWER** | N/A | ✅ Blocked | 0 (read-only) | ✅ YES |
| **Regular User (Trial)** | Regular User | ✅ Tier check | 1 location | ✅ YES |
| **Regular User (Starter)** | Regular User | ✅ Tier check | 3 locations | ✅ YES |
| **Regular User (Professional)** | Regular User | ✅ Tier check | 10 locations | ✅ YES |
| **Regular User (Organization)** | Regular User | ✅ Tier check | ∞ Unlimited | ✅ YES |

---

## Key Points Confirmed

### ✅ Platform Admin as Owner
- **Behavior:** Unlimited tenant creation
- **Reason:** Platform users operate across tenants
- **Implementation:** `isPlatformAdmin()` bypass at line 130
- **Status:** ✅ CORRECT

### ✅ Regular User as Owner
- **Behavior:** Tier-based limits
- **Reason:** Tenant users operate within their scope
- **Implementation:** Tier check at lines 161-222
- **Status:** ✅ CORRECT

### ✅ Tenant's Tier vs Owner's Tier
- **Tenant's tier:** Determines what features the tenant has access to
- **Owner's tier:** Determines how many tenants the owner can create
- **Relationship:** Independent (tenant starts with default tier, can be upgraded)
- **Status:** ✅ CORRECT

---

## Important Distinction

### What We're Limiting

**NOT limiting:** Features within a tenant based on tenant's tier
- This is handled by feature access middleware
- Tenant's tier determines: storefront, directory, propagation, etc.

**YES limiting:** Number of tenants a user can create
- Platform Admin: Unlimited (operates across tenants)
- Regular User: Based on their highest owned tenant's tier

---

## Example Scenarios

### Example 1: Platform Admin Creates 100 Tenants
```
Platform Admin (admin-123) creates:
  - Tenant 1 (owner: admin-123, tier: starter)
  - Tenant 2 (owner: admin-123, tier: starter)
  - ...
  - Tenant 100 (owner: admin-123, tier: starter)

Result: ✅ All succeed (no limits)
Reason: Platform Admin operates across tenants
```

### Example 2: Starter User Creates 4 Tenants
```
Regular User (user-456, highest tier: starter) creates:
  - Tenant 1 (owner: user-456, tier: starter) ✅ Success (1/3)
  - Tenant 2 (owner: user-456, tier: starter) ✅ Success (2/3)
  - Tenant 3 (owner: user-456, tier: starter) ✅ Success (3/3)
  - Tenant 4 (owner: user-456, tier: starter) ❌ BLOCKED

Error: "Your starter plan allows 3 locations. You currently have 3."
Reason: Regular user operates within their scope (tier limits)
```

### Example 3: User Upgrades Tier
```
Regular User (user-456) has 3 tenants (at starter limit)
  ↓
User upgrades ONE tenant to Professional tier
  ↓
User's effective tier: Professional (highest owned)
  ↓
User can now create 7 more tenants (10 total for Professional)
  ↓
Result: ✅ Can create Tenant 4, 5, 6... up to 10 total

Reason: User's limit is based on their highest tier
```

---

## Conclusion

**✅ IMPLEMENTATION IS CORRECT**

The current implementation properly distinguishes between:

1. **Platform users** (operate across tenants) → No limits for Platform Admin
2. **Tenant users** (operate within scope) → Tier-based limits

**No changes needed.** The middleware correctly:
- Bypasses limits for Platform Admin (when they are the owner)
- Enforces tier limits for regular users (when they are the owner)
- Respects the principle: "Platform users operate across tenants, tenant users operate within their scope"

---

## Documentation References

- `apps/api/src/middleware/permissions.ts` - checkTenantCreationLimit()
- `apps/api/src/config/tenant-limits.ts` - Tier configurations
- `apps/api/src/index.ts` - POST /tenants endpoint
- `docs/TENANT_LIMITS_IMPLEMENTATION_COMPLETE.md` - Full implementation
- `docs/TENANT_LIMITS_MIDDLEWARE_ALIGNMENT_VERIFICATION.md` - Verification report
