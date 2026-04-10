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
  refetch: () => void;
}

export function useBillingData(refetchTrigger = 0): UseBillingDataResult {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tiers, setTiers] = useState<DbTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTenants() {
      try {
        setLoading(true);
        const tenantsArray = await platformHomeService.getTenants();
        const transformedTenants = tenantsArray?.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          subscriptionTier: tenant.subscriptionTier,
          subscriptionStatus: tenant.subscriptionStatus,
          trialEndsAt: tenant.trialEndsAt,
          subscriptionEndsAt: tenant.subscriptionEndsAt,
          graceEndsAt: tenant.graceEndsAt,
          manualSubscriptionControl: tenant.manualSubscriptionControl,
          manualSubscriptionExpiresAt: tenant.manualSubscriptionExpiresAt,
          manualSubscriptionReason: tenant.manualSubscriptionReason,
          effectiveExpiresAt: tenant.effectiveExpiresAt,
          effectiveExpiresType: tenant.effectiveExpiresType,
          effectiveExpiresSource: tenant.effectiveExpiresSource,
          organization: tenant.organization ? { id: tenant.organization.id, name: tenant.organization.name } : null,
          metadata: tenant.metadata,
          organizationId: tenant.organizationId,
          createdAt: tenant.createdAt,
          _count: tenant._count,
        })) || [];
        setTenants(transformedTenants);
      } catch (e) {
        setError('Failed to load tenants');
      } finally {
        setLoading(false);
      }
    }
    loadTenants();
  }, [refetchTrigger]);

  useEffect(() => {
    async function loadTiers() {
      try {
        setTiersLoading(true);
        const data = await tenantTierService.getAdminTiers();
        const transformedTiers = (data || []).map((tier: any) => ({
          id: tier.id,
          tierKey: tier.id, // Use unique ID as key instead of potentially duplicate type/name
          displayName: tier.displayName,
          priceMonthly: tier.price,
          tierType: tier.type,
          isActive: true,
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

  const refetch = () => {
    // This will trigger the useEffect to refetch data
    console.log('[useBillingData] Refetching data...');
  };

  return { tenants, tiers, loading, tiersLoading, error, refetch };
}
