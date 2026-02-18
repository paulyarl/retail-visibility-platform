/**
 * Hook for fetching public subscription usage data
 * Returns null for unauthenticated users (no subscription data available)
 * 
 * Usage:
 * const { usage, loading, error } = usePublicSubscriptionUsage();
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionUsage } from '@/hooks/useSubscriptionUsage';

export function usePublicSubscriptionUsage(tenantId?: string): {
  usage: SubscriptionUsage | null;
  loading: boolean;
  error: string | null;
} {
  const { isAuthenticated } = useAuth();

  // For public users, always return null
  const { data: usage, isLoading: loading, error } = useQuery({
    queryKey: ['public-subscription-usage', tenantId],
    queryFn: () => {
      // Always return null for public users
      return null;
    },
    enabled: false, // Never make API calls for public subscription usage
    staleTime: Infinity,
  });

  return {
    usage: null,
    loading: false,
    error: null,
  };
}
