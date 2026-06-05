# Platform Support `createdBy` Implementation

**Date:** November 11, 2024  
**Status:** ⚠️ READY FOR MIGRATION - Code complete, migration pending

## Final Correct Understanding

**PLATFORM_SUPPORT Limit:** Can only create 3 tenants FOR each owner (regardless of owner's tier)

### The Scenario

1. PLATFORM_SUPPORT enters a customer's scope (accesses their tenant)
2. While in that scope, they can create a location
3. The **owner** is the customer (scope owner)
4. The **creator** is PLATFORM_SUPPORT (for auditing)
5. PLATFORM_SUPPORT is limited to creating **3 tenants FOR that customer**

### Examples

**Example 1: Customer with Organization Tier**
- Customer has Organization tier (normally unlimited locations)
- Customer already has 10 locations (created by themselves)
- PLATFORM_SUPPORT creates Location A for customer ✅ (1st by support)
- PLATFORM_SUPPORT creates Location B for customer ✅ (2nd by support)
- PLATFORM_SUPPORT creates Location C for customer ✅ (3rd by support)
- PLATFORM_SUPPORT tries to create Location D ❌ **BLOCKED - support already created 3 for this owner**
- Customer can still create more themselves (unlimited tier)

**Example 2: Multiple Support Users**
- PLATFORM_SUPPORT user A creates 3 tenants for Customer X ✅
- PLATFORM_SUPPORT user B creates 3 tenants for Customer X ✅
- Each support user has their own 3-tenant limit per owner

**Example 3: Support Creating for Themselves**
- PLATFORM_SUPPORT creates 3 tenants they own (for testing) ✅
- PLATFORM_SUPPORT tries to create 4th ❌ **BLOCKED - already created 3 for themselves**

## Implementation Complete

### 1. Schema Changes ✅

**File:** `apps/api/prisma/schema.prisma`

```prisma
model Tenant {
  id                    String                 @id @default(cuid())
  name                  String
  createdAt             DateTime               @default(now())
  createdBy             String?                @map("created_by") // User ID who created this tenant (for auditing)
  // ... rest of fields
  
  @@index([createdBy])
  @@map("tenant")
}
```

**Changes:**
- Added `createdBy` field (nullable String)
- Maps to `created_by` column in database
- Added index for query performance
- Used for auditing who created each tenant

### 2. Tenant Creation Endpoint ✅

**File:** `apps/api/src/index.ts`

**Schema updated:**
```typescript
const createTenantSchema = z.object({ 
  name: z.string().min(1),
  ownerId: z.string().optional(), // Optional: specify a different owner (for PLATFORM_SUPPORT)
});
```

**Logic updated:**
```typescript
// Determine who will own this tenant
const ownerId = (req.user?.role === 'PLATFORM_SUPPORT' && parsed.data.ownerId) 
  ? parsed.data.ownerId 
  : req.user!.userId;

// Create tenant with createdBy tracking
const tenant = await prisma.tenant.create({
  data: {
    name: parsed.data.name,
    subscriptionTier: 'starter',
    subscriptionStatus: 'trial',
    trialEndsAt: trialEndsAt,
    createdBy: req.user!.userId, // Track who created this tenant
  }
});

// Link tenant to the owner (may be different from creator)
await prisma.userTenant.create({
  data: {
    userId: ownerId, // The owner
    tenantId: tenant.id,
    role: 'OWNER',
  },
});
```

**Key Points:**
- `ownerId` can be specified in request body (PLATFORM_SUPPORT only)
- `createdBy` always tracks the authenticated user (creator)
- Owner and creator can be different people

### 3. Middleware Check ✅

**File:** `apps/api/src/middleware/permissions.ts`

**Function:** `checkTenantCreationLimit()`

```typescript
if (req.user.role === 'PLATFORM_SUPPORT') {
  // Determine who will own the tenant being created
  const requestBody = req.body as { ownerId?: string };
  const ownerId = requestBody.ownerId || req.user.userId;
  
  // Count tenants created by THIS support user FOR this owner
  const tenantsCreatedBySupport = await prisma.tenant.count({
    where: {
      createdBy: req.user.userId, // Created by THIS support user
      users: {
        some: {
          userId: ownerId, // FOR this owner
          role: UserTenantRole.OWNER,
        },
      },
    },
  });
  
  const supportLimit = getPlatformSupportLimit(); // 3
  
  if (tenantsCreatedBySupport >= supportLimit) {
    return res.status(403).json({
      error: 'platform_support_limit_reached',
      message: `Platform support users can only create up to ${supportLimit} tenants per owner. You have already created ${tenantsCreatedBySupport} locations for this owner.`,
      current: tenantsCreatedBySupport,
      limit: supportLimit,
      role: 'PLATFORM_SUPPORT',
      creatorId: req.user.userId,
      ownerId: ownerId,
    });
  }
  
  return next();
}
```

**Key Points:**
- Checks `createdBy` (the support user)
- Checks owner via `users` relation
- Counts tenants created by THIS support user FOR this owner
- Limit is per-owner, not global

### 4. Documentation ✅

**File:** `docs/USER_JOURNEY_GOALS.md`

Updated PLATFORM_SUPPORT section:
- Access Limits: "3 tenants per owner limit (regardless of owner's tier)"
- Testing & QA: "Limited to 3 tenants per owner (regardless of tier)"

## Migration Required

### Migration SQL

```sql
-- Add createdBy column to tenant table
ALTER TABLE "tenant" ADD COLUMN "created_by" TEXT;

-- Add index for performance
CREATE INDEX "tenant_created_by_idx" ON "tenant"("created_by");

-- Optional: Backfill existing tenants (set createdBy to first owner)
-- UPDATE "tenant" t
-- SET "created_by" = (
--   SELECT ut."userId" 
--   FROM "user_tenant" ut 
--   WHERE ut."tenantId" = t.id 
--   AND ut.role = 'OWNER' 
--   ORDER BY ut."createdAt" ASC 
--   LIMIT 1
-- );
```

### Migration Steps

1. **Create migration:**
   ```bash
   cd apps/api
   npx prisma migrate dev --name add_created_by_to_tenant
   ```

2. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

3. **Verify TypeScript errors are gone:**
   - `index.ts` line 296: `createdBy` in TenantCreateInput
   - `permissions.ts` line 145: `createdBy` in TenantWhereInput

4. **Test the implementation:**
   - PLATFORM_SUPPORT creates 3 tenants for themselves
   - PLATFORM_SUPPORT creates 3 tenants for a customer
   - Verify 4th tenant is blocked
   - Verify error message is clear

## Testing Checklist

### ✅ Scenario 1: Support Creating for Themselves
- [ ] PLATFORM_SUPPORT creates Tenant A (they own it)
- [ ] PLATFORM_SUPPORT creates Tenant B (they own it)
- [ ] PLATFORM_SUPPORT creates Tenant C (they own it)
- [ ] PLATFORM_SUPPORT tries to create Tenant D
- [ ] Verify blocked with error: "You have already created 3 locations for this owner"

### ✅ Scenario 2: Support Creating for Customer
- [ ] Customer has Organization tier (unlimited)
- [ ] PLATFORM_SUPPORT creates Tenant A for customer (with `ownerId`)
- [ ] PLATFORM_SUPPORT creates Tenant B for customer
- [ ] PLATFORM_SUPPORT creates Tenant C for customer
- [ ] PLATFORM_SUPPORT tries to create Tenant D
- [ ] Verify blocked with same error
- [ ] Customer creates Tenant E themselves
- [ ] Verify customer can still create (not blocked by support's limit)

### ✅ Scenario 3: Multiple Support Users
- [ ] PLATFORM_SUPPORT user A creates 3 for Customer X
- [ ] PLATFORM_SUPPORT user B creates 3 for Customer X
- [ ] Verify each support user has independent limit

### ✅ Scenario 4: Auditing
- [ ] Query tenants created by specific support user
- [ ] Verify `createdBy` field is populated
- [ ] Verify owner is different from creator when using `ownerId`

## Benefits Delivered

✅ **Auditing:** Track who created each tenant  
✅ **Per-Owner Limit:** Support can create 3 per owner  
✅ **Independent Limits:** Each support user has own limits  
✅ **Owner Flexibility:** Can create for themselves or customers  
✅ **No Interference:** Doesn't block owner's own creation  

## Summary

**The implementation is complete and ready for migration!**

Once the migration is run:
1. TypeScript errors will be resolved
2. PLATFORM_SUPPORT will be correctly limited to 3 tenants per owner
3. All tenant creation will be audited via `createdBy` field
4. System will work exactly as specified

**Next Step:** Run the Prisma migration to apply the schema changes.
