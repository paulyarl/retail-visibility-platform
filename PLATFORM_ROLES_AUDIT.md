# Platform Roles Access Control Audit

**Date:** November 7, 2025  
**Status:** 🔴 Needs Updates  
**Objective:** Ensure new platform roles (SUPPORT, VIEWER) have appropriate access

---

## 🎯 Summary

The new `PLATFORM_SUPPORT` and `PLATFORM_VIEWER` roles are **partially integrated** but need refinement:

✅ **Working:** `checkTenantAccess()` - All platform users can view all tenants  
⚠️ **Needs Update:** Many endpoints use `isPlatformAdmin()` for **viewing** operations that should allow SUPPORT/VIEWER  
❌ **Missing:** Distinction between view-only and modify operations

---

## 📊 Current State

### Middleware Status

| Middleware | Current Behavior | Should Allow |
|------------|------------------|--------------|
| `checkTenantAccess()` | ✅ All platform roles | ✅ Correct |
| `requirePlatformAdmin()` | ❌ Only ADMIN | ❌ Too restrictive |
| `requireTenantOwner()` | ❌ Only ADMIN | ❌ Too restrictive |

### Route Checks Status

| Route | Operation | Current Check | Should Be |
|-------|-----------|---------------|-----------|
| **scan.ts** |
| `hasAccessToTenant()` | View tenant data | `isPlatformAdmin()` | ✅ Correct (modify only) |
| `/admin/enrichment/cache-stats` | View stats | `isPlatformAdmin()` | `canViewAllTenants()` |
| `/admin/enrichment/rate-limits` | View limits | `isPlatformAdmin()` | `canViewAllTenants()` |
| `/admin/enrichment/clear-cache` | Clear cache | `isPlatformAdmin()` | ✅ Correct (modify) |
| `/admin/enrichment/analytics` | View analytics | `isPlatformAdmin()` | `canViewAllTenants()` |
| `/admin/enrichment/search` | Search products | `isPlatformAdmin()` | `canViewAllTenants()` |
| `/admin/enrichment/:barcode` | View product | `isPlatformAdmin()` | `canViewAllTenants()` |
| Tenant analytics | View analytics | `isPlatformAdmin()` | ✅ Correct (in hasAccessToTenant) |
| **scan-metrics.ts** |
| `/admin/scan-metrics` | View metrics | `isPlatformAdmin()` | `canViewAllTenants()` |
| `/admin/scan-metrics/timeseries` | View timeseries | `isPlatformAdmin()` | `canViewAllTenants()` |
| **quick-start.ts** |
| POST `/quick-start/:tenantId` | Create products | `isPlatformAdmin()` | ✅ Correct (modify) |
| GET `/quick-start/:tenantId/eligibility` | View eligibility | `isPlatformAdmin()` | `canViewAllTenants()` |
| POST `/quick-start/:tenantId/categories` | Create categories | `isPlatformAdmin()` | ✅ Correct (modify) |
| **permissions.ts** |
| `requireTenantRole()` | Check tenant role | `isPlatformAdmin()` | ✅ Correct (bypass) |
| `requireTenantOwnership()` | Create tenant | `isPlatformAdmin()` | ✅ Correct (bypass) |
| `requireTenantDeletion()` | Delete tenant | `isPlatformAdmin()` | ✅ Correct (modify) |

---

## 🔍 Detailed Analysis

### 1. View Operations (Should Allow SUPPORT + VIEWER)

These endpoints are **read-only** and should allow all platform users:

#### scan.ts
- ✅ **Line 28:** `hasAccessToTenant()` - Already correct (used for modify operations)
- ⚠️ **Line 637:** `/admin/enrichment/cache-stats` - View only, should use `canViewAllTenants()`
- ⚠️ **Line 651:** `/admin/enrichment/rate-limits` - View only, should use `canViewAllTenants()`
- ⚠️ **Line 685:** `/admin/enrichment/analytics` - View only, should use `canViewAllTenants()`
- ⚠️ **Line 782:** `/admin/enrichment/search` - View only, should use `canViewAllTenants()`
- ⚠️ **Line 845:** `/admin/enrichment/:barcode` - View only, should use `canViewAllTenants()`

#### scan-metrics.ts
- ⚠️ **Line 12:** `/admin/scan-metrics` - View only, should use `canViewAllTenants()`
- ⚠️ **Line 191:** `/admin/scan-metrics/timeseries` - View only, should use `canViewAllTenants()`

#### quick-start.ts
- ⚠️ **Line 223:** GET `/quick-start/:tenantId/eligibility` - View only, should use `canViewAllTenants()`

### 2. Modify Operations (Should Remain PLATFORM_ADMIN Only)

These endpoints **modify data** and should stay restricted:

#### scan.ts
- ✅ **Line 665:** `/admin/enrichment/clear-cache` - Modify, keep `isPlatformAdmin()`

#### quick-start.ts
- ✅ **Line 101:** POST `/quick-start/:tenantId` - Modify, keep `isPlatformAdmin()`
- ✅ **Line 285:** POST `/quick-start/:tenantId/categories` - Modify, keep `isPlatformAdmin()`

#### permissions.ts
- ✅ **Line 53:** `requireTenantRole()` - Bypass check, keep `isPlatformAdmin()`
- ✅ **Line 121:** `requireTenantOwnership()` - Bypass check, keep `isPlatformAdmin()`
- ✅ **Line 188:** `requireTenantDeletion()` - Delete, keep `isPlatformAdmin()`

### 3. Middleware Functions

#### auth.ts

**Line 79-93:** `requirePlatformAdmin()`
```typescript
// Current: Only allows PLATFORM_ADMIN and legacy ADMIN
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== UserRole.PLATFORM_ADMIN && req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ ... });
  }
  next();
}
```

**Should Add:**
```typescript
// For view-only operations
export function requirePlatformUser(req: Request, res: Response, next: NextFunction) {
  if (!isPlatformUser(req.user)) {
    return res.status(403).json({ 
      error: 'platform_access_required', 
      message: 'Platform-level access required' 
    });
  }
  next();
}
```

**Line 167-175:** `requireTenantOwner()`
```typescript
// Current: Only allows PLATFORM_ADMIN for bypass
if (req.user.role === UserRole.PLATFORM_ADMIN || req.user.role === UserRole.ADMIN) {
  return next();
}
```

**Should Be:**
```typescript
// Platform admins can manage any tenant (modify operations)
if (isPlatformAdmin(req.user)) {
  return next();
}
```

---

## 🛠️ Recommended Changes

### Priority 1: Add New Middleware Functions

Add to `auth.ts`:

```typescript
import { isPlatformUser, canViewAllTenants, isPlatformAdmin } from '../utils/platform-admin';

/**
 * Middleware for platform users (admin, support, viewer)
 * Use for view-only operations
 */
export function requirePlatformUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  if (!isPlatformUser(req.user)) {
    return res.status(403).json({ 
      error: 'platform_access_required', 
      message: 'Platform-level access required' 
    });
  }

  next();
}
```

### Priority 2: Update View-Only Endpoints

Replace `isPlatformAdmin()` with `canViewAllTenants()` for:

**scan.ts:**
- `/admin/enrichment/cache-stats`
- `/admin/enrichment/rate-limits`
- `/admin/enrichment/analytics`
- `/admin/enrichment/search`
- `/admin/enrichment/:barcode`

**scan-metrics.ts:**
- `/admin/scan-metrics`
- `/admin/scan-metrics/timeseries`

**quick-start.ts:**
- GET `/quick-start/:tenantId/eligibility`

### Priority 3: Update Middleware

**auth.ts:**
- Update `requireTenantOwner()` to use `isPlatformAdmin()` helper

---

## 📋 Testing Checklist

### PLATFORM_ADMIN Tests
- [ ] Can view all analytics
- [ ] Can clear cache
- [ ] Can create Quick Start products
- [ ] Can delete tenants
- [ ] Can modify platform settings

### PLATFORM_SUPPORT Tests
- [ ] Can view all analytics ✅
- [ ] Can view cache stats ✅
- [ ] Can view rate limits ✅
- [ ] Can view enrichment data ✅
- [ ] Can view scan metrics ✅
- [ ] Cannot clear cache ❌
- [ ] Cannot create products ❌
- [ ] Cannot delete tenants ❌

### PLATFORM_VIEWER Tests
- [ ] Can view all analytics ✅
- [ ] Can view cache stats ✅
- [ ] Can view rate limits ✅
- [ ] Can view enrichment data ✅
- [ ] Can view scan metrics ✅
- [ ] Cannot clear cache ❌
- [ ] Cannot create products ❌
- [ ] Cannot delete tenants ❌
- [ ] Cannot perform any actions ❌

---

## 🎯 Implementation Plan

1. ✅ Add `requirePlatformUser()` middleware to `auth.ts`
2. ✅ Update `requireTenantOwner()` to use `isPlatformAdmin()` helper
3. ✅ Update view-only endpoints in `scan.ts` to use `canViewAllTenants()`
4. ✅ Update view-only endpoints in `scan-metrics.ts` to use `canViewAllTenants()`
5. ✅ Update view-only endpoints in `quick-start.ts` to use `canViewAllTenants()`
6. ✅ Test all three roles
7. ✅ Update documentation

---

## 📊 Access Control Matrix

| Operation | PLATFORM_ADMIN | PLATFORM_SUPPORT | PLATFORM_VIEWER | OWNER | USER |
|-----------|----------------|------------------|-----------------|-------|------|
| View all tenants | ✅ | ✅ | ✅ | Own only | Assigned only |
| View analytics | ✅ | ✅ | ✅ | Own only | Assigned only |
| View cache stats | ✅ | ✅ | ✅ | ❌ | ❌ |
| View rate limits | ✅ | ✅ | ✅ | ❌ | ❌ |
| View enrichment | ✅ | ✅ | ✅ | ❌ | ❌ |
| View scan metrics | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clear cache | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create products | ✅ | ❌ | ❌ | Own only | ❌ |
| Delete tenants | ✅ | ❌ | ❌ | Own only | ❌ |
| Modify settings | ✅ | ❌ | ❌ | Own only | ❌ |
| Reset passwords | ✅ | ✅ | ❌ | ❌ | ❌ |

---

**Status:** Ready for implementation  
**Estimated Changes:** 15-20 lines across 4 files
