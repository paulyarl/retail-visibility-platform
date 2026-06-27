/**
 * useQuickLinks Hook
 *
 * Fetches the backend-driven, tier-and-capability-aware quick links list
 * from GET /api/tenants/:tenantId/quick-links via QuickLinksSingletonService.
 */

import { useQuery } from '@tanstack/react-query';
import { quickLinksService, QuickLinkDTO } from '@/services/QuickLinksSingletonService';

export type { QuickLinkDTO, LinkCategory } from '@/services/QuickLinksSingletonService';

export interface UseQuickLinksReturn {
  links: QuickLinkDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQuickLinks(tenantId: string | null): UseQuickLinksReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'quick-links', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return quickLinksService.getQuickLinks(tenantId);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!tenantId,
    retry: 1,
    throwOnError: false,
  });

  return {
    links: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
