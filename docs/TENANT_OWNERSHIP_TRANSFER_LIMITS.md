# Tenant Ownership Transfer Limits - Gap Closed ✅

**Status:** ✅ FIXED - Ownership transfer now respects destination owner limits  
**Date:** November 11, 2025

## The Gap Discovered

**Issue:** When transferring tenant ownership via role change (PUT /tenants/:tenantId/users/:userId), the system did NOT check if the destination owner had capacity for another tenant.

### Vulnerable Scenario

```
User A (Starter tier, 3/3 tenants) wants to transfer Tenant X to User B (Starter tier, 3/3 tenants)

Before Fix:
  ↓
PUT /tenants/tenant-x/users/user-b { role: "OWNER" }
  ↓
✅ SUCCESS - User B now owns 4 tenants (exceeds Starter limit!)
  ↓
❌ GAP: No limit check on destination owner
```

---

## The Fix

### Implementation

**File:** `apps/api/src/routes/tenant-users.ts`

**Added Logic:**
1. Detect when role is being changed TO "OWNER" (ownership transfer)
2. Check if target user is a platform user
3. If regular user, check their current owned tenant count
4. Verify they have capacity based on their tier
5. Block transfer if they're at limit

### Code Flow

```typescript
PUT /tenants/:tenantId/users/:userId { role: "OWNER" }
  ↓
1. Validate request
  ↓
2. Prevent self-role-change
  ↓
3. NEW: Check if role === "OWNER"
  ↓
4. Get target user's platform role
  ↓
5. If Platform Admin/Support → Allow (unlimited)
  ↓
6. If Platform Viewer → Check limits (read-only, should be 0)
  ↓
7. If Regular User:
   - Count their owned tenants
   - Determine their effective tier
   - Check if they can accept another tenant
   - Block if at limit ❌
  ↓
8. Update role if all checks pass ✅
```

---

## Transfer Scenarios

### Scenario 1: Platform Admin → Regular User ✅

```
Transfer: Platform Admin (unlimited) → Regular User (Starter, 2/3)

Check:
  - Target: Regular User
  - Current: 2 owned tenants
  - Limit: 3 (Starter tier)
  - Can accept? YES (2 < 3)
  
Result: ✅ Transfer succeeds
New state: Regular User owns 3 tenants (3/3)
```

### Scenario 2: Regular User → Regular User (At Limit) ❌

```
Transfer: User A (Starter, 3/3) → User B (Starter, 3/3)

Check:
  - Target: User B (Regular User)
  - Current: 3 owned tenants
  - Limit: 3 (Starter tier)
  - Can accept? NO (3 >= 3)
  
Result: ❌ Transfer blocked

Error Response:
{
  error: 'tenant_limit_reached',
  message: 'Cannot transfer ownership: Target user has reached their limit. Upgrade to Professional to manage up to 10 locations',
  current: 3,
  limit: 3,
  tier: 'starter',
  upgradeToTier: 'professional'
}
```

### Scenario 3: Regular User → Platform Admin ✅

```
Transfer: User A (Starter, 3/3) → Platform Admin (unlimited)

Check:
  - Target: Platform Admin
  - isPlatformUser? YES
  - Bypass limit check
  
Result: ✅ Transfer succeeds (no limit check)
New state: Platform Admin owns tenant (unlimited)
```

### Scenario 4: Platform Admin → Platform Support ✅

```
Transfer: Platform Admin → Platform Support

Check:
  - Target: Platform Support
  - isPlatformUser? YES
  - Bypass limit check (Platform Support has global 3-tenant limit, not per-transfer)
  
Result: ✅ Transfer succeeds
Note: Platform Support's 3-tenant limit is checked at CREATION, not transfer
```

### Scenario 5: Regular User → Platform Viewer ❌

```
Transfer: User A (Starter, 3/3) → Platform Viewer

Check:
  - Target: Platform Viewer
  - isPlatformUser? YES, but role === 'PLATFORM_VIEWER'
  - Check limits (viewers should have 0)
  - Current: 0 owned tenants
  - Limit: 0 (read-only)
  - Can accept? NO (0 >= 0)
  
Result: ❌ Transfer blocked
Reason: Platform Viewers are read-only, cannot own tenants
```

### Scenario 6: User Upgrades Then Receives Transfer ✅

```
Initial: User B (Starter, 3/3 tenants)
  ↓
User B upgrades one tenant to Professional
  ↓
User B's effective tier: Professional (10 tenant limit)
  ↓
Transfer: User A → User B
  ↓
Check:
  - Target: User B (Regular User)
  - Current: 3 owned tenants
  - Limit: 10 (Professional tier)
  - Can accept? YES (3 < 10)
  
Result: ✅ Transfer succeeds
New state: User B owns 4 tenants (4/10)
```

---

## Error Response Format

### When Transfer is Blocked

```json
{
  "error": "tenant_limit_reached",
  "message": "Cannot transfer ownership: Target user has reached their limit. Upgrade to Professional to manage up to 10 locations",
  "current": 3,
  "limit": 3,
  "tier": "starter",
  "status": "active",
  "upgradeToTier": "professional",
  "upgradeMessage": "Upgrade to Professional to manage up to 10 locations"
}
```

**Alignment:** ✅ Matches platform-wide error response format

---

## Platform User Handling

### Platform Admin
- **Can receive:** Unlimited tenants ✅
- **Reason:** Operates across tenants, no limits
- **Check:** Bypassed

### Platform Support
- **Can receive:** Tenants via transfer ✅
- **Global limit:** 3 tenants total (checked at creation, not transfer)
- **Reason:** Support operations, limited scope
- **Check:** Bypassed (global limit enforced elsewhere)

### Platform Viewer
- **Can receive:** 0 tenants ❌
- **Reason:** Read-only role, cannot own
- **Check:** Enforced (should have 0 owned tenants)

---

## Regular User Handling

### Tier-Based Limits

| Tier | Limit | Transfer Allowed If |
|------|-------|-------------------|
| Trial | 1 | current < 1 |
| Google Only | 1 | current < 1 |
| Starter | 3 | current < 3 |
| Professional | 10 | current < 10 |
| Enterprise | 25 | current < 25 |
| Organization | ∞ | Always |

### Effective Tier Calculation

When checking destination owner's capacity:
1. Get all their owned tenants
2. Find highest tier among owned tenants
3. Use that tier's limit for the check

**Example:**
- User owns 3 tenants: 2 Starter, 1 Professional
- Effective tier: Professional (highest)
- Limit: 10 tenants
- Can receive more: YES (3 < 10)

---

## Security Verification

### Gap Closed ✅

**Before:**
```typescript
PUT /tenants/:tenantId/users/:userId { role: "OWNER" }
  ↓
Update role (no limit check)
  ↓
❌ Destination owner could exceed their tier limit
```

**After:**
```typescript
PUT /tenants/:tenantId/users/:userId { role: "OWNER" }
  ↓
Check if role === "OWNER"
  ↓
Check destination owner's capacity
  ↓
Block if at limit ❌
  ↓
Update role if within limit ✅
```

### Enforcement Points

1. **Tenant Creation** - `checkTenantCreationLimit` middleware
   - Checks creator's limits
   - ✅ Already enforced

2. **Ownership Transfer** - `PUT /tenants/:tenantId/users/:userId`
   - Checks destination owner's limits
   - ✅ NOW enforced (this fix)

3. **Role Changes (Non-Owner)** - Same endpoint
   - No limit check needed (not ownership transfer)
   - ✅ Correct behavior

---

## Testing Scenarios

### Test 1: Transfer to User at Limit
```
Setup:
  - User A: Starter (3/3 tenants)
  - User B: Starter (3/3 tenants)
  
Action:
  PUT /tenants/tenant-x/users/user-b { role: "OWNER" }
  
Expected:
  ❌ 403 Forbidden
  Error: tenant_limit_reached
  Message: "Cannot transfer ownership: Target user has reached their limit..."
```

### Test 2: Transfer to User with Capacity
```
Setup:
  - User A: Starter (3/3 tenants)
  - User B: Starter (2/3 tenants)
  
Action:
  PUT /tenants/tenant-x/users/user-b { role: "OWNER" }
  
Expected:
  ✅ 200 OK
  User B now owns 3 tenants (3/3)
```

### Test 3: Transfer to Platform Admin
```
Setup:
  - User A: Starter (3/3 tenants)
  - Platform Admin: Unlimited
  
Action:
  PUT /tenants/tenant-x/users/platform-admin { role: "OWNER" }
  
Expected:
  ✅ 200 OK
  Platform Admin owns tenant (no limit)
```

### Test 4: Transfer from Platform Admin to Regular User at Limit
```
Setup:
  - Platform Admin: Unlimited
  - User B: Starter (3/3 tenants)
  
Action:
  PUT /tenants/tenant-x/users/user-b { role: "OWNER" }
  
Expected:
  ❌ 403 Forbidden
  Error: tenant_limit_reached
```

### Test 5: Change Role to Non-Owner (No Limit Check)
```
Setup:
  - User B: Starter (3/3 tenants)
  
Action:
  PUT /tenants/tenant-x/users/user-b { role: "ADMIN" }
  
Expected:
  ✅ 200 OK (no limit check, not ownership transfer)
```

---

## Implementation Details

### File Modified
- `apps/api/src/routes/tenant-users.ts`

### Lines Added
- Import statements: Lines 9-10
- Ownership transfer check: Lines 175-256

### Dependencies
- `isPlatformUser()` - Check if user is platform role
- `getTenantLimitConfig()` - Get tier limit configuration
- `canCreateTenant()` - Check if user can accept another tenant

### Error Handling
- Returns 403 with detailed error message
- Includes upgrade path information
- Matches platform-wide error format

---

## Key Benefits

✅ **Security Gap Closed** - Ownership transfers now respect destination limits  
✅ **Consistent Enforcement** - Same limit logic as tenant creation  
✅ **Platform User Bypass** - Platform Admin/Support can receive unlimited  
✅ **Clear Error Messages** - Users know why transfer failed and how to fix  
✅ **Upgrade Path** - Error includes upgrade information  
✅ **Aligned with Standards** - Matches platform-wide error patterns  

---

## Related Documentation

- `docs/TENANT_LIMITS_IMPLEMENTATION_COMPLETE.md` - Full implementation
- `docs/TENANT_LIMITS_OWNERSHIP_CLARIFICATION.md` - Ownership scenarios
- `docs/TENANT_LIMITS_MIDDLEWARE_ALIGNMENT_VERIFICATION.md` - Verification report
- `apps/api/src/middleware/permissions.ts` - checkTenantCreationLimit()
- `apps/api/src/config/tenant-limits.ts` - Tier configurations

---

## Conclusion

**✅ GAP CLOSED** - Ownership transfers now properly enforce destination owner limits.

The system now checks limits at TWO critical points:
1. **Tenant Creation** - Creator's limits
2. **Ownership Transfer** - Destination owner's limits

This ensures no user can exceed their tier limits through either direct creation or ownership transfer! 🎉
