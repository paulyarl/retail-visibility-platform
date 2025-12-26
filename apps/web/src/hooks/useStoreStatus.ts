"use client";

import { useState, useEffect } from 'react';

export interface StoreStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'opening-soon' | 'closing-soon';
  label: string;
}

export function useStoreStatus(tenantId: string, apiBase?: string) {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = apiBase || (typeof window !== 'undefined' ? window.location.origin : '');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${baseUrl}/public/tenant/${tenantId}/business-hours/status`, {
        cache: 'no-store'
      });

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
  };

  useEffect(() => {
    if (tenantId) {
      fetchStatus();
    }
  }, [tenantId]);

  // Auto-refresh every 30 seconds to keep status current
  useEffect(() => {
    if (!tenantId) return;

    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus
  };
}
