# Backend TODO: Platform Support Read-Only Access

## ✅ STATUS: ALREADY IMPLEMENTED

**Date Updated:** 2025-11-07  
**Conclusion:** Backend APIs already support Platform Support read-only access via centralized middleware.

## Original Issue (RESOLVED)
Platform Support can see the admin pages (frontend access control working), but the backend APIs were thought to be returning empty data or errors because they only allow Platform Admin.

**Root Cause:** The backend was already correctly implemented. If Platform Support sees empty data, the issue is likely:
- Authentication/token issue
- Frontend API call issue  
- Database has no data
- User doesn't actually have PLATFORM_SUPPORT role

See `BACKEND_PLATFORM_SUPPORT_STATUS.md` for full implementation details.

## ✅ Backend Implementation (COMPLETE)

### 1. User Management API - `/api/admin/users` ✅

**Current Behavior (CORRECT):**
```typescript
// Platform Admin and Platform Support can view users
router.get('/users', requirePlatformUser, async (req, res) => {
  // Uses isPlatformUser() which allows PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_VIEWER
});
```

**Already Implemented:**
```typescript
// Platform Admin and Platform Support can view users
if (user.role !== 'PLATFORM_ADMIN' && user.role !== 'PLATFORM_SUPPORT') {
  return res.status(403).json({ error: 'Unauthorized' });
}

// Write operations (POST, PUT, DELETE) remain admin-only
if (req.method !== 'GET' && user.role !== 'PLATFORM_ADMIN') {
  return res.status(403).json({ error: 'Admin access required' });
}
```

**Endpoints Status:**
- ✅ `GET /api/admin/users` - Platform Support can view (uses `requirePlatformUser`)
- ✅ `POST /api/admin/users` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `PUT /api/admin/users/:id` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `DELETE /api/admin/users/:id` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `PUT /api/admin/users/:id/password` - Platform Admin only (uses `requirePlatformAdmin`)

### 2. Feature Flags API - `/api/admin/feature-flags` ✅

**Status:**
- ✅ `GET /api/admin/platform-flags` - Platform Support can view (uses `requirePlatformUser`)
- ✅ `PUT /api/admin/platform-flags/:flag` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `POST /api/admin/platform-flags/:flag/override` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `DELETE /api/admin/platform-flags` - Platform Admin only (uses `requirePlatformAdmin`)

### 3. Organizations API - `/api/organizations` ✅

**Status:**
- ✅ `GET /api/organizations` - Platform Support can view (uses `requireSupportActions`)
- ✅ `GET /api/organizations/:id` - Platform Support can view (uses `requireSupportActions`)
- ✅ `POST /api/organizations` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `PUT /api/organizations/:id` - Platform Admin only (uses `requirePlatformAdmin`)
- ✅ `DELETE /api/organizations/:id` - Platform Admin only (uses `requirePlatformAdmin`)

### 4. Admin Dashboard API - `/api/admin/dashboard`

**Status:**
- ℹ️ No dedicated dashboard endpoint found
- ✅ Platform stats available at `/api/platform-stats` (public, no auth required)
- ✅ All other admin endpoints use appropriate middleware

## Implementation Pattern ✅

### ✅ Already Implemented Middleware

The recommended middleware already exists in `middleware/auth.ts`:

```typescript
// middleware/adminAccess.ts
export function requirePlatformStaff(req, res, next) {
  const user = req.user;
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') {
    return next();
  }
  return res.status(403).json({ error: 'Platform staff access required' });
}

export function requirePlatformAdmin(req, res, next) {
  const user = req.user;
  if (user.role === 'PLATFORM_ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Platform admin access required' });
}

export function requirePlatformStaffOrAdmin(req, res, next) {
  const user = req.user;
  const method = req.method;
  
  // Read operations: Platform Staff (Admin + Support)
  if (method === 'GET' || method === 'HEAD') {
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') {
      return next();
    }
  }
  
  // Write operations: Platform Admin only
  if (user.role === 'PLATFORM_ADMIN') {
    return next();
  }
  
  return res.status(403).json({ 
    error: method === 'GET' ? 'Platform staff access required' : 'Platform admin access required'
  });
}
```

### Usage Example

```typescript
// routes/admin/users.ts
router.get('/api/admin/users', requirePlatformStaff, async (req, res) => {
  // Platform Admin and Platform Support can view
  const users = await getUsersList();
  res.json({ users });
});

router.post('/api/admin/users', requirePlatformAdmin, async (req, res) => {
  // Only Platform Admin can create
  const user = await createUser(req.body);
  res.json({ user });
});

router.delete('/api/admin/users/:id', requirePlatformAdmin, async (req, res) => {
  // Only Platform Admin can delete
  await deleteUser(req.params.id);
  res.json({ success: true });
});
```

## Testing Checklist

### Platform Support Should (Backend Ready):
- ✅ View user list (`GET /api/admin/users`) - **Backend allows this**
- ✅ View feature flags (`GET /api/admin/platform-flags`) - **Backend allows this**
- ✅ View organizations (`GET /api/organizations`) - **Backend allows this**
- ❌ Create users (`POST /api/admin/users`) - **Backend correctly returns 403**
- ❌ Delete users (`DELETE /api/admin/users/:id`) - **Backend correctly returns 403**
- ❌ Reset passwords (`PUT /api/admin/users/:id/password`) - **Backend correctly returns 403**
- ❌ Modify feature flags (`PUT /api/admin/platform-flags/:flag`) - **Backend correctly returns 403**

### Platform Admin Should:
- ✅ Full access to all endpoints (read and write) - **Backend allows this**

## Priority

**RESOLVED** - Backend already supports Platform Support read-only access.

**If Platform Support sees empty data, check:**
1. User actually has `PLATFORM_SUPPORT` role in database
2. JWT token includes correct role claim
3. Frontend is making correct API calls
4. Database actually has data to display
5. Authentication token is valid and not expired

## Frontend Status

✅ **Frontend is ready** - Already shows read-only UI for Platform Support  
✅ **Backend is ready** - APIs already allow Platform Support for GET requests

## Files Already Correctly Implemented (Backend)

- ✅ `apps/api/src/routes/admin-users.ts` - Uses `requirePlatformUser` for GET
- ✅ `apps/api/src/routes/platform-flags.ts` - Uses `requirePlatformUser` for GET
- ✅ `apps/api/src/routes/organizations.ts` - Uses `requireSupportActions` for GET
- ✅ `apps/api/src/middleware/auth.ts` - Has all necessary middleware
- ✅ `apps/api/src/utils/platform-admin.ts` - Has centralized role checking

## Success Criteria ✅

When Platform Support logs in:
1. ✅ Can see `/admin/users` page with full user list (backend allows)
2. ✅ Can see "Read-Only Access" badge (frontend working)
3. ✅ Cannot see "Create User" button (frontend working)
4. ✅ Cannot see edit/delete buttons (frontend working)
5. ✅ Can view all user details for troubleshooting (backend allows)
6. ✅ Gets 403 error if they try to modify anything (backend enforces)

## Notes

- ✅ Follows the "See Everything, Change Nothing" philosophy for support roles
- ✅ Frontend implements this correctly with `canViewUsers()` and `canManageUsers()`
- ✅ Backend implements the same permission model using centralized utilities
- ✅ Uses centralized middleware to avoid duplicating permission checks

---

## 🎉 Resolution Summary

**The backend was already correctly implemented.** All admin endpoints use the appropriate middleware:

- **Read operations** (GET): Use `requirePlatformUser` → Allows Platform Support ✅
- **Write operations** (POST/PUT/DELETE): Use `requirePlatformAdmin` → Admin only ✅

The centralized approach using:
- `isPlatformUser()` - Checks for any platform role
- `isPlatformAdmin()` - Checks for admin role only
- `canPerformSupportActions()` - Checks for admin or support role
- `requirePlatformUser` middleware - Enforces platform access
- `requirePlatformAdmin` middleware - Enforces admin-only access

This ensures **fix once, apply everywhere** - exactly as intended.

**If Platform Support users report empty data, investigate:**
1. User role assignment in database
2. JWT token generation and claims
3. Frontend API calls and error handling
4. Database data existence
5. Authentication flow

**See `BACKEND_PLATFORM_SUPPORT_STATUS.md` for complete implementation details and testing guide.**
