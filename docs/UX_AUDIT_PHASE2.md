# Phase 2 — Primary Tasks & Clutter Removal

Generated: 2026-06-21
Source skill: `skill-frontend-ux-guardrails`

For each high-impact screen, the **primary user task** is the one action the user came to do. Everything else is secondary or clutter. This document defines those tasks and flags what to remove, demote, or consolidate.

## 1. Platform Home / Dashboard (`/(platform)/page.tsx`)

**Primary user task** (authenticated): Quickly assess the health of my business and jump to the most important next action.

**Primary user task** (public visitor): Understand what the platform does and trust it enough to sign up or browse.

**Clutter to remove/demote:**
- **Remove the public mission statement** from the authenticated view. The authenticated dashboard should not display "Empowering Local Retailers..." marketing copy.
- **Demote the public 3-card mission/vision/promise grid** to the public landing page only (`/features` or `/` for guests).
- **Remove the visitor-only 7-card stats section** from authenticated view. Authenticated users see the platform dashboard data elsewhere; duplicating it adds noise.
- **Consolidate the two headers** — `/` currently renders its own header inside `Home` while the `(platform)/layout.tsx` also renders `AppShell`. This creates a double header for authenticated users.
- **Remove the "Help Desk" CTA banner** for authenticated users; it competes with the actual dashboard actions.
- **Remove or collapse the `test-featured-products`, `test-integration`, `test-phase1-2` placeholder pages** from any production navigation.

**What to keep:**
- A single welcome line + primary CTA (e.g., "Add products" or "View orders").
- A compact KPI row (max 4 cards) with stable widths.
- Quick links to the user's most recent/used tenant actions.

## 2. Merchant Tenant Dashboard (`/t/[tenantId]/dashboard`)

**Primary user task:** Understand how this location is performing today and do the next most valuable thing (add inventory, review orders, fix a setup issue).

**Clutter to remove/demote:**
- **Demote the "Tier Hero Illustration"** — it consumes a lot of vertical space and adds marketing-style visuals to an operational dashboard.
- **Remove the motivational hero text** "Your business is growing. What's next?" after the first visit. It does not help scanning.
- **Consolidate the KPI row** — "Total Sales" is currently derived as `orders * 42.5` (fake math), and "Store Visitors" is `activeItems * 3.2` (fake math). Either show real data or remove the fake metrics. Fake metrics destroy trust.
- **Remove the "Automation Impact" card** with hardcoded demo numbers (12.5 hrs, $2,340, 86 orders) until real data is available.
- **Remove the fake "Active Workflows" pipeline** avatar stack. It is decorative and not actionable.
- **Demote the "Recommendations for You" grid** of 4 upsells. If shown, keep to 1 or 2 contextually relevant cards, not 4 generic marketing cards.
- **Remove or consolidate the two bot widgets** (CrmTenantWidget + BotTenantWidget + BotDashboardChat + PublicBotWidget). The merchant dashboard should not show both a support widget and a chatbot widget simultaneously. Choose one primary support channel.
- **Consolidate the sidebar and header nav** — the dashboard renders its own sticky header with Dashboard/Orders/Products/Settings while the global `AppShell` also renders a top nav. The two navigation bars duplicate the same destinations.
- **Move the full `SubscriptionDisplayCard`** to a settings/billing page or collapse it into a compact "Plan" line in the meta bar.
- **Keep the `TaskChecklist` and `SystemStatusCard`** — these are the most actionable parts of the dashboard.

**What to keep:**
- Meta bar: tenant name + plan + limits + status + refresh.
- 4 real KPIs (orders, active items, visitors, revenue if available).
- Task checklist / setup checklist.
- System status + business hours.
- Quick links to storefront, directory, settings, support.
- A single support widget (merchant ticket creation).

## 3. CRM Admin (`/settings/admin/crm/*`)

**Primary user task:** Monitor and act on platform support work (tickets, tasks, tenant alerts).

**Clutter to remove/demote:**
- **Remove the `CrmNavPanel` from the left sidebar** if the global admin nav already contains CRM links. Two nested sidebars are confusing.
- **Remove the "All" / "My Work" toggle** or replace it with a single filter that persists state.
- **Demote the "Recent Activity" feed** on the dashboard. It is useful but should not be equal in weight to open tickets.
- **Consolidate the stat cards** — "Avg Response" is a placeholder value (null). Do not show it until the backend returns it.
- **Remove the 3+ duplicate navigation paths** to CRM: `/settings/admin/crm`, `/admin/crm`, and any file-based fallback links.

**What to keep:**
- A single primary action: create ticket or assign.
- A clear triage list of open tickets with status, priority, assignee.
- Kanban for tasks (admin-only).
- Tenant alerts and recent activity as secondary, collapsible sections.

## 4. Navigation (Database-Driven Sidebar)

**Primary user task:** Get to the right place with one click, regardless of role (platform admin, tenant owner, tenant member).

**Clutter to remove/demote:**
- **Remove the stale file-based fallback nav arrays** (`SidebarTemplates.tsx`, `buildAdminNavItems`, `buildNavItems`, `buildTenantNav`) or mark them clearly deprecated. They are misleading to agents and will not appear in the UI.
- **Add the missing icons** to the admin navigation icon map so the database links can be rendered.
- **Demote the "Recommended" box** in `GeneralSidebar` unless it is dynamic and relevant. Currently it shows static onboarding tips that may not apply.
- **Remove the "Navigation" header label** in the sidebar if it does not add meaning.

**What to keep:**
- A single, role-aware sidebar source of truth.
- Clear groupings (Account, Admin, Tenant, Settings, Support).
- Stable labels and icons for all 50+ links.

## 5. Product / Storefront Cards (`/products/[id]`, `/directory/*`, `/shops/*`)

**Primary user task:** Discover a product and decide to buy or visit the store.

**Clutter to remove/demote:**
- **Remove any secondary OAuth status checks** on product display. The card should only know whether a gateway is on file.
- **Demote the "Related products" carousel** if it pushes the primary CTA below the fold on mobile.
- **Consolidate badges** (sale, new, clearance, seasonal, etc.) to avoid competing visual noise.
- **Remove duplicate product card layouts** (`SmartProductCard`, `EnhancedStorefrontProductCard`, `ProductCardLayouts`, `EnhancedProductCard`) if they serve the same purpose. Standardize on one responsive card.

**What to keep:**
- Product image, name, price, availability.
- One clear CTA: "Add to Cart" or "View Details".
- Trust signals (reviews, store status) only if real.

## 6. Checkout (`/checkout`)

**Primary user task:** Complete a purchase quickly and securely.

**Clutter to remove/demote:**
- **Reduce the top action bar** from 4 buttons (Back, Edit Cart, Back to Store, Continue Shopping) to 1-2 contextually correct actions.
- **Remove the "Back to Store" and "Continue Shopping" buttons** during the payment step; they create escape paths at the worst moment.
- **Consolidate the store branding block** with the order summary; the current separate card at the top repeats information.
- **Remove the inline payment gateway selection** from the main flow if the cart already selected a gateway; only show it when multiple gateways are available.
- **Demote the "Save payment method" prompt** for guests until after the order is placed.
- **Remove the `console.log` statements** in the production checkout flow; they add noise and can leak data in dev tools.

**What to keep:**
- Clear step indicator (review → fulfillment → shipping → payment).
- Order summary visible at every step, especially on desktop.
- One primary action per step.
- Trust signals (secure checkout, store contact).

## 7. Inventory / Items (`/t/[tenantId]/items`)

**Primary user task:** Find, manage, and update products for this tenant.

**Clutter to remove/demote:**
- **Simplify the filter bar** — there are separate status, visibility, category, search, and bulk-action dropdowns. Many are custom dropdowns with manual click-outside handlers. Replace with a unified filter bar.
- **Demote the "Quick Start" guide** after the user has items or has dismissed it.
- **Remove the inline `alert()` calls** for delete/success messages. Replace with toast notifications or inline confirmation.
- **Consolidate the many modals** (create, edit, QR, photo gallery, category assignment, bulk upload, propagate, bulk propagate) into a single modal system with consistent footer and focus behavior.
- **Remove the "Debug" console logs** and commented-out effects.
- **Hide or disable bulk actions** when no items are selected.

**What to keep:**
- Search + primary filter (status).
- Add product button.
- Table/grid with clear row actions (edit, delete, assign category, propagate).
- Pagination with stable page size.
- Empty state with a clear "Add your first product" CTA.

## 8. Settings (`/settings` and `/t/[tenantId]/settings`)

**Primary user task:** Find and change a specific setting quickly.

**Clutter to remove/demote:**
- **Remove the "Test User Management" card** from `/settings` — it links to `/admin/users` which is a legacy admin page and duplicates the platform admin route.
- **Remove the "Platform User Maintenance" card** from `/settings` for non-admin users; it should be in the admin panel only.
- **Consolidate the settings cards** into grouped sections (Account, Billing, Security, Admin) instead of 6 separate groups with one card each.
- **Replace inline SVG icons** with the icon library to reduce file size and inconsistency.

**What to keep:**
- A grouped, searchable grid of settings cards.
- Clear role-based access (hide admin cards for non-admins).
- Consistent card sizing and icons.

## 9. Cross-Cutting Changes to Apply

- **Standardize loading states**: use `Skeleton` or `Spinner` from `components/ui`, not one-off spinners.
- **Standardize empty states**: use `EmptyState` with a relevant icon and a single action.
- **Standardize error states**: use `ErrorMessage` or inline error cards instead of `console.error` and silent fallbacks.
- **Remove production `console.log` / `console.warn` statements** from user-facing pages.
- **Pick a single modal system**: either Radix-based `Dialog` or custom `Modal`, not both.
- **Pick a single button component**: custom `Button`, Mantine `Button`, or shadcn — do not mix all three in the same page.
- **Decide on dark mode**: enable it fully or strip all `dark:*` classes. Half-enabled dark mode is a visual risk.

## 10. Recommended Execution Order for Phase 3

Start layout fixes with the screens that have the most structural clutter and the highest user impact:

1. **Merchant Tenant Dashboard** — fake metrics, duplicated nav, two bot widgets, heavy marketing tone.
2. **Platform Home** — double header, mixed public/authenticated content, 1353-line file.
3. **Checkout** — too many escape buttons, step indicator, mobile layout stability.
4. **Inventory Items** — filter bar complexity, modal system, bulk actions.
5. **CRM Admin** — nested nav, read-only gaps, stat-card placeholders.
6. **Navigation** — needs its own alignment plan (separate `docs/NAVIGATION_ALIGNMENT_PLAN.md`) before UI polish.

## 11. Decisions Needed

- Should the authenticated dashboard show any public marketing content at all?
- Should fake/demo KPIs be removed or hidden behind a "Demo data" banner?
- Should the merchant dashboard keep one support widget or one bot widget? Which is the primary channel?
- Which modal system should become the standard (Radix `Dialog` or custom `Modal`)?
- Should dark mode be fully enabled or fully removed?
