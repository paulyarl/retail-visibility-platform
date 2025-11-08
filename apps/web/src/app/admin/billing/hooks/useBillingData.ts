import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Tenant, DbTier } from '../types';

interface UseBillingDataResult {
  tenants: Tenant[];
  tiers: DbTier[];
  loading: boolean;
  tiersLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch billing data (tenants and tiers)
 * Handles loading states and errors
 */
export function useBillingData(): UseBillingDataResult {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tiers, setTiers] = useState<DbTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tenants
  useEffect(() => {
    async function loadTenants() {
      try {
        console.log('[useBillingData] Loading tenants...');
        setLoading(true);
        const res = await api.get('/api/tenants');
        if (res.ok) {
          const data = await res.json();
          console.log('[useBillingData] Tenants loaded:', data.tenants?.length || 0);
          setTenants(data.tenants || []);
        } else {
          console.error('[useBillingData] Failed to load tenants:', res.status);
          setError('Failed to load tenants');
        }
      } catch (e) {
        console.error('[useBillingData] Error loading tenants:', e);
        setError('Failed to load tenants');
      } finally {
        setLoading(false);
      }
    }
    loadTenants();
  }, []);

  // Load tiers
  useEffect(() => {
    async function loadTiers() {
      try {
        console.log('[useBillingData] Loading tiers...');
        setTiersLoading(true);
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await api.get(`${apiBaseUrl}/api/admin/tier-system/tiers`);
        if (res.ok) {
          const data = await res.json();
          console.log('[useBillingData] Tiers loaded:', data.tiers?.length || 0);
          setTiers(data.tiers || []);
        } else {
          console.error('[useBillingData] Failed to load tiers:', res.status);
        }
      } catch (e) {
        console.error('[useBillingData] Error loading tiers:', e);
      } finally {
        setTiersLoading(false);
      }
    }
    loadTiers();
  }, []);

  return { tenants, tiers, loading, tiersLoading, error };
}
