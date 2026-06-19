import type { TenantCreationData } from './CreateTenantModal';

// ─── Layout Variants ───────────────────────────────────────────────

export type TenantsLayoutKey = 'gallery' | 'table' | 'split';

export interface TenantsLayoutMeta {
  label: string;
  description: string;
  icon: string;
}

export const TENANTS_LAYOUT_META: Record<TenantsLayoutKey, TenantsLayoutMeta> = {
  gallery: {
    label: 'Gallery',
    description:
      'Card grid with logos, status dots, and hover actions. Best for visual browsing.',
    icon: '🖼️',
  },
  table: {
    label: 'Table',
    description:
      'Dense sortable rows with inline actions. Best for managing many locations.',
    icon: '📋',
  },
  split: {
    label: 'Split',
    description:
      'Master-detail view with list on left and preview panel on right. Best for quick inspection.',
    icon: '↔️',
  },
};

// ─── View Modes ────────────────────────────────────────────────────

export type TenantsViewMode = 'grid' | 'list';

// ─── Tenant Item ───────────────────────────────────────────────────

export type LocationStatus =
  | 'pending'
  | 'active'
  | 'inactive'
  | 'closed'
  | 'archived';

export type StatusFilterValue =
  | 'all'
  | 'pending'
  | 'active'
  | 'inactive'
  | 'closed'
  | 'archived'
  | 'trial';

export type ChainFilterValue = 'all' | 'chain' | 'standalone';

export type SortByValue = 'name' | 'createdAt' | 'items' | 'users';
export type SortDirValue = 'asc' | 'desc';

export interface TenantItem {
  id: string;
  name: string;
  createdAt?: string;
  status?: string;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  tenantLogo?: string;
  locationStatus?: LocationStatus;
  organization?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    items?: number;
    users?: number;
  };
}

// ─── Tier Badge Colors (active tiers from subscription_tiers_list) ──

export const TIER_BADGE_CLASSES: Record<string, string> = {
  discovery: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300',
  storefront: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
  commitment:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  ecommerce: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300',
  omnichannel:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  professional:
    'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
  chain_starter:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  chain_professional:
    'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  organization:
    'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  enterprise:
    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  default:
    'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
};

const TIER_DISPLAY_NAMES: Record<string, string> = {
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

export function getTierBadgeClass(tierKey?: string): string {
  if (!tierKey) return TIER_BADGE_CLASSES.default;
  return TIER_BADGE_CLASSES[tierKey] ?? TIER_BADGE_CLASSES.default;
}

export function formatTierDisplay(tierKey?: string): string {
  if (!tierKey) return '';
  return (
    TIER_DISPLAY_NAMES[tierKey] ??
    tierKey.charAt(0).toUpperCase() + tierKey.slice(1)
  );
}

// ─── Status Dot Colors ─────────────────────────────────────────────

export const STATUS_DOT_CLASSES: Record<string, string> = {
  active: 'bg-green-500',
  trial: 'bg-blue-500',
  pending: 'bg-amber-500',
  inactive: 'bg-orange-500',
  closed: 'bg-red-500',
  archived: 'bg-neutral-400',
  default: 'bg-neutral-400',
};

export function getStatusDotClass(status?: string): string {
  if (!status) return STATUS_DOT_CLASSES.active;
  return STATUS_DOT_CLASSES[status] ?? STATUS_DOT_CLASSES.default;
}

// ─── Data Hook Interface ───────────────────────────────────────────

export interface TenantsData {
  tenants: TenantItem[];
  loading: boolean;
  error: string | null;

  // URL-derived
  specificTenantId: string | null;
  isViewingSpecificTenant: boolean;
  hasOnboardingData: boolean;
  onboardingName: string | null;
  onboardingPhone: string | null;
  onboardingBusinessType: string | null;

  // Filter state
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  chainFilter: ChainFilterValue;
  setChainFilter: (f: ChainFilterValue) => void;
  statusFilter: StatusFilterValue;
  setStatusFilter: (f: StatusFilterValue) => void;
  sortBy: SortByValue;
  setSortBy: (s: SortByValue) => void;
  sortDir: SortDirValue;
  setSortDir: (d: SortDirValue) => void;

  // Pagination
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;

  // View mode
  viewMode: TenantsViewMode;
  setViewMode: (m: TenantsViewMode) => void;

  // Derived
  filteredTenants: TenantItem[];
  paginatedTenants: TenantItem[];
  totalCount: number;
  filteredCount: number;
  chainCount: number;
  standaloneCount: number;
  activeCount: number;

  // Actions
  refetch: () => Promise<void>;
  onCreate: (data: TenantCreationData) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  clearAllFilters: () => void;
  clearOnboardingParams: () => void;

  // Permissions
  getPermissions: (tenantId: string) => {
    canEdit: boolean;
    canDelete: boolean;
    canRename: boolean;
  };
}
