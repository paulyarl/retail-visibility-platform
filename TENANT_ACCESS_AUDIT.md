# Tenant-Scoped Pages Access Control Audit

## Objective
Ensure Platform Support users have appropriate access to all tenant-scoped pages for support workflows.

## Audit Date
November 7, 2025

## Summary
✅ **2 pages audited** - All using correct access control
⚠️ **13 pages** - No explicit access control (rely on parent routing/auth)

---

## Pages with Access Control

### ✅ CORRECT - Platform Support Has Access

1. **`/t/{id}/settings/tenant`** - Business Profile
   - Access: `AccessPresets.SUPPORT_OR_TENANT_ADMIN`
   - Allows: Platform Admin, Platform Support, Tenant Owner, Tenant Admin
   - Status: ✅ Fixed (was using TENANT_ADMIN)

2. **`/t/{id}/settings/propagation`** - Propagation Control
   - Access: `AccessPresets.CHAIN_PROPAGATION`
   - Allows: Platform Admin, Platform Support, Organization Admins
   - Status: ✅ Already correct

3. **`/t/{id}/settings/subscription`** - Subscription
   - Access: None (reuses platform component)
   - Allows: All authenticated users
   - Status: ✅ Works correctly

---

## Pages Without Explicit Access Control

These pages don't have `useAccessControl` checks. They rely on:
- Parent route authentication
- Component-level permissions
- Backend API authorization

### Settings Pages (No Access Control)

4. **`/t/{id}/settings/page.tsx`** - Main Settings
   - Reuses platform settings page
   - Shows cards based on `ProtectedCard` access control

5. **`/t/{id}/settings/appearance`** - Theme Settings
   - No access control
   - Should be accessible to all tenant members

6. **`/t/{id}/settings/branding`** - Logo & Branding
   - No access control
   - ⚠️ Should probably require SUPPORT_OR_TENANT_ADMIN

7. **`/t/{id}/settings/contact`** - Contact Information
   - No access control
   - ⚠️ Should probably require SUPPORT_OR_TENANT_ADMIN

8. **`/t/{id}/settings/gbp-category`** - Google Business Category
   - No access control
   - ⚠️ Should probably require SUPPORT_OR_TENANT_ADMIN

9. **`/t/{id}/settings/hours`** - Business Hours
   - No access control
   - ⚠️ Should probably require SUPPORT_OR_TENANT_ADMIN

10. **`/t/{id}/settings/language`** - Language Settings
    - No access control
    - Should be accessible to all tenant members

11. **`/t/{id}/settings/offerings`** - Platform Offerings
    - No access control
    - Should be accessible to all tenant members

12. **`/t/{id}/settings/organization`** - Organization Settings
    - No access control
    - ⚠️ Should probably require ORGANIZATION_MEMBER

13. **`/t/{id}/settings/users`** - Team Management
    - No access control
    - ⚠️ Should probably require SUPPORT_OR_TENANT_ADMIN

### Admin Pages (Legacy Protection)

14. **`/t/{id}/settings/admin/flags`** - Feature Flags
    - Uses legacy `ProtectedRoute` (auth only, no role check)
    - ⚠️ Should use PLATFORM_ADMIN_ONLY

15. **`/t/{id}/settings/admin/page.tsx`** - Admin Dashboard
    - Unknown (need to check)

---

## Recommendations

### High Priority (Security)

1. **Feature Flags** (`/t/{id}/settings/admin/flags`)
   - Replace `ProtectedRoute` with `useAccessControl(tenantId, AccessPresets.PLATFORM_ADMIN_ONLY)`
   - Only Platform Admins should modify feature flags

### Medium Priority (Support Access)

2. **Branding, Contact, Hours, GBP Category, Users**
   - Add `useAccessControl(tenantId, AccessPresets.SUPPORT_OR_TENANT_ADMIN)`
   - Platform Support needs access to help tenants

3. **Organization Settings**
   - Add `useAccessControl(tenantId, AccessPresets.ORGANIZATION_MEMBER)`
   - Platform Support should be able to view org settings

### Low Priority (Current State OK)

4. **Appearance, Language, Offerings**
   - No changes needed
   - These are safe for all authenticated users

---

## Access Presets Reference

### For Tenant Settings Pages

- **`SUPPORT_OR_TENANT_ADMIN`** - Platform Support + Tenant Admins
  - Use for: Business profile, branding, contact, hours, team
  
- **`ORGANIZATION_MEMBER`** - Platform Support + Org Members
  - Use for: Organization settings, chain analytics
  
- **`CHAIN_PROPAGATION`** - Platform Support + Org Admins
  - Use for: Propagation controls
  
- **`PLATFORM_ADMIN_ONLY`** - Platform Admins only
  - Use for: Feature flags, system settings

---

## Testing Checklist

### Platform Support User Should:
- ✅ View tenant business profile
- ✅ View tenant subscription
- ✅ Access propagation controls (for chains)
- ⚠️ View tenant branding (needs fix)
- ⚠️ View tenant contact info (needs fix)
- ⚠️ View business hours (needs fix)
- ⚠️ Manage team members (needs fix)
- ❌ NOT modify feature flags (needs fix)

### Tenant Admin Should:
- ✅ Manage all tenant settings
- ✅ View subscription
- ✅ Manage team members
- ❌ NOT access platform admin features

### Tenant Member Should:
- ✅ View appearance settings
- ✅ View language settings
- ❌ NOT manage business profile
- ❌ NOT manage team members

---

## Next Steps

1. ✅ Fix tenant business profile - DONE
2. ⚠️ Add access control to branding page
3. ⚠️ Add access control to contact page
4. ⚠️ Add access control to hours page
5. ⚠️ Add access control to users page
6. ⚠️ Fix feature flags admin page
7. ⚠️ Add access control to organization page

---

## Notes

- Most pages rely on backend API authorization
- Frontend access control is for UX (hiding inaccessible pages)
- Backend must always enforce permissions
- `ProtectedRoute` is legacy - migrate to `useAccessControl`
