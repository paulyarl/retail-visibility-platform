import { useQuery } from "@tanstack/react-query";
import { api } from '@/lib/api';

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
  sku: { current: number; limit: number; percent: number };
  location: { current: number; limit: number; percent: number };
}

interface Tenant {
  id: string;
  name: string;
  businessName?: string;
  subscriptionTier?: string;
  subscription_tier?: string; // snake_case version
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  metadata?: any;
  // Add other tenant fields as needed
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
        throw new Error('Organization ID is required');
      }

      const response = await api.get(`/api/organization/billing/counters?organizationId=${organizationId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch organization data');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - organization data updates moderately frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    enabled: !!organizationId, // Only run when organizationId is available
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
  return useQuery({
    queryKey: ['tenant', tenantId, 'tier'],
    queryFn: async (): Promise<TenantTier> => {
      const response = await fetch(`${API_BASE}/api/tenants/${tenantId}/tier`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant tier: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - tier data changes infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

export function useTenantUsage(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId, 'usage'],
    queryFn: async (): Promise<TenantUsage> => {
      const response = await fetch(`${API_BASE}/api/tenants/${tenantId}/usage`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant usage: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - usage updates frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });
}

export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async (): Promise<Tenant> => {
      const response = await fetch(`${API_BASE}/api/tenants/${tenantId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant: ${response.status}`);
      }
      return response.json();
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
      const response = await fetch(`${API_BASE}/api/tenant/${tenantId}/categories`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant categories: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - categories change infrequently
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}

// Items queries
export function useItems(tenantId?: string, filters?: Record<string, any>) {
  const queryKey = ['items', tenantId, filters].filter(Boolean);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Item[]> => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.set(key, String(value));
          }
        });
      }

      const url = `${API_BASE}/api/items${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - items change more frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

export function useItemsStats(tenantId?: string) {
  return useQuery({
    queryKey: ['items', 'stats', tenantId].filter(Boolean),
    queryFn: async (): Promise<ItemsStats> => {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      const response = await fetch(`${API_BASE}/api/items/stats${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch items stats: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute - stats update frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

// Upgrade requests queries
export function useUpgradeRequests(tenantId?: string, status?: string) {
  return useQuery({
    queryKey: ['upgrade-requests', tenantId, status],
    queryFn: async (): Promise<any[]> => {
      if (!tenantId) return [];

      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (status) params.set('status', status);

      const response = await api.get(`/api/upgrade-requests?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch upgrade requests');
      }

      const data = await response.json();
      return data.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - requests update frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    enabled: !!tenantId, // Only run when tenantId is available
  });
}
