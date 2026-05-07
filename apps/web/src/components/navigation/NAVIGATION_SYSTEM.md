# Navigation System — Settings Sidebar Redesign

> Last updated: March 2026 (RBAC integration added)  
> Scope: `apps/web/src/components/navigation/` and `apps/web/src/app/(platform)/settings/`

---

## Overview

The settings area uses **three distinct sidebar experiences** mapped to user roles. A single smart router component (`SettingsLayoutRouter`) selects the correct sidebar at runtime based on the current pathname and Auth0 session role. No double-nesting occurs because both sidebar branches are handled inside a single `layout.tsx` — not in nested child layouts.

```
/(platform)/settings/layout.tsx
  └── SettingsLayoutRouter (client, reads usePathname)
        ├── /settings/admin/*  →  AdminNavContent     (platform admins only)
        └── /settings/*        →  UniversalNavContent  (all authenticated users)
```

---

## Sidebar Matrix

| Sidebar | Component | Audience | Routes |
|---|---|---|---|
| **All Users** | `UniversalNavContent` | Every authenticated user | `/settings/*` (non-admin) |
| **Tenant Users** | `DynamicTenantSidebar` | Store owners & members | `/t/[tenantId]/*` |
| **Platform Admin** | `AdminNavContent` | `PLATFORM_ADMIN` role only | `/settings/admin/*` |

---

## File Reference

### New files

| File | Purpose |
|---|---|
| `src/components/navigation/UniversalNavContent.tsx` | All-users sidebar (mobile drawer + collapsible desktop) |
| `src/components/navigation/SettingsLayoutRouter.tsx` | Selects correct sidebar based on pathname |
| `src/app/(platform)/settings/admin/navigation/page.tsx` | Admin Navigation Control Panel UI |

### Modified files

| File | Change |
|---|---|
| `src/app/(platform)/settings/layout.tsx` | Uses `SettingsLayoutRouter` instead of `AdminNavContent` |
| `src/app/(platform)/settings/admin/layout.tsx` | Passthrough — router above handles sidebar selection |
| `src/proxy.ts` | Added Auth0-session guard for `/settings/admin/*` |
| `src/components/navigation/DynamicTenantSidebar.tsx` | Full rewrite — aligned with new nav system patterns |

---

## UniversalNavContent

**Path:** `src/components/navigation/UniversalNavContent.tsx`

### Mobile behavior
- Sticky top bar with hamburger button always visible on `< md` viewports
- Tapping hamburger opens a **slide-in drawer** from the left (`translate-x` animation, 300ms ease-in-out)
- Full backdrop with `backdrop-blur-sm` and click-to-close
- `Escape` key closes the drawer
- `document.body.overflow = hidden` while open to prevent scroll bleed
- Drawer closes automatically on any link navigation

### Desktop behavior
- Fixed-width sidebar (`240px` expanded, `60px` collapsed)
- **Collapse toggle button** sits at the sidebar's right edge (absolutely positioned)
- Collapsed state: icon-only links with native `title` tooltip on hover
- `transition-all duration-300` for smooth width animation

### Auto-expand
On every pathname change, `computeExpanded()` walks the nav tree and auto-opens any group that contains an active child route. This means users always see their current section expanded without manual interaction.

### Role-aware nav items (`buildNavItems`)

```
buildNavItems(userRole, tenants) → NavItem[]
```

| Condition | What gets added |
|---|---|
| Always | Platform Home, My Account, Security & Privacy, Preferences, Contact & Support |
| `tenants.length > 0` | "My Locations" group with up to 8 tenant dashboard links |
| `PLATFORM_ADMIN` / `ADMIN` / `PLATFORM_SUPPORT` / `PLATFORM_VIEWER` | "Admin Panel" link with amber `Admin` badge |

### NavItem type

All sidebar `NavItem` types now extend `RBACNavGates` — defined in `src/lib/auth/useRBAC.ts`:

```ts
type NavItem = RBACNavGates & {
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'new';
  children?: NavItem[];
  adminOnly?: boolean;
  tenantOnly?: boolean;
  dividerBefore?: boolean;
};

// RBACNavGates (all optional — omit means "show to everyone")
interface RBACNavGates {
  requiredPermission?: string;  // e.g. 'CAN_ADMIN_PLATFORM'
  requiredGroup?: string;       // e.g. 'IS_PLATFORM_ADMIN'
  requiredRole?: string;        // e.g. 'PLATFORM_ADMIN' (exact match)
  anyRole?: string[];           // user.role must be one of these
}
```

All fields are **AND-combined**: a user must satisfy every gate present on an item.

---

## SettingsLayoutRouter

**Path:** `src/components/navigation/SettingsLayoutRouter.tsx`

```tsx
// Routes to correct sidebar — no double-nesting
const isAdminPath = pathname.startsWith('/settings/admin');

if (isAdminPath) return <AdminNavContent>{children}</AdminNavContent>;
return <UniversalNavContent>{children}</UniversalNavContent>;
```

**Why this pattern?**  
Next.js applies layouts from outermost to innermost. If `settings/layout.tsx` renders `UniversalNavContent` and `settings/admin/layout.tsx` renders `AdminNavContent`, both would wrap the page simultaneously, producing a double sidebar. By merging both branches into one layout component, only one sidebar renders per request.

---

## AdminNavContent

**Path:** `src/components/navigation/AdminNavContent.tsx`

Full rewrite to match `UniversalNavContent` patterns. Replaces the old component that had poor mobile usability and linked to many non-existent pages.

### Architecture

Identical component structure to `UniversalNavContent`:
- `DesktopSidebar` — collapsible (`240px` / `60px`), amber-accented header
- `MobileDrawer` — slide-in from left, `backdrop-blur-sm`, `Escape` key close, `body.overflow = hidden`
- `MobileTopBar` — sticky amber bar with hamburger + "Admin" pill badge
- `SidebarContent` — shared between desktop and mobile
- `NavItemRow` — recursive, RBAC-gated, amber active state

### Visual differentiation from other sidebars

Amber (`amber-50 / amber-200 / amber-600`) accent throughout to make it immediately clear the user is in the platform admin scope.

### Nav items — real pages only

All ghost links (404s) removed. Items now map 1:1 to existing `page.tsx` files:

| Section | Links |
|---|---|
| **Admin Dashboard** | `/settings/admin` |
| **Users** | All Users, Deletion Requests |
| **Tenants** | All Tenants, Tenant Limits, Capacity (Overview / Location Limits / Alerts) |
| **Security & Platform** | Security, Platform Settings, Sentry, Feature Overrides, Subdomain Mgmt, Ticker |
| **Analytics** | Scan Metrics |
| **Navigation Control** | `/settings/admin/navigation` (amber `Admin` badge) |
| **Account Settings** | `/settings` (escape hatch back to user settings) |

### Navigation settings integration — `injectedItems` prop

`AdminNavContent` accepts an optional `injectedItems?: NavItem[]` prop. Items published from the Navigation Control Panel (`/settings/admin/navigation`) with target `admin` can be injected here, exactly as `UniversalNavContent` would receive `all`-target items.

```tsx
// SettingsLayoutRouter (future — once nav links API is live)
const { adminLinks } = useAdminNavLinks(); // fetch from /api/admin/navigation-links
return <AdminNavContent injectedItems={adminLinks}>{children}</AdminNavContent>;
```

Until the links API is wired, injected items default to `[]` and the sidebar shows only built-in pages.

### RBAC

All `NavItem` types extend `RBACNavGates`. The full item list is passed through `filterNavItems()` from `useRBAC` before rendering — same pattern as the other two sidebars. Active state uses amber highlight (`bg-amber-50 text-amber-800`) instead of primary-blue.

---

## RBAC Integration

**Hook:** `src/lib/auth/useRBAC.ts`  
**Config:** `src/config/rbac.ts`

### Architecture — file-based, AuthContext-driven

All RBAC state is derived **synchronously** from two sources that are always available:

1. **`AuthContext` (`user.role`)** — the authenticated user object already contains the role (e.g. `"PLATFORM_ADMIN"`). No API call needed.
2. **`src/config/rbac.ts`** — a static TypeScript file that mirrors `apps/api/src/config/role-groups.ts`, containing `ROLE_GROUPS` and `PERMISSION_GROUPS` mappings.

```
user.role  ──►  getUserRoleGroups(role)   ──►  groups[]
           └──►  getUserPermissions(role)  ──►  permissions[]
```

**Benefits:**
- ✓ Zero API calls — no fetch to any `/api/auth/*` endpoint
- ✓ Zero database dependency — works when port 4000 is unavailable
- ✓ Synchronous — `ready` is `true` the moment `AuthContext` finishes loading
- ✓ Authoritative — derived from the same definitions as the API server

### How it works

1. `useRBAC()` calls `useAuth()` to get the current `user` object from `AuthContext`
2. `user.role` is passed to `getUserRoleGroups()` and `getUserPermissions()` from `src/config/rbac.ts`
3. `filterNavItems(items)` recursively removes any item the user cannot see
4. Before `AuthContext` finishes loading, `filterNavItems` returns the full list (fail-open — avoids flash of empty nav)

### Keeping `src/config/rbac.ts` in sync

When `apps/api/src/config/role-groups.ts` is updated (new role, new permission, new group), **manually update `src/config/rbac.ts`** to match. The two files intentionally duplicate the data so the web server has zero runtime dependency on the API server for RBAC decisions.

### Gate hierarchy

| Gate field | Source | Example |
|---|---|---|
| `requiredPermission` | `access.permissions[]` | `CAN_MANAGE_TENANT_BILLING` |
| `requiredGroup` | `access.groups[]` | `IS_TENANT_ADMIN` |
| `requiredRole` | `userRole` (exact) | `PLATFORM_ADMIN` |
| `anyRole` | `userRole` (one of) | `['OWNER', 'TENANT_ADMIN']` |

### RBAC gates applied to sidebars

#### UniversalNavContent

| Item | Gate |
|---|---|
| My Locations | `requiredGroup: IS_TENANT_USER` |
| Admin Panel | `requiredGroup: IS_PLATFORM_ADMIN` |

#### DynamicTenantSidebar

| Item | Gate |
|---|---|
| Orders (top-level) | `requiredGroup: IS_TENANT_MANAGER` |
| Payment Gateways | `requiredPermission: CAN_MANAGE_TENANT_BILLING` |
| Fulfillment Options | `requiredGroup: IS_TENANT_MANAGER` |
| Integrations (top-level) | `requiredGroup: IS_TENANT_ADMIN` |
| Settings (top-level) | `requiredGroup: IS_TENANT_MANAGER` |
| Store Profile | `requiredPermission: CAN_MANAGE_TENANT_SETTINGS` |
| Team Members | `requiredPermission: CAN_MANAGE_TENANT_USERS` |
| Subscription | `requiredPermission: CAN_MANAGE_TENANT_BILLING` |
| Propagation | `requiredGroup: IS_TENANT_OWNER` |

### Adding an RBAC gate to a nav item

```ts
{
  label: 'Billing',
  href: '/settings/billing',
  requiredPermission: 'CAN_MANAGE_TENANT_BILLING',
}
```

No other code changes needed — `filterNavItems()` handles the rest.

---

## Admin Navigation Control Panel

**Route:** `/settings/admin/navigation`  
**Path:** `src/app/(platform)/settings/admin/navigation/page.tsx`

### Access
Protected by both:
1. **Middleware** — `proxy.ts` checks `auth0.getSession()` + DB role before serving the route
2. **Component** — `useAccessControl(null, AccessPresets.PLATFORM_ADMIN_ONLY)` renders `<AccessDenied />` if role check fails (defense in depth)

### Features

| Feature | Detail |
|---|---|
| **Create links** | Label, URL/path, icon, badge text + variant |
| **Sidebar targeting** | Toggle visibility per sidebar: All Users / Tenant Users / Admin Only |
| **Access Gates** | Per-link RBAC gates: Required Permission / Required Group / Required Role (AND-combined) |
| **Enable/disable** | Toggle switch per link — disabled links are hidden in sidebars |
| **Reorder** | Up/down arrow buttons reorder by `order` field |
| **Divider** | Checkbox adds a visual divider above the link in sidebars |
| **Built-in links** | Seed links prefixed `built-in-` cannot be edited or deleted |
| **Live preview** | Right-hand panel shows how each sidebar will look with current settings |
| **Publish** | Publishes to `POST /api/admin/navigation-links` (stub — API endpoint pending) |

### Sidebar target visibility rules

| Target key | Who sees these links |
|---|---|
| `all` | `UniversalNavContent` — every authenticated user |
| `tenant` | `DynamicTenantSidebar` — store owners and tenant members |
| `admin` | `AdminNavContent` — `PLATFORM_ADMIN` role only |

A single link can be assigned multiple targets simultaneously.

---

## Auth0 Route Guard (`proxy.ts`)

**Pattern:** `auth0.getSession()` from `@auth0/nextjs-auth0/server`

```ts
// Both /admin/* and /settings/admin/* are guarded identically
if (pathname.startsWith('/admin') || pathname.startsWith('/settings/admin')) {

  // Step 1 — Auth0 session check (no JWT token parsing)
  const session = await auth0.getSession();
  if (!session?.user) {
    // Redirect to Auth0 login, preserving return path
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Step 2 — DB role check (PLATFORM_ADMIN / SUPER_ADMIN)
  const isAdmin = await isPlatformAdmin(req);
  if (!isAdmin) {
    return NextResponse.redirect('/access-denied');
  }
}
```

**Why Auth0 session, not JWT?**  
`auth0.getSession()` reads the server-side session cookie managed by `@auth0/nextjs-auth0`. It does not require manually parsing or verifying a JWT token. The session is cryptographically signed by the Auth0 SDK and is the canonical authentication source for Next.js middleware in this codebase.

---

## Adding New Links in Code

To add a static nav link to `UniversalNavContent`, edit `buildNavItems()` in `UniversalNavContent.tsx`:

```ts
{
  label: 'My New Section',
  href: '/settings/my-section',
  icon: <Icon.Globe />,
  badge: 'NEW',
  badgeVariant: 'new',
  dividerBefore: true,  // optional
}
```

To add a dynamically admin-configured link, add it through the Navigation Control Panel at `/settings/admin/navigation` and assign its sidebar targets.

---

## Extending the System

### Adding a gate to a dynamically-configured link

In the Navigation Control Panel (`/settings/admin/navigation`), use the **Access Gates** section of the link editor:
- **Required Permission** — any value from `PERMISSION_OPTIONS` (e.g. `CAN_MANAGE_TENANT_BILLING`)
- **Required Group** — any value from `GROUP_OPTIONS` (e.g. `IS_TENANT_OWNER`)
- **Required Role** — any value from `ROLE_OPTIONS` (e.g. `PLATFORM_ADMIN`)

When the link is injected into a sidebar at runtime, `filterNavItems()` in `useRBAC` enforces the gates automatically.

### Adding a fourth sidebar (e.g. "Support Staff")
1. Add a new `SidebarTarget` value to the `NavLink` type in the control panel page
2. Add its label/description to `SIDEBAR_LABELS`
3. Create a new sidebar component (follow `UniversalNavContent` as a template)
4. Add the new branch to `SettingsLayoutRouter`

### Persisting navigation links to the database
1. Create `POST /api/admin/navigation-links` and `GET /api/admin/navigation-links` API routes
2. Replace `SEED_LINKS` in the control panel with a `useEffect` fetch from the GET endpoint
3. Wire the "Publish Changes" button to the POST endpoint
4. In `UniversalNavContent`, fetch from the GET endpoint and merge with `buildNavItems()` output

---

## Accessibility

- All interactive elements have `aria-label` or descriptive text
- Drawer has `role="dialog"`, `aria-modal="true"`, `aria-label="Navigation menu"`
- Collapse toggle has `aria-label` that reflects current state
- Parent groups use `aria-expanded` on the trigger button
- Focus is managed via `Escape` key close on mobile drawer
- All color contrasts meet WCAG AA (Tailwind `neutral-700` on `white`, `primary-700` on `primary-50`)
