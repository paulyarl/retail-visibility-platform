import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface TenantDashboardStats {
  totalItems: number;
  activeItems: number;
  syncIssues: number;
  locations: number;
}

export interface TenantDashboardInfo {
  id: string;
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
  locationStatus?: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  reopeningDate?: string | null;
}

export interface TenantDashboardData {
  stats: TenantDashboardStats;
  info: TenantDashboardInfo | null;
}

export interface UseTenantDashboardReturn {
  data: TenantDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Centralized hook for tenant dashboard data
 * Fetches stats and info for a specific tenant
 * Single source of truth for tenant dashboard data fetching
 */
export function useTenantDashboard(tenantId: string | null): UseTenantDashboardReturn {
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!tenantId) {
      console.log('[useTenantDashboard] No tenantId provided');
      setLoading(false);
      return;
    }

    console.log('[useTenantDashboard] Fetching consolidated data for tenantId:', tenantId);

    try {
      setLoading(true);
      setError(null);

      // Use consolidated endpoint - reduces 2 API calls to 1
      const response = await api.get(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/dashboard/consolidated/${encodeURIComponent(tenantId)}`);

      console.log('[useTenantDashboard] Consolidated response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[useTenantDashboard] Consolidated data received:', {
        tenant: data.tenant?.id,
        stats: data.stats,
      });

      // Extract stats
      const stats: TenantDashboardStats = {
        totalItems: data.stats?.totalItems || 0,
        activeItems: data.stats?.activeItems || 0,
        syncIssues: data.stats?.syncIssues || 0,
        locations: data.stats?.locations || 0,
      };

      // Extract tenant info
      const info: TenantDashboardInfo = {
        id: data.tenant?.id || tenantId,
        name: data.tenant?.name || 'Unknown Tenant',
        logoUrl: data.tenant?.logoUrl,
        bannerUrl: data.tenant?.bannerUrl,
        locationStatus: data.tenant?.locationStatus || 'active',
        reopeningDate: data.tenant?.reopeningDate,
      };

      console.log('[useTenantDashboard] Final data to set:', { stats, info });
      setData({ stats, info });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      console.error('[useTenantDashboard] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when tenantId changes
  useEffect(() => {
    fetchDashboardData();
  }, [tenantId]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboardData,
  };
}
