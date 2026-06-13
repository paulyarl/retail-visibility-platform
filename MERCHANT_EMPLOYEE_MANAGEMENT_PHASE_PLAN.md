# Merchant Employee Management — Phased Implementation Plan

**Date:** 2026-06-13
**Goal:** Tier-aware, self-serve team management for merchant tenants
**Status:** Consolidated plan covering platform plumbing + merchant flow

---

## Executive Summary

This plan merges backend platform plumbing with frontend merchant self-serve into three tightly-scoped phases. Each phase delivers a **shippable increment**.

| Phase | Theme | Ship Criteria |
|-------|-------|-------------|
| **Phase 1** | Foundation & Seat Gates | Backend routes exist, tier limits enforced, invite flow works end-to-end |
| **Phase 2** | Merchant Self-Serve UI | Team page has full CRUD, role editing, pending invites visible |
| **Phase 3** | Polish & Scale | Resend, badges, rate limits, email integration, audit parity |

---

## Prerequisites (Before Any Phase)

Confirm these constants from the audit:
- **Data model** (`apps/api/prisma/schema.prisma`): `users`, `user_tenants`, `invitations`, `user_tenant_role` enum are all present.
- **Auth0** is the identity provider (`auth0_id` on `users`, `AuthSyncService` handles post-login sync).
- **Existing routes** (`apps/api/src/routes/tenant-users.ts`): `GET`, `POST`, `PATCH`, `DELETE` for `/tenants/:tenantId/users`.
- **Existing merchant page** (`apps/web/src/app/t/[tenantId]/settings/users/page.tsx`): renders table, has broken invite modal.
- **Tier config** (`apps/api/src/config/tenant-limits.ts`): has location/product limits, **no user limits**.

---

## Phase 1: Foundation & Seat Gates

**Goal:** Make the invite flow functional and enforce tier-based team size limits.
**Effort:** ~2–3 days
**Deliverable:** Backend endpoints ready; merchant can invite by email and hit a seat gate.

### 1.1 Add Seat Limits to Tier Configuration

**File:** `apps/api/src/config/tenant-limits.ts`

Add a `userLimit` field to the existing `TenantLimitTier` config. The current config has `FEATURED_PRODUCTS_LIMITS` and `TENANT_LIMITS` (location counts). Add a parallel `USER_LIMITS` map.

```typescript
export interface UserLimitConfig {
  maxUsers: number;       // 0 = unlimited
  allowInvitations: boolean;
}

export const USER_LIMITS: Record<TenantLimitTier, UserLimitConfig> = {
  google_only:  { maxUsers: 1,  allowInvitations: false },
  discovery:    { maxUsers: 2,  allowInvitations: true },
  starter:      { maxUsers: 3,  allowInvitations: true },
  storefront:   { maxUsers: 5,  allowInvitations: true },
  commitment:   { maxUsers: 10, allowInvitations: true },
  professional: { maxUsers: 15, allowInvitations: true },
  enterprise:   { maxUsers: 0,  allowInvitations: true },  // 0 = unlimited
  organization: { maxUsers: 0,  allowInvitations: true },
};
```

Add helper:

```typescript
export function getUserLimit(tier: TenantLimitTier): UserLimitConfig {
  return USER_LIMITS[tier] || USER_LIMITS.starter;
}

export async function canAddTenantUser(tenantId: string): Promise<{ allowed: boolean; limit: number; current: number }> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { subscription_tier: true },
  });
  const config = getUserLimit(tenant?.subscription_tier as TenantLimitTier);
  
  if (config.maxUsers === 0) return { allowed: true, limit: 0, current: 0 };
  
  const currentUsers = await prisma.user_tenants.count({ where: { tenant_id: tenantId } });
  const pendingInvites = await prisma.invitations.count({
    where: { tenant_id: tenantId, accepted_at: null },
  });
  
  const total = currentUsers + pendingInvites;
  return { allowed: total < config.maxUsers, limit: config.maxUsers, current: total };
}
```

### 1.2 Create the Invite Endpoint

**File:** `apps/api/src/routes/tenant-users.ts`

Add:

```typescript
/**
 * POST /tenants/:tenantId/users/invite
 * Invite a user by email to join this tenant.
 * - If user exists → create user_tenants row
 * - If user does not exist → create invitations row
 * - Enforces seat limit
 */
router.post('/:tenantId/users/invite', requireTenantAdmin, async (req, res) => {
  const { tenantId } = req.params;
  const { email, role = 'MEMBER' } = req.body;
  
  // 1. Seat gate
  const seatCheck = await canAddTenantUser(tenantId);
  if (!seatCheck.allowed) {
    return res.status(403).json({
      error: 'seat_limit_reached',
      message: `This tenant has reached its team limit of ${seatCheck.limit} members.`,
      limit: seatCheck.limit,
      current: seatCheck.current,
    });
  }
  
  // 2. Find existing user
  const user = await prisma.users.findUnique({ where: { email: email.toLowerCase() } });
  
  if (user) {
    // Already in tenant?
    const existing = await prisma.user_tenants.findUnique({
      where: { user_id_tenant_id: { user_id: user.id, tenant_id: tenantId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'user_already_in_tenant', currentRole: existing.role });
    }
    
    // Add directly
    await prisma.user_tenants.create({
      data: {
        id: generateUserTenantId(user.id, tenantId),
        user_id: user.id,
        tenant_id: tenantId,
        role: role as user_tenant_role,
        updated_at: new Date(),
      },
    });
    
    await audit({ action: 'USER_TENANT_ASSIGNED', ... });
    return res.json({ success: true, status: 'added', user: { id: user.id, email: user.email } });
  }
  
  // 3. User does not exist → create invitation
  await prisma.invitations.create({
    data: {
      email: email.toLowerCase(),
      tenant_id: tenantId,
      role: role as user_tenant_role,
      invited_by: req.user.userId,
      // token + expires_at have defaults
    },
  });
  
  // 4. Trigger email (queue or direct)
  // await emailQueue.sendInvitation(email, tenantId, token);
  
  await audit({ action: 'USER_INVITATION_CREATED', ... });
  return res.json({ success: true, status: 'invited', email });
});
```

### 1.3 Add Invitation Lifecycle Routes

**File:** `apps/api/src/routes/tenant-users.ts` (or new `invitations.ts`)

```typescript
// GET /tenants/:tenantId/invitations — list pending invites
router.get('/:tenantId/invitations', requireTenantAdmin, async (req, res) => {
  const invites = await prisma.invitations.findMany({
    where: { tenant_id: req.params.tenantId, accepted_at: null },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, invitations: invites });
});

// DELETE /tenants/:tenantId/invitations/:id — cancel invite
router.delete('/:tenantId/invitations/:id', requireTenantAdmin, async (req, res) => {
  const { tenantId, id } = req.params;
  await prisma.invitations.deleteMany({
    where: { id, tenant_id: tenantId },
  });
  res.json({ success: true });
});
```

### 1.4 Wire Auth0 Signup to Auto-Accept Invitations

**File:** `apps/api/src/services/AuthSyncService.ts`

In the `syncUser` method, after creating/updating the `users` row, check for pending invitations:

```typescript
// After user is created/updated in DB
const pendingInvites = await prisma.invitations.findMany({
  where: { email: email.toLowerCase(), accepted_at: null },
});

for (const invite of pendingInvites) {
  await prisma.user_tenants.create({
    data: {
      id: generateUserTenantId(user.id, invite.tenant_id),
      user_id: user.id,
      tenant_id: invite.tenant_id,
      role: invite.role,
      updated_at: new Date(),
    },
  });
  await prisma.invitations.update({
    where: { id: invite.id },
    data: { accepted_at: new Date() },
  });
  await audit({ action: 'USER_INVITATION_ACCEPTED', ... });
}
```

**Also update** the frontend Auth0 callback handler (wherever the post-login redirect lands, likely `apps/web/src/app/api/auth/callback` or similar) to pass `invite_token` if present, so the backend can prioritize acceptance.

### 1.5 Add Owner Protection to Backend Mutations

**File:** `apps/api/src/routes/tenant-users.ts`

Update existing `DELETE` and `PATCH`:

```typescript
// In DELETE /:tenantId/users/:userId
// Prevent removing the last owner
const targetUser = await prisma.user_tenants.findUnique({
  where: { user_id_tenant_id: { user_id: userId, tenant_id: tenantId } },
});
if (targetUser?.role === 'OWNER') {
  const ownerCount = await prisma.user_tenants.count({
    where: { tenant_id: tenantId, role: 'OWNER' },
  });
  if (ownerCount <= 1) {
    return res.status(403).json({ error: 'cannot_remove_last_owner' });
  }
}

// In PATCH /:tenantId/users/:userId
// Only owners can assign OWNER role
if (req.body.role === 'OWNER') {
  const requesterRole = await getUserTenantRole(req.user.userId, tenantId);
  if (requesterRole !== 'OWNER') {
    return res.status(403).json({ error: 'only_owner_can_assign_owner' });
  }
}
```

### 1.6 Fix the Existing `POST /tenants/:tenantId/users` (Add Existing User)

**File:** `apps/api/src/routes/tenant-users.ts`

The existing `POST` route (adds existing user by email) should also enforce the seat gate. Insert the `canAddTenantUser()` check at the top.

---

## Phase 2: Merchant Self-Serve UI

**Goal:** The team page is fully functional for merchants: invite, view pending, change roles, remove, and see seat usage.
**Effort:** ~2–3 days
**Deliverable:** `/t/[tenantId]/settings/users` is shippable.

### 2.1 Fix the Invite Modal

**File:** `apps/web/src/app/t/[tenantId]/settings/users/page.tsx`

Update `handleInviteUser` to call the correct endpoint:

```typescript
const handleInviteUser = async (e: React.FormEvent) => {
  e.preventDefault();
  setInviting(true);
  setError('');
  setSuccess('');

  try {
    // Use the new invite endpoint
    const response = await tenantInfoService.inviteUser(tenantId, {
      email: inviteEmail,
      role: inviteRole,
    });

    if (response?.success) {
      const msg = response.status === 'invited'
        ? `Invitation sent to ${inviteEmail}`
        : `${inviteEmail} added to team`;
      setSuccess(`✅ ${msg}`);
      setInviteEmail('');
      setInviteRole('MEMBER');
      await loadUsers();
      await loadInvitations(); // new
      setTimeout(() => setInviteModalOpen(false), 2000);
    } else if (response?.error === 'seat_limit_reached') {
      setError(`Team limit reached (${response.current}/${response.limit}). Upgrade your plan to add more members.`);
    } else {
      throw new Error(response?.message || 'Failed to invite user');
    }
  } catch (err: any) {
    setError(err.message);
  } finally {
    setInviting(false);
  }
};
```

**Also fix the role dropdown** in the invite modal. Currently it shows:
- `USER` / `OWNER` (from old code)

Change to the actual `user_tenant_role` values:
- `MEMBER` — "Team Member"
- `ADMIN` — "Store Admin"
- `VIEWER` — "Viewer"
- `OWNER` — "Store Owner" (only visible if current user is OWNER)
- `SUPPORT` — "Support Staff" (only visible if current user is OWNER/ADMIN)

### 2.2 Add Pending Invitations Section

**File:** `apps/web/src/app/t/[tenantId]/settings/users/page.tsx`

Add state + loader:

```typescript
const [invitations, setInvitations] = useState<Invitation[]>([]);

const loadInvitations = async () => {
  const data = await tenantInfoService.getPendingInvitations(tenantId);
  setInvitations(data || []);
};
```

Render a second card below the team table:
- "Pending Invitations (3)"
- Columns: Email, Role, Invited, Expires
- Actions: Cancel (trash icon), Resend (future)

### 2.3 Add Inline Role Editing

**File:** `apps/web/src/app/t/[tenantId]/settings/users/page.tsx`

Replace the static role badge with a dropdown (or use a "Change Role" action in the row):

```typescript
const handleChangeRole = async (userId: string, newRole: string) => {
  await tenantInfoService.updateUserRole(tenantId, userId, newRole);
  await loadUsers();
};
```

Update the `TenantInfoService` to expose `updateUserRole` calling `PATCH /api/tenants/:tenantId/users/:userId`.

**Constraints:**
- Disable role change for self (prevents accidental self-demotion).
- Hide `OWNER` option unless current user is `OWNER`.
- Disable "Change Role" button for the sole owner (or show tooltip explaining they must transfer ownership first).

### 2.4 Add Seat Usage Banner

**File:** `apps/web/src/app/t/[tenantId]/settings/users/page.tsx`

At the top of the page, add a compact banner:

```
Team Seats: 3 of 5 used  |  2 pending invitations
[Upgrade Plan] — shown only if at >= 80% of limit
```

Fetch seat data from a lightweight endpoint, or include it in the `GET /tenants/:tenantId/users` response (add `seatInfo` field).

### 2.5 Update TenantInfoService

**File:** `apps/web/src/services/TenantInfoService.ts`

Add methods:

```typescript
async getPendingInvitations(tenantId: string): Promise<any[]> {
  const result = await this.makeDefaultRequest<any>(
    `/api/tenants/${tenantId}/invitations`,
    {},
    `tenant-invitations-${tenantId}`
  );
  return result.data?.invitations || [];
}

async cancelInvitation(tenantId: string, invitationId: string): Promise<any> {
  return this.makeDefaultRequest(
    `/api/tenants/${tenantId}/invitations/${invitationId}`,
    { method: 'DELETE' }
  );
}

async updateUserRole(tenantId: string, userId: string, role: string): Promise<any> {
  return this.makeDefaultRequest(
    `/api/tenants/${tenantId}/users/${userId}`,
    { method: 'PATCH', body: JSON.stringify({ role }) }
  );
}
```

### 2.6 Update Sidebar & Settings Card Visibility

**File:** `apps/web/src/components/settings/TenantSettings.tsx`

Ensure the "Team Members" card uses `ProtectedCard` with `AccessPresets.TENANT_ADMIN` (already does via `roles: ['admin', 'support']` — verify this is consistent with `AccessPresets`):

```typescript
{
  title: 'Team Members',
  description: 'Invite and manage your store team',
  href: `/t/${tenantId}/settings/users`,
  accessOptions: AccessPresets.TENANT_ADMIN, // or use ProtectedCard wrapper
}
```

**File:** `apps/web/src/components/navigation/DynamicTenantSidebar.tsx`

Already has:
```typescript
{ label: 'Team Members', href: `/t/${currentTenantId}/settings/users`, requiredPermission: 'CAN_MANAGE_TENANT_USERS' }
```

No change needed if permissions are correct.

---

## Phase 3: Polish & Scale

**Goal:** Production-grade UX, monitoring, and abuse prevention.
**Effort:** ~1–2 days

### 3.1 Resend Invitation

**Backend:**
- `POST /api/tenants/:tenantId/invitations/:id/resend`
- Regenerate token (`prisma.invitations.update({ data: { token: newToken(), expires_at: now + 7d } })`)
- Trigger email

**Frontend:**
- "Resend" button on pending invitation row.
- Rate limit: max 3 resends per invitation.

### 3.2 Invitation Status Badges

On the pending invitations list:
- "Pending" (blue)
- "Expired" (gray) — if `expires_at < now()`
- "Accepted" (green) — if `accepted_at` set (show in a separate "Recent Activity" list or filter)

### 3.3 Rate Limiting

**Backend:** Add express-rate-limit on invite endpoints per tenant:
- Max 10 invitations per tenant per hour.
- Max 3 invitations to the same email per day.

### 3.4 Email Integration

The platform likely already has an email service (check `apps/api/src/services/` for SendGrid/AWS SES). Create or reuse:

```typescript
// apps/api/src/services/EmailService.ts (or existing)
export async function sendTeamInvitation(email: string, tenantName: string, token: string) {
  const inviteUrl = `${process.env.FRONTEND_URL}/register?invite_token=${token}`;
  // ... send
}
```

### 3.5 Audit Logging Parity

Ensure every action writes an `audit_log` entry:
- `USER_INVITATION_CREATED`
- `USER_INVITATION_CANCELLED`
- `USER_INVITATION_ACCEPTED`
- `USER_TENANT_ASSIGNED` (existing)
- `USER_TENANT_REMOVED` (existing)
- `USER_TENANT_ROLE_CHANGED` (new)

### 3.6 Cleanup Job

Add a daily cron (or Supabase Edge Function) to delete expired invitations older than 30 days:

```sql
DELETE FROM invitations
WHERE accepted_at IS NOT NULL OR expires_at < NOW() - INTERVAL '30 days';
```

---

## File Reference Map

| Concern | Primary File(s) |
|---------|-----------------|
| **Tier config / seat limits** | `apps/api/src/config/tenant-limits.ts` |
| **Backend routes (CRUD)** | `apps/api/src/routes/tenant-users.ts` |
| **Auth0 post-login sync** | `apps/api/src/services/AuthSyncService.ts` |
| **Permission middleware** | `apps/api/src/middleware/permissions.ts` |
| **RBAC types (frontend)** | `apps/web/src/config/rbac.ts` |
| **Access control hook** | `apps/web/src/lib/auth/access-control.ts` |
| **Merchant team page** | `apps/web/src/app/t/[tenantId]/settings/users/page.tsx` |
| **Tenant settings cards** | `apps/web/src/components/settings/TenantSettings.tsx` |
| **Tenant user service** | `apps/web/src/services/TenantUserService.ts` |
| **Tenant info service** | `apps/web/src/services/TenantInfoService.ts` |
| **Sidebar nav** | `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` |
| **Database schema** | `apps/api/prisma/schema.prisma` |

---

## Testing Strategy

### Unit / Integration Tests
1. **Seat gate:** Invite 3 users on a `starter` tier; 4th invite returns `403 seat_limit_reached`.
2. **Owner protection:** Try to `DELETE` the only owner → `403 cannot_remove_last_owner`.
3. **Role escalation:** `ADMIN` tries to `PATCH` another user to `OWNER` → `403 only_owner_can_assign_owner`.
4. **Auto-accept:** New Auth0 user signs up with pending invitation → `user_tenants` row created automatically.
5. **Cancel invite:** `DELETE` invitation → no longer appears in pending list.

### Manual QA Checklist
- [ ] Merchant owner can invite existing user by email.
- [ ] Merchant owner can invite new user by email (creates pending invitation).
- [ ] Pending invitation appears in merchant UI.
- [ ] Seat counter updates in real time after invite/add.
- [ ] Seat limit blocks further invites with clear upgrade CTA.
- [ ] Role change works and refreshes the table.
- [ ] Remove user works (except last owner).
- [ ] Auth0 new signup with invite token auto-joins tenant.

---

## Risk & Rollback Plan

| Risk | Mitigation |
|------|------------|
| Existing invite endpoint missing causes 404 in production | Phase 1 creates the endpoint *before* any frontend change is deployed. |
| Auth0 callback change breaks login | Gate the auto-accept logic behind a feature flag or try/catch; fallback to normal login. |
| Seat limit retroactively blocks existing over-limit tenants | When enforcing limits, grandfather existing tenants: only block *new* invites. Add a migration script to mark over-limit tenants. |
| Email delivery failures | Store invitation in DB regardless; email is best-effort. Merchant can resend manually. |

---

## Success Metrics

After all three phases:
- **Zero** support tickets for "how do I add my employee?"
- **100%** of tenant owners can self-serve invite → accept → manage roles without platform admin intervention.
- **Tier conversion lift:** Track how many users hit seat limit and upgrade within 7 days.

---

*Plan created by Cascade on 2026-06-13. Coordinates with `MERCHANT_EMPLOYEE_MANAGEMENT_AUDIT.md`.*
