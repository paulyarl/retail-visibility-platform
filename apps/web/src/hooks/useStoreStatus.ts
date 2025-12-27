"use client";

import { useState, useEffect, useCallback } from 'react';

export interface StoreStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'opening-soon' | 'closing-soon';
  label: string;
}

export function useStoreStatus(tenantId?: string, apiBase?: string) {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = apiBase || process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        setStatus(null);
        setLoading(false);
        return;
      }

      // Use browser cache instead of no-store since we have server-side caching
      const response = await fetch(`${baseUrl}/public/tenant/${tenantId}/business-hours/status`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setStatus(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      console.error('Failed to fetch store status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, baseUrl]);

  useEffect(() => {
    if (tenantId) {
      fetchStatus();
    }
  }, [tenantId, fetchStatus]);

  // Reduce refresh frequency since we now have caching (server-side: 5 minutes, client-side: 1 minute)
  useEffect(() => {
    if (!tenantId) return;

    const interval = setInterval(fetchStatus, 60000); // 1 minute instead of 30 seconds
    return () => clearInterval(interval);
  }, [tenantId, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus
  };
}
