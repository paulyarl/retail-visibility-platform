# Organization Behavior Guard — Audit & Regression

## 1. Entrance Point Audit

### API Routes (Backend)

| Route | Method | File | Middleware | Gate |
|-------|--------|------|-----------|------|
| `/organizations/:id/self-update` | PUT | `organizations.ts:547` | `authenticateToken, requireOrgAdmin` | Org admin only |
| `/organizations/:id/items/propagate` | POST | `organizations.ts:683` | `authenticateToken, requireOrgAdmin` | Org admin only |
| `/organizations/:id/items/propagate-bulk` | POST | `organizations.ts:1255` | `authenticateToken, requireOrgAdmin` | Org admin only |
| `/organizations/:id/hero-location` | PUT | `organizations.ts:1938` | `authenticateToken, requireOrgAdmin` | Org admin only |
| `/organizations/:organizationId/commerce-settings` | PUT | `organization-commerce-settings.ts:111` | `authenticateToken, requireOrgAdmin` | Org admin only |
| `/organization-requests` | POST | `organization-requests.ts:97` | `authenticateToken, requireOrgMember` | Org member+ |
| `/organization-requests/:id` | PATCH | `organization-requests.ts:143` | `authenticateToken, requireOrgAdminForRequest` | Org admin only |
| `/organization-requests/:id` | DELETE | `organization-requests.ts:213` | `authenticateToken, requireOrgAdminForRequest` | Org admin only |
| `/organizations/:orgId/bot/chat/start` | POST | `organization-capabilities.ts:543` | `authenticateToken, requireOrgMember` | Org member+ |
| `/organizations/:orgId/bot/chat/message` | POST | `organization-capabilities.ts:589` | `authenticateToken, requireOrgMember` | Org member+ |

### Frontend Components (Web)

| Component | File | readOnly Behavior |
|-----------|------|-------------------|
| `OrganizationDashboard` | `OrganizationDashboard.tsx` | Computes `readOnly = !isOrgAdmin` via `useOrgBehaviorAccess`, passes to all children |
| `OrgCommerceCard` | `OrgCommerceCard.tsx` | Configure button + link disabled when `readOnly` |
| `OrgQuickActionsBar` | `OrgQuickActionsBar.tsx` | All action buttons (Sync, Propagation, Team, Commerce, Billing) disabled when `readOnly` |
| `OrgHeroLocationModal` | `OrgHeroLocationModal.tsx` | Location selection buttons disabled when `readOnly` |
| `OrgCategorySyncModal` | `OrgCategorySyncModal.tsx` | Radio buttons, tenant selector, Sync Now button disabled when `readOnly` |
| `OrgBotWidget` | `OrgBotWidget.tsx` | Entire widget hidden when `readOnly` |
| `OrgPlanSummaryPanel` | `OrgPlanSummaryPanel.tsx` | Upgrade links disabled with grey styling when `readOnly` |
| `OrgPropagationPanel` | `OrgPropagationPanel.tsx` | All 8 PropCard action buttons disabled when `readOnly` |

### Sidebar Navigation

| Nav Item | Gate | File |
|----------|------|------|
| Organization Dashboard | `requiredOrgAdmin: true` | `DynamicTenantSidebar.tsx:350` (fallback) + DB migration `074_nav_org_admin_gating.sql` |
| Propagation Settings | `requiredOrgAdmin: true` | `DynamicTenantSidebar.tsx:351` (fallback) + DB migration `074_nav_org_admin_gating.sql` |
| Propagation Center | `requiredOrgAdmin: true` | `DynamicTenantSidebar.tsx:352` (fallback) + DB migration `074_nav_org_admin_gating.sql` |

**Filter chain in DynamicTenantSidebar:**
```
filterNavItems (platform RBAC)
  → filterByCapability (capability flags)
    → filterByTenantRole (tenant admin role)
      → filterByOrgRole (org admin role)
```

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useOrgBehaviorAccess` | `hooks/tenant-access/useOrgBehaviorAccess.ts` | Returns `isOrgAdmin`, `isOrgMember`, `isPlatformAdmin` — checks hero tenant admin role |
| `useOrgDashboardData` | `hooks/organization/useOrgDashboardData.ts` | Fetches org dashboard data, determines `userCanAccess` |

### Middleware (Backend)

| Middleware | File | Purpose |
|-----------|------|---------|
| `requireOrgAdmin` | `middleware/permissions.ts` | Checks user is admin of hero tenant or platform admin |
| `requireOrgMember` | `middleware/permissions.ts` | Checks user is member of org (any tenant in org) or platform admin |
| `requireOrgAdminForRequest` | `middleware/permissions.ts` | Resolves org ID from request ID, then checks org admin |

## 2. E2E Test Matrix

| Entrance Point | Org Admin | Tenant Admin (non-hero) | Tenant Member | Platform Admin |
|---------------|-----------|------------------------|---------------|----------------|
| Org settings pages | Full access | AccessDenied | AccessDenied | Full access |
| Org commerce settings | Full access | Read-only | Read-only | Full access |
| Propagation | Full access | AccessDenied | AccessDenied | Full access |
| Org dashboard widgets | Interactive | Read-only | Read-only | Interactive |
| Sidebar org links | Visible | Hidden | Hidden | Visible |
| API org write (PUT/POST/DELETE) | 200 | 403 | 403 | 200 |
| API org read (GET) | 200 | 200 | 200 | 200 |
| Org bot chat | Enabled | Enabled (member) | Enabled (member) | Enabled |
| Org requests (create) | 200 | 200 (member) | 200 (member) | 200 |
| Org requests (approve/reject/delete) | 200 | 403 | 403 | 200 |

## 3. Regression Check

- `pnpm checkapi` — zero TS errors ✅
- `pnpm checkweb` — zero TS errors ✅

## 4. Migration

- `074_nav_org_admin_gating.sql` — Tags existing DB org nav links with `{"requiredOrgAdmin": true}` in metadata JSONB

## 5. Architecture Notes

- **Current model**: Org admin = tenant admin of hero tenant (piggyback on tenant roles)
- **Future**: `user_organizations` table with explicit `ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`, `ORG_VIEWER` roles (Phase 7)
- **Platform admin bypass**: All org-level permission checks allow platform admin through
