"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRateLimitErrorHandler } from './useRateLimitErrorHandler';
import { hoursStatusService } from '@/services/HoursStatusService';
import { tenantManagementService } from '@/services/TenantManagementService';

export interface StoreStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'opening-soon' | 'closing-soon';
  label: string;
}

export function useStoreStatus(tenantId?: string, isPublic: boolean = false) {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { handleRateLimitError } = useRateLimitErrorHandler();

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

      let responseData: StoreStatus | null = null;

      // Use service based on scope prop instead of auth context
      if (isPublic) {
        // Public scope - use public endpoint via HoursStatusService
        responseData = await hoursStatusService.getStoreStatus(tenantId);
      } else {
        // Private scope - use private endpoint via TenantManagementService
        responseData = await tenantManagementService.getStoreStatus(tenantId);
      }

      if (!responseData) {
        setStatus(null);
        setLoading(false);
        return;
      }

      setStatus(responseData);
    } catch (err) {
      console.error('Failed to fetch store status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isPublic, memoizedHandleRateLimitError]);

  useEffect(() => {
    if (tenantId) {
      fetchStatus();
    }
  }, [tenantId, fetchStatus]);

  // Only enable refresh for private scope (tenant settings)
  useEffect(() => {
    if (!tenantId || isPublic) return; // No refresh for public scope

    const interval = setInterval(fetchStatus, 900000); // 15 minutes for private scope
    return () => clearInterval(interval);
  }, [tenantId, isPublic, fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus
  };
}
