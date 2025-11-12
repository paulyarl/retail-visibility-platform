# Propagation Backend Alignment Verification

**Date:** November 12, 2025  
**Issue:** Frontend shows tiered propagation (Starter+), but backend may still require Organization tier  
**Status:** ⚠️ NEEDS ALIGNMENT

---

## 🔍 Current Backend Implementation

### **Propagation API Routes Found:**

**File:** `apps/api/src/routes/organizations.ts`

1. **Product Propagation**
   ```typescript
   // POST /organizations/:id/items/propagate
   router.post('/:id/items/propagate', requireSupportActions, async (req, res) => {
   ```
   - **Middleware:** `requireSupportActions` (Platform Admin or Platform Support)
   - **Permission:** Platform-level only
   - **Issue:** ❌ Not accessible to regular Starter tier users

2. **Bulk Product Propagation**
   ```typescript
   // POST /organizations/:id/items/propagate-bulk
   router.post('/:id/items/propagate-bulk', requireSupportActions, async (req, res) => {
   ```
   - **Middleware:** `requireSupportActions`
   - **Issue:** ❌ Not accessible to regular Starter tier users

---

**File:** `apps/api/src/routes/tenant-categories.ts`

3. **Category Propagation**
   ```typescript
   // POST /api/v1/tenants/:tenantId/categories/propagate
   router.post('/:tenantId/categories/propagate', requireSupportActions, async (req, res) => {
   ```
   - **Middleware:** `requireSupportActions`
   - **Tier Check:** Requires `organizationId` (line 694)
   - **Issue:** ❌ Requires organization, not just 2+ locations

4. **Feature Flags Propagation**
   ```typescript
   // POST /api/v1/tenants/:tenantId/feature-flags/propagate
   router.post('/:tenantId/feature-flags/propagate', requirePlatformAdmin, async (req, res) => {
   ```
   - **Middleware:** `requirePlatformAdmin`
   - **Issue:** ❌ Platform admin only

5. **Business Hours Propagation**
   ```typescript
   // POST /api/v1/tenants/:tenantId/business-hours/propagate
   router.post('/:tenantId/business-hours/propagate', requireSupportActions, async (req, res) => {
   ```
   - **Middleware:** `requireSupportActions`
   - **Issue:** ❌ Not accessible to regular users

6. **User Roles Propagation**
   ```typescript
   // POST /api/v1/tenants/:tenantId/user-roles/propagate
   router.post('/:tenantId/user-roles/propagate', requirePlatformAdmin, async (req, res) => {
   ```
   - **Middleware:** `requirePlatformAdmin`
   - **Issue:** ❌ Platform admin only

7. **Brand Assets Propagation**
   ```typescript
   // POST /api/v1/tenants/:tenantId/brand-assets/propagate
   router.post('/:tenantId/brand-assets/propagate', requirePlatformAdmin, async (req, res) => {
   ```
   - **Middleware:** `requirePlatformAdmin`
   - **Issue:** ✅ Correct (Organization tier only)

8. **Business Profile Propagation**
   ```typescript
   // POST /api/v1/tenants/:tenantId/business-profile/propagate
   router.post('/:tenantId/business-profile/propagate', requirePlatformAdmin, async (req, res) => {
   ```
   - **Middleware:** `requirePlatformAdmin`
   - **Issue:** ❌ Should be accessible to Professional tier

---

## ❌ **CRITICAL MISALIGNMENT**

### **Frontend Says:**
- ✅ Starter tier: Products + User Roles propagation
- ✅ Professional tier: + Hours, Profile, Categories, GBP, Flags
- ✅ Organization tier: + Brand Assets, Advanced features

### **Backend Reality:**
- ❌ **ALL propagation routes** require Platform Admin or Platform Support
- ❌ **Regular users CANNOT use propagation** at any tier
- ❌ **Organization requirement** hardcoded in several routes

---

## 🔧 Required Backend Changes

### **1. Create New Middleware: `requireTenantAdmin`**

**File:** `apps/api/src/middleware/auth.ts` or new file

```typescript
/**
 * Middleware to check if user is tenant admin/owner
 * Used for tenant-level propagation operations
 */
export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const tenantId = req.params.tenantId || req.params.id;
  
  if (!user) {
    return res.status(401).json({ 
      error: 'authentication_required',
      message: 'Not authenticated' 
    });
  }

  // Platform admins can always access
  if (isPlatformAdmin(user)) {
    return next();
  }

  // Check if user is OWNER or ADMIN of this tenant
  const userTenant = user.tenants?.find((ut: any) => ut.tenantId === tenantId);
  if (!userTenant || (userTenant.role !== 'OWNER' && userTenant.role !== 'ADMIN')) {
    return res.status(403).json({
      error: 'tenant_admin_required',
      message: 'Tenant owner or administrator access required'
    });
  }

  next();
}
```

---

### **2. Create Tier Validation Middleware**

**File:** `apps/api/src/middleware/tier-validation.ts` (new)

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

/**
 * Middleware to check if tenant has required tier for propagation
 */
export async function requirePropagationTier(
  propagationType: 'products' | 'user_roles' | 'hours' | 'profile' | 'categories' | 'gbp' | 'flags' | 'brand_assets'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.params.tenantId || req.params.id;
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionTier: true,
        organizationId: true,
        organization: {
          select: {
            subscriptionTier: true,
            _count: { select: { tenants: true } }
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Get effective tier (org tier overrides tenant tier)
    const effectiveTier = tenant.organization?.subscriptionTier || tenant.subscriptionTier || 'starter';
    
    // Check if user has 2+ locations
    const locationCount = tenant.organization?._count.tenants || 1;
    if (locationCount < 2) {
      return res.status(403).json({
        error: 'insufficient_locations',
        message: 'Propagation requires 2 or more locations',
        currentLocations: locationCount,
        requiredLocations: 2
      });
    }

    // Define tier requirements for each propagation type
    const tierRequirements: Record<string, string[]> = {
      products: ['starter', 'professional', 'enterprise', 'organization'],
      user_roles: ['starter', 'professional', 'enterprise', 'organization'],
      hours: ['professional', 'enterprise', 'organization'],
      profile: ['professional', 'enterprise', 'organization'],
      categories: ['professional', 'enterprise', 'organization'],
      gbp: ['professional', 'enterprise', 'organization'],
      flags: ['professional', 'enterprise', 'organization'],
      brand_assets: ['organization']
    };

    const allowedTiers = tierRequirements[propagationType] || [];
    if (!allowedTiers.includes(effectiveTier)) {
      return res.status(403).json({
        error: 'tier_upgrade_required',
        message: `${propagationType} propagation requires ${allowedTiers[0]} tier or higher`,
        currentTier: effectiveTier,
        requiredTier: allowedTiers[0],
        propagationType
      });
    }

    next();
  };
}
```

---

### **3. Update Product Propagation Routes**

**File:** `apps/api/src/routes/organizations.ts`

**BEFORE:**
```typescript
router.post('/:id/items/propagate', requireSupportActions, async (req, res) => {
```

**AFTER:**
```typescript
router.post('/:id/items/propagate', 
  requireTenantAdmin, 
  requirePropagationTier('products'), 
  async (req, res) => {
```

---

### **4. Update All Propagation Routes**

**File:** `apps/api/src/routes/tenant-categories.ts`

| Route | Old Middleware | New Middleware |
|-------|---------------|----------------|
| `/categories/propagate` | `requireSupportActions` | `requireTenantAdmin, requirePropagationTier('categories')` |
| `/feature-flags/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('flags')` |
| `/business-hours/propagate` | `requireSupportActions` | `requireTenantAdmin, requirePropagationTier('hours')` |
| `/user-roles/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('user_roles')` |
| `/brand-assets/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('brand_assets')` |
| `/business-profile/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('profile')` |

---

### **5. Remove Organization Requirement**

**File:** `apps/api/src/routes/tenant-categories.ts` (and similar files)

**BEFORE (line 694):**
```typescript
if (!tenant.organizationId) {
  return res.status(400).json({
    success: false,
    error: 'Tenant is not part of an organization',
  });
}
```

**AFTER:**
```typescript
// Check if user has multiple locations (via organization or owned tenants)
const userTenantCount = await prisma.userTenant.count({
  where: {
    userId: req.user.userId,
    role: { in: ['OWNER', 'ADMIN'] }
  }
});

if (userTenantCount < 2) {
  return res.status(400).json({
    success: false,
    error: 'Propagation requires 2 or more locations',
    message: 'You need at least 2 locations to use propagation features',
    currentLocations: userTenantCount
  });
}
```

---

## 📋 Implementation Checklist

### **Phase 1: Middleware (Day 1)**
- [ ] Create `requireTenantAdmin` middleware
- [ ] Create `requirePropagationTier` middleware
- [ ] Test middleware with different user roles
- [ ] Test middleware with different tiers

### **Phase 2: Product Propagation (Day 2)**
- [ ] Update `/organizations/:id/items/propagate`
- [ ] Update `/organizations/:id/items/propagate-bulk`
- [ ] Remove organization requirement
- [ ] Add 2+ location check
- [ ] Test with Starter tier users

### **Phase 3: Other Propagation Types (Day 3)**
- [ ] Update categories propagation
- [ ] Update hours propagation
- [ ] Update profile propagation
- [ ] Update user roles propagation
- [ ] Test with Professional tier users

### **Phase 4: Organization-Only Features (Day 4)**
- [ ] Keep brand assets as Organization-only
- [ ] Keep feature flags as Platform Admin-only (security)
- [ ] Test with Organization tier users

### **Phase 5: Testing & Deployment (Day 5)**
- [ ] Integration tests for all tiers
- [ ] Test error messages
- [ ] Test upgrade prompts
- [ ] Deploy to staging
- [ ] Deploy to production

---

## 🎯 Expected Behavior After Changes

### **Starter Tier User (3 locations)**
```bash
# ✅ Should work
POST /organizations/:id/items/propagate
POST /organizations/:id/items/propagate-bulk

# ❌ Should fail with tier upgrade message
POST /tenants/:id/categories/propagate
POST /tenants/:id/business-hours/propagate
```

### **Professional Tier User (10 locations)**
```bash
# ✅ Should work
POST /organizations/:id/items/propagate
POST /tenants/:id/categories/propagate
POST /tenants/:id/business-hours/propagate
POST /tenants/:id/business-profile/propagate

# ❌ Should fail with tier upgrade message
POST /tenants/:id/brand-assets/propagate
```

### **Organization Tier User (unlimited locations)**
```bash
# ✅ All should work
POST /organizations/:id/items/propagate
POST /tenants/:id/categories/propagate
POST /tenants/:id/brand-assets/propagate
POST /tenants/:id/business-profile/propagate
```

---

## ⚠️ Security Considerations

### **Keep Platform Admin-Only:**
- `POST /tenants/:id/feature-flags/propagate` - Affects feature access (security risk)

### **Allow Tenant Admins:**
- All other propagation types (products, categories, hours, profile, user roles, brand assets)

### **Tier Gating:**
- Starter: Products, User Roles
- Professional: + Hours, Profile, Categories, GBP, Flags
- Organization: + Brand Assets, Advanced features

---

## 📊 Impact Analysis

### **Before (Current State)**
- ❌ Only Platform Admins/Support can propagate
- ❌ Regular users see UI but can't use it
- ❌ Frustrating user experience
- ❌ Support tickets: "Why can't I propagate?"

### **After (Aligned State)**
- ✅ Starter users can propagate products
- ✅ Professional users can propagate full suite
- ✅ Organization users get advanced features
- ✅ Clear tier-based error messages
- ✅ Reduced support tickets

---

## 🚨 **CRITICAL: Frontend/Backend Mismatch**

**Current Status:**
- Frontend: ✅ Shows tiered propagation (Starter+)
- Backend: ❌ Requires Platform Admin/Support

**This MUST be fixed before deployment to avoid:**
- User frustration (UI shows feature they can't use)
- Support tickets
- Negative reviews
- Churn

---

## 📝 Recommended Action

**Option 1: Fix Backend (Recommended)**
- Implement all changes above
- Align backend with frontend strategy
- Enable tiered propagation for all users
- Timeline: 3-5 days

**Option 2: Revert Frontend**
- Change frontend back to Organization-only
- Keep current backend implementation
- Timeline: 1 day
- ❌ Loses strategic "hook" advantage

**Option 3: Hybrid Approach**
- Keep frontend as-is (shows tiered features)
- Add backend checks that show upgrade prompts
- Users see features but get clear upgrade messages
- Timeline: 2-3 days
- ⚠️ Still frustrating for users

---

## ✅ Recommendation: **Option 1 - Fix Backend**

**Why:**
- Aligns with strategic "hook" approach
- Provides real value to Starter tier users
- Creates natural upgrade path
- Reduces support burden
- Improves user satisfaction

**Estimated Effort:** 3-5 days
**Priority:** High (blocks effective propagation rollout)

---

**Status:** ⚠️ BACKEND ALIGNMENT REQUIRED BEFORE PRODUCTION DEPLOYMENT
