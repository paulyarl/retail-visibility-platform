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

    console.log('[useTenantDashboard] Fetching data for tenantId:', tenantId);

    try {
      setLoading(true);
      setError(null);

      // Fetch stats and tenant info in parallel
      const [statsResponse, tenantResponse] = await Promise.all([
        api.get(`/api/dashboard?tenantId=${encodeURIComponent(tenantId)}`),
        api.get(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/tenants/${tenantId}`)
      ]);

      console.log('[useTenantDashboard] Stats response status:', statsResponse.status);
      console.log('[useTenantDashboard] Tenant response status:', tenantResponse.status);

      let stats: TenantDashboardStats = {
        totalItems: 0,
        activeItems: 0,
        syncIssues: 0,
        locations: 0,
      };

      let info: TenantDashboardInfo | null = null;

      // Process stats response
      if (statsResponse.ok) {
        try {
          const statsData = await statsResponse.json();
          console.log('[useTenantDashboard] Stats data received:', {
            tenant: statsData.tenant,
            stats: statsData.stats
          });
          
          stats = {
            totalItems: statsData.stats?.totalItems || 0,
            activeItems: statsData.stats?.activeItems || 0,
            syncIssues: statsData.stats?.syncIssues || 0,
            locations: statsData.stats?.locations || 0,
          };

          // Extract organization info from stats response
          if (statsData.tenant) {
            info = {
              id: statsData.tenant.id,
              name: statsData.tenant.name || 'Unknown Tenant',
              logoUrl: undefined,
              bannerUrl: undefined,
            };
            console.log('[useTenantDashboard] Tenant info from stats:', info);
          }
        } catch (err) {
          console.error('[useTenantDashboard] Error parsing stats response:', err);
        }
      } else {
        console.error('[useTenantDashboard] Stats response not OK:', statsResponse.status, statsResponse.statusText);
      }

      // Process tenant response (for logo/banner)
      if (tenantResponse.ok) {
        try {
          const tenantData = await tenantResponse.json();
          console.log('[useTenantDashboard] Tenant data received:', {
            id: tenantData.id,
            name: tenantData.name
          });
          
          if (info) {
            info.logoUrl = tenantData.metadata?.logo_url;
            info.bannerUrl = tenantData.metadata?.banner_url;
            info.locationStatus = tenantData.locationStatus || tenantData.statusInfo?.status || 'active';
            info.reopeningDate = tenantData.reopeningDate;
          } else {
            info = {
              id: tenantData.id,
              name: tenantData.name || 'Unknown Tenant',
              logoUrl: tenantData.metadata?.logo_url,
              bannerUrl: tenantData.metadata?.banner_url,
              locationStatus: tenantData.locationStatus || tenantData.statusInfo?.status || 'active',
              reopeningDate: tenantData.reopeningDate,
            };
          }
        } catch (err) {
          console.error('[useTenantDashboard] Error parsing tenant response:', err);
        }
      } else {
        console.error('[useTenantDashboard] Tenant response not OK:', tenantResponse.status, tenantResponse.statusText);
      }

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
