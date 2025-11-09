import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface DashboardStats {
  totalItems: number;
  activeItems: number;
  syncIssues: number;
  locations: number;
}

export interface DashboardData {
  stats: DashboardStats;
  tenant: {
    id: string;
    name: string;
  } | null;
  isChain: boolean;
  organizationName: string | null;
}

export interface UseDashboardDataReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Optimized hook for fetching dashboard data
 * Uses efficient backend endpoint that returns only aggregated stats
 * No unnecessary data loading
 */
export function useDashboardData(isAuthenticated: boolean, authLoading: boolean): UseDashboardDataReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Track tenantId changes from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkTenantId = () => {
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId !== currentTenantId) {
        setCurrentTenantId(tenantId);
      }
    };
    
    // Check immediately
    checkTenantId();
    
    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', checkTenantId);
    
    // Poll for changes (in case same-tab changes don't trigger storage event)
    const interval = setInterval(checkTenantId, 500);
    
    return () => {
      window.removeEventListener('storage', checkTenantId);
      clearInterval(interval);
    };
  }, [currentTenantId]);

  const fetchDashboardData = async () => {
    // Only fetch if authenticated
    if (!isAuthenticated || authLoading) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get tenant ID from localStorage to fetch correct tenant data
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      const url = tenantId 
        ? `/api/dashboard?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/dashboard';

      const response = await api.get(url);

      if (!response.ok) {
        throw new Error(`Dashboard API returned ${response.status}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      console.error('[useDashboardData] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount when authenticated or when tenant changes
  useEffect(() => {
    fetchDashboardData();
  }, [isAuthenticated, authLoading, currentTenantId]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboardData,
  };
}
