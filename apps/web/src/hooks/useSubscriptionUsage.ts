'use client';

/**
 * Hook for fetching and managing subscription usage data
 * Provides real-time SKU usage, location usage, and subscription information
 * 
 * Usage:
 * const { usage, loading, error } = useSubscriptionUsage();
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tiers';
import { deriveInternalStatus, type InternalStatus, type MaintenanceState, getMaintenanceState } from '@/lib/subscription-status';
import { useTenant, useTenantTier } from '@/hooks/useApiQueries';
import { useItemsStats } from '@/hooks/useApiQueries';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTierSystem } from '@/hooks/useTierSystem';

export interface SubscriptionUsage {
  // Tenant info
  tenantId: string;
  tenantName: string;
  gbpPrimaryCategory?: string; // Google Business Profile primary category name
  
  // Subscription details
  tier: SubscriptionTier;
  tierName: string;
  tierPrice: string;
  tierDescription: string;
  status: string;
  internalStatus: InternalStatus; // Derived operational status
  maintenanceState: MaintenanceState; // For google_only lifecycle
  
  // SKU usage
  skuUsage: number;
  skuLimit: number;
  skuPercent: number;
  skuIsUnlimited: boolean;
  skuColor: 'green' | 'yellow' | 'red';
  skuStatus: 'healthy' | 'warning' | 'critical';
  
  // Location usage (for user's owned locations)
  locationUsage: number;
  locationLimit: number;
  locationPercent: number;
  locationIsUnlimited: boolean;
  locationColor: 'green' | 'yellow' | 'red';
  locationStatus: 'healthy' | 'warning' | 'critical';
  locationTierDisplayName: string; // e.g., "Platform Admin", "Professional (10 locations)", etc.
  
  // Overall status (worst of SKU or location)
  overallColor: 'green' | 'yellow' | 'red';
  overallStatus: 'healthy' | 'warning' | 'critical';
  
  // Metadata
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
}

export interface SubscriptionUsageProps {
  // Optional: pass known values from parent to avoid separate fetch
  tier?: string;
  status?: string;
  trialEndsAt?: string | null;
}

export function useSubscriptionUsage(tenantIdProp?: string, props?: SubscriptionUsageProps) {
  // Get tenant ID from prop or localStorage (only on client side)
  const tenantId = tenantIdProp || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null) || undefined;

  // Use React Query hooks for cached data
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(tenantId || '');
  const { data: tierData, isLoading: tierLoading } = useTenantTier(tenantId || ''); // Get effective tier
  const { data: itemsStats, isLoading: itemsLoading, error: itemsError } = useItemsStats(tenantId);
  const { status: tenantLimits, loading: limitsLoading, error: limitsError } = useTenantLimits();
  
  // Get dynamic tier data
  const { getTierInfo: getDynamicTierInfo, loading: tiersLoading } = useTierSystem();

  // If props provided, skip loading checks for those values
  const hasProps = props?.tier;

  // Combine data using React Query
  const { data: usage, isLoading: loading, error } = useQuery({
    queryKey: ['subscription-usage', tenantId, props?.tier || tierData?.effective?.id],
    queryFn: (): SubscriptionUsage | null => {
      // If props provided, we don't need tierData
      if (!tenantId || !tenant || !itemsStats || !tenantLimits) {
        return null;
      }

      if (!hasProps && !tierData) {
        return null;
      }

      const itemCount = itemsStats.total;

      // Get location data from tenant limits
      const locationCurrent = tenantLimits.current;
      const locationLimit = tenantLimits.limit;
      const locationIsUnlimited = locationLimit === 'unlimited';
      const locationTierDisplayName = tenantLimits.tierDisplayName || '';

      // Get tier info - prefer props, then effective tier from tier endpoint, fallback to tenant tier
      // This ensures organization members get their org's tier, not individual google_only tier
      const tier = (props?.tier || tierData?.effective?.id || tenant.subscriptionTier || tenant.subscription_tier || 'starter') as SubscriptionTier;
      const tierInfo = getDynamicTierInfo(tier);
      const skuLimit = tierInfo.maxSkus ?? Infinity;
      const skuIsUnlimited = skuLimit === Infinity;

      // Calculate SKU usage percentage
      const skuPercent = skuIsUnlimited ? 0 : Math.min(100, Math.round((itemCount / skuLimit) * 100));

      // Determine SKU color and status
      let skuColor: 'green' | 'yellow' | 'red' = 'green';
      let skuStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (!skuIsUnlimited) {
        if (skuPercent >= 100) {
          skuColor = 'red';
          skuStatus = 'critical';
        } else if (skuPercent >= 80) {
          skuColor = 'yellow';
          skuStatus = 'warning';
        }
      }

      // Calculate location usage percentage (use backend-calculated values)
      const locationLimitNum = locationIsUnlimited ? Infinity : (typeof locationLimit === 'number' ? locationLimit : parseInt(locationLimit as string, 10));
      const locationPercent = locationIsUnlimited ? 0 : Math.min(100, Math.round((locationCurrent / locationLimitNum) * 100));

      // Determine location color and status
      let locationColor: 'green' | 'yellow' | 'red' = 'green';
      let locationStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (!locationIsUnlimited) {
        if (locationPercent >= 100) {
          locationColor = 'red';
          locationStatus = 'critical';
        } else if (locationPercent >= 80) {
          locationColor = 'yellow';
          locationStatus = 'warning';
        }
      }

      // Determine overall status (worst of SKU or location)
      let overallColor: 'green' | 'yellow' | 'red' = 'green';
      let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (skuStatus === 'critical' || locationStatus === 'critical') {
        overallColor = 'red';
        overallStatus = 'critical';
      } else if (skuStatus === 'warning' || locationStatus === 'warning') {
        overallColor = 'yellow';
        overallStatus = 'warning';
      }

      // Derive internal status and maintenance state
      const subscriptionStatus = tenant.subscriptionStatus || 'active';
      const internalStatus = deriveInternalStatus({
        subscriptionStatus,
        subscriptionTier: tier,
        trialEndsAt: tenant.trialEndsAt,
        subscriptionEndsAt: tenant.subscriptionEndsAt,
      });

      const maintenanceState = getMaintenanceState({
        tier,
        status: subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt,
      });

      // Extract GBP primary category from metadata
      const gbpPrimaryCategory = tenant.metadata?.gbp_categories?.primary?.name || null;

      return {
        tenantId,
        tenantName: tenant.name,
        gbpPrimaryCategory,
        tier,
        tierName: tierInfo.name,
        tierPrice: tierInfo.price,
        tierDescription: tierInfo.description || '',
        status: subscriptionStatus,
        internalStatus,
        maintenanceState,
        skuUsage: itemCount,
        skuLimit,
        skuPercent,
        skuIsUnlimited,
        skuColor,
        skuStatus,
        locationUsage: locationCurrent,
        locationLimit: locationLimitNum,
        locationPercent,
        locationIsUnlimited,
        locationColor,
        locationStatus,
        locationTierDisplayName,
        overallColor,
        overallStatus,
        trialEndsAt: tenant.trialEndsAt,
        subscriptionEndsAt: tenant.subscriptionEndsAt,
      };
    },
    enabled: !!tenantId && !!tenant && !!itemsStats && !!tenantLimits,
    staleTime: 2 * 60 * 1000, // 2 minutes - usage updates more frequently than limits
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  const combinedLoading = tenantLoading || tierLoading || itemsLoading || limitsLoading || tiersLoading || loading;
  const combinedError = tenantError || itemsError || limitsError || error;

  return { 
    usage, 
    loading: combinedLoading, 
    error: combinedError instanceof Error ? combinedError.message : null 
  };
}
