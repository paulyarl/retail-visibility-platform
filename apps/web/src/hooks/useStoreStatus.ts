"use client";

import { useState, useEffect, useRef } from 'react';
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
  
  // Use ref to track if we've already fetched for this tenantId
  const hasFetchedRef = useRef(false);
  const lastTenantIdRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Skip if no tenantId
    if (!tenantId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    // Reset fetch state if tenantId changed
    if (lastTenantIdRef.current !== tenantId) {
      hasFetchedRef.current = false;
      lastTenantIdRef.current = tenantId;
    }

    // Only fetch once per tenantId
    if (hasFetchedRef.current) {
      return;
    }
    
    hasFetchedRef.current = true;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        let responseData: StoreStatus | null = null;

        // Use service based on scope prop
        if (isPublic) {
          responseData = await hoursStatusService.getStoreStatus(tenantId);
        } else {
          responseData = await tenantManagementService.getStoreStatus(tenantId);
        }

        // Only update state if still mounted
        if (mountedRef.current) {
          if (responseData) {
            setStatus(responseData);
          }
        }
      } catch (err) {
        console.error('Failed to fetch store status:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setStatus(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchStatus();
  }, [tenantId, isPublic]); // Remove fetchStatus from deps - defined inside effect

  // Only enable refresh for private scope (tenant settings)
  useEffect(() => {
    if (!tenantId || isPublic) return;

    const interval = setInterval(async () => {
      try {
        const responseData = await tenantManagementService.getStoreStatus(tenantId);
        if (mountedRef.current && responseData) {
          setStatus(responseData);
        }
      } catch (err) {
        console.error('Failed to refresh store status:', err);
      }
    }, 900000); // 15 minutes

    return () => clearInterval(interval);
  }, [tenantId, isPublic]);

  return {
    status,
    loading,
    error,
    refresh: async () => {
      if (!tenantId) return;
      try {
        const responseData = isPublic 
          ? await hoursStatusService.getStoreStatus(tenantId)
          : await tenantManagementService.getStoreStatus(tenantId);
        if (mountedRef.current && responseData) setStatus(responseData);
      } catch (err) {
        console.error('Failed to refresh store status:', err);
      }
    }
  };
}
