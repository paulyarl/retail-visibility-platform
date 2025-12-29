"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRateLimitErrorHandler } from './useRateLimitErrorHandler';
import { useAuth } from '@/contexts/AuthContext';

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
  const { handleRateLimitError } = useRateLimitErrorHandler();
  const { user } = useAuth();

  // Memoize the rate limit error handler to prevent fetchStatus recreation
  const memoizedHandleRateLimitError = useCallback(handleRateLimitError, []);

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
        // Check if this is a rate limit error and handle it with user-friendly messaging
        if (memoizedHandleRateLimitError(response, `/public/tenant/${tenantId}/business-hours/status`)) {
          // Rate limit error was handled, don't show generic error
          setError(null);
          setStatus(null);
          setLoading(false);
          return;
        }
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
  }, [tenantId, baseUrl, memoizedHandleRateLimitError]);

  useEffect(() => {
    if (tenantId) {
      fetchStatus();
    }
  }, [tenantId, fetchStatus]);

  // Only enable refresh for authenticated users - anonymous users get static status
  useEffect(() => {
    if (!tenantId || !user) return; // No refresh for anonymous users

    const interval = setInterval(fetchStatus, 900000); // 15 minutes for authenticated users
    return () => clearInterval(interval);
  }, [tenantId, user, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus
  };
}
