import { useState, useEffect } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { tenantTierService } from '@/services/TenantTierService';
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
        const tenantsArray = await platformHomeService.getTenants();
        
        // Transform snake_case fields to camelCase for frontend compatibility
        const transformedTenants = tenantsArray?.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          subscriptionTier: tenant.subscriptionTier,
          organization: tenant.organization ? {
            id: tenant.organization.id,
            name: tenant.organization.name,
          } : null,
          metadata: tenant.metadata,
        })) || [];
        
        console.log('[useBillingData] Tenants loaded:', transformedTenants.length);
        setTenants(transformedTenants);
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
        const data = await tenantTierService.getAdminTiers();
        console.log('[useBillingData] Tiers loaded:', data?.length || 0);
        
        // Transform service DbTier to billing DbTier format
        const transformedTiers = (data || []).map((tier: any) => ({
          id: tier.id,
          tierKey: tier.type || tier.name, // Use type or fallback to name
          displayName: tier.displayName,
          priceMonthly: tier.price,
          tierType: tier.type,
          isActive: true, // Default to active since service doesn't have this field
          sortOrder: tier.sortOrder,
        }));
        
        setTiers(transformedTiers);
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
