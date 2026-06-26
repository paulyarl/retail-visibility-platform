/**
 * useNextSteps Hook
 *
 * Fetches the backend-driven, tier-and-capability-aware next steps task list
 * from GET /api/tenants/:tenantId/next-steps via NextStepsSingletonService.
 *
 * Replaces the previous pattern of passing 15+ boolean props from scattered
 * API calls into TaskChecklist.
 */

import { useQuery } from '@tanstack/react-query';
import { nextStepsService, NextStepTask } from '@/services/NextStepsSingletonService';

export type { NextStepTask, TaskCategory, TaskPriority } from '@/services/NextStepsSingletonService';

export interface UseNextStepsReturn {
  tasks: NextStepTask[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNextSteps(tenantId: string | null): UseNextStepsReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'next-steps', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return nextStepsService.getNextSteps(tenantId);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!tenantId,
    retry: 1,
    throwOnError: false,
  });

  return {
    tasks: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
