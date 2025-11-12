# Propagation Backend Implementation Progress

**Started:** November 12, 2025 5:56am  
**Goal:** Align backend with tiered propagation strategy

---

## ✅ Completed (2/8)

### 1. requireTenantAdmin Middleware ✅
**File:** `apps/api/src/middleware/auth.ts`
- Added `requireTenantAdmin` function
- Checks if user is OWNER or ADMIN of tenant
- Platform admins bypass check
- **Status:** DONE

### 2. requirePropagationTier Middleware ✅
**File:** `apps/api/src/middleware/tier-validation.ts`
- Added `requirePropagationTier` middleware factory
- Validates tier requirements for each propagation type
- Checks for 2+ locations
- Returns clear upgrade messages
- **Status:** DONE

---

## 🔄 In Progress (0/6)

### 3. Product Propagation Routes
**File:** `apps/api/src/routes/organizations.ts`
- Update `/organizations/:id/items/propagate`
- Update `/organizations/:id/items/propagate-bulk`
- Change from `requireSupportActions` to `requireTenantAdmin + requirePropagationTier('products')`
- **Status:** PENDING

### 4. Category Propagation
**File:** `apps/api/src/routes/tenant-categories.ts`
- Update `/tenants/:tenantId/categories/propagate`
- Change middleware
- Remove organization requirement
- **Status:** PENDING

### 5. Hours Propagation
**File:** `apps/api/src/routes/tenant-categories.ts`
- Update `/tenants/:tenantId/business-hours/propagate`
- Change middleware
- **Status:** PENDING

### 6. User Roles Propagation
**File:** `apps/api/src/routes/tenant-categories.ts`
- Update `/tenants/:tenantId/user-roles/propagate`
- Change middleware
- **Status:** PENDING

### 7. Profile & Brand Assets
**File:** `apps/api/src/routes/tenant-categories.ts`
- Update `/tenants/:tenantId/business-profile/propagate`
- Update `/tenants/:tenantId/brand-assets/propagate`
- Change middleware
- **Status:** PENDING

### 8. Feature Flags (Keep Platform Admin Only)
**File:** `apps/api/src/routes/tenant-categories.ts`
- Keep `/tenants/:tenantId/feature-flags/propagate` as Platform Admin only
- Add comment explaining security reason
- **Status:** PENDING

---

## Middleware Changes Summary

| Route | Old Middleware | New Middleware |
|-------|---------------|----------------|
| `/organizations/:id/items/propagate` | `requireSupportActions` | `requireTenantAdmin, requirePropagationTier('products')` |
| `/organizations/:id/items/propagate-bulk` | `requireSupportActions` | `requireTenantAdmin, requirePropagationTier('products')` |
| `/tenants/:id/categories/propagate` | `requireSupportActions` | `requireTenantAdmin, requirePropagationTier('categories')` |
| `/tenants/:id/business-hours/propagate` | `requireSupportActions` | `requireTenantAdmin, requirePropagationTier('hours')` |
| `/tenants/:id/user-roles/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('user_roles')` |
| `/tenants/:id/business-profile/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('profile')` |
| `/tenants/:id/brand-assets/propagate` | `requirePlatformAdmin` | `requireTenantAdmin, requirePropagationTier('brand_assets')` |
| `/tenants/:id/feature-flags/propagate` | `requirePlatformAdmin` | `requirePlatformAdmin` (NO CHANGE - security) |

---

## Next Steps

1. Update organizations.ts (product propagation)
2. Update tenant-categories.ts (all other propagation types)
3. Test with different tiers
4. Deploy to staging
5. Test in staging
6. Deploy to production

**Estimated Time Remaining:** 2-3 hours
