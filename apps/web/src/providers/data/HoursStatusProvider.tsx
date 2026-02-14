"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { hoursStatusService, StoreStatus } from '@/services/HoursStatusService';
import { hoursStatusSingleton } from './HoursStatusSingleton';

// Context interface
interface HoursStatusContextType {
  // Single store status
  getStoreStatus: (tenantId: string) => Promise<StoreStatus | null>;
  getCachedStatus: (tenantId: string) => StoreStatus | null;
  hasStatus: (tenantId: string) => boolean;
  
  // Multiple store status
  getMultipleStoreStatus: (tenantIds: string[]) => Promise<Map<string, StoreStatus>>;
  
  // Cache management
  refreshStatus: (tenantId: string) => Promise<StoreStatus | null>;
  clearTenantStatus: (tenantId: string) => void;
  clearAllStatus: () => void;
  
  // Metrics
  getMetrics: () => any;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

// Create context
const HoursStatusContext = createContext<HoursStatusContextType | undefined>(undefined);

// Provider component
export function HoursStatusProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize singleton on mount
  useEffect(() => {
    // Singleton is already initialized via getInstance()
    // We could preload featured stores here if needed
  }, []);

  const getStoreStatus = async (tenantId: string): Promise<StoreStatus | null> => {
    try {
      setLoading(true);
      setError(null);
      return await hoursStatusService.getStoreStatus(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch store status');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getMultipleStoreStatus = async (tenantIds: string[]): Promise<Map<string, StoreStatus>> => {
    try {
      setLoading(true);
      setError(null);
      return await hoursStatusService.getMultipleStoreStatus(tenantIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch store statuses');
      return new Map();
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async (tenantId: string): Promise<StoreStatus | null> => {
    try {
      setLoading(true);
      setError(null);
      // Invalidate cache first
      await hoursStatusService.invalidateCache(tenantId);
      // Then fetch fresh data
      return await hoursStatusService.getStoreStatus(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh store status');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearTenantStatus = (tenantId: string): void => {
    hoursStatusService.clearCachedStatus(tenantId);
  };

  const clearAllStatus = (): void => {
    hoursStatusService.clearAllCachedStatus();
  };

  const getMetrics = (): any => {
    // Return basic metrics since getCustomMetrics is protected
    return {
      cachedTenants: hoursStatusService.getCachedCount(),
      totalStatusRequests: 0
    };
  };

  const getCachedStatus = (tenantId: string): StoreStatus | null => {
    return hoursStatusService.getCachedStatus(tenantId);
  };

  const hasStatus = (tenantId: string): boolean => {
    return hoursStatusService.hasStatus(tenantId);
  };

  const value: HoursStatusContextType = {
    getStoreStatus,
    getCachedStatus,
    hasStatus,
    getMultipleStoreStatus,
    refreshStatus,
    clearTenantStatus,
    clearAllStatus,
    getMetrics,
    loading,
    error
  };

  return (
    <HoursStatusContext.Provider value={value}>
      {children}
    </HoursStatusContext.Provider>
  );
}

// Hook to use the context
export function useHoursStatus() {
  const context = useContext(HoursStatusContext);
  if (context === undefined) {
    throw new Error('useHoursStatus must be used within a HoursStatusProvider');
  }
  return context;
}

// Export the singleton instance for direct access if needed
export { hoursStatusSingleton };
