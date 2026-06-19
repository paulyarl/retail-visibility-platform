# Organization Dashboard Redesign — Comprehensive Design Spec

> **Target file:** `apps/web/src/app/(platform)/settings/organization/page.tsx`  
> **Route:** `/settings/organization?organizationId=org-KQJ4OXF3`  
> **Also affected:** `apps/web/src/app/t/[tenantId]/settings/organization/page.tsx` (tenant-scoped stub)  
> **Companion page:** `apps/web/src/app/(platform)/settings/organization/commerce/page.tsx`

---

## 1. Current State Audit

### 1.1 File Metrics

| Metric | Value |
|--------|-------|
| Total lines | 1,822 |
| Components extracted | 0 (fully monolithic) |
| Inline SVG icons | ~40+ |
| Commented-out code blocks | ~15 |
| `alert()` calls | 3 |
| `window.location.href` navigations | 12 |
| Reusable components used | 4 (`PageHeader`, `Badge`, `Spinner`, `SubscriptionUsageBadge`) |
| Capability hooks used | 0 |
| Motion/animation | 0 |
| Dark mode classes | 0 |

### 1.2 Current Section Inventory (top to bottom)

| # | Section | Lines | Status |
|---|---------|-------|--------|
| 1 | Organization selection screen | 376–498 | Keep — refactor styling |
| 2 | Welcome / Usage Metrics card | 556–661 | Keep data, redesign layout |
| 3 | Hero Location Banner | 664–780 | Keep — extract component |
| 4 | `SubscriptionUsageBadge` | 783 | Keep as-is |
| 5 | Organization Billing card | 786–818 | **Merge** into unified billing strip |
| 6 | Commerce Settings card | 820–844 | **Merge** into settings tab |
| 7 | Quick Actions card (sync/propagate) | 846–907 | **Merge** into Propagation tab |
| 8 | Propagation Control Panel (4 groups) | 909–1257 | Keep — extract, move to tab |
| 9 | Location Breakdown (paginated) | 1259–1379 | Keep — redesign as table/grid |
| 10 | Quick Start Guide (collapsible) | 1381–1507 | **REMOVE** — dead educational content |
| 11 | Detailed Sync Guide (collapsible) | 1509–1676 | **REMOVE** — duplicates #10 |
| 12 | Warning Messages | 1678–1713 | **Merge** into usage metrics |
| 13 | Category Sync Modal | 1716–1819 | Keep — extract as component |

### 1.3 Gap Analysis

#### Structural Gaps

- **G1: Monolithic file** — 1,822 lines in a single component with zero extraction. Unmaintainable.
- **G2: No tab navigation** — Single vertical scroll with 8+ sections. No information architecture.
- **G3: No responsive grid** — Everything is `space-y-6` single column. TenantDashboardV2 uses 2/3 + 1/3 grid.
- **G4: No sticky header** — Uses `PageHeader` component. TenantDashboardV2 has sticky header with nav + refresh.
- **G5: Tenant-scoped org page is a stub** — `t/[tenantId]/settings/organization/page.tsx` shows "coming soon" text.

#### Platform Evolution Gaps

- **G6: No capability infrastructure** — `useAllCapabilities`, `useMerchantGates`, `CapabilityShowcase`, `PlanSummaryPanel` all exist and are used on TenantDashboardV2 but absent from org dashboard.
- **G7: No CRM visibility** — CRM system (tickets, tasks, alerts, activities) exists with `CrmTenantWidget` but invisible at org level. No cross-location ticket summary.
- **G8: No FAQ visibility** — FAQ system exists with `FaqService` but org dashboard has no FAQ status or management entry point.
- **G9: No chatbot/bot visibility** — Bot platform (BotDashboardPage, BotConfigPage, BotAnalyticsPage) exists but org dashboard has no bot status or cross-location bot health.
- **G10: No organization-level capability rollup** — Cannot see which capabilities are enabled/disabled across all locations in the chain.
- **G10b: No employee/team management** — Tenant user management has invitations, roles (OWNER, ADMIN, SUPPORT, MEMBER, VIEWER), seat limits, and pending invitations — but none of this is surfaced at the org level. No cross-location employee rollup, no chain-wide role distribution, no aggregated pending invitation view, no seat usage across the chain.
- **G10c: No action-oriented panels** — TenantDashboardV2 has `TaskChecklist` (onboarding tasks with progress ring), Quick Links (navigational shortcuts), `RecommendationCard` (growth suggestions), and `SystemStatusCard` (health at a glance). The org dashboard has none of these. No chain-wide task checklist, no quick links to platform pages, no actionable recommendations, no chain health status card.
- **G10d: No organization capability type** — The platform has 14 tenant-scoped capability types (commerce_types, storefront_types, faq_options, crm_options, chatbot_options, etc.) but no `organization_options` capability type. Organization tiers (chain_starter, chain_professional, chain_enterprise) have no capability-gated features at the org level. The org dashboard shows the same tabs regardless of tier — no way for the platform to feature-gate which tabs/panels appear, which platform capabilities are available org-wide, or which VIP experiences each org tier unlocks.
- **G10e: No role-based tab visibility** — All tabs are visible to all org members regardless of role. No RBAC gating on tab visibility (e.g., billing tab only for owners, team tab only for admins/owners, propagation tab only for admins). The tenant dashboard has `useAccessControl` with `AccessPresets` — the org dashboard needs equivalent org-level role gating.

#### UX/Styling Gaps

- **G11: Inline SVG icons** — ~40+ inline SVG paths instead of `lucide-react` icons used everywhere else.
- **G12: No motion/animation** — TenantDashboardV2 uses `framer-motion` for staggered reveals. Org dashboard is static.
- **G13: `alert()` for feedback** — 3 `alert()` calls for success/error. Platform uses `toast` elsewhere.
- **G14: No loading skeleton** — Uses basic `<Spinner>`. TenantDashboardV2 has `DashboardSkeleton`.
- **G15: No dark mode** — Zero `dark:` classes. TenantDashboardV2 has dark mode support.
- **G16: `window.location.href` for navigation** — 12 instances instead of Next.js `Link` or `useRouter`.
- **G17: Redundant educational content** — Quick Start Guide (~130 lines) + Detailed Sync Guide (~170 lines) = ~300 lines of collapsible help text that duplicates the Propagation Control Panel's own descriptions.
- **G18: Redundant billing cards** — Three separate cards (Welcome metrics, Billing, Commerce) all linking to the same subscription/billing pages.
- **G19: No KPI cards** — TenantDashboardV2 has `KpiCard` with sparklines and trend indicators. Org dashboard has plain text numbers.
- **G20: No location health detail** — Location Breakdown only shows SKU count. No storefront status, payment gateway, hours, or capability status per location.

#### Dead Code

- **D1:** Commented-out `console.log` statements (~15 instances, lines 48, 99, 110, 122–124, 191–193, 536)
- **D2:** Quick Start Guide section (lines 1381–1507) — educational content, no functional value
- **D3:** Detailed Sync Guide section (lines 1509–1676) — duplicates Propagation Control Panel descriptions
- **D4:** Duplicate sync result display — sync result shown in both Quick Actions card (line 894) and Propagation Control Panel (line 1227)

---

## 2. Design Principles

1. **Tab-based information architecture** — Replace single scroll with tabbed sections matching the org manager's workflow.
2. **Component extraction** — Break the monolith into focused, reusable components.
3. **Align with TenantDashboardV2 patterns** — Use same design language: `framer-motion`, `lucide-react`, `rounded-2xl` cards, `gray-50` background, dark mode.
4. **Capability-aware** — Surface capability status across the chain using existing hooks and components.
5. **Remove dead weight** — Delete educational guides, commented code, duplicate displays.
6. **Preserve existing business logic** — All handlers (`handleSetHeroLocation`, `handleSyncFromHero`, `handleSyncCategoriesToGBP`) stay. Only layout/styling changes.
7. **Next.js navigation** — Replace `window.location.href` with `Link` / `useRouter`.
8. **Capability-gated tabs** — Tabs are gated by a new `organization_options` capability type. Only tabs the org's tier has enabled are rendered. This is the VIP experience — higher org tiers unlock more tabs and panels.

---

## 2.5 Organization Capability Type — The VIP Experience

### Concept

The platform currently has 14 tenant-scoped capability types. Organization tiers (chain_starter, chain_professional, chain_enterprise) need their own capability type — `organization_options` — that gates which features are available at the organization level.

This is **not** a tenant-level capability. It is an **organization-level capability** that controls:
- Which tabs appear on the org dashboard
- Which platform capabilities are available org-wide (propagation, CRM, bot, branding, etc.)
- Which VIP panels and action-oriented features are unlocked
- Which cross-location management features are enabled

### Capability Type Registration

Register a new `capability_type_list` row:

```
key:          organization_options
name:         Organization Options
category:     organization
is_active:    true
sort_order:   1
```

### Feature Keys

| Feature Key | Description | chain_starter | chain_professional | chain_enterprise |
|-------------|-------------|:---:|:---:|:---:|
| `org_tab_overview` | Overview tab (KPIs, hero banner, action panels) | ✅ | ✅ | ✅ |
| `org_tab_locations` | Locations tab (location breakdown table) | ✅ | ✅ | ✅ |
| `org_tab_propagation` | Propagation tab (hero sync, propagation panel) | ✅ | ✅ | ✅ |
| `org_tab_capabilities` | Capabilities tab (chain capability rollup) | ❌ | ✅ | ✅ |
| `org_tab_team` | Team tab (cross-location employee management) | ❌ | ✅ | ✅ |
| `org_tab_commerce` | Commerce tab (org commerce settings) | ❌ | ✅ | ✅ |
| `org_tab_billing` | Billing tab (subscription, invoices, upgrade) | ✅ | ✅ | ✅ |
| `org_panel_task_checklist` | Task checklist with progress ring | ✅ | ✅ | ✅ |
| `org_panel_quick_links` | Quick links navigational panel | ✅ | ✅ | ✅ |
| `org_panel_system_status` | Chain health status card | ❌ | ✅ | ✅ |
| `org_panel_recommendations` | Context-aware recommendation cards | ❌ | ✅ | ✅ |
| `org_panel_crm_summary` | Cross-location CRM summary card | ❌ | ✅ | ✅ |
| `org_panel_capability_rollup` | Chain capability rollup on overview | ❌ | ✅ | ✅ |
| `org_propagation_products` | Propagate products/SKUs across chain | ✅ | ✅ | ✅ |
| `org_propagation_categories` | Propagate categories across chain | ✅ | ✅ | ✅ |
| `org_propagation_gbp` | GBP category sync across chain | ❌ | ✅ | ✅ |
| `org_propagation_branding` | Brand asset propagation | ❌ | ❌ | ✅ |
| `org_propagation_feature_flags` | Feature flag propagation | ❌ | ✅ | ✅ |
| `org_propagation_roles` | User role propagation | ❌ | ✅ | ✅ |
| `org_propagation_business_info` | Business hours/profile propagation | ❌ | ✅ | ✅ |
| `org_bot_management` | Cross-location bot management | ❌ | ❌ | ✅ |
| `org_branding_control` | Org-wide branding control | ❌ | ❌ | ✅ |
| `org_directory_management` | Org-wide directory listing management | ❌ | ✅ | ✅ |
| `org_storefront_management` | Org-wide storefront configuration | ❌ | ✅ | ✅ |
| `org_order_management` | Cross-location order management | ❌ | ✅ | ✅ |
| `org_advanced_analytics` | Chain-wide analytics dashboard | ❌ | ❌ | ✅ |

### Tier Gating Matrix (VIP Experience)

**chain_starter** — Essentials:
- Tabs: Overview, Locations, Propagation (products + categories only), Billing
- Panels: Task checklist, Quick links
- No team management, no commerce config, no CRM, no capabilities tab

**chain_professional** — Growth:
- All chain_starter features, plus:
- Tabs: Capabilities, Team, Commerce
- Panels: System status, Recommendations, CRM summary, Capability rollup
- Propagation: GBP sync, feature flags, roles, business info
- Directory management, storefront management, order management

**chain_enterprise** — Full VIP:
- All chain_professional features, plus:
- Propagation: Branding
- Bot management, branding control, advanced analytics

### Backend Implementation

**New resolver:** `apps/api/src/services/resolvers/resolveOrgOptions.ts`

```typescript
// Resolves organization_options capability for an org tier
// Returns: { enabled, allowedTabs[], allowedPanels[], allowedFeatures[] }
export async function resolveOrgOptions(
  orgTierKey: string,
  merchantPrefs?: Record<string, boolean>
): Promise<OrgOptionsState> {
  // Fetch tier_features_list for org tier + organization_options capability type
  // Map feature keys to tab/panel/feature availability
  // Apply merchant prefs (future: org-level settings table)
}
```

**New endpoint:** `GET /api/organizations/:orgId/effective-capabilities`

```typescript
// Returns org-level effective capabilities
// {
//   tier: { key: "chain_professional", name: "Chain Professional" },
//   effective: {
//     organization_options: {
//       enabled: true,
//       allowedTabs: ["overview", "locations", "propagation", "capabilities", "team", "commerce", "billing"],
//       allowedPanels: ["task_checklist", "quick_links", "system_status", "recommendations", "crm_summary", "capability_rollup"],
//       allowedFeatures: ["org_propagation_products", "org_propagation_categories", "org_propagation_gbp", ...],
//     }
//   }
// }
```

**Registration in `EffectiveCapabilityResolver`:** Add `resolveOrgOptions` to the resolver dispatch when `organization_options` capability type is present in the org tier's features.

### Frontend Integration

**New hook:** `useOrgCapabilities(organizationId)`

```typescript
// Fetches org-level effective capabilities
// Returns: { tabs, panels, features, loading, error }
// tabs: string[] — allowed tab keys
// panels: string[] — allowed panel keys
// features: Record<string, boolean> — feature key to enabled
```

**Tab gating in `OrganizationDashboard.tsx`:**

```typescript
const { tabs: allowedTabs, features } = useOrgCapabilities(organizationId);

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, feature: 'org_tab_overview' },
  { key: 'locations', label: 'Locations', icon: MapPin, feature: 'org_tab_locations' },
  { key: 'propagation', label: 'Propagation', icon: Zap, feature: 'org_tab_propagation' },
  { key: 'capabilities', label: 'Capabilities', icon: Sparkles, feature: 'org_tab_capabilities' },
  { key: 'team', label: 'Team', icon: Users, feature: 'org_tab_team' },
  { key: 'commerce', label: 'Commerce', icon: ShoppingCart, feature: 'org_tab_commerce' },
  { key: 'billing', label: 'Billing', icon: CreditCard, feature: 'org_tab_billing' },
].filter(tab => features[tab.feature] !== false);
```

**Panel gating:** Each action panel on the Overview tab checks its feature flag before rendering. If `org_panel_system_status` is false, the `OrgSystemStatusCard` is not rendered.

**Propagation gating:** Individual propagation toggles in `OrgPropagationPanel` check their feature flags. If `org_propagation_gbp` is false, the GBP sync toggle is hidden (or shown as locked with upgrade CTA).

### Role-Based Tab Visibility (RBAC)

In addition to capability gating, tabs have role-based visibility:

| Tab | PLATFORM_ADMIN | ORG_OWNER | ORG_ADMIN | ORG_MEMBER |
|-----|:---:|:---:|:---:|:---:|
| Overview | ✅ | ✅ | ✅ | ✅ |
| Locations | ✅ | ✅ | ✅ | read-only |
| Propagation | ✅ | ✅ | ✅ | ❌ |
| Capabilities | ✅ | ✅ | ✅ | ❌ |
| Team | ✅ | ✅ | ✅ | ❌ |
| Commerce | ✅ | ✅ | ✅ | ❌ |
| Billing | ✅ | ✅ | ❌ | ❌ |

**Implementation:** Combine capability gating + RBAC:

```typescript
const visibleTabs = TABS.filter(tab => {
  const capAllowed = features[tab.feature] !== false;
  const roleAllowed = checkTabRoleAccess(tab.key, userRole);
  return capAllowed && roleAllowed;
});
```

### Upgrade Messaging

When a tab or panel is capability-gated (tier doesn't include it):
- Show a **locked tab** with a lock icon and "Upgrade to Chain Professional" tooltip
- Or hide the tab entirely and show an upgrade banner on the Overview tab: "Unlock Team Management, CRM, and more with Chain Professional"
- Use existing `tiers-by-capability` endpoint (`GET /api/tenants/capabilities/tiers-by-capability?capabilityTypeKey=organization_options`) to show which tiers unlock the feature

---

## 3. Redesigned Layout — Tab Architecture

### 3.1 Tab Structure

```
┌─────────────────────────────────────────────────────────┐
│  Sticky Org Header (name, tier badge, refresh, back)    │
├─────────────────────────────────────────────────────────┤
│  [Overview] [Locations] [Propagation] [Capabilities]    │
│  [Team] [Commerce] [Billing]                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Tab Content Area                                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tab Definitions

| Tab | Purpose | Primary Audience | Capability Feature | Min Tier |
|-----|---------|-----------------|-------------------|----------|
| **Overview** | At-a-glance org health: KPIs, hero location, usage gauges, warnings | All org members | `org_tab_overview` | chain_starter |
| **Locations** | Location breakdown table with per-location health, SKU counts, capability status | Org admins | `org_tab_locations` | chain_starter |
| **Propagation** | Hero sync, propagation control panel, GBP category sync | Org admins | `org_tab_propagation` | chain_starter |
| **Capabilities** | Capability rollup across chain, CRM/FAQ/Bot status per location | Org admins | `org_tab_capabilities` | chain_professional |
| **Team** | Cross-location employee overview, role distribution, pending invitations, seat usage | Org admins/owners | `org_tab_team` | chain_professional |
| **Commerce** | Commerce settings entry, payment config summary | Org admins | `org_tab_commerce` | chain_professional |
| **Billing** | Subscription, invoices, usage limits, upgrade | Org owners | `org_tab_billing` | chain_starter |

---

## 4. Component Extraction Plan

### 4.1 New Components to Create

All new components go in `apps/web/src/components/organization/`.

#### `OrgDashboardHeader.tsx`
- Sticky top bar with org name, tier badge, refresh button, back link
- Mirrors `TenantDashboardV2` header pattern
- Props: `orgName`, `organizationId`, `tier`, `onRefresh`

#### `OrgKpiGrid.tsx`
- 4 KPI cards using existing `KpiCard` component
- Metrics: Total Locations, Total SKUs, Active Storefronts, Chain Health Score
- Each card uses `KpiCard` with icon, sparkline placeholder, trend indicator
- Props: `billingCounters`, `orgData`

#### `OrgHeroLocationBanner.tsx`
- Extracted hero location banner with crown icon (use `lucide-react` `Crown`)
- Shows hero location name, SKU count, "Set/Change Hero" button
- Props: `heroLocation`, `onChangeHero`

#### `OrgHeroLocationModal.tsx`
- Extracted hero selection modal
- Location list with SKU counts, current hero indicator
- Props: `locations`, `currentHeroId`, `onSelect`, `onClose`

#### `OrgUsageGauges.tsx`
- Compact usage bars for locations and SKUs with color-coded thresholds
- Replaces the inline gauge code in the welcome section
- Merges warning messages into this component
- Props: `billingCounters`, `orgData`

#### `OrgLocationTable.tsx`
- Redesigned location breakdown as a proper table/grid
- Columns: Name, SKU Count, Hero badge, Storefront Status, Capability Quick-Stats
- Uses `lucide-react` icons instead of inline SVG
- Pagination preserved
- Props: `locations`, `heroLocation`, `orgData`, `currentPage`, `onPageChange`

#### `OrgPropagationPanel.tsx`
- Extracted propagation control panel
- 4 groups preserved: Product & Catalog, Business Information, Configuration & Settings, Branding & Assets
- All inline SVGs replaced with `lucide-react` icons
- Sync result display consolidated (single instance, not duplicated)
- Props: `organizationId`, `heroLocation`, `onSyncFromHero`, `onSyncCategories`, `syncing`, `syncResult`

#### `OrgCategorySyncModal.tsx`
- Extracted GBP category sync modal
- Scope selection (all/single), tenant selector
- Props: `locations`, `onSync`, `onClose`, `syncing`

#### `OrgCapabilityRollup.tsx` (NEW)
- Shows capability status across all locations in the chain
- Uses `useAllCapabilities` per location (or batch fetch if API supports)
- Groups: Commerce, Storefront, Fulfillment, Barcode, FAQ, CRM, Chatbot
- Each row: capability name, # locations enabled, # locations gated, # locations tier-blocked
- Links to per-location capability settings
- Props: `organizationId`, `locations`

#### `OrgCrmSummaryCard.tsx` (NEW)
- Cross-location CRM summary: open tickets count, pending tasks, recent alerts
- Uses existing CRM service to aggregate across org's tenants
- Links to admin CRM dashboard or tenant support pages
- Props: `organizationId`, `locations`

#### `OrgQuickActionsBar.tsx`
- Horizontal action bar: Sync from Hero, Propagate Items, Commerce Settings, Team, Upgrade Plan
- Replaces the scattered quick action buttons across 3 cards
- Props: `organizationId`, `heroLocation`, `onSyncFromHero`, `syncing`

#### `OrgTaskChecklist.tsx` (NEW)
- Chain-wide onboarding/completion task checklist with progress ring
- Mirrors `TaskChecklist` pattern from TenantDashboardV2 but with org-level tasks
- Tasks (each with done/undone state + deep link):
  - "Set your hero location" — done when `heroLocation` is set → Propagation tab
  - "Add products to hero location" — done when `heroLocation.skuCount > 0` → `/t/{heroTenantId}/items`
  - "Propagate catalog to all locations" — done when all non-hero locations have SKUs → Propagation tab
  - "Configure commerce settings" — done when commerce settings exist → Commerce tab
  - "Invite team members" — done when at least one location has >1 user → Team tab
  - "Enable CRM for support" — done when CRM capability is enabled for any location → Capabilities tab
  - "Set up FAQ for hero location" — done when hero location has FAQs → `/t/{heroTenantId}/faq`
  - "Publish directory listings" — done when all locations have published directory → Locations tab
  - "Connect payment gateways" — done when hero location has active gateway → `/t/{heroTenantId}/settings/payment-gateways`
  - "Activate subscription" — done when `orgData.subscriptionStatus === 'active'` → Billing tab
- Progress ring SVG (same as `TaskChecklist`), completed count, percentage
- Props: `orgData`, `heroLocation`, `locations`, `commerceSettings`, `teamData`

#### `OrgQuickLinks.tsx` (NEW)
- Navigational shortcuts panel mirroring TenantDashboardV2's Quick Links section
- Links grouped by category:
  - **Platform Admin** (if `isPlatformAdmin`): Admin CRM (`/settings/admin/crm`), Admin Organizations (`/settings/admin/organizations`), Admin Capabilities (`/settings/admin/capabilities`), Admin Analytics (`/settings/admin/analytics`)
  - **Chain Management**: Subscription (`/settings/subscription`), Commerce Settings (`/settings/organization/commerce`), Propagation (tab link), Billing (tab link)
  - **Per-Location**: Hero Location Dashboard (`/t/{heroTenantId}/dashboard`), Hero Location Support (`/t/{heroTenantId}/support`), Hero Location Settings (`/t/{heroTenantId}/settings`)
  - **Resources**: Platform Directory (`/directory`), Help & Support (`/settings/admin/crm/requests`)
- Each link: icon (lucide-react), label, sub-label, arrow — same styling as TenantDashboardV2 Quick Links
- Props: `organizationId`, `heroLocation`, `userRole`, `onNavigate`

#### `OrgSystemStatusCard.tsx` (NEW)
- Chain-wide system health card mirroring `SystemStatusCard` from TenantDashboardV2
- Status rows:
  - Hero Location Sync — ok/warning based on last sync timestamp
  - Propagation Health — ok if all locations have SKUs, warning if some don't
  - Payment Gateway Coverage — ok if all locations have gateways, warning/error if gaps
  - Storefront Status — ok if all active, warning if some inactive
  - CRM Ticket Health — ok if no urgent tickets, warning if open urgent tickets
  - Directory Visibility — ok if all published, warning if some unpublished
- Header: "All Systems Operational" or "Attention Needed" with colored dot
- Links to relevant tab or platform admin page for each issue
- Props: `orgData`, `heroLocation`, `locations`, `crmData`

#### `OrgRecommendationsCard.tsx` (NEW)
- Actionable growth recommendations using existing `RecommendationCard` component
- Context-aware recommendations (shown conditionally based on org state):
  - "Propagate your catalog" — if hero has products but some locations have 0 SKUs → Propagation tab
  - "Invite team members" — if any location has only 1 user (owner only) → Team tab
  - "Enable CRM for customer support" — if CRM capability is tier-allowed but not enabled → Capabilities tab
  - "Configure commerce settings" — if commerce settings not configured → Commerce tab
  - "Set up FAQ for self-service" — if FAQ capability is enabled but no FAQs created → `/t/{heroTenantId}/faq`
  - "Upgrade your plan" — if at 80%+ capacity on locations or SKUs → Billing tab
  - "Connect payment gateways" — if locations missing active gateways → `/t/{heroTenantId}/settings/payment-gateways`
- Rendered in 2-column grid using `RecommendationCard` (same as TenantDashboardV2)
- Props: `orgData`, `heroLocation`, `locations`, `teamData`, `capabilities`

#### `OrgBillingCard.tsx`
- Unified billing card: subscription tier, status, usage, upgrade/invoice buttons
- Merges current "Organization Billing" card + warning messages + SubscriptionUsageBadge
- Props: `billingCounters`, `orgData`

#### `OrgCommerceCard.tsx`
- Commerce settings entry point with current mode summary
- Shows deposit/full payment status, auto-confirm status
- Links to full commerce settings page
- Props: `organizationId`

#### `OrgTabNav.tsx`
- Tab navigation component with active state
- Responsive: horizontal scroll on mobile, full tabs on desktop
- Props: `activeTab`, `onTabChange`, `tabs`

#### `OrgTeamOverview.tsx` (NEW)
- Cross-location employee management dashboard
- Three sections: KPI summary, per-location team table, pending invitations
- KPIs: Total Employees (across all locations), Locations with Teams, Pending Invitations, Seat Usage
- Per-location table: Location name, # employees, role breakdown (Owner/Admin/Member/Viewer/Support), "Manage Team" link to `/t/{tenantId}/settings/users`
- Pending invitations aggregated across all locations with location name, email, role, sent date
- Uses `tenantInfoService.getUsers(tenantId)` and `tenantInfoService.getPendingInvitations(tenantId)` per location (batch-fetched via `Promise.all`)
- Seat limit display: shows per-location seat usage if available from tier limits
- Props: `locations` (array of tenant IDs from orgData), `orgData`

#### `OrgEmployeeDistribution.tsx` (NEW)
- Visual role distribution chart across the chain
- Horizontal bar or donut showing: # Owners, # Admins, # Support, # Members, # Viewers
- Color-coded using same role colors as tenant users page (`ROLE_COLORS` map)
- Below chart: list of unique employees (deduplicated by email) with their roles across locations
- Shows which locations each employee has access to
- Props: `locations`, `orgData`

### 4.2 Existing Components to Reuse

| Component | Source | Usage |
|-----------|--------|-------|
| `KpiCard` | `components/dashboard/KpiCard.tsx` | Org KPI grid |
| `SubscriptionUsageBadge` | `components/subscription/SubscriptionUsageBadge.tsx` | Billing tab |
| `SubscriptionDisplayCard` | `components/subscription/SubscriptionDisplayCard.tsx` | Billing tab |
| `CapabilityShowcase` | `components/dashboard/CapabilityShowcase.tsx` | Capabilities tab (adapt for org context) |
| `PlanSummaryPanel` | `components/settings/PlanSummaryPanel.tsx` | Capabilities tab |
| `CrmTenantWidget` | `components/crm/CrmTenantWidget.tsx` | CRM summary (per-location or aggregated) |
| `RecommendationCard` | `components/dashboard/RecommendationCard.tsx` | Org recommendations grid |
| `ProtectedCard` | `lib/auth/ProtectedCard.tsx` | Wrap admin-only sections |
| `AccessDenied` | `components/AccessDenied.tsx` | Access control screens |
| `Badge` | `components/ui/Badge.tsx` | Status indicators |
| `Button` | `@mantine/core` | All buttons |
| `Card` | `@mantine/core` | All cards |
| `Spinner` | `components/ui/Spinner.tsx` | Loading states |
| `DashboardSkeleton` | `components/dashboard/DashboardSkeleton.tsx` | Page loading state |

### 4.3 Existing Hooks to Integrate

| Hook | Source | Purpose |
|------|--------|---------|
| `useAllCapabilities` | `hooks/tenant-access/useCapabilityAccess.ts` | Per-location capability status |
| `useMerchantGates` | `hooks/tenant-access/useCapabilityAccess.ts` | Merchant-pref-aware gate status |
| `useAccessControl` | `lib/auth/useAccessControl.ts` | Already used — keep |
| `useOrganizationData` | `hooks/useApiQueries.ts` | Already used — keep |

### 4.3b New Hooks to Create

| Hook | Source | Purpose |
|------|--------|---------|
| `useOrgCapabilities` | `hooks/organization/useOrgCapabilities.ts` (NEW) | Fetches org-level effective capabilities from `GET /api/organizations/:orgId/effective-capabilities`. Returns `{ tabs, panels, features, loading, error }`. Used by `OrganizationDashboard.tsx` to gate tab/panel visibility. |
| `useOrgTabAccess` | `hooks/organization/useOrgTabAccess.ts` (NEW) | Combines `useOrgCapabilities` + `useAccessControl` to produce final tab visibility list. Applies both capability gating and RBAC role checks. Returns `{ visibleTabs, hiddenTabs, lockedTabs }`. |

### 4.4 Existing Services to Reuse for Team Tab

| Service | Source | Methods Used |
|---------|--------|-------------|
| `tenantInfoService` | `services/TenantInfoService.ts` | `getUsers(tenantId)`, `getPendingInvitations(tenantId)`, `inviteUser(tenantId, data)`, `updateUserRole(tenantId, userId, role)`, `deleteUser(tenantId, userId)`, `cancelInvitation(tenantId, invitationId)` |
| `tenantUserService` | `services/TenantUserService.ts` | `getTenantUsers(tenantId)`, `updateTenantUserRole(tenantId, userId, role)`, `removeTenantUser(tenantId, userId)` |

**Note:** There is no org-level user API endpoint. The Team tab aggregates per-tenant data by iterating `orgData.locationBreakdown` tenant IDs via `Promise.all`, following the same pattern as `useMerchantGates` in `useCapabilityAccess.ts`. A future backend optimization could add `GET /api/organizations/:id/users` to return all users across the chain in a single call.

---

## 5. Detailed Tab Specs

### 5.1 Overview Tab

```
┌──────────────────────────────────────────────────────────┐
│  Hero Location Banner (full width)                       │
├──────────────────────────────────────────────────────────┤
│  KPI Grid (4 cards: Locations, SKUs, Employees, Health)  │
├──────────────────────────────────────────────────────────┤
│  Quick Actions Bar (full width)                          │
│  (Sync, Propagate, Team, Commerce, Upgrade)              │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌──────────────────┐   │
│  │ LEFT (2/3)                  │  │ RIGHT (1/3)      │   │
│  │                             │  │                  │   │
│  │  Usage Gauges               │  │  Task Checklist  │   │
│  │  (locations + SKUs)         │  │  (progress ring  │   │
│  │                             │  │   + chain tasks) │   │
│  │  Recommendations Grid       │  │                  │   │
│  │  (2-col RecommendationCards │  │  Quick Links     │   │
│  │   — context-aware actions)  │  │  (nav shortcuts  │   │
│  │                             │  │   to platform    │   │
│  │  CRM Summary Card           │  │   pages + tabs)  │   │
│  │  (open tickets, alerts)     │  │                  │   │
│  │                             │  │  System Status   │   │
│  │                             │  │  (chain health   │   │
│  │                             │  │   at a glance)   │   │
│  └─────────────────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Layout:** 2/3 + 1/3 grid — mirrors TenantDashboardV2's main content split. Left column has usage gauges, recommendations, and CRM summary. Right column has task checklist, quick links, and system status — the action-oriented panels that make the dashboard a launchpad, not just a report.

**Motion:** Staggered `framer-motion` fade-in-up with 0.05s delay between cards.

**Data sources:**
- `billingCounters` for KPIs and gauges
- `orgData` for location count, SKU totals, subscription status
- `tenantInfoService.getUsers()` batch-fetched across locations for employee count KPI and task checklist team state
- CRM service for ticket/task counts (new aggregation call or iterate tenant IDs)
- `useAllCapabilities` per hero location for capability rollup preview and task checklist capability states
- `heroLocation` for task checklist hero-related tasks and quick links per-location shortcuts

**KPI cards:** Locations (total count), Total SKUs (sum across chain), Employees (unique users across all locations), Chain Health (aggregate status score from `OrgSystemStatusCard`).

**Action panels (right column):**
- **Task Checklist** — Chain-wide onboarding/completion tasks with progress ring. Each task links to the relevant tab or platform page. This is the primary "what to do next" driver.
- **Quick Links** — Navigational shortcuts to platform admin pages, chain management settings, hero location pages, and resources. Adapts based on user role (platform admin sees admin links).
- **System Status** — Chain health at a glance: sync status, propagation coverage, payment gateway coverage, storefront status, CRM ticket health, directory visibility. Each row links to the relevant tab when attention is needed.

**Recommendations (left column):** Context-aware `RecommendationCard` grid showing actionable suggestions based on org state (propagate catalog, invite team, enable CRM, configure commerce, set up FAQ, upgrade plan, connect gateways). Cards appear/disappear based on current state — only shows relevant recommendations.

### 5.2 Locations Tab

```
┌──────────────────────────────────────────────────────────┐
│  Location Table                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Name    │ SKUs   │ Hero │ Storefront │ Capabilities│  │
│  │─────────┼────────┼──────┼────────────┼─────────────│  │
│  │ Store A │ 1,200  │ 👑   │ Active     │ 8/12 on     │  │
│  │ Store B │ 800    │ —    │ Active     │ 7/12 on     │  │
│  │ Store C │ 450    │ —    │ Inactive   │ 4/12 on     │  │
│  └────────────────────────────────────────────────────┘  │
│  Pagination                                              │
├──────────────────────────────────────────────────────────┤
│  Per-Location Detail Panel (expandable row or side drawer)│
│  - Storefront status, hours, payment gateway             │
│  - Capability breakdown (commerce, FAQ, CRM, bot)        │
│  - Link to tenant dashboard                              │
└──────────────────────────────────────────────────────────┘
```

**Styling:** White `rounded-2xl` card with `border border-gray-100 shadow-sm`. Table rows with `hover:bg-gray-50` transition. Hero row highlighted with `bg-amber-50 border-amber-200`.

**Per-location capability status:** Use a mini progress indicator (e.g., "8/12 on") with color coding: green (all on), amber (partial), red (most off).

**Navigation:** "View Items" button uses `Link` instead of `window.location.href`.

### 5.3 Propagation Tab

```
┌──────────────────────────────────────────────────────────┐
│  Quick Actions Bar (Sync from Hero, Propagate Items)     │
├──────────────────────────────────────────────────────────┤
│  Sync Result Display (only when syncResult is set)       │
├──────────────────────────────────────────────────────────┤
│  Propagation Control Panel                               │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Product & Catalog   │  │ Business Information     │  │
│  │ - Categories        │  │ - Business Hours         │  │
│  │ - Products/SKUs     │  │ - Business Profile       │  │
│  │ - GBP Category Sync │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Configuration       │  │ Branding & Assets        │  │
│  │ - Feature Flags     │  │ - Brand Assets           │  │
│  │ - User Roles        │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Changes from current:**
- All inline SVGs replaced with `lucide-react` icons (`Tag`, `Package`, `Clock`, `Building`, `Flag`, `Users`, `Palette`, `Globe`)
- Sync result shown once (not duplicated as in current Quick Actions + Propagation Panel)
- `confirm()` dialog replaced with Mantine `Modal` or toast-based confirmation
- Wrap in `ProtectedCard` with `CHAIN_PROPAGATION` access (already done — preserve)

### 5.4 Capabilities Tab (NEW)

```
┌──────────────────────────────────────────────────────────┐
│  Chain Capability Rollup                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Capability      │ Locations On │ Gated │ Tier-Block│  │
│  │─────────────────┼──────────────┼───────┼───────────│  │
│  │ Commerce        │ 4/5          │ 0     │ 1         │  │
│  │ Storefront      │ 5/5          │ 0     │ 0         │  │
│  │ Payment Gateway │ 3/5          │ 1     │ 1         │  │
│  │ Fulfillment     │ 5/5          │ 0     │ 0         │  │
│  │ Barcode Scan    │ 2/5          │ 1     │ 2         │  │
│  │ FAQ             │ 3/5          │ 2     │ 0         │  │
│  │ CRM             │ 5/5          │ 0     │ 0         │  │
│  │ Chatbot         │ 1/5          │ 0     │ 4         │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Per-Location Capability Detail (selectable)             │
│  Uses PlanSummaryPanel for selected location             │
│  Dropdown to select location                              │
└──────────────────────────────────────────────────────────┘
```

**Data source:** Iterate `orgData.locationBreakdown` and call `useAllCapabilities(tenantId)` for each. Cache results. Show aggregated counts in the rollup table. When a location is selected, render `PlanSummaryPanel` with that location's capabilities.

**Fallback:** If per-location capability fetching is too slow, show rollup for hero location only with a note: "Detailed capability data shown for hero location. Per-location breakdown loading..."

### 5.5 Team Tab (NEW)

```
┌──────────────────────────────────────────────────────────┐
│  Team KPI Summary (4 cards)                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐ │
│  │ Total      │ │ Locations  │ │ Pending    │ │ Seat   │ │
│  │ Employees  │ │ with Teams │ │ Invites    │ │ Usage  │ │
│  │ 24         │ │ 5/5        │ │ 3          │ │ 24/40  │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────┘ │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────┐  │
│  │ Per-Location Team Table  │  │ Role Distribution    │  │
│  │ ┌──────────────────────┐ │  │  ┌────────────────┐  │  │
│  │ │Location │ Team │Roles│ │  │  │ Owner    ███ 3 │  │  │
│  │ │─────────┼──────┼─────│ │  │  │ Admin    ████ 5│  │  │
│  │ │Store A  │ 6    │1O3A2M│ │  │  │ Support  ██ 2  │  │  │
│  │ │Store B  │ 5    │1O2A2M│ │  │  │ Member   ██████│  │  │
│  │ │Store C  │ 4    │1O1A2V│ │  │  │          10    │  │  │
│  │ │...      │      │     │ │  │  │ Viewer   ████ 4 │  │  │
│  │ └──────────────────────┘ │  │  └────────────────┘  │  │
│  │ [Manage Team →] per row  │  │                      │  │
│  └──────────────────────────┘  │  Unique Employees    │  │
│                                 │  (deduplicated)      │  │
│                                 │  ┌────────────────┐  │  │
│                                 │  │ alice@… 3 locs │  │  │
│                                 │  │ bob@…   2 locs │  │  │
│                                 │  │ carol@… 1 loc  │  │  │
│                                 │  └────────────────┘  │  │
│                                 └──────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Pending Invitations (all locations)                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Email           │ Location │ Role    │ Sent        │  │
│  │─────────────────┼──────────┼─────────┼─────────────│  │
│  │ newhire@…       │ Store A  │ MEMBER  │ Jun 12      │  │
│  │ manager@…       │ Store C  │ ADMIN   │ Jun 10      │  │
│  │ temp@…          │ Store B  │ VIEWER  │ Jun 08      │  │
│  └────────────────────────────────────────────────────┘  │
│  [Cancel] per row                                        │
├──────────────────────────────────────────────────────────┤
│  Quick Actions                                           │
│  [Invite to Location →] (opens location picker modal)    │
│  [Manage Per-Location Team →] (links to selected loc)    │
└──────────────────────────────────────────────────────────┘
```

**Layout:** 2/3 + 1/3 grid — per-location team table on left, role distribution + unique employees on right. Pending invitations full width below. Quick actions bar at bottom.

**Data source:** Batch-fetch users and invitations for all tenant IDs in `orgData.locationBreakdown`:

```typescript
const tenantIds = orgData.locationBreakdown.map(l => l.tenantId);
const [allUsers, allInvites] = await Promise.all([
  Promise.all(tenantIds.map(id => tenantInfoService.getUsers(id).catch(() => []))),
  Promise.all(tenantIds.map(id => tenantInfoService.getPendingInvitations(id).catch(() => []))),
]);
// Tag each result with its tenantId for cross-referencing
```

**Per-location team table columns:**
- Location Name (with hero crown badge if applicable)
- Team Size (number of users)
- Role Breakdown (compact badges: "1O 3A 2M" = 1 Owner, 3 Admins, 2 Members)
- "Manage Team" button → `Link` to `/t/{tenantId}/settings/users`

**Role distribution chart:**
- Horizontal bars using `ROLE_COLORS` from tenant users page
- Counts: `OWNER`, `ADMIN`, `SUPPORT`, `MEMBER`, `VIEWER` across all locations
- Total unique employees (deduplicated by email/user ID) shown below

**Unique employees list:**
- Deduplicate by user ID/email across locations
- Show: name, email, # locations they have access to, role badges per location
- Click to expand: shows which locations and their role at each

**Pending invitations:**
- Aggregated across all locations
- Columns: Email, Location Name, Role, Sent Date, Cancel button
- Cancel calls `tenantInfoService.cancelInvitation(tenantId, invitationId)` with the correct tenant context

**Invite to Location:**
- Modal with location dropdown (select from org's locations)
- Email + role fields (same as tenant invite form)
- Calls `tenantInfoService.inviteUser(selectedTenantId, { email, role })`
- Shows seat limit error if applicable (same `seat_limit_reached` handling as tenant page)

**Access control:** Wrap in `ProtectedCard` with `AccessPresets.ORGANIZATION_MEMBER` or `SUPPORT_OR_TENANT_ADMIN` — only org admins/owners can see team details. Viewers see read-only summary.

**Styling:** Same `rounded-2xl` cards, `lucide-react` icons (`Users`, `UserPlus`, `Mail`, `Crown`, `Trash2`, `Pencil`), `framer-motion` staggered reveals. Role badges use same `ROLE_COLORS` map as `t/[tenantId]/settings/users/page.tsx`.

### 5.6 Commerce Tab

```
┌──────────────────────────────────────────────────────────┐
│  Commerce Mode Summary                                   │
│  Badge: "Both Options Available" / "Deposit Only" / etc  │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Payment Options     │  │ Order Management         │  │
│  │ - Deposit: On (15%) │  │ - Auto-confirm: On (15m) │  │
│  │ - Full Payment: On  │  │ - Notifications: On      │  │
│  └─────────────────────┘  └──────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  [Configure Commerce Settings →]                         │
└──────────────────────────────────────────────────────────┘
```

**Data source:** Fetch commerce settings via `organizationsService.getOrganizationCommerceSettings(organizationId)` — same as commerce page. Display read-only summary. Link to full commerce settings page.

### 5.7 Billing Tab

```
┌──────────────────────────────────────────────────────────┐
│  Subscription Display Card                               │
│  (tier, status, limits, usage)                           │
├──────────────────────────────────────────────────────────┤
│  Usage Gauges (locations + SKUs with progress bars)      │
│  Warning messages (if at/warning limit)                  │
├──────────────────────────────────────────────────────────┤
│  [Manage Plan]  [View Invoices]  [Upgrade]               │
└──────────────────────────────────────────────────────────┘
```

**Components:** `SubscriptionDisplayCard` + `SubscriptionUsageBadge` + `OrgUsageGauges` + `OrgBillingCard`.

---

## 6. Organization Selection Screen Redesign

When no `organizationId` is resolved (no URL param, no hook data), show the org picker. Redesign to match TenantDashboardV2 aesthetic:

- `bg-gray-50 min-h-screen` background
- White `rounded-2xl` cards with `shadow-sm`
- `lucide-react` `Building2` icon for org entries
- `framer-motion` staggered card entrance
- `Link` instead of `window.location.href`
- Org cards in responsive grid (1 col mobile, 2 col tablet, 3 col desktop)

---

## 7. Tenant-Scoped Organization Page

**Current:** `t/[tenantId]/settings/organization/page.tsx` is a 50-line stub showing "coming soon" text.

**Redesign:** Render the same `OrganizationDashboard` component used in the platform route, passing `tenantId` as context. The component already resolves `organizationId` from `useAccessControl` hook when `tenantId` is available. This eliminates the stub and gives tenant-scoped users the full dashboard.

```tsx
// t/[tenantId]/settings/organization/page.tsx
import SetTenantId from '@/components/client/SetTenantId';
import OrganizationDashboard from '@/components/organization/OrganizationDashboard';

export default async function TenantScopedOrgSettings({ params }) {
  const { tenantId } = await params;
  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <OrganizationDashboard tenantId={tenantId} />
    </>
  );
}
```

---

## 8. Styling Standards

### 8.1 Design Tokens (align with TenantDashboardV2)

| Token | Value |
|-------|-------|
| Background | `bg-gray-50` (light) / `bg-gray-950` (dark) |
| Card | `bg-white rounded-2xl border border-gray-100 shadow-sm` |
| Card hover | `hover:shadow-md transition-shadow` |
| Text primary | `text-gray-900` (light) / `text-white` (dark) |
| Text secondary | `text-gray-500` (light) / `text-gray-400` (dark) |
| Accent | `text-blue-600` |
| Success | `text-emerald-600` / `bg-emerald-50` |
| Warning | `text-amber-600` / `bg-amber-50` |
| Error | `text-rose-600` / `bg-rose-50` |
| Border | `border-gray-100` (light) / `border-gray-800` (dark) |
| Max width | `max-w-7xl mx-auto` |
| Padding | `px-4 sm:px-6 lg:px-8 py-6` |

### 8.2 Icon Migration

Replace all inline SVGs with `lucide-react` imports:

| Current inline SVG | lucide-react replacement |
|--------------------|-------------------------|
| Crown (hero) | `Crown` |
| Settings gear | `Settings` |
| Sync arrows | `RefreshCw` |
| Upload cloud | `Upload` |
| Tag (categories) | `Tag` |
| Package (products) | `Package` |
| Clock (hours) | `Clock` |
| Building (profile) | `Building` |
| Flag (feature flags) | `Flag` |
| Users (roles) | `Users` |
| Palette (brand) | `Palette` |
| Globe (GBP) | `Globe` |
| Credit card (billing) | `CreditCard` |
| Shopping cart (commerce) | `ShoppingCart` |
| Alert triangle (warnings) | `AlertTriangle` |
| Check circle (success) | `CheckCircle2` |
| Chevron down (collapse) | `ChevronDown` |
| Chevron right (navigate) | `ChevronRight` |
| Lightning (propagation) | `Zap` |
| Info (tips) | `Info` |

### 8.3 Motion Pattern

Use `framer-motion` with staggered reveals matching TenantDashboardV2:

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 * index }}
>
  {/* card content */}
</motion.div>
```

### 8.4 Feedback Pattern

Replace `alert()` with toast notifications:

```tsx
import { toast } from '@/hooks/use-toast';

// Success
toast({ title: 'Hero location updated', description: `${tenantName} is now the hero location.` });

// Error
toast({ title: 'Error', description: err.message, variant: 'destructive' });
```

Replace `confirm()` with Mantine `Modal`:

```tsx
import { Modal, Button } from '@mantine/core';

<Modal opened={showConfirm} onClose={...} title="Confirm Sync">
  <p>This will copy all products from your hero location to all other locations. Continue?</p>
  <Button onClick={handleConfirm}>Sync Now</Button>
</Modal>
```

### 8.5 Navigation Pattern

Replace all `window.location.href = '...'` with Next.js `Link` or `useRouter`:

```tsx
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const router = useRouter();
// Instead of: window.location.href = '/settings/subscription'
// Use: router.push('/settings/subscription');

// For links in JSX:
<Link href={`/settings/organization/commerce?organizationId=${organizationId}`}>
  <Button>Commerce Settings</Button>
</Link>
```

---

## 9. Dead Code Removal

### Remove entirely:

| Item | Lines | Reason |
|------|-------|--------|
| Quick Start Guide section | 1381–1507 | Educational content with no functional value. Propagation Panel already describes each action. |
| Detailed Sync Guide section | 1509–1676 | Duplicates Propagation Control Panel descriptions. 8 propagation types listed twice. |
| All commented-out `console.log` | ~15 instances | Dead debug code |
| Duplicate sync result in Quick Actions | 894–906 | Already shown in Propagation Panel. Show once. |
| Inline SVG paths | ~40+ | Replace with `lucide-react` |

### Keep but refactor:

| Item | Lines | Action |
|------|-------|--------|
| Organization selection screen | 376–498 | Extract to component, restyle |
| Access control logic | 45–92, 349–374 | Keep logic, extract to hook or preserve in main component |
| Handler functions | 223–347 | Keep all logic, move to component props |
| `OrganizationData` interface | 19–43 | Move to types file or keep in main component |

---

## 10. Implementation File Structure

```
apps/web/src/
├── app/
│   ├── (platform)/settings/organization/
│   │   ├── page.tsx                          # Thin wrapper → <OrganizationDashboard />
│   │   └── commerce/page.tsx                 # Keep as-is (separate page)
│   └── t/[tenantId]/settings/organization/
│       └── page.tsx                          # Thin wrapper → <OrganizationDashboard tenantId={tenantId} />
│
├── components/
│   └── organization/
│       ├── OrganizationDashboard.tsx          # Main orchestrator (tab state, data fetching, access control)
│       ├── OrgDashboardHeader.tsx             # Sticky header
│       ├── OrgTabNav.tsx                      # Tab navigation
│       ├── OrgKpiGrid.tsx                     # 4 KPI cards
│       ├── OrgHeroLocationBanner.tsx          # Hero location banner
│       ├── OrgHeroLocationModal.tsx           # Hero selection modal
│       ├── OrgUsageGauges.tsx                 # Usage bars with warnings
│       ├── OrgQuickActionsBar.tsx             # Horizontal action bar
│       ├── OrgLocationTable.tsx               # Location breakdown table
│       ├── OrgPropagationPanel.tsx            # Propagation control panel
│       ├── OrgCategorySyncModal.tsx           # GBP category sync modal
│       ├── OrgCapabilityRollup.tsx            # Chain capability rollup (NEW)
│       ├── OrgCrmSummaryCard.tsx              # Cross-location CRM summary (NEW)
│       ├── OrgTaskChecklist.tsx               # Chain-wide task checklist with progress ring (NEW)
│       ├── OrgQuickLinks.tsx                  # Navigational shortcuts to platform pages (NEW)
│       ├── OrgSystemStatusCard.tsx            # Chain health status at a glance (NEW)
│       ├── OrgRecommendationsCard.tsx         # Context-aware growth recommendations (NEW)
│       ├── OrgTeamOverview.tsx                # Cross-location employee management (NEW)
│       ├── OrgEmployeeDistribution.tsx        # Role distribution chart (NEW)
│       ├── OrgBillingCard.tsx                 # Unified billing card
│       ├── OrgCommerceCard.tsx                # Commerce settings summary
│       ├── OrgLockedTab.tsx                   # Locked tab placeholder with upgrade CTA (NEW)
│       └── OrgSelectionScreen.tsx             # Organization picker (no org context)
│
├── hooks/
│   └── organization/
│       ├── useOrgDashboardData.ts             # Consolidated data fetching hook
│       ├── useOrgCapabilities.ts              # Org-level capability fetching (NEW)
│       └── useOrgTabAccess.ts                 # Combined capability + RBAC tab gating (NEW)
│
└── services/
    └── OrgCapabilityService.ts                # Client service for org effective-capabilities endpoint (NEW)

Backend (apps/api/src/):
├── services/resolvers/
│   └── resolveOrgOptions.ts                   # Org options capability resolver (NEW)
├── routes/
│   └── organization-capabilities.ts           # GET /api/organizations/:orgId/effective-capabilities (NEW)
└── services/
    └── EffectiveCapabilityResolver.ts          # Extended to include org_options resolution
```

### `OrganizationDashboard.tsx` (Main Orchestrator)

Responsibilities:
- Access control (`useAccessControl`)
- **Org capability gating** (`useOrgCapabilities`, `useOrgTabAccess`) — tabs/panels gated by org tier
- Data fetching (`useOrganizationData`, `billingCounters`, `userRole`)
- Tab state management (only visible/allowed tabs)
- Handler functions (hero location, sync, category sync)
- Render tab navigation + active tab content
- Loading state (`DashboardSkeleton` or custom org skeleton)
- Error state

```tsx
interface OrganizationDashboardProps {
  tenantId?: string;  // Optional: from tenant-scoped route
}

export default function OrganizationDashboard({ tenantId }: OrganizationDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  // ... access control, data fetching, handlers (preserved from current) ...

  if (loading) return <OrgDashboardSkeleton />;
  if (!userCanAccess) return <AccessDenied ... />;
  if (!organizationId) return <OrgSelectionScreen ... />;

  return (
    <div className="min-h-screen bg-gray-50">
      <OrgDashboardHeader orgName={...} tier={...} onRefresh={...} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <OrgTabNav activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS} />
        {activeTab === 'overview' && <OverviewTab ... />}
        {activeTab === 'locations' && <LocationsTab ... />}
        {activeTab === 'propagation' && <PropagationTab ... />}
        {activeTab === 'capabilities' && <CapabilitiesTab ... />}
        {activeTab === 'team' && <TeamTab ... />}
        {activeTab === 'commerce' && <CommerceTab ... />}
        {activeTab === 'billing' && <BillingTab ... />}
      </main>
      <OrgHeroLocationModal ... />
      <OrgCategorySyncModal ... />
    </div>
  );
}
```

### `useOrgDashboardData.ts` (Consolidated Data Hook)

Consolidates the 5+ scattered `useState` + `useEffect` patterns into a single hook:

```tsx
export function useOrgDashboardData(tenantId?: string, urlOrgId?: string) {
  // Access control
  // Organization data
  // Billing counters
  // User role
  // Available organizations (for picker)
  // Returns: { organizationId, orgData, billingCounters, userRole, loading, error, ... }
}
```

---

## 11. Migration & Execution Order

### Phase 1: Component Extraction (no visual changes)
1. Create `apps/web/src/components/organization/` directory
2. Extract `OrgHeroLocationModal` from current code
3. Extract `OrgCategorySyncModal` from current code
4. Extract `OrgPropagationPanel` from current code
5. Extract `OrgLocationTable` from current code
6. Extract `OrgSelectionScreen` from current code
7. Wire extracted components back into `page.tsx` — verify no regressions

### Phase 2: Dead Code Removal
8. Remove Quick Start Guide section (lines 1381–1507)
9. Remove Detailed Sync Guide section (lines 1509–1676)
10. Remove all commented-out `console.log` statements
11. Remove duplicate sync result display in Quick Actions
12. Verify page still renders correctly

### Phase 3: Icon & Navigation Migration
13. Replace all inline SVGs with `lucide-react` imports
14. Replace all `window.location.href` with `Link` / `useRouter`
15. Replace `alert()` with `toast`
16. Replace `confirm()` with Mantine `Modal`

### Phase 4: Tab Architecture
17. Create `OrgTabNav` component
18. Create `OrgDashboardHeader` component
19. Restructure `page.tsx` into tab-based layout
20. Create `OrganizationDashboard.tsx` as main orchestrator
21. Move handler functions and state to orchestrator
22. Create `useOrgDashboardData.ts` consolidated hook

### Phase 4b: Organization Capability Type (Backend)
23. Register `organization_options` capability type in `capability_type_list` table (migration SQL)
24. Define feature keys for org tabs, panels, propagation, and platform features
25. Assign features to org tiers (chain_starter, chain_professional, chain_enterprise) via `tier_features_list`
26. Create `resolveOrgOptions.ts` resolver in `apps/api/src/services/resolvers/`
27. Register org options resolver in `EffectiveCapabilityResolver.ts`
28. Create `GET /api/organizations/:orgId/effective-capabilities` endpoint in `organization-capabilities.ts`
29. Run `npm run checkapi` — zero TypeScript errors

### Phase 4c: Org Capability Frontend Integration
30. Create `OrgCapabilityService.ts` client service
31. Create `useOrgCapabilities.ts` hook
32. Create `useOrgTabAccess.ts` hook (combines capabilities + RBAC)
33. Wire `useOrgTabAccess` into `OrganizationDashboard.tsx` for tab filtering
34. Create `OrgLockedTab.tsx` component for locked tab placeholders with upgrade CTA
35. Wire panel-level capability gating on Overview tab
36. Wire propagation toggle capability gating in `OrgPropagationPanel`

### Phase 5: New Components
37. Create `OrgKpiGrid` using existing `KpiCard`
38. Create `OrgUsageGauges` (merge warning messages)
39. Create `OrgQuickActionsBar`
40. Create `OrgBillingCard` (merge billing + commerce link cards)
41. Create `OrgCommerceCard`
42. Create `OrgCapabilityRollup` (new capability rollup)
43. Create `OrgCrmSummaryCard` (new CRM summary)
44. Create `OrgTaskChecklist` (new chain-wide task checklist with progress ring)
45. Create `OrgQuickLinks` (new navigational shortcuts to platform pages)
46. Create `OrgSystemStatusCard` (new chain health status card)
47. Create `OrgRecommendationsCard` (new context-aware recommendations using `RecommendationCard`)
48. Create `OrgTeamOverview` (new cross-location employee management)
49. Create `OrgEmployeeDistribution` (new role distribution chart)

### Phase 6: Styling Polish
50. Apply `framer-motion` staggered animations
51. Apply dark mode classes
52. Apply `rounded-2xl` card styling
53. Apply responsive grid layouts
54. Create `OrgDashboardSkeleton` loading state

### Phase 7: Tenant-Scoped Page
55. Update `t/[tenantId]/settings/organization/page.tsx` to render `OrganizationDashboard`
56. Remove the stub content
57. Verify tenant-scoped access control works correctly

### Phase 8: Verification
58. Run `npm run checkweb` — zero TypeScript errors
59. Run `npm run checkapi` — zero TypeScript errors
60. Test all tabs render correctly (including Team tab)
61. Test hero location set/change flow
62. Test sync from hero flow
63. Test GBP category sync flow
64. Test organization selection screen
65. Test tenant-scoped route
66. Test access denied flow
67. Test responsive layouts (mobile, tablet, desktop)
68. Test Team tab: per-location user aggregation, role distribution, pending invitations, invite flow
69. Test Overview action panels: task checklist progress, quick links navigation, system status, recommendations
70. Test org capability gating: chain_starter sees only essential tabs, chain_professional sees all tabs, locked tabs show upgrade CTA
71. Test RBAC tab visibility: org_member sees only overview + locations (read-only), org_owner sees all allowed tabs
72. Test upgrade messaging: locked tabs show correct tier name and upgrade link

---

## 12. Preserved Components & Logic

### Must NOT change:

- `apps/web/src/app/(platform)/settings/organization/commerce/page.tsx` — Commerce settings page is separate and functional
- `OrganizationsSingletonService` — All service methods stay as-is
- `ApiQueriesSingletonService.getOrganizationBillingCounters` — Data source stays
- `useAccessControl` with `AccessPresets.ORGANIZATION_MEMBER` — Access control logic stays
- `ProtectedCard` with `AccessPresets.CHAIN_PROPAGATION` — Propagation access gating stays
- `SubscriptionUsageBadge` component — Reused as-is
- All handler function logic (`handleSetHeroLocation`, `handleSyncFromHero`, `handleSyncCategoriesToGBP`) — Business logic preserved, only UI wrappers change
- `OrganizationData` interface — Data shape preserved

---

## 13. Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Main file lines | 1,822 | ~200 (orchestrator only) |
| Components | 0 extracted | 23 extracted (+1 OrgLockedTab) |
| Inline SVGs | ~40+ | 0 |
| `window.location.href` | 12 | 0 |
| `alert()` calls | 3 | 0 |
| `confirm()` calls | 2 | 0 |
| Dead code lines | ~300 | 0 |
| Capability hooks | 0 | 5+ (including org-level) |
| Org capability type | None | `organization_options` with 26 feature keys |
| Org tier gating | None | chain_starter / chain_professional / chain_enterprise |
| RBAC tab visibility | None | Role-based tab filtering (owner/admin/member) |
| CRM integration | None | Summary card + per-location |
| Employee management | None | Team tab with cross-location rollup |
| Action panels | None | Task checklist, quick links, system status, recommendations |
| Tab navigation | None (single scroll) | 7 tabs (capability-gated) |
| Backend endpoints | 0 new | 1 new (`GET /api/organizations/:orgId/effective-capabilities`) |
| Backend resolvers | 0 new | 1 new (`resolveOrgOptions.ts`) |
| Dark mode | None | Full support |
| Motion/animation | None | Staggered reveals |
| Loading state | Basic spinner | Skeleton |
| Tenant-scoped page | Stub | Full dashboard |
| Execution steps | 0 | 72 |
