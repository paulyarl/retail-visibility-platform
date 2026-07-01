# Organization Behavior Guard Sprint Plan

## Problem Statement

Organizations are parent entities containing multiple tenant locations. Today, organization-level access control piggybacks on **tenant roles** — `isOrganizationAdmin` checks if the user is owner/admin of the **hero tenant**, and `isOrganizationMember` checks if they're admin of **any tenant** in the org. There is no separate organization role system.

This creates several gaps:

1. **No org-specific roles** — A tenant admin of a child location is not an org admin, but there's no `ORG_ADMIN` role to distinguish them. Org admin is implicitly "admin of hero tenant."
2. **No org-level guard component** — There's no `OrgGuard` equivalent of `TenantGuard`. Org pages use `useAccessControl` with `AccessPresets.ORGANIZATION_ADMIN` or `ORGANIZATION_MEMBER`, but there's no page-level wrapper.
3. **API routes lack org admin middleware** — Org commerce settings PUT, org capabilities, org requests PATCH/DELETE, and hero-location PUT all use `authenticateToken` only — no `requireOrgAdmin` middleware.
4. **Sidebar shows org links to all tenant users** — "Organization Dashboard" and "Propagation Settings" in `buildTenantNav()` have no `requiredGroup` filtering.
5. **Org dashboard components have no `readOnly` mode** — `OrganizationDashboard` and its 30+ sub-components don't disable interactive elements for non-org-admins.
6. **Org settings cards in TenantSettings lack `accessOptions`** — The "Organization Dashboard" and "Propagation Settings" cards use `accessOptions: { orgMember: true }` and `{ chainPropagation: true }` respectively, but these aren't enforced via `useTenantBehaviorAccess`.

## Current State

### How Org Roles Work Today

```
organizations_list
  ├── owner_id (String — references a user, but not used for role checks)
  ├── tenants[] (child tenants)
  └── metadata.isHeroLocation on tenant → hero tenant

isOrganizationAdmin(user, orgData):
  → finds hero tenant in org
  → checks isTenantOwnerOrAdmin(user, heroTenantId)
  → = user is OWNER/ADMIN/TENANT_OWNER/TENANT_ADMIN of the hero tenant

isOrganizationMember(user, orgData):
  → checks if user isTenantOwnerOrAdmin of ANY tenant in org
```

**Problem:** A user who is `TENANT_ADMIN` of a child location (not hero) is NOT an org admin. But a user who is `TENANT_MEMBER` of the hero tenant has no org access at all — even if they should be an org viewer.

### Existing Access Presets

| Preset | Checks | Used By |
|--------|--------|---------|
| `ORGANIZATION_ADMIN` | `requireOrganizationAdmin` (hero tenant admin) | — (not used in pages) |
| `ORGANIZATION_MEMBER` | Custom check (admin of any tenant in org) | Org commerce settings page |
| `CHAIN_PROPAGATION` | Custom check (hero tenant admin or platform) | Propagation settings page |
| `HERO_LOCATION_ADMIN` | `requireHeroLocation` + tenant admin | — (not used in pages) |

### Frontend Pages

| Page | Current Guard | Gap |
|------|--------------|-----|
| `(platform)/settings/organization` | None | No guard at all |
| `(platform)/settings/organization/commerce` | `useAccessControl(ORGANIZATION_MEMBER)` | Uses member, not admin for write operations |
| `t/[tenantId]/settings/organization` | None | No guard |
| `t/[tenantId]/settings/organization/commerce` | Delegates to platform version | No guard |
| `t/[tenantId]/settings/propagation` | `useAccessControl(CHAIN_PROPAGATION)` | ✅ Has access control |
| `(platform)/settings/admin/organizations` | None (platform admin page) | Should require platform admin |

### API Routes

| Route | Method | Current Middleware | Gap |
|-------|--------|-------------------|-----|
| `organizations.ts` POST `/` | POST | `requirePlatformAdmin` | ✅ |
| `organizations.ts` PUT `/:id` | PUT | `requirePlatformAdmin` | ✅ |
| `organizations.ts` PUT `/:id/self-update` | PUT | `authenticateToken` | ❌ No org admin check |
| `organizations.ts` DELETE `/:id` | DELETE | `requirePlatformAdmin` | ✅ |
| `organizations.ts` POST `/:id/tenants` | POST | `requirePlatformAdmin` | ✅ |
| `organizations.ts` DELETE `/:id/tenants/:tenantId` | DELETE | `requirePlatformAdmin` | ✅ |
| `organizations.ts` POST `/:id/items/propagate` | POST | `authenticateToken` | ❌ No org admin check |
| `organizations.ts` POST `/:id/items/propagate-bulk` | POST | `authenticateToken` | ❌ No org admin check |
| `organizations.ts` PUT `/:id/hero-location` | PUT | `authenticateToken` + `requireSupportActions` | ❌ No org admin check |
| `organizations.ts` POST `/:id/sync-from-hero` | POST | `requireSupportActions` | ✅ |
| `organization-commerce-settings.ts` PUT | PUT | `authenticateToken` | ❌ No org admin check |
| `organization-capabilities.ts` GET | GET | `authenticateToken` | ✅ (read-only) |
| `organization-capabilities.ts` POST bot chat | POST | `authenticateToken` (via router.use) | ❌ No org member check |
| `organization-requests.ts` POST `/` | POST | `authenticateToken` | ❌ No org member check |
| `organization-requests.ts` PATCH `/:id` | PATCH | `authenticateToken` | ❌ No org admin check |
| `organization-requests.ts` DELETE `/:id` | DELETE | `authenticateToken` | ❌ No org admin check |
| `hero-location.ts` GET `/organization/:orgId` | GET | `authenticateToken` | ✅ (read-only) |
| `hero-location.ts` POST `/route-payment` | POST | `authenticateToken` | ✅ (checkout flow) |

### Sidebar Navigation

| Nav Item | Current Filtering | Gap |
|----------|------------------|-----|
| Organization Dashboard | None | Visible to all tenant users |
| Propagation Settings | None | Visible to all tenant users |
| Propagation Center | None | Visible to all tenant users |

### Org Dashboard Components (30+ files)

| Component | Current Guard | Gap |
|-----------|--------------|-----|
| `OrganizationDashboard` | `ProtectedCard` on propagation tab only | No org-wide `readOnly` mode |
| `OrgPropagationPanel` | `ProtectedCard(CHAIN_PROPAGATION)` | ✅ |
| `OrgCommerceCard` | None | No guard |
| `OrgBotWidget` | None | No guard |
| `OrgPlanSummaryPanel` | None | No guard |
| `OrgQuickActionsBar` | None | No guard |
| `OrgHeroLocationModal` | None | No guard |
| `OrgCategorySyncModal` | None | No guard |

---

## Sprint Phases

### Phase 1: `useOrgBehaviorAccess` Hook + `OrgGuard` Component (P0)

**Goal:** Create the org-level equivalent of `useTenantBehaviorAccess` and `TenantGuard`.

**Deliverables:**

1. **`useOrgBehaviorAccess` hook** — `apps/web/src/hooks/tenant-access/useOrgBehaviorAccess.ts`
   - Input: `tenantId` (derives org from tenant's `organizationId`)
   - Returns: `{ isOrgAdmin, isOrgMember, loading, orgData, organizationId }`
   - Uses `useAccessControl(tenantId, AccessPresets.ORGANIZATION_ADMIN, true)` internally
   - `isOrgAdmin` = true if user is admin of hero tenant OR platform admin
   - `isOrgMember` = true if user is admin of any tenant in org OR platform admin

2. **`OrgGuard` component** — `apps/web/src/components/organization/OrgGuard.tsx`
   - Props: `tenantId`, `requireAdmin?: boolean` (default true), `children`
   - Uses `useOrgBehaviorAccess`
   - When `requireAdmin && !isOrgAdmin` → renders `<AccessDenied />`
   - When `!requireAdmin && !isOrgMember` → renders `<AccessDenied />`
   - When `loading` → renders spinner

**Files:**
- `apps/web/src/hooks/tenant-access/useOrgBehaviorAccess.ts` (NEW)
- `apps/web/src/components/organization/OrgGuard.tsx` (NEW)

---

### Phase 2: Gate Organization Pages (P0)

**Goal:** Wrap all org-level pages with `OrgGuard`.

**Deliverables:**

1. **`(platform)/settings/organization/page.tsx`** — Wrap with `OrgGuard`
2. **`(platform)/settings/organization/commerce/page.tsx`** — Already uses `useAccessControl(ORGANIZATION_MEMBER)` for viewing; add `OrgGuard` with `requireAdmin` for the page, keep `ProtectedCard` for write sections
3. **`t/[tenantId]/settings/organization/page.tsx`** — Wrap with `OrgGuard` (using tenantId to derive org)
4. **`t/[tenantId]/settings/organization/commerce/page.tsx`** — Wrap with `OrgGuard`
5. **`(platform)/settings/admin/organizations/page.tsx`** — Add platform admin guard (already a platform admin page, but no explicit guard)

**Files:**
- `apps/web/src/app/(platform)/settings/organization/page.tsx` (MODIFY)
- `apps/web/src/app/(platform)/settings/organization/commerce/page.tsx` (MODIFY)
- `apps/web/src/app/t/[tenantId]/settings/organization/page.tsx` (MODIFY)
- `apps/web/src/app/t/[tenantId]/settings/organization/commerce/page.tsx` (MODIFY)

---

### Phase 3: Backend Org Admin Middleware (P0)

**Goal:** Create `requireOrgAdmin` and `requireOrgMember` middleware and apply to all org write routes.

**Deliverables:**

1. **`requireOrgAdmin` middleware** — `apps/api/src/middleware/permissions.ts`
   - Extracts `organizationId` from req.params or req.body
   - Fetches org data (hero tenant)
   - Checks if user is admin of hero tenant OR platform admin
   - Returns 403 if not

2. **`requireOrgMember` middleware** — `apps/api/src/middleware/permissions.ts`
   - Same extraction, checks if user is admin of ANY tenant in org OR platform admin

3. **Apply to routes:**

| Route | Middleware |
|-------|-----------|
| `organizations.ts` PUT `/:id/self-update` | `requireOrgAdmin` |
| `organizations.ts` POST `/:id/items/propagate` | `requireOrgAdmin` |
| `organizations.ts` POST `/:id/items/propagate-bulk` | `requireOrgAdmin` |
| `organizations.ts` PUT `/:id/hero-location` | `requireOrgAdmin` (replace `requireSupportActions`) |
| `organization-commerce-settings.ts` PUT | `requireOrgAdmin` |
| `organization-requests.ts` POST `/` | `requireOrgMember` |
| `organization-requests.ts` PATCH `/:id` | `requireOrgAdmin` |
| `organization-requests.ts` DELETE `/:id` | `requireOrgAdmin` |
| `organization-capabilities.ts` POST bot chat | `requireOrgMember` |

**Files:**
- `apps/api/src/middleware/permissions.ts` (MODIFY — add `requireOrgAdmin`, `requireOrgMember`)
- `apps/api/src/routes/organizations.ts` (MODIFY)
- `apps/api/src/routes/organization-commerce-settings.ts` (MODIFY)
- `apps/api/src/routes/organization-requests.ts` (MODIFY)
- `apps/api/src/routes/organization-capabilities.ts` (MODIFY)

---

### Phase 4: Org Dashboard Component Guards (P1)

**Goal:** Add `readOnly` mode to org dashboard components, disable interactive elements for non-org-admins.

**Deliverables:**

1. **`OrganizationDashboard`** — Accept `readOnly` prop, pass to children
2. **`OrgCommerceCard`** — Disable save buttons when `readOnly`
3. **`OrgBotWidget`** — Disable config actions when `readOnly`
4. **`OrgPlanSummaryPanel`** — Disable clickable links when `readOnly`
5. **`OrgQuickActionsBar`** — Disable action buttons when `readOnly`
6. **`OrgHeroLocationModal`** — Disable when `readOnly`
7. **`OrgCategorySyncModal`** — Disable when `readOnly`
8. **`OrgPropagationPanel`** — Already guarded by `ProtectedCard`, but pass `readOnly` for consistency

**Files:**
- `apps/web/src/components/organization/OrganizationDashboard.tsx` (MODIFY)
- `apps/web/src/components/organization/OrgCommerceCard.tsx` (MODIFY)
- `apps/web/src/components/organization/OrgBotWidget.tsx` (MODIFY)
- `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx` (MODIFY)
- `apps/web/src/components/organization/OrgQuickActionsBar.tsx` (MODIFY)
- `apps/web/src/components/organization/OrgHeroLocationModal.tsx` (MODIFY)
- `apps/web/src/components/organization/OrgCategorySyncModal.tsx` (MODIFY)

---

### Phase 5: Sidebar Navigation Org Filtering (P1)

**Goal:** Filter org-related sidebar nav items based on org role.

**Deliverables:**

1. **Add `requiredOrgAdmin` field to nav items** — Extend `RBACNavGates` interface or use a new `requiredOrgRole` field
2. **Update `buildTenantNav()`** — Add `requiredGroup: 'IS_TENANT_MANAGER'` to org-related items (org admin = tenant admin of hero, which is `IS_TENANT_ADMIN` group, but we need a separate gate)
3. **Add `filterByOrgRole` in `DynamicTenantSidebar`** — Similar to `filterByTenantRole`, uses `useOrgBehaviorAccess` to hide org-admin items when `!isOrgAdmin`
4. **Update nav items:**

| Nav Item | Gate |
|----------|------|
| Organization Dashboard | `requiredOrgAdmin: true` |
| Propagation Settings | `requiredOrgAdmin: true` |
| Propagation Center | `requiredOrgAdmin: true` |

**Files:**
- `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` (MODIFY)
- `apps/web/src/lib/auth/useRBAC.ts` (MODIFY — extend `RBACNavGates` if needed)

---

### Phase 6: Audit & Regression (P2)

**Goal:** Comprehensive audit of all org entrance points.

**Deliverables:**

1. **Entrance point audit** — Document every org route, component, and API endpoint
2. **E2E test matrix** — For each role, document expected behavior:

| Entrance Point | Org Admin | Tenant Admin (non-hero) | Tenant Member | Platform Admin |
|---------------|-----------|------------------------|---------------|----------------|
| Org settings pages | Full access | AccessDenied | AccessDenied | Full access |
| Org commerce settings | Full access | Read-only | Read-only | Full access |
| Propagation | Full access | AccessDenied | AccessDenied | Full access |
| Org dashboard widgets | Interactive | Read-only | Read-only | Interactive |
| Sidebar org links | Visible | Hidden | Hidden | Visible |
| API org write | 200 | 403 | 403 | 200 |
| API org read | 200 | 200 | 200 | 200 |

3. **Regression check** — `checkapi` and `checkweb` pass with zero TS errors

**Files:**
- `docs/ORGANIZATION_BEHAVIOR_GUARD_AUDIT.md` (NEW)

---

## Architecture Decisions

### Why not add a separate `user_organizations` table with org roles?

A full org role system (`user_organizations` table with `ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER` roles) would be the ideal long-term solution, but it requires:
- Database migration + Prisma schema changes
- Auth0/AuthContext changes to include org roles in user object
- All org access checks rewritten

For now, we piggyback on tenant roles (same as current `isOrganizationAdmin` pattern). This is a **pragmatic Phase 1** that gates all entrance points using existing infrastructure. A future sprint can add explicit org roles.

### Why `useOrgBehaviorAccess` instead of reusing `useTenantBehaviorAccess`?

`useTenantBehaviorAccess` checks if the user is admin of the **scoped tenant**. A user could be admin of a child location but NOT admin of the hero tenant (which is what makes them an org admin). `useOrgBehaviorAccess` specifically checks org-level admin by looking at the hero tenant.

### Filter chain in DynamicTenantSidebar

```
filterNavItems (platform RBAC)
  → filterByCapability (capability flags)
    → filterByTenantRole (tenant admin role)
      → filterByOrgRole (org admin role)  ← NEW
```

---

## Implementation Priority

| Phase | Priority | Effort | Risk |
|-------|----------|--------|------|
| Phase 1: OrgGuard + Hook | P0 | Small (1-2h) | Low — new files only |
| Phase 2: Gate Org Pages | P0 | Small (1-2h) | Low — wrapper pattern |
| Phase 3: Backend Middleware | P0 | Medium (3-4h) | Medium — middleware on 9 routes |
| Phase 4: Dashboard Component Guards | P1 | Medium (3-4h) | Low — UI changes |
| Phase 5: Sidebar Filtering | P1 | Small (1-2h) | Low — extends existing pattern |
| Phase 6: Audit & Regression | P2 | Small (1-2h) | None — verification only |
| Phase 7: Explicit Org Roles (DB + API) | P2 | Medium (4-6h) | Medium — migration + auth changes |
| Phase 8: Org User Management UI | P2 | Medium (4-6h) | Low — mirrors tenant user page |

**Total estimated effort:** 18-27 hours

---

### Phase 7: Explicit Organization Roles — DB + API (P2)

**Goal:** Replace the derived org role model (hero tenant admin = org admin) with explicit org-level roles stored in a `user_organizations` table. This decouples org roles from tenant roles entirely.

**Why:** Today, a tenant admin of a child location has no org-level access. A tenant member of the hero tenant also has no org-level access. There's no way to grant someone org-wide admin without making them admin of the hero tenant. Explicit org roles solve this.

**Deliverables:**

1. **Database migration** — `database/migrations/071_user_organizations.sql`
   ```sql
   CREATE TABLE user_organizations (
     id              VARCHAR(255) PRIMARY KEY,
     user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     organization_id VARCHAR(255) NOT NULL REFERENCES organizations_list(id) ON DELETE CASCADE,
     role            VARCHAR(50) NOT NULL DEFAULT 'ORG_MEMBER',
     created_at      TIMESTAMPTZ DEFAULT NOW(),
     updated_at      TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(user_id, organization_id)
   );
   ```
   - Org roles: `ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`, `ORG_VIEWER`
   - RLS policies (org members can read, org admins can write)
   - Updated_at trigger
   - **Seed from existing data:** For each org, find hero tenant admins → insert as `ORG_ADMIN`. Find `organizations_list.owner_id` → insert as `ORG_OWNER`.

2. **Prisma schema** — Add `user_organizations` model to `apps/api/prisma/schema.prisma`
   - Relations to `users` and `organizations_list`
   - Unique constraint on `(user_id, organization_id)`

3. **ID generator** — `generateUserOrgId(orgId)` in `apps/api/src/lib/id-generator.ts`
   - Pattern: `uorg-{orgId}-{nanoid}`

4. **RBAC config** — `apps/web/src/config/rbac.ts`
   - Add `ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`, `ORG_VIEWER` to `USER_ROLES`
   - Add `IS_ORG_ADMIN` role group: `[ORG_OWNER, ORG_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT, ADMIN]`
   - Add `IS_ORG_MEMBER` role group: `[ORG_OWNER, ORG_ADMIN, ORG_MEMBER, PLATFORM_ADMIN, PLATFORM_SUPPORT, ADMIN]`

5. **AuthContext** — `apps/web/src/contexts/AuthContext.tsx`
   - Include `organizations: [{ id, role }]` in user object from API response
   - Extend `UserData` interface in `access-control.ts` with `organizations?: Array<{ id: string; role: string }>`

6. **`getOrgRole(user, orgId)` function** — `apps/web/src/lib/auth/access-control.ts`
   ```ts
   export function getOrgRole(user: UserData, orgId: string): string | null {
     const org = user.organizations?.find(o => o.id === orgId);
     return org?.role || null;
   }
   
   export function isOrgAdmin(user: UserData, orgId: string): boolean {
     const role = getOrgRole(user, orgId);
     return role === 'ORG_OWNER' || role === 'ORG_ADMIN' || isPlatformAdmin(user);
   }
   
   export function isOrgMember(user: UserData, orgId: string): boolean {
     const role = getOrgRole(user, orgId);
     return role !== null || isPlatformAdmin(user);
   }
   ```

7. **Update `isOrganizationAdmin` / `isOrganizationMember`** — Keep as fallback for orgs without explicit roles. Check `getOrgRole` first, fall back to hero tenant derivation.

8. **Backend API routes** — `apps/api/src/routes/organization-users.ts` (NEW)
   - `GET /api/organizations/:orgId/users` — List org users (requires org admin)
   - `POST /api/organizations/:orgId/users` — Add user to org (requires org admin)
   - `PUT /api/organizations/:orgId/users/:userId` — Update org role (requires org owner)
   - `DELETE /api/organizations/:orgId/users/:userId` — Remove user from org (requires org owner)
   - `POST /api/organizations/:orgId/users/invite` — Send org invitation email (requires org admin)
   - `GET /api/organizations/:orgId/invitations` — List pending org invitations (requires org admin)
   - `DELETE /api/organizations/:orgId/invitations/:id` — Cancel org invitation (requires org admin)

9. **Update `requireOrgAdmin` middleware** — Check `getOrgRole` from `user.organizations` instead of hero tenant derivation. Fall back to hero tenant check for backward compatibility.

10. **Auth sync** — `apps/api/src/routes/auth-sync.ts`
    - When building user response, fetch `user_organizations` and include in user object
    - Include `organizations: [{ id, role }]` in auth/me response

**Files:**
- `database/migrations/071_user_organizations.sql` (NEW)
- `apps/api/prisma/schema.prisma` (MODIFY — add model)
- `apps/api/src/lib/id-generator.ts` (MODIFY — add `generateUserOrgId`)
- `apps/web/src/config/rbac.ts` (MODIFY — add org roles + groups)
- `apps/web/src/lib/auth/access-control.ts` (MODIFY — add `getOrgRole`, `isOrgAdmin`, update `isOrganizationAdmin`)
- `apps/web/src/contexts/AuthContext.tsx` (MODIFY — include org roles in user object)
- `apps/api/src/routes/organization-users.ts` (NEW)
- `apps/api/src/routes/auth-sync.ts` (MODIFY — include org roles in response)
- `apps/api/src/middleware/permissions.ts` (MODIFY — update `requireOrgAdmin` to use explicit roles)
- `apps/api/src/index.ts` (MODIFY — mount org users routes)

---

### Phase 8: Org User Management UI (P2)

**Goal:** Build an org-level user management page, mirroring the tenant user management page at `/t/[tenantId]/settings/users` but for org-wide roles.

**Reference:** The tenant user page at `apps/web/src/app/t/[tenantId]/settings/users/page.tsx` provides the exact pattern to mirror:
- Users table with avatar, name, email, role badge, last login
- Inline role editing with select dropdown
- Invite user modal with email + role select
- Pending invitations table with cancel button
- Role labels and color badges
- Remove user button with confirmation

**Deliverables:**

1. **Frontend service** — `apps/web/src/services/OrganizationUsersService.ts`
   - Singleton extending base API service
   - Methods: `getUsers(orgId)`, `addUser(orgId, { email, role })`, `updateUserRole(orgId, userId, role)`, `removeUser(orgId, userId)`, `inviteUser(orgId, { email, role })`, `getPendingInvitations(orgId)`, `cancelInvitation(orgId, invitationId)`

2. **Org user management page** — `apps/web/src/app/(platform)/settings/organization/users/page.tsx`
   - Client component, mirrors tenant users page structure
   - Uses `useOrgBehaviorAccess` to gate (org admin only)
   - Gets `organizationId` from current tenant's org context
   - Org role labels:
     ```
     ORG_OWNER  → 'Organization Owner'
     ORG_ADMIN  → 'Organization Admin'
     ORG_MEMBER → 'Organization Member'
     ORG_VIEWER → 'Organization Viewer'
     ```
   - Org role colors:
     ```
     ORG_OWNER  → purple
     ORG_ADMIN  → blue
     ORG_MEMBER → green
     ORG_VIEWER → gray
     ```
   - Only `ORG_OWNER` can change other users' roles or remove users
   - `ORG_ADMIN` can invite new members
   - Shows which tenant(s) each org user is also a member of (cross-reference)

3. **Tenant-scoped org users page** — `apps/web/src/app/t/[tenantId]/settings/organization/users/page.tsx`
   - Server component that wraps the client component with tenant context
   - Uses `OrgGuard` with `requireAdmin`

4. **Sidebar nav link** — Add "Org Team" to organization section in `buildTenantNav()`
   - `requiredGroup: 'IS_TENANT_ADMIN'` (or new `IS_ORG_ADMIN` gate)
   - href: `/t/${tenantId}/settings/organization/users`

5. **Settings card** — Add "Organization Team" card to `TenantSettings.tsx` in the Organization group
   - `accessOptions: { roles: ['admin', 'support'] }`
   - Links to org users page

6. **Update `OrgTeamOverview`** — Add "Manage Org Users" button alongside existing per-location "Manage" buttons
   - Link to `/t/${tenantId}/settings/organization/users`
   - Show org-level role badges in addition to per-tenant roles

**Files:**
- `apps/web/src/services/OrganizationUsersService.ts` (NEW)
- `apps/web/src/app/(platform)/settings/organization/users/page.tsx` (NEW)
- `apps/web/src/app/t/[tenantId]/settings/organization/users/page.tsx` (NEW)
- `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` (MODIFY — add nav link)
- `apps/web/src/components/settings/TenantSettings.tsx` (MODIFY — add settings card)
- `apps/web/src/components/organization/OrgTeamOverview.tsx` (MODIFY — add org users link)

---

## Future: Org Role Hierarchy & Permissions

Beyond explicit roles, future enhancements could include:

1. **Permission matrix** — Fine-grained org permissions (can_propagate, can_manage_billing, can_manage_locations, can_view_analytics)
2. **Role inheritance** — Org admin automatically gets tenant admin on all child tenants
3. **Org-level invitations** — Invite to org with auto-assignment to specific or all locations
4. **Audit log** — Track org role changes (who promoted whom)
5. **SSO mapping** — Map IdP groups to org roles for enterprise customers
