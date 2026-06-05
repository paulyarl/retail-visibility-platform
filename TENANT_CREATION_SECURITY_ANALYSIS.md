# Tenant Creation Security Analysis & Recommendations
**Date**: November 6, 2024  
**Status**: Security Review Required  
**Priority**: HIGH

---

## 🔍 Current Implementation Analysis

### **1. Tenant Creation Endpoints**

#### **A. Regular User Tenant Creation**
**Endpoint**: `POST /tenants`  
**File**: `apps/api/src/index.ts` (line 224)

```typescript
app.post("/tenants", authenticateToken, checkTenantCreationLimit, async (req, res) => {
  // Creates tenant with:
  // - subscriptionTier: 'starter' (HARDCODED)
  // - subscriptionStatus: 'trial'
  // - trialEndsAt: 30 days from now
  // - Links to user as OWNER
});
```

**Security Controls**:
- ✅ `authenticateToken` - Requires authentication
- ✅ `checkTenantCreationLimit` - Enforces tenant count limits
- ✅ Audit logging
- ✅ Auto-links to authenticated user as OWNER

**Limits Enforced**:
```typescript
ADMIN:  Infinity tenants
OWNER:  10 tenants
USER:   3 tenants
```

---

#### **B. Admin Tool Tenant Creation**
**Endpoint**: `POST /api/admin/tools/tenants`  
**File**: `apps/api/src/routes/admin-tools.ts` (line 117)

```typescript
router.post('/tenants', async (req, res) => {
  // Creates tenant with:
  // - subscriptionTier: req.body.subscriptionTier || 'professional'
  // - NO subscriptionStatus set
  // - NO trialEndsAt set
  // - NO user linking
  // - Can specify productCount and scenario
});
```

**Security Controls**:
- ✅ Requires admin authentication (enforced at route registration)
- ✅ Audit logging
- ❌ NO tier validation
- ❌ NO SKU limit enforcement
- ❌ NO organization validation
- ❌ NOT linked to any user

**Route Registration**:
```typescript
app.use('/api/admin/tools', authenticateToken, requireAdmin, adminToolsRoutes);
```

---

#### **C. Organization Tenant Creation**
**Endpoint**: `POST /organizations/:id/tenants`  
**File**: `apps/api/src/routes/organizations.ts` (line 179)

```typescript
router.post('/:id/tenants', async (req, res) => {
  // Adds existing tenant to organization
  // - Validates tenant exists
  // - Links tenant to organization
  // - NO tier validation
  // - NO limit checks
});
```

**Security Controls**:
- ❌ NO authentication middleware visible
- ❌ NO tier validation
- ❌ NO limit checks
- ❌ NO organization tier validation

---

### **2. Tier Update Endpoint**

**Endpoint**: `PATCH /tenants/:id`  
**File**: `apps/api/src/index.ts` (line 296)

```typescript
const patchTenantSchema = z.object({
  subscriptionTier: z.enum(['trial', 'starter', 'professional', 'enterprise']).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled']).optional(),
});

app.patch("/tenants/:id", authenticateToken, requireAdmin, async (req, res) => {
  // Updates tier with NO validation
  // - NO SKU limit checks
  // - NO organization validation
  // - NO 'organization' tier in enum
});
```

**Security Controls**:
- ✅ Requires admin authentication
- ❌ Missing 'organization' tier in enum
- ❌ NO SKU limit validation
- ❌ NO downgrade protection
- ❌ NO organization tier validation

---

## 🚨 CRITICAL SECURITY GAPS

### **Gap 1: No Tier Validation on Admin Creation**
**Severity**: HIGH

**Problem**:
```typescript
// Admin can create tenant with ANY tier, even invalid ones
subscriptionTier: z.string().optional().default('professional')
```

**Risk**:
- Admin could create tenant with tier='organization' but no organization
- Admin could create tenant with tier='enterprise' without proper setup
- No validation that tier matches actual capabilities

**Example Attack**:
```json
POST /api/admin/tools/tenants
{
  "name": "Test Store",
  "subscriptionTier": "organization",  // ❌ No organization linked!
  "productCount": 10000                 // ❌ No limit check!
}
```

---

### **Gap 2: No SKU Limit Enforcement on Creation**
**Severity**: HIGH

**Problem**:
Admin tool allows creating tenants with products but doesn't check tier limits:

```typescript
productCount: z.number().int().min(0).max(100).optional().default(0)
```

**Risk**:
- Can create 100 products on 'google_only' tier (limit: 250 SKUs)
- Can create 100 products on 'starter' tier (limit: 500 SKUs)
- No validation that productCount respects tier limits

**Example**:
```json
POST /api/admin/tools/tenants
{
  "name": "Test Store",
  "subscriptionTier": "google_only",  // Limit: 250 SKUs
  "productCount": 100,                // ✅ Allowed
  "scenario": "grocery"
}
```

But then:
```json
POST /api/v1/quick-start
{
  "tenantId": "tenant_123",
  "productCount": 200  // ❌ Now at 300 SKUs, over limit!
}
```

---

### **Gap 3: Organization Tier Not in Validation Schema**
**Severity**: MEDIUM

**Problem**:
```typescript
// PATCH /tenants/:id schema
subscriptionTier: z.enum(['trial', 'starter', 'professional', 'enterprise']).optional()
// ❌ Missing 'organization'!
```

**Risk**:
- Admin cannot set tier to 'organization' via PATCH endpoint
- Must use direct database update
- Inconsistent with tier definitions in `lib/tiers.ts`

---

### **Gap 4: No Organization Validation for Organization Tier**
**Severity**: HIGH

**Problem**:
No validation that:
1. Tenant with tier='organization' must belong to an organization
2. Organization must exist and be valid
3. Organization must have appropriate tier/plan

**Risk**:
```typescript
// This is currently possible:
await prisma.tenant.update({
  where: { id: 'tenant_123' },
  data: { subscriptionTier: 'organization' }
});
// ❌ No organizationId check!
// ❌ Tenant gets organization features without organization!
```

---

### **Gap 5: No Downgrade Protection**
**Severity**: MEDIUM

**Problem**:
Admin can downgrade tenant tier without checking:
- Current SKU count vs new tier limit
- Active features that require higher tier
- Organization membership

**Risk**:
```typescript
// Tenant has 5,000 SKUs on Professional tier
PATCH /tenants/tenant_123
{
  "subscriptionTier": "starter"  // Limit: 500 SKUs
}
// ❌ No validation! Tenant now over limit by 4,500 SKUs
```

---

### **Gap 6: No User Linking on Admin Creation**
**Severity**: MEDIUM

**Problem**:
Admin-created tenants have NO owner:

```typescript
// Admin tool creates tenant but doesn't link to any user
const tenant = await prisma.tenant.create({ ... });
// ❌ No UserTenant record created
// ❌ Orphaned tenant
```

**Risk**:
- Orphaned tenants with no owner
- No one can access the tenant
- No billing contact
- No responsibility assignment

---

### **Gap 7: No Subscription Status on Admin Creation**
**Severity**: MEDIUM

**Problem**:
```typescript
// Admin tool creates tenant with:
subscriptionTier: 'professional',
// ❌ NO subscriptionStatus
// ❌ NO trialEndsAt
```

**Risk**:
- Tenant has tier but no status (trial, active, past_due, canceled)
- Unclear billing state
- May bypass trial period checks

---

## 🛡️ RECOMMENDED SECURITY CONTROLS

### **Control 1: Tier Validation Middleware**

**Create**: `apps/api/src/middleware/tier-validation.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { TIER_LIMITS, SubscriptionTier } from '../lib/tiers';

export async function validateTierAssignment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier, organizationId } = req.body;
    
    if (!subscriptionTier) {
      return next();
    }

    // Validate tier exists
    const validTiers: SubscriptionTier[] = [
      'trial', 'google_only', 'starter', 'professional', 'enterprise', 'organization'
    ];
    
    if (!validTiers.includes(subscriptionTier)) {
      return res.status(400).json({
        error: 'invalid_tier',
        message: `Invalid subscription tier: ${subscriptionTier}`,
        validTiers,
      });
    }

    // Organization tier requires organization
    if (subscriptionTier === 'organization') {
      if (!organizationId && !req.params.organizationId) {
        return res.status(400).json({
          error: 'organization_required',
          message: 'Organization tier requires an organization',
        });
      }

      // Validate organization exists
      const orgId = organizationId || req.params.organizationId;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        return res.status(404).json({
          error: 'organization_not_found',
          message: 'Organization does not exist',
        });
      }

      // Validate organization has appropriate tier
      // (Add organization tier validation logic here)
    }

    next();
  } catch (error) {
    console.error('[validateTierAssignment] Error:', error);
    return res.status(500).json({
      error: 'tier_validation_failed',
      message: 'Failed to validate tier assignment',
    });
  }
}
```

---

### **Control 2: SKU Limit Validation Middleware**

**Create**: `apps/api/src/middleware/sku-limits.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { getSKULimit } from '../lib/tiers';

export async function validateSKULimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { tenantId, subscriptionTier, productCount } = req.body;
    
    if (!tenantId || !productCount) {
      return next();
    }

    // Get tenant's tier
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionTier: true },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant does not exist',
      });
    }

    const tier = subscriptionTier || tenant.subscriptionTier;
    const skuLimit = getSKULimit(tier);

    // Count current SKUs
    const currentCount = await prisma.inventoryItem.count({
      where: { tenantId },
    });

    // Check if adding products would exceed limit
    const totalAfter = currentCount + productCount;

    if (skuLimit !== Infinity && totalAfter > skuLimit) {
      return res.status(403).json({
        error: 'sku_limit_exceeded',
        message: `Adding ${productCount} products would exceed tier limit`,
        current: currentCount,
        limit: skuLimit,
        requested: productCount,
        totalAfter,
      });
    }

    next();
  } catch (error) {
    console.error('[validateSKULimits] Error:', error);
    return res.status(500).json({
      error: 'sku_validation_failed',
      message: 'Failed to validate SKU limits',
    });
  }
}
```

---

### **Control 3: Downgrade Protection Middleware**

**Create**: `apps/api/src/middleware/downgrade-protection.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { getSKULimit } from '../lib/tiers';

export async function protectDowngrade(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier } = req.body;
    const { id: tenantId } = req.params;
    
    if (!subscriptionTier || !tenantId) {
      return next();
    }

    // Get current tenant state
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionTier: true,
        _count: {
          select: { items: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant does not exist',
      });
    }

    // Check if this is a downgrade
    const tierOrder = ['trial', 'google_only', 'starter', 'professional', 'enterprise', 'organization'];
    const currentIndex = tierOrder.indexOf(tenant.subscriptionTier || 'trial');
    const newIndex = tierOrder.indexOf(subscriptionTier);

    if (newIndex < currentIndex) {
      // This is a downgrade - check SKU count
      const newLimit = getSKULimit(subscriptionTier);
      const currentCount = tenant._count.items;

      if (newLimit !== Infinity && currentCount > newLimit) {
        return res.status(403).json({
          error: 'downgrade_blocked',
          message: `Cannot downgrade: tenant has ${currentCount} SKUs, new tier limit is ${newLimit}`,
          current: currentCount,
          newLimit,
          currentTier: tenant.subscriptionTier,
          requestedTier: subscriptionTier,
        });
      }
    }

    next();
  } catch (error) {
    console.error('[protectDowngrade] Error:', error);
    return res.status(500).json({
      error: 'downgrade_protection_failed',
      message: 'Failed to validate downgrade',
    });
  }
}
```

---

### **Control 4: Update Tier Validation Schema**

**File**: `apps/api/src/index.ts` (line 292)

```typescript
// BEFORE:
const patchTenantSchema = z.object({
  subscriptionTier: z.enum(['trial', 'starter', 'professional', 'enterprise']).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled']).optional(),
});

// AFTER:
const patchTenantSchema = z.object({
  subscriptionTier: z.enum([
    'trial', 
    'google_only', 
    'starter', 
    'professional', 
    'enterprise', 
    'organization'  // ✅ Added
  ]).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
  organizationId: z.string().optional(),  // ✅ Added for organization tier
});
```

---

### **Control 5: Update Admin Tool Tenant Creation**

**File**: `apps/api/src/routes/admin-tools.ts` (line 107)

```typescript
// BEFORE:
const createTenantSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  subscriptionTier: z.string().optional().default('professional'),
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']).optional().default('general'),
  productCount: z.number().int().min(0).max(100).optional().default(0),
  createAsDrafts: z.boolean().optional().default(true),
});

// AFTER:
const createTenantSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  subscriptionTier: z.enum([
    'trial',
    'google_only',
    'starter',
    'professional',
    'enterprise',
    'organization'  // ✅ Added with validation
  ]).optional().default('professional'),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled']).optional().default('trial'),  // ✅ Added
  organizationId: z.string().optional(),  // ✅ Required for organization tier
  ownerId: z.string().optional(),  // ✅ Added to link to user
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']).optional().default('general'),
  productCount: z.number().int().min(0).max(100).optional().default(0),
  createAsDrafts: z.boolean().optional().default(true),
});

router.post('/tenants', validateTierAssignment, validateSKULimits, async (req, res) => {
  // ... existing code ...
  
  // ✅ Link to owner if provided
  if (parsed.data.ownerId) {
    await prisma.userTenant.create({
      data: {
        userId: parsed.data.ownerId,
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });
  }
  
  // ✅ Link to organization if organization tier
  if (parsed.data.subscriptionTier === 'organization' && parsed.data.organizationId) {
    await prisma.organizationTenant.create({
      data: {
        organizationId: parsed.data.organizationId,
        tenantId: tenant.id,
      },
    });
  }
});
```

---

### **Control 6: Add Organization Validation**

**File**: `apps/api/src/routes/organizations.ts` (line 179)

```typescript
// BEFORE:
router.post('/:id/tenants', async (req, res) => {
  // No authentication, no validation
});

// AFTER:
router.post('/:id/tenants', authenticateToken, requireOrganizationAdmin, async (req, res) => {
  try {
    const { id: organizationId } = req.params;
    const { tenantId } = req.body;

    // Validate organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return res.status(404).json({
        error: 'organization_not_found',
        message: 'Organization does not exist',
      });
    }

    // Validate tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant does not exist',
      });
    }

    // Validate tenant tier is compatible with organization
    if (tenant.subscriptionTier === 'organization') {
      // Already an organization tenant - check if already in another org
      const existingLink = await prisma.organizationTenant.findFirst({
        where: { tenantId },
      });

      if (existingLink && existingLink.organizationId !== organizationId) {
        return res.status(400).json({
          error: 'tenant_already_in_organization',
          message: 'Tenant already belongs to another organization',
        });
      }
    }

    // Create link
    await prisma.organizationTenant.create({
      data: {
        organizationId,
        tenantId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[POST /:id/tenants] Error:', error);
    res.status(500).json({ error: 'failed_to_add_tenant' });
  }
});
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Critical Security (Immediate)**
- [ ] Add 'organization' to PATCH tenant tier enum
- [ ] Create `validateTierAssignment` middleware
- [ ] Apply tier validation to admin tool tenant creation
- [ ] Add organizationId validation for organization tier
- [ ] Add authentication to organization tenant endpoints

### **Phase 2: Limit Enforcement (This Week)**
- [ ] Create `validateSKULimits` middleware
- [ ] Apply SKU validation to admin tool tenant creation
- [ ] Apply SKU validation to quick-start endpoints
- [ ] Add SKU validation to bulk seed operations

### **Phase 3: Downgrade Protection (This Week)**
- [ ] Create `protectDowngrade` middleware
- [ ] Apply to PATCH tenant endpoint
- [ ] Add warning UI when admin attempts downgrade
- [ ] Add force-downgrade option with confirmation

### **Phase 4: User Linking (Next Week)**
- [ ] Add ownerId to admin tool tenant creation schema
- [ ] Auto-create UserTenant link when ownerId provided
- [ ] Add UI to assign owner during admin tenant creation
- [ ] Add orphaned tenant detection and cleanup

### **Phase 5: Status Management (Next Week)**
- [ ] Add subscriptionStatus to admin tool creation
- [ ] Set default status based on tier
- [ ] Add trial period management
- [ ] Add expiration checks

---

## 🎯 PRIORITY RECOMMENDATIONS

### **CRITICAL (Do Immediately)**:
1. ✅ Add 'organization' to tier enum in PATCH endpoint
2. ✅ Add tier validation middleware
3. ✅ Validate organization tier requires organization
4. ✅ Add authentication to organization endpoints

### **HIGH (Do This Week)**:
5. ✅ Add SKU limit validation
6. ✅ Add downgrade protection
7. ✅ Update admin tool schema with proper enums

### **MEDIUM (Do Next Week)**:
8. ✅ Add user linking to admin creation
9. ✅ Add subscription status management
10. ✅ Add orphaned tenant detection

---

## 🔒 SECURITY BEST PRACTICES

### **1. Principle of Least Privilege**
- Regular users: Limited tenant creation (3-10 tenants)
- Admins: Unlimited but with validation
- Organization admins: Can only manage their organization

### **2. Defense in Depth**
- Multiple validation layers (schema, middleware, business logic)
- Tier validation at creation AND update
- SKU limits enforced at multiple points

### **3. Audit Trail**
- All tenant creation logged
- All tier changes logged
- All organization changes logged

### **4. Fail Secure**
- Default to most restrictive tier (starter)
- Require explicit organization for organization tier
- Block operations that would violate limits

---

## 📊 RISK ASSESSMENT

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|
| Tenant created with invalid tier | HIGH | MEDIUM | HIGH | Tier validation middleware |
| SKU limits bypassed | HIGH | HIGH | HIGH | SKU validation middleware |
| Organization tier without org | HIGH | MEDIUM | HIGH | Organization validation |
| Orphaned tenants | MEDIUM | HIGH | MEDIUM | User linking required |
| Downgrade breaks functionality | MEDIUM | MEDIUM | MEDIUM | Downgrade protection |
| Unauthorized tier changes | LOW | LOW | HIGH | Admin-only with audit |

---

## 🎉 EXPECTED OUTCOMES

After implementing these controls:

1. **✅ Tier Integrity**: All tenants have valid, consistent tiers
2. **✅ Limit Enforcement**: SKU limits respected at all times
3. **✅ Organization Validation**: Organization tier requires organization
4. **✅ User Accountability**: All tenants linked to owners
5. **✅ Audit Trail**: Complete history of tier changes
6. **✅ Downgrade Safety**: No data loss from tier downgrades

---

**Document Version**: 1.0  
**Created**: 2024-11-06  
**Status**: Awaiting Implementation  
**Priority**: HIGH - Security Critical
