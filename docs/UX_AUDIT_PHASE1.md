# Phase 1 — Frontend UX Surface Inventory & Audit

Generated: 2026-06-21
Source skill: `skill-frontend-ux-guardrails`

## 1. Surface Scope

- **Total routes**: 260 `page.tsx` files in `apps/web/src/app` (see `docs/_phase1_app_pages.txt`).
- **Top-level segments** (by volume):
  - `/(platform)/settings/admin/*` — 50+ admin pages
  - `/t/[tenantId]/*` — 80+ merchant tenant pages
  - `/account/*` — customer account
  - `/admin/*` — legacy admin pages
  - `/directory/*` — public storefront/directory
  - `/checkout/*`, `/cart/*`, `/orders/*` — commerce
  - `/auth/*`, `/login/*`, `/signup/*` — auth
  - `/support/*` — customer support portal
  - Test/placeholder pages: `/test-featured-products`, `/test-integration`, `/test-phase1-2` (should be removed or gated in production)

## 2. Layout Primitives

| Primitive | File | Notes |
|-----------|------|-------|
| Root layout | `apps/web/src/app/layout.tsx` | Geist font, PWA viewport, `ClientRootLayout` wrapper. Force-dynamic. |
| Platform layout | `apps/web/src/app/(platform)/layout.tsx` | Wraps everything in `AppShell` + `PlatformSettingsProvider`. |
| App shell | `apps/web/src/components/app-shell/AppShell.tsx` | Sticky header, mobile hamburger, switcher row, global alert bar. Uses `max-w-7xl` container. |
| Sidebar layout | `apps/web/src/components/navigation/SidebarLayout.tsx` | Non-responsive sidebar. Used in some admin/tenant flows. |
| Responsive sidebar | `apps/web/src/components/navigation/ResponsiveSidebarLayout.tsx` | Mobile overlay drawer at `<md`, desktop sticky sidebar. |
| General sidebar | `apps/web/src/components/GeneralSidebar.tsx` | Collapsible sidebar with nav items, badges, footer, "Recommended" box. |
| CRM page shell | `apps/web/src/components/crm/CrmPageShell.tsx` | Two-column layout (sidebar + main) for CRM admin pages. |

## 3. Design Tokens

Primary config is in `apps/web/src/app/globals.css`:
- **Tailwind v4** `@import "tailwindcss"` + `@theme` inline.
- **Color palette**: Google brand colors (`--primary-*` blue), semantic success/warning/error/info, OKLCH shadcn variables (`--background`, `--card`, `--muted`, etc.), dark-mode overrides.
- **Typography**: Inter sans, JetBrains Mono, Geist via Next font.
- **Spacing**: 8pt grid tokens (`--spacing-1`…`--spacing-24`).
- **Radius**: `--radius: 0.625rem`, `sm/md/lg/xl/full`.
- **Shadows**: `sm`, `base`, `md`, `lg`, `xl`.
- **Layout tokens**: product gallery heights, split-panel proportions, sticky purchase bar.

⚠️ **Risk**: `apps/web/tailwind.config.js` still exists and points to `content: ['./app/**/*', ...]` (old v3 paths). It is likely ignored by Tailwind v4 but may confuse tooling or shadcn CLI. Also `components.json` references `tailwind.config.js`.

⚠️ **Dark mode drift**: `globals.css` says "Dark mode disabled - force light mode only" but many components carry `dark:*` classes and the `.dark` theme is fully defined. This creates a visual mismatch if any page/class toggles dark mode.

## 4. Shared UI Components

`apps/web/src/components/ui/` contains 40 primitive files:

- **Layout**: `Card.tsx`, `AnimatedCard.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `LoadingSpinner.tsx`
- **Overlay**: `Dialog.tsx`, `Modal.tsx`, `alert-dialog.tsx`, `Toast.tsx`, `Toaster.tsx`, `Tooltip.tsx`
- **Forms**: `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `shadcn-select.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`, `Label.tsx`, `Form.tsx`, `SearchableSelect.tsx`, `AdvancedSearchableSelect.tsx`
- **Data**: `table.tsx`, `Pagination.tsx`, `Badge.tsx`, `Progress.tsx`, `Tabs.tsx`
- **Feedback**: `Alert.tsx`, `EmptyState.tsx`, `ErrorMessage.tsx`, `GlobalAlertProvider.tsx`
- **Other**: `Button.tsx`, `ThemeToggle.tsx`, `Separator.tsx`, `Accordion.tsx`

Key observations:
- `Table` wraps `<table>` in `overflow-auto` (good), but `TableCell`/`TableHead` use only `p-2` / `px-2` — very dense and no min-width safeguards.
- `Card.tsx` is a custom component, not the shadcn card. It uses hardcoded `neutral` colors.
- `Dialog.tsx` is shadcn/Radix-based; `Modal.tsx` is a custom framer-motion modal with `max-h-[90vh]` and `max-h-[calc(90vh-140px)]` content.
- `EmptyState.tsx` is simple but supports only a single action.
- Many icons are inline SVGs instead of a single icon library.

## 5. Component Heat Map

Highest-risk directories by component count and user-facing impact:

| Directory | Items | Concern |
|-----------|-------|---------|
| `src/components/directory` | 51 | Store cards, filters, public-facing — high visibility |
| `src/components/items` | 47 | Inventory management, bulk actions, tables, modals |
| `src/components/products` | 38 | Product cards, storefront, SmartProductCard, checkout display |
| `src/components/dashboard` | 26 | KPI cards, charts, system status |
| `src/components/tenants` | 13 | Tenant management, filtering |
| `src/components/crm` | 9 | CRM admin shell, Kanban, tickets, contacts |
| `src/components/bot` | 16 | Bot admin, widget, merchant config |
| `src/components/security` | 36 | Tables, alerts, sessions |
| `src/components/ui` | 40 | Shared primitives — changes ripple everywhere |

## 6. Hot Spots & Pain Points

### 6.1 Navigation
- The active navigation is **database-driven** (`navigation_links` table), but the file-based fallbacks in `SidebarTemplates.tsx`, `AdminNavContent.tsx`, `UniversalNavContent.tsx`, `DynamicTenantSidebar.tsx` still exist and are misleading. The DB only has 7 seed links while fallbacks have 50+, so many links are currently hidden.
- Reference: `docs/NAVIGATION_ALIGNMENT_PLAN.md`, `.devin/skills/database-navigation-system.md`.

### 6.2 Dashboard / Home
- `apps/web/src/app/(platform)/page.tsx` is a 1353-line mega-page mixing public marketing hero, authenticated dashboard, and feature showcase.
- Risk: marketing mission statement and large animated cards dominate the authenticated experience, reducing scannability.
- `tenantId`-scoped dashboard at `/t/[tenantId]` immediately redirects to `/`, so the merchant tenant dashboard does not exist as a standalone page.

### 6.3 CRM Admin
- `apps/web/src/app/(platform)/settings/admin/crm/page.tsx` shows a dashboard but the UI is read-only for most write actions; backend CRUD routes exist, frontend actions are pending (see `docs/CRM_ADMIN_ACTIONS_PHASE_PLAN.md`).
- `CrmPageShell` uses Mantine `Group`, `Title`, `Breadcrumbs`, `Anchor` mixed with Tailwind — visual style may diverge from the rest of the app.

### 6.4 Tables
- The `table.tsx` primitive wraps in `overflow-auto` but most tables likely rely on `w-full` without intentional column widths. Long tenant names, emails, product names, and currency values will overflow or force horizontal scroll on small screens.
- Table actions are often hidden in per-row menus; hover-only actions are a touch risk.

### 6.5 Modals
- Two modal systems (`Dialog.tsx` Radix + `Modal.tsx` custom) may cause inconsistent focus trapping, backdrop, animation, and scroll-lock behavior.
- `Modal.tsx` uses `document.body.style.overflow = 'hidden'` directly; a class-based lock is safer.

### 6.6 Forms & Inputs
- `globals.css` applies `!important` color overrides to all inputs (`color: var(--neutral-900) !important`). This can override intentional error/disabled states and dark mode.
- Global selectors like `p:not([class*="text-"])`, `button:not([class*="text-"])`, `li span` force colors, making it hard to compose intentional color variants.

### 6.7 Buttons & Mantine Mix
- Multiple button sources: `Button.tsx` (custom), `@mantine/core/Button`, and inline `<button>` with SVG icons. Mantine `Button` is frequently used with `variant='gradient' style={{ color: 'white' }}` and then Tailwind classes, which is brittle and may break with Mantine upgrades.
- `AppShell.tsx` uses `style={{ color: 'yellow' }}` on the Account button — likely a leftover debug style.

### 6.8 Responsive / Mobile
- `AppShell.tsx` has a mobile menu, but the `Switcher Row` (TenantSwitcher, SettingsSwitcher) is always visible and uses `overflow-x-auto` with a max-width container — may clip on small screens.
- `GeneralSidebar.tsx` uses a fixed `absolute bottom-0` footer on desktop; on short viewports or collapsed state, the nav may overlap with footer.
- `ResponsiveSidebarLayout.tsx` uses a hardcoded 768px breakpoint and `window.innerWidth` check in `useEffect` — no `matchMedia` or SSR-safe fallback, may cause hydration flicker.

### 6.9 Loading / Empty / Error States
- `EmptyState.tsx` exists and is reusable, but many pages may still use inline `<p>No data</p>` placeholders.
- `LoadingSpinner` vs `Spinner` vs inline `animate-spin` divs — inconsistent loading UX.
- Error handling is often `console.warn` with silent fallback data; user-facing error messages are missing.

### 6.10 Checkout & Payment
- Recent fix: `SmartProductCard` and `RandomFeaturedProducts` now trust the API gateway status rather than re-validating OAuth (see `docs` and `apps/web/src/services/PublicTenantInfoService.ts`). Payment UX is a critical conversion surface.

## 7. Candidate Screens for Phase 2

Prioritize by user impact and likelihood of layout/copy/state issues:

1. **Platform Home / Dashboard** (`/(platform)/page.tsx`) — primary authenticated landing, mixed public/marketing content, many metrics cards.
2. **CRM Admin** (`/settings/admin/crm/*`, `/settings/admin/crm/tickets/*`, `/settings/admin/crm/tasks/*`) — new feature, likely needs state/copy polish.
3. **Merchant Tenant Dashboard** (`/t/[tenantId]/dashboard/page.tsx`) — currently redirects; merchant workspace is a high-traffic surface.
4. **Navigation** (database-driven + admin nav editor) — structural UX issue affecting every logged-in user.
5. **Product/Storefront Cards** (`/products/[id]`, `/directory/*`, `/shops/*`) — public conversion surfaces.
6. **Checkout / Cart** (`/checkout`, `/cart`, `/orders`) — revenue-critical, state-heavy.
7. **Inventory / Items** (`/t/[tenantId]/items`, `/items`) — tables, bulk actions, filters.
8. **Settings** (`/settings/*`, `/t/[tenantId]/settings/*`) — many long forms, dense layout.

## 8. Next Steps

1. **Phase 2**: Define the primary user task for each candidate screen and remove/demote non-essential UI.
2. **Phase 3**: Run constrained viewport tests (320, 390, 768, 1024, 1440) on the top 4 screens and fix overflow/spacing.
3. **Phase 4**: Audit loading, empty, error, disabled, and success states on the same screens.
4. **Phase 5**: Keyboard focus, visible focus, and touch-action pass.
5. **Phase 6**: `pnpm checkweb` / `pnpm lint` / build verification + screenshots.

## 9. Residual Questions

- Should dark mode be fully enabled or fully stripped? The current half-enabled state is risky.
- Should `tailwind.config.js` be removed or updated to match Tailwind v4 config?
- Should the public marketing content on `/` be removed for authenticated users?
- Which of the 260 pages are test-only and should be excluded from production UX verification?
