"use client";

import { useState, useEffect, useCallback } from 'react';
import { hoursStatusSingleton, StoreStatus } from '@/providers/data/HoursStatusSingleton';

/**
 * Enhanced useStoreStatus hook that uses the HoursStatusSingleton
 * Provides universal caching and singleton benefits
 */
export function useStoreStatusEnhanced(tenantId?: string) {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        setStatus(null);
        setLoading(false);
        return;
      }

      const statusData = await hoursStatusSingleton.getStoreStatus(tenantId);
      setStatus(statusData);
    } catch (err) {
      console.error('Failed to fetch store status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Check cache first
  useEffect(() => {
    if (tenantId) {
      const cachedStatus = hoursStatusSingleton.getCachedStatus(tenantId);
      if (cachedStatus) {
        setStatus(cachedStatus);
        setLoading(false);
      } else {
        fetchStatus();
      }
    }
  }, [tenantId, fetchStatus]);

  // Refresh status periodically (shorter interval for hours since it changes throughout the day)
  useEffect(() => {
    if (!tenantId) return;

    const interval = setInterval(fetchStatus, 5 * 60 * 1000); // 5 minutes for hours status
    return () => clearInterval(interval);
  }, [tenantId, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
    refresh: () => tenantId ? hoursStatusSingleton.refreshStatus(tenantId) : Promise.resolve(null)
  };
}

/**
 * Hook for getting multiple store statuses at once
 * Perfect for featured stores list
 */
export function useMultipleStoreStatus(tenantIds: string[]) {
  const [statuses, setStatuses] = useState<Map<string, StoreStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMultipleStatuses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (tenantIds.length === 0) {
        setStatuses(new Map());
        setLoading(false);
        return;
      }

      const statusMap = await hoursStatusSingleton.getMultipleStoreStatus(tenantIds);
      setStatuses(statusMap);
    } catch (err) {
      console.error('Failed to fetch multiple store statuses:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatuses(new Map());
    } finally {
      setLoading(false);
    }
  }, [tenantIds]);

  useEffect(() => {
    fetchMultipleStatuses();
  }, [fetchMultipleStatuses]);

  // Refresh periodically
  useEffect(() => {
    if (tenantIds.length === 0) return;

    const interval = setInterval(fetchMultipleStatuses, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [tenantIds, fetchMultipleStatuses]);

  return {
    statuses,
    loading,
    error,
    refetch: fetchMultipleStatuses
  };
}

/**
 * Hook for getting hours status metrics
 */
export function useHoursStatusMetrics() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(hoursStatusSingleton.getMetrics());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return metrics;
}
