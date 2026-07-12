/**
 * useEffectiveCapabilities Hook
 *
 * React Query hook that fetches the unified effective capability manifest
 * for a tenant. Single API call replaces the previous N+1 fan-out.
 */

import { useQuery } from '@tanstack/react-query';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import type { AllCapabilitiesState } from '@/services/CapabilityResolutionService';

const STALE_TIME = 60 * 1000; // 1 minute — aligned with backend cache TTL
const GC_TIME = 5 * 60 * 1000; // 5 minutes

export function useEffectiveCapabilities(tenantId?: string) {
  return useQuery<AllCapabilitiesState>({
    queryKey: ['effective-capabilities', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('tenantId is required');
      }
      return unifiedCapabilityService.getAllCapabilities(tenantId);
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!tenantId,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error && (error.status as number) === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useEffectiveCommerce(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.commerce, ...rest };
}

export function useEffectivePaymentGateway(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.paymentGateway, ...rest };
}

export function useEffectiveStorefront(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.storefront, ...rest };
}

export function useEffectiveFulfillment(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.fulfillment, ...rest };
}

export function useEffectiveProductOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.productOptions, ...rest };
}

export function useEffectiveFeaturedOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.featuredOptions, ...rest };
}

export function useEffectiveIntegrationOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.integrationOptions, ...rest };
}

export function useEffectiveQuickstartOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.quickstartOptions, ...rest };
}

export function useEffectiveStorefrontOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.storefrontOptions, ...rest };
}

export function useEffectiveFaqOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.faqOptions, ...rest };
}

export function useEffectiveCrmOptions(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.crmOptions, ...rest };
}

export function useEffectiveBarcodeScan(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.barcodeScan, ...rest };
}

export function useEffectiveWholesaleMatching(tenantId?: string) {
  const { data, ...rest } = useEffectiveCapabilities(tenantId);
  return { data: data?.wholesaleMatching, ...rest };
}
