/**
 * useOrgCapabilities Hook
 *
 * React Query hook that fetches org-level effective capabilities
 * for organization dashboard tab/panel gating.
 */

import { useQuery } from '@tanstack/react-query';
import { orgCapabilityService } from '@/services/OrgCapabilityService';
import type { OrgCapabilitiesState } from '@/services/OrgCapabilityService';

const STALE_TIME = 60 * 1000; // 1 minute
const GC_TIME = 5 * 60 * 1000; // 5 minutes

export function useOrgCapabilities(organizationId?: string | null) {
  return useQuery<OrgCapabilitiesState>({
    queryKey: ['org-capabilities', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('organizationId is required');
      }
      return orgCapabilityService.getOrgCapabilities(organizationId);
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!organizationId,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error && (error.status as number) === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
