export interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  graceEndsAt?: string;
  manualSubscriptionControl?: boolean;
  manualSubscriptionExpiresAt?: string;
  manualSubscriptionReason?: string;
  effectiveExpiresAt?: string;
  effectiveExpiresType?: 'trial' | 'subscription' | 'manual';
  effectiveExpiresSource?: 'automatic_trial' | 'automatic_subscription' | 'manual_override';
  organization?: {
    id: string;
    name: string;
  } | null;
  metadata?: { city?: string; state?: string };
  organizationId?: string;
  createdAt?: string;
  _count?: {
    inventory_items: number;
    user_tenants: number;
  };
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
