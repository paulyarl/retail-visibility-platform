import { useQuery } from "@tanstack/react-query";
import { apiQueriesService } from '@/services/ApiQueriesSingletonService';
import { useTenantComplete } from './dashboard/useTenantComplete';
import { useItemsComplete } from './useItemsComplete';
import { clientLogger } from '@/lib/client-logger';

interface Category {
  id: string;
  name: string;
  slug: string;
  // Add other category fields as needed
}
interface TenantTier {
  tier: string;
  limits: Record<string, any>;
  features: Record<string, boolean>;
}

interface TenantUsage {
  products: number;
  activeProducts: number;
  monthlySkuQuota: number | null;
  skusAddedThisMonth: number;
  quotaRemaining: number | null;
  locations: number;
  users: number;
  apiCalls: number;
  storageGB: number;
}

interface Tenant {
  id: string;
  name: string;
  businessName?: string;
  subscriptionTier?: string;
  subscription_tier?: string; // snake_case version
  subscriptionStatus?: string;
  subscription_status?: string; // snake_case version
  trialEndsAt?: string;
  trial_ends_at?: string; // snake_case version
  subscriptionEndsAt?: string;
  subscription_ends_at?: string; // snake_case version
  graceEndsAt?: string;
  grace_ends_at?: string; // snake_case version
  manualSubscriptionControl?: boolean;
  manual_subscription_control?: boolean; // snake_case version
  manualSubscriptionExpiresAt?: string;
  manual_subscription_expires_at?: string; // snake_case version
  manualSubscriptionReason?: string;
  manual_subscription_reason?: string; // snake_case version
  effectiveExpiresAt?: string;
  effectiveExpiresType?: 'trial' | 'subscription' | 'manual';
  effectiveExpiresSource?: 'automatic_trial' | 'automatic_subscription' | 'manual_override';
  metadata?: any;
  organizationId?: string;
  organization_id?: string; // snake_case version
  createdAt?: string;
  created_at?: string; // snake_case version
  service_level?: string; // snake_case version
  reopening_date?: string; // snake_case version
  gbpPrimaryCategoryId?: string;
  gbpPrimaryCategoryName?: string;
  gbpSecondaryCategories?: any;
  _count?: {
    items: number;
    users: number;
  };
}

interface OrganizationData {
  organizationId: string;
  organizationName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  limits: {
    maxLocations: number;
    maxTotalSKUs: number;
  };
  current: {
    totalLocations: number;
    totalSKUs: number;
  };
  status: {
    locations: 'ok' | 'warning' | 'at_limit';
    skus: 'ok' | 'warning' | 'at_limit';
    overall: 'ok' | 'warning' | 'at_limit';
  };
  locationBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    skuCount: number;
    metadata?: any;
  }>;
}

// Organization queries
export function useOrganizationData(organizationId?: string) {
  return useQuery({
    queryKey: ['organization', organizationId, 'billing'],
    queryFn: async (): Promise<OrganizationData> => {
      if (!organizationId) {
        clientLogger.error('[useOrganizationData] Organization ID is required');
        throw new Error('Organization ID is required');
      }

      console.log('[useOrganizationData] Fetching organization data for:', organizationId);
      try {
        const response = await apiQueriesService.getOrganizationBillingCounters(organizationId);
        console.log('[useOrganizationData] Successfully fetched organization data');
        return response;
      } catch (error) {
        clientLogger.error('[useOrganizationData] Error fetching organization data:', { detail: error });
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - organization data updates moderately frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    enabled: !!organizationId, // Only run when organizationId is available
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error && typeof error === 'object' && 'status' in error && (error.status as number) === 401) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
  });
}

interface Item {
  id: string;
  name: string;
  // Add other item fields as needed
}

interface ItemsStats {
  total: number;
  active: number;
  archived: number;
  // Add other stats fields as needed
}

// Base API URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Tenant-related queries
export function useTenantTier(tenantId: string) {
  // Use consolidated data instead of separate API call
  const { tier: consolidatedTier } = useTenantComplete(tenantId);

  return {
    data: consolidatedTier,
    isLoading: false, // Data comes from consolidated hook
    error: null,
    refetch: () => Promise.resolve() // Handled by consolidated hook
  };
}

export function useTenantUsage(tenantId: string) {
  // Use consolidated data instead of separate API call
  const { usage: consolidatedUsage } = useTenantComplete(tenantId);

  return {
    data: consolidatedUsage,
    isLoading: false, // Data comes from consolidated hook
    error: null,
    refetch: () => Promise.resolve() // Handled by consolidated hook
  };
}

export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async (): Promise<Tenant> => {
      const response = await apiQueriesService.getTenant(tenantId);
      return response;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - tenant data is mostly static
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}

// Category queries
export function useTenantCategories(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId, 'categories'],
    queryFn: async (): Promise<Category[]> => {
      const response = await apiQueriesService.getTenantCategories(tenantId);
      return response;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - categories change infrequently
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}

// Items queries
export function useItems(tenantId?: string, filters?: Record<string, any>) {
  // Use consolidated items hook instead of separate API calls
  const { items: consolidatedItems, loading: itemsLoading } = useItemsComplete({
    tenantId: tenantId || '',
    initialPage: 1,
    initialPageSize: 25,
    initialStatus: "all",
    initialVisibility: "all",
    initialSearch: "",
    initialCategory: null
  });

  return {
    data: consolidatedItems,
    isLoading: itemsLoading,
    error: null,
    refetch: () => Promise.resolve() // Handled by consolidated hook
  };
}

export function useItemsStats(tenantId?: string) {
  // Use consolidated items hook for stats instead of separate API call
  const { stats: consolidatedStats, loading: statsLoading } = useItemsComplete({
    tenantId: tenantId || '',
    initialPage: 1,
    initialPageSize: 25,
    initialStatus: "all",
    initialVisibility: "all",
    initialSearch: "",
    initialCategory: null
  });

  return {
    data: consolidatedStats,
    isLoading: statsLoading,
    error: null,
    refetch: () => Promise.resolve() // Handled by consolidated hook
  };
}

// Upgrade requests queries
export function useUpgradeRequests(tenantId?: string, status?: string) {
  return useQuery({
    queryKey: ['upgrade-requests', tenantId, status],
    queryFn: async (): Promise<any[]> => {
      if (!tenantId) return [];

      const response = await apiQueriesService.getUpgradeRequests(tenantId, status);
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - requests update frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    enabled: !!tenantId, // Only run when tenantId is available
  });
}
