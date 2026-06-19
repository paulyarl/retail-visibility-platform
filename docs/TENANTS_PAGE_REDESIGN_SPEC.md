# Tenants Page Redesign — Comprehensive Design Spec

> **Status:** Ready for agent execution
> **Scope:** Frontend-only (layout, styling, UX). No backend changes required.
> **Route:** `/tenants`
> **Primary file:** `apps/web/src/components/tenants/TenantsClient.tsx` (1,001 lines — to be decomposed)

---

## 1. Current State Audit

### 1.1 File Inventory

| File | Lines | Role |
|---|---|---|
| `apps/web/src/app/tenants/page.tsx` | 10 | Route entry — renders `<TenantsClient />` |
| `apps/web/src/components/tenants/TenantsClient.tsx` | 1,001 | Monolithic component + inline `TenantRow` |
| `apps/web/src/components/tenants/CreateTenantModal.tsx` | 215 | Modal form for new tenant creation |
| `apps/web/src/components/tenants/SlugPatternSelector.tsx` | — | Slug preview selector inside create modal |
| `apps/web/src/components/tenant/ChangeLocationStatusModal.tsx` | — | Status change modal |

### 1.2 Current Architecture

```
/tenants (page.tsx)
  └── TenantsClient (1,001 lines)
       ├── PageHeader (Tailwind-based, shared)
       ├── ContextBadges
       ├── SubscriptionStatusGuide (conditional)
       ├── Quick Stats Grid (4× Mantine Card with inline SVGs)
       ├── Create Tenant Card (full-width, single button)
       ├── Tenants List Card (Mantine Card wrapping everything)
       │    ├── Title + View Toggle (grid/list)
       │    ├── Search TextInput
       │    ├── Chain Filter (3× Mantine Button)
       │    ├── Status Filter (7× Mantine Button with emoji)
       │    ├── Tenant List (grid: 2-col inline style / list: flex column)
       │    │    └── TenantRow (inline component, ~265 lines)
       │    │         ├── Org badge + building SVG + name badge
       │    │         ├── Tier badge + subscription status badge + location status badge
       │    │         ├── Product/user count text
       │    │         └── 6 action buttons in a horizontal row
       │    └── Pagination (Mantine)
       ├── ChangeLocationStatusModal (conditional)
       └── CreateTenantModal
```

### 1.3 Styling Stack

- **Mantine** (`@mantine/core`): `Card`, `Text`, `Title`, `Button`, `Badge`, `Alert`, `Modal`, `Pagination`, `Group`, `Stack`, `Grid`, `Container`, `ActionIcon`, `Flex`, `Box`, `Transition`, `Skeleton`, `TextInput`, `Button.Group`
- **Tailwind CSS**: Used in `PageHeader`, `ContextBadges`, `CreateTenantModal` (mixed)
- **Framer Motion**: `motion.div` for card entrance animations
- **Icons**: `@tabler/icons-react` (Mantine side) + inline SVGs (stats) + `lucide-react` (modal side)
- **No dark mode**: Mantine components lack explicit dark mode variants

### 1.4 Data Flow

```
TenantsClient
  ├── platformHomeService.getTenants() → Tenant[]
  ├── platformHomeService.createTenant() → Tenant
  ├── platformHomeService.updateTenant() → Tenant
  ├── platformHomeService.deleteTenant() → void
  ├── useAuth() → user (for permission checks)
  ├── canEditTenant / canDeleteTenant / canRenameTenant (access-control)
  └── Client-side filtering: searchQuery, chainFilter, statusFilter
       └── Client-side pagination: currentPage, pageSize (fixed at 10)
```

---

## 2. Full-Spectrum Gap Analysis

### 2.1 Layout & Information Architecture

| Gap | Severity | Description |
|---|---|---|
| **Monolithic component** | High | 1,001-line file with inline `TenantRow` — unmaintainable, no separation of concerns |
| **No layout variants** | High | Single fixed layout. Directory page already has `discovery`/`editorial`/`immersive` variants — tenants page has none |
| **No sidebar filter rail** | High | Filters are inline buttons in horizontal rows — no sticky sidebar, no collapsible sections, no mobile drawer |
| **Create tenant CTA wastes space** | Medium | Full-width card with one button — should be a header action or compact inline CTA |
| **No split-view option** | Medium | No master-detail layout for viewing tenant details without leaving the list |
| **Stats not interactive** | Medium | 4 stat cards are display-only — clicking should filter (e.g., click "Chain Locations" → filter to chain) |

### 2.2 Filter & Search UX

| Gap | Severity | Description |
|---|---|---|
| **10 filter buttons in rows** | High | 3 chain + 7 status buttons rendered as flat horizontal Mantine Button groups — visually overwhelming, no grouping |
| **No sort control** | High | No sort options (by name, created date, item count, user count) |
| **No filter count badge** | Medium | No indicator showing how many filters are active |
| **No "clear all" action** | Medium | Must click each filter button individually to reset |
| **Search has a visible label** | Low | `label="Search Tenants"` takes vertical space — should use placeholder-only with icon |
| **No saved views** | Low | Can't persist filter combinations for quick access |
| **Pagination lacks page-size selector** | Medium | Fixed at 10 items — no 25/50/100 option |
| **No "showing X–Y of Z" text** | Low | Pagination component alone doesn't communicate range |

### 2.3 Card Design (TenantRow)

| Gap | Severity | Description |
|---|---|---|
| **No visual identity** | High | Generic building SVG icon — no tenant logo, no banner, no color accent |
| **6 action buttons per card** | High | View Inventory, Rename, Edit Profile, View Storefront, Status, Delete — all same visual weight, no hierarchy, cluttered |
| **Name is a Badge, not a heading** | Medium | Tenant name rendered inside a Mantine `Badge` — poor typography hierarchy |
| **No hover state beyond shadow** | Low | `:hover` transform defined in style but Mantine doesn't apply it reliably |
| **No card-level click** | Medium | Clicking the card body does nothing — must click the name badge or a button |
| **Stats are plain text** | Low | "X products" and "Y users" as dimmed text — no icons, no visual treatment |
| **No status indicator dot** | Low | Status shown as text badge — no color dot for at-a-glance scanning |
| **Inline editing is jarring** | Low | Rename mode replaces entire card content with a text input — no inline edit pattern |

### 2.4 Visual Design & Styling

| Gap | Severity | Description |
|---|---|---|
| **Mantine/Tailwind inconsistency** | High | Page mixes Mantine components with Tailwind classes and inline SVGs — no unified design language |
| **No dark mode support** | High | Mantine components lack `dark:` variants — directory redesign uses full dark mode |
| **Inline SVGs instead of icon library** | Medium | Stats use raw `<svg>` paths — should use `lucide-react` or `@tabler/icons-react` consistently |
| **No gradient/visual interest** | Medium | Page is flat white cards on white background — no hero section, no visual anchor |
| **Emoji in filter buttons** | Low | "✅ Active", "🧪 Trial", "⏸️ Inactive" — inconsistent with icon-based design system |
| **No skeleton matching card shape** | Low | Loading skeletons don't match actual card layout — jarring transition |

### 2.5 Responsive & Mobile

| Gap | Severity | Description |
|---|---|---|
| **No mobile filter drawer** | High | Filters are always visible inline — no drawer/sheet for mobile |
| **Grid is hardcoded 2-col** | Medium | `gridTemplateColumns: "repeat(2, 1fr)"` — no responsive breakpoints, no 1-col on mobile |
| **Action buttons overflow on mobile** | High | 6 buttons in a `Group` with `wrap` default — wraps unpredictably on small screens |
| **Stats grid collapses but stays 4-col** | Low | Uses `span={{ base: 12, md: 3 }}` — stacks vertically on mobile but takes excessive scroll space |

### 2.6 Interaction & UX Patterns

| Gap | Severity | Description |
|---|---|---|
| **No bulk selection** | Medium | Can't select multiple tenants for batch status change or deletion |
| **No keyboard navigation** | Low | No arrow-key navigation, no shortcut for search focus |
| **No context menu** | Low | No right-click or "..." menu for secondary actions |
| **Delete uses `confirm()`** | Medium | Native browser `confirm()` dialog — inconsistent with custom modal pattern |
| **No toast for rename/delete** | Low | Rename and delete have no success notification (only create does) |
| **No optimistic updates** | Low | Rename updates state but doesn't show loading state on the button |
| **Refresh button is in header** | Low | Could be a floating action or pull-to-refresh on mobile |

### 2.7 Alignment with Directory Redesign

The directory page already has a modern redesign in `apps/web/src/components/directory/redesign/` with:

- **Layout variants** (`types.ts`): `discovery` / `editorial` / `immersive` with metadata
- **Shared data hook** (`useDirectoryData.ts`): Single hook encapsulating all data logic
- **Modern card component** (`StoreCardV2.tsx`): Banner/logo header, category chips, rating, distance, hover effects, appearance variants
- **Hero section** (`DirectoryHero.tsx`): Gradient band with search and stat chips
- **Filter rail** (`DirectoryFilterRail.tsx`): Sticky sidebar on desktop, Mantine Drawer on mobile, active filter count, clear all
- **Results component** (`StoreResults.tsx`): Grid/list/map views, skeleton loading, empty state with CTA

**The tenants page has none of these patterns.** This redesign should bring it to parity.

---

## 3. Design Spec

### 3.1 Architecture: Decompose into Modular Components

```
apps/web/src/components/tenants/
├── TenantsClient.tsx          (orchestrator — ~150 lines)
├── useTenantsData.ts          (shared data hook — extract all state/logic)
├── types.ts                   (layout keys, metadata, shared types)
├── TenantsHero.tsx            (gradient header with stats + search)
├── TenantsFilterRail.tsx      (sticky sidebar filters, mobile drawer)
├── TenantCardV2.tsx           (modern card with logo, status dot, actions menu)
├── TenantListRow.tsx          (compact list-row variant)
├── TenantsResults.tsx         (grid/list renderer with skeletons + empty state)
├── TenantsToolbar.tsx         (view toggle, sort dropdown, result count, page-size)
├── TenantsPagination.tsx      (pagination + "showing X–Y of Z" + page-size selector)
├── TenantActionsMenu.tsx      (dropdown menu for per-tenant actions)
├── CreateTenantModal.tsx      (existing — keep, minor style updates)
└── SlugPatternSelector.tsx    (existing — keep as-is)
```

### 3.2 Types & Layout Variants (`types.ts`)

Mirror the directory redesign pattern. Define three layout variants:

```typescript
export type TenantsLayoutKey = 'gallery' | 'table' | 'split';

export interface TenantsLayoutMeta {
  label: string;
  description: string;
  icon: string; // emoji for selector UI
}

export const TENANTS_LAYOUT_META: Record<TenantsLayoutKey, TenantsLayoutMeta> = {
  gallery: {
    label: 'Gallery',
    description: 'Card grid with logos, status dots, and hover actions. Best for visual browsing.',
    icon: '🖼️',
  },
  table: {
    label: 'Table',
    description: 'Dense sortable rows with inline actions. Best for managing many locations.',
    icon: '📋',
  },
  split: {
    label: 'Split',
    description: 'Master-detail view with list on left and preview panel on right. Best for quick inspection.',
    icon: '↔️',
  },
};

export type TenantsViewMode = 'grid' | 'list';

// Active subscription tiers from subscription_tiers_list (is_active = true, excluding trial)
export type SubscriptionTierKey =
  | 'discovery'
  | 'storefront'
  | 'commitment'
  | 'ecommerce'
  | 'omnichannel'
  | 'professional'
  | 'chain_starter'
  | 'chain_professional'
  | 'organization'
  | 'enterprise';

export interface TenantItem {
  id: string;
  name: string;
  createdAt?: string;
  status?: string;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  tenantLogo?: string;
  locationStatus?: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  organization?: { id: string; name: string } | null;
  _count?: { items?: number; users?: number };
}

export interface TenantsData {
  tenants: TenantItem[];
  loading: boolean;
  error: string | null;
  // Filter state
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  chainFilter: 'all' | 'chain' | 'standalone';
  setChainFilter: (f: 'all' | 'chain' | 'standalone') => void;
  statusFilter: 'all' | 'pending' | 'active' | 'inactive' | 'closed' | 'archived' | 'trial';
  setStatusFilter: (f: 'all' | 'pending' | 'active' | 'inactive' | 'closed' | 'archived' | 'trial') => void;
  sortBy: 'name' | 'createdAt' | 'items' | 'users';
  setSortBy: (s: 'name' | 'createdAt' | 'items' | 'users') => void;
  sortDir: 'asc' | 'desc';
  setSortDir: (d: 'asc' | 'desc') => void;
  // Pagination
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  // Derived
  filteredTenants: TenantItem[];
  paginatedTenants: TenantItem[];
  totalCount: number;
  filteredCount: number;
  // Actions
  refetch: () => Promise<void>;
  onCreate: (data: TenantCreationData) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

### 3.3 Shared Data Hook (`useTenantsData.ts`)

Extract ALL state and logic from `TenantsClient.tsx` into a single hook, mirroring `useDirectoryData.ts`:

**Responsibilities:**
- Tenant fetching via `platformHomeService.getTenants()`
- Client-side filtering (search, chain, status)
- Client-side sorting (name, createdAt, items, users — asc/desc)
- Client-side pagination with configurable page size (10/25/50/100)
- CRUD operations (create, rename, delete) with optimistic updates
- View mode + page size persistence via `localStorage` (key: `tenants-view-mode`, `tenants-page-size`)
- Permission checks via `useAuth()` + `canEditTenant` / `canDeleteTenant` / `canRenameTenant`

**Key improvements over current:**
- Sorting support (currently absent)
- Configurable page size (currently fixed at 10)
- Optimistic UI updates for rename/delete (currently waits for API)
- Toast notifications for all CRUD operations (currently only create)

### 3.4 TenantsHero Component

Replace the current `PageHeader` + stats grid + create-tenant card with a unified hero section.

**Design:**
- Gradient background: `bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700`
- Decorative blurred orbs (same pattern as `DirectoryHero.tsx`)
- Left side: Title "Locations" + subtitle "Manage your stores and business locations"
- Right side: Action buttons (Dashboard, Refresh, Add Location)
- Below title: 4 stat chips in a horizontal row — **clickable** to apply filters
- Search bar embedded in hero (icon + input, no label, placeholder "Search by name or ID...")
- Fully dark-mode compatible

**Stat chips (clickable):**

| Chip | Icon | Filter Action |
|---|---|---|
| Total Locations | `Building2` | No filter (reset) |
| Chain Locations | `Network` | Set `chainFilter = 'chain'` |
| Standalone | `Store` | Set `chainFilter = 'standalone'` |
| Active | `CheckCircle` | Set `statusFilter = 'active'` |

**Spec:**
```tsx
<section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 text-white">
  {/* Decorative orbs */}
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
    <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
  </div>

  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    {/* Title row */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="text-white/80 mt-1">Manage your stores and business locations</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/90 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/90 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50">
          <RefreshCw className="w-4 h-4" /> {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button onClick={() => setCreateModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-white text-indigo-700 rounded-lg hover:bg-white/90 transition-all">
          <Plus className="w-4 h-4" /> Add Location
        </button>
      </div>
    </div>

    {/* Search */}
    <div className="max-w-2xl mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
        />
      </div>
    </div>

    {/* Stat chips */}
    <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
      <StatChip icon={<Building2 className="w-4 h-4" />} value={totalCount} label="total" onClick={() => resetFilters()} />
      <StatChip icon={<Network className="w-4 h-4" />} value={chainCount} label="chain" onClick={() => setChainFilter('chain')} />
      <StatChip icon={<Store className="w-4 h-4" />} value={standaloneCount} label="standalone" onClick={() => setChainFilter('standalone')} />
      <StatChip icon={<CheckCircle className="w-4 h-4" />} value={activeCount} label="active" accent onClick={() => setStatusFilter('active')} />
    </div>
  </div>
</section>
```

### 3.5 TenantsFilterRail Component

Replace the inline filter buttons with a sticky sidebar, mirroring `DirectoryFilterRail.tsx`.

**Design:**
- Desktop: Sticky `aside` (w-64), `top-20`, max-height with overflow scroll
- Mobile: Mantine `Drawer` (position="right", size="sm")
- Trigger: Floating "Filters" button with active-count badge on mobile

**Sections:**

1. **Header**: "Filters" title + active filter count badge + "Clear all" link
2. **Location Type** (radio group):
   - All Types
   - Chain (with `Network` icon)
   - Standalone (with `Store` icon)
3. **Status** (radio group with color dots):
   - All Statuses
   - Active (green dot)
   - Trial (blue dot)
   - Pending (amber dot)
   - Inactive (orange dot)
   - Closed (red dot)
   - Archived (gray dot)
4. **Sort By** (radio group):
   - Name (A–Z)
   - Created Date (newest)
   - Product Count (most)
   - User Count (most)

**Spec:**
```tsx
{/* Desktop sticky rail */}
<aside className="hidden lg:block w-64 shrink-0">
  <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <SlidersHorizontal className="w-4 h-4" />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-600 text-white">
            {activeCount}
          </span>
        )}
      </h3>
      {activeCount > 0 && (
        <button onClick={clearAll} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">
          Clear all
        </button>
      )}
    </div>

    {/* Location Type */}
    <FilterSection title="Location Type">
      <RadioRow label="All Types" checked={chainFilter === 'all'} onChange={() => setChainFilter('all')} />
      <RadioRow label="Chain" icon={<Network className="w-3.5 h-3.5" />} checked={chainFilter === 'chain'} onChange={() => setChainFilter('chain')} />
      <RadioRow label="Standalone" icon={<Store className="w-3.5 h-3.5" />} checked={chainFilter === 'standalone'} onChange={() => setChainFilter('standalone')} />
    </FilterSection>

    {/* Status — with color dots */}
    <FilterSection title="Status">
      <RadioRow label="All Statuses" checked={statusFilter === 'all'} onChange={() => setStatusFilter('all')} />
      <RadioRow label="Active" dotColor="bg-green-500" checked={statusFilter === 'active'} onChange={() => setStatusFilter('active')} />
      <RadioRow label="Trial" dotColor="bg-blue-500" checked={statusFilter === 'trial'} onChange={() => setStatusFilter('trial')} />
      <RadioRow label="Pending" dotColor="bg-amber-500" checked={statusFilter === 'pending'} onChange={() => setStatusFilter('pending')} />
      <RadioRow label="Inactive" dotColor="bg-orange-500" checked={statusFilter === 'inactive'} onChange={() => setStatusFilter('inactive')} />
      <RadioRow label="Closed" dotColor="bg-red-500" checked={statusFilter === 'closed'} onChange={() => setStatusFilter('closed')} />
      <RadioRow label="Archived" dotColor="bg-neutral-400" checked={statusFilter === 'archived'} onChange={() => setStatusFilter('archived')} />
    </FilterSection>

    {/* Sort */}
    <FilterSection title="Sort By">
      <RadioRow label="Name (A–Z)" checked={sortBy === 'name'} onChange={() => setSortBy('name')} />
      <RadioRow label="Created (newest)" checked={sortBy === 'createdAt'} onChange={() => setSortBy('createdAt')} />
      <RadioRow label="Products (most)" checked={sortBy === 'items'} onChange={() => setSortBy('items')} />
      <RadioRow label="Users (most)" checked={sortBy === 'users'} onChange={() => setSortBy('users')} />
    </FilterSection>
  </div>
</aside>

{/* Mobile drawer */}
<Drawer opened={mobileOpen} onClose={onMobileClose} title="Filters" position="right" size="sm"
  classNames={{ content: 'bg-white dark:bg-neutral-900' }}>
  {/* Same rail content */}
</Drawer>
```

### 3.6 TenantCardV2 Component (Gallery View)

Replace the current `TenantRow` with a modern card inspired by `StoreCardV2.tsx`.

**Design:**
- Tailwind-only styling (no Mantine Card)
- Rounded-2xl, border, shadow-sm → hover:shadow-lg + `-translate-y-0.5` transition
- **Header zone** (h-24):
  - Tenant logo or banner image if available, otherwise gradient placeholder based on tenant name hash
  - Organization badge (top-left, if chain) — small pill with `Network` icon
  - Status dot (top-right) — colored circle indicating location status
- **Body zone** (p-4):
  - Tenant name as `<h3>` heading (not a Badge) — `text-base font-semibold`
  - Tier badge — small pill, tier-specific color (see §3.13)
  - Stats row: `Package` icon + product count, `Users` icon + user count
  - Created date: `Calendar` icon + relative date ("3 days ago")
- **Actions** (bottom border-top, p-3):
  - Primary action: "View Inventory" (filled blue button, flex-1)
  - Secondary actions: "..." icon button opening `TenantActionsMenu` dropdown

**Appearance variants:**
- `gallery` (default): Full card with header image zone
- `compact`: Reduced padding, smaller header, inline actions — for split-view list

**Spec:**
```tsx
<div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
  {/* Header zone */}
  <div className="relative h-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-800 dark:to-neutral-700 overflow-hidden">
    {tenantLogo ? (
      <img src={tenantLogo} alt={tenant.name} className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <Building2 className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />
      </div>
    )}
    {/* Org badge */}
    {tenant.organization && (
      <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 dark:bg-neutral-900/90 text-cyan-700 dark:text-cyan-300 backdrop-blur-sm">
        <Network className="w-3 h-3" />
        {tenant.organization.name}
      </span>
    )}
    {/* Status dot */}
    <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${statusDotColor} ring-2 ring-white dark:ring-neutral-900`} />
  </div>

  {/* Body */}
  <div className="p-4 space-y-2">
    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate">
      {tenant.name}
    </h3>

    {/* Tier badge */}
    {tenant.subscriptionTier && (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tierBadgeClasses[tenant.subscriptionTier] ?? tierBadgeClasses.default}`}>
        {formatTier(tenant.subscriptionTier)}
      </span>
    )}

    {/* Stats */}
    <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
      <span className="flex items-center gap-1">
        <Package className="w-3.5 h-3.5" />
        {tenant._count?.items ?? 0} products
      </span>
      <span className="flex items-center gap-1">
        <Users className="w-3.5 h-3.5" />
        {tenant._count?.users ?? 0} users
      </span>
    </div>

    {/* Created date */}
    {tenant.createdAt && (
      <span className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
        <Calendar className="w-3 h-3" />
        {formatRelativeDate(tenant.createdAt)}
      </span>
    )}
  </div>

  {/* Actions */}
  <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
    <button
      onClick={() => onSelect()}
      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <Package className="w-4 h-4" />
      View Inventory
    </button>
    <TenantActionsMenu tenant={tenant} canEdit={canEdit} canDelete={canDelete} canRename={canRename} />
  </div>
</div>
```

### 3.7 TenantActionsMenu Component

Replace the 6-button horizontal row with a dropdown menu triggered by a "..." icon button.

**Menu items:**
- `Edit Profile` → navigate to `/t/{id}/onboarding` (icon: `Pencil`)
- `View Storefront` → open `/tenant/{id}` in new tab (icon: `ExternalLink`)
- `Change Status` → open status modal (icon: `ToggleLeft`)
- `Rename` → enter inline rename mode (icon: `Edit3`)
- `Delete` → open delete confirmation modal (icon: `Trash2`, red text)

**Implementation:**
- Use Mantine `Menu` component (already available in the project's Mantine version) or a custom Tailwind dropdown
- Trigger: `<button className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">`
- Icon: `MoreHorizontal` from lucide-react
- Position: bottom-end, within portal
- Permission-gated: items hidden when `canEdit`/`canDelete`/`canRename` is false

**Spec:**
```tsx
<Menu position="bottom-end" withinPortal>
  <Menu.Target>
    <button className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
      <MoreHorizontal className="w-4 h-4" />
    </button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item leftSection={<Pencil className="w-4 h-4" />} onClick={() => onEditProfile()}>
      Edit Profile
    </Menu.Item>
    <Menu.Item leftSection={<ExternalLink className="w-4 h-4" />} onClick={() => onViewStorefront()}>
      View Storefront
    </Menu.Item>
    <Menu.Item leftSection={<ToggleLeft className="w-4 h-4" />} onClick={() => onStatusChange(tenant)}>
      Change Status
    </Menu.Item>
    {canRename && (
      <Menu.Item leftSection={<Edit3 className="w-4 h-4" />} onClick={() => onRename()}>
        Rename
      </Menu.Item>
    )}
    {canDelete && (
      <Menu.Divider />
      <Menu.Item color="red" leftSection={<Trash2 className="w-4 h-4" />} onClick={() => onDelete()}>
        Delete
      </Menu.Item>
    )}
  </Menu.Dropdown>
</Menu>
```

### 3.8 TenantListRow Component (Table/List View)

Compact horizontal row for the "table" layout variant.

**Design:**
- Full-width flex row, border-bottom
- Left: Checkbox (for bulk selection — future), logo thumbnail (w-10 h-10 rounded-lg), name + org badge
- Center: Tier badge, status dot + label
- Right: Product count, user count, created date
- Far right: "..." actions menu (same `TenantActionsMenu`)
- Hover: `bg-neutral-50 dark:bg-neutral-800/50`
- Click row: navigate to tenant dashboard

**Spec:**
```tsx
<div
  className="flex items-center gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
  onClick={() => onSelect()}
>
  {/* Logo */}
  <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
    {tenantLogo ? <img src={tenantLogo} className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-neutral-300" />}
  </div>

  {/* Name + org */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{tenant.name}</span>
      {tenant.organization && (
        <span className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400">
          <Network className="w-3 h-3" /> {tenant.organization.name}
        </span>
      )}
    </div>
    <span className="text-xs text-neutral-400">{tenant.id}</span>
  </div>

  {/* Tier */}
  {tenant.subscriptionTier && (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierBadgeClasses[tenant.subscriptionTier] ?? tierBadgeClasses.default}`}>
      {formatTier(tenant.subscriptionTier)}
    </span>
  )}

  {/* Status */}
  <div className="flex items-center gap-1.5 w-24">
    <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
    <span className="text-xs text-neutral-600 dark:text-neutral-400 capitalize">{tenant.locationStatus || 'active'}</span>
  </div>

  {/* Stats */}
  <div className="hidden sm:flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 w-32">
    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {tenant._count?.items ?? 0}</span>
    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {tenant._count?.users ?? 0}</span>
  </div>

  {/* Actions */}
  <TenantActionsMenu tenant={tenant} ... />
</div>
```

### 3.9 TenantsToolbar Component

A compact toolbar between the filter rail and the results.

**Contents:**
- Left: Result count text — "Showing 1–10 of 42 locations"
- Right: View mode toggle (Gallery / Table) + page-size selector

**Spec:**
```tsx
<div className="flex items-center justify-between mb-4">
  <p className="text-sm text-neutral-500 dark:text-neutral-400">
    Showing <span className="font-medium text-neutral-900 dark:text-neutral-100">{startIdx + 1}–{endIdx}</span> of{' '}
    <span className="font-medium text-neutral-900 dark:text-neutral-100">{filteredCount}</span> locations
  </p>
  <div className="flex items-center gap-3">
    {/* Page size */}
    <select
      value={pageSize}
      onChange={(e) => setPageSize(Number(e.target.value))}
      className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
    >
      <option value={10}>10 / page</option>
      <option value={25}>25 / page</option>
      <option value={50}>50 / page</option>
      <option value={100}>100 / page</option>
    </select>

    {/* View toggle */}
    <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <button
        onClick={() => setViewMode('grid')}
        className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
        aria-label="Gallery view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
        aria-label="Table view"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

### 3.10 TenantsResults Component

Mirrors `StoreResults.tsx`. Renders grid or list based on view mode.

**Grid (Gallery) view:**
- `grid gap-5 sm:grid-cols-2 xl:grid-cols-3` (3-up desktop, 2-up tablet, 1-up mobile)
- Uses `TenantCardV2` for each item
- Framer Motion stagger entrance (keep existing animation pattern):
  ```tsx
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, duration: 0.3 }}
  >
  ```

**List (Table) view:**
- Single column, full width
- Uses `TenantListRow` for each item
- Container: `rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-200 dark:divide-neutral-800`
- Optional header row with sortable column labels: Name, Tier, Status, Products, Users, Created

**Loading state:**
- Grid: 6–9 skeleton cards matching `TenantCardV2` shape (header zone + body lines)
- List: 8 skeleton rows matching `TenantListRow` shape
- Use `animate-pulse` Tailwind class, not Mantine `Skeleton`

**Skeleton card (grid):**
```tsx
<div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-pulse">
  <div className="h-24 bg-neutral-200 dark:bg-neutral-800" />
  <div className="p-4 space-y-3">
    <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
    <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-full w-20" />
    <div className="flex gap-3">
      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-24" />
      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
    </div>
  </div>
  <div className="h-12 bg-neutral-100 dark:bg-neutral-800/50" />
</div>
```

**Empty state:**
- Centered `PackageSearch` icon (w-16 h-16, neutral-300)
- Heading: "No locations found"
- Subtext: context-aware:
  - Search active → "Try a different search term"
  - Filter active → "Try adjusting your filters"
  - No tenants at all → "Get started by creating your first location"
- CTA button: "Add Location" (opens create modal) or "Clear filters" (if filters active)

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <PackageSearch className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mb-4" />
  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">No locations found</h3>
  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{emptyMessage}</p>
  <button
    onClick={hasActiveFilters ? clearFilters : () => setCreateModalOpen(true)}
    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
  >
    {hasActiveFilters ? <><X className="w-4 h-4" /> Clear filters</> : <><Plus className="w-4 h-4" /> Add Location</>}
  </button>
</div>
```

### 3.11 TenantsPagination Component

Enhanced pagination with range text and page-size selector.

**Design:**
- Mantine `Pagination` component (keep existing) but styled with Tailwind wrapper
- Left: "Showing 1–10 of 42" text
- Center: Pagination controls
- Right: Page size dropdown (10/25/50/100)
- Mobile: Stack vertically — range text on top, pagination below

```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
  <p className="text-sm text-neutral-500 dark:text-neutral-400 order-2 sm:order-1">
    Showing <span className="font-medium text-neutral-900 dark:text-neutral-100">{startIdx + 1}–{Math.min(endIdx, filteredCount)}</span> of{' '}
    <span className="font-medium text-neutral-900 dark:text-neutral-100">{filteredCount}</span> locations
  </p>
  <Pagination
    value={currentPage}
    onChange={setCurrentPage}
    total={totalPages}
    color="blue"
    className="order-1 sm:order-2"
  />
  <select
    value={pageSize}
    onChange={(e) => setPageSize(Number(e.target.value))}
    className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 order-3"
  >
    <option value={10}>10 / page</option>
    <option value={25}>25 / page</option>
    <option value={50}>50 / page</option>
    <option value={100}>100 / page</option>
  </select>
</div>
```

### 3.12 Overall Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ TenantsHero (gradient, full-width)                          │
│  Title + actions + search + stat chips                      │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────────────────────────────────────┐  │
│ │ Filter   │ │ TenantsToolbar                           │  │
│ │ Rail     │ │  "Showing 1–10 of 42"  [10/page] [▦☰]   │  │
│ │ (sticky) │ ├──────────────────────────────────────────┤  │
│ │          │ │ TenantsResults                           │  │
│ │ Type     │ │  ┌────┐ ┌────┐ ┌────┐                   │  │
│ │ ○ All    │ │  │Card│ │Card│ │Card│                   │  │
│ │ ○ Chain  │ │  └────┘ └────┘ └────┘                   │  │
│ │ ○ Stand. │ │  ┌────┐ ┌────┐ ┌────┐                   │  │
│ │          │ │  │Card│ │Card│ │Card│                   │  │
│ │ Status   │ │  └────┘ └────┘ └────┘                   │  │
│ │ ○ Active │ │                                          │  │
│ │ ○ Trial  │ │ TenantsPagination                        │  │
│ │ ○ Pend.  │ │  « 1 2 3 4 5 »  Showing 1–10 of 42     │  │
│ │ ○ Inact. │ │                                          │  │
│ │ ○ Closed │ └──────────────────────────────────────────┘  │
│ │ ○ Arch.  │                                            │
│ │          │                                            │
│ │ Sort By  │                                            │
│ │ ○ Name   │                                            │
│ │ ○ Date   │                                            │
│ │ ○ Items  │                                            │
│ │ ○ Users  │                                            │
│ └──────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**
- `lg+` (≥1024px): Filter rail visible as sticky sidebar, 3-col grid
- `md` (768–1023px): Filter rail hidden, mobile drawer trigger shown, 2-col grid
- `sm` (<768px): Full stack, 1-col grid, filters in drawer, stat chips wrap

**Mobile filter trigger (visible < lg):**
```tsx
<button
  onClick={() => setMobileFilterOpen(true)}
  className="lg:hidden inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
>
  <SlidersHorizontal className="w-4 h-4" />
  Filters
  {activeCount > 0 && <span className="badge">{activeCount}</span>}
</button>
```

### 3.13 Color System

#### Status Dot Colors

| Status | Dot Color | Tailwind Class |
|---|---|---|
| Active | Green | `bg-green-500` |
| Trial | Blue | `bg-blue-500` |
| Pending | Amber | `bg-amber-500` |
| Inactive | Orange | `bg-orange-500` |
| Closed | Red | `bg-red-500` |
| Archived | Neutral | `bg-neutral-400` |

#### Tier Badge Colors

All 10 active tiers from `subscription_tiers_list` (excluding trial), ordered by `sort_order`:

| Tier Key | Display Name | Sort Order | Type | Badge Background | Badge Text |
|---|---|---|---|---|---|
| `discovery` | Discovery | 1 | individual | `bg-sky-50 dark:bg-sky-900/20` | `text-sky-700 dark:text-sky-300` |
| `storefront` | Storefront | 2 | individual | `bg-teal-50 dark:bg-teal-900/20` | `text-teal-700 dark:text-teal-300` |
| `commitment` | Commitment | 3 | individual | `bg-emerald-50 dark:bg-emerald-900/20` | `text-emerald-700 dark:text-emerald-300` |
| `ecommerce` | E-commerce | 4 | individual | `bg-cyan-50 dark:bg-cyan-900/20` | `text-cyan-700 dark:text-cyan-300` |
| `omnichannel` | Omnichannel | 5 | individual | `bg-blue-50 dark:bg-blue-900/20` | `text-blue-700 dark:text-blue-300` |
| `professional` | Professional | 6 | individual | `bg-violet-50 dark:bg-violet-900/20` | `text-violet-700 dark:text-violet-300` |
| `chain_starter` | Chain Starter | 7 | organization | `bg-amber-50 dark:bg-amber-900/20` | `text-amber-700 dark:text-amber-300` |
| `chain_professional` | Chain Professional | 8 | organization | `bg-orange-50 dark:bg-orange-900/20` | `text-orange-700 dark:text-orange-300` |
| `organization` | Organization | 9 | organization | `bg-indigo-50 dark:bg-indigo-900/20` | `text-indigo-700 dark:text-indigo-300` |
| `enterprise` | Enterprise | 10 | individual | `bg-purple-50 dark:bg-purple-900/20` | `text-purple-700 dark:text-purple-300` |
| `default` (fallback) | — | — | — | `bg-neutral-100 dark:bg-neutral-800` | `text-neutral-600 dark:text-neutral-400` |

**Implementation as a lookup map:**
```typescript
export const TIER_BADGE_CLASSES: Record<string, string> = {
  discovery:          'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300',
  storefront:         'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
  commitment:         'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  ecommerce:          'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300',
  omnichannel:        'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  professional:       'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
  chain_starter:      'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  chain_professional: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  organization:       'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  enterprise:         'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  default:            'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
};

export function getTierBadgeClass(tierKey?: string): string {
  if (!tierKey) return TIER_BADGE_CLASSES.default;
  return TIER_BADGE_CLASSES[tierKey] ?? TIER_BADGE_CLASSES.default;
}

export function formatTierDisplay(tierKey?: string): string {
  if (!tierKey) return '';
  // Map tier_key to display_name — use the display_name from subscription_tiers_list
  const displayNames: Record<string, string> = {
    discovery: 'Discovery',
    storefront: 'Storefront',
    commitment: 'Commitment',
    ecommerce: 'E-commerce',
    omnichannel: 'Omnichannel',
    professional: 'Professional',
    chain_starter: 'Chain Starter',
    chain_professional: 'Chain Professional',
    organization: 'Organization',
    enterprise: 'Enterprise',
  };
  return displayNames[tierKey] ?? tierKey.charAt(0).toUpperCase() + tierKey.slice(1);
}
```

#### Status Dot Color Map

```typescript
export const STATUS_DOT_CLASSES: Record<string, string> = {
  active:   'bg-green-500',
  trial:    'bg-blue-500',
  pending:  'bg-amber-500',
  inactive: 'bg-orange-500',
  closed:   'bg-red-500',
  archived: 'bg-neutral-400',
  default:  'bg-neutral-400',
};

export function getStatusDotClass(status?: string): string {
  if (!status) return STATUS_DOT_CLASSES.active; // default to active
  return STATUS_DOT_CLASSES[status] ?? STATUS_DOT_CLASSES.default;
}
```

### 3.14 Dark Mode

All components must support dark mode using Tailwind `dark:` variants. Key mappings:

| Element | Light | Dark |
|---|---|---|
| Page background | `bg-neutral-50` | `dark:bg-neutral-950` |
| Card background | `bg-white` | `dark:bg-neutral-900` |
| Card border | `border-neutral-200` | `dark:border-neutral-800` |
| Primary text | `text-neutral-900` | `dark:text-neutral-100` |
| Secondary text | `text-neutral-500` | `dark:text-neutral-400` |
| Tertiary text | `text-neutral-400` | `dark:text-neutral-500` |
| Hover background | `hover:bg-neutral-50` | `dark:hover:bg-neutral-800/50` |
| Input background | `bg-white` | `dark:bg-neutral-900` |
| Input border | `border-neutral-200` | `dark:border-neutral-700` |
| Divider | `border-neutral-100` | `dark:border-neutral-800` |
| Hero gradient | `from-indigo-600 via-purple-600 to-blue-700` | same (gradient works for both) |
| Hero search input | `bg-white/10` | same (translucent works for both) |

### 3.15 Icon Standardization

Replace all inline SVGs and emoji with `lucide-react` icons for consistency with the directory redesign:

| Current | Replacement | Usage |
|---|---|---|
| Inline building SVG | `Building2` | Tenant icon, empty state |
| Inline filter SVG | `SlidersHorizontal` | Filter rail header |
| Inline chain SVG | `Network` | Chain badge, chain filter |
| Inline standalone SVG | `Store` | Standalone filter |
| Inline funnel SVG | `Filter` | Mobile filter trigger |
| `IconBuilding` (tabler) | `Building2` (lucide) | Consistent icon set |
| `IconPlus` (tabler) | `Plus` (lucide) | Add location |
| `IconRefresh` (tabler) | `RefreshCw` (lucide) | Refresh button |
| `IconArrowLeft` (tabler) | `ArrowLeft` (lucide) | Back to dashboard |
| `IconPackages` (tabler) | `Package` (lucide) | Products count, inventory |
| `IconEdit` (tabler) | `Pencil` (lucide) | Edit/rename |
| `IconUser` (tabler) | `User` (lucide) | Edit profile |
| `IconEye` (tabler) | `ExternalLink` (lucide) | View storefront |
| `IconStatusChange` (tabler) | `ToggleLeft` (lucide) | Status change |
| `IconTrash` (tabler) | `Trash2` (lucide) | Delete |
| `IconCheck` (tabler) | `Check` (lucide) | Success toast |
| `IconLayoutGrid` (tabler) | `LayoutGrid` (lucide) | Grid view toggle |
| `IconList` (tabler) | `List` (lucide) | List view toggle |
| `IconUsers` (tabler) | `Users` (lucide) | User count |
| `MoreHorizontal` (lucide) | `MoreHorizontal` (lucide) | Actions menu trigger |
| `Calendar` (lucide) | `Calendar` (lucide) | Created date |
| `Search` (lucide) | `Search` (lucide) | Search input icon |
| `CheckCircle` (lucide) | `CheckCircle` (lucide) | Active stat chip |
| `PackageSearch` (lucide) | `PackageSearch` (lucide) | Empty state |
| `X` (lucide) | `X` (lucide) | Clear filters button |
| Emoji ✅🧪⏸️🚧🔒📦 | Color dots | Status indicators |

**All imports from `lucide-react`:**
```typescript
import {
  Building2, SlidersHorizontal, Network, Store, Plus, RefreshCw,
  ArrowLeft, Package, Pencil, User, ExternalLink, ToggleLeft,
  Trash2, Check, LayoutGrid, List, Users, MoreHorizontal,
  Calendar, Search, CheckCircle, PackageSearch, X, Edit3,
} from 'lucide-react';
```

### 3.16 Existing Components — Preserve or Transform

| Component | Action | Notes |
|---|---|---|
| `PageHeader` | **Replace** with `TenantsHero` | PageHeader is generic; tenants page needs a richer hero with search and clickable stats |
| `ContextBadges` | **Preserve** | Keep as-is, render below hero or in toolbar area |
| `SubscriptionStatusGuide` | **Preserve** | Keep conditional rendering for specific tenant view |
| `CreateTenantModal` | **Preserve** | Keep existing modal, minor style polish only |
| `SlugPatternSelector` | **Preserve** | Keep as-is |
| `ChangeLocationStatusModal` | **Preserve** | Keep as-is |
| `TenantRow` (inline) | **Transform** → `TenantCardV2` + `TenantListRow` + `TenantActionsMenu` | Decompose into three purpose-built components |
| `Pagination` (Mantine) | **Enhance** → `TenantsPagination` | Wrap with range text and page-size selector |
| `Skeleton` (Mantine) | **Transform** → Tailwind skeleton cards | Match new card/row shapes, use `animate-pulse` |
| `motion.div` (Framer) | **Preserve** | Keep entrance animations, apply to new card components |

### 3.17 Delete Confirmation Modal

Replace the native `confirm()` dialog with a styled Mantine `Modal`:

```tsx
<Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Location" size="sm"
  classNames={{ content: 'bg-white dark:bg-neutral-900' }}>
  <div className="space-y-4">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Delete "{tenantToDelete?.name}"?
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          This action cannot be undone. All associated data will be permanently removed.
        </p>
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-2">
      <button onClick={() => setDeleteModalOpen(false)}
        className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
        Cancel
      </button>
      <button onClick={confirmDelete} disabled={deleting}
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  </div>
</Modal>
```

### 3.18 Toast Notifications

Add `notifications.show()` for all CRUD operations (currently only create has it):

| Action | Title | Message | Color | Icon |
|---|---|---|---|---|
| Create | Location Created! | "{name}" has been added successfully. | green | `Check` |
| Rename | Location Renamed | "{oldName}" has been renamed to "{newName}". | blue | `Check` |
| Delete | Location Deleted | "{name}" has been permanently removed. | red | `Trash2` |
| Error (any) | Action Failed | Descriptive error message | red | `AlertCircle` |

### 3.19 TenantsClient Orchestrator (~150 lines)

The new `TenantsClient.tsx` should be a thin orchestrator:

```tsx
"use client";

import { useState } from "react";
import { useTenantsData } from "./useTenantsData";
import TenantsHero from "./TenantsHero";
import TenantsFilterRail from "./TenantsFilterRail";
import TenantsToolbar from "./TenantsToolbar";
import TenantsResults from "./TenantsResults";
import TenantsPagination from "./TenantsPagination";
import { ContextBadges } from "@/components/ContextBadges";
import { SubscriptionStatusGuide } from "@/components/subscription/SubscriptionStatusGuide";
import CreateTenantModal from "./CreateTenantModal";
import ChangeLocationStatusModal from "@/components/tenant/ChangeLocationStatusModal";

export default function TenantsClient({ initialTenants = [] }: { initialTenants?: any[] }) {
  const data = useTenantsData({ initialTenants });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [statusModalTenant, setStatusModalTenant] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <TenantsHero
        data={data}
        onAddLocation={() => setCreateModalOpen(true)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ContextBadges showPlatformRole contextLabel="Tenants" />

        {data.specificTenantId && (
          <SubscriptionStatusGuide tenantId={data.specificTenantId} />
        )}

        <div className="flex gap-6 mt-4">
          <TenantsFilterRail
            data={data}
            mobileOpen={mobileFilterOpen}
            onMobileClose={() => setMobileFilterOpen(false)}
          />

          <div className="flex-1 min-w-0">
            {/* Mobile filter trigger */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>

            <TenantsToolbar data={data} />

            {data.error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {data.error}
              </div>
            )}

            <TenantsResults
              data={data}
              onStatusChange={(tenant) => setStatusModalTenant(tenant)}
            />

            <TenantsPagination data={data} />
          </div>
        </div>
      </div>

      <CreateTenantModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={data.onCreate}
      />

      {statusModalTenant && (
        <ChangeLocationStatusModal
          tenant={statusModalTenant}
          onClose={() => setStatusModalTenant(null)}
          onStatusChanged={() => {
            setStatusModalTenant(null);
            data.refetch();
          }}
        />
      )}
    </div>
  );
}
```

---

## 4. Implementation Order

Agents should implement in this sequence to maintain a working build at each step:

| Step | Component | Depends On | Est. Lines |
|---|---|---|---|
| 1 | `types.ts` | — | ~80 |
| 2 | `useTenantsData.ts` | `types.ts` | ~200 |
| 3 | `TenantActionsMenu.tsx` | `types.ts` | ~80 |
| 4 | `TenantCardV2.tsx` | `types.ts`, `TenantActionsMenu` | ~120 |
| 5 | `TenantListRow.tsx` | `types.ts`, `TenantActionsMenu` | ~100 |
| 6 | `TenantsResults.tsx` | `TenantCardV2`, `TenantListRow` | ~130 |
| 7 | `TenantsFilterRail.tsx` | `types.ts` | ~180 |
| 8 | `TenantsToolbar.tsx` | `types.ts` | ~60 |
| 9 | `TenantsPagination.tsx` | `types.ts` | ~50 |
| 10 | `TenantsHero.tsx` | `types.ts` | ~100 |
| 11 | `TenantsClient.tsx` (rewrite) | All above | ~150 |
| 12 | Delete confirmation modal | — | inline in `TenantsClient` |

**Total new code:** ~1,250 lines across 11 files (replacing 1,001-line monolith)
**Net change:** +250 lines but with proper separation of concerns, dark mode, sorting, responsive filters, and modern card design.

---

## 5. Constraints & Guardrails

1. **No backend changes** — all data flows through existing `platformHomeService` methods
2. **No new dependencies** — use existing `lucide-react`, `@mantine/core`, `framer-motion`, `tailwindcss`
3. **Preserve all existing functionality** — create, rename, delete, status change, onboarding flow, specific tenant view, access control checks
4. **Maintain localStorage keys** — `tenants_view_mode` (existing), add `tenants_page_size`
5. **SSR-safe** — view mode and page size must default to fixed values on server, read from localStorage only after hydration (same pattern as current code)
6. **No Mantine theme overrides** — use Tailwind classes for styling, Mantine only for `Drawer`, `Menu`, `Modal`, `Pagination` structural components
7. **Keep `CreateTenantModal` and `ChangeLocationStatusModal` as-is** — only the orchestrator wiring changes
