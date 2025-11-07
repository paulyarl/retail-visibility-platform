# Backend TODO: Platform Support Read-Only Access

## Issue
Platform Support can see the admin pages (frontend access control working), but the backend APIs are returning empty data or errors because they only allow Platform Admin.

## Required Backend Changes

### 1. User Management API - `/api/admin/users`

**Current Behavior:**
```typescript
// Only Platform Admin can view users
if (user.role !== 'PLATFORM_ADMIN') {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

**Required Behavior:**
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

**Endpoints to Update:**
- `GET /api/admin/users` - Allow Platform Support (read-only)
- `POST /api/admin/users` - Platform Admin only
- `PUT /api/admin/users/:id` - Platform Admin only
- `DELETE /api/admin/users/:id` - Platform Admin only
- `POST /api/admin/users/:id/reset-password` - Platform Admin only

### 2. Feature Flags API - `/api/admin/feature-flags`

**Required:**
- `GET /api/admin/feature-flags` - Allow Platform Support (read-only)
- `PUT /api/admin/feature-flags` - Platform Admin only

### 3. Organizations API - `/api/admin/organizations`

**Required:**
- `GET /api/admin/organizations` - Allow Platform Support (read-only)
- `POST /api/admin/organizations` - Platform Admin only
- `PUT /api/admin/organizations/:id` - Platform Admin only
- `DELETE /api/admin/organizations/:id` - Platform Admin only

### 4. Admin Dashboard API - `/api/admin/dashboard`

**Required:**
- `GET /api/admin/dashboard` - Allow Platform Support (read-only)
- All analytics endpoints - Allow Platform Support (read-only)

## Implementation Pattern

### Recommended Middleware

Create a reusable middleware for role-based access:

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

### Platform Support Should:
- ✅ View user list (`GET /api/admin/users`)
- ✅ View user details (`GET /api/admin/users/:id`)
- ✅ View feature flags (`GET /api/admin/feature-flags`)
- ✅ View organizations (`GET /api/admin/organizations`)
- ✅ View dashboard analytics (`GET /api/admin/dashboard`)
- ❌ Create users (`POST /api/admin/users`) - Should return 403
- ❌ Delete users (`DELETE /api/admin/users/:id`) - Should return 403
- ❌ Reset passwords (`POST /api/admin/users/:id/reset-password`) - Should return 403
- ❌ Modify feature flags (`PUT /api/admin/feature-flags`) - Should return 403

### Platform Admin Should:
- ✅ Full access to all endpoints (read and write)

## Priority

**HIGH** - Platform Support cannot currently troubleshoot user issues without being able to see the user list.

## Frontend Status

✅ **Frontend is ready** - Already shows read-only UI for Platform Support
⚠️ **Backend needs update** - APIs need to allow Platform Support for GET requests

## Files to Update (Backend)

Likely locations:
- `apps/api/src/routes/admin/users.ts` (or similar)
- `apps/api/src/routes/admin/feature-flags.ts`
- `apps/api/src/routes/admin/organizations.ts`
- `apps/api/src/routes/admin/dashboard.ts`
- `apps/api/src/middleware/auth.ts` (add new middleware functions)

## Success Criteria

When Platform Support logs in:
1. Can see `/admin/users` page with full user list
2. Can see "Read-Only Access" badge (already working)
3. Cannot see "Create User" button (already working)
4. Cannot see edit/delete buttons (already working)
5. Can view all user details for troubleshooting
6. Gets 403 error if they try to modify anything

## Notes

- This follows the "See Everything, Change Nothing" philosophy for support roles
- Frontend already implements this correctly with `canViewUsers()` and `canManageUsers()`
- Backend just needs to catch up with the same permission model
- Use centralized middleware to avoid duplicating permission checks
