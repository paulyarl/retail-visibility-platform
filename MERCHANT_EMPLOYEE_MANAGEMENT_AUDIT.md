# Merchant Employee Management — Platform Audit & Recommendations

**Date:** 2026-06-13
**Scope:** Self-serve team/employee CRUD for tenant owners/admins
**Status:** Partially implemented; critical gaps identified

---

## 1. Current State Summary

The platform already has the foundational pieces for merchant employee management, but the **end-to-end self-serve flow is incomplete and partially broken**.

### 1.1 What Works Today

| Component | Status | Notes |
|-----------|--------|-------|
| **Data model** | ✅ Solid | `users`, `user_tenants`, `invitations` tables; `user_tenant_role` enum |
| **Backend CRUD** | ✅ Mostly exists | `GET/POST/PATCH/DELETE /tenants/:tenantId/users` |
| **RBAC middleware** | ✅ Exists | `requireTenantAdmin`, `requireTenantRole` |
| **Frontend list page** | ✅ Exists | `/t/[tenantId]/settings/users` renders team table |
| **Navigation** | ✅ Wired | Sidebar + TenantSettings card link to team page |
| **Access control** | ✅ Exists | `useAccessControl` + `AccessPresets` |

### 1.2 What Is Broken or Missing

| Component | Status | Risk |
|-----------|--------|------|
| **Invite endpoint** | ❌ **Broken** | Frontend calls `POST /api/tenants/:tenantId/users/invite` — **route does not exist** |
| **Email invitation flow** | ❌ Missing | No self-serve way to invite *new* users; requires pre-registration |
| **Role editing in merchant UI** | ❌ Missing | Merchant page only has "Remove"; no change-role action |
| **Pending invitations view** | ❌ Missing | Merchants cannot see or cancel outstanding invites |
| **Seat/tier limits** | ❌ Missing | No enforcement of team size by subscription tier |
| **SUPPORT role exposure** | ⚠️ Omitted | `SUPPORT` exists in `user_tenant_role` but is hidden from merchant UI |
| **Owner self-protection** | ⚠️ Weak | No safeguard preventing an owner from removing themselves |

---

## 2. Architecture Deep Dive

### 2.1 Database Schema

```prisma
model users {
  id         String   @id
  email      String   @unique
  role       user_role @default(USER)   -- PLATFORM-level role
  auth0_id   String?  @unique
  ...
  user_tenants user_tenants[]
}

model user_tenants {
  id         String           @id
  user_id    String
  tenant_id  String
  role       user_tenant_role @default(MEMBER)  -- TENANT-level role
  @@unique([user_id, tenant_id])
}

model invitations {
  id          String   @id @default(uuid())
  email       String   @unique
  token       String   @unique
  tenant_id   String
  role        user_tenant_role @default(MEMBER)
  invited_by  String
  expires_at  DateTime @default(now() + 7 days)
  accepted_at DateTime?
}

enum user_tenant_role {
  OWNER
  ADMIN
  SUPPORT
  MEMBER
  VIEWER
}
```

**Key insight:** The `users.role` field is the **platform-level** role (e.g., `PLATFORM_ADMIN`, `USER`). Tenant membership is stored in `user_tenants` with `OWNER/ADMIN/SUPPORT/MEMBER/VIEWER`. This is a clean separation.

### 2.2 Existing Backend Routes (`apps/api/src/routes/tenant-users.ts`)

| Method | Route | Middleware | Behavior |
|--------|-------|------------|----------|
| `GET` | `/tenants/:tenantId/users` | `checkTenantAccess` | Lists all users in tenant |
| `POST` | `/tenants/:tenantId/users` | `requireTenantAdmin` | Adds **existing** user by email to tenant |
| `PATCH`| `/tenants/:tenantId/users/:userId`| `requireTenantAdmin`| Updates user's tenant role |
| `DELETE`| `/tenants/:tenantId/users/:userId`| `requireTenantAdmin`| Removes user from tenant |

**Critical gap:** There is no `POST /tenants/:tenantId/users/invite` route, yet `TenantInfoService.inviteUser()` calls exactly that. The invite modal in the merchant UI is therefore non-functional.

### 2.3 Existing Frontend (`apps/web/src/app/t/[tenantId]/settings/users/page.tsx`)

- Uses `useAccessControl(tenantId, AccessPresets.SUPPORT_OR_TENANT_ADMIN)`
- Calls `tenantInfoService.getUsers()` → `GET /api/tenants/:tenantId/users` ✅
- Calls `tenantInfoService.inviteUser()` → `POST /api/tenants/:tenantId/users/invite` ❌ (404)
- Calls `tenantInfoService.deleteUser()` → `DELETE /api/tenants/:tenantId/users/:userId` ✅
- **No** role-change UI (no PATCH call)
- **No** pending invitations list

### 2.4 Role Hierarchy & Permissions

**Tenant roles (self-serve scope):**
- `OWNER` — Full control, billing, can manage users
- `ADMIN` — Can manage users and settings, cannot delete tenant or change owner
- `SUPPORT` — Can view data, manage tickets/tasks (CRM), limited write
- `MEMBER` — Can manage inventory, products, view analytics
- `VIEWER` — Read-only

**Frontend RBAC config** (`apps/web/src/config/rbac.ts`):
- `CAN_MANAGE_TENANT_USERS` = OWNER, TENANT_ADMIN, PLATFORM_ADMIN, ADMIN
- This means any tenant owner or admin can manage employees.

---

## 3. Identified Gaps & Risks

### Gap 1: Broken Invite Flow (HIGH)
The merchant invite modal submits to a non-existent endpoint. The only working flow is the platform-admin `/api/admin/users/invite-by-email` route, which is not exposed to merchants.

### Gap 2: No New-User Onboarding Path (HIGH)
The existing `POST /tenants/:tenantId/users` only works if the invited email **already has an account** in the `users` table. A merchant cannot invite a brand-new employee who has never logged in.

### Gap 3: Missing Self-Serve Role Management (MEDIUM)
Merchants can remove users but cannot change their roles. This forces platform support intervention for promotions/demotions.

### Gap 4: No Invitation Lifecycle (MEDIUM)
No view of pending invites, no ability to resend or cancel invites, no expiration handling in UI.

### Gap 5: No Seat Limits (MEDIUM)
Subscription tiers define location limits and featured-product limits, but there are no `user_limit` or `seat_limit` gates per tier. This is a monetization gap.

### Gap 6: Owner Self-Removal Risk (LOW)
A tenant owner can remove themselves, potentially orphaning the tenant. The backend `DELETE` route does not protect against this.

---

## 4. Recommendations

### 4.1 Immediate Fixes (Phase 1 — Broken Flow)

1. **Create the missing invite endpoint**
   - `POST /api/tenants/:tenantId/users/invite`
   - Accepts `{ email, role }`
   - If user exists → create `user_tenants` row (same as today)
   - If user does **not** exist → create `invitations` row with token
   - Send email with invitation link (or queue for email service)
   - Enforce `requireTenantAdmin`

2. **Add invitation acceptance flow**
   - `GET /api/invitations/:token` — validate token, show pre-filled signup
   - On Auth0 signup completion → `AuthSyncService` should check for pending invitations and auto-create `user_tenants` rows
   - Mark `invitations.accepted_at`

3. **Expose pending invitations on the team page**
   - `GET /api/tenants/:tenantId/invitations` — list pending invites
   - Allow `DELETE /api/tenants/:tenantId/invitations/:id` to cancel

### 4.2 Feature Completion (Phase 2 — Self-Serve CRUD)

4. **Add inline role editing to the merchant team page**
   - Call existing `PATCH /api/tenants/:tenantId/users/:userId` from the UI
   - Restrict `OWNER` role assignment so only existing owners can promote others to owner
   - Restrict demotion: an owner cannot demote the *last* owner

5. **Add owner self-protection**
   - Backend: reject `DELETE` if user is the sole `OWNER` of the tenant
   - Frontend: disable remove button for self if sole owner

6. **Add seat limits by tier**
   - Add `userLimit` to `TenantLimitTier` config (`apps/api/src/config/tenant-limits.ts`)
   - Example:
     - `google_only`: 1 user (owner only)
     - `starter`: 3 users
     - `professional`: 10 users
     - `enterprise`: unlimited
   - Enforce in `POST /tenants/:tenantId/users/invite` and `POST /tenants/:tenantId/users`

### 4.3 UX Polish (Phase 3)

7. **Resend invitation action**
   - Regenerate token, reset `expires_at`, optionally send new email

8. **Invitation status badges**
   - "Pending", "Expired", "Accepted" in pending-invitations list

9. **Audit logging for team changes**
   - All invite/role-change/removal actions already have audit hooks; ensure they are used consistently in the new endpoints

### 4.4 Auth0 Integration Note

Because the platform uses **Auth0** for identity, invitation acceptance must align with the Auth0 flow:

- **Option A (Recommended):** Invitation email contains a link to `/register?invite_token=XYZ`. After Auth0 universal login/signup, the callback triggers `AuthSyncService.syncUser()`, which checks the token and auto-joins the tenant.
- **Option B:** Use Auth0's built-in invitation API (requires Organization feature + paid plan). This is likely overkill given the current custom `invitations` table.

**Stick with Option A** to minimize Auth0 dependency changes.

---

## 5. Suggested Implementation Order

| Phase | Task | Effort | Files Touched |
|-------|------|--------|---------------|
| **P1** | Create `POST /tenants/:tenantId/users/invite` | Small | `apps/api/src/routes/tenant-users.ts` |
| **P1** | Wire Auth0 callback to auto-accept invitations | Small | `apps/api/src/services/AuthSyncService.ts` |
| **P1** | Add `GET/DELETE` invitation routes | Small | `apps/api/src/routes/tenant-users.ts` |
| **P1** | Fix frontend invite modal to use working endpoint | Small | `apps/web/src/app/t/[tenantId]/settings/users/page.tsx` |
| **P2** | Add role-change UI (PATCH) | Small | `apps/web/src/app/t/[tenantId]/settings/users/page.tsx` |
| **P2** | Add pending invitations list + cancel | Medium | Same + new component |
| **P2** | Add owner-protection to backend DELETE | Small | `apps/api/src/routes/tenant-users.ts` |
| **P2** | Add seat limits to tenant config & enforce | Medium | `apps/api/src/config/tenant-limits.ts`, invite route |
| **P3** | Resend invitation, badges, UX polish | Small | Frontend only |

---

## 6. Security Checklist

- [ ] `requireTenantAdmin` middleware on all mutation endpoints
- [ ] Prevent non-owners from assigning `OWNER` role
- [ ] Prevent removal of sole owner
- [ ] Prevent inviting users beyond tier seat limit
- [ ] Invitation tokens are cryptographically random (`gen_random_bytes(32)`)
- [ ] Invitation tokens expire (7 days) — verify cleanup job or handle expired gracefully
- [ ] Rate-limit invitation sends per tenant
- [ ] Audit log every mutation (`USER_TENANT_ASSIGNED`, `USER_TENANT_REMOVED`, `USER_TENANT_ROLE_CHANGED`)

---

## 7. Conclusion

The platform is **~60% complete** on merchant employee management. The data model and read-backend are solid. The critical blockers are:

1. A **missing API route** that breaks the invite button.
2. **No path for inviting new users** who don't already have Auth0 accounts.
3. **Missing role-change and invitation-lifecycle UI**.

Fixing the invite endpoint and wiring it into the Auth0 signup callback would unblock merchants immediately. The remaining work is incremental UI and policy enforcement.

---

*Report generated by Cascade audit on 2026-06-13.*
