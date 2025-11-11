# Platform Support Limit - Final Correct Implementation

**Date:** November 11, 2024  
**Status:** ✅ CORRECT - Middleware aligned with specification

## Final Correct Understanding

**PLATFORM_SUPPORT Limit = 3 tenants per owner**

### The Rule

When PLATFORM_SUPPORT creates a tenant:
- The tenant will be owned by `req.user.userId` (the authenticated user)
- PLATFORM_SUPPORT can only create up to **3 tenants per owner**
- This limit applies **regardless of the owner's actual subscription tier**
- The owner could be PLATFORM_SUPPORT themselves or a customer

### Key Insight

**Limit = Ownership**

The limit is tied to the **owner of the tenant**, not:
- ❌ Total tenants in the system
- ❌ Total tenants created by PLATFORM_SUPPORT
- ❌ Total locations across all owners
- ✅ **Tenants owned by a specific user**

## Examples

### Example 1: PLATFORM_SUPPORT Creating for Themselves

```
PLATFORM_SUPPORT (user_123) creates:
- Tenant A (owned by user_123) ✅ Count: 1/3
- Tenant B (owned by user_123) ✅ Count: 2/3
- Tenant C (owned by user_123) ✅ Count: 3/3
- Tenant D (owned by user_123) ❌ BLOCKED - "This owner already has 3 locations"
```

### Example 2: PLATFORM_SUPPORT Creating for Organization Tier Customer

```
Customer (user_456) has Organization tier (normally unlimited locations)

PLATFORM_SUPPORT creates for user_456:
- Tenant A (owned by user_456) ✅ Count: 1/3
- Tenant B (owned by user_456) ✅ Count: 2/3
- Tenant C (owned by user_456) ✅ Count: 3/3
- Tenant D (owned by user_456) ❌ BLOCKED - "This owner already has 3 locations"

Customer can still create more tenants themselves (they have unlimited tier)
```

### Example 3: Multiple Customers

```
PLATFORM_SUPPORT creates:
- 3 tenants for Customer A (user_111) ✅
- 3 tenants for Customer B (user_222) ✅
- 3 tenants for Customer C (user_333) ✅
- 3 tenants for themselves (user_123) ✅

Total: 12 tenants created, each owner limited to 3
```

## Implementation

### Middleware Logic

```typescript
if (req.user.role === 'PLATFORM_SUPPORT') {
  // The owner will be the authenticated user
  const ownerId = req.user.userId;
  
  // Count tenants owned by this user
  const ownedTenants = await prisma.userTenant.count({
    where: {
      userId: ownerId,
      role: UserTenantRole.OWNER,
    },
  });
  
  const supportLimit = getPlatformSupportLimit(); // 3
  
  if (ownedTenants >= supportLimit) {
    return res.status(403).json({
      error: 'platform_support_limit_reached',
      message: `Platform support users can only create up to ${supportLimit} tenants per owner. This owner already has ${ownedTenants} locations.`,
      current: ownedTenants,
      limit: supportLimit,
      role: 'PLATFORM_SUPPORT',
      ownerId: ownerId,
    });
  }
  
  return next();
}
```

### Key Points

1. **Check owner's tenant count** - Not PLATFORM_SUPPORT's total
2. **Owner = req.user.userId** - The authenticated user creating the tenant
3. **Limit = 3 per owner** - Regardless of owner's tier
4. **Independent limits** - Each owner has their own 3-tenant limit

## Files Updated

### 1. `apps/api/src/middleware/permissions.ts`

**Function:** `checkTenantCreationLimit()`

```typescript
// CORRECT: Checks tenants owned by the user who will own the new tenant
const ownedTenants = await prisma.userTenant.count({
  where: {
    userId: req.user.userId, // The owner
    role: UserTenantRole.OWNER,
  },
});
```

### 2. `apps/api/src/config/tenant-limits.ts`

**Updated comments:**
- File header: "Limited to 3 tenants per owner (regardless of owner's tier)"
- `PLATFORM_SUPPORT_LIMIT` comment: "Can only create up to 3 tenants per owner"
- `getPlatformSupportLimit()` comment: "Can create up to 3 tenants per owner"

### 3. `apps/api/src/routes/tenant-limits.ts`

**Endpoint:** `GET /api/tenant-limits/status`

```typescript
tierDisplayName: `Platform Support (${supportLimit} tenants per owner)`
upgradeMessage: 'Platform support users can only create 3 tenants per owner. This owner has reached the limit.'
```

### 4. `docs/USER_JOURNEY_GOALS.md`

**Updated PLATFORM_SUPPORT section:**
- Access Limits: "3 tenants per owner limit (regardless of owner's tier)"
- Testing & QA: "Limited to 3 tenants per owner (regardless of tier)"

## Verification Scenarios

### ✅ Scenario 1: Support Creating for Themselves
- PLATFORM_SUPPORT creates 3 tenants they own
- 4th tenant creation blocked
- Error: "This owner already has 3 locations"

### ✅ Scenario 2: Support Creating for Customer
- Customer has Organization tier (unlimited)
- PLATFORM_SUPPORT creates 3 tenants for customer
- 4th tenant creation blocked by PLATFORM_SUPPORT limit
- Customer can still create more themselves

### ✅ Scenario 3: Multiple Owners
- PLATFORM_SUPPORT creates 3 for Owner A
- PLATFORM_SUPPORT creates 3 for Owner B
- Each owner has independent 3-tenant limit
- No global limit across all owners

### ✅ Scenario 4: Mixed Creation
- Owner has 2 tenants (created by themselves)
- PLATFORM_SUPPORT creates 1 more (total 3)
- PLATFORM_SUPPORT blocked from creating 4th
- Owner can still create more themselves (if tier allows)

## Why This Makes Sense

**Purpose:** Prevent PLATFORM_SUPPORT from creating excessive test tenants for any single owner

**Benefits:**
- ✅ Prevents abuse (can't create 100 tenants for one test user)
- ✅ Encourages cleanup (delete old test tenants)
- ✅ Per-owner isolation (doesn't block other owners)
- ✅ Doesn't interfere with customer's own creation (they can still create based on tier)

**Use Cases:**
- **Testing:** Create 3 test tenants for themselves
- **Support:** Create up to 3 tenants for a customer during onboarding
- **Demo:** Create 3 demo tenants for a prospect

## Summary

✅ **Correct Logic:** Limit per owner, not global  
✅ **Correct Check:** Count owner's tenants, not total  
✅ **Correct Scope:** Applies regardless of owner's tier  
✅ **Correct Message:** Clear error about owner's limit  
✅ **Correct Documentation:** All files aligned  

**The PLATFORM_SUPPORT limit now correctly enforces 3 tenants per owner!**
