/**
 * useEffectiveFlags
 *
 * React Query hook for fetching effective feature flags from the API.
 * Caches for 60s (staleTime) to minimize requests.
 * Falls back to false for all flags during SSR / initial load.
 */

import { useQuery } from '@tanstack/react-query';
import { adminPlatformFlagsService, type EffectiveFlag } from '@/services/AdminPlatformFlagsService';
import tenantFlagsService from '@/services/TenantFlagsService';

const STALE_TIME = 60 * 1000; // 60 seconds
const GC_TIME = 5 * 60 * 1000; // 5 minutes

export type EffectiveFlagsMap = Record<string, EffectiveFlag>;

export function useEffectiveFlags() {
  return useQuery<EffectiveFlagsMap>({
    queryKey: ['effective-flags', 'platform'],
    queryFn: async () => {
      return adminPlatformFlagsService.getEffectiveFlags();
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    initialData: {} as EffectiveFlagsMap,
  });
}

/**
 * Fetch effective flags for a specific tenant (platform + tenant overrides).
 */
export function useEffectiveTenantFlags(tenantId?: string) {
  return useQuery<EffectiveFlagsMap>({
    queryKey: ['effective-flags', 'tenant', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const flags = await tenantFlagsService.getEffectiveFlags(tenantId);
      const map: EffectiveFlagsMap = {};
      for (const flag of flags) {
        if (flag.flag) map[flag.flag] = flag as unknown as EffectiveFlag;
      }
      return map;
    },
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    initialData: {} as EffectiveFlagsMap,
  });
}
