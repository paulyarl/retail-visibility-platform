---
description: Multi-layer RBAC pattern that gates all capability-altering entrance points (settings pages, sidebar nav, dashboard widgets, API routes) using tenant-specific role checks via useTenantBehaviorAccess hook and requireTenantAdmin middleware
---

# Tenant Behavior Guard

## Problem

Capability-altering features (commerce settings, fulfillment options, product options, bot config, etc.) had multiple entrance points where a non-admin tenant user could reach and modify tenant behavior:

| Entrance Point | Risk |
|---|---|
| Settings pages (`/settings/commerce`, `/settings/product-options`, etc.) | Any tenant member could navigate directly via URL |
| Sidebar nav links | Non-admin users see links to pages they can't access |
| Dashboard widgets (`PlanSummaryPanel`, `CapabilityShowcase`) | Clickable links route non-admins to gated pages |
| `TenantSettings` cards | Cards were clickable by all roles |
| API PUT/POST routes | No tenant-role check on write operations |

The platform has two role dimensions: **platform role** (`user.role` — e.g. `PLATFORM_ADMIN`) and **tenant-specific role** (`getTenantRole(user, tenantId)` — e.g. `TENANT_MEMBER`). Existing RBAC (`useRBAC`, `filterNavItems`) only checks platform role. A `TENANT_ADMIN` on one tenant might be a `TENANT_MEMBER` on another — the guard must check the **tenant-specific** role.

## Solution: 5-Layer Defense in Depth

```
Layer 1: Sidebar Navigation     → filterByTenantRole() hides admin links
Layer 2: TenantSettings Cards   → UnifiedSettings disables cards with lock icon
Layer 3: Dashboard Components   → readOnly prop disables interactive elements
Layer 4: Page-Level Guard       → TenantGuard shows AccessDenied page
Layer 5: API Middleware         → requireTenantAdmin returns 403
```

Each layer is independent. If one fails, the next blocks unauthorized access.

### Authorized Roles

The `IS_TENANT_ADMIN` role group (defined in `apps/web/src/config/rbac.ts`) includes:
- `OWNER`, `TENANT_ADMIN`, `TENANT_OWNER`, `ADMIN`
- `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`

These roles get `canEdit: true` from `useTenantBehaviorAccess`, granting full access.

---

## Architecture

### Key Components

| Component | File | Layer | Purpose |
|---|---|---|---|
| `useTenantBehaviorAccess` | `apps/web/src/hooks/tenant-access/useTenantBehaviorAccess.ts` | All | Hook returning `canEdit`, `loading`, `tenantRole`, `isPlatformAdmin` |
| `TenantGuard` | `apps/web/src/components/tenant/TenantGuard.tsx` | 4 | Page-level wrapper showing AccessDenied when `!canEdit` |
| `TenantBehaviorGuard` | `apps/web/src/components/tenant/TenantBehaviorGuard.tsx` | 2-3 | Inline UI guard for conditional rendering |
| `UnifiedSettings` | `apps/web/src/components/settings/UnifiedSettings.tsx` | 2 | Settings card renderer with role enforcement |
| `DynamicTenantSidebar` | `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | 1 | Sidebar with `filterByTenantRole` |
| `requireTenantAdmin` | `apps/api/src/middleware/permissions.ts` | 5 | API middleware for write-operation role enforcement |

### Data Flow

```
User navigates to /t/{tenantId}/settings/commerce
  ↓
Layer 1: Sidebar hides the link (filterByTenantRole removes IS_TENANT_ADMIN items)
  ↓ (user types URL directly)
Layer 4: TenantGuard wraps the page
  ↓
  useTenantBehaviorAccess(tenantId)
    → useAccessControl(tenantId, AccessPresets.CAN_MANAGE_TENANT_SETTINGS)
      → getTenantRole(user, tenantId) from AuthContext user.tenants[]
      → isTenantOwnerOrAdmin(user, tenantId) check
    → returns { canEdit: false, loading: false }
  ↓
  TenantGuard renders <AccessDenied /> instead of children
  ↓ (if user somehow submits to API)
Layer 5: requireTenantAdmin middleware on PUT /api/tenants/:tenantId/commerce-settings
  → checks tenant role from DB
  → returns 403 Forbidden
```

---

## Implementation Guide

### 1. Gating a New Settings Page (Layer 4)

Wrap the page component with `TenantGuard`:

```tsx
// apps/web/src/app/t/[tenantId]/settings/my-feature/page.tsx
import { TenantGuard } from '@/components/tenant/TenantGuard';
import MyFeatureClient from './MyFeatureClient';

export default async function MyFeaturePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <TenantGuard tenantId={tenantId}>
      <MyFeatureClient tenantId={tenantId} />
    </TenantGuard>
  );
}
```

`TenantGuard` uses `useTenantBehaviorAccess` internally and shows `AccessDenied` when `!canEdit`.

### 2. Gating a Sidebar Nav Item (Layer 1)

Add `requiredGroup: 'IS_TENANT_ADMIN'` to the nav item in `buildTenantNav()`:

```tsx
// apps/web/src/components/navigation/DynamicTenantSidebar.tsx
{
  label: 'My Feature',
  href: `/t/${currentTenantId}/settings/my-feature`,
  requiredGroup: 'IS_TENANT_ADMIN',  // ← hides for non-admin tenant roles
}
```

For DB-driven nav links, set `required_group` column to `'IS_TENANT_ADMIN'` in the `navigation_links` table.

**How filtering works:** `DynamicTenantSidebar` calls `useTenantBehaviorAccess(tenantId)` → `canEdit`. The `filterByTenantRole` function removes items with `requiredGroup: 'IS_TENANT_ADMIN'` when `!canEdit`. This is applied to both DB-driven and fallback nav arrays.

### 3. Gating a TenantSettings Card (Layer 2)

Add `accessOptions: { roles: ['admin', 'support'] }` to the card definition:

```tsx
// apps/web/src/components/settings/TenantSettings.tsx
{
  title: 'My Feature',
  href: `/t/${tenantId}/settings/my-feature`,
  color: 'bg-blue-500',
  accessOptions: { roles: ['admin', 'support'] },
}
```

`UnifiedSettings` checks `canEdit` from `useTenantBehaviorAccess`. When `!canEdit`:
- Card renders greyed out
- Click navigation is disabled
- Lock icon badge appears
- Tooltip: "Admin access required"

### 4. Gating Dashboard Widgets (Layer 3)

Pass `readOnly` prop based on `canEdit`:

```tsx
const { canEdit } = useTenantBehaviorAccess(tenantId);

<PlanSummaryPanel readOnly={!canEdit} />
<CapabilityShowcase readOnly={!canEdit} />
```

When `readOnly` is true:
- `PlanSummaryPanel`: Capability card links are non-clickable
- `CapabilityShowcase`: `Link` components replaced with non-clickable `div`

### 5. Gating an API Route (Layer 5)

Apply `requireTenantAdmin` middleware to PUT/POST routes:

```ts
// apps/api/src/routes/my-feature-settings.ts
import { requireTenantAdmin } from '../middleware/permissions';

router.put('/:tenantId/my-feature', requireTenantAdmin, async (req, res) => {
  // Only IS_TENANT_ADMIN roles reach here
  // ...update logic...
});
```

**GET routes remain open** — all authenticated tenant members can read capability settings. Only write operations are gated.

---

## The `useTenantBehaviorAccess` Hook

```ts
// apps/web/src/hooks/tenant-access/useTenantBehaviorAccess.ts
export function useTenantBehaviorAccess(tenantId: string): {
  canEdit: boolean;       // true if user's tenant role is in IS_TENANT_ADMIN group
  loading: boolean;       // true while auth context loads
  tenantRole: string | null;  // user's role for this specific tenant
  isPlatformAdmin: boolean;   // true if user is PLATFORM_ADMIN/SUPPORT
}
```

Internally calls `useAccessControl(tenantId, AccessPresets.CAN_MANAGE_TENANT_SETTINGS)` which:
1. Gets `user` from `AuthContext`
2. Calls `getTenantRole(user, tenantId)` — looks up `user.tenants[].role` for this tenant
3. Calls `isTenantOwnerOrAdmin(user, tenantId)` — checks if role is OWNER/TENANT_OWNER/TENANT_ADMIN/ADMIN
4. Platform admins (`isPlatformAdmin`) bypass tenant role checks

---

## The `filterByTenantRole` Function

Located in `DynamicTenantSidebar.tsx`:

```ts
const filterByTenantRole = (navItems: NavItem[]): NavItem[] => {
  if (canEdit) return navItems; // User is tenant admin, show everything
  return navItems
    .filter(item => (item as any).requiredGroup !== 'IS_TENANT_ADMIN')
    .map(item => ({
      ...item,
      children: item.children ? filterByTenantRole(item.children) : item.children,
    }))
    .filter(item => !item.children || item.children.length > 0 || !item.href);
};
```

Applied in the `items` useMemo alongside existing filters:

```ts
return filterByTenantRole(filterByCapability(filterNavItems(processedItems)));
```

**Filter order matters:** `filterNavItems` (platform RBAC) → `filterByCapability` (capability flags) → `filterByTenantRole` (tenant role).

---

## E2E Test Matrix

| Entrance Point | TENANT_ADMIN | TENANT_MANAGER | TENANT_MEMBER | TENANT_VIEWER |
|---|---|---|---|---|
| Capability settings pages | Full access | AccessDenied | AccessDenied | AccessDenied |
| PlanSummaryPanel links | Clickable | Read-only | Read-only | Read-only |
| CapabilityShowcase links | Clickable | Read-only | Read-only | Read-only |
| TenantSettings cards | Clickable | Disabled | Disabled | Disabled |
| Sidebar nav links (admin) | Visible | Hidden | Hidden | Hidden |
| Sidebar nav links (manager) | Visible | Visible | Hidden | Hidden |
| Sidebar nav links (general) | Visible | Visible | Visible | Visible |
| API PUT/POST | 200 | 403 | 403 | 403 |
| API GET | 200 | 200 | 200 | 200 |

---

## Audit Checklist

When adding a new capability-altering feature, verify all 5 layers:

- [ ] **Layer 1 — Sidebar:** Add `requiredGroup: 'IS_TENANT_ADMIN'` to nav item in `buildTenantNav()` and/or set `required_group` column in `navigation_links` table
- [ ] **Layer 2 — Settings Card:** Add `accessOptions: { roles: ['admin', 'support'] }` to card in `TenantSettings.tsx`
- [ ] **Layer 3 — Dashboard:** Pass `readOnly={!canEdit}` to `PlanSummaryPanel` and `CapabilityShowcase`
- [ ] **Layer 4 — Page Guard:** Wrap page with `<TenantGuard tenantId={tenantId}>`
- [ ] **Layer 5 — API:** Apply `requireTenantAdmin` middleware to PUT/POST route

---

## Key Files

| File | Purpose |
|---|---|
| `apps/web/src/hooks/tenant-access/useTenantBehaviorAccess.ts` | Core hook — tenant-specific role check |
| `apps/web/src/components/tenant/TenantGuard.tsx` | Page-level guard wrapper |
| `apps/web/src/components/tenant/TenantBehaviorGuard.tsx` | Inline UI guard |
| `apps/web/src/components/settings/UnifiedSettings.tsx` | Settings cards with role enforcement |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | Sidebar with `filterByTenantRole` |
| `apps/web/src/lib/auth/useAccessControl.ts` | Access control hook with `getTenantRole` |
| `apps/web/src/lib/auth/access-control.ts` | `getTenantRole`, `isTenantOwnerOrAdmin`, `hasTenantRole` functions |
| `apps/web/src/config/rbac.ts` | Role groups (`IS_TENANT_ADMIN`, `IS_TENANT_MANAGER`, etc.) |
| `apps/api/src/middleware/permissions.ts` | `requireTenantAdmin` API middleware |
| `docs/TENANT_BEHAVIOR_GUARD_AUDIT.md` | Full audit report with all entrance points |

## Related Skills

- `capability-deployment-flow.md` — How capabilities are deployed and gated by tier
- `capability-data-flow-rules.md` — Rules for capability data flow and resolver patterns
- `database-navigation-system.md` — DB-driven sidebar navigation system
- `server-resolved-context-delegator.md` — Server-resolved auth/tenant state pattern
