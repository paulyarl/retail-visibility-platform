/**
 * Hook for fetching and managing subscription usage data
 * Provides real-time SKU usage, location usage, and subscription information
 * 
 * Usage:
 * const { usage, loading, error } = useSubscriptionUsage();
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tiers';
import { deriveInternalStatus, type InternalStatus, type MaintenanceState, getMaintenanceState } from '@/lib/subscription-status';

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

export function useSubscriptionUsage(tenantIdProp?: string) {
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get tenant ID from prop or localStorage
        const tenantId = tenantIdProp || 
          localStorage.getItem('current_tenant_id') || 
          localStorage.getItem('tenantId');

        if (!tenantId) {
          setUsage(null);
          setLoading(false);
          return;
        }

        // Fetch tenant, items, and location limits data in parallel
        const [tenantRes, itemsRes, limitsRes] = await Promise.all([
          api.get(`/api/tenants/${tenantId}`),
          api.get(`/api/items?tenantId=${tenantId}&count=true`),
          api.get(`/api/tenant-limits/status`).catch(err => {
            console.warn('[useSubscriptionUsage] Failed to fetch tenant limits, continuing without them:', err);
            return { ok: false, status: 401, json: () => Promise.resolve({}) } as Response;
          })
        ]);

        if (!tenantRes.ok) {
          throw new Error('Failed to fetch tenant data');
        }

        const tenantData = await tenantRes.json();
        
        // Get SKU count
        let itemCount = 0;
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          itemCount = itemsData.count || (Array.isArray(itemsData) ? itemsData.length : 0);
        }

        // Get location limits (backend handles user type + tier calculation)
        let locationCurrent = 0;
        let locationLimit: number | string = 0;
        let locationIsUnlimited = false;
        let locationTierDisplayName = '';
        
        if (limitsRes.ok) {
          const limitsData = await limitsRes.json();
          locationCurrent = limitsData.current || 0;
          locationLimit = limitsData.limit || 0;
          locationIsUnlimited = limitsData.limit === 'unlimited';
          locationTierDisplayName = limitsData.tierDisplayName || '';
        }

        // Get tier info (handle both camelCase and snake_case from API)
        const tier = (tenantData.subscriptionTier || tenantData.subscription_tier || 'starter') as SubscriptionTier;
        const tierInfo = TIER_LIMITS[tier];
        const skuLimit = tierInfo.maxSkus;
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
        const subscriptionStatus = tenantData.subscriptionStatus || 'active';
        const internalStatus = deriveInternalStatus({
          subscriptionStatus,
          subscriptionTier: tier,
          trialEndsAt: tenantData.trialEndsAt,
          subscriptionEndsAt: tenantData.subscriptionEndsAt,
        });
        
        const maintenanceState = getMaintenanceState({
          tier,
          status: subscriptionStatus,
          trialEndsAt: tenantData.trialEndsAt,
        });

        // Extract GBP primary category from metadata
        const gbpPrimaryCategory = tenantData.metadata?.gbp_categories?.primary?.name || null;

        setUsage({
          tenantId,
          tenantName: tenantData.name,
          gbpPrimaryCategory,
          tier,
          tierName: tierInfo.name,
          tierPrice: tierInfo.price,
          tierDescription: tierInfo.description,
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
          trialEndsAt: tenantData.trialEndsAt,
          subscriptionEndsAt: tenantData.subscriptionEndsAt,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription usage');
        setUsage(null);
      } finally {
        setLoading(false);
      }
    };

    loadUsage();
  }, [tenantIdProp]);

  return { usage, loading, error };
}
