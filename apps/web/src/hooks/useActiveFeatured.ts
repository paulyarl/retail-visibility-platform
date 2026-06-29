/**
 * useActiveFeatured Hook
 *
 * React Query hook for fetching active featured products from the ActiveFeaturedResolver API.
 * Used by visibility channels (storefront, directory, shops) to display
 * active featured products with fallback behavior.
 *
 * When tenantId is null, queries platform-level (cross-tenant) active featured.
 * When tenantId is provided, queries tenant-scoped active featured.
 */

import { useQuery } from '@tanstack/react-query';
import { activeFeaturedService, type ActiveFeaturedResult } from '@/services/ActiveFeaturedService';

const STALE_TIME = 60 * 1000; // 60 seconds
const GC_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch active featured products for a given tenant and surface.
 * When tenantId is null, queries platform-level (cross-tenant) active featured.
 */
export function useActiveFeatured(
  tenantId: string | null,
  surface: string,
  options?: { limit?: number; enabled?: boolean }
): {
  data: ActiveFeaturedResult | undefined;
  isLoading: boolean;
  error: any;
} {
  const limit = options?.limit ?? 10;
  const enabled = options?.enabled ?? true;

  const query = useQuery<ActiveFeaturedResult>({
    queryKey: ['active-featured', tenantId ?? 'platform', surface, limit],
    queryFn: () => {
      if (tenantId) {
        return activeFeaturedService.getActiveFeatured(tenantId, surface, limit);
      }
      return activeFeaturedService.getPlatformActiveFeatured(surface, limit);
    },
    enabled: enabled && !!surface,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export default useActiveFeatured;
