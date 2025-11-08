export interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  organization?: {
    id: string;
    name: string;
  } | null;
  metadata?: { city?: string; state?: string };
}

export interface DbTier {
  id: string;
  tierKey: string;
  displayName: string;
  priceMonthly: number;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BillingFilters {
  searchQuery: string;
  selectedTierFilter: string;
  currentPage: number;
}

export interface BillingStats {
  totalTenants: number;
  filteredCount: number;
  tierCounts: Record<string, number>;
}
