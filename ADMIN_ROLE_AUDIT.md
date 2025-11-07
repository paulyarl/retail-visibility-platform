# Admin Role Check Audit

**Date:** November 7, 2025  
**Issue:** Many files check `=== 'ADMIN'` directly instead of using centralized helpers  
**Impact:** New platform roles (PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_VIEWER) may not work correctly

---

## 🎯 Summary

Found **multiple locations** checking `role === 'ADMIN'` that should use centralized helpers like `isPlatformAdmin()`, `isPlatformUser()`, or `canViewAllTenants()`.

---

## 📊 Findings

### ✅ Already Fixed
- `apps/api/src/index.ts` (line 151) - GET /tenants endpoint ✅
- `apps/api/src/middleware/auth.ts` - Uses centralized helpers ✅
- `apps/web/src/lib/auth/access-control.ts` - Centralized helper definitions ✅

### ⚠️ Needs Review

#### Backend (apps/api/src)

| File | Line | Code | Should Use | Priority |
|------|------|------|------------|----------|
| `auth/auth.middleware.ts` | 70 | `req.user.role === 'ADMIN'` | `isPlatformAdmin()` | 🔴 HIGH |
| `index.ts` | 1285 | `req.user?.role === 'ADMIN'` | `isPlatformAdmin()` | 🔴 HIGH |

#### Frontend (apps/web/src)

| File | Line | Code | Context | Should Use | Priority |
|------|------|------|---------|------------|----------|
| `components/tenants/TenantsClient.tsx` | 393 | `userRole === 'ADMIN'` | Permission checks | `isPlatformAdmin()` | 🔴 HIGH |
| `components/app-shell/TenantSwitcher.tsx` | 50 | `user?.role === 'ADMIN'` | Tenant switching | `isPlatformAdmin()` | 🔴 HIGH |
| `app/(platform)/page.tsx` | 782 | `user?.role === 'ADMIN'` | Can manage check | `isPlatformAdmin()` | 🟡 MEDIUM |
| `app/(platform)/settings/tenant/page.tsx` | 456, 461, 489, 521, 626 | `user?.role === 'ADMIN'` | Org assignment | `isPlatformAdmin()` | 🟡 MEDIUM |
| `components/admin/CreateUserModal.tsx` | 175 | `formData.role === 'ADMIN'` | UI display only | Keep as-is | 🟢 LOW |
| `app/admin/users/page.tsx` | 159, 163 | `user.role === 'ADMIN'` | UI display only | Keep as-is | 🟢 LOW |
| `app/(platform)/settings/admin/users/page.tsx` | 324, 391 | `role === 'ADMIN'` | Filtering/counting | Keep as-is | 🟢 LOW |

---

## 🔧 Recommended Fixes

### Priority 1: Critical Backend Fixes

#### 1. `apps/api/src/auth/auth.middleware.ts` (Line 70)
**Current:**
```typescript
if (req.user.role === 'ADMIN') {
  return next();
}
```

**Should be:**
```typescript
import { isPlatformAdmin } from '../utils/platform-admin';

if (isPlatformAdmin(req.user)) {
  return next();
}
```

#### 2. `apps/api/src/index.ts` (Line 1285)
**Current:**
```typescript
const isAdmin = req.user?.role === 'ADMIN';
```

**Should be:**
```typescript
import { isPlatformAdmin } from './utils/platform-admin';

const isAdmin = isPlatformAdmin(req.user);
```

### Priority 2: Critical Frontend Fixes

#### 3. `apps/web/src/components/tenants/TenantsClient.tsx` (Line 393)
**Current:**
```typescript
const isAdmin = userRole === 'ADMIN';
const canEdit = isAdmin || memberRole === 'OWNER' || memberRole === 'ADMIN';
```

**Should be:**
```typescript
import { isPlatformAdmin } from '@/lib/auth/access-control';

const isAdmin = isPlatformAdmin(user);
const canEdit = isAdmin || memberRole === 'OWNER' || memberRole === 'ADMIN';
```

#### 4. `apps/web/src/components/app-shell/TenantSwitcher.tsx` (Line 50)
**Current:**
```typescript
const isAdmin = user?.role === 'ADMIN';
```

**Should be:**
```typescript
import { isPlatformAdmin } from '@/lib/auth/access-control';

const isAdmin = isPlatformAdmin(user);
```

### Priority 3: Medium Priority Fixes

#### 5. `apps/web/src/app/(platform)/page.tsx` (Line 782)
**Current:**
```typescript
const canManage = user?.role === 'ADMIN' || tenantRole === 'OWNER' || tenantRole === 'ADMIN';
```

**Should be:**
```typescript
import { isPlatformAdmin } from '@/lib/auth/access-control';

const canManage = isPlatformAdmin(user) || tenantRole === 'OWNER' || tenantRole === 'ADMIN';
```

#### 6. `apps/web/src/app/(platform)/settings/tenant/page.tsx` (Multiple lines)
**Current:**
```typescript
{user?.role === 'ADMIN' && ...}
```

**Should be:**
```typescript
import { isPlatformAdmin } from '@/lib/auth/access-control';

{isPlatformAdmin(user) && ...}
```

---

## 🟢 Safe to Keep As-Is

These checks are for **UI display purposes only** (badges, labels, filters) and don't affect access control:

1. **`components/admin/CreateUserModal.tsx`** - Shows description text
2. **`app/admin/users/page.tsx`** - Badge styling
3. **`app/(platform)/settings/admin/users/page.tsx`** - User counting and filtering

---

## 📋 Implementation Plan

### Phase 1: Critical Backend (Immediate)
- [ ] Fix `auth/auth.middleware.ts` - Tenant access check
- [ ] Fix `index.ts` - Admin check in route handler

### Phase 2: Critical Frontend (High Priority)
- [ ] Fix `TenantsClient.tsx` - Permission checks
- [ ] Fix `TenantSwitcher.tsx` - Tenant switching access

### Phase 3: Medium Priority Frontend
- [ ] Fix `page.tsx` (platform dashboard) - Can manage check
- [ ] Fix `settings/tenant/page.tsx` - Organization assignment

### Phase 4: Testing
- [ ] Test with PLATFORM_ADMIN
- [ ] Test with PLATFORM_SUPPORT
- [ ] Test with PLATFORM_VIEWER
- [ ] Test with legacy ADMIN
- [ ] Test with regular users

---

## 🎯 Success Criteria

After fixes:
- ✅ All platform roles (ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_VIEWER) work correctly
- ✅ No direct `=== 'ADMIN'` checks in access control logic
- ✅ All checks use centralized helpers
- ✅ UI display checks remain unchanged (safe)

---

## 📝 Notes

- **UI Display Checks:** Safe to keep `=== 'ADMIN'` for badges, labels, and filtering
- **Access Control Checks:** MUST use centralized helpers
- **Centralized Helpers:** `isPlatformAdmin()`, `isPlatformUser()`, `canViewAllTenants()`
- **Memory:** This audit follows the centralized access control pattern from memory `ca3696e7`
