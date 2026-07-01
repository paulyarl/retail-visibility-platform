# Tenant Behavior Guard Sprint Plan

## Problem Statement

Capabilities are the primary mechanism for controlling tenant behavior. The platform exposes numerous entrance points where tenant behavior can be altered — `PlanSummaryPanel`, capability options settings pages, `CapabilityShowcase`, dynamic controls on dashboards, and the `TenantSettings` hub.

Tenants can self-serve invite employees into roles (`TENANT_MEMBER`, `TENANT_VIEWER`, `TENANT_USER`, `TENANT_MANAGER`, `TENANT_SUPPORT`). Currently, **any authenticated tenant member can access and alter capability settings** because:

1. **No frontend guard** — Capability settings pages have no `TenantGuard` component (unlike `AdminGuard` for platform admin pages)
2. **No backend role enforcement** — Capability settings API routes (`storefront-options-settings.ts`, `featured-options-settings.ts`, `product-options-settings.ts`, etc.) only use `authenticateToken` middleware — no role check
3. **Advisory-only access options** — `TenantSettings.tsx` cards have `accessOptions: { roles: ['admin', 'support'] }` but these are not enforced
4. **Dashboard panels are ungated** — `PlanSummaryPanel` and `CapabilityShowcase` render for all roles with clickable links to settings pages

### Authorized Roles for Tenant Behavior Alteration

Only these roles may alter tenant behavior (capability settings):
- **PLATFORM_ADMIN** / **ADMIN** — Platform-level override
- **TENANT_ADMIN** / **TENANT_OWNER** — Tenant-level admin
- **OWNER** — Organization owner

All other roles (`TENANT_MANAGER`, `TENANT_USER`, `TENANT_MEMBER`, `TENANT_VIEWER`, `TENANT_SUPPORT`, `USER`) must be **read-only** for capability settings.

### Existing Infrastructure

- **`AdminGuard`** (`apps/web/src/components/admin/AdminGuard.tsx`) — Gates platform admin pages using `AccessPresets.PLATFORM_ADMIN_ONLY`
- **`AccessGate`** (`apps/web/src/components/permissions/AccessGate.tsx`) — Tier/role gate for individual features (uses `useTenantTier`)
- **`useAccessControl`** hook (`apps/web/src/lib/auth/useAccessControl.ts`) — Returns `isTenantAdmin`, `tenantRole`, `hasAccess` for given presets
- **`AccessPresets`** (`apps/web/src/lib/auth/access-control.ts`) — Includes `CAN_MANAGE_TENANT_SETTINGS` and `TENANT_ADMIN` presets
- **RBAC config** (`apps/web/src/config/rbac.ts`) — `PERMISSION_GROUPS.CAN_MANAGE_TENANT_SETTINGS` = `[OWNER, TENANT_ADMIN, PLATFORM_ADMIN, ADMIN]`
- **Backend auth middleware** (`apps/api/src/middleware/auth.ts`) — `authenticateToken` only checks identity, not role

---

## Sprint Phases

### Phase 1: TenantGuard Component (P0 — Frontend Gate)

**Goal:** Create a reusable `TenantGuard` component mirroring `AdminGuard`, using the existing `useAccessControl` hook with `AccessPresets.CAN_MANAGE_TENANT_SETTINGS`.

**Deliverables:**

1. **`TenantGuard.tsx`** — New component at `apps/web/src/components/tenant/TenantGuard.tsx`
   - Accepts `tenantId: string` and `children: ReactNode`
   - Uses `useAccessControl(tenantId, AccessPresets.CAN_MANAGE_TENANT_SETTINGS)`
   - Shows loading spinner while `loading` is true
   - Shows `AccessDenied` component (reuse existing) when `!hasAccess`
   - Renders children when `hasAccess`
   - Pattern mirrors `AdminGuard` exactly

2. **`TenantBehaviorGuard.tsx`** — Inline guard variant for wrapping individual controls (toggles, buttons) within pages
   - Accepts `tenantId`, `children`, optional `fallback` render prop
   - Returns `null` or disabled state when unauthorized
   - For granular control within pages that mix read-only and write sections

3. **`useTenantBehaviorAccess`** hook — Lightweight hook wrapping `useAccessControl` with `CAN_MANAGE_TENANT_SETTINGS` preset
   - Returns `{ canEdit, loading, tenantRole, isPlatformAdmin }`
   - For programmatic checks in client components (e.g., hiding save buttons)

**Files:**
- `apps/web/src/components/tenant/TenantGuard.tsx` (NEW)
- `apps/web/src/components/tenant/TenantBehaviorGuard.tsx` (NEW)
- `apps/web/src/hooks/tenant-access/useTenantBehaviorAccess.ts` (NEW)

**Verification:** Component renders children for OWNER/TENANT_ADMIN/PLATFORM_ADMIN, shows AccessDenied for TENANT_MEMBER/TENANT_VIEWER/TENANT_USER.

---

### Phase 2: Gate Capability Settings Pages (P0 — Frontend Route Protection)

**Goal:** Wrap all capability-altering settings pages with `TenantGuard` at the page level.

**Entrance points to gate (page-level):**

| Route | File | Capability |
|-------|------|------------|
| `/t/[tenantId]/settings/storefront-options` | `StorefrontOptionsSettingsClient.tsx` | Storefront display options |
| `/t/[tenantId]/settings/storefront-type-options` | `StorefrontTypeOptionsSettingsClient.tsx` | Storefront type selection |
| `/t/[tenantId]/settings/product-options` | `ProductOptionsSettingsClient.tsx` | Product display options |
| `/t/[tenantId]/settings/product-types` | `ProductTypeSettingsClient.tsx` | Product type selection |
| `/t/[tenantId]/settings/featured-options` | `FeaturedOptionsSettingsClient.tsx` | Featured badge options |
| `/t/[tenantId]/settings/integration-options` | `IntegrationOptionsSettingsClient.tsx` | Integration toggles |
| `/t/[tenantId]/settings/quickstart-options` | `QuickstartOptionsSettingsClient.tsx` | Quickstart options |
| `/t/[tenantId]/settings/barcode-scan-options` | `BarcodeScanOptionsSettingsClient.tsx` | Barcode scan modes |
| `/t/[tenantId]/settings/featured-store` | `FeaturedStoreClient.tsx` | Featured placement purchases |
| `/t/[tenantId]/settings/social-commerce` | `SocialCommerceSettingsClient.tsx` | Social commerce toggles |
| `/t/[tenantId]/settings/commerce` | Commerce settings page | Commerce payment types |
| `/t/[tenantId]/settings/fulfillment` | Fulfillment settings page | Fulfillment options |
| `/t/[tenantId]/settings/payment-gateways` | Payment gateway page | Payment gateway config |
| `/t/[tenantId]/bot` | Bot config page | Chatbot options |
| `/t/[tenantId]/faq/options` | FAQ options page | FAQ options |

**Approach:**
- Wrap each page's client component export with `<TenantGuard tenantId={tenantId}>`
- Pattern: `export default function Page({ tenantId }) { return <TenantGuard tenantId={tenantId}><OriginalComponent tenantId={tenantId} /></TenantGuard> }`
- For server components (`page.tsx`), wrap the client component import in the server page

**Also gate these dashboard-embedded entrance points:**
- `PlanSummaryPanel` — Keep visible (read-only) but disable "Manage" / "Configure" links for non-admin roles. Add `readOnly` prop that hides action links.
- `CapabilityShowcase` — Keep visible (read-only) but disable "Configure" / "Manage" links for non-admin roles. Add `readOnly` prop.

**Files modified (page wrappers):**
- `apps/web/src/app/t/[tenantId]/settings/storefront-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/storefront-type-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/product-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/product-types/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/featured-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/integration-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/quickstart-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/barcode-scan-options/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/featured-store/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/social-commerce/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/commerce/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/fulfillment/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/payment-gateways/page.tsx`
- `apps/web/src/app/t/[tenantId]/bot/page.tsx`
- `apps/web/src/app/t/[tenantId]/faq/options/page.tsx`

**Files modified (dashboard panels — read-only mode):**
- `apps/web/src/components/settings/PlanSummaryPanel.tsx` — Add `readOnly` prop, hide settingsPath links when readOnly
- `apps/web/src/components/dashboard/CapabilityShowcase.tsx` — Add `readOnly` prop, hide settingsLink navigation when readOnly
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx` — Pass `readOnly` to PlanSummaryPanel and CapabilityShowcase based on `useTenantBehaviorAccess`
- `apps/web/src/components/dashboard/TenantDashboard.tsx` — Same as above

**Verification:** Navigate to each settings page as TENANT_MEMBER → see AccessDenied. Navigate as TENANT_ADMIN → see full page. Dashboard panels show read-only for TENANT_MEMBER, interactive for TENANT_ADMIN.

---

### Phase 3: Backend Role Enforcement (P0 — API Protection)

**Goal:** Add role-check middleware to all capability settings API routes so that even direct API calls are rejected for unauthorized roles.

**Deliverables:**

1. **`requireTenantAdmin` middleware** — New middleware at `apps/api/src/middleware/requireTenantAdmin.ts`
   - Reads `req.user` (set by `authenticateToken`)
   - Checks user's tenant role against `IS_TENANT_ADMIN` group (OWNER, TENANT_ADMIN, TENANT_OWNER, PLATFORM_ADMIN, ADMIN)
   - Returns 403 `tenant_admin_required` if not authorized
   - Platform admin bypass always applies

2. **Apply middleware to all capability settings PUT/POST routes:**

| Route File | Protected Endpoints |
|-----------|---------------------|
| `storefront-options-settings.ts` | PUT `/:tenantId/storefront-options` |
| `storefront-type-settings.ts` | PUT `/:tenantId/storefront-type-settings` |
| `product-options-settings.ts` | PUT `/:tenantId/product-options` |
| `product-type-settings.ts` | PUT `/:tenantId/product-type-settings` |
| `featured-options-settings.ts` | PUT `/:tenantId/featured-options` |
| `integration-options-settings.ts` | PUT `/:tenantId/integration-options` |
| `quickstart-options-settings.ts` | PUT `/:tenantId/quickstart-options` |
| `barcode-scan-options.ts` | PUT `/:tenantId/barcode-scan-options` |
| `fulfillment-settings.ts` | PUT `/:tenantId/fulfillment-settings` |
| `commerce-settings.ts` | PUT `/:tenantId/commerce-settings` |
| `social-commerce-settings.ts` | PUT `/:tenantId/social-commerce-settings` |
| `storefront-policies.ts` | PUT `/:tenantId/storefront-policies` |
| `bot-merchant.ts` | PUT `/:tenantId/bot-config` |
| `featured-placement-purchases.ts` | POST `/:tenantId/featured-purchases` |

3. **GET routes remain open** — All authenticated tenant members can *read* capability settings (for dashboard display). Only write operations are gated.

**Files:**
- `apps/api/src/middleware/requireTenantAdmin.ts` (NEW)
- All 14 route files listed above (modified — add middleware to PUT/POST handlers)

**Verification:** `curl -X PUT` with TENANT_MEMBER role token → 403. Same with TENANT_ADMIN → 200.

---

### Phase 4: TenantSettings Card Access Enforcement (P1 — Settings Hub)

**Goal:** Enforce `accessOptions.roles` on `TenantSettings.tsx` cards so unauthorized roles see disabled/greyed cards instead of clickable links to pages that will reject them.

**Deliverables:**

1. **Update `UnifiedSettings` component** — Honor `accessOptions.roles` by rendering disabled cards for unauthorized roles
   - Cards with `accessOptions: { roles: ['admin', 'support'] }` show a lock icon and "Admin access required" tooltip
   - Click is disabled (no navigation)

2. **Audit all `TenantSettings.tsx` cards** — Ensure every capability-altering card has correct `accessOptions`
   - All capability settings cards should have `accessOptions: { roles: ['admin', 'support'] }` (already present on most)
   - Add `accessOptions` to any missing cards (e.g., Store Profile, Branding, Setup Store)

3. **Add `useTenantBehaviorAccess` integration** — `UnifiedSettings` uses the hook to determine card visibility state

**Files:**
- `apps/web/src/components/settings/UnifiedSettings.tsx` (modified — enforce accessOptions)
- `apps/web/src/components/settings/TenantSettings.tsx` (modified — audit/add accessOptions)

**Verification:** TENANT_MEMBER sees greyed-out capability cards with lock icon. TENANT_ADMIN sees normal clickable cards.

---

### Phase 5: Sidebar Navigation Role Filtering (P1 — Navigation)

**Goal:** Filter capability-altering navigation links in `DynamicTenantSidebar` based on tenant role, so unauthorized roles don't see links to pages that will reject them.

**Deliverables:**

1. **Add role metadata to navigation links** — Extend `navigation_links` table with optional `required_role` column (nullable, defaults to NULL = visible to all)
   - Migration: `ALTER TABLE navigation_links ADD COLUMN required_role VARCHAR(50) DEFAULT NULL`
   - Links to capability settings pages get `required_role = 'TENANT_ADMIN'`

2. **Update `useNavLinks` hook** — Filter out links where `required_role` is set and user's tenant role doesn't match `IS_TENANT_ADMIN`

3. **Update `DynamicTenantSidebar`** — Pass user role to link filtering logic

4. **Fallback nav arrays** — Add `requiredRole` field to file-based fallback items in `buildTenantNav()` for consistency

**Files:**
- `database/migrations/0XX_navigation_required_role.sql` (NEW)
- `apps/api/prisma/schema.prisma` (modified — add `required_role` to `navigation_links` model)
- `apps/web/src/hooks/useNavLinks.tsx` (modified — role filtering)
- `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` (modified — pass role)
- `apps/api/src/routes/admin/navigation-links.ts` (modified — accept `required_role` in CRUD)

**Verification:** TENANT_MEMBER sidebar doesn't show "Product Options", "Featured Options", etc. TENANT_ADMIN sees full sidebar.

---

### Phase 6: Audit & Regression (P2 — Verification)

**Goal:** Comprehensive audit to ensure no capability-altering entrance point is left ungated.

**Deliverables:**

1. **Entrance point audit** — Document every route, component, and API endpoint that can alter tenant behavior. Verify each has:
   - Frontend: `TenantGuard` wrapper or `TenantBehaviorGuard` inline
   - Backend: `requireTenantAdmin` middleware on write operations
   - Navigation: `required_role` filtering or `accessOptions` enforcement

2. **E2E test matrix** — For each role, document expected behavior on each entrance point:

| Entrance Point | TENANT_ADMIN | TENANT_MANAGER | TENANT_MEMBER | TENANT_VIEWER |
|---------------|-------------|----------------|---------------|---------------|
| Capability settings pages | Full access | AccessDenied | AccessDenied | AccessDenied |
| PlanSummaryPanel links | Clickable | Read-only | Read-only | Read-only |
| CapabilityShowcase links | Clickable | Read-only | Read-only | Read-only |
| TenantSettings cards | Clickable | Disabled | Disabled | Disabled |
| Sidebar nav links | Visible | Hidden | Hidden | Hidden |
| API PUT/POST | 200 | 403 | 403 | 403 |
| API GET | 200 | 200 | 200 | 200 |

3. **Regression check** — Verify `checkapi` and `checkweb` pass with zero TS errors

**Files:**
- `docs/TENANT_BEHAVIOR_GUARD_AUDIT.md` (NEW — audit results)

---

## Implementation Priority

| Phase | Priority | Effort | Risk |
|-------|----------|--------|------|
| Phase 1: TenantGuard Component | P0 | Small (1-2h) | Low — new files only |
| Phase 2: Gate Settings Pages | P0 | Medium (3-4h) | Low — wrapper pattern |
| Phase 3: Backend Role Enforcement | P0 | Medium (3-4h) | Medium — middleware on 14 routes |
| Phase 4: TenantSettings Cards | P1 | Small (2h) | Low — UI changes |
| Phase 5: Sidebar Filtering | P1 | Medium (3h) | Medium — DB migration + nav logic |
| Phase 6: Audit & Regression | P2 | Small (1-2h) | None — verification only |

**Total estimated effort:** 15-20 hours

---

## Architecture Decisions

### Why a new TenantGuard instead of reusing AccessGate?

`AccessGate` (`apps/web/src/components/permissions/AccessGate.tsx`) is designed for **tier-based** feature gating (Level 1: tier, Level 2: role). It uses `useTenantTier` which checks if a feature is available at the user's subscription tier. This is a different concern.

`TenantGuard` is for **role-based page-level access control** — "is this user allowed to alter tenant behavior at all?" It uses `useAccessControl` with `AccessPresets.CAN_MANAGE_TENANT_SETTINGS`, which checks the user's tenant role against `PERMISSION_GROUPS.CAN_MANAGE_TENANT_SETTINGS = [OWNER, TENANT_ADMIN, PLATFORM_ADMIN, ADMIN]`.

### Why not just hide the links?

Defense in depth:
1. **Frontend guard** (TenantGuard) — prevents unauthorized users from seeing the UI
2. **Backend middleware** (requireTenantAdmin) — prevents direct API calls from bypassing the frontend
3. **Navigation filtering** — prevents confusing UX of visible links that lead to AccessDenied pages

All three layers are needed. Hiding links alone is insufficient because a technically savvy user can call the API directly.

### Read-only dashboard panels

`PlanSummaryPanel` and `CapabilityShowcase` remain visible to all tenant members (they show useful plan/capability information). Only the **action links** (navigating to settings pages) are hidden for non-admin roles. This is achieved via a `readOnly` prop, not by hiding the entire component.

---

## Key Files Reference

### Existing Infrastructure
- `apps/web/src/components/admin/AdminGuard.tsx` — Pattern to mirror
- `apps/web/src/lib/auth/access-control.ts` — `AccessPresets.CAN_MANAGE_TENANT_SETTINGS`, `checkAccess()`
- `apps/web/src/lib/auth/useAccessControl.ts` — `useAccessControl()` hook
- `apps/web/src/config/rbac.ts` — `PERMISSION_GROUPS.CAN_MANAGE_TENANT_SETTINGS`, `ROLE_GROUPS.IS_TENANT_ADMIN`
- `apps/web/src/components/permissions/AccessGate.tsx` — Tier/role gate (different concern)
- `apps/web/src/components/AccessDenied.tsx` — Access denied UI component

### Entrance Points to Protect
- `apps/web/src/components/settings/PlanSummaryPanel.tsx` — Dashboard panel with capability links
- `apps/web/src/components/dashboard/CapabilityShowcase.tsx` — Dashboard panel with capability links
- `apps/web/src/components/settings/TenantSettings.tsx` — Settings hub with capability cards
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx` — Dashboard rendering PlanSummaryPanel + CapabilityShowcase
- `apps/web/src/components/dashboard/TenantDashboard.tsx` — Legacy dashboard rendering PlanSummaryPanel
- 15 capability settings pages under `apps/web/src/app/t/[tenantId]/settings/`
- 14 backend API routes under `apps/api/src/routes/` for capability settings

### Backend Middleware
- `apps/api/src/middleware/auth.ts` — `authenticateToken` (identity check only)
- `apps/api/src/config/role-groups.ts` — Server-side RBAC config (mirror of `rbac.ts`)
