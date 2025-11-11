/**
 * Hook for managing tenant (location) creation limits
 */

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';

export interface TenantLimitStatus {
  current: number;
  limit: number | 'unlimited';
  remaining: number | 'unlimited';
  tier: string;
  tierDisplayName: string;
  canCreate: boolean;
  upgradeMessage: string | null;
  upgradeToTier: string | null;
  tenants?: Array<{
    id: string;
    name: string;
    tier: string;
  }>;
}

export interface TierInfo {
  tier: string;
  limit: number | 'unlimited';
  displayName: string;
  description: string;
  upgradeMessage: string;
  upgradeToTier?: string;
}

export function useTenantLimits() {
  const [status, setStatus] = useState<TenantLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLimitStatus();
  }, []);

  const fetchLimitStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/tenant-limits/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tenant limit status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('[useTenantLimits] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchLimitStatus();
  };

  return {
    status,
    loading,
    error,
    refresh,
    
    // Computed values
    canCreateTenant: status?.canCreate ?? false,
    isAtLimit: status ? (
      status.limit === 'unlimited' ? false : status.current >= status.limit
    ) : false,
    percentUsed: status && status.limit !== 'unlimited' ? 
      Math.round((status.current / (status.limit as number)) * 100) : 0,
  };
}

/**
 * Hook to fetch all tier information
 */
export function useTierInfo() {
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/tenant-limits/tiers`);

      if (!response.ok) {
        throw new Error('Failed to fetch tier information');
      }

      const data = await response.json();
      setTiers(data.tiers);
    } catch (err) {
      console.error('[useTierInfo] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    tiers,
    loading,
    error,
  };
}
